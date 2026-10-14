/* Home upgrades (Claude-owned). Requires home-data.js. No game file is edited:
 *  - a laptop desk in the apartment (USE: UPGRADES) sells furniture with real perks;
 *  - furniture is drawn by wrapping NightshiftInteriors.draw (room space, 640x420);
 *  - extra USE points come from wrapping NightshiftHome.interaction/use; the room position is read
 *    from home.js's NightshiftSprites.person(roomPos, true, {weapon:false}) call (wrapped);
 *  - resting in bed (the game heals you) also applies bed/locker/scanner perks;
 *  - the grow tent produces weed over time (offline too) for the carried pocket.
 * Save: nightshift-home-v1. API: NightshiftHomeUpgrades.{state, open, goalBonus, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const H = root.NightshiftHomeData;
  const KEY = 'nightshift-home-v1';
  let state = H.clean({});
  try { state = H.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };

  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const CS = () => { try { return combatState; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { const f = (typeof save === 'function' ? save : null); if (f) f(); } catch { /* not ready */ } };
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };
  const money = (n) => '$' + Math.round(n).toLocaleString();

  let roomPos = null, roomSeen = 0;
  const inHome = () => {
    const H2 = root.NightshiftHome;
    if (!H2?.paused?.() || performance.now() - roomSeen > 500) return false;
    try { const k = typeof H2.kind === 'function' ? H2.kind() : H2.kind; return k === undefined || k === 'home'; } catch { return true; }
  };

  function myTargets() {
    const out = [{ kind: 'laptop', action: 'UPGRADES', label: 'Home upgrades', ...H.LAPTOP }];
    if (H.has(state, 'tent')) out.push({ kind: 'tent', action: 'HARVEST', label: `Grow tent · ${state.tent.stock}/${H.TENT.max} weed`, x: H.BY_ID.tent.x, y: H.BY_ID.tent.y });
    return out;
  }

  function install() {
    const S = root.NightshiftSprites, HM = root.NightshiftHome, I = root.NightshiftInteriors;
    if (S && !S.__home && typeof S.person === 'function') {
      const person = S.person;
      S.person = function (pos, isPlayer, opts) { if (opts && opts.weapon === false && isPlayer) { roomPos = pos; roomSeen = performance.now(); } return person.apply(this, arguments); };
      S.__home = true;
    }
    // The memory-foam bed is drawn over Codex's BED furniture sprite (which renders after the room floor).
    if (S && !S.__homeBed && typeof S.furniture === 'function') {
      const furniture = S.furniture;
      S.furniture = function (f) {
        const r = furniture.apply(this, arguments);
        if (f?.label === 'BED' && H.has(state, 'bed')) { try { drawDuvet(f); } catch { /* cosmetic */ } }
        return r;
      };
      S.__homeBed = true;
    }
    if (I && !I.__home && typeof I.draw === 'function') {
      const draw = I.draw;
      I.draw = function (kind, ctx) { const r = draw.apply(this, arguments); if (kind === 'home') { try { drawRoom(ctx); } catch { /* cosmetic */ } } return r; };
      I.__home = true;
    }
    if (HM && !HM.__home && typeof HM.interaction === 'function' && typeof HM.use === 'function') {
      const interaction = HM.interaction, use = HM.use;
      HM.interaction = function () {
        const t = interaction.apply(this, arguments);
        if (!roomPos || !inHome()) return t;
        const d = (o) => Math.hypot(roomPos.x - o.x, roomPos.y - o.y);
        let best = t && Number.isFinite(t.x) ? t : null;
        for (const m of myTargets()) if (d(m) < 70 && (!best || d(m) < d(best))) best = m;
        return best || t;
      };
      HM.use = function () {
        const t = inHome() ? HM.interaction() : null;
        if (t?.kind === 'laptop') { open(); return true; }
        if (t?.kind === 'tent') { harvest(); return true; }
        const r = use.apply(this, arguments);
        if (t?.kind === 'bed') afterRest();
        return r;
      };
      HM.__home = true;
    }
  }
  install();
  const retry = setInterval(() => { install(); if (root.NightshiftHome?.__home && root.NightshiftInteriors?.__home && root.NightshiftSprites?.__home && root.NightshiftSprites?.__homeBed) clearInterval(retry); }, 1000);

  function afterRest() {
    const out = H.rest(state, Date.now()), notes = [];
    if (out.wellRested && root.NightshiftSkills?.setBoost?.(H.WELL_RESTED.mult, H.WELL_RESTED.ms, 'Well rested')) notes.push('😴 Well rested: +25% XP for 10 min');
    const cs = CS();
    if (out.rounds && cs) { const add = Math.min(out.rounds, 240 - cs.reserve); if (add > 0) { cs.reserve += add; notes.push(`🗄️ +${add} rounds`); } }
    const p = P();
    if (out.clearHeat && p && p.heat > 0) { p.heat = 0; notes.push('📻 Heat cleared'); }
    persist(); gameSave();
    if (notes.length) setTimeout(() => say(notes.join(' · ')), 900);
  }
  function harvest() {
    H.growTent(state, Date.now(), mod('farming.growTime'));
    const n = state.tent.stock, pocket = root.NightshiftInventory?.state?.pocket;
    if (!n) { say('🌿 Nothing ready yet · 1 weed every few minutes'); return; }
    if (!pocket) return;
    const room = Math.max(0, 999 - (pocket.weed || 0)), take = Math.min(n, room);
    if (!take) { say('Pockets full'); return; }
    pocket.weed = (pocket.weed || 0) + take; state.tent.stock -= take;
    try { root.NightshiftSkills?.gain('farming', 20 * take, 'tent'); } catch { /* optional */ }
    persist(); try { root.NightshiftInventory?.save?.(); } catch { /* optional */ } gameSave();
    say(`🌿 Harvested ${take} weed · sell it at a dealer`);
  }
  setInterval(() => { if (H.growTent(state, Date.now(), mod('farming.growTime'))) persist(); }, 5000);

  // ---- drawing (room space) ----
  function drawDuvet(f) {
    /* eslint-disable-next-line no-undef */
    const ctx = (() => { try { return g; } catch { return null; } })();
    if (!ctx) return;
    const px = f.x + 6, pw = f.w - 12, top = f.y + 6;
    ctx.save();
    ctx.fillStyle = '#f4efff'; ctx.fillRect(px + 2, top, pw / 2 - 6, Math.max(8, f.h * 0.16)); ctx.fillRect(px + pw / 2 + 4, top, pw / 2 - 6, Math.max(8, f.h * 0.16));
    const dy = top + f.h * 0.24, dh = f.h - (dy - f.y) - 6;
    ctx.fillStyle = '#6c4fd0'; ctx.fillRect(px, dy, pw, dh);
    ctx.fillStyle = '#8d74e8'; for (let i = 0; i < 4; i++) ctx.fillRect(px + 4 + i * (pw / 4), dy + 4, pw / 4 - 8, dh - 8);
    ctx.fillStyle = '#ffd970'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText('★ MEMORY FOAM ★', f.x + f.w / 2, f.y + f.h + 10);
    ctx.restore();
  }
  function drawRoom(ctx) {
    const t = performance.now() / 1000;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // laptop desk (always)
    const L = H.LAPTOP;
    ctx.fillStyle = '#00000040'; ctx.fillRect(L.x - 30, L.y - 8, 64, 30);
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(L.x - 32, L.y - 12, 64, 26);
    ctx.fillStyle = '#2b2f38'; ctx.fillRect(L.x - 13, L.y - 10, 26, 16);
    ctx.fillStyle = `hsl(${190 + 20 * Math.sin(t * 2)},70%,60%)`; ctx.fillRect(L.x - 11, L.y - 8, 22, 11);
    ctx.fillStyle = '#c8d6e5'; ctx.font = 'bold 8px monospace'; ctx.fillText('LAPTOP', L.x, L.y + 22);
    for (const id of state.owned) {
      const it = H.BY_ID[id];
      if (id === 'locker') { ctx.fillStyle = '#3a4250'; ctx.fillRect(it.x - 22, it.y - 26, 44, 46); ctx.fillStyle = '#5c6779'; for (let i = 0; i < 3; i++) ctx.fillRect(it.x - 18 + i * 13, it.y - 22, 10, 38); ctx.fillStyle = '#ffd970'; ctx.fillRect(it.x + 14, it.y - 4, 3, 6); }
      if (id === 'tent') {
        ctx.fillStyle = '#1c2a1e'; ctx.fillRect(it.x - 34, it.y - 30, 68, 50); ctx.strokeStyle = '#7fda9b'; ctx.lineWidth = 2; ctx.strokeRect(it.x - 34, it.y - 30, 68, 50);
        ctx.fillStyle = '#fff6c055'; ctx.fillRect(it.x - 30, it.y - 28, 60, 4);
        for (let i = 0; i < H.TENT.max; i++) { const grown = i < state.tent.stock; ctx.fillStyle = grown ? '#5fd16f' : '#2f5a34'; const px = it.x - 25 + (i % 3) * 25, py = it.y - 10 + Math.floor(i / 3) * 18; ctx.beginPath(); ctx.arc(px, py, grown ? 7 : 4, 0, Math.PI * 2); ctx.fill(); }
      }
      if (id === 'scanner') { ctx.fillStyle = '#20252e'; ctx.fillRect(it.x - 14, it.y - 8, 28, 16); ctx.fillStyle = Math.sin(t * 8) > 0 ? '#ff5161' : '#5161ff'; ctx.fillRect(it.x - 10, it.y - 5, 6, 4); ctx.fillStyle = '#9aa'; ctx.fillRect(it.x + 8, it.y - 18, 2, 12); }
      if (id === 'trophies') {
        ctx.fillStyle = '#5a3c22'; ctx.fillRect(it.x - 36, it.y - 6, 72, 8);
        const medals = Object.values(root.NightshiftRaces?.state?.medals || {});
        const cups = ['#ffd970', '#c0c8d0', '#d08a3a'];
        for (let i = 0; i < 3; i++) { ctx.fillStyle = i < medals.length ? cups[['gold', 'silver', 'bronze'].indexOf(medals[i])] || '#ffd970' : '#3b3b3b'; ctx.fillRect(it.x - 28 + i * 22, it.y - 22, 12, 14); ctx.fillRect(it.x - 25 + i * 22, it.y - 8, 6, 3); }
      }
      if (id !== 'bed') { ctx.fillStyle = '#ffffffb0'; ctx.font = 'bold 8px monospace'; ctx.fillText(it.name.toUpperCase(), it.x, it.y + 30); }
    }
    ctx.restore();
  }

  // ---- laptop shop ----
  const css = document.createElement('style');
  css.textContent = `
  #hmPanel{position:fixed;inset:5% 5%;z-index:46;overflow:auto;background:linear-gradient(180deg,#1d1a26f7,#110f17f7);border:1px solid #b9a3ff;border-radius:14px;padding:12px 14px;color:#efeaff;font:13px ui-monospace,Menlo,monospace}
  #hmPanel[hidden]{display:none} #hmPanel h2{margin:0;font-size:16px;color:#cbb8ff;letter-spacing:.06em}
  #hmPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 12px ui-monospace,Menlo,monospace}
  #hmPanel .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px} #hmPanel .x{background:#2c2540;border:1px solid #b9a3ff;padding:6px 10px}
  #hmPanel .sub{color:#b3a9cc;font-size:11px;margin:2px 0 8px} #hmPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
  #hmPanel .it{background:#221d30;border:1px solid #3d3456;border-radius:10px;padding:9px 10px;display:flex;flex-direction:column;gap:5px}
  #hmPanel .it.own{border-color:#7cdeb5} #hmPanel .pk{font-size:11px;color:#cfc6e8} #hmPanel .row{display:flex;justify-content:space-between;align-items:center}
  #hmPanel .buy{padding:7px 12px;background:linear-gradient(#e2d8ff,#9b84f0);color:#1b1230} #hmPanel .buy[disabled]{opacity:.4;pointer-events:none} #hmPanel .ok{color:#7cdeb5;font-weight:700}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const panel = el('div', { id: 'hmPanel', hidden: true, role: 'dialog', ariaLabel: 'Home upgrades' });
  document.body.append(panel);
  function render() {
    if (panel.hidden) return;
    const p = P(), cash = p?.cash ?? 0, dc = mod('charisma.shopPrice'), scroll = panel.scrollTop;
    panel.textContent = '';
    const top = el('div', { className: 'top' });
    const x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = close;
    top.append(el('h2', {}, '💻 HOME UPGRADES'), x);
    panel.append(top, el('div', { className: 'sub' }, `Cash ${money(cash)} · ${state.owned.length}/${H.ITEMS.length} installed · Perks work from your apartment: REST in bed to use them.`));
    const grid = el('div', { className: 'grid' });
    for (const it of H.ITEMS) {
      const own = H.has(state, it.id), price = Math.round(it.price * Math.max(0.5, Math.min(1, dc)));
      const card = el('div', { className: 'it' + (own ? ' own' : '') });
      card.append(el('div', {}, `${it.icon} ${it.name}`), el('div', { className: 'pk' }, it.perk));
      const row = el('div', { className: 'row' });
      if (own) row.append(el('span', { className: 'ok' }, 'INSTALLED'), el('span', {}, it.id === 'tent' ? `${state.tent.stock}/${H.TENT.max} ready` : ''));
      else {
        const b = el('button', { className: 'buy', type: 'button', disabled: cash < price }, `BUY · ${money(price)}`);
        b.onclick = () => {
          const pl = P(); if (!pl) return;
          const r = H.buy(state, pl, it.id, mod('charisma.shopPrice'));
          if (!r.ok) { say(r.reason); return; }
          persist(); gameSave(); say(`${it.icon} ${it.name} installed · -${money(r.price)}`); render();
        };
        row.append(el('span', {}, price < it.price ? `was ${money(it.price)}` : ''), b);
      }
      card.append(row); grid.append(card);
    }
    panel.append(grid);
    panel.scrollTop = scroll;
  }
  function open() { panel.hidden = false; render(); }
  function close() { panel.hidden = true; }
  addEventListener('keydown', (e) => { if (panel.hidden) return; if (e.key === 'Escape') close(); e.stopImmediatePropagation(); }, true);

  root.NightshiftHomeUpgrades = Object.freeze({ open, close, paused: () => !panel.hidden, roomPos: () => (inHome() ? roomPos : null), goalBonus: () => H.goalBonus(state), get state() { return state; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
