// Weapons (Claude-owned): catalog sanity, crafting, durability, repairs, spares, resale, mods, armor.
const assert = require('node:assert/strict');
const W = require('../weapons-data.js');
const S = require('../supply-data.js');

const ids = new Set();
for (const w of W.WEAPONS) {
  assert.ok(!ids.has(w.id)); ids.add(w.id);
  assert.ok(w.name && w.icon && w.desc && w.cls);
  assert.ok(w.mag >= 1 && w.mag <= 30, w.id + ' magazine fits the game save cap');
  assert.ok(w.dmg > 0 && w.rate >= 60 && w.range > 0 && w.speed > 0 && w.spread >= 0 && w.pellets >= 1);
  assert.ok(w.dur > 0 && w.value > 0 && w.craft.seconds > 0);
  for (const k of Object.keys(w.craft.mats)) assert.ok(S.MATERIALS[k], `${w.id} uses known material ${k}`);
  assert.ok(w.tier >= 0 && w.tier <= S.LOCKUP.levels.length);
  assert.equal(!!w.crude, w.tier === 0, 'crude guns are exactly the home-bench guns');
}
assert.ok(W.WEAPONS.length >= 15, 'a real arsenal');
for (const cls of ['crude', 'pistol', 'smg', 'shotgun', 'rifle']) assert.ok(W.WEAPONS.some((w) => w.cls === cls), cls);
const pipe = W.BY_ID.pipe;
assert.ok(pipe.dur <= 12 && pipe.mag === 1 && pipe.level === 1 && pipe.tier === 0, 'the first gun is a cheap pipe pistol that breaks after a few shots');
assert.equal(W.dps(W.BY_ID.ar), Math.max(...W.WEAPONS.map(W.dps)), 'the top-tier gun has the highest firepower');
// Real guns are worth more than their parts at the parts counter (so gun-running pays), and margins grow with tier.
const partsCost = (w) => Object.entries(w.craft.mats).reduce((t, [k, n]) => t + S.MATERIALS[k].price * n, 0);
let lastMargin = -Infinity;
for (const tier of [1, 2, 3]) {
  const list = W.WEAPONS.filter((w) => w.tier === tier);
  const m = Math.min(...list.map((w) => w.value - partsCost(w)));
  assert.ok(m > 150, `tier ${tier} guns sell for more than bought parts (min margin $${m})`);
  assert.ok(m >= lastMargin * 0.9, `tier ${tier} margin keeps up`); lastMargin = m;
}
console.log('PASS: arsenal catalog (15 guns, classes, recipes, crude first gun, margins by tier)');

// Fresh players start unarmed; old saves (version 1) keep the Street Pistol and anything they bought.
const fresh = W.clean({});
assert.deepEqual([fresh.owned, fresh.equipped], [[], null]);
const legacy = W.clean({ version: 1, owned: ['pistol', 'smg', 'bogus'], equipped: 'smg', mods: { smg: ['scope', 'scope', 'Bad!'], ar: ['scope'] }, armor: 999 });
assert.deepEqual(legacy.owned, ['pistol', 'smg']); assert.equal(legacy.equipped, 'smg'); assert.deepEqual(legacy.mods, { smg: ['scope'] });
assert.equal(legacy.armor, 100); assert.equal(legacy.cond.smg, W.BY_ID.smg.dur, 'legacy guns start at full condition');
console.log('PASS: unarmed start and legacy save migration');

// Crafting the pipe pistol at home.
const bag = { pipe: 1, metal: 3, spring: 1, tape: 1 };
const ctx = (bench, shooting = 1) => ({ bench, shooting, have: (c) => S.has(bag, c), spend: (c) => { if (!S.has(bag, c)) return false; S.take(bag, c); return true; }, durMul: 1 });
const st = W.clean({});
assert.equal(W.craftBlock(st, 'pistol', ctx(0, 5)), 'Needs your Lockup workshop');
assert.equal(W.craftBlock(st, 'sawnoff', ctx(0, 1)), 'Needs Shooting level 2');
assert.equal(W.craft(st, 'zip', ctx(0)).reason, 'Missing materials');
const r = W.craft(st, 'pipe', ctx(0));
assert.ok(r.ok && !r.spare); assert.deepEqual(bag, {}); assert.equal(st.equipped, 'pipe'); assert.equal(st.cond.pipe, pipe.dur);
// It wears with every shot and falls apart; with nothing else you're unarmed again.
let out;
for (let i = 0; i < pipe.dur; i++) out = W.wear(st);
assert.ok(out.broke && out.destroyed); assert.deepEqual([st.owned, st.equipped], [[], null]);
assert.ok(W.wear(st).none);
// A spare swaps in when the gun breaks.
Object.assign(bag, { pipe: 2, metal: 6, spring: 2, tape: 2 });
W.craft(st, 'pipe', ctx(0)); const sp = W.craft(st, 'pipe', ctx(0)); assert.ok(sp.spare); assert.equal(st.spare.pipe, 1);
for (let i = 0; i < pipe.dur; i++) out = W.wear(st);
assert.ok(out.swapped); assert.equal(st.equipped, 'pipe'); assert.equal(st.spare.pipe, undefined); assert.equal(st.cond.pipe, pipe.dur);
console.log('PASS: crafting the pipe pistol, wear, breaking, spares swapping in');

// Real guns break into "broken" and get repaired at a bench of their tier; crude can't be repaired.
const rs = W.clean({ version: 1 });
assert.equal(W.repairCost(rs, 'pistol'), null, 'nothing to repair at full condition');
rs.cond.pistol = 1; out = W.wear(rs);
assert.ok(out.broke && !out.destroyed); assert.deepEqual(rs.broken, ['pistol']); assert.equal(rs.equipped, null);
assert.equal(W.equip(rs, 'pistol'), false, 'cannot equip a broken gun');
const rc = W.repairCost(rs, 'pistol'); assert.ok(rc.trigger === 1 && rc.metal > 0 && rc.spring > 0);
Object.assign(bag, { metal: 20, spring: 5, trigger: 1 });
assert.equal(W.repair(rs, 'pistol', ctx(0)).reason, 'Repair it at your Lockup workshop');
assert.ok(W.repair(rs, 'pistol', ctx(1)).ok); assert.deepEqual(rs.broken, []); assert.equal(rs.equipped, 'pistol'); assert.equal(rs.cond.pistol, 500);
rs.cond.pistol = 250; const half = W.repairCost(rs, 'pistol'); assert.ok(!half.trigger && half.metal < rc.metal, 'partial wear costs less');
console.log('PASS: real guns break, repair costs scale with wear, bench tier gates repairs');

// Selling: spares at full value, used guns by condition.
const wal = { cash: 0 };
rs.spare.pistol = 1;
assert.equal(W.sell(rs, wal, 'pistol', 'spare').cash, 1050);
assert.equal(W.usedValue(rs, 'pistol'), Math.round(1050 * (0.35 + 0.65 * 0.5)));
assert.equal(W.sell(rs, wal, 'pistol', 'owned').cash, Math.round(1050 * 0.675)); assert.deepEqual(rs.owned, []); assert.equal(rs.equipped, null);
console.log('PASS: selling spares and used guns');

// Mods: crafted per gun, gated by bench tier + Shooting level; crude guns only take reinforcement.
const ms = W.clean({ version: 1, owned: ['smg'] });
Object.assign(bag, { metal: 50, spring: 20, lens: 5, tape: 5, pipe: 2 });
assert.equal(W.craftMod(ms, 'smg', 'scope', ctx(1, 9)).reason, 'Needs a level 2 workshop');
assert.equal(W.craftMod(ms, 'smg', 'scope', ctx(2, 4)).reason, 'Needs Shooting level 5');
for (const m of ['extmag', 'grip', 'scope', 'suppressor']) assert.ok(W.craftMod(ms, 'smg', m, ctx(3, 9)).ok, m);
assert.equal(W.craftMod(ms, 'smg', 'extmag', ctx(3, 9)).reason, 'Already fitted');
const e = W.effective(W.BY_ID.smg, ms.mods.smg);
assert.equal(e.mag, 30); assert.ok(Math.abs(e.spread - 0.09 * 0.5 * 0.6) < 1e-9); assert.equal(e.range, Math.round(380 * 1.35)); assert.equal(e.suppressed, true);
const cr = W.clean({}); W.craft(cr, 'pipe', { ...ctx(0), have: () => true, spend: () => true });
assert.equal(W.modBlock(cr, 'pipe', 'scope', ctx(3, 20)), 'Won\'t fit a crude gun');
assert.ok(W.craftMod(cr, 'pipe', 'reinforce', ctx(0)).ok); assert.equal(cr.cond.pipe, 16); assert.equal(W.maxDur(pipe, cr.mods.pipe), 16);
console.log('PASS: crafted mods (tier + level gates, crude limits, reinforce durability)');

// Cycling only over working guns; magazine fit; pellets; armor.
const cy = W.clean({ version: 1, owned: ['pistol', 'smg', 'rifle'], broken: ['smg'] });
assert.equal(W.cycle(cy), 'rifle'); assert.equal(W.cycle(cy), 'pistol');
assert.deepEqual(W.fitMagazine(30, 90, 6), { ammo: 6, reserve: 114 });
assert.deepEqual(W.fitMagazine(30, 230, 6), { ammo: 6, reserve: 240 }, 'reserve cap');
const shot = W.pelletAngles(1, W.BY_ID.shotgun, () => 1);
assert.equal(shot.length, 6); assert.ok(shot.every((a) => Math.abs(a - 1 - 0.28) < 1e-9));
assert.deepEqual(W.absorb(50, 20), { armor: 36, dmg: 6 }); assert.deepEqual(W.absorb(5, 20), { armor: 0, dmg: 15 });
console.log('PASS: cycling working guns, magazine fit, pellet spread, armor');
