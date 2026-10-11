# Actor depth and evening atmosphere — v0.32

Branch codex/atmosphere-v32, stacked on codex/animation-art-v31. Client rendering scope reserved on Claude PR #3 including indoor animation bookkeeping. Online/server/shared/worker/workflows unchanged; keep client stack draft/unmerged.

New scene-renderer.js filters actors against the viewport with a 130px margin for headlights/shadows, then sorts parked/traffic cars, civilians, officers and the on-foot player by y with stable ties. Officers retain badges and police projectiles draw separately; the old direct pass remains as fallback for standalone core tests. This fixes cars/characters always appearing in category order and avoids drawing distant sprites/creating their atlas variants. Buildings keep the existing separate architectural layer, so this is actor depth sorting, not full roof/prop occlusion.

Cosmetic movement angles now follow actual player/civilian/officer displacement; sprite bodies use those while moving, with weapon aim still independent. Indoor roomPos previously lacked the animation clock/angle, causing idle/east-facing cached bodies despite walking. It now receives the existing walkTicks and measured facing; room coordinates/collision/interactions are unchanged. These fields are transient and require no save migration.

Rain intensity fades during evening clock minutes 1080..1260 (18:00..21:00), using the existing saved eight-minute world cycle. Rain is a low-opacity visual overlay with at most 90 deterministic moving streaks per frame; road patches and lamp reflections appear while raining. It has no physics, heat, visibility or economy effect, no new control and no extra saved key. Day remains clear. Invalid effect time/view values reject or normalize safely. No FPS claim or actual device QA claimed.

Touched: scene-renderer.js, environment.js, sprite-renderer.js, game.js, citizen-ai.js, crime.js, home.js, index.html, package.json, tests/atmosphere.cjs and tests/run.cjs. Separate handoff preserves shared docs.

Validation: npm run check passes 57 suites plus root syntax; git diff --check passes. New checks verify stable visible depth/culling, invalid camera rejection, rain bounds/fade, rendering state preservation, actual movement-facing and indoor walking animation clock. Existing physics/AI/cover/controls/custody/economy/save tests retained. Internal 390x844 Canvas evening render inspected; browser/iPhone DOM/touch/performance/audio QA remains pending. Build emits 48 playable assets with no dependencies, collision/economy/save rules changed.

Release pending: draft PR and existing private preview publication.
