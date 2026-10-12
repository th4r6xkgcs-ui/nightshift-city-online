/* Night car meet in game (Claude-owned). Requires carmeet-data.js; cars-data.js / cars.js for the collection models.
 * The Westside Courts (west edge, by the West End bus stop) fill up at night: rival show cars with underglow,
 * a crowd with phone flashes, string lights, a DJ, a judges' table. Drive a car you OWN into the ring, stop, and
 * press SHOW: the judges score it (model, kit, tuning, condition, paint) against tonight's five rivals.
 * Top three win cash + a trophy. Each car can show once per night.
 * Save: nightshift-carmeet-v1. API: NightshiftCarMeet.{state, open, ring} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const D = root.NightshiftCarMeetData;
  if (!D) return;
  const KEY = 'nightshift-carmeet-v1';
  let state = D.clean({}), day = 0, lastMin = null;
  try { const raw = JSON.parse(localStorage.getItem(KEY) || '{}'); state = D.clean(raw); day = Number.isSafeInteger(raw?.day) ? raw.day : 0; } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...state, day })); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const minute = () => root.NightshiftEnvironment?.state?.minute ?? 720;
  const open = () => D.isOpen(minute());
  const key = () => D.nightKey(day, minute());
  // our own day counter (the game clock only has minutes)
  setInterval(() => { const m = minute(); if (lastMin !== null && m < lastMin - 600) { day += 1; persist(); } lastMin = m; }, 1000);

  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const O = (c, col, x, y, rx, ry) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
  const C = (c, col, x, y, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const { RING } = D;
  // Where tonight's rivals park (around the court), and the crowd.
  const SPOTS = [[118, 470, 0.5], [338, 470, Math.PI - 0.5], [118, 652, -0.5], [338, 652, Math.PI + 0.5], [228, 700, -Math.PI / 2]];
  const CROWD = [[160, 520], [172, 600], [290, 512], [298, 608], [200, 448], [256, 452], [150, 560], [306, 560], [210, 650], [250, 652], [176, 690], [282, 694]];
  const UNDERGLOW = ['#3ad0ff', '#ff4ad8', '#7cdeb5', '#ffb33a', '#9a5aff'];

  function myCar() { const p = P(), c = p?.car; return c && c.owned ? c : null; }
  function carInfo(c) {
    const tune = root.NightshiftTuning?.state?.cars?.[c.id] || {}, kit = root.NightshiftPets?.state?.kits?.[c.id] || null;
    return { model: c.model || root.NightshiftVehicles?.model?.(c)?.name || 'SEDAN', color: c.color, kit, tune, condition: c.condition ?? 100 };
  }
  const nameOf = (c) => root.NightshiftCarsData?.fromModel?.(c.model)?.name || (c.model || 'Car').toLowerCase();

  // ---------------- panel ----------------
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const pnl = el('div', { id: 'mtPanel', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Car meet' }); document.body.append(pnl);
  document.head.append(el('style', {}, `
  #mtPanel .lb{display:flex;flex-direction:column;gap:5px;margin-top:8px} #mtPanel .row{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:12px;background:#ffffff07;border:1px solid #ffffff12}
  #mtPanel .row.me{background:linear-gradient(90deg,#ffd97022,#ffffff06);border-color:#ffd97088} #mtPanel .pl{font:800 18px var(--disp,system-ui);width:30px;text-align:center;color:#8fa6c0} #mtPanel .row.me .pl{color:#ffd970}
  #mtPanel .row canvas{width:72px!important;height:46px!important} #mtPanel .nm{flex:1;min-width:0} #mtPanel .nm b{display:block;font:700 13px var(--disp,system-ui)} #mtPanel .nm span{color:#a9b8ca;font-size:11px}
  #mtPanel .sc{font:800 16px var(--disp,system-ui);color:#7cdeb5} #mtPanel .parts{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0} #mtPanel .parts div{padding:6px 10px;border-radius:10px;background:#ffffff0c;text-align:center;font-size:10px;color:#8fa6c0} #mtPanel .parts b{display:block;font:800 15px var(--disp,system-ui);color:#eef3f9}
  #mtPanel .go{background:linear-gradient(180deg,#ffd970,#c99a2a);color:#1b1408;padding:10px 14px} #mtPanel .trophies{font-size:13px;margin-top:6px;color:#cfe0f2}`));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pnl.hidden) { pnl.hidden = true; e.stopImmediatePropagation(); } }, true);
  function head(title, sub) { try { root.releaseControls?.(); } catch { /* n/a */ } pnl.hidden = false; pnl.textContent = ''; const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { pnl.hidden = true; }; top.append(el('h2', {}, title), x); pnl.append(top); if (sub) pnl.append(el('div', { className: 'sub' }, sub)); }
  const portrait = (model, color) => { const spec = root.NightshiftCarsData?.fromModel?.(model); return spec && root.NightshiftCars ? root.NightshiftCars.portrait(spec.id, color, 72, 46) : el('div', { style: 'width:72px;height:46px;border-radius:10px;background:#ffffff10;display:flex;align-items:center;justify-content:center;font-size:22px' }, '🚗'); };
  function board(field, me) {
    const lb = el('div', { className: 'lb' }), all = [...field.map((r) => ({ ...r, me: false }))]; if (me) all.push(me); all.sort((a, b) => b.score - a.score || (a.me ? -1 : 1));
    all.forEach((r, i) => { const row = el('div', { className: 'row' + (r.me ? ' me' : '') }), nm = el('div', { className: 'nm' }); nm.append(el('b', {}, r.me ? `YOU · ${r.carName}` : r.name), el('span', {}, r.me ? 'Your entry' : `${root.NightshiftCarsData?.BY?.[r.id]?.name || r.id}${r.kit ? ' · ' + r.kit.toUpperCase() + ' kit' : ''}`)); row.append(el('div', { className: 'pl' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)), portrait(r.model, r.color), nm, el('div', { className: 'sc' }, String(r.score))); lb.append(row); });
    return lb;
  }
  function openPanel(result) {
    const field = D.rivals(key()), tr = state.trophies;
    if (result) {
      const r = result, car = r.car;
      head(r.prize ? `${['🥇', '🥈', '🥉'][r.place - 1]} ${['FIRST', 'SECOND', 'THIRD'][r.place - 1]} PLACE` : `#${r.place} · NO TROPHY TONIGHT`, r.prize ? `The judges loved your ${nameOf(car)}. +${money(r.prize.cash)} and a ${r.prize.trophy} trophy.` : `Your ${nameOf(car)} scored ${r.score.total}. Kits, tuning and a better model raise your score. Bring another car — each one can show once a night.`);
      const parts = el('div', { className: 'parts' }); for (const [k, v] of [['MODEL', r.score.parts.model], ['KIT', r.score.parts.kit], ['TUNING', r.score.parts.tune], ['PAINT', r.score.parts.paint], ['CONDITION', r.score.parts.condition + '%'], ['TOTAL', r.score.total]]) { const d = el('div'); d.append(el('b', {}, String(v)), document.createTextNode(k)); parts.append(d); }
      pnl.append(parts, board(field, { me: true, score: r.score.total, model: car.model, color: car.color, carName: nameOf(car) }));
    } else {
      head('🏁 WESTSIDE COURTS · NIGHT MEET', open() ? 'Tonight\'s field. Drive a car you own into the ring, stop, and press SHOW.' : 'The meet runs 21:00–03:00. Come back at night with your best car.');
      pnl.append(board(field, null));
    }
    pnl.append(el('div', { className: 'trophies' }, `Your trophies: 🥇 ${tr.gold} · 🥈 ${tr.silver} · 🥉 ${tr.bronze} · best score ${state.best} · ${money(state.earned)} won`));
    pnl.append(el('div', { className: 'sub', style: 'margin-top:6px' }, 'Scoring: model tier (a Hypercar beats a hatch), body kit (Prestige Motors), tuning levels (GARAGE), paint (anything but stock), and condition (repair dents).'));
  }
  function doShow() {
    const p = P(), car = myCar();
    if (!open()) { openPanel(); return; }
    if (!car) { say('🏁 Drive a car you OWN into the ring and stop to show it'); openPanel(); return; }
    if (Math.abs(car.speed || 0) > 0.3) { say('🏁 Stop in the ring first'); return; }
    const r = D.show(state, p, key(), car.id, carInfo(car)); if (!r.ok) { say(r.reason); return; }
    persist(); gameSave();
    try { root.NightshiftSkills?.gain('charisma', 30 + (r.prize ? 40 : 0), 'meet'); root.NightshiftSkills?.gain('driving', 20, 'meet'); if (r.prize) root.NightshiftAudio?.play('pickup'); } catch { /* optional */ }
    flashUntil = performance.now() + 2500;
    openPanel({ ...r, car });
  }

  // ---------------- world ----------------
  let flashUntil = 0;
  const E = root.NightshiftEncounters;
  if (E && !E.__meet) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; const p = P(); if (!(p?.hp > 0)) return list; return [...list, { id: 'meet-ring', type: 'meet', x: RING.x, y: RING.y, ready: true, color: '#ffd970', label: open() ? '🏁 CAR MEET · SHOW YOUR CAR' : '🏁 CAR MEET · NIGHTS', action: open() ? (myCar() ? 'SHOW' : 'MEET') : 'MEET', hint: open() ? 'Stop a car you own in the ring' : 'Night meet 21:00–03:00' }]; };
    E.use = function (id) { if (id === 'meet-ring') { doShow(); return true; } return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawMeet(); } catch (e) { console.error(e); } return r; };
    E.__meet = true;
  }
  function drawMeet() {
    const c = G(), p = P(); if (!c || !p) return;
    if (Math.abs(p.x - RING.x) > 760 || Math.abs(p.y - RING.y) > 520) return;
    const t = performance.now() / 1000, live = open();
    // painted ring + chequered entry line
    c.save(); c.strokeStyle = live ? '#ffd970' : '#ffd97055'; c.lineWidth = 3; c.setLineDash([10, 7]); c.lineDashOffset = -t * 20; c.beginPath(); c.arc(RING.x, RING.y, RING.r, 0, Math.PI * 2); c.stroke(); c.restore();
    for (let k = 0; k < 8; k++) R(c, k % 2 ? '#111' : '#f4f1ea', RING.x - 32 + k * 8, RING.y + RING.r + 4, 8, 6);
    // sign post
    R(c, '#2a2e33', RING.x - 70, RING.y - RING.r - 70, 4, 50); R(c, '#2a2e33', RING.x + 66, RING.y - RING.r - 70, 4, 50);
    R(c, '#14181e', RING.x - 76, RING.y - RING.r - 86, 152, 22); R(c, live ? '#ffd970' : '#7d8796', RING.x - 76, RING.y - RING.r - 86, 152, 2);
    c.save(); c.font = '800 11px "Chakra Petch",system-ui'; c.textAlign = 'center'; c.fillStyle = live ? '#ffd970' : '#9fb3c8'; c.fillText(live ? 'NIGHT MEET · LIVE' : 'NIGHT MEET · 21:00–03:00', RING.x, RING.y - RING.r - 71); c.restore();
    if (!live) return;
    // string lights across the court
    c.save(); c.strokeStyle = '#2a2e33'; c.lineWidth = 1; c.beginPath(); c.moveTo(98, 440); c.quadraticCurveTo(228, 470, 358, 440); c.moveTo(98, 690); c.quadraticCurveTo(228, 720, 358, 690); c.stroke(); c.restore();
    for (let k = 0; k <= 12; k++) { const u = k / 12; for (const [y0, y1] of [[440, 470], [690, 720]]) { const x = 98 + 260 * u, y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * y1 + u * u * y0; C(c, ['#ffd970', '#ff4ad8', '#3ad0ff'][k % 3], x, y + 2, 2); } }
    // rival cars with underglow
    const field = D.rivals(key());
    field.forEach((rv, i) => {
      const [x, y, a] = SPOTS[i];
      c.save(); c.globalCompositeOperation = 'lighter'; const gr = c.createRadialGradient(x, y, 4, x, y, 44); const col = UNDERGLOW[i % UNDERGLOW.length]; gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00'); c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, 46, 30, a, 0, Math.PI * 2); c.fill(); c.restore();
      try { root.NightshiftSprites?.car?.({ x, y, angle: a, color: rv.color, model: rv.model, speed: 0, condition: 100, id: 'meet-' + i }); if (rv.kit) root.NightshiftPets?.decals?.(c, { x, y, angle: a }, rv.kit); } catch { /* sprite optional */ }
    });
    // DJ table + speakers + judges' table
    R(c, '#1d2126', 180, 424, 96, 18); R(c, '#2b3036', 180, 424, 96, 3); for (const dx of [196, 252]) { C(c, '#0c0e11', dx, 433, 6); C(c, '#3a3f45', dx, 433, 2); } R(c, '#ff4ad8', 222, 430, 12, 2);
    for (const sx of [168, 280]) { R(c, '#111317', sx, 418, 14, 24); C(c, '#2b3036', sx + 7, 426, 4); C(c, '#2b3036', sx + 7, 436, 3); }
    R(c, '#3a2a1a', 330, 540, 18, 44); R(c, '#e8e2d0', 332, 548, 14, 4); R(c, '#e8e2d0', 332, 560, 14, 4); R(c, '#e8e2d0', 332, 572, 14, 4);
    // crowd + phone flashes
    const S = root.NightshiftSprites;
    CROWD.forEach(([x, y], i) => { const face = Math.atan2(RING.y - y, RING.x - x); try { S?.person?.({ x, y, angle: face, moving: false, walkTicks: 0, hp: 40, id: 'meet-crowd-' + i, color: ['#c84659', '#3d7fc6', '#e2b75c', '#6d73be', '#2f8f6a', '#e4e0d6'][i % 6] }, false, { weapon: false, role: 'ped' }); } catch { /* sprite optional */ } });
    const flashing = performance.now() < flashUntil;
    CROWD.forEach(([x, y], i) => { if ((flashing && Math.sin(t * 13 + i * 2.1) > 0.2) || Math.sin(t * 1.7 + i * 4.3) > 0.985) { c.save(); c.globalCompositeOperation = 'lighter'; C(c, '#ffffffcc', x + 4, y - 26, 3); C(c, '#ffffff33', x + 4, y - 26, 10); c.restore(); } });
  }

  root.NightshiftCarMeet = Object.freeze({ get state() { return state; }, open: () => openPanel(), ring: RING, isOpen: open, paused: () => !pnl.hidden });
})(typeof globalThis !== 'undefined' ? globalThis : this);
