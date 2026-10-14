/* Combat FX (Claude-owned, v0.69 "HD characters & weapons" pass). Visual only — no gameplay, save or network state.
 *  - Bodies: anyone who goes down (people, gang members, cops, story NPCs) falls over instead of vanishing, with a
 *    blood pool that spreads under them; bodies fade after ~25 s (max 14 on screen).
 *  - Hit reactions: a hurt character flashes white, gets knocked back a couple of pixels and sprays blood droplets
 *    that land as small stains.
 *  - Guns: every muzzle burst gets a light flash on the ground (warm glow + star) and ejects a brass casing that
 *    bounces and lies on the road for a while.
 * Hooks: NightshiftEncounters.draw (ground layer), NightshiftFeedback.burst/draw, NightshiftSprites.person/personTo.
 * API: NightshiftCombatFx.{stats, bodies} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const G = () => { try { return g; } catch { return null; } };
  const ENV = () => { try { return { peds, player }; } catch { return null; } };
  const isBlocked = (x, y) => { try { return typeof blocked === 'function' && blocked(x, y); } catch { return false; } };
  /* eslint-enable no-undef */
  const reduced = root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const st = { bodies: 0, hits: 0, flashes: 0, casings: 0 };
  const bodies = [], stains = [], drops = [], casings = [], flashes = [];
  const seen = new Map(); // entity -> { hp, kind }

  function lists() {
    const out = []; const E = ENV(); if (!E) return out;
    for (const p of E.peds || []) out.push([p, 'ped']);
    try { for (const u of root.NightshiftGangs?.units?.() || []) out.push([u, 'gang']); } catch { /* n/a */ }
    try { for (const o of root.NightshiftCrime?.officers || []) out.push([o, 'cop']); } catch { /* n/a */ }
    try { for (const a of root.NightshiftNpcLife?.actors?.() || []) out.push([a, 'npc']); } catch { /* n/a */ }
    return out;
  }
  function addBody(e, kind, now) {
    if (!Number.isFinite(e.x)) return; const P = ENV()?.player || e;
    const away = Math.atan2(e.y - P.y, e.x - P.x), side = Math.cos(away) >= 0 ? 1 : -1;
    bodies.push({ q: { ...e, moving: false, hp: 1, maxHp: 1, angle: Math.PI / 2, moveAngle: Math.PI / 2, squat: false, downed: null, seat: null }, x: e.x, y: e.y, side, t0: now, kind, pool: 0 });
    if (bodies.length > 14) bodies.shift(); st.bodies++;
  }
  function bleed(e, dirx, diry, n = 6) {
    if (reduced) return;
    for (let i = 0; i < n; i++) { const a = Math.atan2(diry, dirx) + (Math.random() - 0.5) * 1.1, s = 50 + Math.random() * 90; drops.push({ x: e.x, y: e.y - 14, z: 14, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 20 + Math.random() * 30, life: 1 }); }
    if (drops.length > 120) drops.splice(0, drops.length - 120);
  }

  let lastT = 0;
  function tick(now) {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0; lastT = now; const P = ENV()?.player; if (!P) return;
    const live = lists(), present = new Set();
    for (const [e, kind] of live) {
      present.add(e); const s = seen.get(e), hp = Number.isFinite(e.hp) ? e.hp : 1;
      if (s && hp < s.hp - 0.5 && hp > 0) { // hurt
        e.__hitAt = now; const d = Math.hypot(e.x - P.x, e.y - P.y) || 1, ux = (e.x - P.x) / d, uy = (e.y - P.y) / d; st.hits++;
        if (!e.car) { const nx = e.x + ux * 3, ny = e.y + uy * 3; if (!isBlocked(nx, ny)) { e.x = nx; e.y = ny; } }
        bleed(e, ux, uy, 5);
      }
      if (s && s.hp > 0 && (hp <= 0 || e.dead || e.gone) && !s.body) { s.body = true; addBody(e, kind, now); const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; bleed(e, (e.x - P.x) / d, (e.y - P.y) / d, 9); }
      if (!s) seen.set(e, { hp, kind }); else s.hp = hp;
    }
    for (const [e, s] of seen) if (!present.has(e)) { if (!s.body && ((e.hp ?? 1) <= 0 || e.dead || e.gone)) addBody(e, s.kind, now); seen.delete(e); }
    // physics
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.vz -= 220 * dt; d.z += d.vz * dt; d.vx *= 0.96; d.vy *= 0.96; if (d.z <= 0) { stains.push({ x: d.x, y: d.y + 14, r: 1 + Math.random() * 1.6, t0: now }); drops.splice(i, 1); } }
    if (stains.length > 220) stains.splice(0, stains.length - 220);
    for (let i = casings.length - 1; i >= 0; i--) { const c = casings[i]; if (c.rest) { if (now - c.t0 > 9000) casings.splice(i, 1); continue; } c.x += c.vx * dt; c.y += c.vy * dt; c.vz -= 260 * dt; c.z += c.vz * dt; c.rot += c.spin * dt; if (c.z <= 0) { c.z = 0; if (Math.abs(c.vz) > 40) { c.vz = -c.vz * 0.35; c.vx *= 0.5; c.vy *= 0.5; } else { c.rest = true; c.t0 = now; } } }
    for (let i = bodies.length - 1; i >= 0; i--) { const b = bodies[i]; b.pool = Math.min(1, (now - b.t0) / 6000); if (now - b.t0 > 26000) bodies.splice(i, 1); }
    for (let i = stains.length - 1; i >= 0; i--) if (now - stains[i].t0 > 30000) stains.splice(i, 1);
    for (let i = flashes.length - 1; i >= 0; i--) if (now - flashes[i].t0 > 90) flashes.splice(i, 1);
  }

  // ---------- drawing ----------
  function drawGround() {
    const c = G(); if (!c) return; const now = performance.now(); c.save();
    for (const s of stains) { const a = Math.max(0, 1 - (now - s.t0) / 30000); c.globalAlpha = 0.7 * a; c.fillStyle = '#4a0a0e'; c.beginPath(); c.ellipse(s.x, s.y, s.r * 1.4, s.r, 0, 0, 6.3); c.fill(); }
    for (const b of bodies) {
      const age = now - b.t0, fade = age > 23000 ? Math.max(0, 1 - (age - 23000) / 3000) : 1, fall = Math.min(1, age / 320), ease = 1 - (1 - fall) * (1 - fall);
      // pool
      if (b.pool > 0) { const R = 4 + b.pool * 15; c.globalAlpha = 0.85 * fade; const gr = c.createRadialGradient(b.x + b.side * 8, b.y - 2, 1, b.x + b.side * 8, b.y - 2, R); gr.addColorStop(0, '#5c0b12'); gr.addColorStop(0.75, '#3e070c'); gr.addColorStop(1, '#3e070c00'); c.fillStyle = gr; c.beginPath(); c.ellipse(b.x + b.side * 8, b.y - 2, R * 1.25, R * 0.62, 0, 0, 6.3); c.fill();
        c.globalAlpha = 0.35 * fade; c.fillStyle = '#ff6b6b'; c.beginPath(); c.ellipse(b.x + b.side * 8 - R * 0.35, b.y - 2 - R * 0.2, R * 0.3, R * 0.1, -0.3, 0, 6.3); c.fill(); }
      // body: the character sprite, rotated onto the ground around the feet
      c.save(); c.globalAlpha = fade; c.translate(b.x, b.y); c.rotate(ease * b.side * Math.PI / 2 * 0.96); c.translate(-b.x, -b.y + ease * 2);
      try { root.NightshiftSprites?.personTo?.(c, b.q, false, { hideHealth: true, noWeapon: true, weapon: false }); } catch { /* n/a */ }
      c.restore();
    }
    for (const k of casings) { c.globalAlpha = k.rest ? Math.max(0, 1 - (now - k.t0) / 9000) : 1; c.save(); c.translate(k.x, k.y - k.z); c.rotate(k.rot); c.fillStyle = '#c99a3c'; c.fillRect(-1.6, -0.7, 3.2, 1.4); c.fillStyle = '#fff0b0'; c.fillRect(-1.6, -0.7, 3.2, 0.5); c.restore(); }
    c.restore();
  }
  function drawTop() {
    const c = G(); if (!c) return; const now = performance.now(); c.save();
    for (const d of drops) { c.fillStyle = '#8e1520'; c.globalAlpha = 0.9; c.fillRect(d.x - 1, d.y - d.z - 1, 2, 2); }
    c.globalCompositeOperation = 'lighter';
    for (const f of flashes) {
      const k = 1 - (now - f.t0) / 90; if (k <= 0) continue; c.globalAlpha = k;
      const gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, 46); gr.addColorStop(0, '#ffd27a88'); gr.addColorStop(0.4, '#ff9a3c33'); gr.addColorStop(1, '#ff9a3c00'); c.fillStyle = gr; c.fillRect(f.x - 46, f.y - 46, 92, 92);
      c.save(); c.translate(f.x, f.y); c.rotate(f.a); c.fillStyle = '#fff6c8'; c.beginPath(); c.moveTo(0, -2.2); c.lineTo(11 + Math.random() * 5, 0); c.lineTo(0, 2.2); c.closePath(); c.fill(); c.beginPath(); c.moveTo(2, 0); c.lineTo(5, -5.5); c.lineTo(5.5, 0); c.lineTo(5, 5.5); c.closePath(); c.globalAlpha = k * 0.7; c.fill(); c.restore();
    }
    c.restore();
  }

  // ---------- hooks ----------
  function hook() {
    let ok = true;
    const EN = root.NightshiftEncounters; if (EN && typeof EN.draw === 'function' && !EN.__cfx) { const d0 = EN.draw; EN.draw = function () { try { drawGround(); } catch (e) { console.error(e); } return d0.apply(this, arguments); }; EN.__cfx = true; } else if (!EN?.__cfx) ok = false;
    const F = root.NightshiftFeedback; if (F && !F.__cfx) {
      const b0 = F.burst, d0 = F.draw;
      F.burst = function (x, y, kind, angle) { if (kind === 'muzzle' && Number.isFinite(x)) { flashes.push({ x, y, a: angle || 0, t0: performance.now() }); if (flashes.length > 6) flashes.shift(); st.flashes++; if (!reduced) { const a = (angle || 0) + Math.PI / 2 * (Math.cos(angle || 0) >= 0 ? -1 : 1); casings.push({ x, y, z: 8, vx: Math.cos(a) * (40 + Math.random() * 30) - Math.cos(angle || 0) * 20, vy: Math.sin(a) * (40 + Math.random() * 30), vz: 40 + Math.random() * 30, rot: Math.random() * 6, spin: 18, rest: false, t0: 0 }); if (casings.length > 40) casings.shift(); st.casings++; } } return b0.apply(this, arguments); };
      F.draw = function () { const r = d0.apply(this, arguments); try { drawTop(); } catch (e) { console.error(e); } return r; };
      F.__cfx = true;
    } else if (!F) ok = false;
    const S = root.NightshiftSprites; if (S && !S.__cfx && typeof S.personTo === 'function') {
      const flashOn = (ctx, p) => { if (!p || !(p.__hitAt > performance.now() - 90) || !('filter' in ctx)) return false; ctx.save(); ctx.filter = 'brightness(2.6) saturate(0.3)'; return true; };
      const p0 = S.person, t0 = S.personTo;
      S.person = function (p) { let ctx = null; try { ctx = g; } catch { /* n/a */ } /* eslint-disable-line no-undef */ const on = ctx && flashOn(ctx, p); try { return p0.apply(this, arguments); } finally { if (on) ctx.restore(); } };
      S.personTo = function (ctx, p) { const on = flashOn(ctx, p); try { return t0.apply(this, arguments); } finally { if (on) ctx.restore(); } };
      S.__cfx = true;
    } else if (!S) ok = false;
    return ok;
  }
  // install late, after the other person/feedback wrappers
  let tries = 0; const iv = setInterval(() => { if (hook() || ++tries > 150) clearInterval(iv); }, 100);
  function loop(now) { try { tick(now); } catch (e) { console.error(e); } requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  root.NightshiftCombatFx = Object.freeze({ stats: () => ({ ...st, onScreen: bodies.length, casings: casings.length }), bodies: () => bodies.length });
})(typeof window !== 'undefined' ? window : globalThis);
