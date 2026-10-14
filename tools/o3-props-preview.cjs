'use strict';
const fs = require('node:fs'); const PNG = require('./png.cjs'); const E = require('../o3-engine.js'); const P = require('../o3-props.js');
const k = 3, cells = []; for (const kd of P.KINDS) for (const n of [false, true]) cells.push([kd, n]);
const w = E.FW * k * cells.length, h = E.FH * k, img = new Uint8ClampedArray(w * h * 4);
cells.forEach(([kd, n], i) => { for (let y = 0; y < h; y++) for (let x = i * E.FW * k; x < (i + 1) * E.FW * k; x++) { const j = (y * w + x) * 4; const c = n ? [10, 18, 32] : [44, 52, 62]; img[j] = c[0]; img[j + 1] = c[1]; img[j + 2] = c[2]; img[j + 3] = 255; } PNG.blit(img, w, E.toRGBA(P.render(kd, n).composite), E.FW, E.FH, i * E.FW * k, 0, k); });
fs.writeFileSync(process.argv[2], PNG.encode(img, w, h)); console.log('ok');
