// v0.71 (Claude): pursuit maths (intercept / PIT / ram / swerve / yield / gunfire panic / heli follow).
const assert = require('node:assert/strict');
const P = require('../pursuit-ai.js');
// intercept leads a moving car and sits on the cop's side of it, slightly behind the nose
const car = { x: 0, y: 0, angle: 0, speed: 5 };
const t = P.intercept({ x: -100, y: 30 }, car, 200); assert.ok(t.x > 0, 'leads the target'); assert.ok(t.y > 0, 'same side as the cop');
const t0 = P.intercept({ x: -100, y: 30 }, { ...car, speed: 0 }, 200); assert.ok(t0.x < 0, 'parked target: aim at the rear quarter');
// PIT: contact on the rear quarter, same heading -> spin; head-on or dead-centre -> no PIT
assert.notEqual(P.isPit({ x: -20, y: 14, angle: 0.1 }, car), 0, 'rear-quarter hit spins');
assert.equal(P.isPit({ x: -20, y: 14, angle: 0.1 }, car), -P.isPit({ x: -20, y: -14, angle: 0.1 }, car), 'spin direction depends on side');
assert.equal(P.isPit({ x: 30, y: 10, angle: Math.PI }, car), 0, 'head-on is not a PIT');
assert.equal(P.isPit({ x: -30, y: 1, angle: 0 }, car), 0, 'straight rear-end is not a PIT');
// player rams: driving into the cruiser counts, reversing away doesn't
assert.ok(P.playerRams({ x: 0, y: 0, angle: 0, speed: 6 }, { x: 30, y: 4 }));
assert.ok(!P.playerRams({ x: 0, y: 0, angle: 0, speed: 6 }, { x: -30, y: 4 }));
assert.ok(P.playerRams({ x: 0, y: 0, angle: 0, speed: -6 }, { x: -30, y: 4 }), 'reversing into it counts');
// swerve: something in the lane ahead -> overtake left; left lane busy too -> brake; clear road -> nothing
const cop = { x: 0, y: 0 };
assert.deepEqual(P.swerve(cop, 0, [{ x: 50, y: 4 }]), { side: -1, brake: false });
assert.deepEqual(P.swerve(cop, 0, [{ x: 50, y: 4 }, { x: 60, y: -36 }]), { side: 0, brake: true });
assert.deepEqual(P.swerve(cop, 0, [{ x: -50, y: 0 }, { x: 200, y: 0 }]), { side: 0, brake: false });
// civilians yield to a moving cruiser behind them in their street, not to a parked one or one far away
const civ = { x: 0, y: 0, angle: 0 };
assert.ok(P.yieldsTo(civ, { x: -180, y: 10, speed: 5 }));
assert.ok(!P.yieldsTo(civ, { x: -180, y: 10, speed: 0 }), 'parked cruiser');
assert.ok(!P.yieldsTo(civ, { x: -400, y: 0, speed: 5 }), 'far away');
assert.ok(!P.yieldsTo(civ, { x: 0, y: 200, speed: 5 }), 'other street');
// gunfire panic + heli follow
assert.ok(P.nearShot(civ, [{ x: 100, y: -60 }])); assert.ok(!P.nearShot(civ, [{ x: 400, y: 0 }]));
let h = { x: 0, y: 0 }; for (let i = 0; i < 120; i++) h = P.follow(h, { x: 1000, y: 0 }, 230, 1 / 60); assert.ok(h.x > 400 && h.x <= 461, 'heli is capped at 230 px/s over 2 s (' + h.x.toFixed(0) + ')');
console.log('PASS: v0.71 pursuit (intercept, PIT, ramming, swerve, yielding, panic, helicopter)');
