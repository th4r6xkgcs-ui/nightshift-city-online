// Supply chains (Claude-owned): bag space, gathering (stock, hours, luck), processing, selling, shops, locker,
// starter fronts, and an economy simulation of the opening minutes and each chain's hourly rate.
const assert = require('node:assert/strict');
const S = require('../supply-data.js');
const W = require('../weapons-data.js');

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const s = S.clean({}, 0);
assert.equal(S.cap(s), 24); assert.equal(S.room(s), 24);
assert.deepEqual(S.give(s, { pipe: 20 }), { added: { pipe: 12 }, lost: { pipe: 8 } }, 'pipe takes 2 space each');
assert.equal(S.room(s), 0); assert.equal(S.fits(s, 'baggie'), 999, 'weightless packaging always fits');
S.take(s.bag, { pipe: 12 });
console.log('PASS: backpack space and weights');

// Gathering: guaranteed first row, stock runs dry and refills, hours, luck boosts rare rows.
let g = S.gather(s, 'scrapyard', { now: 0, rnd: () => 0 });
assert.ok(g.ok); assert.deepEqual(g.added, { metal: 1, pipe: 1, spring: 1, wood: 1, trigger: 1 });
g = S.gather(s, 'scrapyard', { now: 0, rnd: () => 0.99 }); assert.deepEqual(g.added, { metal: 2 });
const sp = S.GBY.scrapyard;
for (let i = 2; i < sp.stock; i++) { s.bag = {}; assert.ok(S.gather(s, 'scrapyard', { now: 0, rnd: () => 0.5 }).ok); }
const dry = S.gather(s, 'scrapyard', { now: 0 }); assert.ok(dry.dry); assert.equal(S.refillIn(s, 'scrapyard', 0), sp.regen);
assert.equal(S.stockNow(s, 'scrapyard', sp.regen * 1000 * 3 + 5), 3, 'refills one per regen period');
assert.ok(S.gather(s, 'construction', { now: 1e9, minute: 22 * 60 }).closed, 'construction site closes at night');
assert.ok(S.gather(s, 'boat', { now: 1e9, minute: 12 * 60 }).closed && S.gather(s, 'boat', { now: 1e9, minute: 23 * 60, rnd: () => 0 }).ok, 'boat only at night');
assert.ok(S.openAt([20, 5], 2 * 60) && !S.openAt([20, 5], 6 * 60) && S.openAt([6, 20], 6 * 60));
const lucky = S.gather(S.clean({}, 0), 'container', { now: 0, minute: 23 * 60, rnd: seq([0.9, 0.2, 0.9, 0.9, 0.9, 0.9, 0.9]), luck: 1.2 });
assert.ok(lucky.added.trigger === 1, 'luck lifts a rare roll over its base chance');
const full = S.clean({}, 0); full.bag.frame = 8; assert.ok(S.gather(full, 'scrapyard', { now: 0 }).full);
console.log('PASS: gathering (loot, stock + refill, opening hours, luck, full bag)');

// Processing: inputs in, product to the pocket (weed/coke) or bag (pills).
const pr = S.clean({}, 0), pocket = {};
pr.bag = { leaf: 7, baggie: 3 };
assert.equal(S.batches(pr, 'trim'), 2);
assert.ok(S.process(pr, 'trim', pocket).ok); assert.ok(S.process(pr, 'trim', pocket).ok);
const no = S.process(pr, 'trim', pocket); assert.ok(!no.ok); assert.deepEqual(no.need, [['leaf', 2]]);
assert.deepEqual(pocket, { weed: 2 }); assert.deepEqual(pr.bag, { leaf: 1, baggie: 1 });
pr.bag = { chem: 4, baggie: 2 }; S.process(pr, 'trailer', pocket); S.process(pr, 'trailer', pocket); assert.equal(pr.bag.pills, 6);
console.log('PASS: processing into pocket weed/coke and bagged pills');

// Pills: promoter demand + hours; buying from counters; bags; lockup; locker; fronts.
const w = { cash: 0 };
assert.ok(!S.sellPills(pr, w, 6, { minute: 12 * 60 }).ok);
const sold = S.sellPills(pr, w, 99, { now: 0, minute: 23 * 60 }); assert.equal(sold.n, 6); assert.equal(w.cash, 6 * S.PROMOTER.price);
const shop = S.clean({}, 0), wallet = { cash: 300 };
assert.equal(S.buy(shop, wallet, 'frame', 1, { counter: 'hardware' }).reason, 'Not sold here');
assert.ok(S.buy(shop, wallet, 'spring', 2).ok); assert.equal(wallet.cash, 250);
assert.equal(S.buyBag(shop, wallet, 2).reason, 'Get the Old school bag first');
assert.ok(S.buyBag(shop, wallet, 1).ok); assert.equal(S.cap(shop), 45);
assert.equal(S.buyLockup(shop, { cash: 10 }).reason, 'Needs $6,000');
const rich = { cash: 70000 }; for (let i = 0; i < 3; i++) assert.ok(S.buyLockup(shop, rich).ok); assert.equal(S.buyLockup(shop, rich).reason, 'Fully upgraded');
shop.bag = { metal: 10 }; assert.equal(S.store(shop, 'metal', 6), 6); assert.deepEqual([shop.bag.metal, shop.locker.metal], [4, 6]);
assert.ok(S.spendBoth(shop, { metal: 9 })); assert.deepEqual([shop.bag.metal, shop.locker.metal], [undefined, 1]);
assert.equal(S.withdraw(shop, 'metal', 5), 1);
const arms = S.clean({}, 0); for (let i = 0; i < S.ARMS_BUYER.demand; i++) S.armsSold(arms, 100, 0); assert.equal(S.armsLeft(arms, 1000), 0); assert.equal(S.armsLeft(arms, S.ARMS_BUYER.refill * 1000), S.ARMS_BUYER.demand);
console.log('PASS: promoter, counters, bags, lockup levels, home locker, arms-buyer demand');

// Save cleaning.
const dirty = S.clean({ bag: { metal: 5, nuke: 3, pipe: -2 }, bagLevel: 99, lockup: 7, stock: { scrapyard: { n: 999, at: 5 } } }, 1000);
assert.deepEqual(dirty.bag, { metal: 5 }); assert.equal(dirty.bagLevel, S.BAGS.length - 1); assert.equal(dirty.lockup, 3);
assert.equal(dirty.stock.scrapyard.n, S.GBY.scrapyard.stock);
console.log('PASS: save cleaning');

// ---- economy simulation ----
// 1) The first gun: from the apartment, walk to the scrapyard (~1000px at ~180px/s), dig until you have the pipe
// pistol's materials (tape comes from the hardware counter or the construction site), walk home, craft.
const avg = (sp2, item) => sp2.loot.filter(([it]) => it === item).reduce((t, [, c, a, b]) => t + c * (a + b) / 2, 0);
const need = W.BY_ID.pipe.craft.mats, yard = S.GBY.scrapyard;
const cyclesFor = (item) => Math.ceil((need[item] || 0) / avg(yard, item));
const cycles = Math.max(cyclesFor('metal'), cyclesFor('pipe'), cyclesFor('spring'));
const firstGunSeconds = 6 + cycles * yard.seconds + 6 + 15 /* tape detour */ + W.BY_ID.pipe.craft.seconds;
assert.ok(cycles <= yard.stock, 'one visit to the scrapyard is enough');
assert.ok(firstGunSeconds >= 45 && firstGunSeconds <= 180, `first gun takes ~1-3 minutes (${firstGunSeconds}s)`);
// 2) Each drug chain pays per hour of focused grinding, bounded by spot refills (the binding constraint), and the
// richer chains are riskier/needier (night, heat) — none should beat legit Empire fronts at the very top.
const perHour = (spotId, perUnit) => { const g2 = S.GBY[spotId]; return (3600 / g2.regen) * perUnit; };
const weedHr = perHour('plots', (1.5 / 3) * 52);          // 1.5 leaf/cycle, 3 leaf -> 1 weed, ~$52 avg dealer
const cokeHr = perHour('boat', 2 * 135);                   // 1 snow -> 2 coke, ~$135 avg dealer
const pillHr = perHour('pharmacy', (0.65 / 2) * 3 * S.PROMOTER.price);
for (const [name, v] of [['weed', weedHr], ['coke', cokeHr], ['pills', pillHr]]) assert.ok(v > 400 && v < 9000, `${name} ~$${Math.round(v)}/h`);
assert.ok(cokeHr > weedHr, 'coke (night, hot) pays more than weed');
console.log(`PASS: economy sim · first gun ~${firstGunSeconds}s · weed ~$${Math.round(weedHr)}/h · coke ~$${Math.round(cokeHr)}/h · pills ~$${Math.round(pillHr)}/h`);
