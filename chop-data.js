/* Rusty's Chop Shop rules (Claude-owned). Pure and Node-testable; chop.js runs them in game.
 * Steal a car (hold USE next to a locked one), drive it into the bay behind the scrapyard, hop out and pick:
 *   CHOP    — cash, more for clean cars and much more for whatever is on Rusty's hot list;
 *   STRIP   — a pile of crafting parts (metal, springs, pipe, headlight lenses) plus a little cash;
 *   RE-VIN  — pay to file off the numbers and keep it as your own car.
 * Rusty's lift only takes a few cars per window so this can't be farmed forever. */
(function (root) {
  'use strict';
  const MODELS = { COMPACT: 600, SEDAN: 800, VAN: 700 };
  const FAMILIES = ['red', 'blue', 'green', 'yellow', 'white', 'black'];
  const LIFT = { cars: 3, windowMs: 15 * 60 * 1000 };
  const HOT_WINDOW = 30 * 60 * 1000;
  const REVIN_MULT = 0.6; // cheaper than buying a car legit ($900) — you pay for it in risk and heat

  // Colour family of a #rrggbb paint job.
  function family(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return 'black';
    const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.12) return l > 0.6 ? 'white' : 'black';
    let h; if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60;
    if (h < 22 || h >= 330) return 'red';
    if (h < 70) return 'yellow';
    if (h < 165) return 'green';
    if (h < 265) return 'blue';
    return 'red';
  }
  // Rusty's hot list for a 30-minute window: one model, one paint family.
  function hotList(now = Date.now()) {
    const k = Math.floor(now / HOT_WINDOW), names = Object.keys(MODELS);
    return { model: names[(k * 7 + 1) % names.length], color: FAMILIES[(k * 5 + 2) % FAMILIES.length], until: (k + 1) * HOT_WINDOW };
  }
  function hotMult(model, color, now = Date.now()) {
    const h = hotList(now), mOk = h.model === model, cOk = h.color === family(color);
    return mOk && cOk ? 2 : mOk ? 1.35 : cOk ? 1.15 : 1;
  }
  function value(model, condition, color, now = Date.now(), priceMod = 1) {
    const base = MODELS[model] ?? 500, c = Math.max(0, Math.min(100, Number(condition) || 0));
    return Math.round(base * (0.35 + 0.65 * c / 100) * hotMult(model, color, now) * priceMod);
  }
  // Parts from stripping a car (deterministic from a seed so tests can check it).
  function strip(model, condition, seed = 1) {
    let s = (seed >>> 0) || 1; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const c = Math.max(0, Math.min(100, Number(condition) || 0)) / 100, big = model === 'VAN' ? 1.3 : model === 'SEDAN' ? 1.1 : 1;
    const out = { metal: Math.round((6 + r() * 4) * big), spring: 1 + Math.round(r() * 2 * (0.5 + c)), pipe: 1 + Math.round(r() * 2 * big) };
    if (r() < 0.35 + 0.4 * c) out.lens = 1;
    if (r() < 0.25) out.tape = 2;
    return out;
  }
  function clean(raw, now = Date.now()) {
    const s = { version: 1, lift: [], stats: { chopped: 0, stripped: 0, revin: 0, earned: 0, hot: 0 } };
    for (const t of Array.isArray(raw?.lift) ? raw.lift : []) if (Number.isFinite(t) && t <= now && now - t < LIFT.windowMs) s.lift.push(t);
    s.lift = s.lift.slice(-LIFT.cars);
    for (const k of Object.keys(s.stats)) { const v = raw?.stats?.[k]; if (Number.isSafeInteger(v) && v > 0) s.stats[k] = v; }
    return s;
  }
  const liftFree = (s, now = Date.now()) => s.lift.filter((t) => now - t < LIFT.windowMs).length < LIFT.cars;
  const liftWait = (s, now = Date.now()) => { const live = s.lift.filter((t) => now - t < LIFT.windowMs).sort((a, b) => a - b); return live.length < LIFT.cars ? 0 : live[0] + LIFT.windowMs - now; };
  // Resolve one deal. car = { model, condition, color, stolen }. Returns what the player gets.
  function deal(s, wallet, car, kind, now = Date.now(), priceMod = 1, seed = 1) {
    if (!car || !car.stolen) return { ok: false, reason: 'Rusty only takes hot cars. Steal one first.' };
    if (kind !== 'revin' && !liftFree(s, now)) return { ok: false, reason: `Lift's full. Back in ${Math.ceil(liftWait(s, now) / 60000)} min` };
    const v = value(car.model, car.condition, car.color, now, priceMod), hot = hotMult(car.model, car.color, now) >= 1.35;
    if (kind === 'chop') { wallet.cash += v; s.lift.push(now); s.stats.chopped += 1; s.stats.earned += v; if (hot) s.stats.hot += 1; return { ok: true, cash: v, items: {}, hot }; }
    if (kind === 'strip') { const cash = Math.round(v * 0.3), items = strip(car.model, car.condition, seed); wallet.cash += cash; s.lift.push(now); s.stats.stripped += 1; s.stats.earned += cash; return { ok: true, cash, items, hot }; }
    if (kind === 'revin') { const price = Math.round((MODELS[car.model] ?? 500) * REVIN_MULT); if (!(wallet.cash >= price)) return { ok: false, reason: `Re-VIN costs $${price.toLocaleString()}` }; wallet.cash -= price; s.stats.revin += 1; return { ok: true, cash: -price, items: {}, keep: true }; }
    return { ok: false, reason: 'Unknown deal' };
  }
  const revinPrice = (model) => Math.round((MODELS[model] ?? 500) * REVIN_MULT);

  const api = Object.freeze({ MODELS, FAMILIES, LIFT, HOT_WINDOW, REVIN_MULT, family, hotList, hotMult, value, strip, clean, liftFree, liftWait, deal, revinPrice });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftChopData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
