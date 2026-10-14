/* Combat core (Claude-owned, v0.65): the ONE rulebook for every hit in Nightshift City.
 * Pure, deterministic, Node-testable — written so a future game server can run exactly this file:
 *   client predicts with it (instant feedback) -> server re-runs it on the same inputs -> server's result wins.
 *
 *  - Seeded randomness (mulberry32): a shot is (shooter, weapon, aim, seed). Same inputs -> same pellets/spread on
 *    every machine, so the server can verify a claimed hit instead of trusting the client.
 *  - Damage model: weapon damage x distance falloff x stance/cover x sneak bonus, then armor soaks part of it
 *    (armor penetration per weapon class), giving { hp, armor } damage.
 *  - Life states: alive -> DOWNED (bleeding out; can crawl, fire a sidearm, be revived or cuffed) -> dead.
 *    NPCs that can't be downed die straight away.
 *  - Teams / friendly fire: crews can't hurt each other unless the mode allows it (PvP rules live here too).
 *  - Hit events have a fixed schema + a compact wire format (pack/unpack) for the network later.
 *  - validate(): server-side sanity checks for a claimed hit (range, fire rate, clock skew, shooter position).
 *  - rewind(): lag compensation — where was the target at time t (interpolated from snapshot history).
 * API: NightshiftCombatCore.{RULES, CLASS, rng, seedOf, spread, falloff, armorSplit, resolve, apply, bleed, revive,
 *      canDamage, hitEvent, pack, unpack, validate, rewind, normalize} */
(function (root) {
  'use strict';
  const RULES = Object.freeze({
    bleedMs: 20000,        // how long a downed player has before bleeding out
    downedDmgMs: 450,      // each point of damage taken while downed eats this much bleed time
    reviveMs: 2600,        // hold time to revive someone (or yourself with a medkit)
    reviveHp: 35,          // hp after a revive
    crawl: 0.3,            // movement speed multiplier while downed
    downedFireMult: 1.8,   // spread multiplier for last-stand shooting
    absorb: 0.6,           // share of each hit armor can soak before penetration
    sneak: 2.5,            // damage multiplier on unaware targets
    cuffRange: 30,         // police can cuff a downed/stunned suspect this close
    skewMs: 300,           // max clock difference tolerated between client and server
    posTolerance: 48,      // px a shooter may be from where the server thinks it is
    rateGrace: 0.85,       // a client may fire up to 15% faster than the rate (jitter)
  });
  // armor penetration + default falloff by weapon class
  const CLASS = Object.freeze({
    pistol: { pen: 0.1, fall: [0.5, 1, 0.65] }, smg: { pen: 0.15, fall: [0.4, 1, 0.55] }, shotgun: { pen: 0.05, fall: [0.25, 0.8, 0.25] },
    rifle: { pen: 0.45, fall: [0.6, 1, 0.75] }, sniper: { pen: 0.7, fall: [0.85, 1, 0.9] }, melee: { pen: 0.3, fall: null }, taser: { pen: 0, fall: null },
    npc: { pen: 0.1, fall: [0.6, 1, 0.7] }, crude: { pen: 0, fall: [0.35, 0.9, 0.5] }, none: { pen: 0.1, fall: [0.5, 1, 0.65] },
  });
  const STANCE = Object.freeze({ stand: 1, moving: 1, crouch: 0.85, cover: 0.5, roll: 0, downed: 1, car: 0.4 });

  // ---------- deterministic randomness ----------
  function rng(seed) { let a = (seed >>> 0) || 0x9e3779b9; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seedOf(...parts) { let h = 2166136261; for (const p of parts) { const s = String(p); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 0x2f; } return h >>> 0; }
  // pellet angles for one trigger pull
  function spread(seed, aim, w, mult = 1) {
    const r = rng(seed), n = Math.max(1, w.pellets || 1), s = (w.spread || 0) * mult, out = [];
    for (let i = 0; i < n; i++) out.push(aim + (r() * 2 - 1) * s + (n > 1 ? ((i / (n - 1)) - 0.5) * s * 0.6 : 0));
    return out;
  }

  // ---------- weapons ----------
  function normalize(w) {
    const cls = w?.cls || w?.class || (w?.melee ? 'melee' : 'pistol'), C = CLASS[cls] || CLASS.pistol;
    return { id: w?.id || cls, cls, dmg: Math.max(0, Number(w?.dmg) || 10), range: Math.max(10, Number(w?.range) || 400), rate: Math.max(30, Number(w?.rate) || 300), spread: Number(w?.spread) || 0, pellets: Math.max(1, w?.pellets | 0 || 1), pen: Number.isFinite(w?.pen) ? w.pen : C.pen, fall: w?.fall === null ? null : (w?.fall || C.fall) };
  }
  function falloff(w, d) {
    const W = w.fall === undefined ? normalize(w) : w; if (!W.fall) return 1;
    const [a, b, min] = W.fall, s = W.range * a, e = W.range * b; if (d <= s) return 1; if (d >= e) return min;
    return 1 - (1 - min) * ((d - s) / Math.max(1, e - s));
  }

  // ---------- damage ----------
  function armorSplit(armor, dmg, pen = 0, absorb = RULES.absorb) {
    const a = Math.max(0, armor || 0); if (!(a > 0) || !(dmg > 0)) return { hp: Math.max(0, dmg || 0), armor: 0, left: a };
    const soak = Math.min(a, dmg * absorb * (1 - Math.max(0, Math.min(1, pen))));
    return { hp: dmg - soak, armor: soak, left: a - soak };
  }
  // o = { weapon, dist, target: { armor, stance, aware }, mult }
  function resolve(o) {
    const w = o.weapon?.fall === undefined ? normalize(o.weapon) : o.weapon, t = o.target || {};
    if ((t.stance || 'stand') === 'roll') return { hp: 0, armor: 0, dodged: true, mult: 0 };
    let mult = falloff(w, o.dist || 0) * (STANCE[t.stance || 'stand'] ?? 1) * (o.mult || 1);
    if (t.aware === false && w.cls !== 'taser') mult *= RULES.sneak;
    const raw = w.dmg * mult, sp = armorSplit(t.armor || 0, raw, w.pen);
    return { hp: Math.round(sp.hp * 10) / 10, armor: Math.round(sp.armor * 10) / 10, armorLeft: sp.left, mult: Math.round(mult * 1000) / 1000, dodged: false };
  }
  // apply a resolved hit to a life-state record { hp, maxHp, armor, canDown, downed, dead }; returns the transition
  function apply(e, res, now) {
    if (!e || e.dead) return 'dead';
    e.armor = Math.max(0, (e.armor || 0) - (res.armor || 0));
    if (e.downed) { e.downed.until -= (res.hp || 0) * RULES.downedDmgMs; if (e.downed.until <= now) { e.downed = null; e.dead = true; e.hp = 0; return 'killed'; } return 'bleeding'; }
    e.hp = Math.max(0, (e.hp || 0) - (res.hp || 0));
    if (e.hp > 0) return 'hurt';
    if (e.canDown) { e.downed = { at: now, until: now + RULES.bleedMs }; return 'downed'; }
    e.dead = true; return 'killed';
  }
  const bleed = (e, now) => (e?.downed && now >= e.downed.until ? (e.downed = null, e.dead = true, e.hp = 0, 'killed') : null);
  function revive(e, now, hp = RULES.reviveHp) { if (!e?.downed || e.dead) return false; e.downed = null; e.hp = Math.min(e.maxHp || 100, hp); e.revivedAt = now; return true; }

  // ---------- teams ----------
  // mode: 'pve' (default: players + their crews are one side), 'crews' (crews vs crews, PvP between crews), 'ffa'
  function canDamage(a, b, mode = 'pve') {
    if (!a || !b || a === b || (a.id && a.id === b.id)) return false;
    if (mode === 'ffa') return true;
    const ta = a.team || 'none', tb = b.team || 'none';
    if (ta === tb && ta !== 'none') return false;
    if (mode === 'pve' && (ta === 'you' || ta === 'player') && (tb === 'you' || tb === 'player')) return false; // no friendly fire between players + crews
    return true;
  }

  // ---------- hit events (network schema) ----------
  const KINDS = ['bullet', 'melee', 'taser', 'blast', 'crash'];
  const RESULTS = ['hurt', 'downed', 'bleeding', 'killed', 'dodged', 'blocked'];
  function hitEvent(o) {
    return { seq: o.seq | 0, t: Math.round(o.t || 0), src: String(o.src || ''), dst: String(o.dst || ''), weapon: String(o.weapon || ''), kind: KINDS.includes(o.kind) ? o.kind : 'bullet',
      seed: (o.seed >>> 0) || 0, fx: Math.round(o.fx ?? o.from?.x ?? 0), fy: Math.round(o.fy ?? o.from?.y ?? 0), tx: Math.round(o.tx ?? o.to?.x ?? 0), ty: Math.round(o.ty ?? o.to?.y ?? 0),
      hp: Math.round((o.hp || 0) * 10) / 10, armor: Math.round((o.armor || 0) * 10) / 10, result: RESULTS.includes(o.result) ? o.result : 'hurt' };
  }
  const FIELDS = ['seq', 't', 'src', 'dst', 'weapon', 'kind', 'seed', 'fx', 'fy', 'tx', 'ty', 'hp', 'armor', 'result'];
  const pack = (ev) => FIELDS.map((k) => (k === 'kind' ? KINDS.indexOf(ev.kind) : k === 'result' ? RESULTS.indexOf(ev.result) : ev[k]));
  const unpack = (arr) => hitEvent(Object.fromEntries(FIELDS.map((k, i) => [k, k === 'kind' ? KINDS[arr[i]] : k === 'result' ? RESULTS[arr[i]] : arr[i]])));

  // ---------- server-side checks ----------
  // ctx = { now, shooter: { x, y, lastShotAt }, target: { x, y }, weapon, los }
  function validate(ev, ctx) {
    const w = ctx.weapon?.fall === undefined ? normalize(ctx.weapon) : ctx.weapon;
    if (Math.abs((ev.t || 0) - ctx.now) > RULES.skewMs + 2000) return { ok: false, reason: 'stale' };
    if (ctx.shooter && Math.hypot(ev.fx - ctx.shooter.x, ev.fy - ctx.shooter.y) > RULES.posTolerance) return { ok: false, reason: 'shooter-position' };
    const d = Math.hypot(ev.tx - ev.fx, ev.ty - ev.fy);
    const reach = ev.kind === 'melee' ? 60 : w.range * 1.1 + 20; if (d > reach) return { ok: false, reason: 'range' };
    if (ctx.target && Math.hypot(ev.tx - ctx.target.x, ev.ty - ctx.target.y) > RULES.posTolerance) return { ok: false, reason: 'target-position' };
    if (ctx.shooter?.lastShotAt && ev.t - ctx.shooter.lastShotAt < w.rate * RULES.rateGrace && ev.kind !== 'melee') return { ok: false, reason: 'rate' };
    if (ctx.los === false) return { ok: false, reason: 'los' };
    // damage claimed can't exceed what the rules allow at that distance (+ sneak)
    const cap = w.dmg * Math.max(1, RULES.sneak) * (w.pellets || 1) + 0.5; if ((ev.hp || 0) + (ev.armor || 0) > cap) return { ok: false, reason: 'damage' };
    return { ok: true };
  }
  // lag compensation: history = [{ t, x, y }] ascending; returns position at time t
  function rewind(history, t) {
    if (!history?.length) return null; if (t <= history[0].t) return { x: history[0].x, y: history[0].y };
    for (let i = 1; i < history.length; i++) { const a = history[i - 1], b = history[i]; if (t <= b.t) { const f = (t - a.t) / Math.max(1, b.t - a.t); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; } }
    const z = history[history.length - 1]; return { x: z.x, y: z.y };
  }

  const api = Object.freeze({ RULES, CLASS, STANCE, KINDS, RESULTS, rng, seedOf, spread, normalize, falloff, armorSplit, resolve, apply, bleed, revive, canDamage, hitEvent, pack, unpack, validate, rewind });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftCombatCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
