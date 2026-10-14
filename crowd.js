/* City crowd manager (Claude-owned) for the bigger city (v0.57: 15x15 blocks).
 *  - More people: the street population grows to CROWD and is kept AROUND YOU: anyone who drifts far away is quietly
 *    re-homed on a sidewalk just out of sight ahead of you, with a fresh daily plan for that neighbourhood.
 *  - No stacking: people keep a personal space bubble (soft separation that never pushes anyone into a wall).
 *  - Parked cars in every neighbourhood, so there's always something to drive (cars matter now that distances are real).
 * Works on the game's own arrays (peds, cars) without replacing the AI (citizen-routines/citizen-ai still drive people).
 * API: NightshiftCrowd.{stats, CROWD} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const G = () => { try { return { player, peds, cars, world, blocked, camera }; } catch { return null; } };
  /* eslint-enable no-undef */
  const CROWD = 46, FAR = 1500, SPACE = 15;
  const st = { added: 0, recycled: 0, parked: 0, pushes: 0 };
  let ready = false;
  const PARKED = 22;
  function kerb(env, near, minD, maxD) {
    for (let k = 0; k < 40; k++) { const a = Math.random() * Math.PI * 2, d = rnd(minD, maxD), bx = Math.floor((near.x + Math.cos(a) * d) / 440), by = Math.floor((near.y + Math.sin(a) * d) / 340), x = bx * 440 + 58, y = by * 340 + rnd(140, 220);
      if (x < 60 || y < 60 || x > env.world.w - 60 || y > env.world.h - 60) continue; try { if (env.blocked(x, y) || env.blocked(x, y - 30) || env.blocked(x, y + 30)) continue; } catch { /* n/a */ }
      if (env.cars.some((c) => Math.abs(c.x - x) < 30 && Math.abs(c.y - y) < 70)) continue; return { x, y }; }
    return null;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  // a free sidewalk spot (people idle along y = block*340 + 270, x = block*440 + 100..340)
  function sidewalk(env, near, minD, maxD) {
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2, d = rnd(minD, maxD), tx = near.x + Math.cos(a) * d, ty = near.y + Math.sin(a) * d;
      const bx = Math.floor(tx / 440), by = Math.floor(ty / 340), x = bx * 440 + rnd(100, 340), y = by * 340 + (Math.random() < 0.5 ? 270 : 62);
      if (x < 40 || y < 40 || x > env.world.w - 40 || y > env.world.h - 40) continue;
      try { if (env.blocked(x, y)) continue; } catch { /* no collision */ }
      if (env.peds.some((p) => Math.abs(p.x - x) < 20 && Math.abs(p.y - y) < 20)) continue;
      return { x, y };
    }
    return null;
  }
  // v0.58: people dress for their neighbourhood (suits downtown, polos in the Heights, work gear in Ironworks...)
  const THEMES = {
    // v0.63: present-day looks — tech/office casual downtown (no trench coats or fedoras), sneakers, earbuds via modern-city.js
    DOWNTOWN: { top: [['buttonup', 0], ['buttonup', 5], ['polo', 1], ['tee', 1]], outer: [['puffer', 0], ['track', 1], ['bomber', 1], null], bottom: [['chinos', 1], ['chinos', 0], ['joggers', 0]], shoes: [['runners', 0], ['runners', 1], ['dress', 0]], face: [['aviators', 0], null, null], bag: [['backpack', 0], null] },
    'THE HEIGHTS': { top: [['polo', 7], ['polo', 1], ['buttonup', 5]], outer: [['puffer', 4], null, null], bottom: [['chinos', 0], ['chinos', 3]], shoes: [['runners', 0], ['dress', 1]], face: [['aviators', 0], null, null] },
    'OLD TOWN': { top: [['tee', 7], ['tee', 8], ['longsleeve', 2]], outer: [['hoodie', 2], ['bomber', 2], ['track', 0], null], bottom: [['jeans', 0], ['jeans', 3]], shoes: [['hitops', 0], ['runners', 2]], head: [['cap', 0], ['bucket', 0], null] },
    IRONWORKS: { top: [['longsleeve', 8], ['tee', 5]], outer: [['vest', 1], ['vest', 0], null], bottom: [['cargo', 1], ['cargo', 0]], shoes: [['boots', 0], ['boots', 2]], head: [['beanie', 5], ['beanie', 2], null], gloves: [['gloves', 0], null] },
    FAIRVIEW: { top: [['tee', 1], ['tee', 3], ['tee', 7]], outer: [['hoodie', 9], ['hoodie', 3], null], bottom: [['joggers', 9], ['jeans', 2]], shoes: [['runners', 0], ['runners', 1]], bag: [['backpack', 1], null] },
    'THE FLATS': { top: [['tank', 1], ['jersey', 4], ['tee', 6]], outer: [null, null, ['leather', 0]], bottom: [['shorts', 4], ['skirt', 0], ['joggers', 8]], shoes: [['slides', 0], ['hitops', 2]], head: [['durag', 0], ['durag', 1], null], jewelry: [['chain', 0], null] },
    HARBOR: { top: [['longsleeve', 7], ['tee', 8]], outer: [['puffer', 0], ['bomber', 0], ['puffer', 3]], bottom: [['cargo', 3], ['jeans', 3]], shoes: [['boots', 1], ['boots', 2]], head: [['beanie', 1], ['beanie', 8], null] },
  };
  function dress(p) {
    let reg = null; try { reg = root.NightshiftWorld?.regionAt?.(p.x, p.y); } catch { /* n/a */ }
    const th = reg && THEMES[reg.name]; if (!th) { if (p.outfit && p.themed) { delete p.outfit; p.themed = false; } return; }
    // 8 looks per neighbourhood (seeded), so the character sprite cache stays bounded
    const seed = (reg.name.length * 7919 + Math.floor(Math.random() * 8) * 104729) >>> 0; let base = null; try { base = root.NightshiftWardrobeData?.npcOutfit?.(seed); } catch { /* n/a */ } if (!base) return;
    let x = seed || 1; const r = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    const o = JSON.parse(JSON.stringify(base)), pick = (a) => a[Math.floor(r() * a.length)];
    for (const slot of ['top', 'outer', 'bottom', 'shoes', 'head', 'face', 'gloves', 'bag', 'jewelry']) if (th[slot]) { const v = pick(th[slot]); o[slot] = v ? { id: v[0], color: v[1] } : null; }
    p.outfit = o; p.themed = true;
  }
  const busy = (p) => p.hp <= 0 || p.crew || p.follow || p.following || p.hostile || p.mode === 'flee' || p.job || p.target || p.customer || p.rival;
  function init(env) {
    const colors = ['#efb57b', '#9ac4a0', '#d5a1d0', '#a6bde6'];
    while (env.peds.length < CROWD) { const s = sidewalk(env, env.player, 200, 1100); if (!s) break; env.peds.push({ x: s.x, y: s.y, dx: rnd(-1, 1), dy: rnd(-1, 1), hp: 40, t: rnd(0, 100), color: colors[env.peds.length % 4], id: 'crowd-' + env.peds.length }); dress(env.peds[env.peds.length - 1]); st.added++; }
    let n = 0; // extra parked cars, kept around you like the crowd (recycled kerbside when far away)
    for (let k = 0; k < PARKED; k++) { const sp = kerb(env, env.player, 250, 1200); if (!sp) continue; const c = { x: sp.x, y: sp.y, angle: Math.PI / 2, color: ['#c84659', '#3d99d6', '#e2b75c', '#b1c4d5', '#6d73be', '#2f8f6a', '#1d2433'][k % 7], speed: 0, owner: false, parkedByCrowd: true }; env.cars.push(c); n++; }
    st.parked = n; ready = true;
  }
  // re-home people who are far away to sidewalks just outside the view, ahead of where you're heading
  function recycleCars(env) {
    const pl = env.player.car || env.player;
    for (const c of env.cars) { if (!c.parkedByCrowd || c === env.player.car || c.owner || c.stolen || Math.abs(c.speed || 0) > 0.1) continue; if (Math.abs(c.x - pl.x) < 1700 && Math.abs(c.y - pl.y) < 1300) continue; const sp = kerb(env, pl, 800, 1300); if (sp) { c.x = sp.x; c.y = sp.y; c.angle = Math.PI / 2; c.condition = 100; } }
  }
  function recycle(env) {
    const pl = env.player.car || env.player, vx = pl.car ? Math.cos(pl.angle || 0) : 0, vy = pl.car ? Math.sin(pl.angle || 0) : 0;
    for (const p of env.peds) {
      if (busy(p)) continue;
      if (Math.abs(p.x - pl.x) < FAR && Math.abs(p.y - pl.y) < FAR * 0.8) continue;
      const ahead = { x: pl.x + vx * 500, y: pl.y + vy * 500 }, s = sidewalk(env, ahead, 650, 1050); if (!s) continue;
      p.x = s.x; p.y = s.y; p.routine = null; p.path = []; p.nextRoute = 0; p.socialUntil = 0; p.moving = false; p.walkTicks = 0; dress(p); st.recycled++;
    }
  }
  // personal space: push overlapping people apart (on screen only), never into walls or buildings
  function separate(env) {
    const pl = env.player, list = env.peds.filter((p) => p.hp > 0 && Math.abs(p.x - pl.x) < 900 && Math.abs(p.y - pl.y) < 700);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy; if (d2 >= SPACE * SPACE) continue;
      const d = Math.sqrt(d2) || 0.01, push = (SPACE - d) * 0.25, ux = d > 0.02 ? dx / d : Math.cos(i + j), uy = d > 0.02 ? dy / d : Math.sin(i + j);
      const moveTo = (p, x, y) => { try { if (env.blocked(x, y)) return; } catch { /* n/a */ } p.x = x; p.y = y; };
      moveTo(a, a.x - ux * push, a.y - uy * push); moveTo(b, b.x + ux * push, b.y + uy * push); st.pushes++;
    }
    // and nobody stands inside the player
    for (const p of list) { const dx = p.x - pl.x, dy = p.y - pl.y, d = Math.hypot(dx, dy); if (d < 13 && d > 0.01 && !pl.car) { try { if (!env.blocked(p.x + dx / d * 2, p.y + dy / d * 2)) { p.x += dx / d * 2; p.y += dy / d * 2; } } catch { /* n/a */ } } }
  }
  // ---- errands: idle people walk into a nearby shop/door, spend a while inside, then come back out ----
  // (taken out of the AI while scripted, so nothing fights over their position)
  const errands = []; // { p, door, phase: 'walk'|'inside', until }
  const idleSince = new WeakMap();
  function doors(env) { let B = []; try { B = buildings; } catch { /* n/a */ } return B.map((b) => ({ x: b.x + b.w / 2 + (((b.x * 7) % 40) - 20), y: b.y + b.h + 8, name: b.name })); } // eslint-disable-line no-undef
  function errandTick(env, now, dt) {
    const pl = env.player;
    // start errands for people who've idled a while near a door
    if (errands.length < 8) for (const p of env.peds) {
      if (busy(p) || p.moving) { idleSince.delete(p); continue; }
      if (!idleSince.has(p)) { idleSince.set(p, now + 4000 + Math.random() * 9000); continue; }
      if (now < idleSince.get(p) || Math.abs(p.x - pl.x) > 1000 || Math.abs(p.y - pl.y) > 800) continue;
      const d = doors(env).filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < 260).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      idleSince.delete(p); if (!d) continue;
      const i = env.peds.indexOf(p); if (i < 0) continue; env.peds.splice(i, 1);
      errands.push({ p, door: d, phase: 'walk', until: 0, path: (() => { try { return NightshiftNavigation.route(p, d, env.blocked); } catch { return [d]; } })() }); // eslint-disable-line no-undef
      st.errands = (st.errands || 0) + 1; if (errands.length >= 8) break;
    }
    for (let k = errands.length - 1; k >= 0; k--) {
      const e = errands[k], p = e.p;
      if (e.phase === 'walk') {
        while (e.path.length && Math.hypot(e.path[0].x - p.x, e.path[0].y - p.y) < 4) e.path.shift();
        const goal = e.path[0] || e.door, d = Math.hypot(goal.x - p.x, goal.y - p.y);
        if (!e.path.length && d < 5) { e.phase = 'inside'; e.until = now + 8000 + Math.random() * 22000; p.moving = false; continue; }
        const sp = Math.min(d, 1.05 * dt), bx = p.x; p.x += (goal.x - p.x) / (d || 1) * sp; p.y += (goal.y - p.y) / (d || 1) * sp; p.moving = true; p.walkTicks = (p.walkTicks || 0) + dt; p.moveAngle = Math.atan2(goal.y - p.y, goal.x - p.x); p.angle = p.moveAngle; void bx;
      } else if (now > e.until) { // back out onto the street with a fresh plan
        p.x = e.door.x; p.y = e.door.y + 6; p.routine = null; p.path = []; p.nextRoute = 0; p.moving = false; p.socialUntil = 0; env.peds.push(p); errands.splice(k, 1);
      }
    }
  }
  function drawErrands() { let ctx; try { ctx = g; } catch { return; } for (const e of errands) if (e.phase === 'walk') { try { NightshiftSprites.person(e.p, false, { hideHealth: true }); } catch { /* n/a */ } } void ctx; } // eslint-disable-line no-undef
  let lastRecycle = 0, lastT = 0;
  function tick(now) {
    const env = G(); if (env && env.player && Array.isArray(env.peds)) {
      if (!ready && now > 1500) init(env);
      if (ready) { const dt = lastT ? Math.min(2, (now - lastT) / 16.67) : 1; separate(env); errandTick(env, now, dt); if (now - lastRecycle > 900) { lastRecycle = now; recycle(env); recycleCars(env); } }
      lastT = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  const hook = setInterval(() => { const E = root.NightshiftEncounters; if (!E || E.__crowd) return; const d0 = E.draw; E.draw = function () { const r = d0.apply(this, arguments); drawErrands(); return r; }; E.__crowd = true; clearInterval(hook); }, 300);
  root.NightshiftCrowd = Object.freeze({ errands: () => errands.length, stats: () => ({ ...st, inside: errands.filter((e) => e.phase === 'inside').length, people: G()?.peds?.length || 0, cars: G()?.cars?.length || 0 }), CROWD });
})(typeof globalThis !== 'undefined' ? globalThis : this);
