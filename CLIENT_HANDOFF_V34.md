# Client v0.34 — Night street art

Storefront signs now brighten after dark, with stepped pixel glow, club/clothing window light trim, club/diner marquee bulbs driven by the existing simulation clock, entry light pools and rain-only storefront reflections. District lamps use warm West End, cool Midtown, amber Southside and green Harbor colors. Cached road stencils name neighborhoods. Stronger nighttime ambient tint separates lit facades from the street.

Lamp gradients and road reflections skip off-screen positions; ground labels retain the existing cached street surface. No extra render surfaces, timers or saved fields were introduced. Corrected the stale HUD version label from v0.32 to v0.34.

Touched world.js, environment.js, game.js (version label only), package.json, tests/night-art.cjs, tests/render.cjs, tests/run.cjs and this handoff. Separate release handoff avoids overwriting Claude's shared documentation.

Validation: npm run check passed all 59 suites and all root JavaScript syntax checks. Reviewed Midtown/Docks wet-night and Southside dry/wet-night Canvas renders. New tests verify day/night/wet differences, stable paused animation, drawing-state restoration, lamp viewport culling, no daytime gradients, four lamp palettes and unchanged gameplay objects. Build/source packaging checked by the existing build suite. Real browser/iPhone touch/audio/performance QA remains pending; no measured FPS claim.

Release: draft PR based on codex/neighborhood-art-v33; private preview publication pending. No merge and no server/shared/worker/online/workflow changes.
