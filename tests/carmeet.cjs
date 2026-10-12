// Night car meet (Claude-owned): scoring, rivals, prizes, one show per car per night, save cleaning.
const assert = require('node:assert/strict');
global.NightshiftCarsData = require('../cars-data.js');
const M = require('../carmeet-data.js');

assert.ok(M.isOpen(21 * 60) && M.isOpen(23 * 60 + 59) && M.isOpen(60) && !M.isOpen(3 * 60) && !M.isOpen(12 * 60));
assert.equal(M.nightKey(5, 22 * 60), 5); assert.equal(M.nightKey(6, 60), 5, 'after midnight is still last night');
const hatch = M.score({ model: 'CX:brick', color: '#c84659', condition: 100 }).total, hyper = M.score({ model: 'CX:phantom', color: '#e8eef4', condition: 100 }).total;
assert.ok(hyper > hatch * 4, 'a hypercar outscores a hatch');
const kitted = M.score({ model: 'CX:bulldog', kit: 'muscle', tune: { engine: 3, handling: 3, armor: 2 }, color: '#1d2433', condition: 100 });
assert.ok(kitted.total > M.score({ model: 'CX:bulldog', color: '#e0473a', condition: 100 }).total + 40, 'kit + tuning + paint matter');
assert.ok(M.score({ model: 'CX:bulldog', condition: 10 }).total < M.score({ model: 'CX:bulldog', condition: 100 }).total, 'dents cost points');
assert.ok(M.score({ model: 'SEDAN', condition: 100 }).total > 0);
console.log('PASS: car meet scoring');

for (let k = 0; k < 50; k++) { const f = M.rivals(k); assert.equal(f.length, 5); assert.equal(new Set(f.map((r) => r.name)).size, 5); for (let i = 1; i < 5; i++) assert.ok(f[i - 1].score >= f[i].score); assert.deepEqual(M.rivals(k), f, 'stable per night'); }
console.log('PASS: rivals (5 per night, sorted, stable)');

const s = M.clean({}), w = { cash: 0 };
const win = M.show(s, w, 10, 'cx-1', { model: 'CX:phantom', kit: 'lux', tune: { engine: 3, handling: 3, armor: 3 }, color: '#3ad0ff', condition: 100 });
assert.ok(win.ok && win.place === 1 && win.prize.trophy === 'gold'); assert.equal(w.cash, 2500); assert.equal(s.trophies.gold, 1);
assert.ok(!M.show(s, w, 10, 'cx-1', { model: 'CX:phantom' }).ok, 'once per car per night');
const lose = M.show(s, w, 10, 'car-0', { model: 'SEDAN', condition: 30 }); assert.ok(lose.ok && lose.place === 6 && !lose.prize);
assert.ok(M.show(s, w, 11, 'cx-1', { model: 'CX:phantom', kit: 'lux', tune: { engine: 3, handling: 3, armor: 3 }, color: '#3ad0ff' }).ok, 'next night is fine');
const c = M.clean(JSON.parse(JSON.stringify(s))); assert.equal(c.trophies.gold, 2); assert.equal(c.shows, 3); assert.ok(c.nights['10'].entered.includes('cx-1'));
assert.equal(M.clean({ trophies: { gold: -2 }, nights: { x: 1 } }).trophies.gold, 0);
console.log('PASS: prizes, entries and save cleaning');
