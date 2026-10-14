// Option 3 art correction (Claude): the three hand-authored master sprites — committed PNGs are exactly what the
// authoring scripts produce, truly transparent (alpha 0/255 only, no matte), sized on the shared 3 px/world grid,
// feet/ground on the declared origin, and the in-game review hook is off by default.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), PNG = require('../tools/png.cjs');
const root = path.join(__dirname, '..');
for (const [mod, file, w, h, origin] of [['character', 'master_player_streetwear.png', 144, 192, [72, 177]], ['coupe', 'master_vanta_gt_top.png', 168, 90, null], ['husky', 'master_husky.png', 120, 96, [60, 88]]]) {
  const M = require(path.join(root, 'tools/o3-master', mod + '.cjs')), P = M.draw(), img = PNG.decode(fs.readFileSync(path.join(root, 'art/o3-master', file)));
  assert.equal(img.w, w); assert.equal(img.h, h); assert.equal(M.W, w); assert.equal(M.H, h);
  assert.deepEqual([...img.data], [...P.rgba()], file + ' matches its authoring script');
  let clear = 0, semi = 0, lowest = -1; for (let i = 3; i < img.data.length; i += 4) { const a = img.data[i]; if (a === 0) clear++; else if (a !== 255) semi++; else lowest = Math.max(lowest, Math.floor((i >> 2) / w)); }
  assert.equal(semi, 0, file + ': crisp alpha'); assert.ok(clear > w * h * 0.1, file + ': transparent background');
  if (origin) assert.ok(Math.abs(lowest - origin[1]) <= 1, `${file}: lowest row ${lowest} on ground ${origin[1]}`);
  assert.ok(P.colours() >= 25, file + ': rich hand-picked palette (' + P.colours() + ')');
}
// review hook: off by default, loaded after the runtime
const src = fs.readFileSync(path.join(root, 'o3-masters.js'), 'utf8'); assert.match(src, /let on = false/);
const build = fs.readFileSync(path.join(root, 'online/build-online.cjs'), 'utf8'); assert.ok(build.indexOf("'o3-masters.js'") > build.indexOf("'o3-runtime.js'"));
console.log('PASS: Option 3 masters (player 144x192, Vanta GT 168x90 top-down, husky 120x96; exact, transparent, grounded; review hook off by default)');
