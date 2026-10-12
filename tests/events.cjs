// City events (Claude-owned): generation, per-type step logic, pay scaling and save cleaning.
const assert = require('node:assert/strict');
const V = require('../events-data.js');
const near = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const onRoad = (pt) => V.XS.includes(pt.x) || V.YS.includes(pt.y);

const player = { x: 880, y: 680 }, seen = new Set();
for (let i = 0; i < 300; i++) {
  const e = V.make('s' + i, player);
  seen.add(e.type);
  assert.ok(V.TYPES[e.type] && onRoad(e) && e.pay > 0 && e.stage === 'open', 'valid event ' + i);
  const d = near(e, player); assert.ok(d >= 350 && d <= 1300, 'spawn distance ' + d);
  if (e.type === 'package') { assert.ok(onRoad(e.to) && near(e.to, e) >= 900, 'package destination far'); }
  if (e.type === 'sprint') { assert.equal(e.gates.length, 3); assert.ok(e.gates.every(onRoad)); }
  if (e.type === 'briefcase') assert.ok(e.pay >= 300 && e.pay <= 900);
}
assert.deepEqual([...seen].sort(), Object.keys(V.TYPES).sort(), 'all types appear');
assert.deepEqual(V.make('same', player), V.make('same', player), 'seeded and reproducible');
const g = V.nextGap(() => 0.5); assert.ok(g >= V.GAP_MS[0] && g <= V.GAP_MS[1]);
console.log('PASS: city events spawn on roads, at a fair distance, with every type');

const find = (type) => { for (let i = 0; ; i++) { const e = V.make('t' + type + i, player); if (e.type === type) return e; } };
const run = (e, pos, secs, inCar = false) => { let r = null; for (let t = 0; t < secs * 10 && !(r && r.result !== 'stage'); t++) { r = V.step(e, { dt: 0.1, pos, inCar }) || r; } return r; };
// briefcase: reach it, else expire
let b = find('briefcase'); assert.equal(V.step(b, { dt: 0.1, pos: player }), null);
assert.equal(V.step(b, { dt: 0.1, pos: { x: b.x + 20, y: b.y } }).result, 'done');
b = find('briefcase'); assert.equal(run(b, player, 200).result, 'expired');
// truck: hold 12s; leaving decays progress; done pays
let tr = find('truck'), at = { x: tr.x + 40, y: tr.y };
assert.equal(V.step(tr, { dt: 0.1, pos: at }).result, 'stage'); assert.equal(tr.stage, 'crack');
run(tr, at, 5); const prog = tr.progress; V.step(tr, { dt: 1, pos: player }); assert.ok(tr.progress < prog, 'progress decays when away');
const done = run(tr, at, 20); assert.equal(done.result, 'done'); assert.equal(done.pay, tr.pay);
// package: pickup, then deliver (time bonus) or fail
let pk = find('package'); assert.equal(V.step(pk, { dt: 0.1, pos: pk }).result, 'stage'); assert.equal(pk.stage, 'carry');
run(pk, player, 10); const del = V.step(pk, { dt: 0.1, pos: pk.to }); assert.equal(del.result, 'done'); assert.ok(del.pay > pk.pay, 'time bonus');
pk = find('package'); V.step(pk, { dt: 0.1, pos: pk }); assert.equal(run(pk, player, 100).result, 'fail');
// sprint: must be in a car to start; gates in order; leaving the car fails
let sp = find('sprint'); assert.equal(V.step(sp, { dt: 0.1, pos: sp, inCar: false }), null);
assert.equal(V.step(sp, { dt: 0.1, pos: sp, inCar: true }).result, 'stage');
assert.equal(V.step(sp, { dt: 0.1, pos: sp.gates[1], inCar: true }), null, 'gates count in order only');
for (let i = 0; i < 2; i++) assert.equal(V.step(sp, { dt: 1, pos: sp.gates[i], inCar: true }).result, 'stage');
const fin = V.step(sp, { dt: 1, pos: sp.gates[2], inCar: true }); assert.equal(fin.result, 'done'); assert.ok(fin.pay > 600);
sp = find('sprint'); V.step(sp, { dt: 0.1, pos: sp, inCar: true }); assert.equal(V.step(sp, { dt: 0.1, pos: player, inCar: false }).result, 'fail');
sp = find('sprint'); V.step(sp, { dt: 0.1, pos: sp, inCar: true }); assert.equal(run(sp, player, 40, true).result, 'fail');
assert.equal(V.step(find('briefcase'), { dt: 0.1 }), null, 'no position, no step');
console.log('PASS: briefcase, truck, package and sprint logic');

assert.equal(V.scale(1000, 0), 1000); assert.equal(V.scale(1000, 4), 1200); assert.equal(V.scale(1000, 99), 1350);
const c = V.clean({ done: 3, missed: -1, earned: 2e10, byType: { truck: 2, bogus: 4, sprint: -1 } });
assert.deepEqual(c, { version: 1, done: 3, missed: 0, earned: 1e10, byType: { truck: 2 } });
assert.equal(V.clean(null).done, 0);
console.log('PASS: event pay scaling and save cleaning');
