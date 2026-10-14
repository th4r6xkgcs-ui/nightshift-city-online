// v0.75 (Claude): Heat Check questline step logic.
const assert = require('node:assert/strict');
const Q = require('../questline.js');
assert.equal(Q.STEPS.length, 3);
let s = { step: 0, base: 5, hot: false, done: false };
assert.equal(Q.advance(s, { robberies: 5, wrecks: 0, heat: 2 }).paid, 0, 'not retroactive');
let r = Q.advance(s, { robberies: 6, wrecks: 0, heat: 1.2 }); assert.equal(r.paid, 300); assert.equal(r.state.step, 1);
s = r.state; assert.equal(Q.advance(s, { robberies: 6, wrecks: 0, heat: 0 }).paid, 0, 'must get hot first');
r = Q.advance(s, { robberies: 6, wrecks: 0, heat: 1.5 }); assert.ok(r.state.hot); r = Q.advance(r.state, { robberies: 6, wrecks: 0, heat: 0 }); assert.equal(r.paid, 400);
s = { ...r.state, base: 3 }; assert.equal(Q.advance(s, { robberies: 6, wrecks: 3, heat: 0 }).paid, 0);
r = Q.advance(s, { robberies: 6, wrecks: 4, heat: 0 }); assert.equal(r.paid, 800); assert.ok(r.state.done);
assert.equal(Q.advance(r.state, { robberies: 9, wrecks: 9, heat: 0 }).paid, 0, 'done is done');
console.log('PASS: v0.75 Heat Check questline ($300 / $400 / $800, not retroactive)');
