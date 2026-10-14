/* Room logic (Claude-owned, v0.66): the server side of a Nightshift City room. Pure; no sockets here.
 * Both servers wrap it: server/worker.js (Cloudflare Durable Object, one object per room) and
 * server/dev-server.mjs (Node + ws, for local play/testing). Tests drive it directly.
 *  - join/leave, a name per player, room mode: 'pve' (players can't hurt each other — the default) or 'pvp'
 *  - movement sanity: a state update that moves faster than possible (on foot / in a car / switching zone) is
 *    rejected and the player is told where the server thinks they are (anti-teleport)
 *  - position history per player (2 s) for lag-compensated hit checks
 *  - hits: unpacked with combat-core, checked with canDamage (mode), validate (range, rate, positions vs the
 *    rewound target, damage cap); valid hits are relayed to the victim, invalid ones are dropped with a reason
 *  - snapshots: everyone's latest state, sent ~10 Hz (players in other zones are included but flagged by zone)
 *  - rate limits: per-player message budget; chat length + frequency.
 * API: new Room({ mode, now }) -> { join(id, hello), leave(id), message(id, raw, now) -> outbox, tick(now) -> outbox }
 *   outbox = [{ to: 'all' | 'others' | <id>, except?, data: string }] */
(function (root) {
  'use strict';
  const NP = (typeof module === 'object' && module.exports) ? require('./net-protocol.js') : root.NightshiftNetProtocol;
  const K = (typeof module === 'object' && module.exports) ? require('./combat-core.js') : root.NightshiftCombatCore;
  const SPEED = { foot: 420, car: 1500, highway: 1400 }; // px/s ceilings (+ slack)
  const BUDGET = 40; // messages per second per player
  class Room {
    constructor(o = {}) { this.mode = o.mode === 'pvp' ? 'pvp' : 'pve'; this.players = new Map(); this.started = o.now ?? Date.now(); this.stats = { denied: 0, hits: 0, rejectedHits: 0, msgs: 0 }; }
    join(id, hello, now = Date.now()) {
      if (this.players.size >= NP.MAX_PLAYERS) return [{ to: id, data: NP.enc('deny', 'room full') }];
      const p = { id, name: NP.cleanName(hello?.name), x: 0, y: 0, a: 0, zone: 'city', flags: 0, car: hello?.car || null, color: hello?.color || null, t: 0, seenAt: now, hist: [], placed: false, lastShotAt: 0, budget: BUDGET, budgetAt: now, chatAt: 0, team: 'player:' + id };
      this.players.set(id, p);
      const others = [...this.players.values()].filter((q) => q.id !== id && q.placed).map(NP.row);
      return [{ to: id, data: NP.enc('welcome', id, now, this.mode, others) }, { to: 'others', except: id, data: NP.enc('join', id, p.name) }];
    }
    leave(id) { if (!this.players.delete(id)) return []; return [{ to: 'all', data: NP.enc('leave', id) }]; }
    message(id, raw, now = Date.now()) {
      const p = this.players.get(id); if (!p) return [];
      // budget (token bucket)
      p.budget = Math.min(BUDGET, p.budget + (now - p.budgetAt) / 1000 * BUDGET); p.budgetAt = now; if (p.budget < 1) { this.stats.denied++; return []; } p.budget -= 1;
      const m = NP.parseClient(raw); if (!m) return []; this.stats.msgs++;
      if (m.type === 'hello') { p.name = m.name; if (m.car !== undefined) p.car = m.car; if (m.color) p.color = m.color; return []; }
      if (m.type === 'ping') return [{ to: id, data: NP.enc('pong', m.t, now) }];
      if (m.type === 'chat') { if (now - p.chatAt < 1500) return []; p.chatAt = now; return [{ to: 'all', data: NP.enc('chat', id, m.text) }]; }
      if (m.type === 'st') return this.state(p, m, now);
      if (m.type === 'hit') return this.hit(p, m.packed, now);
      return [];
    }
    state(p, m, now) {
      const tp = (m.flags & NP.FLAG.teleport) && now - (p.tpAt || 0) > 5000; if (tp) p.tpAt = now;
      if (p.placed && m.zone === p.zone && !tp) {
        const dt = Math.max(0.05, (now - p.seenAt) / 1000), d = Math.hypot(m.x - p.x, m.y - p.y), cap = (m.zone === 'highway' ? SPEED.highway : (m.flags & NP.FLAG.car) ? SPEED.car : SPEED.foot) * dt + 60;
        if (d > cap) { this.stats.denied++; return [{ to: p.id, data: NP.enc('deny', 'moved too fast', p.x, p.y) }]; }
      }
      Object.assign(p, { x: m.x, y: m.y, a: m.a, zone: m.zone, flags: m.flags & 15, car: m.car, color: m.color ?? p.color, t: m.t, seenAt: now, placed: true });
      p.hist.push({ t: now, x: m.x, y: m.y }); while (p.hist.length && now - p.hist[0].t > 2000) p.hist.shift();
      return [];
    }
    hit(p, packed, now) {
      let ev; try { ev = K.unpack(packed); } catch { return []; }
      const target = this.players.get(ev.dst); const reject = (reason) => { this.stats.rejectedHits++; return [{ to: p.id, data: NP.enc('deny', 'hit: ' + reason) }]; };
      if (!target || target === p) return reject('no target');
      if (target.zone !== p.zone) return reject('zone');
      if (!K.canDamage({ id: p.id, team: p.team }, { id: target.id, team: target.team }, this.mode === 'pvp' ? 'ffa' : 'pve')) return reject('friendly');
      if (this.mode !== 'pvp') return reject('pve');
      const when = Math.min(now, Math.max(now - 1000, ev.t || now)), at = K.rewind(target.hist, when) || target;
      const W = { cls: 'pistol', dmg: 40, range: 520, rate: 120 }; // server cap per hit until weapons are server-owned
      const v = K.validate({ ...ev, t: now }, { now, shooter: { x: p.x, y: p.y, lastShotAt: ev.kind === 'melee' ? 0 : p.lastShotAt }, target: at, weapon: W });
      if (!v.ok) return reject(v.reason);
      p.lastShotAt = now; this.stats.hits++;
      const out = K.hitEvent({ ...ev, src: p.id, t: now });
      return [{ to: target.id, data: NP.enc('hit', K.pack(out)) }, { to: p.id, data: NP.enc('hit', K.pack(out)) }];
    }
    tick(now = Date.now()) {
      const rows = [...this.players.values()].filter((p) => p.placed && now - p.seenAt < 10000).map(NP.row);
      for (const p of this.players.values()) if (now - p.seenAt > 30000) this.players.delete(p.id); // idle cleanup (sockets close separately)
      return rows.length ? [{ to: 'all', data: NP.enc('snap', now, rows) }] : [];
    }
  }
  const api = { Room, SPEED };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftRoomCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
