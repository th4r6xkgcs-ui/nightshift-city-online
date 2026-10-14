'use strict';
// Dev preview: node tools/opt3/preview.cjs out.png [anim] [frame] [scale] [ids...]
const fs = require('node:fs');
const C = require('./core.cjs'), R = require('./rig.cjs'), F = require('./frame.cjs');
const [out = 'preview.png', anim = 'idle', fr = '0', sc = '4', ...ids0] = process.argv.slice(2);
const GOLD = ['character_base_body', 'character_hair_short', 'character_cap_black', 'character_facewear_sunglasses', 'character_tee_white', 'character_jacket_orange_black', 'character_cargo_pants_black', 'character_sneakers_red_white', 'character_necklace_gold', 'character_watch_black'];
const ids = ids0.length ? ids0 : GOLD, S = +sc, dirs = R.DIRS;
const W = C.FW * S * dirs.length, H = C.FH * S, img = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 0x14; img[i * 4 + 1] = 0x24; img[i * 4 + 2] = 0x3a; img[i * 4 + 3] = 255; }
const t0 = Date.now();
dirs.forEach((d, k) => {
  const fr0 = C.FW * C.FH * 4, px = F.composite(ids, d, anim, +fr);
  for (let y = 0; y < C.FH; y++) for (let x = 0; x < C.FW; x++) { const i = (y * C.FW + x) * 4; if (!px[i + 3]) continue; for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) { const j = ((y * S + yy) * W + k * C.FW * S + x * S + xx) * 4; img[j] = px[i]; img[j + 1] = px[i + 1]; img[j + 2] = px[i + 2]; } }
  void fr0;
});
fs.writeFileSync(out, C.encodePNG(W, H, img));
console.log('wrote', out, W + 'x' + H, (Date.now() - t0) + 'ms');
