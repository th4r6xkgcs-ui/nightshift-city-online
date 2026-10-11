/* Weapons catalog + rules (Claude-owned). Pure and Node-testable; weapons.js applies them in game.
 * dmg = damage per bullet/pellet before the Shooting perk; rate = ms between shots; mag = rounds per
 * magazine (<= 30, the game's save cap); range in px; speed in px per frame; spread = max radians off aim.
 * Ammo is shared (the game's single reserve). The Street Pistol matches the original game exactly. */
(function (root) {
  'use strict';
  const WEAPONS = [
    { id: 'pistol', name: 'Street Pistol', icon: '🔫', price: 0, level: 1, dmg: 20, pellets: 1, rate: 180, mag: 30, spread: 0, range: 450, speed: 10,
      desc: 'Your starter sidearm. Reliable, nothing special.' },
    { id: 'revolver', name: 'Six-Shot Magnum', icon: '🤠', price: 900, level: 2, dmg: 45, pellets: 1, rate: 420, mag: 6, spread: 0.015, range: 560, speed: 12,
      desc: 'Slow and loud, but drops most people in one shot.' },
    { id: 'smg', name: 'Viper SMG', icon: '💨', price: 1500, level: 4, dmg: 13, pellets: 1, rate: 85, mag: 30, spread: 0.09, range: 380, speed: 11,
      desc: 'Sprays fast at close range. Eats ammo.' },
    { id: 'shotgun', name: 'Breaker 12', icon: '💥', price: 2600, level: 7, dmg: 12, pellets: 6, rate: 700, mag: 6, spread: 0.28, range: 230, speed: 10,
      desc: 'Six pellets per shell. Brutal up close, useless far away.' },
    { id: 'rifle', name: 'Longshot DMR', icon: '🎯', price: 4200, level: 10, dmg: 60, pellets: 1, rate: 550, mag: 10, spread: 0.004, range: 950, speed: 14,
      desc: 'Pinpoint and long range. One hit, one down.' },
    { id: 'ar', name: 'Ridgeback AR', icon: '⚡', price: 8000, level: 15, dmg: 22, pellets: 1, rate: 115, mag: 30, spread: 0.045, range: 650, speed: 13,
      desc: 'Top-tier all-rounder: fast, accurate, hard-hitting.' },
  ];
  const BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
  const AMMO_CRATE = { rounds: 60, price: 100 }; // bulk ammo: $1.67/round vs $2 at the corner shop
  // Body armor: absorbs ABSORB of each hit until its points run out. Buying tops up to the vest's points.
  const ARMOR = [
    { id: 'light', name: 'Kevlar vest', icon: '🦺', price: 500, points: 50 },
    { id: 'heavy', name: 'Heavy plate vest', icon: '🛡️', price: 1300, points: 100 },
  ];
  const ABSORB = 0.7;
  function absorb(armor, dmg) {
    if (!(armor > 0) || !(dmg > 0)) return { armor: Math.max(0, armor || 0), dmg: Math.max(0, dmg || 0) };
    const soaked = Math.min(armor, dmg * ABSORB);
    return { armor: armor - soaked, dmg: dmg - soaked };
  }
  // Per-gun attachments. Bought separately for each gun; stats apply through effective().
  const MODS = [
    { id: 'extmag', name: 'Extended mag', icon: '📦', price: 900, level: 2, desc: '+50% magazine (game cap 30)' },
    { id: 'grip', name: 'Laser grip', icon: '🔴', price: 700, level: 4, desc: 'Spread halved' },
    { id: 'scope', name: 'Scope', icon: '🔭', price: 800, level: 5, desc: '+35% range, tighter aim' },
    { id: 'suppressor', name: 'Suppressor', icon: '🔇', price: 1200, level: 3, desc: '70% less heat per shot; 80% of shots go unreported' },
  ];
  const MOD = Object.fromEntries(MODS.map((m) => [m.id, m]));
  // Weapon stats with its mods applied.
  function effective(w, mods = []) {
    const e = { ...w, mods: mods.slice() };
    if (mods.includes('extmag')) e.mag = Math.min(30, Math.round(w.mag * 1.5));
    if (mods.includes('grip')) e.spread = w.spread * 0.5;
    if (mods.includes('scope')) { e.range = Math.round(w.range * 1.35); e.spread = e.spread * 0.6; }
    e.suppressed = mods.includes('suppressor');
    return e;
  }
  function buyMod(state, wallet, weaponId, modId, shootingLevel) {
    const m = MOD[modId];
    if (!m || !BY_ID[weaponId]) return { ok: false, reason: 'Unknown mod' };
    if (!state.owned.includes(weaponId)) return { ok: false, reason: 'Buy the gun first' };
    const have = state.mods[weaponId] || [];
    if (have.includes(modId)) return { ok: false, reason: 'Already fitted' };
    if (!(shootingLevel >= m.level)) return { ok: false, reason: `Needs Shooting level ${m.level}` };
    if (!(wallet.cash >= m.price)) return { ok: false, reason: 'Not enough cash' };
    wallet.cash -= m.price; state.mods[weaponId] = [...have, modId];
    return { ok: true, price: m.price };
  }

  function clean(raw) {
    const owned = ['pistol'];
    if (Array.isArray(raw?.owned)) for (const id of raw.owned) if (BY_ID[id] && !owned.includes(id)) owned.push(id);
    const equipped = owned.includes(raw?.equipped) ? raw.equipped : 'pistol';
    const mods = {};
    for (const [wid, list] of Object.entries(raw?.mods || {})) {
      if (!owned.includes(wid) || !Array.isArray(list)) continue;
      const clean = [...new Set(list.filter((m) => typeof m === 'string' && /^[a-z]+$/.test(m)))];
      if (clean.length) mods[wid] = clean;
    }
    const armor = Number.isFinite(raw?.armor) ? Math.max(0, Math.min(100, raw.armor)) : 0;
    return { version: 1, owned, equipped, mods, armor };
  }
  // Returns '' when the purchase is allowed, otherwise the reason.
  function canBuy(state, id, cash, shootingLevel) {
    const w = BY_ID[id];
    if (!w) return 'Unknown weapon';
    if (state.owned.includes(id)) return 'Already owned';
    if (!(shootingLevel >= w.level)) return `Needs Shooting level ${w.level}`;
    if (!(cash >= w.price)) return 'Not enough cash';
    return '';
  }
  function buy(state, wallet, id, shootingLevel) {
    const why = canBuy(state, id, wallet.cash, shootingLevel);
    if (why) return { ok: false, reason: why };
    wallet.cash -= BY_ID[id].price;
    state.owned.push(id);
    state.equipped = id;
    return { ok: true };
  }
  function equip(state, id) { if (!state.owned.includes(id)) return false; state.equipped = id; return true; }
  function cycle(state, dir = 1) {
    const list = WEAPONS.filter((w) => state.owned.includes(w.id)).map((w) => w.id);
    const i = list.indexOf(state.equipped);
    state.equipped = list[(i + dir + list.length) % list.length];
    return state.equipped;
  }
  // Angles for every projectile of one trigger pull.
  function pelletAngles(aim, w, rnd = Math.random) {
    const out = [];
    for (let i = 0; i < w.pellets; i++) out.push(aim + (rnd() * 2 - 1) * w.spread);
    return out;
  }
  // Magazine rules on weapon switch: extra rounds go back to the reserve.
  function fitMagazine(ammo, reserve, mag, maxReserve = 240) {
    if (ammo <= mag) return { ammo, reserve };
    const back = ammo - mag;
    return { ammo: mag, reserve: Math.min(maxReserve, reserve + back) };
  }
  const dps = (w) => (w.dmg * w.pellets * 1000) / w.rate;

  const api = Object.freeze({ WEAPONS, BY_ID, AMMO_CRATE, ARMOR, ABSORB, absorb, MODS, MOD, effective, buyMod, clean, canBuy, buy, equip, cycle, pelletAngles, fitMagazine, dps });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftWeaponsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
