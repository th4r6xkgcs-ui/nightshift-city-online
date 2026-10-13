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
  const busy = (p) => p.hp <= 0 || p.crew || p.follow || p.following || p.hostile || p.mode === 'flee' || p.job || p.target || p.customer || p.rival;
  function init(env) {
    const colors = ['#efb57b', '#9ac4a0', '#d5a1d0', '#a6bde6'];
    while (env.peds.length < CROWD) { const s = sidewalk(env, env.player, 200, 1100); if (!s) break; env.peds.push({ x: s.x, y: s.y, dx: rnd(-1, 1), dy: rnd(-1, 1), hp: 40, t: rnd(0, 100), color: colors[env.peds.length % 4], id: 'crowd-' + env.peds.length }); st.added++; }
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
      p.x = s.x; p.y = s.y; p.routine = null; p.path = []; p.nextRoute = 0; p.socialUntil = 0; p.moving = false; p.walkTicks = 0; st.recycled++;
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
  let lastRecycle = 0;
  function tick(now) {
    const env = G(); if (env && env.player && Array.isArray(env.peds)) {
      if (!ready && now > 1500) init(env);
      if (ready) { separate(env); if (now - lastRecycle > 900) { lastRecycle = now; recycle(env); recycleCars(env); } }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  root.NightshiftCrowd = Object.freeze({ stats: () => ({ ...st, people: G()?.peds?.length || 0, cars: G()?.cars?.length || 0 }), CROWD });
})(typeof globalThis !== 'undefined' ? globalThis : this);
