# Nightshift City Online
Independent, mobile-first top-down pixel open-world game. Not affiliated with Nightshift Garage.

## Current status
**v0.1 local playable prototype, NOT multiplayer yet.** Open `index.html` in a browser (or serve with `python -m http.server 8080`). It contains a procedurally arranged city district, NPCs, parked cars, enter/exit and driving, shooting, loot, basic shops, wanted heat, keyboard and touchscreen controls. Art is programmer-drawn placeholders. There is no backend or persistence.

## Controls
WASD/arrows or touch joystick: walk/drive; E/USE: interact or enter/exit car; mouse to aim; click/space/FIRE to shoot; Shift/RUN to sprint.

## Roadmap
1. Migrate prototype into Vite + TypeScript + Phaser project, preserving controls and behavior.
2. Modularize scene/world, physics, input, entities, inventory and interactions.
3. Add collisions, navigation, pathfinding, vision cones, reload and combat AI.
4. Replace programmer art with consistent licensed pixel sprite sheets.
5. Implement Colyseus authoritative server with server-validated actions; never trust client economy/combat.
6. Add persistence, login, garages, inventory and properties; choose hosted database only when needed.
7. Add districts, careers, safe zones, crew systems and moderated PvP.

## Important
The initial prototype runs offline in a browser. No deployment or GitHub repository has been created. Avoid representing simulated NPCs as real multiplayer players.
