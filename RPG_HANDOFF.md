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

## Art pass (owner request while Codex was unavailable)
- **Branch:** `claude/art-pass`, also merged into `claude/rpg-play`. It edits Codex-owned art files: environment, sprite-renderer, scene-renderer, interior-art, home and world.
- **Changes:**
  - Night lightmap, dusk grade and vignette.
  - New character renderer (variety, outlines, uniforms, guns matching the equipped weapon).
  - Redrawn furniture, room day/night light, and asphalt grit.
- **Details:** PR #3 comment "heads-up, I did an art pass".
- **Claude-owned props:** armored truck (doors open as you crack it), briefcase, package, checkpoint gates (events.js) and the duffel-bag stash (stashes.js).
- **Art pass 2**
  - `fx.js` (Claude):
    - Camera shake, via a drift-free wrap of `NightshiftCamera.step`, on hits, crashes and gunfire (shotgun and rifle shake hardest). Respects `prefers-reduced-motion`.
    - Skid marks (fade after 25 s) and tyre smoke when braking, drifting or launching.
    - Crash debris puffs and rain splash ripples.
    - API: `NightshiftFx.{shake, stats}`.
  - Loads after `life.js`.
  - Art-pass branch:
    - Lit windows now punch through the night lightmap (`NightshiftWorld.litWindows()`).
    - `NightshiftHome.enter(kind, spawn)` takes an optional in-room spawn point; the player wakes up at (252,172) beside the bed with a clear path to the door.
    - New `NightshiftHome.leave()`; regression scripts use it.
- **Art pass 3**
  - **Character creator** (art-pass, `home.js`):
    - New profile keys `hairdo` (8) and `outfit` (5); more skins (7), shirts (8) and hair colours (6).
    - Text swatches for the hat, bag, hairdo and outfit keys.
    - The preview draws the real sprite (front, side and back) via `NightshiftSprites.personTo`.
    - Creator z-index raised to 60 so it sits above the HUD chips.
    - Old saves validate to `short`/`jacket`, which is the previous look.
  - `ui-skin.js` (Claude, loads after `fx.js`): CSS-only "night glass" HUD, district label, toasts and action buttons. In landscape, toasts are smaller and sit at the top.
  - The goal card hint shows for 15 s when a goal changes, then collapses.
- **Minimap and compatibility**
  - `minimap.js` (Claude, loads after `ui-skin.js`): a round 104 px radar, north-up, about 520 px world radius. Tap it to open the full map.
    - The base is drawn once from `NightshiftWorld.ground` plus building rects at 1/5 scale.
    - Shows the GPS route and target, the tracked goal, the city event, the phone job (red for hits), the stash-rumor circle, an active heist, home, and police (flashing).
    - Off-view markers clamp to the rim.
    - Wanted stars sit along the bottom, and the rim flashes red/blue when heat ≥ 0.5.
    - Placement: landscape, left of the weapon pill; portrait, under the 📱 button (below the radio when it's shown). Hidden indoors and while any RPG panel is open.
  - Art branch: `NightshiftMap.target()` and `NightshiftMap.path()` are read-only. New: `NightshiftJobs.target()`.
  - `starter-home.js` now also polyfills `Array/String#at`, `Object.hasOwn`, `findLast`, canvas `roundRect` and `ellipse` for older iPhones.
  - Portrait toasts sit at 58% height (below the player).
- **New HUD** (`hud.js`, Claude, loads last)
  - **Old widgets:** Codex `#hud` and `#map`, plus the RPG chips `#skChip`, `#rsBadge`, `#dyChip` and `#jbBtn`, are hidden. They still exist and update; the HUD reads the same data.
  - **Left stack `#nsL`:**
    - Status card: HP bar, armor bar, cash, ammo or car speed, district · clock, and crew/rival lines.
    - A dock of 4 icon buttons (Skills with total level, Rank icon, Daily n/3, Phone with an unread/job badge).
    - `#glCard`, then `#crimeStatus`, then `#jobPanel`.
  - **Right stack `#nsR`:** minimap with a district/clock caption, `#wpPill`, and `#lfRadio` (portrait only).
  - **Bottom `#nsBars`:** holds `#hsHud`, `#jbHud` and `#evHud`. In landscape it sits between the sticks; in portrait, above the action buttons.
  - **While a menu is open:** any panel open (Claude or Codex), or the MORE grid open, sets body class `ns-menu` and hides the HUD and sticks. Codex panels also set `ns-panel`, which hides `#actions`. Toasts then float above menus at the bottom.
  - **Panel styling:** Claude panels share one geometry (portrait almost full-screen; landscape centred, max width about 760). All panels get the same radius and font; headings use Chakra Petch from Google Fonts with a system-font fallback.
  - Escape closes Claude panels.
  - **Phone:** header first, then a 4-tile app home screen (Empire, Messages, Market, Stashes), then jobs and the city guide.
  - Regression scripts open the phone with `NightshiftJobs.open()` and click `.app` tiles.
- **Controls and water art**
  - `hud.js`:
    - Joystick bases are glass rings; the move nub is a glossy blue orb and the aim nub a pink orb, both with glow.
    - Action buttons are rounded glass tiles in the display font. USE is outlined amber and FIRE red; held buttons brighten.
  - `fishing.js`:
    - Water at both spots is wide, with drifting shimmer and a foam edge (harbor: 380 px; canal: the full west strip).
    - Plank pier deck on posts and a moored boat that bobs.
- **Public play link, approved by the owner** (the Claude artifact viewer asks for an iOS update on the owner's iPhone): https://th4r6xkgcs-ui.github.io/nightshift-city-online/
  - Served by GitHub Pages from the `gh-pages` branch, which holds static output of `node online/build-online.cjs <dir>` from `claude/rpg-play` plus `.nojekyll`.
  - To update, rebuild and force-push `gh-pages`.
- **Player guide** (`guide.js`, Claude, loads after `hud.js`; the owner said the game is "a bit confusing")
  - **First-time controls tour:** spotlight coach marks on the sticks, action button, status card, goal card, dock, minimap and MORE. It runs the first time you step outside; SKIP, NEXT and GOT IT; saved in `nightshift-guide-v1`. Add `?notour` to the URL to skip it in automated tests.
  - **❓ dock button:** opens a "What can I do?" panel grouped into MAKE MONEY, GET STRONGER and HAVE FUN, each entry with a how-to line and GPS/OPEN, plus "replay the tour".
  - **MORE grid:** every Codex button gets an emoji icon and a short caption via CSS (`#actions.expanded>#id::before/::after`). Compact in landscape.
  - The GitHub Pages site is redeployed with all of this.
- **Sharpness and signs**
  - **Art-pass branch, `game.js` `resize()`:**
    - The canvas backing store renders at `min(2, devicePixelRatio)`, CSS size stays W×H, and `g.setTransform(dpr…)`; all game coordinates stay in CSS px.
    - `fx.js` steps the scale 2 → 1.5 → 1 (`NightshiftRenderScale` plus a resize event) if more than 35% of frames take over 26 ms over 4 s.
  - **Night readability:** ambient darkness lowered to 0.72 and a wider light around the player.
  - **Signs:** `NightshiftSign(ctx, x, y, icon, text, color, {glow})` in `fx.js` draws one world-sign style (glass pill, icon disc, display font, pointer). It's used by the casino, gun shop, tuning, lab, fishing, gym/clubs, bank vaults, race starts and city events.
- **Ambient life and prompts**
  - `fx.js` adds:
    - Pigeon flocks in daytime that scatter when you walk close, drive fast nearby or fire.
    - Steam from street vents at night or in rain.
    - Drifting cloud shadows in daytime.
  - Art-pass branch: Codex interaction prompts ("👆 CAR/HOME/RACE…") and the GPS target now use `NightshiftSign`.
  - Race start signs moved below the ring.
- **Sound and police cruisers**
  - `ambience.js` (Claude, loads after `guide.js`): synthesized city audio (no audio files). It plays only when the game's 🔊 SOUND toggle is on, and only after a tap.
    - A traffic rumble bed (busier in Midtown, quieter at the docks and late at night), rain hiss, wind, distant sirens while heat ≥ 1, and footsteps (wetter in rain).
    - Per-weapon gunshots via a `NightshiftFeedback.shot` wrap (`__amb`); the suppressor muffles them.
    - A cash "ka-ching" on jumps of $500 or more.
    - Indoors it drops to a soft room tone.
    - API: `NightshiftAmbience.{on, level}`.
  - `fx.js`: each newly spawned police officer gets a white/black cruiser with a flashing red/blue light bar, parked at the nearest road lane.
    - Several cruisers park nose-to-tail 70 px apart instead of stacking; the cap is 6.
    - They leave 15 s after heat clears, or after 120 s.
    - `NightshiftFx.stats().cruisers` lists their positions.
- **First-minute clarity pass** (owner: "a bit confusing")
  - **Apartment** (art-pass, `home.js`): the doorway is lit, with warm street light spilling in, a doormat, and a bobbing "🚪 EXIT TO CITY" sign with animated chevrons. These hide once you're at the door, where the USE prompt takes over.
  - **Controls tour** (`guide.js`): starts only after you've been outside for 1.5 s; it used to fire inside the apartment during the spawn hand-off.
  - **Texts** (`life.js`):
    - Texts now go through a queue: one at a time, at least 9 s apart.
    - They never arrive during the tour or while a menu is open.
    - Mom's welcome can arrive indoors; everything else waits until you've spent 20 s outside.
    - Market and tip texts start after one minute outside.
  - **Indoor toasts** (`hud.js`): new body class `ns-home`. In portrait, toasts move to the empty bottom-right space (the aim stick is hidden indoors), so they no longer cover the room or the door. The welcome text is now one line.
  - **Goal arrow** (`goals.js`): shows a distance tag ("102m"; 10 px ≈ 1 m). The first-goal hint has been rewritten.

## Crafting economy (owner: "first goal craft a cheap pistol that breaks… collect → process → sell… make everything make sense economically… grindy")
- **New modules (Claude-owned, load after `life.js`):** `supply-data.js` (pure rules, `tests/supply.cjs` incl. economy sim), `supply-art.js` (all pixel art + icons), `supply.js` (gameplay + panels).
- **Start:** a brand-new player (no saves) has $200, no gun, 24 spare rounds, and 2 tape + 10 baggies in the 🎒. Existing saves keep their guns (weapons save version 1 → migrated with the Street Pistol) and get a small material gift. "Start a new life" (backpack panel) reloads with `?newlife=1`; `starter-home.js` wipes every `nightshift*` key before any module loads.
- **"Carrying a gun" = `pocket.pistol`:** `game.js` only fires when it is above 0, so `weapons.js` keeps it at 1 when a working gun is equipped and deletes it when you're unarmed. The corner shop's `PISTOL · $150` button is hidden.
  - **Test harness (`tests/harness.cjs`, rpg-play only):** seeds `nightshift-weapons-v1 = {"version":1}`, so base-game tests run as an armed legacy player.
  - **Browser regression scripts:** seed the same save.
- **Guns (`weapons-data.js` v2):**
  - **15 guns:** Pipe Pistol, Zip .22, Sawn-off (crude, home bench); Street Pistol, Compact 9, Six-Shot Magnum, Pump Shotgun (Lockup Lv1); Machine Pistol, Viper SMG, Desert Hawk, Hunting Rifle (Lv2); Breaker 12, Carbine, Longshot DMR, Ridgeback AR (Lv3).
  - **Fields per gun:** `craft.mats`, `craft.seconds`, `dur` (shots), `value` (arms buyer), `cls`, `tier`, `level` (Shooting level needed).
  - **Wear:** every trigger pull wears the gun (`wear`). Crude guns are destroyed when worn out; real guns become `broken` and need a repair at a bench of their tier (repairs cost metal and springs; a broken gun also needs a trigger group). A spare swaps in automatically.
  - **Street Pistol** keeps the original game's stats (30-round magazine, 180 ms), so Codex's core tests still hold.
  - **Attachments** are crafted (`MODS[].mats`, `.tier`); reinforced parts give +60% durability. Armor plates: 10 metal + 2 tape.
- **Places:** world positions are in `supply-data.js`; all sit inside open lots or on sidewalks.
  - **Collect:**
    - Scrapyard (SW)
    - Construction site (top Midtown, day)
    - Grow plots (West End park)
    - Smuggler boat (east docks, 20:00–05:00)
    - Pharmacy dumpster (behind the clinic)
    - Arms container (east edge, 21:00–04:00)
  - **Process:**
    - Trim house: 3 leaf + 1 baggie → 1 weed in the pocket
    - Motel kitchen: snow + chem + 2 baggies → 2 coke in the pocket
    - Trailer lab: 2 chem + 1 baggie → 3 pills
  - **Sell:** Codex dealers and customers (weed/coke), the party promoter (pills, nights), the arms buyer (guns, nights, 4 per 15 min).
  - **Shops:** hardware cart (tape, baggies, metal, wood), two bag stalls (24 → 200 space), the gun shop as a parts counter (+ ammo crates, armor), the Lockup ($6k / $18k / $45k).
- **Loop mechanics:**
  - USE starts a timed loop; the ring fills over the player.
  - Spots have stock that refills over time.
  - Illegal spots add heat.
  - Walking away, the place closing, a full bag or an empty spot stops the loop. Menus pause the timer.
- **Home workbench:** room coordinates (574, 236), via an `NightshiftHome.interaction/use` wrap. It can craft from the bag plus the 600-space home locker; the Lockup only uses the bag.
- **Also changed:**
  - New Crafting skill.
  - 🎒 dock button (shows a fill badge) and a BACKPACK phone tile.
  - Guide sections "Guns & crafting" and "Product".
  - Tour steps for 🎒 and the gun pill.
  - Starter Empire fronts: shoeshine $800, hot dog $2.5k, arcade $6k (about 33 h payback).
  - New goals: `scav1` and `craft1` come right after `walk`, then `shoot`, `leaf1`, `trim1`, `bag1`, `crafter`, `pills1`, `lockup1`, `gun1` (crafted real gun), `coke1`, `gunrun1`, `factory`, `arsenal` (10 guns).
  - Per-gun sounds (ambience) and camera shake (fx) are keyed by id and class.
- **Art-pass branch:** `sprite-renderer.js` `gunArm` draws a held sprite for each of the 15 guns. `game.js` no-gun message now reads "craft one at your home workbench".
- **Crafting polish**
  - **Perfect taps (`supply.js`):** every collect/process cycle has a gold window drawn on the activity bar. Tapping the bar (or pressing C) inside it finishes the cycle at once:
    - Collecting gives +1 of the spot's main item.
    - Processing refunds the baggie.
    - Both give 1.5× XP.
    - A tap outside the window ("too early") locks that cycle's window. Idle play still earns the base rate.
  - **Craft quality (`weapons-data.js`):** each crafted gun rolls Rough / Standard / Fine / Masterwork via `rollQuality(craftingLevel)`.
    - Quality changes damage (×0.95 to ×1.1), durability (×0.8 to ×1.5) and resale value (×0.8 to ×1.6).
    - Crafting a better copy of a gun you hold swaps it in, and the old one becomes a spare. Spares are always Standard.
    - Saved in `state.quality`.
  - **UI:** a new-gun reveal card shows the quality, and gun and material icons get an automatic outline/rim/shade pass.

## Beyond the city: zones, countryside, suburbs, break-ins, hitman, cars (owner: "suburbs, rural farming, food buffs, break-ins, hitman, chop shop, car guy, furniture, pets, never be bored")
All Claude-owned new files. No Codex file was edited except where noted on `claude/art-pass`. Load order is in `online/build-online.cjs` (rpg-play): `zones, food-data, food, farm, breakin-data, breakin, hitman-data, hitman, cars-data, cars, pets-data, pets, suburbs, chop-data, chop, decor-data, dreamhome` after `supply.js`.

- **Zone engine (`zones.js`):** whole extra maps without touching the city.
  - It rides the apartment hooks: while a zone is active `NightshiftHome.paused()` is true, so `game.js` calls `NightshiftHome.render(now)` and we draw the zone; USE goes through `NightshiftHome.use/interaction`.
  - Owns movement + collisions, camera (`def.zoom`), a cached ground layer, y-sorted props/actors/player, bullets (yours and enemies'), fog of war with a vision cone, sound "echo" rings, night lighting (lightmap follows the real canvas pixel ratio), USE targets with `NightshiftSign` signs, fade, banner, bus travel.
  - API: `register(def)`, `enter(id, spawn)`, `leave(to)`, `active()`, `openTravel()`, `api`, `CITY_STOPS`, `addCompanion(fn)` (pets and the hitman sign use it).
  - Bus stops in the city: Midtown (1262, 958) and West End (420, 612). Fare a few dollars.
- **Harlow Fields countryside (`farm.js`) + food (`food-data.js`, `food.js`):** lease plots at the co-op, plant, water (+35% speed), harvest into the backpack; hens/cows need feed; windmill makes flour; orchard; hidden leaf field. Cook at the apartment kitchen or the farmhouse; meals give timed buffs via `NightshiftSkills.addModifier`/`xpMultiplier`, or sell at the Diner back door (1600, 948). Save `nightshift-food-v1`.
- **Break-ins (`breakin-data.js`, `breakin.js`):** generated interiors (spanning-tree rooms + loops), typed furniture, loot containers with search timers, guards with patrol/investigate/alert/search states, dogs, cone vision, hearing (suppressors cut gunshot noise to 80 px), echoes for unseen footsteps/shots, alarm → police timer, HOT BAG (only yours once you walk out the back door), cooldown per place. Unaware targets take 2.5× damage; a one-shot takedown nobody sees doesn't trip the alarm by itself. Entry: six Palm Grove houses + the Halvorsen Estate, and two city warehouse back doors (nights). Save `nightshift-breakin-v1`.
- **Hitman career (`hitman-data.js`, `hitman.js`) — NEW this batch:**
  - The Broker (phone contact `broker`) texts after your first break-in. 📱 → 🎯 CONTRACTS shows three offers per 20-minute window, each with a pixel dossier portrait.
  - A contract places the mark (+ bodyguards) in that break-in location (`NightshiftBreakinData.addMark`: the room furthest from the back door). Gold ▼ over the mark when visible. Kill them, walk out: pay × (1 + 0.5 silent + 0.25 clean). Alarm long enough → the mark flees for the back door; if they get out the contract fails. Contract locations ignore the place cooldown, warehouses open at any hour.
  - Ranks Rookie → Cleaner (3) → Professional (8) → Specialist (15) → Silent Assassin (25): pay ×1.15 per rank, warehouses at Cleaner, the Estate at Professional. Save `nightshift-hitman-v1`. Goals `hit1`, `silent3`.
- **Palm Grove suburbs (`suburbs.js`):** houses, gated mansion, Golden Pawn (fences jewels/gadgets/art), Paws & Claws (pets), Prestige Motors (showroom + body kits), park, dream house for sale.
- **Pets + kits (`pets-data.js`, `pets.js`):** pets follow you everywhere (city + zones), perks while fed, dogs sniff stashes. Prestige kits = stat multipliers + visual parts on your car.
- **Dream house (`decor-data.js`, `dreamhome.js`):** four rooms, 15 decor slots, Style tiers (+2% sale prices per tier), four-car garage with your cars and kits, pets roam, bed gives "Well rested".
- **Rusty's chop shop (`chop-data.js`, `chop.js`):** steal a car, drive into the bay behind the scrapyard: CHOP (cash, hot list ×2), STRIP (parts), RE-VIN (keep it). Lift takes 3 cars / 15 min.
- **Car collection (`cars-data.js`, `cars.js`) — NEW this batch:**
  - Ten fictional models: Brick Hatch $5.2k, Mule Pickup, Ridgeback 4x4, Bulldog V8, Kestrel Rally, Monarch '62, Velvet Lowrider, Aurora GT, Vortex R $145k, Phantom Zero $290k. Each has its own accel/top speed/steer/armor and paints.
  - Art: every model is baked once per paint at 4× into an offscreen canvas (body outline + paint + form shading + sheen, glass with reflections, seams, chrome, lights, mirrors, per-body details), drawn smoothly scaled; brake/tail/headlight glow, hypercar LED strips, lowrider idle hop and wear are live.
  - **Hooks (no Codex edits):** `NightshiftSprites.car` wrapper draws any car whose `model` starts with `CX:`; `NightshiftVehicles.handling` wrapper lends the model's stats to `MODELS[0]` for the call (ids `cx-N` resolve to index 0); `damage/hit` divided by armor. Owned cars are pushed into `cars` (ids `cx-<uid>`) and saved by us (`nightshift-cars-v1`), positions synced every 4 s.
  - Bought at Prestige Motors (Palm Grove) → parked by the Midtown apartment. A rare model is parked in the city every 25 min (Rico texts); steal it → Rusty re-VINs it into the collection (60% of its chop value) or chops it. 📱 → 🚗 MY CARS = garage list (GPS, sell at 55%) + collection book; milestones 3/6/10 different models pay $5k/$20k/$100k. Goals `ride1`, `exotic1`.
- **Tests:** `tests/hitman.cjs`, `tests/cars.cjs`, plus the existing `breakin`, `chop`, `food`, `pets`, `decor`, `goals` suites.

### Notes for Codex (please read)
- **v0.54 merged into `claude/rpg-play`.** Conflicts: `game.js` (took your `render-quality.js` resize; we pass `NightshiftRenderScale || devicePixelRatio` as the DPR so `fx.js` can still lower it on slow phones) and `sprite-renderer.js` (kept the art-pass people; your car paint changes merged cleanly).
- **Panel id clash avoided:** `#hmPanel` is home upgrades; hitman uses `#htPanel`.
- **Cars you may want to know about:** extra cars live in `cars` with `model: 'CX:<id>'`. If you ever rebuild `cars` or the vehicle save, keep unknown ids alone (we re-add ours on load).

## Batch: legendary guns, trap houses, apartment decor, night car meet, city car restyle, ledger
- **Legendary guns (`weapons-data.js`):** `goldhawk`, `whisper` (`silent: true` → always suppressed), `dragon`, `reaper`, `tiger`; `legend: true`. Craftable only after the blueprint is learned (`state.learned`, kept by `clean`; owning one implies learned). `rollBlueprint(state, rnd, chance)` weights rarer guns lower; `NightshiftWeapons.learn/blueprintDrop` persist and show a gold BLUEPRINT reveal card (`NightshiftSupply.reveal(w, 1, true)`).
  - Drops: break-in safes 4%, gun safes 7%, gun lockers 10%, counting tables 3% (×2 in the estate and trap houses, × Luck), Broker contracts 8% + 6%/rank (×1.6 silent).
  - Art: icons in `supply-art.js` GUN, held sprites in `sprite-renderer.js` (art-pass).
- **Trap houses (`breakin-data.js` type `stash`):** rooms trap/cook/count, product crates (weed/coke go into the game pocket on exit), chemical crates, cash piles; crew members (`thug`); cops take 90 s. Doors: Southside (1370, 1520) and east edge (2110, 840), any hour. Also contract locations.
- **Apartment decor (`decor-data.js` `APT_SLOTS`, drawn by `dreamhome.js`):** six slots in the Midtown apartment (wall art, plant, lighting, pet bed, music, aquarium) using the same furniture collection; buy once, place in either home. `placeApt`, `aptStyle`, `aptTier` (Bare/Lived-in/Cozy/Sharp). Deal bonus = max(dream +2%/tier, apartment +1%/tier). Wraps `NightshiftInteriors.draw('home')` and `NightshiftHome.interaction/use` (DECOR prompt within 44 px; Codex targets win ties). Player room position comes from `NightshiftHomeUpgrades.roomPos()`.
- **Night car meet (`carmeet-data.js`, `carmeet.js`):** Westside Courts ring (228, 520), 21:00–03:00. Score = model tier + kit + tuning×5 + paint, scaled by condition; five deterministic rivals per night; top 3 pay $2.5k/$1.2k/$600 + trophies; one show per car per night. Own day counter (game clock has minutes only).
- **City car restyle (`cars.js`):** every car drawn through `NightshiftSprites.car` (parked, owned, traffic) now uses the baked renderer with `sedan`/`compact`/`van` bodies (cached per model+paint at 3×). `NightshiftCars.setStyleBase(false)` restores Codex's car art instantly.
- **Ledger (`ledger.js`):** polls `player.cash` every 200 ms and credits each change to a category: explicit `NightshiftLedger.tag(cat)` (set at payout points in Claude modules), else the open panel, else the zone, else "Street & other". 📱 → 📊 LEDGER: session/all-time earned and spent by source, net per hour, and a ways-to-earn list. Save `nightshift-ledger-v1`.
- **Goals added:** `decor1`, `trap1`, `meet1`, `legend1`, `ride1`, `exotic1`, `hit1`, `silent3`. **Tests:** `tests/carmeet.cjs`, `tests/cars.cjs`, `tests/hitman.cjs`, updated `weapons`, `breakin`, `goals`.

## Batch: lockpicking/safecracking, exotic pets, weapon paint jobs, your own stash house
- **Picks (`picks-data.js`, `picks.js`):** every back door is a lockpick minigame (house 3 pins → estate 5 pins; Stealth widens the gold zone, Luck adds a spare miss); KICK IT IN skips it but starts the alarm at once. Safes and gun safes are dial minigames (+30% cash, quiet) with DRILL IT as the slow, loud fallback; misses make noise for guards. Panel `#pkWrap` at the bottom; the world keeps running. Walking 100 px from the door cancels.
- **Exotic pets (`pets-data.js`, `pets.js`):** raccoon (crafting −10% time), barn owl (−10% heat), capuchin (+5% run speed, +10% luck), tiger cub ($25k: +4% sales, −8% damage taken). New draw branches `owl`, `monkey`, `raccoon`, tiger stripes on the cat body.
- **Weapon paint jobs (`weapons-data.js` `SKINS`, `paint()`; `state.skins`):** 8 finishes applied on the ATTACHMENTS tab (cash + materials). Icons palette-swap K.st/K.sl/K.hi with optional camo (`supply-art.js` `gunIcon(id, w, h, skin)`); held guns read `NightshiftWeapons.skinPalette(id)` (art-pass `gunArm`).
- **Your stash house (`safehouse-data.js`, `safehouse.js`, breakin hooks):** clear every crew member in a trap house → the door offers TAKE OVER ($12k). Store weed/coke (pocket) and pills (backpack) up to 400 each, plus cash; the crew sells 8 weed / 4 coke / 10 pills per real hour at 70% of street price into the stash. Upgrades: door, alarm, cameras, dog, guards (wages $120/h each from the stash), safe (protects 50%/90% of cash). Raids roll every 15 min (cooldown 45 min) when the stash is worth ≥ $3k; odds and losses fall with security. Cameras give a 90 s warning; going in starts `NightshiftBreakin.defend()` — raiders come through the back door, no police, win by dropping them all. Save `nightshift-safehouse-v1` (plain JSON, the shape a future multiplayer raid would read).
- **Ledger:** `tag('ignore')` for transfers (stash deposits), new category `stash`.
- **Goals:** `takeover1`. Tests: `tests/picks.cjs`, `tests/safehouse.cjs`, paint jobs in `tests/weapons.cjs`.

## Premium 2.5D art overhaul, Option 3 (owner: "finish this since I'm out of Codex")
The full spec is in `ART_SPEC.md`, and sheets and screenshots are in `docs/art/`. Everything is in new Claude-owned files, except small hooks in Claude files (`cars.js`, `tuning.js`, `supply*.js`, `weapons.js`, `carmeet*.js`, `hud.js`, `jobs.js`, `guide.js`). No Codex file was edited.

- **Layered characters (`wardrobe-data.js`, `character-art.js`):**
  - 44 clothing items in 9 slots, each with colours, rarity, condition and options, plus skin, build, hair and facial hair.
  - An 8-direction renderer with idle, walk, run and a gun-holding pose.
  - It wraps `NightshiftSprites.person/personTo` for the player and every NPC, with deterministic NPC outfits and uniforms.
- **Character Studio (`studio.js`, `#csStudio`, save `nightshift-wardrobe-v1`):**
  - Stage: rotate (buttons or swipe), fit-to-stage zoom (slider, pinch or wheel), idle/walk/run, close-up, hold to COMPARE.
  - Catalog by category, with thumbnails that show the piece itself (a top is shown without its jacket, a bag from behind).
  - Item panel: close-up, rarity, condition, equipped state, description, colours, options.
  - Five saved outfits and five curated looks.
  - Where to open it:
    - At home, the apartment wardrobe opens it in WEAR mode (owned pieces only).
    - The 👕 BOUTIQUE point outside each CLOTHING store opens it in BUY mode (buy one piece or the whole look). Points are nudged so they never stack on another prompt.
    - 📱 STYLE opens a preview.
  - It syncs `NightshiftHome.profile` colours.
- **Weapons (`weapon-art.js`):**
  - 20 guns built from shaded parts. Attachments (suppressor, scope/red-dot, ext mag/speed-loader/tube, laser grip, reinforcement) are visible on the held gun, the icons and the bench. Paint jobs re-tint metal and polymer.
  - Held guns: installed as the outermost `S.person` wrapper (after Codex `detailed-art.js`). It passes `noWeapon:true` + `hold` down, so the character raises its arms and the gun sits in its hands. A laser line shows when a laser grip is fitted.
  - Weapon Inspection bench (`#wiPanel`): zoom, bench/night light, gun picker, stats (preview vs fitted, with green/red deltas), attachment previews with compatibility (fitted / requirements / won't fit crude / built in), paint previews, EQUIP.
  - Open it by tapping any gun picture, the 🔍 on armory cards, or Guide → Inspect a gun.
  - Armory cards inside the backpack and bench now have styles (before, they were unstyled there).
- **Vehicle Studio (`carstyle-data.js`, `carstyle.js`, `#vsPanel`, save `nightshift-carstyle-v1`):**
  - Options: 16 paints, 6 finishes, 6 wheel styles, 4 tints, 4 spoilers, 3 hoods, 5 liveries × 7 colours, 3 exhausts, 4 headlight colours, 5 underglows. All are baked into `cars.js` and also work on street cars you own.
  - Turntable: spin or drag, 45° steps, zoom, day/night with headlight beams, hold COMPARE.
  - Info: tier/rarity colour, body %, plate, show flair.
  - Where to open it:
    - Tuning garage → 🎨 STYLE STUDIO: pay only for the changes.
    - 📱 MY CARS → 🎨 STYLE: preview only.
  - Flair (0–30) adds to the car meet score.
- **Tests:** `tests/wardrobe.cjs`, `tests/weapon-art.cjs`, `tests/carstyle.cjs`, all registered in `tests/run.cjs` on rpg-play. The full suite reports **110 suites PASS**. A real bug was fixed: default clothing pieces weren't normalised, so the save wasn't idempotent.
- **Playwright checks (844×390 and 390×844):**
  - Studio: open, buy, wear, save, close.
  - Boutiques: placement.
  - Apartment wardrobe: hook.
  - Weapons: held guns at 8 angles, the inspection bench, and backpack icons.
  - Vehicle Studio: 9 options, then APPLY (cash charged, style saved), and styled street cars in the city.
  - No page errors.
- **Deployed:** GitHub Pages `gh-pages` from rpg-play.
- **Next:**
  - Sitting, crouch and car enter/exit animations.
  - A "style" goal tier.
  - Pets and props in the same premium pipeline.
  - Optional: let the car meet show the styled car portrait.

### Overhaul part 2 (owner: "get to it")
- **Animations (`character-art.js`):**
  - Poses: crouch, sneak (automatic in break-ins unless sprinting) and sit (on benches).
  - Getting into and out of cars: the player ducks into the driver's door (drawn by a `S.car` wrapper) and crouches when getting out.
  - Smooth turning through the in-between directions.
  - Gun swings up on equip (`weapon-art.js`), and the hands follow the crouch.
- **Pets (`pet-art.js`):** 11 species redrawn with 8 poses each. `pets.js` draws them; Codex's duplicate pet pass is a no-op.
- **Props (`prop-art.js`):** 11 premium street props replace Codex's, through `NightshiftDetailedArt.prop`, plus 50 sit-able city benches.
  - **Codex file edit, on rpg-play:** `detailed-art.js` calls `api.prop`/`api.pet` instead of its local functions (6 lines). This went on rpg-play rather than art-pass, because art-pass predates Codex v0.55 and merging v0.55 into it conflicts.
  - **Load order:** `online/build-online.cjs` gained `LATE_SCRIPTS` (loaded right after `detailed-art.js`).
- **Tests:** `tests/world-art.cjs` (pets × 8 poses, 11 props). The full suite reports **111 suites PASS**.
- **Playwright:**
  - A break-in shows the sneak stance with the Whisper SMG.
  - Benches: 50 placed, and the player sits.
  - The Character Studio, Vehicle Studio and weapon pages were re-run.
  - No page errors.
- **Sheets:** `docs/art/pets-sheet.png`, `poses-crouch-sneak-sit.png`, `props-benches-pets.png`, `sneaking-in-breakin.png`.

### Characters v2: pixel renderer (owner: "characters still look too blocky and cheap")
- **Merged Codex v0.56 (`codex/premium-art-v56`) into rpg-play.** The only conflict was `tests/run.cjs`; I took Codex's list, then added `character-pixel`. Claude modules were identical.
- **New `character-pixel.js`:** a true pixel-art renderer with lit masks, hue-shifted ramps, clumped hair, detailed faces, contact shadows and coloured outlines. See `ART_SPEC.md` → "Characters v2".
  - It overrides `NightshiftCharacters.frame/draw` and the person draw, superseding Codex's `premium-art-renderer.js`/`premium-head-art.js`. Those files stay in place but are no longer used for people.
  - `studio.js` now requests even scales.
- **Tests:** full suite **112 PASS**.
- **Playwright:** city NPCs, the Character Studio (landscape and portrait), held guns, and break-in sneak. No page errors.
- **Deployed** to GitHub Pages.

## v0.57 Bigger city, living crowd, walk-in buildings, wayfinding, crafting help (owner: "bigger world… cars useless… NPCs stack and don't act like NPCs… places should be enterable… I feel lost… crafting needs work… progress should be saved")
- **Resume on load** (`life.js`/`life-data.js`): `where` (home|city) is saved every 2 s and on pagehide; a returning player spawns where they left off outside ("👋 Welcome back"), not in the apartment.
- **City ×9** (Codex files edited because Codex is out of usage — see PR #3 note): `city-data.js` 15×15 blocks = 6600×5100; the original 5×5 core is unchanged at the top-left. `world.js` adds 8 named regions (DOWNTOWN, THE HEIGHTS, OLD TOWN, MARKET DISTRICT, IRONWORKS, FAIRVIEW, THE FLATS, HARBOR), a tiled ground cache (1320×1020 tiles, LRU 16) and live street props for on-screen blocks. `game.js`, `environment.js`, `signals.js`, `crime.js`, `inventory.js`, `navigation.js` (windowed A*), `road-navigation.js` (lazy grid), `city-map.js` (whole-city map with district labels), `traffic.js` (loops in every region, only near-player actors tick/draw) follow `NightshiftCityData.WIDTH/HEIGHT`.
- **Crowd** (`crowd.js`): 46 people kept around the player (far ones re-homed ahead), personal-space separation (no stacking), 22 parked cars recycled kerbside, and errands: idle people walk into nearby doors, stay 8–30 s, come back out.
- **Interiors** (`interiors.js`): every CORNER SHOP, DINER, CLOTHING, GARAGE, BANK, CLUB, WAREHOUSE and APARTMENTS building has a 🚪 ENTER door (196 in total; the player's own apartment excluded). Each interior is a zone (`in-<type>`) with 2.5D furniture, staff/patrons and USE targets: shop, diner menu, boutique + mirror, tuning + tool chest, teller (market) + vault (heist banks), club venue + dance floor, warehouse crates/pallet (crafting materials, 20-min refill), lobby mailboxes. Save: `nightshift-interiors-v1`.
- **Wayfinding** (`wayfinding.js`): "ENTERING <DISTRICT>" banners with what the district is good for; a NEAR chip under the goal card (nearest place, arrow, metres); tap → "Around you" list (one per kind, nearest first, what it does, GO = road GPS) + a "getting around" crib.
- **Workbench** (`supply.js`, Codex-owned, edited): recipes sorted by how close you are; a "Closest: X · still need" tip; missing materials named on the chips; per-recipe "where to get it" (gather spots with odds, hardware counter/gun-shop prices, warehouse/garage interiors) with GPS.
- **Characters**: `character-pixel.js` now G=3 (132×168 art px per 44×56 cell); `character-art.js` walk 12 / run 10 / sneak 10 / idle 6 frames from smooth curves (`RATE` keeps stride speed); per-frame build budget with cached-pose fallback. Test `sprite-atlas.cjs` updated for the 12-frame loop.
- Checks: `node tests/run.cjs` → 112 suites PASS. Playwright: all 8 interior types enter/target/exit with no page errors; wayfinding panel + GPS; bench tips; fps unchanged vs G=2 (headless software GL ~30–36 steady).

## v0.58 Districts with identity, street gangs, GTA-style police, Bullet Echo combat, slower early guns (owner: "districts shouldn't look or feel the same… NPC gangs and gang blocks… cops never too overpowered unless pushed… chance to get away… progressively harder like GTA… combat harder to see like Bullet Echo… crouched behind a car you don't get hit… early guns slow firing, low durability")
- **Districts** (`world.js`, `city-data.js`, `crowd.js`): each of the 8 outer regions has its own lot/facade/roof/trim palette, sidewalk material (granite slabs, grass verges, brick, market tiles, hazard paint, cracked concrete, boardwalk), street furniture (bus shelters, hedges + picket fences, brick planters + lamps, fruit stalls, barrels + pallets, graffiti walls, shipping containers), tree/palm rules, building mix (banks downtown, houses in the suburbs, warehouses east) and footprints (towers 280×190, houses 220×140, sheds 280×160). People are dressed for the neighbourhood (8 seeded looks per region). Core 5×5 unchanged.
- **Gangs** (`gangs-data.js` pure + `gangs.js`): 6 gangs, each holding 3 blocks (Market Street Mob, Los Diablos, Blue Ridge Kings, Yellow Tape Boys, Violet Saints, Dock Rats). Turf has tags, painted curbs and a flag; crews hang out in their colours (5 looks per gang). Rep per gang: HOSTILE shoots on sight, WARY warns then fights if you loiter (~9 s), shoot on their block or hurt one; FRIENDLY lets you be. TALK: pay respect ($100, +12, 10-min cooldown), friends-only ammo/parts, jobs vs. the rival (3 kills → $350 + rep). Fights: members spread out, take cover behind parked cars, peek and shoot with distance/movement/cover-based misses. Player bullets hit members (game.js bullet loop). Save `nightshift-gangs-v1`.
- **Police** (`wanted-data.js` pure + `crime.js` edits): stars = round(heat). ★1 one cop, never shoots (wants to arrest); ★2 shoots only if you're armed (fired near them / hurt a cop); ★3 shoots on sight; ★4–5 SWAT (tougher, faster, better shots), up to 8 units. Escape: break line of sight and leave the search circle (300–660 px, centred on where they last saw you; hiding indoors counts) → the evade timer drops one star at a time (7–15 s per star). BUSTED meter at ★1–2 if a cop who sees you is on top of you while you stand still (or you're badly hurt). Status line shows stars + what to do.
- **Combat vision + cover** (`combat-vision.js`): when engaged (you fire, get hit, police see you, gang fight) the screen closes to an aim cone + small ring, cut by buildings (darker at night); unseen enemy shots leave red/blue echo rings. Standing still next to a parked car or wall = auto-crouch cover: smaller target, shots across the car are stopped. Officers/gang members crouch in cover too (`character-art.js` stance).
- **Guns** (`weapons-data.js`): pipe 1150 ms/8 shots, zip 680 ms/26, sawn-off 1250 ms/16, street pistol 320 ms/260, compact 260 ms/240, all shakier; new `handling(level)`: shooting level 1 = ×1.25 fire delay / ×1.35 spread → level 10 = ×0.85 / ×0.7 (`weapons.js` passes the skill level).
- **Perf**: `game.js` blocked() uses a per-block spatial grid; `interactions.js` only line-of-sight-checks candidates within reach (it was tracing to every car/door in the 9× city every frame). Headless fps 30–36 → ~55 normal, ~40 in a gang fight after a short sprite warm-up.
- Codex-owned files edited: crime.js, game.js, interactions.js, world.js, city-data.js, weapons-data.js, weapons.js; tests weapons.cjs updated, gangs-wanted.cjs added (registered in run.cjs). `node tests/run.cjs` → 113 suites PASS.
- Not yet: gang hideout interiors with indoor fog fights (break-ins already have Bullet Echo fog indoors), police cars/roadblocks at high stars, map overlay for turf/search circle.

## v0.59 Hideout raids, police vehicles, turf takeovers with guards, NPCs that live (owner: "do one and two… take a gang block, hire people to watch it, give them better gear… make the NPCs really smart from every aspect and have NPCs interact with each other… the world has to feel alive… always something to do or grind for")
- **Gangs v2** (`gangs.js` rewrite, `gangs-data.js`): every fighter has a team (6 gangs + your crew). Units pick the nearest enemy they can actually see, take cover behind parked cars without sharing spots, flank around you (team-mates split sides), call out ("Flank him!", "Man down!", "Reloading!"), reload after bursts, and ~40% run when badly hurt. Gang-vs-gang **skirmishes** every 100–160 s near you (rival crew rolls up on a corner); helping a side earns that gang's respect.
- **Takeovers**: clear a gang corner (all locals down), stand on the dashed magenta ring for 20 s while they send reinforcement waves → `claim()`. Your block: magenta tags, MANAGE point (collect income $60 + $15/guard per 5 min, capped at 6 periods), HIRE up to 4 guards ($250), UPGRADE gear (pistol $400 → SMG + vest $900 → carbine + plates $1800). Former owners counterattack every 6–10 min: on screen your guards fight; off screen it's decided by `defendChance(power)`. Lose all guards with raiders on the corner for 15 s and it flips back.
- **Hideouts**: a RAID door on each gang's first block → `NightshiftBreakin.start({type:'hideout', gang})`: 3×3 rooms, 5 crew in gang colours + a shot caller (150 hp, +$400 on drop) + dog, Bullet Echo fog indoors. Clearing it thins all that gang's corners for 12 min (best time to take one); 30-min cooldown. `breakin.js`/`breakin-data.js` gained the `hideout` type, `boss` guard, gang outfits on guards and `hideoutKill/hideoutDone` hooks; `zones.js` passes outfit/cover/maxHp to actor sprites.
- **Police cars** (`police-cars.js`): ★3 one patrol car, ★4 two + roadblocks (2 cars across an intersection ~650 px ahead of a moving car, officers behind, 45 s), ★5 three incl. a SWAT van. Cars drive the street grid to the search centre (or you when spotted), drop 2–3 officers into crime.js when you're on foot, and ram you when you're driving (4.5 s cooldown, ×0.65 speed, car damage). Lightbars flash. Minimap shows police cars, the dashed search circle, and gang turf (yours magenta).
- **NPC life** (`npc-life.js`): conversations between people standing together (live gossip: gangs, your corners, cops, weather, time), phone/smoke/headphones/snack idles, passers-by reactions, witnesses who call 911 (report + heat 3.5 s later, unless heat ≥ 3). Event director (1–2 at a time, 35–70 s apart, weighted by district): MUGGING (STOP IT / shoot the mugger), STREET FIGHT (BET $50 on red), DICE GAME (ROLL $20, 45%·luck), TRAFFIC STOP (cop questions/cuffs someone; reports you if you're wanted), LOST DOG (GRAB → return), BREAKDOWN (HELP), "LOOKING FOR WORK?" (package run to a door 500–1200 px away, pay by distance). Scripted people leave `peds` while scripted; `game.js` lets bullets hit them (`NightshiftNpcLife.hit`). `character-art.js` stance: `p.squat` → crouch.
- Tests: `gangs-wanted.cjs` adds takeover/guards/income/defence/save checks. `node tests/run.cjs` → 113 suites PASS. Playwright: claim + hire + upgrade + counterattack + skirmish + 7 street events + police cars/roadblock/rams + hideout entry (gang-coloured crew + boss), no page errors. Headless fps ~57 normal / ~54 in a gang fight.

## v0.60 Phone texts instead of pop-ups, city art pass (owner: "city update: roads, city, traffic, NPCs… upgrade the phone, just receive texts for missions and quests, too much stuff pops up in the middle of the screen")
- **Phone** (`phone.js`): replaces the global `say()`. Short feedback → a small pill at the top for ~2 s; anything to read (contact texts from life.js, missions/goals, tips (long hints), gang/street news, police scanner, rewards) → a TEXT: compact banner at the top (tap → thread) and stored in Messages. `#livingNotice`, `#glFlash`, `#skFlash`, `#toast` are hidden; the goal card is one slim line. Goals arrive as texts from Rico ("Next: … + hint", GPS button when the goal has a place) and "✅ Done" when finished. Phone (📱 dock button or P): Messages (threads + unread), Hustle, Goals, Map, Around, Corners (your turf with cash waiting + GPS), Bag, Market, Skills, Dailies, Respect, Radio. Save `nightshift-phone-v1`.
- **City art** (`city-art.js`, hooked from `world.js` ground() so it's baked into the cached tiles): kerbs with shadow + lit edge, tyre-wear bands per lane, patched asphalt, cracks, manholes, storm drains, oil stains, turn arrows, worn crosswalk paint. Traffic gets real models/paint by district (taxis downtown with roof sign, work trucks in Ironworks/Harbor, lowriders in the Flats, nicer cars in the Heights) and brake lights when stopped. Rooftop extras per region (water towers, solar rows, roof gardens, skylights, dishes, pipes, vents, neon trim in the Flats). Core-district people dress for their area too.
- Checks: `node tests/run.cjs` → 113 suites PASS. Playwright: phone dock button opens/closes, threads/notes routed, no page errors. Headless fps ~50–58.

## v0.61 Playability + placement pass (owner: "still feels unplayable and unfinished, blocky, things aren't placed where they're supposed to be")
Audit at iPhone landscape size (852×393, touch) from a fresh save, then fixes:
- First step outside no longer starts the 9-step blocking controls tour (spotlight misaligned on phones); instead three small hints over the real sticks/action button that fade on first touch or after a few seconds (`guide.js` quickHints; full tour still in ❓).
- Apartment: camera fills the phone screen and follows you (`home.js`, Codex-owned); debug-style furniture captions removed (`sprite-renderer.js`).
- Apartment entrance moved from the middle of the Midtown junction (880,680) to the corner door of the APARTMENTS block (952,744, `interactions.js`), with a real entrance drawn there (`city-art.js`). Leaving home now puts you on the sidewalk, not in the intersection.
- Props in the road moved onto walkable sidewalks: 7 salvage crates (`salvage.js`), supply cache + two aid calls (`street-encounters.js`), Southside trap house door (`breakin.js`), gang crews/hold points/TALK points (`gangs-data.js`, `gangs.js`). Tests updated to the new coordinates.
- World signs (`NightshiftSign`, fx.js) collapse to small icon pins beyond ~210 px; full label when you're near (GPS destination always full).
- MORE menu trimmed to Style, Bag, Craft, Rob, Give up, Car, Sound, Map, Saves, Ctrl, Street (the rest live on the action button or the phone); NEAR chip removed; home stash panel styled with the close button on top.
- Big map: fills the panel height and draws the real city art (minimap base) with gang turf instead of grey boxes (`city-map.js`, `minimap.js` exposes `base()`).
- Checks: 113 suites PASS; headless fps 54–58; no page errors in the audit run.

## v0.62 High-detail pass (owner: "go really high detail for the next run on everything")
- **Resolution**: the game canvas was capped at 2x (and stepped down further when slow) on a 3x iPhone, so everything was upscaled. `render-quality.js` now allows up to 3x (7.5 M px budget); `fx.js` adaptive steps are 3 → 2.5 → 2 → 1.5 → 1, stepping down only if frames stay slow. Test `render-quality.cjs` updated.
- **Ground**: `world.js` tiles are 660×510 baked at 2x (LRU 12), so road paint/kerbs/cracks are crisp. `hd-art.js` adds fine asphalt grain, paver joints and kerb stones (called from city-art roads, baked once).
- **Buildings** (`hd-art.js`, live per visible building): facade material by district (brick / siding / board-marked concrete), roof membrane seams and gravel, parapet highlight + inner shadow, drip stains, drainpipes with brackets, window mullions, sills, glass sheen + glints, curtains or blinds at night, shop kick plates, roller-door slats.
- **Cars** (`hd-art.js`): body specular streaks, panel seams, door handles, mirrors, windscreen/rear-glass reflections, tyre tread.
- **Characters** (`character-pixel.js`): authored on the G=2 grid where faces/seams/logos are tuned, then EPX/Scale2x upscaled to 176×224 (smooth silhouettes and diagonals, clearer faces); sprite cache 420.
- **Interiors**: `zones.js` bakes zone grounds at 2x; `interiors.js` floors/walls get wood grain, tile grout, carpet pile, wallpaper and light pooling. Zone entry title is now a small line at the top.
- **Minimap**: renders the city straight into its small canvas (the old world-sized temp canvas was over the iPhone canvas limit).
- Salvage crates moved clear of benches (tests follow). 113 suites PASS; headless fps ~54–58 (renderer stepped to 2.5x in the software headless browser).

## v0.63 Modern city (owner: "every block looks the same… feels set in the 1900s, should look modern")
- `modern-city.js` (Claude, new; loads after crowd.js) replaces `NightshiftWorld.building` with five present-day archetypes picked per building: glass towers (banks/offices, downtown + market apartments), mid-rise (panel/timber cladding, glass-rail balconies, roof terraces, solar), glass storefronts with brand lightboxes, ribbed-metal industrial with numbered roll-up doors, and LED clubs with video walls. It also adds animated digital billboards, modern traffic models with LED light bars, e-scooter riders, delivery robots, and earbuds on pedestrians. The old awning/sign actors are turned off while it is on; hd-art facades and city-art rooftops are gated on `NightshiftModern.on`.
- `city-data.js` (Codex file, edited by Claude): about 45% of outer blocks get a lot, which is deterministic per block. The lot types are parking, plaza, court, park (kiosk), gas (store plus canopy) and twin (two buildings with an alley). The building count is now 206 (was 196). Lot footprints always end at y+245 or above, so the bottom sidewalk stays clear. Lots are painted into the baked ground by `NightshiftModern.lots`, called from city-art `roads()`. The gas canopy is drawn live and fades when the player is under it.
- NPC and weapon looks: the downtown crowd lost its trench coats and fedoras, the fedora was removed from random NPC outfits, and Old Town now wears hoodies, sneakers and caps. The pump, hunting rifle and revolver have polymer, FDE or rubber furniture. The crude pipe, zip and sawn-off guns stay crude on purpose.
- Checks: `node tests/run.cjs` passes (113 suites). Headless fps is about 57–60 after warm-up (first sample about 38 while tiles bake).

## v0.64 Big batch: story, driving, melee, businesses (owner: all four, "remember multiplayer later")
Everything below is built for a shared world. The world never pauses (no cutscenes, story is phone texts), progress/ownership saves are plain data keyed by stable ids, rules live in pure `*-data.js` modules a server can reuse, and gameplay events go out on one bus: `window` `ns:event` CustomEvents (kill, melee, takedown, roll, pickup, drift, service, race, buy, collect, robbery, defended, robbed, chapter).
- **Melee** (`melee-data.js`, `melee.js`): 👊 button (tap = swing, hold = switch) + ROLL button on the action bar; with no gun the AIM/FIRE stick swings. Fists/brass/knife/bat/wrench/machete with combos + finishers, soft-lock, knockback/stagger, takedowns from behind on unaware targets (knife = quiet), dodge roll with i-frames (wraps `NightshiftRecovery.damage`). TOOLS counter next to the gun shop; gang members drop weapons. Save `nightshift-melee-v1`.
- **gangs.js**: `squad({x,y,gang,n,tag,boss,meleeOnly,hp,vs,hunt,onDeath})`, `clearSquad`, `alive(tag)`, `push`, `strike`. Squads are alert (no takedowns), bosses don't flee and get a name/HP label. Units get stun/knockback, close-range melee with a short wind-up, and they push you while you reload.
- **Driving** (`driving-data.js`, `driving.js`): BRAKE + steer at speed = drift (slip angle drawn, skid marks, smoke, chains pay cash + Driving XP, crashes cancel the chain). NOS button while driving (nitro bought at gas stations). Visible damage: dents, then hood smoke, then fire. Gas station FUEL points under the canopies sell fuel, repair, nitro and a wash. `races-data.js` has 3 new outer-district courses (Fairview Figure, Downtown Sprint, Ironworks to Harbor); `races.js` emits `race` events. The races test now accepts any k*440/k*340 road line.
- **Properties** (`property-data.js`, `property.js`): 147 storefronts, gas stations, clubs, garages and warehouses outside the core are for sale (door point BUY/MANAGE). Registers fill in real time (capped at 6h), with stock/security/guard upgrades and sell-back. Robberies happen live near you (squad + 75s timer, your guard helps) or resolve on the odds when you're away. 🏪 Business phone app. Ids `p-<x>-<y>`, each with an `owner` field. Save `nightshift-property-v1`.
- **Story** (`story-data.js`, `story.js`): 8 chapters (Rico, Nia, Capt. Hale, Vex/the Crown) using goto/squad/event/state/escape steps. Bosses are world squads that spawn when you're near (Knuckles, Marrow, Silk, Vex). The pink story card replaces the goal card while a chapter is active (tap = GPS), and there's a 📖 Story phone app. Save `nightshift-story-v1`.
- **phone.js**: new contacts (nia, hale, vex, biz) and the Story/Business apps. **weapons.js**: when unarmed, the pill shows your melee weapon.
- **Checks**: `tests/batch64.cjs` added. `node tests/run.cjs` passes all 114 suites. Playwright confirmed melee KOs, a ped takedown, roll i-frames, the drift chain and skids, gas station service, buying a property, a live robbery spawning, and Story chapter 1 completing end to end (bat reward). Headless fps is 59–60 after warm-up.

## v0.65 Combat mechanics, police engagement, break-ins (owner: "focus on how it would work even in multiplayer")
- **`combat-core.js`** (pure, meant to run unchanged on a future server) holds the shared combat rules:
  - **Shots:** seeded mulberry32 randomness, so the same inputs give the same pellets on every machine.
  - **Damage:** distance falloff by weapon class; armor with penetration per class; stance multipliers (cover ×0.5, roll = dodge, car ×0.4); sneak ×2.5 on unaware targets.
  - **Life states:** alive → downed → bleeding → killed, plus revive.
  - **Teams:** `canDamage` gives no friendly fire between players and crews in PvE; 'crews'/'ffa' modes are ready for PvP.
  - **Network:** the `hitEvent` schema with a 14-field `pack`/`unpack` wire format.
  - **Server checks:** `validate` (stale time, shooter position, range, fire rate, line of sight, damage cap) and `rewind` (lag compensation from snapshot history).
- **`authority.js`** is the local stand-in for the server: every city hit goes through it.
  - `game.js` now hands its player-bullet hit branch to `NightshiftAuthority.bulletHit`. `weapons.js` stamps `ox`, `oy` and `seed` on each bullet.
  - Damage to the player arrives as `NightshiftRecovery.damage(amount, now, src)`. The `src` gives the direction and the kind; the call sites in crime/gangs/zones/breakin/melee pass it, and the weapons/skill-effects wrappers forward it.
  - **Features:** red directional damage indicators; taser stun (no moving or shooting); suppression (your rounds make gang members and cops duck and aim worse); a ring log of hit events with `seq`; `ns:event` hit/downed/revived/officer-down/busted.
  - **Downed state** (city, on foot): 20 s bleed-out with crawling and last-stand shooting. Hold 💉 GET UP with a medkit, or your crew/guards revive you. Cops cuff a downed suspect (BUSTED) and never shoot one. Gangs mostly stop shooting. Bleeding out leads to the old hospital flow. Inside zones, the old death flow still applies.
  - `skill-effects.js` skips its extra-hit hack while `root.__nsAuthorityHit` is set, which melee also sets.
- **`police-engage.js`:**
  - ★1 cops tase you if you run; ★2 tasers unless you're showing a gun; ★3+ lethal force; SWAT get armor (45/60) with a small bar drawn.
  - Radio call-outs: spot, taser, shots fired, cuffing, officer down (+heat), lost visual.
  - `respond(x, y, n)` puts units outside a door.
  - `wanted-data` `bustStep` gets `helpless` (tased or downed: cuffed at any star level in about 0.8 s). `crime.js` passes `helpless`, doesn't fire on downed suspects, and its hit message spam is removed.
- **Break-ins:**
  - New `breakin-data` type `store`: sales floor, checkout registers, stockroom, office safe, staff lockers. It has an alarm `panel` (9 s countdown, longer with stealth; disarm with the new `alarm` keypad minigame in `picks-data`) and 2 CCTV cameras with sweeping cones. Getting seen for 0.7 s trips the alarm, and you can shoot a camera out.
  - Warehouses and mansions get 1 camera.
  - Every business you don't own in the outer districts gets a 🔦 BREAK IN point at night (21:00–05:00). Leaving with the alarm going emits `breakin-exit`, and police wait outside.
- **Checks:**
  - `tests/combat65.cjs` added; `node tests/run.cjs` passes all 115 suites.
  - Playwright: bullet hit logged via the authority; downed → medkit revive (hp 45); ★2 taser → stun → BUSTED; ★4 downed → cuffed; store break-in zone with panel and cameras.
  - FPS: city 56–59 headless. Gang fight 40–51 headless; the rAF profile shows the new modules cost under 2 ms per second, so the gap is canvas rendering.

## v0.66 Nightshift Garage cars + Route 9 highway (owner: "bring the cars over… when u hop on the highway it becomes a garage-type game")
- **Garage cars** (owner-authorised to bring over from the Nightshift Garage repo; only names/specs were copied, no code):
  - Added to `cars-data.js`, with `garage`, `drive`, `kmh` and `hp` fields: BMW M4 F82, Honda Civic EF, Dodge Charger 440, Nissan Silvia S15, Ford Mustang GT, Lamborghini Gallardo.
  - `cars.js`: new `coupe` body, plus `stripes:false`, `wing:false` and `SIG[id]` signature details (M4 kidney grille + quad tips, Charger hidden-headlight grille + bumblebee stripe, S15 drift wing, Mustang tri-bar tails, Gallardo engine louvres).
  - `driving-data` drift now depends on drivetrain (RWD > AWD > FWD).
  - The `tests/cars.cjs` message now says 16 models.
- **Route 9** (`highway-data.js` pure, `highway.js` runtime): a ring road around the city with 6 on-ramps on the edge roads, each with a green ROUTE 9 sign and chevrons; driving through one at speed enters the highway.
  - **Display:** rendered through NightshiftHome render hooks like `zones.js`, with `HM.kind` returning 'highway' so city modules idle.
  - **Driving:** stick right = gas, left/BRAKE = brake, up/down = lanes, NOS = nitro. Acceleration is hp-based for real cars; gears and rpm are shown in the bottom HUD.
  - **Traffic:** keeps lanes and signals lane changes. Near misses build the Garage streak table, paid out when you exit.
  - **Speed cameras:** 120 km/h limit; tickets over 150, heat over 200.
  - **Police by stars:** pursuit cruisers (spawn after 6 s, no stacking, PIT with a cooldown), spikes at ★3, roadblock with a gap and helicopter at ★4+, evade by distance, busted when stopped.
  - **Races:** Mika (S15), Jules (M4) and Rook (Mustang); pull alongside → 🏁 RACE to the exit after next.
  - **Route 9 services** (fuel, repair, nitro via driving-data quotes; Rook's Tuning → `NightshiftTuning.open`; meet challenges; highway runs against the clock).
  - **Exits:** move onto the shoulder at an EXIT; you drop back at that district's ramp. Totaled → towed.
  - Save: `nightshift-highway-v1`.
- **Multiplayer note:** I started a second MP stack this session and removed it again. The repo already has one: `shared/` + `server/` + `online/online.js` (presence, chat, opt-in PvP) on the live worker (`worker/LIVE_URL`). The live worker was not touched. A next MP step would be to move `combat-core.js` hit validation into that server (`server/room.js`), but that changes the live worker, so it needs the owner's OK.
- **Checks:**
  - `tests/highway66.cjs` added; `node tests/run.cjs` passes all 116 suites.
  - Playwright: enter via the West End ramp, accelerate, ★3 cruisers, race start vs Mika, rest-stop panel (9 rows) + run accepted, exit → Downtown drop-off on the road.
  - FPS: city 60, highway 60 headless.

## v0.67 Garage-quality art: side-view Route 9 + image pipeline (owner: "the cars look terrible compared to Garage, same quality everywhere")
- **Why the gap:** the Garage art is painted image files; City Online's art is drawn by code. The fix is images: the code art stays only as a fallback.
- **Route 9 is now a Nightshift Garage–style side view** (`highway-side.js`; `highway.js` keeps the sim and falls back to its top-down view until the images load).
  - **Art in `art/garage/`** (copied from the Garage repo with the owner's OK):
    - `track.jpg`, used for the skyline/fence/barrier.
    - The six car PNGs. Rims are spun from each car's own art; wheel circles come from the Garage WHEEL_MAP.
    - The police Charger + Crown Vic, with live light bars.
  - **Traffic:** re-painted from the six with a hue blend.
  - **Road:** procedural wet asphalt + lamp reflections.
  - **Signs:** gantries, exit/services signs, cameras.
  - **Scale:** cars are 110 highway px long (`H.CAR_LEN`; collisions/spacing updated).
- **Image pipeline (`art-assets.js` + generated `art-manifest.js`):**
  - Hooks: `cars.js bake()` (`art/top/cars/<id>.png`), `modern-city.js draw()` (`art/top/buildings/<archetype>-<n>.png`), `weapon-art.js sprite()` (`art/side/weapons/<gunId>.png`).
  - `online/build-online.cjs` copies `art/**` and writes the manifest. Exact sizes, views and a generator prompt are in the new ART_SPEC.md section "Image assets"; the reference sheet is `docs/art/garage-pack-reference.jpg`.
  - Characters are spec'd, with no hook yet.
  - Verified with test PNGs in a built site: the car swapped in, and models without an image kept the code art.
- **Asking the owner:** the 25-car / 25-rim Garage pack as separate PNGs (it would go straight onto Route 9), and who generates the top-down sets (ChatGPT image gen per the spec).
- **Checks:** `node tests/run.cjs` passes all 116 suites. Playwright: side-view race vs Mika, rest stop + run, ★2 pursuit; 60 fps on the highway.

## v0.68 — HD top-down cars (Claude)
- New `car-hd.js` (NightshiftCarHD.bake), hooked from `cars.js` bake after the image hook, so a real PNG in `art/top/cars/<id>.png` still wins.
- Procedural HD sprites: curved per-body profiles, contact shadow, tyres peeking out of fender bulges, cylinder shading with a key-light streak, clear-coat bands, multiply contrast pass, rim light + outline, shut lines, glass greenhouse, pillars, mirrors, per-family head/tail lights, diffuser/exhaust, liveries and signature details.
- Falls back to the legacy baker on any error. Tests: `node tests/run.cjs` → 116 suites PASS.

## v0.69 — big batch (Claude): controls, smart NPCs, HD weapons/characters, car kits, city edge, multiplayer combat
- **Driving controls** (`drive-input.js`, game.js car branch): screen-relative steering by default — push the stick the way you want to go; pulling behind the car brakes, then does a three-point turn; a car wedged against a wall backs out by itself. Old tank steering is a phone toggle (🎮 Steer: Screen/Tank, saved as `nightshift-drive-mode`). Route 9 side view was already screen-correct.
- **NPC minds** (`npc-mind-data.js` pure + `npc-mind.js`): every pedestrian becomes one of 40 seeded residents per district (name, age, job, 2 traits, like, gang tie, secret) — same people for every player. They witness kills/shootings/robberies/fights/hit-and-runs/helping and remember it (opinion −100..100, memory log); personality decides flee/hide/FILM (heat if you let them finish)/CALL 911/CONFRONT (shove)/CHEER; they recognise you later (fans wave + small gifts, haters flee or glare); gossip spreads opinions between people chatting; they dive out of the way of speeding cars. 🔍 name tag over the nearest person (tap, or I) opens a profile card: portrait, traits, mood, opinion bar, memories, secret (unlocks at 40+ opinion, lower with charisma, or LEAN ON THEM), TALK (rumours/small talk, +3/day), TIP $20, PAY THEIR DEBT, MARK THE STASH (cash pickup). 📱 People app lists everyone you've met. Save `nightshift-minds-v1`. Hooks: NightshiftCrime.attempt, NightshiftEncounters.use/draw, ns:event (hit/kill/officer-down/melee).
- **HD weapons** (`weapon-hd.js`): replays every weapon-art builder through a recording buffer and renders it at 4× as shaded vector art (bevels, gradients, brushed steel / polymer stipple / wood grain / chrome sheen, camo, glowing lasers/optics, ink outline). Anchors unchanged; `nativeScale` contract; weapon-art drawHeld/icon/inspect handle `s.hd`. premium-pistol-art skips HD sprites. Toggle off with localStorage `ns-weapon-hd=0`.
- **Combat FX** (`combat-fx.js`, visual only): bodies fall over (sprite rotated onto the ground) with spreading blood pools for 25 s instead of vanishing; hurt characters flash + 3px knockback + blood droplets/stains; muzzle flash light + ejected brass casings.
- **Car customization**: Vehicle Studio gains 🧱 Body kit (splitter + skirts, drift aero, bolt-on widebody) and ⬇️ Stance (lowered, slammed + camber), and rims bronze mesh / turbine / white six-spoke. Drawn in car-hd (top-down). New `highway-style.js` puts your build on the Route 9 Garage art: custom spinning rims with calipers, lowered body, kits, overfenders, spoilers/wings, livery along the door line, tint, underglow.
- **City edge**: the edge row/column of blocks (no buildings by design since v0.62, 29 bare grey slabs incl. the Route 9 ramps) are now painted open lots in the baked ground: parkade, night market, skatepark, solar farm, court, community garden, billboards, rail yard, container stacks, park (modern-city `edgeLots`). No collision change.
- **Multiplayer combat** (server/shared/online, NOT deployed to the live Worker): shared-world PvP shots now carry the weapon id + lag; the server resolves damage with combat-core and the weapon catalog (falloff, shotgun pellets summed, per-weapon cadence; unknown ids = old pistol rules), rewinds targets to where the shooter saw them (position history, capped 250 ms), net-client measures RTT with ping/pong. Also fixed a live bug: RULES.world was still 2200×1700 since the 9× city, so presence positions beyond it were rejected (players froze server-side) and saved positions were clamped; rules now 6600×5100 and the server uses the loaded city's bounds. city drift test rewritten for the generated catalog. Dockerignore allowlists combat-core.js + weapons-data.js. **Needs owner approval to redeploy the Cloudflare Worker.**
- Checks: `node tests/run.cjs` → 117 suites PASS (new tests/batch69.cjs); `cd server && npm test` → 113 pass, 0 fail (new pvp69.test.cjs; city/presence suites were failing before this batch and now pass). Two-browser e2e against a local server: AR hits applied (100 → 56 hp after 2 hits). Headless fps unchanged vs v0.68 (33/56/51 vs 31/58/53).

## v0.70 Option 3 (Claude)
See HANDOFF.md CURRENT v0.70. Build order (play repo online/build-online.cjs): o3-engine.js first; o3-character.js before character-pixel.js, o3-runtime.js after; weapon-kit-data.js, weapon-kit.js before weapon-hd/weapon-art; car-views.js before carstyle.js; o3-pet.js before pets.js; LATE_SCRIPTS o3-props.js, prop-art.js. Owned by Claude: all o3-*.js, weapon-kit*.js, car-views.js, tools/o3-*, tools/validate_o3.py, art/o3/.
