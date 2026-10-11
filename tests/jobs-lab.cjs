// Hustle jobs + drug lab (Claude-owned): offers on roads, pay formulas, lab batches, stash, save.
const assert = require('node:assert/strict');
const J = require('../jobs-data.js');
const L = require('../lab-data.js');
const onRoad = (p) => J.XS.includes(p.x) || J.YS.includes(p.y);
for (let slot = 1000; slot < 1300; slot++) {
  const os = J.offers(slot);
  assert.equal(os.length, J.OFFERS); assert.deepEqual(os, J.offers(slot), 'stable within a slot');
  for (const o of os) {
    assert.ok(J.TYPES[o.type]); assert.ok(o.limit >= 60);
    if (o.type === 'taxi') { assert.ok(onRoad(o.from) && onRoad(o.to), 'taxi points on roads'); assert.ok(o.dist >= 900 || o.dist > 0); assert.ok(o.pay >= 150 && o.pay <= 600, 'taxi pay ' + o.pay); }
    if (o.type === 'hit' || o.type === 'repo') assert.ok(o.pay >= 450 && o.pay <= 1000);
    if (o.type === 'drop') { assert.ok(onRoad(o.to)); assert.ok(o.need >= 1 && o.need <= 3); }
  }
}
const taxi = { pay: 300, par: 20 };
assert.equal(J.taxiPay(taxi, 19), 390); assert.equal(J.taxiPay(taxi, 25), 300);
assert.equal(J.dropPay(120, 2), 384); assert.equal(J.scale(1000, 0), 1000); assert.equal(J.scale(1000, 7), 1350); assert.equal(J.scale(1000, 99), 1350);
const js = J.clean({ done: 5, byType: { taxi: 3, bogus: 2 }, taken: ['1-2', 'x', '3-1'] });
assert.deepEqual(js.byType, { taxi: 3 }); assert.deepEqual(js.taken, ['1-2', '3-1']);
console.log('PASS: job offers (stable, on roads, sane pay), pay formulas and save');
const s = L.clean({}), pocket = { weed: 5, coke: 1 }, wallet = { cash: 100 };
assert.equal(L.start(s, 'house', 'prerolls', pocket, wallet).reason, 'This lab cannot make that');
assert.equal(L.start(s, 'farm', 'gummies', pocket, { cash: 5 }).reason, 'Not enough cash for supplies');
assert.deepEqual(L.start(s, 'farm', 'prerolls', pocket, wallet, 1000), { ok: true });
assert.deepEqual([pocket.weed, wallet.cash], [3, 90]); assert.equal(s.batches.farm.until, 31000);
assert.equal(L.start(s, 'farm', 'prerolls', pocket, wallet, 2000).reason, 'A batch is already cooking');
assert.equal(L.start(s, 'house', 'party', { coke: 1, weed: 1 }, wallet).reason, 'Need 2 carried weed');
assert.deepEqual(L.collect(s, 30000), []);
assert.deepEqual(L.collect(s, 31000, 1, () => 0.9), [{ lab: 'farm', recipe: 'prerolls', out: 1 }]);
assert.equal(s.stash.prerolls, 1);
L.start(s, 'house', 'bags', pocket, wallet, 0, 0.5); assert.equal(s.batches.house.until, 20000, 'Farming perk halves cook time (floor 50%)');
assert.deepEqual(L.collect(s, 20000, 1.5, () => 0.1), [{ lab: 'house', recipe: 'bags', out: 3 }], 'yield perk can add a unit');
assert.equal(L.bestFor(s, 2), 'bags'); assert.equal(L.bestFor(s, 1), 'prerolls', 'most valuable product that fills the order'); assert.equal(L.take(s, 'bags', 2), true); assert.equal(L.bestFor(s, 2), null);
const f = L.fenceAll(s, 1); assert.deepEqual(f, { cash: Math.round(110 * 0.6) + Math.round(120 * 0.6), n: 2 });
const d = L.clean({ stash: { party: 999, nope: 2 }, batches: { farm: { recipe: 'bags', until: 5 }, house: { recipe: 'bags', until: 9e15 } } }, 1000);
assert.deepEqual(d.stash, { party: L.STASH_MAX }); assert.equal(d.batches.farm, undefined, 'recipe must match lab'); assert.equal(d.batches.house.until, 1000 + 40000, 'future batch clamped');
console.log('PASS: lab batches, perks, stash, fence and save cleaning');
