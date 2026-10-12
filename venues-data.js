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
  const clubPrice = (value, charismaMod = 1, bonus = 0) => Math.round(value * (CLUB.premium + Math.max(0, bonus)) * Math.max(1, charismaMod));
  // ---- Underground fight club (in the gym's back room) ----
  // A ladder of 5 opponents. Each beat the opponent either OPENS up (tap STRIKE) or SWINGS (tap BLOCK) and you
  // have `window` ms to answer. Toughness = more HP and less damage taken; Athletics = a longer reaction window.
  const FIGHTERS = [
    { id: 'kid', name: 'Kid Knuckles', icon: '🥊', hp: 70, hit: 12, window: 1100, purse: 250, fee: 50 },
    { id: 'sal', name: 'Big Sal', icon: '🐻', hp: 110, hit: 17, window: 940, purse: 650, fee: 100 },
    { id: 'lou', name: 'Lightning Lou', icon: '⚡', hp: 140, hit: 22, window: 790, purse: 1500, fee: 200 },
    { id: 'wall', name: 'The Wall', icon: '🧱', hp: 200, hit: 27, window: 690, purse: 3200, fee: 400 },
    { id: 'mara', name: 'Iron Mara', icon: '👑', hp: 250, hit: 33, window: 600, purse: 7500, fee: 800 },
  ];
  const FIGHT = { baseHp: 100, hpPerTough: 2, dmg: 14, dmgPerTough: 0.3, crit: 1.6, critShare: 0.35, counter: 4, chip: 0.4, windowPerAth: 0.015, maxWindowBonus: 0.45, maxBeats: 60, cooldownMs: 90 * 1000, xp: 40 };
  function startFight(index, levels = {}) {
    const f = FIGHTERS[index]; if (!f) return null;
    const tough = Math.max(1, levels.toughness || 1), ath = Math.max(1, levels.athletics || 1);
    const maxHp = FIGHT.baseHp + FIGHT.hpPerTough * (tough - 1);
    return { index, opp: f, oppHp: f.hp, hp: maxHp, maxHp, dmg: Math.round(FIGHT.dmg + FIGHT.dmgPerTough * (tough - 1)),
      taken: Math.max(0.5, 1 - 0.01 * (tough - 1)), window: Math.round(f.window * (1 + Math.min(FIGHT.maxWindowBonus, FIGHT.windowPerAth * (ath - 1)))), beats: 0 };
  }
  // Higher tiers swing more often.
  // FEINT: a fake-out — any button press gets punished; wait it out.
  function nextBeat(fight, rnd = Math.random) {
    const r = rnd(), feint = 0.07 * fight.index, open = 0.52 - 0.04 * fight.index;
    return { kind: r < feint ? 'feint' : r < feint + open ? 'open' : 'swing' };
  }
  // action: 'strike' | 'block' | null (too slow). ms: reaction time.
  function resolveBeat(fight, beat, action, ms) {
    fight.beats++;
    if (beat.kind === 'feint') {
      if (action) { fight.hp = Math.max(0, fight.hp - Math.max(1, Math.round(fight.opp.hit * 0.8 * fight.taken))); return { result: 'baited', end: fight.hp <= 0 ? 'lose' : null }; }
      return { result: 'read', end: null };
    }
    const inTime = action && Number.isFinite(ms) && ms >= 0 && ms <= fight.window, right = inTime && ((beat.kind === 'open' && action === 'strike') || (beat.kind === 'swing' && action === 'block'));
    let result;
    if (right && beat.kind === 'open') { const crit = ms <= fight.window * FIGHT.critShare; fight.oppHp -= Math.round(fight.dmg * (crit ? FIGHT.crit : 1)); result = crit ? 'crit' : 'hit'; }
    else if (right) { fight.oppHp -= FIGHT.counter; result = 'blocked'; }
    else { const k = beat.kind === 'swing' ? 1 : FIGHT.chip; fight.hp -= Math.max(1, Math.round(fight.opp.hit * k * fight.taken)); result = beat.kind === 'swing' ? 'hurt' : 'whiff'; }
    fight.oppHp = Math.max(0, fight.oppHp); fight.hp = Math.max(0, fight.hp);
    let end = fight.oppHp <= 0 ? 'win' : fight.hp <= 0 ? 'lose' : null;
    if (!end && fight.beats >= FIGHT.maxBeats) end = fight.oppHp / fight.opp.hp < fight.hp / fight.maxHp ? 'win' : 'lose'; // judges' decision
    return { result, end };
  }
  // You can fight anyone up to one above your best win.
  const canFight = (state, index) => index >= 0 && index < FIGHTERS.length && index <= (state.ladder || 0);

  function clean(raw, now = Date.now()) {
    const s = { version: 1, gymAt: 0, sessions: 0, clubAt: {}, sold: 0, busts: 0, rounds: {} };
    if (Number.isFinite(raw?.gymAt) && raw.gymAt > 0 && raw.gymAt <= now + GYM.cooldownMs) s.gymAt = raw.gymAt;
    for (const c of CLUBS) {
      const t = raw?.clubAt?.[c.id]; if (Number.isFinite(t) && t > 0 && t <= now + CLUB.cooldownMs) s.clubAt[c.id] = t;
      const r = raw?.rounds?.[c.id]; if (Number.isFinite(r) && r > 0 && r <= now + CLUB.cooldownMs) s.rounds[c.id] = r;
    }
    for (const k of ['sessions', 'sold', 'busts', 'fights', 'wins']) s[k] = Number.isSafeInteger(raw?.[k]) && raw[k] > 0 ? Math.min(1e8, raw[k]) : 0;
    s.ladder = Number.isSafeInteger(raw?.ladder) && raw.ladder > 0 ? Math.min(FIGHTERS.length, raw.ladder) : 0;
    s.fightAt = Number.isFinite(raw?.fightAt) && raw.fightAt > 0 && raw.fightAt <= now + FIGHT.cooldownMs ? raw.fightAt : 0;
    s.purses = Number.isSafeInteger(raw?.purses) && raw.purses > 0 ? Math.min(1e10, raw.purses) : 0;
    return s;
  }

  const api = Object.freeze({ GYMS, CLUBS, GYM, CLUB, FIGHTERS, FIGHT, startFight, nextBeat, resolveBeat, canFight, sweet, bar, gymXp, bustChance, clubPrice, clean });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftVenuesData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
