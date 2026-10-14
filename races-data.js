/* Street races (Claude-owned). Pure and Node-testable; races.js runs them in game.
 * Checkpoints sit on road centre lines (NightshiftRoads.XS = 440/880/1320/1760, YS = 340/680/1020/1360).
 * Par times scale with course length and the number of turns. Medals: gold <= par,
 * silver <= par*1.25, bronze <= par*1.6; slower than bronze*1.5 (DNF limit) ends the race. */
(function (root) {
  'use strict';
  const RACES = [
    { id: 'loop', name: 'Midtown Loop', tier: 'Rookie', reward: 700, xp: 150,
      points: [[1100, 680], [1320, 680], [1320, 1020], [1100, 1020], [880, 1020], [880, 680]] }, // starts mid-block: (880,680) is the apartment door
    { id: 'docks', name: 'Docks Dash', tier: 'Pro', reward: 1200, xp: 260,
      points: [[440, 340], [880, 340], [1320, 340], [1760, 340], [1760, 680], [1760, 1020], [1760, 1360]] },
    { id: 'tour', name: 'Grand Tour', tier: 'Legend', reward: 2200, xp: 450,
      points: [[440, 1360], [440, 1020], [440, 680], [440, 340], [880, 340], [1320, 340], [1760, 340], [1760, 680], [1320, 680], [1320, 1020], [1760, 1020], [1760, 1360], [1320, 1360], [880, 1360], [440, 1360]] },
    // v0.64: courses through the outer districts (all legs on road centre lines, k*440 / k*340)
    { id: 'fairview', name: 'Fairview Figure', tier: 'Street', reward: 1000, xp: 220, drift: true,
      points: [[880, 3740], [1320, 3740], [1320, 4080], [1760, 4080], [1760, 3740], [2200, 3740], [2200, 4420], [880, 4420], [880, 3740]] },
    { id: 'downtown', name: 'Downtown Sprint', tier: 'Pro', reward: 1500, xp: 320,
      points: [[2640, 680], [3080, 680], [3960, 680], [3960, 1020], [3080, 1020], [3080, 1360], [4400, 1360]] },
    { id: 'harbor', name: 'Ironworks to Harbor', tier: 'Legend', reward: 2600, xp: 520,
      points: [[4840, 1700], [5720, 1700], [5720, 2380], [5280, 2380], [5280, 3740], [5720, 3740], [5720, 4420]] },
  ];
  const BY_ID = Object.fromEntries(RACES.map((r) => [r.id, r]));
  const CP_RADIUS = 75, START_RADIUS = 70, COOLDOWN_MS = 90000;
  const MEDALS = [{ id: 'gold', icon: '🥇', mult: 1, pay: 1 }, { id: 'silver', icon: '🥈', mult: 1.25, pay: 0.6 }, { id: 'bronze', icon: '🥉', mult: 1.6, pay: 0.35 }];

  const length = (race) => race.points.slice(1).reduce((t, p, i) => t + Math.hypot(p[0] - race.points[i][0], p[1] - race.points[i][1]), 0);
  function turns(race) {
    let n = 0;
    for (let i = 1; i < race.points.length - 1; i++) {
      const [a, b, c] = [race.points[i - 1], race.points[i], race.points[i + 1]];
      const d1 = Math.atan2(b[1] - a[1], b[0] - a[0]), d2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      if (Math.abs(Math.atan2(Math.sin(d2 - d1), Math.cos(d2 - d1))) > 0.5) n++;
    }
    return n;
  }
  // Seconds. Calibrated with an autopilot on real game physics (no traffic): a stock car driven near-perfectly
  // runs Loop 6.0s / Docks 6.7s / Tour 18.7s (= silver); a maxed car + Driving 50 runs Loop 4.5s / Docks 4.6s.
  // So gold needs upgrades, skill or a great line; bronze stays friendly to touch controls and traffic.
  const par = (race) => Math.round((length(race) / 420 + turns(race) * 0.63) * 10) / 10;
  const limit = (race) => par(race) * MEDALS[2].mult * 1.5;
  function medal(race, seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return MEDALS.find((m) => seconds <= par(race) * m.mult) || null;
  }
  // Payout: full medal value the first time a medal tier is beaten, 30% on repeats (balanced against deliveries:
  // repeat golds earn ~$350/min on the Grand Tour, similar to courier work).
  function payout(race, m, bestBefore) {
    if (!m) return 0;
    const prev = medal(race, bestBefore);
    const improved = !prev || MEDALS.indexOf(m) < MEDALS.indexOf(prev);
    return Math.round(Math.round(race.reward * m.pay) * (improved ? 1 : 0.3)); // round the medal value first (no float drift)
  }
  function clean(raw) {
    const s = { version: 1, best: {}, medals: {}, runs: 0 };
    for (const r of RACES) {
      const b = raw?.best?.[r.id];
      if (Number.isFinite(b) && b > 1 && b < 3600) s.best[r.id] = Math.round(b * 1000) / 1000;
      const m = medal(r, s.best[r.id]);
      if (m) s.medals[r.id] = m.id;
    }
    s.runs = Number.isSafeInteger(raw?.runs) && raw.runs > 0 ? Math.min(1e7, raw.runs) : 0;
    return s;
  }
  const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}` : '–');

  const api = Object.freeze({ RACES, BY_ID, MEDALS, CP_RADIUS, START_RADIUS, COOLDOWN_MS, length, turns, par, limit, medal, payout, clean, fmt });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftRacesData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
