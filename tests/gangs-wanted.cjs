const assert = require('node:assert/strict');
const D = require('../gangs-data.js'), W = require('../wanted-data.js');
// gangs: six gangs, turf lookup, no overlapping blocks, rivals exist, spots on the sidewalk
assert.equal(D.GANGS.length, 6);
const seen = new Set(); for (const g of D.GANGS) { assert.ok(D.BY_ID[g.rival], g.id + ' rival'); for (const [bx, by] of g.blocks) { const k = bx + ',' + by; assert.ok(!seen.has(k), 'turf overlap ' + k); seen.add(k); assert.ok(bx >= 0 && bx < 15 && by >= 0 && by < 15); assert.ok(bx >= 5 || by >= 5, 'gangs stay out of the starter core'); assert.equal(D.turfAt(bx * 440 + 200, by * 340 + 170).gang.id, g.id); } }
assert.equal(D.turfAt(950, 735), null);
for (const sp of D.spots(1, 6)) assert.ok(sp.y - 6 * 340 >= 255 && sp.y - 6 * 340 <= 290, 'members stand on the front sidewalk');
assert.equal(D.relation(-30), 'HOSTILE'); assert.equal(D.relation(0), 'WARY'); assert.equal(D.relation(30), 'FRIENDLY');
const s = D.clean({ rep: { kings: 999, rats: -500 }, dead: { x: Date.now() + 1e9 }, job: { from: 'nope' } });
assert.equal(s.rep.kings, 100); assert.equal(s.rep.rats, -100); assert.ok(s.dead.x <= Date.now() + 10 * 60000 + 5); assert.equal(s.job, null);
const w = { cash: 150 }, t0 = Date.now();
assert.ok(D.tribute(s, 'diablos', w, t0).ok); assert.equal(w.cash, 50); assert.equal(s.rep.diablos, 12);
assert.equal(D.tribute(s, 'diablos', w, t0 + 1000).ok, false, 'cooldown'); assert.equal(D.tribute(s, 'rats', { cash: 999 }, t0).ok, false, 'hated gangs refuse money');
assert.equal(D.jobFor(s, 'diablos'), null, 'no work until friendly'); assert.equal(D.jobFor(s, 'kings').target, 'saints');
const o = D.outfit({ top: { id: 'tee', color: 0 } }, D.BY_ID.kings, 3); assert.equal(o.outer.color, 1, 'gang colour on the jacket');
console.log('PASS: gangs (turf, rep, tribute, jobs, colours)');
// wanted: stars, escalation, escape, busted, aim
assert.equal(W.stars(0), 0); assert.equal(W.stars(0.2), 1); assert.equal(W.stars(5), 5); assert.equal(W.stars(9), 5);
for (let k = 2; k <= 5; k++) { assert.ok(W.LEVELS[k].cops >= W.LEVELS[k - 1].cops); assert.ok(W.LEVELS[k].err <= (W.LEVELS[k - 1].err || 1)); }
assert.equal(W.canFire(W.LEVELS[1], true), false, '1 star never shoots'); assert.equal(W.canFire(W.LEVELS[2], false), false); assert.equal(W.canFire(W.LEVELS[2], true), true); assert.equal(W.canFire(W.LEVELS[3], false), true);
let p = 0, drops = 0; for (let i = 0; i < 100; i++) { const r = W.evadeStep(p, { stars: 3, dt: 0.25, dist: 9999 }); p = r.progress; if (r.drop) drops++; } assert.ok(drops >= 2, 'escaping outside the circle drops stars');
assert.equal(W.evadeStep(0.9, { stars: 3, dt: 1, seen: true }).progress, 0, 'being seen resets the evade timer');
const slow = W.evadeStep(0, { stars: 3, dt: 1, dist: 10 }).progress, fast = W.evadeStep(0, { stars: 3, dt: 1, dist: 9999 }).progress; assert.ok(fast > slow * 3);
assert.ok(W.evadeStep(0, { stars: 3, dt: 1, dist: 10, interior: true }).progress === fast, 'hiding indoors counts as outside');
let b = { t: 0 }; for (let i = 0; i < 10; i++) b = W.bustStep(b.t, { seen: true, near: 10, stars: 1, moving: false, dt: 0.2 }); assert.ok(b.busted);
b = { t: 0 }; for (let i = 0; i < 20; i++) b = W.bustStep(b.t, { seen: true, near: 10, stars: 1, moving: true, hp: 100, dt: 0.2 }); assert.ok(!b.busted, 'running keeps you free');
assert.ok(!W.bustStep(1.5, { seen: true, near: 10, stars: 4, dt: 1 }).busted, 'no arrests at high stars: it\'s a shootout');
const e = (o) => Math.abs(W.aimError(W.LEVELS[3], { rand: 1, ...o }));
assert.ok(e({ moving: true }) > e({}), 'moving targets are harder to hit'); assert.ok(e({ dist: 300 }) > e({ dist: 50 }));
console.log('PASS: wanted levels (escalation, escape, busted, accuracy)');
