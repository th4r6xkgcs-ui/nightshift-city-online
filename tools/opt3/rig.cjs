'use strict';
// Option 3 character rig (Claude-owned). Body-local axes: +y up, +z forward (facing), +x = the character's LEFT.
// Proportions follow the golden sample: ~4.2 heads tall including the cap, long legs, wide shoulders.
const { I3, mul3, rx, ry, rz, apply3 } = require('./core.cjs');
const D = Math.PI / 180;

// Direction order of the atlas contract and the facing yaw for each (S faces the camera).
const DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
const YAW = { S: 0, SW: -45, W: -90, NW: -135, N: 180, NE: 135, E: 90, SE: 45 };
const ANIMS = { idle: { frames: 4, ms: 220 }, walk: { frames: 8, ms: 100 }, run: { frames: 8, ms: 75 }, aim: { frames: 2, ms: 300 }, aimwalk: { frames: 8, ms: 100 } };

const SK = {
  pelvisY: 46, chest: 12, neck: 22, headC: [0, 12.5, 0.6], headR: 12.2,
  shoulderX: 13.5, shoulderY: 17.5, upperArm: 16, foreArm: 14, hand: 6.5,
  hipX: 6.4, hipY: -2, thigh: 21, shin: 19, ankleY: 4,
};

function pose(anim, f) {
  const n = ANIMS[anim].frames, ph = (2 * Math.PI * f) / n, s = Math.sin(ph), c = Math.cos(ph);
  const P = { bob: 0, lean: 0, twist: 0, head: 0, breathe: 0, armL: { fwd: 4, out: 8, bend: 14 }, armR: { fwd: 4, out: 8, bend: 14 }, legL: { flex: 0, bend: 3 }, legR: { flex: 0, bend: 3 }, stanceW: 0 };
  if (anim === 'idle') { P.breathe = [0, 0.5, 0.8, 0.4][f % 4]; P.bob = -P.breathe * 0.3; P.armL.out = 9 + P.breathe; P.armR.out = 9 + P.breathe; P.head = [0, 0, 1.5, 0.5][f % 4]; P.stanceW = 1.2; }
  if (anim === 'walk' || anim === 'aimwalk') {
    const A = 27;
    P.legL.flex = A * s; P.legR.flex = -A * s;
    P.legL.bend = 5 + 40 * Math.pow(Math.max(0, c), 1.4); P.legR.bend = 5 + 40 * Math.pow(Math.max(0, -c), 1.4);
    P.bob = 1.1 * Math.cos(2 * ph) - 0.4; P.twist = 6 * s; P.lean = 3;
    P.armL.fwd = -22 * s; P.armR.fwd = 22 * s; P.armL.bend = 16 + 10 * Math.max(0, -s); P.armR.bend = 16 + 10 * Math.max(0, s); P.armL.out = P.armR.out = 7;
  }
  if (anim === 'run') {
    const A = 40;
    P.legL.flex = A * s + 6; P.legR.flex = -A * s + 6;
    P.legL.bend = 20 + 75 * Math.pow(Math.max(0, c), 1.2); P.legR.bend = 20 + 75 * Math.pow(Math.max(0, -c), 1.2);
    P.bob = 2.6 * Math.cos(2 * ph) + 0.5; P.lean = 11; P.twist = 10 * s;
    P.armL.fwd = -38 * s - 6; P.armR.fwd = 38 * s - 6; P.armL.bend = P.armR.bend = 82; P.armL.out = P.armR.out = 10;
  }
  if (anim === 'aim' || anim === 'aimwalk') {
    // two-handed hold: right (gun) arm straight out front, left supports from across the body
    P.armR = { fwd: -84, out: -8, bend: 6 }; P.armL = { fwd: -74, out: -26, bend: 22 }; P.twist = anim === 'aim' ? -6 : P.twist * 0.4 - 6; P.lean = 2;
    if (anim === 'aim') { P.breathe = f ? 0.4 : 0; P.stanceW = 2.5; P.legL.flex = 6; P.legR.flex = -6; }
  }
  return P;
}

/** Bone world transforms for a direction/animation/frame. */
function bones(dir, anim, f) {
  const P = pose(anim, f), a = YAW[dir] * D, B = {};
  const put = (name, parent, off, R) => { const pb = parent ? B[parent] : { R: I3(), T: [0, 0, 0] }; const o = apply3(pb.R, off); B[name] = { R: mul3(pb.R, R), T: [pb.T[0] + o[0], pb.T[1] + o[1], pb.T[2] + o[2]] }; };
  put('root', null, [0, P.bob, 0], mul3(ry(a), rx(P.lean * D)));
  put('pelvis', 'root', [0, SK.pelvisY, 0], ry(-P.twist * 0.4 * D));
  put('chest', 'pelvis', [0, SK.chest + P.breathe * 0.4, 0], ry(P.twist * D));
  put('head', 'chest', [0, SK.neck, 0], mul3(ry(-P.twist * 0.6 * D), rx(P.head * D)));
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const A = side === 'L' ? P.armL : P.armR, G = side === 'L' ? P.legL : P.legR;
    put('uarm' + side, 'chest', [sx * SK.shoulderX, SK.shoulderY, 0], mul3(rz(sx * A.out * D), rx(-A.fwd * D)));
    put('farm' + side, 'uarm' + side, [0, -SK.upperArm, 0], rx(-A.bend * D));
    put('hand' + side, 'farm' + side, [0, -SK.foreArm, 0], I3());
    put('thigh' + side, 'pelvis', [sx * (SK.hipX + P.stanceW), SK.hipY, 0], mul3(rz(sx * 2 * D), rx(-G.flex * D)));
    put('shin' + side, 'thigh' + side, [0, -SK.thigh, 0], rx(G.bend * D));
    put('foot' + side, 'shin' + side, [0, -SK.shin, 0], rx((G.flex - G.bend) * D - sx * 0 + 0));
  }
  return { bones: B, pose: P, dir, anim, f };
}
module.exports = { DIRS, YAW, ANIMS, SK, pose, bones, D };
