/* Harlow Fields — the countryside zone (Claude-owned). Requires zones.js, food-data.js, food.js, supply.js.
 * A bus ride out of the city: a county road, the Harlow co-op (plot leases, animals, buys produce), a farmhouse
 * (kitchen), a red barn + silo, a cow pasture, a chicken run, a windmill (wheat → flour), 16 leasable crop plots,
 * an orchard (free apples), a pond with ducks, and — past the tall corn — a hidden field (raw leaf, low heat).
 * All art is procedural pixel art: static pieces are pre-rendered once into sprites, animated bits each frame. */
(function (root) {
  'use strict';
  if (!root.document) return;
  const Z = root.NightshiftZones, F = root.NightshiftFoodData, S = root.NightshiftSupplyData;
  if (!Z || !F || !S) return;
  const FOOD = () => root.NightshiftFood, SUP = () => root.NightshiftSupply;
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const O = (c, col, x, y, rx, ry) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
  const C = (c, col, x, y, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const sprite = (w, h, paint) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; paint(x); return cv; };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const P = () => { try { return player; } catch { return null; } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const st = () => FOOD()?.state;
  const level = () => root.NightshiftSkills?.level?.('farming') ?? 1;
  const grow = () => root.NightshiftSkills?.mod?.('farming.growTime') ?? 1;

  const MAP = { w: 1800, h: 1300 };
  const ROAD = { y: 598, h: 62 };
  const COOP = { x: 200, y: 392, w: 170, h: 124 }, HOUSE = { x: 470, y: 318, w: 210, h: 160 }, BARN = { x: 760, y: 292, w: 172, h: 196 };
  const SILO = { x: 962, y: 318, r: 26 }, PASTURE = { x: 1000, y: 318, w: 250, h: 246 }, MILL = { x: 1330, y: 470 };
  const RUN = { x: 210, y: 700, w: 230, h: 150 }, COOPHOUSE = { x: 300, y: 712, w: 74, h: 54 }, POND = { x: 1250, y: 820, w: 330, h: 250 };
  const PLOTS = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) PLOTS.push({ x: 560 + c * 110, y: 724 + r * 74, w: 96, h: 58 });
  const CORN = { x: 1415, y: 110, w: 95, h: 460 }, FIELD = { x: 1520, y: 130, w: 250, h: 360 };
  const ORCH = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ORCH.push({ x: 140 + c * 92 + (r % 2) * 40, y: 930 + r * 92 });
  const TREES = []; { const r = rng(42); for (let i = 0; i < 70; i++) { const side = i % 4; const x = side === 0 ? 20 + r() * 60 : side === 1 ? 1730 + r() * 60 : 80 + r() * 1640; const y = side === 2 ? 30 + r() * 60 : side === 3 ? 1230 + r() * 60 : 60 + r() * 1180; if ((y > ROAD.y - 40 && y < ROAD.y + ROAD.h + 40) || (x > 1240 && x < 1780 && y > 100 && y < 580) || (x > 180 && x < 1600 && y > 280 && y < 1100)) continue; TREES.push({ x, y, k: Math.floor(r() * 3), s: 0.8 + r() * 0.5 }); } }
  const HAY = [{ x: 720, y: 540 }, { x: 742, y: 552 }, { x: 960, y: 540 }, { x: 1120, y: 1150 }, { x: 1150, y: 1162 }, { x: 140, y: 560 }];

  // ---------------- static art (sprites) ----------------
  function shingles(c, x, y, w, h, col, dark) {
    R(c, col, x, y, w, h);
    for (let yy = 0; yy < h; yy += 6) { R(c, dark, x, y + yy, w, 1); for (let xx = (yy / 6) % 2 ? 0 : 6; xx < w; xx += 12) R(c, dark, x + xx, y + yy, 1, 6); }
    R(c, '#ffffff22', x, y, w, 2); R(c, '#00000033', x, y + h - 3, w, 3);
  }
  function window2(c, x, y, lit) { R(c, '#2b2218', x - 1, y - 1, 16, 14); R(c, lit ? '#ffd27a' : '#6f9fb8', x, y, 14, 12); R(c, '#ffffff55', x + 1, y + 1, 4, 4); R(c, '#2b2218', x + 6, y, 2, 12); R(c, '#2b2218', x, y + 5, 14, 2); R(c, '#e8dcc0', x - 2, y + 12, 18, 2); }
  const houseSprite = (lit) => sprite(HOUSE.w + 20, HOUSE.h + 40, (c) => {
    const ox = 10, oy = 10, w = HOUSE.w, h = HOUSE.h;
    R(c, '#00000040', ox + 8, oy + 10, w, h + 10);
    shingles(c, ox, oy, w, h - 52, '#5b4a6e', '#4a3c5c'); // roof seen from above
    R(c, '#3c3049', ox + w / 2 - 2, oy, 4, h - 52); // ridge
    R(c, '#7a6a5a', ox + 30, oy + 14, 14, 20); R(c, '#5a4a3a', ox + 30, oy + 14, 14, 3); // chimney
    R(c, '#e8dcc0', ox, oy + h - 52, w, 52); for (let k = 0; k < 52; k += 6) R(c, '#d4c6a6', ox, oy + h - 52 + k, w, 1); // siding
    window2(c, ox + 20, oy + h - 44, lit); window2(c, ox + 50, oy + h - 44, lit); window2(c, ox + w - 70, oy + h - 44, lit); window2(c, ox + w - 40, oy + h - 44, lit);
    R(c, '#7a3a2a', ox + w / 2 - 10, oy + h - 40, 20, 34); R(c, '#9a4a36', ox + w / 2 - 8, oy + h - 38, 16, 30); C(c, '#e0b021', ox + w / 2 + 5, oy + h - 22, 1.5); // door
    R(c, '#8a6440', ox + 20, oy + h - 6, w - 40, 16); for (let k = 0; k < w - 40; k += 8) R(c, '#6a4a2e', ox + 20 + k, oy + h - 6, 1, 16); // porch deck
    for (const px of [ox + 22, ox + w - 26]) R(c, '#f2ead8', px, oy + h - 16, 4, 26);
    R(c, '#6a8a4a', ox + 2, oy + h + 4, 16, 10); R(c, '#e0473a', ox + 6, oy + h + 4, 3, 3); R(c, '#f2d24a', ox + 11, oy + h + 6, 3, 3); // flower box
    R(c, '#6a8a4a', ox + w - 18, oy + h + 4, 16, 10); R(c, '#c49bff', ox + w - 14, oy + h + 5, 3, 3);
  });
  const barnSprite = () => sprite(BARN.w + 20, BARN.h + 30, (c) => {
    const ox = 10, oy = 10, w = BARN.w, h = BARN.h;
    R(c, '#00000040', ox + 8, oy + 10, w, h + 8);
    R(c, '#5a3a32', ox, oy, w, h - 70); for (let yy = 0; yy < h - 70; yy += 5) R(c, '#4a2e28', ox, oy + yy, w, 1); R(c, '#6e4a3e', ox, oy, w / 2, h - 70); for (let yy = 0; yy < h - 70; yy += 5) R(c, '#5c3c32', ox, oy + yy, w / 2, 1); // gambrel roof halves
    R(c, '#3a2420', ox + w / 2 - 2, oy, 4, h - 70);
    R(c, '#d8d0c0', ox + w / 2 - 14, oy + 20, 28, 18); for (let k = 0; k < 5; k++) R(c, '#9a9488', ox + w / 2 - 12 + k * 6, oy + 22, 1, 14); // cupola vent
    R(c, '#b23a2a', ox, oy + h - 70, w, 70); for (let xx = 0; xx < w; xx += 8) R(c, '#9a2e22', ox + xx, oy + h - 70, 1, 70); // red boards
    R(c, '#f2ead8', ox, oy + h - 70, w, 3); R(c, '#f2ead8', ox, oy + h - 3, w, 3); R(c, '#f2ead8', ox, oy + h - 70, 3, 70); R(c, '#f2ead8', ox + w - 3, oy + h - 70, 3, 70);
    const dx = ox + w / 2 - 36, dy = oy + h - 56; R(c, '#f2ead8', dx - 3, dy - 3, 78, 59);
    for (const k of [0, 1]) { const x0 = dx + k * 37; R(c, '#8a2a20', x0, dy, 35, 53); c.strokeStyle = '#f2ead8'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, dy); c.lineTo(x0 + 35, dy + 53); c.moveTo(x0 + 35, dy); c.lineTo(x0, dy + 53); c.stroke(); c.strokeRect(x0 + 1.5, dy + 1.5, 32, 50); }
    R(c, '#2a1a12', ox + 18, oy + h - 60, 16, 14); R(c, '#e8c070', ox + 20, oy + h - 58, 12, 10); // hay loft window
  });
  const coopSprite = (lit) => sprite(COOP.w + 20, COOP.h + 40, (c) => {
    const ox = 10, oy = 10, w = COOP.w, h = COOP.h;
    R(c, '#00000040', ox + 8, oy + 10, w, h + 8);
    R(c, '#6f7a6a', ox, oy, w, h - 46); for (let xx = 0; xx < w; xx += 6) R(c, '#5f6a5a', ox + xx, oy, 2, h - 46); // tin roof
    R(c, '#c9a77a', ox, oy + h - 46, w, 46); for (let k = 0; k < w; k += 10) R(c, '#b38f62', ox + k, oy + h - 46, 1, 46);
    R(c, '#2f6b3f', ox + 8, oy + h - 64, w - 16, 18); c.fillStyle = '#f2ead8'; c.font = 'bold 11px monospace'; c.textAlign = 'center'; c.fillText('HARLOW CO-OP', ox + w / 2, oy + h - 51);
    for (let k = 0; k < 9; k++) R(c, k % 2 ? '#2f6b3f' : '#f2ead8', ox + 6 + k * 18, oy + h - 46, 18, 8); // awning
    window2(c, ox + 14, oy + h - 32, lit); window2(c, ox + w - 30, oy + h - 32, lit);
    R(c, '#5a4128', ox + w / 2 - 10, oy + h - 34, 20, 30); R(c, '#9fc3d6', ox + w / 2 - 7, oy + h - 31, 14, 10);
    // crates of produce out front
    for (let k = 0; k < 4; k++) { R(c, '#8a6440', ox + 40 + k * 22, oy + h + 2, 18, 12); R(c, ['#e0473a', '#f2d24a', '#b98a52', '#f08a1e'][k], ox + 42 + k * 22, oy + h + 2, 14, 5); }
  });
  const siloSprite = () => sprite(64, 110, (c) => {
    O(c, '#00000040', 38, 96, 26, 10);
    R(c, '#9aa3ab', 6, 26, 52, 70); for (let k = 0; k < 70; k += 7) R(c, '#7d868c', 6, 26 + k, 52, 1); R(c, '#c9d1d6', 10, 26, 6, 70); R(c, '#6e777d', 50, 26, 8, 70);
    O(c, '#b9c2c7', 32, 26, 26, 14); O(c, '#d6dde1', 28, 22, 16, 8); R(c, '#5d646b', 30, 6, 4, 10);
    R(c, '#5d646b', 44, 30, 2, 60); for (let k = 0; k < 10; k++) R(c, '#5d646b', 42, 32 + k * 6, 6, 1); // ladder
  });
  const coopHouseSprite = () => sprite(COOPHOUSE.w + 10, COOPHOUSE.h + 16, (c) => {
    const w = COOPHOUSE.w, h = COOPHOUSE.h;
    R(c, '#00000033', 6, 8, w, h + 4);
    R(c, '#8a3a2a', 0, 0, w, h - 26); for (let xx = 0; xx < w; xx += 5) R(c, '#7a2e22', xx, 0, 1, h - 26);
    R(c, '#e8dcc0', 0, h - 26, w, 26); R(c, '#4a3a2a', w / 2 - 6, h - 18, 12, 18); for (let k = 0; k < 5; k++) R(c, '#c9b58a', w / 2 - 5, h - 4 - k * 3, 10, 1); // ramp
    R(c, '#2b2218', 8, h - 22, 10, 8); R(c, '#e8c070', 9, h - 21, 8, 6);
  });
  function treeSprite(kind, s) {
    const W = Math.round(70 * s), Hh = Math.round(92 * s);
    return sprite(W, Hh, (c) => {
      const cx = W / 2, base = Hh - 6, r = rng(kind * 31 + Math.round(s * 100));
      O(c, '#00000038', cx + 8 * s, base - 2, 26 * s, 9 * s);
      R(c, '#5a3d22', cx - 3 * s, base - 30 * s, 6 * s, 30 * s); R(c, '#3e2a16', cx + 1 * s, base - 30 * s, 2 * s, 30 * s);
      if (kind === 2) { // pine
        for (let k = 0; k < 4; k++) { const yy = base - 28 * s - k * 13 * s, ww = (26 - k * 5) * s; c.fillStyle = k % 2 ? '#2e5a34' : '#376b3e'; c.beginPath(); c.moveTo(cx - ww, yy); c.lineTo(cx + ww, yy); c.lineTo(cx, yy - 22 * s); c.closePath(); c.fill(); R(c, '#4a8a50', cx - ww * 0.6, yy - 3, ww * 0.5, 2); }
        return;
      }
      const g1 = kind === 1 ? ['#3f7a3a', '#4f9246', '#2f5f2c'] : ['#356b34', '#468a42', '#28502a'];
      for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = 15 * s; O(c, g1[2], cx + Math.cos(a) * rr, base - 50 * s + Math.sin(a) * rr * 0.8, 15 * s, 13 * s); }
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, rr = 12 * s; O(c, g1[0], cx + Math.cos(a) * rr - 2, base - 53 * s + Math.sin(a) * rr * 0.8, 13 * s, 11 * s); }
      O(c, g1[1], cx - 6 * s, base - 60 * s, 12 * s, 9 * s); O(c, '#66a85a', cx - 9 * s, base - 64 * s, 6 * s, 4 * s);
      for (let k = 0; k < 18; k++) R(c, '#00000018', cx - 22 * s + r() * 44 * s, base - 72 * s + r() * 40 * s, 2, 2);
    });
  }
  function appleTreeSprite(ripe) {
    return sprite(64, 84, (c) => {
      const cx = 32, base = 78;
      O(c, '#00000038', cx + 7, base - 2, 24, 8);
      R(c, '#6a4a2a', cx - 3, base - 26, 6, 26); R(c, '#4a321c', cx + 1, base - 26, 2, 26);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; O(c, '#2f6a2c', cx + Math.cos(a) * 13, base - 44 + Math.sin(a) * 10, 13, 11); }
      O(c, '#4a8f3e', cx - 4, base - 48, 14, 11); O(c, '#62a852', cx - 8, base - 53, 7, 5);
      const r = rng(7); const n = ripe ? 10 : 2;
      for (let k = 0; k < n; k++) { const x = cx - 18 + r() * 36, y = base - 60 + r() * 30; C(c, '#d8261e', x, y, 2.4); R(c, '#ff8a7a', x - 1, y - 2, 1, 1); }
    });
  }
  const SPR = {};
  function ensureSprites() {
    if (SPR.ok) return;
    SPR.house = houseSprite(false); SPR.houseLit = houseSprite(true); SPR.barn = barnSprite(); SPR.coop = coopSprite(false); SPR.coopLit = coopSprite(true); SPR.silo = siloSprite(); SPR.coopHouse = coopHouseSprite();
    SPR.trees = {}; SPR.apple = appleTreeSprite(true); SPR.appleBare = appleTreeSprite(false);
    SPR.ok = true;
  }
  const treeFor = (t) => { const k = `${t.k}:${t.s.toFixed(2)}`; return SPR.trees[k] || (SPR.trees[k] = treeSprite(t.k, t.s)); };

  // ---------------- ground (cached once) ----------------
  function fence(c, x1, y1, x2, y2) {
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len / 22));
    c.strokeStyle = '#8a6440'; c.lineWidth = 2; for (const off of [-4, 2]) { c.beginPath(); c.moveTo(x1, y1 + off); c.lineTo(x2, y2 + off); c.stroke(); }
    for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n; R(c, '#5a3d22', x - 2, y - 8, 4, 12); R(c, '#8a6440', x - 2, y - 8, 4, 2); }
  }
  function ground(c) {
    const r = rng(2024);
    // grass with tufts + colour noise
    R(c, '#4f7a38', 0, 0, MAP.w, MAP.h);
    for (let i = 0; i < 9000; i++) { const x = r() * MAP.w, y = r() * MAP.h, k = r(); R(c, k < 0.33 ? '#5a8a40' : k < 0.66 ? '#456c30' : '#62943f', x, y, 2, k < 0.2 ? 3 : 2); }
    for (let i = 0; i < 900; i++) { const x = r() * MAP.w, y = r() * MAP.h; R(c, '#7aa84e', x, y, 1, 3); R(c, '#7aa84e', x + 2, y + 1, 1, 2); }
    for (let i = 0; i < 140; i++) { const x = r() * MAP.w, y = r() * MAP.h; C(c, ['#f2ead8', '#f2d24a', '#c49bff', '#ff8aa8'][i % 4], x, y, 1.4); } // wildflowers
    // mowed yard stripes around the farmhouse
    for (let k = 0; k < 8; k++) R(c, k % 2 ? '#5a8c42' : '#538438', 440, 300 + k * 30 - 12, 270, 30);
    // county road
    R(c, '#8a7a5a', 0, ROAD.y - 6, MAP.w, ROAD.h + 12); for (let i = 0; i < 1600; i++) R(c, r() < 0.5 ? '#9a8a6a' : '#7a6a4a', r() * MAP.w, ROAD.y - 6 + (r() < 0.5 ? r() * 6 : ROAD.h + 6 + r() * 6), 2, 2);
    R(c, '#3e4246', 0, ROAD.y, MAP.w, ROAD.h); for (let i = 0; i < 2600; i++) R(c, r() < 0.5 ? '#46494d' : '#35383c', r() * MAP.w, ROAD.y + r() * ROAD.h, 2, 1);
    for (let x = 10; x < MAP.w; x += 44) R(c, '#d8c060', x, ROAD.y + ROAD.h / 2 - 1, 22, 2);
    for (let x = 0; x < MAP.w; x += 3) { R(c, '#cfc6a8', x, ROAD.y + 2, 2, 1); R(c, '#cfc6a8', x, ROAD.y + ROAD.h - 3, 2, 1); }
    for (let i = 0; i < 30; i++) { const x = r() * MAP.w; R(c, '#2e3134', x, ROAD.y + 6 + r() * 50, 6 + r() * 12, 2); } // cracks
    // dirt paths: road → co-op, farmhouse, barn; between plots; to orchard; to pond
    const path = (x, y, w, h) => { R(c, '#8a6a44', x, y, w, h); for (let i = 0; i < (w * h) / 40; i++) R(c, r() < 0.5 ? '#9a7a52' : '#7a5a3a', x + r() * w, y + r() * h, 2, 2); };
    path(270, 516, 30, ROAD.y - 516); path(565, 478, 34, ROAD.y - 478); path(830, 488, 44, ROAD.y - 488);
    path(540, ROAD.y + ROAD.h, 460, 22); for (const px of [656, 766, 876]) path(px, 724, 14, 290); path(540, 1004, 460, 18);
    path(250, ROAD.y + ROAD.h, 28, 40); path(100, 900, 26, 300); path(1040, ROAD.y + ROAD.h, 24, 200); path(1040, 860, 210, 20);
    // chicken run: packed dirt, scattered grain
    R(c, '#7a6040', RUN.x, RUN.y, RUN.w, RUN.h); for (let i = 0; i < 500; i++) R(c, r() < 0.5 ? '#8a7050' : '#6a5030', RUN.x + r() * RUN.w, RUN.y + r() * RUN.h, 2, 2); for (let i = 0; i < 90; i++) R(c, '#e8c070', RUN.x + r() * RUN.w, RUN.y + r() * RUN.h, 1, 1);
    // pasture: longer grass, a few bare patches, a water trough later
    R(c, '#557f3a', PASTURE.x, PASTURE.y, PASTURE.w, PASTURE.h); for (let i = 0; i < 700; i++) R(c, r() < 0.5 ? '#67923f' : '#4a7032', PASTURE.x + r() * PASTURE.w, PASTURE.y + r() * PASTURE.h, 1, 4);
    for (let i = 0; i < 6; i++) O(c, '#7a6a44', PASTURE.x + 30 + r() * 190, PASTURE.y + 30 + r() * 180, 14 + r() * 10, 6 + r() * 4);
    // pond (water drawn dynamically on top for shimmer) — muddy bank + reeds base
    O(c, '#6a5a3a', POND.x + POND.w / 2, POND.y + POND.h / 2, POND.w / 2 + 10, POND.h / 2 + 10);
    O(c, '#7a6a44', POND.x + POND.w / 2, POND.y + POND.h / 2, POND.w / 2 + 4, POND.h / 2 + 4);
    // corn wall + hidden field soil
    R(c, '#6a5232', CORN.x, CORN.y, CORN.w, CORN.h); for (let yy = CORN.y; yy < CORN.y + CORN.h; yy += 12) R(c, '#5a4428', CORN.x, yy, CORN.w, 3);
    R(c, '#5c4a2e', FIELD.x, FIELD.y, FIELD.w, FIELD.h); for (let yy = FIELD.y + 6; yy < FIELD.y + FIELD.h; yy += 20) { R(c, '#4a3a22', FIELD.x, yy, FIELD.w, 4); R(c, '#6e5838', FIELD.x, yy + 4, FIELD.w, 1); }
    // orchard: shaded grass + fallen leaves
    R(c, '#4a7434', 110, 900, 400, 300); for (let i = 0; i < 300; i++) R(c, ['#8a6a2a', '#a07a30', '#6a8a3a'][i % 3], 110 + r() * 400, 900 + r() * 300, 2, 1);
    // fences
    fence(c, PASTURE.x, PASTURE.y, PASTURE.x + PASTURE.w, PASTURE.y); fence(c, PASTURE.x, PASTURE.y + PASTURE.h, PASTURE.x + PASTURE.w, PASTURE.y + PASTURE.h);
    fence(c, PASTURE.x, PASTURE.y, PASTURE.x, PASTURE.y + PASTURE.h); fence(c, PASTURE.x + PASTURE.w, PASTURE.y, PASTURE.x + PASTURE.w, PASTURE.y + PASTURE.h);
    fence(c, RUN.x, RUN.y, RUN.x + RUN.w, RUN.y); fence(c, RUN.x, RUN.y + RUN.h, RUN.x + 90, RUN.y + RUN.h); fence(c, RUN.x + 140, RUN.y + RUN.h, RUN.x + RUN.w, RUN.y + RUN.h);
    fence(c, RUN.x, RUN.y, RUN.x, RUN.y + RUN.h); fence(c, RUN.x + RUN.w, RUN.y, RUN.x + RUN.w, RUN.y + RUN.h);
    fence(c, 530, 700, 1010, 700); fence(c, 530, 1030, 1010, 1030); // crop field boundary
    for (let x = 30; x < MAP.w - 30; x += 260) if (x < 1380 || x > 1700) fence(c, x, ROAD.y - 18, x + 200, ROAD.y - 18);
    // mailbox + farm sign by the drive
    R(c, '#5a3d22', 610, ROAD.y - 30, 3, 20); R(c, '#2b5fa0', 603, ROAD.y - 38, 16, 9); R(c, '#e0473a', 618, ROAD.y - 42, 2, 6);
    R(c, '#5a3d22', 222, ROAD.y - 70, 4, 50); R(c, '#5a3d22', 330, ROAD.y - 70, 4, 50); R(c, '#e8dcc0', 214, ROAD.y - 84, 128, 22); R(c, '#2f6b3f', 216, ROAD.y - 82, 124, 18);
    c.fillStyle = '#f2ead8'; c.font = 'bold 12px monospace'; c.textAlign = 'center'; c.fillText('HARLOW FIELDS', 278, ROAD.y - 69); c.textAlign = 'left';
    // well/pump by the plots
    R(c, '#5d646b', 1030, 742, 10, 22); R(c, '#9aa3ab', 1032, 744, 6, 4); R(c, '#5d646b', 1038, 748, 14, 3); O(c, '#2b6fa0', 1034, 770, 10, 4);
  }

  // ---------------- dynamic layers ----------------
  function cropArt(c, x, y, crop, stg, t) {
    if (!crop) return;
    const C2 = F.CROP[crop], sway = Math.sin(t * 2 + x * 0.05) * 0.8;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
      const px = x + 10 + col * 18 + sway * (stg / 4), py = y + 12 + row * 17;
      if (stg === 1) { R(c, '#7ac85a', px, py - 2, 2, 3); R(c, '#5aa84a', px + 2, py - 3, 2, 2); continue; }
      const h = stg === 2 ? 7 : 12;
      if (crop === 'wheat') { for (let k = -2; k <= 2; k += 2) { R(c, stg >= 4 ? '#c9a24a' : '#8ab04a', px + k, py - h, 1, h); if (stg >= 3) R(c, stg >= 4 ? '#e8c862' : '#b8c870', px + k - 1, py - h - 3, 3, 4); } }
      else if (crop === 'corn') { R(c, '#4f8a3a', px, py - h - 6, 2, h + 6); R(c, '#6aa84a', px - 4, py - h, 4, 2); R(c, '#6aa84a', px + 2, py - h + 3, 4, 2); if (stg >= 4) { R(c, '#f2d24a', px + 2, py - h - 2, 3, 5); R(c, '#c9a24a', px + 3, py - h - 4, 1, 2); } }
      else if (crop === 'pumpkin') { if (col % 2 || row === 1) continue; R(c, '#3f7a3a', px - 6, py - 4, 12, 3); if (stg >= 3) { O(c, stg >= 4 ? '#f08a1e' : '#9ab04a', px, py, stg >= 4 ? 7 : 4, stg >= 4 ? 5 : 3); if (stg >= 4) { R(c, '#c9661a', px - 1, py - 4, 1, 9); R(c, '#4a3a22', px, py - 7, 2, 3); } } }
      else if (crop === 'potato') { O(c, '#4f8a3a', px, py - 3, 5, 4); O(c, '#62a852', px - 1, py - 4, 3, 2); if (stg >= 4) { C(c, '#f2ead8', px + 2, py - 5, 1.2); O(c, '#b98a52', px + 4, py + 1, 2, 1.5); } }
      else { // bushy fruiting plants: tomato, chili, strawberry
        O(c, '#3f7a3a', px, py - 4, 5, 4); O(c, '#5aa04a', px - 1, py - 5, 3, 2);
        if (stg >= 4) { const col2 = C2.color; if (crop === 'chili') { R(c, col2, px - 3, py - 4, 1, 4); R(c, col2, px + 2, py - 5, 1, 4); } else { C(c, col2, px - 2, py - 3, 1.6); C(c, col2, px + 2, py - 5, 1.6); if (crop === 'strawberry') R(c, '#fff3', px - 2, py - 4, 1, 1); } }
        else if (stg === 3) { C(c, '#f2ead8', px - 2, py - 5, 1); }
      }
    }
  }
  function drawPlots(c, t) {
    const s = st(), now = Date.now();
    PLOTS.forEach((pl, i) => {
      const leased = s && i < s.plots.length, p = leased ? s.plots[i] : null;
      if (!leased) { // fallow plot: weedy soil, corner stakes + rope, FOR LEASE on the next one
        R(c, '#3a2a1a', pl.x - 2, pl.y - 2, pl.w + 4, pl.h + 4); R(c, '#6a5638', pl.x, pl.y, pl.w, pl.h);
        for (let k = 0; k < 30; k++) { const wx = pl.x + 3 + ((k * 37) % (pl.w - 6)), wy = pl.y + 3 + ((k * 23) % (pl.h - 6)); R(c, k % 3 ? '#6e9a48' : '#88b05a', wx, wy, 1, 4); R(c, '#6e9a48', wx + 1, wy + 1, 2, 1); }
        c.strokeStyle = '#d8c89a88'; c.lineWidth = 1; c.setLineDash([3, 3]); c.strokeRect(pl.x + 1.5, pl.y + 1.5, pl.w - 3, pl.h - 3); c.setLineDash([]);
        for (const [sx, sy] of [[0, 0], [pl.w, 0], [0, pl.h], [pl.w, pl.h]]) { R(c, '#5a3d22', pl.x + sx - 1, pl.y + sy - 6, 3, 8); R(c, '#e0473a', pl.x + sx - 1, pl.y + sy - 7, 3, 2); }
        if (i === (s?.plots.length || 0)) { R(c, '#5a3d22', pl.x + pl.w / 2 - 1, pl.y + 10, 2, 16); R(c, '#e8dcc0', pl.x + pl.w / 2 - 16, pl.y + 4, 32, 10); c.fillStyle = '#2f6b3f'; c.font = 'bold 6px monospace'; c.textAlign = 'center'; c.fillText('FOR LEASE', pl.x + pl.w / 2, pl.y + 11); c.textAlign = 'left'; }
        return;
      }
      // tilled soil with furrows; darker when watered
      const wet = p.crop && p.watered;
      R(c, '#3a2a1a', pl.x - 2, pl.y - 2, pl.w + 4, pl.h + 4); R(c, wet ? '#4a3220' : '#6a4a2c', pl.x, pl.y, pl.w, pl.h);
      for (let yy = 6; yy < pl.h; yy += 17) { R(c, wet ? '#3a2616' : '#553a22', pl.x + 2, pl.y + yy, pl.w - 4, 4); R(c, wet ? '#5a3e28' : '#7a5a38', pl.x + 2, pl.y + yy + 4, pl.w - 4, 1); }
      if (wet) for (let k = 0; k < 6; k++) O(c, '#6fa8d855', pl.x + 10 + k * 15, pl.y + 30 + (k % 2) * 8, 4, 1.5);
      const stg = F.stage(p, now, grow());
      cropArt(c, pl.x, pl.y, p.crop, stg, t);
      if (stg >= 4) { const pulse = 0.5 + 0.5 * Math.sin(t * 4 + i); c.strokeStyle = `rgba(255,217,112,${0.4 + 0.4 * pulse})`; c.lineWidth = 2; c.strokeRect(pl.x - 1, pl.y - 1, pl.w + 2, pl.h + 2); }
      else if (p.crop) { const f = F.progress(p, now, grow()); R(c, '#05080fcc', pl.x + 8, pl.y + pl.h - 6, pl.w - 16, 4); R(c, wet ? '#5fb7e0' : '#7cdeb5', pl.x + 9, pl.y + pl.h - 5, (pl.w - 18) * f, 2); }
    });
  }
  function drawPond(c, t) {
    const cx = POND.x + POND.w / 2, cy = POND.y + POND.h / 2;
    O(c, '#1f5a78', cx, cy, POND.w / 2 - 6, POND.h / 2 - 6); O(c, '#2a6f8f', cx - 10, cy - 8, POND.w / 2 - 30, POND.h / 2 - 30);
    for (let i = 0; i < 26; i++) { const a = i * 2.4, rr = (i % 7) / 7; const x = cx + Math.cos(a) * (POND.w / 2 - 30) * rr, y = cy + Math.sin(a) * (POND.h / 2 - 30) * rr; R(c, i % 3 ? '#8fd0ee55' : '#d8f2ff77', x + Math.sin(t + i) * 4, y, 7, 1); }
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.5; O(c, '#3f8a3a', cx + Math.cos(a) * 80, cy + Math.sin(a) * 50, 9, 6); C(c, '#ff9ac0', cx + Math.cos(a) * 80 + 2, cy + Math.sin(a) * 50 - 1, 1.6); } // lily pads
    const reeds = rng(9); for (let i = 0; i < 46; i++) { const a = reeds() * Math.PI * 2, x = cx + Math.cos(a) * (POND.w / 2 - 2), y = cy + Math.sin(a) * (POND.h / 2 - 2), sw = Math.sin(t * 1.5 + i) * 1.2; R(c, '#5a7a2a', x + sw, y - 10, 1, 10); R(c, '#6a4a22', x + sw, y - 12, 2, 4); }
    // ducks paddle around
    for (let k = 0; k < 3; k++) { const a = t * 0.15 + k * 2.1, x = cx + Math.cos(a) * 70 * (1 + k * 0.3), y = cy + Math.sin(a) * 40 * (1 + k * 0.2), dir = Math.cos(a + Math.PI / 2) > 0 ? 1 : -1;
      O(c, '#ffffff33', x - dir * 6, y + 2, 6, 1.5); O(c, '#f2ead8', x, y, 5, 3.5); C(c, '#2f6b3f', x + dir * 4, y - 3, 2.4); R(c, '#f08a1e', x + dir * 6, y - 3, 2 * dir, 1); }
    // little dock
    R(c, '#6a4a2e', cx - 20, POND.y - 6, 14, 40); for (let k = 0; k < 40; k += 5) R(c, '#8a6440', cx - 20, POND.y - 6 + k, 14, 1);
  }
  function drawHiddenField(c, t) {
    const s = root.NightshiftSupply?.state, sp = S.GBY.field, n = s ? S.stockNow(s, 'field') : sp.stock, f = n / sp.stock;
    const r = rng(77); let k = 0, alive = Math.round(f * 60);
    for (let yy = FIELD.y + 18; yy < FIELD.y + FIELD.h - 6; yy += 20) for (let xx = FIELD.x + 12; xx < FIELD.x + FIELD.w - 8; xx += 22) {
      const on = k++ < alive || (k * 7) % 11 === 0 && f > 0.2, sw = Math.sin(t * 2 + xx * 0.1) * 1.2;
      if (!on) { R(c, '#4a3a22', xx - 2, yy, 4, 2); continue; }
      c.save(); c.translate(xx + sw, yy); for (let l = 0; l < 7; l++) { const a = -Math.PI / 2 + (l - 3) * 0.42; c.fillStyle = l % 2 ? '#3fae4a' : '#58c95e'; c.beginPath(); c.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 5.5, 1.6, a, 0, Math.PI * 2); c.fill(); } C(c, '#7ee07f', 0, -1, 1.5); c.restore();
      void r;
    }
  }
  function cornProps(view) {
    const out = [];
    for (let yy = CORN.y + 8; yy < CORN.y + CORN.h; yy += 12) {
      if (yy < view.y - 40 || yy > view.y + view.h + 40) continue;
      out.push({ y: yy, draw: (c, t) => { for (let xx = CORN.x + 4; xx < CORN.x + CORN.w; xx += 9) { const sw = Math.sin(t * 1.6 + xx * 0.08 + yy * 0.05) * 2; R(c, '#4a7a2a', xx, yy - 34, 2, 34); c.strokeStyle = '#6aa84a'; c.lineWidth = 2; c.beginPath(); c.moveTo(xx + 1, yy - 18); c.quadraticCurveTo(xx + 7 + sw, yy - 24, xx + 10 + sw, yy - 18); c.moveTo(xx + 1, yy - 26); c.quadraticCurveTo(xx - 5 + sw, yy - 32, xx - 8 + sw, yy - 26); c.stroke(); R(c, '#e3c25a', xx + sw * 0.5, yy - 40, 2, 7); if ((xx + yy) % 3 === 0) R(c, '#f2d24a', xx + 2, yy - 22, 3, 5); } } });
    }
    return out;
  }
  // windmill: tower prop + rotating blades
  function drawWindmill(c, t) {
    const { x, y } = MILL;
    O(c, '#00000040', x + 10, y + 26, 34, 10);
    c.fillStyle = '#d8d0c0'; c.beginPath(); c.moveTo(x - 24, y + 24); c.lineTo(x + 24, y + 24); c.lineTo(x + 14, y - 70); c.lineTo(x - 14, y - 70); c.closePath(); c.fill();
    for (let k = 0; k < 12; k++) R(c, '#bdb4a4', x - 22 + k * 0.8, y + 22 - k * 7.6, 44 - k * 1.6, 1);
    R(c, '#5a3d22', x - 7, y + 4, 14, 20); R(c, '#2b2218', x - 5, y + 6, 10, 18); R(c, '#2b2218', x - 4, y - 30, 8, 9); R(c, '#e8c070', x - 3, y - 29, 6, 7);
    c.fillStyle = '#6a4a3a'; c.beginPath(); c.moveTo(x - 18, y - 70); c.lineTo(x + 18, y - 70); c.lineTo(x, y - 92); c.closePath(); c.fill();
    const hub = { x: x, y: y - 72 }, a0 = t * 0.9;
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2; c.save(); c.translate(hub.x, hub.y); c.rotate(a);
      R(c, '#4a321c', -1.5, 0, 3, 54);
      c.fillStyle = '#e8e0cc'; c.fillRect(2, 10, 10, 42); c.strokeStyle = '#8a7a6a'; c.lineWidth = 1; for (let s = 0; s < 6; s++) { c.beginPath(); c.moveTo(2, 12 + s * 7); c.lineTo(12, 12 + s * 7); c.stroke(); }
      c.restore();
    }
    C(c, '#3a2a1c', hub.x, hub.y, 4); C(c, '#8a6a4a', hub.x - 1, hub.y - 1, 1.5);
  }
  // animals
  const cows = [], hens = [];
  function initAnimals() {
    const s = st(); if (!s) return;
    const nc = s.animals.cow?.n || 0, nh = s.animals.hen?.n || 0;
    while (cows.length < nc) { const r = rng(cows.length + 5); cows.push({ x: PASTURE.x + 40 + r() * 170, y: PASTURE.y + 60 + r() * 150, a: r() * 6, tx: 0, ty: 0, until: 0, spots: Math.floor(r() * 3) }); }
    cows.length = Math.min(cows.length, nc);
    while (hens.length < nh) { const r = rng(hens.length + 50); hens.push({ x: RUN.x + 20 + r() * (RUN.w - 40), y: RUN.y + 20 + r() * (RUN.h - 40), a: r() * 6, tx: 0, ty: 0, until: 0, peck: 0, brown: hens.length % 3 === 1 }); }
    hens.length = Math.min(hens.length, nh);
  }
  function wander(list, box, speed, now, dt) {
    for (const a of list) {
      if (now > a.until) { a.tx = box.x + 24 + Math.random() * (box.w - 48); a.ty = box.y + 30 + Math.random() * (box.h - 50); a.until = now + 2500 + Math.random() * 5000; a.idle = Math.random() < 0.45; }
      if (a.idle) { a.moving = false; a.peck = Math.sin(now / 160 + a.x) > 0.6; continue; }
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d > 2) { a.x += (dx / d) * speed * dt; a.y += (dy / d) * speed * dt; a.a = Math.atan2(dy, dx); a.moving = true; } else a.moving = false;
    }
  }
  function drawCow(c, a, t) {
    const dir = Math.cos(a.a) >= 0 ? 1 : -1, bob = a.moving ? Math.sin(t * 8 + a.x) * 0.8 : 0;
    O(c, '#00000038', a.x + 2, a.y + 2, 17, 5);
    for (const lx of [-9, -4, 5, 9]) R(c, '#2a2422', a.x + lx * dir - 1, a.y - 6 + (a.moving && lx % 2 ? bob : 0), 3, 8);
    O(c, '#f2ead8', a.x, a.y - 11 + bob, 15, 8);
    if (a.spots !== 1) { O(c, '#1e1a18', a.x - 4 * dir, a.y - 13 + bob, 5, 4); O(c, '#1e1a18', a.x + 6 * dir, a.y - 9 + bob, 4, 3); } else { O(c, '#7a4a2a', a.x - 2, a.y - 12 + bob, 8, 5); }
    O(c, '#f2ead8', a.x + 15 * dir, a.y - 14 + bob, 6, 5); O(c, '#e8a0a0', a.x + 19 * dir, a.y - 13 + bob, 3, 2.5); C(c, '#111', a.x + 15 * dir, a.y - 16 + bob, 1);
    R(c, '#c9b58a', a.x + 12 * dir - 1, a.y - 20 + bob, 2, 3); R(c, '#c9b58a', a.x + 17 * dir - 1, a.y - 20 + bob, 2, 3);
    R(c, '#2a2422', a.x - 15 * dir, a.y - 14 + bob + Math.sin(t * 3 + a.x) * 2, 2, 7); // tail
  }
  function drawHen(c, a, t) {
    const dir = Math.cos(a.a) >= 0 ? 1 : -1, pk = a.peck ? 3 : 0, bob = a.moving ? Math.abs(Math.sin(t * 12 + a.x)) * 1.5 : 0;
    O(c, '#00000033', a.x + 1, a.y + 1, 6, 2);
    R(c, '#f08a1e', a.x - 2, a.y - 3, 1, 3); R(c, '#f08a1e', a.x + 1, a.y - 3, 1, 3);
    O(c, a.brown ? '#a0582a' : '#f2f2ee', a.x, a.y - 6 - bob, 6, 4.5); O(c, a.brown ? '#7a4020' : '#d8d8d0', a.x - 3 * dir, a.y - 6 - bob, 3, 3);
    C(c, a.brown ? '#a0582a' : '#f2f2ee', a.x + 5 * dir, a.y - 10 - bob + pk, 3); R(c, '#e0473a', a.x + 4 * dir, a.y - 14 - bob + pk, 2, 2); R(c, '#f2b21e', a.x + 8 * dir, a.y - 10 - bob + pk, 2 * dir, 1); C(c, '#111', a.x + 6 * dir, a.y - 11 - bob + pk, 0.7);
  }
  function drawTractor(c) {
    const x = 1090, y = 900;
    O(c, '#00000040', x + 4, y + 6, 30, 9);
    C(c, '#1a1a1a', x - 16, y, 11); C(c, '#3a3a3a', x - 16, y, 6); C(c, '#1a1a1a', x + 18, y + 2, 7); C(c, '#3a3a3a', x + 18, y + 2, 3.5);
    R(c, '#2f8a3a', x - 10, y - 18, 34, 14); R(c, '#3fa84a', x - 10, y - 18, 34, 3); R(c, '#2f8a3a', x - 18, y - 30, 16, 16); R(c, '#9fd0e8', x - 16, y - 28, 12, 7);
    R(c, '#1a1a1a', x + 18, y - 26, 3, 10); R(c, '#e0b021', x + 6, y - 14, 6, 3);
  }
  function drawScarecrow(c, t) {
    const x = 1010, y = 1000, sw = Math.sin(t * 1.3) * 1.5;
    O(c, '#00000033', x + 3, y + 2, 10, 3); R(c, '#5a3d22', x - 1, y - 34, 3, 34); R(c, '#5a3d22', x - 16, y - 26, 32, 3);
    R(c, '#4a6aa0', x - 8 + sw, y - 28, 16, 14); R(c, '#c9a24a', x - 18 + sw, y - 26, 4, 5); R(c, '#c9a24a', x + 14 + sw, y - 26, 4, 5);
    C(c, '#e8c070', x + sw, y - 34, 5); R(c, '#2b2218', x - 2 + sw, y - 35, 1, 1); R(c, '#2b2218', x + 2 + sw, y - 35, 1, 1); R(c, '#6a4a22', x - 8 + sw, y - 41, 16, 3); R(c, '#6a4a22', x - 4 + sw, y - 46, 8, 5);
  }
  function drawHay(c, h) { O(c, '#00000033', h.x + 3, h.y + 3, 13, 5); O(c, '#c9a24a', h.x, h.y - 6, 13, 9); O(c, '#e3c25a', h.x - 2, h.y - 9, 9, 5); for (let k = -8; k < 10; k += 4) R(c, '#a07a2a', h.x + k, h.y - 12, 1, 10); }
  function drawTrough(c, x, y, feed, item) { R(c, '#00000033', x + 2, y + 4, 44, 8); R(c, '#6a4a2e', x, y, 44, 10); R(c, '#4a321c', x + 2, y + 2, 40, 6); if (feed > 0) R(c, item === 'corn' ? '#f2d24a' : '#e3c25a', x + 3, y + 3, Math.min(38, 4 + feed * 3), 4); }

  // ---------------- targets ----------------
  const PLOT_HIT = (pos) => PLOTS.findIndex((pl) => pos.x > pl.x - 12 && pos.x < pl.x + pl.w + 12 && pos.y > pl.y - 12 && pos.y < pl.y + pl.h + 16);
  function targets(api) {
    const s = st(), pos = api.pos, out = [];
    out.push(api.busStop(130, 586));
    out.push({ x: COOP.x + COOP.w / 2, y: COOP.y + COOP.h + 22, r: 55, action: 'CO-OP', label: 'Harlow co-op · leases, animals, sell produce', sign: 'CO-OP', icon: '🧺', color: '#7cdeb5', lift: 150, use: openCoop });
    out.push({ x: HOUSE.x + HOUSE.w / 2, y: HOUSE.y + HOUSE.h + 28, r: 55, action: 'COOK', label: 'Farmhouse kitchen · cook meals', sign: 'KITCHEN', icon: '🍳', color: '#ffb36b', lift: 182, use: () => FOOD()?.openKitchen('farm') });
    out.push({ x: MILL.x, y: MILL.y + 46, r: 58, action: 'MILL', label: 'Windmill · 3 wheat → 1 flour', sign: 'WINDMILL · FLOUR', icon: '🌾', color: '#c49bff', lift: 168, use: () => api.process('mill', MILL.x, MILL.y + 46, 70) });
    out.push({ x: 300, y: 1040, r: 90, action: 'PICK', label: 'Orchard · pick apples', sign: 'ORCHARD', icon: '🍎', color: '#7cdeb5', lift: 150, use: () => api.gather('orchard', 300, 1040, 95) });
    out.push({ x: FIELD.x + FIELD.w / 2, y: FIELD.y + FIELD.h / 2, r: 120, action: 'COLLECT', label: 'Hidden field · raw leaf', sign: null, use: () => api.gather('field', FIELD.x + FIELD.w / 2, FIELD.y + FIELD.h / 2, 140) });
    // coop + barn troughs
    const hen = s?.animals?.hen, cow = s?.animals?.cow;
    out.push({ x: RUN.x + 115, y: RUN.y + RUN.h + 18, r: 50, action: hen?.n ? 'EGGS' : 'HENS', label: hen?.n ? `Chicken run · ${hen.ready || 0} eggs waiting · trough ${hen.feed} wheat` : 'Chicken run · buy hens at the co-op', sign: 'CHICKENS', icon: '🐔', color: '#ffd970', lift: 200, use: () => animal('hen') });
    out.push({ x: PASTURE.x + 40, y: PASTURE.y + PASTURE.h + 18, r: 50, action: cow?.n ? 'MILK' : 'COWS', label: cow?.n ? `Pasture · ${cow.ready || 0} milk waiting · trough ${cow.feed} corn` : 'Pasture · buy cows at the co-op', sign: 'COWS', icon: '🐄', color: '#ffd970', lift: 30, use: () => animal('cow') });
    // plots: one dynamic target for whichever plot you stand at
    const i = pos ? PLOT_HIT(pos) : -1;
    if (i >= 0) {
      const pl = PLOTS[i], p = s?.plots?.[i], now = Date.now(), stg = p ? F.stage(p, now, grow()) : 0;
      const t = { x: pl.x + pl.w / 2, y: pl.y + pl.h / 2, r: 80, use: () => plotUse(i) };
      if (!s || i >= s.plots.length) Object.assign(t, { action: 'LEASE', label: `Plot ${i + 1} · lease at the co-op (${money(F.LEASE(s?.plots.length || 0))})` });
      else if (!p.crop) Object.assign(t, { action: 'PLANT', label: `Plot ${i + 1} · empty · choose seeds` });
      else if (stg >= 4) Object.assign(t, { action: 'HARVEST', label: `Plot ${i + 1} · ${F.CROP[p.crop].name} ready` });
      else if (!p.watered) Object.assign(t, { action: 'WATER', label: `Plot ${i + 1} · ${F.CROP[p.crop].name} growing · water it` });
      else Object.assign(t, { action: 'CHECK', label: `Plot ${i + 1} · ${F.CROP[p.crop].name} · ${Math.round(F.progress(p, now, grow()) * 100)}%` });
      out.push(t);
    }
    return out;
  }
  function plotUse(i) {
    const s = st(), p = s?.plots?.[i];
    if (!s || i >= s.plots.length) { say(`🧺 Lease plots at the co-op (next: ${money(F.LEASE(s?.plots.length || 0))})`); openCoop(); return; }
    const now = Date.now();
    if (!p.crop) { openSeeds(i); return; }
    const stg = F.stage(p, now, grow());
    if (stg >= 4) {
      const r = F.harvest(s, i, (items) => SUP().give(items), { now, speed: grow(), yieldMul: root.NightshiftSkills?.mod?.('farming.yield') ?? 1 });
      if (!r.ok) { say(r.reason); return; }
      FOOD().save(); try { root.NightshiftSkills?.gain('farming', 15 + r.n * 4, 'harvest'); root.NightshiftAudio?.play('pickup'); } catch { /* optional */ }
      Z.api.float(PLOTS[i].x + 48, PLOTS[i].y, `+${r.n} ${r.crop.icon}`, '#ffe9a8');
      say(`${r.crop.icon} Harvested ${r.n} ${r.crop.name}${r.lost ? ` · ${r.lost} didn't fit in your bag` : ''}`);
      return;
    }
    if (!p.watered) { const r = F.water(s, i, now, grow()); if (r.ok) { FOOD().save(); Z.api.fx('puff', PLOTS[i].x + 48, PLOTS[i].y + 30, 500); say('💧 Watered · grows faster now'); try { root.NightshiftSkills?.gain('farming', 4, 'water'); } catch { /* optional */ } } else say(r.reason); return; }
    say(`${F.CROP[p.crop].icon} ${Math.round(F.progress(p, now, grow()) * 100)}% grown · ${Math.ceil((1 - F.progress(p, now, grow())) * F.growMs(p.crop, p.watered, grow()) / 60000)} min left`);
  }
  function animal(id) {
    const s = st(), A = F.ANIMALS[id], a = s?.animals?.[id];
    if (!a?.n) { say(`${A.icon} No ${A.name.toLowerCase()}s yet · buy them at the co-op`); openCoop(); return; }
    F.tickAnimals(s, Date.now());
    const bag = SUP().state.bag;
    if (a.ready > 0) { const r = F.collect(s, id, (items) => SUP().give(items)); if (r.ok) { FOOD().save(); say(`${S.MATERIALS[A.item].icon} Collected ${r.n} ${S.MATERIALS[A.item].name.toLowerCase()}`); try { root.NightshiftSkills?.gain('farming', 3 * r.n, 'animals'); } catch { /* optional */ } } else say(r.reason); }
    if ((bag[A.feed] || 0) > 0 && a.feed < 20) { const r = F.feed(s, id, bag, 20 - a.feed); if (r.ok) { SUP().save(); FOOD().save(); say(`🌾 Filled the trough with ${r.n} ${A.feed}`); } }
    else if (!a.ready) say(a.feed > 0 ? `${A.icon} Nothing yet · ${A.every} min per ${S.MATERIALS[A.item].name.toLowerCase()} per animal` : `${A.icon} Trough empty · bring ${A.feed} (grow it on your plots)`);
  }

  // ---------------- panels ----------------
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const pnl = el('div', { id: 'frPanel', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Farm' }); document.body.append(pnl);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pnl.hidden) { pnl.hidden = true; e.stopImmediatePropagation(); } }, true);
  function head(title, sub) { pnl.textContent = ''; const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { pnl.hidden = true; }; top.append(el('h2', {}, title), x); pnl.append(top); if (sub) pnl.append(el('div', { className: 'sub' }, sub)); }
  const show = () => { try { root.releaseControls?.(); } catch { /* n/a */ } pnl.hidden = false; };
  function openSeeds(i) {
    show(); const s = st(), p = P(), lvl = level();
    head(`🌱 PLOT ${i + 1} · CHOOSE SEEDS`, `Cash ${money(p?.cash || 0)} · Farming Lv ${lvl}. Water after planting to grow ~35% faster. Ripe plots glow gold.`);
    const cards = el('div', { className: 'cards' });
    for (const c of F.CROPS) {
      const lock = lvl < c.level, card = el('div', { className: 'card' + (lock ? ' lock' : '') });
      const hd = el('div', { className: 'hd' }); hd.append(el('div', { className: 'pi', style: 'font-size:26px' }, c.icon)); const nm = el('div'); nm.append(el('div', { className: 'nm' }, c.name), el('div', { className: 'tg' }, `${c.minutes} MIN · YIELD ${c.yield[0]}-${c.yield[1]} · CO-OP ${money(c.sell)} EA`)); hd.append(nm); card.append(hd);
      const row = el('div', { className: 'row' }); row.append(el('span', { className: lock ? 'why' : 'okc' }, lock ? `Needs Farming level ${c.level}` : `Seeds ${money(c.seed)}`));
      const b = el('button', { className: 'go', type: 'button', disabled: lock || (p?.cash || 0) < c.seed }, 'PLANT'); b.onclick = () => { const r = F.plant(s, i, c.id, P(), lvl); if (r.ok) { FOOD().save(); try { root.NightshiftSkills?.gain('farming', 5, 'plant'); } catch { /* optional */ } pnl.hidden = true; say(`${c.icon} Planted ${c.name} · USE again to water it`); } else say(r.reason); }; row.append(b);
      card.append(row); cards.append(card);
    }
    pnl.append(cards);
  }
  function openCoop() {
    show(); const s = st(), p = P(); if (!s) return;
    head('🧺 HARLOW CO-OP', `Cash ${money(p?.cash || 0)} · "We buy what you grow, and we'll set you up to grow more."`);
    pnl.append(el('h3', {}, 'LAND'));
    const n = s.plots.length, lrow = el('div', { className: 'mealrow' });
    lrow.append(el('div', { className: 'pi' }, '🟫')); const lt = el('div', { className: 't' }); lt.append(el('b', {}, `Crop plots · ${n}/${F.PLOTS_MAX} leased`), el('span', {}, n < F.PLOTS_MAX ? `Next plot ${money(F.LEASE(n))} (south of the road, behind the fence)` : 'Every plot is yours')); lrow.append(lt);
    if (n < F.PLOTS_MAX) { const b = el('button', { className: 'go', type: 'button', disabled: (p?.cash || 0) < F.LEASE(n) }, `LEASE · ${money(F.LEASE(n))}`); b.onclick = () => { const r = F.lease(s, P()); if (r.ok) { FOOD().save(); say(`🟫 Plot ${r.n} is yours`); } else say(r.reason); openCoop(); }; lrow.append(b); }
    pnl.append(lrow);
    pnl.append(el('h3', {}, 'ANIMALS'));
    for (const [id, A] of Object.entries(F.ANIMALS)) {
      const a = s.animals[id], row = el('div', { className: 'mealrow' }); row.append(el('div', { className: 'pi' }, A.icon));
      const t = el('div', { className: 't' }); t.append(el('b', {}, `${A.name}s · ${a.n}/${A.max}`), el('span', {}, `1 ${S.MATERIALS[A.item].name.toLowerCase()} every ${A.every} min each · eats ${A.feed} from the trough`)); row.append(t);
      const b = el('button', { className: 'go', type: 'button', disabled: a.n >= A.max || (p?.cash || 0) < A.price }, a.n >= A.max ? 'FULL' : `BUY · ${money(A.price)}`); b.onclick = () => { const r = F.buyAnimal(s, id, P()); if (r.ok) { FOOD().save(); initAnimals(); say(`${A.icon} A new ${A.name.toLowerCase()} joins the farm`); } else say(r.reason); openCoop(); }; row.append(b);
      pnl.append(row);
    }
    pnl.append(el('h3', {}, 'SELL PRODUCE'));
    const bag = SUP()?.state?.bag || {}; let any = false;
    for (const [id, price] of Object.entries(F.COOP_BUYS)) {
      if (!(bag[id] > 0)) continue; any = true;
      const m = S.MATERIALS[id], row = el('div', { className: 'mealrow' }); row.append(el('div', { className: 'pi' }, m.icon));
      const t = el('div', { className: 't' }); t.append(el('b', {}, `${m.name} ×${bag[id]}`), el('span', {}, `${money(price)} each`)); row.append(t);
      for (const k of [1, 99]) { const b = el('button', { className: k === 1 ? 'alt' : 'go', type: 'button' }, k === 1 ? 'SELL 1' : 'SELL ALL'); b.onclick = () => { const r = F.sellProduce(s, id, bag, P(), k); if (r.ok) { SUP().save(); FOOD().save(); try { root.NightshiftSkills?.gain('dealing', 2 * r.n, 'coop'); } catch { /* optional */ } } say(r.ok ? `🧺 Sold ${r.n} ${m.name.toLowerCase()} · +${money(r.cash)}` : r.reason); openCoop(); }; row.append(b); }
      pnl.append(row);
    }
    if (!any) pnl.append(el('div', { className: 'sub' }, 'Nothing to sell. Tip: meals cooked from produce sell for about twice as much at the Diner in the city.'));
    pnl.append(el('h3', {}, 'HOW FARMING WORKS'), el('div', { className: 'sub' }, '1) Lease a plot · 2) USE it to plant seeds · 3) USE again to water (faster) · 4) Harvest when it glows gold. Hens eat wheat, cows eat corn: fill their troughs when you collect. Mill wheat into flour at the windmill. Cook at the farmhouse or your apartment kitchen.'));
  }

  // ---------------- zone definition ----------------
  const solids = [
    { ...COOP, h: COOP.h - 4 }, { ...HOUSE, h: HOUSE.h - 4 }, { ...BARN, h: BARN.h - 6 }, { x: SILO.x - 24, y: SILO.y + 28, w: 50, h: 50 },
    { x: PASTURE.x - 3, y: PASTURE.y - 3, w: PASTURE.w + 6, h: 6 }, { x: PASTURE.x - 3, y: PASTURE.y + PASTURE.h - 3, w: PASTURE.w + 6, h: 6 }, { x: PASTURE.x - 3, y: PASTURE.y, w: 6, h: PASTURE.h }, { x: PASTURE.x + PASTURE.w - 3, y: PASTURE.y, w: 6, h: PASTURE.h },
    { x: RUN.x - 3, y: RUN.y - 3, w: RUN.w + 6, h: 6 }, { x: RUN.x - 3, y: RUN.y, w: 6, h: RUN.h }, { x: RUN.x + RUN.w - 3, y: RUN.y, w: 6, h: RUN.h }, { x: RUN.x, y: RUN.y + RUN.h - 3, w: 90, h: 6 }, { x: RUN.x + 140, y: RUN.y + RUN.h - 3, w: RUN.w - 140, h: 6 },
    { x: MILL.x - 22, y: MILL.y - 10, w: 44, h: 34 }, { x: POND.x + 30, y: POND.y + 24, w: POND.w - 60, h: POND.h - 48 }, { x: 1066, y: 878, w: 46, h: 30 },
    ...TREES.map((t) => ({ x: t.x - 5, y: t.y - 8, w: 10, h: 8 })), ...ORCH.map((t) => ({ x: t.x - 4, y: t.y - 6, w: 8, h: 6 })),
  ];
  Z.register({
    id: 'farm', name: 'Harlow Fields', tagline: 'COUNTRYSIDE · FARMING · FRESH AIR', w: MAP.w, h: MAP.h, zoom: 0.82, bg: '#3f6a2e', spawn: { x: 150, y: 640, angle: 0 }, solids,
    travel: { fare: 8, desc: 'Farm country. Lease plots, raise animals, mill flour, cook meals, and the corn hides a field of something greener.', spawn: { x: 150, y: 640, angle: 0 } },
    ground, targets,
    onEnter() { ensureSprites(); initAnimals(); try { root.NightshiftSkills?.gain('farming', 1, 'visit'); } catch { /* n/a */ } },
    update(dt, now) { initAnimals(); wander(cows, { x: PASTURE.x, y: PASTURE.y, w: PASTURE.w, h: PASTURE.h }, 0.35, now, dt); wander(hens, { x: RUN.x, y: RUN.y, w: RUN.w, h: RUN.h }, 0.7, now, dt); },
    drawGround(c, t) {
      drawPlots(c, t); drawPond(c, t); drawHiddenField(c, t);
      const s = st(); drawTrough(c, RUN.x + 96, RUN.y + RUN.h - 22, s?.animals?.hen?.feed || 0, 'wheat'); drawTrough(c, PASTURE.x + 18, PASTURE.y + PASTURE.h - 24, s?.animals?.cow?.feed || 0, 'corn');
      // eggs waiting in the run, milk cans by the pasture
      for (let k = 0; k < Math.min(8, s?.animals?.hen?.ready || 0); k++) O(c, '#f8f2e0', RUN.x + 30 + (k * 23) % 160, RUN.y + 30 + ((k * 37) % 80), 2.5, 3.2);
      for (let k = 0; k < Math.min(4, s?.animals?.cow?.ready || 0); k++) { R(c, '#c9d1d6', PASTURE.x + 70 + k * 12, PASTURE.y + PASTURE.h + 6, 8, 12); R(c, '#9aa3ab', PASTURE.x + 71 + k * 12, PASTURE.y + PASTURE.h + 4, 6, 3); }
    },
    props(api, view) {
      ensureSprites();
      const lit = api.darkness() > 0.35, out = [], t = performance.now() / 1000;
      const add = (y, fn) => out.push({ y, draw: fn });
      add(COOP.y + COOP.h, (c) => c.drawImage(lit ? SPR.coopLit : SPR.coop, COOP.x - 10, COOP.y - 10));
      add(HOUSE.y + HOUSE.h, (c) => c.drawImage(lit ? SPR.houseLit : SPR.house, HOUSE.x - 10, HOUSE.y - 10));
      add(BARN.y + BARN.h, (c) => c.drawImage(SPR.barn, BARN.x - 10, BARN.y - 10));
      add(SILO.y + 80, (c) => c.drawImage(SPR.silo, SILO.x - 32, SILO.y - 10));
      add(COOPHOUSE.y + COOPHOUSE.h, (c) => c.drawImage(SPR.coopHouse, COOPHOUSE.x, COOPHOUSE.y));
      add(MILL.y + 24, (c) => drawWindmill(c, t));
      add(900, (c) => drawTractor(c)); add(1000, (c) => drawScarecrow(c, t));
      for (const h of HAY) add(h.y, (c) => drawHay(c, h));
      for (const tr of TREES) if (tr.x > view.x - 60 && tr.x < view.x + view.w + 60 && tr.y > view.y && tr.y < view.y + view.h) add(tr.y, (c) => { const s2 = treeFor(tr); c.drawImage(s2, tr.x - s2.width / 2, tr.y - s2.height + 6); });
      const ripe = (root.NightshiftSupply?.state ? S.stockNow(root.NightshiftSupply.state, 'orchard') : 12) > 3;
      for (const tr of ORCH) add(tr.y, (c) => c.drawImage(ripe ? SPR.apple : SPR.appleBare, tr.x - 32, tr.y - 78));
      for (const a of cows) add(a.y, (c) => drawCow(c, a, t));
      for (const a of hens) add(a.y, (c) => drawHen(c, a, t));
      out.push(...cornProps(view));
      // road lamps
      for (let x = 160; x < MAP.w; x += 420) add(ROAD.y - 6, (c) => { R(c, '#3a3f45', x, ROAD.y - 56, 3, 52); R(c, '#3a3f45', x, ROAD.y - 56, 14, 3); R(c, lit ? '#ffe9a8' : '#8a8a80', x + 10, ROAD.y - 54, 6, 3); });
      add(586, (c) => api.zone && Z.api.busStopArt(c, 130, 586, t));
      return out;
    },
    drawTop(c, t) {
      // chimney smoke + birds
      for (let k = 0; k < 4; k++) { const ph = (t * 0.25 + k / 4) % 1; c.save(); c.globalAlpha = 0.4 * (1 - ph); C(c, '#e8eef2', HOUSE.x + 47 + Math.sin(ph * 5 + k) * 5, HOUSE.y + 18 - ph * 50, 4 + ph * 7); c.restore(); }
      for (let k = 0; k < 5; k++) { const x = ((t * 22 + k * 300) % (MAP.w + 200)) - 100, y = 200 + k * 140 + Math.sin(t + k) * 20, f = Math.sin(t * 10 + k) * 3; c.strokeStyle = '#1e1a18'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 5, y - f); c.lineTo(x, y); c.lineTo(x + 5, y - f); c.stroke(); }
      // field label in the corn (only once you're through)
    },
    lights(api) {
      const out = [{ x: HOUSE.x + 40, y: HOUSE.y + HOUSE.h - 20, r: 70 }, { x: HOUSE.x + HOUSE.w - 40, y: HOUSE.y + HOUSE.h - 20, r: 70 }, { x: COOP.x + COOP.w / 2, y: COOP.y + COOP.h, r: 80 }, { x: BARN.x + BARN.w / 2, y: BARN.y + BARN.h, r: 60 }, { x: 130, y: 560, r: 70 }, { x: MILL.x, y: MILL.y - 26, r: 40 }];
      for (let x = 160; x < MAP.w; x += 420) out.push({ x: x + 13, y: ROAD.y - 40, r: 90 });
      return out;
    },
  });

  // keep the farm ticking while you're away (animals) — and expose for the guide / goals
  setInterval(() => { const s = st(); if (s) F.tickAnimals(s, Date.now()); }, 15000);
  root.NightshiftFarm = Object.freeze({ PLOTS, MAP, openCoop, paused: () => !pnl.hidden });
})(typeof globalThis !== 'undefined' ? globalThis : this);
