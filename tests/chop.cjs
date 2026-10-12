// Chop shop economy (Claude-owned).
const assert = require('node:assert/strict');
const D = require('../chop-data.js');
const SD = require('../supply-data.js');
assert.equal(D.family('#d03a2e'), 'red'); assert.equal(D.family('#3d7fd0'), 'blue'); assert.equal(D.family('#f1efe8'), 'white');
assert.equal(D.family('#1d2433'), 'black'); assert.equal(D.family('#e2b75c'), 'yellow'); assert.equal(D.family('#5e7a3a'), 'green');
console.log('PASS: paint families');

const now = 1.8e12, hot = D.hotList(now);
assert.ok(D.MODELS[hot.model] && D.FAMILIES.includes(hot.color) && hot.until > now);
const other = Object.keys(D.MODELS).find((m) => m !== hot.model);
const hotColor = { red: '#d03a2e', blue: '#3d7fd0', green: '#5e7a3a', yellow: '#e2b75c', white: '#f1efe8', black: '#1d2433' }[hot.color];
assert.equal(D.hotMult(hot.model, hotColor, now), 2);
assert.ok(D.value(hot.model, 100, hotColor, now) > D.value(other, 100, '#888888', now) * 1.5, 'hot list pays a lot more');
assert.ok(D.value('SEDAN', 100, '#808080', now) > D.value('SEDAN', 20, '#808080', now), 'wrecks pay less');
console.log('PASS: hot list and value');

for (let seed = 1; seed < 50; seed++) { const p = D.strip('VAN', 80, seed); for (const k of Object.keys(p)) assert.ok(SD.MATERIALS[k], `${k} is a material`); assert.ok(p.metal >= 6); }
console.log('PASS: strip parts are real materials');

const s = D.clean({}, now), w = { cash: 0 }, car = { model: 'SEDAN', condition: 90, color: '#808080', stolen: true };
assert.equal(D.deal(s, w, { ...car, stolen: false }, 'chop', now).ok, false);
const a = D.deal(s, w, car, 'chop', now); assert.ok(a.ok && a.cash > 0 && w.cash === a.cash);
const b = D.deal(s, w, car, 'strip', now + 1000, 1, 7); assert.ok(b.ok && b.items.metal > 0 && b.cash < a.cash);
assert.ok(D.deal(s, w, car, 'chop', now + 2000).ok);
assert.match(D.deal(s, w, car, 'chop', now + 3000).reason, /Lift's full/);
assert.ok(D.deal(s, w, car, 'chop', now + D.LIFT.windowMs + 1).ok, 'lift frees up after the window');
const poor = { cash: 10 }; assert.match(D.deal(s, poor, car, 'revin', now).reason, /Re-VIN costs/);
const rich = { cash: 1e5 }; assert.ok(D.deal(s, rich, car, 'revin', now).keep); assert.equal(rich.cash, 1e5 - D.revinPrice('SEDAN'));
for (const m of Object.keys(D.MODELS)) assert.ok(D.revinPrice(m) < 900 && D.revinPrice(m) >= 300, 'a re-VIN undercuts the $900 dealer price but is not free');
console.log('PASS: chop / strip / re-VIN deals and the lift limit');

const c = D.clean({ lift: [now - 1, now + 5e9, 'x', now - 2e9], stats: { chopped: 3, earned: -5, bogus: 9 } }, now);
assert.deepEqual(c.lift, [now - 1]); assert.equal(c.stats.chopped, 3); assert.equal(c.stats.earned, 0); assert.equal(c.stats.bogus, undefined);
console.log('PASS: save cleaning');
