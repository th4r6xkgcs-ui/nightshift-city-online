# Nightshift City Online
Independent mobile-first top-down pixel city game, separate from Nightshift Garage.

## Current build: v0.10 local prototype
Walking, touch twin-stick aiming, held fire, driving, building/parked-car collision, safe vehicle exits, NPCs, shops, loot, minimap and validated browser-local saves. Programmer-drawn placeholder art. Character colors persist locally. Owned apartments have walkable furnished interiors, bed healing and wardrobe access. Multiplayer is not implemented. No deployment.

## Run and verify
Serve with `python3 -m http.server 8080` and open localhost:8080. Run `node tests/smoke.cjs`, `node tests/activities.cjs` and `node tests/home.cjs`, `node tests/combat.cjs` and `node tests/recovery.cjs` for simulation checks. No dependencies or build step.

## Controls
WASD/arrows: walk; while driving, up/down accelerates/reverses and left/right steers. E/USE: interact or enter/exit a stopped vehicle. Mouse/right touch stick: aim. Hold Space/FIRE: shoot. R/RLD: 1.3-second reload from finite spare ammo. Shift/RUN: sprint.

## Collaboration
Read AGENTS.md, CLAUDE.md, HANDOFF.md and FILE_OWNERSHIP.md. Codex uses codex branches; Claude uses claude branches. GitHub is the shared source of truth. No credentials or Garage assets belong here.

STYLE opens customization. JOB starts/completes courier objectives. HOME buys ($1,200) or enters the starter apartment near 880,680. Indoors, USE near furniture or the bottom exit.

USE near CORNER SHOP opens ammo/first aid services. High-speed crashes damage health; at zero health, recover after three seconds at the West End clinic marker with a fee up to $100. This is a local recovery spawn, not an enterable clinic.

BAG shows carried inventory. BOX accesses your current vehicle glovebox; apartment STORAGE opens the home stash. Store/Take uses tap controls. On death, ALL carried items, cash, ammunition and pistols drop; stash/gloveboxes survive. LOOT recovers nearby bags. Bags persist locally through refresh for two minutes. Pistols can be replaced at corner shops for $150. No online looting or robbery yet.

ROB threatens a nearby NPC with a carried pistol, takes their cash and alerts police. Police arrive after a delay, chase visible players and damage them. Break line of sight to lose heat or GIVE UP to pay a fine up to $150. NPC robbery and police are local prototype systems.
