// Option 3 looks sheet: several outfits built only from Option 3 items, S/SE/E/N. node tools/o3-looks.cjs out.png
'use strict';
const fs = require('node:fs'); const PNG = require('./png.cjs'); const E = require('../o3-engine.js'); const C = require('../o3-character.js'); const W = require('../wardrobe-data.js');
const LOOKS = [
  { skin: 3, hair: 'short', hairColor: 0, head: { id: 'cap', color: 8 }, face: { id: 'shades', color: 0 }, top: { id: 'tee', color: 7 }, outer: { id: 'puffer2', color: 0, open: true }, bottom: { id: 'cargo', color: 5 }, shoes: { id: 'courts', color: 0 }, jewelry: { id: 'chain', color: 0 }, wrist: { id: 'sportwatch', color: 0 } },
  { skin: 5, hair: 'braids', hairColor: 0, top: { id: 'tee', color: 8 }, outer: { id: 'track', color: 9, open: true }, bottom: { id: 'jeans', color: 0 }, shoes: { id: 'courts', color: 2 }, jewelry: { id: 'chain', color: 0 }, bag: { id: 'backpack', color: 9 } },
  { skin: 1, hair: 'fade', hairColor: 1, head: { id: 'cap', color: 1, back: true }, top: { id: 'tee', color: 7 }, outer: { id: 'hoodie', color: 8 }, bottom: { id: 'cargo', color: 3 }, shoes: { id: 'boots', color: 1 }, wrist: { id: 'sportwatch', color: 1 } },
  { skin: 6, hair: 'short', hairColor: 3, face: { id: 'shades', color: 2 }, top: { id: 'tee', color: 4 }, outer: { id: 'puffer2', color: 0, open: false }, bottom: { id: 'jeans', color: 1 }, shoes: { id: 'courts', color: 1 }, bag: { id: 'backpack', color: 9 } },
  { skin: 2, hair: 'braids', hairColor: 9, head: { id: 'cap', color: 0 }, top: { id: 'tee', color: 1 }, bottom: { id: 'cargo', color: 1 }, shoes: { id: 'courts', color: 3 }, jewelry: { id: 'chain', color: 1 } },
].map((o) => W.cleanOutfit(o));
const DIRS = [2, 1, 0, 6], k = 2, cw = E.FW * k, ch = E.FH * k, w = cw * DIRS.length * LOOKS.length, h = ch, img = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < img.length; i += 4) { img[i] = 20; img[i + 1] = 36; img[i + 2] = 58; img[i + 3] = 255; }
LOOKS.forEach((o, li) => { if (!C.supports(o)) console.log('NOT SUPPORTED look', li, JSON.stringify(o)); DIRS.forEach((d, di) => PNG.blit(img, w, E.toRGBA(C.render(o, d, 'idle', 0).composite), E.FW, E.FH, (li * DIRS.length + di) * cw, 0, k)); });
fs.writeFileSync(process.argv[2] || 'o3-looks.png', PNG.encode(img, w, h)); console.log('ok');
