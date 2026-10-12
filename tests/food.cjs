// Farming + food (Claude-owned): plots, watering, harvest, animals + feed, cooking, buffs, selling, economy sanity.
const assert = require('node:assert/strict');
const F = require('../food-data.js');
const S = require('../supply-data.js');

for (const c of F.CROPS) { assert.ok(S.MATERIALS[c.id], c.id + ' is a bag item'); assert.ok(F.COOP_BUYS[c.id] > 0, c.id + ' sells at the co-op'); assert.ok(c.yield[0] >= 1 && c.minutes > 0); }
for (const r of F.RECIPES) {
  assert.ok(S.MATERIALS[r.id]?.kind === 'meal', r.id + ' is a meal item');
  for (const k of Object.keys(r.in)) assert.ok(S.MATERIALS[k], r.id + ' ingredient ' + k);
  assert.ok(F.BUFFS[r.buff], r.id + ' buff');
  const cost = Object.entries(r.in).reduce((t, [k, n]) => t + (F.COOP_BUYS[k] || 0) * n, 0);
  assert.ok(r.sell * r.out > cost * 1.3, `${r.id}: cooking adds value (meals ${r.sell * r.out} vs ingredients ${cost})`);
}
for (const A of Object.values(F.ANIMALS)) assert.ok(S.MATERIALS[A.item] && S.MATERIALS[A.feed]);
console.log('PASS: food catalog (crops, recipes, buffs, animals consistent with the backpack; cooking adds value)');

const now = 1e12, s = F.clean({}, now), w = { cash: 1000 };
assert.equal(s.plots.length, 0);
assert.equal(F.plant(s, 0, 'wheat', w).reason, 'Lease this plot at the co-op first');
assert.deepEqual(F.lease(s, w), { ok: true, price: 150, n: 1 });
assert.equal(F.plant(s, 0, 'pumpkin', w, 1, now).reason, 'Needs Farming level 6');
assert.ok(F.plant(s, 0, 'wheat', w, 1, now).ok); assert.equal(w.cash, 846);
assert.equal(F.stage(s.plots[0], now), 1);
const half = now + F.growMs('wheat', false) / 2;
assert.equal(F.stage(s.plots[0], half), 2);
assert.ok(F.water(s, 0, half).ok); assert.equal(F.water(s, 0, half).reason, 'Already watered');
assert.ok(Math.abs(F.progress(s.plots[0], half) - 0.5) < 1e-9, 'watering keeps progress so far');
const ripeAt = half + F.growMs('wheat', true) / 2;
assert.equal(F.stage(s.plots[0], ripeAt - 1000), 3); assert.equal(F.stage(s.plots[0], ripeAt + 1), 4);
const bag = {}, give = (items) => { const added = {}; for (const [k, n] of Object.entries(items)) { bag[k] = (bag[k] || 0) + n; added[k] = n; } return { added, lost: {} }; };
assert.ok(/Still growing/.test(F.harvest(s, 0, give, { now: half }).reason));
const h = F.harvest(s, 0, give, { now: ripeAt + 1, rnd: () => 0.99 }); assert.ok(h.ok); assert.equal(h.n, 6); assert.equal(s.plots[0].crop, null);
console.log('PASS: plots (lease, level gate, plant, stages, watering speeds the rest, harvest)');

// Animals: production needs feed; caps; buying.
const a = F.clean({}, now), aw = { cash: 5000 };
assert.ok(F.buyAnimal(a, 'hen', aw).ok); assert.ok(F.buyAnimal(a, 'hen', aw).ok);
F.tickAnimals(a, now + 60 * 60000);
assert.equal(a.animals.hen.ready, 0, 'no feed, no eggs');
assert.ok(/trough is empty/.test(F.collect(a, 'hen', give, now + 60 * 60000).reason));
const b2 = { wheat: 3 }; assert.equal(F.feed(a, 'hen', b2, 10).n, 3); assert.deepEqual(b2, {});
const later = now + 60 * 60000 + 4 * 8 * 60000;
const c = F.collect(a, 'hen', give, later); assert.ok(c.ok); assert.equal(c.n, 6, '2 hens cap at 3 each');
assert.equal(a.animals.hen.feed, 0, '6 eggs ate 3 wheat');
console.log('PASS: animals (feed trough, production per herd, cap, collect)');

// Cooking, eating, buffs, Diner.
const fs = F.clean({}, now);
assert.ok(F.canCook({ egg: 2, potato: 1, chili: 1 }, 'burrito')); assert.ok(!F.canCook({ egg: 1 }, 'burrito'));
const e = F.eat(fs, 'burrito', now); assert.ok(e.ok); assert.equal(e.buff.name, 'Fast feet');
assert.equal(F.modMul(fs, 'athletics.speed', now + 1000), 1.2); assert.equal(F.modMul(fs, 'athletics.speed', now + 7 * 60000), 1, 'buff expires');
F.eat(fs, 'pumpkinpie', now); F.eat(fs, 'cornbread', now); assert.equal(F.xpMul(fs, now), 1.3, 'strongest XP buff wins');
F.eat(fs, 'soup', now); assert.equal(F.regen(fs, now), 2.5);
const mb = { burrito: 12 }, mw = { cash: 0 };
const sold = F.sellMeal(fs, 'burrito', mb, mw, 99, { now }); assert.equal(sold.n, F.DINER.demand); assert.equal(mw.cash, F.DINER.demand * 75);
assert.ok(/stocked up/.test(F.sellMeal(fs, 'burrito', mb, mw, 1, { now }).reason)); assert.equal(F.sellMeal(fs, 'burrito', mb, mw, 1, { now: now + 601000 }).n, 1);
assert.equal(F.sellProduce(fs, 'wheat', { wheat: 10 }, mw, 4).cash, 20);
console.log('PASS: cooking, buffs (stacking rules, expiry), Diner demand, co-op sales');

// Save cleaning.
const d = F.clean({ plots: [{ crop: 'wheat', at: 5, watered: true }, { crop: 'nuke' }], animals: { hen: { n: 99, feed: -1 } }, buffs: { xp: now + 1e9, bad: now + 5 } }, now);
assert.equal(d.plots.length, 2); assert.equal(d.plots[1].crop, null); assert.equal(d.animals.hen.n, F.ANIMALS.hen.max); assert.equal(d.animals.hen.feed, 0);
assert.ok(d.buffs.xp <= now + 30 * 60000); assert.equal(d.buffs.bad, undefined);
console.log('PASS: farm save cleaning');

// Economy: a focused farmer with 8 wheat plots (replant every 3 min) earns in the same league as the weed chain,
// and cooking into meals for the Diner roughly doubles produce value.
const wheatHr = 8 * (60 / 3) * (5 * F.COOP_BUYS.wheat - F.CROP.wheat.seed);
assert.ok(wheatHr > 1000 && wheatHr < 6000, `8 wheat plots ~$${wheatHr}/h`);
console.log(`PASS: farm economy (8 wheat plots ~$${wheatHr}/h before cooking)`);
