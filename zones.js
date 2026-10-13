/* Zone engine (Claude-owned). Whole extra maps (countryside, suburbs, break-in interiors) without touching the city:
 * it rides the same hooks the apartment uses — while a zone is active, NightshiftHome.paused() is true, so the game
 * loop calls NightshiftHome.render(now), which we route here; USE goes through NightshiftHome.use/interaction.
 * The engine owns: movement + collisions, camera, a cached ground layer, y-sorted props/actors/player, bullets
 * (yours and enemies'), fog of war with a vision cone (break-ins), sound "echo" rings, night lighting, USE targets
 * with world signs, a fade transition, a zone banner, and bus travel between the city and the zones.
 * Content modules register zones: NightshiftZones.register({ id, name, w, h, ground(ctx), solids, targets(api), ... }).
 * API: NightshiftZones.{register, enter, leave, active, openTravel, api} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const ZONES = {}, COMPANIONS = [];
  let cur = null;
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const SW = () => { try { return W; } catch { return innerWidth; } };
  const SH = () => { try { return H; } catch { return innerHeight; } };
  const KEYS = () => { try { return keys; } catch { return {}; } };
  const JOY = () => { try { return joy; } catch { return { x: 0, y: 0 }; } };
  const IN = () => { try { return { joy: aimJoy, fire: aimFire, firing, mouse: mouseFire, run, pointer: aimPointer }; } catch { return {}; } };
  const CS = () => { try { return combatState; } catch { return null; } };
  const CAMZ = () => { try { return camera.zoom || 1; } catch { return 1; } };
  const release = () => { try { releaseControls(); } catch { /* n/a */ } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const minute = () => root.NightshiftEnvironment?.state?.minute ?? 720;
  const darkness = () => { try { return root.NightshiftEnvironment?.darkness?.(minute()) || 0; } catch { return 0; } };
  const rain = () => { try { return root.NightshiftEnvironment?.weather?.(minute()) || 0; } catch { return 0; } };
  const money = (n) => '$' + Math.round(n).toLocaleString();

  // ---------- registry / enter / leave ----------
  function register(def) { ZONES[def.id] = def; def.solids = def.solids || []; return def; }
  function enter(id, spawn, opts = {}) {
    const def = ZONES[id], p = P();
    if (!def || !p) return false;
    if (p.car) { say('Park and get out of the car first'); return false; }
    const ret = cur ? cur.ret : (opts.ret || { x: p.x, y: p.y });
    if (cur) cur.def.onLeave?.(api);
    const sp = spawn || def.spawn || { x: def.w / 2, y: def.h / 2 };
    cur = { def, pos: { x: sp.x, y: sp.y, angle: sp.angle ?? -Math.PI / 2, moveAngle: sp.angle ?? -Math.PI / 2, walkTicks: 0, moving: false }, prev: performance.now(), ret,
      bullets: [], fx: [], echoes: [], floats: [], nextShot: 0, reloadUntil: 0, shake: 0, enteredAt: performance.now(), vis: null, data: opts.data || null, hurtFlash: 0 };
    release(); fade();
    try { def.onEnter?.(api, opts.data); } catch (e) { console.error(e); }
    banner(def.name, def.tagline || '');
    return true;
  }
  function leave(to) {
    if (!cur) return false;
    const p = P(), c = cur;
    try { c.def.onLeave?.(api); } catch { /* ignore */ }
    cur = null;
    if (p) { const r = to || c.ret; p.x = r.x; p.y = r.y; p.moving = false; }
    release(); fade(); gameSave();
    try { root.NightshiftSupply?.activity?.() && root.NightshiftSupply.stop(); } catch { /* n/a */ }
    return true;
  }

  // ---------- hooks on the apartment's render path ----------
  function install() {
    const HM = root.NightshiftHome;
    if (!HM || HM.__zones) return !!HM?.__zones;
    const paused = HM.paused, render = HM.render, use = HM.use, interaction = HM.interaction, kind = HM.kind, leaveH = HM.leave;
    HM.paused = function () { return !!cur || paused.apply(this, arguments); };
    HM.render = function (now) { if (cur) { try { frame(now); } catch (e) { console.error(e); } return; } return render.apply(this, arguments); };
    HM.use = function () { if (cur) return zoneUse(); return use.apply(this, arguments); };
    HM.interaction = function () { if (cur) return zoneTarget(); return interaction.apply(this, arguments); };
    HM.kind = function () { if (cur) return cur.def.indoor ? 'zone' : null; return kind.apply(this, arguments); };
    if (typeof leaveH === 'function') HM.leave = function () { if (cur) return leave(); return leaveH.apply(this, arguments); };
    HM.__zones = true;
    return true;
  }
  if (!install()) { const t = setInterval(() => { if (install()) clearInterval(t); }, 300); }

  // ---------- geometry ----------
  const inRect = (x, y, r, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
  function solidsNow() { const d = cur.def; return d.dynamicSolids ? d.solids.concat(d.dynamicSolids(api) || []) : d.solids; }
  function blocked(x, y, pad = 8) {
    const d = cur.def;
    if (x < 10 || y < 10 || x > d.w - 10 || y > d.h - 10) return true;
    for (const r of solidsNow()) if (!r.walk && inRect(x, y, r, pad)) return true;
    return !!d.blocked?.(x, y, api);
  }
  // Ray from (x,y) along angle a: distance to the first wall (rects with .wall or .opaque), capped at max.
  function rayDist(x, y, a, max, rects) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let best = max;
    for (const r of rects) {
      let t0 = -Infinity, t1 = Infinity;
      if (Math.abs(dx) < 1e-9) { if (x < r.x || x > r.x + r.w) continue; } else { let a1 = (r.x - x) / dx, a2 = (r.x + r.w - x) / dx; if (a1 > a2) [a1, a2] = [a2, a1]; t0 = Math.max(t0, a1); t1 = Math.min(t1, a2); }
      if (Math.abs(dy) < 1e-9) { if (y < r.y || y > r.y + r.h) continue; } else { let b1 = (r.y - y) / dy, b2 = (r.y + r.h - y) / dy; if (b1 > b2) [b1, b2] = [b2, b1]; t0 = Math.max(t0, b1); t1 = Math.min(t1, b2); }
      if (t1 >= t0 && t1 > 0) { const t = t0 > 0 ? t0 : 0; if (t < best) best = t; }
    }
    return best;
  }
  const opaque = () => solidsNow().filter((r) => r.wall || r.opaque);
  function los(x1, y1, x2, y2) { const d = Math.hypot(x2 - x1, y2 - y1); if (d < 1) return true; return rayDist(x1, y1, Math.atan2(y2 - y1, x2 - x1), d, opaque()) >= d - 1; }

  // ---------- movement / aiming / combat ----------
  let lastMouse = null;
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') lastMouse = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
  function move(dt) {
    const c = cur, k = KEYS(), j = JOY(), I = IN(), pos = c.pos;
    let x = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0) + (j.x || 0), y = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0) + (j.y || 0);
    const mag = Math.hypot(x, y); if (mag > 1) { x /= mag; y /= mag; }
    const sprint = k.shift || I.run || Math.hypot(j.x || 0, j.y || 0) >= 0.85;
    const sp = (sprint ? 4.4 : 2.6) * (sprint ? mod('athletics.speed') : 1) * dt * (c.def.speed || 1);
    const bx = pos.x, by = pos.y;
    if (mag > 0.05) {
      const nx = pos.x + x * sp; if (!blocked(nx, pos.y)) pos.x = nx;
      const ny = pos.y + y * sp; if (!blocked(pos.x, ny)) pos.y = ny;
    }
    pos.moving = Math.hypot(pos.x - bx, pos.y - by) > 0.1;
    if (pos.moving) { pos.walkTicks += dt * (sprint ? 1.4 : 1); pos.moveAngle = Math.atan2(pos.y - by, pos.x - bx); pos.sprint = sprint; } else pos.sprint = false;
    const p = P(); if (p) { p.moving = pos.moving; p.walkTicks = pos.walkTicks; }
    pos.noisy = pos.moving && sprint;
  }
  function aim(now) {
    const c = cur, I = IN(), pos = c.pos;
    if (I.joy !== null && I.joy !== undefined && Number.isFinite(I.joy)) { pos.angle = I.joy; pos.aiming = now; return; }
    if (lastMouse && now - lastMouse.t < 4000 && c.def.combat) { const sx = (pos.x - c.cam.x) * c.z + c.cam.ox, sy = (pos.y - c.cam.y) * c.z + c.cam.oy; pos.angle = Math.atan2(lastMouse.y - sy, lastMouse.x - sx); pos.aiming = now; return; }
    if (pos.moving && (!pos.aiming || now - pos.aiming > 600)) pos.angle = pos.moveAngle;
  }
  let noFireSaid = 0;
  function wantsFire() { const I = IN(), k = KEYS(); return !!(I.firing || I.mouse || k[' '] || (I.pointer !== null && I.pointer !== undefined && I.fire && root.NightshiftTouchLayout?.state?.autoFire !== false)); }
  function startReload(now) {
    const p = P(), cs = CS(), w = root.NightshiftWeapons?.current?.();
    if (!p || !cs || !w || cur.reloadUntil > now || p.ammo >= w.mag || cs.reserve <= 0) return;
    const ms = (root.NightshiftCombat?.RELOAD_MS || 1200) * mod('shooting.reload');
    cur.reloadUntil = now + ms; try { root.NightshiftAudio?.play('reload'); } catch { /* optional */ }
    setTimeout(() => { if (!cur) return; const need = w.mag - p.ammo, take = Math.min(need, cs.reserve); p.ammo += take; cs.reserve -= take; cur.reloadUntil = 0; }, ms);
  }
  addEventListener('keydown', (e) => { if (cur && (e.key === 'r' || e.key === 'R')) startReload(performance.now()); });
  const rl = () => { const b = document.querySelector('#reload'); if (b && !b.__zones) { b.__zones = true; b.addEventListener('pointerdown', () => { if (cur) startReload(performance.now()); }); } };
  setInterval(rl, 1500);
  function fire(now) {
    const c = cur, p = P(), WS = root.NightshiftWeapons, WD = root.NightshiftWeaponsData;
    if (!c.def.combat) { if (now - noFireSaid > 4000) { noFireSaid = now; say('No need for that here'); } return; }
    const armed = WS?.armed?.() && (root.NightshiftInventory?.state?.pocket?.pistol || 0) > 0;
    if (!armed) { if (now - noFireSaid > 3000) { noFireSaid = now; say('✊ No working gun'); } return; }
    if (now < c.nextShot || c.reloadUntil > now) return;
    if (p.ammo <= 0) { startReload(now); return; }
    const w = WS.current();
    p.ammo -= 1; c.nextShot = now + w.rate;
    const a0 = c.pos.angle, sp = w.speed * 1.25;
    for (const a of WD.pelletAngles(a0, w)) c.bullets.push({ x: c.pos.x + Math.cos(a) * 16, y: c.pos.y + Math.sin(a) * 16, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: w.range / sp, dmg: w.dmg * mod('shooting.damage'), team: 'player' });
    c.fx.push({ kind: 'muzzle', x: c.pos.x + Math.cos(a0) * 20, y: c.pos.y + Math.sin(a0) * 20, a: a0, t0: now, life: 70 });
    c.shake = Math.min(6, c.shake + (w.cls === 'shotgun' ? 4 : 2));
    try { root.NightshiftFeedback?.shot?.(); } catch { /* wear + sound hooks */ }
    try { root.NightshiftSkills?.gain('shooting', 2, 'zone'); } catch { /* optional */ }
    c.def.onNoise?.(c.pos.x, c.pos.y, w.suppressed ? 80 : 340, api, 'shot');
  }
  function enemyShot(x, y, a, dmg = 10, speed = 11, spread = 0.06, range = 520) {
    if (!cur) return;
    const aa = a + (Math.random() * 2 - 1) * spread;
    cur.bullets.push({ x, y, vx: Math.cos(aa) * speed, vy: Math.sin(aa) * speed, life: range / speed, dmg, team: 'enemy' });
    cur.fx.push({ kind: 'muzzle', x: x + Math.cos(aa) * 16, y: y + Math.sin(aa) * 16, a: aa, t0: performance.now(), life: 70, enemy: true });
    if (cur.def.fog && !visible(x, y)) echo(x, y, '#ff5a6a', 'shot');
  }
  function bullets(dt, now) {
    const c = cur, p = P(), walls = solidsNow().filter((r) => !r.walk && !r.low);
    for (let i = c.bullets.length - 1; i >= 0; i--) {
      const b = c.bullets[i]; let dead = false;
      const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6);
      for (let s = 0; s < steps && !dead; s++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
        if (b.x < 0 || b.y < 0 || b.x > c.def.w || b.y > c.def.h || walls.some((r) => inRect(b.x, b.y, r))) { dead = true; c.fx.push({ kind: 'spark', x: b.x, y: b.y, t0: now, life: 160 }); break; }
        if (b.team === 'player') { if (c.def.hit?.(b, api)) { dead = true; c.fx.push({ kind: 'blood', x: b.x, y: b.y, t0: now, life: 260 }); } }
        else if (Math.hypot(b.x - c.pos.x, b.y - c.pos.y) < 11) {
          dead = true; c.hurtFlash = now;
          try { root.NightshiftRecovery?.damage?.(b.dmg, now); } catch { if (p) p.hp -= b.dmg; }
        }
      }
      b.life -= dt;
      if (dead || b.life <= 0) c.bullets.splice(i, 1);
    }
  }

  // ---------- fog of war ----------
  function computeVis() {
    const c = cur, d = c.def, pos = c.pos, rects = opaque();
    const cone = d.fog.cone ?? 1.2, len = d.fog.len ?? 300, around = d.fog.around ?? 62, n = 44;
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = pos.angle - cone / 2 + (cone * i) / n, r = rayDist(pos.x, pos.y, a, len, rects); pts.push([pos.x + Math.cos(a) * r, pos.y + Math.sin(a) * r, a, r]); }
    const ring = []; const m = 28;
    for (let i = 0; i < m; i++) { const a = (i / m) * Math.PI * 2, r = rayDist(pos.x, pos.y, a, around, rects); ring.push([pos.x + Math.cos(a) * r, pos.y + Math.sin(a) * r, a, r]); }
    c.vis = { pts, ring, cone, len, around };
  }
  function visible(x, y) {
    const c = cur; if (!c?.def.fog) return true;
    if (!c.vis) computeVis();
    const pos = c.pos, d = Math.hypot(x - pos.x, y - pos.y);
    if (d < (c.vis.around || 60)) return los(pos.x, pos.y, x, y);
    const a = Math.atan2(y - pos.y, x - pos.x); let da = a - pos.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > c.vis.cone / 2 || d > c.vis.len) return false;
    return los(pos.x, pos.y, x, y);
  }
  function echo(x, y, color = '#ff5a6a', kind = 'step') { if (!cur) return; cur.echoes.push({ x, y, color, kind, t0: performance.now() }); if (cur.echoes.length > 40) cur.echoes.shift(); }

  // ---------- targets (USE) ----------
  function targetsNow() {
    const c = cur, list = (c.def.targets?.(api) || []).slice();
    for (const ex of c.def.exits || []) list.push({ id: 'exit', x: ex.x, y: ex.y, r: ex.r || 60, action: ex.action || 'LEAVE', label: ex.label || 'Leave', sign: ex.sign, icon: ex.icon, color: ex.color, use: () => (ex.use ? ex.use(api) : leave(ex.to)) });
    return list;
  }
  function nearest() {
    const c = cur, pos = c.pos; let best = null, bd = Infinity;
    for (const t of targetsNow()) { if (t.hidden) continue; const d = Math.hypot(pos.x - t.x, pos.y - t.y); if (d < (t.r || 50) && d < bd) { best = t; bd = d; } }
    return best;
  }
  function zoneTarget() { const t = nearest(); return t ? { kind: 'zone', action: t.action, label: t.label, x: t.x, y: t.y } : null; }
  function zoneUse() { const t = nearest(); if (!t) { const sp = root.NightshiftSupply?.progress?.(); if (sp) { root.NightshiftSupply.tap(); return true; } say('Walk up to something to use it'); return true; } try { t.use(api); } catch (e) { console.error(e); } return true; }

  // ---------- drawing ----------
  let lm = null;
  function cache(def) {
    if (def._cache) return def._cache;
    // v0.62: interiors baked at 2x so floors, furniture edges and fine HD detail stay sharp on 3x screens
    const cv = document.createElement('canvas'); cv.width = def.w * 2; cv.height = def.h * 2;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.scale(2, 2);
    try { def.ground?.(x, api); } catch (e) { console.error(e); }
    def._cache = cv; return cv;
  }
  function drawPlayer(ctx) {
    const c = cur, p = P(), pos = c.pos, S = root.NightshiftSprites;
    const show = c.def.combat || (pos.aiming && performance.now() - pos.aiming < 1500);
    const body = { x: pos.x, y: pos.y, angle: show ? pos.angle : (pos.moving ? pos.moveAngle : pos.angle), moving: pos.moving, walkTicks: pos.walkTicks, moveAngle: pos.moveAngle, hp: p?.hp ?? 100, color: p?.color, id: 'player' };
    try { S?.person?.(body, true, show ? {} : { weapon: false }); } catch { ctx.fillStyle = '#5ec8ff'; ctx.fillRect(pos.x - 6, pos.y - 16, 12, 18); }
  }
  function drawActor(ctx, a) {
    if (a.draw) { a.draw(ctx, api); return; }
    try { root.NightshiftSprites?.person?.({ x: a.x, y: a.y, angle: a.angle ?? Math.PI / 2, moving: !!a.moving, walkTicks: a.walkTicks || 0, moveAngle: a.angle, hp: a.hp ?? 40, maxHp: a.maxHp, color: a.color, id: a.id, outfit: a.outfit, inCover: a.inCover, seated: a.seated, seat: a.seat }, false, { weapon: a.armed ? undefined : false, role: a.role }); } catch { /* sprite optional */ }
  }
  function frameDraw(now) {
    const c = cur, d = c.def, ctx = G(), Wd = SW(), Hd = SH(), pos = c.pos, t = now / 1000;
    const z = Math.max(1, Math.min(2.4, (d.zoom || 1) * Math.max(1.15, CAMZ())));
    const vw = Wd / z, vh = Hd / z;
    let cx = d.w <= vw ? (d.w - vw) / 2 : Math.max(0, Math.min(d.w - vw, pos.x - vw / 2));
    let cy = d.h <= vh ? (d.h - vh) / 2 : Math.max(0, Math.min(d.h - vh, pos.y - vh / 2));
    const sh = c.shake; c.shake *= 0.85; cx += (Math.random() - 0.5) * sh; cy += (Math.random() - 0.5) * sh;
    c.z = z; c.cam = { x: cx, y: cy, ox: 0, oy: 0 };
    ctx.save();
    ctx.fillStyle = d.bg || '#0b0f17'; ctx.fillRect(0, 0, Wd, Hd);
    ctx.scale(z, z); ctx.translate(-cx, -cy);
    const cv = cache(d), sx = Math.max(0, Math.floor(cx)), sy = Math.max(0, Math.floor(cy)), sw = Math.min(d.w - sx, Math.ceil(vw) + 2), shh = Math.min(d.h - sy, Math.ceil(vh) + 2);
    if (sw > 0 && shh > 0) ctx.drawImage(cv, sx * 2, sy * 2, sw * 2, shh * 2, sx, sy, sw, shh);
    try { d.drawGround?.(ctx, t, api); } catch (e) { console.error(e); }
    const view = { x: cx - 80, y: cy - 120, w: vw + 160, h: vh + 240 };
    const items = [];
    for (const pr of d.props?.(api, view) || []) items.push(pr);
    const hideActor = (a) => d.fog && !a.always && !visible(a.x, a.y);
    for (const a of d.actors?.(api) || []) if (!hideActor(a)) items.push({ y: a.y, draw: () => drawActor(ctx, a) });
    for (const fn of COMPANIONS) { try { const a = fn(api, d); if (a) items.push({ y: a.y, draw: () => a.draw(ctx, t) }); } catch { /* optional */ } }
    items.push({ y: pos.y, draw: () => drawPlayer(ctx) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) { try { it.draw(ctx, t, api); } catch (e) { console.error(e); } }
    try { d.drawTop?.(ctx, t, api); } catch (e) { console.error(e); }
    // bullets + fx
    for (const b of c.bullets) { if (d.fog && b.team === 'enemy' && !visible(b.x, b.y)) continue; ctx.strokeStyle = b.team === 'enemy' ? '#ff8a7a' : '#ffe9a8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 1.4, b.y - b.vy * 1.4); ctx.stroke(); }
    for (let i = c.fx.length - 1; i >= 0; i--) {
      const f = c.fx[i], age = now - f.t0, k = age / f.life; if (k >= 1) { c.fx.splice(i, 1); continue; }
      if (d.fog && f.enemy && !visible(f.x, f.y)) continue;
      if (f.kind === 'muzzle') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(12, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffb347'; ctx.fillRect(-2, -2, 5, 4); ctx.restore(); }
      else if (f.kind === 'spark') { ctx.fillStyle = `rgba(255,220,150,${1 - k})`; for (let s = 0; s < 4; s++) ctx.fillRect(f.x + Math.cos(s * 1.7) * k * 9, f.y + Math.sin(s * 1.7) * k * 9, 2, 2); }
      else if (f.kind === 'blood') { ctx.fillStyle = `rgba(200,40,50,${0.9 * (1 - k)})`; for (let s = 0; s < 5; s++) ctx.fillRect(f.x + Math.cos(s * 1.3) * k * 10, f.y + Math.sin(s * 1.3) * k * 10, 2, 2); }
      else if (f.kind === 'puff') { ctx.fillStyle = `rgba(230,236,240,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x, f.y - k * 10, 3 + k * 8, 0, Math.PI * 2); ctx.fill(); }
    }
    // USE targets: signs + highlight ring
    const near = nearest();
    for (const tg of targetsNow()) {
      if (tg.hidden) continue;
      if (tg.sign) root.NightshiftSign?.(ctx, tg.x, tg.y - (tg.lift ?? 30), tg.icon || '', tg.sign, tg.color || '#ffd970', { glow: tg === near ? 12 : 5 });
    }
    if (near) { ctx.save(); ctx.strokeStyle = '#b8e9dc'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 14; ctx.beginPath(); ctx.ellipse(near.x, near.y + 6, 20, 10, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    // collect/process ring over the player
    const pg = root.NightshiftSupply?.progress?.();
    if (pg && pg.kind !== 'craft') { const x = pos.x, y = pos.y - 46; ctx.save(); ctx.fillStyle = '#05080fcc'; ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = pg.kind === 'process' ? '#c49bff' : '#7cdeb5'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + pg.f * Math.PI * 2); ctx.stroke(); ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(pg.icon || '', x, y + 0.5); ctx.restore(); }
    // floating texts
    for (let i = c.floats.length - 1; i >= 0; i--) { const f = c.floats[i], k = (now - f.t0) / 1300; if (k >= 1) { c.floats.splice(i, 1); continue; } ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.font = '700 11px "Chakra Petch",system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#05080f'; ctx.fillText(f.text, f.x + 1, f.y - k * 26 + 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - k * 26); ctx.restore(); }
    ctx.restore();
    lighting(now, z, cx, cy);
    // echoes on top of the fog (world space)
    if (c.echoes.length) {
      ctx.save(); ctx.scale(z, z); ctx.translate(-cx, -cy);
      for (let i = c.echoes.length - 1; i >= 0; i--) {
        const e = c.echoes[i], k = (now - e.t0) / 900; if (k >= 1) { c.echoes.splice(i, 1); continue; }
        ctx.strokeStyle = e.color; ctx.globalAlpha = 0.9 * (1 - k); ctx.lineWidth = e.kind === 'shot' ? 2.5 : 1.5;
        for (const off of e.kind === 'shot' ? [0, 0.25] : [0]) { const kk = Math.min(1, k + off); ctx.beginPath(); ctx.arc(e.x, e.y, 6 + kk * (e.kind === 'shot' ? 46 : 22), 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // damage flash
    if (now - c.hurtFlash < 250) { ctx.save(); ctx.fillStyle = `rgba(200,20,30,${0.28 * (1 - (now - c.hurtFlash) / 250)})`; ctx.fillRect(0, 0, Wd, Hd); ctx.restore(); }
    try { d.drawScreen?.(ctx, t, api, Wd, Hd); } catch (e) { console.error(e); }
  }
  function lighting(now, z, cx, cy) {
    const c = cur, d = c.def, ctx = G(), Wd = SW(), Hd = SH();
    const dark = d.fog ? (d.fog.dark ?? 0.93) : d.indoor ? (d.dark ?? 0.25) : Math.min(0.7, darkness() * 0.72);
    const r = d.indoor ? 0 : rain();
    if (r > 0.2) { ctx.save(); ctx.strokeStyle = 'rgba(180,210,240,.35)'; ctx.lineWidth = 1; ctx.beginPath(); const n = Math.round(60 * r); for (let i = 0; i < n; i++) { const x = (i * 97 + now * 0.6) % Wd, y = (i * 211 + now * 1.4) % Hd; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 11); } ctx.stroke(); ctx.restore(); }
    if (dark < 0.02) return;
    // match the game canvas's real backing ratio (Codex v0.54 caps it by pixel budget, fx.js can lower it)
    const dpr = ctx.canvas?.width && Wd ? ctx.canvas.width / Wd : Math.max(1, Math.min(2, root.NightshiftRenderScale || devicePixelRatio || 1));
    if (!lm || lm.width !== Math.round(Wd * dpr) || lm.height !== Math.round(Hd * dpr)) { lm = document.createElement('canvas'); lm.width = Math.round(Wd * dpr); lm.height = Math.round(Hd * dpr); }
    const x = lm.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, lm.width, lm.height);
    x.fillStyle = d.fog ? `rgba(3,5,10,${dark})` : `rgba(6,10,24,${dark})`; x.fillRect(0, 0, lm.width, lm.height);
    x.setTransform(dpr * z, 0, 0, dpr * z, -cx * dpr * z, -cy * dpr * z);
    x.globalCompositeOperation = 'destination-out';
    const hole = (hx, hy, rr, a = 1) => { const gr = x.createRadialGradient(hx, hy, 0, hx, hy, rr); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.beginPath(); x.arc(hx, hy, rr, 0, Math.PI * 2); x.fill(); };
    for (const L of d.lights?.(api) || []) hole(L.x, L.y, L.r || 60, L.a ?? 0.9);
    if (d.fog) {
      computeVis();
      const v = c.vis;
      x.fillStyle = 'rgba(0,0,0,1)'; x.beginPath(); x.moveTo(c.pos.x, c.pos.y); for (const [px, py] of v.pts) x.lineTo(px, py); x.closePath(); x.fill();
      x.beginPath(); v.ring.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill();
    } else hole(c.pos.x, c.pos.y, d.indoor ? 120 : 105, 0.6);
    x.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lm, 0, 0); ctx.restore();
    if (d.fog) { // warm flashlight tint inside the cone
      ctx.save(); ctx.scale(z, z); ctx.translate(-cx, -cy); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.07; ctx.fillStyle = '#fff1c4'; ctx.beginPath(); ctx.moveTo(c.pos.x, c.pos.y); for (const [px, py] of c.vis.pts) ctx.lineTo(px, py); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  // ---------- frame ----------
  function frame(now) {
    const c = cur, p = P(), ctx = G();
    if (!ctx || !p) return;
    const dt = Math.min(2, Math.max(0, (now - c.prev) / 16.67)); c.prev = now;
    if (p.hp <= 0) { leave(); return; }
    const menu = document.body.classList.contains('ns-menu');
    try { if (!c.def.indoor) root.NightshiftEnvironment?.tick?.(dt / 60); } catch { /* clock optional */ }
    if (!menu) { move(dt); aim(now); if (wantsFire()) fire(now); }
    if (c.def.fog) c.vis = null;
    try { c.def.update?.(dt, now, api); } catch (e) { console.error(e); }
    bullets(dt, now);
    if (!cur) return; // update may have left the zone
    frameDraw(now);
    try { root.NightshiftGuidance?.render?.('zone'); } catch { /* n/a */ }
  }

  // ---------- UI: banner, fade, travel ----------
  const css = document.createElement('style');
  css.textContent = `
  #znFade{position:fixed;inset:0;z-index:95;background:#000;opacity:0;pointer-events:none;transition:opacity .35s}
  #znFade.on{opacity:1;transition:none}
  #znBanner{position:fixed;left:50%;top:60%;max-width:92vw;transform:translate(-50%,-10px);z-index:30;opacity:0;pointer-events:none;text-align:center;transition:opacity .6s,transform .6s;
    font:700 24px var(--disp,system-ui);letter-spacing:.12em;color:#fff;text-shadow:0 2px 0 #000,0 0 24px #000c}
  #znBanner small{display:block;font:600 12px var(--body,system-ui);letter-spacing:.24em;color:#ffd970;margin-top:4px}
  #znBanner.on{opacity:1;transform:translate(-50%,0)}
  #znTravel{position:fixed;inset:8% 6%;z-index:46;overflow:auto;background:linear-gradient(180deg,#141a24f7,#0b0f16f8);border:1px solid #ffffff24;border-radius:18px;padding:12px 14px;color:#eef3f9;font:13px var(--body,system-ui)}
  #znTravel[hidden]{display:none} #znTravel h2{margin:0 0 4px;font:700 17px var(--disp,system-ui);color:#ffd970;letter-spacing:.05em}
  #znTravel .top{display:flex;justify-content:space-between;align-items:center} #znTravel button{all:unset;box-sizing:border-box;cursor:pointer;border-radius:10px;font:700 12px var(--disp,system-ui);text-align:center}
  #znTravel .x{background:#ffffff14;border:1px solid #ffffff2a;padding:7px 12px}
  #znTravel .dest{display:flex;gap:10px;align-items:center;background:#ffffff08;border:1px solid #ffffff16;border-radius:14px;padding:10px;margin-top:8px}
  #znTravel .dest canvas{flex:none;border-radius:10px;border:1px solid #ffffff22} #znTravel .dest .t{flex:1} #znTravel .dest b{font:700 15px var(--disp,system-ui)} #znTravel .dest span{display:block;color:#a9b8ca;font-size:11.5px;margin-top:2px}
  #znTravel .go{padding:9px 14px;background:linear-gradient(#ffe08a,#e2a33f);color:#2a1600} #znTravel .go[disabled]{opacity:.35;pointer-events:none}
  #znTravel .here{color:#7cdeb5;font:700 11px var(--disp,system-ui)}
  @media (orientation:portrait){#znTravel{inset:max(10px,env(safe-area-inset-top)) 8px 10px 8px}}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const fadeEl = el('div', { id: 'znFade' }), bannerEl = el('div', { id: 'znBanner' }), travelEl = el('div', { id: 'znTravel', hidden: true, role: 'dialog', ariaLabel: 'Travel' });
  document.body.append(fadeEl, bannerEl, travelEl);
  function fade() { fadeEl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => fadeEl.classList.remove('on'))); }
  let bannerT = 0;
  function banner(name, tag) { bannerEl.textContent = ''; bannerEl.append(document.createTextNode(name.toUpperCase()), el('small', {}, tag)); bannerEl.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => bannerEl.classList.remove('on'), 2600); }
  // Destinations: the city plus every zone that sets `travel: { fare, desc, spawn, cityStop }`.
  const CITY_STOPS = [{ id: 'zn-bus-mid', x: 1262, y: 958, name: 'Midtown bus stop' }, { id: 'zn-bus-west', x: 420, y: 612, name: 'West End bus stop' }];
  function destinations() {
    const out = [{ id: 'city', name: 'Nightshift City', desc: 'Back to the streets. The bus drops you at the Midtown stop.', fare: 0, art: 'city' }];
    for (const z of Object.values(ZONES)) if (z.travel) out.push({ id: z.id, name: z.name, desc: z.travel.desc, fare: z.travel.fare, art: z.id, lock: z.travel.lock });
    return out;
  }
  function thumb(kind) {
    const cv = el('canvas'); cv.width = 84; cv.height = 56; cv.style.width = '84px'; cv.style.height = '56px'; const x = cv.getContext('2d');
    const T = { city: ['#1b2433', '#2c3b52', '#ffcf7a'], farm: ['#5f8a3a', '#c9a24a', '#e8d38a'], suburbs: ['#4f8a4a', '#d8cfc0', '#5fb7e0'] }[kind] || ['#333', '#555', '#999'];
    x.fillStyle = T[0]; x.fillRect(0, 0, 84, 56);
    if (kind === 'city') { for (let i = 0; i < 7; i++) { const h = 14 + ((i * 37) % 26); x.fillStyle = T[1]; x.fillRect(4 + i * 11, 56 - h, 9, h); x.fillStyle = T[2]; for (let k = 0; k < h / 6; k++) if ((i + k) % 3) x.fillRect(6 + i * 11, 56 - h + 3 + k * 6, 2, 2); } }
    else if (kind === 'farm') { x.fillStyle = '#8fc0e8'; x.fillRect(0, 0, 84, 20); for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? T[1] : '#7a9a3a'; x.fillRect(0, 22 + i * 6, 84, 6); } x.fillStyle = '#b5482e'; x.fillRect(50, 10, 20, 16); x.fillStyle = '#7a2e1e'; x.beginPath(); x.moveTo(48, 11); x.lineTo(60, 2); x.lineTo(72, 11); x.fill(); x.fillStyle = '#ddd'; x.fillRect(18, 4, 3, 18); x.fillRect(12, 6, 15, 2); x.fillRect(18, 0, 2, 14); }
    else if (kind === 'suburbs') { x.fillStyle = '#8fc0e8'; x.fillRect(0, 0, 84, 18); for (let i = 0; i < 3; i++) { x.fillStyle = ['#e9dcc4', '#c9d8e8', '#f0d0c0'][i]; x.fillRect(6 + i * 27, 22, 22, 16); x.fillStyle = '#8a4a3a'; x.beginPath(); x.moveTo(4 + i * 27, 23); x.lineTo(17 + i * 27, 14); x.lineTo(30 + i * 27, 23); x.fill(); x.fillStyle = '#3a6a3a'; x.fillRect(0, 40, 84, 16); x.fillStyle = T[2]; x.fillRect(10 + i * 27, 44, 12, 6); } }
    return cv;
  }
  function openTravel(fromStop) {
    try { release(); } catch { /* n/a */ }
    travelEl.hidden = false; travelEl.textContent = '';
    const top = el('div', { className: 'top' }); const x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { travelEl.hidden = true; }; top.append(el('h2', {}, '🚌 BUS · WHERE TO?'), x); travelEl.append(top);
    travelEl.append(el('div', { style: 'color:#a9b8ca;font-size:11.5px' }, 'Buses run day and night. Your car stays parked in the city.'));
    const here = cur ? cur.def.id : 'city', p = P();
    for (const d of destinations()) {
      const row = el('div', { className: 'dest' }); row.append(thumb(d.art));
      const t = el('div', { className: 't' }); t.append(el('b', {}, d.name), el('span', {}, d.desc)); row.append(t);
      if (d.id === here) row.append(el('span', { className: 'here' }, 'YOU ARE HERE'));
      else {
        const lock = d.lock?.();
        const b = el('button', { className: 'go', type: 'button', disabled: !!lock || (p?.cash ?? 0) < d.fare }, lock || (d.fare ? `RIDE · ${money(d.fare)}` : 'RIDE'));
        b.onclick = () => { travelEl.hidden = true; travel(d.id, d.fare, fromStop); };
        row.append(b);
      }
      travelEl.append(row);
    }
  }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !travelEl.hidden) { travelEl.hidden = true; e.stopImmediatePropagation(); } }, true);
  function travel(id, fare, fromStop) {
    const p = P(); if (!p) return;
    if (fare && p.cash < fare) { say('Not enough for the fare'); return; }
    if (fare) p.cash -= fare;
    try { root.NightshiftAudio?.play('pickup'); } catch { /* optional */ }
    if (id === 'city') { const stop = CITY_STOPS[0]; leave({ x: stop.x, y: stop.y + 18 }); say('🚌 Back in the city · Midtown bus stop'); return; }
    const ret = cur ? cur.ret : { x: (fromStop || CITY_STOPS[0]).x, y: (fromStop || CITY_STOPS[0]).y + 18 };
    enter(id, ZONES[id].travel.spawn, { ret });
  }
  // City bus stops (USE points) + art
  const E = root.NightshiftEncounters;
  if (E && !E.__zones) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 && !cur ? [...list, ...CITY_STOPS.map((s) => ({ id: s.id, type: 'bus', x: s.x, y: s.y, ready: true, color: '#7cc7ff', label: '🚌 BUS', action: 'BUS', hint: `${s.name} · ride to the countryside & suburbs` }))] : list; };
    E.use = function (id) { const s = CITY_STOPS.find((q) => q.id === id); if (s) { openTravel(s); return true; } return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawStops(); } catch { /* cosmetic */ } return r; };
    E.__zones = true;
  }
  function busStopArt(ctx, x, y, t) {
    // shelter: roof, glass back, bench, timetable, pole sign
    ctx.fillStyle = '#05080f55'; ctx.fillRect(x - 27, y - 30, 58, 26);
    ctx.fillStyle = '#9fb3c8aa'; ctx.fillRect(x - 28, y - 34, 56, 3);
    ctx.fillStyle = '#7cc7ff33'; ctx.fillRect(x - 26, y - 31, 52, 14); ctx.fillStyle = '#ffffff33'; ctx.fillRect(x - 24, y - 30, 10, 12);
    ctx.fillStyle = '#2b3138'; ctx.fillRect(x - 28, y - 36, 56, 5); ctx.fillStyle = '#3f4a56'; ctx.fillRect(x - 28, y - 36, 56, 2);
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x - 20, y - 15, 30, 5); ctx.fillStyle = '#8a6440'; ctx.fillRect(x - 20, y - 15, 30, 1);
    ctx.fillStyle = '#e8e3d0'; ctx.fillRect(x + 14, y - 28, 9, 12); ctx.fillStyle = '#3a6fb0'; for (let k = 0; k < 4; k++) ctx.fillRect(x + 15, y - 26 + k * 3, 7, 1);
    ctx.fillStyle = '#4a5560'; ctx.fillRect(x + 30, y - 46, 2, 44); ctx.fillStyle = '#1f6fd0'; ctx.beginPath(); ctx.arc(x + 31, y - 48, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText('B', x + 31, y - 45.5); ctx.textAlign = 'left';
  }
  function drawStops() {
    const ctx = G(), p = P(); if (!ctx || !p) return; const t = performance.now() / 1000;
    for (const s of CITY_STOPS) { if (Math.abs(p.x - s.x) > 700 || Math.abs(p.y - s.y) > 500) continue; ctx.save(); busStopArt(ctx, s.x, s.y, t); ctx.restore(); root.NightshiftSign?.(ctx, s.x, s.y - 60, '🚌', 'BUS · COUNTRYSIDE / SUBURBS', '#7cc7ff'); }
  }

  const api = {
    get pos() { return cur?.pos; }, get data() { return cur?.data; }, set data(v) { if (cur) cur.data = v; }, get zone() { return cur?.def; },
    player: P, say, money, minute, darkness, rain, mod, blocked: (x, y, pad) => (cur ? blocked(x, y, pad) : true), los, visible, echo, enemyShot, leave, enter, openTravel,
    float(x, y, text, color = '#ffe9a8') { cur?.floats.push({ x, y, text, color, t0: performance.now() }); },
    fx(kind, x, y, life = 300) { cur?.fx.push({ kind, x, y, t0: performance.now(), life }); },
    shake(n) { if (cur) cur.shake = Math.min(8, cur.shake + n); },
    near(x, y, r) { return !!cur && Math.hypot(cur.pos.x - x, cur.pos.y - y) <= r; },
    gather(spotId, x, y, r) { root.NightshiftSupply?.startZone?.(spotId, 'gather', () => !!cur && Math.hypot(cur.pos.x - x, cur.pos.y - y) <= r + 15); },
    process(spotId, x, y, r) { root.NightshiftSupply?.startZone?.(spotId, 'process', () => !!cur && Math.hypot(cur.pos.x - x, cur.pos.y - y) <= r + 15); },
    busStop: (x, y, r = 60) => ({ x, y, r, action: 'BUS', label: 'Bus stop · ride home or elsewhere', sign: 'BUS', icon: '🚌', color: '#7cc7ff', lift: 62, use: () => openTravel() }),
    busStopArt,
  };
  root.NightshiftZones = Object.freeze({ register, enter, leave, active: () => (cur ? cur.def.id : null), openTravel, api, CITY_STOPS, zones: () => ZONES, addCompanion: (fn) => { if (typeof fn === 'function') COMPANIONS.push(fn); },
    paused: () => !travelEl.hidden, pos: () => (cur ? { ...cur.pos } : null) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
