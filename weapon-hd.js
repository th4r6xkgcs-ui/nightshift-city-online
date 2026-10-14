/* HD weapons (Claude-owned). Re-renders every weapon-art gun at 4x density as smooth, shaded vector art.
 * The gun builders in weapon-art.js are replayed through a recording buffer with the same API (R, P, C, L, T, get),
 * so every gun, paint job, camo and attachment gets the HD look and the anchors (hand, muzzle, rail…) don't move.
 * Each part gets: an inner bevel (lit top-left rim, shaded bottom-right rim), a gradient body, material texture
 * (brushed steel, polymer stipple, wood grain, chrome/gold sheen, rubber), specular streaks, camo, and the whole gun
 * gets a soft ink outline and a gloss pass.
 * Contract (same as the native-scale pistols): sprite.nativeScale = N; box and anchors are in canvas px.
 * API: NightshiftWeaponHD.{N, sprite(ctx)} — called by weapon-art.js sprite(). */
(function (root) {
  'use strict';
  const N = 4;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const noise = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const FAMILY = { steel: 'metal', dark: 'metal', chrome: 'chrome', gold: 'gold', poly: 'poly', rubber: 'rubber', wood: 'wood', tan: 'poly', olive: 'poly', red: 'paint', rust: 'rust', tape: 'tape' };

  /** ctx: { id, skin, mods, GUNS, attach, Buf, MAT, INK, GW, GH, OUTLINE } -> sprite or null */
  function sprite(K) {
    const { id, skin, mods, GUNS, attach, Buf, INK, GW, GH } = K; if (typeof document === 'undefined' || !GUNS[id]) return null;
    // 1) record ops while a pixel buffer runs underneath (get() and tones stay exact)
    const pb = Buf(skin), ops = [], rb = Object.create(pb);
    const famOf = (mat) => (Array.isArray(mat) ? 'metal' : FAMILY[mat] || 'metal');
    const skinned = (mat) => !!skin && !Array.isArray(mat) && (mat === 'steel' || mat === 'poly' || mat === 'rust');
    rb.R = (mat, x, y, w, h, o = {}) => { ops.push({ k: 'R', T: pb.T(mat, 0) && [0, 1, 2, 3].map((i) => pb.T(mat, i)), fam: famOf(mat), camo: skinned(mat) && skin?.camo && !o.noCamo, x, y, w, h, o }); pb.R(mat, x, y, w, h, o); };
    rb.P = (mat, pts, o = {}) => { ops.push({ k: 'P', T: [0, 1, 2, 3].map((i) => pb.T(mat, i)), fam: famOf(mat), camo: skinned(mat) && skin?.camo && !o.noCamo, pts, o }); pb.P(mat, pts, o); };
    rb.C = (mat, x, y, w, h) => { ops.push({ k: 'C', T: [0, 1, 2, 3].map((i) => pb.T(mat, i)), fam: famOf(mat), x, y, w, h }); pb.C(mat, x, y, w, h); };
    rb.L = (c, x, y, w = 1, h = 1) => { ops.push({ k: 'L', c, x, y, w, h }); pb.L(c, x, y, w, h); };
    rb.T = (mat, k) => pb.T(mat, k); rb.get = (x, y) => pb.get(x, y); rb.put = (x, y, c) => { ops.push({ k: 'L', c, x, y, w: 1, h: 1 }); pb.put(x, y, c); };
    const a = GUNS[id](rb, K.parts || null); attach(rb, id, [...new Set(mods)], a);
    // pixel box (before outline) → HD box with room for the outline
    let x0 = GW, y0 = GH, x1 = -1, y1 = -1; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (pb.px[y * GW + x]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    if (x1 < 0) return null;

    // 2) paint ops at N×
    const cv = document.createElement('canvas'); cv.width = GW * N; cv.height = GH * N; const c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round';
    const r = (v) => v * N;
    const pathRect = (x, y, w, h, rad) => { const R = Math.min(rad, w / 2, h / 2); c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, R); else c.rect(x, y, w, h); };
    const pathPoly = (pts, dx = 0, dy = 0) => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(r(px) + dx, r(py) + dy) : c.moveTo(r(px) + dx, r(py) + dy))); c.closePath(); };
    function bboxOf(op) { if (op.k === 'P') { const xs = op.pts.map((p) => p[0]), ys = op.pts.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; } return [op.x, op.y, op.w, op.h]; }
    function shape(op, dx = 0, dy = 0) { if (op.k === 'P') pathPoly(op.pts, dx, dy); else pathRect(r(op.x) + dx, r(op.y) + dy, r(op.w), r(op.h), op.k === 'C' ? r(Math.min(op.h, 3)) * 0.42 : N * 0.45); }
    function texture(op, bx, by, bw, bh) {
      const T = op.T, X = r(bx), Y = r(by), Wd = r(bw), Hd = r(bh);
      if (op.fam === 'poly' || op.fam === 'rubber') { // stipple
        const n = Math.min(900, (Wd * Hd) / 7 | 0); for (let i = 0; i < n; i++) { const u = noise(i * 7 + bx * 13, i * 3 + by * 17), v = noise(i * 11 + by, i * 5 + bx); c.fillStyle = noise(i, i * 3) < 0.5 ? T[0] + '66' : T[2] + '40'; c.fillRect(X + u * Wd, Y + v * Hd, 1.1, 1.1); }
      } else if (op.fam === 'wood') { // grain
        c.lineWidth = 0.9; for (let i = 0; i < Hd / 2.4; i++) { const yy = Y + i * 2.4 + noise(i, bx) * 1.5; c.strokeStyle = (i % 3 ? T[0] : T[3]) + (i % 3 ? '55' : '30'); c.beginPath(); c.moveTo(X, yy); for (let xx = 0; xx <= Wd; xx += 6) c.lineTo(X + xx, yy + Math.sin((xx + i * 13) * 0.09) * 1.2 + (noise(xx, i) - 0.5) * 0.8); c.stroke(); }
      } else if (op.fam === 'metal' || op.fam === 'rust') { // brushed streaks
        c.lineWidth = 0.6; for (let i = 0; i < Hd; i += 1.6) { c.strokeStyle = (noise(i | 0, bx) < 0.5 ? T[3] : T[0]) + (op.fam === 'rust' ? '30' : '18'); const s0 = noise(bx, i | 0) * Wd * 0.6; c.beginPath(); c.moveTo(X + s0, Y + i); c.lineTo(X + s0 + Wd * (0.25 + noise(i | 0, by) * 0.5), Y + i); c.stroke(); }
        if (op.fam === 'rust') for (let i = 0; i < Wd * Hd / 40; i++) { c.fillStyle = noise(i, 9) < 0.5 ? '#3a2416aa' : '#b06a3a66'; c.beginPath(); c.arc(X + noise(i, 1) * Wd, Y + noise(i, 2) * Hd, 0.6 + noise(i, 3) * 1.6, 0, 6.3); c.fill(); }
      } else if (op.fam === 'tape') { c.lineWidth = 0.7; for (let i = 0; i < Wd; i += 2.2) { c.strokeStyle = T[0] + '44'; c.beginPath(); c.moveTo(X + i, Y); c.lineTo(X + i + 1.5, Y + Hd); c.stroke(); } }
      if (op.camo && skin?.camo) { for (let i = 0; i < Wd * Hd / 26; i++) { const u = noise(i * 3 + 1, bx * 7 + 3), v = noise(i * 5 + 2, by * 3 + 1), k = Math.floor(noise(i, 77) * skin.camo.length); c.fillStyle = skin.camo[k] + 'd8'; c.beginPath(); c.ellipse(X + u * Wd, Y + v * Hd, 2.5 + noise(i, 4) * 4.5, 1.6 + noise(i, 5) * 2.2, noise(i, 6) * 3, 0, 6.3); c.fill(); } }
    }
    function body(op) {
      const T = op.T, [bx, by, bw, bh] = bboxOf(op), d = N * 0.55, matte = op.o?.matte || op.fam === 'rubber';
      c.save(); shape(op); c.clip();
      // rims: dark everywhere, light top-left, body inside both
      c.fillStyle = mix(T[0], '#000000', 0.25); c.fillRect(r(bx) - 2, r(by) - 2, r(bw) + 4, r(bh) + 4);
      c.save(); shape(op, -d * 0.7, -d); c.clip(); c.fillStyle = matte ? T[2] : mix(T[2], T[3], 0.45); c.fillRect(r(bx) - 2, r(by) - 2, r(bw) + 4, r(bh) + 4);
      c.save(); shape(op, d * 0.5, d * 0.7); c.clip();
      const gr = c.createLinearGradient(0, r(by), 0, r(by + bh));
      if (op.k === 'C' || op.fam === 'chrome' || op.fam === 'gold') { gr.addColorStop(0, T[2]); gr.addColorStop(0.28, T[3]); gr.addColorStop(0.42, T[2]); gr.addColorStop(0.7, T[1]); gr.addColorStop(1, T[0]); }
      else if (matte) { gr.addColorStop(0, mix(T[1], T[2], 0.35)); gr.addColorStop(1, mix(T[1], T[0], 0.4)); }
      else { gr.addColorStop(0, mix(T[1], T[2], 0.55)); gr.addColorStop(0.55, T[1]); gr.addColorStop(1, mix(T[1], T[0], 0.55)); }
      c.fillStyle = gr; c.fillRect(r(bx) - 2, r(by) - 2, r(bw) + 4, r(bh) + 4);
      texture(op, bx, by, bw, bh);
      c.restore(); c.restore();
      // specular streak along the top of long glossy parts
      if (!matte && bw >= 3 && op.fam !== 'wood' && op.fam !== 'poly') { const sg = c.createLinearGradient(r(bx), 0, r(bx + bw), 0); sg.addColorStop(0, T[3] + '00'); sg.addColorStop(0.18, T[3] + 'cc'); sg.addColorStop(0.62, T[3] + '55'); sg.addColorStop(0.9, T[3] + '00'); c.fillStyle = sg; c.fillRect(r(bx), r(by) + d * 1.25, r(bw), Math.max(1, N * 0.32)); }
      if (op.fam === 'chrome' || op.fam === 'gold') { c.globalCompositeOperation = 'screen'; const g2 = c.createLinearGradient(r(bx), r(by), r(bx + bw), r(by + bh)); g2.addColorStop(0, '#ffffff00'); g2.addColorStop(0.45, '#ffffff00'); g2.addColorStop(0.5, '#ffffff90'); g2.addColorStop(0.56, '#ffffff00'); c.fillStyle = g2; c.fillRect(r(bx), r(by), r(bw), r(bh)); c.globalCompositeOperation = 'source-over'; }
      c.restore();
    }
    function detail(op) {
      const X = r(op.x), Y = r(op.y), Wd = r(op.w), Hd = r(op.h);
      if (op.c === 'glow') { c.save(); c.shadowColor = '#ff3b3b'; c.shadowBlur = N * 3; c.fillStyle = '#ff6b6b'; c.beginPath(); c.arc(X + Wd / 2, Y + Hd / 2, N * 0.6, 0, 6.3); c.fill(); c.restore(); return; }
      if (op.c === INK) { // recess: dark slot with a light lower lip
        pathRect(X + 0.4, Y + 0.6, Wd - 0.8, Hd - 1, N * 0.35); c.fillStyle = '#05070a'; c.fill();
        c.fillStyle = '#ffffff22'; c.fillRect(X + 1, Y + Hd - 1.2, Math.max(0, Wd - 2), 0.8); return;
      }
      if (/^#(ff3b3b|ff4a4a|7cc7ff|9fd4ff|ff9a3c|e8f6ff|91cbd7)/i.test(op.c)) { c.save(); c.shadowColor = op.c; c.shadowBlur = N * 1.6; pathRect(X + 0.3, Y + 0.3, Wd - 0.6, Hd - 0.6, N * 0.4); c.fillStyle = op.c; c.fill(); c.restore(); return; }
      pathRect(X + 0.25, Y + 0.25, Wd - 0.5, Hd - 0.5, N * 0.3); c.fillStyle = op.c; c.fill();
      c.fillStyle = '#ffffff1c'; c.fillRect(X + 0.6, Y + 0.5, Math.max(0, Wd - 1.2), Math.min(1, Hd * 0.3));
    }
    for (const op of ops) { if (op.k === 'L') detail(op); else body(op); }

    // 3) soft ink outline + contact shading between overlapping parts
    const tmp = document.createElement('canvas'); tmp.width = cv.width; tmp.height = cv.height; const t = tmp.getContext('2d');
    t.drawImage(cv, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = INK; t.fillRect(0, 0, tmp.width, tmp.height);
    c.save(); c.globalCompositeOperation = 'destination-over'; const o = N * 0.55;
    for (const [dx, dy] of [[o, 0], [-o, 0], [0, o], [0, -o], [o * 0.7, o * 0.7], [-o * 0.7, o * 0.7], [o * 0.7, -o * 0.7], [-o * 0.7, -o * 0.7]]) c.drawImage(tmp, dx, dy);
    c.restore();
    // gloss: faint top-down sheen over the whole gun
    c.save(); c.globalCompositeOperation = 'source-atop'; const gl = c.createLinearGradient(0, r(y0), 0, r(y1 + 1)); gl.addColorStop(0, '#ffffff14'); gl.addColorStop(0.4, '#ffffff00'); gl.addColorStop(1, '#00000026'); c.fillStyle = gl; c.fillRect(0, 0, cv.width, cv.height); c.restore();

    const pad = Math.ceil(N * 0.8);
    const scaleA = (v) => (Array.isArray(v) ? v.map((n) => n * N) : v);
    const A = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, scaleA(v)]));
    return { cv, box: { x: Math.max(0, x0 * N - pad), y: Math.max(0, y0 * N - pad), w: (x1 - x0 + 1) * N + pad * 2, h: (y1 - y0 + 1) * N + pad * 2 }, a: A, nativeScale: N, hd: true };
  }
  root.NightshiftWeaponHD = Object.freeze({ N, sprite });
})(typeof window !== 'undefined' ? window : globalThis);
