/* Police vehicles (Claude-owned). Escalation on top of crime.js foot police + wanted-data.js stars:
 *  ★3  1 patrol car joins the hunt   ★4  2 cars + roadblocks ahead of you when you drive   ★5  3 cars incl. a SWAT van
 * Cars drive the street grid toward the last place police saw you (the search centre, or you when spotted). When
 * you're on foot they pull up and two officers jump out (into crime.js, so they search/arrest/shoot by its rules).
 * When you're driving they chase and try to ram you (slows you down, damages your car). Roadblocks are two cars
 * parked across an intersection ahead of you with officers behind them: go around, or smash through slowly.
 * Everything clears when you drop below the star level (or leave the city view). Lightbars flash at night and day.
 * API: NightshiftPoliceCars.{cars, roadblocks, stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const E = () => { try { return { player, cars, world, camera, g }; } catch { return null; } };
  /* eslint-enable no-undef */
  const BW = 440, BH = 340, rnd = (a, b) => a + Math.random() * (b - a), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const chase = [], blocks = [];
  const st = { spawned: 0, rams: 0, drops: 0, roadblocks: 0 };
  const stars = (env) => { try { return root.NightshiftWantedData?.stars?.(env.player.heat) ?? 0; } catch { return 0; } };
  const want = (s) => (s >= 5 ? 3 : s >= 4 ? 2 : s >= 3 ? 1 : 0);
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
  function carTick(env, c, now, dt, s) {
    const p = env.player, W = root.NightshiftCrime?.wanted, seen = !!W?.seen;
    const goal = seen || !W?.center ? p : W.center;
    const pc = p.car, d = dist(c, pc || p), fast = pc ? 390 : 250;
    // close in on a driving player: leave the grid and ram
    if (pc && d < 170 && now > c.bumpUntil) {
      const a = Math.atan2(pc.y - c.y, pc.x - c.x); c.angle += Math.atan2(Math.sin(a - c.angle), Math.cos(a - c.angle)) * Math.min(1, dt * 6);
      c.x += Math.cos(c.angle) * 360 * dt; c.y += Math.sin(c.angle) * 360 * dt; c.speed = 6; c.offGrid = true;
      if (d < 36) { c.bumpUntil = now + 4500; pc.speed = (pc.speed || 0) * 0.65; try { root.NightshiftVehicles?.hit?.(pc); } catch { /* n/a */ } c.x -= Math.cos(c.angle) * 24; c.y -= Math.sin(c.angle) * 24; st.rams++; try { root.say?.('🚓 Rammed by police!'); root.NightshiftCombatVision?.engage?.(4000); } catch { /* n/a */ } }
      return;
    }
    if (c.offGrid) { c.at = node(c.x, c.y); c.next = null; c.offGrid = false; }
    // on-foot player close by: pull up and drop officers
    if (!pc && d < 120 && seen && now - c.dropped > 20000) { c.dropped = now; c.speed = 0; dropOfficers(c); return; }
    if (!pc && d < 90) { c.speed = 0; return; }
    if (!c.next) { c.prev = c.at; c.next = nextNode(env, c, goal); }
    const t = nodePos(c.next), dx = t.x - c.x, dy = t.y - c.y, dd = Math.hypot(dx, dy);
    const lane = 18, lx = Math.abs(dx) > Math.abs(dy) ? 0 : (dy > 0 ? -lane : lane), ly = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? lane : -lane) : 0;
    const v = Math.min(fast, 120 + dd * 2) * dt;
    if (dd <= v + 1) { c.x = t.x; c.y = t.y; c.at = c.next; c.next = null; return; }
    const ta = Math.atan2(dy, dx); c.angle += Math.atan2(Math.sin(ta - c.angle), Math.cos(ta - c.angle)) * Math.min(1, dt * 8);
    c.x += dx / dd * v + (lx - ((c.lx || 0))) * 0.0; c.y += dy / dd * v; c.lx = lx; c.ly = ly; c.speed = v / dt / 60;
    void s;
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
  let last = 0;
  function tick(now) {
    const env = E(), dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    if (env && env.player && !inZone()) {
      const s = stars(env), n = want(s);
      if (chase.length < n && now > (tick.nextSpawn || 0)) { if (spawnCar(env, s >= 5 && !chase.some((c) => c.swat))) tick.nextSpawn = now + 5000; }
      for (let i = chase.length - 1; i >= 0; i--) { const c = chase[i]; if (chase.length > n && dist(c, env.player) > 800) { chase.splice(i, 1); continue; } carTick(env, c, now, dt, s); }
      roadblockTick(env, now, s);
    } else if (env && inZone()) { chase.length = 0; }
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
  }
  const hook = setInterval(() => { const C = root.NightshiftCrime; if (C && typeof C.draw === 'function' && !C.__pcars) { const d0 = C.draw; C.draw = function () { try { draw(); } catch { /* cosmetic */ } return d0.apply(this, arguments); }; C.__pcars = true; clearInterval(hook); } }, 300);
  root.NightshiftPoliceCars = Object.freeze({ cars: () => chase, roadblocks: () => blocks, stats: () => ({ ...st, cars: chase.length, blocks: blocks.length }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
