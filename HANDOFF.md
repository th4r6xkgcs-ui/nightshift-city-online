## CURRENT — v0.57 detailed city art (local review, 2026-10-13)

Branch: codex/premium-art-v56, draft PR #43 stacked on codex/living-streets-v55. Read CLIENT_HANDOFF_V57.md. Completed four areas: newer mask-shaded character bodies with approved face/hair/pistol art, cached storefront depth, distinctive car details and eight-direction pets, mobile culling/idle sprite preparation. Added a real pet inspection screen and fixed studio animation cycles and prewarm resume. Claude heads rechecked: rpg-play 741dc7d4 / rpg-core 27aeee15; only completed character art/studio files were selectively integrated. New map/combat/city systems remain separate; further gang/crew expansion is deferred until multiplayer. Local review only; hosted private v0.55 unchanged. No merge or access changes.

## PREVIOUS — v0.56 premium pixel finishing (review build, 2026-10-12)

Branch: codex/premium-art-v56, stacked on v0.55. Exact latest Claude rpg-play a01a9ff2 / rpg-core b34c95c9 integrated; read CLIENT_HANDOFF_V56.md for ownership, assets, tests and remaining master-roadmap gaps. Redrawn faces, 12 distinct haircut silhouettes, six denser pistol designs, finer shared character pixels and animated material details, crisp customized cars, authoritative studios and short-phone layout fixes. 111 suites passed; 151-asset build; real Edge render/studio/save/layout checks passed. This remains a local review build; no new deployment, merges or access changes. Crew expansion remains deferred.

## CURRENT — v0.55 Living Streets (2026-10-12)

Canonical branch: codex/living-streets-v55, built from verified v0.54 a2750326 and exact Claude rpg-play c31e4976 (rpg-core 556cec53 / art-pass fdc3c36d). Read CLIENT_HANDOFF_V55.md for file ownership, imported module provenance, save contracts and verification limits.

Full art layer: 20 distinct held guns, 11 pet species, baked collectible cars, deeper building materials, clear intersections, readable street props, animated neighborhoods, smoother camera and unified mobile HUD/notice queue. Gameplay modules imported intact; no new crew/follower/gang-management expansion. Preview remains local single-player, owner-private Sites; no backend deployment, merges or access changes.

Validation: 107 suites and root syntax; 137-asset static build; real Edge profile/home checks and 390/844/320 viewport, dual-touch cancellation, city/day/night/countryside/suburbs/apartment renders; zero page errors. Physical iPhone and sustained device/audio QA pending.

# HANDOFF — Nightshift City Online

## HISTORICAL — v0.54 combined Street Life client (2026-10-11)

Current batch: exact Claude RPG 8b6c4c3 integration, persistent contact memory, city journal and crash loyalty consequences. See CLIENT_HANDOFF_V53.md.

Prior increment: crew passenger boarding, model seat limits and safe exit/follow resumption. See CLIENT_HANDOFF_V52.md.

Canonical branch: `codex/visual-overhaul-v54`, based on combined v0.52. Read CLIENT_HANDOFF_V51.md, CLIENT_HANDOFF_V50_1.md and CLIENT_HANDOFF_V50.md for changed files, saved-state contracts, gameplay limits and verification.

This session added both NPC/custom gang support, bounded recruitment, physical followers, loyalty, escort jobs, rival corner challenges and premium street-customer requests sharing existing dealer demand and ledger. Fixed follower vehicle routing/spawn clearance and crowded sprite-atlas rebuilding. Root README/PROJECT_STATE/NEXT_TASKS now point to the current combined client rather than v0.17.

Validation: 89 suites and root syntax pass; ten simulated minute follower soak; physical contact-to-clinic escort handoff; once-only crew/rival/customer effects; production-to-customer sale; crowded-atlas allocation regression; 87 playable build assets. Canvas portrait/landscape inspections cover followers, rival envoys and customer depth. Physical iPhone and real DOM/audio checks remain pending.

Claude's latest RPG modules imported unchanged from rpg-core 8b6c4c3; latest rpg-play is 12dc902. No Claude-owned RPG/backend internals edited. Coordinate through PR #3 before reserving files. Never merge or force-push shared/main branches without authorization. Static preview remains local single-player; server/shared/online/worker are excluded.

Next: art refinement and device QA; additional crew systems deferred until multiplayer. Detailed release handoffs are authoritative; older notes below are historical.


Current art pass: high-density Canvas rendering (2× DPR, four-million-pixel budget), smoother sprite sampling, vehicle paint/glass highlights, clothing shading, rooftop glass, storefront planters/signs and restrained mobile HUD finishes. See CLIENT_HANDOFF_V54.md. Further recruitment/follower/gang-management expansion is deferred until multiplayer. Existing crew saves and gameplay remain intact. Imported Claude RPG snapshot remains 8b6c4c3; newer refs 8495bd7 / 24d1749 were observed but are not integrated.

## HISTORICAL — v0.17 crafting progression and safety
Verified external v0.16 foundation. Added persistent craft count/levels (five recipes per level), one-time $400 owned-apartment bench upgrade at level two, bulk ammunition and level-three medical pair recipes. Craft progress joins backup whitelist. Fixed reserve overflow and reload conflicts before material deductions; modal isolation across city actions; indoor movement locks during crafting; wardrobe overlap blocked. Craft items retain pocket death custody.
Touched crafting.js, game.js, index.html, package.json, home/inventory/activities/crime/vehicles/map/backups/progression/recovery modules, README and tests. npm run check: 34 suites and all root syntax checks pass. Real Safari touch/audio QA remains pending. Durability, attachments and rare blueprints are future work.


## HISTORICAL — v0.16 crafting foundation (2026-10-11)
Added crafting.js, loaded after inventory.js, with four fictional game recipes: Street Pistol, 15-round ammo pack, First Aid Kit and Salvage Breakdown. Pistol/ammo require owned apartment interior workbench; field recipes can be made on foot anywhere. Crafting UI uses touch-friendly buttons, reports missing materials, blocks vehicle crafting, and pauses simulation. Recipe engine validates inputs and output capacity before atomic deduction, and reuses existing pocket inventory, save and death-drop custody. Crafted ammo updates combat reserve. All materials are abstract game items; no real-world gun assembly details. Browser/iPhone validation and automated suites for this new feature remain pending; do not claim otherwise. v0.15 deployment remains unchanged until verified.

## HISTORICAL — v0.15 city activities, progression and atmosphere (2026-10-11)
Added salvage.js: eight clear-world crates, 2.5s searches interrupted by movement/damage/fire/menu, scrap/watch rewards, three-minute saved cooldowns, map routing and refill countdown. progression.js tracks XP/delivery/salvage/home milestones; $50 awarded once per new level, capped at level 10. Old owned homes migrate their milestone without bonus XP. Courier rotates three authored $225/$275/$300 routes; old saves retain first-route semantics. New save keys are included in backups.
Added movement.js stamina/exhaustion; feedback.js bounded transient muzzle/hit/loot/heal particles and labels; environment.js saved eight-minute clock and districts/windows/headlights/streetlights; safe-zones.js neutral clinic protection (no protection while wanted); road-navigation.js road-center GPS parking approaches; signals.js timed junction lights obeyed by traffic. Camera.js uses elapsed-time easing. world.js and sprite-renderer.js separate fixed catalog/drawing from game scene globals. Shared sprites render indoors without weapons. Idle player animation stops; damaged enemies show health bars. Root styles moved to styles.css and build packages CSS with traversal/duplicate guards. Audio startup exceptions recover with SOUND disabled. Touch movement has center deadzone.
Startup uses ordered deferred scripts and boot.js schedules the first simulation frame only after all modules initialize. Prevents partial-state gameplay during network loading; root HTML displays loading status.
BOX now works beside an owned/stolen parked car as well as inside it; locked, moving and interior access are blocked, with stable-identity transfer regression tests.
Executed: npm run check PASS, 33 suites plus root JS syntax. New checks include courier rotation/persistent rewards, reputation/world save migration, stats modal isolation, salvage timing/cooldowns/interruption, stamina, safe-zone pursuit behavior, traffic phases, road routing, bounded FX, audio mock startup/mute/focus and camera FPS equivalence. Existing custody/combat/persistence checks retained. Canvas-only world/shop renders inspected. No real browser/Safari touch/audio/file picker QA performed.
Touched: new client modules and tests above; game.js, activities.js, city-map.js, home.js, inventory.js, crime.js, recovery.js, vehicles.js, traffic.js, audio.js, backups.js, guidance.js, interface.js, index.html, styles.css, scripts/build-static.cjs, package.json and shared docs.
Limitations: local-only simulation, pause in menus/interiors, procedural assets, simple traffic loops. Road GPS is guidance, not car-lane avoidance or autopilot. Neutral clinic rule is client-authoritative. Reputation/salvage balance provisional. No server, cloud sync, paid infrastructure or Garage assets added. Existing private Site successfully updated to v0.15; exact source/version/deployment provenance recorded in DEPLOYMENT.md. Archive assets byte-checked against canonical source. Historical entries below do not override this section.
Next: device QA checklist, further scene/state modularization, authored content and pursuit/traffic improvements; backend remains Claude-owned.

## HISTORICAL — v0.14 gameplay and reliability (2026-10-11)
Added city-map.js (services/GPS/markers, courier routing), clock.js (60 Hz bounded simulation), backups.js (local export/restore/undo/rollback) and integrated tests/harness.cjs/simulation.cjs. Walkable shop interior trades ammo/pistol/aid/medkits and buys valuables; carried medkits heal through BAG. Character preview now covers pants/shoes/hats/bags. Portrait interiors follow the player. Vehicles have compact/sedan/van handling, health-sensitive acceleration and FIRE/Space braking while driving. Stationary steering fixed. Camera zoom changes with speed. Menu input release and storage-room movement lock fixed; pointer capture loss releases controls and visibility changes clear/reset inputs.
Added guidance.js: contextual nearby interaction hints, ENTER/EXIT/SHOP/PICK labels and driving disables reload/sprint controls.
Touch sticks now track independent pointer IDs; second touches cannot steal a stick or release another active touch. Mock event tests cover cancellation and capture loss.
Added npm run build / scripts/build-static.cjs: fail-fast script reference validation and a source-identical playable-only dist bundle. A build suite checks traversal/duplicate rejection and excludes docs/tests.
Backup quota regression: rollback clears partial imported game keys before reapplying the old snapshot, avoiding transient quota failures when old values are larger. Unrelated keys remain untouched.
Late fixes: simulation timestamps remain aligned after capped long stalls, with reload regression coverage. Added modal isolation tests and semantic dialog attributes. Map sizing preserves its coordinate aspect ratio in landscape. Browser harness now opens MORE before STYLE.
Validation: npm run check passes 19 suites plus root module syntax. Walking and driving agree at 30/60/120 FPS; backup restore/undo/failed-write rollback preserve unrelated storage. Existing custody, combat, crime, courier and persistent state regressions pass. Canvas-only rendering inspected; actual browser/Safari HUD, gestures, audio and file selection not verified.
Touched: client JS modules, index.html, package.json, tests and shared docs. Canonical branch/PR preserved; no backend, paid service or multiplayer introduced. Existing owner-private Site successfully updated to v0.14; exact source/version/deployment IDs recorded in DEPLOYMENT.md. Historical entries below describe earlier snapshots and do not override this current state.
Next: actual iPhone/browser QA, scene/state modularization, authored content; backend remains Claude-owned.

## DEPLOYED — v0.13 private preview (2026-10-10)
[private preview] — native deployment succeeded, owner-private, authorized by user. Read DEPLOYMENT.md for exact identity and update procedure; reuse this site. GitHub remains canonical code, Sites source is a deployment mirror. Eleven suites and GitHub CI pass; real iPhone touch/audio/HUD QA pending. The deployment supersedes historical "no deployment" notes below. Still single-player, no multiplayer server.

## HISTORICAL — v0.13 traffic, audio and visual pass (2026-10-10)
Added traffic.js with eight nonoverlapping cars on two authored rectangular road loops, forward spacing/parked-car checks and collision damage for players/vehicles. Hospital recovery now has 2.5 seconds damage protection. Audio.js adds opt-in synthesized gun/reload/impact/pickup effects and speed-based engine tone; SOUND/MUTE starts AudioContext only on user gesture, focus loss silences engine. Actual browser audio unverified.
Cars/characters gain procedural pixel details and roads have sidewalk/curb borders. Internal Canvas-only render inspection using @napi-rs/canvas caught parked vehicles inside buildings; vehicle bootstrap now moves obstructed car footprints to clear road positions and regression checks validate no car center is blocked. Canvas render test source included but its optional library is not a project dependency and it is not CI-run. No HTML/touch layout verification from this renderer.
Executed: npm run check PASS, eleven suites plus module syntax. Integrated test verifies eight distinct traffic spawns and movement. New traffic test checks timestep and corner traversal. Persistence tests retain vehicle/cargo/custody checks. node tests/render.cjs completed and rendered world PNG was inspected internally. Browser/Safari touch, HUD and audio still pending; no multiplayer or deployment.
Touched: traffic.js, audio.js, game.js, index.html, vehicles.js, recovery.js, tests/traffic.cjs, tests/render.cjs, tests/home.cjs, tests/persistence.cjs, tests/run.cjs, package.json and shared docs.
Limitations: traffic simple loops not navigation/signals; synthesized sounds are placeholders, not real car recordings; sprite art procedural; local menu/interior pause remains. Need real-browser pass before claiming iPhone playability. Authoritative backend is Claude-owned and not implemented. Preserve this separate project and do not add paid services/deploy without authorization.
Next concrete milestone: hosted test preview and actual browser/iPhone QA, then scene modularization/Phaser migration and server-authoritative multiplayer. Source is ready for a reviewable preview deployment once authorized.


## HISTORICAL — v0.12 vehicles, cargo and client modules (2026-10-10)
Added vehicles.js: saved car-N identity, position/color/fuel/condition, starter car owned, others buyable for $900 or stealable via 3-second nearby lockpick; movement away interrupts theft. Theft adds heat. USE requires owned/stolen vehicle. CAR panel displays status; garage entrance proximity enables fuel at $0.80/% and repair at $1.50/%, only charging missing amounts. Driving consumes fuel; empty tank/zero condition disables powered acceleration; high-speed crashes reduce condition. Gloveboxes reference explicit car.id and persist separately from carried inventory. Stolen cars remain accessible locally, so glovebox safety is only from character death.
Courier job stage persists; pickup creates carried parcel, delivery consumes parcel before reward, cargo follows normal death/storage rules. Missing cargo cancels the job on JOB action. Crime saves ground NPC cash pickups and restores them across reload. Secondary action buttons are behind MORE/LESS tray (CSS not visually verified). Client simulation extracted from inline HTML to game.js; external script ordering remains under integration tests.
Executed: npm run check PASS, ten suites plus all module syntax. Fresh-context tests verify car ownership/state/glovebox, courier cargo/stage/reward-once and delayed theft/heat persistence. Existing death/stash/combat/police/navigation tests pass. Browser/device visual QA pending (no Chromium available), no deployment or multiplayer.
Touched: vehicles.js, interface.js, game.js, index.html, inventory.js, crime.js, activities.js, home.js, tests/vehicles.cjs, tests/persistence.cjs, tests/smoke.cjs, tests/run.cjs, package.json and shared docs.
Known limits: current car-N IDs map to fixed spawn catalog; future catalog needs globally unique authored IDs. No vehicle theft by other players, police impound or glovebox search rules. Theft is simple local timer; menu/interior pause remains. Fuel repair balance is provisional. LocalStorage snapshots not server transactions. Art temporary; actual mobile HUD not yet verified.
Next: real-browser QA; traffic and more detailed vehicle handling; audio/feedback; move globals into modular scene architecture before Phaser migration; authoritative backend remains Claude-owned. No paid service or deployment authorized.


## HISTORICAL — v0.11 pursuit, projectiles and persistence (2026-10-10)
Branch codex/mobile-controls-v03, PR #1. navigation.js implements collision-grid BFS routes with clearance, sampled wall tracing and segment-circle impacts. Officers route around buildings, repath once per second and shoot visible red tracer projectiles. Police damage happens only on projectile impact; walls stop fire. Player bullets now also use swept collision against NPCs/officers and walls. Zero-heat/surrender clears police bullets.
Crime state persists locally: stable npc-N IDs preserve robbed/dead NPC states and wallet depletion; heat survives refresh and saves after shots. NPC death cash reward comes from remaining wallet, preventing double-payment after robbery. NPC positions and dropped NPC cash pickups do not persist; this is still local simulation, not server authority.
Mobile joystick centers scale with control size. Portrait sticks narrowed to reduce overlap; landscape aim moved beside action grid. CSS changes not visually verified. package.json adds npm run check; tests/run.cjs runs nine suites and all JS module syntax checks. GitHub Actions runs the same Node 24 checks.
Validation: npm run check PASS (nine suites). Integrated HTML-order test verifies police bullets need flight time, cover stops shots, surrender and existing custody/recovery. New navigation suite checks wall routing/unreachable endpoints/swept hits. New fresh-context persistence suite verifies NPC robbery/death, heat, exact magazine/reserve, death bags and protected stash across reload. git diff --check PASS. No actual browser QA: no browser executable is available; previous Chromium download failed. Browser harness remains available for configured environment.
Touched: navigation.js, crime.js, index.html, home.js, tests/navigation.cjs, tests/persistence.cjs, tests/home.cjs, tests/smoke.cjs, tests/run.cjs, package.json, .github/workflows/check.yml, README.md, HANDOFF.md, PROJECT_STATE.md, NEXT_TASKS.md.
Limitations: placeholder graphics; small grid navigation (no car pursuit/tactical formations); local menu/interior pause; no multiplayer, server, PvP robbery, vehicle searching or deployment. Officer/projectile state restarts on reload but heat persists and redispatches. Browser/Safari and CI execution not independently verified yet.
Next: execute browser/device QA, modular Phaser migration, traffic/vehicle identity and search rules, server inventory/crime authority on Claude-owned backend branch. No human permission needed for ordinary client iterations; do not deploy or add paid services without authorization.


## HISTORICAL — v0.10 NPC crime and police (2026-10-10)
Added crime.js: ROB threatens nearby unrobbed living NPC when carrying a pistol, transfers finite NPC wallet into carried cash, adds heat and triggers fleeing. Police dispatch after 3 seconds, up to 3 on-foot officers, pursue last seen position, use building-blocked line of sight, shoot every 1.2 seconds in range. Player bullets damage officers; killing officers raises heat. Break sight for 6 seconds then heat decays. GIVE UP charges up to $150 from carried cash and returns to West End; stash/glovebox remain untouched. Police can damage occupants (reduced damage) while driving. Death still uses full carried-loot drop and hospital recovery.
Critical startup fix: combat.js now loads BEFORE inline client code referencing NightshiftCombat. Old harness loaded combat first independently and missed broken HTML order. Integrated home test now executes every script in actual HTML order, including crime.js.
Executed: node tests/smoke.cjs; activities.cjs; home.cjs; combat.cjs; recovery.cjs; inventory.cjs; crime.cjs — all PASS. Home integration covers robbery reward/no repeat, dispatch, police damage and surrender in addition to existing custody/home checks. Syntax and diff checks pass. Actual browser/mobile visual and touch QA remains pending; no deployment or multiplayer.
Known limits: police simple axis collision steering (no pathfinding, vehicles, roadblocks or tactics); NPC robbery wallets/robbed state reset on refresh; local-only client authority; gameplay pauses in local menus/interiors. Officers use direct hit damage rather than visible bullet projectiles. Status HUD not visually verified and may need mobile spacing work. No player-to-player robbery or NPC bag looters.
Touched: crime.js, index.html, tests/crime.cjs, tests/home.cjs, README.md, PROJECT_STATE.md, NEXT_TASKS.md, HANDOFF.md.
Next: browser QA first, more robust NPC/police navigation and persistence, police projectile feedback, safer HUD and server-authoritative crime/inventory. Claude backend remains separate.


## HISTORICAL — v0.9 full carried custody (2026-10-10)
Carried cash, magazine+reserve ammunition, pistol and all pocket item types drop on death. Home stash and per-car gloveboxes survive. Carrying a pistol is required to fire; replacement pistols cost $150 at corner shops. Ammo transfers preserve total rounds and obey combined 270-round carried cap. Dropped bags display in world and persist locally across refresh until their existing two-minute expiry. LOOT recovers nearby bag contents up to capacity; remainder stays in bag. Inventory snapshot stores wallet, ammunition and magazine for reload-safe local custody. Legacy v0.8 saves migrate with starter pistol. No server or other-player looting yet.
BAG/BOX/home storage now open tap-based panels with Store/Take controls. Cash moves up to $100 per tap; ammunition up to 30 rounds; other items one per tap. Gameplay pauses while panel is open. No drag/drop implementation.
Tests: all six suites smoke, activities, home, combat, recovery, inventory PASS. Home integration now loads inventory and verifies death drops cash, ammo/weapon loss and bag recovery. Syntax and diff checks pass. Real browser/iPhone QA remains pending; no deployment.
Known limitations: localStorage has no server transaction guarantees; bags expire after two minutes, latest 100 loaded; vehicle identity is car index (stable current layout only); gloveboxes protect against character death only, vehicle theft/search not implemented; no multiplayer robbery. No NPC looters yet.
Touched: inventory.js, index.html, recovery.js, home.js, activities.js, tests/home.cjs, README.md, PROJECT_STATE.md, NEXT_TASKS.md, HANDOFF.md.
Next: real mobile QA, robbery/vehicle search rules, stable entity IDs and authoritative server inventory with transactional transfers and persistent bags. Claude backend work remains separate.


## HISTORICAL — v0.8 risk inventory (2026-10-10)
Added inventory.js: pockets (risk), secure home stash, per-car gloveboxes, validated single-item transfers, locally persisted containers, and dropped loot bags on death. BAG inspects inventory; LOOT retrieves nearby dropped bag within two minutes; BOX opens glovebox while in vehicle; apartment STORAGE opens home stash. Initial pocket items are scrap x2 and watch x1. On death, pockets drop at death coordinates, secure containers remain untouched. Loot bags exist only in current page session and expire after two minutes; refreshing loses dropped items. Cash and equipped ammunition are NOT yet included in droppable inventory; this is not the full requested 'lose everything' rule. NPCs/other players cannot loot bags yet; no multiplayer. Browser prompt UI is temporary and not touch-polished. Added tests/inventory.cjs; test authored but not executed this turn. Run node tests/inventory.cjs plus existing suites and perform actual iPhone QA. Next: full carried equipment/cash rules, loot persistence, NPC robbery and authoritative multiplayer inventory.


## HISTORICAL — v0.7 shops and recovery (2026-10-10)
Branch codex/mobile-controls-v03, PR #1. Added recovery.js: corner-shop service menu, ammo at $2/round (up to 30 per purchase, 240 reserve cap, partial packs charged only for delivered rounds), first aid $40 (up to 40 HP; no charge at full health), vehicle collision damage above speed 4, three-second hospital recovery with up-to-$100 fee capped by cash. Recovery cancels reload, releases vehicle, clears bullets/input and returns player to safe West End intersection (440,340) with full health and cleared heat. Zero-health saves recover on first frame. Shop/recovery blocks gameplay actions and pauses city simulation.

Executed: node tests/smoke.cjs; node tests/activities.cjs; node tests/home.cjs; node tests/combat.cjs; node tests/recovery.cjs — all PASS. Home integration additionally verifies lethal damage, car release, action lock and delayed respawn. Tests use Node DOM/Canvas mocks. Real browser/Safari visual/touch verification remains pending (previous Chromium download failure). No deployment or multiplayer.
Touched: recovery.js, index.html, home.js, activities.js, tests/home.cjs, tests/recovery.cjs, README.md, PROJECT_STATE.md, NEXT_TASKS.md, HANDOFF.md.
Next: real browser/mobile QA; collision/aim/visibility improvements; active police AI; Phaser migration; independent Claude multiplayer server work. Recovery damage currently comes from high-speed crashes; no enemy fire/police combat yet. HUD/art remain placeholders. Local client economy is not suitable for multiplayer authority.


## HISTORICAL — v0.6 combat economy (2026-10-10)
Added combat.js with a 30-round magazine, finite reserve ammunition (90 default, 240 cap), 1.3-second reload, partial reload when reserve runs low, reserve persisted in existing local save, and reserve/reload HUD status. Tests/combat.cjs added; existing Node simulation harnesses updated to load combat.js. IMPORTANT: tests were authored but NOT executed in this session; run `node tests/smoke.cjs && node tests/activities.cjs && node tests/home.cjs && node tests/combat.cjs`. Real Safari and Chromium QA still pending. Current work remains on codex/mobile-controls-v03 PR #1, not merged/deployed. Next: implement shop ammo purchases and player death recovery, then real browser QA. No backend/multiplayer yet.


## HISTORICAL — v0.5 homes and style (2026-10-10)
Branch: codex/mobile-controls-v03, PR #1. Local single-player Canvas prototype, independent of Garage. Adds home.js: saved skin/shirt/hair character choices, style dialog, furnished walkable apartment, furniture collision, wardrobe, bed healing, storage save interaction and safe return to exterior. HOME opens owned apartment while on foot. USE interacts near bed/wardrobe/storage/exit. World simulation pauses indoors and during customization; indoor firing/reload is blocked. Mobile action buttons use compact grids with landscape CSS. These layouts are NOT visually verified.

Tests executed: node tests/smoke.cjs, node tests/activities.cjs, node tests/home.cjs — all PASS. Home integration harness loads all scripts and checks profile validation, apartment price/entry, indoor weapon lock, movement/exit and rest healing. Node DOM/Canvas mocks do not verify real touch or visuals.
Browser attempt: node tests/browser.cjs blocked because Playwright Chromium executable is absent; browser download failed with truncated archive. Browser smoke source is included for a configured environment (`npm install --no-save playwright`, `npx playwright install chromium`, serve on port 8080). Real Safari/iPhone QA pending.

Touched: index.html, activities.js, home.js, tests/home.cjs, tests/browser.cjs, README.md, HANDOFF.md, PROJECT_STATE.md, NEXT_TASKS.md.
Known limits: storage only saves progress, no item inventory; rooms are local overlays, no visitors/server; style has color choices rather than full sprite outfit catalog. Zero health still needs death recovery. Infinite instant reload remains. No Phaser migration, real multiplayer, police response, finished art or deployment.
Next: real mobile layout/twin-touch QA; finite ammo/timed reload and health recovery; modular Phaser migration; Claude backend/protocol foundation on separate branch. No deployment without authorization.


## HISTORICAL — v0.4 gameplay extension (2026-10-10)
Added activities.js loaded by index.html: courier pickup/dropoff job with $225 reward, on-screen objective direction/distance, and locally saved apartment purchase for $1200. Added tests/activities.cjs (test source written; execution NOT independently verified). Run `node tests/smoke.cjs && node tests/activities.cjs` before merge. No online multiplayer, server, or actual enterable apartment interior. IMPORTANT: review mobile HUD fit, proximity and script loading in a real browser. Source branch: codex/mobile-controls-v03. Continue preserving independent Claude backend ownership.


## HISTORICAL — 2026-10-10, v0.3
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
