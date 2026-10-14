// v0.69 (Claude): screen-relative driving, NPC profiles/AI, car kits, HD art, multiplayer hit validation.
const assert = require('node:assert/strict');
const DI = require('../drive-input.js');
const PI = Math.PI;
// Car facing DOWN the screen (angle +90°). Pushing screen-RIGHT must turn toward screen-right (angle decreases toward 0).
let r = DI.screen(PI / 2, 4, 1, 0); assert.ok(r.thrust > 0 && r.steer < 0, 'facing down, push right -> turn toward right');
// Facing right, push down -> steer positive (angle grows toward +90).
r = DI.screen(0, 4, 0, 1); assert.ok(r.steer > 0 && r.thrust > 0);
// Straight ahead: full gas, no steer.
r = DI.screen(-PI / 2, 3, 0, -1); assert.ok(r.thrust === 1 && Math.abs(r.steer) < 1e-9);
// Pull against a moving car: brake, no steering.
r = DI.screen(0, 4, -1, 0); assert.ok(r.thrust < 0 && r.steer === 0, 'brake');
// Stopped and pulling back: reverse.
r = DI.screen(0, 0, -1, 0.2); assert.ok(r.thrust < 0, 'reverse');
// Dead zone.
assert.deepEqual(DI.screen(0, 3, 0.05, 0.05), { thrust: 0, steer: 0 });
// Classic mode is the old tank mapping.
assert.deepEqual(DI.classic(1, 1, 0.5, -1), { thrust: 1, steer: 0.5 });
// Simulate: a car facing down, stick held right, ends up heading right.
{ const car = { angle: PI / 2, speed: 3 }; for (let i = 0; i < 120; i++) { const m = DI.screen(car.angle, car.speed, 1, 0); car.angle += m.steer * 0.04 * (car.speed >= 0 ? 1 : -1); car.speed = Math.max(-2.6, Math.min(7, car.speed + m.thrust * 0.2)); } assert.ok(Math.abs(DI.wrap(car.angle)) < 0.15, 'converges on stick direction'); }
console.log('PASS: screen-relative driving (stick direction = travel direction, brake/reverse, classic fallback)');
{ const S = { ms: 0, backUntil: 0, steer: 1 }; let r; for (let t = 0; t <= 600; t += 50) r = DI.unstick(S, { thrust: 1, steer: 0.5 }, 0, 50, t); r = DI.unstick(S, { thrust: 1, steer: 0.5 }, 0, 50, 650); assert.ok(r.thrust < 0 && r.steer < 0, 'wedged -> backs out turning the other way'); assert.ok(DI.unstick(S, { thrust: 1, steer: 0.5 }, 0, 50, 2000).thrust > 0, 'then drives again');
  console.log('PASS: wedged car backs out automatically'); }
