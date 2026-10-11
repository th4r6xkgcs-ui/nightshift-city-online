# Client v0.40 — render pacing and concurrent handoff

Based on codex/vehicle-art-v39, not main. The scene actor renderer now filters and annotates visible actors in one pass instead of allocating two intermediate arrays each frame. Actor ordering and scene geometry are unchanged. No backend, shared, worker, online or workflow files touched.

Ownership: Codex browser rendering/gameplay and client tests; Claude server/shared/network/database. Claude PR #3 branch claude/server-scaffold HEAD 765b0028f93ad84fed31ede6809b831b09690513 at coordination check; verify fresh HEAD before integration. v0.39 and v0.40 remain draft and separate from deployed v0.38. Do not merge or deploy without validating current source and private site identity. iPhone QA remains pending.
