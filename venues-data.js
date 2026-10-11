/* Venues (Claude-owned): the gym and the clubs. Pure and Node-testable; venues.js runs them in game.
 * GYM: pay per session, then a rep minigame (tap when the power bar is in the sweet spot). Each good rep gives
 *      Speed or Toughness XP; a full set also restores some HP. Short cooldown between sessions.
 * CLUB: "work the room": sell lab product to clubbers at a premium, a few units per visit. Each sale risks a
 *       bust (product lost, heat). Stealth lowers the risk, Charisma raises the price. Buying a round networks
 *       (Charisma XP) once per visit. */
(function (root) {
  'use strict';
  const GYMS = [{ id: 'iron', name: 'Iron Works Gym', near: { x: 1400, y: 1435 }, building: 'CLOTHING', dx: -70 }];
  const CLUBS = [
    { id: 'south', name: 'Club Velvet', near: { x: 520, y: 1435 }, building: 'CLUB', dx: 0 },
    { id: 'north', name: 'Neon Room', near: { x: 960, y: 415 }, building: 'CLUB', dx: 0 },
  ];
  const GYM = { fee: 50, reps: 10, cooldownMs: 60 * 1000, xpPerRep: 30, heal: 25 };
  // Sweet spot moves each rep; width shrinks as the set goes on (fatigue).
  function sweet(rep, rnd = Math.random) {
    const w = Math.max(0.12, 0.3 - rep * 0.015), c = w / 2 + rnd() * (1 - w);
    return { from: c - w / 2, to: c + w / 2 };
  }
  const bar = (t, speed = 1.2) => { const p = (t * speed) % 2; return p < 1 ? p : 2 - p; };
  // Gym result: XP split between Speed (athletics) and Toughness by the chosen workout.
  function gymXp(goodReps, workout) {
    const xp = goodReps * GYM.xpPerRep;
    return workout === 'cardio' ? { athletics: xp } : workout === 'weights' ? { toughness: xp } : { athletics: Math.round(xp / 2), toughness: Math.round(xp / 2) };
  }
  const CLUB = { maxPerVisit: 4, premium: 1.3, bustBase: 0.12, bustHeat: 2, roundCost: 100, roundXp: 60, cooldownMs: 3 * 60 * 1000 };
  // Bust chance per sale: lower with Stealth (stealth.heat < 1 means better), never below 3%.
  const bustChance = (stealthHeatMod = 1) => Math.max(0.03, CLUB.bustBase * Math.min(1, stealthHeatMod));
  const clubPrice = (value, charismaMod = 1) => Math.round(value * CLUB.premium * Math.max(1, charismaMod));
  function clean(raw, now = Date.now()) {
    const s = { version: 1, gymAt: 0, sessions: 0, clubAt: {}, sold: 0, busts: 0, rounds: {} };
    if (Number.isFinite(raw?.gymAt) && raw.gymAt > 0 && raw.gymAt <= now + GYM.cooldownMs) s.gymAt = raw.gymAt;
    for (const c of CLUBS) {
      const t = raw?.clubAt?.[c.id]; if (Number.isFinite(t) && t > 0 && t <= now + CLUB.cooldownMs) s.clubAt[c.id] = t;
      const r = raw?.rounds?.[c.id]; if (Number.isFinite(r) && r > 0 && r <= now + CLUB.cooldownMs) s.rounds[c.id] = r;
    }
    for (const k of ['sessions', 'sold', 'busts']) s[k] = Number.isSafeInteger(raw?.[k]) && raw[k] > 0 ? Math.min(1e8, raw[k]) : 0;
    return s;
  }

  const api = Object.freeze({ GYMS, CLUBS, GYM, CLUB, sweet, bar, gymXp, bustChance, clubPrice, clean });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftVenuesData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
