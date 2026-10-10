# HANDOFF — Nightshift City Online

## CURRENT — v0.5 homes and style (2026-10-10)
Branch: codex/mobile-controls-v03, PR #1. Local single-player Canvas prototype, independent of Garage. Adds home.js: saved skin/shirt/hair character choices, style dialog, furnished walkable apartment, furniture collision, wardrobe, bed healing, storage save interaction and safe return to exterior. HOME opens owned apartment while on foot. USE interacts near bed/wardrobe/storage/exit. World simulation pauses indoors and during customization; indoor firing/reload is blocked. Mobile action buttons use compact grids with landscape CSS. These layouts are NOT visually verified.

Tests executed: node tests/smoke.cjs, node tests/activities.cjs, node tests/home.cjs — all PASS. Home integration harness loads all scripts and checks profile validation, apartment price/entry, indoor weapon lock, movement/exit and rest healing. Node DOM/Canvas mocks do not verify real touch or visuals.
Browser attempt: node tests/browser.cjs blocked because Playwright Chromium executable is absent; browser download failed with truncated archive. Browser smoke source is included for a configured environment (`npm install --no-save playwright`, `npx playwright install chromium`, serve on port 8080). Real Safari/iPhone QA pending.

Touched: index.html, activities.js, home.js, tests/home.cjs, tests/browser.cjs, README.md, HANDOFF.md, PROJECT_STATE.md, NEXT_TASKS.md.
Known limits: storage only saves progress, no item inventory; rooms are local overlays, no visitors/server; style has color choices rather than full sprite outfit catalog. Zero health still needs death recovery. Infinite instant reload remains. No Phaser migration, real multiplayer, police response, finished art or deployment.
Next: real mobile layout/twin-touch QA; finite ammo/timed reload and health recovery; modular Phaser migration; Claude backend/protocol foundation on separate branch. No deployment without authorization.


## CURRENT — v0.4 gameplay extension (2026-10-10)
Added activities.js loaded by index.html: courier pickup/dropoff job with $225 reward, on-screen objective direction/distance, and locally saved apartment purchase for $1200. Added tests/activities.cjs (test source written; execution NOT independently verified). Run `node tests/smoke.cjs && node tests/activities.cjs` before merge. No online multiplayer, server, or actual enterable apartment interior. IMPORTANT: review mobile HUD fit, proximity and script loading in a real browser. Source branch: codex/mobile-controls-v03. Continue preserving independent Claude backend ownership.


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
