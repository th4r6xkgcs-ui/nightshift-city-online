// Nightshift City Online — on-foot movement step.
// The ONE implementation used by both the authoritative server and client
// prediction, so a predicted position matches what the server will compute.
(function (root) {
  'use strict';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // pos: {x, y}; input: {mx, my, sprint}; dtMs: elapsed ms;
  // city: object from NightshiftCity.createCity(); rules: NightshiftRules.
  // Returns a new {x, y}. Never mutates its arguments.
  function step(pos, input, dtMs, city, rules) {
    const dt = clamp(dtMs, 0, 250) / 1000; // bound stalls like the client does
    let mx = clamp(+input.mx || 0, -1, 1), my = clamp(+input.my || 0, -1, 1);
    const len = Math.hypot(mx, my);
    if (len < 0.05) return { x: pos.x, y: pos.y }; // deadzone, matches client stick
    if (len > 1) { mx /= len; my /= len; }
    const speed = input.sprint ? rules.player.runPxPerSec : rules.player.walkPxPerSec;
    const r = rules.player.radius;
    let x = pos.x, y = pos.y;
    // Axis-separated moves so players slide along walls like the client.
    const nx = clamp(x + mx * speed * dt, r, rules.world.w - r);
    if (!city.blocked(nx, y)) x = nx;
    const ny = clamp(y + my * speed * dt, r, rules.world.h - r);
    if (!city.blocked(x, ny)) y = ny;
    return { x, y };
  }

  const api = Object.freeze({ step });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftOnlineMovement = api; // not NightshiftMovement: the client uses that name for stamina
})(typeof globalThis !== 'undefined' ? globalThis : this);
