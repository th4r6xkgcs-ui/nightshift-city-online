// v0.71 (Claude): building variants (gun shop, tattoo, auto parts, gym, hospital, police), room actions, kit loads.
const assert = require('node:assert/strict');
const { variant, BRANDS, ACT } = require('../interiors.js');
const bs = require('../city-data.js').createBuildings();
const count = {}; for (const b of bs) { const v = variant(b); count[v] = (count[v] || 0) + 1; }
for (const t of ['GUN SHOP', 'TATTOO', 'AUTO PARTS', 'GYM', 'HOSPITAL', 'POLICE']) { assert.ok(count[t] >= 1, t + ' exists in the city'); assert.ok(BRANDS[t]?.length, t + ' has street-sign brands'); }
for (const t of ['CORNER SHOP', 'CLOTHING', 'BANK', 'APARTMENTS', 'DINER', 'GARAGE', 'CLUB', 'WAREHOUSE']) assert.ok(count[t] >= 5, t + ' still common');
assert.equal(variant(bs[7]), variant({ ...bs[7] }), 'deterministic');
for (const b of bs) if (!['CORNER SHOP', 'CLOTHING', 'BANK', 'APARTMENTS'].includes(b.name)) assert.equal(variant(b), b.name, 'other types unchanged');
// hospital: full heal, $60 (free if broke), refuses when healthy
let p = { hp: 40, cash: 100 }; assert.ok(ACT.heal(p).ok); assert.equal(p.hp, 100); assert.equal(p.cash, 40);
p = { hp: 10, cash: 5 }; assert.ok(ACT.heal(p).ok); assert.equal(p.hp, 100); assert.equal(p.cash, 5);
assert.equal(ACT.heal({ hp: 100, cash: 100 }).ok, false);
// police: fine = ceil(heat*150), clears heat, needs the cash, nothing to pay when clean
p = { heat: 2.2, cash: 1000 }; assert.ok(ACT.fine(p).ok); assert.equal(p.heat, 0); assert.equal(p.cash, 1000 - 330);
p = { heat: 3, cash: 100 }; assert.equal(ACT.fine(p).ok, false); assert.equal(p.heat, 3); assert.equal(p.cash, 100);
assert.equal(ACT.fine({ heat: 0, cash: 9 }).ok, false);
// tattoo / gym: price + cooldown
p = { cash: 200 }; assert.ok(ACT.tattoo(p, 0, 1e9).ok); assert.equal(p.cash, 50); assert.equal(ACT.tattoo(p, 1e9, 1e9 + 1000).ok, false);
p = { cash: 25 }; assert.ok(ACT.train(p, 0, 1e9).ok); assert.equal(p.cash, 5); assert.equal(ACT.train({ cash: 100 }, 1e9, 1e9 + 1000).ok, false);
// kit is loadable and exposes the painters the rooms use
require('../interior-kit.js'); const K = globalThis.NightshiftInteriorKit;
for (const f of ['floor', 'wall', 'neon', 'shelf', 'block', 'counter', 'fridges', 'aisle', 'carLift', 'vault', 'hospitalBed', 'cellBars', 'benchPress', 'tattooChair', 'djBooth', 'poolTable', 'glow']) assert.equal(typeof K[f], 'function', f);
console.log('PASS: v0.71 interiors (14 room types, variants ' + JSON.stringify({ gun: count['GUN SHOP'], tattoo: count.TATTOO, parts: count['AUTO PARTS'], gym: count.GYM, hospital: count.HOSPITAL, police: count.POLICE }) + ', room actions)');
