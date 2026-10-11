// Weapons (Claude-owned): catalog sanity, progression, purchases and magazine rules.
const assert = require('node:assert/strict');
const W = require('../weapons-data.js');
const p = W.BY_ID.pistol;
assert.deepEqual([p.dmg, p.rate, p.mag, p.pellets, p.price], [20, 180, 30, 1, 0], 'starter pistol matches the original game');
const ids = new Set();
for (const w of W.WEAPONS) {
  assert.ok(!ids.has(w.id)); ids.add(w.id);
  assert.ok(w.name && w.icon && w.desc);
  assert.ok(w.mag >= 1 && w.mag <= 30, w.id + ' magazine fits the game save cap');
  assert.ok(w.dmg > 0 && w.rate >= 60 && w.range > 0 && w.speed > 0 && w.spread >= 0 && w.pellets >= 1);
}
// Each step up the price ladder needs a higher Shooting level, and nothing is strictly worse than the pistol.
const ladder = W.WEAPONS.slice(1);
for (let i = 1; i < ladder.length; i++) assert.ok(ladder[i].price > ladder[i - 1].price && ladder[i].level > ladder[i - 1].level, 'ladder ' + ladder[i].id);
for (const w of ladder) assert.ok(W.dps(w) >= W.dps(p) * 0.9 || w.dmg >= 2 * p.dmg || w.range > p.range, w.id + ' has a reason to exist');
assert.equal(W.dps(W.BY_ID.ar), Math.max(...W.WEAPONS.map(W.dps)), 'the top-tier gun has the highest firepower');
console.log('PASS: weapons catalog and progression ladder');

const st = W.clean({});
assert.deepEqual(st, { version: 1, owned: ['pistol'], equipped: 'pistol' });
const wallet = { cash: 1000 };
assert.equal(W.buy(st, wallet, 'smg', 3).reason, 'Needs Shooting level 4');
assert.equal(W.buy(st, wallet, 'smg', 4).reason, 'Not enough cash');
assert.equal(W.buy(st, wallet, 'revolver', 2).ok, true);
assert.equal(wallet.cash, 100); assert.equal(st.equipped, 'revolver');
assert.equal(W.buy(st, wallet, 'revolver', 50).reason, 'Already owned');
assert.equal(W.buy(st, wallet, 'laser', 50).reason, 'Unknown weapon');
assert.equal(W.equip(st, 'ar'), false, 'cannot equip unowned');
assert.equal(W.cycle(st), 'pistol'); assert.equal(W.cycle(st), 'revolver');
console.log('PASS: buying, level gates, equipping and cycling');

const dirty = W.clean({ owned: ['ar', 'ar', 'bogus', 'smg'], equipped: 'bogus' });
assert.deepEqual(dirty.owned, ['pistol', 'ar', 'smg']); assert.equal(dirty.equipped, 'pistol');
assert.equal(W.clean({ owned: ['smg'], equipped: 'smg' }).equipped, 'smg');
assert.deepEqual(W.fitMagazine(30, 90, 6), { ammo: 6, reserve: 114 });
assert.deepEqual(W.fitMagazine(4, 90, 6), { ammo: 4, reserve: 90 });
assert.deepEqual(W.fitMagazine(30, 230, 6), { ammo: 6, reserve: 240 }, 'reserve cap');
const shot = W.pelletAngles(1, W.BY_ID.shotgun, () => 1);
assert.equal(shot.length, 6); assert.ok(shot.every((a) => Math.abs(a - 1 - 0.28) < 1e-9), 'spread bounded by weapon spread');
assert.deepEqual(W.pelletAngles(1, p, Math.random), [1], 'pistol has no spread');
console.log('PASS: weapon save cleaning, magazine fit and pellet spread');
