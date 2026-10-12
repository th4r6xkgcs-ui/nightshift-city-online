/* Hidden stashes (Claude-owned). Pure and Node-testable; stashes.js runs them in game.
 * 30 hidden packages tucked into alleys, yards and lots (walkable points >70 px off road centre lines,
 * verified against the game's blocked() map). Walk over one to grab cash + salvage parts. A faint glint shows
 * within GLINT px. Finding 10/20/30 pays milestone bonuses. A $250 "rumor" on the phone marks a rough area. */
(function (root) {
  'use strict';
  const RAW = [[60, 60], [60, 420], [60, 760], [60, 1280], [60, 1580], [260, 240], [320, 520], [340, 1620], [360, 940], [520, 120],
    [760, 260], [800, 580], [800, 1100], [800, 1620], [960, 60], [1240, 460], [1240, 780], [1240, 1100], [1240, 1440], [1400, 180],
    [1680, 540], [1680, 880], [1680, 1220], [1680, 1620], [1840, 60], [2120, 120], [2120, 420], [2120, 820], [2120, 1220], [2120, 1620]];
  const SPOTS = RAW.map(([x, y], i) => ({ id: 's' + String(i + 1).padStart(2, '0'), x, y }));
  const BY_ID = Object.fromEntries(SPOTS.map((s) => [s.id, s]));
  const GLINT = 150, PICKUP = 34, RUMOR_PRICE = 250, RUMOR_FUZZ = 140;
  const MILESTONES = [{ n: 5, cash: 1000 }, { n: 10, cash: 2500 }, { n: 20, cash: 6000 }, { n: 30, cash: 20000 }];
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Fixed per stash so a guide/wiki stays true: cash, scrap, sometimes parts and a collectible.
  function reward(id) {
    const h = hash('stash:' + id), r = (k) => ((h >>> k) & 255) / 255;
    const out = { cash: 150 + Math.round(r(0) * 45) * 10, items: { scrap: 2 + Math.floor(r(8) * 3) } };
    if (r(16) < 0.45) out.items.parts = 1 + Math.floor(r(4) * 2);
    if (r(24) < 0.2) out.items[r(12) < 0.5 ? 'watch' : 'jewelry'] = 1;
    return out;
  }
  const count = (s) => Object.keys(s.found).length;
  // Milestones reached by going from `before` to `after` finds.
  const milestones = (before, after) => MILESTONES.filter((m) => before < m.n && after >= m.n);
  // A rumored area around a random unfound stash: centre offset by up to RUMOR_FUZZ, radius RUMOR_FUZZ + 40.
  function rumor(state, rnd = Math.random) {
    const left = SPOTS.filter((s) => !state.found[s.id]);
    if (!left.length) return null;
    const s = left[Math.floor(rnd() * left.length)], a = rnd() * Math.PI * 2, d = rnd() * RUMOR_FUZZ;
    return { id: s.id, x: Math.round(s.x + Math.cos(a) * d), y: Math.round(s.y + Math.sin(a) * d), r: RUMOR_FUZZ + 40 };
  }
  function clean(raw) {
    const s = { version: 1, found: {}, rumor: null, earned: 0 };
    for (const [id, t] of Object.entries(raw?.found || {})) if (BY_ID[id] && Number.isSafeInteger(t) && t > 0) s.found[id] = t;
    const r = raw?.rumor;
    if (r && BY_ID[r.id] && !s.found[r.id] && [r.x, r.y, r.r].every(Number.isFinite)) s.rumor = { id: r.id, x: r.x, y: r.y, r: r.r };
    s.earned = Number.isSafeInteger(raw?.earned) && raw.earned > 0 ? Math.min(1e9, raw.earned) : 0;
    return s;
  }
  // Applies a find. pocket: item counts (Codex inventory pocket); returns { cash, items, bonus } or null.
  function take(state, id, now = Date.now()) {
    if (!BY_ID[id] || state.found[id]) return null;
    const before = count(state), r = reward(id);
    state.found[id] = now;
    if (state.rumor?.id === id) state.rumor = null;
    const bonus = milestones(before, before + 1).reduce((t, m) => t + m.cash, 0);
    state.earned = Math.min(1e9, state.earned + r.cash + bonus);
    return { cash: r.cash, items: r.items, bonus, total: before + 1 };
  }

  const api = Object.freeze({ SPOTS, BY_ID, GLINT, PICKUP, RUMOR_PRICE, RUMOR_FUZZ, MILESTONES, reward, count, milestones, rumor, clean, take });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftStashesData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
