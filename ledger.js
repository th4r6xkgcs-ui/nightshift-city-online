/* Ledger (Claude-owned): where your money comes from and where it goes, so the economy makes sense at a glance.
 * Watches player.cash (no game file edited). Each change is credited to a category: an explicit tag a module set
 * just before paying (NightshiftLedger.tag('chop')), else the menu you have open, else the zone you're in, else
 * "Street & other" (dealers, couriers, robberies...). 📱 → 📊 LEDGER shows this session and all-time earnings by
 * source with $/hour, your spending, and a "ways to earn" list with typical rates for what you haven't tried yet.
 * Save: nightshift-ledger-v1. API: NightshiftLedger.{tag, open, state, CATS} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const KEY = 'nightshift-ledger-v1';
  const CATS = {
    product: ['🌿', 'Product sales'], supply: ['🔩', 'Supplies & crafting'], guns: ['🔫', 'Gun shop & arms buyer'], chop: ['🔧', 'Chop shop'], breakin: ['🔦', 'Break-ins & fencing'],
    contract: ['🎯', 'Hitman contracts'], cars: ['🚗', 'Cars'], meet: ['🏁', 'Car meet'], casino: ['🎰', 'Casino'], fishing: ['🎣', 'Fishing'], fronts: ['📈', 'Front businesses'],
    market: ['💹', 'Stock market'], jobs: ['📱', 'Phone jobs'], heists: ['🏦', 'Heists'], venues: ['🪩', 'Clubs, gym & fights'], lab: ['⚗️', 'Drug lab'], food: ['🍳', 'Farm & food'],
    home: ['🏠', 'Home & decor'], suburbs: ['🌴', 'Palm Grove shops'], pets: ['🐾', 'Pets'], goals: ['🏆', 'Goals, dailies & rank'], tuning: ['🛠️', 'Tuning'], travel: ['🚌', 'Travel'],
    events: ['🌆', 'City events & stashes'], races: ['🏎️', 'Street races'], other: ['🏙️', 'Street & other'],
  };
  const PANELS = { csPanel: 'casino', emPanel: 'fronts', fsPanel: 'fishing', gsPanel: 'guns', hmPanel: 'home', hsPanel: 'heists', jbPanel: 'jobs', lbPanel: 'lab', mkPanel: 'market', tnPanel: 'tuning',
    vnPanel: 'venues', frPanel: 'food', ptPanel: 'pets', sbPanel: 'suburbs', fdPanel: 'food', fdDiner: 'food', dhPanel: 'home', chPanel: 'chop', cxPanel: 'cars', mtPanel: 'meet', htPanel: 'contract',
    spShop: 'supply', spBench: 'supply', spBag: 'supply', dyPanel: 'goals', glPanel: 'goals', rsPanel: 'goals', znTravel: 'travel' };
  const ZONES = { breakin: 'breakin', farm: 'food', suburbs: 'suburbs', dreamhome: 'home' };
  // Typical rates once you're set up (from the economy sim in tests/supply.cjs and the data files). Shown as guidance.
  const WAYS = [
    ['product', 'Weed: grow plots → trim house → dealers', '~$2,300/h', 'Start'], ['product', 'Pills: pharmacy dumpster → trailer lab → promoter (nights)', '~$3,700/h', 'Start'],
    ['product', 'Coke: smuggler boat (nights) → motel kitchen → dealers', '~$6,500/h', 'Rising'], ['guns', 'Craft spare guns at the Lockup → arms buyer (nights)', '$500–$3,000 per gun', 'Hustle'],
    ['chop', 'Steal cars → Rusty\'s chop shop (hot list pays ×2)', '$600–$1,600 per car', 'Start'], ['breakin', 'Break-ins: houses, warehouses, trap houses, the estate', '$300–$4,000 per job', 'Rising'],
    ['contract', 'Broker contracts (after your first break-in)', '$1,500–$12,000 each', 'Rising'], ['meet', 'Night car meet: show your cars', 'up to $2,500 per car per night', 'Rising'],
    ['fronts', 'Front businesses pay while you\'re away', '$24–$3,000/h passive', 'Hustle'], ['food', 'Farm + cook meals → Diner', '~$1,500/h', 'Rising'],
    ['fishing', 'Fishing at the pier or canal', '~$800/h', 'Start'], ['jobs', 'Phone jobs: taxi, repo, hits, VIP drops', '$150–$900 per job', 'Start'],
    ['heists', 'Bank vault heists (needs a gun)', '$3,000+ per heist', 'Rising'], ['market', 'Stock market: buy the dip, read the news', 'risky', 'Hustle'],
  ];
  let state = { version: 1, all: {}, spent: {}, first: Date.now() };
  try { const raw = JSON.parse(localStorage.getItem(KEY) || '{}'); for (const k of ['all', 'spent']) for (const [c, v] of Object.entries(raw?.[k] || {})) if (CATS[c] && Number.isFinite(v) && v > 0) state[k][c] = Math.min(1e10, Math.round(v)); if (Number.isFinite(raw?.first)) state.first = raw.first; } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
  const session = { start: performance.now(), earned: {}, spent: {} };
  let tagged = null;
  function tag(cat) { if (CATS[cat]) tagged = { cat, at: performance.now() }; }
  function category() {
    if (tagged && performance.now() - tagged.at < 2500) return tagged.cat;
    for (const [id, cat] of Object.entries(PANELS)) { const e = document.getElementById(id); if (e && !e.hidden) return cat; }
    const z = root.NightshiftZones?.active?.(); if (z && ZONES[z]) return ZONES[z];
    return 'other';
  }
  let last = null, dirty = 0;
  setInterval(() => {
    const p = P(); if (!p || !Number.isFinite(p.cash)) return;
    if (last === null) { last = p.cash; return; }
    const d = p.cash - last; last = p.cash; if (!d || Math.abs(d) > 5e7) return;
    const c = category(), book = d > 0 ? 'earned' : 'spent', all = d > 0 ? state.all : state.spent;
    session[book][c] = (session[book][c] || 0) + Math.abs(d); all[c] = (all[c] || 0) + Math.abs(d);
    if (++dirty > 5) { dirty = 0; persist(); }
  }, 200);
  addEventListener('pagehide', persist);

  // ---------------- panel ----------------
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const pnl = el('div', { id: 'lgPanel', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Ledger' }); document.body.append(pnl);
  document.head.append(el('style', {}, `
  #lgPanel .kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:8px 0} #lgPanel .kpi div{padding:10px;border-radius:12px;background:#ffffff08;border:1px solid #ffffff14;text-align:center;font-size:10px;letter-spacing:.12em;color:#8fa6c0}
  #lgPanel .kpi b{display:block;font:800 18px var(--disp,system-ui);letter-spacing:0;color:#eef3f9;margin-bottom:2px} #lgPanel .kpi .pos b{color:#7cdeb5} #lgPanel .kpi .neg b{color:#ff8a7a}
  #lgPanel .bars{display:flex;flex-direction:column;gap:5px} #lgPanel .bar{display:grid;grid-template-columns:24px 1fr 92px;align-items:center;gap:8px;font-size:12px}
  #lgPanel .bar .tr{height:16px;border-radius:6px;background:#ffffff0a;position:relative;overflow:hidden} #lgPanel .bar .tr i{position:absolute;inset:0 auto 0 0;border-radius:6px;background:linear-gradient(90deg,#2f9f7a,#7cdeb5)} #lgPanel .bar .tr span{position:absolute;left:8px;top:0;line-height:16px;font-size:11px;color:#eef3f9;text-shadow:0 1px 2px #000}
  #lgPanel .bar.neg .tr i{background:linear-gradient(90deg,#9f3a2f,#ff8a7a)} #lgPanel .bar b{text-align:right;font:700 12px var(--disp,system-ui)}
  #lgPanel .tabs{display:flex;gap:6px;margin:4px 0 8px} #lgPanel .tabs button{padding:7px 12px;background:#ffffff10;border:1px solid #ffffff22;color:#cfe0f2} #lgPanel .tabs button.on{background:linear-gradient(180deg,#7cdeb5,#2f9f7a);color:#06140f}
  #lgPanel .way{display:grid;grid-template-columns:24px 1fr auto;gap:8px;align-items:center;padding:7px 9px;border-radius:10px;background:#ffffff06;border:1px solid #ffffff10;margin-bottom:4px;font-size:12px} #lgPanel .way.new{border-color:#ffd97055;background:#ffd9700c} #lgPanel .way b{color:#7cdeb5;font:700 12px var(--disp,system-ui)} #lgPanel .way small{display:block;color:#8fa6c0;font-size:10px}`));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pnl.hidden) { pnl.hidden = true; e.stopImmediatePropagation(); } }, true);
  let view = 'session';
  function bars(map, neg) {
    const box = el('div', { className: 'bars' }), rows = Object.entries(map).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]), max = rows[0]?.[1] || 1;
    if (!rows.length) box.append(el('div', { className: 'sub' }, neg ? 'Nothing spent yet.' : 'Nothing earned yet. Try something from the list below.'));
    for (const [c, v] of rows) { const r = el('div', { className: 'bar' + (neg ? ' neg' : '') }), tr = el('div', { className: 'tr' }), i = el('i'); i.style.width = `${Math.max(3, (v / max) * 100)}%`; tr.append(i, el('span', {}, CATS[c][1])); r.append(el('div', {}, CATS[c][0]), tr, el('b', {}, money(v))); box.append(r); }
    return box;
  }
  function open() {
    try { root.releaseControls?.(); } catch { /* n/a */ }
    persist(); pnl.hidden = false; pnl.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { pnl.hidden = true; }; top.append(el('h2', {}, '📊 LEDGER'), x); pnl.append(top);
    const tabs = el('div', { className: 'tabs' }); for (const [k, t] of [['session', 'THIS SESSION'], ['all', 'ALL TIME'], ['ways', 'WAYS TO EARN']]) { const b = el('button', { type: 'button', className: view === k ? 'on' : '' }, t); b.onclick = () => { view = k; open(); }; tabs.append(b); } pnl.append(tabs);
    if (view === 'ways') {
      const tried = new Set(Object.keys(state.all));
      pnl.append(el('div', { className: 'sub' }, 'Rough rates once you\'re set up. Gold = something you haven\'t made money from yet.'));
      for (const [c, what, rate, tier] of WAYS) { const r = el('div', { className: 'way' + (tried.has(c) ? '' : ' new') }), m = el('div'); m.append(document.createTextNode(what), el('small', {}, `${tier} · ${tried.has(c) ? 'earned ' + money(state.all[c]) + ' so far' : 'not tried yet'}`)); r.append(el('div', {}, CATS[c][0]), m, el('b', {}, rate)); pnl.append(r); }
      return;
    }
    const earned = view === 'session' ? session.earned : state.all, spent = view === 'session' ? session.spent : state.spent;
    const sum = (m) => Object.values(m).reduce((a, b) => a + b, 0), hrs = view === 'session' ? Math.max(1 / 60, (performance.now() - session.start) / 3600000) : null;
    const kpi = el('div', { className: 'kpi' });
    const box = (cls, v, k) => { const d = el('div', { className: cls }); d.append(el('b', {}, v), document.createTextNode(k)); kpi.append(d); };
    box('pos', money(sum(earned)), 'EARNED'); box('neg', money(sum(spent)), 'SPENT'); box(sum(earned) - sum(spent) >= 0 ? 'pos' : 'neg', money(sum(earned) - sum(spent)), 'NET');
    if (hrs) box('', money((sum(earned) - sum(spent)) / hrs) + '/h', 'NET PER HOUR');
    pnl.append(kpi, el('h3', {}, 'WHERE IT CAME FROM'), bars(earned, false), el('h3', {}, 'WHERE IT WENT'), bars(spent, true));
    pnl.append(el('div', { className: 'sub', style: 'margin-top:8px' }, '"Street & other" covers dealers, couriers, robberies and anything paid out on the street.'));
  }

  root.NightshiftLedger = Object.freeze({ tag, open, CATS, get state() { return state; }, session: () => session, paused: () => !pnl.hidden });
})(typeof globalThis !== 'undefined' ? globalThis : this);
