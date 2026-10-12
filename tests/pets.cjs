// Pets + car kits + dream house (Claude-owned).
const assert = require('node:assert/strict');
const D = require('../pets-data.js');
const SK = require('../skills-data.js');
const keys = new Set(SK.SKILLS.flatMap((s) => s.perks.map((p) => p.key)));
for (const p of D.PETS) { for (const k of Object.keys(p.perk)) assert.ok(keys.has(k), `${p.id} perk key ${k} exists`); assert.ok(p.price > 0 && p.desc); }
for (const k of D.KITS) assert.ok(k.engine > 0 && k.handling > 0 && k.armor > 0 && k.price >= 10000);
console.log('PASS: pet + kit catalog');

const now = 1e12, s = D.clean({}, now), w = { cash: 10000 };
assert.equal(D.perk(s, 'luck.rare', now), 1);
assert.ok(D.adopt(s, w, 'shiba', now).ok); assert.equal(D.adopt(s, w, 'shiba', now).reason, 'Already yours');
assert.equal(s.active, 'shiba'); assert.equal(D.perk(s, 'luck.rare', now), 1.25);
assert.equal(D.perk(s, 'luck.rare', now + 7 * 3600000), 1, 'hungry pets give no perk');
assert.equal(D.feed(s, 'shiba', now + 7 * 3600000).reason, 'No pet food · buy some at Paws & Claws');
s.food = 2; assert.ok(D.feed(s, 'shiba', now + 7 * 3600000).ok); assert.equal(D.perk(s, 'luck.rare', now + 8 * 3600000), 1.25);
assert.ok(D.adopt(s, w, 'tabby', now).ok); assert.ok(D.adopt(s, { cash: 1e6 }, 'lab', now).ok); assert.equal(D.adopt(s, { cash: 1e6 }, 'husky', now).reason, 'Room for 3 pets');
console.log('PASS: adopting, feeding, perks only while fed, pet cap');

const k = D.clean({}, now), kw = { cash: 50000 };
assert.equal(D.buyKit(k, kw, 'car-3', 'gt', false).reason, 'Pick one of your cars');
assert.ok(D.buyKit(k, kw, 'car-3', 'gt', true).ok); assert.equal(D.kitFactor(k, 'car-3', 'engine'), 1.15); assert.equal(D.kitFactor(k, 'car-9', 'engine'), 1);
assert.equal(D.buyDream(k, kw).reason, 'Needs $85,000'); assert.ok(D.buyDream(k, { cash: 1e6 }).ok);
const d = D.clean({ pets: [{ id: 'shiba', name: '<x>', fedUntil: 9e15 }, { id: 'nope' }], active: 'nope', kits: { 'car-1': 'lux', bad: 'gt', 'car-2': 'zzz' }, food: -3 }, now);
assert.equal(d.pets.length, 1); assert.equal(d.pets[0].name, 'Shiba Inu'); assert.equal(d.active, 'shiba'); assert.deepEqual(d.kits, { 'car-1': 'lux' }); assert.equal(d.food, 0);
assert.ok(d.pets[0].fedUntil <= now + D.FEED_HOURS * 3600000 * 2);
console.log('PASS: car kits, dream house, save cleaning');
