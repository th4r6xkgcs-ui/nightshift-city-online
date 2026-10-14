/* Route 9 side view (Claude-owned, v0.67): draws the highway the way Nightshift Garage does, with the Garage art.
 * Assets (art/garage/, brought over from the Nightshift Garage repo with the owner's go-ahead):
 *   track.jpg (night harbour skyline, fence + barrier, wet asphalt), cars/<id>.png (side-view cars, facing right),
 *   wheels/*.png, police/charger.png + crown-victoria.png.
 *  - Background strip scrolls with parallax; the road is rebuilt from the track's wet asphalt so it can hold four
 *    lanes + a shoulder; lane dashes, rumble strip and lamp reflections scroll at road speed.
 *  - Cars: the six Garage cars at full quality, wheels spun from the car's own rim art (with motion blur at speed),
 *    traffic and other models re-painted from those six with a hue tint; police use the Garage cruisers with live
 *    light bars. Far lanes sit higher on screen and slightly smaller; everything is depth-sorted.
 *  - Headlight cones, tail-light glow, nitro flame, smoke, spikes, roadblocks, gantry exit signs, speed cameras,
 *    the helicopter + searchlight, rain.
 * highway.js keeps the simulation; this only draws. Falls back to highway.js's own top-down view until loaded.
 * API: NightshiftHighwaySide.{ready, draw, carImage} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const BASE = 'art/garage/';
  const CARS = ['m4', 'civic', 'charger', 's15', 'mustang', 'gallardo'];
  // wheel centres + radii in the source images (Nightshift Garage WHEEL_MAP, same files)
  const WHEELS = { m4: [[162, 166, 39], [641, 166, 39]], civic: [[137, 181, 36], [566, 181, 36]], charger: [[171, 159, 39], [640, 159, 39]], s15: [[165, 164, 39], [624, 164, 39]], mustang: [[163, 161, 39], [632, 161, 39]], gallardo: [[153, 141, 39], [612, 141, 39]] };
  const NATIVE = { m4: '#4790e8', civic: '#d2d8c6', charger: '#f79148', s15: '#2f9e6a', mustang: '#9a5ad0', gallardo: '#e8402a' }; // paint in the art
  const img = (src) => { const i = new Image(); i.decoding = 'async'; i.src = BASE + src; return i; };
  const IM = { track: img('track.jpg'), cars: Object.fromEntries(CARS.map((id) => [id, img('cars/' + id + '.png')])), police: { charger: img('police/charger.png'), crown: img('police/crown-victoria.png') } };
  const ok = (i) => i && i.complete && i.naturalWidth > 0;
  const ready = () => ok(IM.track) && CARS.every((id) => ok(IM.cars[id])) && ok(IM.police.charger);
  // which Garage image stands in for a city model
  function carImage(model) {
    const spec = root.NightshiftCarsData?.fromModel?.(model); if (spec && IM.cars[spec.id]) return spec.id;
    const body = spec?.body || (model === 'VAN' ? 'van' : model === 'COMPACT' ? 'compact' : 'sedan');
    return { hatch: 'civic', compact: 'civic', sedan: 'm4', van: 'charger', pickup: 'charger', suv: 'charger', muscle: 'charger', classic: 'charger', lowrider: 'charger', gt: 'm4', coupe: 's15', rally: 's15', super: 'gallardo', hyper: 'gallardo' }[body] || 'm4';
  }
  // ---------- tinted copies (hue blend keeps tyres, glass and chrome neutral) ----------
  const tints = new Map();
  function tinted(id, color) {
    const base = IM.cars[id]; if (!ok(base)) return null;
    if (!color || color.toLowerCase() === NATIVE[id]) return base;
    const k = id + color; let cv = tints.get(k); if (cv) return cv;
    if (tints.size > 40) tints.delete(tints.keys().next().value);
    cv = document.createElement('canvas'); cv.width = base.naturalWidth; cv.height = base.naturalHeight; const c = cv.getContext('2d');
    c.drawImage(base, 0, 0); c.globalCompositeOperation = 'hue'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height);
    // very dark or very light paints: shift luminosity a little toward the paint
    const L = lum(color); if (L < 0.2 || L > 0.8) { c.globalCompositeOperation = L < 0.2 ? 'multiply' : 'screen'; c.globalAlpha = 0.45; c.fillStyle = L < 0.2 ? '#3a3f48' : '#d8dde2'; c.fillRect(0, 0, cv.width, cv.height); c.globalAlpha = 1; }
    c.globalCompositeOperation = 'destination-in'; c.drawImage(base, 0, 0);
    tints.set(k, cv); return cv;
  }
  function lum(h) { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; }
  // ---------- one car ----------
  function drawCar(c, id, color, x, ground, width, spin, speed, opts = {}) {
    const src = opts.police ? IM.police[opts.police] : tinted(id, color); if (!ok(src) && !(src instanceof HTMLCanvasElement)) return;
    const W0 = src.naturalWidth || src.width, H0 = src.naturalHeight || src.height, s = width / W0, h = H0 * s, y = ground - h;
    // soft contact shadow
    c.save(); c.globalAlpha = 0.55; c.fillStyle = '#000'; c.beginPath(); c.ellipse(x + width / 2, ground - 2, width * 0.5, Math.max(3, h * 0.07), 0, 0, Math.PI * 2); c.fill(); c.restore();
    c.save(); c.translate(x, y + (opts.bob || 0)); c.scale(s, s);
    const wheels = !opts.police && WHEELS[id];
    if (wheels) {
      c.save(); c.beginPath(); c.rect(0, -10, W0, H0 + 20); for (const [cx, cy, r] of wheels) { c.moveTo(cx + r + 1, cy); c.arc(cx, cy, r + 1, 0, Math.PI * 2); } c.clip('evenodd'); c.drawImage(src, 0, 0); c.restore();
      const blur = Math.min(4, Math.floor(speed / 260)), a0 = spin / 39;
      for (const [cx, cy, r] of wheels) {
        c.save(); c.translate(cx, cy); c.beginPath(); c.arc(0, 0, r + 1, 0, Math.PI * 2); c.clip();
        for (let k = 0; k <= blur; k++) { c.save(); c.globalAlpha = k ? 0.35 : 1; c.rotate(a0 - k * 0.18); c.drawImage(src, cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2, -r - 1, -r - 1, r * 2 + 2, r * 2 + 2); c.restore(); }
        c.restore();
      }
    } else c.drawImage(src, 0, 0);
    if (opts.police) { const on = Math.floor(performance.now() / 130) % 2, lx = W0 * 0.44, ly = H0 * 0.04; c.save(); c.globalCompositeOperation = 'lighter'; for (const [dx, col] of [[-28, on ? '#ff2a3a' : '#2a6aff'], [28, on ? '#2a6aff' : '#ff2a3a']]) { const gr = c.createRadialGradient(lx + dx, ly, 0, lx + dx, ly, 120); gr.addColorStop(0, col + 'cc'); gr.addColorStop(1, col + '00'); c.fillStyle = gr; c.fillRect(lx + dx - 120, ly - 120, 240, 240); } c.restore(); }
    c.restore();
    return { x, y, w: width, h };
  }
  // ---------- background + road ----------
  // wet asphalt: dark base, fine pixel grain (scrolling pattern), a little sheen toward the far side
  let grain = null;
  function road(c, top, bottom, Wd, off) {
    if (!grain) { grain = document.createElement('canvas'); grain.width = 256; grain.height = 96; const g2 = grain.getContext('2d'), id = g2.createImageData(256, 96); let r = 12345; for (let i = 0; i < id.data.length; i += 4) { r = (r * 1103515245 + 12345) >>> 0; const v = (r >>> 24) / 255, b = v < 0.06 ? 46 : v < 0.25 ? 30 : v > 0.97 ? 58 : 22; id.data[i] = b; id.data[i + 1] = b + 2; id.data[i + 2] = b + 8; id.data[i + 3] = v < 0.5 ? 70 : 40; } g2.putImageData(id, 0, 0); grain.pat = c.createPattern(grain, 'repeat'); }
    const gr = c.createLinearGradient(0, top, 0, bottom); gr.addColorStop(0, '#191c25'); gr.addColorStop(0.5, '#12141b'); gr.addColorStop(1, '#0d0f14'); c.fillStyle = gr; c.fillRect(0, top, Wd, bottom - top);
    c.save(); c.translate(-((off % 256) + 256) % 256, 0); c.fillStyle = grain.pat; c.fillRect(0, top, Wd + 256, bottom - top); c.restore();
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, top, Wd, 6);
  }
  function backdrop(c, Wd, skyH, off) {
    const t = IM.track, srcH = 550, s = skyH / srcH, tw = t.naturalWidth * s, start = -((off % tw) + tw) % tw;
    for (let x = start; x < Wd; x += tw) c.drawImage(t, 0, 0, t.naturalWidth, srcH, x, 0, tw + 1, skyH);
  }

  // ---------- frame ----------
  // ctx: { A, H, rel, z, now, night, rain, px0, lightbar, pops }
  function draw(c, Wd, Hd, k) {
    const { A, H, rel, now } = k, V = A.vehicle, n = k.night, kx = 1.55;
    const skyH = Math.round(Hd * 0.44), roadTop = skyH, roadBot = Hd - 4, roadH = roadBot - roadTop;
    const yOf = (wy) => roadTop + 10 + (wy / (H.SHOULDER[1] + 4)) * (roadH - 22); // world lateral -> screen y (car ground line)
    const sOf = (wy) => 0.84 + 0.2 * (wy / H.SHOULDER[1]);                       // depth scale
    const px0 = Math.round(Wd * 0.24), shake = A.shake || 0;
    const X = (d) => px0 + rel(d, A.d) * kx + (Math.random() - 0.5) * shake;
    const camOff = A.d * kx;
    c.save();
    c.fillStyle = '#060a14'; c.fillRect(0, 0, Wd, Hd);
    backdrop(c, Wd, skyH, camOff * 0.55);
    if (n < 0.6) { c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = `rgba(120,160,210,${0.35 * (1 - n / 0.6)})`; c.fillRect(0, 0, Wd, skyH); c.restore(); }
    road(c, roadTop, roadBot, Wd, camOff);
    // markings: top edge, lane dashes, shoulder line, rumble strip
    const lineY = (wy) => yOf(wy) - 2;
    c.fillStyle = 'rgba(232,228,220,0.82)'; c.fillRect(0, yOf(0) - 8, Wd, 2);
    const dash = 150 * kx, dl = 64 * kx, d0 = -((camOff % dash) + dash) % dash;
    for (let lane = 1; lane < H.LANES; lane++) { const y = lineY(lane * H.LANE) - 4; for (let x = d0; x < Wd; x += dash) c.fillRect(x, y, dl, 2); }
    c.fillRect(0, lineY(H.BOTTOM) - 4, Wd, 2.5);
    c.fillStyle = 'rgba(232,228,220,0.35)'; const rs = 22 * kx, r0 = -((camOff % rs) + rs) % rs; for (let x = r0; x < Wd; x += rs) c.fillRect(x, lineY(H.BOTTOM) + 1, 8 * kx * 0.5, 4);
    // lamp reflections on wet road (night / rain)
    if (n > 0.2 || k.rain > 0) { c.save(); c.globalCompositeOperation = 'lighter'; const sp = 520 * 0.55 * kx, o = -(((camOff * 0.55) % sp) + sp) % sp; for (let x = o; x < Wd + sp; x += sp) { const gr = c.createLinearGradient(0, roadTop, 0, roadBot); gr.addColorStop(0, `rgba(255,190,110,${0.22 * Math.max(n, k.rain)})`); gr.addColorStop(1, 'rgba(255,190,110,0)'); c.fillStyle = gr; c.fillRect(x - 10, roadTop, 20, roadH); } c.restore(); }
    // exit ramps / rest stop: chevrons + sign on the shoulder; gantries over the road
    for (let i = 0; i < H.EXITS.length; i++) { const xx = X(H.exitAt(i)); if (xx > -900 && xx < Wd + 300) { c.fillStyle = 'rgba(124,255,181,0.8)'; for (let q = 0; q < 6; q++) { const ax = X(H.exitAt(i) - 640 + q * 110), ay = lineY(H.SHOULDER[0] + 14); c.beginPath(); c.moveTo(ax, ay - 6); c.lineTo(ax + 14, ay); c.lineTo(ax, ay + 6); c.closePath(); c.fill(); } sign(c, xx - 30, Hd - 6, `EXIT ${i + 1} · ${H.EXITS[i].name.toUpperCase()}`, '#1f6b3f', true); }
      for (const [off, lab] of [[2400, '2 km'], [1000, '1 km']]) { const gx = X(H.exitAt(i) - off); if (gx > -300 && gx < Wd + 300) gantry(c, gx, roadTop, skyH, `EXIT ${i + 1}  ${H.EXITS[i].name.toUpperCase()}  ${lab}`, '#1f6b3f'); } }
    { const rx = X(H.REST.at); if (rx > -900 && rx < Wd + 300) sign(c, rx - 30, Hd - 6, 'SERVICES · FUEL · TUNING · MEET', '#2f5a8a', true); const gx = X(H.REST.at - 1400); if (gx > -300 && gx < Wd + 300) gantry(c, gx, roadTop, skyH, 'ROUTE 9 SERVICES  1 km', '#2f5a8a'); }
    for (const cd of H.CAMERAS) { const xx = X(cd); if (xx < -40 || xx > Wd + 40) continue; c.fillStyle = '#4a5260'; c.fillRect(xx, roadTop - 54, 4, 56); c.fillStyle = '#e2c24a'; c.fillRect(xx - 10, roadTop - 62, 22, 14); c.fillStyle = '#111'; c.fillRect(xx - 6, roadTop - 58, 8, 6); }
    // spikes
    for (const s of A.spikes) { const xx = X(s.d); if (xx < -60 || xx > Wd + 60) continue; c.fillStyle = '#b8c0c8'; for (let y = s.y0; y < s.y1; y += 7) { const yy = lineY(y); c.fillRect(xx - 5, yy, 10, 2); } if (Math.sin(now / 90) > 0) { c.save(); c.globalCompositeOperation = 'lighter'; for (const yy of [lineY(s.y0) - 6, lineY(s.y1) + 4]) { const gr = c.createRadialGradient(xx, yy, 0, xx, yy, 26); gr.addColorStop(0, 'rgba(255,90,40,0.9)'); gr.addColorStop(1, 'rgba(255,90,40,0)'); c.fillStyle = gr; c.fillRect(xx - 26, yy - 26, 52, 52); } c.restore(); } }
    // everything with a lane position, far to near
    const list = [];
    for (const t of A.traffic) list.push({ y: t.y, d: t.d, id: carImage(t.model), color: t.color, v: t.v, truck: t.truck, sig: t.change ? Math.sign(H.laneY(t.change.to) - t.y) : 0 });
    if (A.racer) list.push({ y: A.racer.y, d: A.racer.d, id: A.racer.sid in IM.cars ? A.racer.sid : carImage('CX:' + A.racer.sid), color: A.racer.color, v: A.racer.v, name: A.racer.name });
    for (const p of A.cops) list.push({ y: p.y, d: p.d, police: 'charger', v: p.v });
    for (const b of A.blocks) for (const q of b.cars) list.push({ y: q.y, d: q.d, police: 'crown', v: 0 });
    for (const o of k.others || []) list.push({ y: o.y, d: o.x, id: carImage(o.car), color: o.color, v: 400, name: o.name });
    list.push({ me: true, y: A.y, d: A.d, id: carImage(A.car.model), color: A.car.color, v: V.v });
    list.sort((a, b) => a.y - b.y);
    const W = (y, truck) => 170 * sOf(y) * (truck ? 1.3 : 1);
    for (const o of list) {
      const w = W(o.y, o.truck), x = (o.me ? px0 + (Math.random() - 0.5) * shake : X(o.d)) - w / 2, g = yOf(o.y);
      if (x > Wd + 40 || x + w < -40) continue;
      const bob = o.me && V.v > 50 ? Math.sin(now / 45) * 0.4 : 0;
      drawCar(c, o.id, o.color, x, g, w, (o.me ? A.d : o.d) * 7.27, o.v * 7.27 / 39 * 0.016 * 39, { police: o.police, bob });
      // lights
      if (n > 0.15 || k.rain > 0) { c.save(); c.globalCompositeOperation = 'lighter'; const hy = g - w * 0.13; const gr = c.createLinearGradient(x + w, hy, x + w + 200, hy); gr.addColorStop(0, `rgba(255,240,205,${0.24 * Math.max(n, 0.4)})`); gr.addColorStop(1, 'rgba(255,240,205,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(x + w - 4, hy - 2); c.lineTo(x + w + 170, hy - 6); c.lineTo(x + w + 170, hy + 18); c.lineTo(x + w - 4, hy + 5); c.closePath(); c.fill(); const tg = c.createRadialGradient(x + 4, hy, 0, x + 4, hy, 22); tg.addColorStop(0, `rgba(255,30,50,${0.55 * Math.max(n, 0.4)})`); tg.addColorStop(1, 'rgba(255,30,50,0)'); c.fillStyle = tg; c.fillRect(x - 18, hy - 22, 44, 44); c.restore(); }
      if (o.sig && Math.sin(now / 120) > 0) { c.fillStyle = '#ffb33a'; c.fillRect(x + w - 8, g - w * 0.12, 5, 3); c.fillRect(x + 2, g - w * 0.12, 5, 3); }
      if (o.name) { c.save(); c.font = '800 10px ui-monospace,Menlo,monospace'; c.textAlign = 'center'; const tw2 = c.measureText(o.name).width + 10; c.fillStyle = '#0c111ee0'; c.fillRect(x + w / 2 - tw2 / 2, g - w * 0.36 - 14, tw2, 14); c.fillStyle = '#ffd970'; c.fillText(o.name.toUpperCase(), x + w / 2, g - w * 0.36 - 3); c.restore(); }
      if (o.me && A.nos) { c.save(); c.globalCompositeOperation = 'lighter'; const fy = g - w * 0.08; for (let q = 0; q < 3; q++) { const L = 30 + Math.random() * 30; const gr = c.createLinearGradient(x, fy, x - L, fy); gr.addColorStop(0, 'rgba(140,210,255,0.9)'); gr.addColorStop(1, 'rgba(60,120,255,0)'); c.fillStyle = gr; c.fillRect(x - L, fy - 3 + q * 2, L, 3); } c.restore(); }
    }
    // smoke (screen space from sim)
    for (const s of A.smoke) { const xx = X(s.d), yy = yOf(s.y) - 14; c.globalAlpha = Math.max(0, Math.min(0.55, s.life)); if (s.glow) c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgb(${s.col})`; c.beginPath(); c.arc(xx, yy, s.glow ? 3 : 5 + (1 - s.life) * 14, 0, Math.PI * 2); c.fill(); c.globalCompositeOperation = 'source-over'; } c.globalAlpha = 1;
    // helicopter + searchlight
    if (A.heli) { const hx = X(A.heli.d), hy = skyH * 0.32; c.save(); c.globalCompositeOperation = 'lighter'; const cx = px0, cy = yOf(A.y) - 20, gr = c.createLinearGradient(hx, hy, cx, cy); gr.addColorStop(0, 'rgba(255,255,230,0.05)'); gr.addColorStop(1, 'rgba(255,255,230,0.28)'); c.fillStyle = gr; c.beginPath(); c.moveTo(hx - 6, hy); c.lineTo(cx - 90, cy + 20); c.lineTo(cx + 90, cy + 20); c.lineTo(hx + 6, hy); c.closePath(); c.fill(); c.restore(); c.fillStyle = '#0d1220'; c.beginPath(); c.ellipse(hx, hy, 30, 11, 0, 0, Math.PI * 2); c.fill(); c.fillRect(hx - 52, hy - 3, 30, 4); c.strokeStyle = 'rgba(180,190,200,0.7)'; c.lineWidth = 2; c.beginPath(); const ra = Math.sin(now / 30) * 60; c.moveTo(hx - ra, hy - 14); c.lineTo(hx + ra, hy - 14); c.stroke(); c.fillStyle = Math.floor(now / 300) % 2 ? '#ff3a3a' : '#3a3aff'; c.fillRect(hx + 22, hy - 2, 3, 3); }
    // weather + speed lines + camera flash
    if (k.rain > 0) { c.strokeStyle = `rgba(180,200,220,${0.3 * k.rain})`; c.lineWidth = 1; c.beginPath(); for (let q = 0; q < 90 * k.rain; q++) { const x = (q * 97 + now * 1.1) % Wd, y = (q * 53 + now * 0.7) % Hd; c.moveTo(x, y); c.lineTo(x - 14, y + 8); } c.stroke(); }
    if (V.v > H.pxs(170)) { c.strokeStyle = `rgba(255,255,255,${Math.min(0.22, (V.v - H.pxs(170)) / 2200)})`; c.lineWidth = 1; c.beginPath(); for (let q = 0; q < 16; q++) { const y = roadTop + ((q * 61 + Math.floor(now / 40) * 17) % roadH), x = (q * 131 + now * 2.5) % Wd; c.moveTo(x, y); c.lineTo(x - 90, y); } c.stroke(); }
    c.restore();
  }
  function sign(c, x, bottom, label, col, low) {
    c.save(); c.font = '800 11px "Chakra Petch",ui-sans-serif,sans-serif'; const w = c.measureText(label).width + 18, h = 20, y = bottom - (low ? 44 : 60);
    c.fillStyle = '#5d646b'; c.fillRect(x + 6, y + h, 3, bottom - y - h); c.fillRect(x + w - 9, y + h, 3, bottom - y - h);
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x + 3, y + 3, w, h); c.fillStyle = col; c.fillRect(x, y, w, h); c.strokeStyle = '#e8eef3'; c.lineWidth = 1; c.strokeRect(x + 2, y + 2, w - 4, h - 4);
    c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(label, x + 9, y + h / 2 + 1); c.restore();
  }
  function gantry(c, x, roadTop, skyH, label, col) {
    c.save(); c.font = '800 13px "Chakra Petch",ui-sans-serif,sans-serif'; const w = c.measureText(label).width + 26, h = 30, y = skyH * 0.42;
    c.fillStyle = '#3a414a'; c.fillRect(x - 4, y, 6, roadTop - y); c.fillRect(x + w - 2, y, 6, roadTop - y); c.fillRect(x - 4, y - 4, w + 10, 5);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x + 4, y + 4, w, h); c.fillStyle = col; c.fillRect(x, y, w, h); c.strokeStyle = '#e8eef3'; c.lineWidth = 1.2; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
    c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(label, x + 13, y + h / 2 + 1); c.restore();
  }
  root.NightshiftHighwaySide = Object.freeze({ ready, draw, carImage, images: IM, tinted });
})(typeof globalThis !== 'undefined' ? globalThis : this);
