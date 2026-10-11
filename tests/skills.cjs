// Skills engine (Claude-owned): level curve, XP, modifiers, save cleaning.
const assert = require('node:assert/strict');
const D = require('../skills-data.js');
const S = require('../skills.js');

// Level curve: level 1 at 0 XP; each level needs xpToNext(level).
assert.equal(S.levelInfo(0).level, 1);
assert.equal(S.levelInfo(D.xpToNext(1) - 1).level, 1);
assert.equal(S.levelInfo(D.xpToNext(1)).level, 2);
assert.equal(S.levelInfo(S.totalFor(10)).level, 10);
assert.equal(S.levelInfo(1e12).level, D.MAX_LEVEL, 'capped at max level');
assert.equal(S.levelInfo(S.MAX_XP).need, 0);
// The grind is meaningful but reachable: level 10 in hundreds of shots, not millions.
const shotsTo10 = Math.ceil(S.totalFor(10) / D.XP.shot);
assert.ok(shotsTo10 > 300 && shotsTo10 < 5000, `shots to Shooting 10: ${shotsTo10}`);
console.log('PASS: skill level curve, caps and pacing');

// Gaining XP and leveling up.
const st = S.clean({});
let r = S.gain(st, 'shooting', D.xpToNext(1));
assert.deepEqual([r.from, r.level, r.leveled], [1, 2, true]);
r = S.gain(st, 'shooting', 1);
assert.equal(r.leveled, false);
assert.equal(S.gain(st, 'nope', 100).level, 0, 'unknown skill ignored');
assert.equal(S.gain(st, 'luck', -50).level, 0, 'negative XP ignored');
assert.equal(S.gain(st, 'luck', NaN).level, 0, 'NaN XP ignored');
const before = st.xp.luck; S.gain(st, 'luck', 1e9);
assert.equal(st.xp.luck - before, 5000, 'single award is bounded');
console.log('PASS: XP gain, level-up detection and bounds');

// Modifiers: 1 at level 1, grow per level, clamp to min/max, unknown key = 1.
const fresh = S.clean({});
for (const sk of D.SKILLS) for (const pk of sk.perks) assert.equal(S.mod(fresh, pk.key), 1, pk.key);
assert.equal(S.mod(fresh, 'not.a.key'), 1);
const lv11 = S.clean({ xp: { shooting: S.totalFor(11) } });
assert.ok(Math.abs(S.mod(lv11, 'shooting.damage') - 1.2) < 1e-9, '+2%/level -> +20% at level 11');
assert.ok(S.mod(lv11, 'shooting.reload') < 1, 'reload time shrinks');
const maxed = S.clean({ xp: Object.fromEntries(D.SKILLS.map((s) => [s.id, S.MAX_XP])) });
for (const sk of D.SKILLS) for (const pk of sk.perks) {
  const m = S.mod(maxed, pk.key);
  if (pk.max !== undefined) assert.ok(m <= pk.max + 1e-9, `${pk.key} <= max`);
  if (pk.min !== undefined) assert.ok(m >= pk.min - 1e-9, `${pk.key} >= min`);
  assert.ok(m > 0 && Number.isFinite(m), `${pk.key} positive`);
}
console.log('PASS: perk modifiers grow per level and stay within caps');

// Saves: damaged or hostile data is cleaned.
const dirty = S.clean({ xp: { shooting: 1e15, luck: -5, driving: 'x', bogus: 99 }, seen: { delivery: 3, '__proto__': 1, bad: -1, x: 1.5 } });
assert.equal(dirty.xp.shooting, S.MAX_XP);
assert.equal(dirty.xp.luck, 0);
assert.equal(dirty.xp.driving, 0);
assert.equal(dirty.xp.bogus, undefined);
assert.deepEqual(dirty.seen, { delivery: 3 });
assert.deepEqual(Object.keys(S.clean(null).xp), D.SKILLS.map((s) => s.id));
console.log('PASS: skills save cleaning');

// Catalog sanity: unique ids/keys, every perk has a direction and label.
const ids = new Set(), keys = new Set();
for (const sk of D.SKILLS) {
  assert.ok(!ids.has(sk.id)); ids.add(sk.id);
  assert.ok(sk.name && sk.icon && sk.desc && sk.earn && sk.perks.length);
  for (const pk of sk.perks) { assert.ok(!keys.has(pk.key)); keys.add(pk.key); assert.ok(pk.label && pk.per !== 0); }
}
for (const want of ['shooting', 'athletics', 'luck', 'farming', 'dealing', 'driving']) assert.ok(ids.has(want), `owner asked for ${want}`);
console.log('PASS: skills catalog is complete and consistent');

// Pacing: every skill reaches level 10 in a sane amount of focused play (owner wants a grind, not a wall).
for (const sk of D.SKILLS) {
  const perMin = D.PACE[sk.id];
  assert.ok(perMin > 0, 'pace defined for ' + sk.id);
  const minutes = S.totalFor(10) / perMin;
  assert.ok(minutes >= 12 && minutes <= 90, `${sk.id} reaches level 10 in ${minutes.toFixed(0)} min of focused play`);
}
console.log('PASS: every skill reaches level 10 in 12-90 minutes of focused play');
