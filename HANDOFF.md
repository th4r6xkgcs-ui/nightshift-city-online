# HANDOFF — Nightshift City Online

## CURRENT (2026-10-10)
Independent from Nightshift Garage. v0.2 is a single-file, dependency-free browser sandbox (`index.html`), not deployed and not networked. It supports top-down movement, a simple city, cars, NPCs, shooting, loot, basic heat, shops, touch controls, reload, collision with buildings for players/NPCs/bullets, minimap and browser-local autosave. Features are prototypes, not production systems. No automated browser or device test has been completed.

## Run
Open `index.html` in a modern browser. For consistent mobile testing, serve with `python3 -m http.server 8080` and access it over local network; use HTTPS when deployed. No build dependencies.

## Next priority
1. Run a real desktop and iPhone smoke test; fix issues before adding scope.
2. Refactor into Phaser + TypeScript/Vite with a test suite while preserving playability.
3. Add camera-relative right-stick touch aiming, collision-aware vehicle driving, sensible on-foot/car controls, responsive HUD.
4. Add enterable interiors, NPC interactions, inventory and character creator.
5. Design server-authoritative Colyseus multiplayer and persistence; never trust client balances, combat or inventory.

## Claude/Codex coordination
Read AGENTS.md, CLAUDE.md, PROJECT_STATE.md, NEXT_TASKS.md and FILE_OWNERSHIP.md. Work on independent branches, record test results, update this file and avoid editing files owned by the other agent. No production deployment without user approval.

## Repository status
No GitHub repository was created from this environment. User must create `nightshift-city-online` or use a computer-enabled workflow that can create repositories; upload this package there. Do not assume it is already on GitHub.
