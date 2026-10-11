# Client v0.53 — combined RPG and city reactions batch

Base: combined v0.52 f970d7e1944b3ce50b282da5a241ac79a589b64b. Claude RPG snapshot: rpg-core 8b6c4c3, rpg-play 12dc902 observed at session start. Owner asked larger complete milestones, parallel ownership and fewer tiny releases. Codex retains world/art/physics/NPC/crew/client wiring; Claude owns RPG/activity/economy/backend. His next heist/gym/club/stats batch is not part of this snapshot.

Imported all 25 completed Claude RPG files and 12 RPG test files byte-for-byte. Adds respect ranks, fishing, Hustle jobs, labs, weapon modifications, current goals/tracker, skill pacing and previous RPG fixes to the latest Codex city and crew-transport baseline. Four new RPG save keys join backups. Jobs/Fishing/Lab modals join the central client input/simulation pause guard. No module internals edited.

Persistent named contacts remember meetings, successful trades, local favors, joining/founding and nearby disturbances. Seven authored contacts get bounded trust/counters, saved familiarity and different greetings. Meeting alone pays no trust or rewards; failed transactions create no positive memory/event. Relationship memory is separate from existing faction reputation and does not change prices, demand or wallet rules. Disturbance reports use the actual Citizens.alert radius after weapon suppression and are throttled per contact for 15 seconds.

MORE → JOURNAL shows the most recent 24 gang/crew/trade/incident/territory events, newest first. Text is rendered with textContent, bounded to 110 characters, and included in backups. The journal pauses gameplay and captures keyboard shortcuts while open. Hard crashes within 160px reduce nearby crew loyalty by 2, with a saved 15-second cooldown. These are passenger/crew consequences, not armed combat.

New keys: nightshift-city-npc-memory-v1, nightshift-city-journal-v1. Imported keys: nightshift-respect-v1, nightshift-fishing-v1, nightshift-lab-v1, nightshift-jobs-v1. Save/pagehide/backup paths include them.

Touched client files: city-journal.js/css, npc-memory.js, citizen-ai.js, gang-life.js, crew-ops.js, rival-pressure.js, game.js, index.html, rpg-integration.js, backups.js, package.json; tests/city-reactions.cjs, tests/rpg-integration.cjs, tests/harness.cjs, tests/run.cjs; current shared summaries. Exact imported files are the Claude modules/tests named above.

Validation: npm run check (88 suites and module syntax); npm run build (86 playable assets); git diff --check; landscape night combined city/crew/rival Canvas render. New coverage: named memory bounds and prototype-key rejection, relationship growth, successful-action isolation, disturbance throttling, bounded journal, crash loyalty/reload, journal modal/backup wiring. Actual HTML integration confirms new RPG APIs and Jobs/Fishing/Lab gameplay guards. Harness now supports native-like button click and firstChild/childElementCount for the Hustle panel.

Limits: local single-player; active Hustle jobs remain session-only by Claude design. Crew and rival NPCs remain passive; no companion combat added. Relationships alter remembered dialogue, not autonomous long-term social simulation. Real iPhone, real DOM/audio, balance and long-session combined activity QA remain pending. Prior physical crew-escort and ten simulated minute routing soak regressions remain enabled.
