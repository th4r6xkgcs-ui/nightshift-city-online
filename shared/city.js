// Nightshift City Online — city geometry for server-side rules.
//
// Source of truth is the client's catalog, `city-data.js` (layout contract v1,
// owned by Codex). When that file is present (after the client branch merges)
// it is used directly. Until then a built-in copy of layout v1 is used, and
// server/tests/city.test.cjs fails if the two ever differ.
(function (root) {
  'use strict';
  const NAMES = ['APARTMENTS', 'CORNER SHOP', 'GARAGE', 'DINER', 'WAREHOUSE', 'CLOTHING', 'BANK', 'CLUB'];
  const SHOP_RANGE = 120; // server rule: how close to a corner shop door to trade

  // Built-in fallback: identical to city-data.js layout() v1.
  function builtInLayout() {
    const WIDTH = 2200, HEIGHT = 1700, buildings = [];
    for (let x = 0; x < WIDTH; x += 440) {
      for (let y = 0; y < HEIGHT; y += 340) {
        if (x < 100 || y < 100) continue;
        const name = NAMES[((x / 440) * 3 + y / 340 | 0) % NAMES.length];
        buildings.push({ x: x + 80, y: y + 75, w: 240, h: 170, name });
      }
    }
    return {
      version: 1, width: WIDTH, height: HEIGHT, playerMargin: 10, buildingPadding: 9,
      spawn: { x: 460, y: 450 },
      clinic: { x: 440, y: 340, radius: 75 },
      apartment: { x: 880, y: 680, radius: 85 },
      buildings: buildings.map((b, i) => ({
        id: 'building-' + i, x: b.x, y: b.y, w: b.w, h: b.h, name: b.name,
        entrance: { x: b.x + b.w / 2, y: b.y + b.h + 12 },
      })),
    };
  }

  // Prefer the client's catalog when it is available.
  function loadLayout() {
    try {
      if (typeof module === 'object' && module.exports && typeof require === 'function') {
        const mod = require('../city-data.js');
        if (mod && typeof mod.layout === 'function') return { layout: mod.layout(), source: 'city-data.js' };
      } else if (root.NightshiftCityData && typeof root.NightshiftCityData.layout === 'function') {
        return { layout: root.NightshiftCityData.layout(), source: 'city-data.js' };
      }
    } catch (e) {
      if (e && e.code !== 'MODULE_NOT_FOUND') throw e;
    }
    return { layout: builtInLayout(), source: 'built-in' };
  }

  function createCity(layout) {
    let source = 'given';
    if (!layout) ({ layout, source } = loadLayout());
    if (!layout || layout.version !== 1) throw new Error('unsupported city layout version');
    const pad = layout.buildingPadding;
    const buildings = layout.buildings.map((b) => Object.freeze({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, name: b.name, entrance: Object.freeze({ ...b.entrance }) }));
    const shops = buildings.filter((b) => b.name === 'CORNER SHOP').map((b) => b.entrance);
    const clinic = Object.freeze({ ...layout.clinic });

    // Point blocked for a walker (same padding the client uses).
    function blocked(x, y, m = pad) {
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

    const inClinic = (p) => Math.hypot(p.x - clinic.x, p.y - clinic.y) <= clinic.radius;
    const nearShop = (p) => shops.some((s) => Math.hypot(p.x - s.x, p.y - s.y) <= SHOP_RANGE);

    return Object.freeze({
      source, width: layout.width, height: layout.height, spawn: Object.freeze({ ...layout.spawn }),
      apartment: Object.freeze({ ...layout.apartment }), clinic, buildings, shops,
      padding: pad, blocked, rayHit, inClinic, nearShop,
    });
  }

  const api = Object.freeze({ builtInLayout, loadLayout, createCity, SHOP_RANGE });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftCity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
