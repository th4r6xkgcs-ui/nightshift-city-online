'use strict';
// Shared-world ("presence") mode used by the real game while its economy and
// combat are still local.
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../sim.js');
const R = require('../../shared/rules.js');

function setup() {
  const w = new World({ pvpDefault: true });
  const a = w.addPlayer('a', 'Ana', 0, null, { presence: true });
  const b = w.addPlayer('b', 'Ben', 0, null, { presence: true });
  return { w, a, b };
}
let seq = 0;
const pos = (w, id, x, y, now, car = null) => w.handle(id, { t: 'pos', seq: ++seq, x, y, aim: 0.5, car }, now);

test('first report is accepted anywhere valid; others see it, including cars', () => {
  const { w, a } = setup();
  assert.equal(pos(w, 'a', 1500, 340, 0).ok, true);
  assert.deepEqual([a.x, a.y], [1500, 340]);
  pos(w, 'a', 1510, 340, 100, { angle: 1.2, color: '#c33' });
  const seen = w.snapshotFor('b');
  w.players.get('b').x = 1400; w.players.get('b').y = 340;
  const other = w.snapshotFor('b').others.find((o) => o.id === 'a');
  assert.deepEqual(other.car, { angle: 1.2, color: '#c33' });
  assert.equal(other.presence, true);
  assert.ok(seen);
});

test('walking and driving speeds are accepted; teleports are not', () => {
  const { w, a } = setup();
  pos(w, 'a', 700, 340, 0);
  assert.equal(pos(w, 'a', 718, 340, 100).ok, true, 'walk 180px/s');
  assert.equal(pos(w, 'a', 760, 340, 200).ok, true, 'drive ~420px/s');
  const r = pos(w, 'a', 2000, 1500, 300);
  assert.equal(r.ok, false, 'teleport across town refused');
  assert.deepEqual([a.x, a.y], [760, 340], 'position unchanged');
});

test('jumps to legitimate places (hospital respawn, doors, home) are allowed', () => {
  const { w, a } = setup();
  pos(w, 'a', 2000, 1000, 0);
  assert.equal(pos(w, 'a', R.hospital.x, R.hospital.y, 50).ok, true, 'respawn at clinic');
  const door = w.city.buildings[10].entrance;
  pos(w, 'a', 700, 340, 5000);
  assert.equal(pos(w, 'a', door.x, door.y, 5050).ok, true, 'exit an interior at its door');
});

test('inside buildings or off the map is always refused', () => {
  const { w, a } = setup();
  pos(w, 'a', 700, 340, 0);
  const b = w.city.buildings[0];
  assert.equal(pos(w, 'a', b.x + 50, b.y + 50, 10000).ok, false);
  assert.equal(pos(w, 'a', -50, 340, 20000).ok, false);
  assert.equal(pos(w, 'a', 700, 99999, 30000).ok, false);
  assert.deepEqual([a.x, a.y], [700, 340]);
});

test('a client that keeps disagreeing is resynced after a while, not stuck forever', () => {
  const { w, a } = setup();
  pos(w, 'a', 700, 340, 0);
  assert.equal(pos(w, 'a', 1900, 340, 100).ok, false);
  assert.equal(pos(w, 'a', 1900, 340, 1000).ok, false);
  assert.equal(pos(w, 'a', 1900, 340, 100 + R.presence.resyncAfterMs).ok, true);
  assert.equal(a.x, 1900);
});

test('stale reports are ignored', () => {
  const { w, a } = setup();
  w.handle('a', { t: 'pos', seq: 10, x: 700, y: 340, aim: 0 }, 0);
  assert.equal(w.handle('a', { t: 'pos', seq: 9, x: 710, y: 340, aim: 0 }, 50).ok, false);
  assert.equal(a.x, 700);
});

test('server economy is off in shared-world mode; chat works', () => {
  const { w } = setup();
  for (const m of [{ t: 'buy', item: 'ammo', tx: 'x' }, { t: 'job', action: 'start', tx: 'y' }, { t: 'give', to: 'b', cash: 5, tx: 'z' }]) {
    assert.equal(w.handle('a', m, 0).reason, 'not available in shared-world mode', m.t);
  }
  assert.equal(w.handle('a', { t: 'chat', ch: 'city', text: 'hi' }, 0).ok, true);
});

test('full-mode players cannot be shot by or shoot shared-world players, and cannot send pos', () => {
  const w = new World({ pvpDefault: true });
  const full = w.addPlayer('f', 'Full', 0);
  const pres = w.addPlayer('p', 'Pres', 0, null, { presence: true });
  full.x = 700; full.y = 340; pres.x = 760; pres.y = 340;
  assert.equal(w.handle('f', { t: 'fire', aim: 0 }, 0).hit, null);
  assert.equal(pres.hp, 100);
  assert.equal(w.handle('f', { t: 'pos', seq: 1, x: 1, y: 1, aim: 0 }, 0).ok, false);
});

test('malformed pos messages are strikes', () => {
  const { w } = setup();
  for (const m of [{ t: 'pos', seq: 1, x: 'a', y: 1, aim: 0 }, { t: 'pos', seq: 2, x: 1, y: 1, aim: 0, car: { angle: 'x' } },
    { t: 'pos', seq: 3, x: 1, y: 1, aim: 0, car: { angle: 1, color: 'red;}' } }]) {
    assert.equal(w.handle('a', m, 0).strike, true, JSON.stringify(m));
  }
});

// ---------- shared-world combat ----------
function duel() {
  const w = new World();
  const a = w.addPlayer('a', 'Ana', 0, null, { presence: true });
  const b = w.addPlayer('b', 'Ben', 0, null, { presence: true });
  a.x = 700; a.y = 340; b.x = 800; b.y = 340;
  return { w, a, b };
}
const events = (w, kind) => w.drain().filter((e) => e.msg.kind === kind);

test('shared-world PvP: hits only when both opted in; victim and shooter told', () => {
  const { w, a, b } = duel();
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 0).blocked, 'pvp off');
  w.drain();
  w.handle('a', { t: 'pvp', on: true }, 0); w.handle('b', { t: 'pvp', on: true }, 0);
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 200).hit, 'b');
  const out = w.drain();
  const hit = out.find((e) => e.msg.kind === 'shot-hit');
  assert.deepEqual([hit.to, hit.msg.by, hit.msg.byName, hit.msg.damage], ['b', 'a', 'Ana', R.combat.damage]);
  assert.ok(out.some((e) => e.to === 'a' && e.msg.kind === 'hit-confirm' && e.msg.target === 'b'));
  assert.equal(b.hp, 100, 'the game, not the server, owns shared-world health');
});

test('shared-world shots: walls, clinic and misses', () => {
  const { w, a, b } = duel();
  a.pvp = b.pvp = true;
  assert.equal(w.handle('a', { t: 'fire', aim: Math.PI }, 0).hit, null, 'aimed away');
  const bld = w.city.buildings.find((q) => q.y > 340 && q.x < 700 && q.x + q.w > 700);
  a.x = bld.x - 40; a.y = bld.y + 80; b.x = bld.x + bld.w + 40; b.y = bld.y + 80;
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 1000).blocked, 'wall');
  const c = w.city.clinic;
  a.x = c.x + 150; a.y = c.y; b.x = c.x; b.y = c.y;
  assert.equal(w.handle('a', { t: 'fire', aim: Math.PI }, 2000).blocked, 'safe zone');
});

test('shared-world shots: cars soften hits; you cannot shoot from inside a car', () => {
  const { w, a, b } = duel();
  a.pvp = b.pvp = true;
  b.car = { angle: 0 }; b.y = 355; // a car is a bigger target than a person
  w.handle('a', { t: 'fire', aim: 0 }, 0);
  assert.equal(events(w, 'shot-hit')[0].msg.damage, R.presence.carDamage);
  a.car = { angle: 0 };
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 1000).reason, 'in a car');
});

test('shared-world shots: burst-tolerant cadence stops rapid-fire cheats', () => {
  const { w } = duel();
  const r = [0, 0, 0, 0].map(() => w.handle('a', { t: 'fire', aim: 0 }, 1000).ok);
  assert.deepEqual(r, [true, true, true, false], 'network bunching of 3 allowed, a 4th instant shot is not');
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 1000 + R.combat.fireIntervalMs).ok, true);
  let ok = 0;
  for (let t = 2000; t < 4000; t += 20) if (w.handle('a', { t: 'fire', aim: 0 }, t).ok) ok++;
  assert.ok(ok <= Math.ceil(2000 / R.combat.fireIntervalMs) + R.presence.shotBurst, `sustained rate capped (${ok} in 2s)`);
});

test('shot tracers reach nearby players (also for NPC shots), not far ones', () => {
  const { w } = duel();
  const far = w.addPlayer('f', 'Far', 0, null, { presence: true });
  far.x = 2100; far.y = 1600;
  w.handle('a', { t: 'fire', aim: 1.2 }, 0);
  const tr = events(w, 'shot');
  assert.deepEqual(tr.map((e) => e.to), ['b']);
  assert.equal(tr[0].msg.from, 'a');
  assert.ok(tr[0].msg.len > 0 && tr[0].msg.len <= R.combat.rangePx);
});
