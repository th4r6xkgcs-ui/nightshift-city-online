/* Minimap (Claude-owned). A round radar in the corner: real city ground + buildings (rendered once from the
 * game's own world art), north-up, ~1000 px of city around you. Shows the GPS route and target, the tracked goal,
 * city events, the active phone job, stash rumors, heists, home and police (flashing). Markers outside the view
 * clamp to the rim. Tap it to open the full city map. Landscape: left of the weapon pill. Portrait: under the
 * phone button. API: NightshiftMinimap.{visible, markers} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const B = () => { try { return buildings; } catch { return []; } };
  const WORLD = () => { try { return world; } catch { return { w: 2200, h: 1700 }; } };
  /* eslint-enable no-undef */
  const SIZE = 104, VIEW = 520; // css px, world radius shown
  const css = document.createElement('style');
  css.textContent = `#mmWrap{position:fixed;z-index:24;width:${SIZE}px;height:${SIZE}px;border-radius:50%;cursor:pointer;
    box-shadow:0 6px 18px #0008,0 0 0 2px #0c111e,0 0 0 3px #ffffff26;overflow:hidden;background:#0b111c}
  #mmWrap canvas{width:100%;height:100%;display:block} #mmWrap .n{position:absolute;top:2px;left:50%;transform:translateX(-50%);font:700 9px ui-monospace,Menlo,monospace;color:#ffd970;text-shadow:0 1px 2px #000}
  #mmWrap[hidden]{display:none} #mmWrap .w{position:absolute;bottom:3px;left:50%;transform:translateX(-50%);font:700 10px ui-monospace,Menlo,monospace;color:#ffd970;text-shadow:0 1px 2px #000;white-space:nowrap;letter-spacing:-1px}`;
  document.head.appendChild(css);
  const wrap = document.createElement('div'); wrap.id = 'mmWrap'; wrap.setAttribute('role', 'button'); wrap.setAttribute('aria-label', 'Minimap: open city map');
  const cv = document.createElement('canvas'), n = document.createElement('span'); n.className = 'n'; n.textContent = 'N';
  const stars = document.createElement('span'); stars.className = 'w';
  wrap.append(cv, n, stars); document.body.append(wrap);
  wrap.addEventListener('click', () => { try { root.NightshiftMap?.open?.(); } catch { /* optional */ } });

  // ---- base map: drawn once from the real world art at 1/5 scale ----
  const S = 0.2; let base = null;
  function buildBase() {
    const w = WORLD(), bs = B(); if (!bs.length || !root.NightshiftWorld?.ground) return null;
    try {
      // v0.62: draw the city straight into the small canvas (no world-sized temp canvas: iPhones refuse canvases over ~16M px)
      const c = document.createElement('canvas'); c.width = Math.round(w.w * S); c.height = Math.round(w.h * S); const x = c.getContext('2d'); if (!x) return null;
      x.save(); x.scale(S, S); root.NightshiftWorld.ground(x, w.w, w.h); x.restore(); x.imageSmoothingEnabled = true;
      x.fillStyle = 'rgba(6,10,20,.35)'; x.fillRect(0, 0, c.width, c.height);
      const tint = { CLUB: '#a04f8f', BANK: '#b39233', CASINO: '#c0485a', DINER: '#b3694b', GARAGE: '#7a6a4a', APARTMENTS: '#4f6f8f' };
      for (const b of bs) {
        const key = Object.keys(tint).find((k) => String(b.name || '').includes(k));
        x.fillStyle = '#05080f'; x.fillRect(b.x * S - 1, b.y * S - 1, b.w * S + 2, b.h * S + 2);
        x.fillStyle = key ? tint[key] : '#2b3a52'; x.fillRect(b.x * S, b.y * S, b.w * S, b.h * S);
        x.fillStyle = '#ffffff1a'; x.fillRect(b.x * S, b.y * S, b.w * S, 2);
      }
      return c;
    } catch { return null; }
  }

  function markers() {
    const out = [], add = (x, y, color, kind, extra) => { if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y, color, kind, ...extra }); };
    const gps = root.NightshiftMap?.target?.(); if (gps) add(gps.x, gps.y, '#ff8da8', 'gps');
    const goal = root.NightshiftGoals?.track?.(); if (goal) add(goal.x, goal.y, '#ffd970', 'goal');
    const ev = root.NightshiftEvents?.active?.(), ED = root.NightshiftEventsData;
    if (ev) { const t = ev.stage === 'carry' ? ev.to : ev.stage === 'run' ? ev.gates?.[ev.progress] : ev; if (t) add(t.x, t.y, '#4fe3ff', 'event'); }
    const job = root.NightshiftJobs?.target?.(); if (job) add(job.x, job.y, job.hit ? '#ff5161' : '#ff4fd8', 'job');
    const rum = root.NightshiftStashes?.state?.rumor; if (rum) add(rum.x, rum.y, '#ffd970', 'rumor', { r: rum.r });
    const hs = root.NightshiftHeists?.active?.(); if (hs) { const v = (root.NightshiftHeists?.vaults?.() || []).find((q) => q.id === hs.bank); if (v) add(v.x, v.y, '#ffcf4a', 'heist'); }
    add(950, 735, '#7cdeb5', 'home');
    // v0.74: special buildings (gun shop, hospital, police, gym, tattoo, auto parts) as lettered pins, only in view
    try { const POI = { 'GUN SHOP': ['G', '#ff6a5a'], HOSPITAL: ['+', '#ff4a6a'], POLICE: ['P', '#4a8aff'], GYM: ['F', '#7cffb5'], TATTOO: ['T', '#ff4ad8'], 'AUTO PARTS': ['A', '#ffb04a'] }; for (const d of root.NightshiftInteriors2?.doors?.() || []) { const q = POI[d.type]; if (q) add(d.x, d.y, q[1], 'poi', { glyph: q[0] }); } } catch { /* optional */ }
    for (const o of root.NightshiftCrime?.officers || []) add(o.x, o.y, '#ff4a5a', 'cop');
    void ED; return out;
  }

  function place() {
    const land = innerWidth > innerHeight;
    if (land) {
      const pill = document.querySelector('#wpPill')?.getBoundingClientRect();
      wrap.style.top = Math.round(pill?.height ? Math.max(8, pill.top - 6) : 8) + 'px';
      wrap.style.left = Math.round((pill?.width ? pill.left : innerWidth - 160) - SIZE - 10) + 'px';
      wrap.style.right = 'auto';
    } else {
      const btn = document.querySelector('#jbBtn')?.getBoundingClientRect(), radio = document.querySelector('#lfRadio'), rr = radio && !radio.hidden ? radio.getBoundingClientRect() : null;
      const below = Math.max(btn?.bottom || 120, rr?.height ? rr.bottom : 0);
      wrap.style.top = Math.round(below + 8) + 'px'; wrap.style.right = '12px'; wrap.style.left = 'auto';
    }
  }
  function hidden() {
    const H = root.NightshiftHome; if (H?.paused?.() || H?.kind?.()) return true;
    return ['NightshiftJobs', 'NightshiftCasino', 'NightshiftFishing', 'NightshiftVenues', 'NightshiftHeists', 'NightshiftEmpire', 'NightshiftWeapons', 'NightshiftMarket', 'NightshiftLife', 'NightshiftRespect'].some((m) => { try { return !!root[m]?.paused?.(); } catch { return false; } });
  }
  function draw() {
    const p = P(); if (!p) return;
    const hide = hidden(); wrap.hidden = hide; if (hide) return;
    place();
    if (!base) base = buildBase();
    const dpr = Math.min(2, root.devicePixelRatio || 1), px = Math.round(SIZE * dpr);
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    const c = cv.getContext('2d'); if (!c) return;
    const k = px / (VIEW * 2), cx = px / 2, cy = px / 2, now = performance.now();
    c.save(); c.clearRect(0, 0, px, px); c.fillStyle = '#0b111c'; c.fillRect(0, 0, px, px);
    c.beginPath(); c.arc(cx, cy, px / 2, 0, Math.PI * 2); c.clip();
    if (base) { c.imageSmoothingEnabled = true; c.drawImage(base, (p.x - VIEW) * S, (p.y - VIEW) * S, VIEW * 2 * S, VIEW * 2 * S, 0, 0, px, px); }
    const to = (x, y) => ({ x: cx + (x - p.x) * k, y: cy + (y - p.y) * k });
    // GPS route
    const path = root.NightshiftMap?.path?.() || [];
    if (path.length) { c.strokeStyle = '#ff8da8cc'; c.lineWidth = 2.5 * dpr; c.lineJoin = 'round'; c.beginPath(); const a = to(p.x, p.y); c.moveTo(a.x, a.y); for (const q of path) { const b = to(q.x, q.y); c.lineTo(b.x, b.y); } c.stroke(); }
    // v0.59: gang turf (your blocks in magenta), the police search area, police cars
    try {
      const GD = root.NightshiftGangsData, gs = root.NightshiftGangs?.state;
      if (GD) for (const g of GD.GANGS) for (const [bx, by] of g.blocks) { const own = gs?.owned?.[bx + ',' + by], a = to(bx * 440 + 66, by * 340 + 66), w = 308 * k, h = 208 * k; if (a.x > px || a.y > px || a.x + w < 0 || a.y + h < 0) continue; c.fillStyle = (own ? '#ff7ad8' : (g.color === '#1d2024' ? '#c9d1d6' : g.color)) + '55'; c.fillRect(a.x, a.y, w, h); c.strokeStyle = (own ? '#ff7ad8' : g.glow) + 'aa'; c.lineWidth = 1 * dpr; c.strokeRect(a.x, a.y, w, h); }
      const W = root.NightshiftCrime?.wanted;
      if (W && W.stars > 0 && W.center && !W.seen) { const v = to(W.center.x, W.center.y); c.strokeStyle = Math.floor(now / 400) % 2 ? '#ff4a5acc' : '#4a7affcc'; c.fillStyle = '#ff4a5a18'; c.lineWidth = 2 * dpr; c.setLineDash?.([5 * dpr, 4 * dpr]); c.beginPath(); c.arc(v.x, v.y, (W.radius || 400) * k, 0, Math.PI * 2); c.fill(); c.stroke(); c.setLineDash?.([]); }
      for (const pc of root.NightshiftPoliceCars?.cars?.() || []) { const v = to(pc.x, pc.y); if (Math.hypot(v.x - cx, v.y - cy) > px / 2) continue; c.fillStyle = Math.floor(now / 200) % 2 ? '#ff4a5a' : '#4a7aff'; c.fillRect(v.x - 3 * dpr, v.y - 2 * dpr, 6 * dpr, 4 * dpr); }
    } catch { /* optional layers */ }
    // markers (clamped to rim)
    for (const m of markers()) {
      let v = to(m.x, m.y); const dx = v.x - cx, dy = v.y - cy, d = Math.hypot(dx, dy), rim = px / 2 - 7 * dpr, out = d > rim;
      if (m.kind === 'rumor' && !out) { c.strokeStyle = '#ffd97099'; c.lineWidth = 1.5 * dpr; c.setLineDash?.([4 * dpr, 3 * dpr]); c.beginPath(); c.arc(v.x, v.y, m.r * k, 0, Math.PI * 2); c.stroke(); c.setLineDash?.([]); continue; }
      if (m.kind === 'cop') { if (out) continue; c.fillStyle = Math.floor(now / 250) % 2 ? '#ff4a5a' : '#4a7aff'; c.beginPath(); c.arc(v.x, v.y, 2.6 * dpr, 0, Math.PI * 2); c.fill(); continue; }
      if (m.kind === 'poi') { if (out) continue; c.fillStyle = '#05080f'; c.beginPath(); c.arc(v.x, v.y, 7 * dpr, 0, Math.PI * 2); c.fill(); c.fillStyle = m.color; c.beginPath(); c.arc(v.x, v.y, 5.8 * dpr, 0, Math.PI * 2); c.fill(); c.fillStyle = '#05080f'; c.font = `800 ${Math.round(8.5 * dpr)}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m.glyph, v.x, v.y + 0.5 * dpr); continue; }
      if (out) v = { x: cx + dx / d * rim, y: cy + dy / d * rim };
      c.fillStyle = '#05080f'; c.beginPath(); c.arc(v.x, v.y, 4.6 * dpr, 0, Math.PI * 2); c.fill();
      c.fillStyle = m.color; c.beginPath();
      if (m.kind === 'home') { c.moveTo(v.x, v.y - 4 * dpr); c.lineTo(v.x + 4 * dpr, v.y); c.lineTo(v.x + 3 * dpr, v.y + 3.5 * dpr); c.lineTo(v.x - 3 * dpr, v.y + 3.5 * dpr); c.lineTo(v.x - 4 * dpr, v.y); }
      else c.arc(v.x, v.y, 3.4 * dpr, 0, Math.PI * 2);
      c.fill();
    }
    // player arrow
    const ang = p.car ? (p.car.angle || 0) : (Number.isFinite(p.moveAngle) && p.moving ? p.moveAngle : p.angle || 0);
    c.translate(cx, cy); c.rotate(ang); c.fillStyle = '#ffffff'; c.strokeStyle = '#05080f'; c.lineWidth = 1.5 * dpr;
    c.beginPath(); c.moveTo(7 * dpr, 0); c.lineTo(-5 * dpr, -5 * dpr); c.lineTo(-2.5 * dpr, 0); c.lineTo(-5 * dpr, 5 * dpr); c.closePath(); c.stroke(); c.fill();
    c.restore();
    // heat ring
    const heat = p.heat || 0, lvl = root.NightshiftWantedData ? root.NightshiftWantedData.stars(heat) : Math.min(5, Math.ceil(heat - 0.05));
    stars.textContent = lvl > 0 ? '★'.repeat(lvl) + '☆'.repeat(5 - lvl) : '';
    wrap.style.boxShadow = heat >= 0.5 ? `0 6px 18px #0008,0 0 0 2px #0c111e,0 0 0 3px ${Math.floor(now / 300) % 2 ? '#ff4a5a' : '#4a7aff'}` : '';
  }
  setInterval(draw, 100);
  root.NightshiftMinimap = Object.freeze({ visible: () => !wrap.hidden, markers: () => markers(), base: () => base || (base = buildBase()) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
