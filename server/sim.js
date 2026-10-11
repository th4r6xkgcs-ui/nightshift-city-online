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
const movement = require('../shared/movement.js');

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
    this.random = opts.random || Math.random;
  }

  // ---------- lifecycle ----------
  addPlayer(id, name, now, saved = null, { presence = false } = {}) {
    if (this.players.has(id)) throw new Error('duplicate player id');
    const R = RULES;
    const p = {
      id, name,
      x: R.spawn.x, y: R.spawn.y, aim: 0,
      hp: R.player.maxHp,
      cash: R.player.startCash,
      mag: R.combat.startMagazine,
      reserve: R.combat.startReserve,
      pocket: { ...R.player.startPocket },
      home: { owned: false, stash: {} },
      job: null,          // {pickup, drop, reward, stage: 'pickup'|'deliver', expiresAt}
      jobReadyAt: 0,      // cooldown before the next job
      stats: { deliveries: 0, earned: 0 },
      chatBucket: R.chat.burst, chatAt: now,
      muted: new Set(),   // player ids whose chat this player hides (session only)
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
    if (presence) Object.assign(p, { presence: true, posSeq: -1, posAt: now, posRejectSince: 0, car: null, posRejects: 0, shotBucket: R.presence.shotBurst, shotAt: now });
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
    if (s.home && typeof s.home === 'object' && s.home.owned === true) {
      const H = R.home, st = s.home.stash || {}, stash = {};
      const cash = int(st.cash, 0, H.stashCashCap, 0); if (cash) stash.cash = cash;
      const ammo = int(st.ammo, 0, H.stashAmmoCap, 0); if (ammo) stash.ammo = ammo;
      for (const item of R.items) { const n = int(st[item], 0, H.stashItemCap, 0); if (n) stash[item] = n; }
      p.home = { owned: true, stash };
    }
    if (s.stats && typeof s.stats === 'object') {
      p.stats = { deliveries: int(s.stats.deliveries, 0, 1e9, 0), earned: int(s.stats.earned, 0, R.cashCap, 0) };
    }
    p.job = this._restoreJob(s.job);
    if (p.job && p.job.stage === 'deliver' && !(p.pocket.parcel > 0)) p.job = null; // parcel lost: job void
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
      home: { owned: p.home.owned, stash: { ...p.home.stash } },
      job: p.job && !dead ? structuredClone(p.job) : null, stats: { ...p.stats },
      ...(p.banned ? { banned: true } : {}),
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

    if (p.presence) {
      // Shared-world mode: the real game keeps its own economy/combat for now.
      if (msg.t === C.POS) return this._pos(p, msg, now);
      if (msg.t === C.FIRE) return this._presenceFire(p, msg.aim, now);
      if (msg.t === C.PVP) return this._setPvp(p, msg.on);
      if (msg.t !== C.CHAT && msg.t !== C.MUTE) return { ok: false, reason: 'not available in shared-world mode', quiet: msg.t === C.INPUT };
    } else if (msg.t === C.POS) {
      return { ok: false, reason: 'pos is for shared-world mode', quiet: true };
    }
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
      case C.HOME: return this._tx(p, msg.tx, () => this._buyHome(p));
      case C.STASH: return this._tx(p, msg.tx, () => this._stash(p, msg.dir, msg.item, msg.count));
      case C.JOB: return this._tx(p, msg.tx, () => this._job(p, msg.action, now));
      case C.CHAT: return this._chat(p, msg.ch, msg.text, now);
      case C.MUTE: return this._mute(p, msg.id, msg.on);
      default: return { ok: false, reason: 'not handled here' };
    }
  }

  // ---------- simulation step ----------
  step(dtMs, now) {
    const R = RULES; // movement.step bounds long stalls itself
    this.tick++;
    for (const p of this.players.values()) {
      if (p.deadUntil) {
        if (now >= p.deadUntil) this._respawn(p);
        continue;
      }
      if (p.reloadUntil && now >= p.reloadUntil) this._finishReload(p);
      const moved = movement.step(p, p.input, dtMs, this.city, R); // same code as client prediction
      p.x = moved.x; p.y = moved.y;
    }
    for (const [id, b] of this.bags) if (now >= b.expires) this.bags.delete(id);
    for (const p of this.players.values()) {
      if (p.job && now >= p.job.expiresAt) {
        this._endJob(p, now, RULES.jobs.cancelCooldownMs);
        this._send(p.id, { t: S.EVENT, kind: 'job', status: 'expired' });
      }
    }
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
      if (q === p || q.deadUntil || q.presence) continue;
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

  // ---------- apartment + home stash ----------
  _atHome(p) {
    const a = this.city.apartment;
    return Math.hypot(p.x - a.x, p.y - a.y) <= a.radius;
  }

  _buyHome(p) {
    if (p.deadUntil) return { ok: false, reason: 'dead' };
    if (p.home.owned) return { ok: false, reason: 'already owned' };
    if (!this._atHome(p)) return { ok: false, reason: 'not at the apartment' };
    const price = RULES.home.price;
    if (p.cash < price) return { ok: false, reason: 'not enough cash' };
    p.cash -= price;
    p.home.owned = true;
    return { ok: true, cost: price };
  }

  // Moves `count` of one thing between pockets and the home stash.
  // All checks happen before anything changes, so a refusal changes nothing.
  _stash(p, dir, item, count) {
    const H = RULES.home, CB = RULES.combat;
    if (p.deadUntil) return { ok: false, reason: 'dead' };
    if (!p.home.owned) return { ok: false, reason: 'no apartment' };
    if (!this._atHome(p)) return { ok: false, reason: 'not at home' };
    const st = p.home.stash, had = st[item] || 0;
    const put = (n) => { if (n) st[item] = n; else delete st[item]; };

    if (item === 'cash') {
      if (dir === 'in') {
        if (p.cash < count) return { ok: false, reason: 'not enough cash' };
        if (had + count > H.stashCashCap) return { ok: false, reason: 'stash full' };
        p.cash -= count; put(had + count);
      } else {
        if (had < count) return { ok: false, reason: 'not in stash' };
        if (p.cash + count > RULES.cashCap) return { ok: false, reason: 'cash cap' };
        put(had - count); p.cash += count;
      }
    } else if (item === 'ammo') {
      if (p.reloadUntil) return { ok: false, reason: 'reloading' };
      if (dir === 'in') { // spare rounds only; the loaded magazine stays in the gun
        if (p.reserve < count) return { ok: false, reason: 'not enough spare ammo' };
        if (had + count > H.stashAmmoCap) return { ok: false, reason: 'stash full' };
        p.reserve -= count; put(had + count);
      } else {
        if (had < count) return { ok: false, reason: 'not in stash' };
        if (p.reserve + count > CB.maxReserve || p.mag + p.reserve + count > CB.maxCarriedRounds) return { ok: false, reason: 'carrying max ammo' };
        put(had - count); p.reserve += count;
      }
    } else if (RULES.items.includes(item)) {
      const inPocket = p.pocket[item] || 0;
      if (dir === 'in') {
        if (inPocket < count) return { ok: false, reason: 'none carried' };
        if (had + count > H.stashItemCap) return { ok: false, reason: 'stash full' };
        if (inPocket === count) delete p.pocket[item]; else p.pocket[item] = inPocket - count;
        put(had + count);
      } else {
        if (had < count) return { ok: false, reason: 'not in stash' };
        if (inPocket + count > RULES.itemCap) return { ok: false, reason: 'pockets full' };
        put(had - count); p.pocket[item] = inPocket + count;
      }
    } else {
      return { ok: false, reason: 'cannot store that' };
    }
    return { ok: true, dir, item, count };
  }

  // ---------- chat ----------
  // Cleans text: no control characters, collapsed whitespace, no links
  // (stops scam/phishing spam), length-capped.
  static cleanChat(text) {
    let t = String(text).normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ');
    t = t.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link]').replace(/\b[a-z0-9-]+\.(?:com|net|org|gg|io|xyz|ru|ly|me|co)\b\S*/gi, '[link]');
    return t.replace(/\s+/g, ' ').trim().slice(0, RULES.chat.maxLen);
  }

  _chat(p, ch, raw, now) {
    const CH = RULES.chat;
    p.chatBucket = Math.min(CH.burst, p.chatBucket + ((now - p.chatAt) / 1000) * CH.perSec);
    p.chatAt = now;
    if (p.chatBucket < 1) return { ok: false, reason: 'slow down' };
    const text = World.cleanChat(raw);
    if (!text) return { ok: false, reason: 'empty message' };
    p.chatBucket -= 1;
    const msg = { t: S.CHAT, from: p.id, name: p.name, ch, text };
    for (const q of this.players.values()) {
      if (q.muted.has(p.id)) continue;
      if (ch === 'near' && q !== p && dist(p, q) > CH.nearRangePx) continue;
      this._send(q.id, msg);
    }
    return { ok: true, quiet: true };
  }

  _mute(p, id, on) {
    if (id === p.id || !this.players.has(id)) return { ok: false, reason: 'no such player' };
    if (on) p.muted.add(id); else p.muted.delete(id);
    return { ok: true, id, muted: on };
  }

  // ---------- online delivery jobs ----------
  _restoreJob(j) {
    if (!j || typeof j !== 'object') return null;
    const pt = (q) => q && Number.isFinite(q.x) && Number.isFinite(q.y) && typeof q.label === 'string'
      ? { x: q.x, y: q.y, label: q.label.slice(0, 30) } : null;
    const pickup = pt(j.pickup), drop = pt(j.drop);
    if (!pickup || !drop || !['pickup', 'deliver'].includes(j.stage) || !Number.isFinite(j.expiresAt)) return null;
    // Re-derive pay from the route, so a damaged save can't raise it.
    return { pickup, drop, stage: j.stage, expiresAt: j.expiresAt, reward: this._pay(pickup, drop) };
  }

  _pay(a, b) {
    const J = RULES.jobs;
    return Math.min(J.maxPay, Math.round(J.basePay + Math.hypot(a.x - b.x, a.y - b.y) * J.payPerPx));
  }

  _endJob(p, now, cooldownMs) {
    if (p.job && p.job.stage === 'deliver' && p.pocket.parcel > 0) {
      if (--p.pocket.parcel === 0) delete p.pocket.parcel;
    }
    p.job = null;
    p.jobReadyAt = now + cooldownMs;
  }

  _job(p, action, now) {
    const J = RULES.jobs;
    if (p.deadUntil) return { ok: false, reason: 'dead' };
    const near = (pt) => Math.hypot(p.x - pt.x, p.y - pt.y) <= J.rangePx;

    if (action === 'start') {
      if (p.job) return { ok: false, reason: 'already on a job' };
      if (now < p.jobReadyAt) return { ok: false, reason: 'next job soon', waitMs: p.jobReadyAt - now };
      const doors = this.city.buildings.map((b) => ({ x: b.entrance.x, y: b.entrance.y, label: b.name }));
      const pickup = doors[Math.floor(this.random() * doors.length)];
      const far = doors.filter((d) => Math.hypot(d.x - pickup.x, d.y - pickup.y) >= J.minDistancePx);
      const drop = far[Math.floor(this.random() * far.length)];
      p.job = { pickup, drop, stage: 'pickup', expiresAt: now + J.timeLimitMs, reward: this._pay(pickup, drop) };
      return { ok: true, job: structuredClone(p.job) };
    }
    if (!p.job) return { ok: false, reason: 'no job' };
    if (action === 'cancel') {
      this._endJob(p, now, J.cancelCooldownMs);
      return { ok: true, cancelled: true };
    }
    if (action === 'pickup') {
      if (p.job.stage !== 'pickup') return { ok: false, reason: 'already picked up' };
      if (!near(p.job.pickup)) return { ok: false, reason: 'not at pickup' };
      if ((p.pocket.parcel || 0) >= RULES.itemCap) return { ok: false, reason: 'pockets full' };
      p.pocket.parcel = (p.pocket.parcel || 0) + 1;
      p.job.stage = 'deliver';
      return { ok: true, job: structuredClone(p.job) };
    }
    // deliver
    if (p.job.stage !== 'deliver') return { ok: false, reason: 'pick up the parcel first' };
    if (!near(p.job.drop)) return { ok: false, reason: 'not at dropoff' };
    if (!(p.pocket.parcel > 0)) return { ok: false, reason: 'parcel lost' };
    const reward = Math.min(p.job.reward, RULES.cashCap - p.cash);
    if (--p.pocket.parcel === 0) delete p.pocket.parcel;
    p.cash += reward;
    p.stats.deliveries++; p.stats.earned += reward;
    p.job = null;
    p.jobReadyAt = now + J.cooldownMs;
    return { ok: true, reward, deliveries: p.stats.deliveries };
  }

  _setPvp(p, on) {
    p.pvp = on;
    return { ok: true, pvp: on };
  }

  // ---------- death / respawn ----------
  _kill(victim, killer, now) {
    if (victim.job) { // a dead courier's job and parcel are void
      this._endJob(victim, now, RULES.jobs.cancelCooldownMs);
      this._send(victim.id, { t: S.EVENT, kind: 'job', status: 'failed' });
    }
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
      home: { owned: p.home.owned, stash: { ...p.home.stash } },
      job: p.job ? structuredClone(p.job) : null, stats: { ...p.stats },
    };
  }

  publicView(p) {
    const v = {
      id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y), aim: p.aim,
      hp: p.hp, dead: !!p.deadUntil, pvp: p.pvp,
    };
    if (p.presence) { v.presence = true; v.car = p.car; }
    return v;
  }

  // ---------- shared-world combat ----------
  // The game owns ammo and its own hit effects; the server decides hits
  // between online players: cadence, range, walls, safe zone, both opted in.
  _presenceFire(p, aim, now) {
    const PR = RULES.presence, CB = RULES.combat;
    const refill = (now - p.shotAt) / CB.fireIntervalMs;
    p.shotBucket = Math.min(PR.shotBurst, p.shotBucket + refill);
    p.shotAt = now;
    if (p.shotBucket < 1) return { ok: false, reason: 'too fast', quiet: true };
    p.shotBucket -= 1;
    if (p.car) return { ok: false, reason: 'in a car', quiet: true };
    p.aim = aim;
    const dx = Math.cos(aim), dy = Math.sin(aim);
    let best = null, bestT = Infinity;
    for (const q of this.players.values()) {
      if (q === p || !q.presence) continue;
      const ox = q.x - p.x, oy = q.y - p.y, t = ox * dx + oy * dy;
      if (t <= 0 || t > CB.rangePx) continue;
      const r = q.car ? PR.carRadius : RULES.player.radius;
      if (Math.abs(ox * dy - oy * dx) <= r && t < bestT) { best = q; bestT = t; }
    }
    const wallT = this.city.rayHit(p.x, p.y, dx, dy, Math.min(bestT, CB.rangePx));
    let hit = null, blocked = null;
    if (best && wallT < bestT) blocked = 'wall';
    else if (best && !(p.pvp && best.pvp)) blocked = 'pvp off';
    else if (best && (this.city.inClinic(best) || this.city.inClinic(p))) blocked = 'safe zone';
    else if (best) hit = best;
    const len = Math.min(hit ? bestT : CB.rangePx, wallT);
    // Tracer for everyone nearby (they see you shooting, even at NPCs).
    for (const q of this.players.values()) {
      if (q === p || Math.hypot(q.x - p.x, q.y - p.y) > PR.tracerRangePx) continue;
      this._send(q.id, { t: S.EVENT, kind: 'shot', from: p.id, x: Math.round(p.x), y: Math.round(p.y), aim, len: Math.round(len) });
    }
    if (hit) {
      const damage = hit.car ? PR.carDamage : CB.damage;
      this._send(hit.id, { t: S.EVENT, kind: 'shot-hit', by: p.id, byName: p.name, damage });
      this._send(p.id, { t: S.EVENT, kind: 'hit-confirm', target: hit.id, targetName: hit.name, damage });
    }
    return { ok: true, quiet: true, hit: hit ? hit.id : null, blocked };
  }

  // ---------- shared-world position reports ----------
  _anchors() {
    if (!this._anchorList) {
      const c = this.city;
      this._anchorList = [RULES.hospital, RULES.spawn, c.apartment, c.clinic, ...c.buildings.map((b) => b.entrance)];
    }
    return this._anchorList;
  }

  _pos(p, m, now) {
    const P = RULES.presence, R = RULES;
    if (m.seq <= p.posSeq) return { ok: false, reason: 'stale', quiet: true };
    const x = m.x, y = m.y;
    const inBuilding = this.city.buildings.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
    const outside = x < 0 || y < 0 || x > R.world.w || y > R.world.h;
    let ok = !inBuilding && !outside;
    if (ok && p.posSeq >= 0) {
      const allowed = (P.maxSpeedPxPerSec * Math.max(0, now - p.posAt)) / 1000 + P.slackPx;
      const near = (a) => Math.hypot(a.x - x, a.y - y) <= P.anchorRangePx;
      // Long jumps only to places the game legitimately puts you (respawn, doors, home).
      if (Math.hypot(x - p.x, y - p.y) > allowed && !this._anchors().some(near)) {
        // A client that keeps disagreeing for a while is resynced rather than stuck.
        if (!p.posRejectSince) p.posRejectSince = now;
        ok = now - p.posRejectSince >= P.resyncAfterMs;
      }
    }
    if (!ok) { p.posRejects++; return { ok: false, reason: 'rejected', quiet: true }; }
    p.posRejectSince = 0;
    p.posSeq = m.seq; p.posAt = now;
    p.x = x; p.y = y; p.aim = m.aim;
    p.car = m.car ? { angle: m.car.angle, ...(m.car.color ? { color: m.car.color } : {}) } : null;
    return { ok: true, quiet: true };
  }

  // Everyone in the city, with coarse positions (for lists, arrows, maps).
  roster() {
    const grid = RULES.net.rosterGridPx, snap = (v) => Math.round(v / grid) * grid;
    const players = [];
    for (const p of this.players.values()) players.push({ id: p.id, name: p.name, pvp: p.pvp, x: snap(p.x), y: snap(p.y) });
    players.sort((a, b) => a.name.localeCompare(b.name));
    return { t: S.ROSTER, players };
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

  // Total money in the world (players, home stashes, bags). Used by tests to
  // prove transfers/looting/stashing never create or destroy cash.
  totalCash() {
    let n = 0;
    for (const p of this.players.values()) n += p.cash + (p.home.stash.cash || 0);
    for (const b of this.bags.values()) n += b.cash;
    return n;
  }
}

module.exports = { World };
