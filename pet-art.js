/* Premium pet sprites (Claude-owned). Same pixel pipeline as weapon-art.js (shaded parts, auto-bevel, ink outline).
 * Side view facing right, mirrored for left. Poses: walk (4 frames), idle (tail wag, 2 frames), sit (2 frames).
 * Every species gets real anatomy: near/far legs, paws, collars with tags, ear shapes, markings, tails per breed.
 * Grid 48x36 (design grid 48x34 + 2 rows of headroom), feet on y=32, anchor (24, 32); drawn at 0.74 world px per grid px (~30 px long, like the old pets).
 * API: NightshiftPetArt.{build, sprite, draw, SPECIES} */
(function (root) {
  'use strict';
  const WA = () => root.NightshiftWeaponArt || (typeof require === 'function' ? (() => { try { return require('./weapon-art.js'); } catch { return null; } })() : null);
  const PD = () => root.NightshiftPetsData || (typeof require === 'function' ? (() => { try { return require('./pets-data.js'); } catch { return null; } })() : null);
  const PW = 48, PH = 36, AX = 24, AY = 32, K = 0.74, TOP = 2; // drawn on a 48x34 design grid, shifted down TOP rows for ear room

  function tools(b) {
    const X = WA().pix, R = (hex, hi) => X.ramp(hex, hi), dk = (hex, t = 0.28) => X.mix(hex, '#000000', t);
    const disc = (m, cx, cy, r) => { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) m.push([x, y]); };
    const E = (mat, cx, cy, rx, ry, o) => { const m = []; for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) m.push([x, y]); b.Pm(mat, m, o); };
    // thick polyline (tails, curled things): discs along the path, shaded as one part
    const S = (mat, pts, w, o) => { const m = []; for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2)); for (let k = 0; k <= n; k++) { const t = k / n, ww = Array.isArray(w) ? w[0] + (w[1] - w[0]) * ((i + t) / (pts.length - 1)) : w; disc(m, ax + (bx - ax) * t, ay + (by - ay) * t, ww / 2); } } b.Pm(mat, m, o); };
    return { R, dk, E, S, X };
  }
  // legs: [x, top, len, w] near/far, with paws
  function leg(b, T, mat, x, top, bottom, w, paw) { b.R(mat, Math.round(x), top, w, Math.max(1, bottom - top)); if (paw) b.R(paw, Math.round(x) - (w > 2 ? 0 : 0), bottom - 1, w + 1, 1, { flat: true }); }
  function collar(b, x, y, h = 2, col = '#c84659') { b.L(col, x, y, 2, h); b.L('#f2c84a', x + 1, y + h, 1, 1); b.L('#fff4c0', x + 1, y + h, 1, 0); }
  function eye(b, x, y, iris = '#1b1410') { b.L(iris, x, y, 2, 2); b.L('#ffffff', x, y, 1, 1); }

  const DOG = { shiba: { ear: 'up', tail: 'curl', mask: 'cream' }, lab: { ear: 'flop', tail: 'otter' }, husky: { ear: 'up', tail: 'plume', mask: 'husky', eye: '#5fb8e8' }, rottweiler: { ear: 'flop', tail: 'stub', mask: 'tan', big: true } };
  function dog(b, d, pose, id) {
    const { R, dk, E, S } = tools(b), spec = DOG[id] || DOG.lab, M = R(d.colors[0]), M2 = R(d.colors[1]), far = R(dk(d.colors[0], 0.3)), big = spec.big ? 1 : 0;
    const f = pose.frame, ph = f * Math.PI / 2, sw = (k) => Math.round(Math.sin(ph + k) * 2), wag = pose.wag ? 2 : -1;
    const pawC = spec.mask === 'tan' ? M2 : spec.mask ? M2 : R(dk(d.colors[0], 0.1));
    if (pose.sit) {
      // tail sweeps the ground behind
      S(spec.tail === 'stub' ? M : spec.mask === 'husky' ? M : M, spec.tail === 'curl' ? [[13, 22], [8, 20], [7, 16 + wag], [10, 15 + wag]] : spec.tail === 'stub' ? [[12, 26], [9, 26]] : [[13, 27], [7, 28 + (wag > 0 ? -1 : 0)], [3, 28 + wag]], spec.tail === 'plume' ? [4, 3] : 2.6);
      leg(b, null, far, 25, 20, 30, 3, pawC); // far front leg
      E(M, 17, 24, 7, 6); // haunch
      b.P(M, [[12, 22], [26, 12 - big], [31, 13 - big], [31, 22], [22, 28], [12, 28]]);
      if (spec.mask) b.P(M2, [[26, 15], [31, 14], [31, 22], [27, 23]], { matte: true }); // chest
      leg(b, null, M, 28, 19, 30, 3, pawC); b.R(pawC, 18, 28, 6, 2, { flat: true }); // near front leg, back paw tucked forward
      head(b, d, spec, 28, 2 - big, M, M2, pose);
      collar(b, 29, 11 - big);
      return;
    }
    // tail
    if (spec.tail === 'curl') S(M, [[12, 16], [8, 13], [8, 8 + wag], [12, 8 + wag], [13, 11]], 3);
    else if (spec.tail === 'plume') S(M, [[12, 16], [7, 13], [4, 9 + wag]], [3.4, 4]);
    else if (spec.tail === 'otter') S(M, [[12, 17], [7, 17 + wag], [3, 18 + wag]], [3.2, 2]);
    else S(M, [[12, 16], [9, 15]], 2.6);
    // far legs (darker), body, near legs
    leg(b, null, far, 14 + sw(Math.PI), 21, 30, 3, pawC); leg(b, null, far, 28 - sw(Math.PI), 21, 30, 3, pawC);
    b.P(M, [[12, 15 - big], [30, 14 - big], [34, 17], [33, 23], [27, 24], [14, 25], [11, 21]]);
    if (spec.mask) b.P(M2, [[17, 22], [31, 21], [33, 22], [30, 24], [17, 24]], { matte: true }); // belly
    if (spec.mask === 'husky') b.P(M2, [[30, 16], [34, 17], [33, 23], [30, 22]], { matte: true });
    leg(b, null, M, 16 + sw(0), 21, 30, 3, pawC); leg(b, null, M, 30 - sw(0), 20, 30, 3, pawC);
    if (spec.mask === 'tan') { b.R(M2, 16 + sw(0), 27, 3, 2, { flat: true }); b.R(M2, 30 - sw(0), 27, 3, 2, { flat: true }); }
    head(b, d, spec, 31, 5 - big, M, M2, pose);
    collar(b, 31, 14 - big);
  }
  function head(b, d, spec, x, y, M, M2, pose) {
    const { E } = tools(b);
    // ears behind the skull
    if (spec.ear === 'up') { b.P(M, [[x + 1, y + 5], [x + 2, y - 1], [x + 6, y + 4]]); b.L('#d89a8a', x + 3, y + 2, 1, 2); }
    E(M, x + 5, y + 7, 5, 4.6); // skull
    b.P(M, [[x + 7, y + 6], [x + 12, y + 7], [x + 13, y + 9], [x + 12, y + 11], [x + 7, y + 11]]); // muzzle
    if (spec.mask === 'cream' || spec.mask === 'husky' || spec.mask === 'tan') b.P(M2, [[x + 7, y + 8], [x + 12, y + 8], [x + 12, y + 11], [x + 6, y + 11], [x + 5, y + 10]], { matte: true });
    if (spec.mask === 'husky') b.L(M2[1], x + 4, y + 4, 4, 1); if (spec.mask === 'tan') b.L(M2[1], x + 6, y + 4, 2, 1);
    if (spec.ear === 'flop') b.P([M[0], M[0], M[1], M[1]], [[x + 1, y + 3], [x + 5, y + 3], [x + 4, y + 10], [x + 1, y + 8]]);
    if (spec.ear === 'up') { b.P(M, [[x + 4, y + 4], [x + 6, y - 2], [x + 9, y + 4]]); b.L('#d89a8a', x + 6, y + 1, 1, 2); }
    eye(b, x + 7, y + 5, spec.eye || '#1b1410');
    b.L('#0b0e12', x + 12, y + 7, 2, 2); b.L('#59616b', x + 12, y + 7); // nose
    b.L('#0b0e12', x + 9, y + 10, 3, 1); // mouth line
    if (!pose.sit && pose.wag) b.L('#e0707a', x + 10, y + 11, 2, 2); // tongue on the happy frame
  }
  const CAT = { tabby: { stripes: '#7a4320', eye: '#9ccf5a' }, blackcat: { eye: '#f2c84a' }, tiger: { stripes: '#1b1410', eye: '#f2b84a', belly: true, big: true } };
  function cat(b, d, pose, id) {
    const { R, dk, E, S } = tools(b), spec = CAT[id] || CAT.tabby, M = R(d.colors[0]), M2 = R(d.colors[1]), far = R(dk(d.colors[0], 0.3)), big = spec.big ? 1 : 0;
    const f = pose.frame, ph = f * Math.PI / 2, sw = (k) => Math.round(Math.sin(ph + k) * 2), flick = pose.wag ? -2 : 0;
    const stripe = (x0, x1, y0, h) => { if (!spec.stripes) return; for (let x = x0; x < x1; x += 3) b.L(spec.stripes, x, y0 + ((x / 3) % 2), 1, h); };
    if (pose.sit) {
      S(M, [[16, 29], [9, 29], [6, 27 + flick / 2], [7, 25 + flick / 2]], 2.4); // tail wrapped around
      b.P(M, [[14, 30], [13, 24], [16, 16], [24, 14], [28, 20], [27, 30]]);
      if (spec.belly) b.P(M2, [[22, 18], [27, 21], [26, 29], [21, 29]], { matte: true });
      stripe(15, 22, 19, 4); leg(b, null, M, 24, 22, 30, 2, M2);
      catHead(b, spec, 17, 6 - big, M, M2, pose);
      collar(b, 21, 15, 1, '#3d7fc6');
      return;
    }
    S(M, [[13, 18], [8, 16], [5, 11], [6, 6 + flick], [9, 5 + flick]], [2.8, 2.2]); // tail up
    leg(b, null, far, 15 + sw(Math.PI), 22, 30, 2, M2[1] ? R(dk(d.colors[0], 0.15)) : M); leg(b, null, far, 28 - sw(Math.PI), 22, 30, 2, R(dk(d.colors[0], 0.15)));
    b.P(M, [[13, 17], [29, 16], [32, 18], [31, 23], [15, 24], [12, 21]]);
    if (spec.belly) b.P(M2, [[17, 22], [30, 21], [29, 24], [17, 24]], { matte: true });
    stripe(15, 29, 17, 4);
    leg(b, null, M, 17 + sw(0), 22, 30, 2, M2); leg(b, null, M, 30 - sw(0), 21, 30, 2, M2);
    catHead(b, spec, 29, 8 - big, M, M2, pose);
    collar(b, 30, 16, 1, '#3d7fc6');
  }
  function catHead(b, spec, x, y, M, M2, pose) {
    const { E } = tools(b);
    b.P(M, [[x + 1, y + 4], [x + 2, y - 1], [x + 5, y + 3]]); b.P(M, [[x + 6, y + 3], [x + 9, y - 1], [x + 10, y + 4]]); // ears
    b.L('#d89a8a', x + 2, y + 1, 1, 2); b.L('#d89a8a', x + 8, y + 1, 1, 2);
    E(M, x + 6, y + 6, 5, 4.4);
    if (spec.belly) b.P(M2, [[x + 6, y + 7], [x + 11, y + 6], [x + 11, y + 10], [x + 5, y + 10]], { matte: true });
    if (spec.stripes) { b.L(spec.stripes, x + 5, y + 2, 1, 2); b.L(spec.stripes, x + 7, y + 2, 1, 2); }
    b.L(spec.eye, x + 7, y + 5, 2, 2); b.L('#0b0e12', x + 8, y + 5, 1, 2); b.L('#ffffff', x + 7, y + 5);
    b.L('#e08a9a', x + 10, y + 7, 1, 1); b.L('#ffffff99', x + 9, y + 9, 3, 0);
    if (pose.wag && !pose.sit) b.L('#0b0e12', x + 9, y + 9, 2, 1);
  }
  function raccoon(b, d, pose) {
    const { R, dk, E, S } = tools(b), M = R(d.colors[0]), M2 = R(d.colors[1]), far = R(dk(d.colors[0], 0.3)), f = pose.frame, sw = (k) => Math.round(Math.sin(f * Math.PI / 2 + k) * 2);
    // ringed tail
    const tail = pose.sit ? [[13, 27], [9, 28], [5, 26 + (pose.wag ? -1 : 0)]] : [[12, 18], [8, 19], [5, 17 + (pose.wag ? -2 : 0)]];
    S(M, tail, [4, 3.4]); for (let i = 0; i < 3; i++) { const p0 = tail[0], p1 = tail[tail.length - 1], t = 0.25 + i * 0.27, x = Math.round(p0[0] + (p1[0] - p0[0]) * t), y = Math.round(p0[1] + (p1[1] - p0[1]) * t); b.L(M2[1], x, y - 1, 1, 3); }
    if (pose.sit) { E(M, 18, 24, 7, 6); b.P(M, [[13, 22], [25, 13], [30, 14], [30, 22], [22, 28], [13, 28]]); leg(b, null, M2, 27, 20, 30, 3, M2); }
    else { leg(b, null, M2, 15 + sw(Math.PI), 22, 30, 3, M2); leg(b, null, M2, 28 - sw(Math.PI), 22, 30, 3, M2); b.P(M, [[12, 16], [29, 15], [33, 18], [32, 23], [15, 25], [11, 21]]); b.P(far, [[15, 23], [30, 22], [30, 24], [15, 25]], { matte: true }); leg(b, null, M2, 17 + sw(0), 22, 30, 3, M2); leg(b, null, M2, 30 - sw(0), 21, 30, 3, M2); }
    const x = pose.sit ? 25 : 29, y = pose.sit ? 3 : 6;
    b.P(M, [[x + 1, y + 4], [x + 2, y], [x + 5, y + 3]]); b.L('#f2f2ee', x + 2, y, 1, 1);
    E(M, x + 5, y + 7, 5, 4.4); b.P(R('#e8e8e2'), [[x + 6, y + 8], [x + 12, y + 8], [x + 11, y + 11], [x + 6, y + 11]], { matte: true });
    b.L(M2[0], x + 3, y + 5, 8, 2); eye(b, x + 7, y + 5, '#0b0e12'); b.L('#f2f2ee', x + 4, y + 4, 5, 1);
    b.L('#0b0e12', x + 11, y + 8, 2, 1);
  }
  function bird(b, d, pose) { // macaw
    const { R, E, S } = tools(b), M = R(d.colors[0]), M2 = R(d.colors[1]), hop = !pose.sit && pose.frame % 2 ? -1 : 0, y0 = hop;
    S(M2, [[19, 24 + y0], [15, 29 + y0], [12, 31 + y0]], [4, 2.4]); b.L(R('#f2c84a')[2], 15, 28 + y0, 1, 2); // long tail
    b.L('#59616b', 20, 27 + y0, 1, 3); b.L('#59616b', 24, 27 + y0, 1, 3); b.L('#3d4a55', 19, 30, 3, 1); b.L('#3d4a55', 23, 30, 3, 1); // feet
    E(M, 22, 19 + y0, 6, 8.5);
    b.P(M2, [[16, 15 + y0], [23, 15 + y0], [22, 26 + y0], [17, 24 + y0]]); b.L(R('#f2c84a')[2], 17, 15 + y0, 6, 1); // wing with a yellow band
    for (let i = 0; i < 3; i++) b.L(M2[0], 18 + i * 2, 18 + y0, 1, 6 - i);
    E(M, 25, 8 + y0, 5, 4.6);
    b.P(R('#efe6cc'), [[28, 6 + y0], [32, 7 + y0], [32, 10 + y0], [30, 12 + y0], [28, 11 + y0]]); b.L('#2b2f33', 31, 10 + y0, 1, 2); // hooked beak
    b.L('#f4f1ea', 25, 6 + y0, 3, 3); eye(b, 26, 7 + y0, '#f2c84a'); b.L('#0b0e12', 27, 7 + y0);
    if (pose.wag) b.L(M[3], 24, 3 + y0, 2, 1);
  }
  function owl(b, d, pose) {
    const { R, E } = tools(b), M = R(d.colors[0]), M2 = R(d.colors[1]), hop = !pose.sit && pose.frame % 2 ? -1 : 0, y0 = hop;
    b.L('#c99a2a', 18, 28 + y0, 2, 2); b.L('#c99a2a', 25, 28 + y0, 2, 2);
    E(M, 22, 20 + y0, 8, 9.5); E(M2, 23, 22 + y0, 5, 6.5, { matte: true });
    for (let i = 0; i < 6; i++) b.L(M[0], 20 + (i % 3) * 2, 19 + Math.floor(i / 3) * 3 + y0, 1, 1); // breast spots
    b.P(M, [[13, 16 + y0], [17, 14 + y0], [18, 27 + y0], [14, 25 + y0]]); for (let i = 0; i < 3; i++) b.L(M2[2], 15, 17 + i * 3 + y0, 1, 1); // wing
    E(M, 22, 9 + y0, 8, 6.5); E(M2, 23, 9.5 + y0, 6.5, 5, { matte: true }); b.L(M[0], 22, 5 + y0, 1, 9); // heart-shaped face
    for (const ex of [19, 25]) { b.L('#0b0e12', ex, 8 + y0, 3, 3); b.L('#ffffff', ex, 8 + y0); }
    b.L('#c99a2a', 22, 11 + y0, 2, 2);
    if (pose.wag) b.L(M[0], 19, 9 + y0, 3, 1); // slow blink
  }
  function monkey(b, d, pose) {
    const { R, E, S } = tools(b), M = R(d.colors[0]), M2 = R(d.colors[1]), f = pose.frame, sw = Math.round(Math.sin(f * Math.PI / 2) * 2), curl = pose.wag ? 1 : 0;
    S(M, [[16, 22], [10, 22], [6, 18], [6, 13], [9, 11 + curl], [11, 13 + curl]], 2.2); // curly tail
    b.R(M, 17 + sw, 24, 3, 6); b.R(M, 24 - sw, 24, 3, 6); b.R(M2, 16 + sw, 29, 4, 1, { flat: true }); b.R(M2, 23 - sw, 29, 4, 1, { flat: true });
    E(M, 21, 19, 6, 7); E(M2, 22, 20, 3.4, 4.6, { matte: true });
    b.R(M, 26, pose.sit ? 17 : 15 - sw, 3, 9); b.R(M2, 26, pose.sit ? 25 : 23 - sw, 3, 2, { flat: true }); // arm
    E(M, 22, 8, 5.4, 5); E(M2, 23, 9, 3.8, 3.6, { matte: true }); E(R('#4a3018'), 17, 8, 2, 2); // head, face, ear
    eye(b, 23, 7, '#1b1410'); eye(b, 26, 7, '#1b1410'); b.L('#4a3018', 24, 11, 3, 1);
    b.L(M[0], 20, 3, 5, 2); // brow tuft
  }
  const SPECIES = { dog, cat, raccoon, bird, owl, monkey };

  // Pose key: 'w0'..'w3' walk, 'i0'/'i1' idle (tail), 's0'/'s1' sitting (tail/blink)
  function build(id, key) {
    const D = PD()?.PET?.[id]; if (!D || !WA()) return null;
    const X = WA().pix, b = X.Buf(null, PW, PH);
    b.Pm = (mat, mask, o) => { // shade an arbitrary mask the same way the weapon parts are
      const T = Array.isArray(mat) ? mat : X.MAT[mat] || X.MAT.steel, set = new Set(mask.map(([x, y]) => x + ',' + y)), has = (x, y) => set.has(x + ',' + y);
      let minX = 1e9, maxX = -1e9; for (const [x] of mask) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
      for (const [x, y] of mask) { let t = 1; if (!has(x, y - 1)) t = !o?.matte && (x - minX) < (maxX - minX) * 0.7 ? 3 : 2; else if (!has(x, y + 1) || !has(x + 1, y)) t = 0; else if (!has(x - 1, y)) t = 2; b.put(x, y, T[t]); }
    };
    const pose = { frame: Number(key[1]) || 0, sit: key[0] === 's', wag: key[0] !== 'w' && key[1] === '1' };
    const fn = SPECIES[D.kind] || dog; fn(b, D, pose, id);
    b.px = [...new Array(TOP * PW).fill(null), ...b.px.slice(0, (PH - TOP) * PW)];
    X.outline(b, '#0e1116');
    return { px: b.px, w: PW, h: PH };
  }
  const cache = new Map();
  function sprite(id, key) {
    const k = id + '|' + key; let s = cache.get(k); if (s) return s;
    const p = build(id, key); if (!p || typeof document === 'undefined') return null;
    const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH; const c = cv.getContext('2d'), img = c.createImageData(PW, PH), X = WA().pix;
    for (let i = 0; i < p.px.length; i++) { const v = p.px[i]; if (!v) continue; const rgb = X.hexToRgb(v.slice(0, 7)), a = v.length === 9 ? parseInt(v.slice(7), 16) : 255; img.data.set([...rgb, a], i * 4); }
    c.putImageData(img, 0, 0); s = cv; cache.set(k, s); if (cache.size > 200) cache.delete(cache.keys().next().value); return s;
  }
  // p: { x, y, angle, moving, walk?, sit? } in world px; t seconds
  function draw(ctx, id, p, t = performance.now() / 1000, opts = {}) {
    try { if (root.NightshiftO3Pet?.draw?.(ctx, id, p, t, opts)) return true; } catch (e) { console.error(e); } // v0.70 Option 3 directional pets
    if (!PD()?.PET?.[id] || !p || !Number.isFinite(p.x)) return false;
    const mv = !!p.moving, sitting = !mv && (opts.sitting ?? false), walkF = Math.floor(((p.walk ?? t * 9) % 4 + 4) % 4);
    const key = mv ? 'w' + walkF : (sitting ? 's' : 'i') + (Math.floor(t * (sitting ? 1.6 : 3)) % 2);
    const s = sprite(id, key); if (!s) return false;
    const dir = Math.cos(p.angle || 0) >= 0 ? 1 : -1, kind = PD().PET[id].kind, lift = kind === 'owl' && mv ? Math.abs(Math.sin(t * 10)) * 3 : 0;
    ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y - lift));
    ctx.fillStyle = '#05080f44'; ctx.beginPath(); ctx.ellipse(1, 1 + lift, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.scale(dir, 1); const prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(s, -AX * K, -AY * K, PW * K, PH * K); ctx.imageSmoothingEnabled = prev; ctx.restore();
    return true;
  }
  const api = Object.freeze({ build, sprite, draw, SPECIES: Object.keys(SPECIES), K });
  if (typeof module === 'object' && module.exports) module.exports = api; else root.NightshiftPetArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
