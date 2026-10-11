# HANDOFF — Nightshift City Online

## CURRENT — v0.13 traffic, audio and visual pass (2026-10-10)
Added traffic.js with eight nonoverlapping cars on two authored rectangular road loops, forward spacing/parked-car checks and collision damage for players/vehicles. Hospital recovery now has 2.5 seconds damage protection. Audio.js adds opt-in synthesized gun/reload/impact/pickup effects and speed-based engine tone; SOUND/MUTE starts AudioContext only on user gesture, focus loss silences engine. Actual browser audio unverified.
Cars/characters gain procedural pixel details and roads have sidewalk/curb borders. Internal Canvas-only render inspection using @napi-rs/canvas caught parked vehicles inside buildings; vehicle bootstrap now moves obstructed car footprints to clear road positions and regression checks validate no car center is blocked. Canvas render test source included but its optional library is not a project dependency and it is not CI-run. No HTML/touch layout verification from this renderer.
Executed: npm run check PASS, eleven suites plus module syntax. Integrated test verifies eight distinct traffic spawns and movement. New traffic test checks timestep and corner traversal. Persistence tests retain vehicle/cargo/custody checks. node tests/render.cjs completed and rendered world PNG was inspected internally. Browser/Safari touch, HUD and audio still pending; no multiplayer or deployment.
Touched: traffic.js, audio.js, game.js, index.html, vehicles.js, recovery.js, tests/traffic.cjs, tests/render.cjs, tests/home.cjs, tests/persistence.cjs, tests/run.cjs, package.json and shared docs.
Limitations: traffic simple loops not navigation/signals; synthesized sounds are placeholders, not real car recordings; sprite art procedural; local menu/interior pause remains. Need real-browser pass before claiming iPhone playability. Authoritative backend is Claude-owned and not implemented. Preserve this separate project and do not add paid services/deploy without authorization.
Next concrete milestone: hosted test preview and actual browser/iPhone QA, then scene modularization/Phaser migration and server-authoritative multiplayer. Source is ready for a reviewable preview deployment once authorized.


## CURRENT — v0.12 vehicles, cargo and client modules (2026-10-10)
Added vehicles.js: saved car-N identity, position/color/fuel/condition, starter car owned, others buyable for $900 or stealable via 3-second nearby lockpick; movement away interrupts theft. Theft adds heat. USE requires owned/stolen vehicle. CAR panel displays status; garage entrance proximity enables fuel at $0.80/% and repair at $1.50/%, only charging missing amounts. Driving consumes fuel; empty tank/zero condition disables powered acceleration; high-speed crashes reduce condition. Gloveboxes reference explicit car.id and persist separately from carried inventory. Stolen cars remain accessible locally, so glovebox safety is only from character death.
Courier job stage persists; pickup creates carried parcel, delivery consumes parcel before reward, cargo follows normal death/storage rules. Missing cargo cancels the job on JOB action. Crime saves ground NPC cash pickups and restores them across reload. Secondary action buttons are behind MORE/LESS tray (CSS not visually verified). Client simulation extracted from inline HTML to game.js; external script ordering remains under integration tests.
Executed: npm run check PASS, ten suites plus all module syntax. Fresh-context tests verify car ownership/state/glovebox, courier cargo/stage/reward-once and delayed theft/heat persistence. Existing death/stash/combat/police/navigation tests pass. Browser/device visual QA pending (no Chromium available), no deployment or multiplayer.
Touched: vehicles.js, interface.js, game.js, index.html, inventory.js, crime.js, activities.js, home.js, tests/vehicles.cjs, tests/persistence.cjs, tests/smoke.cjs, tests/run.cjs, package.json and shared docs.
Known limits: current car-N IDs map to fixed spawn catalog; future catalog needs globally unique authored IDs. No vehicle theft by other players, police impound or glovebox search rules. Theft is simple local timer; menu/interior pause remains. Fuel repair balance is provisional. LocalStorage snapshots not server transactions. Art temporary; actual mobile HUD not yet verified.
Next: real-browser QA; traffic and more detailed vehicle handling; audio/feedback; move globals into modular scene architecture before Phaser migration; authoritative backend remains Claude-owned. No paid service or deployment authorized.


## CURRENT — v0.11 pursuit, projectiles and persistence (2026-10-10)
Branch codex/mobile-controls-v03, PR #1. navigation.js implements collision-grid BFS routes with clearance, sampled wall tracing and segment-circle impacts. Officers route around buildings, repath once per second and shoot visible red tracer projectiles. Police damage happens only on projectile impact; walls stop fire. Player bullets now also use swept collision against NPCs/officers and walls. Zero-heat/surrender clears police bullets.
Crime state persists locally: stable npc-N IDs preserve robbed/dead NPC states and wallet depletion; heat survives refresh and saves after shots. NPC death cash reward comes from remaining wallet, preventing double-payment after robbery. NPC positions and dropped NPC cash pickups do not persist; this is still local simulation, not server authority.
Mobile joystick centers scale with control size. Portrait sticks narrowed to reduce overlap; landscape aim moved beside action grid. CSS changes not visually verified. package.json adds npm run check; tests/run.cjs runs nine suites and all JS module syntax checks. GitHub Actions runs the same Node 24 checks.
Validation: npm run check PASS (nine suites). Integrated HTML-order test verifies police bullets need flight time, cover stops shots, surrender and existing custody/recovery. New navigation suite checks wall routing/unreachable endpoints/swept hits. New fresh-context persistence suite verifies NPC robbery/death, heat, exact magazine/reserve, death bags and protected stash across reload. git diff --check PASS. No actual browser QA: no browser executable is available; previous Chromium download failed. Browser harness remains available for configured environment.
Touched: navigation.js, crime.js, index.html, home.js, tests/navigation.cjs, tests/persistence.cjs, tests/home.cjs, tests/smoke.cjs, tests/run.cjs, package.json, .github/workflows/check.yml, README.md, HANDOFF.md, PROJECT_STATE.md, NEXT_TASKS.md.
Limitations: placeholder graphics; small grid navigation (no car pursuit/tactical formations); local menu/interior pause; no multiplayer, server, PvP robbery, vehicle searching or deployment. Officer/projectile state restarts on reload but heat persists and redispatches. Browser/Safari and CI execution not independently verified yet.
Next: execute browser/device QA, modular Phaser migration, traffic/vehicle identity and search rules, server inventory/crime authority on Claude-owned backend branch. No human permission needed for ordinary client iterations; do not deploy or add paid services without authorization.


## CURRENT — v0.10 NPC crime and police (2026-10-10)
Added crime.js: ROB threatens nearby unrobbed living NPC when carrying a pistol, transfers finite NPC wallet into carried cash, adds heat and triggers fleeing. Police dispatch after 3 seconds, up to 3 on-foot officers, pursue last seen position, use building-blocked line of sight, shoot every 1.2 seconds in range. Player bullets damage officers; killing officers raises heat. Break sight for 6 seconds then heat decays. GIVE UP charges up to $150 from carried cash and returns to West End; stash/glovebox remain untouched. Police can damage occupants (reduced damage) while driving. Death still uses full carried-loot drop and hospital recovery.
Critical startup fix: combat.js now loads BEFORE inline client code referencing NightshiftCombat. Old harness loaded combat first independently and missed broken HTML order. Integrated home test now executes every script in actual HTML order, including crime.js.
Executed: node tests/smoke.cjs; activities.cjs; home.cjs; combat.cjs; recovery.cjs; inventory.cjs; crime.cjs — all PASS. Home integration covers robbery reward/no repeat, dispatch, police damage and surrender in addition to existing custody/home checks. Syntax and diff checks pass. Actual browser/mobile visual and touch QA remains pending; no deployment or multiplayer.
Known limits: police simple axis collision steering (no pathfinding, vehicles, roadblocks or tactics); NPC robbery wallets/robbed state reset on refresh; local-only client authority; gameplay pauses in local menus/interiors. Officers use direct hit damage rather than visible bullet projectiles. Status HUD not visually verified and may need mobile spacing work. No player-to-player robbery or NPC bag looters.
Touched: crime.js, index.html, tests/crime.cjs, tests/home.cjs, README.md, PROJECT_STATE.md, NEXT_TASKS.md, HANDOFF.md.
Next: browser QA first, more robust NPC/police navigation and persistence, police projectile feedback, safer HUD and server-authoritative crime/inventory. Claude backend remains separate.


## CURRENT — v0.9 full carried custody (2026-10-10)
Carried cash, magazine+reserve ammunition, pistol and all pocket item types drop on death. Home stash and per-car gloveboxes survive. Carrying a pistol is required to fire; replacement pistols cost $150 at corner shops. Ammo transfers preserve total rounds and obey combined 270-round carried cap. Dropped bags display in world and persist locally across refresh until their existing two-minute expiry. LOOT recovers nearby bag contents up to capacity; remainder stays in bag. Inventory snapshot stores wallet, ammunition and magazine for reload-safe local custody. Legacy v0.8 saves migrate with starter pistol. No server or other-player looting yet.
BAG/BOX/home storage now open tap-based panels with Store/Take controls. Cash moves up to $100 per tap; ammunition up to 30 rounds; other items one per tap. Gameplay pauses while panel is open. No drag/drop implementation.
Tests: all six suites smoke, activities, home, combat, recovery, inventory PASS. Home integration now loads inventory and verifies death drops cash, ammo/weapon loss and bag recovery. Syntax and diff checks pass. Real browser/iPhone QA remains pending; no deployment.
Known limitations: localStorage has no server transaction guarantees; bags expire after two minutes, latest 100 loaded; vehicle identity is car index (stable current layout only); gloveboxes protect against character death only, vehicle theft/search not implemented; no multiplayer robbery. No NPC looters yet.
Touched: inventory.js, index.html, recovery.js, home.js, activities.js, tests/home.cjs, README.md, PROJECT_STATE.md, NEXT_TASKS.md, HANDOFF.md.
Next: real mobile QA, robbery/vehicle search rules, stable entity IDs and authoritative server inventory with transactional transfers and persistent bags. Claude backend work remains separate.


## CURRENT — v0.8 risk inventory (2026-10-10)
Added inventory.js: pockets (risk), secure home stash, per-car gloveboxes, validated single-item transfers, locally persisted containers, and dropped loot bags on death. BAG inspects inventory; LOOT retrieves nearby dropped bag within two minutes; BOX opens glovebox while in vehicle; apartment STORAGE opens home stash. Initial pocket items are scrap x2 and watch x1. On death, pockets drop at death coordinates, secure containers remain untouched. Loot bags exist only in current page session and expire after two minutes; refreshing loses dropped items. Cash and equipped ammunition are NOT yet included in droppable inventory; this is not the full requested 'lose everything' rule. NPCs/other players cannot loot bags yet; no multiplayer. Browser prompt UI is temporary and not touch-polished. Added tests/inventory.cjs; test authored but not executed this turn. Run node tests/inventory.cjs plus existing suites and perform actual iPhone QA. Next: full carried equipment/cash rules, loot persistence, NPC robbery and authoritative multiplayer inventory.


## CURRENT — v0.7 shops and recovery (2026-10-10)
Branch codex/mobile-controls-v03, PR #1. Added recovery.js: corner-shop service menu, ammo at $2/round (up to 30 per purchase, 240 reserve cap, partial packs charged only for delivered rounds), first aid $40 (up to 40 HP; no charge at full health), vehicle collision damage above speed 4, three-second hospital recovery with up-to-$100 fee capped by cash. Recovery cancels reload, releases vehicle, clears bullets/input and returns player to safe West End intersection (440,340) with full health and cleared heat. Zero-health saves recover on first frame. Shop/recovery blocks gameplay actions and pauses city simulation.

Executed: node tests/smoke.cjs; node tests/activities.cjs; node tests/home.cjs; node tests/combat.cjs; node tests/recovery.cjs — all PASS. Home integration additionally verifies lethal damage, car release, action lock and delayed respawn. Tests use Node DOM/Canvas mocks. Real browser/Safari visual/touch verification remains pending (previous Chromium download failure). No deployment or multiplayer.
Touched: recovery.js, index.html, home.js, activities.js, tests/home.cjs, tests/recovery.cjs, README.md, PROJECT_STATE.md, NEXT_TASKS.md, HANDOFF.md.
Next: real browser/mobile QA; collision/aim/visibility improvements; active police AI; Phaser migration; independent Claude multiplayer server work. Recovery damage currently comes from high-speed crashes; no enemy fire/police combat yet. HUD/art remain placeholders. Local client economy is not suitable for multiplayer authority.


## CURRENT — v0.6 combat economy (2026-10-10)
Added combat.js with a 30-round magazine, finite reserve ammunition (90 default, 240 cap), 1.3-second reload, partial reload when reserve runs low, reserve persisted in existing local save, and reserve/reload HUD status. Tests/combat.cjs added; existing Node simulation harnesses updated to load combat.js. IMPORTANT: tests were authored but NOT executed in this session; run `node tests/smoke.cjs && node tests/activities.cjs && node tests/home.cjs && node tests/combat.cjs`. Real Safari and Chromium QA still pending. Current work remains on codex/mobile-controls-v03 PR #1, not merged/deployed. Next: implement shop ammo purchases and player death recovery, then real browser QA. No backend/multiplayer yet.


## CURRENT — v0.5 homes and style (2026-10-10)
Branch: codex/mobile-controls-v03, PR #1. Local single-player Canvas prototype, independent of Garage. Adds home.js: saved skin/shirt/hair character choices, style dialog, furnished walkable apartment, furniture collision, wardrobe, bed healing, storage save interaction and safe return to exterior. HOME opens owned apartment while on foot. USE interacts near bed/wardrobe/storage/exit. World simulation pauses indoors and during customization; indoor firing/reload is blocked. Mobile action buttons use compact grids with landscape CSS. These layouts are NOT visually verified.

Tests executed: node tests/smoke.cjs, node tests/activities.cjs, node tests/home.cjs — all PASS. Home integration harness loads all scripts and checks profile validation, apartment price/entry, indoor weapon lock, movement/exit and rest healing. Node DOM/Canvas mocks do not verify real touch or visuals.
Browser attempt: node tests/browser.cjs blocked because Playwright Chromium executable is absent; browser download failed with truncated archive. Browser smoke source is included for a configured environment (`npm install --no-save playwright`, `npx playwright install chromium`, serve on port 8080). Real Safari/iPhone QA pending.

Touched: index.html, activities.js, home.js, tests/home.cjs, tests/browser.cjs, README.md, HANDOFF.md, PROJECT_STATE.md, NEXT_TASKS.md.
Known limits: storage only saves progress, no item inventory; rooms are local overlays, no visitors/server; style has color choices rather than full sprite outfit catalog. Zero health still needs death recovery. Infinite instant reload remains. No Phaser migration, real multiplayer, police response, finished art or deployment.
Next: real mobile layout/twin-touch QA; finite ammo/timed reload and health recovery; modular Phaser migration; Claude backend/protocol foundation on separate branch. No deployment without authorization.


## CURRENT — v0.4 gameplay extension (2026-10-10)
Added activities.js loaded by index.html: courier pickup/dropoff job with $225 reward, on-screen objective direction/distance, and locally saved apartment purchase for $1200. Added tests/activities.cjs (test source written; execution NOT independently verified). Run `node tests/smoke.cjs && node tests/activities.cjs` before merge. No online multiplayer, server, or actual enterable apartment interior. IMPORTANT: review mobile HUD fit, proximity and script loading in a real browser. Source branch: codex/mobile-controls-v03. Continue preserving independent Claude backend ownership.


## CURRENT — 2026-10-10, v0.3
Repository: th4r6xkgcs-ui/nightshift-city-online. v0.2 imported as baseline; client improvements on codex/mobile-controls-v03. Independent Canvas single-player sandbox, no multiplayer/backend/deployment.

Completed: separate right touch aiming stick, camera-relative mouse aim, held FIRE/Space with rate limit, touch capture/cancellation and blur reset, frame-rate-adjusted vehicle drag, building and parked-car collision, stopped-car safe exit placement, save numeric bounds preserving zero balances/ammo/health, invalid building spawn recovery.
Touched: index.html, tests/smoke.cjs, README.md, HANDOFF.md, PROJECT_STATE.md, NEXT_TASKS.md, GITHUB_SETUP.md.
Validation: node tests/smoke.cjs PASS for save bounds/zeros, fire cadence, safe exits, vehicle building collision and frame execution at 390x844. This uses a mocked Canvas/DOM, not browser visual QA. Real Safari/iPhone testing remains pending.

## Next
1. Browser visual smoke test including dual-touch input, portrait/landscape HUD and exit edges.
2. Phaser/TypeScript/Vite migration preserving tested behavior; fixed-step simulation and swept bullets.
3. Character creator, finite ammunition/reload timing, interiors and one repeatable job loop.
4. Claude can implement server/shared protocol scaffold on a claude branch, with authoritative balances/inventory/combat. No real multiplayer until two-client tests pass.

## Known limits
Buildings are rectangles; collision uses vehicle corners and approximate parked-car circles. Shooting NPCs generates heat but no active police response. Reload supplies unlimited ammo instantly. Shops/interiors mostly placeholders. Saved health of zero has no death recovery yet. No traffic AI, authentication, server persistence, finished art or device QA.

## Handoff workflow
Fetch newest main and this branch before work. Review FILE_OWNERSHIP.md. Make independent branches, update exact tests and limitations, submit PRs; do not deploy without authorization.
