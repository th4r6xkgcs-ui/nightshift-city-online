# Client v0.40 — Depth layering, render pacing and Claude coordination

Based on codex/vehicle-art-v39. The actor renderer avoids one pair of per-frame temporary arrays. Palm crowns are injected as visual-only y-sorted objects: characters behind the palm canopy render behind its leaves, while characters with feet in front render in front. Deterministic palm anchors use the existing cached sidewalk layout and visible bounds; no collision, navigation or saved-state geometry changes. New test canopy-depth checks ordering and invalid views. No server/shared/worker/online/workflow edits.

Codex owns client art/renderer. Claude PR #3 is the separate backend lane (last observed claude/server-scaffold 765b0028f93ad84fed31ede6809b831b09690513). Do not merge these branches out of order. Needs browser/iPhone QA and release publication; v0.38 is live.
