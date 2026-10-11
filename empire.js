/* Empire in game (Claude-owned). Requires empire-data.js. Front businesses earn passive income (offline too).
 * Opened from the 📱 HUSTLE phone (📈 EMPIRE button) or NightshiftEmpire.open(). A toast nudges the player when
 * income is waiting. Save: nightshift-empire-v1. API: NightshiftEmpire.{state, open, close, paused, pending} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const M = root.NightshiftEmpireData;
  const KEY = 'nightshift-empire-v1';
  let state = M.clean({});
  try { state = M.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };
  const money = (n) => '$' + Math.round(n).toLocaleString();

  const css = document.createElement('style');
  css.textContent = `
  #emPanel{position:fixed;inset:6% 6%;z-index:47;overflow:auto;background:linear-gradient(180deg,#0f1a12f7,#08100bf7);border:1px solid #9be37c;border-radius:14px;padding:12px 14px;color:#effde8;font:13px ui-monospace,Menlo,monospace}
  #emPanel[hidden]{display:none} #emPanel h2{margin:0;font-size:16px;color:#b9f59a}
  #emPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 12px ui-monospace,Menlo,monospace}
  #emPanel .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px} #emPanel .x{border:1px solid #9be37c;padding:6px 10px}
  #emPanel .sub{color:#b6d3a8;font-size:11px} #emPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px;margin-top:8px}
  #emPanel .c{background:#16261b;border:1px solid #2c4a33;border-radius:10px;padding:9px 10px;display:flex;flex-direction:column;gap:5px} #emPanel .c.own{border-color:#9be37c}
  #emPanel .go{padding:8px 12px;background:linear-gradient(#d8ffc4,#6cc24a);color:#0d2406} #emPanel .go[disabled]{opacity:.4;pointer-events:none}
  #emPanel .big{display:block;width:100%;padding:12px;font-size:15px;margin-top:8px}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const panel = el('div', { id: 'emPanel', hidden: true, role: 'dialog', ariaLabel: 'Empire' });
  document.body.append(panel);
  function render() {
    if (panel.hidden) return;
    const p = P(), cash = p?.cash ?? 0, now = Date.now(), d = mod('charisma.shopPrice'), scroll = panel.scrollTop, pend = M.totalPending(state, now);
    panel.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = close;
    top.append(el('h2', {}, '📈 EMPIRE'), x);
    panel.append(top, el('div', { className: 'sub' }, `Income ${money(M.perHour(state))}/hour · lifetime ${money(state.collected)} · businesses earn while you're away (up to their cap)`));
    const col = el('button', { className: 'go big', type: 'button', disabled: pend < 1 }, pend ? `COLLECT ${money(pend)}` : 'Nothing to collect yet');
    col.onclick = () => { const pl = P(); if (!pl) return; const c = M.collect(state); if (c > 0) { pl.cash = Math.min(100000000, pl.cash + c); persist(); gameSave(); say(`📈 Collected ${money(c)} from your businesses`); try { root.NightshiftSkills?.gain('charisma', Math.min(200, Math.round(c / 100)), 'empire'); } catch { /* optional */ } } render(); };
    panel.append(col);
    const grid = el('div', { className: 'grid' });
    for (const f of M.FRONTS) {
      const r = state.fronts[f.id], c = el('div', { className: 'c' + (r ? ' own' : '') });
      c.append(el('div', {}, `${f.icon} ${f.name}`));
      if (!r) {
        const price = Math.round(f.price * Math.max(0.5, Math.min(1, d)));
        c.append(el('div', { className: 'sub' }, `${money(f.perHour)}/h · holds up to ${f.capHours}h of income · pays back in ~${Math.round(f.price / f.perHour)}h`));
        const b = el('button', { className: 'go', type: 'button', disabled: cash < price }, `BUY · ${money(price)}`);
        b.onclick = () => { const pl = P(); if (!pl) return; const res = M.buy(state, pl, f.id, mod('charisma.shopPrice')); if (!res.ok) { say(res.reason); return; } persist(); gameSave(); say(`${f.icon} ${f.name} is yours · -${money(res.price)}`); render(); };
        c.append(b);
      } else {
        const hrs = Math.min(f.capHours, (now - r.since) / 3600000), full = hrs >= f.capHours;
        c.append(el('div', { className: 'sub' }, `${money(M.rate(f, r.mgr))}/h · managers ${r.mgr}/${M.MANAGER_MAX} · ${money(M.pending(state, f.id, now))} waiting${full ? ' · FULL, collect!' : ''}`));
        const mp = M.managerPrice(f, r.mgr);
        const b = el('button', { className: 'go', type: 'button', disabled: mp === null || cash < Math.round(mp * Math.max(0.5, Math.min(1, d))) }, mp === null ? 'FULLY STAFFED' : `HIRE MANAGER (+50%) · ${money(Math.round(mp * Math.max(0.5, Math.min(1, d))))}`);
        b.onclick = () => { const pl = P(); if (!pl) return; const res = M.hire(state, pl, f.id, mod('charisma.shopPrice')); if (!res.ok) { say(res.reason); return; } persist(); gameSave(); say(`👔 Manager hired at ${f.name}${res.paidOut ? ` · banked ${money(res.paidOut)}` : ''}`); render(); };
        c.append(b);
      }
      grid.append(c);
    }
    panel.append(grid);
    panel.scrollTop = scroll;
  }
  function open() { try { root.releaseControls?.(); } catch { /* n/a */ } panel.hidden = false; render(); }
  function close() { panel.hidden = true; }
  addEventListener('keydown', (e) => { if (panel.hidden) return; if (e.key === 'Escape') close(); e.stopImmediatePropagation(); }, true);
  setInterval(() => { if (!panel.hidden) render(); }, 1000);
  // Nudge once per session when a meaningful amount is waiting (e.g. after coming back).
  let nudged = false;
  setInterval(() => { const pend = M.totalPending(state); if (!nudged && pend >= 1000) { nudged = true; say(`📈 Your businesses made ${money(pend)} · collect on the 📱 HUSTLE phone`); } }, 15000);

  root.NightshiftEmpire = Object.freeze({ open, close, paused: () => !panel.hidden, pending: () => M.totalPending(state), get state() { return state; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
