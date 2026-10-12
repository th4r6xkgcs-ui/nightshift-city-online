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
    FB.shot = function () { const r = shot.apply(this, arguments); const w = root.NightshiftWeapons?.state?.equipped; shake(w === 'shotgun' ? 0.32 : w === 'rifle' || w === 'revolver' ? 0.22 : w === 'ar' || w === 'smg' ? 0.08 : 0.1); return r; };
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

  function drawGround() {
    const ctx = G(); if (!ctx || !marks.length) return;
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

  root.NightshiftFx = Object.freeze({ shake, stats: () => ({ marks: marks.length, smoke: smoke.length, trauma }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
