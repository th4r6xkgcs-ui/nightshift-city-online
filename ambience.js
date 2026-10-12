/* City soundscape (Claude-owned). Only plays when the game's SOUND toggle is on, and only after a tap
 * (browser rule). All sound is synthesized (no audio files):
 *  - traffic rumble bed (busier in Midtown, quieter at the docks / late at night)
 *  - rain hiss while it rains, wind gusts, distant sirens when you are wanted
 *  - footsteps while walking/running, chunkier gunshots per weapon, a cash "ka-ching" on big payouts
 * Mutes indoors to a soft room tone and while the page is hidden. API: NightshiftAmbience.{on, level} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const soundOn = () => document.querySelector('#sound')?.getAttribute('aria-pressed') === 'true';
  let ctx = null, master = null, bed = null, rain = null, wind = null, started = false;

  function noiseBuffer(c, seconds, brown) {
    const b = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate), d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  function loop(buffer, filterType, freq, q = 0.7) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buffer; s.loop = true; f.type = filterType; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(master); s.start(); return { s, f, g };
  }
  function start() {
    if (started) return;
    try {
      const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      const brown = noiseBuffer(ctx, 4, true), white = noiseBuffer(ctx, 3, false);
      bed = loop(brown, 'lowpass', 420); rain = loop(white, 'highpass', 2600); wind = loop(brown, 'bandpass', 600, 0.4);
      started = true;
    } catch { started = false; }
  }
  addEventListener('pointerdown', () => { if (soundOn()) { start(); ctx?.resume?.().catch(() => {}); } }, { passive: true });
  addEventListener('keydown', () => { if (soundOn()) { start(); ctx?.resume?.().catch(() => {}); } });

  const ramp = (param, v, t = 0.6) => { try { param.setTargetAtTime(v, ctx.currentTime, t); } catch { param.value = v; } };
  function oneShot(fn) { if (!started || !soundOn() || document.hidden) return; try { fn(ctx.currentTime); } catch { /* ignore */ } }
  function burst(t, { dur = 0.12, freq = 1800, type = 'bandpass', vol = 0.4, q = 0.8 } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuffer(ctx, dur + 0.02, false); f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.03);
  }
  function tone(t, { f0 = 120, f1 = 40, dur = 0.15, vol = 0.5, type = 'sine' } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  const GUN = { pistol: [0.1, 1600, 0.45, 110], revolver: [0.18, 1100, 0.6, 80], smg: [0.07, 2200, 0.32, 140], shotgun: [0.26, 700, 0.75, 60], rifle: [0.22, 1300, 0.65, 70], ar: [0.11, 1800, 0.45, 100] };
  function gunshot() {
    oneShot((t) => {
      const id = root.NightshiftWeapons?.state?.equipped || 'pistol', [dur, fq, vol, thump] = GUN[id] || GUN.pistol;
      const sup = (root.NightshiftWeapons?.state?.mods?.[id] || []).includes('suppressor');
      burst(t, { dur: sup ? dur * 0.5 : dur, freq: sup ? fq * 0.5 : fq, vol: sup ? vol * 0.3 : vol });
      tone(t, { f0: thump * 2, f1: thump * 0.5, dur: dur * 1.3, vol: sup ? 0.15 : 0.5 });
    });
  }
  const FB = root.NightshiftFeedback;
  if (FB && typeof FB.shot === 'function' && !FB.__amb) { const shot = FB.shot; FB.shot = function () { const r = shot.apply(this, arguments); gunshot(); return r; }; FB.__amb = true; }

  // cash ka-ching on big jumps
  let lastCash = null;
  function kaching() { oneShot((t) => { tone(t, { f0: 1320, f1: 1310, dur: 0.12, vol: 0.18, type: 'triangle' }); tone(t + 0.08, { f0: 1760, f1: 1750, dur: 0.25, vol: 0.18, type: 'triangle' }); burst(t, { dur: 0.05, freq: 6000, vol: 0.12 }); }); }

  // footsteps + siren + mix update
  let stepAcc = 0, lastWalk = 0, sirenAt = 0;
  function siren() { oneShot((t) => { const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 1200; for (let i = 0; i < 6; i++) { o.frequency.setValueAtTime(650, t + i * 0.5); o.frequency.linearRampToValueAtTime(950, t + i * 0.5 + 0.25); o.frequency.linearRampToValueAtTime(650, t + i * 0.5 + 0.5); } g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + 3); o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 3.1); }); }
  setInterval(() => {
    const p = P(); if (!p) return;
    if (lastCash !== null && p.cash - lastCash >= 500) kaching();
    lastCash = p.cash;
    if (!started) return;
    const on = soundOn() && !document.hidden, env = root.NightshiftEnvironment, minute = env?.state?.minute ?? 720;
    const night = env?.darkness?.(minute) || 0, rainy = env?.weather?.(minute) || 0, home = !!root.NightshiftHome?.kind?.();
    const district = env?.district?.(p) || '', busy = district === 'MIDTOWN' ? 1 : district === 'THE DOCKS' ? 0.55 : 0.8;
    ramp(bed.g.gain, on ? (home ? 0.05 : 0.22 * busy * (1 - night * 0.45)) : 0);
    ramp(rain.g.gain, on ? rainy * (home ? 0.03 : 0.09) : 0);
    ramp(wind.g.gain, on && !home ? 0.025 + 0.02 * Math.sin(performance.now() / 4000) : 0);
    try { wind.f.frequency.setTargetAtTime(500 + 250 * Math.sin(performance.now() / 3000), ctx.currentTime, 1); } catch { /* n/a */ }
    // footsteps from the game's walk animation counter
    if (on && !p.car && !home && p.moving) {
      const wt = p.walkTicks || 0; stepAcc += Math.max(0, wt - lastWalk); lastWalk = wt;
      if (stepAcc > 10) { stepAcc = 0; oneShot((t) => burst(t, { dur: 0.05, freq: rainy > 0.2 ? 2400 : 900, vol: rainy > 0.2 ? 0.08 : 0.06, q: 1.2 })); }
    } else lastWalk = p.walkTicks || 0;
    if (on && (p.heat || 0) >= 1 && performance.now() > sirenAt) { sirenAt = performance.now() + 9000 + Math.random() * 8000; siren(); }
  }, 100);

  root.NightshiftAmbience = Object.freeze({ on: () => started && soundOn(), level: () => (master ? master.gain.value : 0) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
