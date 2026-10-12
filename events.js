/* City events in game (Claude-owned). Requires events-data.js.
 * Every 2.5–4 minutes (when nothing else big is running) a timed event appears on a road somewhere in the city:
 * a toast, a cyan world marker + guide arrow, and a HUD bar with the countdown. Types: dropped briefcase,
 * stalled armored truck (hold position to crack it; cops respond), mystery package (grab + deliver), pop-up
 * checkpoint sprint (in a car). Pays cash (+5% per Respect rank) and skill XP. Events are session-only.
 * Save (stats): nightshift-events-v1. API: NightshiftEvents.{state, active, spawn, dismiss, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const V = root.NightshiftEventsData;
  const KEY = 'nightshift-events-v1';
  let state = V.clean({});
  try { state = V.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rank = () => root.NightshiftRespect?.state?.reached || 0;
  const COLOR = '#4fe3ff';

  let ev = null, nextAt = performance.now() + 60000, last = performance.now(), lastReport = 0, seq = 0;
  // Something else owns the player's attention: don't spawn on top of it, and freeze timers while a panel is open.
  const busy = () => !!(root.NightshiftHeists?.active?.() || root.NightshiftRaces?.active?.());
  const MODULES = ['NightshiftJobs', 'NightshiftCasino', 'NightshiftFishing', 'NightshiftVenues', 'NightshiftHeists', 'NightshiftEmpire', 'NightshiftWeapons', 'NightshiftRespect', 'NightshiftLab', 'NightshiftGoals'];
  const panelOpen = () => MODULES.some((m) => { try { return !!root[m]?.paused?.(); } catch { return false; } });

  function spawn(type) {
    const p = P(); if (!p) return null;
    let made = null;
    for (let i = 0; i < 20 && !made; i++) { const e = V.make(Date.now() + ':' + (seq++), p); if (!type || e.type === type) made = e; }
    if (!made) return null;
    ev = made; ev.pay = V.scale(ev.pay, rank());
    const T = V.TYPES[ev.type];
    say(`${T.icon} CITY EVENT · ${T.name} · ${hint()} · ${Math.round(dist(p, ev) / 10)}m away`);
    try { root.NightshiftAudio?.play('pickup'); } catch { /* sound optional */ }
    render(); return { type: ev.type, x: ev.x, y: ev.y };
  }
  function hint() {
    if (!ev) return '';
    if (ev.type === 'briefcase') return `grab it (${money(ev.pay)}${ev.hot ? ', might be hot' : ''})`;
    if (ev.type === 'truck') return ev.stage === 'crack' ? 'stay next to the truck' : `crack it for ~${money(ev.pay)} (cops will come)`;
    if (ev.type === 'package') return ev.stage === 'carry' ? 'deliver to the marker' : `grab it, rush it across town (${money(ev.pay)}+)`;
    return ev.stage === 'run' ? `gate ${ev.progress + 1}/${ev.gates.length}` : 'drive into the start in a car';
  }
  function end(res) {
    const T = V.TYPES[ev.type], p = P();
    if (res.result === 'done') {
      const pay = res.pay || 0;
      try { root.NightshiftGoals?.notePayout?.(pay); } catch { /* optional */ }
      if (p) p.cash = Math.min(100000000, p.cash + pay);
      for (const [sk, xp] of Object.entries(T.xp)) try { root.NightshiftSkills?.gain(sk, xp, 'event'); } catch { /* optional */ }
      if (ev.type === 'briefcase' && ev.hot && p) { p.heat = Math.min(5, (p.heat || 0) + 1.5); try { root.NightshiftCrime?.report?.({ x: p.x, y: p.y }, performance.now(), 'theft'); } catch { /* optional */ } }
      state.done++; state.earned = Math.min(1e10, state.earned + pay); state.byType[ev.type] = (state.byType[ev.type] || 0) + 1; persist(); gameSave();
      say(`${T.icon} EVENT DONE · ${res.msg} · +${money(pay)}`);
      try { root.NightshiftAudio?.play('pickup'); } catch { /* sound optional */ }
    } else { state.missed++; persist(); say(`${T.icon} ${res.msg}`); }
    ev = null; nextAt = performance.now() + V.nextGap(); render();
  }
  function tick() {
    const now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now;
    const p = P(); if (!p || document.hidden) return;
    if (panelOpen()) { nextAt += dt * 1000; return; }
    if (!ev) { if (now >= nextAt) { if (busy() || p.hp <= 0) nextAt = now + 20000; else spawn(); } return; }
    if (p.hp <= 0 && ev.stage !== 'open') return end({ result: 'fail', msg: 'you went down — event lost' });
    const res = V.step(ev, { dt, pos: { x: p.x, y: p.y }, inCar: !!p.car });
    if (ev.type === 'truck' && ev.stage === 'crack' && dist(p, ev) < V.RADIUS.truck) {
      p.heat = Math.max(p.heat || 0, 2);
      if (now - lastReport > 4000) { lastReport = now; try { root.NightshiftCrime?.report?.({ x: ev.x, y: ev.y }, now, 'robbery'); } catch { /* optional */ } }
    }
    if (!res) return;
    if (res.result === 'stage') { say(`${V.TYPES[ev.type].icon} ${res.msg}`); render(); return; }
    end(res);
  }
  setInterval(tick, 100);

  // ---- world drawing (through the encounters draw hook, like jobs/heists) ----
  function drawWorld() {
    const ctx = G(), p = P(); if (!ctx || !p || !ev) return;
    const t = performance.now() / 1000, T = V.TYPES[ev.type], tgt = V.target(ev);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (ev.type === 'sprint' && ev.stage === 'run') ev.gates.forEach((gt, i) => {
      if (i < ev.progress) return;
      ctx.globalAlpha = i === ev.progress ? 1 : 0.4; ctx.strokeStyle = COLOR; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(gt.x, gt.y, V.RADIUS.gate, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e8fbff'; ctx.font = 'bold 13px monospace'; ctx.fillText(String(i + 1), gt.x, gt.y);
    });
    ctx.globalAlpha = 1;
    // marker: pulsing ring + icon plate
    const r = (ev.type === 'truck' ? V.RADIUS.truck : 46) + 4 * Math.sin(t * 5);
    ctx.strokeStyle = COLOR; ctx.lineWidth = 3; ctx.setLineDash?.([8, 6]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.arc(tgt.x, tgt.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash?.([]);
    if (ev.type === 'truck' && ev.stage === 'crack') { // crack progress arc
      ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 6; ctx.beginPath();
      ctx.arc(ev.x, ev.y, V.RADIUS.truck + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (ev.progress / T.hold)); ctx.stroke();
    }
    if (!(ev.type === 'sprint' && ev.stage === 'run')) {
      const label = ev.type === 'package' && ev.stage === 'carry' ? '📍 DROP' : ev.type === 'sprint' ? '🏁 START' : T.icon + ' ' + T.name.split(' ').pop().toUpperCase();
      ctx.font = 'bold 11px monospace'; const w = ctx.measureText ? ctx.measureText(label).width + 14 : 90;
      ctx.fillStyle = '#06222ae8'; ctx.fillRect(tgt.x - w / 2, tgt.y - r - 26, w, 18);
      ctx.strokeStyle = COLOR; ctx.lineWidth = 1.5; ctx.strokeRect(tgt.x - w / 2, tgt.y - r - 26, w, 18);
      ctx.fillStyle = '#e8fbff'; ctx.fillText(label, tgt.x, tgt.y - r - 17);
      if (ev.type === 'truck') { ctx.font = '26px sans-serif'; ctx.fillText('🚚', ev.x, ev.y); }
      if (ev.type === 'briefcase' || (ev.type === 'package' && ev.stage === 'open')) { ctx.font = '20px sans-serif'; ctx.fillText(T.icon, ev.x, ev.y + Math.sin(t * 4) * 3); }
    }
    if (dist(p, tgt) > 110) { // guide arrow (cyan, outside the pink job arrow radius)
      const a = Math.atan2(tgt.y - p.y, tgt.x - p.x), rr = p.car ? 90 : 66;
      ctx.translate(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); ctx.rotate(a);
      ctx.fillStyle = COLOR; ctx.strokeStyle = '#00141a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.stroke(); ctx.fill();
    }
    ctx.restore();
  }
  const E = root.NightshiftEncounters;
  if (E && !E.__events) { const draw = E.draw; E.draw = function () { const r = draw.apply(this, arguments); try { drawWorld(); } catch { /* cosmetic */ } return r; }; E.__events = true; }

  // ---- HUD ----
  const css = document.createElement('style');
  css.textContent = `#evHud{position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:24;pointer-events:none;background:#061c22dd;border:1px solid ${COLOR};border-radius:10px;color:#fff;font:700 12px ui-monospace,Menlo,monospace;padding:6px 12px;max-width:94vw}
  #evHud[hidden]{display:none} #evHud i{display:block;height:3px;margin-top:4px;background:${COLOR};border-radius:2px}`;
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'evHud'; hud.hidden = true; document.body.append(hud);
  function place() {
    const job = document.querySelector('#jbHud'), jr = job && !job.hidden ? job.getBoundingClientRect() : null;
    if (innerWidth > innerHeight) {
      let bottom = 14 + (jr && jr.height ? jr.height + 6 : 0) + (root.NightshiftRaces?.active?.() ? 38 : 0);
      Object.assign(hud.style, { top: 'auto', bottom: `calc(${bottom}px + env(safe-area-inset-bottom, 0px))`, left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 2 * min(34vw, 300px))' });
    } else {
      const a = jr && jr.height ? jr : (document.querySelector('#dyChip') || document.querySelector('#glCard'))?.getBoundingClientRect();
      Object.assign(hud.style, { top: Math.round((a?.bottom || 200) + 8) + 'px', bottom: 'auto', left: '12px', transform: 'none', maxWidth: 'calc(100vw - 24px)' });
    }
  }
  function render() {
    const p = P();
    if (!ev || !p) { hud.hidden = true; return; }
    const T = V.TYPES[ev.type];
    let left, total;
    if (ev.type === 'package' && ev.stage === 'carry') { left = ev.timer; total = T.deliver; }
    else if (ev.type === 'sprint' && ev.stage === 'run') { left = ev.timer; total = ev.limit; }
    else if (ev.type === 'truck' && ev.stage === 'crack') { left = T.hold - ev.progress; total = T.hold; }
    else { left = ev.life; total = T.life; }
    hud.hidden = false; place();
    const suffix = ev.type === 'truck' && ev.stage === 'crack' ? `cracking ${Math.round((ev.progress / T.hold) * 100)}%` : `${Math.ceil(Math.max(0, left))}s`;
    hud.textContent = `${T.icon} ${hint()} · ${suffix} · ${Math.round(dist(p, V.target(ev)) / 10)}m`;
    const bar = document.createElement('i');
    bar.style.width = Math.round(Math.max(0, Math.min(1, ev.type === 'truck' && ev.stage === 'crack' ? ev.progress / T.hold : left / total)) * 100) + '%';
    hud.append(bar);
  }
  setInterval(render, 250);

  root.NightshiftEvents = Object.freeze({
    get state() { return state; },
    active: () => (ev ? { type: ev.type, stage: ev.stage, x: ev.x, y: ev.y, pay: ev.pay, life: ev.life, progress: ev.progress, timer: ev.timer, to: ev.to, gates: ev.gates } : null),
    spawn: (type) => (ev ? null : spawn(type)),
    dismiss: () => { if (ev) { ev = null; nextAt = performance.now() + V.nextGap(); render(); } },
    next: () => Math.max(0, Math.round((nextAt - performance.now()) / 1000)),
    paused: () => false,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
