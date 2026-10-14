/* Option 3 street props (Claude-owned): hydrant, vending machine, ATM — each with a DAY and a NIGHT variant.
 * Same pixel pipeline as the characters (o3-engine.js): material ramps, inked edges, contact shading; front 3/4 view,
 * 96x128 cells, origin bottom-centre (48, 118), 2 art px per world px (prop-art.js places them, unchanged anchors).
 * Night: ambient tones drop toward navy, emissive parts (display backlight, screen, sign, reflective band) stay bright,
 * and the runtime adds an additive light pool. Pure JS. API: NightshiftO3Props.{render, draw, KINDS} */
(function (root) {
  'use strict';
  const E = root.NightshiftO3Engine || (typeof require === 'function' ? require('./o3-engine.js') : null);
  const { ramp, loft, capsule, ellipsoid, stamp, polygon, line, px, mix, ringLine } = E;
  const KINDS = ['hydrant', 'vending', 'atm'];
  const OX = E.OX, OY = E.OY;
  const nightTone = (hex, night) => (night ? mix(hex, '#0a1524', 0.42) : hex);
  const rect = (B, x, y, w, h, hex) => { for (let yy = Math.round(y); yy < Math.round(y + h); yy++) for (let xx = Math.round(x); xx < Math.round(x + w); xx++) px(B, xx, yy, hex); };
  /** front 3/4 box: front face w x h with its bottom at OY, a lighter top strip and a darker right side */
  function box(B, cx, w, h, side, top, hex, night) {
    const R = ramp(nightTone(hex, night)), x0 = cx - w / 2, y0 = OY - h;
    stamp(B, polygon([[x0 + w, y0], [x0 + w + side, y0 - top], [x0 + w + side, OY - top], [x0 + w, OY]], { n: [0.9, -0.1, 0.4] }).mask, R);
    stamp(B, polygon([[x0, y0], [x0 + side, y0 - top], [x0 + w + side, y0 - top], [x0 + w, y0]], { n: [-0.3, -0.9, 0.3] }).mask, R);
    stamp(B, polygon([[x0, y0], [x0 + w, y0], [x0 + w, OY], [x0, OY]], { n: [-0.15, -0.1, 1] }).mask, R);
    return { x0, y0, w, h, R };
  }

  function hydrant(B, night) {
    const v = E.view(2), red = ramp(nightTone('#c8323a', night)), steel = ramp(nightTone('#8a929a', night));
    stamp(B, loft(v, [{ y: 4, a: 9, b: 8 }, { y: 0, a: 9.5, b: 8.5 }]).mask, steel); // base flange
    const body0 = loft(v, [{ y: 34, a: 6.4, b: 6 }, { y: 30, a: 7, b: 6.6 }, { y: 6, a: 7.4, b: 7 }, { y: 4, a: 8, b: 7.6 }]); stamp(B, body0.mask, red);
    stamp(B, loft(v, [{ y: 37, a: 7.8, b: 7.2 }, { y: 33, a: 8.2, b: 7.6 }]).mask, red); // bonnet rim
    stamp(B, ellipsoid(v, [0, 37, 0], [6.6, 5, 6.2], { gloss: true, clipY: OY - 37, clipBelow: true }).mask, red); // dome
    stamp(B, capsule(v, [0, 42, 0], [0, 44, 0], 1.8, 1.4).mask, steel); // operating nut
    for (const s of [-1, 1]) { stamp(B, capsule(v, [s * 6, 22, 0], [s * 11, 22, 0], 3.2, 3).mask, red); stamp(B, ellipsoid(v, [s * 11.6, 22, 0], [1.4, 3.4, 3]).mask, steel); }
    stamp(B, capsule(v, [0, 16, 6.4], [0, 16, 8.4], 3.6, 3.4).mask, red); stamp(B, ellipsoid(v, [0, 16, 8.8], [3.4, 3.4, 1]).mask, steel); // pumper nozzle facing camera
    for (const yy of [28, 9]) ringLine(B, v, body0, yy, -0.2, Math.PI + 0.2, red[0], body0.mask);
    // reflective band (glows at night)
    ringLine(B, v, body0, 31, -0.3, Math.PI + 0.3, night ? '#e8f6ff' : '#c9d1d6', body0.mask); ringLine(B, v, body0, 32, -0.3, Math.PI + 0.3, night ? '#bfe4ff' : '#9aa3ab', body0.mask);
    for (let k = 0; k < 4; k++) px(B, OX - 8 + k * 5, OY - 1, steel[0]); // bolts
  }

  function vending(B, night) {
    const b = box(B, OX - 2, 46, 72, 5, 3, '#c8323a', night), { x0, y0 } = b;
    // header lightbox (fictional brand) — emissive
    rect(B, x0 + 3, y0 + 3, 40, 9, night ? '#ffe9a8' : '#f1efe8'); rect(B, x0 + 3, y0 + 11, 40, 1, b.R[0]);
    for (const [dx, col] of [[6, '#c8323a'], [12, '#c8323a'], [18, '#14171c'], [24, '#c8323a'], [30, '#14171c']]) rect(B, x0 + dx + 2, y0 + 5, 4, 5, col); // abstract wordmark blocks
    // display window with shelves of cans (backlit at night)
    const gx = x0 + 3, gy = y0 + 15, gw = 29, gh = 36; rect(B, gx, gy, gw, gh, night ? '#cfe9ff' : '#2a4a66');
    const cans = ['#e0473a', '#3d7fd0', '#3ad6a0', '#ffd970', '#a34dff', '#f27934', '#f1efe8'];
    for (let r = 0; r < 4; r++) { rect(B, gx, gy + 8 + r * 9, gw, 1, night ? '#7aa0c0' : '#14202c'); for (let k = 0; k < 6; k++) { const c = cans[(r * 3 + k) % cans.length], x = gx + 2 + k * 4.5, y = gy + 2 + r * 9; rect(B, x, y, 3, 6, nightTone(c, night && false)); px(B, x, y, mix(c, '#ffffff', 0.5)); } }
    if (!night) { line(B, gx + 6, gy + 1, gx + 1, gy + 12, '#a8d4ff'); line(B, gx + 9, gy + 1, gx + 3, gy + 14, '#6a90b0'); }
    // selection panel, coin slot, buttons, pickup bay
    const px0 = x0 + 34; rect(B, px0, y0 + 15, 9, 36, b.R[1]); rect(B, px0 + 2, y0 + 17, 5, 4, night ? '#7cffb5' : '#1d3a2c');
    for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) rect(B, px0 + 2 + k * 3, y0 + 24 + r * 3, 2, 2, night ? '#ffe9a8' : '#c9ccd2');
    rect(B, px0 + 3, y0 + 40, 3, 1, '#0c0e11'); rect(B, px0 + 2, y0 + 44, 5, 4, '#14171c');
    rect(B, x0 + 6, OY - 16, 26, 8, '#0c0e11'); rect(B, x0 + 6, OY - 16, 26, 1, b.R[3]); rect(B, x0 + 8, OY - 11, 22, 2, night ? '#2a3440' : '#1a2028');
    rect(B, x0, OY - 3, 46, 3, b.R[0]); // kick plate
  }

  function atm(B, night) {
    const b = box(B, OX - 2, 40, 62, 5, 3, '#3a4250', night), { x0, y0 } = b;
    // canopy + sign (emissive at night)
    rect(B, x0 - 2, y0 - 2, 44, 6, nightTone('#22262c', night)); rect(B, x0 + 6, y0 - 1, 28, 4, night ? '#44b9c7' : '#2a6a74'); for (const dx of [10, 14, 18, 24, 28]) rect(B, x0 + dx, y0, 2, 2, night ? '#e8fbff' : '#cfe0e4');
    // screen bezel + screen
    rect(B, x0 + 5, y0 + 8, 30, 20, '#14171c'); rect(B, x0 + 7, y0 + 10, 26, 16, night ? '#7ad8ff' : '#1d4a66');
    for (let r = 0; r < 3; r++) rect(B, x0 + 10, y0 + 13 + r * 4, 14 - r * 3, 1, night ? '#e8fbff' : '#4a7a96');
    rect(B, x0 + 27, y0 + 22, 4, 2, night ? '#ffd970' : '#8a7a40');
    // keypad + card slot + cash slot
    rect(B, x0 + 8, y0 + 32, 16, 13, '#22262c'); for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) rect(B, x0 + 9 + k * 5, y0 + 33 + r * 3, 4, 2, k === 2 && r < 3 ? ['#3ad6a0', '#ffd970', '#e0473a'][r] : '#9aa3ab');
    rect(B, x0 + 27, y0 + 34, 8, 2, '#0c0e11'); rect(B, x0 + 27, y0 + 33, 8, 1, night ? '#3ad6a0' : '#2a5a46');
    rect(B, x0 + 8, y0 + 49, 24, 3, '#0c0e11'); rect(B, x0 + 8, y0 + 48, 24, 1, b.R[3]);
    rect(B, x0, OY - 3, 40, 3, b.R[0]);
  }

  const DRAW = { hydrant, vending, atm };
  /** → { composite: Uint32Array 96x128, emissive: [{x, y, r, color}] (art px, for the night light pool) } */
  function render(kind, night = false) {
    const F = E.Frame(), B = F.layer('prop:main'); DRAW[kind](B, !!night);
    const glow = !night ? [] : kind === 'vending' ? [{ x: OX - 6, y: OY - 40, r: 46, color: '#ffe9a8' }] : kind === 'atm' ? [{ x: OX - 2, y: OY - 46, r: 40, color: '#7ad8ff' }] : [{ x: OX, y: OY - 30, r: 12, color: '#bfe4ff' }];
    return { composite: E.composite(F.layers, ['prop:main']), emissive: glow };
  }
  // ---- runtime ----
  const cache = new Map();
  function canvasOf(kind, night) { const key = kind + (night ? 'n' : 'd'); let cv = cache.get(key); if (cv || typeof document === 'undefined') return cv || null; const r = render(kind, night); cv = document.createElement('canvas'); cv.width = E.FW; cv.height = E.FH; const x = cv.getContext('2d'), img = x.createImageData(E.FW, E.FH); img.data.set(E.toRGBA(r.composite)); x.putImageData(img, 0, 0); cv.emissive = r.emissive; cache.set(key, cv); return cv; }
  function draw(c, kind, x, y) {
    if (!DRAW[kind]) return false; try { if (root.localStorage?.getItem('ns-o3') === '0') return false; } catch { /* on */ }
    let night = false; try { night = (root.NightshiftEnvironment?.darkness?.(root.NightshiftEnvironment.state?.minute ?? 720) || 0) > 0.35; } catch { /* day */ }
    const cv = canvasOf(kind, night); if (!cv) return false; const bx = Math.round(x) - E.OX / 2, by = Math.round(y) + 5 - E.OY / 2;
    c.save(); c.fillStyle = '#07152155'; c.beginPath(); c.ellipse(Math.round(x) + 2, Math.round(y) + 4, kind === 'hydrant' ? 7 : 14, 3, 0, 0, Math.PI * 2); c.fill();
    if (night) { c.globalCompositeOperation = 'lighter'; for (const g of cv.emissive || []) { const gx = bx + g.x / 2, gy = by + g.y / 2, gr = c.createRadialGradient(gx, gy, 1, gx, gy + 8, g.r); gr.addColorStop(0, g.color + '55'); gr.addColorStop(1, g.color + '00'); c.fillStyle = gr; c.fillRect(gx - g.r, gy - g.r, g.r * 2, g.r * 2 + 16); } c.globalCompositeOperation = 'source-over'; }
    const prev = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false; c.drawImage(cv, bx, by, E.FW / 2, E.FH / 2); c.imageSmoothingEnabled = prev; c.restore(); return true;
  }
  const api = { render, draw, KINDS };
  root.NightshiftO3Props = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
