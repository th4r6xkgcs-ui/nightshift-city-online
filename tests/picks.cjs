// Lockpicking + safecracking (Claude-owned): puzzles are solvable with good timing, misses jam, skills widen zones.
const assert = require('node:assert/strict');
const K = require('../picks-data.js');

for (const type of Object.keys(K.KINDS)) {
  for (let seed = 1; seed <= 30; seed++) {
    const p = K.make(type, seed);
    assert.equal(p.targets.length, K.KINDS[type].pins);
    for (const t of p.targets) assert.ok(t >= 0.15 && t <= 0.85);
    // perfect timing: tap exactly on each target
    for (const t of p.targets.slice()) K.tap(p, t);
    assert.ok(p.done && p.ok, `${type}#${seed} solvable`);
  }
  const bad = K.make(type, 3);
  for (let i = 0; i < 10 && !bad.done; i++) K.tap(bad, bad.targets[bad.set] > 0.5 ? 0.02 : 0.98);
  assert.ok(bad.done && !bad.ok && bad.misses === bad.maxMiss, `${type} jams after too many misses`);
}
const plain = K.make('mansion', 5, 1, 1), sneaky = K.make('mansion', 5, 0.6, 1.3);
assert.ok(sneaky.zone > plain.zone, 'stealth widens the sweet spot'); assert.equal(sneaky.maxMiss, plain.maxMiss + 1, 'luck buys a spare miss');
assert.ok(K.make('house', 1).zone > K.make('mansion', 1).zone, 'mansions are harder than houses');
// motion: locks bounce 0..1..0, safes loop 0..1
const L = K.make('house', 2); for (let t = 0; t < 4; t += 0.05) { const v = K.posAt(L, t); assert.ok(v >= 0 && v <= 1); }
const S = K.make('safe', 2); assert.ok(Math.abs(K.posAt(S, 0) - 0) < 1e-9); S.dir = -1; assert.ok(K.posAt(S, 0.1) > 0.9);
// safes accept wrap-around distance
const s2 = K.make('safe', 9); s2.targets[0] = 0.99; assert.ok(K.tap(s2, 0.005).hit, 'dial wraps past 99 → 00');
console.log('PASS: lockpicking + safecracking puzzles (solvable, jam, skill-widened, wrap-around)');
