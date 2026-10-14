/* Authored car views (Claude-owned, Option 3 golden sample: the purple widebody coupe).
 * The city camera is top-down (car-hd.js) and Route 9 is side-on (highway-style.js); the garage also shows real
 * FRONT, REAR and SIDE views — drawn for the coupe body family, never a rotated top sprite. Every Vehicle Studio part
 * changes them: paint + finish, rims, body kit (lip / drift / widebody), stance, spoiler (lip / ducktail / wing / GT),
 * hood (scoop / vented / carbon), exhaust, headlights, livery, tint, underglow.
 * Pixel pipeline: shapes are drawn in banded material tones at native resolution (side 192x80, front/rear 128x80),
 * then alpha is snapped to 0/255 and a 1px ink outline is added, so the result is crisp pixel art (no blur).
 * API: NightshiftCarViews.{render(view, opts) -> canvas, supports(spec), VIEWS, SIZE} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const VIEWS = ['side', 'front', 'rear'];
  const SIZE = { side: [192, 80], front: [128, 80], rear: [128, 80] };
  const hexRgb = (h) => { const n = parseInt(String(h).slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const ramp = (c) => [mix(mix(c, '#1d1238', 0.45), '#000', 0.35), mix(mix(c, '#2a1e50', 0.28), '#000', 0.12), c, mix(c, '#ffe9f0', 0.3), mix(c, '#ffffff', 0.62)];
  const RIM = { stock: ['#9aa3ab', '#5a636b', 5], chrome: ['#eef3f7', '#9aa6b1', 5], black: ['#2a2f36', '#0d1013', 10], gold: ['#f0c85a', '#8a6420', 14], deep: ['#f7f9fb', '#b9c3cc', 5], neon: ['#1c2128', '#0a0c0f', 6], bronze: ['#b8864a', '#6b4a22', 12], turbine: ['#d7dde3', '#7d8792', 16], white: ['#f4f6f8', '#b8c0c8', 6] };
  const LIGHT = { stock: '#fff4c8', xenon: '#eaf6ff', amber: '#ffc46b', ice: '#9fdcff' };
  const supports = (spec) => !!spec && (spec.body === 'coupe' || spec.body === 'gt' || spec.id === 'vandal');

  function poly(c, pts, fill) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } }
  function rect(c, x, y, w, h, f) { c.fillStyle = f; c.fillRect(x, y, w, h); }
  function circ(c, x, y, r, f) { c.fillStyle = f; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

  // a rim seen face-on (side view) — spokes, lip, cap, brake caliper
  function rim(c, x, y, r, st, spin = 0) {
    const R = RIM[st.rims] || RIM.stock, rr = r * (st.rims === 'deep' ? 0.74 : 0.68);
    circ(c, x, y, r, '#0b0c0f'); c.strokeStyle = '#26292f'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r - 1.5, 0, Math.PI * 2); c.stroke(); // tyre + sidewall
    circ(c, x, y, rr, '#121418'); c.fillStyle = st.rims === 'gold' || st.rims === 'bronze' ? '#d8a13a' : '#c8323a'; c.beginPath(); c.arc(x, y, rr * 0.8, -2.5, -1.2); c.arc(x, y, rr * 0.5, -1.2, -2.5, true); c.closePath(); c.fill();
    c.strokeStyle = R[0]; c.lineCap = 'round';
    for (let i = 0; i < R[2]; i++) { const a = spin + (i / R[2]) * Math.PI * 2; c.lineWidth = R[2] > 8 ? 1 : 1.6; c.beginPath(); c.moveTo(x + Math.cos(a) * rr * 0.22, y + Math.sin(a) * rr * 0.22); c.lineTo(x + Math.cos(a + (R[2] > 8 ? 0.35 : 0)) * rr * 0.95, y + Math.sin(a + (R[2] > 8 ? 0.35 : 0)) * rr * 0.95); c.stroke(); }
    c.lineWidth = 1.2; c.strokeStyle = st.rims === 'neon' ? '#7af0ff' : R[0]; c.beginPath(); c.arc(x, y, rr * 0.96, 0, Math.PI * 2); c.stroke();
    circ(c, x, y, rr * 0.2, R[1]); circ(c, x - 0.6, y - 0.6, rr * 0.1, R[0]);
  }

  // ---------------- SIDE (facing right) ----------------
  function side(c, o) {
    const st = o.style, P = ramp(o.color), drop = st.stance === 'slammed' ? 4 : st.stance === 'lowered' ? 2 : 0, wide = st.kit === 'wide';
    const G = 74, wr = 13, RX = 46, FX = 146, WY = G - wr, dy = drop;
    if (st.glow && st.glow !== 'none' && o.night) { const g = c.createRadialGradient(96, G, 4, 96, G, 90); g.addColorStop(0, st.glow + 'cc'); g.addColorStop(1, st.glow + '00'); c.fillStyle = g; c.fillRect(0, G - 10, 192, 14); }
    rect(c, 18, G - 2, 160, 3, '#00000066'); // contact shadow
    // body silhouette with wheel arches
    const body = (fill) => { c.beginPath(); c.moveTo(12, 62 + dy); c.lineTo(8, 52 + dy); c.lineTo(12, 44 + dy); c.lineTo(16, 41 + dy); c.lineTo(44, 39 + dy); c.lineTo(52, 37 + dy); c.quadraticCurveTo(64, 25 + dy, 74, 23 + dy); c.lineTo(104, 22 + dy); c.quadraticCurveTo(116, 26 + dy, 130, 38 + dy); c.lineTo(152, 41 + dy); c.quadraticCurveTo(176, 43 + dy, 184, 50 + dy); c.lineTo(183, 61 + dy); c.lineTo(164, 63 + dy); c.arc(FX, WY + 1, 18, 0, Math.PI, true); c.lineTo(64, 63 + dy); c.arc(RX, WY + 1, 18, 0, Math.PI, true); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } };
    body(P[2]);
    c.save(); body(); c.clip();
    rect(c, 0, 0, 192, 40 + dy, P[3]); rect(c, 0, 52 + dy, 192, 6, P[1]); rect(c, 0, 58 + dy, 192, 10, P[0]); // shoulder light band, lower shade
    rect(c, 0, 43 + dy, 192, 1, P[4]); // shoulder crease highlight
    if (st.finish === 'matte' || st.finish === 'satin') { c.fillStyle = '#00000018'; c.fillRect(0, 0, 192, 80); }
    if (st.finish === 'chrome') { c.fillStyle = '#ffffff40'; c.fillRect(0, 30 + dy, 192, 3); }
    // livery
    const lc = st.liveryColor || '#f4f1ea';
    if (st.livery === 'stripes') { rect(c, 0, 47 + dy, 192, 2, lc); rect(c, 0, 51 + dy, 192, 2, lc); }
    if (st.livery === 'racing') { rect(c, 0, 46 + dy, 192, 6, lc); circ(c, 98, 49 + dy, 6, '#f4f1ea'); c.fillStyle = '#14171c'; c.font = '700 8px monospace'; c.textAlign = 'center'; c.fillText('7', 98, 52 + dy); }
    if (st.livery === 'split') rect(c, 0, 48 + dy, 192, 20, lc);
    if (st.livery === 'checker') for (let x = 70; x < 128; x += 4) for (let y = 0; y < 3; y++) if (((x / 4) + y) % 2 === 0) rect(c, x, 44 + dy + y * 4, 4, 4, lc);
    if (st.livery === 'flames') { c.fillStyle = lc; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(182, 52 + dy + k); c.quadraticCurveTo(150, 44 + dy + k * 2, 120 - k * 6, 50 + dy + k); c.quadraticCurveTo(150, 54 + dy + k, 182, 56 + dy); c.fill(); } }
    // hood
    if (st.hood === 'carbon') { c.fillStyle = '#1b1e22'; poly(c, [[130, 38 + dy], [152, 41 + dy], [176, 43 + dy], [176, 45 + dy], [130, 41 + dy]]); c.fill(); }
    c.restore();
    if (st.hood === 'scoop') poly(c, [[140, 40 + dy], [146, 37 + dy], [156, 38 + dy], [156, 41 + dy]], P[1]);
    if (st.hood === 'vented') { rect(c, 150, 41 + dy, 6, 1, '#0c0e11'); rect(c, 158, 42 + dy, 6, 1, '#0c0e11'); }
    // glass (DLO), B-pillar, reflection
    const tint = ['#2a4a66', '#1d3448', '#132332', '#0a121c'][+(st.tint || 0)] || '#2a4a66';
    poly(c, [[54, 38 + dy], [66, 28 + dy], [76, 26 + dy], [103, 25 + dy], [124, 38 + dy]], tint);
    rect(c, 92, 25 + dy, 3, 13, P[0]); c.fillStyle = '#a8d4ff55'; poly(c, [[100, 26 + dy], [106, 26 + dy], [96, 37 + dy], [90, 37 + dy]]); c.fill();
    // door shut lines, handle, mirror, side vent
    c.fillStyle = P[0]; c.fillRect(96, 39 + dy, 1, 20); c.fillRect(126, 40 + dy, 1, 18); c.fillRect(104, 45 + dy, 5, 1);
    poly(c, [[121, 36 + dy], [127, 34 + dy], [128, 38 + dy], [122, 39 + dy]], P[1]);
    rect(c, 132, 47 + dy, 8, 3, '#0c0e11'); rect(c, 133, 47 + dy, 6, 1, '#3a4049');
    // lights
    poly(c, [[168, 45 + dy], [182, 49 + dy], [181, 51 + dy], [167, 48 + dy]], LIGHT[st.lights] || LIGHT.stock);
    rect(c, 9, 46 + dy, 7, 3, '#e23a4a'); rect(c, 9, 46 + dy, 7, 1, '#ff9aa0');
    if (o.night) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(184, 0, 192, 0); g.addColorStop(0, (LIGHT[st.lights] || LIGHT.stock) + 'aa'); g.addColorStop(1, '#0000'); c.fillStyle = g; c.fillRect(182, 44 + dy, 10, 8); c.restore(); }
    // kits
    const carbon = '#16191d';
    if (st.kit === 'lip' || st.kit === 'drift') { poly(c, [[150, 62 + dy], [186, 62 + dy], [188, 64 + dy], [152, 65 + dy]], carbon); rect(c, 66, 62 + dy, 62, 3, carbon); if (st.kit === 'drift') { poly(c, [[176, 52 + dy], [186, 52 + dy], [180, 55 + dy]], carbon); for (let k = 0; k < 3; k++) rect(c, 12 + k * 4, 62 + dy, 2, 4, carbon); } }
    if (wide) for (const x of [RX, FX]) { c.strokeStyle = P[1]; c.lineWidth = 4; c.beginPath(); c.arc(x, WY + 1, 19.5, Math.PI * 1.03, Math.PI * 1.97); c.stroke(); c.strokeStyle = P[3]; c.lineWidth = 1; c.beginPath(); c.arc(x, WY + 1, 21.2, Math.PI * 1.1, Math.PI * 1.6); c.stroke(); for (let k = 1; k < 7; k++) { const a = Math.PI * (1.06 + k * 0.13); circ(c, x + Math.cos(a) * 19.5, WY + 1 + Math.sin(a) * 19.5, 0.7, '#d8dee4'); } }
    // spoilers
    const deck = 39 + dy;
    if (st.spoiler === 'lip') poly(c, [[14, deck + 1], [26, deck - 1], [14, deck - 3]], P[1]);
    if (st.spoiler === 'ducktail') poly(c, [[10, deck + 3], [30, deck], [10, deck - 5]], P[2]);
    if (st.spoiler === 'wing' || st.spoiler === 'gt') { const gt = st.spoiler === 'gt', top = deck - (gt ? 17 : 11); rect(c, 22, top + 3, 2, deck - top - 2, '#0d1013'); rect(c, 34, top + 3, 2, deck - top - 2, '#0d1013'); poly(c, [[gt ? 2 : 8, top + 2], [gt ? 46 : 42, top - 1], [gt ? 46 : 42, top + 2], [gt ? 2 : 8, top + 4]], gt ? '#22262c' : P[2]); if (gt) { rect(c, 2, top - 3, 2, 9, '#0d1013'); rect(c, 44, top - 4, 2, 9, '#0d1013'); } }
    // exhaust
    if (st.exhaust === 'twin' || st.exhaust === 'quad') { circ(c, 14, 63 + dy, 2, '#5a6168'); circ(c, 14, 63 + dy, 1, '#0c0e11'); }
    if (st.exhaust === 'side') { circ(c, 12, 62 + dy, 3, '#c9d1d6'); circ(c, 12, 62 + dy, 1.6, '#0c0e11'); }
    // wheels (stance tucks them into the arches)
    for (const x of [RX, FX]) rim(c, x, WY, wr + (wide ? 0.5 : 0), st, o.spin || 0);
  }

  // ---------------- FRONT / REAR (symmetric, with handed details kept) ----------------
  function frontRear(c, o, rear) {
    const st = o.style, P = ramp(o.color), drop = st.stance === 'slammed' ? 3 : st.stance === 'lowered' ? 1.5 : 0, wide = st.kit === 'wide', W = wide ? 58 : 54, cx = 64, G = 74, dy = drop;
    if (st.glow && st.glow !== 'none' && o.night) { const g = c.createRadialGradient(cx, G, 4, cx, G, 70); g.addColorStop(0, st.glow + 'cc'); g.addColorStop(1, st.glow + '00'); c.fillStyle = g; c.fillRect(0, G - 10, 128, 14); }
    rect(c, cx - W - 2, G - 2, W * 2 + 4, 3, '#00000066');
    // tyres
    for (const s of [-1, 1]) { const tx = cx + s * (W - 8); rect(c, tx - 7, 52, 14, 22, '#0b0c0f'); rect(c, tx - 7, 52, 14, 2, '#26292f'); rect(c, tx - (s > 0 ? -4 : 6), 56, 2, 14, '#1c2026'); }
    // lower body + fenders
    poly(c, [[cx - W, 64 + dy], [cx - W - 1, 48 + dy], [cx - W + 4, 40 + dy], [cx + W - 4, 40 + dy], [cx + W + 1, 48 + dy], [cx + W, 64 + dy]], P[2]);
    rect(c, cx - W, 40 + dy, W * 2, 3, P[3]); rect(c, cx - W, 56 + dy, W * 2, 8, P[1]);
    if (wide) for (const s of [-1, 1]) { poly(c, [[cx + s * (W - 14), 44 + dy], [cx + s * (W + 2), 46 + dy], [cx + s * (W + 2), 58 + dy], [cx + s * (W - 14), 58 + dy]], P[1]); for (let k = 0; k < 4; k++) circ(c, cx + s * (W - 1), 48 + dy + k * 3, 0.6, '#d8dee4'); }
    // cabin: glass + roof (+ mirrors)
    const tint = ['#2a4a66', '#1d3448', '#132332', '#0a121c'][+(st.tint || 0)] || '#2a4a66';
    poly(c, [[cx - 34, 40 + dy], [cx - 24, 20 + dy], [cx + 24, 20 + dy], [cx + 34, 40 + dy]], P[2]);
    poly(c, [[cx - 30, 39 + dy], [cx - 22, 23 + dy], [cx + 22, 23 + dy], [cx + 30, 39 + dy]], tint);
    c.fillStyle = '#a8d4ff44'; poly(c, [[cx - 14, 24 + dy], [cx - 6, 24 + dy], [cx - 16, 38 + dy], [cx - 24, 38 + dy]]); c.fill();
    rect(c, cx - 24, 19 + dy, 48, 2, P[3]);
    if (!rear) for (const s of [-1, 1]) poly(c, [[cx + s * 34, 34 + dy], [cx + s * 42, 32 + dy], [cx + s * 42, 36 + dy], [cx + s * 35, 37 + dy]], P[1]);
    // hood / trunk lid
    if (!rear) { if (st.hood === 'carbon') poly(c, [[cx - 30, 41 + dy], [cx + 30, 41 + dy], [cx + 36, 44 + dy], [cx - 36, 44 + dy]], '#1b1e22'); if (st.hood === 'vented') for (const s of [-1, 1]) rect(c, cx + s * 14 - 4, 42 + dy, 8, 1, '#0c0e11'); if (st.hood === 'scoop') poly(c, [[cx - 8, 41 + dy], [cx - 6, 37 + dy], [cx + 6, 37 + dy], [cx + 8, 41 + dy]], P[1]); }
    // livery stripes run over the nose / tail
    const lc = st.liveryColor || '#f4f1ea'; if (st.livery === 'stripes') { rect(c, cx - 7, 20 + dy, 4, 44, lc); rect(c, cx + 3, 20 + dy, 4, 44, lc); } if (st.livery === 'racing') rect(c, cx - 6, 20 + dy, 12, 44, lc);
    if (!rear) {
      // headlights (angular), grille + intakes, emblem, splitter
      const L = LIGHT[st.lights] || LIGHT.stock;
      for (const s of [-1, 1]) { poly(c, [[cx + s * 22, 45 + dy], [cx + s * (W - 4), 44 + dy], [cx + s * (W - 6), 49 + dy], [cx + s * 26, 50 + dy]], '#0c0e11'); poly(c, [[cx + s * 24, 46 + dy], [cx + s * (W - 6), 45 + dy], [cx + s * (W - 8), 47 + dy], [cx + s * 26, 48 + dy]], L); rect(c, cx + s * (W - 14) - 4, 55 + dy, 8, 5, '#0c0e11'); }
      poly(c, [[cx - 16, 51 + dy], [cx + 16, 51 + dy], [cx + 12, 62 + dy], [cx - 12, 62 + dy]], '#0c0e11'); for (let y = 53; y < 61; y += 2) rect(c, cx - 13, y + dy, 26, 1, '#22262c');
      poly(c, [[cx - 2, 46 + dy], [cx, 49 + dy], [cx + 2, 46 + dy]], '#c9ccd2');
      if (o.night) { c.save(); c.globalCompositeOperation = 'lighter'; for (const s of [-1, 1]) { const g = c.createRadialGradient(cx + s * 36, 47 + dy, 1, cx + s * 36, 47 + dy, 14); g.addColorStop(0, L + 'cc'); g.addColorStop(1, '#0000'); c.fillStyle = g; c.fillRect(cx + s * 36 - 14, 33 + dy, 28, 28); } c.restore(); }
    } else {
      // full-width tail bar, plate (fictional), diffuser, exhausts
      rect(c, cx - W + 4, 45 + dy, W * 2 - 8, 4, '#a3141f'); rect(c, cx - W + 4, 45 + dy, W * 2 - 8, 1, '#ff6a72'); for (const s of [-1, 1]) rect(c, cx + s * (W - 14) - 6, 44 + dy, 12, 6, '#e23a4a');
      rect(c, cx - 11, 52 + dy, 22, 7, '#f1efe8'); c.fillStyle = '#14171c'; c.font = '700 5px monospace'; c.textAlign = 'center'; c.fillText('NSC 777', cx, 57.5 + dy);
      rect(c, cx - W + 6, 62 + dy, W * 2 - 12, 3, '#16191d'); for (let k = -3; k <= 3; k++) rect(c, cx + k * 7, 61 + dy, 1, 5, '#2a2e33');
      const tips = st.exhaust === 'quad' ? [-30, -25, 25, 30] : st.exhaust === 'twin' ? [-28, 28] : st.exhaust === 'side' ? [0] : [];
      for (const t of tips) { circ(c, cx + t, 62 + dy, st.exhaust === 'side' ? 3.5 : 2.2, '#c9d1d6'); circ(c, cx + t, 62 + dy, st.exhaust === 'side' ? 2 : 1.2, '#0c0e11'); }
      if (o.night) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(0, 40, 0, 56); g.addColorStop(0, '#0000'); g.addColorStop(0.5, '#ff2a3a55'); g.addColorStop(1, '#0000'); c.fillStyle = g; c.fillRect(cx - W, 38 + dy, W * 2, 18); c.restore(); }
    }
    // kits: splitter / lip / canards / diffuser fins
    const carbon = '#16191d'; if (st.kit !== 'stock' && st.kit && !rear) { poly(c, [[cx - W + 2, 64 + dy], [cx + W - 2, 64 + dy], [cx + W + 2, 66 + dy], [cx - W - 2, 66 + dy]], carbon); if (st.kit === 'drift') for (const s of [-1, 1]) poly(c, [[cx + s * (W - 2), 54 + dy], [cx + s * (W + 4), 53 + dy], [cx + s * (W - 1), 57 + dy]], carbon); }
    // spoiler seen over the roof
    if (st.spoiler === 'wing' || st.spoiler === 'gt') { const gt = st.spoiler === 'gt', y = (gt ? 12 : 16) + dy; rect(c, cx - (gt ? 50 : 40), y, gt ? 100 : 80, 2, gt ? '#22262c' : P[1]); if (gt) for (const s of [-1, 1]) rect(c, cx + s * 50 - 1, y - 3, 2, 8, '#0d1013'); for (const s of [-1, 1]) rect(c, cx + s * 18, y + 2, 2, rear ? 22 : 3, '#0d1013'); }
    if (rear && st.spoiler === 'ducktail') rect(c, cx - 36, 39 + dy, 72, 2, P[1]);
  }

  // ---------------- pixel finish ----------------
  function crisp(cv) {
    const c = cv.getContext('2d'), w = cv.width, h = cv.height, d = c.getImageData(0, 0, w, h), p = d.data, a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { const al = p[i * 4 + 3]; if (al >= 110) { p[i * 4 + 3] = 255; a[i] = 1; } else p[i * 4 + 3] = 0; }
    const out = new Uint8ClampedArray(p);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (a[i]) continue; let n = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && a[yy * w + xx]) n = true; } if (n) { out[i * 4] = 10; out[i * 4 + 1] = 11; out[i * 4 + 2] = 18; out[i * 4 + 3] = 255; } }
    d.data.set(out); c.putImageData(d, 0, 0); return cv;
  }
  const cache = new Map();
  /** opts: { color, style (carstyle), night, spin } → native-resolution canvas (crisp pixels). */
  function render(view, o) {
    const key = view + '|' + o.color + '|' + JSON.stringify(o.style) + '|' + !!o.night + '|' + (view === 'side' ? Math.round((o.spin || 0) * 4) % 26 : 0); let cv = cache.get(key); if (cv) return cv;
    const [w, h] = SIZE[view]; cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
    if (view === 'side') side(c, o); else frontRear(c, o, view === 'rear');
    crisp(cv); cache.set(key, cv); if (cache.size > 120) cache.delete(cache.keys().next().value); return cv;
  }
  root.NightshiftCarViews = Object.freeze({ render, supports, VIEWS, SIZE });
})(typeof window !== 'undefined' ? window : globalThis);
