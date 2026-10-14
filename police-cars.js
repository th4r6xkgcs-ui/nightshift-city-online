/* Police vehicles (Claude-owned). Escalation on top of crime.js foot police + wanted-data.js stars:
 *  ★3  1 patrol car joins the hunt   ★4  2 cars + roadblocks ahead of you when you drive   ★5  3 cars incl. a SWAT van
 * Cars drive the street grid toward the last place police saw you (the search centre, or you when spotted). When
 * you're on foot they pull up and two officers jump out (into crime.js, so they search/arrest/shoot by its rules).
 * When you're driving they chase and try to ram you (slows you down, damages your car). Roadblocks are two cars
 * parked across an intersection ahead of you with officers behind them: go around, or smash through slowly.
 * Everything clears when you drop below the star level (or leave the city view). Lightbars flash at night and day.
 * v0.71 pursuit AI: ★1-2 a patrol car hunts you (no ramming). ★3+ cars predict where you're going and line up a PIT
 * on your rear quarter (spins you out) — but only when they have a clear line; otherwise they stay on the streets and
 * never drive through buildings. They swerve around traffic. Ram a cruiser hard and it spins out; three hits wrecks it
 * (smoking wreck, a replacement is radioed in later). ★5 adds a helicopter: its searchlight keeps updating where the
 * police think you are — outrun the light or get indoors. Civilian traffic pulls over for sirens and floors it away
 * from gunfire (wraps NightshiftTrafficSafety.speed). Pure helpers in NightshiftPursuit (Node-testable).
 * API: NightshiftPoliceCars.{cars, roadblocks, stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const E = () => { try { return { player, cars, world, camera, g, blocked: typeof blocked === 'function' ? blocked : null, bullets: typeof bullets !== 'undefined' ? bullets : [] }; } catch { return null; } };
  /* eslint-enable no-undef */
  const BW = 440, BH = 340, rnd = (a, b) => a + Math.random() * (b - a), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const chase = [], blocks = [];
  const st = { spawned: 0, rams: 0, drops: 0, roadblocks: 0 };
  const stars = (env) => { try { return root.NightshiftWantedData?.stars?.(env.player.heat) ?? 0; } catch { return 0; } };
  const want = (s) => (s >= 5 ? 3 : s >= 4 ? 2 : s >= 1 ? 1 : 0); // v0.71: a patrol car from ★1
  const wrecks = []; let heli = null;
  const inZone = () => { try { return !!(root.NightshiftZones?.active?.() || root.NightshiftHome?.kind?.()); } catch { return false; } };
  const node = (x, y) => ({ i: Math.round(x / BW), j: Math.round(y / BH) });
  const nodePos = (n) => ({ x: n.i * BW, y: n.j * BH });
  function maxNode(env) { return { i: Math.round(env.world.w / BW), j: Math.round(env.world.h / BH) }; }

  function spawnCar(env, swat) {
    const p = env.player, M = maxNode(env), cam = env.camera;
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2, d = rnd(650, 950), n = node(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      if (n.i < 1 || n.j < 1 || n.i > M.i - 1 || n.j > M.j - 1) continue;
      const q = nodePos(n); if (cam && q.x > cam.x - 40 && q.x < cam.x + 900 && q.y > cam.y - 40 && q.y < cam.y + 500) continue; // never pop in on screen
      chase.push({ id: 'pc-' + Date.now().toString(36) + k, x: q.x, y: q.y, angle: 0, model: swat ? 'VAN' : 'SEDAN', color: swat ? '#262c34' : '#1d2433', police: true, swat, at: n, next: null, speed: 0, dropped: 0, bumpUntil: 0, born: performance.now() });
      st.spawned++; return true;
    }
    return false;
  }
  // pick the neighbouring intersection that gets closest to the goal (no U-turns unless it's a dead end)
  function nextNode(env, c, goal) {
    const M = maxNode(env), opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => ({ i: c.at.i + di, j: c.at.j + dj })).filter((n) => n.i >= 0 && n.j >= 0 && n.i <= M.i && n.j <= M.j);
    const back = c.prev ? opts.filter((n) => !(n.i === c.prev.i && n.j === c.prev.j)) : opts;
    const list = back.length ? back : opts;
    list.sort((a, b) => dist(nodePos(a), goal) - dist(nodePos(b), goal));
    return Math.random() < 0.12 && list[1] ? list[1] : list[0];
  }
  function dropOfficers(c) {
    const C = root.NightshiftCrime; if (!C?.officers) return;
    const L = root.NightshiftWantedData?.level?.(E()?.player?.heat) || { hp: 60, swat: false };
    for (let k = 0; k < (c.swat ? 3 : 2); k++) {
      const a = (c.angle || 0) + (k % 2 ? Math.PI / 2 : -Math.PI / 2), x = c.x + Math.cos(a) * 26 + k * 4, y = c.y + Math.sin(a) * 26;
      C.officers.push({ x, y, hp: L.hp || 60, maxHp: L.hp || 60, swat: !!(c.swat || L.swat), role: 'officer', id: 'cop-car-' + Math.floor(Math.random() * 1e6), nextAttack: performance.now() + 1200, color: c.swat || L.swat ? '#2a3340' : '#7798de', angle: a, searchIndex: k * 2, slot: C.officers.length });
    }
    st.drops++;
  }
  const PU = root.NightshiftPursuit;
  const clearLine = (env, a, b2, r = 12) => { const N = root.NightshiftNavigation; if (!env.blocked || !N?.trace) return true; return !N.trace(a, b2, env.blocked, r); };
  function carTick(env, c, now, dt, s) {
    const p = env.player, W = root.NightshiftCrime?.wanted, seen = !!W?.seen;
    const goal = seen || !W?.center ? p : W.center;
    const pc = p.car, d = dist(c, pc || p), fast = pc ? 390 : 250;
    // spun out / stunned by the player's ram
    if (now < (c.stunUntil || 0)) { c.angle += (c.spin || 0) * dt; c.x += Math.cos(c.slideA || 0) * (c.slideV || 0) * dt; c.y += Math.sin(c.slideA || 0) * (c.slideV || 0) * dt; c.slideV = Math.max(0, (c.slideV || 0) - 300 * dt); if (env.blocked?.(c.x, c.y)) { c.x -= Math.cos(c.slideA) * 6; c.y -= Math.sin(c.slideA) * 6; c.slideV = 0; } c.speed = 0; c.offGrid = true; return; }
    // the player rams the cruiser: spin it out, three hits wreck it
    if (pc && d < 38 && Math.abs(pc.speed || 0) > 3.5 && now > (c.hitAt || 0) + 700 && PU.playerRams(pc, c)) {
      c.hitAt = now; c.hits = (c.hits || 0) + 1; c.stunUntil = now + 2200; c.spin = (Math.random() < 0.5 ? -1 : 1) * 7; c.slideA = pc.angle || 0; c.slideV = Math.abs(pc.speed) * 45; pc.speed = (pc.speed || 0) * 0.75;
      try { root.NightshiftVehicles?.hit?.(pc); root.NightshiftFeedback?.burst?.(c.x, c.y); } catch { /* n/a */ }
      if (c.hits >= 3) { c.wreck = true; c.wreckAt = now; wrecks.push(c); chase.splice(chase.indexOf(c), 1); tick.nextSpawn = now + 12000; st.wrecks = (st.wrecks || 0) + 1; try { root.say?.('💥 Cruiser wrecked!'); p.heat = (p.heat || 0) + 0.3; } catch { /* n/a */ } }
      else try { root.say?.('💥 You rammed the cruiser!'); } catch { /* n/a */ }
      return;
    }
    // ★3+: intercept a driving player — lead the target and go for a PIT on the rear quarter, only with a clear line
    if (pc && s >= 3 && d < 280 && now > c.bumpUntil) {
      const T = PU.intercept(c, pc, d);
      if (clearLine(env, c, T)) {
        const a = Math.atan2(T.y - c.y, T.x - c.x); c.angle += Math.atan2(Math.sin(a - c.angle), Math.cos(a - c.angle)) * Math.min(1, dt * 6);
        const v = Math.min(420, 300 + Math.abs(pc.speed || 0) * 14) * dt, nx = c.x + Math.cos(c.angle) * v, ny = c.y + Math.sin(c.angle) * v;
        if (!env.blocked?.(nx, ny)) { c.x = nx; c.y = ny; c.speed = v / dt / 60; c.offGrid = true; }
        if (d < 36) {
          c.bumpUntil = now + 4500; const pit = PU.isPit(c, pc);
          if (pit) { pc.angle = (pc.angle || 0) + pit * 1.1; pc.speed = (pc.speed || 0) * 0.35; st.pits = (st.pits || 0) + 1; try { root.say?.('🚓 PIT maneuver! You spin out'); } catch { /* n/a */ } }
          else { pc.speed = (pc.speed || 0) * 0.65; try { root.say?.('🚓 Rammed by police!'); } catch { /* n/a */ } }
          try { root.NightshiftVehicles?.hit?.(pc); root.NightshiftCombatVision?.engage?.(4000); } catch { /* n/a */ }
          c.x -= Math.cos(c.angle) * 24; c.y -= Math.sin(c.angle) * 24; st.rams++;
        }
        return;
      }
    }
    if (c.offGrid) { c.at = node(c.x, c.y); c.next = null; c.offGrid = false; }
    // ★1-2 patrol car close behind a driving player: tail them with the siren, no contact
    if (pc && s < 3 && d < 110) { c.speed = 0; return; }
    // on-foot player close by: pull up and drop officers
    if (!pc && d < 120 && seen && now - c.dropped > 20000) { c.dropped = now; c.speed = 0; dropOfficers(c); return; }
    if (!pc && d < 90) { c.speed = 0; return; }
    if (!c.next) { c.prev = c.at; c.next = nextNode(env, c, goal); }
    const t = nodePos(c.next), dx = t.x - c.x, dy = t.y - c.y, dd = Math.hypot(dx, dy);
    let v = Math.min(fast, 120 + dd * 2) * dt;
    if (dd <= v + 1) { c.x = t.x; c.y = t.y; c.at = c.next; c.next = null; return; }
    const ta = Math.atan2(dy, dx); c.angle += Math.atan2(Math.sin(ta - c.angle), Math.cos(ta - c.angle)) * Math.min(1, dt * 8);
    // swerve around traffic and parked cars ahead (overtake on the left), easing back to the lane when clear
    const others = (root.NightshiftTraffic?.actors || []).concat(env.cars, chase.filter((q) => q !== c));
    const sw = PU.swerve(c, ta, others);
    if (sw.brake) v *= 0.45;
    const ox = -Math.sin(ta) * sw.side * 70 * dt, oy = Math.cos(ta) * sw.side * 70 * dt;
    const nx = c.x + dx / dd * v + ox, ny = c.y + dy / dd * v + oy;
    if (!env.blocked?.(nx, ny)) { c.x = nx; c.y = ny; } else { c.x += dx / dd * v; c.y += dy / dd * v; }
    c.speed = v / dt / 60;
  }
  // roadblocks: two cars across an intersection ahead of a driving player
  let nextBlock = 0;
  function roadblockTick(env, now, s) {
    const p = env.player, pc = p.car;
    for (let i = blocks.length - 1; i >= 0; i--) { const b = blocks[i]; if (now > b.until || s < 4) { if (!env.camera || dist(b, p) > 700 || s < 4) { for (const car of b.cars) { const k = env.cars.indexOf(car); if (k >= 0) env.cars.splice(k, 1); } blocks.splice(i, 1); } } }
    if (s < 4 || !pc || Math.abs(pc.speed || 0) < 2 || now < nextBlock || blocks.length >= 2) return;
    nextBlock = now + rnd(20000, 30000);
    const a = pc.angle || 0, ahead = { x: pc.x + Math.cos(a) * 650, y: pc.y + Math.sin(a) * 650 }, n = node(ahead.x, ahead.y), q = nodePos(n), M = maxNode(env);
    if (n.i < 1 || n.j < 1 || n.i > M.i - 1 || n.j > M.j - 1) return;
    const horiz = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)), across = horiz ? Math.PI / 2 : 0, made = [];
    for (const off of [-26, 26]) { const car = { id: 'rb-' + Date.now().toString(36) + off, x: q.x + (horiz ? 0 : off), y: q.y + (horiz ? off : 0), angle: across + (off > 0 ? 0.25 : -0.25), model: 'SEDAN', color: '#1d2433', speed: 0, owner: false, locked: true, police: true, roadblock: true }; env.cars.push(car); made.push(car); }
    blocks.push({ x: q.x, y: q.y, cars: made, until: now + 45000 }); st.roadblocks++;
    const C = root.NightshiftCrime; if (C?.officers) for (let k = 0; k < 2; k++) { const back = horiz ? { x: q.x - Math.sign(Math.cos(a)) * -40, y: q.y + (k ? 30 : -30) } : { x: q.x + (k ? 30 : -30), y: q.y - Math.sign(Math.sin(a)) * -40 }; C.officers.push({ ...back, hp: 70, maxHp: 70, role: 'officer', id: 'cop-rb-' + Math.floor(Math.random() * 1e6), nextAttack: now + 1500, color: '#7798de', angle: a + Math.PI, searchIndex: k, slot: C.officers.length, mode: 'cover', inCover: true }); }
    try { root.say?.('🚧 Roadblock ahead!'); } catch { /* n/a */ }
  }
  // ★5 helicopter: follows with lag; while you're in its searchlight the police know exactly where you are
  function heliTick(env, now, dt, s) {
    const p = env.player, tgt = p.car || p;
    if (s < 5) { if (heli) { heli.leaving = true; heli.x += 260 * dt; heli.y -= 160 * dt; if (dist(heli, p) > 1200) heli = null; } return; }
    if (!heli || heli.leaving) heli = { x: tgt.x - 700, y: tgt.y - 500, lx: tgt.x - 600, ly: tgt.y - 400, born: now };
    const hm = PU.follow(heli, { x: tgt.x - 110, y: tgt.y - 130 }, 230, dt); // hovers off to the side so it never hides you heli.x = hm.x; heli.y = hm.y; const lm = PU.follow({ x: heli.lx, y: heli.ly }, tgt, 200, dt); heli.lx = lm.x; heli.ly = lm.y;
    heli.lit = Math.hypot(tgt.x - heli.lx, tgt.y - heli.ly) < 70;
    const W = root.NightshiftCrime?.wanted; if (heli.lit && W) { W.center = { x: tgt.x, y: tgt.y }; W.seenAt = now; }
  }
  // civilian traffic: pull over for sirens, floor it away from gunfire, and treat police cars as obstacles
  function hookTraffic() {
    const TS = root.NightshiftTrafficSafety; if (!TS || TS.__pursuit) return !!TS?.__pursuit;
    const s0 = TS.speed;
    TS.speed = function (actor, objects, dt, red) {
      const env = E(), now = performance.now(), extra = chase.concat(wrecks).map((c) => ({ x: c.x, y: c.y, angle: c.angle }));
      if (env && PU.nearShot(actor, env.bullets)) actor.panicUntil = now + 5000;
      const pace = actor.pace; if (now < (actor.panicUntil || 0)) actor.pace = pace * 1.7;
      let v; try { v = s0.call(this, actor, extra.length ? objects.concat(extra) : objects, dt, red); } finally { actor.pace = pace; }
      if (chase.some((c) => PU.yieldsTo(actor, c))) { actor.yieldUntil = now + 2500; }
      if (now < (actor.yieldUntil || 0)) v = Math.min(v, Math.max(0, (actor.velocity || 0) - 160 * (dt || 0)));
      return v;
    };
    TS.__pursuit = true; return true;
  }
  const th = setInterval(() => { if (hookTraffic()) clearInterval(th); }, 400);
  let last = 0;
  function tick(now) {
    const env = E(), dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    if (env && env.player && !inZone()) {
      const s = stars(env), n = want(s);
      if (chase.length < n && now > (tick.nextSpawn || 0)) { if (spawnCar(env, s >= 5 && !chase.some((c) => c.swat))) tick.nextSpawn = now + 5000; }
      for (let i = chase.length - 1; i >= 0; i--) { const c = chase[i]; if (chase.length > n && dist(c, env.player) > 800) { chase.splice(i, 1); continue; } carTick(env, c, now, dt, s); }
      roadblockTick(env, now, s);
      for (let i = wrecks.length - 1; i >= 0; i--) if (now - wrecks[i].wreckAt > 25000 || dist(wrecks[i], env.player) > 1400) wrecks.splice(i, 1);
      heliTick(env, now, dt, s);
    } else if (env && inZone()) { chase.length = 0; heli = null; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  // ---- draw: the cars + lightbars (and lightbars on roadblock cars, which live in the game's cars array) ----
  function lightbar(ctx, c, now) {
    const blink = Math.floor(now / 160 + (c.id || '').length) % 2;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle || 0);
    const halfW = c.model === 'VAN' ? 13 : 11;
    if (c.model !== 'VAN') { ctx.fillStyle = '#e8eef3'; ctx.fillRect(-9, -halfW + 1, 18, 3); ctx.fillRect(-9, halfW - 4, 18, 3); }
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(-3, -halfW + 2, 6, halfW * 2 - 4);
    ctx.fillStyle = blink ? '#ff3a4a' : '#5a1820'; ctx.fillRect(-2, -halfW + 3, 4, halfW - 3);
    ctx.fillStyle = blink ? '#1a2a6a' : '#3a7aff'; ctx.fillRect(-2, 0, 4, halfW - 3);
    ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 46); gl.addColorStop(0, blink ? '#ff3a4a55' : '#3a7aff55'); gl.addColorStop(1, '#00000000'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function draw() {
    const env = E(); if (!env || inZone()) return; const ctx = env.g, now = performance.now();
    for (const c of chase) { try { root.NightshiftSprites?.car?.(c); } catch { /* n/a */ } lightbar(ctx, c, now); }
    for (const b of blocks) for (const c of b.cars) lightbar(ctx, c, now);
    for (const w of wrecks) { try { root.NightshiftSprites?.car?.(w); } catch { /* n/a */ } ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.angle || 0); ctx.fillStyle = 'rgba(10,8,8,0.55)'; ctx.fillRect(-26, -13, 52, 26); ctx.restore(); const k = (now / 600) % 1; for (let i = 0; i < 3; i++) { const kk = (k + i / 3) % 1; ctx.fillStyle = `rgba(60,60,64,${0.45 * (1 - kk)})`; ctx.beginPath(); ctx.arc(w.x + 4 + kk * 10, w.y - 6 - kk * 34, 6 + kk * 12, 0, Math.PI * 2); ctx.fill(); } if (now - w.wreckAt < 1500) { ctx.fillStyle = `rgba(255,140,40,${0.6 * (1 - (now - w.wreckAt) / 1500)})`; ctx.beginPath(); ctx.arc(w.x, w.y, 30, 0, Math.PI * 2); ctx.fill(); } }
    if (heli) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(heli.lx, heli.ly, 4, heli.lx, heli.ly, 80); gl.addColorStop(0, heli.lit ? '#fff6d0aa' : '#fff6d066'); gl.addColorStop(1, '#fff6d000'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(heli.lx, heli.ly, 80, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = heli.lit ? '#fff6d02a' : '#fff6d018'; ctx.beginPath(); ctx.moveTo(heli.x - 4, heli.y + 6); ctx.lineTo(heli.lx - 60, heli.ly); ctx.lineTo(heli.lx + 60, heli.ly); ctx.lineTo(heli.x + 4, heli.y + 6); ctx.fill(); ctx.restore(); // beam
      ctx.fillStyle = 'rgba(5,8,14,0.3)'; ctx.beginPath(); ctx.ellipse(heli.x + 60, heli.y + 90, 22, 8, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(heli.x, heli.y); ctx.rotate(Math.atan2(heli.ly - heli.y, heli.lx - heli.x));
      ctx.fillStyle = '#0b0d14'; ctx.fillRect(-30, -2.5, 26, 5); ctx.beginPath(); ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1d2433'; ctx.beginPath(); ctx.ellipse(0, 0, 14.5, 8.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3a6ab0'; ctx.beginPath(); ctx.ellipse(6, 0, 6, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e8eef3'; ctx.fillRect(-26, -5, 3, 10);
      ctx.strokeStyle = 'rgba(200,210,220,0.5)'; ctx.lineWidth = 2; const ra = now / 40; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(Math.cos(ra + i * Math.PI / 2) * -24, Math.sin(ra + i * Math.PI / 2) * -24); ctx.lineTo(Math.cos(ra + i * Math.PI / 2) * 24, Math.sin(ra + i * Math.PI / 2) * 24); ctx.stroke(); }
      const blink = Math.floor(now / 300) % 2; ctx.fillStyle = blink ? '#ff3a4a' : '#3a7aff'; ctx.fillRect(-4, -11, 3, 3); ctx.restore();
    }
  }
  const hook = setInterval(() => { const C = root.NightshiftCrime; if (C && typeof C.draw === 'function' && !C.__pcars) { const d0 = C.draw; C.draw = function () { try { draw(); } catch { /* cosmetic */ } return d0.apply(this, arguments); }; C.__pcars = true; clearInterval(hook); } }, 300);
  root.NightshiftPoliceCars = Object.freeze({ cars: () => chase, roadblocks: () => blocks, wrecks: () => wrecks, heli: () => heli, stats: () => ({ ...st, cars: chase.length, blocks: blocks.length, wrecks: wrecks.length, heli: !!heli }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
