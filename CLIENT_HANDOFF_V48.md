# Client v0.48 — street life and daily challenge integration

Base: Codex v0.47 054970c. Latest Claude rpg-core 472505c modules imported byte-for-byte: dailies-data.js, dailies.js, goals.js, tests/dailies.cjs. No Claude branch or main merge.

Sidewalk café tables, chairs and curved umbrellas enrich diner/shop frontages. Umbrella tops participate in scene depth; ground fixtures remain cached. Art changes preserve authored building collisions. Nearby civilians at routine stops briefly converse and face each other; conversations stop on danger. Gunshots, robbery and crashes leave a 20-second transient cautious state, shown by a small overhead cue and a shelter plan after fleeing. Pedestrians yield to approaching moving traffic and check signals at intersection road entry; once inside the road, signals do not strand them.

Claude daily/weekly challenges are wired into the client. Its modal pauses gameplay and its save key is included in backups. Latest Claude goals earnings fix preserved unchanged.

Touched client files: street-life.js, citizen-ai.js, citizen-routines.js, world.js, scene-renderer.js, game.js, index.html, backups.js, rpg-integration.js, package.json; tests/street-life.cjs, tests/citizen-routines.cjs, tests/run.cjs; exact imported modules above; this handoff.

Validation: npm run check (77 suites plus root syntax); npm run build (69 playable assets); portrait daytime Canvas render. New checks cover approaching/receding/stopped vehicles, signal entry and no midroad wait, conversation interruption, disturbance expiry, art state isolation, daily modal and backup wiring. Existing RPG tests and imported daily tests remain enabled.

Limitations: NPCs remain outdoors, social interactions are ambient, disturbance memory is transient. No shop interiors, jam rerouting, persistent relationships or new reactive police dispatch in this release. Static preview has no multiplayer backend. Physical iPhone and real DOM/audio verification remain pending.
