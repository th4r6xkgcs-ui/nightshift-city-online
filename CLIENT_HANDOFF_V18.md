# Codex client coordination — mobile quality pass

Base: 7976b99 on codex/mobile-controls-v03. Work branch: codex/mobile-quality-v18.
Scope reserved for this pass: new hold-input.js, touch-layout.js and mobile-controls.css; narrow wiring in game.js/index.html; associated tests and runner. No crafting, inventory, backend, protocol or database edits. Leave shared README/HANDOFF/PROJECT_STATE/NEXT_TASKS unchanged during concurrent work; this file is the pass-specific handoff.
Claude: continue backend/protocol/database on your separate claude/... branch. If you need one of the reserved client files, coordinate through this PR before editing it. Do not overwrite or force-push either branch. Review this PR as a delta on the v0.17 client branch.
Status: implementation complete; npm run check passes 36 suites and root module syntax checks. Existing owner-private preview successfully updated to v0.18; native deployment returned succeeded. Goal: prevent extra touches from stealing FIRE/RUN, reset held controls on layout changes, add persisted left-handed controls and safe-area-aware screen spacing.

## Result and validation
- FIRE/RUN now each own one pointer; unrelated releases/cancels cannot end another touch. Global input reset releases captures and allows immediate reacquisition. Disabled controls and secondary mouse buttons are ignored. Held buttons have visible feedback.
- MORE → CTRL offers left-handed mirroring, compact controls, hint visibility and defaults. Preferences use a separate browser-local controls key; they intentionally stay on the device when character backups are restored. Changing layout clears held movement/fire/run and re-centers the movement nub after resizing. Settings is a nonmodal popover; it closes on outside interaction/keyboard input and cannot open over gameplay dialogs.
- Added viewport-fit=cover and safe-area-aware spacing, small-screen stick sizes and short-screen spacing. These are source changes, not verified Safari screenshots.
- Touched: hold-input.js, touch-layout.js, mobile-controls.css, game.js, index.html, package.json; tests/hold-input.cjs, tests/touch-layout.cjs, tests/boot.cjs, tests/smoke.cjs, tests/run.cjs; this handoff. No crafting/inventory/backend/protocol/database changes.
- Validation: npm run check PASS (36 suites + syntax); git diff --check PASS; build suite verifies each playable asset byte-for-byte. Actual iPhone portrait/landscape, touch ergonomics and audio remain pending.
- Integration: PR #2 targets codex/mobile-controls-v03, not main; apply this small delta after v0.17. No existing branch or PR was merged/force-pushed. Check upstream again before integrating concurrent Claude work.

Release verification: GitHub code commit 31fc2a16ad082d5ac4c56da3880e412cbd96dbf8 passed Client simulation checks. All 34 packaged playable assets match canonical source. Hosted source contains this client delta; private hosting identifiers are intentionally omitted here. This PR remains open and unmerged for concurrent integration.
