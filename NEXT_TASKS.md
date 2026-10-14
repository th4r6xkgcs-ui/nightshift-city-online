# Next tasks
- P0 (owner): approve gh-pages deploy of v0.71 (interiors, pursuit, combat feel); connect Cloudflare Workers Builds for the multiplayer server.
- P1 (Claude): interiors — per-building staff variety, robbable registers in shops, interiors for owned properties; pursuit — spike strips at ★4, police boats at the docks; combat — weapon-specific reload sounds.
- P0 (owner): approve or correct the three Option 3 master sprites (player, Vanta GT top-down, husky) — HANDOFF art correction. No atlas mass-production until approved.
- P1 (Claude, after approval): 8-direction key poses from the masters, then walk/run with planted feet; separate clothing layers; modular gun visuals; icons; interiors (correction prompt steps 4-9).
- P0 (owner): Option 3 review gate — approve/redirect the vertical slice (character, studio, carbine presets, Vanta GT, husky, props) before bulk catalog expansion; approve gh-pages deploy of v0.70.
- P0 (owner): approve deploying v0.69 multiplayer server (PvP combat-core + world bounds) to the live Worker.
- P1 (Claude, after review): expand Option 3 catalog — remaining wardrobe items/hairstyles, NPC outfits on O3, shiba/rottweiler atlases, more props, more kit guns; quality pass on faces/hands.
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
