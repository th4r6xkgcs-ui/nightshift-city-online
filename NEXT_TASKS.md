## CURRENT — v0.57 detailed city art (local review, 2026-10-13)

Branch: codex/premium-art-v56, draft PR #43 stacked on codex/living-streets-v55. Read CLIENT_HANDOFF_V57.md. Completed four areas: newer mask-shaded character bodies with approved face/hair/pistol art, cached storefront depth, distinctive car details and eight-direction pets, mobile culling/idle sprite preparation. Added a real pet inspection screen and fixed studio animation cycles and prewarm resume. Claude heads rechecked: rpg-play 741dc7d4 / rpg-core 27aeee15; only completed character art/studio files were selectively integrated. New map/combat/city systems remain separate; further gang/crew expansion is deferred until multiplayer. Local review only; hosted private v0.55 unchanged. No merge or access changes.

## PREVIOUS — v0.56 premium pixel finishing (review build, 2026-10-12)

Branch: codex/premium-art-v56, stacked on v0.55. Exact latest Claude rpg-play a01a9ff2 / rpg-core b34c95c9 integrated; read CLIENT_HANDOFF_V56.md for ownership, assets, tests and remaining master-roadmap gaps. Redrawn faces, 12 distinct haircut silhouettes, six denser pistol designs, finer shared character pixels and animated material details, crisp customized cars, authoritative studios and short-phone layout fixes. 111 suites passed; 151-asset build; real Edge render/studio/save/layout checks passed. This remains a local review build; no new deployment, merges or access changes. Crew expansion remains deferred.

# After v0.55 Living Streets

Current branch: codex/living-streets-v55. See CLIENT_HANDOFF_V55.md. Next: physical iPhone Safari/audio/performance checks, refine public-art hooks with Claude, and extended gameplay balance QA. Further crew/follower/gang expansion waits for multiplayer. No merges or public access changes authorized.

## Historical priorities

# Larger milestones after v0.54

Owner direction: a polished solo crime RPG on phones first, larger tested batches, MMO later. Canonical combined client: codex/visual-overhaul-v54; Claude completed RPG snapshot 8b6c4c3. Coordinate file ownership through PR #3 and post exact combined heads for Claude's rpg-play build.

- Codex current milestone: refine characters, vehicles, architectural materials, lighting and mobile presentation. Additional crew development deferred until multiplayer.
- Codex presentation milestone: storefront/interior detail, crew transport art, mobile HUD/menu polish and rendering budgets. Real iPhone/DOM/audio QA is still required.
- Claude activity milestone: bank heists, gym, club deals, lifetime stats and RPG balance. Claude owns their new modules and backend; Codex handles agreed client wiring.
- Joint release milestone: integrate completed snapshots, regression/soak checks and private preview deployment. No isolated feature should be described as a completed project.
- Later: authoritative multiplayer/account integration once solo systems and mobile verification are stable.

Completed combined v0.54: crew transport, exact latest RPG modules, persistent named-contact familiarity, city event journal and hard-crash loyalty consequences. 89 suites pass; 87 static assets. Crew/rival combat, dynamic customer relationships and physical iPhone verification remain outstanding.


Current art pass: high-density Canvas rendering (2× DPR, four-million-pixel budget), smoother sprite sampling, vehicle paint/glass highlights, clothing shading, rooftop glass, storefront planters/signs and restrained mobile HUD finishes. See CLIENT_HANDOFF_V54.md. Further recruitment/follower/gang-management expansion is deferred until multiplayer. Existing crew saves and gameplay remain intact. Imported Claude RPG snapshot remains 8b6c4c3; newer refs 8495bd7 / 24d1749 were observed but are not integrated.

## Historical backlog (superseded by priorities above)

# Next tasks
- P0: Real desktop and iPhone Safari QA: simultaneous movement/aim/fire, portrait/landscape HUD, brake, map, shop, audio and backup export/import.
- P0: Modular scene/state architecture before a scoped Phaser/TypeScript migration; retain existing behavioral regressions.
- P1: Expand furnished interiors, authored city content and interaction feedback; add explicit safe-zone rules.
- P1: Traffic avoidance and lane routing, pursuit vehicles and collision tuning. Road-center GPS and timed signals now exist.
- P1: Improve combat effects/animations and create production sprite/audio assets.
- P1: Formalize loot expiry, car search/impound and globally unique content IDs before multiplayer.
- P2 (Claude-owned): Authoritative server/protocol scaffold, inventory/economy/combat transactions and two-client tests.
- P2: Persistent online accounts, properties, garages and optional PvP.

Completed v0.14: fixed timestep, frame-rate integration checks, map/GPS/courier routing, walkable shop, medkits/valuables trade, expanded outfit preview, backup restore/undo and improved vehicle handling/braking. No paid infrastructure is required for this local client.

Completed v0.15: salvage, reputation/milestones, three courier routes, stamina, world lighting/districts, neutral clinic protection, road GPS, signals, bounded feedback, time-based camera, shared renderer and stylesheet packaging.
