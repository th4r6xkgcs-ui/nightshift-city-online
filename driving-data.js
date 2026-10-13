/* Driving rules (Claude-owned, v0.64). Pure and Node-testable; driving.js runs it in game.
 *  - Drift: hold BRAKE while steering at speed -> the car slides instead of stopping: tighter yaw, a little speed
 *    bleed, and a body slip angle (drawn) that builds with steering. Release to catch it.
 *  - Drift chains score points (speed x slip x time); a chain ends after a short straight. Points pay cash + Driving XP.
 *  - Damage stages for visuals (dents, smoke, fire) from car condition.
 *  - Gas station services and prices (fuel, repair, wash, nitro).
 *  - Nitro: a short boost from a refillable tank (bought at gas stations).
 * The server can run step() for every car later; it only reads/writes plain numbers on the car object. */
(function (root) {
  'use strict';
  const DRIFT = { minSpeed: 3.0, minSteer: 0.3, yaw: 0.026, bleed: 0.993, slipMax: 0.62, slipIn: 0.14, slipOut: 0.09, grace: 0.7 };
  const NITRO = { max: 100, burn: 34, boost: 1.45, top: 1.3 }; // burn % per second; boost to accel, top to max speed
  const PRICES = { fuelPct: 0.8, repairPct: 1.5, wash: 25, nitro: 120 };

  // One physics step for drifting. `input` = { thrust, steer, brake, dt }. Returns { drifting, brake } — the brake
  // value the normal handling should see (false while drifting so the car keeps its speed).
  function step(car, input) {
    const dt = Math.max(0, Math.min(2, Number.isFinite(input.dt) ? input.dt : 1)), steer = Math.max(-1, Math.min(1, input.steer || 0));
    const fast = Math.abs(car.speed || 0) >= DRIFT.minSpeed && (car.speed || 0) > 0;
    const drifting = !!input.brake && fast && Math.abs(steer) >= DRIFT.minSteer;
    const target = drifting ? steer * DRIFT.slipMax : 0;
    car.drift = (car.drift || 0) + (target - (car.drift || 0)) * Math.min(1, (drifting ? DRIFT.slipIn : DRIFT.slipOut) * dt * 2);
    if (Math.abs(car.drift) < 0.004) car.drift = 0;
    if (drifting) { car.angle += steer * DRIFT.yaw * dt; car.speed *= Math.pow(DRIFT.bleed, dt); }
    return { drifting, brake: drifting ? false : !!input.brake };
  }
  // scoring: call every frame with seconds; returns a finished chain { points, cash, xp } or null
  function score(chain, car, drifting, sec) {
    const slip = Math.abs(car.drift || 0), sp = Math.abs(car.speed || 0);
    if (drifting || slip > 0.18) { chain.points += sp * slip * sec * 60; chain.time += sec; chain.idle = 0; chain.mult = 1 + Math.min(3, Math.floor(chain.time / 2)) * 0.5; return null; }
    if (chain.points <= 0) return null;
    chain.idle += sec; if (chain.idle < DRIFT.grace) return null;
    const pts = Math.round(chain.points * chain.mult), out = pts >= 60 ? { points: pts, cash: Math.min(600, Math.floor(pts / 25)), xp: Math.min(120, Math.floor(pts / 40)), time: chain.time } : null;
    chain.points = 0; chain.time = 0; chain.idle = 0; chain.mult = 1;
    return out;
  }
  const newChain = () => ({ points: 0, time: 0, idle: 0, mult: 1 });
  // visual damage stage: 0 clean, 1 dented, 2 smoking, 3 heavy smoke, 4 on fire
  const stage = (condition) => { const c = Number.isFinite(condition) ? condition : 100; return c > 75 ? 0 : c > 50 ? 1 : c > 28 ? 2 : c > 10 ? 3 : 4; };
  function quote(car) {
    const fuel = Math.max(0, Math.min(100, car?.fuel ?? 100)), cond = Math.max(0, Math.min(100, car?.condition ?? 100)), nitro = Math.max(0, Math.min(NITRO.max, car?.nitro ?? 0));
    return { fuel: Math.ceil((100 - fuel) * PRICES.fuelPct), repair: Math.ceil((100 - cond) * PRICES.repairPct), wash: PRICES.wash, nitro: nitro >= NITRO.max ? 0 : PRICES.nitro };
  }
  function service(car, wallet, kind) {
    const q = quote(car), cost = q[kind];
    if (!(kind in q)) return { ok: false, reason: 'Unknown service' };
    if (!cost) return { ok: false, reason: kind === 'nitro' ? 'Nitro tank is full' : kind === 'fuel' ? 'Tank is full' : 'Nothing to fix' };
    if (!wallet || wallet.cash < cost) return { ok: false, reason: `Need $${cost}` };
    wallet.cash -= cost;
    if (kind === 'fuel') car.fuel = 100; else if (kind === 'repair') car.condition = 100; else if (kind === 'wash') car.dirt = 0; else car.nitro = NITRO.max;
    return { ok: true, cost };
  }
  // nitro: returns accel/top multipliers for this frame and burns the tank
  function nitro(car, on, sec) {
    if (!on || !(car.nitro > 0) || !(car.speed > 0.5)) return { accel: 1, top: 1, active: false };
    car.nitro = Math.max(0, car.nitro - NITRO.burn * sec);
    return { accel: NITRO.boost, top: NITRO.top, active: true };
  }
  // gas stations from the city's lots (city-data marks them lot:'gas'); pump island under the canopy
  function gasStations(buildings) {
    const out = [];
    for (const b of buildings || []) if (b && b.lot === 'gas') { const bx = Math.floor(b.x / 440) * 440, by = Math.floor(b.y / 340) * 340; out.push({ id: `gas-${bx / 440}-${by / 340}`, x: bx + 160, y: by + 212 }); }
    return out;
  }

  const api = Object.freeze({ DRIFT, NITRO, PRICES, step, score, newChain, stage, quote, service, nitro, gasStations });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftDrivingData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
