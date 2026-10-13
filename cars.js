/* Car collection in game (Claude-owned). Requires cars-data.js.
 *  - Detailed top-down pixel art for all ten models, baked once per model+paint at 4× and drawn smoothly scaled:
 *    shaded paint, glass with reflections, panel seams, chrome, lights, mirrors and per-body details
 *    (stripes + scoop, bed + toolbox, roof rails + spare, light pod + livery, tailfins, pinstripes, louvers + wing,
 *    teardrop canopy + LED strips). Brake lights, headlight glow and wear are drawn live.
 *  - Owned cars are real cars in the city (`cars`), with their own handling and armor (NightshiftVehicles wraps).
 *  - Prestige Motors (Palm Grove) sells them (NightshiftCars.openDealer); delivered to the curb by your apartment.
 *  - A rare model is parked somewhere in the city every 25 minutes. Steal it: Rusty re-VINs it (it joins your
 *    collection) or chops it for big money.
 *  - 📱 → 🚗 MY CARS: your garage list (GPS to each car, sell) and the collection book with milestone bonuses.
 * Save: nightshift-cars-v1. API: NightshiftCars.{state, open, openDealer, draw, portrait, retire, adopt, rare} */
(function (root) {
  'use strict';
  const D = root.NightshiftCarsData;
  if (!D) return;
  const KEY = 'nightshift-cars-v1';
  let state = D.clean({});
  try { state = D.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const CARS = () => { try { return cars; } catch { return []; } };
  const G = () => { try { return g; } catch { return null; } };
  const BLD = () => { try { return buildings; } catch { return []; } };
  const WORLD = () => { try { return world; } catch { return { w: 2200, h: 1700 }; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();

  // ---------------- art ----------------
  function shade(h, amt) { const n = parseInt(String(h).slice(1, 7), 16); if (!Number.isFinite(n)) return h; let r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255; const f = amt < 0 ? (v) => Math.round(v * (1 + amt)) : (v) => Math.round(v + (255 - v) * amt); return '#' + ((1 << 24) | (f(r) << 16) | (f(gg) << 8) | f(b)).toString(16).slice(1); }
  const lum = (h) => { const n = parseInt(String(h).slice(1, 7), 16); return ((n >> 16 & 255) * 0.3 + (n >> 8 & 255) * 0.59 + (n & 255) * 0.11) / 255; };
  // Body outlines: top half from tail to nose (y<=0); mirrored for the bottom half. Cabin: xr (roof rear), xf (roof front),
  // wsh (windshield length), rgl (rear glass length), ins (roof inset from the sides).
  const BODY = {
    hatch: { shape: [[-25, -11], [-24.5, -12.8], [-21, -13.5], [16, -13.5], [21, -12.5], [24.5, -10], [25, -6], [25, 0]], xr: -15, xf: 5, wsh: 6, rgl: 5, ins: 3, tire: [10, 5], wb: 0.3 },
    pickup: { shape: [[-31, -13.5], [-30.5, -15], [24, -15], [29, -13.5], [31, -10], [31, 0]], xr: -4, xf: 9, wsh: 6, rgl: 2, ins: 3, tire: [12, 6.5], wb: 0.32 },
    suv: { shape: [[-30, -13.5], [-29.5, -15.5], [24, -15.5], [28.5, -14], [30, -11], [30, 0]], xr: -22, xf: 8, wsh: 6, rgl: 3, ins: 2.5, tire: [12, 6.5], wb: 0.31 },
    muscle: { shape: [[-31, -12], [-30, -14.5], [-22, -15], [12, -15], [26, -14], [30.5, -11.5], [31, 0]], xr: -14, xf: 2, wsh: 6, rgl: 6, ins: 3, tire: [11, 6], wb: 0.3 },
    rally: { shape: [[-27, -11.5], [-26, -13.5], [-20, -14], [17, -14], [23, -12.5], [26.5, -9], [27, 0]], xr: -15, xf: 5, wsh: 6, rgl: 5, ins: 2.8, tire: [10, 5.5], wb: 0.3 },
    classic: { shape: [[-32, -10], [-31, -13], [-27, -14.5], [-10, -15], [14, -15], [26, -14.2], [30.5, -12], [32, -8], [32, 0]], xr: -12, xf: 4, wsh: 7, rgl: 6, ins: 3.2, tire: [11, 5], wb: 0.3 },
    lowrider: { shape: [[-33, -11], [-32.5, -13.8], [-26, -14.5], [24, -14.5], [30, -13.5], [33, -10], [33, 0]], xr: -14, xf: 2, wsh: 6, rgl: 6, ins: 3, tire: [10, 4], wb: 0.31 },
    gt: { shape: [[-30, -11], [-29, -13.5], [-22, -14.5], [6, -14.5], [20, -13.8], [27, -11.5], [30, -7], [30.5, 0]], xr: -16, xf: -2, wsh: 8, rgl: 9, ins: 3.5, tire: [11, 5.5], wb: 0.3 },
    super: { shape: [[-30, -13], [-29, -15.5], [-12, -15.5], [6, -14.5], [20, -12.5], [28, -9], [30, -5], [30.5, 0]], xr: -8, xf: 3, wsh: 9, rgl: 3, ins: 4, tire: [11, 6.5], wb: 0.29 },
    // the city's everyday cars (Codex models COMPACT / SEDAN / VAN), restyled with the same renderer
    sedan: { shape: [[-28, -11], [-27, -14], [-20, -15], [16, -15], [24, -13], [27.5, -9], [28, 0]], xr: -13, xf: 5, wsh: 7, rgl: 6, ins: 3, tire: [10, 5], wb: 0.3, doors: 2 },
    compact: { shape: [[-25, -11], [-24.5, -13.5], [-19, -14], [14, -14], [21, -12.5], [24.5, -9], [25, 0]], xr: -13, xf: 4, wsh: 6, rgl: 4, ins: 2.8, tire: [9, 5], wb: 0.3 },
    van: { shape: [[-28, -14], [-27.5, -16], [20, -16], [25, -14.5], [28, -11], [28, 0]], xr: -26, xf: 12, wsh: 6, rgl: 0, ins: 2, tire: [11, 6], wb: 0.33 },
    hyper: { shape: [[-31, -12], [-30, -15], [-16, -15.5], [2, -14.5], [18, -12], [27, -8], [31, -3], [31.5, 0]], xr: -10, xf: 12, wsh: 0, rgl: 0, ins: 7, tire: [11, 6.5], wb: 0.29 },
  };
  const full = (half) => [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [x, -y])];
  function poly(c, pts, fill) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } }
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const RR = (c, col, x, y, w, h, r) => { c.fillStyle = col; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill(); };
  const CIR = (c, col, x, y, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  function glass(c, pts, x0, x1) {
    const gr = c.createLinearGradient(x0, -10, x1, 10); gr.addColorStop(0, '#0b1520'); gr.addColorStop(0.55, '#1f3a52'); gr.addColorStop(1, '#3a6382');
    poly(c, pts, gr); c.save(); c.clip(); c.strokeStyle = '#ffffff40'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0 + (x1 - x0) * 0.2, -14); c.lineTo(x0 + (x1 - x0) * 0.75, 14); c.stroke(); c.strokeStyle = '#ffffff1c'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x0 + (x1 - x0) * 0.5, -14); c.lineTo(x0 + (x1 - x0) * 0.95, 14); c.stroke(); c.restore();
    const tint = [0, 0.3, 0.5, 0.7][Number(bakeStyle?.tint) || 0]; if (tint) poly(c, pts, `rgba(4,7,10,${tint})`);
    c.strokeStyle = '#05080c'; c.lineWidth = 0.5; poly(c, pts); c.stroke();
  }
  function wheel(c, x, y, tw, th, rim, wire) {
    RR(c, '#0c0e11', x - tw / 2, y - th / 2, tw, th, 1.6);
    for (let k = -tw / 2 + 1.5; k < tw / 2 - 1; k += 2) R(c, '#22262c', x + k, y - th / 2 + 0.4, 0.8, th - 0.8);
    const side = y < 0 ? -1 : 1; R(c, rim, x - tw / 2 + 2, y + side * (th / 2 - 1.3) - 0.6, tw - 4, 1.2);
    if (wire) for (let k = -tw / 2 + 2.5; k < tw / 2 - 2; k += 1.5) R(c, '#fff2b0', x + k, y + side * (th / 2 - 1.3) - 0.6, 0.5, 1.2);
  }
  // Everyday city cars (no catalog entry): same renderer, Codex's model names.
  const BASE = { COMPACT: { id: 'COMPACT', body: 'compact', len: 50, wid: 29, colors: [] }, SEDAN: { id: 'SEDAN', body: 'sedan', len: 56, wid: 31, colors: [] }, VAN: { id: 'VAN', body: 'van', len: 56, wid: 32, colors: [] } };
  let styleBase = true;
  let bakeStyle = null; // style being baked (carstyle-data.js); read by glass() for tint
  const RIMS = { chrome: '#eef3f7', black: '#2a2f36', gold: '#f0c85a', deep: '#f7f9fb', neon: '#7af0ff' };
  function bake(id, color, st = null) {
    bakeStyle = st;
    const spec = D.BY[id] || BASE[id], B0 = BODY[spec.body], L = spec.len, W = spec.wid, S = BASE[id] ? 3 : 4, pad = 6;
    const cv = document.createElement('canvas'); cv.width = (L + pad * 2) * S; cv.height = (W + pad * 2) * S;
    const c = cv.getContext('2d'); c.scale(S, S); c.translate(L / 2 + pad, W / 2 + pad);
    const sx = L / ((B0.shape.at(-1)[0]) * 2), sy = W / (Math.abs(Math.min(...B0.shape.map((p) => p[1]))) * 2); // normalise shape to len/wid
    const pts = full(B0.shape).map(([x, y]) => [x * sx, y * sy]), hw = W / 2, hl = L / 2;
    const dark = shade(color, -0.6), lite = shade(color, 0.22), deep = shade(color, -0.32), chrome = '#dfe6ec', black = '#15181c';
    // wheels under the body
    const fx = L * B0.wb, rx = -L * B0.wb, [tw, th] = B0.tire, wide = spec.body === 'super' || spec.body === 'hyper';
    const rim = st && RIMS[st.rims] ? RIMS[st.rims] : spec.body === 'lowrider' ? '#e8c45a' : wide ? '#c9cfd6' : spec.body === 'classic' ? '#f1efe8' : '#8f979f', wire = st?.rims === 'gold' || (spec.body === 'lowrider' && !(st && RIMS[st.rims])), dish = st?.rims === 'deep' ? 0.8 : 0;
    for (const s of [-1, 1]) { wheel(c, fx, s * (hw - th / 2 + 2.3 + dish), tw, th, rim, wire); wheel(c, rx, s * (hw - th / 2 + (wide ? 3 : 2.3) + dish), tw + (wide ? 1 : 0), th + (wide ? 1.2 : 0), rim, wire); }
    // body: outline, paint, form shading, sheen
    c.save(); c.lineJoin = 'round'; c.strokeStyle = dark; c.lineWidth = 1.6; poly(c, pts); c.stroke(); poly(c, pts, color); c.clip();
    const sh = c.createLinearGradient(0, -hw, 0, hw); sh.addColorStop(0, '#ffffff3a'); sh.addColorStop(0.3, '#ffffff08'); sh.addColorStop(0.62, '#00000010'); sh.addColorStop(1, '#00000066'); c.fillStyle = sh; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4);
    const sh2 = c.createLinearGradient(-hl, 0, hl, 0); sh2.addColorStop(0, '#00000030'); sh2.addColorStop(0.15, '#00000000'); sh2.addColorStop(0.85, '#00000000'); sh2.addColorStop(1, '#0000002a'); c.fillStyle = sh2; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4);
    c.strokeStyle = '#ffffff55'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-hl + 4, -hw + 2.2); c.lineTo(hl - 5, -hw + 2.6); c.stroke();
    c.strokeStyle = '#00000038'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-hl + 4, hw - 2.2); c.lineTo(hl - 5, hw - 2.6); c.stroke();
    // metallic flake for the fancy paints
    if (spec.body === 'lowrider' || spec.body === 'hyper' || spec.body === 'classic') { let s0 = 7; for (let k = 0; k < 90; k++) { s0 = (s0 * 1103515245 + 12345) >>> 0; const x = -hl + (s0 % 1000) / 1000 * L; s0 = (s0 * 1103515245 + 12345) >>> 0; const y = -hw + (s0 % 1000) / 1000 * W; R(c, '#ffffff30', x, y, 0.5, 0.5); } }
    if (st && st.finish !== 'gloss') { // paint finish (under everything else)
      const F = st.finish;
      if (F === 'matte' || F === 'satin') { c.fillStyle = color; c.globalAlpha = F === 'matte' ? 0.55 : 0.3; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4); c.globalAlpha = 1; if (F === 'matte') { c.fillStyle = '#00000014'; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4); } }
      if (F === 'metallic' || F === 'pearl') { let s0 = 11; for (let k = 0; k < 140; k++) { s0 = (s0 * 1103515245 + 12345) >>> 0; const x = -hl + (s0 % 1000) / 1000 * L; s0 = (s0 * 1103515245 + 12345) >>> 0; const y = -hw + (s0 % 1000) / 1000 * W; R(c, k % 3 ? '#ffffff38' : '#ffffff70', x, y, 0.35, 0.35); } }
      if (F === 'pearl') { const pg = c.createLinearGradient(-hl, -hw, hl, hw); pg.addColorStop(0, '#ff9ae022'); pg.addColorStop(0.5, '#9affee30'); pg.addColorStop(1, '#a0b4ff26'); c.fillStyle = pg; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4); }
      if (F === 'chrome') { const cg = c.createLinearGradient(0, -hw, 0, hw); for (const [t, col] of [[0, '#ffffffb0'], [0.18, '#ffffff10'], [0.32, '#00000050'], [0.5, '#ffffff90'], [0.62, '#ffffff05'], [0.8, '#00000060'], [1, '#ffffff70']]) cg.addColorStop(t, col); c.fillStyle = cg; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4); }
    }
    c.restore();
    const xr = B0.xr * sx, xf = B0.xf * sx, wsh = B0.wsh * sx, rgl = B0.rgl * sx, ins = B0.ins;
    const rw = hw - ins; // roof half-width
    // ---- per-body paint work (under the glass) ----
    if (spec.body === 'muscle') { // twin stripes nose to tail
      for (const y0 of [-4.2, 1.2]) R(c, lum(color) > 0.7 ? '#1d2433' : '#f4f1ea', -hl + 1, y0, L - 2, 3);
    }
    if (spec.body === 'rally') { // livery: two diagonal bands + roof roundel
      const a = lum(color) > 0.7 ? '#2f6bd0' : '#f4f1ea', b = '#e0402a';
      c.save(); poly(c, pts); c.clip(); c.fillStyle = a; c.beginPath(); c.moveTo(-6, -hw); c.lineTo(2, -hw); c.lineTo(-10, hw); c.lineTo(-18, hw); c.fill(); c.fillStyle = b; c.beginPath(); c.moveTo(3, -hw); c.lineTo(7, -hw); c.lineTo(-5, hw); c.lineTo(-9, hw); c.fill(); c.restore();
    }
    if (spec.body === 'lowrider') { // gold pinstripe flames on the hood
      c.strokeStyle = '#f2c84a'; c.lineWidth = 0.55; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(xf + wsh + 2, s * 2); c.bezierCurveTo(xf + wsh + 8, s * 9, hl - 10, s * 2, hl - 4, s * 7); c.moveTo(xf + wsh + 3, s * 5); c.bezierCurveTo(xf + wsh + 10, s * 11, hl - 12, s * 6, hl - 7, s * 10); c.stroke(); }
    }
    if (spec.body === 'gt') { R(c, '#00000022', xf + wsh + 3, -5, hl - xf - wsh - 8, 1); R(c, '#00000022', xf + wsh + 3, 4, hl - xf - wsh - 8, 1); R(c, '#ffffff22', xf + wsh + 3, -4, hl - xf - wsh - 8, 0.6); }
    if (st) { // livery + hood (clipped to the body, under the glass)
      const lc = st.liveryColor || '#f4f1ea', hood0 = xf + wsh + 1.5, rwL = hw - ins;
      c.save(); poly(c, pts); c.clip();
      if (st.livery === 'stripes') for (const y0 of [-4.4, 1.4]) { R(c, lc, -hl, y0, L, 3); R(c, '#00000022', -hl, y0 + 2.4, L, 0.6); }
      if (st.livery === 'racing') { R(c, lc, -hl, -2.6, L, 5.2); R(c, '#00000022', -hl, 2, L, 0.6); }
      if (st.livery === 'split') { c.globalAlpha = 0.9; R(c, lc, -hl - 2, -hw - 2, hl + (xr + xf) / 2 + 2, W + 4); c.globalAlpha = 1; R(c, '#00000033', (xr + xf) / 2 - 0.6, -hw, 0.6, W); }
      if (st.livery === 'checker') for (let i = 0; i < 4; i++) for (let j = -Math.ceil(hw / 2); j < Math.ceil(hw / 2); j++) if ((i + j) % 2 === 0) R(c, lc, hood0 + 3 + i * 2, j * 2, 2, 2);
      if (st.livery === 'flames') { for (const sgn of [-1, 1]) { const f = [[hl + 1, sgn * 1], [hl - 4, sgn * 7], [hl - 8, sgn * 3], [hl - 12, sgn * 9], [hl - 15, sgn * 4], [hl - 21, sgn * 10], [hl - 18, sgn * 2], [hl - 10, sgn * 0.5]]; poly(c, f, lc); poly(c, f.map(([x, y]) => [x + 1.2, y * 0.6]), '#ffd25a'); } }
      if (st.hood === 'carbon') { const hx0 = hood0, hx1 = hl - 2.5; R(c, '#1b1e22', hx0, -rwL, hx1 - hx0, rwL * 2); for (let x = hx0; x < hx1; x += 1.2) for (let y = -rwL; y < rwL; y += 1.2) if ((Math.round(x / 1.2) + Math.round(y / 1.2)) % 2) R(c, '#2c3137', x, y, 1.2, 1.2); R(c, '#ffffff22', hx0, -rwL, hx1 - hx0, 0.6); }
      c.restore();
      if (st.hood === 'scoop') { RR(c, shade(color, -0.5), hood0 + 4, -3.4, 9, 6.8, 1.6); RR(c, '#0c0e11', hood0 + 10.5, -2.6, 1.8, 5.2, 0.6); R(c, '#ffffff30', hood0 + 4.6, -2.8, 6, 0.6); }
      if (st.hood === 'vented') for (const sgn of [-1, 1]) for (let k = 0; k < 4; k++) R(c, '#0c0e11', hood0 + 4 + k * 1.8, sgn * 4.6 - 1.6, 0.9, 3.2);
    }
    // seams: hood + trunk + doors
    c.strokeStyle = shade(color, -0.4) + 'aa'; c.lineWidth = 0.45;
    if (spec.body !== 'hyper') { c.beginPath(); c.moveTo(xf + wsh + 1.5, -rw + 0.5); c.quadraticCurveTo(xf + wsh + 2.5, 0, xf + wsh + 1.5, rw - 0.5); c.stroke(); }
    if (spec.body !== 'pickup' && spec.body !== 'suv' && spec.body !== 'hyper') { c.beginPath(); c.moveTo(xr - rgl - 1.5, -rw + 0.5); c.quadraticCurveTo(xr - rgl - 2.5, 0, xr - rgl - 1.5, rw - 0.5); c.stroke(); }
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo((xr + xf) / 2, s * (hw - 0.4)); c.lineTo((xr + xf) / 2, s * (rw + 0.4)); c.stroke(); }
    // ---- cabin ----
    if (spec.body === 'hyper') {
      // teardrop canopy + centre fin to the tail
      const can = []; for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2, x = (xr + xf) / 2 + Math.cos(a) * (xf - xr) / 2, y = Math.sin(a) * (rw - (Math.cos(a) < 0 ? 2.2 * -Math.cos(a) : 0)); can.push([x, y]); }
      glass(c, can, xr, xf);
      R(c, shade(color, -0.45), -hl + 3, -0.6, xr + hl - 3, 1.2); R(c, '#ffffff33', -hl + 3, -0.6, xr + hl - 3, 0.4);
      for (const s of [-1, 1]) { R(c, black, xf + 2, s * (hw - 4) - 0.6, hl - xf - 6, 1.2); R(c, black, -hl + 6, s * (hw - 3.5) - 0.5, 14, 1); } // aero channels
    } else {
      // side windows (thin strips along the roof edges)
      for (const s of [-1, 1]) poly(c, [[xr - rgl * 0.6, s * (rw + 0.2)], [xf + wsh * 0.6, s * (rw + 0.2)], [xf + wsh * 0.35, s * (rw + 1.6)], [xr - rgl * 0.35, s * (rw + 1.6)]], '#162636');
      // windshield + rear glass
      if (wsh > 0) glass(c, [[xf, -rw], [xf + wsh, -rw + 1.6], [xf + wsh, rw - 1.6], [xf, rw]], xf, xf + wsh);
      if (rgl > 0) glass(c, [[xr - rgl, -rw + 1.2], [xr, -rw], [xr, rw], [xr - rgl, rw - 1.2]], xr - rgl, xr);
      // roof panel
      const roofCol = spec.body === 'classic' ? '#efe6cc' : spec.body === 'lowrider' ? '#f0e8d8' : shade(color, 0.06);
      RR(c, shade(roofCol, -0.3), xr - 0.2, -rw - 0.2, xf - xr + 0.4, rw * 2 + 0.4, 1.6); RR(c, roofCol, xr, -rw, xf - xr, rw * 2, 1.4);
      const rg = c.createLinearGradient(0, -rw, 0, rw); rg.addColorStop(0, '#ffffff38'); rg.addColorStop(0.5, '#ffffff00'); rg.addColorStop(1, '#00000040'); c.fillStyle = rg; c.fillRect(xr, -rw, xf - xr, rw * 2);
      if (spec.body === 'lowrider') { R(c, '#d8ccb4', xr, -rw, (xf - xr) * 0.55, rw * 2); for (let k = 0; k < 4; k++) R(c, '#c4b698', xr + 1 + k * 2.2, -rw, 0.4, rw * 2); }
      if (spec.body === 'muscle') for (const y0 of [-4.2, 1.2]) R(c, lum(color) > 0.7 ? '#1d2433' : '#f4f1ea', xr, y0, xf - xr, 3);
      if (st?.livery === 'stripes') for (const y0 of [-4.4, 1.4]) R(c, st.liveryColor, xr, y0, xf - xr, 3);
      if (st?.livery === 'racing') { R(c, st.liveryColor, xr, -2.6, xf - xr, 5.2); CIR(c, '#f4f1ea', (xr + xf) / 2, 0, 3.4); c.fillStyle = '#14171c'; c.font = 'bold 4.4px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(((id.length * 7) % 89) + 10), (xr + xf) / 2, 0.3); }
      if (st?.livery === 'split') { c.globalAlpha = 0.9; R(c, st.liveryColor, xr, -rw, Math.max(0, (xr + xf) / 2 - xr), rw * 2); c.globalAlpha = 1; }
      if (spec.body === 'rally') { CIR(c, '#f4f1ea', (xr + xf) / 2, 0, 4); c.strokeStyle = '#1d2433'; c.lineWidth = 0.5; c.beginPath(); c.arc((xr + xf) / 2, 0, 4, 0, Math.PI * 2); c.stroke(); R(c, '#1d2433', (xr + xf) / 2 - 2, -1.6, 1, 3.2); R(c, '#1d2433', (xr + xf) / 2 + 0.6, -1.6, 1.6, 0.8); R(c, '#1d2433', (xr + xf) / 2 + 1.4, -1.6, 0.8, 3.2); RR(c, black, xr + 1, -1.5, 3, 3, 0.8); }
      if (spec.body === 'suv') { for (const s of [-1, 1]) { R(c, '#2a2e33', xr + 1, s * (rw - 1.2) - 0.5, xf - xr - 2, 1); R(c, '#9aa3ab', xr + 1, s * (rw - 1.2) - 0.5, xf - xr - 2, 0.4); } for (const x0 of [xr + 6, xf - 6]) R(c, '#2a2e33', x0, -rw + 1, 1, rw * 2 - 2); }
      if (spec.body === 'gt' || spec.body === 'super') { R(c, '#ffffff22', xr + 1, -rw + 1, xf - xr - 2, 0.6); }
    }
    // ---- nose and tail details ----
    // headlights
    const hx = hl - 3.2;
    if (spec.body === 'classic' || spec.body === 'lowrider') for (const s of [-1, 1]) { CIR(c, '#2a2e33', hx, s * (hw - 4.2), 2.3); CIR(c, '#fff4d0', hx, s * (hw - 4.2), 1.7); CIR(c, '#ffffff', hx + 0.5, s * (hw - 4.6), 0.6); }
    else if (spec.body === 'gt' || spec.body === 'super' || spec.body === 'hyper') for (const s of [-1, 1]) { c.save(); c.translate(hx - 1, s * (hw - 4.5)); c.rotate(s * 0.35); RR(c, '#1a1f26', -2.6, -1.1, 5.2, 2.2, 1); R(c, '#e8f4ff', -2, -0.5, 4.2, 1); c.restore(); }
    else for (const s of [-1, 1]) { RR(c, '#2a2e33', hx - 1, s * (hw - 4.5) - 2.2, 3.4, 4.4, 1); RR(c, '#fff4d0', hx - 0.4, s * (hw - 4.5) - 1.6, 2.2, 3.2, 0.8); R(c, '#ffffff', hx, s * (hw - 4.5) - 1.2, 0.8, 0.8); }
    // taillights
    for (const s of [-1, 1]) { if (spec.body === 'hyper') R(c, '#7a0f18', -hl + 0.6, s * (hw - 3) - (s < 0 ? 0 : 0), 1, s * -(hw - 6)); else RR(c, '#7a0f18', -hl + 0.3, s * (hw - 4.6) - 2, 1.8, 4, 0.6); }
    // grille / bumpers
    if (spec.body === 'classic' || spec.body === 'lowrider' || spec.body === 'muscle') { RR(c, chrome, hl - 1.2, -hw + 3, 1.6, W - 6, 0.8); RR(c, chrome, -hl - 0.4, -hw + 3, 1.6, W - 6, 0.8); R(c, '#ffffff', hl - 0.8, -hw + 4, 0.5, W - 8); }
    else if (spec.body === 'suv' || spec.body === 'pickup') { RR(c, black, hl - 1.5, -hw + 2.5, 2.4, W - 5, 1); RR(c, black, -hl - 0.8, -hw + 2.5, 2.2, W - 5, 1); if (spec.body === 'suv') { for (let k = -2; k <= 2; k++) R(c, '#3a3f45', hl + 0.6, k * 2.4 - 0.4, 1.2, 0.8); } }
    else { R(c, black, hl - 1.6, -4, 1.4, 8); for (let k = -3; k <= 3; k += 1.5) R(c, '#3a3f45', hl - 1.4, k - 0.2, 1, 0.4); }
    // mirrors
    for (const s of [-1, 1]) { RR(c, dark, xf + wsh * 0.25 - 1, s * (hw + 0.6) - 1.2, 2.6, 2.4, 0.8); R(c, color, xf + wsh * 0.25 - 0.6, s * (hw + 0.6) - 0.8, 1.6, 1.6); }
    // ---- body-specific hardware ----
    if (spec.body === 'muscle') { RR(c, black, xf + wsh + 6, -3.2, 9, 6.4, 1.2); R(c, '#3a3f45', xf + wsh + 13, -2.4, 1.2, 4.8); R(c, '#ffffff22', xf + wsh + 6.5, -2.8, 7, 0.6); RR(c, shade(color, -0.3), -hl + 1, -hw + 3, 2.2, W - 6, 0.6); }
    if (spec.body === 'pickup') { const bx0 = -hl + 2, bx1 = xr - rgl - 1.5; RR(c, '#1d2126', bx0, -rw - 0.5, bx1 - bx0, rw * 2 + 1, 1); for (let k = bx0 + 2; k < bx1 - 1; k += 2.4) R(c, '#2c3238', k, -rw + 0.5, 0.8, rw * 2 - 1); RR(c, '#aeb6be', bx1 - 3.4, -rw + 0.3, 2.8, rw * 2 - 0.6, 0.6); R(c, '#ffffff66', bx1 - 3.2, -rw + 0.6, 0.6, rw * 2 - 1.2); R(c, shade(color, -0.35), -hl + 0.8, -rw, 1.2, rw * 2); }
    if (spec.body === 'suv') { CIR(c, '#0c0e11', -hl - 1.4, 0, 4.2); CIR(c, '#2a2e33', -hl - 1.4, 0, 2.6); CIR(c, '#8f979f', -hl - 1.4, 0, 1.2); for (const s of [-1, 1]) for (const x0 of [fx, rx]) RR(c, black, x0 - 6.5, s * (hw - 1.2) - 1, 13, 2, 1); }
    if (spec.body === 'rally') { for (let k = 0; k < 4; k++) { CIR(c, '#1a1f26', hl - 6.5, -5.4 + k * 3.6, 1.5); CIR(c, '#fff4c0', hl - 6.5, -5.4 + k * 3.6, 1.05); } RR(c, black, -hl - 0.4, -hw + 1, 2.6, W - 2, 0.6); R(c, shade(color, -0.2), -hl - 0.2, -hw + 1.2, 2.2, 0.6); for (const s of [-1, 1]) R(c, '#1d2126', rx - tw / 2 - 1.4, s * (hw - 1) - 1, 1, 2); }
    if (spec.body === 'classic') { for (const s of [-1, 1]) { R(c, chrome, -hl + 4, s * (hw - 3.4) - 0.3, L - 10, 0.6); poly(c, [[-hl - 1.6, s * (hw - 1)], [-hl + 7, s * (hw - 0.4)], [-hl + 7, s * (hw - 3)]], shade(color, 0.12)); } }
    if (spec.body === 'lowrider') { for (const s of [-1, 1]) R(c, chrome, -hl + 3, s * (hw - 3.2) - 0.35, L - 7, 0.7); R(c, '#f2c84a', -hl + 3, -0.3, xr - rgl + hl - 5, 0.5); }
    if (spec.body === 'gt') { for (const s of [-1, 1]) for (let k = 0; k < 3; k++) R(c, black, fx - tw / 2 - 3.2 - k * 1.6, s * (hw - 2.2) - 0.9, 0.8, 1.8); for (const s of [-1, 1]) for (const k of [0, 2.2]) CIR(c, '#9aa3ab', -hl - 0.5, s * (3 + k), 0.8); }
    if (spec.body === 'super') {
      for (const s of [-1, 1]) poly(c, [[-12, s * (hw - 0.6)], [-3, s * (hw - 0.6)], [-11, s * (hw - 5.2)]], '#0c0e11');
      for (let k = 0; k < 6; k++) R(c, '#0c0e11', -hl + 6 + k * 2.4, -rw + 1.5, 1.1, rw * 2 - 3);
      RR(c, '#0c0e11', -hl - 1.5, -hw - 1.6, 3.6, W + 3.2, 0.8); R(c, '#3a3f45', -hl - 1.2, -hw - 1.2, 0.8, W + 2.4); for (const s of [-1, 1]) R(c, '#0c0e11', -hl - 2, s * (hw + 0.6) - 1, 5, 2); // wing
      R(c, '#0c0e11', hl - 0.8, -hw + 4, 1.4, W - 8); // splitter
    }
    if (spec.body === 'hyper') { RR(c, '#0c0e11', -hl - 0.8, -hw - 0.8, 3, W + 1.6, 0.8); R(c, '#3a3f45', -hl - 0.5, -hw - 0.4, 0.6, W + 0.8); for (let k = -2; k <= 2; k++) R(c, '#0c0e11', -hl + 3, k * 3 - 0.4, 6, 0.8); }
    if (spec.body === 'sedan') { c.strokeStyle = shade(color, -0.4) + 'aa'; c.lineWidth = 0.45; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(xr + 2, s * (hw - 0.4)); c.lineTo(xr + 2, s * (rw + 0.4)); c.stroke(); } for (const s of [-1, 1]) for (const x0 of [(xr + xf) / 2 - 3, xr - 1]) R(c, '#d9dee3', x0, s * (hw - 1.4) - 0.3, 2, 0.6); RR(c, black, hl - 1.2, -hw + 3, 1.6, W - 6, 0.8); RR(c, black, -hl - 0.4, -hw + 3, 1.6, W - 6, 0.8); }
    if (spec.body === 'compact') { RR(c, black, hl - 1, -hw + 3, 1.4, W - 6, 0.7); RR(c, black, -hl - 0.4, -hw + 3, 1.4, W - 6, 0.7); for (const s of [-1, 1]) R(c, '#d9dee3', (xr + xf) / 2 - 2, s * (hw - 1.4) - 0.3, 2, 0.6); }
    if (spec.body === 'van') { for (let k = 0; k < 3; k++) RR(c, shade(color, -0.12), xr + 6 + k * 9, -3, 5, 6, 1); c.strokeStyle = shade(color, -0.45); c.lineWidth = 0.5; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-4, s * (hw - 0.3)); c.lineTo(-4, s * (rw + 0.3)); c.moveTo(-14, s * (hw - 0.3)); c.lineTo(-14, s * (rw + 0.3)); c.stroke(); R(c, '#2a2e33', -12, s * (hw - 0.6) - 0.3, 6, 0.6); } c.beginPath(); c.moveTo(-hl + 0.5, 0); c.lineTo(-hl + 3, 0); c.stroke(); RR(c, black, hl - 1.4, -hw + 2.5, 2.2, W - 5, 1); RR(c, black, -hl - 0.8, -hw + 2.5, 2.2, W - 5, 1); }
    if (spec.body === 'hatch') { R(c, '#0c0e11', xr - 0.6, -rw + 0.5, 1.2, rw * 2 - 1); RR(c, black, hl - 1.2, -hw + 2.5, 1.8, W - 5, 0.8); RR(c, black, -hl - 0.6, -hw + 2.5, 1.8, W - 5, 0.8); }
    if (st) {
      if (st.exhaust === 'twin') for (const sgn of [-1, 1]) { CIR(c, '#5a6168', -hl - 0.4, sgn * (hw - 6.5), 1.3); CIR(c, '#d9e0e6', -hl - 0.4, sgn * (hw - 6.5), 0.9); CIR(c, '#0c0e11', -hl - 0.6, sgn * (hw - 6.5), 0.5); }
      if (st.exhaust === 'quad') for (const sgn of [-1, 1]) for (const d of [0, 2.6]) { CIR(c, '#5a6168', -hl - 0.4, sgn * (hw - 5.5 - d), 1.1); CIR(c, '#d9e0e6', -hl - 0.4, sgn * (hw - 5.5 - d), 0.75); CIR(c, '#0c0e11', -hl - 0.6, sgn * (hw - 5.5 - d), 0.4); }
      if (st.exhaust === 'side') { CIR(c, '#5a6168', -hl - 0.6, 0, 2.1); CIR(c, '#e4eaef', -hl - 0.6, 0, 1.6); CIR(c, '#0c0e11', -hl - 0.8, 0, 0.9); }
      const rwS = hw - ins;
      if (st.spoiler === 'lip') { RR(c, shade(color, -0.45), -hl + 0.3, -rwS - 1, 1.4, rwS * 2 + 2, 0.5); R(c, '#ffffff30', -hl + 0.6, -rwS - 0.6, 0.4, rwS * 2 + 1.2); }
      if (st.spoiler === 'ducktail') { RR(c, shade(color, -0.35), -hl - 1.2, -rwS - 1.5, 3, rwS * 2 + 3, 1.2); RR(c, color, -hl - 0.8, -rwS - 1, 2.2, rwS * 2 + 2, 1); R(c, '#ffffff40', -hl - 0.4, -rwS - 0.6, 0.5, rwS * 2 + 1.2); }
      if (st.spoiler === 'wing' || st.spoiler === 'gt') { const big = st.spoiler === 'gt', ww = big ? W + 3 : W - 2, x0 = -hl - (big ? 3.4 : 2.2);
        for (const sgn of [-1, 1]) R(c, '#0c0e11', -hl + 0.5, sgn * (rwS - 2.5) - 0.5, big ? 3 : 2.2, 1);
        RR(c, '#06080a', x0 - 0.4, -ww / 2 - 0.4, (big ? 4.4 : 3.2) + 0.8, ww + 0.8, 0.8); RR(c, big ? '#1b1f24' : shade(color, -0.25), x0, -ww / 2, big ? 4.4 : 3.2, ww, 0.6); R(c, '#ffffff38', x0 + 0.4, -ww / 2 + 0.6, 0.6, ww - 1.2);
        if (big) for (const sgn of [-1, 1]) RR(c, '#0c0e11', x0 - 0.8, sgn * (ww / 2) - (sgn > 0 ? 0 : 1.4), 6, 1.4, 0.4); }
    }
    bakeStyle = null;
    return { cv, w: L + pad * 2, h: W + pad * 2, L, W };
  }
  const cache = new Map();
  const SK = () => root.NightshiftCarStyleData;
  function sprite(id, color, st = null) { const k = id + color + (st && SK() ? '|' + SK().keyOf(st) : ''); let s = cache.get(k); if (!s) { if (cache.size > 120) cache.delete(cache.keys().next().value); s = bake(id, color, st); cache.set(k, s); } return s; }

  // Live draw on the game context (car faces +x like the base game).
  const prevSpeed = new WeakMap();
  const LIGHT = { stock: '#fff4c8', xenon: '#eaf6ff', amber: '#ffc46b', ice: '#9fdcff' };
  function draw(v, ctx = G(), opts = null) {
    const spec = D.fromModel(v.model) || (styleBase && typeof v.model !== 'string' || styleBase && BASE[v.model] ? BASE[v.model] || BASE.SEDAN : null); if (!spec || !ctx) return false;
    const st = opts?.style || root.NightshiftCarStyle?.of?.(v.id) || null;
    const sp = sprite(spec.id, /^#[0-9a-f]{6}$/i.test(v.color || '') ? v.color : spec.colors[0] || '#8a9aa8', st), t = performance.now() / 1000;
    const p = P(), active = p?.car === v, ps = prevSpeed.get(v) ?? 0, sp0 = v.speed || 0; prevSpeed.set(v, sp0);
    const braking = active && Math.abs(sp0) < Math.abs(ps) - 0.04, night = opts?.night ?? (root.NightshiftEnvironment?.darkness?.(root.NightshiftEnvironment?.state?.minute ?? 720) || 0) > 0.35;
    try { if (ctx === G()) root.NightshiftEnvironment?.headlights?.(v); } catch { /* optional */ }
    if (st && st.glow !== 'none') { ctx.save(); ctx.translate(Math.round(v.x), Math.round(v.y)); ctx.rotate(v.angle || 0); ctx.globalCompositeOperation = 'lighter'; const L2 = (spec.len || 56) / 2 + 6, W2 = (spec.wid || 30) / 2 + 6, gl = ctx.createRadialGradient(0, 0, 4, 0, 0, L2); gl.addColorStop(0, st.glow + (night ? 'aa' : '55')); gl.addColorStop(1, st.glow + '00'); ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(0, 0, L2, W2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.translate(Math.round(v.x), Math.round(v.y)); ctx.rotate(v.angle || 0);
    ctx.fillStyle = '#101d2840'; ctx.beginPath(); ctx.ellipse(3, 5, sp.L / 2 + 3, sp.W / 2 + 4, 0, 0, Math.PI * 2); ctx.fill();
    const lowHop = spec.body === 'lowrider' && v.speed === 0 && !active ? Math.max(0, Math.sin(t * 2.4 + v.x)) * 1.2 : 0;
    const prevSm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(sp.cv, -sp.w / 2, -sp.h / 2 - lowHop, sp.w, sp.h); ctx.imageSmoothingEnabled = prevSm;
    const hl = sp.L / 2, hw = sp.W / 2;
    // brake / tail glow
    if (braking || (night && (active || v.owned))) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = braking ? '#ff3040cc' : '#ff304055'; for (const s of [-1, 1]) ctx.fillRect(-hl - 1, s * (hw - 4.6) - 2.2, 2.6, 4.4); if (braking) { ctx.fillStyle = '#ff304033'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(-hl - 2, s * (hw - 4.6), 6, 0, Math.PI * 2); ctx.fill(); } } ctx.restore(); }
    if (night) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = (LIGHT[st?.lights] || LIGHT.stock) + (st && st.lights !== 'stock' ? '99' : '55'); for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hl - 2, s * (hw - 4.5), 3.4, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
    if (spec.body === 'hyper') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const pulse = 0.55 + 0.45 * Math.sin(t * 3); ctx.fillStyle = `rgba(80,220,255,${0.5 + 0.3 * pulse})`; for (const s of [-1, 1]) { ctx.save(); ctx.translate(hl - 4, s * (hw - 5)); ctx.rotate(s * 0.45); ctx.fillRect(-4, -0.4, 6, 0.8); ctx.restore(); } ctx.fillStyle = `rgba(255,60,80,${0.5 + 0.3 * pulse})`; ctx.fillRect(-hl + 0.2, -hw + 3, 0.9, sp.W - 6); ctx.restore(); }
    // wear: scuffs and a cracked light once it's beaten up
    const cond = v.condition ?? 100;
    if (cond < 55) { ctx.fillStyle = '#00000040'; const n = cond < 30 ? 7 : 3; for (let k = 0; k < n; k++) { const a = (k * 2.39 + (v.uid || 1)) % 6.28; ctx.fillRect(Math.cos(a) * hl * 0.7, Math.sin(a) * hw * 0.6, 3 + (k % 3), 1); } if (cond < 30) { ctx.fillStyle = '#c9d1d6'; ctx.fillRect(hl - 3, hw - 6, 1, 1); ctx.fillRect(hl - 2, hw - 5, 1, 1); } }
    ctx.restore();
    return true;
  }
  // Portrait for panels: car pointing up, on a turntable glow.
  function portrait(id, color, w = 120, h = 84, st = null) {
    const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; cv.style.cssText = `width:${w}px;height:${h}px;flex:none;border-radius:12px;background:radial-gradient(ellipse at 50% 60%,#2a3646,#0b0f16 70%)`;
    const x = cv.getContext('2d'), sp = sprite(id, color, st), k = Math.min((h * 2 - 12) / sp.w, (w * 2 - 12) / sp.h) * 1.0;
    x.fillStyle = '#00000055'; x.beginPath(); x.ellipse(w + 4, h + 8, sp.h * k / 2 + 2, sp.w * k / 2 + 2, 0, 0, Math.PI * 2); x.fill();
    x.translate(w, h); x.rotate(-Math.PI / 2); x.imageSmoothingEnabled = true; x.drawImage(sp.cv, -sp.w * k / 2, -sp.h * k / 2, sp.w * k, sp.h * k);
    return cv;
  }

  // ---------------- city cars ----------------
  const live = new Map(); // uid -> car object
  let rare = null; // { car, window }
  function spot(x0, y0) {
    const geo = root.NightshiftVehicleGeometry, list = CARS();
    for (let r = 0; r < 420; r += 22) for (let a = 0; a < 12; a++) {
      const x = x0 + Math.cos(a * 0.52) * r, y = y0 + Math.sin(a * 0.52) * r, c = { x, y, angle: Math.PI / 2 };
      if (x < 60 || y < 60 || x > WORLD().w - 60 || y > WORLD().h - 60) continue;
      try { if (geo?.blocked(c, BLD(), WORLD())) continue; } catch { /* no geometry */ }
      if (list.some((o) => Math.hypot(o.x - x, o.y - y) < 70)) continue;
      return { x, y };
    }
    return { x: x0, y: y0 };
  }
  function makeCar(rec) {
    return { id: 'cx-' + rec.uid, uid: rec.uid, cx: rec.id, model: D.modelName(rec.id), color: rec.color, x: rec.x, y: rec.y, angle: rec.angle || 0, speed: 0, fuel: rec.fuel ?? 100, condition: rec.condition ?? 100, owned: true, stolen: false };
  }
  function install() {
    const list = CARS(); if (!Array.isArray(list) || !P()) return false;
    for (const rec of state.owned) {
      if (live.has(rec.uid)) continue;
      if (!Number.isFinite(rec.x)) { const s = spot(880, 760); rec.x = s.x; rec.y = s.y; rec.angle = Math.PI / 2; }
      const car = makeCar(rec); list.push(car); live.set(rec.uid, car);
    }
    return true;
  }
  function sync() {
    for (const rec of state.owned) { const c = live.get(rec.uid); if (!c) continue; rec.x = c.x; rec.y = c.y; rec.angle = c.angle; rec.fuel = c.fuel; rec.condition = c.condition; }
    persist();
  }
  function remove(car) { const list = CARS(), i = list.indexOf(car); if (i >= 0) list.splice(i, 1); const p = P(); if (p?.car === car) p.car = null; }
  // Rare model of the window, parked on a road somewhere quiet.
  const RARE_SPOTS = [[462, 300], [902, 1180], [1342, 260], [1782, 900], [700, 362], [1500, 1382], [418, 1100], [1100, 702], [1980, 362], [262, 1382]];
  function rareTick() {
    const r = D.rareFor(Date.now(), RARE_SPOTS.length), p = P(); if (!p) return;
    if (rare && rare.window !== r.window) { const c = rare.car; if (!c.stolen && p.car !== c) remove(c); rare = null; }
    if (!rare) {
      const [x0, y0] = RARE_SPOTS[r.spot], s = spot(x0, y0), spec = D.BY[r.id];
      const car = { id: 'cxr-' + r.window, cx: r.id, model: D.modelName(r.id), color: r.color, x: s.x, y: s.y, angle: Math.PI / 2, speed: 0, fuel: 60, condition: 85 + Math.round(Math.random() * 15), owned: false, stolen: false, rare: true };
      CARS().push(car); rare = { car, window: r.window, spec };
      if (!state.seen['rare-' + r.window]) { try { root.NightshiftLife?.text?.('rico', `Yo, somebody left a ${spec.name} parked out on the street. Nobody's watching it. Rusty would kill for that. (Check 📱 → 🚗 MY CARS for the GPS)`); } catch { /* optional */ } }
    }
  }
  // Rusty re-VINned a car: if it's one of ours (rare model), it joins the collection.
  function adopt(car) {
    if (!car?.cx || car.uid) return false;
    const rec = D.add(state, car.cx, car.color); rec.x = car.x; rec.y = car.y; rec.angle = car.angle; rec.condition = car.condition;
    car.id = 'cx-' + rec.uid; car.uid = rec.uid; car.rare = false; car.owned = true; car.stolen = false; live.set(rec.uid, car); if (rare?.car === car) rare = null;
    checkMilestones(); persist(); return true;
  }
  // A car went through the crusher: rare ones vanish, owned collection cars leave the list.
  function retire(car) {
    if (!car?.cx) return false;
    if (rare?.car === car) rare = null;
    if (car.uid) { state.owned = state.owned.filter((o) => o.uid !== car.uid); live.delete(car.uid); }
    remove(car); persist(); return true;
  }
  function checkMilestones() {
    const p = P(); if (!p) return;
    for (const m of D.milestones(state, p)) { say(`🏆 COLLECTION · ${m.n} different models · "${m.title}" · +${money(m.cash)}`); try { root.NightshiftAudio?.play('pickup'); } catch { /* optional */ } }
  }

  // Handling + armor for collection models. MODELS[0] is the spec used for ids without a number (cx-…), so we lend it ours.
  function wrapVehicles() {
    const V = root.NightshiftVehicles; if (!V || V.__cars || typeof V.handling !== 'function') return !!V?.__cars;
    const handling = V.handling, M = V.MODELS?.[0];
    V.handling = function (car) {
      const spec = car && D.fromModel(car.model); if (!spec || !M) return handling.apply(this, arguments);
      const keep = { accel: M.accel, max: M.max, steer: M.steer }; M.accel = spec.accel; M.max = spec.max; M.steer = spec.steer;
      try { return handling.apply(this, arguments); } finally { Object.assign(M, keep); }
    };
    const armored = (fn) => function (car) { const spec = car && D.fromModel(car.model), c0 = car?.condition; const r = fn.apply(this, arguments); if (spec && Number.isFinite(c0) && car.condition < c0) car.condition = c0 - (c0 - car.condition) / spec.armor; return r; };
    if (typeof V.damage === 'function') V.damage = armored(V.damage); if (typeof V.hit === 'function') V.hit = armored(V.hit);
    V.__cars = true; return true;
  }
  function wrapSprites() {
    const S = root.NightshiftSprites; if (!S || S.__cars || typeof S.car !== 'function') return !!S?.__cars;
    const car = S.car; S.car = function (v) { if (v && ((typeof v.model === 'string' && v.model.startsWith(D.MODEL_PREFIX)) || styleBase)) { try { if (draw(v)) return; } catch (e) { console.error(e); } } return car.apply(this, arguments); };
    S.__cars = true; return true;
  }
  wrapSprites();
  const boot = setInterval(() => { const a = wrapVehicles(), b = wrapSprites(), c = install(); if (a && b && c) { clearInterval(boot); setInterval(sync, 4000); setInterval(rareTick, 3000); rareTick(); } }, 300);
  addEventListener('pagehide', sync);

  // ---------------- panels ----------------
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const pnl = el('div', { id: 'cxPanel', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Cars' }); document.body.append(pnl);
  document.head.append(el('style', {}, `
  #cxPanel .tabs{display:flex;gap:6px;margin:6px 0 10px} #cxPanel .tabs button{padding:7px 12px;background:#ffffff10;border:1px solid #ffffff22;color:#cfe0f2} #cxPanel .tabs button.on{background:linear-gradient(180deg,#ffd970,#c99a2a);color:#1b1408}
  #cxPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
  #cxPanel .car{display:flex;gap:10px;align-items:center;padding:8px;border-radius:14px;background:#ffffff07;border:1px solid #ffffff14}
  #cxPanel .car.locked canvas{filter:brightness(0) opacity(.5)} #cxPanel .car .m{flex:1;min-width:0} #cxPanel .car b{font:700 13px var(--disp,system-ui);display:block}
  #cxPanel .tier{display:inline-block;font:700 9px var(--disp,system-ui);letter-spacing:.12em;padding:1px 6px;border-radius:6px;background:#ffffff14;color:#ffd970;margin-bottom:2px}
  #cxPanel .st{display:grid;grid-template-columns:52px 1fr;gap:1px 6px;font-size:10px;color:#8fa6c0;margin:4px 0}
  #cxPanel .st i{display:block;height:5px;border-radius:3px;background:#ffffff14;margin-top:4px;overflow:hidden} #cxPanel .st i u{display:block;height:100%;background:linear-gradient(90deg,#7cc7ff,#7cdeb5)}
  #cxPanel .sw{display:flex;gap:4px;margin:4px 0} #cxPanel .sw button{width:18px;height:18px;border-radius:50%;border:2px solid #ffffff33} #cxPanel .sw button.on{border-color:#ffd970}
  #cxPanel .go{background:linear-gradient(180deg,#7cdeb5,#2f9f7a);color:#06140f;padding:8px 10px} #cxPanel .ghost{background:#ffffff12;border:1px solid #ffffff22;padding:7px 9px;color:#cfe0f2}
  #cxPanel .rare{border-color:#ffd97066;background:linear-gradient(135deg,#2a2210,#141a24)}`));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pnl.hidden) { pnl.hidden = true; e.stopImmediatePropagation(); } }, true);
  const btn = (cls, txt, fn, dis) => { const x = el('button', { className: cls, type: 'button', disabled: !!dis }, txt); x.onclick = fn; return x; };
  function head(title, sub) { try { root.releaseControls?.(); } catch { /* n/a */ } pnl.hidden = false; pnl.textContent = ''; const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { pnl.hidden = true; }; top.append(el('h2', {}, title), x); pnl.append(top); if (sub) pnl.append(el('div', { className: 'sub' }, sub)); }
  function statBars(spec) { const s = D.stats(spec), box = el('div', { className: 'st' }); for (const [k, v] of [['SPEED', s.speed], ['ACCEL', s.accel], ['HANDLING', s.handling], ['ARMOR', s.armor]]) { const i = el('i'), u = el('u'); u.style.width = `${Math.round(Math.max(0.06, Math.min(1, v)) * 100)}%`; i.append(u); box.append(el('span', {}, k), i); } return box; }
  const gps = (x, y, label) => { try { root.NightshiftMap?.navigate?.({ x, y, label }); say(`📍 GPS set · ${label}`); } catch { /* optional */ } };
  const mult = () => { try { return root.NightshiftSkills?.mod?.('charisma.shopPrice') ?? 1; } catch { return 1; } };
  let tab = 'garage';
  function open(which) {
    if (which) tab = which; sync();
    const n = D.models(state).size, ttl = D.title(state);
    head('🚗 MY CARS', `${state.owned.length} car${state.owned.length === 1 ? '' : 's'} · ${n}/${D.CARS.length} models collected · collection score ${D.score(state)}${ttl ? ` · "${ttl}"` : ''}`);
    const tabs = el('div', { className: 'tabs' }); for (const [k, t] of [['garage', 'GARAGE'], ['book', 'COLLECTION BOOK']]) tabs.append(btn(tab === k ? 'on' : '', t, () => open(k))); pnl.append(tabs);
    if (rare && !rare.car.stolen && !rare.car.owned) {
      const c = rare.car, row = el('div', { className: 'car rare' }), m = el('div', { className: 'm' });
      m.append(el('span', { className: 'tier' }, 'RARE SIGHTING'), el('b', {}, `${rare.spec.name} parked on the street`), el('div', { style: 'color:#a9b8ca;font-size:11px' }, `Gone in ${Math.ceil((D.rareFor().until - Date.now()) / 60000)} min. Steal it (hold USE), then Rusty can re-VIN it for ${money(Math.round(rare.spec.chop * 0.6))} so it's yours, or chop it for ~${money(rare.spec.chop)}.`));
      m.append(btn('go', '📍 GPS', () => { gps(c.x, c.y, `🚗 ${rare.spec.name}`); pnl.hidden = true; }));
      row.append(portrait(rare.spec.id, c.color, 110, 70), m); pnl.append(row, el('div', { style: 'height:8px' }));
    }
    if (tab === 'garage') {
      if (!state.owned.length) pnl.append(el('div', { className: 'sub' }, 'No collection cars yet. Prestige Motors in Palm Grove (🚌 bus) sells them, or lift a rare one off the street.'));
      const grid = el('div', { className: 'grid' });
      for (const rec of state.owned) {
        const spec = D.BY[rec.id], car = live.get(rec.uid), row = el('div', { className: 'car' }), m = el('div', { className: 'm' });
        m.append(el('span', { className: 'tier' }, spec.tier.toUpperCase()), el('b', {}, spec.name), el('div', { style: 'color:#a9b8ca;font-size:11px' }, `Plate ${rec.plate} · body ${Math.round(car?.condition ?? rec.condition)}% · fuel ${Math.round(car?.fuel ?? rec.fuel)}%`));
        const acts = el('div', { style: 'display:flex;gap:5px;margin-top:5px;flex-wrap:wrap' });
        acts.append(btn('go', '📍 FIND', () => { if (car) { gps(car.x, car.y, `🚗 ${spec.name}`); pnl.hidden = true; } }), btn('ghost', `SELL ${money(D.resale(rec))}`, () => { if (P()?.car === car) { say('Get out of it first'); return; } if (root.confirm?.(`Sell the ${spec.name} for ${money(D.resale(rec))}?`) === false) return; const r = D.sell(state, P(), rec.uid); if (r.ok) { if (car) remove(car); live.delete(rec.uid); persist(); gameSave(); say(`🚗 Sold the ${spec.name} · +${money(r.cash)}`); } open(); }));
        if (root.NightshiftCarStyle) acts.append(btn('ghost', '🎨 STYLE', () => { if (car) { pnl.hidden = true; root.NightshiftCarStyle.open(car, 'view'); } }));
        m.append(acts); row.append(portrait(rec.id, rec.color, 104, 70, root.NightshiftCarStyle?.of?.('cx-' + rec.uid) || null), m); grid.append(row);
      }
      pnl.append(grid);
      pnl.append(el('div', { className: 'sub', style: 'margin-top:8px' }, 'Your collection cars park where you leave them. Tune them at any GARAGE, fit body kits at Prestige Motors, and show up to four off in your dream house garage.'));
    } else {
      const grid = el('div', { className: 'grid' }), have = D.models(state);
      for (const spec of D.CARS) {
        const own = have.has(spec.id), row = el('div', { className: 'car' + (own || state.seen[spec.id] ? '' : ' locked') }), m = el('div', { className: 'm' });
        m.append(el('span', { className: 'tier' }, `${spec.tier.toUpperCase()}${spec.rare ? ' · RARE' : ''}`), el('b', {}, own || state.seen[spec.id] ? spec.name : '???'), el('div', { style: 'color:#a9b8ca;font-size:11px' }, own ? `✅ In your collection · ${money(spec.price)}` : `${money(spec.price)} at Prestige Motors${spec.rare ? ' · or steal one' : ''}`));
        m.append(statBars(spec)); row.append(portrait(spec.id, spec.colors[0], 104, 70), m); grid.append(row);
      }
      pnl.append(grid);
      const ms = el('div', { className: 'sub', style: 'margin-top:8px' }); ms.textContent = 'Milestones (different models): ' + D.MILESTONES.map((m) => `${state.paid.includes(m.n) ? '✅' : '▫️'} ${m.n} → "${m.title}" ${money(m.cash)}`).join(' · '); pnl.append(ms);
    }
  }
  // Dealer (Prestige Motors, Palm Grove). Pick paint, buy, delivered to your apartment's curb.
  const pick = {};
  function openDealer() {
    const p = P();
    head('🏎️ PRESTIGE MOTORS · SHOWROOM', `Delivered to the curb by your Midtown apartment. Charisma gets you a better price. Cash ${money(p?.cash || 0)}`);
    const grid = el('div', { className: 'grid' });
    for (const spec of D.CARS) {
      const col = pick[spec.id] || spec.colors[0], price = D.priceOf(spec.id, mult()), row = el('div', { className: 'car' }), m = el('div', { className: 'm' });
      m.append(el('span', { className: 'tier' }, spec.tier.toUpperCase()), el('b', {}, spec.name), el('div', { style: 'color:#a9b8ca;font-size:11px' }, spec.desc), statBars(spec));
      const sw = el('div', { className: 'sw' }); for (const cc of spec.colors) { const b = btn(cc === col ? 'on' : '', '', () => { pick[spec.id] = cc; openDealer(); }); b.style.background = cc; b.ariaLabel = 'Paint ' + cc; sw.append(b); } m.append(sw);
      m.append(btn('go', `BUY · ${money(price)}`, () => { const r = D.buy(state, P(), spec.id, col, mult()); if (!r.ok) { say(r.reason); return; } install(); const car = live.get(r.car.uid); persist(); gameSave(); checkMilestones(); try { root.NightshiftSkills?.gain('charisma', 40, 'car'); } catch { /* optional */ } say(`🔑 ${spec.name} bought · it's parked outside your Midtown apartment`); if (car) try { root.NightshiftMap?.navigate?.({ x: car.x, y: car.y, label: `🚗 ${spec.name}` }); } catch { /* optional */ } openDealer(); }, (p?.cash || 0) < price));
      row.append(portrait(spec.id, col, 104, 70), m); grid.append(row);
    }
    pnl.append(grid);
  }

  root.NightshiftCars = Object.freeze({ setStyleBase: (on) => { styleBase = !!on; }, get styleBase() { return styleBase; }, get state() { return state; }, open, openDealer, draw, portrait, sprite, retire, adopt, rare: () => rare?.car || null, live: () => [...live.values()], paused: () => !pnl.hidden, sync });
})(typeof globalThis !== 'undefined' ? globalThis : this);
