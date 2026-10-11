/* Drug lab in game (Claude-owned). Requires lab-data.js. A LAB USE point appears beside each illegal property
 * you own (Codex's Weed Farm / Coke House, via NightshiftBusinesses state). Batches cook in real time (offline
 * too) and are collected automatically into your product stash. Farming speeds cooking and can add a bonus unit;
 * Dealing raises fence prices. Sell product through VIP drops on the Hustle phone (jobs.js) for the best price.
 * Save: nightshift-lab-v1. API: NightshiftLab.{state, open, close, paused, sites} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const L = root.NightshiftLabData;
  const KEY = 'nightshift-lab-v1';
  let state = L.clean({});
  try { state = L.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const pocket = () => root.NightshiftInventory?.state?.pocket || null;

  const owned = (prop) => root.NightshiftBusinesses?.state?.properties?.[prop]?.owned === true;
  function sites() {
    const props = root.NightshiftBusinessRules?.PROPERTIES || [];
    return L.LABS.filter((l) => owned(l.property)).map((l) => {
      const p = props.find((x) => x.id === l.property);
      return p ? { id: 'lab-' + l.id, lab: l.id, type: 'lab', x: p.x + l.dx, y: p.y + l.dy, ready: true, color: '#c9a2ff', label: '⚗️ ' + l.name.toUpperCase(), action: 'LAB', hint: `${l.name} · cook product` } : null;
    }).filter(Boolean);
  }
  const E = root.NightshiftEncounters;
  if (E && !E.__lab) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 ? [...list, ...sites()] : list; };
    E.use = function (id) { if (typeof id === 'string' && id.startsWith('lab-')) { open(id.slice(4)); return true; } return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawLabs(); } catch { /* cosmetic */ } return r; };
    E.__lab = true;
  }
  function drawLabs() {
    const ctx = G(), p = P(), t = performance.now() / 1000;
    if (!ctx || !p) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const s of sites()) {
      if (Math.hypot(p.x - s.x, p.y - s.y) > 600) continue;
      const busy = !!state.batches[s.lab];
      ctx.fillStyle = '#1c1430e8'; ctx.fillRect(s.x - 30, s.y - 22, 60, 20);
      ctx.strokeStyle = busy ? `hsl(${280 + 30 * Math.sin(t * 3)},80%,70%)` : '#c9a2ff'; ctx.lineWidth = 2; ctx.strokeRect(s.x - 30, s.y - 22, 60, 20);
      ctx.fillStyle = '#efe3ff'; ctx.font = 'bold 10px monospace'; ctx.fillText(busy ? '⚗️ COOKING' : '⚗️ LAB', s.x, s.y - 12);
      if (busy) { ctx.fillStyle = '#c9a2ff66'; for (let i = 0; i < 3; i++) { const yy = s.y - 30 - ((t * 20 + i * 8) % 24); ctx.beginPath(); ctx.arc(s.x - 8 + i * 8, yy, 2.5, 0, Math.PI * 2); ctx.fill(); } }
    }
    ctx.restore();
  }

  function tick() {
    const done = L.collect(state, Date.now(), mod('farming.yield'));
    if (done.length) {
      persist();
      for (const d of done) {
        const r = L.RECIPE[d.recipe];
        for (const [sk, xp] of Object.entries(r.xp)) try { root.NightshiftSkills?.gain(sk, xp, 'lab'); } catch { /* optional */ }
        say(`⚗️ Batch done · +${d.out} ${L.PRODUCTS[d.recipe].icon} ${L.PRODUCTS[d.recipe].name}`);
      }
    }
    if (!panel.hidden) render();
  }
  setInterval(tick, 2000);

  // ---- panel ----
  const css = document.createElement('style');
  css.textContent = `
  #lbPanel{position:fixed;inset:5% 5%;z-index:46;overflow:auto;background:linear-gradient(180deg,#1a1230f7,#0e0a1cf7);border:1px solid #c9a2ff;border-radius:14px;padding:12px 14px;color:#f1e9ff;font:13px ui-monospace,Menlo,monospace}
  #lbPanel[hidden]{display:none} #lbPanel h2{margin:0;font-size:16px;color:#d9c2ff}
  #lbPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 12px ui-monospace,Menlo,monospace}
  #lbPanel .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px} #lbPanel .x{background:#2c2244;border:1px solid #c9a2ff;padding:6px 10px}
  #lbPanel .sub{color:#b9a9d6;font-size:11px} #lbPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin-top:8px}
  #lbPanel .c{background:#241a3c;border:1px solid #3f3160;border-radius:10px;padding:9px 10px;display:flex;flex-direction:column;gap:5px}
  #lbPanel .go{padding:7px 12px;background:linear-gradient(#e6d6ff,#9b74f0);color:#1b1030} #lbPanel .go[disabled]{opacity:.4;pointer-events:none}
  #lbPanel .bar{height:6px;background:#0b0816;border-radius:4px;overflow:hidden} #lbPanel .bar i{display:block;height:100%;background:linear-gradient(90deg,#c9a2ff,#7cdeb5)}
  #lbPanel .stash{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px} #lbPanel .chip{padding:4px 8px;border:1px solid #3f3160;border-radius:999px;font-size:11px}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const panel = el('div', { id: 'lbPanel', hidden: true, role: 'dialog', ariaLabel: 'Drug lab' });
  document.body.append(panel);
  let labId = 'farm';
  function render() {
    if (panel.hidden) return;
    const p = P(), pk = pocket() || {}, lab = L.LABS.find((l) => l.id === labId), b = state.batches[labId], scroll = panel.scrollTop, now = Date.now();
    panel.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'LEAVE'); x.onclick = close;
    top.append(el('h2', {}, `⚗️ ${lab.name.toUpperCase()}`), x);
    panel.append(top, el('div', { className: 'sub' }, `Carrying ${pk.weed || 0} weed · ${pk.coke || 0} coke · Cash ${money(p?.cash ?? 0)} · Cook speed +${Math.round((1 / Math.max(0.5, mod('farming.growTime')) - 1) * 100)}% (Farming)`));
    if (b) {
      const r = L.RECIPE[b.recipe], total = r.seconds * 1000, left = Math.max(0, b.until - now);
      const c = el('div', { className: 'c' }), bar = el('div', { className: 'bar' }), fill = el('i');
      fill.style.width = Math.round((1 - left / total) * 100) + '%'; bar.append(fill);
      c.append(el('div', {}, `Cooking ${L.PRODUCTS[r.id].icon} ${L.PRODUCTS[r.id].name} · ${Math.ceil(left / 1000)}s`), bar, el('div', { className: 'sub' }, 'You can leave; it finishes on its own (even offline).'));
      panel.append(c);
    }
    const grid = el('div', { className: 'grid' });
    for (const r of L.RECIPES.filter((x) => x.lab === labId)) {
      const pr = L.PRODUCTS[r.id], c = el('div', { className: 'c' });
      const inputs = Object.entries(r.input).map(([k, n]) => `${n} ${k}`).join(' + ');
      c.append(el('div', {}, `${pr.icon} ${pr.name} ×${r.out}`), el('div', { className: 'sub' }, `${inputs} + ${money(r.cash)} supplies · ${r.seconds}s · worth ${money(pr.value)} each`));
      const can = !b && Object.entries(r.input).every(([k, n]) => (pk[k] || 0) >= n) && (p?.cash ?? 0) >= r.cash;
      const go = el('button', { className: 'go', type: 'button', disabled: !can }, b ? 'LAB BUSY' : 'START BATCH');
      go.onclick = () => {
        const pl = P(), pocketNow = pocket(); if (!pl || !pocketNow) return;
        const res = L.start(state, labId, r.id, pocketNow, pl, Date.now(), mod('farming.growTime'));
        if (!res.ok) { say(res.reason); return; }
        persist(); try { root.NightshiftInventory?.save?.(); } catch { /* optional */ } gameSave(); say(`⚗️ Cooking ${pr.name}…`); render();
      };
      c.append(go); grid.append(c);
    }
    panel.append(grid, el('div', { className: 'sub', style: 'margin-top:10px' }, `📦 Product stash ${L.stashCount(state)}/${L.STASH_MAX}. Sell through 💊 VIP drops on the HUSTLE phone (+60%), or fence it here for ${Math.round(L.FENCE * 100)}%.`));
    const st = el('div', { className: 'stash' });
    for (const [id, n] of Object.entries(state.stash)) st.append(el('span', { className: 'chip' }, `${L.PRODUCTS[id].icon} ${L.PRODUCTS[id].name} ×${n}`));
    if (!Object.keys(state.stash).length) st.append(el('span', { className: 'sub' }, 'Empty'));
    const value = Object.entries(state.stash).reduce((t, [id, n]) => t + Math.round(L.PRODUCTS[id].value * L.FENCE * mod('dealing.price')) * n, 0);
    const fence = el('button', { className: 'go', type: 'button', disabled: !value, style: 'margin-top:8px' }, `FENCE ALL · ${money(value)}`);
    fence.onclick = () => { const pl = P(); const r = L.fenceAll(state, mod('dealing.price')); if (r.n && pl) { pl.cash = Math.min(100000000, pl.cash + r.cash); pl.heat = Math.min(5, (pl.heat || 0) + 0.3); persist(); gameSave(); say(`🧳 Fenced ${r.n} items · +${money(r.cash)} · heat up`); render(); } };
    panel.append(st, fence);
    panel.scrollTop = scroll;
  }
  function open(id) {
    const p = P(); if (!p || p.hp <= 0) return false;
    if (p.car) { say('Park and walk into the lab'); return false; }
    labId = L.LABS.some((l) => l.id === id) ? id : 'farm';
    try { root.releaseControls?.(); } catch { /* n/a */ }
    panel.hidden = false; render(); return true;
  }
  function close() { panel.hidden = true; }
  addEventListener('keydown', (e) => { if (panel.hidden) return; if (e.key === 'Escape') close(); e.stopImmediatePropagation(); }, true);
  setInterval(() => { if (!panel.hidden) render(); }, 1000);

  root.NightshiftLab = Object.freeze({ open, close, paused: () => !panel.hidden, sites, get state() { return state; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
