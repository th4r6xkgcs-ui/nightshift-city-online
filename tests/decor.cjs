// Dream house decor (Claude-owned).
const assert = require('node:assert/strict');
const D = require('../decor-data.js');
for (const s of D.SLOTS) { const items = D.ITEMS.filter((i) => i.slot === s.id); assert.ok(items.length >= 2, `${s.id} has choices`); assert.equal(items[0].price, 0); assert.equal(items[0].style, 0); }
for (const i of D.ITEMS) assert.ok(D.SLOT[i.slot] && i.name && i.price >= 0 && i.style >= 0, i.id);
// pricier things are more stylish within a slot (except loot pieces)
for (const s of D.SLOTS) { const items = D.ITEMS.filter((i) => i.slot === s.id && !i.loot); for (let k = 1; k < items.length; k++) assert.ok(items[k].price > items[k - 1].price && items[k].style > items[k - 1].style, `${items[k].id} ordering`); }
const max = D.SLOTS.reduce((t, s) => t + Math.max(...D.ITEMS.filter((i) => i.slot === s.id).map((i) => i.style)), 0);
assert.ok(max >= D.TIERS.at(-1).at, 'Iconic is reachable');
const cost = D.ITEMS.reduce((t, i) => t + i.price, 0); assert.ok(cost > 150000 && cost < 400000, `full house costs ${cost}`);
console.log('PASS: catalog');

const s = D.clean({}), w = { cash: 5000 };
assert.equal(D.tier(s).name, 'Bare'); assert.equal(D.priceBonus(s), 1);
assert.ok(D.place(s, w, 'sofa-leather').ok); assert.equal(w.cash, 1000); assert.equal(s.placed.sofa, 'sofa-leather');
assert.match(D.place(s, w, 'tv-cinema').reason, /Needs/);
assert.ok(D.place(s, w, 'sofa-thrift').ok); assert.ok(D.place(s, w, 'sofa-leather').ok && w.cash === 1000, 'swapping back is free');
assert.equal(D.place(s, w, 'sofa-leather').reason, 'Already placed');
// loot piece
const bag = { items: { art: 0 }, has(c) { return Object.entries(c).every(([k, n]) => (this.items[k] || 0) >= n); }, take(c) { for (const [k, n] of Object.entries(c)) this.items[k] -= n; } };
w.cash = 9000; assert.match(D.place(s, w, 'art-master', bag).reason, /stolen art/);
bag.items.art = 1; assert.ok(D.place(s, w, 'art-master', bag).ok); assert.equal(bag.items.art, 0); assert.equal(w.cash, 7000);
console.log('PASS: buy once, swap free, loot pieces');

const rich = { cash: 1e7 }, full = D.clean({}); for (const i of D.ITEMS) if (!i.loot) D.place(full, rich, i.id);
for (const sl of D.SLOTS) { const best = D.ITEMS.filter((i) => i.slot === sl.id && !i.loot).at(-1); D.place(full, rich, best.id); }
assert.ok(D.tier(full).index >= 3); assert.ok(D.priceBonus(full) >= 1.06 && D.priceBonus(full) <= 1.08 + 1e-9);
const cars = [{ id: 'car-0', model: 'SEDAN', condition: 100 }, { id: 'car-1', model: 'VAN', condition: 50 }];
assert.ok(D.garageScore(full, cars, { 'car-0': 'lux' }) > D.garageScore(D.clean({}), cars, {}));
console.log('PASS: style tiers, price bonus, garage score');

const z = D.clean({}); const a = D.sleep(z, 1e12); assert.ok(a.ok && a.boost >= 1.15); assert.match(D.sleep(z, 1e12 + 1000).reason, /Not tired/);
const c = D.clean({ owned: ['sofa-cloud', 'nope', 'sofa-thrift'], placed: { sofa: 'sofa-cloud', tv: 'tv-cinema', rug: 'sofa-cloud', bad: 'x' } });
assert.deepEqual(c.owned, ['sofa-cloud']); assert.equal(c.placed.sofa, 'sofa-cloud'); assert.equal(c.placed.tv, 'tv-none'); assert.equal(c.placed.rug, 'rug-none');
console.log('PASS: sleeping and save cleaning');
