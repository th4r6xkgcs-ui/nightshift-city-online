/* Lockpicking + safecracking minigames (Claude-owned). Requires picks-data.js. Used by breakin.js.
 * A panel slides up at the bottom of the screen; tap anywhere on it (or press Space / E) when the pick is in the gold
 * zone (locks) or the notch is on the number (safes). Misses rattle (callers make noise); too many jam it.
 * The world keeps running while you pick — guards still patrol.
 * API: NightshiftPicks.{start(opts), active(), cancel()} — opts: { type, seed, title, sub, onDone(ok, p), onMiss(p), alt: { label, fn } } */
(function (root) {
  'use strict';
  if (!root.document) return;
  const D = root.NightshiftPicksData;
  if (!D) return;
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const wrap = el('div', { id: 'pkWrap', hidden: true });
  const head = el('div', { className: 'pkHead' }), title = el('b'), sub = el('span'); head.append(title, sub);
  const cv = el('canvas', { width: 720, height: 300 }), ctx = cv.getContext('2d');
  const row = el('div', { className: 'pkRow' }), tapBtn = el('button', { type: 'button', className: 'pkTap' }, 'TAP'), altBtn = el('button', { type: 'button', className: 'pkAlt' }, '');
  row.append(altBtn, tapBtn); wrap.append(head, cv, row); document.body.append(wrap);
  document.head.append(el('style', {}, `
  #pkWrap{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:60;width:min(380px,94vw);padding:10px 12px 12px;border-radius:18px;background:linear-gradient(180deg,#141a24f6,#0b0f16f8);border:1px solid #ffffff26;box-shadow:0 18px 50px #000c;color:#eef3f9;font:12px var(--body,system-ui);touch-action:none;user-select:none}
  #pkWrap[hidden]{display:none} #pkWrap .pkHead{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px} #pkWrap .pkHead b{font:800 13px var(--disp,system-ui);letter-spacing:.1em;color:#ffd970} #pkWrap .pkHead span{color:#9fb3c8;font-size:11px}
  #pkWrap canvas{display:block;width:100%;height:auto;border-radius:12px;background:#0a0d12}
  #pkWrap .pkRow{display:flex;gap:8px;margin-top:8px} #pkWrap button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:12px;font:800 13px var(--disp,system-ui);letter-spacing:.08em;padding:12px}
  #pkWrap .pkTap{flex:1;background:linear-gradient(180deg,#ffd970,#c99a2a);color:#1b1408;font-size:16px} #pkWrap .pkAlt{background:#ffffff12;border:1px solid #ffffff26;color:#ffb0a0} #pkWrap .pkAlt[hidden]{display:none}`));

  let P = null, opts = null, t0 = 0, flash = 0, flashHit = false, raf = 0;
  function start(o) {
    if (P) cancel();
    opts = o; const stealth = root.NightshiftSkills?.mod?.('stealth.heat') ?? 1, luck = root.NightshiftSkills?.mod?.('luck.rare') ?? 1;
    P = D.make(o.type, o.seed || ((Math.random() * 1e9) | 0), stealth, luck); t0 = performance.now(); flash = 0;
    title.textContent = o.title || (P.kind === 'safe' ? 'CRACK THE SAFE' : 'PICK THE LOCK'); sub.textContent = o.sub || (P.kind === 'safe' ? 'Tap when the notch hits the number' : 'Tap when the pick is in the gold');
    altBtn.hidden = !o.alt; if (o.alt) altBtn.textContent = o.alt.label;
    wrap.hidden = false; try { root.releaseControls?.(); } catch { /* n/a */ }
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    return true;
  }
  function finish(ok) { const p = P, o = opts; P = null; opts = null; setTimeout(() => { if (!P) wrap.hidden = true; }, ok ? 450 : 650); try { o?.onDone?.(ok, p); } catch (e) { console.error(e); } }
  function cancel() { P = null; opts = null; wrap.hidden = true; cancelAnimationFrame(raf); }
  function doTap() {
    if (!P) return; const pos = D.posAt(P, (performance.now() - t0) / 1000), before = P.set, r = D.tap(P, pos);
    flash = performance.now(); flashHit = r.hit;
    try { root.NightshiftAudio?.play(r.hit ? 'pickup' : 'reload'); } catch { /* optional */ }
    if (r.hit && P.set > before) t0 = performance.now();
    if (!r.hit) { t0 = performance.now(); try { opts?.onMiss?.(P); } catch { /* optional */ } }
    if (r.done) finish(r.ok);
  }
  const press = (e) => { if (!P && !opts) return; e.preventDefault(); e.stopPropagation(); doTap(); };
  cv.addEventListener('pointerdown', press); tapBtn.addEventListener('pointerdown', press);
  altBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); const o = opts; cancel(); try { o?.alt?.fn?.(); } catch (er) { console.error(er); } });
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
  addEventListener('keydown', (e) => { if (!P) return; if (e.key === ' ' || e.key === 'e' || e.key === 'E' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); doTap(); } else if (e.key === 'Escape') { e.stopImmediatePropagation(); const o = opts; cancel(); try { o?.onDone?.(false, { cancelled: true }); } catch { /* n/a */ } } }, true);

  // ---------------- drawing (canvas is 720×300; drawn at 2× for crisp phones) ----------------
  const R = (col, x, y, w, h) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const C = (col, x, y, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  function drawLock(p, pos, now) {
    // brass lock body with keyway, pin chambers across the top
    const bx = 60, by = 40, bw = 600, bh = 150, n = p.targets.length;
    const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, '#d9b45a'); g.addColorStop(0.5, '#b88a2e'); g.addColorStop(1, '#7a5a1a'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect?.(bx, by, bw, bh, 18); ctx.fill();
    R('#ffffff30', bx + 10, by + 6, bw - 20, 4); R('#00000040', bx + 10, by + bh - 10, bw - 20, 4);
    // pins (springs + driver pins) per chamber
    for (let i = 0; i < n; i++) {
      const cx = bx + 60 + i * ((bw - 120) / Math.max(1, n - 1)), set = i < p.set, cur = i === p.set;
      R('#2a2116', cx - 16, by + 14, 32, 80); R('#3a2e1e', cx - 14, by + 16, 28, 76);
      for (let k = 0; k < 5; k++) R('#9aa3ab', cx - 8, by + 20 + k * 6 + (set ? -6 : 0), 16, 2);
      const py = set ? by + 46 : by + 62; R(set ? '#7cdeb5' : cur ? '#f4f1ea' : '#8a8f96', cx - 9, py, 18, 26); R('#ffffff55', cx - 9, py, 18, 3);
      if (set) R('#7cdeb5', cx - 14, by + 44, 28, 2);
      if (cur) { ctx.save(); ctx.strokeStyle = '#ffd970'; ctx.lineWidth = 3; ctx.strokeRect(cx - 18, by + 12, 36, 84); ctx.restore(); }
    }
    // the travel track for the current pin: gold sweet zone + moving pick
    const tx = bx + 40, tw = bw - 80, ty = by + bh - 38, tgt = p.targets[p.set] ?? 0.5;
    R('#1a1410', tx, ty, tw, 22); R('#000000', tx, ty + 18, tw, 4);
    const zx = tx + (tgt - p.zone / 2) * tw, zw = p.zone * tw, inZone = Math.abs(pos - tgt) <= p.zone / 2;
    ctx.save(); ctx.fillStyle = inZone ? '#ffe9a0' : '#ffd970aa'; ctx.shadowColor = '#ffd970'; ctx.shadowBlur = inZone ? 18 : 6; ctx.fillRect(zx, ty + 2, zw, 18); ctx.restore();
    const px = tx + pos * tw;
    R('#c9d1d6', tx - 30, ty + 8, px - tx + 30, 6); R('#ffffff', tx - 30, ty + 8, px - tx + 30, 2); // pick shaft from the left
    ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.moveTo(px, ty - 2); ctx.lineTo(px + 8, ty + 11); ctx.lineTo(px, ty + 24); ctx.closePath(); ctx.fill();
    R('#5d646b', bx - 40, ty + 4, 50, 14); R('#9aa3ab', bx - 40, ty + 4, 50, 3); // tension wrench
  }
  function drawSafe(p, pos, now) {
    const cx = 250, cy = 150, r = 110;
    // safe door + bolts
    R('#2b2f36', 40, 20, 640, 260); R('#3a3f45', 50, 30, 620, 240); R('#ffffff10', 50, 30, 620, 6);
    for (const [x, y] of [[70, 50], [650, 50], [70, 250], [650, 250]]) { C('#1d2024', x, y, 9); C('#5d646b', x, y, 5); }
    // dial
    C('#15181c', cx, cy, r + 10); const g = ctx.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, r); g.addColorStop(0, '#e8eef4'); g.addColorStop(1, '#8a939b'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    const rot = -pos * Math.PI * 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    for (let k = 0; k < 100; k++) { const a = (k / 100) * Math.PI * 2 - Math.PI / 2, big = k % 10 === 0; ctx.strokeStyle = '#1d2024'; ctx.lineWidth = big ? 3 : 1.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4)); ctx.lineTo(Math.cos(a) * (r - (big ? 18 : 10)), Math.sin(a) * (r - (big ? 18 : 10))); ctx.stroke(); if (big) { ctx.save(); ctx.translate(Math.cos(a) * (r - 32), Math.sin(a) * (r - 32)); ctx.rotate(a + Math.PI / 2); ctx.fillStyle = '#1d2024'; ctx.font = '700 15px "Chakra Petch",system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(k), 0, 0); ctx.restore(); } }
    C('#5d646b', 0, 0, 34); C('#9aa3ab', 0, 0, 26); R('#2b2f36', -4, -26, 8, 20);
    ctx.restore();
    // the target notch sits at the top: the number under it is (pos) — gold when lined up
    const tgt = p.targets[p.set] ?? 0, d = Math.min(Math.abs(pos - tgt), 1 - Math.abs(pos - tgt)), inZone = d <= p.zone / 2;
    ctx.save(); ctx.fillStyle = inZone ? '#ffe9a0' : '#ffd970'; ctx.shadowColor = '#ffd970'; ctx.shadowBlur = inZone ? 22 : 4; ctx.beginPath(); ctx.moveTo(cx - 14, cy - r - 26); ctx.lineTo(cx + 14, cy - r - 26); ctx.lineTo(cx, cy - r - 6); ctx.closePath(); ctx.fill(); ctx.restore();
    // combination readout
    ctx.save(); ctx.font = '800 26px "Chakra Petch",system-ui'; ctx.textAlign = 'left';
    p.targets.forEach((t, i) => { const num = String(Math.round(t * 100) % 100).padStart(2, '0'), x = 420 + i * 84, y = 120; R(i < p.set ? '#1d3a2e' : i === p.set ? '#3a3010' : '#1d2024', x - 8, y - 32, 70, 46); ctx.fillStyle = i < p.set ? '#7cdeb5' : i === p.set ? '#ffd970' : '#7d8796'; ctx.fillText(num, x + 6, y); });
    ctx.font = '700 15px system-ui'; ctx.fillStyle = '#9fb3c8'; ctx.fillText(p.dir > 0 ? 'turning right ↻' : 'turning left ↺', 420, 170); ctx.fillText(`misses ${p.misses}/${p.maxMiss}`, 420, 200);
    ctx.restore();
  }
  function loop(now) {
    if (!P) return;
    const pos = D.posAt(P, (now - t0) / 1000);
    ctx.clearRect(0, 0, 720, 300); R('#0a0d12', 0, 0, 720, 300);
    if (P.kind === 'safe') drawSafe(P, pos, now); else drawLock(P, pos, now);
    // misses as broken picks / hit flash
    if (P.kind !== 'safe') { for (let k = 0; k < P.maxMiss; k++) { const x = 70 + k * 30, y = 268; R(k < P.misses ? '#ff5a6a' : '#3a3f45', x, y, 22, 6); } }
    const f = Math.max(0, 1 - (now - flash) / 300); if (f > 0) { ctx.save(); ctx.globalAlpha = f * 0.35; R(flashHit ? '#7cdeb5' : '#ff5a6a', 0, 0, 720, 300); ctx.restore(); }
    raf = requestAnimationFrame(loop);
  }

  root.NightshiftPicks = Object.freeze({ start, cancel, active: () => !!P, paused: () => !!P });
})(typeof globalThis !== 'undefined' ? globalThis : this);
