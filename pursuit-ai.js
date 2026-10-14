/* Pursuit maths (Claude-owned, v0.71; pure + Node-testable). Used by police-cars.js.
 *  intercept(cop, car, d)  where to aim: lead the target by its velocity, then sit on its rear quarter (PIT line)
 *  isPit(cop, car)         contact on the rear quarter while heading the same way → spin direction (±1), else 0
 *  playerRams(car, cop)    the player's car is driving INTO the cruiser (not just touching it)
 *  swerve(cop, heading, others)  overtake on the left when something blocks the lane ahead; brake if both lanes are blocked
 *  yieldsTo(civ, cop)      civilian should pull over: a moving cruiser close behind or coming at them
 *  nearShot(civ, bullets)  gunfire close enough to panic a driver
 *  follow(obj, target, maxSpeed, dt)  smooth capped chase (helicopter + searchlight)
 * Speeds: car.speed is in px per 1/60 s (the game's unit), so velocity px/s = speed * 60. */
(function (root) {
  'use strict';
  const dot = (ax, ay, bx, by) => ax * bx + ay * by;
  function intercept(cop, car, d) {
    const a = car.angle || 0, fx = Math.cos(a), fy = Math.sin(a), px = -fy, py = fx, v = (car.speed || 0) * 60, lead = Math.min(0.7, (d || 0) / 450);
    const side = dot(cop.x - car.x, cop.y - car.y, px, py) >= 0 ? 1 : -1;
    return { x: car.x + fx * (v * lead - 16) + px * side * 14, y: car.y + fy * (v * lead - 16) + py * side * 14 };
  }
  function isPit(cop, car) {
    const a = car.angle || 0, fx = Math.cos(a), fy = Math.sin(a), rx = cop.x - car.x, ry = cop.y - car.y;
    const along = dot(rx, ry, fx, fy), lat = dot(rx, ry, -fy, fx), dh = Math.abs(Math.atan2(Math.sin((cop.angle || 0) - a), Math.cos((cop.angle || 0) - a)));
    if (dh > 1.2 || along > 6 || Math.abs(lat) < 5) return 0;
    return lat > 0 ? -1 : 1; // pushed on the right rear → nose swings left, and vice versa
  }
  function playerRams(car, cop) {
    const s = Math.sign(car.speed || 0) || 1, a = car.angle || 0, rx = cop.x - car.x, ry = cop.y - car.y, d = Math.hypot(rx, ry) || 1;
    return dot(Math.cos(a) * s, Math.sin(a) * s, rx / d, ry / d) > 0.55;
  }
  function swerve(cop, heading, others) {
    const fx = Math.cos(heading), fy = Math.sin(heading); let ahead = false, leftBusy = false;
    for (const o of others || []) {
      if (!o || o === cop) continue; const rx = o.x - cop.x, ry = o.y - cop.y, f = dot(rx, ry, fx, fy); if (f < 8 || f > 95) continue;
      const lat = dot(rx, ry, -fy, fx); if (Math.abs(lat) < 20) ahead = true; else if (lat < -20 && lat > -58) leftBusy = true;
    }
    return { side: ahead && !leftBusy ? -1 : 0, brake: ahead && leftBusy };
  }
  function yieldsTo(civ, cop) {
    if (!cop || Math.abs(cop.speed || 0) < 0.8) return false; const rx = cop.x - civ.x, ry = cop.y - civ.y, d = Math.hypot(rx, ry); if (d > 240) return false;
    const a = civ.angle || 0, f = dot(rx, ry, Math.cos(a), Math.sin(a)), lat = Math.abs(dot(rx, ry, -Math.sin(a), Math.cos(a)));
    return lat < 70 && (f < 0 || d < 140); // behind us in our street, or right on top of us
  }
  function nearShot(civ, bullets) { for (const b of bullets || []) if (Math.abs(b.x - civ.x) < 180 && Math.abs(b.y - civ.y) < 180) return true; return false; }
  function follow(obj, t, max, dt) { const dx = t.x - obj.x, dy = t.y - obj.y, d = Math.hypot(dx, dy); if (!d) return { x: obj.x, y: obj.y }; const step = Math.min(d, Math.min(max, 40 + d * 1.2) * dt); return { x: obj.x + dx / d * step, y: obj.y + dy / d * step }; }
  const api = Object.freeze({ intercept, isPit, playerRams, swerve, yieldsTo, nearShot, follow });
  root.NightshiftPursuit = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
