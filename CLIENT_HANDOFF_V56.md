# v0.56 premium pixel finishing — review build

Branch: `codex/premium-art-v56`, stacked on verified v0.55 `e56a813429f5d2f2b33ef05cafc73bfbfe920c15`.

## Claude synchronization and ownership

Imported the 79 RPG scripts listed in Claude's current online build from **rpg-play a01a9ff265c51eba59912fec998647eb68e8bf98**, plus its `prop-art.js`, `detailed-art.js` integration delta, `ART_SPEC.md`, `RPG_HANDOFF.md`, and four art tests. Corresponding rpg-core head: **b34c95c91660bb158ed1aba62ac6c19a994bebca**. Existing art-pass head: **fdc3c36d65b07ffd4c233a357e3152a08fd43a9f**. Imported gameplay/art modules retain Claude's exact contents; this does not merge either branch. Coordination remains on PR #3.

Claude owns wardrobe-data/character-art/studio, weapon-art, carstyle-data/carstyle/cars, pet-art/prop-art and RPG gameplay. Codex added finishing adapters in separate files and owns client wiring/tests/docs. Do not replace these modules with a competing appearance save or renderer. Crew/follower/gang expansion stays deferred until multiplayer.

## Implemented and verified increment

- `premium-art-renderer.js` composes Claude's actual modular wardrobe/anatomy at 176×224 pixels for a 44×56 world cell. Fine seams, appropriate zippers/buttons, cargo pockets, quilting, limb folds, hair highlights, laces and soles follow the moving geometry. Pullover hoodies, open jackets, bare arms and slides retain their own construction.
- Binary alpha, restrained color quantization and one native-pixel contours remove soft edges and thick magnified borders. Eight directions × eight walking steps now produce 64 distinct rendered frames for the tested street outfit. Gameplay, NPCs and studio use the same frame function. Existing weapon equip animation/attachment wrapper is retained by script order.
- A 128-frame / 24 MiB LRU limits the new character frame cache. This is a bound on this cache, **not total tab memory**; Claude's UI thumbnails and other caches also retain canvases. Inspection close-up source dimensions remain compatible with Claude's crop calculations.
- `premium-vehicle-renderer.js` finishes the existing customized car buffers and disables smooth sampling for those buffers in the city and inspection. Paint, rims, glass, parts, handling and ownership remain Claude's authoritative systems. No alternate fake studio car.
- `inspection-studio.js` exposes the existing character/weapon/owned-car studios; it does not maintain a new economy or appearance save. CSS adds touch targets and fixes the character footer on short phones while keeping a visible preview.
- Backups now include `nightshift-wardrobe-v1` and `nightshift-carstyle-v1`; v0.55 saves remain in place. All current Claude weapons, collectible cars, 11 pets and 11 props are integrated.

## Assets and reproduction

`docs/art/street-{idle,walk,run,crouch,sneak,sit}.png` are transparent native atlases exported directly from the shared gameplay frame function, with 288 frames and `street-atlas.json` coordinates, timing, anchors, facing, outfit and layer references. They are interchange/export assets; the playable client generates and caches these same frames at runtime. This is Canvas frame caching, not GPU atlas batching. Additional transparent PNG/JSON family atlases export 20 weapons, 88 pet poses, 11 props and 11 vehicle configurations through `scripts/export-world-atlases.cjs`; a real pixel comparison confirms that representative vehicle parts change the shared car buffer. Pet directions are explicitly recorded as horizontal/mirrored, rather than claiming eight-direction art.

`scripts/verify-premium-browser.cjs` exports the current character sheet, before/after comparison and weapon/pet/prop inspection sheet, then exercises the real studios in Edge. Run a server at port 8080; set NODE_PATH to a Playwright installation if using the bundled desktop runtime; run `node scripts/verify-premium-browser.cjs`. Set NIGHTSHIFT_TEST_URL for another local URL. It uses an isolated browser context and never changes the owner's game saves.

## Validation

- `npm test`: **111 suites plus module syntax checks passed**. Four imported Claude art suites cover wardrobe ownership, compatible attachments, car styling charges/cleaning and bounded pet/prop frames. Updated old atlas tests verify the active shared renderer rather than the retired v0.55 sprite atlas. Canvas/DOM test doubles gained lastChild, cancelAnimationFrame and createImageData support.
- Final art adjustments: repeated targeted shared-frame and visual-foundation suites passed.
- `npm run build`: **149 playable assets** packaged.
- Real Edge at 390×844, DPR 2: city, all three studios, directional rotation, walking preview, zoom, locked-item preview isolation, owned-item wear, outfit save through the UI and persistence through reload; **zero page errors**.
- Studio layout at 320×568: character canvas 112.6 CSS px high, footer bottom 558 within viewport. At 844×390: canvas 236.8 px high, footer 374.4 within viewport. No horizontal overflow in either layout.
- Latest measured character cache: cold 64 frames **433.2 ms total**; warm 4,096 lookups **38.8 ms total / 9.47 µs each**; 64 warm frames retain 10,092,544 pixel bytes. Cold generation can cause visible stalls with new outfits and needs further profiling/prewarming.
- A 120-frame warm city sample: median **16.7 ms**, p95 **16.9 ms**. Repeated runs had p95 up to **33.3 ms**. Headless Edge on this Windows computer is not a physical iPhone benchmark and does not establish sustained 60 FPS on iOS.

## Roadmap and known gaps

This is a playable integrated finishing increment, **not completion of the entire master overhaul**. The character vertical slice and existing inspection UI are verified above. Claude's weapon/car customization and pets/props are integrated and regression-tested; the additional requested expansion remains open:

- Pets currently have four walk, two idle and two sit poses with horizontal facing. They do **not** yet have eight authored directions, sleep and all requested reactions.
- Characters have idle/walk/run/crouch/sneak/sit plus runtime turning/equip/car transitions. Sprint, interaction and equipment-use states are not all separately authored animation sets. Socks/base garments and every accessory are not independent slots.
- Weapons currently use the existing supported attachment set and side sprites; the requested comprehensive independent part categories and multiple authored inspection angles remain incomplete.
- Cars currently use detailed top-down buffers rotated for directional preview, not a full authored side/front/rear sheet. Extra body-part categories need new authored assets before menus can advertise them.
- Street props have distinct materials and existing illumination, but every requested worn/damaged/night/interactive variant is not authored. Building depth and street detail carry forward from v0.55; a full district-by-district art expansion is still pending.
- Physical iPhone Safari/touch/audio testing, sustained crowded-scene memory profiling and cold-cache stall reduction remain priorities.

No merge, production deployment, Sites publication or public-access setting was changed in this pass. The owner-private hosted preview still contains v0.55. This v0.56 demo runs locally at `http://127.0.0.1:8080/?notour`.
