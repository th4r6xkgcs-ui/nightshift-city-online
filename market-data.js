/* Street exchange (Claude-owned). Pure and Node-testable; market.js runs it on the 📱 phone.
 * Five fictional tickers whose prices are a deterministic function of real time (one tick per minute), so
 * prices keep moving while the game is closed and every device sees the same chart. A news line every
 * 10 minutes hints at the ticker with the strongest coming trend (slow wave), but short-term noise can still
 * burn you. Trades cost a 1% fee. Holdings save in nightshift-market-v1. */
(function (root) {
  'use strict';
  const TICK_MS = 60 * 1000, NEWS_SLOTS = 10, FEE = 0.01, MAX_QTY = 100000;
  // Position limit per ticker (market value), growing with Respect rank: $20k … $125k.
  const cap = (rank = 0) => 20000 + 15000 * Math.max(0, Math.min(7, rank));
  const TICKERS = [
    { id: 'NCOIN', name: 'NightCoin', icon: '🪙', base: 120, slow: 0.35, fast: 0.08, noise: 0.12, period: 360, news: ['Whales are loading up on NightCoin', 'NightCoin wallets are dumping fast'] },
    { id: 'DOCK', name: 'Harbor Freight', icon: '⚓', base: 45, slow: 0.22, fast: 0.04, noise: 0.05, period: 540, news: ['Big shipping contract signed at the docks', 'Dock strike rumors spread'] },
    { id: 'NEON', name: 'Neon Leisure', icon: '🪩', base: 70, slow: 0.25, fast: 0.05, noise: 0.06, period: 420, news: ['Neon Leisure clubs are packed every night', 'Health inspectors circle Neon Leisure clubs'] },
    { id: 'CABS', name: 'Metro Cabs', icon: '🚕', base: 28, slow: 0.18, fast: 0.04, noise: 0.04, period: 600, news: ['Metro Cabs wins the airport route', 'Ride apps undercut Metro Cabs'] },
    { id: 'GOLD', name: 'Pawn Gold', icon: '🥇', base: 300, slow: 0.08, fast: 0.015, noise: 0.015, period: 900, news: ['Pawn shops report a gold rush', 'Gold demand cools off downtown'] },
  ];
  const BY_ID = Object.fromEntries(TICKERS.map((t) => [t.id, t]));
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }
  // Smooth value noise in [-1, 1], interpolated between knots every 6 ticks.
  function noise(id, slot) {
    const k = Math.floor(slot / 6), f = (slot / 6) - k, a = hash(id + k) * 2 - 1, b = hash(id + (k + 1)) * 2 - 1, s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  }
  const phase = (id) => hash(id + ':phase') * Math.PI * 2;
  const slowWave = (t, slot) => Math.sin((2 * Math.PI * slot) / t.period + phase(t.id));
  const slotOf = (ms) => Math.floor(ms / TICK_MS);
  function price(id, slot) {
    const t = BY_ID[id]; if (!t) return NaN;
    const x = t.slow * slowWave(t, slot) + t.fast * Math.sin((2 * Math.PI * slot) / 47 + phase(t.id) * 3) + t.noise * noise(t.id, slot);
    return Math.max(1, Math.round(t.base * Math.exp(x) * 100) / 100);
  }
  const history = (id, slot, n = 60) => Array.from({ length: n }, (_, i) => price(id, slot - n + 1 + i));
  // News for a 10-minute window: the ticker whose slow wave moves the most over the next window, and which way.
  function news(slot) {
    const w = Math.floor(slot / NEWS_SLOTS), s0 = w * NEWS_SLOTS;
    let best = null;
    for (const t of TICKERS) {
      const move = t.slow * (slowWave(t, s0 + NEWS_SLOTS * 2) - slowWave(t, s0));
      if (!best || Math.abs(move) > Math.abs(best.move)) best = { id: t.id, move };
    }
    const t = BY_ID[best.id];
    return { window: w, id: t.id, up: best.move > 0, text: `${t.icon} ${t.news[best.move > 0 ? 0 : 1]}` };
  }
  function clean(raw) {
    const s = { version: 1, hold: {}, realized: 0, trades: 0, fees: 0 };
    for (const [id, h] of Object.entries(raw?.hold || {})) {
      if (!BY_ID[id] || !Number.isSafeInteger(h?.qty) || h.qty <= 0 || !Number.isFinite(h?.cost) || h.cost < 0) continue;
      s.hold[id] = { qty: Math.min(MAX_QTY, h.qty), cost: Math.min(1e10, h.cost) };
    }
    if (Number.isFinite(raw?.realized)) s.realized = Math.max(-1e10, Math.min(1e10, Math.round(raw.realized)));
    for (const k of ['trades', 'fees']) s[k] = Number.isSafeInteger(raw?.[k]) && raw[k] > 0 ? Math.min(1e10, raw[k]) : 0;
    return s;
  }
  // cost = total paid including fees (for average-cost P/L).
  function buy(state, wallet, id, qty, px, limit = cap(0)) {
    if (!BY_ID[id] || !Number.isSafeInteger(qty) || qty <= 0 || !(px > 0)) return { ok: false, reason: 'Bad order' };
    const h = state.hold[id] || { qty: 0, cost: 0 };
    if (h.qty + qty > MAX_QTY) return { ok: false, reason: `Max ${MAX_QTY.toLocaleString()} shares per ticker` };
    if ((h.qty + qty) * px > limit) return { ok: false, reason: `Position limit $${limit.toLocaleString()} per ticker (grows with Respect)` };
    const gross = qty * px, fee = Math.max(1, Math.round(gross * FEE)), total = Math.round(gross) + fee;
    if (!(wallet.cash >= total)) return { ok: false, reason: 'Not enough cash' };
    wallet.cash -= total; state.hold[id] = { qty: h.qty + qty, cost: h.cost + total }; state.trades++; state.fees += fee;
    return { ok: true, total, fee };
  }
  function sell(state, wallet, id, qty, px) {
    const h = state.hold[id];
    if (!h || !Number.isSafeInteger(qty) || qty <= 0 || qty > h.qty || !(px > 0)) return { ok: false, reason: 'Bad order' };
    const gross = Math.round(qty * px), fee = Math.max(1, Math.round(gross * FEE)), got = gross - fee, basis = h.cost * (qty / h.qty), pnl = Math.round(got - basis);
    wallet.cash = Math.min(100000000, wallet.cash + got); state.realized += pnl; state.trades++; state.fees += fee;
    if (qty === h.qty) delete state.hold[id]; else state.hold[id] = { qty: h.qty - qty, cost: h.cost - basis };
    return { ok: true, got, fee, pnl };
  }
  // Most shares affordable under cash and the position limit.
  const maxBuy = (state, cash, id, px, limit = cap(0)) => Math.max(0, Math.min(Math.floor((cash - 1) / (px * (1 + FEE))), Math.floor(limit / px) - (state.hold[id]?.qty || 0), MAX_QTY - (state.hold[id]?.qty || 0)));
  const value = (state, slot) => Object.entries(state.hold).reduce((t, [id, h]) => t + h.qty * price(id, slot), 0);

  const api = Object.freeze({ TICK_MS, NEWS_SLOTS, FEE, MAX_QTY, TICKERS, BY_ID, cap, maxBuy, slotOf, price, history, news, clean, buy, sell, value });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftMarketData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
