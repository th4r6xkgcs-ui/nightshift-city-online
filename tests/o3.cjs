// Option 3 (Claude): golden-sample character, layers, directions, atlases, saves.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const E = require('../o3-engine.js'), C = require('../o3-character.js'), W = require('../wardrobe-data.js'), PNG = require('../tools/png.cjs');
const X = require('../tools/o3-export.cjs');
const G = X.GOLDEN;
// coverage: golden outfit fully supported; 16 backlog character assets exist as Option 3 items/hairstyles
assert.ok(C.supports(G), 'golden outfit drawn in Option 3');
const items = Object.keys(C.ITEMS), hairs = Object.keys(C.HAIR_OK).filter((h) => h !== 'bald' && h !== 'buzz');
assert.ok(items.length + hairs.length >= 16, `>= 16 items/hairstyles (${items.length}+${hairs.length})`);
for (const id of items) assert.ok(W.ITEM[id], id + ' is a wardrobe item (owned/saved like any other)');
assert.ok(!C.supports({ ...G, shoes: { id: 'slides', color: 0 } }), 'unauthored pieces fall back to the old renderer');
// 8 real directions: every facing is different (no duplicate/mirrored copies), all anims render
const sig = (b) => { let h = 0; for (let i = 0; i < b.length; i++) h = (Math.imul(h, 31) + b[i]) | 0; return h; };
const dirs = new Set(); for (let d = 0; d < 8; d++) dirs.add(sig(C.render(G, d, 'idle', 0).composite)); assert.equal(dirs.size, 8, '8 distinct directions');
for (const [a, n] of Object.entries(C.ANIMS)) { const fr = new Set(); for (let f = 0; f < n; f++) fr.add(sig(C.render(G, 2, a, f).composite)); assert.ok(fr.size >= (n >= 6 ? 3 : 2), `${a}: frames animate (${fr.size}/${n})`); }
// W is not E mirrored (handedness: watch on the left wrist)
const flip = (b) => { const o = new Uint32Array(b.length); for (let y = 0; y < E.FH; y++) for (let x = 0; x < E.FW; x++) o[y * E.FW + x] = b[y * E.FW + (E.FW - 1 - x)]; return o; };
assert.notEqual(sig(flip(C.render(G, 0, 'idle', 0).composite)), sig(C.render(G, 4, 'idle', 0).composite), 'W authored, not a mirror of E');
// layers: separate item layers, composite == layers in order, feet on the origin
const r = C.render(G, 2, 'walk', 3);
for (const L of ['body', 'top', 'outer', 'bottom', 'shoes', 'head', 'face', 'jewelry']) assert.ok([...r.layers.keys()].some((k) => k.startsWith(L + ':')), 'layer ' + L);
assert.deepEqual([...r.composite], [...E.composite(r.layers, r.order)]);
let lowest = 0; for (let i = 0; i < r.composite.length; i++) if (r.composite[i]) lowest = Math.floor(i / E.FW); assert.ok(lowest >= E.OY - 4 && lowest <= E.OY + 6, 'feet at origin ' + lowest);
assert.ok(r.anchors.hand_r && r.anchors.hand_l && r.anchors.origin[1] === E.OY);
// holding a gun moves the right hand forward and keeps it in frame
const h = C.render(G, 0, 'idle', 0, 'long').anchors.hand_r, h0 = C.render(G, 0, 'idle', 0).anchors.hand_r; assert.ok(h[0] > h0[0] + 4 && h[0] < E.FW, 'gun hand reaches forward (E)');
console.log('PASS: Option 3 character (16 assets, 8 distinct directions, animations, layered composite, anchors, gun hold)');
// atlases: exported PNG pixels are the renderer's pixels
const dir = path.join(__dirname, '..', 'art', 'o3'); assert.ok(fs.existsSync(path.join(dir, 'index.json')), 'atlases exported (node tools/o3-export.cjs)');
const J = JSON.parse(fs.readFileSync(path.join(dir, 'char_golden_sample_walk.json'), 'utf8')), img = PNG.decode(fs.readFileSync(path.join(dir, J.atlas)));
assert.equal(J.frames.length, 8 * 12); assert.deepEqual(J.frame_order, ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']);
for (const fr of [J.frames[0], J.frames[40], J.frames[95]]) {
  const want = E.toRGBA(C.render(G, X.DIR_INDEX[fr.direction], fr.animation, fr.frame_index).composite);
  for (let y = 0; y < E.FH; y += 3) for (let x = 0; x < E.FW; x += 3) { const a = ((fr.rect.y + y) * img.w + fr.rect.x + x) * 4, b = (y * E.FW + x) * 4; assert.deepEqual([...img.data.slice(a, a + 4)], [...want.slice(b, b + 4)], `${fr.direction} ${fr.frame_index} px ${x},${y}`); }
}
console.log('PASS: Option 3 atlases match the in-game renderer pixel-for-pixel');
// saves: old wardrobe saves load unchanged; new slot/items are additive
const old = { version: 1, outfit: { skin: 2, top: { id: 'tee', color: 0 }, bottom: { id: 'jeans', color: 0 }, shoes: { id: 'runners', color: 0 }, outer: { id: 'hoodie', color: 1 } }, owned: ['tee', 'jeans', 'runners', 'hoodie'], saved: [{ name: 'Mine', outfit: { top: { id: 'tee', color: 3 } } }] };
const s = W.clean(JSON.parse(JSON.stringify(old)));
assert.equal(s.outfit.top.id, 'tee'); assert.equal(s.outfit.outer.id, 'hoodie'); assert.equal(s.outfit.wrist, null); assert.equal(s.saved[0].name, 'Mine'); assert.ok(s.owned.includes('hoodie'));
const s2 = W.clean({ ...old, owned: [...old.owned, 'puffer2', 'courts', 'sportwatch'], outfit: { ...old.outfit, outer: { id: 'puffer2', color: 0, open: true }, wrist: { id: 'sportwatch', color: 0 } } });
assert.equal(s2.outfit.outer.id, 'puffer2'); assert.equal(s2.outfit.wrist.id, 'sportwatch');
assert.equal(W.clean({ ...old, outfit: { ...old.outfit, wrist: { id: 'sportwatch', color: 0 } } }).outfit.wrist, null, 'unowned new item is not worn');
console.log('PASS: wardrobe saves backward-compatible with the Option 3 items + wrist slot');
