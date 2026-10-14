/* Premium pixel-art characters (Claude-owned) — the Option 3 "modern 2.5D pixel" look.
 * Replaces the vector compose of character-art.js with a true pixel renderer at 2x density (88x112 art px per
 * 44x56 world cell), built from the same skeleton (character-art geom: 8 directions, walk/run/sneak/crouch/sit, gun hold)
 * and the same wardrobe items (wardrobe-data.js), so studio, NPCs and gameplay all share one asset definition.
 *
 * How a frame is made:
 *  1. every body part / garment piece becomes a pixel mask (capsules for limbs, polygons, ellipses), in draw order;
 *  2. each mask is lit as a volume: a distance field inside the mask gives an outward normal, light comes from the
 *     top-left, and the result picks one of five hue-shifted tones (deep, shadow, base, light, highlight);
 *  3. garment detail is painted on top of its own part only (seams, zips, pockets, quilting, rib knit, laces, logos,
 *     prints, hair strands, faces), so later layers occlude it correctly;
 *  4. a contact-shadow pass darkens a part where a part in front of it touches it (depth between layers);
 *  5. a coloured outline (the neighbour's own darkest tone) wraps the silhouette instead of flat black.
 * API: NightshiftCharacterPixel.{frame, draw, render, G}. Installs itself as NightshiftCharacters.frame/draw. */
(function (root) {
  'use strict';
  const C0 = () => root.NightshiftCharacters, W0 = () => root.NightshiftWardrobeData;
  const G = 2, CW = 44, CH = 56, AXW = 22, AYW = 36, GW = CW * G, GH = CH * G, AX = AXW * G, AY = AYW * G;

  // ---------------- colour ----------------
  const rgb = (h) => { const n = parseInt(String(h).slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const lum = (h) => { const [r, g, b] = rgb(h); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; };
  const rampCache = new Map();
  // five tones, hue-shifted: shadows lean cool/violet, lights lean warm
  function ramp(base, kind = 'cloth') {
    const k = base + kind; let r = rampCache.get(k); if (r) return r;
    const L = lum(base);
    if (kind === 'skin') r = [mix(mix(base, '#5a1f2a', 0.35), '#000000', 0.35), mix(base, '#8a3f3f', 0.26), base, mix(base, '#fff0d8', 0.22), mix(base, '#fffaf0', 0.42)];
    else if (L < 0.16) r = [mix(base, '#000000', 0.6), mix(base, '#05040c', 0.35), mix(base, '#3a4256', 0.12), mix(base, '#7d8cab', 0.36), mix(base, '#c4d0e4', 0.58)];
    else r = [mix(mix(base, '#231748', 0.4), '#000000', 0.38), mix(mix(base, '#2e2458', 0.25), '#000000', 0.16), base, mix(base, '#fff1c8', 0.26), mix(base, '#fffaf0', 0.52)];
    rampCache.set(k, r); return r;
  }
  const dark = (h, t = 0.35) => mix(h, '#0c0a16', t);

  // ---------------- masks ----------------
  function Mask() { return { a: new Uint8Array(GW * GH), x0: GW, y0: GH, x1: -1, y1: -1 }; }
  function set(m, x, y) { if (x < 0 || y < 0 || x >= GW || y >= GH) return; m.a[y * GW + x] = 1; if (x < m.x0) m.x0 = x; if (y < m.y0) m.y0 = y; if (x > m.x1) m.x1 = x; if (y > m.y1) m.y1 = y; }
  const X = (x) => AX + x * G, Y = (y) => AY + y * G; // world (relative to anchor) → grid
  function ellipse(m, cx, cy, rx, ry) { const gx = X(cx), gy = Y(cy), rX = rx * G, rY = ry * G; for (let y = Math.floor(gy - rY); y <= Math.ceil(gy + rY); y++) for (let x = Math.floor(gx - rX); x <= Math.ceil(gx + rX); x++) if (((x + 0.5 - gx) / rX) ** 2 + ((y + 0.5 - gy) / rY) ** 2 <= 1) set(m, x, y); return m; }
  function poly(m, pts) {
    const P = pts.map(([x, y]) => [X(x), Y(y)]), ys = P.map((p) => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) { const yc = y + 0.5, xs = []; for (let i = 0; i < P.length; i++) { const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length]; if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax)); }
      xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) set(m, x, y); }
    return m;
  }
  // tapered capsule through a chain of points: [[x, y, r], ...] (world units)
  function capsule(m, chain) {
    for (let i = 0; i + 1 < chain.length; i++) {
      const [ax, ay, ar] = chain[i], [bx, by, br] = chain[i + 1], AXg = X(ax), AYg = Y(ay), BXg = X(bx), BYg = Y(by), Ar = ar * G, Br = br * G;
      const minx = Math.floor(Math.min(AXg - Ar, BXg - Br)), maxx = Math.ceil(Math.max(AXg + Ar, BXg + Br)), miny = Math.floor(Math.min(AYg - Ar, BYg - Br)), maxy = Math.ceil(Math.max(AYg + Ar, BYg + Br));
      const dx = BXg - AXg, dy = BYg - AYg, L2 = dx * dx + dy * dy || 1;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) { const px = x + 0.5, py = y + 0.5, t = Math.max(0, Math.min(1, ((px - AXg) * dx + (py - AYg) * dy) / L2)), qx = AXg + dx * t - px, qy = AYg + dy * t - py, r = Ar + (Br - Ar) * t; if (qx * qx + qy * qy <= r * r) set(m, x, y); }
    }
    return m;
  }
  function rect(m, x, y, w, h) { for (let j = Math.round(Y(y)); j < Math.round(Y(y + h)); j++) for (let i = Math.round(X(x)); i < Math.round(X(x + w)); i++) set(m, i, j); return m; }
  function cut(m, other) { for (let i = 0; i < m.a.length; i++) if (other.a[i]) m.a[i] = 0; return m; }
  function clip(m, other) { for (let i = 0; i < m.a.length; i++) if (!other.a[i]) m.a[i] = 0; return m; }
  function below(m, gy) { for (let y = 0; y < Math.min(GH, Math.round(gy)); y++) for (let x = 0; x < GW; x++) m.a[y * GW + x] = 0; return m; }
  function above(m, gy) { for (let y = Math.max(0, Math.round(gy)); y < GH; y++) for (let x = 0; x < GW; x++) m.a[y * GW + x] = 0; return m; }
  const empty = (m) => { for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) if (m.a[y * GW + x]) return false; return true; };

  // ---------------- frame buffer ----------------
  function Frame() { return { col: new Array(GW * GH).fill(null), pid: new Int16Array(GW * GH).fill(-1), z: new Int16Array(GW * GH).fill(-1), n: 0 }; }
  const LX = -0.55, LY = -0.83; // light from the top-left, mostly above
  // Lay a lit part into the frame. opts: kind (cloth|skin|leather|metal|hair|satin|knit), soft (edge radius), flat (no highlight), deco(fn)
  function layer(F, m, base, opts = {}) {
    if (!m || m.x1 < 0 || empty(m)) return null;
    const kind = opts.kind || 'cloth', T = opts.ramp || ramp(base, kind === 'skin' ? 'skin' : 'cloth'), id = F.n++, z = id;
    const x0 = Math.max(0, m.x0 - 1), y0 = Math.max(0, m.y0 - 1), x1 = Math.min(GW - 1, m.x1 + 1), y1 = Math.min(GH - 1, m.y1 + 1), w = x1 - x0 + 1, h = y1 - y0 + 1;
    // chamfer distance to the outside of the mask
    const d = new Float32Array(w * h), inside = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && m.a[y * GW + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = inside(x0 + x, y0 + y) ? 1e4 : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414); }
    const R = opts.soft ?? (kind === 'skin' ? 3.2 : kind === 'hair' ? 3 : 2.6), hiOK = kind === 'leather' || kind === 'metal' || kind === 'satin' || kind === 'skin' || kind === 'hair';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dv = d[y * w + x]; if (!dv) continue;
      const nx = -(at(x + 1, y) - at(x - 1, y)), ny = -(at(x, y + 1) - at(x, y - 1)), nl = Math.hypot(nx, ny) || 1, lam = (nx * LX + ny * LY) / nl;
      const edge = Math.max(0, 1 - (dv - 1) / R), fy = (y0 + y - m.y0) / Math.max(1, m.y1 - m.y0);
      let v = lam * edge * 1.55 - (fy - 0.45) * (opts.grad ?? 0.5);
      if (dv <= 1.01 && lam < -0.2) v -= 0.7; // core shadow on the far edge
      let t = v > 0.95 && hiOK ? 4 : v > 0.42 ? 3 : v < -0.95 ? 0 : v < -0.32 ? 1 : 2;
      if (opts.flat && t === 4) t = 3;
      const gi = (y0 + y) * GW + x0 + x; F.col[gi] = T[t]; F.pid[gi] = id; F.z[gi] = z;
    }
    const L = { id, T, m, put: (gx, gy, c) => { gx = Math.round(gx); gy = Math.round(gy); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return; const i = gy * GW + gx; if (F.pid[i] === id) F.col[i] = c; }, has: (gx, gy) => { gx = Math.round(gx); gy = Math.round(gy); return gx >= 0 && gy >= 0 && gx < GW && gy < GH && F.pid[gy * GW + gx] === id; } };
    if (opts.deco) opts.deco(L);
    return L;
  }
  // helpers for decoration (grid coordinates)
  const P = (L, x, y, c) => L.put(x, y, c);
  const hline = (L, x0, x1, y, c) => { for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x++) L.put(x, y, c); };
  const vline = (L, x, y0, y1, c) => { for (let y = Math.round(Math.min(y0, y1)); y <= Math.round(Math.max(y0, y1)); y++) L.put(x, y, c); };
  const seg = (L, x0, y0, x1, y1, c) => { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) L.put(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); };

  // ---------------- the character ----------------
  const ITEM = (p) => (p ? W0().ITEM[p.id] : null);
  const colOf = (p) => (p ? (ITEM(p).colors[p.color] || ITEM(p).colors[0]) : null);
  const sleeveLen = (o) => { const t = o.top?.id; if (o.outer && o.outer.id !== 'vest') return 1; if (t === 'tank' || t === 'jersey') return 0; if (t === 'tee' || t === 'polo') return 0.45; if (o.top?.rolled) return 0.6; return 1; };

  const partial = (chain, t) => { // first t (0..1) of a chain, by segment length
    const lens = []; let tot = 0; for (let i = 0; i + 1 < chain.length; i++) { const l = Math.hypot(chain[i + 1][0] - chain[i][0], chain[i + 1][1] - chain[i][1]); lens.push(l); tot += l; }
    let want = tot * t; const res = [chain[0]]; for (let i = 0; i < lens.length; i++) { if (want >= lens[i]) { res.push(chain[i + 1]); want -= lens[i]; continue; } const k = want / lens[i], a = chain[i], b = chain[i + 1]; res.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]); break; } return res;
  };
  // v0.70: Option 3 items drawn by this (legacy) renderer as their nearest classic piece (NPCs / Option 3 off)
  function legacy(o) {
    const W = W0(); if (!o || !(o.outer?.id === 'puffer2' || o.shoes?.id === 'courts' || o.wrist)) return o;
    const pick = (id, hex) => { const cs = W.ITEM[id]?.colors || []; let best = 0, bd = 1e9; const [r, g, b] = rgb(hex); cs.forEach((c, i) => { const [r2, g2, b2] = rgb(c), d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
    const n = { ...o };
    if (o.outer?.id === 'puffer2') { const acc = W.ITEM.puffer2.opts.accent[o.outer.color] || '#f27934'; n.outer = { id: 'puffer', color: pick('puffer', acc), open: !!o.outer.open }; }
    if (o.shoes?.id === 'courts') { const acc = W.ITEM.courts.opts.accent[o.shoes.color] || '#d0283a'; n.shoes = { id: 'hitops', color: pick('hitops', acc) }; }
    if (o.wrist && !o.jewelry) n.jewelry = { id: 'watch', color: o.wrist.color === 1 ? 0 : 1 };
    return n;
  }
  function build(o, dir, anim, f, hold) {
    o = legacy(o);
    const C = C0(), W = W0(), g = C.geom(o, dir, anim, f, hold), F = Frame(), skin = W.SKINS[o.skin], hairC = W.HAIR_COLORS[o.hairColor];
    const { sx, sy, side, back, profile, bw, cx } = g, front = !back, facing = sx >= 0 ? 1 : -1;
    const out = o.outer && o.outer.id !== 'vest' ? o.outer : null, vest = o.outer?.id === 'vest' ? o.outer : null, top = o.top, bot = o.bottom;
    const topC = colOf(top), outC = colOf(o.outer), botC = colOf(bot), shoeC = colOf(o.shoes);
    const SW = g.SW * 1.16, hipW = 4.6 * bw * (1 - 0.3 * side), puff = out?.id === 'puffer' ? 1.1 : out ? 0.55 : 0;
    const shY = g.shY, waY = g.waY, hipY = g.hipY, hx0 = g.headX, hy0 = g.headY - 0.4;
    const headRX = 5.9 - side * 0.5, headRY = 6.0;

    // ---- geometry helpers ----
    const legPath = (L, r1, r2) => { const hx = L.hx + cx * 0.5, kx = Number.isFinite(L.kx) ? L.kx : (hx + L.fx) / 2, ky = Number.isFinite(L.ky) ? L.ky : (L.hy + L.fy) / 2; return [[hx, L.hy, r1], [kx, ky, (r1 + r2) / 2 * 0.98], [L.fx, L.fy - 2.2, r2]]; };
    const armPath = (A, r1, r2) => { const ex = (A.x + A.hx) / 2 + A.s * 0.7 * (1 - side) + sx * 0.3, ey = (A.y + A.hy) / 2 + 0.3; return [[A.x, A.y, r1], [ex, ey, (r1 + r2) / 2], [A.hx, A.hy, r2]]; };
    const torsoPts = (topY, botY, widen = 0, hemW = null) => { const w1 = SW / 2 + widen, wb = hemW ?? (hipW + widen * 0.9); return [[cx - w1 + 1.2, topY - 0.2], [cx + w1 - 1.2, topY - 0.2], [cx + w1, topY + 1.6], [cx + w1 - 0.5 * bw, waY - 1], [cx + wb, botY], [cx - wb, botY], [cx - w1 + 0.5 * bw, waY - 1], [cx - w1, topY + 1.6]]; };
    const order = (arr) => arr.slice().sort((a, b) => a.near - b.near);
    const legsSorted = order(g.legs.map((L) => ({ ...L, near: L.s * sx * -1 + sy * 0.01 })));
    const armsFar = profile ? g.arms.filter((A) => A.s * facing < 0) : [], armsNear = profile ? g.arms.filter((A) => A.s * facing >= 0) : g.arms;

    // ---- back pieces: long hair / afro / locs behind, backpack when facing us, hood down behind the neck ----
    hairBack(F, o, g, hairC, hx0, hy0, headRX, headRY);
    if (o.bag && front && o.bag.id === 'backpack') { const m = Mask(); rect(m, cx - SW / 2 + 0.6, shY + 0.5, SW - 1.2, 9); layer(F, m, colOf(o.bag)); }
    if (o.bag?.id === 'duffel') duffel(F, o, g, SW, facing, 0);

    // far arm in profile goes behind everything on the body
    for (const A of armsFar) arm(F, A, o, g, skin, true);

    // ---- legs + shoes ----
    for (const L of legsSorted) leg(F, L, o, g, skin, botC, legPath, L.near < 0 && !back);
    for (const L of legsSorted) shoe(F, L, o, g, shoeC);
    // hips / seat of the trousers
    if (bot.id !== 'skirt') { const m = Mask(); poly(m, [[cx - hipW - 0.2, waY], [cx + hipW + 0.2, waY], [cx + hipW + 0.6, hipY + 2.2], [cx - hipW - 0.6, hipY + 2.2]]); layer(F, m, bot.id === 'shorts' ? botC : botC, { soft: 2, deco: (L) => { if (bot.id === 'jeans' || bot.id === 'chinos' || bot.id === 'cargo') { const yb = Y(waY) + 1; hline(L, X(cx - hipW), X(cx + hipW), yb + 2, L.T[1]); if (front) { vline(L, X(cx + sx * 0.6), yb + 3, yb + 7, L.T[0]); if (bot.id === 'jeans') P(L, X(cx + sx * 0.6) + 1, yb + 3, '#c8a050'); } } } }); }
    else skirt(F, o, g, botC, hipW);

    // ---- torso: shirt, then outerwear ----
    const tucked = top?.tucked && !out;
    neck(F, g, skin, hx0, hy0);
    const shirtBot = tucked ? waY + 0.8 : hipY + 0.5;
    const shirtM = poly(Mask(), torsoPts(shY, shirtBot, 0, tucked ? hipW + 0.3 : hipW + 0.8));
    if (top.id === 'tank' || top.id === 'jersey') { // armholes: skin shoulders show
      const sk = poly(Mask(), torsoPts(shY, shY + 6, 0)); layer(F, sk, skin, { kind: 'skin' });
      cut(shirtM, poly(Mask(), [[cx - SW / 2 - 1, shY - 1], [cx - SW / 2 + (top.id === 'tank' ? 2.6 : 2.1), shY - 1], [cx - SW / 2 + 1.6, shY + 5.5], [cx - SW / 2 - 1, shY + 5.5]]));
      cut(shirtM, poly(Mask(), [[cx + SW / 2 + 1, shY - 1], [cx + SW / 2 - (top.id === 'tank' ? 2.6 : 2.1), shY - 1], [cx + SW / 2 - 1.6, shY + 5.5], [cx + SW / 2 + 1, shY + 5.5]]));
    }
    if (!out || out.open || back) layer(F, shirtM, topC, { deco: (L) => topDeco(L, o, g, top, SW, front) });
    if (tucked && bot.id !== 'skirt') belt(F, g, waY, hipW);
    if (vest) vestPiece(F, o, g, SW, hipW);
    if (out) outer(F, o, g, out, outC, SW, hipW, puff, torsoPts, front);
    if (o.jewelry && front && o.jewelry.id !== 'watch') chain(F, g, colOf(o.jewelry), hx0, hy0);
    if (o.bag?.id === 'sling') sling(F, o, g, SW, facing);
    if (o.bag?.id === 'backpack' && back) backpack(F, o, g, SW);
    if (o.bag?.id === 'backpack' && front && !profile) straps(F, o, g, SW);
    if (o.bag?.id === 'duffel') duffel(F, o, g, SW, facing, 1);

    // ---- near arms ----
    for (const A of armsNear) arm(F, A, o, g, skin, false);

    // ---- head ----
    head(F, o, g, skin, hairC, hx0, hy0, headRX, headRY);
    return F;
  }

  function neck(F, g, skin, hx, hy) { const m = Mask(); rect(m, hx - 1.6, hy + 3.5, 3.2, 4.5); layer(F, m, skin, { kind: 'skin', ramp: ramp(mix(skin, '#6a3030', 0.12), 'skin') }); }

  function leg(F, L, o, g, skin, botC, legPath, far) {
    const b = o.bottom, base = far ? mix(botC, '#141020', 0.12) : botC;
    const chain = legPath(L, 2.6 * g.bw, b.id === 'joggers' ? 1.7 : 2.05);
    if (b.id === 'shorts' || b.id === 'skirt') { // bare shins
      const sk = capsule(Mask(), legPath(L, 1.7, 1.35)); layer(F, sk, skin, { kind: 'skin' });
      if (b.id === 'shorts') { const m = capsule(Mask(), partial(chain, 0.52)); layer(F, m, base, { deco: (Lr) => { const [kx, ky] = [chain[1][0], chain[1][1]]; hline(Lr, X(kx - 2.6), X(kx + 2.6), Y(ky) - 1, Lr.T[3]); for (let i = 0; i < 5; i++) Lr.put(X(L.hx + g.cx * 0.5) + (L.s * (2 + 0.6 * i)), Y(L.hy) + 2 + i * 2, Lr.T[4]); } }); }
      return;
    }
    const m = capsule(Mask(), chain);
    layer(F, m, base, { grad: 0.35, deco: (Lr) => {
      const [hx, hy] = chain[0], [kx, ky] = chain[1], [fx, fy] = chain[2];
      // knee fold + crease toward the ankle
      seg(Lr, X(kx - 1.4), Y(ky) + 1, X(kx + 0.6), Y(ky) + 2, Lr.T[1]); seg(Lr, X(kx - 0.4), Y(ky) - 2, X(kx + 1), Y(ky) - 1, Lr.T[3]);
      if (b.id === 'jeans') { seg(Lr, X(hx + L.s * 1.6), Y(hy) + 3, X(fx + L.s * 1.2), Y(fy) - 6, Lr.T[3]); for (let y = Y(hy) + 4; y < Y(fy) - 6; y += 3) Lr.put(X(hx + L.s * 1.6) + ((y / 3) % 2), y, Lr.T[4]); }
      if (b.id === 'chinos') seg(Lr, X(hx), Y(hy) + 3, X(fx), Y(fy) - 5, Lr.T[3]);
      if (b.id === 'cargo') { const pk = [X(kx - 1.8), Y(ky) - 7]; for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) Lr.put(pk[0] + x, pk[1] + y, y === 0 ? Lr.T[3] : x === 5 || y === 5 ? Lr.T[0] : Lr.T[2]); hline(Lr, pk[0], pk[0] + 5, pk[1] + 1, Lr.T[1]); if (b.pattern === 1) camo(Lr, X(hx - 3), Y(hy), X(fx + 3), Y(fy)); }
      if (b.id === 'joggers') { hline(Lr, X(fx - 2.2), X(fx + 2.2), Y(fy) - 6, Lr.T[0]); for (let x = X(fx - 2); x <= X(fx + 2); x += 2) vline(Lr, x, Y(fy) - 5, Y(fy) - 3, Lr.T[1]); seg(Lr, X(hx + L.s * 2.2), Y(hy) + 2, X(fx + L.s * 1.6), Y(fy) - 7, '#f1efe8'); }
    } });
  }
  function camo(L, x0, y0, x1, y1) { const cs = [L.T[0], L.T[3], mix(L.T[2], '#3a4a2a', 0.5)]; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const n = ((x * 73856093) ^ (Math.floor(y / 2) * 19349663) ^ (Math.floor(x / 3) * 83492791)) >>> 0; if (n % 7 < 2) L.put(x, y, cs[n % 3]); } }

  function shoe(F, L, o, g, shoeC) {
    const s = o.shoes, sx = g.sx, side = g.side, fx = L.fx + sx * 1.1, fy = L.fy, len = 2.7 + side * 1.7, tall = s.id === 'boots' ? 4.4 : s.id === 'hitops' ? 3.6 : s.id === 'slides' ? 1.2 : 2.6;
    if (s.id === 'slides') { const sock = capsule(Mask(), [[L.fx, fy - 3.6, 1.5], [L.fx, fy - 0.8, 1.5]]); layer(F, sock, '#f1efe8'); }
    const m = Mask(); poly(m, [[fx - len - 0.2, fy - tall + 0.8], [fx - len + 0.8, fy - tall], [fx + len - 0.6 - (side > 0.5 ? 1.2 : 0) * (sx > 0 ? 0 : -1), fy - tall], [fx + len + 0.2, fy - 1.6], [fx + len + 0.4, fy + 0.6], [fx - len - 0.4, fy + 0.6]]); ellipse(m, fx + sx * len * 0.6, fy - 0.6, len * (side > 0.5 ? 0.8 : 1), 1.7);
    const soleC = s.id === 'hitops' ? (lum(shoeC) > 0.7 ? '#c98a4a' : '#f1efe8') : s.id === 'runners' ? '#f4f1ea' : s.id === 'boots' ? '#2a1f1a' : s.id === 'dress' ? '#1a1412' : '#2b2f33';
    layer(F, m, shoeC, { kind: s.id === 'dress' ? 'leather' : 'cloth', soft: 2, grad: 0.2, deco: (Lr) => {
      const yb = Y(fy) + 1, xa = X(fx - len - 0.5), xb = X(fx + len + 0.5);
      for (let y = yb - (s.id === 'runners' ? 2 : 1); y <= yb; y++) hline(Lr, xa, xb, y, y === yb ? dark(soleC, 0.4) : soleC); // sole
      if (s.id === 'runners') { for (let x = xa + 1; x < xb; x += 3) Lr.put(x, yb - 2, mix(soleC, '#9aa3ab', 0.4)); }
      if (s.id === 'hitops' || s.id === 'runners') { // laces + swoosh panel
        if (!g.back) for (let i = 0; i < (s.id === 'hitops' ? 4 : 3); i++) hline(Lr, X(fx + sx * 0.6) - 1, X(fx + sx * 0.6) + 1, Y(fy - tall) + 2 + i * 2, '#f4f1ea');
        seg(Lr, X(fx - len * 0.6), Y(fy) - 3, X(fx + len * 0.5), Y(fy) - 4, lum(shoeC) > 0.7 ? '#c84659' : '#f4f1ea');
      }
      if (s.id === 'boots') { for (let i = 0; i < 4; i++) Lr.put(X(fx + sx * 0.5), Y(fy - tall) + 2 + i * 2, '#e8d8b0'); hline(Lr, xa, xb, Y(fy - tall) + 1, Lr.T[3]); }
      if (s.id === 'dress') { Lr.put(X(fx + sx * len * 0.4) - 1, Y(fy) - 3, '#fffaf0'); Lr.put(X(fx + sx * len * 0.4), Y(fy) - 3, Lr.T[4]); }
    } });
  }
  function skirt(F, o, g, c, hipW) { const m = poly(Mask(), [[g.cx - hipW, g.waY], [g.cx + hipW, g.waY], [g.cx + hipW + 2.4, g.hipY + 6.5], [g.cx - hipW - 2.4, g.hipY + 6.5]]); layer(F, m, c, { deco: (L) => { for (let k = -3; k <= 3; k++) seg(L, X(g.cx + k * 0.9), Y(g.waY) + 2, X(g.cx + k * 1.5), Y(g.hipY + 6.5) - 1, k % 2 ? L.T[1] : L.T[3]); } }); }
  function belt(F, g, y, hipW) { const m = rect(Mask(), g.cx - hipW - 0.3, y - 0.2, hipW * 2 + 0.6, 1.2); layer(F, m, '#2a1f1a', { kind: 'leather', soft: 1, deco: (L) => { if (!g.back) { const bx = X(g.cx + g.sx * 0.8); for (let i = -1; i <= 1; i++) { L.put(bx + i, Y(y), '#e3c25a'); L.put(bx + i, Y(y) + 1, '#b08a2a'); } } } }); }

  function topDeco(L, o, g, top, SW, front) {
    const cx = X(g.cx + g.sx * 0.9), ty = Y(g.shY), T = L.T;
    if (!front) { seg(L, X(g.cx - SW / 4), ty + 5, X(g.cx - SW / 4 + 1), ty + 14, T[1]); return; }
    // collar
    if (top.id === 'tee' || top.id === 'longsleeve' || top.id === 'jersey' || top.id === 'tank') { for (let x = -3; x <= 3; x++) L.put(cx + x, ty + 1 + Math.round((9 - x * x) / 5), T[0]); }
    if (top.id === 'tee' || top.id === 'longsleeve') { // small chest print
      const px = cx + 2, py = ty + 8; for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) if ((x + y) % 3 !== 2) L.put(px + x, py + y, lum(T[2]) > 0.6 ? '#2b2f36' : '#f1efe8');
      seg(L, cx - 6, ty + 9, cx - 3, ty + 16, T[1]); seg(L, cx + 5, ty + 14, cx + 7, ty + 18, T[1]); // drape folds
    }
    if (top.id === 'jersey') { const n = String((o.top.color * 7 + 3) % 40 + 1); const dig = { 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 7, 1, 7], 4: [5, 5, 7, 1, 1], 5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7] }; [...n].forEach((ch, j) => dig[ch].forEach((row, y) => { for (let x = 0; x < 3; x++) if (row & (4 >> x)) L.put(cx - (n.length * 2) + j * 4 + x, ty + 8 + y, '#f4f1ea'); })); for (const s of [-1, 1]) vline(L, X(g.cx + s * (SW / 2 - 1.5)), ty + 6, ty + 22, '#f4f1ea'); }
    if (top.id === 'polo') { for (const s of [-1, 1]) seg(L, cx, ty + 1, cx + s * 4, ty + 3, T[4]); vline(L, cx, ty + 2, ty + 7, T[0]); L.put(cx + 1, ty + 4, '#f4f1ea'); L.put(cx + 1, ty + 6, '#f4f1ea'); }
    if (top.id === 'buttonup') { for (const s of [-1, 1]) { seg(L, cx, ty + 2, cx + s * 4, ty, '#fffaf0'); seg(L, cx, ty + 2, cx + s * 3, ty + 3, T[0]); } vline(L, cx, ty + 3, ty + 24, T[1]); for (let y = ty + 5; y < ty + 24; y += 4) L.put(cx + 1, y, '#fffaf0'); }
    if (top.id === 'tank') { for (let y = ty + 4; y < ty + 22; y += 2) hline(L, cx - 5, cx + 5, y, T[1]); }
  }
  function vestPiece(F, o, g, SW, hipW) { const c = colOf(o.outer), m = poly(Mask(), [[g.cx - SW / 2 + 1.3, g.shY + 0.6], [g.cx + SW / 2 - 1.3, g.shY + 0.6], [g.cx + SW / 2 - 0.5, g.waY + 1], [g.cx + hipW + 0.4, g.hipY], [g.cx - hipW - 0.4, g.hipY], [g.cx - SW / 2 + 0.5, g.waY + 1]]);
    layer(F, m, c, { deco: (L) => { if (g.back) return; for (let i = 0; i < 3; i++) { const x = X(g.cx - 3.6 + i * 2.6) , y = Y(g.waY) - 6; for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 4; xx++) L.put(x + xx, y + yy, yy === 0 ? L.T[3] : xx === 3 || yy === 5 ? L.T[0] : L.T[2]); } hline(L, X(g.cx - SW / 2 + 2), X(g.cx + SW / 2 - 2), Y(g.shY) + 4, L.T[0]); } }); }

  function outer(F, o, g, out, c, SW, hipW, puff, torsoPts, front) {
    const id = out.id, open = out.open && front, hem = id === 'trench' ? g.hipY + 9 : id === 'puffer' ? g.waY + 2.6 : id === 'bomber' || id === 'leather' || id === 'denim' || id === 'track' ? g.hipY - 0.2 : g.hipY + 0.8;
    const kind = id === 'leather' ? 'leather' : id === 'puffer' ? 'satin' : 'cloth', T0 = ramp(c);
    const bodyM = poly(Mask(), torsoPts(g.shY - 0.3, hem, puff, (id === 'trench' ? hipW + 2.2 : hipW + 0.9 + puff * 0.6)));
    if (open) { // opening shows the shirt: cut a V/strip down the centre
      const ox = g.cx + g.sx * 0.9, w = id === 'trench' ? 2.6 : 1.9; cut(bodyM, poly(Mask(), [[ox - 1.2, g.shY - 1], [ox + 1.2, g.shY - 1], [ox + w, hem + 1], [ox - w, hem + 1]]));
    }
    if (id === 'puffer') { // baffles: each horizontal band is its own puffy volume
      const y0 = Y(g.shY - 0.3), y1 = Y(hem), n = 4, step = (y1 - y0) / n;
      for (let i = 0; i < n; i++) { const band = clip(above(below(poly(Mask(), torsoPts(g.shY - 0.3, hem, puff, hipW + 1.5)), y0 + i * step), y0 + (i + 1) * step - 0.01), bodyM); layer(F, band, c, { kind, soft: Math.max(1.6, step / 2.2), grad: 0.1 }); }
      // high collar
      const col = ellipse(Mask(), g.headX, g.shY - 0.2, 3.4, 1.8); layer(F, col, c, { kind, soft: 1.5 });
    } else {
      layer(F, bodyM, c, { kind, grad: 0.45, deco: (L) => outerDeco(L, o, g, out, SW, hem, open, front) });
    }
    if (id === 'hoodie' && !out.hood) { const hd = ellipse(Mask(), g.headX - g.sx * 0.6, g.shY - 0.4, 3.8 - g.side, 1.9); if (g.back) ellipse(hd, g.headX, g.shY + 1.4, 3.4, 2.6); layer(F, hd, c, { soft: 1.6 }); }
    if (id === 'trench' && front) { const b = rect(Mask(), g.cx - hipW - 1, g.waY - 0.2, hipW * 2 + 2, 1.1); layer(F, b, c, { soft: 1, ramp: ramp(mix(c, '#000000', 0.12)) }); }
  }
  function outerDeco(L, o, g, out, SW, hem, open, front) {
    const id = out.id, T = L.T, cx = X(g.cx + g.sx * 0.9), ty = Y(g.shY), by = Y(hem);
    // side shading folds near the armpits and hem
    for (const s of [-1, 1]) { seg(L, X(g.cx + s * (SW / 2 - 1.6)), ty + 6, X(g.cx + s * (SW / 2 - 2.2)), ty + 12, T[1]); }
    hline(L, X(g.cx - SW / 2 + 1), X(g.cx + SW / 2 - 1), by - 1, T[1]);
    if (!front) { if (id === 'varsity') { for (let y = 0; y < 5; y++) hline(L, cx - 3, cx + 3, ty + 8 + y, y === 0 || y === 4 ? T[4] : '#efe6cc'); } vline(L, X(g.cx), ty + 4, by - 2, T[1]); return; }
    if (id === 'hoodie') { // kangaroo pocket + drawstrings
      const py = Y(g.waY) - 3; for (let x = -5; x <= 5; x++) { L.put(cx + x, py, T[1]); L.put(cx + x, py + 1, T[3]); } for (let y = 1; y < 6; y++) { L.put(cx - 6 + Math.floor(y / 3), py + y, T[1]); L.put(cx + 6 - Math.floor(y / 3), py + y, T[1]); }
      for (const s of [-2, 2]) { vline(L, cx + s, ty + 1, ty + 6, '#f1efe8'); L.put(cx + s, ty + 7, '#c9c2b2'); }
    }
    if (id === 'leather') { seg(L, cx - 2, ty + 1, cx + 3, by - 2, '#c9d1d6'); seg(L, cx - 1, ty + 1, cx + 4, by - 2, T[0]); for (const s of [-1, 1]) { seg(L, cx + s * 1, ty, cx + s * 6, ty + 5, T[4]); seg(L, cx + s * 2, ty + 1, cx + s * 6, ty + 6, T[0]); } seg(L, cx - 7, ty + 10, cx - 4, ty + 9, '#c9d1d6'); L.put(cx + 5, Y(g.waY), '#c9d1d6'); }
    if (id === 'track' || id === 'bomber' || id === 'denim' || id === 'varsity') { if (!open) { vline(L, cx, ty + 2, by - 1, id === 'denim' ? T[0] : '#b5b4ac'); if (id !== 'denim') for (let y = ty + 3; y < by - 1; y += 2) L.put(cx + 1, y, '#e7e2d6'); } }
    if (id === 'denim') { hline(L, X(g.cx - SW / 2 + 1), X(g.cx + SW / 2 - 1), ty + 6, T[1]); for (const s of [-1, 1]) { const px = cx + s * 5 - 2; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) L.put(px + x, ty + 8 + y, y === 0 ? T[1] : T[2]); L.put(px + 1, ty + 9, '#c8902a'); } for (let y = ty + 4; y < by; y += 4) L.put(cx - 1, y, '#c8902a'); }
    if (id === 'varsity' || id === 'bomber') { for (let x = X(g.cx - SW / 2 + 1); x <= X(g.cx + SW / 2 - 1); x++) { L.put(x, by - 2, ((x % 2) ? T[0] : T[3])); L.put(x, by - 1, id === 'varsity' ? '#efe6cc' : T[1]); } }
    if (id === 'varsity') { const lx = cx - 7, ly = ty + 6; for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) if (!(y > 0 && y < 4 && x > 0 && x < 3) || y === 2) L.put(lx + x, ly + y, '#efe6cc'); }
    if (id === 'track') { for (const s of [-1, 1]) { L.put(cx + s * 3, ty + 1, '#f4f1ea'); } }
    if (id === 'trench') { for (const s of [-1, 1]) { seg(L, cx + s * 1, ty, cx + s * 7, ty + 6, T[3]); seg(L, cx + s * 2, ty + 1, cx + s * 7, ty + 7, T[0]); } for (let y = ty + 9; y < Y(g.waY); y += 4) { L.put(cx - 3, y, '#2a1f1a'); L.put(cx + 3, y, '#2a1f1a'); } }
    if (open) { for (const s of [-1, 1]) seg(L, cx + s * 2, ty + 1, cx + s * 3, by - 1, T[0]); }
  }
  function chain(F, g, c, hx, hy) {
    const m = Mask(); for (let k = -6; k <= 6; k++) { const t = k / 6, x = hx + g.sx * 0.9 + t * 3.2, y = g.shY + 0.6 + (1 - t * t) * 3.4; ellipse(m, x, y, 0.62, 0.62); }
    layer(F, m, c, { kind: 'metal', soft: 1, deco: (L) => { for (let k = -6; k <= 6; k += 2) { const t = k / 6; L.put(X(hx + g.sx * 0.9 + t * 3.2), Y(g.shY + 0.6 + (1 - t * t) * 3.4), '#fffbe0'); } } });
  }
  function sling(F, o, g, SW, facing) { const c = colOf(o.bag), m = capsule(Mask(), [[g.cx - SW / 2 + 1, g.shY + 0.4, 0.55], [g.cx + SW / 2 - 1.2, g.waY + 0.5, 0.55]]); layer(F, m, mix(c, '#000000', 0.2), { soft: 1 }); if (!g.back) { const p = Mask(); rect(p, g.cx + SW / 2 - 4.2, g.waY - 2.4, 4.6, 3.6); layer(F, p, c, { deco: (L) => { hline(L, X(g.cx + SW / 2 - 4), X(g.cx + SW / 2), Y(g.waY - 2.4) + 1, '#c9d1d6'); } }); } }
  function straps(F, o, g, SW) { const c = mix(colOf(o.bag), '#000000', 0.25); for (const s of [-1, 1]) { const m = capsule(Mask(), [[g.cx + s * (SW / 2 - 2.2), g.shY - 0.2, 0.6], [g.cx + s * (SW / 2 - 2.6), g.waY - 1.5, 0.6]]); layer(F, m, c, { soft: 1, deco: (L) => L.put(X(g.cx + s * (SW / 2 - 2.6)), Y(g.waY - 2), '#c9d1d6') }); } }
  function backpack(F, o, g, SW) { const c = colOf(o.bag), m = Mask(); poly(m, [[g.cx - SW / 2 + 0.6, g.shY + 0.8], [g.cx + SW / 2 - 0.6, g.shY + 0.8], [g.cx + SW / 2 - 0.2, g.waY + 2], [g.cx - SW / 2 + 0.2, g.waY + 2]]); ellipse(m, g.cx, g.shY + 1.2, SW / 2 - 0.8, 1.6);
    layer(F, m, c, { deco: (L) => { const cx = X(g.cx), y0 = Y(g.shY) + 4; for (let y = 0; y < 8; y++) for (let x = -5; x <= 5; x++) L.put(cx + x, y0 + 8 + y, y === 0 ? L.T[3] : Math.abs(x) === 5 || y === 7 ? L.T[0] : L.T[2]); hline(L, cx - 4, cx + 4, y0 + 10, '#c9d1d6'); L.put(cx + 4, y0 + 11, '#e8eef3'); seg(L, cx - 7, y0 + 1, cx + 7, y0 + 1, L.T[3]); } }); }
  function duffel(F, o, g, SW, facing, pass) {
    const c = colOf(o.bag), behind = g.back ? 1 : 0; if (pass !== (g.front || g.profile ? 1 : 0) && pass !== behind) return; if (pass === 0 && !g.back) return; if (pass === 1 && g.back) return;
    const bx = g.cx - facing * (SW / 2 + 0.8), m = capsule(Mask(), [[bx - 2.4, g.hipY - 1, 2.2], [bx + 2.4, g.hipY - 1, 2.2]]); layer(F, m, c, { deco: (L) => { hline(L, X(bx - 3), X(bx + 3), Y(g.hipY - 1), '#c9d1d6'); } });
    const s = capsule(Mask(), [[g.cx + facing * (SW / 2 - 1.5), g.shY + 0.3, 0.5], [bx, g.hipY - 2.6, 0.5]]); layer(F, s, mix(c, '#000000', 0.3), { soft: 1 });
  }

  function arm(F, A, o, g, skin, far) {
    const out = o.outer && o.outer.id !== 'vest' ? o.outer : null, sl = sleeveLen(o), dim = (c) => (far ? mix(c, '#141020', 0.15) : c);
    const skC = dim(skin), chain = (r1, r2) => [[A.x, A.y, r1], [(A.x + A.hx) / 2 + A.s * 0.7 * (1 - g.side) + g.sx * 0.3, (A.y + A.hy) / 2 + 0.3, (r1 + r2) / 2], [A.hx, A.hy, r2]];
    const bare = capsule(Mask(), chain(1.75 * g.bw, 1.4)); layer(F, bare, skC, { kind: 'skin', soft: 2.4 });
    if (sl > 0) {
      const puffy = out?.id === 'puffer', r1 = (puffy ? 2.7 : out ? 2.25 : 2.0) * g.bw, r2 = puffy ? 2.2 : out ? 1.85 : 1.65;
      const ch = chain(r1, r2), part = sl >= 1 ? [...ch.slice(0, 2), [ch[2][0] - (ch[2][0] - ch[1][0]) * 0.2, ch[2][1] - (ch[2][1] - ch[1][1]) * 0.2, r2]] : (() => { const t = sl; const a = ch[0], b = ch[1], c = ch[2]; const total = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]); let want = total * t; const L1 = Math.hypot(b[0] - a[0], b[1] - a[1]); if (want <= L1) { const k = want / L1; return [a, [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, r1 * 1.02]]; } want -= L1; const k = want / Math.hypot(c[0] - b[0], c[1] - b[1]); return [a, b, [b[0] + (c[0] - b[0]) * k, b[1] + (c[1] - b[1]) * k, r2]]; })();
      const col = out?.id === 'varsity' ? '#efe6cc' : dim(colOf(out || o.top)), m = capsule(Mask(), part);
      layer(F, m, col, { kind: out?.id === 'leather' ? 'leather' : puffy ? 'satin' : 'cloth', soft: 2, deco: (L) => {
        const e = part[part.length - 1], el = ch[1];
        seg(L, X(el[0]) - 2, Y(el[1]), X(el[0]) + 1, Y(el[1]) + 1, L.T[1]); // elbow crease
        if (sl >= 1) { const cx = X(e[0]), cy = Y(e[1]); for (let k = -2; k <= 2; k++) L.put(cx + k, cy, L.T[out?.id === 'varsity' || out?.id === 'bomber' || out?.id === 'track' || out?.id === 'puffer' ? 0 : 1]); }
        if (out?.id === 'track' || out?.id === 'varsity') seg(L, X(part[0][0]) + A.s * 1, Y(part[0][1]) + 2, X(e[0]) + A.s * 1, Y(e[1]) - 2, out.id === 'track' ? '#f4f1ea' : '#7a2e24');
        if (puffy) { const a0 = part[0], a1 = part[part.length - 1]; for (let t = 0.3; t < 1; t += 0.33) { const x = a0[0] + (a1[0] - a0[0]) * t, y = a0[1] + (a1[1] - a0[1]) * t; seg(L, X(x - 1.8), Y(y), X(x + 1.8), Y(y) + 1, L.T[1]); } }
      } });
    }
    // hand (glove colour if gloved) + watch
    const gl = o.gloves, hc = gl ? dim(colOf(gl)) : skC, hm = ellipse(Mask(), A.hx, A.hy + 0.5, 1.65, 1.6);
    layer(F, hm, hc, { kind: gl?.id === 'gloves' ? 'leather' : 'skin', soft: 1.6, deco: (L) => { if (gl?.id === 'fingerless') { L.put(X(A.hx) - 1, Y(A.hy + 0.5) + 2, skC); L.put(X(A.hx), Y(A.hy + 0.5) + 2, skC); L.put(X(A.hx) + 1, Y(A.hy + 0.5) + 2, skC); } } });
    if ((o.jewelry?.id === 'watch' || o.jewelry?.id === 'chainwatch') && A.s === 1 && !far) { const wm = capsule(Mask(), [[A.hx - (A.hx - A.x) * 0.12, A.hy - (A.hy - A.y) * 0.12 - 0.4, 0.95], [A.hx - (A.hx - A.x) * 0.16, A.hy - (A.hy - A.y) * 0.16, 0.95]]); layer(F, wm, colOf(o.jewelry), { kind: 'metal', soft: 1, deco: (L) => { L.put(X(A.hx - (A.hx - A.x) * 0.14), Y(A.hy - (A.hy - A.y) * 0.14) - 1, '#ffffff'); } }); }
  }

  // ---------------- head, face, hair, hats ----------------
  function hairBack(F, o, g, hc, hx, hy, rx, ry) {
    if (o.face?.id === 'skimask' || (o.outer?.id === 'hoodie' && o.outer.hood)) return;
    const h = o.hair, m = Mask(), side = g.side;
    if (h === 'afro') ellipse(m, hx - g.sx * 0.3, hy - 1.6 + (o.head ? 1.2 : 0), rx + (o.head ? 2 : 3.4), ry + (o.head ? 1 : 2.4));
    else if (h === 'long') { ellipse(m, hx, hy - 0.6, rx + 1.2, ry + 0.8); rect(m, hx - rx - 0.8 + side * 1.2, hy, (rx + 0.8) * 2 - side * 2.4, 8.6); }
    else if (h === 'locs' || h === 'braids') { for (let k = -3; k <= 3; k++) { if (side > 0.85 && k * g.sx > 1) continue; const x = hx + k * (rx / 3.2); capsule(m, [[x, hy - 2, h === 'locs' ? 1 : 0.8], [x + k * 0.2, hy + 8.5 - Math.abs(k) * 0.5, h === 'locs' ? 0.9 : 0.7]]); } }
    else if (h === 'ponytail' && (g.back || g.profile)) { const px = g.back ? hx : hx - g.sx * (rx + 0.4); capsule(m, [[px, hy - 1.5, 1.4], [px - g.sx * 0.6, hy + 6.5, 0.9]]); }
    else return;
    layer(F, m, hc, { kind: 'hair', soft: 2.4, deco: (L) => hairStrands(L, g, hx, hy, h) });
  }
  function hairStrands(L, g, hx, hy, style) {
    const T = L.T; for (let i = L.m.x0; i <= L.m.x1; i += 2) for (let j = L.m.y0; j <= L.m.y1; j++) { if (!L.has(i, j)) continue; const n = ((i * 7919) ^ (j * 104729)) >>> 0; if (n % 9 === 0) L.put(i, j, T[1]); else if (n % 13 === 0 && j < Y(hy)) L.put(i, j, T[3]); }
    if (style === 'braids' || style === 'locs') for (let j = L.m.y0; j <= L.m.y1; j += 3) for (let i = L.m.x0; i <= L.m.x1; i++) if (L.has(i, j) && !L.has(i - 1, j)) L.put(i + 1, j, T[0]);
  }
  function head(F, o, g, skin, hc, hx, hy, rx, ry) {
    const masked = o.face?.id === 'skimask', hoodUp = o.outer?.id === 'hoodie' && o.outer.hood;
    // ears (front/3-4: both, profile: the near one)
    if (!g.back) { const em = Mask(); if (g.profile) ellipse(em, hx - g.sx * 0.6, hy + 0.6, 1.2, 1.6); else { ellipse(em, hx - rx - 0.1 + g.sx * 0.8, hy + 0.6, 1.2, 1.6); ellipse(em, hx + rx + 0.1 + g.sx * 0.8, hy + 0.6, 1.2, 1.6); } layer(F, em, skin, { kind: 'skin', soft: 1.4 }); }
    // skull + jaw
    const m = Mask(); ellipse(m, hx, hy - 0.4, rx, ry - 0.3); poly(m, [[hx - rx + 0.5 + g.sx * 0.4, hy + 0.5], [hx + rx - 0.5 + g.sx * 0.4, hy + 0.5], [hx + rx * 0.62 + g.sx * 1.1, hy + ry - 1.4], [hx + g.sx * 1.3, hy + ry + 0.1], [hx - rx * 0.62 + g.sx * 1.1, hy + ry - 1.4]]);
    layer(F, m, masked ? colOf(o.face) : skin, { kind: masked ? 'cloth' : 'skin', soft: 3.6, grad: 0.3, deco: (L) => { if (masked) skimaskDeco(L, o, g, hx, hy, rx, ry); else if (!g.back) face(L, o, g, skin, hc, hx, hy, rx, ry); } });
    if (!masked && !hoodUp) hairFront(F, o, g, hc, hx, hy, rx, ry);
    if (!masked && o.facial !== 'none' && !g.back) facial(F, o, g, hc, hx, hy, rx, ry);
    if (hoodUp) hood(F, o, g, hx, hy, rx, ry);
    if (o.face && !masked && !g.back) eyewear(F, o, g, hx, hy, rx);
    if (o.head && !hoodUp && !(masked && o.head.id === 'durag')) hat(F, o, g, hx, hy, rx, ry);
  }
  function face(L, o, g, skin, hc, hx, hy, rx, ry) {
    const T = L.T, fx = hx + g.sx * 1.6, eyeY = Y(hy + 0.5), brow = mix(hc, '#000000', 0.25), iris = '#24161a', sclera = '#f2ebe0', lid = mix(T[0], '#000000', 0.2), look = g.sx > 0.2 ? 1 : g.sx < -0.2 ? -1 : 0;
    const eyes = g.profile ? [fx + g.sx * 1.3] : [fx - 2.2 + (g.sx > 0 ? g.sx * 0.5 : 0), fx + 2.2 + (g.sx < 0 ? g.sx * 0.5 : 0)];
    for (const [k, ex] of eyes.entries()) {
      const x = X(ex) - 1; // 4px-wide eye: sclera on the side away from the gaze
      if (g.blink) { for (let d = 0; d < 4; d++) L.put(x + d, eyeY + 1, lid); continue; }
      for (let d = 0; d < 4; d++) L.put(x + d, eyeY - 1, lid); // upper lid + lashes
      const ix = look >= 0 ? x + 1 : x + 1 - 1, sc = look >= 0 ? x : x + 3; L.put(sc, eyeY, sclera); L.put(look >= 0 ? x + 3 : x, eyeY, mix(sclera, T[1], 0.5));
      L.put(ix + (look > 0 ? 1 : 0), eyeY, iris); L.put(ix + 1 + (look > 0 ? 1 : 0) - (look < 0 ? 0 : 0), eyeY, iris); L.put(ix + (look > 0 ? 1 : 0), eyeY + 1, iris); L.put(ix + 1 + (look > 0 ? 1 : 0), eyeY + 1, mix(iris, T[1], 0.4));
      L.put(ix + (look > 0 ? 1 : 0), eyeY, '#e8e2f0'); // catch-light
      L.put(x + 1, eyeY + 2, T[1]); L.put(x + 2, eyeY + 2, T[1]); // under-eye
      const outer = (k === 0) !== (look < 0) ? -1 : 1, by = eyeY - 3; for (let d = 0; d < 4; d++) L.put(x + d, by + (d === (outer < 0 ? 0 : 3) ? 1 : 0), brow); // brow, outer end lower
      if (g.profile) break;
    }
    // nose: lit ridge, shadow on the far side, nostrils
    const nx = X(fx + g.sx * (g.profile ? 2.8 : 0.5)), ny = Y(hy + 2.4);
    L.put(nx, ny - 2, T[3]); L.put(nx, ny - 1, T[3]); L.put(nx + 1, ny - 1, T[1]); L.put(nx + 1, ny, T[1]); L.put(nx - 1, ny + 1, T[0]); L.put(nx + 1, ny + 1, T[0]); L.put(nx, ny + 1, T[1]); L.put(nx, ny, T[4]);
    if (g.profile) { const tip = X(hx + g.sx * (rx + 0.25)); L.put(tip, ny - 1, T[3]); L.put(tip, ny, T[2]); }
    // mouth: upper lip line, lit lower lip, corners
    const my = Y(hy + 4.1), mx = X(fx + (g.profile ? g.sx * 1.9 : 0.1)), lip = mix(T[1], '#9a3a40', 0.35);
    for (let d = g.profile ? 0 : -2; d <= (g.profile ? 1 : 1); d++) L.put(mx + d, my, mix(T[0], '#5a1a20', 0.3));
    L.put(mx - (g.profile ? 0 : 1), my + 1, lip); L.put(mx, my + 1, mix(lip, '#ffffff', 0.15)); L.put(mx, my + 2, T[1]);
    // cheeks + jaw plane
    if (!g.profile) { L.put(X(fx - 3.4), Y(hy + 2.6), mix(T[2], '#d8705e', 0.28)); L.put(X(fx + 3.4), Y(hy + 2.6), mix(T[2], '#d8705e', 0.22)); }
  }
  function facial(F, o, g, hc, hx, hy, rx, ry) {
    const f = o.facial, fx = hx + g.sx * 1.6, m = Mask();
    if (f === 'beard') poly(m, [[hx - rx + 0.6 + g.sx * 0.4, hy + 1.6], [hx + rx - 0.6 + g.sx * 0.4, hy + 1.6], [hx + rx * 0.6 + g.sx * 1.1, hy + ry - 1], [hx + g.sx * 1.3, hy + ry + 0.6], [hx - rx * 0.6 + g.sx * 1.1, hy + ry - 1]]);
    else if (f === 'goatee') ellipse(m, fx, hy + 4.4, 1.4, 1.2);
    else if (f === 'mustache') rect(m, fx - 1.8, hy + 3.1, 3.6, 0.6);
    else if (f === 'stubble') { /* dithered shadow along the jaw and chin */ poly(m, [[hx - rx + 0.9 + g.sx * 0.4, hy + 3.2], [hx + rx - 0.9 + g.sx * 0.4, hy + 3.2], [hx + rx * 0.55 + g.sx * 1.1, hy + ry - 1.2], [hx + g.sx * 1.3, hy + ry + 0.1], [hx - rx * 0.55 + g.sx * 1.1, hy + ry - 1.2]]); }
    if (f === 'beard') cut(m, rect(Mask(), fx - 1.2, hy + 3.4, 2.4, 0.9)); // mouth gap
    if (f === 'stubble') { const L = { put: () => {} }; void L; for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) if (m.a[y * GW + x] && (x + y) % 2 === 0 && F.col[y * GW + x]) F.col[y * GW + x] = mix(F.col[y * GW + x], mix(hc, '#2a1a14', lum(hc) > 0.5 ? 0.6 : 0), 0.3); return; }
    layer(F, m, hc, { kind: 'hair', soft: 1.8, deco: (L) => hairStrands(L, g, hx, hy, 'beard') });
  }
  // Hair is built from clumps: every lobe is its own lit volume, so clumps separate with contact shadows (no noise).
  function lobe(F, hc, x, y, rx, ry, hi = 0) { return layer(F, ellipse(Mask(), x, y, rx, ry), hc, { kind: 'hair', soft: Math.min(rx, ry) * 1.5, grad: 0.15, deco: (L) => { if (hi) { const cx = X(x - rx * 0.35), cy = Y(y - ry * 0.45); L.put(cx, cy, L.T[4]); L.put(cx + 1, cy, L.T[3]); } } }); }
  function arc(n, a0, a1, cxw, cyw, R, Ry) { const out = []; for (let k = 0; k < n; k++) { const a = a0 + (a1 - a0) * (n === 1 ? 0.5 : k / (n - 1)); out.push([cxw + Math.cos(a) * R, cyw + Math.sin(a) * Ry]); } return out; }
  function hairFront(F, o, g, hc, hx, hy, rx, ry) {
    const h = o.hair, sx = g.sx, back = g.back, prof = g.profile, hat = o.head && o.head.id !== 'durag';
    if (h === 'bald') return;
    // shaved textures: tint the scalp itself (stubble dots) — buzz everywhere, fade on the sides only
    const scalp = (yb, amt, every) => { const c = above(ellipse(Mask(), hx, hy - 0.8, rx + 0.4, ry - 0.1), Y(yb)); for (let i = 0; i < c.a.length; i++) if (c.a[i] && F.col[i]) { const x = i % GW, y = (i / GW) | 0; if ((x * 3 + y * 5) % every !== 0) F.col[i] = mix(F.col[i], hc, amt); } };
    if (h === 'buzz') { scalp(hy - (back ? -3 : 1.6), 0.72, 4); return; }
    if (h === 'fade') { scalp(hy - (back ? -3 : 1.4), 0.42, 3); for (const [x, y] of arc(5, Math.PI * 1.15, Math.PI * 1.85, hx + sx * 0.4, hy - 1.2, rx - 1.4, ry - 1.3)) lobe(F, hc, x, y, 1.9, 1.5, 1); return; }
    if (h === 'mohawk') { scalp(hy - (back ? -3 : 1.2), 0.42, 3); const pts = prof ? arc(5, sx > 0 ? Math.PI * 1.25 : Math.PI * 1.75, sx > 0 ? Math.PI * 1.85 : Math.PI * 1.15, hx, hy - 0.8, rx - 0.2, ry - 0.2) : [[hx + sx * 0.4, hy - ry - 0.6], [hx + sx * 0.4, hy - ry + 0.8], [hx + sx * 0.4, hy - ry + 2.2]]; for (const [x, y] of pts) lobe(F, hc, x, y - 0.6, 1.2, 1.6, 1); return; }
    const cap = (n, R, rr, row = 0) => arc(n, Math.PI * 1.05, Math.PI * 1.95, hx + sx * 0.3, hy - 1.1 - row, R, (ry - 0.9) * (1 - row * 0.12)).forEach(([x, y], k) => lobe(F, hc, x, y, rr * (0.9 + (k % 2) * 0.2), rr * 0.82, 1));
    if ((h === 'curly' || h === 'afro') && !hat) {
      const big = h === 'afro'; if (back) { lobe(F, hc, hx, hy - 0.4, rx + (big ? 1 : 0), ry, 0); for (let r = 0; r < 3; r++) for (const [x, y] of arc(big ? 7 : 6, Math.PI * 0.9, Math.PI * 2.1, hx, hy + 0.5 - r * 2, rx + (big ? 1.4 : 0) - r, ry - r)) lobe(F, hc, x, y, big ? 2.1 : 1.6, big ? 1.9 : 1.4, 1); return; }
      cap(big ? 8 : 7, rx + (big ? 1.6 : 0.2), big ? 2.3 : 1.7); cap(big ? 6 : 5, rx - (big ? 0 : 1.2), big ? 2 : 1.5, 1.2); return;
    }
    // under a hat only the temples / nape show
    if (hat && h !== 'curly' && h !== 'afro' && !back) { for (const s2 of [-1, 1]) { if (prof && s2 * sx > 0) continue; lobe(F, hc, hx + s2 * (rx - 0.5) + sx * 0.6, hy - 0.6, 1.1, 1.5, 0); } }
    else if (hat && !back) { /* big hair squashed under the hat brim */ for (const s2 of [-1, 1]) lobe(F, hc, hx + s2 * (rx + 0.2), hy - 0.4, 1.8, 2, 1); }
    // everything else starts with a clumped cap; back views cover the nape
    else if (back) { lobe(F, hc, hx, hy - 0.2, rx - 0.1, ry - 0.3, 0); for (let r = 0; r < 3; r++) for (const [x, y] of arc(5, Math.PI * 0.95, Math.PI * 2.05, hx, hy + 1.6 - r * 2.2, rx - 0.2 - r * 0.6, ry - 0.6 - r * 0.8)) lobe(F, hc, x, y, 2.2, 1.7, r === 2 ? 1 : 0); }
    else {
      cap(6, rx - 0.3, 2.1); cap(4, rx - 1.6, 1.8, 1.4);
      if (h === 'ponytail' && !prof) { lobe(F, hc, hx + (sx >= 0 ? -1 : 1) * (rx - 0.2), hy + 3.2, 1, 1.7, 1); { const tie = ellipse(Mask(), hx + (sx >= 0 ? -1 : 1) * (rx - 0.2), hy + 1.6, 0.9, 0.5); layer(F, tie, '#c84659', { soft: 1 }); } }
      else if (!prof && h !== 'bun') { // fringe swept toward the facing side
        for (let k = 0; k < 3; k++) lobe(F, hc, hx - rx * 0.45 + k * rx * 0.42 + sx * 0.8, hy - 2.6 + (k === 1 ? 0.3 : 0), 1.7, 1.2, 1);
      } else if (prof) lobe(F, hc, hx + sx * (rx - 1.2), hy - 2.4, 1.6, 1.3, 1);
    }
    if (h === 'bun' && !hat) lobe(F, hc, hx - sx * 1.2, hy - ry - 1.4, 2.3, 2, 1);
    if (h === 'long' && !back) for (const s2 of [-1, 1]) { if (prof && s2 * sx > 0) continue; const x = hx + s2 * (rx - 0.2) + sx * 0.5; layer(F, capsule(Mask(), [[x, hy - 2, 1.5], [x + s2 * 0.4, hy + 3, 1.6], [x + s2 * 0.2, hy + 7.4, 1.3]]), hc, { kind: 'hair', soft: 2, deco: (L) => { for (let y = L.m.y0 + 2; y <= L.m.y1; y += 3) L.put(X(x) + s2, y, L.T[1]); } }); }
    if ((h === 'locs' || h === 'braids') && !back) for (const s2 of [-1, 1]) { if (prof && s2 * sx > 0) continue; for (let k = 0; k < 2; k++) { const x = hx + s2 * (rx - 0.6 + k * 1.1) + sx * 0.5; layer(F, capsule(Mask(), [[x, hy - 1.5, h === 'locs' ? 0.95 : 0.75], [x + s2 * 0.3, hy + 7 - k, h === 'locs' ? 0.85 : 0.7]]), hc, { kind: 'hair', soft: 1.4, deco: (L) => { for (let y = L.m.y0; y <= L.m.y1; y += (h === 'braids' ? 2 : 3)) { L.put(X(x) - 1, y, L.T[0]); L.put(X(x), y, L.T[1]); } } }); } }
    if (h === 'ponytail' && !back && prof) lobe(F, hc, hx - sx * (rx + 0.6), hy - 1.6, 1.6, 1.6, 1);
  }
  function skimaskDeco(L, o, g, hx, hy, rx, ry) {
    const T = L.T; for (let x = L.m.x0; x <= L.m.x1; x += 2) for (let y = L.m.y0; y <= L.m.y1; y++) if ((y + x) % 4 === 0) L.put(x, y, T[1]);
    if (g.back) return; const fx = hx + g.sx * 1.6, ey = Y(hy + 0.6);
    for (let x = X(fx - 3.2); x <= X(fx + 3.2); x++) { L.put(x, ey - 1, '#d7a477'); L.put(x, ey, '#d7a477'); L.put(x, ey + 1, '#b07a50'); }
    for (const ex of [fx - 1.8, fx + 1.8]) { L.put(X(ex), ey, '#1c1418'); L.put(X(ex), ey + 1, '#1c1418'); }
    for (let x = X(fx - 1); x <= X(fx + 1); x++) { L.put(x, Y(hy + 3.8), '#b07a50'); L.put(x, Y(hy + 3.8) + 1, '#3a2020'); }
  }
  function hood(F, o, g, hx, hy, rx, ry) {
    const c = colOf(o.outer), m = ellipse(Mask(), hx - g.sx * 0.4, hy - 0.6, rx + 1.6, ry + 1.2); poly(m, [[hx - rx - 1.6, hy + 2], [hx + rx + 1.6, hy + 2], [hx + rx + 2.4, g.shY + 1.6], [hx - rx - 2.4, g.shY + 1.6]]);
    if (!g.back) cut(m, ellipse(Mask(), hx + g.sx * 1.6, hy + 0.9, rx - 1.4 - g.side * 0.8, ry - 1.4));
    layer(F, m, c, { soft: 2.6, deco: (L) => { if (!g.back) { const T = L.T; for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; L.put(X(hx + g.sx * 1.6 + Math.cos(t) * (rx - 1.1 - g.side * 0.8)), Y(hy + 0.9 + Math.sin(t) * (ry - 1.1)), T[0]); } for (const s of [-1.2, 1.2]) { vline(L, X(hx + g.sx * 1.6 + s), Y(hy + ry - 0.6), Y(hy + ry + 2.6), '#f1efe8'); } } } });
  }
  function eyewear(F, o, g, hx, hy, rx) {
    const f = o.face, c = colOf(f), fx = hx + g.sx * 1.6, ey = hy + 0.6;
    if (f.id === 'bandana') { const m = poly(Mask(), [[hx - rx + 0.3 + g.sx * 0.4, hy + 1.9], [hx + rx - 0.3 + g.sx * 0.4, hy + 1.9], [hx + rx * 0.5 + g.sx * 1.2, hy + 4.6], [hx + g.sx * 1.3, hy + 6.6], [hx - rx * 0.5 + g.sx * 1.2, hy + 4.6]]); layer(F, m, c, { deco: (L) => { for (let i = L.m.x0; i <= L.m.x1; i += 3) for (let j = L.m.y0; j <= L.m.y1; j += 3) L.put(i + ((j / 3) % 2), j, '#f1efe8'); } }); return; }
    if (f.id === 'skimask') return;
    const m = Mask(); const lens = f.id === 'aviators' ? 1.35 : 1.15;
    if (g.profile) ellipse(m, fx + g.sx * 1.2, ey + 0.2, lens, lens * 0.85); else { ellipse(m, fx - 2.1, ey + 0.2, lens + 0.2, lens * 0.85); ellipse(m, fx + 2.1, ey + 0.2, lens + 0.2, lens * 0.85); if (f.id === 'shades') rect(m, fx - 3.2, ey - 0.5, 6.4, 1.2); }
    const lensC = f.id === 'glasses' ? '#9fc3d6' : f.id === 'aviators' ? '#3a4a3a' : '#121418';
    layer(F, m, lensC, { kind: 'metal', soft: 1.2, deco: (L) => { const T = L.T; for (let i = L.m.x0; i <= L.m.x1; i++) for (let j = L.m.y0; j <= L.m.y1; j++) if (L.has(i, j) && (!L.has(i, j - 1) || !L.has(i - 1, j) || !L.has(i + 1, j) || !L.has(i, j + 1))) L.put(i, j, f.id === 'glasses' ? c : f.id === 'aviators' ? c : mix(c, '#000000', 0.2)); L.put(L.m.x0 + 2, L.m.y0 + 1, '#ffffff'); L.put(L.m.x0 + 3, L.m.y0 + 1, T[4]); if (!g.profile) hline(L, X(fx) - 1, X(fx) + 1, Y(ey), c); } });
  }
  function hat(F, o, g, hx, hy, rx, ry) {
    const h = o.head, c = colOf(h), sx = g.sx, sy = g.sy, top = hy - ry;
    if (h.id === 'cap') {
      const crown = above(ellipse(Mask(), hx, hy - 1.2, rx + 0.7, ry), Y(hy - 0.8)); layer(F, crown, c, { soft: 2.6, deco: (L) => { L.put(X(hx), Y(top) + 1, L.T[0]); seg(L, X(hx - rx * 0.4), Y(top) + 2, X(hx - rx * 0.7), Y(hy - 1.2), L.T[1]); seg(L, X(hx + rx * 0.4), Y(top) + 2, X(hx + rx * 0.7), Y(hy - 1.2), L.T[1]); if (!h.back && !g.back) { for (let k = -2; k <= 2; k++) L.put(X(hx + sx * 1.6) + k, Y(hy - 2.4), L.T[3]); } } });
      const fwd = h.back ? -1 : 1, bx = hx + sx * fwd * (rx * 0.9), by = hy - 1 + sy * fwd * 1.6, m = Mask();
      if (g.profile) poly(m, [[hx, hy - 1.6], [bx + sx * fwd * 3.4, hy - 1.2], [bx + sx * fwd * 3.2, hy - 0.2], [hx, hy - 0.4]]); else ellipse(m, bx, by, rx * (0.9 - g.side * 0.2), 1.4 + (fwd * sy > 0 ? 0.6 : 0));
      if (fwd * sy < -0.25 && !g.profile) return; // brim hidden behind the head
      layer(F, m, mix(c, '#000000', 0.1), { soft: 1.6, deco: (L) => { for (let i = L.m.x0; i <= L.m.x1; i++) { let lo = -1; for (let j = L.m.y0; j <= L.m.y1; j++) if (L.has(i, j)) lo = j; if (lo >= 0) L.put(i, lo, L.T[0]); } } });
    } else if (h.id === 'beanie') {
      const m = above(ellipse(Mask(), hx, hy - 0.6, rx + 0.8, ry + 0.4), Y(hy - 0.2)); ellipse(m, hx, top - 0.4, rx * 0.75, 1.6);
      layer(F, m, c, { kind: 'cloth', soft: 2.8, deco: (L) => { for (let i = L.m.x0; i <= L.m.x1; i += 2) for (let j = L.m.y0; j <= L.m.y1; j++) L.put(i, j, j > Y(hy - 2.4) ? L.T[1] : L.T[(j % 3) ? 2 : 1]); for (let i = L.m.x0; i <= L.m.x1; i++) L.put(i, Y(hy - 2.6), L.T[3]); } });
    } else if (h.id === 'bucket' || h.id === 'fedora') {
      const brim = ellipse(Mask(), hx, hy - 1.4, rx + 3.2, h.id === 'bucket' ? 2.6 : 2.2); layer(F, brim, mix(c, '#000000', 0.12), { soft: 1.8 });
      const crown = Mask(); poly(crown, [[hx - rx + 0.6, hy - 1.6], [hx - rx + 1.2, top - (h.id === 'fedora' ? 1.6 : 0.8)], [hx + rx - 1.2, top - (h.id === 'fedora' ? 1.6 : 0.8)], [hx + rx - 0.6, hy - 1.6]]);
      layer(F, crown, c, { soft: 2.4, deco: (L) => { if (h.id === 'fedora') { for (let i = L.m.x0; i <= L.m.x1; i++) { L.put(i, Y(hy - 2.6), '#2a1f1a'); L.put(i, Y(hy - 2.6) - 1, '#1a1412'); } L.put(X(hx), Y(top) - 2, L.T[0]); L.put(X(hx), Y(top) - 1, L.T[1]); } else for (let i = L.m.x0; i <= L.m.x1; i += 2) L.put(i, Y(hy - 2.2), L.T[1]); } });
    } else if (h.id === 'durag') {
      const m = above(ellipse(Mask(), hx, hy - 0.8, rx + 0.5, ry + 0.2), Y(hy + 0.2)); if (g.back || g.profile) capsule(m, [[hx - sx * rx, hy - 0.6, 1], [hx - sx * (rx + 1.4), hy + 6, 0.9]]);
      layer(F, m, c, { kind: 'satin', soft: 2.6, deco: (L) => { seg(L, X(hx - rx * 0.5), Y(top) + 2, X(hx + rx * 0.3), Y(top) + 3, '#ffffff'); hline(L, X(hx - rx), X(hx + rx), Y(hy - 0.2), L.T[0]); } });
    }
  }

  // ---------------- finishing: contact shadows + coloured outline ----------------
  function finish(F) {
    const col = F.col.slice(), z = F.z, pid = F.pid;
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
      const i = y * GW + x; if (!F.col[i]) continue;
      // a part in front touching from above/left casts a 1px contact shadow
      const up = i - GW, lf = i - 1, dn = i + GW, rt = i + 1;
      if ((pid[up] >= 0 && pid[up] !== pid[i] && z[up] > z[i]) || (pid[lf] >= 0 && pid[lf] !== pid[i] && z[lf] > z[i]) || (pid[rt] >= 0 && pid[rt] !== pid[i] && z[rt] > z[i] && pid[dn] !== pid[i])) col[i] = mix(F.col[i], '#120c22', 0.38);
    }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x; if (F.col[i]) continue; let nb = null;
      if (x > 0 && F.col[i - 1]) nb = F.col[i - 1]; else if (x < GW - 1 && F.col[i + 1]) nb = F.col[i + 1]; else if (y > 0 && F.col[i - GW]) nb = F.col[i - GW]; else if (y < GH - 1 && F.col[i + GW]) nb = F.col[i + GW];
      if (nb) col[i] = mix(nb, '#0b0814', 0.78);
    }
    return col;
  }

  // ---------------- canvas + cache ----------------
  // v0.62: EPX/Scale2x upscaling — the art is authored on the G grid (where faces, seams and logos are tuned), then
  // doubled with edge-aware rules so silhouettes and diagonals come out smooth and fine instead of stair-stepped.
  const UP = 2;
  function epx(col, w, h) {
    const W2 = w * 2, out = new Array(W2 * h * 2).fill(null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, P = col[i], A = y > 0 ? col[i - w] : null, B = x < w - 1 ? col[i + 1] : null, C = x > 0 ? col[i - 1] : null, D = y < h - 1 ? col[i + w] : null;
      let p1 = P, p2 = P, p3 = P, p4 = P;
      if (C === A && C !== D && A !== B) p1 = A; if (A === B && A !== C && B !== D) p2 = B; if (D === C && D !== B && C !== A) p3 = C; if (B === D && B !== A && D !== C) p4 = D;
      const o = (y * 2) * W2 + x * 2; out[o] = p1; out[o + 1] = p2; out[o + W2] = p3; out[o + W2 + 1] = p4;
    }
    return [out, W2, h * 2];
  }
  const frames = new Map(), MAX = 420, BUDGET = 6, budget = { t: 0, n: 0 }; let stats = { built: 0, ms: 0 };
  function render(o, dir, anim, f, hold) { const t0 = (typeof performance !== 'undefined' ? performance.now() : 0); const F = build(o, dir, anim, f, hold), col = finish(F); stats.built++; stats.ms += (typeof performance !== 'undefined' ? performance.now() : 0) - t0; return col; }
  function base(o, dir, anim, f, hold) {
    const C = C0(), W = W0(), n = C.ANIMS[anim] || 1, k = ((f % n) + n) % n, key = W.keyOf(o) + '|' + dir + anim + k + '|' + (hold || '');
    let cv = frames.get(key); if (cv) { frames.delete(key); frames.set(key, cv); return cv; }
    const now = (typeof performance !== 'undefined' ? performance.now() : 0); if (now - budget.t > 12) { budget.t = now; budget.n = 0; }
    if (++budget.n > BUDGET) { for (let d = 1; d < n; d++) { const alt = frames.get(W.keyOf(o) + '|' + dir + anim + ((k + n - d) % n) + '|' + (hold || '')); if (alt) { stats.deferred = (stats.deferred || 0) + 1; return alt; } }
      if (budget.n > BUDGET * 2) { const pre = W.keyOf(o) + '|' + dir; for (const [kk, v] of frames) if (kk.startsWith(pre)) { stats.deferred = (stats.deferred || 0) + 1; return v; } } }
    const col0 = render(o, dir, anim, k, hold), [col, OW, OH] = UP > 1 ? epx(col0, GW, GH) : [col0, GW, GH]; cv = document.createElement('canvas'); cv.width = OW; cv.height = OH;
    const x = cv.getContext('2d'), img = x.createImageData(OW, OH); for (let i = 0; i < col.length; i++) { const c = col[i]; if (!c) continue; const [r, gg, b] = rgb(c); img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0); frames.set(key, cv); if (frames.size > MAX) frames.delete(frames.keys().next().value); return cv;
  }
  const scaled = new Map();
  // Same contract as character-art frame(): a canvas of CELL*scale, anchor at CELL.ax/ay*scale.
  function frame(o, dir, anim, f, scale = 2, hold = '') {
    const O3 = root.NightshiftO3; if (O3 && O3.wants(o)) { const cv = O3.frame(o, dir, anim, f, scale, hold); if (cv) return cv; } // v0.70 Option 3 art
    const b = base(o, dir, anim, f, hold); if (b.width === CW * scale) return b;
    const key = b.__k || (b.__k = Math.random().toString(36).slice(2)), sk = key + '@' + scale; let cv = scaled.get(sk); if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = CW * scale; cv.height = CH * scale; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(b, 0, 0, cv.width, cv.height);
    scaled.set(sk, cv); if (scaled.size > 160) scaled.delete(scaled.keys().next().value); return cv;
  }
  let drawingPlayer = false;
  function draw(ctx, o, x, y, dir, anim, f, scale = 2, hold = '') {
    const O3 = root.NightshiftO3; if (O3 && O3.wants(o) && O3.draw(ctx, o, x, y, dir, anim, f, hold, drawingPlayer)) return; // v0.70 Option 3 art
    const cv = frame(o, dir, anim, f, G, hold), prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05080f55'; ctx.beginPath(); ctx.ellipse(Math.round(x) + 1, Math.round(y) + 14.2, 8.5, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(cv, Math.round(x) - AXW, Math.round(y) - AYW, CW, CH); ctx.imageSmoothingEnabled = prev;
  }

  // ---------------- install ----------------
  // Person drawing (same rules as character-art: stance, seats, smooth turning, gun hold) using this renderer.
  function personTo(ctx, p, isPlayer, opts = {}) {
    const C = C0(); if (!C?.enabled || !p) return false;
    const o = C.outfitFor(p, isPlayer, opts.role), st = C.stance ? C.stance(p, isPlayer) : '', mv = isPlayer ? (() => { try { return player.moving || p.moving; } catch { return p.moving; } })() : p.moving === true; // eslint-disable-line no-undef
    let sprint = false; try { sprint = isPlayer && typeof run !== 'undefined' && run; } catch { /* n/a */ } // eslint-disable-line no-undef
    const a = st === 'sit' ? 'sit' : st === 'crouch' ? 'crouch' : st === 'sneak' ? (mv ? 'sneak' : 'crouch') : mv ? (sprint ? 'run' : 'walk') : 'idle';
    const ticks = Number.isFinite(p.walkTicks) ? Math.max(0, p.walkTicks) : 0, fr = mv ? Math.floor(ticks / ((C.RATE || {})[a] || 2.5)) : Math.floor(performance.now() / (a === 'idle' ? ((C.RATE || {}).idle || 380) : 420));
    const hold = opts.hold || '', ang = hold ? p.angle : (mv && Number.isFinite(p.moveAngle) ? p.moveAngle : Number.isFinite(p.angle) ? p.angle : 0), d0 = C.dirOfAngle(ang);
    const seat = a === 'sit' && p.seat ? p.seat : null, d = seat ? 2 : hold ? d0 : (C.smoothDir ? C.smoothDir(p, d0) : d0);
    drawingPlayer = !!isPlayer; draw(ctx, o, seat ? seat.x : p.x, seat ? seat.y : p.y, d, a, fr, 2, hold); drawingPlayer = false;
    if (!isPlayer && !opts.hideHealth && Number.isFinite(p.hp) && p.hp > 0 && p.hp < (p.maxHp || 40)) { ctx.fillStyle = '#182832'; ctx.fillRect(p.x - 13, p.y - 33, 26, 4); ctx.fillStyle = '#dd9884'; ctx.fillRect(p.x - 13, p.y - 33, 26 * p.hp / (p.maxHp || 40), 3); }
    return true;
  }
  function install() {
    const C = C0(), S = root.NightshiftSprites; if (!C || !W0() || typeof document === 'undefined') return false;
    if (C.__pixel) return true;
    C.frame = frame; C.draw = draw; C.clear = () => { frames.clear(); scaled.clear(); }; C.frames = () => frames.size; C.pixel = true;
    if (S && typeof S.person === 'function') {
      const prev = S.person, prevTo = S.personTo;
      S.person = function (p, isPlayer, opts = {}) { /* eslint-disable-next-line no-undef */ let ctx = null; try { ctx = g; } catch { /* no game */ } try { if (ctx && personTo(ctx, p, isPlayer, opts)) return; } catch (e) { console.error(e); } return prev.apply(this, arguments); };
      S.personTo = function (ctx, p, isPlayer, opts = {}) { try { if (ctx && personTo(ctx, p, isPlayer, opts)) return; } catch (e) { console.error(e); } return prevTo?.apply(this, arguments); };
    }
    C.__pixel = true; return true;
  }
  if (typeof document !== 'undefined' && !install()) { const t = setInterval(() => { if (install()) clearInterval(t); }, 100); setTimeout(() => clearInterval(t), 15000); }

  const api = Object.freeze({ frame, draw, render, build, G, GW, GH, AX, AY, stats: () => ({ ...stats, cached: frames.size }), clear: () => { frames.clear(); scaled.clear(); } });
  if (typeof module === 'object' && module.exports) module.exports = api; else root.NightshiftCharacterPixel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
