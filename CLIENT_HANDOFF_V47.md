# Client v0.47 — Living world foundations

Base: combined Codex v0.46 d1e5633; Claude rpg-play f99eea9 includes that baseline. Separate Codex branch; no main or Claude merges.

Pedestrians have stable transient home-block identities and daily work, shopping, nightlife and home destinations. Rain overrides plans with nearby shelter destinations. Danger reactions take priority, then routing resumes. Initial civilians spawn outside buildings. Routes are staggered and refreshed at most about once per four seconds per civilian. Civilians avoid local traffic as well as parked cars.

Traffic follows sampled rounded corners on existing road loops, yields to officers and pedestrians, and restores its full route index and heading when collision rejection cancels a turn.

Touched: citizen-routines.js, citizen-ai.js, traffic.js, game.js, index.html, package.json, tests/citizen-routines.cjs, tests/run.cjs, this handoff. RPG/backend modules are unchanged.

Validation: npm run check (75 suites and root module syntax), npm run build (66 playable assets), portrait Canvas render. New regression coverage checks schedules, shelter, danger priority/recovery, vehicle avoidance, rounded loop bounds and blocked-turn rollback.

Limitations: destinations are outdoor stops; pedestrians do not enter interiors. Identity and routines are transient. No persistent encounter memory, new police pursuit system or multiplayer backend in this increment. Physical iPhone touch/audio and real DOM QA remain pending.
