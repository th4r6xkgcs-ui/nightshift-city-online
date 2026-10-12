/* Break-ins (Claude-owned). Pure and Node-testable; breakin.js runs it in a zone with fog of war.
 * generate(type, seed) builds an interior: a grid of rooms joined by doorways (a spanning tree + a few loops so
 * there's more than one way round), typed furniture, loot containers and guards with patrol routes.
 * Types: 'house' (suburbs; homeowner and maybe a dog), 'mansion' (guards, safes, art), 'warehouse' (city; armed
 * guards, gun parts). Loot tables are fictional game items; selling happens at the pawn shop / arms buyer. */
(function (root) {
  'use strict';
  const rngOf = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const TYPES = {
    house: { cols: 3, rows: 2, rw: 210, rh: 175, guards: [['owner', 1], ['dog', 0.5]], loot: 7, cooldown: 25, heat: 1.2, police: 55, name: 'House' },
    mansion: { cols: 4, rows: 3, rw: 220, rh: 185, guards: [['guard', 3], ['dog', 1]], loot: 12, cooldown: 45, heat: 2.2, police: 70, name: 'Mansion' },
    warehouse: { cols: 3, rows: 2, rw: 250, rh: 200, guards: [['guard', 2], ['guard', 0.6]], loot: 9, cooldown: 35, heat: 1.8, police: 60, name: 'Warehouse' },
    // A rival crew's trap house: product, cash being counted, guns. Cops take their time coming here.
    stash: { cols: 3, rows: 2, rw: 215, rh: 180, guards: [['thug', 2], ['thug', 0.7], ['dog', 0.4]], loot: 10, cooldown: 40, heat: 1.4, police: 90, name: 'Stash house' },
  };
  const ROOMS = {
    house: ['kitchen', 'living', 'bedroom', 'bedroom', 'bath', 'office'],
    mansion: ['foyer', 'living', 'kitchen', 'dining', 'bedroom', 'bedroom', 'office', 'gallery', 'bath', 'gym', 'vault', 'lounge'],
    warehouse: ['loading', 'storage', 'storage', 'office', 'armory', 'storage'],
    stash: ['trap', 'cook', 'count', 'bedroom', 'storage', 'cook'],
  };
  // Furniture per room: [kind, w, h, anchor] — anchor: 'n' along top wall, 's' bottom, 'w'/'e' sides, 'c' centre.
  const FURN = {
    kitchen: [['counter', 120, 26, 'n'], ['fridge', 30, 28, 'ne'], ['table', 60, 40, 'c']],
    living: [['sofa', 90, 34, 's'], ['tv', 70, 16, 'n'], ['rug', 100, 60, 'c', 1], ['plant', 18, 18, 'nw']],
    bedroom: [['bed', 70, 90, 'w'], ['dresser', 60, 24, 'n'], ['rug', 60, 40, 'c', 1]],
    bath: [['tub', 70, 34, 'n'], ['sink', 30, 22, 'e']],
    office: [['desk', 80, 34, 'n'], ['shelf', 26, 80, 'e'], ['chair', 22, 22, 'c']],
    foyer: [['rug', 120, 70, 'c', 1], ['plant', 18, 18, 'nw'], ['plant', 18, 18, 'ne']],
    dining: [['longtable', 120, 50, 'c'], ['cabinet', 70, 24, 'n']],
    gallery: [['pedestal', 26, 26, 'c'], ['bench', 70, 20, 's']],
    gym: [['weights', 60, 30, 'n'], ['treadmill', 34, 70, 'w']],
    vault: [['vaultdoor', 70, 20, 'n']],
    lounge: [['sofa', 90, 34, 'n'], ['bar', 26, 90, 'e'], ['rug', 90, 50, 'c', 1]],
    loading: [['crates', 70, 60, 'ne'], ['forklift', 40, 54, 'w']],
    storage: [['rack', 150, 22, 'n'], ['rack', 150, 22, 'c'], ['crates', 50, 40, 'se']],
    armory: [['rack', 120, 22, 'n'], ['crates', 60, 40, 'c']],
    trap: [['sofa', 90, 34, 's'], ['tv', 70, 16, 'n'], ['rug', 90, 56, 'c', 1], ['mattress', 60, 40, 'w']],
    cook: [['labtable', 120, 28, 'n'], ['labtable', 100, 28, 'c'], ['barrels', 40, 40, 'se']],
    count: [['counttable', 96, 52, 'c'], ['shelf', 26, 80, 'e'], ['chair', 22, 22, 'w']],
  };
  // Loot containers by room type: [kind, chance]
  const CONTAINERS = {
    kitchen: [['drawer', 0.8], ['cashjar', 0.5]], living: [['tv', 0.7], ['drawer', 0.5]], bedroom: [['jewelbox', 0.8], ['nightstand', 0.7], ['gunsafe', 0.15]],
    bath: [['cabinet', 0.6]], office: [['desk', 0.8], ['safe', 0.45]], foyer: [['drawer', 0.4]], dining: [['silver', 0.7]], gallery: [['art', 0.9], ['art', 0.7]],
    gym: [['locker', 0.6]], vault: [['safe', 1], ['safe', 0.7]], lounge: [['cashbox', 0.7], ['art', 0.4]],
    loading: [['crate', 0.8]], storage: [['crate', 0.9], ['crate', 0.6]], armory: [['gunlocker', 1], ['ammo', 0.9]],
    trap: [['drawer', 0.6], ['cashjar', 0.6]], cook: [['product', 1], ['product', 0.6], ['chemcrate', 0.8]], count: [['cashpile', 1], ['safe', 0.7]],
  };
  // seconds to search; loot: [item, chance, min, max] with item 'cash' for money.
  const LOOT = {
    drawer: { seconds: 2.5, loot: [['cash', 0.7, 20, 90], ['metal', 0.3, 1, 2], ['tape', 0.3, 1, 1]] },
    cashjar: { seconds: 2, loot: [['cash', 1, 15, 70]] },
    nightstand: { seconds: 2.5, loot: [['cash', 0.6, 30, 120], ['jewels', 0.3, 1, 1], ['pills', 0.2, 1, 3]] },
    jewelbox: { seconds: 3.5, loot: [['jewels', 1, 1, 3], ['cash', 0.3, 40, 150]] },
    tv: { seconds: 4, loot: [['gadgets', 1, 1, 1]] },
    cabinet: { seconds: 2, loot: [['chem', 0.5, 1, 1], ['pills', 0.4, 1, 2], ['baggie', 0.4, 2, 5]] },
    desk: { seconds: 3, loot: [['cash', 0.8, 50, 200], ['gadgets', 0.5, 1, 1], ['lens', 0.1, 1, 1]] },
    safe: { seconds: 12, loot: [['cash', 1, 400, 1400], ['jewels', 0.6, 1, 4]] },
    gunsafe: { seconds: 9, loot: [['barrel', 0.5, 1, 1], ['trigger', 0.5, 1, 1], ['frame', 0.25, 1, 1], ['ammo', 0.8, 12, 30]] },
    silver: { seconds: 4, loot: [['jewels', 0.8, 1, 2], ['cash', 0.3, 60, 160]] },
    art: { seconds: 5, loot: [['art', 1, 1, 1]] },
    locker: { seconds: 3, loot: [['cash', 0.5, 30, 120], ['spring', 0.3, 1, 2]] },
    cashbox: { seconds: 4, loot: [['cash', 1, 150, 500]] },
    crate: { seconds: 4, loot: [['metal', 0.8, 2, 4], ['spring', 0.5, 1, 2], ['pipe', 0.4, 1, 1], ['barrel', 0.12, 1, 1], ['chem', 0.25, 1, 2]] },
    gunlocker: { seconds: 8, loot: [['barrel', 0.7, 1, 2], ['trigger', 0.7, 1, 1], ['bolt', 0.5, 1, 1], ['frame', 0.4, 1, 1], ['lens', 0.3, 1, 1]] },
    ammo: { seconds: 3, loot: [['ammo', 1, 20, 45]] },
    product: { seconds: 4, loot: [['weed', 0.8, 2, 5], ['coke', 0.5, 1, 3], ['pills', 0.5, 3, 8]] },
    chemcrate: { seconds: 3, loot: [['chem', 1, 2, 4], ['baggie', 0.8, 4, 10]] },
    cashpile: { seconds: 6, loot: [['cash', 1, 350, 1100]] },
  };
  // What the pawn shop pays for stolen goods (per unit).
  const FENCE = { jewels: 180, gadgets: 140, art: 650 };
  const GUARDS = {
    owner: { hp: 45, dmg: 9, rate: 900, spread: 0.14, speed: 1.15, sight: 230, cone: 1.3, armed: true, name: 'Homeowner' },
    dog: { hp: 30, dmg: 7, rate: 700, spread: 0, speed: 2.1, sight: 170, cone: 2.4, armed: false, melee: true, name: 'Guard dog' },
    guard: { hp: 70, dmg: 11, rate: 650, spread: 0.1, speed: 1.3, sight: 260, cone: 1.25, armed: true, name: 'Guard' },
    cop: { hp: 80, dmg: 12, rate: 600, spread: 0.09, speed: 1.6, sight: 300, cone: 1.5, armed: true, name: 'Police' },
    // Hitman contracts (hitman-data.js): the mark and the muscle they hired.
    thug: { hp: 60, dmg: 10, rate: 700, spread: 0.12, speed: 1.3, sight: 240, cone: 1.3, armed: true, name: 'Crew member' },
    mark: { hp: 60, dmg: 8, rate: 850, spread: 0.18, speed: 1.1, sight: 220, cone: 1.3, armed: true, name: 'Mark' },
    bodyguard: { hp: 85, dmg: 12, rate: 620, spread: 0.09, speed: 1.35, sight: 270, cone: 1.35, armed: true, name: 'Bodyguard' },
  };
  // Where the mark spends their time: the room furthest (by doorways) from the back door.
  function farRoom(L) {
    const adj = {}; for (const d of L.doors) if (!d.entry) { (adj[d.a] = adj[d.a] || []).push(d.b); (adj[d.b] = adj[d.b] || []).push(d.a); }
    const dist = { [L.entryRoom]: 0 }, q = [L.entryRoom];
    while (q.length) { const c = q.shift(); for (const n of adj[c] || []) if (!(n in dist)) { dist[n] = dist[c] + 1; q.push(n); } }
    let best = L.rooms[0]; for (const R0 of L.rooms) if ((dist[R0.i] ?? -1) > (dist[best.i] ?? -1)) best = R0;
    return best;
  }
  // Adds the contract's mark + bodyguards to a generated layout (pure; same seed → same placement).
  function addMark(L, c, rnd = Math.random) {
    const home = farRoom(L), adj = L.doors.filter((d) => !d.entry && (d.a === home.i || d.b === home.i)).map((d) => (d.a === home.i ? d.b : d.a));
    const near = L.rooms[adj.length ? adj[Math.floor(rnd() * adj.length)] : home.i];
    const pt = (R0) => ({ x: Math.round(R0.x + R0.w / 2 + (rnd() - 0.5) * 60), y: Math.round(R0.y + R0.h / 2 + (rnd() - 0.5) * 40), room: R0.i });
    const route = [pt(home), pt(home), pt(near)];
    const mark = { id: 'mark', ...GUARDS.mark, kind: 'mark', hp: c.hp || GUARDS.mark.hp, armed: c.armed !== false, x: route[0].x, y: route[0].y, route, name: c.name || 'Mark', color: c.color || '#7a2a2a' };
    const out = [mark];
    for (let k = 0; k < (c.guards | 0); k++) { const r2 = [pt(k % 2 ? near : home), pt(home)]; out.push({ id: 'bg' + k, kind: 'bodyguard', ...GUARDS.bodyguard, x: r2[0].x, y: r2[0].y, route: r2 }); }
    return out;
  }
  const WALL = 12, PAD = 70, DOOR = 52;

  function generate(type = 'house', seed = 1) {
    const T = TYPES[type] || TYPES.house, r = rngOf(seed), { cols, rows, rw, rh } = T;
    const w = PAD * 2 + cols * rw, h = PAD * 2 + rows * rh + 40;
    const rooms = [];
    const types = (ROOMS[type] || ROOMS.house).slice();
    for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
    for (let ry = 0; ry < rows; ry++) for (let rx = 0; rx < cols; rx++) rooms.push({ i: rooms.length, cx: rx, cy: ry, x: PAD + rx * rw, y: PAD + ry * rh, w: rw, h: rh, type: types[(ry * cols + rx) % types.length] });
    const idx = (cx, cy) => cy * cols + cx;
    // spanning tree (randomized DFS) + loops
    const links = new Set(), key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    const seen = new Set([0]), stack = [0];
    while (stack.length) {
      const cur = stack[stack.length - 1], R0 = rooms[cur];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [R0.cx + dx, R0.cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows).map(([x, y]) => idx(x, y)).filter((n) => !seen.has(n));
      if (!nb.length) { stack.pop(); continue; }
      const n = nb[Math.floor(r() * nb.length)]; links.add(key(cur, n)); seen.add(n); stack.push(n);
    }
    for (let i = 0; i < rooms.length; i++) for (const [dx, dy] of [[1, 0], [0, 1]]) { const a = rooms[i], bx = a.cx + dx, by = a.cy + dy; if (bx < cols && by < rows && r() < 0.3) links.add(key(i, idx(bx, by))); }
    // walls: outer box + interior edges with door gaps
    const walls = [], doors = [];
    const X0 = PAD, Y0 = PAD, X1 = PAD + cols * rw, Y1 = PAD + rows * rh;
    const entryRoom = rooms[idx(Math.floor(r() * cols), rows - 1)];
    const ex = entryRoom.x + entryRoom.w / 2;
    walls.push({ x: X0 - WALL / 2, y: Y0 - WALL / 2, w: X1 - X0 + WALL, h: WALL, wall: true }); // top
    walls.push({ x: X0 - WALL / 2, y: Y0, w: WALL, h: Y1 - Y0, wall: true }); walls.push({ x: X1 - WALL / 2, y: Y0, w: WALL, h: Y1 - Y0, wall: true });
    walls.push({ x: X0 - WALL / 2, y: Y1 - WALL / 2, w: ex - DOOR / 2 - X0 + WALL / 2, h: WALL, wall: true });
    walls.push({ x: ex + DOOR / 2, y: Y1 - WALL / 2, w: X1 - ex - DOOR / 2 + WALL / 2, h: WALL, wall: true });
    doors.push({ x: ex, y: Y1, h: true, entry: true });
    for (let ry = 0; ry < rows; ry++) for (let rx = 0; rx < cols; rx++) {
      const a = rooms[idx(rx, ry)];
      if (rx < cols - 1) { const b = idx(rx + 1, ry), xx = a.x + a.w, open = links.has(key(a.i, b)), dy = a.y + a.h / 2 + (r() - 0.5) * (a.h - DOOR - 40);
        if (open) { walls.push({ x: xx - WALL / 2, y: a.y, w: WALL, h: dy - DOOR / 2 - a.y, wall: true }); walls.push({ x: xx - WALL / 2, y: dy + DOOR / 2, w: WALL, h: a.y + a.h - dy - DOOR / 2, wall: true }); doors.push({ x: xx, y: dy, h: false, a: a.i, b }); }
        else walls.push({ x: xx - WALL / 2, y: a.y, w: WALL, h: a.h, wall: true }); }
      if (ry < rows - 1) { const b = idx(rx, ry + 1), yy = a.y + a.h, open = links.has(key(a.i, b)), dx = a.x + a.w / 2 + (r() - 0.5) * (a.w - DOOR - 40);
        if (open) { walls.push({ x: a.x, y: yy - WALL / 2, w: dx - DOOR / 2 - a.x, h: WALL, wall: true }); walls.push({ x: dx + DOOR / 2, y: yy - WALL / 2, w: a.x + a.w - dx - DOOR / 2, h: WALL, wall: true }); doors.push({ x: dx, y: yy, h: true, a: a.i, b }); }
        else walls.push({ x: a.x, y: yy - WALL / 2, w: a.w, h: WALL, wall: true }); }
    }
    // furniture (keeps doorways clear)
    const furniture = [], nearDoor = (x, y, w2, h2) => doors.some((d) => x < d.x + DOOR && x + w2 > d.x - DOOR && y < d.y + DOOR && y + h2 > d.y - DOOR);
    for (const R0 of rooms) {
      for (const [kind, fw, fh, anchor, flat] of FURN[R0.type] || []) {
        const m = 18, ix = R0.x + m, iy = R0.y + m, iw = R0.w - 2 * m, ih = R0.h - 2 * m;
        let x = ix + (iw - fw) / 2, y = iy + (ih - fh) / 2;
        if (anchor.includes('n')) y = iy; if (anchor.includes('s')) y = iy + ih - fh; if (anchor.includes('w')) x = ix; if (anchor.includes('e')) x = ix + iw - fw;
        if (anchor === 'c') { x += (r() - 0.5) * 30; y += (r() - 0.5) * 20; }
        if (!flat && nearDoor(x, y, fw, fh)) continue;
        furniture.push({ x: Math.round(x), y: Math.round(y), w: fw, h: fh, kind, room: R0.i, flat: !!flat });
      }
    }
    // loot containers
    const loot = []; let n = 0;
    const spots = rooms.flatMap((R0) => (CONTAINERS[R0.type] || []).map(([kind, ch]) => ({ R0, kind, ch })));
    for (const s of spots) {
      if (r() > s.ch || n >= T.loot) continue;
      const R0 = s.R0; let x = 0, y = 0, tries = 0;
      do { x = R0.x + 34 + r() * (R0.w - 68); y = R0.y + 34 + r() * (R0.h - 68); tries++; } while (tries < 20 && furniture.some((f) => !f.flat && x > f.x - 14 && x < f.x + f.w + 14 && y > f.y - 14 && y < f.y + f.h + 14));
      loot.push({ id: 'l' + n++, kind: s.kind, x: Math.round(x), y: Math.round(y), room: R0.i, ...LOOT[s.kind] });
    }
    // guards: never in the entry room at the start
    const guards = []; let gi = 0;
    for (const [kind, chance] of T.guards) {
      const count = chance >= 1 ? chance : r() < chance ? 1 : 0;
      for (let k = 0; k < count; k++) {
        const pool = rooms.filter((R0) => R0.i !== entryRoom.i), R0 = pool[Math.floor(r() * pool.length)];
        const route = [R0, rooms[(R0.i + 1 + Math.floor(r() * (rooms.length - 1))) % rooms.length]].map((q) => ({ x: q.x + q.w / 2 + (r() - 0.5) * 50, y: q.y + q.h / 2 + (r() - 0.5) * 40, room: q.i }));
        guards.push({ id: 'g' + gi++, kind, x: route[0].x, y: route[0].y, route, ...GUARDS[kind] });
      }
    }
    const spawn = { x: ex, y: Y1 + 34, angle: -Math.PI / 2 };
    return { type, seed, w, h, rooms, walls, doors, furniture, loot, guards, spawn, exit: { x: ex, y: Y1 + 26 }, entryRoom: entryRoom.i, T };
  }
  // Room graph path (room centres via doorway points) for guard movement.
  function roomAt(L, x, y) { return L.rooms.find((R0) => x >= R0.x && x <= R0.x + R0.w && y >= R0.y && y <= R0.y + R0.h) || null; }
  function path(L, from, to) {
    const a = roomAt(L, from.x, from.y), b = roomAt(L, to.x, to.y);
    if (!a || !b || a.i === b.i) return [to];
    const adj = {}; for (const d of L.doors) if (!d.entry) { (adj[d.a] = adj[d.a] || []).push([d.b, d]); (adj[d.b] = adj[d.b] || []).push([d.a, d]); }
    const prev = { [a.i]: null }, q = [a.i];
    while (q.length) { const c = q.shift(); if (c === b.i) break; for (const [nb, d] of adj[c] || []) if (!(nb in prev)) { prev[nb] = [c, d]; q.push(nb); } }
    if (!(b.i in prev)) return [to];
    const pts = []; let c = b.i; while (prev[c]) { const [p2, d] = prev[c]; pts.unshift({ x: d.x, y: d.y }); c = p2; }
    pts.push(to); return pts;
  }
  function connected(L) { const start = L.entryRoom, seen = new Set([start]), q = [start]; while (q.length) { const c = q.shift(); for (const d of L.doors) { if (d.entry) continue; const o = d.a === c ? d.b : d.b === c ? d.a : null; if (o !== null && !seen.has(o)) { seen.add(o); q.push(o); } } } return seen.size === L.rooms.length; }
  function rollLoot(kind, rnd = Math.random, luck = 1) {
    const t = LOOT[kind]; if (!t) return { cash: 0, items: {} };
    let cash = 0; const items = {};
    t.loot.forEach(([it, ch, a, b], i) => { const c = i === 0 ? ch : Math.min(0.95, ch * luck); if (rnd() < c) { const n = a + Math.floor(rnd() * (b - a + 1)); if (it === 'cash') cash += n; else items[it] = (items[it] || 0) + n; } });
    return { cash, items };
  }
  function cooldownLeft(state, id, type, now = Date.now()) { const t = state?.robbed?.[id]; if (!t) return 0; return Math.max(0, t + (TYPES[type]?.cooldown || 30) * 60000 - now); }
  function clean(raw, now = Date.now()) {
    const s = { version: 1, robbed: {}, stats: { jobs: 0, clean: 0, loot: 0, kills: 0, caught: 0, trap: 0 } };
    for (const [id, t] of Object.entries(raw?.robbed || {})) if (typeof id === 'string' && Number.isFinite(t) && t <= now) s.robbed[id] = t;
    for (const k of Object.keys(s.stats)) { const v = raw?.stats?.[k]; s.stats[k] = Number.isSafeInteger(v) && v >= 0 ? Math.min(v, 1e9) : 0; }
    return s;
  }

  const api = Object.freeze({ TYPES, ROOMS, FURN, CONTAINERS, LOOT, FENCE, GUARDS, WALL, PAD, DOOR, generate, roomAt, path, connected, farRoom, addMark, rollLoot, cooldownLeft, clean, rngOf });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftBreakinData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
