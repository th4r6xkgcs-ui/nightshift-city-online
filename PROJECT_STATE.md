# Project state
Current source version: **v0.16** (v0.15 remains deployed). Canonical GitHub branch `codex/mobile-controls-v03`, PR #1. Existing owner-private Sites preview is recorded in DEPLOYMENT.md.

The game is a dependency-free Canvas/localStorage single-player prototype. It does not yet use Phaser, TypeScript, Colyseus, a database or online accounts. Those remain target architecture, not installed functionality.

## Client modules
| Module | Responsibility |
| --- | --- |
| game.js | Scene globals, input, fixed-step update and collision |
| world.js / sprite-renderer.js | Fixed city catalog and shared procedural rendering |
| camera.js | Time-based viewport easing and clamping |
| movement.js | Sprint stamina and exhaustion |
| feedback.js | Bounded muzzle/hit/heal/loot effects |
| environment.js | Saved clock, district labels and lighting |
| safe-zones.js | Neutral clinic protection without pursuit escape |
| road-navigation.js / signals.js | Driving road graph and timed traffic lights |
| progression.js / salvage.js | Persistent reputation/milestones and salvage economy |
| clock.js | 60 Hz simulation, bounded catch-up, pause reset |
| navigation.js | Clearance grid routes, wall traces, swept projectile queries |
| combat.js | Finite magazine/reserve and timed reload |
| recovery.js | Shop economy, damage, delayed clinic recovery/protection |
| home.js | Character preview/outfits, walkable apartment/shop and furniture |
| crafting.js | Fictional gun/ammo/medkit/salvage recipes and touch menu |
| inventory.js | Pocket/stash/glovebox custody, consumables, death bags |
| activities.js | Persistent courier cargo/stages and property purchase |
| crime.js | Finite NPC wallets, police pursuit/projectiles, escape/surrender |
| vehicles.js | Stable car IDs, handling profiles, ownership/theft/services |
| traffic.js | Eight traffic actors on authored road loops |
| audio.js | Opt-in synthesized effects/engine |
| city-map.js | Service map, objective GPS and minimap markers |
| backups.js | Local backup export/restore/undo with failed-write rollback |
| guidance.js | Nearby interaction hints and context-sensitive controls |
| interface.js | Secondary action tray and keyboard shortcuts |

Validation: 33 suites plus root JS syntax pass, including actual HTML script order, fresh-context persistence, walking/driving at 30/60/120 FPS, menu pause, death custody and backup rollback. Canvas rendering can be inspected internally; it does not validate DOM layout or gestures. Real browser/iPhone audio, file picker and dual-touch QA still pending.

Remaining limits: placeholder art/audio; traffic uses simple loops and timed signals; no pursuit vehicles, lane navigation or dynamic road closures; local menus/interiors pause the world; no authoritative economy, online combat or cross-device cloud saves. Codex continues client work. Claude's backend ownership is unchanged.
