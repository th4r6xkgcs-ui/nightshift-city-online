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
    // Pulling against the car: brake while rolling forward, then reverse with the rear swinging toward the stick.
    if (ad > REVERSE || (speed < -0.3 && ad > 1.4)) {
      if (speed > 0.6) return { thrust: -mag, steer: 0 };
      const back = wrap(target - (angle + PI));
      return { thrust: -mag, steer: clamp(-back * GAIN, -1, 1) };
    }
    // Forward: steer toward the stick; ease off the gas in tight turns so it doesn't plough.
    const steer = clamp(diff * GAIN, -1, 1);
    const thrust = mag * (ad < 0.6 ? 1 : ad < 1.3 ? 0.75 : 0.45);
    return { thrust, steer };
  }
  const classic = (angle, speed, mx, my) => ({ thrust: -my, steer: mx });

  let mode = 'screen';
  try { const m = root.localStorage?.getItem(KEY); if (m === 'classic' || m === 'screen') mode = m; } catch { /* default */ }
  const api = {
    screen, classic, wrap,
    get mode() { return mode; },
    setMode(m) { mode = m === 'classic' ? 'classic' : 'screen'; try { root.localStorage?.setItem(KEY, mode); } catch { /* n/a */ } return mode; },
    toggle() { return api.setMode(mode === 'screen' ? 'classic' : 'screen'); },
    map(angle, speed, mx, my) { return (mode === 'classic' ? classic : screen)(angle, speed, mx, my); },
  };
  root.NightshiftDriveInput = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
