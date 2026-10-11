# Client projectile cover and reload deadlines — v0.24

Branch codex/cover-v24, stacked on codex/aim-feedback-v23. Claude owns server/, shared/, worker/ and workflows; none changed. Reviewed server v0.8 handoff (8841945); its hosting configuration and moderation remain separate from this offline preview. Keep client PRs draft/unmerged.

Cars now provide projectile cover using swept segments against their actual oriented rectangular bodies. Player and police projectiles resolve the nearest wall/car/character; covered characters take no hit. A car strike reduces condition by three, clamps at zero, persists immediately and emits the existing impact particles. Wrecked cars remain physical cover; engine condition and garage repair rules remain unchanged. Police queries exclude the player's current car to preserve existing five-HP driver hits, avoiding invulnerability inside vehicles. Car cover does not hide a character from police sight or alter pedestrian navigation.

The first player bullet segment includes the path from player to muzzle, preventing close obstacles from being skipped by the spawn offset. The existing crosshair turns amber when a wall/car obstructs the line to its point; a character hit before cover takes precedence. No extra permanent HUD or controls.

Reload/fire input now finalizes an elapsed reload before starting another reload or firing, using the actual passed shot timestamp. Clicking at the deadline cannot restart a completed reload or fire from a stale magazine. Existing menu/death/weapon/safe-zone guards still run first. Surrender releases every input source, including mouse and automatic aim-stick fire.

Touched: vehicle-geometry.js, vehicles.js, game.js, crime.js, feedback.js, index.html, package.json, tests/projectile-cover.cjs, tests/reload-deadlines.cjs, tests/smoke.cjs and tests/run.cjs. Separate handoff avoids concurrent shared-document changes.

Validation: npm run check passes 48 suites and root syntax checks; git diff --check passes. Coverage includes rotated body intersections, zero/invalid rays, nearest wall/car/entity ordering, persisted bounded damage, police cover, driver damage, muzzle obstruction, live reticle/entity precedence, event-time reload completion once, menu isolation and surrender input reset. Existing controls/custody/physics/economy suites retained. Internal 390x844 canvas render reviewed; real browser/iPhone DOM, dual-touch, audio and file-picker QA remains pending. No multiplayer authority is claimed.

Release: prepared for draft PR and update to the existing owner-private preview. No backend changes, paid services, audience changes or PR merges.
