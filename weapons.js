/* Weapons in game (Claude-owned). Requires weapons-data.js. No game file is edited:
 *  - fire rate: sets game.js `nextShot` right after each shot;
 *  - spread/pellets/range/bullet speed: player bullets are shaped as they are pushed (bullets.push patch,
 *    active only during a shot, which is detected via NightshiftFeedback.shot);
 *  - damage per bullet: skill-effects.js reads NightshiftWeapons.current().dmg in its hit hooks;
 *  - magazine size: NightshiftCombat.begin/finish wrapped; extra rounds return to the reserve;
 *  - gun shop: a USE point via NightshiftEncounters (like the casino), plus bulk ammo;
 *  - HUD: the game's "/30" magazine text shows the equipped magazine; a weapon pill switches guns (Q key).
 * You still need a gun in hand (the game's carried pistol item) to shoot; owned guns stay in your armory.
 * Save: nightshift-weapons-v1. API: NightshiftWeapons.{current, state, equip, cycle, open, shop} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const W = root.NightshiftWeaponsData;
  const KEY = 'nightshift-weapons-v1';
  let state = W.clean({});
  try { state = W.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  const current = () => W.BY_ID[state.equipped] || W.BY_ID.pistol;

  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const B = () => { try { return buildings; } catch { return []; } };
  const G = () => { try { return g; } catch { return null; } };
  const BUL = () => { try { return bullets; } catch { return null; } };
  const CS = () => { try { return combatState; } catch { return null; } };
  const setNextShot = (t) => { try { nextShot = t; } catch { /* game not loaded */ } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { const f = Function('return typeof save==="function"?save:null')(); if (f) f(); } catch { /* not ready */ } };
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
    if (F && typeof F.shot === 'function' && !F.shot.__ns) {
      const shot = F.shot;
      F.shot = function () {
        firing = true; shotAt = performance.now();
        const w = current();
        queueMicrotask(() => { firing = false; setNextShot(shotAt + w.rate); });
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
  }
  install();
  setInterval(install, 1000);

  function equip(id, quiet) {
    if (!W.equip(state, id)) return false;
    const p = P(), cs = CS(), w = current();
    if (p && cs) { const r = W.fitMagazine(p.ammo, cs.reserve, w.mag); p.ammo = r.ammo; cs.reserve = r.reserve; }
    persist(); gameSave(); renderPill(); renderShop();
    if (!quiet) say(`${w.icon} ${w.name} equipped · ${w.mag}-round magazine`);
    return true;
  }
  const cycle = () => { const before = state.equipped; W.cycle(state, 1); const id = state.equipped; state.equipped = before; return equip(id); };

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
  #wpPill small{color:#9fb3c8;font-weight:400}
  #gsPanel{position:fixed;inset:5% 5%;z-index:46;overflow:auto;background:linear-gradient(180deg,#1c2026f7,#0f1216f7);border:1px solid #d08a3a;border-radius:14px;padding:12px 14px;color:#f3ece2;font:13px ui-monospace,Menlo,monospace}
  #gsPanel[hidden]{display:none} #gsPanel h2{margin:0;font-size:16px;color:#ffb347;letter-spacing:.06em}
  #gsPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 12px ui-monospace,Menlo,monospace}
  #gsPanel .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px} #gsPanel .x{background:#3a2a18;border:1px solid #d08a3a;padding:6px 10px}
  #gsPanel .sub{color:#bfae98;font-size:11px;margin:2px 0 8px} #gsPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
  #gsPanel .w{background:#1f252d;border:1px solid #3d4652;border-radius:10px;padding:8px 10px} #gsPanel .w.eq{border-color:#ffb347;box-shadow:0 0 0 1px #ffb34755 inset}
  #gsPanel .w.lock{opacity:.6} #gsPanel .nm{font-weight:700} #gsPanel .d{font-size:11px;color:#bfae98;margin:2px 0 6px}
  #gsPanel .st{display:grid;grid-template-columns:70px 1fr;gap:2px 6px;align-items:center;font-size:10.5px;color:#d6cbbb}
  #gsPanel .bar{height:5px;background:#0b0e12;border-radius:3px;overflow:hidden} #gsPanel .bar i{display:block;height:100%;background:linear-gradient(90deg,#d08a3a,#ffd27a)}
  #gsPanel .act{margin-top:7px;display:flex;justify-content:space-between;align-items:center;gap:6px}
  #gsPanel .buy{padding:7px 12px;background:linear-gradient(#ffd27a,#d08a3a);color:#2a1600} #gsPanel .buy[disabled]{opacity:.4;pointer-events:none}
  #gsPanel .eqb{padding:7px 12px;background:#2c3a4c;border:1px solid #6f8db3;color:#fff} #gsPanel .on{color:#7cdeb5;font-weight:700}
  #gsPanel .ammo{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#1f252d;border:1px dashed #6b5a44;border-radius:10px;padding:8px 10px;margin-bottom:8px}
  @media (max-height:430px){#wpPill{top:58px}}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const pill = el('button', { id: 'wpPill', type: 'button', ariaLabel: 'Switch weapon' });
  pill.onclick = () => { if (state.owned.length > 1) cycle(); else say('Buy more guns at the GUN SHOP (north-east)'); };
  document.body.append(pill);
  function renderPill() {
    const w = current();
    pill.textContent = '';
    pill.append(document.createTextNode(`${w.icon} ${w.name.toUpperCase()} `), el('small', {}, state.owned.length > 1 ? `⟳ ${state.owned.length}` : ''));
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

  // ---- gun shop (world) ----
  let building = null;
  function door() {
    if (!building) {
      const want = { x: 1840, y: 415 };
      building = B().filter((b) => b && b.name === 'CLOTHING').sort((a, b) => Math.hypot(a.x - want.x, a.y - want.y) - Math.hypot(b.x - want.x, b.y - want.y))[0] || { x: 1840, y: 415, w: 240, h: 170 };
    }
    return { x: building.x + building.w / 2, y: building.y + building.h + 12 };
  }
  const SITE = () => ({ id: 'gunshop', type: 'gunshop', ...door(), ready: true, color: '#ffb347', label: 'GUN SHOP', action: 'GUNS', hint: 'Gun shop · weapons & bulk ammo' });
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
    ctx.fillStyle = '#15110ce8'; ctx.fillRect(x - 36, y - 11, 72, 20);
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2; ctx.strokeRect(x - 36, y - 11, 72, 20);
    ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⌖ GUN SHOP', x, y - 1);
    ctx.fillStyle = '#5a4630'; ctx.fillRect(d.x - 14, d.y - 16, 28, 14);
    ctx.restore();
  }

  const shop = el('div', { id: 'gsPanel', hidden: true, role: 'dialog', ariaLabel: 'Gun shop' });
  document.body.append(shop);
  const MAXES = { dmg: Math.max(...W.WEAPONS.map((w) => w.dmg * w.pellets)), dps: Math.max(...W.WEAPONS.map(W.dps)), range: Math.max(...W.WEAPONS.map((w) => w.range)) };
  function statRow(card, label, v, max, text) {
    const bar = el('div', { className: 'bar' }); const i = el('i'); i.style.width = Math.max(4, Math.round(Math.min(1, v / max) * 100)) + '%'; bar.append(i);
    card.append(el('span', {}, label), el('div', {}, ''));
    card.lastChild.append(bar, el('span', {}, text));
  }
  function renderShop() {
    if (shop.hidden) return;
    const p = P(), cash = p?.cash ?? 0, lv = shootingLevel(), scroll = shop.scrollTop;
    shop.textContent = '';
    const top = el('div', { className: 'top' });
    const x = el('button', { className: 'x', type: 'button' }, 'LEAVE'); x.onclick = close;
    top.append(el('h2', {}, '⌖ GUN SHOP'), x);
    shop.append(top, el('div', { className: 'sub' }, `Cash ${money(cash)} · Shooting Lv ${lv} · Guns you buy stay in your armory. You still need a gun in hand: if you die and drop it, recover your bag or buy one at the corner shop.`));
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
    const grid = el('div', { className: 'grid' });
    for (const w of W.WEAPONS) {
      const owned = state.owned.includes(w.id), eq = state.equipped === w.id, locked = lv < w.level;
      const card = el('div', { className: 'w' + (eq ? ' eq' : '') + (locked && !owned ? ' lock' : '') });
      card.append(el('div', { className: 'nm' }, `${w.icon} ${w.name}`), el('div', { className: 'd' }, w.desc));
      const st = el('div', { className: 'st' });
      statRow(st, 'Damage', w.dmg * w.pellets, MAXES.dmg, ` ${w.pellets > 1 ? `${w.pellets}×${w.dmg}` : w.dmg}`);
      statRow(st, 'Firepower', W.dps(w), MAXES.dps, ` ${Math.round(W.dps(w))}/s`);
      statRow(st, 'Range', w.range, MAXES.range, ` ${w.range}px`);
      st.append(el('span', {}, 'Magazine'), el('span', {}, `${w.mag} · ${Math.round(60000 / w.rate)} rpm`));
      card.append(st);
      const act = el('div', { className: 'act' });
      if (owned) {
        if (eq) act.append(el('span', { className: 'on' }, 'EQUIPPED'));
        else { const b = el('button', { className: 'eqb', type: 'button' }, 'EQUIP'); b.onclick = () => equip(w.id); act.append(el('span', {}, 'Owned'), b); }
      } else {
        const why = W.canBuy(state, w.id, cash, lv);
        const b = el('button', { className: 'buy', type: 'button', disabled: !!why }, `BUY · ${money(w.price)}`);
        b.onclick = () => {
          const pl = P(); if (!pl) return;
          const r = W.buy(state, pl, w.id, shootingLevel());
          if (!r.ok) { say(r.reason); return; }
          persist(); equip(w.id, true); gameSave();
          say(`${w.icon} Bought ${w.name} · -${money(w.price)}`);
          renderShop();
        };
        act.append(el('span', { className: locked ? '' : 'sub' }, locked ? `🔒 Shooting Lv ${w.level}` : why === 'Not enough cash' ? 'Need more cash' : ''), b);
      }
      card.append(act); grid.append(card);
    }
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

  root.NightshiftWeapons = Object.freeze({ current, equip, cycle, open, close, door, paused: () => !shop.hidden, get state() { return state; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
