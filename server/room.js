'use strict';
// One game room, independent of how sockets are provided. The Node server
// (index.js + ws-lite.js) and the Cloudflare Durable Object (worker/) both
// drive this same class, so online rules can't drift between hosts.
//
// A "conn" is any object with: send(text), close(code, reason),
// terminate() (optional), ip (string), lastSeen (ms, set by the transport).
//
// Store: { load(token) -> profile|null (may return a Promise),
//          save(token, profile), flush() } (save/flush may be async).

const RULES = require('../shared/rules.js');
const { VERSION, C, S, validate } = require('../shared/protocol.js');
const { World } = require('./sim.js');

const isToken = (t) => typeof t === 'string' && /^[a-f0-9]{32}$/.test(t);
function newToken() {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
const newId = () => globalThis.crypto.randomUUID().slice(0, 8);

class Room {
  constructor({ world = new World(), store, clock = Date.now, helloTimeoutMs = 5000 } = {}) {
    if (!store) throw new Error('store required');
    this.world = world;
    this.store = store;
    this.clock = clock;
    this.helloTimeoutMs = helloTimeoutMs;
    this.conns = new Map();   // playerId -> conn
    this.tokens = new Map();  // playerId -> token
    this.online = new Map();  // token -> playerId (one session per character)
    this.state = new Map();   // conn -> per-connection state
    this.ipBans = new Map();  // ip -> banned-until ms (temporary, in memory)
    this.startedAt = clock();
    this.last = clock();
  }

  get playerCount() { return this.conns.size; }

  _send(conn, msg) { try { conn.send(JSON.stringify(msg)); } catch { /* socket already gone */ } }

  open(conn) {
    const N = RULES.net;
    if ((this.ipBans.get(conn.ip) || 0) > this.clock()) {
      this._send(conn, { t: S.ERROR, reason: 'banned' });
      return conn.close(4005, 'banned');
    }
    const st = { id: null, strikes: 0, bucket: N.maxMsgsPerSec, bucketAt: this.clock(), helloing: false, queue: [] };
    st.helloTimer = setTimeout(() => { if (!st.id) conn.close(4001, 'hello timeout'); }, this.helloTimeoutMs);
    this.state.set(conn, st);
  }

  _strike(conn, st, reason) {
    this._send(conn, { t: S.ERROR, reason });
    if (++st.strikes >= RULES.net.maxStrikes) conn.close(4003, 'too many bad messages');
  }

  persist(pid) {
    const t = this.tokens.get(pid), prof = this.world.exportProfile(pid);
    if (t && prof) return this.store.save(t, prof);
  }

  // Returns a promise only while a hello is being resolved (store lookup).
  message(conn, text) {
    const st = this.state.get(conn);
    if (!st) return;
    const N = RULES.net, now = this.clock();
    st.bucket = Math.min(N.maxMsgsPerSec, st.bucket + ((now - st.bucketAt) / 1000) * N.maxMsgsPerSec);
    st.bucketAt = now;
    if (st.bucket < 1) return this._strike(conn, st, 'rate limited');
    st.bucket -= 1;
    if (typeof text !== 'string') return this._strike(conn, st, 'binary not supported');
    if (text.length > N.maxMsgBytes) return this._strike(conn, st, 'too big');

    let msg;
    try { msg = JSON.parse(text); } catch { return this._strike(conn, st, 'bad json'); }

    if (st.helloing) { st.queue.push(msg); return; } // keep order while the profile loads
    if (!st.id) return this._hello(conn, st, msg);
    return this._game(conn, st, msg);
  }

  async _hello(conn, st, msg) {
    if (msg?.t !== C.HELLO) return this._strike(conn, st, 'say hello first');
    const bad = validate(msg);
    if (bad) { this._send(conn, { t: S.ERROR, reason: bad }); return conn.close(4002, bad); }
    st.helloing = true;
    let token = isToken(msg.token) ? msg.token : null;
    let saved = null;
    try { saved = token ? await this.store.load(token) : null; } catch { saved = null; }
    if (!this.state.has(conn)) return; // closed while loading
    if (saved && saved.banned) {
      st.helloing = false;
      this._send(conn, { t: S.ERROR, reason: 'banned' });
      return conn.close(4005, 'banned');
    }
    if (!saved) token = newToken();

    const prior = this.online.get(token);
    if (prior) { // same character signed in again: newest session wins
      await this.persist(prior);
      const old = this.conns.get(prior);
      this._drop(prior);
      if (old) old.close(4004, 'signed in elsewhere');
    }
    const id = newId();
    clearTimeout(st.helloTimer);
    const p = this.world.addPlayer(id, msg.name, this.clock(), saved, { presence: msg.mode === 'presence' });
    st.id = id;
    this.conns.set(id, conn);
    this.tokens.set(id, token);
    this.online.set(token, id);
    await this.persist(id);
    this._send(conn, { t: S.WELCOME, id, v: VERSION, rules: RULES, you: this.world.privateView(p), token, resumed: !!saved });
    st.helloing = false;
    const queued = st.queue; st.queue = [];
    for (const m of queued) this._game(conn, st, m);
  }

  _game(conn, st, msg) {
    if (msg?.t === C.HELLO) return this._strike(conn, st, 'already joined');
    if (msg?.t === C.PING) {
      const bad = validate(msg);
      return bad ? this._strike(conn, st, bad) : this._send(conn, { t: S.PONG, at: msg.at, now: this.clock() });
    }
    const result = this.world.handle(st.id, msg, this.clock());
    if (result.strike) return this._strike(conn, st, result.reason);
    if (!result.quiet) this._send(conn, { t: S.RESULT, req: msg.t, ...result });
    this.flush();
  }

  _drop(pid) {
    const t = this.tokens.get(pid);
    if (t && this.online.get(t) === pid) this.online.delete(t);
    this.world.removePlayer(pid);
    this.conns.delete(pid);
    this.tokens.delete(pid);
  }

  close(conn) {
    const st = this.state.get(conn);
    if (!st) return;
    clearTimeout(st.helloTimer);
    this.state.delete(conn);
    if (st.id && this.conns.get(st.id) === conn) {
      const p = this.persist(st.id);
      this._drop(st.id);
      return p;
    }
  }

  flush() {
    for (const { to, msg } of this.world.drain()) {
      const conn = this.conns.get(to);
      if (conn) this._send(conn, msg);
    }
  }

  tick() {
    const now = this.clock();
    this.world.step(now - this.last, now);
    this.last = now;
    this.flush();
    for (const [pid, conn] of this.conns) this._send(conn, this.world.snapshotFor(pid));
    if (this.conns.size && this.world.tick % RULES.net.rosterEveryTicks === 0) {
      const roster = JSON.stringify(this.world.roster());
      for (const conn of this.conns.values()) { try { conn.send(roster); } catch { /* gone */ } }
    }
  }

  // Closes connections silent longer than idleMs (phones that lost signal).
  reap(idleMs, now = Date.now()) {
    for (const conn of this.state.keys()) {
      if (now - conn.lastSeen > idleMs) (conn.terminate || conn.close).call(conn, 4000, 'idle');
    }
  }

  // ---------- moderation (called by the host's authenticated /admin route) ----------
  stats() {
    return { players: this.conns.size, uptimeSec: Math.round((this.clock() - this.startedAt) / 1000), tick: this.world.tick };
  }

  async admin(cmd) {
    const c = cmd && typeof cmd === 'object' ? cmd : {};
    const now = this.clock();
    const find = () => this.world.players.get(String(c.id || ''))
      || [...this.world.players.values()].find((p) => p.name.toLowerCase() === String(c.name || '').toLowerCase());
    switch (c.action) {
      case 'list':
        return { ok: true, players: [...this.world.players.values()].map((p) => ({
          id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y), hp: p.hp, cash: p.cash,
          deliveries: p.stats.deliveries, ip: this.conns.get(p.id)?.ip })) };
      case 'kick': case 'ban': {
        const p = find();
        if (!p) return { ok: false, reason: 'no such player' };
        const conn = this.conns.get(p.id);
        if (c.action === 'ban') {
          p.banned = true;
          await this.persist(p.id);
          const hours = Math.min(Math.max(Number(c.hours) || 24, 1), 24 * 30);
          if (conn?.ip) this.ipBans.set(conn.ip, now + hours * 3600000);
        }
        this._send(conn, { t: S.ERROR, reason: c.action === 'ban' ? 'banned' : 'kicked' });
        conn?.close(c.action === 'ban' ? 4005 : 4006, c.action === 'ban' ? 'banned' : 'kicked');
        return { ok: true, [c.action === 'ban' ? 'banned' : 'kicked']: { id: p.id, name: p.name } };
      }
      case 'unban-ip':
        return { ok: this.ipBans.delete(String(c.ip || '')) };
      case 'announce': {
        const text = World.cleanChat(c.text || '');
        if (!text) return { ok: false, reason: 'empty' };
        for (const conn of this.conns.values()) this._send(conn, { t: S.CHAT, from: 'server', name: 'SERVER', ch: 'city', text });
        return { ok: true, sent: this.conns.size };
      }
      default:
        return { ok: false, reason: 'unknown action', actions: ['list', 'kick', 'ban', 'unban-ip', 'announce'] };
    }
  }

  async saveAll() {
    for (const pid of this.conns.keys()) await this.persist(pid);
    await this.store.flush();
  }
}

module.exports = { Room, newToken, isToken };
