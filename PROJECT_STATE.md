# Current project state — v0.51

Canonical combined client: `codex/street-customers-v51`, based on v0.50.1. Dependency-free Canvas/localStorage, mobile-first, separate from Nightshift Garage. Private static preview includes exact Claude RPG rpg-core 472505c modules; no multiplayer backend is deployed in this preview.

Current gameplay includes gang membership/custom founding, local corner influence, bounded recruits and passive physical followers, loyalty/escort jobs, noncombat rival pressure, premium street customers, existing production/dealer economy and RPG progression. Ordinary walking/driving/combat/police/courier/interiors continue to work.

Checks: 83 suites plus root syntax; 74 static assets. Ten simulated minute crew soak and physical escort completion pass. Customer transactions share existing inventory, market demand and sales ledger. Atlas overflow avoids repeated canvas rebuilding at the eight-atlas cap.

Limits: physical iPhone, real DOM/audio and extended balance QA pending; companions/rival envoys are passive, no vehicle seating; authored customers are static; claims represent local corners, not whole district capture. Claude owns RPG/backend work. New phases should start from this combined top and reserve files through PR #3.

Read CLIENT_HANDOFF_V51.md / CLIENT_HANDOFF_V50_1.md / CLIENT_HANDOFF_V50.md. Detailed older state is preserved below as history.

## Historical state (superseded)

## Historical client: v0.17
Saved crafting levels, upgraded apartment bench, six abstract recipes, finite-ammo transaction guards and crafting modal isolation. 34 automated suites pass. Browser/device QA pending; local single-player only.

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
