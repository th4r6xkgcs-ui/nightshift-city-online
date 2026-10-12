// Bank heists + venues (Claude-owned): heist stages, payouts, cooldowns; gym and club math; saves.
const assert = require('node:assert/strict');
const H = require('../heists-data.js');
const V = require('../venues-data.js');
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
assert.equal(H.drillTime(1), 25); assert.equal(H.drillTime(2), 15, 'stealth shortens the drill, floor 60%');
const bank = H.BANKS[0];
assert.equal(H.payout(bank, 0, 1, seq(0.5)), 6000); assert.ok(H.payout(bank, 7, 2, seq(1)) > 9000, 'rank + luck raise the take');
const run = { stage: 'drill', drill: 10, progress: 0, last: 0 };
assert.equal(H.step(run, { now: 5, dist: 50, heat: 3, hp: 100, homeDist: 999 }), 'ok'); assert.equal(run.progress, 5);
assert.equal(H.step(run, { now: 6, dist: 120, heat: 3, hp: 100, homeDist: 999 }), 'ok', 'between reach and leave: no progress, no penalty'); assert.equal(run.progress, 5);
assert.equal(H.step(run, { now: 7, dist: 200, heat: 3, hp: 100, homeDist: 999 }), 'ok'); assert.equal(H.step(run, { now: 11, dist: 200, heat: 3, hp: 100, homeDist: 999 }), 'fail:you abandoned the vault');
const r2 = { stage: 'drill', drill: 4, progress: 0, last: 0 };
assert.equal(H.step(r2, { now: 4, dist: 10, heat: 3, hp: 100, homeDist: 999 }), 'escape');
assert.equal(H.step(r2, { now: 5, dist: 900, heat: 2, hp: 100, homeDist: 999 }), 'ok');
assert.equal(H.step(r2, { now: 6, dist: 900, heat: 0, hp: 100, homeDist: 999 }), 'paid', 'losing all heat pays');
const r3 = { stage: 'escape', last: 0 }; assert.equal(H.step(r3, { now: 1, dist: 0, heat: 4, hp: 100, homeDist: 50 }), 'paid', 'or stash at home');
const r4 = { stage: 'escape', last: 0 }; assert.equal(H.step(r4, { now: 1, dist: 0, heat: 4, hp: 0, homeDist: 999 }), 'fail:you went down and lost the bag');
const hs = H.clean({ cooldown: { west: Date.now() + 1e9, east: 5 }, done: 2, best: -1 });
assert.ok(hs.cooldown.west <= Date.now() + H.COOLDOWN_MS + 5, 'cooldown clamped'); assert.equal(hs.cooldown.east, undefined); assert.equal(H.ready(hs, 'east'), true); assert.equal(H.ready(hs, 'west'), false);
console.log('PASS: heist stages, payouts, abandon/escape/stash rules, cooldowns');
for (let rep = 0; rep < 12; rep++) { const z = V.sweet(rep, seq(0.5)); assert.ok(z.from >= 0 && z.to <= 1 && z.to - z.from >= 0.12 - 1e-9); }
assert.ok(V.sweet(9, seq(0.5)).to - V.sweet(9, seq(0.5)).from < V.sweet(0, seq(0.5)).to - V.sweet(0, seq(0.5)).from, 'fatigue narrows the zone');
assert.deepEqual(V.gymXp(8, 'cardio'), { athletics: 240 }); assert.deepEqual(V.gymXp(8, 'weights'), { toughness: 240 }); assert.deepEqual(V.gymXp(8, 'mixed'), { athletics: 120, toughness: 120 });
assert.equal(V.bustChance(1), 0.12); assert.equal(V.bustChance(0.5), 0.06); assert.equal(V.bustChance(0.1), 0.03, 'never below 3%');
assert.equal(V.clubPrice(120, 1), 156); assert.equal(V.clubPrice(120, 1.5), 234);
const vs = V.clean({ gymAt: 9e15, sessions: 3, clubAt: { south: 5, bogus: 7 }, sold: -2 }, 1e6);
assert.equal(vs.gymAt, 0); assert.equal(vs.sessions, 3); assert.deepEqual(vs.clubAt, { south: 5 }); assert.equal(vs.sold, 0);
console.log('PASS: gym sweet spot, XP split, club risk/price, venue save cleaning');
