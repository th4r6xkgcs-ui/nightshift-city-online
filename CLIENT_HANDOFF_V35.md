# Client v0.35 — Apartment and shop art

New interior-art.js renders two distinct cached room surfaces: apartment wood planks, rugs, tiled kitchen floor, raised wall trim and windows; shop checker tiles, aisle runner, counter approach, wall sign and entry mat. Floor decorations introduce no obstacles. Existing furniture placement, room boundaries, walking camera and interaction points are unchanged. Cache is bounded to two 640x420 surfaces; canvas-less rendering retains a clipped direct-draw fallback.

Fixed shop exits always announcing West End: they now report the actual outdoor district. Updated runtime and loading version labels to v0.35. Internal render inspection now supports home, shop and landscape scenes.

Touched interior-art.js, home.js, index.html, game.js (version label only), package.json, tests/interior-art.cjs, tests/render.cjs, tests/run.cjs and this handoff. Release-specific handoff avoids editing shared documentation concurrently with Claude.

Validation: npm run check passed all 60 suites and all root JavaScript syntax checks. Portrait and landscape apartment/shop Canvas renders reviewed. New checks cover surface reuse/bounds, distinct finite canvas-less art, balanced clipping, unchanged gameplay objects and correct district exit. Existing movement, furniture collision, indoor weapon lock, store/rest/style/shop and modal suites pass. No actual browser/iPhone touch, DOM layout, audio or frame-rate QA claim.

Release: draft PR based on codex/night-art-v34; private preview publication pending. No merge and no server/shared/worker/online/workflow changes.
