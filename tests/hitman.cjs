// Hitman contracts (Claude-owned): offers, ranks, accept/complete/drop, save cleaning, mark placement in break-ins.
const assert = require('node:assert/strict');
const H = require('../hitman-data.js');
const B = require('../breakin-data.js');

// offers: 3 per window, unique places, rank-gated tiers, pay inside the tier range × rank
const s0 = H.clean({});
for (let w = 0; w < 50; w++) {
  const now = w * H.OFFER_MS + 1000, offers = H.offers(s0, now);
  assert.ok(offers.length >= 1 && offers.length <= 3);
  assert.equal(new Set(offers.map((o) => o.loc.id)).size, offers.length, 'no duplicate places');
  assert.equal(new Set(offers.map((o) => o.name)).size, offers.length, 'no duplicate marks');
  for (const o of offers) {
    assert.equal(o.type, 'house', 'Rookies only get houses');
    assert.ok(o.pay >= H.TIER.house.pay[0] - 50 && o.pay <= H.TIER.house.pay[1] + 50);
    assert.ok(B.TYPES[o.type], 'contract type is a break-in type');
    assert.ok(o.until > now);
  }
}
const pro = H.clean({ done: 8 });
assert.equal(H.rankOf(8).name, 'Professional');
let sawMansion = false, sawWh = false;
for (let w = 0; w < 50; w++) for (const o of H.offers(pro, w * H.OFFER_MS)) { if (o.type === 'mansion') sawMansion = true; if (o.type === 'warehouse') sawWh = true; }
assert.ok(sawMansion && sawWh, 'Professionals see warehouses and the estate');
assert.ok(H.rankMult(25) > H.rankMult(0));
console.log('PASS: contract board (3 per window, rank-gated places, pay ranges)');

// accept → complete with bonuses, rank-up, failure paths
const s = H.clean({}), now = 5 * H.OFFER_MS + 10, o = H.offers(s, now)[0];
assert.ok(H.accept(s, o, now).ok); assert.ok(!H.accept(s, o, now).ok, 'one at a time');
const r = H.complete(s, { killed: true, alarm: false, otherKills: 0 });
assert.equal(r.paid, Math.round(o.pay * 1.75)); assert.ok(r.silent && r.clean); assert.equal(s.done, 1); assert.equal(s.silent, 1);
assert.ok(!H.accept(s, o, now).ok, 'taken offers cannot be re-accepted');
const o2 = H.offers(s, now)[1]; H.accept(s, o2, now);
const loud = H.complete(s, { killed: true, alarm: true, otherKills: 2 }); assert.equal(loud.paid, o2.pay);
const o3 = H.offers(s, now)[2]; H.accept(s, o3, now);
const fail = H.complete(s, { killed: false, escaped: true }); assert.ok(fail.failed && fail.paid === 0 && /away/.test(fail.reason)); assert.equal(s.failed, 1);
const s3 = H.clean({ done: 2 }); H.accept(s3, H.offers(s3, now)[0], now); const up = H.complete(s3, { killed: true, alarm: true, otherKills: 1 }); assert.equal(up.rankUp, 'Cleaner');
console.log('PASS: accept / complete (silent +50%, clean +25%), failures, rank-up');

// save cleaning: junk dropped, expired contracts dropped, valid active contract kept
const act = { ...H.offers(H.clean({}), now)[0], expires: now + 60000 };
const kept = H.clean({ done: 3, earned: 9000, active: act, taken: ['a', 5] }, now);
assert.equal(kept.done, 3); assert.equal(kept.active.loc.id, act.loc.id); assert.deepEqual(kept.taken, ['a']);
assert.equal(H.clean({ active: { ...act, expires: now - 1 } }, now).active, null);
assert.equal(H.clean({ active: { ...act, loc: { id: 'nope' } } }, now).active, null);
assert.equal(H.clean({ done: -4, earned: 'x' }).done, 0);
assert.ok(H.expired({ active: { expires: 10 } }, 11));
console.log('PASS: hitman save cleaning');

// the mark goes in the room furthest from the back door, never the entry room; bodyguards are added
for (const type of ['house', 'warehouse', 'mansion']) for (let seed = 1; seed <= 30; seed++) {
  const L = B.generate(type, seed), c = { name: 'Test Mark', color: '#123456', guards: H.TIER[type].guards, hp: H.TIER[type].hp, armed: true };
  const extra = B.addMark(L, c, B.rngOf(seed));
  const mark = extra.find((g) => g.kind === 'mark');
  assert.ok(mark && mark.hp === c.hp && mark.name === 'Test Mark');
  assert.notEqual(B.roomAt(L, mark.x, mark.y)?.i, L.entryRoom, 'mark is not by the back door');
  assert.equal(extra.filter((g) => g.kind === 'bodyguard').length, c.guards);
  for (const g of extra) { assert.ok(B.roomAt(L, g.x, g.y), `${g.kind} inside a room`); for (const p of g.route) assert.ok(B.roomAt(L, p.x, p.y)); }
  assert.equal(B.farRoom(L).i === L.entryRoom, L.rooms.length === 1);
}
console.log('PASS: marks + bodyguards placed inside, away from the back door, for 90 layouts');
