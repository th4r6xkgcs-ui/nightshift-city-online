/* NPC life (Claude-owned): makes the street feel lived-in around you, even when you're the only one playing.
 * Ambient (on ordinary people, without taking them over):
 *  - conversations: people who stop near each other turn in, talk in turns (speech bubbles about what's actually
 *    going on: the gangs, the cops, your corners, the weather, the time) and drift apart;
 *  - little lives: on the phone, smoking, headphones on, a snack; passers-by nod, apologise or snap "watch it";
 *  - witnesses: shoot or rob in front of people and someone calls it in ("911? Shots fired on Old Town!") — the
 *    report comes in a few seconds later unless you're gone. They flee first (citizen-ai.js).
 * Street events (a director keeps 1-2 going near you, flavoured by district), each with something to do:
 *  - MUGGING: STOP IT (or drop the mugger) → reward + charisma; ignore it and he runs with the wallet.
 *  - STREET FIGHT: a crowd gathers; BET $50 on the guy in red.
 *  - DICE GAME: crouched in a circle; roll for $20 (45% to double).
 *  - TRAFFIC STOP: a cop questions someone; sometimes they get cuffed and walked off. Keep your head down.
 *  - LOST DOG: find the dog wandering nearby, GRAB it, walk it back → reward.
 *  - BREAKDOWN: dead battery, smoking hood; HELP → cash + driving XP.
 *  - "YOU LOOKING FOR WORK?": a shopkeeper needs a package run to a door across the area (GPS) → pay by distance.
 * Scripted people are taken out of `peds` while their scene runs (so the routine AI doesn't drag them away) and come
 * back after; game.js lets your bullets hit them (NightshiftNpcLife.hit).
 * API: NightshiftNpcLife.{actors, hit, events, start(kind), stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const E = () => { try { return { player, peds, cars, blocked, camera, g, loot }; } catch { return null; } };
  /* eslint-enable no-undef */
  const say = (m) => { try { root.say?.(m); } catch { /* n/a */ } };
  const save = () => { try { root.save?.(); } catch { /* n/a */ } };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];
  const district = (x, y) => { try { return root.NightshiftWorld?.districtName?.(x, y) || 'the city'; } catch { return 'the city'; } };
  const xp = (k, n, why) => { try { root.NightshiftSkills?.gain?.(k, n, why); } catch { /* n/a */ } };
  const inZone = () => { try { return !!(root.NightshiftZones?.active?.() || root.NightshiftHome?.kind?.()); } catch { return false; } };
  const st = { events: 0, convos: 0, calls: 0, done: 0 };
  const actors = [], events = [], bubbles = new Map(); // bubble: p -> { t, until, color }
  function bubble(p, text, ms = 2200, color) { if (p) bubbles.set(p, { t: text, until: performance.now() + ms, color }); }
  const busy = (p) => !p || p.hp <= 0 || p.crew || p.follow || p.following || p.hostile || p.mode === 'flee' || p.job || p.target || p.customer || p.rival || p.disturbedUntil > performance.now();

  // ---------- what people talk about (reads the live world) ----------
  function gossip(p) {
    const env = E(), GS = root.NightshiftGangs, GD = root.NightshiftGangsData, here = district(p.x, p.y), h = Math.floor((root.NightshiftEnvironment?.state?.minute ?? 720) / 60);
    const lines = ['You see the game last night?', 'Rent went up again.', 'My cousin\'s opening a shop.', 'I need a new job, fr.', 'Nah, that\'s crazy.', 'For real?', 'Ha! No way.', 'Anyway…', 'Say less.', 'I\'m just saying.'];
    if (h >= 21 || h < 5) lines.push('Late night, man.', 'Clubs are packed tonight.'); else if (h < 11) lines.push('Need coffee.', 'Morning shift again.');
    if ((env?.player?.heat || 0) >= 1) lines.push('Cops everywhere today.', 'Somebody\'s got a lot of heat on them.');
    const owned = Object.keys(GS?.state?.owned || {}).length; if (owned) lines.push('New crew running corners now.', `Heard somebody took ${owned > 1 ? 'some corners' : 'a corner'} off the gangs.`);
    const t = GD?.turfAt?.(p.x, p.y); if (t) lines.push(`${t.gang.short} been on edge.`, 'Don\'t hang around here too long.'); else if (GD) { const g = pick(GD.GANGS); lines.push(`${g.name} and ${GD.BY_ID[g.rival].short} are beefing again.`); }
    lines.push(`${here} ain't what it used to be.`, `Prices in ${here} are wild.`);
    try { if (root.NightshiftEnvironment?.weather?.(root.NightshiftEnvironment.state.minute) > 0.3) lines.push('Gonna pour soon.', 'This rain, man.'); } catch { /* n/a */ }
    return pick(lines);
  }

  // ---------- ambient layer on ordinary peds ----------
  const convos = [], life = new WeakMap(); // life: p -> { act, since }
  const ACTS = ['phone', 'phone', 'smoke', 'music', 'snack', null, null, null];
  let nextScan = 0;
  function ambientTick(env, now, dt) {
    const p0 = env.player;
    if (now > nextScan) {
      nextScan = now + 1200;
      const still = env.peds.filter((q) => !busy(q) && !q.moving && Math.abs(q.x - p0.x) < 800 && Math.abs(q.y - p0.y) < 600);
      for (const q of still) { if (!life.has(q)) life.set(q, { act: pick(ACTS), since: now }); }
      // form conversations among people standing close together
      for (const a of still) {
        if (convos.some((c) => c.members.includes(a))) continue;
        const mates = still.filter((b) => b !== a && dist(a, b) < 46 && !convos.some((c) => c.members.includes(b))).slice(0, 2);
        if (!mates.length || Math.random() < 0.5) continue;
        convos.push({ members: [a, ...mates], until: now + rnd(9000, 20000), next: now + 400, turn: 0 }); st.convos++;
      }
    }
    for (let i = convos.length - 1; i >= 0; i--) {
      const c = convos[i]; c.members = c.members.filter((m) => m.hp > 0 && !m.moving && env.peds.includes(m));
      if (now > c.until || c.members.length < 2) { convos.splice(i, 1); continue; }
      const cx = c.members.reduce((s, m) => s + m.x, 0) / c.members.length, cy = c.members.reduce((s, m) => s + m.y, 0) / c.members.length;
      for (const m of c.members) { m.angle = Math.atan2(cy - m.y, cx - m.x); m.moveAngle = m.angle; }
      if (now > c.next && dist({ x: cx, y: cy }, p0) < 520) { const sp = c.members[c.turn++ % c.members.length]; bubble(sp, gossip(sp), 2100); c.next = now + rnd(2000, 2900); }
    }
    // passers-by
    if (Math.random() < dt * 2) {
      const walkers = env.peds.filter((q) => q.moving && Math.abs(q.x - p0.x) < 500 && Math.abs(q.y - p0.y) < 400);
      for (const a of walkers) { const b = walkers.find((q) => q !== a && dist(q, a) < 22); if (b && Math.random() < 0.25) { bubble(a, pick(['Yo.', 'Sorry!', 'Watch it!', 'My bad.', '\'Sup.']), 1400); break; } }
      const pl = env.peds.find((q) => !q.moving && dist(q, p0) < 26 && !busy(q)); if (pl && Math.random() < 0.3 && !bubbles.has(pl)) bubble(pl, p0.heat >= 2 ? pick(['Get away from me!', 'I didn\'t see nothing.']) : pick(['Can I help you?', 'Personal space, man.', 'Nice fit.', '…hey.']), 1600);
    }
  }
  function drawLife(ctx, env, now) {
    const p0 = env.player, t = now / 1000;
    for (const q of env.peds) {
      if (q.moving || Math.abs(q.x - p0.x) > 700 || Math.abs(q.y - p0.y) > 500) continue; const L = life.get(q); if (!L?.act || convos.some((c) => c.members.includes(q))) continue;
      const hx = q.x + Math.cos(q.angle || 0) * 5, hy = q.y - 14;
      if (L.act === 'phone') { ctx.fillStyle = '#0b0d14'; ctx.fillRect(hx - 2, hy - 2, 4, 6); ctx.fillStyle = '#9fe0ff'; ctx.fillRect(hx - 1.5, hy - 1.5, 3, 4); ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(hx, hy - 4, 7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      else if (L.act === 'smoke') { ctx.fillStyle = '#ffb07a'; ctx.fillRect(hx, hy - 6, 2, 2); for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3 + q.x * 0.01) % 1; ctx.globalAlpha = 0.5 * (1 - ph); ctx.fillStyle = '#c9d1d6'; ctx.beginPath(); ctx.arc(hx + Math.sin(ph * 6 + k) * 3, hy - 10 - ph * 18, 2 + ph * 3, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
      else if (L.act === 'music') { ctx.fillStyle = '#ff7ad8'; ctx.font = '700 9px sans-serif'; const ph = (t * 0.8 + q.y * 0.01) % 1; ctx.globalAlpha = 1 - ph; ctx.fillText('♪', q.x + 8 + ph * 6, q.y - 40 - ph * 12); ctx.globalAlpha = 1; }
      else if (L.act === 'snack') { ctx.fillStyle = '#e2b75c'; ctx.fillRect(hx - 2, hy, 5, 3); ctx.fillStyle = '#c84659'; ctx.fillRect(hx - 2, hy + 1, 5, 1); }
    }
  }

  // ---------- witnesses ----------
  let lastCall = 0;
  function sees(a, b, env) { const d = dist(a, b); if (d > 260) return false; const n = Math.ceil(d / 14); for (let i = 1; i < n; i++) { try { if (env.blocked(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false; } catch { return true; } } return true; }
  function witness(kind) {
    const env = E(), now = performance.now(); if (!env || inZone() || now - lastCall < 15000 || (env.player.heat || 0) >= 3) return;
    const w = env.peds.find((q) => q.hp > 0 && !q.crew && dist(q, env.player) > 40 && sees(q, env.player, env)); if (!w) return;
    lastCall = now; st.calls++;
    const where = district(env.player.x, env.player.y), at = { x: env.player.x, y: env.player.y };
    bubble(w, kind === 'shot' ? `911? Shots fired in ${where}!` : `Police! I just saw somebody get robbed!`, 3200, '#9fd4ff');
    life.set(w, { act: 'phone', since: now });
    setTimeout(() => { const e2 = E(); if (!e2 || w.hp <= 0) return; try { e2.player.heat = Math.min(5, (e2.player.heat || 0) + 0.3); root.NightshiftCrime?.report?.(at, performance.now(), 'witness'); say(`📞 A witness called it in · police heading to ${where}`); } catch { /* n/a */ } }, 3500);
  }

  // ---------- scripted actors ----------
  function take(env, q) { const i = env.peds.indexOf(q); if (i >= 0) env.peds.splice(i, 1); q.scripted = true; q.moving = false; actors.push(q); return q; }
  function release(env, q, keep = true) { const i = actors.indexOf(q); if (i >= 0) actors.splice(i, 1); q.scripted = false; q.squat = false; q.routine = null; q.path = []; q.nextRoute = 0; q.moving = false; if (keep && q.hp > 0 && !q.temp) env.peds.push(q); }
  function walk(q, goal, speed, dt) { const dx = goal.x - q.x, dy = goal.y - q.y, d = Math.hypot(dx, dy); if (d < 3) { q.moving = false; return true; } const s = Math.min(d, speed * dt); q.x += dx / d * s; q.y += dy / d * s; q.moving = true; q.walkTicks = (q.walkTicks || 0) + dt * 60; q.moveAngle = q.angle = Math.atan2(dy, dx); return false; }
  function face(a, b) { a.angle = a.moveAngle = Math.atan2(b.y - a.y, b.x - a.x); }
  function candidates(env, near, r0, r1, n, still) {
    const out = env.peds.filter((q) => !busy(q) && !q.scripted && (!still || !q.moving) && dist(q, near) > r0 && dist(q, near) < r1);
    out.sort(() => Math.random() - 0.5); return out.slice(0, n);
  }
  let seq = 0;
  function makeEvent(kind, x, y, data) { const ev = { id: 'npc' + (++seq), kind, x, y, t0: performance.now(), phase: 'start', data: data || {}, cast: [] }; events.push(ev); st.events++; return ev; }
  function endEvent(env, ev) { for (const q of ev.cast) release(env, q, !q.gone); const i = events.indexOf(ev); if (i >= 0) events.splice(i, 1); }

  const DIR = {
    mug(env) {
      const [v] = candidates(env, env.player, 260, 650, 1, true); if (!v) return null; const [t] = candidates(env, v, 120, 300, 1, false); if (!t) return null;
      const ev = makeEvent('mug', v.x, v.y); ev.cast = [take(env, v), take(env, t)]; ev.v = v; ev.t = t;
      t.outfit = { ...(t.__outfit || {}), face: { id: 'skimask', color: 0 }, outer: { id: 'hoodie', color: 8, hood: true } };
      return ev;
    },
    fight(env) {
      const two = candidates(env, env.player, 250, 600, 2, false); if (two.length < 2) return null; const c = { x: two[0].x, y: two[0].y };
      const ev = makeEvent('fight', c.x, c.y); ev.cast = two.map((q) => take(env, q)); ev.a = two[0]; ev.b = two[1];
      ev.a.outfit = { ...(ev.a.__outfit || {}), top: { id: 'tee', color: 0 }, outer: null }; ev.b.outfit = { ...(ev.b.__outfit || {}), top: { id: 'tee', color: 1 }, outer: null };
      ev.spots = [{ x: c.x - 12, y: c.y }, { x: c.x + 12, y: c.y }]; return ev;
    },
    dice(env) {
      const three = candidates(env, env.player, 250, 650, 3, false); if (three.length < 3) return null; const c = { x: three[0].x, y: three[0].y };
      try { if (env.blocked(c.x, c.y)) return null; } catch { /* n/a */ }
      const ev = makeEvent('dice', c.x, c.y); ev.cast = three.map((q) => take(env, q)); ev.spots = three.map((q, i) => ({ x: c.x + Math.cos(i * 2.1) * 16, y: c.y + Math.sin(i * 2.1) * 11 })); ev.until = performance.now() + rnd(70000, 110000); return ev;
    },
    stop(env) {
      const [v] = candidates(env, env.player, 260, 650, 1, true); if (!v) return null; const a = Math.random() * 6;
      const cop = { x: v.x + Math.cos(a) * 260, y: v.y + Math.sin(a) * 260, hp: 60, maxHp: 60, role: 'officer', id: 'npc-cop-' + seq, angle: 0, temp: true, color: '#7798de' };
      try { if (env.blocked(cop.x, cop.y)) { cop.x = v.x + 200; cop.y = v.y; } } catch { /* n/a */ }
      const ev = makeEvent('stop', v.x, v.y); ev.cast = [take(env, v), take(env, cop)]; ev.v = v; ev.cop = cop; return ev;
    },
    dog(env) {
      const [o] = candidates(env, env.player, 220, 600, 1, true); if (!o) return null; const a = Math.random() * 6, d = rnd(260, 420);
      const dog = { x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d, angle: 0, moving: false, walk: 0 };
      try { if (env.blocked(dog.x, dog.y)) { dog.x = o.x; dog.y = o.y + 120; } } catch { /* n/a */ }
      const ev = makeEvent('dog', o.x, o.y, { name: pick(['Biscuit', 'Max', 'Lola', 'Rocky', 'Peanut']), breed: pick(['shiba', 'lab', 'husky']) }); ev.cast = [take(env, o)]; ev.o = o; ev.dog = dog; ev.until = performance.now() + 180000; return ev;
    },
    car(env) {
      const c = env.cars.find((q) => q.parkedByCrowd && !q.owner && Math.abs(q.speed || 0) < 0.1 && dist(q, env.player) > 220 && dist(q, env.player) < 650); if (!c) return null;
      const [o] = candidates(env, c, 0, 400, 1, false); if (!o) return null;
      const ev = makeEvent('car', c.x, c.y); ev.cast = [take(env, o)]; ev.o = o; ev.car = c; ev.spot = { x: c.x + 24, y: c.y + 8 }; ev.until = performance.now() + 150000; return ev;
    },
    errand(env) {
      const IN = root.NightshiftInteriors2; if (!IN?.doors || root.NightshiftNpcLife?.errand?.()) return null;
      const d = IN.doors().filter((q) => ['CORNER SHOP', 'DINER', 'CLOTHING', 'GARAGE'].includes(q.type) && dist(q, env.player) > 200 && dist(q, env.player) < 650)[0]; if (!d) return null;
      const [o] = candidates(env, d, 0, 300, 1, false); if (!o) return null;
      const ev = makeEvent('errand', d.x, d.y + 10); ev.cast = [take(env, o)]; ev.o = o; ev.spot = { x: d.x + 18, y: d.y + 12 }; ev.until = performance.now() + 120000; return ev;
    },
  };
  const WEIGHTS = {
    DOWNTOWN: { stop: 3, errand: 3, mug: 2, car: 1 }, 'THE HEIGHTS': { dog: 3, car: 2, stop: 2, errand: 1 }, FAIRVIEW: { dog: 3, car: 2, dice: 1, errand: 2 }, 'OLD TOWN': { dice: 3, mug: 2, fight: 2, errand: 1 },
    'MARKET DISTRICT': { errand: 3, mug: 2, fight: 1, dog: 1 }, IRONWORKS: { car: 3, fight: 2, mug: 2, dice: 1 }, 'THE FLATS': { fight: 3, dice: 3, mug: 2, stop: 1 }, HARBOR: { car: 2, mug: 2, dice: 2, fight: 1 },
  };
  function pickKind(env) { const w = WEIGHTS[district(env.player.x, env.player.y)] || { mug: 2, fight: 2, dice: 2, stop: 2, dog: 2, car: 2, errand: 2 }; const list = Object.entries(w).filter(([k]) => !events.some((e) => e.kind === k)); const tot = list.reduce((a, [, n]) => a + n, 0); let r = Math.random() * tot; for (const [k, n] of list) { r -= n; if (r <= 0) return k; } return list[0]?.[0]; }
  let nextEvent = performance.now() + 20000;
  function director(env, now) {
    if (now < nextEvent || events.length >= 2 || (env.player.heat || 0) >= 3) return;
    nextEvent = now + rnd(35000, 70000); const k = pickKind(env); if (k) start(k);
  }
  function start(kind) { const env = E(); if (!env || !DIR[kind]) return null; const ev = DIR[kind](env); if (ev) bubble(ev.cast[0], { mug: 'Hey— get off me!', fight: 'You wanna go?!', dice: 'Seven! Come on!', stop: 'Evening, officer.', dog: 'Has anyone seen my dog?', car: 'Battery\'s dead…', errand: 'Hey! You looking for work?' }[kind], 2600); return ev; }

  // ---------- event logic ----------
  let errandJob = null;
  function evTick(env, ev, now, dt) {
    const p0 = env.player, age = (now - ev.t0) / 1000, far = dist(ev, p0) > 1300;
    if (far && ev.kind !== 'errand') { endEvent(env, ev); return; }
    if (ev.kind === 'mug') {
      const { v, t } = ev;
      if (t.hp <= 0) { if (ev.phase !== 'saved') { ev.phase = 'saved'; reward(env, v, 'You took him down. Thank you!', [50, 90]); } if (age > 1) endEvent(env, ev); return; }
      if (ev.phase === 'start') { face(v, t); if (walk(t, { x: v.x + 16, y: v.y + 4 }, 72, dt)) { ev.phase = 'rob'; ev.robAt = now; bubble(t, 'Wallet. Now.', 2400, '#ffb0b8'); setTimeout(() => bubble(v, 'Please! Take it!', 2200), 900); } }
      else if (ev.phase === 'rob') { face(t, v); face(v, t); if (now - ev.robAt > 7000) { ev.phase = 'run'; ev.away = { x: t.x + (t.x - p0.x) * 3 + 200, y: t.y + (t.y - p0.y) * 3 }; bubble(v, 'Somebody stop him!!', 2400); } }
      else if (ev.phase === 'run') { if (walk(t, ev.away, 110, dt) || dist(t, p0) > 700) { t.gone = true; endEvent(env, ev); } }
      else if (ev.phase === 'scared') { walk(t, ev.away, 120, dt); if (age > ev.endAt) { t.gone = true; endEvent(env, ev); } }
    } else if (ev.kind === 'fight') {
      const { a, b } = ev;
      if (ev.phase === 'start') { const ok1 = walk(a, ev.spots[0], 70, dt), ok2 = walk(b, ev.spots[1], 70, dt); if (ok1 && ok2) { ev.phase = 'brawl'; ev.brawlAt = now; } }
      else if (ev.phase === 'brawl') {
        face(a, b); face(b, a); const k = Math.floor((now - ev.brawlAt) / 450), who = k % 2 ? a : b, other = who === a ? b : a;
        const lunge = ((now - ev.brawlAt) % 450) / 450 < 0.3 ? 4 : 0, sp = who === a ? ev.spots[0] : ev.spots[1]; who.x = sp.x + Math.cos(who.angle) * lunge; who.y = sp.y + Math.sin(who.angle) * lunge;
        if (lunge && k !== ev.lastK) { ev.lastK = k; try { root.NightshiftFeedback?.burst?.(other.x, other.y - 10, 'hit'); } catch { /* n/a */ } if (Math.random() < 0.3) bubble(who, pick(['Take that!', 'Come on!', 'Ugh!', 'That all you got?']), 1000); }
        // spectators
        if (!ev.crowd) { ev.crowd = env.peds.filter((q) => !busy(q) && dist(q, ev) < 160).slice(0, 4); for (const q of ev.crowd) bubble(q, pick(['Fight! Fight!', 'Ooooh!', 'Get him!', 'Somebody film this']), 2000); }
        for (const q of ev.crowd) if (!q.moving) face(q, ev);
        if (now - ev.brawlAt > 12000) { ev.phase = 'done'; ev.doneAt = now; ev.winner = Math.random() < 0.5 ? a : b; const loser = ev.winner === a ? b : a; loser.squat = true; bubble(ev.winner, 'And stay down!', 2200); settleBet(env, ev); }
      } else if (ev.phase === 'done' && now - ev.doneAt > 4000) endEvent(env, ev);
    } else if (ev.kind === 'dice') {
      ev.cast.forEach((q, i) => { if (walk(q, ev.spots[i], 60, dt)) { q.squat = true; face(q, ev); } });
      if (Math.random() < dt * 0.4) bubble(pick(ev.cast), pick(['Seven!', 'Snake eyes, man…', 'Pay up!', 'Roll \'em!', 'Lucky!', 'Again!']), 1500);
      if (now > ev.until) endEvent(env, ev);
    } else if (ev.kind === 'stop') {
      const { v, cop } = ev; face(v, cop);
      if (ev.phase === 'start') { if (walk(cop, { x: v.x + 18, y: v.y }, 66, dt)) { ev.phase = 'talk'; ev.talkAt = now; bubble(cop, pick(['Evening. Where you headed?', 'ID, please.', 'You live around here?']), 2600, '#9fd4ff'); } }
      else if (ev.phase === 'talk') {
        face(cop, v); const t2 = now - ev.talkAt;
        if (t2 > 3000 && !ev.said1) { ev.said1 = true; bubble(v, pick(['Just going home, officer.', 'I ain\'t do nothing!', 'Here\'s my ID.']), 2400); }
        if (t2 > 6500 && !ev.said2) { ev.said2 = true; ev.cuff = Math.random() < 0.35; bubble(cop, ev.cuff ? 'Turn around. Hands behind your back.' : 'Alright. Move along.', 2600, '#9fd4ff'); }
        if ((p0.heat || 0) >= 1 && dist(cop, p0) < 220 && !ev.reported) { ev.reported = true; bubble(cop, 'Hey! You! Stop right there!', 2400, '#9fd4ff'); try { root.NightshiftCrime?.report?.({ x: p0.x, y: p0.y }, performance.now(), 'patrol'); } catch { /* n/a */ } }
        if (t2 > 9500) { ev.phase = 'leave'; ev.away = { x: cop.x + rnd(-300, 300), y: cop.y + 340 }; }
      } else if (ev.phase === 'leave') { walk(cop, ev.away, 60, dt); if (ev.cuff) { walk(v, { x: cop.x - 12, y: cop.y - 6 }, 60, dt); } if (now - ev.t0 > 24000 || dist(cop, p0) > 800) { if (ev.cuff) v.gone = true; endEvent(env, ev); } }
    } else if (ev.kind === 'dog') {
      const { o, dog } = ev; face(o, dog);
      if (!ev.carried) { dog.moving = Math.sin(now / 1300 + dog.x) > 0.2; if (dog.moving) { dog.angle += rnd(-0.4, 0.4) * dt * 4; const nx = dog.x + Math.cos(dog.angle) * 40 * dt, ny = dog.y + Math.sin(dog.angle) * 40 * dt; let bad = false; try { bad = env.blocked(nx, ny); } catch { /* n/a */ } if (bad || dist({ x: nx, y: ny }, o) > 520) dog.angle += Math.PI * 0.7; else { dog.x = nx; dog.y = ny; } dog.walk = (dog.walk || 0) + dt * 9; } }
      else { const tgt = { x: p0.x - Math.cos(p0.angle || 0) * 18, y: p0.y + 10 }; const d = dist(dog, tgt); dog.moving = d > 6; if (dog.moving) { dog.angle = Math.atan2(tgt.y - dog.y, tgt.x - dog.x); dog.x += (tgt.x - dog.x) * Math.min(1, dt * 5); dog.y += (tgt.y - dog.y) * Math.min(1, dt * 5); dog.walk = (dog.walk || 0) + dt * 9; } if (dist(p0, o) < 50) { ev.carried = false; dog.x = o.x + 10; dog.y = o.y + 6; reward(env, o, `${ev.data.name}! Oh thank you, thank you!`, [55, 90]); xp('charisma', 20, 'dog'); ev.doneAt = now; } }
      if (Math.random() < dt * 0.25 && !ev.doneAt) bubble(o, `${ev.data.name}! Here, ${ev.data.name}!`, 1800);
      if ((ev.doneAt && now - ev.doneAt > 4000) || now > ev.until) endEvent(env, ev);
    } else if (ev.kind === 'car') {
      walk(ev.o, ev.spot, 60, dt); face(ev.o, ev.car);
      if (ev.helping && now > ev.helping) { ev.helping = 0; reward(env, ev.o, 'It started! You\'re a lifesaver.', [35, 60]); xp('driving', 15, 'jump'); ev.fixed = now; }
      if ((ev.fixed && now - ev.fixed > 3000) || now > ev.until) endEvent(env, ev);
    } else if (ev.kind === 'errand') {
      walk(ev.o, ev.spot, 60, dt); if (!ev.o.moving) face(ev.o, p0);
      if (ev.taken || now > ev.until) endEvent(env, ev);
    }
  }
  function reward(env, q, line, [a, b]) { const n = Math.round(rnd(a, b)); env.player.cash += n; bubble(q, line, 2600, '#b7f5d0'); say(`👏 +$${n} · people around here will remember that`); xp('charisma', 15, 'street'); st.done++; save(); try { root.NightshiftRespect?.add?.(2); } catch { /* n/a */ } }
  function settleBet(env, ev) { if (!ev.bet) return; const won = ev.winner === ev.a; if (won) { env.player.cash += 100; say('🤑 Red took it · +$100'); xp('luck', 15, 'bet'); } else say('💸 Blue took it · there goes your $50'); save(); }

  // errand delivery
  function errandTick(env) {
    if (!errandJob) return; const p0 = env.player;
    if (dist(p0, errandJob.to) < 42 && !p0.car) { const pay = errandJob.pay; p0.cash += pay; say(`📦 Delivered to ${errandJob.name} · +$${pay}`); xp('charisma', 20, 'errand'); st.done++; try { root.NightshiftMap?.clear?.('npc-errand'); } catch { /* n/a */ } errandJob = null; save(); }
    else if (Date.now() > errandJob.until) { say('📦 Too slow · the package job fell through'); errandJob = null; }
  }

  // ---------- interaction points ----------
  function points() {
    const out = [], env = E(); if (!env) return out;
    for (const ev of events) {
      if (ev.kind === 'mug' && (ev.phase === 'start' || ev.phase === 'rob')) out.push({ id: 'npcl-' + ev.id, type: 'event', x: ev.t.x, y: ev.t.y, ready: true, color: '#ff5a6a', label: '❗ MUGGING', action: 'STOP IT', hint: 'Someone\'s getting robbed · step in (or drop the mugger)' });
      if (ev.kind === 'fight' && ev.phase === 'brawl' && !ev.bet) out.push({ id: 'npcl-' + ev.id, type: 'event', x: ev.x, y: ev.y + 30, ready: true, color: '#ffd970', label: '❗ STREET FIGHT', action: 'BET $50', hint: 'Put $50 on the guy in red · doubles if he wins' });
      if (ev.kind === 'dice') out.push({ id: 'npcl-' + ev.id, type: 'event', x: ev.x, y: ev.y + 24, ready: true, color: '#7cdeb5', label: '🎲 DICE GAME', action: 'ROLL $20', hint: 'Street dice · 45% to double your $20' });
      if (ev.kind === 'dog' && !ev.carried && !ev.doneAt) out.push({ id: 'npcl-' + ev.id, type: 'event', x: ev.dog.x, y: ev.dog.y, ready: true, color: '#ffd970', label: `🐕 ${ev.data.name.toUpperCase()}`, action: 'GRAB', hint: `Lost dog · bring ${ev.data.name} back to the owner` });
      if (ev.kind === 'dog' && !ev.carried && !ev.doneAt) out.push({ id: 'npcl-owner-' + ev.id, type: 'event', x: ev.o.x, y: ev.o.y, ready: true, color: '#9fd4ff', label: '❗ LOST DOG', action: 'ASK', hint: `Owner looking for ${ev.data.name}` });
      if (ev.kind === 'car' && !ev.fixed && !ev.helping) out.push({ id: 'npcl-' + ev.id, type: 'event', x: ev.spot.x, y: ev.spot.y, ready: true, color: '#9fd4ff', label: '❗ BREAKDOWN', action: 'HELP', hint: 'Dead battery · give them a jump' });
      if (ev.kind === 'errand' && !ev.taken) out.push({ id: 'npcl-' + ev.id, type: 'event', x: ev.o.x, y: ev.o.y, ready: true, color: '#7cdeb5', label: '❗ LOOKING FOR WORK?', action: 'TALK', hint: 'A shopkeeper needs a package run' });
    }
    if (errandJob) out.push({ id: 'npcl-drop', type: 'event', x: errandJob.to.x, y: errandJob.to.y, ready: true, color: '#7cdeb5', label: '📦 DROP-OFF', action: 'DELIVER', hint: `Package for ${errandJob.name} · $${errandJob.pay}` });
    return out;
  }
  let lastRoll = 0;
  function use(id) {
    const env = E(); if (!env) return false; const p0 = env.player;
    if (id === 'npcl-drop') { errandTick(env); return true; }
    const owner = id.startsWith('npcl-owner-'), ev = events.find((e) => 'npcl-' + (owner ? 'owner-' : '') + e.id === id); if (!ev) return false;
    if (ev.kind === 'mug') { const armed = !!(root.NightshiftWeapons?.current?.()?.id && root.NightshiftWeapons.current().id !== 'none'); ev.phase = 'scared'; ev.endAt = (performance.now() - ev.t0) / 1000 + 4; ev.away = { x: ev.t.x + (ev.t.x - p0.x) * 4, y: ev.t.y + (ev.t.y - p0.y) * 4 }; bubble(ev.t, armed ? 'Whoa whoa! I\'m gone!' : 'Tch. Not worth it.', 2000); reward(env, ev.v, 'You saved me! Here, please take this.', armed ? [40, 70] : [30, 50]); return true; }
    if (ev.kind === 'fight') { if (p0.cash < 50) { say('Needs $50'); return true; } p0.cash -= 50; ev.bet = true; say('💵 $50 on the one in red'); return true; }
    if (ev.kind === 'dice') { const now = performance.now(); if (now - lastRoll < 2500) return true; lastRoll = now; if (p0.cash < 20) { say('Needs $20'); return true; } p0.cash -= 20; const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6), luck = (() => { try { return root.NightshiftSkills?.mod?.('luck') ?? 1; } catch { return 1; } })(), win = Math.random() < Math.min(0.55, 0.45 * luck); if (win) { p0.cash += 40; say(`🎲 ${a}+${b} · you win $40`); xp('luck', 8, 'dice'); bubble(pick(ev.cast), 'Lucky…', 1400); } else { say(`🎲 ${a}+${b} · house wins`); bubble(pick(ev.cast), 'Pay up!', 1400); } save(); return true; }
    if (ev.kind === 'dog') { if (owner) { bubble(ev.o, `${ev.data.name} ran off that way! Please help!`, 2400); try { root.NightshiftMap?.navigate?.({ x: ev.dog.x, y: ev.dog.y, label: 'Lost dog', id: 'npc-dog' }); } catch { /* n/a */ } return true; } ev.carried = true; say(`🐕 You've got ${ev.data.name} · walk back to the owner`); return true; }
    if (ev.kind === 'car') { ev.helping = performance.now() + 4000; say('🔋 Hooking up the cables…'); bubble(ev.o, 'Oh thank god.', 1800); return true; }
    if (ev.kind === 'errand') {
      const IN = root.NightshiftInteriors2, d = IN?.doors?.().filter((q) => { const dd = dist(q, p0); return dd > 500 && dd < 1200; }); const to = d?.length ? pick(d) : null; if (!to) { bubble(ev.o, 'Never mind, I\'ll do it myself.', 2000); ev.taken = true; return true; }
      const dd = dist(to, p0), pay = Math.round(50 + dd * 0.08); errandJob = { to: { x: to.x, y: to.y }, name: (IN.title?.(to.type) || to.type).toLowerCase() + ' in ' + district(to.x, to.y), pay, until: Date.now() + 6 * 60000 };
      try { root.NightshiftMap?.navigate?.({ x: to.x, y: to.y, label: 'Package drop-off', id: 'npc-errand' }); } catch { /* n/a */ }
      bubble(ev.o, `Take this to the ${errandJob.name}. $${pay} when it's there.`, 3000); say(`📦 Package job · drop it at the ${errandJob.name} · $${pay}`); ev.taken = true; return true;
    }
    return false;
  }

  // ---------- damage from your bullets (game.js) ----------
  function hit(q, dmg) {
    if (!q || !actors.includes(q)) return false; q.hp = (q.hp || 40) - Math.max(1, dmg || 20);
    const ev = events.find((e) => e.cast.includes(q)), env = E();
    if (q.hp <= 0) { q.gone = true; try { env?.loot?.push({ x: q.x, y: q.y, value: Math.floor(rnd(15, 45)) }); } catch { /* n/a */ }
      if (ev && ev.kind === 'mug' && q === ev.t) { /* handled in evTick */ } else { try { env.player.heat = Math.min(5, (env.player.heat || 0) + (q.role === 'officer' ? 1.5 : 0.6)); } catch { /* n/a */ } if (ev) endEvent(env, ev); }
    } else { bubble(q, pick(['Agh!', 'What the—', 'Help!']), 1400); if (ev && ev.kind !== 'mug') { try { env.player.heat = Math.min(5, (env.player.heat || 0) + 0.3); } catch { /* n/a */ } endEvent(env, ev); } else if (ev?.kind === 'mug' && q === ev.v) endEvent(env, ev); }
    return true;
  }

  // ---------- draw ----------
  function drawWorld(env) {
    const ctx = env.g, now = performance.now(); if (!ctx) return;
    if (!root.NightshiftScene) for (const q of actors) { try { root.NightshiftSprites.person(q, false, { role: q.role || 'npc' }); } catch { /* n/a */ } }
    ctx.save(); drawLife(ctx, env, now);
    for (const ev of events) {
      if (ev.kind === 'dog') { try { if (!root.NightshiftPetArt?.draw?.(ctx, ev.data.breed, ev.dog, now / 1000)) { ctx.fillStyle = '#d8843a'; ctx.fillRect(ev.dog.x - 6, ev.dog.y - 4, 12, 7); } } catch { /* n/a */ } }
      if (ev.kind === 'car' && !ev.fixed) { for (let k = 0; k < 3; k++) { const ph = (now / 1400 + k / 3) % 1; ctx.globalAlpha = 0.45 * (1 - ph); ctx.fillStyle = '#9aa3ab'; ctx.beginPath(); ctx.arc(ev.car.x + Math.cos(ev.car.angle || 0) * 20, ev.car.y - 6 - ph * 26, 4 + ph * 6, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
      if (ev.kind === 'dice') { ctx.fillStyle = '#f1efe8'; ctx.fillRect(ev.x - 4, ev.y - 1, 4, 4); ctx.fillRect(ev.x + 2, ev.y + 1, 4, 4); ctx.fillStyle = '#0b0d14'; ctx.fillRect(ev.x - 3, ev.y, 1, 1); ctx.fillRect(ev.x + 4, ev.y + 2, 1, 1); }
    }
    ctx.textAlign = 'center'; ctx.font = '700 8px ui-monospace,Menlo,monospace';
    for (const [q, b] of bubbles) {
      if (now > b.until || (q.hp !== undefined && q.hp <= 0)) { bubbles.delete(q); continue; }
      if (Math.abs(q.x - env.player.x) > 700 || Math.abs(q.y - env.player.y) > 500) continue;
      const w = ctx.measureText(b.t).width + 10, y = q.y - 52; ctx.fillStyle = '#0c111ee6'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(q.x - w / 2, y - 10, w, 14, 5); else ctx.rect(q.x - w / 2, y - 10, w, 14); ctx.fill();
      ctx.beginPath(); ctx.moveTo(q.x - 3, y + 4); ctx.lineTo(q.x + 3, y + 4); ctx.lineTo(q.x, y + 8); ctx.fill(); ctx.fillStyle = b.color || '#e8eff7'; ctx.fillText(b.t, q.x, y);
    }
    ctx.restore();
  }

  // ---------- loop + hooks ----------
  let last = 0;
  function tick(now) {
    const env = E(), dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    if (env && env.player && Array.isArray(env.peds) && !inZone() && !(root.NightshiftRPG?.paused?.())) {
      ambientTick(env, now, dt); director(env, now);
      for (let i = events.length - 1; i >= 0; i--) if (events[i]) evTick(env, events[i], now, dt);
      if (errandJob && dist(env.player, errandJob.to) < 42) errandTick(env);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  const hook = setInterval(() => {
    const EN = root.NightshiftEncounters, C = root.NightshiftCrime, GL = root.NightshiftGangLife, F = root.NightshiftFeedback;
    if (EN && !EN.__npcl) { const locs = EN.locations, u0 = EN.use; EN.locations = function () { const list = locs.apply(this, arguments) || []; try { return [...list, ...points()]; } catch { return list; } }; EN.use = function (id) { if (typeof id === 'string' && id.startsWith('npcl-')) return use(id); return u0.apply(this, arguments); }; EN.__npcl = true; }
    if (C && typeof C.draw === 'function' && !C.__npcl) { const d0 = C.draw; C.draw = function () { const r = d0.apply(this, arguments); try { const env = E(); if (env && !inZone()) drawWorld(env); } catch { /* cosmetic */ } return r; }; C.__npcl = true; }
    if (C && typeof C.attempt === 'function' && !C.__npclRob) { const a0 = C.attempt; C.attempt = function () { const h0 = E()?.player?.heat || 0, r = a0.apply(this, arguments); if ((E()?.player?.heat || 0) > h0) witness('rob'); return r; }; C.__npclRob = true; }
    if (GL && typeof GL.entries === 'function' && !GL.__npcl) { const e0 = GL.entries; GL.entries = function () { return (e0.apply(this, arguments) || []).concat(actors.map((q) => ({ kind: q.role === 'officer' ? 'officer' : 'npc', entity: q }))); }; GL.__npcl = true; }
    if (F && typeof F.shot === 'function' && !F.__npcl) { const s0 = F.shot; F.shot = function () { try { witness('shot'); } catch { /* n/a */ } return s0.apply(this, arguments); }; F.__npcl = true; }
    if (EN?.__npcl && C?.__npcl && GL?.__npcl && F?.__npcl) clearInterval(hook);
  }, 300);
  root.NightshiftNpcLife = Object.freeze({ actors: () => actors, hit, events: () => events, start, errand: () => errandJob, stats: () => ({ ...st, active: events.map((e) => e.kind), actors: actors.length, convos: convos.length }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
