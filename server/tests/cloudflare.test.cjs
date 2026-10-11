'use strict';
// The Cloudflare host (worker/) under a fake Workers runtime: WebSocketPair,
// Response with webSocket, Durable Object storage. Real players are the
// shared net-client. When esbuild is available, the BUNDLED Worker (what
// Cloudflare deploys) is exercised too.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const os = require('node:os');
const { createClient } = require('../../shared/net-client.js');

const ROOT = path.join(__dirname, '..', '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- fake Workers runtime ----------
class FakeEnd {
  constructor() { this.l = { message: [], close: [], error: [] }; this.peer = null; this.readyState = 1; }
  accept() {}
  addEventListener(t, fn) { this.l[t].push(fn); }
  _emit(t, e) { for (const fn of this.l[t]) fn(e); }
  send(data) {
    if (this.readyState !== 1) throw new Error('closed');
    const p = this.peer; setTimeout(() => { if (p.readyState === 1) p._emit('message', { data: String(data) }); }, 1);
  }
  close(code = 1000, reason = '') {
    if (this.readyState === 3) return;
    this.readyState = 3;
    const p = this.peer; setTimeout(() => { if (p.readyState !== 3) { p.readyState = 3; p._emit('close', { code, reason }); } }, 1);
  }
}
class FakePair { constructor() { const a = new FakeEnd(), b = new FakeEnd(); a.peer = b; b.peer = a; this[0] = a; this[1] = b; } }
class FakeResponse {
  constructor(body, init = {}) { this.body = body; this.status = init.status || 200; this.webSocket = init.webSocket || null; this.headers = new Map(Object.entries(init.headers || {})); }
  async text() { return this.body == null ? '' : String(this.body); }
}
class FakeStorage {
  constructor() { this.m = new Map(); this.puts = 0; }
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.puts++; this.m.set(k, structuredClone(v)); }
}
class FakeDurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }
const req = (url, headers = {}) => ({ url, method: 'GET', headers: new Headers(headers) });

// A runtime: env.GAME namespace holding one GameRoom per name.
const allObjects = [];
test.after(() => { for (const o of allObjects) if (o.timers) { o.timers.forEach(clearInterval); o.timers = null; } });
function runtime(GameRoomClass, storage = new FakeStorage(), vars = {}) {
  const objects = new Map();
  const env = {
    ...vars,
    GAME: {
      idFromName: (n) => n,
      get: (id) => {
        if (!objects.has(id)) { const o = new GameRoomClass({ storage }, env); objects.set(id, o); allObjects.push(o); }
        return objects.get(id);
      },
    },
  };
  return { env, storage, objects };
}

// Browser-like WebSocket for net-client that dials through the Worker.
function dialer(fetchFn, ip = '198.51.100.7') {
  return class WorkerWS {
    constructor(url) {
      this.readyState = 0;
      Promise.resolve(fetchFn(req(url.replace(/^ws/, 'http'), { Upgrade: 'websocket', 'CF-Connecting-IP': ip }))).then((res) => {
        if (res.status !== 101) { this.readyState = 3; return this.onclose?.({ code: 1006 }); }
        const end = this.end = res.webSocket;
        end.addEventListener('message', (e) => this.onmessage?.({ data: e.data }));
        end.addEventListener('close', (e) => { this.readyState = 3; this.onclose?.({ code: e.code }); });
        this.readyState = 1;
        this.onopen?.();
      });
    }
    send(d) { this.end.send(d); }
    close(c, r) { this.readyState = 3; this.end?.close(c, r); }
  };
}

function loop(c) { let last = performance.now(); const h = setInterval(() => { const t = performance.now(); c.update(t - last); last = t; }, 16); return () => clearInterval(h); }

async function scenario(t, { GameRoom, fetchFn, label }) {
  const storage = new FakeStorage();
  const rt = runtime(GameRoom, storage);
  const doFetch = (r) => fetchFn(r, rt.env);
  const join = async (name, token) => {
    let w; const c = createClient({ url: 'wss://game.test/', name, token, WebSocket: dialer(doFetch), onWelcome: (x) => { w = x; } });
    for (let i = 0; i < 200 && !w; i++) await sleep(5);
    assert.ok(w, `${label}: ${name} welcomed`);
    c.w = w; return c;
  };
  const a = await join('Ana'); const b = await join('Ben');
  const stops = [loop(a), loop(b)];
  t.after(() => { stops.forEach((s) => s()); a.close(); b.close(); });
  await sleep(200);
  assert.equal(a.update(0).others.length, 1, `${label}: players see each other`);

  const room = rt.objects.get('city-1');
  const pa = room.room.world.players.get(a.w.id);
  pa.x = 700; pa.y = 340;
  a.setInput({ mx: 1, my: 0, aim: 0, sprint: false });
  await sleep(500);
  a.setInput({ mx: 0, my: 0, aim: 0, sprint: false });
  await sleep(300);
  assert.ok(pa.x > 760, `${label}: server moved the player (${pa.x.toFixed(0)})`);
  const seen = b.update(0).others.find((o) => o.id === a.w.id);
  assert.ok(Math.abs(seen.x - pa.x) < 3, `${label}: other player sees the move`);

  // Save/restore through Durable Object storage, including a "restart".
  pa.cash = 4321;
  const token = a.token;
  a.close();
  await sleep(100);
  assert.ok(storage.puts > 0, `${label}: profile written to Durable Object storage`);
  for (const k of storage.m.keys()) assert.ok(!k.includes(token), 'raw token never stored');
  const rt2 = runtime(GameRoom, storage); // new object instance, same storage
  let w2; const a2 = createClient({ url: 'wss://game.test/', name: 'Ana', token, WebSocket: dialer((r) => fetchFn(r, rt2.env)), onWelcome: (x) => { w2 = x; } });
  for (let i = 0; i < 200 && !w2; i++) await sleep(5);
  assert.equal(w2.resumed, true, `${label}: character resumed after restart`);
  assert.equal(w2.you.cash, 4321);
  a2.close();
}

function loadSource() {
  const gr = require('../../worker/src/game-room.js');
  return {
    GameRoom: gr.createGameRoomClass(FakeDurableObject, { WebSocketPairImpl: FakePair, ResponseImpl: FakeResponse }),
    fetchFn: (r, env) => gr.handleHttp(r, env, { '/': { type: 'text/html', body: '<p>page</p>' } }, FakeResponse),
    gr,
  };
}

test('Cloudflare host (source): two players, movement, saves survive an object restart', async (t) => {
  await scenario(t, { ...loadSource(), label: 'source' });
});

test('Cloudflare host: limits, origin lock, health and static routes', async () => {
  const { gr } = loadSource();
  const GameRoom = gr.createGameRoomClass(FakeDurableObject, { WebSocketPairImpl: FakePair, ResponseImpl: FakeResponse });
  const rt = runtime(GameRoom, new FakeStorage(), { MAX_PER_IP: '1', ALLOWED_ORIGINS: 'https://game.test' });
  const up = (h) => gr.handleHttp(req('https://game.test/', { Upgrade: 'websocket', ...h }), rt.env, {}, FakeResponse);
  assert.equal((await up({ Origin: 'https://evil.test', 'CF-Connecting-IP': '1.1.1.1' })).status, 403);
  assert.equal((await up({ Origin: 'https://game.test', 'CF-Connecting-IP': '1.1.1.1' })).status, 101);
  assert.equal((await up({ Origin: 'https://game.test', 'CF-Connecting-IP': '1.1.1.1' })).status, 429);
  assert.equal((await up({ Origin: 'https://game.test', 'CF-Connecting-IP': '2.2.2.2' })).status, 101);
  const files = { '/': { type: 'text/html', body: 'hi' } };
  assert.equal((await gr.handleHttp(req('https://game.test/healthz'), rt.env, files, FakeResponse)).status, 200);
  assert.equal((await gr.handleHttp(req('https://game.test/'), rt.env, files, FakeResponse)).status, 200);
  assert.equal((await gr.handleHttp(req('https://game.test/../server/sim.js'), rt.env, files, FakeResponse)).status, 404);
  assert.equal((await gr.handleHttp(req('https://game.test/server/store.js'), rt.env, files, FakeResponse)).status, 404);
});

test('Durable Object store skips rewriting unchanged profiles (free plan row writes)', async () => {
  const { DurableStore } = loadSource().gr;
  const s = new FakeStorage(); const ds = new DurableStore(s);
  const tok = 'c'.repeat(32);
  await ds.save(tok, { cash: 1 }); await ds.save(tok, { cash: 1 }); await ds.save(tok, { cash: 2 });
  assert.equal(s.puts, 2);
  assert.deepEqual(await ds.load(tok), { cash: 2 });
  assert.equal(await ds.load('d'.repeat(32)), null);
});

test('build step packs the page and shared scripts for the Worker', () => {
  const out = path.join(ROOT, 'worker', 'src', 'static.gen.js');
  cp.execFileSync(process.execPath, [path.join(ROOT, 'worker', 'build.cjs')], { stdio: 'pipe' });
  const src = fs.readFileSync(out, 'utf8');
  for (const route of ['"/"', '"/shared/net-client.js"', '"/shared/movement.js"']) assert.ok(src.includes(route), route);
  assert.match(src, /export const CITY_LAYOUT = /);
});

const esbuild = ['/opt/npm-tools/node_modules/.bin/esbuild', path.join(ROOT, 'node_modules/.bin/esbuild')].find((p) => fs.existsSync(p));
test('BUNDLED Worker (as Cloudflare deploys it) runs the same scenario', { skip: !esbuild && 'esbuild not available' }, async (t) => {
  cp.execFileSync(process.execPath, [path.join(ROOT, 'worker', 'build.cjs')], { stdio: 'pipe' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsco-worker-'));
  const fake = path.join(dir, 'cloudflare-workers.mjs');
  fs.writeFileSync(fake, 'export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }\n');
  const outfile = path.join(dir, 'worker.mjs');
  cp.execFileSync(esbuild, [path.join(ROOT, 'worker/src/index.js'), '--bundle', '--format=esm', '--target=es2022',
    '--conditions=workerd,worker,browser', `--alias:cloudflare:workers=${fake}`, `--outfile=${outfile}`, '--log-level=error'], { stdio: 'pipe' });
  globalThis.WebSocketPair = FakePair;
  const realResponse = globalThis.Response;
  globalThis.Response = FakeResponse;
  t.after(() => { globalThis.Response = realResponse; delete globalThis.WebSocketPair; fs.rmSync(dir, { recursive: true, force: true }); });
  const mod = await import(outfile);
  assert.equal(typeof mod.GameRoom, 'function', 'exports the Durable Object class');
  const page = await mod.default.fetch(req('https://game.test/'), {});
  assert.match(await page.text(), /Nightshift Online/, 'serves the real test page');
  await scenario(t, { GameRoom: mod.GameRoom, fetchFn: (r, env) => mod.default.fetch(r, env), label: 'bundle' });
});
