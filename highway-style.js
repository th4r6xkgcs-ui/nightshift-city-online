/* Route 9 side-view car styling (Claude-owned, v0.69). Puts your Vehicle Studio build on the Garage car art:
 * custom rims (spinning, with calipers + motion blur), stance (lowered / slammed), body kits (splitter + skirts,
 * drift aero, bolt-on widebody overfenders), spoilers (lip, ducktail, street wing, GT wing), liveries along the
 * door line, underglow and tinted glass. Works on any of the Garage PNGs by reading their silhouette once.
 * Used by highway-side.js drawCar(opts.style). API: NightshiftHighwayStyle.{profile, body, wheel, extras, under, drop} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const RIM = { chrome: ['#eef3f7', '#9aa6b1', 5], black: ['#2a2f36', '#0d1013', 6], gold: ['#f0c85a', '#8a6420', 14], deep: ['#f7f9fb', '#b9c3cc', 5], neon: ['#1c2128', '#0a0c0f', 6], bronze: ['#b8864a', '#6b4a22', 12], turbine: ['#d7dde3', '#7d8792', 16], white: ['#f4f6f8', '#b8c0c8', 6] };
  const profiles = new Map();
  /** Opaque silhouette per column: top[x], bot[x] (source px; -1 = empty). */
  function profile(id, img) {
    let p = profiles.get(id); if (p) return p; if (!img || !(img.naturalWidth || img.width)) return null;
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);
    let d; try { d = c.getImageData(0, 0, w, h).data; } catch { return null; }
    const top = new Int16Array(w).fill(-1), bot = new Int16Array(w).fill(-1);
    for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) if (d[(y * w + x) * 4 + 3] > 140) { top[x] = y; break; } for (let y = h - 1; y >= 0; y--) if (d[(y * w + x) * 4 + 3] > 140) { bot[x] = y; break; } }
    let x0 = 0, x1 = w - 1; while (x0 < w && top[x0] < 0) x0++; while (x1 > 0 && top[x1] < 0) x1--;
    p = { w, h, top, bot, x0, x1 }; profiles.set(id, p); return p;
  }
  const at = (arr, x) => { const i = Math.max(0, Math.min(arr.length - 1, Math.round(x))); for (let k = 0; k < 30; k++) { if (arr[i + k] >= 0) return arr[i + k]; if (arr[i - k] >= 0) return arr[i - k]; } return 0; };
  const drop = (st) => (st?.stance === 'slammed' ? 15 : st?.stance === 'lowered' ? 8 : 0);
  const shade = (h, k) => { const n = parseInt(h.slice(1, 7), 16), f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); };

  // ---------- livery on a copy of the (tinted) body ----------
  const bodies = new Map();
  function body(id, src, color, st, wheels) {
    if (!st || (st.livery === 'none' && st.tint === '0')) return src;
    const P = profile(id, src); if (!P) return src;
    const key = id + color + st.livery + st.liveryColor + st.tint; let cv = bodies.get(key); if (cv) return cv; if (bodies.size > 16) bodies.delete(bodies.keys().next().value);
    cv = document.createElement('canvas'); cv.width = P.w; cv.height = P.h; const c = cv.getContext('2d'); c.drawImage(src, 0, 0);
    const belt = (x) => { const t = at(P.top, x), b = at(P.bot, x); return t + (b - t) * 0.6; };
    const lc = st.liveryColor || '#f4f1ea', span = P.x1 - P.x0;
    c.save(); c.globalCompositeOperation = 'source-atop';
    const along = (dy, wdt, col, from = 0.03, to = 0.97) => { c.strokeStyle = col; c.lineWidth = wdt; c.beginPath(); for (let f = from; f <= to; f += 0.01) { const x = P.x0 + span * f, y = belt(x) + dy; f === from ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); };
    if (st.livery === 'stripes') { along(-14, 9, lc); along(2, 9, lc); }
    if (st.livery === 'racing') { along(-6, 24, lc, 0.03, 0.97); const cx = P.x0 + span * 0.5, cy = belt(cx) - 8; c.fillStyle = '#f4f1ea'; c.beginPath(); c.arc(cx, cy, 24, 0, 6.3); c.fill(); c.fillStyle = '#14171c'; c.font = '900 30px Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(7 + (id.length * 3) % 80), cx, cy + 1); }
    if (st.livery === 'split') { c.fillStyle = lc; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(P.x0, P.h); for (let f = 0; f <= 1; f += 0.01) { const x = P.x0 + span * f; c.lineTo(x, belt(x) - 2); } c.lineTo(P.x1, P.h); c.closePath(); c.fill(); c.globalAlpha = 1; }
    if (st.livery === 'checker') { const sz = 9; for (let f = 0.28; f < 0.72; f += sz / span) { const x = P.x0 + span * f, y = belt(x) - 14, i = Math.round((f * span) / sz); for (let r = 0; r < 3; r++) if ((i + r) % 2 === 0) { c.fillStyle = lc; c.fillRect(x, y + r * sz, sz, sz); } } }
    if (st.livery === 'flames') { c.fillStyle = lc; for (let k = 0; k < 7; k++) { const x0 = P.x0 + span * (0.96 - k * 0.002), y0 = belt(x0) + 6 - k * 3.5, len = span * (0.32 + (k % 3) * 0.09); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 - len * 0.5, y0 - 12 - (k % 2) * 8, x0 - len, y0 - 4 - (k % 3) * 4); c.quadraticCurveTo(x0 - len * 0.55, y0 + 4, x0, y0 + 8); c.fill(); } }
    c.restore();
    // window tint: darken the glass band (upper part of the cabin) a little more per level
    if (st.tint && st.tint !== '0') { c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = [0, 0.18, 0.32, 0.46][+st.tint] || 0; c.fillStyle = '#05080c'; c.beginPath(); for (let f = 0.22; f <= 0.8; f += 0.01) { const x = P.x0 + span * f, t = at(P.top, x); f === 0.22 ? c.moveTo(x, t + 4) : c.lineTo(x, t + 4); } for (let f = 0.8; f >= 0.22; f -= 0.01) { const x = P.x0 + span * f, t = at(P.top, x), y = Math.min(belt(x) - 18, t + 48); c.lineTo(x, y); } c.closePath(); c.fill(); c.restore(); }
    // keep the wheels clean (they're redrawn from the original art)
    void wheels; bodies.set(key, cv); return cv;
  }

  // ---------- custom rim over the art's wheel ----------
  function wheel(c, src, cx, cy, r, st, spin, speed) {
    const design = st?.rims, R0 = RIM[design];
    if (!R0) return false; // stock: caller draws the art's own wheel
    // tyre from the art (outer ring), then our rim
    c.save(); c.translate(cx, cy); c.beginPath(); c.arc(0, 0, r + 1, 0, 6.3); c.clip();
    c.drawImage(src, cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2, -r - 1, -r - 1, r * 2 + 2, r * 2 + 2);
    const rr = r * (design === 'deep' ? 0.74 : 0.68);
    // barrel + caliper (doesn't spin)
    c.fillStyle = '#0b0d10'; c.beginPath(); c.arc(0, 0, rr, 0, 6.3); c.fill();
    const dg = c.createRadialGradient(0, 0, rr * 0.2, 0, 0, rr); dg.addColorStop(0, '#2a2f36'); dg.addColorStop(1, '#0b0d10'); c.fillStyle = dg; c.beginPath(); c.arc(0, 0, rr * 0.92, 0, 6.3); c.fill();
    c.fillStyle = design === 'gold' || design === 'bronze' ? '#d8a13a' : '#d23a3a'; c.beginPath(); c.arc(0, 0, rr * 0.78, -2.4, -1.3); c.arc(0, 0, rr * 0.5, -1.3, -2.4, true); c.closePath(); c.fill();
    // spokes (spin, blur at speed)
    const n = R0[2], blur = Math.min(4, Math.floor(speed / 240)), a0 = spin / Math.max(8, r);
    for (let k = 0; k <= blur; k++) {
      c.save(); c.globalAlpha = k ? 0.28 : 1; c.rotate(a0 - k * 0.16);
      if (n >= 12) { // mesh / turbine
        c.strokeStyle = R0[0]; c.lineWidth = design === 'turbine' ? rr * 0.12 : rr * 0.07;
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; c.beginPath(); if (design === 'turbine') { c.moveTo(Math.cos(a) * rr * 0.22, Math.sin(a) * rr * 0.22); c.quadraticCurveTo(Math.cos(a + 0.5) * rr * 0.6, Math.sin(a + 0.5) * rr * 0.6, Math.cos(a + 0.75) * rr * 0.92, Math.sin(a + 0.75) * rr * 0.92); } else { c.moveTo(Math.cos(a) * rr * 0.2, Math.sin(a) * rr * 0.2); c.lineTo(Math.cos(a + 0.42) * rr * 0.92, Math.sin(a + 0.42) * rr * 0.92); c.moveTo(Math.cos(a) * rr * 0.2, Math.sin(a) * rr * 0.2); c.lineTo(Math.cos(a - 0.42) * rr * 0.92, Math.sin(a - 0.42) * rr * 0.92); } c.stroke(); }
      } else {
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, w0 = rr * (n === 5 ? 0.2 : 0.15); c.save(); c.rotate(a); const sg = c.createLinearGradient(0, -w0, 0, w0); sg.addColorStop(0, R0[0]); sg.addColorStop(1, R0[1]); c.fillStyle = sg; c.beginPath(); c.moveTo(rr * 0.2, -w0 * 0.7); c.lineTo(rr * 0.93, -w0); c.lineTo(rr * 0.93, w0); c.lineTo(rr * 0.2, w0 * 0.7); c.closePath(); c.fill(); if (design === 'black') { c.fillStyle = '#ff3b3b'; c.fillRect(rr * 0.4, -0.8, rr * 0.4, 1.6); } c.restore(); }
      }
      c.restore();
    }
    // lip + cap
    c.lineWidth = rr * (design === 'deep' ? 0.16 : 0.08); c.strokeStyle = design === 'neon' ? '#7af0ff' : R0[0]; if (design === 'neon') { c.shadowColor = '#7af0ff'; c.shadowBlur = 10; }
    c.beginPath(); c.arc(0, 0, rr * 0.95, 0, 6.3); c.stroke(); c.shadowBlur = 0;
    c.fillStyle = R0[1]; c.beginPath(); c.arc(0, 0, rr * 0.2, 0, 6.3); c.fill(); c.fillStyle = R0[0]; c.beginPath(); c.arc(-rr * 0.04, -rr * 0.05, rr * 0.11, 0, 6.3); c.fill();
    // gloss
    const gl = c.createLinearGradient(0, -r, 0, r); gl.addColorStop(0, '#ffffff30'); gl.addColorStop(0.45, '#ffffff00'); c.fillStyle = gl; c.beginPath(); c.arc(0, 0, rr, 0, 6.3); c.fill();
    c.restore(); return true;
  }

  // ---------- bolt-ons (source px, after the body is drawn) ----------
  function extras(c, id, src, st, color, wheels, dy) {
    if (!st) return; const P = profile(id, src); if (!P) return; const span = P.x1 - P.x0, carbon = '#15181c', cHi = '#3a4049';
    const front = P.x1, rear = P.x0, [rw, fw] = wheels ? [wheels[0], wheels[1]] : [[P.x0 + span * 0.2, P.h * 0.8, 38], [P.x0 + span * 0.8, P.h * 0.8, 38]];
    c.save(); c.translate(0, dy);
    if (st.kit === 'lip' || st.kit === 'drift') {
      const big = st.kit === 'drift', fy = at(P.bot, front - 18);
      c.fillStyle = carbon; c.beginPath(); c.moveTo(front - span * 0.12, fy - 3); c.lineTo(front + (big ? 14 : 8), fy - 1); c.lineTo(front + (big ? 10 : 5), fy + (big ? 6 : 4)); c.lineTo(front - span * 0.12, fy + 3); c.closePath(); c.fill(); c.fillStyle = cHi; c.fillRect(front - span * 0.1, fy - 2, span * 0.1, 1.5);
      const sx0 = rw[0] + rw[2] + 8, sx1 = fw[0] - fw[2] - 8; c.fillStyle = carbon; c.beginPath(); c.moveTo(sx0, at(P.bot, sx0) - 12); for (let x = sx0; x <= sx1; x += 8) c.lineTo(x, at(P.bot, x) - 12); for (let x = sx1; x >= sx0; x -= 8) c.lineTo(x, at(P.bot, x) + 3); c.closePath(); c.fill(); c.fillStyle = cHi; c.fillRect(sx0 + 4, at(P.bot, (sx0 + sx1) / 2) - 11, sx1 - sx0 - 8, 1.6);
      if (big) { const cy0 = at(P.bot, front - 30) - 28; for (const k of [0, 13]) { c.fillStyle = carbon; c.beginPath(); c.moveTo(front - 30 + k * 0.4, cy0 + k); c.lineTo(front + 2, cy0 + k + 2); c.lineTo(front - 22 + k * 0.4, cy0 + k + 6); c.closePath(); c.fill(); }
        const ry = at(P.bot, rear + 20); for (let k = 0; k < 4; k++) { c.fillStyle = carbon; c.fillRect(rear + 6 + k * 9, ry - 6, 3, 10); } }
    }
    if (st.kit === 'wide') for (const [cx, cy, r] of [rw, fw]) {
      const R = r + 12; c.lineWidth = 10; const g = c.createLinearGradient(0, cy - R, 0, cy); g.addColorStop(0, shade(color, 0.15)); g.addColorStop(1, shade(color, -0.35)); c.strokeStyle = g; c.beginPath(); c.arc(cx, cy, R - 4, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
      c.lineWidth = 1.2; c.strokeStyle = '#00000088'; c.beginPath(); c.arc(cx, cy, R + 1, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
      c.fillStyle = '#d8dee4'; for (let k = 1; k < 8; k++) { const a = Math.PI * (1.04 + k * 0.115); c.beginPath(); c.arc(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4), 1.6, 0, 6.3); c.fill(); }
    }
    // spoilers: at the rear deck (left end of the art)
    const deckX = rear + span * 0.08, deckY = at(P.top, deckX);
    if (st.spoiler === 'lip') { c.fillStyle = shade(color, -0.4); c.beginPath(); c.moveTo(rear + span * 0.03, deckY + 2); c.lineTo(rear + span * 0.11, deckY - 1); c.lineTo(rear + span * 0.03, deckY - 6); c.closePath(); c.fill(); }
    if (st.spoiler === 'ducktail') { c.fillStyle = color; c.beginPath(); c.moveTo(rear + span * 0.02, deckY + 4); c.quadraticCurveTo(rear + span * 0.06, deckY - 2, rear + span * 0.13, deckY); c.lineTo(rear + span * 0.01, deckY - 10); c.closePath(); c.fill(); c.strokeStyle = '#00000066'; c.lineWidth = 1; c.stroke(); }
    if (st.spoiler === 'wing' || st.spoiler === 'gt') {
      const gt = st.spoiler === 'gt', hgt = gt ? 38 : 24, len = gt ? span * 0.2 : span * 0.15, wx = rear + (gt ? -6 : 2), wy = deckY - hgt;
      c.fillStyle = '#0d1013'; for (const px of [rear + span * 0.07, rear + span * 0.13]) c.fillRect(px, wy + 4, 4, at(P.top, px) - wy - 2);
      const g = c.createLinearGradient(0, wy - 5, 0, wy + 7); g.addColorStop(0, gt ? '#3a4049' : shade(color, 0.2)); g.addColorStop(1, gt ? '#0d1013' : shade(color, -0.45)); c.fillStyle = g;
      c.beginPath(); c.moveTo(wx, wy + 2); c.quadraticCurveTo(wx + len * 0.5, wy - 6, wx + len, wy - 1); c.lineTo(wx + len, wy + 5); c.quadraticCurveTo(wx + len * 0.5, wy + 2, wx, wy + 7); c.closePath(); c.fill();
      if (gt) { c.fillStyle = '#0d1013'; c.fillRect(wx - 2, wy - 10, 4, 22); c.fillRect(wx + len - 2, wy - 10, 4, 22); }
    }
    c.restore();
  }
  // ---------- underglow (screen space, before the car) ----------
  function under(c, st, x, ground, width) {
    if (!st || !st.glow || st.glow === 'none') return; c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x + width / 2, ground, 2, x + width / 2, ground, width * 0.55); g.addColorStop(0, st.glow + 'aa'); g.addColorStop(0.5, st.glow + '44'); g.addColorStop(1, st.glow + '00'); c.fillStyle = g; c.beginPath(); c.ellipse(x + width / 2, ground, width * 0.58, Math.max(6, width * 0.07), 0, 0, 6.3); c.fill(); c.restore();
  }
  root.NightshiftHighwayStyle = Object.freeze({ profile, body, wheel, extras, under, drop, RIM });
})(typeof window !== 'undefined' ? window : globalThis);
