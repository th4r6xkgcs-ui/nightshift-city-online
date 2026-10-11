# Private preview deployment

URL: https://nightshift-city-online.nzs4gc8qmw.chatgpt.site
Audience: owner-private. User authorized deployment on 2026-10-10; preserve this audience and site identity for updates.
Site project ID: appgprj_6acae562cbe88191a6e89b070ba3e147
Deployed game: v0.15 from GitHub source commit c18aa3cfe7e9cebaad01f61980a60e3b9f005817.
Sites source commit: 297ec58f42cdb83c369ffa83b39afeb3bd4b88ea
Saved version: appgprj_6acae562cbe88191a6e89b070ba3e147~appgver_086fa8be61808191b8a3ac7ab1e86977
Deployment ID: appgdep_6acaf16142608191aa9fe16d9f899ddc
Native deployment result: succeeded at 2026-10-11T02:16:08.887624+00:00. All 33 local suites and GitHub CI pass. Packaged archive verified to contain 30 source-identical playable assets and the helper-generated hosting manifest, excluding docs/tests. Actual iPhone touch/audio/HUD QA remains pending. This is still a local single-player simulation, not live multiplayer.

## Source/update procedure
GitHub is the canonical collaborative codebase. Hosting checkout: /workspace/sites/nightshift-city-online, with tracked .openai/hosting.json declaring the project ID and static directory dist. Hosting uses a separate Sites-managed source mirror. Never create another site for this game.
Read the Sites skill. Retrieve this exact project's source credential and use its source helper to open the hosting checkout. Apply reviewed GitHub client changes; run npm run build in the hosting checkout to create dist from index.html script references (excludes tests, docs and credentials). Run npm run check against canonical source. Use site-workflow.mjs to synchronize/package the exact source, then publish owner-private using its returned commit/archive. Do not copy any Nightshift Garage identity or credentials.

## Play/testing
Open the URL with the owning ChatGPT account. Landscape is recommended. MORE exposes jobs/home/inventory/vehicle/sound actions; SOUND is opt-in. Saves are browser-local and will differ from previous local-file or localhost sessions. Please verify dual-touch aiming/movement, vehicle entry, sound, apartment access and inventory transfers on a real iPhone before claiming mobile QA complete.
