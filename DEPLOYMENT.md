# Private preview deployment

URL: https://nightshift-city-online.nzs4gc8qmw.chatgpt.site
Audience: owner-private. User authorized deployment on 2026-10-10; preserve this audience and site identity for updates.
Site project ID: appgprj_6acae562cbe88191a6e89b070ba3e147
Deployed game: v0.13 from GitHub source commit a427d99dc11bf9ed03548d04668b37ecf3674398.
Sites source commit: ec553303adf237334a3b5adda3e9e06d660853d1
Saved version: appgprj_6acae562cbe88191a6e89b070ba3e147~appgver_1984636489bc819190fbad21fcb297f4
Deployment ID: appgdep_6acae582921c8191b645ed4ea66ff601
Native deployment result: succeeded. Actual iPhone touch/audio/HUD QA remains pending. This is still a local single-player simulation, not live multiplayer.

## Source/update procedure
GitHub is the canonical collaborative codebase. Hosting checkout: /workspace/sites/nightshift-city-online, with tracked .openai/hosting.json declaring the project ID and static directory dist. Hosting uses a separate Sites-managed source mirror. Never create another site for this game.
Read the Sites skill. Retrieve this exact project's source credential and use its source helper to open the hosting checkout. Apply reviewed GitHub client changes; copy index.html and root .js modules into dist (exclude tests, docs and credentials from dist). Run npm run check against canonical source. Use site-workflow.mjs to synchronize/package the exact source, then publish owner-private using its returned commit/archive. Do not copy any Nightshift Garage identity or credentials.

## Play/testing
Open the URL with the owning ChatGPT account. Landscape is recommended. MORE exposes jobs/home/inventory/vehicle/sound actions; SOUND is opt-in. Saves are browser-local and will differ from previous local-file or localhost sessions. Please verify dual-touch aiming/movement, vehicle entry, sound, apartment access and inventory transfers on a real iPhone before claiming mobile QA complete.
