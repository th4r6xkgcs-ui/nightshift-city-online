/* Supply-chain art (Claude-owned): pixel-art places drawn in world space, the apartment workbench, and the pixel
 * icons used by the backpack / workbench / shop panels (materials + a side view of every gun).
 * Everything is procedural canvas drawing (no image files). Night lights punch through the game's lightmap by
 * adding small light rects to NightshiftWorld.litWindows() while the world is being drawn.
 * API: NightshiftSupplyArt.{drawSite, signLift, drawBench, matIcon, gunIcon} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const O = (c, col, x, y, rx, ry) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
  const C = (c, col, x, y, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const light = (x, y, w = 8, h = 6) => { try { const L = root.NightshiftWorld?.litWindows?.(); if (L && L.length < 160) L.push({ x, y, w, h }); } catch { /* lightmap optional */ } };
  const glow = (c, x, y, r, col) => { c.save(); c.globalCompositeOperation = 'lighter'; const gr = c.createRadialGradient?.(x, y, 0, x, y, r); if (gr) { gr.addColorStop(0, col); gr.addColorStop(1, col.slice(0, 7) + '00'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); } c.restore(); };
  const shadow = (c, x, y, w, h) => R(c, '#05080f55', x + 3, y + 4, w, h);
  // A standing ring on the ground marking where to stand (pulses when the place is usable).
  function standHere(c, x, y, t, col, on) {
    c.save(); c.globalAlpha = on ? 0.55 + 0.25 * Math.sin(t * 3) : 0.25; c.strokeStyle = col; c.lineWidth = 2; c.setLineDash([5, 4]); c.lineDashOffset = -t * 12;
    c.beginPath(); c.ellipse(x, y + 4, 18, 9, 0, 0, Math.PI * 2); c.stroke(); c.restore();
  }
  // Chain-link fence segment (horizontal or vertical)
  function fence(c, x, y, len, vertical) {
    for (let i = 0; i <= len; i += 22) R(c, '#5b6168', vertical ? x - 1 : x + i - 1, vertical ? y + i - 1 : y - 1, 3, 3);
    c.save(); c.strokeStyle = '#9aa3ab66'; c.lineWidth = 1; c.beginPath();
    for (let i = 0; i < len; i += 4) { if (vertical) { c.moveTo(x - 2, y + i); c.lineTo(x + 2, y + i + 4); } else { c.moveTo(x + i, y - 2); c.lineTo(x + i + 4, y + 2); } }
    c.stroke(); R(c, '#8a929a', vertical ? x - 0.5 : x, vertical ? y : y - 2.5, vertical ? 1 : len, vertical ? len : 1); c.restore();
  }

  // ---------------- places ----------------
  function scrapyard(c, x, y, t, info) {
    R(c, '#3e352b', x - 130, y - 125, 260, 140); // dirt lot
    const r = rng(77); for (let i = 0; i < 90; i++) R(c, r() < 0.5 ? '#4d4337' : '#2f2820', x - 128 + r() * 256, y - 123 + r() * 136, 2, 2);
    for (let i = 0; i < 2; i++) for (let k = 0; k < 24; k++) R(c, '#2a231c', x - 30 + i * 22 + Math.sin(k * 0.5) * 3, y - 10 - k * 4.5, 5, 2); // tyre tracks
    fence(c, x - 130, y - 125, 260); fence(c, x - 130, y - 125, 120, true); fence(c, x + 130, y - 125, 120, true);
    // crushed car stack (back left)
    for (let k = 0; k < 3; k++) { const yy = y - 112 + k * 13, col = ['#8b3a32', '#2f5d7c', '#5e7a3a'][k]; shadow(c, x - 118, yy, 54, 11); R(c, col, x - 118 + (k % 2) * 3, yy, 54, 11); R(c, '#00000033', x - 118 + (k % 2) * 3, yy + 8, 54, 3); R(c, '#9fc3d655', x - 104 + (k % 2) * 3, yy + 2, 14, 4); R(c, '#9fc3d655', x - 84 + (k % 2) * 3, yy + 2, 10, 4); R(c, '#1b1b1b', x - 114 + (k % 2) * 3, yy + 9, 8, 2); R(c, '#1b1b1b', x - 82 + (k % 2) * 3, yy + 9, 8, 2); }
    // tyre stack
    for (const [tx, ty] of [[x - 50, y - 100], [x - 38, y - 96], [x - 44, y - 88]]) { C(c, '#121212', tx, ty, 7); C(c, '#2c2c2c', tx, ty, 4); C(c, '#0a0a0a', tx, ty, 2); }
    // junk piles: size follows remaining stock
    const f = info.max ? 0.45 + 0.55 * (info.stock / info.max) : 1;
    const piles = [[x - 20, y - 70, 44], [x + 50, y - 88, 38], [x + 85, y - 40, 30]];
    piles.forEach(([px, py, pr], i) => {
      const rr = rng(100 + i), s = pr * f;
      O(c, '#05080f44', px + 4, py + 6, s, s * 0.5); O(c, '#5a4a3a', px, py, s, s * 0.55); O(c, '#6b5844', px - s * 0.2, py - s * 0.15, s * 0.7, s * 0.35);
      for (let k = 0; k < 26 * f; k++) { const a = rr() * Math.PI * 2, d = rr() * s * 0.85, bx = px + Math.cos(a) * d, by = py + Math.sin(a) * d * 0.5; R(c, ['#8b9399', '#a0522d', '#6e7b85', '#c46a2c', '#4f6d8a', '#b5b5a8'][k % 6], bx - 2, by - 1, 3 + rr() * 5, 2 + rr() * 2); }
      R(c, '#9aa3ab', px - s * 0.4, py - 3, s * 0.7, 2); // a pipe sticking out
      R(c, '#c9d1d6', px - s * 0.4, py - 3, s * 0.7, 0.8);
    });
    // magnet crane (back right), magnet sways
    R(c, '#c9a227', x + 92, y - 122, 26, 18); R(c, '#e3bf3a', x + 92, y - 122, 26, 3); R(c, '#2b2b2b', x + 96, y - 117, 8, 6); R(c, '#9fc3d6', x + 97, y - 116, 6, 3);
    const sw = Math.sin(t * 0.8) * 6; c.save(); c.strokeStyle = '#c9a227'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 104, y - 112); c.lineTo(x + 50 + sw, y - 108); c.stroke(); c.strokeStyle = '#333'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 50 + sw, y - 108); c.lineTo(x + 50 + sw, y - 96); c.stroke(); c.restore();
    C(c, '#3a3f45', x + 50 + sw, y - 93, 6); C(c, '#5d646b', x + 49 + sw, y - 94, 3);
    // gate posts at the front
    R(c, '#5b6168', x - 26, y + 2, 4, 14); R(c, '#5b6168', x + 22, y + 2, 4, 14);
    if (info.night) { R(c, '#2c2c2c', x + 120, y - 120, 3, 14); C(c, '#ffe9a8', x + 121, y - 122, 3); light(x + 121, y - 120, 8, 6); glow(c, x + 121, y - 120, 40, '#ffd27a55'); }
    standHere(c, x, y, t, '#7cdeb5', info.open && info.stock > 0);
  }
  function construction(c, x, y, t, info) {
    R(c, '#7c7a72', x - 120, y - 115, 240, 125); // concrete pad
    const r = rng(9); for (let i = 0; i < 70; i++) R(c, r() < 0.5 ? '#8a877e' : '#6c6a63', x - 118 + r() * 236, y - 113 + r() * 121, 2, 2);
    for (let i = 0; i < 4; i++) R(c, '#5f5d56', x - 120 + i * 60, y - 115, 1, 125);
    // scaffold + rebar frame (back)
    R(c, '#4d4a44', x - 110, y - 108, 120, 50);
    c.save(); c.strokeStyle = '#a8adb0'; c.lineWidth = 1.5; for (let i = 0; i <= 6; i++) { c.beginPath(); c.moveTo(x - 110 + i * 20, y - 108); c.lineTo(x - 110 + i * 20, y - 58); c.stroke(); } for (let j = 0; j <= 2; j++) { c.beginPath(); c.moveTo(x - 110, y - 108 + j * 25); c.lineTo(x + 10, y - 108 + j * 25); c.stroke(); } c.restore();
    for (let i = 0; i < 6; i++) R(c, '#b5884e', x - 108 + i * 20, y - 85, 17, 4);
    // skip with offcuts
    shadow(c, x + 25, y - 102, 70, 34); R(c, '#e0a71f', x + 25, y - 102, 70, 34); R(c, '#b98714', x + 25, y - 102, 70, 4); R(c, '#3a2f22', x + 30, y - 96, 60, 24);
    const f = info.max ? info.stock / info.max : 1;
    for (let k = 0; k < 14 * (0.3 + f); k++) R(c, k % 3 ? '#b5884e' : '#8b9399', x + 32 + (k * 17) % 54, y - 94 + (k * 7) % 18, k % 3 ? 14 : 18, 3);
    // pipe stack + cones + cement mixer
    for (let k = 0; k < 5; k++) { R(c, '#7d868c', x - 104, y - 48 + k * 5, 50, 4); R(c, '#b9c2c7', x - 104, y - 48 + k * 5, 50, 1); C(c, '#2e3438', x - 104, y - 46 + k * 5, 2); }
    for (const cx2 of [x - 30, x + 40, x + 100]) { O(c, '#05080f55', cx2 + 2, y + 2, 6, 3); c.fillStyle = '#ff7a1a'; c.beginPath(); c.moveTo(cx2 - 5, y + 2); c.lineTo(cx2 + 5, y + 2); c.lineTo(cx2, y - 10); c.closePath(); c.fill(); R(c, '#fff', cx2 - 3, y - 4, 6, 2); }
    const ang = info.open ? t * 2 : 0; C(c, '#5d646b', x + 75, y - 45, 14); c.save(); c.translate(x + 75, y - 45); c.rotate(ang); c.strokeStyle = '#e0a71f'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 1.2); c.stroke(); c.restore(); R(c, '#2b2b2b', x + 88, y - 50, 12, 10);
    // barrier along the front (gate open in the day, chained shut at night)
    for (let i = -120; i < 120; i += 16) { if (info.open && Math.abs(i + 8) < 26) continue; R(c, (i / 16) % 2 ? '#ff7a1a' : '#f2f2f2', x + i, y + 6, 16, 5); }
    if (!info.open) { R(c, '#b5b5b5', x - 26, y + 7, 52, 2); C(c, '#e0a71f', x, y + 8, 4); }
    if (info.night) { R(c, '#2c2c2c', x - 118, y - 112, 3, 16); C(c, '#ffffff', x - 117, y - 113, 3); light(x - 117, y - 110, 8, 6); glow(c, x - 117, y - 110, 50, '#e8f3ff44'); }
    standHere(c, x, y, t, '#7cdeb5', info.open && info.stock > 0);
  }
  function plots(c, x, y, t, info) {
    R(c, '#2f4a2c', x - 115, y - 105, 230, 120); // lawn
    const r = rng(31); for (let i = 0; i < 90; i++) R(c, r() < 0.5 ? '#3a5a35' : '#263f24', x - 113 + r() * 226, y - 103 + r() * 116, 2, 3);
    for (let i = -115; i < 115; i += 10) { R(c, '#1e331c', x + i, y - 108, 10, 6); C(c, '#2b4a27', x + i + 5, y - 107, 5); } // hedge
    const f = info.max ? info.stock / info.max : 1, n = Math.round(f * 18);
    let k = 0;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      const bx = x - 100 + col * 70, by = y - 90 + row * 46;
      shadow(c, bx, by, 60, 34); R(c, '#6b4a2e', bx, by, 60, 34); R(c, '#8a6440', bx, by, 60, 3); R(c, '#2d1e14', bx + 4, by + 5, 52, 25);
      for (let p = 0; p < 3; p++) {
        const px = bx + 12 + p * 18, py = by + 17, alive = k++ < n;
        if (!alive) { R(c, '#4b3a26', px - 2, py, 4, 3); continue; }
        const sway = Math.sin(t * 2 + p + row * 2) * 1.2;
        c.save(); c.translate(px, py); for (let l = 0; l < 7; l++) { const a = -Math.PI / 2 + (l - 3) * 0.45; c.fillStyle = l % 2 ? '#3fae4a' : '#58c95e'; c.beginPath(); c.ellipse(Math.cos(a) * 6 + sway, Math.sin(a) * 6, 5, 1.7, a, 0, Math.PI * 2); c.fill(); } C(c, '#7ee07f', sway, -1, 1.6); c.restore();
      }
    }
    // watering can + warning sign
    R(c, '#4f7f9a', x + 95, y - 10, 12, 9); R(c, '#4f7f9a', x + 106, y - 14, 6, 2); R(c, '#9fc3d6', x + 96, y - 9, 10, 2);
    R(c, '#5a4630', x - 108, y - 14, 3, 14); R(c, '#e3d9b6', x - 116, y - 22, 20, 10); R(c, '#b33', x - 114, y - 20, 16, 2);
    standHere(c, x, y, t, '#7cdeb5', info.stock > 0);
  }
  function boat(c, x, y, t, info) {
    const wx = x + 32, wy = y - 150, ww = 2200 - wx, wh = 320;
    const gr = c.createLinearGradient?.(wx, 0, wx + ww, 0); if (gr) { gr.addColorStop(0, '#0f3a55'); gr.addColorStop(1, '#0a2238'); c.fillStyle = gr; } else c.fillStyle = '#0d3049';
    c.fillRect(wx, wy, ww, wh);
    for (let i = 0; i < 18; i++) { const u = ((i * 37) % 100) / 100, v = ((i * 61 + t * 6) % 100) / 100; R(c, i % 3 ? '#4fa3cf44' : '#bfe8ff55', wx + 4 + u * (ww - 8), wy + v * wh, 1, 7); }
    for (let yy = wy; yy < wy + wh; yy += 6) R(c, '#d8f2ff77', wx + Math.sin(t * 2 + yy * 0.2) * 1.2, yy, 2, 4); // foam edge
    // jetty
    shadow(c, x - 30, y - 12, 80, 26); R(c, '#3b2716', x - 30, y - 12, 80, 26); for (let i = 0; i < 10; i++) { R(c, '#7a5532', x - 29 + i * 8, y - 11, 7, 24); R(c, '#9c7048', x - 29 + i * 8, y - 11, 7, 2); }
    for (const px of [x - 30, x + 46]) R(c, '#2a1a0e', px, y + 12, 4, 6);
    // the speedboat (only at night): long axis north-south in the thin channel
    if (info.open) {
      const by = y - 4 + Math.sin(t * 1.5) * 1.5, bx = x + 62;
      c.save(); c.translate(bx, by);
      O(c, '#05080f88', 3, 4, 12, 30);
      c.fillStyle = '#0b0f17'; c.beginPath(); c.moveTo(0, -32); c.lineTo(11, -18); c.lineTo(11, 26); c.lineTo(-11, 26); c.lineTo(-11, -18); c.closePath(); c.fill();
      c.fillStyle = '#e9e6dc'; c.beginPath(); c.moveTo(0, -30); c.lineTo(10, -17); c.lineTo(10, 25); c.lineTo(-10, 25); c.lineTo(-10, -17); c.closePath(); c.fill();
      R(c, '#c0473f', -10, 18, 20, 3); R(c, '#2b3a52', -6, -10, 12, 8); R(c, '#9fc3d6', -5, -9, 10, 3); R(c, '#6b4a2e', -8, 2, 16, 14);
      const n = Math.max(0, Math.min(6, info.stock || 0));
      for (let k = 0; k < n; k++) { R(c, '#f4f4f0', -7 + (k % 2) * 7, 3 + Math.floor(k / 2) * 4, 6, 3); R(c, '#c9c9c0', -7 + (k % 2) * 7, 5 + Math.floor(k / 2) * 4, 6, 1); }
      R(c, '#222', -2, 25, 4, 5); // outboard
      c.restore();
      C(c, '#ff5161', bx, by - 30, 1.6); glow(c, bx, by - 30, 10, '#ff516166'); light(bx, by + 6, 10, 12);
      for (let k = 0; k < 3; k++) R(c, '#f4f4f0', x - 22 + k * 9, y - 6, 7, 5); // bricks on the jetty
    } else { R(c, '#6b4a2e', x + 40, y - 6, 2, 10); c.save(); c.strokeStyle = '#c9b58a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 41, y - 2); c.quadraticCurveTo(x + 52, y + 6, x + 58, y - 4); c.stroke(); c.restore(); }
    standHere(c, x, y, t, '#7cdeb5', info.open && info.stock > 0);
  }
  function pharmacy(c, x, y, t, info) {
    // back wall + door of the clinic block
    R(c, '#5d5a63', x - 80, y - 95, 160, 40); R(c, '#4a4750', x - 80, y - 58, 160, 4);
    for (let i = 0; i < 8; i++) R(c, '#55525b', x - 80 + i * 20, y - 95, 1, 37);
    R(c, '#2d3a44', x + 30, y - 88, 22, 30); R(c, '#9fc3d6', x + 34, y - 84, 14, 8); R(c, '#e8e3d0', x + 26, y - 94, 30, 6); R(c, '#2a7d4f', x + 36, y - 93, 10, 4); R(c, '#fff', x + 40, y - 94, 2, 6); R(c, '#fff', x + 38, y - 92, 6, 2);
    C(c, info.night ? '#fff6d0' : '#bbb7a0', x + 60, y - 84, 3); if (info.night) { light(x + 60, y - 82, 8, 6); glow(c, x + 60, y - 80, 46, '#ffe9a855'); }
    // dumpster
    shadow(c, x - 52, y - 46, 54, 30); R(c, '#2f6b3f', x - 52, y - 46, 54, 30); R(c, '#255632', x - 52, y - 46, 54, 5); R(c, '#3f8a52', x - 50, y - 44, 50, 2);
    R(c, '#1d4027', x - 49, y - 40, 22, 22); R(c, '#1d4027', x - 25, y - 40, 22, 22); R(c, '#cfd6d6', x - 40, y - 26, 8, 2);
    // trash bags + boxes (fewer when picked over)
    const f = info.max ? info.stock / info.max : 1;
    for (let k = 0; k < Math.round(2 + 4 * f); k++) { const bx = x + 8 + (k % 3) * 13, by = y - 40 + Math.floor(k / 3) * 12; O(c, '#05080f55', bx + 2, by + 3, 7, 4); O(c, '#15181d', bx, by, 7, 5); C(c, '#2a2f36', bx - 2, by - 2, 2); }
    for (let k = 0; k < 2; k++) { R(c, '#a07a4a', x - 72 + k * 10, y - 40 + k * 8, 14, 11); R(c, '#c9a06a', x - 72 + k * 10, y - 40 + k * 8, 14, 2); R(c, '#7a5a34', x - 66 + k * 10, y - 40 + k * 8, 2, 11); }
    // a rat now and then
    const rp = (t * 0.5) % 6; if (rp < 1.2) { const rx = x - 60 + rp * 90; O(c, '#3a3330', rx, y - 6, 4, 2); R(c, '#3a3330', rx - 8, y - 6, 4, 1); }
    standHere(c, x, y, t, '#7cdeb5', info.stock > 0);
  }
  function container(c, x, y, t, info) {
    R(c, '#2b3138', x - 56, y - 104, 112, 114); // asphalt yard squeezed against the east edge
    for (let i = 0; i < 4; i++) R(c, '#c9b14a', x - 50 + i * 26, y + 4, 14, 2);
    for (const [cx2, cy2, col] of [[x - 52, y - 100, '#7a2e2a'], [x - 52, y - 76, '#2e5a7a']]) { shadow(c, cx2, cy2, 60, 22); R(c, col, cx2, cy2, 60, 22); for (let k = 2; k < 60; k += 4) R(c, '#00000022', cx2 + k, cy2, 1, 22); R(c, '#ffffff22', cx2, cy2, 60, 2); }
    const ox = x - 52, oy = y - 48; // the open one: doors swung, crates inside
    shadow(c, ox, oy, 64, 26); R(c, '#2f6b4f', ox, oy, 64, 26); for (let k = 2; k < 64; k += 4) R(c, '#00000024', ox + k, oy, 1, 26); R(c, '#ffffff24', ox, oy, 64, 2);
    R(c, '#11161b', ox + 42, oy + 3, 20, 20);
    const f = info.max ? info.stock / info.max : 1;
    for (let k = 0; k < Math.round(1 + 3 * f); k++) { R(c, '#6b5a3a', ox + 44 + (k % 2) * 8, oy + 5 + Math.floor(k / 2) * 8, 7, 7); R(c, '#8a744a', ox + 44 + (k % 2) * 8, oy + 5 + Math.floor(k / 2) * 8, 7, 1); }
    R(c, '#2f6b4f', ox + 64, oy - 8, 3, 16); R(c, '#2f6b4f', ox + 64, oy + 18, 3, 16);
    R(c, '#c9c9c0', ox + 58, oy + 12, 6, 2);
    R(c, '#8a6a40', x + 18, y - 96, 26, 14); for (let k = 0; k < 4; k++) R(c, '#a8834e', x + 18, y - 96 + k * 4, 26, 2);
    R(c, '#4a5a3a', x + 21, y - 103, 20, 12); R(c, '#5d7048', x + 21, y - 103, 20, 2); R(c, '#2a3320', x + 29, y - 101, 4, 9);
    if (info.open) { const fl = 0.7 + 0.3 * Math.sin(t * 9) * Math.sin(t * 3.1); R(c, '#2c2c2c', x + 34, y - 70, 8, 5); glow(c, x + 38, y - 72, 34 * fl, '#fff3c055'); light(x + 38, y - 72, 10, 8); }
    standHere(c, x, y, t, '#ffb347', info.open && info.stock > 0);
  }
  function trim(c, x, y, t, info) {
    R(c, '#3a3a2c', x - 70, y - 100, 140, 108); // overgrown yard
    const r = rng(5); for (let i = 0; i < 50; i++) R(c, r() < 0.5 ? '#4a4a36' : '#2e2e22', x - 68 + r() * 136, y - 98 + r() * 104, 2, 3);
    // shack: corrugated roof seen from above, plank front wall
    shadow(c, x - 42, y - 92, 84, 52); R(c, '#6c6e6a', x - 42, y - 92, 84, 52); for (let k = 0; k < 84; k += 5) { R(c, '#7f827d', x - 42 + k, y - 92, 2, 52); R(c, '#575955', x - 40 + k, y - 92, 1, 52); }
    R(c, '#8a4a2a55', x + 4, y - 80, 20, 14); R(c, '#8a4a2a44', x - 34, y - 70, 12, 10); // rust patches
    R(c, '#5a4128', x - 42, y - 40, 84, 16); for (let k = 0; k < 84; k += 7) R(c, '#46321e', x - 42 + k, y - 40, 1, 16);
    R(c, '#2a1d12', x - 7, y - 40, 14, 16); C(c, '#c9a227', x + 4, y - 32, 1.2);
    R(c, '#2c2016', x - 34, y - 36, 14, 8); R(c, '#8a6a40', x - 36, y - 33, 18, 2); R(c, '#8a6a40', x - 32, y - 37, 2, 10); // boarded window
    const lit = info.night; if (lit) { R(c, '#ffcf6a', x - 6, y - 26, 12, 2); light(x, y - 26, 12, 6); glow(c, x, y - 22, 30, '#ffcf6a44'); }
    // drying line with leaves
    R(c, '#5a4630', x + 48, y - 70, 2, 30); R(c, '#5a4630', x + 66, y - 70, 2, 30); c.save(); c.strokeStyle = '#bbb'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 49, y - 66); c.lineTo(x + 67, y - 66); c.stroke(); c.restore();
    for (let k = 0; k < 4; k++) { const sw = Math.sin(t * 2 + k) * 1; R(c, '#5aa64e', x + 51 + k * 4 + sw, y - 65, 3, 6); }
    // barrels
    for (const [bx, by] of [[x + 52, y - 26], [x + 60, y - 18]]) { O(c, '#05080f44', bx + 2, by + 3, 6, 3); C(c, '#3f5f7a', bx, by, 6); C(c, '#55799a', bx - 1, by - 1, 3); }
    standHere(c, x, y, t, '#c49bff', true);
  }
  function kitchen(c, x, y, t, info) {
    // motel row: flat roof, 6 doors facing south, parking in front
    R(c, '#2b3138', x - 110, y - 20, 220, 30); for (let i = 0; i < 7; i++) R(c, '#d8d8d0', x - 106 + i * 32, y - 14, 2, 22);
    shadow(c, x - 110, y - 100, 220, 58); R(c, '#9b8a78', x - 110, y - 100, 220, 50); R(c, '#b3a18c', x - 110, y - 100, 220, 3); for (let k = 0; k < 220; k += 30) R(c, '#8a7a68', x - 110 + k, y - 98, 1, 46);
    R(c, '#d6c3a6', x - 110, y - 50, 220, 10);
    for (let i = 0; i < 6; i++) {
      const dx = x - 100 + i * 36, door6 = i === 4;
      R(c, door6 ? '#2a5068' : '#4a5d6e', dx, y - 50, 14, 10); R(c, '#c9a227', dx + 10, y - 46, 1.5, 1.5);
      R(c, '#1c2a36', dx + 18, y - 49, 12, 6); const on = info.night && (door6 || (i * 7 + Math.floor(t / 7)) % 3 === 0);
      if (on) { R(c, door6 ? '#bfe3ff' : '#ffd38a', dx + 19, y - 48, 10, 4); light(dx + 24, y - 46, 10, 5); }
      R(c, '#f2f2f2', dx + 3, y - 49, 5, 3); c.save(); c.fillStyle = '#111'; c.font = '5px monospace'; c.fillText(String(i + 1 + (i >= 4 ? 1 : 0)), dx + 4, y - 46.5); c.restore();
    }
    // neon sign on a pole (flickers)
    R(c, '#2c2c2c', x + 112, y - 112, 3, 60); const fl = Math.sin(t * 13) > -0.92 ? 1 : 0.25;
    R(c, '#1a1424', x + 96, y - 128, 50, 18); c.save(); c.globalAlpha = info.night ? fl : 0.6; c.fillStyle = '#ff6fbf'; c.font = 'bold 8px monospace'; c.fillText('STARLITE', x + 99, y - 116); c.fillStyle = '#5fe8ff'; c.fillRect(x + 99, y - 113, 44, 1); c.restore();
    if (info.night) { light(x + 121, y - 119, 46, 14); glow(c, x + 121, y - 119, 50, '#ff6fbf44'); }
    // ice machine + room 6 steam
    R(c, '#c9d6dc', x - 122, y - 46, 10, 14); R(c, '#5fa8d6', x - 121, y - 44, 8, 3);
    for (let k = 0; k < 3; k++) { const ph = (t * 0.7 + k / 3) % 1; c.save(); c.globalAlpha = 0.35 * (1 - ph); C(c, '#e8eef2', x + 48 + Math.sin(ph * 6 + k) * 3, y - 104 - ph * 22, 3 + ph * 5); c.restore(); }
    standHere(c, x, y, t, '#c49bff', true);
  }
  function trailer(c, x, y, t, info) {
    R(c, '#4a4434', x - 80, y - 90, 160, 100); const r = rng(13); for (let i = 0; i < 50; i++) R(c, r() < 0.5 ? '#5a523e' : '#3a3528', x - 78 + r() * 156, y - 88 + r() * 96, 2, 2);
    // trailer body on blocks
    for (const bx of [x - 34, x + 18]) R(c, '#7d7d76', bx, y - 28, 12, 6);
    shadow(c, x - 46, y - 74, 92, 44);
    c.fillStyle = '#d8ccb0'; if (c.roundRect) { c.beginPath(); c.roundRect(x - 46, y - 74, 92, 44, 12); c.fill(); } else R(c, '#d8ccb0', x - 46, y - 74, 92, 44);
    R(c, '#b9604a', x - 44, y - 52, 88, 5); R(c, '#e8dfc8', x - 40, y - 72, 80, 3); R(c, '#8a4a2a44', x + 10, y - 66, 20, 8);
    for (const wx2 of [x - 34, x + 6]) { R(c, '#1c2a2a', wx2, y - 64, 16, 9); if (info.night) { R(c, '#8dff9a', wx2 + 1, y - 63, 14, 7); light(wx2 + 8, y - 60, 14, 8); } }
    R(c, '#5a4a3a', x + 30, y - 46, 10, 16); R(c, '#c9a227', x + 37, y - 39, 1.5, 1.5);
    // vent pipe + smoke
    R(c, '#5d646b', x - 12, y - 82, 5, 10); for (let k = 0; k < 4; k++) { const ph = (t * 0.6 + k / 4) % 1; c.save(); c.globalAlpha = 0.45 * (1 - ph); C(c, '#bfc8bf', x - 10 + Math.sin(ph * 5 + k) * 4, y - 86 - ph * 28, 3 + ph * 6); c.restore(); }
    // drums
    for (const [dx, dy, col] of [[x + 56, y - 60, '#2d6fb5'], [x + 64, y - 46, '#e0b021'], [x + 54, y - 34, '#2d6fb5']]) { O(c, '#05080f44', dx + 2, dy + 3, 7, 3); C(c, col, dx, dy, 7); C(c, '#ffffff33', dx - 2, dy - 2, 3); R(c, '#111', dx - 1, dy - 1, 2, 2); }
    // extension cable to a pole
    c.save(); c.strokeStyle = '#111'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 46, y - 50); c.quadraticCurveTo(x - 64, y - 20, x - 74, y - 70); c.stroke(); c.restore(); R(c, '#4a3a2a', x - 76, y - 86, 4, 18);
    standHere(c, x, y, t, '#c49bff', true);
  }
  function promoter(c, x, y, t, info) {
    R(c, '#7a1630', x - 50, y - 26, 100, 16); R(c, '#9a2040', x - 50, y - 26, 100, 2); // red carpet
    for (let k = 0; k < 4; k++) { const px = x - 46 + k * 30; R(c, '#c9a227', px, y - 36, 3, 14); C(c, '#ffe08a', px + 1.5, y - 37, 2.5); if (k < 3) { c.save(); c.strokeStyle = '#b3123a'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 2, y - 33); c.quadraticCurveTo(px + 16, y - 27, px + 31, y - 33); c.stroke(); c.restore(); } }
    if (info.open) {
      try { root.NightshiftSprites?.person?.({ x: x + 34, y: y - 18, angle: Math.PI * 0.9, color: '#d43f8d', id: 'promoter', hp: 40, moving: false }, false, { weapon: false, role: 'promoter' }); } catch { /* sprite optional */ }
      R(c, '#e8e3d0', x + 40, y - 22, 5, 7); glow(c, x, y - 30, 60, '#ff6fbf33'); light(x, y - 30, 30, 10);
    }
    standHere(c, x, y, t, '#ff7fd0', info.open);
  }
  function armsbuyer(c, x, y, t, info) {
    if (!info.open) { for (let k = 0; k < 2; k++) R(c, '#1a1a1a55', x - 8 + k * 16, y - 70, 4, 50); standHere(c, x, y, t, '#ffb347', false); return; }
    const vx = x - 14, vy = y - 78; // black van, nose north
    shadow(c, vx, vy, 30, 56); R(c, '#14171c', vx, vy, 30, 56); R(c, '#232830', vx + 2, vy + 2, 26, 50); R(c, '#3a4148', vx + 3, vy + 3, 24, 2);
    R(c, '#2a4256', vx + 4, vy + 4, 22, 9); R(c, '#9fc3d644', vx + 5, vy + 5, 8, 3); // windscreen
    R(c, '#0b0d10', vx + 28, vy + 22, 6, 22); // open side door
    R(c, '#ff304a', vx + 3, vy + 54, 5, 2); R(c, '#ff304a', vx + 22, vy + 54, 5, 2); glow(c, vx + 15, vy + 56, 14, '#ff304a44');
    for (let k = 0; k < 3; k++) { R(c, '#4a5a3a', x + 26 + (k % 2) * 12, y - 50 + Math.floor(k / 2) * 10, 11, 8); R(c, '#5d7048', x + 26 + (k % 2) * 12, y - 50 + Math.floor(k / 2) * 10, 11, 1); }
    const ex = (t * 1.2) % 1; c.save(); c.globalAlpha = 0.3 * (1 - ex); C(c, '#9aa3ab', vx + 10, vy + 60 + ex * 14, 3 + ex * 5); c.restore(); // exhaust
    light(x + 30, y - 46, 14, 10);
    standHere(c, x, y, t, '#ffb347', true);
  }
  function cart(c, x, y, stripeA, stripeB) { // small sidewalk stall: body x-26..x+26, y-34..y-8
    shadow(c, x - 26, y - 34, 52, 26); R(c, '#3e4a5a', x - 26, y - 30, 52, 22); R(c, '#2b3440', x - 26, y - 10, 52, 2);
    for (let k = 0; k < 7; k++) R(c, k % 2 ? stripeA : stripeB, x - 28 + k * 8, y - 36, 8, 7);
    R(c, '#1b1b1b', x - 24, y - 8, 4, 4); R(c, '#1b1b1b', x + 20, y - 8, 4, 4);
  }
  function hardware(c, x, y, t) {
    cart(c, x, y, '#1b1b1b', '#e0b021');
    const tools = [['#c0473f', 2, 9], ['#9aa3ab', 3, 11], ['#e0b021', 2, 8], ['#4f7f9a', 3, 10], ['#9aa3ab', 2, 9]];
    tools.forEach(([col, w, h], i) => R(c, col, x - 20 + i * 9, y - 28, w, h));
    for (let k = 0; k < 3; k++) { C(c, '#b9c2c7', x + 8 + k * 7, y - 14, 3); C(c, '#7d868c', x + 8 + k * 7, y - 14, 1.2); }
    R(c, '#e8e3d0', x - 22, y - 16, 10, 6); R(c, '#c0473f', x - 21, y - 15, 8, 1);
    standHere(c, x, y, t, '#ffd970', true);
  }
  function bags(c, x, y, t) {
    cart(c, x, y, '#f2f2f2', '#3d7fd0');
    ['#c0473f', '#3d7fd0', '#2f6b3f', '#e0a71f', '#6b4a8a'].forEach((col, i) => { const bx = x - 22 + i * 9, sw = Math.sin(t * 1.5 + i) * 0.8; R(c, '#222', bx + 3 + sw, y - 29, 1, 3); R(c, col, bx + sw, y - 26, 8, 11); R(c, '#00000033', bx + sw, y - 19, 8, 4); R(c, '#ffffff33', bx + 1 + sw, y - 25, 3, 2); });
    standHere(c, x, y, t, '#7cc7ff', true);
  }
  function lockup(c, x, y, t, info) {
    const lv = info.owned || 0;
    R(c, '#3a3f45', x - 70, y - 20, 140, 26); // forecourt
    shadow(c, x - 64, y - 96, 128, 76); R(c, '#6d6f6c', x - 64, y - 96, 128, 76); R(c, '#7f827d', x - 64, y - 96, 128, 3);
    for (let k = 0; k < 128; k += 16) R(c, '#5f615e', x - 64 + k, y - 96, 1, 60);
    R(c, '#c9a227', x - 64, y - 40, 128, 4); // hazard stripe
    for (let k = 0; k < 16; k++) R(c, k % 2 ? '#1b1b1b' : '#c9a227', x - 64 + k * 8, y - 40, 8, 4);
    // roll door: closed with FOR SALE board; owned: half up with light and the bench inside
    const open = lv > 0, dh = open ? 10 : 30;
    R(c, '#2a2d30', x - 30, y - 36, 60, 30);
    if (open) { R(c, '#3a2c1c', x - 28, y - 26, 56, 20); R(c, '#8a6a40', x - 22, y - 20, 44, 8); R(c, '#9aa3ab', x - 18, y - 22, 6, 3); R(c, '#c0473f', x + 6, y - 21, 8, 2); R(c, '#444', x + 16, y - 24, 3, 6); if (info.night || true) { light(x, y - 18, 40, 14); glow(c, x, y - 14, 40, '#ffd38a44'); } }
    for (let k = 0; k < dh; k += 3) R(c, k % 6 ? '#8e9396' : '#a5aaad', x - 30, y - 36 + k, 60, 2);
    if (!open) { R(c, '#e8e3d0', x - 18, y - 30, 36, 14); R(c, '#c0473f', x - 16, y - 28, 32, 3); c.save(); c.fillStyle = '#222'; c.font = 'bold 6px monospace'; c.fillText('FOR SALE', x - 14, y - 19); c.restore(); }
    // upgrades show on the roof: lv2 vent stack + compressor, lv3 second unit + antenna
    if (lv >= 2) { R(c, '#4d5b59', x - 54, y - 88, 22, 16); for (let k = 0; k < 4; k++) R(c, '#7f8f8b', x - 52, y - 86 + k * 4, 18, 1); C(c, '#2b3138', x + 40, y - 74, 9); c.save(); c.translate(x + 40, y - 74); c.rotate(t * 4); R(c, '#9aa3ab', -7, -1, 14, 2); R(c, '#9aa3ab', -1, -7, 2, 14); c.restore(); }
    if (lv >= 3) { R(c, '#596b6c', x + 6, y - 92, 40, 18); R(c, '#7f8f8b', x + 6, y - 92, 40, 2); R(c, '#4a5560', x + 52, y - 94, 2, 20); const on = info.night && (t % 1.4) < 0.5; C(c, on ? '#ff3b3b' : '#6b2a2a', x + 53, y - 95, 2); }
    c.save(); c.fillStyle = '#e8e3d0'; c.font = 'bold 9px monospace'; c.fillText('7', x + 22, y - 44); c.restore();
    standHere(c, x, y, t, '#ffb347', true);
  }
  const DRAW = { scrapyard, construction, plots, boat, pharmacy, container, trim, kitchen, trailer };
  function drawSite(c, s, info) {
    const { x, y } = s, t = info.t;
    if (s.kind === 'gather' || s.kind === 'process') return DRAW[s.spot.id]?.(c, x, y, t, info);
    if (s.kind === 'promoter') return promoter(c, x, y, t, info);
    if (s.kind === 'arms') return armsbuyer(c, x, y, t, info);
    if (s.kind === 'hardware') return hardware(c, x, y, t, info);
    if (s.kind === 'bags') return bags(c, x, y, t, info);
    if (s.kind === 'lockup') return lockup(c, x, y, t, info);
  }
  const LIFT = { scrapyard: 140, construction: 128, plots: 118, boat: 40, pharmacy: 108, container: 116, trim: 112, kitchen: 140, trailer: 100 };
  const signLift = (s) => (s.kind === 'gather' || s.kind === 'process' ? LIFT[s.spot.id] || 40 : s.kind === 'lockup' ? 110 : s.kind === 'arms' ? 92 : s.kind === 'promoter' ? 52 : 48);

  // ---------------- apartment workbench (room coords) ----------------
  function drawBench(c, pos, t) {
    c.save(); c.translate(pos.x, pos.y); c.scale(0.8, 0.8); benchBody(c, t); c.restore();
  }
  function benchBody(c, t) {
    const x = -40, y = -26;
    // pegboard on the wall above
    R(c, '#6b5236', x + 4, y - 30, 72, 26); for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) R(c, '#4a3826', x + 9 + i * 8, y - 26 + j * 8, 1.5, 1.5);
    R(c, '#9aa3ab', x + 12, y - 24, 3, 14); R(c, '#c0473f', x + 11, y - 26, 5, 4); // hammer
    R(c, '#b9c2c7', x + 24, y - 25, 2, 16); R(c, '#e0a71f', x + 23, y - 12, 4, 4); // screwdriver
    c.save(); c.strokeStyle = '#9aa3ab'; c.lineWidth = 2; c.beginPath(); c.arc(x + 40, y - 18, 5, 0, Math.PI * 2); c.stroke(); c.restore(); // tape roll
    R(c, '#7d868c', x + 52, y - 24, 14, 3); R(c, '#7d868c', x + 57, y - 24, 3, 14); // wrench
    // the bench
    R(c, '#05080f55', x + 4, y + 6, 80, 40); R(c, '#7a5532', x, y, 80, 34); R(c, '#9c7048', x, y, 80, 4); for (let k = 0; k < 80; k += 13) R(c, '#6a4728', x + k, y + 4, 1, 30);
    R(c, '#4a3220', x + 2, y + 32, 6, 10); R(c, '#4a3220', x + 72, y + 32, 6, 10);
    // vice + a pipe pistol in progress + parts
    R(c, '#3a3f45', x + 6, y + 6, 14, 10); R(c, '#5d646b', x + 6, y + 6, 14, 3); R(c, '#2b2f33', x + 10, y + 16, 6, 4);
    R(c, '#9aa3ab', x + 24, y + 12, 22, 4); R(c, '#c9d1d6', x + 24, y + 12, 22, 1); R(c, '#2a2a2a', x + 26, y + 16, 6, 8); R(c, '#cfcfcf', x + 33, y + 15, 7, 3); // pipe gun
    for (let k = 0; k < 4; k++) R(c, '#8b9399', x + 52 + (k % 2) * 6, y + 8 + Math.floor(k / 2) * 6, 4, 3);
    c.save(); c.strokeStyle = '#c9d1d6'; c.lineWidth = 1; c.beginPath(); for (let k = 0; k < 4; k++) c.arc(x + 70, y + 22 - k * 1.5, 3, 0, Math.PI); c.stroke(); c.restore(); // spring
    // desk lamp with warm light
    R(c, '#2b2f33', x + 64, y + 2, 2, 8); R(c, '#2b2f33', x + 60, y + 1, 10, 3); glow(c, x + 64, y + 8, 30 + Math.sin(t * 3) * 1, '#ffd38a33');
    c.save(); c.fillStyle = '#ffd970'; c.font = 'bold 7px monospace'; c.textAlign = 'center'; c.fillText('WORKBENCH', x + 40, y + 46); c.restore();
  }

  // ---------------- icons ----------------
  const iconCache = new Map();
  function pixCanvas(key, w, h, scale, paint) {
    const k = `${key}:${w}:${h}:${scale}`;
    let src = iconCache.get(k);
    if (!src) { src = document.createElement('canvas'); src.width = w; src.height = h; const c = src.getContext('2d'); c.imageSmoothingEnabled = false; paint(c); iconCache.set(k, src); }
    const out = document.createElement('canvas'); out.width = w * scale; out.height = h * scale; out.style.width = w * scale / 2 + 'px'; out.style.height = h * scale / 2 + 'px';
    const o = out.getContext('2d'); o.imageSmoothingEnabled = false; o.drawImage(src, 0, 0, w * scale, h * scale);
    return out;
  }
  const P = (c, col, x, y, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const MAT = {
    metal: (c) => { P(c, '#5d646b', 3, 8, 10, 5); P(c, '#8b9399', 4, 7, 8, 2); P(c, '#b9c2c7', 5, 7, 4, 1); P(c, '#a0522d', 9, 10, 3, 2); P(c, '#6e7b85', 2, 11, 4, 3); P(c, '#c46a2c', 11, 9, 2, 1); P(c, '#3a3f45', 3, 13, 10, 1); },
    pipe: (c) => { for (let i = 0; i < 12; i++) P(c, '#7d868c', 2 + i, 11 - i * 0.6 | 0, 2, 3); for (let i = 0; i < 12; i++) P(c, '#c9d1d6', 2 + i, 11 - i * 0.6 | 0, 2, 1); P(c, '#2e3438', 13, 3, 2, 2); },
    spring: (c) => { for (let i = 0; i < 6; i++) { P(c, '#c9d1d6', 4, 3 + i * 2, 8, 1); P(c, '#7d868c', 5, 4 + i * 2, 7, 1); } P(c, '#9aa3ab', 3, 3, 1, 12); },
    wood: (c) => { P(c, '#7a5532', 2, 5, 12, 7); P(c, '#9c7048', 2, 5, 12, 2); P(c, '#5a3d22', 4, 8, 6, 1); P(c, '#5a3d22', 8, 10, 5, 1); P(c, '#c9a06a', 13, 5, 1, 7); },
    tape: (c) => { P(c, '#8b9399', 4, 3, 8, 10); P(c, '#b9c2c7', 5, 3, 6, 10); P(c, '#3a3f45', 6, 6, 4, 4); P(c, '#b9c2c7', 11, 10, 4, 2); },
    barrel: (c) => { P(c, '#2b2f33', 1, 6, 14, 4); P(c, '#5d646b', 1, 6, 14, 1); P(c, '#11161a', 14, 7, 1, 2); P(c, '#3a3f45', 1, 5, 3, 6); },
    trigger: (c) => { P(c, '#3a3f45', 3, 4, 10, 4); P(c, '#5d646b', 3, 4, 10, 1); P(c, '#2b2f33', 6, 8, 1, 5); P(c, '#2b2f33', 6, 12, 5, 1); P(c, '#2b2f33', 10, 8, 1, 4); P(c, '#9aa3ab', 8, 8, 1, 3); },
    frame: (c) => { P(c, '#2b2f33', 2, 4, 12, 4); P(c, '#4a5058', 2, 4, 12, 1); P(c, '#2b2f33', 9, 8, 4, 6); P(c, '#4a3a2c', 10, 9, 3, 5); P(c, '#11161a', 5, 8, 3, 3); },
    bolt: (c) => { P(c, '#5d646b', 2, 6, 12, 4); P(c, '#9aa3ab', 2, 6, 12, 1); P(c, '#2b2f33', 5, 8, 2, 2); P(c, '#2b2f33', 10, 8, 2, 2); P(c, '#c9d1d6', 12, 4, 2, 2); },
    lens: (c) => { P(c, '#2b2f33', 3, 3, 10, 10); P(c, '#4f9dd6', 4, 4, 8, 8); P(c, '#9fd6ff', 5, 5, 3, 3); P(c, '#1d4f7a', 9, 9, 2, 2); },
    leaf: (c) => { const L = [[8, 2], [8, 4], [8, 6], [6, 5], [10, 5], [4, 7], [12, 7], [6, 9], [10, 9], [3, 10], [13, 10]]; for (const [x, y] of L) P(c, '#3fae4a', x, y, 2, 2); P(c, '#58c95e', 7, 3, 2, 8); P(c, '#2e7d34', 8, 11, 1, 4); },
    snow: (c) => { P(c, '#c9c9c0', 2, 5, 12, 8); P(c, '#f4f4f0', 2, 4, 12, 7); P(c, '#d8d8cf', 2, 9, 12, 1); P(c, '#c0473f', 7, 4, 2, 7); P(c, '#ffffff', 3, 5, 3, 1); },
    chem: (c) => { P(c, '#2d6fb5', 4, 3, 8, 11); P(c, '#55a0e8', 5, 4, 2, 9); P(c, '#1d4f7a', 4, 13, 8, 1); P(c, '#e0b021', 5, 7, 6, 3); P(c, '#111', 7, 8, 2, 1); P(c, '#3a3f45', 6, 1, 4, 2); },
    baggie: (c) => { P(c, '#dfe8ee', 4, 4, 8, 9); P(c, '#ffffff', 5, 5, 2, 6); P(c, '#c0473f', 4, 4, 8, 1); P(c, '#b9c4cc', 4, 12, 8, 1); },
    pills: (c) => { P(c, '#ff7fd0', 3, 6, 4, 4); P(c, '#ffd0ec', 3, 6, 2, 1); P(c, '#7fd0ff', 9, 4, 4, 4); P(c, '#d0f0ff', 9, 4, 2, 1); P(c, '#ffd970', 7, 10, 4, 4); P(c, '#fff3c0', 7, 10, 2, 1); },
  };
  function matIcon(id, size = 22) { const f = MAT[id]; if (!f) return null; return pixCanvas('m-' + id, 16, 16, Math.max(2, Math.round(size / 8)), f); }

  // Side-view guns on a 36×14 pixel grid. Shared palette; each gun is a few strokes.
  const K = { st: '#1d2328', sl: '#2e363d', hi: '#7f8a90', ch: '#c9d1d6', wd: '#7a5532', wl: '#9c7048', tp: '#8b9399', bk: '#0f1316', rd: '#c0473f' };
  const GUN = {
    pipe: (c) => { P(c, K.tp, 10, 5, 18, 3); P(c, K.ch, 10, 5, 18, 1); P(c, K.bk, 27, 5, 1, 3); P(c, K.tp, 8, 4, 4, 5); P(c, '#b9c2c7', 12, 4, 3, 5); P(c, '#2a2a2a', 8, 8, 4, 5); P(c, '#b9c2c7', 9, 9, 3, 1); P(c, '#b9c2c7', 9, 11, 3, 1); P(c, K.st, 13, 8, 1, 2); },
    zip: (c) => { P(c, K.tp, 9, 5, 19, 3); P(c, K.ch, 9, 5, 19, 1); P(c, K.wd, 5, 5, 6, 4); P(c, K.wd, 6, 8, 5, 5); P(c, '#b9c2c7', 6, 9, 5, 1); P(c, '#b9c2c7', 6, 11, 5, 1); P(c, K.sl, 15, 8, 3, 3); P(c, K.st, 12, 8, 1, 2); },
    sawnoff: (c) => { P(c, K.sl, 12, 4, 16, 2); P(c, K.sl, 12, 6, 16, 2); P(c, K.hi, 12, 4, 16, 1); P(c, K.bk, 27, 4, 1, 4); P(c, K.wd, 3, 5, 10, 4); P(c, K.wl, 3, 5, 10, 1); P(c, K.wd, 3, 8, 5, 4); P(c, K.st, 11, 8, 1, 2); },
    pistol: (c) => { P(c, K.st, 10, 4, 16, 4); P(c, K.hi, 10, 4, 16, 1); P(c, K.sl, 11, 6, 15, 1); P(c, K.st, 10, 8, 5, 6); P(c, '#2c2420', 11, 9, 3, 5); P(c, K.st, 15, 8, 3, 1); P(c, K.st, 17, 8, 1, 2); },
    compact: (c) => { P(c, K.st, 11, 5, 13, 3); P(c, K.hi, 11, 5, 13, 1); P(c, K.st, 11, 8, 4, 6); P(c, '#3a3f45', 12, 9, 2, 5); P(c, K.bk, 12, 13, 3, 1); P(c, K.st, 15, 8, 2, 1); },
    revolver: (c) => { P(c, K.sl, 15, 4, 13, 3); P(c, K.ch, 15, 4, 13, 1); P(c, K.st, 11, 4, 5, 6); P(c, '#4a5058', 12, 5, 4, 4); P(c, K.hi, 12, 5, 4, 1); P(c, K.wd, 9, 9, 4, 5); P(c, K.wl, 9, 9, 1, 5); P(c, K.st, 14, 10, 2, 1); },
    pump: (c) => { P(c, K.sl, 12, 4, 21, 2); P(c, K.hi, 12, 4, 21, 1); P(c, K.st, 14, 6, 17, 1); P(c, K.wd, 19, 6, 8, 3); P(c, K.wl, 19, 6, 8, 1); P(c, K.st, 9, 4, 4, 4); P(c, K.wd, 1, 5, 9, 4); P(c, K.wd, 1, 8, 4, 3); P(c, K.st, 11, 8, 1, 2); },
    machine: (c) => { P(c, K.st, 10, 4, 15, 4); P(c, K.hi, 10, 4, 15, 1); P(c, K.st, 10, 8, 4, 4); P(c, K.bk, 11, 12, 3, 2); P(c, K.st, 16, 8, 3, 6); P(c, K.hi, 16, 8, 1, 6); P(c, K.st, 24, 5, 3, 2); },
    smg: (c) => { P(c, K.st, 9, 4, 18, 5); P(c, K.hi, 9, 4, 18, 1); P(c, K.sl, 26, 5, 4, 2); P(c, K.st, 17, 9, 3, 5); P(c, K.hi, 17, 9, 1, 5); P(c, K.st, 11, 9, 3, 4); P(c, K.st, 2, 5, 8, 1); P(c, K.st, 2, 5, 1, 4); P(c, K.st, 2, 8, 8, 1); },
    hawk: (c) => { P(c, '#9aa3ab', 9, 3, 19, 5); P(c, K.ch, 9, 3, 19, 1); P(c, '#6e7b85', 9, 6, 19, 1); P(c, K.bk, 26, 4, 2, 2); P(c, '#5d646b', 9, 8, 5, 6); P(c, '#2c2420', 10, 9, 3, 5); P(c, '#6e7b85', 14, 8, 3, 1); },
    hunting: (c) => { P(c, K.sl, 13, 5, 22, 2); P(c, K.hi, 13, 5, 22, 1); P(c, K.wd, 1, 5, 20, 3); P(c, K.wl, 1, 5, 20, 1); P(c, K.wd, 1, 7, 7, 4); P(c, K.st, 12, 4, 6, 2); P(c, K.ch, 14, 3, 1, 2); P(c, K.st, 13, 8, 1, 2); },
    shotgun: (c) => { P(c, K.st, 11, 4, 22, 2); P(c, K.hi, 11, 4, 22, 1); P(c, K.sl, 13, 6, 18, 2); P(c, K.st, 7, 4, 7, 5); P(c, K.st, 1, 5, 7, 3); P(c, K.st, 1, 7, 3, 4); P(c, K.st, 10, 9, 2, 3); P(c, K.st, 14, 9, 3, 2); },
    carbine: (c) => { P(c, K.st, 9, 4, 17, 4); P(c, K.hi, 9, 4, 17, 1); P(c, K.sl, 25, 5, 7, 2); P(c, K.st, 16, 8, 3, 5); P(c, K.hi, 16, 8, 1, 5); P(c, K.st, 11, 8, 3, 4); P(c, K.st, 2, 4, 8, 3); P(c, K.st, 2, 7, 3, 3); P(c, K.st, 12, 2, 6, 2); },
    rifle: (c) => { P(c, K.sl, 12, 5, 23, 2); P(c, K.hi, 12, 5, 23, 1); P(c, K.st, 6, 4, 9, 5); P(c, K.st, 1, 5, 6, 3); P(c, K.st, 1, 7, 3, 4); P(c, K.st, 14, 8, 3, 4); P(c, K.bk, 10, 1, 12, 3); P(c, '#4f9dd6', 21, 1, 1, 3); P(c, K.hi, 10, 1, 12, 1); P(c, K.st, 11, 8, 2, 3); },
    ar: (c) => { P(c, K.st, 9, 4, 18, 4); P(c, K.hi, 9, 4, 18, 1); P(c, '#3a4148', 18, 4, 9, 4); for (let i = 19; i < 27; i += 2) P(c, K.bk, i, 5, 1, 2); P(c, K.sl, 27, 5, 7, 2); P(c, K.st, 15, 8, 3, 6); P(c, K.hi, 15, 8, 1, 6); P(c, K.st, 11, 8, 3, 4); P(c, K.st, 1, 4, 9, 3); P(c, K.st, 1, 7, 3, 3); P(c, K.st, 12, 2, 5, 2); P(c, K.rd, 13, 2, 1, 1); },
  };
  function gunIcon(id, w = 72, h = 28) { const f = GUN[id]; if (!f) return null; const scale = Math.max(2, Math.round(w / 18)); const cv = pixCanvas('g-' + id, 36, 14, scale, f); cv.style.width = w + 'px'; cv.style.height = Math.round(w * 14 / 36) + 'px'; return cv; }

  root.NightshiftSupplyArt = Object.freeze({ drawSite, signLift, drawBench, matIcon, gunIcon, GUN_SHAPES: Object.keys(GUN) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
