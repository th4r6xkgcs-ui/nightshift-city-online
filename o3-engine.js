/* Option 3 sprite engine (Claude-owned). Pure JS, runs in the browser and in Node (atlas export + tests).
 * A tiny 2.5D primitive rasteriser for hand-tuned pixel art:
 *  - primitives live in a character-local 3D frame (x = character's right, y = up, z = forward) and are projected for
 *    one of 8 facings (dir 0 = E, clockwise: 1 SE, 2 S, 3 SW, 4 W, 5 NW, 6 N, 7 NE — the game's dirOfAngle order);
 *  - capsules (limbs), ellipsoids (heads, hands, puffs), lofts (stacked elliptical cross-sections: torsos, jackets,
 *    trousers, shoes) and flat polygons; each pixel gets a normal and is lit from the top-left-front into a 5-tone,
 *    hue-shifted material ramp (no dithering, no noise);
 *  - edges: a primitive's border pixels become ink where they meet empty space and a contact shade where they
 *    overlap something already drawn in the same layer, so every garment reads as a separate, inked piece;
 *  - surface details (seams, zips, quilting, pockets, laces, faces) are drawn on a primitive in its own surface
 *    coordinates (around angle, height) and only where that surface faces the camera.
 * Frame: W x H RGBA (default 96 x 128), origin = feet centre (48, 118).
 * API: NightshiftO3Engine.{Frame, ramp, view, ...} */
(function (root) {
  'use strict';
  const FW = 96, FH = 128, OX = 48, OY = 118;
  const L = (() => { const v = [-0.48, -0.62, 0.62], n = Math.hypot(...v); return v.map((a) => a / n); })(); // light: left, up, toward camera

  // ---------- colour ----------
  const rgb = (h) => { const n = parseInt(String(h).slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const lum = (h) => { const [r, g, b] = rgb(h); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; };
  const rampCache = new Map();
  /** 5 tones [deep, shadow, base, light, highlight] + ink. Shadows lean cool/violet, lights warm (Option 3 palette). */
  function ramp(base, kind = 'cloth') {
    const k = base + kind; let r = rampCache.get(k); if (r) return r;
    const Lm = lum(base);
    if (kind === 'skin') r = [mix(mix(base, '#4a1a2a', 0.38), '#000', 0.3), mix(base, '#7a3a44', 0.3), base, mix(base, '#ffe6c8', 0.25), mix(base, '#fff6ea', 0.45)];
    else if (kind === 'metal') r = [mix(base, '#1a1420', 0.6), mix(base, '#3a2a40', 0.3), base, mix(base, '#fff4d0', 0.45), '#fffbe8'];
    else if (Lm < 0.14) r = [mix(base, '#000', 0.55), mix(base, '#06050f', 0.25), mix(base, '#2a3346', 0.18), mix(base, '#5a6a88', 0.36), mix(base, '#9fb0cc', 0.5)];
    else if (Lm > 0.82) r = [mix(base, '#4a4a6a', 0.42), mix(base, '#8a8aa8', 0.32), base, mix(base, '#ffffff', 0.4), '#ffffff'];
    else r = [mix(mix(base, '#1d1238', 0.42), '#000', 0.3), mix(mix(base, '#2a1e50', 0.26), '#000', 0.1), base, mix(base, '#ffe9c0', 0.28), mix(base, '#fff8ea', 0.55)];
    r.ink = mix(r[0], '#05040a', 0.55);
    rampCache.set(k, r); return r;
  }
  const packC = (h) => { const [r, g, b] = rgb(h); return (255 << 24) | (b << 16) | (g << 8) | r; };

  // ---------- view ----------
  /** Projection for a facing. F = forward on screen (fx, fz toward camera), R = character's right. */
  function view(dir, scale = 1) {
    const th = (dir * Math.PI) / 4, fx = Math.cos(th), fz = Math.sin(th);
    const v = { dir, fx, fz, rx: -fz, rz: fx, s: scale };
    v.px = (p) => OX + (p[0] * v.rx + p[2] * v.fx) * scale; // screen x
    v.py = (p) => OY - p[1] * scale;                     // screen y (orthographic front, the 3/4 feel lives in the art)
    v.depth = (p) => (p[0] * v.rz + p[2] * v.fz) * scale;   // toward camera = positive
    v.toScreenN = (n) => [n[0] * v.rx + n[2] * v.fx, -n[1], n[0] * v.rz + n[2] * v.fz]; // local normal -> screen normal
    return v;
  }

  // ---------- frame / layer buffers ----------
  function Frame(w = FW, h = FH) {
    const F = { w, h, layers: new Map() };
    F.layer = (name) => { let b = F.layers.get(name); if (!b) { b = new Uint32Array(w * h); F.layers.set(name, b); } return b; };
    return F;
  }
  const inside = (x, y) => x >= 0 && y >= 0 && x < FW && y < FH;

  // tone from a screen-space normal; glossy materials can reach the highlight
  function toneOf(n, gloss, bias = 0) {
    const d = n[0] * L[0] + n[1] * L[1] + n[2] * L[2] + bias;
    if (d > 0.86 && gloss) return 4; if (d > 0.68) return 3; if (d > 0.26) return 2; if (d > -0.16) return 1; return 0;
  }

  /** Rasterise a mask (Uint8 per pixel: 0 = out, 1..5 = tone+1) into a layer buffer with ink/contact edges. */
  function stamp(buf, mask, R, opts = {}) {
    const ink = packC(opts.ink || R.ink), deep = packC(R[0]), cols = R.map(packC);
    const out = [];
    const bb = mask.bb || [0, 0, FW - 1, FH - 1];
    for (let y = Math.max(0, bb[1]); y <= Math.min(FH - 1, bb[3]); y++) for (let x = Math.max(0, bb[0]); x <= Math.min(FW - 1, bb[2]); x++) {
      const i = y * FW + x, m = mask[i]; if (!m) continue;
      let edgeEmpty = false, edgeOver = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (!inside(xx, yy) || !mask[yy * FW + xx]) { if (!inside(xx, yy) || !buf[yy * FW + xx]) edgeEmpty = true; else edgeOver = true; } }
      out.push([i, opts.noInk ? cols[m - 1] : edgeEmpty ? ink : edgeOver && !opts.noContact ? deep : cols[m - 1]]);
    }
    for (const [i, c] of out) buf[i] = c;
  }

  const bbox = (m, x0, y0, x1, y1) => { m.bb = [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(FW - 1, Math.ceil(x1)), Math.min(FH - 1, Math.ceil(y1))]; return m; };
  // ---------- primitives (each returns a mask + a surface mapper for details) ----------
  /** Tapered capsule from a to b (local coords) with radii ra, rb. */
  function capsule(v, a, b, ra, rb = ra, o = {}) {
    ra *= v.s || 1; rb *= v.s || 1;
    const ax = v.px(a), ay = v.py(a), bx = v.px(b), by = v.py(b), mask = new Uint8Array(FW * FH);
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1e-6, len = Math.sqrt(len2), ux = dx / len, uy = dy / len;
    const x0 = Math.floor(Math.min(ax, bx) - Math.max(ra, rb) - 1), x1 = Math.ceil(Math.max(ax, bx) + Math.max(ra, rb) + 1), y0 = Math.floor(Math.min(ay, by) - Math.max(ra, rb) - 1), y1 = Math.ceil(Math.max(ay, by) + Math.max(ra, rb) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue; const px = x + 0.5 - ax, py = y + 0.5 - ay;
      let t = (px * dx + py * dy) / len2; t = Math.max(0, Math.min(1, t)); const r = ra + (rb - ra) * t, cx = px - dx * t, cy = py - dy * t, d = Math.hypot(cx, cy);
      if (d > r) continue;
      // cylinder normal across the axis (+ a little toward the ends on the caps)
      const across = (cx * -uy + cy * ux) / r, nz = Math.sqrt(Math.max(0, 1 - across * across));
      let n = [-uy * across, ux * across, nz]; if ((t === 0 || t === 1) && d > 0.01) n = [cx / r, cy / r, Math.sqrt(Math.max(0, 1 - (d / r) ** 2))];
      mask[y * FW + x] = toneOf(n, o.gloss, o.bias || 0) + 1;
    }
    bbox(mask, x0, y0, x1, y1); return { mask, a: [ax, ay], b: [bx, by], ra, rb, ux, uy, len };
  }
  /** Ellipsoid at c with local radii [rx, ry, rz]. */
  function ellipsoid(v, c, r, o = {}) {
    if ((v.s || 1) !== 1) r = r.map((q) => q * v.s);
    const cx = v.px(c), cy = v.py(c), sx = Math.hypot(r[0] * v.rx, r[2] * v.fx) || 0.5, sy = r[1], mask = new Uint8Array(FW * FH);
    for (let y = Math.floor(cy - sy - 1); y <= Math.ceil(cy + sy + 1); y++) for (let x = Math.floor(cx - sx - 1); x <= Math.ceil(cx + sx + 1); x++) {
      if (!inside(x, y)) continue; const nx = (x + 0.5 - cx) / sx, ny = (y + 0.5 - cy) / sy, d = nx * nx + ny * ny; if (d > 1) continue;
      if (o.clipY !== undefined && (o.clipBelow ? y + 0.5 > o.clipY : y + 0.5 < o.clipY)) continue;
      mask[y * FW + x] = toneOf([nx, ny, Math.sqrt(Math.max(0, 1 - d))], o.gloss, o.bias || 0) + 1;
    }
    bbox(mask, cx - sx - 1, cy - sy - 1, cx + sx + 1, cy + sy + 1); return { mask, c: [cx, cy], sx, sy };
  }
  /** Loft: rows = [{ y, a, b, ox, oz }] top to bottom (local), elliptical cross-sections (a = half-width along the
   *  character's right axis, b = half-depth). Optional opening (front gap) and a "superellipse" squareness. */
  function loft(v, rows, o = {}) {
    const mask = new Uint8Array(FW * FH), info = [];
    const sorted = rows.slice().sort((p, q) => q.y - p.y);
    const ytop = OY - sorted[0].y, ybot = OY - sorted[sorted.length - 1].y;
    for (let y = Math.floor(ytop); y <= Math.ceil(ybot); y++) {
      const hy = OY - (y + 0.5); let k = 0; while (k < sorted.length - 2 && sorted[k + 1].y > hy) k++;
      const A = sorted[k], B = sorted[k + 1] || A, t = A.y === B.y ? 0 : Math.max(0, Math.min(1, (A.y - hy) / (A.y - B.y)));
      if (hy > A.y + 0.01 || hy < B.y - 0.01) continue;
      const lerp = (p, q) => p + (q - p) * t, a = lerp(A.a, B.a), b = lerp(A.b, B.b), ox = lerp(A.ox || 0, B.ox || 0), oz = lerp(A.oz || 0, B.oz || 0);
      const cx = OX + ox * v.rx + oz * v.fx, hw = Math.hypot(a * v.rx, b * v.fx) || 0.5;
      const slope = (B.a - A.a) / Math.max(0.5, A.y - B.y); // widening downward → normal tilts down
      info[y] = { cx, hw, a, b, ox, oz, hy };
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        if (!inside(x, y)) continue; const p = (x + 0.5 - cx) / hw; if (Math.abs(p) > 1) continue;
        // which way does this column of the ellipse face? solve angle on the cross-section
        const ang = surfaceAngle(v, a, b, p), lx = Math.cos(ang) * a, lz = Math.sin(ang) * b;
        if (o.gap && gapHit(o.gap, ang, hy)) continue;
        const nl = [Math.cos(ang) / Math.max(0.01, a), slope * 0.6, Math.sin(ang) / Math.max(0.01, b)], nn = Math.hypot(...nl), ns = v.toScreenN(nl.map((q) => q / nn));
        mask[y * FW + x] = toneOf(ns, o.gloss, o.bias || 0) + 1; void lx; void lz;
      }
    }
    let mx0 = FW, mx1 = 0; for (const y in info) { const r = info[y]; mx0 = Math.min(mx0, r.cx - r.hw - 1); mx1 = Math.max(mx1, r.cx + r.hw + 1); }
    bbox(mask, mx0, ytop - 1, mx1, ybot + 1); return { mask, info, v };
  }
  // the visible (camera-facing) point on an ellipse cross-section that projects to fraction p across the silhouette
  function surfaceAngle(v, a, b, p) {
    // screen x of angle q: cos(q)*a*rx + sin(q)*b*fx; extreme = hw. Find q in front half with value p*hw by bisection.
    const hw = Math.hypot(a * v.rx, b * v.fx) || 1e-6, q0 = Math.atan2(b * v.fx, a * v.rx); // angle of the right-hand extreme
    // front-facing half: depth = cos(q)*a*rz + sin(q)*b*fz > 0
    const depthAt = (q) => Math.cos(q) * a * v.rz + Math.sin(q) * b * v.fz;
    const cand = [q0 - Math.acos(Math.max(-1, Math.min(1, p))), q0 + Math.acos(Math.max(-1, Math.min(1, p)))];
    void hw; return depthAt(cand[0]) >= depthAt(cand[1]) ? cand[0] : cand[1];
  }
  const wrapA = (q) => { while (q > Math.PI) q -= 2 * Math.PI; while (q < -Math.PI) q += 2 * Math.PI; return q; };
  function gapHit(gap, ang, hy) { if (hy > gap.top || hy < gap.bottom) return false; const d = Math.abs(wrapA(ang - Math.PI / 2)); return d < gap.half; }
  /** Point on a loft surface at angle q (0 = character's right, PI/2 = front) and height y: screen [x, y, depth]. */
  function onLoft(v, Lf, q, hy, push = 0) {
    const y = Math.round(OY - hy - 0.5), r = Lf.info[y]; if (!r) return null;
    const lx = r.ox + Math.cos(q) * (r.a + push), lz = r.oz + Math.sin(q) * (r.b + push);
    return [OX + lx * v.rx + lz * v.fx, y + 0.5, lx * v.rz + lz * v.fz - (r.ox * v.rz + r.oz * v.fz)];
  }
  /** Flat polygon (screen coords) mask, optionally shaded by a constant normal. */
  function polygon(pts, o = {}) {
    const mask = new Uint8Array(FW * FH), ys = pts.map((p) => p[1]), y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(FH - 1, Math.ceil(Math.max(...ys)));
    const t = toneOf(o.n || [0, -0.2, 1], o.gloss, o.bias || 0) + 1;
    for (let y = y0; y <= y1; y++) { const yc = y + 0.5, xs = []; for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax)); } xs.sort((p, q) => p - q); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) if (inside(x, y)) mask[y * FW + x] = t; }
    bbox(mask, Math.min(...pts.map((p) => p[0])) - 1, y0, Math.max(...pts.map((p) => p[0])) + 1, y1); return { mask };
  }
  // ---------- mask helpers ----------
  const BBALL = [0, 0, FW - 1, FH - 1];
  function each(bb, fn) { for (let y = bb[1]; y <= bb[3]; y++) for (let x = bb[0]; x <= bb[2]; x++) fn(y * FW + x); }
  function intersect(m, clip) { const out = new Uint8Array(FW * FH), bb = m.bb || BBALL; each(bb, (i) => { if (m[i] && clip[i]) out[i] = m[i]; }); out.bb = bb.slice(); return out; }
  function subtract(m, cut) { const out = new Uint8Array(FW * FH), bb = m.bb || BBALL; each(bb, (i) => { if (m[i] && !cut[i]) out[i] = m[i]; }); out.bb = bb.slice(); return out; }
  function union(...ms) { const out = new Uint8Array(FW * FH), bb = [FW, FH, -1, -1]; for (const m of ms) { const b = m.bb || BBALL; bb[0] = Math.min(bb[0], b[0]); bb[1] = Math.min(bb[1], b[1]); bb[2] = Math.max(bb[2], b[2]); bb[3] = Math.max(bb[3], b[3]); each(b, (i) => { if (m[i]) out[i] = m[i]; }); } out.bb = bb[2] < 0 ? [0, 0, 0, 0] : bb; return out; }
  function bandY(m, y0, y1) { const out = new Uint8Array(FW * FH), b = m.bb || BBALL, ya = Math.max(b[1], Math.floor(y0)), yb = Math.min(b[3], Math.ceil(y1) - 1); for (let y = ya; y <= yb; y++) for (let x = b[0]; x <= b[2]; x++) { const i = y * FW + x; if (m[i]) out[i] = m[i]; } out.bb = [b[0], Math.max(0, ya), b[2], Math.max(0, yb)]; return out; }
  /** Draw a 1px line in a layer buffer, optionally clipped to a mask. */
  function line(buf, x0, y0, x1, y1, col, clip) {
    const c = packC(col); let x = Math.round(x0), y = Math.round(y0); const X1 = Math.round(x1), Y1 = Math.round(y1), dx = Math.abs(X1 - x), dy = -Math.abs(Y1 - y), sx = x < X1 ? 1 : -1, sy = y < Y1 ? 1 : -1; let err = dx + dy;
    for (let n = 0; n < 400; n++) { if (inside(x, y) && (!clip || clip[y * FW + x])) buf[y * FW + x] = c; if (x === X1 && y === Y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } }
  }
  function px(buf, x, y, col, clip) { x = Math.round(x); y = Math.round(y); if (inside(x, y) && (!clip || clip[y * FW + x])) buf[y * FW + x] = packC(col); }
  /** Polyline along a loft surface at fixed height, between angles q0..q1 (front-facing part only). */
  function ringLine(buf, v, Lf, hy, q0, q1, col, clip, push = 0) {
    let prev = null; for (let i = 0; i <= 24; i++) { const q = q0 + (q1 - q0) * (i / 24), p = onLoft(v, Lf, q, hy, push); if (!p || p[2] < -0.2) { prev = null; continue; } if (prev) line(buf, prev[0], prev[1], p[0], p[1], col, clip); prev = p; }
  }
  /** Line down a loft surface at fixed angle between heights. */
  function seamLine(buf, v, Lf, q, hy0, hy1, col, clip, push = 0) {
    let prev = null; const n = Math.max(2, Math.ceil(Math.abs(hy0 - hy1))); for (let i = 0; i <= n; i++) { const hy = hy0 + (hy1 - hy0) * (i / n), p = onLoft(v, Lf, q, hy, push); if (!p || p[2] < -0.2) { prev = null; continue; } if (prev) line(buf, prev[0], prev[1], p[0], p[1], col, clip); prev = p; }
  }
  const facing = (v, q) => Math.cos(q) * v.rz + Math.sin(q) * v.fz; // >0: that side of a body faces the camera

  // ---------- compositing + encoding ----------
  function composite(frames, order) { const out = new Uint32Array(FW * FH); for (const k of order) { const b = frames.get(k); if (!b) continue; for (let i = 0; i < out.length; i++) if (b[i]) out[i] = b[i]; } return out; }
  function toRGBA(buf, w = FW, h = FH) { const out = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { const c = buf[i]; out[i * 4] = c & 255; out[i * 4 + 1] = (c >>> 8) & 255; out[i * 4 + 2] = (c >>> 16) & 255; out[i * 4 + 3] = (c >>> 24) & 255; } return out; }

  const api = { FW, FH, OX, OY, L, rgb, hex, mix, lum, ramp, packC, view, Frame, toneOf, stamp, capsule, ellipsoid, loft, onLoft, polygon, intersect, subtract, union, bandY, line, px, ringLine, seamLine, facing, composite, toRGBA, wrapA };
  root.NightshiftO3Engine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
