// Option 3 MASTER: Vanta GT purple widebody coupe, TOP-DOWN (the game camera), nose RIGHT. 168x90 art px on the
// shared 3 px/world grid (Vanta GT is 55x29 world). Light from the upper left. Body width follows a hand-set
// plan-view profile (rear flare → doors → front flare → nose); cabin glass, carbon hood, wing, lamps on top.
'use strict';
const { Pix } = require('./pix.cjs');
const W = 168, H = 90, CY = 44.5;
const C = {
  ink: '#110c18',
  pu: ['#e2b8ff', '#c08af7', '#9d55e6', '#8a3fd6', '#6c2bb3', '#4c1c86', '#311257'],
  cf: ['#4a4d57', '#33353d', '#24262c', '#18191e', '#101114'],      // carbon / black trim
  gl: ['#c9dcff', '#7e94c4', '#3f4f78', '#252f4d', '#171d33'],      // glass
  ic: ['#ffffff', '#e4fbff', '#9fe6ff', '#4fb8e8'],                 // ice headlights
  rd: ['#ffd1c9', '#ff5a52', '#d11f35', '#7e1028'],
  ch: ['#f2f4f8', '#b8bec8', '#7c838f'],
};
// plan-view half-width of the body along x (rear = 0, nose = 167)
const PROFILE = [[0, 27], [1.5, 33], [5, 37.5], [12, 40.5], [22, 44], [38, 44], [48, 40], [56, 38], [104, 38], [114, 39], [124, 43.5], [142, 44], [151, 41.5], [158, 37], [163, 31], [166, 23], [167.5, 12]];
const hw = (x) => { for (let i = 0; i + 1 < PROFILE.length; i++) { const [a, ha] = PROFILE[i], [b, hb] = PROFILE[i + 1]; if (x >= a && x <= b) return ha + ((x - a) / (b - a)) * (hb - ha); } return 0; };
const outline = (prof, cy = CY) => [...prof.map(([x, h]) => [x, cy - h]), ...prof.slice().reverse().map(([x, h]) => [x, cy + h])];
// cabin glass-house half-width
const CAB = [[36, 21], [46, 25.5], [57, 28.5], [96, 29.5], [108, 31.5], [121, 33.5]];
const cw = (x) => { for (let i = 0; i + 1 < CAB.length; i++) { const [a, ha] = CAB[i], [b, hb] = CAB[i + 1]; if (x >= a && x <= b) return ha + ((x - a) / (b - a)) * (hb - ha); } return 0; };

function draw() {
  const P = Pix(W, H);
  // tyres peeking past the widebody flares (dark rubber + rim lip)
  P.part('tyres');
  for (const [x0, x1] of [[20, 42], [128, 150]]) for (const s of [-1, 1]) { const y = s < 0 ? CY - hw((x0 + x1) / 2) - 1.5 : CY + hw((x0 + x1) / 2) - 0.5; P.rect(x0 + 2, Math.round(y), x1 - x0 - 4, 3, C.cf[3]); }

  // ---- body shell ----
  P.part('body').poly(outline(PROFILE), C.pu[3]);
  P.clip('body');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const h = hw(x + 0.5); if (!h) continue; const d = (y + 0.5 - CY) / h, a = Math.abs(d);
    let c = C.pu[3];
    if (a > 0.9) c = d < 0 ? C.pu[4] : C.pu[5];                 // body side curving away
    else if (a > 0.78) c = d < 0 ? C.pu[2] : C.pu[4];           // shoulder line (upper side catches the light)
    else if (d > 0.35) c = C.pu[4];
    else if (d < -0.45) c = C.pu[2];
    P.tint(x, y, c);
  }
  // specular shoulder streaks + flare crowns
  P.path([[56, CY - 0.84 * 38], [104, CY - 0.84 * 38]], C.pu[1]); P.path([[60, CY - 0.84 * 38 - 1], [86, CY - 0.84 * 38 - 1]], C.pu[0]);
  P.path([[18, 9], [26, 6], [36, 6], [44, 8]], C.pu[1]); P.path([[124, 7], [132, 5], [142, 5], [150, 7]], C.pu[1]);
  P.path([[20, 8], [30, 7]], C.pu[0]); P.path([[128, 6], [138, 5.5]], C.pu[0]);
  P.path([[18, 80], [26, 83], [36, 83], [44, 81]], C.pu[5]); P.path([[124, 82], [132, 84], [142, 84], [150, 82]], C.pu[5]);
  // flare seams (riveted overfenders) + rivets
  for (const [a, b] of [[14, 48], [120, 154]]) for (const s of [-1, 1]) { const pts = []; for (let x = a; x <= b; x += 2) pts.push([x, CY + s * (hw(x) - 4.5)]); P.path(pts, s < 0 ? C.pu[4] : C.pu[6]); for (let x = a + 3; x < b; x += 8) P.set(x, Math.round(CY + s * (hw(x) - 3)), C.ch[1]); }
  // door shut lines, side intakes, handles
  for (const s of [-1, 1]) {
    const yy = (k) => CY + s * k; P.line(62, yy(33), 62, yy(39), C.pu[6]); P.line(102, yy(33), 103, yy(39), C.pu[6]);
    P.rect(82, Math.round(yy(36)) - (s < 0 ? 0 : 1), 5, 2, s < 0 ? C.pu[1] : C.pu[5]).set(82, Math.round(yy(36)), C.cf[2]);
    P.poly([[110, yy(36)], [118, yy(37.5)], [118, yy(39.5)], [111, yy(39)]], C.cf[3]);
  }
  P.clip(null);

  // ---- carbon hood with a raised centre bulge and twin vents ----
  P.part('hood').poly([[121, CY - 33], [150, CY - 31], [158, CY - 27], [162, CY - 17], [163, CY], [162, CY + 17], [158, CY + 27], [150, CY + 31], [121, CY + 33]], C.cf[2]);
  P.clip('hood');
  for (let y = 0; y < H; y++) for (let x = 121; x < 164; x++) if ((x + 2 * y) % 5 === 0) P.tint(x, y, C.cf[1]);   // fine diagonal twill
  P.shade((x, y) => y > CY + 16, { [C.cf[1]]: C.cf[2], [C.cf[2]]: C.cf[3] });
  P.poly([[124, CY - 9], [156, CY - 7], [156, CY + 7], [124, CY + 9]], C.cf[1]);                          // power bulge
  P.line(124, CY - 9, 156, CY - 7, C.cf[0]); P.line(124, CY + 9, 156, CY + 7, C.cf[3]);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const x = 132 + k * 4; P.line(x, CY + s * 14, x + 2, CY + s * 22, C.cf[4]); P.line(x + 1, CY + s * 14, x + 3, CY + s * 22, s < 0 ? C.cf[0] : C.cf[2]); }
  P.clip(null);

  // ---- centre racing stripe over the trunk ----
  P.part('stripe').poly([[3, CY - 8], [36, CY - 8], [36, CY + 8], [3, CY + 8]], C.cf[2]);
  P.clip('stripe').line(3, CY - 8, 36, CY - 8, C.cf[0]).line(3, CY - 6, 36, CY - 6, C.pu[2]).line(3, CY + 6, 36, CY + 6, C.pu[4]).clip(null);

  // ---- glass house: rear window, roof, windshield ----
  P.part('glass').poly(outline(CAB.map(([x, h]) => [x, h])), C.gl[3]);
  P.part('roof').poly(outline([[56, 27.5], [96, 28.5]]).map(([x, y], i) => [x + (i === 0 || i === 3 ? 2 : -1), y]), C.pu[3]);
  P.clip('roof');
  for (let y = 0; y < H; y++) for (let x = 54; x < 98; x++) { const d = (y + 0.5 - CY) / 28; P.tint(x, y, d < -0.55 ? C.pu[2] : d > 0.6 ? C.pu[4] : C.pu[3]); }
  P.path([[60, CY - 22], [92, CY - 22]], C.pu[1]); P.path([[64, CY - 23], [80, CY - 23]], C.pu[0]);
  P.line(58, CY - 8, 94, CY - 8, C.pu[2]); P.line(58, CY + 8, 94, CY + 8, C.pu[4]);                  // roof channels
  P.clip(null);
  P.clip('glass');
  // windshield: lighter near the top, a crisp diagonal reflection band; rear glass darker with its own streak
  for (let y = 0; y < H; y++) for (let x = 96; x < 122; x++) P.tint(x, y, x > 117 ? C.cf[3] : y < CY - 14 ? C.gl[2] : y > CY + 16 ? C.gl[4] : C.gl[3]);
  P.line(117, CY - 33, 117, CY + 33, C.cf[1]);
  P.poly([[102, CY - 30], [108, CY - 31], [116, CY + 6], [110, CY + 6]], C.gl[1]); P.line(106, CY - 31, 113, CY + 1, C.gl[0]);
  P.poly([[112, CY + 10], [116, CY + 10], [120, CY + 30], [117, CY + 31]], C.gl[2]);
  for (let y = 0; y < H; y++) for (let x = 34; x < 56; x++) P.tint(x, y, y > CY + 10 ? C.gl[4] : C.gl[3]);
  P.poly([[40, CY - 22], [44, CY - 24], [50, CY - 4], [46, CY - 4]], C.gl[2]); P.line(43, CY - 23, 48, CY - 7, C.gl[1]);
  for (let x = 38; x < 54; x += 3) P.set(x, Math.round(CY + 2), C.gl[2]);                           // rear demister lines
  P.clip(null);
  // A/C pillars + roof rails
  for (const s of [-1, 1]) { P.part('glass').path([[96, CY + s * 30.5], [121, CY + s * 35]], C.pu[s < 0 ? 2 : 5]); P.path([[56, CY + s * 29.5], [34, CY + s * 22]], C.pu[s < 0 ? 2 : 5]); }

  // ---- lamps ----
  for (const s of [-1, 1]) {
    const yy = (k) => CY + s * k;
    P.part('lamps').poly([[150, yy(38)], [159, yy(34)], [164, yy(27)], [161, yy(25.5)], [152, yy(33)]], C.ic[2]);
    P.clip('lamps').line(152, yy(35), 161, yy(28), C.ic[0]).line(151, yy(36.5), 156, yy(34), C.ic[1]).clip(null);
    P.part('lamps').poly([[2, yy(30)], [5, yy(37)], [10, yy(40)], [12, yy(37)], [5, yy(31)]], C.rd[2]);
    P.clip('lamps').line(4, yy(32), 9, yy(37.5), C.rd[1]).set(6, Math.round(yy(35)), C.rd[0]).clip(null);
  }
  // front intake + splitter, quad exhaust tips
  P.part('trim').poly([[163.5, CY - 14], [166.5, CY - 12], [166.5, CY + 12], [163.5, CY + 14]], C.cf[3]);
  P.clip('trim'); for (let y = Math.round(CY - 12); y < CY + 12; y += 2) P.set(165, y, C.cf[1]); P.clip(null);
  for (const y of [CY - 13, CY - 9, CY + 8, CY + 12]) P.part('exhaust').rect(0, Math.round(y) - 1, 2, 3, C.ch[1]).set(0, Math.round(y), C.cf[4]);

  // ---- side mirrors ----
  for (const s of [-1, 1]) P.part('mirrors').poly([[110, CY + s * 38], [114, CY + s * 38], [116, CY + s * 43.5], [111, CY + s * 44]], s < 0 ? C.pu[2] : C.pu[5]);

  // ---- GT wing on stalks (over the trunk), carbon with lit leading edge + endplates ----
  P.part('wingShadow').clip('body').rect(16, 5, 4, 80, C.pu[5]).clip(null);
  P.part('wing').poly([[7, 5], [16, 5], [16, 85], [7, 85]], C.cf[2]);
  P.clip('wing'); P.line(15, 6, 15, 84, C.cf[0]); P.line(14, 6, 14, 84, C.cf[1]); P.line(8, 6, 8, 84, C.cf[3]); for (let y = 8; y < 84; y += 4) P.set(11, y, C.cf[1]); P.clip(null);
  for (const y of [3, 84]) P.part('wing').rect(5, y, 13, 3, C.cf[3]).line(6, y, 16, y, C.cf[1]);

  P.contour(C.ink, 0.55, ['wingShadow', 'stripe', 'roof', 'exhaust']);
  return P;
}

module.exports = { draw, W, H, PALETTE: C };
if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path'), { preview } = require('./pix.cjs');
  const out = process.argv[2] || 'art/o3-master', P = draw(); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'master_vanta_gt_top.png'), P.png());
  fs.writeFileSync(path.join(out, 'preview_vanta.png'), preview(P.rgba(), W, H, 4).png);
  console.log('vanta', W + 'x' + H, 'bbox', JSON.stringify(P.bbox()), 'colours', P.colours());
}
