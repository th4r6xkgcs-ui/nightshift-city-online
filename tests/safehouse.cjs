// Your stash house (Claude-owned): takeover rules, storage caps, passive crew sales, wages, raids and security.
const assert = require('node:assert/strict');
const H = require('../safehouse-data.js');
const ID = 'bi-stash-south', t0 = 1e12;
const s = H.clean({}, t0), w = { cash: 50000 };
assert.ok(!H.takeOver(s, w, ID, t0).ok, 'must clear it first');
s.cleared[ID] = t0 - 1000; assert.ok(!H.takeOver(s, { cash: 100 }, ID, t0).ok, 'costs money');
const r = H.takeOver(s, w, ID, t0); assert.ok(r.ok && H.owns(s, ID)); assert.equal(w.cash, 50000 - H.TAKEOVER);
const h = s.houses[ID], pocket = { weed: 500, coke: 10 };
assert.equal(H.moveProduct(h, pocket, 'weed', 999, 1), H.CAP, 'storage cap'); assert.equal(pocket.weed, 100);
assert.equal(H.moveProduct(h, pocket, 'weed', 50, -1), 50); assert.equal(h.stock.weed, H.CAP - 50);
assert.equal(H.moveCash(h, w, 5000, 1), 5000); assert.equal(h.cash, 5000);
// passive sales: small ticks add up (fractions carry)
const before = h.stock.weed; let earned = 0; for (let i = 0; i < 360; i++) earned += H.tick(h, t0 + (i + 1) * 10000).earned; // one hour in 10 s steps
assert.equal(before - h.stock.weed, H.SELL_RATE.weed, 'sells the hourly rate even in small ticks'); assert.equal(earned, Math.round(H.SELL_RATE.weed * 60 * 0.7) * 1 || earned);
assert.ok(earned > 0 && h.earned === earned);
// wages: guards are paid from the stash; no money → one quits
h.sec.guards = 2; const cash0 = h.cash; H.tick(h, t0 + 2 * 3600000); assert.ok(h.cash < cash0 + 2 * 8 * 60, 'wages come out');
h.cash = 0; h.stock.weed = 0; h.stock.coke = 0; H.tick(h, t0 + 3 * 3600000); assert.equal(h.sec.guards, 1, 'an unpaid guard walks');
// security lowers raid odds and losses
const bare = H.clean({ houses: { [ID]: { owned: true, cash: 40000, stock: { weed: 300 } } } }, t0).houses[ID];
const tight = H.clean({ houses: { [ID]: { owned: true, cash: 40000, stock: { weed: 300 }, sec: { door: 3, alarm: 1, cameras: 1, dog: 1, guards: 2, safe: 2 } } } }, t0).houses[ID];
assert.ok(H.security(tight) > 0.8 && H.security(bare) === 0);
let a = 0, b = 0; for (let i = 0; i < 2000; i++) { const x = (i * 0.618) % 1; if (H.raidRoll(bare, t0 + 1e8, () => x)) a++; if (H.raidRoll(tight, t0 + 1e8, () => x)) b++; }
assert.ok(a > b * 4, `security cuts raids (${a} vs ${b})`);
assert.equal(H.raidRoll(bare, bare.lastRaid + 1000, () => 0), false, 'cooldown between raids');
const lb = H.raidLoss({ ...bare, stock: { ...bare.stock }, sec: { ...bare.sec } }, t0), lt = H.raidLoss({ ...tight, stock: { ...tight.stock }, sec: { ...tight.sec } }, t0);
assert.ok(lb.cash > lt.cash * 5 && lb.weed > lt.weed, 'safe + security protect');
assert.ok(H.raiders(tight) < H.raiders(bare) && H.raiders(tight) >= 2);
assert.equal(H.upgrade(s, { cash: 0 }, ID, 'door').ok, false); const up = H.upgrade(s, { cash: 99999 }, ID, 'door'); assert.ok(up.ok && up.level === 1);
const c = H.clean(JSON.parse(JSON.stringify(s)), t0 + 1); assert.ok(H.owns(c, ID)); assert.equal(c.houses[ID].sec.door, 1);
assert.deepEqual(H.clean({ houses: { 'bad id': { owned: true } } }).houses, {});
console.log('PASS: stash house takeover, storage, passive sales, wages, raids vs security, save cleaning');
