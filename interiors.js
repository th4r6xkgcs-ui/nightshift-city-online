/* Walk-in interiors for every building in the city (Claude-owned). Uses the zone engine (zones.js).
 * Each building type has its own room — 2.5D furniture (top + front faces, shading, outlines), staff behind counters,
 * customers sitting or browsing, and things to DO that open the real systems:
 *   CORNER SHOP (shop counter), DINER (order food, patrons in booths), CLOTHING (boutique try-on studio),
 *   GARAGE (tuning + style studio for your car out front), BANK (teller = investments; the vault = heist planning
 *   where a heist bank exists), CLUB (bar, dance floor; the venue's own panel where one exists), WAREHOUSE (search
 *   crates for crafting materials — refills over time), APARTMENTS (lobby with mailboxes: sometimes something useful).
 * A 🚪 ENTER point sits at every building door (your own apartment keeps its HOME door).
 * Save: nightshift-interiors-v1 (crate / mailbox refill timers). API: NightshiftInteriors2.{enter, doors, TYPES} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const KEY = 'nightshift-interiors-v1';
  let state = { crates: {}, mail: {} };
  try { const r = JSON.parse(localStorage.getItem(KEY) || '{}'); if (r && typeof r === 'object') state = { crates: r.crates || {}, mail: r.mail || {} }; } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const B = () => { try { return buildings; } catch { return []; } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const W = 560, H = 400, DOOR = { x: W / 2, y: H - 14 };

  // ---------------- 2.5D furniture painter ----------------
  const shade = (h, t) => { const n = parseInt(h.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t))); return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join(''); };
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  // block: top face (x,y,w,d) + front face (height h), lit from the top-left
  function block(c, x, y, w, d, h, col, opt = {}) {
    R(c, '#00000055', x + 3, y + d + h - 2, w, 6); // floor shadow
    R(c, '#0b0d14', x - 1, y - 1, w + 2, d + h + 2); // outline
    R(c, shade(col, 0.12), x, y, w, d); R(c, shade(col, 0.32), x, y, w, 1); R(c, shade(col, 0.2), x, y, 1, d); // top
    R(c, shade(col, -0.22), x, y + d, w, h); R(c, shade(col, -0.36), x, y + d + h - 2, w, 2); R(c, shade(col, -0.05), x, y + d, w, 1); // front
    if (opt.panels) for (let i = 1; i < opt.panels; i++) R(c, shade(col, -0.35), x + (w * i) / opt.panels, y + d + 2, 1, h - 4);
  }
  function floor(c, kind) {
    const base = { tile: '#d9d6c8', wood: '#7a5a3c', concrete: '#6f747a', carpet: '#5a2f3c', marble: '#cfd2d6', lobby: '#8a7a64', club: '#1a1626' }[kind];
    R(c, base, 0, 0, W, H);
    if (kind === 'tile') for (let x = 0; x < W; x += 20) for (let y = 0; y < H; y += 20) R(c, ((x + y) / 20) % 2 ? '#cfcbbb' : '#e4e1d4', x, y, 20, 20);
    if (kind === 'wood' || kind === 'lobby') for (let y = 0; y < H; y += 12) { R(c, shade(base, -0.15), 0, y, W, 1); for (let x = (y / 12 % 2) * 40; x < W; x += 80) R(c, shade(base, -0.2), x, y, 1, 12); }
    if (kind === 'concrete') { for (let i = 0; i < 300; i++) R(c, i % 2 ? '#666b71' : '#787d83', (i * 97) % W, (i * 53) % H, 2, 2); for (let x = 0; x < W; x += 140) R(c, '#5d6268', x, 0, 1, H); R(c, '#e2c24a', 60, H - 70, W - 120, 3); }
    if (kind === 'carpet') for (let x = 0; x < W; x += 8) for (let y = 0; y < H; y += 8) if ((x + y) % 16 === 0) R(c, '#64343f', x, y, 4, 4);
    if (kind === 'marble') for (let x = 0; x < W; x += 40) for (let y = 0; y < H; y += 40) { R(c, ((x + y) / 40) % 2 ? '#c4c8cd' : '#dadde1', x, y, 40, 40); R(c, '#b8bcc2', x, y, 40, 1); }
    if (kind === 'club') for (let x = 0; x < W; x += 24) for (let y = 0; y < H; y += 24) R(c, ((x + y) / 24) % 2 ? '#201a30' : '#171322', x, y, 24, 24);
  }
  function walls(c, col, trim) {
    R(c, '#0b0d14', 0, 0, W, 64); R(c, col, 0, 0, W, 60); R(c, shade(col, 0.12), 0, 0, W, 8); R(c, shade(col, -0.25), 0, 52, W, 8); R(c, trim, 0, 58, W, 4); // back wall + baseboard
    R(c, '#0b0d14', 0, 0, 10, H); R(c, shade(col, -0.35), 0, 0, 8, H); R(c, '#0b0d14', W - 10, 0, 10, H); R(c, shade(col, -0.35), W - 8, 0, 8, H); // side walls
    R(c, '#0b0d14', 0, H - 8, W, 8); R(c, shade(col, -0.4), 0, H - 8, W / 2 - 34, 8); R(c, shade(col, -0.4), W / 2 + 34, H - 8, W / 2 - 34, 8); // front wall with the door gap
    R(c, '#2a3a2a', W / 2 - 30, H - 24, 60, 16); R(c, '#3c4c3a', W / 2 - 28, H - 22, 56, 12); // door mat
  }
  const windowPane = (c, x, y, w, h) => { R(c, '#0b0d14', x - 1, y - 1, w + 2, h + 2); R(c, '#2a4a62', x, y, w, h); R(c, '#4f7a96', x, y, w, 3); R(c, '#ffffff33', x + 3, y + 3, 4, h - 6); };
  const sign = (c, txt, x, y, col = '#ffd970') => { c.font = 'bold 13px monospace'; c.textAlign = 'center'; c.fillStyle = '#0b0d14'; c.fillText(txt, x + 1, y + 1); c.fillStyle = col; c.fillText(txt, x, y); };
  const products = (c, x, y, w, rows, seed) => { const cols = ['#e05a4a', '#f2c84a', '#3d99d6', '#7cdeb5', '#ff8ad8', '#f4f1ea', '#8a6430']; for (let r = 0; r < rows; r++) for (let i = 0; i < Math.floor(w / 7); i++) { const k = (i * 7 + r * 3 + seed) % cols.length; R(c, '#0b0d14', x + i * 7 - 1, y + r * 12 - 1, 6, 10); R(c, cols[k], x + i * 7, y + r * 12, 4, 8); R(c, '#ffffff66', x + i * 7, y + r * 12, 1, 8); } };

  // ---------------- room types ----------------
  const solid = (x, y, w, h) => ({ x, y, w, h });
  const T = {
    'CORNER SHOP': { floor: 'tile', wall: '#8a3a3a', trim: '#f2c84a', title: 'CORNER SHOP', art(c) { for (const y of [120, 200]) { block(c, 60, y, 300, 22, 26, '#b9bec4', { panels: 6 }); products(c, 66, y + 3, 288, 2, y); } block(c, 410, 90, 110, 30, 40, '#e8eef3'); for (let i = 0; i < 3; i++) { R(c, '#9fd8f0', 416 + i * 34, 124, 28, 30); products(c, 418 + i * 34, 128, 24, 2, i); } block(c, 380, 280, 140, 30, 30, '#6a4a32', { panels: 3 }); R(c, '#1d2024', 470, 270, 30, 16); R(c, '#7cdeb5', 474, 273, 14, 6); sign(c, 'OPEN 24/7', 280, 34, '#ff6b6b'); },
      solids: [solid(60, 120, 300, 48), solid(60, 200, 300, 48), solid(410, 90, 110, 70), solid(380, 280, 140, 60)], staff: [{ x: 450, y: 262 }],
      targets: (b) => [{ x: 430, y: 352, r: 52, action: 'SHOP', label: 'Counter · food, meds, ammo', use: () => openSafe(() => root.NightshiftRecovery?.openShop?.()) }] },
    DINER: { floor: 'tile', wall: '#3d7f8a', trim: '#e05a4a', title: 'DINER', art(c) { block(c, 40, 80, 300, 26, 34, '#c8432f', { panels: 5 }); R(c, '#e8e2d0', 40, 80, 300, 6); for (let i = 0; i < 6; i++) { R(c, '#0b0d14', 54 + i * 48, 120, 18, 18); R(c, '#c84659', 55 + i * 48, 121, 16, 10); R(c, '#9aa3ab', 61 + i * 48, 131, 4, 8); } for (const [x, y] of [[380, 120], [380, 220], [60, 240], [210, 240]]) { block(c, x, y, 120, 18, 10, '#c84659'); block(c, x + 16, y + 34, 88, 30, 20, '#e8e2d0'); block(c, x, y + 88, 120, 18, 10, '#c84659'); R(c, '#f2c84a', x + 40, y + 40, 10, 6); R(c, '#ffffff', x + 64, y + 42, 8, 5); } sign(c, 'EAT · DRINK · REPEAT', 280, 34, '#ffd970'); windowPane(c, 360, 12, 70, 36); windowPane(c, 450, 12, 70, 36); },
      solids: [solid(40, 80, 300, 60), solid(396, 154, 88, 50), solid(396, 254, 88, 50), solid(76, 274, 88, 50), solid(226, 274, 88, 50)], staff: [{ x: 190, y: 66 }],
      patrons: [{ x: 410, y: 176 }, { x: 470, y: 268 }, { x: 100, y: 326 }, { x: 250, y: 268 }],
      targets: () => [{ x: 190, y: 160, r: 60, action: 'ORDER', label: 'Diner counter · meals with buffs', use: () => openSafe(() => root.NightshiftFood?.openDiner?.()) }] },
    CLOTHING: { floor: 'wood', wall: '#5a3a5a', trim: '#e3c25a', title: 'BOUTIQUE', art(c) { for (const [x, y] of [[50, 110], [50, 220], [300, 110], [300, 220]]) { R(c, '#0b0d14', x, y, 170, 4); R(c, '#c9d1d6', x, y, 170, 2); for (let i = 0; i < 12; i++) { const col = ['#c84659', '#3d7fc6', '#e2b75c', '#2f8f6a', '#1d2024', '#f1efe8'][(i + x) % 6]; R(c, '#0b0d14', x + 6 + i * 13, y + 3, 12, 34); R(c, col, x + 7 + i * 13, y + 4, 10, 32); R(c, shade(col, 0.25), x + 7 + i * 13, y + 4, 2, 32); } R(c, '#2a2f36', x + 4, y, 3, 46); R(c, '#2a2f36', x + 163, y, 3, 46); } block(c, 480, 70, 50, 10, 90, '#cfd8e0'); R(c, '#9fc3d6', 484, 82, 42, 74); R(c, '#ffffff55', 488, 86, 6, 66); block(c, 220, 320, 120, 24, 26, '#2a1f1a', { panels: 2 }); sign(c, 'NEW SEASON', 280, 34, '#ff8ad8'); },
      solids: [solid(50, 110, 170, 46), solid(50, 220, 170, 46), solid(300, 110, 170, 46), solid(300, 220, 170, 46), solid(480, 70, 50, 100), solid(220, 320, 120, 50)], staff: [{ x: 280, y: 306 }], browsers: [{ x: 130, y: 182 }, { x: 380, y: 292 }],
      targets: () => [{ x: 280, y: 300, r: 70, action: 'TRY ON', label: 'Boutique · try on & buy', use: () => openSafe(() => root.NightshiftWardrobe?.open?.('store')) }, { x: 505, y: 186, r: 50, action: 'MIRROR', label: 'Mirror · change what you wear', use: () => openSafe(() => root.NightshiftWardrobe?.open?.('home')) }] },
    GARAGE: { floor: 'concrete', wall: '#4a5058', trim: '#e2c24a', title: 'GARAGE', art(c) { R(c, '#2a2f36', 200, 110, 160, 180); R(c, '#e2c24a', 200, 110, 160, 4); R(c, '#e2c24a', 200, 286, 160, 4); for (let i = 0; i < 2; i++) R(c, '#9aa3ab', 210 + i * 130, 120, 10, 160); try { const C = root.NightshiftCars; if (C?.sprite) { const s = C.sprite('SEDAN', '#c84659'); c.save(); c.translate(280, 200); c.rotate(-Math.PI / 2); c.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h); c.restore(); } } catch { /* art optional */ } block(c, 40, 80, 120, 20, 40, '#c84659', { panels: 4 }); for (let i = 0; i < 4; i++) R(c, '#c9d1d6', 50 + i * 28, 104, 16, 2); for (const [x, y] of [[420, 100], [450, 120], [430, 150]]) { R(c, '#0b0d14', x - 1, y - 1, 34, 18); R(c, '#1d2024', x, y, 32, 16); R(c, '#3a3f45', x + 4, y + 4, 24, 8); } block(c, 400, 260, 120, 20, 30, '#5a6168', { panels: 3 }); sign(c, 'NO WORK NO PAY', 280, 34, '#e2c24a'); },
      solids: [solid(40, 80, 120, 60), solid(400, 260, 120, 50), solid(420, 100, 66, 70), solid(212, 130, 136, 140)], staff: [{ x: 380, y: 210 }],
      targets: () => [{ x: 380, y: 236, r: 60, action: 'TUNE', label: 'Mechanic · tune & style your car parked outside', use: () => openSafe(() => root.NightshiftTuning?.open?.()) }, { x: 100, y: 160, r: 50, action: 'TOOLS', label: 'Tool chest · scrap metal', use: (api) => crate('garage-' + api.key, { metal: 2, spring: 1 }, 'tool chest') }] },
    BANK: { floor: 'marble', wall: '#2f4a5a', trim: '#e3c25a', title: 'BANK', art(c) { block(c, 60, 90, 440, 26, 40, '#5a4030', { panels: 4 }); for (let i = 0; i < 4; i++) { R(c, '#0b0d14', 80 + i * 110, 70, 70, 22); R(c, '#9fc3d6', 82 + i * 110, 72, 66, 18); R(c, '#ffffff44', 84 + i * 110, 74, 10, 14); } R(c, '#0b0d14', 470, 200, 60, 60); R(c, '#8a939b', 472, 202, 56, 56); for (let a = 0; a < 8; a++) R(c, '#c9d1d6', 498 + Math.cos(a) * 18, 228 + Math.sin(a) * 18, 4, 4); R(c, '#5a6168', 494, 224, 12, 12); for (const x of [60, 160]) { block(c, x, 260, 70, 16, 8, '#2a3f62'); } R(c, '#e3c25a', 60, 196, 380, 2); sign(c, 'FIRST NIGHTSHIFT SAVINGS', 280, 34, '#e3c25a'); },
      solids: [solid(60, 90, 440, 66), solid(470, 200, 60, 60), solid(60, 260, 70, 24), solid(160, 260, 70, 24)], staff: [{ x: 150, y: 80 }, { x: 370, y: 80 }],
      targets: (b) => { const out = [{ x: 260, y: 186, r: 70, action: 'BANK', label: 'Teller · invest your cash', use: () => openSafe(() => root.NightshiftMarket?.open?.()) }]; const v = heistAt(b); out.push({ x: 470, y: 232, r: 54, action: v ? 'CASE IT' : 'VAULT', label: v ? 'Vault · plan the heist' : 'Vault · locked tight', use: () => (v ? (root.NightshiftZones?.leave?.(), setTimeout(() => openSafe(() => root.NightshiftHeists?.open?.(v.id)), 80)) : say('🔒 Time lock. This vault isn’t worth the trouble.')) }); return out; } },
    CLUB: { floor: 'club', wall: '#1d1430', trim: '#ff4ad8', title: 'CLUB', dark: 0.5, art(c) { block(c, 40, 80, 180, 24, 36, '#2a1f30', { panels: 3 }); for (let i = 0; i < 9; i++) { R(c, ['#ff4ad8', '#3ad0ff', '#c9e86a'][i % 3], 50 + i * 18, 70, 6, 12); } R(c, '#0b0d14', 380, 80, 120, 50); R(c, '#2a2f36', 382, 82, 116, 46); R(c, '#3ad0ff', 400, 92, 30, 20); R(c, '#ff4ad8', 450, 92, 30, 20); for (const x of [60, 100, 140, 180]) { R(c, '#0b0d14', x, 134, 14, 14); R(c, '#c84659', x + 1, 135, 12, 8); } sign(c, 'NEON ROOM', 280, 34, '#ff4ad8'); },
      drawGround(c, t) { for (let x = 240; x < 480; x += 30) for (let y = 180; y < 330; y += 30) { const k = (Math.floor(t * 3) + x / 30 + y / 30) % 4; c.fillStyle = ['#ff4ad855', '#3ad0ff55', '#c9e86a55', '#ffffff22'][k]; c.fillRect(x, y, 28, 28); } },
      solids: [solid(40, 80, 180, 60), solid(380, 80, 120, 50)], staff: [{ x: 120, y: 66 }, { x: 440, y: 70 }], dancers: [{ x: 300, y: 220 }, { x: 360, y: 260 }, { x: 420, y: 210 }, { x: 330, y: 300 }, { x: 270, y: 280 }],
      targets: (b) => { const v = venueAt(b); return [{ x: 130, y: 166, r: 60, action: v ? 'VIP' : 'BAR', label: v ? `${v.name} · the venue` : 'Bar · a round for the house ($40)', use: () => (v ? openSafe(() => root.NightshiftVenues?.open?.('club', v.id)) : drink()) }, { x: 360, y: 260, r: 80, action: 'DANCE', label: 'Dance floor · shake off some heat', use: () => dance() }]; } },
    WAREHOUSE: { floor: 'concrete', wall: '#4a4a3a', trim: '#e2c24a', title: 'WAREHOUSE', art(c) { for (const [x, y, w, h] of [[40, 80, 140, 60], [40, 180, 100, 60], [420, 90, 100, 120], [300, 260, 90, 50]]) { block(c, x, y, w, 18, h - 18, '#a87a4a', { panels: Math.max(2, Math.round(w / 40)) }); for (let i = 0; i < w; i += 12) R(c, '#c79a62', x + i, y + 2, 1, 14); } R(c, '#0b0d14', 230, 110, 70, 40); R(c, '#e2c24a', 232, 112, 66, 36); R(c, '#1d2024', 240, 120, 20, 20); R(c, '#9aa3ab', 300, 112, 30, 4); R(c, '#9aa3ab', 300, 140, 30, 4); sign(c, 'LOADING BAY 3', 280, 34, '#e2c24a'); },
      solids: [solid(40, 80, 140, 60), solid(40, 180, 100, 60), solid(420, 90, 100, 120), solid(300, 260, 90, 50), solid(230, 110, 100, 40)], staff: [{ x: 480, y: 300, guard: true }],
      targets: (b, api) => [{ x: 110, y: 160, r: 50, action: 'SEARCH', label: 'Crates · scavenge parts', use: () => crate('wh1-' + api.key, { metal: 3, pipe: 1, tape: 1 }, 'crates') }, { x: 90, y: 256, r: 50, action: 'SEARCH', label: 'Crates · scavenge parts', use: () => crate('wh2-' + api.key, { spring: 2, wood: 2 }, 'crates') }, { x: 470, y: 230, r: 50, action: 'SEARCH', label: 'Pallet · hardware', use: () => crate('wh3-' + api.key, { metal: 2, tape: 1, spring: 1 }, 'pallet') }] },
    APARTMENTS: { floor: 'lobby', wall: '#5a4a3a', trim: '#c8a050', title: 'APARTMENT LOBBY', art(c) { for (let i = 0; i < 12; i++) { const x = 60 + (i % 6) * 26, y = 76 + Math.floor(i / 6) * 22; R(c, '#0b0d14', x, y, 24, 20); R(c, '#c8a050', x + 1, y + 1, 22, 18); R(c, '#8a6a30', x + 8, y + 8, 8, 2); } R(c, '#0b0d14', 400, 66, 90, 100); R(c, '#9aa3ab', 402, 68, 86, 96); R(c, '#5a6168', 444, 68, 2, 96); R(c, '#f2c84a', 494, 110, 6, 6); block(c, 260, 250, 120, 26, 20, '#5a3a5a', { panels: 2 }); R(c, '#3d6e51', 500, 300, 20, 40); R(c, '#4f8a5f', 494, 284, 32, 22); sign(c, 'RESIDENTS ONLY', 280, 34, '#c8a050'); },
      solids: [solid(400, 66, 90, 100), solid(260, 250, 120, 46), solid(494, 284, 32, 56)], staff: [],
      targets: (b, api) => [{ x: 140, y: 140, r: 60, action: 'MAIL', label: 'Mailboxes · anything good?', use: () => mail('mail-' + api.key) }, { x: 445, y: 186, r: 50, action: 'ELEVATOR', label: 'Elevator · needs a key', use: () => say('🛗 Needs a resident key. Your own place is at the Midtown apartments.') }] },
  };

  // ---------------- actions ----------------
  function openSafe(fn) { try { const r = fn(); if (r === false) say('Not available right now'); } catch (e) { console.error(e); say('Not available right now'); } }
  function crate(id, loot, what) {
    const now = Date.now(), next = state.crates[id] || 0;
    if (now < next) { say(`📦 Picked clean · the ${what} refill in ${Math.ceil((next - now) / 60000)} min`); return; }
    const SUP = root.NightshiftSupply; if (!SUP?.give) { say('🎒 You need your backpack'); return; }
    const r = SUP.give(loot); state.crates[id] = now + 20 * 60000; persist(); gameSave();
    const got = Object.entries(loot).map(([k, n]) => `${n} ${k}`).join(', ');
    say(r && r.ok === false ? `🎒 Backpack full · couldn't carry ${got}` : `📦 Found ${got} · back in 20 min`);
    try { root.NightshiftSkills?.gain?.('crafting', 6, 'scavenge'); } catch { /* optional */ }
  }
  function mail(id) {
    const now = Date.now(), next = state.mail[id] || 0, p = P(); if (!p) return;
    if (now < next) { say('📭 Nothing new. Check back later.'); return; }
    state.mail[id] = now + 30 * 60000; persist();
    const roll = Math.random();
    if (roll < 0.35) { const c = 20 + Math.floor(Math.random() * 60); p.cash += c; say(`💌 A birthday card with $${c} inside. Not yours, but… finders keepers.`); try { root.NightshiftCrime?.heat?.(0.2); } catch { /* optional */ } }
    else if (roll < 0.6) { root.NightshiftSupply?.give?.({ tape: 1 }); say('📦 A package with packing tape. Useful for crafting.'); }
    else say('📭 Junk mail. Pizza coupons, mostly.');
    gameSave();
  }
  function drink() { const p = P(); if (!p) return; if (p.cash < 40) { say('Needs $40'); return; } p.cash -= 40; p.hp = Math.min(100, p.hp + 10); try { root.NightshiftSkills?.gain?.('charisma', 15, 'bar'); } catch { /* optional */ } say('🥃 You buy a round · +10 health, people like you more'); gameSave(); }
  let lastDance = 0;
  function dance() { const now = Date.now(); if (now - lastDance < 60000) { say('💃 Catch your breath first'); return; } lastDance = now; const p = P(); if (p) p.heat = Math.max(0, (p.heat || 0) - 0.5); try { root.NightshiftSkills?.gain?.('athletics', 12, 'dance'); } catch { /* optional */ } say('🕺 You hit the floor · heat cools off, +athletics'); }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function heistAt(b) { try { const vs = root.NightshiftHeists?.state ? (root.NightshiftHeistsData?.BANKS || []) : []; for (const v of vs) { const d = { x: b.x + b.w / 2 + (v.dx || 0), y: b.y + b.h + 12 }; const best = B().filter((x) => x.name === 'BANK').sort((p, q) => dist(p, v.near) - dist(q, v.near))[0]; if (best === b) return v; void d; } } catch { /* n/a */ } return null; }
  function venueAt(b) { try { return (root.NightshiftVenues?.places?.() || []).find((v) => v.kind === 'club' && Math.abs(v.y - (b.y + b.h + 12)) < 4 && Math.abs(v.x - (b.x + b.w / 2)) < 140) || null; } catch { return null; } }

  // ---------------- zones: one per building type, the building's identity passed in on enter ----------------
  const rng = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  function register() {
    const Z = root.NightshiftZones; if (!Z?.register) return false;
    for (const [type, t] of Object.entries(T)) {
      let curB = null, people = [];
      Z.register({
        id: 'in-' + type.toLowerCase().replace(/\s+/g, '-'), name: t.title, tagline: 'USE things to interact · 🚪 exit at the bottom', w: W, h: H, indoor: true, dark: t.dark ?? 0.08, zoom: 1.2, bg: '#07090d',
        spawn: { x: DOOR.x, y: DOOR.y - 34, angle: -Math.PI / 2 },
        ground(c) { floor(c, t.floor); walls(c, t.wall, t.trim); t.art(c); },
        drawGround: t.drawGround ? (c, tt) => t.drawGround(c, tt) : undefined,
        solids: [solid(0, 0, W, 62), solid(0, 0, 10, H), solid(W - 10, 0, 10, H), solid(0, H - 8, W / 2 - 34, 8), solid(W / 2 + 34, H - 8, W / 2 - 34, 8), ...t.solids],
        onEnter(api, data) {
          curB = data?.b || null; const r = rng((data?.seed || 7) >>> 0); people = [];
          for (const s of t.staff || []) people.push({ x: s.x, y: s.y, angle: Math.PI / 2, id: type + '-staff-' + s.x, role: s.guard ? 'security' : null });
          for (const s of t.patrons || []) if (r() < 0.8) people.push({ x: s.x, y: s.y, angle: Math.PI / 2, id: type + '-pat-' + Math.floor(r() * 24), seated: true, seat: { x: s.x, y: s.y } });
          for (const s of t.browsers || []) if (r() < 0.85) people.push({ x: s.x, y: s.y, angle: -Math.PI / 2, id: type + '-b-' + Math.floor(r() * 24) });
          for (const s of t.dancers || []) people.push({ x: s.x, y: s.y, angle: r() * 6, id: type + '-d-' + Math.floor(r() * 24), dance: r() * 6 });
          api.key = data?.key || 'x';
        },
        update(api, dt) { const now = performance.now() / 1000; for (const p of people) { if (p.dance !== undefined) { p.angle = p.dance + now * 2.2; p.moving = Math.sin(now * 5 + p.dance) > 0; p.walkTicks = (p.walkTicks || 0) + dt; } } },
        actors: () => people,
        targets: (api) => [{ x: DOOR.x, y: DOOR.y - 6, r: 46, action: 'EXIT', label: 'Back to the street', use: () => root.NightshiftZones.leave() }, ...t.targets(curB || {}, api)],
      });
    }
    return true;
  }
  // ---------------- doors in the city ----------------
  const BLURB = { 'CORNER SHOP': 'food, meds, ammo', DINER: 'meals with buffs', CLOTHING: 'clothes & mirror', GARAGE: 'tune your car · scrap', BANK: 'invest · case the vault', CLUB: 'drinks, dancing, cools heat', WAREHOUSE: 'scavenge crafting parts', APARTMENTS: 'check the mailboxes' };
  const homeDoor = { x: 950, y: 735 };
  let doorList = null;
  function doors() { if (doorList) return doorList; doorList = B().map((b, i) => ({ b, i, type: b.name, x: b.x + b.w / 2, y: b.y + b.h + 14 })).filter((d) => T[d.type] && !(d.type === 'APARTMENTS' && Math.hypot(d.x - homeDoor.x, d.y - homeDoor.y) < 120)); return doorList; }
  function enter(d) { const Z = root.NightshiftZones; const p = P(); if (!Z || !p) return false; return Z.enter('in-' + d.type.toLowerCase().replace(/\s+/g, '-'), null, { ret: { x: d.x, y: d.y + 10 }, data: { b: d.b, key: d.i, seed: d.i * 7919 + 17 } }); }
  function hookDoors() {
    const E = root.NightshiftEncounters; if (!E || E.__interiors) return !!E?.__interiors;
    const locs = E.locations, use = E.use;
    E.locations = function () { const list = locs.apply(this, arguments) || []; const p = P(); if (!p || p.hp <= 0) return list; const near = doors().filter((d) => Math.abs(d.x - p.x) < 900 && Math.abs(d.y - p.y) < 700); return [...list, ...near.map((d) => ({ id: 'door-' + d.i, type: 'door', x: d.x, y: d.y, ready: true, color: '#9fd4ff', label: '🚪 ' + (T[d.type].title), action: 'ENTER', hint: 'Walk in · ' + (BLURB[d.type] || 'look around') }))]; };
    E.use = function (id) { if (String(id).startsWith('door-')) { const d = doors().find((q) => 'door-' + q.i === id); if (d) { enter(d); return true; } } return use.apply(this, arguments); };
    E.__interiors = true; return true;
  }
  const t1 = setInterval(() => { if (register()) clearInterval(t1); }, 300);
  const t2 = setInterval(() => { if (hookDoors()) clearInterval(t2); }, 300);
  root.NightshiftInteriors2 = Object.freeze({ enter, doors, TYPES: Object.keys(T), BLURB, title: (ty) => T[ty]?.title || ty });
})(typeof globalThis !== 'undefined' ? globalThis : this);
