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
  const api = Object.freeze({ GANGS, BY_ID, BLOCK, turfAt, blockRect, spots, relation, clean, change, tribute, jobFor, outfit });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NightshiftGangsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
