/* Drive input (Claude-owned). Pure + tiny runtime. Turns the left stick into car thrust/steer.
 *  - 'screen' (default): push the stick the way you want to go ON SCREEN. The car turns toward that direction and
 *    drives; pull against the way the car points to brake, keep holding to reverse (rear swings toward the stick).
 *  - 'classic': the old tank style (up = gas, left/right = turn relative to the car).
 * Keyboard arrows/WASD follow the same mode. Toggle: NightshiftDriveInput.setMode('classic'|'screen'),
 * also on the 📱 phone Settings line. Save: nightshift-drive-mode. */
(function (root) {
  'use strict';
  const KEY = 'nightshift-drive-mode';
  const PI = Math.PI;
  const wrap = (a) => { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DEAD = 0.18, REVERSE = 2.25, GAIN = 2.4;

  /** angle: car heading (rad), speed: signed car speed, mx/my: stick (screen, y down). Returns { thrust, steer }. */
  function screen(angle, speed, mx, my) {
    const mag = Math.min(1, Math.hypot(mx, my));
    if (mag < DEAD) return { thrust: 0, steer: 0 };
    const target = Math.atan2(my, mx), diff = wrap(target - angle), ad = Math.abs(diff);
    // Pulling against the car: brake while rolling forward, then a three-point turn — back up while the nose
    // swings round toward the stick (reversing flips steering, hence -sign), and drive off once it's facing.
    if (ad > REVERSE || (speed < -0.3 && ad > 1.1)) {
      if (speed > 0.6) return { thrust: -mag, steer: 0 };
      return { thrust: -mag * 0.8, steer: diff >= 0 ? -1 : 1 };
    }
    // Forward: steer toward the stick; ease off the gas in tight turns so it doesn't plough.
    const steer = clamp(diff * GAIN, -1, 1);
    const thrust = mag * (ad < 0.6 ? 1 : ad < 1.3 ? 0.75 : 0.45);
    return { thrust, steer };
  }
  // Wedged against a wall with the gas held: back out briefly (rear swinging the other way), then drive on.
  function unstick(S, r, speed, dt, now) {
    if (now < S.backUntil) return { thrust: -0.85, steer: -(S.steer || 1) };
    if (r.thrust > 0.3 && Math.abs(speed) < 0.25) S.ms += dt; else S.ms = 0;
    if (S.ms > 450) { S.ms = 0; S.backUntil = now + 700; S.steer = r.steer >= 0 ? 1 : -1; }
    return r;
  }
  const stuck = { ms: 0, backUntil: 0, last: 0, steer: 1 };
  const classic = (angle, speed, mx, my) => ({ thrust: -my, steer: mx });

  let mode = 'screen';
  try { const m = root.localStorage?.getItem(KEY); if (m === 'classic' || m === 'screen') mode = m; } catch { /* default */ }
  const api = {
    screen, classic, wrap, unstick,
    get mode() { return mode; },
    setMode(m) { mode = m === 'classic' ? 'classic' : 'screen'; try { root.localStorage?.setItem(KEY, mode); } catch { /* n/a */ } return mode; },
    toggle() { return api.setMode(mode === 'screen' ? 'classic' : 'screen'); },
    map(angle, speed, mx, my) {
      if (mode === 'classic') return classic(angle, speed, mx, my);
      const r = screen(angle, speed, mx, my);
      const now = root.performance ? root.performance.now() : Date.now(), dt = Math.min(100, now - (stuck.last || now)); stuck.last = now;
      return unstick(stuck, r, speed, dt, now);
    },
  };
  root.NightshiftDriveInput = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
