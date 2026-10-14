// Option 3 browser-rendered atlases (Claude tooling): the HD weapon and the coupe views are canvas-rendered, so they
// are exported from the real game build. Usage: node tools/o3-export-browser.mjs http://localhost:8765/index.html art/o3
// Writes weapon_carbine_modular.png/.json (4 presets, HD) and vehicle_purple_coupe_views.png/.json (3 setups x side,
// front, rear authored views + top-down). Pixels are exactly what the game draws.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path';
const [url = 'http://localhost:8765/index.html', out = 'art/o3'] = process.argv.slice(2);
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 800, height: 600 } });
await pg.goto(url + '?notour'); await pg.waitForTimeout(2500);
const res = await pg.evaluate(() => {
  const crisp = (src, sx, sy, sw, sh, dw, dh) => { const c = document.createElement('canvas'); c.width = dw; c.height = dh; const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh); const d = x.getImageData(0, 0, dw, dh); for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] >= 110 ? 255 : 0; x.putImageData(d, 0, 0); return c; };
  // --- weapon: 4 presets (+ fitted mods each preset needs), HD sprite resampled into 192x96 cells
  const K = NightshiftWeaponKit, A = NightshiftWeaponArt, base = NightshiftWeaponKitData.clean({}, 'carbine'), MODS = { 'NIGHT OPS': ['extmag', 'grip', 'scope', 'suppressor'] };
  const W = 192, H = 96, wcv = document.createElement('canvas'); wcv.width = W * 4; wcv.height = H; const wc = wcv.getContext('2d'), wframes = [];
  K.PRESETS.forEach(([name, cfg], i) => { const mods = MODS[name] || [], parts = { ...base, ...cfg }, s = A.sprite('carbine', name === 'NIGHT OPS' ? 'carbon' : null, mods, parts), k = Math.min((W - 8) / s.box.w, (H - 8) / s.box.h), dw = Math.round(s.box.w * k), dh = Math.round(s.box.h * k); const c = crisp(s.cv, s.box.x, s.box.y, s.box.w, s.box.h, dw, dh); wc.drawImage(c, i * W + Math.round((W - dw) / 2), Math.round((H - dh) / 2));
    const hand = s.a.hand; wframes.push({ asset_id: 'weapon_carbine_black', rect: { x: i * W, y: 0, w: W, h: H }, direction: 'E', animation: 'idle', frame_index: i, duration_ms: 0, origin: { x: i * W + Math.round((W - dw) / 2 + (hand[0] - s.box.x) * k) - i * W, y: Math.round((H - dh) / 2 + (hand[1] - s.box.y) * k) }, hand_anchor: { x: Math.round((W - dw) / 2 + (hand[0] - s.box.x) * k), y: Math.round((H - dh) / 2 + (hand[1] - s.box.y) * k) }, equipment_anchors: {}, collision_bounds: { x: 0, y: 0, w: W, h: H }, layer: 'assembled', z_bias: 0, tags: ['preset:' + name, ...Object.entries(parts).map(([k2, v]) => k2 + ':' + v), ...mods.map((m) => 'mod:' + m)] }); });
  // --- vehicle: 3 setups x (top, side, front, rear)
  const SD = NightshiftCarStyleData, CV = NightshiftCarViews, spec = NightshiftCarsData.BY.vanta;
  const SET = [['factory', '#8a3fd6', SD.cleanStyle(spec.o3)], ['stock', '#8a3fd6', SD.DEFAULT], ['street', '#2f6bd0', SD.cleanStyle({ kit: 'lip', spoiler: 'ducktail', rims: 'bronze', livery: 'stripes', liveryColor: '#f4f1ea', stance: 'lowered', exhaust: 'quad', lights: 'amber', hood: 'vented' })]];
  const VW = 192, VH = 96, vcv = document.createElement('canvas'); vcv.width = VW * 4; vcv.height = VH * 3; const vc = vcv.getContext('2d'), vframes = []; vc.imageSmoothingEnabled = false;
  SET.forEach(([name, col, st], r) => {
    const top = NightshiftCars.sprite('vanta', col, st), tk = Math.min((VH - 4) / top.h, (VW - 4) / top.w), tmp = document.createElement('canvas'); tmp.width = top.cv.width; tmp.height = top.cv.height; tmp.getContext('2d').drawImage(top.cv, 0, 0);
    const tc = crisp(tmp, 0, 0, tmp.width, tmp.height, Math.round(top.w * tk), Math.round(top.h * tk)); vc.drawImage(tc, Math.round((VW - tc.width) / 2), r * VH + Math.round((VH - tc.height) / 2));
    vframes.push({ asset_id: 'vehicle_purple_sport_coupe', rect: { x: 0, y: r * VH, w: VW, h: VH }, direction: 'TOP', animation: 'idle', frame_index: r, duration_ms: 0, origin: { x: VW / 2, y: VH / 2 }, hand_anchor: null, equipment_anchors: {}, collision_bounds: { x: Math.round((VW - tc.width) / 2), y: Math.round((VH - tc.height) / 2), w: tc.width, h: tc.height }, layer: 'assembled', z_bias: 0, tags: ['setup:' + name, 'view:top', 'heading:E'] });
    ['side', 'front', 'rear'].forEach((v, i) => { const img = CV.render(v, { color: col, style: st }), [w0, h0] = CV.SIZE[v]; vc.drawImage(img, (i + 1) * VW + Math.round((VW - w0) / 2), r * VH + (VH - h0)); vframes.push({ asset_id: 'vehicle_purple_sport_coupe', rect: { x: (i + 1) * VW, y: r * VH, w: VW, h: VH }, direction: { side: 'E', front: 'S', rear: 'N' }[v], animation: 'idle', frame_index: r, duration_ms: 0, origin: { x: VW / 2, y: VH - 6 }, hand_anchor: null, equipment_anchors: {}, collision_bounds: { x: Math.round((VW - w0) / 2), y: VH - h0, w: w0, h: h0 }, layer: 'assembled', z_bias: 0, tags: ['setup:' + name, 'view:' + v] }); });
  });
  return { weapon: wcv.toDataURL('image/png'), wframes, vehicle: vcv.toDataURL('image/png'), vframes, W: [wcv.width, wcv.height], V: [vcv.width, vcv.height] };
});
const DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
for (const [file, data, frames, size, id, note] of [['weapon_carbine_modular', res.weapon, res.wframes, res.W, 'weapon_carbine_black', '4 valid configurations of the modular carbine (weapon-kit-data.js); side view (E) — the top-down game shows the same sprite rotated in the hand'], ['vehicle_purple_coupe_views', res.vehicle, res.vframes, res.V, 'vehicle_purple_sport_coupe', '3 setups x authored views supported by the game: TOP (city, rotated by heading), SIDE (Route 9 + garage), FRONT and REAR (garage)']]) {
  fs.writeFileSync(path.join(out, file + '.png'), Buffer.from(data.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(out, file + '.json'), JSON.stringify({ schema_version: '1.0.0', asset_id: id, atlas: file + '.png', native_frame_size: { w: frames[0].rect.w, h: frames[0].rect.h }, frame_order: DIRS, frame_counts: {}, note, generator: 'browser export of the live renderer', production_ready: true, frames: frames.map((f) => ({ ...f, atlas: file + '.png' })) }));
  console.log(file, frames.length, 'frames', size.join('x'));
}
await b.close();
