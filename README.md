# Nightshift City Online
Independent mobile-first top-down pixel city game, separate from Nightshift Garage.

## Current review build: v0.56 premium pixel finishing

Read [v0.56 handoff](CLIENT_HANDOFF_V56.md). The new shared finishing pass integrates Claude’s current modular wardrobe and studios, adds finer native character detail and crisp car sampling, and preserves ownership/saves. Local review build only; hosted owner-private preview remains v0.55. This is an incremental art pass; the full master roadmap is not complete.

## Hosted build: v0.55 Living Streets
Private preview hosted separately. Latest release adds detailed pixel guns, pets, architecture and street props, smoother camera, readable crossings and exact current Claude RPG/art integration. Read [v0.55 handoff](CLIENT_HANDOFF_V55.md). Latest combined batch includes respect ranks, fishing, Hustle phone jobs, labs, weapon mods, persistent named-contact memory and a city journal. See CLIENT_HANDOFF_V53.md.
Dependency-free Canvas client with walking, combat, police pursuit, traffic, vehicles, apartments/shops, production businesses, RPG skills/weapons/goals/dailies and browser-local inventory/progress. Join an NPC gang or found a custom gang, recruit passive followers, build loyalty, escort members, claim local corners and respond to noncombat rival pressure. Street customers request carried stock using shared dealer demand, prices, heat and sales ledgers. This private static preview is single-player; Claude’s separate backend work is not deployed here. Art/audio are procedural. Real iPhone and audio QA remain pending; Edge DOM/viewport checks pass.

Canonical combined branch: `codex/living-streets-v55`, based on v0.52. Crew members can now board nearby stopped vehicles and exit safely; compacts seat one passenger, sedans/vans three. [Transport handoff](CLIENT_HANDOFF_V52.md). Start at **MORE → STREET**, track a contact, then press **TALK**. Detailed contracts and validation: [CLIENT_HANDOFF_V51.md](CLIENT_HANDOFF_V51.md), [CLIENT_HANDOFF_V50_1.md](CLIENT_HANDOFF_V50_1.md), [CLIENT_HANDOFF_V50.md](CLIENT_HANDOFF_V50.md). Historical gameplay notes below describe older foundations.

## Run and verify
Use Node 24 or newer. No npm installation is required. `npm run build` creates a static dist bundle for hosting.
- `python3 -m http.server 8080` serves the game at localhost:8080.
- `npm run check` runs 107 suites and syntax-checks every root JavaScript module.
- `npm run test:browser` is a separate harness for a configured browser environment.
- `node tests/render.cjs /tmp/city.png` optionally renders Canvas with `@napi-rs/canvas`; this verifies neither HTML layout nor touch/audio.

## Controls
WASD/arrows or left stick moves. In a car, up/down accelerates/reverses, left/right steers. E/USE enters accessible cars, exits stopped cars or interacts with entrances/furniture. Mouse/right stick aims; Space/FIRE shoots on foot and brakes while driving. R/RLD reloads from finite spare ammunition. Shift/RUN sprints.
MORE opens secondary actions: CRAFT, STYLE, JOB, HOME, STATS, SEARCH, BAG, BOX, LOOT, ROB, GIVE UP, CAR, SOUND, MAP and SAVES. Keyboard shortcuts: M map, I bag, G glovebox, X rob, Z surrender.

## Gameplay
- CRAFT (keyboard C) makes pocket items using abstract salvage. Pistol/ammo require your owned apartment. Every five completed recipes raises crafting level, up to five. At level two, spend $400 once to upgrade the bench and unlock bulk ammo; level three unlocks medical supply pairs. Crafting progress and bench upgrades are saved and included in backups. Escape closes crafting.

- STYLE offers skin, shirt, hair, pants, shoes, hat and bag choices with a preview.
- JOB rotates through three $225/$275/$300 courier deliveries, routes GPS to pickup then destination. Tap JOB at each objective. Parcels are carried items at risk of loss. Stages persist through refresh.
- HOME routes to the owned starter apartment near 880,680. Enter and use the bed, wardrobe, kitchen, workbench or storage. Fresh players begin with $200 and craft their first gun; legacy saves keep their migration rules. Apartments have collision-aware furniture and an exit at the bottom.
- USE at a CORNER SHOP entrance opens a walkable shop. USE near the counter trades ammunition, pistols, first aid, medkits and carried valuables. A medkit in BAG heals up to 40 HP when used.
- BAG shows carried items; BOX accesses a nearby/current vehicle glovebox. Apartment STORAGE opens the home stash. Store/Take uses buttons. Death drops all carried cash, ammunition, weapons and items; stash/gloveboxes survive. LOOT recovers nearby bags, which expire after two minutes.
- ROB threatens an unrobbed NPC with a carried pistol. Police dispatch after a delay, route around buildings and fire visible projectiles stopped by walls. Lose sight to escape, or GIVE UP to pay up to $150. Heat, NPC wallet/death state and ground cash persist locally.
- CAR manages vehicles: starter compact is owned, others cost $900 or take three seconds to steal. Garage entrances offer fuel at $0.80/% and repair at $1.50/%. Compact/sedan/van handling differs; damage reduces acceleration. Traffic follows two road loops.
- MAP chooses destinations and draws walking-clear GPS routes around buildings. Walking routes avoid buildings; driving routes follow road centers and end at nearby parking approaches. This is guidance, not autopilot or lane navigation.
- SAVES exports browser progress, restores backups and can undo the last restore. This is manual file transfer, not cloud sync.
- SEARCH or USE near a marked salvage crate takes 2.5 seconds of standing still. Movement, damage, firing or menus interrupt it. Recovered scrap/watches follow pocket custody; crates refill after three minutes. MAP routes to available crates.
- STATS shows reputation and milestones. Deliveries, salvage and apartment purchase earn XP; new levels award $50 once. Legacy owned homes keep their milestone.
- Sprint drains stamina; walking/resting restores it. The saved eight-minute day/night cycle changes window/street/headlight visuals. District labels identify West End, Midtown, Southside and the Docks.
- The clinic ring prevents neutral-player damage, gunfire, robbery and theft. Wanted players receive no safe-zone protection. Traffic obeys timed red/amber/green signals.
- SOUND enables optional synthesized feedback after a gesture. Hospital recovery takes three seconds and grants brief damage protection.

## Limits and collaboration
Menus/interiors pause this single-player simulation. Real Safari dual-touch, HUD layout and browser audio/file-picker QA remain pending. Save data is trusted local prototype state, not a secure economy. No account server, database or multiplayer exists.
Read AGENTS.md, CLAUDE.md, HANDOFF.md, FILE_OWNERSHIP.md and DEPLOYMENT.md. GitHub is canonical; Sites hosts a private deployment mirror. Codex owns the client; Claude owns future backend work. No credentials or Garage assets belong here.

Current art and gameplay integration: v0.55 Living Streets, including exact Claude rpg-play c31e4976. See CLIENT_HANDOFF_V55.md for the current release, imported systems, detailed art and browser verification. Further recruitment/follower/gang-management expansion is deferred until multiplayer.
