/* Local combat authority (Claude-owned, v0.65). Requires combat-core.js.
 * Every hit in the city goes through here, so there is one place that decides damage — today it runs in the
 * browser; in multiplayer the same calls become messages to the server, which runs combat-core.js and answers.
 *  - Player bullets (game.js delegates its hit branch to bulletHit): weapon damage with distance falloff, cover,
 *    sneak bonus on unaware gang members, armor (SWAT, bosses) and penetration, then the right side effects per
 *    target (civilian incident + loot, police strike + heat, gang provoke, scripted NPCs).
 *  - Damage to the player arrives through NightshiftRecovery.damage(amount, now, src): src gives the direction
 *    (red damage indicators) and the kind (bullet / melee / taser).
 *  - DOWNED instead of instant death (city only, on foot): you bleed out over 20 s, crawl, can still fire your gun
 *    (last stand). Get up with a medkit (hold 💉 GET UP), or a crew member/guard next to you picks you up.
 *    Police reaching a downed suspect cuff them (BUSTED) instead of killing. More damage while down = faster bleed.
 *  - Taser hits stun (no moving or shooting for a moment) — cops then try to cuff you.
 *  - Suppression: your rounds snapping past gang members/cops make them duck for cover and shoot worse.
 *  - Every hit becomes a hitEvent (combat-core schema) in a ring log with a sequence number + 'ns:event'.
 * API: NightshiftAuthority.{bulletHit, damagePlayer, revive, downed, stunned, log, stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const K = root.NightshiftCombatCore; if (!K) return;
  const R = K.RULES;
  const P = () => { try { return player; } catch { return null; } }; // eslint-disable-line no-undef
  const st = { hits: 0, playerHits: 0, downs: 0, revives: 0, bleedouts: 0, stuns: 0, suppress: 0 };
  const log = []; let seq = 0;
  const emit = (detail) => { try { root.dispatchEvent(new CustomEvent('ns:event', { detail })); } catch { /* n/a */ } };
  const m = (k) => { try { return root.NightshiftSkills?.mod?.(k) ?? 1; } catch { return 1; } };
  function record(o) { const ev = K.hitEvent({ ...o, seq: ++seq, t: performance.now() }); log.push(ev); if (log.length > 200) log.shift(); st.hits++; emit({ type: 'hit', ev }); return ev; }
  const zoneOn = () => { try { return !!(root.NightshiftZones?.active?.() || root.NightshiftHome?.kind?.()); } catch { return false; } };

  // ---------- player bullets in the city ----------
  function weaponNow() { let w = null; try { w = root.NightshiftWeapons?.current?.(); } catch { /* n/a */ } return K.normalize(w || { dmg: 20, cls: 'pistol' }); }
  function kindOf(t) {
    try { if (root.NightshiftCrime?.officers?.includes(t)) return 'cop'; } catch { /* n/a */ }
    if (t.gang && root.NightshiftGangs) return 'gang';
    if (t.scripted && root.NightshiftNpcLife) return 'npc';
    return 'ped';
  }
  function bulletHit(t, b, start) {
    const p = P(); if (!t || !p) return false;
    const w = weaponNow(), ox = Number.isFinite(b.ox) ? b.ox : start?.x ?? p.x, oy = Number.isFinite(b.oy) ? b.oy : start?.y ?? p.y, d = Math.hypot(t.x - ox, t.y - oy), kind = kindOf(t);
    const aware = kind === 'gang' ? (t.mode === 'fight' || !!t.alert || !!t.squad) : true;
    const res = K.resolve({ weapon: w, dist: d, target: { armor: t.armor || 0, stance: t.inCover ? 'cover' : 'stand', aware }, mult: m('shooting.damage') });
    const dmg = Math.max(1, Math.round(res.hp)); if (res.armor) t.armor = Math.max(0, (t.armor || 0) - res.armor);
    const F = root.NightshiftFeedback, now = performance.now();
    try { F?.hit?.(); F?.burst?.(t.x, t.y, res.armor > res.hp ? 'wall' : 'hit'); F?.floating?.(t.x, t.y - 25, (res.armor >= 1 ? '🛡️' : '') + '−' + dmg, aware ? '#f9a589' : '#9fd0ff'); } catch { /* n/a */ }
    try { root.NightshiftSkills?.gain?.('shooting', root.NightshiftSkillsData?.XP?.hit ?? 5, 'hit'); } catch { /* n/a */ }
    root.__nsAuthorityHit = true;
    try {
      if (kind === 'cop') { t.hp -= dmg - 20; root.NightshiftCrime.strike(t); if (t.hp <= 0) emit({ type: 'officer-down', x: t.x, y: t.y }); }
      else if (kind === 'gang') root.NightshiftGangs.hit(t, dmg);
      else if (kind === 'npc') root.NightshiftNpcLife.hit(t, dmg);
      else {
        try { root.NightshiftCrews?.incident?.(t, 'violence'); } catch { /* n/a */ }
        t.hp -= dmg;
        if (t.hp <= 0) { try { const L = loot, PD = peds; L.push({ x: t.x, y: t.y, value: root.NightshiftCrime?.killed?.(t) ?? Math.floor(15 + Math.random() * 65) }); const i = PD.indexOf(t); if (i >= 0) PD.splice(i, 1); p.heat = Math.min(5, p.heat + 0.5); save(); } catch { /* n/a */ } } // eslint-disable-line no-undef
      }
    } finally { root.__nsAuthorityHit = false; }
    record({ src: 'player', dst: t.id || kind, weapon: w.id, kind: 'bullet', seed: b.seed || 0, from: { x: ox, y: oy }, to: { x: t.x, y: t.y }, hp: dmg, armor: res.armor, result: (t.hp ?? 1) <= 0 ? 'killed' : 'hurt' });
    void now; return true;
  }

  // ---------- player life state ----------
  let downed = null, dying = false, stunUntil = 0, revive = null; // revive: { t0, by, ms }
  const indicators = [];
  function canDown(p) { if (p.car || zoneOn()) return false; try { if (root.NightshiftSafeZones?.protected?.(p)) return false; } catch { /* n/a */ } return true; }
  function enterDown(now) {
    const p = P(); downed = { at: now, until: now + R.bleedMs }; p.hp = 1; p.downed = downed; st.downs++;
    try { root.NightshiftMelee && (P().squat = true); } catch { /* n/a */ }
    say(`🩸 You're down · ${hasMedkit() ? 'hold 💉 GET UP to patch yourself' : 'crawl to cover · a crew member can pick you up'} · cops will cuff you`);
    emit({ type: 'downed', who: 'player', x: p.x, y: p.y });
    record({ src: lastSrc?.team || 'world', dst: 'player', kind: 'bullet', from: lastSrc || p, to: p, result: 'downed' });
  }
  function bleedOut() { const p = P(); downed = null; p.downed = null; p.squat = false; dying = true; p.hp = 0; st.bleedouts++; emit({ type: 'killed', who: 'player' }); try { root.NightshiftRecovery?.tick?.(performance.now()); } catch { /* n/a */ } }
  function standUp(by, hp = R.reviveHp) { const p = P(); if (!downed || !p) return false; downed = null; p.downed = null; p.squat = false; p.hp = Math.max(p.hp, hp); revive = null; st.revives++; say(by === 'medkit' ? '💉 Patched up · back on your feet' : `🤝 ${by} got you back up`); emit({ type: 'revived', who: 'player', by }); return true; }
  const hasMedkit = () => { try { return (root.NightshiftInventory?.state?.pocket?.medkit || 0) > 0; } catch { return false; } };
  let lastSrc = null;
  function onPlayerDamage(amount, now, src) {
    const p = P(); if (!p) return 'pass';
    if (src && Number.isFinite(src.x)) { const pos = zoneOn() ? (root.NightshiftZones?.pos?.() || p) : p; indicators.push({ a: Math.atan2(src.y - pos.y, src.x - pos.x), t: now, kind: src.kind || 'bullet' }); if (indicators.length > 8) indicators.shift(); lastSrc = src; }
    if (src?.kind === 'taser') { stunUntil = now + 1400; st.stuns++; try { root.NightshiftFeedback?.floating?.(p.x, p.y - 34, '⚡ TASED', '#9fe0ff'); } catch { /* n/a */ } emit({ type: 'stunned', who: 'player' }); }
    st.playerHits++;
    if (downed) { downed.until -= amount * R.downedDmgMs; try { root.NightshiftFeedback?.burst?.(p.x, p.y, 'hit'); } catch { /* n/a */ } return 'absorbed'; }
    return 'pass';
  }
  function tick(now) {
    const p = P(); if (!p) return;
    // death from the game's own recovery flow: catch the first frame at 0 hp and go down instead
    if (p.hp <= 0 && !downed && !dying) { if (canDown(p)) enterDown(now); else dying = true; }
    if (p.hp > 1 && dying) dying = false;
    if (downed) {
      p.hp = 1; p.downed = downed; p.squat = true;
      if (now >= downed.until) { bleedOut(); return; }
      // allies (your guards / crew squads) pick you up
      let ally = null; try { ally = (root.NightshiftGangs?.units?.() || []).find((u) => u.team === 'you' && u.hp > 0 && Math.hypot(u.x - p.x, u.y - p.y) < 70); } catch { /* n/a */ }
      if (ally) { if (!revive || revive.by !== 'ally') revive = { t0: now, by: 'ally', ms: R.reviveMs * 1.3 }; if (now - revive.t0 >= revive.ms) standUp('Your crew'); }
      else if (revive?.by === 'ally') revive = null;
      if (revive?.by === 'medkit' && now - revive.t0 >= revive.ms) { try { const pk = root.NightshiftInventory.state.pocket; pk.medkit = Math.max(0, (pk.medkit || 0) - 1); root.NightshiftInventory.save?.(); } catch { /* n/a */ } standUp('medkit', 45); }
    }
  }
  // crawl / stun: scale movement made since the last frame
  let lastPos = null;
  function movementClamp(now) {
    const p = P(); if (!p || p.car) { lastPos = null; return; }
    if (lastPos && (downed || now < stunUntil)) { const k = now < stunUntil ? 0 : R.crawl; p.x = lastPos.x + (p.x - lastPos.x) * k; p.y = lastPos.y + (p.y - lastPos.y) * k; }
    if (now < stunUntil) { try { nextShot = Math.max(nextShot, stunUntil); } catch { /* n/a */ } } // eslint-disable-line no-undef
    lastPos = { x: p.x, y: p.y };
  }

  // ---------- suppression: your rounds make enemies flinch and duck ----------
  function suppression(now) {
    let B = []; try { B = bullets; } catch { return; } if (!B.length) return; // eslint-disable-line no-undef
    let units = [], cops = []; try { units = root.NightshiftGangs?.members?.() || []; cops = root.NightshiftCrime?.officers || []; } catch { /* n/a */ }
    for (const b of B) for (const u of units.length || cops.length ? [...units, ...cops] : []) {
      if (Math.abs(u.x - b.x) > 34 || Math.abs(u.y - b.y) > 34) continue;
      if ((u.suppressedUntil || 0) < now) { st.suppress++; u.nextPlan = 0; if (u.nextAttack) u.nextAttack = Math.max(u.nextAttack, now + 450); if (u.nextShot) u.nextShot = Math.max(u.nextShot, now + 350); }
      u.suppressedUntil = now + 1300;
    }
  }

  // ---------- HUD: damage direction + downed overlay + GET UP button ----------
  const cv = document.createElement('canvas'); cv.id = 'authHud'; cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;pointer-events:none;z-index:15'; document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const css = document.createElement('style');
  css.textContent = `#getUp{position:fixed;left:50%;bottom:calc(var(--control-bottom,16px) + 150px);transform:translateX(-50%);z-index:30;all:unset;box-sizing:border-box;position:fixed;cursor:pointer;padding:10px 18px;border-radius:14px;background:linear-gradient(160deg,#3a1420f0,#200a12f0);border:1px solid #ff6a7a;color:#ffe3e8;font:800 14px ui-monospace,Menlo,monospace;letter-spacing:.05em;box-shadow:0 0 18px #ff3a5a66;touch-action:none}
  #getUp[hidden]{display:none} #getUp i{display:block;height:4px;margin-top:5px;border-radius:2px;background:#ff6a7a;transform-origin:left;transform:scaleX(0)}`;
  document.head.appendChild(css);
  const btn = Object.assign(document.createElement('button'), { id: 'getUp', type: 'button', hidden: true }); btn.innerHTML = '💉 HOLD TO GET UP<i></i>'; document.body.appendChild(btn);
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (downed && hasMedkit()) revive = { t0: performance.now(), by: 'medkit', ms: R.reviveMs }; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => { if (revive?.by === 'medkit') revive = null; });
  function hud(now) {
    const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const busy = downed || now < stunUntil || indicators.some((d) => now - d.t < 900);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h); if (!busy) { btn.hidden = true; return; }
    for (let i = indicators.length - 1; i >= 0; i--) {
      const d = indicators[i], age = (now - d.t) / 900; if (age >= 1) { indicators.splice(i, 1); continue; }
      const r = Math.min(w, h) * 0.36, cx = w / 2, cy = h / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(d.a); ctx.globalAlpha = (1 - age) * 0.85;
      const grd = ctx.createLinearGradient(r - 30, 0, r + 10, 0); grd.addColorStop(0, 'rgba(255,40,60,0)'); grd.addColorStop(1, d.kind === 'taser' ? 'rgba(120,220,255,0.9)' : 'rgba(255,40,60,0.9)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, r + 10, -0.32, 0.32); ctx.arc(0, 0, r - 26, 0.26, -0.26, true); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (now < stunUntil) { ctx.fillStyle = `rgba(150,220,255,${0.12 + 0.08 * Math.sin(now / 40)})`; ctx.fillRect(0, 0, w, h); }
    if (downed) {
      const left = Math.max(0, downed.until - now) / R.bleedMs, g2 = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
      g2.addColorStop(0, 'rgba(80,0,10,0)'); g2.addColorStop(1, `rgba(90,0,12,${0.55 + 0.15 * Math.sin(now / 260)})`); ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
      const bw = Math.min(260, w * 0.4), bx = w / 2 - bw / 2, by = h * 0.2; ctx.fillStyle = 'rgba(10,6,10,0.75)'; ctx.fillRect(bx - 2, by - 18, bw + 4, 28); ctx.fillStyle = '#ff5a6a'; ctx.fillRect(bx, by, bw * left, 6);
      ctx.font = '800 12px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe3e8'; ctx.fillText(`DOWN · BLEEDING OUT ${Math.ceil(Math.max(0, downed.until - now) / 1000)}s${revive ? ' · GETTING UP…' : ''}`, w / 2, by - 5);
      btn.hidden = !hasMedkit(); const f = revive?.by === 'medkit' ? Math.min(1, (now - revive.t0) / revive.ms) : 0; btn.querySelector('i').style.transform = `scaleX(${f})`;
    } else btn.hidden = true;
  }

  // ---------- hooks ----------
  const hook = setInterval(() => {
    const REC = root.NightshiftRecovery, V = root.NightshiftVehicles;
    if (REC && typeof REC.damage === 'function' && !REC.__authority) {
      const d0 = REC.damage; REC.damage = function (amount, now, src) { if (onPlayerDamage(amount, now ?? performance.now(), src) === 'absorbed') return; return d0.apply(this, arguments); }; REC.__authority = true;
      const t0 = REC.tick; if (typeof t0 === 'function') REC.tick = function (now) { const p = P(); if (p && p.hp <= 0 && !dying && !downed && canDown(p)) { enterDown(now ?? performance.now()); return; } return t0.apply(this, arguments); };
    }
    if (V && typeof V.canEnter === 'function' && !V.__authority) { const c0 = V.canEnter; V.canEnter = function () { if (downed || performance.now() < stunUntil) return false; return c0.apply(this, arguments); }; V.__authority = true; }
    if (REC?.__authority && V?.__authority) clearInterval(hook);
  }, 250);
  (function loop(now) { try { tick(now); movementClamp(now); suppression(now); hud(now); } catch (e) { console.error(e); } requestAnimationFrame(loop); })(performance.now());
  root.NightshiftAuthority = Object.freeze({ bulletHit, damagePlayer: (amount, src) => root.NightshiftRecovery?.damage?.(amount, performance.now(), src), revive: (by) => standUp(by || 'ally'), downed: () => downed, stunned: () => performance.now() < stunUntil, stun: (ms) => { stunUntil = Math.max(stunUntil, performance.now() + ms); }, cuffed: () => { downed = null; dying = false; stunUntil = 0; const p = P(); if (p) { p.downed = null; p.squat = false; } }, log: () => log.slice(), stats: () => ({ ...st, seq, downed: !!downed }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
