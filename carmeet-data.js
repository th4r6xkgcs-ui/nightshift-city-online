/* Night car meet (Claude-owned). Pure and Node-testable; carmeet.js runs it in game.
 * Every night (21:00–03:00) car people gather at the Westside Courts. Roll up in a car you own, stop in the ring and
 * SHOW it: judges score the model, body kit, tuning, condition and paint. Five rivals show up each night; beat them
 * for cash and a trophy. Each of your cars can enter once per night, so a bigger, better garage wins more.
 * Car = { model, color, kit, tune: { engine, handling, armor }, condition }. */
(function (root) {
  'use strict';
  const RING = { x: 228, y: 520, r: 56 };
  const OPEN = { from: 21 * 60, to: 3 * 60 };
  const BASE = { COMPACT: 12, SEDAN: 16, VAN: 13 };
  const TIER_SCORE = { Work: 14, Street: 18, Muscle: 32, Sport: 34, Classic: 44, Exotic: 60, Super: 85, Hyper: 120 };
  const KIT_SCORE = { gt: 16, muscle: 18, rally: 15, lux: 24 };
  const PRIZES = [{ place: 1, cash: 2500, trophy: 'gold' }, { place: 2, cash: 1200, trophy: 'silver' }, { place: 3, cash: 600, trophy: 'bronze' }];
  const RIVAL_NAMES = ['Dee "Lowdown" Park', 'Marisol Vega', 'Kenji Tanaka', 'Big Rob', 'Tasha Quinn', 'Sergio "Smoke" Ruiz', 'Aya Nakamura', 'Duke', 'Priya Shah', 'Viktor Lenz', 'Coco Martel', 'Jules Bright'];
  const RIVAL_MODELS = [['brick', 3], ['ridgeback', 3], ['bulldog', 4], ['kestrel', 4], ['monarch', 3], ['velvet', 3], ['aurora', 2], ['vortex', 1], ['phantom', 0.4], ['mule', 2]];

  const catalog = () => root.NightshiftCarsData || (typeof require === 'function' ? (() => { try { return require('./cars-data.js'); } catch { return null; } })() : null);
  const isOpen = (minute) => { const m = ((minute % 1440) + 1440) % 1440; return m >= OPEN.from || m < OPEN.to; };
  // A "night" key that doesn't split at midnight: 21:00 on day N to 03:00 on day N+1 share a key.
  const nightKey = (day, minute) => (minute < OPEN.to ? day - 1 : day);
  const rngOf = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

  function score(car) {
    const C = catalog(), spec = C?.fromModel?.(car?.model);
    const base = spec ? TIER_SCORE[spec.tier] ?? 20 : BASE[car?.model] ?? 12;
    const kit = KIT_SCORE[car?.kit] || 0;
    const t = car?.tune || {}, tune = ((t.engine | 0) + (t.handling | 0) + (t.armor | 0)) * 5;
    const cond = Math.max(0, Math.min(100, Number.isFinite(car?.condition) ? car.condition : 100));
    const paint = spec && car.color && car.color !== spec.colors[0] ? 4 : 0;
    const flair = Math.max(0, Math.min(30, car?.flair | 0)); // visual build (carstyle-data.js)
    const raw = base + kit + tune + paint + flair;
    const total = Math.round(raw * (0.55 + 0.45 * cond / 100));
    return { total, parts: { model: base, kit, tune, paint, flair, condition: Math.round(0.55 * 100 + 0.45 * cond) } };
  }
  // Five rivals for a night: name, model, paint, score (deterministic per night).
  function rivals(key) {
    const C = catalog(), r = rngOf(key * 2654435761 + 11), out = [], used = new Set();
    const tot = RIVAL_MODELS.reduce((t, m) => t + m[1], 0);
    for (let i = 0; i < 5; i++) {
      let name; do { name = RIVAL_NAMES[Math.floor(r() * RIVAL_NAMES.length)]; } while (used.has(name)); used.add(name);
      let id = RIVAL_MODELS[0][0];
      for (let tries = 0; tries < 12; tries++) { let x = r() * tot; for (const [m, w] of RIVAL_MODELS) { if ((x -= w) <= 0) { id = m; break; } } if (!out.some((o) => o.id === id)) break; }
      const spec = C?.BY?.[id], color = spec ? spec.colors[Math.floor(r() * spec.colors.length)] : '#888888';
      const kit = r() < 0.45 ? ['gt', 'muscle', 'rally', 'lux'][Math.floor(r() * 4)] : null;
      const tune = { engine: Math.floor(r() * 4), handling: Math.floor(r() * 4), armor: Math.floor(r() * 2) };
      const s = score({ model: 'CX:' + id, color, kit, tune, condition: 80 + Math.floor(r() * 21) });
      out.push({ name, id, model: 'CX:' + id, color, kit, score: s.total });
    }
    return out.sort((a, b) => b.score - a.score);
  }
  function clean(raw) {
    const s = { version: 1, nights: {}, trophies: { gold: 0, silver: 0, bronze: 0 }, earned: 0, best: 0, shows: 0 };
    for (const [k, v] of Object.entries(raw?.nights || {})) { const n = Number(k); if (Number.isSafeInteger(n) && Array.isArray(v?.entered)) s.nights[k] = { entered: v.entered.filter((x) => typeof x === 'string').slice(0, 20) }; }
    const keys = Object.keys(s.nights).map(Number).sort((a, b) => b - a).slice(0, 3); for (const k of Object.keys(s.nights)) if (!keys.includes(Number(k))) delete s.nights[k];
    for (const k of ['gold', 'silver', 'bronze']) { const v = raw?.trophies?.[k]; if (Number.isSafeInteger(v) && v > 0) s.trophies[k] = v; }
    for (const k of ['earned', 'best', 'shows']) { const v = raw?.[k]; if (Number.isSafeInteger(v) && v > 0) s[k] = v; }
    return s;
  }
  // Enter one car. Returns placing among the night's rivals and the prize (paid into wallet).
  function show(s, wallet, key, carId, car) {
    const n = s.nights[key] || (s.nights[key] = { entered: [] });
    if (n.entered.includes(carId)) return { ok: false, reason: 'That car already showed tonight. Bring another one.' };
    const sc = score(car), field = rivals(key), place = 1 + field.filter((r) => r.score >= sc.total).length;
    n.entered.push(carId); s.shows += 1; s.best = Math.max(s.best, sc.total);
    const prize = PRIZES.find((p) => p.place === place) || null;
    if (prize) { wallet.cash += prize.cash; s.earned += prize.cash; s.trophies[prize.trophy] += 1; }
    for (const k of Object.keys(s.nights)) if (Number(k) < key - 2) delete s.nights[k];
    return { ok: true, place, prize, score: sc, field };
  }

  const api = Object.freeze({ RING, OPEN, BASE, TIER_SCORE, KIT_SCORE, PRIZES, isOpen, nightKey, score, rivals, clean, show });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftCarMeetData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
