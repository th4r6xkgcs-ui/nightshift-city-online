// Vehicle styling (Claude-owned): options are well-formed, saves are tamper-proof, you pay only for what changed,
// flair feeds the car meet.
const assert = require('node:assert/strict');
const S = require('../carstyle-data.js');
const M = require('../carmeet-data.js');

for (const k of S.KEYS) {
  const o = S.OPT[k]; assert.ok(o.name && o.list.length >= 3, `${k} has choices`);
  assert.ok(o.list.some(([v]) => v === S.DEFAULT[k]), `${k} default is an option`);
  for (const [v, name, price] of o.list) assert.ok(typeof v === 'string' && name && Number.isInteger(price) && price >= 0, `${k}:${v}`);
}
const s = S.clean({ cars: { 'car-3': { rims: 'gold', spoiler: 'rocket', tint: 9 }, 'cx-12': { glow: '#3fa8ff' }, 'evil': { rims: 'gold' } }, spent: -5 });
assert.deepEqual(Object.keys(s.cars).sort(), ['car-3', 'cx-12']);
assert.equal(s.cars['car-3'].rims, 'gold'); assert.equal(s.cars['car-3'].spoiler, 'none', 'unknown option falls back'); assert.equal(s.cars['car-3'].tint, '0');
assert.equal(s.spent, 0); assert.deepEqual(S.clean(JSON.parse(JSON.stringify(s))), s, 'idempotent');

// paying for changes
const w = { cash: 1000 }, next = { ...S.styleOf(s, 'car-3'), spoiler: 'gt', hood: 'carbon' };
assert.equal(S.cost(S.styleOf(s, 'car-3'), next), 2800 + 2400);
assert.equal(S.apply(s, w, 'car-3', next).ok, false); assert.equal(w.cash, 1000, 'no charge when broke');
w.cash = 6000; const r = S.apply(s, w, 'car-3', next); assert.ok(r.ok); assert.equal(w.cash, 800); assert.equal(s.cars['car-3'].spoiler, 'gt');
assert.equal(S.apply(s, w, 'car-3', next).ok, false, 'nothing changed → nothing charged');
const back = { ...next, spoiler: 'none' }; assert.equal(S.cost(next, back), 0, 'removing a part is free');
assert.equal(S.apply(s, w, 'not-a-car', next).ok, false);
assert.ok(S.move(s, 'car-3', 'cx-99') && s.cars['cx-99'] && !s.cars['car-3'], 'style follows a re-VIN');

// flair → car meet score
assert.equal(S.flair(S.DEFAULT), 0);
const loud = { ...S.DEFAULT, finish: 'chrome', rims: 'gold', spoiler: 'gt', hood: 'carbon', livery: 'flames', glow: '#ff4ad8', exhaust: 'quad', lights: 'ice', tint: '3' };
assert.ok(S.flair(loud) >= 25 && S.flair(loud) <= 30);
const plain = M.score({ model: 'SEDAN', color: '#888888', condition: 100 }).total, built = M.score({ model: 'SEDAN', color: '#888888', condition: 100, flair: S.flair(loud) }).total;
assert.ok(built > plain + 20, 'a built car scores at the meet');
assert.notEqual(S.keyOf(loud), S.keyOf(S.DEFAULT));
console.log('carstyle: options, saves, pricing, flair OK');
