/* Street exchange on the phone (Claude-owned). Requires market-data.js. Opened from 📱 HUSTLE → 💹 MARKET.
 * Live prices (1 tick/min, deterministic from real time), 60-minute sparklines, a news hint every 10 min,
 * BUY 10 / BUY MAX / SELL ALL, average-cost P/L. Position limit per ticker grows with Respect rank.
 * Save: nightshift-market-v1. API: NightshiftMarket.{state, open, close, paused, value} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const M = root.NightshiftMarketData;
  const KEY = 'nightshift-market-v1';
  let state = M.clean({});
  try { state = M.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
  const px = (n) => '$' + n.toFixed(2);
  const rank = () => root.NightshiftRespect?.state?.reached || 0;
  const slot = () => M.slotOf(Date.now());

  const css = document.createElement('style');
  css.textContent = `
  #mkPanel{position:fixed;inset:5% 5%;z-index:47;overflow:auto;background:linear-gradient(180deg,#07161ff7,#040c12f7);border:1px solid #39d98a;border-radius:14px;padding:12px 14px;color:#e6fff2;font:13px ui-monospace,Menlo,monospace}
  #mkPanel[hidden]{display:none} #mkPanel h2{margin:0;font-size:16px;color:#7dffb8} #mkPanel .sub{color:#8fb9a5;font-size:11px}
  #mkPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 11px ui-monospace,Menlo,monospace;padding:7px 9px}
  #mkPanel .top{display:flex;justify-content:space-between;align-items:center;gap:8px} #mkPanel .x{background:#123326;border:1px solid #39d98a}
  #mkPanel .news{margin:8px 0;padding:8px 10px;border-radius:10px;background:#0f2a1f;border:1px dashed #39d98a}
  #mkPanel .t{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:4px 10px;align-items:center;background:#0c2119;border:1px solid #1f4a37;border-radius:10px;padding:8px 10px;margin-top:7px}
  #mkPanel canvas{width:120px;height:34px;grid-row:span 2} #mkPanel .up{color:#7dffb8} #mkPanel .dn{color:#ff7d8a}
  #mkPanel .acts{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap} #mkPanel .b{background:linear-gradient(#a9ffd0,#2fbf74);color:#03210f} #mkPanel .s{background:linear-gradient(#ffc1c8,#e0566a);color:#2a0008}
  #mkPanel button[disabled]{opacity:.35;pointer-events:none}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const panel = el('div', { id: 'mkPanel', hidden: true, role: 'dialog', ariaLabel: 'Street exchange' });
  document.body.append(panel);

  function trade(kind, id, qty) {
    const p = P(); if (!p) return;
    const price = M.price(id, slot());
    const r = kind === 'buy' ? M.buy(state, p, id, qty, price, M.cap(rank())) : M.sell(state, p, id, qty, price);
    if (!r.ok) { say('💹 ' + r.reason); return; }
    if (kind === 'sell' && r.pnl > 0) try { root.NightshiftGoals?.notePayout?.(r.got - r.pnl); } catch { /* optional: only profit counts as earned */ }
    if (kind === 'sell' && r.pnl <= 0) try { root.NightshiftGoals?.notePayout?.(r.got); } catch { /* optional */ }
    if (kind === 'sell') try { root.NightshiftSkills?.gain('luck', Math.max(5, Math.min(150, Math.round(Math.abs(r.pnl) / 40))), 'market'); } catch { /* optional */ }
    persist(); gameSave();
    say(kind === 'buy' ? `💹 Bought ${qty} ${id} @ ${px(price)} · -${money(r.total)}` : `💹 Sold ${qty} ${id} @ ${px(price)} · ${r.pnl >= 0 ? 'profit' : 'loss'} ${money(r.pnl)}`);
    render(true);
  }
  function spark(canvas, data) {
    const c = canvas.getContext?.('2d'); if (!c) return;
    const w = canvas.width, h = canvas.height, lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1;
    c.clearRect(0, 0, w, h); c.strokeStyle = data[data.length - 1] >= data[0] ? '#7dffb8' : '#ff7d8a'; c.lineWidth = 2; c.beginPath();
    data.forEach((v, i) => { const x = (i / (data.length - 1)) * (w - 2) + 1, y = h - 2 - ((v - lo) / span) * (h - 4); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
  }
  let lastKey = '';
  function render(force) {
    if (panel.hidden) return;
    const s = slot(), p = P(), cash = p?.cash || 0, key = `${s}|${cash}|${JSON.stringify(state.hold)}`;
    if (!force && key === lastKey) { const cd = panel.querySelector('.cd'); if (cd) cd.textContent = countdown(); return; }
    lastKey = key; const scroll = panel.scrollTop; panel.textContent = '';
    const x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = close;
    const top = el('div', { className: 'top' }); top.append(el('h2', {}, '💹 STREET EXCHANGE'), x); panel.append(top);
    const val = M.value(state, s);
    panel.append(el('div', { className: 'sub' }, `Portfolio ${money(val)} · realized P/L ${money(state.realized)} · fee ${M.FEE * 100}% · limit ${money(M.cap(rank()))}/ticker (Respect)`));
    const n = M.news(s), nb = el('div', { className: 'news' }); nb.append(el('div', {}, `📰 ${n.text}`), el('div', { className: 'sub cd' }, countdown())); panel.append(nb);
    for (const t of M.TICKERS) {
      const hist = M.history(t.id, s, 60), now = hist[hist.length - 1], open = hist[0], ch = (now / open - 1) * 100, h = state.hold[t.id];
      const row = el('div', { className: 't' }), info = el('div');
      info.append(el('div', {}, `${t.icon} ${t.id} · ${px(now)} `), el('div', { className: 'sub' }, h ? `${h.qty} held · avg ${px(h.cost / h.qty)} · P/L ${money(h.qty * now * (1 - M.FEE) - h.cost)}` : t.name));
      info.firstChild.append(el('span', { className: ch >= 0 ? 'up' : 'dn' }, `${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}% 1h`));
      const cv = el('canvas', { width: 120, height: 34 }); spark(cv, hist);
      const acts = el('div', { className: 'acts' }), max = M.maxBuy(state, cash, t.id, now, M.cap(rank()));
      const b10 = el('button', { className: 'b', type: 'button', disabled: max < 10 }, 'BUY 10'); b10.onclick = () => trade('buy', t.id, 10);
      const bm = el('button', { className: 'b', type: 'button', disabled: max < 1 }, `BUY MAX${max ? ' ' + max : ''}`); bm.onclick = () => trade('buy', t.id, max);
      const sa = el('button', { className: 's', type: 'button', disabled: !h }, 'SELL ALL'); sa.onclick = () => trade('sell', t.id, h.qty);
      acts.append(b10, bm, sa); row.append(info, cv, acts); panel.append(row);
    }
    panel.append(el('div', { className: 'sub', style: 'margin-top:8px' }, 'Prices tick every minute, even while you are away. News hints at the next 20 minutes; noise can still burn you.'));
    panel.scrollTop = scroll;
  }
  function countdown() { const ms = M.TICK_MS - (Date.now() % M.TICK_MS), nm = (M.NEWS_SLOTS - (slot() % M.NEWS_SLOTS)); return `Next tick ${Math.ceil(ms / 1000)}s · next news ~${nm} min`; }
  function open() { try { root.releaseControls?.(); } catch { /* n/a */ } panel.hidden = false; render(true); }
  function close() { panel.hidden = true; }
  setInterval(() => render(false), 1000);
  addEventListener('keydown', (e) => { if (!panel.hidden && e.key === 'Escape') close(); });

  root.NightshiftMarket = Object.freeze({ get state() { return state; }, open, close, paused: () => !panel.hidden, value: () => M.value(state, slot()) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
