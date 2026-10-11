'use strict';
// Cloudflare host for Nightshift City Online.
// One Durable Object = one shared city. It runs the SAME Room/World code as
// the Node server; only sockets, timers and storage are Cloudflare-specific.
// Written as CommonJS factories so Node tests can drive it with fakes.

const { Room } = require('../../server/room.js');
const { World } = require('../../server/sim.js');
const { createCity, builtInLayout } = require('../../shared/city.js');
const RULES = require('../../shared/rules.js');
const { handleAdmin } = require('../../server/admin.js');

// Profiles in Durable Object storage (SQLite-backed, free plan).
// Keys are SHA-256 hashes of resume tokens, never the tokens themselves.
// Unchanged profiles are not rewritten (free plan counts rows written).
class DurableStore {
  constructor(storage) { this.storage = storage; this.lastJson = new Map(); }
  async key(token) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return 'p:' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  async load(token) {
    const k = await this.key(token);
    const v = await this.storage.get(k);
    if (v) this.lastJson.set(k, JSON.stringify(v));
    return v ?? null;
  }
  async save(token, profile) {
    const k = await this.key(token), json = JSON.stringify(profile);
    if (this.lastJson.get(k) === json) return;
    this.lastJson.set(k, json);
    await this.storage.put(k, profile);
  }
  async flush() {}
}

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

function createGameRoomClass(Base, { cityLayout = null, WebSocketPairImpl, ResponseImpl } = {}) {
  return class GameRoom extends Base {
    constructor(ctx, env) {
      super(ctx, env);
      this.ctx = ctx;
      this.env = env || {};
      const city = createCity(cityLayout || builtInLayout());
      this.room = new Room({ world: new World({ city }), store: new DurableStore(ctx.storage) });
      this.sockets = new Set();
      this.perIp = new Map();
      this.timers = null;
    }

    _limits() {
      const e = this.env;
      return {
        maxConnections: num(e.MAX_CONNECTIONS, 200),
        maxPerIp: num(e.MAX_PER_IP, 8),
        origins: e.ALLOWED_ORIGINS ? String(e.ALLOWED_ORIGINS).split(',').map((s) => s.trim()).filter(Boolean) : null,
      };
    }

    _start() {
      if (this.timers) return;
      this.timers = [
        setInterval(() => this.room.tick(), 1000 / RULES.net.tickHz),
        // No server pings on Workers: clients send input/keep-alive at least every
        // 250 ms, so 30 s of silence means the phone is gone.
        setInterval(() => this.room.reap(30000), 10000),
        setInterval(() => { this.room.saveAll(); }, 10000),
      ];
    }

    _stopIfEmpty() {
      if (this.sockets.size || !this.timers) return;
      for (const t of this.timers) clearInterval(t);
      this.timers = null; // let the object go idle; nothing is billed while empty
    }

    async fetch(request) {
      const Resp = ResponseImpl || globalThis.Response;
      const Pair = WebSocketPairImpl || globalThis.WebSocketPair;
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
        const url = new URL(request.url);
        const out = await handleAdmin({
          method: request.method, path: url.pathname, authorization: request.headers.get('Authorization'),
          bodyText: request.method === 'POST' ? (await request.text()).slice(0, 4096) : '',
        }, this.room, this.env.ADMIN_KEY);
        if (!out) return new Resp('expected websocket', { status: 426 });
        return new Resp(JSON.stringify(out.body), { status: out.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
      }
      const L = this._limits();
      if (L.origins && !L.origins.includes(request.headers.get('Origin'))) return new Resp('forbidden', { status: 403 });
      if (this.sockets.size >= L.maxConnections) return new Resp('server full', { status: 503 });
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if ((this.perIp.get(ip) || 0) >= L.maxPerIp) return new Resp('too many connections', { status: 429 });

      const pair = new Pair();
      const [client, server] = Object.values(pair);
      server.accept();
      const conn = {
        ip, lastSeen: Date.now(),
        send: (t) => server.send(t),
        close: (code, reason) => { try { server.close(code, reason); } catch { /* already closed */ } },
      };
      this.sockets.add(conn);
      this.perIp.set(ip, (this.perIp.get(ip) || 0) + 1);
      this.room.open(conn);
      this._start();

      let gone = false;
      const done = () => {
        if (gone) return;
        gone = true;
        this.sockets.delete(conn);
        const n = (this.perIp.get(ip) || 1) - 1;
        if (n) this.perIp.set(ip, n); else this.perIp.delete(ip);
        const saving = this.room.close(conn);
        this._stopIfEmpty();
        return saving;
      };
      server.addEventListener('message', (e) => {
        conn.lastSeen = Date.now();
        this.room.message(conn, typeof e.data === 'string' ? e.data : null);
      });
      server.addEventListener('close', () => { conn.close(1000, 'bye'); done(); });
      server.addEventListener('error', () => done());
      return new Resp(null, { status: 101, webSocket: client });
    }
  };
}

// Front door Worker: static page + shared scripts, health check, and
// WebSocket upgrades routed to the single city Durable Object.
async function handleHttp(request, env, files, ResponseImpl) {
  const Resp = ResponseImpl || globalThis.Response;
  const url = new URL(request.url);
  if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket' || url.pathname === '/admin' || url.pathname === '/stats') {
    const stub = env.GAME.get(env.GAME.idFromName('city-1'));
    return stub.fetch(request);
  }
  const headers = { 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' };
  if (url.pathname === '/healthz') return new Resp('ok\n', { headers: { ...headers, 'content-type': 'text/plain' } });
  const f = request.method === 'GET' || request.method === 'HEAD' ? files[url.pathname] : null;
  if (!f) return new Resp('not found\n', { status: 404, headers: { ...headers, 'content-type': 'text/plain' } });
  return new Resp(request.method === 'HEAD' ? null : f.body, { headers: { ...headers, 'content-type': f.type } });
}

module.exports = { createGameRoomClass, handleHttp, DurableStore };
