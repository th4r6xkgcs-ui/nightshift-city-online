/* Option 3 pets (Claude-owned): directional 2.5D animals on o3-engine.js. 96x96 frames, origin (48, 88).
 * Husky (golden sample) + shiba + rottweiler from the same anatomy: barrel chest, belly, hips, neck, head + muzzle,
 * pointed ears, four legs in a diagonal walk gait (front-left with back-right), curled tail, breed markings
 * (husky mask, shiba cream underside, rottweiler tan points). 8 real directions; idle (4, breathing + tail wag),
 * walk (6), sit (2). Pure JS (browser + Node). API: NightshiftO3Pet.{render, supports, ANIMS, BREEDS} */
(function (root) {
  'use strict';
  const E = root.NightshiftO3Engine || (typeof require === 'function' ? require('./o3-engine.js') : null);
  const { ramp, capsule, ellipsoid, stamp, px, intersect, mix } = E;
  const PW = 96, PH = 96, POX = 48, POY = 88;
  const ANIMS = { idle: 4, walk: 6, sit: 2 };
  const BREEDS = {
    husky: { coat: '#8f98a2', light: '#f2f2ee', dark: '#3a3f46', eye: '#7ad0ff', tail: 'curl', mask: true, ears: 'point' },
    shiba: { coat: '#d8843a', light: '#f2ead8', dark: '#8a4a1e', eye: '#2a1a10', tail: 'curl', mask: false, ears: 'point' },
    rottweiler: { coat: '#1e1a18', light: '#a0582a', dark: '#0e0c0b', eye: '#3a2010', tail: 'stub', mask: false, ears: 'flop', points: true },
  };
  const supports = (id) => !!BREEDS[id];

  // reuse the character engine's 96x128 buffers by drawing in its coordinate space with the pet origin offset
  function render(id, dir, anim = 'idle', f = 0) {
    const B0 = BREEDS[id] || BREEDS.husky, v = E.view(dir, 1.85), F = E.Frame(), Lb = (n) => F.layer(n);
    const n = ANIMS[anim] || 1, k = ((f % n) + n) % n, ph = (2 * Math.PI * k) / n;
    const coat = ramp(B0.coat), light = ramp(B0.light), dark = ramp(B0.dark);
    // local frame: y up, z = forward (nose), x = right. Ground at y=0 maps to engine OY (118); we crop to 96x96 later.
    const sit = anim === 'sit', walk = anim === 'walk';
    const bob = walk ? Math.abs(Math.sin(ph)) * 0.8 : anim === 'idle' ? [0, 0.4, 0.8, 0.4][k] : 0;
    const legL = 8, chestY = 12.5 + bob, hipY = sit ? 7 : 12 + bob, chestZ = 7, hipZ = sit ? -4 : -8;
    const bodyPass = (z) => (v.depth([0, 0, z]) >= 0 ? 'near' : 'far');
    // legs (diagonal gait), far ones first
    const legs = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, front]) => {
      const phase = walk ? Math.sin(ph + (sx * front > 0 ? 0 : Math.PI)) : 0, top = [sx * 3.4, front > 0 ? chestY - 2 : hipY - 2, front > 0 ? chestZ : hipZ];
      let foot = [sx * 3.6, 0.8, top[2] + phase * 4.5]; if (walk && phase > 0.2) foot[1] += phase * 2.2;
      if (sit && front < 0) foot = [sx * 4.2, 0.8, hipZ + 6];
      const knee = [sx * 3.5, (top[1] + foot[1]) / 2 + (front > 0 ? 0 : 1.5), (top[2] + foot[2]) / 2 + (front > 0 ? 0.8 : -1.6)];
      return { sx, front, top, knee, foot };
    }).sort((a, b) => v.depth(a.top) - v.depth(b.top));
    const legPass = (l) => (v.depth([l.sx * 3.4, 0, l.top[2]]) >= v.depth([0, 0, (chestZ + hipZ) / 2]) ? 'near' : 'far');
    for (const l of legs) {
      const L = Lb('legs:' + legPass(l)), R = B0.points && l.foot ? light : coat;
      stamp(L, capsule(v, l.top, l.knee, 2.6, 2.2).mask, coat); stamp(L, capsule(v, l.knee, l.foot, 2.1, 1.8).mask, B0.mask ? light : R);
      stamp(L, ellipsoid(v, [l.foot[0], l.foot[1] + 0.6, l.foot[2] + 0.8], [2, 1.4, 2.4]).mask, B0.mask || B0.points ? light : dark);
    }
    // body: hips, belly, chest (painter by depth), lighter underside
    const Bm = Lb('body:main');
    const parts = [[[0, hipY, hipZ], [5.6, 5.4, 6.2]], [[0, (chestY + hipY) / 2 - 0.3, (chestZ + hipZ) / 2], [5.2, 5, 7.5]], [[0, chestY, chestZ], [6, 6.2, 6]]].sort((a, b) => v.depth(a[0]) - v.depth(b[0]));
    for (const [c, r] of parts) stamp(Bm, ellipsoid(v, c, r).mask, coat);
    const under = ellipsoid(v, [0, (chestY + hipY) / 2 - 3.4, (chestZ + hipZ) / 2 + 1], [4.4, 3, 9]); stamp(Bm, intersect(under.mask, under.mask), light, { noInk: true });
    if (B0.mask) { const saddle = ellipsoid(v, [0, (chestY + hipY) / 2 + 3.6, (chestZ + hipZ) / 2], [4.6, 2.2, 8.5]); stamp(Bm, saddle.mask, dark, { noInk: true }); }
    // tail
    const T = Lb('tail:' + (v.depth([0, 0, hipZ - 6]) >= v.depth([0, 0, 0]) ? 'near' : 'far'));
    const wag = anim === 'idle' || walk ? Math.sin(ph * 2) * 1.6 : 0;
    if (B0.tail === 'curl') { const a = [0, hipY + 3, hipZ - 5], b = [wag, hipY + 8.5, hipZ - 6.5], c2 = [wag * 1.4, hipY + 9.5, hipZ - 2.5]; stamp(T, capsule(v, a, b, 2.2, 2.6).mask, coat); stamp(T, capsule(v, b, c2, 2.6, 1.8).mask, B0.mask ? light : coat); }
    else stamp(T, capsule(v, [0, hipY + 2, hipZ - 5], [wag * 0.5, hipY + 3.5, hipZ - 7], 1.6, 1.3).mask, coat);
    // neck + head + muzzle + ears + face
    const H = Lb('head:' + (v.fz < -0.25 ? 'far' : 'near')), headC = [0, chestY + 7 + (sit ? 2 : 0), chestZ + 5], muzC = [0, headC[1] - 1.6, headC[2] + 4.2];
    stamp(H, capsule(v, [0, chestY + 2, chestZ + 2], headC, 3.4, 3).mask, coat);
    const ears = B0.ears === 'point' ? [[2.6, 4.8, -0.6], [-2.6, 4.8, -0.6]] : [[3.6, 2, -0.4], [-3.6, 2, -0.4]];
    for (const e of ears) { const ep = [headC[0] + e[0], headC[1] + e[1], headC[2] + e[2]]; if (v.depth(ep) < v.depth(headC) - 1) stamp(H, (B0.ears === 'point' ? capsule(v, [ep[0] * 0.8, ep[1] - 2.5, ep[2]], ep, 1.6, 0.6) : ellipsoid(v, ep, [1.2, 2.6, 1.6])).mask, dark); }
    const head = ellipsoid(v, headC, [4.7, 4.3, 4.8]); stamp(H, head.mask, coat);
    stamp(H, ellipsoid(v, muzC, [2.3, 1.9, 2.8]).mask, B0.mask || B0.points ? light : coat);
    if (B0.mask) stamp(H, intersect(ellipsoid(v, [headC[0], headC[1] - 1.2, headC[2] + 2], [3.6, 2.4, 3.6]).mask, head.mask), light, { noInk: true });
    for (const e of ears) { const ep = [headC[0] + e[0], headC[1] + e[1], headC[2] + e[2]]; if (v.depth(ep) >= v.depth(headC) - 1) stamp(H, (B0.ears === 'point' ? capsule(v, [ep[0] * 0.8, ep[1] - 2.5, ep[2]], ep, 1.6, 0.6) : ellipsoid(v, ep, [1.2, 2.6, 1.6])).mask, dark); }
    // eyes + nose (front-facing side only)
    const P3 = (p) => [Math.round(v.px(p)), Math.round(v.py(p)), v.depth(p) - v.depth(headC)];
    for (const s of [1, -1]) { const e = P3([headC[0] + s * 1.9, headC[1] + 0.6, headC[2] + 3.3]); if (e[2] > 1.2) { px(H, e[0], e[1], B0.eye); px(H, e[0], e[1] - 1, '#0c0d10'); } }
    const nose = P3([muzC[0], muzC[1] + 0.8, muzC[2] + 2.8]); if (nose[2] > 1) { px(H, nose[0], nose[1], '#0c0d10'); px(H, nose[0] + 1, nose[1], '#0c0d10'); }
    // collar (golden: violet with a tag)
    const col = Lb('collar:' + (v.fz < -0.25 ? 'far' : 'near')); stamp(col, intersect(capsule(v, [0, chestY + 3.8, chestZ + 3.1], [0, chestY + 4.6, chestZ + 3.6], 3.6, 3.6).mask, capsule(v, [0, chestY + 2, chestZ + 2], headC, 3.6, 3.2).mask), ramp('#a34dff'));
    const tag = P3([0, chestY + 2.8, chestZ + 6.4]); if (tag[2] > -4) px(col, tag[0], tag[1], '#ffd970');
    // composite + crop the 96x128 engine frame to a 96x96 pet frame (ground at 118 → 88)
    const ORDER = ['legs:far', 'tail:far', 'collar:far', 'head:far', 'body:main', 'legs:near', 'tail:near', 'collar:near', 'head:near'];
    const full = E.composite(F.layers, ORDER), out = new Uint32Array(PW * PH), off = E.OY - POY;
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) out[y * PW + x] = full[(y + off) * E.FW + x] || 0;
    const layers = new Map(); for (const key of ORDER) { const b = F.layers.get(key); if (!b) continue; const o = new Uint32Array(PW * PH); for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) o[y * PW + x] = b[(y + off) * E.FW + x] || 0; layers.set(key, o); }
    return { composite: out, layers, order: ORDER.filter((k2) => layers.has(k2)), w: PW, h: PH, origin: [POX, POY] };
  }
  // ---- runtime (browser): cached canvases + a draw() the old pet renderer delegates to ----
  const cache = new Map();
  function frame(id, dir, anim, f) {
    const n = ANIMS[anim] || 1, k = ((f % n) + n) % n, key = id + dir + anim + k; let cv = cache.get(key); if (cv) return cv;
    if (typeof document === 'undefined') return null; const r = render(id, dir, anim, k); cv = document.createElement('canvas'); cv.width = PW; cv.height = PH;
    const x = cv.getContext('2d'), img = x.createImageData(PW, PH); img.data.set(E.toRGBA(r.composite, PW, PH)); x.putImageData(img, 0, 0); cache.set(key, cv); if (cache.size > 160) cache.delete(cache.keys().next().value); return cv;
  }
  const dirOf = (a) => ((Math.round((((a || 0) % (2 * Math.PI)) + 2 * Math.PI) / (Math.PI / 4)) % 8) + 8) % 8;
  /** p = { x, y (feet), angle, moving, walk }; returns false when this pet has no Option 3 art yet. */
  function draw(ctx, id, p, t = performance.now() / 1000, opts = {}) {
    if (!BREEDS[id] || !p || !Number.isFinite(p.x)) return false; try { if (root.localStorage?.getItem('ns-o3') === '0') return false; } catch { /* default on */ }
    const mv = !!p.moving, anim = mv ? 'walk' : opts.sitting ? 'sit' : 'idle', f = mv ? Math.floor((p.walk ?? t * 9) * 1.5) : Math.floor(t * (anim === 'sit' ? 1.6 : 4));
    const cv = frame(id, dirOf(p.angle), anim, f); if (!cv) return false;
    ctx.save(); ctx.fillStyle = '#05080f44'; ctx.beginPath(); ctx.ellipse(Math.round(p.x) + 1, Math.round(p.y) + 1, 12, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    const prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, Math.round(p.x) - POX / 2, Math.round(p.y) - POY / 2, PW / 2, PH / 2); ctx.imageSmoothingEnabled = prev; ctx.restore(); return true;
  }
  const api = { render, supports, ANIMS, BREEDS, PW, PH, POX, POY, draw, frame, dirOf };
  root.NightshiftO3Pet = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
