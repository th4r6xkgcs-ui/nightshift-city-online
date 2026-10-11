'use strict';
// Moderation: /stats, and /admin (list, kick, ban, unban-ip, announce) on the Node host.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../index.js');
const { createClient } = require('../../shared/net-client.js');
const { sameKey } = require('../admin.js');

const KEY = 'test-admin-key-0123456789';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(t, opts = {}) {
  const srv = createServer({ port: 0, adminKey: KEY, ...opts });
  await srv.ready;
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.port}`;
  const admin = async (body, key = KEY) => {
    const r = await fetch(base + '/admin', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  const join = async (name, token) => {
    const s = { statuses: [], chats: [], errors: [] };
    s.c = createClient({ url: `ws://127.0.0.1:${srv.port}`, name, token, reconnect: true,
      onWelcome: (w) => { s.w = w; }, onStatus: (x) => s.statuses.push(x), onChat: (m) => s.chats.push(m), onError: (e) => s.errors.push(e.reason) });
    for (let i = 0; i < 200 && !s.w; i++) await sleep(5);
    t.after(() => s.c.close());
    return s;
  };
  return { srv, base, admin, join };
}

test('stats are public; admin needs the right key and POST', async (t) => {
  const { base, admin, join } = await boot(t);
  await join('Ana');
  const st = await (await fetch(base + '/stats')).json();
  assert.equal(st.players, 1);
  assert.ok(st.uptimeSec >= 0);
  assert.equal((await admin({ action: 'list' }, 'wrong-key-wrong-key')).status, 401);
  assert.equal((await fetch(base + '/admin')).status, 405);
  const list = await admin({ action: 'list' });
  assert.equal(list.status, 200);
  assert.equal(list.body.players[0].name, 'Ana');
});

test('admin is disabled entirely without a key (or with a short one)', async (t) => {
  for (const adminKey of [null, 'short']) {
    const { base } = await boot(t, { adminKey });
    const r = await fetch(base + '/admin', { method: 'POST', headers: { Authorization: 'Bearer short' }, body: '{}' });
    assert.equal(r.status, 404);
  }
});

test('kick disconnects without auto-reconnect', async (t) => {
  const { srv, admin, join } = await boot(t);
  const a = await join('Rowdy');
  const r = await admin({ action: 'kick', name: 'rowdy' });
  assert.equal(r.body.ok, true);
  await sleep(700);
  assert.equal(a.c.status, 'kicked');
  assert.equal(srv.world.players.size, 0, 'not reconnected');
});

test('ban: character refused on return, IP refused for a while, unban-ip lifts it', async (t) => {
  const { srv, admin, join } = await boot(t, { maxPerIp: 50 });
  const a = await join('Griefer');
  const token = a.c.token;
  assert.equal((await admin({ action: 'ban', id: a.w.id, hours: 2 })).body.ok, true);
  await sleep(300);
  assert.equal(a.c.status, 'banned');
  const again = await join('Griefer', token);
  await sleep(200);
  assert.equal(again.w, undefined, 'banned character not welcomed');
  assert.equal(again.c.status, 'banned');
  const fresh = await join('NewName'); // same IP, new character: IP ban applies
  await sleep(200);
  assert.equal(fresh.w, undefined);
  assert.equal((await admin({ action: 'unban-ip', ip: '127.0.0.1' })).body.ok, true);
  const ok = await join('Reformed');
  assert.ok(ok.w, 'IP unbanned: new character can join');
  const still = await join('Griefer', token);
  await sleep(200);
  assert.equal(still.w, undefined, 'the banned character itself stays banned');
  assert.equal(srv.world.players.size, 1);
});

test('announce reaches everyone as SERVER and is cleaned', async (t) => {
  const { admin, join } = await boot(t);
  const a = await join('Ana'); const b = await join('Ben');
  const r = await admin({ action: 'announce', text: 'Restart in 5 min https://x.example' });
  assert.equal(r.body.sent, 2);
  await sleep(150);
  for (const s of [a, b]) assert.deepEqual(s.chats.at(-1), { t: 'chat', from: 'server', name: 'SERVER', ch: 'city', text: 'Restart in 5 min [link]' });
  assert.equal((await admin({ action: 'nuke' })).body.reason, 'unknown action');
});

test('constant-time key compare', () => {
  assert.equal(sameKey('abc', 'abc'), true);
  assert.equal(sameKey('abc', 'abd'), false);
  assert.equal(sameKey('abc', 'abcd'), false);
  assert.equal(sameKey('', ''), true);
  assert.equal(sameKey('', 'x'), false);
});
