'use strict';
// The shared network client against the real server, through a simulated
// laggy connection (default 150 ms each way, like a weak phone signal).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../index.js');
const { createClient } = require('../../shared/net-client.js');
const R = require('../../shared/rules.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// WebSocket stand-in that delays traffic in both directions.
function laggy(oneWayMs) {
  return class LaggyWS {
    constructor(url) {
      this.real = new WebSocket(url);
      this.readyState = 0;
      this.real.addEventListener('open', () => setTimeout(() => { this.readyState = 1; this.onopen?.(); }, oneWayMs));
      this.real.addEventListener('message', (e) => setTimeout(() => this.onmessage?.({ data: e.data }), oneWayMs));
      this.real.addEventListener('close', (e) => setTimeout(() => { this.readyState = 3; this.onclose?.({ code: e.code }); }, oneWayMs));
    }
    send(d) { setTimeout(() => { if (this.real.readyState === 1) this.real.send(d); }, oneWayMs); }
    close(c, r) { this.real.close(c, r); }
  };
}

// Runs a client "game loop" at ~60 fps; returns a stop function.
function loop(client, each) {
  let last = performance.now();
  const h = setInterval(() => { const t = performance.now(); const v = client.update(t - last); last = t; each?.(v); }, 16);
  return () => clearInterval(h);
}

async function setup(t, lagMs = 150) {
  const srv = createServer({ port: 0 });
  await srv.ready;
  const url = `ws://127.0.0.1:${srv.port}`;
  const clients = [];
  const make = (name, extra = {}) => {
    let welcome;
    const c = createClient({ url, name, WebSocket: laggy(lagMs), onWelcome: (w) => { welcome = w; }, ...extra });
    c.welcomed = async () => { for (let i = 0; i < 200 && !welcome; i++) await sleep(10); assert.ok(welcome, 'welcomed'); return welcome; };
    clients.push(c);
    return c;
  };
  t.after(async () => { for (const c of clients) c.close(); await srv.close(); });
  return { srv, make };
}

test('prediction: your player moves instantly even with 150 ms lag, then agrees with the server', async (t) => {
  const { srv, make } = await setup(t);
  const c = make('Ana');
  const w = await c.welcomed();
  const p = srv.world.players.get(w.id);
  p.x = 700; p.y = 340; // open street
  await sleep(500);     // let state settle through the lag
  let view = c.update(16);
  const start = { x: view.me.x, y: view.me.y };
  assert.ok(dist(start, p) < 1, 'synced before moving');

  c.setInput({ mx: 1, my: 0, aim: 0, sprint: false });
  const stop = loop(c, (v) => { view = v; });
  await sleep(120); // less than one round trip
  assert.ok(view.me.x - start.x > 10, `predicted move is immediate (${(view.me.x - start.x).toFixed(1)}px)`);
  assert.ok(Math.abs(p.x - start.x) < 1, 'server has not even seen the input yet');

  await sleep(900);
  c.setInput({ mx: 0, my: 0, aim: 0, sprint: false });
  await sleep(800);
  stop();
  const err = dist({ x: view.me.x, y: view.me.y }, p);
  assert.ok(err < 3, `after stopping, prediction matches server within 3px (was ${err.toFixed(2)})`);
  assert.ok(p.x - start.x > 150, 'server really moved the player');
});

test('prediction never walks through buildings and settles at the server wall stop', async (t) => {
  const { srv, make } = await setup(t);
  const c = make('Wally');
  const w = await c.welcomed();
  const p = srv.world.players.get(w.id);
  p.x = 700; p.y = 340;
  await sleep(500);
  let view; const city = srv.world.city;
  let inside = 0;
  c.setInput({ mx: 0, my: 1, aim: 0, sprint: true }); // building directly south
  const stop = loop(c, (v) => { view = v; if (city.blocked(v.me.x, v.me.y)) inside++; });
  await sleep(1200);
  c.setInput({ mx: 0, my: 0, aim: 0, sprint: false });
  await sleep(700);
  stop();
  assert.equal(inside, 0, 'predicted position never inside a building');
  assert.ok(dist(view.me, p) < 3, `matches server at the wall (${dist(view.me, p).toFixed(2)}px)`);
});

test('server overrides (respawn/teleport) snap the prediction', async (t) => {
  const { srv, make } = await setup(t);
  const c = make('Jumpy');
  const w = await c.welcomed();
  const p = srv.world.players.get(w.id);
  let view;
  const stop = loop(c, (v) => { view = v; });
  await sleep(400);
  p.x = 1500; p.y = 340;
  await sleep(500);
  stop();
  assert.ok(dist(view.me, p) < 1, 'snapped to the server position');
});

test('other players are smoothly interpolated, not jumping per server tick', async (t) => {
  const { srv, make } = await setup(t, 60);
  const a = make('Watcher');
  const b = make('Runner');
  const wa = await a.welcomed(); const wb = await b.welcomed();
  const pa = srv.world.players.get(wa.id), pb = srv.world.players.get(wb.id);
  pa.x = 700; pa.y = 340; pb.x = 800; pb.y = 340;
  await sleep(400);
  const xs = [];
  b.setInput({ mx: 1, my: 0, aim: 0, sprint: false });
  const stopB = loop(b);
  const stopA = loop(a, (v) => { const r = v.others.find((o) => o.id === wb.id); if (r) xs.push(r.x); });
  await sleep(1200);
  stopA(); stopB();
  const steps = xs.slice(1).map((x, i) => x - xs[i]).filter((d) => d > 0);
  const biggest = Math.max(...steps);
  // A 180 px/s walker moves 9 px per 50 ms server tick; smoothing keeps per-frame steps small.
  assert.ok(steps.length > 30, 'many distinct rendered positions');
  assert.ok(biggest < 7, `largest per-frame jump ${biggest.toFixed(2)}px (raw ticks would be ~9px)`);
  assert.ok(xs.every((x, i) => i === 0 || x >= xs[i - 1] - 0.01), 'never moves backwards');
});

test('auto-reconnect resumes the same character after a dropped connection', async (t) => {
  const { srv, make } = await setup(t, 20);
  const statuses = [];
  const c = make('Dropper', { onStatus: (s) => statuses.push(s) });
  const w = await c.welcomed();
  srv.world.players.get(w.id).cash = 1234;
  const token = c.token;
  // Kill the socket from the server side, like a phone losing signal.
  const before = c.id;
  for (const ws of srvClients(srv)) ws.terminate();
  for (let i = 0; i < 300 && (c.status !== 'online' || c.id === before); i++) await sleep(10);
  assert.equal(c.status, 'online');
  assert.notEqual(c.id, before, 'new session');
  assert.equal(c.token, token, 'same character token');
  await sleep(150);
  assert.equal(c.update(16).me.cash, 1234, 'character restored');
  assert.ok(statuses.includes('offline'));
});

test('actions: fire is throttled locally, money actions carry tx ids, offline sends are refused', async (t) => {
  const { make } = await setup(t, 20);
  const c = make('Doer');
  await c.welcomed();
  assert.equal(c.fire(0), true);
  assert.equal(c.fire(0), false, 'local cadence guard');
  const x = c.buy('ammo');
  assert.match(x, /^[A-Za-z0-9_-]{1,40}$/);
  c.close();
  assert.equal(c.buy('ammo'), null, 'no send when closed');
  assert.equal(c.status, 'closed');
});

// The test server object doesn't expose sockets publicly; reach the ws-lite set.
function srvClients(srv) {
  return [...srv._wss.clients];
}
