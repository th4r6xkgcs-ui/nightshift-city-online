// Option 3 review sheet (Claude tooling): node tools/o3-preview.cjs out.png [anim] [scale]
// Renders the golden-sample character in all 8 directions (contract order S,SW,W,NW,N,NE,E,SE) for a few frames.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const PNG = require('./png.cjs'); const E = require('../o3-engine.js'); const C = require('../o3-character.js');
const out = process.argv[2] || 'o3-preview.png', anim = process.argv[3] || 'idle', k = +(process.argv[4] || 3), frames = +(process.argv[5] || 1);
const ORDER = [2, 3, 4, 5, 6, 7, 0, 1]; // contract S,SW,W,NW,N,NE,E,SE → game dir index
const GOLDEN = { skin: 3, build: 'regular', hair: 'short', hairColor: 0, facial: 'none', head: { id: 'cap', color: 8 }, face: { id: 'shades', color: 0 }, top: { id: 'tee', color: 7 }, outer: { id: 'puffer2', color: 0, open: true }, bottom: { id: 'cargo', color: 5 }, shoes: { id: 'courts', color: 0 }, jewelry: { id: 'chain', color: 0 }, wrist: { id: 'sportwatch', color: 0 }, bag: null };
const outfit = process.env.O3_OUTFIT ? JSON.parse(process.env.O3_OUTFIT) : GOLDEN;
const W = E.FW * k, H = E.FH * k, cols = 8, rows = frames, img = new Uint8ClampedArray(W * cols * H * rows * 4);
for (let i = 0; i < img.length; i += 4) { img[i] = 20; img[i + 1] = 36; img[i + 2] = 58; img[i + 3] = 255; }
for (let r = 0; r < rows; r++) for (let ci = 0; ci < cols; ci++) {
  const f = Math.floor((r * (C.ANIMS[anim] || 1)) / rows), res = C.render(outfit, ORDER[ci], anim, f), rgba = E.toRGBA(res.composite);
  PNG.blit(img, W * cols, rgba, E.FW, E.FH, ci * W, r * H, k);
}
fs.writeFileSync(out, PNG.encode(img, W * cols, H * rows)); console.log('wrote', path.resolve(out), W * cols + 'x' + H * rows);
