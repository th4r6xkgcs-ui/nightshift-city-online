/* Properties (Claude-owned, v0.64): real storefronts in the outer districts you can buy, upgrade and defend.
 * Pure and Node-testable; property.js runs it in game. Multiplayer-ready: every property has a stable id from its
 * building ("p-<x>-<y>"), and the save keeps an `owner` per property so a server can later hold one shared map.
 *  - catalog(buildings, regionAt): which buildings are for sale (shops, diners, clothing, clubs, garages, warehouses,
 *    gas stations) outside the starting core, priced by type and district.
 *  - income accrues in the register in real time (offline too) up to a cap; collect it in person.
 *  - upgrades: STOCK (+25% income per level), SECURITY (cameras/alarm: fewer robberies, better odds), GUARD (a
 *    hired guard who fights robbers when you're there and holds the door when you're not).
 *  - robberies: a chance per hour from register size and security; resolve live (you fight) or on the odds. */
(function (root) {
  'use strict';
  const TYPES = {
    'CORNER SHOP': { kind: 'shop', icon: '🏪', price: 6000, perHour: 140 },
    DINER: { kind: 'diner', icon: '🍔', price: 9000, perHour: 210 },
    CLOTHING: { kind: 'boutique', icon: '👟', price: 12000, perHour: 280 },
    GARAGE: { kind: 'garage', icon: '🔧', price: 15000, perHour: 340 },
    WAREHOUSE: { kind: 'warehouse', icon: '📦', price: 20000, perHour: 430 },
    GAS: { kind: 'gas', icon: '⛽', price: 26000, perHour: 560 },
    CLUB: { kind: 'club', icon: '🪩', price: 45000, perHour: 950 },
  };
  const REGION_MULT = { DOWNTOWN: 1.6, 'THE HEIGHTS': 1.4, 'MARKET DISTRICT': 1.3, FAIRVIEW: 1.0, 'OLD TOWN': 0.9, HARBOR: 0.9, IRONWORKS: 0.85, 'THE FLATS': 0.8 };
  const CAP_HOURS = 6, MAX_LEVEL = 3, SELL_BACK = 0.6;
  const SECURITY = [1, 0.6, 0.35, 0.2]; // robbery rate multiplier per security level
  const BASE_ROBBERY_PER_HOUR = 0.35;
  const idOf = (b) => `p-${Math.round(b.x)}-${Math.round(b.y)}`;
  const round = (n, to = 100) => Math.round(n / to) * to;

  function catalog(buildings, regionAt) {
    const out = [];
    for (const b of buildings || []) {
      if (!b || (b.x < 2200 && b.y < 1700)) continue; // the starting core stays as it is
      const key = b.lot === 'gas' ? 'GAS' : b.name, T = TYPES[key]; if (!T) continue;
      let reg = null; try { reg = regionAt ? regionAt(b.x + b.w / 2, b.y + b.h / 2) : null; } catch { /* n/a */ }
      const rname = reg?.name || reg || 'CITY', m = REGION_MULT[rname] || 1;
      out.push({ id: idOf(b), type: key, kind: T.kind, icon: T.icon, region: rname, price: round(T.price * m), perHour: Math.round(T.perHour * m), door: { x: b.x + b.w / 2 - 46, y: b.y + b.h + 12 }, b: { x: b.x, y: b.y, w: b.w, h: b.h } });
    }
    return out;
  }
  const upgradeCost = (p, kind, lvl) => (lvl >= MAX_LEVEL ? null : round(p.price * (kind === 'stock' ? 0.25 : kind === 'security' ? 0.2 : 0.3) * (lvl + 1)));
  const rate = (p, o) => p.perHour * (1 + 0.25 * (o?.stock || 0));
  const cap = (p, o) => Math.round(rate(p, o) * CAP_HOURS);

  function clean(raw, now = Date.now()) {
    const s = { version: 1, props: {}, earned: 0, robbed: 0, defended: 0 };
    for (const [id, r] of Object.entries(raw?.props || {})) {
      if (!/^p-\d+-\d+$/.test(id) || !r || typeof r !== 'object') continue;
      const lv = (k) => (Number.isSafeInteger(r[k]) ? Math.max(0, Math.min(MAX_LEVEL, r[k])) : 0);
      s.props[id] = { owner: typeof r.owner === 'string' ? r.owner.slice(0, 40) : 'local', since: Number.isFinite(r.since) && r.since <= now ? r.since : now, last: Number.isFinite(r.last) && r.last <= now ? r.last : now,
        register: Number.isFinite(r.register) ? Math.max(0, Math.floor(r.register)) : 0, stock: lv('stock'), security: lv('security'), guard: r.guard === true, paid: Number.isSafeInteger(r.paid) && r.paid > 0 ? r.paid : 0 };
    }
    for (const k of ['earned', 'robbed', 'defended']) if (Number.isSafeInteger(raw?.[k]) && raw[k] > 0) s[k] = Math.min(1e12, raw[k]);
    return s;
  }
  // move time forward: fill registers up to their caps
  function accrue(s, byId, now = Date.now()) {
    for (const [id, o] of Object.entries(s.props)) {
      const p = byId[id]; if (!p) continue;
      const hrs = Math.max(0, now - o.last) / 3600000; o.last = now;
      o.register = Math.min(cap(p, o), o.register + rate(p, o) * hrs);
    }
  }
  function buy(s, p, wallet, owner = 'local', now = Date.now()) {
    if (!p) return { ok: false, reason: 'Not for sale' };
    if (s.props[p.id]) return { ok: false, reason: 'Already yours' };
    if (!wallet || wallet.cash < p.price) return { ok: false, reason: `Need $${p.price.toLocaleString()}` };
    wallet.cash -= p.price; s.props[p.id] = { owner, since: now, last: now, register: 0, stock: 0, security: 0, guard: false, paid: p.price };
    return { ok: true };
  }
  function collect(s, p, wallet, now = Date.now()) {
    const o = s.props[p?.id]; if (!o) return 0; accrue(s, { [p.id]: p }, now);
    const n = Math.floor(o.register); if (n <= 0) return 0; o.register -= n; wallet.cash += n; s.earned += n; return n;
  }
  function upgrade(s, p, kind, wallet) {
    const o = s.props[p?.id]; if (!o) return { ok: false, reason: 'Not yours' };
    if (kind === 'guard') { if (o.guard) return { ok: false, reason: 'Already guarded' }; const c = round(p.price * 0.3); if (wallet.cash < c) return { ok: false, reason: `Need $${c}` }; wallet.cash -= c; o.guard = true; o.paid += c; return { ok: true, cost: c }; }
    if (kind !== 'stock' && kind !== 'security') return { ok: false, reason: 'Unknown upgrade' };
    const c = upgradeCost(p, kind, o[kind]); if (c === null) return { ok: false, reason: 'Maxed out' };
    if (wallet.cash < c) return { ok: false, reason: `Need $${c}` };
    wallet.cash -= c; o[kind]++; o.paid += c; return { ok: true, cost: c, level: o[kind] };
  }
  function sell(s, p, wallet) { const o = s.props[p?.id]; if (!o) return 0; const n = Math.round(p.price * SELL_BACK + (o.paid - p.price) * 0.5) + Math.floor(o.register); delete s.props[p.id]; wallet.cash += n; return n; }
  // chance that a robbery starts in the next `sec` seconds (bigger registers attract more)
  function robberyChance(p, o, sec) {
    if (!o) return 0; const fill = Math.min(1, o.register / Math.max(1, cap(p, o)));
    return BASE_ROBBERY_PER_HOUR * SECURITY[o.security || 0] * (0.3 + fill) * (sec / 3600);
  }
  const defendChance = (o) => Math.min(0.92, 0.25 + 0.17 * (o?.security || 0) + (o?.guard ? 0.3 : 0));
  const robberyLoss = (o) => Math.floor((o?.register || 0) * (o?.security >= 2 ? 0.45 : 0.7));
  const totalPending = (s, byId, now = Date.now()) => { accrue(s, byId, now); return Object.values(s.props).reduce((t, o) => t + Math.floor(o.register), 0); };
  const perHour = (s, byId) => Object.entries(s.props).reduce((t, [id, o]) => t + (byId[id] ? rate(byId[id], o) : 0), 0);

  const api = Object.freeze({ TYPES, REGION_MULT, CAP_HOURS, MAX_LEVEL, SECURITY, idOf, catalog, upgradeCost, rate, cap, clean, accrue, buy, collect, upgrade, sell, robberyChance, defendChance, robberyLoss, totalPending, perHour });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftPropertyData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
