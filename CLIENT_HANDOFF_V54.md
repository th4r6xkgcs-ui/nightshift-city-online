# v0.54 visual overhaul

Canonical branch: codex/visual-overhaul-v54, based on deployed v0.53. Art-focused increment; existing crew/RPG contracts retained. Further recruitment/follower/gang expansion deferred until multiplayer.

Changed: render-quality.js and game.js preserve CSS-space simulation while sizing Canvas for up to 2× DPR within four million pixels; styles.css removes pixelated browser scaling. sprite-renderer.js adds smoother sampling, clothing shading, elliptical vehicle shadows and paint/glass highlights. world.js adds rooftop glass and storefront planters/signs. controls-ui.css refines HUD, buttons and toast surfaces. index.html/package.json wire v0.54. tests/render-quality.cjs validates density caps, invalid input, resize and rendering state isolation; tests/run.cjs and render.cjs include the check and retina capture. Shared current docs updated.

Validation: npm run check PASS, 89 suites plus root syntax. npm run build PASS, 87 playable assets. git diff --check PASS. Canvas portrait daytime Midtown and rainy nighttime Docks inspected at 2× resolution. Physical iPhone, real DOM/audio and performance QA remain pending. Procedural art remains an iterative foundation, not final production assets.

Claude RPG imported snapshot remains 8b6c4c3. Newer observed rpg-core 8495bd7 and rpg-play 24d1749 are not incorporated. No backend/Claude RPG internals modified. Coordinate through PR #3; do not merge/force-push shared branches.
