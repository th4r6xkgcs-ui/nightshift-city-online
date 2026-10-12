/* Game feel FX (Claude-owned, art pass). No gameplay or save changes.
 * - Camera shake: getting hit, car crashes, heavy gunfire (wraps NightshiftCamera.step without drift).
 * - Skid marks + tyre smoke when the player's car slides, brakes hard or launches.
 * - Rain splashes and puddle ripples while it rains.
 * Hooks: NightshiftCamera.step, NightshiftRecovery.damage, NightshiftVehicles.damage, NightshiftFeedback.shot,
 * NightshiftEncounters.draw (ground layer), NightshiftFeedback.draw (top layer).
 * API: NightshiftFx.{shake(amount), stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const CAM = () => { try { return camera; } catch { return null; } };
  /* eslint-enable no-undef */
  const reduced = root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  // ---- camera shake ----
  let trauma = 0, off = { x: 0, y: 0 }, lastT = performance.now();
  function shake(amount) { if (!reduced) trauma = Math.min(1, trauma + Math.max(0, Number(amount) || 0)); }
  const C = root.NightshiftCamera;
  if (C && typeof C.step === 'function' && !C.__fx) {
    const step = C.step;
    C.step = function (state, input, seconds) {
      const base = state && Number.isFinite(state.x) ? { ...state, x: state.x - off.x, y: state.y - off.y } : state;
      const out = step.call(this, base, input, seconds);
      const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      trauma = Math.max(0, trauma - dt * 1.6);
      const k = trauma * trauma * 9 / Math.max(0.5, out?.zoom || 1);
      off = { x: k ? (Math.sin(now * 0.091) + Math.sin(now * 0.037) * 0.6) * k : 0, y: k ? (Math.cos(now * 0.083) + Math.sin(now * 0.051) * 0.6) * k : 0 };
      return out && Number.isFinite(out.x) ? { ...out, x: out.x + off.x, y: out.y + off.y } : out;
    };
    C.__fx = true;
  }
  const REC = root.NightshiftRecovery;
  if (REC && typeof REC.damage === 'function' && !REC.__fx) {
    const dmg = REC.damage;
    REC.damage = function (amount) { const r = dmg.apply(this, arguments); if (Number(amount) > 0) shake(Math.min(0.6, 0.15 + amount / 60)); return r; };
    REC.__fx = true;
  }
  const VEH = root.NightshiftVehicles;
  if (VEH && typeof VEH.damage === 'function' && !VEH.__fx) {
    const vd = VEH.damage;
    VEH.damage = function (car, impact) { const r = vd.apply(this, arguments); const p = P(); if (p?.car === car && Number(impact) > 2.5) { shake(Math.min(0.8, impact / 9)); burst(car.x, car.y, 10, '#c9ccd1'); } return r; };
    VEH.__fx = true;
  }
  const FB = root.NightshiftFeedback;
  if (FB && typeof FB.shot === 'function' && !FB.__fxShot) {
    const shot = FB.shot;
    FB.shot = function () { const r = shot.apply(this, arguments); scareAt(P(), 260); const w = root.NightshiftWeapons?.state?.equipped; shake(w === 'shotgun' ? 0.32 : w === 'rifle' || w === 'revolver' ? 0.22 : w === 'ar' || w === 'smg' ? 0.08 : 0.1); return r; };
    FB.__fxShot = true;
  }

  // ---- skid marks + smoke ----
  const marks = []; // {ax,ay,bx,by,t}
  const smoke = []; // {x,y,vx,vy,r,life,max,c}
  let prev = null, lastSpeed = 0;
  function burst(x, y, n, c) { for (let i = 0; i < n; i++) smoke.push({ x, y, vx: (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.5) * 1.6, r: 4 + Math.random() * 5, life: 0, max: 50 + Math.random() * 30, c }); }
  function wheels(car) {
    const a = car.angle || 0, c = Math.cos(a), s = Math.sin(a), back = -17;
    return [-11, 11].map((side) => ({ x: car.x + c * back - s * side, y: car.y + s * back + c * side }));
  }
  setInterval(() => {
    const p = P(), car = p?.car;
    if (!car) { prev = null; lastSpeed = 0; return; }
    const sp = Math.abs(car.speed || 0), turn = prev ? Math.abs(((car.angle || 0) - prev.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI) : 0;
    const braking = sp > 3.2 && lastSpeed - sp > 0.35, drifting = sp > 3.5 && turn > 0.055, launching = sp < 3 && sp - lastSpeed > 0.45;
    const w = wheels(car);
    if (prev && (braking || drifting || launching)) {
      for (let i = 0; i < 2; i++) marks.push({ ax: prev.w[i].x, ay: prev.w[i].y, bx: w[i].x, by: w[i].y, t: performance.now() });
      if (marks.length > 500) marks.splice(0, marks.length - 500);
      if (Math.random() < 0.7) for (const q of w) smoke.push({ x: q.x, y: q.y, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, r: 3 + Math.random() * 3, life: 0, max: 40 + Math.random() * 25, c: '#d7dade' });
    }
    prev = { angle: car.angle || 0, w }; lastSpeed = sp;
  }, 50);

  // ---- rain splashes ----
  const env = () => root.NightshiftEnvironment;
  function raining() { const e = env(); return e?.weather ? e.weather(e.state?.minute ?? 720) : 0; }


  // ---- ambient life: pigeons, steam vents, drifting cloud shadows ----
  const birds = [], BLOCKED = (x, y) => { try { return blocked(x, y); } catch { return false; } }; // eslint-disable-line no-undef
  let nextFlock = 0;
  const night = () => { const e = env(); return e?.darkness ? e.darkness(e.state?.minute ?? 720) : 0; };
  function scareAt(p, r) { if (!p) return; for (const b of birds) if (!b.fly && Math.hypot(b.x - p.x, b.y - p.y) < r) launch(b, p); }
  function launch(b, from) { const a = Math.atan2(b.y - from.y, b.x - from.x) + (Math.random() - 0.5) * 0.8, sp = 2.2 + Math.random() * 1.4; b.fly = true; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp - 0.6; b.t = 0; }
  function spawnFlock() {
    const p = P(), cam = CAM(); if (!p || !cam) return;
    const W0 = (root.innerWidth || 800) / (cam.zoom || 1), H0 = (root.innerHeight || 600) / (cam.zoom || 1);
    for (let k = 0; k < 20; k++) {
      const x = cam.x + Math.random() * W0, y = cam.y + Math.random() * H0;
      if (Math.hypot(x - p.x, y - p.y) < 140 || BLOCKED(x, y)) continue;
      const n = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) birds.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 18, fly: false, ph: Math.random() * 6, face: Math.random() < 0.5 ? -1 : 1, c: ['#8a8f98', '#6f747c', '#a2a7ae', '#5c6168'][i % 4] });
      return;
    }
  }
  setInterval(() => {
    const p = P(), now = performance.now(); if (!p) return;
    // update
    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i];
      if (b.fly) { b.x += b.vx; b.y += b.vy; b.vy -= 0.02; b.t++; if (b.t > 120) birds.splice(i, 1); continue; }
      const d = Math.hypot(b.x - p.x, b.y - p.y), car = p.car && Math.abs(p.car.speed || 0) > 2.5;
      if (d < (car ? 110 : 55)) launch(b, p);
      else if (d > 900) birds.splice(i, 1);
      else if (Math.random() < 0.01) { b.x += (Math.random() - 0.5) * 4; b.face = Math.random() < 0.5 ? -1 : 1; }
    }
    if (now > nextFlock && night() < 0.5 && !root.NightshiftHome?.kind?.() && birds.filter((b) => !b.fly).length < 14) { spawnFlock(); nextFlock = now + 6000 + Math.random() * 8000; }
    // steam vents (night or rain)
    if ((night() > 0.3 || raining() > 0.2) && Math.random() < 0.5) {
      for (const v of VENTS) if (Math.hypot(v.x - p.x, v.y - p.y) < 600 && Math.random() < 0.25) smoke.push({ x: v.x + (Math.random() - 0.5) * 6, y: v.y, vx: 0.15 + Math.random() * 0.2, vy: -0.35 - Math.random() * 0.25, r: 3 + Math.random() * 3, life: 0, max: 70 + Math.random() * 40, c: '#dfe6ee' });
    }
  }, 33);
  const VENTS = []; for (const x of [440, 880, 1320, 1760]) for (const y of [340, 680, 1020, 1360]) if ((x * 7 + y * 3) % 5 < 2) VENTS.push({ x: x + ((x + y) % 2 ? 28 : -32), y: y + ((x * y) % 3 ? 36 : -30) });
  function drawBirds(ctx, t) {
    for (const b of birds) {
      ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y));
      if (b.fly) {
        const flap = Math.sin(t * 30 + b.ph) * 3, k = Math.max(0, 1 - b.t / 120); ctx.globalAlpha = k;
        ctx.strokeStyle = '#2b2f36'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-5, -flap); ctx.lineTo(0, 0); ctx.lineTo(5, -flap); ctx.stroke();
        ctx.fillStyle = '#05080f33'; ctx.fillRect(-2, 10 + b.t * 0.2, 4, 2);
      } else {
        const peck = Math.sin(t * 5 + b.ph) > 0.85 ? 1 : 0;
        ctx.scale(b.face, 1);
        ctx.fillStyle = '#05080f44'; ctx.fillRect(-3, 2, 7, 2);
        ctx.fillStyle = '#1b1e24'; ctx.fillRect(-4, -3, 8, 5);
        ctx.fillStyle = b.c; ctx.fillRect(-3, -2, 6, 3);
        ctx.fillStyle = '#5a7a6e'; ctx.fillRect(1, -3 + peck, 3, 2);
        ctx.fillStyle = '#e0a060'; ctx.fillRect(4, -2 + peck, 1, 1);
      }
      ctx.restore();
    }
  }
  const clouds = Array.from({ length: 4 }, (_, i) => ({ x: i * 700, y: (i * 523) % 1700, r: 160 + (i * 37) % 120 }));
  function drawClouds(ctx) {
    const n = night(), cam = CAM(); if (n > 0.6 || !cam || !ctx.createRadialGradient) return;
    const a = 0.09 * (1 - n), W0 = (root.innerWidth || 800) / (cam.zoom || 1), H0 = (root.innerHeight || 600) / (cam.zoom || 1);
    for (const c of clouds) {
      c.x += 0.18; c.y += 0.05;
      // wrap clouds around the camera so there is always weather overhead
      if (c.x - c.r > cam.x + W0 + 300) c.x = cam.x - c.r - 300; if (c.x + c.r < cam.x - 600) c.x = cam.x + W0 + c.r;
      if (c.y - c.r > cam.y + H0 + 300) c.y = cam.y - c.r - 200; if (c.y + c.r < cam.y - 600) c.y = cam.y + H0 + c.r;
      const g2 = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r); g2.addColorStop(0, `rgba(6,10,24,${a})`); g2.addColorStop(1, 'rgba(6,10,24,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r * 1.4, c.r, 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---- police cruisers: when officers respond, a cruiser with a flashing light bar pulls up nearby ----
  const cruisers = [], seenCops = new WeakSet();
  const ROADX = [440, 880, 1320, 1760], ROADY = [340, 680, 1020, 1360];
  function roadSpot(o) {
    const nx = ROADX.reduce((a, b) => (Math.abs(b - o.x) < Math.abs(a - o.x) ? b : a)), ny = ROADY.reduce((a, b) => (Math.abs(b - o.y) < Math.abs(a - o.y) ? b : a));
    return Math.abs(nx - o.x) < Math.abs(ny - o.y) ? { x: nx + 22, y: o.y, angle: Math.PI / 2 } : { x: o.x, y: ny + 22, angle: 0 };
  }
  setInterval(() => {
    const cops = root.NightshiftCrime?.officers || [], p = P(), now = performance.now();
    for (const o of cops) if (o && !seenCops.has(o)) {
      seenCops.add(o); if (!Number.isFinite(o.x)) continue;
      const r = roadSpot(o), vertical = r.angle !== 0;
      // park nose-to-tail along the road instead of stacking on the same spot
      for (let k = 0; k < 6 && cruisers.some((c) => Math.hypot(c.x - r.x, c.y - r.y) < 64); k++) { if (vertical) r.y += 70; else r.x += 70; }
      if (!cruisers.some((c) => Math.hypot(c.x - r.x, c.y - r.y) < 64)) cruisers.push({ ...r, t: now });
    }
    for (let i = cruisers.length - 1; i >= 0; i--) { const c = cruisers[i]; if ((p && (p.heat || 0) < 0.05 && now - c.t > 15000) || now - c.t > 120000) cruisers.splice(i, 1); }
    if (cruisers.length > 6) cruisers.splice(0, cruisers.length - 6);
  }, 500);
  function drawCruisers(ctx, t) {
    for (const c of cruisers) {
      try { root.NightshiftSprites?.car?.({ x: c.x, y: c.y, angle: c.angle, color: '#e9edf3', speed: 0, model: 'SEDAN', condition: 100 }); } catch { /* sprite optional */ }
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
      ctx.fillStyle = '#10151d'; ctx.fillRect(-20, -14, 10, 28); ctx.fillRect(12, -14, 8, 28); // black doors/hood band
      const on = Math.floor(t * 6) % 2;
      ctx.fillStyle = '#05080f'; ctx.fillRect(-3, -9, 6, 18);
      ctx.fillStyle = on ? '#ff3b4e' : '#5a1820'; ctx.fillRect(-2, -8, 4, 7);
      ctx.fillStyle = on ? '#2a3550' : '#3b7bff'; ctx.fillRect(-2, 1, 4, 7);
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gl = (col, a) => { const g2 = ctx.createRadialGradient?.(c.x, c.y, 0, c.x, c.y, 70); if (!g2) return; g2.addColorStop(0, col.replace('A', a)); g2.addColorStop(1, col.replace('A', 0)); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(c.x, c.y, 70, 0, Math.PI * 2); ctx.fill(); };
      gl(on ? 'rgba(255,50,70,A)' : 'rgba(60,110,255,A)', 0.28);
      ctx.restore();
    }
  }
  function drawGround() {
    const ctx = G(); if (!ctx) return;
    if (cruisers.length) try { drawCruisers(ctx, performance.now() / 1000); } catch { /* cosmetic */ }
    if (!marks.length) return;
    const now = performance.now();
    ctx.save(); ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i], age = (now - m.t) / 1000;
      if (age > 25) { marks.splice(0, i + 1); break; }
      ctx.strokeStyle = `rgba(8,10,14,${0.38 * (1 - age / 25)})`;
      ctx.beginPath(); ctx.moveTo(m.ax, m.ay); ctx.lineTo(m.bx, m.by); ctx.stroke();
    }
    ctx.restore();
  }
  let splashSeed = 0;
  function drawTop() {
    const ctx = G(), cam = CAM(); if (!ctx) return;
    ctx.save();
    try { drawBirds(ctx, performance.now() / 1000); drawClouds(ctx); } catch { /* cosmetic */ }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i]; s.life++; s.x += s.vx; s.y += s.vy; s.r += 0.25; s.vx *= 0.97; s.vy *= 0.97;
      if (s.life > s.max) { smoke.splice(i, 1); continue; }
      ctx.globalAlpha = 0.28 * (1 - s.life / s.max); ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    if (smoke.length > 300) smoke.splice(0, smoke.length - 300);
    const rain = raining();
    if (rain > 0.05 && cam && Number.isFinite(cam.x)) {
      // deterministic-looking splash field that re-rolls every 120ms
      const W0 = (root.innerWidth || 800) / (cam.zoom || 1), H0 = (root.innerHeight || 600) / (cam.zoom || 1), t = performance.now(), n = Math.floor(28 * rain);
      const frame = Math.floor(t / 120); if (frame !== splashSeed) splashSeed = frame;
      ctx.strokeStyle = '#b9d3dc'; ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const h = Math.sin((frame * 97 + i * 131) * 12.9898) * 43758.5453, r1 = h - Math.floor(h), h2 = Math.sin((frame * 53 + i * 71) * 78.233) * 12543.21, r2 = h2 - Math.floor(h2);
        const x = cam.x + r1 * W0, y = cam.y + r2 * H0, ph = (t % 120) / 120;
        ctx.globalAlpha = 0.45 * rain * (1 - ph);
        ctx.beginPath(); ctx.ellipse(x, y, 1.5 + ph * 4, 0.8 + ph * 2, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }
  const E = root.NightshiftEncounters;
  if (E && typeof E.draw === 'function' && !E.__fx) { const d = E.draw; E.draw = function () { try { drawGround(); } catch { /* cosmetic */ } return d.apply(this, arguments); }; E.__fx = true; }
  if (FB && typeof FB.draw === 'function' && !FB.__fxDraw) { const d = FB.draw; FB.draw = function () { const r = d.apply(this, arguments); try { drawTop(); } catch { /* cosmetic */ } return r; }; FB.__fxDraw = true; }

  // ---- adaptive sharpness: the game renders at up to 2x pixel density; if frames get slow, step down ----
  (function adapt() {
    let frames = 0, t0 = performance.now(), last = t0, slow = 0;
    const steps = [2, 1.5, 1];
    function tick(now) {
      if (!document.hidden && now - last < 250) { frames++; slow += now - last > 26 ? 1 : 0; }
      last = now;
      if (now - t0 > 4000) {
        const cur = Number(root.NightshiftRenderScale) || Math.min(2, root.devicePixelRatio || 1);
        if (frames > 60 && slow / frames > 0.35 && cur > 1) {
          root.NightshiftRenderScale = steps.find((x) => x < cur - 0.01) || 1;
          try { root.dispatchEvent(new Event('resize')); } catch { /* n/a */ }
        }
        frames = 0; slow = 0; t0 = now;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  // ---- world sign: one consistent look for every place label (Claude modules call root.NightshiftSign) ----
  const SIGN_FONT = "700 10px 'Chakra Petch',ui-sans-serif,system-ui,sans-serif";
  root.NightshiftSign = function (ctx, cx, cy, icon, text, color = '#ffcf5a', opts = {}) {
    if (!ctx) return;
    ctx.save(); ctx.font = SIGN_FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText ? ctx.measureText(text).width : text.length * 6, w = Math.round(tw + (icon ? 30 : 16)), h = 18, x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
    const rr = (px, py, pw, ph, r) => { ctx.beginPath(); ctx.moveTo(px + r, py); ctx.arcTo(px + pw, py, px + pw, py + ph, r); ctx.arcTo(px + pw, py + ph, px, py + ph, r); ctx.arcTo(px, py + ph, px, py, r); ctx.arcTo(px, py, px + pw, py, r); ctx.closePath(); };
    ctx.fillStyle = '#05080f66'; rr(x + 1, y + 3, w, h, 9); ctx.fill();
    ctx.shadowColor = color; ctx.shadowBlur = opts.glow ?? 6;
    ctx.fillStyle = '#0c111ef0'; rr(x, y, w, h, 9); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; rr(x + 0.5, y + 0.5, w - 1, h - 1, 8.5); ctx.stroke();
    if (icon) { ctx.fillStyle = color + '33'; ctx.beginPath(); ctx.arc(x + 10, cy, 7, 0, Math.PI * 2); ctx.fill(); ctx.font = '10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(icon, x + 10, cy + 0.5); ctx.font = SIGN_FONT; ctx.textAlign = 'left'; }
    ctx.fillStyle = opts.textColor || '#f2f6fc'; ctx.fillText(text, x + (icon ? 21 : 8), cy + 0.5);
    ctx.beginPath(); ctx.moveTo(cx - 4, y + h); ctx.lineTo(cx + 4, y + h); ctx.lineTo(cx, y + h + 5); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  };

  root.NightshiftFx = Object.freeze({ shake, stats: () => ({ marks: marks.length, smoke: smoke.length, trauma, birds: birds.length, cruisers: cruisers.map((c) => [Math.round(c.x), Math.round(c.y)]) }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
