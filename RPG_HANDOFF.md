# RPG systems handoff (Claude-owned)

Branch: `claude/rpg-core` (based on Codex v0.38 `codex/mockup-art-v38` @ c770e96).
Owner direction: single-player RPG grind first; multiplayer later, so keep it in mind.

## Files (Claude-owned, new)
| File | What |
|---|---|
| `skills-data.js` | Catalog and balance: 9 skills, perk keys, XP curve, XP awards |
| `skills.js` | Engine: XP from observed play, level-ups, ⭐ SKILLS chip and panel (K key). Save key `nightshift-skills-v1` |
| `goals-data.js` | 28 goals in tiers Start, Hustle, Rising, Kingpin and Legend, with cash and skill-XP rewards |
| `goals.js` | Engine: 🎯 NEXT GOAL card under the skills chip, goals panel (G key), completion banner. Save key `nightshift-goals-v1` |
| `tests/skills.cjs`, `tests/goals.cjs` | Node tests (5 + 4 PASS) |

Neither module edits game files. They read script globals (`player`, `cars`, `say`, `releaseControls`, `save`) and module state (`NightshiftProgress.state`, `NightshiftBusinesses.state`, `NightshiftActivities.ownsHome()`).

## Wiring (needs Codex OK, because index.html is Codex-owned)
Insert before `boot.js`:
```html
<script src="skills-data.js" defer></script><script src="skills.js" defer></script><script src="goals-data.js" defer></script><script src="goals.js" defer></script>
```
Add `nightshift-skills-v1` and `nightshift-goals-v1` to the `KEYS` list in `backups.js`.

## Contract for Codex
- Multiply gameplay values by `globalThis.NightshiftSkills?.mod(key) ?? 1`. The keys are listed in `skills-data.js`.
- Optional: call `NightshiftSkills.gain(skill, xp, reason)` for new content such as casino, farms or weapons. Add buttons for `NightshiftSkills.open()` and `NightshiftGoals.open()`.

## Verified (scratch copy of v0.38 with the 4 script lines injected, Playwright Chromium)
- 844×390 and 390×844 (iPhone 13 emulation): the goal card sits below the skills chip and is the topmost element. Hints are hidden at heights of 430px or less.
- Walking about 850px completes "Hit the streets" for +$25. 8 shots complete "Test your piece". Cash gains are counted as earnings, excluding goal payouts. Goals and stats persist across a reload. There were no page errors.
- Not verified: real iPhone touch, and the long-term balance of the reward pacing.

## Known limits
- Goal completion is capped at one per second, so veteran saves catch up gradually and get every reward once.
- `earned` ignores single jumps over $250k (backup restores).
- The panels don't pause the game.

## Backlog: owner said "add later, don't forget" (2026-10-11)
- **Daily/weekly challenges**: 3 rotating daily jobs (e.g. "sell 10 units", "lose the cops twice") plus weekly ones, and a login-streak bonus.
- **Respect prestige rank**: a long-term rank on top of skills, for endgame grinding.
- **City events** (`events*.js`): every 2.5–4 min (first one ~1 min after load), a timed event spawns on a road 35–130 m from the player. It doesn't spawn during a heist or race, and timers freeze while an RPG panel is open. You get a toast, a cyan dashed marker with a label plate, a cyan guide arrow (radius 66/90, outside the pink job arrow) and an `#evHud` countdown bar. In landscape the bar stacks above the job bar; in portrait it sits under it.
  - 💼 Briefcase: reach it for $300–900; 35% are hot (+1.5 heat and a theft report).
  - 🚚 Armored truck: stay within 90 px for 12 s for $1.5–3k. Progress decays when you step away, heat stays ≥ 2, and `Crime.report(...,'robbery')` fires every 4 s.
  - 🎁 Package: grab it, then deliver it ≥ 900 px away within 90 s. Pays $500 + distance/3 + $5 per second left.
  - 🏁 Sprint: drive into the start in a car, then pass 3 gates in order within 28 s. Pays $600 + $25 per second left; leaving the car fails it.
  - Pay is +5% per Respect rank, plus skill XP. API: `NightshiftEvents.{state, active, spawn(type), dismiss, next}`. Save (stats only): `nightshift-events-v1`, which needs adding to backups `KEYS`.
  - Wiring: goals `event1` "Opportunist" and `event25`; daily "Finish n city event(s)"; Respect source "City events" (10/event, cap 300); a lifetime stats row; a 🌆 LIVE entry at the top of the city guide.
  - Load order: `events-data.js`, `events.js` after `empire.js`.
  - Tests: `tests/events.cjs` (3 PASS). Browser: all 4 types complete at 844×390 and 390×844 with no page errors.
