// Street races (Claude-owned): courses on roads, medals, payouts and save cleaning.
const assert = require('node:assert/strict');
const R = require('../races-data.js');
const XS = [440, 880, 1320, 1760], YS = [340, 680, 1020, 1360];
for (const r of R.RACES) {
  assert.ok(r.points.length >= 4, r.id);
  for (const [x, y] of r.points) assert.ok(XS.includes(x) || YS.includes(y), `${r.id} point ${x},${y} is on a road centre line`);
  for (let i = 1; i < r.points.length; i++) {
    const [a, b] = [r.points[i - 1], r.points[i]];
    assert.ok(a[0] === b[0] || a[1] === b[1], `${r.id} leg ${i} follows a straight road`);
  }
  assert.ok(R.par(r) > 3 && R.limit(r) > R.par(r) * 1.6);
}
assert.ok(R.par(R.BY_ID.loop) < R.par(R.BY_ID.docks) && R.par(R.BY_ID.docks) < R.par(R.BY_ID.tour), 'courses get longer');
console.log('PASS: race courses follow straight road legs between intersections');
const loop = R.BY_ID.loop, par = R.par(loop);
assert.equal(R.medal(loop, par).id, 'gold');
assert.equal(R.medal(loop, par * 1.2).id, 'silver');
assert.equal(R.medal(loop, par * 1.5).id, 'bronze');
assert.equal(R.medal(loop, par * 1.7), null);
assert.equal(R.medal(loop, NaN), null);
assert.equal(R.payout(loop, R.medal(loop, par), undefined), 700, 'first gold pays full');
assert.equal(R.payout(loop, R.medal(loop, par), par), 210, 'repeat gold pays 30%');
assert.equal(R.payout(loop, R.medal(loop, par), par * 1.2), 700, 'upgrading silver -> gold pays full');
assert.equal(R.payout(loop, R.medal(loop, par * 1.5), par), 74, 'bronze after gold pays 30% of bronze');
assert.equal(R.payout(loop, null, undefined), 0);
console.log('PASS: medals and payouts (full on improvement, 30% on repeats)');
const s = R.clean({ best: { loop: par * 0.9, docks: -1, tour: 'x', bogus: 5 }, runs: 3 });
assert.deepEqual(Object.keys(s.best), ['loop']); assert.equal(s.medals.loop, 'gold'); assert.equal(s.runs, 3);
assert.equal(R.fmt(65.25), '1:05.3'); assert.equal(R.fmt(NaN), '–');
console.log('PASS: race save cleaning and time format');
