// Daily/weekly challenges (Claude-owned): deterministic picks, baselines, payouts, streaks, save.
const assert = require('node:assert/strict');
const D = require('../dailies-data.js');
const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
assert.equal(D.dayKey(day(2026, 10, 11)), '2026-10-11');
assert.equal(D.prevDay('2026-11-01'), '2026-10-31'); assert.equal(D.prevDay('2026-01-01'), '2025-12-31');
assert.equal(D.weekKey(day(2026, 10, 11)), '2026-W41'); assert.equal(D.weekKey(day(2026, 10, 12)), '2026-W42');
const a = D.picks('2026-10-11'), b = D.picks('2026-10-11'), c = D.picks('2026-10-12');
assert.deepEqual(a, b, 'same day, same challenges'); assert.notDeepEqual(a, c, 'next day, new challenges');
for (let i = 0; i < 400; i++) {
  const k = D.dayKey(new Date(2026, 0, 1 + i)), ps = D.picks(k);
  assert.equal(new Set(ps.map((p) => p.id)).size, 3, 'three different challenge types');
  for (const p of ps) { assert.ok(D.BY_ID[p.id].n.includes(p.n)); assert.ok(p.cash >= 100 && p.cash <= 1500, `${p.id} reward ${p.cash}`); }
}
console.log('PASS: deterministic daily picks (3 distinct, sane rewards) and date keys');
const s = D.clean({});
const st = Object.fromEntries([...new Set(D.POOL.map((c) => c.stat))].map((k, i) => [k, 100 + i * 7])); // every stat any challenge uses
let r = D.roll(s, day(2026, 10, 11), st);
assert.ok(r.newDay && r.newWeek); assert.deepEqual(s.base, st, 'baseline = current lifetime stats (nothing retroactive)');
assert.deepEqual(D.claim(s, day(2026, 10, 11), st), [], 'no progress, no pay');
const today = D.picks(s.day), done = { ...st };
for (const p of today) done[D.BY_ID[p.id].stat] = st[D.BY_ID[p.id].stat] + p.n;
const pays = D.claim(s, day(2026, 10, 11), done);
assert.equal(pays.filter((p) => p.kind === 'daily').length, 3);
assert.deepEqual(pays.find((p) => p.kind === 'streak'), { kind: 'streak', cash: 250, text: 'Daily streak ×1' });
assert.equal(s.streak, 1); assert.deepEqual(D.claim(s, day(2026, 10, 11), done), [], 'pays once');
console.log('PASS: baselines, completion payouts once, streak start');
// next day: streak continues; rewards boosted by 10%
D.roll(s, day(2026, 10, 12), done); assert.equal(s.streak, 1, 'streak kept after a completed day');
const t2 = D.picks(s.day), done2 = { ...done };
for (const p of t2) done2[D.BY_ID[p.id].stat] = done[D.BY_ID[p.id].stat] + p.n;
const p2 = D.claim(s, day(2026, 10, 12), done2);
assert.equal(s.streak, 2); assert.equal(p2.find((p) => p.kind === 'daily').cash, Math.round(t2[0].cash * 1.1), 'streak bonus +10% (×1 streak at claim time)');
// skipping a day breaks it
r = D.roll(s, day(2026, 10, 14), done2); assert.ok(r.streakBroken); assert.equal(s.streak, 0); assert.equal(s.best, 2);
// counter going backwards (backup restore) re-baselines instead of going negative
D.roll(s, day(2026, 10, 14), { ...done2, delivery: 0 }); assert.equal(s.base.delivery, 0);
console.log('PASS: streak growth, +10% bonus, break on a missed day, safe re-baselining');
const w = D.weekly('2026-W41'); assert.ok(w.n >= D.BY_ID[w.id].n[1] * 6 && w.cash > 1000);
const s3 = D.clean({}); D.roll(s3, day(2026, 10, 11), st);
const wk = { ...st, [D.BY_ID[w.id].stat]: st[D.BY_ID[w.id].stat] + w.n };
assert.ok(D.claim(s3, day(2026, 10, 11), wk).some((p) => p.kind === 'weekly')); assert.equal(s3.weekClaimed, true);
const dirty = D.clean({ day: 'x', claimed: [0, 0, 5, -1, 2], base: { delivery: -3, 'bad key!': 1 }, streak: -2, best: 9, week: '2026-W41', weekClaimed: 'yes' });
assert.equal(dirty.day, ''); assert.deepEqual(dirty.claimed, [0, 2]); assert.deepEqual(dirty.base, { delivery: 0 }); assert.equal(dirty.streak, 0); assert.equal(dirty.best, 9); assert.equal(dirty.weekClaimed, false);
assert.equal(D.label({ id: 'drive', n: 5000 }), 'Drive 5 km'); assert.equal(D.fmtProgress({ id: 'drive', n: 5000 }, 2500), '2.5/5 km');
console.log('PASS: weekly challenge, save cleaning and labels');
