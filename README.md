# Nightshift City Online
Independent mobile-first top-down pixel city game, separate from Nightshift Garage.

## Current build: v0.5 local prototype
Walking, touch twin-stick aiming, held fire, driving, building/parked-car collision, safe vehicle exits, NPCs, shops, loot, minimap and validated browser-local saves. Programmer-drawn placeholder art. Character colors persist locally. Owned apartments have walkable furnished interiors, bed healing and wardrobe access. Multiplayer is not implemented. No deployment.

## Run and verify
Serve with `python3 -m http.server 8080` and open localhost:8080. Run `node tests/smoke.cjs`, `node tests/activities.cjs` and `node tests/home.cjs` for simulation checks. No dependencies or build step.

## Controls
WASD/arrows: walk; while driving, up/down accelerates/reverses and left/right steers. E/USE: interact or enter/exit a stopped vehicle. Mouse/right touch stick: aim. Hold Space/FIRE: shoot. R/RLD: instant prototype reload. Shift/RUN: sprint.

## Collaboration
Read AGENTS.md, CLAUDE.md, HANDOFF.md and FILE_OWNERSHIP.md. Codex uses codex branches; Claude uses claude branches. GitHub is the shared source of truth. No credentials or Garage assets belong here.

STYLE opens customization. JOB starts/completes courier objectives. HOME buys ($1,200) or enters the starter apartment near 880,680. Indoors, USE near furniture or the bottom exit.
