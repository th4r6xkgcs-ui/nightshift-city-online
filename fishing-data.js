/* Fishing (Claude-owned). Pure and Node-testable; fishing.js runs it in game.
 * Cast -> wait for a bite (rod + Fishing skill + rain speed it up) -> reel minigame: tap REEL while the
 * needle is inside the green zone; `hits` successes land the fish, 2 misses lose it. Harder fish have
 * smaller, faster zones. Catches go to a cooler (sell at the pier market or eat to heal). */
(function (root) {
  'use strict';
  const SPOTS = [
    { id: 'pier', name: 'Docks Pier', x: 1760, y: 1655 }, // end of the docks road, bottom-centre on phones (corners sit under the joysticks)
    { id: 'canal', name: 'West Canal', x: 60, y: 520 },
  ];
  // weight = base odds; night/rain multiply some; value = market price; hp = healing when eaten.
  const FISH = [
    { id: 'boot', name: 'Old boot', icon: '🥾', weight: 10, value: 0, hp: 0, hits: 1, zone: 0.4, speed: 0.6, junk: true },
    { id: 'wallet', name: 'Soggy wallet', icon: '👛', weight: 3, value: 0, cash: [40, 160], hp: 0, hits: 1, zone: 0.4, speed: 0.7, junk: true },
    { id: 'sardine', name: 'Sardine', icon: '🐟', weight: 30, value: 8, hp: 6, hits: 2, zone: 0.34, speed: 0.8 },
    { id: 'mackerel', name: 'Mackerel', icon: '🐟', weight: 22, value: 15, hp: 8, hits: 2, zone: 0.3, speed: 0.95 },
    { id: 'bass', name: 'Sea bass', icon: '🐠', weight: 14, value: 32, hp: 12, hits: 3, zone: 0.26, speed: 1.05 },
    { id: 'catfish', name: 'Harbor catfish', icon: '🐡', weight: 8, value: 45, hp: 14, hits: 3, zone: 0.24, speed: 1.1, night: 2.5 },
    { id: 'snapper', name: 'Red snapper', icon: '🐠', weight: 7, value: 60, hp: 16, hits: 3, zone: 0.22, speed: 1.2 },
    { id: 'eel', name: 'Neon eel', icon: '🪱', weight: 2.5, value: 140, hp: 10, hits: 4, zone: 0.2, speed: 1.45, night: 3 },
    { id: 'tuna', name: 'Bluefin tuna', icon: '🐟', weight: 3, value: 180, hp: 30, hits: 4, zone: 0.18, speed: 1.4, rain: 2 },
    { id: 'sword', name: 'Swordfish', icon: '🗡️', weight: 1, value: 420, hp: 35, hits: 5, zone: 0.16, speed: 1.6 },
    { id: 'koi', name: 'Golden koi', icon: '✨', weight: 0.2, value: 1500, hp: 50, hits: 5, zone: 0.13, speed: 1.8, legendary: true },
  ];
  const BY_ID = Object.fromEntries(FISH.map((f) => [f.id, f]));
  const RODS = [
    { id: 'basic', name: 'Basic rod', price: 0, bite: 1, rare: 1, zone: 1 },
    { id: 'carbon', name: 'Carbon rod', price: 1500, bite: 0.75, rare: 1.3, zone: 1.15 },
    { id: 'pro', name: 'Pro rod', price: 5000, bite: 0.55, rare: 1.8, zone: 1.3 },
  ];
  const ROD = Object.fromEntries(RODS.map((r) => [r.id, r]));
  const COOLER = 20;
  const RARE_IDS = new Set(['eel', 'tuna', 'sword', 'koi', 'snapper', 'catfish']);

  // Seconds until a bite. rnd in [0,1).
  function biteTime(rodId, skillBite = 1, raining = false, rnd = Math.random) {
    const base = 2.5 + rnd() * 4.5;
    return Math.max(1, base * (ROD[rodId] || ROD.basic).bite * skillBite * (raining ? 0.8 : 1));
  }
  // Weighted catch; rare multiplier boosts uncommon fish (rod x Fishing skill x Luck), night/rain favour some.
  function rollFish(opts = {}, rnd = Math.random) {
    const rare = Math.max(1, (ROD[opts.rod] || ROD.basic).rare * (opts.skillRare || 1) * (opts.luck || 1));
    const weights = FISH.map((f) => {
      let w = f.weight;
      if (RARE_IDS.has(f.id)) w *= rare;
      if (f.legendary) w *= rare; // legendary scales twice
      if (f.junk) w /= rare;
      if (opts.night && f.night) w *= f.night;
      if (opts.raining && f.rain) w *= f.rain;
      return w;
    });
    let r = rnd() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < FISH.length; i++) { if (r < weights[i]) return FISH[i]; r -= weights[i]; }
    return FISH[0];
  }
  // Reel zone: centre and half-width (0..1 track). Easier with better rods.
  function zoneFor(fish, rodId, rnd = Math.random) {
    const half = Math.min(0.45, (fish.zone * (ROD[rodId] || ROD.basic).zone) / 2);
    const centre = half + rnd() * (1 - 2 * half);
    return { from: centre - half, to: centre + half };
  }
  // Needle position (0..1) at time t seconds: smooth ping-pong.
  const needle = (t, speed) => { const p = (t * speed * 0.9) % 2; return p < 1 ? p : 2 - p; };
  const hit = (pos, zone) => pos >= zone.from && pos <= zone.to;

  function clean(raw) {
    const s = { version: 1, rod: 'basic', rods: ['basic'], cooler: {}, caught: {}, total: 0, best: 0 };
    if (Array.isArray(raw?.rods)) for (const r of raw.rods) if (ROD[r] && !s.rods.includes(r)) s.rods.push(r);
    if (s.rods.includes(raw?.rod)) s.rod = raw.rod;
    let room = COOLER;
    for (const [id, n] of Object.entries(raw?.cooler || {})) if (BY_ID[id] && !BY_ID[id].junk && Number.isSafeInteger(n) && n > 0 && room > 0) { s.cooler[id] = Math.min(n, room); room -= s.cooler[id]; }
    for (const [id, n] of Object.entries(raw?.caught || {})) if (BY_ID[id] && Number.isSafeInteger(n) && n > 0) s.caught[id] = Math.min(1e6, n);
    s.total = Number.isSafeInteger(raw?.total) && raw.total > 0 ? Math.min(1e7, raw.total) : 0;
    s.best = Number.isSafeInteger(raw?.best) && raw.best > 0 ? Math.min(1e6, raw.best) : 0;
    return s;
  }
  const coolerCount = (s) => Object.values(s.cooler).reduce((a, b) => a + b, 0);
  // Records a landed catch. Junk is not stored; wallets pay cash. Returns { stored, cash, full }.
  function land(s, fish, rnd = Math.random) {
    s.caught[fish.id] = (s.caught[fish.id] || 0) + 1; s.total++;
    s.best = Math.max(s.best, fish.value);
    if (fish.cash) return { stored: false, cash: Math.round(fish.cash[0] + rnd() * (fish.cash[1] - fish.cash[0])), full: false };
    if (fish.junk) return { stored: false, cash: 0, full: false };
    if (coolerCount(s) >= COOLER) return { stored: false, cash: 0, full: true };
    s.cooler[fish.id] = (s.cooler[fish.id] || 0) + 1;
    return { stored: true, cash: 0, full: false };
  }
  function sellAll(s, priceMod = 1) {
    let cash = 0, n = 0;
    for (const [id, k] of Object.entries(s.cooler)) { cash += Math.round(BY_ID[id].value * priceMod) * k; n += k; }
    s.cooler = {};
    return { cash, n };
  }
  function eat(s, id) {
    if (!(s.cooler[id] > 0)) return 0;
    s.cooler[id]--; if (!s.cooler[id]) delete s.cooler[id];
    return BY_ID[id].hp;
  }
  function buyRod(s, wallet, id) {
    const r = ROD[id];
    if (!r) return { ok: false, reason: 'Unknown rod' };
    if (s.rods.includes(id)) { s.rod = id; return { ok: true, price: 0 }; }
    if (!(wallet.cash >= r.price)) return { ok: false, reason: 'Not enough cash' };
    wallet.cash -= r.price; s.rods.push(id); s.rod = id;
    return { ok: true, price: r.price };
  }
  const XP = (fish) => (fish.junk ? 5 : 10 + Math.round(fish.value / 4));

  const api = Object.freeze({ SPOTS, FISH, BY_ID, RODS, ROD, COOLER, biteTime, rollFish, zoneFor, needle, hit, clean, coolerCount, land, sellAll, eat, buyRod, XP });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftFishingData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
