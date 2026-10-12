/* Weapons catalog + rules (Claude-owned). Pure and Node-testable; weapons.js applies them in game.
 * dmg = damage per bullet/pellet before the Shooting perk; rate = ms between shots; mag = rounds per
 * magazine (<= 30, the game's save cap); range in px; speed in px per frame; spread = max radians off aim.
 * Ammo is shared (the game's single reserve).
 *
 * Guns are CRAFTED, not bought (fictional game recipes, no real-world guidance):
 *   tier 0 = home workbench (crude guns from scrap; they fall apart and cannot be repaired),
 *   tier 1-3 = your Lockup workshop level (supply-data.js LOCKUP). `level` = Shooting level needed to craft.
 *   dur = shots before the gun wears out. Crude guns break for good; real guns break and need a repair.
 *   value = what the arms buyer pays for a brand-new one (spares); used guns sell for less.
 * Crafting a gun you already own makes a SPARE: it swaps in automatically when yours breaks, or you sell it. */
(function (root) {
  'use strict';
  const C = (mats, seconds) => ({ mats, seconds });
  const WEAPONS = [
    { id: 'pipe', name: 'Pipe Pistol', icon: '🪈', cls: 'crude', tier: 0, level: 1, crude: true, dmg: 24, pellets: 1, rate: 700, mag: 1, spread: 0.07, range: 300, speed: 9, dur: 10, value: 60,
      craft: C({ pipe: 1, metal: 3, spring: 1, tape: 1 }, 8), desc: 'A pipe, a spring and a prayer. One shot, then reload. Falls apart after ~10 shots.' },
    { id: 'zip', name: 'Zip .22', icon: '🩹', cls: 'crude', tier: 0, level: 1, crude: true, dmg: 14, pellets: 1, rate: 420, mag: 5, spread: 0.06, range: 330, speed: 9, dur: 40, value: 150,
      craft: C({ pipe: 1, metal: 5, spring: 2, tape: 2, wood: 1 }, 12), desc: 'Taped-together five-shot. Weak, but it holds together for a while.' },
    { id: 'sawnoff', name: 'Sawn-off', icon: '🪚', cls: 'crude', tier: 0, level: 2, crude: true, dmg: 10, pellets: 5, rate: 900, mag: 2, spread: 0.32, range: 200, speed: 9, dur: 24, value: 190,
      craft: C({ pipe: 2, metal: 6, spring: 2, wood: 2, tape: 1 }, 15), desc: 'Two barrels of spray. Devastating at arm\'s length, useless past it.' },
    { id: 'pistol', name: 'Street Pistol', icon: '🔫', cls: 'pistol', tier: 1, level: 2, dmg: 20, pellets: 1, rate: 200, mag: 12, spread: 0.02, range: 450, speed: 10, dur: 500, value: 1050,
      craft: C({ frame: 1, barrel: 1, trigger: 1, spring: 2, metal: 4 }, 20), desc: 'A proper sidearm. Reliable, accurate, lasts.' },
    { id: 'compact', name: 'Compact 9', icon: '🔹', cls: 'pistol', tier: 1, level: 3, dmg: 16, pellets: 1, rate: 150, mag: 15, spread: 0.035, range: 420, speed: 10, dur: 450, value: 1150,
      craft: C({ frame: 1, barrel: 1, trigger: 1, spring: 3, metal: 3 }, 22), desc: 'Small, quick and a fat magazine.' },
    { id: 'revolver', name: 'Six-Shot Magnum', icon: '🤠', cls: 'pistol', tier: 1, level: 3, dmg: 45, pellets: 1, rate: 420, mag: 6, spread: 0.015, range: 560, speed: 12, dur: 650, value: 1300,
      craft: C({ frame: 1, barrel: 1, trigger: 1, spring: 2, metal: 8 }, 25), desc: 'Slow and loud, but drops most people in one shot.' },
    { id: 'pump', name: 'Pump Shotgun', icon: '🦆', cls: 'shotgun', tier: 1, level: 4, dmg: 11, pellets: 6, rate: 850, mag: 5, spread: 0.26, range: 240, speed: 10, dur: 420, value: 1650,
      craft: C({ frame: 1, barrel: 2, trigger: 1, wood: 3, spring: 3 }, 30), desc: 'Rack and blast. The street-level crowd clearer.' },
    { id: 'machine', name: 'Machine Pistol', icon: '🌪️', cls: 'smg', tier: 2, level: 5, dmg: 11, pellets: 1, rate: 70, mag: 20, spread: 0.12, range: 330, speed: 11, dur: 600, value: 2100,
      craft: C({ frame: 1, barrel: 1, trigger: 2, bolt: 1, spring: 4, metal: 5 }, 35), desc: 'A pistol that thinks it\'s an SMG. Wild spray.' },
    { id: 'smg', name: 'Viper SMG', icon: '💨', cls: 'smg', tier: 2, level: 5, dmg: 13, pellets: 1, rate: 85, mag: 30, spread: 0.09, range: 380, speed: 11, dur: 800, value: 2400,
      craft: C({ frame: 2, barrel: 1, trigger: 1, bolt: 1, spring: 4, metal: 6 }, 40), desc: 'Sprays fast at close range. Eats ammo.' },
    { id: 'hawk', name: 'Desert Hawk', icon: '🦅', cls: 'pistol', tier: 2, level: 6, dmg: 55, pellets: 1, rate: 520, mag: 7, spread: 0.02, range: 600, speed: 13, dur: 500, value: 2050,
      craft: C({ frame: 1, barrel: 2, trigger: 1, spring: 2, metal: 12 }, 35), desc: 'A hand cannon. Kicks like a mule.' },
    { id: 'hunting', name: 'Hunting Rifle', icon: '🦌', cls: 'rifle', tier: 2, level: 6, dmg: 70, pellets: 1, rate: 1100, mag: 5, spread: 0.006, range: 900, speed: 14, dur: 600, value: 2300,
      craft: C({ frame: 1, barrel: 2, trigger: 1, bolt: 1, wood: 4 }, 40), desc: 'Bolt action. One careful shot at a time, from very far.' },
    { id: 'shotgun', name: 'Breaker 12', icon: '💥', cls: 'shotgun', tier: 3, level: 8, dmg: 12, pellets: 6, rate: 700, mag: 6, spread: 0.28, range: 230, speed: 10, dur: 700, value: 3400,
      craft: C({ frame: 2, barrel: 2, trigger: 1, bolt: 1, spring: 4, metal: 8 }, 45), desc: 'Semi-auto, six pellets per shell. Brutal up close.' },
    { id: 'carbine', name: 'Carbine', icon: '🎖️', cls: 'rifle', tier: 3, level: 9, dmg: 18, pellets: 1, rate: 105, mag: 30, spread: 0.055, range: 560, speed: 13, dur: 900, value: 4200,
      craft: C({ frame: 2, barrel: 2, trigger: 2, bolt: 1, spring: 4, metal: 10 }, 55), desc: 'Short rifle, fast and steady.' },
    { id: 'rifle', name: 'Longshot DMR', icon: '🎯', cls: 'rifle', tier: 3, level: 10, dmg: 60, pellets: 1, rate: 550, mag: 10, spread: 0.004, range: 950, speed: 14, dur: 700, value: 4600,
      craft: C({ frame: 2, barrel: 2, trigger: 1, bolt: 1, lens: 2, metal: 10 }, 55), desc: 'Pinpoint and long range. One hit, one down.' },
    { id: 'ar', name: 'Ridgeback AR', icon: '⚡', cls: 'rifle', tier: 3, level: 13, dmg: 22, pellets: 1, rate: 115, mag: 30, spread: 0.045, range: 650, speed: 13, dur: 1200, value: 7500,
      craft: C({ frame: 3, barrel: 2, trigger: 2, bolt: 2, spring: 5, metal: 14 }, 70), desc: 'Top-tier all-rounder: fast, accurate, hard-hitting.' },
  ];
  const BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
  // Shown when you have no working gun (the game blocks firing; see weapons.js pocket sync).
  const NONE = Object.freeze({ id: 'none', name: 'Unarmed', icon: '✊', cls: 'none', tier: 0, level: 1, dmg: 0, pellets: 1, rate: 400, mag: 30, spread: 0, range: 1, speed: 1, dur: 1, value: 0, desc: 'No gun. Craft one at your home workbench.' });
  const AMMO_CRATE = { rounds: 30, price: 75 }; // $2.50/round in bulk (the corner shop charges $2 a round but only sells small amounts)
  // Body armor: absorbs ABSORB of each hit until its points run out. Buying tops up to the vest's points.
  const ARMOR = [
    { id: 'light', name: 'Kevlar vest', icon: '🦺', price: 600, points: 50 },
    { id: 'heavy', name: 'Heavy plate vest', icon: '🛡️', price: 1600, points: 100 },
  ];
  const ABSORB = 0.7;
  function absorb(armor, dmg) {
    if (!(armor > 0) || !(dmg > 0)) return { armor: Math.max(0, armor || 0), dmg: Math.max(0, dmg || 0) };
    const soaked = Math.min(armor, dmg * ABSORB);
    return { armor: armor - soaked, dmg: dmg - soaked };
  }
  // Attachments: crafted at a bench of at least `tier`, per gun. crude:false = won't fit a crude gun.
  const MODS = [
    { id: 'reinforce', name: 'Reinforced parts', icon: '🧷', tier: 0, level: 1, crude: true, mats: { metal: 8, spring: 2 }, seconds: 10, desc: '+60% durability' },
    { id: 'extmag', name: 'Extended mag', icon: '📦', tier: 1, level: 2, crude: false, mats: { spring: 3, metal: 4 }, seconds: 12, desc: '+50% magazine (game cap 30)' },
    { id: 'grip', name: 'Laser grip', icon: '🔴', tier: 1, level: 4, crude: false, mats: { lens: 1, metal: 2, tape: 1 }, seconds: 12, desc: 'Spread halved' },
    { id: 'suppressor', name: 'Suppressor', icon: '🔇', tier: 2, level: 3, crude: false, mats: { pipe: 1, metal: 6, tape: 2, spring: 1 }, seconds: 15, desc: '70% less heat per shot; 80% of shots go unreported' },
    { id: 'scope', name: 'Scope', icon: '🔭', tier: 2, level: 5, crude: false, mats: { lens: 2, metal: 3 }, seconds: 15, desc: '+35% range, tighter aim' },
  ];
  const MOD = Object.fromEntries(MODS.map((m) => [m.id, m]));
  const SPARE_MAX = 20;
  // Armor plate: crafted at any bench, tops body armor up by `points` (max 100).
  const PLATE = { mats: { metal: 10, tape: 2 }, points: 25, max: 100, seconds: 12 };
  function buildPlate(state, ctx) {
    if ((state.armor || 0) >= PLATE.max) return { ok: false, reason: 'Armor is full' };
    if (!ctx.spend(PLATE.mats)) return { ok: false, reason: 'Missing materials' };
    state.armor = Math.min(PLATE.max, (state.armor || 0) + PLATE.points);
    return { ok: true, armor: state.armor };
  }

  // Weapon stats with its mods applied.
  function effective(w, mods = []) {
    const e = { ...w, mods: mods.slice() };
    if (mods.includes('extmag')) e.mag = Math.min(30, Math.round(w.mag * 1.5));
    if (mods.includes('grip')) e.spread = w.spread * 0.5;
    if (mods.includes('scope')) { e.range = Math.round(w.range * 1.35); e.spread = e.spread * 0.6; }
    e.suppressed = mods.includes('suppressor');
    return e;
  }
  // Max shots for a gun (reinforce +60%; durMul = Crafting skill bonus, 1..1.5).
  const maxDur = (w, mods = [], durMul = 1) => Math.max(1, Math.round(w.dur * (mods.includes('reinforce') ? 1.6 : 1) * Math.max(1, Math.min(1.5, durMul))));

  const okId = (id) => typeof id === 'string' && !!BY_ID[id];
  function clean(raw) {
    const legacy = raw && typeof raw === 'object' && raw.version === 1; // saves from before crafting: keep what you had
    const owned = [];
    if (legacy) owned.push('pistol');
    if (Array.isArray(raw?.owned)) for (const id of raw.owned) if (okId(id) && !owned.includes(id)) owned.push(id);
    const broken = Array.isArray(raw?.broken) ? [...new Set(raw.broken.filter((id) => owned.includes(id) && !BY_ID[id].crude))] : [];
    const usable = owned.filter((id) => !broken.includes(id));
    const equipped = usable.includes(raw?.equipped) ? raw.equipped : (usable[0] || null);
    const mods = {};
    for (const [wid, list] of Object.entries(raw?.mods || {})) {
      if (!owned.includes(wid) || !Array.isArray(list)) continue;
      const c = [...new Set(list.filter((m) => typeof m === 'string' && MOD[m] && (MOD[m].crude || !BY_ID[wid].crude)))];
      if (c.length) mods[wid] = c;
    }
    const cond = {};
    for (const id of owned) {
      const mx = maxDur(BY_ID[id], mods[id] || [], 1.5), v = raw?.cond?.[id];
      cond[id] = broken.includes(id) ? 0 : Number.isFinite(v) && v >= 0 ? Math.min(mx, Math.round(v)) : maxDur(BY_ID[id], mods[id] || []);
      if (cond[id] <= 0 && !broken.includes(id)) cond[id] = 1;
    }
    const spare = {};
    for (const [id, n] of Object.entries(raw?.spare || {})) if (okId(id) && Number.isSafeInteger(n) && n > 0) spare[id] = Math.min(SPARE_MAX, n);
    const armor = Number.isFinite(raw?.armor) ? Math.max(0, Math.min(100, raw.armor)) : 0;
    return { version: 2, owned, equipped, mods, armor, cond, broken, spare };
  }
  const usable = (state) => WEAPONS.filter((w) => state.owned.includes(w.id) && !state.broken.includes(w.id)).map((w) => w.id);
  function equip(state, id) { if (!usable(state).includes(id)) return false; state.equipped = id; return true; }
  function cycle(state, dir = 1) {
    const list = usable(state);
    if (!list.length) { state.equipped = null; return null; }
    const i = list.indexOf(state.equipped);
    state.equipped = list[(i + dir + list.length) % list.length];
    return state.equipped;
  }

  // '' when craftable, else the reason. ctx: { bench (0 home | 1-3 lockup), shooting (level), have(cost) -> bool }
  function craftBlock(state, id, ctx) {
    const w = BY_ID[id];
    if (!w) return 'Unknown weapon';
    if (w.tier > ctx.bench) return w.tier === 1 && ctx.bench === 0 ? 'Needs your Lockup workshop' : `Needs a level ${w.tier} workshop`;
    if (!(ctx.shooting >= w.level)) return `Needs Shooting level ${w.level}`;
    if ((state.spare[id] || 0) >= SPARE_MAX && state.owned.includes(id)) return 'Spare rack is full';
    if (!ctx.have(w.craft.mats)) return 'Missing materials';
    return '';
  }
  // ctx.spend(cost) must take the materials (bag/locker); durMul = crafting skill bonus.
  function craft(state, id, ctx) {
    const why = craftBlock(state, id, ctx);
    if (why) return { ok: false, reason: why };
    const w = BY_ID[id];
    if (!ctx.spend(w.craft.mats)) return { ok: false, reason: 'Missing materials' };
    if (state.owned.includes(id) && !state.broken.includes(id)) { state.spare[id] = (state.spare[id] || 0) + 1; return { ok: true, spare: true, weapon: w }; }
    if (!state.owned.includes(id)) state.owned.push(id);
    state.broken = state.broken.filter((b) => b !== id);
    state.cond[id] = maxDur(w, state.mods[id] || [], ctx.durMul);
    if (!state.equipped) state.equipped = id;
    return { ok: true, spare: false, weapon: w };
  }
  function modBlock(state, weaponId, modId, ctx) {
    const m = MOD[modId], w = BY_ID[weaponId];
    if (!m || !w) return 'Unknown mod';
    if (!state.owned.includes(weaponId)) return 'Craft the gun first';
    if (w.crude && !m.crude) return 'Won\'t fit a crude gun';
    if ((state.mods[weaponId] || []).includes(modId)) return 'Already fitted';
    if (m.tier > ctx.bench) return m.tier === 1 && ctx.bench === 0 ? 'Needs your Lockup workshop' : `Needs a level ${m.tier} workshop`;
    if (!(ctx.shooting >= m.level)) return `Needs Shooting level ${m.level}`;
    if (!ctx.have(m.mats)) return 'Missing materials';
    return '';
  }
  function craftMod(state, weaponId, modId, ctx) {
    const why = modBlock(state, weaponId, modId, ctx);
    if (why) return { ok: false, reason: why };
    const m = MOD[modId];
    if (!ctx.spend(m.mats)) return { ok: false, reason: 'Missing materials' };
    state.mods[weaponId] = [...(state.mods[weaponId] || []), modId];
    if (modId === 'reinforce') state.cond[weaponId] = Math.round((state.cond[weaponId] || 0) * 1.6);
    return { ok: true, mod: m };
  }

  // One trigger pull wears the equipped gun. Returns what happened so the game can react.
  function wear(state, durMul = 1) {
    const id = state.equipped, w = BY_ID[id];
    if (!w) return { none: true };
    state.cond[id] = Math.max(0, (state.cond[id] ?? maxDur(w, state.mods[id] || [], durMul)) - 1);
    if (state.cond[id] > 0) return { ok: true, left: state.cond[id] };
    if ((state.spare[id] || 0) > 0) { // a fresh spare swaps in
      state.spare[id] -= 1; if (!state.spare[id]) delete state.spare[id];
      state.cond[id] = maxDur(w, state.mods[id] || [], durMul);
      return { broke: true, swapped: true, weapon: w };
    }
    if (w.crude) { state.owned = state.owned.filter((x) => x !== id); delete state.mods[id]; delete state.cond[id]; }
    else state.broken.push(id);
    state.equipped = usable(state)[0] || null;
    return { broke: true, destroyed: !!w.crude, weapon: w, next: state.equipped };
  }
  // Repair cost scales with wear; a broken gun also needs a new trigger group. Crude guns can't be repaired.
  function repairCost(state, id, durMul = 1) {
    const w = BY_ID[id];
    if (!w || w.crude || !state.owned.includes(id)) return null;
    const mx = maxDur(w, state.mods[id] || [], durMul), f = 1 - Math.min(1, (state.cond[id] || 0) / mx);
    if (f <= 0.02) return null;
    const k = 1 + w.tier * 0.5, cost = { metal: Math.ceil(6 * k * f), spring: Math.ceil(2 * f) };
    if (state.broken.includes(id)) cost.trigger = 1;
    return cost;
  }
  function repair(state, id, ctx) {
    const w = BY_ID[id], cost = repairCost(state, id, ctx.durMul);
    if (!cost) return { ok: false, reason: w?.crude ? 'Crude guns can\'t be repaired' : 'Nothing to repair' };
    if (w.tier > ctx.bench) return { ok: false, reason: w.tier === 1 && ctx.bench === 0 ? 'Repair it at your Lockup workshop' : `Needs a level ${w.tier} workshop` };
    if (!ctx.spend(cost)) return { ok: false, reason: 'Missing materials' };
    state.broken = state.broken.filter((b) => b !== id);
    state.cond[id] = maxDur(w, state.mods[id] || [], ctx.durMul);
    if (!state.equipped) state.equipped = id;
    return { ok: true, cost };
  }
  // What the arms buyer pays: spares at full value; a used gun scales with condition (broken = 20%).
  function usedValue(state, id, durMul = 1) {
    const w = BY_ID[id];
    if (!w) return 0;
    if (state.broken.includes(id)) return Math.round(w.value * 0.2);
    const mx = maxDur(w, state.mods[id] || [], durMul);
    return Math.round(w.value * (0.35 + 0.65 * Math.min(1, (state.cond[id] || 0) / mx)));
  }
  // kind: 'spare' | 'owned'. price multiplier (Dealing skill), buyer demand handled by the caller.
  function sell(state, wallet, id, kind = 'spare', price = 1, durMul = 1) {
    const w = BY_ID[id];
    if (!w) return { ok: false, reason: 'Unknown weapon' };
    if (kind === 'spare') {
      if (!(state.spare[id] > 0)) return { ok: false, reason: 'No spare to sell' };
      state.spare[id] -= 1; if (!state.spare[id]) delete state.spare[id];
      const cash = Math.round(w.value * price); wallet.cash += cash; return { ok: true, cash };
    }
    if (!state.owned.includes(id)) return { ok: false, reason: 'Not yours' };
    const cash = Math.round(usedValue(state, id, durMul) * price);
    state.owned = state.owned.filter((x) => x !== id); state.broken = state.broken.filter((x) => x !== id);
    delete state.mods[id]; delete state.cond[id];
    if (state.equipped === id) state.equipped = usable(state)[0] || null;
    wallet.cash += cash; return { ok: true, cash };
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
  const costText = (cost) => Object.entries(cost).map(([k, n]) => `${n} ${k}`).join(' + ');

  const api = Object.freeze({ WEAPONS, BY_ID, NONE, PLATE, buildPlate, AMMO_CRATE, ARMOR, ABSORB, absorb, MODS, MOD, SPARE_MAX, effective, maxDur, clean, usable, equip, cycle,
    craftBlock, craft, modBlock, craftMod, wear, repairCost, repair, usedValue, sell, pelletAngles, fitMagazine, dps, costText });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftWeaponsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
