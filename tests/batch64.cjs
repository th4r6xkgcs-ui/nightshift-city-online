// v0.64 (Claude): melee, driving, properties and story rules (pure modules).
const assert = require('node:assert/strict');
const M = require('../melee-data.js'), DR = require('../driving-data.js'), PR = require('../property-data.js'), S = require('../story-data.js'), CD = require('../city-data.js');

// ---- melee ----
const a = { x: 0, y: 0, angle: 0 };
assert.ok(M.hit(a, { x: 30, y: 0 }, 'fists'), 'in front, in reach');
assert.ok(!M.hit(a, { x: -30, y: 0 }, 'fists'), 'behind the swing misses');
assert.ok(!M.hit(a, { x: 80, y: 0 }, 'fists'), 'out of reach');
assert.ok(M.hit(a, { x: 48, y: 10 }, 'bat') && !M.hit(a, { x: 48, y: 10 }, 'knife'), 'bat reaches further than a knife');
// takedown: target facing away (angle 0 = facing +x, attacker at -x side is behind it)
assert.ok(M.takedown({ x: 0, y: 0, angle: 0 }, { x: 20, y: 0, angle: 0 }, 'fists'), 'behind an unaware target');
assert.ok(!M.takedown({ x: 0, y: 0, angle: 0 }, { x: 20, y: 0, angle: Math.PI }, 'fists'), 'not from the front');
assert.ok(!M.takedown({ x: 0, y: 0, angle: 0 }, { x: 20, y: 0, angle: 0, mode: 'fight' }, 'fists'), 'not on someone already fighting');
const c = { step: 0, last: 0 }; const s1 = M.swing(c, 'fists', 1000), s2 = M.swing(c, 'fists', 1400), s3 = M.swing(c, 'fists', 1800), s4 = M.swing(c, 'fists', 5000);
assert.deepEqual([s1.step, s2.step, s3.step, s4.step], [0, 1, 2, 0], 'combo advances and resets after a pause');
assert.ok(s3.finisher && !s1.finisher);
assert.ok(M.damage('fists', 2, 0, () => 0) > M.damage('fists', 0, 0, () => 0), 'finisher hits harder');
assert.ok(M.damage('fists', 0, 10, () => 0) > M.damage('fists', 0, 0, () => 0), 'toughness adds damage');
const ms = M.clean({ owned: ['bat', 'nope', 'fists'], equipped: 'bat', takedowns: 3 }); assert.deepEqual(ms.owned, ['fists', 'bat']); assert.equal(ms.equipped, 'bat'); assert.equal(ms.takedowns, 3);
assert.equal(M.clean({ equipped: 'machete' }).equipped, 'fists', 'cannot equip what you do not own');
const w = { cash: 100 }; assert.equal(M.buy(ms, 'knife', w).ok, false); w.cash = 500; assert.ok(M.buy(ms, 'knife', w).ok); assert.equal(w.cash, 320);
assert.equal(M.rollAt(0), 0); assert.equal(M.rollAt(1), 1); assert.ok(M.rollAt(0.5) > 0.5, 'roll eases out');
console.log('PASS: melee reach/arc, takedowns, combos, damage scaling, saves, shop, roll');

// ---- driving ----
const car = { speed: 5, angle: 0, drift: 0 };
let r = DR.step(car, { thrust: 1, steer: 1, brake: true, dt: 1 });
assert.ok(r.drifting && r.brake === false, 'brake + steer at speed = drift, no hard braking');
assert.ok(car.angle > 0 && car.drift > 0, 'drifting yaws the car and builds slip');
r = DR.step({ speed: 1, angle: 0 }, { steer: 1, brake: true, dt: 1 }); assert.ok(!r.drifting && r.brake, 'too slow: it is just braking');
const ch = DR.newChain(); let out = null; car.drift = 0.5; car.speed = 6;
for (let i = 0; i < 120; i++) DR.score(ch, car, true, 1 / 60);
car.drift = 0; for (let i = 0; i < 60 && !out; i++) out = DR.score(ch, car, false, 1 / 60);
assert.ok(out && out.points > 100 && out.cash > 0 && out.xp > 0, 'a 2 s drift chain pays out after straightening');
assert.deepEqual([100, 70, 40, 20, 5].map(DR.stage), [0, 1, 2, 3, 4], 'damage stages');
const dc = { fuel: 50, condition: 80, nitro: 0 }, wal = { cash: 1000 }; assert.equal(DR.quote(dc).fuel, 40); assert.ok(DR.service(dc, wal, 'fuel').ok); assert.equal(dc.fuel, 100); assert.equal(DR.service(dc, wal, 'fuel').ok, false, 'full tank');
assert.ok(DR.service(dc, wal, 'nitro').ok); dc.speed = 3; const n = DR.nitro(dc, true, 1); assert.ok(n.active && dc.nitro < 100);
const gas = DR.gasStations(CD.createBuildings()); assert.ok(gas.length >= 5, 'gas stations exist in the outer lots');
console.log('PASS: drift physics + scoring, damage stages, gas station services, nitro');

// ---- properties ----
const B = CD.createBuildings(), cat = PR.catalog(B, () => ({ name: 'DOWNTOWN' }));
assert.ok(cat.length > 40, 'plenty of storefronts for sale'); assert.ok(cat.every((p) => !(p.b.x < 2200 && p.b.y < 1700)), 'core is not for sale');
assert.equal(new Set(cat.map((p) => p.id)).size, cat.length, 'stable unique ids');
const shop = cat.find((p) => p.type === 'CORNER SHOP'), byId = { [shop.id]: shop }, ps = PR.clean({}), wl = { cash: shop.price - 1 };
assert.equal(PR.buy(ps, shop, wl).ok, false); wl.cash += 1; assert.ok(PR.buy(ps, shop, wl, 'local', 0).ok); assert.equal(wl.cash, 0);
PR.accrue(ps, byId, 3600000); assert.equal(Math.floor(ps.props[shop.id].register), shop.perHour, 'one hour of income');
PR.accrue(ps, byId, 100 * 3600000); assert.equal(Math.round(ps.props[shop.id].register), PR.cap(shop, ps.props[shop.id]), 'register caps');
assert.ok(PR.collect(ps, shop, wl, 100 * 3600000) > 0 && wl.cash > 0);
wl.cash = 1e6; assert.ok(PR.upgrade(ps, shop, 'security', wl).ok); assert.ok(PR.robberyChance(shop, ps.props[shop.id], 3600) < PR.robberyChance(shop, { ...ps.props[shop.id], security: 0 }, 3600), 'security cuts robberies');
assert.ok(PR.defendChance({ security: 3, guard: true }) > PR.defendChance({}), 'guard + security defend better');
const cleaned = PR.clean(JSON.parse(JSON.stringify(ps)), 200 * 3600000); assert.ok(cleaned.props[shop.id] && cleaned.props[shop.id].security === 1);
assert.equal(Object.keys(PR.clean({ props: { bogus: {}, 'p-1-2': { stock: 99 } } }).props).length, 1); assert.equal(PR.clean({ props: { 'p-1-2': { stock: 99 } } }).props['p-1-2'].stock, 3);
const before = wl.cash, back = PR.sell(ps, shop, wl); assert.ok(back > 0 && wl.cash === before + back && !ps.props[shop.id]);
console.log('PASS: property catalog, buy, income + cap, collect, upgrades, robbery odds, saves, sell');

// ---- story ----
assert.equal(S.CHAPTERS.length, 8);
for (const ch of S.CHAPTERS) { assert.ok(S.CONTACTS[ch.from] || ch.from === 'rico', ch.id); for (const st of ch.steps) { assert.ok(st.label && st.text, ch.id); if (st.at) { assert.ok(st.at.x > 0 && st.at.x < CD.WIDTH && st.at.y > 0 && st.at.y < CD.HEIGHT); const yy = st.at.y % 340; assert.ok(yy >= 254 && yy <= 278, `${ch.id} spot on a sidewalk`); } } }
const ss = S.clean({}); assert.equal(S.current(ss).id, 'bus'); S.advance(ss); assert.equal(ss.step, 1); const rr = S.advance(ss); assert.ok(rr.chapterDone); assert.equal(S.current(ss).id, 'wheels');
assert.ok(S.matches({ kind: 'event', type: 'drift', min: 250 }, { type: 'drift', points: 300 }) && !S.matches({ kind: 'event', type: 'drift', min: 250 }, { type: 'drift', points: 100 }));
assert.ok(!S.matches({ kind: 'event', type: 'race', medal: true }, { type: 'race', medal: null }));
const es = S.clean({}); assert.equal(S.escapeStep(es, 3, 3), false); assert.equal(S.escapeStep(es, 1, 3), false); assert.equal(S.escapeStep(es, 0, 3), true, 'reach 3 stars, then lose them');
assert.equal(S.clean({ chapter: 99 }).chapter, 0); assert.equal(S.clean({ chapter: 8 }).finished, true);
console.log('PASS: story chapters, sidewalk spots, advance, event matching, escape, saves');
