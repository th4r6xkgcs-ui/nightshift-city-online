/* Car tuning catalog + rules (Claude-owned). Pure and Node-testable; tuning.js applies it in game.
 * Upgrades are per car (keyed by the game's car id, e.g. "car-0") and stack with the Driving skill. */
(function (root) {
  'use strict';
  const UPGRADES = [
    { id: 'engine', name: 'Engine', icon: '⚙️', desc: 'Top speed and acceleration', per: 0.08, prices: [800, 2000, 4500] },
    { id: 'handling', name: 'Handling', icon: '🛞', desc: 'Sharper steering', per: 0.10, prices: [600, 1500, 3500] },
    { id: 'armor', name: 'Armor', icon: '🛡️', desc: 'Less crash and bullet damage', per: -0.15, prices: [700, 1800, 4000] },
  ];
  const MAX = 3;
  const PAINT_PRICE = 150;
  const PAINTS = [
    { name: 'Cherry', hex: '#c84659' }, { name: 'Ocean', hex: '#3d99d6' }, { name: 'Gold', hex: '#e2b75c' }, { name: 'Silver', hex: '#b1c4d5' },
    { name: 'Violet', hex: '#6d73be' }, { name: 'Midnight', hex: '#1d2433' }, { name: 'Lime', hex: '#8fd14f' }, { name: 'Hot pink', hex: '#ff4fd8' },
    { name: 'Tangerine', hex: '#ff8a3d' }, { name: 'Pearl', hex: '#f1efe8' },
  ];
  const BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
  const ID_RE = /^car-\d{1,3}$/;

  function clean(raw) {
    const s = { version: 1, cars: {} };
    for (const [id, t] of Object.entries(raw?.cars || {})) {
      if (!ID_RE.test(id) || !t || typeof t !== 'object') continue;
      const c = {};
      for (const u of UPGRADES) { const v = t[u.id]; c[u.id] = Number.isSafeInteger(v) && v > 0 ? Math.min(MAX, v) : 0; }
      if (Object.values(c).some((v) => v > 0)) s.cars[id] = c;
    }
    return s;
  }
  const levels = (state, carId) => state.cars[carId] || { engine: 0, handling: 0, armor: 0 };
  // Multiplier for one upgrade on one car (1 = stock).
  const factor = (state, carId, id) => 1 + BY_ID[id].per * (levels(state, carId)[id] || 0);
  // Price of the next level (null = maxed), with an optional discount multiplier (Charisma).
  function nextPrice(state, carId, id, discount = 1) {
    const lv = levels(state, carId)[id] || 0;
    if (lv >= MAX) return null;
    return Math.round(BY_ID[id].prices[lv] * Math.max(0.5, Math.min(1, discount)));
  }
  function upgrade(state, wallet, car, id, discount = 1) {
    if (!BY_ID[id]) return { ok: false, reason: 'Unknown upgrade' };
    if (!car || !ID_RE.test(car.id || '')) return { ok: false, reason: 'No car selected' };
    if (!car.owned) return { ok: false, reason: 'You can only tune cars you own' };
    const price = nextPrice(state, car.id, id, discount);
    if (price === null) return { ok: false, reason: 'Already maxed' };
    if (!(wallet.cash >= price)) return { ok: false, reason: 'Not enough cash' };
    wallet.cash -= price;
    state.cars[car.id] = { ...levels(state, car.id), [id]: (levels(state, car.id)[id] || 0) + 1 };
    return { ok: true, price, level: state.cars[car.id][id] };
  }
  function paint(wallet, car, hex, discount = 1) {
    if (!car?.owned) return { ok: false, reason: 'You can only paint cars you own' };
    if (!PAINTS.some((p) => p.hex === hex)) return { ok: false, reason: 'Unknown paint' };
    if (car.color === hex) return { ok: false, reason: 'Already that color' };
    const price = Math.round(PAINT_PRICE * Math.max(0.5, Math.min(1, discount)));
    if (!(wallet.cash >= price)) return { ok: false, reason: 'Not enough cash' };
    wallet.cash -= price; car.color = hex;
    return { ok: true, price };
  }
  const totalLevels = (state) => Object.values(state.cars).reduce((t, c) => t + UPGRADES.reduce((a, u) => a + (c[u.id] || 0), 0), 0);
  const bestCar = (state) => Math.max(0, ...Object.values(state.cars).map((c) => UPGRADES.reduce((a, u) => a + (c[u.id] || 0), 0)));

  const api = Object.freeze({ UPGRADES, MAX, PAINTS, PAINT_PRICE, clean, levels, factor, nextPrice, upgrade, paint, totalLevels, bestCar });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftTuningData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
