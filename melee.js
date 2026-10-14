/* Melee & close combat in game (Claude-owned, v0.64). Requires melee-data.js (rules) and gangs.js (stun/strike API).
 *  - 👊 button (on the action bar): tap = swing, hold = switch weapon. With no working gun, the AIM/FIRE stick swings too.
 *  - Soft lock: a swing turns you toward the closest target in reach, so it plays well on a phone.
 *  - Combos (fists 3 hits, bat 2...), the last hit is a finisher with big knockback and a stagger.
 *  - Takedowns: hit someone from behind who isn't fighting yet -> instant knockout. Knife takedowns are quiet.
 *  - ⤳ ROLL button: a dodge roll with an invulnerable window (bullets and punches miss) and a short cooldown.
 *  - Weapons: buy at the gun shop's TOOLS counter (Dex), find drops from downed gang members, earn them in the story.
 *  - Every hit/KO/takedown/roll is announced on the shared event bus (window 'ns:event') for story/multiplayer.
 * Save: nightshift-melee-v1. API: NightshiftMelee.{state, swing, roll, rolling, incoming, dropFrom, give, open, close, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const D = root.NightshiftMeleeData; if (!D) return;
  const KEY = 'nightshift-melee-v1';
  let state = D.clean({}); try { state = D.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private */ } };
  const st = { swings: 0, hits: 0, takedowns: 0, rolls: 0, dodged: 0 };
  const combo = { step: 0, last: 0, weapon: 'fists' };
  const emit = (detail) => { try { root.dispatchEvent(new CustomEvent('ns:event', { detail })); } catch { /* n/a */ } };
  const P = () => { try { return player; } catch { return null; } }; // eslint-disable-line no-undef
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const level = (k) => { try { return root.NightshiftSkills?.level?.(k) || 0; } catch { return 0; } };
  const isBlocked = (x, y) => { try { return blocked(x, y); } catch { return false; } }; // eslint-disable-line no-undef
  const paused = () => { try { return !!(root.NightshiftRPG?.paused?.() || root.NightshiftHome?.paused?.() || root.NightshiftInterface?.expanded?.()); } catch { return false; } };
  const hasGun = () => { try { return (root.NightshiftInventory?.state?.pocket?.pistol || 0) > 0; } catch { return false; } };

  // ---------- targets ----------
  function targets() {
    const out = [];
    try { for (const p of peds) if (p.hp > 0) out.push({ e: p, kind: 'ped' }); } catch { /* n/a */ } // eslint-disable-line no-undef
    try { for (const o of root.NightshiftCrime?.officers || []) out.push({ e: o, kind: 'cop' }); } catch { /* n/a */ }
    try { for (const u of root.NightshiftGangs?.members?.() || []) out.push({ e: u, kind: 'gang' }); } catch { /* n/a */ }
    try { for (const a of root.NightshiftNpcLife?.actors?.() || []) out.push({ e: a, kind: 'npc' }); } catch { /* n/a */ }
    return out;
  }
  function knock(e, dx, dy) { const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4)); for (let i = 0; i < n; i++) { const nx = e.x + dx / n, ny = e.y + dy / n; if (!isBlocked(nx, e.y)) e.x = nx; if (!isBlocked(e.x, ny)) e.y = ny; } }
  function apply(t, dmg, w, opts) { root.__nsAuthorityHit = true; try { return apply0(t, dmg, w, opts); } finally { root.__nsAuthorityHit = false; } }
  function apply0(t, dmg, w, opts) {
    const p = P(), e = t.e, d = Math.max(1, dist(e, p)), kx = (e.x - p.x) / d, ky = (e.y - p.y) / d, kb = opts.finisher ? w.knock * 1.8 : w.knock, stun = opts.finisher ? w.stun * 1.6 : w.stun;
    const now = performance.now();
    try { root.NightshiftFeedback?.burst?.(e.x, e.y - 6, 'hit', Math.atan2(ky, kx)); root.NightshiftFeedback?.floating?.(e.x, e.y - 30, opts.takedown ? 'TAKEDOWN' : '−' + dmg, opts.takedown ? '#ff7ad8' : opts.finisher ? '#ffd970' : '#f9a589'); root.NightshiftFeedback?.hit?.(); root.NightshiftAudio?.play?.('impact'); } catch { /* n/a */ }
    let ko = false;
    if (t.kind === 'gang') { root.NightshiftGangs?.strike?.(e, dmg, { melee: true, knock: kb, stun, silent: opts.takedown && w.quiet }); ko = e.hp <= 0; }
    else if (t.kind === 'cop') { const C = root.NightshiftCrime; e.hp -= Math.max(0, dmg - 20); knock(e, kx * kb, ky * kb); e.nextAttack = Math.max(e.nextAttack || 0, now + stun); try { C?.strike?.(e); } catch { /* n/a */ } ko = e.hp <= 0; }
    else if (t.kind === 'npc') { try { root.NightshiftNpcLife?.hit?.(e, dmg); } catch { /* n/a */ } knock(e, kx * kb, ky * kb); ko = e.hp <= 0; }
    else {
      try { root.NightshiftCrews?.incident?.(e, 'violence'); } catch { /* n/a */ }
      e.hp -= dmg; knock(e, kx * kb, ky * kb); e.mode = 'flee'; e.routineInterrupted = true;
      try { root.NightshiftCitizens?.alert?.(p, now, { kind: 'fight', radius: opts.takedown && w.quiet ? 40 : 140 }); } catch { /* n/a */ }
      if (e.hp <= 0) {
        ko = true;
        try { const L = loot, PD = peds; L.push({ x: e.x, y: e.y, value: root.NightshiftCrime?.killed?.(e) ?? Math.floor(15 + Math.random() * 50) }); PD.splice(PD.indexOf(e), 1); } catch { /* n/a */ } // eslint-disable-line no-undef
      }
      try { if (!(opts.takedown && w.quiet)) p.heat = Math.min(5, (p.heat || 0) + (ko ? 0.45 : 0.1)); } catch { /* n/a */ }
    }
    st.hits++; if (ko) { state.kos++; }
    emit({ type: opts.takedown ? 'takedown' : 'melee', target: t.kind, ko, weapon: w.id, dmg, x: e.x, y: e.y, gang: e.gang?.id || null, tag: e.tag || null, boss: !!e.boss });
  }
  // ---------- swing ----------
  const fx = { swings: [], dust: [], drops: [] };
  function swing(now = performance.now()) {
    const p = P(); if (!p || p.hp <= 0 || p.car || paused() || p.downed || root.NightshiftAuthority?.stunned?.()) return false;
    try { if (root.NightshiftSafeZones?.protected?.(p)) return false; } catch { /* n/a */ }
    if (rollState) return false;
    const w = D.W(state.equipped); if (!D.ready(combo, w.id, now)) return false;
    const T = targets();
    // soft lock: face the closest target in reach (+20)
    let best = null, bd = 1e9; for (const t of T) { const d = dist(t.e, p); if (d < w.reach + 26 && d < bd) { bd = d; best = t; } }
    if (best) p.angle = Math.atan2(best.e.y - p.y, best.e.x - p.x);
    const td = T.find((t) => (t.kind === 'gang' || t.kind === 'ped' || t.kind === 'cop' || t.kind === 'npc') && D.takedown(p, t.e, w.id));
    const s = D.swing(combo, w.id, now); st.swings++;
    fx.swings.push({ x: p.x, y: p.y, a: p.angle, w, t0: now, fin: s.finisher });
    let hits = 0;
    if (td) { apply(td, Math.max(td.e.hp || 40, 40) + 5, w, { takedown: true, finisher: true }); state.takedowns++; st.takedowns++; hits = 1; try { root.NightshiftSkills?.gain?.('stealth', 12, 'takedown'); } catch { /* n/a */ } }
    else {
      const max = w.id === 'bat' ? 3 : s.finisher ? 2 : 1; // the bat sweeps a crowd
      const hitList = T.filter((t) => D.hit(p, t.e, w.id, t.e.inCover ? 9 : 12)).sort((a, b) => dist(a.e, p) - dist(b.e, p)).slice(0, max);
      for (const t of hitList) apply(t, D.damage(w.id, s.step, level('toughness')), w, { finisher: s.finisher });
      hits = hitList.length;
    }
    if (hits) { try { root.NightshiftSkills?.gain?.('toughness', s.finisher ? 4 : 2, 'brawling'); } catch { /* n/a */ } persist(); }
    else { try { root.NightshiftAudio?.play?.('reload'); } catch { /* n/a */ } }
    return true;
  }
  // ---------- roll ----------
  let rollState = null, rollReady = 0, iframesUntil = 0;
  function roll(now = performance.now()) {
    const p = P(); if (!p || p.hp <= 0 || p.car || paused() || rollState || now < rollReady || p.downed || root.NightshiftAuthority?.stunned?.()) return false;
    let a = p.angle; try { const ma = p.moving && Number.isFinite(p.moveAngle) ? p.moveAngle : null; if (ma !== null) a = ma; } catch { /* n/a */ }
    rollState = { t0: now, from: { x: p.x, y: p.y }, a, done: 0 }; rollReady = now + D.ROLL.cool; iframesUntil = now + D.ROLL.iframes; st.rolls++;
    emit({ type: 'roll' });
    return true;
  }
  function rollTick(now) {
    const p = P(); if (!rollState || !p) return;
    const t = (now - rollState.t0) / D.ROLL.ms, f = D.rollAt(t), want = f * D.ROLL.dist, step = want - rollState.done;
    if (step > 0) { const n = Math.max(1, Math.ceil(step / 3)); for (let i = 0; i < n; i++) { const nx = p.x + Math.cos(rollState.a) * step / n, ny = p.y + Math.sin(rollState.a) * step / n; if (!isBlocked(nx, p.y)) p.x = nx; if (!isBlocked(p.x, ny)) p.y = ny; } rollState.done = want; }
    p.squat = t < 0.85; p.moving = true; p.walkTicks = (p.walkTicks || 0) + 2;
    if (Math.random() < 0.6) fx.dust.push({ x: p.x - Math.cos(rollState.a) * 8, y: p.y + 6, r: 3 + Math.random() * 3, life: 0.45 });
    if (t >= 1) { rollState = null; p.squat = false; }
  }
  const rolling = () => performance.now() < iframesUntil;
  // called by enemies before they deal melee damage; false = dodged
  function incoming(u, dmg) {
    const p = P(); if (!p) return true;
    if (rolling()) { st.dodged++; try { root.NightshiftFeedback?.floating?.(p.x, p.y - 30, 'DODGE', '#9fe0ff'); } catch { /* n/a */ } return false; }
    try { const d = Math.max(1, dist(p, u)); knock(p, (p.x - u.x) / d * 6, (p.y - u.y) / d * 6); } catch { /* n/a */ }
    void dmg; return true;
  }
  // ---------- drops ----------
  function dropFrom(u) {
    const id = D.drop(Math.random()); if (!id) return;
    fx.drops.push({ x: u.x + 6, y: u.y + 4, id, until: performance.now() + 90000 });
    if (fx.drops.length > 12) fx.drops.shift();
  }
  function dropsTick(now) {
    const p = P(); if (!p || p.car) return;
    for (let i = fx.drops.length - 1; i >= 0; i--) {
      const d = fx.drops[i]; if (now > d.until) { fx.drops.splice(i, 1); continue; }
      if (dist(d, p) < 20) {
        fx.drops.splice(i, 1); const w = D.WEAPONS[d.id];
        if (D.give(state, d.id)) { state.equipped = d.id; persist(); say(`${w.icon} Picked up a ${w.name} · hold 👊 to switch weapons`); emit({ type: 'pickup', item: d.id }); }
        else { try { p.cash += 25; } catch { /* n/a */ } say(`${w.icon} Already had one · sold it for $25`); }
        refreshButton();
      }
    }
  }
  function give(id, quiet) { const ok = D.give(state, id); if (ok) { state.equipped = id; persist(); refreshButton(); if (!quiet) say(`${D.WEAPONS[id].icon} New weapon: ${D.WEAPONS[id].name}`); } return ok; }

  // ---------- drawing (world space, inside NightshiftCrime.draw) ----------
  function shape(ctx, w, len) {
    if (w.id === 'bat') { ctx.fillStyle = '#c99a5a'; ctx.beginPath(); ctx.moveTo(6, -1.2); ctx.lineTo(len, -3.2); ctx.lineTo(len, 3.2); ctx.lineTo(6, 1.2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1d2024'; ctx.fillRect(4, -1.3, 5, 2.6); }
    else if (w.id === 'knife' || w.id === 'machete') { ctx.fillStyle = '#1d2024'; ctx.fillRect(4, -1.4, 6, 2.8); ctx.fillStyle = '#dfe6ec'; ctx.beginPath(); ctx.moveTo(10, -1.6); ctx.lineTo(len, -0.4); ctx.lineTo(10, 1.6); ctx.closePath(); ctx.fill(); }
    else if (w.id === 'wrench') { ctx.fillStyle = '#9aa3ab'; ctx.fillRect(4, -1.3, len - 8, 2.6); ctx.fillStyle = '#c84659'; ctx.fillRect(4, -1.6, 6, 3.2); ctx.fillStyle = '#9aa3ab'; ctx.fillRect(len - 6, -4, 5, 8); }
    else { ctx.fillStyle = w.id === 'brass' ? '#e2c24a' : '#e8b48a'; ctx.beginPath(); ctx.arc(12, 0, 3.6, 0, Math.PI * 2); ctx.fill(); }
  }
  function draw() {
    let ctx = null; try { ctx = g; } catch { return; } // eslint-disable-line no-undef
    const now = performance.now(), p = P(); if (!ctx || !p) return;
    ctx.save();
    for (let i = fx.dust.length - 1; i >= 0; i--) { const d = fx.dust[i]; d.life -= 1 / 60; d.r += 0.25; if (d.life <= 0) { fx.dust.splice(i, 1); continue; } ctx.globalAlpha = d.life * 0.6; ctx.fillStyle = '#b6a392'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (let i = fx.swings.length - 1; i >= 0; i--) {
      const s = fx.swings[i], t = (now - s.t0) / 170; if (t > 1) { fx.swings.splice(i, 1); continue; }
      const half = s.w.arc / 2, a0 = s.a - half, a = a0 + s.w.arc * Math.min(1, t * 1.3), r = s.w.reach;
      ctx.strokeStyle = s.fin ? 'rgba(255,217,112,' + (0.8 * (1 - t)) + ')' : 'rgba(255,255,255,' + (0.55 * (1 - t)) + ')'; ctx.lineWidth = s.fin ? 4 : 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y - 8, r * 0.9, a0, a); ctx.stroke();
      ctx.save(); ctx.translate(p.x, p.y - 8); ctx.rotate(a); shape(ctx, s.w, s.w.id === 'fists' || s.w.id === 'brass' ? 14 : r * 0.85); ctx.restore();
    }
    for (const d of fx.drops) { if (Math.abs(d.x - p.x) > 700 || Math.abs(d.y - p.y) > 500) continue; const w = D.WEAPONS[d.id], bob = Math.sin(now / 300 + d.x) * 1.5; ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 4, 8, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.save(); ctx.translate(d.x - 10, d.y + bob); ctx.rotate(-0.5); shape(ctx, w, 24); ctx.restore(); ctx.font = '700 8px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff1c4'; ctx.fillText(w.name.toUpperCase(), d.x, d.y - 12 + bob); }
    if (rollState) { ctx.strokeStyle = 'rgba(159,224,255,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y - 8, 15, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }

  // ---------- buttons ----------
  const css = document.createElement('style');
  css.textContent = `#actions>button#melee:not([hidden]),#actions>button#roll:not([hidden]){display:block!important}
  #actions>button#melee{font-size:20px!important;position:relative} #actions>button#melee small{position:absolute;left:0;right:0;bottom:3px;font:700 8px ui-monospace,Menlo,monospace;color:#c9d6e0}
  #actions>button#roll{font-size:9px!important;letter-spacing:.04em}
  #actions>button#roll[data-cool="true"]{opacity:.45}
  #actions.expanded>button:is(#melee,#roll),body[data-driving="true"] #actions>button:is(#melee,#roll){display:none!important}
  #mlPanel{position:fixed;inset:8% 10%;z-index:46;overflow:auto;background:#0f1830f5;border:1px solid #6f8db3;border-radius:14px;padding:12px 14px;color:#e8eff7;font:13px ui-monospace,Menlo,monospace}
  #mlPanel[hidden]{display:none} #mlPanel h2{margin:0 0 4px;font-size:16px} #mlPanel .sub{font-size:11.5px;color:#b9c8da;margin-bottom:8px}
  #mlPanel .row{display:flex;gap:8px;align-items:center;background:#16233d;border:1px solid #2f4669;border-radius:9px;padding:7px 9px;margin-bottom:6px} #mlPanel .row div{flex:1} #mlPanel .row small{display:block;color:#b9c8da;font-size:11px}
  #mlPanel button{all:unset;box-sizing:border-box;cursor:pointer;font:700 12px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:8px;padding:6px 10px} #mlPanel button[disabled]{opacity:.4;cursor:default} #mlPanel .x{float:right}`;
  document.head.appendChild(css);
  const mk = (id, label, aria) => { const b = document.createElement('button'); b.id = id; b.type = 'button'; b.setAttribute('aria-label', aria); b.innerHTML = label; return b; };
  const mBtn = mk('melee', '👊<small>MELEE</small>', 'Melee attack (hold to switch weapon)'), rBtn = mk('roll', 'ROLL', 'Dodge roll');
  function mountButtons() {
    const A = document.querySelector('#actions'), r = document.querySelector('#reload'); if (!A) return false;
    if (!mBtn.isConnected) A.insertBefore(mBtn, r || A.firstChild);
    if (!rBtn.isConnected) A.insertBefore(rBtn, mBtn);
    return true;
  }
  function refreshButton() { const w = D.W(state.equipped); mBtn.innerHTML = `${w.icon}<small>${w.id === 'fists' ? 'MELEE' : w.name.split(' ').pop().toUpperCase().slice(0, 7)}</small>`; }
  let holdT = null, held = false;
  mBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); held = false; clearTimeout(holdT); holdT = setTimeout(() => { held = true; if (state.owned.length > 1) { const w = D.cycle(state); persist(); refreshButton(); say(`${w.icon} ${w.name} · ${w.desc}`); } else say('👊 Only fists for now · buy weapons at the gun shop TOOLS counter or take them off gang members'); }, 450); });
  mBtn.addEventListener('pointerup', (e) => { e.preventDefault(); clearTimeout(holdT); if (!held) swing(); });
  mBtn.addEventListener('pointercancel', () => clearTimeout(holdT));
  mBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  rBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); roll(); });
  document.addEventListener('keydown', (e) => { if (e.target instanceof HTMLInputElement) return; if (e.key === 'f' || e.key === 'F') swing(); if (e.key === 'Shift' && e.location === 1 && !e.repeat) { /* run key stays run */ } if (e.key === 'c' || e.key === 'C') roll(); if (e.key === 'Escape' && !panel.hidden) close(); });

  // ---------- TOOLS counter at the gun shop ----------
  const panel = Object.assign(document.createElement('section'), { id: 'mlPanel', hidden: true }); document.body.appendChild(panel);
  const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); for (const k of kids) n.append(k); return n; };
  function open() {
    const p = P(); if (!p) return;
    panel.replaceChildren(el('button', { className: 'x', textContent: 'LEAVE', onclick: close }), el('h2', { textContent: '🔧 TOOLS COUNTER · Dex' }), el('div', { className: 'sub', textContent: `Cash $${p.cash}. Tap 👊 to swing, hold it to switch. Hit people from behind before they notice you for a takedown. ROLL dodges bullets and punches. Toughness (gym) makes every hit harder.` }));
    for (const id of D.ORDER) {
      const w = D.WEAPONS[id], own = state.owned.includes(id), eq = state.equipped === id;
      const btn = el('button', { textContent: own ? (eq ? 'EQUIPPED' : 'EQUIP') : '$' + w.price, disabled: eq || (!own && p.cash < w.price) || (!own && !w.price), onclick: () => { if (own) { state.equipped = id; persist(); refreshButton(); open(); return; } const r = D.buy(state, id, p); say(r.ok ? `${w.icon} Bought a ${w.name}` : r.reason); persist(); refreshButton(); try { save(); } catch { /* n/a */ } open(); } }); // eslint-disable-line no-undef
      panel.append(el('div', { className: 'row' }, el('div', {}, document.createTextNode(`${w.icon} ${w.name}`), el('small', { textContent: `${w.dmg[0]}-${w.dmg[1]} dmg · reach ${w.reach} · ${w.combo}-hit combo · ${w.desc}` })), btn));
    }
    panel.append(el('div', { className: 'sub', textContent: `Takedowns: ${state.takedowns} · knockouts: ${state.kos}` }));
    panel.hidden = false;
  }
  function close() { panel.hidden = true; }
  function toolsSite() { try { const s = root.NightshiftEncounters?.locations?.().find?.((l) => l.id === 'gunshop'); if (s) return { x: s.x + 58, y: s.y }; } catch { /* n/a */ } return null; }
  let toolsCache = null, toolsAt = 0;

  // ---------- loop + hooks ----------
  let wasFire = false;
  function loop(now) {
    try {
      mountButtons();
      const p = P();
      if (p) {
        document.body.dataset.driving = p.car ? 'true' : 'false';
        rBtn.dataset.cool = now < rollReady ? 'true' : 'false';
        rollTick(now); dropsTick(now);
        // no working gun: the aim/fire stick and FIRE button swing instead
        let fireIntent = false; try { fireIntent = !!(firing || mouseFire || keys[' '] || (aimPointer !== null && aimFire && root.NightshiftTouchLayout?.state?.autoFire)); } catch { /* n/a */ } // eslint-disable-line no-undef
        if (fireIntent && !hasGun() && !p.car) swing(now);
        wasFire = fireIntent;
      }
    } catch (e) { console.error(e); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop); refreshButton();
  const hook = setInterval(() => {
    const C = root.NightshiftCrime, R = root.NightshiftRecovery, E = root.NightshiftEncounters;
    if (C && typeof C.draw === 'function' && !C.__melee) { const d0 = C.draw; C.draw = function () { const r = d0.apply(this, arguments); try { draw(); } catch { /* cosmetic */ } return r; }; C.__melee = true; }
    if (R && typeof R.damage === 'function' && !R.__melee) { const d0 = R.damage; R.damage = function (amount, now) { if (rolling()) { st.dodged++; return; } return d0.apply(this, arguments); }; R.__melee = true; }
    if (E && typeof E.locations === 'function' && !E.__melee) {
      const locs = E.locations, use = E.use;
      E.locations = function () { const list = locs.apply(this, arguments) || []; const now = performance.now(); if (!toolsCache || now - toolsAt > 5000) { toolsAt = now; const s = list.find((l) => l.id === 'gunshop'); toolsCache = s ? { x: s.x + 58, y: s.y } : toolsCache; } return toolsCache ? [...list, { id: 'melee-tools', type: 'shop', x: toolsCache.x, y: toolsCache.y, ready: true, color: '#9fe0ff', label: '🔧 TOOLS', action: 'TOOLS', hint: 'Bats, knives, knuckles · melee weapons' }] : list; };
      E.use = function (id) { if (id === 'melee-tools') { open(); return true; } return use.apply(this, arguments); };
      E.__melee = true;
    }
    if (C?.__melee && R?.__melee && E?.__melee) clearInterval(hook);
  }, 300);
  void toolsSite; void wasFire;
  root.NightshiftMelee = Object.freeze({ get state() { return state; }, swing, roll, rolling, incoming, dropFrom, give, open, close, paused: () => !panel.hidden, stats: () => ({ ...st, drops: fx.drops.length, equipped: state.equipped }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
