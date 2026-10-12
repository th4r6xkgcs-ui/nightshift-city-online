# Nightshift City Online: premium 2.5D pixel art spec (Option 3, v0.56+)

Owner: Claude, which took over art after Codex ran out. The spec matches what ships in `claude/rpg-core` and `claude/rpg-play`. Sheets and screenshots are in `docs/art/`.

## One asset definition, every view
Gameplay, inventory and the inspection studios all draw from the same definition, so a preview always matches the world.

| Asset | Definition | Gameplay | UI / inventory | Inspection |
|---|---|---|---|---|
| Characters | `wardrobe-data.js` items + `character-art.js` layers | `NightshiftSprites.person` wrapper | Studio thumbnails | `studio.js` (`#csStudio`) |
| Weapons | `weapon-art.js` `GUNS` part builders + `attach()` | held gun (`drawHeld`) | `icon()` via `NightshiftSupplyArt.gunIcon` | `#wiPanel` bench |
| Vehicles | `cars.js` `BODY` + `bake(id, color, style)`, options in `carstyle-data.js` | `NightshiftSprites.car` wrapper | MY CARS portraits | `carstyle.js` (`#vsPanel`) |

## Camera and light
- **View:** top-down three-quarter.
  - People and props stand upright; cars are seen from above.
  - Weapons are side-view sprites, rotated to the aim angle.
- **Light:** comes from the top-left.
  - Top and left edges of every form are lit; bottom and right edges are shaded.
  - Highlights are short specular runs on the upper edge.
  - Shadows are soft ellipses under feet and cars, colour `#05080f55`.
- **Outline:** a single ink colour, `#0b0e12` for guns and `#11151c` for people. It runs around the outside of the silhouette only; interior separation comes from bevels.

## Characters
- **Cell:** 44×56 world px, anchor (22, 36).
  - Feet sit at +14, the head centre at −19.5 and the shoulders at −12.5.
  - Collision is unchanged (the game's circle at the anchor).
- **Render scale:** baked at 2× for the game and up to 18× in the studio (it fits the stage).
  - Binary alpha (no half-transparent edges), then an outline pass. The number of passes is `round(scale / 2.5)`.
- **Directions:** 8. Facing index 0 = E, 1 = SE, 2 = S, 3 = SW, 4 = W, 5 = NW, 6 = N, 7 = NE (Codex `pose()` order).
  - Directions are drawn, not mirrored: profile arms, far-cheek shading, and back views show bags and hoods.
- **Animations:**
  - `idle` 4 frames, 380 ms each.
  - `walk` 8 frames, driven by `walkTicks / 2.5`.
  - `run` 8 frames, driven by `walkTicks / 1.8`, with lean.
  - `hold` overlay (`'short'` | `'long'`): arms come up to chest height in front of the body; long guns put the support hand on the handguard. The gun is drawn at `NightshiftCharacters.holdHand(dir, hold)`.
- **Layer order (compose):**
  1. hood/bag behind
  2. far arm (profile)
  3. bottoms
  4. shoes
  5. top
  6. outer
  7. jewelry
  8. bag front
  9. near arms (sleeve by length, cuffs, gloves, watch)
  10. hair behind
  11. head (eyes, brows, nose, mouth, ears, cheek shade)
  12. mask/hood
  13. facial hair
  14. hair
  15. eyewear
  16. headwear
- **Clothing data:** 44 items across 9 slots.
  - Each item has 2–9 colours, a rarity, a price, a description and options: hood up/down, open/closed, tucked, backwards cap, rolled sleeves, pattern.
  - There are 8 skin tones, 10 hair colours, 12 hairstyles, 5 facial hair styles and 3 builds.
- **NPCs:** outfits are deterministic per id from a pool of 24, plus officer and security uniforms.
- **Frame cache:** LRU of 700 frames. A cache miss takes about 0.5 ms; a hit about 0.02 ms (headless Chromium).

## Weapons
- **Grid:** 84×38 px, origin (18, 10), side view with the muzzle to the right. World scale is 0.5 world px per grid px (AR ≈ 30 px, pistol ≈ 13 px).
- **Materials:** 4-tone ramps (dark, base, light, specular): steel, dark, poly, wood, gold, chrome, rust, tape, red, tan, olive, rubber.
  - Parts are filled, then auto-bevelled against their own silhouette.
- **Builders:**
  - `handgun()`: slide, frame, stippled grip, stick mag, sights, ejection port, guard, compensator, hammer, revolver cylinder.
  - `longgun()`: stock types, pistol grip/wrist, curved/straight/box mags, receiver, rails, carry handle, bolt, handguards (rail/wood/pump), tube mag, muzzle brake/flash hider.
  - Crude and legendary guns have their own builders.
- **Anchors (per gun):** `hand`, `muzzle`, `rail`, `under`, `mag`, plus `cyl` (revolver) and `tube` (shotgun).
  - **Attachments:**
    - suppressor: muzzle, with knurl rings; it lengthens the gun
    - scope: a long optic on long guns, a red-dot on handguns
    - extmag: a longer mag with a baseplate; brass speed-loader on the revolver; tube extension on shotguns
    - laser grip: under-barrel module with an emitter, plus a laser line in the world and the inspection view
    - reinforce: steel clamp bands and rivets
  - Built-in parts (Whisper suppressor, DMR/Reaper/Tiger optics) show as "Built in".
- **Paint jobs:** re-tint steel, poly and rust parts; wood and accents keep their colour. Camo is a stable per-pixel pattern.
- **Held gun:**
  - Rotated to the aim angle and flipped vertically when aiming left, so it is never upside down.
  - Drawn behind the body when facing away.
  - Smoothing is used only when the sprite would be smaller than 1.6 device px per grid px.

## Vehicles
- **Bodies:** 13 top-down bodies. The 10 collection models are baked at 4×; city sedan, compact and van at 3×.
- **Baked layers:**
  - paint with form shading and sheen
  - finish: gloss, metallic flake, pearl, satin, matte, mirror chrome
  - livery: stripes, race number, two-tone, flames, checker, in 7 colours
  - hood: scoop, vented, carbon weave
  - glass tint: 4 levels
  - rims: stock, chrome, black, gold mesh, deep-dish, neon lip
  - spoiler: lip, ducktail, street wing, GT wing
  - exhaust tips: twin, quad, centre
- **Live layers:** headlight colour (halogen/xenon/amber/ice), underglow (5 colours, brighter at night), brake lights, wear scuffs.
- **Cache key:** model + paint + `carstyle-data.keyOf(style)`, LRU of 120.

## Mobile
- Studios are full-screen grids.
  - Landscape: stage on the left, catalog on the right.
  - Portrait: stage on top.
  - Compact rules apply at heights of 460 px or less.
- Touch targets are at least 36 px.
- **Gestures:**
  - Characters: swipe to rotate.
  - Cars: drag to rotate.
  - All studios: pinch, wheel or slider to zoom; hold COMPARE to see what's currently worn or fitted.
- The HUD hides while a studio is open (`hud.js` `MINE`/`PANELS` include `#csStudio`, `#wiPanel`, `#vsPanel`).

## Performance (headless Chromium, software GL, 844×390 @2×)
- **Frame rate:** about 31 fps average in the city with the layered characters and about 30 fps with them disabled.
  - The new art adds no measurable frame cost. Real devices with a GPU will run faster.
- **Weapon bake:** about 3 ms per gun+paint+mods variant, then cached.

## Not done (honest list)
- Sitting, crouching and vehicle enter/exit animations: not drawn yet. `ANIMS` has room; add keys in `geom()`.
- Equip and turning transitions: not done; the game snaps to the new direction.
- Character "rotation" in the studio uses the 8 authored directions; there are no in-between angles.
- Pets and street props are still Codex v0.55 `detailed-art.js` and were not redone in this pass.
- Before/after comparison: `docs/art/before-after-characters.png`. Codex's v0.55 people are clean, hand-tuned sprites; the layered system trades a little of that polish for 44 wearable items and per-NPC variety. `NightshiftCharacters.enabled = false` switches back instantly for comparison.
