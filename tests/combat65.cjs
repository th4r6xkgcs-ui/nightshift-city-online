// v0.65 (Claude): combat core (shared client/server rules), police cuffing, store break-ins.
const assert = require('node:assert/strict');
const K = require('../combat-core.js'), WD = require('../wanted-data.js'), B = require('../breakin-data.js');

// deterministic spread: same seed -> same pellets on every machine
const sg = { cls: 'shotgun', dmg: 12, range: 300, spread: 0.2, pellets: 6 };
assert.deepEqual(K.spread(1234, 0.5, sg), K.spread(1234, 0.5, sg), 'same seed, same pellets');
assert.notDeepEqual(K.spread(1234, 0.5, sg), K.spread(1235, 0.5, sg), 'different seed, different pellets');
assert.equal(K.spread(9, 0, sg).length, 6);
assert.equal(K.seedOf('p1', 3, 'pistol'), K.seedOf('p1', 3, 'pistol'));
// falloff
const pistol = K.normalize({ cls: 'pistol', dmg: 20, range: 400 });
assert.equal(K.falloff(pistol, 50), 1); assert.ok(K.falloff(pistol, 300) < 1 && K.falloff(pistol, 300) > 0.65); assert.equal(K.falloff(pistol, 900), 0.65);
assert.equal(K.falloff(K.normalize({ cls: 'melee', dmg: 10 }), 999), 1, 'melee has no falloff');
// armor + penetration
const plain = K.armorSplit(50, 20, 0), ap = K.armorSplit(50, 20, 0.7);
assert.ok(plain.armor > ap.armor && ap.hp > plain.hp, 'penetration pushes more damage through armor');
assert.deepEqual(K.armorSplit(0, 20, 0), { hp: 20, armor: 0, left: 0 });
// resolve: cover, roll, sneak
const base = K.resolve({ weapon: pistol, dist: 50, target: {} }).hp;
assert.equal(K.resolve({ weapon: pistol, dist: 50, target: { stance: 'cover' } }).hp, base / 2, 'cover halves damage');
assert.ok(K.resolve({ weapon: pistol, dist: 50, target: { stance: 'roll' } }).dodged, 'rolling dodges');
assert.equal(K.resolve({ weapon: pistol, dist: 50, target: { aware: false } }).hp, base * K.RULES.sneak, 'sneak attack bonus');
// life states: hurt -> downed -> bleeding -> killed; revive
const e = { hp: 30, maxHp: 100, canDown: true };
assert.equal(K.apply(e, { hp: 10 }, 0), 'hurt'); assert.equal(K.apply(e, { hp: 50 }, 0), 'downed'); assert.ok(e.downed && e.hp === 0);
assert.equal(K.apply(e, { hp: 5 }, 1000), 'bleeding'); assert.ok(e.downed.until < K.RULES.bleedMs, 'damage while down speeds up bleeding');
assert.ok(K.revive(e, 2000)); assert.equal(e.hp, K.RULES.reviveHp); assert.equal(e.downed, null);
K.apply(e, { hp: 999 }, 3000); assert.equal(K.bleed(e, 3000 + K.RULES.bleedMs + 1), 'killed'); assert.ok(e.dead);
const npc = { hp: 10 }; assert.equal(K.apply(npc, { hp: 20 }, 0), 'killed', 'NPCs without canDown die');
// teams / friendly fire
assert.equal(K.canDamage({ id: 'a', team: 'you' }, { id: 'b', team: 'player' }), false, 'no friendly fire between players and crews (PvE)');
assert.equal(K.canDamage({ id: 'a', team: 'kings' }, { id: 'b', team: 'kings' }), false);
assert.equal(K.canDamage({ id: 'a', team: 'you' }, { id: 'b', team: 'kings' }), true);
assert.equal(K.canDamage({ id: 'a', team: 'you' }, { id: 'b', team: 'player' }, 'ffa'), true);
// wire format round-trip
const ev = K.hitEvent({ seq: 7, t: 1234.6, src: 'p1', dst: 'cop-9', weapon: 'pistol', kind: 'taser', seed: 99, from: { x: 1, y: 2 }, to: { x: 30, y: 40 }, hp: 12.34, armor: 3, result: 'downed' });
assert.deepEqual(K.unpack(K.pack(ev)), ev); assert.equal(K.pack(ev).length, 14);
// server validation
const ctx = { now: 1000, shooter: { x: 0, y: 0, lastShotAt: 900 }, target: { x: 100, y: 0 }, weapon: { cls: 'pistol', dmg: 20, range: 400, rate: 300 } };
const good = K.hitEvent({ t: 1300, kind: 'bullet', from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, hp: 20 });
assert.equal(K.validate(good, { ...ctx, now: 1300, shooter: { x: 0, y: 0, lastShotAt: 900 } }).ok, true);
assert.equal(K.validate({ ...good, tx: 2000 }, { ...ctx, now: 1300, target: { x: 2000, y: 0 } }).reason, 'range');
assert.equal(K.validate({ ...good, t: 1000 }, { ...ctx, shooter: { x: 0, y: 0, lastShotAt: 950 } }).reason, 'rate');
assert.equal(K.validate({ ...good, fx: 300 }, { ...ctx, now: 1300 }).reason, 'shooter-position');
assert.equal(K.validate({ ...good, hp: 500 }, { ...ctx, now: 1300 }).reason, 'damage');
assert.equal(K.validate(good, { ...ctx, now: 1300, los: false }).reason, 'los');
// lag compensation
const hist = [{ t: 0, x: 0, y: 0 }, { t: 100, x: 100, y: 0 }, { t: 200, x: 100, y: 100 }];
assert.deepEqual(K.rewind(hist, 50), { x: 50, y: 0 }); assert.deepEqual(K.rewind(hist, 150), { x: 100, y: 50 }); assert.deepEqual(K.rewind(hist, 999), { x: 100, y: 100 });
console.log('PASS: combat core — seeded spread, falloff, armor/pen, cover/roll/sneak, downed/revive/bleed, teams, wire format, validation, rewind');

// police: helpless suspects get cuffed at any level, quickly
let t = 0, out = null; for (let i = 0; i < 60 && !out?.busted; i++) { out = WD.bustStep(t, { seen: false, near: 20, stars: 4, helpless: true, dt: 1 / 60 }); t = out.t; }
assert.ok(out.busted, 'tased/downed at 4 stars -> cuffed');
assert.equal(WD.bustStep(0, { near: 20, stars: 4, helpless: false, seen: true, dt: 1 }).busted, false, 'not helpless at 4 stars: no cuffing');
assert.equal(WD.bustStep(0, { near: 20, stars: 2, helpless: true, inCar: true, dt: 5 }).busted, false, 'not from a car');
console.log('PASS: police cuff tased or downed suspects at any wanted level');

// store break-ins: connected layout, registers, cameras, alarm panel inside, cameras see in their cone only
for (let seed = 1; seed < 30; seed++) {
  const L = B.generate('store', seed);
  assert.ok(B.connected(L)); assert.ok(L.loot.some((l) => l.kind === 'register'), 'a register'); assert.equal(L.cameras.length, 2); assert.ok(L.panel && L.panel.seconds > 0);
  const er = L.rooms[L.entryRoom]; assert.ok(L.panel.x > er.x && L.panel.x < er.x + er.w && L.panel.y > er.y && L.panel.y < er.y + er.h, 'panel inside the entry room');
  for (const c of L.cameras) { assert.notEqual(c.room, L.entryRoom); const look = { x: c.x + Math.cos(B.cameraAngle(c, 0)) * 40, y: c.y + Math.sin(B.cameraAngle(c, 0)) * 40 }, back = { x: c.x - Math.cos(B.cameraAngle(c, 0)) * 40, y: c.y - Math.sin(B.cameraAngle(c, 0)) * 40 }; assert.ok(B.cameraSees(c, look, 0) && !B.cameraSees(c, back, 0)); assert.ok(!B.cameraSees({ ...c, broken: true }, look, 0), 'broken cameras see nothing'); }
}
assert.equal(B.generate('house', 3).cameras.length, 0); assert.equal(B.generate('warehouse', 3).cameras.length, 1);
console.log('PASS: store break-ins — layout, registers, cameras with cones, alarm panel by the door');
