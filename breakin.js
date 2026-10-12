/* Break-ins in game (Claude-owned). Requires zones.js + breakin-data.js. Bullet-Echo-style interiors:
 *  - fog of war: you see a flashlight cone + a small circle around you (walls block it); guards outside it are hidden,
 *    but their footsteps and gunshots show up as red "echo" pulses;
 *  - guards patrol room to room, hear sprinting and gunfire (suppressors help), react after a beat, shoot (dogs bite),
 *    chase and search; the first alert starts an alarm and police arrive at the back door on a timer;
 *  - loot goes into a HOT BAG while you're inside: walk out the back door to keep it; die and it's gone;
 *  - each place has a cooldown before it's worth hitting again; leaving with an alarm adds heat.
 * Entry points: suburban houses (suburbs.js) and two city warehouses (night only, below).
 * Save: nightshift-breakin-v1. API: NightshiftBreakin.{start, state} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const Z = root.NightshiftZones, B = root.NightshiftBreakinData;
  if (!Z || !B) return;
  const KEY = 'nightshift-breakin-v1';
  let state = B.clean({});
  try { state = B.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const CS = () => { try { return combatState; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const O = (c, col, x, y, rx, ry) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
  const C = (c, col, x, y, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };

  const HM = () => root.NightshiftHitman || null;
  let job = null; // { id, type, L, from, door, guards, loot:{id:true}, bag:{cash,items}, alarmAt, policeAt, search, kills }

  // ---------------- art: floors, walls, furniture, containers ----------------
  const FLOOR = { kitchen: 'tile', bath: 'tile', living: 'wood', bedroom: 'wood', office: 'wood', foyer: 'marble', dining: 'marble', gallery: 'marble', gym: 'rubber', vault: 'steel', lounge: 'carpet', loading: 'concrete', storage: 'concrete', armory: 'concrete', trap: 'grimy', cook: 'tile', count: 'wood' };
  function floor(c, R0, kind, r) {
    const { x, y, w, h } = R0;
    if (kind === 'wood') { R(c, '#7a5534', x, y, w, h); for (let yy = 0; yy < h; yy += 10) { R(c, '#6a4728', x, y + yy, w, 1); for (let xx = ((yy / 10) % 3) * 23; xx < w; xx += 70) R(c, '#5a3c22', x + xx, y + yy, 1, 10); } for (let i = 0; i < 40; i++) R(c, '#8a6440', x + r() * w, y + r() * h, 6, 1); }
    else if (kind === 'tile') { R(c, '#c9cfd2', x, y, w, h); for (let yy = 0; yy < h; yy += 16) R(c, '#a9b1b6', x, y + yy, w, 1); for (let xx = 0; xx < w; xx += 16) R(c, '#a9b1b6', x + xx, y, 1, h); for (let i = 0; i < 20; i++) R(c, '#d8dde0', x + Math.floor(r() * w / 16) * 16 + 1, y + Math.floor(r() * h / 16) * 16 + 1, 15, 15); }
    else if (kind === 'marble') { R(c, '#e8e2d8', x, y, w, h); for (let yy = 0; yy < h; yy += 30) for (let xx = (yy / 30) % 2 ? 0 : 30; xx < w; xx += 60) R(c, '#d8d0c2', x + xx, y + yy, 30, 30); for (let i = 0; i < 26; i++) { const sx = x + r() * w, sy = y + r() * h; c.strokeStyle = '#c0b6a644'; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 12, sy + 6); c.stroke(); } }
    else if (kind === 'carpet') { R(c, '#5a2a3a', x, y, w, h); for (let i = 0; i < 300; i++) R(c, r() < 0.5 ? '#6a3446' : '#4a2230', x + r() * w, y + r() * h, 2, 2); R(c, '#c9a24a33', x + 10, y + 10, w - 20, 2); R(c, '#c9a24a33', x + 10, y + h - 12, w - 20, 2); }
    else if (kind === 'grimy') { R(c, '#4a3e36', x, y, w, h); for (let i = 0; i < 260; i++) R(c, r() < 0.5 ? '#54473e' : '#3f342d', x + r() * w, y + r() * h, 2, 2); for (let i = 0; i < 6; i++) O(c, '#2e2620aa', x + 20 + r() * (w - 40), y + 20 + r() * (h - 40), 8 + r() * 14, 5 + r() * 8); for (let i = 0; i < 10; i++) R(c, '#d8d0c288', x + r() * w, y + r() * h, 3, 2); }
    else if (kind === 'rubber') { R(c, '#2b2f33', x, y, w, h); for (let yy = 0; yy < h; yy += 40) for (let xx = 0; xx < w; xx += 40) R(c, '#33383d', x + xx + 1, y + yy + 1, 38, 38); }
    else if (kind === 'steel') { R(c, '#5d646b', x, y, w, h); for (let yy = 0; yy < h; yy += 20) for (let xx = 0; xx < w; xx += 20) { C(c, '#7d868c', x + xx + 5, y + yy + 5, 1); C(c, '#7d868c', x + xx + 15, y + yy + 15, 1); } }
    else { R(c, '#6a6e72', x, y, w, h); for (let i = 0; i < 260; i++) R(c, r() < 0.5 ? '#75797d' : '#5e6266', x + r() * w, y + r() * h, 2, 2); for (let i = 0; i < 4; i++) R(c, '#c9b14a', x + 10 + r() * (w - 60), y + 10 + r() * (h - 10), 40, 3); }
  }
  function wallArt(c, w0) {
    const horiz = w0.w >= w0.h;
    R(c, '#1c2029', w0.x, w0.y, w0.w, w0.h); R(c, '#3a404c', w0.x, w0.y, w0.w, 2);
    if (horiz) { R(c, '#4a505c', w0.x, w0.y + w0.h, w0.w, 7); R(c, '#5a6070', w0.x, w0.y + w0.h, w0.w, 1); R(c, '#00000044', w0.x, w0.y + w0.h + 7, w0.w, 3); for (let k = 8; k < w0.w; k += 36) R(c, '#40465222', w0.x + k, w0.y + w0.h, 1, 7); }
  }
  const FURN_ART = {
    counter: (c, f) => { R(c, '#3a3f45', f.x, f.y, f.w, f.h); R(c, '#d8dde0', f.x, f.y, f.w, 6); R(c, '#9aa3ab', f.x + 20, f.y + 9, 22, 12); R(c, '#6e777d', f.x + 23, f.y + 11, 16, 8); for (const k of [70, 90]) { C(c, '#1b1e22', f.x + k, f.y + 14, 5); C(c, '#3a3f45', f.x + k, f.y + 14, 3); } },
    fridge: (c, f) => { R(c, '#d8dde0', f.x, f.y, f.w, f.h); R(c, '#b9c2c7', f.x, f.y + f.h * 0.4, f.w, 1); R(c, '#9aa3ab', f.x + f.w - 5, f.y + 4, 2, 8); R(c, '#ffffff', f.x + 2, f.y + 2, 4, f.h - 4); },
    table: (c, f) => { R(c, '#00000033', f.x + 3, f.y + 4, f.w, f.h); R(c, '#8a6440', f.x, f.y, f.w, f.h); R(c, '#a07a50', f.x, f.y, f.w, 3); for (const [dx, dy] of [[-8, 8], [f.w + 2, 8], [-8, f.h - 14], [f.w + 2, f.h - 14]]) R(c, '#4a3a2a', f.x + dx, f.y + dy, 6, 6); C(c, '#e0473a', f.x + f.w / 2, f.y + f.h / 2, 4); },
    sofa: (c, f) => { R(c, '#00000033', f.x + 3, f.y + 4, f.w, f.h); R(c, '#3e5a7a', f.x, f.y, f.w, f.h); R(c, '#4f6f94', f.x + 6, f.y + 6, f.w - 12, f.h - 14); R(c, '#2e4560', f.x, f.y + f.h - 8, f.w, 8); for (let k = 1; k < 3; k++) R(c, '#2e4560', f.x + (f.w / 3) * k, f.y + 6, 1, f.h - 14); R(c, '#c9a24a', f.x + 10, f.y + 8, 10, 8); },
    tv: (c, f) => { R(c, '#2b2218', f.x - 6, f.y + 6, f.w + 12, 10); R(c, '#0b0d10', f.x, f.y, f.w, f.h - 4); R(c, '#2a4256', f.x + 2, f.y + 2, f.w - 4, f.h - 8); R(c, '#5fb7e055', f.x + 4, f.y + 3, 14, 3); },
    plant: (c, f) => { C(c, '#7a4a2a', f.x + 9, f.y + 12, 7); for (let k = 0; k < 7; k++) { const a = k * 0.9; O(c, k % 2 ? '#3f8a3a' : '#5aa04a', f.x + 9 + Math.cos(a) * 6, f.y + 6 + Math.sin(a) * 5, 5, 2.5); } },
    rug: (c, f) => { R(c, '#7a2e3a', f.x, f.y, f.w, f.h); R(c, '#c9a24a', f.x + 4, f.y + 4, f.w - 8, f.h - 8); R(c, '#7a2e3a', f.x + 7, f.y + 7, f.w - 14, f.h - 14); for (let k = 0; k < f.w; k += 6) { R(c, '#e8dcc0', f.x + k, f.y - 3, 2, 3); R(c, '#e8dcc0', f.x + k, f.y + f.h, 2, 3); } },
    bed: (c, f) => { R(c, '#00000033', f.x + 3, f.y + 4, f.w, f.h); R(c, '#5a3d22', f.x, f.y, f.w, f.h); R(c, '#e8e2d8', f.x + 4, f.y + 4, f.w - 8, f.h - 8); R(c, '#5a6aa0', f.x + 4, f.y + 30, f.w - 8, f.h - 34); for (let k = 0; k < 5; k++) R(c, '#4a5a90', f.x + 4, f.y + 36 + k * 10, f.w - 8, 2); R(c, '#ffffff', f.x + 8, f.y + 8, 24, 16); R(c, '#ffffff', f.x + 38, f.y + 8, 24, 16); },
    dresser: (c, f) => { R(c, '#6a4a2e', f.x, f.y, f.w, f.h); for (let k = 0; k < 3; k++) { R(c, '#7a5a38', f.x + 3 + k * 19, f.y + 4, 17, f.h - 8); C(c, '#c9a24a', f.x + 11 + k * 19, f.y + f.h / 2, 1.3); } },
    tub: (c, f) => { R(c, '#d8dde0', f.x, f.y, f.w, f.h); O(c, '#8fc8e8', f.x + f.w / 2, f.y + f.h / 2, f.w / 2 - 6, f.h / 2 - 6); R(c, '#9aa3ab', f.x + 6, f.y + f.h / 2 - 2, 5, 4); },
    sink: (c, f) => { R(c, '#d8dde0', f.x, f.y, f.w, f.h); O(c, '#b9c2c7', f.x + f.w / 2, f.y + f.h / 2, 9, 6); },
    desk: (c, f) => { R(c, '#00000033', f.x + 3, f.y + 4, f.w, f.h); R(c, '#4a3a2a', f.x, f.y, f.w, f.h); R(c, '#5a4a38', f.x, f.y, f.w, 3); R(c, '#0b0d10', f.x + 10, f.y + 6, 26, 16); R(c, '#2a4256', f.x + 12, f.y + 8, 22, 12); R(c, '#e8e3d0', f.x + 46, f.y + 10, 16, 12); R(c, '#c0473f', f.x + 66, f.y + 8, 6, 8); },
    shelf: (c, f) => { R(c, '#5a3d22', f.x, f.y, f.w, f.h); for (let k = 0; k < f.h; k += 16) { R(c, '#3a2816', f.x, f.y + k, f.w, 2); for (let b = 0; b < 4; b++) R(c, ['#c0473f', '#3d7fd0', '#e0b021', '#2f6b3f'][(b + k) % 4], f.x + 3 + b * 5, f.y + k + 3, 4, 12); } },
    chair: (c, f) => { C(c, '#2b2f33', f.x + 11, f.y + 11, 10); C(c, '#3a3f45', f.x + 11, f.y + 9, 7); },
    longtable: (c, f) => { R(c, '#00000033', f.x + 3, f.y + 4, f.w, f.h); R(c, '#5a3a22', f.x, f.y, f.w, f.h); R(c, '#e8e2d8', f.x + 6, f.y + 6, f.w - 12, f.h - 12); for (let k = 0; k < 5; k++) { C(c, '#c9d1d6', f.x + 18 + k * 22, f.y + f.h / 2, 5); } C(c, '#ffd27a', f.x + f.w / 2, f.y + f.h / 2, 3); },
    cabinet: (c, f) => { R(c, '#4a3020', f.x, f.y, f.w, f.h); R(c, '#9fc3d644', f.x + 4, f.y + 3, f.w - 8, f.h - 6); for (let k = 0; k < 4; k++) C(c, '#e8e2d8', f.x + 12 + k * 15, f.y + f.h / 2, 3); },
    pedestal: (c, f) => { R(c, '#d8d0c2', f.x, f.y, f.w, f.h); R(c, '#b9b0a2', f.x, f.y + f.h - 4, f.w, 4); O(c, '#c9a24a', f.x + f.w / 2, f.y + 8, 7, 6); C(c, '#e3c25a', f.x + f.w / 2, f.y + 2, 4); },
    bench: (c, f) => { R(c, '#2b2218', f.x, f.y, f.w, f.h); R(c, '#4a3a2a', f.x, f.y, f.w, 4); },
    weights: (c, f) => { R(c, '#3a3f45', f.x, f.y, f.w, f.h); for (let k = 0; k < 4; k++) { C(c, '#111', f.x + 8 + k * 15, f.y + 15, 6); C(c, '#5d646b', f.x + 8 + k * 15, f.y + 15, 2); } },
    treadmill: (c, f) => { R(c, '#2b2f33', f.x, f.y, f.w, f.h); R(c, '#111', f.x + 5, f.y + 14, f.w - 10, f.h - 18); R(c, '#5fb7e0', f.x + 8, f.y + 3, f.w - 16, 6); },
    vaultdoor: (c, f) => { R(c, '#5d646b', f.x, f.y, f.w, f.h); C(c, '#9aa3ab', f.x + f.w / 2, f.y + f.h / 2, 8); for (let k = 0; k < 6; k++) { const a = k; R(c, '#3a3f45', f.x + f.w / 2 + Math.cos(a) * 8 - 1, f.y + f.h / 2 + Math.sin(a) * 8 - 1, 2, 2); } },
    bar: (c, f) => { R(c, '#3a2216', f.x, f.y, f.w, f.h); R(c, '#5a3a22', f.x, f.y, 4, f.h); for (let k = 0; k < 6; k++) R(c, ['#2f6b3f', '#c0473f', '#e0b021'][k % 3], f.x + 8, f.y + 6 + k * 14, 6, 10); },
    crates: (c, f) => { for (let yy = 0; yy < f.h; yy += 20) for (let xx = 0; xx < f.w; xx += 24) { R(c, '#00000033', f.x + xx + 2, f.y + yy + 3, 22, 18); R(c, '#8a6a40', f.x + xx, f.y + yy, 22, 18); R(c, '#a8834e', f.x + xx, f.y + yy, 22, 2); R(c, '#6a4a2a', f.x + xx + 10, f.y + yy, 2, 18); } },
    forklift: (c, f) => { R(c, '#e0b021', f.x, f.y + 14, f.w, f.h - 14); R(c, '#1b1b1b', f.x + 4, f.y + 18, f.w - 8, 16); R(c, '#9aa3ab', f.x + 6, f.y, 3, 16); R(c, '#9aa3ab', f.x + f.w - 9, f.y, 3, 16); for (const dx of [-3, f.w - 3]) C(c, '#111', f.x + dx + 3, f.y + f.h - 8, 5); },
    mattress: (c, f) => { R(c, '#00000033', f.x + 3, f.y + 4, f.w, f.h); R(c, '#c9c0a8', f.x, f.y, f.w, f.h); R(c, '#b3a88c', f.x, f.y + f.h - 4, f.w, 4); O(c, '#a0937266', f.x + f.w * 0.6, f.y + f.h * 0.5, 9, 6); R(c, '#e8e2d0', f.x + 4, f.y + 4, 18, 12); R(c, '#5a6aa0', f.x + 26, f.y + 6, f.w - 30, f.h - 10); },
    labtable: (c, f) => { R(c, '#00000033', f.x + 3, f.y + 4, f.w, f.h); R(c, '#9aa3ab', f.x, f.y, f.w, f.h); R(c, '#c9d1d6', f.x, f.y, f.w, 3); for (let k = 0; k < 4; k++) { const x = f.x + 10 + k * (f.w - 20) / 3; R(c, '#e8eef4', x - 4, f.y + 6, 8, 10); R(c, ['#7fd0ff', '#e8e2d0', '#ff9ad0', '#9fe08a'][k], x - 3, f.y + 10, 6, 5); } R(c, '#2b2f33', f.x + f.w - 20, f.y + 14, 14, 10); C(c, '#e0473a', f.x + f.w - 13, f.y + 19, 3); R(c, '#e8e2d0', f.x + 6, f.y + 18, 22, 6); for (let k = 0; k < 5; k++) R(c, '#ffffff', f.x + 8 + k * 4, f.y + 19, 2, 3); },
    barrels: (c, f) => { for (const [dx, dy] of [[10, 10], [28, 12], [18, 28]]) { O(c, '#00000044', f.x + dx + 2, f.y + dy + 3, 9, 9); C(c, '#2f5d8a', f.x + dx, f.y + dy, 9); C(c, '#3d7fd0', f.x + dx, f.y + dy, 7); C(c, '#244a6e', f.x + dx, f.y + dy, 2); R(c, '#e0b021', f.x + dx - 6, f.y + dy - 1, 12, 2); } },
    counttable: (c, f) => { R(c, '#00000033', f.x + 3, f.y + 4, f.w, f.h); R(c, '#4a3a2a', f.x, f.y, f.w, f.h); R(c, '#5a4a38', f.x, f.y, f.w, 3); for (let k = 0; k < 7; k++) { const x = f.x + 8 + (k % 4) * 21, y = f.y + 8 + Math.floor(k / 4) * 20; R(c, '#2f6b3f', x, y, 16, 9); R(c, '#4f9a5f', x, y, 16, 2); R(c, '#e8e2d0', x + 6, y, 2, 9); } R(c, '#1b1e22', f.x + f.w - 22, f.y + f.h - 18, 16, 12); R(c, '#7cdeb5', f.x + f.w - 20, f.y + f.h - 16, 12, 4); R(c, '#9aa3ab', f.x + 6, f.y + f.h - 12, 10, 8); },
    rack: (c, f) => { R(c, '#00000033', f.x + 3, f.y + 4, f.w, f.h); R(c, '#2e5a7a', f.x, f.y, f.w, f.h); for (let k = 0; k < f.w; k += 30) { R(c, '#e0703a', f.x + k, f.y, 3, f.h); for (let b = 0; b < 2; b++) R(c, ['#8a6a40', '#a8834e', '#c9b58a'][(k / 30 + b) % 3 | 0], f.x + k + 5 + b * 12, f.y + 3, 10, f.h - 6); } },
  };
  function container(c, l, opened, t, visible) {
    const { x, y } = l;
    const box = (col, w, h, lid) => { R(c, '#00000044', x - w / 2 + 2, y - h / 2 + 3, w, h); R(c, col, x - w / 2, y - h / 2, w, h); R(c, lid, x - w / 2, y - h / 2, w, 3); };
    switch (l.kind) {
      case 'safe': case 'gunsafe': box(l.kind === 'safe' ? '#3a3f45' : '#2f4a3a', 24, 24, '#5d646b'); C(c, '#9aa3ab', x, y, 5); C(c, '#c9d1d6', x, y, 2); if (opened) R(c, '#111', x - 10, y - 10, 20, 20); break;
      case 'jewelbox': box('#7a2e3a', 16, 12, '#c9a24a'); if (!opened) C(c, '#7fd0ff', x, y, 2); break;
      case 'tv': box('#0b0d10', 30, 10, '#2a4256'); break;
      case 'art': R(c, '#c9a24a', x - 13, y - 16, 26, 20); R(c, opened ? '#2b2218' : '#3d7fd0', x - 10, y - 13, 20, 14); if (!opened) { R(c, '#e0b021', x - 6, y - 9, 6, 6); R(c, '#2f6b3f', x - 2, y - 6, 10, 6); } break;
      case 'crate': case 'ammo': box(l.kind === 'ammo' ? '#4a5a3a' : '#8a6a40', 22, 18, l.kind === 'ammo' ? '#5d7048' : '#a8834e'); if (opened) R(c, '#2b2218', x - 9, y - 7, 18, 12); break;
      case 'gunlocker': box('#2b3238', 20, 30, '#4a5560'); for (let k = 0; k < 3; k++) R(c, '#11161a', x - 7, y - 10 + k * 7, 14, 1); if (opened) R(c, '#111', x - 8, y - 13, 16, 26); break;
      case 'cashbox': box('#3a3f45', 18, 12, '#9aa3ab'); break;
      case 'product': box('#6a5a3a', 24, 16, '#8a7a52'); if (!opened) { R(c, '#3fae4a', x - 9, y - 6, 6, 5); R(c, '#f4f4f0', x - 2, y - 6, 5, 5); R(c, '#ff7fd0', x + 5, y - 5, 4, 4); } break;
      case 'chemcrate': box('#2d6fb5', 20, 16, '#55a0e8'); R(c, '#e0b021', x - 6, y - 2, 12, 4); R(c, '#111', x - 2, y - 1, 4, 2); break;
      case 'cashpile': if (!opened) { for (let k = 0; k < 5; k++) { R(c, '#00000033', x - 10 + k * 4 + 1, y - 6 + (k % 2) * 5 + 2, 10, 6); R(c, '#2f6b3f', x - 10 + k * 4, y - 6 + (k % 2) * 5, 10, 6); R(c, '#4f9a5f', x - 10 + k * 4, y - 6 + (k % 2) * 5, 10, 1); R(c, '#e8e2d0', x - 6 + k * 4, y - 6 + (k % 2) * 5, 2, 6); } } else R(c, '#2b2218', x - 10, y - 5, 20, 10); break;
      case 'cashjar': O(c, '#9fc3d6aa', x, y, 6, 8); if (!opened) R(c, '#7cdeb5', x - 3, y - 2, 6, 6); break;
      default: box('#6a4a2e', 20, 14, '#8a6440'); C(c, '#c9a24a', x, y + 1, 1.3);
    }
    if (!opened && visible) { const k = 0.5 + 0.5 * Math.sin(t * 5 + x); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + 0.35 * k; C(c, '#ffd970', x + 8, y - 10, 2 + k * 1.5); c.restore(); }
  }
  function dogArt(c, g, t) {
    const dir = Math.cos(g.angle) >= 0 ? 1 : -1, bob = g.moving ? Math.sin(t * 14) * 1.2 : 0;
    O(c, '#00000044', g.x + 2, g.y + 2, 13, 4);
    for (const lx of [-7, -3, 4, 8]) R(c, '#2a1e16', g.x + lx * dir - 1, g.y - 6 + (g.moving && lx % 2 ? bob : 0), 2, 7);
    O(c, '#5a3a22', g.x, g.y - 9 + bob, 12, 6); O(c, '#2a1e16', g.x - 3 * dir, g.y - 11 + bob, 6, 3.5);
    O(c, '#5a3a22', g.x + 12 * dir, g.y - 13 + bob, 5, 4.5); R(c, '#1b1410', g.x + 16 * dir - 1, g.y - 13 + bob, 3, 3); R(c, '#2a1e16', g.x + 10 * dir, g.y - 19 + bob, 3, 4);
    R(c, '#5a3a22', g.x - 13 * dir, g.y - 13 + bob + Math.sin(t * 9) * 2, 2, 6);
    if (g.state === 'alert') R(c, '#e8e8e0', g.x + 15 * dir, g.y - 10 + bob, 2, 1);
  }

  // ---------------- guard AI ----------------
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function setTarget(g, pt) { g.target = pt; g.path = B.path(job.L, g, pt); }
  function alarm(now) { if (job.defense) return; if (!job.alarmAt) { job.alarmAt = now; job.policeAt = now + job.L.T.police * 1000; say(`🚨 You've been spotted · police in ${job.L.T.police}s · get out the back door`); try { root.NightshiftAudio?.play('impact'); } catch { /* optional */ } } }
  function hear(x, y, radius, api, kind) {
    if (!job) return;
    for (const g of job.guards) {
      if (g.dead || g.state === 'alert') continue;
      const d = Math.hypot(g.x - x, g.y - y), clear = api.los(g.x, g.y, x, y);
      if (d < (clear ? radius : radius * 0.55)) { g.state = 'investigate'; setTarget(g, { x, y }); g.until = performance.now() + 9000; g.reaction = 0; if (kind === 'shot') g.until += 4000; }
    }
  }
  // The mark bolts for the back door once the alarm has been going a while (straight away if unarmed).
  function markFlee(g, dt, now, api) {
    if (g.state !== 'flee') {
      if (!job.alarmAt || now - job.alarmAt < (g.armed === false ? 1500 : 9000)) return false;
      g.state = 'flee'; g.fleeStep = 0; say(`🏃 ${g.name} is running for the back door! Stop them before they get out.`);
      const d0 = job.L.doors.find((q) => q.entry); g.fleePts = [{ x: d0.x, y: d0.y - 34 }, { x: d0.x, y: d0.y + 40 }]; setTarget(g, g.fleePts[0]);
    }
    const goal = g.path?.[0] || g.fleePts[g.fleeStep];
    if (goal) {
      const gx = goal.x - g.x, gy = goal.y - g.y, gd = Math.hypot(gx, gy), sp = g.speed * 1.45;
      if (gd < 8) { if (g.path?.length) g.path.shift(); else if (g.fleeStep === 0) { g.fleeStep = 1; g.path = [g.fleePts[1]]; } }
      else { const sx = (gx / gd) * sp * dt, sy = (gy / gd) * sp * dt; if (g.fleeStep === 1 || !api.blocked(g.x + sx, g.y, 9)) g.x += sx; if (g.fleeStep === 1 || !api.blocked(g.x, g.y + sy, 9)) g.y += sy; g.angle = Math.atan2(gy, gx); g.moving = true; g.walk = (g.walk || 0) + dt; }
    }
    if (!api.visible(g.x, g.y) && now - (g.lastEcho || 0) > 300) { g.lastEcho = now; api.echo(g.x, g.y, '#ffd970', 'step'); }
    if (g.fleeStep === 1 && g.y > job.L.exit.y + 6) { g.dead = true; g.gone = true; job.markGone = true; say(`💨 ${g.name} got away. Contract blown.`); }
    return true;
  }
  function guardsUpdate(dt, now, api) {
    const pos = api.pos, sneaking = !pos.moving || !pos.sprint;
    for (const g of job.guards) {
      if (g.dead) continue;
      if (g.kind === 'mark' && markFlee(g, dt, now, api)) continue;
      const d = dist(g, pos), ang = Math.atan2(pos.y - g.y, pos.x - g.x);
      let da = ang - g.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      const sight = g.sight * (sneaking && d > 90 && g.state !== 'alert' ? 0.7 : 1) * (job.dark ? 0.8 : 1);
      const sees = d < sight && Math.abs(da) < g.cone / 2 && api.los(g.x, g.y, pos.x, pos.y) || (d < 46 && api.los(g.x, g.y, pos.x, pos.y));
      if (sees) {
        if (g.state !== 'alert') { g.state = 'alert'; g.reaction = now + (g.melee ? 250 : g.kind === 'cop' ? 300 : 600); alarm(now); if (!api.visible(g.x, g.y)) api.echo(g.x, g.y, '#ffb347', 'shot'); }
        g.lastSeen = { x: pos.x, y: pos.y, t: now };
      }
      // movement goal by state
      let goal = null, speed = g.speed;
      if (g.state === 'alert') {
        g.angle = sees ? ang : g.angle;
        if (sees) { if (g.melee) goal = { x: pos.x, y: pos.y }; else if (d > 150) goal = { x: pos.x, y: pos.y }; else if (d < 80) goal = { x: g.x - Math.cos(ang) * 30, y: g.y - Math.sin(ang) * 30 }; speed *= 1.15; }
        else if (g.lastSeen) { if (!g.target || dist(g.target, g.lastSeen) > 10) setTarget(g, g.lastSeen); if (dist(g, g.lastSeen) < 14 || now - g.lastSeen.t > 7000) { g.state = 'search'; g.until = now + 6000; } }
        if (sees && now >= g.reaction && now >= (g.nextShot || 0)) {
          if (g.melee) { if (d < 26) { g.nextShot = now + g.rate; try { root.NightshiftRecovery?.damage?.(g.dmg, now); } catch { /* n/a */ } api.fx('blood', pos.x, pos.y, 260); } }
          else if (g.armed !== false) { g.nextShot = now + g.rate * (0.8 + Math.random() * 0.5); api.enemyShot(g.x + Math.cos(ang) * 14, g.y + Math.sin(ang) * 14, ang, g.dmg, 11, g.spread + (pos.moving ? 0.05 : 0), 560); hear(g.x, g.y, 260, api, 'shot'); }
        }
      } else if (g.state === 'investigate' || g.state === 'search') {
        if (g.state === 'search' && (!g.target || dist(g, g.target) < 10)) { const base = g.lastSeen || g; setTarget(g, { x: base.x + (Math.random() - 0.5) * 160, y: base.y + (Math.random() - 0.5) * 120 }); }
        if (now > g.until) { g.state = 'patrol'; g.target = null; }
      } else { // patrol
        const wp = g.route[g.ri || 0];
        if (!g.target || dist(g.target, wp) > 5) setTarget(g, wp);
        if (dist(g, wp) < 12) { g.wait = (g.wait || 0) + dt; if (g.wait > 90) { g.wait = 0; g.ri = ((g.ri || 0) + 1) % g.route.length; } }
        speed *= 0.65;
      }
      if (!goal && g.path?.length) { goal = g.path[0]; if (dist(g, goal) < 9) { g.path.shift(); goal = g.path[0] || null; } }
      g.moving = false;
      if (goal) {
        const gx = goal.x - g.x, gy = goal.y - g.y, gd = Math.hypot(gx, gy);
        if (gd > 2) {
          const sx = (gx / gd) * speed * dt, sy = (gy / gd) * speed * dt;
          if (!api.blocked(g.x + sx, g.y, 9)) g.x += sx; if (!api.blocked(g.x, g.y + sy, 9)) g.y += sy;
          g.moving = true; if (!(g.state === 'alert' && sees)) g.angle = Math.atan2(gy, gx);
          g.walk = (g.walk || 0) + dt;
        }
      }
      // footsteps you can't see show up as echoes
      if (g.moving && !api.visible(g.x, g.y) && now - (g.lastEcho || 0) > (g.state === 'alert' ? 380 : 620)) { g.lastEcho = now; api.echo(g.x, g.y, g.state === 'alert' ? '#ff5a6a' : '#ff8a7a', 'step'); }
    }
    // your own sprinting is loud
    if (pos.moving && pos.sprint && now - (job.lastStep || 0) > 380) { job.lastStep = now; hear(pos.x, pos.y, 150, api, 'step'); api.echo(pos.x, pos.y, '#9fd0ff', 'step'); }
    // police
    if (job.policeAt && now >= job.policeAt && !job.copsIn) {
      job.copsIn = true; say('🚔 Police at the back door!');
      for (let k = 0; k < 2; k++) { const G2 = B.GUARDS.cop; job.guards.push({ id: 'cop' + k, kind: 'cop', ...G2, x: job.L.exit.x + (k ? 24 : -24), y: job.L.exit.y - 20, angle: -Math.PI / 2, state: 'alert', lastSeen: { x: pos.x, y: pos.y, t: now }, route: [{ x: job.L.exit.x, y: job.L.exit.y - 40 }], reaction: now + 800 }); }
    }
  }

  // ---------------- searching ----------------
  // Safes: crack the dial (quiet, instant, +30% cash) or drill it (slow and loud). Everything else is a timed search.
  const SAFES = { safe: 'safe', gunsafe: 'gunsafe' };
  function startSearch(l) {
    if (job.search?.id === l.id || job.picking) return;
    const PK = root.NightshiftPicks;
    if (SAFES[l.kind] && PK && !job.tried?.[l.id]) {
      job.tried = job.tried || {}; job.tried[l.id] = true; job.picking = l.id;
      PK.start({ type: SAFES[l.kind], title: l.kind === 'gunsafe' ? 'CRACK THE GUN SAFE' : 'CRACK THE SAFE', sub: 'Tap when the notch hits each number · misses make noise',
        onMiss: () => { if (job) hear(l.x, l.y, 120, Z.api, 'step'); },
        onDone: (ok, p) => { if (!job) return; job.picking = null; if (p?.cancelled) { job.tried[l.id] = false; return; } if (ok) { giveLoot(l, Z.api, 1.3); Z.api.float(l.x, l.y - 34, 'CRACKED · +30%', '#7cdeb5'); try { root.NightshiftSkills?.gain('stealth', 30, 'safe'); } catch { /* optional */ } } else { say('🔩 Dial jammed · drilling it instead (loud)'); drill(l, 1.35); } },
        alt: { label: 'DRILL IT', fn: () => { if (job) { job.picking = null; drill(l, 1); } } } });
      return;
    }
    drill(l, 1);
  }
  function drill(l, loud) {
    job.search = { id: l.id, t0: performance.now(), ms: l.seconds * 1000 * (SAFES[l.kind] ? mod('crafting.speed') : 1) };
    hear(l.x, l.y, (SAFES[l.kind] ? 140 : 60) * loud, Z.api, 'step');
  }
  function searchTick(now, api) {
    if (job.picking) { const l = job.L.loot.find((q) => q.id === job.picking); if (!l || dist(api.pos, l) > 54) { job.picking = null; root.NightshiftPicks?.cancel?.(); if (l) job.tried[l.id] = false; } return; }
    const s = job.search; if (!s) return;
    const l = job.L.loot.find((q) => q.id === s.id);
    if (!l || dist(api.pos, l) > 42) { job.search = null; return; }
    if (SAFES[l.kind] && now - (s.lastNoise || s.t0) > 1600) { s.lastNoise = now; hear(l.x, l.y, 150, api, 'step'); api.echo(l.x, l.y, '#9fd0ff', 'step'); }
    if (now - s.t0 < s.ms) return;
    job.search = null; giveLoot(l, api, 1);
  }
  function giveLoot(l, api, cashMult) {
    job.looted[l.id] = true;
    const got = B.rollLoot(l.kind, Math.random, mod('luck.rare')); got.cash = Math.round(got.cash * cashMult);
    job.bag.cash += got.cash; for (const [k, n] of Object.entries(got.items)) job.bag.items[k] = (job.bag.items[k] || 0) + n;
    const txt = [got.cash ? `+${money(got.cash)}` : '', ...Object.entries(got.items).map(([k, n]) => `+${n} ${k === 'ammo' ? '🔹' : root.NightshiftSupplyData?.MATERIALS?.[k]?.icon || k}`)].filter(Boolean).join(' ') || 'empty';
    api.float(l.x, l.y - 16, txt, got.cash || Object.keys(got.items).length ? '#ffe9a8' : '#9fb3c8');
    try { root.NightshiftAudio?.play('pickup'); root.NightshiftSkills?.gain('stealth', 12, 'loot'); } catch { /* optional */ }
    // Legendary blueprints hide in safes and gun lockers (more often in the estate and stash houses).
    const bpChance = { safe: 0.04, gunsafe: 0.07, gunlocker: 0.1, cashpile: 0.03 }[l.kind] || 0;
    if (bpChance) { try { root.NightshiftWeapons?.blueprintDrop?.(bpChance * (job.type === 'mansion' || job.type === 'stash' ? 2 : 1) * mod('luck.rare'), `found in a ${l.kind === 'gunlocker' ? 'gun locker' : l.kind}`); } catch { /* optional */ } }
  }

  // ---------------- start / finish ----------------
  function bagValue() { const F = { ...B.FENCE, weed: 60, coke: 150 }; let v = job.bag.cash; for (const [k, n] of Object.entries(job.bag.items)) v += (F[k] || (root.NightshiftSupplyData?.MATERIALS?.[k]?.price || 3)) * n; return v; }
  function finish(api) {
    const p = P(), j = job; if (!p || !j) return;
    if (j.defense) {
      const won = j.guards.length > 0 && !j.toCome && j.guards.every((g) => g.dead);
      p.cash += j.bag.cash; job = null; persist(); gameSave();
      try { j.defense.onEnd?.(won, j.bag.cash); } catch (e) { console.error(e); }
      Z.leave(j.door ? { x: j.door.x, y: j.door.y + 30 } : undefined); return;
    }
    if (j.type === 'stash' && !j.contract && j.guards.filter((g) => g.kind !== 'cop').every((g) => g.dead)) { try { root.NightshiftSafehouse?.cleared?.(j.id); } catch { /* optional */ } }
    try { root.NightshiftLedger?.tag('breakin'); } catch { /* optional */ } 
    p.cash += j.bag.cash;
    const items = { ...j.bag.items }, ammo = items.ammo || 0; delete items.ammo;
    // weed/coke go straight into the game's pocket (where dealers look for them)
    try { const pk = root.NightshiftInventory?.state?.pocket; if (pk) { for (const k of ['weed', 'coke']) if (items[k]) { pk[k] = Math.min(999, (pk[k] || 0) + items[k]); delete items[k]; } root.NightshiftInventory.save?.(); } } catch { /* optional */ }
    const cs = CS(); if (ammo && cs) cs.reserve = Math.min(240, cs.reserve + ammo);
    const res = root.NightshiftSupply?.give?.(items) || { added: {}, lost: items };
    const lost = Object.values(res.lost || {}).reduce((a, b) => a + b, 0);
    const heat = (j.alarmAt ? j.L.T.heat : 0.25) + j.kills * 0.4;
    p.heat = Math.min(5, (p.heat || 0) + heat * mod('stealth.heat'));
    state.robbed[j.id] = Date.now(); state.stats.jobs += 1; if (j.type === 'stash') state.stats.trap += 1; if (!j.alarmAt) state.stats.clean += 1; state.stats.loot += Math.round(bagValue()); state.stats.kills += j.kills;
    persist(); gameSave();
    try { root.NightshiftSkills?.gain('stealth', j.alarmAt ? 40 : 120, 'breakin'); } catch { /* optional */ }
    if (j.contract) { try { HM()?.resolve?.({ killed: j.markDown, alarm: !!j.alarmAt, otherKills: j.otherKills, escaped: j.markGone }); } catch (e) { console.error(e); } }
    const n = Object.values(j.bag.items).reduce((a, b) => a + b, 0);
    say(`${j.alarmAt ? '🚨 Got out' : '🤫 Clean job'} · ${money(j.bag.cash)} cash + ${n} item${n === 1 ? '' : 's'}${lost ? ` (${lost} didn't fit your bag)` : ''}${j.alarmAt ? ' · heat up' : ''}`);
    job = null;
    if (j.from === 'suburbs' && root.NightshiftZones.zones().suburbs) Z.enter('suburbs', { x: j.door.x, y: j.door.y + 30, angle: Math.PI / 2 }); else Z.leave(j.door ? { x: j.door.x, y: j.door.y + 30 } : undefined);
  }
  // Defend your own stash house: raiders come through the back door, you hold the house. No police, no loot.
  function defend(o) {
    const p = P(); if (!p || job) return false;
    const L = B.generate('stash', hashStr(o.id) >>> 0); L.loot = [];
    const home = B.farRoom(L), spawn = { x: home.x + home.w / 2, y: home.y + home.h / 2, angle: Math.PI / 2 };
    job = { id: o.id, type: 'stash', L, from: 'city', door: o.door, defense: o, guards: [], looted: {}, bag: { cash: 0, items: {} }, alarmAt: 0, policeAt: 0, search: null, kills: 0, otherKills: 0, contract: null, markDown: false, markGone: false, dark: false, arriveAt: performance.now() + 6000, toCome: o.raiders };
    Z.register(makeZone(job, { name: o.name }));
    Z.enter('breakin', spawn, {});
    say(`🛡️ ${o.raiders} raiders coming through the back door in a few seconds. Take cover and hold the house!`);
    return true;
  }
  function raidersArrive(now, api) {
    const j = job; if (!j?.defense || !j.toCome || now < j.arriveAt) return;
    const ex = j.L.exit, G2 = B.GUARDS.thug, k = j.guards.length;
    j.guards.push({ id: 'raider' + k, kind: 'thug', ...G2, hp: G2.hp + 10, x: ex.x + ((k % 3) - 1) * 20, y: ex.y - 34, angle: -Math.PI / 2, state: 'alert', lastSeen: { x: api.pos.x, y: api.pos.y, t: now }, route: [{ x: ex.x, y: ex.y - 60 }], reaction: now + 700 });
    j.toCome -= 1; j.arriveAt = now + 1400; api.echo(ex.x, ex.y - 30, '#ff5a6a', 'shot');
    if (!j.toCome) say('🛡️ That\'s all of them. Drop every raider, then step out the back door.');
  }
  // The back door: pick the lock (quiet) or kick it in (alarm from the first second).
  function start(target) {
    const p = P(); if (!p) return false;
    if (!target.picked && !target.kicked && root.NightshiftPicks && !job) {
      const contract = HM()?.contractFor?.(target.id) || null, left = contract ? 0 : B.cooldownLeft(state, target.id, target.type);
      if (left > 0) { say(`🔒 They've beefed up security since last time · try again in ${Math.ceil(left / 60000)} min`); return false; }
      const watch = setInterval(() => { if (!root.NightshiftPicks.active()) { clearInterval(watch); return; } const pos = target.from === 'suburbs' ? Z.pos() : P(); if (pos && target.door && Math.hypot(pos.x - target.door.x, pos.y - target.door.y) > 100) { root.NightshiftPicks.cancel(); clearInterval(watch); say('You walked away from the door'); } }, 300);
      return root.NightshiftPicks.start({ type: target.type, seed: (hashStr(target.id) + Math.floor(Date.now() / 600000)) >>> 0, title: `PICK THE LOCK · ${String(target.name).toUpperCase()}`, sub: 'Tap in the gold · each pin takes one tap',
        onDone: (ok, pk) => { if (pk?.cancelled) return; if (ok) { try { root.NightshiftSkills?.gain('stealth', 20, 'lockpick'); } catch { /* optional */ } start({ ...target, picked: true }); } else { say('🔩 Pick snapped. You shoulder the door in · the alarm is going!'); start({ ...target, kicked: true }); } },
        alt: { label: 'KICK IT IN', fn: () => start({ ...target, kicked: true }) } });
    }
    const contract = HM()?.contractFor?.(target.id) || null;
    const left = contract ? 0 : B.cooldownLeft(state, target.id, target.type);
    if (left > 0) { say(`🔒 They've beefed up security since last time · try again in ${Math.ceil(left / 60000)} min`); return false; }
    const day = Math.floor(Date.now() / 3600000);
    const L = B.generate(target.type, (hashStr(target.id) + day * 7919) >>> 0);
    const extra = contract ? B.addMark(L, contract, B.rngOf((hashStr(contract.id) ^ L.seed) >>> 0)) : [];
    job = { id: target.id, type: target.type, L, from: target.from, door: target.door, contract, markDown: false, markGone: false, otherKills: 0, guards: [...L.guards, ...extra].map((g) => ({ ...g, angle: Math.random() * 6, state: 'patrol', ri: 0 })), looted: {}, bag: { cash: 0, items: {} }, alarmAt: 0, policeAt: 0, search: null, kills: 0, dark: (root.NightshiftEnvironment?.darkness?.(root.NightshiftEnvironment?.state?.minute ?? 720) || 0) > 0.5 };
    const def = makeZone(job, target);
    Z.register(def);
    Z.enter('breakin', L.spawn, {});
    if (target.kicked) { const now = performance.now(); setTimeout(() => { if (job) { alarm(performance.now()); hear(L.exit.x, L.exit.y - 40, 420, Z.api, 'shot'); } }, 400); void now; }
    say(contract ? `🎯 Contract: ${contract.name} is inside with ${contract.guards} bodyguard${contract.guards === 1 ? '' : 's'}. Find the gold ▼, take them down, walk out the back door. Quiet pays +50%.`
      : `🤫 ${target.name}: sneak in, search for loot (gold glints), and get out the back door. Sprinting and gunfire are loud.`);
    return true;
  }
  const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function makeZone(j, target) {
    const L = j.L, solids = [...L.walls, ...L.furniture.filter((f) => !f.flat).map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h, low: true }))];
    return {
      id: 'breakin', name: target.name, tagline: j.defense ? 'YOUR STASH HOUSE · RAID INCOMING · HOLD IT' : `${L.T.name.toUpperCase()} · STAY QUIET · LOOT IS HOT UNTIL YOU'RE OUT`, indoor: true, combat: true, fog: { cone: 1.35, len: 360, around: 66, dark: 0.82 }, w: L.w, h: L.h, bg: '#05070b', zoom: 1.05, solids,
      ground(c) {
        const r = B.rngOf(L.seed);
        const outside = L.type === 'warehouse' ? '#2b2f33' : '#2f4a2c'; R(c, outside, 0, 0, L.w, L.h);
        for (let i = 0; i < 2400; i++) R(c, L.type === 'warehouse' ? (r() < 0.5 ? '#33373b' : '#25292d') : (r() < 0.5 ? '#38563a' : '#28402a'), r() * L.w, r() * L.h, 2, 2);
        for (const R0 of L.rooms) floor(c, R0, FLOOR[R0.type] || 'wood', r);
        for (const f of L.furniture) if (f.flat) FURN_ART[f.kind]?.(c, f);
        for (const w0 of L.walls) wallArt(c, w0);
        const d = L.doors.find((q) => q.entry); R(c, '#6a4a2e', d.x - 22, d.y + 6, 44, 16); R(c, '#8a6440', d.x - 20, d.y + 8, 40, 2); // doormat / step
        R(c, '#8a7a5a', d.x - 14, d.y + 22, 28, L.h - d.y - 22); // path out
        for (const dd of L.doors) if (!dd.entry) { if (dd.h) R(c, '#3a2a1a', dd.x - B.DOOR / 2, dd.y - 3, B.DOOR, 6); else R(c, '#3a2a1a', dd.x - 3, dd.y - B.DOOR / 2, 6, B.DOOR); }
      },
      drawGround(c, t, api) {
        for (const l of L.loot) container(c, l, !!j.looted[l.id], t, api.visible(l.x, l.y));
        for (const g of j.guards) if (g.dead && !g.gone) { O(c, '#4a0e12aa', g.x + 4, g.y + 2, 14, 7); if (api.visible(g.x, g.y)) { if (g.kind === 'dog') { O(c, '#5a3a22', g.x, g.y, 12, 5); } else { R(c, g.kind === 'cop' ? '#1f3a6a' : g.kind === 'mark' ? g.color : '#2b2f33', g.x - 12, g.y - 5, 24, 10); C(c, '#c99a7a', g.x + 14, g.y, 4); } } }
      },
      props(api) { return L.furniture.filter((f) => !f.flat).map((f) => ({ y: f.y + f.h, draw: (c) => FURN_ART[f.kind]?.(c, f) })); },
      actors(api) {
        return j.guards.filter((g) => !g.dead).map((g) => (g.kind === 'dog'
          ? { x: g.x, y: g.y, draw: (c) => dogArt(c, g, performance.now() / 1000) }
          : { x: g.x, y: g.y, angle: g.angle, moving: g.moving, walkTicks: g.walk || 0, id: g.id, color: g.kind === 'cop' ? '#1f3a6a' : g.kind === 'guard' ? '#2b2f33' : g.kind === 'bodyguard' ? '#15181d' : g.kind === 'mark' ? g.color : '#7a5a3a', role: g.kind === 'cop' ? 'officer' : g.kind === 'guard' || g.kind === 'bodyguard' ? 'security' : null, armed: g.armed !== false, hp: g.hp }));
      },
      targets(api) {
        const out = [];
        for (const l of L.loot) if (!j.looted[l.id] && dist(api.pos, l) < 60) out.push({ x: l.x, y: l.y, r: 40, action: j.search?.id === l.id || j.picking === l.id ? '…' : SAFES[l.kind] ? (j.tried?.[l.id] ? 'DRILL' : 'CRACK') : 'SEARCH', label: `Search the ${({ cashjar: 'cash jar', jewelbox: 'jewellery box', gunsafe: 'gun safe', gunlocker: 'gun locker', cashbox: 'cash box', tv: 'TV', art: 'painting', product: 'product stash', chemcrate: 'chemical crate', cashpile: 'counting table' })[l.kind] || l.kind}`, use: () => startSearch(l) });
        return out;
      },
      exits: [{ x: L.exit.x, y: L.exit.y, r: 44, action: j.defense ? 'LEAVE' : 'ESCAPE', label: j.defense ? 'Back door · leaving now lets the raiders win' : 'Back door · leave with your loot', sign: 'EXIT', icon: '🚪', color: '#7cdeb5', lift: 6, use: (api) => finish(api) }],
      update(dt, now, api) { raidersArrive(now, api); guardsUpdate(dt, now, api); searchTick(now, api); if (P()?.hp <= 0 && job?.defense) { const o = job.defense; job = null; try { o.onEnd?.(false, 0); } catch { /* optional */ } return; } if (P()?.hp <= 0) { state.stats.caught += 1; persist(); if (job?.contract) { try { HM()?.resolve?.({ killed: false, alarm: true, otherKills: 0, died: true }); } catch { /* optional */ } } job = null; } },
      onNoise(x, y, radius, api, kind) { hear(x, y, radius, api, kind); },
      hit(b, api) {
        for (const g of j.guards) {
          if (g.dead) continue;
          if (Math.hypot(b.x - g.x, b.y - (g.y - 12)) < 13) {
            // Unaware targets take 2.5× (sneak attack). A one-shot takedown nobody sees doesn't trip the alarm by itself
            // (the gunshot can still be heard; suppressors help).
            const unaware = g.state !== 'alert' && g.state !== 'flee', dmg = b.dmg * (unaware ? 2.5 : 1);
            g.hp -= dmg;
            if (g.hp > 0) { g.state = 'alert'; g.lastSeen = { x: api.pos.x, y: api.pos.y, t: performance.now() }; g.reaction = Math.min(g.reaction || 0, performance.now() + 200); alarm(performance.now()); }
            else if (unaware) api.float(g.x, g.y - 46, 'SNEAK ATTACK', '#9fd0ff');
            if (g.hp <= 0) {
              g.dead = true; j.kills += 1;
              if (g.kind === 'mark') { j.markDown = true; api.float(g.x, g.y - 34, '🎯 MARK DOWN', '#ffd970'); say(`🎯 ${g.name} is down. Walk out the back door to get paid.`); try { root.NightshiftAudio?.play('impact'); } catch { /* optional */ } }
              else { j.otherKills += 1; if (g.kind !== 'dog') j.bag.cash += Math.round(20 + Math.random() * 80); api.float(g.x, g.y - 30, g.kind === 'dog' ? '🐕' : '✖', '#ff5a6a'); }
            }
            return true;
          }
        }
        return false;
      },
      drawTop(c, t, api) {
        const mk = j.contract && j.guards.find((g) => g.kind === 'mark' && !g.dead);
        if (mk && api.visible(mk.x, mk.y)) { const bob = Math.sin(t * 6) * 2, x = mk.x, y = mk.y - 44 + bob; c.save(); c.fillStyle = '#000000aa'; c.beginPath(); c.moveTo(x - 8, y - 1); c.lineTo(x + 8, y - 1); c.lineTo(x, y + 10); c.closePath(); c.fill(); c.fillStyle = '#ffd970'; c.beginPath(); c.moveTo(x - 7, y - 3); c.lineTo(x + 7, y - 3); c.lineTo(x, y + 7); c.closePath(); c.fill(); c.fillStyle = '#fff6c8'; c.fillRect(x - 4, y - 2, 4, 2); c.font = '700 9px "Chakra Petch",system-ui'; c.textAlign = 'center'; c.fillStyle = '#000'; c.fillText(mk.name.toUpperCase(), x + 1, y - 7); c.fillStyle = '#ffd970'; c.fillText(mk.name.toUpperCase(), x, y - 8); c.restore(); }
        const s = j.search; if (!s) return;
        const l = L.loot.find((q) => q.id === s.id); if (!l) return; const f = Math.min(1, (performance.now() - s.t0) / s.ms), x = api.pos.x, y = api.pos.y - 46;
        c.save(); c.fillStyle = '#05080fcc'; c.beginPath(); c.arc(x, y, 13, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#ffd970'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); c.stroke(); c.restore();
      },
      drawScreen(c, t, api, Wd, Hd) {
        // HUD strip: hot bag value + alarm countdown
        const now = performance.now(), n = Object.values(j.bag.items).reduce((a, b2) => a + b2, 0);
        c.save(); c.font = '700 12px "Chakra Petch",system-ui'; c.textAlign = 'center';
        const left = j.guards.filter((g) => !g.dead).length + (j.toCome || 0);
        const txt = j.defense ? (left ? `🛡️ RAIDERS LEFT: ${left}${j.toCome ? ` · next in ${Math.max(0, Math.ceil((j.arriveAt - now) / 1000))}s` : ''}` : '🛡️ RAID REPELLED · walk out the 🚪 back door') : j.contract ? (j.markGone ? `💨 ${j.contract.name} GOT AWAY · contract blown · 🔥 bag ${money(j.bag.cash)}` : j.markDown ? `🎯 MARK DOWN · get to the 🚪 back door to get paid ${money(j.contract.pay)}+` : `🎯 FIND ${j.contract.name.toUpperCase()} (gold ▼) · ${money(j.contract.pay)} · quiet +50%`)
          : `🔥 HOT BAG ${money(j.bag.cash)} + ${n} item${n === 1 ? '' : 's'} · get to the 🚪 back door`;
        const w2 = c.measureText(txt).width + 24; c.fillStyle = '#0d1320e0'; c.fillRect(Wd / 2 - w2 / 2, 8, w2, 24); c.fillStyle = '#ffe9a8'; c.fillText(txt, Wd / 2, 25);
        if (j.policeAt) { const left = Math.max(0, Math.ceil((j.policeAt - now) / 1000)); const flash = Math.sin(now / 150) > 0; const t2 = left > 0 ? `🚨 POLICE IN ${left}s` : '🚔 POLICE INSIDE'; c.fillStyle = flash ? '#c0202a' : '#1f3a8a'; const w3 = c.measureText(t2).width + 24; c.fillRect(Wd / 2 - w3 / 2, 36, w3, 24); c.fillStyle = '#fff'; c.fillText(t2, Wd / 2, 53); }
        c.restore();
      },
    };
  }

  // ---------------- city warehouses (night) ----------------
  const WAREHOUSES = [{ id: 'bi-wh-west', x: 790, y: 470, name: 'Westside warehouse' }, { id: 'bi-wh-docks', x: 1670, y: 1150, name: 'Dockside warehouse' }];
  // Rival crews' trap houses: open any hour, armed crew inside, product + cash + guns.
  const STASHES = [{ id: 'bi-stash-south', x: 1370, y: 1520, name: 'Southside trap house', type: 'stash' }, { id: 'bi-stash-east', x: 2110, y: 840, name: 'Eastside trap house', type: 'stash' }];
  const nightNow = () => { const m = root.NightshiftEnvironment?.state?.minute ?? 720, h = m / 60; return h >= 21 || h < 5; };
  const E = root.NightshiftEncounters;
  if (E && !E.__breakin) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 ? [...list, ...STASHES.map((w) => { const SH = root.NightshiftSafehouse; if (SH?.owns?.(w.id)) return { id: w.id, type: 'breakin', x: w.x, y: w.y, ready: true, color: '#7cdeb5', label: '🏠 YOUR STASH HOUSE', action: 'STASH', hint: 'Store product + cash · security · your crew sells for you' }; const left = B.cooldownLeft(state, w.id, 'stash'); if (SH?.canTake?.(w.id)) return { id: w.id, type: 'breakin', x: w.x, y: w.y, ready: true, color: '#ffd970', label: '🏚️ EMPTY TRAP HOUSE', action: 'TAKE OVER', hint: `Make it your stash house · ${money(root.NightshiftSafehouseData?.TAKEOVER || 12000)}` }; return { id: w.id, type: 'breakin', x: w.x, y: w.y, ready: true, color: '#ff8a7a', label: '🏚️ TRAP HOUSE', action: left && !HM()?.contractFor?.(w.id) ? 'HOT' : 'BREAK IN', hint: left ? `${w.name} · crew on edge for ${Math.ceil(left / 60000)} min` : `${w.name} · armed crew, product, cash` }; }), ...WAREHOUSES.map((w) => ({ id: w.id, type: 'breakin', x: w.x, y: w.y, ready: true, color: '#ff8a7a', label: '🔦 BACK DOOR', action: nightNow() || HM()?.contractFor?.(w.id) ? 'BREAK IN' : 'LOCKED', hint: `${w.name} · break in at night (21:00–05:00)` }))] : list; };
    E.use = function (id) {
      const sh = STASHES.find((q) => q.id === id);
      if (sh && (root.NightshiftSafehouse?.owns?.(sh.id) || root.NightshiftSafehouse?.canTake?.(sh.id))) { root.NightshiftSafehouse.open(sh.id); return true; }
      if (sh) { start({ id: sh.id, type: 'stash', name: sh.name, from: 'city', door: { x: sh.x, y: sh.y } }); return true; }
      const w = WAREHOUSES.find((q) => q.id === id);
      if (w) { if (!nightNow() && !HM()?.contractFor?.(w.id)) { say('🔒 Too many workers around. Come back after 21:00.'); return true; } start({ id: w.id, type: 'warehouse', name: w.name, from: 'city', door: { x: w.x, y: w.y } }); return true; }
      return use.apply(this, arguments);
    };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawDoors(); } catch { /* cosmetic */ } return r; };
    E.__breakin = true;
  }
  function drawDoors() {
    const ctx = G(), p = P(); if (!ctx || !p) return;
    for (const w of STASHES) {
      if (Math.abs(p.x - w.x) > 700 || Math.abs(p.y - w.y) > 500) continue;
      const x = w.x, y = w.y, hot = B.cooldownLeft(state, w.id, 'stash') > 0, ct = HM()?.contractFor?.(w.id), mine = root.NightshiftSafehouse?.owns?.(w.id);
      if (mine) { R(ctx, '#1d2126', x - 14, y - 36, 28, 32); R(ctx, '#5d646b', x - 12, y - 34, 24, 28); R(ctx, '#9aa3ab', x - 12, y - 34, 24, 2); C(ctx, '#ffd970', x + 7, y - 20, 1.6); R(ctx, '#2b2f33', x - 8, y - 28, 16, 3); if (root.NightshiftSafehouse.secLevel?.(w.id, 'cameras')) { R(ctx, '#1b1e22', x + 12, y - 44, 6, 4); C(ctx, Math.sin(performance.now() / 300) > 0 ? '#7cdeb5' : '#1b4a3a', x + 16, y - 42, 1); } root.NightshiftSign?.(ctx, x, y - 52, '🏠', root.NightshiftSafehouse.alert?.(w.id) ? 'YOUR STASH · RAID!' : 'YOUR STASH HOUSE', root.NightshiftSafehouse.alert?.(w.id) ? '#ff5a6a' : '#7cdeb5', { glow: true }); continue; }
      // boarded-up door: plywood, spray tag, a camera, trash bags
      R(ctx, '#2a2420', x - 14, y - 36, 28, 32); R(ctx, '#8a6a40', x - 12, y - 34, 24, 28); for (let k = 0; k < 3; k++) R(ctx, '#6a4a2a', x - 12, y - 30 + k * 9, 24, 2); R(ctx, '#b84a8a', x - 9, y - 24, 10, 3); R(ctx, '#7cdeb5', x - 2, y - 18, 8, 2);
      R(ctx, '#1b1e22', x + 12, y - 44, 6, 4); C(ctx, '#e0473a', x + 16, y - 42, 1); R(ctx, '#11161a', x - 26, y - 10, 10, 9); R(ctx, '#11161a', x - 18, y - 8, 8, 8);
      root.NightshiftSign?.(ctx, x, y - 52, ct ? '🎯' : '🏚️', ct ? 'CONTRACT · GO IN' : hot ? 'TRAP HOUSE · HOT' : 'TRAP HOUSE · BREAK IN', ct ? '#ffd970' : hot ? '#7d8796' : '#ff8a7a', ct ? { glow: true } : undefined);
    }
    for (const w of WAREHOUSES) {
      if (Math.abs(p.x - w.x) > 700 || Math.abs(p.y - w.y) > 500) continue;
      const x = w.x, y = w.y;
      R(ctx, '#2a2d30', x - 13, y - 34, 26, 30); R(ctx, '#4a5058', x - 11, y - 32, 22, 26); R(ctx, '#9aa3ab', x + 5, y - 20, 3, 3); R(ctx, '#c9b14a', x - 13, y - 36, 26, 3);
      if (HM()?.contractFor?.(w.id)) { C(ctx, '#ffd970', x + 9, y - 30, 2); root.NightshiftSign?.(ctx, x, y - 48, '🎯', 'CONTRACT · GO IN', '#ffd970', { glow: true }); continue; }
      const lockedC = B.cooldownLeft(state, w.id, 'warehouse') > 0;
      C(ctx, nightNow() && !lockedC ? '#7cdeb5' : '#ff5a6a', x + 9, y - 30, 1.6);
      root.NightshiftSign?.(ctx, x, y - 48, '🔦', lockedC ? 'BACK DOOR · HOT' : nightNow() ? 'BACK DOOR · BREAK IN' : 'BACK DOOR · NIGHTS', nightNow() && !lockedC ? '#ff8a7a' : '#7d8796');
    }
  }

  root.NightshiftBreakin = Object.freeze({ STASHES, defend, start, get state() { return state; }, active: () => !!job, debug: () => job, WAREHOUSES, cooldownLeft: (id, type) => B.cooldownLeft(state, id, type) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
