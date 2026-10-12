/* Dream house decor (Claude-owned). Pure and Node-testable; dreamhome.js draws and runs it.
 * Every room has slots; each slot takes one item from its category. Buy an item once, then swap it in and out
 * for free. Each item has a Style value; total Style sets your house tier, and a nicer place makes clients trust
 * you (+2% sale prices per tier). Some pieces need loot instead of cash (hang the painting you stole).
 * The garage shows off up to four of your cars; its Garage score counts the cars, their kits and the garage decor. */
(function (root) {
  'use strict';
  const SLOTS = [
    { id: 'sofa', room: 'Living room', name: 'Sofa', x: 330, y: 318 },
    { id: 'tv', room: 'Living room', name: 'Screen', x: 330, y: 40 },
    { id: 'rug', room: 'Living room', name: 'Rug', x: 330, y: 196, flat: true },
    { id: 'art', room: 'Living room', name: 'Wall art', x: 130, y: 30 },
    { id: 'plant', room: 'Living room', name: 'Plant', x: 590, y: 372 },
    { id: 'aquarium', room: 'Living room', name: 'Aquarium', x: 610, y: 96 },
    { id: 'bar', room: 'Kitchen & bar', name: 'Bar', x: 930, y: 56 },
    { id: 'game', room: 'Kitchen & bar', name: 'Game corner', x: 900, y: 290 },
    { id: 'music', room: 'Kitchen & bar', name: 'Music', x: 1130, y: 300 },
    { id: 'bed', room: 'Bedroom', name: 'Bed', x: 220, y: 580 },
    { id: 'lamp', room: 'Bedroom', name: 'Lighting', x: 400, y: 500 },
    { id: 'petbed', room: 'Bedroom', name: 'Pet bed', x: 90, y: 760 },
    { id: 'gfloor', room: 'Garage', name: 'Garage floor', x: 830, y: 780, flat: true },
    { id: 'gwall', room: 'Garage', name: 'Garage wall', x: 830, y: 452 },
    { id: 'lift', room: 'Garage', name: 'Car lift', x: 1130, y: 640 },
  ];
  const SLOT = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
  // [id, slot, name, price, style, extra]. The first item of every slot is the free default.
  const RAW = [
    ['sofa-thrift', 'sofa', 'Thrift-store couch', 0, 0], ['sofa-leather', 'sofa', 'Leather sectional', 4000, 8], ['sofa-chesterfield', 'sofa', 'Velvet chesterfield', 9000, 15], ['sofa-cloud', 'sofa', 'Designer cloud sofa', 18000, 25],
    ['tv-none', 'tv', 'Bare wall', 0, 0], ['tv-flat', 'tv', '55" flatscreen', 2500, 5], ['tv-cinema', 'tv', 'Home cinema wall', 12000, 14],
    ['rug-none', 'rug', 'Bare floor', 0, 0], ['rug-persian', 'rug', 'Persian rug', 1500, 4], ['rug-tiger', 'rug', 'Tiger-stripe rug', 3000, 6], ['rug-gold', 'rug', 'Black & gold rug', 7000, 10],
    ['art-none', 'art', 'Blank wall', 0, 0], ['art-skyline', 'art', 'City skyline print', 800, 2], ['art-neon', 'art', 'Neon "NIGHTSHIFT" sign', 3500, 8], ['art-master', 'art', 'Stolen masterpiece', 2000, 18, { loot: { art: 1 } }],
    ['plant-none', 'plant', 'Empty corner', 0, 0], ['plant-monstera', 'plant', 'Monstera', 300, 1], ['plant-bonsai', 'plant', 'Bonsai on a plinth', 1200, 3], ['plant-palm', 'plant', 'Palm in a brass pot', 2000, 4],
    ['aqua-none', 'aquarium', 'Empty wall', 0, 0], ['aqua-bowl', 'aquarium', 'Goldfish bowl', 400, 1], ['aqua-reef', 'aquarium', 'Reef tank', 6000, 10], ['aqua-shark', 'aquarium', 'Shark tank', 25000, 22],
    ['bar-counter', 'bar', 'Plain counter', 0, 0], ['bar-home', 'bar', 'Home bar & stools', 6000, 9], ['bar-gold', 'bar', 'Gold whiskey bar', 15000, 16],
    ['game-none', 'game', 'Empty corner', 0, 0], ['game-cards', 'game', 'Card table', 1000, 2], ['game-pool', 'game', 'Pool table', 5000, 8], ['game-arcade', 'game', 'Arcade row', 9000, 12],
    ['music-none', 'music', 'Silence', 0, 0], ['music-jukebox', 'music', 'Jukebox', 2500, 5], ['music-decks', 'music', 'DJ decks', 6000, 8], ['music-piano', 'music', 'Grand piano', 14000, 14],
    ['bed-mattress', 'bed', 'Mattress on the floor', 0, 0], ['bed-king', 'bed', 'King bed', 4000, 6], ['bed-round', 'bed', 'Round silk bed', 11000, 13],
    ['lamp-none', 'lamp', 'Ceiling bulb', 0, 0], ['lamp-floor', 'lamp', 'Arc floor lamp', 500, 1], ['lamp-lava', 'lamp', 'Lava lamps', 1500, 3], ['lamp-flamingo', 'lamp', 'Neon flamingo', 4000, 6],
    ['pet-none', 'petbed', 'Old towel', 0, 0], ['pet-cushion', 'petbed', 'Pet cushion', 200, 1], ['pet-palace', 'petbed', 'Pet palace', 3000, 5],
    ['gfloor-concrete', 'gfloor', 'Bare concrete', 0, 0], ['gfloor-checker', 'gfloor', 'Checker epoxy', 3000, 5], ['gfloor-mirror', 'gfloor', 'Black mirror epoxy', 8000, 10],
    ['gwall-bare', 'gwall', 'Bare wall', 0, 0], ['gwall-peg', 'gwall', 'Tool pegboard', 500, 1], ['gwall-tires', 'gwall', 'Neon tyre wall', 4000, 6], ['gwall-trophy', 'gwall', 'Trophy wall', 9000, 11],
    ['lift-none', 'lift', 'Empty bay', 0, 0], ['lift-post', 'lift', 'Two-post car lift', 7000, 7],
  ];
  const ITEMS = RAW.map(([id, slot, name, price, style, extra]) => ({ id, slot, name, price, style, ...(extra || {}) }));
  const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
  const DEFAULTS = Object.fromEntries(SLOTS.map((s) => [s.id, ITEMS.find((i) => i.slot === s.id).id]));
  const TIERS = [{ name: 'Bare', at: 0 }, { name: 'Cozy', at: 20 }, { name: 'Stylish', at: 50 }, { name: 'Luxury', at: 100 }, { name: 'Iconic', at: 160 }];
  const PER_TIER = 0.02;
  const KIT_SCORE = { gt: 15, muscle: 18, rally: 14, lux: 25 };
  const MODEL_SCORE = { COMPACT: 8, SEDAN: 12, VAN: 10 };
  const SLEEP_COOLDOWN = 10 * 60 * 1000;

  function clean(raw) {
    const s = { version: 1, owned: [], placed: { ...DEFAULTS }, sleptAt: 0 };
    for (const id of Array.isArray(raw?.owned) ? raw.owned : []) if (ITEM[id] && ITEM[id].price + (ITEM[id].loot ? 1 : 0) > 0 && !s.owned.includes(id)) s.owned.push(id);
    for (const [slot, id] of Object.entries(raw?.placed || {})) if (SLOT[slot] && ITEM[id]?.slot === slot && (ITEM[id].price === 0 && !ITEM[id].loot ? true : s.owned.includes(id))) s.placed[slot] = id;
    s.sleptAt = Number.isFinite(raw?.sleptAt) && raw.sleptAt > 0 ? raw.sleptAt : 0;
    return s;
  }
  const owns = (s, id) => !!ITEM[id] && ((ITEM[id].price === 0 && !ITEM[id].loot) || s.owned.includes(id));
  // Buy (if needed) and place. bag/has/take let the caller pay loot from the backpack.
  function place(s, wallet, id, bag) {
    const it = ITEM[id];
    if (!it) return { ok: false, reason: 'Unknown item' };
    if (!owns(s, id)) {
      if (!(wallet.cash >= it.price)) return { ok: false, reason: `Needs ${'$' + it.price.toLocaleString()}` };
      if (it.loot) { if (!bag || !bag.has(it.loot)) return { ok: false, reason: `Needs ${Object.entries(it.loot).map(([k, n]) => `${n} stolen ${k}`).join(', ')} in your bag` }; bag.take(it.loot); }
      wallet.cash -= it.price; s.owned.push(id);
      s.placed[it.slot] = id; return { ok: true, bought: true, item: it };
    }
    if (s.placed[it.slot] === id) return { ok: false, reason: 'Already placed' };
    s.placed[it.slot] = id; return { ok: true, bought: false, item: it };
  }
  const style = (s) => Object.values(s.placed).reduce((t, id) => t + (ITEM[id]?.style || 0), 0);
  function tier(s) { const st = style(s); let i = 0; TIERS.forEach((t, k) => { if (st >= t.at) i = k; }); return { index: i, name: TIERS[i].name, style: st, next: TIERS[i + 1] || null }; }
  const priceBonus = (s, owned = true) => (owned ? 1 + PER_TIER * tier(s).index : 1);
  // cars: [{ model, condition }], kits: { carId: kitId }
  function garageScore(s, cars, kits = {}) {
    const deco = ['gfloor', 'gwall', 'lift'].reduce((t, k) => t + (ITEM[s.placed[k]]?.style || 0), 0);
    return Math.round(cars.slice(0, 4).reduce((t, c) => t + (MODEL_SCORE[c.model] ?? 8) + (KIT_SCORE[kits[c.id]] || 0) + Math.max(0, Math.min(100, c.condition ?? 100)) / 10, 0) + deco);
  }
  function sleep(s, now = Date.now()) { if (now - s.sleptAt < SLEEP_COOLDOWN) return { ok: false, reason: `Not tired yet · ${Math.ceil((SLEEP_COOLDOWN - (now - s.sleptAt)) / 60000)} min` }; s.sleptAt = now; const bedStyle = ITEM[s.placed.bed]?.style || 0; return { ok: true, boost: 1.15 + bedStyle * 0.01, minutes: 10 }; }

  const api = Object.freeze({ SLOTS, SLOT, ITEMS, ITEM, DEFAULTS, TIERS, PER_TIER, KIT_SCORE, MODEL_SCORE, SLEEP_COOLDOWN, clean, owns, place, style, tier, priceBonus, garageScore, sleep });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftDecorData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
