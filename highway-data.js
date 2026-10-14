/* Route 9 highway (Claude-owned, v0.66). Pure and Node-testable; highway.js runs it.
 * The highway is a ring road around the city. You get on at one of six ramps on the city's edge roads and get off
 * at any exit, so it doubles as fast travel. Distances are highway pixels (1 px = 0.08 m, the city's car scale);
 * speeds are px/s, shown as km/h (x 0.288).
 * Brought over from Nightshift Garage (same names): Route 9 Expressway, Route 9 services, Last Light Fuel,
 * Rook's Tuning, the meet regulars Mika, Jules and Rook, speed cameras, and the near-miss streak multiplier.
 * Rules here: lanes, exits, car performance from the city catalog, the speed step (gears + rpm), traffic spawning,
 * near misses + streak, speed cameras + fines, police pursuit odds, spikes, races vs the regulars, runs. */
(function (root) {
  'use strict';
  const KMH = 0.288, M = 0.08;
  const LANE = 44, LANES = 4, TOP = 0, BOTTOM = LANE * LANES; // eastbound lanes y in [0, 176]; shoulder 176..214
  const SHOULDER = [BOTTOM + 4, BOTTOM + 38];
  const SEG = 18000; // px between exits (~1.4 km)
  const EXITS = [
    { id: 'west', name: 'West End', ramp: { x: 40, y: 680 }, into: { x: 110, y: 680, angle: 0 } },
    { id: 'downtown', name: 'Downtown', ramp: { x: 2640, y: 40 }, into: { x: 2640, y: 120, angle: Math.PI / 2 } },
    { id: 'heights', name: 'The Heights', ramp: { x: 5720, y: 40 }, into: { x: 5720, y: 120, angle: Math.PI / 2 } },
    { id: 'ironworks', name: 'Ironworks', ramp: { x: 6560, y: 2040 }, into: { x: 6480, y: 2040, angle: Math.PI } },
    { id: 'harbor', name: 'Harbor', ramp: { x: 5280, y: 5060 }, into: { x: 5280, y: 4980, angle: -Math.PI / 2 } },
    { id: 'fairview', name: 'Fairview', ramp: { x: 880, y: 5060 }, into: { x: 880, y: 4980, angle: -Math.PI / 2 } },
  ];
  const LOOP = SEG * EXITS.length;
  const REST = { at: SEG * 2 + SEG / 2, name: 'Route 9 services', fuel: 'Last Light Fuel', tuning: 'Rook’s Tuning' };
  const LIMIT = 120; // km/h posted
  const CAMERAS = EXITS.flatMap((e, i) => [i * SEG + 6000, i * SEG + 12500]);
  const STREAK = [[0, 1], [3, 1.15], [5, 1.35], [8, 1.6], [10, 2]]; // Nightshift Garage near-miss streak
  const RACERS = [
    { id: 'mika', name: 'Mika', car: 's15', color: '#67ccaa', skill: 0.9, line: 'drift kid from the Foundry meets' },
    { id: 'jules', name: 'Jules', car: 'm4', color: '#4790e8', skill: 0.95, line: 'rooftop regular, never lifts' },
    { id: 'rook', name: 'Rook', car: 'mustang', color: '#1d2433', skill: 1.0, line: 'runs Rook’s Tuning, hates losing' },
  ];
  const TRAFFIC_MODELS = ['SEDAN', 'COMPACT', 'VAN', 'SEDAN', 'CX:brick', 'CX:ridgeback', 'CX:aurora', 'CX:civic', 'CX:mule', 'TRUCK'];
  const TRAFFIC_COLORS = ['#c84659', '#3d7fc6', '#e8e6e0', '#1d2024', '#7d8796', '#e2b75c', '#2f6b9a', '#b8c7c6'];

  const kmh = (v) => Math.round(Math.abs(v) * KMH);
  const pxs = (k) => k / KMH;
  const wrap = (d) => ((d % LOOP) + LOOP) % LOOP;
  const ahead = (from, to) => wrap(to - from); // distance forward from `from` to `to`
  const laneY = (i) => TOP + LANE * i + LANE / 2;
  const laneOf = (y) => Math.max(0, Math.min(LANES - 1, Math.floor((y - TOP) / LANE)));

  // performance from a city catalog entry (or a base car)
  function perf(spec) {
    const top = pxs(spec?.kmh || (spec?.max ? 150 + (spec.max - 6.5) * 40 : 175));
    const zeroHundred = spec?.hp ? Math.max(2.8, 2.6 + 900 / spec.hp) : Math.max(3.2, 12.5 - (spec?.accel || 0.24) * 22); // seconds 0-100 (real cars: from horsepower)
    return { top, accel: pxs(100) / zeroHundred, steer: 150 + (spec?.steer || 0.04) * 2200, gears: spec?.kmh > 280 ? 7 : 6, drive: spec?.drive || 'RWD', hp: spec?.hp || 150 };
  }
  // speed/gear step. input: { throttle 0..1, brake 0..1, nitro bool, dt s }; car: { v, fuel, condition, spikes }
  function step(car, P, input) {
    const dt = Math.max(0, Math.min(0.1, input.dt || 0)), dmg = 0.75 + 0.25 * Math.max(0, Math.min(100, car.condition ?? 100)) / 100;
    const top = P.top * dmg * (car.spikes ? 0.55 : 1) * (input.nitro ? 1.18 : 1);
    const empty = (car.fuel ?? 100) <= 0;
    let a = 0;
    if (!empty && input.throttle > 0) a += P.accel * input.throttle * (1 - Math.pow(Math.max(0, car.v) / top, 2.2)) * (input.nitro ? 1.6 : 1);
    if (input.brake > 0) a -= 900 * input.brake;
    a -= 10 + P.accel * 0.2 * Math.pow(car.v / P.top, 2) * (empty ? 4 : 1) + (input.throttle > 0 ? 0 : 30); // rolling + air drag (+ engine braking off-throttle)
    car.v = Math.max(0, Math.min(top * 1.02, car.v + a * dt));
    car.fuel = Math.max(0, (car.fuel ?? 100) - car.v * dt * M / 1000 * 0.9); // ~0.9% per km
    // gearbox: even spread of the speed range over the gears, rpm 1,000-7,500
    const g = Math.min(P.gears, 1 + Math.floor((car.v / P.top) * P.gears * 0.999)), lo = (g - 1) / P.gears * P.top, hi = g / P.gears * P.top;
    car.gear = car.v < 4 ? 1 : g; car.rpm = Math.round(1000 + Math.max(0, Math.min(1, (car.v - lo) / Math.max(1, hi - lo))) * 6500 * (g === 1 ? 1 : 0.85) + (g === 1 ? 0 : 900));
    return car;
  }
  // near miss: passing a traffic car within `gap` px laterally (but not touching) at a closing speed
  function nearMiss(p, t, gapMax = 34) {
    const lat = Math.abs(p.y - t.y) - 26; // 26 = car width
    return lat > 0 && lat < gapMax && p.v - t.v > 140;
  }
  const streakMult = (n) => { let m = 1; for (const [k, v] of STREAK) if (n >= k) m = v; return m; };
  function nearMissPay(n) { return Math.round(15 * streakMult(n)); }
  // speed camera: returns null (under) or { kmh, over, fine, heat }
  function camera(speedPx) {
    const k = kmh(speedPx), over = k - LIMIT; if (over <= 30) return null;
    return { kmh: k, over, fine: 60 + over * 2, heat: k >= 200 ? 1 : 0 };
  }
  // police on the highway: units by wanted stars, pursuit loss when out of sight long enough
  const units = (stars) => [0, 1, 2, 3, 4, 5][Math.max(0, Math.min(5, stars | 0))];
  function evade(state, nearestPx, dt, stars) {
    const need = 8 + stars * 3; // seconds
    if (nearestPx < 1600) { state.lost = 0; return false; }
    state.lost = (state.lost || 0) + dt; if (state.lost >= need) { state.lost = 0; return true; } return false;
  }
  // traffic: lane speeds (slow lane right), deterministic spawn by seed
  function trafficCar(rnd, d, lane) {
    const m = TRAFFIC_MODELS[Math.floor(rnd() * TRAFFIC_MODELS.length)], truck = m === 'TRUCK';
    const base = [125, 110, 95, 80][lane] + (rnd() - 0.5) * 20 - (truck ? 15 : 0);
    return { d, y: laneY(lane), lane, v: pxs(base), model: truck ? 'VAN' : m, truck, color: TRAFFIC_COLORS[Math.floor(rnd() * TRAFFIC_COLORS.length)], len: truck ? 92 : 54, wid: truck ? 30 : 26, change: 0 };
  }
  function nextExit(d) { let best = null, bd = Infinity; EXITS.forEach((e, i) => { const a = ahead(d, i * SEG); if (a > 0 && a < bd) { bd = a; best = { ...e, i, dist: a }; } }); return best; }
  const exitAt = (i) => wrap(i * SEG);
  const entryAt = (i) => wrap(i * SEG + 500);
  // race: to the exit after the next one; reward scales with the rival
  function race(d, rival) { const ex = nextExit(d + 2000), finish = wrap(exitAt(ex.i) - 300); return { rival: rival.id, finish, length: ahead(d, finish), pay: Math.round(400 + ahead(d, finish) * 0.05 * rival.skill), exit: ex.id }; }
  // runs from the rest stop: deliver to an exit before the clock runs out
  function run(fromD, i, rnd = Math.random) {
    const kinds = [['Parts drop for Rook', 1], ['Late-night courier', 1.2], ['Hot car delivery', 1.6]], [name, mult] = kinds[Math.floor(rnd() * kinds.length)];
    const to = (i + 1 + Math.floor(rnd() * (EXITS.length - 1))) % EXITS.length, dist = ahead(fromD, exitAt(to));
    return { name, to, dist, seconds: Math.round(dist / pxs(150) + 12), pay: Math.round((250 + dist * 0.035) * mult), hot: mult > 1.5 };
  }
  function clean(raw) {
    const s = { version: 1, best: {}, wins: {}, km: 0, nearMiss: 0, bestStreak: 0, tickets: 0, runs: 0 };
    for (const r of RACERS) { if (Number.isSafeInteger(raw?.wins?.[r.id]) && raw.wins[r.id] > 0) s.wins[r.id] = raw.wins[r.id]; }
    for (const k of ['km', 'nearMiss', 'bestStreak', 'tickets', 'runs']) if (Number.isFinite(raw?.[k]) && raw[k] > 0) s[k] = Math.min(1e9, raw[k]);
    return s;
  }
  const api = Object.freeze({ KMH, M, LANE, LANES, TOP, BOTTOM, SHOULDER, SEG, EXITS, LOOP, REST, LIMIT, CAMERAS, STREAK, RACERS, kmh, pxs, wrap, ahead, laneY, laneOf, perf, step, nearMiss, streakMult, nearMissPay, camera, units, evade, trafficCar, nextExit, exitAt, entryAt, race, run, clean });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftHighwayData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
