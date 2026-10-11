/* Daily + weekly challenges in game (Claude-owned). Requires dailies-data.js; reads lifetime counters from
 * goals.js (NightshiftGoals.snapshot) plus the casino and race saves. Pays cash + skill XP automatically.
 * UI: a "📅 DAILY n/3" chip under the goal card and a panel (D key). Save: nightshift-dailies-v1.
 * API: NightshiftDailies.{state, open, close, paused, stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const D = root.NightshiftDailiesData;
  const KEY = 'nightshift-dailies-v1';
  let state = D.clean({});
  try { state = D.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { const f = (typeof save === 'function' ? save : null); if (f) f(); } catch { /* not ready */ } };
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();

  function stats() {
    const s = root.NightshiftGoals?.snapshot?.();
    if (!s) return null;
    return { delivery: s.delivery, salvage: s.salvage, sold: s.sold, batches: s.batches, escapes: s.escapes, drove: s.drove, walked: s.walked,
      shots: s.shots, earned: s.earned, casinoSpins: root.NightshiftCasino?.state?.spins || 0, raceRuns: root.NightshiftRaces?.state?.runs || 0,
      fishCaught: root.NightshiftFishing?.state?.total || 0 };
  }

  const queue = []; // pays one reward at a time so toasts stay readable
  function tick() {
    const st = stats(), p = P();
    if (!st || !p) return;
    const r = D.roll(state, new Date(), st);
    if (r.newDay) { persist(); if (r.streakBroken) say('📅 New day · your daily streak reset'); else if (state.streak) say(`📅 New daily challenges · 🔥 streak ${state.streak}`); }
    if (r.newWeek) persist();
    const pays = D.claim(state, new Date(), st);
    if (pays.length) { persist(); queue.push(...pays); }
    render();
  }
  function payNext() {
    const pay = queue.shift(), p = P();
    if (!pay || !p) return;
    try { root.NightshiftGoals?.notePayout?.(pay.cash); } catch { /* optional */ }
    p.cash = Math.min(100000000, p.cash + pay.cash);
    if (pay.xp) try { root.NightshiftSkills?.gain(pay.xp, pay.xpAmount, 'daily'); } catch { /* optional */ }
    gameSave();
    const tag = pay.kind === 'weekly' ? '🗓️ WEEKLY DONE' : pay.kind === 'streak' ? '🔥 ALL DAILIES DONE' : '📅 DAILY DONE';
    say(`${tag} · ${pay.text} · +${money(pay.cash)}`);
    try { root.NightshiftAudio?.play('pickup'); } catch { /* sound optional */ }
  }
  setInterval(tick, 2000);
  setInterval(payNext, 2600);

  // ---- UI ----
  const css = document.createElement('style');
  css.textContent = `
  #dyChip{all:unset;box-sizing:border-box;position:fixed;z-index:24;left:12px;top:180px;cursor:pointer;white-space:nowrap;
    background:#101728d9;border:1px solid #5e7793;border-left:3px solid #7cdeb5;border-radius:999px;color:#e8eff7;font:600 11px/1.2 ui-monospace,Menlo,monospace;padding:4px 10px}
  #dyPanel{position:fixed;inset:6% 6%;z-index:46;overflow:auto;background:#0f1830f5;border:1px solid #7cdeb5;border-radius:14px;padding:14px 16px;color:#e8eff7;font:13px ui-monospace,Menlo,monospace}
  #dyPanel[hidden]{display:none} #dyPanel h2{margin:0 0 4px;font-size:16px} #dyPanel h3{margin:12px 0 6px;font-size:12px;color:#9fb3c8;letter-spacing:.08em}
  #dyPanel .sub{color:#9fb3c8;font-size:11px} #dyPanel .c{background:#16233d;border:1px solid #2f4669;border-radius:10px;padding:8px 10px;margin-bottom:6px}
  #dyPanel .c.done{border-color:#7cdeb5;opacity:.7} #dyPanel .top{display:flex;justify-content:space-between;gap:8px} #dyPanel .rw{color:#7cdeb5;white-space:nowrap}
  #dyPanel .bar{height:6px;background:#0a1222;border-radius:4px;margin-top:6px;overflow:hidden} #dyPanel .bar i{display:block;height:100%;background:linear-gradient(90deg,#7cdeb5,#ffd970)}
  #dyPanel .close{all:unset;box-sizing:border-box;cursor:pointer;position:sticky;top:0;float:right;font:700 13px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:8px;padding:6px 10px}
  #dyPanel .streak{font-size:22px;color:#ffd970}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const chip = el('button', { id: 'dyChip', type: 'button', ariaLabel: 'Daily challenges' });
  const panel = el('div', { id: 'dyPanel', hidden: true, role: 'dialog', ariaLabel: 'Daily challenges' });
  document.body.append(chip, panel);
  function resetIn() {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const m = Math.max(0, Math.round((next - now) / 60000));
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  let lastChip = '';
  function render() {
    const text = state.day ? `📅 DAILY ${state.claimed.length}/${D.DAILY_COUNT}${state.streak ? ` · 🔥${state.streak}` : ''}` : '📅 DAILY';
    if (text !== lastChip) { chip.textContent = text; lastChip = text; }
    place();
    if (panel.hidden || !state.day) return;
    const st = stats() || {}, scroll = panel.scrollTop, mult = D.streakMult(state.streak);
    panel.textContent = '';
    const close = el('button', { className: 'close', type: 'button' }, 'CLOSE'); close.onclick = () => { panel.hidden = true; };
    panel.append(close, el('h2', {}, '📅 DAILY CHALLENGES'), el('div', { className: 'sub' }, `New challenges in ${resetIn()} · finish all 3 every day to grow your streak`));
    const sb = el('div', { className: 'c' });
    sb.append(el('div', { className: 'streak' }, `🔥 ${state.streak} day streak`), el('div', { className: 'sub' }, `Daily rewards +${Math.round((mult - 1) * 100)}% · best ${state.best} · max bonus +${Math.round(5 * 10)}% at 5 days`));
    panel.append(sb, el('h3', {}, 'TODAY'));
    D.picks(state.day).forEach((p, i) => {
      const done = state.claimed.includes(i), prog = D.progress(p, state.base, st);
      panel.append(card(p, done, prog, `${money(Math.round(p.cash * mult))} + XP`));
    });
    const w = D.weekly(state.week);
    panel.append(el('h3', {}, `THIS WEEK · ${state.week}`), card(w, state.weekClaimed, D.progress(w, state.weekBase, st), `${money(w.cash)} + XP`));
    panel.scrollTop = scroll;
  }
  function card(p, done, prog, rewardText) {
    const c = el('div', { className: 'c' + (done ? ' done' : '') }), top = el('div', { className: 'top' });
    top.append(el('span', {}, `${done ? '✅' : '▫️'} ${D.label(p)}`), el('span', { className: 'rw' }, rewardText));
    const bar = el('div', { className: 'bar' }), fill = el('i'); fill.style.width = Math.round(Math.min(1, prog / p.n) * 100) + '%'; bar.append(fill);
    c.append(top, el('div', { className: 'sub' }, done ? 'Complete' : D.fmtProgress(p, prog)), bar);
    return c;
  }
  function place() {
    const anchor = document.querySelector('#glCard') || document.querySelector('#skChip');
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    if (r.height) { chip.style.top = Math.round(r.bottom + 6) + 'px'; chip.style.left = Math.round(r.left) + 'px'; }
  }
  function open() { try { root.releaseControls?.(); } catch { /* n/a */ } panel.hidden = false; render(); }
  chip.onclick = () => { panel.hidden ? open() : (panel.hidden = true); };
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) panel.hidden = true; }); // no letter hotkey: WASD moves
  setTimeout(tick, 1500);

  root.NightshiftDailies = Object.freeze({ open, close: () => { panel.hidden = true; }, paused: () => !panel.hidden, stats, get state() { return state; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
