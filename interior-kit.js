/* Interior kit (Claude-owned, v0.71). Painters for premium 2.5D rooms: tall back walls you can read (shelves, neon,
 * posters, night windows), textured floors, and a furniture library drawn top-face + front-face with outlines,
 * contact shadows and highlights. Used by interiors.js; all drawing is canvas, deterministic (seeded), no images.
 * Room space: 560 x 400, back wall 0..WALL, floor below, front wall with a door gap at the bottom.
 * API: NightshiftInteriorKit.{WALL, R, shade, rng, floor, wall, neon, poster, windowNight, shelf, block, counter, ...} */
(function (root) {
  'use strict';
  const W = 560, H = 400, WALL = 96, INK = '#0b0d14';
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const shade = (h, t) => { const n = parseInt(h.slice(1, 7), 16), f = (v) => clamp(t < 0 ? v * (1 + t) : v + (255 - v) * t); return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join(''); };
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const rng = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const POP = ['#e05a4a', '#f2c84a', '#3d99d6', '#7cdeb5', '#ff8ad8', '#f4f1ea', '#8a6430', '#a34dff', '#ff9a2e'];

  // ---------- floors ----------
  function floor(c, kind, seed = 1) {
    const r = rng(seed), y0 = WALL;
    const base = { wood: '#7a5638', oak: '#a37a4e', tile: '#d9d6c8', check: '#e4e1d4', concrete: '#6f747a', carpet: '#4a2a36', marble: '#d4d7db', lobby: '#8a7a64', club: '#17121f', rubber: '#2a2d33', lino: '#cfd8d4', lux: '#2b2233' }[kind] || '#777';
    R(c, base, 0, y0, W, H - y0);
    if (kind === 'wood' || kind === 'oak' || kind === 'lobby') {
      for (let y = y0; y < H; y += 14) { let x = -Math.floor(r() * 90); while (x < W) { const len = 70 + Math.floor(r() * 90), tone = shade(base, (r() - 0.5) * 0.22); R(c, tone, x, y, len, 13); R(c, shade(tone, 0.12), x, y, len, 1); R(c, shade(base, -0.35), x + len - 1, y, 1, 13); if (r() < 0.3) R(c, shade(tone, -0.12), x + 10 + r() * (len - 20), y + 4 + r() * 5, 6, 1); x += len; } R(c, shade(base, -0.4), 0, y + 13, W, 1); }
    } else if (kind === 'tile' || kind === 'check' || kind === 'lino') {
      const s = kind === 'lino' ? 28 : 22; for (let y = y0; y < H; y += s) for (let x = 0; x < W; x += s) { const alt = ((x / s) + ((y - y0) / s)) % 2 === 1; const col = kind === 'check' ? (alt ? '#1d2024' : '#ece8da') : kind === 'lino' ? (alt ? '#c6d2cd' : '#d6e0dc') : (alt ? '#cfcbbb' : '#e4e1d4'); R(c, col, x, y, s, s); R(c, shade(col, 0.18), x, y, s, 1); R(c, shade(col, -0.18), x, y + s - 1, s, 1); }
    } else if (kind === 'concrete') {
      for (let i = 0; i < 520; i++) R(c, r() < 0.5 ? '#666b71' : '#7a7f85', r() * W, y0 + r() * (H - y0), 2, 2);
      for (let i = 0; i < 7; i++) { c.fillStyle = 'rgba(30,26,22,0.18)'; c.beginPath(); c.ellipse(40 + r() * 480, y0 + 30 + r() * 250, 14 + r() * 30, 6 + r() * 12, 0, 0, Math.PI * 2); c.fill(); }
      for (let x = 0; x < W; x += 140) R(c, '#5d6268', x, y0, 1, H - y0); for (let y = y0 + 100; y < H; y += 100) R(c, '#5d6268', 0, y, W, 1);
    } else if (kind === 'carpet' || kind === 'lux') {
      for (let y = y0; y < H; y += 10) for (let x = (y / 10 % 2) * 10; x < W; x += 20) R(c, shade(base, 0.08), x, y, 10, 10);
      for (let y = y0 + 20; y < H; y += 40) for (let x = 20; x < W; x += 40) { R(c, shade(base, 0.25), x, y, 3, 3); }
    } else if (kind === 'marble') {
      for (let y = y0; y < H; y += 44) for (let x = 0; x < W; x += 44) { const col = ((x + y) / 44) % 2 ? '#c8ccd1' : '#e2e4e7'; R(c, col, x, y, 44, 44); c.strokeStyle = shade(col, -0.14); c.lineWidth = 1; c.beginPath(); c.moveTo(x + r() * 44, y); c.quadraticCurveTo(x + r() * 44, y + 22, x + r() * 44, y + 44); c.stroke(); R(c, '#aeb3b9', x, y, 44, 1); R(c, '#aeb3b9', x, y, 1, 44); }
    } else if (kind === 'club') {
      for (let y = y0; y < H; y += 24) for (let x = 0; x < W; x += 24) R(c, ((x + y) / 24) % 2 ? '#1d1729' : '#141019', x, y, 24, 24);
    } else if (kind === 'rubber') {
      for (let y = y0; y < H; y += 40) for (let x = 0; x < W; x += 40) { R(c, ((x + y) / 40) % 2 ? '#2a2d33' : '#25282d', x, y, 40, 40); R(c, '#1b1d21', x, y, 40, 1); R(c, '#1b1d21', x, y, 1, 40); }
      for (let i = 0; i < 400; i++) R(c, '#34383f', r() * W, y0 + r() * (H - y0), 1, 1);
    }
    // ambient occlusion along the back wall + soft vignette toward the sides
    const g = c.createLinearGradient(0, y0, 0, y0 + 26); g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, y0, W, 26);
    for (const [x0, x1] of [[0, 40], [W, W - 40]]) { const gg = c.createLinearGradient(x0, 0, x1, 0); gg.addColorStop(0, 'rgba(0,0,0,0.3)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gg; c.fillRect(Math.min(x0, x1), y0, 40, H - y0); }
  }

  // ---------- walls ----------
  function wall(c, style, col, trim, seed = 3) {
    const r = rng(seed);
    R(c, INK, 0, 0, W, WALL + 2);
    const g = c.createLinearGradient(0, 0, 0, WALL); g.addColorStop(0, shade(col, -0.25)); g.addColorStop(0.25, col); g.addColorStop(1, shade(col, -0.12)); c.fillStyle = g; c.fillRect(0, 6, W, WALL - 6);
    if (style === 'brick') for (let y = 8; y < WALL - 8; y += 8) for (let x = (y / 8 % 2) * 12 - 12; x < W; x += 24) { const t = shade(col, (r() - 0.5) * 0.2); R(c, t, x + 1, y + 1, 22, 6); R(c, shade(t, 0.15), x + 1, y + 1, 22, 1); }
    if (style === 'panel') { R(c, shade(trim, -0.35), 0, 52, W, WALL - 58); for (let x = 8; x < W; x += 56) { R(c, shade(trim, -0.2), x, 56, 48, WALL - 66); R(c, shade(trim, -0.05), x, 56, 48, 1); R(c, shade(trim, -0.5), x, WALL - 11, 48, 1); } R(c, trim, 0, 50, W, 3); }
    if (style === 'tile') for (let y = 8; y < WALL - 8; y += 12) for (let x = 0; x < W; x += 12) { R(c, shade(col, 0.1), x + 1, y + 1, 10, 10); R(c, shade(col, 0.25), x + 1, y + 1, 10, 1); }
    if (style === 'block') for (let y = 8; y < WALL - 8; y += 16) for (let x = (y / 16 % 2) * 20 - 20; x < W; x += 40) { R(c, shade(col, (r() - 0.5) * 0.12), x + 1, y + 1, 38, 14); }
    if (style === 'acoustic') for (let x = 6; x < W; x += 34) { R(c, shade(col, 0.1), x, 14, 28, WALL - 26); for (let y = 18; y < WALL - 14; y += 6) R(c, shade(col, -0.2), x + 2, y, 24, 2); }
    if (style === 'stripe') for (let x = 0; x < W; x += 16) R(c, shade(col, 0.07), x, 6, 8, WALL - 12);
    R(c, shade(col, -0.45), 0, 0, W, 6); R(c, shade(col, 0.2), 0, 6, W, 1);                    // ceiling line + crown highlight
    R(c, trim, 0, WALL - 8, W, 6); R(c, shade(trim, 0.3), 0, WALL - 8, W, 1); R(c, shade(trim, -0.4), 0, WALL - 2, W, 2); // baseboard
    // side + front walls (thin, dark: the camera looks down into the room)
    R(c, INK, 0, 0, 10, H); R(c, shade(col, -0.5), 0, 0, 8, H); R(c, shade(col, -0.3), 7, WALL, 1, H - WALL);
    R(c, INK, W - 10, 0, 10, H); R(c, shade(col, -0.5), W - 8, 0, 8, H); R(c, shade(col, -0.3), W - 8, WALL, 1, H - WALL);
    R(c, INK, 0, H - 8, W, 8); R(c, shade(col, -0.55), 0, H - 8, W / 2 - 34, 8); R(c, shade(col, -0.55), W / 2 + 34, H - 8, W / 2 - 34, 8);
    R(c, '#20242a', W / 2 - 34, H - 9, 68, 9); R(c, '#2e3a2c', W / 2 - 30, H - 26, 60, 16); R(c, '#3c4c3a', W / 2 - 28, H - 24, 56, 12); for (let x = W / 2 - 26; x < W / 2 + 26; x += 4) R(c, '#33422f', x, H - 23, 2, 10); // door + mat
  }

  // ---------- wall decor ----------
  function neon(c, text, x, y, col, size = 14, opt = {}) {
    c.save(); c.font = `700 ${size}px "Chakra Petch", system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(text).width + 14; if (opt.board !== false) { R(c, INK, x - w / 2 - 1, y - size * 0.8 - 1, w + 2, size * 1.6 + 2); R(c, '#14111c', x - w / 2, y - size * 0.8, w, size * 1.6); }
    c.shadowColor = col; c.shadowBlur = 14; c.fillStyle = col; c.fillText(text, x, y + 1); c.shadowBlur = 4; c.fillStyle = shade(col, 0.6); c.fillText(text, x, y + 1); c.restore();
  }
  function poster(c, x, y, w, h, seed, frame = '#1d2024') {
    const r = rng(seed); R(c, INK, x - 2, y - 2, w + 4, h + 4); R(c, frame, x - 1, y - 1, w + 2, h + 2);
    const a = pick(r, POP), b = pick(r, ['#14111c', '#1d2a3a', '#f4f1ea', '#2a1a2a']); R(c, b, x, y, w, h);
    const k = Math.floor(r() * 3);
    if (k === 0) { c.fillStyle = a; c.beginPath(); c.arc(x + w / 2, y + h * 0.42, Math.min(w, h) * 0.3, 0, Math.PI * 2); c.fill(); R(c, shade(a, -0.3), x + 3, y + h - 9, w - 6, 3); R(c, shade(a, 0.3), x + 3, y + h - 5, w * 0.5, 2); }
    else if (k === 1) { for (let i = 0; i < 4; i++) R(c, pick(r, POP), x + 2, y + 3 + i * (h - 6) / 4, w - 4, (h - 6) / 4 - 2); }
    else { c.fillStyle = a; c.beginPath(); c.moveTo(x + 3, y + h - 3); c.lineTo(x + w / 2, y + 4); c.lineTo(x + w - 3, y + h - 3); c.fill(); R(c, '#ffffff', x + w / 2 - 1, y + h * 0.5, 2, 2); }
    R(c, 'rgba(255,255,255,0.12)', x, y, w, 2);
  }
  function windowNight(c, x, y, w, h, seed = 9) {
    const r = rng(seed); R(c, INK, x - 3, y - 3, w + 6, h + 6); R(c, '#c9d1d6', x - 2, y - 2, w + 4, h + 4);
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#0c1630'); g.addColorStop(1, '#2a2050'); c.fillStyle = g; c.fillRect(x, y, w, h);
    for (let bx = x; bx < x + w; bx += 8 + r() * 10) { const bh = h * (0.3 + r() * 0.6), bw = 6 + r() * 10; R(c, '#141a2e', bx, y + h - bh, bw, bh); for (let wy = y + h - bh + 3; wy < y + h - 2; wy += 4) for (let wx = bx + 1; wx < bx + bw - 2; wx += 3) if (r() < 0.35) R(c, pick(r, ['#ffd970', '#ffe9a8', '#9fd8f0']), wx, wy, 1, 1); }
    R(c, '#c9d1d6', x + w / 2 - 1, y, 2, h); R(c, 'rgba(255,255,255,0.14)', x + 3, y + 2, 4, h - 4);
  }
  function clock(c, x, y) { c.fillStyle = INK; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f4f1ea'; c.beginPath(); c.arc(x, y, 7.5, 0, Math.PI * 2); c.fill(); R(c, INK, x - 0.5, y - 6, 1, 6); R(c, INK, x, y - 0.5, 4, 1); }
  /** wall-mounted shelf with items: fill(c, x, y, w) draws what sits on each board */
  function shelf(c, x, y, w, rows, fill, wood = '#5a3e2a', gap = 18) {
    for (let k = 0; k < rows; k++) { const yy = y + k * gap; fill(c, x + 2, yy, w - 4, k); R(c, INK, x - 1, yy + 12, w + 2, 5); R(c, wood, x, yy + 12, w, 3); R(c, shade(wood, 0.3), x, yy + 12, w, 1); R(c, 'rgba(0,0,0,0.3)', x, yy + 15, w, 2); }
  }
  // items for shelves (all 12px tall bands sitting on y+12)
  const bottles = (c, x, y, w, k = 0) => { for (let i = 0; i < w - 4; i += 6) { const col = POP[(i / 6 + k * 3) % POP.length], h = 8 + ((i + k) % 3) * 2; R(c, INK, x + i - 1, y + 12 - h - 1, 5, h + 1); R(c, shade(col, -0.2), x + i, y + 12 - h, 3, h); R(c, shade(col, 0.5), x + i, y + 12 - h + 2, 1, h - 3); R(c, '#c9d1d6', x + i + 1, y + 12 - h - 3, 1, 3); } };
  const boxes = (c, x, y, w, k = 0) => { for (let i = 0; i < w - 6; i += 9) { const col = POP[(i / 9 + k * 2) % POP.length]; R(c, INK, x + i - 1, y + 2, 9, 10); R(c, col, x + i, y + 3, 7, 9); R(c, shade(col, 0.35), x + i, y + 3, 7, 2); R(c, '#ffffffaa', x + i + 2, y + 7, 3, 1); } };
  const shoes = (c, x, y, w, k = 0) => { for (let i = 0; i < w - 12; i += 15) { const col = pick(rng(i + k * 7), ['#f4f1ea', '#e0262f', '#1d2024', '#3d7fd0', '#f2c84a', '#a34dff']); R(c, INK, x + i - 1, y + 5, 14, 8); R(c, col, x + i, y + 6, 12, 5); R(c, '#f4f1ea', x + i, y + 10, 12, 2); R(c, shade(col, 0.3), x + i + 1, y + 6, 4, 1); } };
  function gunSil(c, x, y, kind, col = '#2a2d36') { // side-view gun silhouette (muzzle right)
    R(c, INK, x - 1, y - 1, kind === 'rifle' ? 34 : 18, 8); R(c, col, x, y, kind === 'rifle' ? 32 : 16, 5);
    if (kind === 'rifle') { R(c, INK, x - 6, y, 7, 6); R(c, shade(col, 0.1), x - 5, y + 1, 5, 4); R(c, INK, x + 12, y + 5, 4, 7); R(c, '#5a3e2a', x + 13, y + 5, 2, 6); R(c, INK, x + 6, y - 3, 8, 3); R(c, '#3d99d6', x + 7, y - 2, 6, 1); }
    else { R(c, INK, x + 2, y + 4, 5, 7); R(c, shade(col, -0.2), x + 3, y + 5, 3, 5); }
    R(c, shade(col, 0.35), x + 1, y, kind === 'rifle' ? 28 : 13, 1);
  }
  const guns = (c, x, y, w, k = 0) => { for (let i = 6; i < w - 30; i += 44) { gunSil(c, x + i, y + 4, 'rifle', k % 2 ? '#2a2d36' : '#4a4030'); } };
  const pistols = (c, x, y, w, k = 0) => { for (let i = 2; i < w - 18; i += 24) gunSil(c, x + i, y + 4, 'pistol', ['#2a2d36', '#8a7a5a', '#c9d1d6'][(i / 24 + k) % 3 | 0]); };
  const parts = (c, x, y, w, k = 0) => { for (let i = 0; i < w - 10; i += 14) { const t = (i / 14 + k) % 3; if (t === 0) { c.fillStyle = INK; c.beginPath(); c.arc(x + i + 6, y + 6, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#9aa3ab'; c.beginPath(); c.arc(x + i + 6, y + 6, 4, 0, Math.PI * 2); c.fill(); R(c, '#5a606b', x + i + 5, y + 5, 2, 2); } else if (t === 1) boxes(c, x + i, y, 12, k); else { R(c, INK, x + i, y + 4, 11, 8); R(c, '#e05a4a', x + i + 1, y + 5, 9, 6); R(c, '#f4f1ea', x + i + 2, y + 7, 7, 1); } } };
  const meds = (c, x, y, w, k = 0) => { for (let i = 0; i < w - 6; i += 8) { const col = ['#f4f1ea', '#9fd8f0', '#f2c84a'][(i / 8 + k) % 3 | 0]; R(c, INK, x + i - 1, y + 4, 7, 8); R(c, col, x + i, y + 5, 5, 7); R(c, '#e05a4a', x + i + 1, y + 7, 3, 1); } };
  const files = (c, x, y, w, k = 0) => { for (let i = 0; i < w - 4; i += 5) { const col = ['#c9b07a', '#9aa3ab', '#3d7fd0', '#c8432f'][(i / 5 + k) % 4 | 0]; R(c, INK, x + i - 1, y + 1, 5, 11); R(c, col, x + i, y + 2, 3, 10); } };

  // ---------- furniture (top face at y..y+d, front face below with height h) ----------
  function block(c, x, y, w, d, h, col, opt = {}) {
    c.fillStyle = 'rgba(0,0,0,0.32)'; c.beginPath(); c.ellipse(x + w / 2 + 4, y + d + h - 1, w / 2 + 6, 7, 0, 0, Math.PI * 2); c.fill();
    R(c, INK, x - 1, y - 1, w + 2, d + h + 2);
    R(c, shade(col, 0.14), x, y, w, d); R(c, shade(col, 0.36), x, y, w, 1); R(c, shade(col, 0.24), x, y, 1, d); R(c, shade(col, -0.04), x + w - 1, y, 1, d);
    const g = c.createLinearGradient(0, y + d, 0, y + d + h); g.addColorStop(0, shade(col, -0.18)); g.addColorStop(1, shade(col, -0.4)); c.fillStyle = g; c.fillRect(x, y + d, w, h);
    R(c, shade(col, 0.02), x, y + d, w, 1);
    if (opt.panels) for (let i = 1; i < opt.panels; i++) { R(c, shade(col, -0.5), x + (w * i) / opt.panels, y + d + 2, 1, h - 4); R(c, shade(col, -0.1), x + (w * i) / opt.panels + 1, y + d + 2, 1, h - 4); }
    if (opt.handles) for (let i = 0; i < (opt.panels || 1); i++) R(c, '#c9d1d6', x + (w * (i + 0.5)) / (opt.panels || 1) - 3, y + d + 4, 6, 1);
  }
  /** counter with a darker top lip */
  function counter(c, x, y, w, d, h, body, top) { block(c, x, y, w, d, h, body, { panels: Math.max(1, Math.round(w / 50)) }); R(c, top, x - 2, y - 2, w + 4, d + 3); R(c, shade(top, 0.3), x - 2, y - 2, w + 4, 1); R(c, shade(top, -0.35), x - 2, y + d, w + 4, 1); }
  function rug(c, x, y, w, h, col, edge = '#e3c25a') { R(c, 'rgba(0,0,0,0.25)', x + 3, y + 4, w, h); R(c, edge, x, y, w, h); R(c, col, x + 3, y + 3, w - 6, h - 6); R(c, shade(col, 0.2), x + 8, y + 8, w - 16, 1); R(c, shade(col, 0.2), x + 8, y + h - 9, w - 16, 1); c.strokeStyle = shade(col, 0.25); c.lineWidth = 1; c.strokeRect(x + 12.5, y + 12.5, w - 25, h - 25); }
  function sofa(c, x, y, w, col) { block(c, x, y, w, 12, 20, col); block(c, x + 4, y + 12, w - 8, 14, 8, shade(col, 0.08)); for (let i = 1; i < 3; i++) R(c, shade(col, -0.3), x + 4 + ((w - 8) * i) / 3, y + 13, 1, 12); block(c, x - 6, y + 4, 8, 22, 12, shade(col, -0.05)); block(c, x + w - 2, y + 4, 8, 22, 12, shade(col, -0.05)); R(c, '#f2c84a', x + 10, y + 14, 10, 7); R(c, '#e05a4a', x + w - 22, y + 14, 10, 7); }
  function bed(c, x, y, w, h, col) { block(c, x, y, w, 10, 22, '#3a2a20'); block(c, x + 2, y + 10, w - 4, h, 6, '#f4f1ea'); R(c, col, x + 2, y + 10 + h * 0.4, w - 4, h * 0.6); R(c, shade(col, 0.2), x + 2, y + 10 + h * 0.4, w - 4, 2); R(c, '#ffffff', x + 8, y + 14, w / 2 - 12, 10); R(c, '#ffffff', x + w / 2 + 4, y + 14, w / 2 - 12, 10); R(c, '#d3d1de', x + 8, y + 22, w / 2 - 12, 2); }
  function tv(c, x, y, w) { block(c, x, y + 30, w, 10, 14, '#2a2d36', { panels: 3, handles: true }); R(c, INK, x + 8, y, w - 16, 30); R(c, '#14243a', x + 10, y + 2, w - 20, 26); const g = c.createLinearGradient(x, y, x + w, y + 30); g.addColorStop(0, '#3d99d6aa'); g.addColorStop(1, '#a34dff55'); c.fillStyle = g; c.fillRect(x + 10, y + 2, w - 20, 26); R(c, '#ffffff22', x + 12, y + 4, 8, 22); }
  function plant(c, x, y, s = 1) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x + 2, y + 1, 9 * s, 3, 0, 0, Math.PI * 2); c.fill(); R(c, INK, x - 7 * s, y - 12 * s, 14 * s, 13 * s); R(c, '#b86a3a', x - 6 * s, y - 11 * s, 12 * s, 11 * s); R(c, '#d48a52', x - 6 * s, y - 11 * s, 12 * s, 2); for (const [dx, dy, rr, col] of [[-6, -20, 7, '#2f7a4a'], [6, -22, 7, '#3d8f5a'], [0, -30, 8, '#4fa86a'], [-3, -26, 5, '#62c07a'], [4, -15, 5, '#2f6a40']]) { c.fillStyle = INK; c.beginPath(); c.arc(x + dx * s, y + dy * s, rr * s + 1, 0, Math.PI * 2); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(x + dx * s, y + dy * s, rr * s, 0, Math.PI * 2); c.fill(); } }
  function lamp(c, x, y, col = '#ffe9a8') { R(c, INK, x - 1, y - 40, 3, 40); R(c, '#9aa3ab', x, y - 40, 1, 40); R(c, INK, x - 6, y - 2, 13, 3); c.fillStyle = INK; c.beginPath(); c.moveTo(x - 9, y - 38); c.lineTo(x + 10, y - 38); c.lineTo(x + 6, y - 50); c.lineTo(x - 5, y - 50); c.fill(); c.fillStyle = col; c.beginPath(); c.moveTo(x - 8, y - 39); c.lineTo(x + 9, y - 39); c.lineTo(x + 5, y - 49); c.lineTo(x - 4, y - 49); c.fill(); }
  function stool(c, x, y, col = '#c8432f') { R(c, INK, x - 1, y - 10, 3, 10); R(c, '#9aa3ab', x, y - 10, 1, 10); c.fillStyle = INK; c.beginPath(); c.ellipse(x, y - 12, 7, 4, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(x, y - 12.5, 6, 3, 0, 0, Math.PI * 2); c.fill(); R(c, shade(col, 0.4), x - 3, y - 14, 4, 1); }
  function fridges(c, x, y, n, glow = '#9fe6ff') { for (let i = 0; i < n; i++) { const fx = x + i * 34; block(c, fx, y, 32, 8, 62, '#d9dde2'); R(c, INK, fx + 2, y + 11, 28, 56); const g = c.createLinearGradient(0, y + 11, 0, y + 67); g.addColorStop(0, shade(glow, 0.3)); g.addColorStop(1, shade(glow, -0.35)); c.fillStyle = g; c.fillRect(fx + 3, y + 12, 26, 54); for (let s = 0; s < 4; s++) { R(c, '#ffffff55', fx + 3, y + 22 + s * 12, 26, 1); for (let k = 0; k < 4; k++) R(c, POP[(i + s + k) % POP.length], fx + 5 + k * 6, y + 14 + s * 12, 4, 7); } R(c, '#ffffff44', fx + 5, y + 13, 2, 52); R(c, '#c9d1d6', fx + 26, y + 34, 2, 10); } }
  function aisle(c, x, y, w, seed = 1) { block(c, x, y, w, 14, 34, '#b9bec4', { panels: Math.round(w / 40) }); const r = rng(seed); for (const yy of [y + 18, y + 31]) for (let i = 2; i < w - 6; i += 7) { const col = pick(r, POP); R(c, INK, x + i - 1, yy - 1, 6, 10); R(c, col, x + i, yy, 4, 8); R(c, '#ffffff66', x + i, yy, 1, 8); } for (let i = 2; i < w - 6; i += 7) { R(c, pick(r, POP), x + i, y + 3, 4, 8); } }
  function register(c, x, y) { R(c, INK, x - 1, y - 1, 26, 16); R(c, '#2a2d36', x, y, 24, 14); R(c, '#7cdeb5', x + 3, y + 2, 12, 5); for (let i = 0; i < 3; i++) R(c, '#9aa3ab', x + 3 + i * 5, y + 9, 3, 2); }
  function displayCase(c, x, y, w, fill) { block(c, x, y, w, 18, 26, '#2a2d36', { panels: Math.max(1, Math.round(w / 60)) }); R(c, INK, x + 2, y + 2, w - 4, 14); R(c, '#1d3a4a', x + 3, y + 3, w - 6, 12); fill(c, x + 5, y + 2, w - 10); R(c, 'rgba(180,230,255,0.22)', x + 3, y + 3, w - 6, 12); R(c, '#ffffff66', x + 3, y + 3, w - 6, 1); }
  function rack(c, x, y, w, seed = 1) { const r = rng(seed); R(c, INK, x - 1, y - 1, w + 2, 4); R(c, '#c9d1d6', x, y, w, 2); for (let i = 0; i < w - 10; i += 11) { const col = pick(r, ['#c84659', '#3d7fc6', '#e2b75c', '#2f8f6a', '#1d2024', '#f1efe8', '#ff9a2e', '#a34dff']); R(c, INK, x + 4 + i, y + 2, 11, 34); R(c, col, x + 5 + i, y + 3, 9, 32); R(c, shade(col, 0.3), x + 5 + i, y + 3, 2, 32); R(c, shade(col, -0.3), x + 12 + i, y + 3, 2, 32); } R(c, '#2a2f36', x + 2, y, 3, 46); R(c, '#2a2f36', x + w - 5, y, 3, 46); R(c, '#2a2f36', x - 2, y + 44, 10, 3); R(c, '#2a2f36', x + w - 8, y + 44, 10, 3); }
  function mannequin(c, x, y, col = '#ff9a2e') { c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x + 2, y, 9, 3, 0, 0, Math.PI * 2); c.fill(); R(c, INK, x - 1, y - 14, 3, 14); R(c, INK, x - 6, y - 2, 13, 3); R(c, INK, x - 8, y - 40, 17, 27); R(c, col, x - 7, y - 39, 15, 25); R(c, shade(col, 0.3), x - 7, y - 39, 4, 25); R(c, '#1d2024', x - 7, y - 20, 15, 6); c.fillStyle = INK; c.beginPath(); c.arc(x, y - 46, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#d8d2c8'; c.beginPath(); c.arc(x, y - 46, 5, 0, Math.PI * 2); c.fill(); }
  function mirror(c, x, y, w, h) { R(c, INK, x - 2, y - 2, w + 4, h + 4); R(c, '#e3c25a', x - 1, y - 1, w + 2, h + 2); const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#cfe4ef'); g.addColorStop(1, '#7a96a8'); c.fillStyle = g; c.fillRect(x, y, w, h); R(c, '#ffffff88', x + 3, y + 3, 3, h - 6); R(c, '#ffffff55', x + 8, y + 3, 1, h - 6); }
  function poolTable(c, x, y) { block(c, x, y, 120, 64, 12, '#5a3a22'); R(c, '#1f7a4a', x + 6, y + 6, 108, 52); R(c, '#2a9a5e', x + 6, y + 6, 108, 2); for (const [dx, dy] of [[6, 6], [57, 4], [108, 6], [6, 52], [57, 54], [108, 52]]) { c.fillStyle = INK; c.beginPath(); c.arc(x + dx + 3, y + dy + 3, 3.5, 0, Math.PI * 2); c.fill(); } for (let i = 0; i < 6; i++) { c.fillStyle = POP[i]; c.beginPath(); c.arc(x + 70 + (i % 3) * 7 + (i > 2 ? 3 : 0), y + 26 + (i > 2 ? 6 : 0), 2.6, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x + 32, y + 32, 2.6, 0, Math.PI * 2); c.fill(); R(c, '#c9a86a', x + 20, y + 40, 46, 2); }
  function backbar(c, x, w) { shelf(c, x, 22, w, 3, bottles, '#3a2a20', 20); c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(0, 20, 0, 88); g.addColorStop(0, 'rgba(255,170,90,0.0)'); g.addColorStop(1, 'rgba(255,170,90,0.18)'); c.fillStyle = g; c.fillRect(x, 20, w, 70); c.restore(); }
  function desk(c, x, y, w = 70, col = '#6a4a32', pc = true) { block(c, x, y, w, 22, 18, col, { panels: 2, handles: true }); if (pc) { R(c, INK, x + w / 2 - 13, y - 14, 26, 18); R(c, '#14243a', x + w / 2 - 12, y - 13, 24, 15); R(c, '#3d99d6', x + w / 2 - 10, y - 11, 14, 2); R(c, '#7cdeb5', x + w / 2 - 10, y - 7, 10, 2); R(c, '#2a2d36', x + w / 2 - 2, y + 2, 4, 3); R(c, '#2a2d36', x + w / 2 - 10, y + 8, 20, 4); } R(c, '#f4f1ea', x + 6, y + 6, 10, 8); }
  function chair(c, x, y, col = '#2a3f62') { block(c, x, y - 10, 16, 4, 12, shade(col, -0.1)); block(c, x, y, 16, 10, 6, col); }
  function hospitalBed(c, x, y) { block(c, x, y, 44, 82, 10, '#c9d1d6'); R(c, '#f4f8fa', x + 3, y + 3, 38, 76); R(c, '#9fd8f0', x + 3, y + 34, 38, 45); R(c, shade('#9fd8f0', 0.3), x + 3, y + 34, 38, 2); R(c, '#ffffff', x + 8, y + 6, 28, 12); R(c, '#9aa3ab', x - 2, y - 2, 48, 3); R(c, INK, x + 50, y - 30, 2, 40); R(c, '#e8f6ff', x + 46, y - 34, 10, 12); R(c, '#9fd8f0', x + 47, y - 30, 8, 7); }
  function curtain(c, x, y, h, col = '#7cc4b8') { R(c, '#9aa3ab', x, y, 3, 2); for (let i = 0; i < h; i += 6) { R(c, INK, x - 1, y + 2 + i, 6, 6); R(c, i % 12 ? col : shade(col, -0.15), x, y + 2 + i, 4, 6); } }
  function lockers(c, x, y, n, col = '#3d6e8a') { for (let i = 0; i < n; i++) { const lx = x + i * 18; R(c, INK, lx - 1, y - 1, 18, 62); R(c, col, lx, y, 16, 60); R(c, shade(col, 0.25), lx, y, 16, 1); for (let k = 0; k < 3; k++) R(c, shade(col, -0.35), lx + 3, y + 6 + k * 3, 10, 1); R(c, '#c9d1d6', lx + 12, y + 30, 2, 6); } }
  function cellBars(c, x, y, w, h) { R(c, '#1d2024', x, y, w, h); R(c, '#2a2f36', x + 2, y + 2, w - 4, h - 4); for (let i = 4; i < w; i += 8) { R(c, INK, x + i - 1, y, 4, h); R(c, '#9aa3ab', x + i, y, 2, h); R(c, '#c9d1d6', x + i, y, 1, h); } R(c, INK, x, y + h - 4, w, 4); R(c, '#9aa3ab', x, y + h * 0.5, w, 2); }
  function benchPress(c, x, y) { block(c, x, y + 10, 60, 14, 10, '#1d2024'); R(c, INK, x - 8, y - 4, 76, 4); R(c, '#c9d1d6', x - 8, y - 3, 76, 2); for (const dx of [-14, 64]) { R(c, INK, x + dx - 1, y - 12, 10, 20); R(c, '#2a2d36', x + dx, y - 11, 8, 18); R(c, '#e05a4a', x + dx, y - 11, 8, 2); } R(c, '#5a606b', x + 2, y - 6, 3, 18); R(c, '#5a606b', x + 55, y - 6, 3, 18); }
  function dumbbells(c, x, y, w) { block(c, x, y, w, 10, 14, '#2a2d36'); for (let i = 4; i < w - 10; i += 14) { R(c, INK, x + i, y + 1, 12, 7); R(c, '#5a606b', x + i + 1, y + 2, 10, 5); R(c, INK, x + i + 4, y + 3, 4, 3); } }
  function treadmill(c, x, y) { block(c, x, y + 20, 34, 56, 6, '#2a2d36'); R(c, '#14161a', x + 4, y + 24, 26, 48); for (let i = 0; i < 48; i += 6) R(c, '#1d2024', x + 4, y + 24 + i, 26, 1); R(c, INK, x + 2, y, 30, 22); R(c, '#3a3f48', x + 3, y + 1, 28, 18); R(c, '#7cdeb5', x + 8, y + 4, 18, 6); R(c, '#9aa3ab', x + 1, y + 16, 2, 10); R(c, '#9aa3ab', x + 31, y + 16, 2, 10); }
  function punchBag(c, x, y) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x + 2, y, 10, 3, 0, 0, Math.PI * 2); c.fill(); R(c, '#9aa3ab', x, y - 70, 1, 20); R(c, INK, x - 9, y - 52, 19, 46); R(c, '#c8432f', x - 8, y - 51, 17, 44); R(c, shade('#c8432f', 0.3), x - 8, y - 51, 4, 44); R(c, '#1d2024', x - 8, y - 30, 17, 4); }
  function tattooChair(c, x, y) { block(c, x, y, 34, 70, 10, '#1d2024'); R(c, '#2a2d36', x + 3, y + 3, 28, 22); R(c, '#3a3f48', x + 3, y + 3, 28, 2); R(c, INK, x + 40, y + 10, 14, 20); R(c, '#c9d1d6', x + 41, y + 11, 12, 18); R(c, '#e05a4a', x + 43, y + 14, 8, 2); R(c, '#9aa3ab', x + 46, y + 30, 2, 30); }
  function flash(c, x, y, w, rows, seed) { const r = rng(seed); for (let k = 0; k < rows; k++) for (let i = 0; i < Math.floor(w / 24); i++) { const px = x + i * 24, py = y + k * 26; R(c, INK, px - 1, py - 1, 22, 24); R(c, '#f4ead2', px, py, 20, 22); const col = pick(r, ['#e05a4a', '#1d2024', '#3d7fd0', '#2f8f6a', '#a34dff']); const t = Math.floor(r() * 3); c.fillStyle = col; if (t === 0) { c.beginPath(); c.moveTo(px + 10, py + 18); c.bezierCurveTo(px - 2, py + 8, px + 6, py + 2, px + 10, py + 8); c.bezierCurveTo(px + 14, py + 2, px + 22, py + 8, px + 10, py + 18); c.fill(); } else if (t === 1) { c.beginPath(); c.arc(px + 10, py + 9, 5, 0, Math.PI * 2); c.fill(); R(c, col, px + 9, py + 13, 2, 7); } else { c.beginPath(); c.moveTo(px + 10, py + 3); c.lineTo(px + 17, py + 18); c.lineTo(px + 3, py + 18); c.fill(); } } }
  function carLift(c, x, y, w, h, car) { R(c, '#1d2024', x, y, w, h); R(c, '#e2c24a', x, y, w, 4); R(c, '#e2c24a', x, y + h - 4, w, 4); for (let i = 8; i < w; i += 16) { R(c, '#e2c24a', x + i, y, 8, 4); R(c, '#e2c24a', x + i, y + h - 4, 8, 4); R(c, '#1d2024', x + i + 4, y, 4, 4); R(c, '#1d2024', x + i + 4, y + h - 4, 4, 4); } for (const dx of [10, w - 22]) { R(c, INK, x + dx - 1, y + 14, 14, h - 28); R(c, '#9aa3ab', x + dx, y + 15, 12, h - 30); R(c, '#c9d1d6', x + dx, y + 15, 2, h - 30); } if (car) car(c, x + w / 2, y + h / 2); }
  function toolChest(c, x, y, col = '#c8432f') { block(c, x, y, 70, 18, 46, col, { panels: 1 }); for (let i = 0; i < 5; i++) { R(c, shade(col, -0.45), x + 2, y + 22 + i * 8, 66, 1); R(c, '#c9d1d6', x + 26, y + 25 + i * 8, 18, 1); } R(c, '#c9d1d6', x + 4, y + 4, 10, 3); R(c, '#9aa3ab', x + 30, y + 6, 14, 3); }
  function pegboard(c, x, y, w, h) { R(c, INK, x - 1, y - 1, w + 2, h + 2); R(c, '#b9925a', x, y, w, h); for (let yy = y + 3; yy < y + h; yy += 6) for (let xx = x + 3; xx < x + w; xx += 6) R(c, '#8a6a3e', xx, yy, 1, 1); for (let i = 6; i < w - 8; i += 14) { R(c, INK, x + i, y + 6, 3, 18); R(c, '#9aa3ab', x + i, y + 6, 2, 16); R(c, '#c8432f', x + i - 1, y + 18, 4, 6); } }
  function tires(c, x, y, n) { for (let i = 0; i < n; i++) { const ty = y - i * 8; c.fillStyle = INK; c.beginPath(); c.ellipse(x, ty, 15, 7, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2a2d33'; c.beginPath(); c.ellipse(x, ty - 1, 14, 6, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#14161a'; c.beginPath(); c.ellipse(x, ty - 1, 7, 3, 0, 0, Math.PI * 2); c.fill(); R(c, '#3a3d44', x - 10, ty - 5, 8, 1); } }
  function vault(c, x, y, r0 = 30) { R(c, INK, x - r0 - 6, y - r0 - 6, (r0 + 6) * 2, (r0 + 6) * 2); R(c, '#5a606b', x - r0 - 5, y - r0 - 5, (r0 + 5) * 2, (r0 + 5) * 2); c.fillStyle = INK; c.beginPath(); c.arc(x, y, r0 + 1, 0, Math.PI * 2); c.fill(); const g = c.createRadialGradient(x - 8, y - 8, 4, x, y, r0); g.addColorStop(0, '#d9dde2'); g.addColorStop(1, '#6a717c'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#3a3f48'; c.lineWidth = 2; for (let a = 0; a < 6; a++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r0 * 0.7, y + Math.sin(a) * r0 * 0.7); c.stroke(); } c.fillStyle = '#3a3f48'; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill(); for (let a = 0; a < 12; a++) R(c, '#c9d1d6', x + Math.cos(a / 12 * 6.283) * (r0 - 4) - 1, y + Math.sin(a / 12 * 6.283) * (r0 - 4) - 1, 2, 2); }
  function booth(c, x, y, w, col = '#c84659') { block(c, x, y, w, 10, 18, col, { panels: 3 }); block(c, x + 10, y + 34, w - 20, 26, 16, '#e8e2d0'); block(c, x, y + 78, w, 10, 10, col, { panels: 3 }); R(c, '#f2c84a', x + w / 2 - 14, y + 40, 10, 6); R(c, '#ffffff', x + w / 2 + 4, y + 42, 8, 5); R(c, '#e05a4a', x + w / 2 - 2, y + 48, 3, 6); }
  function djBooth(c, x, y) { block(c, x, y, 110, 22, 30, '#1d1430', { panels: 2 }); for (const dx of [10, 62]) { c.fillStyle = INK; c.beginPath(); c.arc(x + dx + 18, y + 11, 10, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2a2d36'; c.beginPath(); c.arc(x + dx + 18, y + 11, 8, 0, Math.PI * 2); c.fill(); R(c, '#ff4ad8', x + dx + 17, y + 10, 2, 2); } R(c, '#3ad0ff', x + 44, y + 6, 18, 10); for (let i = 0; i < 6; i++) R(c, ['#ff4ad8', '#3ad0ff', '#c9e86a'][i % 3], x + 4 + i * 18, y + 36, 10, 3); }
  function speaker(c, x, y) { block(c, x, y, 30, 10, 50, '#14111c'); for (const dy of [18, 40]) { c.fillStyle = INK; c.beginPath(); c.arc(x + 15, y + dy, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2a2d36'; c.beginPath(); c.arc(x + 15, y + dy, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = '#4a4f5a'; c.beginPath(); c.arc(x + 15, y + dy, 3, 0, Math.PI * 2); c.fill(); } }
  function atm(c, x, y) { block(c, x, y, 34, 10, 52, '#3a4250'); R(c, '#14171c', x + 4, y + 14, 26, 16); R(c, '#7ad8ff', x + 6, y + 16, 22, 12); R(c, '#2a6a74', x + 4, y + 2, 26, 6); for (let i = 0; i < 9; i++) R(c, '#9aa3ab', x + 8 + (i % 3) * 6, y + 34 + Math.floor(i / 3) * 4, 4, 2); }
  function waiting(c, x, y, n, col = '#3d7fd0') { for (let i = 0; i < n; i++) chair(c, x + i * 20, y, col); }

  // ---------- light: soft additive pools for drawGround (per frame) ----------
  function glow(c, x, y, r, col, a = 0.35) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, col + Math.round(a * 255).toString(16).padStart(2, '0')); g.addColorStop(1, col + '00'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
  function ceilingLights(c, xs, y = 0) { for (const x of xs) { R(c, INK, x - 16, y + 2, 32, 4); R(c, '#fff7dd', x - 15, y + 3, 30, 2); } }

  root.NightshiftInteriorKit = Object.freeze({ W, H, WALL, INK, R, shade, rng, floor, wall, neon, poster, windowNight, clock, shelf, bottles, boxes, shoes, guns, pistols, parts, meds, files, gunSil,
    block, counter, rug, sofa, bed, tv, plant, lamp, stool, fridges, aisle, register, displayCase, rack, mannequin, mirror, poolTable, backbar, desk, chair, hospitalBed, curtain,
    lockers, cellBars, benchPress, dumbbells, treadmill, punchBag, tattooChair, flash, carLift, toolChest, pegboard, tires, vault, booth, djBooth, speaker, atm, waiting, glow, ceilingLights });
})(typeof window !== 'undefined' ? window : globalThis);
