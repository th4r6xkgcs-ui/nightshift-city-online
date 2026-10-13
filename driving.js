/* Driving overhaul in game (Claude-owned, v0.64). Requires driving-data.js.
 *  - Drift: hold BRAKE while steering at speed. The body slides (drawn at a slip angle), tyres lay skid marks and
 *    smoke, and chains score points that pay cash + Driving XP when you straighten out.
 *  - Nitro: a NOS button appears while driving once you have nitro (buy a fill at any gas station). Hold to boost.
 *  - Damage you can see: dents and scratches, then smoke from the hood, then fire as the body breaks down.
 *  - Gas stations (the new lots) work: pull under the canopy -> FUEL point: fuel, repair, wash, nitro.
 *  - Drift / service events go out on the shared event bus ('ns:event').
 * API: NightshiftDriving.{stats, chain, open, close, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const D = root.NightshiftDrivingData; if (!D) return;
  const st = { drifts: 0, best: 0, skids: 0, services: 0 };
  const chain = D.newChain();
  const emit = (detail) => { try { root.dispatchEvent(new CustomEvent('ns:event', { detail })); } catch { /* n/a */ } };
  const P = () => { try { return player; } catch { return null; } }; // eslint-disable-line no-undef
  const skids = [], smoke = [];
  let driftingNow = false, nosHeld = false, lastPopup = 0;

  function install() {
    const V = root.NightshiftVehicles; if (!V || typeof V.handling !== 'function') return false;
    if (V.__driving) return true;
    const h0 = V.handling;
    V.handling = function (car, thrust, steer, brake, dt) {
      const p = P();
      if (!p || !car || p.car !== car) return h0.apply(this, arguments);
      const r = D.step(car, { thrust, steer, brake, dt });
      driftingNow = r.drifting;
      const args = Array.from(arguments); args[3] = r.brake; if (r.drifting) args[1] = Math.max(thrust || 0, 0.35); // keep the throttle pinned through a slide
      const out = h0.apply(this, args);
      // nitro on top of the normal top speed
      const sec = Math.max(0, Math.min(2, dt || 1)) / 60, n = D.nitro(car, nosHeld, sec);
      if (!n.active) car.__top = Math.max(car.__top || 0, Math.abs(car.speed));
      else { const top = Math.max(car.__top || 7, 6.5) * n.top; car.speed = Math.min(top, car.speed + 0.12 * (dt || 1)); if (Math.random() < 0.5) puff(car, true); }
      // marks + score
      if (r.drifting || Math.abs(car.drift || 0) > 0.2 || (brake && Math.abs(car.speed) > 3)) mark(car);
      const done = D.score(chain, car, r.drifting, sec);
      if (done) payout(done);
      return out;
    };
    V.__driving = true; return true;
  }
  function payout(done) {
    const p = P(); st.drifts++; st.best = Math.max(st.best, done.points);
    try { p.cash += done.cash; root.NightshiftSkills?.gain?.('driving', done.xp, 'drift'); root.NightshiftFeedback?.floating?.(p.x, p.y - 40, `DRIFT ${done.points} · +$${done.cash}`, '#7cffb5'); } catch { /* n/a */ }
    emit({ type: 'drift', points: done.points, time: done.time });
  }
  // rear wheel positions -> skid segments
  function wheels(car) {
    const spec = root.NightshiftCarsData?.fromModel?.(car.model), L = (spec?.len || 50) / 2 - 7, Wd = (spec?.wid || 26) / 2 - 3, a = car.angle + (car.drift || 0), c = Math.cos(a), s = Math.sin(a);
    return [[-L, -Wd], [-L, Wd]].map(([lx, ly]) => ({ x: car.x + lx * c - ly * s, y: car.y + lx * s + ly * c }));
  }
  function mark(car) {
    const w = wheels(car);
    if (car.__wheels) for (let i = 0; i < 2; i++) { const a = car.__wheels[i], b = w[i]; if (Math.hypot(a.x - b.x, a.y - b.y) < 30) skids.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, t: performance.now() }); }
    car.__wheels = w; car.__wheelsAt = performance.now(); st.skids++;
    if (skids.length > 900) skids.splice(0, skids.length - 900);
    if (Math.random() < 0.35) for (const q of w) smoke.push({ x: q.x, y: q.y, r: 4, life: 0.9, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, col: '220,224,228' });
  }
  function puff(car, nitroFlame) {
    const spec = root.NightshiftCarsData?.fromModel?.(car.model), L = (spec?.len || 50) / 2, a = car.angle + (car.drift || 0);
    if (nitroFlame) { smoke.push({ x: car.x - Math.cos(a) * (L + 2), y: car.y - Math.sin(a) * (L + 2), r: 3, life: 0.25, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 30, col: '120,200,255', glow: true }); return; }
  }
  // per-car visuals (wraps NightshiftSprites.car): slip angle, dents, hood smoke, fire
  function dents(ctx, car, stg) {
    if (stg < 1) return; const spec = root.NightshiftCarsData?.fromModel?.(car.model), L = (spec?.len || 50) / 2, Wd = (spec?.wid || 26) / 2;
    let h = 0; for (const ch of String(car.id || 'x')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle + (car.drift || 0));
    const n = stg * 3; for (let i = 0; i < n; i++) { h = (h * 1103515245 + 12345) >>> 0; const x = -L + 6 + (h % 1000) / 1000 * (L * 2 - 12), side = (h >> 10) & 1 ? 1 : -1, y = side * (Wd - 2 - ((h >> 12) % 4)); ctx.fillStyle = 'rgba(20,22,26,0.45)'; ctx.fillRect(x, y - 1, 3 + (h >> 16) % 5, 1.6); ctx.fillStyle = 'rgba(220,226,230,0.35)'; ctx.fillRect(x + 1, y - 1.6, 2, 0.6); }
    if (stg >= 3) { ctx.fillStyle = 'rgba(10,10,12,0.35)'; ctx.beginPath(); ctx.ellipse(L - 8, 0, 6, Wd * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function carFx(car) {
    const stg = D.stage(car.condition); if (stg < 2) return;
    const spec = root.NightshiftCarsData?.fromModel?.(car.model), L = (spec?.len || 50) / 2, a = car.angle + (car.drift || 0), hx = car.x + Math.cos(a) * (L - 8), hy = car.y + Math.sin(a) * (L - 8);
    const rate = stg === 2 ? 0.08 : stg === 3 ? 0.2 : 0.35; if (Math.random() < rate) smoke.push({ x: hx, y: hy, r: 3, life: stg >= 3 ? 1.5 : 1.1, vx: 4, vy: -10, col: stg >= 3 ? '40,40,44' : '150,150,155' });
    if (stg === 4 && Math.random() < 0.5) smoke.push({ x: hx + (Math.random() - 0.5) * 8, y: hy + (Math.random() - 0.5) * 6, r: 2.5, life: 0.35, vx: 0, vy: -16, col: Math.random() < 0.5 ? '255,140,40' : '255,210,80', glow: true });
  }
  function drawSkids() {
    let ctx = null; try { ctx = g; } catch { return; } // eslint-disable-line no-undef
    const p = P(); if (!ctx || !p || !skids.length) return; const now = performance.now();
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 2.6;
    for (const k of skids) { if (Math.abs(k.x1 - p.x) > 900 || Math.abs(k.y1 - p.y) > 600) continue; const age = (now - k.t) / 60000; if (age > 1) continue; ctx.strokeStyle = `rgba(14,15,18,${0.5 * (1 - age)})`; ctx.beginPath(); ctx.moveTo(k.x1, k.y1); ctx.lineTo(k.x2, k.y2); ctx.stroke(); }
    ctx.restore();
  }
  function drawSmoke() {
    let ctx = null; try { ctx = g; } catch { return; } // eslint-disable-line no-undef
    if (!ctx) return; ctx.save();
    for (let i = smoke.length - 1; i >= 0; i--) { const q = smoke[i]; q.life -= 1 / 60; if (q.life <= 0) { smoke.splice(i, 1); continue; } q.x += q.vx / 60; q.y += q.vy / 60; q.r += q.glow ? 0.05 : 0.22; ctx.globalAlpha = Math.min(0.55, q.life * 0.6); if (q.glow) ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgb(${q.col})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    if (smoke.length > 260) smoke.splice(0, smoke.length - 260);
    ctx.restore();
    // drift chain readout over the car
    const p = P(); if (p?.car && chain.points > 30) { const now = performance.now(); if (now - lastPopup > 0) { ctx.save(); ctx.font = '800 11px "Chakra Petch",ui-sans-serif,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#7cffb5'; ctx.shadowColor = '#0b0d14'; ctx.shadowBlur = 4; ctx.fillText(`DRIFT ${Math.round(chain.points * chain.mult)}${chain.mult > 1 ? ' x' + chain.mult.toFixed(1) : ''}`, p.car.x, p.car.y - 40); ctx.restore(); } }
  }

  // ---------- NOS button ----------
  const css = document.createElement('style');
  css.textContent = `#actions>button#nos{display:none!important;font-size:11px!important;background:linear-gradient(160deg,#1d4f7a,#0f2a44)!important;border-color:#7cc7ff!important;color:#cfeaff!important}
  body[data-driving="true"][data-nitro="true"] #actions:not(.expanded)>button#nos{display:block!important}
  #actions>button#nos[data-held="true"]{box-shadow:0 0 14px #7cc7ffaa!important}
  #gsPanel2{position:fixed;inset:10% 14%;z-index:46;overflow:auto;background:#0f1830f5;border:1px solid #6f8db3;border-radius:14px;padding:12px 14px;color:#e8eff7;font:13px ui-monospace,Menlo,monospace}
  #gsPanel2[hidden]{display:none} #gsPanel2 h2{margin:0 0 4px;font-size:16px} #gsPanel2 .sub{font-size:11.5px;color:#b9c8da;margin-bottom:8px}
  #gsPanel2 .row{display:flex;gap:8px;align-items:center;background:#16233d;border:1px solid #2f4669;border-radius:9px;padding:7px 9px;margin-bottom:6px} #gsPanel2 .row div{flex:1} #gsPanel2 .row small{display:block;color:#b9c8da;font-size:11px}
  #gsPanel2 button{all:unset;box-sizing:border-box;cursor:pointer;font:700 12px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:8px;padding:6px 10px} #gsPanel2 button[disabled]{opacity:.4;cursor:default} #gsPanel2 .x{float:right}`;
  document.head.appendChild(css);
  const nos = Object.assign(document.createElement('button'), { id: 'nos', type: 'button', textContent: 'NOS' }); nos.setAttribute('aria-label', 'Hold for nitro');
  nos.addEventListener('pointerdown', (e) => { e.preventDefault(); nosHeld = true; nos.dataset.held = 'true'; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) nos.addEventListener(ev, () => { nosHeld = false; nos.dataset.held = 'false'; });
  document.addEventListener('keydown', (e) => { if (e.key === 'n' || e.key === 'N') nosHeld = true; });
  document.addEventListener('keyup', (e) => { if (e.key === 'n' || e.key === 'N') nosHeld = false; });

  // ---------- gas stations ----------
  let stations = null;
  const getStations = () => { if (!stations) { let B = []; try { B = buildings; } catch { /* n/a */ } stations = D.gasStations(B); } return stations; }; // eslint-disable-line no-undef
  const panel = Object.assign(document.createElement('section'), { id: 'gsPanel2', hidden: true }); document.body.appendChild(panel);
  const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); for (const k of kids) n.append(k); return n; };
  function carNear(site) {
    const p = P(); if (!p) return null; if (p.car) return p.car;
    let list = []; try { list = cars; } catch { /* n/a */ } // eslint-disable-line no-undef
    return list.filter((c) => (c.owned || c.stolen) && Math.hypot(c.x - site.x, c.y - site.y) < 110).sort((a, b) => Math.hypot(a.x - site.x, a.y - site.y) - Math.hypot(b.x - site.x, b.y - site.y))[0] || null;
  }
  function open(site) {
    const p = P(); if (!p) return; const car = carNear(site);
    panel.replaceChildren(el('button', { className: 'x', textContent: 'DONE', onclick: close }), el('h2', { textContent: '⛽ VOLT · FUEL + EV' }));
    if (!car) { panel.append(el('div', { className: 'sub', textContent: 'Pull your car up under the canopy first (owned or stolen).' })); panel.hidden = false; return; }
    const q = D.quote(car);
    panel.append(el('div', { className: 'sub', textContent: `Cash $${p.cash} · fuel ${Math.round(car.fuel ?? 100)}% · body ${Math.round(car.condition ?? 100)}% · nitro ${Math.round(car.nitro || 0)}%` }));
    const row = (title, sub, kind) => panel.append(el('div', { className: 'row' }, el('div', {}, document.createTextNode(title), el('small', { textContent: sub })), el('button', { textContent: q[kind] ? '$' + q[kind] : '—', disabled: !q[kind] || p.cash < q[kind], onclick: () => { const r = D.service(car, p, kind); say(r.ok ? `⛽ ${title} · -$${r.cost}` : r.reason); if (r.ok) { st.services++; emit({ type: 'service', kind }); try { root.NightshiftVehicles?.save?.(); save(); } catch { /* n/a */ } } open(site); } }))); // eslint-disable-line no-undef
    row('Fill the tank', 'Fuel runs down as you drive · empty = the car crawls', 'fuel');
    row('Body shop repair', 'Fixes dents, smoke and fire · full condition', 'repair');
    row('Nitro fill', 'Hold NOS while driving for a burst of speed', 'nitro');
    row('Car wash', 'Shine it up (looks good for the meet)', 'wash');
    panel.hidden = false;
  }
  function close() { panel.hidden = true; }

  // ---------- hooks ----------
  const hook = setInterval(() => {
    install();
    const S = root.NightshiftSprites, C = root.NightshiftCrime, E = root.NightshiftEncounters;
    if (S && typeof S.car === 'function' && !S.__driving) {
      const c0 = S.car;
      S.car = function (v) {
        if (!v || !v.drift) { const r = c0.apply(this, arguments); try { if (v) { const stg = D.stage(v.condition); dents(g, v, stg); carFx(v); } } catch { /* cosmetic */ } return r; } // eslint-disable-line no-undef
        const a = v.angle; v.angle = a + v.drift; let r; try { r = c0.apply(this, arguments); } finally { v.angle = a; }
        try { const stg = D.stage(v.condition); dents(g, v, stg); carFx(v); } catch { /* cosmetic */ } return r; // eslint-disable-line no-undef
      };
      S.__driving = true;
    }
    if (C && typeof C.draw === 'function' && !C.__driving) { const d0 = C.draw; C.draw = function () { const r = d0.apply(this, arguments); try { drawSmoke(); } catch { /* cosmetic */ } return r; }; C.__driving = true; }
    if (E && typeof E.locations === 'function' && !E.__driving) {
      const locs = E.locations, use = E.use, draw = E.draw;
      E.locations = function () { const list = locs.apply(this, arguments) || []; const p = P(); if (!p) return list; const near = getStations().filter((s) => Math.abs(s.x - p.x) < 900 && Math.abs(s.y - p.y) < 700).map((s) => ({ id: 'fuel-' + s.id, type: 'shop', x: s.x, y: s.y, ready: true, color: '#7cffb5', label: '⛽ FUEL', action: 'FUEL', hint: 'Gas station · fuel, repair, nitro, wash' })); return near.length ? [...list, ...near] : list; };
      E.use = function (id) { if (typeof id === 'string' && id.startsWith('fuel-')) { const s = getStations().find((q) => 'fuel-' + q.id === id); if (s) open(s); return true; } return use.apply(this, arguments); };
      E.draw = function () { const r = draw.apply(this, arguments); try { drawSkids(); } catch { /* cosmetic */ } return r; };
      E.__driving = true;
    }
    if (root.NightshiftVehicles?.__driving && S?.__driving && C?.__driving && E?.__driving) clearInterval(hook);
  }, 300);
  (function loop() {
    try {
      const p = P(), A = document.querySelector('#actions');
      if (A && !nos.isConnected) A.insertBefore(nos, A.firstChild);
      if (p) { document.body.dataset.driving = p.car ? 'true' : 'false'; document.body.dataset.nitro = p.car && (p.car.nitro || 0) > 0 ? 'true' : 'false'; if (!p.car) { nosHeld = false; driftingNow = false; } nos.textContent = p.car ? `NOS ${Math.round(p.car.nitro || 0)}` : 'NOS'; }
    } catch { /* n/a */ }
    setTimeout(loop, 200);
  })();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  root.NightshiftDriving = Object.freeze({ stats: () => ({ ...st, skidCount: skids.length, smoke: smoke.length, drifting: driftingNow }), chain: () => ({ ...chain }), open, close, paused: () => !panel.hidden, stations: getStations });
})(typeof globalThis !== 'undefined' ? globalThis : this);
