# Client v0.36 — Driving presentation

Camera zoom now varies continuously with speed, replacing the abrupt speed-three target switch. A bounded 84px directional lookahead eases using elapsed time, reverses with backward travel, fades back when stopping/exiting and remains clamped to the world. Vehicle handling constants, simulation integration and collisions are unchanged. Successful low-speed exits now clear vehicle speed so a parked car does not retain wheel animation or headlight beams.

Headlights use twin stepped beams, fade with darkness and stay off for inactive parked cars. Active player/traffic cars keep lamps lit when stopped. Mouse/button/keyboard braking lights the rear lamps; stopped traffic displays brakes. Reverse lamps and small brake/reverse spill appear at the rear, and player front wheels reflect steering input. Beams stay within the existing scene culling allowance.

Driving HUD shows fuel and body condition, identifies reverse travel and reports an empty tank or required repair. Minimal-client fallback stays available when the optional vehicle module is absent. These are presentation functions; no saved fields or economy changes.

Touched camera.js, environment.js, sprite-renderer.js, vehicles.js (pure dashboard only), game.js, index.html/package.json version labels, tests/driving-view.cjs, tests/render.cjs, tests/run.cjs and this handoff. Shared documentation remains untouched to avoid concurrent edits.

Validation: all 61 suites and root module syntax checks passed. New checks cover continuous zoom, forward/reverse lookahead equivalence at simulated 30/60/120 FPS, invalid angles/state, bounded beams, parked headlight suppression, actual mouse brake colors, render immutability and live HUD integration. Existing movement/handling, collisions, pause and persistence checks pass. Night driving portrait and reverse/braking landscape Canvas scenes inspected. Real browser/iPhone layout, touch/audio and measured frame-rate QA remains pending.

Release: draft PR based on codex/interior-art-v35; private preview publication succeeded. Draft PR #21 is open; GitHub Client simulation checks passed for final code commit 9cf9f832d70d0cabef17135893c51af0143acae9. The release archive contains all 49 playable assets matching the tested source. No merge or server/shared/worker/online/workflow changes.
