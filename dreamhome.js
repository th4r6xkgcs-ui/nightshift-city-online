/* The dream house interior (Claude-owned). Requires zones.js, decor-data.js, pets.js. Entered from Palm Grove once
 * you own the dream house (suburbs.js). Four rooms — living room, kitchen & bar, bedroom, a four-car garage — with 15
 * decor slots you furnish piece by piece (decor-data.js). Walk up to anything and press DECOR to swap it; the house
 * computer by the door (STYLE) lists every slot in one place. Your cars park in the garage with their body kits,
 * all your pets roam the house, and the bed gives a "Well rested" XP boost. Everything is procedural pixel art.
 * Save: nightshift-decor-v1. API: NightshiftDreamHome.{state, openStyle, openSlot} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const Z = root.NightshiftZones, D = root.NightshiftDecorData;
  if (!Z || !D) return;
  const KEY = 'nightshift-decor-v1';
  let state = D.clean({});
  try { state = D.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const CARS = () => { try { return cars; } catch { return []; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const O = (c, col, x, y, rx, ry) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); c.fill(); };
  const C = (c, col, x, y, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); c.fill(); };
  const RR = (c, col, x, y, w, h, r) => { c.fillStyle = col; c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.fill(); };
  const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const glow = (c, x, y, r, col, a = 0.35) => { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, col + '00'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.restore(); };
  const owned = () => !!root.NightshiftPets?.state?.dream;
  const nightish = () => { try { return (root.NightshiftEnvironment?.darkness?.(root.NightshiftEnvironment.state.minute) || 0) > 0.3; } catch { return false; } };
  const placed = (slot) => state.placed[slot];

  // style perk: clients trust a nice place
  const hk = setInterval(() => { const SK = root.NightshiftSkills; if (SK?.addModifier) { SK.addModifier((k) => (k === 'dealing.price' ? D.priceBonus(state, owned()) : 1)); clearInterval(hk); } }, 400);

  // ---------------- layout ----------------
  const W = 1200, H = 820, T = 16;
  const WALLS = [
    { x: 0, y: 0, w: W, h: T }, { x: 0, y: H - T, w: 560, h: T }, { x: 1100, y: H - T, w: 100, h: T }, { x: 0, y: 0, w: T, h: 170 }, { x: 0, y: 250, w: T, h: H - 250 }, { x: W - T, y: 0, w: T, h: H },
    { x: 640, y: 0, w: T, h: 180 }, { x: 640, y: 290, w: T, h: 146 },
    { x: 0, y: 420, w: 220, h: T }, { x: 320, y: 420, w: 540, h: T }, { x: 960, y: 420, w: W - 960, h: T },
    { x: 460, y: 420, w: T, h: H - 420 },
  ];
  const GARAGE_DOOR = { x: 560, y: H - T, w: 540, h: T };
  const BAYS = [560, 700, 840, 980];
  const ROOMS = { living: { x: T, y: T, w: 640 - T, h: 420 - T }, kitchen: { x: 656, y: T, w: W - 656 - T, h: 420 - T }, bed: { x: T, y: 436, w: 460 - T, h: H - 436 - T }, garage: { x: 476, y: 436, w: W - 476 - T, h: H - 436 - T } };
  const FACE = 26; // visible wall face under top walls

  // ---------------- static ground (cached) ----------------
  function ground(c) {
    R(c, '#0a0d14', 0, 0, W, H);
    // living room: herringbone oak
    { const r = ROOMS.living; R(c, '#8a6440', r.x, r.y, r.w, r.h); const g = rng(3);
      for (let y = r.y; y < r.y + r.h; y += 10) for (let x = r.x + ((y / 10) % 2) * 15; x < r.x + r.w; x += 30) { const sh = ['#94704a', '#7f5b39', '#8a6440', '#9a7650'][(g() * 4) | 0]; R(c, sh, x, y, 28, 9); R(c, '#6d4c2e', x, y + 9, 28, 1); R(c, '#a88257', x, y, 28, 1); } }
    // kitchen: marble tiles
    { const r = ROOMS.kitchen; const g = rng(5); for (let y = r.y; y < r.y + r.h; y += 32) for (let x = r.x; x < r.x + r.w; x += 32) { R(c, ((x + y) / 32) % 2 ? '#e9e6df' : '#dcd8cf', x, y, 32, 32); for (let k = 0; k < 3; k++) { c.strokeStyle = '#b9b3a866'; c.lineWidth = 1; c.beginPath(); const sx = x + g() * 32, sy = y + g() * 32; c.moveTo(sx, sy); c.lineTo(sx + (g() - 0.5) * 22, sy + (g() - 0.5) * 22); c.stroke(); } R(c, '#c9c3b7', x, y, 32, 1); R(c, '#c9c3b7', x, y, 1, 32); } }
    // bedroom: plush carpet
    { const r = ROOMS.bed; R(c, '#4b4560', r.x, r.y, r.w, r.h); const g = rng(7); for (let i = 0; i < 1600; i++) R(c, g() < 0.5 ? '#544d6b' : '#423c55', r.x + g() * r.w, r.y + g() * r.h, 2, 2); }
    // garage base (decor floor draws on top every frame)
    { const r = ROOMS.garage; R(c, '#5d6166', r.x, r.y, r.w, r.h); }
    // wall faces under top walls (living, kitchen: exterior wall; bedroom + garage: interior wall)
    const face = (x, y, w, col, trim) => { R(c, col, x, y, w, FACE); R(c, '#00000022', x, y + FACE - 6, w, 6); R(c, trim, x, y + FACE - 3, w, 3); R(c, '#ffffff14', x, y, w, 1); };
    face(T, T, 640 - T, '#d9cdb5', '#6d4c2e'); face(656, T, W - 656 - T, '#e9ecef', '#9aa3ab'); face(T, 436, 460 - T, '#6e6890', '#3c3752'); face(476, 436, W - 476 - T, '#7d8288', '#4a4f55');
    // windows on the exterior wall (sky painted per frame in drawGround)
    // walls (top surfaces)
    for (const w of WALLS) { R(c, '#262a33', w.x, w.y, w.w, w.h); R(c, '#353a45', w.x, w.y, w.w, 2); R(c, '#1a1d24', w.x, w.y + w.h - 2, w.w, 2); }
    // door frames
    for (const [x, y, w, h] of [[220, 420, 100, T], [860, 420, 100, T], [640, 180, T, 110]]) { R(c, '#3a3f49', x, y, w, h); R(c, '#4a505b', x, y, w, 2); }
    // front door mat + frame
    R(c, '#5a3b22', 0, 170, T, 80); R(c, '#7a5532', 2, 172, 4, 76); R(c, '#2f3540', T + 4, 186, 30, 48); R(c, '#3d4452', T + 6, 188, 26, 44); for (let k = 0; k < 6; k++) R(c, '#2a2f38', T + 8, 192 + k * 7, 22, 2);
    // kitchen units along the right wall: fridge, oven, sink run
    { const x0 = W - T - 46; R(c, '#00000033', x0 - 4, 60, 50, 300);
      R(c, '#c9cdd2', x0, 60, 46, 60); R(c, '#e7eaee', x0 + 2, 62, 42, 26); R(c, '#dfe3e7', x0 + 2, 90, 42, 28); R(c, '#9aa3ab', x0 + 4, 70, 2, 12); R(c, '#9aa3ab', x0 + 4, 96, 2, 14); // fridge
      R(c, '#8a8f96', x0, 124, 46, 236); R(c, '#e8e6e0', x0 + 2, 126, 42, 232); // counter
      R(c, '#1d2024', x0 + 6, 140, 34, 34); for (const [bx, by] of [[x0 + 14, 149], [x0 + 32, 149], [x0 + 14, 166], [x0 + 32, 166]]) { C(c, '#3a3f45', bx, by, 6); C(c, '#2a2d30', bx, by, 3.5); } // hob
      R(c, '#b9c0c6', x0 + 8, 200, 30, 40); R(c, '#8fa3b0', x0 + 11, 203, 24, 34); R(c, '#cfd6db', x0 + 22, 196, 3, 8); // sink
      R(c, '#7a5532', x0 + 10, 262, 26, 18); for (let k = 0; k < 4; k++) R(c, ['#e0473a', '#e8b923', '#7cdeb5', '#3d7fd0'][k], x0 + 12 + k * 6, 258, 4, 8); // board + jars
      C(c, '#2f6f3a', x0 + 23, 312, 8); C(c, '#4b9a52', x0 + 21, 309, 4); R(c, '#c9b14a', x0 + 14, 330, 18, 12); }
    // kitchen island
    { R(c, '#00000033', 760, 168, 170, 52); R(c, '#2b2f36', 756, 162, 170, 52); R(c, '#f2efe8', 758, 164, 166, 46); R(c, '#d8d3c8', 758, 204, 166, 6); for (let k = 0; k < 4; k++) { C(c, '#2b2f36', 778 + k * 42, 228, 9); C(c, '#4a505b', 778 + k * 42, 227, 6); }
      O(c, '#f2f2ee', 800, 184, 14, 8); for (const [fx, fy, col] of [[795, 182, '#e0473a'], [804, 185, '#e8b923'], [800, 180, '#7cbf4a']]) C(c, col, fx, fy, 3); R(c, '#3d7fd0', 880, 176, 8, 12); }
    // bedroom wardrobe + desk
    { R(c, '#00000033', 30, 452, 120, 40); R(c, '#5a3b22', 26, 446, 120, 40); R(c, '#7a5532', 26, 446, 120, 4); R(c, '#4a301c', 85, 450, 2, 34); C(c, '#c9b14a', 80, 468, 1.5); C(c, '#c9b14a', 92, 468, 1.5); }
    // garage: workbench + tool chest + oil drum along the left wall
    { R(c, '#00000033', 490, 560, 40, 120); R(c, '#4a505b', 486, 556, 40, 120); R(c, '#6f7880', 486, 556, 40, 3); for (let k = 0; k < 6; k++) { R(c, '#3a3f45', 488, 562 + k * 19, 36, 1); R(c, '#cfd6db', 500, 568 + k * 19, 12, 2); }
      O(c, '#2f5d8a', 506, 712, 13, 9); O(c, '#3d7fd0', 506, 710, 13, 9); O(c, '#244a6e', 506, 710, 8, 5); R(c, '#e8e2d0', 498, 708, 16, 3); }
  }

  // ---------------- per-frame floor layer (rugs, garage floor, windows, flat decor) ----------------
  function windows(c, t) {
    const n = nightish(), m = root.NightshiftEnvironment?.state?.minute ?? 720;
    for (const wx of [60, 230, 440, 700, 1000]) {
      const sky = n ? ['#0b1430', '#16224a'] : m < 9 * 60 ? ['#f2b38a', '#9fc3e0'] : m > 17 * 60 ? ['#e08a5a', '#5a6ab0'] : ['#9fd0f0', '#cfe8f8'];
      const gr = c.createLinearGradient(0, 2, 0, 14); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); c.fillStyle = gr; c.fillRect(wx, 3, 90, 11);
      if (n) for (let k = 0; k < 5; k++) R(c, '#ffffffaa', wx + ((k * 37 + 11) % 86), 4 + ((k * 13) % 8), 1, 1);
      R(c, '#e9ecef', wx - 2, 2, 94, 1); R(c, '#e9ecef', wx - 2, 14, 94, 2); R(c, '#e9ecef', wx + 44, 3, 2, 11);
    }
  }
  const FLOOR = {
    'gfloor-concrete': (c) => { const r = ROOMS.garage; R(c, '#6b6f74', r.x, r.y + FACE, r.w, r.h - FACE); for (let x = r.x; x < r.x + r.w; x += 118) R(c, '#5a5e63', x, r.y + FACE, 1, r.h); for (let y = r.y + FACE; y < r.y + r.h; y += 118) R(c, '#5a5e63', r.x, y, r.w, 1); for (const [ox, oy] of [[600, 690], [860, 650], [1010, 720], [720, 560]]) { O(c, '#4c5055', ox, oy, 16, 7); O(c, '#45494d', ox + 3, oy, 8, 3); } },
    'gfloor-checker': (c) => { const r = ROOMS.garage; for (let y = r.y + FACE; y < r.y + r.h; y += 28) for (let x = r.x; x < r.x + r.w; x += 28) R(c, ((x - r.x) / 28 + (y - r.y - FACE) / 28) % 2 < 1 ? '#e8e6e0' : '#1d2024', x, y, 28, 28); R(c, '#ffffff10', r.x, r.y + FACE, r.w, 60); },
    'gfloor-mirror': (c, t) => { const r = ROOMS.garage; R(c, '#0d0f13', r.x, r.y + FACE, r.w, r.h - FACE); c.save(); c.globalAlpha = 0.12; for (let k = 0; k < 6; k++) { const x = r.x + 60 + k * 120 + Math.sin(t * 0.3 + k) * 6; c.fillStyle = '#9fc3e0'; c.beginPath(); c.moveTo(x, r.y + FACE); c.lineTo(x + 30, r.y + FACE); c.lineTo(x - 30, r.y + r.h); c.lineTo(x - 50, r.y + r.h); c.fill(); } c.restore(); for (const bx of BAYS) { R(c, '#e8b92355', bx - 30, 560, 2, 150); R(c, '#e8b92355', bx + 30, 560, 2, 150); } },
  };
  const RUG = {
    'rug-persian': (c, x, y) => { R(c, '#00000022', x - 128, y - 70, 260, 146); R(c, '#e8dcc0', x - 132, y - 74, 264, 2); for (let k = -130; k < 132; k += 4) { R(c, '#e8dcc0', x + k, y - 78, 2, 5); R(c, '#e8dcc0', x + k, y + 74, 2, 5); } R(c, '#1f2f5a', x - 130, y - 72, 260, 146); R(c, '#8a1f24', x - 118, y - 60, 236, 122); R(c, '#c9a24a', x - 118, y - 60, 236, 2); R(c, '#c9a24a', x - 118, y + 60, 236, 2);
      for (let i = -100; i <= 100; i += 25) for (let j = -40; j <= 40; j += 20) { c.fillStyle = (i / 25 + j / 20) % 2 ? '#b8323a' : '#6d1a1f'; c.beginPath(); c.moveTo(x + i, y + j - 8); c.lineTo(x + i + 9, y + j); c.lineTo(x + i, y + j + 8); c.lineTo(x + i - 9, y + j); c.fill(); C(c, '#c9a24a', x + i, y + j, 1.5); }
      c.fillStyle = '#1f2f5a'; c.beginPath(); c.moveTo(x, y - 34); c.lineTo(x + 48, y); c.lineTo(x, y + 34); c.lineTo(x - 48, y); c.fill(); c.fillStyle = '#c9a24a'; c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x + 28, y); c.lineTo(x, y + 20); c.lineTo(x - 28, y); c.fill(); C(c, '#8a1f24', x, y, 6); },
    'rug-tiger': (c, x, y) => { R(c, '#00000022', x - 116, y - 60, 236, 126); c.fillStyle = '#e08a2a'; c.beginPath(); c.ellipse(x, y, 120, 64, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f2c27a'; c.beginPath(); c.ellipse(x, y + 10, 90, 34, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1b1410'; for (let k = -6; k <= 6; k++) { const sx = x + k * 17; c.beginPath(); c.moveTo(sx - 3, y - 60 + Math.abs(k) * 2); c.quadraticCurveTo(sx + 6, y - 30, sx - 2, y - 8); c.lineTo(sx + 2, y - 10); c.quadraticCurveTo(sx + 10, y - 30, sx + 4, y - 58 + Math.abs(k) * 2); c.fill(); c.beginPath(); c.moveTo(sx, y + 58 - Math.abs(k) * 2); c.quadraticCurveTo(sx + 7, y + 34, sx + 1, y + 20); c.lineTo(sx + 4, y + 22); c.quadraticCurveTo(sx + 11, y + 36, sx + 5, y + 58 - Math.abs(k) * 2); c.fill(); }
      O(c, '#e08a2a', x - 128, y, 18, 16); O(c, '#f2c27a', x - 134, y + 4, 9, 7); C(c, '#1b1410', x - 134, y - 6, 2); C(c, '#e8e2a0', x - 128, y - 6, 2); C(c, '#111', x - 128, y - 6, 1); O(c, '#d07a20', x - 126, y - 16, 5, 4); O(c, '#d07a20', x - 126, y + 16, 5, 4); },
    'rug-gold': (c, x, y) => { R(c, '#00000022', x - 128, y - 70, 260, 146); R(c, '#111317', x - 130, y - 72, 260, 146); for (const k of [6, 14]) { c.strokeStyle = '#c9a24a'; c.lineWidth = k === 6 ? 2 : 1; c.strokeRect(x - 130 + k, y - 72 + k, 260 - 2 * k, 146 - 2 * k); }
      for (let i = -112; i <= 112; i += 16) { c.strokeStyle = '#c9a24a88'; c.beginPath(); c.moveTo(x + i, y - 52); c.lineTo(x + i + 8, y - 44); c.lineTo(x + i + 16, y - 52); c.stroke(); c.beginPath(); c.moveTo(x + i, y + 52); c.lineTo(x + i + 8, y + 44); c.lineTo(x + i + 16, y + 52); c.stroke(); }
      c.strokeStyle = '#e8c86a'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 30, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; for (let a = 0; a < 12; a++) { c.beginPath(); c.moveTo(x + Math.cos(a * Math.PI / 6) * 12, y + Math.sin(a * Math.PI / 6) * 12); c.lineTo(x + Math.cos(a * Math.PI / 6) * 28, y + Math.sin(a * Math.PI / 6) * 28); c.stroke(); } C(c, '#c9a24a', x, y, 6); },
  };

  // ---------------- decor pieces (drawn y-sorted with you and the pets) ----------------
  const ITEMART = {
    // --- sofas (face up toward the screen) + matching coffee tables
    'sofa-thrift': (c, x, y) => { O(c, '#00000033', x, y + 22, 96, 10); R(c, '#8a5a32', x - 92, y - 18, 184, 40); R(c, '#a06a3a', x - 92, y - 18, 184, 14); R(c, '#7a4e2a', x - 92, y - 20, 16, 42); R(c, '#7a4e2a', x + 76, y - 20, 16, 42); for (let k = 0; k < 3; k++) { R(c, '#b07a48', x - 72 + k * 50, y - 14, 46, 22); R(c, '#c08a58', x - 72 + k * 50, y - 14, 46, 3); } R(c, '#5e7a3a', x + 20, y - 8, 12, 8); R(c, '#4a6230', x + 20, y - 8, 12, 1); // patch
      R(c, '#9a7a52', x - 32, y - 76, 64, 30); R(c, '#b08e60', x - 32, y - 76, 64, 3); for (let k = 0; k < 3; k++) R(c, '#7a5e3a', x - 32, y - 66 + k * 9, 64, 1); R(c, '#e8e2d0', x - 10, y - 70, 14, 10); R(c, '#c0473f', x + 12, y - 72, 8, 6); },
    'sofa-leather': (c, x, y) => { O(c, '#00000033', x + 10, y + 22, 112, 12); R(c, '#2a1d16', x - 96, y - 20, 200, 44); R(c, '#2a1d16', x + 70, y - 96, 36, 120); for (let k = 0; k < 3; k++) { RR(c, '#4a2e22', x - 86 + k * 52, y - 14, 48, 26, 5); R(c, '#6a4434', x - 82 + k * 52, y - 12, 36, 3); } for (let k = 0; k < 2; k++) { RR(c, '#4a2e22', x + 74, y - 88 + k * 44, 28, 40, 5); R(c, '#6a4434', x + 76, y - 86 + k * 44, 3, 30); } R(c, '#3a261c', x - 96, y + 18, 200, 6);
      R(c, '#00000033', x - 50, y - 70, 100, 40); R(c, '#9fc3d644', x - 52, y - 74, 100, 40); R(c, '#cfe6f2aa', x - 52, y - 74, 100, 2); R(c, '#cfe6f266', x - 50, y - 70, 30, 2); R(c, '#2b2f33', x - 50, y - 36, 4, 4); R(c, '#2b2f33', x + 44, y - 36, 4, 4); R(c, '#e8e2d0', x - 30, y - 64, 18, 12); R(c, '#2b2f33', x + 14, y - 62, 12, 8); C(c, '#c0473f', x + 30, y - 56, 4); },
    'sofa-chesterfield': (c, x, y) => { O(c, '#00000033', x, y + 24, 104, 12); RR(c, '#0f4a3a', x - 100, y - 22, 200, 46, 10); RR(c, '#14604a', x - 92, y - 16, 184, 32, 6); for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) { C(c, '#0a3a2c', x - 82 + i * 20 + (j % 2) * 10, y - 8 + j * 14, 2); C(c, '#2a8a6a', x - 83 + i * 20 + (j % 2) * 10, y - 9 + j * 14, 1); } O(c, '#0f4a3a', x - 100, y, 10, 22); O(c, '#0f4a3a', x + 100, y, 10, 22); O(c, '#1a7a5c', x - 102, y - 4, 4, 12); O(c, '#1a7a5c', x + 98, y - 4, 4, 12); for (const lx of [-92, 88]) R(c, '#c9a24a', x + lx, y + 22, 4, 4);
      RR(c, '#5a3420', x - 44, y - 80, 88, 40, 6); R(c, '#7a4a2c', x - 42, y - 78, 84, 3); R(c, '#2f6fa0', x - 30, y - 70, 18, 5); R(c, '#c0473f', x - 30, y - 65, 18, 5); R(c, '#e8b923', x - 30, y - 60, 18, 5); C(c, '#f2efe8', x + 18, y - 62, 7); C(c, '#3a1d12', x + 18, y - 62, 5); R(c, '#c9a24a', x + 34, y - 74, 2, 12); },
    'sofa-cloud': (c, x, y, t) => { O(c, '#00000033', x, y + 26, 118, 14); for (let k = 0; k < 5; k++) { O(c, '#e8e6e0', x - 88 + k * 44, y + 4, 28, 22); O(c, '#f7f6f2', x - 90 + k * 44, y - 2, 24, 16); } for (let k = 0; k < 4; k++) O(c, '#dcd9d2', x - 66 + k * 44, y - 14, 20, 10); O(c, '#e86a5a', x - 60, y - 6, 10, 8); O(c, '#e8b923', x + 56, y - 4, 10, 8); O(c, '#7cb7c9', x + 10, y - 8, 9, 7);
      O(c, '#00000033', x + 2, y - 52, 40, 20); O(c, '#d8d4cc', x, y - 56, 40, 20); O(c, '#f2efe8', x - 2, y - 59, 34, 14); c.strokeStyle = '#b9b3a8'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 22, y - 60); c.quadraticCurveTo(x, y - 50, x + 20, y - 62); c.stroke(); RR(c, '#2b2f36', x - 6, y - 74, 12, 16, 3); for (let k = 0; k < 3; k++) { c.strokeStyle = '#5fa04a'; c.beginPath(); c.moveTo(x, y - 74); c.lineTo(x - 8 + k * 8, y - 88 - k % 2 * 4); c.stroke(); C(c, ['#e86a8a', '#f2efe8', '#e8b923'][k], x - 8 + k * 8, y - 88 - k % 2 * 4, 3); } },
    // --- screens on the wall face
    'tv-none': (c, x, y) => { c.strokeStyle = '#00000022'; c.strokeRect(x - 36, y - 20, 72, 30); C(c, '#5a5e63', x - 30, y - 16, 1); C(c, '#5a5e63', x + 30, y - 16, 1); },
    'tv-flat': (c, x, y, t) => { R(c, '#00000044', x - 38, y - 21, 80, 38); R(c, '#111317', x - 40, y - 24, 80, 38); const k = (t * 0.6) % 1; const gr = c.createLinearGradient(x - 36, 0, x + 36, 0); gr.addColorStop(0, '#2a5a8a'); gr.addColorStop(k, '#e86a5a'); gr.addColorStop(1, '#1d2f4a'); c.fillStyle = gr; c.fillRect(x - 36, y - 21, 72, 31); R(c, '#ffffff22', x - 36, y - 21, 72, 3); R(c, '#05080f', x - 20, y + 2, 40, 6); O(c, '#ffe9a855', x + 10 * Math.sin(t), y - 6, 6, 4); glow(c, x, y + 10, 46, '#7cc7ff', 0.18);
      R(c, '#3a2a1e', x - 54, y + 18, 108, 16); R(c, '#5a3b22', x - 54, y + 18, 108, 3); R(c, '#2a1d14', x - 52, y + 24, 50, 8); R(c, '#2a1d14', x + 2, y + 24, 50, 8); R(c, '#1d2024', x + 30, y + 20, 14, 5); C(c, '#7cdeb5', x + 42, y + 22, 1); },
    'tv-cinema': (c, x, y, t) => { R(c, '#00000055', x - 86, y - 24, 176, 50); R(c, '#0a0b0e', x - 90, y - 26, 176, 50); const sky = c.createLinearGradient(0, y - 22, 0, y + 20); sky.addColorStop(0, '#2a1d4a'); sky.addColorStop(1, '#e86a5a'); c.fillStyle = sky; c.fillRect(x - 86, y - 22, 168, 42); C(c, '#ffd27a', x + 40, y + 6, 10);
      for (let k = 0; k < 14; k++) R(c, '#120e1e', x - 86 + k * 12, y + 20 - ((k * 37) % 26) - 6, 10, ((k * 37) % 26) + 6); const cx = x - 86 + ((t * 40) % 168); R(c, '#ff4a4a', cx, y + 16, 8, 3); R(c, '#ffe9a8', cx + 8, y + 16, 2, 2); R(c, '#ffffff18', x - 86, y - 22, 168, 4);
      for (const sx of [-104, 100]) { R(c, '#1a1c22', x + sx, y - 22, 14, 46); C(c, '#2b2f36', x + sx + 7, y - 10, 5); C(c, '#0a0b0e', x + sx + 7, y - 10, 2); C(c, '#2b2f36', x + sx + 7, y + 10, 6); C(c, '#0a0b0e', x + sx + 7, y + 10, 3); } R(c, '#1a1c22', x - 50, y + 28, 100, 6); for (let k = 0; k < 10; k++) R(c, '#ff4ad8', x - 90 + k * 18 + ((t * 30) % 18), y + 25, 6, 1);
      glow(c, x, y + 14, 120, '#e86a5a', 0.16); },
    // --- wall art
    'art-none': () => {},
    'art-skyline': (c, x, y) => { R(c, '#00000044', x - 31, y - 13, 66, 30); R(c, '#1d2024', x - 34, y - 16, 68, 30); const g = c.createLinearGradient(0, y - 13, 0, y + 11); g.addColorStop(0, '#f2b38a'); g.addColorStop(1, '#6a4a9a'); c.fillStyle = g; c.fillRect(x - 31, y - 13, 62, 24); for (let k = 0; k < 10; k++) R(c, '#1a1430', x - 31 + k * 6.2, y + 11 - ((k * 23) % 14) - 4, 5, ((k * 23) % 14) + 4); for (let k = 0; k < 8; k++) R(c, '#ffd27a', x - 28 + k * 7, y + 6 - (k % 3) * 2, 1, 1); },
    'art-neon': (c, x, y, t) => { const f = Math.sin(t * 7) > -0.92 ? 1 : 0.35; c.save(); c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.shadowBlur = 10 * f; c.shadowColor = '#ff4ad8'; c.fillStyle = f > 0.5 ? '#ffd0f4' : '#7a3a6a'; c.fillText('NIGHTSHIFT', x, y + 2); c.shadowColor = '#4ae0ff'; c.fillStyle = '#c8f6ff'; c.font = 'bold 6px system-ui'; c.fillText('★ CITY ★', x, y + 10); c.restore(); glow(c, x, y, 50, '#ff4ad8', 0.22 * f); },
    'art-master': (c, x, y) => { R(c, '#00000055', x - 26, y - 17, 56, 38); R(c, '#9a7a2a', x - 29, y - 20, 58, 38); R(c, '#e8c86a', x - 29, y - 20, 58, 2); R(c, '#6a5018', x - 29, y + 16, 58, 2); for (const [cx2, cy2] of [[-29, -20], [27, -20], [-29, 16], [27, 16]]) C(c, '#e8c86a', x + cx2 + 1, y + cy2 + 1, 2.5);
      const g = c.createLinearGradient(0, y - 15, 0, y + 13); g.addColorStop(0, '#3a4a2a'); g.addColorStop(1, '#1d2418'); c.fillStyle = g; c.fillRect(x - 24, y - 15, 48, 28); O(c, '#c99a6b', x, y - 3, 7, 9); O(c, '#2a1d14', x, y - 9, 8, 5); R(c, '#3a2a4a', x - 10, y + 5, 20, 8); R(c, '#e8e2d0', x - 3, y + 5, 6, 3); for (let k = 0; k < 5; k++) R(c, '#ffffff10', x - 22 + k * 10, y - 14, 3, 26); },
    // --- plants
    'plant-none': () => {},
    'plant-monstera': (c, x, y) => { O(c, '#00000033', x, y + 8, 16, 5); R(c, '#b0603a', x - 10, y - 8, 20, 16); R(c, '#c8784a', x - 11, y - 9, 22, 3); for (const [a, l] of [[-2.4, 22], [-1.6, 26], [-0.9, 22], [-0.3, 20], [-2.9, 18]]) { const lx = x + Math.cos(a) * l, ly = y - 10 + Math.sin(a) * l; c.strokeStyle = '#2f6f3a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - 8); c.lineTo(lx, ly); c.stroke(); O(c, '#2f8a44', lx, ly, 9, 7); O(c, '#4bb05a', lx - 2, ly - 2, 5, 3); R(c, '#1d4a26', lx - 1, ly - 6, 2, 12); } },
    'plant-bonsai': (c, x, y) => { O(c, '#00000033', x, y + 10, 18, 5); R(c, '#e8e6e0', x - 14, y - 4, 28, 14); R(c, '#cfcac0', x - 14, y + 7, 28, 3); R(c, '#2b2f36', x - 12, y - 10, 24, 7); R(c, '#4a505b', x - 12, y - 10, 24, 2); c.strokeStyle = '#5a3b22'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y - 10); c.quadraticCurveTo(x - 8, y - 18, x + 2, y - 26); c.quadraticCurveTo(x + 10, y - 32, x + 4, y - 38); c.stroke(); for (const [ox, oy, rx] of [[-8, -28, 9], [8, -34, 8], [2, -42, 7], [-2, -20, 6]]) { O(c, '#2f6f3a', x + ox, y + oy, rx, rx * 0.6); O(c, '#5fa04a', x + ox - 2, y + oy - 2, rx * 0.5, rx * 0.3); } },
    'plant-palm': (c, x, y, t) => { O(c, '#00000033', x, y + 8, 16, 5); R(c, '#b08a2a', x - 9, y - 10, 18, 18); R(c, '#e8c86a', x - 10, y - 12, 20, 3); R(c, '#8a6a1a', x - 9, y + 4, 18, 2); R(c, '#7a5a32', x - 1, y - 34, 3, 24); for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.5 + Math.sin(t + k) * 0.03; c.strokeStyle = '#2f8a44'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 34); c.quadraticCurveTo(x + Math.cos(a) * 16, y - 34 + Math.sin(a) * 16 - 6, x + Math.cos(a) * 28, y - 34 + Math.sin(a) * 24 + 8); c.stroke(); for (let j = 4; j < 26; j += 4) { const px = x + Math.cos(a) * j, py = y - 34 + Math.sin(a) * j * 0.9; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a + 1.2) * 4, py + Math.sin(a + 1.2) * 4 + 2); c.stroke(); } } },
    // --- aquariums against the divider wall
    'aqua-none': () => {},
    'aqua-bowl': (c, x, y, t) => { R(c, '#5a3b22', x - 12, y + 10, 24, 30); R(c, '#7a5532', x - 12, y + 10, 24, 3); O(c, '#9fd0f088', x, y, 14, 12); O(c, '#cfe8f855', x - 4, y - 4, 5, 3); const fx = x + Math.sin(t * 1.3) * 7; O(c, '#ff8a3a', fx, y + 2, 3, 2); c.fillStyle = '#ff8a3a'; c.beginPath(); c.moveTo(fx - 3 * Math.sign(Math.cos(t * 1.3)), y + 2); c.lineTo(fx - 6 * Math.sign(Math.cos(t * 1.3)), y - 1); c.lineTo(fx - 6 * Math.sign(Math.cos(t * 1.3)), y + 5); c.fill(); },
    'aqua-reef': (c, x, y, t) => { const w = 34, h = 116; R(c, '#00000044', x - w / 2 + 3, y - h / 2 + 3, w, h); R(c, '#2b2f36', x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4); const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, '#0a4a7a'); g.addColorStop(1, '#1a7ab0'); c.fillStyle = g; c.fillRect(x - w / 2, y - h / 2, w, h);
      for (const [cx2, cy2, col, r] of [[-8, 40, '#e86a8a', 6], [6, 46, '#ff9a3a', 5], [-2, -30, '#e8b923', 4], [9, 10, '#b06ad8', 5], [-9, -2, '#e86a8a', 4]]) { C(c, col, x + cx2, y + cy2, r); C(c, '#ffffff33', x + cx2 - 1, y + cy2 - 1, r * 0.4); } R(c, '#e8dcc0', x - w / 2, y + h / 2 - 6, w, 6);
      for (let k = 0; k < 4; k++) { const fy = y - 40 + k * 22 + Math.sin(t * 1.7 + k) * 4, fx = x + Math.sin(t * (0.8 + k * 0.2) + k * 2) * 10; O(c, ['#ffd23a', '#3dd0ff', '#ff6a3a', '#f2f2ee'][k], fx, fy, 2, 4); }
      for (let k = 0; k < 5; k++) C(c, '#cfe8f8aa', x + 10 - (k % 2) * 4, y + h / 2 - 8 - ((t * 30 + k * 23) % (h - 10)), 1); R(c, '#cfe8f8', x - w / 2, y - h / 2, w, 3); glow(c, x, y, 60, '#3dd0ff', 0.18); },
    'aqua-shark': (c, x, y, t) => { const w = 44, h = 150; R(c, '#00000055', x - w / 2 + 3, y - h / 2 + 3, w, h); R(c, '#111317', x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6); R(c, '#c9a24a', x - w / 2 - 3, y - h / 2 - 3, w + 6, 2); const g = c.createLinearGradient(0, y - h / 2, 0, y + h / 2); g.addColorStop(0, '#0a3a6a'); g.addColorStop(1, '#04162e'); c.fillStyle = g; c.fillRect(x - w / 2, y - h / 2, w, h);
      for (let k = 0; k < 4; k++) { c.save(); c.globalAlpha = 0.12; c.fillStyle = '#9fd0f0'; c.fillRect(x - w / 2 + k * 12 + Math.sin(t + k) * 3, y - h / 2, 4, h); c.restore(); }
      const sy = y + Math.sin(t * 0.5) * (h / 2 - 22), dir = Math.cos(t * 0.5) > 0 ? 1 : -1; c.save(); c.translate(x, sy); c.scale(1, dir); O(c, '#6f8796', 0, 0, 7, 18); O(c, '#cfd6db', 2, 2, 4, 12); c.fillStyle = '#6f8796'; c.beginPath(); c.moveTo(-6, -2); c.lineTo(-13, 6); c.lineTo(-5, 6); c.fill(); c.beginPath(); c.moveTo(6, -2); c.lineTo(13, 6); c.lineTo(5, 6); c.fill(); c.beginPath(); c.moveTo(0, 16); c.lineTo(-7, 26); c.lineTo(7, 26); c.fill(); C(c, '#111', -3, -12, 1); C(c, '#111', 3, -12, 1); c.restore();
      for (let k = 0; k < 6; k++) O(c, '#ffd23a', x + Math.sin(t * 1.4 + k * 1.1) * 14, y - 60 + k * 22 + Math.cos(t + k) * 3, 1.5, 3); R(c, '#2a3a4a', x - w / 2, y + h / 2 - 8, w, 8); for (let k = 0; k < 4; k++) R(c, '#4a6a5a', x - w / 2 + 4 + k * 10, y + h / 2 - 16, 3, 10); glow(c, x, y, 80, '#3d7fd0', 0.22); },
    // --- bar along the kitchen's top wall
    'bar-counter': (c, x, y) => { R(c, '#00000033', x - 98, y - 6, 200, 34); R(c, '#8a8f96', x - 100, y - 10, 200, 32); R(c, '#e8e6e0', x - 98, y - 8, 196, 26); R(c, '#cfcac0', x - 98, y + 14, 196, 4); C(c, '#c0473f', x - 60, y + 2, 5); R(c, '#e8e2d0', x - 20, y - 2, 14, 10); R(c, '#2b2f36', x + 30, y - 4, 10, 14); for (const sx of [-50, 50]) { C(c, '#2b2f36', x + sx, y + 36, 9); C(c, '#4a505b', x + sx, y + 35, 6); } },
    'bar-home': (c, x, y, t) => { for (let k = 0; k < 14; k++) { R(c, ['#3a7a3a', '#8a3a2a', '#c9a24a', '#2a5a8a', '#e8e2d0'][k % 5], x - 90 + k * 13, y - 50 + (k % 2) * 2, 5, 12); R(c, '#ffffff33', x - 90 + k * 13, y - 50 + (k % 2) * 2, 2, 12); } R(c, '#5a3b22', x - 96, y - 38, 192, 3);
      R(c, '#00000033', x - 100, y - 4, 206, 34); R(c, '#4a301c', x - 104, y - 10, 208, 34); R(c, '#7a5532', x - 104, y - 10, 208, 6); R(c, '#9a7048', x - 104, y - 10, 208, 2); for (let k = 0; k < 8; k++) R(c, '#3a2414', x - 100 + k * 26, y - 2, 1, 24); R(c, '#c9d1d6', x - 6, y - 16, 12, 8); for (let k = 0; k < 3; k++) R(c, '#e8c86a', x - 4 + k * 4, y - 22, 2, 8); R(c, '#e8b923aa', x + 40, y - 6, 6, 9); R(c, '#ffffffaa', x + 40, y - 6, 6, 2);
      for (let k = 0; k < 4; k++) { const sx = x - 75 + k * 50; C(c, '#00000033', sx + 2, y + 42, 10); C(c, '#3a2414', sx, y + 38, 10); C(c, '#8a2a2a', sx, y + 37, 7); C(c, '#a83a3a', sx - 2, y + 35, 3); } },
    'bar-gold': (c, x, y, t) => { for (let s = 0; s < 2; s++) { R(c, '#1a1c22', x - 100, y - 54 + s * 16, 200, 3); for (let k = 0; k < 16; k++) { const col = ['#c9a24a', '#8a3a2a', '#2a8a5a', '#e8e2d0', '#5a2a8a'][(k + s) % 5]; R(c, col, x - 94 + k * 12, y - 64 + s * 16, 5, 10); R(c, '#ffffff44', x - 94 + k * 12, y - 64 + s * 16, 1, 10); } } glow(c, x, y - 52, 110, '#ffd27a', 0.2);
      R(c, '#00000044', x - 106, y - 4, 216, 36); R(c, '#14161a', x - 110, y - 12, 220, 36); R(c, '#2a2d34', x - 110, y - 12, 220, 6); R(c, '#e8c86a', x - 110, y - 12, 220, 2); R(c, '#c9a24a', x - 110, y + 22, 220, 2); for (let k = 0; k < 10; k++) R(c, '#ffffff0a', x - 106 + k * 22, y - 6, 8, 26);
      O(c, '#c9d1d6', x + 60, y, 9, 7); O(c, '#e8e6e0', x + 60, y - 2, 7, 4); R(c, '#2a5a3a', x + 57, y - 14, 3, 12); R(c, '#2a5a3a', x + 63, y - 12, 3, 10); R(c, '#e8c86a', x + 57, y - 16, 3, 3); for (let k = 0; k < 3; k++) { R(c, '#e8e6e088', x - 60 + k * 12, y - 4, 5, 9); R(c, '#e8c86a', x - 60 + k * 12, y + 4, 5, 1); }
      for (let k = 0; k < 5; k++) { const sx = x - 88 + k * 44; C(c, '#00000033', sx + 2, y + 44, 10); C(c, '#c9a24a', sx, y + 40, 10); C(c, '#1a1c22', sx, y + 39, 7); C(c, '#e8c86a', sx - 2, y + 37, 2); } },
    // --- game corner
    'game-none': () => {},
    'game-cards': (c, x, y) => { for (const [a] of [[0], [Math.PI / 2], [Math.PI], [-Math.PI / 2]]) { const cx2 = x + Math.cos(a) * 44, cy2 = y + Math.sin(a) * 34; C(c, '#00000033', cx2 + 2, cy2 + 3, 10); C(c, '#3a2414', cx2, cy2, 10); C(c, '#5a3b22', cx2, cy2 - 1, 7); } C(c, '#00000033', x + 3, y + 4, 34); C(c, '#5a3b22', x, y, 34); C(c, '#1d6a3a', x, y, 29); C(c, '#22804a', x - 4, y - 4, 18);
      for (let k = 0; k < 5; k++) { R(c, '#f2efe8', x - 14 + k * 7, y - 4, 6, 9); R(c, k % 2 ? '#c0473f' : '#1d2024', x - 13 + k * 7, y - 3, 2, 2); } for (const [px, py, col] of [[-18, 12, '#c0473f'], [-14, 14, '#3d7fd0'], [16, 10, '#f2efe8'], [18, -14, '#1d2024'], [-20, -12, '#e8b923']]) for (let k = 0; k < 3; k++) O(c, col, x + px, y + py - k * 2, 4, 2.5); },
    'game-pool': (c, x, y) => { R(c, '#00000044', x - 70, y - 36, 146, 80); R(c, '#4a2a18', x - 74, y - 40, 148, 80); R(c, '#6a3c22', x - 74, y - 40, 148, 4); R(c, '#1d6a3a', x - 64, y - 30, 128, 60); R(c, '#22804a', x - 64, y - 30, 128, 20); for (const [px, py] of [[-64, -30], [0, -32], [64, -30], [-64, 30], [0, 32], [64, 30]]) C(c, '#0a0b0e', x + px, y + py, 5);
      R(c, '#f2efe866', x + 30, y - 30, 1, 60); const balls = ['#e8b923', '#3d7fd0', '#c0473f', '#5a2a8a', '#ff8a3a', '#2a8a5a', '#8a2a2a', '#111']; let k = 0; for (let r = 0; r < 4; r++) for (let j = 0; j <= r; j++) { if (k >= balls.length) break; C(c, balls[k], x + 34 + r * 6, y - r * 3 + j * 6, 3); C(c, '#ffffff66', x + 33 + r * 6, y - r * 3 + j * 6 - 1, 1); k++; } C(c, '#f2f2ee', x - 30, y, 3);
      c.strokeStyle = '#c9a26a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 36, y + 2); c.lineTo(x - 100, y + 30); c.stroke(); R(c, '#e8e2d0', x - 37, y + 1, 3, 2); for (const [lx, ly] of [[-70, -36], [66, -36], [-70, 32], [66, 32]]) R(c, '#2a1810', x + lx, y + ly, 6, 6); },
    'game-arcade': (c, x, y, t) => { for (let k = 0; k < 3; k++) { const ax = x - 60 + k * 60, col = ['#c0473f', '#3d7fd0', '#e8b923'][k]; R(c, '#00000044', ax - 18, y - 30, 40, 64); R(c, '#14161a', ax - 20, y - 34, 40, 64); R(c, col, ax - 20, y - 34, 40, 6); R(c, col, ax - 20, y - 34, 4, 64); R(c, col, ax + 16, y - 34, 4, 64);
      const scr = ['#2a1d4a', '#0a3a2a', '#3a1a1a'][k]; R(c, scr, ax - 13, y - 24, 26, 20); for (let j = 0; j < 4; j++) R(c, ['#ff4ad8', '#4ae0ff', '#ffe94a', '#7cdeb5'][(j + k + Math.floor(t * 3)) % 4], ax - 11 + ((j * 7 + t * 20 * (k + 1)) % 22), y - 20 + j * 4, 3, 2); glow(c, ax, y - 14, 26, ['#ff4ad8', '#4ae0ff', '#ffe94a'][k], 0.25);
      R(c, '#2a2d34', ax - 16, y, 32, 12); C(c, '#c0473f', ax - 6, y + 5, 3); C(c, '#e8b923', ax + 4, y + 4, 2); C(c, '#3d7fd0', ax + 10, y + 6, 2); R(c, '#111', ax - 8, y + 2, 2, 5); } C(c, '#3a2414', x + 10, y + 46, 9); C(c, '#c0473f', x + 10, y + 45, 6); },
    // --- music
    'music-none': () => {},
    'music-jukebox': (c, x, y, t) => { const hue = (t * 60) % 360; R(c, '#00000044', x - 18, y - 26, 40, 56); RR(c, '#5a2a1a', x - 20, y - 30, 40, 56, 14); RR(c, `hsl(${hue},80%,60%)`, x - 16, y - 26, 32, 22, 12); RR(c, '#2a1810', x - 12, y - 20, 24, 14, 6); for (let k = 0; k < 5; k++) R(c, `hsl(${(hue + k * 40) % 360},90%,65%)`, x - 10 + k * 5, y - 18 + (k % 2), 3, 10);
      R(c, '#c9d1d6', x - 14, y - 2, 28, 8); for (let k = 0; k < 6; k++) R(c, '#5a5e63', x - 12 + k * 4, y, 2, 4); R(c, '#2a1810', x - 14, y + 8, 28, 14); for (let k = 0; k < 3; k++) R(c, '#c9a24a', x - 12, y + 10 + k * 4, 24, 1); glow(c, x, y - 12, 44, '#ff8ad8', 0.2); },
    'music-decks': (c, x, y, t) => { R(c, '#00000044', x - 52, y - 16, 108, 36); R(c, '#14161a', x - 56, y - 20, 112, 36); R(c, '#2a2d34', x - 56, y - 20, 112, 3); for (const dx of [-34, 34]) { C(c, '#2a2d34', x + dx, y - 2, 14); C(c, '#0a0b0e', x + dx, y - 2, 12); c.save(); c.translate(x + dx, y - 2); c.rotate(t * 3.5 * Math.sign(dx)); R(c, '#e8e2d0', -1, -11, 2, 4); c.restore(); C(c, '#c0473f', x + dx, y - 2, 3); }
      R(c, '#1d2024', x - 12, y - 16, 24, 28); for (let k = 0; k < 4; k++) { R(c, '#4a505b', x - 9 + k * 6, y - 12, 2, 16); R(c, '#e8e6e0', x - 10 + k * 6, y - 8 + ((k * 5 + Math.floor(t * 4)) % 10), 4, 2); } for (let k = 0; k < 6; k++) R(c, k < 2 + ((t * 8) | 0) % 5 ? '#7cdeb5' : '#2a3a34', x - 10 + k * 4, y + 8, 3, 2);
      for (const sx of [-74, 64]) { R(c, '#00000044', x + sx + 2, y - 30, 14, 52); R(c, '#14161a', x + sx, y - 34, 14, 52); C(c, '#2a2d34', x + sx + 7, y - 22, 5); C(c, '#2a2d34', x + sx + 7, y + 4, 6 + Math.sin(t * 12) * 0.6); C(c, '#0a0b0e', x + sx + 7, y + 4, 3); } glow(c, x, y, 70, '#7cdeb5', 0.12); },
    'music-piano': (c, x, y) => { O(c, '#00000044', x + 4, y + 6, 46, 40); c.fillStyle = '#0a0b0e'; c.beginPath(); c.moveTo(x - 40, y + 30); c.lineTo(x - 40, y - 30); c.quadraticCurveTo(x - 40, y - 50, x - 10, y - 46); c.quadraticCurveTo(x + 20, y - 40, x + 30, y - 10); c.quadraticCurveTo(x + 44, y + 20, x + 40, y + 30); c.closePath(); c.fill();
      c.fillStyle = '#1d2024'; c.beginPath(); c.moveTo(x - 36, y + 24); c.lineTo(x - 36, y - 26); c.quadraticCurveTo(x - 34, y - 42, x - 10, y - 40); c.quadraticCurveTo(x + 14, y - 34, x + 24, y - 8); c.quadraticCurveTo(x + 36, y + 16, x + 34, y + 24); c.closePath(); c.fill(); c.strokeStyle = '#c9a24a'; c.lineWidth = 1; for (let k = 0; k < 8; k++) { c.beginPath(); c.moveTo(x - 30 + k * 7, y + 22); c.lineTo(x - 30 + k * 5, y - 30 + k * 2); c.stroke(); }
      R(c, '#f2efe8', x - 40, y + 30, 80, 10); for (let k = 0; k < 13; k++) R(c, '#1d2024', x - 38 + k * 6, y + 30, 1, 10); for (let k = 0; k < 12; k++) if (k % 7 !== 2 && k % 7 !== 6) R(c, '#0a0b0e', x - 36 + k * 6, y + 30, 3, 6); R(c, '#0a0b0e', x - 22, y + 46, 44, 10); R(c, '#2a2d34', x - 22, y + 46, 44, 2); },
    // --- beds
    'bed-mattress': (c, x, y) => { O(c, '#00000033', x, y + 52, 70, 10); R(c, '#c9c3b7', x - 60, y - 50, 120, 100); R(c, '#9aa3ab', x - 58, y - 10, 116, 58); for (let k = 0; k < 6; k++) R(c, '#8a929a', x - 58, y - 4 + k * 9, 116, 1); c.fillStyle = '#7d8790'; c.beginPath(); c.moveTo(x - 58, y - 10); c.quadraticCurveTo(x, y - 20, x + 58, y - 4); c.lineTo(x + 58, y + 10); c.lineTo(x - 58, y + 6); c.fill(); RR(c, '#e8e6e0', x - 40, y - 44, 40, 22, 6); R(c, '#2b2f36', x + 66, y + 30, 14, 18); R(c, '#e8e2d0', x + 69, y + 32, 8, 6); },
    'bed-king': (c, x, y) => { O(c, '#00000033', x, y + 60, 94, 12); R(c, '#4a301c', x - 86, y - 70, 172, 18); R(c, '#7a5532', x - 86, y - 70, 172, 4); for (let k = 0; k < 6; k++) R(c, '#5a3b22', x - 80 + k * 28, y - 66, 20, 12); R(c, '#e8e6e0', x - 80, y - 54, 160, 118); RR(c, '#f7f6f2', x - 70, y - 50, 60, 24, 6); RR(c, '#f7f6f2', x + 10, y - 50, 60, 24, 6);
      R(c, '#1f2f5a', x - 80, y - 12, 160, 76); R(c, '#2a3f72', x - 80, y - 12, 160, 10); for (let k = 0; k < 5; k++) R(c, '#26386a', x - 80, y + 4 + k * 12, 160, 1); R(c, '#c9a24a', x - 80, y + 50, 160, 4);
      for (const nx of [-112, 92]) { R(c, '#00000033', nx + x + 2, y - 52, 22, 26); R(c, '#5a3b22', x + nx, y - 56, 22, 26); R(c, '#7a5532', x + nx, y - 56, 22, 3); C(c, '#e8d8a8', x + nx + 11, y - 46, 7); C(c, '#fff3c4', x + nx + 11, y - 46, 4); } },
    'bed-round': (c, x, y, t) => { O(c, '#00000033', x + 3, y + 8, 84, 74); C(c, '#c9a24a', x, y, 80); C(c, '#4a1d5a', x, y, 76); C(c, '#6a2a7a', x - 4, y - 6, 66); for (let k = 0; k < 10; k++) { c.strokeStyle = '#8a3a9a55'; c.beginPath(); c.arc(x, y, 20 + k * 5, 0.3, 2.6); c.stroke(); }
      for (const [hx, hy, col] of [[-22, -42, '#e86a8a'], [22, -42, '#e86a8a'], [0, -50, '#f2efe8']]) { c.fillStyle = col; c.beginPath(); c.moveTo(x + hx, y + hy + 10); c.bezierCurveTo(x + hx - 16, y + hy, x + hx - 8, y + hy - 10, x + hx, y + hy - 2); c.bezierCurveTo(x + hx + 8, y + hy - 10, x + hx + 16, y + hy, x + hx, y + hy + 10); c.fill(); }
      c.fillStyle = '#e86a8a55'; c.beginPath(); c.moveTo(x - 60, y + 30); c.quadraticCurveTo(x, y + 10, x + 62, y + 34); c.lineTo(x + 50, y + 54); c.quadraticCurveTo(x, y + 40, x - 50, y + 52); c.fill(); glow(c, x, y, 110, '#b06ad8', 0.12); },
    // --- lighting
    'lamp-none': () => {},
    'lamp-floor': (c, x, y) => { O(c, '#00000033', x, y + 4, 9, 3); C(c, '#2b2f36', x, y, 7); c.strokeStyle = '#c9d1d6'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 4, y - 46, x - 34, y - 44); c.stroke(); O(c, '#e8e2d0', x - 36, y - 42, 9, 6); O(c, '#fff3c4', x - 36, y - 40, 6, 3); glow(c, x - 36, y - 30, 50, '#ffd27a', 0.22); },
    'lamp-lava': (c, x, y, t) => { R(c, '#00000033', x - 20, y - 4, 44, 14); R(c, '#5a3b22', x - 22, y - 8, 44, 14); R(c, '#7a5532', x - 22, y - 8, 44, 2); for (const [dx, col] of [[-10, '#ff4ad8'], [10, '#ffb33a']]) { R(c, '#c9d1d6', x + dx - 5, y - 10, 10, 4); c.fillStyle = '#1a1430cc'; c.beginPath(); c.moveTo(x + dx - 4, y - 10); c.lineTo(x + dx - 6, y - 32); c.lineTo(x + dx + 6, y - 32); c.lineTo(x + dx + 4, y - 10); c.fill(); for (let k = 0; k < 3; k++) O(c, col, x + dx + Math.sin(t + k) * 1.5, y - 14 - ((t * 6 + k * 7) % 16), 2.4, 3); R(c, '#c9d1d6', x + dx - 3, y - 36, 6, 4); glow(c, x + dx, y - 22, 26, col, 0.3); } },
    'lamp-flamingo': (c, x, y, t) => { const f = Math.sin(t * 5) > -0.95 ? 1 : 0.4; c.save(); c.strokeStyle = f > 0.5 ? '#ff7ad8' : '#7a3a6a'; c.shadowColor = '#ff4ad8'; c.shadowBlur = 10 * f; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 6, y - 20); c.quadraticCurveTo(x - 20, y - 30, x - 8, y - 42); c.quadraticCurveTo(x + 4, y - 50, x - 2, y - 58); c.stroke(); c.beginPath(); c.ellipse(x + 4, y - 18, 12, 7, -0.3, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(x + 2, y - 11); c.lineTo(x + 2, y + 4); c.moveTo(x + 6, y - 11); c.lineTo(x + 8, y - 2); c.lineTo(x + 4, y + 4); c.stroke(); c.beginPath(); c.moveTo(x - 2, y - 58); c.lineTo(x + 6, y - 56); c.stroke(); c.restore(); glow(c, x, y - 26, 60, '#ff4ad8', 0.25 * f); },
    // --- pet beds
    'pet-none': (c, x, y) => { R(c, '#8a9aaa', x - 18, y - 10, 36, 20); for (let k = 0; k < 4; k++) R(c, '#c0473f', x - 18, y - 8 + k * 5, 36, 1); },
    'pet-cushion': (c, x, y) => { O(c, '#00000033', x + 2, y + 4, 24, 14); O(c, '#3d7fd0', x, y, 24, 14); O(c, '#5a9ae0', x, y - 2, 18, 9); for (const [bx, by] of [[-8, -2], [6, 3], [0, -5]]) { R(c, '#f2efe8', x + bx - 3, y + by, 6, 1.5); C(c, '#f2efe8', x + bx - 3, y + by, 1.3); C(c, '#f2efe8', x + bx + 3, y + by + 1, 1.3); } },
    'pet-palace': (c, x, y) => { R(c, '#00000033', x - 26, y - 14, 56, 34); R(c, '#e8e2d0', x - 28, y - 18, 56, 34); c.fillStyle = '#c0473f'; c.beginPath(); c.moveTo(x - 32, y - 18); c.lineTo(x, y - 40); c.lineTo(x + 32, y - 18); c.fill(); c.fillStyle = '#a0342e'; c.beginPath(); c.moveTo(x, y - 40); c.lineTo(x + 32, y - 18); c.lineTo(x + 26, y - 18); c.fill(); RR(c, '#2a1d14', x - 11, y - 10, 22, 26, 10); O(c, '#5a9ae0', x, y + 12, 9, 3); R(c, '#c9a24a', x - 10, y - 24, 20, 6); C(c, '#e8c86a', x, y - 42, 2.5); },
    // --- garage wall + lift
    'gwall-bare': () => {},
    'gwall-peg': (c, x, y) => { R(c, '#a88a5a', x - 80, y - 14, 160, 22); for (let i = 0; i < 40; i++) C(c, '#7a6040', x - 76 + (i % 20) * 8, y - 10 + Math.floor(i / 20) * 10, 0.8); for (const [tx, col, w, h] of [[-66, '#c9d1d6', 3, 16], [-56, '#c0473f', 4, 12], [-40, '#c9d1d6', 2, 14], [-24, '#e8b923', 8, 6], [-6, '#2b2f36', 12, 4], [14, '#c9d1d6', 3, 15], [30, '#3d7fd0', 5, 12], [50, '#c0473f', 10, 8], [68, '#c9d1d6', 2, 12]]) R(c, col, x + tx, y - 10, w, h); },
    'gwall-tires': (c, x, y, t) => { R(c, '#1a1c22', x - 160, y - 16, 320, 24); for (let k = 0; k < 9; k++) { const tx = x - 140 + k * 35; C(c, '#0a0b0e', tx, y - 4, 13); C(c, '#2a2d34', tx, y - 4, 9); C(c, '#c9d1d6', tx, y - 4, 6); for (let s = 0; s < 5; s++) { const a = s * 1.256 + k; R(c, '#5a5e63', tx + Math.cos(a) * 4 - 1, y - 4 + Math.sin(a) * 4 - 1, 2, 2); } C(c, '#2a2d34', tx, y - 4, 2); }
      R(c, '#4ae0ff', x - 160, y - 18, 320, 2); R(c, '#ff4ad8', x - 160, y + 8, 320, 2); glow(c, x - 80, y, 90, '#4ae0ff', 0.12); glow(c, x + 80, y, 90, '#ff4ad8', 0.12); },
    'gwall-trophy': (c, x, y, t) => { for (const sy of [-12, 2]) { R(c, '#5a3b22', x - 160, y + sy + 8, 320, 3); } const medals = Object.keys(root.NightshiftRaces?.state?.medals || {}).length; for (let k = 0; k < 12; k++) { const tx = x - 150 + k * 27, ty = k % 2 ? y + 4 : y - 10, gold = k < Math.max(4, medals + 2); R(c, gold ? '#c9a24a' : '#9aa3ab', tx - 3, ty + 2, 6, 4); R(c, gold ? '#e8c86a' : '#cfd6db', tx - 1, ty - 4, 2, 6); O(c, gold ? '#e8c86a' : '#cfd6db', tx, ty - 6, 5, 4); R(c, '#ffffff66', tx - 3, ty - 8, 2, 2); }
      for (let k = 0; k < 8; k++) R(c, k % 2 ? '#f2efe8' : '#111', x + 100 + (k % 4) * 6, y - 14 + Math.floor(k / 4) * 6, 6, 6); O(c, '#c0473f', x - 172, y - 4, 9, 8); R(c, '#111', x - 178, y - 6, 12, 4); R(c, '#9fc3d6', x - 176, y - 6, 8, 2); glow(c, x, y - 4, 140, '#ffd27a', 0.1); },
    'lift-none': (c, x, y) => { for (let k = 0; k < 8; k++) { R(c, k % 2 ? '#e8b923' : '#1b1b1b', x - 36 + k * 9, y - 64, 9, 3); R(c, k % 2 ? '#1b1b1b' : '#e8b923', x - 36 + k * 9, y + 62, 9, 3); } },
    'lift-post': (c, x, y) => { for (const lx of [-42, 34]) { R(c, '#00000044', x + lx + 3, y - 50, 10, 100); R(c, '#d8a21c', x + lx, y - 54, 8, 100); R(c, '#f3c84a', x + lx, y - 54, 2, 100); R(c, '#8a6510', x + lx + 6, y - 54, 2, 100); R(c, '#c0473f', x + lx + 1, y - 20, 6, 4); } R(c, '#3a3f45', x - 42, y - 58, 84, 6); R(c, '#6f7880', x - 30, y - 30, 22, 3); R(c, '#6f7880', x + 8, y - 30, 22, 3); R(c, '#6f7880', x - 30, y + 26, 22, 3); R(c, '#6f7880', x + 8, y + 26, 22, 3); R(c, '#2b2f36', x + 46, y + 30, 14, 20); C(c, '#7cdeb5', x + 53, y + 36, 2); },
  };
  // footprint of each slot for collisions (only when something stands there)
  const FOOT = { sofa: [-100, -24, 200, 50], bar: [-110, -14, 220, 38], game: [-76, -40, 152, 82], music: [-44, -36, 88, 80], bed: [-86, -60, 172, 126], aquarium: [-22, -76, 44, 152], plant: [-10, -10, 20, 18] };
  const EMPTY = new Set(['game-none', 'music-none', 'aqua-none', 'plant-none']);
  function dynamicSolids() {
    const out = [];
    for (const [slot, f] of Object.entries(FOOT)) { const id = placed(slot); if (EMPTY.has(id)) continue; const s = D.SLOT[slot]; out.push({ x: s.x + f[0], y: s.y + f[1], w: f[2], h: f[3] }); }
    { const s = D.SLOT.sofa; out.push({ x: s.x - 50, y: s.y - 80, w: 100, h: 40 }); } // coffee table
    for (const [i] of garageCars().entries()) out.push({ x: BAYS[i] - 18, y: 600, w: 36, h: 80 });
    out.push({ x: 756, y: 162, w: 170, h: 52 }, { x: W - T - 50, y: 56, w: 50, h: 306 }, { x: 26, y: 446, w: 120, h: 40 }, { x: 486, y: 556, w: 40, h: 120 });
    return out;
  }

  // ---------------- garage cars ----------------
  const modelOf = (car) => car?.model || root.NightshiftVehicles?.model?.(car)?.name || 'SEDAN';
  function garageCars() { return CARS().filter((c) => c && c.owned).slice(0, 4); }
  function drawCar(c, car, x, y, t) {
    const S = root.NightshiftSprites; if (!S?.car) return;
    const v = { x, y, angle: -Math.PI / 2, color: car.color, speed: 0, model: modelOf(car), condition: car.condition ?? 100, id: car.id, fuel: car.fuel };
    O(c, '#00000055', x, y + 4, 22, 36);
    try { S.car(v); } catch { /* sprite optional */ }
    // reflection sheen on the mirror floor
    if (placed('gfloor') === 'gfloor-mirror') { c.save(); c.globalAlpha = 0.18; c.translate(x, y + 74); c.scale(1, -0.4); try { S.car({ ...v, x: 0, y: 0 }); } catch { /* optional */ } c.restore(); }
  }

  // ---------------- pets ----------------
  const ROAM = [[200, 230], [450, 200], [140, 330], [520, 330], [780, 300], [1000, 200], [120, 620], [300, 720], [400, 640], [90, 740]];
  const roamers = {}; let lastT = performance.now();
  function petProps() {
    const PT = root.NightshiftPets; if (!PT?.drawPet) return [];
    const now = performance.now(), dt = Math.min(2, (now - lastT) / 16.67); lastT = now;
    const out = [];
    for (const q of PT.state.pets) {
      if (q.id === PT.state.active) continue; // the active pet follows you (zones companion)
      const o = roamers[q.id] || (roamers[q.id] = PT.roamer(q.id, ...ROAM[(Math.random() * ROAM.length) | 0]));
      const pts = placed('petbed') !== 'pet-none' ? ROAM.concat([[90, 768], [90, 768]]) : ROAM;
      PT.roam(o, dt, now, pts); out.push({ y: o.y, draw: (c, t) => PT.drawPet(c, t, q.id, o) });
    }
    return out;
  }

  // ---------------- zone ----------------
  const def = Z.register({
    id: 'dreamhome', name: 'Your Dream House', tagline: '1 PRESTIGE ROW · PALM GROVE', w: W, h: H, bg: '#05070d', zoom: 1.05, indoor: true,
    get dark() { return nightish() ? 0.42 : 0.06; },
    spawn: { x: 70, y: 210, angle: 0 }, solids: [...WALLS, GARAGE_DOOR],
    dynamicSolids,
    ground,
    drawGround(c, t) {
      windows(c, t);
      (FLOOR[placed('gfloor')] || FLOOR['gfloor-concrete'])(c, t);
      // bay lines
      for (const bx of BAYS) { R(c, '#e8e6e055', bx - 34, 570, 2, 130); R(c, '#e8e6e055', bx + 34, 570, 2, 130); }
      // garage roll-up door (inside view)
      R(c, '#9aa3ab', 560, H - T - 8, 540, 8); for (let k = 0; k < 540; k += 6) R(c, '#7d8796', 560 + k, H - T - 8, 1, 8);
      const rug = RUG[placed('rug')]; if (rug) rug(c, D.SLOT.rug.x, D.SLOT.rug.y);
      // wall pieces (drawn as ground so they sit on the wall face)
      for (const slot of ['tv', 'art', 'gwall']) { const s = D.SLOT[slot]; ITEMART[placed(slot)]?.(c, s.x, s.y, t); }
      // house computer by the door
      R(c, '#1d2024', 96, 104, 30, 22); R(c, '#2a3a4a', 98, 106, 26, 16); R(c, '#7cdeb5', 100, 108, (t * 10) % 22, 2); R(c, '#e8c86a', 100, 113, 16, 2); R(c, '#9aa3ab', 108, 126, 6, 10);
      // "decorate me" sparkles on default pieces near you
      const pos = Z.api.pos; if (pos) for (const s of D.SLOTS) { if (D.ITEM[placed(s.id)].price > 0 || Math.hypot(pos.x - s.x, pos.y - s.y) > 260) continue; const a = 0.4 + 0.4 * Math.sin(t * 3 + s.x); c.save(); c.globalAlpha = a; c.fillStyle = '#ffe9a8'; c.font = 'bold 10px system-ui'; c.textAlign = 'center'; c.fillText('✦', s.x + 18, s.y - 16); c.restore(); }
    },
    props(api, view) {
      const out = [];
      for (const s of D.SLOTS) { if (s.flat || ['tv', 'art', 'gwall'].includes(s.id)) continue; const id = placed(s.id), art = ITEMART[id]; if (!art) continue; const yy = s.id === 'aquarium' ? s.y + 60 : s.id === 'bar' ? s.y + 10 : s.id === 'lamp' && id === 'lamp-flamingo' ? 440 : s.y + 10; out.push({ y: yy, draw: (c, t) => art(c, s.x, s.y, t) }); }
      garageCars().forEach((car, i) => out.push({ y: 680, draw: (c, t) => drawCar(c, car, BAYS[i], 640, t) }));
      out.push(...petProps());
      return out;
    },
    lights() {
      const L = [{ x: 330, y: 200, r: 260, a: 0.75 }, { x: 920, y: 200, r: 260, a: 0.75 }, { x: 240, y: 620, r: 200, a: 0.6 }, { x: 830, y: 620, r: 300, a: 0.7 }];
      const p = (slot, id) => placed(slot) === id;
      if (p('tv', 'tv-cinema') || p('tv', 'tv-flat')) L.push({ x: 330, y: 80, r: 140, a: 0.6 });
      if (!p('aquarium', 'aqua-none')) L.push({ x: 610, y: 96, r: 90, a: 0.7 });
      if (!p('lamp', 'lamp-none')) L.push({ x: 380, y: 470, r: 120, a: 0.8 });
      if (p('bar', 'bar-gold') || p('bar', 'bar-home')) L.push({ x: 930, y: 40, r: 150, a: 0.7 });
      if (p('gwall', 'gwall-tires') || p('gwall', 'gwall-trophy')) L.push({ x: 830, y: 470, r: 180, a: 0.6 });
      return L;
    },
    targets(api) {
      const out = [{ x: 111, y: 150, r: 46, action: 'STYLE', label: `House computer · Style ${D.style(state)} · ${D.tier(state).name}`, sign: `STYLE · ${D.tier(state).name.toUpperCase()}`, icon: '🏡', color: '#7cdeb5', lift: 60, use: () => openStyle() }];
      for (const s of D.SLOTS) {
        const it = D.ITEM[placed(s.id)], ty = s.id === 'tv' || s.id === 'art' || s.id === 'gwall' ? s.y + 54 : s.id === 'bar' ? s.y + 56 : s.id === 'gfloor' ? s.y - 40 : s.id === 'sofa' ? s.y + 34 : s.id === 'bed' ? s.y + 74 : s.id === 'aquarium' ? s.y + 92 : s.y + 30;
        const tx = s.id === 'aquarium' ? s.x - 40 : s.x;
        out.push({ x: tx, y: ty, r: 44, action: s.id === 'bed' ? 'BED' : 'DECOR', label: `${s.name} · ${it.name}`, use: () => openSlot(s.id) });
      }
      out.push({ x: 830, y: 740, r: 50, action: 'GARAGE', label: 'Your garage · show-off score', use: () => openGarage() });
      return out;
    },
    exits: [{ x: 36, y: 210, r: 40, action: 'OUTSIDE', label: 'Front door · back to Palm Grove', sign: 'FRONT DOOR', icon: '🚪', color: '#ffd970', lift: 40, use: () => Z.enter('suburbs', { x: 1615, y: 1080, angle: -Math.PI / 2 }) }],
    onEnter() { if (!state.seen) { state.seen = true; setTimeout(() => say('🏡 Walk up to anything and press DECOR to change it. The house computer by the door shows everything.'), 900); } },
  });
  void def;

  // ---------------- panels ----------------
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const pnl = el('div', { id: 'dhPanel', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Decor' }); document.body.append(pnl);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pnl.hidden) { pnl.hidden = true; e.stopImmediatePropagation(); } }, true);
  const btn = (cls, txt, fn, dis) => { const x = el('button', { className: cls, type: 'button', disabled: !!dis }, txt); x.onclick = fn; return x; };
  function head(title, sub) { try { root.releaseControls?.(); } catch { /* n/a */ } pnl.hidden = false; pnl.textContent = ''; const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { pnl.hidden = true; }; top.append(el('h2', {}, title), x); pnl.append(top); if (sub) pnl.append(el('div', { className: 'sub' }, sub)); }
  // tiny live preview of an item
  function preview(id) {
    const it = D.ITEM[id], s = D.SLOT[it.slot], cv = el('canvas', { width: 160, height: 100 }); cv.style.cssText = 'width:80px;height:50px;border-radius:10px;background:#1b1e26;flex:none;image-rendering:pixelated';
    try { const c = cv.getContext('2d'); const scale = ['bed', 'game', 'sofa', 'bar', 'gwall'].includes(it.slot) ? 0.55 : it.slot === 'aquarium' ? 0.55 : it.slot === 'rug' ? 0.32 : it.slot === 'gfloor' ? 1 : 0.9; c.translate(80, 52); c.scale(scale * 2 / 2, scale * 2 / 2);
      if (it.slot === 'gfloor') { c.setTransform(1, 0, 0, 1, 0, 0); c.save(); c.translate(-560, -560); FLOOR[id]?.(c, 0); c.restore(); }
      else if (it.slot === 'rug') RUG[id]?.(c, 0, 0) || 0;
      else ITEMART[id]?.(c, 0, it.slot === 'sofa' ? 30 : it.slot === 'lamp' ? 26 : 0, 1); } catch { /* preview optional */ }
    return cv;
  }
  function openSlot(slotId) {
    const s = D.SLOT[slotId], p = P(), cur = placed(slotId);
    head(`${s.room.toUpperCase()} · ${s.name.toUpperCase()}`, `Buy once, swap any time for free. Style ${D.style(state)} · ${D.tier(state).name} · cash ${money(p?.cash || 0)}`);
    if (slotId === 'bed') {
      const left = Math.max(0, D.SLEEP_COOLDOWN - (Date.now() - state.sleptAt));
      pnl.append(el('div', { style: 'display:flex;align-items:center;gap:10px;padding:10px;border-radius:14px;background:linear-gradient(90deg,#7c6ad822,#ffffff05);border:1px solid #7c6ad855;margin:6px 0' }, ''));
      const r = pnl.lastChild; r.append(el('div', { style: 'font-size:26px' }, '😴')); const tt = el('div', { style: 'flex:1' }); tt.append(el('b', { style: 'font:800 13px var(--disp,system-ui)' }, 'SLEEP'), el('div', { style: 'color:#a9b8ca;font-size:11px' }, `Full health and a "Well rested" XP boost for 10 min. Nicer beds give a bigger boost.${left ? ` · ready in ${Math.ceil(left / 60000)} min` : ''}`)); r.append(tt, btn('go', 'SLEEP', () => {
        const res = D.sleep(state); if (!res.ok) { say(res.reason); return; } const pl = P(); if (pl) pl.hp = Math.max(pl.hp, 100); try { root.NightshiftSkills?.setBoost?.(res.boost, res.minutes * 60000, 'Well rested'); } catch { /* optional */ } try { if (root.NightshiftEnvironment?.state) root.NightshiftEnvironment.state.minute = (root.NightshiftEnvironment.state.minute + 8 * 60) % 1440; } catch { /* optional */ } persist(); gameSave(); pnl.hidden = true; say(`😴 Slept like a king · full health · +${Math.round((res.boost - 1) * 100)}% XP for ${res.minutes} min`);
      }, !!left));
    }
    for (const it of D.ITEMS.filter((i) => i.slot === slotId)) {
      const has = D.owns(state, it.id), on = cur === it.id;
      const r = el('div', { style: `display:flex;align-items:center;gap:10px;padding:8px;border-radius:14px;background:${on ? '#7cdeb514' : '#ffffff07'};border:1px solid ${on ? '#7cdeb566' : '#ffffff12'};margin-bottom:6px` });
      r.append(preview(it.id));
      const tt = el('div', { style: 'flex:1' }); tt.append(el('b', { style: 'font:800 13px var(--disp,system-ui)' }, it.name), el('div', { style: 'color:#a9b8ca;font-size:11px' }, `${it.style ? '✦ +' + it.style + ' style' : 'Basic'}${it.loot ? ' · needs a stolen painting from a break-in' : ''}`)); r.append(tt);
      if (on) r.append(el('span', { className: 'okc' }, 'PLACED'));
      else r.append(btn(has ? 'alt' : 'go', has ? 'PLACE' : it.price ? money(it.price) : 'FREE', () => {
        const bag = { has: (c) => { const b = root.NightshiftSupply?.state?.bag || {}; return Object.entries(c).every(([k, n]) => (b[k] || 0) >= n); }, take: (c) => root.NightshiftSupply?.take?.(c) };
        const before = D.tier(state).index, res = D.place(state, P(), it.id, bag); if (!res.ok) { say(res.reason); return; }
        persist(); gameSave(); const after = D.tier(state);
        say(after.index > before ? `🏡 Your place is now ${after.name.toUpperCase()}! Clients pay +${Math.round(after.index * D.PER_TIER * 100)}% when you deal` : `✦ ${it.name} ${res.bought ? 'bought and ' : ''}placed`);
        try { if (res.bought) root.NightshiftSkills?.gain('charisma', Math.max(5, Math.round(it.style * 3)), 'decor'); } catch { /* optional */ }
        openSlot(slotId);
      }, !has && ((p?.cash || 0) < it.price)));
      pnl.append(r);
    }
  }
  function openStyle() {
    const tr = D.tier(state), p = P();
    head('🏡 HOUSE COMPUTER', `Style ${tr.style} · ${tr.name}${tr.next ? ` · ${tr.next.at - tr.style} more for ${tr.next.name}` : ' · maxed out'} · deals pay +${Math.round(tr.index * D.PER_TIER * 100)}%`);
    const bar = el('div', { style: 'height:10px;border-radius:99px;background:#ffffff10;overflow:hidden;margin:6px 0 10px' }); bar.append(el('div', { style: `height:100%;width:${Math.min(100, tr.next ? ((tr.style - D.TIERS[tr.index].at) / (tr.next.at - D.TIERS[tr.index].at)) * 100 : 100)}%;background:linear-gradient(90deg,#7cdeb5,#e8c86a)` })); pnl.append(bar);
    let room = '';
    for (const s of D.SLOTS) {
      if (s.room !== room) { room = s.room; pnl.append(el('h3', {}, room.toUpperCase())); }
      const it = D.ITEM[placed(s.id)], n = D.ITEMS.filter((i) => i.slot === s.id).length, have = D.ITEMS.filter((i) => i.slot === s.id && D.owns(state, i.id)).length;
      const r = el('div', { style: 'display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:12px;background:#ffffff07;border:1px solid #ffffff10;margin-bottom:5px' });
      r.append(preview(it.id)); const tt = el('div', { style: 'flex:1' }); tt.append(el('b', { style: 'font:700 12px var(--disp,system-ui)' }, `${s.name} · ${it.name}`), el('div', { style: 'color:#a9b8ca;font-size:11px' }, `${have}/${n} owned · ✦ ${it.style}`)); r.append(tt, btn('alt', 'CHANGE', () => openSlot(s.id))); pnl.append(r);
    }
    void p;
  }
  function openGarage() {
    const list = garageCars(), kits = root.NightshiftPets?.state?.kits || {}, KD = root.NightshiftPetsData?.KIT || {};
    const score = D.garageScore(state, list.map((c) => ({ id: c.id, model: modelOf(c), condition: c.condition })), kits);
    head('🏎️ YOUR GARAGE', `Show-off score ${score} · up to four of your cars park here. Kits from Prestige Motors and a fancy floor push the score up.`);
    if (!list.length) pnl.append(el('div', { className: 'sub' }, 'No cars yet. Buy one in the city, or steal one and re-VIN it at Rusty\'s chop shop.'));
    for (const c of list) pnl.append(el('div', { className: 'sub', style: 'padding:8px;border-radius:12px;background:#ffffff07;margin-bottom:5px' }, `🚗 ${modelOf(c)} · ${c.id} · body ${Math.round(c.condition ?? 100)}%${kits[c.id] ? ' · ' + (KD[kits[c.id]]?.name || kits[c.id]) : ' · stock'}`));
    pnl.append(el('div', { className: 'sub', style: 'margin-top:8px' }, 'Garage decor: floor, wall and lift slots — walk up to them and press DECOR.'));
  }

  root.NightshiftDreamHome = Object.freeze({ get state() { return state; }, openStyle, openSlot, openGarage });
})(typeof globalThis !== 'undefined' ? globalThis : this);
