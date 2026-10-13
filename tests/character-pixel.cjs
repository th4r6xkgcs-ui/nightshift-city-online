// Pixel-art characters (Claude-owned): every wardrobe item, hairstyle, direction and animation renders inside the cell,
// outlined, shaded (many tones), and visibly changes the sprite.
const assert = require('node:assert/strict');
globalThis.document = globalThis.document || {}; // character-art only needs to know it's in a page
globalThis.NightshiftWardrobeData = require('../wardrobe-data.js');
require('../character-art.js');
const PX = require('../character-pixel.js');
const W = globalThis.NightshiftWardrobeData, GW = PX.GW, GH = PX.GH;
const filled = (c) => c.filter(Boolean).length, key = (c) => c.join(',');
const edgesClear = (c) => { for (let x = 0; x < GW; x++) if (c[x] || c[(GH - 1) * GW + x]) return false; for (let y = 0; y < GH; y++) if (c[y * GW] || c[y * GW + GW - 1]) return false; return true; };
const base = W.cleanOutfit(W.DEFAULT), b0 = PX.render(base, 2, 'idle', 0, '');
assert.ok(filled(b0) > 1400, 'a full body'); assert.ok(edgesClear(b0), 'fits the cell');
assert.ok(new Set(b0.filter(Boolean)).size >= 40, 'richly shaded, not flat');
const dirs = new Set(); for (let d = 0; d < 8; d++) { const c = PX.render(base, d, 'idle', 0, ''); assert.ok(edgesClear(c), `dir ${d} fits`); dirs.add(key(c)); }
assert.equal(dirs.size, 8, 'eight distinct directions');
for (const a of ['walk', 'run', 'sneak', 'crouch', 'sit']) { const n = new Set(); for (let f = 0; f < 4; f++) { const c = PX.render(base, 1, a, f, ''); assert.ok(edgesClear(c), `${a} ${f} fits`); n.add(key(c)); } assert.ok(n.size >= 2, `${a} animates`); }
for (const hold of ['short', 'long']) assert.ok(key(PX.render(base, 0, 'idle', 0, hold)) !== key(PX.render(base, 0, 'idle', 0, '')), `${hold} hold pose`);
for (const it of W.ITEMS) {
  const ref = W.cleanOutfit({ ...W.DEFAULT, outer: it.cat === 'top' ? null : W.DEFAULT.outer }), o = W.cleanOutfit({ ...ref, [it.cat]: { id: it.id, color: ref[it.cat]?.id === it.id ? (ref[it.cat].color + 1) % it.colors.length : 0 } }), c = PX.render(o, 1, 'idle', 0, '');
  assert.ok(edgesClear(c), `${it.id} fits`); assert.ok(key(c) !== key(PX.render(ref, 1, 'idle', 0, '')), `${it.id} shows`);
}
const hair = new Set(); for (const [h] of W.HAIRSTYLES) hair.add(key(PX.render(W.cleanOutfit({ ...W.DEFAULT, outer: null, hair: h }), 2, 'idle', 0, ''))); assert.equal(hair.size, W.HAIRSTYLES.length, 'every haircut is distinct');
for (let i = 0; i < 30; i++) assert.ok(edgesClear(PX.render(W.npcOutfit(i * 131 + 7), i % 8, 'walk', i, '')), 'npc fits');
console.log('character-pixel: items, hair, 8 directions, animations, holds OK');
process.exit(0);
