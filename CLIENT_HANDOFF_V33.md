# Client v0.33 — Neighborhood architecture

Four visual identities follow the existing district boundaries: warm West End palettes, balcony rails and planters; cool Midtown roof trim, bright facade columns and sidewalk bus shelters; worn Southside roofs, fire escapes, graffiti and dumpsters; Docks freight stacks, rooftop vents and loading stripes. Ground furnishings are cached with the existing street art. Catalog geometry, collision, economy, saved state and online protocol remain unchanged.

Touched world.js, package.json, tests/neighborhood-art.cjs, tests/run.cjs and this handoff. Shared HANDOFF.md remains the historical client foundation; this release-specific handoff avoids concurrent edits with Claude.

Validation: npm run check passed all 58 suites and root JavaScript syntax checks. Canvas-only daylight Midtown and Docks scenes inspected. New checks cover exact district boundaries, deterministic distinct architecture, finite drawing coordinates and unchanged gameplay state. Actual browser/iPhone touch, audio and frame-rate QA remains pending.

Release: separate draft PR based on codex/atmosphere-v32; private preview publication succeeded. GitHub Client simulation checks passed for code commit 8c0ad0198e84cfddc398a639264528e16969d85d; draft PR #18 is open. No merge or server/shared/worker/workflow edits.
