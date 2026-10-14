// Option 3 MASTER: orange/black streetwear player, front standing pose (facing S). Hand-placed shapes on a 144x192
// grid (3 art px per world px; feet origin 72,177). Light from the upper left. Parts are separate so clothing
// construction reads: legs → shoes → tee → jacket body → panels → arms → hands → neck → head → hair → cap → accessories.
'use strict';
const { Pix } = require('./pix.cjs');
const W = 144, H = 192, CX = 72, FOOT = 177;
const m = (x) => 2 * CX - x;                    // mirror a coordinate
const mp = (pts) => pts.map(([x, y]) => [m(x), y]);
const mr = (x, w) => 2 * CX - x - w;            // mirror a rect's x

// ---- palette (5-step ramps, hl → deep) ----
const C = {
  ink: '#120d17',
  or: ['#ffc46b', '#ff9a2e', '#ec7a17', '#bf5713', '#7e3412'],
  bk: ['#5a5f6e', '#3b3f4b', '#2a2d36', '#1c1e25', '#131419'],
  wt: ['#ffffff', '#eeedf3', '#d3d1de', '#a9a6ba', '#7b788f'],
  cg: ['#7d7b6d', '#5f5e53', '#4a4942', '#383731', '#27261f'],   // cargo charcoal-olive
  sk: ['#f6c39a', '#e3a272', '#c98455', '#a1633b', '#6f4127'],   // skin
  hr: ['#4a3529', '#33241c', '#221812'],
  rd: ['#ff6f63', '#ec3437', '#c11f2d', '#86142a'],
  gd: ['#fff0a8', '#f2c94c', '#c9902a', '#8a5a1a'],
  sv: ['#f4f6fa', '#c3c9d2', '#8a919c', '#5a606b'],
};

function draw() {
  const P = Pix(W, H);

  // ================= PANTS (cargo, baggy, slightly tapered into stacked hems) =================
  const legL = [[49, 124], [72, 124], [70.5, 146], [67.5, 165], [45, 165], [45.5, 149]];
  P.part('legL').poly(legL, C.cg[2]);
  P.part('legR').poly(mp(legL), C.cg[2]);
  for (const side of [0, 1]) {
    const X = (x) => (side ? m(x) : x), lit = side === 0;
    P.part(side ? 'legR' : 'legL').clip(side ? 'legR' : 'legL');
    // volume: outer edge lit on the left leg, inner thigh in shadow on both
    for (let y = 124; y < 166; y++) for (let x = 44; x < 74; x++) {
      const xx = X(x), inner = x > 64 + (y - 132) * 0.12, outer = x < 52;
      if (inner) P.tint(xx, y, lit ? C.cg[3] : C.cg[3]); else if (outer) P.tint(xx, y, lit ? C.cg[1] : C.cg[2]); else if (!lit && x < 58) P.tint(xx, y, C.cg[3]);
    }
    // cargo pocket on the outer thigh: body, flap, button, side pleat
    const pk = [[46.5, 145], [56.5, 145], [57, 158], [47.5, 158]];
    P.poly(side ? mp(pk) : pk, lit ? C.cg[1] : C.cg[2]);
    P.path(side ? mp([[47, 158], [57, 158], [56.5, 145]]) : [[47, 158], [57, 158], [56.5, 145]], C.cg[4]);
    const fl = [[46, 143], [57.5, 143], [57.5, 147], [46.5, 147]]; P.poly(side ? mp(fl) : fl, lit ? C.cg[0] : C.cg[1]);
    P.line(X(46.5), 147, X(57.5), 147, C.cg[4]); P.set(X(52), 145, C.cg[4]); P.set(X(52), 144, lit ? C.cg[0] : C.cg[1]);
    P.line(X(48), 150, X(48), 156, lit ? C.cg[0] : C.cg[1]);
    // seam down the outer leg + knee creases
    P.line(X(47), 136, X(46.5), 143, C.cg[3]);
    P.path(side ? mp([[58, 156], [62, 158], [66, 157]]) : [[58, 156], [62, 158], [66, 157]], C.cg[3]);
    P.path(side ? mp([[59, 159], [63, 160]]) : [[59, 159], [63, 160]], lit ? C.cg[1] : C.cg[2]);
    // stacked hem folds
    for (const [y, a, b] of [[161, 49, 60], [163, 55, 70], [162, 62, 69]]) P.line(X(a), y, X(b), y, C.cg[3]);
    for (const [y, a, b] of [[160, 50, 58], [162, 56, 66]]) P.line(X(a), y, X(b), y, lit ? C.cg[1] : C.cg[2]);
    P.clip(null);
  }
  // crotch / leg split shadow
  P.part('legR').line(72, 125, 72, 146, C.cg[4]);

  // ================= SNEAKERS (chunky red/white high-tops, toes angled out) =================
  for (const side of [0, 1]) {
    const sh = (a) => a.map(([x, y]) => [x - 3, y]), X = (x) => (side ? m(x - 3) : x - 3), pts = (a) => (side ? mp(sh(a)) : sh(a)), lit = side === 0, nm = side ? 'shoeR' : 'shoeL';
    P.part(nm);
    // collar/heel counter peeking under the hem
    P.poly(pts([[50, 161], [67, 161], [68, 166], [49, 166]]), C.rd[lit ? 1 : 2]);
    // upper
    const up = [[49, 164], [67, 164], [70.5, 168], [71.5, 173], [70, 176], [48, 176], [44, 173], [44.5, 168]];
    P.poly(pts(up), C.wt[1]);
    P.clip(nm);
    // red overlays: outer quarter, inner quarter, toe bumper stripe, heel tab
    P.poly(pts([[44, 167], [50, 164.5], [52.5, 171], [46, 174.5]]), C.rd[lit ? 1 : 2]);
    P.poly(pts([[66, 164.5], [70.5, 168], [69, 172], [64.5, 170]]), C.rd[2]);
    P.poly(pts([[46.5, 173], [70.5, 172.5], [70, 174], [47, 174.5]]), C.rd[lit ? 1 : 2]);
    // lace field: red eyestays + white laces on a dark tongue
    P.poly(pts([[52.5, 163.5], [64.5, 163.5], [63.5, 170], [53.5, 170]]), C.rd[lit ? 0 : 1]);
    P.poly(pts([[54.5, 163.5], [62.5, 163.5], [62, 169.5], [55, 169.5]]), C.bk[2]);
    for (let k = 0; k < 3; k++) { const y = 164 + k * 2; P.line(X(55), y, X(62), y, C.wt[k === 0 ? 0 : 1]); P.set(X(54), y, C.sv[2]); P.set(X(63), y, C.sv[2]); }
    P.line(X(57), 162, X(60), 162, C.wt[0]); P.line(X(57), 161, X(60), 161, C.rd[3]); // tongue label (blank)
    // toe box: white, perforations, crease
    P.poly(pts([[53, 170], [65, 170], [68, 172.5], [50, 172.5]]), lit ? C.wt[0] : C.wt[1]);
    for (const x of [55, 58, 61, 64]) P.set(X(x), 171, C.wt[3]);
    P.line(X(51), 172, X(67), 172, C.wt[2]);
    // shade: right half of each shoe falls away from the light
    P.shade((x, y) => (side ? x > 92 : x > 59) && y > 166, { [C.wt[0]]: C.wt[2], [C.wt[1]]: C.wt[2], [C.rd[1]]: C.rd[2], [C.rd[0]]: C.rd[1] });
    P.clip(null);
    // midsole + outsole (wider than the upper)
    P.poly(pts([[44, 174], [71.5, 174], [72, 176.5], [70.5, 178], [45.5, 178], [43, 176.5]]), C.wt[1]);
    P.clip(nm).shade((x, y) => y >= 174, { [C.wt[1]]: C.wt[1] });
    P.line(X(45), 176, X(70.5), 176, C.wt[3]); P.line(X(46), 175, X(52), 175, C.wt[0]);
    P.clip(null);
  }

  P.off(0, -6); // upper body sits 6 px higher: longer legs, ~4 heads tall
  // ================= TEE (white, crew neck, hem shows under the open jacket) =================
  P.part('tee').poly([[63, 92], [81, 92], [80.5, 138], [63.5, 138]], C.wt[1]);
  P.clip('tee');
  P.rect(63, 92, 4, 47, C.wt[0], true); P.rect(77, 92, 5, 47, C.wt[2], true);
  P.shade((x, y) => y < 98, { [C.wt[0]]: C.wt[2], [C.wt[1]]: C.wt[2], [C.wt[2]]: C.wt[3] }); // collar shadow
  P.line(64, 134, 80, 134, C.wt[2]); P.line(66, 137, 79, 137, C.wt[3]);                     // hem fold
  P.path([[67, 116], [70, 121], [69, 127]], C.wt[2]);                                         // drape fold
  P.clip(null);

  // ================= JACKET BODY (orange puffer bomber, black side panels + ribbed hem) =================
  const body = [[48, 96], [59, 91], [65.5, 91], [66.5, 136], [48.5, 136], [47.5, 129], [45.5, 118], [46, 106]];
  P.part('jacketL').poly(body, C.or[2]);
  P.part('jacketR').poly(mp(body), C.or[2]);
  for (const side of [0, 1]) {
    const X = (x) => (side ? m(x) : x), pts = (a) => (side ? mp(a) : a), lit = side === 0, nm = side ? 'jacketR' : 'jacketL';
    P.part(nm).clip(nm);
    const O = lit ? [C.or[1], C.or[2], C.or[3]] : [C.or[2], C.or[3], C.or[4]];
    // three quilted puffer baffles: lit crown, base, shadowed bottom edge + stitch line
    const baffles = [[91, 104], [104, 117], [117, 129]];
    for (const [a, b] of baffles) {
      for (let y = a; y < b; y++) for (let x = 44; x < 67; x++) { const t = (y - a) / (b - a); P.tint(X(x), y, t < 0.3 ? O[0] : t < 0.78 ? O[1] : O[2]); }
      P.line(X(45), b, X(66), b - 1, C.or[4]);
    }
    if (lit) { P.line(48, 93, 58, 92, C.or[0]); P.line(49, 106, 60, 105, C.or[0]); P.line(49, 119, 59, 118, C.or[0]); } // gloss on the lit baffles
    // black side panel from the underarm down
    P.poly(pts([[44, 106], [53, 104.5], [53.5, 129], [44, 129]]), lit ? C.bk[2] : C.bk[3]);
    P.line(X(53), 105, X(53.5), 129, lit ? C.bk[1] : C.bk[2]);
    // welt pockets: chest (left only) + lower hand-warmer pockets, stitched
    if (lit) { P.line(55, 101, 61, 98, C.bk[3]); P.line(55, 102, 61, 99, C.or[0]); }
    P.line(X(55), 125, X(60), 115, C.or[4]); P.line(X(56), 125, X(61), 115, lit ? C.or[1] : C.or[3]);
    // ribbed hem band
    P.rect(Math.min(X(48), X(66)), 129, 19, 7, C.bk[2]);
    for (let x = 49; x < 66; x += 2) P.line(X(x), 130, X(x), 135, lit ? C.bk[1] : C.bk[3]);
    P.line(X(48), 129, X(66), 129, C.bk[1]);
    // zipper tape + teeth on the front edge
    P.line(X(65), 92, X(66), 135, C.bk[3]);
    for (let y = 93; y < 135; y++) P.set(X(y % 2 ? 65 : 66), y, y % 2 ? C.sv[1] : C.sv[2]);
    P.clip(null);
  }
  // zipper pull on the left panel
  P.part('jacketL').rect(64, 112, 2, 5, C.sv[1]).set(64, 116, C.sv[2]).set(65, 116, C.sv[3]).set(64, 112, C.sv[0]);

  // ================= COLLAR (black stand collar, orange tipping) =================
  const col = [[57, 89], [64.5, 87], [66.5, 95], [60, 98]];
  P.part('collarL').poly(col, C.bk[2]); P.clip('collarL').line(58, 89, 64, 87.5, C.or[1]).line(58, 90, 65, 88.5, C.bk[0]).line(59, 92, 65.5, 90, C.bk[1]).clip(null);
  P.part('collarR').poly(mp(col), C.bk[3]); P.clip('collarR').line(m(58), 89, m(64), 87.5, C.or[2]).line(m(58), 90, m(65), 88.5, C.bk[1]).clip(null);

  // ================= ARMS (puffy sleeves: orange upper, white stripe, black forearm, ribbed cuff) =================
  for (const side of [0, 1]) {
    const X = (x) => (side ? m(x) : x), pts = (a) => (side ? mp(a) : a), lit = side === 0, nm = side ? 'armR' : 'armL';
    const sleeve = [[49, 93], [54, 95.5], [55.5, 104], [55, 112], [53.5, 117], [53.5, 124], [53, 131], [43, 131.5], [40.5, 122], [38.5, 113], [38.5, 105], [40.5, 98], [44, 94.5]];
    P.part(nm).poly(pts(sleeve), C.or[2]);
    P.clip(nm);
    const O = lit ? C.or : [C.or[1], C.or[2], C.or[3], C.or[4], C.or[4]];
    for (let y = 94; y < 132; y++) for (let x = 38; x < 58; x++) { const xx = X(x); if (x < 44) P.tint(xx, y, lit ? O[1] : O[2]); else if (x > 51) P.tint(xx, y, O[3]); else P.tint(xx, y, O[2]); }
    if (lit) P.path([[43, 99], [42, 106], [42, 112]], C.or[0]);
    P.path(pts([[41, 108], [47, 110], [54, 108]]), O[3]);           // puffer baffle line on the upper arm
    // stripe + black forearm + elbow crease
    P.poly(pts([[39.5, 116], [55, 115], [55, 118], [39.5, 119]]), lit ? C.wt[0] : C.wt[2]);
    P.poly(pts([[39.5, 119], [55, 118], [54, 131], [40.5, 131]]), lit ? C.bk[2] : C.bk[3]);
    P.line(X(41), 120, X(41), 129, lit ? C.bk[1] : C.bk[2]);
    P.path(pts([[46, 122], [49, 124], [52, 123]]), C.bk[4]); P.path(pts([[44, 126], [47, 127]]), C.bk[4]);
    P.path(pts([[42, 112], [46, 114], [50, 113]]), O[3]); P.path(pts([[48, 102], [52, 101]]), lit ? O[1] : O[2]);
    P.clip(null);
    // ribbed cuff
    P.part(nm).poly(pts([[42.5, 130], [53, 130], [52.5, 135], [43, 135]]), C.bk[3]);
    P.clip(nm); for (let x = 44; x < 53; x += 2) P.line(X(x), 131, X(x), 134, C.bk[lit ? 1 : 2]); P.clip(null);
  }

  // ================= HANDS (relaxed fists, thumbs forward) =================
  for (const side of [0, 1]) {
    const X = (x) => (side ? m(x) : x), pts = (a) => (side ? mp(a) : a), lit = side === 0, nm = side ? 'handR' : 'handL';
    P.part(nm).poly(pts([[43.5, 134], [52, 134], [53.5, 137], [53, 141], [50.5, 143.5], [45.5, 143.5], [43, 141], [42.5, 137]]), C.sk[lit ? 1 : 2]);
    P.clip(nm);
    P.line(X(43), 135, X(43), 140, lit ? C.sk[0] : C.sk[1]);
    P.path(pts([[44, 140], [47, 141], [50, 140]]), C.sk[3]);         // finger line
    for (const x of [46, 48.5]) P.line(X(x), 141, X(x), 143, C.sk[3]);
    P.path(pts([[49, 136], [51, 137], [51, 139]]), C.sk[3]);         // thumb crease
    P.line(X(44), 142, X(51), 142, C.sk[3]);
    P.clip(null);
  }
  // sport watch on the left wrist (screen right): strap, steel case, face
  P.part('watch').rect(m(53), 133, 11, 3, C.bk[3]).rect(m(50), 132, 5, 5, C.sv[2]).rect(m(49), 133, 3, 3, C.bk[4]).set(m(49), 133, C.sv[0]).set(m(48), 134, '#3ad6a0');

  // ================= NECK =================
  P.part('neck').poly([[65, 85], [79, 85], [79.5, 95], [64.5, 95]], C.sk[2]);
  P.clip('neck').rect(65, 85, 14, 4, C.sk[3], true).line(66, 94, 78, 94, C.sk[3]).clip(null);
  // crew-neck rib over the neck base
  P.part('teeNeck').path([[63, 92], [66, 95], [72, 96], [78, 95], [81, 92]], C.wt[1]).path([[64, 93], [67, 96], [72, 97], [77, 96], [80, 93]], C.wt[2]);

  // ================= HEAD (rounded skull, defined jaw, ears) =================
  P.part('earL').ell(56, 75, 3.6, 5.2, C.sk[2]); P.clip('earL').line(56, 73, 56, 77, C.sk[3]).clip(null);
  P.part('earR').ell(88, 75, 3.6, 5.2, C.sk[3]); P.clip('earR').line(88, 73, 88, 77, C.sk[4]).clip(null);
  P.part('head').ell(72, 72, 16.5, 16.5, C.sk[1]).poly([[57.5, 76], [86.5, 76], [83, 85.5], [77, 89.5], [67, 89.5], [61, 85.5]], C.sk[1]);
  P.clip('head');
  P.shade((x, y) => x > 79 || y > 86, { [C.sk[1]]: C.sk[2] });             // right side + under-jaw falloff
  P.shade((x, y) => x > 84, { [C.sk[2]]: C.sk[3] });
  P.path([[59, 70], [59, 78], [61, 82]], C.sk[0]);                          // cheekbone light
  P.rect(56, 60, 34, 10, C.sk[3], true);                                     // cap-brim shadow band on the forehead
  P.line(58, 70, 86, 70, C.sk[2]);
  // brows, eyes (white + iris + catch light), nose, mouth
  P.line(62, 71, 67, 70.5, C.hr[1]); P.line(77, 70.5, 82, 71, C.hr[1]);
  for (const [ex, lit] of [[63, true], [77, false]]) {
    P.rect(ex, 74, 5, 4, C.wt[lit ? 1 : 2]); P.rect(ex + 1, 74, 3, 4, '#4a3324'); P.rect(ex + 2, 75, 2, 2, C.ink); P.set(ex + 1, 74, C.wt[0]);
    P.line(ex - 1, 73, ex + 5, 73, C.sk[4]); P.line(ex, 78, ex + 4, 78, C.sk[2]);
  }
  P.path([[72, 76], [72, 80], [74, 81]], C.sk[3]); P.set(71, 81, C.sk[2]); P.set(70, 80, C.sk[0]);
  P.line(68, 84, 76, 84, C.sk[4]); P.line(69, 85, 75, 85, C.sk[2]); P.set(67, 83, C.sk[3]); P.set(77, 83, C.sk[3]);
  P.clip(null);
  // sideburns + fade under the cap
  P.part('hair').poly([[55.5, 62], [60, 62], [60, 74], [57.5, 72]], C.hr[1]).poly(mp([[55.5, 62], [60, 62], [60, 74], [57.5, 72]]), C.hr[2]);
  P.clip('hair').line(57, 64, 57, 70, C.hr[0]).clip(null);

  // ================= CAP (black six-panel, curved brim, button, blank woven tab) =================
  P.part('cap').clip((x, y) => y <= 62).ell(72, 60, 19.5, 18, C.bk[2]).clip(null);
  P.clip('cap');
  for (let y = 43; y < 64; y++) for (let x = 52; x < 93; x++) { const d = (x - 64) * 0.7 + (y - 50) * 0.5; if (d < -6) P.tint(x, y, C.bk[1]); else if (d > 9) P.tint(x, y, C.bk[3]); }
  P.path([[64, 46], [60, 52], [58, 62]], C.bk[0]); P.path([[72, 43], [72, 61]], C.bk[3]); P.path([[80, 46], [84, 53], [86, 62]], C.bk[4]);
  P.clip(null);
  P.part('cap').rect(71, 42, 3, 2, C.bk[1]).set(71, 42, C.bk[0]);              // button
  P.part('capTab').rect(68, 54, 9, 5, C.or[2]).rect(69, 55, 7, 3, C.or[1]).line(69, 57, 75, 57, C.or[3]);
  // brim: curved, projecting toward the camera; top face lit, underside dark
  P.part('brim').poly([[53, 59.5], [91, 59.5], [93, 62.5], [90, 66.5], [83, 70.5], [72, 72.5], [61, 70.5], [54, 66.5], [51, 62.5]], C.bk[2]);
  P.clip('brim');
  // top surface (what a high camera sees): lit toward the upper left, a crisp lit front rim, thin dark underside
  P.shade((x, y) => x < 70, { [C.bk[2]]: C.bk[1] });
  P.path([[53, 60], [72, 61], [91, 60]], C.bk[3]);                                   // crease where brim meets crown
  P.path([[52, 63], [55, 66], [61, 69], [72, 71], [83, 69], [89, 66], [92, 63]], C.bk[0]); // front rim highlight
  P.path([[56, 68], [62, 71], [72, 73], [82, 71], [88, 68]], C.ink);                 // underside lip
  P.path([[57, 64], [64, 66], [72, 67]], '#6c7282');
  P.clip(null);

  // ================= CHAIN (gold curb links + small pendant) =================
  P.part('chain');
  const ch = [[66, 95], [67, 98], [68, 101], [70, 104], [72, 105], [74, 104], [76, 101], [77, 98], [78, 95]];
  for (let i = 0; i + 1 < ch.length; i++) P.line(ch[i][0], ch[i][1], ch[i + 1][0], ch[i + 1][1], i % 2 ? C.gd[2] : C.gd[1]);
  for (const [x, y] of [[67, 98], [70, 104], [76, 101]]) P.set(x, y, C.gd[0]);
  P.rect(71, 106, 3, 4, C.gd[1]).set(71, 106, C.gd[0]).set(73, 109, C.gd[3]);

  P.off(0, 0);
  P.paint(C, { gain: 8, vgrad: 2.5, parts: {
    legL: { r: 8 }, legR: { r: 8 }, shoeL: { r: 4, gloss: true }, shoeR: { r: 4, gloss: true }, tee: { r: 6 },
    jacketL: { r: 9, gloss: true }, jacketR: { r: 9, gloss: true }, collarL: { r: 3 }, collarR: { r: 3 },
    armL: { r: 7, gloss: true }, armR: { r: 7, gloss: true }, handL: { r: 4 }, handR: { r: 4 }, watch: { flat: true },
    neck: { r: 5 }, teeNeck: { flat: true }, earL: { r: 3 }, earR: { r: 3 }, head: { r: 11 }, hair: { r: 3 },
    cap: { r: 13, gloss: true }, capTab: { flat: true }, brim: { r: 4, gloss: true }, chain: { flat: true } } });
  P.contour(C.ink, 0.6, ['chain', 'teeNeck', 'capTab', 'watch']);
  return P;
}

module.exports = { draw, W, H, ORIGIN: [CX, FOOT], PALETTE: C };
if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path'), { preview } = require('./pix.cjs');
  const out = process.argv[2] || 'art/o3-master', P = draw(); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'master_player_streetwear.png'), P.png());
  const pv = preview(P.rgba(), W, H, 4); fs.writeFileSync(path.join(out, 'preview_player.png'), pv.png);
  console.log('player', W + 'x' + H, 'bbox', JSON.stringify(P.bbox()), 'colours', P.colours());
}
