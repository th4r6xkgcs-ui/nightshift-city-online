'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../index.js');
const { World } = require('../sim.js');
const { FileStore, MemoryStore, newToken } = require('../store.js');
const R = require('../../shared/rules.js');

function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const inbox = [], waiters = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    const w = waiters.find((x) => x.pred(m));
    if (w) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); } else inbox.push(m);
  });
  return {
    ws,
    open: new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); }),
    closed: new Promise((r) => ws.addEventListener('close', (e) => r(e.code), { once: true })),
    send: (m) => ws.send(JSON.stringify(m)),
    wait(pred, ms = 3000) {
      const i = inbox.findIndex(pred);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const w = { pred, resolve: (m) => { clearTimeout(t); resolve(m); } };
        const t = setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); reject(new Error('timeout')); }, ms);
        waiters.push(w);
      });
    },
  };
}

async function join(port, name, token) {
  const c = client(port);
  await c.open;
  c.send(token ? { t: 'hello', name, v: 1, token } : { t: 'hello', name, v: 1 });
  c.welcome = await c.wait((m) => m.t === 'welcome');
  return c;
}

test('restore clamps damaged or hostile profile values', () => {
  const w = new World();
  const p = w.addPlayer('a', 'Ana', 0, {
    name: '<script>', cash: 1e12, hp: -5, mag: 99, reserve: 9999,
    pocket: { pistol: 5, rocket: 3, watch: 1.5, medkit: -2 }, x: 600, y: 500, pvp: 'yes',
  });
  assert.equal(p.name, 'Ana');
  assert.equal(p.cash, R.cashCap);
  assert.equal(p.hp, 1);
  assert.equal(p.reserve, R.combat.maxReserve);
  assert.ok(p.mag + p.reserve <= R.combat.maxCarriedRounds);
  assert.deepEqual(p.pocket, { pistol: 5 });
  assert.equal(p.pvp, false);
  assert.ok(!w.city.blocked(p.x, p.y), 'position inside a building is rejected');
  assert.deepEqual([p.x, p.y], [R.spawn.x, R.spawn.y]);
});

test('dead players are saved as respawned at the hospital', () => {
  const w = new World();
  const p = w.addPlayer('a', 'Ana', 0);
  p.deadUntil = 5000; p.hp = 0; p.x = 900;
  const prof = w.exportProfile('a');
  assert.equal(prof.hp, 100);
  assert.deepEqual([prof.x, prof.y], [R.hospital.x, R.hospital.y]);
});

test('file store: atomic save, reload, hashed tokens, corrupt file kept', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsco-'));
  const file = path.join(dir, 'profiles.json');
  const tok = newToken();
  const s1 = new FileStore(file);
  s1.save(tok, { name: 'Ana', cash: 123 });
  s1.flush();
  const raw = fs.readFileSync(file, 'utf8');
  assert.ok(!raw.includes(tok), 'raw token never written to disk');
  assert.equal(new FileStore(file).load(tok).cash, 123);
  assert.equal(new FileStore(file).load(newToken()), null);
  assert.equal(new FileStore(file).load('../../etc/passwd'), null);
  fs.writeFileSync(file, '{broken');
  const s3 = new FileStore(file);
  assert.equal(s3.size, 0);
  assert.ok(fs.readdirSync(dir).some((f) => f.includes('.corrupt-')), 'corrupt file preserved');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('reconnect with token restores the same character', async (t) => {
  const srv = createServer({ port: 0, store: new MemoryStore() });
  await srv.ready;
  t.after(() => srv.close());
  const a = await join(srv.port, 'Ana');
  assert.equal(a.welcome.resumed, false);
  const token = a.welcome.token;
  const p = srv.world.players.get(a.welcome.id);
  p.x = 1080; p.y = 1287; // walk to the shop (placed directly for the test)
  a.send({ t: 'buy', item: 'pistol', tx: 'p1' });
  assert.equal((await a.wait((m) => m.t === 'result')).ok, true);
  a.ws.close();
  await a.closed;
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(srv.world.players.size, 0);

  const a2 = await join(srv.port, 'SomeoneElse', token);
  assert.equal(a2.welcome.resumed, true);
  assert.equal(a2.welcome.token, token);
  assert.equal(a2.welcome.you.name, 'Ana', 'saved name kept');
  assert.equal(a2.welcome.you.cash, R.player.startCash - R.shop.pistol);
  assert.equal(a2.welcome.you.pocket.pistol, 2);
  assert.deepEqual([a2.welcome.you.x, a2.welcome.you.y], [1080, 1287]);
});

test('unknown token starts fresh; same token twice kicks the older session', async (t) => {
  const srv = createServer({ port: 0, store: new MemoryStore() });
  await srv.ready;
  t.after(() => srv.close());
  const fresh = await join(srv.port, 'New', newToken());
  assert.equal(fresh.welcome.resumed, false);

  const a = await join(srv.port, 'Ana');
  const b = await join(srv.port, 'Ana2', a.welcome.token);
  assert.equal(b.welcome.resumed, true);
  assert.equal(await a.closed, 4004);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(srv.world.players.size, 2, 'no duplicate character in the world');
});

test('server restart keeps profiles via file store', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsco-'));
  const file = path.join(dir, 'profiles.json');
  let srv = createServer({ port: 0, store: new FileStore(file) });
  await srv.ready;
  const a = await join(srv.port, 'Ana');
  srv.world.players.get(a.welcome.id).cash = 4321;
  await srv.close();

  srv = createServer({ port: 0, store: new FileStore(file) });
  await srv.ready;
  const a2 = await join(srv.port, 'Ana', a.welcome.token);
  assert.equal(a2.welcome.resumed, true);
  assert.equal(a2.welcome.you.cash, 4321);
  await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
