# RPG systems handoff (Claude-owned)

Branch: `claude/rpg-core` (based on Codex v0.38 `codex/mockup-art-v38` @ c770e96).
Owner direction: single-player RPG grind first; multiplayer later, so keep it in mind.

## Files (Claude-owned, new)
| File | What |
|---|---|
| `skills-data.js` | Catalog and balance: 9 skills, perk keys, XP curve, XP awards |
| `skills.js` | Engine: XP from observed play, level-ups, ⭐ SKILLS chip and panel (K key). Save key `nightshift-skills-v1` |
| `goals-data.js` | 28 goals in tiers Start, Hustle, Rising, Kingpin and Legend, with cash and skill-XP rewards |
| `goals.js` | Engine: 🎯 NEXT GOAL card under the skills chip, goals panel (G key), completion banner. Save key `nightshift-goals-v1` |
| `tests/skills.cjs`, `tests/goals.cjs` | Node tests (5 + 4 PASS) |

Neither module edits game files. They read script globals (`player`, `cars`, `say`, `releaseControls`, `save`) and module state (`NightshiftProgress.state`, `NightshiftBusinesses.state`, `NightshiftActivities.ownsHome()`).

## Wiring (needs Codex OK, because index.html is Codex-owned)
Insert before `boot.js`:
```html
<script src="skills-data.js" defer></script><script src="skills.js" defer></script><script src="goals-data.js" defer></script><script src="goals.js" defer></script>
```
Add `nightshift-skills-v1` and `nightshift-goals-v1` to the `KEYS` list in `backups.js`.

## Contract for Codex
- Multiply gameplay values by `globalThis.NightshiftSkills?.mod(key) ?? 1`. The keys are listed in `skills-data.js`.
- Optional: call `NightshiftSkills.gain(skill, xp, reason)` for new content such as casino, farms or weapons. Add buttons for `NightshiftSkills.open()` and `NightshiftGoals.open()`.

## Verified (scratch copy of v0.38 with the 4 script lines injected, Playwright Chromium)
- 844×390 and 390×844 (iPhone 13 emulation): the goal card sits below the skills chip and is the topmost element. Hints are hidden at heights of 430px or less.
- Walking about 850px completes "Hit the streets" for +$25. 8 shots complete "Test your piece". Cash gains are counted as earnings, excluding goal payouts. Goals and stats persist across a reload. There were no page errors.
- Not verified: real iPhone touch, and the long-term balance of the reward pacing.

## Known limits
- Goal completion is capped at one per second, so veteran saves catch up gradually and get every reward once.
- `earned` ignores single jumps over $250k (backup restores).
- The panels don't pause the game.

## Playable build: `claude/rpg-play`
`claude/online-play` (server + online layer) merged with `claude/rpg-core` (Codex v0.38 + skills/goals); the merge was clean.
`online/build-online.cjs` now injects the 4 RPG scripts before `boot.js` at build time (`withRpg`), so Codex's index.html is untouched. Any script it already lists is skipped.
Both `/` (online) and `/solo` in the Worker bundle include the RPG layer.
Checks on this branch:
- `node tests/run.cjs`: 61 suites PASS
- skills: 5 PASS; goals: 4 PASS
- server: 104 pass, 0 fail
- Playwright with two players (desktop and iPhone 844×390), local server: both online, movement synced, chat works, goal card and skills chip show, no page errors
Deploy: point Cloudflare Workers Builds at branch `claude/rpg-play`, root `worker`, deploy command `npx wrangler deploy`. Not deployed by Claude.
## Backlog: owner said "add later, don't forget" (2026-10-11)
- **Daily/weekly challenges**: 3 rotating daily jobs (e.g. "sell 10 units", "lose the cops twice") plus weekly ones, and a login-streak bonus.
- **Respect prestige rank**: a long-term rank on top of skills, for endgame grinding.

## Skill effects: `skill-effects.js` (Claude-owned)
Skill levels now change real gameplay by wrapping public module functions. No game file is edited.
**Codex: do NOT add `mod()` calls at your call sites**, because they would double-apply. If you change one of these functions or rename a hook, tell me in PR #3.

| Skill | Effect | Hook |
|---|---|---|
| Shooting | +2%/lv bullet damage (up to about 2×) | `NightshiftCrews.incident(target,'violence')`, `NightshiftCrime.strike` |
| Shooting | reload time down to 0.6× | `NightshiftCombat.begin` |
| Speed | run speed up to 1.3×, sprint stamina up to 1.75× | `NightshiftMovement.step` |
| Driving | top speed/accel up to 1.3×, steering up to 1.4×, crash damage down to 0.5× | `NightshiftVehicles.handling` / `.damage` (player car only) |
| Luck | up to 50% chance per salvage of a $30–100 (×value) cash find | `NightshiftProgress.award('salvage')` |
| Farming | grow time down to 0.5×, harvest yield up to 1.75× | `NightshiftBusinessRules.transact('start')` / `.advance` |
| Dealing | sale and rush-order pay up to 1.6×, heat per deal down to 0.5× | `NightshiftBusinessRules.transact` |
| Toughness | damage taken down to 0.7×, regen up to 1.5 HP/s after 8s without damage | `NightshiftRecovery.damage`, observer |
| Stealth | heat gained down to 0.5×, heat cooldown up to 2× | observer on `player.heat` |
| Charisma | business buy prices down to 0.7×, delivery pay up to 1.75× | `transact` buy/purchase/upgrade/start, `award('delivery')` |

Verified in browser (level 1 vs maxed): all 10 wrappers install. Level 1 values are identical to the original game. At max:
- walk speed 3 → 3.88
- reload 1300 → 790 ms
- selling 2 weed: $70 → $111, heat 0.4 → 0.10
- buying 2 weed: $90 → $64
- grow time 120 s → 61 s
- harvest 3 → 6
- ped HP after one hit 80 → 60.4 (game -20 included)
- crash damage −20 → −10
- 30 damage → 21
- heat +2 → +1
- $200 delivery → $347
- no page errors

Unit tests: tests/skill-effects.cjs, 2 PASS.

## Lucky 7 Casino: `casino-data.js` + `casino.js` (Claude-owned world feature)
- Location: the east CLUB (1840,1095), whose door is at (1960,1277). Codex's art already labels it CASINO, so I only add a sidewalk "LUCKY 7" marquee and a red carpet. It is reached with USE (action label CASINO) through wrapped `NightshiftEncounters.locations/use/draw`, so it also appears wherever encounter locations are listed (city map).
- Slots: 3 weighted reels. They return 89.6% at Luck 1 and at most 96.8% at max Luck (`luck.casino` perk on slot wins, capped at 1.08), so the house always keeps an edge and grinding can't be farmed for infinite money.
- Roulette: European wheel (97.3%), with red/black/odd/even/1–18/19–36 at 2× and single numbers at 36×. Luck has no effect.
- Bets are $10–$1,000, and each spin takes the bet and pays the win in a single step. Each bet gives Luck XP (bet/25, between 1 and 40). Security refuses entry while heat ≥ 1. The keyboard is captured while the panel is open, and Escape leaves.
- New goals: "Feeling lucky" (win one bet) and "High roller" (wager $25k). Save key: `nightshift-casino-v1`. Codex: please add it to backups.js KEYS.
- Also new: Shooting gets +5 XP for each bullet that lands (`skill-effects.js` hit hooks).
- Tests: tests/casino.cjs, 4 PASS (exact RTP enumeration, payouts, validation).
- Browser check on iPhone 13 landscape: USE shows CASINO at the door. Spins settle cash exactly. Roulette paid its win. The player didn't move while the panel was open. Escape closes the panel, entry is refused while wanted, and state persists. No page errors. Online two-player regression: OK.
