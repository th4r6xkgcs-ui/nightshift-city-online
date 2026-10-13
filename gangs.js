/* Street gangs in the city (Claude-owned). Data/rules: gangs-data.js.
 *  - Turf: every gang block gets spray tags, curb paint and a crew hanging out on its corners in gang colours
 *    (chatting in circles, one sitting on the stoop). Crossing onto turf shows whose block it is and how they see you.
 *  - Behaviour: WARY crews stare you down and warn you; loiter in their face, shoot on their turf or hurt one of them
 *    and the whole block opens up. HOSTILE crews shoot on sight. FRIENDLY crews let you be.
 *  - Fights: members spread out, duck behind parked cars, peek and shoot. They're not aimbots: they miss more when
 *    you keep moving, at range, or when you're in cover. Their shots show as echoes when you can't see them.
 *  - TALK (when not hostile): pay respect ($100 → +rep), and once FRIENDLY: buy ammo/parts cheap and take work
 *    against their rival (drop 3 of the rival's soldiers on the rival's turf → $350 + rep).
 * Member bullets use the same cover rules as police (cars block, crouched behind a car = safe).
 * API: NightshiftGangs.{members, hit, engaged, state, open, turf, stats} */
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
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const members = [], shots = [], warm = []; // warm: character frames to pre-build while the crew is still off screen
  const blocks = new Map(); // key bx,by -> { gang, bx, by, alertUntil, fightUntil, loiter }
  const st = { spawned: 0, fights: 0, kills: 0, hits: 0 };

  // ---------- spawning: members exist only for blocks near you ----------
  function blockKey(bx, by) { return bx + ',' + by; }
  function ensureBlocks(p) {
    for (const g of D.GANGS) for (const [bx, by] of g.blocks) {
      const k = blockKey(bx, by), r = D.blockRect(bx, by), cx = r.x + r.w / 2, cy = r.y + r.h / 2, d = Math.hypot(cx - p.x, cy - p.y);
      if (d < 1500 && !blocks.has(k)) {
        const b = { gang: g, bx, by, alertUntil: 0, fightUntil: 0, loiter: 0, warned: 0 }; blocks.set(k, b);
        D.spots(bx, by).forEach((sp, i) => {
          const id = `gang-${g.id}-${bx}-${by}-${i}`; if ((state.dead[id] || 0) > Date.now()) return;
          const look = hash(g.id) % 1000 + (hash(id) % 5); // 5 looks per gang keeps the sprite cache small
          let base = null; try { base = root.NightshiftWardrobeData?.npcOutfit?.(look); } catch { /* n/a */ }
          members.push({ id, gang: g, block: b, home: { x: sp.x, y: sp.y }, face: sp.face, x: sp.x, y: sp.y, hp: 50, maxHp: 50, angle: Math.atan2(sp.face.y - sp.y, sp.face.x - sp.x), mode: 'hang',
            seated: !!sp.sit, seat: sp.sit ? { x: sp.x, y: sp.y } : null, outfit: D.outfit(base, g, look), nextShot: 0, path: null, walkTicks: 0, moving: false });
          st.spawned++; const mm = members[members.length - 1]; for (const d of [2, 1, 3, 0, 4]) for (let k = 0; k < 6; k += 2) warm.push([mm, d, 'idle', k]);
        });
      } else if (d > 2100 && blocks.has(k)) {
        blocks.delete(k); for (let i = members.length - 1; i >= 0; i--) if (members[i].block.bx === bx && members[i].block.by === by) members.splice(i, 1);
      }
    }
  }

  // ---------- reputation / provocation ----------
  const rel = (g) => D.relation(state.rep[g.id] || 0);
  function provoke(b, why) {
    const now = performance.now();
    if (b.fightUntil < now) { st.fights++; say(`🔥 ${b.gang.name} open fire · ${why}`); }
    b.fightUntil = now + 25000;
    // the gang's other nearby blocks come running
    for (const o of blocks.values()) if (o.gang === b.gang && o !== b) o.fightUntil = Math.max(o.fightUntil, now + 15000);
    for (const m of members) if (m.block.gang === b.gang && m.hp > 0) { m.seated = false; m.seat = null; }
  }
  function hit(m, dmg) {
    if (!m || m.hp <= 0 || !members.includes(m)) return false;
    const env = E(); m.hp -= Math.max(1, dmg || 20); st.hits++;
    provoke(m.block, 'you shot one of them');
    if (m.hp <= 0) {
      members.splice(members.indexOf(m), 1); state.dead[m.id] = Date.now() + 5 * 60000; st.kills++; state.kills++;
      D.change(state, m.gang.id, -15); D.change(state, m.gang.rival, 4);
      try { env?.loot?.push({ x: m.x, y: m.y, value: Math.floor(rnd(20, 90)) }); } catch { /* n/a */ }
      if (state.job && state.job.target === m.gang.id) {
        state.job.done++;
        if (state.job.done >= state.job.need) { const j = state.job, from = D.BY_ID[j.from]; if (env) env.player.cash += j.pay; D.change(state, j.from, 15); state.job = null; say(`💰 Job done for ${from.name} · +$${j.pay} · they've got your back`); save(); }
        else say(`🎯 ${state.job.done}/${state.job.need} ${m.gang.name} down`);
      }
      try { if (env) env.player.heat = Math.min(5, (env.player.heat || 0) + 0.4); } catch { /* n/a */ }
      persist();
    }
    return true;
  }

  // ---------- AI ----------
  function canStep(env, x, y) { return !solid(x, y); }
  function coverSpot(env, m, threat) {
    let best = null, bd = 1e9;
    for (const c of env.cars) {
      if (Math.abs(c.speed || 0) > 0.5) continue; const d = dist(c, m); if (d > 150) continue;
      const dd = Math.max(1, dist(c, threat)), sx = c.x + (c.x - threat.x) / dd * 30, sy = c.y + (c.y - threat.y) / dd * 30;
      if (!canStep(env, sx, sy)) continue; if (d < bd) { bd = d; best = { x: sx, y: sy, car: c }; }
    }
    return best;
  }
  function moveTo(env, m, goal, speed, dt) {
    const dx = goal.x - m.x, dy = goal.y - m.y, d = Math.hypot(dx, dy); if (d < 3) { m.moving = false; return true; }
    const s = Math.min(d, speed * dt), nx = m.x + dx / d * s, ny = m.y + dy / d * s;
    let moved = false; if (canStep(env, nx, m.y)) { m.x = nx; moved = true; } if (canStep(env, m.x, ny)) { m.y = ny; moved = true; }
    m.moving = moved; if (moved) { m.walkTicks += dt * 60; m.moveAngle = Math.atan2(dy, dx); }
    return false;
  }
  // cheap line of sight against the buildings around the fight (refreshed each frame)
  let near = [];
  function refreshNear(p) { let B = []; try { B = buildings; } catch { /* n/a */ } near = B.filter((b) => Math.abs(b.x + b.w / 2 - p.x) < 700 && Math.abs(b.y + b.h / 2 - p.y) < 600); } // eslint-disable-line no-undef
  const solid = (x, y) => { for (const b of near) if (x > b.x - 9 && x < b.x + b.w + 9 && y > b.y - 9 && y < b.y + b.h + 9) return true; return false; };
  function sightTo(env, a, b, range) { const d = dist(a, b); if (d > range) return false; const n = Math.max(1, Math.ceil(d / 10)); for (let i = 1; i < n; i++) if (solid(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false; return true; }
  function fire(env, m, now) {
    const p = env.player, d = dist(m, p), err = 0.2 * (1 + (p.moving ? 0.7 : 0) + d / 400) * (p.inCover ? 1.3 : 1);
    const a = Math.atan2(p.y - m.y, p.x - m.x) + (Math.random() * 2 - 1) * err;
    shots.push({ x: m.x, y: m.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, life: 1.0, dmg: 7 });
    m.nextShot = now + rnd(1400, 2300); m.inCover = false; m.angle = a;
    try { root.NightshiftCombatVision?.shot(m.x, m.y, 'gang'); } catch { /* n/a */ }
  }
  function memberTick(env, m, now, dt) {
    const p = env.player, b = m.block, fighting = b.fightUntil > now && p.hp > 0, d = dist(m, p);
    if (!fighting) {
      m.mode = 'hang'; m.inCover = false;
      if (!m.seated && dist(m, m.home) > 4) { moveTo(env, m, m.home, 50, dt); return; }
      m.moving = false;
      const alert = b.alertUntil > now && d < 260;
      m.angle = alert ? Math.atan2(p.y - m.y, p.x - m.x) : Math.atan2(m.face.y - m.y, m.face.x - m.x) + Math.sin(now / 1700 + m.home.x) * 0.25;
      return;
    }
    // fight: stay at a working distance, use a car for cover, peek and shoot
    m.seated = false; m.seat = null; m.mode = 'fight';
    const sees = sightTo(env, m, p, 300);
    if (now > (m.nextPlan || 0)) {
      m.nextPlan = now + rnd(1400, 2600);
      const cv = coverSpot(env, m, p);
      if (cv && Math.random() < 0.7) m.goal = cv;
      else { const a = Math.atan2(m.y - p.y, m.x - p.x) + rnd(-0.8, 0.8), want = rnd(150, 220); m.goal = { x: p.x + Math.cos(a) * want, y: p.y + Math.sin(a) * want }; if (!canStep(env, m.goal.x, m.goal.y)) m.goal = { x: m.x, y: m.y }; }
    }
    const there = m.goal ? moveTo(env, m, m.goal, 74, dt) : true;
    m.inCover = there && !!m.goal?.car && now < m.nextShot - 500;
    if (sees) m.angle = Math.atan2(p.y - m.y, p.x - m.x);
    if (sees && d < 300 && now >= m.nextShot && (there || Math.random() < 0.02)) fire(env, m, now);
  }
  function shotsTick(env, dt) {
    const p = env.player;
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i], end = { x: s.x + s.vx * dt, y: s.y + s.vy * dt }; s.life -= dt;
      let wall = null; try { wall = root.NightshiftVehicleGeometry?.traceCover?.(s, end, env.cars, env.blocked, p.car) || null; } catch { /* n/a */ }
      let hitT = null; try { hitT = root.NightshiftNavigation?.segmentCircle?.(s, end, p, p.car ? 25 : p.inCover ? 7 : 12) ?? null; } catch { /* n/a */ }
      if (hitT !== null && (!wall || hitT < wall.t)) {
        const ducked = p.inCover && !p.car && env.cars.some((c) => dist(c, p) < 48 && root.NightshiftNavigation.segmentCircle(s, p, c, 30) !== null);
        shots.splice(i, 1);
        if (ducked) { try { root.NightshiftFeedback?.burst?.(p.x + (s.x - p.x) * 0.2, p.y + (s.y - p.y) * 0.2, 'wall'); } catch { /* n/a */ } continue; }
        try { root.NightshiftRecovery?.damage?.(p.car ? Math.ceil(s.dmg * 0.4) : s.dmg, performance.now()); } catch { /* n/a */ }
        continue;
      }
      if (wall || s.life <= 0) { if (wall) { try { root.NightshiftFeedback?.burst?.(wall.x, wall.y, 'wall'); } catch { /* n/a */ } } shots.splice(i, 1); continue; }
      s.x = end.x; s.y = end.y;
    }
  }
  // turf awareness: banners, warnings, loitering
  let lastTurf = null;
  function turfTick(env, now, dt) {
    const p = env.player, t = D.turfAt(p.x, p.y), key = t ? blockKey(t.bx, t.by) : null;
    if (t && key !== lastTurf && (!lastTurf || !lastTurf.startsWith('#' + t.gang.id))) {
      const r = rel(t.gang); say(`${r === 'HOSTILE' ? '☠️' : r === 'FRIENDLY' ? '🤝' : '⚠️'} ${t.gang.name} turf · ${r === 'HOSTILE' ? 'they want you dead' : r === 'FRIENDLY' ? 'you\'re good here' : 'keep it moving'}`);
    }
    lastTurf = t ? key : null;
    if (!t) return;
    const b = blocks.get(key); if (!b) return;
    const r = rel(t.gang);
    if (r === 'HOSTILE' && !p.car && members.some((m) => m.block === b && sightTo(env, m, p, 260))) { if (b.fightUntil < now) provoke(b, 'you\'re on their block'); return; }
    if (r === 'FRIENDLY') return;
    const close = members.some((m) => m.block === b && m.hp > 0 && dist(m, p) < 70);
    b.loiter = close && !p.car ? b.loiter + dt : Math.max(0, b.loiter - dt * 0.5);
    if (close) b.alertUntil = now + 4000;
    if (b.loiter > 3 && now - b.warned > 8000 && b.fightUntil < now) { b.warned = now; say(`🗣️ "${t.gang.short} block. You lost or something? Walk."`); }
    if (b.loiter > 9 && b.fightUntil < now) provoke(b, 'you didn\'t walk');
  }
  // the player firing on turf counts as disrespect
  function playerFired() {
    const env = E(); if (!env) return; const t = D.turfAt(env.player.x, env.player.y); if (!t) return;
    const b = blocks.get(blockKey(t.bx, t.by)); if (b && rel(t.gang) !== 'FRIENDLY') provoke(b, 'shots on their block');
  }

  // ---------- draw ----------
  function tag(ctx, x, y, text, col, glow, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.font = '900 15px "Chakra Petch",Impact,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = glow; ctx.shadowBlur = 4; ctx.lineWidth = 3; ctx.strokeStyle = '#0b0d14cc'; ctx.strokeText(text, 0, 0); ctx.fillStyle = col === '#1d2024' ? '#c9d1d6' : col; ctx.fillText(text, 0, 0); ctx.shadowBlur = 0;
    ctx.fillStyle = col === '#1d2024' ? '#c9d1d6aa' : col + 'aa'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 6, 7, 1.4, 3 + ((i * 7 + 11) % 5));
    ctx.restore();
  }
  function drawTurf(env) {
    const ctx = env.g, cam = env.camera; if (!ctx || !cam) return;
    for (const b of blocks.values()) {
      const r = D.blockRect(b.bx, b.by), g = b.gang;
      if (r.x > cam.x + 1400 || r.x + r.w < cam.x - 200 || r.y > cam.y + 900 || r.y + r.h < cam.y - 200) continue;
      ctx.save(); ctx.globalAlpha = 0.85;
      // painted curb along the front sidewalk, tags on the facade corners and the sidewalk
      ctx.fillStyle = g.color === '#1d2024' ? '#3a3f48' : g.color; ctx.globalAlpha = 0.5; for (let x = r.x + 70; x < r.x + 370; x += 26) ctx.fillRect(x, r.y + 292, 14, 3);
      ctx.globalAlpha = 0.9;
      tag(ctx, r.x + 96, r.y + 228, g.short, g.color, g.glow, -0.12); tag(ctx, r.x + 300, r.y + 232, g.short, g.color, g.glow, 0.1); tag(ctx, r.x + 214, r.y + 300, g.short, g.color, g.glow, 0.04);
      // shoes on the wire / a gang flag on the lamp post
      ctx.globalAlpha = 1; ctx.fillStyle = '#0b0d14'; ctx.fillRect(r.x + 60, r.y + 246, 2, 30); ctx.fillStyle = g.color === '#1d2024' ? '#c9d1d6' : g.color; ctx.fillRect(r.x + 62, r.y + 248, 10, 6); ctx.fillStyle = '#ffffff44'; ctx.fillRect(r.x + 62, r.y + 248, 10, 1);
      ctx.restore();
    }
  }
  function drawShots(env) {
    const ctx = env.g; if (!ctx) return;
    for (const s of shots) { ctx.strokeStyle = '#ffb07a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(s.x - s.vx * 0.025, s.y - s.vy * 0.025); ctx.lineTo(s.x, s.y); ctx.stroke(); }
  }
  function drawMembersDirect() { for (const m of members) { try { root.NightshiftSprites.person(m, false, { role: 'gang' }); } catch { /* n/a */ } } }
  function badges(env) {
    const ctx = env.g; if (!ctx) return; const p = env.player;
    for (const m of members) if (m.block.fightUntil > performance.now() || dist(m, p) < 160) { ctx.fillStyle = m.gang.color === '#1d2024' ? '#c9d1d6' : m.gang.color; ctx.beginPath(); ctx.moveTo(m.x - 4, m.y - 40); ctx.lineTo(m.x + 4, m.y - 40); ctx.lineTo(m.x, m.y - 35); ctx.closePath(); ctx.fill(); }
  }

  // ---------- TALK panel ----------
  const css = document.createElement('style');
  css.textContent = `#ggPanel{position:fixed;inset:10% 10%;z-index:46;overflow:auto;background:#0f1830f5;border:1px solid #6f8db3;border-radius:14px;padding:12px 14px;color:#e8eff7;font:13px ui-monospace,Menlo,monospace}
  #ggPanel[hidden]{display:none} #ggPanel h2{margin:0 0 4px;font-size:16px} #ggPanel .sub{font-size:11.5px;color:#b9c8da;margin-bottom:8px} #ggPanel .rep{height:6px;background:#0a1222;border-radius:3px;overflow:hidden;margin:6px 0 10px}
  #ggPanel .rep i{display:block;height:100%} #ggPanel .row{display:flex;gap:8px;align-items:center;background:#16233d;border:1px solid #2f4669;border-radius:9px;padding:7px 9px;margin-bottom:6px}
  #ggPanel .row div{flex:1} #ggPanel .row small{display:block;color:#b9c8da;font-size:11px}
  #ggPanel button{all:unset;box-sizing:border-box;cursor:pointer;font:700 12px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:8px;padding:6px 10px}
  #ggPanel button[disabled]{opacity:.4;cursor:default} #ggPanel .x{float:right}`;
  document.head.appendChild(css);
  const panel = Object.assign(document.createElement('section'), { id: 'ggPanel', hidden: true }); document.body.appendChild(panel);
  const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); for (const k of kids) n.append(k); return n; };
  function open(id) {
    const g = D.BY_ID[id], env = E(); if (!g || !env) return; const rep = state.rep[id] || 0, r = D.relation(rep), now = Date.now();
    const row = (title, sub, label, fn, dis) => el('div', { className: 'row' }, el('div', {}, document.createTextNode(title), el('small', { textContent: sub })), el('button', { textContent: label, disabled: !!dis, onclick: fn }));
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
  function close() { panel.hidden = true; }
  // a TALK point on each loaded block (front of the first group)
  function talkPoints() {
    const env = E(); if (!env) return []; const out = [], now = performance.now();
    for (const b of blocks.values()) { if (b.fightUntil > now || rel(b.gang) === 'HOSTILE') continue; const r = D.blockRect(b.bx, b.by); if (!members.some((m) => m.block === b)) continue; out.push({ id: 'gang-' + b.gang.id + '-' + b.bx + '-' + b.by, type: 'gang', x: r.x + 118, y: r.y + 300, ready: true, color: b.gang.glow, label: '🗣️ ' + b.gang.name.toUpperCase(), action: 'TALK', hint: `${b.gang.name} · ${rel(b.gang).toLowerCase()} · respect, deals, work` }); }
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
      for (let i = members.length - 1; i >= 0; i--) memberTick(env, members[i], now, dt);
      shotsTick(env, dt); turfTick(env, now, dt);
      // members keep out of each other
      for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) { const a = members[i], c = members[j]; if (a.seated || c.seated) continue; const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy); if (d > 0.01 && d < 13) { const k = (13 - d) * 0.25; if (canStep(env, a.x - dx / d * k, a.y - dy / d * k)) { a.x -= dx / d * k; a.y -= dy / d * k; } if (canStep(env, c.x + dx / d * k, c.y + dy / d * k)) { c.x += dx / d * k; c.y += dy / d * k; } } }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  const hook = setInterval(() => {
    const EN = root.NightshiftEncounters, C = root.NightshiftCrime, GL = root.NightshiftGangLife, F = root.NightshiftFeedback;
    if (EN && !EN.__gangs) {
      const locs = EN.locations, use = EN.use, draw = EN.draw;
      EN.locations = function () { const list = locs.apply(this, arguments) || []; try { return [...list, ...talkPoints()]; } catch { return list; } };
      EN.use = function (id) { if (typeof id === 'string' && id.startsWith('gang-')) { open(id.split('-')[1]); return true; } return use.apply(this, arguments); };
      EN.draw = function () { const r = draw.apply(this, arguments); try { const env = E(); if (env) drawTurf(env); } catch { /* cosmetic */ } return r; };
      EN.__gangs = true;
    }
    if (C && typeof C.draw === 'function' && !C.__gangs) { const d0 = C.draw; C.draw = function (actors = true) { const r = d0.apply(this, arguments); try { const env = E(); if (env) { if (actors && !root.NightshiftScene) drawMembersDirect(); drawShots(env); badges(env); } } catch { /* cosmetic */ } return r; }; C.__gangs = true; }
    if (GL && typeof GL.entries === 'function' && !GL.__gangs) { const e0 = GL.entries; GL.entries = function () { const list = e0.apply(this, arguments) || []; return list.concat(members.map((m) => ({ kind: 'gang', entity: m }))); }; GL.__gangs = true; }
    if (F && typeof F.shot === 'function' && !F.__gangs) { const s0 = F.shot; F.shot = function () { try { playerFired(); } catch { /* n/a */ } return s0.apply(this, arguments); }; F.__gangs = true; }
    if (EN?.__gangs && C?.__gangs && GL?.__gangs && F?.__gangs) clearInterval(hook);
  }, 300);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  root.NightshiftGangs = Object.freeze({ members: () => members, hit, open, close, paused: () => !panel.hidden, get state() { return state; }, turf: (x, y) => D.turfAt(x, y),
    engaged: () => { const now = performance.now(); return [...blocks.values()].some((b) => b.fightUntil > now); }, stats: () => ({ ...st, members: members.length, blocks: blocks.size, shots: shots.length }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
