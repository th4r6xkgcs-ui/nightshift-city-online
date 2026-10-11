'use strict';
// Public-server protections: ghost cleanup, connection limits, origin allowlist.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { createServer } = require('../index.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Raw upgrade attempt: resolves with the HTTP status (101 = accepted) and the socket.
function rawUpgrade(port, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port, path: '/', headers: {
        Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), ...headers,
      },
    });
    req.on('upgrade', (res, socket) => resolve({ status: 101, socket }));
    req.on('response', (res) => { res.resume(); resolve({ status: res.statusCode }); });
    req.on('error', reject);
    req.end();
  });
}

// A masked client text frame, for talking over a raw socket.
function frame(obj) {
  const data = Buffer.from(JSON.stringify(obj));
  const mask = crypto.randomBytes(4);
  const head = data.length < 126 ? Buffer.from([0x81, 0x80 | data.length]) : Buffer.from([0x81, 0x80 | 126, data.length >> 8, data.length & 255]);
  const body = Buffer.from(data);
  for (let i = 0; i < body.length; i++) body[i] ^= mask[i & 3];
  return Buffer.concat([head, mask, body]);
}

test('a phone that vanishes without closing is removed (no ghost players)', async (t) => {
  const srv = createServer({ port: 0, pingEveryMs: 100, idleTimeoutMs: 400 });
  await srv.ready;
  t.after(() => srv.close());
  const { status, socket } = await rawUpgrade(srv.port);
  assert.equal(status, 101);
  socket.write(frame({ t: 'hello', name: 'Ghost', v: 1 }));
  await sleep(150);
  assert.equal(srv.world.players.size, 1);
  socket.pause(); // stop reading and never answer pings, like a dead radio
  await sleep(900);
  assert.equal(srv.world.players.size, 0, 'ghost reaped');
  socket.destroy();
});

test('a quiet but healthy client stays connected (browser answers pings)', async (t) => {
  const srv = createServer({ port: 0, pingEveryMs: 100, idleTimeoutMs: 400 });
  await srv.ready;
  t.after(() => srv.close());
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}`);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.send(JSON.stringify({ t: 'hello', name: 'Quiet', v: 1 }));
  await sleep(1000); // sends nothing more; only automatic pongs
  assert.equal(srv.world.players.size, 1);
  assert.equal(ws.readyState, 1);
  ws.close();
});

test('per-IP and total connection limits refuse before the handshake', async (t) => {
  const srv = createServer({ port: 0, maxPerIp: 2, maxConnections: 3 });
  await srv.ready;
  t.after(() => srv.close());
  const a = await rawUpgrade(srv.port);
  const b = await rawUpgrade(srv.port);
  assert.deepEqual([a.status, b.status], [101, 101]);
  assert.equal((await rawUpgrade(srv.port)).status, 429, 'third from the same IP refused');
  a.socket.destroy();
  await sleep(50);
  assert.equal((await rawUpgrade(srv.port)).status, 101, 'slot frees when one leaves');
});

test('server-wide cap returns 503', async (t) => {
  const srv = createServer({ port: 0, maxConnections: 1, maxPerIp: 10 });
  await srv.ready;
  t.after(() => srv.close());
  assert.equal((await rawUpgrade(srv.port)).status, 101);
  assert.equal((await rawUpgrade(srv.port)).status, 503);
});

test('origin allowlist: only the game site may connect when configured', async (t) => {
  const srv = createServer({ port: 0, allowedOrigins: ['https://game.example'] });
  await srv.ready;
  t.after(() => srv.close());
  assert.equal((await rawUpgrade(srv.port, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await rawUpgrade(srv.port)).status, 403, 'missing origin refused when allowlist is set');
  const ok = await rawUpgrade(srv.port, { Origin: 'https://game.example' });
  assert.equal(ok.status, 101);
  ok.socket.destroy();
});

test('behind a proxy, limits apply to the forwarded client IP', async (t) => {
  const srv = createServer({ port: 0, maxPerIp: 1, trustProxy: true });
  await srv.ready;
  t.after(() => srv.close());
  const a = await rawUpgrade(srv.port, { 'X-Forwarded-For': '203.0.113.5' });
  const b = await rawUpgrade(srv.port, { 'X-Forwarded-For': '203.0.113.6, 10.0.0.1' });
  assert.deepEqual([a.status, b.status], [101, 101], 'different real clients both allowed');
  assert.equal((await rawUpgrade(srv.port, { 'X-Forwarded-For': '203.0.113.5' })).status, 429);
});
