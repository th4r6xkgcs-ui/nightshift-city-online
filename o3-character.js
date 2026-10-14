/* Option 3 characters (Claude-owned). Layered 96x128 pixel characters, 8 real directions, all game animations.
 * Built on o3-engine.js; pure JS (browser + Node). Golden sample: black cap, wraparound shades, gold chain, white
 * tee, orange/black two-tone puffer, black cargos with white piping, red/white court sneakers.
 * Every item renders into its own transparent layer, split into passes (far / main / near) so limbs and back items
 * occlude correctly per facing; the composite is those exact layers in order (what the game and studio show).
 * Outfits use the wardrobe format (wardrobe-data.js). supports(outfit) tells the game whether every piece has
 * Option 3 art; anything else keeps the previous renderer until it's authored.
 * Animations (frame counts match character-art.js): idle 6, walk 12, run 10, crouch 4, sneak 10, sit 4; holds '' |
 * 'short' | 'long'. API: NightshiftO3Character.{render, supports, ITEMS, LAYERS, PASSES, ANIMS, pose, anchors} */
(function (root) {
  'use strict';
  const E = root.NightshiftO3Engine || (typeof require === 'function' ? require('./o3-engine.js') : null);
  const W = root.NightshiftWardrobeData || (typeof require === 'function' ? (() => { try { return require('./wardrobe-data.js'); } catch { return null; } })() : null);
  const { ramp, capsule, ellipsoid, loft, stamp, line, px, ringLine, seamLine, onLoft, facing, intersect, subtract, union, polygon, mix, bandY } = E;
  const ANIMS = { idle: 6, walk: 12, run: 10, crouch: 4, sneak: 10, sit: 4 };
  const PASSES = ['far', 'main', 'near'];
  // draw order inside each pass, back to front
  const LAYERS = ['bag', 'hairback', 'body', 'shoes', 'bottom', 'top', 'outer', 'jewelry', 'face', 'hair', 'head', 'hands', 'wrist', 'gloves'];
  const SKIN = ['#f6d3b3', '#eabf98', '#d7a477', '#bf8556', '#9c6a43', '#7a4e30', '#5a3824', '#41281a'];
  const HAIRC = ['#141216', '#2e2119', '#4f3424', '#7a5232', '#b07e44', '#d8b878', '#e8e2d8', '#8a2e24', '#3a3a8a', '#d85aa0'];

  // ---------------- skeleton + pose ----------------
  const SK = { ankle: 8, thigh: 15.5, shin: 15, hipW: 6, hipY: 38.5, shY: 66, shW: 13.4, upper: 13, fore: 12, neckY: 69, headY: 82, head: [11, 12.6, 11] };
  const rot = (a, b) => [Math.sin(a) * b, -Math.cos(a) * b]; // angle from vertical (forward +) → [dz, dy]
  /** Joint positions (local, y up) for an animation frame. */
  function pose(anim, f, hold = '', build = 1) {
    const n = ANIMS[anim] || 1, k = ((f % n) + n) % n, ph = (2 * Math.PI * k) / n;
    let thigh = [0, 0], bend = [0.06, 0.06], arm = [0.04, -0.04], flex = [0.18, 0.18], lean = 0, bob = 0, drop = 0, spread = anim === 'idle' ? 2.2 : 1.2;
    if (anim === 'walk') { const s = Math.sin(ph); thigh = [0.42 * s, -0.42 * s]; bend = [0.1 + 0.55 * Math.max(0, Math.cos(ph)), 0.1 + 0.55 * Math.max(0, -Math.cos(ph))]; arm = [-0.36 * s, 0.36 * s]; flex = [0.22 + 0.2 * Math.max(0, -s), 0.22 + 0.2 * Math.max(0, s)]; }
    else if (anim === 'run') { const s = Math.sin(ph); thigh = [0.78 * s, -0.78 * s]; bend = [0.3 + 1.15 * Math.max(0, Math.cos(ph)), 0.3 + 1.15 * Math.max(0, -Math.cos(ph))]; arm = [-0.72 * s, 0.72 * s]; flex = [1.35, 1.35]; lean = 0.2; bob = 1.5 * Math.abs(Math.cos(ph)); }
    else if (anim === 'idle') { bob = [0, 0, 1, 1, 1, 0][k] * -0.6; flex = [0.2 + 0.04 * Math.sin(ph), 0.2 + 0.04 * Math.sin(ph)]; }
    else if (anim === 'crouch' || anim === 'sneak') { const s = anim === 'sneak' ? Math.sin(ph) : 0; thigh = [1.1 + 0.25 * s, 1.1 - 0.25 * s]; bend = [2.1, 2.1]; lean = 0.32; arm = [0.25 - 0.2 * s, 0.25 + 0.2 * s]; flex = [0.9, 0.9]; }
    else if (anim === 'sit') { thigh = [1.45, 1.45]; bend = [1.5, 1.5]; arm = [0.35, 0.35]; flex = [1.1, 1.1]; spread = 0.12; }
    const J = { legs: [], arms: [], lean, build };
    // legs (side: +1 = right, -1 = left)
    const legs = [1, -1].map((side, i) => {
      const hip = [side * SK.hipW * build, SK.hipY, 0], [dz1, dy1] = rot(thigh[i], SK.thigh), knee = [hip[0] + side * spread, hip[1] + dy1, hip[2] + dz1];
      const [dz2, dy2] = rot(thigh[i] - bend[i], SK.shin), ankle = [knee[0] + side * spread * 0.6, knee[1] + dy2, knee[2] + dz2];
      return { side, hip, knee, ankle };
    });
    // plant the lowest foot on the ground
    const low = Math.min(...legs.map((l) => l.ankle[1])), lift = SK.ankle - low + bob;
    for (const l of legs) for (const p of [l.hip, l.knee, l.ankle]) p[1] += lift;
    J.legs = legs; drop = lift;
    const shY = SK.shY + drop, leanZ = Math.sin(lean) * 26;
    J.pelvis = [0, SK.hipY + drop, 0]; J.chest = [0, shY - 6, leanZ * 0.7]; J.shoulders = [0, shY, leanZ];
    J.neck = [0, SK.neckY + drop, leanZ * 1.05]; J.head = [0, SK.headY + drop - (anim === 'idle' ? bob * 0.5 : 0), leanZ * 1.15 + 0.5];
    // arms
    J.arms = [1, -1].map((side, i) => {
      const sh = [side * SK.shW * build, shY - 1.5, leanZ - 0.5];
      if (hold) return holdArm(side, sh, hold, J);
      const out = 0.2 + (anim === 'run' ? 0.08 : 0), [dz1, dy1] = rot(arm[i], SK.upper);
      const elbow = [sh[0] + side * Math.sin(out) * SK.upper, sh[1] + dy1 * Math.cos(out), sh[2] + dz1];
      const [dz2, dy2] = rot(arm[i] + flex[i], SK.fore), wrist = [elbow[0] + side * 0.6, elbow[1] + dy2, elbow[2] + dz2];
      return { side, sh, elbow, wrist };
    });
    return J;
  }
  // two-bone IK toward a gun grip in front of the chest
  function holdArm(side, sh, hold, J) {
    const long = hold === 'long', target = side > 0 ? [2.5, J.shoulders[1] - 8, long ? 12 : 15] : long ? [-1, J.shoulders[1] - 6, 23] : [1, J.shoulders[1] - 9, 13];
    const dx = target[0] - sh[0], dy = target[1] - sh[1], dz = target[2] - sh[2], d = Math.min(SK.upper + SK.fore - 0.5, Math.hypot(dx, dy, dz));
    const a = Math.acos(Math.max(-1, Math.min(1, (SK.upper ** 2 + d * d - SK.fore ** 2) / (2 * SK.upper * d)))), u = [dx / Math.hypot(dx, dy, dz), dy / Math.hypot(dx, dy, dz), dz / Math.hypot(dx, dy, dz)];
    const pole = [side * 0.8, -0.6, 0], pd = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2], pp = [pole[0] - pd * u[0], pole[1] - pd * u[1], pole[2] - pd * u[2]], pn = Math.hypot(...pp) || 1;
    const elbow = [0, 1, 2].map((i) => sh[i] + u[i] * Math.cos(a) * SK.upper + (pp[i] / pn) * Math.sin(a) * SK.upper);
    const wrist = [0, 1, 2].map((i) => sh[i] + u[i] * d);
    return { side, sh, elbow, wrist, hold: true };
  }

  // ---------------- render context ----------------
  function ctxFor(outfit, dir, anim, f, hold) {
    const v = E.view(dir), build = { slim: 0.9, regular: 1, broad: 1.12 }[outfit.build] || 1, J = pose(anim, f, hold, build), F = E.Frame();
    // 2.5D: joints swung toward the camera sit a little lower on screen (stepping reads from the front/back too)
    const tilt = (p, ref) => { p[1] -= 0.35 * (v.depth(p) - v.depth(ref)); };
    for (const l of J.legs) { tilt(l.knee, l.hip); tilt(l.ankle, l.hip); }
    for (const a of J.arms) { tilt(a.elbow, a.sh); tilt(a.wrist, a.sh); }
    const passOfSide = (side, isArm) => { const d = side * v.rz; if (d < -0.3) return 'far'; if (d > 0.3) return 'near'; return isArm ? 'near' : 'main'; };
    return { v, J, F, outfit, build, dir, anim, f, hold, passOfSide, buf: (layer, pass) => F.layer(layer + ':' + pass), skin: SKIN[outfit.skin] || SKIN[2], front: v.fz > 0.25, back: v.fz < -0.25, side: Math.abs(v.fz) <= 0.25 };
  }
  const leftRight = (c) => [...c.J.legs].sort((a, b) => c.v.depth(a.hip) - c.v.depth(b.hip)); // far first
  const armsSorted = (c) => [...c.J.arms].sort((a, b) => c.v.depth(a.sh) - c.v.depth(b.sh));

  // torso loft rows (local): from neck base down to hips; widths per build
  function torsoRows(c, o = {}) {
    const J = c.J, b = c.build, top = J.shoulders[1] + (o.top || 0), hip = J.pelvis[1] + (o.below || 0), lz = J.shoulders[2], pz = J.pelvis[2];
    const sw = (o.sw || 12.2) * b, cw = (o.cw || 11.4) * b, ww = (o.ww || 10.2) * b, hw = (o.hw || 10.8) * b, d = o.d || 7.2;
    return [{ y: top + 2.5, a: sw * 0.7, b: d * 0.75, oz: lz }, { y: top, a: sw, b: d, oz: lz }, { y: top - 8, a: cw, b: d + 0.4, oz: lz * 0.75 + (o.chest || 0) }, { y: hip + 9, a: ww, b: d - 0.4, oz: pz * 0.5 + lz * 0.3 }, { y: hip - (o.hem || 0), a: hw + (o.flare || 0), b: d - 0.2 + (o.flare || 0) * 0.5, oz: pz }];
  }

  // ---------------- base body ----------------
  function body(c) {
    const R = ramp(c.skin, 'skin'), v = c.v, J = c.J;
    // legs (usually covered; keeps seams honest when shorts/skirts are worn)
    for (const l of leftRight(c)) { const B = c.buf('body', c.passOfSide(l.side)); stamp(B, capsule(v, l.hip, l.knee, 5, 4.2).mask, R); stamp(B, capsule(v, l.knee, l.ankle, 4.1, 3).mask, R); }
    // briefs (never naked)
    const Bm = c.buf('body', 'main');
    stamp(Bm, loft(v, [{ y: J.pelvis[1] + 4, a: 10.6 * c.build, b: 6.8, oz: J.pelvis[2] }, { y: J.pelvis[1] - 4, a: 10.8 * c.build, b: 6.8, oz: J.pelvis[2] }]).mask, ramp('#23262e'));
    // torso, neck, head
    const T = loft(v, torsoRows(c)); stamp(Bm, T.mask, R);
    stamp(Bm, capsule(v, [0, J.shoulders[1] - 2, J.neck[2]], J.neck, 3.6, 3.3).mask, R);
    head(c, Bm, R);
    // arms + hands
    for (const a of armsSorted(c)) { const B = c.buf('body', c.passOfSide(a.side, true)); stamp(B, capsule(v, a.sh, a.elbow, 3.7, 3.1).mask, R); stamp(B, capsule(v, a.elbow, a.wrist, 3.0, 2.5).mask, R); hand(c, c.buf('hands', c.passOfSide(a.side, true)), a, R); }
  }
  function hand(c, B, a, R) { const v = c.v, d = [a.wrist[0] - a.elbow[0], a.wrist[1] - a.elbow[1], a.wrist[2] - a.elbow[2]], n = Math.hypot(...d) || 1, hc = a.wrist.map((p, i) => p + (d[i] / n) * 2.4); stamp(B, ellipsoid(v, hc, [2.7, 3.1, 2.4]).mask, R); a.hand = hc; }
  function head(c, B, R) {
    const v = c.v, J = c.J, H = SK.head, hc = J.head, Rh = R;
    // ears (behind the head silhouette where they should be)
    for (const side of [1, -1]) { const e = [side * (H[0] - 0.4), hc[1] - 1, hc[2] - 1]; if (v.depth(e) > -3) stamp(B, ellipsoid(v, e, [1.6, 2.8, 1.6]).mask, Rh); }
    const Hd = ellipsoid(v, hc, H); stamp(B, Hd.mask, Rh); c.headMask = Hd.mask; c.headC = Hd.c;
    // jaw: a slightly narrower lower half so faces aren't balls
    stamp(B, ellipsoid(v, [hc[0], hc[1] - 4.5, hc[2] + 1], [H[0] * 0.82, H[1] * 0.55, H[2] * 0.86]).mask, Rh);
    face(c, B, R);
  }
  // a point on the head surface: yaw from front (+ = character's right), height offset
  function headPt(c, yaw, dy, push = 0) { const H = SK.head, hc = c.J.head, p = [hc[0] + Math.sin(yaw) * (H[0] + push), hc[1] + dy, hc[2] + Math.cos(yaw) * (H[2] + push)]; return { x: c.v.px(p), y: c.v.py(p), d: c.v.depth(p) - c.v.depth(hc) }; }
  function face(c, B, R) {
    const o = c.outfit, eye = '#151018', white = '#f4f1ea', brow = HAIRC[o.hairColor] || HAIRC[0];
    for (const side of [1, -1]) {
      const e = headPt(c, side * 0.42, -0.5); if (e.d < 2) continue;
      px(B, e.x, e.y, eye); px(B, e.x, e.y + 1, eye); px(B, e.x + (side * c.v.rx > 0 ? -1 : 1) * 0, e.y - 1, white);
      const b0 = headPt(c, side * 0.25, -3.2), b1 = headPt(c, side * 0.62, -3.6); if (b0.d > 1 && b1.d > 1) line(B, b0.x, b0.y, b1.x, b1.y, brow);
    }
    const n = headPt(c, 0, -4.5, 0.6); if (n.d > 2) { px(B, n.x, n.y, R[1]); px(B, n.x + (c.v.fx > 0.3 ? 1 : c.v.fx < -0.3 ? -1 : 0), n.y + 1, R[0]); }
    const m0 = headPt(c, -0.22, -7.6), m1 = headPt(c, 0.22, -7.6); if (m0.d > 1 || m1.d > 1) line(B, m0.x, m0.y, m1.x, m1.y, mix(R[0], '#5a1a24', 0.4));
    if (o.facial === 'stubble' || o.facial === 'beard' || o.facial === 'goatee') { const g0 = headPt(c, 0, -9.2); if (g0.d > 1) { px(B, g0.x - 1, g0.y, R[0]); px(B, g0.x + 1, g0.y, R[0]); px(B, g0.x, g0.y + 1, R[0]); } }
  }

  // ---------------- garments: tops ----------------
  function tee(c, item, col) {
    const R = ramp(col), v = c.v, J = c.J, B = c.buf('top', 'main');
    const T = loft(v, torsoRows(c, { sw: 12.8, cw: 12, ww: 11, hw: 11.6, d: 7.8, hem: item.tucked ? -3 : 3 })); stamp(B, T.mask, R);
    // crew neck rib + hem + side folds
    ringLine(B, v, T, J.shoulders[1] + 1.5, 0.35, Math.PI - 0.35, R[1], T.mask); ringLine(B, v, T, J.shoulders[1] + 0.5, 0.4, Math.PI - 0.4, R[3], T.mask);
    ringLine(B, v, T, J.pelvis[1] - 1.5, -0.2, Math.PI + 0.2, R[1], T.mask);
    for (const q of [0.95, 2.2]) seamLine(B, v, T, q, J.pelvis[1] + 8, J.pelvis[1] - 1, R[1], T.mask);
    for (const a of armsSorted(c)) { const P = c.buf('top', c.passOfSide(a.side, true)), mid = a.sh.map((p, i) => p + (a.elbow[i] - p) * 0.55); const S = capsule(v, a.sh, mid, 4.6, 4.2); stamp(P, S.mask, R); line(P, ...edgeAt(S, 0.95, -1), ...edgeAt(S, 0.95, 1), R[1], S.mask); }
    c.teeMask = T.mask;
  }
  function edgeAt(S, t, side) { const x = S.a[0] + (S.b[0] - S.a[0]) * t, y = S.a[1] + (S.b[1] - S.a[1]) * t, r = (S.ra + (S.rb - S.ra) * t) - 0.5; return [x - S.uy * r * side, y + S.ux * r * side]; }

  // long sleeve helper for outerwear: upper + fore with cuff
  function sleeve(c, layer, a, R, o = {}) {
    const v = c.v, P = c.buf(layer, c.passOfSide(a.side, true)), w = o.w || 0;
    const U = capsule(v, a.sh, a.elbow, 4.6 + w, 4.1 + w * 0.8, o), Fm = capsule(v, a.elbow, a.wrist, 4.0 + w * 0.8, 3.5 + w * 0.6, o); stamp(P, union(U.mask, Fm.mask), R);
    // elbow crease + cuff band
    line(P, ...edgeAt(Fm, 0.08, -1), ...edgeAt(Fm, 0.22, 1), R[1], Fm.mask);
    const cuff = o.cuff ? ramp(o.cuff) : R, cu = capsule(v, a.wrist.map((p, i) => p + (a.elbow[i] - p) * 0.2), a.wrist, 3.7 + w * 0.6, 3.6 + w * 0.6); stamp(P, cu.mask, cuff);
    return { P, U, Fm, cu };
  }

  function hoodie(c, item, col) {
    const R = ramp(col), v = c.v, J = c.J, Bm = c.buf('outer', 'main');
    // hood bunched behind the neck (behind the head from the front, on top from the back)
    const hoodPass = c.back ? 'main' : 'far', Hp = c.buf('outer', hoodPass);
    stamp(Hp, ellipsoid(v, [0, J.shoulders[1] + 2.5, J.shoulders[2] - 5.5], [9.5, 5.5, 5]).mask, R);
    const T = loft(v, torsoRows(c, { sw: 13.6, cw: 13, ww: 12.2, hw: 12.6, d: 8.6, hem: 2, top: 1 })); stamp(Bm, T.mask, R);
    ringLine(Bm, v, T, J.pelvis[1] + 1, -0.3, Math.PI + 0.3, R[1], T.mask); ringLine(Bm, v, T, J.pelvis[1] - 0.5, -0.3, Math.PI + 0.3, R[0], T.mask); // ribbed waistband
    if (c.front || c.side) {
      // kangaroo pocket + drawstrings
      const p0 = onLoft(v, T, Math.PI / 2 - 0.65, J.pelvis[1] + 9), p1 = onLoft(v, T, Math.PI / 2 + 0.65, J.pelvis[1] + 9), p2 = onLoft(v, T, Math.PI / 2 + 0.75, J.pelvis[1] + 2), p3 = onLoft(v, T, Math.PI / 2 - 0.75, J.pelvis[1] + 2);
      for (const [a, b] of [[p0, p1], [p1, p2], [p3, p0]]) if (a && b && a[2] > 0 && b[2] > 0) line(Bm, a[0], a[1], b[0], b[1], R[1], T.mask);
      for (const s of [-0.18, 0.18]) { const a = onLoft(v, T, Math.PI / 2 + s, J.shoulders[1] - 1), b = onLoft(v, T, Math.PI / 2 + s, J.shoulders[1] - 9); if (a && b && a[2] > 0) line(Bm, a[0], a[1], b[0], b[1], '#e8e2d8', T.mask); }
    }
    for (const a of armsSorted(c)) sleeve(c, 'outer', a, R);
  }

  /** Two-tone baffled puffer (golden sample: black body, orange yoke/sleeves/hood, white cuff bands). */
  function puffer2(c, item, col, accent) {
    const R = ramp(col), A = ramp(accent || '#f27934'), Wt = ramp('#f1efe8'), v = c.v, J = c.J, Bm = c.buf('outer', 'main');
    const open = item.open !== false;
    // hood (accent) bunched behind
    const Hp = c.buf('outer', c.back ? 'main' : 'far'); stamp(Hp, ellipsoid(v, [0, J.shoulders[1] + 3.5, J.shoulders[2] - 6], [10.5, 6.5, 5.5]).mask, A);
    const rows = torsoRows(c, { sw: 16.2, cw: 17.2, ww: 15.8, hw: 14.6, d: 11, hem: 1, top: 2, flare: 0, chest: 0.8 });
    const T = loft(v, rows, { gap: open ? { top: J.shoulders[1] + 3, bottom: J.pelvis[1] - 6, half: 0.17 } : null });
    stamp(Bm, T.mask, R);
    // accent yoke across chest/shoulders (upper band) — clipped to the body
    const yokeBottom = E.OY - (J.shoulders[1] - 3.5), Y = bandY(T.mask, 0, yokeBottom); stamp(Bm, Y, A, { noInk: false });
    // baffles: quilted rows with a highlight above each stitch line
    for (let hy = J.shoulders[1] - 8; hy > J.pelvis[1] - 1; hy -= 5) { ringLine(Bm, v, T, hy, -0.4, Math.PI + 0.4, R[0], T.mask); ringLine(Bm, v, T, hy + 1, -0.4, Math.PI + 0.4, R[3], T.mask); }
    ringLine(Bm, v, T, J.shoulders[1] - 3.5, -0.4, Math.PI + 0.4, '#f1efe8', T.mask); // white piping under the yoke
    // hem band + zipper tracks + chest patch
    ringLine(Bm, v, T, J.pelvis[1], -0.4, Math.PI + 0.4, R[0], T.mask);
    if (open) for (const s of [-1, 1]) seamLine(Bm, v, T, Math.PI / 2 + s * 0.19, J.shoulders[1] + 1, J.pelvis[1] - 1, '#c9ccd2', T.mask, 0);
    else seamLine(Bm, v, T, Math.PI / 2, J.shoulders[1] + 1, J.pelvis[1] - 1, '#c9ccd2', T.mask, 0);
    const patch = onLoft(v, T, Math.PI / 2 - 0.62, J.shoulders[1] - 3); if (patch && patch[2] > 1) { px(Bm, patch[0], patch[1], '#f1efe8'); px(Bm, patch[0] + 1, patch[1], accent || '#f27934'); px(Bm, patch[0], patch[1] + 1, accent || '#f27934'); }
    // high collar (accent outside, dark lining)
    const col0 = loft(v, [{ y: J.shoulders[1] + 6.5, a: 7.4 * c.build, b: 6.2, oz: J.neck[2] - 0.5 }, { y: J.shoulders[1] + 1.5, a: 9.6 * c.build, b: 7.6, oz: J.shoulders[2] }], { gap: open ? { top: 999, bottom: -999, half: 0.5 } : null });
    stamp(Bm, col0.mask, A); c.collar = col0.mask;
    // puffy sleeves: accent upper with black lower panels and white cuff band
    for (const a of armsSorted(c)) {
      const s = sleeve(c, 'outer', a, A, { w: 1.6, cuff: '#16181d' });
      const lower = capsule(v, a.elbow.map((p, i) => p + (a.wrist[i] - p) * 0.05), a.wrist.map((p, i) => p + (a.elbow[i] - p) * 0.18), 5.6, 5.0); stamp(s.P, lower.mask, R);
      const band = capsule(v, a.elbow.map((p, i) => p + (a.wrist[i] - p) * 0.34), a.elbow.map((p, i) => p + (a.wrist[i] - p) * 0.4), 5.2, 5.1); stamp(s.P, band.mask, Wt);
      for (const t of [0.3, 0.55]) line(s.P, ...edgeAt(lower, t, -1), ...edgeAt(lower, t + 0.04, 1), R[3], lower.mask);
      // baffle lines on the upper sleeve
      for (const t of [0.35, 0.7]) line(s.P, ...edgeAt(s.U, t, -1), ...edgeAt(s.U, t + 0.04, 1), A[1], s.U.mask);
    }
  }

  /** Track / zip jacket (Option 3 purple). */
  function track(c, item, col) {
    const R = ramp(col), v = c.v, J = c.J, Bm = c.buf('outer', 'main'), open = !!item.open, stripe = '#f1efe8';
    const T = loft(v, torsoRows(c, { sw: 13.4, cw: 12.8, ww: 11.8, hw: 12.2, d: 8.4, hem: 2, top: 1 }), { gap: open ? { top: J.shoulders[1] + 3, bottom: J.pelvis[1] - 6, half: 0.28 } : null }); stamp(Bm, T.mask, R);
    ringLine(Bm, v, T, J.pelvis[1] + 0.5, -0.3, Math.PI + 0.3, R[0], T.mask);
    seamLine(Bm, v, T, Math.PI / 2 + (open ? 0.3 : 0), J.shoulders[1] + 1, J.pelvis[1] - 1, '#d8dce2', T.mask);
    if (open) seamLine(Bm, v, T, Math.PI / 2 - 0.3, J.shoulders[1] + 1, J.pelvis[1] - 1, '#d8dce2', T.mask);
    for (const q of [0.25, Math.PI - 0.25]) seamLine(Bm, v, T, q, J.shoulders[1] - 1, J.pelvis[1] + 2, R[3], T.mask); // side panel seams
    const cl = loft(v, [{ y: J.shoulders[1] + 5, a: 7 * c.build, b: 5.8, oz: J.neck[2] }, { y: J.shoulders[1] + 1, a: 9 * c.build, b: 7, oz: J.shoulders[2] }], { gap: open ? { top: 999, bottom: -999, half: 0.45 } : null }); stamp(Bm, cl.mask, R);
    for (const a of armsSorted(c)) { const s = sleeve(c, 'outer', a, R, { cuff: col }); line(s.P, s.U.a[0], s.U.a[1], s.Fm.b[0], s.Fm.b[1], stripe, union(s.U.mask, s.Fm.mask)); }
  }

  // ---------------- bottoms ----------------
  function trousers(c, item, col, o) {
    const R = ramp(col), v = c.v, J = c.J, baggy = o.baggy || 0;
    // waist/seat
    const Bm = c.buf('bottom', 'main'), Wst = loft(v, [{ y: J.pelvis[1] + 5, a: 11 * c.build + baggy * 0.3, b: 7.2, oz: J.pelvis[2] }, { y: J.pelvis[1] - 6, a: 11.4 * c.build + baggy * 0.5, b: 7.4, oz: J.pelvis[2] }]); stamp(Bm, Wst.mask, R);
    ringLine(Bm, v, Wst, J.pelvis[1] + 3.5, -0.2, Math.PI + 0.2, R[1], Wst.mask);
    if (o.belt) { ringLine(Bm, v, Wst, J.pelvis[1] + 4.5, -0.2, Math.PI + 0.2, '#14161b', Wst.mask); ringLine(Bm, v, Wst, J.pelvis[1] + 3.5, -0.2, Math.PI + 0.2, '#14161b', Wst.mask); const bk = onLoft(v, Wst, Math.PI / 2, J.pelvis[1] + 4); if (bk && bk[2] > 0) { px(Bm, bk[0], bk[1], '#c9ccd2'); px(Bm, bk[0] + 1, bk[1], '#c9ccd2'); } }
    for (const l of leftRight(c)) {
      const P = c.buf('bottom', c.passOfSide(l.side)), th = capsule(v, l.hip, l.knee, 5.8 + baggy, 5.2 + baggy), sh = capsule(v, l.knee, l.ankle.map((p, i) => i === 1 ? p + 2.6 : i === 2 ? p - 0.8 : p), 5.0 + baggy, 4.2 + baggy * 0.9);
      const M = union(th.mask, sh.mask); stamp(P, M, R);
      const inner = l.side * v.rx >= 0 ? -1 : 1; line(P, ...edgeAt(th, 0.25, inner), ...edgeAt(sh, 0.8, inner), R[0], M);
      // knee crease + outseam
      line(P, ...edgeAt(th, 0.92, -1), ...edgeAt(sh, 0.12, 1), R[1], M);
      const outer = l.side * v.rx >= 0 ? 1 : -1; line(P, ...edgeAt(th, 0.1, outer), ...edgeAt(sh, 0.9, outer), o.seam || R[3], M);
      if (o.cargo && !c.back) {
        // bellows pocket with flap + white piping on the outer thigh
        const p = edgeAt(th, 0.55, outer * 0.15), w = 4, h = 6, x0 = Math.round(p[0] - w / 2 + outer * 1.5), y0 = Math.round(p[1] - 2);
        for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) px(P, xx, yy, R[yy === y0 + h - 1 ? 0 : 1], M);
        line(P, x0, y0, x0 + w - 1, y0, o.piping || R[3], M); line(P, x0, y0 + 1, x0 + w - 1, y0 + 1, R[3], M); px(P, x0 + 1, y0 + 2, '#c9ccd2', M);
      }
      if (o.stack) { // stacked folds at the ankle
        for (const t of [0.72, 0.84]) line(P, ...edgeAt(sh, t, -1), ...edgeAt(sh, t + 0.05, 1), R[1], M);
      }
      if (o.stitch) for (const t of [0.3, 0.6]) px(P, ...edgeAt(th, t, outer * 0.5), o.stitch, M);
    }
    // front pockets/fly on the seat
    if (c.front) { const f0 = onLoft(v, Wst, Math.PI / 2, J.pelvis[1] + 3), f1 = onLoft(v, Wst, Math.PI / 2, J.pelvis[1] - 4); if (f0 && f1) line(Bm, f0[0], f0[1], f1[0], f1[1], R[1], Wst.mask); for (const s of [-1, 1]) { const a = onLoft(v, Wst, Math.PI / 2 + s * 0.6, J.pelvis[1] + 3), b = onLoft(v, Wst, Math.PI / 2 + s * 0.95, J.pelvis[1] - 1); if (a && b && a[2] > 0) line(Bm, a[0], a[1], b[0], b[1], o.stitch || R[1], Wst.mask); } }
    if (c.back) for (const s of [-1, 1]) { const a = onLoft(v, Wst, -Math.PI / 2 + s * 0.5, J.pelvis[1]); if (a && a[2] > 0) for (let k = 0; k < 3; k++) line(Bm, a[0] - 2, a[1] + k, a[0] + 2, a[1] + k, k === 0 ? R[3] : R[1], Wst.mask); }
  }

  // ---------------- shoes ----------------
  function shoe(c, item, col, o) {
    const v = c.v, upper = ramp(o.upper || col), sole = ramp(o.sole || '#f4f2ec'), acc = ramp(o.accent || col);
    for (const l of leftRight(c)) {
      const P = c.buf('shoes', c.passOfSide(l.side)), a = l.ankle, len = o.len || 15, wdt = o.wide || 4.6, ground = a[1] - SK.ankle;
      // 2.5D tilt: parts nearer the camera sit a little lower on screen (feet read from the front)
      const tilt = (p) => [p[0], p[1] - 0.3 * (v.depth(p) - v.depth(a)), p[2]];
      const mid = tilt([a[0], ground, a[2] + len * 0.5 - 4]), toeC = tilt([a[0], ground, a[2] + len - 6.5]), heelC = tilt([a[0], ground, a[2] - 2.5]);
      // cupsole: a flat slab resting on the ground line
      const soleM = ellipsoid(v, [mid[0], mid[1] + 1.9, mid[2]], [wdt + 0.6, 1.9, len / 2 + 0.6], { bias: 0.25 }); stamp(P, soleM.mask, sole);
      // upper: vamp over the forefoot + heel/ankle collar (taller for boots)
      const vamp = ellipsoid(v, [toeC[0], toeC[1] + 4.6, toeC[2]], [wdt, 3.7, 5]), heel = ellipsoid(v, [heelC[0], heelC[1] + (o.high ? 7 : 5.2), heelC[2]], [wdt * 0.95, o.high ? 6 : 3.9, 3.9]);
      const body0 = ellipsoid(v, [mid[0], mid[1] + 4.6, mid[2] - 1], [wdt, 3.4, len / 2 - 1.2]), up = union(vamp.mask, heel.mask, body0.mask);
      stamp(P, up, upper);
      if (o.accent) { stamp(P, intersect(ellipsoid(v, [toeC[0], toeC[1] + 4, toeC[2] + 2.2], [wdt + 0.2, 3, 2.6]).mask, up), acc); stamp(P, intersect(ellipsoid(v, [heelC[0], heelC[1] + 4.5, heelC[2] - 1.4], [wdt + 0.2, 3.5, 2.4]).mask, up), acc); }
      // collar opening + tongue, side stripe (fictional mark), laces, sole line
      const top = [a[0], ground + (o.high ? 12 : 8.6), a[2] - 1.2]; px(P, v.px(top), v.py(top), '#0c0d10', up); px(P, v.px(top) + 1, v.py(top), '#0c0d10', up);
      if (o.stripe) { const s0 = tilt([a[0], ground + 4.6, a[2] - 1]), s1 = tilt([a[0], ground + 6.2, a[2] + len * 0.45]); for (const side of [1, -1]) { const q0 = [s0[0] + side * wdt * 0.98, s0[1], s0[2]], q1 = [s1[0] + side * wdt * 0.98, s1[1], s1[2]]; if (v.depth(q0) - v.depth(a) > -1) line(P, v.px(q0), v.py(q0), v.px(q1), v.py(q1), o.stripe, up); } }
      if (c.front || c.side) for (let k = 0; k < 3; k++) { const q = tilt([a[0], ground + 7.2 - k * 0.6, a[2] + 1 + k * 1.9]); px(P, v.px(q) - 1, v.py(q), o.laces || '#f4f2ec', up); px(P, v.px(q) + 1, v.py(q), o.laces || '#f4f2ec', up); }
      const p0 = tilt([a[0], ground + 1.6, a[2] - 3]), p1 = tilt([a[0], ground + 1.6, a[2] + len - 4]);
      for (const side of [1, -1]) { const q0 = [p0[0] + side * (wdt + 0.5), p0[1], p0[2]], q1 = [p1[0] + side * (wdt + 0.5), p1[1], p1[2]]; if (v.depth(q0) - v.depth(a) > -1) line(P, v.px(q0), v.py(q0), v.px(q1), v.py(q1), o.lug ? '#0c0d10' : o.soleLine || '#c8c4bc', soleM.mask); }
      if (c.front) { const t0 = tilt([a[0], ground + 1.5, a[2] + len - 4]); line(P, v.px(t0) - wdt + 1, v.py(t0), v.px(t0) + wdt - 1, v.py(t0), o.lug ? '#0c0d10' : o.soleLine || '#c8c4bc', soleM.mask); }
    }
  }

  // ---------------- head / face / hair ----------------
  function hair(c) {
    const o = c.outfit, R = ramp(HAIRC[o.hairColor] || HAIRC[0], 'cloth'), v = c.v, hc = c.J.head, H = SK.head, B = c.buf('hair', 'main'), style = o.hair;
    if (style === 'bald') return;
    const capOn = !!o.head;
    if (style === 'braids') {
      const Bb = c.buf('hairback', c.back ? 'main' : 'far');
      for (let i = -3; i <= 3; i++) { const yaw = Math.PI + i * 0.32, top = [hc[0] + Math.sin(yaw) * H[0] * 0.95, hc[1] + 2, hc[2] + Math.cos(yaw) * H[2] * 0.95], bot = [top[0] * 1.08, hc[1] - 14, top[2] * 1.05 - 1]; stamp(c.v.depth(top) > c.v.depth(hc) + 2 ? B : Bb, capsule(v, top, bot, 1.7, 1.3).mask, R); }
    }
    const shell = style === 'fade' || style === 'buzz' ? 0.4 : 1.6;
    const top = ellipsoid(v, [hc[0], hc[1] + 2.2, hc[2] - 0.8], [H[0] + shell * 0.5, H[1] * 0.78 + shell, H[2] + shell * 0.5]);
    // hairline: keep the face clear (only the upper skull + back when facing away)
    const cutY = c.front ? E.OY - (hc[1] + 1.5) : c.side ? E.OY - (hc[1] - 1) : E.OY - (hc[1] - 6);
    let M = bandY(top.mask, 0, cutY);
    if (c.side) { // side: sideburn + back of the head goes lower
      const backSide = ellipsoid(v, [hc[0], hc[1] - 2, hc[2] - 3.5], [H[0] * 0.9, H[1] * 0.7, H[2] * 0.6]); M = union(M, intersect(backSide.mask, c.headMask));
    }
    if (capOn) M = bandY(M, E.OY - (hc[1] + 3), E.OY); // under a cap only the sides/back show
    stamp(B, M, R, { noContact: true });
    if (!capOn && style !== 'fade' && style !== 'buzz') for (let k = -2; k <= 2; k++) { const p = headPt(c, k * 0.35, 6.5, 1); if (p.d > -1) line(B, p.x, p.y, p.x + (k % 2), p.y + 3, R[1], M); } // strands
  }
  function cap(c, item, col) {
    const R = ramp(col), v = c.v, hc = c.J.head, H = SK.head, B = c.buf('head', 'main'), back = !!item.back;
    const crown = ellipsoid(v, [hc[0], hc[1] + 3, hc[2] - 0.5], [H[0] + 1.2, H[1] * 0.62, H[2] + 1.2], { clipY: E.OY - (hc[1] + 1.2), clipBelow: true });
    stamp(B, crown.mask, R);
    // brim: a flattened ellipsoid sticking out front (or back)
    const fz = back ? -1 : 1, brimC = [hc[0], hc[1] + 1.4, hc[2] + fz * (H[2] + 3.4)], brim = ellipsoid(v, brimC, [H[0] * 0.85, 1.5, 5.2]);
    const Bp = c.buf('head', v.depth(brimC) < v.depth(hc) ? 'far' : 'main'); stamp(Bp, brim.mask, ramp(E.mix(col, '#000', 0.15)), { });
    // panel seams + button + front emblem (fictional mark)
    const t = headPt(c, 0, H[1] * 0.62 + 2.6, 1.2); px(B, t.x, t.y - 1, R[3], crown.mask);
    for (const yaw of [-0.9, 0.9, 2.4, -2.4]) { const a = headPt(c, yaw, 2.5, 1.2), b = headPt(c, yaw * 0.4, 8, 1.2); if (a.d > 0 && b.d > 0) line(B, a.x, a.y, b.x, b.y, R[1], crown.mask); }
    const e = headPt(c, back ? Math.PI : 0, 5.2, 1.3); if (e.d > 2) { px(B, e.x, e.y, '#f1efe8', crown.mask); px(B, e.x - 1, e.y + 1, '#f1efe8', crown.mask); px(B, e.x + 1, e.y + 1, '#f1efe8', crown.mask); px(B, e.x, e.y + 1, item.emblem || '#f27934', crown.mask); }
  }
  function shades(c, item, col) {
    const v = c.v, B = c.buf('face', 'main'), lens = col === '#e3c25a' ? '#3a2a10' : '#0c0f16';
    const a = headPt(c, -0.85, -0.8, 0.6), b = headPt(c, 0.85, -0.8, 0.6), m = headPt(c, 0, -0.6, 0.9);
    // wraparound band: draw along the face at eye height where it faces the camera
    let prev = null; for (let i = 0; i <= 20; i++) { const yaw = -1.25 + 2.5 * (i / 20), p = headPt(c, yaw, -0.8, 0.7); if (p.d < 0.5) { prev = null; continue; } if (prev) { line(B, prev.x, prev.y, p.x, p.y, lens); line(B, prev.x, prev.y + 1, p.x, p.y + 1, lens); line(B, prev.x, prev.y - 1, p.x, p.y - 1, '#1a1e28'); } prev = p; }
    for (const s of [-1, 1]) { const g = headPt(c, s * 0.45, -0.3, 0.8); if (g.d > 1.5) px(B, g.x - 1, g.y - 1, '#9fd4ff'); }
    void a; void b; void m;
    if (c.side) { const t = headPt(c, (v.fx > 0 ? 1 : -1) * 1.45, -0.4, 0.5); px(B, t.x, t.y, '#1a1e28'); }
  }
  function chain(c, item, col) {
    if (c.back) return; const v = c.v, J = c.J, B = c.buf('jewelry', 'main'), G = ramp(col, 'metal');
    const T = loft(v, torsoRows(c, { sw: 12.9, cw: 12.1, ww: 11, hw: 11.6, d: 7.9 }));
    for (let i = 0; i <= 16; i++) { const q = 0.6 + (Math.PI - 1.2) * (i / 16), dip = Math.sin((i / 16) * Math.PI) * 8, p = onLoft(v, T, q, J.shoulders[1] + 1.5 - dip, 0.4); if (p && p[2] > 0.3) px(B, p[0], p[1], i % 2 ? G[3] : G[2]); }
    const pend = onLoft(v, T, Math.PI / 2, J.shoulders[1] - 8, 0.5); if (pend && pend[2] > 0.5) { px(B, pend[0], pend[1], G[4]); px(B, pend[0], pend[1] + 1, G[2]); px(B, pend[0] - 1, pend[1] + 1, G[3]); px(B, pend[0] + 1, pend[1] + 1, G[1]); px(B, pend[0], pend[1] + 2, G[1]); }
  }
  function watch(c, item, col) {
    const v = c.v, a = c.J.arms.find((x) => x.side === -1); if (!a) return; const B = c.buf('wrist', c.passOfSide(-1, true));
    const w = a.wrist.map((p, i) => p + (a.elbow[i] - p) * 0.12); stamp(B, capsule(v, w, a.wrist.map((p, i) => p + (a.elbow[i] - p) * 0.02), 3.3, 3.3).mask, ramp(col === '#e3c25a' ? '#e3c25a' : '#1b1e24', col === '#e3c25a' ? 'metal' : 'cloth'));
    px(B, v.px(w), v.py(w), item.face || '#44b9c7');
  }
  function backpack(c, item, col) {
    const R = ramp(col), v = c.v, J = c.J, packC = [0, J.shoulders[1] - 10, J.shoulders[2] - 11.5], pass = c.back ? 'near' : c.side ? 'main' : 'far';
    const B = c.buf('bag', pass), body0 = loft(v, [{ y: J.shoulders[1] + 1, a: 8.6, b: 3.4, oz: packC[2] }, { y: J.shoulders[1] - 6, a: 9.6, b: 4.2, oz: packC[2] }, { y: J.shoulders[1] - 20, a: 9.2, b: 4, oz: packC[2] + 0.5 }]);
    stamp(B, body0.mask, R);
    if (c.back || c.side) { ringLine(B, v, body0, J.shoulders[1] - 8, -Math.PI + 0.2, -0.2, R[3], body0.mask, 0.2); ringLine(B, v, body0, J.shoulders[1] - 9, -Math.PI + 0.2, -0.2, R[0], body0.mask, 0.2); const z = onLoft(v, body0, -Math.PI / 2, J.shoulders[1] - 12, 0.3); if (z && z[2] > 0) { px(B, z[0], z[1], '#c9ccd2'); px(B, z[0], z[1] + 1, '#c9ccd2'); } }
    // straps over the shoulders (visible from the front)
    if (c.front || c.side) { const Ps = c.buf('bag', 'near'); for (const side of [1, -1]) { if (side * v.rz < -0.3) continue; const t = [side * 7 * c.build, J.shoulders[1] + 1, J.shoulders[2] + 2], bt = [side * 8 * c.build, J.shoulders[1] - 16, J.shoulders[2] + 8.4]; const S = capsule(v, t, bt, 1.4, 1.4); stamp(Ps, S.mask, R); } }
  }

  // ---------------- item registry (wardrobe ids → Option 3 art) ----------------
  const ITEMS = {
    tee: { slot: 'top', draw: (c, it, col) => tee(c, it, col) },
    hoodie: { slot: 'outer', draw: (c, it, col) => hoodie(c, it, col) },
    puffer2: { slot: 'outer', draw: (c, it, col, acc) => puffer2(c, it, col, acc) },
    track: { slot: 'outer', draw: (c, it, col) => track(c, it, col) },
    cargo: { slot: 'bottom', draw: (c, it, col) => trousers(c, it, col, { cargo: true, baggy: 2, stack: true, belt: true, piping: '#f1efe8' }) },
    jeans: { slot: 'bottom', draw: (c, it, col) => trousers(c, it, col, { baggy: 0.4, stack: true, stitch: '#d89a4a', seam: E.mix(col, '#ffffff', 0.25) }) },
    courts: { slot: 'shoes', draw: (c, it, col, acc) => shoe(c, it, col, { upper: '#f4f2ec', accent: acc || '#d0283a', stripe: '#16181d', sole: '#f4f2ec', soleLine: acc || '#d0283a', len: 17, wide: 5.5 }) },
    boots: { slot: 'shoes', draw: (c, it, col) => shoe(c, it, col, { upper: col, sole: '#1a1b1f', high: true, lug: true, laces: '#c9a86a', len: 15, wide: 4.8 }) },
    cap: { slot: 'head', draw: (c, it, col) => cap(c, it, col) },
    shades: { slot: 'face', draw: (c, it, col) => shades(c, it, col) },
    chain: { slot: 'jewelry', draw: (c, it, col) => chain(c, it, col) },
    sportwatch: { slot: 'wrist', draw: (c, it, col) => watch(c, it, col) },
    backpack: { slot: 'bag', draw: (c, it, col) => backpack(c, it, col) },
  };
  const HAIR_OK = { short: 1, braids: 1, fade: 1, buzz: 1, bald: 1 };
  const SLOTS = ['head', 'face', 'top', 'outer', 'bottom', 'shoes', 'jewelry', 'bag', 'wrist', 'gloves'];
  function colorOf(piece) { const it = W?.ITEM?.[piece.id]; return it ? it.colors[piece.color] || it.colors[0] : piece.hex || '#1d2024'; }
  function accentOf(piece) { const it = W?.ITEM?.[piece.id]; return it?.opts?.accent ? it.opts.accent[piece.color] || it.opts.accent[0] : null; }
  /** Can this outfit be drawn entirely in Option 3 art? */
  function supports(o) { if (!o || !HAIR_OK[o.hair]) return false; for (const s of SLOTS) { const p = o[s]; if (p && !ITEMS[p.id]) return false; } return !!(o.top || o.outer) && !!o.bottom && !!o.shoes; }

  /** Render one frame. Returns { layers: Map('layer:pass' → Uint32Array), order, composite, anchors }. */
  function render(o, dir, anim = 'idle', f = 0, hold = '') {
    const c = ctxFor(o, dir, anim, f, hold);
    body(c); hair(c);
    for (const s of SLOTS) { const p = o[s]; if (!p) continue; const it = ITEMS[p.id]; if (it) it.draw(c, p, colorOf(p), accentOf(p)); }
    const order = []; for (const pass of PASSES) for (const L of LAYERS) if (c.F.layers.has(L + ':' + pass)) order.push(L + ':' + pass);
    return { layers: c.F.layers, order, composite: E.composite(c.F.layers, order), anchors: anchors(c) };
  }
  function anchors(c) {
    const v = c.v, P = (p) => [Math.round(v.px(p)), Math.round(v.py(p))], r = c.J.arms.find((a) => a.side === 1), l = c.J.arms.find((a) => a.side === -1);
    return { origin: [E.OX, E.OY], hand_r: P(r.hand || r.wrist), hand_l: P(l.hand || l.wrist), head: P(c.J.head), back: P([0, c.J.shoulders[1] - 8, c.J.shoulders[2] - 8]), chest: P(c.J.chest) };
  }
  const api = { render, supports, ITEMS, LAYERS, PASSES, ANIMS, SLOTS, pose, SK, HAIR_OK };
  root.NightshiftO3Character = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
