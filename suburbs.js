/* Palm Grove — the suburbs zone (Claude-owned). Requires zones.js, breakin.js, pets.js, pets-data.js, supply-data.js.
 * Quiet streets with something to steal: six houses and a gated mansion you can break into (breakin.js), the
 * Golden Pawn (fences jewellery, electronics and art), Paws & Claws (adopt pets, pet food), Prestige Motors (body kits
 * for your own cars), a park, and a dream house for sale whose driveway shows off your cars.
 * Procedural pixel art; static buildings are pre-rendered into sprites, water/sprinklers/swings/people animate. */
(function (root) {
  'use strict';
  if (!root.document) return;
  const Z = root.NightshiftZones, BI = root.NightshiftBreakinData, PD = root.NightshiftPetsData, SD = root.NightshiftSupplyData;
  if (!Z || !BI || !PD) return;
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const O = (c, col, x, y, rx, ry) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); c.fill(); };
  const C = (c, col, x, y, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const sprite = (w, h, paint) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; paint(x); return cv; };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const CARS = () => { try { return cars; } catch { return []; } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const PETS = () => root.NightshiftPets;

  const MAP = { w: 2000, h: 1400 };
  const ROADS = [{ x: 0, y: 640, w: 2000, h: 60 }, { x: 0, y: 1050, w: 2000, h: 50 }, { x: 560, y: 60, w: 50, h: 1340 }, { x: 1220, y: 60, w: 50, h: 1340 }];
  const HOUSES = [
    { id: 'bi-pg-1', name: '14 Palm Ave', x: 150, y: 330, w: 250, h: 150, face: 's', roof: ['#7a4a3a', '#5e3a2e'], wall: '#e9dcc4', pool: { x: 170, y: 150, w: 170, h: 90 }, drive: { x: 330, y: 480, w: 50, h: 160 }, car: '#3d99d6', yard: 'pool' },
    { id: 'bi-pg-2', name: '22 Palm Ave', x: 660, y: 350, w: 230, h: 140, face: 's', roof: ['#3e4a5a', '#2e3846'], wall: '#c9d8e8', drive: { x: 840, y: 490, w: 46, h: 150 }, car: '#e2b75c', yard: 'trampoline' },
    { id: 'bi-pg-3', name: '30 Palm Ave', x: 960, y: 350, w: 230, h: 140, face: 's', roof: ['#6a5a3a', '#54462c'], wall: '#f0d8c0', drive: { x: 1000, y: 490, w: 46, h: 150 }, car: '#c84659', yard: 'garden' },
    { id: 'bi-pg-4', name: '7 Grove Ln', x: 150, y: 780, w: 250, h: 150, face: 'n', roof: ['#4a5a3e', '#3a482e'], wall: '#e8e2d0', pool: { x: 170, y: 960, w: 160, h: 64 }, drive: { x: 330, y: 700, w: 50, h: 80 }, car: '#f1efe8', yard: 'pool' },
    { id: 'bi-pg-5', name: '19 Grove Ln', x: 660, y: 1150, w: 230, h: 140, face: 'n', roof: ['#8a5a4a', '#6e4638'], wall: '#f2e6d0', drive: { x: 840, y: 1100, w: 46, h: 50 }, car: '#6d73be', yard: 'swing' },
    { id: 'bi-pg-6', name: '25 Grove Ln', x: 960, y: 1150, w: 230, h: 140, face: 'n', roof: ['#3a3f45', '#2b2f33'], wall: '#d8e0e8', drive: { x: 1000, y: 1100, w: 46, h: 50 }, car: '#1d2433', yard: 'garden' },
  ];
  const MANSION = { id: 'bi-pg-mansion', name: 'The Halvorsen Estate', x: 1440, y: 140, w: 400, h: 220, wallX: 1300, wallY: 70, wallW: 680, wallH: 550 };
  const MALL = { x: 640, y: 720, w: 560, h: 140 }, SHOW = { x: 1300, y: 722, w: 430, h: 150 }, LOT = { x: 1300, y: 890, w: 680, h: 150 };
  const DREAM = { x: 1450, y: 1160, w: 330, h: 150, face: 'n' }, PARK = { x: 30, y: 1110, w: 500, h: 270 };
  const backDoor = (h) => (h.face === 's' ? { x: h.x + h.w / 2, y: h.y - 14 } : { x: h.x + h.w / 2, y: h.y + h.h + 14 });
  const TREES = []; { const r = rng(9); for (let i = 0; i < 60; i++) { const x = 20 + r() * 1960, y = 20 + r() * 1360; if (ROADS.some((q) => x > q.x - 40 && x < q.x + q.w + 40 && y > q.y - 40 && y < q.y + q.h + 110)) continue; if (HOUSES.some((h) => h.drive && x > h.drive.x - 30 && x < h.drive.x + h.drive.w + 30 && y > h.drive.y - 20 && y < h.drive.y + h.drive.h + 60)) continue; if ([...HOUSES, MALL, SHOW, LOT, DREAM].some((b) => x > b.x - 40 && x < b.x + b.w + 40 && y > b.y - 60 && y < b.y + b.h + 40)) continue; if (x > MANSION.wallX - 20 && x < MANSION.wallX + MANSION.wallW + 20 && y > MANSION.wallY - 20 && y < MANSION.wallY + MANSION.wallH + 20) continue; if (HOUSES.some((h) => h.pool && x > h.pool.x - 30 && x < h.pool.x + h.pool.w + 30 && y > h.pool.y - 30 && y < h.pool.y + h.pool.h + 30)) continue; TREES.push({ x, y, palm: r() < 0.55, s: 0.85 + r() * 0.4 }); } }
  for (let x = 60; x < MAP.w; x += 150) { if (x > 540 && x < 640) continue; if (x > 1200 && x < 1290) continue; if (HOUSES.some((h) => h.drive && x > h.drive.x - 34 && x < h.drive.x + h.drive.w + 34)) continue; TREES.push({ x, y: 628, palm: true, s: 1 }); }

  // ---------------- sprites ----------------
  function houseSprite(h, lit) {
    return sprite(h.w + 20, h.h + 30, (c) => {
      const ox = 10, oy = 10, w = h.w, H = h.h, [r1, r2] = h.roof, r = rng(h.x + h.y);
      R(c, '#00000045', ox + 8, oy + 10, w, H + 6);
      // hip roof: four facets
      const fy = h.face === 's' ? oy : oy + 18, fh = H - 18;
      R(c, r1, ox, fy, w, fh);
      c.fillStyle = r2; c.beginPath(); c.moveTo(ox, fy); c.lineTo(ox + fh / 2, fy + fh / 2); c.lineTo(ox, fy + fh); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(ox + w, fy); c.lineTo(ox + w - fh / 2, fy + fh / 2); c.lineTo(ox + w, fy + fh); c.closePath(); c.fill();
      c.fillStyle = '#ffffff1c'; c.beginPath(); c.moveTo(ox, fy); c.lineTo(ox + w, fy); c.lineTo(ox + w - fh / 2, fy + fh / 2); c.lineTo(ox + fh / 2, fy + fh / 2); c.closePath(); c.fill();
      for (let yy = 3; yy < fh; yy += 5) R(c, '#00000018', ox + 2, fy + yy, w - 4, 1);
      R(c, '#00000040', ox + fh / 2, fy + fh / 2 - 1, w - fh, 3); R(c, '#ffffff25', ox + fh / 2, fy + fh / 2 - 2, w - fh, 1); // ridge
      R(c, '#7a6a5a', ox + w * 0.72, fy + 10, 14, 18); R(c, '#5a4a3a', ox + w * 0.72, fy + 10, 14, 3);
      if (r() < 0.6) { for (let k = 0; k < 3; k++) { R(c, '#1d2a3a', ox + 24 + k * 22, fy + fh * 0.62, 20, 13); R(c, '#3a5a7a', ox + 25 + k * 22, fy + fh * 0.62 + 1, 18, 11); R(c, '#5a7a9a', ox + 25 + k * 22, fy + fh * 0.62 + 1, 18, 1); } } // solar panels
      R(c, '#9fc3d6aa', ox + w * 0.42, fy + 12, 16, 12); R(c, '#e8f2f8', ox + w * 0.42, fy + 12, 16, 2); // skylight
      // facade strip
      const sy = h.face === 's' ? oy + H - 18 : oy;
      R(c, h.wall, ox, sy, w, 18); for (let k = 0; k < 18; k += 4) R(c, '#00000010', ox, sy + k, w, 1);
      R(c, '#00000033', ox, h.face === 's' ? sy : sy + 17, w, 1);
      const win = (x) => { R(c, '#2b2218', x - 1, sy + 3, 16, 11); R(c, lit ? '#ffd27a' : '#6f9fb8', x, sy + 4, 14, 9); R(c, '#ffffff55', x + 1, sy + 5, 4, 3); R(c, '#2b2218', x + 6, sy + 4, 1, 9); };
      win(ox + 16); win(ox + 44); win(ox + w - 130);
      R(c, '#7a3a2a', ox + w * 0.36, sy + 1, 16, 17); C(c, '#e0b021', ox + w * 0.36 + 12, sy + 10, 1.3);
      const gx = h.face === 's' ? (h.drive.x - h.x) : (h.drive.x - h.x); R(c, '#d8d0c0', ox + gx - 10, sy + 1, h.drive.w + 20, 17); for (let k = 0; k < 6; k++) R(c, '#b9b0a2', ox + gx - 10, sy + 2 + k * 3, h.drive.w + 20, 1);
    });
  }
  const mansionSprite = (lit) => sprite(MANSION.w + 24, MANSION.h + 40, (c) => {
    const ox = 12, oy = 12, w = MANSION.w, H = MANSION.h;
    R(c, '#00000048', ox + 10, oy + 12, w, H + 8);
    R(c, '#4a4a5a', ox, oy, w, H - 30); for (let yy = 3; yy < H - 30; yy += 6) R(c, '#3e3e4c', ox, oy + yy, w, 1);
    R(c, '#5a5a6c', ox + 120, oy - 6, 160, H - 24); for (let yy = 0; yy < H - 24; yy += 6) R(c, '#4c4c5e', ox + 120, oy - 6 + yy, 160, 1); // central block
    R(c, '#ffffff20', ox, oy, w, 2); R(c, '#2a2a36', ox + 198, oy - 6, 4, H - 24);
    for (const cx of [ox + 40, ox + w - 60]) { R(c, '#7a6a5a', cx, oy + 20, 16, 22); R(c, '#5a4a3a', cx, oy + 20, 16, 3); }
    R(c, '#f2ead8', ox, oy + H - 30, w, 30); for (let k = 0; k < w; k += 20) R(c, '#e0d6c0', ox + k, oy + H - 30, 2, 30);
    for (let k = 0; k < 8; k++) { const x = ox + 20 + k * 48; if (k === 3 || k === 4) continue; R(c, '#2b2218', x - 1, oy + H - 26, 18, 18); R(c, lit ? '#ffd27a' : '#6f9fb8', x, oy + H - 25, 16, 16); R(c, '#2b2218', x + 7, oy + H - 25, 1, 16); R(c, '#2b2218', x, oy + H - 18, 16, 1); }
    for (let k = 0; k < 5; k++) R(c, '#ffffff', ox + 150 + k * 25, oy + H - 34, 6, 34); // columns
    R(c, '#5a2a1a', ox + 188, oy + H - 26, 24, 26); C(c, '#e3c25a', ox + 206, oy + H - 12, 1.6);
  });
  const mallSprite = (lit) => sprite(MALL.w + 20, MALL.h + 26, (c) => {
    const ox = 10, oy = 10, w = MALL.w, H = MALL.h;
    R(c, '#00000045', ox + 8, oy + 10, w, H + 6);
    R(c, '#8a8f94', ox, oy, w, H - 40); for (let k = 0; k < 40; k++) R(c, '#7d8287', ox + (k * 97) % w, oy + (k * 53) % (H - 40), 3, 2);
    for (let k = 0; k < 5; k++) { R(c, '#5d646b', ox + 30 + k * 110, oy + 20, 40, 26); R(c, '#9aa3ab', ox + 32 + k * 110, oy + 22, 36, 3); } // AC units
    R(c, '#e8e2d0', ox, oy + H - 40, w, 40);
    const stores = [['GOLDEN PAWN', '#c9a24a', '#2b2218'], ['PAWS & CLAWS', '#3d7fd0', '#f2f2ee'], ['SUNNY SUDS', '#5fb7e0', '#1d2433']];
    stores.forEach(([name, col, txt], i) => {
      const sx = ox + i * (w / 3), sw = w / 3;
      R(c, col, sx + 6, oy + H - 46, sw - 12, 12); c.fillStyle = txt; c.font = 'bold 9px monospace'; c.textAlign = 'center'; c.fillText(name, sx + sw / 2, oy + H - 37);
      for (let k = 0; k < 8; k++) R(c, k % 2 ? col : '#f2f2ee', sx + 8 + k * ((sw - 16) / 8), oy + H - 34, (sw - 16) / 8, 6);
      R(c, '#2b3a4a', sx + 14, oy + H - 26, sw - 28, 24); R(c, lit ? '#ffe2a066' : '#9fc3d655', sx + 16, oy + H - 24, sw - 32, 20); R(c, '#ffffff40', sx + 18, oy + H - 23, 18, 6);
      R(c, '#3a2a1a', sx + sw / 2 - 9, oy + H - 22, 18, 22);
      if (i === 0) { for (let b = 0; b < 3; b++) C(c, '#e3c25a', sx + 24 + b * 7, oy + H - 52 - (b === 1 ? 3 : 0), 3); }
      if (i === 1) { C(c, '#f2f2ee', sx + 24, oy + H - 52, 3); for (let b = 0; b < 3; b++) C(c, '#f2f2ee', sx + 20 + b * 4, oy + H - 57, 1.4); }
    });
  });
  const showSprite = (lit) => sprite(SHOW.w + 20, SHOW.h + 26, (c) => {
    const ox = 10, oy = 10, w = SHOW.w, H = SHOW.h;
    R(c, '#00000045', ox + 8, oy + 10, w, H + 6);
    R(c, '#2b2f36', ox, oy, w, H - 70); for (let k = 0; k < w; k += 30) R(c, '#353a42', ox + k, oy, 2, H - 70);
    R(c, '#1d2433', ox, oy + H - 70, w, 70); R(c, '#9fd0e855', ox + 6, oy + H - 64, w - 12, 60); for (let k = 0; k < w; k += 60) R(c, '#d6dde1', ox + k, oy + H - 70, 3, 70);
    R(c, '#111', ox + 20, oy + H - 92, w - 40, 18); c.fillStyle = '#e3c25a'; c.font = 'bold 13px monospace'; c.textAlign = 'center'; c.fillText('PRESTIGE  MOTORS', ox + w / 2, oy + H - 79);
    if (lit) { c.globalCompositeOperation = 'lighter'; R(c, '#e3c25a33', ox + 20, oy + H - 92, w - 40, 18); c.globalCompositeOperation = 'source-over'; }
  });
  function treeSprite(palm, s) {
    const W = Math.round(64 * s), Hh = Math.round(96 * s);
    return sprite(W, Hh, (c) => {
      const cx = W / 2, base = Hh - 6;
      O(c, '#00000033', cx + 9 * s, base - 1, 22 * s, 7 * s);
      if (palm) {
        for (let k = 0; k < 9; k++) R(c, k % 2 ? '#8a6a44' : '#7a5a38', cx - 2 * s + Math.sin(k * 0.4) * s, base - 8 * s - k * 6 * s, 4 * s, 7 * s);
        const top = { x: cx + 3 * s, y: base - 60 * s };
        for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; c.strokeStyle = k % 2 ? '#2f7a3a' : '#3f9448'; c.lineWidth = 4 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(top.x, top.y); c.quadraticCurveTo(top.x + Math.cos(a) * 16 * s, top.y + Math.sin(a) * 10 * s - 6 * s, top.x + Math.cos(a) * 26 * s, top.y + Math.sin(a) * 16 * s + 4 * s); c.stroke(); }
        C(c, '#6a4a2a', top.x, top.y, 3 * s); C(c, '#8a6a2a', top.x + 3 * s, top.y + 2 * s, 2 * s);
      } else {
        R(c, '#5a3d22', cx - 3 * s, base - 28 * s, 6 * s, 28 * s);
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; O(c, '#2f6a34', cx + Math.cos(a) * 13 * s, base - 46 * s + Math.sin(a) * 10 * s, 13 * s, 11 * s); }
        O(c, '#4a9046', cx - 4 * s, base - 50 * s, 13 * s, 10 * s); O(c, '#66a85a', cx - 8 * s, base - 55 * s, 6 * s, 4 * s);
      }
    });
  }
  const SPR = {}; const treeFor = (t) => { const k = `${t.palm}:${t.s.toFixed(2)}`; return SPR[k] || (SPR[k] = treeSprite(t.palm, t.s)); };
  function ensure() {
    if (SPR.ok) return;
    for (const h of HOUSES) { SPR[h.id] = houseSprite(h, false); SPR[h.id + 'L'] = houseSprite(h, true); }
    SPR.dream = houseSprite({ ...DREAM, id: 'dream', roof: ['#2b2f33', '#1d2024'], wall: '#f2f2ee', drive: { x: DREAM.x + 40, y: DREAM.y - 60, w: 250, h: 60 } }, false);
    SPR.dreamL = houseSprite({ ...DREAM, id: 'dream', roof: ['#2b2f33', '#1d2024'], wall: '#f2f2ee', drive: { x: DREAM.x + 40, y: DREAM.y - 60, w: 250, h: 60 } }, true);
    SPR.mansion = mansionSprite(false); SPR.mansionL = mansionSprite(true); SPR.mall = mallSprite(false); SPR.mallL = mallSprite(true); SPR.show = showSprite(false); SPR.showL = showSprite(true);
    SPR.ok = true;
  }

  // ---------------- ground ----------------
  function ground(c) {
    const r = rng(77);
    R(c, '#4f8a42', 0, 0, MAP.w, MAP.h);
    for (let i = 0; i < 9000; i++) R(c, r() < 0.5 ? '#5a9a4a' : '#468038', r() * MAP.w, r() * MAP.h, 2, 2);
    // lawns with mow stripes
    const lawn = (x, y, w, h) => { for (let k = 0; k < w; k += 24) R(c, (k / 24) % 2 ? '#5fa04e' : '#58964a', x + k, y, Math.min(24, w - k), h); };
    for (const h of HOUSES) lawn(h.x - 60, h.face === 's' ? 110 : h.y - 70, h.w + 120, h.face === 's' ? 520 : (h.y < 1000 ? 340 : 280));
    lawn(MANSION.wallX, MANSION.wallY, MANSION.wallW, MANSION.wallH);
    // roads + sidewalks + markings
    for (const q of ROADS) { R(c, '#c9c6bc', q.x - (q.w < q.h ? 14 : 0), q.y - (q.w < q.h ? 0 : 14), q.w + (q.w < q.h ? 28 : 0), q.h + (q.w < q.h ? 0 : 28)); }
    for (const q of ROADS) { R(c, '#d8d5cc', q.x - (q.w < q.h ? 14 : 0), q.y - (q.w < q.h ? 0 : 14), q.w < q.h ? 2 : q.w, q.w < q.h ? q.h : 2); }
    for (const q of ROADS) { R(c, '#3e4248', q.x, q.y, q.w, q.h); for (let i = 0; i < (q.w * q.h) / 60; i++) R(c, r() < 0.5 ? '#464a50' : '#36393e', q.x + r() * q.w, q.y + r() * q.h, 2, 1); }
    for (const q of ROADS) { if (q.w > q.h) for (let x = 10; x < q.w; x += 40) R(c, '#f2f2ee', q.x + x, q.y + q.h / 2 - 1, 20, 2); else for (let y = 70; y < q.h; y += 40) R(c, '#f2f2ee', q.x + q.w / 2 - 1, q.y + y, 2, 20); }
    for (let k = 0; k < MAP.w; k += 22) { R(c, '#b9b6ac', k, 625, 1, 14); R(c, '#b9b6ac', k, 700, 1, 14); R(c, '#b9b6ac', k, 1035, 1, 14); R(c, '#b9b6ac', k, 1100, 1, 14); }
    // crosswalks
    for (const x of [560, 1220]) for (const y of [640, 1050]) for (let k = 0; k < 6; k++) { R(c, '#f2f2ee', x - 20, y + 4 + k * (y === 640 ? 9 : 7.5), 12, 4); R(c, '#f2f2ee', x + 58, y + 4 + k * (y === 640 ? 9 : 7.5), 12, 4); }
    // driveways, paths, pools
    for (const h of HOUSES) {
      const d = h.drive; R(c, '#b9b4a8', d.x, d.y, d.w, d.h); for (let k = 0; k < d.h; k += 10) R(c, '#a8a296', d.x, d.y + k, d.w, 1);
      const px = h.x + h.w * 0.36 + 8, py = h.face === 's' ? h.y + h.h : h.y - 40; R(c, '#c9c0ae', px - 7, py, 14, 40);
      for (let k = 0; k < 6; k++) { O(c, ['#e0473a', '#f2d24a', '#c49bff', '#ff8aa8'][k % 4], h.x + 10 + k * 14, (h.face === 's' ? h.y + h.h + 10 : h.y - 10), 4, 3); O(c, '#3f7a3a', h.x + 10 + k * 14, (h.face === 's' ? h.y + h.h + 13 : h.y - 7), 5, 2); }
      if (h.pool) { const p = h.pool; R(c, '#e8e2d0', p.x - 10, p.y - 10, p.w + 20, p.h + 20); R(c, '#d8d0c0', p.x - 10, p.y - 10, p.w + 20, 2); R(c, '#1f78a8', p.x, p.y, p.w, p.h); R(c, '#9fd8f0', p.x, p.y, p.w, 3); for (let k = 0; k < 3; k++) R(c, '#c9c0ae', p.x + 20 + k * 40, p.y + p.h + 14, 26, 12); }
      // backyard fence
      const fy = h.face === 's' ? 110 : (h.y < 1000 ? 1030 : 1385), fx0 = h.x - 50, fx1 = h.x + h.w + 50;
      for (let x = fx0; x < fx1; x += 12) { R(c, '#f2ead8', x, fy - 10, 4, 12); } R(c, '#f2ead8', fx0, fy - 6, fx1 - fx0, 2);
      R(c, '#5a3d22', h.x + h.w - 12, h.face === 's' ? 612 : 712, 3, 14); R(c, '#2b5fa0', h.x + h.w - 18, h.face === 's' ? 604 : 704, 14, 9); // mailbox
    }
    // mansion grounds: perimeter wall, drive circle, hedges, pool
    const M = MANSION; R(c, '#9a9488', M.wallX, M.wallY, M.wallW, 10); R(c, '#9a9488', M.wallX, M.wallY, 10, M.wallH); R(c, '#9a9488', M.wallX + M.wallW - 10, M.wallY, 10, M.wallH);
    R(c, '#9a9488', M.wallX, M.wallY + M.wallH - 10, 300, 10); R(c, '#9a9488', M.wallX + 380, M.wallY + M.wallH - 10, M.wallW - 380, 10);
    for (let x = M.wallX; x < M.wallX + M.wallW; x += 40) R(c, '#b9b0a2', x, M.wallY - 2, 10, 14);
    O(c, '#c9c0ae', 1640, 470, 130, 70); O(c, '#5fa04e', 1640, 470, 70, 34);
    R(c, '#c9c0ae', 1600, 520, 80, 100);
    for (let k = 0; k < 10; k++) { O(c, '#2f6a34', 1330 + k * 22, 400, 11, 8); O(c, '#2f6a34', 1830 + (k % 5) * 22, 400 + Math.floor(k / 5) * 40, 11, 8); }
    R(c, '#e8e2d0', 1330, 440, 180, 110); R(c, '#1f78a8', 1340, 450, 160, 90); R(c, '#9fd8f0', 1340, 450, 160, 3); for (let k = 0; k < 3; k++) R(c, '#f2f2ee', 1350 + k * 45, 560, 30, 12);
    // strip mall + showroom lots
    R(c, '#3e4248', MALL.x - 20, MALL.y + MALL.h, MALL.w + 40, 1040 - MALL.y - MALL.h); for (let x = MALL.x; x < MALL.x + MALL.w; x += 46) { R(c, '#f2f2ee', x, MALL.y + MALL.h + 40, 2, 50); R(c, '#f2f2ee', x, MALL.y + MALL.h + 100, 2, 50); }
    R(c, '#3e4248', LOT.x, LOT.y - 20, LOT.w, LOT.h + 10); for (let x = LOT.x + 20; x < LOT.x + LOT.w; x += 110) { R(c, '#2b2f36', x, LOT.y + 20, 90, 90); R(c, '#e3c25a', x, LOT.y + 20, 90, 2); R(c, '#e3c25a', x, LOT.y + 108, 90, 2); }
    // dream house driveway
    R(c, '#b9b4a8', DREAM.x + 30, DREAM.y - 60, 270, 60); for (let k = 0; k < 270; k += 90) R(c, '#a8a296', DREAM.x + 30 + k, DREAM.y - 60, 1, 60);
    // park
    R(c, '#5aa04a', PARK.x, PARK.y, PARK.w, PARK.h); R(c, '#c9b88a', PARK.x + 20, PARK.y + PARK.h / 2 - 10, PARK.w - 40, 20); R(c, '#c9b88a', PARK.x + PARK.w / 2 - 10, PARK.y + 10, 20, PARK.h - 20);
    R(c, '#e8d8a8', PARK.x + 40, PARK.y + 30, 120, 80); for (let i = 0; i < 80; i++) R(c, '#d8c898', PARK.x + 40 + r() * 120, PARK.y + 30 + r() * 80, 2, 2); // sandpit under the play set
    O(c, '#6a5a3a', PARK.x + 380, PARK.y + 200, 70, 40); O(c, '#2a6f8f', PARK.x + 380, PARK.y + 200, 62, 33);
  }

  // ---------------- dynamic ----------------
  const joggers = []; { const r = rng(5); for (let i = 0; i < 6; i++) joggers.push({ t: r() * 1000, lane: i % 3, speed: 0.6 + r() * 0.5, color: ['#e0473a', '#3d7fd0', '#f2d24a', '#2f6b3f', '#ff8aa8', '#6d73be'][i], id: 'jog' + i, dir: i % 2 ? 1 : -1 }); }
  function joggerPos(j) {
    const loop = [[30, 625], [1990, 625], [1990, 1035], [30, 1035]], per = 2 * (1960 + 410), d = ((j.t * j.speed * 60) % per + per) % per;
    let acc = 0; for (let i = 0; i < 4; i++) { const a = loop[i], b = loop[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= acc + L) { const f = (d - acc) / L; return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f + j.lane * 3, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) }; } acc += L; }
    return { x: 30, y: 625, angle: 0 };
  }
  function sprinkler(c, x, y, t) { const a = Math.sin(t * 1.5) * 1.1 - Math.PI / 2; c.save(); c.strokeStyle = '#bfe8ff88'; c.lineWidth = 1; for (let k = 0; k < 7; k++) { const aa = a + (k - 3) * 0.06, len = 24 + k % 2 * 6; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(aa) * len * 0.6, y + Math.sin(aa) * len * 0.6 - 10, x + Math.cos(aa) * len, y + Math.sin(aa) * len); c.stroke(); } c.restore(); R(c, '#3a3f45', x - 1, y - 1, 3, 3); }
  function drawWater(c, p, t) { for (let k = 0; k < 10; k++) R(c, '#bfe8ff55', p.x + 8 + ((k * 37 + t * 14) % (p.w - 20)), p.y + 8 + ((k * 23) % (p.h - 16)), 8, 1); }
  function fountain(c, x, y, t) { O(c, '#00000030', x + 3, y + 4, 28, 10); O(c, '#d8d0c2', x, y, 28, 14); O(c, '#1f78a8', x, y - 1, 23, 11); for (let k = 0; k < 8; k++) { const a = k * 0.8 + t * 2; R(c, '#bfe8ff', x + Math.cos(a) * 12, y - 4 + Math.sin(a) * 5, 2, 2); } R(c, '#d8d0c2', x - 3, y - 18, 6, 16); c.save(); c.strokeStyle = '#bfe8ffaa'; c.lineWidth = 1.5; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.beginPath(); c.moveTo(x, y - 20); c.quadraticCurveTo(x + Math.cos(a) * 8, y - 28, x + Math.cos(a) * 14, y - 6 + Math.sin(a) * 4); c.stroke(); } c.restore(); }
  function playset(c, t) {
    const x = PARK.x + 60, y = PARK.y + 40;
    R(c, '#c0473f', x, y, 4, 50); R(c, '#c0473f', x + 70, y, 4, 50); R(c, '#c0473f', x, y, 74, 4);
    for (let k = 0; k < 2; k++) { const sw = Math.sin(t * 2 + k * 2) * 8, sx = x + 18 + k * 30; c.strokeStyle = '#9aa3ab'; c.lineWidth = 1; c.beginPath(); c.moveTo(sx, y + 4); c.lineTo(sx + sw, y + 34); c.moveTo(sx + 10, y + 4); c.lineTo(sx + 10 + sw, y + 34); c.stroke(); R(c, '#2b2218', sx + sw - 1, y + 34, 12, 3); }
    R(c, '#3d7fd0', x + 90, y + 10, 16, 60); R(c, '#5fb7e0', x + 92, y + 12, 12, 56); R(c, '#e0b021', x + 86, y + 4, 24, 10);
  }
  function displayCar(c, x, y, color, kit, angle, t) {
    const S = root.NightshiftSprites;
    if (S?.car) { S.car({ x, y, angle, color, speed: 0, model: 'SEDAN', condition: 100, id: 'show-' + x }); if (kit) root.NightshiftPets?.decals?.(c, { x, y, angle }, kit); }
  }

  // ---------------- panels ----------------
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const pnl = el('div', { id: 'sbPanel', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Shop' }); document.body.append(pnl);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pnl.hidden) { pnl.hidden = true; e.stopImmediatePropagation(); } }, true);
  function head(title, sub) { try { root.releaseControls?.(); } catch { /* n/a */ } pnl.hidden = false; pnl.textContent = ''; const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { pnl.hidden = true; }; top.append(el('h2', {}, title), x); pnl.append(top); if (sub) pnl.append(el('div', { className: 'sub' }, sub)); }
  const row = (icon, title, line, ...btns) => { const r = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:8px;border-radius:12px;background:#ffffff07;border:1px solid #ffffff12;margin-bottom:6px' }); r.append(el('div', { style: 'font-size:24px;width:34px;text-align:center' }, icon)); const t = el('div', { style: 'flex:1' }); t.append(el('b', { style: 'font:700 13px var(--disp,system-ui)' }, title), el('div', { style: 'color:#a9b8ca;font-size:11px' }, line)); r.append(t, ...btns.filter(Boolean)); return r; };
  const btn = (cls, txt, fn, dis) => { const x = el('button', { className: cls, type: 'button', disabled: !!dis }, txt); x.onclick = fn; return x; };
  function openPawn() {
    const p = P(), bag = root.NightshiftSupply?.state?.bag || {}, price = root.NightshiftSkills?.mod?.('dealing.price') ?? 1;
    head('💍 GOLDEN PAWN', `"No questions asked." Sells stolen jewellery, electronics and art. Dealing skill raises what you get. Cash ${money(p?.cash || 0)}`);
    let any = false;
    for (const [id, base] of Object.entries(BI.FENCE)) {
      const n = bag[id] || 0; if (!n) continue; any = true; const m = SD.MATERIALS[id], each = Math.round(base * price);
      pnl.append(row(m.icon, `${m.name} ×${n}`, `${money(each)} each`, btn('go', `SELL ALL · ${money(each * n)}`, () => { if (!root.NightshiftSupply.take({ [id]: n })) return; P().cash += each * n; try { root.NightshiftSkills?.gain('dealing', 10 * n, 'fence'); } catch { /* optional */ } gameSave(); say(`💍 Fenced ${n} ${m.name.toLowerCase()} · +${money(each * n)}`); openPawn(); })));
    }
    if (!any) pnl.append(el('div', { className: 'sub' }, 'Nothing to fence. Break into houses here (back doors) or the city warehouses at night.'));
    const st = root.NightshiftBreakin?.state?.stats; if (st) pnl.append(el('h3', {}, 'YOUR RECORD'), el('div', { className: 'sub' }, `${st.jobs} jobs · ${st.clean} clean · ${money(st.loot)} hauled · ${st.kills} takedowns`));
  }
  function ownedCars() { return CARS().filter((c) => c && c.owned); }
  function openShowroom() {
    const p = P(), mine = ownedCars(), kits = root.NightshiftPets?.state?.kits || {};
    head('🏎️ PRESTIGE MOTORS', `Body kits for the cars you own: real stat boosts plus parts you can see. Fitted on the spot. Cash ${money(p?.cash || 0)}`);
    if (!mine.length) { pnl.append(el('div', { className: 'sub' }, 'You don\'t own a car yet. Buy one in the city (MORE → CAR near a garage), then come back.')); return; }
    for (const car of mine) {
      pnl.append(el('h3', {}, `${car.id.toUpperCase()} · ${(car.model || root.NightshiftVehicles?.model?.(car)?.name || 'CAR')}${kits[car.id] ? ' · ' + PD.KIT[kits[car.id]].name.toUpperCase() : ''}`));
      for (const k of PD.KITS) {
        const has = kits[car.id] === k.id;
        pnl.append(row(k.icon, k.name, `${k.desc} · engine ×${k.engine} · grip ×${k.handling}${k.armor < 1 ? ` · armor ×${k.armor}` : ''}`, has ? el('span', { className: 'okc' }, 'FITTED') : btn('go', money(k.price), () => { const r = root.NightshiftPets.buyKit(car.id, k.id, true); say(r.ok ? `${k.icon} ${k.name} fitted to your car` : r.reason); openShowroom(); }, (p?.cash || 0) < k.price)));
      }
    }
  }
  function openDream() {
    const p = P(), st = root.NightshiftPets?.state;
    if (st?.dream) { head('🏡 YOUR DREAM HOUSE', 'Your cars line up in the driveway for everyone to see. Go inside to furnish every room and fill the garage.'); pnl.append(el('div', { className: 'sub' }, `${ownedCars().length} car${ownedCars().length === 1 ? '' : 's'} on display · ${st.pets.length} pet${st.pets.length === 1 ? '' : 's'}`)); return; }
    head('🏡 FOR SALE · 1 Prestige Row', `A modern four-bed with a three-car drive that shows off whatever you park there. ${money(PD.DREAM_HOUSE)} · you have ${money(p?.cash || 0)}`);
    pnl.append(btn('go', `BUY · ${money(PD.DREAM_HOUSE)}`, () => { const r = root.NightshiftPets.buyDream(); say(r.ok ? '🏡 The dream house is yours! Step inside to furnish it.' : r.reason); if (r.ok) { pnl.hidden = true; if (Z.zones().dreamhome) setTimeout(() => Z.enter('dreamhome'), 400); } else openDream(); }, (p?.cash || 0) < PD.DREAM_HOUSE));
  }

  // ---------------- zone ----------------
  const solids = [
    ...HOUSES.map((h) => ({ x: h.x, y: h.y, w: h.w, h: h.h })), ...HOUSES.filter((h) => h.pool).map((h) => ({ ...h.pool })),
    { x: MANSION.x, y: MANSION.y - 10, w: MANSION.w, h: MANSION.h }, { x: MALL.x, y: MALL.y, w: MALL.w, h: MALL.h - 8 }, { x: SHOW.x, y: SHOW.y, w: SHOW.w, h: SHOW.h - 8 }, { x: DREAM.x, y: DREAM.y, w: DREAM.w, h: DREAM.h },
    { x: MANSION.wallX, y: MANSION.wallY, w: MANSION.wallW, h: 10 }, { x: MANSION.wallX, y: MANSION.wallY, w: 10, h: MANSION.wallH }, { x: MANSION.wallX + MANSION.wallW - 10, y: MANSION.wallY, w: 10, h: MANSION.wallH },
    { x: MANSION.wallX, y: MANSION.wallY + MANSION.wallH - 10, w: 300, h: 10 }, { x: MANSION.wallX + 380, y: MANSION.wallY + MANSION.wallH - 10, w: MANSION.wallW - 380, h: 10 },
    { x: 1340, y: 450, w: 160, h: 90 }, { x: PARK.x + 315, y: PARK.y + 170, w: 130, h: 60 },
    ...TREES.map((t) => ({ x: t.x - 4, y: t.y - 6, w: 8, h: 6 })),
  ];
  const nightNow = () => { const h = (root.NightshiftEnvironment?.state?.minute ?? 720) / 60; return h >= 20 || h < 6; };
  Z.register({
    id: 'suburbs', name: 'Palm Grove', tagline: 'SUBURBS · NICE HOUSES · NICER THINGS INSIDE', w: MAP.w, h: MAP.h, bg: '#3f7a36', zoom: 0.85, spawn: { x: 150, y: 670, angle: 0 }, solids,
    travel: { fare: 6, desc: 'Leafy suburbs. Break into houses and a gated mansion, fence the goods, adopt a pet, kit out your car, buy a dream house.', spawn: { x: 150, y: 670, angle: 0 } },
    ground,
    targets(api) {
      const out = [api.busStop(120, 618)];
      for (const h of HOUSES) { const d = backDoor(h), left = BI.cooldownLeft(root.NightshiftBreakin?.state, h.id, 'house'); out.push({ x: d.x, y: d.y, r: 44, action: left ? 'LOCKED' : 'BREAK IN', label: left ? `${h.name} · on alert for ${Math.ceil(left / 60000)} min` : `${h.name} · back door`, sign: left ? 'ALARM ON' : null, icon: '🚨', color: '#7d8796', lift: 26, use: () => root.NightshiftBreakin?.start({ id: h.id, type: 'house', name: h.name, from: 'suburbs', door: d }) }); }
      { const left = BI.cooldownLeft(root.NightshiftBreakin?.state, MANSION.id, 'mansion'); out.push({ x: 1640, y: 384, r: 50, action: left ? 'LOCKED' : 'BREAK IN', label: left ? `Estate on lockdown · ${Math.ceil(left / 60000)} min` : 'The Halvorsen Estate · guards, a dog, safes and art', sign: 'THE ESTATE', icon: '🏛️', color: left ? '#7d8796' : '#ff8a7a', lift: 44, use: () => root.NightshiftBreakin?.start({ id: MANSION.id, type: 'mansion', name: MANSION.name, from: 'suburbs', door: { x: 1640, y: 384 } }) }); }
      out.push({ x: MALL.x + MALL.w / 6, y: MALL.y + MALL.h + 16, r: 50, action: 'PAWN', label: 'Golden Pawn · fence stolen goods', sign: 'PAWN', icon: '💍', color: '#e3c25a', lift: 80, use: openPawn });
      out.push({ x: MALL.x + MALL.w / 2, y: MALL.y + MALL.h + 16, r: 50, action: 'PETS', label: 'Paws & Claws · adopt pets, pet food', sign: 'PETS', icon: '🐾', color: '#7cc7ff', lift: 80, use: () => root.NightshiftPets?.openPets(true) });
      out.push({ x: SHOW.x + SHOW.w / 2, y: SHOW.y + SHOW.h + 16, r: 60, action: 'KITS', label: 'Prestige Motors · body kits for your cars', sign: 'PRESTIGE MOTORS', icon: '🏎️', color: '#e3c25a', lift: 110, use: openShowroom });
      out.push({ x: DREAM.x + DREAM.w / 2, y: DREAM.y - 70, r: 60, action: root.NightshiftPets?.state?.dream ? 'GO IN' : 'FOR SALE', label: root.NightshiftPets?.state?.dream ? 'Your dream house · furnish it, park your cars' : `Dream house for sale · ${money(PD.DREAM_HOUSE)}`, sign: root.NightshiftPets?.state?.dream ? 'YOUR PLACE' : `FOR SALE · ${money(PD.DREAM_HOUSE)}`, icon: '🏡', color: '#7cdeb5', lift: 12, use: () => (root.NightshiftPets?.state?.dream && Z.zones().dreamhome ? Z.enter('dreamhome') : openDream()) });
      return out;
    },
    drawGround(c, t, api) {
      for (const h of HOUSES) if (h.pool) drawWater(c, h.pool, t); drawWater(c, { x: 1340, y: 450, w: 160, h: 90 }, t);
      O(c, '#2a6f8f', PARK.x + 380, PARK.y + 200, 62, 33); for (let k = 0; k < 6; k++) R(c, '#bfe8ff66', PARK.x + 340 + ((k * 23 + t * 9) % 80), PARK.y + 188 + (k * 7) % 22, 6, 1);
      if (!nightNow()) for (const h of HOUSES) if (h.yard !== 'pool') sprinkler(c, h.x + h.w / 2 + 70, h.face === 's' ? h.y + h.h + 60 : h.y - 50, t + h.x);
      // back-door markers (subtle red tape on doors you've hit)
      for (const h of HOUSES) { const d = backDoor(h); R(c, '#4a3020', d.x - 9, d.y - (h.face === 's' ? 2 : 6), 18, 8); }
    },
    props(api, view) {
      ensure(); const lit = api.darkness() > 0.35, t = performance.now() / 1000, out = [], add = (y, fn) => out.push({ y, draw: fn });
      for (const h of HOUSES) add(h.y + h.h, (c) => c.drawImage(lit ? SPR[h.id + 'L'] : SPR[h.id], h.x - 10, h.y - 10));
      for (const h of HOUSES) { const d = h.drive, cy = h.face === 's' ? d.y + 50 : d.y + d.h / 2; add(cy + 12, (c) => displayCar(c, d.x + d.w / 2, cy, h.car, null, Math.PI / 2, t)); }
      add(MANSION.y + MANSION.h, (c) => c.drawImage(lit ? SPR.mansionL : SPR.mansion, MANSION.x - 12, MANSION.y - 12));
      add(470, (c) => fountain(c, 1640, 470, t));
      add(612, (c) => { R(c, '#5d646b', 1600, 560, 16, 22); R(c, '#9fd0e8', 1602, 562, 12, 8); R(c, '#2b2f33', 1620, 600, 60, 4); R(c, '#e0473a', 1620 + (Math.sin(t) > 0 ? 0 : 40), 598, 20, 3); }); // guard booth + barrier
      add(MALL.y + MALL.h, (c) => c.drawImage(lit ? SPR.mallL : SPR.mall, MALL.x - 10, MALL.y - 10));
      add(SHOW.y + SHOW.h, (c) => { c.drawImage(lit ? SPR.showL : SPR.show, SHOW.x - 10, SHOW.y - 10); });
      add(SHOW.y + SHOW.h - 30, (c) => { displayCar(c, SHOW.x + 120, SHOW.y + SHOW.h - 32, '#e3c25a', 'lux', t * 0.3, t); displayCar(c, SHOW.x + 300, SHOW.y + SHOW.h - 32, '#c84659', 'gt', -t * 0.3, t); });
      for (let k = 0; k < 6; k++) { const x = LOT.x + 65 + k * 110, kit = PD.KITS[k % PD.KITS.length].id; add(LOT.y + 72, (c) => displayCar(c, x, LOT.y + 64, ['#1d2433', '#f1efe8', '#3d99d6', '#ff8a3d', '#8fd14f', '#6d73be'][k], kit, Math.PI / 2, t)); }
      add(LOT.y - 4, (c) => { for (let k = 0; k < 14; k++) { const x = LOT.x + k * 50; R(c, ['#e0473a', '#e3c25a', '#3d7fd0'][k % 3], x, LOT.y - 26 + Math.sin(t * 3 + k) * 1.5, 8, 6); } c.strokeStyle = '#9aa3ab'; c.beginPath(); c.moveTo(LOT.x, LOT.y - 26); c.lineTo(LOT.x + 700, LOT.y - 26); c.stroke(); });
      // dream house + your cars on display
      add(DREAM.y + DREAM.h, (c) => c.drawImage(lit ? SPR.dreamL : SPR.dream, DREAM.x - 10, DREAM.y - 10));
      const dreamOwned = root.NightshiftPets?.state?.dream, mine = dreamOwned ? ownedCars().slice(0, 3) : [];
      mine.forEach((car, i) => add(DREAM.y - 10, (c) => displayCar(c, DREAM.x + 75 + i * 90, DREAM.y - 32, car.color, root.NightshiftPets?.state?.kits?.[car.id], Math.PI / 2, t)));
      if (!dreamOwned) add(DREAM.y - 40, (c) => { R(c, '#5a3d22', DREAM.x + DREAM.w / 2 - 1, DREAM.y - 54, 3, 22); R(c, '#e8e2d0', DREAM.x + DREAM.w / 2 - 22, DREAM.y - 66, 44, 14); R(c, '#c0473f', DREAM.x + DREAM.w / 2 - 20, DREAM.y - 64, 40, 3); });
      add(PARK.y + 110, (c) => playset(c, t));
      for (const tr of TREES) if (tr.x > view.x - 60 && tr.x < view.x + view.w + 60 && tr.y > view.y && tr.y < view.y + view.h) add(tr.y, (c) => { const s2 = treeFor(tr); c.drawImage(s2, tr.x - s2.width / 2, tr.y - s2.height + 6); });
      for (let x = 100; x < MAP.w; x += 300) { add(626, (c) => { R(c, '#3a3f45', x, 586, 3, 40); R(c, '#3a3f45', x, 586, 12, 3); R(c, lit ? '#ffe9a8' : '#8a8a80', x + 9, 588, 6, 3); }); add(1036, (c) => { R(c, '#3a3f45', x + 150, 996, 3, 40); R(c, '#3a3f45', x + 150, 996, 12, 3); R(c, lit ? '#ffe9a8' : '#8a8a80', x + 159, 998, 6, 3); }); }
      add(618, (c) => Z.api.busStopArt(c, 120, 618, t));
      return out;
    },
    actors() { return joggers.map((j) => { j.t += 1 / 60; const q = joggerPos(j); return { x: q.x, y: q.y, angle: q.angle, moving: true, walkTicks: j.t * 30, color: j.color, id: j.id }; }); },
    lights(api) {
      const out = [];
      for (let x = 100; x < MAP.w; x += 300) { out.push({ x: x + 12, y: 600, r: 90 }); out.push({ x: x + 162, y: 1010, r: 90 }); }
      for (const h of HOUSES) out.push({ x: h.x + h.w / 2, y: h.face === 's' ? h.y + h.h : h.y, r: 70 });
      out.push({ x: MANSION.x + MANSION.w / 2, y: MANSION.y + MANSION.h, r: 120 }, { x: 1640, y: 470, r: 70 }, { x: SHOW.x + SHOW.w / 2, y: SHOW.y + SHOW.h, r: 150 }, { x: MALL.x + MALL.w / 2, y: MALL.y + MALL.h, r: 140 }, { x: 120, y: 600, r: 60 });
      return out;
    },
  });
  root.NightshiftSuburbs = Object.freeze({ HOUSES, MANSION, openPawn, openShowroom, paused: () => !pnl.hidden });
})(typeof globalThis !== 'undefined' ? globalThis : this);
