# Project state
v0.10 client: dependency-free Canvas HTML local simulation with mobile twin-stick controls, vehicle collision/exit rules, minimap and validated local saves. Tests: Node VM simulation harness.
Target: Phaser/TypeScript client, Colyseus authoritative multiplayer, persistent profiles/inventory, properties and hybrid legal/crime city activities. No server, database or multiplayer exists yet.
Art remains geometric placeholders. Mobile Safari visual and touch testing is pending.

Local homes/character module: home.js. Courier/property ownership: activities.js. Walkable furnished apartment, rest healing, wardrobe and saved character colors. Integrated Node DOM mock tests pass; actual browser tests blocked by missing Chromium.

combat.js: finite ammunition and timed reload. recovery.js: local shop transactions, crash damage and timed hospital recovery. Five simulation test suites pass. No police AI or enemy damage system yet.

Inventory custody now includes carried wallet, ammunition and pistol. Death drops persist locally until expiry; home/glovebox transfers use tap panels. All six simulation suites pass. No server inventory authority or robbery implementation.

crime.js: local NPC robbery, fleeing, delayed police dispatch, building-blocked sight, officer damage, escape heat decay and surrender. Combat script loading order repaired; integration follows HTML order. Seven simulation suites pass. Police pathfinding and browser/device QA pending.
