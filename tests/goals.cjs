// Goals engine (Claude-owned): catalog sanity, completion order, save cleaning.
const assert = require('node:assert/strict');
const D = require('../goals-data.js');
const G = require('../goals.js');
const SD = require('../skills-data.js');

// Catalog: unique ids, every goal has text, a positive target and a reward that names real skills.
const ids = new Set(), skills = new Set(SD.SKILLS.map((s) => s.id));
for (const g of D.GOALS) {
  assert.ok(!ids.has(g.id), 'unique ' + g.id); ids.add(g.id);
  assert.ok(g.title && g.hint && g.tier, g.id + ' text');
  const [cur, target] = g.progress(G.context({}));
  assert.equal(cur, 0, g.id + ' starts at 0'); assert.ok(target > 0, g.id + ' target');
  assert.ok((g.reward.cash || 0) >= 0);
  for (const k of Object.keys(g.reward.xp || {})) assert.ok(skills.has(k), `${g.id} rewards real skill ${k}`);
}
console.log('PASS: goals catalog is complete and consistent');

// Fresh player: first goal is "walk"; nothing completes on an empty context.
const st = G.clean({});
assert.equal(G.next(st, {}).goal.id, 'walk');
assert.equal(G.step(st, {}), null);
// Completion: one per step, in catalog order, and NEXT advances.
const ctx = { walked: 500, shots: 9, inCar: 1 };
assert.equal(G.step(st, ctx, 1).id, 'walk');
assert.equal(G.step(st, ctx, 2).id, 'shoot');
assert.equal(G.step(st, ctx, 3).id, 'car');
assert.equal(G.step(st, ctx, 4), null);
assert.equal(G.next(st, ctx).goal.id, 'delivery1');
// Out-of-order goals still complete (an unmet goal never blocks later ones).
assert.equal(G.step(st, { ...ctx, salvage: 3 }, 5).id, 'salvage1');
assert.equal(G.next(st, ctx).goal.id, 'delivery1', 'NEXT stays on the first unfinished goal');
// A veteran save catches up one goal at a time without double-paying.
const vet = G.clean({}), big = { walked: 1e6, shots: 1e4, inCar: 1, delivery: 30, salvage: 20, home: 1, batches: 9, sold: 80,
  earned: 2e6, carsOwned: 4, maxSkill: 50, totalLevel: 300, escapes: 9, properties: 3, casinoWins: 5, casinoWagered: 30000, weaponsOwned: 6, tuneLevels: 12, tuneBestCar: 9, raceMedals: 3, raceGolds: 3, homeItems: 5, respectRank: 7, fishCaught: 60, koi: 1, jobsDone: 30, labCooked: 5 };
const order = []; let g; while ((g = G.step(vet, big))) order.push(g.id);
assert.deepEqual(order, D.GOALS.map((x) => x.id), 'every goal completes exactly once, in order');
assert.equal(G.next(vet, big), null);
console.log('PASS: goal completion order, NEXT goal and catch-up');

// Progress display is bounded and floors.
const p = G.progressOf(D.GOALS.find((x) => x.id === 'earn5k'), { earned: 1234.7 });
assert.deepEqual([p.cur, p.target, p.done], [1234, 5000, false]);
assert.equal(G.context({ earned: NaN, delivery: -4, sold: '7' }).earned, 0);
assert.equal(G.context({ delivery: -4 }).delivery, 0);
console.log('PASS: goal progress and context sanitizing');

// Saves: unknown goals and bad stats are dropped.
const dirty = G.clean({ done: { walk: 5, bogus: 1, shoot: -1, car: 'x' }, stats: { walked: 1e20, earned: -9, shots: 'x', escapes: 2 } });
assert.deepEqual(dirty.done, { walk: 5 });
assert.equal(dirty.stats.walked, 1e12);
assert.equal(dirty.stats.earned, 0);
assert.equal(dirty.stats.shots, 0);
assert.equal(dirty.stats.escapes, 2);
assert.deepEqual(G.clean(null).done, {});
console.log('PASS: goals save cleaning');

// Tracker: follows the NEXT goal when it has a place, or a pinned unfinished goal; save keeps a valid pin only.
const tst = G.clean({});
assert.equal(G.tracked(tst), null, 'first goal (walk) has no place to point at');
tst.done.walk = 1; tst.done.shoot = 1;
assert.equal(G.tracked(tst).id, 'car', 'NEXT goal with a place is tracked');
tst.pin = 'casino1';
assert.equal(G.tracked(tst).id, 'casino1', 'pinned goal wins');
tst.done.casino1 = 2;
assert.equal(G.tracked(tst).id, 'car', 'finished pin falls back to NEXT');
assert.equal(G.clean({ pin: 'walk' }).pin, null, 'goals without a place cannot be pinned');
assert.equal(G.clean({ pin: 'gun1' }).pin, 'gun1');
assert.equal(G.clean({ pin: 'gun1', done: { gun1: 5 } }).pin, null, 'finished goals cannot stay pinned');
assert.equal(G.clean({ track: false }).track, false); assert.equal(G.clean({}).track, true);
for (const g of D.GOALS) if (g.place) assert.ok(['car', 'job', 'salvage', 'apartment', 'property', 'dealer', 'garage', 'casino', 'gunshop', 'race', 'fishing'].includes(g.place), g.id + ' place known');
console.log('PASS: goal tracker selection, pinning and save');
