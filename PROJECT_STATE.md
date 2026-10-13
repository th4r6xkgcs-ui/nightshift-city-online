## CURRENT — v0.57 detailed city art (local review, 2026-10-13)

Branch: codex/premium-art-v56, draft PR #43 stacked on codex/living-streets-v55. Read CLIENT_HANDOFF_V57.md. Completed four areas: newer mask-shaded character bodies with approved face/hair/pistol art, cached storefront depth, distinctive car details and eight-direction pets, mobile culling/idle sprite preparation. Added a real pet inspection screen and fixed studio animation cycles and prewarm resume. Claude heads rechecked: rpg-play 741dc7d4 / rpg-core 27aeee15; only completed character art/studio files were selectively integrated. New map/combat/city systems remain separate; further gang/crew expansion is deferred until multiplayer. Local review only; hosted private v0.55 unchanged. No merge or access changes.

## PREVIOUS — v0.56 premium pixel finishing (review build, 2026-10-12)

Branch: codex/premium-art-v56, stacked on v0.55. Exact latest Claude rpg-play a01a9ff2 / rpg-core b34c95c9 integrated; read CLIENT_HANDOFF_V56.md for ownership, assets, tests and remaining master-roadmap gaps. Redrawn faces, 12 distinct haircut silhouettes, six denser pistol designs, finer shared character pixels and animated material details, crisp customized cars, authoritative studios and short-phone layout fixes. 111 suites passed; 151-asset build; real Edge render/studio/save/layout checks passed. This remains a local review build; no new deployment, merges or access changes. Crew expansion remains deferred.

## CURRENT — v0.55 Living Streets (2026-10-12)

Canonical branch: codex/living-streets-v55, built from verified v0.54 a2750326 and exact Claude rpg-play c31e4976 (rpg-core 556cec53 / art-pass fdc3c36d). Read CLIENT_HANDOFF_V55.md for file ownership, imported module provenance, save contracts and verification limits.

Full art layer: 20 distinct held guns, 11 pet species, baked collectible cars, deeper building materials, clear intersections, readable street props, animated neighborhoods, smoother camera and unified mobile HUD/notice queue. Gameplay modules imported intact; no new crew/follower/gang-management expansion. Preview remains local single-player, owner-private Sites; no backend deployment, merges or access changes.

Validation: 107 suites and root syntax; 137-asset static build; real Edge profile/home checks and 390/844/320 viewport, dual-touch cancellation, city/day/night/countryside/suburbs/apartment renders; zero page errors. Physical iPhone and sustained device/audio QA pending.

# Historical project state — v0.54

Canonical combined client: `codex/visual-overhaul-v54`, based on v0.52. Dependency-free Canvas/localStorage, mobile-first, separate from Nightshift Garage. Private static preview includes exact Claude RPG rpg-core 8b6c4c3 modules; no multiplayer backend is deployed in this preview.

Latest batch adds Claude respect/fishing/Hustle/lab/weapon-mod systems, saved contact familiarity, a 24-event journal and crash loyalty consequences. Detailed contracts: CLIENT_HANDOFF_V53.md.

Current gameplay includes gang membership/custom founding, local corner influence, bounded recruits and passive physical followers, loyalty/escort jobs, noncombat rival pressure, premium street customers, existing production/dealer economy and RPG progression. Ordinary walking/driving/combat/police/courier/interiors continue to work.

Checks: 89 suites plus root syntax; 87 static assets. Ten simulated minute crew soak and physical escort completion pass. Customer transactions share existing inventory, market demand and sales ledger. Atlas overflow avoids repeated canvas rebuilding at the eight-atlas cap.

Transport: followers board nearby stopped vehicles, with safe exits and on-foot resumption. See CLIENT_HANDOFF_V52.md.

Limits: physical iPhone, real DOM/audio and extended balance QA pending; companions/rival envoys are passive, vehicle seating is transient across reloads; authored customers are static; claims represent local corners, not whole district capture. Claude owns RPG/backend work. New phases should start from this combined top and reserve files through PR #3.

Read CLIENT_HANDOFF_V51.md / CLIENT_HANDOFF_V50_1.md / CLIENT_HANDOFF_V50.md. Detailed older state is preserved below as history.


Current art pass: high-density Canvas rendering (2× DPR, four-million-pixel budget), smoother sprite sampling, vehicle paint/glass highlights, clothing shading, rooftop glass, storefront planters/signs and restrained mobile HUD finishes. See CLIENT_HANDOFF_V54.md. Further recruitment/follower/gang-management expansion is deferred until multiplayer. Existing crew saves and gameplay remain intact. Imported Claude RPG snapshot remains 8b6c4c3; newer refs 8495bd7 / 24d1749 were observed but are not integrated.

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
