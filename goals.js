/* Goals & milestones (Claude-owned). Requires goals-data.js loaded first.
 * Pure core (Node-testable) + browser layer that:
 *  - reads public game state (player, cars, progress, businesses, skills) — no game files edited;
 *  - tracks a few lifetime stats the game doesn't (distance walked, total earned, police escapes);
 *  - completes goals (max one per second, catalog order), pays cash + skill XP rewards;
 *  - shows an always-visible NEXT GOAL card and a full goals panel.
 * Save: nightshift-goals-v1. API: NightshiftGoals.{state, next, open, snapshot}. */
(function (root) {
  'use strict';
  const D = (typeof module === 'object' && module.exports) ? require('./goals-data.js') : root.NightshiftGoalsData;
  const { GOALS } = D;
  const BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));
  const KEY = 'nightshift-goals-v1';
  const STAT_CAP = 1e12;
  const STATS = ['walked', 'drove', 'shots', 'escapes', 'earned'];

  function clean(raw) {
    const s = { version: 1, done: {}, stats: {} };
    for (const k of STATS) {
      const v = raw?.stats?.[k];
      s.stats[k] = Number.isFinite(v) && v > 0 ? Math.min(STAT_CAP, v) : 0;
    }
    if (raw?.done && typeof raw.done === 'object') {
      for (const [id, t] of Object.entries(raw.done)) if (BY_ID[id] && Number.isFinite(t) && t >= 0) s.done[id] = t;
    }
    return s;
  }

  // Sanitizes a raw context so goal formulas never see NaN/undefined.
  const CTX_KEYS = ['walked', 'drove', 'shots', 'escapes', 'earned', 'delivery', 'salvage', 'batches', 'sold',
    'properties', 'carsOwned', 'totalLevel', 'maxSkill', 'home', 'inCar', 'casinoWins', 'casinoWagered', 'weaponsOwned', 'tuneLevels', 'tuneBestCar', 'raceMedals', 'raceGolds'];
  function context(raw) {
    const c = {};
    for (const k of CTX_KEYS) { const v = Number(raw?.[k]); c[k] = Number.isFinite(v) && v > 0 ? v : 0; }
    return c;
  }

  function progressOf(goal, ctx) {
    const [cur, target] = goal.progress(context(ctx));
    return { cur: Math.max(0, Math.floor(cur)), target, done: cur >= target };
  }

  // Completes at most one goal (first in catalog order that is met). Returns it or null.
  function step(state, ctx, now = Date.now()) {
    for (const g of GOALS) {
      if (state.done[g.id] !== undefined) continue;
      if (progressOf(g, ctx).done) { state.done[g.id] = now; return g; }
    }
    return null;
  }

  // The goal to show as NEXT: first unfinished goal in catalog order.
  function next(state, ctx) {
    const g = GOALS.find((x) => state.done[x.id] === undefined);
    return g ? { goal: g, ...progressOf(g, ctx) } : null;
  }

  const doneCount = (state) => Object.keys(state.done).length;
  const core = { KEY, GOALS, clean, context, progressOf, step, next, doneCount };
  if (typeof module === 'object' && module.exports) { module.exports = core; return; }
  if (!root.document) { root.NightshiftGoals = core; return; }

  // ---------------- browser layer ----------------
  let state = clean();
  try { state = clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  let dirty = false;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); dirty = false; } catch { /* private mode */ } };
  setInterval(() => { if (dirty) save(); }, 3000);
  addEventListener('pagehide', () => { if (dirty) save(); });
  const toast = (t) => { try { if (typeof root.say === 'function') root.say(t); } catch { /* no toast */ } };

  // Game script-level globals (game.js is a classic script, so its top-level let/const are visible by name).
  /* eslint-disable no-undef */
  const G = {
    get player() { try { return player; } catch { return null; } },
    get cars() { try { return Array.isArray(cars) ? cars : []; } catch { return []; } },
  };
  /* eslint-enable no-undef */
  // NB: inside this IIFE `save` is ours; reach the game's via a separate lookup.
  const gameSave = (() => { try { return Function('return typeof save==="function"?save:null')(); } catch { return null; } })();

  // ---- stat tracking ----
  let last = null, wanted = false, paying = 0;
  function track() {
    const p = G.player;
    if (!p) return;
    if (last && p.hp > 0) {
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d > 0 && d < 200) { if (p.car) state.stats.drove += d; else state.stats.walked += d; dirty = true; }
      if (Number.isFinite(p.ammo) && Number.isFinite(last.ammo) && p.ammo < last.ammo && !p.car) { state.stats.shots += Math.min(3, last.ammo - p.ammo); dirty = true; }
      if (Number.isFinite(p.cash) && Number.isFinite(last.cash) && p.cash > last.cash) {
        // Earnings: every cash increase except the rewards we pay ourselves; huge jumps (backup restores) ignored.
        const gainNow = p.cash - last.cash - paying;
        if (gainNow > 0 && gainNow <= 250000) { state.stats.earned = Math.min(STAT_CAP, state.stats.earned + gainNow); dirty = true; }
      }
    }
    paying = 0;
    if (Number.isFinite(p.heat)) {
      if (p.heat >= 1) wanted = true;
      else if (wanted && p.heat <= 0 && p.hp > 0) { wanted = false; state.stats.escapes += 1; dirty = true; }
      if (p.hp <= 0) wanted = false;
    }
    last = { x: p.x, y: p.y, ammo: p.ammo, cash: p.cash };
  }

  const tuneStat = (fn) => { try { const s = root.NightshiftTuning?.state; return s ? root.NightshiftTuningData[fn](s) : 0; } catch { return 0; } };
  function snapshot() {
    const p = G.player;
    let prog = root.NightshiftProgress?.state;
    if (!prog) { try { prog = JSON.parse(localStorage.getItem('nightshift-city-progress-v1') || '{}'); } catch { prog = {}; } }
    const biz = root.NightshiftBusinesses?.state;
    const ledger = biz?.ledger || {};
    const props = biz?.properties ? Object.values(biz.properties).filter((x) => x?.owned === true).length : 0;
    const S = root.NightshiftSkills, SD = root.NightshiftSkillsData;
    const levels = S && SD ? SD.SKILLS.map((s) => S.level(s.id)) : [];
    let ownsHome = false; try { ownsHome = !!root.NightshiftActivities?.ownsHome?.(); } catch { /* n/a */ }
    return context({
      ...state.stats,
      delivery: prog?.delivery, salvage: prog?.salvage,
      home: ownsHome || prog?.home >= 1,
      batches: ledger.batches, sold: ledger.sold, properties: props,
      carsOwned: G.cars.filter((c) => c?.owned === true).length,
      totalLevel: levels.reduce((a, b) => a + b, 0), maxSkill: levels.length ? Math.max(...levels) : 0,
      inCar: !!p?.car,
      casinoWins: root.NightshiftCasino?.state?.wins, casinoWagered: root.NightshiftCasino?.state?.wagered,
      weaponsOwned: root.NightshiftWeapons?.state?.owned?.length || 1,
      tuneLevels: tuneStat('totalLevels'), tuneBestCar: tuneStat('bestCar'),
      raceMedals: Object.keys(root.NightshiftRaces?.state?.medals || {}).length,
      raceGolds: Object.values(root.NightshiftRaces?.state?.medals || {}).filter((m) => m === 'gold').length,
    });
  }

  function pay(goal) {
    const p = G.player, r = goal.reward || {};
    if (p && r.cash > 0 && Number.isFinite(p.cash)) { p.cash = Math.min(100000000, p.cash + r.cash); paying += r.cash; if (last) last.cash = p.cash; }
    for (const [sk, xp] of Object.entries(r.xp || {})) root.NightshiftSkills?.gain(sk, xp, 'goal:' + goal.id);
    if (gameSave) { try { gameSave(); } catch { /* ignore */ } }
  }

  function check() {
    const g = step(state, snapshot());
    if (g) {
      dirty = true; save(); pay(g);
      const r = g.reward || {};
      toast(`🎯 GOAL COMPLETE · ${g.title}${r.cash ? ` · +$${r.cash.toLocaleString()}` : ''}`);
      banner(g);
    }
    render();
  }
  setInterval(track, 100);
  setInterval(check, 1000);

  // ---- UI ----
  const css = document.createElement('style');
  css.textContent = `
  #glCard{all:unset;box-sizing:border-box;position:fixed;z-index:24;left:12px;top:122px;max-width:min(260px,46vw);cursor:pointer;
    background:#101728d9;border:1px solid #5e7793;border-left:3px solid #ffd970;border-radius:10px;color:#e8eff7;font:600 11px/1.3 ui-monospace,Menlo,monospace;padding:6px 9px}
  #glCard .t{display:block;color:#ffd970;font-size:10px;letter-spacing:.06em} #glCard .n{display:block;font-size:12px;margin:1px 0}
  #glCard .h{display:block;font-weight:400;color:#b9c8da;font-size:10.5px} #glCard .bar{display:block;height:4px;background:#0a1222;border-radius:3px;margin-top:4px;overflow:hidden}
  #glCard .bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd970,#7cdeb5)}
  #glCard.min .h,#glCard.min .bar{display:none}
  #glFlash{position:fixed;left:50%;top:68%;transform:translate(-50%,-50%) scale(.9);z-index:45;pointer-events:none;opacity:0;transition:opacity .25s,transform .25s;
    background:linear-gradient(180deg,#2a2410f2,#16120af2);border:1px solid #ffd970;border-radius:14px;padding:10px 18px;text-align:center;color:#fff7dd;font:600 13px ui-monospace,Menlo,monospace}
  #glFlash.on{opacity:1;transform:translate(-50%,-50%) scale(1)} #glFlash b{display:block;font-size:18px;color:#ffd970}
  #glPanel{position:fixed;inset:6% 6%;z-index:46;overflow:auto;background:#0f1830f5;border:1px solid #6f8db3;border-radius:14px;padding:14px 16px;color:#e8eff7;font:13px ui-monospace,Menlo,monospace}
  #glPanel[hidden]{display:none} #glPanel h2{margin:0 0 4px;font-size:16px} #glPanel h3{margin:12px 0 6px;font-size:12px;color:#9fb3c8;letter-spacing:.08em}
  #glPanel .g{display:flex;gap:8px;align-items:center;background:#16233d;border:1px solid #2f4669;border-radius:9px;padding:7px 9px;margin-bottom:6px}
  #glPanel .g.done{opacity:.55} #glPanel .g.cur{border-color:#ffd970} #glPanel .g .i{font-size:15px;width:20px;text-align:center}
  #glPanel .g .b{flex:1;min-width:0} #glPanel .g .h{font-size:11px;color:#b9c8da} #glPanel .g .r{font-size:11px;color:#7cdeb5;white-space:nowrap}
  #glPanel .close{all:unset;box-sizing:border-box;cursor:pointer;position:sticky;top:0;float:right;font:700 13px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:8px;padding:6px 10px}
  @media (max-height:430px){#glCard .h{display:none}}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const card = el('button', { id: 'glCard', type: 'button', ariaLabel: 'Next goal' });
  const flashEl = el('div', { id: 'glFlash' });
  const panel = el('div', { id: 'glPanel', hidden: true, role: 'dialog' });
  document.body.append(card, flashEl, panel);

  let flashTimer = 0;
  function banner(g) {
    flashEl.textContent = '';
    const r = g.reward || {};
    const xp = Object.entries(r.xp || {}).map(([k, v]) => `+${v} ${skillName(k)} XP`).join(' · ');
    flashEl.append(el('b', {}, `🎯 ${g.title}`), el('span', {}, [r.cash ? `+$${r.cash.toLocaleString()}` : '', xp].filter(Boolean).join(' · ')));
    flashEl.classList.add('on');
    clearTimeout(flashTimer); flashTimer = setTimeout(() => flashEl.classList.remove('on'), 2200);
  }

  const skillName = (k) => root.NightshiftSkillsData?.SKILLS.find((s) => s.id === k)?.name || k;
  const rewardText = (r = {}) => [r.cash ? `$${r.cash.toLocaleString()}` : '', ...Object.keys(r.xp || {}).map((k) => `${skillName(k)} XP`)].filter(Boolean).join(' + ');
  const fmt = (n) => (n >= 10000 ? Math.round(n / 1000) + 'k' : String(n));
  let lastKey = '';
  function render() {
    const ctx = snapshot();
    const n = next(state, ctx);
    const key = n ? `${n.goal.id}|${n.cur}` : 'all';
    if (key !== lastKey) {
      lastKey = key;
      card.textContent = '';
      if (!n) card.append(el('span', { className: 't' }, 'ALL GOALS COMPLETE'), el('span', { className: 'n' }, '👑 Nightshift legend'));
      else {
        const bar = el('span', { className: 'bar' }); const fill = el('i'); fill.style.width = Math.round(Math.min(1, n.cur / n.target) * 100) + '%'; bar.append(fill);
        card.append(el('span', { className: 't' }, `🎯 NEXT GOAL · ${doneCount(state)}/${GOALS.length}`),
          el('span', { className: 'n' }, n.target > 1 ? `${n.goal.title} · ${fmt(n.cur)}/${fmt(n.target)}` : n.goal.title),
          el('span', { className: 'h' }, n.goal.hint), bar);
      }
    }
    if (!panel.hidden) renderPanel(ctx, n);
    place();
  }
  function renderPanel(ctx, n) {
    const scroll = panel.scrollTop;
    panel.textContent = '';
    const close = el('button', { className: 'close', type: 'button' }, 'CLOSE');
    close.onclick = () => { panel.hidden = true; };
    panel.append(close, el('h2', {}, `GOALS · ${doneCount(state)}/${GOALS.length}`));
    let tier = '';
    for (const g of GOALS) {
      if (g.tier !== tier) { tier = g.tier; panel.append(el('h3', {}, tier.toUpperCase())); }
      const done = state.done[g.id] !== undefined, pr = progressOf(g, ctx), cur = n?.goal.id === g.id;
      const row = el('div', { className: 'g' + (done ? ' done' : '') + (cur ? ' cur' : '') });
      const body = el('div', { className: 'b' });
      body.append(el('div', {}, g.title + (!done && pr.target > 1 ? ` · ${fmt(pr.cur)}/${fmt(pr.target)}` : '')), el('div', { className: 'h' }, g.hint));
      row.append(el('span', { className: 'i' }, done ? '✅' : cur ? '🎯' : '▫️'), body, el('span', { className: 'r' }, rewardText(g.reward)));
      panel.append(row);
    }
    panel.scrollTop = scroll;
  }
  function place() {
    const anchor = document.querySelector('#skChip') || document.querySelector('#hud');
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    if (r.height) { card.style.top = Math.round(r.bottom + 6) + 'px'; card.style.left = Math.round(r.left) + 'px'; }
  }
  function open() { try { if (typeof root.releaseControls === 'function') root.releaseControls(); } catch { /* n/a */ } panel.hidden = false; render(); }
  card.onclick = () => { panel.hidden ? open() : (panel.hidden = true); };
  addEventListener('keydown', (e) => { if (e.key === 'g' && !(e.target instanceof HTMLInputElement)) { panel.hidden ? open() : (panel.hidden = true); } });
  render();

  root.NightshiftGoals = Object.freeze({ ...core, open, snapshot, next: () => next(state, snapshot()), get state() { return state; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
