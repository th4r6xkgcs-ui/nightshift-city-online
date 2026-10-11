'use strict';
// Authoritative world simulation. Pure logic: no sockets, no timers, no I/O.
// The caller passes `now` (ms) into every method so tests are deterministic.
//
// Anti-cheat by construction:
//  - Clients send movement *intent* (-1..1 stick); the server integrates
//    position itself, so speed/teleport hacks are impossible.
//  - Cash, hp, ammo and items exist only here. Clients get read-only copies.
//  - Every money-moving request carries a client transaction id; replays of
//    the same id return the first result and never charge/pay twice.

const RULES = require('../shared/rules.js');
const { C, S, validate } = require('../shared/protocol.js');
const { createCity } = require('../shared/city.js');

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

class World {
  constructor(opts = {}) {
    this.rules = RULES;
    this.players = new Map();
    this.bags = new Map();
    this.tick = 0;
    this.nextBag = 1;
    this.outbox = []; // [{to: playerId, msg}]
    this.pvpDefault = opts.pvpDefault === true; // PvP is opt-in by default
    this.city = opts.city || createCity();
  }

  // ---------- lifecycle ----------
  addPlayer(id, name, now, saved = null) {
    if (this.players.has(id)) throw new Error('duplicate player id');
    const R = RULES;
    const p = {
      id, name,
      x: R.spawn.x, y: R.spawn.y, aim: 0,
      hp: R.player.maxHp,
      cash: R.player.startCash,
      mag: R.combat.startMagazine,
      reserve: R.combat.startReserve,
      pocket: { pistol: 1 },
      input: { mx: 0, my: 0, sprint: false, seq: 0 },
      lastSeq: -1,
      nextShotAt: 0,
      reloadUntil: 0,
      deadUntil: 0,
      pvp: this.pvpDefault,
      tx: new Map(), // tx id -> result (bounded)
      joinedAt: now,
    };
    if (saved) this._restore(p, saved);
    this.players.set(id, p);
    return p;
  }

  // Server-side profile restore. Values are re-clamped even though the
  // store is server-owned, so a damaged save can't break game rules.
  _restore(p, s) {
    const R = RULES, CB = R.combat;
    const int = (v, lo, hi, d) => (Number.isSafeInteger(v) ? clamp(v, lo, hi) : d);
    if (typeof s.name === 'string' && /^[\w .-]{1,20}$/.test(s.name)) p.name = s.name;
    p.cash = int(s.cash, 0, R.cashCap, p.cash);
    p.hp = int(s.hp, 1, R.player.maxHp, p.hp);
    p.reserve = int(s.reserve, 0, CB.maxReserve, p.reserve);
    p.mag = int(s.mag, 0, Math.min(CB.magSize, CB.maxCarriedRounds - p.reserve), p.mag);
    p.pocket = {};
    if (s.pocket && typeof s.pocket === 'object') {
      for (const item of R.items) { const n = int(s.pocket[item], 0, R.itemCap, 0); if (n) p.pocket[item] = n; }
    }
    p.pvp = s.pvp === true;
    if (Number.isFinite(s.x) && Number.isFinite(s.y)) {
      const x = clamp(s.x, R.player.radius, R.world.w - R.player.radius);
      const y = clamp(s.y, R.player.radius, R.world.h - R.player.radius);
      if (!this.city.blocked(x, y)) { p.x = x; p.y = y; }
    }
  }

  exportProfile(id) {
    const p = this.players.get(id);
    if (!p) return null;
    const dead = !!p.deadUntil; // dying already dropped the bag; wake at hospital
    return {
      name: p.name, cash: p.cash, hp: dead ? RULES.player.maxHp : p.hp,
      mag: p.mag, reserve: p.reserve, pocket: { ...p.pocket }, pvp: p.pvp,
      x: Math.round(dead ? RULES.hospital.x : p.x), y: Math.round(dead ? RULES.hospital.y : p.y),
    };
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  // ---------- message entry point ----------
  handle(id, msg, now) {
    const p = this.players.get(id);
    if (!p) return { ok: false, reason: 'no such player' };
    const bad = validate(msg);
    if (bad) return { ok: false, reason: bad, strike: true };

    switch (msg.t) {
      case C.INPUT: return this._input(p, msg);
      case C.FIRE: return this._fire(p, msg.aim, now);
      case C.RELOAD: return this._reload(p, now);
      case C.BUY: return this._tx(p, msg.tx, () => this._buy(p, msg.item));
      case C.SELL: return this._tx(p, msg.tx, () => this._sell(p, msg.item));
      case C.USE: return this._use(p, msg.item);
      case C.PICKUP: return this._pickup(p, msg.bag);
      case C.GIVE: return this._tx(p, msg.tx, () => this._give(p, msg.to, msg.cash));
      case C.PVP: return this._setPvp(p, msg.on);
      default: return { ok: false, reason: 'not handled here' };
    }
  }

  // ---------- simulation step ----------
  step(dtMs, now) {
    const dt = clamp(dtMs, 0, 250) / 1000; // bound stalls like the client does
    const R = RULES;
    this.tick++;
    for (const p of this.players.values()) {
      if (p.deadUntil) {
        if (now >= p.deadUntil) this._respawn(p);
        continue;
      }
      if (p.reloadUntil && now >= p.reloadUntil) this._finishReload(p);
      let { mx, my } = p.input;
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      if (len < 0.05) continue; // deadzone, matches client stick
      const speed = p.input.sprint ? R.player.runPxPerSec : R.player.walkPxPerSec;
      const r = R.player.radius;
      // Axis-separated moves so players slide along walls like the client.
      const nx = clamp(p.x + mx * speed * dt, r, R.world.w - r);
      if (!this.city.blocked(nx, p.y)) p.x = nx;
      const ny = clamp(p.y + my * speed * dt, r, R.world.h - r);
      if (!this.city.blocked(p.x, ny)) p.y = ny;
    }
    for (const [id, b] of this.bags) if (now >= b.expires) this.bags.delete(id);
  }

  // ---------- handlers ----------
  _input(p, m) {
    if (m.seq <= p.lastSeq) return { ok: false, reason: 'stale input', quiet: true };
    p.lastSeq = m.seq;
    p.input = { mx: clamp(m.mx, -1, 1), my: clamp(m.my, -1, 1), sprint: m.sprint, seq: m.seq };
    p.aim = m.aim;
    return { ok: true, quiet: true };
  }

  _fire(p, aim, now) {
    const R = RULES.combat;
    if (p.deadUntil) return { ok: false, reason: 'dead' };
    if (!(p.pocket.pistol > 0)) return { ok: false, reason: 'no pistol' };
    if (p.reloadUntil) return { ok: false, reason: 'reloading' };
    if (now < p.nextShotAt) return { ok: false, reason: 'too fast', quiet: true };
    if (p.mag <= 0) return { ok: false, reason: 'empty' };
    p.mag--;
    p.nextShotAt = now + R.fireIntervalMs;
    p.aim = aim;

    // Hitscan against other players; buildings stop bullets.
    const dx = Math.cos(aim), dy = Math.sin(aim);
    let best = null, bestT = Infinity;
    for (const q of this.players.values()) {
      if (q === p || q.deadUntil) continue;
      const ox = q.x - p.x, oy = q.y - p.y;
      const t = ox * dx + oy * dy;
      if (t <= 0 || t > R.rangePx) continue;
      const miss = Math.abs(ox * dy - oy * dx);
      if (miss <= RULES.player.radius && t < bestT) { best = q; bestT = t; }
    }
    if (!best) return { ok: true, hit: null };
    if (this.city.rayHit(p.x, p.y, dx, dy, bestT) < bestT) return { ok: true, hit: null, blocked: 'wall' };
    if (!(p.pvp && best.pvp)) return { ok: true, hit: null, blocked: 'pvp off' };
    if (this.city.inClinic(best) || this.city.inClinic(p)) return { ok: true, hit: null, blocked: 'safe zone' };

    best.hp = Math.max(0, best.hp - R.damage);
    this._send(best.id, { t: S.EVENT, kind: 'hit', by: p.id, hp: best.hp });
    if (best.hp === 0) this._kill(best, p, now);
    return { ok: true, hit: best.id };
  }

  _reload(p, now) {
    const R = RULES.combat;
    if (p.deadUntil) return { ok: false, reason: 'dead' };
    if (p.reloadUntil) return { ok: false, reason: 'already reloading' };
    if (p.mag >= R.magSize) return { ok: false, reason: 'magazine full' };
    if (p.reserve <= 0) return { ok: false, reason: 'no reserve' };
    p.reloadUntil = now + R.reloadMs;
    return { ok: true, until: p.reloadUntil };
  }

  _finishReload(p) {
    const take = Math.min(RULES.combat.magSize - p.mag, p.reserve);
    p.mag += take;
    p.reserve -= take;
    p.reloadUntil = 0;
  }

  _tx(p, tx, fn) {
    if (p.tx.has(tx)) return { ...p.tx.get(tx), replay: true };
    const result = { tx, ...fn() };
    p.tx.set(tx, result);
    if (p.tx.size > RULES.net.txMemory) p.tx.delete(p.tx.keys().next().value);
    return result;
  }

  _buy(p, item) {
    const R = RULES.shop, CB = RULES.combat;
    if (p.deadUntil) return { ok: false, reason: 'dead' };
    if (!this.city.nearShop(p)) return { ok: false, reason: 'not at a shop' };
    if (item === 'ammo') {
      const room = Math.min(CB.maxReserve - p.reserve, CB.maxCarriedRounds - p.mag - p.reserve);
      const rounds = Math.min(R.ammoPackRounds, room);
      if (rounds <= 0) return { ok: false, reason: 'spare ammo full' };
      const cost = rounds * R.ammoPerRound;
      if (p.cash < cost) return { ok: false, reason: 'not enough cash' };
      p.cash -= cost; p.reserve += rounds;
      return { ok: true, item, rounds, cost };
    }
    if (item === 'med') {
      if (p.hp >= RULES.player.maxHp) return { ok: false, reason: 'health full' };
      if (p.cash < R.firstAid) return { ok: false, reason: 'not enough cash' };
      p.cash -= R.firstAid;
      p.hp = Math.min(RULES.player.maxHp, p.hp + R.firstAidHeal);
      return { ok: true, item, cost: R.firstAid };
    }
    const price = { pistol: R.pistol, medkit: R.medkit }[item];
    if (!price) return { ok: false, reason: 'unknown item' };
    if ((p.pocket[item] || 0) >= RULES.itemCap) return { ok: false, reason: 'carrying max' };
    if (p.cash < price) return { ok: false, reason: 'not enough cash' };
    p.cash -= price;
    p.pocket[item] = (p.pocket[item] || 0) + 1;
    return { ok: true, item, cost: price };
  }

  _sell(p, item) {
    if (p.deadUntil) return { ok: false, reason: 'dead' };
    const price = RULES.shop.sell[item];
    if (!price) return { ok: false, reason: 'cannot sell that' };
    if (!this.city.nearShop(p)) return { ok: false, reason: 'not at a shop' };
    if (!(p.pocket[item] > 0)) return { ok: false, reason: 'none carried' };
    if (p.cash + price > RULES.cashCap) return { ok: false, reason: 'cash cap' };
    if (--p.pocket[item] === 0) delete p.pocket[item];
    p.cash += price;
    return { ok: true, item, price };
  }

  _use(p, item) {
    if (item !== 'medkit') return { ok: false, reason: 'cannot use that' };
    if (p.deadUntil) return { ok: false, reason: 'dead' };
    if (p.hp >= RULES.player.maxHp) return { ok: false, reason: 'health full' };
    if (!(p.pocket.medkit > 0)) return { ok: false, reason: 'no medkit' };
    if (--p.pocket.medkit === 0) delete p.pocket.medkit;
    p.hp = Math.min(RULES.player.maxHp, p.hp + RULES.shop.medkitHeal);
    return { ok: true, hp: p.hp };
  }

  _give(p, toId, cash) {
    const q = this.players.get(toId);
    if (!q || q === p) return { ok: false, reason: 'no such player' };
    if (p.deadUntil || q.deadUntil) return { ok: false, reason: 'dead' };
    if (dist(p, q) > RULES.transfer.rangePx) return { ok: false, reason: 'too far' };
    if (cash > RULES.transfer.maxPerTransfer) return { ok: false, reason: 'over limit' };
    if (p.cash < cash) return { ok: false, reason: 'not enough cash' };
    if (q.cash + cash > RULES.cashCap) return { ok: false, reason: 'receiver cash cap' };
    p.cash -= cash; q.cash += cash; // single synchronous step: atomic
    this._send(q.id, { t: S.EVENT, kind: 'received', from: p.id, cash });
    return { ok: true, to: q.id, cash };
  }

  _pickup(p, bagId) {
    if (p.deadUntil) return { ok: false, reason: 'dead' };
    const b = this.bags.get(bagId);
    if (!b) return { ok: false, reason: 'gone' };
    if (dist(p, b) > RULES.bags.pickupRangePx) return { ok: false, reason: 'too far' };
    const CB = RULES.combat, got = { cash: 0, rounds: 0, items: {} };
    const cashRoom = RULES.cashCap - p.cash;
    got.cash = Math.min(b.cash, cashRoom); b.cash -= got.cash; p.cash += got.cash;
    const roundRoom = Math.min(CB.maxReserve - p.reserve, CB.maxCarriedRounds - p.mag - p.reserve);
    got.rounds = Math.max(0, Math.min(b.rounds, roundRoom)); b.rounds -= got.rounds; p.reserve += got.rounds;
    for (const [item, n] of Object.entries(b.items)) {
      const take = Math.min(n, RULES.itemCap - (p.pocket[item] || 0));
      if (take <= 0) continue;
      p.pocket[item] = (p.pocket[item] || 0) + take;
      got.items[item] = take;
      if ((b.items[item] -= take) === 0) delete b.items[item];
    }
    if (!b.cash && !b.rounds && !Object.keys(b.items).length) this.bags.delete(bagId);
    return { ok: true, got };
  }

  _setPvp(p, on) {
    p.pvp = on;
    return { ok: true, pvp: on };
  }

  // ---------- death / respawn ----------
  _kill(victim, killer, now) {
    const id = 'bag' + this.nextBag++;
    this.bags.set(id, {
      id, x: victim.x, y: victim.y,
      cash: victim.cash, rounds: victim.mag + victim.reserve,
      items: { ...victim.pocket },
      expires: now + RULES.bags.lifetimeMs,
    });
    victim.cash = 0; victim.mag = 0; victim.reserve = 0; victim.pocket = {};
    victim.reloadUntil = 0;
    victim.input = { mx: 0, my: 0, sprint: false, seq: victim.input.seq };
    victim.deadUntil = now + RULES.hospital.respawnMs;
    const ev = { t: S.EVENT, kind: 'death', victim: victim.id, by: killer.id, bag: id };
    this._send(victim.id, ev);
    this._send(killer.id, ev);
  }

  _respawn(p) {
    const H = RULES.hospital;
    const fee = Math.min(H.maxFee, p.cash);
    p.cash -= fee;
    p.hp = RULES.player.maxHp;
    p.x = H.x; p.y = H.y;
    p.deadUntil = 0;
    this._send(p.id, { t: S.EVENT, kind: 'respawn', fee });
  }

  // ---------- views ----------
  privateView(p) {
    return {
      id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y), aim: p.aim,
      hp: p.hp, cash: p.cash, mag: p.mag, reserve: p.reserve, pocket: { ...p.pocket },
      reloading: !!p.reloadUntil, dead: !!p.deadUntil, pvp: p.pvp, ack: p.lastSeq,
    };
  }

  publicView(p) {
    return {
      id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y), aim: p.aim,
      hp: p.hp, dead: !!p.deadUntil, pvp: p.pvp,
    };
  }

  snapshotFor(id) {
    const p = this.players.get(id);
    if (!p) return null;
    const r = RULES.net.interestRadiusPx;
    const others = [];
    for (const q of this.players.values()) if (q !== p && dist(p, q) <= r) others.push(this.publicView(q));
    const bags = [];
    for (const b of this.bags.values()) if (dist(p, b) <= r) bags.push({ id: b.id, x: Math.round(b.x), y: Math.round(b.y) });
    return { t: S.STATE, tick: this.tick, you: this.privateView(p), others, bags };
  }

  _send(to, msg) { this.outbox.push({ to, msg }); }
  drain() { const o = this.outbox; this.outbox = []; return o; }

  // Total money in the world (players + bags). Used by tests to prove
  // transfers/looting never create or destroy cash.
  totalCash() {
    let n = 0;
    for (const p of this.players.values()) n += p.cash;
    for (const b of this.bags.values()) n += b.cash;
    return n;
  }
}

module.exports = { World };
