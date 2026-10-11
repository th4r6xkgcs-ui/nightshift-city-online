'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../sim.js');
const R = require('../../shared/rules.js');

function setup() {
  const w = new World({ pvpDefault: true });
  const a = w.addPlayer('a', 'Ana', 0);
  const home = w.city.apartment;
  return { w, a, home, go: (p, pos) => { p.x = pos.x; p.y = pos.y; } };
}
const stash = (w, dir, item, count, tx) => w.handle('a', { t: 'stash', dir, item, count, tx }, 0);

test('new players start with the client starter pocket', () => {
  const { a } = setup();
  assert.deepEqual(a.pocket, { scrap: 2, watch: 1, pistol: 1 });
  assert.equal(a.home.owned, false);
});

test('apartment: must stand at it, pay once, no double charge', () => {
  const { w, a, home, go } = setup();
  a.cash = 2000;
  assert.equal(w.handle('a', { t: 'home', tx: 'h0' }, 0).reason, 'not at the apartment');
  go(a, home);
  assert.equal(w.city.blocked(home.x, home.y), false, 'apartment anchor is walkable');
  const r = w.handle('a', { t: 'home', tx: 'h1' }, 0);
  assert.deepEqual([r.ok, r.cost], [true, R.home.price]);
  assert.equal(w.handle('a', { t: 'home', tx: 'h1' }, 0).replay, true);
  assert.equal(w.handle('a', { t: 'home', tx: 'h2' }, 0).reason, 'already owned');
  assert.equal(a.cash, 800);
});

test('apartment: insufficient funds changes nothing', () => {
  const { w, a, home, go } = setup();
  go(a, home);
  assert.equal(w.handle('a', { t: 'home', tx: 'h1' }, 0).reason, 'not enough cash');
  assert.equal(a.cash, R.player.startCash);
  assert.equal(a.home.owned, false);
});

test('stash needs ownership and presence at home', () => {
  const { w, a, home, go } = setup();
  assert.equal(stash(w, 'in', 'cash', 10, 's1').reason, 'no apartment');
  a.home.owned = true;
  assert.equal(stash(w, 'in', 'cash', 10, 's2').reason, 'not at home');
  go(a, home);
  assert.equal(stash(w, 'in', 'cash', 10, 's3').ok, true);
});

test('stash cash/items/ammo in and out; caps; conservation; replay safe', () => {
  const { w, a, home, go } = setup();
  a.home.owned = true; go(a, home);
  const total = w.totalCash();
  assert.equal(stash(w, 'in', 'cash', 500, 'c1').ok, true);
  assert.equal(stash(w, 'in', 'cash', 500, 'c1').replay, true);
  assert.equal(a.cash, 250);
  assert.equal(a.home.stash.cash, 500);
  assert.equal(stash(w, 'in', 'cash', 251, 'c2').reason, 'not enough cash');
  assert.equal(stash(w, 'out', 'cash', 501, 'c3').reason, 'not in stash');
  assert.equal(stash(w, 'out', 'cash', 200, 'c4').ok, true);
  assert.equal(w.totalCash(), total);

  assert.equal(stash(w, 'in', 'watch', 1, 'i1').ok, true);
  assert.equal(a.pocket.watch, undefined);
  assert.equal(stash(w, 'in', 'watch', 1, 'i2').reason, 'none carried');
  assert.equal(stash(w, 'out', 'watch', 1, 'i3').ok, true);
  assert.equal(a.pocket.watch, 1);
  assert.equal(stash(w, 'in', 'rocket', 1, 'i4').reason, 'cannot store that');

  // ammo: only spare rounds, magazine untouched
  const mag = a.mag;
  assert.equal(stash(w, 'in', 'ammo', a.reserve + 1, 'a1').reason, 'not enough spare ammo');
  assert.equal(stash(w, 'in', 'ammo', 90, 'a2').ok, true);
  assert.deepEqual([a.mag, a.reserve, a.home.stash.ammo], [mag, 0, 90]);
  a.reserve = R.combat.maxReserve;
  assert.equal(stash(w, 'out', 'ammo', 1, 'a3').reason, 'carrying max ammo');
  a.reserve = 0;
  assert.equal(stash(w, 'out', 'ammo', 90, 'a4').ok, true);
  assert.equal(a.home.stash.ammo, undefined);
});

test('stash ammo blocked while reloading', () => {
  const { w, a, home, go } = setup();
  a.home.owned = true; go(a, home);
  a.mag = 10;
  w.handle('a', { t: 'reload' }, 0);
  assert.equal(stash(w, 'in', 'ammo', 10, 'r1').reason, 'reloading');
});

test('stash survives death; pockets drop', () => {
  const { w, a, home, go } = setup();
  const b = w.addPlayer('b', 'Ben', 0);
  a.home.owned = true; go(a, home);
  stash(w, 'in', 'cash', 700, 'd1');
  stash(w, 'in', 'pistol', 1, 'd2');
  assert.ok(!w.city.inClinic(a));
  go(b, { x: home.x - 100, y: home.y });
  b.mag = 30;
  let now = 0;
  while (!a.deadUntil) { w.handle('b', { t: 'fire', aim: 0 }, now); now += 200; }
  assert.equal(a.cash, 0);
  assert.equal(a.home.stash.cash, 700);
  assert.equal(a.home.stash.pistol, 1);
  assert.deepEqual(a.pocket, {});
});

test('home and stash persist through save/restore with clamping', () => {
  const { w, a, home, go } = setup();
  a.home.owned = true; go(a, home);
  stash(w, 'in', 'cash', 300, 'p1');
  const prof = w.exportProfile('a');
  const w2 = new World();
  const r = w2.addPlayer('x', 'Ana', 0, prof);
  assert.deepEqual(r.home, { owned: true, stash: { cash: 300 } });
  const evil = w2.addPlayer('y', 'Eve', 0, { home: { owned: true, stash: { cash: 1e15, ammo: 5000, rocket: 3, watch: -1 } } });
  assert.deepEqual(evil.home.stash, { cash: R.home.stashCashCap, ammo: R.home.stashAmmoCap });
  const notOwner = w2.addPlayer('z', 'Zed', 0, { home: { owned: 'yes', stash: { cash: 50 } } });
  assert.deepEqual(notOwner.home, { owned: false, stash: {} });
});

test('others never see your stash', () => {
  const { w, a } = setup();
  const b = w.addPlayer('b', 'Ben', 0);
  b.x = a.x + 20; b.y = a.y;
  a.home.owned = true; a.home.stash = { cash: 999 };
  const seen = w.snapshotFor('b').others.find((o) => o.id === 'a');
  assert.equal(seen.home, undefined);
  assert.equal(w.snapshotFor('a').you.home.stash.cash, 999);
});

test('bad stash messages are strikes', () => {
  const { w } = setup();
  for (const m of [{ t: 'stash', dir: 'sideways', item: 'cash', count: 1, tx: 'x' }, { t: 'stash', dir: 'in', item: 'cash', count: 0, tx: 'x' },
    { t: 'stash', dir: 'in', item: 'cash', count: 2.5, tx: 'x' }, { t: 'stash', dir: 'in', item: 'CASH!', count: 1, tx: 'x' }, { t: 'home' }]) {
    assert.equal(w.handle('a', m, 0).strike, true, JSON.stringify(m));
  }
});
