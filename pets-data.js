/* Pets + Prestige car kits (Claude-owned). Pure and Node-testable; pets.js / suburbs.js run them in game.
 * Pets follow you everywhere and give a perk while they're fed (one bowl of pet food lasts FEED_HOURS real hours).
 * Car kits convert one of your cars (by the game's car id) into a premium build: stat multipliers + visual parts. */
(function (root) {
  'use strict';
  const PETS = [
    { id: 'shiba', name: 'Shiba Inu', kind: 'dog', icon: '🐕', price: 1800, colors: ['#d8843a', '#f2ead8'], perk: { 'luck.rare': 1.25 }, desc: 'Lucky charm: +25% lucky finds' },
    { id: 'lab', name: 'Labrador', kind: 'dog', icon: '🦮', price: 2200, colors: ['#e3c27a', '#c9a24a'], perk: { 'stealth.cooldown': 1.25 }, desc: 'Good-boy alibi: heat cools 25% faster' },
    { id: 'husky', name: 'Husky', kind: 'dog', icon: '🐺', price: 3000, colors: ['#9aa3ab', '#f2f2ee'], perk: { 'athletics.stamina': 1.25 }, desc: 'Running buddy: +25% sprint stamina' },
    { id: 'rottweiler', name: 'Rottweiler', kind: 'dog', icon: '🐕‍🦺', price: 4200, colors: ['#1e1a18', '#a0582a'], perk: { 'toughness.damageTaken': 0.9 }, desc: 'Bodyguard: -10% damage taken' },
    { id: 'tabby', name: 'Tabby cat', kind: 'cat', icon: '🐈', price: 1200, colors: ['#d8843a', '#a0582a'], perk: { 'farming.growTime': 0.9 }, desc: 'Pest control: crops grow 10% faster' },
    { id: 'blackcat', name: 'Black cat', kind: 'cat', icon: '🐈‍⬛', price: 1600, colors: ['#1e1a22', '#3a3440'], perk: { 'luck.casino': 1.05, 'luck.rare': 1.1 }, desc: 'Bad luck for others: +5% slots, +10% finds' },
    { id: 'parrot', name: 'Macaw', kind: 'bird', icon: '🦜', price: 2600, colors: ['#e0473a', '#3d7fd0'], perk: { 'dealing.price': 1.05, 'charisma.shopPrice': 0.95 }, desc: 'Smooth talker: +5% sale prices, -5% shop prices' },
  ];
  const PET = Object.fromEntries(PETS.map((p) => [p.id, p]));
  const FEED_HOURS = 6, FOOD_PRICE = 25, MAX_PETS = 3;
  const KITS = [
    { id: 'gt', name: 'Vandal GT kit', icon: '🏁', price: 12000, engine: 1.15, handling: 1.08, armor: 1, desc: 'Racing stripes, rear wing, +15% power' },
    { id: 'muscle', name: 'Raptor muscle kit', icon: '🔥', price: 16000, engine: 1.22, handling: 0.96, armor: 1, desc: 'Hood scoop, flame decals, +22% power' },
    { id: 'rally', name: 'Dirt rally kit', icon: '🌲', price: 14000, engine: 1.06, handling: 1.2, armor: 0.92, desc: 'Roof rack, light bar, mud flaps, +20% grip' },
    { id: 'lux', name: 'Phantom luxury kit', icon: '👑', price: 30000, engine: 1.1, handling: 1.08, armor: 0.8, desc: 'Chrome trim, gold rims, armoured glass' },
  ];
  const KIT = Object.fromEntries(KITS.map((k) => [k.id, k]));
  const DREAM_HOUSE = 85000;

  function clean(raw, now = Date.now()) {
    const s = { version: 1, pets: [], active: null, kits: {}, dream: raw?.dream === true, food: 0 };
    for (const p of Array.isArray(raw?.pets) ? raw.pets : []) {
      if (!PET[p?.id] || s.pets.some((q) => q.id === p.id) || s.pets.length >= MAX_PETS) continue;
      s.pets.push({ id: p.id, name: typeof p.name === 'string' && /^[\w '\-]{1,16}$/.test(p.name) ? p.name : PET[p.id].name, fedUntil: Number.isFinite(p.fedUntil) ? Math.min(p.fedUntil, now + FEED_HOURS * 3600000 * 2) : now + FEED_HOURS * 3600000 });
    }
    s.active = s.pets.some((p) => p.id === raw?.active) ? raw.active : s.pets[0]?.id || null;
    for (const [car, k] of Object.entries(raw?.kits || {})) if (/^car-\d{1,3}$/.test(car) && KIT[k]) s.kits[car] = k;
    s.food = Number.isSafeInteger(raw?.food) && raw.food > 0 ? Math.min(99, raw.food) : 0;
    return s;
  }
  function adopt(s, wallet, id, now = Date.now()) {
    const P = PET[id];
    if (!P) return { ok: false, reason: 'Unknown pet' };
    if (s.pets.some((p) => p.id === id)) return { ok: false, reason: 'Already yours' };
    if (s.pets.length >= MAX_PETS) return { ok: false, reason: `Room for ${MAX_PETS} pets` };
    if (!(wallet.cash >= P.price)) return { ok: false, reason: 'Not enough cash' };
    wallet.cash -= P.price; s.pets.push({ id, name: P.name, fedUntil: now + FEED_HOURS * 3600000 }); s.active = id;
    return { ok: true, pet: P };
  }
  const fed = (s, id, now = Date.now()) => { const p = s.pets.find((q) => q.id === id); return !!p && p.fedUntil > now; };
  function feed(s, id, now = Date.now()) {
    const p = s.pets.find((q) => q.id === id);
    if (!p) return { ok: false, reason: 'No such pet' };
    if (s.food <= 0) return { ok: false, reason: 'No pet food · buy some at Paws & Claws' };
    if (p.fedUntil > now + FEED_HOURS * 3600000) return { ok: false, reason: 'Full! Try later' };
    s.food -= 1; p.fedUntil = Math.max(p.fedUntil, now) + FEED_HOURS * 3600000;
    return { ok: true };
  }
  // Perk multiplier for a skill-mod key from the active pet (only while fed).
  function perk(s, key, now = Date.now()) { const id = s.active; if (!id || !fed(s, id, now)) return 1; return PET[id].perk[key] ?? 1; }
  function buyKit(s, wallet, carId, kitId, owned) {
    const K = KIT[kitId];
    if (!K) return { ok: false, reason: 'Unknown kit' };
    if (!/^car-\d{1,3}$/.test(carId) || !owned) return { ok: false, reason: 'Pick one of your cars' };
    if (s.kits[carId] === kitId) return { ok: false, reason: 'Already fitted' };
    if (!(wallet.cash >= K.price)) return { ok: false, reason: 'Not enough cash' };
    wallet.cash -= K.price; s.kits[carId] = kitId; return { ok: true, kit: K };
  }
  const kitFactor = (s, carId, stat) => (KIT[s.kits[carId]]?.[stat] ?? 1);
  function buyDream(s, wallet) { if (s.dream) return { ok: false, reason: 'Already yours' }; if (!(wallet.cash >= DREAM_HOUSE)) return { ok: false, reason: `Needs $${DREAM_HOUSE.toLocaleString()}` }; wallet.cash -= DREAM_HOUSE; s.dream = true; return { ok: true }; }

  const api = Object.freeze({ PETS, PET, FEED_HOURS, FOOD_PRICE, MAX_PETS, KITS, KIT, DREAM_HOUSE, clean, adopt, fed, feed, perk, buyKit, kitFactor, buyDream });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftPetsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
