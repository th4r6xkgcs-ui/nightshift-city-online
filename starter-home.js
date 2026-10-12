/* Starter apartment (Claude-owned). Loads BEFORE the game modules (build-online EARLY_SCRIPTS).
 * Every player owns the Midtown apartment from the start, because that is where the game begins
 * (life.js spawns you inside it). Writes the ownership flag into the activities save before
 * activities.js reads it; keeps the courier job progress untouched. */
(function (root) {
  'use strict';
  const KEY = 'nightshift-city-activities-v1';
  try {
    const ls = root.localStorage; if (!ls) return;
    let d = {}; try { d = JSON.parse(ls.getItem(KEY) || '{}') || {}; } catch { d = {}; }
    if (d.owned !== true) { d.owned = true; ls.setItem(KEY, JSON.stringify(d)); }
    root.NightshiftStarterHome = Object.freeze({ owned: true });
  } catch { /* storage blocked: the HOME purchase flow still works */ }
})(typeof globalThis !== 'undefined' ? globalThis : this);
