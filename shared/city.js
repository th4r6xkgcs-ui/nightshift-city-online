// Nightshift City Online — city layout as data, for server-side rules.
// Mirrors the client's world.js createBuildings() and city-map.js
// destinations() exactly; server/tests/city.test.cjs fails if they drift.
(function (root) {
  'use strict';
  const NAMES = ['APARTMENTS', 'CORNER SHOP', 'GARAGE', 'DINER', 'WAREHOUSE', 'CLOTHING', 'BANK', 'CLUB'];
  const WALL_MARGIN = 9;            // client blocked(): 9px around each building
  const CLINIC = Object.freeze({ x: 440, y: 340, radius: 75 }); // safe-zones.js
  const SHOP_RANGE = 120;           // how close to a corner shop door to trade

  function createBuildings(width = 2200, height = 1700) {
    const buildings = [];
    for (let x = 0; x < width; x += 440) {
      for (let y = 0; y < height; y += 340) {
        if (x < 100 || y < 100) continue;
        const name = NAMES[((x / 440) * 3 + y / 340 | 0) % NAMES.length];
        buildings.push({ x: x + 80, y: y + 75, w: 240, h: 170, name });
      }
    }
    return buildings;
  }

  function createCity(width = 2200, height = 1700) {
    const buildings = createBuildings(width, height);
    const doors = buildings.map((b, i) => ({ id: 'building-' + i, label: b.name, x: b.x + b.w / 2, y: b.y + b.h + 22 }));
    const shops = doors.filter((d) => d.label === 'CORNER SHOP');

    // Point blocked for a walker (same rule as client game.js blocked()).
    function blocked(x, y, m = WALL_MARGIN) {
      for (const b of buildings) if (x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m) return true;
      return false;
    }

    // Distance along a ray (ox,oy)+(dx,dy)*t to the first building, or Infinity.
    function rayHit(ox, oy, dx, dy, maxT) {
      let best = Infinity;
      for (const b of buildings) {
        let t0 = 0, t1 = maxT;
        for (const [o, d, lo, hi] of [[ox, dx, b.x, b.x + b.w], [oy, dy, b.y, b.y + b.h]]) {
          if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = Infinity; break; } continue; }
          let a = (lo - o) / d, c = (hi - o) / d;
          if (a > c) [a, c] = [c, a];
          t0 = Math.max(t0, a); t1 = Math.min(t1, c);
          if (t0 > t1) { t0 = Infinity; break; }
        }
        if (t0 < best) best = t0;
      }
      return best;
    }

    const inClinic = (p) => Math.hypot(p.x - CLINIC.x, p.y - CLINIC.y) <= CLINIC.radius;
    const nearShop = (p) => shops.some((s) => Math.hypot(p.x - s.x, p.y - s.y) <= SHOP_RANGE);

    return Object.freeze({ buildings, doors, shops, clinic: CLINIC, blocked, rayHit, inClinic, nearShop });
  }

  const api = Object.freeze({ createBuildings, createCity, WALL_MARGIN, CLINIC, SHOP_RANGE });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftCity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
