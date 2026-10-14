// v0.66 (Claude): Route 9 highway rules + the Nightshift Garage cars.
const assert = require('node:assert/strict');
const H = require('../highway-data.js'), C = require('../cars-data.js'), CD = require('../city-data.js'), DR = require('../driving-data.js');
// garage cars present, real names, sane stats, drivetrain set
const G = ['m4', 'civic', 'charger', 's15', 'mustang', 'gallardo'];
for (const id of G) { const c = C.BY[id]; assert.ok(c && c.garage && c.drive && c.kmh > 200 && c.hp > 100, id); assert.ok(C.fromModel(C.modelName(id)) === c); }
assert.equal(C.BY.m4.name, 'BMW M4 F82'); assert.equal(C.BY.gallardo.drive, 'AWD'); assert.equal(C.BY.civic.drive, 'FWD');
assert.ok(H.perf(C.BY.gallardo).top > H.perf(C.BY.m4).top && H.perf(C.BY.m4).top > H.perf(C.BY.civic).top, 'top speeds follow the real cars');
assert.ok(H.perf(C.BY.gallardo).accel > H.perf(C.BY.civic).accel, 'more power, quicker');
// drivetrain changes drifting: RWD slides more than FWD
const rwd = { speed: 5, angle: 0 }, fwd = { speed: 5, angle: 0 };
for (let i = 0; i < 20; i++) { DR.step(rwd, { steer: 1, brake: true, dt: 1, drive: 'RWD' }); DR.step(fwd, { steer: 1, brake: true, dt: 1, drive: 'FWD' }); }
assert.ok(rwd.drift > fwd.drift && rwd.angle > fwd.angle, 'RWD drifts more than FWD');
console.log('PASS: Nightshift Garage cars in the city catalog (real names, specs, drivetrains)');
// ring road: exits evenly spaced, wrap/ahead math, ramps on edge roads
assert.equal(H.LOOP, H.SEG * H.EXITS.length);
assert.equal(H.wrap(-10), H.LOOP - 10); assert.equal(H.ahead(H.LOOP - 100, 50), 150);
for (const e of H.EXITS) { const onRoad = (v, k) => Math.min(v % k, k - (v % k)) <= 63; assert.ok(onRoad(e.ramp.x, 440) || onRoad(e.ramp.y, 340), e.id + ' ramp on a road'); assert.ok(onRoad(e.into.x, 440) || onRoad(e.into.y, 340), e.id + ' drop-off on a road'); assert.ok(e.into.x > 0 && e.into.x < CD.WIDTH && e.into.y > 0 && e.into.y < CD.HEIGHT); }
const nx = H.nextExit(H.entryAt(0)); assert.equal(nx.i, 1, 'after the West End on-ramp, the next exit is Downtown');
// speed step: accelerates to (not past) top speed, gears go up, fuel drains, empty tank coasts
const P = H.perf(C.BY.m4), car = { v: 0, fuel: 100, condition: 100 }; let g0 = 1;
for (let i = 0; i < 3000; i++) { H.step(car, P, { throttle: 1, brake: 0, dt: 0.016 }); assert.ok(car.gear >= g0 || car.v < 5); g0 = car.gear; }
assert.ok(car.v > P.top * 0.85 && car.v <= P.top * 1.02, 'reaches near top speed'); assert.equal(car.gear, P.gears); assert.ok(car.fuel < 100);
const spiked = { v: 0, fuel: 100, condition: 100, spikes: true }; for (let i = 0; i < 3000; i++) H.step(spiked, P, { throttle: 1, dt: 0.016 }); assert.ok(spiked.v < P.top * 0.6, 'spikes cap speed');
const empty = { v: 500, fuel: 0, condition: 100 }; for (let i = 0; i < 200; i++) H.step(empty, P, { throttle: 1, dt: 0.016 }); assert.ok(empty.v < 500, 'no fuel: coasting');
// near misses, streak table (Nightshift Garage), cameras, evade
assert.ok(H.nearMiss({ y: 100, v: 900 }, { y: 130, v: 300 })); assert.ok(!H.nearMiss({ y: 100, v: 900 }, { y: 200, v: 300 }), 'too far'); assert.ok(!H.nearMiss({ y: 100, v: 900 }, { y: 110, v: 300 }), 'that is a crash, not a miss');
assert.deepEqual([0, 3, 5, 8, 10, 20].map(H.streakMult), [1, 1.15, 1.35, 1.6, 2, 2]);
assert.equal(H.camera(H.pxs(140)), null); const t = H.camera(H.pxs(180)); assert.ok(t.fine > 60 && t.heat === 0); assert.equal(H.camera(H.pxs(230)).heat, 1);
const ev = {}; let lost = false; for (let i = 0; i < 2000 && !lost; i++) lost = H.evade(ev, 2000, 0.016, 3); assert.ok(lost, 'out of sight long enough: lose a star'); const ev2 = {}; for (let i = 0; i < 2000; i++) assert.equal(H.evade(ev2, 500, 0.016, 3), false);
// races + runs
const R = H.race(1000, H.RACERS[0]); assert.ok(R.length > 2000 && R.pay > 400); const run = H.run(H.REST.at, 2, () => 0.5); assert.ok(run.to !== 2 && run.seconds > 10 && run.pay > 250);
assert.deepEqual(H.clean({ wins: { mika: 2, bogus: 9 }, km: 12.5, nearMiss: -3 }).wins, { mika: 2 });
console.log('PASS: Route 9 — ring road + ramps, speed/gears/fuel/spikes, near-miss streaks, cameras, evade, races, runs');
