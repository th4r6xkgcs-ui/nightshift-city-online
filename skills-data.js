/* RPG skills catalog (Claude-owned). Pure data: balance everything here.
 * Each skill levels 1..MAX_LEVEL from XP. Each level adds `per` to every perk
 * key it owns (mod = 1 + per * (level - 1), clamped to [min, max]).
 * Codex multiplies gameplay values by NightshiftSkills.mod(key); see GAME_VISION.md. */
(function (root) {
  'use strict';
  const MAX_LEVEL = 50;
  const TITLES = [[1, 'Rookie'], [10, 'Skilled'], [20, 'Expert'], [30, 'Veteran'], [40, 'Master'], [50, 'Legend']];

  const SKILLS = [
    { id: 'shooting', name: 'Shooting', icon: '🎯', desc: 'Hit harder and reload faster.',
      earn: 'Fire your weapon; land hits.',
      perks: [
        { key: 'shooting.damage', label: 'Damage', per: 0.02, max: 2.0 },
        { key: 'shooting.reload', label: 'Reload time', per: -0.008, min: 0.6 },
        { key: 'shooting.spread', label: 'Spread', per: -0.012, min: 0.4 },
      ] },
    { id: 'athletics', name: 'Speed', icon: '🏃', desc: 'Run faster and longer.',
      earn: 'Run on foot.',
      perks: [
        { key: 'athletics.speed', label: 'Run speed', per: 0.006, max: 1.3 },
        { key: 'athletics.stamina', label: 'Stamina', per: 0.015, max: 1.75 },
      ] },
    { id: 'driving', name: 'Driving', icon: '🚗', desc: 'Faster cars, tighter handling, tougher crashes.',
      earn: 'Drive; finish deliveries.',
      perks: [
        { key: 'driving.topSpeed', label: 'Top speed', per: 0.006, max: 1.3 },
        { key: 'driving.handling', label: 'Handling', per: 0.008, max: 1.4 },
        { key: 'driving.crashDamage', label: 'Crash damage taken', per: -0.01, min: 0.5 },
      ] },
    { id: 'luck', name: 'Luck', icon: '🍀', desc: 'Better finds, more rare loot, an edge at the casino.',
      earn: 'Search salvage; play the casino (coming).',
      perks: [
        { key: 'luck.rare', label: 'Rare find chance', per: 0.02, max: 2.0 },
        { key: 'luck.salvage', label: 'Salvage value', per: 0.01, max: 1.5 },
        { key: 'luck.casino', label: 'Casino edge', per: 0.002, max: 1.1 },
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
    { id: 'toughness', name: 'Toughness', icon: '🛡️', desc: 'More health, less damage.',
      earn: 'Take hits and survive.',
      perks: [
        { key: 'toughness.maxHp', label: 'Max health', per: 0.01, max: 1.5 },
        { key: 'toughness.damageTaken', label: 'Damage taken', per: -0.006, min: 0.7 },
      ] },
    { id: 'stealth', name: 'Stealth', icon: '🕶️', desc: 'Less heat, police lose you faster.',
      earn: 'Escape the police.',
      perks: [
        { key: 'stealth.heat', label: 'Heat gained', per: -0.01, min: 0.5 },
        { key: 'stealth.search', label: 'Police search time', per: -0.01, min: 0.5 },
      ] },
    { id: 'charisma', name: 'Charisma', icon: '🤝', desc: 'Better shop prices and crew trust.',
      earn: 'Finish deliveries and deals.',
      perks: [
        { key: 'charisma.shopPrice', label: 'Shop prices', per: -0.006, min: 0.7 },
        { key: 'charisma.trust', label: 'Crew trust gained', per: 0.015, max: 1.75 },
      ] },
  ];

  // XP needed to go from `level` to `level + 1`.
  const xpToNext = (level) => Math.round(40 * Math.pow(level, 1.55));

  // XP awarded by observed actions (tunable).
  const XP = Object.freeze({
    shot: 2,                 // each round fired
    run100px: 3,             // per 100px run on foot
    drive100px: 1,           // per 100px driven
    delivery: { driving: 40, charisma: 25 },
    salvage: { luck: 30 },
    batch: { farming: 45 },  // per finished grow batch
    soldUnit: { dealing: 6, charisma: 2 },
    damage1hp: 1.2,          // toughness per HP lost (survived)
    escape: { stealth: 60 }, // police heat back to zero after being wanted
  });

  const api = Object.freeze({ MAX_LEVEL, TITLES, SKILLS, xpToNext, XP });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftSkillsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
