// Option 3 (Claude): modular weapon kit rules, pets, props, purple coupe catalog entry.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const K = require('../weapon-kit-data.js'), P = require('../o3-pet.js'), PR = require('../o3-props.js'), CD = require('../cars-data.js'), SD = require('../carstyle-data.js');
const sig = (b) => { let h = 0; for (let i = 0; i < b.length; i++) h = (Math.imul(h, 31) + b[i]) | 0; return h; };

// --- weapon kit: data-driven compatibility
const base = K.clean({}, 'carbine');
assert.ok(K.validate(base, []).ok, 'base carbine valid');
assert.equal(K.clean({}, 'pistol'), null, 'non-kit guns have no kit');
assert.ok(!K.validate({ ...base, muzzle: 'can' }, []).ok, 'can needs suppressor mod');
assert.ok(K.validate({ ...base, muzzle: 'can' }, ['suppressor']).ok, 'can ok with suppressor');
assert.ok(!K.validate({ ...base, muzzle: 'can', barrel: 'short' }, ['suppressor']).ok, 'can + stub barrel denied');
assert.ok(!K.validate({ ...base, underbarrel: 'bipod' }, []).ok, 'bipod needs long barrel');
assert.ok(K.validate({ ...base, underbarrel: 'bipod', barrel: 'long' }, []).ok, 'bipod on long barrel ok');
assert.ok(!K.validate({ ...base, underbarrel: 'bipod', barrel: 'long', magazine: 'drum' }, ['extmag']).ok, 'drum + bipod denied');
assert.ok(!K.validate({ ...base, optic: 'scope', stock: 'folded' }, ['scope']).ok, 'scope + folded stock denied');
assert.ok(!K.validate(base, ['suppressor']).ok, 'a fitted suppressor must be visible');
const v = K.validate({ ...base, laser: 'red' }, []); assert.ok(v.errors[0].includes('Laser grip'), 'error explains why');
// sync: fitting / removing gameplay mods keeps the look honest and valid
const on = K.sync(base, ['suppressor', 'scope', 'extmag']); assert.equal(on.muzzle, 'can'); assert.equal(on.optic, 'scope'); assert.equal(on.magazine, 'ext'); assert.ok(K.validate(on, ['suppressor', 'scope', 'extmag']).ok);
const off = K.sync({ ...on, laser: 'green' }, []); assert.equal(off.muzzle, 'hider'); assert.equal(off.optic, 'irons'); assert.equal(off.magazine, 'std'); assert.equal(off.laser, 'none'); assert.ok(K.validate(off, []).ok);
// the 4 shipped presets (weapon-kit.js) are valid with the mods they need, and all look different
const src = fs.readFileSync(path.join(__dirname, '..', 'weapon-kit.js'), 'utf8'), PRESETS = eval(src.slice(src.indexOf('const PRESETS = [') + 16, src.indexOf('];', src.indexOf('const PRESETS')) + 1));
assert.equal(PRESETS.length, 4);
const NEEDS = { 'NIGHT OPS': ['extmag', 'grip', 'scope', 'suppressor'] };
for (const [name, cfg] of PRESETS) assert.ok(K.validate({ ...base, ...cfg }, NEEDS[name] || []).ok, name + ' valid');
assert.equal(new Set(PRESETS.map(([, c]) => K.keyOf({ ...base, ...c }))).size, 4, '4 distinct configurations');
// save: cleanState drops junk, keeps valid parts, ignores unknown guns
const st = K.cleanState({ configs: { carbine: { barrel: 'long', muzzle: 'evil', skin: 'carbon' }, rocket: { barrel: 'long' } } });
assert.equal(st.configs.carbine.barrel, 'long'); assert.equal(st.configs.carbine.muzzle, 'hider'); assert.equal(st.configs.carbine.skin, 'carbon'); assert.ok(!st.configs.rocket);
assert.deepEqual(K.cleanState(null), K.fresh(), 'missing save → fresh');
console.log('PASS: modular weapon kit (rules, sync with gameplay mods, 4 valid presets, save cleaning)');

// --- pets: 8 distinct directions, gait animates, transparent background
for (const id of ['husky', 'shiba', 'rottweiler']) {
  const d = new Set(); for (let k = 0; k < 8; k++) d.add(sig(P.render(id, k, 'idle', 0).composite)); assert.equal(d.size, 8, id + ': 8 distinct directions');
  const w = new Set(); for (let f = 0; f < P.ANIMS.walk; f++) w.add(sig(P.render(id, 2, 'walk', f).composite)); assert.ok(w.size >= 3, id + ': walk animates');
  const r = P.render(id, 1, 'sit', 0); assert.equal(r.composite.length, r.w * r.h); assert.ok(r.composite[0] === 0 && r.composite.some((x) => x), id + ': transparent, non-empty');
}
console.log('PASS: Option 3 pets (3 breeds x 8 distinct directions, idle/walk/sit)');

// --- props: day and night differ, night has light pools, day has none
for (const k of PR.KINDS) {
  const d = PR.render(k, false), n = PR.render(k, true);
  assert.notEqual(sig(d.composite), sig(n.composite), k + ': night variant differs'); assert.equal(d.emissive.length, 0); assert.ok(n.emissive.length >= 1, k + ': night glow');
  assert.ok(d.composite.some((x) => x) && d.composite[0] === 0, k + ': non-empty, transparent');
}
console.log('PASS: Option 3 props (hydrant/vending/ATM, day + night variants)');

// --- purple coupe: catalog + factory setup valid, old garage styles untouched
const vanta = CD.BY.vanta; assert.ok(vanta && vanta.body === 'coupe' && vanta.colors[0] === '#8a3fd6', 'Vanta GT is purple by default');
const fs0 = SD.cleanStyle(vanta.o3); for (const [k2, val] of Object.entries(vanta.o3)) assert.equal(fs0[k2], val, 'factory part valid: ' + k2);
assert.deepEqual(SD.cleanStyle(undefined), { ...SD.DEFAULT }, 'cars without a factory style keep stock');
console.log('PASS: Vanta GT purple coupe (catalog + factory widebody setup)');
