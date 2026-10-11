# Client v0.50.1 — rival corner pressure

Base: combined v0.50 88ca20c2f8e977bb07a1e1ddfbe1e322dbd2f150. Separate codex/rival-pressure-v50-1 branch; no main/Claude merges. Claude RPG/backend unchanged.

Claimed corners face authored noncombat rival challenges after three minutes of active city use. Response window: two minutes. Contact dialogue offers a $100 truce, a 15-second physical stand with a local member at loyalty 40+, or ceding the corner. Standing requires player within 55px and local member within 100px, alive/on foot/heat below 2; leaving interrupts progress. Successful defense preserves the claim and schedules the next challenge. Missing the deadline releases only that corner; reclaim through the existing $250 / 20-trust system.

Rival envoys appear at challenged corners, HUD shows remaining time, STREET shows live dialogue countdown and navigation. Sticky close control improves long crew dialogues. No weapons, raid damage, new inventory, passive income or autonomous combat introduced.

nightshift-city-rival-pressure-v1 is saved with backups/autosave/pagehide. Cooldowns are bounded. Offline corner loss is intentionally absent: a saved confrontation receives a fresh two-minute response window on reload; standing progress resets. Leaving gang/ceding claims clears challenges on next tick. Pressure uses existing claims and physical CrewOps followers, without a competing reputation store.

Touched: rival-pressure.js, gang-life.js, gang-life.css, game.js, index.html, backups.js, package.json, tests/rival-pressure.cjs, tests/render.cjs, tests/run.cjs, this handoff.

Validation: npm run check (82 suites and root syntax); focused rival tests after final art/standing integration; npm run build (73 assets); git diff --check; night rival/crew Canvas render. Coverage: once-only challenges/payout-free resolutions, $100 cost once, physical loyalty gate and interrupted hold, deadline loss once, cede, reload grace, bounded state, failed action isolation, dialogue countdown and integrated 15-second standing resolution.

Limits: local single-player, authored rival envoys are passive/invulnerable; no rival combat/vehicle seating/multiplayer. Real iPhone and DOM/audio testing remain pending. Earlier v0.50 includes 81-suite checks, ten simulated minute follower soak and end-to-end escort completion.
