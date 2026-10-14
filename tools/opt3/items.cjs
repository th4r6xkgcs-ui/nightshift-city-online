'use strict';
// Option 3 character items (Claude-owned). Every item = SDF primitives on rig bones + a material that paints its
// construction details in bone space (seams, quilting, zips, pockets, piping, laces, stitching), so the same detail
// appears correctly in all 8 directions and every animation frame.
// band: 'mid' | 'limb' (near/far by depth vs the chest) | 'head' | 'back' (behind/over by depth vs ref) | 'far' | 'near'
const { SK } = require('./rig.cjs');
const D = Math.PI / 180;
const ang = (x, z) => Math.atan2(x, z) / D;          // around a limb: 0 = front, +90 = character's left, ±180 = back
const near = (v, t, w) => Math.abs(v - t) < w;
const fract = (v) => v - Math.floor(v);

// golden palette (Art Bible): near-black, street orange, warm highlight, cyan, violet
const PAL = { black: '#1b1d24', black2: '#24272f', orange: '#f27934', cream: '#ebe6dc', white: '#f1efe8', red: '#d23a3a', gold: '#e6b875', cyan: '#44b9c7', violet: '#a34dff', navy: '#14243a' };
const SKINS = ['#f6d3b3', '#eabf98', '#d7a477', '#bf8556', '#9c6a43', '#7a4e30', '#5a3824', '#41281a'];
const HAIR = '#1a1418';

// ---------- limbs helpers ----------
const limb = (bone, len, r1, r2, mat, band = 'limb', extra = {}) => ({ bone, type: 'cone', a: [0, 0, 0], b: [0, -len, 0], r1, r2, mat, band, ...extra });

// ================= BASE BODY =================
function body(o = {}) {
  const skin = SKINS[o.skin ?? 3], hairC = o.hairColor || HAIR;
  const S = { c: skin, kind: 'skin' };
  const face = (p) => {
    const { x, y, z } = p; if (z < 5.5) return S;
    const ax = Math.abs(x);
    if (near(y, 12.4, 1.25) && near(ax, 4.6, 1.6) && z > 8) return near(ax, 4.2, 0.9) ? { c: '#17121c', kind: 'cloth', flat: 1 } : { c: '#f4efe6', flat: 3 };
    if (near(y, 15.6, 0.7) && near(ax, 4.6, 2.1) && z > 7.5) return { c: hairC, flat: 1 };
    if (near(y, 6.2, 0.6) && ax < 2.6 && z > 7) return { c: skin, kind: 'skin', flat: 1 };
    if (near(y, 9.4, 1) && ax < 1.3 && z > 10) return { c: skin, kind: 'skin', tone: -1 };
    return S;
  };
  return [
    { bone: 'head', type: 'ell', c: [0, 12.8, 0], r: [10.8, 12.2, 11], mat: face, band: 'head', smooth: true },
    { bone: 'head', type: 'ell', c: [0, 7.2, 2], r: [8.4, 6.6, 8.6], mat: face, band: 'head', smooth: true },
    { bone: 'head', type: 'ell', c: [10.6, 11.5, -0.5], r: [1.8, 3.2, 2.4], mat: () => ({ ...S, tone: -1 }), band: 'head' },
    { bone: 'head', type: 'ell', c: [-10.6, 11.5, -0.5], r: [1.8, 3.2, 2.4], mat: () => ({ ...S, tone: -1 }), band: 'head' },
    { bone: 'head', type: 'ell', c: [0, 9.6, 10.6], r: [1.6, 2.4, 1.8], mat: () => S, band: 'head' },
    { bone: 'chest', type: 'cone', a: [0, 15, 0], b: [0, 24, 0.5], r1: 4.8, r2: 4.4, mat: () => S, band: 'mid' },
    { bone: 'chest', type: 'ell', c: [0, 8, 0], r: [12, 11, 7.6], mat: () => S, band: 'mid', smooth: true },
    { bone: 'pelvis', type: 'ell', c: [0, 1, 0], r: [10, 9, 7.2], mat: () => S, band: 'mid', smooth: true },
    limb('uarmL', SK.upperArm, 4.3, 3.6, () => S), limb('uarmR', SK.upperArm, 4.3, 3.6, () => S),
    limb('farmL', SK.foreArm, 3.5, 2.9, () => S), limb('farmR', SK.foreArm, 3.5, 2.9, () => S),
    { bone: 'handL', type: 'ell', c: [0, -3.2, 0.6], r: [2.7, 3.7, 2.5], mat: () => S, band: 'limb' },
    { bone: 'handR', type: 'ell', c: [0, -3.2, 0.6], r: [2.7, 3.7, 2.5], mat: () => S, band: 'limb' },
    limb('thighL', SK.thigh, 5.8, 4.4, () => S, 'mid'), limb('thighR', SK.thigh, 5.8, 4.4, () => S, 'mid'),
    limb('shinL', SK.shin, 4.2, 3.1, () => S, 'mid'), limb('shinR', SK.shin, 4.2, 3.1, () => S, 'mid'),
    { bone: 'footL', type: 'box', c: [0, -2.5, 2.5], h: [3, 1.8, 5.5], rad: 1.6, mat: () => S, band: 'mid' },
    { bone: 'footR', type: 'box', c: [0, -2.5, 2.5], h: [3, 1.8, 5.5], rad: 1.6, mat: () => S, band: 'mid' },
  ];
}

// ================= HAIR =================
function hairShort(o = {}) {
  const c = o.hairColor || HAIR;
  const m = (p) => ({ c, tone: fract(p.x * 0.45 + p.y * 0.22 + p.z * 0.3) < 0.28 ? -1 : 0, gloss: true });
  return [
    { bone: 'head', type: 'ell', c: [0, 14, -0.8], r: [11.6, 12.6, 11.8], cut: [[0, -1, 0.55, -10.6]], mat: m, band: 'head' },
    { bone: 'head', type: 'box', c: [10.3, 9.5, 3.4], h: [0.9, 2.6, 1.6], rad: 0.6, mat: m, band: 'head' },
    { bone: 'head', type: 'box', c: [-10.3, 9.5, 3.4], h: [0.9, 2.6, 1.6], rad: 0.6, mat: m, band: 'head' },
  ];
}
function hairBraids(o = {}) {
  const c = o.hairColor || HAIR, m = (p) => ({ c, tone: fract(p.y * 0.5) < 0.35 ? -1 : 0 });
  const out = [{ bone: 'head', type: 'ell', c: [0, 14, -0.6], r: [11.5, 12.5, 11.6], cut: [[0, -1, 0.5, -10.2]], mat: (p) => ({ c, tone: fract((Math.atan2(p.x, p.z) / D + 180) / 22) < 0.22 ? -1 : 0 }), band: 'head' }];
  for (let i = 0; i < 9; i++) { const a = (-100 + i * 25) * D, x = Math.sin(a) * 9.6, z = Math.cos(a) * 9.6 - 1.5; if (Math.cos(a) > 0.55) continue; out.push({ bone: 'head', type: 'cone', a: [x, 10, z], b: [x * 1.05, -10 - (i % 3), z * 1.15 - 2], r1: 1.7, r2: 1.2, mat: m, band: 'back', ref: 'chest' }); }
  return out;
}

// ================= HEADWEAR / FACE =================
function capBlack() {
  const emb = (p) => { const ax = Math.abs(p.x); if (p.z > 8 && near(p.y, 21, 2.1) && ax < 2.2) return { c: PAL.gold, kind: 'metal', gloss: true }; return null; };
  const crown = (p) => { const e = emb(p); if (e) return e; const a = Math.atan2(p.x, p.z) / D; const seam = fract((a + 180) / 60) < 0.05 && p.y > 17; if (p.y > 25) return { c: PAL.black2, tone: 1 }; return { c: PAL.black, tone: seam ? -1 : 0, gloss: true }; };
  return [
    { bone: 'head', type: 'ell', c: [0, 17, -0.8], r: [12.2, 10.2, 12.2], cut: [[0, -1, 0, -16.4]], mat: crown, band: 'head' },
    { bone: 'head', type: 'ell', c: [0, 17.8, 11.2], r: [9.4, 1.2, 7.2], rot: null, mat: (p) => ({ c: PAL.black, tone: p.z > 15.5 ? 1 : 0 }), band: 'head' },
    { bone: 'head', type: 'ell', c: [0, 26.6, -0.8], r: [1.4, 0.9, 1.4], mat: () => ({ c: PAL.black2 }), band: 'head' },
  ];
}
function shades() {
  // two wrap lenses on a thin bridge; mirrored cyan glint on the upper edge
  const lens = (p) => { if (p.y > 13.5 && Math.abs(p.x) > 2.6 && Math.abs(p.x) < 5) return { c: PAL.cyan, flat: 2 }; return { c: '#0b0d12', flat: p.y > 12.9 ? 1 : 0 }; };
  return [
    { bone: 'head', type: 'box', c: [4.3, 12.6, 10.2], h: [3.4, 1.6, 1.2], rad: 1, mat: lens, band: 'head' },
    { bone: 'head', type: 'box', c: [-4.3, 12.6, 10.2], h: [3.4, 1.6, 1.2], rad: 1, mat: lens, band: 'head' },
    { bone: 'head', type: 'box', c: [0, 13.4, 10.9], h: [1.4, 0.45, 0.5], rad: 0.3, mat: () => ({ c: '#2a2f38' }), band: 'head' },
    { bone: 'head', type: 'box', c: [8.4, 13.2, 5.5], h: [0.5, 0.45, 4.6], rad: 0.3, rot: null, mat: () => ({ c: '#0b0d12' }), band: 'head' },
    { bone: 'head', type: 'box', c: [-8.4, 13.2, 5.5], h: [0.5, 0.45, 4.6], rad: 0.3, mat: () => ({ c: '#0b0d12' }), band: 'head' },
  ];
}

// ================= TOPS =================
function teeWhite() {
  const m = (p) => { if (p.y > 19.2) return { c: PAL.white, tone: -1 }; return { c: PAL.white, tone: fract(p.x * 0.18 + 0.2) < 0.08 && p.y < 4 ? -1 : 0 }; };
  return [
    { bone: 'chest', type: 'ell', c: [0, 8, 0], r: [12.9, 11.8, 8.4], mat: m, band: 'mid', smooth: true },
    { bone: 'pelvis', type: 'ell', c: [0, 1.6, 0], r: [11, 9.4, 7.9], cut: [[0, -1, 0, 5.5]], mat: (p) => ({ c: PAL.white, tone: p.y < -4.4 ? -1 : 0 }), band: 'mid', smooth: true },
    limb('uarmL', 8.5, 5.3, 4.9, () => ({ c: PAL.white })), limb('uarmR', 8.5, 5.3, 4.9, () => ({ c: PAL.white })),
  ];
}

// ================= OUTERWEAR =================
// Golden sample: black baffled puffer body, orange hood lining + zip trim + shoulder yoke, sleeves orange fading
// through flame tongues into cream with black cuffs. Front is open (shows the tee).
function nsJacket(o = {}) {
  const body = o.body || PAL.black, acc = o.accent || PAL.orange, low = o.low || PAL.cream, cuff = o.cuff || PAL.black;
  const quilt = (y) => fract(y / 5.2) < 0.2;
  const torso = (p) => {
    const ax = Math.abs(p.x);
    if (p.z > 0 && ax < 2.6 && p.y < 19) return { c: null };                                   // open front
    if (p.z > 0 && ax < 4.1 && p.y < 20) return { c: acc, tone: ax < 3.2 ? -1 : 0 };         // zip tape + trim
    if (p.z > 3 && near(p.x, 7.6, 1.6) && near(p.y, 12.8, 1.1)) return { c: PAL.gold, kind: 'metal' }; // chest patch (fictional mark)
    if (p.z < -2 && p.y > 13) return { c: acc, tone: quilt(p.y + 1) ? -1 : 0 };                // back yoke
    if (p.y > 17.5 && ax > 9) return { c: acc };                                                 // shoulder caps
    return { c: body, tone: quilt(p.y) ? -1 : 0, gloss: true };
  };
  const hem = (p) => { const ax = Math.abs(p.x); if (p.z > 0 && ax < 2.6) return { c: null }; if (p.z > 0 && ax < 4.1) return { c: acc, tone: -1 }; if (p.y < -2.6) return { c: cuff, tone: fract(p.x * 0.5) < 0.3 ? -1 : 0 }; return { c: body, tone: quilt(p.y + 12) ? -1 : 0, gloss: true }; };
  const upper = (side) => (p) => { const a = ang(p.x, p.z), outer = side * a; const flame = -9 + 3.2 * Math.sin(a * D * 3) + 1.5 * Math.sin(a * D * 7); if (p.y > flame) return { c: acc, tone: quilt(p.y + 40) ? -1 : 0, gloss: true }; return { c: low, tone: quilt(p.y + 40) ? -1 : 0 }; };
  const fore = (side) => (p) => { const a = ang(p.x, p.z); if (p.y < -10.5) return { c: cuff, tone: fract(a / 18) < 0.3 ? -1 : 0 }; if (near(p.y, -9.3, 0.8)) return { c: acc }; if (side * a > 40 && side * a < 120 && near(p.y, -4.5, 2.2)) return { c: PAL.black2 }; return { c: low, tone: quilt(p.y + 40) ? -1 : 0 }; };
  return [
    { bone: 'chest', type: 'ell', c: [0, 7.4, -0.3], r: [15.6, 13.6, 11.4], mat: torso, band: 'mid', smooth: true },
    { bone: 'pelvis', type: 'ell', c: [0, 4.2, -0.2], r: [14, 9.6, 10.6], cut: [[0, -1, 0, 4.2]], mat: hem, band: 'mid', smooth: true },
    { bone: 'chest', type: 'ell', c: [0, 22, -5.6], r: [9.6, 5.4, 6.4], mat: (p) => ({ c: p.z > -4.5 && p.y > 21 ? acc : body, tone: p.z > -4.5 ? -1 : 0 }), band: 'back', ref: 'head' },
    { bone: 'chest', type: 'torus', c: [0, 20.2, 0.4], R: 6.4, r: 2.4, sx: 1.05, sz: 1, mat: (p) => ({ c: p.z > 0 ? acc : body }), band: 'mid' },
    limb('uarmL', SK.upperArm + 1, 6.9, 6.1, upper(1)), limb('uarmR', SK.upperArm + 1, 6.9, 6.1, upper(-1)),
    limb('farmL', SK.foreArm - 1.4, 6, 4.8, fore(1)), limb('farmR', SK.foreArm - 1.4, 6, 4.8, fore(-1)),
  ];
}
function hoodieBlack(o = {}) {
  const c = o.body || PAL.black2;
  const torso = (p) => { const ax = Math.abs(p.x); if (p.z > 6 && p.y > -4 && p.y < 4 && ax < 7) return { c, tone: (near(p.y, 3.6, 0.5) || near(ax, 6.6, 0.5)) ? -1 : 1 }; if (p.z > 6 && near(ax, 2.2, 0.55) && p.y > 8 && p.y < 19) return { c: PAL.white, flat: 2 }; return { c, tone: near(p.y, -7, 0.9) ? -1 : 0 }; };
  return [
    { bone: 'chest', type: 'ell', c: [0, 7.4, 0], r: [14.4, 13, 9.8], mat: torso, band: 'mid', smooth: true },
    { bone: 'pelvis', type: 'ell', c: [0, 3.2, 0], r: [12.6, 9.4, 9.2], cut: [[0, -1, 0, 6]], mat: (p) => ({ c, tone: p.y < -4.6 ? -1 : 0 }), band: 'mid', smooth: true },
    { bone: 'chest', type: 'ell', c: [0, 21.6, -6.2], r: [10.4, 6.6, 6.8], mat: (p) => ({ c, tone: p.z > -4 ? -1 : 0 }), band: 'back', ref: 'head' },
    { bone: 'chest', type: 'cone', a: [2.2, 18, 9.4], b: [2.4, 9, 10.2], r1: 0.6, r2: 0.6, mat: () => ({ c: PAL.white }), band: 'mid' },
    { bone: 'chest', type: 'cone', a: [-2.2, 18, 9.4], b: [-2.4, 9.8, 10.2], r1: 0.6, r2: 0.6, mat: () => ({ c: PAL.white }), band: 'mid' },
    limb('uarmL', SK.upperArm + 1, 5.8, 5.2, () => ({ c })), limb('uarmR', SK.upperArm + 1, 5.8, 5.2, () => ({ c })),
    limb('farmL', SK.foreArm - 1, 5, 4.2, (p) => ({ c, tone: p.y < -10.5 && fract(p.x) < 0.4 ? -1 : 0 })), limb('farmR', SK.foreArm - 1, 5, 4.2, (p) => ({ c, tone: p.y < -10.5 && fract(p.x) < 0.4 ? -1 : 0 })),
  ];
}

// ================= BOTTOMS =================
function cargoBlack(o = {}) {
  const c = o.body || '#1c1e24', pipe = o.pipe || '#dcd6cc';
  const thigh = (side) => (p) => {
    const a = side * ang(p.x, p.z);
    if (near(a, 92, 7)) return { c: pipe, flat: 2 };                                            // side piping
    if (a > 38 && a < 140 && p.y < -7.5 && p.y > -17.5) {                                        // bellows pocket
      if (near(p.y, -8.6, 0.7) || near(p.y, -16.8, 0.7) || near(a, 40, 4) || near(a, 138, 4)) return { c: pipe, flat: 2 };
      if (near(p.y, -10.6, 0.8)) return { c, tone: -1 };
      return { c, tone: 1 };
    }
    if (near(a, -10, 4) && p.y > -6) return { c, tone: -1 };                                     // front crease
    return { c };
  };
  const shin = (side) => (p) => { const a = side * ang(p.x, p.z); if (near(a, 92, 7)) return { c: pipe, flat: 2 }; if (p.y < -13.8) return { c, tone: fract(a / 30) < 0.25 ? -1 : 0 }; if (near(fract((p.y + a * 0.04) / 4.5), 0.5, 0.08) && p.y < -8) return { c, tone: -1 }; return { c }; };
  return [
    { bone: 'pelvis', type: 'ell', c: [0, 0.4, 0], r: [11.6, 6.6, 8.8], mat: (p) => ({ c, tone: near(p.y, 5.2, 0.8) ? -1 : 0 }), band: 'mid', smooth: true },
    limb('thighL', SK.thigh, 7.6, 7, thigh(1), 'mid', { smooth: true }), limb('thighR', SK.thigh, 7.6, 7, thigh(-1), 'mid', { smooth: true }),
    limb('shinL', SK.shin - 4, 7, 6.2, shin(1), 'mid'), limb('shinR', SK.shin - 4, 7, 6.2, shin(-1), 'mid'),
    { bone: 'shinL', type: 'ell', c: [0, -14.4, 0.3], r: [6.8, 3, 6.9], mat: shin(1), band: 'mid' },
    { bone: 'shinR', type: 'ell', c: [0, -14.4, 0.3], r: [6.8, 3, 6.9], mat: shin(-1), band: 'mid' },
  ];
}
function jeansBlue(o = {}) {
  const c = o.body || '#3a5a8a', st = '#c79a52';
  const leg = (side) => (p) => { const a = side * ang(p.x, p.z); if (near(a, 90, 3.5) || near(a, -90, 3.5)) return { c: st, flat: 2 }; if (p.y < -16.8) return { c, tone: 1 }; return { c, tone: fract((p.x + p.z) * 0.12 + p.y * 0.04) < 0.12 ? 1 : 0 }; };
  return [
    { bone: 'pelvis', type: 'ell', c: [0, 0.4, 0], r: [10.8, 6.4, 8.2], mat: (p) => { const ax = Math.abs(p.x); if (p.z < -5 && ax > 2 && ax < 7 && p.y < 2 && p.y > -4) return { c, tone: near(p.y, 1.6, 0.6) ? -1 : 1 }; if (near(p.y, 5, 0.9)) return { c, tone: -1 }; if (p.z > 6 && near(ax, 0.6, 0.6)) return { c: st, flat: 2 }; return { c }; }, band: 'mid', smooth: true },
    limb('thighL', SK.thigh, 6.6, 5.8, leg(1), 'mid', { smooth: true }), limb('thighR', SK.thigh, 6.6, 5.8, leg(-1), 'mid', { smooth: true }),
    limb('shinL', SK.shin - 1.5, 5.7, 5.2, leg(1), 'mid'), limb('shinR', SK.shin - 1.5, 5.7, 5.2, leg(-1), 'mid'),
  ];
}

// ================= SHOES =================
function sneakersRedWhite(o = {}) {
  const red = o.accent || PAL.red, wh = PAL.white;
  const upper = (p) => {
    if (p.y > -0.4 && p.z > 0.2 && p.z < 7 && Math.abs(p.x) < 2.4) return { c: fract(p.z / 1.6) < 0.5 ? '#2a2d34' : wh, flat: fract(p.z / 1.6) < 0.5 ? 1 : 3 }; // laces
    if (p.z < -1.5) return { c: red };                                                              // heel counter
    if (p.z > 6.4) return { c: red, tone: 0 };                                                      // toe cap
    if (Math.abs(p.x) > 2.6 && near(p.y, -1.6, 1.1) && p.z > -1 && p.z < 6) return { c: '#1c1e24' }; // side stripe (fictional)
    return { c: wh };
  };
  const sole = (p) => ({ c: near(p.y, -2.8, 0.7) ? red : wh, tone: p.y < -4.6 ? -1 : 0 });
  const out = [];
  for (const s of ['L', 'R']) {
    out.push({ bone: 'foot' + s, type: 'box', c: [0, -0.8, 2.6], h: [4.9, 3.4, 7.2], rad: 2.8, mat: upper, band: 'mid' });
    out.push({ bone: 'foot' + s, type: 'box', c: [0, -3.7, 2.8], h: [5.6, 1.8, 8.3], rad: 1.3, mat: sole, band: 'mid' });
    out.push({ bone: 'shin' + s, type: 'cone', a: [0, -13.5, -0.4], b: [0, -18.6, -0.6], r1: 5, r2: 5.4, mat: (p) => ({ c: p.z < -2 ? red : wh, tone: -1 }), band: 'mid' });
  }
  return out;
}
function bootsBlack(o = {}) {
  const c = o.body || '#22201e';
  const out = [];
  for (const s of ['L', 'R']) {
    out.push({ bone: 'shin' + s, type: 'cone', a: [0, -9.5, 0], b: [0, -18.6, 0.4], r1: 4.8, r2: 5.2, mat: (p) => ({ c, tone: p.z > 3.5 && fract(p.y / 2) < 0.5 ? 1 : near(p.y, -10, 0.7) ? -1 : 0 }), band: 'mid' });
    out.push({ bone: 'foot' + s, type: 'box', c: [0, -1.4, 2.4], h: [4.6, 3.2, 6.8], rad: 2.4, mat: (p) => ({ c, tone: p.y > 0 && p.z > 1 && fract(p.z / 1.8) < 0.45 ? 1 : 0, gloss: true }), band: 'mid' });
    out.push({ bone: 'foot' + s, type: 'box', c: [0, -4, 2.6], h: [5.1, 1.5, 7.6], rad: 0.9, mat: (p) => ({ c: '#121214', tone: fract(p.z / 1.6) < 0.4 ? -1 : 0 }), band: 'mid' });
  }
  return out;
}

// ================= ACCESSORIES =================
function necklaceGold() {
  const m = (p) => ({ c: PAL.gold, kind: 'metal', gloss: true, tone: fract((Math.atan2(p.x, p.z) / D + 180) / 9) < 0.4 ? -1 : 0 });
  return [
    { bone: 'chest', type: 'torus', c: [0, 15.6, 1.2], R: 7.6, r: 0.75, sx: 1, sz: 1.08, rot: null, cut: [[0, 0, -1, -1]], mat: m, band: 'mid' },
    { bone: 'chest', type: 'ell', c: [0, 11.2, 8.9], r: [1.7, 2.3, 0.9], mat: () => ({ c: PAL.gold, kind: 'metal', gloss: true }), band: 'mid' },
  ];
}
function watchBlack() {
  return [{ bone: 'farmL', type: 'torus', c: [0, -11.8, 0], R: 3.5, r: 1.1, mat: (p) => ({ c: p.z > 2 && Math.abs(p.x) < 1.6 ? '#3a4049' : '#121418', gloss: true, tone: p.z > 2.8 ? 1 : 0 }), band: 'limb' }];
}
function backpackBlack(o = {}) {
  const c = o.body || '#1d2024';
  const pack = (p) => { if (p.z < -13 && near(p.y, 2, 0.6)) return { c: PAL.orange }; if (p.z < -12.5 && p.y < 1 && p.y > -7 && Math.abs(p.x) < 6) return { c, tone: near(p.y, 0.6, 0.5) ? -1 : 1 }; return { c, tone: fract(p.x / 6) < 0.06 ? -1 : 0 }; };
  const strap = () => ({ c: '#16181c', tone: 0 });
  return [
    { bone: 'chest', type: 'box', c: [0, 5.4, -11.8], h: [9.4, 10.6, 3.6], rad: 3, mat: pack, band: 'back', ref: 'chest' },
    { bone: 'chest', type: 'box', c: [0, 1, -14.6], h: [6.4, 5.4, 1.6], rad: 1.4, mat: pack, band: 'back', ref: 'chest' },
    { bone: 'chest', type: 'cone', a: [7.4, 17.6, -8], b: [7.8, 18.6, 3], r1: 1.3, r2: 1.3, mat: strap, band: 'mid' },
    { bone: 'chest', type: 'cone', a: [7.8, 18.6, 3], b: [7.4, 1, 9.6], r1: 1.3, r2: 1.3, mat: strap, band: 'mid' },
    { bone: 'chest', type: 'cone', a: [-7.4, 17.6, -8], b: [-7.8, 18.6, 3], r1: 1.3, r2: 1.3, mat: strap, band: 'mid' },
    { bone: 'chest', type: 'cone', a: [-7.8, 18.6, 3], b: [-7.4, 1, 9.6], r1: 1.3, r2: 1.3, mat: strap, band: 'mid' },
  ];
}

// slot → item builders. id = production asset id (backlog); wardrobe = the existing game item it renders.
const ITEMS = {
  character_base_body: { slot: 'body', build: body, wardrobe: null, recolor: { skin: { base: SKINS[3], kind: 'skin' } } },
  character_hair_short: { slot: 'hair', build: hairShort, wardrobe: { hair: 'short' }, recolor: { hair: { base: HAIR } } },
  character_hair_braids: { slot: 'hair', build: hairBraids, wardrobe: { hair: 'braids' }, recolor: { hair: { base: HAIR } } },
  character_cap_black: { slot: 'head', build: capBlack, wardrobe: { id: 'cap' }, recolor: { item: { base: PAL.black } } },
  character_facewear_sunglasses: { slot: 'face', build: shades, wardrobe: { id: 'shades' } },
  character_tee_white: { slot: 'top', build: teeWhite, wardrobe: { id: 'tee' }, recolor: { item: { base: PAL.white } } },
  character_hoodie_black: { slot: 'outer', build: hoodieBlack, wardrobe: { id: 'hoodie' }, recolor: { item: { base: PAL.black2 } } },
  character_jacket_orange_black: { slot: 'outer', build: nsJacket, wardrobe: { id: 'nsjacket' } },
  character_jacket_purple: { slot: 'outer', build: (o) => nsJacket({ body: '#2a1c3c', accent: PAL.violet, low: '#c9b8ec', cuff: '#1b1d24', ...o }), wardrobe: { id: 'nsjacket', variant: 'purple' } },
  character_cargo_pants_black: { slot: 'bottom', build: cargoBlack, wardrobe: { id: 'cargo' }, recolor: { item: { base: '#1c1e24' } } },
  character_jeans_blue: { slot: 'bottom', build: jeansBlue, wardrobe: { id: 'jeans' }, recolor: { item: { base: '#3a5a8a' } } },
  character_sneakers_red_white: { slot: 'shoes', build: sneakersRedWhite, wardrobe: { id: 'hitops' }, recolor: { item: { base: PAL.red } } },
  character_boots_black: { slot: 'shoes', build: bootsBlack, wardrobe: { id: 'boots' }, recolor: { item: { base: '#22201e' } } },
  character_backpack_black: { slot: 'bag', build: backpackBlack, wardrobe: { id: 'backpack' }, recolor: { item: { base: '#1d2024' } } },
  character_necklace_gold: { slot: 'jewelry', build: necklaceGold, wardrobe: { id: 'chain' } },
  character_watch_black: { slot: 'watch', build: watchBlack, wardrobe: { id: 'watch' } },
};
// composite order inside a band (shoes before bottoms so stacked cargos sit over the sneaker collar)
const SLOT_ORDER = ['body', 'shoes', 'bottom', 'top', 'outer', 'jewelry', 'bag', 'watch', 'hair', 'head', 'face'];
const BANDS = ['far', 'mid', 'near', 'head', 'over'];
module.exports = { ITEMS, SLOT_ORDER, BANDS, PAL, SKINS };
