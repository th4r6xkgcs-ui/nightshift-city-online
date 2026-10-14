// Option 3 atlas exporter (Claude tooling): node tools/o3-export.cjs [outDir=art/o3]
// Writes real transparent RGBA PNG atlases + sidecar JSON (SPRITE_ATLAS_CONTRACT.md) from the same renderer the game
// uses (o3-character.js), so atlas pixels == in-game pixels (tests/o3.cjs checks this byte-for-byte).
//  - one atlas per wardrobe item (+ base body, hairstyles), every layer pass of every frame that has pixels;
//  - one composite atlas for the golden-sample outfit;
//  - directions in contract order S,SW,W,NW,N,NE,E,SE; animations idle (6), walk (12), run (10);
//  - frames are full 96x128 cells so every layer shares the feet origin (48,118).
'use strict';
const fs = require('node:fs'), path = require('node:path');
const PNG = require('./png.cjs'); const E = require('../o3-engine.js'); const C = require('../o3-character.js'); const W = require('../wardrobe-data.js');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'art', 'o3'));
const DIR_NAMES = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'], DIR_INDEX = { S: 2, SW: 3, W: 4, NW: 5, N: 6, NE: 7, E: 0, SE: 1 };
const ANIMS = ['idle', 'walk', 'run'], DUR = { idle: 250, walk: 90, run: 70 }, Z = { far: -1, main: 0, near: 1 };
const GOLDEN = W.cleanOutfit({ skin: 3, build: 'regular', hair: 'short', hairColor: 0, head: { id: 'cap', color: 8 }, face: { id: 'shades', color: 0 }, top: { id: 'tee', color: 7 }, outer: { id: 'puffer2', color: 0, open: true }, bottom: { id: 'cargo', color: 5 }, shoes: { id: 'courts', color: 0 }, jewelry: { id: 'chain', color: 0 }, wrist: { id: 'sportwatch', color: 0 } });
// asset_id → which outfit renders it and which layer(s) belong to it (backlog ids from 04_DATA/asset_backlog.csv)
const NOHAT = { ...GOLDEN, head: null };
const ASSETS = [
  { id: 'character_base_body', file: 'char_base_a', outfit: GOLDEN, layers: ['body', 'hands'] },
  { id: 'character_hair_short', file: 'hair_short', outfit: { ...NOHAT, hair: 'short' }, layers: ['hair', 'hairback'] },
  { id: 'character_hair_braids', file: 'hair_braids', outfit: { ...NOHAT, hair: 'braids' }, layers: ['hair', 'hairback'] },
  { id: 'character_hair_fade', file: 'hair_fade', outfit: { ...NOHAT, hair: 'fade' }, layers: ['hair', 'hairback'] },
  { id: 'character_cap_black', file: 'wear_head_cap_black', outfit: GOLDEN, layers: ['head'] },
  { id: 'character_facewear_sunglasses', file: 'wear_face_shades', outfit: GOLDEN, layers: ['face'] },
  { id: 'character_tee_white', file: 'wear_top_tee_white', outfit: GOLDEN, layers: ['top'] },
  { id: 'character_hoodie_black', file: 'wear_outerwear_hoodie_black', outfit: { ...GOLDEN, outer: { id: 'hoodie', color: 8, hood: false } }, layers: ['outer'] },
  { id: 'character_jacket_orange_black', file: 'wear_outerwear_orange_puffer', outfit: GOLDEN, layers: ['outer'] },
  { id: 'character_jacket_purple', file: 'wear_outerwear_track_purple', outfit: { ...GOLDEN, outer: { id: 'track', color: 9, open: true } }, layers: ['outer'] },
  { id: 'character_cargo_pants_black', file: 'wear_bottom_cargo_black', outfit: GOLDEN, layers: ['bottom'] },
  { id: 'character_jeans_blue', file: 'wear_bottom_jeans_blue', outfit: { ...GOLDEN, bottom: { id: 'jeans', color: 0 } }, layers: ['bottom'] },
  { id: 'character_sneakers_red_white', file: 'wear_shoes_courts_red_white', outfit: GOLDEN, layers: ['shoes'] },
  { id: 'character_boots_black', file: 'wear_shoes_boots_black', outfit: { ...GOLDEN, shoes: { id: 'boots', color: 1 } }, layers: ['shoes'] },
  { id: 'character_backpack_black', file: 'wear_back_backpack_black', outfit: { ...GOLDEN, bag: { id: 'backpack', color: 9 } }, layers: ['bag'] },
  { id: 'character_necklace_gold', file: 'wear_neck_chain_gold', outfit: GOLDEN, layers: ['jewelry'] },
  { id: 'character_watch_black', file: 'wear_wrist_watch_black', outfit: GOLDEN, layers: ['wrist'] },
];
const COLS = 16;
function frameList() { const out = []; for (const a of ANIMS) for (const dn of DIR_NAMES) for (let f = 0; f < C.ANIMS[a]; f++) out.push({ a, dn, d: DIR_INDEX[dn], f }); return out; }
const hasPixels = (b) => { for (let i = 0; i < b.length; i++) if (b[i]) return true; return false; };
function writeAtlas(file, assetId, cells, meta = {}) {
  const rows = Math.ceil(cells.length / COLS), w = COLS * E.FW, h = Math.max(1, rows) * E.FH, img = new Uint8ClampedArray(w * h * 4), frames = [];
  cells.forEach((cell, i) => {
    const x = (i % COLS) * E.FW, y = Math.floor(i / COLS) * E.FH; PNG.blit(img, w, E.toRGBA(cell.buf), E.FW, E.FH, x, y, 1);
    frames.push({ asset_id: assetId, atlas: file + '.png', rect: { x, y, w: E.FW, h: E.FH }, direction: cell.dn, animation: cell.a, frame_index: cell.f, duration_ms: DUR[cell.a], origin: { x: E.OX, y: E.OY },
      hand_anchor: { x: cell.anchors.hand_r[0], y: cell.anchors.hand_r[1] }, equipment_anchors: { hand_r: cell.anchors.hand_r, hand_l: cell.anchors.hand_l, head: cell.anchors.head, back: cell.anchors.back, chest: cell.anchors.chest },
      collision_bounds: { x: 35, y: 110, w: 26, h: 12 }, layer: cell.layer, z_bias: cell.z, tags: cell.tags || [] });
  });
  fs.writeFileSync(path.join(OUT, file + '.png'), PNG.encode(img, w, h));
  const json = { schema_version: '1.0.0', asset_id: assetId, atlas: file + '.png', native_frame_size: { w: E.FW, h: E.FH }, world_px_per_art_px: 0.5, frame_order: DIR_NAMES, layer_order: C.LAYERS, passes: C.PASSES, generator: 'o3-character.js (deterministic programmatic pixel pipeline)', production_ready: true, ...meta, frames };
  fs.writeFileSync(path.join(OUT, file + '.json'), JSON.stringify(json).replace(/\},\{"asset_id"/g, '},\n{"asset_id"')); return { file, frames: frames.length, size: [w, h] };
}
function run() {
  fs.mkdirSync(OUT, { recursive: true }); const report = [], cache = new Map();
  const renderOf = (o, x) => { const k = JSON.stringify(o) + x.d + x.a + x.f; let r = cache.get(k); if (!r) { r = C.render(o, x.d, x.a, x.f); cache.set(k, r); if (cache.size > 400) cache.delete(cache.keys().next().value); } return r; };
  for (const A of ASSETS) {
    const cells = [];
    for (const x of frameList()) { const r = renderOf(A.outfit, x); for (const pass of C.PASSES) for (const L of A.layers) { const b = r.layers.get(L + ':' + pass); if (b && hasPixels(b)) cells.push({ ...x, buf: b, layer: L + ':' + pass, z: Z[pass], anchors: r.anchors }); } }
    const item = A.outfit[{ head: 'head', face: 'face', top: 'top', outer: 'outer', bottom: 'bottom', shoes: 'shoes', bag: 'bag', jewelry: 'jewelry', wrist: 'wrist' }[A.layers[0]]]?.id || null;
    for (const an of ANIMS) report.push(writeAtlas(A.file + '_' + an, A.id, cells.filter((c) => c.a === an), { wardrobe_item: item, animation: an }));
  }
  // composite golden sample (what the game shows)
  const comp = frameList().map((x) => { const r = renderOf(GOLDEN, x); return { ...x, buf: r.composite, layer: 'composite', z: 0, anchors: r.anchors, tags: ['golden_sample'] }; });
  for (const an of ANIMS) report.push(writeAtlas('char_golden_sample_' + an, 'character_golden_sample', comp.filter((c) => c.a === an), { outfit: GOLDEN, animation: an }));
  // pets: husky (golden), 96x96 frames, origin (48, 88); idle 4 / walk 6 / sit 2
  const PET = require('../o3-pet.js'), PDUR = { idle: 200, walk: 110, sit: 500 };
  for (const breed of ['husky']) for (const an of Object.keys(PET.ANIMS)) {
    const cells = []; for (const dn of DIR_NAMES) for (let f = 0; f < PET.ANIMS[an]; f++) { const r = PET.render(breed, DIR_INDEX[dn], an, f); cells.push({ a: an, dn, f, buf: r.composite }); }
    const cols = 8, w = cols * PET.PW, h = Math.ceil(cells.length / cols) * PET.PH, img = new Uint8ClampedArray(w * h * 4), frames = [];
    cells.forEach((cl, i) => { const x = (i % cols) * PET.PW, y = Math.floor(i / cols) * PET.PH; PNG.blit(img, w, E.toRGBA(cl.buf, PET.PW, PET.PH), PET.PW, PET.PH, x, y, 1); frames.push({ asset_id: 'pet_' + breed, atlas: `pet_${breed}_${an}.png`, rect: { x, y, w: PET.PW, h: PET.PH }, direction: cl.dn, animation: an, frame_index: cl.f, duration_ms: PDUR[an], origin: { x: PET.POX, y: PET.POY }, hand_anchor: null, equipment_anchors: {}, collision_bounds: { x: 30, y: 80, w: 36, h: 12 }, layer: 'composite', z_bias: 0, tags: ['pet', breed] }); });
    fs.writeFileSync(path.join(OUT, `pet_${breed}_${an}.png`), PNG.encode(img, w, h));
    fs.writeFileSync(path.join(OUT, `pet_${breed}_${an}.json`), JSON.stringify({ schema_version: '1.0.0', asset_id: 'pet_' + breed, atlas: `pet_${breed}_${an}.png`, native_frame_size: { w: PET.PW, h: PET.PH }, world_px_per_art_px: 0.5, frame_order: DIR_NAMES, frame_counts: { [an]: PET.ANIMS[an] }, animation: an, generator: 'o3-pet.js', production_ready: true, frames }));
    report.push({ file: `pet_${breed}_${an}`, frames: frames.length, size: [w, h] });
  }
  // props: day + night variants, single facing (S), origin bottom-centre (48, 118)
  const PR = require('../o3-props.js');
  for (const kind of PR.KINDS) {
    const w = E.FW * 2, h = E.FH, img = new Uint8ClampedArray(w * h * 4), frames = [];
    ['day', 'night'].forEach((st, i) => { const r = PR.render(kind, st === 'night'); PNG.blit(img, w, E.toRGBA(r.composite), E.FW, E.FH, i * E.FW, 0, 1); frames.push({ asset_id: 'prop_' + kind, atlas: `prop_${kind}_daynight.png`, rect: { x: i * E.FW, y: 0, w: E.FW, h: E.FH }, direction: 'S', animation: st, frame_index: 0, duration_ms: 0, origin: { x: E.OX, y: E.OY }, hand_anchor: null, equipment_anchors: {}, collision_bounds: { x: 30, y: 106, w: 36, h: 14 }, layer: 'base', z_bias: 0, tags: ['prop', st], light: r.emissive }); });
    fs.writeFileSync(path.join(OUT, `prop_${kind}_daynight.png`), PNG.encode(img, w, h));
    fs.writeFileSync(path.join(OUT, `prop_${kind}_daynight.json`), JSON.stringify({ schema_version: '1.0.0', asset_id: 'prop_' + kind, atlas: `prop_${kind}_daynight.png`, native_frame_size: { w: E.FW, h: E.FH }, world_px_per_art_px: 0.5, frame_order: DIR_NAMES, frame_counts: {}, states: ['day', 'night'], generator: 'o3-props.js', production_ready: true, frames }));
    report.push({ file: `prop_${kind}_daynight`, frames: 2, size: [w, h] });
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ generated_by: 'tools/o3-export.cjs', atlases: report }, null, 1));
  return report;
}
if (require.main === module) { const r = run(); for (const a of r) console.log(a.file.padEnd(36), String(a.frames).padStart(4), 'frames', a.size.join('x')); }
module.exports = { run, ASSETS, GOLDEN, DIR_NAMES, DIR_INDEX, frameList };
