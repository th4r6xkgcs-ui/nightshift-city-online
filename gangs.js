/* Street gangs in the city (Claude-owned). Data/rules: gangs-data.js.  v0.59: teams, takeovers, guards, raids.
 *  - Turf: gang blocks carry tags, curb paint and a crew on the corners in gang colours.
 *  - Reputation: HOSTILE shoots on sight; WARY warns, then fights if you loiter, shoot on their block or hurt one;
 *    FRIENDLY lets you be, sells to you and gives you work.
 *  - Fighters think: they pick the nearest enemy they can actually see, move to cover behind parked cars, peek and
 *    shoot (missing more at range / when you move / when you're in cover), call out to each other, flank, and run
 *    when they're badly hurt. Every fighter is on a team, so gangs fight each other and your guards too.
 *  - Living turf: rival crews roll up on each other's corners (skirmishes) — stay out, or pick a side for rep.
 *  - Take a block: wipe out the crew on a corner, then hold the corner for 20 s while they send reinforcements.
 *    It's yours: tags turn magenta, it earns cash (collect at the corner), and you can HIRE people to watch it and
 *    buy them better gear (pistol, SMG + vest, carbine + plates). The old owners come back for it every 6-10 min:
 *    your guards fight them; if you're far away, the fight is decided by your guards' firepower.
 *  - Hideouts: each gang has a hideout (RAID): an indoor Bullet Echo fight (breakin.js type 'hideout') with a shot
 *    caller and a stash. Clear it and the gang is shaken: their corners run thin for a while — the time to take one.
 * Save: nightshift-gangs-v1. API: NightshiftGangs.{members, units, hit, engaged, state, open, manage, turf, stats,
 *   guardOutfit, hideoutKill, hideoutDone} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const D = root.NightshiftGangsData; if (!D) return;
  /* eslint-disable no-undef */
  const E = () => { try { return { player, cars, blocked, camera, g, loot }; } catch { return null; } };
  /* eslint-enable no-undef */
  const KEY = 'nightshift-gangs-v1';
  let state = D.clean({});
  try { state = D.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private */ } };
  const say = (m) => { try { root.say?.(m); } catch { /* n/a */ } };
  const save = () => { try { root.save?.(); } catch { /* n/a */ } };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const P = D.PLAYER;
  const units = [], shots = [], warm = [];
  const blocks = new Map();
  const st = { spawned: 0, fights: 0, kills: 0, hits: 0, skirmishes: 0, raids: 0, claims: 0 };
  const district = (x, y) => { try { return root.NightshiftWorld?.districtName?.(x, y) || ''; } catch { return ''; } };
  const holdPoint = (b) => (b.squadHold ? b.squadHold : { x: b.bx * 440 + 118, y: b.by * 340 + 268 });

  // ---------- barks: short call-outs over heads ----------
  const BARK = {
    spot: ['Get him!', 'Over there!', 'You\'re done!', 'Wrong block!', 'Light him up!'],
    cover: ['Cover!', 'Reloading!', 'Get down!'], flank: ['Flank him!', 'Go round!', 'Cut him off!'],
    hurt: ['Agh!', 'I\'m hit!', 'Ugh—'], down: ['Man down!', 'They got Lil T!', 'Nooo!'], flee: ['I\'m out!', 'Fall back!', 'Not worth it!'],
    guard: ['Not on our block!', 'On it, boss!', 'Hold the line!', 'We got this!'], clear: ['Clear!', 'Corner\'s ours.', 'That\'s what I thought.'],
    push: ['He\'s reloading!', 'Push him!', 'Now! Now!', 'Rush him!'], melee: ['Come here!', 'Hands then!', 'Square up!'],
    warn: ['Keep walking.', 'You lost?', 'This ain\'t your block.'], idle: ['…and then he says—', 'Ha!', 'Nah, for real?', 'You hear about the bank?', 'Cops been around.', 'Slow night.'],
  };
  let lastBark = 0;
  function bark(u, kind, force) { const now = performance.now(); if (!force && (now - lastBark < 500 || now < (u.barkCool || 0))) return; u.bark = { t: pick(BARK[kind] || [kind]), until: now + 1600 }; u.barkCool = now + 3500; lastBark = now; }

  // ---------- units ----------
  function outfitFor(owner, seed, tier) {
    let base = null; try { base = root.NightshiftWardrobeData?.npcOutfit?.(seed); } catch { /* n/a */ }
    return owner === P ? D.crewOutfit(base, tier || 0, seed) : D.outfit(base, owner, seed);
  }
  function makeUnit(o) {
    const u = { hp: 55, maxHp: 55, angle: Math.PI / 2, mode: 'hang', nextShot: 0, walkTicks: 0, moving: false, goal: null, nextPlan: 0, ...o };
    units.push(u); st.spawned++;
    for (const d of [2, 1, 3, 0, 4]) for (let k = 0; k < 6; k += 2) warm.push([u, d, 'idle', k]);
    return u;
  }
  function spawnLocals(b) {
    const g = b.owner;
    D.spots(b.bx, b.by).forEach((sp, i) => {
      const id = `gang-${g.id}-${b.bx}-${b.by}-${i}`; if ((state.dead[id] || 0) > Date.now()) return;
      const look = hash(g.id) % 1000 + (hash(id) % 5);
      makeUnit({ id, team: g.id, gang: g, block: b, role: 'local', home: { x: sp.x, y: sp.y }, face: sp.face, x: sp.x, y: sp.y, hp: D.GANG_GEAR.hp, maxHp: D.GANG_GEAR.hp, gear: D.GANG_GEAR,
        angle: Math.atan2(sp.face.y - sp.y, sp.face.x - sp.x), seated: !!sp.sit, seat: sp.sit ? { x: sp.x, y: sp.y } : null, outfit: outfitFor(g, look) });
    });
  }
  function spawnGuards(b) {
    const o = state.owned[b.key]; if (!o) return; const sp = D.spots(b.bx, b.by);
    o.guards.forEach((gd, i) => {
      const s = sp[i % sp.length], gear = D.GEAR[gd.tier] || D.GEAR[0], look = 9000 + (hash(gd.id) % 6);
      makeUnit({ id: 'guard-' + gd.id, team: 'you', gang: P, block: b, role: 'guard', ref: gd, home: { x: s.x, y: s.y }, face: { x: s.x, y: s.y + 40 }, x: s.x, y: s.y, hp: gear.hp, maxHp: gear.hp, gear, outfit: outfitFor(P, look, gd.tier) });
    });
  }
  function respawnBlock(b) {
    for (let i = units.length - 1; i >= 0; i--) if (units[i].block === b && units[i].role !== 'raider') units.splice(i, 1);
    b.owner = state.owned[b.key] ? P : D.BY_ID[D.turfAt(b.bx * 440 + 1, b.by * 340 + 1).gang.id];
    if (b.owner === P) spawnGuards(b); else spawnLocals(b);
  }
  function ensureBlocks(p) {
    for (const g of D.GANGS) for (const [bx, by] of g.blocks) {
      const key = D.blockKey(bx, by), r = D.blockRect(bx, by), d = Math.hypot(r.x + r.w / 2 - p.x, r.y + r.h / 2 - p.y);
      if (d < 1500 && !blocks.has(key)) { const b = { key, bx, by, home: g, owner: g, alertUntil: 0, fightUntil: 0, loiter: 0, warned: 0, hold: 0, raid: null, attackers: null }; blocks.set(key, b); respawnBlock(b); }
      else if (d > 2100 && blocks.has(key)) { const b = blocks.get(key); blocks.delete(key); for (let i = units.length - 1; i >= 0; i--) if (units[i].block === b) units.splice(i, 1); }
    }
  }

  // ---------- who fights whom ----------
  const rel = (g) => D.relation(state.rep[g.id] || 0);
  function foesOf(u, now) {
    if (u.role === 'guard') return 'guard';
    if (u.role === 'raider') return u.vs;
    const b = u.block, f = []; if (b.fightUntil > now) f.push('player', 'you'); if (b.attackers) f.push(b.attackers); return f;
  }
  function isFoe(u, v, now) {
    if (v === u || v.hp <= 0 || v.team === u.team) return false;
    const f = foesOf(u, now);
    if (f === 'guard') return v.team !== 'you' && ((v.role === 'raider' && (v.vs.includes('you') || v.vs.includes('player'))) || (v.role === 'local' && v.block.fightUntil > now));
    return f.includes(v.team) || (v.team === 'you' && f.includes('you'));
  }
  function wantsPlayer(u, now) { const f = foesOf(u, now); return f !== 'guard' && f.includes('player'); }

  function provoke(b, why) {
    if (b.owner === P) return;
    const now = performance.now();
    if (b.fightUntil < now) { st.fights++; say(`🔥 ${b.owner.name} open fire · ${why}`); const u = units.find((x) => x.block === b && x.role === 'local'); if (u) bark(u, 'spot', true); }
    b.fightUntil = now + 25000;
    for (const o of blocks.values()) if (o.owner === b.owner && o !== b) o.fightUntil = Math.max(o.fightUntil, now + 15000);
    for (const m of units) if (m.block === b) { m.seated = false; m.seat = null; }
  }
  function onDeath(u, byPlayer) {
    units.splice(units.indexOf(u), 1); st.kills++;
    const env = E();
    // v0.64: squads (story bosses, robbers) report deaths on the shared event bus (multiplayer-ready)
    try { root.dispatchEvent?.(new CustomEvent('ns:event', { detail: { type: 'kill', team: u.team, tag: u.tag || null, boss: !!u.boss, role: u.role, byPlayer: !!byPlayer, x: u.x, y: u.y, melee: !!u.lastMelee } })); } catch { /* n/a */ }
    try { u.onDeath?.(u, byPlayer); } catch { /* n/a */ }
    if (u.squad) { if (byPlayer) { try { env?.loot?.push({ x: u.x, y: u.y, value: Math.floor(rnd(30, 110)) * (u.boss ? 5 : 1) }); } catch { /* n/a */ } try { root.NightshiftMelee?.dropFrom?.(u); } catch { /* n/a */ } } persist(); return; }
    if (u.role === 'local') state.dead[u.id] = Date.now() + 5 * 60000;
    if (u.role === 'guard') { const o = state.owned[u.block.key]; if (o) o.guards = o.guards.filter((gd) => gd !== u.ref); say(`💀 One of your guards on ${district(u.x, u.y)} went down`); }
    const mate = units.find((v) => v.team === u.team && dist(v, u) < 220); if (mate) bark(mate, 'down');
    if (byPlayer && u.team !== 'you') {
      state.kills++;
      const b = u.block, skirmishHelp = u.role === 'raider' && b.owner !== P && b.attackers === u.team;
      if (skirmishHelp) { D.change(state, u.team, -10); D.change(state, b.owner.id, 6); say(`🤝 ${b.owner.short} saw you drop one of the ${u.gang.short} · +rep with ${b.owner.name}`); }
      else { D.change(state, u.team, -15); if (u.gang.rival) D.change(state, u.gang.rival, 4); }
      try { env?.loot?.push({ x: u.x, y: u.y, value: Math.floor(rnd(20, 90)) }); } catch { /* n/a */ }
      try { root.NightshiftMelee?.dropFrom?.(u); } catch { /* n/a */ }
      if (state.job && state.job.target === u.team) {
        state.job.done++;
        if (state.job.done >= state.job.need) { const j = state.job, from = D.BY_ID[j.from]; if (env) env.player.cash += j.pay; D.change(state, j.from, 15); state.job = null; say(`💰 Job done for ${from.name} · +$${j.pay} · they've got your back`); save(); }
        else say(`🎯 ${state.job.done}/${state.job.need} ${u.gang.name} down`);
      }
      try { if (env) env.player.heat = Math.min(5, (env.player.heat || 0) + 0.35); } catch { /* n/a */ }
    }
    persist();
  }
  function damage(u, dmg, byPlayer, from, opts) {
    if (!u || u.hp <= 0 || !units.includes(u)) return false;
    u.hp -= Math.max(1, dmg); st.hits++; u.lastMelee = !!opts?.melee;
    // v0.64 hit reactions: a short flinch for bullets, a real stagger + knockback for melee
    const now0 = performance.now(); u.flinchUntil = now0 + 160;
    if (opts?.knock && from) { const d = Math.max(1, dist(u, from)); push(u, (u.x - from.x) / d * opts.knock, (u.y - from.y) / d * opts.knock, opts.stun || 350); }
    if (u.squad && byPlayer && u.vs && !u.vs.includes('player')) u.vs.push('player');
    if (u.hp > 0) { bark(u, 'hurt'); if (from) { u.lastThreat = { x: from.x, y: from.y }; u.nextPlan = 0; } }
    if (byPlayer && u.team !== 'you') {
      const b = u.block;
      if (u.role === 'local' && !(opts?.silent && !units.some((v) => v !== u && v.block === b && v.role === 'local' && sightTo(v, u, 170)))) provoke(b, opts?.melee ? 'you jumped one of them' : 'you shot one of them');
      if (u.role === 'raider' && !u.vs.includes('player') && !(b.owner !== P && b.attackers === u.team)) u.vs.push('player');
    }
    if (u.hp <= 0) onDeath(u, byPlayer);
    return true;
  }
  const hit = (u, dmg, opts) => { const env = E(); return u?.team !== 'you' && damage(u, dmg || 20, true, env?.player, opts); };
  // knockback that respects walls; stun = no moving or shooting
  function push(u, dx, dy, stunMs) { const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4)); for (let i = 0; i < n; i++) { const nx = u.x + dx / n, ny = u.y + dy / n; if (canStep(nx, u.y)) u.x = nx; if (canStep(u.x, ny)) u.y = ny; } if (stunMs) u.stunUntil = Math.max(u.stunUntil || 0, performance.now() + stunMs); u.seated = false; u.seat = null; u.nextPlan = 0; }
  // v0.64 squads: story bosses, store robbers, hit crews. Not tied to a turf block; they fight whoever is in `vs`.
  let squadN = 0;
  function squad(o) {
    const env = E(); const g = (typeof o.gang === 'string' ? D.BY_ID[o.gang] : o.gang) || D.GANGS[0], out = [], n = Math.max(1, Math.min(8, o.n || 1));
    const b = { key: 'squad-' + (o.tag || ++squadN), bx: Math.floor(o.x / 440), by: Math.floor(o.y / 340), home: g, owner: g, alertUntil: 0, fightUntil: 0, loiter: 0, warned: 0, hold: 0, raid: null, attackers: null, squad: true, squadHold: { x: o.x, y: o.y } };
    if (env?.player) refreshNear(env.player);
    for (let i = 0; i < n; i++) {
      let x = o.x, y = o.y; for (let k = 0; k < 12; k++) { const a = (i * 2.4 + k * 0.9), r = i === 0 && o.boss ? 0 : 26 + k * 8; x = o.x + Math.cos(a) * r; y = o.y + Math.sin(a) * r * 0.6; if (canStep(x, y)) break; }
      const boss = i === 0 && o.boss ? o.boss : null, gear0 = o.gear || D.GANG_GEAR, gear = boss ? { ...gear0, dmg: boss.dmg || gear0.dmg * 1.4, err: (gear0.err || 0.12) * 0.75, range: Math.max(gear0.range || 220, 240), cool: gear0.cool } : gear0, hp = boss ? (boss.hp || 260) : (o.hp || gear0.hp + 10);
      const look = hash(g.id) % 1000 + ((i + squadN) % 5), outfit = outfitFor(g.id === 'you' ? P : (D.BY_ID[g.id] ? g : D.GANGS[0]), look, o.gearTier || 1);
      if (boss) { outfit.outer = { id: 'leather', color: 0 }; outfit.jewelry = { id: 'chain', color: 0 }; outfit.face = { id: 'shades', color: 0 }; }
      out.push(makeUnit({ id: `squad-${b.key}-${i}`, team: g.id, gang: g, block: b, role: 'raider', squad: true, tag: o.tag || null, vs: (o.vs || ['player', 'you']).slice(), home: { x: o.x, y: o.y }, face: { x: o.x, y: o.y + 40 }, x, y, hp, maxHp: hp, gear, outfit, alert: true, boss: boss ? { name: boss.name } : null, meleeOnly: !!o.meleeOnly || !!boss?.meleeOnly, hunt: o.hunt || 0, onDeath: o.onDeath || null, giveUp: Infinity, angle: Math.PI / 2 }));
    }
    return out;
  }
  const clearSquad = (tag) => { for (let i = units.length - 1; i >= 0; i--) if (units[i].tag === tag) units.splice(i, 1); };

  // ---------- movement / sight ----------
  let near = [];
  function refreshNear(p) { let B = []; try { B = buildings; } catch { /* n/a */ } near = B.filter((b) => Math.abs(b.x + b.w / 2 - p.x) < 900 && Math.abs(b.y + b.h / 2 - p.y) < 750); } // eslint-disable-line no-undef
  const solid = (x, y) => { for (const b of near) if (x > b.x - 9 && x < b.x + b.w + 9 && y > b.y - 9 && y < b.y + b.h + 9) return true; return false; };
  const canStep = (x, y) => !solid(x, y);
  function sightTo(a, b, range) { const d = dist(a, b); if (d > range) return false; const n = Math.max(1, Math.ceil(d / 12)); for (let i = 1; i < n; i++) if (solid(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false; return true; }
  function coverSpot(env, u, threat) {
    let best = null, bd = 1e9;
    for (const c of env.cars) {
      if (Math.abs(c.speed || 0) > 0.5) continue; const d = dist(c, u); if (d > 160) continue;
      const dd = Math.max(1, dist(c, threat)), sx = c.x + (c.x - threat.x) / dd * 30, sy = c.y + (c.y - threat.y) / dd * 30;
      if (!canStep(sx, sy)) continue; const score = d + (units.some((v) => v !== u && v.goal && dist(v.goal, { x: sx, y: sy }) < 20) ? 120 : 0); // don't share a spot
      if (score < bd) { bd = score; best = { x: sx, y: sy, car: c }; }
    }
    return best;
  }
  function moveTo(u, goal, speed, dt) {
    const dx = goal.x - u.x, dy = goal.y - u.y, d = Math.hypot(dx, dy); if (d < 3) { u.moving = false; return true; }
    const s = Math.min(d, speed * dt), nx = u.x + dx / d * s, ny = u.y + dy / d * s;
    let moved = false; if (canStep(nx, u.y)) { u.x = nx; moved = true; } if (canStep(u.x, ny)) { u.y = ny; moved = true; }
    if (!moved) u.nextPlan = 0;
    u.moving = moved; if (moved) { u.walkTicks += dt * 60; u.moveAngle = Math.atan2(dy, dx); }
    return false;
  }

  // ---------- fighting ----------
  function fire(env, u, t, now) {
    const tgt = t.unit || env.player, d = dist(u, tgt), mv = t.unit ? t.unit.moving : env.player.moving, cov = t.unit ? t.unit.inCover : env.player.inCover;
    const err = u.gear.err * (1 + (mv ? 0.7 : 0) + d / 400) * (cov ? 1.3 : 1);
    const a = Math.atan2(tgt.y - u.y, tgt.x - u.x) + (Math.random() * 2 - 1) * err;
    shots.push({ x: u.x, y: u.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, life: 1.0, dmg: u.gear.dmg, team: u.team, from: u });
    u.nextShot = now + rnd(u.gear.cool[0], u.gear.cool[1]); u.inCover = false; u.angle = a; u.shots = (u.shots || 0) + 1;
    if (u.shots % 6 === 0) { u.nextShot += 1200; bark(u, 'cover'); }
    try { root.NightshiftCombatVision?.shot(u.x, u.y, u.team === 'you' ? 'ally' : 'gang'); } catch { /* n/a */ }
  }
  function chooseTarget(env, u, now) {
    if (now < (u.nextTarget || 0) && u.target && (u.target.player || (u.target.unit && u.target.unit.hp > 0 && units.includes(u.target.unit)))) return u.target;
    u.nextTarget = now + 400;
    let best = null, bd = 1e9; const range = u.gear.range + 60;
    if (wantsPlayer(u, now) && env.player.hp > 0) { const d = dist(u, env.player); if (d < range && sightTo(u, env.player, range)) { best = { player: true }; bd = d * (env.player.car ? 1.6 : 1); } }
    for (const v of units) { if (!isFoe(u, v, now)) continue; const d = dist(u, v); if (d < bd && d < range && sightTo(u, v, range)) { best = { unit: v }; bd = d; } }
    if (best && !u.target) bark(u, u.role === 'guard' ? 'guard' : 'spot');
    u.target = best; return best;
  }
  function anyFoeNear(u, now, env) { if (wantsPlayer(u, now) && dist(u, env.player) < 500) return env.player; return units.find((v) => isFoe(u, v, now) && dist(u, v) < 500) || null; }
  function unitTick(env, u, now, dt) {
    const p = env.player;
    if (now < (u.stunUntil || 0)) { u.moving = false; u.inCover = false; return; }
    // flee when badly hurt (guards hold their ground)
    if (u.fleeing) { const away = { x: u.x + (u.x - u.fleeing.x) * 2, y: u.y + (u.y - u.fleeing.y) * 2 }; moveTo(u, away, 92, dt); if (dist(u, p) > 900 || now > u.fleeUntil) { if (u.role === 'raider') { units.splice(units.indexOf(u), 1); return; } u.fleeing = null; } return; }
    if (u.role !== 'guard' && !u.boss && u.hp < u.maxHp * 0.3 && !u.triedFlee) { u.triedFlee = true; if (Math.random() < 0.4) { u.fleeing = u.lastThreat || p; u.fleeUntil = now + 9000; bark(u, 'flee', true); return; } }
    const t = chooseTarget(env, u, now), threat = t ? (t.unit || p) : anyFoeNear(u, now, env);
    if (!threat) {
      // calm: go home, hang out, chat
      u.mode = u.role === 'raider' ? 'walk' : 'hang'; u.inCover = false; u.target = null;
      if (u.squad) { const huntP = u.hunt && p.hp > 0 && dist(u, p) < u.hunt; moveTo(u, huntP ? p : u.home, huntP ? 72 : 55, dt); if (!huntP && dist(u, u.home) < 6) { u.moving = false; u.angle = Math.atan2(p.y - u.y, p.x - u.x); } return; }
      if (u.role === 'raider') { const hp0 = holdPoint(u.block); if (moveTo(u, hp0, 66, dt) || dist(u, hp0) < 30) { if (!u.vs.length || now > (u.giveUp || (u.giveUp = now + 20000))) units.splice(units.indexOf(u), 1); } return; }
      if (!u.seated && dist(u, u.home) > 4) { moveTo(u, u.home, 50, dt); return; }
      u.moving = false;
      const alert = u.block.alertUntil > now && dist(u, p) < 260 && u.role === 'local';
      u.angle = alert ? Math.atan2(p.y - u.y, p.x - u.x) : Math.atan2(u.face.y - u.y, u.face.x - u.x) + Math.sin(now / 1700 + u.home.x) * 0.25;
      if (!alert && Math.random() < dt * 0.04 && dist(u, p) < 420) bark(u, u.role === 'guard' ? 'idle' : 'idle');
      return;
    }
    u.seated = false; u.seat = null; u.mode = 'fight';
    // v0.64 close quarters: anyone this close throws hands instead of shooting; brawlers always close the gap
    const onPlayer = !t?.unit && threat === p && !p.car && p.hp > 0, dP = dist(u, p);
    if (onPlayer && (u.meleeOnly || dP < 34)) {
      if (dP > 24) moveTo(u, p, u.boss ? 82 : 78, dt); else u.moving = false;
      u.angle = Math.atan2(p.y - u.y, p.x - u.x); u.inCover = false;
      if (dP >= 30) u.windUp = 0; else if (!u.windUp) u.windUp = now + 280;
      if (dP < 30 && now > (u.nextMelee || 0) && now > u.windUp) { u.nextMelee = now + (u.boss ? 1000 : 1350) + Math.random() * 300; u.swingAt = now; if (Math.random() < 0.3) bark(u, 'melee'); const dmg = u.boss ? 13 : 6; try { if (root.NightshiftMelee?.incoming?.(u, dmg) !== false) root.NightshiftRecovery?.damage?.(dmg, now); } catch { /* n/a */ } }
      return;
    }
    let reloading = false; try { reloading = onPlayer && combatState.until > now && dP < 330; } catch { /* n/a */ } // eslint-disable-line no-undef
    if (reloading && !u.pushed) { u.pushed = true; u.nextPlan = 0; if (Math.random() < 0.6) bark(u, 'push', true); }
    if (!reloading) u.pushed = false;
    if (now > (u.nextPlan || 0)) {
      u.nextPlan = now + rnd(1300, 2600);
      const cv = coverSpot(env, u, threat), want = u.gear.range * rnd(0.5, 0.8);
      if (reloading && Math.random() < 0.75) { const a = Math.atan2(u.y - p.y, u.x - p.x); u.goal = { x: p.x + Math.cos(a) * 60, y: p.y + Math.sin(a) * 60 }; }
      else if (cv && Math.random() < 0.65) u.goal = cv;
      else {
        // flank: swing around the target, away from team-mates, at a working distance
        const mates = units.filter((v) => v.team === u.team && v !== u && dist(v, u) < 200).length, swing = mates > 1 ? (u.slot = u.slot ?? (Math.random() < 0.5 ? -1 : 1)) * rnd(0.6, 1.2) : rnd(-0.6, 0.6);
        const a = Math.atan2(u.y - threat.y, u.x - threat.x) + swing; u.goal = { x: threat.x + Math.cos(a) * want, y: threat.y + Math.sin(a) * want };
        if (!canStep(u.goal.x, u.goal.y)) u.goal = { x: u.x + rnd(-40, 40), y: u.y + rnd(-30, 30) };
        if (Math.abs(swing) > 0.6) bark(u, 'flank');
      }
    }
    const there = u.goal ? moveTo(u, u.goal, u.role === 'guard' ? 70 : 76, dt) : true;
    u.inCover = there && !!u.goal?.car && now < u.nextShot - 400;
    if (t) { u.angle = Math.atan2(threat.y - u.y, threat.x - u.x); if (now >= u.nextShot && (there || Math.random() < 0.03)) fire(env, u, t, now); }
  }
  function shotsTick(env, dt) {
    const p = env.player;
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i], end = { x: s.x + s.vx * dt, y: s.y + s.vy * dt }; s.life -= dt;
      let wall = null; try { wall = root.NightshiftVehicleGeometry?.traceCover?.(s, end, env.cars, env.blocked, p.car) || null; } catch { /* n/a */ }
      let best = null, bt = 2;
      const seg = (o, r) => { try { return root.NightshiftNavigation.segmentCircle(s, end, o, r); } catch { return null; } };
      if (s.team !== 'you') { const t = seg(p, p.car ? 25 : p.inCover ? 7 : 12); if (t !== null && t < bt) { bt = t; best = { player: true }; } }
      for (const v of units) { if (v.team === s.team || v === s.from) continue; if (Math.abs(v.x - s.x) > 60 || Math.abs(v.y - s.y) > 60) continue; const t = seg(v, v.inCover ? 9 : 13); if (t !== null && t < bt) { bt = t; best = { unit: v }; } }
      if (best && (!wall || bt < wall.t)) {
        shots.splice(i, 1);
        if (best.player) {
          const ducked = p.inCover && !p.car && env.cars.some((c) => dist(c, p) < 48 && root.NightshiftNavigation.segmentCircle(s, p, c, 30) !== null);
          if (ducked) { try { root.NightshiftFeedback?.burst?.(p.x + (s.x - p.x) * 0.2, p.y + (s.y - p.y) * 0.2, 'wall'); } catch { /* n/a */ } continue; }
          try { root.NightshiftRecovery?.damage?.(p.car ? Math.ceil(s.dmg * 0.4) : s.dmg, performance.now()); } catch { /* n/a */ }
        } else { try { root.NightshiftFeedback?.burst?.(best.unit.x, best.unit.y, 'hit'); } catch { /* n/a */ } damage(best.unit, s.dmg, false, s.from); }
        continue;
      }
      if (wall || s.life <= 0) { if (wall) { try { root.NightshiftFeedback?.burst?.(wall.x, wall.y, 'wall'); } catch { /* n/a */ } } shots.splice(i, 1); continue; }
      s.x = end.x; s.y = end.y;
    }
  }

  // ---------- raids, skirmishes, takeovers ----------
  function spawnRaiders(b, team, n, vs, why) {
    const g = D.BY_ID[team], hp0 = holdPoint(b);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, x = hp0.x + side * rnd(200, 300), y = b.by * 340 + 330 + rnd(-6, 6);
      if (!canStep(x, y)) continue;
      const look = hash(g.id) % 1000 + (i % 5);
      makeUnit({ id: `raid-${team}-${Date.now().toString(36)}-${i}`, team, gang: g, block: b, role: 'raider', vs: vs.slice(), home: { x: hp0.x, y: hp0.y }, face: hp0, x, y, hp: D.GANG_GEAR.hp + 10, maxHp: D.GANG_GEAR.hp + 10, gear: D.GANG_GEAR, outfit: outfitFor(g, look), angle: Math.atan2(hp0.y - y, hp0.x - x) });
    }
    if (why) say(why);
  }
  let nextSkirmish = performance.now() + 60000;
  function worldTick(env, now, dt) {
    const p = env.player;
    // gang-vs-gang skirmishes near you
    if (now > nextSkirmish) {
      nextSkirmish = now + rnd(100000, 160000);
      const cands = [...blocks.values()].filter((b) => b.owner !== P && !b.attackers && units.some((u) => u.block === b && u.role === 'local') && dist(holdPoint(b), p) < 1300 && dist(holdPoint(b), p) > 250);
      const b = cands.length ? pick(cands) : null;
      if (b) { b.attackers = b.owner.rival; b.skirmishUntil = now + 60000; st.skirmishes++; spawnRaiders(b, b.owner.rival, 3, [b.owner.id], `💥 ${D.BY_ID[b.owner.rival].name} rolled up on a ${b.owner.short} corner in ${district(b.bx * 440 + 200, b.by * 340 + 200)} · stay out of it, or pick a side`); }
    }
    for (const b of blocks.values()) {
      if (b.attackers && (now > b.skirmishUntil || !units.some((u) => u.block === b && u.role === 'raider' && u.team === b.attackers) || !units.some((u) => u.block === b && u.role === 'local'))) b.attackers = null;
      // takeover: an empty gang corner + you standing on it
      if (b.owner !== P) {
        const hp0 = holdPoint(b), locals = units.some((u) => u.block === b && u.role === 'local'), onIt = !p.car && p.hp > 0 && dist(p, hp0) < 70;
        if (!locals && onIt) {
          if (b.hold === 0) { say(`🏴 Holding the ${b.owner.short} corner · stay on it ${D.HOLD_S}s · they'll send people`); spawnRaiders(b, b.owner.id, 2, ['player', 'you']); b.wave = now + 7000; }
          b.hold += dt;
          if (now > b.wave && b.hold < D.HOLD_S - 4) { b.wave = now + 8000; spawnRaiders(b, b.owner.id, 2, ['player', 'you']); }
          if (b.hold >= D.HOLD_S) {
            const from = b.owner; D.claim(state, b.bx, b.by, from.id); st.claims++; b.hold = 0; persist(); respawnBlock(b);
            say(`🏴 This corner is yours now. Tap MANAGE here to hire people to watch it · it earns cash · ${from.name} will want it back`);
            try { root.NightshiftSkills?.gain?.('charisma', 60, 'turf'); } catch { /* n/a */ } save();
          }
        } else if (b.hold > 0) { b.hold = Math.max(0, b.hold - dt * (onIt ? 0 : 0.6)); if (b.hold === 0 && !onIt) say('🏳️ You stepped off the corner'); }
      } else {
        // your block: counterattacks
        const o = state.owned[b.key]; if (!o) { respawnBlock(b); continue; }
        if (!b.raid && Date.now() > o.nextRaid) {
          b.raid = { team: o.from, until: now + 120000 }; st.raids++;
          spawnRaiders(b, o.from, 3 + Math.min(2, Math.floor((Date.now() - o.since) / (20 * 60000))), ['you', 'player'], `⚠️ ${D.BY_ID[o.from].name} are hitting your corner in ${district(b.bx * 440 + 200, b.by * 340 + 200)}!`);
          o.nextRaid = Date.now() + rnd(6, 10) * 60000; persist();
        }
        if (b.raid) {
          const raiders = units.filter((u) => u.block === b && u.role === 'raider' && u.team === b.raid.team), guards = units.filter((u) => u.block === b && u.role === 'guard');
          if (!raiders.length) { b.raid = null; const gd = guards[0]; if (gd) bark(gd, 'clear', true); say('✅ Your corner held'); }
          else if (!guards.length && dist(p, holdPoint(b)) > 160 && raiders.some((r) => dist(r, holdPoint(b)) < 90)) {
            b.raid.lostT = (b.raid.lostT || 0) + dt;
            if (b.raid.lostT > 15) { const from = D.BY_ID[o.from]; D.lose(state, b.bx, b.by); persist(); for (const r of raiders) units.splice(units.indexOf(r), 1); b.raid = null; respawnBlock(b); say(`🏳️ ${from.name} took the corner back`); }
          }
        }
      }
    }
  }
  // Blocks you own but aren't near: counterattacks resolve on the odds.
  function offscreenRaids() {
    const now = Date.now();
    for (const [k, o] of Object.entries(state.owned)) {
      if (blocks.has(k) || now < o.nextRaid) continue;
      const [bx, by] = k.split(',').map(Number), where = district(bx * 440 + 200, by * 340 + 200), from = D.BY_ID[o.from];
      o.nextRaid = now + rnd(6, 10) * 60000;
      if (Math.random() < D.defendChance(o, 4)) { if (o.guards.length && Math.random() < 0.3) { o.guards.splice(Math.floor(Math.random() * o.guards.length), 1); say(`🛡️ Your crew in ${where} held off ${from.short} · lost one guard`); } else say(`🛡️ Your crew in ${where} held off ${from.name}`); }
      else { D.lose(state, bx, by); say(`🏳️ ${from.name} took your corner in ${where} back · more guards, better gear next time`); }
      persist();
    }
  }
  setInterval(() => { try { offscreenRaids(); } catch (e) { console.error(e); } }, 5000);

  // ---------- hideouts (breakin.js type 'hideout') ----------
  function hideoutDoor(g) {
    const [bx, by] = g.blocks[0]; let B = []; try { B = buildings; } catch { /* n/a */ } // eslint-disable-line no-undef
    const b = B.find((q) => Math.floor(q.x / 440) === bx && Math.floor(q.y / 340) === by); if (!b) return null;
    return { x: b.x + b.w - 40, y: b.y - 13 };
  }
  function raid(gid) {
    const g = D.BY_ID[gid], d = hideoutDoor(g); if (!g || !d) return;
    if (rel(g) === 'FRIENDLY') { say(`🤝 ${g.name} are your friends. Raiding them would burn that.`); return; }
    const left = (state.hideoutAt[gid] || 0) - Date.now(); if (left > 0) { say(`🔒 ${g.short} moved the stash after last time · back in ${Math.ceil(left / 60000)} min`); return; }
    if (!root.NightshiftBreakin?.start) { say('Not available'); return; }
    root.NightshiftBreakin.start({ id: 'hideout-' + gid, type: 'hideout', name: g.name + ' hideout', from: 'city', door: d, gang: gid });
  }
  function hideoutKill(gid) { D.change(state, gid, -8); persist(); }
  function hideoutDone(gid, cleared, kills) {
    const g = D.BY_ID[gid]; if (!g) return; state.hideoutAt[gid] = Date.now() + 30 * 60000;
    if (cleared) {
      const until = Date.now() + 12 * 60000;
      for (const [bx, by] of g.blocks) for (let i = 0; i < 6; i++) if (i % 3 !== 0) state.dead[`gang-${gid}-${bx}-${by}-${i}`] = until;
      if (g.rival) D.change(state, g.rival, 15);
      say(`🏴 ${g.name} are shaken · their corners are thin for a while · clear one and hold it to make it yours`);
      for (const b of blocks.values()) if (b.owner === g) respawnBlock(b);
    } else if (kills) say(`${g.short} will remember that`);
    persist();
  }
  function guardOutfit(gid, i, kind) { const g = D.BY_ID[gid]; if (!g) return null; const o = outfitFor(g, hash(gid) % 1000 + (i % 5)); if (kind === 'boss') { o.jewelry = { id: 'chainwatch', color: 0 }; o.outer = { id: 'leather', color: 0 }; } return o; }

  // ---------- turf awareness ----------
  let lastTurf = null;
  function turfTick(env, now, dt) {
    const p = env.player, t = D.turfAt(p.x, p.y), key = t ? D.blockKey(t.bx, t.by) : null, b = key ? blocks.get(key) : null;
    if (key !== lastTurf && b) {
      if (b.owner === P) say('🏴 Your corner · your people are watching it');
      else { const r = rel(b.owner); say(`${r === 'HOSTILE' ? '☠️' : r === 'FRIENDLY' ? '🤝' : '⚠️'} ${b.owner.name} turf · ${r === 'HOSTILE' ? 'they want you dead' : r === 'FRIENDLY' ? 'you\'re good here' : 'keep it moving'}`); }
    }
    lastTurf = key;
    if (!b || b.owner === P) return;
    const r = rel(b.owner);
    if (r === 'HOSTILE' && !p.car && units.some((m) => m.block === b && m.role === 'local' && sightTo(m, p, 260))) { if (b.fightUntil < now) provoke(b, 'you\'re on their block'); return; }
    if (r === 'FRIENDLY') return;
    const close = units.some((m) => m.block === b && m.role === 'local' && dist(m, p) < 70);
    b.loiter = close && !p.car ? b.loiter + dt : Math.max(0, b.loiter - dt * 0.5);
    if (close) b.alertUntil = now + 4000;
    if (b.loiter > 3 && now - b.warned > 8000 && b.fightUntil < now) { b.warned = now; const u = units.find((m) => m.block === b && m.role === 'local' && dist(m, p) < 90); if (u) bark(u, 'warn', true); }
    if (b.loiter > 9 && b.fightUntil < now) provoke(b, 'you didn\'t walk');
  }
  function playerFired() {
    const env = E(); if (!env) return; const t = D.turfAt(env.player.x, env.player.y); if (!t) return;
    const b = blocks.get(D.blockKey(t.bx, t.by)); if (b && b.owner !== P && rel(b.owner) !== 'FRIENDLY' && !b.attackers) provoke(b, 'shots on their block');
  }

  // ---------- draw ----------
  function tag(ctx, x, y, text, col, glow, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.font = '900 15px "Chakra Petch",Impact,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = glow; ctx.shadowBlur = 4; ctx.lineWidth = 3; ctx.strokeStyle = '#0b0d14cc'; ctx.strokeText(text, 0, 0); ctx.fillStyle = col === '#1d2024' ? '#c9d1d6' : col; ctx.fillText(text, 0, 0); ctx.shadowBlur = 0;
    ctx.fillStyle = col === '#1d2024' ? '#c9d1d6aa' : col + 'aa'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 6, 7, 1.4, 3 + ((i * 7 + 11) % 5));
    ctx.restore();
  }
  function drawTurf(env) {
    const ctx = env.g, cam = env.camera; if (!ctx || !cam) return; const now = performance.now();
    for (const b of blocks.values()) {
      const r = D.blockRect(b.bx, b.by), g = b.owner;
      if (r.x > cam.x + 1400 || r.x + r.w < cam.x - 200 || r.y > cam.y + 900 || r.y + r.h < cam.y - 200) continue;
      ctx.save();
      ctx.fillStyle = g.color === '#1d2024' ? '#3a3f48' : g.color; ctx.globalAlpha = 0.5; for (let x = r.x + 70; x < r.x + 370; x += 26) ctx.fillRect(x, r.y + 292, 14, 3);
      ctx.globalAlpha = 0.9;
      tag(ctx, r.x + 96, r.y + 228, g.short, g.color, g.glow, -0.12); tag(ctx, r.x + 300, r.y + 232, g.short, g.color, g.glow, 0.1); tag(ctx, r.x + 214, r.y + 300, g.short, g.color, g.glow, 0.04);
      ctx.globalAlpha = 1; ctx.fillStyle = '#0b0d14'; ctx.fillRect(r.x + 60, r.y + 246, 2, 30); ctx.fillStyle = g.color === '#1d2024' ? '#c9d1d6' : g.color; ctx.fillRect(r.x + 62, r.y + 248, 10, 6); ctx.fillStyle = '#ffffff44'; ctx.fillRect(r.x + 62, r.y + 248, 10, 1);
      if (b.hold > 0 && b.owner !== P) { const hp0 = holdPoint(b), f = Math.min(1, b.hold / D.HOLD_S); ctx.lineWidth = 4; ctx.strokeStyle = '#0b0d14aa'; ctx.beginPath(); ctx.arc(hp0.x, hp0.y, 34, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = P.glow; ctx.beginPath(); ctx.arc(hp0.x, hp0.y, 34, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); }
      else if (b.owner !== P && !units.some((u) => u.block === b && u.role === 'local')) { const hp0 = holdPoint(b); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 300); ctx.setLineDash([5, 5]); ctx.strokeStyle = P.glow; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hp0.x, hp0.y, 34, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
    }
    for (const g of D.GANGS) { const d = hideoutDoor(g); if (!d || Math.abs(d.x - env.player.x) > 900 || Math.abs(d.y - env.player.y) > 700) continue; ctx.save(); ctx.fillStyle = '#0b0d14'; ctx.fillRect(d.x - 12, d.y - 6, 24, 12); ctx.fillStyle = g.color === '#1d2024' ? '#c9d1d6' : g.color; ctx.fillRect(d.x - 10, d.y - 4, 20, 2); ctx.restore(); }
  }
  function drawShots(env) { const ctx = env.g; if (!ctx) return; for (const s of shots) { ctx.strokeStyle = s.team === 'you' ? '#ff9af0' : '#ffb07a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(s.x - s.vx * 0.025, s.y - s.vy * 0.025); ctx.lineTo(s.x, s.y); ctx.stroke(); } }
  function drawUnitsDirect() { for (const u of units) { try { root.NightshiftSprites.person(u, false, { role: 'gang' }); } catch { /* n/a */ } } }
  function overlays(env) {
    const ctx = env.g; if (!ctx) return; const p = env.player, now = performance.now();
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '700 8px ui-monospace,Menlo,monospace';
    for (const u of units) {
      const d = dist(u, p); if (d > 700) continue;
      if (u.mode === 'fight' || d < 160 || u.role === 'guard') { ctx.fillStyle = u.gang.color === '#1d2024' ? '#c9d1d6' : u.gang.color; ctx.beginPath(); ctx.moveTo(u.x - 4, u.y - 40); ctx.lineTo(u.x + 4, u.y - 40); ctx.lineTo(u.x, u.y - 35); ctx.closePath(); ctx.fill(); if (u.role === 'guard') for (let k = 0; k <= u.ref.tier; k++) ctx.fillRect(u.x - 6 + k * 4, u.y - 46, 3, 3); }
      if (u.boss) { const w = 46, f = Math.max(0, u.hp / u.maxHp); ctx.fillStyle = '#0c111ee0'; ctx.fillRect(u.x - w / 2 - 1, u.y - 66, w + 2, 15); ctx.fillStyle = '#ff5a6a'; ctx.fillRect(u.x - w / 2, u.y - 55, w * f, 3); ctx.fillStyle = '#ffe08a'; ctx.fillText('☠ ' + u.boss.name, u.x, u.y - 58); }
      if (u.bark && now < u.bark.until) { const w = ctx.measureText(u.bark.t).width + 8, y = u.y - 54; ctx.fillStyle = '#0c111ee0'; ctx.fillRect(u.x - w / 2, y - 9, w, 12); ctx.fillStyle = u.team === 'you' ? '#ffb0f0' : '#fff1c4'; ctx.fillText(u.bark.t, u.x, y); }
    }
    ctx.restore();
  }

  // ---------- panels ----------
  const css = document.createElement('style');
  css.textContent = `#ggPanel{position:fixed;inset:8% 8%;z-index:46;overflow:auto;background:#0f1830f5;border:1px solid #6f8db3;border-radius:14px;padding:12px 14px;color:#e8eff7;font:13px ui-monospace,Menlo,monospace}
  #ggPanel[hidden]{display:none} #ggPanel h2{margin:0 0 4px;font-size:16px} #ggPanel h3{margin:10px 0 6px;font-size:12px;color:#9fb3c8;letter-spacing:.08em} #ggPanel .sub{font-size:11.5px;color:#b9c8da;margin-bottom:8px} #ggPanel .rep{height:6px;background:#0a1222;border-radius:3px;overflow:hidden;margin:6px 0 10px}
  #ggPanel .rep i{display:block;height:100%} #ggPanel .row{display:flex;gap:8px;align-items:center;background:#16233d;border:1px solid #2f4669;border-radius:9px;padding:7px 9px;margin-bottom:6px}
  #ggPanel .row div{flex:1} #ggPanel .row small{display:block;color:#b9c8da;font-size:11px}
  #ggPanel button{all:unset;box-sizing:border-box;cursor:pointer;font:700 12px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:8px;padding:6px 10px}
  #ggPanel button[disabled]{opacity:.4;cursor:default} #ggPanel .x{float:right}`;
  document.head.appendChild(css);
  const panel = Object.assign(document.createElement('section'), { id: 'ggPanel', hidden: true }); document.body.appendChild(panel);
  const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); for (const k of kids) n.append(k); return n; };
  const row = (title, sub, label, fn, dis) => el('div', { className: 'row' }, el('div', {}, document.createTextNode(title), el('small', { textContent: sub })), el('button', { textContent: label, disabled: !!dis, onclick: fn }));
  function open(id) {
    const g = D.BY_ID[id], env = E(); if (!g || !env) return; const rep = state.rep[id] || 0, r = D.relation(rep), now = Date.now();
    panel.replaceChildren(el('button', { className: 'x', textContent: 'CLOSE', onclick: close }), el('h2', { textContent: `${g.name} · ${r}` }),
      el('div', { className: 'sub', textContent: `${g.district} · ${g.vibe}. Rivals: ${D.BY_ID[g.rival].name}.` }));
    const bar = el('div', { className: 'rep' }), fill = el('i'); fill.style.width = Math.round((rep + 100) / 2) + '%'; fill.style.background = r === 'HOSTILE' ? '#ff5a6a' : r === 'FRIENDLY' ? '#7cdeb5' : '#ffd970'; bar.append(fill); panel.append(bar);
    panel.append(row('💵 Pay respect', 'A little something for the block · +rep (once every 10 min)', '$100', () => { const t = D.tribute(state, id, env.player, now); say(t.ok ? `🤝 ${g.short} respect you a little more (${t.rep})` : t.reason); persist(); save(); open(id); }, now < (state.tributeAt[id] || 0) || env.player.cash < 100));
    const friendly = r === 'FRIENDLY';
    panel.append(row('📦 Ammo · 30 rounds', friendly ? 'Off the books' : 'Only for friends of the block', '$55', () => { const cs = (() => { try { return combatState; } catch { return null; } })(); if (!cs || env.player.cash < 55) return; env.player.cash -= 55; cs.reserve = Math.min(240, (cs.reserve || 0) + 30); say('📦 +30 rounds'); save(); open(id); }, !friendly || env.player.cash < 55)); // eslint-disable-line no-undef
    panel.append(row('🔩 Gun parts · spring + pipe', friendly ? 'Pulled off something stolen' : 'Only for friends of the block', '$40', () => { if (env.player.cash < 40) return; const r2 = root.NightshiftSupply?.give?.({ spring: 1, pipe: 1 }); if (r2 === false) { say('🎒 No room'); return; } env.player.cash -= 40; say('🔩 +1 spring, +1 pipe'); save(); open(id); }, !friendly || env.player.cash < 40));
    if (state.job) panel.append(row(`🎯 Job: ${state.job.done}/${state.job.need} ${D.BY_ID[state.job.target].name}`, `For ${D.BY_ID[state.job.from].name} · pays $${state.job.pay}`, 'GPS', () => { const tg = D.BY_ID[state.job.target], [bx, by] = tg.blocks[0]; try { root.NightshiftMap?.navigate?.({ x: bx * 440 + 214, y: by * 340 + 300, label: tg.name + ' turf' }); } catch { /* n/a */ } close(); }));
    else panel.append(row('🎯 Ask for work', friendly ? `Hit ${D.BY_ID[g.rival].name} on their turf · $350` : 'They don\'t trust you yet (need FRIENDLY)', 'TAKE', () => { state.job = D.jobFor(state, id); persist(); say(`🎯 Drop 3 ${D.BY_ID[g.rival].name} on their turf`); open(id); }, !friendly));
    panel.hidden = false;
  }
  function manage(key) {
    const o = state.owned[key], env = E(); if (!o || !env) { close(); return; } const [bx, by] = key.split(',').map(Number), p = env.player, b = blocks.get(key);
    const refresh = () => { persist(); save(); if (b) respawnBlock(b); manage(key); };
    panel.replaceChildren(el('button', { className: 'x', textContent: 'CLOSE', onclick: close }), el('h2', { textContent: `🏴 Your corner · ${district(bx * 440 + 200, by * 340 + 200)}` }),
      el('div', { className: 'sub', textContent: `Taken from ${D.BY_ID[o.from].name}. Earns $${D.income(o.guards.length)} every 5 min (more with guards). ${D.BY_ID[o.from].short} come back for it every 6-10 min · next in ~${Math.max(0, Math.ceil((o.nextRaid - Date.now()) / 60000))} min.` }));
    const cash = D.pending(state, bx, by);
    panel.append(row('💰 Collect', cash ? `Your cut is waiting` : 'Nothing yet · check back in a few minutes', cash ? '$' + cash : '—', () => { const n = D.collect(state, bx, by, p); if (n) say(`💰 +$${n} from your corner`); refresh(); }, !cash));
    panel.append(el('h3', { textContent: `GUARDS · ${o.guards.length}/${D.MAX_GUARDS} · firepower ${D.power(o).toFixed(1)}` }));
    o.guards.forEach((gd, i) => { const gear = D.GEAR[gd.tier], nx = D.GEAR[gd.tier + 1]; panel.append(row(`🧍 Guard ${i + 1} · ${gear.name}`, `${gear.hp} hp · ${gear.dmg} dmg${nx ? ` · next: ${nx.name}` : ' · best gear'}`, nx ? 'UPGRADE $' + nx.cost : 'MAX', () => { const r = D.upgrade(state, bx, by, i, p); say(r.ok ? `🔫 Guard ${i + 1} now carries a ${r.gear.name}` : r.reason); refresh(); }, !nx || p.cash < nx.cost)); });
    if (o.guards.length < D.MAX_GUARDS) panel.append(row('➕ Hire someone to watch it', 'They stand the corner, fight raiders and back you up in a fight', '$' + D.HIRE_COST, () => { const r = D.hire(state, bx, by, p); say(r.ok ? '🧍 New guard on the corner' : r.reason); refresh(); }, p.cash < D.HIRE_COST));
    panel.hidden = false;
  }
  function close() { panel.hidden = true; }
  function points() {
    const env = E(); if (!env) return []; const out = [], now = performance.now();
    for (const b of blocks.values()) {
      const hp0 = holdPoint(b);
      if (b.owner === P) { const cash = D.pending(state, b.bx, b.by); out.push({ id: 'gang-manage-' + b.key, type: 'gang', x: hp0.x, y: hp0.y + 4, ready: true, color: P.glow, label: '🏴 YOUR CORNER' + (cash ? ' · $' + cash : ''), action: 'MANAGE', hint: 'Your block · collect cash, hire guards, buy them gear' }); continue; }
      if (b.fightUntil > now || rel(b.owner) === 'HOSTILE' || !units.some((m) => m.block === b && m.role === 'local')) continue;
      out.push({ id: 'gang-talk-' + b.owner.id, type: 'gang', x: hp0.x + 40, y: hp0.y + 4, ready: true, color: b.owner.glow, label: '🗣️ ' + b.owner.name.toUpperCase(), action: 'TALK', hint: `${b.owner.name} · ${rel(b.owner).toLowerCase()} · respect, deals, work` });
    }
    for (const g of D.GANGS) { const d = hideoutDoor(g), p = env.player; if (!d || Math.abs(d.x - p.x) > 900 || Math.abs(d.y - p.y) > 700) continue; out.push({ id: 'gang-raid-' + g.id, type: 'hideout', x: d.x, y: d.y, ready: true, color: g.glow, label: `🚪 ${g.short} HIDEOUT`, action: 'RAID', hint: `${g.name} hideout · armed crew, a shot caller, the stash · clear it to shake their turf` }); }
    return out;
  }

  // ---------- loop + hooks ----------
  let last = 0;
  function tick(now) {
    const env = E(); const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    let zone = false; try { zone = !!(root.NightshiftZones?.active?.() || root.NightshiftHome?.kind?.()); } catch { /* n/a */ }
    if (env && env.player && !zone && !(root.NightshiftRPG?.paused?.())) {
      ensureBlocks(env.player); refreshNear(env.player);
      for (let n = 0; n < 2 && warm.length; n++) { const [m, d, a, k] = warm.shift(); try { const C = root.NightshiftCharacters; C?.frame?.(C.outfitFor(m, false), d, a, k); } catch { /* n/a */ } }
      for (let i = units.length - 1; i >= 0; i--) if (units[i]) unitTick(env, units[i], now, dt);
      shotsTick(env, dt); turfTick(env, now, dt); worldTick(env, now, dt);
      for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) { const a = units[i], c = units[j]; if (a.seated || c.seated) continue; const dx = c.x - a.x, dy = c.y - a.y; if (Math.abs(dx) > 13 || Math.abs(dy) > 13) continue; const d = Math.hypot(dx, dy); if (d > 0.01 && d < 13) { const k = (13 - d) * 0.25; if (canStep(a.x - dx / d * k, a.y - dy / d * k)) { a.x -= dx / d * k; a.y -= dy / d * k; } if (canStep(c.x + dx / d * k, c.y + dy / d * k)) { c.x += dx / d * k; c.y += dy / d * k; } } }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  const hook = setInterval(() => {
    const EN = root.NightshiftEncounters, C = root.NightshiftCrime, GL = root.NightshiftGangLife, F = root.NightshiftFeedback;
    if (EN && !EN.__gangs) {
      const locs = EN.locations, use = EN.use, draw = EN.draw;
      EN.locations = function () { const list = locs.apply(this, arguments) || []; try { return [...list, ...points()]; } catch { return list; } };
      EN.use = function (id) {
        if (typeof id === 'string' && id.startsWith('gang-')) { const [, kind, ...rest] = id.split('-'); const arg = rest.join('-'); if (kind === 'talk') open(arg); else if (kind === 'manage') manage(arg); else if (kind === 'raid') raid(arg); return true; }
        return use.apply(this, arguments);
      };
      EN.draw = function () { const r = draw.apply(this, arguments); try { const env = E(); if (env) drawTurf(env); } catch { /* cosmetic */ } return r; };
      EN.__gangs = true;
    }
    if (C && typeof C.draw === 'function' && !C.__gangs) { const d0 = C.draw; C.draw = function (actors = true) { const r = d0.apply(this, arguments); try { const env = E(); if (env) { if (actors && !root.NightshiftScene) drawUnitsDirect(); drawShots(env); overlays(env); } } catch { /* cosmetic */ } return r; }; C.__gangs = true; }
    if (GL && typeof GL.entries === 'function' && !GL.__gangs) { const e0 = GL.entries; GL.entries = function () { const list = e0.apply(this, arguments) || []; return list.concat(units.map((m) => ({ kind: 'gang', entity: m }))); }; GL.__gangs = true; }
    if (F && typeof F.shot === 'function' && !F.__gangs) { const s0 = F.shot; F.shot = function () { try { playerFired(); } catch { /* n/a */ } return s0.apply(this, arguments); }; F.__gangs = true; }
    if (EN?.__gangs && C?.__gangs && GL?.__gangs && F?.__gangs) clearInterval(hook);
  }, 300);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  root.NightshiftGangs = Object.freeze({ members: () => units.filter((u) => u.team !== 'you'), units: () => units, hit, open, manage, raid, close, paused: () => !panel.hidden, get state() { return state; }, turf: (x, y) => D.turfAt(x, y),
    guardOutfit, hideoutKill, hideoutDone, blocks: () => blocks, squad, clearSquad, push, alive: (tag) => units.filter((u) => u.tag === tag).length, strike: (u, dmg, opts) => hit(u, dmg, opts), skirmish: () => { nextSkirmish = 0; },
    engaged: () => { const now = performance.now(), p = E()?.player; return [...blocks.values()].some((b) => b.fightUntil > now || ((b.raid || b.attackers || b.hold > 0) && p && dist(holdPoint(b), p) < 700)); },
    stats: () => ({ ...st, units: units.length, blocks: blocks.size, shots: shots.length, owned: Object.keys(state.owned).length }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
