/* Combat vision + cover (Claude-owned). Bullet Echo-style fights in the open city.
 *  - Engagement: the moment you fire, get shot at, get spotted by police or start a gang fight, the screen closes in
 *    to what you can actually see: a cone where you aim plus a small ring around you, cut off by buildings
 *    (lighter outdoors by day, heavier at night). It eases back out a few seconds after things calm down.
 *  - Echoes: shots from enemies you can't see leave a red ring where they came from, so you can react without
 *    knowing exactly who it is.
 *  - Cover: stand still next to a parked car (or a wall) without shooting and you crouch into cover. Shots coming
 *    across the car hit the car; you're also a smaller target. Moving or firing pops you out.
 * Hooks: NightshiftEnvironment.overlay (screen-space draw), NightshiftFeedback.shot (player fired).
 * API: NightshiftCombatVision.{shot(x,y,kind), engaged(), visible(x,y), cover(), stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const E = () => { try { return { player, cars, blocked, camera, g }; } catch { return null; } };
  /* eslint-enable no-undef */
  const st = { engagedUntil: 0, k: 0, lastShot: 0, hurtAt: 0, lastHp: null, echoes: [], vis: null, still: 0, frames: 0 };
  const CONE = 1.0, LEN = 430, AROUND = 72, RAYS = 48;
  const inZone = () => { try { return !!(root.NightshiftZones?.active?.() || root.NightshiftHome?.kind?.()); } catch { return false; } };

  function engage(ms = 6000) { st.engagedUntil = Math.max(st.engagedUntil, performance.now() + ms); }
  function shot(x, y, kind) {
    engage(6000);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (st.k > 0.2 && !visible(x, y)) st.echoes.push({ x, y, t: performance.now(), kind: kind || 'enemy' });
    if (st.echoes.length > 24) st.echoes.shift();
  }

  // ---- vision polygon (world space) ----
  // Only buildings near you matter for sight lines: test against those rects (the game's blocked() scans all 196).
  let rects = [];
  function nearRects(p, R) { let B = []; try { B = buildings; } catch { /* n/a */ } rects = B.filter((b) => b.x - 9 < p.x + R && b.x + b.w + 9 > p.x - R && b.y - 9 < p.y + R && b.y + b.h + 9 > p.y - R); return rects; } // eslint-disable-line no-undef
  const solid = (x, y) => { for (const b of rects) if (x > b.x - 9 && x < b.x + b.w + 9 && y > b.y - 9 && y < b.y + b.h + 9) return true; return false; };
  function ray(env, x, y, a, len) {
    const dx = Math.cos(a), dy = Math.sin(a);
    for (let d = 10; d < len; d += 11) if (solid(x + dx * d, y + dy * d)) return d + 5;
    return len;
  }
  function computeVis(env) {
    const p = env.player, a0 = Number.isFinite(p.angle) ? p.angle : 0, pts = []; nearRects(p, LEN + 20);
    for (let i = 0; i <= RAYS; i++) { const a = a0 - CONE + (2 * CONE * i) / RAYS; pts.push({ a, r: ray(env, p.x, p.y, a, LEN) }); }
    const ring = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ring.push({ a, r: ray(env, p.x, p.y, a, AROUND) }); }
    st.vis = { x: p.x, y: p.y, a0, pts, ring };
  }
  function visible(x, y) {
    const v = st.vis; if (!v) return true;
    const dx = x - v.x, dy = y - v.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const ri = v.ring[Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 24) % 24]; if (d <= ri.r) return true;
    let da = a - v.a0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > CONE) return false;
    const pt = v.pts[Math.round(((da + CONE) / (2 * CONE)) * RAYS)]; return !!pt && d <= pt.r;
  }

  // ---- cover ----
  function coverTick(env, now, dt) {
    const p = env.player;
    if (p.car || p.hp <= 0 || inZone()) { p.inCover = false; st.still = 0; return; }
    const firing = now - st.lastShot < 500;
    st.still = p.moving || firing ? 0 : st.still + dt;
    let near = false;
    if (st.still > 0.25) {
      near = (env.cars || []).some((c) => Math.abs(c.speed || 0) < 0.5 && Math.hypot(c.x - p.x, c.y - p.y) < 40);
      if (!near) { nearRects(p, 60); for (let k = 0; k < 8 && !near; k++) { const a = k * Math.PI / 4; near = solid(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20); } }
    }
    const was = p.inCover; p.inCover = near && st.still > 0.25;
    if (p.inCover && !was && st.k > 0.3) { try { root.say?.('🛡️ In cover · shots across the car won\'t reach you'); } catch { /* n/a */ } }
  }

  // ---- draw: fog + echoes (screen space, after the environment overlay) ----
  let off = null;
  function draw() {
    const env = E(); if (!env || inZone() || st.k <= 0.01) return;
    const ctx = env.g, cv = ctx.canvas, cam = env.camera; if (!cam) return;
    const hw = Math.ceil(cv.width / 2), hh = Math.ceil(cv.height / 2); if (!off || off.width !== hw || off.height !== hh) { off = document.createElement('canvas'); off.width = hw; off.height = hh; }
    const o = off.getContext('2d'), base = ctx.getTransform();
    let night = 0; try { night = root.NightshiftEnvironment?.darkness?.(root.NightshiftEnvironment.state?.minute ?? 720) || 0; } catch { /* n/a */ }
    const alpha = Math.min(0.82, (0.5 + night * 0.25) * st.k);
    o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, off.width, off.height);
    o.fillStyle = `rgba(4,6,12,${alpha})`; o.fillRect(0, 0, off.width, off.height);
    o.setTransform(base.a / 2, base.b / 2, base.c / 2, base.d / 2, base.e / 2, base.f / 2); o.globalCompositeOperation = 'destination-out';
    const v = st.vis, S = (wx, wy) => [(wx - cam.x) * cam.zoom, (wy - cam.y) * cam.zoom];
    o.fillStyle = '#000'; o.beginPath();
    let [sx, sy] = S(v.x, v.y); o.moveTo(sx, sy);
    for (const pt of v.pts) { [sx, sy] = S(v.x + Math.cos(pt.a) * pt.r, v.y + Math.sin(pt.a) * pt.r); o.lineTo(sx, sy); }
    o.closePath(); o.fill(); o.beginPath();
    v.ring.forEach((pt, i) => { [sx, sy] = S(v.x + Math.cos(pt.a) * pt.r, v.y + Math.sin(pt.a) * pt.r); if (i) o.lineTo(sx, sy); else o.moveTo(sx, sy); });
    o.closePath(); o.fill();
    // soften the cone edge a little
    o.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, cv.width, cv.height); ctx.restore();
    // echoes
    const now = performance.now(); ctx.save();
    for (let i = st.echoes.length - 1; i >= 0; i--) {
      const e = st.echoes[i], t = (now - e.t) / 1100; if (t > 1) { st.echoes.splice(i, 1); continue; }
      const [ex, ey] = S(e.x, e.y); ctx.strokeStyle = e.kind === 'police' ? `rgba(120,170,255,${1 - t})` : `rgba(255,90,106,${1 - t})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex, ey, 6 + t * 30 * cam.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // cover badge over the player
    if (env.player.inCover) { const [px, py] = S(env.player.x, env.player.y); ctx.font = '700 9px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#0c111ecc'; ctx.fillRect(px - 22, py - 46 * cam.zoom / 2 - 18, 44, 13); ctx.fillStyle = '#7cdeb5'; ctx.fillText('🛡 COVER', px, py - 46 * cam.zoom / 2 - 8); }
    ctx.restore();
  }

  // ---- loop ----
  let last = 0;
  function tick(now) {
    const env = E(); const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    if (env && env.player) {
      const p = env.player;
      if (st.lastHp !== null && p.hp < st.lastHp - 0.5) { st.hurtAt = now; engage(5000); }
      st.lastHp = p.hp;
      const w = root.NightshiftCrime?.wanted; if (w?.seen) engage(4000);
      try { if (root.NightshiftGangs?.engaged?.()) engage(3000); } catch { /* n/a */ }
      const on = now < st.engagedUntil && !p.car && p.hp > 0;
      st.k = Math.max(0, Math.min(1, st.k + (on ? dt / 0.5 : -dt / 1.2)));
      if (st.k > 0) computeVis(env);
      coverTick(env, now, dt);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  const hook = setInterval(() => {
    const EN = root.NightshiftEnvironment, F = root.NightshiftFeedback;
    if (EN && typeof EN.overlay === 'function' && !EN.__cv) { const o0 = EN.overlay; EN.overlay = function () { const r = o0.apply(this, arguments); try { draw(); } catch (e) { /* cosmetic */ } return r; }; EN.__cv = true; }
    if (F && typeof F.shot === 'function' && !F.__cv) { const s0 = F.shot; F.shot = function () { st.lastShot = performance.now(); engage(6000); try { const env = E(), offs = root.NightshiftCrime?.officers || []; if (env && offs.some((o) => Math.hypot(o.x - env.player.x, o.y - env.player.y) < 420 && root.NightshiftCrime.sight?.(o, env.player, env.blocked, 420))) root.NightshiftCrime.armed?.(15000); } catch { /* n/a */ } return s0.apply(this, arguments); }; F.__cv = true; }
    if (EN?.__cv && F?.__cv) clearInterval(hook);
  }, 300);
  root.NightshiftCombatVision = Object.freeze({ shot, engage, engaged: () => st.k > 0.3, visible, cover: () => !!E()?.player?.inCover, stats: () => ({ k: st.k, echoes: st.echoes.length, cover: !!E()?.player?.inCover }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
