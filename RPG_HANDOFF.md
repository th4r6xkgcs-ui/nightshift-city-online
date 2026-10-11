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

## Playable build: `claude/rpg-play`
`claude/online-play` (server + online layer) merged with `claude/rpg-core` (Codex v0.38 + skills/goals); the merge was clean.
`online/build-online.cjs` now injects the 4 RPG scripts before `boot.js` at build time (`withRpg`), so Codex's index.html is untouched. Any script it already lists is skipped.
Both `/` (online) and `/solo` in the Worker bundle include the RPG layer.
Checks on this branch:
- `node tests/run.cjs`: 61 suites PASS
- skills: 5 PASS; goals: 4 PASS
- server: 104 pass, 0 fail
- Playwright with two players (desktop and iPhone 844×390), local server: both online, movement synced, chat works, goal card and skills chip show, no page errors
Deploy: point Cloudflare Workers Builds at branch `claude/rpg-play`, root `worker`, deploy command `npx wrangler deploy`. Not deployed by Claude.
## Backlog: owner said "add later, don't forget" (2026-10-11)
- **Daily/weekly challenges**: 3 rotating daily jobs (e.g. "sell 10 units", "lose the cops twice") plus weekly ones, and a login-streak bonus.
- **Respect prestige rank**: a long-term rank on top of skills, for endgame grinding.

## Skill effects: `skill-effects.js` (Claude-owned)
Skill levels now change real gameplay by wrapping public module functions. No game file is edited.
**Codex: do NOT add `mod()` calls at your call sites**, because they would double-apply. If you change one of these functions or rename a hook, tell me in PR #3.

| Skill | Effect | Hook |
|---|---|---|
| Shooting | +2%/lv bullet damage (up to about 2×) | `NightshiftCrews.incident(target,'violence')`, `NightshiftCrime.strike` |
| Shooting | reload time down to 0.6× | `NightshiftCombat.begin` |
| Speed | run speed up to 1.3×, sprint stamina up to 1.75× | `NightshiftMovement.step` |
| Driving | top speed/accel up to 1.3×, steering up to 1.4×, crash damage down to 0.5× | `NightshiftVehicles.handling` / `.damage` (player car only) |
| Luck | up to 50% chance per salvage of a $30–100 (×value) cash find | `NightshiftProgress.award('salvage')` |
| Farming | grow time down to 0.5×, harvest yield up to 1.75× | `NightshiftBusinessRules.transact('start')` / `.advance` |
| Dealing | sale and rush-order pay up to 1.6×, heat per deal down to 0.5× | `NightshiftBusinessRules.transact` |
| Toughness | damage taken down to 0.7×, regen up to 1.5 HP/s after 8s without damage | `NightshiftRecovery.damage`, observer |
| Stealth | heat gained down to 0.5×, heat cooldown up to 2× | observer on `player.heat` |
| Charisma | business buy prices down to 0.7×, delivery pay up to 1.75× | `transact` buy/purchase/upgrade/start, `award('delivery')` |

Verified in browser (level 1 vs maxed): all 10 wrappers install. Level 1 values are identical to the original game. At max:
- walk speed 3 → 3.88
- reload 1300 → 790 ms
- selling 2 weed: $70 → $111, heat 0.4 → 0.10
- buying 2 weed: $90 → $64
- grow time 120 s → 61 s
- harvest 3 → 6
- ped HP after one hit 80 → 60.4 (game -20 included)
- crash damage −20 → −10
- 30 damage → 21
- heat +2 → +1
- $200 delivery → $347
- no page errors

Unit tests: tests/skill-effects.cjs, 2 PASS.

## Lucky 7 Casino: `casino-data.js` + `casino.js` (Claude-owned world feature)
- Location: the east CLUB (1840,1095), whose door is at (1960,1277). Codex's art already labels it CASINO, so I only add a sidewalk "LUCKY 7" marquee and a red carpet. It is reached with USE (action label CASINO) through wrapped `NightshiftEncounters.locations/use/draw`, so it also appears wherever encounter locations are listed (city map).
- Slots: 3 weighted reels. They return 89.6% at Luck 1 and at most 96.8% at max Luck (`luck.casino` perk on slot wins, capped at 1.08), so the house always keeps an edge and grinding can't be farmed for infinite money.
- Roulette: European wheel (97.3%), with red/black/odd/even/1–18/19–36 at 2× and single numbers at 36×. Luck has no effect.
- Bets are $10–$1,000, and each spin takes the bet and pays the win in a single step. Each bet gives Luck XP (bet/25, between 1 and 40). Security refuses entry while heat ≥ 1. The keyboard is captured while the panel is open, and Escape leaves.
- New goals: "Feeling lucky" (win one bet) and "High roller" (wager $25k). Save key: `nightshift-casino-v1`. Codex: please add it to backups.js KEYS.
- Also new: Shooting gets +5 XP for each bullet that lands (`skill-effects.js` hit hooks).
- Tests: tests/casino.cjs, 4 PASS (exact RTP enumeration, payouts, validation).
- Browser check on iPhone 13 landscape: USE shows CASINO at the door. Spins settle cash exactly. Roulette paid its win. The player didn't move while the panel was open. Escape closes the panel, entry is refused while wanted, and state persists. No page errors. Online two-player regression: OK.

## Weapons: `weapons-data.js` + `weapons.js` (Claude-owned)
| Gun | Price | Shooting Lv | Damage | Fire rate | Mag | Range | Notes |
|---|---|---|---|---|---|---|---|
| Street Pistol | starter | 1 | 20 | 180 ms | 30 | 450 | identical to the original game |
| Six-Shot Magnum | $900 | 2 | 45 | 420 ms | 6 | 560 | slight spread |
| Viper SMG | $1,500 | 4 | 13 | 85 ms | 30 | 380 | wide spread |
| Breaker 12 | $2,600 | 7 | 6×12 | 700 ms | 6 | 230 | 6 pellets per shell |
| Longshot DMR | $4,200 | 10 | 60 | 550 ms | 10 | 950 | pinpoint |
| Ridgeback AR | $8,000 | 15 | 22 | 115 ms | 30 | 650 | top tier |

How it works (no game files edited):
- **Fire rate:** sets game.js `nextShot` in a microtask after each shot. The shot is detected by wrapping `NightshiftFeedback.shot`.
- **Spread, pellets, range and speed:** the `bullets` array's `push` is patched on the instance and shapes only the player's bullet of that trigger pull.
- **Damage:** the skill-effects hit hooks use the equipped gun's damage × the Shooting perk.
- **Magazine:** wraps `NightshiftCombat.begin` (no reload when the mag is full) and `.finish` (returns extra rounds to the reserve). The HUD's "/30" is rewritten to the equipped magazine size.
- **Gun shop:** at the north-east CLOTHING (door 1960,597), with a sidewalk sign and USE action GUNS through `NightshiftEncounters`. It also sells a bulk ammo crate (60 rounds for $100).
- **Weapon button:** under the map label; tap or press Q to cycle owned guns. Owned guns persist (`nightshift-weapons-v1`), but you still need the carried pistol item to shoot, which keeps Codex's death/drop loop intact.
- **New goals:** "Armed and dangerous" (buy a gun) and "Arsenal" (own all 6).

Verified in browser:
- Shotgun: 6 pellets per shell, 700 ms between shots, HUD shows 6/6, reload fills 6 from the reserve.
- SMG: 85 ms; pistol: 180 ms.
- At Shooting Lv 41 a pistol hit does 36, and the DMR one-shots a 40 HP pedestrian.
- Buying and equipping persist. The weapon button doesn't overlap anything at 844×390 or 390×844. No page errors.
- Tests: tests/weapons.cjs, 3 PASS.

**Multiplayer note for later:** online PvP damage is server-authoritative and still uses the server's own weapon rules. When multiplayer resumes, the server sim needs this weapon table (shared/rules.js).

## Tuning garage: `tuning-data.js` + `tuning.js` (Claude-owned)
- A TUNE point sits beside each GARAGE door (x+90), with a "🔧 TUNING" sidewalk sign, through `NightshiftEncounters`. It works on any owned car parked within 260px of you.
- Engine: +8% top speed and acceleration per level. Handling: +10% steering per level. Armor: −15% crash (`Vehicles.damage`) and bullet (`Vehicles.hit`) damage per level. 3 levels each, priced $600–$4,500 with the Charisma discount. All of these apply only to the player's car and stack with the Driving skill.
- Paint costs $150 for 10 colors and sets `car.color`, which Codex's sprites draw and `nightshift-city-vehicles-v1` saves.
- Save: `nightshift-tuning-v1`, per car id. Goals: "Tuned up" and "Fully loaded".
- Verified in browser:
  - The TUNE USE point opens the panel, and upgrades and paint charge the correct cash.
  - At max engine the car tops out faster than a stock one. Armor 1 cuts crash damage 20 → 17.
  - Upgrades and paint persist across a reload. No page errors.
- Tests: tests/tuning.cjs, 3 PASS.
- UI: goal and level-up banners now sit at 68% and 84% of the screen height, so they never cover the game's toast or each other.
- v0.41 merged into `claude/rpg-play`; every hook was re-verified.

## Street races: `races-data.js` + `races.js` (Claude-owned)
- Three courses on road centre lines: **Midtown Loop** (start 880,680), **Docks Dash** (440,340 → 1760,1360) and **Grand Tour** (a 15-checkpoint lap from 440,1360). To start, drive into a 🏁 start ring and stop for 0.7 s, then the 3-2-1-GO countdown runs. Pass every checkpoint (radius 75); a guide arrow points to the next one. Leaving the car, wrecking, a false start or exceeding the DNF limit ends the race.
- Par/gold time = length/420 + turns×0.63 s, calibrated with an autopilot on the real physics:
  - A stock car driven near-perfectly gets **silver**: Loop 5.9 s vs gold 5.6, Docks 6.75 vs 6.2.
  - A maxed car with Driving 50 gets **gold**: Loop 4.5, Docks 4.6.
  - Bronze is par×1.6, friendly to touch controls.
- Payouts: gold pays 100% of the race reward ($700 / $1,200 / $2,200), silver 60%, bronze 35%. A new best medal tier pays full; a repeat pays half. Driving XP: 150, 260 and 450 × the medal factor. Cooldown: 90 s after a finish, 15 s after a DNF.
- Drawn by wrapping `NightshiftEncounters.draw` (world space): start rings show only within 600 px, and the next 2 checkpoints show while racing. The HUD bar sits at top: 58px.
- Save: `nightshift-races-v1` (best times, medals). Goals: "Street racer" and "Gold rush".
- Tests: tests/races.cjs, 3 PASS (every leg is a straight road segment, medals, payouts, save). Browser: autopilot runs with no page errors; screenshot verified.

## Home upgrades: `home-data.js` + `home-upgrades.js` (Claude-owned)
A **LAPTOP** desk is always in the apartment at room (400,262); USE → UPGRADES opens the furniture shop (Charisma discount applies). The five items and their perks:

| Item | Price | Perk |
|---|---|---|
| Memory-foam bed | $2,500 | REST gives "Well rested": +25% skill XP for 10 min (`NightshiftSkills.setBoost`), shown on the skills chip |
| Ammo locker | $1,800 | REST adds +60 spare rounds (10 min cooldown) |
| Grow tent | $3,000 | 1 weed every 4 min (max 6; faster with Farming; grows offline). HARVEST goes into the pocket and gives Farming XP |
| Police scanner | $4,000 | REST clears all heat (5 min cooldown) |
| Trophy shelf | $1,200 | +10% goal cash; shows race medal cups |

Hooks (no game files edited):
- wrapped `NightshiftHome.interaction` (nearest of Codex's targets and mine) and `.use` (laptop/tent intercepted; bed → Codex rest, then my perks)
- `NightshiftInteriors.draw('home')` for room-space furniture
- `NightshiftSprites.furniture` to draw the duvet on Codex's BED sprite
- `NightshiftSprites.person(roomPos, true, {weapon:false})` to read the room position

Verified in browser: laptop USE, buying all 5 items, the "Penthouse vibes" goal paying +$5,500 (trophy bonus), harvesting 6 weed, and a REST that gives HP 100, heat 0, +60 rounds and the 25% boost (100 XP → 125). No page errors. Tests: tests/home-upgrades.cjs, 4 PASS. Save: `nightshift-home-v1`. Goals: "Make it yours" and "Penthouse vibes".

v0.42 (awnings) merged into `claude/rpg-play`; all hooks re-verified, and every browser regression passed.

## Balance pass (economy + pacing)
**Income per minute of focused play** (measured from the game rules):

| Source | Income |
|---|---|
| Deliveries | about $300–450 (pay $225–300 per run) |
| Weed farm | about $75, passive |
| Salvage | small, but it feeds Luck |
| Casino | negative expected value (89.6–97.3% return) |
| Races, first medal | full reward |
| Races, repeats | now **30%** (was 50%); Grand Tour repeat gold ≈ $350/min, on par with deliveries |

**Money sinks:** guns $19.2k total; full tuning of one car $19.4k; home upgrades $12.5k; properties and upgrades. That's about 2–3 hours of grinding to own everything, before skills.

**Skill XP retuned:**
- batch farming 45 → 120
- dealing per unit 6 → 20
- charisma: delivery 25 → 40, per sale 2 → 4
- salvage luck 30 → 40
- toughness per HP 1.2 → 2
- stealth escape 60 → 150

New `PACE` table in skills-data.js and a test guarding that every skill reaches Lv 10 in 12–90 min of focused play. Current times: Speed 15, Driving 22, Shooting 23, Farming 34, Luck 40, Dealing 49, Stealth 65, Charisma 70, Toughness 81 minutes.
