/* City events (Claude-owned). Pure and Node-testable; events.js runs them in game.
 * Every few minutes a timed event appears somewhere in the city (toast + tracker arrow + city guide):
 *  briefcase : reach it before time runs out -> cash (sometimes it's hot: +heat)
 *  truck     : a stalled armored truck; hold position next to it to crack it (police respond) -> big cash
 *  package   : pick up a package, then deliver it across town in a car before the timer -> cash
 *  sprint    : a pop-up checkpoint sprint; drive through all gates before the timer -> cash + Driving XP
 * Event points sit on road centre lines (NightshiftRoads XS/YS). */
(function (root) {
  'use strict';
  const XS = [440, 880, 1320, 1760], YS = [340, 680, 1020, 1360];
  const TYPES = {
    briefcase: { name: 'Dropped briefcase', icon: '💼', life: 150, xp: { luck: 60 } },
    truck: { name: 'Stalled armored truck', icon: '🚚', life: 180, hold: 12, xp: { shooting: 80, stealth: 80 } },
    package: { name: 'Mystery package', icon: '🎁', life: 150, deliver: 90, xp: { driving: 100 } },
    sprint: { name: 'Pop-up sprint', icon: '🏁', life: 150, gates: 3, xp: { driving: 120 } },
  };
  const GAP_MS = [150000, 240000]; // between events
  function rng(seed) {
    let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const roadPoint = (r) => (r() < 0.5 ? { x: XS[Math.floor(r() * 4)], y: Math.round(380 + r() * 940) } : { x: Math.round(480 + r() * 1240), y: YS[Math.floor(r() * 4)] });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // Builds an event near (but not on top of) the player. seed makes it reproducible in tests.
  function make(seed, player, rnd = rng(seed)) {
    const kinds = ['briefcase', 'briefcase', 'truck', 'package', 'sprint'];
    const type = kinds[Math.floor(rnd() * kinds.length)], T = TYPES[type];
    let at, tries = 0;
    do { at = roadPoint(rnd); tries++; } while (player && (dist(at, player) < 350 || dist(at, player) > 1300) && tries < 40);
    const ev = { id: String(seed), type, x: at.x, y: at.y, life: T.life, stage: 'open', progress: 0 };
    if (type === 'briefcase') { ev.pay = Math.round((300 + rnd() * 600) / 10) * 10; ev.hot = rnd() < 0.35; }
    if (type === 'truck') ev.pay = Math.round((1500 + rnd() * 1500) / 50) * 50;
    if (type === 'package') { let to, k = 0; do { to = roadPoint(rnd); k++; } while (dist(to, at) < 900 && k < 40); ev.to = to; ev.pay = Math.round((500 + dist(to, at) / 3) / 10) * 10; }
    if (type === 'sprint') {
      const gates = []; let cur = at;
      for (let i = 0; i < T.gates; i++) { let g, k = 0; do { g = roadPoint(rnd); k++; } while ((dist(g, cur) < 350 || dist(g, cur) > 800) && k < 60); gates.push(g); cur = g; }
      ev.gates = gates; ev.pay = 600; ev.limit = 28;
    }
    return ev;
  }
  const scale = (pay, rankIndex = 0) => Math.round(pay * (1 + 0.05 * Math.max(0, Math.min(7, rankIndex))));
  function clean(raw) {
    const s = { version: 1, done: 0, missed: 0, earned: 0, byType: {} };
    for (const k of ['done', 'missed', 'earned']) s[k] = Number.isSafeInteger(raw?.[k]) && raw[k] > 0 ? Math.min(1e10, raw[k]) : 0;
    for (const t of Object.keys(TYPES)) { const v = raw?.byType?.[t]; if (Number.isSafeInteger(v) && v > 0) s.byType[t] = Math.min(1e7, v); }
    return s;
  }

  // One simulation step. ctx: { dt (s), pos {x,y}, inCar }. Mutates ev; returns null or
  // { result: 'done'|'fail'|'expired'|'stage', pay?, msg }.
  const R = { briefcase: 60, truck: 90, pickup: 60, drop: 80, gate: 80, start: 70 };
  function target(ev) {
    if (ev.type === 'package' && ev.stage === 'carry') return ev.to;
    if (ev.type === 'sprint' && ev.stage === 'run') return ev.gates[ev.progress];
    return { x: ev.x, y: ev.y };
  }
  function step(ev, ctx) {
    const dt = Math.max(0, Math.min(1, Number(ctx?.dt) || 0)), pos = ctx?.pos, T = TYPES[ev.type];
    if (!pos || !T) return null;
    const d = dist(pos, target(ev));
    if (ev.stage === 'open' || (ev.type === 'truck' && ev.stage === 'crack')) {
      ev.life -= dt;
      if (ev.life <= 0) return { result: 'expired', msg: `${T.icon} ${T.name} is gone` };
    }
    if (ev.type === 'briefcase') return d < R.briefcase ? { result: 'done', pay: ev.pay, msg: ev.hot ? 'it was hot money — cops are curious' : 'finders keepers' } : null;
    if (ev.type === 'truck') {
      if (d < R.truck) {
        const first = ev.stage === 'open'; ev.stage = 'crack'; ev.progress = Math.min(T.hold, ev.progress + dt);
        if (ev.progress >= T.hold) return { result: 'done', pay: ev.pay, msg: 'truck cracked' };
        return first ? { result: 'stage', msg: 'Cracking the truck — stay close, the cops are coming' } : null;
      }
      if (ev.stage === 'crack') ev.progress = Math.max(0, ev.progress - dt * 0.5);
      return null;
    }
    if (ev.type === 'package') {
      if (ev.stage === 'open') { if (d < R.pickup) { ev.stage = 'carry'; ev.timer = T.deliver; return { result: 'stage', msg: `Package grabbed — deliver it in ${T.deliver}s` }; } return null; }
      ev.timer -= dt;
      if (d < R.drop) return { result: 'done', pay: ev.pay + Math.round(Math.max(0, ev.timer) * 5), msg: `delivered with ${Math.ceil(Math.max(0, ev.timer))}s left` };
      return ev.timer <= 0 ? { result: 'fail', msg: 'package delivery ran out of time' } : null;
    }
    if (ev.type === 'sprint') {
      if (ev.stage === 'open') { if (d < R.start && ctx.inCar) { ev.stage = 'run'; ev.timer = ev.limit; ev.progress = 0; return { result: 'stage', msg: `GO! ${ev.gates.length} gates in ${ev.limit}s` }; } return null; }
      ev.timer -= dt;
      if (!ctx.inCar) return { result: 'fail', msg: 'you left the car' };
      if (d < R.gate) { ev.progress++; if (ev.progress >= ev.gates.length) return { result: 'done', pay: ev.pay + Math.round(Math.max(0, ev.timer) * 25), msg: `sprint done with ${Math.max(0, ev.timer).toFixed(1)}s left` }; return { result: 'stage', msg: `Gate ${ev.progress}/${ev.gates.length}` }; }
      return ev.timer <= 0 ? { result: 'fail', msg: 'sprint ran out of time' } : null;
    }
    return null;
  }
  const nextGap = (r = Math.random) => GAP_MS[0] + Math.floor(r() * (GAP_MS[1] - GAP_MS[0]));

  const api = Object.freeze({ XS, YS, TYPES, GAP_MS, RADIUS: R, rng, roadPoint, make, scale, clean, step, target, nextGap });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftEventsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
