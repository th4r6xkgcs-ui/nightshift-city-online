/* Rusty's Chop Shop (Claude-owned). Requires chop-data.js; uses supply.js for parts and vehicles.js cars.
 * Lives in the parking lot under the scrapyard (Southside, bottom-left of the map). Steal any locked car, drive it
 * into the hazard-striped bay, hop out and talk to Rusty: CHOP for cash, STRIP for crafting parts, or RE-VIN to keep it.
 * A chopped car vanishes from the bay and turns up again somewhere else in the city later (as a fresh locked car).
 * Pixel art is drawn in world space every frame: lift, toolbox, engine on a stand, tyres, Rusty himself, grinder
 * sparks while a car is on the lift, and a work lamp at night.
 * Save: nightshift-chop-v1. API: NightshiftChop.{state, open, BAY, RUSTY, carInBay} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const D = root.NightshiftChopData;
  if (!D) return;
  const KEY = 'nightshift-chop-v1';
  let state = D.clean({});
  try { state = D.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const CARS = () => { try { return cars; } catch { return []; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const O = (c, col, x, y, rx, ry) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); c.fill(); };
  const C = (c, col, x, y, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const light = (x, y, w = 8, h = 6) => { try { const L = root.NightshiftWorld?.litWindows?.(); if (L && L.length < 160) L.push({ x, y, w, h }); } catch { /* optional */ } };
  const darkness = () => { try { return root.NightshiftEnvironment?.darkness?.() ?? 0; } catch { return 0; } };
  const hour = () => (root.NightshiftEnvironment?.state?.minute ?? 720) / 60;
  const night = () => { const h = hour(); return h >= 19.5 || h < 6; };

  const BAY = { x: 300, y: 1640, r: 78 }, RUSTY = { x: 176, y: 1646 };
  const modelOf = (car) => car?.model || root.NightshiftVehicles?.model?.(car)?.name || 'SEDAN';
  const nameOf = (car) => root.NightshiftCarsData?.fromModel(modelOf(car))?.name || modelOf(car).toLowerCase();
  function carInBay() { const p = P(); return CARS().find((c) => c && c.stolen && !c.owned && p?.car !== c && Math.hypot(c.x - BAY.x, c.y - BAY.y) < BAY.r) || null; }

  // --- respawn a chopped car somewhere else, as a fresh locked car parked on a city road
  const XS = [440, 880, 1320, 1760], YS = [340, 680, 1020, 1360];
  function respawn(car) {
    if (car?.cx && root.NightshiftCars?.retire?.(car)) return true; // collection models don't come back
    const p = P(), list = CARS();
    for (let i = 0; i < 40; i++) {
      const vertical = Math.random() < 0.5, side = Math.random() < 0.5 ? -22 : 22;
      const x = vertical ? XS[(Math.random() * XS.length) | 0] + side : 120 + Math.random() * 1960;
      const y = vertical ? 120 + Math.random() * 1460 : YS[(Math.random() * YS.length) | 0] + side;
      if (vertical && YS.some((q) => Math.abs(q - y) < 70)) continue;
      if (!vertical && XS.some((q) => Math.abs(q - x) < 70)) continue;
      if (p && Math.hypot(p.x - x, p.y - y) < 600) continue;
      if (list.some((o) => o !== car && Math.hypot(o.x - x, o.y - y) < 80)) continue;
      Object.assign(car, { x, y, angle: vertical ? (side < 0 ? -Math.PI / 2 : Math.PI / 2) : (side < 0 ? Math.PI : 0), speed: 0, stolen: false, owned: false, owner: false, condition: 70 + Math.round(Math.random() * 30), fuel: 40 + Math.round(Math.random() * 60) });
      return true;
    }
    Object.assign(car, { x: 440 + 22, y: 520, angle: Math.PI / 2, speed: 0, stolen: false, owned: false, owner: false, condition: 90 });
    return true;
  }

  // ---------------- panel ----------------
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const pnl = el('div', { id: 'chPanel', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Chop shop' }); document.body.append(pnl);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pnl.hidden) { pnl.hidden = true; e.stopImmediatePropagation(); } }, true);
  const btn = (cls, txt, fn, dis) => { const x = el('button', { className: cls, type: 'button', disabled: !!dis }, txt); x.onclick = fn; return x; };
  const FAM = { red: '🔴', blue: '🔵', green: '🟢', yellow: '🟡', white: '⚪', black: '⚫' };
  function partsLine(items) {
    const wrap = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:4px' });
    for (const [id, n] of Object.entries(items)) {
      const chip = el('span', { style: 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 4px;border-radius:999px;background:#ffffff0d;border:1px solid #ffffff1a;font:700 11px var(--body,system-ui)' });
      const ic = root.NightshiftSupply?.matIcon?.(id, 16); if (ic) chip.append(ic); chip.append(document.createTextNode(`${n} ${root.NightshiftSupplyData?.MATERIALS?.[id]?.name || id}`)); wrap.append(chip);
    }
    return wrap;
  }
  function carCanvas(car) {
    if (root.NightshiftCarsData?.fromModel(car.model) && root.NightshiftCars) { const cv = root.NightshiftCars.portrait(root.NightshiftCarsData.fromModel(car.model).id, car.color, 120, 70); return cv; }
    const cv = el('canvas', { width: 120, height: 70 }); cv.style.cssText = 'width:120px;height:70px;border-radius:12px;background:radial-gradient(#3a3f47,#15181d);flex:none';
    try {
      // A clean top-down pixel portrait in the car's paint.
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.translate(60, 35);
      const col = car.color || '#888', sh = (hex, k) => { const m = /^#?(..)(..)(..)$/.exec(hex) || [0, '88', '88', '88']; return '#' + [1, 2, 3].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(m[i], 16) * k)))).map((v) => v.toString(16).padStart(2, '0')).join(''); };
      O(x, '#00000066', 2, 4, 40, 16);
      for (const [wx, wy] of [[-26, -17], [14, -17], [-26, 13], [14, 13]]) { R(x, '#0d0d0d', wx, wy, 12, 4); R(x, '#3a3a3a', wx + 2, wy + 1, 8, 1); }
      R(x, sh(col, 0.7), -36, -14, 72, 28); R(x, col, -35, -15, 70, 28); R(x, sh(col, 1.25), -35, -15, 70, 3); R(x, sh(col, 0.75), -35, 10, 70, 3);
      R(x, sh(col, 0.85), 14, -12, 1, 22); R(x, sh(col, 0.85), -26, -12, 1, 22); // hood + trunk seams
      R(x, '#0b1220', -14, -12, 26, 22); R(x, '#5f8fb0', 6, -11, 6, 20); R(x, '#8fc0dc', 7, -10, 2, 8); R(x, '#4a7090', -14, -11, 4, 20); // glass
      R(x, sh(col, 1.1), -9, -10, 14, 18); R(x, sh(col, 1.35), -8, -9, 12, 2); // roof
      R(x, sh(col, 0.6), 4, -17, 3, 3); R(x, sh(col, 0.6), 4, 12, 3, 3); // mirrors
      R(x, '#fff3c4', 33, -13, 3, 6); R(x, '#fff3c4', 33, 5, 3, 6); R(x, '#ffffff', 34, -12, 1, 2); R(x, '#ffffff', 34, 6, 1, 2);
      R(x, '#c0473f', -36, -13, 2, 6); R(x, '#c0473f', -36, 5, 2, 6); R(x, '#ff7a6a', -36, -12, 1, 2);
      R(x, '#c9d1d6', 35, -4, 2, 6); R(x, '#d8b24a', -36, -2, 2, 4); // grille + plate
      if ((car.condition ?? 100) < 70) { R(x, '#3a3f45', -20, 4, 8, 2); R(x, '#3a3f45', 20, -9, 5, 3); }
      if ((car.condition ?? 100) < 40) { R(x, '#2a2d30', -4, 8, 10, 3); R(x, '#5a3a2a', 24, 2, 4, 4); }
    } catch { /* cosmetic */ }
    return cv;
  }
  function open() {
    try { root.releaseControls?.(); } catch { /* n/a */ }
    const p = P(), car = carInBay(), now = Date.now(), hot = D.hotList(now), price = mod('dealing.price');
    pnl.hidden = false; pnl.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { pnl.hidden = true; };
    top.append(el('h2', {}, "🔧 RUSTY'S CHOP SHOP"), x); pnl.append(top);
    pnl.append(el('div', { className: 'sub' }, '"Bring me something hot. Park it on the lift, I\'ll do the rest." · Cash ' + money(p?.cash || 0)));
    const hl = el('div', { style: 'display:flex;align-items:center;gap:10px;padding:10px;border-radius:14px;background:linear-gradient(90deg,#ff8a3a22,#ffffff05);border:1px solid #ff8a3a55;margin:8px 0' });
    hl.append(el('div', { style: 'font-size:26px' }, '🔥'));
    const t = el('div', { style: 'flex:1' }); t.append(el('b', { style: 'font:800 13px var(--disp,system-ui);letter-spacing:.04em;color:#ffb36b' }, `HOT LIST · ${FAM[hot.color]} ${hot.color.toUpperCase()} ${hot.model}`), el('div', { style: 'color:#c9b9a8;font-size:11px' }, `Exact match pays ×2 · right model ×1.35 · right colour ×1.15 · changes in ${Math.max(1, Math.ceil((hot.until - now) / 60000))} min`)); hl.append(t); pnl.append(hl);
    if (!car) {
      pnl.append(el('h3', {}, 'HOW IT WORKS'));
      for (const [i, s] of [['🔓', 'Steal a car: stand next to any locked car and hold USE until the lock pops (cops notice).'], ['🚗', 'Drive it here, to the striped bay behind the scrapyard, and hop out.'], ['🔧', 'Talk to Rusty: chop it for cash, strip it for parts, or re-VIN it and keep it.']]) pnl.append(el('div', { className: 'sub', style: 'display:flex;gap:8px;align-items:flex-start;margin:4px 0' }, `${i}  ${s}`));
      const wait = D.liftWait(state, now); pnl.append(el('div', { className: 'sub', style: 'margin-top:8px;color:' + (wait ? '#ff9a7a' : '#7cdeb5') }, wait ? `Lift's full right now · free again in ${Math.ceil(wait / 60000)} min` : `Lift is free · takes ${D.LIFT.cars} cars every ${D.LIFT.windowMs / 60000} min`));
      pnl.append(el('h3', {}, 'YOUR RECORD'), el('div', { className: 'sub' }, `${state.stats.chopped} chopped · ${state.stats.stripped} stripped · ${state.stats.revin} re-VINned · ${state.stats.hot} hot-list hits · ${money(state.stats.earned)} earned`));
      return;
    }
    const model = modelOf(car), v = D.value(model, car.condition, car.color, now, price), mult = D.hotMult(model, car.color, now);
    const card = el('div', { style: 'display:flex;gap:12px;align-items:center;padding:10px;border-radius:14px;background:#ffffff07;border:1px solid #ffffff14;margin-bottom:8px' });
    card.append(carCanvas(car));
    const info = el('div', { style: 'flex:1' }); info.append(el('b', { style: 'font:800 15px var(--disp,system-ui)' }, `${FAM[D.family(car.color)]} ${root.NightshiftCarsData?.fromModel(model)?.name || model}${mult > 1 ? ' · 🔥 ×' + mult : ''}`), el('div', { style: 'color:#a9b8ca;font-size:12px' }, `Body ${Math.round(car.condition)}% · fuel ${Math.round(car.fuel ?? 0)}% · ${car.id}`)); card.append(info); pnl.append(card);
    const full = !D.liftFree(state, now), wait = Math.ceil(D.liftWait(state, now) / 60000);
    const opt = (icon, title, line, extra, b) => { const r = el('div', { style: 'display:flex;align-items:center;gap:10px;padding:10px;border-radius:14px;background:#ffffff07;border:1px solid #ffffff12;margin-bottom:6px' }); r.append(el('div', { style: 'font-size:26px;width:36px;text-align:center' }, icon)); const tt = el('div', { style: 'flex:1' }); tt.append(el('b', { style: 'font:800 13px var(--disp,system-ui)' }, title), el('div', { style: 'color:#a9b8ca;font-size:11px' }, line)); if (extra) tt.append(extra); r.append(tt, b); pnl.append(r); };
    const preview = D.strip(model, car.condition, 1);
    opt('💵', 'CHOP IT', full ? `Lift's full · ${wait} min` : 'Rusty cuts it up and pays cash. Clean cars and hot-list cars pay best.', null, btn('go', money(v), () => doDeal(car, 'chop'), full));
    opt('🔩', 'STRIP FOR PARTS', full ? `Lift's full · ${wait} min` : `About this much, plus ${money(Math.round(v * 0.3))}:`, partsLine(preview), btn('alt', 'STRIP', () => doDeal(car, 'strip'), full));
    const rp = D.revinPrice(model);
    opt('🪪', 'RE-VIN & KEEP', `Fresh numbers, fresh plates: it's yours for good. (A dealer wants $900.)`, null, btn('alt', money(rp), () => doDeal(car, 'revin'), (p?.cash || 0) < rp));
  }
  function doDeal(car, kind) {
    const p = P(); if (!p || !car) return;
    const r = D.deal(state, p, { model: modelOf(car), condition: car.condition, color: car.color, stolen: car.stolen }, kind, Date.now(), mod('dealing.price'), (Math.random() * 1e9) | 0);
    if (!r.ok) { say(r.reason); open(); return; }
    if (r.keep) { car.stolen = false; car.owned = true; say(`🪪 Re-VINned · the ${nameOf(car)} is yours now${car.cx ? ' · added to 🚗 MY CARS' : ''}`); try { root.NightshiftCars?.adopt?.(car); } catch { /* optional */ } try { root.NightshiftSkills?.gain('driving', 30, 'revin'); } catch { /* optional */ } }
    else {
      let lost = '';
      if (Object.keys(r.items).length) { const got = root.NightshiftSupply?.give?.(r.items); const added = got?.added || r.items, left = Object.entries(r.items).filter(([k, n]) => (added[k] || 0) < n).length; if (left) lost = ' · 🎒 bag full, some parts left behind'; }
      respawn(car);
      try { root.NightshiftSkills?.gain(kind === 'strip' ? 'crafting' : 'dealing', kind === 'strip' ? 30 : 25, 'chop'); } catch { /* optional */ }
      say(kind === 'strip' ? `🔩 Stripped for parts · +${money(r.cash)}${lost}` : `💵 Chopped${r.hot ? ' · 🔥 hot list!' : ''} · +${money(r.cash)}`);
      sparksUntil = performance.now() + 2500;
    }
    persist(); try { root.NightshiftVehicles?.save?.(); } catch { /* optional */ } gameSave(); open();
  }

  // ---------------- encounter hooks ----------------
  const E = root.NightshiftEncounters;
  if (E && !E.__chop) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () {
      const list = locs.apply(this, arguments) || []; const car = carInBay();
      return [...list, { id: 'chop-rusty', type: 'chop', x: RUSTY.x, y: RUSTY.y, ready: true, color: '#ff9a3a', label: car ? '🔧 RUSTY · CAR ON THE LIFT' : "🔧 RUSTY'S CHOP SHOP", action: car ? 'CHOP' : 'RUSTY', hint: car ? 'Chop it, strip it or keep it' : 'Bring a stolen car to the striped bay' }];
    };
    E.use = function (id) { if (id === 'chop-rusty') { open(); return true; } return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawShop(); } catch { /* cosmetic */ } return r; };
    E.__chop = true;
  }
  // Tip when you first get into a stolen car.
  let lastCar = null;
  setInterval(() => { const p = P(); const c = p?.car; if (c && c !== lastCar && c.stolen && !c.owned) { const hot = D.hotList(); say(`🔧 Hot car! Rusty's chop shop (behind the scrapyard, Southside) pays for it${modelOf(c) === hot.model ? ' · it\'s on his hot list!' : ''}`); } lastCar = c || null; }, 700);

  // ---------------- art ----------------
  let sparksUntil = 0; const sparks = [];
  function drawShop() {
    const c = G(), p = P(); if (!c || !p) return;
    if (Math.abs(p.x - BAY.x) > 760 || Math.abs(p.y - BAY.y) > 520) return;
    const t = performance.now() / 1000, car = carInBay(), dark = darkness(), lit = night();
    // concrete pad with oil stains and drain
    R(c, '#3b3f44', 104, 1606, 274, 66); R(c, '#454a50', 104, 1606, 274, 2);
    for (const [ox, oy, rx, ry] of [[150, 1660, 14, 5], [312, 1652, 18, 6], [226, 1628, 9, 3], [355, 1622, 7, 3]]) { O(c, '#23262a', ox, oy, rx, ry); O(c, '#2c3035', ox - 2, oy - 1, rx * 0.5, ry * 0.5); }
    R(c, '#25282c', 262, 1666, 22, 4); for (let i = 0; i < 5; i++) R(c, '#3b3f44', 264 + i * 4, 1667, 2, 2);
    // hazard-striped bay
    const bx = 248, by = 1609, bw = 104, bh = 62;
    for (let i = 0; i < bw; i += 8) { R(c, (i / 8) % 2 ? '#e8b923' : '#1b1b1b', bx + i, by, 8, 3); R(c, (i / 8) % 2 ? '#1b1b1b' : '#e8b923', bx + i, by + bh - 3, 8, 3); }
    for (let i = 0; i < bh; i += 8) { R(c, (i / 8) % 2 ? '#e8b923' : '#1b1b1b', bx, by + i, 3, 8); R(c, (i / 8) % 2 ? '#1b1b1b' : '#e8b923', bx + bw - 3, by + i, 3, 8); }
    // two-post lift
    for (const lx of [bx + 6, bx + bw - 14]) { R(c, '#00000055', lx + 2, by + 6, 10, 24); R(c, '#d8a21c', lx, by + 3, 8, 26); R(c, '#f3c84a', lx, by + 3, 2, 26); R(c, '#8a6510', lx + 6, by + 3, 2, 26); R(c, '#2a2a2a', lx + 1, by + 29, 6, 3); R(c, '#c0473f', lx + 2, by + 6, 4, 3); }
    R(c, '#6f7880', bx + 14, by + 14, 20, 3); R(c, '#6f7880', bx + bw - 34, by + 14, 20, 3); R(c, '#6f7880', bx + 14, by + 40, 20, 3); R(c, '#6f7880', bx + bw - 34, by + 40, 20, 3);
    if (!car) { c.save(); c.globalAlpha = 0.35 + 0.2 * Math.sin(t * 2.5); c.fillStyle = '#e8b923'; c.font = 'bold 9px system-ui'; c.textAlign = 'center'; c.fillText('PARK HOT CARS HERE', bx + bw / 2, by + bh / 2 + 3); c.restore(); }
    // left workshop corner: toolbox, engine on stand, welder, tyres, workbench
    R(c, '#00000055', 114, 1612, 26, 18); R(c, '#b3322b', 112, 1609, 26, 18); R(c, '#d24a3f', 112, 1609, 26, 3); for (let k = 0; k < 4; k++) { R(c, '#8a2420', 113, 1613 + k * 3.5, 24, 1); R(c, '#cfd6db', 122, 1614 + k * 3.5, 6, 1); } R(c, '#222', 113, 1627, 3, 2); R(c, '#222', 134, 1627, 3, 2);
    // engine block on a stand
    R(c, '#444a50', 146, 1626, 2, 12); R(c, '#444a50', 160, 1626, 2, 12); R(c, '#2b2f33', 143, 1636, 22, 2);
    R(c, '#00000055', 145, 1617, 20, 12); R(c, '#5b6168', 143, 1614, 20, 12); R(c, '#7d858c', 143, 1614, 20, 2); for (let k = 0; k < 4; k++) C(c, '#3a3f45', 147 + k * 4.5, 1619, 1.6); R(c, '#c0473f', 160, 1616, 3, 3); R(c, '#2b2f33', 145, 1624, 16, 2);
    // gas bottles + welder
    for (const [gx, col] of [[200, '#2f6f3a'], [207, '#7a2d2d']]) { R(c, '#00000055', gx + 1, 1611, 6, 16); R(c, col, gx, 1608, 6, 16); R(c, '#cfd6db', gx + 1, 1606, 4, 3); R(c, '#ffffff33', gx, 1608, 2, 16); }
    R(c, '#2b3a5a', 214, 1614, 14, 11); R(c, '#3d5584', 214, 1614, 14, 3); C(c, '#ffd23a', 218, 1620, 1.5); C(c, '#7cdeb5', 223, 1620, 1.5);
    // tyre stacks
    for (const [tx, ty, n] of [[124, 1650, 3], [140, 1662, 2], [372, 1612, 3]]) for (let k = 0; k < n; k++) { const yy = ty - k * 4; O(c, '#111', tx, yy, 9, 6); O(c, '#2a2a2a', tx, yy, 5.5, 3.5); O(c, '#0a0a0a', tx, yy, 2.5, 1.5); }
    // workbench with vise against the scrapyard fence
    R(c, '#00000055', 236, 1609, 0, 0); R(c, '#5a3b22', 168, 1606, 26, 8); R(c, '#7a5532', 168, 1606, 26, 2); R(c, '#444a50', 172, 1603, 6, 4); R(c, '#cfd6db', 184, 1604, 8, 1);
    // painted sign board on the fence
    R(c, '#00000066', 254, 1586, 98, 16); R(c, '#2a1d14', 252, 1584, 98, 16); R(c, '#e07a2a', 252, 1584, 98, 2);
    c.save(); c.font = 'bold 9px system-ui'; c.textAlign = 'center'; c.fillStyle = lit ? '#ffb36b' : '#f0a050'; if (lit) { c.shadowColor = '#ff8a3a'; c.shadowBlur = 8; } c.fillText("RUSTY'S CHOP", 301, 1595.5); c.restore();
    R(c, '#5b6168', 256, 1600, 2, 6); R(c, '#5b6168', 344, 1600, 2, 6);
    if (lit) light(301, 1592, 92, 14);
    // work lamp on a pole
    R(c, '#2b2f33', 238, 1608, 2, 30); R(c, '#2b2f33', 238, 1608, 14, 2); R(c, '#cfd6db', 250, 1607, 6, 4);
    if (dark > 0.25) { light(253, 1609, 6, 3); for (const [lx, ly] of [[270, 1606], [300, 1606], [330, 1606], [270, 1630], [300, 1630], [330, 1630], [200, 1620]]) light(lx, ly, 2, 2); c.save(); c.globalCompositeOperation = 'lighter'; const gr = c.createRadialGradient(290, 1640, 4, 290, 1640, 70); gr.addColorStop(0, '#ffe2a855'); gr.addColorStop(1, '#ffe2a800'); c.fillStyle = gr; c.fillRect(220, 1570, 140, 140); c.restore(); }
    // Rusty: grease-stained overalls, cap, wrench; walks over to the lift when a car is on it
    const rx = car ? bx + 4 : RUSTY.x, ry = car ? 1652 : RUSTY.y, bob = Math.sin(t * (car ? 9 : 2)) * (car ? 0.8 : 0.5);
    O(c, '#00000055', rx, ry + 2, 7, 3);
    R(c, '#1d2433', rx - 4, ry - 6, 3, 7); R(c, '#1d2433', rx + 1, ry - 6, 3, 7); R(c, '#111', rx - 5, ry, 4, 2); R(c, '#111', rx + 1, ry, 4, 2);
    R(c, '#2f5d8a', rx - 5, ry - 15 + bob, 10, 10); R(c, '#244a6e', rx - 5, ry - 8 + bob, 10, 3); R(c, '#c99a6b', rx - 7, ry - 14 + bob, 2, 7); R(c, '#c99a6b', rx + 5, ry - 14 + bob, 2, 7);
    R(c, '#3a2a1a', rx - 2, ry - 12 + bob, 3, 2); R(c, '#c99a6b', rx - 3, ry - 21 + bob, 7, 6); R(c, '#e0e0e0', rx - 3, ry - 17 + bob, 7, 2); R(c, '#c0473f', rx - 4, ry - 23 + bob, 9, 3); R(c, '#a0342e', rx + 3, ry - 21 + bob, 4, 1);
    R(c, '#9aa3ab', rx + 6, ry - 10 + bob, 2, 6); R(c, '#cfd6db', rx + 5, ry - 11 + bob, 4, 2);
    // grinder sparks while working on a car (and right after a deal)
    const now = performance.now();
    if (car || now < sparksUntil) for (let i = 0; i < 3; i++) sparks.push({ x: bx + 14, y: 1640, vx: 0.6 + Math.random() * 2.2, vy: -1.6 + Math.random() * 1.8, t0: now, life: 260 + Math.random() * 260 });
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i], a = (now - s.t0) / s.life; if (a >= 1) { sparks.splice(i, 1); continue; } const k = (now - s.t0) / 16; R(c, a < 0.4 ? '#fff2b0' : '#ff9a3a', s.x + s.vx * k, s.y + s.vy * k + 0.04 * k * k, 1.5, 1.5); }
    c.restore(); if (sparks.length > 120) sparks.splice(0, sparks.length - 120);
  }

  root.NightshiftChop = Object.freeze({ get state() { return state; }, open, BAY, RUSTY, carInBay, respawn });
})(typeof globalThis !== 'undefined' ? globalThis : this);
