'use strict';
// End-to-end: real server, two real WebSocket clients on localhost.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../index.js');
const R = require('../../shared/rules.js');

function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const inbox = [];
  const waiters = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    inbox.push(m);
    for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
  });
  const c = {
    ws, inbox,
    open: new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); }),
    send: (m) => ws.send(JSON.stringify(m)),
    wait(pred, ms = 3000) {
      const hit = inbox.find(pred);
      if (hit) { inbox.splice(inbox.indexOf(hit), 1); return Promise.resolve(hit); }
      return new Promise((resolve, reject) => {
        const w = { pred, resolve: (m) => { clearTimeout(t); inbox.splice(inbox.indexOf(m), 1); resolve(m); } };
        const t = setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); reject(new Error('timeout waiting for ' + pred.toString())); }, ms);
        waiters.push(w);
      });
    },
    closed: new Promise((r) => ws.addEventListener('close', (e) => r(e.code), { once: true })),
  };
  return c;
}

async function join(port, name) {
  const c = client(port);
  await c.open;
  c.send({ t: 'hello', name, v: 1 });
  const w = await c.wait((m) => m.t === 'welcome');
  c.id = w.id;
  return c;
}

test('two clients see each other, move, trade and fight through the server', async (t) => {
  const srv = createServer({ port: 0 });
  await srv.ready;
  t.after(() => srv.close());
  const a = await join(srv.port, 'Ana');
  const b = await join(srv.port, 'Ben');
  assert.notEqual(a.id, b.id);

  // Each sees the other in snapshots, without private fields.
  const sa = await a.wait((m) => m.t === 'state' && m.others.some((o) => o.id === b.id));
  const other = sa.others.find((o) => o.id === b.id);
  assert.equal(other.name, 'Ben');
  assert.equal(other.cash, undefined);
  assert.equal(sa.you.cash, R.player.startCash);

  // A walks right; B observes A's server-computed position change.
  a.send({ t: 'input', seq: 1, mx: 1, my: 0, aim: 0, sprint: false });
  await b.wait((m) => m.t === 'state' && m.others.some((o) => o.id === a.id && o.x > R.spawn.x + 20));
  a.send({ t: 'input', seq: 2, mx: 0, my: 0, aim: 0, sprint: false });

  // Line them up deterministically for the economy/combat part.
  const pa = srv.world.players.get(a.id), pb = srv.world.players.get(b.id);
  pa.x = 600; pa.y = 600; pb.x = 640; pb.y = 600;

  // Gift: exactly-once even when the client resends the same tx.
  a.send({ t: 'give', to: b.id, cash: 100, tx: 'gift-1' });
  a.send({ t: 'give', to: b.id, cash: 100, tx: 'gift-1' });
  const g1 = await a.wait((m) => m.t === 'result' && m.req === 'give');
  const g2 = await a.wait((m) => m.t === 'result' && m.req === 'give');
  assert.equal(g1.ok, true);
  assert.equal(g2.replay, true);
  await b.wait((m) => m.t === 'event' && m.kind === 'received' && m.cash === 100);
  assert.equal(pa.cash, 650);
  assert.equal(pb.cash, 850);

  // PvP off: shots do nothing. Both opt in: shots land and B is notified.
  a.send({ t: 'fire', aim: 0 });
  const miss = await a.wait((m) => m.t === 'result' && m.req === 'fire');
  assert.equal(miss.blocked, 'pvp off');
  a.send({ t: 'pvp', on: true });
  b.send({ t: 'pvp', on: true });
  await a.wait((m) => m.t === 'result' && m.req === 'pvp');
  await b.wait((m) => m.t === 'result' && m.req === 'pvp');
  await new Promise((r) => setTimeout(r, R.combat.fireIntervalMs + 20)); // respect fire cadence
  for (let i = 0; i < 5; i++) {
    a.send({ t: 'fire', aim: 0 });
    await a.wait((m) => m.t === 'result' && m.req === 'fire' && m.hit === b.id);
    await new Promise((r) => setTimeout(r, R.combat.fireIntervalMs + 20));
  }
  const death = await b.wait((m) => m.t === 'event' && m.kind === 'death');
  assert.equal(death.by, a.id);
  await a.wait((m) => m.t === 'event' && m.kind === 'death');

  // A loots B's bag; it cannot be looted twice.
  a.send({ t: 'pickup', bag: death.bag });
  const loot = await a.wait((m) => m.t === 'result' && m.req === 'pickup');
  assert.equal(loot.ok, true);
  assert.equal(loot.got.cash, 850);
  a.send({ t: 'pickup', bag: death.bag });
  assert.equal((await a.wait((m) => m.t === 'result' && m.req === 'pickup')).reason, 'gone');
  assert.equal(srv.world.totalCash(), 2 * R.player.startCash, 'no money created or destroyed');

  // B respawns at the hospital.
  await b.wait((m) => m.t === 'event' && m.kind === 'respawn', R.hospital.respawnMs + 2000);
  assert.equal(pb.hp, 100);
});

test('cheat attempts: claimed stats ignored, garbage strikes, flood is limited', async (t) => {
  const srv = createServer({ port: 0 });
  await srv.ready;
  t.after(() => srv.close());
  const a = await join(srv.port, 'Cheat');

  // Sending fake state fields does nothing: unknown type is a strike.
  a.send({ t: 'state', you: { cash: 999999 } });
  assert.equal((await a.wait((m) => m.t === 'error')).reason, 'unknown type');
  a.send({ t: 'input', seq: 1, mx: 1, my: 0, aim: 0, sprint: false, cash: 999999, x: 2000 });
  const s = await a.wait((m) => m.t === 'state' && m.you.ack === 1);
  assert.equal(s.you.cash, R.player.startCash);
  assert.ok(s.you.x < 600);

  a.ws.send('not json');
  assert.equal((await a.wait((m) => m.t === 'error')).reason, 'bad json');

  // Flood far past the rate limit: connection gets rate-limited, then closed.
  for (let i = 0; i < 500; i++) a.send({ t: 'reload' });
  const code = await a.closed;
  assert.equal(code, 4003);
});

test('handshake required and protocol version checked', async (t) => {
  const srv = createServer({ port: 0 });
  await srv.ready;
  t.after(() => srv.close());
  const c = client(srv.port);
  await c.open;
  c.send({ t: 'fire', aim: 0 });
  assert.equal((await c.wait((m) => m.t === 'error')).reason, 'say hello first');
  c.send({ t: 'hello', name: 'Old', v: 0 });
  assert.equal(await c.closed, 4002);
  assert.equal(srv.world.players.size, 0);
});

test('disconnect removes the player for everyone', async (t) => {
  const srv = createServer({ port: 0 });
  await srv.ready;
  t.after(() => srv.close());
  const a = await join(srv.port, 'Ana');
  const b = await join(srv.port, 'Ben');
  await a.wait((m) => m.t === 'state' && m.others.some((o) => o.id === b.id));
  b.ws.close();
  await a.wait((m) => m.t === 'state' && m.others.length === 0);
  assert.equal(srv.world.players.size, 1);
});
