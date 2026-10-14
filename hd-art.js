/* High-detail art pass v0.62 (Claude-owned). With the game now rendering at the phone's full 3x density and the
 * ground baked at 2x, this layer adds the fine detail the old 1-world-pixel art couldn't show:
 *  - Ground (baked into tiles via city-art roads → NightshiftHD.ground): fine asphalt grain, aggregate speckle,
 *    paver joints and kerb stones on the sidewalks, sharper lane-paint edges with wear.
 *  - Buildings (live, per visible building): facade material texture (brick courses / siding / concrete board-marks
 *    by district), roof membrane seams and gravel, parapet highlight + drip shadow, drainpipes with brackets, window
 *    mullions, sills, glass reflections and (at night) curtains/room light gradients.
 *  - Cars (live, per visible car): glass reflections, specular streaks along the body, panel seams, door handles,
 *    mirrors, tyre tread and rim highlights, a soft ambient-occlusion shadow.
 * All sub-pixel (0.25–0.5 world px), so on a 3x screen it reads as fine detail instead of blocks.
 * API: NightshiftHD.{ground, stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const st = { buildings: 0, cars: 0, ground: 0 };
  const H = (a, b, k = 0) => { let h = (a * 73856093) ^ (b * 19349663) ^ (k * 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const region = (x, y) => { try { return root.NightshiftWorld?.regionAt?.(x, y)?.name || null; } catch { return null; } };
  const styleAt = (x, y) => { try { return root.NightshiftWorld?.districtStyle?.(x, y) || 'midtown'; } catch { return 'midtown'; } };

  // ---------- texture tiles (drawn once, used as patterns at sub-pixel scale) ----------
  function tile(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); fn(x, w, h); return c; }
  let rnd = 1; const R = () => { rnd = (rnd * 1664525 + 1013904223) >>> 0; return rnd / 4294967296; };
  const TEX = {
    asphalt: tile(128, 128, (c, w, h) => { for (let i = 0; i < 2600; i++) { const v = R(); c.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.08 + R() * 0.12})` : `rgba(255,255,255,${0.03 + R() * 0.06})`; c.fillRect(R() * w, R() * h, v < 0.9 ? 1 : 2, v < 0.9 ? 1 : 2); } for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(180,170,150,${0.06 + R() * 0.06})`; c.beginPath(); c.arc(R() * w, R() * h, 1 + R() * 1.5, 0, Math.PI * 2); c.fill(); } }),
    pavers: tile(64, 64, (c) => { c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 1; for (let y = 0; y <= 64; y += 16) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(64, y + 0.5); c.stroke(); for (let x = (y / 16) % 2 ? 16 : 0; x <= 64; x += 32) { c.beginPath(); c.moveTo(x + 0.5, y); c.lineTo(x + 0.5, y + 16); c.stroke(); } } c.fillStyle = 'rgba(255,255,255,0.06)'; for (let y = 1; y < 64; y += 16) c.fillRect(0, y, 64, 1); for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(0,0,0,${R() * 0.12})`; c.fillRect(R() * 64, R() * 64, 1, 1); } }),
    brick: tile(64, 32, (c) => { c.fillStyle = 'rgba(0,0,0,0.30)'; for (let y = 0; y < 32; y += 8) { c.fillRect(0, y, 64, 1); for (let x = (y / 8) % 2 ? 8 : 0; x < 64; x += 16) c.fillRect(x, y, 1, 8); } c.fillStyle = 'rgba(255,255,255,0.07)'; for (let y = 1; y < 32; y += 8) c.fillRect(0, y, 64, 1); for (let i = 0; i < 90; i++) { c.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,220,190,0.08)'; c.fillRect(Math.floor(R() * 4) * 16 + ((R() < 0.5) ? 8 : 0), Math.floor(R() * 4) * 8 + 1, 15, 7); } }),
    siding: tile(32, 24, (c) => { for (let y = 0; y < 24; y += 6) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, y + 5, 32, 1); c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(0, y, 32, 1); } }),
    concrete: tile(96, 48, (c) => { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 0, 96, 1); c.fillRect(0, 0, 1, 48); for (const [x, y] of [[24, 12], [72, 12], [24, 36], [72, 36]]) { c.beginPath(); c.arc(x, y, 1.5, 0, Math.PI * 2); c.fill(); } for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * 0.07})`; c.fillRect(R() * 96, R() * 48, 1, 1); } }),
    membrane: tile(96, 96, (c) => { for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + R() * 0.07})`; c.fillRect(R() * 96, R() * 96, R() < 0.8 ? 1 : 2, 1); } c.fillStyle = 'rgba(0,0,0,0.20)'; for (let x = 0; x < 96; x += 32) c.fillRect(x, 0, 1, 96); c.fillStyle = 'rgba(255,255,255,0.07)'; for (let x = 1; x < 96; x += 32) c.fillRect(x, 0, 1, 96); }),
  };
  const pats = new Map();
  function pattern(ctx, name, scale) {
    const k = name + '@' + scale; let p = pats.get(k);
    if (!p || p.__ctx !== ctx) { p = ctx.createPattern(TEX[name], 'repeat'); try { p.setTransform(new DOMMatrix().scale(scale)); } catch { /* old browsers: unscaled */ } p.__ctx = ctx; pats.set(k, p); }
    return p;
  }
  function fillPat(ctx, name, scale, x, y, w, h, alpha = 1, op) { ctx.save(); ctx.globalAlpha = alpha; if (op) ctx.globalCompositeOperation = op; ctx.fillStyle = pattern(ctx, name, scale); ctx.translate(x, y); ctx.fillRect(0, 0, w, h); ctx.restore(); }

  // ---------- ground (called from city-art roads, baked at 2x) ----------
  function ground(c, width, height, view) {
    for (let x = 0; x < width; x += 440) for (let y = 0; y < height; y += 340) {
      if (view && (x + 500 < view.x || x - 60 > view.x + view.w || y + 400 < view.y || y - 60 > view.y + view.h)) continue;
      // asphalt grain on the road bands of this block (vertical arm + horizontal arm + junction)
      fillPat(c, 'asphalt', 0.5, x - 63, y - 62, 126, 124, 0.9);
      if (x + 440 <= width) fillPat(c, 'asphalt', 0.5, x + 63, y - 62, 314, 124, 0.9);
      if (y + 340 <= height) fillPat(c, 'asphalt', 0.5, x - 63, y + 62, 126, 216, 0.9);
      // pavers on the four sidewalk strips around the block + kerb stones
      if (x + 440 <= width && y + 340 <= height) {
        for (const [sx, sy, sw, sh] of [[x + 66, y + 66, 308, 17], [x + 66, y + 257, 308, 18], [x + 66, y + 66, 19, 209], [x + 355, y + 66, 19, 209]]) fillPat(c, 'pavers', 0.5, sx, sy, sw, sh, 0.65);
        c.save(); c.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = x + 70; k < x + 372; k += 9) { c.fillRect(k, y + 63.5, 0.5, 2.5); c.fillRect(k, y + 274.5, 0.5, 2.5); } for (let k = y + 70; k < y + 272; k += 9) { c.fillRect(x + 63.5, k, 2.5, 0.5); c.fillRect(x + 374.5, k, 2.5, 0.5); } c.restore();
      }
      st.ground++;
    }
  }

  // ---------- buildings ----------
  function building(b) {
    if (root.NightshiftModern?.on) return; // v0.63: modern-city.js draws its own facades
    let c = null; try { c = g; } catch { return; } // eslint-disable-line no-undef
    const { x, y, w, h, name } = b, front = y + h - 62, reg = region(x, y), sty = styleAt(x, y), s = H(Math.round(x), Math.round(y), 3);
    let night = 0; try { night = root.NightshiftEnvironment?.darkness?.(root.NightshiftEnvironment.state?.minute ?? 720) || 0; } catch { /* n/a */ }
    const industrial = name === 'WAREHOUSE' || name === 'GARAGE', residential = name === 'APARTMENTS';
    // facade material
    const mat = industrial ? 'concrete' : reg === 'DOWNTOWN' ? 'concrete' : reg === 'THE HEIGHTS' || reg === 'FAIRVIEW' ? 'siding' : sty === 'south' || reg === 'OLD TOWN' || reg === 'THE FLATS' ? 'brick' : residential ? 'brick' : 'concrete';
    fillPat(c, mat, mat === 'siding' ? 0.5 : 0.35, x, front, w, h - (front - y), 0.55, 'multiply');
    fillPat(c, mat, mat === 'siding' ? 0.5 : 0.35, x, front, w, h - (front - y), 0.25);
    // roof membrane + gravel
    fillPat(c, 'membrane', 0.5, x + 5, y + 5, w - 10, front - y - 12, 0.6);
    // parapet: fine highlight + inner shadow, drip stains under the cornice
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x, y, w, 0.5); c.fillRect(x, y, 0.5, front - y);
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(x + 4, y + 5, w - 8, 0.75); c.fillRect(x + 4.5, y + 5, 0.75, front - y - 12);
    for (let k = 0; k < 6; k++) { const dx = x + 8 + H(x, y, 20 + k) * (w - 16), len = 6 + H(x, y, 30 + k) * 14, gr = c.createLinearGradient(0, front, 0, front + len); gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(dx, front, 1.5, len); }
    // drainpipes on both facade corners
    for (const px of [x + 3, x + w - 5]) { c.fillStyle = 'rgba(40,46,54,0.9)'; c.fillRect(px, front - 4, 2, h - (front - y) + 2); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(px + 0.25, front - 4, 0.5, h - (front - y) + 2); for (let yy = front + 6; yy < y + h - 2; yy += 14) { c.fillStyle = 'rgba(20,24,30,0.9)'; c.fillRect(px - 0.5, yy, 3, 1); } }
    // windows: mullions, sills, reflections (match world.js window placement)
    const wins = residential ? [...Array(5)].map((_, k) => [x + 13 + k * 44, front + 8, 30, 17]).concat([[x + 14, y + h - 26, 36, 19], [x + w - 53, y + h - 26, 36, 19]]) : [[x + 13, y + h - 34, 62, 26], [x + w - 75, y + h - 34, 62, 26]];
    for (const [wx, wy, ww, wh] of wins) {
      // glass reflection: soft diagonal sheen + crisp glint lines
      const gr = c.createLinearGradient(wx, wy, wx + ww, wy + wh); gr.addColorStop(0, night > 0.3 ? 'rgba(255,220,150,0.10)' : 'rgba(255,255,255,0.18)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
      c.fillStyle = gr; c.fillRect(wx, wy, ww, wh);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(wx + ww * 0.15, wy + wh - 1); c.lineTo(wx + ww * 0.15 + wh * 0.6, wy + 1); c.moveTo(wx + ww * 0.24, wy + wh - 1); c.lineTo(wx + ww * 0.24 + wh * 0.35, wy + wh * 0.4); c.stroke();
      // mullions + frame + sill
      c.fillStyle = 'rgba(14,20,28,0.7)'; c.fillRect(wx + ww / 2 - 0.4, wy, 0.8, wh); if (wh > 18) c.fillRect(wx, wy + wh * 0.42, ww, 0.7); else c.fillRect(wx, wy + wh / 2, ww, 0.6);
      c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(wx - 1.5, wy + wh + 1.2, ww + 3, 0.8); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(wx - 1.5, wy + wh + 2, ww + 3, 1);
      // night: curtains/blinds and a lamp glow in some rooms
      if (night > 0.3) { const lit = H(wx, wy, 7) < 0.65; if (lit) { c.fillStyle = 'rgba(255,200,120,0.18)'; c.fillRect(wx, wy, ww, wh); c.fillStyle = 'rgba(80,40,30,0.35)'; c.fillRect(wx, wy, ww * 0.18, wh); c.fillRect(wx + ww * 0.82, wy, ww * 0.18, wh); } else { c.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 1; k < wh; k += 2) c.fillRect(wx, wy + k, ww, 0.5); } }
    }
    // shop fronts: tiled kick plate + door handle detail
    if (!residential && !industrial) { c.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = x + 6; k < x + w - 6; k += 6) c.fillRect(k, y + h - 6, 0.5, 5); c.fillStyle = 'rgba(255,240,200,0.6)'; c.fillRect(x + w / 2 + 9, y + h - 17, 1, 5); }
    if (industrial) { c.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 18; k++) c.fillRect(x + w / 2 - 36, y + h - 36 + k * 2, 72, 0.5); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x + w / 2 - 36, y + h - 36, 72, 0.5); }
    void s;
    c.restore(); st.buildings++;
  }

  // ---------- cars ----------
  function car(v) {
    let c = null; try { c = g; } catch { return; } // eslint-disable-line no-undef
    if (!v || !Number.isFinite(v.x)) return; let p = null; try { p = player; } catch { /* n/a */ } // eslint-disable-line no-undef
    if (p && (Math.abs(v.x - p.x) > 800 || Math.abs(v.y - p.y) > 520)) return;
    let spec = null; try { spec = root.NightshiftCarsData?.fromModel?.(v.model) || null; } catch { /* n/a */ }
    const L = (spec?.len || (v.model === 'VAN' ? 60 : v.model === 'COMPACT' ? 46 : 52)) / 2, Wd = (spec?.wid || (v.model === 'VAN' ? 30 : 26)) / 2;
    c.save(); c.translate(v.x, v.y); c.rotate(v.angle || 0);
    // specular streaks along the body (light from the top-left)
    const gr = c.createLinearGradient(0, -Wd, 0, Wd); gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.18)');
    c.fillStyle = gr; c.beginPath(); if (c.roundRect) c.roundRect(-L + 3, -Wd + 2, L * 2 - 6, Wd * 2 - 4, 5); else c.rect(-L + 3, -Wd + 2, L * 2 - 6, Wd * 2 - 4); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-L * 0.6, -Wd + 2.5); c.lineTo(L * 0.55, -Wd + 2.5); c.stroke();
    // panel seams + door handles + mirrors
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.5; for (const sx of [-L * 0.12, L * 0.22]) { c.beginPath(); c.moveTo(sx, -Wd + 1.5); c.lineTo(sx, -Wd + 5); c.moveTo(sx, Wd - 1.5); c.lineTo(sx, Wd - 5); c.stroke(); }
    c.fillStyle = 'rgba(220,226,232,0.8)'; c.fillRect(L * 0.02, -Wd + 1, 2.5, 0.75); c.fillRect(L * 0.02, Wd - 1.75, 2.5, 0.75);
    c.fillStyle = 'rgba(20,24,30,0.95)'; c.fillRect(L * 0.38, -Wd - 1.2, 2.5, 1.6); c.fillRect(L * 0.38, Wd - 0.4, 2.5, 1.6);
    // windscreen + rear glass reflections
    c.fillStyle = 'rgba(200,230,255,0.22)'; c.beginPath(); c.moveTo(L * 0.42, -Wd + 4); c.lineTo(L * 0.52, -Wd + 4); c.lineTo(L * 0.4, Wd - 4); c.lineTo(L * 0.3, Wd - 4); c.closePath(); c.fill();
    c.fillStyle = 'rgba(200,230,255,0.15)'; c.beginPath(); c.moveTo(-L * 0.62, -Wd + 4); c.lineTo(-L * 0.56, -Wd + 4); c.lineTo(-L * 0.64, Wd - 4); c.lineTo(-L * 0.7, Wd - 4); c.closePath(); c.fill();
    // tyre tread + rims peeking from the arches
    for (const tx of [-L * 0.62, L * 0.6]) for (const ty of [-Wd - 0.6, Wd + 0.6]) { c.fillStyle = 'rgba(12,14,18,0.95)'; c.fillRect(tx - 4, ty - 1, 8, 2); c.fillStyle = 'rgba(80,86,94,0.9)'; for (let k = -3; k < 4; k += 2) c.fillRect(tx + k, ty - 1, 0.5, 2); }
    c.restore(); st.cars++;
  }

  // ---------- interiors (interiors.js floors/walls, baked at 2x by zones.js) ----------
  TEX.wood = tile(128, 48, (c) => { for (let y = 0; y < 48; y += 12) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, y, 128, 1); for (let x = (y / 12) % 2 ? 64 : 20; x < 128; x += 90) c.fillRect(x, y, 1, 12); for (let k = 0; k < 6; k++) { c.strokeStyle = `rgba(${R() < 0.5 ? '40,20,10' : '255,230,200'},0.12)`; c.lineWidth = 0.5; c.beginPath(); const yy = y + 2 + R() * 8; c.moveTo(0, yy); c.bezierCurveTo(40, yy + R() * 3 - 1.5, 80, yy + R() * 3 - 1.5, 128, yy); c.stroke(); } c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, y + 1, 128, 1); } });
  TEX.grout = tile(40, 40, (c) => { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, 0, 40, 1); c.fillRect(0, 0, 1, 40); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(1, 1, 38, 0.5); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(0,0,0,${R() * 0.06})`; c.fillRect(R() * 40, R() * 40, 1, 1); } });
  TEX.carpet = tile(32, 32, (c) => { for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * 0.1})`; c.fillRect(R() * 32, R() * 32, 1, 1); } });
  TEX.wallpaper = tile(24, 60, (c) => { c.fillStyle = 'rgba(255,255,255,0.06)'; for (let x = 0; x < 24; x += 12) c.fillRect(x, 0, 1, 60); c.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 6; y < 60; y += 14) { c.beginPath(); c.arc(6, y, 2, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(18, y + 7, 2, 0, Math.PI * 2); c.fill(); } });
  function floor(c, kind, w, h) {
    const k = kind === 'wood' || kind === 'lobby' ? 'wood' : kind === 'tile' || kind === 'marble' ? 'grout' : kind === 'carpet' ? 'carpet' : kind === 'concrete' ? 'concrete' : 'carpet';
    fillPat(c, k, 0.5, 0, 0, w, h, 0.85);
    // light pooling from the back wall windows + a soft vignette into the corners
    const gr = c.createRadialGradient(w / 2, h * 0.35, 20, w / 2, h * 0.5, w * 0.7); gr.addColorStop(0, 'rgba(255,240,210,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }
  function wall(c, w) { fillPat(c, 'wallpaper', 0.5, 10, 8, w - 20, 44, 0.9); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, 57.5, w, 0.5); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(10, 62, w - 20, 3); }

  // ---------- hooks ----------
  const hook = setInterval(() => {
    const W = root.NightshiftWorld, S = root.NightshiftSprites;
    if (W && typeof W.building === 'function' && !W.__hd) { const b0 = W.building; W.building = function (b) { const r = b0.apply(this, arguments); try { if (b && (typeof camera === 'undefined' || !(b.x + b.w + 48 < camera.x || b.y + b.h + 48 < camera.y || b.x > camera.x + 1200 || b.y > camera.y + 700))) building(b); } catch { /* cosmetic */ } return r; }; W.__hd = true; } // eslint-disable-line no-undef
    if (S && typeof S.car === 'function' && !S.__hd) { const c0 = S.car; S.car = function (v) { const r = c0.apply(this, arguments); try { car(v); } catch { /* cosmetic */ } return r; }; S.__hd = true; }
    if (W?.__hd && S?.__hd) clearInterval(hook);
  }, 250);
  root.NightshiftHD = Object.freeze({ ground, floor, wall, stats: () => ({ ...st }) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
