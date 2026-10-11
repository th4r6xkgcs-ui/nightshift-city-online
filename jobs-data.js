/* Hustle phone jobs (Claude-owned). Pure and Node-testable; jobs.js runs them in game.
 * Offers rotate every 5 minutes (seeded by time slot, so they are stable within a slot). One active job at a time.
 *  taxi  : drive to the fare, stop, drive to the destination, stop. Pay by distance + speed bonus.
 *  hit   : a marked pedestrian somewhere in the city. Pay on confirmed kill. Lots of heat.
 *  repo  : a specific parked car; take it (MORE -> CAR to steal) and park it at a TUNING garage.
 *  drop  : deliver lab product to a VIP buyer (needs product from the drug lab, lab.js). */
(function (root) {
  'use strict';
  const XS = [440, 880, 1320, 1760], YS = [340, 680, 1020, 1360];
  const SLOT_MS = 5 * 60 * 1000, OFFERS = 4;
  const TYPES = {
    taxi: { name: 'Taxi fare', icon: '🚕', xp: { driving: 70, charisma: 40 } },
    hit: { name: 'Hit contract', icon: '🎯', xp: { shooting: 120, stealth: 40 } },
    repo: { name: 'Repo job', icon: '🚗', xp: { driving: 90, stealth: 60 } },
    drop: { name: 'VIP drop', icon: '💊', xp: { dealing: 120, charisma: 40 } },
  };
  function rng(seed) {
    let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // A random point on a road centre line.
  function roadPoint(r) {
    if (r() < 0.5) return { x: XS[Math.floor(r() * XS.length)], y: Math.round(340 + r() * 1020) };
    return { x: Math.round(440 + r() * 1320), y: YS[Math.floor(r() * YS.length)] };
  }
  const roadDist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y); // grid streets: Manhattan distance
  const slotOf = (now) => Math.floor(now / SLOT_MS);
  // Offers for a time slot. Each: { id, type, ...params, pay, limit (s) }. Hit/repo targets are bound in game.
  function offers(slot, opts = {}) {
    const r = rng('jobs:' + slot), out = [];
    const kinds = ['taxi', 'taxi', 'hit', 'repo', 'drop', 'taxi', 'repo', 'hit'];
    for (let i = 0; i < OFFERS; i++) {
      const type = kinds[Math.floor(r() * kinds.length)], id = `${slot}-${i}`;
      if (type === 'taxi') {
        let a, b, tries = 0;
        do { a = roadPoint(r); b = roadPoint(r); tries++; } while (roadDist(a, b) < 900 && tries < 20);
        const d = roadDist(a, b), par = Math.round(d / 300 + 12);
        out.push({ id, type, from: a, to: b, dist: d, par, limit: par * 2 + 30, pay: Math.round((70 + d / 7) / 5) * 5 });
      } else if (type === 'hit') out.push({ id, type, limit: 180, pay: Math.round((450 + r() * 400) / 25) * 25 });
      else if (type === 'repo') out.push({ id, type, limit: 240, pay: Math.round((500 + r() * 450) / 25) * 25 });
      else out.push({ id, type, to: roadPoint(r), need: 1 + Math.floor(r() * 3), limit: 150, pay: 0 });
    }
    return out;
  }
  // Taxi speed bonus: +30% if delivered within par.
  const taxiPay = (job, seconds) => Math.round(job.pay * (seconds <= job.par ? 1.3 : 1));
  // VIP drop pays for the product at a premium (product values come from the lab catalog).
  const dropPay = (unitValue, n) => Math.round(unitValue * n * 1.6);
  const scale = (pay, rankIndex = 0) => Math.round(pay * (1 + 0.05 * Math.max(0, Math.min(7, rankIndex)))); // +5% per Respect rank

  function clean(raw) {
    const s = { version: 1, done: 0, failed: 0, earned: 0, byType: {}, taken: [] };
    for (const k of ['done', 'failed', 'earned']) s[k] = Number.isSafeInteger(raw?.[k]) && raw[k] > 0 ? Math.min(1e9, raw[k]) : 0;
    for (const t of Object.keys(TYPES)) { const v = raw?.byType?.[t]; if (Number.isSafeInteger(v) && v > 0) s.byType[t] = Math.min(1e7, v); }
    if (Array.isArray(raw?.taken)) s.taken = raw.taken.filter((x) => typeof x === 'string' && /^\d+-\d$/.test(x)).slice(-20);
    return s;
  }

  const api = Object.freeze({ XS, YS, SLOT_MS, OFFERS, TYPES, rng, roadPoint, roadDist, slotOf, offers, taxiPay, dropPay, scale, clean });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftJobsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
