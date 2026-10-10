# HANDOFF — Nightshift City Online

## CURRENT — 2026-10-10, v0.3
Repository: th4r6xkgcs-ui/nightshift-city-online. v0.2 imported as baseline; client improvements on codex/mobile-controls-v03. Independent Canvas single-player sandbox, no multiplayer/backend/deployment.

Completed: separate right touch aiming stick, camera-relative mouse aim, held FIRE/Space with rate limit, touch capture/cancellation and blur reset, frame-rate-adjusted vehicle drag, building and parked-car collision, stopped-car safe exit placement, save numeric bounds preserving zero balances/ammo/health, invalid building spawn recovery.
Touched: index.html, tests/smoke.cjs, README.md, HANDOFF.md, PROJECT_STATE.md, NEXT_TASKS.md, GITHUB_SETUP.md.
Validation: node tests/smoke.cjs PASS for save bounds/zeros, fire cadence, safe exits, vehicle building collision and frame execution at 390x844. This uses a mocked Canvas/DOM, not browser visual QA. Real Safari/iPhone testing remains pending.

## Next
1. Browser visual smoke test including dual-touch input, portrait/landscape HUD and exit edges.
2. Phaser/TypeScript/Vite migration preserving tested behavior; fixed-step simulation and swept bullets.
3. Character creator, finite ammunition/reload timing, interiors and one repeatable job loop.
4. Claude can implement server/shared protocol scaffold on a claude branch, with authoritative balances/inventory/combat. No real multiplayer until two-client tests pass.

## Known limits
Buildings are rectangles; collision uses vehicle corners and approximate parked-car circles. Shooting NPCs generates heat but no active police response. Reload supplies unlimited ammo instantly. Shops/interiors mostly placeholders. Saved health of zero has no death recovery yet. No traffic AI, authentication, server persistence, finished art or device QA.

## Handoff workflow
Fetch newest main and this branch before work. Review FILE_OWNERSHIP.md. Make independent branches, update exact tests and limitations, submit PRs; do not deploy without authorization.
