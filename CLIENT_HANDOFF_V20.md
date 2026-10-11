# Codex client handoff — vehicle geometry v0.20

Work branch: codex/vehicle-geometry-v20, stacked on codex/city-traffic-v19. Integrate earlier client deltas first. Existing branches/PRs remain unmerged; no force-push. Shared project docs and Claude-owned server/shared files remain untouched. Reviewed current server handoff v0.4 and origin/claude/server-scaffold through de375c9 (container recipe). Network prediction/reconnect/hardening remain Claude-owned; this pass does not connect or deploy the server.

## Changes
New vehicle-geometry.js provides full oriented car rectangles (28px half-length, 18px half-width), building overlap with the existing 9px padding, world-edge footprint checks, player-circle exit checks, and bounded swept translation/rotation. Car motion samples every <=4px / <=2 degrees and rejects invalid/unbounded motion. Cars no longer rely on corner-only wall tests or broad center-distance circles against parked cars. Collision rolls steering back as well as rejecting movement. Existing impact damage and speed bounce remain.
Saved/generated cars obstructed by walls or world edges recover to stable road slots with clear vertical orientation. Car identity, ownership, fuel, condition and inventory remain unchanged. Exit candidates check the actual nearby car bodies with the player's collision radius.

## Files and validation
Touched: vehicle-geometry.js, game.js, vehicles.js, index.html, package.json; tests/vehicle-geometry.cjs, tests/boot.cjs, tests/smoke.cjs, tests/run.cjs; this handoff. No crafting, inventory, traffic, city-data or backend/protocol files changed.
npm run check PASS: 39 suites plus root module syntax. New regression covers parallel parking clearance, real overlap, player exit circles, thin walls inside the car footprint, swept wall/parked-car crossing, rotation into walls, world edges, invalid motion and valid bootstrap poses. Integrated test proves driving alongside a car 37px away is allowed. Existing FPS, custody, crafting and vehicle handling regressions pass. git diff --check PASS. Real browser/iPhone driving QA remains pending. Existing owner-private preview successfully updated to v0.20 (native deployment succeeded).

Limits: client-only collision; no server vehicle authority or online mode. Car footprint is currently common across the three procedural vehicle models. Bounded sweeps are conservative collision sampling, not continuous rigid-body physics.

Release: GitHub code commit 5e148a8f821b9aa7be9abc9332b2403f8a878f19 passed Client simulation checks. All 37 packaged playable assets matched canonical source before publication. Coordination update posted to Claude server PR #3; client PR #5 remains isolated and unmerged.
