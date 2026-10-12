/* The Broker's contracts (Claude-owned). Pure and Node-testable; hitman.js + breakin.js run them in game.
 * Premium hits inside a building: the mark lives in one of the break-in locations (suburb houses, the Halvorsen
 * Estate, the two city warehouses) with extra bodyguards. Get in, find the mark (gold ▼), take them down, walk out.
 * Pay rises with your Hitman rank; bonuses for no alarm (silent) and no other bodies (clean). If the alarm goes off,
 * the mark makes a run for the back door after a while; if they get out, the contract fails.
 * All names are fictional. */
(function (root) {
  'use strict';
  const RANKS = [{ name: 'Rookie', at: 0 }, { name: 'Cleaner', at: 3 }, { name: 'Professional', at: 8 }, { name: 'Specialist', at: 15 }, { name: 'Silent Assassin', at: 25 }];
  const LOCS = [
    { id: 'bi-pg-1', type: 'house', where: '14 Palm Ave, Palm Grove', zone: 'suburbs' }, { id: 'bi-pg-2', type: 'house', where: '22 Palm Ave, Palm Grove', zone: 'suburbs' },
    { id: 'bi-pg-3', type: 'house', where: '30 Palm Ave, Palm Grove', zone: 'suburbs' }, { id: 'bi-pg-4', type: 'house', where: '7 Grove Ln, Palm Grove', zone: 'suburbs' },
    { id: 'bi-pg-5', type: 'house', where: '19 Grove Ln, Palm Grove', zone: 'suburbs' }, { id: 'bi-pg-6', type: 'house', where: '25 Grove Ln, Palm Grove', zone: 'suburbs' },
    { id: 'bi-wh-west', type: 'warehouse', where: 'Westside warehouse, back door', zone: 'city' }, { id: 'bi-wh-docks', type: 'warehouse', where: 'Dockside warehouse, back door', zone: 'city' },
    { id: 'bi-pg-mansion', type: 'mansion', where: 'The Halvorsen Estate, Palm Grove', zone: 'suburbs' },
  ];
  const TIER = {
    house: { pay: [1500, 2600], guards: 1, hp: 60, rank: 0 },
    warehouse: { pay: [3200, 5200], guards: 2, hp: 80, rank: 1 },
    mansion: { pay: [7000, 12000], guards: 3, hp: 110, rank: 2 },
  };
  const MARKS = [
    ['Vinnie "Two Phones" Russo', 'Loan shark. Leans on the wrong people.', '#7a2a2a'], ['Dr. Ilse Brandt', 'Patches up anyone for cash, talks to anyone for more.', '#e8e6e0'],
    ['Marco Vale', 'Runs guns through the docks without paying tax.', '#2f4a3a'], ['Sasha Kroll', 'Keeps the books for people who hate audits.', '#5a2a8a'],
    ['"Big" Tony Albanese', 'Fight promoter who fixes bouts.', '#c9a24a'], ['Desmond Pike', 'Snitch. Has a lawyer on speed dial.', '#3d7fd0'],
    ['Nina Halvorsen-Cole', 'Heiress with a smuggling habit.', '#e86a8a'], ['Rafael "Ghost" Ortega', 'Ex-cop selling evidence back to its owners.', '#1d2433'],
    ['Lev Marchetti', 'Counterfeiter. His twenties are almost perfect.', '#5e7a3a'], ['Carla Dunne', 'Real-estate fixer who burns buildings for insurance.', '#d8843a'],
  ];
  const OFFER_MS = 20 * 60 * 1000, EXPIRE_MS = 30 * 60 * 1000;
  const BONUS = { silent: 0.5, clean: 0.25 };

  const rankOf = (done) => { let i = 0; RANKS.forEach((r, k) => { if (done >= r.at) i = k; }); return { index: i, name: RANKS[i].name, next: RANKS[i + 1] || null }; };
  const rankMult = (done) => 1 + rankOf(done).index * 0.15;
  const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  // Three offers per 20-minute window; higher ranks unlock warehouses and the estate.
  function offers(s, now = Date.now()) {
    const win = Math.floor(now / OFFER_MS), r = rngOf(win * 2654435761 + 17), rk = rankOf(s.done).index, out = [];
    const pool = LOCS.filter((l) => TIER[l.type].rank <= rk);
    for (let k = 0; k < 3; k++) {
      const loc = k === 2 && rk >= 2 ? LOCS.find((l) => l.type === 'mansion') : pool[Math.floor(r() * pool.length)];
      if (out.some((o) => o.loc.id === loc.id)) continue;
      const T = TIER[loc.type], m = MARKS[Math.floor(r() * MARKS.length)];
      const pay = Math.round(((T.pay[0] + r() * (T.pay[1] - T.pay[0])) * rankMult(s.done)) / 50) * 50;
      out.push({ id: `c${win}-${k}`, loc, type: loc.type, name: m[0], why: m[1], color: m[2], pay, guards: T.guards + (rk >= 3 ? 1 : 0), hp: T.hp, armed: loc.type !== 'house' || r() < 0.5, until: (win + 1) * OFFER_MS });
    }
    return out;
  }
  function clean(raw, now = Date.now()) {
    const s = { version: 1, done: 0, failed: 0, earned: 0, silent: 0, active: null, taken: [] };
    for (const k of ['done', 'failed', 'earned', 'silent']) { const v = raw?.[k]; if (Number.isSafeInteger(v) && v > 0) s[k] = v; }
    const a = raw?.active;
    if (a && typeof a.id === 'string' && LOCS.some((l) => l.id === a.loc?.id) && Number.isFinite(a.pay) && a.pay > 0 && a.pay < 1e6 && Number.isFinite(a.expires) && a.expires > now)
      s.active = { id: a.id, loc: LOCS.find((l) => l.id === a.loc.id), type: LOCS.find((l) => l.id === a.loc.id).type, name: String(a.name).slice(0, 40), why: String(a.why || '').slice(0, 80), color: /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : '#7a2a2a', pay: Math.round(a.pay), guards: Math.max(0, Math.min(5, a.guards | 0)), hp: Math.max(40, Math.min(200, a.hp | 0)), armed: !!a.armed, expires: a.expires };
    s.taken = (Array.isArray(raw?.taken) ? raw.taken : []).filter((x) => typeof x === 'string').slice(-12);
    return s;
  }
  function accept(s, offer, now = Date.now()) {
    if (s.active) return { ok: false, reason: 'Finish or drop your current contract first' };
    if (!offer || s.taken.includes(offer.id)) return { ok: false, reason: 'That contract is gone' };
    if (offer.until <= now) return { ok: false, reason: 'Offer expired' };
    s.active = { ...offer, expires: now + EXPIRE_MS }; delete s.active.until; s.taken.push(offer.id); s.taken = s.taken.slice(-12);
    return { ok: true, contract: s.active };
  }
  function drop(s) { if (!s.active) return { ok: false, reason: 'No contract' }; s.active = null; s.failed += 1; return { ok: true }; }
  // result = { killed, alarm, otherKills, escaped }
  function complete(s, result) {
    const c = s.active; if (!c) return { ok: false, reason: 'No contract' };
    s.active = null;
    if (!result?.killed) { s.failed += 1; return { ok: true, paid: 0, failed: true, reason: result?.escaped ? 'The mark got away' : 'The mark is still breathing' }; }
    const silent = !result.alarm, cleanJob = !(result.otherKills > 0);
    const pay = Math.round(c.pay * (1 + (silent ? BONUS.silent : 0) + (cleanJob ? BONUS.clean : 0)));
    const before = rankOf(s.done).index;
    s.done += 1; s.earned += pay; if (silent) s.silent += 1;
    const after = rankOf(s.done);
    return { ok: true, paid: pay, silent, clean: cleanJob, rankUp: after.index > before ? after.name : null };
  }
  const expired = (s, now = Date.now()) => !!s.active && s.active.expires <= now;

  const api = Object.freeze({ RANKS, LOCS, TIER, MARKS, OFFER_MS, EXPIRE_MS, BONUS, rankOf, rankMult, offers, clean, accept, drop, complete, expired });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftHitmanData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
