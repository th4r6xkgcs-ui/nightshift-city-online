/* Vehicle Studio (Claude-owned). Requires carstyle-data.js; cars.js draws every option.
 *  - Inspect any car you own on a garage turntable: rotate (8 steps or auto-spin), zoom, day/night (lights + underglow).
 *  - Preview paint, finish, wheels, spoiler, hood, livery, headlights, underglow, tint and exhaust for free.
 *  - At a 🔧 GARAGE (tuning panel → STYLE STUDIO) you pay for what changed and it stays on that car.
 *  - From 📱 MY CARS it's preview-only.
 * Save: nightshift-carstyle-v1. API: NightshiftCarStyle.{of, open, close, state, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const SD = root.NightshiftCarStyleData; if (!SD) return;
  const KEY = 'nightshift-carstyle-v1';
  let state = SD.clean({});
  try { state = SD.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const of = (id) => (state.cars[id] ? state.cars[id] : null);
  const PAINT_PRICE = 300;
  const PAINTS = ['#c84659', '#e0402a', '#ff8a3d', '#e2b75c', '#8fd14f', '#3ad6a0', '#3d99d6', '#2f4fd0', '#6d73be', '#b06bff', '#ff4fd8', '#f1efe8', '#b1c4d5', '#6b7480', '#1d2433', '#0d0f12'];

  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  document.head.append(el('style', {}, `
  #vsPanel{position:fixed;inset:0;z-index:71;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(250px,1fr);background:#07090d;color:#eef3f9;font:13px var(--body,system-ui);touch-action:none}
  #vsPanel[hidden]{display:none} #vsPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:10px;font:700 12px var(--disp,system-ui);letter-spacing:.04em}
  #vsPanel .stage{display:flex;flex-direction:column;min-width:0;min-height:0;border-right:1px solid #ffffff14} #vsPanel canvas{flex:1;min-height:0;width:100%}
  #vsPanel .bar{display:flex;gap:6px;align-items:center;padding:6px 10px;flex-wrap:wrap} #vsPanel input[type=range]{flex:1;min-width:70px;accent-color:#ffd970}
  #vsPanel .chip{padding:7px 10px;background:#ffffff10;border:1px solid #ffffff22;color:#cfe0f2} #vsPanel .chip.on{background:linear-gradient(180deg,#ffd970,#c99a2a);color:#1b1408;border-color:transparent} #vsPanel .rot{width:38px;height:38px;font-size:17px;background:#ffffff14;border:1px solid #ffffff26}
  #vsPanel .side{display:flex;flex-direction:column;min-width:0;min-height:0}
  #vsPanel .top{display:flex;align-items:flex-start;gap:8px;padding:8px 10px 2px} #vsPanel h2{margin:0;font:800 16px var(--disp,system-ui);letter-spacing:.04em} #vsPanel .tg{font:800 10px var(--disp,system-ui);letter-spacing:.16em;color:#9fb3c8;margin-top:2px} #vsPanel .x{padding:8px 12px;background:#ffffff14;border:1px solid #ffffff2a;margin-left:auto}
  #vsPanel .cats{display:flex;gap:5px;overflow-x:auto;padding:6px 10px;scrollbar-width:none;flex:none} #vsPanel .cats button{flex:none;padding:8px 10px;background:#ffffff0c;border:1px solid #ffffff1c;color:#cfe0f2;font-size:11px} #vsPanel .cats button.on{background:#ffd97022;border-color:#ffd970aa;color:#ffd970}
  #vsPanel .opts{flex:1;min-height:90px;overflow:auto;padding:4px 10px 10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px;align-content:start;touch-action:pan-y}
  #vsPanel .o{padding:9px 8px;border-radius:12px;background:#ffffff08;border:1px solid #ffffff16;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:3px} #vsPanel .o b{font-size:12px} #vsPanel .o small{color:#a9b8ca;font-size:10.5px} #vsPanel .o.sel{border-color:#ffd970;background:#ffd97014} #vsPanel .o.cur small{color:#7cdeb5}
  #vsPanel .o i{display:block;height:14px;border-radius:7px;border:1px solid #ffffff33}
  #vsPanel .foot{display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid #ffffff14;flex:none} #vsPanel .foot .s{flex:1;min-width:0;color:#a9b8ca;font-size:11px;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  #vsPanel .go{padding:10px 12px;background:linear-gradient(180deg,#ffd970,#c99a2a);color:#1b1408} #vsPanel .alt{padding:9px 10px;background:#ffffff12;border:1px solid #ffffff24;color:#cfe0f2}
  @media (max-width:640px){#vsPanel{grid-template-columns:1fr;grid-template-rows:44% 56%} #vsPanel .stage{border-right:0;border-bottom:1px solid #ffffff14}}`));
  const pnl = el('div', { id: 'vsPanel', hidden: true, role: 'dialog', ariaLabel: 'Vehicle studio' }); document.body.append(pnl);
  const stage = el('div', { className: 'stage' }), cv = el('canvas'), bar1 = el('div', { className: 'bar' }), bar2 = el('div', { className: 'bar' });
  stage.append(cv, bar1, bar2);
  const side = el('div', { className: 'side' }), top = el('div', { className: 'top' }), cats = el('div', { className: 'cats' }), opts = el('div', { className: 'opts' }), foot = el('div', { className: 'foot' });
  side.append(top, cats, opts, foot); pnl.append(stage, side);

  let car = null, mode = 'view', preview = null, paint = null, cat = 'paint', angle = -Math.PI / 4, spin = true, zoom = 1, night = false, raf = 0, last = 0;
  const btn = (cls, txt, fn) => { const b = el('button', { className: cls, type: 'button' }, txt); b.onclick = fn; return b; };
  const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'], dirLbl = el('span', { className: 'tg', style: 'min-width:26px;text-align:center' }, '');
  const stepRot = (d) => { spin = false; spinB.classList.remove('on'); angle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4) + d * Math.PI / 4; };
  const spinB = btn('chip on', '⟳ SPIN', () => { spin = !spin; spinB.classList.toggle('on', spin); });
  const zoomIn = el('input', { type: 'range', min: '1', max: '3', step: '0.1', value: '1', ariaLabel: 'Zoom' }); zoomIn.oninput = () => { zoom = Number(zoomIn.value); };
  const nightB = btn('chip', '🌙 NIGHT', () => { night = !night; nightB.classList.toggle('on', night); });
  bar1.append(btn('rot', '◀', () => stepRot(-1)), dirLbl, btn('rot', '▶', () => stepRot(1)), el('span', { style: 'font-size:14px' }, '🔍'), zoomIn);
  bar2.append(spinB, nightB, btn('chip', 'COMPARE', () => {}));
  const cmp = bar2.lastChild; let comparing = false; cmp.onclick = null;
  cmp.addEventListener('pointerdown', (e) => { e.preventDefault(); comparing = true; cmp.classList.add('on'); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) cmp.addEventListener(ev, () => { comparing = false; cmp.classList.remove('on'); });
  // drag to rotate, pinch / wheel to zoom
  const ptr = new Map(); let lastX = null, pinch0 = 0, z0 = 1;
  cv.addEventListener('pointerdown', (e) => { ptr.set(e.pointerId, e); cv.setPointerCapture?.(e.pointerId); if (ptr.size === 1) { lastX = e.clientX; spin = false; spinB.classList.remove('on'); } if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); z0 = zoom; } });
  cv.addEventListener('pointermove', (e) => { if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, e); if (ptr.size === 2 && pinch0) { const [a, b] = [...ptr.values()]; zoom = Math.max(1, Math.min(3, z0 * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch0)); zoomIn.value = String(zoom); return; } if (lastX !== null) { angle += (e.clientX - lastX) * 0.012; lastX = e.clientX; } });
  for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, (e) => { ptr.delete(e.pointerId); if (ptr.size < 2) pinch0 = 0; if (!ptr.size) lastX = null; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.max(1, Math.min(3, zoom - Math.sign(e.deltaY) * 0.15)); zoomIn.value = String(zoom); }, { passive: false });

  function loop(now) {
    if (pnl.hidden) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; if (spin) angle += dt * 0.5;
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0);
    // garage floor: polished concrete tiles, turntable, overhead light
    c.fillStyle = night ? '#07090e' : '#20262e'; c.fillRect(0, 0, w, h);
    const ts = Math.round(42 * dpr); c.strokeStyle = night ? '#10141b' : '#2a313a'; c.lineWidth = 1; for (let x = (w / 2) % ts; x < w; x += ts) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, h); c.stroke(); } for (let y = (h / 2) % ts; y < h; y += ts) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(w, y + 0.5); c.stroke(); }
    const R0 = Math.min(w, h) * 0.46; c.fillStyle = night ? '#0d1117' : '#2b333d'; c.beginPath(); c.arc(w / 2, h / 2, R0, 0, Math.PI * 2); c.fill(); c.strokeStyle = night ? '#ffd97022' : '#ffd97055'; c.lineWidth = 2 * dpr; c.stroke();
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2 + angle * 0.0; c.fillStyle = '#ffffff10'; c.fillRect(w / 2 + Math.cos(a) * (R0 - 6 * dpr) - dpr, h / 2 + Math.sin(a) * (R0 - 6 * dpr) - dpr, 2 * dpr, 2 * dpr); }
    if (!night) { const sp = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, R0 * 1.3); sp.addColorStop(0, '#fff3d81c'); sp.addColorStop(1, '#0000'); c.fillStyle = sp; c.fillRect(0, 0, w, h); }
    if (car) {
      const C = root.NightshiftCars;
      const len = 70, k = (Math.min(w, h) * 0.86 / len) * zoom; // world px → device px
      c.save(); c.translate(w / 2, h / 2); c.scale(k, k);
      if (night) { c.save(); c.rotate(angle); c.globalCompositeOperation = 'lighter'; const L = (preview && (car.len || 56)) || 56; for (const s of [-1, 1]) { const gr = c.createRadialGradient(L / 2, s * 8, 2, L / 2 + 60, s * 14, 70); const col = { stock: '#fff4c8', xenon: '#eaf6ff', amber: '#ffc46b', ice: '#9fdcff' }[(comparing ? SD.styleOf(state, car.id) : preview).lights] || '#fff4c8'; gr.addColorStop(0, col + '55'); gr.addColorStop(1, col + '00'); c.fillStyle = gr; c.beginPath(); c.moveTo(L / 2 - 2, s * 8); c.lineTo(L / 2 + 90, s * 36); c.lineTo(L / 2 + 90, s * -14); c.closePath(); c.fill(); } c.restore(); }
      const v = { ...car, x: 0, y: 0, angle, speed: 0, color: comparing ? car.color : paint || car.color };
      try { C.draw(v, c, { style: comparing ? SD.styleOf(state, car.id) : preview, night }); } catch (e) { console.error(e); }
      c.restore();
    }
    dirLbl.textContent = DIRS[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
    raf = requestAnimationFrame(loop);
  }

  const CATS = [['paint', '🎨 Paint'], ['finish', '✨ Finish'], ['rims', '🛞 Wheels'], ['spoiler', '🪽 Spoiler'], ['hood', '🔩 Hood'], ['livery', '🏁 Livery'], ['lights', '💡 Lights'], ['glow', '🌈 Underglow'], ['tint', '🕶️ Tint'], ['exhaust', '💨 Exhaust']];
  function specOf(v) { const D = root.NightshiftCarsData; return D?.fromModel?.(v.model) || null; }
  function render() {
    top.textContent = ''; const spec = specOf(car), cond = Math.round(car.condition ?? 100), cur = SD.styleOf(state, car.id);
    const nm = el('div'); nm.append(el('h2', {}, `${mode === 'shop' ? '🔧 ' : ''}${spec?.name || car.model || 'Your car'}`));
    const tg = el('div', { className: 'tg' }, `${(spec?.tier || 'Street').toUpperCase()} · BODY ${cond}%${car.plate ? ' · ' + car.plate : ''} · SHOW FLAIR ${SD.flair(preview)}/30`); tg.style.color = { Exotic: '#ffd970', Classic: '#c99aff', Sport: '#7cc7ff', Muscle: '#ff9a6b' }[spec?.tier] || '#9fb3c8'; nm.append(tg);
    top.append(nm, btn('x', 'CLOSE', close));
    cats.textContent = ''; for (const [id, label] of CATS) cats.append(btn(cat === id ? 'on' : '', label, () => { cat = id; render(); }));
    opts.textContent = '';
    if (cat === 'paint') {
      for (const hex of [...new Set([car.color, ...(spec?.colors || []), ...PAINTS])]) { const on = (paint || car.color) === hex, d = el('div', { className: 'o' + (on ? ' sel' : '') + (hex === car.color ? ' cur' : '') }), sw = el('i'); sw.style.background = `linear-gradient(90deg,${hex},${hex}cc)`; d.append(sw, el('small', {}, hex === car.color ? 'Current paint' : `${money(PAINT_PRICE)}`)); d.onclick = () => { paint = hex === car.color ? null : hex; render(); }; opts.append(d); }
    } else {
      const k = cat; for (const [v, name, price] of SD.OPT[k].list) {
        const on = preview[k] === v, d = el('div', { className: 'o' + (on ? ' sel' : '') + (cur[k] === v ? ' cur' : '') });
        if (k === 'glow' && v !== 'none') { const sw = el('i'); sw.style.background = `linear-gradient(90deg,${v}00,${v},${v}00)`; d.append(sw); }
        d.append(el('b', {}, name), el('small', {}, cur[k] === v ? 'On your car' : price ? money(price) : 'Free'));
        d.onclick = () => { preview = { ...preview, [k]: v }; if ((k === 'glow' || k === 'lights') && v !== 'none' && v !== 'stock') { night = true; nightB.classList.add('on'); } if (k === 'livery' && v !== 'none' && cat === 'livery') { /* colour row below */ } render(); };
        opts.append(d);
      }
      if (k === 'livery' && preview.livery !== 'none') { opts.append(el('div', { className: 'tg', style: 'grid-column:1/-1;margin-top:6px' }, 'LIVERY COLOUR')); for (const [v, name] of SD.OPT.liveryColor.list) { const d = el('div', { className: 'o' + (preview.liveryColor === v ? ' sel' : '') }), sw = el('i'); sw.style.background = v; d.append(sw, el('small', {}, name)); d.onclick = () => { preview = { ...preview, liveryColor: v }; render(); }; opts.append(d); } }
    }
    // footer: what changed, what it costs
    foot.textContent = ''; const changes = SD.diff(cur, preview), total = SD.cost(cur, preview) + (paint ? PAINT_PRICE : 0), n = changes.length + (paint ? 1 : 0);
    foot.append(el('div', { className: 's' }, n ? `${n} change${n > 1 ? 's' : ''} · ${money(total)}${mode === 'shop' ? '' : ' · apply at any 🔧 GARAGE → STYLE STUDIO'}` : 'Tap anything to preview it on your car. Hold COMPARE to see it as it is.'));
    if (n) foot.append(btn('alt', 'RESET', () => { preview = { ...cur }; paint = null; render(); }));
    if (n && mode === 'shop') foot.append(btn('go', `APPLY · ${money(total)}`, applyAll));
  }
  function applyAll() {
    const p = P(); if (!p) return; const cur = SD.styleOf(state, car.id), total = SD.cost(cur, preview) + (paint ? PAINT_PRICE : 0);
    if (!(p.cash >= total)) { say(`Needs ${money(total)}`); return; }
    if (SD.diff(cur, preview).length) { const r = SD.apply(state, p, car.id, preview); if (!r.ok) { say(r.reason); return; } }
    if (paint) { p.cash -= PAINT_PRICE; car.color = paint; const rec = root.NightshiftCars?.state?.owned?.find((o) => 'cx-' + o.uid === car.id); if (rec) rec.color = paint; paint = null; }
    try { root.NightshiftLedger?.tag?.('cars'); } catch { /* optional */ }
    persist(); gameSave(); say(`🎨 Done · ${money(total)} · looks unreal`); preview = { ...SD.styleOf(state, car.id) }; render();
    try { root.NightshiftGoals?.bump?.('carStyled'); } catch { /* optional */ }
  }
  function open(v, m = 'view') {
    if (!v || !v.id) { say('🚗 Pick one of your cars first'); return false; }
    car = v; mode = m === 'shop' ? 'shop' : 'view'; preview = { ...SD.styleOf(state, car.id) }; paint = null; cat = 'paint'; zoom = 1; zoomIn.value = '1'; spin = true; spinB.classList.add('on');
    night = (root.NightshiftEnvironment?.darkness?.(root.NightshiftEnvironment?.state?.minute ?? 720) || 0) > 0.35; nightB.classList.toggle('on', night);
    pnl.hidden = false; try { root.releaseControls?.(); } catch { /* n/a */ } render(); cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(loop); return true;
  }
  function close() { pnl.hidden = true; cancelAnimationFrame(raf); }
  addEventListener('keydown', (e) => { if (pnl.hidden) return; if (e.key === 'Escape') { close(); e.stopImmediatePropagation(); } }, true);

  root.NightshiftCarStyle = Object.freeze({ of, open, close, get state() { return state; }, paused: () => !pnl.hidden, save: persist });
})(typeof globalThis !== 'undefined' ? globalThis : this);
