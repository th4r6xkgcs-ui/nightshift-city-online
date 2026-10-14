// Option 3 MASTER: husky, standing 3/4 pose facing right (the in-game pet camera). 120x96 art px on the shared
// 3 px/world grid; ground origin (60, 88). Grey/black saddle over a white underside, white face mask with a dark
// widow's peak, ice-blue eyes, erect ears, curled bushy tail, purple collar with a tag. Light from the upper left.
'use strict';
const { Pix } = require('./pix.cjs');
const W = 120, H = 96, GROUND = 88;
const C = {
  ink: '#120f17',
  gy: ['#a9b1c4', '#7a8296', '#565d70', '#3a4052', '#232734'],
  wt: ['#ffffff', '#eef0f6', '#d3d7e2', '#aab0bf', '#80869a'],
  ey: ['#c8f0ff', '#6cc8f4', '#2c86c8'],
  ns: ['#3a3640', '#1c1a22'],
  er: ['#f2c9cb', '#c7969c'],
  cl: ['#e07af5', '#b23fd9', '#7c22a3'],
  gd: ['#fff0a8', '#e7b84a', '#a8761f'],
  tg: '#e05a6a',
};

function draw() {
  const P = Pix(W, H);
  const leg = (nm, top, knee, paw, col, shadeCol, lit) => {
    // a leg as a tapered polygon top→knee→paw, white socks, paw pad
    const [tx, ty, tw] = top, [kx, ky, kw] = knee, [px, py] = paw;
    P.part(nm).poly([[tx - tw, ty], [tx + tw, ty], [kx + kw, ky], [px + 3, py - 3], [px - 3, py - 3], [kx - kw, ky]], col);
    P.ell(px + 1, py - 2.5, 5.4, 3.2, lit ? C.wt[1] : C.wt[2]);
    P.clip(nm).shade((x) => x > kx + 0.5, { [col]: shadeCol, [C.wt[1]]: C.wt[2], [C.wt[2]]: C.wt[3] });
    P.line(px - 1, py - 1, px + 3, py - 1, C.wt[3]).set(px + 1, py - 3, lit ? C.wt[0] : C.wt[1]);
    P.clip(null);
  };

  // ---- far legs (further from camera: higher, darker) ----
  P.off(4, 0);
  leg('legFH', [44, 64, 6], [40, 77, 4], [42, GROUND - 3], C.wt[2], C.wt[3], false);
  P.off(0, 0);
  leg('legFF', [79, 66, 5], [79, 77, 4], [80, GROUND - 3], C.wt[2], C.wt[3], false);

  P.off(4, 0);
  // ---- tail: thick curl rising off the rump and arcing back over the hip ----
  P.part('tail').poly([[37, 52], [29, 49], [23, 42], [20, 33], [22, 25], [27, 19], [35, 16], [42, 18], [45, 24], [41, 28], [35, 27], [31, 31], [31, 38], [34, 43], [39, 47]], C.gy[2]);
  for (const [x, y, r] of [[20.5, 35, 2.6], [21, 27, 2.8], [25, 20.5, 2.8], [31, 16.5, 2.6], [38, 16, 2.4], [24, 43, 2.4]]) P.ell(x, y, r, r, C.gy[2]);   // fluffy scallops on the curl
  P.clip('tail');
  P.shade((x, y) => x < 27 && y > 33, { [C.gy[2]]: C.wt[2] });              // pale underside of the curl
  P.shade((x, y) => y < 24 || (x < 25 && y < 34), { [C.gy[2]]: C.gy[1] });   // lit top
  P.path([[22, 30], [25, 23], [31, 19]], C.gy[0]); P.path([[31, 34], [32, 41]], C.gy[3]); P.path([[34, 24], [41, 23]], C.wt[1]); P.path([[26, 38], [28, 43]], C.wt[1]);
  P.clip(null); P.off(0, 0);

  // ---- body: deep chest, tucked waist, rounded rump ----
  P.part('body').poly([[40, 50], [47, 43], [60, 42], [74, 41], [84, 45], [89, 53], [88, 63], [84, 70], [76, 73], [66, 70], [56, 69], [48, 71], [42, 69], [38, 61]], C.gy[2]);
  for (const [x, y] of [[52, 70.5], [60, 70], [68, 71.5]]) P.ell(x, y, 3.2, 2, C.wt[2]);   // soft belly fringe
  P.clip('body');
  for (let y = 40; y < 74; y++) for (let x = 30; x < 90; x++) {
    const under = y > 59 + (x < 50 ? 2 : 0) - (x > 74 ? (x - 74) * 0.9 : 0);   // white belly + chest
    if (under) P.tint(x, y, y > 66 ? C.wt[2] : C.wt[1]); else if (y < 47) P.tint(x, y, C.gy[1]); else if (y > 55) P.tint(x, y, C.gy[3]);
  }
  // saddle fur texture: hand-placed tufts along the back and the coat break on the flank
  for (const [a, b] of [[[41, 48], [45, 50]], [[50, 47], [55, 49]], [[60, 46], [65, 48]], [[70, 46], [74, 48]], [[46, 53], [50, 55]], [[62, 52], [66, 54]]]) P.line(a[0], a[1], b[0], b[1], C.gy[3]);
  P.path([[39, 46], [46, 44], [60, 43.5], [72, 43]], C.gy[0]);
  P.path([[36, 61], [42, 59], [47, 61], [53, 59], [59, 61], [65, 59], [70, 60]], C.gy[4]);              // jagged saddle edge
  P.path([[48, 67], [56, 67.5], [64, 67]], C.wt[3]);                                                    // belly tuck shadow
  P.clip(null);

  // ---- near legs (closer: lower, brighter) ----
  P.off(4, 0);
  leg('legNH', [48, 62, 8], [45, 77, 4.6], [47, GROUND], C.gy[2], C.gy[3], true);
  P.clip('legNH').shade((x, y) => y > 71, { [C.gy[2]]: C.wt[1], [C.gy[3]]: C.wt[2] }).path([[42, 64], [43, 71]], C.gy[1]).path([[46, 70], [48, 73]], C.gy[4]).clip(null).off(0, 0);   // thigh, hock + white stocking
  leg('legNF', [84, 65, 5.8], [86, 78, 4.4], [87.5, GROUND], C.wt[1], C.wt[2], true);
  P.clip('legNF').line(83, 68, 83, 81, C.wt[0]).path([[86, 82], [88, 84]], C.wt[3]).clip(null);

  // ---- neck ruff + chest bib ----
  P.part('neck').poly([[72, 44], [80, 32], [94, 33], [97, 46], [93, 60], [87, 66], [80, 58]], C.gy[2]);
  for (const [x, y] of [[96, 52.5], [94.5, 58], [90.5, 63.5]]) P.ell(x, y, 3, 2.8, C.wt[1]);
  P.clip('neck');
  P.shade((x, y) => x > 86 || y > 50, { [C.gy[2]]: C.wt[1] });
  P.shade((x, y) => x > 92 && y > 54, { [C.wt[1]]: C.wt[2] });
  P.path([[75, 45], [78, 39], [83, 34]], C.gy[1]); P.path([[87, 52], [89, 58], [87, 63]], C.wt[0]); P.path([[84, 54], [85, 59]], C.wt[2]); P.path([[91, 55], [94, 58]], C.wt[3]);
  P.clip(null);

  // ---- collar + tag (sits on the ruff) ----
  P.part('collar').poly([[79, 43], [86, 45.5], [96, 46], [96.5, 50], [86, 50], [78.5, 47.5]], C.cl[1]);
  P.clip('collar').line(79, 43, 96, 46, C.cl[0]).line(79, 47, 96, 49.5, C.cl[2]).set(88, 47, C.gd[1]).set(89, 47, C.gd[2]).clip(null);
  P.part('tag').rect(92, 50, 3, 2, C.gd[2]).ell(93.5, 54, 2.8, 2.8, C.gd[1]).set(93, 53, C.gd[0]).set(94, 55, C.gd[2]);

  // ---- head: broad skull, defined stop, wedge muzzle angled toward the camera ----
  P.part('head').ell(92, 31, 13, 11.5, C.gy[2]).poly([[94, 31], [106, 33], [111, 37], [110.5, 42], [103, 45], [94, 43]], C.wt[1]);
  for (const [x, y] of [[80, 38], [81.5, 42.5]]) P.ell(x, y, 2.8, 2.4, C.wt[1]);
  P.clip('head');
  // white mask: cheeks, muzzle, eyebrow spots; dark cap + widow's peak down the forehead
  P.shade((x, y) => y > 32 || (x > 95 && y > 28), { [C.gy[2]]: C.wt[1] });
  P.poly([[86, 20], [98, 20], [96.5, 27], [93, 32], [89.5, 27]], C.gy[3]);
  P.path([[87, 22], [92, 21], [96, 21]], C.gy[1]);
  P.ell(86.5, 28.5, 2.6, 1.7, C.wt[0]); P.ell(98.5, 28, 2.4, 1.6, C.wt[0]);                               // eyebrow spots
  P.shade((x, y) => x < 84 && y < 35, { [C.wt[1]]: C.gy[2] });
  P.shade((x, y) => y > 40, { [C.wt[1]]: C.wt[2] });
  // eyes: almond, ice blue, dark rims, catch-lights (near eye bigger)
  P.poly([[83.5, 31.5], [87, 29.5], [90, 31.5], [87, 33.5]], C.ns[1]).rect(86, 30, 2, 3, C.ey[1]).set(86, 30, C.ey[0]).set(87, 31, C.ns[1]);
  P.poly([[95, 31], [99, 29], [102.5, 31], [99, 33.5]], C.ns[1]).rect(97, 30, 3, 3, C.ey[1]).set(97, 30, C.ey[0]).set(99, 31, C.ey[2]).set(98, 31, C.ns[1]).set(98, 32, C.ey[2]);
  // nose, mouth line, chin
  P.poly([[106, 35], [111.5, 36], [111.5, 39.5], [107.5, 39.5]], C.ns[1]).set(107, 36, C.ns[0]).set(108, 36, '#6a6672').set(109, 36, '#6a6672');
  P.path([[101, 43], [105, 42.5], [109.5, 41]], C.wt[3]); P.path([[97, 38], [102, 36]], C.wt[2]); P.path([[95, 41], [98, 43]], C.wt[2]);
  P.clip(null);

  // ---- ears: tall triangles, dark backs, pink inner, white fringe (near ear larger) ----
  P.part('earFar').poly([[80, 28], [80.5, 11], [89, 23]], C.gy[3]);
  P.clip('earFar').poly([[81.5, 25], [82, 15], [87, 23]], C.er[1]).clip(null);
  P.part('earNear').poly([[91, 22], [99.5, 6], [103, 24]], C.gy[2]);
  P.clip('earNear').poly([[93.5, 21.5], [99.5, 10], [101.5, 22.5]], C.er[0]).line(94, 21, 98.5, 13, C.er[1]).line(100, 8, 102, 20, C.gy[1]).line(95, 22, 101, 22.5, C.wt[1]).clip(null);

  P.paint(C, { gain: 8, vgrad: 1.5, warm: '#fffaf0', cool: '#1e2440', rim: '#b9c8ff', parts: {
    legFH: { r: 4 }, legFF: { r: 4 }, legNH: { r: 6 }, legNF: { r: 4 }, tail: { r: 7 }, body: { r: 12 }, neck: { r: 10 },
    collar: { r: 2, gloss: true }, tag: { flat: true }, head: { r: 10 }, earFar: { r: 3 }, earNear: { r: 3 } } });
  P.contour(C.ink, 0.55, ['tag'], [['body', 'neck', 'head']]);
  return P;
}

module.exports = { draw, W, H, ORIGIN: [60, GROUND], PALETTE: C };
if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path'), { preview } = require('./pix.cjs');
  const out = process.argv[2] || 'art/o3-master', P = draw(); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'master_husky.png'), P.png());
  fs.writeFileSync(path.join(out, 'preview_husky.png'), preview(P.rgba(), W, H, 5).png);
  console.log('husky', W + 'x' + H, 'bbox', JSON.stringify(P.bbox()), 'colours', P.colours());
}
