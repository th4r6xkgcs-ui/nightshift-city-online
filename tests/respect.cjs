// Respect rank (Claude-owned): points, caps, ranks, one-time rank-up payouts, save.
const assert = require('node:assert/strict');
const R = require('../respect-data.js');
assert.equal(R.points({}).total, 0); assert.equal(R.rankOf(0).name, 'Nobody');
assert.ok(R.MAX_POINTS >= R.RANKS[R.RANKS.length - 1].min, 'Legend is reachable');
for (let i = 1; i < R.RANKS.length; i++) assert.ok(R.RANKS[i].min > R.RANKS[i - 1].min, 'ranks ascend');
// A fresh-ish player: 9 skills at ~Lv3 (27 levels), 6 goals -> 270 + 150 = 420 -> Street Rat.
assert.equal(R.rankOf(R.points({ skillLevels: 27, goals: 6 }).total).name, 'Street Rat');
// Caps: one grind can't carry you (max money alone = 200 points).
assert.equal(R.points({ earned10k: 1e9 }).total, 200);
assert.equal(R.points({ gold: 99 }).total, 180);
// Maxed everything = Legend.
const maxed = { skillLevels: 450, goals: 50, gold: 3, weapons: 6, homeItems: 5, tuneLevels: 50, bestStreak: 20, earned10k: 200 };
assert.equal(R.rankOf(R.points(maxed).total).name, 'Legend');
console.log('PASS: respect points, caps and rank ladder');
const s = R.clean({});
assert.deepEqual(R.advance(s, 0), []);
const up = R.advance(s, 1400);
assert.deepEqual(up.map((u) => [u.name, u.cash]), [['Street Rat', 1000], ['Hustler', 2000], ['Earner', 3000]], 'catch-up pays each rank once');
assert.deepEqual(R.advance(s, 1400), [], 'no double pay'); assert.deepEqual(R.advance(s, 200), [], 'dropping points never un-ranks or re-pays');
assert.equal(s.reached, 3);
assert.equal(R.clean({ reached: 99 }).reached, R.RANKS.length - 1); assert.equal(R.clean({ reached: -1 }).reached, 0);
const r = R.rankOf(1000); assert.equal(r.name, 'Hustler'); assert.equal(r.toNext, 300); assert.ok(Math.abs(r.progress - 0.5) < 1e-9);
console.log('PASS: one-time rank-up payouts, progress and save cleaning');
