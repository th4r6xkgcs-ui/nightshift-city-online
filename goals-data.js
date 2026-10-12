/* Goals & milestones catalog (Claude-owned). Pure data: tune here.
 * Each goal: progress(ctx) -> [current, target]; done when current >= target.
 * ctx is built by goals.js from public game state (see goals.js `snapshot`).
 * Rewards: cash plus optional skill XP (NightshiftSkills.gain).
 * place: where the goal happens; goals.js resolves it live and the tracker arrow points there. */
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
    { id: 'car', place: 'car', tier: 'Start', title: 'Get behind the wheel', hint: 'Walk up to a car you own or steal and press USE.',
      progress: (c) => [has(c.inCar || c.drove), 1], reward: { cash: 50, xp: { driving: 30 } } },
    { id: 'delivery1', place: 'job', tier: 'Start', title: 'First delivery', hint: 'MORE → JOB, follow the GPS to the pickup, then the drop-off.',
      progress: (c) => [Math.min(c.delivery, 1), 1], reward: { cash: 100, xp: { charisma: 30 } } },
    { id: 'salvage1', place: 'salvage', tier: 'Start', title: 'Scavenge', hint: 'Find a SALVAGE CRATE and press SEARCH.',
      progress: (c) => [Math.min(c.salvage, 1), 1], reward: { cash: 60, xp: { luck: 30 } } },
    { id: 'home', place: 'apartment', tier: 'Start', title: 'A place of your own', hint: 'MORE → HOME to buy your apartment. Deliveries pay for it.',
      progress: (c) => [has(c.home), 1], reward: { cash: 250, xp: { charisma: 40 } } },
    { id: 'batch1', place: 'property', tier: 'Start', title: 'Start farming', hint: 'MORE → BIZ: own a property, start a batch, collect it.',
      progress: (c) => [Math.min(c.batches, 1), 1], reward: { cash: 150, xp: { farming: 60 } } },
    { id: 'sale1', place: 'dealer', tier: 'Start', title: 'First sale', hint: 'MORE → BIZ: sell product at a street market.',
      progress: (c) => [Math.min(c.sold, 1), 1], reward: { cash: 100, xp: { dealing: 50 } } },

    // ---- hustle ----
    { id: 'delivery5', place: 'job', tier: 'Hustle', title: 'City courier', hint: 'Finish 5 deliveries (MORE → JOB).',
      progress: (c) => [Math.min(c.delivery, 5), 5], reward: { cash: 300, xp: { driving: 80 } } },
    { id: 'earn5k', tier: 'Hustle', title: 'Pocket money', hint: 'Earn $5,000 in total from any hustle.',
      progress: (c) => [Math.min(c.earned, 5000), 5000], reward: { cash: 500 } },
    { id: 'car2', place: 'garage', tier: 'Hustle', title: 'Second ride', hint: 'MORE → CAR to buy another car near the garage.',
      progress: (c) => [Math.min(c.carsOwned, 2), 2], reward: { cash: 300, xp: { driving: 60 } } },
    { id: 'skill5', tier: 'Hustle', title: 'Getting good', hint: 'Get any skill to level 5 (⭐ SKILLS).',
      progress: (c) => [Math.min(c.maxSkill, 5), 5], reward: { cash: 300 } },
    { id: 'salvage10', place: 'salvage', tier: 'Hustle', title: 'Scrapper', hint: 'Search 10 salvage crates.',
      progress: (c) => [Math.min(c.salvage, 10), 10], reward: { cash: 400, xp: { luck: 120 } } },
    { id: 'escape1', tier: 'Hustle', title: 'Lose the cops', hint: 'Get wanted, then lose the police until heat clears.',
      progress: (c) => [Math.min(c.escapes, 1), 1], reward: { cash: 250, xp: { stealth: 80 } } },
    { id: 'casino1', place: 'casino', tier: 'Hustle', title: 'Feeling lucky', hint: 'Win a bet at the LUCKY 7 CASINO (east side, by the docks).',
      progress: (c) => [Math.min(c.casinoWins, 1), 1], reward: { cash: 200, xp: { luck: 60 } } },
    { id: 'gun1', place: 'gunshop', tier: 'Hustle', title: 'Armed and dangerous', hint: 'Buy a new gun at the GUN SHOP (north-east). Needs Shooting Lv 2+.',
      progress: (c) => [Math.min(c.weaponsOwned, 2), 2], reward: { cash: 300, xp: { shooting: 80 } } },
    { id: 'tune1', place: 'garage', tier: 'Hustle', title: 'Tuned up', hint: 'Park your car by a GARAGE and buy any upgrade at TUNING.',
      progress: (c) => [Math.min(c.tuneLevels, 1), 1], reward: { cash: 250, xp: { driving: 80 } } },
    { id: 'race1', place: 'race', tier: 'Hustle', title: 'Street racer', hint: 'Win any medal in a street race. Drive into a 🏁 start ring and stop.',
      progress: (c) => [Math.min(c.raceMedals, 1), 1], reward: { cash: 300, xp: { driving: 100 } } },
    { id: 'homeUp1', place: 'apartment', tier: 'Hustle', title: 'Make it yours', hint: 'Buy a home upgrade at the LAPTOP in your apartment.',
      progress: (c) => [Math.min(c.homeItems, 1), 1], reward: { cash: 300, xp: { charisma: 80 } } },
    { id: 'sold25', place: 'dealer', tier: 'Hustle', title: 'Street supplier', hint: 'Sell 25 units of product.',
      progress: (c) => [Math.min(c.sold, 25), 25], reward: { cash: 750, xp: { dealing: 150 } } },
    { id: 'batch5', place: 'property', tier: 'Hustle', title: 'Green thumb', hint: 'Finish 5 grow batches.',
      progress: (c) => [Math.min(c.batches, 5), 5], reward: { cash: 750, xp: { farming: 200 } } },

    // ---- rising ----
    { id: 'total25', tier: 'Rising', title: 'All-rounder', hint: 'Reach a total skill level of 25.',
      progress: (c) => [Math.min(c.totalLevel, 25), 25], reward: { cash: 1000 } },
    { id: 'earn25k', tier: 'Rising', title: 'Making moves', hint: 'Earn $25,000 in total.',
      progress: (c) => [Math.min(c.earned, 25000), 25000], reward: { cash: 2000 } },
    { id: 'property2', place: 'property', tier: 'Rising', title: 'Landlord', hint: 'Own 2 business properties (MORE → BIZ).',
      progress: (c) => [Math.min(c.properties, 2), 2], reward: { cash: 2000, xp: { charisma: 200 } } },
    { id: 'delivery25', place: 'job', tier: 'Rising', title: 'Known on every block', hint: 'Finish 25 deliveries.',
      progress: (c) => [Math.min(c.delivery, 25), 25], reward: { cash: 1500, xp: { driving: 300 } } },
    { id: 'skill10', tier: 'Rising', title: 'Skilled', hint: 'Get any skill to level 10.',
      progress: (c) => [Math.min(c.maxSkill, 10), 10], reward: { cash: 1500 } },
    { id: 'escape5', tier: 'Rising', title: 'Ghost', hint: 'Lose the police 5 times.',
      progress: (c) => [Math.min(c.escapes, 5), 5], reward: { cash: 1500, xp: { stealth: 300 } } },

    { id: 'highRoller', place: 'casino', tier: 'Rising', title: 'High roller', hint: 'Wager $25,000 in total at the casino.',
      progress: (c) => [Math.min(c.casinoWagered, 25000), 25000], reward: { cash: 1500, xp: { luck: 300 } } },

    // ---- kingpin ----
    { id: 'fish50', place: 'fishing', tier: 'Rising', title: 'Angler', hint: 'Land 50 catches.',
      progress: (c) => [Math.min(c.fishCaught, 50), 50], reward: { cash: 2000, xp: { fishing: 400 } } },

    { id: 'jobs25', tier: 'Rising', title: 'Fixer', hint: 'Finish 25 Hustle phone jobs.',
      progress: (c) => [Math.min(c.jobsDone, 25), 25], reward: { cash: 3000, xp: { charisma: 300 } } },
    { id: 'heist1', place: 'bank', tier: 'Rising', title: 'Bank job', hint: 'Rob a bank vault and get away with the bag (USE: HEIST, needs a gun).',
      progress: (c) => [Math.min(c.heists, 1), 1], reward: { cash: 2500, xp: { stealth: 300 } } },
    { id: 'event1', tier: 'Rising', title: 'Opportunist', hint: 'Finish a 🌆 CITY EVENT (they pop up every few minutes; follow the cyan arrow).',
      progress: (c) => [Math.min(c.eventsDone, 1), 1], reward: { cash: 800, xp: { luck: 200 } } },
    { id: 'front1', tier: 'Rising', title: 'Going legit', hint: 'Buy a front business: 📱 HUSTLE → 📈 EMPIRE.',
      progress: (c) => [Math.min(c.fronts, 1), 1], reward: { cash: 3000, xp: { charisma: 300 } } },
    { id: 'cars3', place: 'garage', tier: 'Kingpin', title: 'Collector', hint: 'Own 3 cars.',
      progress: (c) => [Math.min(c.carsOwned, 3), 3], reward: { cash: 3000 } },
    { id: 'earn100k', tier: 'Kingpin', title: 'Six figures', hint: 'Earn $100,000 in total.',
      progress: (c) => [Math.min(c.earned, 100000), 100000], reward: { cash: 10000 } },
    { id: 'total100', tier: 'Kingpin', title: 'Seasoned', hint: 'Reach a total skill level of 100.',
      progress: (c) => [Math.min(c.totalLevel, 100), 100], reward: { cash: 10000 } },
    { id: 'skill25', tier: 'Kingpin', title: 'Expert', hint: 'Get any skill to level 25.',
      progress: (c) => [Math.min(c.maxSkill, 25), 25], reward: { cash: 8000 } },
    { id: 'arsenal', place: 'gunshop', tier: 'Kingpin', title: 'Arsenal', hint: 'Own all 6 guns.',
      progress: (c) => [Math.min(c.weaponsOwned, 6), 6], reward: { cash: 10000, xp: { shooting: 1000 } } },
    { id: 'fullyLoaded', place: 'garage', tier: 'Kingpin', title: 'Fully loaded', hint: 'Max engine, handling and armor on one car.',
      progress: (c) => [Math.min(c.tuneBestCar, 9), 9], reward: { cash: 8000, xp: { driving: 800 } } },
    { id: 'raceGold', place: 'race', tier: 'Kingpin', title: 'Gold rush', hint: 'Get gold in all 3 street races.',
      progress: (c) => [Math.min(c.raceGolds, 3), 3], reward: { cash: 6000, xp: { driving: 900 } } },
    { id: 'homeAll', place: 'apartment', tier: 'Kingpin', title: 'Penthouse vibes', hint: 'Install all 5 home upgrades.',
      progress: (c) => [Math.min(c.homeItems, 5), 5], reward: { cash: 5000, xp: { charisma: 600 } } },
    { id: 'respectBoss', tier: 'Kingpin', title: 'Made it', hint: 'Reach the BOSS Respect rank (tap your rank badge).',
      progress: (c) => [Math.min(c.respectRank, 4), 4], reward: { cash: 7500 } },
    { id: 'koi', place: 'fishing', tier: 'Legend', title: 'The golden one', hint: 'Catch the legendary Golden koi. Better rods and night help.',
      progress: (c) => [Math.min(c.koi, 1), 1], reward: { cash: 15000, xp: { fishing: 2000 } } },
    { id: 'heist10', place: 'bank', tier: 'Kingpin', title: 'Public enemy', hint: 'Pull off 10 bank heists.',
      progress: (c) => [Math.min(c.heists, 10), 10], reward: { cash: 20000, xp: { shooting: 1000, stealth: 1000 } } },
    { id: 'event25', tier: 'Kingpin', title: 'Always first on scene', hint: 'Finish 25 city events.',
      progress: (c) => [Math.min(c.eventsDone, 25), 25], reward: { cash: 12000, xp: { luck: 1200, driving: 600 } } },
    { id: 'tycoon', tier: 'Legend', title: 'Tycoon', hint: 'Own all 5 front businesses.',
      progress: (c) => [Math.min(c.fronts, 5), 5], reward: { cash: 100000, xp: { charisma: 3000 } } },
    { id: 'earn1m', tier: 'Legend', title: 'Millionaire', hint: 'Earn $1,000,000 in total.',
      progress: (c) => [Math.min(c.earned, 1000000), 1000000], reward: { cash: 50000 } },
    { id: 'skill50', tier: 'Legend', title: 'Legend', hint: 'Max any skill (level 50).',
      progress: (c) => [Math.min(c.maxSkill, 50), 50], reward: { cash: 50000 } },
  ];

  const api = Object.freeze({ GOALS });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftGoalsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
