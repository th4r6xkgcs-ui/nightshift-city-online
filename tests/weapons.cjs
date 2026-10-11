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
assert.deepEqual(st, { version: 1, owned: ['pistol'], equipped: 'pistol', mods: {}, armor: 0 });
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

// Mods: per gun, gated, stats applied by effective(); save keeps only mods on owned guns.
const ms = W.clean({ owned: ['smg'] }), mw = { cash: 5000 };
assert.equal(W.buyMod(ms, mw, 'rifle', 'scope', 10).reason, 'Buy the gun first');
assert.equal(W.buyMod(ms, mw, 'smg', 'scope', 4).reason, 'Needs Shooting level 5');
assert.equal(W.buyMod(ms, mw, 'smg', 'extmag', 4).ok, true); assert.equal(W.buyMod(ms, mw, 'smg', 'extmag', 4).reason, 'Already fitted');
W.buyMod(ms, mw, 'smg', 'grip', 4); W.buyMod(ms, mw, 'smg', 'scope', 9); W.buyMod(ms, mw, 'smg', 'suppressor', 9);
assert.equal(mw.cash, 5000 - 900 - 700 - 800 - 1200);
const e = W.effective(W.BY_ID.smg, ms.mods.smg);
assert.equal(e.mag, 30, 'extended mag respects the 30-round save cap'); assert.equal(W.effective(W.BY_ID.shotgun, ['extmag']).mag, 9);
assert.ok(Math.abs(e.spread - 0.09 * 0.5 * 0.6) < 1e-9); assert.equal(e.range, Math.round(380 * 1.35)); assert.equal(e.suppressed, true);
assert.deepEqual(W.effective(W.BY_ID.pistol, []).mag, 30); assert.equal(W.effective(W.BY_ID.pistol).suppressed, false);
assert.deepEqual(W.clean({ owned: ['smg'], mods: { smg: ['scope', 'scope', 'Bad!'], ar: ['scope'] } }).mods, { smg: ['scope'] });
console.log('PASS: weapon mods (gating, stacking stats, mag cap, save cleaning)');

// Armor: absorbs 70% of each hit until depleted; save clamps to 0..100.
assert.deepEqual(W.absorb(50, 20), { armor: 36, dmg: 6 });
assert.deepEqual(W.absorb(5, 20), { armor: 0, dmg: 15 }, 'thin armor soaks what it has');
assert.deepEqual(W.absorb(0, 20), { armor: 0, dmg: 20 });
assert.equal(W.clean({ armor: 999 }).armor, 100); assert.equal(W.clean({ armor: -3 }).armor, 0);
console.log('PASS: body armor absorption and save');
