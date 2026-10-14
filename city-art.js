/* City art pass v0.60 (Claude-owned). Makes the streets read as real streets:
 *  - Roads (baked into the cached ground tiles via world.js ground()): raised curbs with a shadow and a lit edge,
 *    tyre-wear bands in every lane, patched asphalt, hairline cracks, manholes, storm drains at the kerb, oil stains
 *    where cars park, turn arrows before junctions, worn paint on crosswalks. Deterministic per block, so every device
 *    sees the same city and nothing is redrawn per frame.
 *  - Traffic: every traffic car gets a real model and paint (hatchbacks, pickups, SUVs, muscle, classics…), with
 *    neighbourhood flavour (taxis downtown, work trucks in Ironworks, lowriders in the Flats, nicer cars in the Heights);
 *    taxis get a roof sign, all traffic gets brake lights when it stops.
 *  - Rooftops (drawn with the building): per-region extras — water towers, solar rows, roof gardens, skylights,
 *    satellite dishes, vents and pipes — so the city from above isn't the same box repeated.
 *  - People: the original core districts get their own dress style too (crowd.js already themes the outer regions).
 * API: NightshiftCityArt.{roads, stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const st = { roadBlocks: 0, traffic: 0, roofs: 0 };
  const H = (a, b, k = 0) => { let h = (a * 73856093) ^ (b * 19349663) ^ (k * 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const region = (x, y) => { try { return root.NightshiftWorld?.regionAt?.(x, y)?.name || null; } catch { return null; } };

  // ---------------- roads (called from world.js ground()) ----------------
  function segment(c, x0, y0, len, horiz, seed) {
    // a road arm between two junctions: (x0,y0) = start of the arm on the centreline, len along the axis
    const L = (a, w, col, along0, along1, a2) => { if (horiz) R(c, col, x0 + along0, y0 + a, along1 - along0, w); else R(c, col, x0 + a, y0 + along0, w, along1 - along0); void a2; };
    // tyre wear: two bands per lane
    for (const lane of [-31, 31]) for (const off of [-9, 7]) L(lane + off, 4, 'rgba(10,16,26,0.16)', 0, len);
    // lighter centre of each lane (polished by traffic)
    for (const lane of [-31, 31]) L(lane - 2, 3, 'rgba(255,255,255,0.025)', 0, len);
    // patches
    const np = Math.floor(H(seed, 1) * 3);
    for (let i = 0; i < np; i++) { const a = -50 + H(seed, 10 + i) * 84, s = 20 + H(seed, 20 + i) * (len - 90), pl = 26 + H(seed, 30 + i) * 60, pw = 12 + H(seed, 40 + i) * 18, dark = H(seed, 50 + i) < 0.5;
      L(a, pw, dark ? 'rgba(16,22,32,0.35)' : 'rgba(80,92,104,0.16)', s, s + pl); L(a, 1, 'rgba(0,0,0,0.25)', s, s + pl); L(a + pw - 1, 1, 'rgba(255,255,255,0.05)', s, s + pl); }
    // cracks
    c.save(); c.strokeStyle = 'rgba(8,12,20,0.45)'; c.lineWidth = 1;
    const nc = 1 + Math.floor(H(seed, 2) * 3);
    for (let i = 0; i < nc; i++) { let a = -50 + H(seed, 60 + i) * 100, s = 30 + H(seed, 70 + i) * (len - 80); c.beginPath(); const P = (al, ac) => (horiz ? [x0 + al, y0 + ac] : [x0 + ac, y0 + al]); c.moveTo(...P(s, a)); for (let k = 1; k < 6; k++) { s += 5 + H(seed, 80 + i * 7 + k) * 9; a += (H(seed, 90 + i * 7 + k) - 0.5) * 9; c.lineTo(...P(s, a)); } c.stroke(); }
    c.restore();
    // manhole
    if (H(seed, 3) < 0.55) { const s = 60 + H(seed, 4) * (len - 140), a = H(seed, 5) < 0.5 ? -31 : 31, [mx, my] = horiz ? [x0 + s, y0 + a] : [x0 + a, y0 + s];
      c.fillStyle = 'rgba(10,14,22,0.7)'; c.beginPath(); c.arc(mx, my, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = '#3a434c'; c.beginPath(); c.arc(mx, my, 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#262d35'; c.lineWidth = 1; for (let k = -4; k <= 4; k += 2) { c.beginPath(); c.moveTo(mx - 5, my + k); c.lineTo(mx + 5, my + k); c.stroke(); } c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(mx - 4, my - 6, 6, 1); }
    // storm drains at both kerbs + oil stains in the parking edge
    for (const side of [-1, 1]) {
      const s = 40 + H(seed, 6 + side) * (len - 100), a = side * 58, [dx, dy] = horiz ? [x0 + s, y0 + a - 2] : [x0 + a - 2, y0 + s];
      R(c, '#11161d', dx - (horiz ? 7 : 0), dy - (horiz ? 0 : 7), horiz ? 14 : 5, horiz ? 5 : 14); c.fillStyle = '#3b444d'; for (let k = 0; k < 4; k++) { if (horiz) c.fillRect(dx - 6 + k * 4, dy + 1, 2, 3); else c.fillRect(dx + 1, dy - 6 + k * 4, 3, 2); }
      if (H(seed, 8 + side) < 0.6) { const s2 = 30 + H(seed, 11 + side) * (len - 80), a2 = side * 46, [ox, oy] = horiz ? [x0 + s2, y0 + a2] : [x0 + a2, y0 + s2]; c.fillStyle = 'rgba(4,6,10,0.28)'; c.beginPath(); c.ellipse(ox, oy, horiz ? 10 : 6, horiz ? 6 : 10, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(90,60,120,0.08)'; c.beginPath(); c.ellipse(ox + 2, oy - 1, 4, 3, 0, 0, Math.PI * 2); c.fill(); }
    }
    // turn arrows on the approach to the next junction (right-hand lanes)
    if (H(seed, 12) < 0.45) {
      const fwd = len - 120, [ax, ay, ang] = horiz ? [x0 + 120, y0 - 31, Math.PI] : [x0 - 31, y0 + fwd, Math.PI / 2], left = H(seed, 13) < 0.5;
      c.save(); c.translate(ax, ay); c.rotate(ang); c.fillStyle = 'rgba(220,224,206,0.55)'; c.fillRect(-14, -1.5, 16, 3);
      if (left) { c.fillRect(0, -9, 3, 9); c.beginPath(); c.moveTo(1.5, -15); c.lineTo(-4, -8); c.lineTo(7, -8); c.closePath(); c.fill(); }
      c.beginPath(); c.moveTo(10, 0); c.lineTo(2, -6); c.lineTo(2, 6); c.closePath(); c.fill(); c.restore();
    }
  }
  function curbs(c, x, y) {
    // raised kerbs around the block (x,y = block origin): shadow on the road side, lit edge on top
    const sh = 'rgba(6,10,18,0.45)', lit = 'rgba(255,255,255,0.10)';
    R(c, sh, x + 60, y + 85, 3, 170); R(c, lit, x + 63, y + 85, 1, 170);
    R(c, sh, x + 377, y + 85, 3, 170); R(c, lit, x + 376, y + 85, 1, 170);
    R(c, sh, x + 85, y + 59, 270, 3); R(c, lit, x + 85, y + 62, 270, 1);
    R(c, sh, x + 85, y + 278, 270, 3); R(c, lit, x + 85, y + 277, 270, 1);
  }
  function crosswalkWear(c, jx, jy, seed) {
    c.fillStyle = 'rgba(30,38,50,0.35)';
    for (let k = 0; k < 40; k++) { const a = H(seed, 200 + k), b = H(seed, 300 + k), side = k % 4; const [px, py] = side === 0 ? [jx - 46 + a * 92, jy - 61 + b * 12] : side === 1 ? [jx - 46 + a * 92, jy + 49 + b * 12] : side === 2 ? [jx - 61 + b * 12, jy - 46 + a * 92] : [jx + 49 + b * 12, jy - 46 + a * 92]; c.fillRect(px, py, 1 + (k % 3), 1); }
  }
  function roads(c, width, height, view) {
    for (let x = 0; x < width; x += 440) for (let y = 0; y < height; y += 340) {
      if (view && (x + 500 < view.x || x - 60 > view.x + view.w || y + 400 < view.y || y - 60 > view.y + view.h)) continue;
      const bi = x / 440, bj = y / 340;
      // horizontal arm from this junction east, vertical arm south
      if (x + 440 <= width) segment(c, x + 63, y, 440 - 126, true, (bi * 31 + bj * 7) * 2 + 1);
      if (y + 340 <= height) segment(c, x, y + 62, 340 - 124, false, (bi * 31 + bj * 7) * 2 + 2);
      if (x > 0 && y > 0) crosswalkWear(c, x, y, bi * 97 + bj);
      if (x + 440 <= width && y + 340 <= height) curbs(c, x, y);
      st.roadBlocks++;
    }
    try { root.NightshiftHD?.ground?.(c, width, height, view); } catch { /* optional */ }
    try { root.NightshiftModern?.lots?.(c, width, height, view); } catch { /* optional */ } // v0.63 lots
  }

  // ---------------- traffic models ----------------
  const FLAVOUR = {
    DOWNTOWN: ['taxi', 'taxi', 'CX:aurora', 'CX:ridgeback', 'SEDAN', 'CX:monarch'], 'THE HEIGHTS': ['CX:aurora', 'CX:ridgeback', 'CX:monarch', 'CX:kestrel', 'CX:vortex'],
    IRONWORKS: ['CX:mule', 'VAN', 'VAN', 'CX:mule', 'CX:brick'], HARBOR: ['VAN', 'CX:mule', 'CX:brick', 'SEDAN'], 'THE FLATS': ['CX:velvet', 'CX:bulldog', 'CX:velvet', 'CX:brick'],
    'OLD TOWN': ['CX:monarch', 'CX:velvet', 'CX:brick', 'SEDAN'], FAIRVIEW: ['CX:ridgeback', 'CX:brick', 'SEDAN', 'COMPACT'], 'MARKET DISTRICT': ['VAN', 'taxi', 'COMPACT', 'CX:brick', 'SEDAN'],
  };
  const CORE = ['SEDAN', 'COMPACT', 'CX:brick', 'CX:mule', 'CX:ridgeback', 'CX:bulldog', 'taxi', 'CX:kestrel', 'VAN', 'CX:monarch'];
  const PAINT = ['#c84659', '#3d7fc6', '#e8e6e0', '#1d2433', '#7d8796', '#2f8f6a', '#b9482f', '#e2b75c', '#4a5a6e', '#f1efe8', '#5a2e4a'];
  function dressTraffic() {
    const T = root.NightshiftTraffic?.actors; if (!Array.isArray(T)) return;
    for (const a of T) {
      if (a.__styled) continue; a.__styled = true;
      const seed = H(Math.round(a.x), Math.round(a.y), T.indexOf(a)), list = FLAVOUR[region(a.x, a.y)] || CORE, m = list[Math.floor(seed * list.length)];
      if (m === 'taxi') { a.model = 'SEDAN'; a.color = '#e8b830'; a.taxi = true; }
      else { a.model = m; const spec = m.startsWith('CX:') ? root.NightshiftCarsData?.fromModel?.(m) : null; a.color = spec?.colors ? spec.colors[Math.floor(H(seed * 1e6, 3) * spec.colors.length)] : PAINT[Math.floor(H(seed * 1e6, 4) * PAINT.length)]; }
      st.traffic++;
    }
  }
  function trafficExtras() {
    let ctx = null; try { ctx = g; } catch { return; } // eslint-disable-line no-undef
    const T = root.NightshiftTraffic?.actors; if (!Array.isArray(T) || !ctx) return; let p = null; try { p = player; } catch { return; } // eslint-disable-line no-undef
    for (const a of T) {
      if (Math.abs(a.x - p.x) > 900 || Math.abs(a.y - p.y) > 600) continue;
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.angle || 0);
      const stopped = Math.abs(a.velocity ?? a.speed ?? 0) < 0.15 || a.wait > 0;
      if (stopped) { ctx.fillStyle = '#ff2a3a'; ctx.fillRect(-27, -10, 3, 4); ctx.fillRect(-27, 6, 3, 4); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,40,60,0.25)'; ctx.beginPath(); ctx.arc(-30, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      if (a.taxi) { ctx.fillStyle = '#0b0d14'; ctx.fillRect(-4, -6, 8, 12); ctx.fillStyle = '#ffe9a8'; ctx.fillRect(-3, -5, 6, 10); ctx.fillStyle = '#0b0d14'; ctx.fillRect(-1, -4, 2, 8); for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#0b0d14' : '#f1efe8'; ctx.fillRect(-12 + k * 6, -11, 6, 2); } }
      ctx.restore();
    }
  }

  // ---------------- rooftops ----------------
  // your apartment's side entrance (the HOME point at the corner of the Midtown APARTMENTS block)
  function homeEntrance(c) {
    const x = 952, y = 744, t = performance.now() / 1000;
    c.save();
    R(c, 'rgba(6,10,18,0.35)', x - 15, y - 5, 34, 22);
    R(c, '#2a2f36', x - 14, y - 16, 30, 26); R(c, '#4a3a2e', x - 11, y - 13, 24, 20); R(c, '#6a4a32', x - 9, y - 11, 9, 16); R(c, '#6a4a32', x + 2, y - 11, 9, 16); R(c, '#f2c84a', x - 1, y - 4, 1, 3); R(c, '#f2c84a', x + 3, y - 4, 1, 3);
    R(c, '#c8a050', x - 16, y - 19, 34, 4); R(c, '#e3c27a', x - 16, y - 19, 34, 1);
    const glow = 0.55 + 0.15 * Math.sin(t * 2); c.fillStyle = `rgba(255,214,120,${glow})`; c.beginPath(); c.arc(x + 1, y - 22, 3, 0, Math.PI * 2); c.fill();
    R(c, '#7a2e24', x - 12, y + 10, 26, 7); R(c, '#a8553f', x - 11, y + 11, 24, 5); c.fillStyle = '#f2c84a'; c.font = '700 5px monospace'; c.textAlign = 'center'; c.fillText('HOME', x + 1, y + 15);
    c.restore();
  }
  function roofExtras(b) {
    let c = null; try { c = g; } catch { return; } // eslint-disable-line no-undef
    if (b.x === 960 && b.y === 755) homeEntrance(c);
    if (root.NightshiftModern?.on) return; // v0.63: modern-city.js owns rooftops
    const { x, y, w, h, name } = b, reg = region(x, y), s = H(Math.round(x), Math.round(y), 7), top = y + 8, roofH = h - 76; if (roofH < 40) return;
    const water = () => { const wx = x + Math.round(w * 0.55) - 17, wy = top + 12; c.fillStyle = 'rgba(8,12,20,0.35)'; c.beginPath(); c.ellipse(wx + 22, wy + 30, 20, 8, 0, 0, Math.PI * 2); c.fill(); R(c, '#3a2a20', wx + 6, wy + 16, 3, 20); R(c, '#3a2a20', wx + 25, wy + 16, 3, 20); c.fillStyle = '#7a5a3a'; c.beginPath(); c.ellipse(wx + 17, wy + 12, 15, 7, 0, 0, Math.PI * 2); c.fill(); R(c, '#6a4a2e', wx + 2, wy + 2, 30, 11); c.fillStyle = '#9a7650'; c.beginPath(); c.ellipse(wx + 17, wy + 2, 15, 6, 0, 0, Math.PI * 2); c.fill(); R(c, '#2a1f1a', wx + 2, wy + 6, 30, 1); R(c, '#2a1f1a', wx + 2, wy + 10, 30, 1); c.fillStyle = '#5a3a24'; c.beginPath(); c.moveTo(wx + 2, wy + 2); c.lineTo(wx + 17, wy - 8); c.lineTo(wx + 32, wy + 2); c.closePath(); c.fill(); };
    const solar = () => { for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { const sx = x + 20 + k * 26, sy = top + 12 + r * 22; R(c, 'rgba(8,12,20,0.4)', sx + 2, sy + 2, 22, 16); R(c, '#1a2a4a', sx, sy, 22, 16); R(c, '#3a5a8a', sx + 1, sy + 1, 20, 1); for (let q = 1; q < 4; q++) R(c, '#2a3a5a', sx + q * 5.5, sy, 1, 16); R(c, '#2a3a5a', sx, sy + 8, 22, 1); } };
    const garden = () => { const gx = x + 18, gy = top + 12, gw = Math.min(110, w - 120); R(c, '#2a3a24', gx - 2, gy - 2, gw + 4, 44); R(c, '#4f7a46', gx, gy, gw, 40); for (let k = 0; k < 9; k++) { c.fillStyle = k % 3 ? '#6fa05a' : '#3e6a38'; c.beginPath(); c.arc(gx + 8 + (k * 37) % (gw - 12), gy + 8 + ((k * 17) % 26), 6 + (k % 3), 0, Math.PI * 2); c.fill(); } R(c, '#c9b08a', gx + gw / 2 - 2, gy, 4, 40); };
    const sky = () => { for (let k = 0; k < 4; k++) { const sx = x + 22 + k * ((w - 50) / 4), sy = top + 8 + (k % 2) * 6; R(c, 'rgba(8,12,20,0.4)', sx + 2, sy + 2, 30, 18); R(c, '#5a7a8a', sx, sy, 30, 18); R(c, '#9fc3d6', sx + 2, sy + 2, 26, 14); R(c, 'rgba(255,255,255,0.35)', sx + 3, sy + 3, 8, 12); } };
    const dish = () => { const dx = x + w - 40 - s * 30, dy = top + 14; R(c, '#5a6168', dx + 6, dy + 8, 2, 10); c.fillStyle = '#c9d1d6'; c.beginPath(); c.ellipse(dx + 7, dy + 7, 9, 6, -0.5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#9aa3ab'; c.beginPath(); c.ellipse(dx + 8, dy + 8, 5, 3, -0.5, 0, Math.PI * 2); c.fill(); };
    const pipes = () => { const py = top + roofH - 18; R(c, '#5a6168', x + 14, py, w - 28, 3); R(c, '#9aa3ab', x + 14, py, w - 28, 1); for (let k = 0; k < 4; k++) R(c, '#3a4148', x + 30 + k * (w - 60) / 3, py - 6, 4, 9); };
    const vents = () => { for (let k = 0; k < 3; k++) { const vx = x + 30 + k * 22 + s * 40, vy = top + roofH - 34; c.fillStyle = 'rgba(8,12,20,0.35)'; c.beginPath(); c.arc(vx + 2, vy + 2, 5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#8a939b'; c.beginPath(); c.arc(vx, vy, 5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#3a4148'; c.beginPath(); c.arc(vx, vy, 2.5, 0, Math.PI * 2); c.fill(); } };
    const neon = () => { const t = performance.now() / 1000, on = Math.sin(t * 3 + s * 9) > -0.6; c.fillStyle = on ? '#ff6ad8' : '#5a2a50'; c.fillRect(x + 20, top + 6, w - 40, 2); c.fillStyle = on ? '#3ad0ff' : '#1a3a4a'; c.fillRect(x + 20, top + 10, w - 40, 1); };
    if (reg === 'THE HEIGHTS' || reg === 'FAIRVIEW') { if (s < 0.6) solar(); dish(); }
    else if (reg === 'DOWNTOWN') { if (s < 0.5) garden(); else dish(); vents(); }
    else if (reg === 'OLD TOWN' || reg === 'MARKET DISTRICT') { if (s < 0.55) water(); vents(); }
    else if (reg === 'IRONWORKS' || reg === 'HARBOR') { if (name === 'WAREHOUSE' || name === 'GARAGE') sky(); pipes(); if (s < 0.4) water(); }
    else if (reg === 'THE FLATS') { neon(); if (s < 0.5) dish(); }
    else { // core districts get a lighter touch
      if (name === 'APARTMENTS' && s < 0.5) water(); else if (s < 0.35) dish(); if (name === 'WAREHOUSE') pipes();
    }
    st.roofs++;
  }

  // ---------------- people in the core districts ----------------
  const CORE_THEMES = {
    MIDTOWN: { top: [['buttonup', 5], ['tee', 7], ['polo', 1]], outer: [['bomber', 1], ['track', 1], null], bottom: [['jeans', 0], ['chinos', 1]], shoes: [['hitops', 0], ['runners', 1]] },
    'WEST END': { top: [['tee', 3], ['longsleeve', 7]], outer: [['denim', 0], null, null], bottom: [['jeans', 2], ['shorts', 3]], shoes: [['runners', 0], ['slides', 1]], head: [['bucket', 0], null] },
    SOUTHSIDE: { top: [['tee', 8], ['tank', 1], ['jersey', 2]], outer: [['hoodie', 9], ['puffer', 0], null], bottom: [['joggers', 8], ['jeans', 3]], shoes: [['hitops', 2], ['boots', 2]], head: [['cap', 8], ['durag', 5], null] },
    'THE DOCKS': { top: [['longsleeve', 8], ['tee', 4]], outer: [['puffer', 3], ['vest', 0], null], bottom: [['cargo', 1], ['jeans', 3]], shoes: [['boots', 0]], head: [['beanie', 1], null] },
  };
  function dressCore() {
    let P = []; try { P = peds; } catch { return; } // eslint-disable-line no-undef
    for (const p of P) {
      if (p.outfit || p.__coreDressed) continue; p.__coreDressed = true;
      let d = ''; try { d = root.NightshiftEnvironment?.district?.(p) || ''; } catch { /* n/a */ }
      const th = CORE_THEMES[d]; if (!th || H(Math.round(p.x), Math.round(p.y), 9) < 0.35) continue; // some locals keep their own look
      let base = null; const seed = (d.length * 7907 + Math.floor(H(Math.round(p.x), 1, 2) * 8) * 104729) >>> 0; try { base = root.NightshiftWardrobeData?.npcOutfit?.(seed); } catch { /* n/a */ } if (!base) continue;
      let xs = seed || 1; const r = () => { xs = (xs * 1664525 + 1013904223) >>> 0; return xs / 4294967296; }, pick = (a) => a[Math.floor(r() * a.length)];
      const o = JSON.parse(JSON.stringify(base)); for (const k of Object.keys(th)) { const v = pick(th[k]); o[k] = v ? { id: v[0], color: v[1] } : null; }
      p.outfit = o; p.themed = true;
    }
  }

  // ---------------- hooks ----------------
  const hook = setInterval(() => {
    const W = root.NightshiftWorld, T = root.NightshiftTraffic, C = root.NightshiftCrime;
    if (W && typeof W.building === 'function' && !W.__cityArt) { const b0 = W.building; W.building = function (b) { const r = b0.apply(this, arguments); try { if (b && (typeof camera === 'undefined' || !(b.x + b.w + 48 < camera.x || b.y + b.h + 48 < camera.y))) roofExtras(b); } catch { /* cosmetic */ } return r; }; W.__cityArt = true; } // eslint-disable-line no-undef
    if (T && typeof T.draw === 'function' && !T.__cityArt) { const d0 = T.draw; T.draw = function () { const r = d0.apply(this, arguments); try { trafficExtras(); } catch { /* cosmetic */ } return r; }; T.__cityArt = true; }
    if (C && typeof C.draw === 'function' && !C.__cityArtTraffic && root.NightshiftScene) { const d1 = C.draw; C.draw = function () { try { trafficExtras(); } catch { /* cosmetic */ } return d1.apply(this, arguments); }; C.__cityArtTraffic = true; }
    if (W?.__cityArt && T?.__cityArt) clearInterval(hook);
  }, 300);
  setInterval(() => { try { dressTraffic(); dressCore(); } catch { /* n/a */ } }, 1500);
  root.NightshiftCityArt = Object.freeze({ roads, stats: () => ({ ...st }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
