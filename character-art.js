/* Premium layered characters (Claude-owned). Requires wardrobe-data.js. See ART_SPEC.md.
 * One renderer for gameplay, NPCs and the Character Studio: a parametric 2.5D body drawn in 8 directions
 * (E, SE, S, SW, W, NW, N, NE — the game's facing order) with idle (4), walk (8) and run (8) frames, and 12 clothing
 * layers drawn in order on top of it. Frames are rendered at 2× native resolution (crisp half-pixel detail at the
 * game's 2× DPR), outlined, and kept in a bounded LRU frame cache keyed by outfit + direction + animation + frame.
 * Integration: wraps NightshiftSprites.person / personTo (load before detailed-art.js so Codex's held-weapon pass
 * still draws on top). NightshiftCharacters.enabled = false restores the previous art instantly.
 * API: NightshiftCharacters.{frame(outfit, dir, anim, f, scale), draw(ctx, outfit, x, y, dir, anim, f), outfitFor(p, isPlayer, role), CELL, enabled} */
(function (root) {
  'use strict';
  const W = root.NightshiftWardrobeData;
  if (!W || !root.document) return;
  const CELL = { w: 44, h: 56, ax: 22, ay: 36 }; // world px; anchor = body centre (feet at +14)
  const ANIMS = { idle: 4, walk: 8, run: 8 };
  const INK = '#11151c';
  function shade(hex, amt) { const n = parseInt(String(hex).slice(1, 7), 16); if (!Number.isFinite(n)) return hex; let r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255; const f = amt < 0 ? (v) => Math.round(v * (1 + amt)) : (v) => Math.round(v + (255 - v) * amt); return '#' + ((1 << 24) | (f(r) << 16) | (f(gg) << 8) | f(b)).toString(16).slice(1); }
  const lum = (h) => { const n = parseInt(String(h).slice(1, 7), 16); return ((n >> 16 & 255) * 0.3 + (n >> 8 & 255) * 0.59 + (n & 255) * 0.11) / 255; };

  // ---------------- geometry ----------------
  function geom(o, dir, anim, f, hold = '') {
    const a = dir * Math.PI / 4, sx = Math.cos(a), sy = Math.sin(a), side = Math.abs(sx), bw = (W.BUILDS.find((b) => b.id === o.build) || W.BUILDS[1]).w;
    const n = ANIMS[anim] || 1, k = ((f % n) + n) % n;
    let stride = 0, bob = 0, arm = 0, lean = 0;
    if (anim === 'walk') { stride = [0, 2, 3, 2, 0, -2, -3, -2][k]; bob = [0, -0.5, -1, -0.5, 0, -0.5, -1, -0.5][k]; arm = -stride * 0.8; }
    else if (anim === 'run') { stride = [0, 3, 5, 3, 0, -3, -5, -3][k]; bob = [-1, -2, -1.5, 0, -1, -2, -1.5, 0][k]; arm = -stride * 1.1; lean = 1.4; }
    else { bob = [0, -0.3, -0.5, -0.3][k]; }
    const SW = (12.5 - 4 * side * (1 - Math.abs(sy))) * bw, cx = sx * lean * 0.6;
    const g = { sx, sy, side, front: sy > 0.25, back: sy < -0.25, profile: side > 0.85, bw, stride, bob, arm, lean, k, anim, SW, cx,
      shY: -12.5 + bob, waY: -0.5 + bob, hipY: 1.5 + bob, footY: 14, headX: cx + sx * (1 + lean * 0.5), headY: -19.5 + bob, blink: anim === 'idle' && k === 3 };
    const spread = 2.7 * bw * (1 - 0.65 * side);
    g.legs = [-1, 1].map((s) => { const st = s * stride; return { s, hx: cx * 0.5 + s * spread, hy: g.hipY, fx: s * spread + sx * st * 0.9, fy: g.footY + sy * st * 0.35 - (anim !== 'idle' && st > 0 ? Math.min(1.5, st * 0.3) : 0), near: s * sx * -1 + sy * 0.01 }; });
    g.arms = [-1, 1].map((s) => { const sw = s * arm, spreadA = 1 - side * 0.8 * (1 - Math.abs(sy) * 0.6); return { s, x: cx + s * (g.SW / 2 - 0.6) * spreadA, y: g.shY + 1.2, hx: cx + s * (g.SW / 2 + 0.2) * spreadA + sx * sw * 0.7 - (anim === 'run' ? s * 0.6 : 0), hy: g.shY + (anim === 'run' ? 8.5 : 11.5) + sy * sw * 0.25 }; });
    // which arm is nearer the viewer (drawn after the torso in profile)
    // holding a gun: hands come up to chest height in front of the body (long guns: support hand further out on the handguard)
    if (hold) { const F = [cx + sx * 6.5, g.shY + 7 + sy * 1.2];
      g.hold = hold; g.arms = g.arms.map((A) => { let hx, hy;
        if (g.back) { hx = cx + A.s * (g.SW / 2 - 1.2); hy = g.shY + 3; }
        else if (hold === 'long' && A.s === 1) { hx = F[0] + sx * 3.5 + (1 - side) * 1.5; hy = F[1] + sy * 1.4; }
        else { hx = F[0] + A.s * 0.7 * (1 - side); hy = F[1] + 0.4; }
        return { ...A, hx, hy }; }); }
    g.nearArm = g.profile ? (sy >= 0 ? (sx > 0 ? 1 : -1) : (sx > 0 ? 1 : -1)) : 0;
    return g;
  }

  // ---------------- primitives ----------------
  let c = null; // current ctx while rendering
  const R = (col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const O = (col, x, y, rx, ry) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, Math.max(0.3, rx), Math.max(0.3, ry), 0, 0, Math.PI * 2); c.fill(); };
  function poly(col, pts) { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); }
  function limb(col, x1, y1, x2, y2, w1, w2) { const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; poly(col, [[x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x2 + nx * w2 / 2, y2 + ny * w2 / 2], [x2 - nx * w2 / 2, y2 - ny * w2 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2]]); }
  const line = (col, x1, y1, x2, y2, w = 0.5) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  const colorOf = (p) => (p ? W.ITEM[p.id].colors[p.color] || W.ITEM[p.id].colors[0] : null);
  const lerp = (a, b, t) => a + (b - a) * t;
  const at = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  // ---------------- body ----------------
  function torsoPts(g, top, bot, widen = 0) { const w1 = g.SW / 2 + widen, w2 = g.SW / 2 - 1.2 * g.bw + widen; return [[g.cx - w1, top], [g.cx + w1, top], [g.cx + w2, bot], [g.cx - w2, bot]]; }
  function drawLeg(g, L, col, w = 4.2) { limb(col, g.cx * 0.5 + L.hx, L.hy, L.fx, L.fy - 1.5, w * g.bw, w * 0.85 * g.bw); }
  function drawArm(g, A, col, wTop = 3.4, upto = 1) { const e = at([A.x, A.y], [A.hx, A.hy], upto); limb(col, A.x, A.y, e[0], e[1], wTop, wTop * 0.88); }
  function hand(g, A, col) { O(col, A.hx, A.hy + 0.5, 1.3, 1.25); O(shade(col, 0.18), A.hx - 0.4, A.hy + 0.1, 0.5, 0.4); }
  function head(g, o, skin) {
    const x = g.headX, y = g.headY, hw = 4.8 - g.side * 0.5;
    R(shade(skin, -0.12), x - 1.5, y + 3.5, 3, 3.5); // neck
    O(skin, x, y, hw, 5.2);
    if (g.side > 0.3 && !g.back) { c.save(); c.globalAlpha = 0.45; O(shade(skin, -0.2), x - g.sx * hw * 0.62, y + 0.8, hw * 0.34, 3.8); c.restore(); } // far-cheek shade
    c.save(); c.globalAlpha = 0.5; R(shade(skin, -0.22), x - hw * 0.6, y + 3.6, hw * 1.2, 0.8); c.restore(); // under-chin
    O(shade(skin, 0.12), x - g.sx * 1.2 - 1, y - 1.8, 1.6, 1.2); // forehead light (top-left)
    if (!g.back) {
      // ears
      if (g.side > 0.3) O(shade(skin, -0.06), x - g.sx * (hw - 0.8), y + 0.5, 0.8, 1.2); else { O(shade(skin, -0.06), x - hw + 0.2, y + 0.6, 0.8, 1.2); O(shade(skin, -0.06), x + hw - 0.2, y + 0.6, 0.8, 1.2); }
      // eyes, brows, nose, mouth
      const fv = Math.max(0.15, g.sy), eyes = g.profile ? [g.sx > 0 ? 1 : -1] : [-1, 1];
      for (const e of eyes) { const ex = x + g.sx * 2.4 + (g.profile ? 0.6 * g.sx : e * 2.0 * fv), ey = y - 0.4; if (!g.blink) { R('#f4efe6', ex - 0.8, ey - 0.5, 1.6, 1.1); R('#1b1410', ex - 0.35 + g.sx * 0.35, ey - 0.5, 0.8, 1.1); } else R(shade(skin, -0.35), ex - 0.8, ey, 1.6, 0.4); R(shade(W.HAIR_COLORS[o.hairColor], -0.1), ex - 0.9, ey - 1.6, 1.8, 0.5); }
      if (g.side > 0.3) R(shade(skin, -0.15), x + g.sx * 4.4, y + 0.4, 0.8 * Math.sign(g.sx), 1.4); else R(shade(skin, -0.22), x - 0.3 + g.sx, y + 0.8, 0.7, 1.2);
      R('#8a4a3a', x - 1 + g.sx * 2.2, y + 2.6, g.profile ? 1.2 : 2, 0.5);
    }
  }
  // ---------------- hair & facial hair ----------------
  // Hair is split: the mass behind the head (drawn before it) and the front/top (after it).
  function hairBack(g, o) {
    const x = g.headX, y = g.headY, col = W.HAIR_COLORS[o.hairColor], hi = shade(col, 0.22), dk = shade(col, -0.25), st = o.hair;
    if (st === 'afro' || st === 'curly') { const r = st === 'afro' ? 6.9 : 5.9; O(dk, x, y - 1.4, r + 0.3, r * 0.9 + 0.3); O(col, x, y - 1.8, r, r * 0.88); for (let i = 0; i < (st === 'afro' ? 12 : 8); i++) { const a = i * 0.62; O(i % 2 ? hi : dk, x + Math.cos(a) * r * 0.72, y - 1.8 + Math.sin(a) * r * 0.6, 1.1, 1); } }
    if (st === 'long') { for (const s of [-1, 1]) limb(dk, x + s * 4, y - 1, x + s * 4.4, y + 6.5, 3, 2.4); if (g.back) R(col, x - 4.6, y - 1, 9.2, 7.6); }
    if (st === 'locs' || st === 'braids') { const n = st === 'braids' ? 8 : 6; for (let i = 0; i < n; i++) { const t = i / (n - 1), lx = x - 4.8 + t * 9.6; limb(i % 2 ? col : dk, lx, y - 2, lx + (t - 0.5) * 1.6, y + 7.5 + (i % 2), 1.5, 1.1); if (st === 'braids') R(hi, lx - 0.3, y + 2 + (i % 3), 0.6, 0.6); } }
    if (st === 'ponytail' && !g.front) { const tx = x - g.sx * 4.2, ty = y - 1; limb(col, tx, ty, tx - g.sx * 2.2, ty + 7.5 + (g.anim !== 'idle' ? Math.sin(g.k) * 0.8 : 0), 2.6, 1.3); }
  }
  function hair(g, o) {
    const x = g.headX, y = g.headY, col = W.HAIR_COLORS[o.hairColor], hi = shade(col, 0.25), dk = shade(col, -0.25), st = o.hair;
    if (st === 'bald') { O('#ffffff26', x - 1.2, y - 3.2, 2, 1); return; }
    const cap = (h) => { c.save(); c.beginPath(); c.ellipse(x, y - 0.6, 5.25, 5.7, 0, 0, Math.PI * 2); c.clip(); R(col, x - 7, y - 7, 14, h); R(hi, x - 3 - g.sx, y - 5.8, 3, 0.9); R(dk, x - 7, y - 7 + h - 0.6, 14, 0.6); c.restore(); };
    if (st === 'buzz') { c.save(); c.globalAlpha = 0.7; cap(g.back ? 9 : 4.2); c.restore(); return; }
    if (st === 'fade') { cap(g.back ? 6 : 4.2); if (!g.back) { R(shade(col, 0.45), x - 5, y - 1.8, 1, 2.2); R(shade(col, 0.45), x + 4, y - 1.8, 1, 2.2); } return; }
    if (st === 'short') { cap(g.back ? 8.5 : 4.6); if (!g.back) poly(col, [[x - 4.4 + g.sx * 2, y - 3.2], [x + 1.2 + g.sx * 2, y - 4.4], [x - 1.4 + g.sx * 2, y - 1.6]]); return; }
    if (st === 'curly' || st === 'afro') { cap(g.back ? 9 : 3.6); if (!g.back) for (let i = 0; i < 5; i++) O(i % 2 ? hi : dk, x - 3.6 + i * 1.8 + g.sx, y - 4.4 + (i % 2) * 0.6, 1, 0.9); return; }
    if (st === 'locs' || st === 'braids') { cap(g.back ? 8 : 4.4); for (let i = 0; i < 4; i++) R(dk, x - 3.4 + i * 2.2, y - 5.4, 0.5, 3); if (g.back) for (let i = 0; i < 6; i++) limb(i % 2 ? col : dk, x - 4 + i * 1.6, y - 1, x - 4.2 + i * 1.7, y + 7, 1.4, 1.1); return; }
    if (st === 'bun') { cap(g.back ? 7 : 4.4); O(dk, x - g.sx * 1.2, y - 6.5, 2.6, 2.1); O(col, x - g.sx * 1.2, y - 6.8, 2.3, 1.8); O(hi, x - g.sx * 1.2 - 0.6, y - 7.4, 0.8, 0.6); return; }
    if (st === 'ponytail') { cap(g.back ? 7.5 : 4.6); if (g.front) { const tx = x - g.sx * 4.2; limb(dk, tx, y - 1, tx - g.sx * 1.2, y + 5, 2, 1.2); } return; }
    if (st === 'long') { cap(g.back ? 9 : 4.8); if (!g.back) { poly(col, [[x - 4.6 + g.sx * 2.4, y - 3.4], [x + 1.6 + g.sx * 2.4, y - 4.6], [x + 4.6, y - 2], [x - 2 + g.sx * 2.4, y - 2]]); for (const s of [-1, 1]) if (!(g.profile && s * g.sx > 0)) limb(col, x + s * 4.3, y - 1.5, x + s * 4.5, y + 5.5, 2.4, 1.8); } return; }
    if (st === 'mohawk') { c.save(); c.globalAlpha = 0.5; cap(g.back ? 8 : 3.6); c.restore(); for (let i = 0; i < 5; i++) R(i % 2 ? col : hi, x - 1.1 - g.sx * 0.5, y - 7.8 + i * 1.6, 2.2, 1.9); return; }
  }
  function facial(g, o, skin) {
    if (g.back || o.facial === 'none') return; const x = g.headX + g.sx * 2.2, y = g.headY, col = shade(W.HAIR_COLORS[o.hairColor], 0.05), w = g.profile ? 3 : 4.6;
    if (o.facial === 'stubble') { c.save(); c.globalAlpha = 0.35; O(col, x, y + 2.8, w * 0.8, 1.6); c.restore(); }
    if (o.facial === 'mustache') R(col, x - w / 2 + 0.6, y + 1.9, w - 1.2, 0.7);
    if (o.facial === 'goatee') { R(col, x - 1, y + 2.9, 2, 1.8); R(col, x - w / 2 + 0.8, y + 1.9, w - 1.6, 0.6); }
    if (o.facial === 'beard') { poly(col, [[x - w / 2 - 0.5, y + 0.6], [x + w / 2 + 0.5, y + 0.6], [x + w / 2 - 0.5, y + 4.2], [x, y + 5.4], [x - w / 2 + 0.5, y + 4.2]]); R('#8a4a3a', x - 0.8, y + 2.6, 1.6, 0.5); }
  }

  // ---------------- clothing ----------------
  const isOpen = (p) => p && W.ITEM[p.id].opts.open && p.open;
  function camo(col, x, y, w, h, seed = 3) { const a = shade(col, -0.3), b = shade(col, 0.18); let s = seed; for (let i = 0; i < 9; i++) { s = (s * 9301 + 49297) % 233280; const rx = x + (s / 233280) * w; s = (s * 9301 + 49297) % 233280; const ry = y + (s / 233280) * h; O(i % 2 ? a : b, rx, ry, 1.6, 1); } }
  function bottoms(g, o, skin) {
    const p = o.bottom, it = p.id, col = colorOf(p), dk = shade(col, -0.25), hi = shade(col, 0.15);
    const legCol = it === 'shorts' || it === 'skirt' ? skin : col;
    // far leg first
    const order = g.legs.slice().sort((a, b) => a.near - b.near);
    for (const L of order) {
      drawLeg(g, L, it === 'shorts' || it === 'skirt' ? shade(skin, -0.05) : (L.near < 0 ? dk : col));
      if (it === 'shorts') { const m = at([g.cx * 0.5 + L.hx, L.hy], [L.fx, L.fy], 0.55); limb(L.near < 0 ? dk : col, g.cx * 0.5 + L.hx, L.hy - 1, m[0], m[1], 5.2 * g.bw, 5 * g.bw); R(hi, m[0] - 2.4 * g.bw, m[1] - 0.6, 4.8 * g.bw, 0.6); }
      else if (it === 'skirt') { /* skirt drawn after */ }
      else {
        const k = at([g.cx * 0.5 + L.hx, L.hy], [L.fx, L.fy], 0.5);
        if (it === 'jeans') { line(shade(col, 0.25), g.cx * 0.5 + L.hx + 1.2, L.hy + 1, L.fx + 1, L.fy - 2, 0.35); R(shade(col, -0.35), k[0] - 1.6, k[1], 3.2, 0.4); }
        if (it === 'cargo') { if (p.pattern === 1) camo(col, k[0] - 2.5, L.hy, 5, L.fy - L.hy - 2, L.s > 0 ? 7 : 11); R(dk, k[0] - 1.8 + L.s * 0.6, k[1] - 2.2, 3.6, 3.4); R(hi, k[0] - 1.8 + L.s * 0.6, k[1] - 2.2, 3.6, 0.6); R(shade(col, -0.45), k[0] - 0.2 + L.s * 0.6, k[1] - 1.4, 0.4, 0.8); }
        if (it === 'joggers') { R(shade(col, 0.4), k[0] - 0.3 + L.s * 1.6, L.hy + 1, 0.6, L.fy - L.hy - 4); R(dk, L.fx - 2, L.fy - 3, 4, 1.4); }
        if (it === 'chinos') line(shade(col, 0.2), k[0], L.hy + 1.5, L.fx, L.fy - 2.5, 0.35);
      }
    }
    // hips / seat
    poly(it === 'skirt' ? col : col, [[g.cx - g.SW / 2 + 1.3 * g.bw, g.waY - 0.5], [g.cx + g.SW / 2 - 1.3 * g.bw, g.waY - 0.5], [g.cx + g.SW / 2 - 0.6 * g.bw, g.hipY + 2], [g.cx - g.SW / 2 + 0.6 * g.bw, g.hipY + 2]]);
    if (it === 'jeans' && !g.back) { R(shade(col, 0.3), g.cx - 0.2, g.waY, 0.4, 3); R('#c9a24a', g.cx - 0.4, g.waY + 0.4, 0.8, 0.8); }
    if (it === 'jeans' && g.back) { R(dk, g.cx - 3.2, g.waY + 1, 2.6, 2.2); R(dk, g.cx + 0.6, g.waY + 1, 2.6, 2.2); }
    if (it === 'skirt') { const t = g.waY - 0.5, b = g.hipY + 5.5, w1 = g.SW / 2 - 1, w2 = g.SW / 2 + 1.6; poly(col, [[g.cx - w1, t], [g.cx + w1, t], [g.cx + w2, b], [g.cx - w2, b]]); for (let i = -2; i <= 2; i++) line(dk, g.cx + i * 1.4, t + 1, g.cx + i * 1.9, b, 0.4); }
  }
  function shoes(g, o) {
    const p = o.shoes, it = p.id, col = colorOf(p), sole = it === 'hitops' ? (lum(col) > 0.7 ? '#c98a4a' : '#f1efe8') : it === 'runners' ? '#f4f1ea' : it === 'boots' ? '#2a1f1a' : it === 'dress' ? '#15110e' : '#2b2f33';
    const order = g.legs.slice().sort((a, b) => a.near - b.near);
    for (const L of order) {
      const x = L.fx, y = L.fy, fw = 4.6 * g.bw, dx = g.sx * 1.6, dy = Math.max(0, g.sy) * 0.6;
      if (it === 'slides') { R('#f1efe8', x - 1.6, y - 3.2, 3.2, 2.2); O(sole, x + dx, y + dy, fw / 2 + 0.4, 1.5); R(col, x - 2 + dx, y - 1.2 + dy, 4, 1.4); continue; }
      const tall = it === 'boots' ? 3.4 : it === 'hitops' ? 2.6 : 1.2;
      O(sole, x + dx, y + dy + 0.4, fw / 2 + 0.5, 1.6); // sole
      R(col, x - fw / 2 + 0.3, y - tall, fw - 0.6, tall + 0.6); O(col, x + dx, y + dy - 0.6, fw / 2, 1.6); // upper + toe
      R(shade(col, 0.3), x - fw / 2 + 0.5, y - tall, fw - 1, 0.5);
      if (it === 'hitops') { R(shade(col, -0.3), x - 0.9 + dx * 0.4, y - tall + 0.4, 1.8, tall); for (let i = 0; i < 3; i++) R('#f4f1ea', x - 0.7 + dx * 0.4, y - tall + 0.6 + i * 0.9, 1.4, 0.35); if (!g.back) R(lum(col) > 0.7 ? '#c84659' : '#f1efe8', x - 1.8 + dx, y - 0.6, 2.6, 0.6); }
      if (it === 'runners') { R(lum(col) > 0.7 ? '#3d7fc6' : '#f1efe8', x - 1.5 + dx, y - 0.9, 3, 0.5); }
      if (it === 'boots') { R(shade(col, -0.35), x - fw / 2 + 0.3, y + 0.2, fw - 0.6, 0.5); for (let i = 0; i < 2; i++) R('#e8d8b0', x - 0.6, y - tall + 0.8 + i, 1.2, 0.3); }
      if (it === 'dress') O('#ffffff55', x + dx * 1.2, y + dy - 1.1, 1, 0.4);
    }
  }
  function sleeveLen(o) { const t = o.top?.id; if (o.outer && o.outer.id !== 'vest') return 1; if (t === 'tank') return 0; if (t === 'tee' || t === 'polo' || t === 'jersey') return 0.42; if (o.top?.rolled) return 0.55; return 1; }
  function armLayer(g, o, skin, A) {
    const top = o.top, out = o.outer && o.outer.id !== 'vest' ? o.outer : null, sl = sleeveLen(o);
    drawArm(g, A, skin, 3.1);
    const scol = out ? colorOf(out) : colorOf(top);
    if (sl > 0) {
      const col = out?.id === 'varsity' ? '#efe6cc' : scol;
      drawArm(g, A, A.s * g.sx < 0 && g.profile ? shade(col, -0.18) : col, out?.id === 'puffer' ? 4.6 : out ? 3.8 : 3.5, sl);
      const e = at([A.x, A.y], [A.hx, A.hy], sl);
      if (out?.id === 'track') { const m = at([A.x, A.y], [A.hx, A.hy], 0.5); line('#f4f1ea', A.x + 1.1 * A.s, A.y + 0.5, e[0] + 1.1 * A.s, e[1], 0.45); line('#f4f1ea', A.x + 1.8 * A.s, A.y + 0.5, e[0] + 1.8 * A.s, e[1], 0.45); void m; }
      if (out?.id === 'puffer') { for (let i = 1; i < 4; i++) { const q = at([A.x, A.y], [A.hx, A.hy], i / 4); R(shade(scol, -0.25), q[0] - 2.2, q[1], 4.4, 0.45); } }
      if (out?.id === 'bomber' || out?.id === 'varsity' || out?.id === 'hoodie' || (top?.id === 'longsleeve' && !out)) R(shade(col, -0.25), e[0] - 1.8, e[1] - 0.8, 3.6, 1); // ribbed cuffs
      if (out?.id === 'leather') { const q = at([A.x, A.y], [A.hx, A.hy], 0.45); line(shade(scol, 0.35), q[0] - 1.2, q[1], q[0] + 1, q[1] + 0.6, 0.4); }
    }
    const gl = o.gloves; hand(g, A, gl ? colorOf(gl) : skin);
    if (gl?.id === 'fingerless') O(skin, A.hx + g.sx * 0.8, A.hy + 1.4, 1, 0.5);
    const jw = o.jewelry?.id; if ((jw === 'watch' || jw === 'chainwatch') && A.s === (g.sx >= 0 ? -1 : 1)) { R(colorOf(o.jewelry), A.hx - 1.3, A.hy - 1.6, 2.6, 0.9); R('#ffffff', A.hx - 0.4, A.hy - 1.5, 0.6, 0.5); }
  }
  function topLayer(g, o, skin) {
    const p = o.top, it = p.id, col = colorOf(p), dk = shade(col, -0.22), hi = shade(col, 0.16);
    const bot = p.tucked ? g.waY + 0.4 : g.hipY + 0.6;
    if (it === 'tank') { poly(skin, torsoPts(g, g.shY, g.shY + 3)); poly(col, torsoPts(g, g.shY + 1.5, bot, -1.1)); if (!g.back) { R(col, g.cx - g.SW / 2 + 1.6, g.shY, 1.2, 2); R(col, g.cx + g.SW / 2 - 2.8, g.shY, 1.2, 2); O(skin, g.cx + g.sx * 1.2, g.shY + 1.6, 2.2, 1.3); } }
    else poly(col, torsoPts(g, g.shY, bot));
    R(hi, g.cx - g.SW / 2 + 1, g.shY + 0.5, 1.2, (bot - g.shY) * 0.8); R(dk, g.cx + g.SW / 2 - 2.2, g.shY + 1, 1.2, bot - g.shY - 1.5);
    if (!g.back) {
      if (it === 'tee' || it === 'longsleeve' || it === 'jersey') O(shade(col, -0.35), g.cx + g.sx * 1.5, g.shY + 0.4, 1.8, 0.8);
      if (it === 'polo') { poly('#f4f1ea' === col ? shade(col, -0.1) : shade(col, 0.25), [[g.cx - 2.4 + g.sx, g.shY - 0.4], [g.cx + g.sx, g.shY + 1.6], [g.cx + 2.4 + g.sx, g.shY - 0.4]]); R(dk, g.cx + g.sx - 0.2, g.shY + 1.4, 0.4, 2.4); }
      if (it === 'buttonup') { poly(shade(col, -0.12), [[g.cx - 2.6 + g.sx, g.shY - 0.6], [g.cx - 0.2 + g.sx, g.shY + 1.8], [g.cx + g.sx, g.shY], [g.cx + 0.2 + g.sx, g.shY + 1.8], [g.cx + 2.6 + g.sx, g.shY - 0.6]]); R(dk, g.cx + g.sx - 0.2, g.shY + 1.6, 0.4, bot - g.shY - 2); for (let i = 0; i < 4; i++) R('#e8e2d0', g.cx + g.sx - 0.3, g.shY + 2.6 + i * 2.4, 0.6, 0.6); }
      if (it === 'jersey') { R(lum(col) > 0.6 ? '#1d2433' : '#f4f1ea', g.cx + g.sx * 1.4 - 1.6, g.shY + 3.2, 3.2, 3.4); R(col, g.cx + g.sx * 1.4 - 0.4, g.shY + 3.8, 0.8, 1.2); R(col, g.cx + g.sx * 1.4 - 1, g.shY + 5.2, 2, 0.6); for (const s of [-1, 1]) R(lum(col) > 0.6 ? '#1d2433' : '#f4f1ea', g.cx + s * (g.SW / 2 - 1.2), g.shY, 0.6, bot - g.shY); }
    } else if (it === 'jersey') { R(lum(col) > 0.6 ? '#1d2433' : '#f4f1ea', g.cx - 2.2, g.shY + 2.5, 4.4, 5); }
    if (p.tucked) { R('#2a1f1a', g.cx - g.SW / 2 + 1.2 * g.bw, g.waY - 0.2, g.SW - 2.4 * g.bw, 1); R('#c9a24a', g.cx + g.sx - 0.6, g.waY - 0.2, 1.2, 1); }
  }
  function outerLayer(g, o, skin) {
    const p = o.outer; if (!p) return; const it = p.id, col = colorOf(p), dk = shade(col, -0.25), hi = shade(col, 0.18), open = isOpen(p);
    const long = it === 'trench', bot = long ? g.hipY + 7.5 : it === 'puffer' ? g.hipY + 0.6 : it === 'vest' ? g.waY + 1 : g.hipY + 1, widen = it === 'puffer' ? 1.2 : it === 'vest' ? -0.2 : 0.5;
    const pts = torsoPts(g, g.shY - 0.4, bot, widen); if (long) { pts[2][0] += 1.2; pts[3][0] -= 1.2; }
    if (it === 'hoodie' && p.hood && !g.back) { /* hood drawn with the head */ }
    if (open && !g.back) {
      // two front panels with the top showing between
      const gap = 1.8 + (long ? 0.6 : 0), mid = g.cx + g.sx * 1.4;
      c.save(); c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
      R(col, pts[0][0] - 2, g.shY - 2, mid - gap / 2 - pts[0][0] + 2, bot - g.shY + 4); R(col, mid + gap / 2, g.shY - 2, pts[1][0] - mid + 2, bot - g.shY + 4);
      R(it === 'bomber' ? '#e8833a' : shade(col, -0.4), mid - gap / 2 - 0.5, g.shY, 0.5, bot - g.shY); R(it === 'bomber' ? '#e8833a' : shade(col, -0.4), mid + gap / 2, g.shY, 0.5, bot - g.shY);
      c.restore();
    } else poly(col, pts);
    // shading
    R(hi, pts[0][0] + 0.6, g.shY + 0.4, 1.1, (bot - g.shY) * 0.7); R(dk, pts[1][0] - 1.8, g.shY + 1, 1.2, bot - g.shY - 1.5);
    const mid = g.cx + g.sx * 1.4;
    if (it === 'hoodie') { if (!g.back) { R(dk, mid - 3, g.waY - 3.5, 6, 3); R(shade(col, -0.4), mid - 3, g.waY - 3.5, 6, 0.4); line('#f4f1ea', mid - 1, g.shY + 0.5, mid - 1.2, g.shY + 4, 0.4); line('#f4f1ea', mid + 1, g.shY + 0.5, mid + 1.2, g.shY + 4, 0.4); } R(dk, pts[3][0] + 0.4, bot - 1.2, pts[2][0] - pts[3][0] - 0.8, 1.2); }
    if (it === 'leather') { if (!g.back && !open) { line('#c9d1d6', mid + 2, g.shY + 0.5, mid - 1, bot - 0.6, 0.5); poly(dk, [[mid - 3.2, g.shY - 0.4], [mid - 0.5, g.shY + 3], [mid - 3.5, g.shY + 3.4]]); poly(dk, [[mid + 3.2, g.shY - 0.4], [mid + 0.8, g.shY + 2.6], [mid + 3.5, g.shY + 3]]); R('#c9d1d6', mid + 2.4, g.shY + 5, 0.6, 0.6); } for (let i = 0; i < 2; i++) line(shade(col, 0.3), pts[0][0] + 2, g.shY + 4 + i * 3, pts[0][0] + 4, g.shY + 4.6 + i * 3, 0.3); }
    if (it === 'puffer') { for (let i = 1; i < 4; i++) { const yy = g.shY + i * (bot - g.shY) / 4; R(dk, pts[0][0] - 0.5, yy, pts[1][0] - pts[0][0] + 1, 0.6); R(hi, pts[0][0], yy - 1, pts[1][0] - pts[0][0], 0.4); } if (!g.back) R(dk, mid - 3.5, g.shY - 1.4, 7, 1.6); }
    if (it === 'varsity') { if (!g.back) { R('#efe6cc', mid + 1.6, g.shY + 2.4, 2.6, 3.2); R(col, mid + 2.4, g.shY + 3, 1, 2); if (!open) for (let i = 0; i < 4; i++) R('#efe6cc', mid - 0.3, g.shY + 1.5 + i * 2.2, 0.6, 0.6); } else { R('#efe6cc', g.cx - 2.5, g.shY + 2, 5, 3); } R('#efe6cc', pts[3][0] + 0.4, bot - 1.2, pts[2][0] - pts[3][0] - 0.8, 0.5); R(shade(col, -0.4), pts[3][0] + 0.4, bot - 0.7, pts[2][0] - pts[3][0] - 0.8, 0.7); }
    if (it === 'denim') { for (let i = 0; i < 7; i++) R(shade(col, i % 2 ? 0.1 : -0.1), pts[0][0] + 1 + i * 1.6, g.shY + 1, 0.3, bot - g.shY - 2); if (!g.back) { for (const s of [-1, 1]) { R(dk, mid + s * 2.6 - 1.2, g.shY + 2.2, 2.4, 2); R('#c9843a', mid + s * 2.6 - 0.3, g.shY + 2.6, 0.6, 0.6); } } R(dk, pts[3][0] + 0.4, bot - 1.4, pts[2][0] - pts[3][0] - 0.8, 1); }
    if (it === 'track') { if (!g.back && !open) line('#c9d1d6', mid, g.shY, mid, bot, 0.4); R(shade(col, -0.35), mid - 2.2, g.shY - 0.6, 4.4, 1.2); }
    if (it === 'vest') { for (const s of [-1, 1]) { R(shade(col, -0.35), g.cx + s * 2.6 - 1.4 + g.sx, g.shY + 4, 2.8, 3.4); R(shade(col, 0.15), g.cx + s * 2.6 - 1.4 + g.sx, g.shY + 4, 2.8, 0.6); } R(shade(col, -0.4), pts[0][0] + 0.5, g.shY - 0.4, 1.4, 3); R(shade(col, -0.4), pts[1][0] - 1.9, g.shY - 0.4, 1.4, 3); }
    if (it === 'trench') { R(shade(col, -0.35), pts[0][0] + 0.3, g.waY - 0.6, pts[1][0] - pts[0][0] - 0.6, 1.2); R('#c9a24a', mid - 0.6, g.waY - 0.6, 1.2, 1.2); if (!g.back) { poly(dk, [[mid - 3.6, g.shY - 0.4], [mid - 0.6, g.shY + 4], [mid - 3.8, g.shY + 4.4]]); poly(dk, [[mid + 3.6, g.shY - 0.4], [mid + 0.6, g.shY + 4], [mid + 3.8, g.shY + 4.4]]); } }
    if (it === 'bomber') { R(shade(col, -0.35), pts[3][0] + 0.4, bot - 1.2, pts[2][0] - pts[3][0] - 0.8, 1.2); if (!g.back) { R(shade(col, -0.35), mid - 2.4, g.shY - 0.6, 4.8, 1.2); R('#c9d1d6', mid - 0.2, g.shY + 0.6, 0.4, bot - g.shY - 2); } if (g.back) R('#e8833a', g.cx - 0.5, g.shY - 0.6, 1, 0.8); }
  }
  function jewelry(g, o) { const p = o.jewelry; if (!p || g.back || p.id === 'watch') return; const col = colorOf(p); c.strokeStyle = col; c.lineWidth = 0.7; c.beginPath(); c.ellipse(g.cx + g.sx * 1.4, g.shY + 0.6, 2.6 - g.side * 0.6, 3, 0, 0.2, Math.PI - 0.2); c.stroke(); O('#ffffff', g.cx + g.sx * 1.4 - 1, g.shY + 3, 0.4, 0.4); O(col, g.cx + g.sx * 1.4, g.shY + 3.8, 0.9, 0.9); }
  function bagBack(g, o) { const p = o.bag; if (!p) return; const col = colorOf(p), dk = shade(col, -0.3);
    if (p.id === 'backpack' && !g.front) { const bx = g.cx - g.sx * 2.5, w = g.back ? 8.5 : 5; R(col, bx - w / 2, g.shY + 1, w, 9.5); R(shade(col, 0.2), bx - w / 2, g.shY + 1, w, 1); R(dk, bx - w / 2 + 1, g.shY + 5.5, w - 2, 3.5); R('#c9d1d6', bx - 0.4, g.shY + 5.8, 0.8, 0.8); }
    if (p.id === 'duffel') { const bx = g.cx + (g.sx >= 0 ? -1 : 1) * (g.SW / 2 + 1.2); O(dk, bx, g.waY + 1.2, 2.8, 4.2); O(col, bx, g.waY + 0.8, 2.6, 4); R(shade(col, 0.25), bx - 0.4, g.waY - 2.4, 0.8, 6); } }
  function bagFront(g, o) { const p = o.bag; if (!p || g.back) return; const col = colorOf(p), dk = shade(col, -0.3);
    if (p.id === 'backpack') { for (const s of [-1, 1]) { if (g.profile && s * g.sx > 0) continue; R(dk, g.cx + s * (g.SW / 2 - 2.4) + g.sx * 0.6, g.shY, 1.2, 7); } }
    if (p.id === 'sling') { line(dk, g.cx - g.SW / 2 + 1, g.shY + 0.5, g.cx + g.SW / 2 - 1, g.waY - 1, 1.1); R(col, g.cx + g.sx * 2 - 2.5, g.shY + 4.5, 5, 3.2); R(shade(col, 0.25), g.cx + g.sx * 2 - 2.5, g.shY + 4.5, 5, 0.6); R('#c9d1d6', g.cx + g.sx * 2 - 0.4, g.shY + 5.6, 0.8, 0.6); }
    if (p.id === 'duffel') line(dk, g.cx + (g.sx >= 0 ? 1 : -1) * 2, g.shY + 0.5, g.cx - (g.sx >= 0 ? 1 : -1) * (g.SW / 2 + 0.6), g.waY - 2, 0.9); }
  function faceLayer(g, o) {
    const p = o.face; if (!p || g.back) return; const col = colorOf(p), x = g.headX + g.sx * 2.4, y = g.headY - 0.4, w = g.profile ? 3 : 5.6;
    if (p.id === 'shades') { R(col, x - w / 2, y - 0.9, w, 1.8); R('#ffffff44', x - w / 2 + 0.4, y - 0.7, 1, 0.5); R(shade(col, 0.3), x - w / 2, y - 1, w, 0.4); }
    if (p.id === 'aviators') { for (const e of g.profile ? [0] : [-1, 1]) { O(col, x + e * 1.6, y + 0.1, 1.5, 1.4); O('#3a2a1a', x + e * 1.6, y + 0.2, 1.1, 1); O('#ffffff55', x + e * 1.6 - 0.4, y - 0.3, 0.4, 0.3); } R(col, x - 0.6, y - 0.8, 1.2, 0.3); }
    if (p.id === 'glasses') { for (const e of g.profile ? [0] : [-1, 1]) { c.strokeStyle = col; c.lineWidth = 0.55; c.strokeRect(x + e * 1.6 - 1.2, y - 0.9, 2.4, 1.8); } }
    if (p.id === 'bandana') { poly(col, [[x - w / 2 - 0.6, y + 1.4], [x + w / 2 + 0.6, y + 1.4], [x, y + 5.4]]); for (let i = 0; i < 3; i++) O('#f4f1ea', x - 1.5 + i * 1.5, y + 2.4 + (i % 2), 0.3, 0.3); }
  }
  function skimask(g, o) { const p = o.face; if (p?.id !== 'skimask') return false; const col = colorOf(p), x = g.headX, y = g.headY; O(col, x, y - 0.4, 5.1, 5.6); R(shade(col, 0.2), x - 3, y - 5, 2, 1); if (!g.back) { const fx = x + g.sx * 2.4; R(shade(W.SKINS[o.skin], 0), fx - (g.profile ? 1.3 : 3), y - 1.3, g.profile ? 2.6 : 6, 1.8); for (const e of g.profile ? [g.sx > 0 ? 1 : -1] : [-1, 1]) R('#1b1410', fx + (g.profile ? 0.6 * g.sx : e * 1.9) - 0.4, y - 0.8, 0.8, 0.9); O(shade(col, -0.3), fx, y + 2.8, 1.2, 0.5); } return true; }
  function hood(g, o, back) { const p = o.outer; if (p?.id !== 'hoodie') return false; const col = colorOf(p), x = g.headX, y = g.headY;
    if (!p.hood) { if (back) { O(shade(col, -0.2), g.cx - g.sx * 1.4, g.shY + 0.5, g.SW / 2 - 1.5, 2.2); } return false; }
    if (back) { O(shade(col, -0.25), x, y - 0.4, 6.4, 6.6); return false; }
    // hood shell over the head, face opening toward facing
    O(col, x, y - 0.6, 6, 6.4); O(shade(col, 0.15), x - 2 - g.sx, y - 4, 2.4, 1.2);
    if (!g.back) { O(shade(col, -0.45), x + g.sx * 2.4, y + 0.6, (g.profile ? 2.8 : 4.4), 4.8); c.save(); c.beginPath(); c.ellipse(x + g.sx * 2.4, y + 0.6, (g.profile ? 2.6 : 4.1), 4.5, 0, 0, Math.PI * 2); c.clip(); return true; }
    return false;
  }
  function headwear(g, o) {
    const p = o.head; if (!p) return; const col = colorOf(p), dk = shade(col, -0.3), hi = shade(col, 0.2), x = g.headX, y = g.headY;
    if (p.id === 'cap') { c.save(); c.beginPath(); c.ellipse(x, y - 0.6, 5.4, 5.8, 0, 0, Math.PI * 2); c.clip(); R(col, x - 6, y - 7, 12, 5.2); R(hi, x - 3.5 - g.sx, y - 6, 3, 1); R(dk, x - 0.3, y - 6.5, 0.6, 4); c.restore(); O(dk, x, y - 6.1, 0.8, 0.6);
      const dir = p.back ? -1 : 1, bx = x + g.sx * 4.4 * dir, by = y - 1.6 + g.sy * 2.2 * dir; O(shade(col, -0.15), bx, by, g.profile ? 3.6 : 4.6 - g.side, g.profile ? 1.1 : 1.8); O(shade(col, -0.45), bx, by + 0.5, g.profile ? 3.2 : 4.1 - g.side, g.profile ? 0.6 : 1); }
    if (p.id === 'beanie') { c.save(); c.beginPath(); c.ellipse(x, y - 1.2, 5.5, 6, 0, 0, Math.PI * 2); c.clip(); R(col, x - 6, y - 8, 12, 6.2); for (let i = -4; i <= 4; i += 1.4) R(dk, x + i, y - 7, 0.4, 5); R(shade(col, -0.18), x - 6, y - 3, 12, 1.8); c.restore(); }
    if (p.id === 'bucket') { O(dk, x, y - 2.4, 7.4, 3.4); O(col, x, y - 2.8, 7, 3); O(col, x, y - 4.6, 4.6, 3.2); R(hi, x - 3, y - 6.4, 3, 0.8); R(dk, x - 4.4, y - 3.4, 8.8, 0.6); }
    if (p.id === 'durag') { c.save(); c.beginPath(); c.ellipse(x, y - 0.8, 5.3, 5.7, 0, 0, Math.PI * 2); c.clip(); R(col, x - 6, y - 7, 12, 6.5); R('#ffffff55', x - 3 - g.sx, y - 6, 4, 0.8); c.restore(); const tx = x - g.sx * 4; limb(dk, tx, y, tx - g.sx * 1.5, y + 6, 1.4, 1); limb(col, tx + 0.8, y, tx - g.sx * 1.5 + 1, y + 6.5, 1.4, 1); }
    if (p.id === 'fedora') { O(dk, x, y - 2.6, 7.6, 3.4); O(col, x, y - 3, 7.2, 3); O(col, x, y - 5, 4.4, 3); R('#1d2024', x - 4.3, y - 3.9, 8.6, 1); R(hi, x - 2.6, y - 7, 2.6, 0.8); line(dk, x - 1, y - 7.4, x - 0.6, y - 5, 0.5); }
  }

  // ---------------- compose one frame ----------------
  function compose(ctx, o, dir, anim, f, hold = '') {
    c = ctx; const g = geom(o, dir, anim, f, hold), skin = W.SKINS[o.skin];
    // back-side items first
    if (g.back || g.side > 0.3) { hood(g, o, true); bagBack(g, o); } else if (o.bag?.id === 'duffel') bagBack(g, o);
    const arms = g.arms; // [-1, +1]; in profile -1 is the far arm, drawn behind the torso
    if (g.profile) armLayer(g, o, skin, arms[0]);
    bottoms(g, o, skin); shoes(g, o);
    topLayer(g, o, skin); outerLayer(g, o, skin); jewelry(g, o); bagFront(g, o);
    if (g.back && o.bag) bagBack(g, o);
    for (const A of g.profile ? [arms[1]] : arms) armLayer(g, o, skin, A);
    // head stack
    const hoodOn = o.outer?.id === 'hoodie' && o.outer.hood, maskOn = o.face?.id === 'skimask';
    if (!hoodOn && !maskOn) hairBack(g, o);
    head(g, o, skin);
    const masked = skimask(g, o), hoodUp = o.outer?.id === 'hoodie' && o.outer.hood;
    if (hoodUp && g.back) { hood(g, o, false); }
    else if (!masked) { const clipped = hood(g, o, false); if (clipped) { head(g, o, skin); facial(g, o, skin); faceLayer(g, o); c.restore(); } else { facial(g, o, skin); hair(g, o); faceLayer(g, o); headwear(g, o); } }
    else { faceLayer(g, o); if (o.head && o.head.id !== 'durag') headwear(g, o); }
  }
  // 1px ink outline around everything (on the 2× canvas), then a soft top-left rim.
  function outline(cv, passes = 1) { for (let i = 0; i < passes; i++) outline1(cv); }
  function outline1(cv) {
    const x = cv.getContext('2d'), w = cv.width, h = cv.height, img = x.getImageData(0, 0, w, h), d = img.data, out = new Uint8ClampedArray(d);
    const ink = [0x11, 0x15, 0x1c];
    for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) {
      const i = (y * w + xx) * 4; if (d[i + 3] >= 128) { out[i + 3] = 255; continue; }
      if (d[i + 7] >= 128 || d[i - 1] >= 128 || d[i + w * 4 + 3] >= 128 || d[i - w * 4 + 3] >= 128) { out[i] = ink[0]; out[i + 1] = ink[1]; out[i + 2] = ink[2]; out[i + 3] = 240; } else out[i + 3] = 0;
    }
    img.data.set(out); x.putImageData(img, 0, 0);
  }
  const frames = new Map(), MAX_FRAMES = 700;
  function frame(o, dir, anim, f, scale = 2, hold = '') {
    const n = ANIMS[anim] || 1, k = ((f % n) + n) % n, key = W.keyOf(o) + '|' + dir + anim + k + '|' + scale + hold;
    let cv = frames.get(key);
    if (cv) { frames.delete(key); frames.set(key, cv); return cv; }
    cv = document.createElement('canvas'); cv.width = CELL.w * scale; cv.height = CELL.h * scale;
    const x = cv.getContext('2d'); x.scale(scale, scale); x.translate(CELL.ax, CELL.ay); x.lineCap = 'round';
    try { compose(x, o, dir, anim, k, hold); } catch (e) { console.error(e); }
    try { outline(cv, Math.max(1, Math.round(scale / 2.5))); } catch { /* tainted/unsupported */ }
    frames.set(key, cv); if (frames.size > MAX_FRAMES) frames.delete(frames.keys().next().value);
    return cv;
  }
  function draw(ctx, o, x, y, dir, anim, f, scale = 2, hold = '') {
    const cv = frame(o, dir, anim, f, scale, hold); const prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05080f55'; ctx.beginPath(); ctx.ellipse(Math.round(x) + 1.5, Math.round(y) + 14.5, 8.5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(cv, Math.round(x) - CELL.ax, Math.round(y) - CELL.ay, CELL.w, CELL.h); ctx.imageSmoothingEnabled = prev;
  }

  // ---------------- game integration ----------------
  const npc = new Map();
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const NPC_POOL = 24; // bounded variety keeps the frame cache small
  function outfitFor(p, isPlayer, role) {
    if (isPlayer) return root.NightshiftWardrobe?.outfit?.() || W.cleanOutfit(W.DEFAULT);
    const r = role === 'officer' || p?.role === 'officer' ? 'officer' : role === 'security' ? 'security' : null;
    const k = r ? r + (hash(p?.id || p?.name || '') % 6) : 'n' + (hash(p?.id || p?.name || p?.color || 'npc') % NPC_POOL);
    let o = npc.get(k); if (!o) { o = W.npcOutfit(hash(k) + 7, r); npc.set(k, o); } return o;
  }
  function animOf(p, isPlayer) {
    /* eslint-disable no-undef */
    const moving = isPlayer ? (typeof player !== 'undefined' && (player.moving || p.moving)) : p.moving === true;
    const running = isPlayer && moving && (() => { try { return typeof run !== 'undefined' && run; } catch { return false; } })();
    /* eslint-enable no-undef */
    const ticks = Number.isFinite(p.walkTicks) ? Math.max(0, p.walkTicks) : 0;
    if (!moving) return { anim: 'idle', f: Math.floor(performance.now() / 380 + (hash(p.id || '') % 4)) };
    return running ? { anim: 'run', f: Math.floor(ticks / 1.8) } : { anim: 'walk', f: Math.floor(ticks / 2.5) };
  }
  const dirOfAngle = (a) => ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  // where the hands are when holding a gun (world offset from the anchor) — weapon-art puts the gun here
  const holdHand = (dir, hold) => { const gg = geom(W.DEFAULT, dir, 'idle', 0, hold), A = gg.arms.find((a) => a.s === -1) || gg.arms[0]; return { x: A.hx, y: A.hy, back: gg.back }; };
  const dirOf = (p, isPlayer) => {
    /* eslint-disable-next-line no-undef */
    const moving = isPlayer ? (typeof player !== 'undefined' && player.moving) : p.moving === true;
    const a = moving && Number.isFinite(p.moveAngle) ? p.moveAngle : Number.isFinite(p.angle) ? p.angle : Math.atan2(p.dy || 0, p.dx || 0);
    return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  };
  const api = { enabled: true, CELL, ANIMS, frame, draw, compose, geom, outfitFor, dirOfAngle, holdHand, frames: () => frames.size, clear: () => frames.clear() };
  function install() {
    const S = root.NightshiftSprites; if (!S || S.__chars || typeof S.person !== 'function') return !!S?.__chars;
    const person = S.person, personTo = S.personTo;
    const ours = (ctx, p, isPlayer, options = {}) => {
      if (!api.enabled || !p) return false;
      const o = outfitFor(p, isPlayer, options.role), hold = options.hold || '', d = hold && Number.isFinite(p.angle) ? dirOfAngle(p.angle) : dirOf(p, isPlayer), { anim, f } = animOf(p, isPlayer);
      draw(ctx, o, p.x, p.y, d, anim, f, 2, hold);
      if (!isPlayer && !options.hideHealth && Number.isFinite(p.hp) && p.hp < (p.maxHp || 40) && p.hp > 0) { ctx.fillStyle = '#182832'; ctx.fillRect(p.x - 13, p.y - 33, 26, 4); ctx.fillStyle = '#dd9884'; ctx.fillRect(p.x - 13, p.y - 33, 26 * Math.max(0, p.hp / (p.maxHp || 40)), 3); }
      return true;
    };
    S.person = function (p, isPlayer, options = {}) { /* eslint-disable-next-line no-undef */ const ctx = (() => { try { return g; } catch { return null; } })(); if (ctx) { try { if (ours(ctx, p, isPlayer, options)) return; } catch (e) { console.error(e); } } return person.apply(this, arguments); };
    if (typeof personTo === 'function') S.personTo = function (ctx, p, isPlayer, options = {}) { try { if (ctx && ours(ctx, p, isPlayer, options)) return; } catch (e) { console.error(e); } return personTo.apply(this, arguments); };
    S.__chars = true; return true;
  }
  if (!install()) { const t = setInterval(() => { if (install()) clearInterval(t); }, 200); }
  root.NightshiftCharacters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
