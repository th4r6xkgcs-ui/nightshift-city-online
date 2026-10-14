/* Car collection (Claude-owned). Pure and Node-testable; cars.js runs it in game.
 * Ten fictional models from a beater hatch to a hypercar, plus (v0.66) six real cars from Nightshift Garage. Each has its own top-down pixel art (cars.js),
 * real handling (accel / top speed / steering / armor) and a price at Prestige Motors in Palm Grove.
 * Rare models also turn up parked in the city now and then: steal one, then keep it (re-VIN at Rusty's) or chop it.
 * The collection book pays milestone bonuses for owning different models.
 * A car you own is a record { uid, id (model), color, x, y, angle, fuel, condition, plate }. */
(function (root) {
  'use strict';
  // accel/max/steer replace the base game's MODELS values (COMPACT .24/6.5/.044, SEDAN .22/7/.038, VAN .17/5.5/.032).
  const CARS = [
    { id: 'brick', name: 'Brick Hatch', body: 'hatch', tier: 'Street', price: 5200, accel: 0.26, max: 7.0, steer: 0.048, armor: 1, chop: 900, len: 50, wid: 27, colors: ['#c84659', '#3d7fc6', '#e2b75c', '#e8e6e0'], desc: 'Tiny, nimble, parks anywhere. Everybody\'s first real car.' },
    { id: 'mule', name: 'Mule Pickup', body: 'pickup', tier: 'Work', price: 7800, accel: 0.21, max: 6.8, steer: 0.036, armor: 1.25, chop: 1400, len: 62, wid: 30, colors: ['#6a7a5a', '#b9482f', '#e8e2d0', '#2b4a6e'], desc: 'Workhorse with a cargo bed. Shrugs off bumps.' },
    { id: 'ridgeback', name: 'Ridgeback 4x4', body: 'suv', tier: 'Street', price: 16000, accel: 0.23, max: 7.4, steer: 0.037, armor: 1.4, chop: 2600, len: 60, wid: 31, colors: ['#1d2433', '#f1efe8', '#4a5a3e', '#7a2e3a'], desc: 'Big, boxy, armored-feeling. Rams through trouble.' },
    { id: 'bulldog', name: 'Bulldog V8', body: 'muscle', tier: 'Muscle', price: 22000, accel: 0.31, max: 8.3, steer: 0.035, armor: 1.1, chop: 3800, len: 62, wid: 30, colors: ['#e0473a', '#1d2433', '#e3c25a', '#2f6b9a'], desc: 'Long hood, twin stripes, all torque. Turns like a boat.' },
    { id: 'kestrel', name: 'Kestrel Rally', body: 'rally', tier: 'Sport', price: 29000, accel: 0.3, max: 8.0, steer: 0.053, armor: 1, chop: 4600, len: 54, wid: 28, colors: ['#f1efe8', '#3d7fd0', '#e86a2a', '#2f8f6a'], desc: 'Rally-bred hatch with a light pod. Corners like it\'s on rails.' },
    { id: 'monarch', name: 'Monarch \'62', body: 'classic', tier: 'Classic', price: 36000, accel: 0.22, max: 7.6, steer: 0.036, armor: 1.15, chop: 6000, len: 64, wid: 30, rare: true, colors: ['#7fc8c0', '#e8d8b0', '#c84659', '#2b3f6e'], desc: 'Chrome, curves and whitewalls. A collector\'s piece.' },
    { id: 'velvet', name: 'Velvet Lowrider', body: 'lowrider', tier: 'Classic', price: 41000, accel: 0.21, max: 7.2, steer: 0.034, armor: 1.1, chop: 6500, len: 66, wid: 29, colors: ['#6a2a8a', '#b8232f', '#1f6a5a', '#d8a020'], desc: 'Candy paint, gold pinstripes, a chrome grin. Slow and proud.' },
    { id: 'aurora', name: 'Aurora GT', body: 'gt', tier: 'Exotic', price: 68000, accel: 0.35, max: 9.0, steer: 0.047, armor: 1, chop: 11000, len: 60, wid: 29, colors: ['#2a5a8a', '#c0c6cc', '#1d2433', '#8a1f2a'], desc: 'A long-nosed grand tourer. Fast and composed.' },
    { id: 'vortex', name: 'Vortex R', body: 'super', tier: 'Super', price: 145000, accel: 0.4, max: 9.8, steer: 0.05, armor: 0.95, chop: 22000, len: 60, wid: 31, rare: true, colors: ['#ff8a1a', '#e3c25a', '#8fd14f', '#d0202a'], desc: 'Wedge-shaped supercar with a rear wing. Pure speed.' },
    // v0.66: brought over from Nightshift Garage (same cars, real names), with top-down city models + city handling.
    // Garage specs mapped to city stats: top speed (km/h) -> max, power-to-weight -> accel; drive = drivetrain.
    { id: 'm4', name: 'BMW M4 F82', body: 'coupe', tier: 'Sport', price: 52000, accel: 0.33, max: 8.3, steer: 0.047, armor: 1.05, chop: 8500, len: 56, wid: 28, drive: 'RWD', kmh: 280, hp: 425, garage: 'bmw-m4-f82', colors: ['#4790e8', '#1d2024', '#e8eef3', '#c84659'], desc: 'S55 twin-turbo straight six, six-speed manual, rear-drive. Planted and quick.' },
    { id: 'civic', name: 'Honda Civic EF', body: 'hatch', tier: 'Street', price: 9500, accel: 0.28, max: 7.3, steer: 0.052, armor: 0.95, chop: 1600, len: 50, wid: 26, drive: 'FWD', kmh: 218, hp: 158, garage: 'honda-civic-ef9', colors: ['#d2d8c6', '#c84659', '#1d2433', '#e8e6e0'], desc: 'B16A VTEC, 8,200 rpm, front-drive, featherweight. Hold it in VTEC.' },
    { id: 'charger', name: 'Dodge Charger 440', body: 'muscle', tier: 'Muscle', price: 38000, accel: 0.32, max: 8.4, steer: 0.034, armor: 1.2, chop: 6400, len: 66, wid: 31, drive: 'RWD', kmh: 242, hp: 375, stripes: false, garage: 'dodge-charger-1969', colors: ['#f79148', '#1d2024', '#8a1f2a', '#e8e2d0'], desc: '1969 R/T, 440 Magnum V8, hidden headlights. All torque, no apologies.' },
    { id: 's15', name: 'Nissan Silvia S15', body: 'coupe', tier: 'Sport', price: 34000, accel: 0.34, max: 8.6, steer: 0.055, armor: 1, chop: 5800, len: 54, wid: 27, drive: 'RWD', kmh: 264, hp: 247, wing: 'drift', garage: 'nissan-silvia-s15', colors: ['#67ccaa', '#f1efe8', '#1d2024', '#e0473a'], desc: 'Spec-R, SR20DET turbo, rear-drive. Born to go sideways.' },
    { id: 'vandal', name: 'Vandal GT', body: 'coupe', tier: 'Sport', price: 52000, accel: 0.36, max: 9.0, steer: 0.056, armor: 1, chop: 8200, len: 55, wid: 29, drive: 'RWD', kmh: 282, hp: 380, colors: ['#8a3fd6', '#16181d', '#f1efe8', '#2f6bd0'], o3: { kit: 'wide', spoiler: 'gt', rims: 'black', hood: 'carbon', lights: 'ice', stance: 'lowered', tint: '2' }, desc: 'Option 3 golden sample. Widebody tuner coupe: riveted overfenders, carbon hood, GT wing, deep multi-spoke rims.' },
    { id: 'mustang', name: 'Ford Mustang GT', body: 'muscle', tier: 'Muscle', price: 46000, accel: 0.36, max: 8.9, steer: 0.04, armor: 1.1, chop: 7600, len: 62, wid: 30, drive: 'RWD', kmh: 288, hp: 435, garage: 'ford-mustang-s550', colors: ['#b18bdc', '#c84659', '#1d2433', '#f1efe8'], desc: '2015 GT, 5.0 Coyote V8, six-speed. Tri-bar tails and a big voice.' },
    { id: 'gallardo', name: 'Lamborghini Gallardo', body: 'super', tier: 'Super', price: 165000, accel: 0.42, max: 9.6, steer: 0.05, armor: 0.95, chop: 26000, len: 58, wid: 31, drive: 'AWD', kmh: 315, hp: 552, wing: false, rare: true, garage: 'lamborghini-gallardo', colors: ['#eb6760', '#e3c25a', '#8fd14f', '#1d2024'], desc: 'LP560-4, naturally aspirated V10, all-wheel drive. Screams to 8,000.' },
    { id: 'phantom', name: 'Phantom Zero', body: 'hyper', tier: 'Hyper', price: 290000, accel: 0.45, max: 10.6, steer: 0.053, armor: 0.95, chop: 40000, len: 62, wid: 31, rare: true, colors: ['#e8eef4', '#101418', '#3ad0ff', '#9a5aff'], desc: 'Teardrop canopy, glowing light strips, active aero. The top of the food chain.' },
  ];
  const BY = Object.fromEntries(CARS.map((c) => [c.id, c]));
  const TIERS = ['Work', 'Street', 'Muscle', 'Sport', 'Classic', 'Exotic', 'Super', 'Hyper'];
  const TIER_POINTS = { Work: 1, Street: 1, Muscle: 2, Sport: 2, Classic: 3, Exotic: 4, Super: 6, Hyper: 10 };
  const MILESTONES = [{ n: 3, cash: 5000, title: 'Car Guy' }, { n: 6, cash: 20000, title: 'Collector' }, { n: 10, cash: 100000, title: 'Curator' }];
  const MAX_OWNED = 12;
  const SPAWN_WINDOW = 25 * 60 * 1000;
  const MODEL_PREFIX = 'CX:';

  const modelName = (id) => MODEL_PREFIX + id;
  const fromModel = (m) => (typeof m === 'string' && m.startsWith(MODEL_PREFIX) ? BY[m.slice(MODEL_PREFIX.length)] || null : null);
  const hex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  const plateOf = (n) => { let s = (n >>> 0) || 1; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; const L = 'ABCDEFGHJKLMNPRSTUVWXYZ'; return `${L[Math.floor(r() * 23)]}${L[Math.floor(r() * 23)]}${L[Math.floor(r() * 23)]} ${100 + Math.floor(r() * 900)}`; };

  function clean(raw) {
    const s = { version: 1, owned: [], seen: {}, paid: [], next: 1, bought: 0, spent: 0 };
    const list = Array.isArray(raw?.owned) ? raw.owned : [];
    for (const c of list) {
      if (!c || !BY[c.id] || !Number.isSafeInteger(c.uid) || c.uid < 1 || s.owned.some((o) => o.uid === c.uid)) continue;
      s.owned.push({ uid: c.uid, id: c.id, color: hex(c.color) ? c.color : BY[c.id].colors[0], x: Number.isFinite(c.x) ? Math.max(32, Math.min(6568, c.x)) : null, y: Number.isFinite(c.y) ? Math.max(32, Math.min(5068, c.y)) : null,
        angle: Number.isFinite(c.angle) ? c.angle : 0, fuel: Number.isFinite(c.fuel) ? Math.max(0, Math.min(100, c.fuel)) : 100, condition: Number.isFinite(c.condition) ? Math.max(0, Math.min(100, c.condition)) : 100, plate: typeof c.plate === 'string' ? c.plate.slice(0, 8) : plateOf(c.uid) });
      if (s.owned.length >= MAX_OWNED) break;
    }
    for (const [k, v] of Object.entries(raw?.seen || {})) if (BY[k] && v === true) s.seen[k] = true;
    s.paid = (Array.isArray(raw?.paid) ? raw.paid : []).filter((n) => MILESTONES.some((m) => m.n === n));
    s.next = Math.max(Number.isSafeInteger(raw?.next) ? raw.next : 1, ...s.owned.map((o) => o.uid + 1), 1);
    for (const k of ['bought', 'spent']) if (Number.isSafeInteger(raw?.[k]) && raw[k] > 0) s[k] = raw[k];
    return s;
  }
  // Price with Charisma (or any) discount; never below 85% of list.
  const priceOf = (id, mult = 1) => Math.round((BY[id]?.price || 0) * Math.max(0.85, Math.min(1.2, mult)));
  function buy(s, wallet, id, color, mult = 1) {
    const c = BY[id]; if (!c) return { ok: false, reason: 'Unknown car' };
    if (s.owned.length >= MAX_OWNED) return { ok: false, reason: `Garage list is full (${MAX_OWNED} cars). Sell one first.` };
    const price = priceOf(id, mult);
    if (!(wallet.cash >= price)) return { ok: false, reason: `Need $${price.toLocaleString()}` };
    wallet.cash -= price; s.bought += 1; s.spent += price;
    const rec = add(s, id, hex(color) && c.colors.includes(color) ? color : c.colors[0]);
    return { ok: true, price, car: rec };
  }
  function add(s, id, color) {
    const uid = s.next++; const rec = { uid, id, color: hex(color) ? color : BY[id].colors[0], x: null, y: null, angle: 0, fuel: 100, condition: 100, plate: plateOf(uid * 7919 + 13) };
    s.owned.push(rec); s.seen[id] = true; return rec;
  }
  // Sell back to the dealer: 55% of list, scaled by condition.
  const resale = (rec) => Math.round((BY[rec?.id]?.price || 0) * 0.55 * (0.5 + 0.5 * Math.max(0, Math.min(100, rec?.condition ?? 100)) / 100));
  function sell(s, wallet, uid) { const i = s.owned.findIndex((o) => o.uid === uid); if (i < 0) return { ok: false, reason: 'Not yours' }; const v = resale(s.owned[i]); s.owned.splice(i, 1); wallet.cash += v; return { ok: true, cash: v }; }
  const models = (s) => new Set(s.owned.map((o) => o.id));
  const score = (s) => [...models(s)].reduce((t, id) => t + (TIER_POINTS[BY[id].tier] || 1), 0);
  // Pays each milestone once, based on distinct models owned.
  function milestones(s, wallet) { const n = models(s).size, out = []; for (const m of MILESTONES) if (n >= m.n && !s.paid.includes(m.n)) { s.paid.push(m.n); wallet.cash += m.cash; out.push(m); } return out; }
  const title = (s) => { let t = null; for (const m of MILESTONES) if (models(s).size >= m.n) t = m.title; return t; };
  // Which rare model is parked in the city this window (weighted to the cheaper rares) — and where (index into spots).
  function rareFor(now = Date.now(), spots = 1) {
    const k = Math.floor(now / SPAWN_WINDOW); let s = (k * 2654435761 + 97) >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const pool = [['monarch', 5], ['velvet', 4], ['aurora', 3], ['bulldog', 3], ['kestrel', 3], ['vortex', 1.5], ['phantom', 0.6]], tot = pool.reduce((t, p) => t + p[1], 0);
    let x = r() * tot, id = pool[0][0]; for (const [m, w] of pool) { if ((x -= w) <= 0) { id = m; break; } }
    return { id, window: k, until: (k + 1) * SPAWN_WINDOW, spot: Math.floor(r() * Math.max(1, spots)), color: BY[id].colors[Math.floor(r() * BY[id].colors.length)] };
  }
  // Chop-shop base value for a model name (used by chop-data.js).
  const chopBase = (model) => fromModel(model)?.chop ?? null;
  // Stat bars 0..1 for the UI.
  const stats = (c) => ({ speed: (c.max - 5.5) / 5.5, accel: (c.accel - 0.17) / 0.3, handling: (c.steer - 0.03) / 0.025, armor: (c.armor - 0.9) / 0.55 });

  const api = Object.freeze({ CARS, BY, TIERS, TIER_POINTS, MILESTONES, MAX_OWNED, SPAWN_WINDOW, MODEL_PREFIX, modelName, fromModel, plateOf, clean, priceOf, buy, add, resale, sell, models, score, milestones, title, rareFor, chopBase, stats });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftCarsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
