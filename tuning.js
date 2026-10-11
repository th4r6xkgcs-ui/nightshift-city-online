/* Tuning garage (Claude-owned). Requires tuning-data.js. No game file is edited:
 *  - a TUNE point beside each GARAGE door (via NightshiftEncounters, like the casino/gun shop);
 *  - engine/handling upgrades shape the player's car in NightshiftVehicles.handling (wrapped);
 *  - armor reduces crash (NightshiftVehicles.damage) and bullet (NightshiftVehicles.hit) damage;
 *  - paint sets car.color, which the game's sprites draw and its vehicle save keeps.
 * Save: nightshift-tuning-v1. API: NightshiftTuning.{state, open, close, factor, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const T = root.NightshiftTuningData;
  const KEY = 'nightshift-tuning-v1';
  let state = T.clean({});
  try { state = T.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };

  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const CARS = () => { try { return cars; } catch { return []; } };
  const B = () => { try { return buildings; } catch { return []; } };
  const G = () => { try { return g; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { root.NightshiftVehicles?.save?.(); const f = Function('return typeof save==="function"?save:null')(); if (f) f(); } catch { /* not ready */ } };
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const discount = () => { try { return root.NightshiftSkills?.mod('charisma.shopPrice') ?? 1; } catch { return 1; } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const f = (car, id) => (car?.id ? T.factor(state, car.id, id) : 1);

  // ---- effects ----
  function install() {
    const V = root.NightshiftVehicles;
    if (!V || V.__tuning) return;
    const handling = V.handling, damage = V.damage, hit = V.hit;
    V.handling = function (car) {
      const p = P();
      if (!p || !car || p.car !== car) return handling.apply(this, arguments);
      const e = f(car, 'engine'), h = f(car, 'handling'), a0 = car.angle;
      car.speed /= e;
      const r = handling.apply(this, arguments);
      car.speed *= e;
      car.angle = a0 + (car.angle - a0) * h;
      return r;
    };
    const armored = (fn) => function (car) {
      const c0 = car?.condition;
      const r = fn.apply(this, arguments);
      if (car && Number.isFinite(c0) && car.condition < c0) car.condition = c0 - (c0 - car.condition) * f(car, 'armor');
      return r;
    };
    if (typeof damage === 'function') V.damage = armored(damage);
    if (typeof hit === 'function') V.hit = armored(hit);
    V.__tuning = true;
  }
  install();
  const retry = setInterval(() => { install(); if (root.NightshiftVehicles?.__tuning) clearInterval(retry); }, 1000);

  // ---- world: a TUNE point beside every GARAGE ----
  let sites = null;
  function garageSites() {
    if (!sites) sites = B().filter((b) => b && b.name === 'GARAGE').map((b, i) => ({ id: 'tune-' + i, type: 'tune', x: b.x + b.w / 2 + 90, y: b.y + b.h + 12, ready: true, color: '#7cdeb5', label: 'TUNING', action: 'TUNE', hint: 'Tuning garage · engine, handling, armor, paint' }));
    return sites;
  }
  const E = root.NightshiftEncounters;
  if (E && !E.__tuning) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 ? [...list, ...garageSites()] : list; };
    E.use = function (id) { if (typeof id === 'string' && id.startsWith('tune-')) { open(); return true; } return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawSigns(); } catch { /* cosmetic */ } return r; };
    E.__tuning = true;
  }
  function drawSigns() {
    const ctx = G();
    if (!ctx) return;
    ctx.save();
    for (const s of garageSites()) {
      ctx.fillStyle = '#3a2a18'; ctx.fillRect(s.x - 2, s.y - 2, 4, 12);
      ctx.fillStyle = '#0f1a18e8'; ctx.fillRect(s.x - 30, s.y - 22, 60, 20);
      ctx.strokeStyle = '#7cdeb5'; ctx.lineWidth = 2; ctx.strokeRect(s.x - 30, s.y - 22, 60, 20);
      ctx.fillStyle = '#c8ffe9'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔧 TUNING', s.x, s.y - 12);
    }
    ctx.restore();
  }

  // ---- panel ----
  const css = document.createElement('style');
  css.textContent = `
  #tnPanel{position:fixed;inset:5% 5%;z-index:46;overflow:auto;background:linear-gradient(180deg,#14201ef7,#0b1211f7);border:1px solid #7cdeb5;border-radius:14px;padding:12px 14px;color:#e8f6f0;font:13px ui-monospace,Menlo,monospace}
  #tnPanel[hidden]{display:none} #tnPanel h2{margin:0;font-size:16px;color:#7cdeb5;letter-spacing:.06em}
  #tnPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 12px ui-monospace,Menlo,monospace}
  #tnPanel .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px} #tnPanel .x{background:#1d3a33;border:1px solid #7cdeb5;padding:6px 10px}
  #tnPanel .sub{color:#a9c9bd;font-size:11px;margin:2px 0 8px} #tnPanel .cars{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
  #tnPanel .car{padding:6px 10px;background:#1a2a27;border:1px solid #2f4a44;display:flex;gap:6px;align-items:center} #tnPanel .car.on{border-color:#7cdeb5;background:#1d3a33}
  #tnPanel .sw{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid #0008}
  #tnPanel .up{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;background:#1a2a27;border:1px solid #2f4a44;border-radius:10px;padding:8px 10px;margin-bottom:6px}
  #tnPanel .pips{display:flex;gap:4px;margin-top:4px} #tnPanel .pip{width:22px;height:6px;border-radius:3px;background:#0b1211;border:1px solid #2f4a44} #tnPanel .pip.on{background:#7cdeb5}
  #tnPanel .buy{padding:7px 12px;background:linear-gradient(#b7f5dc,#4fbf96);color:#06251a} #tnPanel .buy[disabled]{opacity:.4;pointer-events:none}
  #tnPanel .paints{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px} #tnPanel .paint{width:34px;height:26px;border:2px solid #0006} #tnPanel .paint.on{border-color:#fff}
  #tnPanel .d{font-size:11px;color:#a9c9bd}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const panel = el('div', { id: 'tnPanel', hidden: true, role: 'dialog', ariaLabel: 'Tuning garage' });
  document.body.append(panel);
  let selected = null;

  // Owned cars parked near you (the garage works on what you bring it).
  function nearbyOwned() {
    const p = P();
    if (!p) return [];
    return CARS().filter((c) => c?.owned && c.id && Math.hypot(c.x - p.x, c.y - p.y) < 260).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  }
  function render() {
    if (panel.hidden) return;
    const p = P(), cash = p?.cash ?? 0, dc = discount(), list = nearbyOwned(), scroll = panel.scrollTop;
    if (!list.includes(selected)) selected = list[0] || null;
    panel.textContent = '';
    const top = el('div', { className: 'top' });
    const x = el('button', { className: 'x', type: 'button' }, 'LEAVE'); x.onclick = close;
    top.append(el('h2', {}, '🔧 TUNING GARAGE'), x);
    panel.append(top, el('div', { className: 'sub' }, `Cash ${money(cash)}${dc < 1 ? ` · Charisma discount ${Math.round((1 - dc) * 100)}%` : ''} · Upgrades stack with your Driving skill and stay on the car.`));
    if (!selected) { panel.append(el('p', {}, '🚗 Park one of your own cars next to the garage, then come back. (Buy cars with MORE → CAR.)')); return; }
    const cars = el('div', { className: 'cars' });
    for (const c of list) {
      const b = el('button', { className: 'car' + (c === selected ? ' on' : ''), type: 'button' });
      const sw = el('span', { className: 'sw' }); sw.style.background = c.color || '#888';
      b.append(sw, document.createTextNode(`${c.model || 'CAR'} · ${Math.round(c.condition ?? 100)}%`));
      b.onclick = () => { selected = c; render(); };
      cars.append(b);
    }
    panel.append(cars);
    const lv = T.levels(state, selected.id);
    for (const u of T.UPGRADES) {
      const row = el('div', { className: 'up' });
      const left = el('div');
      const pct = Math.round((T.factor(state, selected.id, u.id) - 1) * 100);
      left.append(el('div', {}, `${u.icon} ${u.name} · Lv ${lv[u.id]}/${T.MAX}${pct ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}`), el('div', { className: 'd' }, u.desc));
      const pips = el('div', { className: 'pips' });
      for (let i = 0; i < T.MAX; i++) pips.append(el('span', { className: 'pip' + (i < lv[u.id] ? ' on' : '') }));
      left.append(pips);
      const price = T.nextPrice(state, selected.id, u.id, dc);
      const b = el('button', { className: 'buy', type: 'button', disabled: price === null || cash < price }, price === null ? 'MAXED' : `UPGRADE · ${money(price)}`);
      b.onclick = () => {
        const pl = P(); if (!pl) return;
        const r = T.upgrade(state, pl, selected, u.id, discount());
        if (!r.ok) { say(r.reason); return; }
        persist(); gameSave(); say(`${u.icon} ${u.name} Lv ${r.level} installed · -${money(r.price)}`); render();
      };
      row.append(left, b);
      panel.append(row);
    }
    const prow = el('div', { className: 'up' });
    const left = el('div');
    left.append(el('div', {}, `🎨 Paint · ${money(Math.round(T.PAINT_PRICE * Math.max(0.5, Math.min(1, dc))))}`));
    const paints = el('div', { className: 'paints' });
    for (const c of T.PAINTS) {
      const b = el('button', { className: 'paint' + (selected.color === c.hex ? ' on' : ''), type: 'button', title: c.name, ariaLabel: 'Paint ' + c.name });
      b.style.background = c.hex;
      b.onclick = () => {
        const pl = P(); if (!pl) return;
        const r = T.paint(pl, selected, c.hex, discount());
        if (!r.ok) { say(r.reason); return; }
        gameSave(); say(`🎨 Painted ${c.name} · -${money(r.price)}`); render();
      };
      paints.append(b);
    }
    left.append(paints); prow.append(left, el('span'));
    panel.append(prow);
    panel.scrollTop = scroll;
  }
  function open() { const p = P(); if (!p || p.hp <= 0) return false; try { root.releaseControls?.(); } catch { /* n/a */ } panel.hidden = false; render(); return true; }
  function close() { panel.hidden = true; }
  addEventListener('keydown', (e) => { if (panel.hidden) return; if (e.key === 'Escape') close(); e.stopImmediatePropagation(); }, true);

  root.NightshiftTuning = Object.freeze({ open, close, paused: () => !panel.hidden, factor: (car, id) => f(car, id), sites: () => garageSites(), get state() { return state; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
