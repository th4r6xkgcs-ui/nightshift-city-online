/* Respect rank (Claude-owned). Pure and Node-testable; respect.js runs it in game.
 * A long-term meta rank built from everything a player has achieved. Nothing resets; each new rank pays
 * a one-time cash bonus and shows next to the skills chip. */
(function (root) {
  'use strict';
  const RANKS = [
    { min: 0, name: 'Nobody', icon: '👤' },
    { min: 300, name: 'Street Rat', icon: '🐀' },
    { min: 700, name: 'Hustler', icon: '💸' },
    { min: 1300, name: 'Earner', icon: '💼' },
    { min: 2100, name: 'Boss', icon: '🎩' },
    { min: 3200, name: 'Underboss', icon: '🦈' },
    { min: 4600, name: 'Kingpin', icon: '👑' },
    { min: 6500, name: 'Legend', icon: '🌃' },
  ];
  // Respect points from lifetime achievements (all inputs are counts; each source is capped so no single grind dominates).
  const SOURCES = [
    { key: 'skillLevels', label: 'Skill levels', per: 10, cap: 4500 },
    { key: 'goals', label: 'Goals completed', per: 25, cap: 1250 },
    { key: 'gold', label: 'Gold medals', per: 60, cap: 180 },
    { key: 'silver', label: 'Silver medals', per: 35, cap: 105 },
    { key: 'bronze', label: 'Bronze medals', per: 20, cap: 60 },
    { key: 'weapons', label: 'Guns owned', per: 15, cap: 90 },
    { key: 'homeItems', label: 'Home upgrades', per: 20, cap: 100 },
    { key: 'tuneLevels', label: 'Car upgrades', per: 8, cap: 400 },
    { key: 'bestStreak', label: 'Best daily streak', per: 15, cap: 300 },
    { key: 'earned10k', label: 'Money earned ($10k)', per: 1, cap: 200 },
    { key: 'fronts', label: 'Front businesses', per: 60, cap: 300 },
    { key: 'heists', label: 'Bank heists', per: 40, cap: 400 },
    { key: 'events', label: 'City events', per: 10, cap: 300 },
    { key: 'stashes', label: 'Hidden stashes', per: 10, cap: 300 },
    { key: 'ladder', label: 'Fight club ladder', per: 60, cap: 300 },
  ];
  function points(c) {
    let total = 0;
    const parts = SOURCES.map((s) => { const v = Math.max(0, Number(c?.[s.key]) || 0), pts = Math.min(s.cap, Math.floor(v * s.per)); total += pts; return { ...s, value: v, pts }; });
    return { total, parts };
  }
  function rankOf(pts) {
    let i = 0;
    while (i + 1 < RANKS.length && pts >= RANKS[i + 1].min) i++;
    const next = RANKS[i + 1] || null;
    return { index: i, ...RANKS[i], next, toNext: next ? next.min - pts : 0, progress: next ? (pts - RANKS[i].min) / (next.min - RANKS[i].min) : 1 };
  }
  const bonus = (index) => index * 1000; // one-time cash on reaching rank `index`
  function clean(raw) {
    const r = Number.isSafeInteger(raw?.reached) && raw.reached >= 0 ? Math.min(RANKS.length - 1, raw.reached) : 0;
    return { version: 1, reached: r };
  }
  // Returns newly reached ranks (to pay once each) and updates state.
  function advance(state, pts) {
    const now = rankOf(pts).index, out = [];
    for (let i = state.reached + 1; i <= now; i++) out.push({ index: i, ...RANKS[i], cash: bonus(i) });
    if (now > state.reached) state.reached = now;
    return out;
  }
  const MAX_POINTS = SOURCES.reduce((t, s) => t + s.cap, 0);

  const api = Object.freeze({ RANKS, SOURCES, MAX_POINTS, points, rankOf, bonus, clean, advance });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftRespectData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
