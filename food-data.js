/* Farming + food (Claude-owned). Pure and Node-testable; farm.js (countryside zone) and food.js (cooking, eating,
 * buffs, the Diner buyer) run it in game. Produce and meals are items in the supply backpack (supply-data.js).
 *
 * Loop: lease plots at the Harlow co-op → plant (pay for seed) → water (grows ~35% faster) → harvest into your bag.
 * Hens and cows produce eggs/milk over time but eat from a feed trough (wheat for hens, corn for cows).
 * Wheat is milled into flour at the windmill. Cook at the farmhouse kitchen or your apartment kitchen.
 * Meals give timed buffs, or sell at the Diner in the city for far more than their ingredients. */
(function (root) {
  'use strict';
  const CROPS = [
    { id: 'wheat', name: 'Wheat', icon: '🌾', seed: 4, minutes: 3, yield: [4, 6], sell: 5, level: 1, color: '#e3c25a' },
    { id: 'potato', name: 'Potatoes', icon: '🥔', seed: 8, minutes: 5, yield: [3, 5], sell: 9, level: 1, color: '#b98a52' },
    { id: 'tomato', name: 'Tomatoes', icon: '🍅', seed: 12, minutes: 6, yield: [3, 5], sell: 13, level: 2, color: '#e0473a' },
    { id: 'corn', name: 'Corn', icon: '🌽', seed: 10, minutes: 7, yield: [3, 4], sell: 14, level: 2, color: '#f2d24a' },
    { id: 'chili', name: 'Chili peppers', icon: '🌶️', seed: 18, minutes: 8, yield: [3, 5], sell: 18, level: 4, color: '#d8261e' },
    { id: 'strawberry', name: 'Strawberries', icon: '🍓', seed: 20, minutes: 9, yield: [4, 6], sell: 16, level: 4, color: '#ff3d5a' },
    { id: 'pumpkin', name: 'Pumpkin', icon: '🎃', seed: 40, minutes: 14, yield: [1, 2], sell: 70, level: 6, color: '#f08a1e' },
  ];
  const CROP = Object.fromEntries(CROPS.map((c) => [c.id, c]));
  const WATER_SPEED = 0.65; // a watered plot grows in 65% of the time
  const PLOTS_MAX = 16, PLOTS_FREE = 0, LEASE = (n) => (n < 4 ? 150 : n < 8 ? 300 : n < 12 ? 600 : 1000); // price of the next plot
  // Animals: each produces 1 item per `every` minutes up to `cap` waiting, eating 1 `feed` per `perFeed` items.
  const ANIMALS = {
    hen: { name: 'Hen', icon: '🐔', price: 180, max: 8, every: 8, cap: 3, item: 'egg', feed: 'wheat', perFeed: 2 },
    cow: { name: 'Cow', icon: '🐄', price: 1400, max: 4, every: 12, cap: 3, item: 'milk', feed: 'corn', perFeed: 1 },
  };
  // Prices the co-op pays (produce); meals sell at the Diner.
  const COOP_BUYS = { wheat: 5, potato: 9, tomato: 13, corn: 14, chili: 18, strawberry: 16, pumpkin: 70, apple: 9, egg: 6, milk: 14, flour: 20 };
  const BUFFS = {
    speed: { name: 'Fast feet', icon: '👟', mods: { 'athletics.speed': 1.2 }, desc: '+20% run speed' },
    regen: { name: 'Warm belly', icon: '💗', regen: 2.5, desc: '+2.5 HP/s regeneration' },
    xp: { name: 'Well fed', icon: '✨', xp: 1.15, desc: '+15% XP' },
    xp2: { name: 'Feast', icon: '🌟', xp: 1.3, desc: '+30% XP' },
    damage: { name: 'Fired up', icon: '🔥', mods: { 'shooting.damage': 1.15 }, desc: '+15% gun damage' },
    stamina: { name: 'Sugar rush', icon: '⚡', mods: { 'athletics.stamina': 1.4 }, desc: '+40% sprint stamina' },
    calm: { name: 'Comfort food', icon: '😌', mods: { 'stealth.heat': 0.65 }, desc: '-35% heat gained' },
    tough: { name: 'Hearty', icon: '🛡️', mods: { 'toughness.damageTaken': 0.85 }, desc: '-15% damage taken' },
    focus: { name: 'Focused', icon: '🎯', mods: { 'crafting.speed': 0.7 }, desc: '+30% crafting speed' },
  };
  const RECIPES = [
    { id: 'burrito', in: { egg: 2, potato: 1, chili: 1 }, out: 1, seconds: 8, buff: 'speed', minutes: 6, sell: 75, level: 1 },
    { id: 'soup', in: { tomato: 3, potato: 1 }, out: 2, seconds: 8, buff: 'regen', minutes: 6, sell: 48, level: 1 },
    { id: 'shake', in: { strawberry: 3, milk: 1 }, out: 1, seconds: 6, buff: 'stamina', minutes: 6, sell: 95, level: 2 },
    { id: 'energybar', in: { wheat: 2, strawberry: 1, apple: 1 }, out: 2, seconds: 6, buff: 'focus', minutes: 8, sell: 38, level: 2 },
    { id: 'cornbread', in: { corn: 2, flour: 1, egg: 1, milk: 1 }, out: 2, seconds: 10, buff: 'xp', minutes: 8, sell: 62, level: 3 },
    { id: 'breakfast', in: { egg: 2, potato: 1, milk: 1, flour: 1 }, out: 1, seconds: 10, buff: 'tough', minutes: 6, heal: 60, sell: 85, level: 3 },
    { id: 'wings', in: { chili: 3, egg: 1, flour: 1 }, out: 1, seconds: 10, buff: 'damage', minutes: 5, sell: 130, level: 4 },
    { id: 'applepie', in: { apple: 3, flour: 1, egg: 1 }, out: 1, seconds: 12, buff: 'calm', minutes: 8, sell: 90, level: 4 },
    { id: 'pumpkinpie', in: { pumpkin: 1, flour: 1, egg: 1, milk: 1 }, out: 2, seconds: 14, buff: 'xp2', minutes: 10, sell: 160, level: 6 },
  ];
  const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
  const DINER = { demand: 10, refill: 600 }; // meals the Diner takes per refill window (seconds)

  const int = (v, max, d = 0) => (Number.isSafeInteger(v) && v >= 0 ? Math.min(max, v) : d);
  function clean(raw, now = Date.now()) {
    const s = { version: 1, plots: [], animals: {}, buffs: {}, cooked: 0, harvested: 0, sold: 0, diner: { sold: 0, at: now }, earned: 0 };
    const n = int(raw?.plots?.length, PLOTS_MAX, PLOTS_FREE);
    for (let i = 0; i < n; i++) {
      const r = raw.plots[i] || {}, crop = CROP[r.crop] ? r.crop : null;
      s.plots.push({ crop, at: crop && Number.isFinite(r.at) && r.at <= now ? r.at : crop ? now : 0, watered: crop ? r.watered === true : false });
    }
    for (const [id, A] of Object.entries(ANIMALS)) {
      const r = raw?.animals?.[id];
      s.animals[id] = { n: int(r?.n, A.max), feed: int(r?.feed, 99), ready: int(r?.ready, A.cap * A.max), at: Number.isFinite(r?.at) && r.at <= now ? r.at : now, owed: Number.isFinite(r?.owed) ? Math.max(0, Math.min(A.perFeed, r.owed)) : 0 };
    }
    for (const [id, until] of Object.entries(raw?.buffs || {})) if (BUFFS[id] && Number.isFinite(until) && until > now) s.buffs[id] = Math.min(until, now + 30 * 60000);
    for (const k of ['cooked', 'harvested', 'sold', 'earned']) s[k] = int(raw?.[k], 1e12);
    s.diner = { sold: int(raw?.diner?.sold, DINER.demand), at: Number.isFinite(raw?.diner?.at) && raw.diner.at <= now ? raw.diner.at : now };
    return s;
  }

  // ---- plots ----
  const growMs = (crop, watered, speed = 1) => CROP[crop].minutes * 60000 * (watered ? WATER_SPEED : 1) * speed;
  // 0 empty | 1-3 growing stages | 4 ripe
  function stage(plot, now = Date.now(), speed = 1) {
    if (!plot?.crop) return 0;
    const f = (now - plot.at) / growMs(plot.crop, plot.watered, speed);
    return f >= 1 ? 4 : f >= 0.66 ? 3 : f >= 0.33 ? 2 : 1;
  }
  const progress = (plot, now = Date.now(), speed = 1) => (plot?.crop ? Math.min(1, (now - plot.at) / growMs(plot.crop, plot.watered, speed)) : 0);
  function lease(s, wallet) {
    if (s.plots.length >= PLOTS_MAX) return { ok: false, reason: 'All plots are yours' };
    const price = LEASE(s.plots.length);
    if (!(wallet.cash >= price)) return { ok: false, reason: `Next plot costs $${price}` };
    wallet.cash -= price; s.plots.push({ crop: null, at: 0, watered: false });
    return { ok: true, price, n: s.plots.length };
  }
  function plant(s, i, cropId, wallet, farmingLevel = 1, now = Date.now()) {
    const p = s.plots[i], c = CROP[cropId];
    if (!p) return { ok: false, reason: 'Lease this plot at the co-op first' };
    if (!c) return { ok: false, reason: 'Unknown seed' };
    if (p.crop) return { ok: false, reason: 'Something is already growing here' };
    if (!(farmingLevel >= c.level)) return { ok: false, reason: `Needs Farming level ${c.level}` };
    if (!(wallet.cash >= c.seed)) return { ok: false, reason: `Seeds cost $${c.seed}` };
    wallet.cash -= c.seed; p.crop = cropId; p.at = now; p.watered = false;
    return { ok: true, crop: c };
  }
  // Watering keeps progress so far and speeds up the rest.
  function water(s, i, now = Date.now(), speed = 1) {
    const p = s.plots[i];
    if (!p?.crop) return { ok: false, reason: 'Nothing planted' };
    if (p.watered) return { ok: false, reason: 'Already watered' };
    if (stage(p, now, speed) >= 4) return { ok: false, reason: 'Ready to harvest' };
    const f = progress(p, now, speed);
    p.watered = true; p.at = now - f * growMs(p.crop, true, speed);
    return { ok: true };
  }
  // give(items) adds to the bag and returns { added, lost }.
  function harvest(s, i, give, { now = Date.now(), speed = 1, rnd = Math.random, yieldMul = 1 } = {}) {
    const p = s.plots[i];
    if (!p?.crop) return { ok: false, reason: 'Nothing planted' };
    if (stage(p, now, speed) < 4) return { ok: false, reason: `Still growing · ${Math.ceil((1 - progress(p, now, speed)) * growMs(p.crop, p.watered, speed) / 1000)}s left` };
    const c = CROP[p.crop], [a, b] = c.yield, n = Math.max(1, Math.round((a + Math.floor(rnd() * (b - a + 1))) * yieldMul));
    const r = give({ [c.id]: n });
    if (!r.added[c.id]) return { ok: false, reason: 'Backpack full' };
    p.crop = null; p.at = 0; p.watered = false; s.harvested += r.added[c.id];
    return { ok: true, n: r.added[c.id], lost: r.lost[c.id] || 0, crop: c };
  }

  // ---- animals ----
  function tickAnimals(s, now = Date.now()) {
    for (const [id, A] of Object.entries(ANIMALS)) {
      const a = s.animals[id];
      if (!a.n) { a.at = now; continue; }
      const per = (A.every * 60000) / a.n; // the herd lays/milks in parallel
      let k = Math.floor((now - a.at) / per);
      while (k > 0 && a.ready < A.cap * a.n) {
        if (a.owed <= 0) { if (a.feed <= 0) break; a.feed -= 1; a.owed = A.perFeed; }
        a.owed -= 1; a.ready += 1; k -= 1; a.at += per;
      }
      if (k > 0) a.at = now; // full or hungry: production waits
    }
  }
  function buyAnimal(s, id, wallet) {
    const A = ANIMALS[id], a = s.animals[id];
    if (!A) return { ok: false, reason: 'Unknown animal' };
    if (a.n >= A.max) return { ok: false, reason: `Room for ${A.max} at most` };
    if (!(wallet.cash >= A.price)) return { ok: false, reason: `A ${A.name.toLowerCase()} costs $${A.price}` };
    wallet.cash -= A.price; a.n += 1; return { ok: true };
  }
  function feed(s, id, bag, n) {
    const A = ANIMALS[id], a = s.animals[id];
    const k = Math.min(n, bag[A.feed] || 0, 99 - a.feed);
    if (k <= 0) return { ok: false, reason: `No ${A.feed} to feed them` };
    bag[A.feed] -= k; if (!bag[A.feed]) delete bag[A.feed]; a.feed += k;
    return { ok: true, n: k };
  }
  function collect(s, id, give, now = Date.now()) {
    tickAnimals(s, now);
    const A = ANIMALS[id], a = s.animals[id];
    if (!a.ready) return { ok: false, reason: a.feed > 0 || a.owed > 0 ? 'Nothing yet' : `Nothing yet · the trough is empty (add ${A.feed})` };
    const r = give({ [A.item]: a.ready });
    const got = r.added[A.item] || 0;
    if (!got) return { ok: false, reason: 'Backpack full' };
    a.ready -= got; return { ok: true, n: got, item: A.item };
  }

  // ---- cooking / eating / selling ----
  const canCook = (have, id) => { const r = RECIPE[id]; return !!r && Object.entries(r.in).every(([k, n]) => (have[k] || 0) >= n); };
  function eat(s, id, now = Date.now()) {
    const r = RECIPE[id];
    if (!r) return { ok: false, reason: 'Not food' };
    s.buffs[r.buff] = Math.max(s.buffs[r.buff] || 0, now) + r.minutes * 60000;
    if (s.buffs[r.buff] > now + 30 * 60000) s.buffs[r.buff] = now + 30 * 60000;
    return { ok: true, buff: BUFFS[r.buff], heal: r.heal || 0, until: s.buffs[r.buff] };
  }
  function active(s, now = Date.now()) { const out = {}; for (const [id, u] of Object.entries(s.buffs)) if (u > now) out[id] = u; else delete s.buffs[id]; return out; }
  // Product of buff multipliers for a skill-mod key.
  function modMul(s, key, now = Date.now()) { let m = 1; for (const id of Object.keys(active(s, now))) { const b = BUFFS[id]; if (b.mods?.[key]) m *= b.mods[key]; } return m; }
  function xpMul(s, now = Date.now()) { let m = 1; for (const id of Object.keys(active(s, now))) if (BUFFS[id].xp) m = Math.max(m, BUFFS[id].xp); return m; }
  function regen(s, now = Date.now()) { let r = 0; for (const id of Object.keys(active(s, now))) r += BUFFS[id].regen || 0; return r; }
  function dinerLeft(s, now = Date.now()) { if (now - s.diner.at >= DINER.refill * 1000) { s.diner = { sold: 0, at: now }; } return DINER.demand - s.diner.sold; }
  function sellMeal(s, id, bag, wallet, n = 1, { now = Date.now(), price = 1 } = {}) {
    const r = RECIPE[id];
    if (!r) return { ok: false, reason: 'The Diner only buys cooked meals' };
    const k = Math.min(n, bag[id] || 0, dinerLeft(s, now));
    if (!(bag[id] > 0)) return { ok: false, reason: 'None to sell' };
    if (k <= 0) return { ok: false, reason: 'The Diner is stocked up. Come back later.' };
    const cash = Math.round(k * r.sell * price);
    bag[id] -= k; if (!bag[id]) delete bag[id]; wallet.cash += cash; s.diner.sold += k; s.sold += k; s.earned += cash;
    return { ok: true, n: k, cash };
  }
  function sellProduce(s, id, bag, wallet, n = 1, price = 1) {
    const p = COOP_BUYS[id];
    if (!p) return { ok: false, reason: 'The co-op doesn\'t buy that' };
    const k = Math.min(n, bag[id] || 0);
    if (k <= 0) return { ok: false, reason: 'None to sell' };
    const cash = Math.round(k * p * price);
    bag[id] -= k; if (!bag[id]) delete bag[id]; wallet.cash += cash; s.earned += cash;
    return { ok: true, n: k, cash };
  }

  const api = Object.freeze({ CROPS, CROP, WATER_SPEED, PLOTS_MAX, LEASE, ANIMALS, COOP_BUYS, BUFFS, RECIPES, RECIPE, DINER, clean, growMs, stage, progress, lease, plant, water, harvest,
    tickAnimals, buyAnimal, feed, collect, canCook, eat, active, modMul, xpMul, regen, dinerLeft, sellMeal, sellProduce });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftFoodData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
