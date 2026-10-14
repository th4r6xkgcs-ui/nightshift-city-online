/* Pets + car kits in game (Claude-owned). Requires pets-data.js; zones.js for following you into zones.
 *  - your active pet follows you in the city (ground layer) and in every zone (NightshiftZones.addCompanion);
 *    it idles, sits, wags, and dogs bark + point when a hidden stash is within sniffing range;
 *  - perks apply through NightshiftSkills.addModifier while the pet is fed (pet food from Paws & Claws);
 *  - 🐾 panel (from the backpack / pet shop): switch pets, feed, see perks;
 *  - Prestige car kits: stat multipliers on your car (NightshiftVehicles.handling/damage wraps, like tuning.js)
 *    and visual parts drawn over the car sprite (NightshiftSprites.car wrap).
 * Save: nightshift-pets-v1. API: NightshiftPets.{state, adopt, feed, openPets, buyKit, buyDream, save} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const D = root.NightshiftPetsData;
  if (!D) return;
  const KEY = 'nightshift-pets-v1';
  let state = D.clean({});
  try { state = D.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const O = (c, col, x, y, rx, ry) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); c.fill(); };
  const C = (c, col, x, y, r) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };

  // ---- perks ----
  let hooked = false;
  const hk = setInterval(() => { const SK = root.NightshiftSkills; if (!hooked && SK?.addModifier) { SK.addModifier((k) => D.perk(state, k)); hooked = true; } if (hooked) clearInterval(hk); }, 300);

  // ---- following ----
  const pet = { x: 0, y: 0, angle: 0, moving: false, walk: 0, where: '', sit: 0, bark: 0, sniffAt: 0, hop: 0 }, PET0 = pet;
  function leader() {
    const z = root.NightshiftZones?.active?.();
    if (z) { const pos = root.NightshiftZones.pos(); return pos ? { x: pos.x, y: pos.y, angle: pos.moveAngle ?? pos.angle, where: 'zone:' + z, moving: pos.moving } : null; }
    if (root.NightshiftHome?.kind?.()) return null;
    const p = P(); if (!p || p.hp <= 0) return null;
    return { x: p.x, y: p.y, angle: p.car ? p.car.angle : (p.moveAngle ?? p.angle ?? 0), where: 'city', moving: p.moving, car: !!p.car };
  }
  function step(L, dt, now) {
    if (pet.where !== L.where || Math.hypot(pet.x - L.x, pet.y - L.y) > 260) { pet.x = L.x - Math.cos(L.angle) * 26; pet.y = L.y - Math.sin(L.angle) * 26 + 6; pet.where = L.where; }
    const D2 = D.PET[state.active], bird = D2?.kind === 'bird';
    const tx = L.x - Math.cos(L.angle) * (bird ? 12 : 28) + (bird ? Math.sin(now / 600) * 10 : 0), ty = L.y - Math.sin(L.angle) * (bird ? 12 : 28) + (bird ? -22 + Math.cos(now / 500) * 4 : 8);
    const dx = tx - pet.x, dy = ty - pet.y, d = Math.hypot(dx, dy);
    const speed = (d > 60 ? 5.2 : d > 26 ? 3.2 : 0) * dt;
    if (speed > 0 && d > 2) { pet.x += (dx / d) * Math.min(speed, d); pet.y += (dy / d) * Math.min(speed, d); pet.angle = Math.atan2(dy, dx); pet.moving = true; pet.walk += dt; pet.sit = now; }
    else pet.moving = false;
    // dogs sniff out hidden stashes (city only)
    if (L.where === 'city' && D2?.kind === 'dog' && D.fed(state, state.active) && now - pet.sniffAt > 2500) {
      pet.sniffAt = now;
      const ST = root.NightshiftStashesData, s = root.NightshiftStashes?.state;
      if (ST && s) { const near = ST.SPOTS.find((q) => !s.found[q.id] && Math.hypot(q.x - L.x, q.y - L.y) < 170); if (near && now - pet.bark > 20000) { pet.bark = now; pet.point = { x: near.x, y: near.y, until: now + 5000 }; say(`${D2.icon} ${nameOf()} is barking at something nearby… a hidden stash?`); } }
    }
  }
  const nameOf = () => state.pets.find((p) => p.id === state.active)?.name || 'Your pet';
  function drawPet(c, t, id = state.active, pet = PET0) {
    const D2 = D.PET[id]; if (!D2) return;
    if (root.NightshiftPetArt && root.NightshiftPetArt.draw(c, id, { x: pet.x, y: pet.y, angle: pet.angle, moving: pet.moving, walk: (pet.walk || 0) * 0.2 }, t, { sitting: !pet.moving && performance.now() - (pet.sit || 0) > 1500 })) return; // premium sprites (pet-art.js)
    const [main, second] = D2.colors, dir = Math.cos(pet.angle) >= 0 ? 1 : -1, x = pet.x, y = pet.y, mv = pet.moving, sitting = !mv && performance.now() - pet.sit > 1500;
    const bob = mv ? Math.sin(pet.walk * 0.9) * 1.2 : 0, wag = Math.sin(t * (sitting ? 6 : 14)) * 3;
    if (D2.kind === 'owl') {
      const flap = mv ? Math.sin(t * 14) * 4 : 0, hop = mv ? Math.abs(Math.sin(pet.walk * 0.6)) * 3 : 0;
      O(c, '#00000030', x + 2, y + 2, 6, 2);
      O(c, main, x, y - 8 - hop, 6, 8); O(c, second, x + 1 * dir, y - 6 - hop, 4, 6); // body + chest
      for (let k = 0; k < 3; k++) R(c, '#8a6430', x + (k - 1) * 2, y - 5 + k * 2 - hop, 1, 1);
      O(c, main, x - 6 * dir, y - 8 - hop - flap * 0.3, 3, 6 + Math.abs(flap) * 0.3); // wing
      O(c, main, x, y - 18 - hop, 6.5, 5.5); O(c, second, x + 0.5 * dir, y - 18 - hop, 5, 4.2); // heart-shaped face
      for (const ex of [-2.2, 2.2]) { C(c, '#1b1410', x + ex + dir, y - 18.5 - hop, 1.7); C(c, '#ffd23a', x + ex + dir, y - 18.5 - hop, 1.1); C(c, '#1b1410', x + ex + dir, y - 18.5 - hop, 0.6); }
      R(c, '#c99a2a', x + dir - 0.5, y - 16.5 - hop, 1, 2); R(c, '#e0b021', x - 2, y - 0.5 - hop, 1.5, 2); R(c, '#e0b021', x + 1, y - 0.5 - hop, 1.5, 2);
      return;
    }
    if (D2.kind === 'monkey') {
      const sw = mv ? Math.sin(pet.walk * 0.8) * 2 : 0, swing = Math.sin(t * 2) * 3;
      O(c, '#00000032', x + 2, y + 1, 8, 2.5);
      c.strokeStyle = main; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 4 * dir, y - 6); c.bezierCurveTo(x - 14 * dir, y - 4, x - 14 * dir, y - 18 + swing, x - 8 * dir, y - 20 + swing); c.stroke(); // curly tail
      R(c, main, x - 4, y - 4 + sw, 2.4, 5); R(c, main, x + 2, y - 4 - sw, 2.4, 5); // legs
      O(c, main, x, y - 9, 5, 6.5); O(c, second, x + 1 * dir, y - 8, 2.8, 4); // body + belly
      R(c, main, x + 4 * dir - 1, y - 12 - sw, 2, 7); R(c, main, x - 5 * dir - 1, y - 12 + sw, 2, 7); // arms
      C(c, main, x + 1 * dir, y - 18, 5); C(c, '#4a3018', x - 3.5 * dir, y - 19, 1.8); C(c, '#4a3018', x + 5.5 * dir, y - 19, 1.8); // head + ears
      O(c, second, x + 2 * dir, y - 17, 3.4, 3); C(c, '#111', x + 1 * dir, y - 18, 0.8); C(c, '#111', x + 3.5 * dir, y - 18, 0.8); R(c, '#8a5a3a', x + 1.5 * dir, y - 15.5, 2, 0.8);
      return;
    }
    if (D2.kind === 'bird') {
      const flap = Math.sin(t * 16) * 5;
      O(c, '#00000030', x + 2, y + 24, 6, 2);
      O(c, main, x, y, 5, 7); O(c, second, x - 7 * dir, y + 1 - flap * 0.3, 7, 3 + Math.abs(flap) * 0.4); O(c, second, x + 5 * dir, y - flap * 0.2, 4, 2);
      C(c, main, x + 3 * dir, y - 7, 3.5); C(c, '#f2ead8', x + 4 * dir, y - 8, 1.4); C(c, '#111', x + 4.5 * dir, y - 8, 0.7); R(c, '#2b2218', x + 6 * dir, y - 7, 2 * dir, 2);
      R(c, '#e0b021', x - 2 * dir, y + 6, 2, 6); R(c, second, x - 1 * dir, y + 6, 2, 8);
      return;
    }
    const cat = D2.kind === 'cat', coon = D2.kind === 'raccoon', tiger = D2.id === 'tiger', big = D2.id === 'rottweiler' || D2.id === 'husky' ? 1.15 : D2.id === 'shiba' ? 0.95 : tiger ? 1.3 : coon ? 0.95 : 1;
    c.save(); c.translate(x, y); c.scale(big, big);
    O(c, '#00000038', 2, 2, 11, 3.5);
    if (sitting) {
      O(c, main, 0, -7, 6, 7); O(c, second, 1 * dir, -5, 3, 4); // body sitting
      C(c, main, 2 * dir, -15, 5); // head
    } else {
      for (const lx of [-6, -2, 3, 7]) R(c, cat ? main : second, lx * dir - 1, -4 + (mv && lx % 2 ? bob : -bob * 0.5), 2, 5);
      O(c, main, 0, -7 + bob * 0.3, 10, 5); O(c, second, 2 * dir, -6 + bob * 0.3, 5, 2.5);
      C(c, main, 10 * dir, -11 + bob * 0.3, 4.5);
    }
    const hx = sitting ? 2 * dir : 10 * dir, hy = sitting ? -15 : -11 + bob * 0.3;
    if (tiger) { // stripes on the body, round ears, white muzzle, black-striped head
      const st = '#1b1410';
      if (sitting) { for (const k of [-3, 0, 3]) R(c, st, k - 0.5, -12 + Math.abs(k) * 0.4, 1, 6); } else { for (const k of [-6, -3, 0, 3, 6]) R(c, st, k * dir - 0.5, -11 + bob * 0.3, 1, 5); }
      C(c, main, hx - 3, hy - 4, 2.2); C(c, main, hx + 3, hy - 4, 2.2); C(c, '#1b1410', hx - 3, hy - 4, 1); C(c, '#1b1410', hx + 3, hy - 4, 1);
      O(c, second, hx + 2 * dir, hy + 1.5, 3, 2.2); R(c, st, hx - 1, hy - 3.5, 1, 2); R(c, st, hx + 1, hy - 3.5, 1, 2); C(c, '#c9e86a', hx + 1.5 * dir, hy - 0.5, 0.9); R(c, '#e8a0a0', hx + 4 * dir, hy + 1, 1, 1);
    } else if (coon) { // masked face, small round ears
      C(c, main, hx - 2.5, hy - 4, 1.8); C(c, main, hx + 2.5, hy - 4, 1.8); R(c, second, hx - 3, hy - 1.5, 7, 2.2); C(c, '#f2f2ee', hx + 3 * dir, hy + 1.6, 2); C(c, '#111', hx + 5 * dir, hy + 1.5, 0.9); C(c, '#e8e2d0', hx + 1.2 * dir, hy - 0.6, 0.6);
    } else if (cat) { c.fillStyle = main; c.beginPath(); c.moveTo(hx - 4, hy - 2); c.lineTo(hx - 3, hy - 8); c.lineTo(hx, hy - 4); c.lineTo(hx + 3, hy - 8); c.lineTo(hx + 4, hy - 2); c.fill(); C(c, '#7cdeb5', hx + 1.5 * dir, hy, 0.9); R(c, '#e8a0a0', hx + 3 * dir, hy + 1, 1, 1); }
    else {
      const floppy = D2.id === 'lab' || D2.id === 'rottweiler';
      if (floppy) { O(c, second, hx - 3 * dir, hy - 1, 2, 3.5); } else { c.fillStyle = main; c.beginPath(); c.moveTo(hx - 3, hy - 2); c.lineTo(hx - 2, hy - 8); c.lineTo(hx + 1, hy - 3); c.fill(); c.beginPath(); c.moveTo(hx + 1, hy - 3); c.lineTo(hx + 3, hy - 8); c.lineTo(hx + 4, hy - 2); c.fill(); }
      O(c, second, hx + 3 * dir, hy + 1.5, 3, 2); C(c, '#111', hx + 5.5 * dir, hy + 1, 1); C(c, '#111', hx + 1.5 * dir, hy - 1, 0.8);
      if (D2.id === 'husky') { R(c, '#f2f2ee', hx - 1, hy - 1, 3, 3); }
    }
    // tail
    c.strokeStyle = cat ? main : D2.id === 'shiba' || D2.id === 'husky' ? second : main; c.lineWidth = cat ? 1.6 : 2.2; c.lineCap = 'round'; c.beginPath();
    const tx = sitting ? -5 * dir : -10 * dir, ty = sitting ? -4 : -9 + bob * 0.3;
    if (coon) { c.stroke(); for (let k = 0; k < 5; k++) { O(c, k % 2 ? second : main, tx - (k * 2.4 + 1) * dir, ty - k * 1.6 + wag * 0.15 * k, 2.2, 2); } c.beginPath(); }
    else if (cat) { c.moveTo(tx, ty); c.quadraticCurveTo(tx - 5 * dir, ty - 6, tx - 2 * dir + wag * 0.3, ty - 12); if (tiger) { c.stroke(); c.strokeStyle = '#1b1410'; c.lineWidth = 1; for (let k = 1; k <= 3; k++) { const u = k / 4, qx = (1 - u) * (1 - u) * tx + 2 * u * (1 - u) * (tx - 5 * dir) + u * u * (tx - 2 * dir + wag * 0.3), qy = (1 - u) * (1 - u) * ty + 2 * u * (1 - u) * (ty - 6) + u * u * (ty - 12); c.beginPath(); c.moveTo(qx - 1.5, qy); c.lineTo(qx + 1.5, qy); c.stroke(); } c.beginPath(); } } else if (D2.id === 'shiba' || D2.id === 'husky') { c.moveTo(tx, ty); c.quadraticCurveTo(tx - 6 * dir, ty - 8 + wag * 0.4, tx - 1 * dir, ty - 9); } else { c.moveTo(tx, ty); c.lineTo(tx - 6 * dir, ty - 3 + wag); }
    c.stroke();
    if (performance.now() - pet.bark < 1800 && !cat && !coon) { c.fillStyle = '#fff'; c.font = 'bold 8px system-ui'; c.fillText('WOOF!', hx + 4 * dir, hy - 10); }
    c.restore();
    if (pet.point && performance.now() < pet.point.until) { c.save(); c.strokeStyle = '#ffd970'; c.setLineDash([3, 4]); c.globalAlpha = 0.7; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + (pet.point.x - x) * 0.35, y + (pet.point.y - y) * 0.35); c.stroke(); c.restore(); }
  }
  let last = performance.now();
  const E = root.NightshiftEncounters;
  if (E && !E.__pets) {
    const draw = E.draw;
    E.draw = function () { const r = draw.apply(this, arguments); try { cityPet(); } catch { /* cosmetic */ } return r; };
    E.__pets = true;
  }
  function cityPet() {
    if (!state.active) return;
    const L = leader(), now = performance.now(), dt = Math.min(2, (now - last) / 16.67); last = now;
    if (!L || L.where !== 'city' || L.car) return;
    step(L, dt, now); const ctx = G(); if (ctx) drawPet(ctx, now / 1000);
  }
  if (root.NightshiftZones?.addCompanion) root.NightshiftZones.addCompanion(() => {
    if (!state.active) return null;
    const L = leader(), now = performance.now(), dt = Math.min(2, (now - last) / 16.67); last = now;
    if (!L) return null; step(L, dt, now);
    return { y: pet.y + (D.PET[state.active]?.kind === 'bird' ? 30 : 0), draw: (c, t) => drawPet(c, t) };
  });

  // ---- roaming pets (apartment, dream house): wander between floor points, sit a while, wander again ----
  function roamer(id, x, y) { return { id, x, y, angle: 0, moving: false, walk: 0, sit: 0, bark: 0, tx: x, ty: y, wait: 0 }; }
  function roam(o, dt, now, points) {
    if (!points?.length) return;
    const d = Math.hypot(o.tx - o.x, o.ty - o.y);
    if (d < 2) { o.moving = false; if (!o.wait) o.wait = now + 2500 + Math.random() * 5000; if (now > o.wait) { const q = points[(Math.random() * points.length) | 0]; o.tx = q[0] + (Math.random() - 0.5) * 30; o.ty = q[1] + (Math.random() - 0.5) * 20; o.wait = 0; } return; }
    const sp = (D.PET[o.id]?.kind === 'cat' ? 1.1 : 1.5) * dt; o.x += (o.tx - o.x) / d * Math.min(sp, d); o.y += (o.ty - o.y) / d * Math.min(sp, d); o.angle = Math.atan2(o.ty - o.y, o.tx - o.x); o.moving = true; o.walk += dt; o.sit = now;
  }
  const APT = [[310, 225], [160, 330], [470, 300], [330, 300], [560, 290], [250, 250], [420, 235], [90, 300]];
  const homeRoam = {}; let homeLast = performance.now();
  function apartmentPets(ctx) {
    const now = performance.now(), dt = Math.min(2, (now - homeLast) / 16.67); homeLast = now;
    for (const q of state.pets) { const o = homeRoam[q.id] || (homeRoam[q.id] = roamer(q.id, ...APT[(Math.random() * APT.length) | 0])); roam(o, dt, now, APT); drawPet(ctx, now / 1000, q.id, o); }
  }
  const hookHome = setInterval(() => { const I = root.NightshiftInteriors; if (!I || typeof I.draw !== 'function') return; if (!I.__pets) { const draw = I.draw; try { I.draw = function (kind, ctx) { const r = draw.apply(this, arguments); if (kind === 'home' && ctx) { try { apartmentPets(ctx); } catch { /* cosmetic */ } } return r; }; } catch { /* frozen */ } I.__pets = true; } clearInterval(hookHome); }, 500);

  // ---- pets panel ----
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const pnl = el('div', { id: 'ptPanel', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Pets' }); document.body.append(pnl);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pnl.hidden) { pnl.hidden = true; e.stopImmediatePropagation(); } }, true);
  function head(title, sub) { pnl.textContent = ''; const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { pnl.hidden = true; }; top.append(el('h2', {}, title), x); pnl.append(top); if (sub) pnl.append(el('div', { className: 'sub' }, sub)); }
  function row(icon, title, line, ...btns) { const r = el('div', { className: 'mealrow', style: 'display:flex;align-items:center;gap:8px;padding:8px;border-radius:12px;background:#ffffff07;border:1px solid #ffffff12;margin-bottom:6px' }); r.append(el('div', { style: 'font-size:26px;width:34px;text-align:center' }, icon)); const t = el('div', { style: 'flex:1' }); t.append(el('b', { style: 'font:700 13px var(--disp,system-ui)' }, title), el('div', { style: 'color:#a9b8ca;font-size:11px' }, line)); r.append(t, ...btns.filter(Boolean)); return r; }
  const b = (cls, txt, fn, dis) => { const x = el('button', { className: cls, type: 'button', disabled: !!dis }, txt); x.onclick = fn; return x; };
  function openPets(shop = false) {
    try { root.releaseControls?.(); } catch { /* n/a */ }
    pnl.hidden = false; const p = P(), now = Date.now();
    head(shop ? '🐾 PAWS & CLAWS' : '🐾 YOUR PETS', shop ? `Cash ${money(p?.cash || 0)} · Pets follow you everywhere and give a perk while they're fed. One bowl lasts ${D.FEED_HOURS} hours.` : `Pet food: ${state.food} · tap a pet to bring it along.`);
    if (state.pets.length) {
      pnl.append(el('h3', {}, 'YOUR PETS'));
      for (const q of state.pets) {
        const D2 = D.PET[q.id], fed = D.fed(state, q.id, now), left = Math.max(0, Math.ceil((q.fedUntil - now) / 3600000 * 10) / 10);
        pnl.append(row(D2.icon, `${q.name}${state.active === q.id ? ' · WITH YOU' : ''}`, `${D2.desc} · ${fed ? `fed (${left}h)` : 'HUNGRY · perk off'}`,
          state.active === q.id ? null : b('alt', 'BRING', () => { state.active = q.id; persist(); openPets(shop); }),
          b('go', `FEED (${state.food})`, () => { const r = D.feed(state, q.id); if (r.ok) { persist(); say(`${D2.icon} ${q.name} munches happily`); } else say(r.reason); openPets(shop); }, state.food <= 0)));
      }
    }
    if (shop) {
      pnl.append(el('h3', {}, 'SUPPLIES'));
      pnl.append(row('🥫', 'Pet food', `${money(D.FOOD_PRICE)} a bowl · you have ${state.food}`, b('go', `BUY 1 · ${money(D.FOOD_PRICE)}`, () => { const pl = P(); if (pl.cash < D.FOOD_PRICE) { say('Not enough cash'); return; } pl.cash -= D.FOOD_PRICE; state.food += 1; persist(); gameSave(); openPets(true); }), b('alt', `×5 · ${money(D.FOOD_PRICE * 5)}`, () => { const pl = P(); if (pl.cash < D.FOOD_PRICE * 5) { say('Not enough cash'); return; } pl.cash -= D.FOOD_PRICE * 5; state.food += 5; persist(); gameSave(); openPets(true); })));
      pnl.append(el('h3', {}, 'ADOPT'));
      for (const D2 of D.PETS) {
        const own = state.pets.some((q) => q.id === D2.id);
        pnl.append(row(D2.icon, D2.name, `${D2.desc} · ${money(D2.price)}`, own ? el('span', { className: 'okc' }, 'YOURS') : b('go', 'ADOPT', () => { const r = D.adopt(state, P(), D2.id); if (r.ok) { persist(); gameSave(); say(`${D2.icon} Welcome home, ${D2.name}! It follows you now.`); } else say(r.reason); openPets(true); }, (p?.cash || 0) < D2.price || state.pets.length >= D.MAX_PETS)));
      }
    }
  }

  // ---- car kits: stats + visuals ----
  function install() {
    const V = root.NightshiftVehicles;
    if (V && !V.__kits && typeof V.handling === 'function') {
      const handling = V.handling, damage = V.damage, hit = V.hit;
      V.handling = function (car) {
        const p = P(), k = car && state.kits[car.id];
        if (!p || !k || p.car !== car) return handling.apply(this, arguments);
        const e = D.kitFactor(state, car.id, 'engine'), h = D.kitFactor(state, car.id, 'handling'), a0 = car.angle;
        car.speed /= e; const r = handling.apply(this, arguments); car.speed *= e; car.angle = a0 + (car.angle - a0) * h; return r;
      };
      const armored = (fn) => function (car) { const c0 = car?.condition; const r = fn.apply(this, arguments); if (car && state.kits[car.id] && Number.isFinite(c0) && car.condition < c0) car.condition = c0 - (c0 - car.condition) * D.kitFactor(state, car.id, 'armor'); return r; };
      if (typeof damage === 'function') V.damage = armored(damage); if (typeof hit === 'function') V.hit = armored(hit);
      V.__kits = true;
    }
    const S = root.NightshiftSprites;
    if (S && !S.__kits && typeof S.car === 'function') {
      const car = S.car;
      try { S.car = function (v) { const r = car.apply(this, arguments); const k = v && state.kits[v.id]; if (k) { try { decals(G(), v, k); } catch { /* cosmetic */ } } return r; }; S.__kits = true; } catch { S.__kits = true; }
    }
  }
  install(); const ins = setInterval(() => { install(); if (root.NightshiftVehicles?.__kits && root.NightshiftSprites?.__kits) clearInterval(ins); }, 1000);
  function decals(c, v, k, ctxOverride) {
    if (!c) return; const t = performance.now() / 1000;
    c.save(); c.translate(Math.round(v.x), Math.round(v.y)); c.rotate(v.angle || 0);
    if (k === 'gt') { R(c, '#f2f2ee', -24, -4, 50, 3); R(c, '#f2f2ee', -24, 1, 50, 3); R(c, '#111', -31, -14, 4, 28); R(c, '#2b2f33', -29, -15, 3, 30); R(c, '#e0473a', -31, -14, 1, 28); }
    else if (k === 'muscle') { R(c, '#111', 8, -5, 12, 10); R(c, '#3a3f45', 10, -4, 8, 8); for (const sy of [-1, 1]) { c.fillStyle = '#ff8a1e'; c.beginPath(); c.moveTo(20, sy * 13); c.lineTo(6, sy * 15); c.lineTo(10, sy * 11); c.lineTo(-2, sy * 14); c.lineTo(4, sy * 10); c.closePath(); c.fill(); c.fillStyle = '#ffd04a'; c.fillRect(8, sy * 12 - 1, 8, 2); } }
    else if (k === 'rally') { R(c, '#2b2f33', -10, -11, 16, 22); for (let i = 0; i < 4; i++) R(c, '#5d646b', -9 + i * 4, -10, 2, 20); R(c, '#111', 18, -11, 4, 22); for (let i = 0; i < 4; i++) C(c, '#fff3c0', 20, -8 + i * 5.3, 1.6); R(c, '#6a4a2a', -22, -17, 12, 2); R(c, '#6a4a2a', -22, 15, 12, 2); }
    else if (k === 'lux') { R(c, '#d6dde1', -27, -15, 54, 1.2); R(c, '#d6dde1', -27, 14, 54, 1.2); for (const [x, y] of [[-14, -17], [19, -17], [-14, 16], [19, 16]]) { C(c, '#e3c25a', x, y, 2.4); } R(c, '#e3c25a', 25, -2, 2, 4); const gl = 0.25 + 0.15 * Math.sin(t * 2); c.globalAlpha = gl; R(c, '#ffffff', -8, -10, 2, 20); }
    c.restore();
  }
  // Preview a kit on a car (used by the showroom).
  function previewCar(ctx, x, y, color, kit, model = 'SEDAN', angle = 0) {
    const S = root.NightshiftSprites; if (!S?.car) return;
    // S.car draws with the game's global g, so temporarily draw there at a transform
    const v = { x, y, angle, color, speed: 0, model, condition: 100, id: 'preview' };
    S.car(v); if (kit) decals(ctx, v, kit);
  }

  root.NightshiftPets = Object.freeze({ get state() { return state; }, drawPet, roamer, roam, save: () => { persist(); gameSave(); }, openPets, previewCar, decals,
    adopt: (id) => { const r = D.adopt(state, P(), id); if (r.ok) { persist(); gameSave(); } return r; },
    buyKit: (carId, kitId, owned) => { const r = D.buyKit(state, P(), carId, kitId, owned); if (r.ok) { persist(); gameSave(); } return r; },
    buyDream: () => { const r = D.buyDream(state, P()); if (r.ok) { persist(); gameSave(); } return r; },
    paused: () => !pnl.hidden, petPos: () => ({ ...pet }), drawPetAt: (c, x, y, t) => { const sx = pet.x, sy = pet.y, m = pet.moving; pet.x = x; pet.y = y; pet.moving = false; drawPet(c, t); pet.x = sx; pet.y = sy; pet.moving = m; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
