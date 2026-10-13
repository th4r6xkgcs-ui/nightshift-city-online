# v0.57 detailed city art — local review

## Provenance and ownership

Draft PR #43: https://github.com/th4r6xkgcs-ui/nightshift-city-online/pull/43, branch codex/premium-art-v56, base codex/living-streets-v55. Previous tested head b7f655c3a1264f9799df95e7b9fd9b168815bdb7 supplies the before-render comparison.

Rechecked Claude's completed heads on 2026-10-13: rpg-play 741dc7d4d899977f01b29f028a445bd777f627a1; rpg-core 27aeee15157114d7e90607e1c068bd7cf6ac1c54. Imported only character-art.js, character-pixel.js, studio.js, ART_SPEC.md, RPG_HANDOFF.md and tests/character-pixel.cjs from rpg-play. studio.js preserves Claude's even preview scale and has one Codex correction: use current ANIMS counts and duration-adjusted cycles (idle6/walk12/run10). No unfinished Claude work replaced. Other RPG modules remain the prior a01a9ff2 snapshot, rather than claiming whole-game integration. New expanded map, combat/wanted, NPC events and gang systems are not imported here. Crew/follower/gang expansion remains deferred by owner until multiplayer.

## Implemented increments

1. Character: Claude's 3x pixel-mask body/material rendering composed into the bounded shared 4x cache; approved fine faces/haircuts/headwear retained through premium-head-art.js. premium-body-art.js supplies articulated geometry and a low-detail fallback; high-detail bent arms/material shading come from character-pixel.js. Body knees, layered clothing, hand anchors and actual equipment remain synchronized. No new ownership rules or save schema.
2. Buildings: premium-district-art.js adds cached recessed windows, shelves/racks/booths, industrial doors, masonry and nighttime glass with a separate subtle reflection. Original facade drawing and doors/collision remain active.
3. Cars and pets: premium-vehicle-renderer.js adds panel gaps, handles, glass pillars, grilles, wheel arches and model-specific pickup beds/SUV rails/sports vents/classic trim to authoritative customized buffers. premium-pet-art.js replaces gameplay drawing with native 96x88 directional sprites for all 11 species; 8 walk, 4 idle, 4 sit and 2 sleep frames per facing. Sleep is an authored preview state; no new autonomous sleep behavior. pet-inspection.js/.css adds live species/animation/rotation/swipe/zoom preview through the existing Pets panel. It pauses gameplay and never adopts, purchases or equips.
4. Mobile budget: premium-art-renderer.js culls offscreen actors and uses smaller cached frames for distant visible NPCs at low zoom; mobile-art-budget.js prepares likely player frames one idle callback at a time. Fixed interrupted queues failing to restart after a modal. Character cache <=128 entries /24 MiB, pets <=256 entries /8,650,752 pixel bytes, facade <=24 entries. These are canvas-cache limits, not total tab/GPU memory guarantees.

## Changed files and integration

Codex owns premium-body-art.js, premium-district-art.js, premium-pet-art.js, mobile-art-budget.js, pet-inspection.js/.css, premium-art-renderer.js, premium-head-art.js, premium-vehicle-renderer.js and inspection-studio.js. index.html loads completed Claude pixel art before the shared premium compositor and new pet art after pet-art.js. game.js/package.json label this v0.57 review. Export/verification scripts, tests, README/HANDOFF/PROJECT_STATE/NEXT_TASKS and docs/art assets are updated. Claude owns imported character-art/character-pixel/studio and RPG systems; coordinate further changes via PR #3.

## Assets and review evidence

Transparent character atlases: 368 frames with direction, duration, hand anchor, wardrobe layer metadata in docs/art/street-atlas.json. Actual new pet atlases: pets-walk 704, pets-idle 352, pets-sit 352, pets-sleep 176, each with direction/frame/duration/anchor/world scale metadata. Existing pets-atlas is retained as the historical side-pose export; current gameplay uses the four directional atlases' definitions. Weapon/prop/car exports use authoritative runtime builders and current car refinements. Runtime remains procedural Canvas builders; exported PNGs/JSON are review/game-ready assets, not a new texture-loading backend.

Inspection sheets and browser evidence are copied into docs/art/v057-*; before body images are rendered from exact previous b7f655c with newer modules disabled. Family sheets and city screenshot show actual runtime artwork. No generated concept image substitutes for gameplay.

## Verification

npm test: 113 suites and all root module syntax checks PASS. npm run build: 158 playable assets. git diff --check: PASS. Browser verification commands: node scripts/verify-premium-browser.cjs; node scripts/verify-heads-pistols.cjs; node scripts/verify-four-pass.cjs; node scripts/export-world-atlases.cjs. Requires Playwright/Edge and a local server at 8080. Each uses isolated browser saves.

Real Edge checks: 96 distinct walk frames, all directions, live clothing/zoom/rotation, unowned preview isolation, owned outfit saving and reload, weapon attachments/finishes/live preview and held scaling, car inspection, 11 pets with 8 distinct directions each, 352 pet animation samples with binary alpha, pet inspector pause and save isolation; zero page errors. Character and pet inspector layouts fit 320x568 and 844x390; pet zoom control checked. Cache/cull/idle-prewarm regression checks and imported character pixel tests pass.

Measured headless Edge at 390x844/DPR2: warm city 180 samples median 16.7ms /p95 33.3ms. Idle prewarm 68 frames, max single frame 12ms. Separate cold 64-character-frame generation 485.3ms; warm 4096 lookups 37.5ms (~9.16us each). Cold atlas export is intentionally synchronous and can stall; gameplay preparation spreads generation. These are Windows headless measurements, not physical iPhone or guaranteed 60 FPS. Do not assert a measured speedup against v0.56: no paired device benchmark was performed.

## Remaining work

Physical iPhone Safari touch/audio/thermal/sustained performance remains pending. Full master requirements still include independently authored weapon/car angles, full action animation set, all attachment/body customization categories, all condition states and further world/object expansion. Pet inspection is preview-only. No new multiplayer, gang-management systems, GPU batching or production deployment. Owner-private Sites preview remains tested v0.55. No merges, force pushes or access changes. Repository was already public; this pass did not change that setting.
