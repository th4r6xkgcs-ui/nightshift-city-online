# Client v0.50 — Crew System

Base: combined v0.49 46f429a73040ad5b693952b531c515781ffd4b99. Separate Codex branch, no main/Claude merges. Latest Claude rpg-core remains 472505c; no RPG/backend internals edited.

MORE → STREET or TALK to Mara/Inez. Gang members recruit Nico/Rae in Southside and Ash/Jules at the harbor for $150 each with 10 local trust. NPC gangs recruit only in their own neighborhood; custom gangs can mix recruits. Maximum 3 members. Name/trait labels are flavor; loyalty governs following and job eligibility. Roster orders are Follow/Hold/Dismiss. Local contact support costs $50 for +10 loyalty, capped at 100. Recruitment fees are nonrefundable.

Followers physically navigate buildings, avoid stopped vehicles and yield to moving traffic. Foot placement uses navigation clearance, avoiding invalid starts near facade walls. They keep personal space and follow formation; blocked formations try safe nearby alternatives. Followers hold while player drives or dies; loyalty below 40 stops following. These are passive companions, not armed combatants. Scene depth includes their sprites, names and loyalty bars.

Two escort routes: Southside → clinic ($180), Harbor → supply waypoint ($220). Requires a local following member with loyalty 40+. Player and physical escort must arrive, on foot, heat below 2, within 120 seconds. Minimum 10 seconds prevents instant handoffs. Completion pays once, +8 loyalty and +4 existing local trust. Cancellation/expiry loses 5 loyalty; 180-second cooldown remains. Active escorts cannot be dismissed. HUD shows countdown and STREET can restore route tracking after reload.

nightshift-city-crew-ops-v1 stores bounded roster, loyalty, orders, safe positions, active job/deadline, cooldown and completed count. Included in backups. Autosave/pagehide capture positions. Reloaded expired jobs apply the penalty once and immediately persist cleared job. Gang switching clears roster, job and old route. Existing crew reputation, wallet and inventory remain authoritative.

Touched: crew-ops.js, gang-life.js, game.js, interactions.js, scene-renderer.js, index.html, backups.js, package.json, tests/crew-ops.cjs, tests/crew-soak.cjs, tests/crew-escort.cjs, tests/render.cjs, tests/run.cjs and this handoff.

Validation: npm run check (81 suites plus syntax); npm run build (72 playable assets); git diff --check; portrait daytime and landscape night follower Canvas renders. Crew regression checks costs/limits, hold/follow, dismissal protection, escort distance/payout-once/loyalty, cooldown, switch cleanup, persistence, expired-job penalty once, safe position restore and invalid timestep. Ten simulated minutes checks safe arrival, stable roster/loyalty/save size and driving hold. An end-to-end city escort physically follows from recruiter to clinic, completes through contextual USE and pays once. Soak exposed/fixed parked-car routing and spawn-clearance failures.

Limits: local single-player, no server authority or multiplayer; recruits are passive/invulnerable and have no combat AI. No rival warfare, autonomous recruit jobs, payroll or vehicle seating in this increment. Physical iPhone and real DOM/audio QA pending; Canvas renders do not validate dialogue layout or touch.
