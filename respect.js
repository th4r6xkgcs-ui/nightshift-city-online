/* Respect rank in game (Claude-owned). Requires respect-data.js. Reads achievements from the other RPG modules
 * (skills, goals, races, weapons, home, tuning, dailies), shows a rank badge beside the skills chip, and pays
 * a one-time bonus for each new rank. Save: nightshift-respect-v1. API: NightshiftRespect.{state, rank, open, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const R = root.NightshiftRespectData;
  const KEY = 'nightshift-respect-v1';
  let state = R.clean({});
  try { state = R.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { const f = (typeof save === 'function' ? save : null); if (f) f(); } catch { /* not ready */ } };
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();

  function context() {
    const snap = root.NightshiftGoals?.snapshot?.() || {};
    const medals = Object.values(root.NightshiftRaces?.state?.medals || {});
    let tune = 0; try { const s = root.NightshiftTuning?.state; tune = s ? root.NightshiftTuningData.totalLevels(s) : 0; } catch { /* optional */ }
    return {
      skillLevels: snap.totalLevel || 0,
      goals: Object.keys(root.NightshiftGoals?.state?.done || {}).length,
      gold: medals.filter((m) => m === 'gold').length, silver: medals.filter((m) => m === 'silver').length, bronze: medals.filter((m) => m === 'bronze').length,
      weapons: Math.max(0, (root.NightshiftWeapons?.state?.owned?.length || 1) - 1),
      homeItems: root.NightshiftHomeUpgrades?.state?.owned?.length || 0,
      tuneLevels: tune,
      bestStreak: root.NightshiftDailies?.state?.best || 0,
      earned10k: (snap.earned || 0) / 10000,
    };
  }
  let current = R.points(context()), queue = [], ready = false;
  function tick() {
    current = R.points(context());
    if (ready) { const up = R.advance(state, current.total); if (up.length) { persist(); queue.push(...up); } }
    renderBadge(); if (!panel.hidden) renderPanel();
  }
  function payNext() {
    const r = queue.shift(), p = P();
    if (!r || !p) return;
    try { root.NightshiftGoals?.notePayout?.(r.cash); } catch { /* optional */ }
    p.cash = Math.min(100000000, p.cash + r.cash); gameSave();
    say(`${r.icon} RESPECT · You're now a ${r.name.toUpperCase()} · +${money(r.cash)}`);
    try { root.NightshiftAudio?.play('pickup'); } catch { /* sound optional */ }
  }
  // Give other modules a moment to load their saves before judging ranks (avoids paying on half-loaded state).
  setTimeout(() => { ready = true; tick(); }, 4000);
  setInterval(tick, 3000);
  setInterval(payNext, 3100);

  // ---- UI ----
  const css = document.createElement('style');
  css.textContent = `
  #rsBadge{all:unset;box-sizing:border-box;position:fixed;z-index:25;left:140px;top:90px;cursor:pointer;white-space:nowrap;
    background:#1a1428d9;border:1px solid #b9a3ff;border-radius:999px;color:#efe6ff;font:600 12px/1.2 ui-monospace,Menlo,monospace;padding:5px 10px}
  #rsPanel{position:fixed;inset:6% 6%;z-index:46;overflow:auto;background:#140f22f5;border:1px solid #b9a3ff;border-radius:14px;padding:14px 16px;color:#efe6ff;font:13px ui-monospace,Menlo,monospace}
  #rsPanel[hidden]{display:none} #rsPanel h2{margin:0 0 4px;font-size:18px} #rsPanel .sub{color:#b3a9cc;font-size:11px}
  #rsPanel .bar{height:8px;background:#0b0816;border-radius:5px;margin:8px 0 12px;overflow:hidden} #rsPanel .bar i{display:block;height:100%;background:linear-gradient(90deg,#b9a3ff,#ffd970)}
  #rsPanel .row{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px dashed #3a2f55;font-size:12px} #rsPanel .pts{color:#ffd970}
  #rsPanel .ranks{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px} #rsPanel .rk{padding:4px 8px;border-radius:999px;border:1px solid #3a2f55;font-size:11px} #rsPanel .rk.on{border-color:#ffd970;color:#ffd970}
  #rsPanel .close{all:unset;box-sizing:border-box;cursor:pointer;position:sticky;top:0;float:right;font:700 13px ui-monospace,Menlo,monospace;background:#3a2f55;color:#fff;border:1px solid #b9a3ff;border-radius:8px;padding:6px 10px}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const badge = el('button', { id: 'rsBadge', type: 'button', ariaLabel: 'Respect rank' });
  const panel = el('div', { id: 'rsPanel', hidden: true, role: 'dialog', ariaLabel: 'Respect rank' });
  document.body.append(badge, panel);
  let lastText = '';
  function renderBadge() {
    const r = R.rankOf(current.total), text = `${r.icon} ${r.name}`;
    if (text !== lastText) { badge.textContent = text; lastText = text; }
    const chip = document.querySelector('#skChip');
    if (chip) { const b = chip.getBoundingClientRect(); if (b.width) { badge.style.top = Math.round(b.top) + 'px'; badge.style.left = Math.round(b.right + 6) + 'px'; } }
  }
  function renderPanel() {
    const r = R.rankOf(current.total), scroll = panel.scrollTop;
    panel.textContent = '';
    const close = el('button', { className: 'close', type: 'button' }, 'CLOSE'); close.onclick = () => { panel.hidden = true; };
    panel.append(close, el('h2', {}, `${r.icon} ${r.name.toUpperCase()} · ${current.total.toLocaleString()} respect`),
      el('div', { className: 'sub' }, r.next ? `${r.toNext.toLocaleString()} more to ${r.next.icon} ${r.next.name} (+${money(R.bonus(r.index + 1))})` : 'Top rank reached. The city knows your name.'));
    const bar = el('div', { className: 'bar' }), fill = el('i'); fill.style.width = Math.round(r.progress * 100) + '%'; bar.append(fill);
    panel.append(bar);
    for (const part of current.parts) {
      const row = el('div', { className: 'row' });
      row.append(el('span', {}, part.label), el('span', { className: 'pts' }, `${part.pts.toLocaleString()} / ${part.cap.toLocaleString()}`));
      panel.append(row);
    }
    const ranks = el('div', { className: 'ranks' });
    for (const [i, k] of R.RANKS.entries()) ranks.append(el('span', { className: 'rk' + (i <= r.index ? ' on' : '') }, `${k.icon} ${k.name} · ${k.min.toLocaleString()}`));
    panel.append(ranks);
    panel.scrollTop = scroll;
  }
  badge.onclick = () => { if (panel.hidden) { try { root.releaseControls?.(); } catch { /* n/a */ } panel.hidden = false; renderPanel(); } else panel.hidden = true; };
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) panel.hidden = true; });
  renderBadge();

  root.NightshiftRespect = Object.freeze({ get state() { return state; }, rank: () => ({ ...R.rankOf(current.total), points: current.total }), open: () => badge.click(), paused: () => !panel.hidden });
})(typeof globalThis !== 'undefined' ? globalThis : this);
