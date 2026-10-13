/* Street gangs (Claude-owned, pure data + rules; Node-testable).
 * Six gangs each hold a cluster of city blocks ("turf") in one district. Members hang out on their corners in their
 * colours. Reputation per gang (-100..100): HOSTILE (<= -30) shoots on sight, WARY (-29..29) warns you off and
 * fights if you push it (shooting on their turf, loitering in their face, hurting one of them), FRIENDLY (>= 30)
 * nods you through, sells to you and gives you work against their rivals.
 * Save: nightshift-gangs-v1 (rep, tribute cooldowns, fallen members' respawn timers, current job).
 * API: NightshiftGangsData.{GANGS, BY_ID, BLOCK, turfAt, blockRect, spots, relation, clean, change, tribute, jobFor, outfit} */
(function (root) {
  'use strict';
  const BLOCK = { w: 440, h: 340 };
  // ci = colour index in the wardrobe "street" palette (0 red, 1 blue, 2 yellow, 3 green, 4 purple, 8 black)
  const GANGS = [
    { id: 'market', name: 'Market Street Mob', short: 'MSM', color: '#1d2024', glow: '#c9d1d6', ci: 8, district: 'MARKET DISTRICT', blocks: [[5, 5], [6, 5], [5, 6]], rival: 'diablos', vibe: 'all black, gold chains, old money' },
    { id: 'diablos', name: 'Los Diablos', short: 'LD', color: '#c84659', glow: '#ff7a8a', ci: 0, district: 'OLD TOWN', blocks: [[1, 6], [2, 6], [2, 7]], rival: 'kings', vibe: 'red flags, lowriders, loyal to the block' },
    { id: 'kings', name: 'Blue Ridge Kings', short: 'BRK', color: '#3d7fc6', glow: '#7cb8ff', ci: 1, district: 'FAIRVIEW', blocks: [[2, 11], [3, 11], [3, 12]], rival: 'saints', vibe: 'blue rags, suburban money, quick tempers' },
    { id: 'tape', name: 'Yellow Tape Boys', short: 'YTB', color: '#e2b75c', glow: '#ffe08a', ci: 2, district: 'IRONWORKS', blocks: [[11, 6], [12, 6], [12, 7]], rival: 'rats', vibe: 'work vests, chop shops, stolen parts' },
    { id: 'saints', name: 'Violet Saints', short: 'VS', color: '#6d73be', glow: '#a9adff', ci: 4, district: 'THE FLATS', blocks: [[6, 11], [7, 11], [7, 12]], rival: 'kings', vibe: 'purple, clubs, they run the night' },
    { id: 'rats', name: 'Dock Rats', short: 'DR', color: '#2f8f6a', glow: '#6fe0b0', ci: 3, district: 'HARBOR', blocks: [[11, 12], [12, 12], [12, 13]], rival: 'tape', vibe: 'green, smugglers, know every container' },
  ];
  const BY_ID = Object.fromEntries(GANGS.map((g) => [g.id, g]));
  // Your own crew (blocks you take over). ci 6 = magenta in the street palette.
  const PLAYER = { id: 'you', name: 'Your crew', short: 'NS', color: '#a34a8a', glow: '#ff7ad8', ci: 6 };
  // Guard gear tiers you buy for the people watching your corners.
  const GEAR = [
    { id: 0, name: 'Pipe pistol', cost: 0, hp: 60, dmg: 6, cool: [1700, 2500], range: 220, err: 0.24, vest: false },
    { id: 1, name: 'Street pistol', cost: 400, hp: 80, dmg: 8, cool: [950, 1500], range: 260, err: 0.18, vest: false },
    { id: 2, name: 'Viper SMG + vest', cost: 900, hp: 115, dmg: 6, cool: [380, 620], range: 240, err: 0.2, vest: true },
    { id: 3, name: 'Carbine + plates', cost: 1800, hp: 150, dmg: 12, cool: [700, 1100], range: 340, err: 0.11, vest: true },
  ];
  const GANG_GEAR = { hp: 55, dmg: 7, cool: [1400, 2300], range: 280, err: 0.2 };
  const HIRE_COST = 250, MAX_GUARDS = 4, HOLD_S = 20, PERIOD_MS = 5 * 60000, MAX_PERIODS = 6;
  const income = (guards) => 60 + 15 * Math.max(0, guards | 0);
  const blockKey = (bx, by) => bx + ',' + by;
  const ownerOf = (s, bx, by) => (s.owned[blockKey(bx, by)] ? 'you' : turfAt(bx * BLOCK.w + 1, by * BLOCK.h + 1)?.gang.id || null);
  function claim(s, bx, by, from, now = Date.now()) { const k = blockKey(bx, by); if (s.owned[k] || !BY_ID[from]) return false; s.owned[k] = { from, since: now, cashAt: now, guards: [], nextRaid: now + (6 + Math.random() * 4) * 60000 }; change(s, from, -25); return true; }
  function lose(s, bx, by) { const k = blockKey(bx, by); if (!s.owned[k]) return false; delete s.owned[k]; return true; }
  function hire(s, bx, by, wallet) { const o = s.owned[blockKey(bx, by)]; if (!o) return { ok: false, reason: 'Not your block' }; if (o.guards.length >= MAX_GUARDS) return { ok: false, reason: 'Corner is fully staffed' }; if (!wallet || wallet.cash < HIRE_COST) return { ok: false, reason: `Needs $${HIRE_COST}` }; wallet.cash -= HIRE_COST; o.guards.push({ id: 'g' + Date.now().toString(36) + o.guards.length, tier: 0 }); return { ok: true }; }
  function upgrade(s, bx, by, i, wallet) { const o = s.owned[blockKey(bx, by)], gd = o?.guards?.[i]; if (!gd) return { ok: false, reason: 'No such guard' }; const nx = GEAR[gd.tier + 1]; if (!nx) return { ok: false, reason: 'Best gear already' }; if (!wallet || wallet.cash < nx.cost) return { ok: false, reason: `Needs $${nx.cost}` }; wallet.cash -= nx.cost; gd.tier += 1; return { ok: true, gear: nx }; }
  // Money your corner made since you last collected (capped so you still have to come by).
  function collect(s, bx, by, wallet, now = Date.now()) { const o = s.owned[blockKey(bx, by)]; if (!o) return 0; const n = Math.min(MAX_PERIODS, Math.floor((now - o.cashAt) / PERIOD_MS)); if (n <= 0) return 0; const amt = n * income(o.guards.length); o.cashAt += n * PERIOD_MS; if (now - o.cashAt > PERIOD_MS) o.cashAt = now; if (wallet) wallet.cash += amt; return amt; }
  const pending = (s, bx, by, now = Date.now()) => { const o = s.owned[blockKey(bx, by)]; if (!o) return 0; return Math.min(MAX_PERIODS, Math.floor((now - o.cashAt) / PERIOD_MS)) * income(o.guards.length); };
  // Off-screen counterattack: your guards' firepower vs. a squad of 3-5.
  const power = (o) => (o?.guards || []).reduce((a, gd) => a + 1 + gd.tier * 0.9, 0);
  function defendChance(o, threat = 4) { const p = power(o); return p <= 0 ? 0.08 : p / (p + threat * 0.9); }
  const blockRect = (bx, by) => ({ x: bx * BLOCK.w, y: by * BLOCK.h, w: BLOCK.w, h: BLOCK.h });
  function turfAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const bx = Math.floor(x / BLOCK.w), by = Math.floor(y / BLOCK.h);
    for (const g of GANGS) for (const [gx, gy] of g.blocks) if (gx === bx && gy === by) return { gang: g, bx, by };
    return null;
  }
  // Where members stand on a block: two corner groups on the front sidewalk, one seat on a stoop.
  function spots(bx, by) {
    const x = bx * BLOCK.w, y = by * BLOCK.h, out = [];
    const groups = [{ cx: x + 118, cy: y + 278, n: 3 }, { cx: x + 304, cy: y + 278, n: 2 }];
    groups.forEach((gr, gi) => { for (let i = 0; i < gr.n; i++) { const a = (i / gr.n) * Math.PI * 2 + gi; out.push({ x: gr.cx + Math.cos(a) * 15, y: gr.cy + Math.sin(a) * 9, face: { x: gr.cx, y: gr.cy }, group: gi }); } });
    out.push({ x: x + 330, y: y + 262, sit: true, face: { x: x + 304, y: y + 278 }, group: 1 });
    return out;
  }
  const relation = (rep) => (rep <= -30 ? 'HOSTILE' : rep >= 30 ? 'FRIENDLY' : 'WARY');
  function clean(raw = {}, now = Date.now()) {
    const s = { version: 1, rep: {}, tributeAt: {}, dead: {}, job: null, kills: 0 };
    for (const g of GANGS) {
      const r = raw?.rep?.[g.id]; s.rep[g.id] = Number.isFinite(r) ? Math.max(-100, Math.min(100, Math.round(r))) : 0;
      const t = raw?.tributeAt?.[g.id]; s.tributeAt[g.id] = Number.isFinite(t) && t > 0 ? Math.min(t, now + 15 * 60000) : 0;
    }
    for (const [k, t] of Object.entries(raw?.dead || {})) if (typeof k === 'string' && k.length < 40 && Number.isFinite(t) && t > now) s.dead[k] = Math.min(t, now + 10 * 60000);
    const j = raw?.job; if (j && BY_ID[j.from] && BY_ID[j.target] && Number.isFinite(j.need) && Number.isFinite(j.done)) s.job = { from: j.from, target: j.target, need: Math.max(1, Math.min(6, j.need)), done: Math.max(0, Math.min(6, j.done)), pay: Math.max(0, Math.min(2000, j.pay || 0)) };
    s.kills = Number.isSafeInteger(raw?.kills) ? Math.max(0, raw.kills) : 0;
    s.owned = {};
    for (const [k, o] of Object.entries(raw?.owned || {})) {
      const m = /^(\d{1,2}),(\d{1,2})$/.exec(k); if (!m || !o || !BY_ID[o.from]) continue; const t = turfAt(+m[1] * BLOCK.w + 1, +m[2] * BLOCK.h + 1); if (!t) continue;
      s.owned[k] = { from: o.from, since: Number.isFinite(o.since) ? o.since : now, cashAt: Number.isFinite(o.cashAt) ? Math.min(o.cashAt, now) : now, nextRaid: Number.isFinite(o.nextRaid) ? Math.min(o.nextRaid, now + 15 * 60000) : now + 8 * 60000,
        guards: (Array.isArray(o.guards) ? o.guards : []).slice(0, MAX_GUARDS).filter((gd) => gd && typeof gd.id === 'string').map((gd) => ({ id: gd.id.slice(0, 24), tier: Math.max(0, Math.min(GEAR.length - 1, gd.tier | 0)) })) };
    }
    s.hideoutAt = {}; for (const g of GANGS) { const t = raw?.hideoutAt?.[g.id]; s.hideoutAt[g.id] = Number.isFinite(t) && t > 0 ? Math.min(t, now + 40 * 60000) : 0; }
    return s;
  }
  function change(s, id, n) { if (!BY_ID[id] || !Number.isFinite(n)) return false; s.rep[id] = Math.max(-100, Math.min(100, Math.round((s.rep[id] || 0) + n))); return true; }
  // Paying respect: $100 for +12 rep, once per 10 minutes per gang. Doesn't work once they're out for your blood.
  function tribute(s, id, wallet, now = Date.now()) {
    const g = BY_ID[id]; if (!g) return { ok: false, reason: 'Unknown gang' };
    if ((s.rep[id] || 0) <= -60) return { ok: false, reason: `${g.name} won't take your money` };
    if (now < (s.tributeAt[id] || 0)) return { ok: false, reason: 'You paid them recently' };
    if (!wallet || !(wallet.cash >= 100)) return { ok: false, reason: 'Needs $100' };
    wallet.cash -= 100; s.tributeAt[id] = now + 10 * 60000; change(s, id, 12); return { ok: true, rep: s.rep[id] };
  }
  // A job from a friendly gang: drop some of their rival's soldiers on the rival's turf.
  function jobFor(s, id) { const g = BY_ID[id]; if (!g || relation(s.rep[id] || 0) !== 'FRIENDLY') return null; return { from: id, target: g.rival, need: 3, done: 0, pay: 350 }; }
  // Gang colours on a street outfit (base from the wardrobe NPC generator).
  function outfit(base, g, seed) {
    const o = JSON.parse(JSON.stringify(base || {})), r = ((seed >>> 0) % 5);
    if (o.outer && ['hoodie', 'track', 'puffer'].includes(o.outer.id)) o.outer.color = g.ci; else o.outer = { id: r < 2 ? 'hoodie' : r < 4 ? 'track' : 'leather', color: r < 4 ? g.ci : 0 };
    o.top = { id: r % 2 ? 'tee' : 'tank', color: r % 2 ? g.ci : 1 };
    if (g.ci === 0 || g.ci === 1) o.face = r === 0 ? { id: 'bandana', color: g.ci === 0 ? 0 : 2 } : o.face && o.face.id === 'shades' ? o.face : null;
    o.head = r === 1 ? { id: 'cap', color: g.ci, back: true } : r === 2 ? { id: 'beanie', color: g.ci } : r === 3 ? { id: 'durag', color: 6 } : o.head || null;
    if (g.id === 'market') { o.jewelry = { id: 'chain', color: 0 }; o.outer = { id: r < 3 ? 'leather' : 'track', color: r < 3 ? 3 : 8 }; }
    if (g.id === 'tape') o.outer = { id: 'vest', color: 1 };
    if (g.id === 'rats') o.head = { id: 'beanie', color: 3 };
    return o;
  }
  // Your crew's look (magenta), with gear: vests at tier 2+.
  function crewOutfit(base, tier, seed) { const o = outfit(base, PLAYER, seed); if (tier >= 2) o.outer = { id: 'vest', color: 0 }; o.head = tier >= 3 ? { id: 'beanie', color: 8 } : o.head; return o; }
  const api = Object.freeze({ GANGS, BY_ID, PLAYER, GEAR, GANG_GEAR, HIRE_COST, MAX_GUARDS, HOLD_S, PERIOD_MS, BLOCK, turfAt, blockRect, blockKey, ownerOf, spots, relation, clean, change, tribute, jobFor, outfit, crewOutfit,
    claim, lose, hire, upgrade, collect, pending, income, power, defendChance });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NightshiftGangsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
