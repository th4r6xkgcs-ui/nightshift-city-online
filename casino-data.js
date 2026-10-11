/* Casino rules (Claude-owned). Pure and Node-testable; casino.js is the browser layer.
 * The house always keeps an edge: slots return ~89.7% at Luck 1 and at most ~96.8% at max Luck
 * (luck.casino multiplies slot wins, capped at 1.08). Roulette is a fair European wheel (97.3%),
 * so it is never affected by Luck. */
(function (root) {
  'use strict';
  const MIN_BET = 10, MAX_BET = 1000;
  // Slots: 3 independent weighted reels.
  const SYMBOLS = [
    { id: 'C', icon: '🍒', weight: 10, three: 5 },
    { id: 'L', icon: '🍋', weight: 8, three: 8 },
    { id: 'B', icon: '🔔', weight: 6, three: 15 },
    { id: 'K', icon: '🍀', weight: 4, three: 30 },
    { id: 'D', icon: '💎', weight: 3, three: 60 },
    { id: '7', icon: '7️⃣', weight: 1, three: 300 },
  ];
  const TWO_CHERRIES = 2; // exactly two 🍒
  const TOTAL = SYMBOLS.reduce((t, s) => t + s.weight, 0);

  const validBet = (bet) => Number.isSafeInteger(bet) && bet >= MIN_BET && bet <= MAX_BET;

  function pickSymbol(rnd) {
    let r = Math.min(0.999999, Math.max(0, rnd())) * TOTAL;
    for (const s of SYMBOLS) { if (r < s.weight) return s; r -= s.weight; }
    return SYMBOLS[SYMBOLS.length - 1];
  }
  // Multiplier of the bet returned (stake included); 0 = lost.
  function slotsMultiplier(ids) {
    const [a, b, c] = ids;
    if (a === b && b === c) return SYMBOLS.find((s) => s.id === a).three;
    if (ids.filter((x) => x === 'C').length === 2) return TWO_CHERRIES;
    return 0;
  }
  function spinSlots(bet, luckMod = 1, rnd = Math.random) {
    if (!validBet(bet)) return null;
    const reels = [pickSymbol(rnd), pickSymbol(rnd), pickSymbol(rnd)];
    const mult = slotsMultiplier(reels.map((s) => s.id));
    const luck = Math.max(1, Math.min(1.08, luckMod));
    return { reels: reels.map((s) => s.icon), ids: reels.map((s) => s.id), mult, payout: mult ? Math.floor(bet * mult * luck) : 0 };
  }
  // Exact expected return per $1 by enumerating every reel combination.
  function slotsRtp(luckMod = 1) {
    const luck = Math.max(1, Math.min(1.08, luckMod));
    let r = 0;
    for (const a of SYMBOLS) for (const b of SYMBOLS) for (const c of SYMBOLS) {
      r += (a.weight * b.weight * c.weight) / TOTAL ** 3 * slotsMultiplier([a.id, b.id, c.id]) * luck;
    }
    return r;
  }

  // Roulette: European single-zero wheel.
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
  const OUTSIDE = { red: (n) => colorOf(n) === 'red', black: (n) => colorOf(n) === 'black', odd: (n) => n > 0 && n % 2 === 1, even: (n) => n > 0 && n % 2 === 0, low: (n) => n >= 1 && n <= 18, high: (n) => n >= 19 };
  const validChoice = (c) => Object.prototype.hasOwnProperty.call(OUTSIDE, c) || (Number.isSafeInteger(c) && c >= 0 && c <= 36);
  function rouletteMultiplier(choice, n) {
    if (typeof choice === 'number') return choice === n ? 36 : 0;
    return OUTSIDE[choice](n) ? 2 : 0;
  }
  function spinRoulette(bet, choice, rnd = Math.random) {
    if (!validBet(bet) || !validChoice(choice)) return null;
    const n = Math.min(36, Math.floor(Math.max(0, rnd()) * 37));
    const mult = rouletteMultiplier(choice, n);
    return { n, color: colorOf(n), mult, payout: bet * mult };
  }
  function rouletteRtp(choice) {
    let r = 0;
    for (let n = 0; n <= 36; n++) r += rouletteMultiplier(choice, n) / 37;
    return r;
  }

  const api = Object.freeze({ MIN_BET, MAX_BET, SYMBOLS, TWO_CHERRIES, validBet, spinSlots, slotsMultiplier, slotsRtp, RED, colorOf, validChoice, spinRoulette, rouletteRtp });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftCasinoRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
