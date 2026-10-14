// Car collection (Claude-owned): catalog sanity, buying, selling, milestones, rare spawns, chop integration, save cleaning.
const assert = require('node:assert/strict');
const D = require('../cars-data.js');
global.NightshiftCarsData = D;
const C = require('../chop-data.js');

const ids = new Set();
for (const c of D.CARS) {
  assert.ok(!ids.has(c.id)); ids.add(c.id);
  assert.ok(D.TIERS.includes(c.tier), `${c.id} tier`);
  assert.ok(c.price > 0 && c.chop > 0 && c.chop < c.price * 0.35, `${c.id} chop value well under list`);
  assert.ok(c.max >= 6.5 && c.max <= 11 && c.accel > 0.18 && c.accel < 0.5 && c.steer > 0.03 && c.steer < 0.06, `${c.id} handling in range`);
  assert.ok(c.len >= 48 && c.len <= 68 && c.wid >= 26 && c.wid <= 32, `${c.id} fits the car collision box`);
  assert.ok(c.colors.length >= 3 && c.colors.every((h) => /^#[0-9a-f]{6}$/i.test(h)));
  assert.equal(D.fromModel(D.modelName(c.id)), c);
}
const sorted = [...D.CARS].sort((a, b) => a.price - b.price);
const fastest = [...D.CARS].sort((a, b) => b.max - a.max).slice(0, 3).map((c) => c.id).sort();
assert.deepEqual(fastest, sorted.slice(-3).map((c) => c.id).sort(), 'the three priciest cars are the three fastest');
assert.equal(D.fromModel('SEDAN'), null);
console.log('PASS: car catalog (16 models, prices, handling, sizes, paints)');

const s = D.clean({}), w = { cash: 10000 };
assert.ok(!D.buy(s, w, 'vortex').ok, 'cannot afford');
const b = D.buy(s, w, 'brick', '#3d7fc6'); assert.ok(b.ok); assert.equal(w.cash, 10000 - 5200); assert.equal(b.car.color, '#3d7fc6');
assert.equal(D.buy(s, { cash: 1e6 }, 'brick', '#123456').car.color, D.BY.brick.colors[0], 'only catalog paints');
assert.ok(D.priceOf('vortex', 0.5) >= D.BY.vortex.price * 0.85, 'discount floor');
const sold = D.sell(s, w, b.car.uid); assert.ok(sold.ok && sold.cash === Math.round(5200 * 0.55)); assert.equal(s.owned.length, 1);
const big = D.clean({}), rich = { cash: 1e7 };
for (const id of ['brick', 'mule', 'ridgeback']) D.buy(big, rich, id);
let paid = D.milestones(big, rich); assert.equal(paid.length, 1); assert.equal(paid[0].n, 3); assert.equal(D.milestones(big, rich).length, 0, 'paid once');
D.buy(big, rich, 'brick'); assert.equal(D.models(big).size, 3, 'duplicates do not count twice');
for (const c of D.CARS) if (!D.models(big).has(c.id)) D.buy(big, rich, c.id);
paid = D.milestones(big, rich); assert.deepEqual(paid.map((m) => m.n), [6, 10]); assert.equal(D.title(big), 'Curator');
assert.ok(D.score(big) > D.score(s));
const full = D.clean({}); for (let i = 0; i < D.MAX_OWNED; i++) D.buy(full, { cash: 1e9 }, 'brick'); assert.ok(!D.buy(full, { cash: 1e9 }, 'brick').ok, 'garage list cap');
console.log('PASS: buy / sell / paint / milestones / caps');

const seen = {}; for (let k = 0; k < 400; k++) { const r = D.rareFor(k * D.SPAWN_WINDOW + 5, 10); assert.ok(D.BY[r.id] && r.spot >= 0 && r.spot < 10 && D.BY[r.id].colors.includes(r.color)); seen[r.id] = (seen[r.id] || 0) + 1; }
assert.ok(seen.monarch > seen.phantom, 'hypercars are the rarest sighting'); assert.ok(seen.phantom > 0);
assert.deepEqual(D.rareFor(1000), D.rareFor(2000), 'stable within a window');
console.log('PASS: rare street sightings (weighted, stable per window)');

assert.equal(C.value('CX:vortex', 100, '#ff8a1a', 0), D.BY.vortex.chop * C.hotMult('CX:vortex', '#ff8a1a', 0));
assert.equal(C.revinPrice('CX:monarch'), Math.round(D.BY.monarch.chop * C.REVIN_MULT));
assert.equal(C.value('SEDAN', 100, '#000000', 0), Math.round(800 * C.hotMult('SEDAN', '#000000', 0)));
console.log('PASS: chop shop values collection models');

const raw = { owned: [{ uid: 3, id: 'aurora', color: '#2a5a8a', x: 99999, y: 50, condition: 40 }, { uid: 3, id: 'brick' }, { uid: 5, id: 'nope' }, { uid: -1, id: 'brick' }], seen: { aurora: true, bad: true }, paid: [3, 7], next: 1 };
const cl = D.clean(raw); assert.equal(cl.owned.length, 1); assert.equal(cl.owned[0].x, 6568); assert.equal(cl.next, 4); assert.deepEqual(cl.paid, [3]); assert.deepEqual(cl.seen, { aurora: true });
assert.ok(/^[A-Z]{3} \d{3}$/.test(cl.owned[0].plate));
console.log('PASS: car collection save cleaning');
