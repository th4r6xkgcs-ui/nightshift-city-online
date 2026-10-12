/* Supply chains in game (Claude-owned). Requires supply-data.js + weapons-data.js/weapons.js; art in supply-art.js.
 * No game file is edited:
 *  - places are USE points via NightshiftEncounters (collect / process / sell / shops / lockup);
 *  - "sit and collect": USE starts a timed loop at that place; a ring fills over you; each cycle pays out and the
 *    next one starts automatically until your bag is full, the spot runs dry, it closes, or you walk away;
 *  - the home workbench is a USE point inside the apartment (NightshiftHome.interaction/use wrap);
 *  - panels: 🎒 backpack (+ where to get everything), 🛠️ workbench (guns, attachments, repairs, home locker),
 *    shops (hardware counter, bag shops, lockup), buyers (party promoter, arms buyer).
 *  - a brand-new player (no saves) starts broke and unarmed with a tiny starter kit.
 * Save: nightshift-supply-v1. API: NightshiftSupply.{state, openBag, openBench, gpsTo, buy, count, space, ...} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const S = root.NightshiftSupplyData, W = root.NightshiftWeaponsData;
  if (!S || !W) return;
  const KEY = 'nightshift-supply-v1';
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  let state = S.clean(raw || {});
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const CS = () => { try { return combatState; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };
  const xp = (map, why) => { for (const [k, n] of Object.entries(map || {})) try { root.NightshiftSkills?.gain(k, n, why); } catch { /* optional */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const minute = () => root.NightshiftEnvironment?.state?.minute ?? 720;
  const ART = () => root.NightshiftSupplyArt;
  const WS = () => root.NightshiftWeapons;
  const home = () => !!root.NightshiftHome?.kind?.() && root.NightshiftHome.kind() === 'home';

  // ---- new life: no saves at all -> start broke and unarmed with a starter kit ----
  function newLifeCheck() {
    const p = P(), ws = WS();
    if (!p || !ws) return false;
    if (raw === null) {
      const fresh = !ws.state.owned.length;
      if (fresh) {
        state.newLife = true;
        state.bag = { tape: 2, baggie: 10 };
        p.cash = 200;
        const cs = CS(); if (cs) { p.ammo = 0; cs.reserve = 24; }
        setTimeout(() => say('🎒 You\'re broke and unarmed. First: scavenge the 🔩 SCRAPYARD for a pipe, scrap and a spring, then craft a Pipe Pistol at your home workbench.'), 9000);
      } else {
        // Existing player meeting crafting for the first time: a small gift so the benches make sense.
        state.bag = { metal: 6, pipe: 1, spring: 2, tape: 2, baggie: 10 };
        setTimeout(() => say('🛠️ New: guns are crafted now. Your 🎒 backpack has some materials; check the workbench at home.'), 12000);
      }
      raw = {}; persist(); gameSave();
    }
    return true;
  }
  const nl = setInterval(() => { if (newLifeCheck()) clearInterval(nl); }, 300);

  // ---- bag helpers ----
  const count = (id) => (state.bag[id] || 0) + (home() ? state.locker[id] || 0 : 0);
  const space = () => `${S.weightOf(state.bag)}/${S.cap(state)}`;
  function buy(id, n, counter) {
    const p = P(); if (!p) return { ok: false, reason: 'Not ready' };
    const r = S.buy(state, p, id, n, { counter });
    if (r.ok) { persist(); gameSave(); refresh(); }
    return r;
  }

  // ---- sites ----
  const near = (p, s, r) => Math.hypot(p.x - s.x, p.y - s.y) <= r;
  function sites() {
    const out = [];
    for (const sp of S.GATHER) out.push({ id: 'sp-g-' + sp.id, kind: 'gather', spot: sp, x: sp.x, y: sp.y, action: 'COLLECT', label: `${sp.icon} ${sp.name.toUpperCase()}`, color: '#7cdeb5', hint: `${sp.name} · ${S.hoursText(sp.hours)}` });
    for (const sp of S.PROCESS) out.push({ id: 'sp-p-' + sp.id, kind: 'process', spot: sp, x: sp.x, y: sp.y, action: 'PROCESS', label: `${sp.icon} ${sp.name.toUpperCase()}`, color: '#c49bff', hint: `${sp.name} · ${S.costText(sp.in)} → ${Object.entries(sp.out).map(([k, n]) => n + ' ' + k).join(', ')}` });
    const pr = S.PROMOTER; out.push({ id: 'sp-promoter', kind: 'promoter', spot: pr, x: pr.x, y: pr.y, action: 'SELL', label: `${pr.icon} PROMOTER`, color: '#ff7fd0', hint: 'Sells party pills · nights' });
    const ab = S.ARMS_BUYER; out.push({ id: 'sp-arms', kind: 'arms', spot: ab, x: ab.x, y: ab.y, action: 'SELL GUNS', label: `${ab.icon} ARMS BUYER`, color: '#ffb347', hint: 'Buys guns · nights' });
    const hw = S.HARDWARE_SITE; out.push({ id: 'sp-hardware', kind: 'hardware', spot: hw, x: hw.x, y: hw.y, action: 'SHOP', label: `${hw.icon} HARDWARE`, color: '#ffd970', hint: 'Tape, baggies, scrap, wood' });
    for (const b of S.BAG_SHOPS) out.push({ id: 'sp-' + b.id, kind: 'bags', spot: b, x: b.x, y: b.y, action: 'BAGS', label: '🎒 BAGS', color: '#7cc7ff', hint: 'Bigger backpacks' });
    const lk = S.LOCKUP; out.push({ id: 'sp-lockup', kind: 'lockup', spot: lk, x: lk.x, y: lk.y, action: state.lockup ? 'CRAFT' : 'BUY', label: `${lk.icon} ${state.lockup ? S.LOCKUP.levels[state.lockup - 1].name.toUpperCase() : 'LOCKUP FOR SALE'}`, color: '#ffb347', hint: state.lockup ? 'Your gun workshop' : `Gun workshop · ${money(S.LOCKUP.levels[0].price)}` });
    return out;
  }
  const BY_SITE = () => Object.fromEntries(sites().map((s) => [s.id, s]));
  function useSite(id) {
    const s = BY_SITE()[id];
    if (!s) return false;
    if (s.kind === 'gather' || s.kind === 'process') { if (act && act.site === id) stop('Stopped'); else start(s); return true; }
    if (s.kind === 'lockup') { if (state.lockup) openBench('lockup'); else openShop('lockup'); return true; }
    openShop(s.kind); return true;
  }
  const E = root.NightshiftEncounters;
  if (E && !E.__supply) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 ? [...list, ...sites().map((s) => ({ id: s.id, type: 'supply', x: s.x, y: s.y, ready: true, color: s.color, label: s.label, action: s.action, hint: s.hint }))] : list; };
    E.use = function (id) { if (typeof id === 'string' && id.startsWith('sp-')) return useSite(id); return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawSites(); } catch { /* cosmetic */ } return r; };
    E.__supply = true;
  }
  function drawSites() {
    const ctx = G(), p = P(), A = ART();
    if (!ctx || !p) return;
    const t = performance.now() / 1000, m = minute();
    for (const s of sites()) {
      if (Math.abs(p.x - s.x) > 760 || Math.abs(p.y - s.y) > 560) continue;
      const info = { t, open: S.openAt(s.spot.hours, m), night: (root.NightshiftEnvironment?.darkness?.(m) || 0) > 0.4, active: act?.site === s.id, owned: s.kind === 'lockup' ? state.lockup : 0 };
      if (s.kind === 'gather') { info.stock = S.stockNow(state, s.spot.id); info.max = s.spot.stock; }
      ctx.save();
      try { if (A) A.drawSite(ctx, s, info); } catch { /* art optional */ }
      ctx.restore();
      root.NightshiftSign?.(ctx, s.x, s.y - (A?.signLift?.(s) ?? 34), s.label.split(' ')[0], s.label.split(' ').slice(1).join(' ') + (s.kind === 'gather' && info.open ? ` · ${info.stock}/${info.max}` : s.spot.hours && !info.open ? ' · CLOSED' : ''), info.open ? s.color : '#7d8796', { glow: info.active ? 14 : 6 });
    }
  }

  // ---- the sit-and-collect loop ----
  let act = null; // { site, kind, spot, t0, dur, paused }
  function start(s) {
    const p = P();
    if (!p || p.hp <= 0) return;
    if (p.car) { say('Get out of the car first'); return; }
    const sp = s.spot, m = minute();
    if (sp.hours && !S.openAt(sp.hours, m)) { say(`${sp.icon} ${sp.name} is closed · ${S.hoursText(sp.hours)}`); return; }
    if (s.kind === 'gather') {
      if (S.stockNow(state, sp.id) <= 0) { say(`${sp.icon} Picked clean · more in ${S.refillIn(state, sp.id)}s`); return; }
      if (S.room(state) <= 0) { say('🎒 Backpack full · stash it at home or buy a bigger bag'); return; }
    } else if (S.batches(state, sp.id) <= 0) { say(`${sp.icon} ${sp.name} needs ${S.costText(sp.in)} per batch`); return; }
    const speed = s.kind === 'process' ? (sp.id === 'trim' ? mod('farming.growTime') : 1) : 1;
    act = { site: s.id, kind: s.kind, spot: sp, t0: performance.now(), dur: sp.seconds * 1000 * speed, done: 0 };
    say(`${sp.icon} ${s.kind === 'gather' ? 'Collecting' : 'Processing'} at the ${sp.name} · stay close · tap ${s.kind === 'gather' ? 'COLLECT' : 'PROCESS'} again to stop`);
    renderAct();
  }
  function stop(reason) {
    if (!act) return;
    const n = act.done; act = null; renderAct();
    if (reason) say(reason + (n ? ` · ${n} round${n === 1 ? '' : 's'} done` : ''));
  }
  function cycle() {
    const p = P(), sp = act.spot;
    let r;
    if (act.kind === 'gather') r = S.gather(state, sp.id, { minute: minute(), luck: mod('luck.rare') });
    else r = S.process(state, sp.id, root.NightshiftInventory?.state?.pocket);
    if (!r.ok) { stop(`${sp.icon} ${r.reason}`); return; }
    act.done += 1;
    if (r.heat && p) p.heat = Math.min(5, (p.heat || 0) + r.heat * mod('stealth.heat'));
    xp(r.xp, 'supply');
    const got = act.kind === 'gather' ? r.added : r.out;
    const txt = Object.entries(got).map(([k, n]) => `+${n} ${S.MATERIALS[k]?.icon || (k === 'weed' ? '🌿' : k === 'coke' ? '❄️' : '')}`).join(' ');
    try { root.NightshiftFeedback?.floating(p.x, p.y - 34, txt, '#ffe9a8'); root.NightshiftAudio?.play('pickup'); } catch { /* cosmetic */ }
    if (r.lost && Object.keys(r.lost).length) say('🎒 Bag full · some loot left behind');
    if (act.kind === 'process' && sp.pocket) { try { root.NightshiftInventory?.save?.(); } catch { /* best effort */ } }
    persist(); gameSave();
    // keep going if possible
    if (act.kind === 'gather' && (S.stockNow(state, sp.id) <= 0 || S.room(state) <= 0)) { stop(S.room(state) <= 0 ? '🎒 Backpack full' : `${sp.icon} Picked clean · refills over time`); return; }
    if (act.kind === 'process' && S.batches(state, sp.id) <= 0) { stop(`${sp.icon} Out of ${Object.keys(sp.in).map((k) => S.MATERIALS[k].name.toLowerCase()).join(' / ')}`); return; }
    act.t0 = performance.now();
  }
  setInterval(() => {
    if (!act) return;
    const p = P();
    if (!p || p.hp <= 0) { stop(); return; }
    if (act.kind === 'craft') { craftTick(p); return; }
    if (p.car || !near(p, act.spot, act.spot.r + 15)) { stop(`${act.spot.icon} You walked away`); return; }
    if (act.spot.hours && !S.openAt(act.spot.hours, minute())) { stop(`${act.spot.icon} ${act.spot.name} just closed`); return; }
    const busy = document.body.classList.contains('ns-menu');
    if (busy) { act.t0 += 100; return; } // menus pause the timer
    if (performance.now() - act.t0 >= act.dur) cycle();
    renderAct();
  }, 100);

  // progress ring over the player (top world layer)
  const FB = root.NightshiftFeedback;
  if (FB && typeof FB.draw === 'function' && !FB.__supply) {
    const draw = FB.draw;
    FB.draw = function () { const r = draw.apply(this, arguments); try { drawRing(); } catch { /* cosmetic */ } return r; };
    FB.__supply = true;
  }
  function drawRing() {
    const ctx = G(), p = P();
    if (!act || !ctx || !p || (act.kind === 'craft' && home())) return;
    const f = Math.min(1, (performance.now() - act.t0) / act.dur), x = p.x, y = p.y - 46;
    ctx.save();
    ctx.fillStyle = '#05080fcc'; ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = act.kind === 'process' ? '#c49bff' : act.kind === 'craft' ? '#ffb347' : '#7cdeb5'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
    ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(act.spot.icon || '🛠️', x, y + 0.5);
    ctx.restore();
  }

  // ---- crafting (a timed activity at a bench) ----
  function benchCtx(where) {
    const lvl = where === 'home' ? 0 : state.lockup;
    const pool = where === 'home' ? () => S.combined(state) : () => state.bag;
    return { bench: lvl, shooting: root.NightshiftSkills?.level?.('shooting') ?? 1, have: (c) => S.has(pool(), c), spend: (c) => (where === 'home' ? S.spendBoth(state, c) : (S.has(state.bag, c) && (S.take(state.bag, c), true))) };
  }
  function benchOk(p, where) { return where === 'home' ? home() : !p.car && near(p, S.LOCKUP, S.LOCKUP.r + 15); }
  function startCraft(job) { // job: { where, label, seconds, run(ctx) -> result, check(ctx) -> reason }
    const p = P(); if (!p) return;
    const why = job.check(benchCtx(job.where));
    if (why) { say(why); return; }
    act = { site: 'bench-' + job.where, kind: 'craft', spot: { icon: '🛠️', name: job.label }, job, t0: performance.now(), dur: job.seconds * 1000 * mod('crafting.speed'), done: 0 };
    renderAct(); renderBench();
  }
  function craftTick(p) {
    if (!benchOk(p, act.job.where)) { stop('🛠️ You left the bench · crafting cancelled'); renderBench(); return; }
    if (performance.now() - act.t0 < act.dur) { renderAct(); renderBenchProgress(); return; }
    const job = act.job; act = null; renderAct();
    const r = job.run(benchCtx(job.where));
    if (!r.ok) { say(r.reason); renderBench(); return; }
    state.stats.crafted += 1; if (job.gun) { state.stats.gunsCrafted += 1; if (job.real) state.stats.realCrafted += 1; } persist(); gameSave();
    xp({ crafting: Math.round(job.seconds * 4) }, 'craft');
    try { root.NightshiftAudio?.play('pickup'); root.NightshiftFeedback?.floating(p.x, p.y - 34, '🛠️ ' + job.label, '#ffb347'); } catch { /* cosmetic */ }
    say(job.done(r));
    renderBench(); refresh();
  }

  // ---- UI ----
  const css = document.createElement('style');
  css.textContent = `
  .spP{position:fixed;inset:5% 5%;z-index:46;overflow:auto;background:linear-gradient(180deg,#141a24f7,#0b0f16f8);border:1px solid #ffffff24;border-radius:18px;padding:12px 14px;color:#eef3f9;font:13px var(--body,system-ui)}
  .spP[hidden]{display:none} .spP h2{margin:0;font:700 17px var(--disp,system-ui);letter-spacing:.05em;color:#ffd970}
  .spP h3{margin:12px 0 6px;font:700 11px var(--disp,system-ui);letter-spacing:.16em;color:#8fa6c0}
  .spP button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:10px;font:700 12px var(--disp,system-ui);letter-spacing:.03em}
  .spP .top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px} .spP .x{background:#ffffff14;border:1px solid #ffffff2a;padding:7px 12px}
  .spP .sub{color:#a9b8ca;font-size:11.5px;margin:2px 0 8px;line-height:1.35}
  .spP .cap{height:8px;background:#060a10;border-radius:5px;overflow:hidden;margin:4px 0 2px} .spP .cap i{display:block;height:100%;background:linear-gradient(90deg,#7cdeb5,#ffd970)}
  .spP .mats{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px}
  .spP .mat{display:flex;align-items:center;gap:7px;background:#ffffff08;border:1px solid #ffffff14;border-radius:10px;padding:5px 7px;font-size:11.5px}
  .spP .mat b{font:700 14px var(--disp,system-ui);color:#fff} .spP .mat span{color:#a9b8ca;font-size:10px;display:block;line-height:1.1}
  .spP canvas{image-rendering:pixelated;flex:none} .spP canvas.gun,#gsPanel canvas.gun{background:linear-gradient(#b7c4d3,#8e9db0);border-radius:9px;padding:4px 6px;box-shadow:inset 0 0 0 1px #ffffff55,0 2px 6px #0006}
  .spP .tabs{display:flex;gap:6px;margin:6px 0 8px;flex-wrap:wrap} .spP .tab{padding:7px 12px;background:#ffffff0c;border:1px solid #ffffff1c} .spP .tab.on{background:#ffd97022;border-color:#ffd970;color:#ffd970}
  .spP .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}
  .spP .card{background:#ffffff07;border:1px solid #ffffff16;border-radius:14px;padding:9px 10px;position:relative}
  .spP .card.lock{opacity:.55} .spP .card.ready{border-color:#7cdeb588;box-shadow:inset 0 0 0 1px #7cdeb522}
  .spP .card .hd{display:flex;align-items:center;gap:8px} .spP .card .nm{font:700 13.5px var(--disp,system-ui)} .spP .card .tg{font-size:10px;color:#8fa6c0;letter-spacing:.08em}
  .spP .card .ds{font-size:11px;color:#a9b8ca;margin:4px 0}
  .spP .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:4px 0;font-size:10px;color:#8fa6c0;text-align:center}
  .spP .stats b{display:block;color:#fff;font:700 12px var(--disp,system-ui)}
  .spP .need{display:flex;flex-wrap:wrap;gap:4px;margin:5px 0} .spP .chip{display:inline-flex;align-items:center;gap:3px;padding:2px 6px 2px 3px;border-radius:999px;background:#ffffff0d;font-size:11px}
  .spP .chip.no{background:#ff5a6a22;color:#ffb0b8} .spP .chip.ok{background:#7cdeb51a;color:#bff3df}
  .spP .row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px}
  .spP .go{padding:8px 14px;background:linear-gradient(#ffe08a,#e2a33f);color:#2a1600} .spP .go[disabled]{opacity:.35;pointer-events:none}
  .spP .alt{padding:7px 11px;background:#ffffff10;border:1px solid #ffffff26;color:#eef3f9} .spP .alt[disabled]{opacity:.35;pointer-events:none}
  .spP .why{font-size:10.5px;color:#ffb0b8} .spP .okc{font-size:10.5px;color:#7cdeb5}
  .spP .prog{position:sticky;top:-12px;z-index:2;margin:-2px 0 8px;padding:8px 10px;border-radius:12px;background:#1d2533;border:1px solid #ffb34766;font:700 12px var(--disp,system-ui)}
  .spP .prog .cap i{background:linear-gradient(90deg,#ffb347,#ffe08a)}
  .spP .place{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:12px;background:#ffffff07;border:1px solid #ffffff12;margin-bottom:5px;font-size:11.5px}
  .spP .place .pi{font-size:20px;width:28px;text-align:center} .spP .place .pt{flex:1} .spP .place .pt b{font:700 12.5px var(--disp,system-ui)} .spP .place .pt span{display:block;color:#a9b8ca;font-size:10.5px}
  .spP .st-open{color:#7cdeb5} .spP .st-closed{color:#ff9aa5}
  #spAct{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(196px + env(safe-area-inset-bottom));z-index:27;min-width:220px;max-width:86vw;padding:7px 12px;border-radius:14px;
    background:#0d1320e6;border:1px solid #ffffff26;color:#eef3f9;font:700 12px var(--disp,system-ui);box-shadow:0 10px 26px #0009;pointer-events:none}
  #spAct[hidden]{display:none} #spAct .cap{height:6px;background:#060a10;border-radius:4px;overflow:hidden;margin-top:5px} #spAct .cap i{display:block;height:100%;background:linear-gradient(90deg,#7cdeb5,#ffd970)}
  #spAct small{font-weight:400;color:#a9b8ca}
  @media (orientation:landscape){#spAct{bottom:calc(14px + env(safe-area-inset-bottom))}}
  body.ns-menu #spAct{display:none}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const btn = (cls, txt, fn, dis) => { const b = el('button', { className: cls, type: 'button', disabled: !!dis }, txt); b.onclick = fn; return b; };
  const matIcon = (id, size = 22) => { try { return ART()?.matIcon?.(id, size) || null; } catch { return null; } };
  const gunIcon = (id, w = 72, h = 30) => { try { const c = ART()?.gunIcon?.(id, w, h) || null; if (c) c.classList.add('gun'); return c; } catch { return null; } };
  function chip(id, need, have) {
    const c = el('span', { className: 'chip ' + (have >= need ? 'ok' : 'no') });
    const ic = matIcon(id, 16); if (ic) c.append(ic); else c.append(document.createTextNode(S.MATERIALS[id]?.icon || ''));
    c.append(document.createTextNode(`${Math.min(have, need)}/${need}`)); c.title = S.MATERIALS[id]?.name || id;
    return c;
  }
  const panel = (id, label) => { const d = el('div', { id, className: 'spP', hidden: true, role: 'dialog', ariaLabel: label }); document.body.append(d); return d; };
  const bagP = panel('spBag', 'Backpack'), benchP = panel('spBench', 'Workbench'), shopP = panel('spShop', 'Shop');
  const actBar = el('div', { id: 'spAct', hidden: true }); document.body.append(actBar);
  const closeAll = () => { bagP.hidden = benchP.hidden = shopP.hidden = true; };
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && (!bagP.hidden || !benchP.hidden || !shopP.hidden)) { closeAll(); e.stopImmediatePropagation(); } }, true);
  const show = (p) => { closeAll(); try { root.releaseControls?.(); } catch { /* n/a */ } p.hidden = false; };
  function header(p, title, sub) {
    const top = el('div', { className: 'top' }); top.append(el('h2', {}, title), btn('x', 'CLOSE', () => { p.hidden = true; }));
    p.append(top); if (sub) p.append(el('div', { className: 'sub' }, sub));
  }
  function capBar(p) {
    const used = S.weightOf(state.bag), cap = S.cap(state), b = S.BAGS[state.bagLevel];
    const row = el('div', { className: 'sub' }, `${b.icon} ${b.name} · ${used}/${cap} space`); const c = el('div', { className: 'cap' }), i = el('i'); i.style.width = Math.round(Math.min(1, used / cap) * 100) + '%'; c.append(i);
    p.append(row, c);
  }
  function renderAct() {
    if (!act) { actBar.hidden = true; return; }
    const f = Math.min(1, (performance.now() - act.t0) / act.dur);
    actBar.hidden = false; actBar.textContent = '';
    const what = act.kind === 'craft' ? `🛠️ Crafting ${act.spot.name}` : `${act.spot.icon} ${act.kind === 'gather' ? 'Collecting' : 'Processing'} · ${act.spot.name}`;
    actBar.append(document.createTextNode(what + ' '), el('small', {}, act.kind === 'craft' ? `${Math.ceil((act.dur - (performance.now() - act.t0)) / 1000)}s` : `#${act.done + 1} · ${space()} bag · walk away to stop`));
    const c = el('div', { className: 'cap' }), i = el('i'); i.style.width = Math.round(f * 100) + '%'; c.append(i); actBar.append(c);
  }

  // ---- 🎒 backpack + where-to-get-it guide ----
  const whereFrom = (id) => [...S.GATHER.filter((g) => g.loot.some(([it]) => it === id)).map((g) => g.name), ...(S.PARTS_COUNTER.includes(id) ? ['Gun shop'] : []), ...(S.HARDWARE.some((h) => h.id === id) ? ['Hardware'] : []), ...S.PROCESS.filter((p) => p.out[id]).map((p) => p.name)];
  function placeRow(icon, name, line, status, open, gpsTarget) {
    const r = el('div', { className: 'place' });
    const t = el('div', { className: 'pt' }); t.append(el('b', {}, name), el('span', {}, line));
    r.append(el('div', { className: 'pi' }, icon), t);
    if (status) r.append(el('span', { className: open ? 'st-open' : 'st-closed' }, status));
    if (gpsTarget) r.append(btn('alt', 'GPS', () => { gps(gpsTarget, name); bagP.hidden = true; }));
    return r;
  }
  function openBag() { show(bagP); renderBag(); }
  function renderBag() {
    if (bagP.hidden) return;
    const scroll = bagP.scrollTop, m = minute(), pocket = root.NightshiftInventory?.state?.pocket || {};
    bagP.textContent = '';
    header(bagP, '🎒 BACKPACK', 'Collect raw stuff at one place, process it at another, sell it at a third. Guns: collect parts, craft at a bench.');
    capBar(bagP);
    const mats = el('div', { className: 'mats' });
    const ids = S.IDS.filter((id) => state.bag[id] > 0);
    for (const id of ids) {
      const m2 = S.MATERIALS[id], c = el('div', { className: 'mat' }); const ic = matIcon(id, 26); if (ic) c.append(ic);
      const t = el('div'); t.append(el('b', {}, String(state.bag[id])), el('span', {}, m2.name)); c.append(t); c.title = 'From: ' + (whereFrom(id).join(', ') || '—'); mats.append(c);
    }
    for (const [k, icon, name] of [['weed', '🌿', 'Weed bags'], ['coke', '❄️', 'Coke bags']]) if (pocket[k] > 0) { const c = el('div', { className: 'mat' }); c.append(el('div', { className: 'pi' }, icon)); const t = el('div'); t.append(el('b', {}, String(pocket[k])), el('span', {}, name + ' · sell to dealers')); c.append(t); mats.append(c); }
    if (!mats.children.length) mats.append(el('div', { className: 'sub' }, 'Empty. Head to the 🔩 Scrapyard to start.'));
    bagP.append(mats);
    // Codex salvage converts to materials
    if (pocket.scrap > 0 || pocket.parts > 0) {
      const row = el('div', { className: 'row' });
      if (pocket.scrap > 0) row.append(btn('alt', `♻️ Break ${pocket.scrap} scrap → ${pocket.scrap * 3} 🔩`, () => { const n = Math.min(pocket.scrap, Math.floor(S.fits(state, 'metal') / 3)); if (n <= 0) { say('🎒 No room'); return; } pocket.scrap -= n; if (!pocket.scrap) delete pocket.scrap; S.give(state, { metal: n * 3 }); persist(); gameSave(); renderBag(); }));
      if (pocket.parts > 0) row.append(btn('alt', `♻️ Strip ${pocket.parts} auto parts → 🌀🔩`, () => { const n = Math.min(pocket.parts, Math.floor(S.room(state) / 3)); if (n <= 0) { say('🎒 No room'); return; } pocket.parts -= n; if (!pocket.parts) delete pocket.parts; S.give(state, { spring: n, metal: n * 2 }); persist(); gameSave(); renderBag(); }));
      bagP.append(row);
    }
    const ws = WS()?.state;
    if (ws) {
      bagP.append(el('h3', {}, 'GUNS'));
      if (!ws.owned.length) bagP.append(el('div', { className: 'sub' }, '✊ Unarmed. Craft a Pipe Pistol at your home workbench: 1 pipe, 3 scrap metal, 1 spring, 1 tape.'));
      else { const g2 = el('div', { className: 'cards' }); for (const w of W.WEAPONS) if (ws.owned.includes(w.id)) g2.append(WS().armoryCard(w.id, { compact: true })); bagP.append(g2); }
    }
    bagP.append(el('h3', {}, 'COLLECT · raw materials'));
    for (const sp of S.GATHER) {
      const open = S.openAt(sp.hours, m), stock = S.stockNow(state, sp.id);
      bagP.append(placeRow(sp.icon, sp.name, `${sp.loot.map(([it]) => S.MATERIALS[it].icon).join(' ')} · ${sp.desc}`, open ? `${stock}/${sp.stock}` : 'CLOSED', open && stock > 0, sp));
    }
    bagP.append(el('h3', {}, 'PROCESS · turn raw into product'));
    for (const sp of S.PROCESS) bagP.append(placeRow(sp.icon, sp.name, `${S.costText(sp.in)} → ${Object.entries(sp.out).map(([k, n]) => `${n} ${S.MATERIALS[k]?.icon || (k === 'weed' ? '🌿 weed' : '❄️ coke')}`).join(' ')} · ${sp.desc}`, `${S.batches(state, sp.id)}×`, S.batches(state, sp.id) > 0, sp));
    bagP.append(el('h3', {}, 'SELL'));
    const D = root.NightshiftBusinessRules?.MARKETS || [];
    for (const d of D) bagP.append(placeRow('💰', d.name, `Buys 🌿 weed ~$${d.sell?.weed ?? '?'} · ❄️ coke ~$${d.sell?.coke ?? '?'}`, '', true, d));
    bagP.append(placeRow(S.PROMOTER.icon, S.PROMOTER.name, `💊 $${S.PROMOTER.price} each · ${S.PROMOTER.desc}`, S.openAt(S.PROMOTER.hours, m) ? 'OPEN' : 'NIGHTS', S.openAt(S.PROMOTER.hours, m), S.PROMOTER));
    bagP.append(placeRow(S.ARMS_BUYER.icon, S.ARMS_BUYER.name, S.ARMS_BUYER.desc, S.openAt(S.ARMS_BUYER.hours, m) ? 'OPEN' : 'NIGHTS', S.openAt(S.ARMS_BUYER.hours, m), S.ARMS_BUYER));
    bagP.append(el('h3', {}, 'CRAFT & SHOPS'));
    bagP.append(placeRow('🛠️', 'Home workbench', 'Crude guns, reinforcing, your material locker. In your apartment.', '', true, { x: 880, y: 680 }));
    bagP.append(placeRow(S.LOCKUP.icon, S.LOCKUP.name, state.lockup ? `Level ${state.lockup}: real guns, attachments, repairs` : `For sale ${money(S.LOCKUP.levels[0].price)} · needed for real guns`, state.lockup ? 'OWNED' : '', !!state.lockup, S.LOCKUP));
    const gs = WS()?.door?.(); if (gs) bagP.append(placeRow('🔫', 'Gun shop · parts', 'Barrels, triggers, frames, bolts, springs, lenses. Ammo and armor.', '', true, gs));
    bagP.append(placeRow(S.HARDWARE_SITE.icon, S.HARDWARE_SITE.name, S.HARDWARE_SITE.desc, '', true, S.HARDWARE_SITE));
    bagP.append(placeRow('🎒', 'Bag shop', state.bagLevel < S.BAGS.length - 1 ? `Next: ${S.BAGS[state.bagLevel + 1].name} (${S.BAGS[state.bagLevel + 1].cap} space) ${money(S.BAGS[state.bagLevel + 1].price)}` : 'You have the biggest bag', '', true, S.BAG_SHOPS[0]));
    const reset = btn('alt', '↺ START A NEW LIFE (wipe this save)', newLife); reset.style.marginTop = '14px'; bagP.append(reset);
    bagP.scrollTop = scroll;
  }
  function gps(t, label) { try { root.NightshiftMap?.navigate?.({ x: t.x, y: t.y + (t.r ? 0 : 0), label: ('📍 ' + label).slice(0, 60) }); say(`📍 GPS set · ${label}`); } catch { /* optional */ } }
  function gpsTo(id) { const sp = S.GBY[id] || S.PBY[id] || (id === 'lockup' ? S.LOCKUP : null); if (sp) gps(sp, sp.name); }
  function newLife() {
    if (!root.confirm?.('Start a new life? This wipes ALL progress on this device (cash, guns, skills, properties) and starts you broke in your apartment.')) return;
    // The wipe happens in starter-home.js on the next load (before the game can save over it).
    location.href = location.pathname + '?newlife=1';
  }

  // ---- 🛠️ workbench ----
  let benchWhere = 'home', benchTab = 'guns', modGun = null;
  function openBench(where) { benchWhere = where; show(benchP); renderBench(); }
  function renderBenchProgress() {
    const pr = benchP.querySelector('.prog i');
    if (pr && act?.kind === 'craft') pr.style.width = Math.round(Math.min(1, (performance.now() - act.t0) / act.dur) * 100) + '%';
  }
  function renderBench() {
    if (benchP.hidden) return;
    const scroll = benchP.scrollTop, ws = WS(), wst = ws?.state, ctx = benchCtx(benchWhere), pool = benchWhere === 'home' ? S.combined(state) : state.bag;
    benchP.textContent = '';
    const lvl = benchWhere === 'home' ? 0 : state.lockup;
    header(benchP, benchWhere === 'home' ? '🛠️ HOME WORKBENCH' : `🔧 ${S.LOCKUP.levels[lvl - 1].name.toUpperCase()} · LV ${lvl}`,
      benchWhere === 'home' ? 'Crude guns from scrap, reinforcing, and your material locker. Real guns need your Lockup workshop.' : 'Real guns, attachments and repairs. Uses what\'s in your backpack.');
    if (act?.kind === 'craft') { const pg = el('div', { className: 'prog' }, `🛠️ Crafting ${act.spot.name}… stay at the bench`); const c = el('div', { className: 'cap' }); c.append(el('i')); pg.append(c); benchP.append(pg); }
    capBar(benchP);
    if (benchWhere === 'lockup' && state.lockup < S.LOCKUP.levels.length) {
      const nx = S.LOCKUP.levels[state.lockup];
      benchP.append(el('div', { className: 'row' }, ''), btn('alt', `⬆ Upgrade to ${nx.name} (Lv ${state.lockup + 1}) · ${money(nx.price)}`, () => { const p = P(); const r = S.buyLockup(state, p); say(r.ok ? `🔧 ${r.name} unlocked · Lv ${r.level} guns available` : r.reason); persist(); gameSave(); renderBench(); }, (P()?.cash || 0) < nx.price));
    }
    const tabs = el('div', { className: 'tabs' });
    for (const [id, label] of [['guns', '🔫 GUNS'], ['mods', '🧩 ATTACHMENTS'], ['repair', '🔧 REPAIR & ARMOR'], ...(benchWhere === 'home' ? [['locker', '🗄️ LOCKER']] : [])]) {
      tabs.append(btn('tab' + (benchTab === id ? ' on' : ''), label, () => { benchTab = id; renderBench(); }));
    }
    if (benchWhere !== 'home' && benchTab === 'locker') benchTab = 'guns';
    benchP.append(tabs);
    const busy = act?.kind === 'craft';
    if (benchTab === 'guns') {
      const cards = el('div', { className: 'cards' });
      for (const w of W.WEAPONS) {
        const why = W.craftBlock(wst, w.id, ctx), owned = wst.owned.includes(w.id) && !wst.broken.includes(w.id);
        const card = el('div', { className: 'card' + (w.tier > lvl ? ' lock' : '') + (!why ? ' ready' : '') });
        const hd = el('div', { className: 'hd' }); const ic = gunIcon(w.id, 84, 34); if (ic) hd.append(ic);
        const nm = el('div'); nm.append(el('div', { className: 'nm' }, w.name), el('div', { className: 'tg' }, `${w.crude ? 'CRUDE' : w.cls.toUpperCase()} · ${w.tier ? 'LOCKUP LV ' + w.tier : 'HOME BENCH'} · SHOOTING ${w.level}`)); hd.append(nm); card.append(hd);
        card.append(el('div', { className: 'ds' }, w.desc));
        const st = el('div', { className: 'stats' });
        for (const [k, v] of [['DMG', w.pellets > 1 ? `${w.pellets}×${w.dmg}` : w.dmg], ['MAG', w.mag], ['RPM', Math.round(60000 / w.rate)], ['LASTS', w.dur]]) { const d = el('div'); d.append(el('b', {}, String(v)), document.createTextNode(k)); st.append(d); }
        card.append(st);
        const need = el('div', { className: 'need' }); for (const [k, n] of Object.entries(w.craft.mats)) need.append(chip(k, n, pool[k] || 0)); card.append(need);
        const row = el('div', { className: 'row' });
        row.append(el('span', { className: why ? 'why' : 'okc' }, why || `${Math.round(w.craft.seconds * mod('crafting.speed'))}s${owned ? ' · makes a SPARE' : ''} · worth ${money(w.value)}`));
        row.append(btn('go', 'CRAFT', () => startCraft({ where: benchWhere, gun: true, real: w.tier >= 1, label: w.name, seconds: w.craft.seconds, check: (c) => W.craftBlock(WS().state, w.id, c), run: (c) => WS().craft(w.id, c), done: (r) => r.spare ? `${w.icon} Crafted a spare ${w.name} · sell it at the arms buyer or keep it as backup` : `${w.icon} Crafted ${w.name}! It's in your hand.` }), !!why || busy));
        card.append(row); cards.append(card);
      }
      benchP.append(cards);
    } else if (benchTab === 'mods') {
      const owned = W.WEAPONS.filter((w) => wst.owned.includes(w.id));
      if (!owned.length) benchP.append(el('div', { className: 'sub' }, 'Craft a gun first.'));
      else {
        if (!owned.some((w) => w.id === modGun)) modGun = wst.equipped || owned[0].id;
        const pick = el('div', { className: 'tabs' }); for (const w of owned) pick.append(btn('tab' + (modGun === w.id ? ' on' : ''), `${w.icon} ${w.name}`, () => { modGun = w.id; renderBench(); })); benchP.append(pick);
        const cards = el('div', { className: 'cards' });
        for (const m of W.MODS) {
          const why = W.modBlock(wst, modGun, m.id, ctx), fitted = (wst.mods[modGun] || []).includes(m.id);
          const card = el('div', { className: 'card' + (fitted ? ' ready' : why && why !== 'Missing materials' ? ' lock' : '') });
          const hd = el('div', { className: 'hd' }); hd.append(el('div', { className: 'pi', style: 'font-size:22px' }, m.icon)); const nm = el('div'); nm.append(el('div', { className: 'nm' }, m.name), el('div', { className: 'tg' }, `${m.tier ? 'LOCKUP LV ' + m.tier : 'ANY BENCH'} · SHOOTING ${m.level}`)); hd.append(nm); card.append(hd);
          card.append(el('div', { className: 'ds' }, m.desc));
          const need = el('div', { className: 'need' }); for (const [k, n] of Object.entries(m.mats)) need.append(chip(k, n, pool[k] || 0)); card.append(need);
          const row = el('div', { className: 'row' }); row.append(el('span', { className: fitted ? 'okc' : why ? 'why' : 'okc' }, fitted ? 'FITTED ✓' : why || `${m.seconds}s`));
          if (!fitted) row.append(btn('go', 'CRAFT', () => { const gid = modGun; startCraft({ where: benchWhere, label: m.name, seconds: m.seconds, check: (c) => W.modBlock(WS().state, gid, m.id, c), run: (c) => WS().craftMod(gid, m.id, c), done: () => `${m.icon} ${m.name} fitted to your ${W.BY_ID[gid].name}` }); }, !!why || busy));
          card.append(row); cards.append(card);
        }
        benchP.append(cards);
      }
    } else if (benchTab === 'repair') {
      const cards = el('div', { className: 'cards' });
      { // armor plate (any bench)
        const PL = W.PLATE, armor = Math.ceil(wst.armor || 0), card = el('div', { className: 'card' });
        card.append(el('div', { className: 'nm' }, `🛡️ Armor plate · armor ${armor}/${PL.max}`), el('div', { className: 'ds' }, `Bolt a plate into your vest: +${PL.points} armor. Armor soaks 70% of each hit.`));
        const need = el('div', { className: 'need' }); for (const [k, n] of Object.entries(PL.mats)) need.append(chip(k, n, pool[k] || 0)); card.append(need);
        const why = armor >= PL.max ? 'Armor is full' : !S.has(pool, PL.mats) ? 'Missing materials' : '';
        const row = el('div', { className: 'row' }); row.append(el('span', { className: why ? 'why' : 'okc' }, why || `${PL.seconds}s`), btn('go', 'CRAFT', () => startCraft({ where: benchWhere, label: 'Armor plate', seconds: PL.seconds, check: (c) => ((WS().state.armor || 0) >= PL.max ? 'Armor is full' : c.have(PL.mats) ? '' : 'Missing materials'), run: (c) => { const r = W.buildPlate(WS().state, c); if (r.ok) { try { localStorage.setItem('nightshift-weapons-v1', JSON.stringify(WS().state)); } catch { /* best effort */ } } return r; }, done: (r) => `🛡️ Plate fitted · armor ${Math.round(r.armor)}` }), !!why || busy));
        card.append(row); cards.append(card);
      }
      for (const w of W.WEAPONS) {
        if (!wst.owned.includes(w.id)) continue;
        const card = ws.armoryCard(w.id, { compact: true }), cost = W.repairCost(wst, w.id, ws.durMul());
        const row = el('div', { className: 'row' });
        if (w.crude) row.append(el('span', { className: 'why' }, 'Crude: can\'t be repaired, craft a new one'));
        else if (!cost) row.append(el('span', { className: 'okc' }, 'Good as new'));
        else {
          const need = el('div', { className: 'need' }); for (const [k, n] of Object.entries(cost)) need.append(chip(k, n, pool[k] || 0)); card.append(need);
          const why = w.tier > lvl ? (lvl ? `Needs a level ${w.tier} workshop` : 'Repair it at your Lockup') : !S.has(pool, cost) ? 'Missing materials' : '';
          row.append(el('span', { className: why ? 'why' : 'okc' }, why || '15s'), btn('go', 'REPAIR', () => startCraft({ where: benchWhere, label: 'Repair ' + w.name, seconds: 15, check: (c) => (W.repairCost(WS().state, w.id, WS().durMul()) ? (w.tier > c.bench ? 'Needs a better workshop' : c.have(W.repairCost(WS().state, w.id, WS().durMul())) ? '' : 'Missing materials') : 'Nothing to repair'), run: (c) => WS().repair(w.id, c), done: () => `🔧 ${w.name} repaired` }), !!why || busy));
        }
        card.append(row); cards.append(card);
      }
      if (!cards.children.length) benchP.append(el('div', { className: 'sub' }, 'No guns yet.'));
      benchP.append(cards);
    } else if (benchTab === 'locker') {
      const used = S.weightOf(state.locker);
      benchP.append(el('div', { className: 'sub' }, `🗄️ Home locker ${used}/${S.LOCKER_CAP}. Crafting here uses your bag AND the locker. Stash materials to free up bag space for runs.`));
      const row = el('div', { className: 'row' });
      row.append(btn('alt', '⬇ STASH ALL', () => { for (const id of Object.keys(state.bag)) if (S.MATERIALS[id].kind !== 'product') S.store(state, id, state.bag[id]); persist(); gameSave(); renderBench(); }),
        btn('alt', '⬆ TAKE ALL GUN PARTS', () => { for (const id of Object.keys(state.locker)) if (['gun', 'part'].includes(S.MATERIALS[id].kind)) S.withdraw(state, id, state.locker[id]); persist(); gameSave(); renderBench(); }));
      benchP.append(row);
      const mats = el('div', { className: 'mats' });
      for (const id of S.IDS) {
        const b = state.bag[id] || 0, l = state.locker[id] || 0; if (!b && !l) continue;
        const c = el('div', { className: 'mat' }); const ic = matIcon(id, 24); if (ic) c.append(ic);
        const t = el('div'); t.append(el('b', {}, `${b} | ${l}`), el('span', {}, `${S.MATERIALS[id].name} · bag | locker`)); c.append(t);
        c.append(btn('alt', '⬇', () => { S.store(state, id, b); persist(); renderBench(); }, !b), btn('alt', '⬆', () => { S.withdraw(state, id, l); persist(); renderBench(); }, !l));
        mats.append(c);
      }
      benchP.append(mats);
    }
    renderBenchProgress();
    benchP.scrollTop = scroll;
  }

  // ---- shops & buyers ----
  let shopKind = null;
  function openShop(kind) { shopKind = kind; show(shopP); renderShop(); }
  function renderShop() {
    if (shopP.hidden) return;
    const p = P(), cash = p?.cash || 0, m = minute(), scroll = shopP.scrollTop;
    shopP.textContent = '';
    if (shopKind === 'hardware') {
      header(shopP, '🧰 HARDWARE COUNTER', `Cash ${money(cash)} · basic supplies, sold in packs.`); capBar(shopP);
      const cards = el('div', { className: 'mats' });
      for (const h of S.HARDWARE) {
        const mm = S.MATERIALS[h.id], c = el('div', { className: 'mat' }); const ic = matIcon(h.id, 26); if (ic) c.append(ic);
        const t = el('div'); t.append(el('b', {}, `${h.n}× ${mm.name}`), el('span', {}, `${money(mm.price * h.n)} · have ${state.bag[h.id] || 0}`)); c.append(t);
        c.append(btn('go', 'BUY', () => { const r = S.buy(state, P(), h.id, h.n, { counter: 'hardware' }); say(r.ok ? `${mm.icon} Bought ${h.n} ${mm.name}` : r.reason); persist(); gameSave(); renderShop(); }, cash < mm.price * h.n));
        cards.append(c);
      }
      shopP.append(cards);
    } else if (shopKind === 'bags') {
      header(shopP, '🎒 BAG SHOP', `Cash ${money(cash)} · more space = fewer trips.`); capBar(shopP);
      const cards = el('div', { className: 'cards' });
      S.BAGS.forEach((b, i) => {
        const c = el('div', { className: 'card' + (i <= state.bagLevel ? ' ready' : i > state.bagLevel + 1 ? ' lock' : '') });
        c.append(el('div', { className: 'nm' }, `${b.icon} ${b.name}`), el('div', { className: 'ds' }, `${b.cap} space`));
        const row = el('div', { className: 'row' }); row.append(el('span', { className: 'okc' }, i <= state.bagLevel ? (i === state.bagLevel ? 'WEARING' : 'OUTGROWN') : money(b.price)));
        if (i === state.bagLevel + 1) row.append(btn('go', 'BUY', () => { const r = S.buyBag(state, P(), i); say(r.ok ? `${b.icon} ${b.name} · ${b.cap} space` : r.reason); persist(); gameSave(); renderShop(); }, cash < b.price));
        c.append(row); cards.append(c);
      });
      shopP.append(cards);
    } else if (shopKind === 'lockup') {
      const lv = S.LOCKUP.levels[0];
      header(shopP, '🔧 LOCKUP FOR SALE', `A roll-door unit with power and a vice. Real guns (pistols, revolvers, pump shotguns) need it. Upgrades unlock SMGs, rifles and the AR.`);
      shopP.append(el('div', { className: 'sub' }, `Price ${money(lv.price)} · you have ${money(cash)}`));
      shopP.append(btn('go', `BUY THE LOCKUP · ${money(lv.price)}`, () => { const r = S.buyLockup(state, P()); say(r.ok ? '🔧 The Lockup is yours · USE it to craft real guns' : r.reason); persist(); gameSave(); if (r.ok) openBench('lockup'); else renderShop(); }, cash < lv.price));
    } else if (shopKind === 'promoter') {
      const open = S.openAt(S.PROMOTER.hours, m), left = S.promoterLeft(state), have = state.bag.pills || 0, price = Math.round(S.PROMOTER.price * mod('dealing.price'));
      header(shopP, '🎟️ PARTY PROMOTER', open ? `"Got any party favours?" Buys up to ${left} more pills right now at ${money(price)} each.` : `Only works the club line at night (${S.hoursText(S.PROMOTER.hours)}).`);
      shopP.append(el('div', { className: 'sub' }, `You have ${have} 💊`));
      for (const n of [1, 5, 99]) shopP.append(btn('go', n === 99 ? 'SELL ALL' : `SELL ${n}`, () => { const r = S.sellPills(state, P(), n, { minute: minute(), price: mod('dealing.price') }); if (r.ok) { xp({ dealing: 20 * r.n, charisma: 4 * r.n }, 'sale'); } say(r.ok ? `💊 Sold ${r.n} pills · +${money(r.cash)}` : r.reason); persist(); gameSave(); renderShop(); }, !open || !have || left <= 0));
      shopP.querySelectorAll('button.go').forEach((b) => { b.style.margin = '4px'; });
    } else if (shopKind === 'arms') {
      const open = S.openAt(S.ARMS_BUYER.hours, m), left = S.armsLeft(state), ws = WS(), wst = ws?.state, price = mod('dealing.price');
      header(shopP, '🚚 ARMS BUYER', open ? `"Clean pieces only." Takes ${left} more gun${left === 1 ? '' : 's'} tonight. Spares pay full value; used guns by condition.` : `Only here at night (${S.hoursText(S.ARMS_BUYER.hours)}).`);
      const cards = el('div', { className: 'cards' });
      for (const w of W.WEAPONS) {
        const spare = wst?.spare?.[w.id] || 0, owned = wst?.owned.includes(w.id);
        if (!spare && !owned) continue;
        const c = el('div', { className: 'card' }); const hd = el('div', { className: 'hd' }); const ic = gunIcon(w.id, 72, 30); if (ic) hd.append(ic); hd.append(el('div', { className: 'nm' }, w.name)); c.append(hd);
        const row = el('div', { className: 'row' });
        if (spare) row.append(btn('go', `SELL SPARE · ${money(w.value * price)} (${spare})`, () => sellGun(w.id, 'spare'), !open || left <= 0));
        if (owned) row.append(btn('alt', `SELL YOURS · ${money(W.usedValue(wst, w.id, ws.durMul()) * price)}`, () => { if (root.confirm?.(`Sell your ${w.name}${wst.equipped === w.id ? ' (in your hand)' : ''}?`)) sellGun(w.id, 'owned'); }, !open || left <= 0));
        c.append(row); cards.append(c);
      }
      if (!cards.children.length) shopP.append(el('div', { className: 'sub' }, 'Nothing to sell. Craft guns at a bench: crafting one you already own makes a spare.'));
      shopP.append(cards);
    }
    shopP.scrollTop = scroll;
  }
  function sellGun(id, kind) {
    if (S.armsLeft(state) <= 0) { say('The buyer has enough for tonight'); return; }
    const r = WS().sell(id, kind, mod('dealing.price'));
    if (r.ok) { S.armsSold(state, r.cash); xp({ dealing: 60, charisma: 10 }, 'sale'); persist(); gameSave(); say(`🚚 Sold ${W.BY_ID[id].name} · +${money(r.cash)}`); } else say(r.reason);
    renderShop();
  }

  // ---- home workbench (inside the apartment) ----
  const BENCH_POS = { x: 574, y: 236 }; // room coords (640×420 room); drawn by supply-art.js
  let roomPos = null;
  function installHome() {
    const HM = root.NightshiftHome, SP = root.NightshiftSprites, I = root.NightshiftInteriors;
    if (SP && !SP.__supplyPos && typeof SP.person === 'function') { const person = SP.person; SP.person = function (pos, isPlayer, opts) { if (opts && opts.weapon === false && isPlayer) roomPos = pos; return person.apply(this, arguments); }; SP.__supplyPos = true; }
    if (I && !I.__supply && typeof I.draw === 'function') { const draw = I.draw; I.draw = function (kind, ctx) { const r = draw.apply(this, arguments); if (kind === 'home') { try { ART()?.drawBench?.(ctx, BENCH_POS, performance.now() / 1000); } catch { /* cosmetic */ } } return r; }; I.__supply = true; }
    if (HM && !HM.__supply && typeof HM.interaction === 'function' && typeof HM.use === 'function') {
      const interaction = HM.interaction, use = HM.use;
      HM.interaction = function () {
        const t = interaction.apply(this, arguments);
        if (!roomPos || !home()) return t;
        const d = Math.hypot(roomPos.x - BENCH_POS.x, roomPos.y - BENCH_POS.y);
        if (d < 82 && (!t || !Number.isFinite(t.x) || d < Math.hypot(roomPos.x - t.x, roomPos.y - t.y))) return { kind: 'bench', action: 'CRAFT', label: 'Workbench', x: BENCH_POS.x, y: BENCH_POS.y };
        return t;
      };
      HM.use = function () { const t = home() ? HM.interaction() : null; if (t?.kind === 'bench') { openBench('home'); return true; } return use.apply(this, arguments); };
      HM.__supply = true;
    }
  }
  installHome();
  const hi = setInterval(() => { installHome(); if (root.NightshiftHome?.__supply && root.NightshiftInteriors?.__supply && root.NightshiftSprites?.__supplyPos) clearInterval(hi); }, 800);

  function refresh() { renderBag(); renderBench(); renderShop(); }
  root.NightshiftSupply = Object.freeze({ get state() { return state; }, openBag, openBench, openShop, gpsTo, buy, count, space, refresh, matIcon, gunIcon, sites, useSite, newLife,
    activity: () => (act ? { kind: act.kind, site: act.site, done: act.done } : null), stop: () => stop(), save: () => persist(), BENCH_POS,
    paused: () => !bagP.hidden || !benchP.hidden || !shopP.hidden });
})(typeof globalThis !== 'undefined' ? globalThis : this);
