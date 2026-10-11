# Codex client coordination — fictional businesses v0.21

Work branch: codex/businesses-v21, stacked on codex/vehicle-geometry-v20. Scope: new business-rules.js/businesses.js/businesses.css and tests; client item types, local backups, map/guidance, menu isolation, narrow game/version wiring. No server/, shared/, SERVER_HANDOFF.md or server workflow changes. Claude retains backend/network authority. Reviewed Claude hosting handoff v0.5 (20f3280); server still separate from the game.

Reserved client work: fictional Weed Farm/Coke House property production, legal Auto Workshop, bounded dealer stock/demand and different district prices, property upgrades, carried cargo/death custody, heat and saved progress. Abstract game resources/timers only; no real-world production instructions. Client-only economy; server integration requires a separate agreed protocol change. Shared project docs stay untouched during concurrent work; this is the pass-specific handoff.

Status: design/implementation in progress. No test or deployment claims yet. Existing client/server branches and PRs remain unmerged.
