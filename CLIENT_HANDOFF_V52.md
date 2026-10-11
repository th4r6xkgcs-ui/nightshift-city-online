# Client v0.52 — crew vehicle transport

Base: combined v0.51 15ef72adf054ab589bcfac6b41cff00a3e6812d7. Separate Codex branch; Claude RPG/backend unchanged.

Following members with loyalty 40+ approach a stopped player vehicle and board when within 78px with clear building sight. Compact has 1 passenger seat; sedan/van have 3. Capacity recognizes the actual uppercase vehicle model catalog. Moving vehicles, full seats and Hold orders do not board. Driver death or leaving the car requests disembarkation; failed exit placement retains the attachment until safe space becomes available. Exit spots check world bounds, building clearance, vehicles and people. Members resume their saved foot order after exit.

Passengers are hidden from the outdoor actor scene and tracked by a Crew passengers HUD count. Vehicle references are transient: saves retain each passenger's last safe foot position instead of serializing a vehicle object or restoring a person inside a car. Reload therefore restores passengers on foot at their boarding location. Escort completion explicitly requires disembarkation. Crew members remain passive/invulnerable; no passenger combat or interior seat sprites introduced.

Touched: crew-transport.js, crew-ops.js, game.js, index.html, package.json, tests/crew-transport.cjs, tests/crew-soak.cjs, tests/run.cjs; current shared doc summaries and this handoff.

Validation: npm run check (84 suites and syntax), npm run build (75 playable assets), git diff --check. New coverage: capacity, uppercase catalog, attachment while moving, blocked-exit retry, safe release, speed/order/loyalty gates, hidden sprites, HUD and safe-foot saving. Existing ten simulated minute soak now checks driving hold while the car is moving; stopped vehicles intentionally permit boarding. Existing physical escort and once-only payout tests remain enabled.

Limits: local single-player, no vehicle seating across reloads, seat/body art or companion combat. Physical iPhone and real DOM/audio checks remain pending. Prior recruitment, rival pressure and street-customer economy remain included.
