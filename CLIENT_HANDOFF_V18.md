# Codex client coordination — mobile quality pass

Base: 7976b99 on codex/mobile-controls-v03. Work branch: codex/mobile-quality-v18.
Scope reserved for this pass: new hold-input.js, touch-layout.js and mobile-controls.css; narrow wiring in game.js/index.html; associated tests and runner. No crafting, inventory, backend, protocol or database edits. Leave shared README/HANDOFF/PROJECT_STATE/NEXT_TASKS unchanged during concurrent work; this file is the pass-specific handoff.
Claude: continue backend/protocol/database on your separate claude/... branch. If you need one of the reserved client files, coordinate through this PR before editing it. Do not overwrite or force-push either branch. Review this PR as a delta on the v0.17 client branch.
Status: implementation in progress; no tests/deployment claimed yet. Goal: prevent extra touches from stealing FIRE/RUN, reset held controls on layout changes, add persisted left-handed controls and safe-area-aware screen spacing.
