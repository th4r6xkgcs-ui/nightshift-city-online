'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../sim.js');
const R = require('../../shared/rules.js');

// Open road on the y=340 street, away from the clinic safe zone.
const ROAD = { x: 700, y: 340 };
const SHOP = { x: 1080, y: 1277 }; // corner shop entrance from the city layout
const at = (p, pos) => { p.x = pos.x; p.y = pos.y; };

function two(opts) {
  const w = new World(opts);
  const a = w.addPlayer('a', 'Ana', 0);
  const b = w.addPlayer('b', 'Ben', 0);
  at(a, ROAD); at(b, { x: ROAD.x + 60, y: ROAD.y });
  return { w, a, b };
}

test('movement is integrated by the server at rule speed, not client claims', () => {
  const { w, a, b } = two();
  at(b, { x: 2000, y: 1000 });
  const start = a.x;
  w.handle('a', { t: 'input', seq: 1, mx: 1, my: 0, aim: 0, sprint: false }, 0);
  for (let i = 1; i <= 20; i++) w.step(50, i * 50); // 1 second
  assert.ok(Math.abs(a.x - (start + R.player.walkPxPerSec)) < 0.01);
  // A hacked stick value of 50 is clamped to 1; sprint caps at run speed.
  const x0 = a.x;
  w.handle('a', { t: 'input', seq: 2, mx: 50, my: 0, aim: 0, sprint: true }, 1000);
  for (let i = 1; i <= 20; i++) w.step(50, 1000 + i * 50);
  assert.ok(Math.abs(a.x - x0 - R.player.runPxPerSec) < 0.01);
});

test('diagonal input is normalized and world bounds hold', () => {
  const { w, a } = two();
  const x0 = a.x, y0 = a.y;
  w.handle('a', { t: 'input', seq: 1, mx: 1, my: 1, aim: 0, sprint: false }, 0);
  w.step(1000, 1000); // 1s, bounded to 250ms per step
  const moved = Math.hypot(a.x - x0, a.y - y0);
  assert.ok(Math.abs(moved - R.player.walkPxPerSec * 0.25) < 0.01, 'stall is bounded and diagonal not faster');
  w.handle('a', { t: 'input', seq: 2, mx: -1, my: -1, aim: 0, sprint: true }, 1000);
  for (let i = 0; i < 40; i++) w.step(250, 1000 + i * 250);
  assert.equal(a.x, R.player.radius);
  assert.equal(a.y, R.player.radius);
});

test('stale and out-of-order input is ignored', () => {
  const { w, a } = two();
  w.handle('a', { t: 'input', seq: 5, mx: 1, my: 0, aim: 0, sprint: false }, 0);
  const r = w.handle('a', { t: 'input', seq: 4, mx: -1, my: 0, aim: 0, sprint: false }, 0);
  assert.equal(r.ok, false);
  assert.equal(a.input.mx, 1);
});

test('malformed messages are rejected as strikes', () => {
  const { w } = two();
  for (const m of [null, [], { t: 'nope' }, { t: 'input', seq: 1, mx: NaN, my: 0, aim: 0, sprint: false },
    { t: 'buy', item: 'ammo' }, { t: 'give', to: 'b', cash: -5, tx: 'x' }, { t: 'give', to: 'b', cash: 1.5, tx: 'x' }]) {
    const r = w.handle('a', m, 0);
    assert.equal(r.ok, false);
    assert.equal(r.strike, true);
  }
});

test('fire cadence, magazine, reload timing all enforced', () => {
  const { w, a } = two();
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 0).ok, true);
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 100).reason, 'too fast');
  let now = 180;
  while (a.mag > 0) { assert.equal(w.handle('a', { t: 'fire', aim: 0 }, now).ok, true); now += 180; }
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, now).reason, 'empty');
  assert.equal(w.handle('a', { t: 'reload' }, now).ok, true);
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, now + 10).reason, 'reloading');
  w.step(50, now + R.combat.reloadMs - 1);
  assert.equal(a.mag, 0, 'reload not finished early');
  w.step(50, now + R.combat.reloadMs);
  assert.equal(a.mag, 30);
  assert.equal(a.reserve, R.combat.startReserve - 30);
});

test('PvP is opt-in: no damage unless both players enabled it', () => {
  const { w, a, b } = two();
  b.x = a.x + 100; b.y = a.y;
  const r = w.handle('a', { t: 'fire', aim: 0 }, 0);
  assert.equal(r.hit, null);
  assert.equal(b.hp, 100);
  w.handle('a', { t: 'pvp', on: true }, 0);
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 200).hit, null, 'target has not opted in');
  w.handle('b', { t: 'pvp', on: true }, 0);
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 400).hit, 'b');
  assert.equal(b.hp, 100 - R.combat.damage);
});

test('shots miss when aimed away or out of range', () => {
  const { w, a, b } = two({ pvpDefault: true });
  b.x = a.x + 100; b.y = a.y;
  assert.equal(w.handle('a', { t: 'fire', aim: Math.PI }, 0).hit, null);
  assert.equal(w.handle('a', { t: 'fire', aim: Math.PI / 2 }, 200).hit, null);
  b.x = a.x + R.combat.rangePx + 50;
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 400).hit, null);
});

test('death drops a bag, conserves cash, respawns at hospital', () => {
  const { w, a, b } = two({ pvpDefault: true });
  b.x = a.x + 100; b.y = a.y;
  const total = w.totalCash();
  let now = 0;
  for (let i = 0; i < 5; i++) { w.handle('a', { t: 'fire', aim: 0 }, now); now += 180; }
  assert.equal(b.hp, 0);
  assert.ok(b.deadUntil > 0);
  assert.equal(b.cash, 0);
  assert.equal(w.bags.size, 1);
  assert.equal(w.totalCash(), total, 'death moves cash into the bag, never deletes it');
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, now).hit, null, 'cannot hit the dead');
  assert.equal(w.handle('b', { t: 'buy', item: 'med', tx: 't1' }, now).ok, false);
  const events = w.drain().map((e) => e.msg.kind);
  assert.ok(events.includes('death'));
  w.step(50, now + R.hospital.respawnMs);
  assert.equal(b.hp, 100);
  assert.equal(b.x, R.hospital.x);
});

test('loot bag: in range only, transfers once, cash conserved', () => {
  const { w, a, b } = two({ pvpDefault: true });
  b.x = a.x + 100; b.y = a.y;
  let now = 0;
  for (let i = 0; i < 5; i++) { w.handle('a', { t: 'fire', aim: 0 }, now); now += 180; }
  const [bagId] = w.bags.keys();
  const total = w.totalCash();
  assert.equal(w.handle('a', { t: 'pickup', bag: bagId }, now).reason, 'too far');
  a.x = b.x; a.y = b.y;
  const before = a.cash;
  const r = w.handle('a', { t: 'pickup', bag: bagId }, now);
  assert.equal(r.ok, true);
  assert.equal(a.cash, before + R.player.startCash);
  assert.equal(a.pocket.pistol, 2);
  assert.equal(w.handle('a', { t: 'pickup', bag: bagId }, now).reason, 'gone');
  assert.equal(w.totalCash(), total);
  assert.ok(a.reserve <= R.combat.maxReserve);
  assert.ok(a.mag + a.reserve <= R.combat.maxCarriedRounds);
});

test('bags expire', () => {
  const { w, a, b } = two({ pvpDefault: true });
  b.x = a.x + 100; b.y = a.y;
  let now = 0;
  for (let i = 0; i < 5; i++) { w.handle('a', { t: 'fire', aim: 0 }, now); now += 180; }
  w.step(50, now + R.bags.lifetimeMs);
  assert.equal(w.bags.size, 0);
});

test('shop prices match client and replayed transaction ids never double-charge', () => {
  const { w, a } = two();
  at(a, SHOP);
  const r1 = w.handle('a', { t: 'buy', item: 'ammo', tx: 'buy-1' }, 0);
  assert.deepEqual([r1.ok, r1.rounds, r1.cost], [true, 30, 60]);
  assert.equal(a.cash, 690);
  const r2 = w.handle('a', { t: 'buy', item: 'ammo', tx: 'buy-1' }, 0);
  assert.equal(r2.replay, true);
  assert.equal(a.cash, 690, 'replay did not charge again');
  assert.equal(a.reserve, 120);
  assert.equal(w.handle('a', { t: 'buy', item: 'pistol', tx: 'buy-2' }, 0).cost, 150);
  assert.equal(w.handle('a', { t: 'buy', item: 'medkit', tx: 'buy-3' }, 0).cost, 60);
  assert.equal(w.handle('a', { t: 'buy', item: 'med', tx: 'buy-4' }, 0).reason, 'health full');
  assert.equal(w.handle('a', { t: 'buy', item: 'rocket', tx: 'buy-5' }, 0).reason, 'unknown item');
  assert.equal(a.cash, 480);
});

test('ammo purchases stop at reserve and carried caps', () => {
  const { w, a } = two();
  at(a, SHOP);
  a.cash = 100000;
  for (let i = 0; i < 20; i++) w.handle('a', { t: 'buy', item: 'ammo', tx: 'a' + i }, 0);
  assert.equal(a.reserve, R.combat.maxReserve);
  assert.ok(a.mag + a.reserve <= R.combat.maxCarriedRounds);
});

test('insufficient funds leaves state untouched', () => {
  const { w, a } = two();
  at(a, SHOP);
  a.cash = 10;
  const snap = JSON.stringify(w.privateView(a));
  assert.equal(w.handle('a', { t: 'buy', item: 'pistol', tx: 'p' }, 0).reason, 'not enough cash');
  assert.equal(JSON.stringify(w.privateView(a)), snap);
});

test('selling only what you carry; medkit use only when hurt', () => {
  const { w, a } = two();
  at(a, SHOP);
  assert.equal(w.handle('a', { t: 'sell', item: 'watch', tx: 's1' }, 0).reason, 'none carried');
  a.pocket.watch = 1;
  assert.equal(w.handle('a', { t: 'sell', item: 'watch', tx: 's2' }, 0).price, 85);
  assert.equal(w.handle('a', { t: 'sell', item: 'watch', tx: 's3' }, 0).reason, 'none carried');
  assert.equal(w.handle('a', { t: 'sell', item: 'pistol', tx: 's4' }, 0).reason, 'cannot sell that');
  a.pocket.medkit = 1;
  assert.equal(w.handle('a', { t: 'use', item: 'medkit' }, 0).reason, 'health full');
  a.hp = 70;
  assert.equal(w.handle('a', { t: 'use', item: 'medkit' }, 0).hp, 100);
  assert.equal(a.pocket.medkit, undefined);
});

test('cash gifts: proximity, limits, atomic, idempotent, conserved', () => {
  const { w, a, b } = two();
  const total = w.totalCash();
  b.x = a.x + 500;
  assert.equal(w.handle('a', { t: 'give', to: 'b', cash: 100, tx: 'g1' }, 0).reason, 'too far');
  b.x = a.x + 30;
  assert.equal(w.handle('a', { t: 'give', to: 'b', cash: 5000, tx: 'g2' }, 0).reason, 'not enough cash');
  assert.equal(w.handle('a', { t: 'give', to: 'a', cash: 5, tx: 'g3' }, 0).reason, 'no such player');
  assert.equal(w.handle('a', { t: 'give', to: 'b', cash: 100, tx: 'g4' }, 0).ok, true);
  assert.equal(w.handle('a', { t: 'give', to: 'b', cash: 100, tx: 'g4' }, 0).replay, true);
  assert.equal(a.cash, 650);
  assert.equal(b.cash, 850);
  assert.equal(w.totalCash(), total);
});

test('snapshots hide other players private data and respect interest radius', () => {
  const { w, a, b } = two();
  const s = w.snapshotFor('a');
  assert.equal(s.others.length, 1);
  assert.equal(s.others[0].cash, undefined);
  assert.equal(s.others[0].pocket, undefined);
  assert.equal(s.you.cash, a.cash);
  b.x = a.x + R.net.interestRadiusPx + 10;
  assert.equal(w.snapshotFor('a').others.length, 0);
});

test('transaction memory is bounded', () => {
  const { w, a } = two();
  at(a, SHOP);
  a.cash = 1e6;
  for (let i = 0; i < R.net.txMemory + 50; i++) w.handle('a', { t: 'sell', item: 'watch', tx: 'x' + i }, 0);
  assert.equal(a.tx.size, R.net.txMemory);
});

test('buildings block walking; players slide along walls', () => {
  const { w, a } = two();
  const city = w.city;
  const bld = city.buildings.find((b) => b.y > ROAD.y && b.x < ROAD.x && b.x + b.w > ROAD.x);
  // Walk straight down from the road into the building below.
  w.handle('a', { t: 'input', seq: 1, mx: 0, my: 1, aim: 0, sprint: true }, 0);
  for (let i = 1; i <= 40; i++) w.step(50, i * 50);
  assert.ok(a.y <= bld.y - 9, 'stopped at the wall');
  assert.equal(city.blocked(a.x, a.y), false);
  // Diagonal into the wall still slides sideways.
  const x0 = a.x;
  w.handle('a', { t: 'input', seq: 2, mx: 1, my: 1, aim: 0, sprint: false }, 2000);
  for (let i = 1; i <= 10; i++) w.step(50, 2000 + i * 50);
  assert.ok(a.x > x0 + 50, 'slid along the wall');
  assert.equal(city.blocked(a.x, a.y), false);
});

test('buildings stop bullets (cover)', () => {
  const { w, a, b } = two({ pvpDefault: true });
  const bld = w.city.buildings.find((q) => q.y > ROAD.y && q.x < ROAD.x && q.x + q.w > ROAD.x);
  at(a, { x: bld.x - 40, y: bld.y + 80 });
  at(b, { x: bld.x + bld.w + 40, y: bld.y + 80 });
  const r = w.handle('a', { t: 'fire', aim: 0 }, 0);
  assert.equal(r.blocked, 'wall');
  assert.equal(b.hp, 100);
});

test('clinic safe zone blocks damage both ways', () => {
  const { w, a, b } = two({ pvpDefault: true });
  const c = w.city.clinic;
  at(b, { x: c.x, y: c.y });
  at(a, { x: c.x + 150, y: c.y });
  assert.equal(w.handle('a', { t: 'fire', aim: Math.PI }, 0).blocked, 'safe zone');
  at(a, { x: c.x, y: c.y }); at(b, { x: c.x + 150, y: c.y });
  assert.equal(w.handle('a', { t: 'fire', aim: 0 }, 200).blocked, 'safe zone');
  assert.equal(b.hp, 100);
});

test('trading requires standing at a corner shop', () => {
  const { w, a } = two();
  a.pocket.watch = 1;
  assert.equal(w.handle('a', { t: 'buy', item: 'ammo', tx: 'f1' }, 0).reason, 'not at a shop');
  assert.equal(w.handle('a', { t: 'sell', item: 'watch', tx: 'f2' }, 0).reason, 'not at a shop');
  assert.equal(a.cash, R.player.startCash);
  at(a, SHOP);
  assert.equal(w.handle('a', { t: 'sell', item: 'watch', tx: 'f3' }, 0).ok, true);
});
