# Consolidated visual release v0.43

Includes the full v0.39–v0.43 stack from codex/sign-depth-v43: detailed vehicle bodies and character clothing, lighter actor ordering, depth-sorted palm/tree crowns, shop awnings and commercial signs. This release updates the stale v0.38 display/package labels and registers tree-depth, awning-depth and sign-depth in the main test command.

Canvas QA exposed broadleaf crowns appearing on roofs because legacy tree anchors overlapped building footprints. Moved cached broadleaf fixtures and their matching depth actors to clear right sidewalk strips in West/South districts; Midtown/Docks keep palms. Added a regression checking canopy bounds against every building. No building geometry, collision, save or interaction anchors changed.

Touched world.js, game.js, index.html, package.json, tests/run.cjs, tests/tree-depth.cjs and this release handoff. All 65 suites and root syntax checks pass. Actual Canvas daytime landscape and wet-night portrait renders inspected. Real browser/iPhone touch, DOM layout, audio and measured frame performance remain unverified.

Coordination: checked Claude's current server and RPG handoffs and posted file ownership/release updates on PR #3. Multiplayer and RPG branches are not included in this static visual release. player.ammo remains the loaded-magazine count. No server/shared/online/worker/RPG edits or merges into Claude branches. Claude's acknowledgment remains pending.
