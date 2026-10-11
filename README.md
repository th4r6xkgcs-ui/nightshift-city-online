# Nightshift City Online
Independent mobile-first top-down pixel city game, separate from Nightshift Garage.

## Current build: v0.14 local prototype
[Play the private preview](https://nightshift-city-online.nzs4gc8qmw.chatgpt.site).
Dependency-free Canvas client with walking, twin-stick aiming, combat, NPC crime, police pursuit, traffic, drivable cars, walkable apartments and shops, courier deliveries and browser-local inventory/progress. Multiplayer is not implemented. Art and synthesized audio remain procedural placeholders.

## Run and verify
Use Node 24 or newer. No npm installation or build step is required.
- `python3 -m http.server 8080` serves the game at localhost:8080.
- `npm run check` runs 15 suites and syntax-checks every root JavaScript module.
- `npm run test:browser` is a separate harness for a configured browser environment.
- `node tests/render.cjs /tmp/city.png` optionally renders Canvas with `@napi-rs/canvas`; this verifies neither HTML layout nor touch/audio.

## Controls
WASD/arrows or left stick moves. In a car, up/down accelerates/reverses, left/right steers. E/USE enters accessible cars, exits stopped cars or interacts with entrances/furniture. Mouse/right stick aims; Space/FIRE shoots on foot and brakes while driving. R/RLD reloads from finite spare ammunition. Shift/RUN sprints.
MORE opens secondary actions: STYLE, JOB, HOME, BAG, BOX, LOOT, ROB, GIVE UP, CAR, SOUND, MAP and SAVES. Keyboard shortcuts: M map, I bag, G glovebox, X rob, Z surrender.

## Gameplay
- STYLE offers skin, shirt, hair, pants, shoes, hat and bag choices with a preview.
- JOB starts a $225 courier delivery, routes GPS to pickup then destination. Tap JOB at each objective. Parcels are carried items at risk of loss. Stages persist through refresh.
- HOME routes to the apartment near 880,680. Purchase for $1,200; enter and use the bed, wardrobe or storage. Apartments have collision-aware furniture and an exit at the bottom.
- USE at a CORNER SHOP entrance opens a walkable shop. USE near the counter trades ammunition, pistols, first aid, medkits and carried valuables. A medkit in BAG heals up to 40 HP when used.
- BAG shows carried items; BOX accesses a nearby/current vehicle glovebox. Apartment STORAGE opens the home stash. Store/Take uses buttons. Death drops all carried cash, ammunition, weapons and items; stash/gloveboxes survive. LOOT recovers nearby bags, which expire after two minutes.
- ROB threatens an unrobbed NPC with a carried pistol. Police dispatch after a delay, route around buildings and fire visible projectiles stopped by walls. Lose sight to escape, or GIVE UP to pay up to $150. Heat, NPC wallet/death state and ground cash persist locally.
- CAR manages vehicles: starter compact is owned, others cost $900 or take three seconds to steal. Garage entrances offer fuel at $0.80/% and repair at $1.50/%. Compact/sedan/van handling differs; damage reduces acceleration. Traffic follows two road loops.
- MAP chooses destinations and draws walking-clear GPS routes around buildings. Routes are guidance, not car-lane navigation.
- SAVES exports browser progress, restores backups and can undo the last restore. This is manual file transfer, not cloud sync.
- SOUND enables optional synthesized feedback after a gesture. Hospital recovery takes three seconds and grants brief damage protection.

## Limits and collaboration
Menus/interiors pause this single-player simulation. Real Safari dual-touch, HUD layout and browser audio/file-picker QA remain pending. Save data is trusted local prototype state, not a secure economy. No account server, database or multiplayer exists.
Read AGENTS.md, CLAUDE.md, HANDOFF.md, FILE_OWNERSHIP.md and DEPLOYMENT.md. GitHub is canonical; Sites hosts a private deployment mirror. Codex owns the client; Claude owns future backend work. No credentials or Garage assets belong here.
