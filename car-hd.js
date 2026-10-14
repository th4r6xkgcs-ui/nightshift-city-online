/* HD top-down cars (Claude-owned, v0.68). Replaces cars.js's flat code-drawn bodies with a sculpted look:
 * curved silhouettes per body family (fender flares, pinched waists, tapered noses), cylinder shading with a
 * top-left key light, fender bulges, hood creases, clear-coat reflection bands, a real greenhouse (curved
 * windshield, side glass, rear glass, roof panel with specular), LED/round/slim headlights, full-width tail bars,
 * grilles, splitters, diffusers, exhaust tips, mirrors, door shut lines and handles, plus each body's signature
 * pieces (muscle stripes + scoop, rally light pod, SUV rails + spare, pickup bed, lowrider pinstripes, super side
 * intakes + engine louvres, hypercar canopy). Car-style options (livery, hood, spoiler, exhaust, rims, tint, finish)
 * and the per-model SIG details from cars.js keep working.
 * Installed by cars.js: NightshiftCarHD.bake(ctx) is called with cars.js internals; returns the same sprite record. */
(function (root) {
  'use strict';
  // half-width profile (fraction of half-width) from tail x=-1 to nose x=+1
  const P = {
    hatch: [[-1, .84], [-.97, .96], [-.86, 1], [-.6, 1], [-.38, .92], [.3, .92], [.56, .99], [.8, .97], [.94, .84], [1, .66]],
    compact: [[-1, .84], [-.97, .96], [-.86, 1], [-.6, 1], [-.36, .95], [.3, .95], [.56, .99], [.8, .97], [.94, .86], [1, .66]],
    sedan: [[-1, .8], [-.97, .94], [-.84, 1], [-.56, .99], [-.32, .92], [.3, .92], [.58, .99], [.84, .96], [.96, .82], [1, .6]],
    coupe: [[-1, .72], [-.95, .92], [-.78, 1], [-.56, 1], [-.36, .86], [.14, .84], [.46, .95], [.72, .95], [.92, .78], [1, .5]],
    gt: [[-1, .7], [-.95, .9], [-.8, 1], [-.58, 1], [-.4, .86], [.08, .83], [.46, .95], [.78, .93], [.95, .74], [1, .44]],
    rally: [[-1, .8], [-.97, .95], [-.84, 1], [-.58, 1], [-.36, .89], [.26, .89], [.56, .99], [.82, .97], [.95, .82], [1, .6]],
    muscle: [[-1, .86], [-.98, .97], [-.88, 1], [-.5, 1], [-.2, .97], [.5, .97], [.86, 1], [.96, .94], [1, .8]],
    super: [[-1, .84], [-.97, .98], [-.78, 1], [-.52, 1], [-.32, .84], [.1, .8], [.42, .88], [.68, .84], [.9, .64], [1, .36]],
    hyper: [[-1, .8], [-.96, .96], [-.75, 1], [-.5, .98], [-.25, .88], [.2, .84], [.5, .86], [.78, .75], [.94, .54], [1, .3]],
    suv: [[-1, .9], [-.985, .98], [-.93, 1], [.88, 1], [.97, .96], [1, .86]],
    pickup: [[-1, .92], [-.985, .99], [-.95, 1], [.9, 1], [.975, .96], [1, .86]],
    van: [[-1, .94], [-.99, 1], [.92, 1], [.985, .95], [1, .86]],
    classic: [[-1, .86], [-.985, 1], [-.75, 1], [-.5, .97], [.5, .97], [.86, .95], [.97, .88], [1, .74]],
    lowrider: [[-1, .86], [-.985, 1], [-.75, 1], [-.5, .96], [.5, .96], [.86, .95], [.97, .88], [1, .72]],
  };
  const SPORT = { coupe: 1, gt: 1, super: 1, hyper: 1, rally: 1 };
  function curve(pts, hl, hw) { // Catmull-Rom through the profile, top half (y negative), then mirrored
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let t = 0; t < 1; t += 0.2) { const t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); out.push([f(p0[0], p1[0], p2[0], p3[0]) * hl, -Math.min(1, f(p0[1], p1[1], p2[1], p3[1])) * hw]); }
    }
    out.push([pts[pts.length - 1][0] * hl, -pts[pts.length - 1][1] * hw]);
    const bottom = out.slice().reverse().map(([x, y]) => [x, -y]);
    return [[out[0][0], 0], ...out, ...bottom];
  }
  const rgba = (h, a) => { const n = parseInt(String(h).slice(1, 7), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

  function bake(K) {
    const { id, color, st, spec, B0, BODY, SIG, RIMS, shade, lum, R, RR, CIR, poly } = K;
    const body = spec.body, L = spec.len, W = spec.wid, S = K.base ? 3 : 4, pad = 6, hl = L / 2, hw = W / 2;
    const cv = document.createElement('canvas'); cv.width = (L + pad * 2) * S; cv.height = (W + pad * 2) * S;
    const c = cv.getContext('2d'); c.scale(S, S); c.translate(hl + pad, hw + pad); c.lineJoin = 'round'; c.lineCap = 'round';
    const sx = L / (B0.shape.at(-1)[0] * 2), xr = B0.xr * sx, xf = B0.xf * sx, wsh = B0.wsh * sx, rgl = B0.rgl * sx, ins = B0.ins, rw = hw - ins;
    const fx = L * B0.wb, rx = -L * B0.wb, [tw, th] = B0.tire, sport = !!SPORT[body], wide = body === 'super' || body === 'hyper';
    const pts = curve(P[body] || P.sedan, hl, hw), dark = shade(color, -0.62), deep = shade(color, -0.32), lite = shade(color, 0.28), black = '#101317', chrome = '#e4eaef', L0 = lum(color);
    const path = (p) => { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
    const rim = st && RIMS[st.rims] ? RIMS[st.rims] : body === 'lowrider' ? '#e8c45a' : wide ? '#c9cfd6' : body === 'classic' ? '#f1efe8' : '#9aa3ab';
    // ---- contact shadow (soft, layered) ----
    for (let k = 3; k >= 0; k--) { c.save(); c.translate(1.2 + k * 0.5, 1.8 + k * 0.6); c.scale(1 + k * 0.025, 1 + k * 0.05); path(pts); c.fillStyle = `rgba(0,0,0,${0.12 + (3 - k) * 0.05})`; c.fill(); c.restore(); }
    // ---- tyres (peek out under the arches) ----
    for (const s of [-1, 1]) for (const [x0, rear] of [[fx, 0], [rx, 1]]) {
      const tw2 = tw + (wide && rear ? 1.5 : 0), th2 = th + (wide && rear ? 1.2 : 0), y0 = s * (hw - th2 * 0.38 + (sport ? 0.9 : 0.35));
      RR(c, '#040506', x0 - tw2 / 2 - 0.3, y0 - th2 / 2 - 0.3, tw2 + 0.6, th2 + 0.6, 2); RR(c, '#0b0d10', x0 - tw2 / 2, y0 - th2 / 2, tw2, th2, 1.8);
      for (let k = -tw2 / 2 + 1.2; k < tw2 / 2 - 1; k += 1.6) R(c, '#1c2026', x0 + k, y0 - th2 / 2 + 0.3, 0.7, th2 - 0.6);
      R(c, rim, x0 - tw2 / 2 + 2, y0 + s * (th2 / 2 - 1.1) - 0.5, tw2 - 4, 1); R(c, '#ffffff70', x0 - tw2 / 2 + 2.5, y0 + s * (th2 / 2 - 1.1) - 0.5, tw2 * 0.3, 0.4);
    }
    // ---- body ----
    path(pts); c.fillStyle = color; c.fill();
    c.save(); path(pts); c.clip();
    if (st && st.finish && st.finish !== 'gloss') { const F = st.finish; if (F === 'matte' || F === 'satin') { c.fillStyle = F === 'matte' ? '#0000001c' : '#0000000c'; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4); } }
    // cylinder shading across, key light top-left
    let g = c.createLinearGradient(0, -hw, 0, hw); g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(0.07, 'rgba(255,255,255,0.08)'); g.addColorStop(0.2, 'rgba(255,255,255,0.26)'); g.addColorStop(0.36, 'rgba(255,255,255,0.07)'); g.addColorStop(0.62, 'rgba(0,0,0,0.04)'); g.addColorStop(0.86, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = g; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4);
    { const kg = c.createLinearGradient(0, -hw, 0, -hw * 0.3); kg.addColorStop(0, 'rgba(255,255,255,0)'); kg.addColorStop(0.45, 'rgba(255,255,255,0.32)'); kg.addColorStop(0.62, 'rgba(255,255,255,0.05)'); kg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = kg; c.fillRect(-hl * 0.9, -hw, L * 0.9, hw * 0.7); }
    g = c.createLinearGradient(-hl, 0, hl, 0); g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(0.06, 'rgba(0,0,0,0)'); g.addColorStop(0.9, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); c.fillStyle = g; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4);
    // fender bulges over each wheel
    for (const s of [-1, 1]) for (const x0 of [fx, rx]) { const gy = s * (hw - 2.2), r0 = tw * (sport ? 0.95 : 0.8); const fg = c.createRadialGradient(x0 - 1, gy - s * 0.6, 0.5, x0, gy, r0); fg.addColorStop(0, s < 0 ? `rgba(255,255,255,${x0 < 0 ? 0.26 : 0.14})` : 'rgba(255,255,255,0.06)'); fg.addColorStop(0.55, 'rgba(255,255,255,0.05)'); fg.addColorStop(1, 'rgba(0,0,0,0.16)'); c.fillStyle = fg; c.beginPath(); c.ellipse(x0, gy, r0, r0 * 0.62, 0, 0, Math.PI * 2); c.fill(); }
    // waist shadow between arches (doors sit lower)
    for (const s of [-1, 1]) { const wg = c.createLinearGradient(0, s * hw, 0, s * (hw - 3)); wg.addColorStop(0, 'rgba(0,0,0,0.3)'); wg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = wg; c.fillRect(rx + tw * 0.7, s > 0 ? hw - 3 : -hw, fx - rx - tw * 1.4, 3); }
    // hood creases + power bulge (sport/muscle)
    const hood0 = xf + wsh + 1.2;
    if (body !== 'hyper' && body !== 'van') {
      for (const s of [-1, 1]) { c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 0.45; c.beginPath(); c.moveTo(hood0 + 1, s * rw * 0.62); c.quadraticCurveTo((hood0 + hl) / 2, s * rw * 0.5, hl - 3, s * rw * 0.42); c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(hood0 + 1, s * rw * 0.62 - 0.5); c.quadraticCurveTo((hood0 + hl) / 2, s * rw * 0.5 - 0.5, hl - 3, s * rw * 0.42 - 0.5); c.stroke(); }
    }
    // body-colour liveries / stripes (under the glass)
    if (body === 'muscle' && spec.stripes !== false) for (const y0 of [-4.2, 1.2]) { R(c, L0 > 0.7 ? '#1d2433' : '#f4f1ea', -hl, y0, L, 3); R(c, 'rgba(0,0,0,0.12)', -hl, y0 + 2.4, L, 0.6); }
    if (body === 'rally') { const a = L0 > 0.7 ? '#2f6bd0' : '#f4f1ea'; c.fillStyle = a; c.beginPath(); c.moveTo(-6, -hw); c.lineTo(2, -hw); c.lineTo(-10, hw); c.lineTo(-18, hw); c.fill(); c.fillStyle = '#e0402a'; c.beginPath(); c.moveTo(3, -hw); c.lineTo(7, -hw); c.lineTo(-5, hw); c.lineTo(-9, hw); c.fill(); }
    if (st) {
      const lc = st.liveryColor || '#f4f1ea';
      if (st.livery === 'stripes') for (const y0 of [-4.4, 1.4]) { R(c, lc, -hl, y0, L, 3); R(c, '#00000022', -hl, y0 + 2.4, L, 0.6); }
      if (st.livery === 'racing') { R(c, lc, -hl, -2.6, L, 5.2); R(c, '#00000022', -hl, 2, L, 0.6); }
      if (st.livery === 'split') { c.globalAlpha = 0.9; R(c, lc, -hl - 2, -hw - 2, hl + (xr + xf) / 2 + 2, W + 4); c.globalAlpha = 1; }
      if (st.livery === 'checker') for (let i = 0; i < 4; i++) for (let j = -Math.ceil(hw / 2); j < Math.ceil(hw / 2); j++) if ((i + j) % 2 === 0) R(c, lc, hood0 + 3 + i * 2, j * 2, 2, 2);
      if (st.livery === 'flames') for (const sgn of [-1, 1]) { const f = [[hl + 1, sgn * 1], [hl - 4, sgn * 7], [hl - 8, sgn * 3], [hl - 12, sgn * 9], [hl - 15, sgn * 4], [hl - 21, sgn * 10], [hl - 18, sgn * 2], [hl - 10, sgn * 0.5]]; poly(c, f, lc); poly(c, f.map(([x, y]) => [x + 1.2, y * 0.6]), '#ffd25a'); }
      if (st.hood === 'carbon') { const hx1 = hl - 2.5; R(c, '#1b1e22', hood0, -rw, hx1 - hood0, rw * 2); for (let x = hood0; x < hx1; x += 1.2) for (let y = -rw; y < rw; y += 1.2) if ((Math.round(x / 1.2) + Math.round(y / 1.2)) % 2) R(c, '#2c3137', x, y, 1.2, 1.2); }
      if (st.finish === 'metallic' || st.finish === 'pearl') { let s0 = 11; for (let k = 0; k < 160; k++) { s0 = (s0 * 1103515245 + 12345) >>> 0; const x = -hl + (s0 % 1000) / 1000 * L; s0 = (s0 * 1103515245 + 12345) >>> 0; const y = -hw + (s0 % 1000) / 1000 * W; R(c, k % 3 ? '#ffffff38' : '#ffffff70', x, y, 0.35, 0.35); } }
      if (st.finish === 'pearl') { const pg = c.createLinearGradient(-hl, -hw, hl, hw); pg.addColorStop(0, '#ff9ae022'); pg.addColorStop(0.5, '#9affee30'); pg.addColorStop(1, '#a0b4ff26'); c.fillStyle = pg; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4); }
      if (st.finish === 'chrome') { const cg = c.createLinearGradient(0, -hw, 0, hw); for (const [t, col] of [[0, '#ffffffb0'], [0.18, '#ffffff10'], [0.32, '#00000050'], [0.5, '#ffffff90'], [0.62, '#ffffff05'], [0.8, '#00000060'], [1, '#ffffff70']]) cg.addColorStop(t, col); c.fillStyle = cg; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4); }
    }
    if (body === 'lowrider' || body === 'hyper' || body === 'classic') { let s0 = 7; for (let k = 0; k < 110; k++) { s0 = (s0 * 1103515245 + 12345) >>> 0; const x = -hl + (s0 % 1000) / 1000 * L; s0 = (s0 * 1103515245 + 12345) >>> 0; const y = -hw + (s0 % 1000) / 1000 * W; R(c, '#ffffff38', x, y, 0.4, 0.4); } }
    // richer paint: deepen mids, keep highlights (overlay of a mid-grey ramp)
    { const og = c.createLinearGradient(0, -hw, 0, hw); og.addColorStop(0, 'rgba(255,255,255,0.08)'); og.addColorStop(0.5, 'rgba(60,60,70,0.16)'); og.addColorStop(1, 'rgba(0,0,0,0.12)'); c.globalCompositeOperation = 'multiply'; c.fillStyle = og; c.fillRect(-hl - 2, -hw - 2, L + 4, W + 4); c.globalCompositeOperation = 'source-over'; }
    // clear-coat reflection bands (sky)
    c.globalCompositeOperation = 'screen';
    for (const [x0, a] of [[hood0 + (hl - hood0) * 0.45, 0.2], [xr - rgl - 4, 0.14], [-hl + 6, 0.1]]) { const rg = c.createLinearGradient(x0 - 6, 0, x0 + 6, 0); rg.addColorStop(0, 'rgba(255,255,255,0)'); rg.addColorStop(0.5, `rgba(220,235,255,${a})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = rg; c.beginPath(); c.moveTo(x0 - 2, -hw - 1); c.lineTo(x0 + 6, -hw - 1); c.lineTo(x0 - 3, hw + 1); c.lineTo(x0 - 11, hw + 1); c.closePath(); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    c.restore();
    // edges: top-left rim light, lower edge shade, crisp outline
    c.save(); path(pts); c.clip(); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.9; c.beginPath(); const top = pts.slice(1, Math.floor(pts.length / 2)); top.forEach(([x, y], i) => (i ? c.lineTo(x, y + 0.4) : c.moveTo(x, y + 0.4))); c.stroke(); c.restore();
    path(pts); c.strokeStyle = dark; c.lineWidth = 0.75; c.stroke();
    // ---- shut lines, doors, handles ----
    c.strokeStyle = rgba(shade(color, -0.55), 0.75); c.lineWidth = 0.4;
    if (body !== 'hyper') { c.beginPath(); c.moveTo(hood0, -rw + 0.3); c.quadraticCurveTo(hood0 + 1, 0, hood0, rw - 0.3); c.stroke(); }
    if (!['pickup', 'suv', 'hyper', 'van'].includes(body)) { c.beginPath(); c.moveTo(xr - rgl - 1.2, -rw + 0.3); c.quadraticCurveTo(xr - rgl - 2.2, 0, xr - rgl - 1.2, rw - 0.3); c.stroke(); }
    const dx = (xr + xf) / 2; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(dx, s * (hw - 0.3)); c.lineTo(dx, s * (rw + 0.3)); c.stroke(); if (spec.doors !== 2 && !sport) { c.beginPath(); c.moveTo(xr - 1, s * (hw - 0.3)); c.lineTo(xr - 1, s * (rw + 0.3)); c.stroke(); } R(c, chrome, dx - 3, s * (hw - 1.1) - 0.3, 1.8, 0.6); }
    // ---- greenhouse ----
    if (body === 'hyper') {
      const can = []; for (let k = 0; k <= 30; k++) { const a = (k / 30) * Math.PI * 2, x = (xr + xf) / 2 + Math.cos(a) * (xf - xr) / 2 * 1.05, y = Math.sin(a) * (rw - (Math.cos(a) < 0 ? 2.4 * -Math.cos(a) : 0)); can.push([x, y]); }
      glassFill(c, can, xr, xf); R(c, shade(color, -0.45), -hl + 3, -0.6, xr + hl - 3, 1.2); R(c, '#ffffff40', -hl + 3, -0.6, xr + hl - 3, 0.4);
      for (const s of [-1, 1]) { R(c, black, xf + 2, s * (hw - 4) - 0.6, hl - xf - 6, 1.2); R(c, black, -hl + 6, s * (hw - 3.5) - 0.5, 14, 1); }
    } else {
      const g0 = xr - rgl, g1 = xf + wsh, gw = rw + 0.2, taper = (x) => (x > xf ? gw - (x - xf) / Math.max(1, wsh) * 1.5 : x < xr ? gw - (xr - x) / Math.max(1, rgl) * 1.3 : gw);
      const gh = []; for (let x = g0; x <= g1 + 0.01; x += (g1 - g0) / 12) gh.push([x, -taper(x)]); for (let x = g1; x >= g0 - 0.01; x -= (g1 - g0) / 12) gh.push([x, taper(x)]);
      gh[0][0] += 0.8; gh[gh.length - 1][0] += 0.8; glassFill(c, gh, g0, g1);
      // roof panel
      const rcol = body === 'classic' ? '#efe6cc' : body === 'lowrider' ? '#f0e8d8' : shade(color, 0.04), rwR = rw - 1.5;
      RR(c, shade(rcol, -0.35), xr - 0.3, -rwR - 0.3, xf - xr + 0.6, rwR * 2 + 0.6, 2); RR(c, rcol, xr, -rwR, xf - xr, rwR * 2, 1.8);
      const rg2 = c.createLinearGradient(0, -rwR, 0, rwR); rg2.addColorStop(0, 'rgba(255,255,255,0.42)'); rg2.addColorStop(0.35, 'rgba(255,255,255,0.1)'); rg2.addColorStop(0.7, 'rgba(0,0,0,0.05)'); rg2.addColorStop(1, 'rgba(0,0,0,0.38)'); c.fillStyle = rg2; RR(c, rg2, xr, -rwR, xf - xr, rwR * 2, 1.8);
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(xr + (xf - xr) * 0.6, -rwR * 0.5, (xf - xr) * 0.3, rwR * 0.16, -0.08, 0, Math.PI * 2); c.fill();
      if ((body === 'gt' || body === 'sedan') && !K.base) { RR(c, '#0c1620', xr + (xf - xr) * 0.25, -rwR * 0.55, (xf - xr) * 0.5, rwR * 1.1, 1); R(c, '#5d8fb066', xr + (xf - xr) * 0.3, -rwR * 0.45, (xf - xr) * 0.35, 0.5); }
      if (body === 'muscle' && spec.stripes !== false) for (const y0 of [-4.2, 1.2]) R(c, L0 > 0.7 ? '#1d2433' : '#f4f1ea', xr, y0, xf - xr, 3);
      if (st?.livery === 'stripes') for (const y0 of [-4.4, 1.4]) R(c, st.liveryColor, xr, y0, xf - xr, 3);
      if (st?.livery === 'racing') { R(c, st.liveryColor, xr, -2.6, xf - xr, 5.2); CIR(c, '#f4f1ea', (xr + xf) / 2, 0, 3.4); c.fillStyle = '#14171c'; c.font = 'bold 4.4px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(((id.length * 7) % 89) + 10), (xr + xf) / 2, 0.3); }
      if (body === 'rally') { CIR(c, '#f4f1ea', (xr + xf) / 2, 0, 4); c.strokeStyle = '#1d2433'; c.lineWidth = 0.5; c.beginPath(); c.arc((xr + xf) / 2, 0, 4, 0, Math.PI * 2); c.stroke(); RR(c, black, xr + 1, -1.5, 3, 3, 0.8); }
      if (body === 'suv') for (const s of [-1, 1]) { R(c, '#2a2e33', xr + 1, s * (rwR - 0.8) - 0.5, xf - xr - 2, 1); R(c, '#aeb6be', xr + 1, s * (rwR - 0.8) - 0.5, xf - xr - 2, 0.35); }
      // A-pillars
      for (const s of [-1, 1]) { c.strokeStyle = shade(color, -0.25); c.lineWidth = 0.8; c.beginPath(); c.moveTo(xf, s * rwR); c.lineTo(g1 - 0.3, s * (taper(g1) - 0.4)); c.stroke(); }
      if (st?.tint) { const tint = [0, 0.3, 0.5, 0.7][Number(st.tint) || 0]; if (tint) { c.fillStyle = `rgba(4,7,10,${tint})`; path(gh); c.fill(); } }
    }
    // ---- mirrors ----
    for (const s of [-1, 1]) { const mx = xf + wsh * 0.15, my = s * (hw - 0.2); RR(c, '#0b0e12', mx - 1.4, my - 1.2, 3, 2.4, 1); RR(c, shade(color, -0.1), mx - 1, my - 0.9, 2.2, 1.8, 0.8); R(c, '#ffffff66', mx - 0.8, my - (s < 0 ? 0.8 : -0.4), 1.6, 0.35); }
    // ---- nose: grille / intakes / splitter + headlights ----
    const nx = hl;
    if (sport) { RR(c, black, nx - 2.6, -hw * 0.42, 2.2, hw * 0.84, 0.8); for (let k = -hw * 0.38; k < hw * 0.38; k += 1.3) R(c, '#2a2f36', nx - 2.4, k, 1.8, 0.5); R(c, '#05070a', nx - 0.6, -hw * 0.6, 1.2, hw * 1.2); for (const s of [-1, 1]) RR(c, black, nx - 5.5, s * hw * 0.62 - 1.2, 3.2, 2.4, 0.8); }
    else if (body === 'classic' || body === 'lowrider' || body === 'muscle') { RR(c, '#0c0f13', nx - 2.2, -hw + 3, 2, W - 6, 0.8); for (let k = -hw + 3.6; k < hw - 3.2; k += 1.4) R(c, '#3a4048', nx - 2, k, 1.6, 0.5); RR(c, chrome, nx - 0.6, -hw + 2.4, 1.4, W - 4.8, 0.7); R(c, '#ffffff', nx - 0.3, -hw + 3, 0.4, W - 6); }
    else if (body === 'suv' || body === 'pickup' || body === 'van') { RR(c, black, nx - 2.6, -hw + 2.2, 2.8, W - 4.4, 1); for (let k = -hw + 3.4; k < hw - 3; k += 1.8) R(c, '#3a4048', nx - 2.2, k, 2, 0.8); }
    else { RR(c, black, nx - 2, -hw * 0.45, 1.8, hw * 0.9, 0.7); for (let k = -hw * 0.4; k < hw * 0.4; k += 1.4) R(c, '#353b43', nx - 1.8, k, 1.4, 0.5); RR(c, '#14171b', nx - 0.8, -hw + 2.6, 1.4, W - 5.2, 0.7); }
    const hx = nx - 3.4;
    for (const s of [-1, 1]) {
      c.save(); c.translate(hx - (sport ? 1.2 : 0), s * (hw - (sport ? 5.2 : 4.4)));
      if (body === 'classic' || body === 'lowrider') { CIR(c, '#20252b', 0, 0, 2.4); CIR(c, '#fff4d0', 0, 0, 1.8); CIR(c, '#ffffff', 0.5, -s * 0.5, 0.6); }
      else if (sport || body === 'coupe') { c.rotate(s * 0.28); RR(c, '#0e1217', -2.6, -1.1, 5, 2.2, 1); RR(c, '#dff2ff', -2, -0.45, 3.8, 0.9, 0.45); R(c, '#ffffff', 0.2, -0.25, 1.2, 0.5); }
      else if (body === 'suv' || body === 'pickup' || body === 'van') { RR(c, '#20252b', -1.6, -2.4, 3.6, 4.8, 0.9); RR(c, '#fff4d0', -1, -1.8, 2.4, 3.6, 0.7); R(c, '#ffffff', -0.3, -1.4, 0.9, 1); }
      else { RR(c, '#20252b', -2.2, -1.8, 4.4, 3.6, 1); RR(c, '#eaf6ff', -1.6, -1.2, 3.2, 2.4, 0.8); R(c, '#ffffff', 0.2, -0.8, 1, 0.9); }
      c.restore();
    }
    // ---- tail: lights, diffuser, exhaust ----
    const tx = -hl;
    if (sport || body === 'sedan' || body === 'coupe' || body === 'gt') { RR(c, '#3a0b12', tx + 0.2, -hw + 2.4, 1.8, W - 4.8, 0.6); R(c, '#ff3446', tx + 0.6, -hw + 2.8, 0.8, W - 5.6); R(c, '#ffb0b8', tx + 0.7, -hw + 3.2, 0.3, W * 0.25); }
    else for (const s of [-1, 1]) { RR(c, '#3a0b12', tx + 0.2, s * (hw - 4.4) - 2.2, 2, 4.4, 0.6); R(c, '#ff3446', tx + 0.6, s * (hw - 4.4) - 1.6, 1, 3.2); }
    if (sport) { RR(c, '#06080a', tx - 0.8, -hw * 0.45, 2.2, hw * 0.9, 0.6); for (let k = -hw * 0.38; k <= hw * 0.38; k += 1.6) R(c, '#2a2f36', tx - 0.8, k, 2, 0.4); }
    if (!st?.exhaust) for (const s of sport ? [-1, 1] : [1]) { CIR(c, '#5a6168', tx - 0.4, s * hw * 0.32, 1); CIR(c, '#dfe5ea', tx - 0.4, s * hw * 0.32, 0.65); CIR(c, '#0c0e11', tx - 0.6, s * hw * 0.32, 0.35); }
    // ---- body-specific hardware ----
    if (body === 'muscle') { RR(c, '#0c0f13', hood0 + 5, -3.2, 9, 6.4, 1.2); R(c, '#3a3f45', hood0 + 12, -2.4, 1.2, 4.8); R(c, '#ffffff30', hood0 + 5.5, -2.8, 7, 0.6); }
    if (body === 'pickup') { const bx0 = -hl + 2, bx1 = xr - rgl - 1.5; RR(c, '#1d2126', bx0, -rw - 0.5, bx1 - bx0, rw * 2 + 1, 1); for (let k = bx0 + 2; k < bx1 - 1; k += 2.4) R(c, '#2c3238', k, -rw + 0.5, 0.8, rw * 2 - 1); RR(c, '#aeb6be', bx1 - 3.4, -rw + 0.3, 2.8, rw * 2 - 0.6, 0.6); }
    if (body === 'suv') { CIR(c, '#0c0e11', -hl - 1.4, 0, 4.2); CIR(c, '#2a2e33', -hl - 1.4, 0, 2.8); CIR(c, '#8f979f', -hl - 1.4, 0, 1.2); }
    if (body === 'rally') { for (let k = 0; k < 4; k++) { CIR(c, '#1a1f26', hl - 6.5, -5.4 + k * 3.6, 1.5); CIR(c, '#fff4c0', hl - 6.5, -5.4 + k * 3.6, 1.05); } }
    if (body === 'classic') for (const s of [-1, 1]) { R(c, chrome, -hl + 4, s * (hw - 3.4) - 0.3, L - 10, 0.6); poly(c, [[-hl - 1.6, s * (hw - 1)], [-hl + 7, s * (hw - 0.4)], [-hl + 7, s * (hw - 3)]], shade(color, 0.12)); }
    if (body === 'lowrider') { for (const s of [-1, 1]) R(c, chrome, -hl + 3, s * (hw - 3.2) - 0.35, L - 7, 0.7); c.strokeStyle = '#f2c84a'; c.lineWidth = 0.5; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(hood0 + 2, s * 2); c.bezierCurveTo(hood0 + 8, s * 9, hl - 10, s * 2, hl - 4, s * 7); c.stroke(); } }
    if (body === 'super') { for (const s of [-1, 1]) poly(c, [[-12, s * (hw - 0.6)], [-3, s * (hw - 0.6)], [-11, s * (hw - 5.2)]], '#0c0e11'); for (let k = 0; k < 6; k++) R(c, '#0c0e11', -hl + 6 + k * 2.4, -rw + 1.5, 1.1, rw * 2 - 3); if (spec.wing !== false) { RR(c, '#0c0e11', -hl - 1.5, -hw - 1.6, 3.6, W + 3.2, 0.8); R(c, '#3a3f45', -hl - 1.2, -hw - 1.2, 0.8, W + 2.4); } }
    if (body === 'van') { for (let k = 0; k < 3; k++) RR(c, shade(color, -0.12), xr + 6 + k * 9, -3, 5, 6, 1); }
    if (body === 'hatch') R(c, '#0c0e11', xr - rgl - 0.6, -rw + 0.6, 1, rw * 2 - 1.2);
    try { SIG[id]?.({ c, L, W, hl, hw, xr, xf, wsh, rgl, rw, fx, rx, tw, th, color, dark, deep, chrome, black, shade, R, RR, CIR, poly }); } catch (e) { console.error(e); }
    // ---- style hardware (exhaust, spoilers, scoop/vents) ----
    if (st) {
      if (st.hood === 'scoop') { RR(c, shade(color, -0.5), hood0 + 4, -3.4, 9, 6.8, 1.6); RR(c, '#0c0e11', hood0 + 10.5, -2.6, 1.8, 5.2, 0.6); }
      if (st.hood === 'vented') for (const sgn of [-1, 1]) for (let k = 0; k < 4; k++) R(c, '#0c0e11', hood0 + 4 + k * 1.8, sgn * 4.6 - 1.6, 0.9, 3.2);
      if (st.exhaust === 'twin') for (const sgn of [-1, 1]) { CIR(c, '#5a6168', -hl - 0.4, sgn * (hw - 6.5), 1.3); CIR(c, '#d9e0e6', -hl - 0.4, sgn * (hw - 6.5), 0.9); CIR(c, '#0c0e11', -hl - 0.6, sgn * (hw - 6.5), 0.5); }
      if (st.exhaust === 'quad') for (const sgn of [-1, 1]) for (const d of [0, 2.6]) { CIR(c, '#5a6168', -hl - 0.4, sgn * (hw - 5.5 - d), 1.1); CIR(c, '#d9e0e6', -hl - 0.4, sgn * (hw - 5.5 - d), 0.75); CIR(c, '#0c0e11', -hl - 0.6, sgn * (hw - 5.5 - d), 0.4); }
      if (st.exhaust === 'side') { CIR(c, '#5a6168', -hl - 0.6, 0, 2.1); CIR(c, '#e4eaef', -hl - 0.6, 0, 1.6); CIR(c, '#0c0e11', -hl - 0.8, 0, 0.9); }
      const rwS = hw - ins;
      if (st.spoiler === 'lip') RR(c, shade(color, -0.45), -hl + 0.3, -rwS - 1, 1.4, rwS * 2 + 2, 0.5);
      if (st.spoiler === 'ducktail') { RR(c, shade(color, -0.35), -hl - 1.2, -rwS - 1.5, 3, rwS * 2 + 3, 1.2); RR(c, color, -hl - 0.8, -rwS - 1, 2.2, rwS * 2 + 2, 1); }
      if (st.spoiler === 'wing' || st.spoiler === 'gt') { const big = st.spoiler === 'gt', ww = big ? W + 3 : W - 2, x0 = -hl - (big ? 3.4 : 2.2); for (const sgn of [-1, 1]) R(c, '#0c0e11', -hl + 0.5, sgn * (rwS - 2.5) - 0.5, big ? 3 : 2.2, 1); RR(c, '#06080a', x0 - 0.4, -ww / 2 - 0.4, (big ? 4.4 : 3.2) + 0.8, ww + 0.8, 0.8); RR(c, big ? '#1b1f24' : shade(color, -0.25), x0, -ww / 2, big ? 4.4 : 3.2, ww, 0.6); R(c, '#ffffff38', x0 + 0.4, -ww / 2 + 0.6, 0.6, ww - 1.2); }
    }
    return { cv, w: L + pad * 2, h: W + pad * 2, L, W, hd: true };
  }
  function glassFill(c, pts, x0, x1) {
    const g = c.createLinearGradient(x1, 0, x0, 0); g.addColorStop(0, '#2c5470'); g.addColorStop(0.18, '#132a3d'); g.addColorStop(0.55, '#0a1824'); g.addColorStop(0.85, '#16304a'); g.addColorStop(1, '#2a4a66');
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = g; c.fill();
    c.save(); c.clip(); const sg = c.createLinearGradient(0, -14, 0, 14); sg.addColorStop(0, 'rgba(160,210,255,0.28)'); sg.addColorStop(0.4, 'rgba(160,210,255,0)'); c.fillStyle = sg; c.fillRect(x0 - 2, -16, x1 - x0 + 4, 32);
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x0 + (x1 - x0) * 0.68, -14); c.lineTo(x0 + (x1 - x0) * 0.86, 14); c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x0 + (x1 - x0) * 0.16, -14); c.lineTo(x0 + (x1 - x0) * 0.3, 14); c.stroke(); c.restore();
    c.strokeStyle = '#04070b'; c.lineWidth = 0.55; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
  }
  root.NightshiftCarHD = Object.freeze({ bake, PROFILES: P });
})(typeof globalThis !== 'undefined' ? globalThis : this);
