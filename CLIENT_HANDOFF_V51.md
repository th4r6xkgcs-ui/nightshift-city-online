# Client v0.51 — street-customer economy

Base: combined v0.50.1 1f04d6e9515147e3da2d369f1967520a4461ad3d. Separate Codex branch. Claude RPG/backend unchanged; existing business rules extended with curated customers.

MORE → STREET routes to Eli (West End, 360/605), Tess (Docks, 1400/1285), and Lux (Midtown, 1400/605). TALK offers fixed requests: Eli 2 weed for $88, Tess 2 weed for $176, Lux 1 coke for $201. Customers pay a modest authored convenience premium over their linked dealer's sale price. Existing property production, collected stock and purchased stock all work; goods remain carried until handoff.

Sales run through BusinessRules.transact with a validated customer ID, market link, exact item/count and curated location. No actor-position spoofing or second inventory/ledger. Market demand is SHARED with ordinary dealer sales, so customers cannot bypass the five-minute demand refill. Customer cooldown is 90 seconds per NPC. Existing heat, pocket bounds, cash ceiling, on-foot/alive and hostile crew restrictions apply. Successful handoffs report their location through the existing Crime.report hook.

nightshift-city-customers-v1 saves bounded cooldowns/completed request count and is included in backups/autosave/pagehide. Existing business ledger remains authoritative for sold units/earnings, including Claude goals/daily observation. No edits to Claude-owned modules.

New customers stand outside road lanes with navigation clearance. Street Life contacts now participate in normal actor depth order, rather than being painted beneath every tree canopy. Existing contact interactions and labels remain intact.

Touched: business-rules.js, street-customers.js, gang-life.js, scene-renderer.js, game.js, index.html, backups.js, package.json, tests/street-customers.cjs, tests/render.cjs, tests/run.cjs, sprite-renderer.js, tests/sprite-atlas.cjs, README.md, HANDOFF.md, PROJECT_STATE.md, NEXT_TASKS.md and this handoff.

Validation: npm run check (83 suites and module syntax); focused customer tests and build after final placement/depth polish; npm run build (74 playable assets); git diff --check; portrait daytime customer Canvas render. Tests cover premium cash/inventory/heat/ledger, shared demand exhaustion/refill, cooldown, ID/action/location rejection, failure isolation, contextual TALK, save reload, backup key, sidewalk clearance/depth and property purchase → batch → collect → customer sale.

Limits: authored static customers, not generated pedestrian requests or persistent relationships; no price auctions, supply chain simulation or multiplayer authority. Earlier combined releases include recruitment/followers/escort jobs, rival corner pressure and their soak/integration tests. Real iPhone and DOM/audio verification remain pending.

Crowded-scene performance: more than eight shirt styles previously rebuilt 64-frame atlases every frame under LRU pressure. Overflow NPC styles now draw directly once the cap is reached; cached player styles still update on customization. A 15-style/30-frame allocation regression verifies no new canvases after warmup and the eight-atlas memory cap.

Shared root docs now identify the combined v0.51 client and remaining work; old release notes are preserved as historical sections. Latest fetched Claude RPG refs remain rpg-core 472505c / rpg-play 5ac81ae.
