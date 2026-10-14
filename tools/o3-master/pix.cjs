// Option 3 master-art toolkit (Claude tooling). Hand-authored 2D pixel shapes on an explicit native grid:
// every pixel is one palette colour, shapes are placed by hand-chosen coordinates (no 3D primitives, no resampling,
// no noise). Parts are named; after painting, contour() inks each part's outer edge (dark where it meets air, a
// darker shade of itself where it overlaps a part drawn earlier), which keeps clothing construction readable.
'use strict';
const PNG = require('../png.cjs');
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };

function Pix(w, h) {
  const col = new Array(w * h).fill(null), part = new Int16Array(w * h).fill(-1), parts = [];
  const pid = (name) => { let i = parts.indexOf(name); if (i < 0) { parts.push(name); i = parts.length - 1; } return i; };
  let cur = pid('base'), clip = null, ox = 0, oy = 0;
  const P = {
    w, h, col, part, parts,
    /** select the part subsequent fills belong to (drawing order = part order for contouring) */
    part(name) { cur = pid(name); return P; },
    /** translate subsequent drawing (design coordinates stay as authored) */
    off(dx = 0, dy = 0) { ox = dx; oy = dy; return P; },
    /** restrict fills to pixels of the given part(s) (or a predicate (x,y)=>bool); null clears */
    clip(c) { if (!c) clip = null; else if (typeof c === 'function') { const f = c, ax = ox, ay = oy; clip = (x, y) => f(x - ax, y - ay); } else { const ids = [].concat(c).map((n) => parts.indexOf(n)); clip = (x, y) => ids.includes(part[y * w + x]); } return P; },
    set(x, y, c, keepPart) { x = Math.round(x) + ox; y = Math.round(y) + oy; if (x < 0 || y < 0 || x >= w || y >= h) return P; if (clip && !clip(x, y)) return P; const i = y * w + x; col[i] = c; if (!keepPart) part[i] = c ? cur : -1; return P; },
    /** recolour existing pixels without changing their part (for shading inside a clip) */
    tint(x, y, c) { return P.set(x, y, c, true); },
    get(x, y) { x += ox; y += oy; return x < 0 || y < 0 || x >= w || y >= h ? null : col[y * w + x]; },
    partAt(x, y) { x += ox; y += oy; return x < 0 || y < 0 || x >= w || y >= h ? null : parts[part[y * w + x]] ?? null; },
    rect(x, y, rw, rh, c, keep) { for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) P.set(xx, yy, c, keep); return P; },
    /** polygon fill, pixel-centre rule, even-odd */
    poly(pts, c, keep) {
      let y0 = Infinity, y1 = -Infinity; for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        const yc = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax)); }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x + 0.5 <= xs[k + 1]; x++) P.set(x, y, c, keep);
      }
      return P;
    },
    ell(cx, cy, rx, ry, c, keep) { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) P.set(x, y, c, keep); } return P; },
    line(x0, y0, x1, y1, c, keep) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (;;) { P.set(x0, y0, c, keep); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } return P; },
    /** polyline through points (1px) */
    path(pts, c, keep) { for (let i = 0; i + 1 < pts.length; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, keep); return P; },
    /** recolour pixels of colour `from` (within clip) to `to` where pred(x,y) */
    shade(pred, map) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, c = col[i]; if (!c || (clip && !clip(x, y)) || !pred(x - ox, y - oy)) continue; const t = map[c]; if (t) col[i] = t; } return P; },
    /** ink the outer edge of every part: air → `ink`; over an earlier part → darker shade of itself */
    contour(ink = '#120d17', inner = 0.62, skip = [], groups = []) {
      const skipIds = skip.map((n) => parts.indexOf(n)), out = col.slice(), grp = (id) => { const nm = parts[id]; const g = groups.findIndex((G) => G.includes(nm)); return g < 0 ? 'p' + id : 'g' + g; };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!col[i]) continue; const me = part[i]; if (skipIds.includes(me)) continue;
        let air = false, under = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h || !col[yy * w + xx]) { air = true; break; } const o = part[yy * w + xx]; if (o !== me && o < me && !skipIds.includes(o) && grp(o) !== grp(me)) under = true; }
        if (air) out[i] = ink; else if (under) out[i] = mix(col[i], ink, inner);
      }
      for (let i = 0; i < col.length; i++) col[i] = out[i]; return P;
    },
    /** Painterly form pass (run BEFORE contour). Every authored ramp colour keeps its role, but is re-toned on an
     *  11-step hue-shifted ramp by a per-part rounded height field (lit from the upper left), with ambient occlusion
     *  where a later part overlaps, gloss on chosen parts and a cool rim light on the shadow-side silhouette.
     *  ramps: { name: [c0..c4] } (light → dark); opts.parts: { partName: { r, gloss, flat, ao } }. Pixels stay 1 colour. */
    paint(ramps, opts = {}) {
      const L = (() => { const v = opts.light || [-0.55, -0.72, 0.62], n = Math.hypot(...v); return v.map((a) => a / n); })();
      const warm = opts.warm || '#fff1c4', cool = opts.cool || '#2a1546', rimC = opts.rim || '#a9b8ff';
      // fine ramps: hot, r0, ·, r1, ·, r2, ·, r3, ·, r4, deep  (index 0 = brightest)
      const fine = {}, lut = new Map();
      for (const [nm, r] of Object.entries(ramps)) {
        if (!Array.isArray(r) || r.length < 3) continue; const f = [mix(r[0], warm, 0.45)];
        for (let i = 0; i < r.length; i++) { f.push(r[i]); if (i + 1 < r.length) f.push(mix(r[i], r[i + 1], 0.5)); }
        f.push(mix(r[r.length - 1], cool, 0.45)); fine[nm] = f;
        r.forEach((c, i) => { if (!lut.has(c)) lut.set(c, [nm, 1 + 2 * i]); });
      }
      const cfg = (id) => (opts.parts || {})[parts[id]] || {}, R0 = opts.r || 7;
      // distance (chamfer, px) from each pixel to its part's own silhouette (edges against air or an EARLIER part)
      const INF = 1e9, d = new Float32Array(w * h).fill(INF), occ = new Float32Array(w * h).fill(INF), q = [];
      const same = (i, j) => part[i] === part[j] && col[j];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!col[i]) continue; let edge = false, under = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, j = yy * w + xx; if (xx < 0 || yy < 0 || xx >= w || yy >= h || !col[j]) { edge = true; continue; } if (part[j] !== part[i]) { if (part[j] < part[i]) edge = true; else under = true; } }
        if (edge) d[i] = 0.5; if (under) occ[i] = 0.5;
      }
      const relax = (D, ok) => { for (let pass = 0; pass < 2; pass++) for (let k = 0; k < 2; k++) { const fw = k === 0; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const x = fw ? xx : w - 1 - xx, y = fw ? yy : h - 1 - yy, i = y * w + x; if (!col[i]) continue; for (const [dx, dy, c] of fw ? [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.414], [1, -1, 1.414]] : [[1, 0, 1], [0, 1, 1], [1, 1, 1.414], [-1, 1, 1.414]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (ok(i, j) && D[j] + c < D[i]) D[i] = D[j] + c; } } } };
      relax(d, same); relax(occ, same);
      const ht = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) if (col[i]) { const c = cfg(part[i]), R = c.r || R0, t = Math.min(d[i], R) / R; ht[i] = c.flat ? 1 : Math.sqrt(1 - (1 - t) * (1 - t)) * R * 0.5; }
      const out = col.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, c0 = col[i]; if (!c0) continue; const m = lut.get(c0); if (!m) continue; const c = cfg(part[i]); if (c.flat && !c.ao) continue;
        const hv = (X, Y) => { const j = Y * w + X; return X >= 0 && Y >= 0 && X < w && Y < h && same(i, j) ? ht[j] : ht[i]; };
        const gx = (hv(x + 1, y) - hv(x - 1, y)) / 2, gy = (hv(x, y + 1) - hv(x, y - 1)) / 2, nn = Math.hypot(gx, gy, 1), n = [-gx / nn, -gy / nn, 1 / nn];
        const lam = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
        let off = c.flat ? 0 : Math.round((lam - L[2]) * (c.gain ?? opts.gain ?? 5) - (y / h - 0.45) * (opts.vgrad ?? 0));
        if (c.gloss && lam > 0.9) off += 1 + (lam > 0.97 ? 1 : 0);
        if (occ[i] < 3.5 && c.ao !== false) off -= occ[i] < 1.5 ? 2 : 1;                // contact shadow under an overlapping part
        const [nm, base] = m, f = fine[nm], k = Math.max(0, Math.min(f.length - 1, base - off));
        let o = f[k];
        if (!c.flat && opts.rimLight !== false && n[0] > 0.3 && n[1] > -0.3 && (() => { for (let k = 1; k <= 2; k++) { const X = x + k; if (X >= w || !col[y * w + X]) return true; } return false; })()) o = mix(o, rimC, opts.rimMix ?? 0.3);  // cool rim on the shadow side
        out[i] = o;
      }
      for (let i = 0; i < col.length; i++) col[i] = out[i]; return P;
    },
    rgba() { const o = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < col.length; i++) if (col[i]) { const [r, g, b] = hex(col[i]); o.set([r, g, b, 255], i * 4); } return o; },
    png() { return PNG.encode(P.rgba(), w, h); },
    bbox() { let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (col[y * w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; },
    colours() { return new Set(col.filter(Boolean)).size; },
  };
  return P;
}

/** presentation sheet: checkerboard, native-size copy, nearest-neighbour Nx copy (no smoothing anywhere) */
function preview(rgba, w, h, n = 4, label = '') {
  const pad = 16, W = pad * 3 + w + w * n, H = pad * 2 + h * n, out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = ((x >> 3) + (y >> 3)) & 1 ? 0xc8 : 0xe6; out.set([v, v, v + 4, 255], (y * W + x) * 4); }
  const put = (ox, oy, k) => { for (let y = 0; y < h * k; y++) for (let x = 0; x < w * k; x++) { const s = ((y / k | 0) * w + (x / k | 0)) * 4; if (rgba[s + 3]) out.set(rgba.subarray(s, s + 4), ((oy + y) * W + ox + x) * 4); } };
  put(pad, pad, 1); put(pad * 2 + w, pad, n);
  return { png: PNG.encode(out, W, H), w: W, h: H };
}

module.exports = { Pix, preview, mix, hex };
