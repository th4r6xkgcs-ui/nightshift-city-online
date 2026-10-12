/* Your stash house (Claude-owned). Pure and Node-testable; safehouse.js runs it in game.
 * Clear out a rival trap house (every crew member down) and you can TAKE IT OVER. Then it's yours:
 *  - store product (weed / coke / pills) and cash there; your crew slowly sells the stored product (a passive
 *    income at street-ish prices) and the takings pile up in the stash;
 *  - rival crews notice a fat stash: raids hit every so often, taking a share of product and unprotected cash;
 *  - security cuts the raid odds and the losses: door, alarm, cameras (warn you so you can rush back and DEFEND it
 *    in person), a guard dog, hired guards (paid from the stash), and a safe that protects cash.
 * Multiplayer-ready: the stash + security is plain JSON, the same shape another player's raid would read later. */
(function (root) {
  'use strict';
  const TAKEOVER = 12000;
  const PRODUCTS = { weed: { name: 'Weed', icon: '🌿', price: 60 }, coke: { name: 'Coke', icon: '❄️', price: 150 }, pills: { name: 'Pills', icon: '💊', price: 35 } };
  const CAP = 400; // per product
  const UPGRADES = [
    { id: 'door', name: 'Door', icon: '🚪', levels: ['Rotten door', 'Steel door', 'Reinforced door', 'Vault door'], prices: [0, 2500, 6000, 15000], sec: 0.12 },
    { id: 'alarm', name: 'Alarm', icon: '🚨', levels: ['No alarm', 'Alarm system'], prices: [0, 3000], sec: 0.12 },
    { id: 'cameras', name: 'Cameras', icon: '📹', levels: ['No cameras', 'CCTV + phone alerts'], prices: [0, 4000], sec: 0.06 },
    { id: 'dog', name: 'Guard dog', icon: '🐕‍🦺', levels: ['No dog', 'Guard dog'], prices: [0, 2500], sec: 0.1 },
    { id: 'guards', name: 'Hired guards', icon: '🕴️', levels: ['No guards', '1 guard', '2 guards'], prices: [0, 5000, 9000], sec: 0.12 },
    { id: 'safe', name: 'Safe', icon: '🔐', levels: ['Cash in a shoebox', 'Floor safe (protects 50%)', 'Vault safe (protects 90%)'], prices: [0, 4000, 12000], sec: 0 },
  ];
  const UP = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
  const SAFE_PROTECT = [0, 0.5, 0.9];
  const GUARD_WAGE = 120; // per guard per real hour, paid from the stash cash
  const SELL_RATE = { weed: 8, coke: 4, pills: 10 }; // units per real hour your crew moves
  const SELL_CUT = 0.7; // they take 30%
  const RAID_CHECK_MS = 15 * 60 * 1000, RAID_COOLDOWN_MS = 45 * 60 * 1000, WARN_MS = 90 * 1000;

  const empty = () => ({ owned: false, at: 0, cash: 0, stock: { weed: 0, coke: 0, pills: 0 }, acc: { weed: 0, coke: 0, pills: 0 }, sec: { door: 0, alarm: 0, cameras: 0, dog: 0, guards: 0, safe: 0 }, lastTick: 0, lastRaid: 0, raids: 0, repelled: 0, lost: 0, sold: 0, earned: 0, log: [] });
  function clean(raw, now = Date.now()) {
    const s = { version: 1, houses: {}, cleared: {} };
    for (const [id, h] of Object.entries(raw?.houses || {})) {
      if (typeof id !== 'string' || !/^bi-stash-[a-z]+$/.test(id)) continue;
      const e = empty(); e.owned = h?.owned === true; e.at = Number.isFinite(h?.at) ? h.at : 0;
      e.cash = Number.isFinite(h?.cash) ? Math.max(0, Math.min(1e9, Math.round(h.cash))) : 0;
      for (const k of Object.keys(PRODUCTS)) { const v = h?.stock?.[k], a = h?.acc?.[k]; e.stock[k] = Number.isSafeInteger(v) ? Math.max(0, Math.min(CAP, v)) : 0; e.acc[k] = Number.isFinite(a) ? Math.max(0, Math.min(0.999, a)) : 0; }
      for (const u of UPGRADES) { const v = h?.sec?.[u.id]; e.sec[u.id] = Number.isSafeInteger(v) ? Math.max(0, Math.min(u.levels.length - 1, v)) : 0; }
      for (const k of ['lastTick', 'lastRaid']) e[k] = Number.isFinite(h?.[k]) && h[k] <= now ? h[k] : 0;
      for (const k of ['raids', 'repelled', 'lost', 'sold', 'earned']) e[k] = Number.isSafeInteger(h?.[k]) && h[k] > 0 ? h[k] : 0;
      e.log = (Array.isArray(h?.log) ? h.log : []).filter((x) => typeof x?.text === 'string' && Number.isFinite(x.at)).slice(-8).map((x) => ({ text: x.text.slice(0, 140), at: x.at }));
      if (e.owned) s.houses[id] = e;
    }
    for (const [id, t] of Object.entries(raw?.cleared || {})) if (/^bi-stash-[a-z]+$/.test(id) && Number.isFinite(t) && now - t < 60 * 60 * 1000) s.cleared[id] = t;
    return s;
  }
  const owns = (s, id) => !!s.houses[id]?.owned;
  const security = (h) => Math.min(0.9, UPGRADES.reduce((t, u) => t + u.sec * (h.sec[u.id] || 0), 0));
  const value = (h) => h.cash + Object.entries(h.stock).reduce((t, [k, n]) => t + n * PRODUCTS[k].price, 0);
  function takeOver(s, wallet, id, now = Date.now()) {
    if (owns(s, id)) return { ok: false, reason: 'Already yours' };
    if (!s.cleared[id] || now - s.cleared[id] > 60 * 60 * 1000) return { ok: false, reason: 'Clear the crew out first (every one of them down), then come back within the hour' };
    if (!(wallet.cash >= TAKEOVER)) return { ok: false, reason: `Takeover costs $${TAKEOVER.toLocaleString()} (new locks, a cleaner, a word with the landlord)` };
    wallet.cash -= TAKEOVER; const h = empty(); h.owned = true; h.at = now; h.lastTick = now; h.lastRaid = now; s.houses[id] = h; delete s.cleared[id];
    return { ok: true, house: h };
  }
  function upgrade(s, wallet, id, upId) {
    const h = s.houses[id], u = UP[upId]; if (!h || !u) return { ok: false, reason: 'Not yours' };
    const lv = h.sec[upId], next = lv + 1; if (next >= u.levels.length) return { ok: false, reason: 'Maxed out' };
    const price = u.prices[next]; if (!(wallet.cash >= price)) return { ok: false, reason: `Needs $${price.toLocaleString()}` };
    wallet.cash -= price; h.sec[upId] = next; return { ok: true, level: next, name: u.levels[next], price };
  }
  // Move product between your pocket and the stash. dir: +1 store, -1 take.
  function moveProduct(h, pocket, k, n, dir) {
    if (!PRODUCTS[k] || !(n > 0)) return 0;
    if (dir > 0) { const m = Math.min(n, pocket[k] || 0, CAP - h.stock[k]); pocket[k] = (pocket[k] || 0) - m; h.stock[k] += m; return m; }
    const m = Math.min(n, h.stock[k]); h.stock[k] -= m; pocket[k] = (pocket[k] || 0) + m; return m;
  }
  function moveCash(h, wallet, n, dir) { if (!(n > 0)) return 0; const m = dir > 0 ? Math.min(n, wallet.cash) : Math.min(n, h.cash); if (dir > 0) { wallet.cash -= m; h.cash += m; } else { h.cash -= m; wallet.cash += m; } return m; }
  // Time passes: the crew sells stored product, guards get paid. Returns what happened.
  function tick(h, now = Date.now(), priceMod = 1) {
    const hrs = Math.max(0, Math.min(24, (now - (h.lastTick || now)) / 3600000)); h.lastTick = now;
    let earned = 0, sold = 0;
    if (!h.acc) h.acc = { weed: 0, coke: 0, pills: 0 };
    for (const [k, rate] of Object.entries(SELL_RATE)) {
      if (!h.stock[k]) { h.acc[k] = 0; continue; }
      const a = (h.acc[k] || 0) + rate * hrs, n = Math.min(h.stock[k], Math.floor(a)); h.acc[k] = n < Math.floor(a) ? 0 : a - Math.floor(a);
      if (n > 0) { h.stock[k] -= n; sold += n; earned += Math.round(n * PRODUCTS[k].price * SELL_CUT * priceMod); }
    }
    h.cash += earned; h.sold += sold; h.earned += earned;
    const wage = Math.round(h.sec.guards * GUARD_WAGE * hrs); let quit = false;
    if (wage > 0) { if (h.cash >= wage) h.cash -= wage; else { h.cash = 0; h.sec.guards = Math.max(0, h.sec.guards - 1); quit = true; } }
    return { earned, sold, wage, quit };
  }
  // Is a raid coming? (called every RAID_CHECK_MS) rnd in [0,1).
  function raidRoll(h, now = Date.now(), rnd = Math.random) {
    if (now - h.lastRaid < RAID_COOLDOWN_MS) return false;
    const v = value(h); if (v < 3000) return false;
    const chance = Math.min(0.5, 0.1 + v / 120000) * (1 - security(h));
    return rnd() < chance;
  }
  // Undefended raid: losses scale down with security; the safe protects part of the cash.
  function raidLoss(h, now = Date.now()) {
    const sec = security(h), frac = Math.max(0.05, 0.6 - sec * 0.6), protect = SAFE_PROTECT[h.sec.safe] || 0;
    const took = { cash: Math.floor(h.cash * (1 - protect) * frac) };
    for (const k of Object.keys(PRODUCTS)) { took[k] = Math.floor(h.stock[k] * frac); h.stock[k] -= took[k]; }
    h.cash -= took.cash; h.lastRaid = now; h.raids += 1; h.lost += took.cash + Object.keys(PRODUCTS).reduce((t, k) => t + took[k] * PRODUCTS[k].price, 0);
    return took;
  }
  function repelled(h, now = Date.now()) { h.lastRaid = now; h.raids += 1; h.repelled += 1; }
  // How many raiders show up when you defend (your guards and dog thin them out).
  const raiders = (h) => Math.max(2, 3 + Math.round(value(h) / 15000) - h.sec.guards - h.sec.dog);
  function log(h, text, now = Date.now()) { h.log.push({ text, at: now }); h.log = h.log.slice(-8); }

  const api = Object.freeze({ TAKEOVER, PRODUCTS, CAP, UPGRADES, UP, SAFE_PROTECT, GUARD_WAGE, SELL_RATE, SELL_CUT, RAID_CHECK_MS, RAID_COOLDOWN_MS, WARN_MS, clean, owns, security, value, takeOver, upgrade, moveProduct, moveCash, tick, raidRoll, raidLoss, repelled, raiders, log });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftSafehouseData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
