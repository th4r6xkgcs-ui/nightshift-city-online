# Private preview deployment

URL: https://nightshift-city-online.nzs4gc8qmw.chatgpt.site
Audience: owner-private. User authorized deployment on 2026-10-10; preserve this audience and site identity for updates.
Site project ID: appgprj_6acae562cbe88191a6e89b070ba3e147
Deployed game: v0.14 from GitHub source commit fe2a2898ad85cee8e3da98b23c9303c49e8984ea.
Sites source commit: 8c98cfb8190870fadfa6c3fe073e99dc960eea62
Saved version: appgprj_6acae562cbe88191a6e89b070ba3e147~appgver_4e4464842be88191be9a6d24db442801
Deployment ID: appgdep_6acaec83a8e88191868d660022c6e60d
Native deployment result: succeeded at 2026-10-11T01:55:24.618096+00:00. All 19 local suites and GitHub CI pass, including full-storage rollback. Actual iPhone touch/audio/HUD QA remains pending. This is still a local single-player simulation, not live multiplayer.

## Source/update procedure
GitHub is the canonical collaborative codebase. Hosting checkout: /workspace/sites/nightshift-city-online, with tracked .openai/hosting.json declaring the project ID and static directory dist. Hosting uses a separate Sites-managed source mirror. Never create another site for this game.
Read the Sites skill. Retrieve this exact project's source credential and use its source helper to open the hosting checkout. Apply reviewed GitHub client changes; run npm run build in the hosting checkout to create dist from index.html script references (excludes tests, docs and credentials). Run npm run check against canonical source. Use site-workflow.mjs to synchronize/package the exact source, then publish owner-private using its returned commit/archive. Do not copy any Nightshift Garage identity or credentials.

## Play/testing
Open the URL with the owning ChatGPT account. Landscape is recommended. MORE exposes jobs/home/inventory/vehicle/sound actions; SOUND is opt-in. Saves are browser-local and will differ from previous local-file or localhost sessions. Please verify dual-touch aiming/movement, vehicle entry, sound, apartment access and inventory transfers on a real iPhone before claiming mobile QA complete.
