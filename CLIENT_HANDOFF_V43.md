# Client v0.43 — Foreground shop sign layering

Stacked on v0.42 PR #27. Six commercial storefront types receive depth-sorted suspended sign fascias. Actor ordering uses the existing scene renderer; sign elements are view-culled and do not alter building collision, simulation, or saves. New regression suite checks ordering and no state writes. No Claude-owned server/shared/online/worker edits. Browser/iPhone QA and private site deployment remain pending.
