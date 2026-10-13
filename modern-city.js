/* Modern city v0.63 (Claude-owned): replaces the old brick-and-awning building look with a present-day city.
 * Every building picks an archetype from its type, district and a per-building hash, so no two blocks match:
 *  - TOWER: glass curtain wall (mullions, spandrels, sky reflections), lobby with double-height glass, mechanical
 *    penthouse, helipad or roof garden, LED crown at night (banks, downtown/market apartments, some offices).
 *  - MIDRISE: mixed cladding (white panel / dark metal / timber slats), recessed balconies with glass rails and plants,
 *    roof terrace with deck tiles, planters, solar and string lights (apartments elsewhere).
 *  - STORE: floor-to-ceiling glass storefront with lit shelves, lightbox sign in a clean sans font, black steel canopy,
 *    A-frame board, rooftop HVAC + PV (corner shops, boutiques, diners, gas-station marts).
 *  - INDUSTRIAL: vertical-rib metal cladding, numbered roll-up doors, dock bumpers, yellow bollards, skylight strips,
 *    solar field (warehouses, garages).
 *  - CLUB: matte black box, animated LED outline, facade video wall, rope line.
 * Digital billboards (animated ads) sit on some roofs; lit windows feed the night lightmap.
 * Lots (outer regions): parking, plaza, court, park, gas station and twin buildings are drawn into the baked ground
 * (city-data.js decides the footprints; NightshiftModern.lots paints them). Gas canopies are drawn live (overhead).
 * Also: modern traffic bodies + LED light bars, earbuds/phones on people, e-scooter riders and delivery robots.
 * API: NightshiftModern.{on, archetype, lots, stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const st = { buildings: 0, billboards: 0, lots: 0, riders: 0 };
  const H = (a, b, k = 0) => { let h = (Math.round(a) * 73856093) ^ (Math.round(b) * 19349663) ^ (k * 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const region = (x, y) => { try { return root.NightshiftWorld?.regionAt?.(x, y)?.name || null; } catch { return null; } };
  const FONT = (px, w = 800) => `${w} ${px}px 'Chakra Petch',ui-sans-serif,system-ui,sans-serif`;
  const night = () => { try { return root.NightshiftEnvironment?.darkness?.(root.NightshiftEnvironment.state?.minute ?? 720) || 0; } catch { return 0; } };
  const lit = (o) => { try { const L = root.NightshiftWorld?.litWindows?.(); if (Array.isArray(L) && L.length < 140) L.push(o); } catch { /* n/a */ } };
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  const lin = (c, x0, y0, x1, y1, stops) => { const gr = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => gr.addColorStop(o, col)); return gr; };

  // ---------- archetype + palette per building ----------
  const SCHEMES = {
    tower: [['#2b4a63', '#9fd0e8', '#16222e'], ['#1f3b3a', '#8fe0cf', '#121d1d'], ['#2a2f45', '#a9b8ff', '#141626'], ['#3a3328', '#ffd9a0', '#1d1912']],
    mid: [['#e9ecef', '#2b2f36', '#b07a4a'], ['#d8d2c4', '#3a3f45', '#8a5a3a'], ['#2b2f36', '#e9ecef', '#c08a5a'], ['#f2f0ea', '#4a5a6a', '#a06a40'], ['#c9d6dc', '#26303a', '#9a6a44']],
    store: [['#14181f', '#ff4a5a'], ['#f2f2f2', '#1d7ae0'], ['#1d2024', '#3ad0a0'], ['#24303c', '#ffb33a'], ['#f4efe6', '#e0503a'], ['#101418', '#c84cff']],
    ind: [['#6c7480', '#e2b75c'], ['#4a5562', '#ff7a3a'], ['#8a9098', '#2f8fd6'], ['#3f4a44', '#e2d24a']],
  };
  function archetype(b) {
    const reg = region(b.x, b.y), s = H(b.x, b.y, 1), n = b.name;
    if (n === 'CLUB') return 'club';
    if (n === 'WAREHOUSE' || n === 'GARAGE') return 'ind';
    if (n === 'BANK' || n === 'OFFICES' || n === 'TOWER') return 'tower';
    if (n === 'APARTMENTS') return (reg === 'DOWNTOWN' || reg === 'MARKET DISTRICT' || (!reg && s < 0.35)) ? 'tower' : 'mid';
    return 'store';
  }
  const scheme = (b, kind) => { const L = SCHEMES[kind] || SCHEMES.store; return L[Math.floor(H(b.x, b.y, 2) * L.length)]; };
  const BRAND = { 'CORNER SHOP': ['MART 24', 'QUIK STOP', 'DAILY', '7NITE', 'CORNER CO.'], CLOTHING: ['THREADS', 'DRIP', 'HYPE LAB', 'NORTHSIDE', 'ARCADE SUPPLY'], DINER: ['DINER', 'BURGER BAR', 'NOODLE HOUSE', 'TACO SPOT', 'GRILL 88'], GARAGE: ['AUTO WORKS', 'TUNE LAB', 'EV SERVICE'], WAREHOUSE: ['LOGISTICS', 'DEPOT', 'STORAGE+'], BANK: ['FIRST NIGHTSHIFT', 'CITY TRUST', 'APEX BANK'], CLUB: ['NEON', 'VELVET', 'AFTERDARK', 'PULSE'], OFFICES: ['TECH HUB', 'STUDIO', 'CO-WORK'] };
  const brand = (b) => { const L = BRAND[b.name] || [b.name]; return L[Math.floor(H(b.x, b.y, 3) * L.length)]; };

  // ---------- shared pieces ----------
  function shadow(c, b) { c.fillStyle = 'rgba(8,14,24,0.32)'; c.beginPath(); c.moveTo(b.x + 10, b.y + 14); c.lineTo(b.x + b.w + 26, b.y + 26); c.lineTo(b.x + b.w + 26, b.y + b.h + 22); c.lineTo(b.x + 16, b.y + b.h + 22); c.closePath(); c.fill(); }
  function roofBase(c, x, y, w, h, col, edge) {
    c.fillStyle = '#0d141c'; c.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    c.fillStyle = col; c.fillRect(x, y, w, h);
    c.fillStyle = edge; c.fillRect(x, y, w, 2.5); c.fillRect(x, y, 2.5, h); c.fillRect(x + w - 2.5, y, 2.5, h);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x + 0.5, y + 0.5, w - 1, 0.6);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 3, y + 3, w - 6, 0.8);
  }
  function hvac(c, x, y, s) { c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(x + 2, y + 2, 22, 16); c.fillStyle = '#b9c2ca'; c.fillRect(x, y, 22, 16); c.fillStyle = '#8a939b'; c.fillRect(x, y + 13, 22, 3); c.fillStyle = '#3a4148'; c.beginPath(); c.arc(x + 7, y + 7, 4.5, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#9aa3ab'; c.lineWidth = 0.6; const a = (performance.now() / 120 + s * 9) % (Math.PI * 2); for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + 7, y + 7); c.lineTo(x + 7 + Math.cos(a + k * 2.1) * 4, y + 7 + Math.sin(a + k * 2.1) * 4); c.stroke(); } c.fillStyle = '#6a737b'; for (let k = 0; k < 5; k++) c.fillRect(x + 13, y + 2.5 + k * 2.2, 7, 0.8); }
  function solar(c, x, y, cols, rows) { for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const sx = x + k * 19, sy = y + r * 15; c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(sx + 1.5, sy + 1.5, 17, 13); c.fillStyle = lin(c, sx, sy, sx + 17, sy + 13, [[0, '#2f4f88'], [1, '#14244a']]); c.fillRect(sx, sy, 17, 13); c.fillStyle = 'rgba(160,200,255,0.35)'; for (let q = 1; q < 4; q++) c.fillRect(sx + q * 4.25, sy, 0.4, 13); c.fillRect(sx, sy + 6.5, 17, 0.4); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(sx, sy, 17, 0.5); } }
  function lightbox(c, x, y, w, h, text, bg, fg, glow) {
    c.save(); if (glow) { c.shadowColor = fg; c.shadowBlur = 10; }
    c.fillStyle = bg; rr(c, x, y, w, h, 2); c.fill(); c.shadowBlur = 0;
    c.font = FONT(Math.min(11, h - 4)); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText(text, x + w / 2, y + h / 2 + 0.5);
    c.restore();
  }
  // animated digital billboard
  const ADS = [['NIGHTSHIFT FM', '#ff4ad8', '#2a0a3a'], ['DRIP SNEAKERS', '#ffe14a', '#1a1408'], ['CITY BANK · 0% APR', '#4ad0ff', '#06202a'], ['VOLT EV · CHARGE FASTER', '#7cffb5', '#06261a'], ['BURGER BAR', '#ffb33a', '#2a1406'], ['NIGHTCOIN ▲ 12%', '#9fffd0', '#04201a']];
  function billboard(c, x, y, w, h, seed) {
    const t = performance.now() / 1000, i = Math.floor((t / 6 + seed * 10)) % ADS.length, [txt, fg, bg] = ADS[i], ph = (t % 6) / 6, n = night();
    c.save();
    c.fillStyle = '#2a2f36'; c.fillRect(x + w * 0.2, y + h, 2, 8); c.fillRect(x + w * 0.8 - 2, y + h, 2, 8);
    c.fillStyle = '#0b0d14'; c.fillRect(x - 2, y - 2, w + 4, h + 4);
    c.fillStyle = lin(c, x, y, x + w, y + h, [[0, bg], [1, '#000']]); c.fillRect(x, y, w, h);
    c.globalAlpha = 0.85; c.fillStyle = fg; const bar = (ph * 1.4 - 0.2) * w; c.fillRect(x + Math.max(0, bar - 18), y + h - 4, 18, 2);
    c.beginPath(); c.arc(x + 10 + Math.sin(t * 2 + seed) * 4, y + h / 2, 5, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    c.font = FONT(Math.min(10, h - 6)); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = fg; c.shadowColor = fg; c.shadowBlur = n > 0.3 ? 8 : 0; c.fillText(txt, x + 20, y + h / 2 + 0.5, w - 26); c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,0.06)'; for (let k = 0; k < h; k += 2) c.fillRect(x, y + k, w, 0.5);
    if (n > 0.3) { c.globalCompositeOperation = 'lighter'; c.fillStyle = fg + '22'; c.fillRect(x - 6, y - 6, w + 12, h + 16); }
    c.restore(); st.billboards++;
  }

  // ---------- archetype renderers (facade = bottom band, roof = the rest) ----------
  function tower(c, b, n) {
    const { x, y, w, h } = b, fh = Math.min(62, h * 0.42), front = y + h - fh, [frame, glass, dark] = scheme(b, 'tower'), s = H(x, y, 4);
    roofBase(c, x, y, w, h - fh, '#5a636c', '#7a838c');
    // setback upper level (reads as a taller tower)
    const ux = x + 14, uy = y + 10, uw = w - 28, uh = h - fh - 22; c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(ux + 4, uy + 5, uw, uh); c.fillStyle = '#6a737c'; c.fillRect(ux, uy, uw, uh); c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(ux, uy, uw, 1);
    if (s < 0.45) { const hx = ux + uw * 0.3, hy = uy + uh / 2, r = Math.min(uh, uw) * 0.32; c.fillStyle = '#3a4148'; c.beginPath(); c.arc(hx, hy, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#ffd24a'; c.lineWidth = 1.2; c.beginPath(); c.arc(hx, hy, r - 2, 0, Math.PI * 2); c.stroke(); c.fillStyle = '#f1efe8'; c.font = FONT(r); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', hx, hy + 1); if (n > 0.3) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.fillStyle = (Math.floor(performance.now() / 400) + k) % 2 ? '#ff5a3a' : '#5a1a10'; c.fillRect(hx + Math.cos(a) * (r + 3) - 1, hy + Math.sin(a) * (r + 3) - 1, 2, 2); } }
    else { const gx = ux + 8, gy = uy + 8, gw = uw * 0.45, gh = uh - 16; c.fillStyle = '#3e6a38'; c.fillRect(gx, gy, gw, gh); for (let k = 0; k < 10; k++) { c.fillStyle = k % 2 ? '#6fa05a' : '#4f8a46'; c.beginPath(); c.arc(gx + 6 + H(x, k, 5) * (gw - 12), gy + 6 + H(y, k, 6) * (gh - 12), 4 + (k % 3), 0, Math.PI * 2); c.fill(); } c.fillStyle = '#c9b08a'; c.fillRect(gx + gw / 2 - 1.5, gy, 3, gh); }
    // mechanical penthouse + vents
    const px = ux + uw * 0.62, py = uy + 6; c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(px + 3, py + 3, uw * 0.32, uh * 0.55); c.fillStyle = '#8a939b'; c.fillRect(px, py, uw * 0.32, uh * 0.55); c.fillStyle = '#6a737b'; for (let k = 0; k < 6; k++) c.fillRect(px + 3, py + 4 + k * 4, uw * 0.32 - 6, 1.2);
    hvac(c, ux + uw * 0.62, uy + uh - 22, s);
    // LED crown
    c.fillStyle = n > 0.3 ? glass : 'rgba(255,255,255,0.4)'; c.fillRect(x, front - 3, w, 1.5); if (n > 0.3) { c.globalCompositeOperation = 'lighter'; c.fillStyle = glass + '33'; c.fillRect(x, front - 7, w, 7); c.globalCompositeOperation = 'source-over'; }
    // curtain wall
    c.fillStyle = dark; c.fillRect(x, front, w, fh);
    const sky = lin(c, x, front, x + w, front + fh, n > 0.3 ? [[0, '#0b1730'], [0.5, '#16264a'], [1, '#0a1020']] : [[0, glass], [0.45, frame], [1, '#0d1824']]);
    c.fillStyle = sky; c.fillRect(x + 1, front + 1, w - 2, fh - 2);
    for (let yy = front + 11; yy < y + h - 14; yy += 11) { c.fillStyle = frame; c.fillRect(x, yy, w, 2); }
    for (let xx = x + 8; xx < x + w; xx += 9) { c.fillStyle = 'rgba(10,16,24,0.75)'; c.fillRect(xx, front, 0.8, fh - 14); }
    c.globalAlpha = 0.35; c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x + w * 0.15, front); c.lineTo(x + w * 0.32, front); c.lineTo(x + w * 0.12, y + h - 14); c.lineTo(x - 0.0 + w * 0.0, y + h - 14); c.closePath(); c.fill(); c.globalAlpha = 0.18; c.beginPath(); c.moveTo(x + w * 0.42, front); c.lineTo(x + w * 0.48, front); c.lineTo(x + w * 0.36, y + h - 14); c.lineTo(x + w * 0.3, y + h - 14); c.closePath(); c.fill(); c.globalAlpha = 1;
    if (n > 0.3) for (let k = 0; k < 16; k++) if (H(x, k, 7) < 0.55) { const wx = x + 8 + Math.floor(H(y, k, 8) * ((w - 16) / 9)) * 9, wy = front + 2 + Math.floor(H(x + y, k, 9) * 3) * 11; c.fillStyle = 'rgba(255,214,140,0.65)'; c.fillRect(wx + 1, wy + 1, 7, 8); lit({ x: wx + 4, y: wy + 5, w: 8, h: 9, c: '#ffd38a' }); }
    // lobby
    const ly = y + h - 14; c.fillStyle = '#0b0f14'; c.fillRect(x, ly, w, 14); c.fillStyle = lin(c, 0, ly, 0, ly + 14, [[0, n > 0.3 ? '#ffe2a8' : '#9fc3d6'], [1, n > 0.3 ? '#8a6a3a' : '#3a5a6a']]); c.fillRect(x + 4, ly + 2, w - 8, 11);
    for (let xx = x + 16; xx < x + w - 8; xx += 16) { c.fillStyle = '#1a2028'; c.fillRect(xx, ly + 2, 1, 11); }
    c.fillStyle = '#c9d1d6'; c.fillRect(x + w / 2 - 14, ly - 3, 28, 2); c.fillStyle = '#1a2028'; c.fillRect(x + w / 2 - 8, ly + 3, 16, 10); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x + w / 2 - 0.3, ly + 3, 0.6, 10);
    lightbox(c, x + w / 2 - 34, front + fh - 26, 68, 10, brand(b), 'rgba(10,14,20,0.85)', glass, n > 0.3);
  }
  function midrise(c, b, n) {
    const { x, y, w, h } = b, fh = Math.min(62, h * 0.45), front = y + h - fh, [panel, metal, wood] = scheme(b, 'mid'), s = H(x, y, 10);
    roofBase(c, x, y, w, h - fh, '#7a7f84', '#a0a6ab');
    // roof terrace: deck boards, planters, solar, string lights
    const tx = x + 10, ty = y + 10, tw = w * 0.52, th = h - fh - 22; c.fillStyle = '#a0784e'; c.fillRect(tx, ty, tw, th); c.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < tw; k += 4) c.fillRect(tx + k, ty, 0.5, th);
    for (let k = 0; k < 4; k++) { const px = tx + 4 + k * (tw - 14) / 3, py = ty + 3; c.fillStyle = '#3a3f45'; c.fillRect(px, py, 10, 8); c.fillStyle = '#5a9a4a'; c.beginPath(); c.arc(px + 5, py + 3, 5, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#2b2f36'; c.fillRect(tx + tw * 0.3, ty + th * 0.45, 22, 12); c.fillRect(tx + tw * 0.3 + 26, ty + th * 0.45 + 2, 8, 8);
    if (n > 0.3) { c.strokeStyle = 'rgba(255,230,160,0.5)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(tx, ty + th * 0.3); c.quadraticCurveTo(tx + tw / 2, ty + th * 0.45, tx + tw, ty + th * 0.3); c.stroke(); for (let k = 1; k < 9; k++) { c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(tx + k * tw / 9, ty + th * 0.3 + Math.sin(k / 9 * Math.PI) * th * 0.15, 1, 0, Math.PI * 2); c.fill(); } }
    solar(c, x + w * 0.6, y + 12, Math.max(2, Math.floor((w * 0.36) / 19)), Math.max(1, Math.floor((h - fh - 24) / 15)));
    // facade: panel grid + timber slat accent + recessed balconies
    c.fillStyle = panel; c.fillRect(x, front, w, fh);
    c.fillStyle = 'rgba(0,0,0,0.12)'; for (let xx = x + 24; xx < x + w; xx += 24) c.fillRect(xx, front, 0.5, fh); for (let yy = front + 15; yy < y + h; yy += 15) c.fillRect(x, yy, w, 0.5);
    const slatX = s < 0.5 ? x + 6 : x + w - 34; c.fillStyle = wood; c.fillRect(slatX, front, 28, fh - 12); c.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 0; k < 28; k += 3) c.fillRect(slatX + k, front, 0.6, fh - 12);
    const bays = Math.max(2, Math.floor((w - 50) / 46)); for (let k = 0; k < bays; k++) {
      const bx = (s < 0.5 ? x + 40 : x + 10) + k * 46, by = front + 6;
      c.fillStyle = metal; c.fillRect(bx, by, 38, 20); // recess
      c.fillStyle = n > 0.3 && H(bx, by, 1) < 0.6 ? '#ffcf8a' : '#5a7a8a'; c.fillRect(bx + 3, by + 2, 32, 12); if (n > 0.3 && H(bx, by, 1) < 0.6) lit({ x: bx + 19, y: by + 8, w: 32, h: 12, c: '#ffd38a' });
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(bx + 4, by + 3, 6, 10);
      c.fillStyle = 'rgba(170,220,240,0.45)'; c.fillRect(bx - 1, by + 14, 40, 6); c.fillStyle = '#c9d1d6'; c.fillRect(bx - 1, by + 14, 40, 0.8); // glass rail
      if (H(bx, by, 2) < 0.5) { c.fillStyle = '#4f8a46'; c.beginPath(); c.arc(bx + 32, by + 13, 3.5, 0, Math.PI * 2); c.fill(); }
      // second row
      const by2 = by + 26; if (by2 + 16 < y + h - 12) { c.fillStyle = metal; c.fillRect(bx, by2, 38, 14); c.fillStyle = n > 0.3 && H(bx, by2, 3) < 0.5 ? '#ffcf8a' : '#5a7a8a'; c.fillRect(bx + 3, by2 + 2, 32, 10); c.fillStyle = 'rgba(170,220,240,0.45)'; c.fillRect(bx - 1, by2 + 10, 40, 4); }
    }
    // entrance with canopy + house number
    const ex = s < 0.5 ? x + w - 46 : x + 40, ey = y + h - 14; c.fillStyle = '#1a2028'; c.fillRect(ex, ey, 30, 14); c.fillStyle = '#9fc3d6'; c.fillRect(ex + 2, ey + 2, 26, 12); c.fillStyle = '#1a2028'; c.fillRect(ex + 14.5, ey + 2, 1, 12); c.fillStyle = '#2b2f36'; c.fillRect(ex - 6, ey - 4, 42, 3); c.fillStyle = n > 0.3 ? '#ffe9a8' : '#c9d1d6'; c.fillRect(ex - 6, ey - 1.5, 42, 0.8);
    c.font = FONT(7); c.fillStyle = metal; c.textAlign = 'center'; c.fillText(String(10 + Math.floor(s * 89)), ex + 15, ey - 6);
  }
  function store(c, b, n) {
    const { x, y, w, h } = b, fh = Math.min(62, h * 0.5), front = y + h - fh, [face, accent] = scheme(b, 'store'), s = H(x, y, 20);
    roofBase(c, x, y, w, h - fh, '#6a7178', '#8a9198');
    hvac(c, x + 16, y + 14, s); hvac(c, x + 44, y + 14, s + 0.3); if (w > 160) solar(c, x + w - 100, y + 12, 4, Math.max(1, Math.floor((h - fh - 24) / 15)));
    if (H(x, y, 21) < 0.45 && w > 150) billboard(c, x + w * 0.3, y + 10, Math.min(110, w * 0.45), 22, s);
    // facade: solid upper band (brand colour), full-height glass below
    c.fillStyle = face; c.fillRect(x, front, w, fh); c.fillStyle = accent; c.fillRect(x, front, w, 2);
    const gy = front + 22, gh = y + h - gy - 2; c.fillStyle = '#0b0f14'; c.fillRect(x + 6, gy - 1, w - 12, gh + 1);
    c.fillStyle = n > 0.3 ? '#ffe7b8' : '#a9cbd8'; c.fillRect(x + 7, gy, w - 14, gh);
    // shelves / racks / tables seen through the glass
    const kind = b.name; for (let k = 0; k < Math.floor((w - 20) / 14); k++) { const sx = x + 10 + k * 14; if (kind === 'CLOTHING') { c.fillStyle = ['#c84659', '#1d2024', '#f1efe8', '#3d7fc6', '#e2b75c'][k % 5]; c.fillRect(sx, gy + 4, 9, 13); c.fillStyle = '#8a939b'; c.fillRect(sx - 1, gy + 3, 11, 0.8); } else if (kind === 'DINER') { c.fillStyle = '#c84659'; c.fillRect(sx, gy + 12, 10, 5); c.fillStyle = '#f1efe8'; c.fillRect(sx + 2, gy + 6, 6, 4); } else { c.fillStyle = '#e8eef3'; c.fillRect(sx, gy + 3, 11, 14); for (let r = 0; r < 3; r++) { c.fillStyle = ['#e2b75c', '#3d7fc6', '#c84659', '#2f8f6a'][(k + r) % 4]; c.fillRect(sx + 1, gy + 4 + r * 4.5, 9, 3); } } }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(x + 10, gy); c.lineTo(x + 24, gy); c.lineTo(x + 14, gy + gh); c.lineTo(x + 7, gy + gh); c.closePath(); c.fill();
    for (let xx = x + 7 + (w - 14) / 3; xx < x + w - 10; xx += (w - 14) / 3) { c.fillStyle = '#0b0f14'; c.fillRect(xx, gy, 1.2, gh); }
    // door
    c.fillStyle = '#0b0f14'; c.fillRect(x + w / 2 - 9, gy, 18, gh); c.fillStyle = n > 0.3 ? '#fff3d8' : '#cfe6f0'; c.fillRect(x + w / 2 - 8, gy + 1, 16, gh - 1); c.fillStyle = '#0b0f14'; c.fillRect(x + w / 2 - 0.4, gy + 1, 0.8, gh - 1); c.fillStyle = '#c9d1d6'; c.fillRect(x + w / 2 - 3, gy + gh / 2, 1, 4); c.fillRect(x + w / 2 + 2, gy + gh / 2, 1, 4);
    // steel canopy + lightbox
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + 2, gy - 2, w - 4, 4); c.fillStyle = '#14181f'; c.fillRect(x + 2, gy - 4, w - 4, 3); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x + 2, gy - 4, w - 4, 0.5);
    lightbox(c, x + w / 2 - Math.min(60, w * 0.32), front + 5, Math.min(120, w * 0.64), 13, brand(b), accent, '#ffffff', n > 0.3);
    if (n > 0.3) { lit({ x: x + w / 2, y: gy + gh / 2, w: w - 14, h: gh, c: '#ffe2a8' }); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,220,160,0.12)'; c.fillRect(x, y + h, w, 18); c.globalCompositeOperation = 'source-over'; }
    // A-frame board on the sidewalk
    c.fillStyle = '#1d2024'; c.fillRect(x + w - 30, y + h + 6, 12, 9); c.fillStyle = '#f1efe8'; c.fillRect(x + w - 29, y + h + 7, 10, 7); c.fillStyle = accent; c.fillRect(x + w - 28, y + h + 8, 8, 1); c.fillRect(x + w - 28, y + h + 10, 6, 0.8); c.fillRect(x + w - 28, y + h + 12, 7, 0.8);
  }
  function industrial(c, b, n) {
    const { x, y, w, h } = b, fh = Math.min(62, h * 0.45), front = y + h - fh, [clad, accent] = scheme(b, 'ind'), s = H(x, y, 30);
    roofBase(c, x, y, w, h - fh, '#8a9098', '#a8aeb5');
    c.fillStyle = 'rgba(0,0,0,0.12)'; for (let xx = x + 6; xx < x + w - 4; xx += 5) c.fillRect(xx, y + 4, 0.6, h - fh - 8);
    for (let k = 0; k < 3; k++) { const sy = y + 12 + k * ((h - fh - 24) / 3); c.fillStyle = 'rgba(150,200,230,0.6)'; c.fillRect(x + 14, sy, w - 28, 4); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x + 14, sy, w - 28, 0.6); }
    if (s < 0.6) solar(c, x + w - 84, y + 10, 4, 1);
    // ribbed metal cladding
    c.fillStyle = clad; c.fillRect(x, front, w, fh); for (let xx = x; xx < x + w; xx += 4) { c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(xx, front, 1, fh); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(xx + 2.5, front, 1, fh); }
    c.fillStyle = accent; c.fillRect(x, front + 4, w, 3);
    // roll-up doors with numbers + dock bumpers + bollards
    const doors = Math.max(1, Math.min(3, Math.floor(w / 80))); for (let k = 0; k < doors; k++) {
      const dw = 48, dx = x + (w - doors * dw - (doors - 1) * 16) / 2 + k * (dw + 16), dy = y + h - 34;
      c.fillStyle = '#1a2028'; c.fillRect(dx - 2, dy - 2, dw + 4, 36); c.fillStyle = '#b9c2ca'; c.fillRect(dx, dy, dw, 34); c.fillStyle = 'rgba(0,0,0,0.25)'; for (let r = 0; r < 34; r += 3) c.fillRect(dx, dy + r, dw, 0.7);
      c.fillStyle = '#1d2024'; c.fillRect(dx - 3, dy + 26, 3, 6); c.fillRect(dx + dw, dy + 26, 3, 6);
      c.font = FONT(9); c.fillStyle = accent; c.textAlign = 'center'; c.fillText(String(k + 1), dx + dw / 2, dy - 4);
      for (const bx of [dx - 7, dx + dw + 5]) { c.fillStyle = '#e2c24a'; c.fillRect(bx, y + h + 2, 3, 6); c.fillStyle = '#1d2024'; c.fillRect(bx, y + h + 4, 3, 1); }
    }
    lightbox(c, x + 8, front + 10, Math.min(90, w * 0.4), 11, brand(b), '#1a2028', accent, n > 0.3);
    if (n > 0.3) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,240,200,0.18)'; c.beginPath(); c.moveTo(x + w / 2 - 8, front + 12); c.lineTo(x + w / 2 + 8, front + 12); c.lineTo(x + w / 2 + 28, y + h + 14); c.lineTo(x + w / 2 - 28, y + h + 14); c.closePath(); c.fill(); c.globalCompositeOperation = 'source-over'; }
  }
  function club(c, b, n) {
    const { x, y, w, h } = b, fh = Math.min(62, h * 0.45), front = y + h - fh, t = performance.now() / 1000, hue = (t * 40 + H(x, y, 40) * 360) % 360, led = `hsl(${hue},100%,62%)`;
    roofBase(c, x, y, w, h - fh, '#1d2024', '#2b2f36');
    billboard(c, x + 16, y + 12, w - 32, Math.min(30, h - fh - 26), H(x, y, 41));
    c.fillStyle = '#0b0d12'; c.fillRect(x, front, w, fh);
    // video wall
    const vx = x + 14, vy = front + 8, vw = w - 28, vh = fh - 26; c.fillStyle = '#05070c'; c.fillRect(vx - 1, vy - 1, vw + 2, vh + 2);
    for (let k = 0; k < 12; k++) { c.fillStyle = `hsla(${(hue + k * 30) % 360},100%,55%,${0.35 + 0.35 * Math.sin(t * 3 + k)})`; c.fillRect(vx + (k % 6) * vw / 6, vy + Math.floor(k / 6) * vh / 2, vw / 6 - 1, vh / 2 - 1); }
    c.font = FONT(12); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff'; c.shadowColor = led; c.shadowBlur = 12; c.fillText(brand(b), x + w / 2, vy + vh / 2 + 0.5); c.shadowBlur = 0;
    // LED outline
    c.strokeStyle = led; c.lineWidth = 1.5; c.strokeRect(x + 1.5, front + 1.5, w - 3, fh - 3); if (n > 0.2) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = led.replace('62%)', '62%,0.25)').replace('hsl', 'hsla'); c.lineWidth = 6; c.strokeRect(x + 1.5, front + 1.5, w - 3, fh - 3); c.globalCompositeOperation = 'source-over'; }
    // door + rope line
    c.fillStyle = '#1a1424'; c.fillRect(x + w / 2 - 12, y + h - 16, 24, 16); c.fillStyle = led; c.fillRect(x + w / 2 - 12, y + h - 17, 24, 1);
    for (let k = 0; k < 5; k++) { c.fillStyle = '#c9d1d6'; c.fillRect(x + w / 2 + 18 + k * 12, y + h + 4, 2, 7); } c.strokeStyle = '#c84659'; c.lineWidth = 1.2; c.beginPath(); for (let k = 0; k < 4; k++) { const ax = x + w / 2 + 19 + k * 12; c.moveTo(ax, y + h + 5); c.quadraticCurveTo(ax + 6, y + h + 9, ax + 12, y + h + 5); } c.stroke();
    if (n > 0.2) lit({ x: x + w / 2, y: front + fh / 2, w: w - 20, h: fh - 10, c: led });
  }
  function draw(b) {
    let c = null; try { c = g; } catch { return; } // eslint-disable-line no-undef
    try { if (typeof camera !== 'undefined' && (b.x + b.w + 48 < camera.x || b.y + b.h + 48 < camera.y || b.x > camera.x + (typeof W !== 'undefined' ? W : 1200) / camera.zoom || b.y > camera.y + (typeof H !== 'undefined' ? 800 : 800) / camera.zoom)) return; } catch { /* n/a */ } // eslint-disable-line no-undef
    const n = night(), a = archetype(b);
    c.save(); shadow(c, b);
    if (a === 'tower') tower(c, b, n); else if (a === 'mid') midrise(c, b, n); else if (a === 'ind') industrial(c, b, n); else if (a === 'club') club(c, b, n); else store(c, b, n);
    c.restore(); st.buildings++;
  }

  // ---------- lots (outer regions; city-data.js sets b.lot + footprints) ----------
  function lots(c, width, height, view) {
    let B = []; try { B = root.NightshiftCityData?.createBuildings?.() || []; } catch { return; }
    for (const b of B) {
      if (!b.lot || b.lotPainted === false) continue; const bx = Math.floor(b.x / 440) * 440, by = Math.floor(b.y / 340) * 340;
      if (view && (bx + 500 < view.x || bx - 60 > view.x + view.w || by + 400 < view.y || by - 60 > view.y + view.h)) continue;
      const L = b.lot, ix = bx + 86, iy = by + 84, iw = 268, ih = 172; st.lots++;
      if (L === 'parking') { const px = bx + 86, pw = b.x - bx - 96; c.fillStyle = '#2a3038'; c.fillRect(px, iy, pw, ih); c.fillStyle = 'rgba(240,240,230,0.75)'; for (let k = 0; k <= Math.floor(ih / 22); k++) { c.fillRect(px + 4, iy + k * 22, pw * 0.42, 1); c.fillRect(px + pw * 0.58 - 4, iy + k * 22, pw * 0.42, 1); } for (let k = 0; k < Math.floor(ih / 22); k++) { c.fillStyle = '#c9c2b2'; c.fillRect(px + 8, iy + k * 22 + 9, 3, 6); c.fillRect(px + pw - 11, iy + k * 22 + 9, 3, 6); } c.fillStyle = 'rgba(240,240,230,0.5)'; c.font = FONT(8); c.textAlign = 'center'; c.fillText('P', px + pw / 2, iy + 14); c.textAlign = 'left'; c.fillStyle = '#3ad0a0'; c.fillRect(px + 2, iy + ih - 12, 6, 10); c.fillStyle = '#f1efe8'; c.font = FONT(6); c.fillText('EV', px + 5, iy + ih - 5); }
      else if (L === 'plaza') { const py = b.y + b.h + 6, ph = by + 254 - py; c.fillStyle = '#c9c2b2'; c.fillRect(ix, py, iw, ph); c.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = ix; k < ix + iw; k += 10) c.fillRect(k, py, 0.5, ph); for (let k = py; k < py + ph; k += 10) c.fillRect(ix, k, iw, 0.5); const fx = ix + iw / 2, fy = py + ph / 2; c.fillStyle = '#8a939b'; c.beginPath(); c.arc(fx, fy, 14, 0, Math.PI * 2); c.fill(); c.fillStyle = '#4fa8d8'; c.beginPath(); c.arc(fx, fy, 12, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(fx, fy, 3, 0, Math.PI * 2); c.fill(); for (const tx of [ix + 30, ix + iw - 30]) { c.fillStyle = '#5a6168'; c.fillRect(tx - 8, fy - 8, 16, 16); c.fillStyle = '#3e6a38'; c.beginPath(); c.arc(tx, fy, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = '#6fa05a'; c.beginPath(); c.arc(tx - 2, fy - 2, 5, 0, Math.PI * 2); c.fill(); } }
      else if (L === 'court') { const cx = b.x + b.w + 10, cw = bx + 354 - cx; c.fillStyle = '#2f6b8a'; c.fillRect(cx, iy, cw, ih); c.fillStyle = '#c8573a'; c.fillRect(cx + 6, iy + 6, cw - 12, ih - 12); c.strokeStyle = '#f1efe8'; c.lineWidth = 1; c.strokeRect(cx + 6, iy + 6, cw - 12, ih - 12); c.beginPath(); c.moveTo(cx + 6, iy + ih / 2); c.lineTo(cx + cw - 6, iy + ih / 2); c.stroke(); c.beginPath(); c.arc(cx + cw / 2, iy + ih / 2, 12, 0, Math.PI * 2); c.stroke(); for (const yy of [iy + 6, iy + ih - 6]) { c.beginPath(); c.arc(cx + cw / 2, yy, 22, yy < iy + ih / 2 ? 0 : Math.PI, yy < iy + ih / 2 ? Math.PI : 0); c.stroke(); c.fillStyle = '#f1efe8'; c.fillRect(cx + cw / 2 - 6, yy - 1, 12, 2); } c.fillStyle = '#1d2024'; c.fillRect(cx - 2, iy - 2, cw + 4, 2); }
      else if (L === 'park') { c.fillStyle = '#4f7a46'; c.fillRect(ix, iy, iw, ih); c.fillStyle = 'rgba(0,0,0,0.06)'; for (let k = 0; k < 220; k++) c.fillRect(ix + H(bx, k, 1) * iw, iy + H(by, k, 2) * ih, 1, 1); c.strokeStyle = '#c9b08a'; c.lineWidth = 6; c.beginPath(); c.moveTo(ix, iy + ih * 0.7); c.bezierCurveTo(ix + iw * 0.3, iy + ih * 0.4, ix + iw * 0.6, iy + ih * 0.9, ix + iw, iy + ih * 0.5); c.stroke(); c.fillStyle = '#3a8ab8'; c.beginPath(); c.ellipse(ix + iw * 0.3, iy + ih * 0.3, 26, 14, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(ix + iw * 0.27, iy + ih * 0.27, 10, 4, 0, 0, Math.PI * 2); c.fill(); for (let k = 0; k < 7; k++) { const tx = ix + 20 + H(bx, by, 10 + k) * (iw - 40), ty = iy + 20 + H(bx, by, 20 + k) * (ih - 40); c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(tx + 4, ty + 5, 11, 6, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2d6657'; c.beginPath(); c.arc(tx, ty, 10, 0, Math.PI * 2); c.fill(); c.fillStyle = '#60936f'; c.beginPath(); c.arc(tx - 3, ty - 3, 5, 0, Math.PI * 2); c.fill(); } }
      else if (L === 'gas') { c.fillStyle = '#3a4048'; c.fillRect(ix, iy + 90, 150, 80); c.fillStyle = 'rgba(255,255,255,0.5)'; for (let k = 0; k < 3; k++) c.fillRect(ix + 20 + k * 45, iy + 100, 1, 60); for (let k = 0; k < 3; k++) { const px = ix + 38 + k * 45, py = iy + 122; c.fillStyle = '#e8eef3'; c.fillRect(px - 5, py, 10, 16); c.fillStyle = '#c84659'; c.fillRect(px - 5, py, 10, 3); c.fillStyle = '#3ad0a0'; c.fillRect(px - 3, py + 5, 6, 3); } }
      else if (L === 'twin') { const ax = b.x + b.w, aw = 20; c.fillStyle = '#2a3038'; c.fillRect(ax, iy, aw, ih); c.fillStyle = 'rgba(255,255,255,0.15)'; for (let k = iy; k < iy + ih; k += 14) c.fillRect(ax + aw / 2 - 0.5, k, 1, 7); }
    }
  }
  // live overhead pieces: gas station canopy
  function overheads() {
    let c = null, B = []; try { c = g; B = buildings; } catch { return; } // eslint-disable-line no-undef
    let p = null; try { p = player; } catch { return; } // eslint-disable-line no-undef
    for (const b of B) { if (b.lot !== 'gas' || Math.abs(b.x - p.x) > 900 || Math.abs(b.y - p.y) > 600) continue; const bx = Math.floor(b.x / 440) * 440 + 86, by = Math.floor(b.y / 340) * 340 + 84 + 96, n = night();
      c.save(); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(bx + 6, by + 10, 150, 64); c.fillStyle = '#f1efe8'; c.fillRect(bx, by, 150, 60); c.fillStyle = '#c84659'; c.fillRect(bx, by, 150, 5); c.fillRect(bx, by + 55, 150, 5); c.font = FONT(9); c.textAlign = 'center'; c.fillStyle = '#1d2024'; c.fillText('VOLT · FUEL + EV', bx + 75, by + 32);
      if (n > 0.3) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(230,240,255,0.18)'; c.fillRect(bx - 20, by + 60, 190, 30); c.globalCompositeOperation = 'source-over'; } c.restore(); }
  }

  // ---------- modern traffic + people ----------
  const MODERN = ['CX:brick', 'CX:ridgeback', 'CX:aurora', 'CX:kestrel', 'CX:vortex', 'CX:mule', 'CX:phantom', 'CX:ridgeback', 'CX:brick', 'CX:aurora'];
  function modernizeCars() {
    const lists = []; try { lists.push(root.NightshiftTraffic?.actors || []); lists.push(cars); } catch { /* n/a */ } // eslint-disable-line no-undef
    for (const L of lists) for (const v of L) {
      if (!v || v.__modern || v.police || v.owner || v.taxi) continue; v.__modern = true;
      if (!v.model || v.model === 'SEDAN' || v.model === 'COMPACT' || (typeof v.model === 'string' && /monarch|velvet/.test(v.model) && H(v.x, v.y, 50) < 0.7)) {
        const m = MODERN[Math.floor(H(v.x, v.y, 51) * MODERN.length)]; v.model = m; const spec = root.NightshiftCarsData?.fromModel?.(m); if (spec?.colors) v.color = spec.colors[Math.floor(H(v.x, v.y, 52) * spec.colors.length)];
      }
    }
  }
  function ledLights(v) {
    let c = null; try { c = g; } catch { return; } // eslint-disable-line no-undef
    let p = null; try { p = player; } catch { return; } // eslint-disable-line no-undef
    if (!v || Math.abs(v.x - p.x) > 800 || Math.abs(v.y - p.y) > 520) return;
    const spec = root.NightshiftCarsData?.fromModel?.(v.model), L = (spec?.len || 52) / 2, Wd = (spec?.wid || 26) / 2;
    c.save(); c.translate(v.x, v.y); c.rotate(v.angle || 0);
    c.fillStyle = '#eaf6ff'; c.fillRect(L - 3, -Wd + 3, 1.2, Wd * 0.7); c.fillRect(L - 3, Wd - 3 - Wd * 0.7, 1.2, Wd * 0.7); // LED DRLs
    c.fillStyle = '#ff2a3a'; c.fillRect(-L + 1.5, -Wd + 3, 1.2, Wd * 2 - 6); // full-width tail bar
    if (night() > 0.3) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,40,60,0.25)'; c.fillRect(-L - 4, -Wd + 2, 6, Wd * 2 - 4); c.globalCompositeOperation = 'source-over'; }
    c.restore();
  }
  // people: earbuds / phones (cheap overlay on peds near you)
  function accessories() {
    let c = null, P = [], pl = null; try { c = g; P = peds; pl = player; } catch { return; } // eslint-disable-line no-undef
    for (const q of P) { if (Math.abs(q.x - pl.x) > 600 || Math.abs(q.y - pl.y) > 400) continue; const s = H(q.id ? String(q.id).length * 97 + (q.id.charCodeAt?.(q.id.length - 1) || 0) : q.x, 3, 60); if (s < 0.35) { c.fillStyle = '#f4f6f8'; c.beginPath(); c.arc(q.x - 4.5, q.y - 27, 1.1, 0, Math.PI * 2); c.arc(q.x + 4.5, q.y - 27, 1.1, 0, Math.PI * 2); c.fill(); } }
  }
  // e-scooter riders + delivery robots (ambient, around you)
  const riders = [];
  function ridersTick(dt) {
    let pl = null; try { pl = player; } catch { return; } // eslint-disable-line no-undef
    while (riders.length < 4) { const horiz = Math.random() < 0.5, j = Math.round((pl[horiz ? 'y' : 'x'] + (Math.random() - 0.5) * 900) / (horiz ? 340 : 440)), lane = (Math.random() < 0.5 ? -1 : 1) * 48, dir = Math.random() < 0.5 ? -1 : 1, along = (horiz ? pl.x : pl.y) - dir * 700;
      const robot = Math.random() < 0.3; riders.push({ horiz, x: horiz ? along : j * 440 + lane + (robot ? lane * 0.4 : 0), y: horiz ? j * 340 + lane + (robot ? lane * 0.4 : 0) : along, dir, robot, speed: robot ? 22 : 120 + Math.random() * 40, id: 'rider-' + Math.floor(Math.random() * 1e6), walkTicks: 0 }); st.riders++; }
    for (let i = riders.length - 1; i >= 0; i--) { const r = riders[i]; if (r.horiz) r.x += r.dir * r.speed * dt; else r.y += r.dir * r.speed * dt; r.angle = r.horiz ? (r.dir > 0 ? 0 : Math.PI) : (r.dir > 0 ? Math.PI / 2 : -Math.PI / 2); if (Math.abs(r.x - pl.x) > 1100 || Math.abs(r.y - pl.y) > 800) riders.splice(i, 1); }
  }
  function drawRiders() {
    let c = null; try { c = g; } catch { return; } // eslint-disable-line no-undef
    for (const r of riders) {
      c.save(); c.translate(r.x, r.y); c.rotate(r.angle);
      if (r.robot) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-7, -5, 15, 11); c.fillStyle = '#f4f6f8'; rr(c, -8, -6, 15, 11, 3); c.fill(); c.fillStyle = '#1d2024'; c.fillRect(4, -4, 2, 7); c.fillStyle = (Math.floor(performance.now() / 300) % 2) ? '#3ad0a0' : '#1a5a4a'; c.fillRect(-6, -4, 3, 2); c.strokeStyle = '#ff7a3a'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-6, 3); c.lineTo(-10, 8); c.stroke(); c.fillStyle = '#ff7a3a'; c.fillRect(-12, 7, 3, 2); c.restore(); continue; }
      c.fillStyle = '#1d2024'; c.fillRect(-10, -2.5, 20, 5); c.fillStyle = '#3ad0a0'; c.fillRect(-9, -1.5, 3, 3); c.fillStyle = '#9aa3ab'; c.fillRect(8, -1, 2, 2); c.fillStyle = '#0b0d14'; c.beginPath(); c.arc(-9, 0, 2.5, 0, Math.PI * 2); c.arc(9, 0, 2.5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#5a6168'; c.fillRect(8, -6, 1.5, 12);
      c.restore();
      try { root.NightshiftSprites?.person?.({ x: r.x, y: r.y - 3, angle: r.angle, moving: false, hp: 40, id: r.id }, false, { hideHealth: true }); } catch { /* n/a */ }
    }
  }

  // ---------- install ----------
  function install() {
    const W = root.NightshiftWorld; if (!W || typeof W.building !== 'function' || W.__modern) return !!W?.__modern;
    W.__oldBuilding = W.building; W.building = function (b) { try { draw(b); } catch (e) { console.error(e); try { W.__oldBuilding(b); } catch { /* n/a */ } } }; W.awningActors = () => []; W.signActors = () => []; W.__modern = true; return true;
  }
  install();
  const hook = setInterval(() => {
    install();
    const T = root.NightshiftTraffic, S = root.NightshiftSprites, C = root.NightshiftCrime;
    if (S && typeof S.car === 'function' && !S.__modernLed) { const c0 = S.car; S.car = function (v) { const r = c0.apply(this, arguments); try { if (!v?.police && !v?.taxi) ledLights(v); } catch { /* cosmetic */ } return r; }; S.__modernLed = true; }
    if (C && typeof C.draw === 'function' && !C.__modern) { const d0 = C.draw; C.draw = function () { const r = d0.apply(this, arguments); try { accessories(); drawRiders(); overheads(); } catch { /* cosmetic */ } return r; }; C.__modern = true; }
    if (root.NightshiftWorld?.__modern && S?.__modernLed && C?.__modern) clearInterval(hook); void T;
  }, 250);
  let last = 0; (function tick(now) { const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now; let zone = false; try { zone = !!(root.NightshiftZones?.active?.() || root.NightshiftHome?.kind?.()); } catch { /* n/a */ } if (!zone) ridersTick(dt); requestAnimationFrame(tick); })(performance.now());
  setInterval(() => { try { modernizeCars(); } catch { /* n/a */ } }, 1500);
  root.NightshiftModern = Object.freeze({ on: true, archetype, lots, draw, stats: () => ({ ...st, riders: riders.length }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
