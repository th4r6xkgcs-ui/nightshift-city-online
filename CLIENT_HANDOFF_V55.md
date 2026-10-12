# v0.55 Living Streets — complete client art and current Claude integration

Branch: `codex/living-streets-v55`. Foundation: verified v0.54 `a2750326de39d35dd9ebb85b72d31b449a5f0206` (PR #41). Import: Claude playable `c31e4976cabd386c6a452e5c977374dd99ac3016`, containing RPG `556cec5364da0c10251e96ae3f4424e702aa1b15` and art-pass `fdc3c36d65b07ffd4c233a357e3152a08fd43a9f`. Imported RPG script bytes are verified against that exact playable snapshot. No backend/online source is deployed. No shared GitHub branches are merged or force-pushed.

## Presentation

Codex `detailed-art.js` / `detailed-art.css` extend public rendering APIs while keeping Claude-owned gameplay modules unchanged. Twenty held guns have distinct pixel silhouettes, grips, sights, scopes, magazines, material highlights and paint-palette support. Eleven pet species have pixel outlines, facial features, paws/wings, moving strides and distinctive coats. City/zone pet drawing reads Claude's existing position/state; apartment pet roaming retains Claude's renderer. Collection cars retain Claude's baked model/paint renderer; Codex adds restrained trim and immediate held-brake/reverse lamps. Character variety, hair, outfits, uniforms, armor, interiors, windows, lighting, countryside and suburbs use the imported compatible Claude art.

Buildings gain depth at masonry corners/window reveals, roof hatches, drains, planter boxes and recognizable shop fittings. Static street dressing includes hydrants, mailboxes, dumpsters, flower carts, crates and barrels; facades include vending machines and ATMs. Drawing does not add collision obstacles or change entrance coordinates. Intersection curb strips are cleared, crosswalks/stop bars are readable and arrows follow the actual legacy traffic routes. Signals show three lamp positions. Deterministic fans, laundry, steam and storefront displays remain bounded and pause with the simulation.

Camera follows in world space with elapsed-time easing and bounded lookahead, snapping after large teleports/reset. The 2x DPR / four-million-pixel budget and Claude adaptive rendering scale are retained. HUD numeric columns are stable; narrow-phone layouts preserve the unified Claude dock/minimap. Toast/goal/level notices share one bounded presentation queue. Saved rewards and notification producers are unchanged.

## Gameplay compatibility and ownership

Latest imported Claude systems include heists/venues/empire/events, stashes/market/life, supply/crafting economy, zones/farm/food, break-ins/lockpicking, hitman, collectible cars/chop shop/car meets, pets/decor, ledger and safehouses. Existing saves retain their migration rules; fresh players use Claude's owned starter apartment and unarmed crafting start. The legacy armed-save harness preserves combat/custody regressions. All new versioned save keys are included in backups. RPG modal guards are extended in Codex `rpg-integration.js`.

Codex did not add recruitment, follower or gang-management systems. Further crew expansion is deferred until multiplayer. Claude's already-completed modules are imported intact. Shared document changes were prepared after reading current main. Coordination/reservations and exact release results are posted through PR #3.

## Verification

- 107 automated suites and root module syntax checks pass, including Claude's completed rule suites and Codex art/camera/state-isolation tests.
- Static build contains 137 source-identical playable assets; excludes backend, docs, tests and credentials.
- Real Edge checks pass for startup, legacy profile save/reload, starter apartment entry/exit, simultaneous touch IDs/cancellation, walking, MORE, 390x844 / 844x390 / 320x568 HUD bounds and day/night rendering; zero page errors.
- Additional browser rendering verifies active pet adoption, city, countryside, suburbs, zone return and apartment; zero page errors. Art catalog renders 20 guns, 10 collection cars, 11 pets and 9 street props from actual loaded game APIs.
- Canvas render harness updated to reuse the common DOM harness; retina daytime capture succeeds.
- Imported Claude modules contain four pre-existing trailing-whitespace lines. They are preserved for byte-identical provenance; Codex-owned patch whitespace is checked separately.

Physical iPhone Safari, sustained mobile performance, audio listening, and extended gameplay/balance QA remain unverified. Browser emulation is not a physical-device test. Static owner-private Sites identity remains `appgprj_6acae562cbe88191a6e89b070ba3e147`. Deployment provenance is recorded in the draft PR / PR #3 after native deployment confirmation. GitHub currently reports the existing repository public; this release does not alter repository or Sites audience settings.
