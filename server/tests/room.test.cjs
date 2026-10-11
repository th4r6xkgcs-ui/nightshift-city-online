'use strict';
// Room behaviour that matters on hosts with async storage (Cloudflare).
const test = require('node:test');
const assert = require('node:assert/strict');
const { Room } = require('../room.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class SlowStore {
  constructor(ms) { this.ms = ms; this.data = new Map(); this.saves = 0; }
  async load(t) { await sleep(this.ms); return this.data.has(t) ? structuredClone(this.data.get(t)) : null; }
  async save(t, p) { await sleep(1); this.saves++; this.data.set(t, structuredClone(p)); }
  async flush() {}
}

function fakeConn() {
  const out = [];
  return { out, ip: '1.1.1.1', lastSeen: Date.now(), closed: null,
    send(t) { out.push(JSON.parse(t)); }, close(code) { this.closed = code; },
    of(t) { return out.filter((m) => m.t === t); } };
}

test('messages sent while a saved character loads are kept, in order', async () => {
  const store = new SlowStore(80);
  const room = new Room({ store });
  const tok = 'a'.repeat(32);
  store.data.set(tok, { name: 'Ana', cash: 999 });
  const c = fakeConn();
  room.open(c);
  const hello = room.message(c, JSON.stringify({ t: 'hello', name: 'Ana', v: 1, token: tok }));
  room.message(c, JSON.stringify({ t: 'input', seq: 1, mx: 1, my: 0, aim: 0, sprint: false }));
  room.message(c, JSON.stringify({ t: 'pvp', on: true }));
  room.message(c, JSON.stringify({ t: 'pvp', on: false }));
  assert.equal(c.of('welcome').length, 0, 'still loading');
  await hello;
  const w = c.of('welcome')[0];
  assert.equal(w.resumed, true);
  assert.equal(w.you.cash, 999);
  const pvp = c.of('result').filter((r) => r.req === 'pvp').map((r) => r.pvp);
  assert.deepEqual(pvp, [true, false], 'queued actions ran after welcome, in order');
  const p = room.world.players.get(w.id);
  assert.equal(p.input.mx, 1, 'queued input applied');
  assert.equal(p.pvp, false);
});

test('a connection that closes while its character loads leaves no player behind', async () => {
  const room = new Room({ store: new SlowStore(60) });
  const c = fakeConn();
  room.open(c);
  const hello = room.message(c, JSON.stringify({ t: 'hello', name: 'Gone', v: 1, token: 'b'.repeat(32) }));
  room.close(c);
  await hello;
  assert.equal(room.playerCount, 0);
  assert.equal(room.world.players.size, 0);
});

test('a second hello after joining is a strike, not a second player', async () => {
  const room = new Room({ store: new SlowStore(1) });
  const c = fakeConn();
  room.open(c);
  await room.message(c, JSON.stringify({ t: 'hello', name: 'Ana', v: 1 }));
  room.message(c, JSON.stringify({ t: 'hello', name: 'Ana', v: 1 }));
  assert.equal(c.of('error').at(-1).reason, 'already joined');
  assert.equal(room.world.players.size, 1);
});

test('closing saves the character; reap closes silent connections', async () => {
  const store = new SlowStore(1);
  const room = new Room({ store });
  const c = fakeConn();
  room.open(c);
  await room.message(c, JSON.stringify({ t: 'hello', name: 'Ana', v: 1 }));
  const tok = c.of('welcome')[0].token;
  room.world.players.get(c.of('welcome')[0].id).cash = 4242;
  c.lastSeen = Date.now() - 60000;
  room.reap(30000);
  assert.equal(c.closed, 4000);
  await room.close(c);
  assert.equal(store.data.get(tok).cash, 4242);
});

test('roster: everyone in the city every 2 s, coarse positions, sorted by name', async () => {
  const R = require('../../shared/rules.js');
  const room = new Room({ store: new SlowStore(1) });
  const a = fakeConn(), b = fakeConn();
  room.open(a); room.open(b);
  await room.message(a, JSON.stringify({ t: 'hello', name: 'Zed', v: 1 }));
  await room.message(b, JSON.stringify({ t: 'hello', name: 'Amy', v: 1 }));
  const zed = room.world.players.get(a.of('welcome')[0].id);
  zed.x = 2123; zed.y = 1688; // far away: not in snapshots, but in the roster
  for (let i = 0; i < R.net.rosterEveryTicks; i++) room.tick();
  const r = b.of('roster').at(-1);
  assert.ok(r, 'roster delivered');
  assert.deepEqual(r.players.map((p) => p.name), ['Amy', 'Zed']);
  const z = r.players.find((p) => p.name === 'Zed');
  assert.deepEqual([z.x % R.net.rosterGridPx, z.y % R.net.rosterGridPx], [0, 0], 'coarse grid');
  assert.equal(z.cash, undefined, 'no private data');
  assert.equal(b.of('state').at(-1).others.length, 0, 'far player not in detailed snapshot');
});
