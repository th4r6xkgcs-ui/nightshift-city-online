/* Wanted levels (Claude-owned, pure data + rules; Node-testable). GTA-style escalation for crime.js police:
 *  ★1  one or two patrol cops on foot. They want to cuff you, not shoot you.
 *  ★2  more cops; they only shoot if you're armed and showing it (fired recently, or hurt a cop).
 *  ★3  they shoot on sight, but they miss a lot, especially if you keep moving or duck behind cover.
 *  ★4  SWAT: tougher, faster, better shots.   ★5  everything they've got.
 * Escaping: break line of sight, get outside the search circle (centred on where they last saw you), and an
 * evade timer drops you one star at a time. Hiding inside a building counts as being outside the circle.
 * Busted: at ★1-2, if a cop who can see you is right on top of you while you stand still (or you're badly hurt),
 * a BUSTED meter fills; break away and it drains.
 * API: NightshiftWantedData.{LEVELS, stars, level, canFire, aimError, evadeStep, bustStep} */
(function (root) {
  'use strict';
  const LEVELS = [
    null,
    { cops: 1, fire: 'never', cool: 0, dmg: 0, err: 0, speed: 70, hp: 50, swat: false, radius: 300, evade: 7000, spawnMin: 440, every: 7000 },
    { cops: 2, fire: 'armed', cool: 1800, dmg: 6, err: 0.22, speed: 76, hp: 60, swat: false, radius: 380, evade: 9000, spawnMin: 400, every: 6000 },
    { cops: 4, fire: 'always', cool: 1400, dmg: 8, err: 0.17, speed: 80, hp: 60, swat: false, radius: 460, evade: 11000, spawnMin: 360, every: 5000 },
    { cops: 6, fire: 'always', cool: 1100, dmg: 10, err: 0.13, speed: 86, hp: 90, swat: true, radius: 560, evade: 13000, spawnMin: 320, every: 4200 },
    { cops: 8, fire: 'always', cool: 900, dmg: 12, err: 0.1, speed: 92, hp: 110, swat: true, radius: 660, evade: 15000, spawnMin: 300, every: 3500 },
  ];
  const stars = (heat) => (!(heat > 0) ? 0 : Math.max(1, Math.min(5, Math.round(heat))));
  const level = (heat) => LEVELS[stars(heat)] || null;
  const canFire = (L, armed) => !!L && (L.fire === 'always' || (L.fire === 'armed' && !!armed));
  // Angular error (radians) for one police shot. Moving targets, distance and crouching behind something all help you.
  function aimError(L, o = {}) {
    if (!L) return 0;
    const r = Number.isFinite(o.rand) ? o.rand : Math.random();
    const spread = L.err * (1 + (o.moving ? 0.7 : 0) + Math.max(0, o.dist || 0) / 420) * (o.crouch ? 1.3 : 1);
    return (r * 2 - 1) * spread;
  }
  // Evade timer: returns { progress, drop } where drop means "lose one star now".
  function evadeStep(progress, o = {}) {
    const L = LEVELS[o.stars || 0]; if (!L) return { progress: 0, drop: false };
    if (o.seen) return { progress: 0, drop: false };
    const outside = o.interior || (o.dist || 0) > L.radius;
    const p = (progress || 0) + (Math.max(0, o.dt || 0) * 1000 * (outside ? 1 : 0.25)) / L.evade;
    return p >= 1 ? { progress: 0, drop: true } : { progress: p, drop: false };
  }
  // BUSTED meter (seconds). Returns { t, busted }.
  function bustStep(t, o = {}) {
    const close = o.seen && (o.near ?? Infinity) < 26 && (o.stars || 0) >= 1 && (o.stars || 0) <= 2 && !o.inCar;
    const pinned = close && (!o.moving || (o.hp ?? 100) < 30);
    const nt = pinned ? (t || 0) + (o.dt || 0) : Math.max(0, (t || 0) - (o.dt || 0) * 2);
    return { t: nt, busted: nt >= 1.6 };
  }
  const api = Object.freeze({ LEVELS, stars, level, canFire, aimError, evadeStep, bustStep });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NightshiftWantedData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
