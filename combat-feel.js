/* Combat feel (Claude-owned, v0.71). Presentation only: no damage, save or network changes.
 *  - Gun sounds: synthesized per weapon class (pistol crack, SMG rattle, rifle crack + boom, shotgun blast, crude pop),
 *    suppressed guns go "thup", a short street echo; enemy fire is heard too, quieter and duller with distance.
 *  - Recoil: the camera kicks back along your aim on every shot (by class), easing back in a fraction of a second.
 *  - Hit markers on the crosshair (white tick), KILL markers (red X + chime) when a target goes down.
 *  - Low health: a pulsing red vignette and a heartbeat under 35 HP.
 * Respects the game's SOUND toggle and reduced motion. Hooks: NightshiftFeedback.shot/hit/crosshair,
 * NightshiftCombatVision.shot (enemy fire), NightshiftCamera.step, NightshiftEnvironment.overlay.
 * Pure tuning in NightshiftCombatFeel.TUNE (Node-testable). API: NightshiftCombatFeel.{TUNE, stats} */
(function (root) {
  'use strict';
  const TUNE = Object.freeze({
    pistol: { kick: 3, band: 1900, q: 0.9, dur: 0.18, thump: 0.5, vol: 0.55 },
    smg: { kick: 2, band: 2300, q: 1.1, dur: 0.11, thump: 0.35, vol: 0.45 },
    rifle: { kick: 3.6, band: 1500, q: 0.8, dur: 0.3, thump: 0.75, vol: 0.62 },
    shotgun: { kick: 7, band: 900, q: 0.6, dur: 0.45, thump: 1, vol: 0.7 },
    crude: { kick: 4, band: 1200, q: 0.7, dur: 0.22, thump: 0.6, vol: 0.5 },
  });
  const tuneOf = (cls) => TUNE[cls] || TUNE.pistol;
  /** enemy shot loudness + muffling by distance (0 = inaudible) */
  const distant = (d) => ({ gain: Math.max(0, Math.min(0.5, 0.5 * (1 - d / 1100))), cutoff: Math.max(500, 4200 - d * 3.4) });
  if (!root.document) { if (typeof module !== 'undefined') module.exports = { TUNE, tuneOf, distant }; return; }

  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const reduced = root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const soundOn = () => document.querySelector('#sound')?.getAttribute('aria-pressed') === 'true';
  const st = { shots: 0, enemyShots: 0, hits: 0, kills: 0 };

  // ---------------- audio ----------------
  let ac = null, noise = null, bus = null, echo = null;
  function audio() {
    if (!soundOn()) return null;
    if (!ac) {
      try { ac = new (root.AudioContext || root.webkitAudioContext)(); } catch { return null; }
      const n = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noise = n;
      bus = ac.createGain(); bus.gain.value = 0.8; const comp = ac.createDynamicsCompressor(); bus.connect(comp); comp.connect(ac.destination);
      // short street slap-back
      echo = ac.createDelay(0.5); echo.delayTime.value = 0.085; const fb = ac.createGain(); fb.gain.value = 0.22; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(bus);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function bang(cls, { gain = 1, cutoff = 9000, suppressed = false } = {}) {
    const a = audio(); if (!a || gain <= 0) return; const T = tuneOf(cls), t = a.currentTime;
    const src = a.createBufferSource(); src.buffer = noise; const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = suppressed ? 700 : T.band; bp.Q.value = T.q;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(cutoff, suppressed ? 1100 : 9000);
    const g = a.createGain(), vol = T.vol * gain * (suppressed ? 0.3 : 1), dur = suppressed ? 0.09 : T.dur;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(bus); if (!suppressed) { const s = a.createGain(); s.gain.value = 0.5 * gain; g.connect(s); s.connect(echo); }
    src.start(t, Math.random() * 0.2, dur + 0.05);
    if (!suppressed && T.thump) { const o = a.createOscillator(), og = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.14); og.gain.setValueAtTime(0.7 * T.thump * gain, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.18); }
  }
  function tone(f0, f1, dur, vol) { const a = audio(); if (!a) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02); }
  function beat() { const a = audio(); if (!a) return; const t = a.currentTime; for (const [dt, v] of [[0, 0.5], [0.16, 0.35]]) { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, t + dt); o.frequency.exponentialRampToValueAtTime(40, t + dt + 0.12); g.gain.setValueAtTime(v, t + dt); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.14); o.connect(g); g.connect(bus); o.start(t + dt); o.stop(t + dt + 0.16); } }

  // ---------------- player weapon ----------------
  function gun() { try { const W = root.NightshiftWeapons, w = W?.current?.(); const id = W?.state?.equipped; return { cls: w?.cls || 'pistol', suppressed: !!(W?.state?.mods?.[id] || []).includes('suppressor') }; } catch { return { cls: 'pistol', suppressed: false }; } }

  // ---------------- recoil (camera kick along -aim) ----------------
  let kick = { x: 0, y: 0 }, lastT = performance.now();
  function addKick(amount) { const p = P(); if (!p || reduced) return; const a = Number.isFinite(p.angle) ? p.angle : 0; kick.x -= Math.cos(a) * amount; kick.y -= Math.sin(a) * amount; const m = Math.hypot(kick.x, kick.y); if (m > 14) { kick.x *= 14 / m; kick.y *= 14 / m; } }
  function hookCamera() {
    const C = root.NightshiftCamera; if (!C?.step || C.__feel) return !!C?.__feel;
    const step = C.step;
    C.step = function (state, input, seconds) {
      const base = state && Number.isFinite(state.x) ? { ...state, x: state.x - (C.__kx || 0), y: state.y - (C.__ky || 0) } : state;
      const out = step.call(this, base, input, seconds), now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      const k = Math.exp(-dt * 11); kick.x *= k; kick.y *= k; C.__kx = kick.x; C.__ky = kick.y;
      return out && Number.isFinite(out.x) ? { ...out, x: out.x + kick.x, y: out.y + kick.y } : out;
    };
    C.__feel = true; return true;
  }

  // ---------------- hit / kill markers ----------------
  const marks = []; let cross = null, lastHit = 0, bodies0 = -1;
  function hookFeedback() {
    const F = root.NightshiftFeedback; if (!F || F.__feel) return !!F?.__feel;
    const shot = F.shot, hit = F.hit, ch = F.crosshair;
    F.shot = function () { const r = shot.apply(this, arguments); try { const p = P(); if (p && !p.car) { const gg = gun(); st.shots++; bang(gg.cls, { suppressed: gg.suppressed }); addKick(tuneOf(gg.cls).kick); } } catch { /* cosmetic */ } return r; };
    F.hit = function () { const r = hit.apply(this, arguments); try { lastHit = performance.now(); st.hits++; marks.push({ t: lastHit, kill: false }); tone(1900, 1500, 0.04, 0.12); } catch { /* cosmetic */ } return r; };
    F.crosshair = function (x, y) { cross = { x, y }; const r = ch.apply(this, arguments); try { drawMarks(F); } catch { /* cosmetic */ } return r; };
    F.__feel = true; return true;
  }
  function drawMarks() {
    const ctx = (() => { try { return g; } catch { return null; } })(); if (!ctx || !cross) return; // eslint-disable-line no-undef
    const now = performance.now();
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i], k = (now - m.t) / (m.kill ? 650 : 280); if (k >= 1) { marks.splice(i, 1); continue; }
      const r0 = m.kill ? 10 + k * 6 : 9 + k * 3, r1 = r0 + (m.kill ? 9 : 6); ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.strokeStyle = m.kill ? '#ff4a4a' : '#ffffff'; ctx.lineWidth = m.kill ? 3 : 2; ctx.shadowColor = m.kill ? '#ff4a4a' : '#000'; ctx.shadowBlur = m.kill ? 8 : 2;
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.beginPath(); ctx.moveTo(cross.x + sx * r0 * 0.7, cross.y + sy * r0 * 0.7); ctx.lineTo(cross.x + sx * r1 * 0.7, cross.y + sy * r1 * 0.7); ctx.stroke(); }
      if (m.kill) { ctx.font = '800 11px "Chakra Petch", system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff6a6a'; ctx.fillText('KILL', cross.x, cross.y - r1 - 4); }
      ctx.restore();
    }
  }
  function killWatch() {
    const n = root.NightshiftCombatFx?.stats?.().bodies; if (!Number.isFinite(n)) return;
    if (bodies0 >= 0 && n > bodies0 && performance.now() - lastHit < 450) { st.kills++; marks.push({ t: performance.now(), kill: true }); tone(1200, 1800, 0.12, 0.16); }
    bodies0 = n;
  }

  // ---------------- enemy fire (heard by distance) ----------------
  function hookEnemy() {
    const CV = root.NightshiftCombatVision; if (!CV || CV.__feel) return !!CV?.__feel;
    root.NightshiftCombatVision = Object.freeze({ ...CV, __feel: true, shot(x, y, kind) { try { const p = P(); if (p) { const d = Math.hypot(x - p.x, y - p.y), q = distant(d); st.enemyShots++; bang(/shotgun/.test(String(kind)) ? 'shotgun' : /rifle|swat/.test(String(kind)) ? 'rifle' : 'pistol', q); } } catch { /* cosmetic */ } return CV.shot.apply(this, arguments); } });
    return true;
  }

  // ---------------- low health ----------------
  let nextBeat = 0;
  function hookOverlay() {
    const E = root.NightshiftEnvironment; if (!E?.overlay || E.__feel) return !!E?.__feel;
    const ov = E.overlay;
    E.overlay = function (now) {
      const r = ov.apply(this, arguments);
      try {
        const p = P(), ctx = g; if (p && p.hp > 0 && p.hp < 35) { // eslint-disable-line no-undef
          const t = performance.now(), pulse = 0.55 + 0.45 * Math.max(0, Math.sin(t / 130)), w = ctx.canvas.width / (ctx.getTransform().a || 1), h = ctx.canvas.height / (ctx.getTransform().d || 1), a = Math.min(0.85, 0.25 + (1 - p.hp / 35) * 0.6) * pulse;
          const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.62); gr.addColorStop(0, 'rgba(190,0,16,0)'); gr.addColorStop(0.6, `rgba(190,0,16,${(a * 0.35).toFixed(3)})`); gr.addColorStop(1, `rgba(190,0,16,${a.toFixed(3)})`); ctx.save(); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); ctx.restore();
          if (t > nextBeat) { nextBeat = t + 600 + p.hp * 14; beat(); }
        }
        killWatch();
      } catch { /* cosmetic */ }
      return r;
    };
    E.__feel = true; return true;
  }
  const hooks = [hookCamera, hookFeedback, hookEnemy, hookOverlay];
  const tm = setInterval(() => { if (hooks.map((h) => h()).every(Boolean)) clearInterval(tm); }, 300); setTimeout(() => clearInterval(tm), 20000);
  root.NightshiftCombatFeel = Object.freeze({ TUNE, distant, stats: () => ({ ...st, marks: marks.length, kick: Math.hypot(kick.x, kick.y) }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
