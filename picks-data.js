/* Lockpicking + safecracking rules (Claude-owned). Pure and Node-testable; picks.js draws and runs them.
 * LOCK: a pick sweeps back and forth across each pin; tap while it's inside the pin's sweet spot to set it.
 *       Miss and the pin drops (that pin starts over) and the lock rattles; too many misses jams it.
 * SAFE: the dial spins; tap when the notch lines up with each number of the combination. A miss resets the
 *       current number and spins the dial the other way, faster.
 * Stealth widens sweet spots (skill mod 'stealth.heat' < 1 → wider), Luck adds a free miss. */
(function (root) {
  'use strict';
  const KINDS = {
    house: { kind: 'lock', pins: 3, speed: 1.25, zone: 0.2, misses: 3 },
    warehouse: { kind: 'lock', pins: 4, speed: 1.45, zone: 0.17, misses: 3 },
    stash: { kind: 'lock', pins: 4, speed: 1.55, zone: 0.16, misses: 3 },
    mansion: { kind: 'lock', pins: 5, speed: 1.7, zone: 0.14, misses: 3 },
    safe: { kind: 'safe', pins: 3, speed: 0.55, zone: 0.12, misses: 3 },
    gunsafe: { kind: 'safe', pins: 3, speed: 0.6, zone: 0.11, misses: 3 },
    store: { kind: 'lock', pins: 3, speed: 1.35, zone: 0.19, misses: 3 }, // v0.65: shop back doors
    alarm: { kind: 'lock', pins: 4, speed: 1.65, zone: 0.2, misses: 2 },  // v0.65: alarm keypad (fast, few misses)
  };
  const rngOf = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  // Build a puzzle. stealthMod: the 'stealth.heat' skill modifier (1 = untrained, lower = better); luck: 'luck.rare' (>=1).
  function make(type, seed = 1, stealthMod = 1, luck = 1) {
    const K = KINDS[type] || KINDS.house, r = rngOf(seed), widen = Math.max(1, Math.min(1.6, 1 / Math.max(0.4, stealthMod)));
    const targets = Array.from({ length: K.pins }, () => 0.15 + r() * 0.7);
    return { type, kind: K.kind, targets, zone: Math.min(0.32, K.zone * widen), speed: K.speed * (K.kind === 'safe' ? 1 : 1), maxMiss: K.misses + (luck > 1.15 ? 1 : 0), set: 0, misses: 0, dir: 1, pos: 0, done: false, ok: false };
  }
  // Position of the pick/dial at time t (seconds since this pin started): a triangle wave 0..1..0 for locks, a loop for safes.
  function posAt(p, t) {
    const s = p.speed * (1 + p.set * 0.12) * (1 + p.misses * 0.08);
    if (p.kind === 'safe') { const v = (t * s) % 1; return p.dir > 0 ? v : 1 - v; }
    const v = (t * s) % 2; return v < 1 ? v : 2 - v;
  }
  const near = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 1 - d); };
  // Tap at position pos. Returns { hit, done, ok }.
  function tap(p, pos) {
    if (p.done) return { hit: false, done: true, ok: p.ok };
    const tgt = p.targets[p.set], d = p.kind === 'safe' ? near(pos, tgt) : Math.abs(pos - tgt), hit = d <= p.zone / 2;
    if (hit) { p.set += 1; if (p.kind === 'safe') p.dir = -p.dir; if (p.set >= p.targets.length) { p.done = true; p.ok = true; } }
    else { p.misses += 1; if (p.kind === 'safe') p.dir = -p.dir; if (p.misses >= p.maxMiss) { p.done = true; p.ok = false; } }
    return { hit, done: p.done, ok: p.ok };
  }

  const api = Object.freeze({ KINDS, make, posAt, tap, rngOf });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftPicksData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
