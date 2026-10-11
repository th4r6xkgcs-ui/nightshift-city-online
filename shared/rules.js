// Nightshift City Online — shared game rules.
// Single source of truth for numbers the server enforces. Values mirror the
// current client (codex/mobile-controls-v03, v0.17) so single-player and
// online play feel identical. Works in Node (require) and the browser (global).
(function (root) {
  'use strict';
  const RULES = Object.freeze({
    world: Object.freeze({ w: 2200, h: 1700 }),
    spawn: Object.freeze({ x: 460, y: 450 }),
    hospital: Object.freeze({ x: 440, y: 340, maxFee: 100, respawnMs: 3000 }),

    player: Object.freeze({
      maxHp: 100,
      startCash: 750,
      startPocket: Object.freeze({ scrap: 2, watch: 1, pistol: 1 }), // client fresh save
      radius: 14,
      walkPxPerSec: 180, // client: 3 px per 60fps tick
      runPxPerSec: 300,  // client: 5 px per 60fps tick
    }),

    combat: Object.freeze({
      magSize: 30,
      maxReserve: 240,
      maxCarriedRounds: 270,
      reloadMs: 1300,
      fireIntervalMs: 180,
      damage: 20,
      rangePx: 520,
      startMagazine: 30,
      startReserve: 90,
    }),

    shop: Object.freeze({
      ammoPerRound: 2,
      ammoPackRounds: 30,
      firstAid: 40,      // instant +40 hp
      firstAidHeal: 40,
      pistol: 150,
      medkit: 60,        // carried item, +40 hp when used
      medkitHeal: 40,
      sell: Object.freeze({ scrap: 15, watch: 85, jewelry: 200 }),
    }),

    items: Object.freeze(['scrap', 'watch', 'medkit', 'jewelry', 'pistol', 'parcel']),
    itemCap: 999,
    cashCap: 100000000,

    bags: Object.freeze({ lifetimeMs: 120000, pickupRangePx: 48 }),
    // Starter apartment (location/radius come from the city layout).
    home: Object.freeze({ price: 1200, stashCashCap: 100000000, stashAmmoCap: 270, stashItemCap: 999 }),
    transfer: Object.freeze({ rangePx: 60, maxPerTransfer: 10000 }),
    // Text chat. "near" reaches players within nearRangePx, "city" everyone.
    chat: Object.freeze({ maxLen: 120, nearRangePx: 600, burst: 3, perSec: 1 }),
    // Shared-world ("presence") mode for the real game while its economy and
    // combat are still local: the client reports its position; the server
    // accepts only physically possible moves (cars included).
    presence: Object.freeze({ maxSpeedPxPerSec: 480, slackPx: 40, anchorRangePx: 150, resyncAfterMs: 2000 }),
    // Online delivery jobs between building entrances (server-chosen).
    jobs: Object.freeze({
      basePay: 150, payPerPx: 0.15, maxPay: 450, minDistancePx: 500,
      rangePx: 60, timeLimitMs: 300000, cooldownMs: 15000, cancelCooldownMs: 5000,
    }),

    net: Object.freeze({
      tickHz: 20,
      interestRadiusPx: 900,
      maxMsgsPerSec: 60,
      maxMsgBytes: 2048,
      maxStrikes: 20,
      txMemory: 256,
    }),
  });

  if (typeof module === 'object' && module.exports) module.exports = RULES;
  else root.NightshiftRules = RULES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
