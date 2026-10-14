/* Visual car customisation (Claude-owned). Pure and Node-testable; carstyle.js runs the Vehicle Studio,
 * cars.js draws every option (baked into the car sprite, lights/underglow live).
 * A style is per car (the game's car id: 'car-N' for street cars you own, 'cx-UID' for collection cars):
 *   { finish, rims, tint, spoiler, hood, livery, liveryColor, exhaust, lights, glow }
 * Paint colour itself stays on the car (car.color), like the tuning garage. */
(function (root) {
  'use strict';
  const OPT = {
    finish: { name: 'Paint finish', list: [['gloss', 'Gloss', 0], ['metallic', 'Metallic flake', 900], ['pearl', 'Pearlescent', 1800], ['satin', 'Satin', 1200], ['matte', 'Matte', 1500], ['chrome', 'Mirror chrome', 6500]] },
    rims: { name: 'Wheels', list: [['stock', 'Stock steel', 0], ['chrome', 'Chrome five-spoke', 800], ['black', 'Gloss black', 700], ['gold', 'Gold mesh', 2200], ['deep', 'Deep-dish polished', 1600], ['neon', 'Neon-lip', 2600], ['bronze', 'Bronze mesh', 1900], ['turbine', 'Turbine aero', 2100], ['white', 'White six-spoke', 1400]] },
    tint: { name: 'Window tint', list: [['0', 'Clear', 0], ['1', 'Light 35%', 250], ['2', 'Dark 15%', 450], ['3', 'Limo 5%', 700]] },
    spoiler: { name: 'Spoiler', list: [['none', 'None', 0], ['lip', 'Trunk lip', 400], ['ducktail', 'Ducktail', 900], ['wing', 'Street wing', 1400], ['gt', 'GT wing', 2800]] },
    hood: { name: 'Hood', list: [['stock', 'Stock', 0], ['scoop', 'Ram-air scoop', 900], ['vented', 'Vented', 1100], ['carbon', 'Carbon fibre', 2400]] },
    livery: { name: 'Livery', list: [['none', 'None', 0], ['stripes', 'Twin stripes', 600], ['racing', 'Race number', 900], ['split', 'Two-tone', 1200], ['flames', 'Hot-rod flames', 1800], ['checker', 'Checker band', 1400]] },
    liveryColor: { name: 'Livery colour', list: [['#f4f1ea', 'Bone white', 0], ['#14171c', 'Jet black', 0], ['#e0402a', 'Race red', 0], ['#2f6bd0', 'Royal blue', 0], ['#f2c84a', 'Gold', 0], ['#3ad6a0', 'Mint', 0], ['#ff4ad8', 'Hot pink', 0]] },
    exhaust: { name: 'Exhaust', list: [['stock', 'Hidden', 0], ['twin', 'Twin tips', 500], ['quad', 'Quad tips', 1100], ['side', 'Centre big-bore', 1300]] },
    lights: { name: 'Headlights', list: [['stock', 'Halogen', 0], ['xenon', 'Xenon white', 700], ['amber', 'Amber', 500], ['ice', 'Ice blue', 900]] },
    kit: { name: 'Body kit', list: [['stock', 'Factory body', 0], ['lip', 'Splitter + side skirts', 1200], ['drift', 'Drift aero (canards, big splitter)', 3200], ['wide', 'Bolt-on widebody', 4800]] },
    stance: { name: 'Stance', list: [['stock', 'Factory height', 0], ['lowered', 'Lowered on coilovers', 800], ['slammed', 'Slammed + camber', 1900]] },
    glow: { name: 'Underglow', list: [['none', 'None', 0], ['#3fa8ff', 'Electric blue', 1500], ['#ff4ad8', 'Hot pink', 1500], ['#3ad6a0', 'Toxic green', 1500], ['#ffb347', 'Sunset', 1500], ['#b06bff', 'Violet', 1500]] },
  };
  const KEYS = Object.keys(OPT);
  const DEFAULT = Object.freeze({ finish: 'gloss', rims: 'stock', tint: '0', spoiler: 'none', hood: 'stock', livery: 'none', liveryColor: '#f4f1ea', exhaust: 'stock', lights: 'stock', glow: 'none', kit: 'stock', stance: 'stock' });
  const has = (k, v) => OPT[k].list.some((o) => o[0] === v);
  const priceOf = (k, v) => OPT[k]?.list.find((o) => o[0] === v)?.[2] ?? 0;
  const nameOf = (k, v) => OPT[k]?.list.find((o) => o[0] === v)?.[1] ?? v;
  const validCar = (id) => typeof id === 'string' && /^(car-\d{1,4}|cx-\d{1,6})$/.test(id);
  function cleanStyle(raw) { const s = { ...DEFAULT }; for (const k of KEYS) if (raw && has(k, String(raw[k]))) s[k] = String(raw[k]); return s; }
  function clean(raw) {
    const s = { version: 1, cars: {}, spent: 0 };
    for (const [id, st] of Object.entries(raw?.cars || {})) if (validCar(id)) s.cars[id] = cleanStyle(st);
    if (Number.isFinite(raw?.spent) && raw.spent > 0) s.spent = Math.round(raw.spent);
    return s;
  }
  const styleOf = (s, id) => s.cars[id] || DEFAULT;
  // What changed between the car's current style and a preview, and what it costs (only options you don't have yet).
  function diff(cur, next) { const out = []; for (const k of KEYS) if (cur[k] !== next[k]) out.push({ k, v: next[k], name: `${OPT[k].name}: ${nameOf(k, next[k])}`, price: priceOf(k, next[k]) }); return out; }
  function cost(cur, next, mult = 1) { return Math.round(diff(cur, next).reduce((t, d) => t + d.price, 0) * mult); }
  function apply(s, wallet, carId, next, mult = 1) {
    if (!validCar(carId)) return { ok: false, reason: 'Not your car' };
    const cur = styleOf(s, carId), n = cleanStyle(next), d = diff(cur, n); if (!d.length) return { ok: false, reason: 'Nothing changed' };
    const price = cost(cur, n, mult); if (!(wallet.cash >= price)) return { ok: false, reason: `Needs $${price.toLocaleString()}` };
    wallet.cash -= price; s.cars[carId] = n; s.spent += price; return { ok: true, price, changes: d };
  }
  // Show points for the car meet: how built-out the car looks (0..30).
  function flair(st) { let p = 0; for (const k of KEYS) { const v = priceOf(k, st[k]); p += v >= 2000 ? 4 : v >= 1000 ? 3 : v > 0 ? 2 : 0; } return Math.min(30, p); }
  const keyOf = (st) => KEYS.map((k) => st[k]).join('|');
  // Move a style when a car's id changes (re-VIN, chop → collection).
  function move(s, from, to) { if (!s.cars[from] || !validCar(to)) return false; s.cars[to] = s.cars[from]; delete s.cars[from]; return true; }

  const api = Object.freeze({ OPT, KEYS, DEFAULT, clean, cleanStyle, styleOf, diff, cost, apply, flair, keyOf, priceOf, nameOf, move, validCar });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftCarStyleData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
