'use strict';
// Render one item (or a whole outfit) for a direction/animation/frame, split into composite bands.
const C = require('./core.cjs');
const R = require('./rig.cjs');
const { ITEMS, SLOT_ORDER, BANDS } = require('./items.cjs');

function depthOf(T) { return T[1] * C.SP + T[2] * C.CP; }
/** Assign each compiled prim its band for this pose. */
function bandOf(p, pose) {
  if (['far', 'mid', 'near', 'head', 'over'].includes(p.band)) return p.band;
  const chest = depthOf(pose.bones.chest.T);
  if (p.band === 'limb') return p.depth < chest - 2.5 ? 'far' : 'near';
  if (p.band === 'back') { const ref = depthOf(pose.bones[p.ref || 'chest'].T); if (p.depth < ref) return 'far'; return p.ref === 'head' ? 'over' : 'near'; }
  return 'mid';
}
/** { band: render } for one item. */
const occCache = new Map();
/** Depth of the base body for a frame (the occluder baked into every other layer). */
function bodyDepth(dir, anim, f, opts) {
  const k = dir + anim + f + (opts.skin ?? ''); let d = occCache.get(k); if (d) return d;
  const pose = R.bones(dir, anim, f); d = C.render(C.compile(ITEMS.character_base_body.build(opts), pose), { smooth: 1.6, noOutline: true }).depth;
  if (occCache.size > 64) occCache.clear(); occCache.set(k, d); return d;
}
function renderItem(id, dir, anim, f, opts = {}) {
  const pose = R.bones(dir, anim, f), it = ITEMS[id], prims = C.compile(it.build(opts), pose), by = {};
  const occ = it.slot === 'body' ? null : bodyDepth(dir, anim, f, opts);
  for (const p of prims) (by[bandOf(p, pose)] ||= []).push(p);
  const out = {};
  for (const b of BANDS) if (by[b]) { const r = C.render(by[b], { smooth: 1.6, occ }); if (!r.empty && r.ids.some((v) => v >= 0) || hasPixels(r.rgba)) out[b] = r; }
  return { bands: out, pose };
}
function hasPixels(a) { for (let i = 3; i < a.length; i += 4) if (a[i]) return true; return false; }
/** Composite a whole outfit (list of item ids) into one RGBA frame. */
function composite(ids, dir, anim, f, opts = {}) {
  const items = ids.map((id) => ({ id, slot: ITEMS[id].slot, r: renderItem(id, dir, anim, f, opts) }));
  items.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  const out = new Uint8ClampedArray(C.FW * C.FH * 4);
  for (const band of BANDS) for (const it of items) { const r = it.r.bands[band]; if (!r) continue; blit(out, r.rgba); }
  return out;
}
function blit(dst, src) { for (let i = 0; i < src.length; i += 4) { const a = src[i + 3]; if (!a) continue; dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2]; dst[i + 3] = 255; } }
module.exports = { bodyDepth, renderItem, composite, bandOf, blit, hasPixels };
