/* Home upgrades catalog + rules (Claude-owned). Pure and Node-testable; home-upgrades.js runs them.
 * Furniture for the starter apartment, each with a real gameplay perk. Room coordinates are in the
 * apartment's 640x420 space (home.js), placed on free floor. */
(function (root) {
  'use strict';
  const ITEMS = [
    { id: 'bed', name: 'Memory-foam bed', icon: '🛏️', price: 2500, x: 135, y: 160, draw: 'bed',
      perk: 'Resting gives "Well rested": +25% skill XP for 10 minutes.' },
    { id: 'locker', name: 'Ammo locker', icon: '🗄️', price: 1800, x: 110, y: 365, draw: 'locker',
      perk: 'Resting restocks +60 spare rounds (once every 10 minutes).' },
    { id: 'tent', name: 'Grow tent', icon: '🌿', price: 3000, x: 520, y: 365, draw: 'tent',
      perk: 'Grows 1 weed every 4 min (max 6). Farming skill speeds it up. Harvest gives Farming XP.' },
    { id: 'scanner', name: 'Police scanner', icon: '📻', price: 4000, x: 425, y: 172, draw: 'scanner',
      perk: 'Resting at home clears all police heat (once every 5 minutes).' },
    { id: 'trophies', name: 'Trophy shelf', icon: '🏆', price: 1200, x: 230, y: 365, draw: 'trophies',
      perk: '+10% cash from completed goals. Shows off your medals.' },
  ];
  const BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
  const LAPTOP = { x: 400, y: 262 };
  const WELL_RESTED = { mult: 1.25, ms: 10 * 60 * 1000 };
  const LOCKER = { rounds: 60, cooldown: 10 * 60 * 1000 };
  const SCANNER_COOLDOWN = 5 * 60 * 1000;
  const TENT = { every: 4 * 60 * 1000, max: 6 };
  const GOAL_BONUS = 1.1;

  function clean(raw, now = Date.now()) {
    const s = { version: 1, owned: [], tent: { stock: 0, since: now }, lockerAt: 0, scannerAt: 0 };
    if (Array.isArray(raw?.owned)) for (const id of raw.owned) if (BY_ID[id] && !s.owned.includes(id)) s.owned.push(id);
    const t = raw?.tent;
    if (t) {
      s.tent.stock = Number.isSafeInteger(t.stock) && t.stock > 0 ? Math.min(TENT.max, t.stock) : 0;
      s.tent.since = Number.isFinite(t.since) && t.since > 0 && t.since <= now ? t.since : now;
    }
    for (const k of ['lockerAt', 'scannerAt']) s[k] = Number.isFinite(raw?.[k]) && raw[k] > 0 && raw[k] <= now ? raw[k] : 0;
    return s;
  }
  const has = (s, id) => s.owned.includes(id);
  function buy(s, wallet, id, discount = 1) {
    const item = BY_ID[id];
    if (!item) return { ok: false, reason: 'Unknown item' };
    if (has(s, id)) return { ok: false, reason: 'Already owned' };
    const price = Math.round(item.price * Math.max(0.5, Math.min(1, discount)));
    if (!(wallet.cash >= price)) return { ok: false, reason: 'Not enough cash' };
    wallet.cash -= price; s.owned.push(id);
    if (id === 'tent') s.tent = { stock: 0, since: Date.now() };
    return { ok: true, price };
  }
  // Grow-tent production up to `now` (works offline too). growMod < 1 = faster (Farming perk).
  function growTent(s, now, growMod = 1) {
    if (!has(s, 'tent')) return 0;
    const every = TENT.every * Math.max(0.5, Math.min(1, growMod));
    if (s.tent.stock >= TENT.max) { s.tent.since = now; return 0; }
    const n = Math.floor(Math.max(0, now - s.tent.since) / every);
    if (!n) return 0;
    const add = Math.min(n, TENT.max - s.tent.stock);
    s.tent.stock += add;
    s.tent.since = s.tent.stock >= TENT.max ? now : s.tent.since + n * every;
    return add;
  }
  // Effects of resting in bed. Returns what happened (the caller applies them to the game).
  function rest(s, now) {
    const out = { wellRested: false, rounds: 0, clearHeat: false };
    if (has(s, 'bed')) out.wellRested = true;
    if (has(s, 'locker') && now - s.lockerAt >= LOCKER.cooldown) { out.rounds = LOCKER.rounds; s.lockerAt = now; }
    if (has(s, 'scanner') && now - s.scannerAt >= SCANNER_COOLDOWN) { out.clearHeat = true; s.scannerAt = now; }
    return out;
  }
  const goalBonus = (s) => (has(s, 'trophies') ? GOAL_BONUS : 1);

  const api = Object.freeze({ ITEMS, BY_ID, LAPTOP, WELL_RESTED, LOCKER, SCANNER_COOLDOWN, TENT, GOAL_BONUS, clean, has, buy, growTent, rest, goalBonus });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftHomeData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
