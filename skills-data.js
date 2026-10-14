/* RPG skills catalog (Claude-owned). Pure data: balance everything here.
 * Each skill levels 1..MAX_LEVEL from XP. Each level adds `per` to every perk
 * key it owns (mod = 1 + per * (level - 1), clamped to [min, max]).
 * Effects are applied in game by skill-effects.js (Claude-owned wrappers); Codex does not
 * need to call mod() itself. Optional `show(m)` formats a perk for the panel. */
(function (root) {
  'use strict';
  const MAX_LEVEL = 50;
  const TITLES = [[1, 'Rookie'], [10, 'Skilled'], [20, 'Expert'], [30, 'Veteran'], [40, 'Master'], [50, 'Legend']];

  const SKILLS = [
    { id: 'shooting', name: 'Shooting', icon: '🎯', desc: 'Hit harder and reload faster.',
      earn: 'Fire your weapon.',
      perks: [
        { key: 'shooting.damage', label: 'Damage', per: 0.02, max: 2.0 },
        { key: 'shooting.reload', label: 'Reload time', per: -0.008, min: 0.6 },
      ] },
    { id: 'athletics', name: 'Speed', icon: '🏃', desc: 'Run faster and longer.',
      earn: 'Run on foot.',
      perks: [
        { key: 'athletics.speed', label: 'Run speed', per: 0.006, max: 1.3 },
        { key: 'athletics.stamina', label: 'Sprint stamina', per: 0.015, max: 1.75 },
      ] },
    { id: 'driving', name: 'Driving', icon: '🚗', desc: 'Faster cars, tighter handling, tougher crashes.',
      earn: 'Drive; finish deliveries.',
      perks: [
        { key: 'driving.topSpeed', label: 'Top speed', per: 0.006, max: 1.3 },
        { key: 'driving.handling', label: 'Handling', per: 0.008, max: 1.4 },
        { key: 'driving.crashDamage', label: 'Crash damage taken', per: -0.01, min: 0.5 },
      ] },
    { id: 'luck', name: 'Luck', icon: '🍀', desc: 'Lucky cash finds and bigger slot wins.',
      earn: 'Search salvage crates; bet at the casino.',
      perks: [
        { key: 'luck.rare', label: 'Lucky find chance', per: 0.02, max: 2.0, show: (m) => `${Math.round((m - 1) * 50)}% per salvage` },
        { key: 'luck.salvage', label: 'Lucky find value', per: 0.02, max: 2.0 },
        { key: 'luck.casino', label: 'Slot winnings', per: 0.0016, max: 1.08 },
      ] },
    { id: 'farming', name: 'Farming', icon: '🌿', desc: 'Bigger harvests, faster growth.',
      earn: 'Complete grow batches.',
      perks: [
        { key: 'farming.yield', label: 'Yield', per: 0.015, max: 1.75 },
        { key: 'farming.growTime', label: 'Grow time', per: -0.01, min: 0.5 },
      ] },
    { id: 'dealing', name: 'Dealing', icon: '💰', desc: 'Sell for more, draw less heat.',
      earn: 'Sell product to buyers.',
      perks: [
        { key: 'dealing.price', label: 'Sale price', per: 0.012, max: 1.6 },
        { key: 'dealing.heat', label: 'Heat per sale', per: -0.01, min: 0.5 },
      ] },
    { id: 'toughness', name: 'Toughness', icon: '🛡️', desc: 'Take less damage and heal over time.',
      earn: 'Take hits and survive.',
      perks: [
        { key: 'toughness.regen', label: 'Health regen', per: 0.02, max: 2.0, show: (m) => `${((m - 1) * 1.5).toFixed(1)} HP/s out of combat` },
        { key: 'toughness.damageTaken', label: 'Damage taken', per: -0.006, min: 0.7 },
      ] },
    { id: 'stealth', name: 'Stealth', icon: '🕶️', desc: 'Gain less heat and cool down faster.',
      earn: 'Escape the police.',
      perks: [
        { key: 'stealth.heat', label: 'Heat gained', per: -0.01, min: 0.5 },
        { key: 'stealth.cooldown', label: 'Heat cooldown speed', per: 0.02, max: 2.0 },
      ] },
    { id: 'charisma', name: 'Charisma', icon: '🤝', desc: 'Better business prices and delivery pay.',
      earn: 'Finish deliveries and deals.',
      perks: [
        { key: 'charisma.shopPrice', label: 'Business buy prices', per: -0.006, min: 0.7 },
        { key: 'charisma.jobPay', label: 'Delivery pay', per: 0.015, max: 1.75 },
      ] },
    { id: 'fishing', name: 'Fishing', icon: '🎣', desc: 'Faster bites and rarer catches.',
      earn: 'Land fish at the Docks Pier or West Canal.',
      perks: [
        { key: 'fishing.bite', label: 'Bite wait', per: -0.01, min: 0.5 },
        { key: 'fishing.rare', label: 'Rare catch chance', per: 0.02, max: 2.0 },
      ] },
    { id: 'crafting', name: 'Crafting', icon: '🛠️', desc: 'Build guns and gear faster, and make them last longer.',
      earn: 'Craft guns, attachments and repairs at a workbench.',
      perks: [
        { key: 'crafting.speed', label: 'Craft time', per: -0.01, min: 0.5 },
        { key: 'crafting.durability', label: 'Gun durability', per: 0.01, max: 1.5 },
      ] },
  ];

  // XP needed to go from `level` to `level + 1`.
  const xpToNext = (level) => Math.round(40 * Math.pow(level, 1.55));

  // XP awarded by observed actions (tunable).
  const XP = Object.freeze({
    shot: 2,                 // each round fired
    hit: 5,                  // bonus per bullet that lands (skill-effects.js)
    run100px: 3,             // per 100px run on foot
    drive100px: 1,           // per 100px driven
    delivery: { driving: 40, charisma: 40 },
    salvage: { luck: 40 },
    batch: { farming: 120 }, // per finished grow batch (one batch per property at a time, so it must be meaty)
    soldUnit: { dealing: 20, charisma: 4 },
    damage1hp: 2,            // toughness per HP lost (survived)
    escape: { stealth: 150 }, // police heat back to zero after being wanted
  });
  // Pacing guard (tests/skills.cjs): with focused play, every skill reaches level 10 in roughly 15-90 minutes.
  // Assumed focused rates per minute (measured from game rules: market demand, batch timers, salvage cooldowns).
  const PACE = Object.freeze({
    shooting: 60 * 2 + 18 * 5,            // 60 shots, ~30% hits
    athletics: (10800 / 100) * 3,          // running ~180 px/s
    driving: (18000 / 100) * 1 + 40,      // ~300 px/s average + ~1 delivery/min
    luck: (8 / 3) * 40 + 16,               // 8 salvage spots on a 3 min cooldown + casino bets
    farming: 1.2 * 120,                    // ~1.2 finished batches/min with 3 properties
    dealing: 5 * 20,                       // market demand caps sales at ~5 units/min
    toughness: 30 * 2,                     // ~30 HP lost and survived per minute of fighting
    stealth: 0.5 * 150,                    // an escape every ~2 minutes
    charisma: 40 + 5 * 4 + 10,             // deliveries + sales + goal rewards
    fishing: 4 * 18,                       // ~4 landed fish per minute, ~18 XP each (fishing-data.js XP)
    crafting: 2 * 60,                      // ~2 crafts a minute when stocked, 4 XP per craft-second (supply.js)
  });

  const api = Object.freeze({ MAX_LEVEL, TITLES, SKILLS, xpToNext, XP, PACE });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftSkillsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
