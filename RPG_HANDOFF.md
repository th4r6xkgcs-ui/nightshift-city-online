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

## Goal tracker and discoverability
- Each goal has a `place` (car, job, salvage, apartment, property, dealer, garage, casino, gunshop or race). goals.js resolves it to a live position, and a pulsing **gold arrow** around the player points there (drawn by wrapping `NightshiftEncounters.draw`). It's hidden within 110 px of the target and during races. The goal card shows "📍 171m". Tap a goal in the panel to pin it; there's a TRACKER ON/OFF toggle. `pin` and `track` are saved.
- Race starts are now listed in `NightshiftEncounters.locations()` (type `race`), so they appear as dots on Codex's city map. USE on foot explains how to start a race.
- Midtown Loop now starts mid-block at (1100,680), because the old start, (880,680), was the apartment door and on-foot USE picked HOME. It now finishes at (880,680): par 5.1 s, 1,340 px.
- Tests: tests/goals.cjs adds a tracker case (5 PASS). Browser: the pin points to the casino door (1960,1277), the card shows the distance, and the arrow is visible in a screenshot. No page errors.

## Session 3 (owner: "overdrive", playable today)

### Play now
A private playable artifact of `claude/rpg-play` (= Codex **v0.51** + all RPG systems) is published for the owner on claude.ai. It's a solo build; saves live in that browser. The Cloudflare Worker (workers.dev) was last deployed at 04:17 UTC on 10-11 and is stale until its build branch is changed.

### New Claude-owned modules
All live under `claude/rpg-core`, merged into `claude/rpg-play`.

| Module | What |
|---|---|
| `dailies*.js` | 3 daily challenges (deterministic per local day, 13 types) + 1 weekly, with a 🔥 streak (+10%/day up to +50%, plus a bonus). UI: a 📅 DAILY chip under the goal card. Save: `nightshift-dailies-v1` |
| `respect*.js` | Respect meta rank (Nobody → Legend, 8 ranks) built from skills, goals, medals, guns, home, tuning, streak and money; each new rank pays rank×$1,000 once. Badge sits beside the ⭐ SKILLS chip. Save: `nightshift-respect-v1` |
| `fishing*.js` | **Fishing skill (10th skill)**. Two spots, Docks Pier (1760,1655: docks road end) and West Canal (60,520), drawn as small water/pier decals. Cast → bite → reel timing minigame. 11 catches incl. junk, wallets, night fish (eel, catfish), rain (tuna) and the legendary Golden koi. Rods: Carbon $1.5k, Pro $5k. Cooler of 20: sell at the pier (Dealing bonus) or eat to heal. Save: `nightshift-fishing-v1` |
| `lab*.js` | Drug lab: a ⚗️ LAB USE point beside an owned Weed Farm/Coke House (property x+70). Timed batches from carried weed/coke + supply cash: pre-rolls, gummies, street bags, party packs. Farming speeds cooking and adds yield; product stash of 60; fence at 60%. Save: `nightshift-lab-v1` |
| `jobs*.js` | 📱 HUSTLE phone: 4 offers rotating every 5 min. **Taxi** (pickup → dropoff, +30% under par), **Hit contract** (marked pedestrian, reticle, +1 heat), **Repo** (steal a marked car, park it at a TUNING garage), **VIP drop** (deliver lab product, pays 1.6× value). Pink guide arrow and timer bar; +5% pay per Respect rank. Save: `nightshift-jobs-v1` (stats only; the active job is session-only) |

Also:
- Pinning a goal now calls `NightshiftMap.navigate({x, y, label, id: 'goal-<id>'})` and `clear(id)`.
- New `NightshiftGoals.notePayout(n)`, so reward payouts aren't counted as "earned".
- All modules reach game `save()` by lexical lookup, so there's no `Function()` or eval anywhere (CSP-safe).
- Job and race HUD bars sit bottom-centre in landscape and under the left chips in portrait, so they never cover chips or joysticks.
- New goals: fishing ×3, jobs ×2, lab, Respect. Goals total: 45.

Tests: 12 RPG suites, 42 PASS lines (`tests/{skills,goals,skill-effects,casino,weapons,tuning,races,home-upgrades,dailies,respect,fishing,jobs-lab}.cjs`). Every browser flow (skills, guns, casino, home, tuning, fishing autoplay, taxi/hit/lab/drop) passes on v0.51 with no page errors.
- **Weapon mods** (weapons-data.js `MODS`, `effective()`, `buyMod()`): Extended mag (+50%, capped at 30), Laser grip (spread ×0.5), Scope (range ×1.35, spread ×0.6) and Suppressor (heat per shot ×0.3 via a microtask after the game's +0.08; 80% of `Crime.report(...,'gunshot')` calls are skipped; `Citizens.alert` radius 260 → 70). Bought per gun in the gun shop; the 🔇 shows on the weapon pill. Verified: 6 pistol shots give heat 0.48 unsuppressed vs 0.144 suppressed. Hooks added: `NightshiftCrime.report` and `NightshiftCitizens.alert`.
- **City guide** on the HUSTLE phone: every activity spot (casino, gun shop, tuning, fishing, labs, races, home, dealers, properties) with a GPS button (`NightshiftMap.navigate`).

## Batches after the owner's "go full-on" directive
- **Bank heists** (`heists*.js`): HEIST USE points at both BANKs (door x−60), drawn as a VAULT sign. Needs a carried pistol. Hold within 95 px for 25 s (Stealth shortens it) while `Crime.report(...,'robbery')` repeats every 6 s and heat stays ≥ 2.5. Then escape: heat reaching 0 or getting within 110 px of the apartment pays $6–9k × Respect × Luck. 20 min cooldown per bank (10 min after a failure). Save: `nightshift-heists-v1`.
- **Venues** (`venues*.js`):
  - Iron Works Gym (CLOTHING at 1400,1435; door x−70): $50 per set, a 10-rep timing minigame → Speed/Toughness XP and +25 HP for 7+ clean reps; 60 s cooldown.
  - Clubs Velvet (520,1435) and Neon Room (960,415): sell lab product at 1.3× (Charisma raises it), 4 per visit, 12% bust chance (Stealth lowers it; a bust adds +2 heat and loses the product). Buying a round gives Charisma XP.
  - Save: `nightshift-venues-v1`.
- **Body armor** (weapons): Kevlar 50 ($500) or Heavy 100 ($1,300); soaks 70% of each hit; refunded if the game ignored the hit; lost on death. Shown as 🛡️ on the weapon pill. Fixed a double-wrap: weapons.js now marks its hook installs on the module objects.
- **Empire** (`empire*.js`): 5 front businesses ($15k–$250k) earning $450–$7,000/h in real time (offline too), capped at 8–10 h; managers add +50% each, up to 3. Opened from 📱 HUSTLE → 📈 EMPIRE. Save: `nightshift-empire-v1`.
- **Blackjack** in the casino: infinite deck, dealer stands on 17, 3:2 blackjack, double down. Returns 96% with simple strategy (test). The whole hand settles at the end; closing mid-hand stands.
- **Lifetime stats** in the Respect panel. Chips now sit below Codex's `#crimeStatus` while it's visible.
- New goals: gym, club, 2 heist, 2 empire. Respect now also counts fronts and heists.
- **City events** (`events*.js`): every 2.5–4 min (first one ~1 min after load), a timed event spawns on a road 35–130 m from the player. It doesn't spawn during a heist or race, and timers freeze while an RPG panel is open. You get a toast, a cyan dashed marker with a label plate, a cyan guide arrow (radius 66/90, outside the pink job arrow) and an `#evHud` countdown bar. In landscape the bar stacks above the job bar; in portrait it sits under it.
  - 💼 Briefcase: reach it for $300–900; 35% are hot (+1.5 heat and a theft report).
  - 🚚 Armored truck: stay within 90 px for 12 s for $1.5–3k. Progress decays when you step away, heat stays ≥ 2, and `Crime.report(...,'robbery')` fires every 4 s.
  - 🎁 Package: grab it, then deliver it ≥ 900 px away within 90 s. Pays $500 + distance/3 + $5 per second left.
  - 🏁 Sprint: drive into the start in a car, then pass 3 gates in order within 28 s. Pays $600 + $25 per second left; leaving the car fails it.
  - Pay is +5% per Respect rank, plus skill XP. API: `NightshiftEvents.{state, active, spawn(type), dismiss, next}`. Save (stats only): `nightshift-events-v1`, which needs adding to backups `KEYS`.
  - Wiring: goals `event1` "Opportunist" and `event25`; daily "Finish n city event(s)"; Respect source "City events" (10/event, cap 300); a lifetime stats row; a 🌆 LIVE entry at the top of the city guide.
  - Load order: `events-data.js`, `events.js` after `empire.js`.
  - Tests: `tests/events.cjs` (3 PASS). Browser: all 4 types complete at 844×390 and 390×844 with no page errors.

## Batch 4: secrets, street exchange, fight club, workbench
- **Hidden stashes** (`stashes*.js`): 30 packages at walkable off-road points. Each was checked with `blocked()` in-browser and they're spread more than 200 px apart.
  - Walk within 34 px to grab fixed cash ($150–600) plus pocket items: 2–4 scrap, often parts, sometimes a watch or jewelry. Items go into `NightshiftInventory.state.pocket` (cap 999), followed by `NightshiftInventory.save()`.
  - The box draws on the encounters layer, so canopies can hide it. A gold sparkle within 150 px draws via a `NightshiftFeedback.draw` wrap, so it shows above trees.
  - Milestones: 5 → $1k, 10 → $2.5k, 20 → $6k, 30 → $20k.
  - 📱 phone: "BUY A STASH RUMOR" ($250) draws a gold circle around a random unfound stash and sets the GPS.
  - Save: `nightshift-stashes-v1`.
- **Street exchange** (`market*.js`, 📱 → 💹 MARKET): 5 fictional tickers (NCOIN, DOCK, NEON, CABS, GOLD).
  - Price is a pure function of the minute slot (sines + smooth value noise), so it moves offline and is identical on every device. That makes it server-friendly for multiplayer later.
  - A news line every 10 min names the ticker with the biggest slow-wave move over the next 20 min. In simulation, following it wins about 59% of the time.
  - 1% fee. Position limit is $20k per ticker, +$15k per Respect rank. Only profit counts as "earned" (notePayout).
  - Save: `nightshift-market-v1`.
- **Fight club** (gym panel → 🥊 FIGHT CLUB): a 5-opponent ladder (Kid Knuckles … Iron Mara).
  - Each beat the cue is OPENING (STRIKE), SWINGS (BLOCK) or FEINT (press nothing). The answer window is 1100 ms down to 600 ms; fast answers crit.
  - Toughness adds HP and damage and reduces damage taken. Athletics widens the window.
  - Simulated win rates: a level-1 player at 85% accuracy beats the champ ~19% of the time; at level 10 ~45%.
  - Entry $50–800, purse $250–7,500, 90 s cooldown. A loss costs 15 HP. Keys J/K.
- **Workbench** (gun shop): build any mod from salvage via 🔧 (6–10 scrap + 1–3 parts), or an armor plate (+25, max 100) for 6 scrap + 1 part. This gives salvage and stashes a purpose.
- **Wiring:**
  - Goals: stash1, fight1, gunsmith, trader, stash15, champ, stash30 (55 goals total).
  - Dailies: fight wins, market trades.
  - Respect: stashes 10 each (cap 300), ladder 60 per rung (cap 300).
  - Lifetime stats rows.
- **Load order:** after events: `stashes-data.js`, `stashes.js`, `market-data.js`, `market.js`.
- **Tests:** `tests/batch4.cjs` (4 PASS).

## Batch 5: city life (owner: "world feels alive, spawn inside the apartment")
- **Start at home.**
  - `starter-home.js` is the first script in the page (build-online `EARLY_SCRIPTS`). Before activities.js reads `nightshift-city-activities-v1`, it sets `owned: true` there, so every player owns the Midtown apartment.
  - `life.js` then waits ~0.9 s for saves, places the player at the door point (950,735), the sidewalk in front of APARTMENTS within the HOME radius, and calls `NightshiftHome.enter('home')`.
  - The first visit gets a welcome toast; later sessions get "You wake up at home · HH:MM". EXIT returns you to (950,735).
  - Codex: please expose an in-room spawn point (e.g. `enter(kind, {x,y})`) so we can wake up beside the BED instead of on the exit rug.
- **Car radio** (pill: top-centre in landscape, under the 📱 button in portrait).
  - 3 stations: NIGHTSHIFT FM (synthwave), DOCK 99.1 (lo-fi), NEON WAVE (club). Tap to change station; ⏻ turns it off.
  - The DJ ticker reacts to what you did (heists, events, fights, the champion belt, stashes, rank-ups, koi, escapes), plus police heat, rain, time of day, market news and city flavor lines.
  - Procedural Web Audio music (deterministic bars per station) plays only while driving and only when the game SOUND toggle is on.
- **Contacts and texts** (📱 → 📩 MESSAGES; the phone button shows an unread count).
  - Rico texts about city events; Vee announces club nights; Coach announces cheap gym mornings; Broker Sam passes on market news; Mom says hi on your first day.
  - Tips are rate-limited to one per 30 real minutes, because the game day lasts 8 real minutes.
- **Day rhythm:** clubs pay +20% from 21:00 to 04:00, and gym sets are half price from 06:00 to 12:00, using `NightshiftEnvironment.state.minute`.
- City events freeze while you're inside the apartment or in any RPG panel.
- Save `nightshift-life-v1`, which needs adding to backups. Tests: `tests/life.cjs` (4 PASS).
- Regression scripts must now exit the apartment first: `NightshiftHome.kind() && NightshiftHome.use()`.
