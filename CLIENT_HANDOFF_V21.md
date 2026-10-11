# Codex client coordination — fictional businesses v0.21

Work branch: codex/businesses-v21, stacked on codex/vehicle-geometry-v20. Scope: new business-rules.js/businesses.js/businesses.css and tests; client item types, local backups, map/guidance, menu isolation, narrow game/version wiring. No server/, shared/, SERVER_HANDOFF.md or server workflow changes. Claude retains backend/network authority. Reviewed Claude hosting handoff v0.5 (20f3280); server still separate from the game.

Reserved client work: fictional Weed Farm/Coke House property production, legal Auto Workshop, bounded dealer stock/demand and different district prices, property upgrades, carried cargo/death custody, heat and saved progress. Abstract game resources/timers only; no real-world production instructions. Client-only economy; server integration requires a separate agreed protocol change. Shared project docs stay untouched during concurrent work; this is the pass-specific handoff.

Implemented v0.21: BIZ in MORE / B keyboard / USE near entrances. Buy Weed Farm ($1,800), Coke House ($4,200), or legal Auto Workshop ($1,600). Pay abstract supplies, wait one batch timer, collect into pockets, upgrade to level three. Storage is reserved before spending; batch yield locks at start. No unattended batch restarts. Illegal transactions require heat below two; carried cargo follows existing stash/glovebox/death-bag custody. Parts sell at the shop for $90 each.

West End and Docks dealers have different bid/ask prices, finite five-minute supply and demand, atomic wallet/item limits, and trade heat. Rotating rush orders consume goods only at the marked receiver before expiry, pay once, and retain cooldown after cancellation/expiry. One legal parts order joins the two underground orders. Properties, quotas, active batches/orders, cooldowns, and cargo are saved locally and included in backup restore/undo.

Validation: npm run check passes all 41 suites, including business rules, live modal isolation, production during paused menus, backup restore/undo, cargo custody and repeated overdue reloads. Root JavaScript syntax and git diff --check pass. Internal canvas render reviewed at 390×844; real browser/iPhone DOM, touch, audio and file-picker QA remains pending. No multiplayer or server authority is claimed.

Claude boundary: server/, shared/, SERVER_HANDOFF.md and workflows untouched. New item types weed/coke/parts and business actions are client-only. Server catalog, validation, persistence, cooldown/time authority and new protocol messages need an agreed later integration. Existing client/server PRs remain unmerged.

Release: implementation prepared for draft PR #6, stacked on v0.20. Existing owner-private preview publication is pending.
