/* Food in game (Claude-owned). Requires food-data.js + supply.js. No game file is edited:
 *  - cooking: the apartment KITCHEN (USE via a NightshiftHome.interaction/use wrap) and the farmhouse kitchen in the
 *    countryside (farm.js calls NightshiftFood.openKitchen('farm')); a timed cook with a progress bar; ingredients come
 *    from your backpack (+ home locker when cooking at home);
 *  - eating: from the kitchen panel or the 🎒 backpack; buffs apply through NightshiftSkills.addModifier /
 *    xpMultiplier, regen ticks here, a heal is instant; active buffs show as chips under the status card;
 *  - selling: the Diner's back door in the city buys meals (limited demand).
 * Save: nightshift-food-v1 (also holds farm plots + animals). API: NightshiftFood.{state, eat, openKitchen, save} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const F = root.NightshiftFoodData, S = root.NightshiftSupplyData;
  if (!F || !S) return;
  const KEY = 'nightshift-food-v1';
  let state = F.clean({});
  try { state = F.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const SUP = () => root.NightshiftSupply;
  const home = () => root.NightshiftHome?.kind?.() === 'home';
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };

  // ---- buffs ----
  const hookSkills = () => { const SK = root.NightshiftSkills; if (!SK?.addModifier || SK.__food) return !!SK?.__food; SK.addModifier((k) => F.modMul(state, k)); SK.xpMultiplier(() => F.xpMul(state)); try { Object.defineProperty(SK, '__food', { value: true }); } catch { /* frozen: mark below */ } return true; };
  let hooked = false; const hk = setInterval(() => { if (!hooked) hooked = hookSkills() || hooked; if (hooked) clearInterval(hk); }, 300);
  setInterval(() => {
    const p = P(), r = F.regen(state);
    if (p && r > 0 && p.hp > 0 && p.hp < 100) p.hp = Math.min(100, p.hp + r);
    renderBuffs();
  }, 1000);
  function eat(id) {
    const r = F.RECIPE[id], su = SUP();
    if (!r || !su) return { ok: false, reason: 'Not food' };
    if (!su.take({ [id]: 1 })) { if (!(home() && (su.state.locker[id] > 0))) return { ok: false, reason: 'You have none' }; su.state.locker[id] -= 1; if (!su.state.locker[id]) delete su.state.locker[id]; su.save(); }
    const e = F.eat(state, id);
    const p = P(); if (p && e.heal) p.hp = Math.min(100, p.hp + e.heal);
    persist(); gameSave();
    try { root.NightshiftAudio?.play('pickup'); root.NightshiftFeedback?.floating?.(p.x, p.y - 30, `${e.buff.icon} ${e.buff.name}`, '#ffd970'); } catch { /* cosmetic */ }
    say(`${S.MATERIALS[id].icon} Ate ${S.MATERIALS[id].name} · ${e.buff.icon} ${e.buff.desc} for ${r.minutes} min${e.heal ? ` · +${e.heal} HP` : ''}`);
    renderBuffs(); renderKitchen(); su.refresh?.();
    return { ok: true };
  }
  const buffEl = document.createElement('div'); buffEl.id = 'fdBuffs';
  function placeBuffs() { const L = document.querySelector('#nsL'); if (L && buffEl.parentNode !== L) { const st = document.querySelector('#nsStatus'); if (st?.nextSibling) L.insertBefore(buffEl, st.nextSibling); else L.append(buffEl); } else if (!L && !buffEl.parentNode) document.body.append(buffEl); }
  function renderBuffs() {
    placeBuffs();
    const act = F.active(state), now = Date.now(), ids = Object.keys(act);
    buffEl.hidden = !ids.length; if (!ids.length) return;
    const key = ids.map((id) => id + Math.ceil((act[id] - now) / 60000)).join('|');
    if (buffEl.dataset.k === key) return; buffEl.dataset.k = key; buffEl.textContent = '';
    for (const id of ids) { const b = F.BUFFS[id], c = document.createElement('span'); c.className = 'bf'; c.title = `${b.name}: ${b.desc}`; c.textContent = `${b.icon} ${Math.ceil((act[id] - now) / 60000)}m`; buffEl.append(c); }
  }

  // ---- kitchen panel ----
  const css = document.createElement('style');
  css.textContent = `
  #fdBuffs{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 0;pointer-events:auto} #fdBuffs[hidden]{display:none}
  #fdBuffs .bf{font:700 11px var(--disp,system-ui);color:#ffe9a8;background:#0d1320d9;border:1px solid #ffd97066;border-radius:999px;padding:3px 8px;box-shadow:0 4px 12px #0007}
  #fdPanel .mealrow{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:12px;background:#ffffff07;border:1px solid #ffffff12;margin-bottom:5px}
  #fdPanel .mealrow .pi{font-size:22px;width:30px;text-align:center} #fdPanel .mealrow .t{flex:1} #fdPanel .mealrow b{font:700 13px var(--disp,system-ui)} #fdPanel .mealrow span{display:block;color:#a9b8ca;font-size:11px}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const panel = el('div', { id: 'fdPanel', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Kitchen' });
  document.body.append(panel);
  let where = 'home', cooking = null;
  const pool = () => { const su = SUP()?.state; if (!su) return {}; return where === 'home' ? S.combined(su) : su.bag; };
  function spend(cost) { const su = SUP(); if (!su) return false; if (where === 'home') { const ok = S.spendBoth(su.state, cost); if (ok) su.save(); return ok; } return su.take(cost); }
  function openKitchen(w) { where = w || (home() ? 'home' : 'farm'); try { root.releaseControls?.(); } catch { /* n/a */ } for (const id of ['spBag', 'spBench', 'spShop']) { const e = document.getElementById(id); if (e) e.hidden = true; } panel.hidden = false; renderKitchen(); }
  function close() { panel.hidden = true; cooking = null; }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { close(); e.stopImmediatePropagation(); } }, true);
  const chip = (id, need, have) => { const c = el('span', { className: 'chip ' + (have >= need ? 'ok' : 'no') }); const ic = SUP()?.matIcon?.(id, 16); if (ic) c.append(ic); else c.append(document.createTextNode(S.MATERIALS[id]?.icon || '')); c.append(document.createTextNode(`${Math.min(have, need)}/${need}`)); c.title = S.MATERIALS[id]?.name || id; return c; };
  function renderKitchen() {
    if (panel.hidden) return;
    const scroll = panel.scrollTop, have = pool(), lvl = root.NightshiftSkills?.level?.('farming') ?? 1;
    panel.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = close;
    top.append(el('h2', {}, where === 'home' ? '🍳 YOUR KITCHEN' : '🍳 FARMHOUSE KITCHEN'), x); panel.append(top);
    panel.append(el('div', { className: 'sub' }, 'Cook farm produce into meals. Eat them for buffs, or sell them at the 🍽️ Diner back door in the city for much more than raw produce.' + (where === 'home' ? ' Uses your bag and home locker.' : ' Uses your bag.')));
    if (cooking) { const pg = el('div', { className: 'prog' }, `🍳 Cooking ${S.MATERIALS[cooking.id].name}…`); const c = el('div', { className: 'cap' }); const i = el('i'); i.style.width = Math.round(Math.min(1, (performance.now() - cooking.t0) / cooking.ms) * 100) + '%'; c.append(i); pg.append(c); panel.append(pg); }
    // lunchbox: meals you carry
    const meals = F.RECIPES.filter((r) => (have[r.id] || 0) > 0);
    panel.append(el('h3', {}, 'LUNCHBOX · eat for a buff'));
    if (!meals.length) panel.append(el('div', { className: 'sub' }, 'No meals yet. Cook one below.'));
    for (const r of meals) {
      const b = F.BUFFS[r.buff], row = el('div', { className: 'mealrow' }); row.append(el('div', { className: 'pi' }, S.MATERIALS[r.id].icon));
      const t = el('div', { className: 't' }); t.append(el('b', {}, `${S.MATERIALS[r.id].name} ×${have[r.id]}`), el('span', {}, `${b.icon} ${b.desc} · ${r.minutes} min${r.heal ? ` · +${r.heal} HP` : ''} · Diner pays ${money(r.sell)}`)); row.append(t);
      const eb = el('button', { className: 'go', type: 'button' }, 'EAT'); eb.onclick = () => eat(r.id); row.append(eb); panel.append(row);
    }
    panel.append(el('h3', {}, 'RECIPES'));
    const cards = el('div', { className: 'cards' });
    for (const r of F.RECIPES) {
      const b = F.BUFFS[r.buff], m = S.MATERIALS[r.id], lock = lvl < r.level, ok = F.canCook(have, r.id);
      const card = el('div', { className: 'card' + (lock ? ' lock' : ok ? ' ready' : '') });
      const hd = el('div', { className: 'hd' }); hd.append(el('div', { className: 'pi', style: 'font-size:28px' }, m.icon)); const nm = el('div'); nm.append(el('div', { className: 'nm' }, `${m.name}${r.out > 1 ? ` ×${r.out}` : ''}`), el('div', { className: 'tg' }, `${b.icon} ${b.desc.toUpperCase()} · ${r.minutes} MIN`)); hd.append(nm); card.append(hd);
      const need = el('div', { className: 'need' }); for (const [k, n] of Object.entries(r.in)) need.append(chip(k, n, have[k] || 0)); card.append(need);
      const row = el('div', { className: 'row' }); const why = lock ? `Needs Farming level ${r.level}` : !ok ? 'Missing ingredients' : '';
      row.append(el('span', { className: why ? 'why' : 'okc' }, why || `${r.seconds}s · Diner pays ${money(r.sell)} each`));
      const cb = el('button', { className: 'go', type: 'button', disabled: !!why || !!cooking }, 'COOK'); cb.onclick = () => cook(r.id); row.append(cb);
      card.append(row); cards.append(card);
    }
    panel.append(cards);
    panel.scrollTop = scroll;
  }
  function cook(id) {
    const r = F.RECIPE[id];
    if (!r || cooking || !F.canCook(pool(), id)) return;
    cooking = { id, t0: performance.now(), ms: r.seconds * 1000 * mod('crafting.speed') };
    const tick = setInterval(() => {
      if (!cooking || cooking.id !== id || panel.hidden) { clearInterval(tick); if (cooking?.id === id) { cooking = null; say('🍳 Cooking cancelled'); } return; }
      const bar = panel.querySelector('.prog i'); if (bar) bar.style.width = Math.round(Math.min(1, (performance.now() - cooking.t0) / cooking.ms) * 100) + '%';
      if (performance.now() - cooking.t0 < cooking.ms) return;
      clearInterval(tick); cooking = null;
      if (!spend(r.in)) { say('Missing ingredients'); renderKitchen(); return; }
      const got = SUP().give({ [id]: r.out });
      if (!got.added[id]) { // bag full: at home it goes to the locker
        const su = SUP().state; if (where === 'home') { su.locker[id] = (su.locker[id] || 0) + r.out; SUP().save(); } else say('🎒 Bag full · meal dropped');
      }
      state.cooked += r.out; persist(); gameSave();
      try { root.NightshiftSkills?.gain('farming', 12 + r.seconds * 2, 'cook'); root.NightshiftAudio?.play('pickup'); } catch { /* optional */ }
      say(`${S.MATERIALS[id].icon} Cooked ${r.out > 1 ? r.out + '× ' : ''}${S.MATERIALS[id].name}`);
      renderKitchen();
    }, 100);
    renderKitchen();
  }

  // ---- apartment kitchen (USE near the counter) ----
  const KITCHEN = { x: 470, y: 128 };
  let roomPos = null;
  function installHome() {
    const HM = root.NightshiftHome, SP = root.NightshiftSprites;
    if (SP && !SP.__foodPos && typeof SP.person === 'function') { const person = SP.person; SP.person = function (pos, isPlayer, opts) { if (opts && opts.weapon === false && isPlayer) roomPos = pos; return person.apply(this, arguments); }; SP.__foodPos = true; }
    if (HM && !HM.__food && typeof HM.interaction === 'function' && typeof HM.use === 'function') {
      const interaction = HM.interaction, use = HM.use;
      HM.interaction = function () {
        const t = interaction.apply(this, arguments);
        if (!roomPos || !home()) return t;
        const d = Math.hypot(roomPos.x - KITCHEN.x, roomPos.y - KITCHEN.y);
        if (d < 70 && (!t || !Number.isFinite(t.x) || d < Math.hypot(roomPos.x - t.x, roomPos.y - t.y))) return { kind: 'kitchen', action: 'COOK', label: 'Kitchen · cook meals', x: KITCHEN.x, y: KITCHEN.y };
        return t;
      };
      HM.use = function () { const t = home() ? HM.interaction() : null; if (t?.kind === 'kitchen') { openKitchen('home'); return true; } return use.apply(this, arguments); };
      HM.__food = true;
    }
  }
  installHome();
  const ih = setInterval(() => { installHome(); if (root.NightshiftHome?.__food && root.NightshiftSprites?.__foodPos) clearInterval(ih); }, 800);

  // ---- the Diner's back door (city) ----
  const DINER = { id: 'fd-diner', x: 1600, y: 948 };
  const shop = el('div', { id: 'fdDiner', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Diner' });
  document.body.append(shop);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !shop.hidden) { shop.hidden = true; e.stopImmediatePropagation(); } }, true);
  function openDiner() {
    try { root.releaseControls?.(); } catch { /* n/a */ }
    shop.hidden = false; shop.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { shop.hidden = true; };
    const left = F.dinerLeft(state);
    top.append(el('h2', {}, '🍽️ DINER · BACK DOOR'), x); shop.append(top, el('div', { className: 'sub' }, `"Home cooking? We'll take it." The cook buys ${left} more meal${left === 1 ? '' : 's'} right now. Charisma raises the price.`));
    const su = SUP()?.state, bag = su?.bag || {};
    const rows = F.RECIPES.filter((r) => bag[r.id] > 0);
    if (!rows.length) shop.append(el('div', { className: 'sub' }, 'Nothing to sell. Cook meals from farm produce (countryside) at your apartment kitchen.'));
    for (const r of rows) {
      const m = S.MATERIALS[r.id], row = el('div', { className: 'mealrow' }); row.append(el('div', { className: 'pi' }, m.icon));
      const t = el('div', { className: 't' }); t.append(el('b', {}, `${m.name} ×${bag[r.id]}`), el('span', {}, `${money(r.sell * mod('charisma.jobPay'))} each`)); row.append(t);
      for (const n of [1, 99]) { const b = el('button', { className: n === 1 ? 'alt' : 'go', type: 'button', disabled: left <= 0 }, n === 1 ? 'SELL 1' : 'SELL ALL'); b.onclick = () => { const p = P(); const res = F.sellMeal(state, r.id, bag, p, n, { price: mod('charisma.jobPay') }); if (res.ok) { SUP().save(); persist(); gameSave(); try { root.NightshiftSkills?.gain('charisma', 6 * res.n, 'diner'); } catch { /* optional */ } } say(res.ok ? `🍽️ Sold ${res.n} · +${money(res.cash)}` : res.reason); openDiner(); }; row.append(b); }
      shop.append(row);
    }
    shop.querySelectorAll('.mealrow').forEach((r) => { r.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:12px;background:#ffffff07;border:1px solid #ffffff12;margin-bottom:5px'; });
  }
  const E = root.NightshiftEncounters;
  if (E && !E.__food) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 ? [...list, { id: DINER.id, type: 'diner', x: DINER.x, y: DINER.y, ready: true, color: '#ffb36b', label: '🍽️ DINER', action: 'MEALS', hint: 'Diner back door · sells cooked meals' }] : list; };
    E.use = function (id) { if (id === DINER.id) { openDiner(); return true; } return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawDiner(); } catch { /* cosmetic */ } return r; };
    E.__food = true;
  }
  function drawDiner() {
    const ctx = G(), p = P(); if (!ctx || !p || Math.abs(p.x - DINER.x) > 700 || Math.abs(p.y - DINER.y) > 500) return;
    const { x, y } = DINER;
    ctx.save();
    ctx.fillStyle = '#05080f55'; ctx.fillRect(x - 18, y - 22, 40, 22);
    ctx.fillStyle = '#5a6670'; ctx.fillRect(x - 20, y - 26, 16, 20); ctx.fillStyle = '#3a454e'; ctx.fillRect(x - 20, y - 26, 16, 3); // bins
    ctx.fillStyle = '#2f6b3f'; ctx.fillRect(x - 2, y - 26, 16, 20); ctx.fillStyle = '#255632'; ctx.fillRect(x - 2, y - 26, 16, 3);
    ctx.fillStyle = '#c9b58a'; for (let k = 0; k < 3; k++) ctx.fillRect(x + 18, y - 22 + k * 5, 10, 4); // crates of produce
    ctx.fillStyle = '#e0473a'; ctx.fillRect(x + 19, y - 22, 3, 2); ctx.fillStyle = '#f2d24a'; ctx.fillRect(x + 23, y - 17, 3, 2);
    for (let k = 0; k < 3; k++) { const ph = (performance.now() / 1400 + k / 3) % 1; ctx.globalAlpha = 0.35 * (1 - ph); ctx.fillStyle = '#e8eef2'; ctx.beginPath(); ctx.arc(x + 6 + Math.sin(ph * 6 + k) * 3, y - 34 - ph * 22, 3 + ph * 5, 0, Math.PI * 2); ctx.fill(); } // kitchen steam
    ctx.restore();
    root.NightshiftSign?.(ctx, x, y - 46, '🍽️', 'DINER · BUYS MEALS', '#ffb36b');
  }

  root.NightshiftFood = Object.freeze({ get state() { return state; }, save: () => { persist(); gameSave(); }, eat, openKitchen, openDiner, renderBuffs, DINER, KITCHEN,
    paused: () => !panel.hidden || !shop.hidden });
})(typeof globalThis !== 'undefined' ? globalThis : this);
