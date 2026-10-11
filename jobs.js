/* Hustle phone in game (Claude-owned). Requires jobs-data.js (+ lab-data.js/lab.js for VIP drops).
 * A "📱 HUSTLE" button opens rotating job offers; one active job at a time with a pink guide arrow, world
 * markers and a timer bar. Pays cash (+5% per Respect rank) and skill XP. Jobs are session-only (an active
 * job is dropped on reload). Save (stats): nightshift-jobs-v1. API: NightshiftJobs.{state, active, open, close, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const J = root.NightshiftJobsData;
  const KEY = 'nightshift-jobs-v1';
  let state = J.clean({});
  try { state = J.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const PEDS = () => { try { return peds; } catch { return []; } };
  const CARS = () => { try { return cars; } catch { return []; } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rank = () => root.NightshiftRespect?.state?.reached || 0;

  // active: { offer, phase, started, rideStart, target, dest, label }
  let active = null;

  function bind(offer) {
    const p = P(), now = performance.now();
    const job = { offer, started: now, phase: '', target: null, dest: null };
    if (offer.type === 'taxi') { job.phase = 'pickup'; job.dest = offer.from; }
    if (offer.type === 'hit') {
      const cops = root.NightshiftCrime?.officers || [];
      const pool = PEDS().filter((x) => x && x.hp > 0 && !cops.includes(x) && dist(x, p) > 350 && dist(x, p) < 1600);
      if (!pool.length) return { error: 'No target in range right now. Try again in a minute.' };
      job.target = pool[Math.floor(Math.random() * pool.length)]; job.phase = 'hunt';
    }
    if (offer.type === 'repo') {
      const pool = CARS().filter((c) => c && !c.owned && !c.stolen && c !== p.car && Math.abs(c.speed || 0) < 0.5 && dist(c, p) > 350 && dist(c, p) < 1700);
      if (!pool.length) return { error: 'No repo target nearby. Try another job.' };
      job.target = pool[Math.floor(Math.random() * pool.length)]; job.phase = 'steal';
    }
    if (offer.type === 'drop') {
      const ls = root.NightshiftLab?.state, product = ls && root.NightshiftLabData?.bestFor(ls, offer.need);
      if (!product) return { error: `VIP wants ${offer.need} lab products. Cook some at a ⚗️ LAB first (own the Weed Farm or Coke House).` };
      job.product = product; job.phase = 'deliver'; job.dest = offer.to;
    }
    return { job };
  }
  function accept(offer) {
    if (active) { say('Finish or abandon your current job first'); return; }
    const r = bind(offer);
    if (r.error) { say(r.error); return; }
    active = r.job; state.taken.push(offer.id); state.taken = state.taken.slice(-20); persist();
    say(`${J.TYPES[offer.type].icon} Job accepted · ${describe(active)}`); panel.hidden = true; render();
  }
  function describe(job) {
    const o = job.offer;
    if (o.type === 'taxi') return job.phase === 'pickup' ? 'Pick up your fare (stop at the marker in a car)' : 'Drive the fare to the destination and stop';
    if (o.type === 'hit') return 'Find and eliminate the marked target';
    if (o.type === 'repo') return job.phase === 'steal' ? 'Take the marked car (MORE → CAR to steal it)' : 'Park it at a 🔧 TUNING garage';
    return `Deliver ${o.need} ${root.NightshiftLabData.PRODUCTS[job.product].name} to the VIP`;
  }
  function finish(pay, note) {
    const o = active.offer, p = P();
    const total = J.scale(pay, rank());
    if (p) p.cash = Math.min(100000000, p.cash + total);
    for (const [sk, xp] of Object.entries(J.TYPES[o.type].xp)) try { root.NightshiftSkills?.gain(sk, xp, 'job'); } catch { /* optional */ }
    state.done++; state.earned += total; state.byType[o.type] = (state.byType[o.type] || 0) + 1; persist(); gameSave();
    say(`${J.TYPES[o.type].icon} JOB DONE · ${note} · +${money(total)}`);
    try { root.NightshiftAudio?.play('pickup'); } catch { /* sound optional */ }
    active = null; render();
  }
  function fail(why) { if (!active) return; state.failed++; persist(); say(`📱 Job failed · ${why}`); active = null; render(); }

  function tick() {
    if (!active) return;
    const p = P(), now = performance.now(), o = active.offer;
    if (!p) return;
    if (p.hp <= 0) return fail('you went down');
    if ((now - active.started) / 1000 > o.limit) return fail('out of time');
    const car = p.car, still = car && Math.abs(car.speed || 0) < 1.5;
    if (o.type === 'taxi') {
      if (active.phase === 'pickup' && still && dist(p, o.from) < 75) { active.phase = 'ride'; active.rideStart = now; active.dest = o.to; say('🚕 Fare picked up · drive to the destination'); }
      else if (active.phase === 'ride' && still && dist(p, o.to) < 75) { const s = (now - active.rideStart) / 1000; finish(J.taxiPay(o, s), s <= o.par ? `fast ride ${s.toFixed(0)}s (+30%)` : `ride ${s.toFixed(0)}s`); }
    } else if (o.type === 'hit') {
      const t = active.target;
      if (!PEDS().includes(t)) { if (t.hp <= 0) { p.heat = Math.min(5, (p.heat || 0) + 1); finish(o.pay, 'target eliminated'); } else fail('the target vanished'); }
    } else if (o.type === 'repo') {
      const c = active.target;
      if (active.phase === 'steal' && p.car === c) { active.phase = 'deliver'; say('🚗 Got it · park it at a 🔧 TUNING garage'); }
      if (active.phase === 'deliver') {
        const site = (root.NightshiftTuning?.sites?.() || []).sort((a, b) => dist(a, c) - dist(b, c))[0];
        active.dest = site || null;
        if (site && dist(c, site) < 110 && Math.abs(c.speed || 0) < 1) {
          if (p.car === c) { p.car = null; p.x = c.x + 36; p.y = c.y; try { root.releaseControls?.(); } catch { /* n/a */ } }
          c.stolen = false; c.owned = false; c.speed = 0; try { root.NightshiftVehicles?.save?.(); } catch { /* optional */ }
          finish(o.pay, 'car repossessed');
        }
      }
    } else if (o.type === 'drop') {
      if (dist(p, o.to) < 70 && (!car || still)) {
        const L = root.NightshiftLabData, ls = root.NightshiftLab?.state;
        if (!ls || !L.take(ls, active.product, o.need)) return fail('you no longer have the product');
        try { localStorage.setItem('nightshift-lab-v1', JSON.stringify(ls)); } catch { /* best effort */ }
        p.heat = Math.min(5, (p.heat || 0) + 0.6);
        finish(J.dropPay(L.PRODUCTS[active.product].value, o.need), `${o.need}× ${L.PRODUCTS[active.product].name}`);
      }
    }
    render();
  }
  setInterval(tick, 100);

  // ---- world drawing ----
  function objective() {
    if (!active) return null;
    if (active.target && (active.offer.type === 'hit' || active.phase === 'steal')) return active.target;
    return active.dest;
  }
  function drawWorld() {
    const ctx = G(), p = P(), t = performance.now() / 1000, obj = objective();
    if (!ctx || !p || !obj) return;
    ctx.save();
    ctx.strokeStyle = active.offer.type === 'hit' ? '#ff5161' : '#ff4fd8'; ctx.lineWidth = 3;
    if (active.offer.type === 'hit') { // reticle over the target
      const r = 18 + 3 * Math.sin(t * 6);
      ctx.beginPath(); ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2); ctx.stroke();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(obj.x + dx * (r - 6), obj.y + dy * (r - 6)); ctx.lineTo(obj.x + dx * (r + 8), obj.y + dy * (r + 8)); ctx.stroke(); }
    } else { ctx.setLineDash?.([8, 6]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(obj.x, obj.y, 60, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash?.([]); }
    const d = dist(p, obj);
    if (d > 90) {
      const a = Math.atan2(obj.y - p.y, obj.x - p.x), rr = p.car ? 74 : 52;
      ctx.translate(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); ctx.rotate(a);
      ctx.fillStyle = active.offer.type === 'hit' ? '#ff5161' : '#ff4fd8'; ctx.strokeStyle = '#1a0010'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.stroke(); ctx.fill();
    }
    ctx.restore();
  }
  const E = root.NightshiftEncounters;
  if (E && !E.__jobs) { const draw = E.draw; E.draw = function () { const r = draw.apply(this, arguments); try { drawWorld(); } catch { /* cosmetic */ } return r; }; E.__jobs = true; }

  // ---- UI ----
  const css = document.createElement('style');
  css.textContent = `
  #jbBtn{all:unset;box-sizing:border-box;position:fixed;z-index:25;right:12px;top:100px;cursor:pointer;white-space:nowrap;background:#24102ad9;border:1px solid #ff4fd8;border-radius:999px;color:#ffe6fb;font:700 12px/1.2 ui-monospace,Menlo,monospace;padding:5px 10px}
  #jbHud{position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:24;pointer-events:none;background:#1a0b1edd;border:1px solid #ff4fd8;border-radius:10px;color:#fff;font:700 12px ui-monospace,Menlo,monospace;padding:6px 12px;max-width:94vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #jbHud[hidden]{display:none} #jbHud i{display:block;height:3px;margin-top:4px;background:#ff4fd8;border-radius:2px}
  #jbPanel{position:fixed;inset:6% 6%;z-index:46;overflow:auto;background:linear-gradient(180deg,#1f0d26f7,#12081af7);border:1px solid #ff4fd8;border-radius:14px;padding:12px 14px;color:#ffeefc;font:13px ui-monospace,Menlo,monospace}
  #jbPanel[hidden]{display:none} #jbPanel h2{margin:0;font-size:16px;color:#ff9be9}
  #jbPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 12px ui-monospace,Menlo,monospace}
  #jbPanel .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px} #jbPanel .x{background:#3a1840;border:1px solid #ff4fd8;padding:6px 10px}
  #jbPanel .sub{color:#d6a9cc;font-size:11px} #jbPanel .o{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#2a1232;border:1px solid #4a2156;border-radius:10px;padding:9px 10px;margin-top:7px}
  #jbPanel .o .b{min-width:0} #jbPanel .pay{color:#7cdeb5;font-weight:700} #jbPanel .go{padding:8px 12px;background:linear-gradient(#ffc2f1,#e04fc0);color:#2a0022} #jbPanel .go[disabled]{opacity:.4;pointer-events:none}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const btn = el('button', { id: 'jbBtn', type: 'button', ariaLabel: 'Hustle phone jobs' }, '📱 HUSTLE');
  const hud = el('div', { id: 'jbHud', hidden: true });
  const panel = el('div', { id: 'jbPanel', hidden: true, role: 'dialog', ariaLabel: 'Hustle phone' });
  document.body.append(btn, hud, panel);
  btn.onclick = () => { if (panel.hidden) { try { root.releaseControls?.(); } catch { /* n/a */ } panel.hidden = false; renderPanel(); } else panel.hidden = true; };
  function render() {
    btn.textContent = active ? `📱 ${J.TYPES[active.offer.type].icon} ON JOB` : '📱 HUSTLE';
    const pill = document.querySelector('#wpPill');
    if (pill) { const r = pill.getBoundingClientRect(); if (r.height) { btn.style.top = Math.round(r.bottom + 6) + 'px'; btn.style.right = Math.max(12, Math.round(innerWidth - r.right)) + 'px'; } }
    if (!active) { hud.hidden = true; return; }
    const left = Math.max(0, active.offer.limit - (performance.now() - active.started) / 1000), obj = objective(), p = P();
    hud.hidden = false; hud.style.top = root.NightshiftRaces?.active?.() ? '96px' : '58px';
    hud.textContent = `${J.TYPES[active.offer.type].icon} ${describe(active)} · ${Math.ceil(left)}s${obj && p ? ` · ${Math.round(dist(p, obj) / 10)}m` : ''}`;
    const bar = el('i'); bar.style.width = Math.round((left / active.offer.limit) * 100) + '%'; hud.append(bar);
    if (!panel.hidden) renderPanel();
  }
  function offerText(o) {
    if (o.type === 'taxi') return `${Math.round(o.dist / 10)}m ride · beat ${o.par}s for +30%`;
    if (o.type === 'hit') return 'A marked target somewhere in the city · heavy heat';
    if (o.type === 'repo') return 'Take a marked car to a tuning garage';
    const L = root.NightshiftLabData; return `Deliver ${o.need} lab products · pays ${Math.round((1.6 - 1) * 100)}% over value${L ? '' : ''}`;
  }
  let lastPanel = '';
  function renderPanel() {
    const slot = J.slotOf(Date.now()), offers = J.offers(slot), key = JSON.stringify([slot, !!active, state.taken.length, state.done]);
    if (key === lastPanel && panel.childElementCount) return; lastPanel = key;
    const scroll = panel.scrollTop; panel.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { panel.hidden = true; };
    top.append(el('h2', {}, '📱 HUSTLE'), x);
    const next = Math.ceil((J.SLOT_MS - (Date.now() % J.SLOT_MS)) / 60000);
    panel.append(top, el('div', { className: 'sub' }, `New offers in ~${next} min · ${state.done} jobs done · ${money(state.earned)} earned · Respect bonus +${rank() * 5}%`));
    if (active) {
      const o = el('div', { className: 'o' }), ab = el('button', { className: 'go', type: 'button' }, 'ABANDON');
      ab.onclick = () => { fail('abandoned'); lastPanel = ''; renderPanel(); };
      o.append(el('div', { className: 'b' }, `${J.TYPES[active.offer.type].icon} ACTIVE · ${describe(active)}`), ab); panel.append(o);
    }
    for (const o of offers) {
      const taken = state.taken.includes(o.id), row = el('div', { className: 'o' }), b = el('div', { className: 'b' });
      const pay = o.type === 'drop' ? 'pays by product' : money(J.scale(o.pay, rank()));
      b.append(el('div', {}, `${J.TYPES[o.type].icon} ${J.TYPES[o.type].name} · `, ), el('div', { className: 'sub' }, `${offerText(o)} · ${Math.round(o.limit / 60 * 10) / 10} min`));
      b.firstChild.append(el('span', { className: 'pay' }, pay));
      const go = el('button', { className: 'go', type: 'button', disabled: taken || !!active }, taken ? 'TAKEN' : 'ACCEPT');
      go.onclick = () => { accept(o); lastPanel = ''; };
      row.append(b, go); panel.append(row);
    }
    panel.scrollTop = scroll;
  }
  setInterval(render, 250);
  addEventListener('keydown', (e) => { if (!panel.hidden && e.key === 'Escape') panel.hidden = true; });

  root.NightshiftJobs = Object.freeze({ get state() { return state; }, active: () => (active ? { type: active.offer.type, phase: active.phase, offer: active.offer } : null), open: () => btn.click(), close: () => { panel.hidden = true; }, paused: () => !panel.hidden, accept });
})(typeof globalThis !== 'undefined' ? globalThis : this);
