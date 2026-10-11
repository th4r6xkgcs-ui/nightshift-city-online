/* Goals & milestones catalog (Claude-owned). Pure data: tune here.
 * Each goal: progress(ctx) -> [current, target]; done when current >= target.
 * ctx is built by goals.js from public game state (see goals.js `snapshot`).
 * Rewards: cash plus optional skill XP (NightshiftSkills.gain). */
(function (root) {
  'use strict';
  const has = (v) => (v ? 1 : 0);
  // Tutorial goals come first and teach one system each; milestones keep the grind going.
  const GOALS = [
    // ---- first session ----
    { id: 'walk', tier: 'Start', title: 'Hit the streets', hint: 'Move with the left stick (WASD on keyboard).',
      progress: (c) => [Math.min(c.walked, 400), 400], reward: { cash: 25, xp: { athletics: 30 } } },
    { id: 'shoot', tier: 'Start', title: 'Test your piece', hint: 'Aim with the right stick and FIRE a few rounds.',
      progress: (c) => [Math.min(c.shots, 5), 5], reward: { cash: 25, xp: { shooting: 20 } } },
    { id: 'car', tier: 'Start', title: 'Get behind the wheel', hint: 'Walk up to a car you own or steal and press USE.',
      progress: (c) => [has(c.inCar || c.drove), 1], reward: { cash: 50, xp: { driving: 30 } } },
    { id: 'delivery1', tier: 'Start', title: 'First delivery', hint: 'MORE → JOB, follow the GPS to the pickup, then the drop-off.',
      progress: (c) => [Math.min(c.delivery, 1), 1], reward: { cash: 100, xp: { charisma: 30 } } },
    { id: 'salvage1', tier: 'Start', title: 'Scavenge', hint: 'Find a SALVAGE CRATE and press SEARCH.',
      progress: (c) => [Math.min(c.salvage, 1), 1], reward: { cash: 60, xp: { luck: 30 } } },
    { id: 'home', tier: 'Start', title: 'A place of your own', hint: 'MORE → HOME to buy your apartment. Deliveries pay for it.',
      progress: (c) => [has(c.home), 1], reward: { cash: 250, xp: { charisma: 40 } } },
    { id: 'batch1', tier: 'Start', title: 'Start farming', hint: 'MORE → BIZ: own a property, start a batch, collect it.',
      progress: (c) => [Math.min(c.batches, 1), 1], reward: { cash: 150, xp: { farming: 60 } } },
    { id: 'sale1', tier: 'Start', title: 'First sale', hint: 'MORE → BIZ: sell product at a street market.',
      progress: (c) => [Math.min(c.sold, 1), 1], reward: { cash: 100, xp: { dealing: 50 } } },

    // ---- hustle ----
    { id: 'delivery5', tier: 'Hustle', title: 'City courier', hint: 'Finish 5 deliveries (MORE → JOB).',
      progress: (c) => [Math.min(c.delivery, 5), 5], reward: { cash: 300, xp: { driving: 80 } } },
    { id: 'earn5k', tier: 'Hustle', title: 'Pocket money', hint: 'Earn $5,000 in total from any hustle.',
      progress: (c) => [Math.min(c.earned, 5000), 5000], reward: { cash: 500 } },
    { id: 'car2', tier: 'Hustle', title: 'Second ride', hint: 'MORE → CAR to buy another car near the garage.',
      progress: (c) => [Math.min(c.carsOwned, 2), 2], reward: { cash: 300, xp: { driving: 60 } } },
    { id: 'skill5', tier: 'Hustle', title: 'Getting good', hint: 'Get any skill to level 5 (⭐ SKILLS).',
      progress: (c) => [Math.min(c.maxSkill, 5), 5], reward: { cash: 300 } },
    { id: 'salvage10', tier: 'Hustle', title: 'Scrapper', hint: 'Search 10 salvage crates.',
      progress: (c) => [Math.min(c.salvage, 10), 10], reward: { cash: 400, xp: { luck: 120 } } },
    { id: 'escape1', tier: 'Hustle', title: 'Lose the cops', hint: 'Get wanted, then lose the police until heat clears.',
      progress: (c) => [Math.min(c.escapes, 1), 1], reward: { cash: 250, xp: { stealth: 80 } } },
    { id: 'sold25', tier: 'Hustle', title: 'Street supplier', hint: 'Sell 25 units of product.',
      progress: (c) => [Math.min(c.sold, 25), 25], reward: { cash: 750, xp: { dealing: 150 } } },
    { id: 'batch5', tier: 'Hustle', title: 'Green thumb', hint: 'Finish 5 grow batches.',
      progress: (c) => [Math.min(c.batches, 5), 5], reward: { cash: 750, xp: { farming: 200 } } },

    // ---- rising ----
    { id: 'total25', tier: 'Rising', title: 'All-rounder', hint: 'Reach a total skill level of 25.',
      progress: (c) => [Math.min(c.totalLevel, 25), 25], reward: { cash: 1000 } },
    { id: 'earn25k', tier: 'Rising', title: 'Making moves', hint: 'Earn $25,000 in total.',
      progress: (c) => [Math.min(c.earned, 25000), 25000], reward: { cash: 2000 } },
    { id: 'property2', tier: 'Rising', title: 'Landlord', hint: 'Own 2 business properties (MORE → BIZ).',
      progress: (c) => [Math.min(c.properties, 2), 2], reward: { cash: 2000, xp: { charisma: 200 } } },
    { id: 'delivery25', tier: 'Rising', title: 'Known on every block', hint: 'Finish 25 deliveries.',
      progress: (c) => [Math.min(c.delivery, 25), 25], reward: { cash: 1500, xp: { driving: 300 } } },
    { id: 'skill10', tier: 'Rising', title: 'Skilled', hint: 'Get any skill to level 10.',
      progress: (c) => [Math.min(c.maxSkill, 10), 10], reward: { cash: 1500 } },
    { id: 'escape5', tier: 'Rising', title: 'Ghost', hint: 'Lose the police 5 times.',
      progress: (c) => [Math.min(c.escapes, 5), 5], reward: { cash: 1500, xp: { stealth: 300 } } },

    // ---- kingpin ----
    { id: 'cars3', tier: 'Kingpin', title: 'Collector', hint: 'Own 3 cars.',
      progress: (c) => [Math.min(c.carsOwned, 3), 3], reward: { cash: 3000 } },
    { id: 'earn100k', tier: 'Kingpin', title: 'Six figures', hint: 'Earn $100,000 in total.',
      progress: (c) => [Math.min(c.earned, 100000), 100000], reward: { cash: 10000 } },
    { id: 'total100', tier: 'Kingpin', title: 'Seasoned', hint: 'Reach a total skill level of 100.',
      progress: (c) => [Math.min(c.totalLevel, 100), 100], reward: { cash: 10000 } },
    { id: 'skill25', tier: 'Kingpin', title: 'Expert', hint: 'Get any skill to level 25.',
      progress: (c) => [Math.min(c.maxSkill, 25), 25], reward: { cash: 8000 } },
    { id: 'earn1m', tier: 'Legend', title: 'Millionaire', hint: 'Earn $1,000,000 in total.',
      progress: (c) => [Math.min(c.earned, 1000000), 1000000], reward: { cash: 50000 } },
    { id: 'skill50', tier: 'Legend', title: 'Legend', hint: 'Max any skill (level 50).',
      progress: (c) => [Math.min(c.maxSkill, 50), 50], reward: { cash: 50000 } },
  ];

  const api = Object.freeze({ GOALS });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftGoalsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
