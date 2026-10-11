/* Venues in game (Claude-owned): Iron Works Gym and the clubs. Requires venues-data.js (+ lab for product).
 * USE points via NightshiftEncounters at Codex buildings (a CLOTHING front for the gym, the two non-casino CLUBs).
 * Save: nightshift-venues-v1. API: NightshiftVenues.{state, open, close, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const V = root.NightshiftVenuesData;
  const KEY = 'nightshift-venues-v1';
  let state = V.clean({});
  try { state = V.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const B = () => { try { return buildings; } catch { return []; } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  let spots = null;
  function places() {
    if (!spots) {
      const door = (v, kind) => { const b = B().filter((x) => x?.name === v.building).sort((p, q) => dist(p, v.near) - dist(q, v.near))[0] || { ...v.near, w: 240, h: 170 }; return { ...v, kind, x: b.x + b.w / 2 + v.dx, y: b.y + b.h + 12 }; };
      spots = [...V.GYMS.map((g2) => door(g2, 'gym')), ...V.CLUBS.map((c) => door(c, 'club'))];
    }
    return spots;
  }
  const SITES = () => places().map((s) => ({ id: `venue-${s.kind}-${s.id}`, type: s.kind, x: s.x, y: s.y, ready: true, color: s.kind === 'gym' ? '#7cdeb5' : '#ff4fd8', label: (s.kind === 'gym' ? '🏋️ ' : '🪩 ') + s.name.toUpperCase(), action: s.kind === 'gym' ? 'GYM' : 'CLUB', hint: s.kind === 'gym' ? `${s.name} · train Speed & Toughness` : `${s.name} · work the room` }));
  const E = root.NightshiftEncounters;
  if (E && !E.__venues) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 ? [...list, ...SITES()] : list; };
    E.use = function (id) { if (typeof id === 'string' && id.startsWith('venue-')) { const [, kind, vid] = id.split('-'); open(kind, vid); return true; } return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawSigns(); } catch { /* cosmetic */ } return r; };
    E.__venues = true;
  }
  function drawSigns() {
    const ctx = G(), p = P(), t = performance.now() / 1000;
    if (!ctx || !p) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const s of places()) {
      if (dist(p, s) > 600) continue;
      const gym = s.kind === 'gym', x = s.x + (gym ? 0 : 78), y = s.y - 6;
      ctx.fillStyle = '#0f1416e8'; ctx.fillRect(x - 40, y - 11, 80, 20);
      ctx.strokeStyle = gym ? '#7cdeb5' : `hsl(${(t * 60) % 360},90%,65%)`; ctx.lineWidth = 2; ctx.strokeRect(x - 40, y - 11, 80, 20);
      ctx.fillStyle = gym ? '#c8ffe9' : '#ffd6f6'; ctx.font = 'bold 10px monospace'; ctx.fillText(gym ? '🏋️ IRON GYM' : '🪩 ' + s.name.toUpperCase(), x, y - 1);
    }
    ctx.restore();
  }

  // ---- panel ----
  const css = document.createElement('style');
  css.textContent = `
  #vnPanel{position:fixed;inset:6% 6%;z-index:46;overflow:auto;border-radius:14px;padding:12px 14px;font:13px ui-monospace,Menlo,monospace}
  #vnPanel.gym{background:linear-gradient(180deg,#0f1f1af7,#08120ff7);border:1px solid #7cdeb5;color:#e6fff4} #vnPanel.club{background:linear-gradient(180deg,#24082af7,#12041af7);border:1px solid #ff4fd8;color:#ffe9fb}
  #vnPanel[hidden]{display:none} #vnPanel h2{margin:0;font-size:16px}
  #vnPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 12px ui-monospace,Menlo,monospace}
  #vnPanel .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px} #vnPanel .x{border:1px solid currentColor;padding:6px 10px}
  #vnPanel .sub{opacity:.75;font-size:11px} #vnPanel .row{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
  #vnPanel .go{padding:9px 13px;background:#ffffff1a;border:1px solid currentColor} #vnPanel .go[disabled]{opacity:.35;pointer-events:none} #vnPanel .go.on{background:#ffffff33}
  #vnPanel .big{display:block;width:100%;padding:14px;margin-top:8px;font-size:15px;background:linear-gradient(#b7f5dc,#4fbf96);color:#06251a}
  #vnPanel canvas{width:100%;height:40px;display:block;border-radius:8px;background:#06120e} #vnPanel .msg{font-weight:700;min-height:20px;margin:6px 0}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const panel = el('div', { id: 'vnPanel', hidden: true, role: 'dialog' });
  document.body.append(panel);
  let cur = null; // { kind, id, name }
  const gym = { on: false, workout: 'mixed', rep: 0, good: 0, zone: null, start: 0, msg: 'Pick a workout and pay the session fee.', canvas: null };
  let raf = 0;

  function render() {
    if (panel.hidden || !cur) return;
    const p = P(), cash = p?.cash ?? 0, scroll = panel.scrollTop;
    panel.className = cur.kind; panel.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'LEAVE'); x.onclick = close;
    top.append(el('h2', {}, (cur.kind === 'gym' ? '🏋️ ' : '🪩 ') + cur.name.toUpperCase()), x); panel.append(top);
    if (cur.kind === 'gym') renderGym(cash); else renderClub(cash);
    panel.scrollTop = scroll;
  }
  function renderGym(cash) {
    const wait = Math.max(0, Math.ceil((state.gymAt + V.GYM.cooldownMs - Date.now()) / 1000));
    panel.append(el('div', { className: 'sub' }, `Speed Lv ${root.NightshiftSkills?.level('athletics') ?? 1} · Toughness Lv ${root.NightshiftSkills?.level('toughness') ?? 1} · sessions ${state.sessions}`));
    if (!gym.on) {
      const row = el('div', { className: 'row' });
      for (const [id, name] of [['cardio', '🏃 Cardio → Speed'], ['weights', '🏋️ Weights → Toughness'], ['mixed', '⚖️ Mixed']]) {
        const b = el('button', { className: 'go' + (gym.workout === id ? ' on' : ''), type: 'button' }, name); b.onclick = () => { gym.workout = id; render(); }; row.append(b);
      }
      panel.append(row, el('div', { className: 'msg' }, gym.msg));
      const startB = el('button', { className: 'big', type: 'button', disabled: wait > 0 || cash < V.GYM.fee }, wait > 0 ? `CATCH YOUR BREATH · ${wait}s` : `START SET · ${money(V.GYM.fee)}`);
      startB.onclick = () => { const pl = P(); if (!pl || pl.cash < V.GYM.fee) return; pl.cash -= V.GYM.fee; gameSave(); gym.on = true; gym.rep = 0; gym.good = 0; gym.zone = V.sweet(0); gym.start = performance.now(); gym.msg = 'Tap REP when the bar is in the green!'; render(); loop(); };
      panel.append(startB);
    } else {
      panel.append(el('div', { className: 'msg' }, `${gym.msg} · rep ${gym.rep}/${V.GYM.reps} · good ${gym.good}`));
      gym.canvas = el('canvas', { width: 420, height: 40 }); panel.append(gym.canvas);
      const rep = el('button', { className: 'big', type: 'button' }, 'REP!'); rep.onpointerdown = (e) => { e.preventDefault(); doRep(); }; panel.append(rep);
      drawBar();
    }
  }
  function drawBar() {
    const c = gym.canvas?.getContext('2d'); if (!c || !gym.zone) return;
    c.fillStyle = '#0b1a14'; c.fillRect(0, 0, 420, 40); c.fillStyle = '#2bd17e'; c.fillRect(gym.zone.from * 420, 4, (gym.zone.to - gym.zone.from) * 420, 32);
    c.fillStyle = '#ffd970'; c.fillRect(V.bar((performance.now() - gym.start) / 1000, 1.1 + gym.rep * 0.06) * 420 - 3, 0, 6, 40);
  }
  function doRep() {
    if (!gym.on) return;
    const pos = V.bar((performance.now() - gym.start) / 1000, 1.1 + gym.rep * 0.06), ok = pos >= gym.zone.from && pos <= gym.zone.to;
    gym.rep++; if (ok) gym.good++; gym.msg = ok ? '💪 Clean rep!' : '😮‍💨 Sloppy…';
    gym.zone = V.sweet(gym.rep);
    if (gym.rep >= V.GYM.reps) finishGym(); else render();
  }
  function finishGym() {
    gym.on = false; cancelAnimationFrame(raf);
    const xp = V.gymXp(gym.good, gym.workout), p = P();
    for (const [sk, n] of Object.entries(xp)) if (n > 0) try { root.NightshiftSkills?.gain(sk, n, 'gym'); } catch { /* optional */ }
    const heal = gym.good >= 7 ? V.GYM.heal : 0;
    if (heal && p) p.hp = Math.min(100, p.hp + heal);
    state.gymAt = Date.now(); state.sessions++; persist(); gameSave();
    gym.msg = `Set done: ${gym.good}/${V.GYM.reps} clean · +${Object.values(xp).reduce((a, b) => a + b, 0)} XP${heal ? ` · protein shake +${heal} HP` : ''}`;
    say(`🏋️ ${gym.msg}`); render();
  }
  function loop() { cancelAnimationFrame(raf); const t = () => { if (!gym.on || panel.hidden) { gym.on = false; return; } drawBar(); raf = requestAnimationFrame(t); }; raf = requestAnimationFrame(t); }

  function renderClub(cash) {
    const L = root.NightshiftLabData, lab = root.NightshiftLab?.state, id = cur.id;
    const wait = Math.max(0, Math.ceil(((state.clubAt[id] || 0) + V.CLUB.cooldownMs - Date.now()) / 1000));
    const risk = V.bustChance(mod('stealth.heat'));
    panel.append(el('div', { className: 'sub' }, `Sell lab product at ${Math.round((V.CLUB.premium - 1) * 100)}%+ over value · up to ${V.CLUB.maxPerVisit} per visit · bust risk ${Math.round(risk * 100)}% per sale (Stealth lowers it)`));
    if (!L || !lab || !Object.keys(lab.stash).length) panel.append(el('div', { className: 'msg' }, 'You have nothing to sell. Cook product at a ⚗️ LAB first.'));
    else if (wait > 0) panel.append(el('div', { className: 'msg' }, `The room is watching you. Come back in ${wait}s.`));
    else {
      const row = el('div', { className: 'row' });
      for (const [pid, n] of Object.entries(lab.stash)) {
        const pr = L.PRODUCTS[pid], price = V.clubPrice(pr.value, mod('charisma.jobPay'));
        const b = el('button', { className: 'go', type: 'button' }, `${pr.icon} ${pr.name} ×${n} · ${money(price)}`);
        b.onclick = () => sell(pid, price); row.append(b);
      }
      panel.append(el('div', { className: 'msg' }, `${cur.sold || 0}/${V.CLUB.maxPerVisit} sold this visit`), row);
    }
    const roundWait = (state.rounds[id] || 0) + V.CLUB.cooldownMs > Date.now();
    const round = el('button', { className: 'go', type: 'button', disabled: roundWait || cash < V.CLUB.roundCost, style: 'margin-top:10px' }, roundWait ? '🍸 Round bought' : `🍸 BUY A ROUND · ${money(V.CLUB.roundCost)} (+Charisma)`);
    round.onclick = () => { const p = P(); if (!p || p.cash < V.CLUB.roundCost) return; p.cash -= V.CLUB.roundCost; state.rounds[id] = Date.now(); persist(); gameSave(); try { root.NightshiftSkills?.gain('charisma', V.CLUB.roundXp, 'club'); } catch { /* optional */ } say('🍸 The bar loves you · +Charisma'); render(); };
    panel.append(round);
  }
  function sell(pid, price) {
    const L = root.NightshiftLabData, lab = root.NightshiftLab?.state, p = P();
    if (!L || !lab || !p || !L.take(lab, pid, 1)) return;
    try { localStorage.setItem('nightshift-lab-v1', JSON.stringify(lab)); } catch { /* best effort */ }
    cur.sold = (cur.sold || 0) + 1;
    if (Math.random() < V.bustChance(mod('stealth.heat'))) {
      p.heat = Math.min(5, (p.heat || 0) + V.CLUB.bustHeat); state.busts++; state.clubAt[cur.id] = Date.now(); persist(); gameSave();
      try { root.NightshiftCrime?.report?.({ x: p.x, y: p.y }, performance.now(), 'incident'); } catch { /* optional */ }
      say('🚨 Undercover cop! Product seized. RUN!'); close(); return;
    }
    p.cash = Math.min(100000000, p.cash + price); state.sold++;
    try { root.NightshiftSkills?.gain('dealing', 25, 'club'); } catch { /* optional */ }
    if (cur.sold >= V.CLUB.maxPerVisit) state.clubAt[cur.id] = Date.now();
    persist(); gameSave(); say(`🪩 Sold ${L.PRODUCTS[pid].name} · +${money(price)}`); render();
  }
  function open(kind, id) {
    const p = P(); if (!p || p.hp <= 0) return false;
    if (p.car) { say('Park and walk in'); return false; }
    const s = places().find((x) => x.kind === kind && x.id === id); if (!s) return false;
    cur = { kind, id, name: s.name, sold: 0 };
    try { root.releaseControls?.(); } catch { /* n/a */ }
    panel.hidden = false; render(); return true;
  }
  function close() { panel.hidden = true; gym.on = false; }
  addEventListener('keydown', (e) => {
    if (panel.hidden) return;
    if (e.key === 'Escape') close(); else if ((e.key === ' ' || e.key === 'Enter') && gym.on) { e.preventDefault(); doRep(); }
    e.stopImmediatePropagation();
  }, true);
  setInterval(() => { if (!panel.hidden && !gym.on) render(); }, 1000);

  root.NightshiftVenues = Object.freeze({ open, close, paused: () => !panel.hidden, places: () => places(), get state() { return state; }, gym: () => ({ on: gym.on, rep: gym.rep, good: gym.good, zone: gym.zone, start: gym.start }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
