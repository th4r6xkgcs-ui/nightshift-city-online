'use strict';
// Option 3 production export (Claude-owned): renders every character item into a transparent RGBA PNG atlas with a
// JSON sidecar that follows SPRITE_ATLAS_CONTRACT.md, plus art/opt3/characters/manifest.json for the game.
//   node tools/opt3/export.cjs [outDir=art/opt3/characters] [ids...]
// Frames: 8 directions (S,SW,W,NW,N,NE,E,SE) × idle 4 + walk 8 + run 8 + aim 2 + aimwalk 8 = 240 per item, each split
// into composite bands (far, mid, near, head, over) and trimmed. Empty bands are omitted (not "missing"): every
// (direction, animation, frame) has at least one band for every item — checked here and by tests/opt3.
const fs = require('node:fs');
const path = require('node:path');
const C = require('./core.cjs'), R = require('./rig.cjs'), F = require('./frame.cjs');
const { ITEMS, SLOT_ORDER, BANDS } = require('./items.cjs');

const outDir = path.resolve(process.argv[2] || path.join(__dirname, '../../art/opt3/characters'));
const only = process.argv.slice(3);
fs.mkdirSync(outDir, { recursive: true });
const ATLAS_W = 1024, PAD = 1;
const project = (W) => [C.OX + W[0], C.OY - (W[1] * C.CP - W[2] * C.SP)];
const at = (B, v) => { const o = C.apply3(B.R, v); return [B.T[0] + o[0], B.T[1] + o[1], B.T[2] + o[2]]; };
const r1 = (v) => Math.round(v * 10) / 10;

function trim(rgba) {
  let x0 = C.FW, y0 = C.FH, x1 = -1, y1 = -1;
  for (let y = 0; y < C.FH; y++) for (let x = 0; x < C.FW; x++) if (rgba[(y * C.FW + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function anchors(pose) {
  const B = pose.bones, P = (v) => project(v).map(r1);
  return { hand_r: P(at(B.handR, [0, -3.4, 1])), hand_l: P(at(B.handL, [0, -3.4, 1])), head: P(at(B.head, [0, 12.8, 0])), back: P(at(B.chest, [0, 6, -9])), feet: [C.OX, C.OY] };
}
function exportItem(id) {
  const it = ITEMS[id], t0 = Date.now(), tiles = [];
  for (const dir of R.DIRS) for (const anim of Object.keys(R.ANIMS)) for (let f = 0; f < R.ANIMS[anim].frames; f++) {
    const { bands, pose } = F.renderItem(id, dir, anim, f), an = anchors(pose); let any = false;
    for (const band of BANDS) {
      const r = bands[band]; if (!r) continue; const bb = trim(r.rgba); if (!bb) continue; any = true;
      const px = new Uint8ClampedArray(bb.w * bb.h * 4); for (let y = 0; y < bb.h; y++) px.set(r.rgba.subarray(((bb.y + y) * C.FW + bb.x) * 4, ((bb.y + y) * C.FW + bb.x + bb.w) * 4), y * bb.w * 4);
      tiles.push({ dir, anim, f, band, bb, px, an });
    }
    if (!any) tiles.push({ dir, anim, f, band: null, missing: true });
  }
  // shelf pack, tallest first
  const real = tiles.filter((t) => !t.missing).sort((a, b) => b.bb.h - a.bb.h || b.bb.w - a.bb.w);
  let x = 0, y = 0, shelf = 0;
  for (const t of real) { if (x + t.bb.w + PAD > ATLAS_W) { x = 0; y += shelf + PAD; shelf = 0; } t.rect = { x, y, w: t.bb.w, h: t.bb.h }; x += t.bb.w + PAD; shelf = Math.max(shelf, t.bb.h); }
  const H = y + shelf, img = new Uint8ClampedArray(ATLAS_W * H * 4);
  for (const t of real) for (let yy = 0; yy < t.rect.h; yy++) img.set(t.px.subarray(yy * t.rect.w * 4, (yy + 1) * t.rect.w * 4), ((t.rect.y + yy) * ATLAS_W + t.rect.x) * 4);
  const png = id + '.png'; fs.writeFileSync(path.join(outDir, png), C.encodePNG(ATLAS_W, H, img));
  const zb = (band) => BANDS.indexOf(band) * 100 + SLOT_ORDER.indexOf(it.slot);
  const rel = (p, bb) => [r1(p[0] - bb.x), r1(p[1] - bb.y)];
  const frames = real.map((t) => ({
    asset_id: id, atlas: png, rect: t.rect, direction: t.dir, animation: t.anim, frame_index: t.f, duration_ms: R.ANIMS[t.anim].ms,
    origin: { x: C.OX - t.bb.x, y: C.OY - t.bb.y }, hand_anchor: rel(t.an.hand_r, t.bb),
    equipment_anchors: { hand_r: rel(t.an.hand_r, t.bb), hand_l: rel(t.an.hand_l, t.bb), head: rel(t.an.head, t.bb), back: rel(t.an.back, t.bb) },
    collision_bounds: { x: C.OX - 9 - t.bb.x, y: C.OY - 6 - t.bb.y, w: 18, h: 10 }, layer: it.slot + ':' + t.band, band: t.band, z_bias: zb(t.band), tags: [it.slot, t.band, 'opt3'],
  }));
  frames.sort((a, b) => R.DIRS.indexOf(a.direction) - R.DIRS.indexOf(b.direction) || Object.keys(R.ANIMS).indexOf(a.animation) - Object.keys(R.ANIMS).indexOf(b.animation) || a.frame_index - b.frame_index || a.z_bias - b.z_bias);
  const json = {
    schema_version: '1.0.0', asset_id: id, atlas: png, slot: it.slot, native_frame_size: { w: C.FW, h: C.FH }, frame_origin: { x: C.OX, y: C.OY },
    native_px_per_world_px: 2, frame_order: R.DIRS, animations: R.ANIMS, bands: BANDS, recolor: it.recolor || null, wardrobe: it.wardrobe,
    mirrored: false, derived_note: 'Directions/frames not shown in the Option 3 reference are derived from the same 3D rig and garment definitions.',
    missing: tiles.filter((t) => t.missing).map((t) => ({ direction: t.dir, animation: t.anim, frame_index: t.f, status: 'TODO' })),
    frames, production_ready: true,
  };
  fs.writeFileSync(path.join(outDir, id + '.json'), JSON.stringify(json));
  console.log(`${id}: ${frames.length} band-frames, atlas ${ATLAS_W}x${H}, ${(fs.statSync(path.join(outDir, png)).size / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { id, slot: it.slot, atlas: png, json: id + '.json', w: ATLAS_W, h: H, frames: frames.length, recolor: it.recolor || null, wardrobe: it.wardrobe };
}
const ids = only.length ? only : Object.keys(ITEMS);
const done = ids.map(exportItem);
// manifest (merge with an existing one so partial exports keep the rest)
const mPath = path.join(outDir, 'manifest.json'); let prev = {}; try { prev = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { /* new */ }
const items = { ...(prev.items || {}) }; for (const d of done) items[d.id] = d;
fs.writeFileSync(mPath, JSON.stringify({ schema_version: '1.0.0', kind: 'opt3-character-layers', frame: { w: C.FW, h: C.FH, origin: { x: C.OX, y: C.OY }, native_px_per_world_px: 2 }, directions: R.DIRS, animations: R.ANIMS, bands: BANDS, slot_order: SLOT_ORDER, items }, null, 1));
console.log('manifest:', Object.keys(items).length, 'items');
