# Nightshift City Online — Game Vision (from the owner, 2026-10-11)

Read this before planning new work. It is the owner's direction for **both** Codex (ChatGPT) and Claude.

## Direction
- **Now:** a polished **single-player** game the owner enjoys playing and **grinding solo**.
- **Later:** multiplayer, which matters a lot. Keep every system **multiplayer-ready**: plain data catalogs, state that can be serialized, no hidden globals for economy values, and actions that could later be validated by the server. The online server and integration (`claude/online-play`) are parked, not abandoned.
- **Style:** an RPG-like open-world crime/life sim. **"Not cheap and blocky like an old-school arcade game"**: the owner wants a real art pass (Codex owns art).

## What the owner asked for
1. **RPG progression: upgrade lots of things.** Skills that level up with use and visibly change gameplay:
   - **Shooting** (damage, accuracy/spread, reload speed)
   - **Speed / athletics** (run speed, stamina)
   - **Luck** (rare loot, better salvage finds, casino edge, crit chance)
   - **Farming** (yield, grow time, plot count)
   - **Drug sales / dealing** (sale prices, buyer demand, less heat per sale)
   - **Driving** (top speed, handling, braking, crash damage taken)
   - "…and so on." Suggested extras: **Toughness** (max HP, damage taken), **Crafting** (cost, quality), **Charisma** (shop prices, crew trust gain), **Stealth** (heat gain, police search time).
2. **Cool features:**
   - **Farms** (grow plots, upgrades, harvest/sell loop)
   - **Casinos** (games of chance tied to Luck: slots, blackjack, roulette — fictional chips/cash only)
   - **Lots of weapons** (variety with distinct stats, unlocks, upgrades/attachments)
3. **Customization everywhere:**
   - **Player:** outfits, hair, accessories, colors
   - **Homes:** furniture, decor, upgrades, multiple properties
   - **Cars:** paint, wheels, performance upgrades (engine, brakes, handling)
4. **Lots of space:** a much bigger open world, with more districts, varied areas (downtown, docks, farmland or outskirts for farms, a casino strip), interiors, and room to explore. Keep mobile performance in mind: chunked or cached rendering, interest culling.

## Who builds what (proposed; agree or adjust in PR #3)
| Area | Owner |
| --- | --- |
| Art pass, sprites, world rendering, HUD/menu layout, the MORE menu | **Codex** |
| World expansion (bigger map, districts, `city-data.js`) | **Codex** (Claude keeps the server in sync via the drift guard) |
| Farms, casinos, weapons, customization content and their UIs | **Codex** (big client systems), using the skills contract below |
| **Skills / RPG progression engine** (`skills.js`, `skills-data.js`): XP, levels, perks, save, skills panel | **Claude** |
| **Goals / onboarding / milestones** (`goals.js`, `goals-data.js`): first-session tutorial, "NEXT GOAL", rewards | **Claude** |
| Server, online, multiplayer (later) | **Claude** |

Claude's modules are new files. The only shared-file change is one `<script defer>` line in `index.html`, agreed in PR #3 first.

## Skills contract (how skills plug into Codex's systems)
Claude provides `globalThis.NightshiftSkills`:
```js
NightshiftSkills.gain(skill, xp, reason?)   // award XP; Codex calls this at action sites
NightshiftSkills.level(skill)               // 1..50
NightshiftSkills.mod(key)                   // number modifier for a gameplay value
NightshiftSkills.open()                     // show the skills panel (e.g. from MORE → SKILLS)
NightshiftSkills.onLevelUp(fn)              // fn({skill, level}) for toasts, effects
```
Codex multiplies its own values by `mod()` at the point of use, so balancing stays in one data file (`skills-data.js`). The defaults are 1, so everything keeps working if the module isn't loaded:
```js
const mod = (k) => globalThis.NightshiftSkills?.mod(k) ?? 1;
damage *= mod('shooting.damage');      runSpeed *= mod('athletics.speed');
reloadMs *= mod('shooting.reload');    stamina  *= mod('athletics.stamina');
rareChance *= mod('luck.rare');        salePrice *= mod('dealing.price');
growMs *= mod('farming.growTime');     yield    *= mod('farming.yield');
topSpeed *= mod('driving.topSpeed');   steer    *= mod('driving.handling');
maxHp *= mod('toughness.maxHp');       heatGain *= mod('stealth.heat');
```
**XP:** until Codex adds `gain()` calls, Claude's module awards XP by **observing** public game state: shots (magazine count), distance run or driven, deliveries, salvage and crafting counters, business sales. Explicit `gain()` calls at action sites are better and preferred.

**Multiplayer-ready:** skills and goals state is plain JSON (`nightshift-skills-v1`, `nightshift-goals-v1`). The same catalogs can later be validated server-side.

## Principles
- Fun first: short loops that feel rewarding (money, XP, unlocks) and a clear "what next".
- Every upgrade should be **felt** in play, not just shown as a number.
- Keep mobile performance at 60 fps on iPhone.
- Fictional/abstract items only for crime and drug systems: no real-world instructions.
