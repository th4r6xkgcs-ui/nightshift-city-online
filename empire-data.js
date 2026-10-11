/* Empire (Claude-owned): legit front businesses that earn passive income in real time (offline too), capped so
 * players come back to collect. Managers (levels 1-3) raise income. Pure and Node-testable; empire.js runs it. */
(function (root) {
  'use strict';
  const FRONTS = [
    { id: 'laundromat', name: 'Suds Laundromat', icon: '🧺', price: 15000, perHour: 450, capHours: 8 },
    { id: 'carwash', name: 'Shine Car Wash', icon: '🚿', price: 30000, perHour: 900, capHours: 8 },
    { id: 'cabs', name: 'Night Cab Co.', icon: '🚕', price: 55000, perHour: 1600, capHours: 8 },
    { id: 'club', name: 'Club Velvet stake', icon: '🪩', price: 100000, perHour: 3000, capHours: 8 },
    { id: 'tower', name: 'Harbor Tower penthouse', icon: '🏙️', price: 250000, perHour: 7000, capHours: 10 },
  ];
  const BY_ID = Object.fromEntries(FRONTS.map((f) => [f.id, f]));
  const MANAGER_MAX = 3;
  const rate = (f, mgr = 0) => f.perHour * (1 + 0.5 * Math.max(0, Math.min(MANAGER_MAX, mgr)));
  const managerPrice = (f, mgr) => (mgr >= MANAGER_MAX ? null : Math.round(f.price * 0.5 * (mgr + 1)));
  const disc = (d) => Math.max(0.5, Math.min(1, d));

  function clean(raw, now = Date.now()) {
    const s = { version: 1, fronts: {}, collected: 0 };
    for (const f of FRONTS) {
      const r = raw?.fronts?.[f.id];
      if (!r || r.owned !== true) continue;
      const since = Number.isFinite(r.since) && r.since > 0 && r.since <= now ? r.since : now;
      s.fronts[f.id] = { owned: true, mgr: Number.isSafeInteger(r.mgr) ? Math.max(0, Math.min(MANAGER_MAX, r.mgr)) : 0, since };
    }
    s.collected = Number.isSafeInteger(raw?.collected) && raw.collected > 0 ? Math.min(1e12, raw.collected) : 0;
    return s;
  }
  // Uncollected income for one front at `now` (capped).
  function pending(s, id, now = Date.now()) {
    const f = BY_ID[id], r = s.fronts[id];
    if (!f || !r) return 0;
    const hours = Math.min(f.capHours, Math.max(0, now - r.since) / 3600000);
    return Math.floor(rate(f, r.mgr) * hours);
  }
  const totalPending = (s, now = Date.now()) => FRONTS.reduce((t, f) => t + pending(s, f.id, now), 0);
  const perHour = (s) => FRONTS.reduce((t, f) => t + (s.fronts[f.id] ? rate(f, s.fronts[f.id].mgr) : 0), 0);
  function collect(s, now = Date.now()) {
    let cash = 0;
    for (const f of FRONTS) { if (!s.fronts[f.id]) continue; cash += pending(s, f.id, now); s.fronts[f.id].since = now; }
    s.collected += cash;
    return cash;
  }
  function buy(s, wallet, id, d = 1, now = Date.now()) {
    const f = BY_ID[id];
    if (!f) return { ok: false, reason: 'Unknown business' };
    if (s.fronts[id]) return { ok: false, reason: 'Already yours' };
    const price = Math.round(f.price * disc(d));
    if (!(wallet.cash >= price)) return { ok: false, reason: 'Not enough cash' };
    wallet.cash -= price; s.fronts[id] = { owned: true, mgr: 0, since: now };
    return { ok: true, price };
  }
  function hire(s, wallet, id, d = 1, now = Date.now()) {
    const f = BY_ID[id], r = s.fronts[id];
    if (!f || !r) return { ok: false, reason: 'Buy the business first' };
    const base = managerPrice(f, r.mgr);
    if (base === null) return { ok: false, reason: 'Fully staffed' };
    const price = Math.round(base * disc(d));
    if (!(wallet.cash >= price)) return { ok: false, reason: 'Not enough cash' };
    const owed = pending(s, id, now); // bank income at the old rate first
    wallet.cash -= price; wallet.cash += owed; s.collected += owed; r.since = now; r.mgr++;
    return { ok: true, price, paidOut: owed };
  }

  const api = Object.freeze({ FRONTS, BY_ID, MANAGER_MAX, rate, managerPrice, clean, pending, totalPending, perHour, collect, buy, hire });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftEmpireData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
