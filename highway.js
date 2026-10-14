/* Route 9 highway mode (Claude-owned, v0.66). Requires highway-data.js, cars.js (sprites).
 * Drive off the city at one of the six edge on-ramps (green ROUTE 9 signs) and the game switches to the highway:
 *  - side-on top-down view, four eastbound lanes + a shoulder, oncoming lanes over the median, camera pulls back
 *    with speed; stick RIGHT = gas, LEFT / BRAKE = brake, UP/DOWN = change lanes, NOS = nitro;
 *  - traffic that keeps to its lanes and signals before changing lanes; near misses build a streak multiplier
 *    (cash paid out when you get off);
 *  - speed cameras (120 limit, tickets over 150, heat over 200); police pursuit by wanted stars: cruisers that
 *    ram, spike strips at 3 stars, roadblocks + a helicopter at 4+; lose them by out-running them;
 *  - Mika, Jules and Rook cruise the highway: pull alongside and tap RACE (race to the exit after next);
 *  - Route 9 services rest stop: Last Light Fuel (fuel/repair/nitro), Rook's Tuning, the meet (challenge a
 *    regular), highway runs (deliver to an exit before the clock runs out);
 *  - take any exit (move onto the shoulder at the EXIT sign) to drop back into that part of the city.
 * The city is paused while you're on the highway (NightshiftHome render hooks, like zones.js).
 * Save: nightshift-highway-v1. API: NightshiftHighway.{active, enter, leave, state, stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const H = root.NightshiftHighwayData; if (!H) return;
  const KEY = 'nightshift-highway-v1';
  let save0 = H.clean({}); try { save0 = H.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save0)); } catch { /* private */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const SW = () => { try { return W; } catch { return innerWidth; } };
  const SHt = () => { try { return globalThis.eval('H'); } catch { return innerHeight; } };
  const KEYS = () => { try { return keys; } catch { return {}; } };
  const JOY = () => { try { return joy; } catch { return { x: 0, y: 0 }; } };
  const FIRE = () => { try { return !!(firing || mouseFire || keys[' ']); } catch { return false; } };
  const gameSave = () => { try { save(); } catch { /* n/a */ } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* n/a */ } };
  const text = (from, msg) => { try { root.NightshiftPhone?.text?.(from, msg); } catch { say(msg); } };
  const emit = (detail) => { try { root.dispatchEvent(new CustomEvent('ns:event', { detail })); } catch { /* n/a */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const rel = (d, me) => { let r = H.wrap(d - me); if (r > H.LOOP / 2) r -= H.LOOP; return r; };
  const CD = () => root.NightshiftCarsData;
  const st = { enters: 0, exits: 0, crashes: 0, nearMiss: 0, tickets: 0, races: 0, wins: 0, frames: 0 };
  let A = null; // the active highway session

  // ---------- enter / leave ----------
  function specOf(car) { return CD()?.fromModel?.(car?.model) || null; }
  function spriteId(car) { const sp = specOf(car); return sp ? sp.id : (['SEDAN', 'COMPACT', 'VAN'].includes(car?.model) ? car.model : 'SEDAN'); }
  function enter(i) {
    const p = P(); if (!p?.car || A) return false;
    const car = p.car, spec = specOf(car), perf = H.perf(spec || { max: 7, accel: 0.22, steer: 0.038 });
    A = { i, d: H.entryAt(i), y: H.SHOULDER[0] + 14, v: H.pxs(70), car, perf, spec, sid: spriteId(car), traffic: [], oncoming: [], cops: [], spikes: [], blocks: [], heli: null,
      streak: 0, bestStreak: 0, cash: 0, fines: 0, t0: performance.now(), fade: 1, shake: 0, flash: 0, last: 0, lastCamD: H.entryAt(i), racer: null, race: null, run: null, msg: null, nextRacer: performance.now() + 25000 + Math.random() * 20000, spikesNext: 0, busted: 0, rest: false, smoke: [], marks: [], km0: 0 };
    A.vehicle = { v: A.v, fuel: car.fuel ?? 100, condition: car.condition ?? 100, spikes: false };
    seedTraffic(); st.enters++;
    try { root.releaseControls?.(); } catch { /* n/a */ }
    say(`🛣️ Route 9 · ${H.EXITS[i].name} on-ramp · stick right = gas, up/down = lanes`);
    emit({ type: 'highway', on: true, from: H.EXITS[i].id });
    return true;
  }
  function leave(i, why) {
    const p = P(); if (!A || !p) return;
    const e = H.EXITS[i], car = A.car;
    car.fuel = A.vehicle.fuel; car.condition = A.vehicle.condition;
    car.x = e.into.x; car.y = e.into.y; car.angle = e.into.angle; car.speed = Math.min(4, A.vehicle.v * H.KMH / 30);
    p.x = car.x; p.y = car.y;
    const km = Math.round((performance.now() - A.t0) / 1000 * 0) ; void km;
    let pay = A.cash; if (pay > 0) { p.cash += pay; }
    if (A.run && A.run.to === i) { const left = A.run.until - performance.now(); if (left > 0) { p.cash += A.run.pay; save0.runs++; text('city', `📦 ${A.run.name} delivered at ${e.name} · +${money(A.run.pay)}`); try { root.NightshiftSkills?.gain?.('driving', 60, 'highway-run'); } catch { /* n/a */ } } else text('city', `📦 ${A.run.name} · too late, no pay`); A.run = null; }
    save0.bestStreak = Math.max(save0.bestStreak, A.bestStreak); persist();
    say(`🛣️ Exit ${i + 1} · ${e.name}${pay ? ` · near-miss streaks +${money(pay)}` : ''}${A.fines ? ` · tickets −${money(A.fines)}` : ''}${why ? ' · ' + why : ''}`);
    try { root.NightshiftVehicles?.save?.(); root.NightshiftCars?.sync?.(); } catch { /* n/a */ }
    emit({ type: 'highway', on: false, exit: e.id, cash: pay });
    pendingRun = A.run; A = null; st.exits++; gameSave();
  }
  let pendingRun = null;

  // ---------- traffic ----------
  function seedTraffic() {
    A.traffic.length = 0; A.oncoming.length = 0;
    for (let k = 0; k < 16; k++) { const lane = Math.floor(Math.random() * H.LANES); A.traffic.push(H.trafficCar(Math.random, H.wrap(A.d - 1200 + k * 360 + Math.random() * 200), lane)); }
    for (let k = 0; k < 10; k++) A.oncoming.push({ d: H.wrap(A.d + k * 500), lane: k % 4, v: H.pxs(90 + Math.random() * 40), model: ['SEDAN', 'COMPACT', 'VAN'][k % 3], color: ['#c84659', '#e8e6e0', '#3d7fc6', '#1d2024'][k % 4] });
  }
  function trafficTick(dt) {
    const me = A.d;
    for (const t of A.traffic) {
      // keep distance from the car in front, or change lanes
      let front = null, fd = 1e9; for (const o of A.traffic) { if (o === t || o.lane !== t.lane) continue; const r = rel(o.d, t.d); if (r > 0 && r < fd) { fd = r; front = o; } }
      const want = t.base || (t.base = t.v);
      if (front && fd < 170) { t.v = Math.max(front.v - 20, t.v - 260 * dt); if (!t.change && Math.random() < dt * 0.8) { const to = t.lane + (Math.random() < 0.5 ? -1 : 1); if (to >= 0 && to < H.LANES && !A.traffic.some((o) => o !== t && o.lane === to && Math.abs(rel(o.d, t.d)) < 140)) { t.change = { to, at: performance.now() + 800 }; } } }
      else t.v = Math.min(want, t.v + 120 * dt);
      if (t.change && performance.now() > t.change.at) { t.lane = t.change.to; t.change = null; }
      const ty = H.laneY(t.lane); t.y += Math.max(-60 * dt, Math.min(60 * dt, ty - t.y));
      t.d = H.wrap(t.d + t.v * dt);
      // recycle cars that fall far behind / run far ahead
      const r = rel(t.d, me);
      if (r < -1500 || r > 4200) { const lane = Math.floor(Math.random() * H.LANES); const n = H.trafficCar(Math.random, H.wrap(me + (A.vehicle.v > t.v ? 2600 + Math.random() * 1400 : -1300 - Math.random() * 200)), lane); if (!A.traffic.some((o) => o.lane === lane && Math.abs(rel(o.d, n.d)) < 200)) Object.assign(t, n, { base: 0, near: false }); }
    }
    for (const o of A.oncoming) { o.d = H.wrap(o.d - o.v * dt); if (rel(o.d, me) < -1400) { o.d = H.wrap(me + 3000 + Math.random() * 1000); o.lane = Math.floor(Math.random() * 4); } }
  }
  // ---------- collisions + near misses ----------
  function hitTest(o, len, wid) { const dx = rel(o.d, A.d), dy = o.y - A.y; return Math.abs(dx) < (len + 52) / 2 - 3 && Math.abs(dy) < (wid + 24) / 2 - 2 ? { dx, dy } : null; }
  function crash(o, h, kind) {
    const V = A.vehicle, rv = Math.abs(V.v - (o.v || 0)), impact = Math.min(1, rv / 600);
    if (h.dx > 0) { V.v = Math.min(V.v, (o.v || 0) * 0.92); if (o.v !== undefined) o.v += rv * 0.3; } else if (o.v !== undefined) { o.v = Math.min(o.v, V.v * 0.9); }
    A.y += Math.sign(-h.dy || 1) * 10; V.condition = Math.max(0, V.condition - (4 + impact * 22) * (kind === 'cop' ? 0.6 : 1));
    A.shake = Math.min(14, 4 + impact * 14); if (A.streak) say(`💥 Streak lost (${A.streak})`); A.streak = 0; st.crashes++;
    for (let k = 0; k < 8; k++) A.smoke.push({ d: A.d + (h.dx > 0 ? 26 : -26), y: A.y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, life: 0.6, col: '230,220,200' });
    try { root.NightshiftAudio?.play?.('impact'); } catch { /* n/a */ }
    if (V.condition <= 0) { A.wreck = true; }
  }
  function contacts() {
    for (const t of A.traffic) {
      const h = hitTest(t, t.len, t.wid); if (h) { crash(t, h, 'traffic'); continue; }
      const r = rel(t.d, A.d);
      if (r < 0 && r > -80 && !t.near && t.wasAhead && H.nearMiss({ y: A.y, v: A.vehicle.v }, t)) { t.near = true; A.streak++; A.bestStreak = Math.max(A.bestStreak, A.streak); const pay = H.nearMissPay(A.streak); A.cash += pay; st.nearMiss++; save0.nearMiss++; pop(`NEAR MISS +$${pay}${A.streak >= 3 ? ` · x${H.streakMult(A.streak)}` : ''}`, '#7cffb5'); }
      t.wasAhead = r > 0; if (r > 60) t.near = false;
    }
    for (const c of A.cops) { const h = hitTest(c, 54, 26); if (h && !c.hitCool) { crash(c, h, 'cop'); c.hitCool = 0.8; } }
    for (const b of A.blocks) for (const c of b.cars) { const h = hitTest({ d: c.d, y: c.y, v: 0 }, 54, 28); if (h) { crash({ v: 0 }, h, 'block'); A.vehicle.v *= 0.4; } }
    for (const s of A.spikes) { if (s.hit) continue; const r = rel(s.d, A.d); if (Math.abs(r) < 20 && A.y > s.y0 && A.y < s.y1) { s.hit = true; A.vehicle.spikes = true; A.vehicle.condition = Math.max(0, A.vehicle.condition - 12); say('💥 Spike strip! Tyres shredded · top speed way down · get off at the next exit'); A.shake = 10; } }
  }
  const pops = []; function pop(t, col) { pops.push({ t, col, at: performance.now() }); if (pops.length > 4) pops.shift(); }

  // ---------- police ----------
  const stars = () => { try { return root.NightshiftWantedData?.stars?.(P()?.heat || 0) || 0; } catch { return 0; } };
  function policeTick(dt, now) {
    const S = stars(), want = H.units(S), p = P();
    while (A.cops.length < want) A.cops.push({ d: H.wrap(A.d - 900 - A.cops.length * 260), y: H.laneY(A.cops.length % H.LANES), v: A.vehicle.v + H.pxs(20), id: 'hwcop' + Math.random(), hitCool: 0 });
    while (A.cops.length > want) A.cops.pop();
    let nearest = 1e9;
    for (const c of A.cops) {
      const r = rel(c.d, A.d); nearest = Math.min(nearest, Math.abs(r));
      const top = H.pxs(S >= 4 ? 260 : 220);
      const target = r < -60 ? Math.min(top, A.vehicle.v + H.pxs(35)) : r > 120 ? Math.max(0, A.vehicle.v - H.pxs(30)) : A.vehicle.v; // catch up, then pace you
      c.v += Math.max(-500 * dt, Math.min(260 * dt, target - c.v));
      // weave around traffic toward your lane, PIT when alongside
      let ty = A.y; for (const t of A.traffic) { const tr = rel(t.d, c.d); if (tr > 0 && tr < 160 && Math.abs(t.y - c.y) < 30) { ty = c.y + (c.y < H.BOTTOM / 2 ? 46 : -46); break; } }
      c.y += Math.max(-120 * dt, Math.min(120 * dt, ty - c.y)); c.y = Math.max(14, Math.min(H.SHOULDER[1] - 12, c.y));
      c.d = H.wrap(c.d + c.v * dt); c.hitCool = Math.max(0, (c.hitCool || 0) - dt);
      if (Math.abs(r) < 46 && Math.abs(c.y - A.y) < 40 && !c.pit && S >= 2) { c.pit = 1.6; A.y += Math.sign(A.y - c.y || 1) * 18; A.vehicle.v *= 0.85; A.shake = 8; pop('PIT MANEUVER', '#ff8a7a'); }
      c.pit = Math.max(0, (c.pit || 0) - dt);
    }
    // spikes at 3+, roadblock at 4+, helicopter at 4+
    if (S >= 3 && now > A.spikesNext) { A.spikesNext = now + 16000; const l0 = Math.floor(Math.random() * 3); A.spikes.push({ d: H.wrap(A.d + 2600), y0: H.laneY(l0) - 22, y1: H.laneY(l0 + 1) + 22 }); }
    A.spikes = A.spikes.filter((s) => rel(s.d, A.d) > -800);
    if (S >= 4 && !A.blocks.length) { const ex = H.nextExit(A.d); if (ex && ex.dist > 2500) { const at = H.wrap(H.exitAt(ex.i) - 1600), gap = Math.floor(Math.random() * 3); A.blocks.push({ d: at, cars: [0, 1, 2, 3].filter((k) => k !== gap).map((k) => ({ d: at, y: H.laneY(k) })) }); pop('ROADBLOCK AHEAD · find the gap', '#ff5a6a'); } }
    A.blocks = A.blocks.filter((b) => rel(b.d, A.d) > -800);
    A.heli = S >= 4 ? (A.heli || { d: A.d - 400, y: A.y }) : null;
    if (A.heli) { A.heli.d = H.wrap(A.heli.d + (A.vehicle.v + Math.max(-200, Math.min(200, rel(A.d + 60, A.heli.d)))) * dt); A.heli.y += (A.y - A.heli.y) * dt * 2; }
    if (S > 0 && H.evade(A, A.heli ? nearest + 0 : nearest, dt, S) && !A.heli) { p.heat = Math.max(0, S - 1 - 0.01); pop(p.heat > 0.1 ? `Lost them · ${'★'.repeat(stars())} still looking` : 'You got away', '#7cffb5'); }
    if (A.heli && nearest > 1600) { A.heliLost = (A.heliLost || 0) + dt; if (A.heliLost > 20) { A.heli = null; A.heliLost = 0; p.heat = 3.4; pop('Chopper lost you', '#7cffb5'); } } else if (A.heli) A.heliLost = 0;
    // busted: stopped with a cruiser on you
    if (S > 0 && A.vehicle.v < H.pxs(15) && A.cops.some((c) => Math.abs(rel(c.d, A.d)) < 90)) { A.busted += dt; if (A.busted > 2.5) { const fine = Math.min(p.cash, 200 + S * 200); p.cash -= fine; p.heat = 0; A.cops.length = 0; A.busted = 0; const ex = H.nextExit(A.d); leave(ex.i, `🚔 BUSTED · fine ${money(fine)}`); return; } } else A.busted = Math.max(0, A.busted - dt);
  }

  // ---------- racers ----------
  function racerTick(dt, now) {
    if (!A.racer && !A.race && now > A.nextRacer) { const R0 = H.RACERS[Math.floor(Math.random() * H.RACERS.length)], sp = CD()?.BY?.[R0.car]; A.racer = { ...R0, d: H.wrap(A.d - 700), y: H.laneY(1), v: A.vehicle.v + H.pxs(40), perf: H.perf(sp), sid: sp ? sp.id : 'SEDAN', lane: 1 }; pop(`${R0.name} is coming up behind you (${sp?.name || ''})`, '#ffd970'); }
    const r = A.racer; if (!r) return;
    const racing = !!A.race, top = r.perf.top * (racing ? 0.93 * r.skill : 0.62);
    let target = racing ? top : Math.min(top, A.vehicle.v + H.pxs(10));
    // weave
    let block = null; for (const t of A.traffic) { const tr = rel(t.d, r.d); if (tr > 0 && tr < 220 && Math.abs(t.y - r.y) < 30) { block = t; break; } }
    if (block) { const up = r.y > 40 && !A.traffic.some((t) => Math.abs(rel(t.d, r.d)) < 160 && Math.abs(t.y - (r.y - H.LANE)) < 26); r.ty = up ? r.y - H.LANE : r.y + H.LANE; target = Math.min(target, block.v + (racing ? 40 : 0)); }
    if (r.ty !== undefined) { r.y += Math.max(-140 * dt, Math.min(140 * dt, r.ty - r.y)); if (Math.abs(r.ty - r.y) < 1) r.ty = undefined; }
    r.y = Math.max(16, Math.min(H.BOTTOM - 16, r.y));
    r.v += Math.max(-600 * dt, Math.min(r.perf.accel * 0.9 * dt, target - r.v)); r.d = H.wrap(r.d + r.v * dt);
    const h = hitTest(r, 54, 26); if (h) { crash(r, h, 'racer'); }
    if (racing) {
      const R = A.race, mine = H.ahead(R.start, A.d), theirs = H.ahead(R.start, r.d);
      R.mine = mine; R.theirs = theirs;
      if (mine >= R.length || theirs >= R.length) {
        const won = mine >= R.length && mine - R.length >= theirs - R.length - 0.0001 && !(theirs >= R.length && theirs > mine); st.races++;
        if (won) { const p = P(); p.cash += R.pay; st.wins++; save0.wins[r.id] = (save0.wins[r.id] || 0) + 1; persist(); pop(`🏁 YOU BEAT ${r.name.toUpperCase()} · +${money(R.pay)}`, '#ffd970'); text('nia', `${r.name} lost to you on Route 9. People are going to hear about that.`); try { root.NightshiftSkills?.gain?.('driving', 120, 'highway-race'); } catch { /* n/a */ } emit({ type: 'race', id: 'hw-' + r.id, medal: 'gold', secs: (performance.now() - R.t0) / 1000 }); }
        else pop(`🏁 ${r.name} wins this one`, '#ff8a7a');
        A.race = null; A.racer = null; A.nextRacer = now + 40000 + Math.random() * 30000;
      }
    } else if (Math.abs(rel(r.d, A.d)) > 3000) { A.racer = null; A.nextRacer = now + 30000; }
  }
  function startRace() {
    if (!A?.racer || A.race) return; const R = H.race(A.d, A.racer); A.race = { ...R, start: A.d, t0: performance.now(), mine: 0, theirs: 0 };
    pop(`🏁 RACE ${A.racer.name.toUpperCase()} · first to EXIT ${H.EXITS.findIndex((e) => e.id === R.exit) + 1} · ${money(R.pay)}`, '#ffd970');
    A.racer.d = H.wrap(A.d + (rel(A.racer.d, A.d) > 0 ? 0 : 0)); A.racer.v = Math.max(A.racer.v, A.vehicle.v);
  }

  // ---------- frame ----------
  function update(now) {
    const dt = A.last ? Math.min(0.05, (now - A.last) / 1000) : 0; A.last = now; if (A.rest) return;
    const j = JOY(), k = KEYS(), V = A.vehicle;
    const jx = (j.x || 0) + (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0), jy = (j.y || 0) + (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
    const throttle = Math.max(0, Math.min(1, jx * 1.5)), brake = Math.max(FIRE() ? 1 : 0, Math.max(0, Math.min(1, -jx * 1.5)));
    let nos = false; try { nos = document.querySelector('#nos')?.dataset?.held === 'true' || !!k.n; } catch { /* n/a */ }
    if (nos && !(A.car.nitro > 0)) nos = false; if (nos) A.car.nitro = Math.max(0, A.car.nitro - 28 * dt);
    V.v = A.vehicle.v; H.step(V, A.perf, { throttle, brake, nitro: nos, dt }); A.nos = nos;
    const steerK = 0.35 + 0.65 * Math.min(1, V.v / H.pxs(70));
    A.vy = Math.max(-1, Math.min(1, jy)) * A.perf.steer * steerK; A.y += A.vy * dt;
    if (A.y < 14) { A.y = 14; if (V.v > H.pxs(40)) { V.v *= Math.pow(0.6, dt); A.shake = Math.max(A.shake, 3); if (Math.random() < 0.6) A.smoke.push({ d: A.d + 20, y: 4, vx: -60, vy: -20, life: 0.25, col: '255,220,150', glow: true }); } }
    if (A.y > H.SHOULDER[1] - 12) A.y = H.SHOULDER[1] - 12;
    if (A.y > H.BOTTOM + 4 && V.v > H.pxs(90)) V.v *= Math.pow(0.85, dt); // rumble strip
    A.d = H.wrap(A.d + V.v * dt); save0.km += V.v * dt * H.M / 1000;
    trafficTick(dt); contacts(); policeTick(dt, now); if (!A) return; racerTick(dt, now);
    // speed cameras
    for (const cd of H.CAMERAS) { const before = rel(cd, A.d - V.v * dt), after = rel(cd, A.d); if (before > 0 && after <= 0) { const t = H.camera(V.v); if (t) { const p = P(); A.flash = 1; A.fines += t.fine; p.cash = Math.max(0, p.cash - t.fine); st.tickets++; save0.tickets++; pop(`📸 SPEED CAMERA · ${t.kmh} km/h · ticket ${money(t.fine)}`, '#ffffff'); if (t.heat) { p.heat = Math.max(p.heat || 0, 1); try { root.NightshiftCrime?.report?.(p, now, 'camera'); } catch { /* n/a */ } } } } }
    // exits + rest stop (shoulder at the ramp)
    if (A.y > H.BOTTOM + 6) {
      for (let i = 0; i < H.EXITS.length; i++) { const r = rel(H.exitAt(i), A.d); if (r < 40 && r > -500 && H.ahead(H.entryAt(i) - 600, A.d) > 1200) { leave(i); return; } }
      const rr = rel(H.REST.at, A.d); if (rr < 40 && rr > -400 && !A.restDone) { openRest(); return; }
    }
    if (rel(H.REST.at, A.d) < -600) A.restDone = false;
    if (A.wreck) { const ex = H.nextExit(A.d); const p = P(); const tow = Math.min(p.cash, 250); p.cash -= tow; A.vehicle.condition = 20; leave(ex.i, `🛻 Totaled · towed off · −${money(tow)}`); return; }
    // fx life
    for (let i = A.smoke.length - 1; i >= 0; i--) { const s = A.smoke[i]; s.life -= dt; s.d = H.wrap(s.d + (s.vx + (s.glow ? 0 : V.v * 0.85)) * dt); s.y += s.vy * dt; if (s.life <= 0) A.smoke.splice(i, 1); }
    if (A.nos && Math.random() < 0.8) A.smoke.push({ d: A.d - 30, y: A.y + (Math.random() - 0.5) * 6, vx: -200, vy: 0, life: 0.18, col: '120,200,255', glow: true });
    if (V.condition < 35 && Math.random() < (V.condition < 15 ? 0.5 : 0.2)) A.smoke.push({ d: A.d + 22, y: A.y - 4, vx: -60, vy: -20, life: 0.9, col: V.condition < 15 ? '40,40,44' : '150,150,155' });
    if (A.smoke.length > 120) A.smoke.splice(0, A.smoke.length - 120);
    A.shake *= Math.pow(0.02, dt); A.flash = Math.max(0, A.flash - dt * 3); A.fade = Math.max(0, A.fade - dt * 3);
    raceButton();
  }

  // ---------- drawing ----------
  const night = () => { try { return root.NightshiftEnvironment?.darkness?.(root.NightshiftEnvironment.state?.minute ?? 720) || 0; } catch { return 0; } };
  const rainAmt = () => { try { return root.NightshiftEnvironment?.weather?.(root.NightshiftEnvironment.state?.minute ?? 720) || 0; } catch { return 0; } };
  function carSprite(id, color) { try { return root.NightshiftCars?.sprite?.(id, color); } catch { return null; } }
  function drawCar(c, sx, sy, id, color, ang = 0, scale = 1) {
    const s = carSprite(id, color); c.save(); c.translate(sx, sy); c.rotate(ang);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-26 * scale + 3, -12 * scale + 4, 52 * scale, 24 * scale);
    if (s) c.drawImage(s.cv, -s.w / 2 * scale, -s.h / 2 * scale, s.w * scale, s.h * scale); else { c.fillStyle = color; c.fillRect(-26, -12, 52, 24); }
    c.restore();
  }
  function frame(now) {
    if (!A) return; update(now); if (!A) return; st.frames++;
    const c = G(), Wd = SW(), Hd = SHt(), V = A.vehicle, n = night(), rn = rainAmt();
    const z = Math.min(1.15, Hd / 470) * (1 - 0.22 * Math.min(1, V.v / H.pxs(260)));
    const px0 = Wd * 0.26, cy = A.y * 0.35 + 30, sh = A.shake;
    const X = (d) => px0 + rel(d, A.d) * z + (Math.random() - 0.5) * sh, Y = (y) => Hd / 2 + (y - cy) * z + (Math.random() - 0.5) * sh * 0.5;
    const span = Wd / z + 200, d0 = A.d - px0 / z - 100;
    c.save(); c.setTransform(c.getTransform());
    // ground + sky band
    c.fillStyle = n > 0.4 ? '#0d1a14' : '#2f4a2c'; c.fillRect(0, 0, Wd, Hd);
    // far skyline above the oncoming lanes (parallax)
    const skyY = Y(-200);
    if (skyY > 0) { c.fillStyle = n > 0.4 ? '#0a0f1c' : '#9fb7c9'; c.fillRect(0, 0, Wd, skyY); for (let k = -1; k < Wd / 46 + 2; k++) { const off = ((A.d * 0.08 * z) % 46), bx = k * 46 - off, h0 = 30 + ((Math.floor((A.d * 0.08) / 46) + k) * 7919 % 9) * 12; c.fillStyle = n > 0.4 ? '#141c2e' : '#6f8296'; c.fillRect(bx, skyY - h0 * z, 40, h0 * z); if (n > 0.4) { c.fillStyle = '#ffd38a'; for (let w = 0; w < 6; w++) if ((k * 31 + w * 7 + Math.floor((A.d * 0.08) / 46)) % 3 === 0) c.fillRect(bx + 5 + (w % 3) * 11, skyY - h0 * z + 6 + Math.floor(w / 3) * 12, 4, 5); } } }
    // road
    const top = Y(-186), mid = Y(-6), bot = Y(H.SHOULDER[1] + 2);
    c.fillStyle = '#23272d'; c.fillRect(0, top, Wd, bot - top);
    c.fillStyle = '#1d2126'; c.fillRect(0, Y(H.BOTTOM), Wd, Y(H.SHOULDER[1]) - Y(H.BOTTOM)); // shoulder
    // texture streaks
    c.fillStyle = 'rgba(255,255,255,0.03)'; for (let k = 0; k < 30; k++) { const dd = Math.floor(d0 / 97) * 97 + k * 97; const xx = X(dd); c.fillRect(xx, Y(((dd * 13) % 170)), 30 * z, 1); }
    // median barrier + oncoming centre line
    c.fillStyle = '#9aa3ab'; c.fillRect(0, Y(-9), Wd, 8 * z); c.fillStyle = '#5d646b'; c.fillRect(0, Y(-3), Wd, 2 * z); c.fillStyle = '#e2b75c'; c.fillRect(0, Y(-14), Wd, 2 * z);
    // lane dashes (eastbound + oncoming)
    c.fillStyle = '#e8eef3'; const dash = 120, dl = 52;
    for (let lane = 1; lane < H.LANES; lane++) { const yy = Y(lane * H.LANE); for (let dd = Math.floor(d0 / dash) * dash; dd < d0 + span; dd += dash) c.fillRect(X(dd), yy - 1, dl * z, 2.4 * z); }
    for (let lane = 1; lane < 4; lane++) { const yy = Y(-14 - lane * H.LANE); for (let dd = Math.floor(d0 / dash) * dash; dd < d0 + span; dd += dash) c.fillRect(X(dd), yy - 1, dl * z, 2.4 * z); }
    c.fillRect(0, Y(2), Wd, 2.4 * z); c.fillRect(0, Y(H.BOTTOM), Wd, 2.4 * z); c.fillRect(0, Y(-184), Wd, 2 * z);
    // rumble strip
    c.fillStyle = 'rgba(255,255,255,0.18)'; for (let dd = Math.floor(d0 / 16) * 16; dd < d0 + span; dd += 16) c.fillRect(X(dd), Y(H.BOTTOM + 4), 6 * z, 6 * z);
    // guardrail + posts
    c.fillStyle = '#7d8796'; c.fillRect(0, Y(H.SHOULDER[1] + 4), Wd, 4 * z); for (let dd = Math.floor(d0 / 80) * 80; dd < d0 + span; dd += 80) { c.fillStyle = '#4a5562'; c.fillRect(X(dd), Y(H.SHOULDER[1] + 3), 3 * z, 9 * z); }
    // exit ramps + rest stop
    for (let i = 0; i < H.EXITS.length; i++) {
      const ed = H.exitAt(i), xr = X(ed); if (xr < -900 || xr > Wd + 900) continue;
      c.fillStyle = '#23272d'; c.beginPath(); c.moveTo(X(ed - 900), Y(H.BOTTOM)); c.lineTo(xr, Y(H.BOTTOM)); c.lineTo(X(ed + 500), Y(H.SHOULDER[1] + 140)); c.lineTo(X(ed + 200), Y(H.SHOULDER[1] + 160)); c.lineTo(X(ed - 400), Y(H.SHOULDER[1] + 4)); c.closePath(); c.fill();
      c.strokeStyle = '#e8eef3'; c.lineWidth = 2 * z; c.setLineDash([10 * z, 10 * z]); c.beginPath(); c.moveTo(X(ed - 900), Y(H.BOTTOM)); c.lineTo(xr, Y(H.BOTTOM)); c.stroke(); c.setLineDash([]);
      for (let k = 0; k < 6; k++) { c.fillStyle = '#e8eef3'; c.beginPath(); const ax = X(ed - 700 + k * 110), ay = Y(H.BOTTOM + 20); c.moveTo(ax, ay - 5 * z); c.lineTo(ax + 12 * z, ay); c.lineTo(ax, ay + 5 * z); c.fill(); }
    }
    { const rd = H.REST.at, xr = X(rd); if (xr > -900 && xr < Wd + 900) { c.fillStyle = '#23272d'; c.fillRect(X(rd - 500), Y(H.SHOULDER[1] + 6), 900 * z, 150 * z); c.fillStyle = '#e8eef3'; for (let k = 0; k < 10; k++) c.fillRect(X(rd - 420 + k * 60), Y(H.SHOULDER[1] + 60), 2 * z, 40 * z); c.fillStyle = '#f1efe8'; c.fillRect(X(rd + 120), Y(H.SHOULDER[1] + 26), 220 * z, 90 * z); c.fillStyle = '#c84659'; c.fillRect(X(rd + 120), Y(H.SHOULDER[1] + 26), 220 * z, 8 * z); c.font = `800 ${Math.round(13 * z)}px "Chakra Petch",sans-serif`; c.fillStyle = '#1d2024'; c.textAlign = 'center'; c.fillText('LAST LIGHT FUEL · ROOK’S TUNING', X(rd + 230), Y(H.SHOULDER[1] + 80)); } }
    // speed cameras (roadside poles)
    for (const cd of H.CAMERAS) { const xx = X(cd); if (xx < -50 || xx > Wd + 50) continue; c.fillStyle = '#5d646b'; c.fillRect(xx, Y(H.SHOULDER[1] + 8), 3 * z, 24 * z); c.fillStyle = '#e2c24a'; c.fillRect(xx - 6 * z, Y(H.SHOULDER[1] + 8), 14 * z, 9 * z); c.fillStyle = '#1d2024'; c.fillRect(xx - 4 * z, Y(H.SHOULDER[1] + 10), 4 * z, 4 * z); }
    // spikes + roadblocks
    for (const s of A.spikes) { const xx = X(s.d); c.fillStyle = '#9aa3ab'; for (let yy = s.y0; yy < s.y1; yy += 6) c.fillRect(xx - 3 * z, Y(yy), 6 * z, 3 * z); if (Math.sin(now / 90) > 0) { c.fillStyle = '#ff5a3a'; c.beginPath(); c.arc(xx, Y(s.y0 - 8), 4 * z, 0, Math.PI * 2); c.arc(xx, Y(s.y1 + 8), 4 * z, 0, Math.PI * 2); c.fill(); } }
    for (const b of A.blocks) for (const k of b.cars) { drawCar(c, X(k.d), Y(k.y), 'SEDAN', '#f4f6f8', Math.PI / 2, z); lightbar(c, X(k.d), Y(k.y), now, z); }
    // oncoming traffic
    for (const o of A.oncoming) { const xx = X(o.d); if (xx < -80 || xx > Wd + 80) continue; drawCar(c, xx, Y(-14 - H.LANE * o.lane - H.LANE / 2), o.model, o.color, Math.PI, z); }
    // traffic
    for (const t of A.traffic) { const xx = X(t.d); if (xx < -120 || xx > Wd + 120) continue; const id = t.model.startsWith('CX:') ? t.model.slice(3) : t.model; drawCar(c, xx, Y(t.y), id, t.color, (t.change ? Math.sign(H.laneY(t.change.to) - t.y) * 0.04 : 0), z * (t.truck ? 1.35 : 1)); if (t.change && Math.sin(now / 120) > 0) { c.fillStyle = '#ffb33a'; const sgn = Math.sign(H.laneY(t.change.to) - t.y); c.fillRect(xx + 18 * z, Y(t.y) + sgn * 11 * z - 1.5, 4 * z, 3 * z); c.fillRect(xx - 24 * z, Y(t.y) + sgn * 11 * z - 1.5, 4 * z, 3 * z); } }
    // racer
    if (A.racer) { const r = A.racer, xx = X(r.d); drawCar(c, xx, Y(r.y), r.sid, r.color, 0, z); c.font = `800 ${Math.round(10 * Math.max(0.8, z))}px ui-monospace,Menlo,monospace`; c.textAlign = 'center'; c.fillStyle = '#0c111ee0'; const w = c.measureText(r.name).width + 10; c.fillRect(xx - w / 2, Y(r.y) - 30 * z - 12, w, 14); c.fillStyle = '#ffd970'; c.fillText(r.name.toUpperCase(), xx, Y(r.y) - 30 * z - 1); }
    // cops
    for (const k of A.cops) { const xx = X(k.d); if (xx < -100 || xx > Wd + 100) continue; drawCar(c, xx, Y(k.y), 'SEDAN', '#f4f6f8', 0, z); lightbar(c, xx, Y(k.y), now, z); }
    // smoke (under the player)
    for (const s of A.smoke) { c.globalAlpha = Math.max(0, Math.min(0.6, s.life)); if (s.glow) c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgb(${s.col})`; c.beginPath(); c.arc(X(s.d), Y(s.y), (s.glow ? 3 : 4 + (1 - s.life) * 10) * z, 0, Math.PI * 2); c.fill(); c.globalCompositeOperation = 'source-over'; } c.globalAlpha = 1;
    // player
    const ang = Math.atan2(A.vy || 0, Math.max(60, V.v)) * 0.8; drawCar(c, px0, Y(A.y), A.sid, A.car.color || '#c84659', ang, z);
    // overhead gantry signs
    for (let i = 0; i < H.EXITS.length; i++) for (const [off, lab] of [[2400, '2 km'], [1000, '1 km']]) { const xx = X(H.exitAt(i) - off); if (xx < -200 || xx > Wd + 200) continue; gantry(c, xx, Y(-4), Y(H.BOTTOM), z, `EXIT ${i + 1} · ${H.EXITS[i].name.toUpperCase()} · ${lab}`, '#1f6b3f'); }
    { const xx = X(H.REST.at - 1400); if (xx > -200 && xx < Wd + 200) gantry(c, xx, Y(-4), Y(H.BOTTOM), z, 'SERVICES 1 km · FUEL · TUNING · MEET', '#2f5a8a'); }
    if (A.heli) { const xx = X(A.heli.d), yy = Y(A.heli.y); c.save(); c.globalCompositeOperation = 'lighter'; const gr = c.createRadialGradient(px0, Y(A.y), 0, px0, Y(A.y), 70 * z); gr.addColorStop(0, 'rgba(255,255,230,0.35)'); gr.addColorStop(1, 'rgba(255,255,230,0)'); c.fillStyle = gr; c.beginPath(); c.arc(px0, Y(A.y), 70 * z, 0, Math.PI * 2); c.fill(); c.restore(); c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(xx + 30, yy + 40, 30 * z, 12 * z, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1d2433'; c.fillRect(xx - 20 * z, yy - 8 * z, 40 * z, 16 * z); c.strokeStyle = 'rgba(200,210,220,0.6)'; c.lineWidth = 2; c.beginPath(); const ra = now / 40; c.moveTo(xx - Math.cos(ra) * 40 * z, yy - Math.sin(ra) * 40 * z); c.lineTo(xx + Math.cos(ra) * 40 * z, yy + Math.sin(ra) * 40 * z); c.stroke(); }
    // night: darkness + headlights + pole lights
    if (n > 0.15) {
      c.fillStyle = `rgba(4,8,20,${n * 0.55})`; c.fillRect(0, 0, Wd, Hd);
      c.save(); c.globalCompositeOperation = 'lighter';
      const beam = (x, y, dir, l, a) => { const gr = c.createLinearGradient(x, y, x + dir * l, y); gr.addColorStop(0, `rgba(255,240,200,${a})`); gr.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(x, y - 6 * z); c.lineTo(x + dir * l, y - 40 * z); c.lineTo(x + dir * l, y + 40 * z); c.lineTo(x, y + 6 * z); c.closePath(); c.fill(); };
      beam(px0 + 26 * z, Y(A.y), 1, 260 * z, 0.32 * n);
      for (const t of A.traffic) { const xx = X(t.d); if (xx > -100 && xx < Wd + 100) { beam(xx + 26 * z, Y(t.y), 1, 160 * z, 0.18 * n); c.fillStyle = `rgba(255,40,60,${0.45 * n})`; c.fillRect(xx - 28 * z, Y(t.y) - 8 * z, 4 * z, 16 * z); } }
      for (const o of A.oncoming) { const xx = X(o.d); if (xx > -100 && xx < Wd + 100) beam(xx - 26 * z, Y(-14 - H.LANE * o.lane - H.LANE / 2), -1, 160 * z, 0.18 * n); }
      for (let dd = Math.floor(d0 / 600) * 600; dd < d0 + span; dd += 600) { const xx = X(dd); const gr = c.createRadialGradient(xx, Y(-6), 0, xx, Y(-6), 120 * z); gr.addColorStop(0, `rgba(255,210,140,${0.22 * n})`); gr.addColorStop(1, 'rgba(255,210,140,0)'); c.fillStyle = gr; c.beginPath(); c.arc(xx, Y(-6), 120 * z, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    if (rn > 0) { c.strokeStyle = `rgba(180,200,220,${0.25 * rn})`; c.lineWidth = 1; c.beginPath(); for (let k = 0; k < 70 * rn; k++) { const x = (k * 97 + now * 0.9) % Wd, y = (k * 53 + now * 0.6) % Hd; c.moveTo(x, y); c.lineTo(x - 10, y + 6); } c.stroke(); }
    // speed lines
    if (V.v > H.pxs(170)) { c.strokeStyle = `rgba(255,255,255,${Math.min(0.25, (V.v - H.pxs(170)) / 2000)})`; c.lineWidth = 1; c.beginPath(); for (let k = 0; k < 14; k++) { const y = (k * 61 + Math.floor(now / 40) * 17) % Hd, x = (k * 131 + now * 2) % Wd; c.moveTo(x, y); c.lineTo(x - 60, y); } c.stroke(); }
    if (A.flash > 0) { c.fillStyle = `rgba(255,255,255,${A.flash * 0.7})`; c.fillRect(0, 0, Wd, Hd); }
    hud(c, Wd, Hd, now);
    if (A.fade > 0) { c.fillStyle = `rgba(0,0,0,${A.fade})`; c.fillRect(0, 0, Wd, Hd); }
    c.restore();
  }
  function lightbar(c, x, y, now, z) { const on = Math.floor(now / 140) % 2; c.fillStyle = on ? '#ff2a3a' : '#2a6aff'; c.fillRect(x - 3 * z, y - 9 * z, 6 * z, 8 * z); c.fillStyle = on ? '#2a6aff' : '#ff2a3a'; c.fillRect(x - 3 * z, y + 1 * z, 6 * z, 8 * z); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = on ? 'rgba(255,40,60,0.25)' : 'rgba(40,100,255,0.25)'; c.beginPath(); c.arc(x, y, 34 * z, 0, Math.PI * 2); c.fill(); c.restore(); }
  function gantry(c, x, y0, y1, z, label, col) {
    c.fillStyle = '#5d646b'; c.fillRect(x - 3 * z, y0 - 20 * z, 6 * z, y1 - y0 + 40 * z);
    c.save(); c.font = `800 ${Math.max(9, Math.round(12 * z))}px "Chakra Petch",ui-sans-serif,sans-serif`; const w = c.measureText(label).width + 16;
    c.translate(x + 6 * z, (y0 + y1) / 2); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(4, -w / 2 + 4, 22 * z, w); c.fillStyle = col; c.fillRect(0, -w / 2, 22 * z, w); c.strokeStyle = '#e8eef3'; c.lineWidth = 1; c.strokeRect(2, -w / 2 + 2, 22 * z - 4, w - 4);
    c.rotate(Math.PI / 2); c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, 0, -11 * z); c.restore();
  }
  function hud(c, Wd, Hd, now) {
    const V = A.vehicle, k = H.kmh(V.v), S = stars(), ex = H.nextExit(A.d);
    c.save(); c.textBaseline = 'alphabetic';
    // speedo (top centre)
    const cx = Wd / 2, y = 34; c.fillStyle = '#0c111ed8'; c.beginPath(); c.roundRect ? c.roundRect(cx - 120, 6, 240, 62, 12) : c.rect(cx - 120, 6, 240, 62); c.fill();
    c.font = '800 30px "Chakra Petch",ui-sans-serif,sans-serif'; c.textAlign = 'right'; c.fillStyle = k > H.LIMIT + 30 ? '#ffb07a' : '#ffffff'; c.fillText(String(k), cx - 4, y + 10);
    c.font = '700 10px ui-monospace,Menlo,monospace'; c.textAlign = 'left'; c.fillStyle = '#9fb3c8'; c.fillText('KM/H', cx + 2, y + 2); c.fillStyle = '#ffd970'; c.font = '800 14px ui-monospace,Menlo,monospace'; c.fillText(`G${V.gear || 1}`, cx + 2, y + 16);
    const rf = Math.min(1, (V.rpm || 1000) / 7600); c.fillStyle = '#1a2233'; c.fillRect(cx - 110, y + 20, 220, 6); c.fillStyle = rf > 0.86 ? '#ff5a6a' : rf > 0.7 ? '#ffd970' : '#7cffb5'; c.fillRect(cx - 110, y + 20, 220 * rf, 6);
    c.font = '700 9px ui-monospace,Menlo,monospace'; c.textAlign = 'left'; c.fillStyle = '#c9d6e0'; c.fillText(`FUEL ${Math.round(V.fuel)}%  BODY ${Math.round(V.condition)}%${A.car.nitro > 0 ? `  NOS ${Math.round(A.car.nitro)}` : ''}${V.spikes ? '  TYRES SHOT' : ''}`, cx - 110, y - 16);
    // right: next exit + stars
    c.textAlign = 'right'; c.font = '800 12px "Chakra Petch",ui-sans-serif,sans-serif'; c.fillStyle = '#7cffb5'; if (ex) c.fillText(`EXIT ${ex.i + 1} ${ex.name.toUpperCase()} · ${(ex.dist * H.M / 1000).toFixed(1)} km`, Wd - 14, 96);
    if (S) { c.fillStyle = Math.sin(now / 200) > 0 ? '#ff5a6a' : '#5a8aff'; c.fillText('★'.repeat(S) + ' POLICE', Wd - 14, 114); }
    // left: streak + run + race
    c.textAlign = 'left'; let ly = 200;
    if (A.streak || A.cash) { c.fillStyle = '#7cffb5'; c.fillText(`NEAR MISS x${A.streak} · ${H.streakMult(A.streak).toFixed(2)}× · bank ${money(A.cash)}`, 14, ly); ly += 18; }
    if (A.run) { const left = Math.max(0, (A.run.until - now) / 1000); c.fillStyle = left < 10 ? '#ff5a6a' : '#ffd970'; c.fillText(`📦 ${A.run.name} → EXIT ${A.run.to + 1} ${H.EXITS[A.run.to].name} · ${left.toFixed(0)}s · ${money(A.run.pay)}`, 14, ly); ly += 18; }
    if (A.race) { const R = A.race, f1 = Math.min(1, (R.mine || 0) / R.length), f2 = Math.min(1, (R.theirs || 0) / R.length); c.fillStyle = '#0c111ed8'; c.fillRect(Wd / 2 - 120, 74, 240, 26); c.fillStyle = '#ff7ad8'; c.fillRect(Wd / 2 - 116, 78, 232 * f1, 7); c.fillStyle = '#ffd970'; c.fillRect(Wd / 2 - 116, 89, 232 * f2, 7); c.font = '700 9px ui-monospace,Menlo,monospace'; c.fillStyle = '#fff'; c.fillText(`YOU vs ${A.racer?.name?.toUpperCase() || ''}`, Wd / 2 - 116, 110); }
    // pops (centre)
    c.textAlign = 'center'; for (let i = 0; i < pops.length; i++) { const p0 = pops[i], age = (now - p0.at) / 2200; if (age > 1) continue; c.globalAlpha = 1 - age * age; c.font = '800 14px "Chakra Petch",ui-sans-serif,sans-serif'; c.fillStyle = '#0c111ec0'; const w = c.measureText(p0.t).width + 16; c.fillRect(Wd / 2 - w / 2, Hd * 0.3 + i * 22 - 15, w, 20); c.fillStyle = p0.col; c.fillText(p0.t, Wd / 2, Hd * 0.3 + i * 22); } c.globalAlpha = 1;
    c.restore();
  }

  // ---------- rest stop panel + race button ----------
  const css = document.createElement('style');
  css.textContent = `#hwPanel{position:fixed;inset:8% 12%;z-index:46;overflow:auto;background:#0f1830f5;border:1px solid #6f8db3;border-radius:14px;padding:12px 14px;color:#e8eff7;font:13px ui-monospace,Menlo,monospace}
  #hwPanel[hidden]{display:none} #hwPanel h2{margin:0 0 4px;font-size:16px} #hwPanel h3{margin:10px 0 6px;font-size:12px;color:#9fb3c8;letter-spacing:.08em} #hwPanel .sub{font-size:11.5px;color:#b9c8da;margin-bottom:8px}
  #hwPanel .row{display:flex;gap:8px;align-items:center;background:#16233d;border:1px solid #2f4669;border-radius:9px;padding:7px 9px;margin-bottom:6px} #hwPanel .row div{flex:1} #hwPanel .row small{display:block;color:#b9c8da;font-size:11px}
  #hwPanel button{all:unset;box-sizing:border-box;cursor:pointer;font:700 12px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:8px;padding:6px 10px;white-space:nowrap} #hwPanel button[disabled]{opacity:.4;cursor:default} #hwPanel .go{background:#2f8f6a;border-color:#7cffb5;padding:9px 14px;font-size:14px}
  #hwRace{all:unset;position:fixed;z-index:30;left:50%;top:128px;transform:translateX(-50%);cursor:pointer;padding:9px 16px;border-radius:12px;background:linear-gradient(160deg,#5a3a08f0,#2a1a04f0);border:1px solid #ffd970;color:#fff1c4;font:800 14px ui-monospace,Menlo,monospace;box-shadow:0 0 16px #ffd97066} #hwRace[hidden]{display:none}
  body[data-highway="on"] #glCard,body[data-highway="on"] #stCard,body[data-highway="on"] #minimap,body[data-highway="on"] #mmWrap{display:none!important}`;
  document.head.appendChild(css);
  const panel = Object.assign(document.createElement('section'), { id: 'hwPanel', hidden: true }); document.body.appendChild(panel);
  const raceBtn = Object.assign(document.createElement('button'), { id: 'hwRace', type: 'button', hidden: true }); document.body.appendChild(raceBtn);
  raceBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); startRace(); raceBtn.hidden = true; });
  function raceButton() { const r = A?.racer; raceBtn.hidden = !(r && !A.race && Math.abs(rel(r.d, A.d)) < 160 && Math.abs(r.y - A.y) < 110); if (!raceBtn.hidden) raceBtn.textContent = `🏁 RACE ${r.name.toUpperCase()} · ${money(H.race(A.d, r).pay)}`; }
  const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); for (const k of kids) if (k !== null && k !== undefined) n.append(k); return n; };
  const row = (title, sub, label, fn, dis) => el('div', { className: 'row' }, el('div', {}, document.createTextNode(title), el('small', { textContent: sub })), el('button', { textContent: label, disabled: !!dis, onclick: fn }));
  function openRest() {
    A.rest = true; A.vehicle.v = 0; A.restDone = true; try { root.releaseControls?.(); } catch { /* n/a */ }
    renderRest();
  }
  function renderRest() {
    const p = P(), V = A.vehicle, DD = root.NightshiftDrivingData, q = DD?.quote?.({ fuel: V.fuel, condition: V.condition, nitro: A.car.nitro || 0 }) || {};
    const svc = (kind, title, sub) => row(title, sub, q[kind] ? money(q[kind]) : '—', () => { const tmp = { fuel: V.fuel, condition: V.condition, nitro: A.car.nitro || 0, dirt: 0 }; const r = DD.service(tmp, p, kind); if (r.ok) { V.fuel = tmp.fuel; V.condition = tmp.condition; A.car.nitro = tmp.nitro; if (kind === 'repair') V.spikes = false; say(`⛽ ${title} · −${money(r.cost)}`); gameSave(); } else say(r.reason); renderRest(); }, !q[kind] || p.cash < q[kind]);
    panel.replaceChildren(el('h2', { textContent: `🛣️ ${H.REST.name}` }), el('div', { className: 'sub', textContent: `Cash ${money(p.cash)} · fuel ${Math.round(V.fuel)}% · body ${Math.round(V.condition)}%${V.spikes ? ' · tyres shredded (repair fixes them)' : ''} · near-miss bank ${money(A.cash)}` }));
    panel.append(el('h3', { textContent: H.REST.fuel.toUpperCase() }), svc('fuel', 'Fill the tank', 'Fuel drains about 1% per km'), svc('repair', 'Repair + new tyres', 'Body, smoke, spike damage'), svc('nitro', 'Nitro fill', 'Hold NOS on the highway'));
    panel.append(el('h3', { textContent: H.REST.tuning.toUpperCase() }), row('🔧 Rook’s Tuning', 'Engine, handling, armor, paint for the car you\'re in', 'TUNE', () => { try { root.NightshiftTuning?.open?.(); } catch { say('Tuning unavailable'); } }));
    panel.append(el('h3', { textContent: 'THE MEET' }));
    for (const R0 of H.RACERS) { const sp = CD()?.BY?.[R0.car]; panel.append(row(`🏁 ${R0.name} · ${sp?.name || R0.car}`, `${R0.line} · beaten ${save0.wins[R0.id] || 0}×`, 'CHALLENGE', () => { A.racer = { ...R0, d: H.wrap(A.d + 10), y: H.laneY(2), v: 0, perf: H.perf(sp), sid: sp ? sp.id : 'SEDAN' }; leaveRest(); A.y = H.laneY(3); A.vehicle.v = H.pxs(60); A.racer.v = H.pxs(60); startRace(); })); }
    panel.append(el('h3', { textContent: 'HIGHWAY RUNS' }));
    if (A.run) panel.append(el('div', { className: 'sub', textContent: `On a run: ${A.run.name} → exit ${A.run.to + 1} ${H.EXITS[A.run.to].name}` }));
    else for (let k = 0; k < 2; k++) { const r = H.run(A.d, 2); panel.append(row(`📦 ${r.name}`, `Deliver to exit ${r.to + 1} · ${H.EXITS[r.to].name} in ${r.seconds}s${r.hot ? ' · hot car: cops notice' : ''}`, money(r.pay), () => { A.run = { ...r, until: performance.now() + r.seconds * 1000 }; if (r.hot) { const p2 = P(); p2.heat = Math.max(p2.heat || 0, 1.2); } leaveRest(); })); }
    panel.append(el('div', { style: 'margin-top:10px' }, el('button', { className: 'go', textContent: '🛣️ BACK ON THE ROAD', onclick: leaveRest })));
    panel.hidden = false;
  }
  function leaveRest() { panel.hidden = true; if (A) { A.rest = false; A.last = 0; A.y = H.SHOULDER[0] + 12; A.vehicle.v = Math.max(A.vehicle.v, H.pxs(40)); A.d = H.wrap(H.REST.at + 60); } }

  // ---------- city side: on-ramps ----------
  let rampCool = 0;
  function rampTick(now) {
    const p = P(); if (!p?.car || A || now < rampCool) return;
    let zone = false; try { zone = !!(root.NightshiftZones?.active?.() || root.NightshiftHome?.paused?.()); } catch { /* n/a */ } if (zone) return;
    for (let i = 0; i < H.EXITS.length; i++) { const r = H.EXITS[i].ramp; if (Math.hypot(p.car.x - r.x, p.car.y - r.y) < 64 && Math.abs(p.car.speed || 0) > 1) { rampCool = now + 4000; enter(i); return; } }
  }
  function drawRamps() {
    const c = G(), p = P(); if (!c || !p || A) return; const now = performance.now();
    for (let i = 0; i < H.EXITS.length; i++) {
      const e = H.EXITS[i], r = e.ramp; if (Math.abs(r.x - p.x) > 900 || Math.abs(r.y - p.y) > 600) continue;
      c.save(); c.translate(r.x, r.y); const a = Math.atan2(r.y - e.into.y, r.x - e.into.x); c.rotate(a);
      c.fillStyle = 'rgba(46,160,90,0.25)'; c.fillRect(-60, -40, 120, 80);
      for (let k = 0; k < 3; k++) { const o = ((now / 300 + k) % 3) * 30 - 40; c.fillStyle = `rgba(124,255,181,${0.5 - k * 0.12})`; c.beginPath(); c.moveTo(o, -18); c.lineTo(o + 18, 0); c.lineTo(o, 18); c.lineTo(o + 6, 0); c.closePath(); c.fill(); }
      c.restore();
      root.NightshiftSign?.(c, e.into.x, e.into.y - 40, '🛣️', `ROUTE 9 · ON-RAMP`, '#7cffb5', { always: true, glow: true });
    }
  }

  // ---------- hooks ----------
  function install() {
    const HM = root.NightshiftHome; if (!HM || HM.__highway) return !!HM?.__highway;
    const paused = HM.paused, render = HM.render;
    HM.paused = function () { return !!A || paused.apply(this, arguments); };
    HM.render = function (now) { if (A) { try { frame(now); } catch (e) { console.error(e); } return; } return render.apply(this, arguments); };
    HM.__highway = true; return true;
  }
  const hook = setInterval(() => {
    install();
    const E = root.NightshiftEncounters;
    if (E && typeof E.draw === 'function' && !E.__highway) { const d0 = E.draw; E.draw = function () { const r = d0.apply(this, arguments); try { drawRamps(); } catch { /* cosmetic */ } return r; }; E.__highway = true; }
    if (root.NightshiftHome?.__highway && E?.__highway) clearInterval(hook);
  }, 300);
  (function loop(now) { try { rampTick(now); document.body.dataset.highway = A ? 'on' : 'off'; if (!A) raceBtn.hidden = true; } catch (e) { console.error(e); } requestAnimationFrame(loop); })(performance.now());
  root.NightshiftHighway = Object.freeze({ active: () => !!A, enter, leave: (i) => leave(i ?? (H.nextExit(A?.d || 0)?.i || 0)), state: () => A, get save() { return save0; }, stats: () => ({ ...st, traffic: A?.traffic.length || 0, cops: A?.cops.length || 0 }), rest: openRest, race: startRace });
  void pendingRun;
})(typeof globalThis !== 'undefined' ? globalThis : this);
