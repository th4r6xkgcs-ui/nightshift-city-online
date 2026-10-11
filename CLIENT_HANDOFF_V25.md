# Client civilian reactions and police memory — v0.25

Branch codex/city-ai-v25, stacked on codex/cover-v24. Client-only changes; Claude retains server/shared/worker/workflows and online authority. Reserved scope on Claude PR #3 after reviewing server v0.8 handoff. Keep client PRs draft and unmerged.

Nearby civilians react to successful gunshots, robberies and hard vehicle crashes. They remember the incident position, seek the far side of a nearby parked car using its rotated physical body, route around buildings/cars, hold shelter and resume wandering when panic expires. Moving cars are excluded from shelter choices. Gunshot panic lasts six seconds, robbery ten and crashes four; repeated incidents extend the deadline. Idle civilians no longer animate walking. Reactions are transient; saved wallets/deaths and business economy are unchanged.

Police dispatch near the reported incident instead of the hidden player's current position. Visible suspects update each officer's memory; after sight is lost, officers investigate that last known position and search nearby clear waypoints. Newer incident reports redirect investigation. Gunfire still requires line of sight, and existing projectile cover and driver damage remain intact. Officers route around physical cars as well as buildings. This pass does not implement police cover tactics, multiplayer AI or vehicle pursuits. Cars block projectiles and movement but do not obscure police sight.

Touched: citizen-ai.js, police-ai.js, crime.js, game.js, sprite-renderer.js, index.html, package.json, tests/citizen-ai.cjs, tests/police-ai.cjs and tests/run.cjs. Separate handoff avoids overwriting shared documentation during concurrent Claude work.

Validation: npm run check passes 50 suites and all root syntax checks; git diff --check. New checks cover fixed incident memory, rotated parked-car shelter, moving/blocked shelter rejection, collision boundaries, cover holding, routine recovery, gunshot radius, rejected-shot isolation, robbery and actual hard-crash wiring, police dispatch position, visible pursuit, hidden-position isolation, search goals, newer reports and wanted-state cleanup. Existing controls, projectile cover, persistence, economy and frame-rate suites retained. Internal 390x844 Canvas render reviewed; actual browser/iPhone dual-touch/audio/DOM QA remains pending. Build emits 45 playable assets.

Release pending: draft PR and existing private preview update.
