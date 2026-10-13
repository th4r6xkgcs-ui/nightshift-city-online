/* Character Studio (Claude-owned): inspect and customize your character. Requires wardrobe-data.js + character-art.js.
 *  - Stage: your character drawn by the same renderer the game uses (NightshiftCharacters.frame). Swipe or ◀ ▶ to
 *    rotate through all 8 directions, pinch or the slider to zoom, IDLE / WALK / RUN previews, FULL / CLOSE-UP,
 *    and hold COMPARE to flip between what you're wearing and what you're trying on.
 *  - Categories: body, hair & face, headwear, eyewear & masks, tops, outerwear, bottoms, footwear, gloves, jewelry,
 *    bags, plus OUTFITS (5 saved slots + curated looks). Tapping an item tries it on instantly (never auto-buys).
 *  - Item panel: enlarged close-up, name, category, rarity, condition, colours, options (hood, open/closed, tucked,
 *    backwards cap, rolled sleeves, camo), owned/equipped state, description.
 *  - Ownership: wear anything you own anywhere (apartment wardrobe, 📱 STYLE). Buying happens at CLOTHING stores
 *    (a 👕 BOUTIQUE point at every CLOTHING building), where the cart buys everything you're trying on at once.
 * Save: nightshift-wardrobe-v1. API: NightshiftWardrobe.{outfit, state, open(mode), save} */
(function (root) {
  'use strict';
  const W = root.NightshiftWardrobeData;
  if (!W || !root.document) return;
  const KEY = 'nightshift-wardrobe-v1';
  let state = W.clean({});
  try { state = W.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const B = () => { try { return buildings; } catch { return []; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } syncProfile(); };
  // Keep Codex's profile colours in step (its held-weapon sleeve/hand and minimap use them).
  function syncProfile() { const pr = root.NightshiftHome?.profile; if (!pr) return; const o = state.outfit, col = (p) => (p ? W.ITEM[p.id].colors[p.color] : null); try { pr.shirt = col(o.outer) || col(o.top) || pr.shirt; pr.pants = col(o.bottom) || pr.pants; pr.shoes = col(o.shoes) || pr.shoes; pr.skin = W.SKINS[o.skin]; pr.hair = W.HAIR_COLORS[o.hairColor]; } catch { /* frozen */ } }
  setTimeout(syncProfile, 1500);

  // ---------------- UI ----------------
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const css = el('style', {}, `
  #csStudio{position:fixed;inset:0;z-index:70;display:grid;grid-template-columns:minmax(230px,40%) minmax(0,1fr);background:radial-gradient(120% 120% at 20% 10%,#1d2836,#0a0d13 70%);color:#eef3f9;font:13px var(--body,system-ui);touch-action:none}
  #csStudio[hidden]{display:none} #csStudio button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:10px;font:700 12px var(--disp,system-ui);letter-spacing:.04em}
  #csStudio .stage{position:relative;display:flex;flex-direction:column;min-height:0;border-right:1px solid #ffffff14}
  #csStudio .stage canvas{flex:1;min-height:0;width:100%;touch-action:none;cursor:grab}
  #csStudio .bar{display:flex;gap:6px;align-items:center;padding:6px 8px;flex-wrap:wrap} #csStudio .chip{padding:7px 10px;background:#ffffff10;border:1px solid #ffffff22;color:#cfe0f2} #csStudio .chip.on{background:linear-gradient(180deg,#ffd970,#c99a2a);color:#1b1408;border-color:transparent}
  #csStudio .rot{width:40px;height:40px;font-size:18px;background:#ffffff14;border:1px solid #ffffff26} #csStudio input[type=range]{flex:1;accent-color:#ffd970;min-width:60px}
  #csStudio .dirlbl{font:800 11px var(--disp,system-ui);letter-spacing:.2em;color:#9fb3c8;min-width:34px;text-align:center}
  #csStudio .side{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden} #csStudio .side>*:not(.scroll){flex:none}
  #csStudio .top{display:flex;align-items:center;gap:8px;padding:8px 10px 4px} #csStudio .top h2{margin:0;flex:1;font:800 16px var(--disp,system-ui);letter-spacing:.06em;color:#ffd970} #csStudio .x{padding:8px 12px;background:#ffffff14;border:1px solid #ffffff2a}
  #csStudio .cats{display:flex;gap:5px;overflow-x:auto;padding:4px 10px 6px;scrollbar-width:none} #csStudio .cats button{flex:none;padding:8px 10px;background:#ffffff0c;border:1px solid #ffffff1c;color:#cfe0f2;font-size:11px} #csStudio .cats button.on{background:#ffd97022;border-color:#ffd970aa;color:#ffd970}
  #csStudio .scroll{flex:1;min-height:118px;overflow:auto;padding:0 10px 10px;touch-action:pan-y}
  #csStudio .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:6px}
  #csStudio .it{position:relative;border-radius:12px;background:#ffffff08;border:1px solid #ffffff16;padding:4px 2px 5px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;font-size:10px;color:#cfe0f2;text-align:center;line-height:1.15}
  #csStudio .it canvas{width:48px;height:74px;image-rendering:pixelated} #csStudio .it.sel{border-color:#ffd970;background:#ffd97014} #csStudio .it.wear::after{content:'✓';position:absolute;top:3px;right:6px;color:#7cdeb5;font-weight:800}
  #csStudio .it .rar{width:70%;height:2px;border-radius:2px} #csStudio .it.lock{opacity:.78} #csStudio .it .pr{color:#ffd970;font-weight:700}
  #csStudio .det{display:flex;gap:10px;padding:8px 10px;border-top:1px solid #ffffff14;background:#0d121acc;align-items:flex-start}
  #csStudio .det canvas{width:96px;height:96px;flex:none;border-radius:12px;background:#1a2230;image-rendering:pixelated} #csStudio .det .m{flex:1;min-width:0} #csStudio .det b{font:800 14px var(--disp,system-ui)} #csStudio .det .tg{font:700 10px var(--disp,system-ui);letter-spacing:.14em;margin:2px 0}
  #csStudio .det .ds{color:#a9b8ca;font-size:11px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden} #csStudio .sw{display:flex;gap:5px;flex-wrap:wrap;margin:5px 0} #csStudio .sw button{width:22px;height:22px;border-radius:50%;border:2px solid #ffffff33} #csStudio .sw button.on{border-color:#ffd970;box-shadow:0 0 0 2px #ffd97055}
  #csStudio .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px} #csStudio .go{padding:9px 12px;background:linear-gradient(180deg,#7cdeb5,#2f9f7a);color:#06140f} #csStudio .buy{padding:9px 12px;background:linear-gradient(180deg,#ffd970,#c99a2a);color:#1b1408} #csStudio .alt{padding:8px 10px;background:#ffffff12;border:1px solid #ffffff24;color:#cfe0f2}
  #csStudio .foot{display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid #ffffff14} #csStudio .foot .s{flex:1;min-width:0;color:#a9b8ca;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #csStudio .foot button{padding:9px 10px}
  #csStudio .outf{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px} #csStudio .outf .o{border-radius:12px;background:#ffffff08;border:1px solid #ffffff16;padding:6px;display:flex;flex-direction:column;align-items:center;gap:4px}
  #csStudio .outf canvas{width:64px;height:82px;image-rendering:pixelated} #csStudio h4{margin:8px 0 6px;font:800 11px var(--disp,system-ui);letter-spacing:.16em;color:#8fa6c0}
  @media (max-height:460px){#csStudio .top h2{font-size:13px} #csStudio .det{padding:6px 10px} #csStudio .det canvas{width:72px;height:72px} #csStudio .bar{padding:4px 8px} #csStudio .chip{padding:6px 8px} #csStudio .rot{width:36px;height:36px} #csStudio .it canvas{width:40px;height:61px} #csStudio .grid{grid-template-columns:repeat(auto-fill,minmax(66px,1fr))}}
  @media (max-width:640px){#csStudio{grid-template-columns:1fr;grid-template-rows:42% 58%} #csStudio .stage{border-right:0;border-bottom:1px solid #ffffff14}}`);
  document.head.append(css);
  const root0 = el('div', { id: 'csStudio', hidden: true, role: 'dialog', ariaLabel: 'Character studio' }); document.body.append(root0);
  const stage = el('div', { className: 'stage' }), cv = el('canvas'), sctx = cv.getContext('2d');
  const bar1 = el('div', { className: 'bar' }), bar2 = el('div', { className: 'bar' });
  stage.append(cv, bar1, bar2);
  const side = el('div', { className: 'side' }), top = el('div', { className: 'top' }), title = el('h2', {}, 'STYLE'), closeB = el('button', { className: 'x', type: 'button' }, 'CLOSE');
  top.append(title, closeB); const cats = el('div', { className: 'cats' }), scroll = el('div', { className: 'scroll' }), det = el('div', { className: 'det' }), foot = el('div', { className: 'foot' });
  side.append(top, cats, scroll, det, foot); root0.append(stage, side);
  const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  let mode = 'home', preview = null, cat = 'top', selected = null, dir = 2, anim = 'idle', zoom = 1, view = 'full', compare = false, raf = 0, t0 = 0;

  const isStore = () => mode === 'store';
  const clone = (o) => W.cleanOutfit(JSON.parse(JSON.stringify(o)));
  function open(m = 'home') {
    mode = m; preview = clone(state.outfit); selected = null; cat = 'top'; dir = 2; anim = 'idle'; view = 'full'; zoom = 1; zoomIn.value = '1'; viewB.textContent = 'CLOSE-UP';
    title.textContent = isStore() ? '👕 BOUTIQUE · TRY ON & BUY' : '👕 STYLE STUDIO';
    root0.hidden = false; try { root.releaseControls?.(); } catch { /* n/a */ }
    renderAll(); cancelAnimationFrame(raf); t0 = performance.now(); raf = requestAnimationFrame(loop);
  }
  function close() { root0.hidden = true; cancelAnimationFrame(raf); }
  closeB.onclick = close;
  addEventListener('keydown', (e) => { if (root0.hidden) return; if (e.key === 'Escape') { close(); e.stopImmediatePropagation(); } else if (e.key === 'ArrowLeft') { rotate(-1); e.preventDefault(); } else if (e.key === 'ArrowRight') { rotate(1); e.preventDefault(); } }, true);

  // ---- stage controls ----
  const btn = (cls, txt, fn) => { const b = el('button', { className: cls, type: 'button' }, txt); b.onclick = fn; return b; };
  const dirLbl = el('span', { className: 'dirlbl' }, 'S');
  function rotate(d) { dir = (dir + d + 8) % 8; dirLbl.textContent = DIRS[dir]; }
  const zoomIn = el('input', { type: 'range', min: '1', max: '4', step: '0.1', value: String(zoom), ariaLabel: 'Zoom' }); zoomIn.oninput = () => { zoom = Number(zoomIn.value); };
  bar1.append(btn('rot', '◀', () => rotate(1)), dirLbl, btn('rot', '▶', () => rotate(-1)), el('span', { style: 'font-size:14px' }, '🔍'), zoomIn);
  const animBtns = {}; for (const a of ['idle', 'walk', 'run']) { animBtns[a] = btn('chip', a.toUpperCase(), () => { anim = a; for (const k in animBtns) animBtns[k].classList.toggle('on', k === anim); }); bar2.append(animBtns[a]); }
  const viewB = btn('chip', 'CLOSE-UP', () => { view = view === 'full' ? 'close' : 'full'; viewB.textContent = view === 'full' ? 'CLOSE-UP' : 'FULL BODY'; zoom = view === 'close' ? 2.6 : 1; zoomIn.value = String(zoom); });
  const cmpB = el('button', { className: 'chip', type: 'button' }, 'HOLD: COMPARE'); const cmpOn = (v) => (e) => { e.preventDefault(); compare = v; cmpB.classList.toggle('on', v); };
  cmpB.addEventListener('pointerdown', cmpOn(true)); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) cmpB.addEventListener(ev, cmpOn(false));
  bar2.append(viewB, cmpB); animBtns.idle.classList.add('on');
  // swipe to rotate, pinch to zoom
  const ptrs = new Map(); let swipeX = null, pinch0 = 0, zoom0 = zoom;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture?.(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 1) swipeX = e.clientX; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = zoom; } });
  cv.addEventListener('pointermove', (e) => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2 && pinch0) { const [a, b] = [...ptrs.values()]; zoom = Math.max(1, Math.min(4, zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0)); zoomIn.value = String(zoom); return; }
    if (swipeX !== null && Math.abs(e.clientX - swipeX) > 34) { rotate(e.clientX > swipeX ? -1 : 1); swipeX = e.clientX; } });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; if (!ptrs.size) swipeX = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.max(1, Math.min(4, zoom - Math.sign(e.deltaY) * 0.2)); zoomIn.value = String(zoom); }, { passive: false });

  function loop(now) {
    if (root0.hidden) return;
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const x = sctx; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
    // backdrop: studio wall, floor, spotlight, turntable
    const gw = x.createLinearGradient(0, 0, 0, h); gw.addColorStop(0, '#1b2433'); gw.addColorStop(0.62, '#121a26'); gw.addColorStop(0.63, '#2a3140'); gw.addColorStop(1, '#151a22'); x.fillStyle = gw; x.fillRect(0, 0, w, h);
    const sp = x.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.45, Math.max(w, h) * 0.6); sp.addColorStop(0, '#ffe9b022'); sp.addColorStop(1, '#00000000'); x.fillStyle = sp; x.fillRect(0, 0, w, h);
    const o = compare ? state.outfit : preview, n = { idle: 4, walk: 8, run: 8 }[anim], ms = { idle: 380, walk: 110, run: 80 }[anim], f = Math.floor((now - t0) / ms) % n;
    // zoom 1 = whole body fits (head top ~26 world px above the anchor, feet 14 below); zooming slides the focus up to the face
    const fit = (r.height * 0.84) / 42, sc = Math.max(1, Math.round(fit * zoom * dpr * 2) / 2), C = root.NightshiftCharacters, frame = C.frame(o, dir, anim, f, Math.max(2, Math.min(18, 2 * Math.round(sc / 2))));
    const k = Math.min(1, (zoom - 1) / 1.6), focus = -6 - 11 * k, cx = w / 2, ancY = h * 0.5 - focus * sc, footY = ancY + 14 * sc;
    x.fillStyle = '#ffd9701a'; x.beginPath(); x.ellipse(cx, footY, 20 * sc, 5 * sc, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#00000066'; x.beginPath(); x.ellipse(cx + sc, footY + 0.5 * sc, 9 * sc, 3 * sc, 0, 0, Math.PI * 2); x.fill();
    x.imageSmoothingEnabled = false; x.drawImage(frame, cx - C.CELL.ax * sc, ancY - C.CELL.ay * sc, C.CELL.w * sc, C.CELL.h * sc);
    if (compare) { x.fillStyle = '#ffd970'; x.font = `800 ${12 * dpr}px system-ui`; x.textAlign = 'center'; x.fillText('WHAT YOU\'RE WEARING', cx, 18 * dpr); }
    raf = requestAnimationFrame(loop);
  }

  // ---- categories + items ----
  const ALL = [...W.CATS, { id: 'outfits', name: 'Outfits', icon: '💾' }];
  function renderCats() { cats.textContent = ''; for (const c of ALL) { const b = btn(cat === c.id ? 'on' : '', `${c.icon} ${c.name}`, () => { cat = c.id; selected = null; renderAll(); }); cats.append(b); } }
  const thumbs = new Map();
  function thumb(o, d = 2, scale = 2) { const k = W.keyOf(o) + d + scale; let c = thumbs.get(k); if (c) return c; const fr = root.NightshiftCharacters.frame(o, d, 'idle', 0, scale); c = fr; thumbs.set(k, c); if (thumbs.size > 300) thumbs.delete(thumbs.keys().next().value); return c; }
  // the cell has headroom for hats/guns; tiles show just the character (x 7..37, y 6..52 of 44x56)
  const crop = (src) => { const k = src.width / 44, c = el('canvas', { width: Math.round(30 * k), height: Math.round(46 * k) }); c.getContext('2d').drawImage(src, -7 * k, -6 * k); return c; };
  const copyCanvas = (src, w, h) => { const c = el('canvas', { width: src.width, height: src.height }); c.getContext('2d').drawImage(src, 0, 0); if (w) c.style.width = w + 'px'; if (h) c.style.height = h + 'px'; return c; };
  function tile(label, o, onClick, opts = {}) {
    const d = el('div', { className: 'it' + (opts.sel ? ' sel' : '') + (opts.wear ? ' wear' : '') + (opts.lock ? ' lock' : '') }); d.append(crop(thumb(o, opts.dir ?? 2)), el('div', {}, label));
    if (opts.rarity) { const r = el('div', { className: 'rar' }); r.style.background = W.RARITY[opts.rarity].color; d.append(r); }
    if (opts.price) d.append(el('div', { className: 'pr' }, opts.price)); d.onclick = onClick; return d;
  }
  const withPiece = (slot, piece) => { const o = clone(preview); o[slot] = piece; if (slot === 'top' && piece) o.outer = null; if (slot === 'head' && piece) { const ow = o.outer; if (ow?.hood) o.outer = { ...ow, hood: false }; } return o; };
  const viewDir = (slot) => (slot === 'bag' ? 6 : 2); // backpacks read best from behind
  function renderItems() {
    scroll.textContent = '';
    if (cat === 'outfits') return renderOutfits();
    const grid = el('div', { className: 'grid' });
    if (cat === 'body') {
      scroll.append(el('h4', {}, 'SKIN TONE')); const sw = el('div', { className: 'sw' }); W.SKINS.forEach((s, i) => { const b = btn(preview.skin === i ? 'on' : '', '', () => { preview.skin = i; changed(); }); b.style.background = s; sw.append(b); }); scroll.append(sw);
      scroll.append(el('h4', {}, 'BUILD')); for (const bd of W.BUILDS) grid.append(tile(bd.name, { ...clone(preview), build: bd.id }, () => { preview.build = bd.id; changed(); }, { sel: preview.build === bd.id })); scroll.append(grid); return;
    }
    if (cat === 'hair') {
      scroll.append(el('h4', {}, 'HAIR COLOUR')); const sw = el('div', { className: 'sw' }); W.HAIR_COLORS.forEach((s, i) => { const b = btn(preview.hairColor === i ? 'on' : '', '', () => { preview.hairColor = i; changed(); }); b.style.background = s; sw.append(b); }); scroll.append(sw);
      scroll.append(el('h4', {}, 'HAIRSTYLE')); for (const [id, name] of W.HAIRSTYLES) grid.append(tile(name, { ...withPiece('head', null), hair: id }, () => { preview.hair = id; changed(); }, { sel: preview.hair === id })); scroll.append(grid);
      scroll.append(el('h4', {}, 'FACIAL HAIR')); const g2 = el('div', { className: 'grid' }); for (const [id, name] of W.FACIAL) g2.append(tile(name, { ...withPiece('face', null), facial: id }, () => { preview.facial = id; changed(); }, { sel: preview.facial === id })); scroll.append(g2); return;
    }
    const meta = W.CATS.find((c) => c.id === cat);
    if (meta.optional) grid.append(tile('None', withPiece(cat, null), () => { preview[cat] = null; selected = null; changed(); }, { sel: !preview[cat] }));
    for (const it of W.ITEMS.filter((i) => i.cat === cat)) {
      const cur = preview[cat]?.id === it.id ? preview[cat] : { id: it.id, color: 0 }, own = W.owns(state, it.id);
      grid.append(tile(it.name, withPiece(cat, cur), () => { if (preview[cat]?.id !== it.id) preview[cat] = W.cleanOutfit({ ...preview, [cat]: { id: it.id, color: 0 } })[cat]; selected = it.id; changed(); }, { dir: viewDir(cat), sel: preview[cat]?.id === it.id, wear: state.outfit[cat]?.id === it.id, lock: !own, rarity: it.rarity, price: own ? '' : money(it.price) }));
    }
    scroll.append(grid);
  }
  function renderOutfits() {
    scroll.append(el('h4', {}, 'SAVED OUTFITS'));
    const g = el('div', { className: 'outf' });
    for (let i = 0; i < 5; i++) {
      const sv = state.saved[i], d = el('div', { className: 'o' });
      if (sv) { d.append(copyCanvas(thumb(sv.outfit), 64, 82), el('b', { style: 'font-size:11px' }, sv.name)); const a = el('div', { className: 'acts' }); a.append(btn('alt', 'TRY', () => { preview = clone(sv.outfit); changed(); }), btn('alt', 'SAVE HERE', () => { saveSlot(i); })); d.append(a); }
      else { d.append(el('div', { style: 'height:82px;display:flex;align-items:center;color:#7d8796' }, 'Empty slot'), btn('alt', 'SAVE CURRENT', () => saveSlot(i))); }
      g.append(d);
    }
    scroll.append(g, el('h4', {}, 'LOOKS (try on, buy the missing pieces at a boutique)'));
    const g2 = el('div', { className: 'outf' });
    for (const L of W.LOOKS) { const o = W.cleanOutfit({ ...preview, ...L.outfit, skin: preview.skin, build: preview.build, hair: preview.hair, hairColor: preview.hairColor, facial: preview.facial }), miss = W.missing(state, o); const d = el('div', { className: 'o' }); d.append(copyCanvas(thumb(o), 64, 82), el('b', { style: 'font-size:11px' }, L.name), el('div', { style: 'font-size:10px;color:#a9b8ca' }, miss.length ? `${miss.length} new · ${money(W.costOf(miss))}` : 'All owned')); d.append(btn('alt', 'TRY ON', () => { preview = o; changed(); })); g2.append(d); }
    scroll.append(g2);
  }
  function saveSlot(i) { const name = (root.prompt?.('Name this outfit', state.saved[i]?.name || `Outfit ${i + 1}`) ?? `Outfit ${i + 1}`) || `Outfit ${i + 1}`; const keep = state.outfit; state.outfit = W.cleanOutfit(preview); W.saveOutfit(state, i, name); state.outfit = keep; persist(); say(`💾 Saved "${name}"`); renderItems(); }

  // ---- item detail ----
  function closeUp(o, slot) {
    const C = root.NightshiftCharacters, src = C.frame(slot === 'top' && o.outer ? { ...o, outer: null } : o, slot === 'bag' ? 6 : dir === 6 ? 2 : dir, 'idle', 0, 6), c = el('canvas', { width: 192, height: 192 }), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const focus = { head: -20, face: -19, hair: -19, top: -6, outer: -6, jewelry: -9, gloves: 0, bag: -6, bottom: 6, shoes: 13, body: -4 }[slot] ?? -4;
    const s = 6, sx = (C.CELL.ax) * s - 96, sy = (C.CELL.ay + focus) * s - 96; x.fillStyle = '#1a2230'; x.fillRect(0, 0, 192, 192); x.drawImage(src, sx, sy, 192, 192, 0, 0, 192, 192); return c;
  }
  function renderDetail() {
    det.textContent = '';
    const slot = cat, p = W.SLOTS.includes(slot) ? preview[slot] : null, it = p ? W.ITEM[p.id] : null;
    det.append(closeUp(preview, slot)); const m = el('div', { className: 'm' }); det.append(m);
    if (!it) { const meta = ALL.find((c) => c.id === cat); m.append(el('b', {}, meta.name), el('div', { className: 'ds' }, cat === 'outfits' ? 'Save up to five looks and switch between them any time. Try curated looks on and buy the missing pieces at a boutique.' : cat === 'body' || cat === 'hair' ? 'Free to change any time.' : 'Nothing equipped in this slot.')); return; }
    const own = W.owns(state, it.id), wearing = state.outfit[slot]?.id === it.id, rar = W.RARITY[it.rarity];
    m.append(el('b', {}, it.name)); const tg = el('div', { className: 'tg' }, `${rar.name.toUpperCase()} · ${W.CATS.find((c) => c.id === slot).name.toUpperCase()}${own ? ` · CONDITION ${state.cond[it.id] ?? 100}%` : ''}${wearing ? ' · EQUIPPED' : ''}`); tg.style.color = rar.color; m.append(tg, el('div', { className: 'ds' }, it.desc));
    const sw = el('div', { className: 'sw' }); it.colors.forEach((col, i) => { const b = btn(p.color === i ? 'on' : '', '', () => { preview[slot] = { ...p, color: i }; changed(); }); b.style.background = col; b.title = 'Colour ' + (i + 1); sw.append(b); }); m.append(sw);
    const acts = el('div', { className: 'acts' }), o = it.opts;
    const tog = (key, on, off) => acts.append(btn('alt', p[key] ? on : off, () => { preview[slot] = { ...p, [key]: !p[key] }; changed(); }));
    if (o.hood) tog('hood', 'HOOD: UP', 'HOOD: DOWN'); if (o.open) tog('open', 'OPEN', 'CLOSED'); if (o.tuck) tog('tucked', 'TUCKED', 'UNTUCKED'); if (o.back) tog('back', 'BACKWARDS', 'FORWARD'); if (o.roll) tog('rolled', 'SLEEVES ROLLED', 'SLEEVES DOWN');
    if (o.pattern) acts.append(btn('alt', `PATTERN: ${o.pattern[p.pattern || 0].toUpperCase()}`, () => { preview[slot] = { ...p, pattern: ((p.pattern || 0) + 1) % o.pattern.length }; changed(); }));
    if (own) acts.append(btn('go', wearing && sameSlot(slot) ? 'WEARING ✓' : 'WEAR THIS', () => { state.outfit[slot] = W.cleanOutfit({ ...state.outfit, [slot]: preview[slot] })[slot]; persist(); gameSave(); say(`👕 ${it.name} on`); renderAll(); }));
    else if (isStore()) acts.append(btn('buy', `BUY · ${money(it.price)}`, () => buyIds([it.id])));
    else acts.append(el('span', { className: 'ds', style: 'align-self:center' }, `Preview only · ${money(it.price)} at any 👕 CLOTHING boutique`));
    m.append(acts);
  }
  const sameSlot = (slot) => JSON.stringify(state.outfit[slot]) === JSON.stringify(W.cleanOutfit({ ...state.outfit, [slot]: preview[slot] })[slot]);
  function buyIds(ids) { const r = W.buy(state, P() || { cash: 0 }, ids); if (!r.ok) { say(r.reason); return; } try { root.NightshiftLedger?.tag('other'); } catch { /* optional */ } persist(); gameSave(); say(`🛍️ Bought ${r.items.map((i) => i.name).join(', ')} · ${money(r.price)}`); try { root.NightshiftSkills?.gain('charisma', Math.min(80, Math.round(r.price / 20)), 'clothes'); } catch { /* optional */ } renderAll(); }
  // ---- footer: apply / cart ----
  function renderFoot() {
    foot.textContent = ''; const miss = W.missing(state, preview), changedLook = W.keyOf(preview) !== W.keyOf(state.outfit);
    const note = el('div', { className: 's' }, miss.length ? `${miss.length} new piece${miss.length > 1 ? 's' : ''} · ${money(W.costOf(miss))}${isStore() ? '' : ' at a boutique'}` : changedLook ? 'Everything here is yours.' : 'This is what you\'re wearing.'); if (miss.length) note.title = miss.map((i) => i.name).join(', '); foot.append(note);
    if (miss.length && isStore()) foot.append(btn('buy', `BUY ${miss.length > 1 ? 'ALL' : 'IT'} · ${money(W.costOf(miss))}`, () => buyIds(miss.map((i) => i.id))));
    foot.append(btn('alt', 'RESET', () => { preview = clone(state.outfit); changed(); }));
    foot.append(btn('go', miss.length ? 'WEAR WHAT I OWN' : 'WEAR THIS LOOK', () => { const skipped = W.wear(state, preview); persist(); gameSave(); say(skipped.length ? `👕 Wearing it · ${skipped.length} piece${skipped.length > 1 ? 's' : ''} left on the rack (not yours yet)` : '👕 Looking sharp'); preview = clone(state.outfit); renderAll(); }));
  }
  function changed() { renderItems(); renderDetail(); renderFoot(); }
  function renderAll() { renderCats(); changed(); }

  // ---------------- world hooks ----------------
  // apartment wardrobe → the studio (instead of the old colour picker)
  const hookHome = setInterval(() => { const H = root.NightshiftHome; if (!H || typeof H.use !== 'function' || H.__studio) return; const use = H.use, inter = H.interaction; H.use = function () { const t = inter?.call(H); if (t?.kind === 'wardrobe') { open('home'); return true; } return use.apply(this, arguments); }; H.__studio = true; clearInterval(hookHome); }, 500);
  // a 👕 BOUTIQUE point at every CLOTHING building
  let shops = null;
  const E = root.NightshiftEncounters, baseLocs = E?.locations;
  // beside the shop door, nudged sideways so the prompt never stacks on another one (gun shop, supply bags...)
  const shopPoints = () => {
    if (shops) return shops; let others = []; try { others = baseLocs?.call(E) || []; } catch { /* not ready */ }
    shops = B().filter((b) => b && b.name === 'CLOTHING').map((b, i) => { const y = b.y + b.h + 12; let best = null;
      for (const dx of [58, -58, 110, -110, 0]) { const x = b.x + b.w / 2 + dx, d = Math.min(999, ...others.map((l) => Math.hypot(l.x - x, l.y - y))); if (!best || d > best.d) best = { x, d }; if (d > 60) break; }
      return { id: 'boutique-' + i, x: best.x, y }; });
    return shops;
  };
  if (E && !E.__studio) {
    const locs = baseLocs, use = E.use;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 ? [...list, ...shopPoints().map((s) => ({ id: s.id, type: 'boutique', x: s.x, y: s.y, ready: true, color: '#ff8ad8', label: '👕 BOUTIQUE', action: 'SHOP', hint: 'Try on and buy clothes' }))] : list; };
    E.use = function (id) { if (String(id).startsWith('boutique-')) { open('store'); return true; } return use.apply(this, arguments); };
    E.__studio = true;
  }

  root.NightshiftWardrobe = Object.freeze({ outfit: () => state.outfit, get state() { return state; }, open, close, save: persist, paused: () => !root0.hidden, shops: shopPoints });
})(typeof globalThis !== 'undefined' ? globalThis : this);
