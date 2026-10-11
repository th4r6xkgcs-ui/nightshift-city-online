# Client v0.49 — Street Life

Base: combined v0.48 0cbae5845c90e4954b674dc8e1a57dd6fca790c5. Separate codex/street-life-v49 branch; no merge into main or Claude branches. Claude RPG/backend modules unchanged.

User chose BOTH NPC gang membership and custom gang founding. Mara (Southside, 720/1080) and Inez (Harbor, 1600/1420) offer contextual dialogue. Join their NPC gang with nonnegative local trust, or name/found your own for $500. Leave and switch paths; leaving releases corner claims. Returning to a previously founded custom gang is free and retains its name. Custom names are bounded to 3–24 ASCII letters/numbers/spaces/_/- and rendered with textContent.

Neighborhood repair work consumes 2 carried scrap for +8 EXISTING crew reputation, once per contact per minute. Courier deliveries/aid still raise that same reputation. Secure one authored corner per district for $250 at 20 local trust. NPC gangs claim only their own district; custom gangs can claim both. This is local corner influence, not full district capture, recruitment, passive income or simulated gang warfare.

Sol (488/1020) and Vee (1808/1360) offer buy/sell dialogue. Every trade uses existing BusinessRules.transact, market inventory/demand, carried inventory, heat and business ledger. Hostile crew market access applies. No competing item or economy store. Phase v0.50 followers/loyalty/rival jobs remain future work.

Entry: MORE → STREET shows contact directions; navigate to a contact and press TALK. Dialogues pause gameplay, release held controls and capture keyboard events so typing names cannot trigger city shortcuts. Escape/Close exits. Portrait/landscape panel bounds, scrolling, 46px buttons and safe-area spacing are included. Each action rechecks alive/on foot/proximity/line of sight/menu availability. Gang actions require heat below 2; trades use existing police pressure rules.

Persistence: nightshift-city-gang-life-v1 stores membership/name/corner flags/bounded work cooldowns; included in backups, persisted per successful action and pagehide. Existing crew, wallet, business and inventory saves remain authoritative for those systems.

Touched: gang-life.js/gang-life.css, interactions.js, game.js, index.html, rpg-integration.js, backups.js, package.json, tests/gang-life.cjs, tests/run.cjs, this handoff. No changes to crews.js/business-rules.js or Claude-owned RPG internals.

Validation: npm run check (78 suites plus syntax), npm run build (71 playable assets), git diff --check; portrait night Docks Canvas render. New regression verifies both membership paths, transition/rejoin, name validation, custom two-district claims, cost/trust/cooldown gates, repeated-action rejection, failure state isolation, HTML contextual TALK, gameplay modal guards, persistent reload, shared market transaction/ledger/heat, hostile refusal, distant refusal and backup key.

Limits: single-player local saved state; no server authority, multiplayer, recruitment, persistent NPC relationships or rival retaliation yet. Canvas QA does not verify HTML layout or physical iPhone touch/audio; those remain pending.
