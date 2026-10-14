'use strict';
const fs = require('node:fs'); const PNG = require('./png.cjs'); const E = require('../o3-engine.js'); const P = require('../o3-pet.js');
const id = process.argv[3] || 'husky', k = 3, ORDER = [2, 3, 4, 5, 6, 7, 0, 1], rows = [['idle', 0], ['walk', 0], ['walk', 2], ['walk', 4], ['sit', 0]];
const w = P.PW * k * 8, h = P.PH * k * rows.length, img = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < img.length; i += 4) { img[i] = 20; img[i + 1] = 36; img[i + 2] = 58; img[i + 3] = 255; }
rows.forEach(([a, f], r) => ORDER.forEach((d, c) => PNG.blit(img, w, E.toRGBA(P.render(id, d, a, f).composite, P.PW, P.PH), P.PW, P.PH, c * P.PW * k, r * P.PH * k, k)));
fs.writeFileSync(process.argv[2], PNG.encode(img, w, h)); console.log('ok');
