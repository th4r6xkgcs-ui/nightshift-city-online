# Client v0.45 — Actor art and Claude GPS contract

Rebuilt character silhouettes with a smaller head, longer tapered legs, rounded clothing/limbs, calmer outfit details and lighter ground shadows. Existing eight directions/eight gait frames, appearance colors, hats/bags, weapon/health overlays and bounded atlas cache remain. Cars gain a broad clipped clearcoat shading pass without changing silhouettes, wheel steering, lights, condition or physics. This is another procedural art improvement, not full cinematic mockup fidelity.

Claude coordination: fetched rpg-core 8cee2fe/rpg-play ca4cd18 and read latest PR #3 comment about balance, race payouts, goal tracker and map/GPS. His integration remains on client v0.42; this branch stacks on v0.44. Confirmed the requested NightshiftMap.navigate API already exists. Strengthened it with bounds checks and success boolean, label fallback/length bound, preserved IDs and invalid-request route retention. Added live walking/driving/clear regressions. Claude can connect his goal tracker to this API without editing client routing. RPG modules remain separate; acknowledgment/integration pending.

Touched sprite-renderer.js, city-map.js, tests/city-map.cjs, version labels game.js/index.html/package.json and this handoff. No backend/shared/online/worker/RPG edits or merge into Claude branches. player.ammo remains loaded magazine count.

Validation: all 65 suites + root syntax passed. Actual day landscape/night portrait Canvas renders inspected. Character atlases stay at 384x416, eight cached palettes maximum. Gradient fallback remains solid on unsupported contexts. Real iPhone/browser touch, DOM/audio and measured performance remain pending.
