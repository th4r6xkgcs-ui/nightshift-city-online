/* Drug lab (Claude-owned). Pure and Node-testable; lab.js runs it in game. Fictional game economy.
 * Labs sit next to the illegal properties (Weed Farm, Coke House) once you own them. Each lab cooks one
 * timed batch at a time from carried raw product (pocket weed/coke) plus cash for supplies.
 * Finished products go to the lab stash; sell them through VIP drops (jobs.js, best price) or to a fence (60%). */
(function (root) {
  'use strict';
  const LABS = [
    { id: 'farm', name: 'Grow-room lab', property: 'farm', dx: 70, dy: 0 },
    { id: 'house', name: 'Kitchen lab', property: 'house', dx: 70, dy: 0 },
  ];
  const PRODUCTS = {
    prerolls: { name: 'Pre-roll pack', icon: '🚬', value: 120 },
    gummies: { name: 'Gummy tin', icon: '🍬', value: 260 },
    bags: { name: 'Street bag', icon: '🧂', value: 110 },
    party: { name: 'Party pack', icon: '🎉', value: 520 },
  };
  const RECIPES = [
    { id: 'prerolls', lab: 'farm', input: { weed: 2 }, cash: 10, out: 1, seconds: 30, xp: { farming: 40, dealing: 10 } },
    { id: 'gummies', lab: 'farm', input: { weed: 3 }, cash: 40, out: 1, seconds: 60, xp: { farming: 70, dealing: 20 } },
    { id: 'bags', lab: 'house', input: { coke: 1 }, cash: 15, out: 2, seconds: 40, xp: { dealing: 50 } },
    { id: 'party', lab: 'house', input: { coke: 1, weed: 2 }, cash: 60, out: 1, seconds: 90, xp: { dealing: 90, farming: 30 } },
  ];
  const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
  const STASH_MAX = 60, FENCE = 0.6;

  function clean(raw, now = Date.now()) {
    const s = { version: 1, stash: {}, batches: {}, cooked: 0 };
    for (const [id, n] of Object.entries(raw?.stash || {})) if (PRODUCTS[id] && Number.isSafeInteger(n) && n > 0) s.stash[id] = Math.min(STASH_MAX, n);
    for (const lab of LABS) {
      const b = raw?.batches?.[lab.id];
      if (b && RECIPE[b.recipe] && RECIPE[b.recipe].lab === lab.id && Number.isFinite(b.until) && b.until > 0) s.batches[lab.id] = { recipe: b.recipe, until: Math.min(b.until, now + RECIPE[b.recipe].seconds * 1000) };
    }
    s.cooked = Number.isSafeInteger(raw?.cooked) && raw.cooked > 0 ? Math.min(1e7, raw.cooked) : 0;
    return s;
  }
  const stashCount = (s) => Object.values(s.stash).reduce((a, b) => a + b, 0);
  // Starts a batch: takes raw product from the pocket and cash from the wallet. speed < 1 = faster (Farming perk).
  function start(s, labId, recipeId, pocket, wallet, now = Date.now(), speed = 1) {
    const r = RECIPE[recipeId];
    if (!r || r.lab !== labId) return { ok: false, reason: 'This lab cannot make that' };
    if (s.batches[labId]) return { ok: false, reason: 'A batch is already cooking' };
    for (const [item, n] of Object.entries(r.input)) if (!((pocket[item] || 0) >= n)) return { ok: false, reason: `Need ${n} carried ${item}` };
    if (!(wallet.cash >= r.cash)) return { ok: false, reason: 'Not enough cash for supplies' };
    if (stashCount(s) + r.out > STASH_MAX) return { ok: false, reason: 'Stash full · sell some product first' };
    for (const [item, n] of Object.entries(r.input)) { pocket[item] -= n; if (!pocket[item]) delete pocket[item]; }
    wallet.cash -= r.cash;
    s.batches[labId] = { recipe: recipeId, until: now + Math.round(r.seconds * 1000 * Math.max(0.5, Math.min(1, speed))) };
    return { ok: true };
  }
  // Collects finished batches. Returns [{ lab, recipe, out }]. Yield bonus (Farming perk) can add +1.
  function collect(s, now = Date.now(), yieldMod = 1, rnd = Math.random) {
    const done = [];
    for (const [lab, b] of Object.entries(s.batches)) {
      if (now < b.until) continue;
      const r = RECIPE[b.recipe], extra = rnd() < Math.max(0, yieldMod - 1) ? 1 : 0;
      const n = Math.min(r.out + extra, STASH_MAX - stashCount(s));
      if (n > 0) s.stash[r.id] = (s.stash[r.id] || 0) + n;
      s.cooked += n; delete s.batches[lab];
      done.push({ lab, recipe: r.id, out: n });
    }
    return done;
  }
  function take(s, id, n) { if (!((s.stash[id] || 0) >= n) || n < 1) return false; s.stash[id] -= n; if (!s.stash[id]) delete s.stash[id]; return true; }
  // Best-value product the player can fill an order of n units with.
  function bestFor(s, n) {
    return Object.keys(s.stash).filter((id) => s.stash[id] >= n).sort((a, b) => PRODUCTS[b].value - PRODUCTS[a].value)[0] || null;
  }
  function fenceAll(s, priceMod = 1) {
    let cash = 0, n = 0;
    for (const [id, k] of Object.entries(s.stash)) { cash += Math.round(PRODUCTS[id].value * FENCE * priceMod) * k; n += k; }
    s.stash = {};
    return { cash, n };
  }

  const api = Object.freeze({ LABS, PRODUCTS, RECIPES, RECIPE, STASH_MAX, FENCE, clean, stashCount, start, collect, take, bestFor, fenceAll });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftLabData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
