# Client v0.46 — Combined RPG release

Integration branch based on v0.45 actor-art. Imported the exact 15 root RPG modules and 8 corresponding pure test suites from Claude rpg-core 8cee2fe: skills/perks, weapons, casino, per-car tuning, street races, home upgrades and goals/tracker. Module files remain byte-identical to Claude's snapshot. Existing v0.43–v0.45 art and depth fixes remain.

Wired modules before boot; added rpg-integration.js to detect RPG dialogs and client guards to stop movement/fire/reload/interact while open. Added all seven RPG storage keys to backup allowlist. New live integration regression covers actual HTML startup, installed wrappers, modal input isolation, skill/goal persistence across reload, goal reward once, backup keys and loaded-magazine firing. Existing harness/render/home tests now support the modules' browser primitives and deterministic timers; cache test allows bounded home overlay while still checking two cached surfaces.

Validation: 74 suites and root syntax checks, including all existing gameplay plus Claude suites and combined integration. Canvas night city and daytime home renders reviewed. Static build contains 65 playable assets. Real browser/iPhone touch, DOM layout, audio and long-session balance/performance remain pending. No claim of multiplayer publication; server/shared/online/worker are excluded. New daily NPC routines, traffic redesign and additional interiors remain later milestones, not part of this integration release.

Claude coordination via PR #3: exact source snapshot and file reservations recorded; no edits to Claude branches or module internals. The combined client branch is the new base for further RPG integration. player.ammo remains loaded-magazine count. No merge into main.
