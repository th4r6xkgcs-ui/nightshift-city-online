// Skill effects (Claude-owned): pure helpers. Wrappers are verified in the browser.
const assert = require('node:assert/strict');
const E = require('../skill-effects.js');
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
assert.equal(E.luckChance(1), 0, 'no luck at level 1');
assert.equal(E.luckChance(2), 0.5, 'max 50% at max luck');
assert.equal(E.luckChance(9), 0.5, 'clamped');
assert.equal(E.rollLuck(1, 1, seq(0)), 0, 'level 1 never finds');
assert.equal(E.rollLuck(2, 1, seq(0.1, 0)), 30, 'hit pays base 30..100');
assert.equal(E.rollLuck(2, 2, seq(0.1, 1)), 200, 'value multiplier applies');
assert.equal(E.rollLuck(1.4, 1, seq(0.25)), 0, 'roll above chance misses');
console.log('PASS: luck find chance and value');
assert.equal(E.yieldBonus(3, 1, seq(0.99)), 0, 'no bonus at level 1');
assert.equal(E.yieldBonus(3, 1.75, seq(0)), 2, 'floor(3*0.75)');
assert.equal(E.yieldBonus(3, 1.75, seq(0.3)), 2);
assert.equal(E.yieldBonus(3, 1.75, seq(0.8)), 3, 'random rounding up');
let total = 0; const r = Math.random; for (let i = 0; i < 20000; i++) total += E.yieldBonus(2, 1.15, r);
assert.ok(Math.abs(total / 20000 - 0.3) < 0.02, 'average bonus matches the perk: ' + total / 20000);
console.log('PASS: farming yield bonus averages to the perk value');
