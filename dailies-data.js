/* Daily + weekly challenges (Claude-owned). Pure and Node-testable; dailies.js runs them in game.
 * Every local day: 3 different challenges, chosen deterministically from the date. Every ISO week: 1 bigger one.
 * Progress = (current lifetime stat) - (baseline captured when the day/week started), so nothing is retroactive.
 * Clearing all 3 dailies on consecutive days builds a streak: +10% daily rewards per day (max +50%) and a bonus. */
(function (root) {
  'use strict';
  // stat: a lifetime counter (see dailies.js `stats`). n: amounts by tier. unit: display divisor/suffix.
  const POOL = [
    { id: 'delivery', text: 'Finish {n} deliveries', stat: 'delivery', n: [2, 3, 4], cash: 150, xp: 'driving' },
    { id: 'salvage', text: 'Search {n} salvage crates', stat: 'salvage', n: [3, 4, 6], cash: 90, xp: 'luck' },
    { id: 'sold', text: 'Sell {n} units of product', stat: 'sold', n: [5, 8, 12], cash: 40, xp: 'dealing' },
    { id: 'batches', text: 'Complete {n} grow batches', stat: 'batches', n: [1, 2, 3], cash: 220, xp: 'farming' },
    { id: 'escapes', text: 'Lose the cops {n} time(s)', stat: 'escapes', n: [1, 1, 2], cash: 400, xp: 'stealth' },
    { id: 'drive', text: 'Drive {n} km', stat: 'drove', n: [3000, 5000, 8000], unit: 1000, suffix: ' km', cash: 0.09, xp: 'driving' },
    { id: 'run', text: 'Run {n} km on foot', stat: 'walked', n: [1500, 2500, 4000], unit: 1000, suffix: ' km', cash: 0.16, xp: 'athletics' },
    { id: 'shots', text: 'Fire {n} rounds', stat: 'shots', n: [60, 100, 150], cash: 4, xp: 'shooting' },
    { id: 'casino', text: 'Place {n} casino bets', stat: 'casinoSpins', n: [5, 8, 12], cash: 35, xp: 'luck' },
    { id: 'races', text: 'Finish {n} street race(s)', stat: 'raceRuns', n: [1, 2, 3], cash: 250, xp: 'driving' },
    { id: 'jobs', text: 'Finish {n} Hustle phone job(s)', stat: 'jobsDone', n: [1, 2, 3], cash: 200, xp: 'charisma' },
    { id: 'gym', text: 'Finish {n} gym set(s)', stat: 'gymSessions', n: [1, 2, 2], cash: 150, xp: 'toughness' },
    { id: 'fish', text: 'Land {n} catches', stat: 'fishCaught', n: [4, 6, 10], cash: 50, xp: 'fishing' },
    { id: 'earn', text: 'Earn ${n}', stat: 'earned', n: [1500, 2500, 4000], cash: 0.2, xp: 'charisma' },
  ];
  const BY_ID = Object.fromEntries(POOL.map((c) => [c.id, c]));
  const DAILY_COUNT = 3, WEEK_MULT = 6, WEEK_BONUS = 2.5, STREAK_STEP = 0.1, STREAK_MAX = 5;

  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function weekKey(d) { // ISO week, e.g. 2026-W41
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return `${t.getUTCFullYear()}-W${pad(Math.ceil(((t - y0) / 86400000 + 1) / 7))}`;
  }
  function prevDay(key) { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d - 1)); }
  // Small deterministic PRNG seeded from a string (FNV-1a + mulberry32).
  function rng(seed) {
    let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const reward = (c, n, mult = 1) => Math.round((c.cash < 1 ? c.cash * n : c.cash * n) * mult / 10) * 10;
  function picks(day) {
    const r = rng('daily:' + day), pool = POOL.map((c) => c.id), out = [];
    while (out.length < DAILY_COUNT) {
      const id = pool.splice(Math.floor(r() * pool.length), 1)[0], c = BY_ID[id], tier = Math.floor(r() * c.n.length);
      out.push({ id, n: c.n[tier], cash: reward(c, c.n[tier]), xp: c.xp, xpAmount: 60 + tier * 40 });
    }
    return out;
  }
  function weekly(week) {
    const r = rng('weekly:' + week), c = POOL[Math.floor(r() * POOL.length)], n = c.n[1] * WEEK_MULT;
    return { id: c.id, n, cash: reward(c, n, WEEK_BONUS), xp: c.xp, xpAmount: 400 };
  }
  const label = (p) => { const c = BY_ID[p.id]; const v = c.unit ? p.n / c.unit : p.n; return c.text.replace('{n}', v.toLocaleString()) + (c.suffix && !c.text.includes('km') ? c.suffix : ''); };
  const fmtProgress = (p, done) => { const c = BY_ID[p.id], d = Math.min(done, p.n); return c.unit ? `${(d / c.unit).toFixed(1)}/${p.n / c.unit}${c.suffix}` : `${Math.floor(d).toLocaleString()}/${p.n.toLocaleString()}`; };
  const streakMult = (streak) => 1 + STREAK_STEP * Math.min(STREAK_MAX, Math.max(0, streak));

  // Progress for one challenge; a counter that went backwards (restore/reset) is re-baselined by the caller.
  const progress = (p, base, stats) => Math.max(0, (Number(stats[BY_ID[p.id].stat]) || 0) - (Number(base[BY_ID[p.id].stat]) || 0));

  function clean(raw) {
    const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
    const s = { version: 1, day: '', base: {}, claimed: [], week: '', weekBase: {}, weekClaimed: false, streak: 0, lastFull: '', best: 0 };
    if (typeof raw?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.day)) s.day = raw.day;
    if (typeof raw?.week === 'string' && /^\d{4}-W\d{2}$/.test(raw.week)) s.week = raw.week;
    if (typeof raw?.lastFull === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastFull)) s.lastFull = raw.lastFull;
    for (const k of ['base', 'weekBase']) for (const [stat, v] of Object.entries(raw?.[k] || {})) if (/^[a-zA-Z]{1,20}$/.test(stat)) s[k][stat] = num(v);
    if (Array.isArray(raw?.claimed)) s.claimed = raw.claimed.filter((i) => Number.isSafeInteger(i) && i >= 0 && i < DAILY_COUNT).filter((v, i, a) => a.indexOf(v) === i);
    s.weekClaimed = raw?.weekClaimed === true;
    s.streak = Number.isSafeInteger(raw?.streak) && raw.streak > 0 ? Math.min(10000, raw.streak) : 0;
    s.best = Math.max(s.streak, Number.isSafeInteger(raw?.best) && raw.best > 0 ? Math.min(10000, raw.best) : 0);
    return s;
  }
  // Rolls the day/week over when needed. Returns { newDay, newWeek, streakBroken }.
  function roll(s, now, stats) {
    const day = dayKey(now), week = weekKey(now), out = { newDay: false, newWeek: false, streakBroken: false };
    if (s.day !== day) {
      if (s.streak && s.lastFull !== prevDay(day) && s.lastFull !== day) { s.streak = 0; out.streakBroken = true; }
      s.day = day; s.base = { ...stats }; s.claimed = []; out.newDay = true;
    }
    if (s.week !== week) { s.week = week; s.weekBase = { ...stats }; s.weekClaimed = false; out.newWeek = true; }
    for (const k of Object.keys(stats)) { // counters that went backwards are re-baselined, never negative
      if ((stats[k] || 0) < (s.base[k] || 0)) s.base[k] = stats[k];
      if ((stats[k] || 0) < (s.weekBase[k] || 0)) s.weekBase[k] = stats[k];
    }
    return out;
  }
  // Marks newly finished challenges; returns rewards to pay: [{kind, index?, cash, xp, xpAmount, text}].
  function claim(s, now, stats) {
    const pays = [], today = picks(s.day), mult = streakMult(s.streak);
    today.forEach((p, i) => {
      if (s.claimed.includes(i) || progress(p, s.base, stats) < p.n) return;
      s.claimed.push(i);
      pays.push({ kind: 'daily', index: i, cash: Math.round(p.cash * mult), xp: p.xp, xpAmount: p.xpAmount, text: label(p) });
    });
    if (s.claimed.length === DAILY_COUNT && s.lastFull !== s.day) {
      s.streak = s.lastFull === prevDay(s.day) ? s.streak + 1 : 1;
      s.lastFull = s.day; s.best = Math.max(s.best, s.streak);
      pays.push({ kind: 'streak', cash: 250 * Math.min(7, s.streak), text: `Daily streak ×${s.streak}` });
    }
    const w = weekly(s.week);
    if (!s.weekClaimed && progress(w, s.weekBase, stats) >= w.n) { s.weekClaimed = true; pays.push({ kind: 'weekly', cash: w.cash, xp: w.xp, xpAmount: w.xpAmount, text: label(w) }); }
    return pays;
  }

  const api = Object.freeze({ POOL, BY_ID, DAILY_COUNT, dayKey, weekKey, prevDay, picks, weekly, label, fmtProgress, progress, streakMult, clean, roll, claim });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftDailiesData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
