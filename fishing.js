/* Fishing in game (Claude-owned). Requires fishing-data.js. No game file is edited:
 * USE points at fishing spots via NightshiftEncounters (like the casino), a small pier/water decal drawn in
 * world space, and a panel with the cast -> bite -> reel minigame, cooler (sell/eat) and rod shop.
 * Fishing skill (skills-data.js) speeds bites and improves rare odds; Luck helps too; night/rain change odds.
 * Save: nightshift-fishing-v1. API: NightshiftFishing.{state, open, close, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const F = root.NightshiftFishingData;
  const KEY = 'nightshift-fishing-v1';
  let state = F.clean({});
  try { state = F.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  function sky() {
    const E = root.NightshiftEnvironment, m = E?.state?.minute;
    try { return { night: Number.isFinite(m) && E.darkness(m) >= 0.8, raining: Number.isFinite(m) && E.weather(m) > 0.3 }; } catch { return { night: false, raining: false }; }
  }

  // ---- world ----
  const SITES = () => F.SPOTS.map((s) => ({ id: 'fish-' + s.id, type: 'fishing', x: s.x, y: s.y, ready: true, color: '#5ec8ff', label: '🎣 ' + s.name.toUpperCase(), action: 'FISH', hint: `${s.name} · fishing spot` }));
  const E = root.NightshiftEncounters;
  if (E && !E.__fishing) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 ? [...list, ...SITES()] : list; };
    E.use = function (id) { if (typeof id === 'string' && id.startsWith('fish-')) { open(id.slice(5)); return true; } return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawSpots(); } catch { /* cosmetic */ } return r; };
    E.__fishing = true;
  }
  function drawSpots() {
    const ctx = G(), p = P(), t = performance.now() / 1000;
    if (!ctx || !p) return;
    ctx.save();
    for (const s of F.SPOTS) {
      if (Math.hypot(p.x - s.x, p.y - s.y) > 700) continue;
      // water edge + pier planks + a bobbing float
      const wx = s.id === 'pier' ? s.x - 40 : s.x - 60, wy = s.id === 'pier' ? s.y + 18 : s.y - 70, ww = s.id === 'pier' ? 90 : 50, wh = s.id === 'pier' ? 32 : 140;
      const grd = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh); grd.addColorStop(0, '#0d3550'); grd.addColorStop(1, '#14567a');
      ctx.fillStyle = grd; ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = '#7fd3ff55'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const yy = wy + 6 + i * (wh / 4) + Math.sin(t * 2 + i) * 2; ctx.beginPath(); ctx.moveTo(wx + 4, yy); ctx.lineTo(wx + ww - 4, yy); ctx.stroke(); }
      ctx.fillStyle = '#7a5532'; for (let i = 0; i < 5; i++) ctx.fillRect(s.x - 20 + i * 9, s.y - 6, 7, 26);
      ctx.fillStyle = '#ff5161'; ctx.beginPath(); ctx.arc(s.x + 22, (s.id === 'pier' ? wy + 14 : s.y) + Math.sin(t * 3) * 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10141ccc'; ctx.fillRect(s.x - 46, s.y - 34, 92, 16);
      ctx.fillStyle = '#9fe0ff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🎣 ' + s.name.toUpperCase(), s.x, s.y - 26);
    }
    ctx.restore();
  }

  // ---- minigame state: idle | waiting | bite | reeling ----
  const game = { phase: 'idle', spot: null, until: 0, fish: null, zone: null, start: 0, hits: 0, misses: 0, msg: 'Tap CAST to throw your line.', last: null };
  let raf = 0;
  function cast() {
    if (game.phase !== 'idle') return;
    const sk = sky();
    game.phase = 'waiting'; game.until = performance.now() + F.biteTime(state.rod, mod('fishing.bite'), sk.raining) * 1000;
    game.msg = 'Line out… wait for a bite.'; game.last = null; render(); loop();
  }
  function reel() {
    if (game.phase === 'waiting') { game.phase = 'idle'; game.msg = 'Too early! The fish got spooked. Cast again.'; render(); return; }
    if (game.phase === 'bite') { // first tap starts the fight
      const sk = sky();
      game.fish = F.rollFish({ rod: state.rod, skillRare: mod('fishing.rare'), luck: Math.sqrt(mod('luck.rare')), night: sk.night, raining: sk.raining });
      game.zone = F.zoneFor(game.fish, state.rod); game.start = performance.now(); game.hits = 0; game.misses = 0; game.phase = 'reeling';
      game.msg = 'Hooked! Tap REEL when the needle is in the green.'; render(); return;
    }
    if (game.phase !== 'reeling') return;
    const pos = F.needle((performance.now() - game.start) / 1000, game.fish.speed);
    if (F.hit(pos, game.zone)) { game.hits++; game.zone = F.zoneFor(game.fish, state.rod); if (game.hits >= game.fish.hits) return landFish(); game.msg = `Good! ${game.hits}/${game.fish.hits}`; }
    else { game.misses++; game.msg = `Missed! (${game.misses}/2)`; if (game.misses >= 2) { game.phase = 'idle'; game.msg = `It got away… (${game.fish.junk ? 'probably junk' : 'felt heavy!'})`; } }
    render();
  }
  function landFish() {
    const f = game.fish, r = F.land(state, f), p = P();
    if (r.cash && p) { p.cash = Math.min(100000000, p.cash + r.cash); gameSave(); }
    try { root.NightshiftSkills?.gain('fishing', F.XP(f), 'fish'); } catch { /* optional */ }
    persist();
    game.phase = 'idle'; game.last = f;
    game.msg = f.legendary ? `✨ LEGENDARY! ${f.name}!` : r.cash ? `${f.icon} ${f.name} with ${money(r.cash)} inside!` : f.junk ? `${f.icon} ${f.name}. Into the trash.` : r.full ? `${f.icon} ${f.name}, but your cooler is full! Sell or eat first.` : `${f.icon} Caught a ${f.name} (${money(f.value)})`;
    if (f.legendary || f.value >= 180) { say(`🎣 ${f.name}!`); try { root.NightshiftAudio?.play('pickup'); } catch { /* sound */ } }
    render();
  }
  function loop() {
    cancelAnimationFrame(raf);
    const tick = () => {
      if (panel.hidden) { if (game.phase !== 'idle') { game.phase = 'idle'; game.msg = 'You reeled in your line.'; } return; }
      const now = performance.now();
      if (game.phase === 'waiting' && now >= game.until) { game.phase = 'bite'; game.until = now + 1100; game.msg = '❗ BITE! Tap REEL now!'; try { navigator.vibrate?.(60); } catch { /* n/a */ } render(); }
      else if (game.phase === 'bite' && now >= game.until) { game.phase = 'idle'; game.msg = 'Too slow, it stole the bait. Cast again.'; render(); }
      if (game.phase === 'reeling') drawNeedle();
      if (game.phase !== 'idle') raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  // ---- panel ----
  const css = document.createElement('style');
  css.textContent = `
  #fsPanel{position:fixed;inset:5% 5%;z-index:46;overflow:auto;background:linear-gradient(180deg,#0b2233f7,#071520f7);border:1px solid #5ec8ff;border-radius:14px;padding:12px 14px;color:#e6f6ff;font:13px ui-monospace,Menlo,monospace}
  #fsPanel[hidden]{display:none} #fsPanel h2{margin:0;font-size:16px;color:#9fe0ff;letter-spacing:.06em}
  #fsPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 12px ui-monospace,Menlo,monospace}
  #fsPanel .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px} #fsPanel .x{background:#123a52;border:1px solid #5ec8ff;padding:6px 10px}
  #fsPanel .sub{color:#9cc4d8;font-size:11px} #fsPanel .cols{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:12px} @media (max-width:640px){#fsPanel .cols{grid-template-columns:1fr}}
  #fsPanel .box{background:#0e2c40;border:1px solid #1f4c66;border-radius:10px;padding:10px}
  #fsPanel .msg{min-height:20px;font-weight:700;margin:6px 0} #fsPanel canvas{width:100%;height:46px;display:block;border-radius:8px;background:#06121b}
  #fsPanel .big{display:block;width:100%;padding:13px;margin-top:8px;font-size:15px;background:linear-gradient(#9fe0ff,#3aa3d8);color:#04202f}
  #fsPanel .big.reel{background:linear-gradient(#ffe48a,#e3a52c);color:#2a1300} #fsPanel .row{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:4px 0;border-bottom:1px dashed #1f4c66}
  #fsPanel .sm{padding:5px 9px;background:#123a52;border:1px solid #2f6b8c} #fsPanel .sm[disabled]{opacity:.4;pointer-events:none} #fsPanel .on{color:#7cdeb5}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const panel = el('div', { id: 'fsPanel', hidden: true, role: 'dialog', ariaLabel: 'Fishing' });
  document.body.append(panel);
  let track = null;
  function drawNeedle() {
    if (!track || !game.zone) return;
    const c = track.getContext('2d'), w = track.width, h = track.height;
    c.clearRect(0, 0, w, h); c.fillStyle = '#0b2433'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2bd17e'; c.fillRect(game.zone.from * w, 4, (game.zone.to - game.zone.from) * w, h - 8);
    const pos = F.needle((performance.now() - game.start) / 1000, game.fish.speed);
    c.fillStyle = '#ffd970'; c.fillRect(pos * w - 3, 0, 6, h);
  }
  let spotName = '';
  function render() {
    if (panel.hidden) return;
    const p = P(), cash = p?.cash ?? 0, scroll = panel.scrollTop, sk = sky(), rod = F.ROD[state.rod];
    panel.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'LEAVE'); x.onclick = close;
    top.append(el('h2', {}, `🎣 ${spotName.toUpperCase()}`), x);
    panel.append(top, el('div', { className: 'sub' }, `Fishing Lv ${root.NightshiftSkills?.level('fishing') ?? 1} · ${rod.name} · ${sk.night ? '🌙 night: eels & catfish bite' : '☀️ day'}${sk.raining ? ' · 🌧️ rain: faster bites, tuna' : ''}`));
    const cols = el('div', { className: 'cols' }), left = el('div', { className: 'box' }), right = el('div', { className: 'box' });
    left.append(el('div', { className: 'msg' }, game.msg));
    track = el('canvas', { width: 420, height: 46 }); left.append(track);
    const btn = el('button', { className: 'big' + (game.phase === 'idle' ? '' : ' reel'), type: 'button' }, game.phase === 'idle' ? 'CAST' : 'REEL');
    btn.onpointerdown = (e) => { e.preventDefault(); game.phase === 'idle' ? cast() : reel(); };
    left.append(btn);
    if (game.phase === 'reeling') drawNeedle(); else { const c = track.getContext('2d'); c.fillStyle = '#0b2433'; c.fillRect(0, 0, 420, 46); c.fillStyle = '#5ec8ff55'; c.font = '13px monospace'; c.fillText(game.phase === 'waiting' ? '~ ~ ~ waiting ~ ~ ~' : game.phase === 'bite' ? '!!! BITE !!!' : 'reel track', 140, 28); }
    left.append(el('div', { className: 'sub', style: 'margin-top:8px' }, `Caught ${state.total} · best ${money(state.best)} · species ${Object.keys(state.caught).filter((k) => !F.BY_ID[k].junk).length}/${F.FISH.filter((f) => !f.junk).length}`));
    // cooler
    const n = F.coolerCount(state), price = mod('dealing.price');
    right.append(el('div', {}, `🧊 Cooler ${n}/${F.COOLER}`));
    for (const [id, k] of Object.entries(state.cooler)) {
      const f = F.BY_ID[id], row = el('div', { className: 'row' });
      const eatB = el('button', { className: 'sm', type: 'button', disabled: !p || p.hp >= 100 }, `EAT +${f.hp}HP`);
      eatB.onclick = () => { const hp = F.eat(state, id); if (hp && p) { p.hp = Math.min(100, p.hp + hp); persist(); gameSave(); say(`${f.icon} Ate ${f.name} · +${hp} HP`); render(); } };
      row.append(el('span', {}, `${f.icon} ${f.name} ×${k}`), eatB); right.append(row);
    }
    const value = Object.entries(state.cooler).reduce((t, [id, k]) => t + Math.round(F.BY_ID[id].value * price) * k, 0);
    const sell = el('button', { className: 'sm', type: 'button', disabled: !n, style: 'margin-top:8px;width:100%' }, `SELL ALL · ${money(value)}`);
    sell.onclick = () => { const r = F.sellAll(state, price); if (r.n && p) { p.cash = Math.min(100000000, p.cash + r.cash); persist(); gameSave(); say(`🐟 Sold ${r.n} fish · +${money(r.cash)}`); render(); } };
    right.append(sell, el('div', { className: 'sub', style: 'margin:10px 0 4px' }, 'Rods'));
    for (const r of F.RODS) {
      const own = state.rods.includes(r.id), row = el('div', { className: 'row' });
      const b = el('button', { className: 'sm', type: 'button', disabled: state.rod === r.id || (!own && cash < r.price) }, state.rod === r.id ? 'IN HAND' : own ? 'USE' : `BUY ${money(r.price)}`);
      b.onclick = () => { const pl = P(); if (!pl) return; const res = F.buyRod(state, pl, r.id); if (!res.ok) { say(res.reason); return; } persist(); gameSave(); if (res.price) say(`🎣 Bought ${r.name} · -${money(res.price)}`); render(); };
      row.append(el('span', { className: state.rod === r.id ? 'on' : '' }, `${r.name}${r.bite < 1 ? ` · bites ${Math.round((1 - r.bite) * 100)}% faster` : ''}`), b); right.append(row);
    }
    cols.append(left, right); panel.append(cols);
    panel.scrollTop = scroll;
  }
  function open(spotId) {
    const p = P(), s = F.SPOTS.find((x) => x.id === spotId) || F.SPOTS[0];
    if (!p || p.hp <= 0) return false;
    if (p.car) { say('Park and walk to the water to fish'); return false; }
    try { root.releaseControls?.(); } catch { /* n/a */ }
    spotName = s.name; game.phase = 'idle'; game.msg = 'Tap CAST to throw your line.'; panel.hidden = false; render(); return true;
  }
  function close() { panel.hidden = true; game.phase = 'idle'; }
  addEventListener('keydown', (e) => {
    if (panel.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); game.phase === 'idle' ? cast() : reel(); }
    e.stopImmediatePropagation();
  }, true);

  root.NightshiftFishing = Object.freeze({ open, close, paused: () => !panel.hidden, get state() { return state; }, game: () => ({ ...game }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
