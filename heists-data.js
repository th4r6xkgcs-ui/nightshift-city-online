/* Bank heists (Claude-owned). Pure and Node-testable; heists.js runs them in game.
 * Stages: DRILL (stay within reach of the vault door while police respond; leaving too long or dying fails)
 * -> ESCAPE (carry the bag: lose all heat, or stash it at your apartment) -> PAID.
 * Each bank has a long real-time cooldown. Payout scales with Respect rank and gets a Luck roll. */
(function (root) {
  'use strict';
  const BANKS = [
    { id: 'west', name: 'West End Savings', near: { x: 520, y: 1095 }, dx: -60, base: 6000 },
    { id: 'east', name: 'Harbor Trust', near: { x: 1840, y: 755 }, dx: -60, base: 9000 },
  ];
  const DRILL_S = 25, LEAVE_GRACE_S = 3, REACH = 95, LEAVE = 150, COOLDOWN_MS = 20 * 60 * 1000;
  const HOME = { x: 880, y: 680 }, HOME_REACH = 110;
  // Drill time shrinks with Stealth (better planning) down to 60%.
  const drillTime = (stealthMod = 1) => Math.round(DRILL_S * Math.max(0.6, Math.min(1, 1 / Math.max(1, stealthMod))));
  function payout(bank, rankIndex = 0, luckMod = 1, rnd = Math.random) {
    const rank = 1 + 0.08 * Math.max(0, Math.min(7, rankIndex));
    const luck = 1 + (Math.max(1, luckMod) - 1) * rnd(); // up to +100% at max Luck rare mod 2.0
    const spread = 0.85 + rnd() * 0.3;
    return Math.round((bank.base * rank * luck * spread) / 50) * 50;
  }
  // Advances a running heist. ctx: { now(s), dist (to vault), heat, hp, homeDist }. Returns 'ok'|'escape'|'paid'|'fail:<why>'.
  function step(run, ctx) {
    if (ctx.hp <= 0) return run.stage === 'escape' ? 'fail:you went down and lost the bag' : 'fail:you went down';
    if (run.stage === 'drill') {
      if (ctx.dist > LEAVE) { run.away = (run.away || 0) + (ctx.now - (run.last ?? ctx.now)); if (run.away > LEAVE_GRACE_S) return 'fail:you abandoned the vault'; }
      else if (ctx.dist <= REACH) { run.away = 0; run.progress = (run.progress || 0) + (ctx.now - (run.last ?? ctx.now)); }
      run.last = ctx.now;
      if (run.progress >= run.drill) { run.stage = 'escape'; return 'escape'; }
      return 'ok';
    }
    if (run.stage === 'escape') {
      run.last = ctx.now;
      if (ctx.heat <= 0 || ctx.homeDist <= HOME_REACH) { run.stage = 'paid'; return 'paid'; }
      return 'ok';
    }
    return 'ok';
  }
  function clean(raw, now = Date.now()) {
    const s = { version: 1, cooldown: {}, done: 0, failed: 0, best: 0, total: 0 };
    for (const b of BANKS) { const t = raw?.cooldown?.[b.id]; if (Number.isFinite(t) && t > now) s.cooldown[b.id] = Math.min(t, now + COOLDOWN_MS); }
    for (const k of ['done', 'failed', 'best', 'total']) s[k] = Number.isSafeInteger(raw?.[k]) && raw[k] > 0 ? Math.min(1e10, raw[k]) : 0;
    return s;
  }
  const ready = (s, bankId, now = Date.now()) => !(s.cooldown[bankId] > now);

  const api = Object.freeze({ BANKS, DRILL_S, LEAVE_GRACE_S, REACH, LEAVE, COOLDOWN_MS, HOME, HOME_REACH, drillTime, payout, step, clean, ready });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftHeistsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
