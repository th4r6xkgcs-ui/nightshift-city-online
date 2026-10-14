/* Option 3 palette ramps (Claude-owned). Shared by the offline sprite exporter (tools/opt3) and the game, so a
 * runtime recolour maps every authored tone exactly (palette swap on real pixel art, no filters).
 * API: NightshiftOpt3Palette.{rgb, hex, mix, lum, ramp, outlineOf, contactOf, swapMap} */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rgb = (h) => { const n = parseInt(String(h).slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const lum = (h) => { const [r, g, b] = rgb(h); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; };
  const cache = new Map();
  // 5 tones: deep, shadow, base, light, highlight. Shadows lean violet/navy, lights lean warm (Art Bible).
  function ramp(base, kind = 'cloth') {
    const k = base + '|' + kind; let r = cache.get(k); if (r) return r;
    const L0 = lum(base);
    if (kind === 'skin') r = [mix(mix(base, '#4a1c2a', 0.4), '#000000', 0.3), mix(base, '#8a3f3f', 0.28), base, mix(base, '#fff0d8', 0.2), mix(base, '#fffaf0', 0.42)];
    else if (kind === 'metal') r = [mix(base, '#1a1206', 0.62), mix(base, '#3a2a10', 0.32), base, mix(base, '#fff6d8', 0.42), '#fffbea'];
    else if (L0 < 0.14) r = [mix(base, '#000000', 0.55), mix(base, '#07060e', 0.25), mix(base, '#323a52', 0.16), mix(base, '#6e7ea0', 0.38), mix(base, '#b8c6e0', 0.6)];
    else if (L0 > 0.8) r = [mix(base, '#3a3a5a', 0.55), mix(base, '#6a6a8e', 0.32), base, mix(base, '#ffffff', 0.5), '#ffffff'];
    else r = [mix(mix(base, '#231748', 0.42), '#000000', 0.36), mix(mix(base, '#2e2458', 0.26), '#000000', 0.14), base, mix(base, '#fff1c8', 0.28), mix(base, '#fffaf0', 0.55)];
    cache.set(k, r); return r;
  }
  const outlineOf = (base, kind) => mix(ramp(base, kind)[0], '#0a0812', 0.55);
  /** Exact colour map from one base colour's tones (+ outline) to another's: { 'rrggbb': [r,g,b] } */
  function swapMap(from, to, kind = 'cloth') {
    const a = ramp(from, kind), b = ramp(to, kind), m = {};
    for (let i = 0; i < 5; i++) m[a[i].slice(1)] = rgb(b[i]);
    m[outlineOf(from, kind).slice(1)] = rgb(outlineOf(to, kind));
    return m;
  }
  const api = { rgb, hex, mix, lum, ramp, outlineOf, swapMap };
  root.NightshiftOpt3Palette = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
