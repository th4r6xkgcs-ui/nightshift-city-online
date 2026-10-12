/* Weapons in game (Claude-owned). Requires weapons-data.js. No game file is edited:
 *  - fire rate: sets game.js `nextShot` right after each shot;
 *  - spread/pellets/range/bullet speed: player bullets are shaped as they are pushed (bullets.push patch,
 *    active only during a shot, which is detected via NightshiftFeedback.shot);
 *  - damage per bullet: skill-effects.js reads NightshiftWeapons.current().dmg in its hit hooks;
 *  - magazine size: NightshiftCombat.begin/finish wrapped; extra rounds return to the reserve;
 *  - durability: every trigger pull wears the equipped gun (weapons-data.js wear); crude guns fall apart,
 *    real ones break until repaired at a bench (supply.js). A spare swaps in automatically.
 *  - "carrying a gun": the game only fires while pocket.pistol > 0, so this module keeps that item in sync with
 *    whether you have a working gun (and hides the corner shop's $150 pistol: guns are crafted now).
 *  - gun shop = PARTS COUNTER: parts into your backpack, ammo crates, armor; plus your armory list.
 * Save: nightshift-weapons-v1 (version 2). API: NightshiftWeapons.{current, state, equip, cycle, open, craft, ...} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const W = root.NightshiftWeaponsData;
  const KEY = 'nightshift-weapons-v1';
  let state = W.clean({});
  try { state = W.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  persist();
  // Equipped gun with its mods applied (mag/spread/range/suppressed). See weapons-data.js effective().
  const current = () => (W.BY_ID[state.equipped] ? W.effective(W.BY_ID[state.equipped], state.mods?.[state.equipped] || []) : W.NONE);
  const durMul = () => { try { return root.NightshiftSkills?.mod('crafting.durability') ?? 1; } catch { return 1; } };

  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const B = () => { try { return buildings; } catch { return []; } };
  const G = () => { try { return g; } catch { return null; } };
  const BUL = () => { try { return bullets; } catch { return null; } };
  const CS = () => { try { return combatState; } catch { return null; } };
  const setNextShot = (t) => { try { nextShot = t; } catch { /* game not loaded */ } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { const f = (typeof save === 'function' ? save : null); if (f) f(); } catch { /* not ready */ } };
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const shootingLevel = () => root.NightshiftSkills?.level('shooting') ?? 1;
  const money = (n) => '$' + Math.round(n).toLocaleString();

  // ---- firing ----
  let firing = false, shotAt = 0;
  function shapeBullet(b, angle, w) {
    b.vx = Math.cos(angle) * w.speed; b.vy = Math.sin(angle) * w.speed;
    b.life = w.range / w.speed; b.weapon = w.id;
    return b;
  }
  function patchBullets() {
    const arr = BUL();
    if (!arr || arr.push.__ns) return;
    const orig = Array.prototype.push;
    const push = function (...items) {
      if (firing && items.length === 1 && items[0]?.origin) {
        firing = false; // shape exactly the one player bullet of this trigger pull
        const w = current(), b = items[0], aim = Math.atan2(b.vy, b.vx);
        const angles = W.pelletAngles(aim, w);
        shapeBullet(b, angles[0], w);
        const extra = angles.slice(1).map((a) => shapeBullet({ ...b, origin: { ...b.origin } }, a, w));
        return orig.call(this, b, ...extra);
      }
      return orig.apply(this, items);
    };
    push.__ns = true;
    Object.defineProperty(arr, 'push', { value: push, configurable: true, writable: true });
  }
  function install() {
    patchBullets();
    const F = root.NightshiftFeedback;
    if (F && typeof F.shot === 'function' && !F.__nsWeaponsShot) {
      F.__nsWeaponsShot = true;
      const shot = F.shot;
      F.shot = function () {
        firing = true; shotAt = performance.now();
        const w = current();
        queueMicrotask(() => {
          firing = false; setNextShot(shotAt + w.rate);
          const p = P(); if (w.suppressed && p && Number.isFinite(p.heat)) p.heat = Math.max(0, p.heat - 0.08 * 0.7); // game adds +0.08 per shot
          wearOnce();
        });
        return shot.apply(this, arguments);
      };
      F.shot.__ns = true;
    }
    const C = root.NightshiftCombat;
    if (C && !C.__nsWeapons) {
      const begin = C.begin, finish = C.finish;
      C.begin = function (st, ammo) { if (ammo >= current().mag) return false; return begin.apply(this, arguments); };
      C.finish = function (st) {
        const ammo = finish.apply(this, arguments), mag = current().mag;
        if (ammo > mag && st) { st.reserve = Math.min(C.MAX_RESERVE || 240, st.reserve + (ammo - mag)); return mag; }
        return ammo;
      };
      C.__nsWeapons = true;
    }
    const CR = root.NightshiftCrime;
    if (CR && typeof CR.report === 'function' && !CR.__nsWeaponsReport) {
      CR.__nsWeaponsReport = true;
      const report = CR.report;
      CR.report = function (point, now, kind) { if (kind === 'gunshot' && current().suppressed && Math.random() < 0.8) return false; return report.apply(this, arguments); };
      CR.report.__nsWeapons = true;
    }
    const REC = root.NightshiftRecovery;
    if (REC && typeof REC.damage === 'function' && !REC.__nsArmor) {
      REC.__nsArmor = true;
      const damage = REC.damage;
      // Body armor soaks part of each hit; refunded if the game ignored the hit (safe zone, immunity).
      REC.damage = function (amount, now) {
        const p = P(), a0 = state.armor || 0;
        if (!p || !(a0 > 0) || !Number.isFinite(amount) || amount <= 0) return damage.apply(this, arguments);
        const r = W.absorb(a0, amount), hp0 = p.hp;
        state.armor = r.armor;
        const out = damage.call(this, r.dmg, now);
        if (r.dmg > 0 && p.hp === hp0) state.armor = a0; else { persist(); renderPill(); }
        return out;
      };
      REC.damage.__nsArmor = true;
    }
    const CI = root.NightshiftCitizens;
    if (CI && typeof CI.alert === 'function' && !CI.__nsWeaponsAlert) {
      CI.__nsWeaponsAlert = true;
      const alertFn = CI.alert;
      // A suppressed gunshot is only noticed by people right next to you (70px instead of 260px).
      CI.alert = function (source, now, opts) { if (!opts && current().suppressed && source === P()) return alertFn.call(this, source, now, { kind: 'gunshot', radius: 70 }); return alertFn.apply(this, arguments); };
      CI.alert.__nsWeapons = true;
    }
  }
  install();
  setInterval(install, 1000);
  // On load, fit the loaded magazine to the gun in hand (extra rounds go back to the reserve).
  try { const p = P(), cs = CS(), w = current(); if (p && cs && W.BY_ID[state.equipped] && p.ammo > w.mag) { const r = W.fitMagazine(p.ammo, cs.reserve, w.mag); p.ammo = r.ammo; cs.reserve = r.reserve; } } catch { /* game not loaded */ }
  setInterval(() => { const p = P(); if (p && p.hp <= 0 && state.armor > 0) { state.armor = 0; persist(); renderPill(); } }, 500); // armor is lost when you go down

  // ---- durability ----
  function wearOnce() {
    const r = W.wear(state, durMul());
    if (r.none) return;
    if (r.broke) {
      const w = r.weapon;
      try { root.NightshiftAudio?.play('impact'); } catch { /* optional */ }
      try { const p = P(); root.NightshiftFeedback?.floating(p.x, p.y - 30, r.swapped ? 'FRESH SPARE' : r.destroyed ? 'FELL APART!' : 'GUN BROKE!', '#ffb347'); } catch { /* cosmetic */ }
      say(r.swapped ? `${w.icon} Your ${w.name} wore out · a fresh spare swapped in` : r.destroyed ? `💥 Your ${w.name} fell apart!${r.next ? ' Switched to ' + W.BY_ID[r.next].name : ' Craft another at your home workbench.'}` : `🔧 Your ${w.name} broke. Repair it at your Lockup workbench.${r.next ? ' Switched to ' + W.BY_ID[r.next].name : ''}`);
      syncPocket(); if (r.next) equip(r.next, true);
    } else if (W.BY_ID[state.equipped]?.crude && r.left === 3) say(`⚠️ Your ${W.BY_ID[state.equipped].name} is about to fall apart`);
    persist(); renderPill();
  }
  // The game fires only while pocket.pistol > 0: keep it equal to "you have a working gun".
  function syncPocket() {
    const pocket = root.NightshiftInventory?.state?.pocket;
    if (!pocket) return;
    const armed = !!W.BY_ID[state.equipped] && !state.broken.includes(state.equipped);
    if (armed && !(pocket.pistol > 0)) pocket.pistol = 1;
    else if (!armed && pocket.pistol) delete pocket.pistol;
    else if (armed && pocket.pistol > 1) pocket.pistol = 1;
  }
  setInterval(syncPocket, 250);
  // Guns are crafted now: hide the corner shop's pistol button (recovery.js) wherever it shows up.
  setInterval(() => { for (const b of document.querySelectorAll('button')) if (!b.dataset.nsGun && /^PISTOL · \$/.test(b.textContent.trim())) { b.dataset.nsGun = '1'; b.style.display = 'none'; } }, 700);

  function equip(id, quiet) {
    if (!W.equip(state, id)) return false;
    const p = P(), cs = CS(), w = current();
    if (p && cs) { const r = W.fitMagazine(p.ammo, cs.reserve, w.mag); p.ammo = r.ammo; cs.reserve = r.reserve; }
    persist(); gameSave(); syncPocket(); renderPill(); renderShop();
    if (!quiet) say(`${w.icon} ${w.name} equipped · ${w.mag}-round magazine`);
    return true;
  }
  const cycle = () => { const before = state.equipped; W.cycle(state, 1); const id = state.equipped; state.equipped = before; return id ? equip(id) : false; };

  // ---- HUD: magazine size + weapon pill ----
  const hud = document.querySelector('#hud');
  if (hud) new MutationObserver(() => {
    const mag = current().mag;
    if (mag === 30) return;
    const html = hud.innerHTML;
    if (html.includes('/30 ')) hud.innerHTML = html.replace('/30 ', `/${mag} `);
  }).observe(hud, { childList: true, characterData: true, subtree: true });

  const css = document.createElement('style');
  css.textContent = `
  #wpPill{all:unset;box-sizing:border-box;position:fixed;z-index:25;right:12px;top:64px;cursor:pointer;max-width:46vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    background:#101728d9;border:1px solid #5e7793;border-radius:999px;color:#e8eff7;font:600 12px/1.2 ui-monospace,Menlo,monospace;padding:5px 10px}
  #wpPill small{color:#9fb3c8;font-weight:400} #wpPill .dur{display:inline-block;vertical-align:middle;width:34px;height:5px;margin-left:4px;background:#0b0e12;border-radius:3px;overflow:hidden} #wpPill .dur b{display:block;height:100%}
  #gsPanel{position:fixed;inset:5% 5%;z-index:46;overflow:auto;background:linear-gradient(180deg,#1c2026f7,#0f1216f7);border:1px solid #d08a3a;border-radius:14px;padding:12px 14px;color:#f3ece2;font:13px ui-monospace,Menlo,monospace}
  #gsPanel[hidden]{display:none} #gsPanel h2{margin:0;font-size:16px;color:#ffb347;letter-spacing:.06em}
  #gsPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 12px ui-monospace,Menlo,monospace}
  #gsPanel .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px} #gsPanel .x{background:#3a2a18;border:1px solid #d08a3a;padding:6px 10px}
  #gsPanel .sub{color:#bfae98;font-size:11px;margin:2px 0 8px} #gsPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
  #gsPanel .w{background:#1f252d;border:1px solid #3d4652;border-radius:10px;padding:8px 10px} #gsPanel .w.eq{border-color:#ffb347;box-shadow:0 0 0 1px #ffb34755 inset}
  #gsPanel .w.lock{opacity:.6} #gsPanel .nm{font-weight:700} #gsPanel .d{font-size:11px;color:#bfae98;margin:2px 0 6px}
  #gsPanel .st{display:grid;grid-template-columns:70px 1fr;gap:2px 6px;align-items:center;font-size:10.5px;color:#d6cbbb}
  #gsPanel .st>div{display:flex;align-items:center;gap:6px} #gsPanel .st>div span{min-width:58px;text-align:right}
  #gsPanel .bar{flex:1;height:5px;background:#0b0e12;border-radius:3px;overflow:hidden} #gsPanel .bar i{display:block;height:100%;background:linear-gradient(90deg,#d08a3a,#ffd27a)}
  #gsPanel .act{margin-top:7px;display:flex;justify-content:space-between;align-items:center;gap:6px}
  #gsPanel .buy{padding:7px 12px;background:linear-gradient(#ffd27a,#d08a3a);color:#2a1600} #gsPanel .buy[disabled]{opacity:.4;pointer-events:none}
  #gsPanel .eqb{padding:7px 12px;background:#2c3a4c;border:1px solid #6f8db3;color:#fff} #gsPanel .on{color:#7cdeb5;font-weight:700}
  #gsPanel .mods{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px} #gsPanel .mod{padding:4px 7px;font-size:10.5px;background:#2a3038;border:1px solid #4a5462} #gsPanel .mod.fit{border-color:#7cdeb5;color:#7cdeb5} #gsPanel .mod[disabled]{opacity:.55;pointer-events:none} #gsPanel .mod.fit[disabled]{opacity:1}
  #gsPanel .ammo{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#1f252d;border:1px dashed #6b5a44;border-radius:10px;padding:8px 10px;margin-bottom:8px}
  @media (max-height:430px){#wpPill{top:58px}}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const pill = el('button', { id: 'wpPill', type: 'button', ariaLabel: 'Switch weapon' });
  pill.onclick = () => {
    if (W.usable(state).length > 1) { cycle(); return; }
    if (!state.equipped) { say('✊ No gun. Collect pipe, scrap and a spring at the 🔩 SCRAPYARD, then craft at your home workbench.'); try { root.NightshiftSupply?.gpsTo?.('scrapyard'); } catch { /* optional */ } return; }
    say('Craft more guns at a workbench. Tap again with 2+ guns to switch.');
  };
  document.body.append(pill);
  function renderPill() {
    const w = current();
    pill.textContent = '';
    const n = W.usable(state).length, id = state.equipped;
    pill.append(document.createTextNode(`${w.icon} ${w.suppressed ? "🔇 " : ""}${w.name.toUpperCase()} ${state.armor > 0 ? `🛡️${Math.ceil(state.armor)} ` : ''}`));
    if (W.BY_ID[id]) {
      const mx = W.maxDur(W.BY_ID[id], state.mods[id] || [], durMul()), left = state.cond[id] || 0, f = Math.max(0, Math.min(1, left / mx));
      const bar = el('i', { className: 'dur' }); const fill = el('b'); fill.style.width = Math.round(f * 100) + '%'; fill.style.background = f > 0.5 ? '#7cdeb5' : f > 0.2 ? '#ffd970' : '#ff5a6a'; bar.append(fill); pill.append(bar);
      if (state.spare[id]) pill.append(el('small', {}, ` +${state.spare[id]}`));
    } else pill.append(el('small', {}, 'craft a gun'));
    if (n > 1) pill.append(el('small', {}, ` ⟳ ${n}`));
  }
  function placePill() {
    const m = document.querySelector('#map');
    if (!m) return;
    const r = m.getBoundingClientRect();
    if (r.height && getComputedStyle(m).display !== 'none') { pill.style.top = Math.round(r.bottom + 6) + 'px'; pill.style.right = Math.max(12, Math.round(innerWidth - r.right)) + 'px'; }
  }
  renderPill(); placePill(); setInterval(placePill, 1000);
  addEventListener('keydown', (e) => {
    if (e.key !== 'q' || e.target instanceof HTMLInputElement || !shop.hidden) return;
    if (root.NightshiftCasino?.paused?.()) return;
    cycle();
  });

  // ---- gun shop (world): parts counter + ammo + armor + your armory ----
  let building = null;
  function door() {
    if (!building) {
      const want = { x: 1840, y: 415 };
      building = B().filter((b) => b && b.name === 'CLOTHING').sort((a, b) => Math.hypot(a.x - want.x, a.y - want.y) - Math.hypot(b.x - want.x, b.y - want.y))[0] || { x: 1840, y: 415, w: 240, h: 170 };
    }
    return { x: building.x + building.w / 2, y: building.y + building.h + 12 };
  }
  const SITE = () => ({ id: 'gunshop', type: 'gunshop', ...door(), ready: true, color: '#ffb347', label: 'GUN SHOP', action: 'PARTS', hint: 'Gun shop · gun parts, ammo, armor' });
  const E = root.NightshiftEncounters;
  if (E && !E.__guns) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 ? [...list, SITE()] : list; };
    E.use = function (id) { if (id === 'gunshop') { open(); return true; } return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawSign(); } catch { /* cosmetic */ } return r; };
    E.__guns = true;
  }
  function drawSign() {
    const ctx = G(), d = door();
    if (!ctx || !building) return;
    const x = d.x - 82, y = d.y - 6;
    ctx.save();
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(x - 2, y + 9, 4, 12);
    root.NightshiftSign?.(ctx, x, y - 1, '🔫', 'GUN SHOP · PARTS', '#ffb347');
    ctx.fillStyle = '#5a4630'; ctx.fillRect(d.x - 14, d.y - 16, 28, 14);
    ctx.restore();
  }

  const shop = el('div', { id: 'gsPanel', hidden: true, role: 'dialog', ariaLabel: 'Gun shop' });
  document.body.append(shop);
  const condText = (id) => { const w = W.BY_ID[id], mx = W.maxDur(w, state.mods[id] || [], durMul()); return state.broken.includes(id) ? 'BROKEN' : `${state.cond[id] || 0}/${mx} shots`; };
  function armoryCard(id, { compact } = {}) {
    const w = current().id === id ? current() : W.effective(W.BY_ID[id], state.mods[id] || []), eq = state.equipped === id, broken = state.broken.includes(id);
    const card = el('div', { className: 'w' + (eq ? ' eq' : '') + (broken ? ' lock' : '') });
    const icon = root.NightshiftSupply?.gunIcon?.(id, 72, 30);
    const nm = el('div', { className: 'nm' }); if (icon) nm.append(icon); nm.append(document.createTextNode(` ${w.name}`)); card.append(nm);
    const mx = W.maxDur(W.BY_ID[id], state.mods[id] || [], durMul()), f = broken ? 0 : Math.min(1, (state.cond[id] || 0) / mx);
    const bar = el('div', { className: 'bar' }), i = el('i'); i.style.width = Math.max(3, Math.round(f * 100)) + '%'; i.style.background = f > 0.5 ? '#7cdeb5' : f > 0.2 ? '#ffd970' : '#ff5a6a'; bar.append(i);
    const row = el('div', { className: 'st' }); row.append(el('span', {}, 'Condition'), el('div')); row.lastChild.append(bar, el('span', {}, condText(id))); card.append(row);
    if (!compact) card.append(el('div', { className: 'd' }, `${w.pellets > 1 ? w.pellets + '×' + w.dmg : w.dmg} dmg · ${w.mag}-rd mag · ${Math.round(60000 / w.rate)} rpm · ${(state.mods[id] || []).map((m) => W.MOD[m].icon).join(' ') || 'no mods'}${state.spare[id] ? ` · ${state.spare[id]} spare` : ''}`));
    const act = el('div', { className: 'act' });
    if (eq) act.append(el('span', { className: 'on' }, 'IN HAND'));
    else if (broken) act.append(el('span', {}, W.BY_ID[id].tier ? 'Repair at your Lockup' : ''));
    else { const b = el('button', { className: 'eqb', type: 'button' }, 'EQUIP'); b.onclick = () => { equip(id); renderShop(); root.NightshiftSupply?.refresh?.(); }; act.append(el('span'), b); }
    card.append(act);
    return card;
  }
  function renderShop() {
    if (shop.hidden) return;
    const p = P(), cash = p?.cash ?? 0, scroll = shop.scrollTop, SUP = root.NightshiftSupply, SD = root.NightshiftSupplyData;
    shop.textContent = '';
    const top = el('div', { className: 'top' });
    const x = el('button', { className: 'x', type: 'button' }, 'LEAVE'); x.onclick = close;
    top.append(el('h2', {}, '⌖ GUN SHOP · PARTS COUNTER'), x);
    shop.append(top, el('div', { className: 'sub' }, `Cash ${money(cash)}${SUP ? ` · Backpack ${SUP.space()}` : ''} · No guns over the counter: buy parts here, craft guns at a workbench (crude guns at home, real guns at your Lockup).`));
    if (SUP && SD) {
      const grid = el('div', { className: 'parts' });
      for (const id of SD.PARTS_COUNTER) {
        const m = SD.MATERIALS[id], row = el('div', { className: 'part' });
        const ic = SUP.matIcon?.(id, 28); if (ic) row.append(ic);
        row.append(el('div', { className: 'pn' }, `${m.name}`), el('div', { className: 'pc' }, `${money(m.price)} · have ${SUP.count(id)}`));
        for (const n of [1, 5]) {
          const b = el('button', { className: 'buy', type: 'button', disabled: cash < m.price * n }, `+${n}`);
          b.onclick = () => { const r = SUP.buy(id, n, 'parts'); say(r.ok ? `${m.icon} Bought ${n} ${m.name} · -${money(r.cost)}` : r.reason); renderShop(); };
          row.append(b);
        }
        grid.append(row);
      }
      shop.append(el('h3', {}, 'PARTS'), grid);
    }
    const cs = CS(), crate = W.AMMO_CRATE;
    const ammo = el('div', { className: 'ammo' });
    const ab = el('button', { className: 'buy', type: 'button', disabled: cash < crate.price || !cs || cs.reserve >= 240 }, `BUY ${crate.rounds} ROUNDS · ${money(crate.price)}`);
    ab.onclick = () => {
      const c = CS(), pl = P();
      if (!c || !pl || pl.cash < crate.price || c.reserve >= 240) return;
      const add = Math.min(crate.rounds, 240 - c.reserve), cost = Math.ceil(crate.price * add / crate.rounds);
      pl.cash -= cost; c.reserve += add; gameSave(); say(`Bought ${add} rounds · -${money(cost)}`); renderShop();
    };
    ammo.append(el('span', {}, `📦 Ammo crate · spare ${cs?.reserve ?? 0}/240`), ab);
    shop.append(ammo);
    const armorRow = el('div', { className: 'ammo' });
    armorRow.append(el('span', {}, `🛡️ Body armor ${Math.ceil(state.armor || 0)}/100 · soaks ${Math.round(W.ABSORB * 100)}% of each hit`));
    for (const v of W.ARMOR) {
      const b = el('button', { className: 'buy', type: 'button', disabled: cash < v.price || (state.armor || 0) >= v.points }, `${v.icon} ${v.points} · ${money(v.price)}`);
      b.onclick = () => { const pl = P(); if (!pl || pl.cash < v.price || (state.armor || 0) >= v.points) return; pl.cash -= v.price; state.armor = v.points; persist(); gameSave(); renderPill(); say(`${v.icon} ${v.name} on · armor ${v.points}`); renderShop(); };
      armorRow.append(b);
    }
    shop.append(armorRow);
    shop.append(el('h3', {}, 'YOUR ARMORY'));
    if (!state.owned.length) shop.append(el('div', { className: 'sub' }, 'No guns yet. Your first one: a Pipe Pistol from the scrapyard\'s junk, crafted at your home workbench.'));
    const grid = el('div', { className: 'grid' });
    for (const w of W.WEAPONS) if (state.owned.includes(w.id)) grid.append(armoryCard(w.id));
    shop.append(grid);
    shop.scrollTop = scroll;
  }
  function open() {
    const p = P();
    if (!p || p.hp <= 0) return false;
    try { root.releaseControls?.(); } catch { /* n/a */ }
    shop.hidden = false; renderShop(); return true;
  }
  function close() { shop.hidden = true; }
  addEventListener('keydown', (e) => { if (shop.hidden) return; if (e.key === 'Escape') close(); e.stopImmediatePropagation(); }, true);
  const css2 = document.createElement('style');
  css2.textContent = `#gsPanel h3{margin:10px 0 6px;font:700 12px var(--disp,ui-monospace);letter-spacing:.12em;color:#ffb347}
  #gsPanel .parts{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px;margin-bottom:8px}
  #gsPanel .part{display:flex;align-items:center;gap:8px;background:#1f252d;border:1px solid #3d4652;border-radius:10px;padding:6px 8px}
  #gsPanel .part canvas{flex:none;image-rendering:pixelated} #gsPanel .pn{flex:1;font-weight:700;font-size:12px} #gsPanel .pc{font-size:10.5px;color:#bfae98;margin-right:4px}
  #gsPanel .part .buy{padding:6px 9px} #gsPanel .nm canvas{vertical-align:middle;image-rendering:pixelated}`;
  document.head.appendChild(css2);

  // ---- crafting API (used by supply.js benches) ----
  const after = () => { persist(); gameSave(); syncPocket(); renderPill(); renderShop(); };
  function craft(id, ctx) { const r = W.craft(state, id, { ...ctx, durMul: durMul() }); if (r.ok) { if (state.equipped === id) equip(id, true); after(); } return r; }
  function craftMod(id, modId, ctx) { const r = W.craftMod(state, id, modId, ctx); if (r.ok) { if (state.equipped === id) equip(id, true); after(); } return r; }
  function repair(id, ctx) { const r = W.repair(state, id, { ...ctx, durMul: durMul() }); if (r.ok) { if (state.equipped === id) equip(id, true); after(); } return r; }
  function sell(id, kind, price) { const p = P(); if (!p) return { ok: false, reason: 'Not ready' }; const r = W.sell(state, p, id, kind, price, durMul()); if (r.ok) after(); return r; }
  root.NightshiftWeapons = Object.freeze({ current, equip, cycle, open, close, door, craft, craftMod, repair, sell, armoryCard, condText, durMul, syncPocket,
    paused: () => !shop.hidden, armed: () => !!W.BY_ID[state.equipped], get state() { return state; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
