/* Premium modular weapon sprites + the Weapon Inspection bench (Claude-owned).
 * One asset definition per gun drives every view: the held gun in the world, inventory/bench icons and the
 * inspection screen. Guns are built from shaded parts on a pixel grid (side view, muzzle right):
 *   - each part is filled, then auto-bevelled against its own silhouette (light from the top-left, dark bottom/right),
 *   - paint jobs re-tint the metal/polymer parts (wood and accents stay), camo is a stable per-pixel pattern,
 *   - attachments snap to anchor points on each gun (muzzle, rail, under-barrel, magwell) so they're visible everywhere,
 *   - a 1px ink outline finishes the sprite. Sprites are cached by (gun, paint, mods).
 * World scale: 1 grid px = 0.5 world px (a rifle is ~30 world px, a pistol ~13), anchored at the firing hand.
 * API: NightshiftWeaponArt.{sprite, icon, drawHeld, inspect, closeInspect, GUNS, anchors} */
(function (root) {
  'use strict';
  const INK = '#0b0e12';
  // 4-tone ramps: dark, base, light, specular
  const MAT = {
    steel: ['#1b2229', '#303a44', '#4b5864', '#8b9aa7'], dark: ['#121519', '#1f2429', '#30373e', '#59626c'],
    poly: ['#15181c', '#23272d', '#343a42', '#59616b'], wood: ['#47281a', '#6c3f24', '#925a31', '#c3834d'],
    gold: ['#7a5413', '#b07d1e', '#d9a838', '#ffeaa6'], chrome: ['#59626a', '#959fa8', '#c8d0d6', '#ffffff'],
    rust: ['#43301f', '#644531', '#8a6347', '#b28c6a'], tape: ['#4d4a40', '#7a7565', '#a39d86', '#cfc8ae'],
    red: ['#5e1a1d', '#8e2b2c', '#c2443c', '#ff8a6a'], tan: ['#5b4a32', '#857050', '#ab9470', '#d8c39a'],
    olive: ['#262b1b', '#3c4429', '#56603a', '#87925e'], rubber: ['#0f1113', '#1a1d20', '#282c31', '#3d434a'],
  };
  const SKINNABLE = { steel: 1, poly: 1, rust: 1, dark: 0 };
  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const ramp = (base, hi) => [mix(base, '#000000', 0.45), base, mix(base, hi || '#ffffff', 0.32), mix(base, '#ffffff', 0.62)];

  // ---------------- pixel buffer + part painter ----------------
  const GW = 84, GH = 38; // grid (gun drawn with origin offset ox,oy so attachments have room)
  function Buf(skin) {
    const px = new Array(GW * GH).fill(null), b = { px, skin };
    const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < GW && y < GH) px[y * GW + x] = c; };
    const get = (x, y) => (x >= 0 && y >= 0 && x < GW && y < GH ? px[y * GW + x] : null);
    const noise = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const camoAt = (x, y) => { const v = noise(x >> 2, y >> 1) * 0.6 + noise(x >> 1, y >> 2) * 0.4; return v < 0.33 ? 0 : v > 0.72 ? 1 : -1; };
    function tones(mat) {
      if (Array.isArray(mat)) return mat;
      const r = MAT[mat] || MAT.steel; if (!skin?.pal || !SKINNABLE[mat]) return r;
      return mat === 'steel' ? ramp(skin.pal.st, skin.pal.hi) : ramp(skin.pal.sl, skin.pal.hi);
    }
    // Fill a mask, then bevel it: top/left edges lit (first stretch of the top edge gets the specular), bottom/right shaded.
    function part(mat, mask, opts = {}) {
      const T = tones(mat), set = new Set(mask.map(([x, y]) => x + ',' + y)), has = (x, y) => set.has(x + ',' + y);
      const camo = skin?.camo && SKINNABLE[mat] && !opts.noCamo;
      let minX = 1e9, maxX = -1e9; for (const [x] of mask) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
      for (const [x, y] of mask) {
        let t = 1; if (!has(x, y - 1)) t = (x - minX) < (maxX - minX) * 0.7 && !opts.matte ? 3 : 2; else if (!has(x, y + 1) || !has(x + 1, y)) t = 0; else if (!has(x - 1, y)) t = 2; else if (opts.cyl && !has(x, y - 2)) t = 2;
        if (opts.flat) t = t === 3 ? 2 : t;
        let c = T[t]; if (camo && t === 1 || camo && t === 2) { const k = camoAt(x, y); if (k >= 0) c = skin.camo[k]; }
        put(x, y, c);
      }
    }
    const rectMask = (x, y, w, h) => { const m = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) m.push([x + i, y + j]); return m; };
    function polyMask(pts) {
      const m = [], ys = pts.map((p) => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
      for (let y = y0; y < y1; y++) { const yc = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax)); }
        xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) m.push([x, y]); }
      return m;
    }
    b.R = (mat, x, y, w, h, o) => part(mat, rectMask(x, y, w, h), o);
    b.P = (mat, pts, o) => part(mat, polyMask(pts), o);
    // horizontal cylinder (barrels, tubes): banded highlight a third of the way down
    b.C = (mat, x, y, w, h) => { const T = tones(mat); for (let j = 0; j < h; j++) { const f = h <= 1 ? 0.3 : j / (h - 1), t = h <= 2 ? (j === 0 ? 2 : 1) : f < 0.2 ? 2 : f < 0.45 ? 3 : f > 0.8 ? 0 : 1; for (let i = 0; i < w; i++) put(x + i, y + j, T[t]); } put(x + w - 1, y + Math.floor(h / 2), T[0]); };
    b.L = (c, x, y, w = 1, h = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); };
    b.T = (mat, k) => tones(mat)[k];
    b.get = get; b.put = put;
    return b;
  }
  function outline(b) {
    const out = b.px.slice();
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { if (b.px[y * GW + x]) continue; let n = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < GW && yy < GH && b.px[yy * GW + xx] && b.px[yy * GW + xx] !== 'glow') n = true; }
      if (n) out[y * GW + x] = INK; }
    b.px = out;
  }

  // ---------------- gun builders ----------------
  // Every builder draws at an origin and returns anchors (grid coords): hand, muzzle, rail, under, mag.
  const OX = 18, OY = 10; // shared origin so all guns line up at the hand
  function guard(b, x, y, w) { const k = INK; b.L(k, x, y + 3, w, 1); b.L(k, x + w - 1, y, 1, 3); b.L(b.T('dark', 2), x + 2, y, 1, 2); }
  function handgun(b, o) {
    const x = OX, y = OY, L = o.len, sH = o.slideH || 4, sl = o.slideMat || 'steel', fr = o.frameMat || 'poly';
    if (o.revolver) {
      b.P(fr, [[x + 1, y + 4], [x + 6, y + 4], [x + 5, y + 12], [x + 1, y + 12], [x - 1, y + 10]]); // wood/rubber grip, curved back
      b.R(sl, x + 3, y, 9, 5); b.C('dark', x + 5, y + 1, 6, 3); for (let i = 0; i < 3; i++) b.L(b.T('dark', 3), x + 6 + i * 2, y + 1); // cylinder flutes
      b.C(sl, x + 12, y, L - 12, 3); b.R(sl, x + 12, y + 3, L - 15, 1); b.L(INK, x + 2, y - 1, 2, 1); b.L(b.T(sl, 2), x + L - 2, y - 1, 1, 1);
      guard(b, x + 5, y + 5, 5); b.L(INK, x + 7, y + 5, 1, 2);
      if (o.grips) { b.L(b.T(fr, 3), x + 2, y + 6, 1, 4); for (let i = 0; i < 3; i++) b.L(b.T(fr, 0), x + 3, y + 6 + i * 2); }
      return { hand: [x + 3, y + 7], muzzle: [x + L, y + 1], rail: [x + 9, y - 1], under: [x + L - 6, y + 4], mag: null, cyl: [x + 5, y + 1] };
    }
    const gripPts = [[x + 1, y + sH + 1], [x + 7, y + sH + 1], [x + 6, y + sH + 8], [x - 1, y + sH + 8]];
    const mag = o.mag || 0; if (mag) b.R('poly', x - 1 + (o.magX || 0), y + sH + 8, 6, mag, { matte: true }); // stick mag below the grip
    b.P(fr, gripPts, { matte: true }); for (let i = 0; i < 3; i++) b.L(b.T(fr, 0), x + 1 + (i % 2), y + sH + 3 + i * 2, 4, 1); // stippling
    b.R(fr, x + 1, y + sH, L - 3, 2); // frame / dust cover
    b.R(sl, x, y, L, sH); for (let i = 0; i < (o.serr || 3); i++) b.L(b.T(sl, 0), x + 1 + i * 2, y + 1, 1, sH - 2); // slide serrations
    b.L(INK, x + Math.round(L * 0.45), y + 1, Math.max(2, Math.round(L * 0.22)), 1); // ejection port
    b.L(b.T('dark', 3), x + 1, y - 1, 2, 1); b.L(b.T('dark', 3), x + L - 2, y - 1, 1, 1); // sights
    if (o.comp) { b.R('dark', x + L, y, 3, sH); b.L(INK, x + L + 1, y, 1, 2); }
    else b.C('dark', x + L, y + 1, 1, 2);
    guard(b, x + 6, y + sH + 1, 5); b.L(INK, x + 8, y + sH + 1, 1, 2);
    if (o.hammer) b.L(b.T('dark', 2), x - 1, y, 1, 2);
    return { hand: [x + 3, y + sH + 3], muzzle: [x + L + (o.comp ? 3 : 1), y + 1 + (sH > 3 ? 1 : 0)], rail: [x + Math.round(L * 0.4), y - 1], under: [x + L - 6, y + sH + 2], mag: mag ? [x + (o.magX || 0) - 1, y + sH + 8 + mag] : [x - 1, y + sH + 8] };
  }
  // long guns: receiver at origin, stock behind (negative x), barrel forward
  function longgun(b, o) {
    const x = OX, y = OY, rec = o.rec || 14, bar = o.bar || 14, hg = o.hg || 0, rm = o.recMat || 'steel', fm = o.furn || 'poly';
    // stock
    if (o.stock === 'wood') b.P(fm, [[x + 1, y], [x - 15, y + 2], [x - 16, y + 7], [x - 13, y + 8], [x + 1, y + 5]]);
    else if (o.stock === 'skel') { b.P(fm, [[x, y], [x - 12, y], [x - 13, y + 6], [x - 10, y + 6], [x - 9, y + 2], [x, y + 3]]); b.L(INK, x - 9, y + 3, 7, 1); b.R('rubber', x - 14, y, 2, 7); }
    else if (o.stock === 'tube') { b.R('dark', x - 9, y + 1, 9, 2); b.P(fm, [[x - 9, y - 1], [x - 15, y], [x - 15, y + 7], [x - 10, y + 6]]); b.R('rubber', x - 16, y, 1, 7); }
    else if (o.stock === 'fixed') { b.P(fm, [[x, y], [x - 14, y + 1], [x - 15, y + 7], [x - 9, y + 7], [x - 7, y + 4], [x, y + 4]]); b.R('rubber', x - 16, y + 1, 2, 6); for (let i = 0; i < 3; i++) b.L(b.T(fm, 0), x - 12 + i * 3, y + 3, 1, 2); }
    // pistol grip or wooden wrist
    if (!o.wrist) { b.P(fm, [[x + 2, y + 4], [x + 7, y + 4], [x + 5, y + 11], [x, y + 11]], { matte: true }); for (let i = 0; i < 3; i++) b.L(b.T(fm, 0), x + 2, y + 6 + i * 2, 3, 1); }
    // magazine
    let magEnd = null;
    if (o.mag === 'curved') { const ml = (o.magLen || 7); b.P('poly', [[x + 9, y + 5], [x + 13, y + 5], [x + 14 + ml * 0.35, y + 5 + ml], [x + 10 + ml * 0.35, y + 5 + ml]], { matte: true }); b.L(b.T('poly', 2), x + 10, y + 5 + ml - 1, 3, 1); magEnd = [x + 11 + ml * 0.35, y + 5 + ml]; }
    else if (o.mag === 'straight') { const ml = o.magLen || 6; b.R('poly', x + 9, y + 5, 4, ml, { matte: true }); magEnd = [x + 10, y + 5 + ml]; }
    else if (o.mag === 'box') { b.R('dark', x + 8, y + 5, 6, 3); magEnd = [x + 10, y + 8]; }
    // receiver
    b.R(rm, x, y, rec, 5); b.L(INK, x + 6, y + 1, 4, 1); // ejection port
    if (o.rail) { for (let i = 0; i < rec - 2; i += 2) b.L(b.T('dark', 2), x + 1 + i, y - 1, 1, 1); }
    if (o.carry) { b.R(rm, x + 3, y - 3, 8, 2); b.L(INK, x + 5, y - 1, 4, 1); }
    if (o.bolt) { b.L(b.T('dark', 2), x + 9, y + 3, 1, 2); b.L(b.T('chrome', 1), x + 8, y + 5, 2, 2); b.L(b.T('chrome', 3), x + 8, y + 5); }
    guard(b, x + 4, y + 5, 5); b.L(INK, x + 6, y + 5, 1, 2);
    // barrel + handguard
    const bx = x + rec; b.C('dark', bx, y + 1, bar, 2);
    if (o.tubeMag) b.C('steel', bx, y + 3, Math.round(bar * 0.75), 2);
    if (hg) {
      if (o.hgType === 'wood') b.P(fm === 'wood' ? 'wood' : fm, [[bx, y], [bx + hg, y + 1], [bx + hg, y + 5], [bx, y + 5]]);
      else if (o.hgType === 'pump') { b.R(fm, bx + 3, y + 3, hg, 3); for (let i = 0; i < hg - 1; i += 2) b.L(b.T(fm, 0), bx + 4 + i, y + 4, 1, 2); }
      else { b.R(fm, bx, y, hg, 5); for (let i = 2; i < hg - 1; i += 3) b.L(INK, bx + i, y + 2, 2, 1); if (o.rail) for (let i = 0; i < hg; i += 2) b.L(b.T('dark', 2), bx + i, y - 1, 1, 1); }
    }
    const end = bx + bar;
    if (o.brake) { b.R('dark', end, y, 4, 4); b.L(INK, end + 1, y, 1, 4); b.L(INK, end + 3, y, 1, 4); }
    else if (o.hider) { b.R('dark', end, y + 1, 2, 2); b.L(INK, end + 1, y + 1, 1, 1); }
    if (o.frontSight) b.L(b.T('dark', 2), end - 2, y - 1, 1, 1);
    const muzzle = [end + (o.brake ? 4 : o.hider ? 2 : 0), y + 2];
    return { hand: [x + 3, y + 7], muzzle, rail: [x + Math.round(rec / 2), y - 1], under: [bx + Math.max(2, Math.round((hg || bar) * 0.45)), y + 5], mag: magEnd, tube: o.tubeMag ? [bx + Math.round(bar * 0.75), y + 3] : null };
  }
  // integrated optic used by DMRs (and the scope mod on long guns)
  function optic(b, cx, ry, len = 14, mat = 'dark', lens = '#7cc7ff') {
    const x = cx - Math.round(len / 2); b.R('dark', x + 3, ry - 1, 2, 1); b.R('dark', x + len - 5, ry - 1, 2, 1); // rings
    b.C(mat, x, ry - 4, len, 3); b.R(mat, x + len - 3, ry - 5, 3, 5); b.R(mat, x, ry - 5, 2, 5); // tube, objective + ocular bells
    b.R(mat, x + Math.round(len / 2) - 1, ry - 6, 2, 2); // turret
    b.L(lens, x + len, ry - 4, 1, 3); b.L('#e8f6ff', x + len, ry - 4, 1, 1);
  }
  const GUNS = {
    pipe: (b) => { const x = OX, y = OY; b.P('wood', [[x - 1, y + 2], [x + 5, y + 2], [x + 4, y + 10], [x - 2, y + 10]]); b.C('rust', x, y, 18, 3); b.R('tape', x + 2, y - 1, 3, 5, { matte: true }); b.R('tape', x + 11, y - 1, 2, 5, { matte: true }); b.L(b.T('rust', 3), x + 7, y, 1, 1); b.L(INK, x + 17, y + 1); b.L('#9b9b8e', x + 6, y + 3, 1, 2); return { hand: [x + 1, y + 6], muzzle: [x + 18, y + 1], rail: [x + 8, y - 1], under: [x + 12, y + 3], mag: null }; },
    zip: (b) => { const x = OX, y = OY; b.P('wood', [[x, y + 3], [x + 6, y + 3], [x + 5, y + 10], [x - 1, y + 10]]); b.R('rust', x, y, 9, 4); b.C('steel', x + 9, y + 1, 7, 2); b.R('tape', x + 4, y - 1, 2, 6, { matte: true }); b.R('tape', x + 12, y, 2, 4, { matte: true }); b.R('poly', x + 6, y + 4, 3, 4); b.L(INK, x + 7, y + 4, 1, 2); return { hand: [x + 2, y + 6], muzzle: [x + 16, y + 2], rail: [x + 5, y - 1], under: [x + 11, y + 3], mag: [x + 7, y + 8] }; },
    sawnoff: (b) => { const x = OX, y = OY; b.P('wood', [[x + 1, y], [x - 7, y + 3], [x - 8, y + 9], [x - 3, y + 9], [x + 3, y + 5]]); b.R('steel', x, y - 1, 6, 6); b.C('dark', x + 6, y - 1, 13, 3); b.C('dark', x + 6, y + 2, 13, 3); b.R('wood', x + 6, y + 4, 7, 2); b.R('tape', x + 14, y - 1, 2, 6, { matte: true }); guard(b, x + 2, y + 5, 4); b.L(b.T('chrome', 2), x + 1, y - 2, 1, 1); return { hand: [x, y + 6], muzzle: [x + 19, y + 1], rail: [x + 10, y - 2], under: [x + 13, y + 6], mag: null }; },
    pistol: (b) => handgun(b, { len: 15, mag: 6 }),
    compact: (b) => handgun(b, { len: 11, slideH: 4, serr: 2, mag: 1 }),
    revolver: (b) => handgun(b, { len: 21, revolver: true, frameMat: 'wood', grips: true }),
    hawk: (b) => handgun(b, { len: 19, slideH: 5, serr: 4, hammer: true, slideMat: 'chrome' }),
    machine: (b) => { const a = handgun(b, { len: 14, mag: 7, comp: true }); b.R('poly', OX - 4, OY + 1, 4, 2); b.R('rubber', OX - 6, OY, 2, 4); return a; },
    pump: (b) => longgun(b, { rec: 11, bar: 19, hg: 8, hgType: 'pump', furn: 'wood', stock: 'wood', wrist: true, tubeMag: true, frontSight: true }),
    smg: (b) => longgun(b, { rec: 13, bar: 6, hg: 6, mag: 'straight', magLen: 8, stock: 'tube', rail: true, hider: true }),
    hunting: (b) => { const a = longgun(b, { rec: 14, bar: 22, hg: 10, hgType: 'wood', furn: 'wood', stock: 'wood', wrist: true, mag: 'box', bolt: true, frontSight: true }); return a; },
    shotgun: (b) => longgun(b, { rec: 13, bar: 17, hg: 9, hgType: 'pump', stock: 'fixed', tubeMag: true, rail: true, mag: null, frontSight: true }),
    carbine: (b) => longgun(b, { rec: 14, bar: 11, hg: 8, mag: 'curved', magLen: 8, stock: 'skel', rail: true, hider: true, frontSight: true }),
    rifle: (b) => { const a = longgun(b, { rec: 15, bar: 20, hg: 11, mag: 'straight', magLen: 5, stock: 'fixed', rail: true, brake: true, bolt: true }); optic(b, a.rail[0], a.rail[1], 15); a.optic = true; return a; },
    ar: (b) => longgun(b, { rec: 15, bar: 14, hg: 11, mag: 'curved', magLen: 9, stock: 'skel', rail: true, carry: false, hider: true, frontSight: true }),
    goldhawk: (b) => { const a = handgun(b, { len: 19, slideH: 5, serr: 4, hammer: true, slideMat: 'gold', frameMat: 'poly' }); for (let i = 0; i < 5; i++) b.L(b.T('gold', 0), OX + 8 + i * 2, OY + 3 - (i % 2), 1, 1); b.L('#7cc7ff', OX + 3, OY + 7, 1, 1); return a; },
    whisper: (b) => { const a = longgun(b, { rec: 13, bar: 3, hg: 0, mag: 'straight', magLen: 8, stock: 'tube', rail: true }); const m = a.muzzle; b.C('dark', m[0], m[1] - 2, 14, 5); for (let i = 3; i < 14; i += 3) b.L(INK, m[0] + i, m[1] - 2, 1, 5); a.muzzle = [m[0] + 14, m[1]]; a.integral = true; return a; },
    dragon: (b) => { const a = longgun(b, { rec: 13, bar: 17, hg: 9, hgType: 'pump', furn: 'red', stock: 'fixed', mag: 'straight', magLen: 5, rail: true, brake: true }); for (let i = 0; i < 6; i++) b.L(b.T('gold', 2 + (i % 2)), OX + 2 + i * 2, OY + 2 + (i % 2), 1, 1); b.L(b.T('gold', 3), OX - 10, OY + 3, 4, 1); return a; },
    reaper: (b) => { const a = longgun(b, { rec: 17, bar: 26, hg: 12, mag: 'box', stock: 'fixed', rail: true, brake: true, bolt: true }); optic(b, a.rail[0] + 1, a.rail[1], 17); b.L(INK, OX + 30, OY + 5, 1, 4); b.L(INK, OX + 30, OY + 9, 3, 1); b.L(b.T('dark', 2), OX + 31, OY + 5, 1, 4); a.optic = true; return a; },
    tiger: (b) => { const a = longgun(b, { rec: 15, bar: 14, hg: 11, mag: 'curved', magLen: 9, stock: 'skel', furn: 'tan', rail: true, hider: true }); optic(b, a.rail[0] + 2, a.rail[1], 11, 'dark', '#ff9a3c'); for (let i = 0; i < 6; i++) b.L(INK, OX - 12 + i * 5, OY + 1 + (i % 2), 1, 3); for (let i = 0; i < 4; i++) b.L(INK, OX + 16 + i * 3, OY + 1, 1, 3); a.optic = true; return a; },
  };
  // Attachments: drawn at the gun's anchors (same asset in every view)
  function attach(b, id, mods, a) {
    const has = (m) => mods.includes(m), hand = /pistol|compact|hawk|goldhawk|revolver|machine/.test(id);
    if (has('extmag') && !a.mag && a.cyl) { const [cx, cy] = a.cyl; for (let i = 0; i < 3; i++) { b.L(b.T('gold', 2), cx + i * 2, cy + 3, 1, 1); b.L(b.T('gold', 3), cx + i * 2, cy + 3); } b.R(MAT.gold, cx - 1, cy - 2, 7, 1); } // speed-loader brass
    if (has('extmag') && !a.mag && a.tube) { const [tx, ty] = a.tube; b.C('steel', tx, ty, 5, 2); b.L(b.T('chrome', 2), tx + 5, ty, 1, 2); }
    if (has('extmag') && a.mag) { const [mx, my] = a.mag; b.R('poly', mx, my - 1, hand ? 6 : 4, hand ? 4 : 5, { matte: true }); b.R(MAT.chrome, mx - (hand ? 0 : 1), my + (hand ? 3 : 4), hand ? 6 : 6, 1); }
    if (has('reinforce')) { const [ux, uy] = a.under; for (const dx of [-6, 0]) { for (let j = -4; j < 0; j++) if (b.get(ux + dx, uy + j)) { b.L(b.T('steel', 2), ux + dx, uy + j); b.L(b.T('steel', 0), ux + dx + 1, uy + j); } b.L(b.T('chrome', 3), ux + dx, uy - 4); } for (const [rx, ry] of [[a.hand[0] + 2, a.hand[1] - 4], [a.hand[0] + 5, a.hand[1] - 4]]) if (b.get(rx, ry)) b.L(b.T('chrome', 2), rx, ry); }
    if (has('grip')) { const [ux, uy] = a.under; b.R('dark', ux - 2, uy, 5, 2); b.L('#ff3b3b', ux + 3, uy, 1, 1); b.L('glow', ux + 4, uy, 1, 1); }
    if (has('scope') && !a.optic) {
      if (hand) { const [rx, ry] = a.rail; b.R('dark', rx - 2, ry - 3, 5, 3); b.L('#ff4a4a', rx + 2, ry - 2, 1, 1); b.L('#9fd4ff', rx - 1, ry - 3, 2, 1); } // red-dot on handguns
      else optic(b, a.rail[0], a.rail[1], 13);
    }
    if (has('suppressor') && !a.integral) { const [mx, my] = a.muzzle; const len = hand ? 8 : 11; b.C('dark', mx, my - 2, len, 5); for (let i = 2; i < len - 1; i += 3) b.L(INK, mx + i, my - 2, 1, 1); b.L(b.T('dark', 3), mx + len - 1, my - 1, 1, 2); a.muzzle = [mx + len, my]; }
  }

  // ---------------- baking + caches ----------------
  const cache = new Map();
  const W = () => root.NightshiftWeaponsData || (typeof require === 'function' ? (() => { try { return require('./weapons-data.js'); } catch { return null; } })() : null);
  // Pure pixel build (Node-testable): grid pixels, trimmed box and anchors.
  function build(id, skinId = null, mods = []) {
    if (!GUNS[id]) id = 'pistol';
    const skin = skinId && skinId !== 'stock' ? (W()?.SKIN?.[skinId] || null) : null, b = Buf(skin), a = GUNS[id](b); attach(b, id, [...new Set(mods)], a); outline(b);
    let x0 = GW, y0 = GH, x1 = 0, y1 = 0; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (b.px[y * GW + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { px: b.px, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, a, GW, GH };
  }
  function sprite(id, skinId = null, mods = []) {
    if (!GUNS[id]) id = 'pistol';
    const mk = [...new Set(mods)].sort().join(','), key = id + '|' + (skinId || '') + '|' + mk; let s = cache.get(key); if (s) return s;
    const { px, box, a } = build(id, skinId, mods), b = { px }, [x0, y0, x1, y1] = [box.x, box.y, box.x + box.w - 1, box.y + box.h - 1];
    const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null; if (!cv) return null;
    cv.width = GW; cv.height = GH; const c = cv.getContext('2d'), img = c.createImageData(GW, GH);
    for (let i = 0; i < b.px.length; i++) { let v = b.px[i]; if (!v) continue; if (v === 'glow') v = '#ff6b6b'; const [r, g, bl] = hexToRgb(v); img.data.set([r, g, bl, 255], i * 4); }
    c.putImageData(img, 0, 0);
    s = { cv, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, a };
    cache.set(key, s); if (cache.size > 240) cache.delete(cache.keys().next().value);
    return s;
  }
  // UI icon: trimmed sprite scaled to fit (w x h) css px, crisp
  function icon(id, w = 72, h = 30, skinId = null, mods = []) {
    const s = sprite(id, skinId, mods); if (!s) return null; const { box } = s, k = Math.max(1, Math.floor(Math.min(w / box.w, h / box.h) * (devicePixelRatio || 1)));
    const c = document.createElement('canvas'); c.width = box.w * k; c.height = box.h * k; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s.cv, box.x, box.y, box.w, box.h, 0, 0, c.width, c.height);
    const f = Math.min(w / box.w, h / box.h); c.style.width = Math.round(box.w * f) + 'px'; c.style.height = Math.round(box.h * f) + 'px'; c.style.imageRendering = 'pixelated'; return c;
  }
  // World: gun in hand at angle (a in radians), flipped when aiming left so it never draws upside-down.
  function drawHeld(ctx, id, x, y, angle, skinId, mods, opts = {}) {
    const s = sprite(id, skinId, mods); if (!s) return; const k = 0.5, [hx, hy] = s.a.hand, flip = Math.cos(angle) < 0;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(angle); if (flip) ctx.scale(1, -1);
    const dev = Math.abs(ctx.getTransform().a) || 1; ctx.imageSmoothingEnabled = dev * k < 1.6; // tiny on screen: smooth so outlines don't drop out
    ctx.drawImage(s.cv, s.box.x, s.box.y, s.box.w, s.box.h, (s.box.x - hx) * k, (s.box.y - hy) * k, s.box.w * k, s.box.h * k);
    if (opts.laser && mods.includes('grip')) { const [ux, uy] = s.a.under; const lx = (ux + 4 - hx) * k, gr = ctx.createLinearGradient(lx, 0, lx + 48, 0); gr.addColorStop(0, '#ff3b3b70'); gr.addColorStop(1, '#ff3b3b00'); ctx.fillStyle = gr; ctx.fillRect(lx, (uy - hy) * k, 48, 0.6); }
    ctx.restore();
  }

  // ---------------- held-gun install (outermost person wrapper, after Codex detailed-art) ----------------
  /* global S, g */
  function installHeld() {
    const Sx = root.NightshiftSprites; if (!Sx || !root.NightshiftDetailedArt || Sx.__weaponArt) return !!(Sx && Sx.__weaponArt);
    const person = Sx.person, eq = { id: null, at: -1e9 };
    Sx.person = function (p, isPlayer, options = {}) {
      const armed = isPlayer && options.weapon !== false && !options.noWeapon && root.NightshiftInventory?.state?.pocket?.pistol > 0;
      if (!armed || !p || !Number.isFinite(p.x)) { if (isPlayer && !armed) eq.id = null; return person.call(this, p, isPlayer, options); }
      const WS = root.NightshiftWeapons, id = WS?.state?.equipped || 'pistol', ang = p.angle || 0, ctx = g, C = root.NightshiftCharacters;
      const skin = WS?.state?.skins?.[id] || null, mods = WS?.state?.mods?.[id] || [], sp = sprite(id), hold = sp && sp.box.w > 34 ? 'long' : 'short';
      // hands come from the character's holding pose for this facing, so arms and gun line up
      let hx = p.x + Math.cos(ang) * 6.5, hy = p.y - 5.5 + Math.sin(ang) * 1.2, behind = Math.sin(ang) < -0.38;
      const st = C?.stance?.(p, true) || '', low = st === 'sneak' || st === 'crouch' ? 'crouch' : 'idle';
      if (C?.enabled && C.holdHand) { const d = C.dirOfAngle(ang), hh = C.holdHand(d, hold, low); behind = hh.back; hx = p.x + (behind ? 4.5 : hh.x); hy = p.y + (behind ? -9 + (low === 'crouch' ? 4.5 : 0) : hh.y); }
      // equipping: the gun swings up from the hip over ~0.22 s whenever you draw or switch
      const now = performance.now(); if (eq.id !== id) { eq.id = id; eq.at = now; }
      const k = Math.min(1, (now - eq.at) / 220), ease = 1 - (1 - k) * (1 - k), da = (1 - ease) * (Math.cos(ang) >= 0 ? 1.1 : -1.1), ga = ang + da; hy += (1 - ease) * 4;
      if (behind) drawHeld(ctx, id, hx, hy, ga, skin, mods, { laser: k >= 1 });
      const r = person.call(this, p, isPlayer, { ...options, noWeapon: true, hold });
      if (!behind) drawHeld(ctx, id, hx, hy, ga, skin, mods, { laser: k >= 1 });
      return r;
    };
    Sx.__weaponArt = true; return true;
  }
  if (typeof document !== 'undefined') { const t = setInterval(() => { if (installHeld()) clearInterval(t); }, 300); setTimeout(() => clearInterval(t), 20000); }
  // armory cards also appear in the backpack / bench (their base styles only targeted the gun shop)
  if (typeof document !== 'undefined') { const st = document.createElement('style'); st.textContent = `.spP .w{background:#1f252d;border:1px solid #3d4652;border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:4px} .spP .w.eq{border-color:#ffb347;box-shadow:0 0 0 1px #ffb34755 inset} .spP .w.lock{opacity:.6}
  .spP .w .nm{font-weight:700;display:flex;align-items:center;gap:6px;flex-wrap:wrap} .spP .w .q{font-size:9px;border:1px solid;border-radius:6px;padding:1px 5px;letter-spacing:.1em}
  .spP .w .st{display:flex;align-items:center;gap:6px;font-size:10.5px;color:#d6cbbb} .spP .w .st>div{display:flex;align-items:center;gap:6px;flex:1} .spP .w .bar{flex:1;min-width:40px;height:5px;background:#0b0e12;border-radius:3px;overflow:hidden} .spP .w .bar i{display:block;height:100%}
  .spP .w .act{display:flex;justify-content:flex-end;align-items:center;gap:6px} .spP .w .eqb{padding:7px 12px;background:#2c3a4c;border:1px solid #6f8db3;color:#fff;border-radius:8px;font:700 11px var(--disp,system-ui);cursor:pointer} .spP .w .on{color:#7cdeb5;font-weight:700;font-size:11px}`; document.head.append(st); }

  // ---------------- Weapon Inspection bench ----------------
  let insp = null;
  function buildInspect() {
    const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
    const css = el('style', {}, `
    #wiPanel{position:fixed;inset:0;z-index:71;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(250px,1fr);background:radial-gradient(120% 120% at 30% 0%,#1f2a33,#090c11 70%);color:#eef3f9;font:13px var(--body,system-ui);touch-action:none}
    #wiPanel[hidden]{display:none} #wiPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:10px;font:700 12px var(--disp,system-ui);letter-spacing:.04em}
    #wiPanel .stage{display:flex;flex-direction:column;min-width:0;min-height:0;border-right:1px solid #ffffff14} #wiPanel canvas.mat{flex:1;min-height:0;width:100%}
    #wiPanel .bar{display:flex;gap:6px;align-items:center;padding:6px 10px;flex-wrap:wrap} #wiPanel input[type=range]{flex:1;accent-color:#ffd970;min-width:80px}
    #wiPanel .chip{padding:7px 10px;background:#ffffff10;border:1px solid #ffffff22;color:#cfe0f2} #wiPanel .chip.on{background:linear-gradient(180deg,#ffd970,#c99a2a);color:#1b1408;border-color:transparent} #wiPanel .chip.no{opacity:.45}
    #wiPanel .side{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:auto;padding:8px 12px 12px;gap:8px}
    #wiPanel .hd{display:flex;align-items:flex-start;gap:8px} #wiPanel h2{margin:0;flex:1;font:800 17px var(--disp,system-ui);letter-spacing:.04em} #wiPanel .tg{font:800 10px var(--disp,system-ui);letter-spacing:.16em;color:#9fb3c8}
    #wiPanel .x{padding:8px 12px;background:#ffffff14;border:1px solid #ffffff2a} #wiPanel .ds{color:#a9b8ca;font-size:11.5px;line-height:1.4}
    #wiPanel .stat{display:grid;grid-template-columns:62px 1fr 64px;gap:6px;align-items:center;font:700 10px var(--disp,system-ui);letter-spacing:.1em;color:#9fb3c8} #wiPanel .stat .tr{height:6px;border-radius:4px;background:#ffffff12;position:relative;overflow:hidden} #wiPanel .stat i{position:absolute;inset:0 auto 0 0;border-radius:4px;background:#7cc7ff} #wiPanel .stat i.up{background:#7cdeb5} #wiPanel .stat i.dn{background:#ff7a7a} #wiPanel .stat b{color:#eef3f9;text-align:right;font-size:11px}
    #wiPanel .mods{display:grid;grid-template-columns:1fr 1fr;gap:6px} #wiPanel .mod{padding:7px 8px;border-radius:10px;background:#ffffff08;border:1px solid #ffffff18;font-size:11px;line-height:1.3;cursor:pointer} #wiPanel .mod b{display:block;font-size:12px} #wiPanel .mod.fit{border-color:#7cdeb5aa} #wiPanel .mod.prev{border-color:#ffd970;background:#ffd97014} #wiPanel .mod.bad{opacity:.55;cursor:default} #wiPanel .mod small{color:#a9b8ca}
    #wiPanel .sw{display:flex;gap:6px;flex-wrap:wrap} #wiPanel .sw button{width:26px;height:26px;border-radius:50%;border:2px solid #ffffff33;position:relative} #wiPanel .sw button.on{border-color:#ffd970;box-shadow:0 0 0 2px #ffd97055} #wiPanel .sw button.own::after{content:'';position:absolute;right:-2px;bottom:-2px;width:8px;height:8px;border-radius:50%;background:#7cdeb5;border:1px solid #0b0e12}
    #wiPanel .guns{display:flex;gap:6px;overflow-x:auto;padding:4px 10px 8px;scrollbar-width:none} #wiPanel .guns button{flex:none;padding:6px 8px;background:#ffffff0a;border:1px solid #ffffff1a;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;min-width:74px} #wiPanel .guns button.on{border-color:#ffd970;background:#ffd97014} #wiPanel .guns button.lock{opacity:.4}
    #wiPanel h4{margin:4px 0 0;font:800 10px var(--disp,system-ui);letter-spacing:.18em;color:#8fa6c0} #wiPanel .go{padding:9px 12px;background:linear-gradient(180deg,#7cdeb5,#2f9f7a);color:#06140f}
    @media (max-width:640px){#wiPanel{grid-template-columns:1fr;grid-template-rows:46% 54%} #wiPanel .stage{border-right:0;border-bottom:1px solid #ffffff14}}`);
    document.head.append(css);
    const P = el('div', { id: 'wiPanel', hidden: true, role: 'dialog', ariaLabel: 'Weapon inspection' }); document.body.append(P);
    const stage = el('div', { className: 'stage' }), mat = el('canvas', { className: 'mat' }), bar = el('div', { className: 'bar' }), guns = el('div', { className: 'guns' }), side = el('div', { className: 'side' });
    stage.append(mat, bar, guns); P.append(stage, side);
    const st = { id: 'pistol', skin: null, mods: [], zoom: 1, night: false, raf: 0 };
    const zoomIn = el('input', { type: 'range', min: '1', max: '3', step: '0.1', value: '1', ariaLabel: 'Zoom' }); zoomIn.oninput = () => { st.zoom = Number(zoomIn.value); };
    const lightB = el('button', { className: 'chip', type: 'button' }, '☀ BENCH LIGHT'); lightB.onclick = () => { st.night = !st.night; lightB.textContent = st.night ? '🌙 NIGHT' : '☀ BENCH LIGHT'; };
    const resetB = el('button', { className: 'chip', type: 'button' }, 'AS FITTED'); resetB.onclick = () => select(st.id);
    bar.append(el('span', { style: 'font-size:14px' }, '🔍'), zoomIn, lightB, resetB);
    const ptr = new Map(); let pinch0 = 0, z0 = 1;
    mat.addEventListener('pointerdown', (e) => { ptr.set(e.pointerId, e); if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); z0 = st.zoom; } });
    mat.addEventListener('pointermove', (e) => { if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, e); if (ptr.size === 2 && pinch0) { const [a, b] = [...ptr.values()]; st.zoom = Math.max(1, Math.min(3, z0 * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch0)); zoomIn.value = String(st.zoom); } });
    for (const ev of ['pointerup', 'pointercancel']) mat.addEventListener(ev, (e) => { ptr.delete(e.pointerId); if (ptr.size < 2) pinch0 = 0; });
    mat.addEventListener('wheel', (e) => { e.preventDefault(); st.zoom = Math.max(1, Math.min(3, st.zoom - Math.sign(e.deltaY) * 0.15)); zoomIn.value = String(st.zoom); }, { passive: false });
    const WS = () => root.NightshiftWeapons, D = () => root.NightshiftWeaponsData;
    function loop() {
      if (P.hidden) return; const r = mat.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr); if (mat.width !== w || mat.height !== h) { mat.width = w; mat.height = h; }
      const c = mat.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0);
      // gunsmith mat: dark rubber with a cutting grid and a ruler
      c.fillStyle = st.night ? '#0b1018' : '#18222b'; c.fillRect(0, 0, w, h); c.strokeStyle = st.night ? '#1d2a3c' : '#24333e'; c.lineWidth = 1;
      const gs = Math.round(16 * dpr); for (let x = 0; x < w; x += gs) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, h); c.stroke(); } for (let y = 0; y < h; y += gs) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(w, y + 0.5); c.stroke(); }
      c.fillStyle = '#ffd97033'; for (let x = 0; x < w; x += gs / 2) c.fillRect(x, h - (x % gs === 0 ? 10 : 6) * dpr, 1, (x % gs === 0 ? 10 : 6) * dpr);
      const s = sprite(st.id, st.skin, st.mods); if (s) {
        const fit = Math.min((w * 0.86) / s.box.w, (h * 0.66) / s.box.h), k = Math.max(1, Math.floor(fit * st.zoom)), dw = s.box.w * k, dh = s.box.h * k;
        const sp = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.55); sp.addColorStop(0, st.night ? '#4a6cff1c' : '#fff1c826'); sp.addColorStop(1, '#0000'); c.fillStyle = sp; c.fillRect(0, 0, w, h);
        c.fillStyle = '#00000055'; c.beginPath(); c.ellipse(w / 2 + k * 2, h / 2 + dh / 2 + k * 2, dw * 0.46, k * 2.2, 0, 0, Math.PI * 2); c.fill();
        c.imageSmoothingEnabled = false; c.drawImage(s.cv, s.box.x, s.box.y, s.box.w, s.box.h, Math.round(w / 2 - dw / 2), Math.round(h / 2 - dh / 2), dw, dh);
        if (st.night) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#2a3c7a40'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; }
        if (st.mods.includes('grip')) { const [ux, uy] = s.a.under; c.fillStyle = '#ff3b3b55'; c.fillRect(Math.round(w / 2 - dw / 2) + (ux + 4 - s.box.x) * k, Math.round(h / 2 - dh / 2) + (uy - s.box.y) * k, w, Math.max(1, k / 3)); }
      }
      st.raf = requestAnimationFrame(loop);
    }
    function stats(eff, base) {
      const rows = [['DAMAGE', eff.dmg * eff.pellets, base.dmg * base.pellets, 160, (v) => (eff.pellets > 1 ? `${eff.pellets}×${eff.dmg}` : String(v))], ['FIRE RATE', 60000 / eff.rate, 60000 / base.rate, 900, (v) => Math.round(v) + ' rpm'], ['MAGAZINE', eff.mag, base.mag, 30, (v) => v + ' rds'], ['RANGE', eff.range, base.range, 1200, (v) => Math.round(v) + ' px'], ['ACCURACY', 1 - Math.min(0.35, eff.spread) / 0.35, 1 - Math.min(0.35, base.spread) / 0.35, 1, (v) => Math.round(v * 100) + '%'], ['STEALTH', eff.suppressed ? 1 : 0.2, base.suppressed ? 1 : 0.2, 1, (v) => (v >= 1 ? 'Quiet' : 'Loud')]];
      const box = el('div'); for (const [n, v, b0, mx, fmt] of rows) { const r = el('div', { className: 'stat' }), tr = el('div', { className: 'tr' }), i = el('i'); i.style.width = Math.max(3, Math.min(100, (v / mx) * 100)) + '%'; if (v > b0 + 1e-6) i.className = 'up'; else if (v < b0 - 1e-6) i.className = 'dn'; tr.append(i); r.append(el('span', {}, n), tr, el('b', {}, fmt(v))); box.append(r); } return box;
    }
    function render() {
      const Dd = D(), ws = WS()?.state, w = Dd.BY_ID[st.id], owned = !!ws?.owned?.includes(st.id), fitted = ws?.mods?.[st.id] || [], q = owned ? Dd.qOf(ws, st.id) : 1, Q = Dd.QUALITY[q];
      side.textContent = ''; const hd = el('div', { className: 'hd' }), nm = el('div', { style: 'flex:1;min-width:0' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = close;
      nm.append(el('h2', {}, w.name)); const tg = el('div', { className: 'tg' }, `${w.legend ? '👑 LEGENDARY' : w.crude ? 'CRUDE' : 'TIER ' + w.tier} · ${w.cls.toUpperCase()} · ${owned ? Q.name.toUpperCase() : 'NOT OWNED'}`); tg.style.color = w.legend ? '#ffd970' : owned ? Q.color : '#9fb3c8'; nm.append(tg); hd.append(nm, x); side.append(hd);
      if (owned) { const mx = Dd.maxDur(w, fitted, WS().durMul?.() || 1, q), f = ws.broken.includes(st.id) ? 0 : Math.min(1, (ws.cond[st.id] || 0) / mx); side.append(el('div', { className: 'tg', style: `color:${f > 0.5 ? '#7cdeb5' : f > 0.2 ? '#ffd970' : '#ff7a7a'}` }, `CONDITION ${Math.round(f * 100)}% · ${ws.equipped === st.id ? 'IN HAND' : 'IN YOUR ARMORY'}`)); }
      side.append(el('div', { className: 'ds' }, w.desc));
      side.append(el('h4', {}, 'STATS' + (st.mods.join() !== [...fitted].sort().join() ? ' · PREVIEW vs FITTED' : '')), stats(Dd.effective(w, st.mods, q), Dd.effective(w, fitted, q)));
      side.append(el('h4', {}, 'ATTACHMENTS · tap to preview'));
      const mods = el('div', { className: 'mods' });
      for (const m of Dd.MODS) {
        const on = st.mods.includes(m.id), isFit = fitted.includes(m.id), noFit = w.crude && !m.crude, builtIn = (m.id === 'suppressor' && w.silent) || (m.id === 'scope' && sprite(st.id).a.optic);
        const d = el('div', { className: 'mod' + (isFit ? ' fit' : '') + (on && !isFit ? ' prev' : '') + (noFit || builtIn ? ' bad' : '') });
        d.append(el('b', {}, `${m.icon} ${m.name}`), el('small', {}, builtIn ? 'Built in' : noFit ? 'Won\'t fit a crude gun' : isFit ? `Fitted ✓ · ${m.desc}` : `${m.desc} · ${m.tier ? 'Lockup lv ' + m.tier : 'any bench'}, Shooting ${m.level}`));
        if (!noFit && !builtIn) d.onclick = () => { st.mods = on ? st.mods.filter((k) => k !== m.id) : [...st.mods, m.id].sort(); render(); };
        mods.append(d);
      }
      side.append(mods);
      side.append(el('h4', {}, 'PAINT JOBS · tap to preview'));
      const sw = el('div', { className: 'sw' }); for (const s of Dd.SKINS) { const ownS = (ws?.skins?.[st.id] || 'stock') === s.id, b = el('button', { className: ((st.skin || 'stock') === s.id ? 'on' : '') + (ownS ? ' own' : ''), type: 'button', title: s.name }); b.style.background = s.pal ? `linear-gradient(135deg,${s.pal.hi},${s.pal.sl} 45%,${s.pal.st})` : 'linear-gradient(135deg,#8b9aa7,#303a44)'; if (s.camo) b.style.background = `repeating-linear-gradient(45deg,${s.pal.sl} 0 4px,${s.camo[0]} 4px 7px,${s.pal.st} 7px 10px)`; b.onclick = () => { st.skin = s.id === 'stock' ? null : s.id; render(); }; sw.append(b); }
      side.append(sw, el('div', { className: 'ds' }, `${(Dd.SKIN[st.skin || 'stock'] || Dd.SKINS[0]).name}${(ws?.skins?.[st.id] || 'stock') === (st.skin || 'stock') ? ' · on this gun' : ' · preview (apply at a workbench → ATTACHMENTS)'}`));
      if (owned && ws.equipped !== st.id && !ws.broken.includes(st.id)) { const e = el('button', { className: 'go', type: 'button' }, 'EQUIP'); e.onclick = () => { WS().equip(st.id); renderGuns(); render(); }; side.append(e); }
    }
    function renderGuns() {
      guns.textContent = ''; const ws = WS()?.state, Dd = D();
      for (const w of Dd.WEAPONS) { const own = !!ws?.owned?.includes(w.id); if (!own && w.legend && !(ws?.learned || []).includes(w.id)) continue; const b = el('button', { className: (st.id === w.id ? 'on' : '') + (own ? '' : ' lock'), type: 'button' }); const ic = icon(w.id, 62, 22, ws?.skins?.[w.id] || null, ws?.mods?.[w.id] || []); if (ic) b.append(ic); b.append(el('span', {}, w.name)); b.onclick = () => select(w.id); guns.append(b); }
    }
    function select(id) { const ws = WS()?.state; st.id = id; st.mods = [...(ws?.mods?.[id] || [])].sort(); st.skin = ws?.skins?.[id] && ws.skins[id] !== 'stock' ? ws.skins[id] : null; renderGuns(); render(); }
    function open(id) { select(id || WS()?.state?.equipped || 'pistol'); st.zoom = 1; zoomIn.value = '1'; P.hidden = false; try { root.releaseControls?.(); } catch { /* n/a */ } cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(loop); }
    function close() { P.hidden = true; cancelAnimationFrame(st.raf); }
    addEventListener('keydown', (e) => { if (!P.hidden && e.key === 'Escape') { close(); e.stopImmediatePropagation(); } }, true);
    return { open, close, el: P };
  }
  function inspect(id) { if (typeof document === 'undefined' || !root.NightshiftWeaponsData) return; insp = insp || buildInspect(); insp.open(id); }
  function closeInspect() { insp?.close(); }

  const api = Object.freeze({ build, sprite, icon, drawHeld, inspect, closeInspect, GUNS: Object.keys(GUNS), anchors: (id) => sprite(id)?.a, paused: () => !!insp && !insp.el.hidden });
  if (typeof module === 'object' && module.exports) module.exports = api; else root.NightshiftWeaponArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
