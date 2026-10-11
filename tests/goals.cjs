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
  earned: 2e6, carsOwned: 4, maxSkill: 50, totalLevel: 300, escapes: 9, properties: 3, casinoWins: 5, casinoWagered: 30000 };
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
