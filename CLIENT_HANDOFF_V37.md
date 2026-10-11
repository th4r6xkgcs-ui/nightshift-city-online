# Client v0.37 — City art direction

Rebuilt the building renderer following feedback that the visuals felt cheap. Deeper south-facing facades, larger residential window rows, rooftop terraces, grouped utilities, industrial skylights/corrugation, club roof equipment, bank roof housing, distinct shop awnings and material-specific masonry replace the repeated roof/label template. Dark blue asphalt, brighter crosswalk paint, cooler paving and greener foliage sharpen the street palette. Roof texture is restrained; doors and storefronts carry the contrast.

Existing footprints, entrances, gameplay collision and saves are unchanged. Roof terraces are cosmetic and not accessible. Existing night glow and rain reflections remain. No gameplay or online changes.

Touched world.js and game.js/index.html/package.json version labels plus this release handoff. Shared docs remain untouched for Claude coordination.

Validation: all 61 suites and root syntax checks passed, including deterministic district architecture, render state/geometry preservation, night art and cached ground reuse. Reviewed daytime Midtown and wet-night Southside Canvas scenes. Real browser/iPhone touch, DOM layout/audio/performance QA remains pending.

Release: draft PR based on codex/driving-view-v36; private publication succeeded. Draft PR #22 is open; final code commit b51059a65c2119e85ef85121011235dd87fe7961. GitHub Client simulation checks passed after the neon sign alignment. No merge or online/server/shared/worker changes.
