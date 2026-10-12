/* Nightshift HUD (Claude-owned, art/UI pass). Loads last. Replaces the scattered floating chips with one
 * designed layout and a consistent visual language:
 *  - LEFT stack: status card (health/armor bars, cash, ammo or car gauges, district · clock), a dock of round
 *    icon buttons (Skills, Rank, Daily, Phone with badges), the goal card and the police status line.
 *  - RIGHT stack: minimap, weapon pill, car radio (portrait).
 *  - BOTTOM bars: job / event / heist progress bars stack cleanly above the controls.
 *  - Any menu or panel open (ours or the base game's, or the MORE grid) hides the whole HUD and the sticks,
 *    so nothing sits on top of menus.
 *  - Unified panel styling for every menu (glass sheet, display font headings, big close buttons).
 * Original chip elements stay alive (their modules keep updating them); the old floating ones are hidden and
 * re-parented where useful. No gameplay changes. API: NightshiftHud.{menuOpen, refresh} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const CS = () => { try { return combatState; } catch { return null; } };
  /* eslint-enable no-undef */
  const $ = (s) => document.querySelector(s);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const money = (n) => '$' + Math.round(n || 0).toLocaleString();

  // ---- font ----
  try {
    const l1 = el('link', { rel: 'preconnect', href: 'https://fonts.gstatic.com' }); l1.crossOrigin = '';
    const l2 = el('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&display=swap' });
    document.head.append(l1, l2);
  } catch { /* offline: system fonts */ }

  const MINE = ['#gdPanel', '#skPanel', '#glPanel', '#dyPanel', '#rsPanel', '#jbPanel', '#emPanel', '#mkPanel', '#lfMsg', '#gsPanel', '#csPanel', '#vnPanel', '#fsPanel', '#hsPanel', '#hmPanel', '#tnPanel', '#lbPanel'];
  const PANELS = ['#gdPanel', '#skPanel', '#glPanel', '#dyPanel', '#rsPanel', '#jbPanel', '#emPanel', '#mkPanel', '#lfMsg', '#gsPanel', '#csPanel', '#vnPanel', '#fsPanel', '#hsPanel', '#hmPanel', '#tnPanel', '#lbPanel',
    '#backupPanel', '#businessPanel', '#cityJournalPanel', '#craftPanel', '#gangLifePanel', '#inventoryPanel', '#mapPanel', '#progressPanel', '#vehiclePanel', '#controlSettings', '#creator'];

  const css = el('style'); css.id = 'nsHud';
  css.textContent = `
  :root{--hud-glass:linear-gradient(180deg,#141b2bee,#0b101bee);--hud-line:#ffffff1c;--hud-text:#eef3fb;--hud-dim:#9aa9c0;--amber:#ffcf5a;--pink:#ff4fd8;--cyan:#4fe3ff;--red:#ff4a5a;--green:#58e0a0;
    --disp:'Chakra Petch',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;--body:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
  /* old floating widgets: hidden (data still updates) or re-parented below */
  #hud,#map,#skChip,#rsBadge,#dyChip,#jbBtn{display:none!important}
  #nsL,#nsR{position:fixed;z-index:24;display:flex;flex-direction:column;gap:7px;pointer-events:none;top:max(8px,env(safe-area-inset-top))}
  #nsL{left:max(10px,env(safe-area-inset-left));width:min(228px,48vw)} #nsR{right:max(10px,env(safe-area-inset-right));align-items:flex-end}
  #nsL>*,#nsR>*{pointer-events:auto}
  #nsBars{position:fixed;z-index:24;display:flex;flex-direction:column;gap:6px;pointer-events:none;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom));width:min(440px,calc(100vw - 2 * min(34vw,300px)))}
  @media (orientation:portrait){#nsBars{bottom:calc(262px + env(safe-area-inset-bottom));width:calc(100vw - 24px)}}
  body.ns-menu #nsL,body.ns-menu #nsR,body.ns-menu #nsBars,body.ns-menu #pad,body.ns-menu #aimPad,body.ns-menu #lfRadio{visibility:hidden!important}
  body.ns-panel #actions{visibility:hidden!important}
  /* status card */
  #nsStatus{background:var(--hud-glass);border:1px solid var(--hud-line);border-radius:14px;padding:8px 10px 7px;box-shadow:0 8px 22px #0007,inset 0 1px 0 #ffffff14;color:var(--hud-text);font:600 11px/1.25 var(--body);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
  #nsStatus .row{display:flex;align-items:center;gap:6px} #nsStatus .cash{font:700 19px/1.1 var(--disp);color:var(--amber);letter-spacing:.02em;text-shadow:0 2px 8px #ffcf5a33}
  #nsStatus .bar{flex:1;height:7px;border-radius:5px;background:#060a12;overflow:hidden;box-shadow:inset 0 1px 2px #000a} #nsStatus .bar i{display:block;height:100%;border-radius:5px;transition:width .25s}
  #nsStatus .hp i{background:linear-gradient(90deg,#ff3d5a,#ff8a5c)} #nsStatus .ar i{background:linear-gradient(90deg,#3d8bff,#7fd0ff)} #nsStatus .ar{height:4px;margin-top:2px}
  #nsStatus .num{font:700 11px var(--disp);min-width:24px;text-align:right} #nsStatus .sub{color:var(--hud-dim);font:500 10.5px var(--body);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #nsStatus .ammo{font:700 12px var(--disp);color:#dfe8f5} #nsStatus .ammo.rl{color:var(--amber)} #nsStatus .x{color:#ffb4c0;font-size:10px}
  /* dock */
  #nsDock{display:flex;gap:6px;flex-wrap:wrap}
  #nsDock button{all:unset;box-sizing:border-box;position:relative;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;cursor:pointer;font:18px/1 system-ui;
    background:var(--hud-glass);border:1px solid var(--hud-line);box-shadow:0 6px 16px #0007,inset 0 1px 0 #ffffff14}
  #nsDock button:active{transform:scale(.93)} #nsDock button .b{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:var(--pink);color:#fff;font:700 9.5px/16px var(--disp);text-align:center;box-shadow:0 2px 6px #0008}
  #nsDock button .b.y{background:var(--amber);color:#2a1a00} #nsDock button .b.g{background:var(--green);color:#03210f} #nsDock button[hidden]{display:none}
  #nsDock button.hot{box-shadow:0 0 0 2px var(--pink),0 6px 16px #0007}
  /* goal card + police line */
  #nsL #glCard{position:static!important;max-width:none!important;width:100%;border-radius:14px!important;background:var(--hud-glass)!important;border:1px solid var(--hud-line)!important;border-left:3px solid var(--amber)!important;font-family:var(--body)!important;padding:7px 10px!important;box-shadow:0 8px 22px #0007!important}
  #nsL #glCard .t{font:700 9.5px var(--disp)!important;letter-spacing:.08em} #nsL #glCard .n{font:700 12.5px var(--body)!important}
  #nsL #crimeStatus{position:static!important;max-width:none!important;border-radius:10px;background:#2a0b14e6!important;border:1px solid #ff4a5a66!important;color:#ffd0d6!important;font:600 10.5px var(--body)!important;padding:5px 9px!important;top:auto!important;left:auto!important}
  #nsL #jobPanel{position:static!important;max-width:none!important;border-radius:12px}
  /* right stack */
  #nsR #mmWrap{position:relative!important;top:auto!important;left:auto!important;right:auto!important}
  #nsR .cap{font:700 9.5px var(--disp);letter-spacing:.1em;color:var(--hud-dim);text-align:center;white-space:nowrap;min-width:104px;margin-top:-3px;text-shadow:0 1px 3px #000}
  #nsR #wpPill{position:static!important;max-width:min(200px,44vw)!important;border-radius:12px!important;background:var(--hud-glass)!important;border:1px solid var(--hud-line)!important;font-family:var(--disp)!important;box-shadow:0 6px 16px #0007!important}
  @media (orientation:portrait){#nsR #lfRadio{position:static!important;transform:none!important;max-width:min(46vw,260px)!important}}
  /* bottom bars */
  #nsBars>div{position:static!important;transform:none!important;max-width:none!important;width:100%!important;top:auto!important;bottom:auto!important;left:auto!important;border-radius:12px!important;font-family:var(--body)!important;font-weight:600!important;box-shadow:0 8px 22px #0007!important}
  /* touch controls */
  #pad,#aimPad{background:radial-gradient(circle,#ffffff10 0,#0b111c55 62%,#0b111c88 100%)!important;border:1.5px solid #ffffff2e!important;box-shadow:0 10px 30px #0006,inset 0 0 0 9px #ffffff07,inset 0 0 22px #0008!important;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
  #pad::after,#aimPad::after{font:700 8.5px var(--disp)!important;letter-spacing:.22em!important;color:#ffffff8c!important;text-shadow:0 1px 3px #000}
  #nub{background:radial-gradient(circle at 35% 30%,#d9efff,#4d9bff 52%,#1f4fb0)!important;border:2px solid #ffffffb0!important;box-shadow:0 0 18px #4d9bffaa,inset 0 -3px 6px #0006!important}
  #aimNub{background:radial-gradient(circle at 35% 30%,#ffe0fb,#ff4fd8 52%,#a01f8a)!important;border:2px solid #ffffffb0!important;box-shadow:0 0 18px #ff4fd8aa,inset 0 -3px 6px #0006!important}
  #actions>button{border-radius:16px!important;font:700 10px var(--disp)!important;letter-spacing:.07em;background:linear-gradient(180deg,#1d2a40ee,#0e1626ee)!important;border:1.5px solid #ffffff2e!important;box-shadow:0 8px 20px #0007,inset 0 1px 0 #ffffff1c!important;color:#eef3fb!important}
  #actions>#use{border-color:var(--amber)!important;color:#ffe7a8!important;box-shadow:0 0 14px #ffcf5a44,0 8px 20px #0007!important}
  #actions>#shoot{border-color:var(--red)!important;color:#ffd0d6!important} #actions>[data-held=true]{filter:brightness(1.35);transform:scale(.95)}
  #actions>#more{border-color:#ffffff55!important}
  /* toast */
  #toast{font-family:var(--body)!important;font-weight:600}
  body.ns-panel #toast{z-index:80!important;top:auto!important;bottom:calc(16px + env(safe-area-inset-bottom))!important;box-shadow:0 10px 30px #000c!important}
  /* every menu: one look */
  ${PANELS.join(',')}{font-family:var(--body)!important;border-radius:18px!important;box-shadow:0 30px 80px #000d,inset 0 1px 0 #ffffff14!important;border-color:#ffffff24!important}
  ${PANELS.map((p) => p + ' h2').join(',')}{font-family:var(--disp)!important;letter-spacing:.04em}
  #skPanel,#glPanel,#dyPanel,#rsPanel,#lfMsg,#backupPanel,#inventoryPanel,#craftPanel,#progressPanel,#vehiclePanel,#businessPanel,#cityJournalPanel,#gangLifePanel,#mapPanel{background:linear-gradient(180deg,#151c2cf7,#0b0f19fa)!important}
  @media (orientation:portrait){${MINE.join(',')}{left:8px!important;right:8px!important;top:max(10px,env(safe-area-inset-top))!important;bottom:10px!important;inset:max(10px,env(safe-area-inset-top)) 8px 10px 8px!important;max-height:none!important}}
  @media (orientation:landscape){${MINE.join(',')}{left:max(8%,calc(50vw - 380px))!important;right:max(8%,calc(50vw - 380px))!important;top:4%!important;bottom:4%!important;inset:4% max(8%,calc(50vw - 380px))!important;max-height:none!important}}
  #skPanel .close,#rsPanel .close,#dyPanel .close,#glPanel .close,#jbPanel .x,#mkPanel .x,#emPanel .x,#vnPanel .x,#lfMsg button,#gsPanel .x,#csPanel .x{min-height:36px;padding:8px 14px!important;border-radius:10px!important;font-family:var(--disp)!important;letter-spacing:.06em}
  `;
  document.head.appendChild(css);

  // ---- layout containers ----
  const L = el('div', { id: 'nsL' }), R = el('div', { id: 'nsR' }), BARS = el('div', { id: 'nsBars' });
  const status = el('div', { id: 'nsStatus' });
  const hpRow = el('div', { className: 'row' }), hpBar = el('div', { className: 'bar hp' }), hpFill = el('i'), hpNum = el('span', { className: 'num' });
  hpBar.append(hpFill); hpRow.append(el('span', {}, '♥'), hpBar, hpNum);
  const arBar = el('div', { className: 'bar ar' }), arFill = el('i'); arBar.append(arFill);
  const midRow = el('div', { className: 'row', style: 'justify-content:space-between;margin-top:4px' }), cash = el('span', { className: 'cash' }), ammo = el('span', { className: 'ammo' });
  midRow.append(cash, ammo);
  const sub = el('div', { className: 'sub' }), extra = el('div', { className: 'sub x' });
  status.append(hpRow, arBar, midRow, sub, extra);
  const dock = el('div', { id: 'nsDock' });
  const mk = (icon, label, fn) => { const b = el('button', { type: 'button', ariaLabel: label, title: label }); b.append(el('span', {}, icon)); const badge = el('span', { className: 'b', hidden: true }); b.append(badge); b.onclick = () => { try { fn(); } catch { /* module missing */ } }; dock.append(b); return { b, badge, icon: b.firstChild }; };
  const dSkills = mk('⭐', 'Skills', () => (root.NightshiftSkills?.open ? root.NightshiftSkills.open() : $('#skChip')?.click()));
  const dRank = mk('👤', 'Respect rank', () => root.NightshiftRespect?.open?.());
  const dDaily = mk('📅', 'Daily challenges', () => root.NightshiftDailies?.open?.());
  const dPhone = mk('📱', 'Hustle phone', () => root.NightshiftJobs?.open?.());
  L.append(status, dock);
  const cap = el('div', { className: 'cap' });
  document.body.append(L, R, BARS);

  function adopt() {
    const gl = $('#glCard'); if (gl && gl.parentNode !== L) L.append(gl);
    const cr = $('#crimeStatus'); if (cr && cr.parentNode !== L) L.append(cr);
    const jp = $('#jobPanel'); if (jp && jp.parentNode !== L) L.append(jp);
    const mm = $('#mmWrap'); if (mm && mm.parentNode !== R) { R.prepend(mm); mm.after(cap); }
    const wp = $('#wpPill'); if (wp && wp.parentNode !== R) R.append(wp);
    const portrait = innerHeight > innerWidth, radio = $('#lfRadio');
    if (radio) { if (portrait && radio.parentNode !== R) R.append(radio); else if (!portrait && radio.parentNode !== document.body) document.body.append(radio); }
    for (const id of ['#hsHud', '#jbHud', '#evHud']) { const b = $(id); if (b && b.parentNode !== BARS) BARS.append(b); }
  }

  // ---- menu detection ----
  function visible(sel) { const e = $(sel); if (!e || e.hidden) return false; const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden'; }
  function menuState() {
    const panel = PANELS.some(visible) || ['NightshiftBusinesses', 'NightshiftCraft', 'NightshiftProgress', 'NightshiftBackups', 'NightshiftMap', 'NightshiftInventory', 'NightshiftVehicles', 'NightshiftRecovery'].some((m) => { try { return !!root[m]?.paused?.(); } catch { return false; } });
    let more = false; try { more = !!root.NightshiftInterface?.expanded?.(); } catch { /* n/a */ }
    return { panel, more };
  }

  // ---- render ----
  let last = '';
  function render() {
    adopt();
    const ms = menuState(), b = document.body;
    b.classList.toggle('ns-menu', ms.panel || ms.more); b.classList.toggle('ns-panel', ms.panel);
    const p = P(); if (!p) return;
    const hp = Math.max(0, Math.min(100, p.hp || 0)), armor = root.NightshiftWeapons?.state?.armor || 0;
    hpFill.style.width = hp + '%'; hpNum.textContent = Math.round(hp); arFill.style.width = Math.min(100, armor) + '%'; arBar.style.display = armor > 0 ? '' : 'none';
    cash.textContent = money(p.cash);
    const H = root.NightshiftHome, indoor = H?.kind?.();
    if (p.car) { const d = root.NightshiftVehicles?.dashboard?.(p.car) || ''; ammo.textContent = `🚗 ${Math.abs((p.car.speed || 0) * 15 | 0)}`; ammo.className = 'ammo'; sub.textContent = d.replace(/^(Speed|Reverse) \d+ · /, ''); }
    else { const cs = CS(), rl = !!cs?.until; ammo.textContent = rl ? 'RELOADING' : `▮ ${p.ammo ?? 0}/${30} · ${cs?.reserve ?? 0}`; ammo.className = 'ammo' + (rl ? ' rl' : ''); }
    const env = root.NightshiftEnvironment, place = indoor ? (indoor === 'shop' ? 'CORNER SHOP' : 'YOUR APARTMENT') : env?.district?.(p) || '', clock = env?.clock?.(env.state?.minute ?? 0) || '';
    if (!p.car) sub.textContent = `${place} · ${clock}`;
    cap.textContent = `${place} · ${clock}`;
    let ex = ''; try { ex = [root.NightshiftCrewOps?.hud?.(), root.NightshiftRivals?.hud?.()].filter(Boolean).join(' ').replace(/<br>/g, ' · ').replace(/<[^>]*>/g, '').replace(/^ · /, ''); } catch { /* optional */ }
    extra.textContent = ex; extra.style.display = ex ? '' : 'none';
    // dock badges
    const total = root.NightshiftGoals?.snapshot?.()?.totalLevel || 0;
    setBadge(dSkills, total ? String(total) : '', 'y');
    const rk = root.NightshiftRespect?.rank?.(); if (rk) { dRank.icon.textContent = rk.icon || '👤'; dRank.b.title = `Respect: ${rk.name}`; }
    const dy = root.NightshiftDailies?.state, done = dy?.claimed?.length || 0; setBadge(dDaily, dy?.day ? `${done}/3` : '', done >= 3 ? 'g' : 'y');
    const job = root.NightshiftJobs?.active?.(), unread = root.NightshiftLife?.state?.unread || 0; dPhone.b.classList.toggle('hot', !!job); setBadge(dPhone, unread ? String(unread) : job ? '●' : '', '');
    const key = `${place}|${armor > 0}`; if (key !== last) last = key;
  }
  function setBadge(d, text, cls) { d.badge.hidden = !text; d.badge.textContent = text; d.badge.className = 'b' + (cls ? ' ' + cls : ''); }
  // Escape / back closes whichever Claude panel is open (some panels only had a CLOSE button).
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const id of MINE) { const p = $(id); if (p && !p.hidden && getComputedStyle(p).display !== 'none') { const btn = p.querySelector('.close,.x,button[type=button]'); if (btn && /close|leave|✕|×/i.test(btn.textContent)) btn.click(); else p.hidden = true; } }
  });
  setInterval(render, 120);
  render();

  root.NightshiftHud = Object.freeze({ menuOpen: () => document.body.classList.contains('ns-menu'), refresh: render });
})(typeof globalThis !== 'undefined' ? globalThis : this);
