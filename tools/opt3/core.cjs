'use strict';
// Option 3 offline sprite renderer core (Claude-owned). Node only; output is plain RGBA buffers that the exporter
// packs into transparent PNG atlases. Nothing here runs in the game.
//
// Method: each asset is a set of signed-distance primitives attached to rig bones. For every pixel of a 96x128 frame
// an orthographic ray (three-quarter camera, pitched down) is sphere-traced; the hit gives depth, a normal, the
// primitive and the point in that primitive's bone space. Materials turn that into a palette colour; lighting is
// quantised to 5-tone hue-shifted ramps (pixel-art bands, no dithering, no smoothing); then outlines and contact lines
// are added. Because details are painted in bone space they stay glued to the garment in every direction and frame.

const FW = 96, FH = 128, OX = 48, OY = 120;            // frame size and the foot origin (native px)
const PITCH = 20 * Math.PI / 180, CP = Math.cos(PITCH), SP = Math.sin(PITCH);
// light from the upper left, a little toward the camera (world: X right, Y up, Z toward camera/south)
const L = norm([-0.58, 0.66, 0.48]);

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- 3x3 rotation helpers (row-major arrays of 9) ----------
const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
function mul3(a, b) { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]; return o; }
const rx = (t) => { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const apply3 = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

// ---------- colour (shared with the game: opt3-palette.js) ----------
const { rgb, hex, mix, lum, ramp, outlineOf } = require('../../opt3-palette.js');

// ---------- SDF primitives (all in bone space) ----------
function sdRoundCone(px, py, pz, ax, ay, az, bx, by, bz, r1, r2) {
  // iq: exact round cone between a (r1) and b (r2)
  const bax = bx - ax, bay = by - ay, baz = bz - az, l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - ax, pay = py - ay, paz = pz - az, y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y, x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
function sdEllipsoid(px, py, pz, rxx, ryy, rzz) {
  const k0 = Math.hypot(px / rxx, py / ryy, pz / rzz), k1 = Math.hypot(px / (rxx * rxx), py / (ryy * ryy), pz / (rzz * rzz));
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rxx, ryy, rzz);
}
function sdRoundBox(px, py, pz, hx, hy, hz, r) {
  const qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r, qz = Math.abs(pz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}

// prim: { bone, type:'cone'|'ell'|'box', a:[..], b:[..], r1, r2 | c:[..], r:[..] | c, h:[..], rad, rot?:3x3, mat, band, smooth? }
// A compiled prim carries its world->local transform for the current pose and a screen bound.
function compile(prims, pose) {
  const out = [];
  for (const p of prims) {
    const B = pose.bones[p.bone]; if (!B) throw new Error('no bone ' + p.bone);
    // local frame of the prim = bone frame, optionally rotated/offset (for boxes)
    let R = B.R, T = B.T;
    if (p.rot || p.at) { const off = apply3(B.R, p.at || [0, 0, 0]); T = [T[0] + off[0], T[1] + off[1], T[2] + off[2]]; if (p.rot) R = mul3(B.R, p.rot); }
    const Rt = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
    // bounding sphere in local space
    let cx, cy, cz, br;
    if (p.type === 'cone') { cx = (p.a[0] + p.b[0]) / 2; cy = (p.a[1] + p.b[1]) / 2; cz = (p.a[2] + p.b[2]) / 2; br = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]) / 2 + Math.max(p.r1, p.r2); }
    else if (p.type === 'ell') { [cx, cy, cz] = p.c || [0, 0, 0]; br = Math.max(...p.r); }
    else if (p.type === 'torus') { [cx, cy, cz] = p.c || [0, 0, 0]; br = p.R * Math.max(p.sx || 1, p.sz || 1) + p.r; }
    else { [cx, cy, cz] = p.c || [0, 0, 0]; br = Math.hypot(...p.h); }
    const wc = apply3(R, [cx, cy, cz]); const W = [wc[0] + T[0], wc[1] + T[1], wc[2] + T[2]];
    const sx = OX + W[0], sy = OY - (W[1] * CP - W[2] * SP), depth = W[1] * SP + W[2] * CP;
    out.push({ ...p, Rt, T, R, sx, sy, br: br + 1.5, depth });
  }
  return out;
}
function evalPrim(p, wx, wy, wz) {
  const dx = wx - p.T[0], dy = wy - p.T[1], dz = wz - p.T[2], R = p.Rt;
  const lx = R[0] * dx + R[1] * dy + R[2] * dz, ly = R[3] * dx + R[4] * dy + R[5] * dz, lz = R[6] * dx + R[7] * dy + R[8] * dz;
  let d;
  if (p.type === 'cone') d = sdRoundCone(lx, ly, lz, p.a[0], p.a[1], p.a[2], p.b[0], p.b[1], p.b[2], p.r1, p.r2);
  else if (p.type === 'ell') { const c = p.c || [0, 0, 0]; d = sdEllipsoid(lx - c[0], ly - c[1], lz - c[2], p.r[0], p.r[1], p.r[2]); }
  else if (p.type === 'torus') { const c = p.c || [0, 0, 0], qx = lx - c[0], qy = ly - c[1], qz = lz - c[2], ax = p.ax || 'y'; let u, v; if (ax === 'y') { u = Math.hypot(qx / (p.sx || 1), qz / (p.sz || 1)) - p.R; v = qy; } else { u = Math.hypot(qx, qz) - p.R; v = qy; } d = Math.hypot(u, v) - p.r; }
  else { const c = p.c || [0, 0, 0]; d = sdRoundBox(lx - c[0], ly - c[1], lz - c[2], p.h[0], p.h[1], p.h[2], p.rad || 0.5); }
  if (p.cut) { // half-space cut in local coords: keep where n·p <= o (e.g. open jacket front, cap brim)
    for (const [nx, ny, nz, o] of p.cut) d = Math.max(d, nx * lx + ny * ly + nz * lz - o);
  }
  if (p.shell) d = Math.abs(d) - p.shell; // hollow (sleeve tubes, hood)
  return { d, lx, ly, lz };
}
function smin(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h); }

/** Render a set of compiled prims into a frame: returns { rgba:Uint8ClampedArray(FW*FH*4), depth:Float32Array, id:Int16Array } */
function render(cprims, opts = {}) {
  const rgba = new Uint8ClampedArray(FW * FH * 4), depth = new Float32Array(FW * FH).fill(-1e9), ids = new Int16Array(FW * FH).fill(-1);
  const tones = new Int8Array(FW * FH).fill(-1), bases = new Array(FW * FH), kinds = new Array(FW * FH);
  if (!cprims.length) return { rgba, depth, ids, empty: true };
  // screen bound of the whole set
  let x0 = FW, x1 = 0, y0 = FH, y1 = 0; for (const p of cprims) { x0 = Math.min(x0, p.sx - p.br); x1 = Math.max(x1, p.sx + p.br); y0 = Math.min(y0, p.sy - p.br); y1 = Math.max(y1, p.sy + p.br); }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(FW - 1, Math.ceil(x1)); y1 = Math.min(FH - 1, Math.ceil(y1));
  const k = opts.smooth ?? 0;
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const sx = px + 0.5 - OX, sv = OY - (py + 0.5);
    const cand = []; for (let i = 0; i < cprims.length; i++) { const p = cprims[i]; if (Math.abs(px + 0.5 - p.sx) <= p.br && Math.abs(py + 0.5 - p.sy) <= p.br) cand.push(p); }
    if (!cand.length) continue;
    let tmax = -1e9, tmin = 1e9; for (const p of cand) { tmax = Math.max(tmax, p.depth + p.br); tmin = Math.min(tmin, p.depth - p.br); }
    // sphere trace from the camera side
    let t = tmax, hit = null;
    for (let it = 0; it < 64 && t > tmin; it++) {
      const wx = sx, wy = sv * CP + t * SP, wz = -sv * SP + t * CP;
      let d = 1e9, best = null, bl = null;
      for (const p of cand) { const r = evalPrim(p, wx, wy, wz); const dd = r.d; if (k > 0 && p.smooth && best && best.smooth) { if (dd < d) { best = p; bl = r; } d = smin(d, dd, k); } else if (dd < d) { d = dd; best = p; bl = r; } }
      if (d < 0.05) { hit = { t, p: best, l: bl, wx, wy, wz }; break; }
      t -= Math.max(d, 0.08);
    }
    if (!hit) continue;
    if (opts.occ && opts.occ[py * FW + px] > hit.t + (opts.occMargin ?? 0.7)) continue; // behind the body: hidden in every outfit
    // normal by tetrahedron differences on the full set
    const e = 0.35, f = (x, y, z) => { let d = 1e9; for (const p of cand) { const dd = evalPrim(p, x, y, z).d; d = k > 0 && p.smooth ? smin(d, dd, k) : Math.min(d, dd); } return d; };
    const { wx, wy, wz } = hit;
    const a = f(wx + e, wy - e, wz - e), b = f(wx - e, wy - e, wz + e), c = f(wx - e, wy + e, wz - e), dd = f(wx + e, wy + e, wz + e);
    const n = norm([a - b - c + dd, -a - b + c + dd, -a + b - c + dd]);
    const i = py * FW + px; depth[i] = hit.t; ids[i] = cprims.indexOf(hit.p);
    // material → base colour + tone bias
    const m = hit.p.mat({ x: hit.l.lx, y: hit.l.ly, z: hit.l.lz, n, w: [wx, wy, wz], prim: hit.p }) || { c: '#ff00ff' };
    if (m.c === null) { ids[i] = -1; depth[i] = -1e9; continue; } // material asked for a hole
    const ndl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
    let v = 0.47 + ndl * 0.5 + (m.bias || 0);
    // rim of the silhouette facing away from the camera a touch darker (form)
    const facing = n[1] * SP + n[2] * CP; if (facing < 0.25) v -= 0.12;
    let tone = v < 0.16 ? 0 : v < 0.4 ? 1 : v < 0.72 ? 2 : v < (m.gloss ? 0.9 : 1.15) ? 3 : 4;
    if (m.flat !== undefined) tone = m.flat;
    if (m.tone !== undefined) tone = clamp(tone + m.tone, 0, 4);
    tones[i] = tone; bases[i] = m.c; kinds[i] = m.kind || 'cloth';
    const col = m.emit || ramp(m.c, m.kind || 'cloth')[tone], [r, g, bl] = rgb(col);
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = bl; rgba[i * 4 + 3] = 255;
  }
  // contact lines: a pixel whose up/left neighbour is clearly nearer (another part overlapping it) drops a tone
  for (let py = 1; py < FH; py++) for (let px = 1; px < FW; px++) {
    const i = py * FW + px; if (ids[i] < 0) continue;
    for (const j of [i - FW, i - 1]) if (ids[j] >= 0 && ids[j] !== ids[i] && depth[j] - depth[i] > 2.2 && tones[i] > 0) {
      const col = ramp(bases[i], kinds[i])[Math.max(0, tones[i] - 1)], [r, g, b] = rgb(col); rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; break;
    }
  }
  // coloured outline around the silhouette (the neighbour's own darkest tone), 4-connected, outside the shape
  const out = new Uint8ClampedArray(rgba);
  for (let py = 0; py < FH; py++) for (let px = 0; px < FW; px++) {
    const i = py * FW + px; if (ids[i] >= 0) continue; let nb = -1;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) { const xx = px + dx, yy = py + dy; if (xx < 0 || yy < 0 || xx >= FW || yy >= FH) continue; const j = yy * FW + xx; if (ids[j] >= 0) { nb = j; break; } }
    if (nb < 0 || opts.noOutline) continue;
    const [r, g, b] = rgb(outlineOf(bases[nb], kinds[nb])); out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
  }
  return { rgba: out, depth, ids, tones, bases };
}

// ---------- tiny PNG encoder (RGBA, no filter tricks) ----------
const zlib = require('node:zlib');
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = { FW, FH, OX, OY, PITCH, CP, SP, L, I3, mul3, rx, ry, rz, apply3, norm, clamp, rgb, hex, mix, lum, ramp, outlineOf, compile, render, encodePNG, smin };
