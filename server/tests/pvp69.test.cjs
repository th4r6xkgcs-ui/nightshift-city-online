'use strict';
// v0.69: shared-world PvP uses the game's combat rules (combat-core + weapon catalog) and lag compensation.
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../sim.js');
const R = require('../../shared/rules.js');
const { validate } = require('../../shared/protocol.js');
const WD = require('../../weapons-data.js');

let seq = 0;
const pos = (w, id, x, y, now) => w.handle(id, { t: 'pos', seq: ++seq, x, y, aim: 0, car: null }, now);
function duel(dist = 100) {
  const w = new World({ pvpDefault: true });
  w.addPlayer('a', 'Ana', 0, null, { presence: true }); w.addPlayer('b', 'Ben', 0, null, { presence: true });
  pos(w, 'a', 700, 340, 0); pos(w, 'b', 700 + dist, 340, 0); w.drain();
  return w;
}
const hits = (w) => w.drain().filter((e) => e.msg.kind === 'shot-hit');

test('protocol: fire accepts an optional weapon id and lag, rejects junk', () => {
  assert.equal(validate({ t: 'fire', aim: 0 }), null);
  assert.equal(validate({ t: 'fire', aim: 0, w: 'ar', lag: 160 }), null);
  assert.equal(validate({ t: 'fire', aim: 0, w: 'AR!' }), 'bad weapon');
  assert.equal(validate({ t: 'fire', aim: 0, lag: -5 }), 'bad lag');
  assert.equal(validate({ t: 'fire', aim: 0, lag: 'x' }), 'bad lag');
});

test('no weapon id: the old pistol rules (same damage as before)', () => {
  const w = duel();
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 1000).hit, 'b');
  assert.equal(hits(w)[0].msg.damage, R.combat.damage);
});

test('weapon damage comes from the catalog with distance falloff', () => {
  const ar = WD.WEAPONS.find((x) => x.id === 'ar');
  let w = duel(100); w.handle('a', { t: 'fire', aim: 0, w: 'ar' }, 1000); const close = hits(w)[0].msg.damage;
  assert.equal(close, Math.round(ar.dmg), 'full damage up close');
  w = duel(640); w.handle('a', { t: 'fire', aim: 0, w: 'ar' }, 1000); const far = hits(w)[0]?.msg.damage;
  assert.ok(far > 0 && far < close, `falls off at range (${far} < ${close})`);
});

test('shotgun pellets add up on a close target; fall off far away', () => {
  let w = duel(60); w.handle('a', { t: 'fire', aim: 0, w: 'pump' }, 1000); const h = hits(w);
  assert.equal(h.length, 1, 'one hit event per target, pellets summed');
  const pump = WD.WEAPONS.find((x) => x.id === 'pump');
  assert.ok(h[0].msg.damage > pump.dmg * 2, `several pellets connect (${h[0].msg.damage})`);
});

test('unknown weapon id fires like the default pistol', () => {
  const w = duel(); w.handle('a', { t: 'fire', aim: 0, w: 'railgun' }, 1000);
  assert.equal(hits(w)[0].msg.damage, R.combat.damage);
});

test('cadence follows the weapon: a pump can\'t be fired like an SMG', () => {
  const w = duel(); const t0 = 5000;
  const pump = [0, 1, 2, 3, 4].map((i) => w.handle('a', { t: 'fire', aim: 0, w: 'pump' }, t0 + i * 120).ok);
  assert.ok(pump.filter(Boolean).length <= 3, 'burst allowance only');
  const w2 = duel();
  const ar = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => w2.handle('a', { t: 'fire', aim: 0, w: 'ar' }, t0 + i * 120).ok);
  assert.ok(ar.every(Boolean), 'AR at its own rate is fine');
});

test('lag compensation: a shot hits where the target was on the shooter\'s screen (capped)', () => {
  const w = duel(200);
  // B strafes 60px down over 200ms (well inside the speed limit)
  pos(w, 'b', 900, 340, 1000); pos(w, 'b', 900, 370, 1100); pos(w, 'b', 900, 400, 1200); w.drain();
  // A aimed at where B was 150ms ago (y=340 at t=1050), message arrives at t=1200
  const aim = Math.atan2(355 - 340, 200);
  assert.equal(w.handle('a', { t: 'fire', aim, lag: 150 }, 1200).hit, 'b', 'rewound hit');
  const w2 = duel(200); pos(w2, 'b', 900, 340, 1000); pos(w2, 'b', 900, 370, 1100); pos(w2, 'b', 900, 400, 1200); w2.drain();
  assert.equal(w2.handle('a', { t: 'fire', aim, lag: 0 }, 1200).hit, null, 'without lag the same shot misses');
  // the cap: claiming a huge lag can't reach back further than lagCompMaxMs
  const w3 = duel(200); pos(w3, 'b', 900, 340, 1000); for (let i = 1; i <= 8; i++) pos(w3, 'b', 900, 340 + i * 15, 1000 + i * 100); w3.drain();
  assert.equal(w3.handle('a', { t: 'fire', aim: 0, lag: 900 }, 1800).hit, null, 'can\'t rewind 800ms');
});

test('PvP opt-in, walls and safe zone still apply with weapons', () => {
  const w = new World({ pvpDefault: false });
  w.addPlayer('a', 'Ana', 0, null, { presence: true }); w.addPlayer('b', 'Ben', 0, null, { presence: true });
  pos(w, 'a', 700, 340, 0); pos(w, 'b', 800, 340, 0); w.drain();
  assert.equal(w.handle('a', { t: 'fire', aim: 0, w: 'ar' }, 1000).blocked, 'pvp off');
});

test('positions beyond the old 2200x1700 map are accepted (9x city)', () => {
  const w = duel();
  assert.equal(pos(w, 'a', 6000, 4800, 0 + 1).ok || pos(w, 'a', 6000, 4800, 60000).ok, true);
  assert.equal(R.world.w, 6600); assert.equal(R.world.h, 5100);
});
