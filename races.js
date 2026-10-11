/* Street races in game (Claude-owned). Requires races-data.js. No game file is edited.
 * Drive into a race's start ring and stop for a moment -> 3-2-1-GO countdown -> pass every checkpoint.
 * Leaving the car, dying or running past the DNF limit ends the race. Medals pay cash + Driving XP.
 * Drawing hooks onto NightshiftEncounters.draw (world space); the HUD is a small DOM bar.
 * Save: nightshift-races-v1. API: NightshiftRaces.{state, active, cancel, starts} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const R = root.NightshiftRacesData;
  const KEY = 'nightshift-races-v1';
  let state = R.clean({});
  try { state = R.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };

  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { const f = (typeof save === 'function' ? save : null); if (f) f(); } catch { /* not ready */ } };
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const cooldown = {}; // race id -> ready at (ms, performance clock)

  // run: { race, phase:'arming'|'countdown'|'racing', since, cp, start }
  let run = null;
  const now = () => performance.now();

  function readyIn(race) { return Math.max(0, (cooldown[race.id] || 0) - now()); }

  function tick() {
    const p = P();
    if (!p) return;
    const car = p.car, t = now();
    if (!run) {
      if (!car || p.hp <= 0) return;
      for (const race of R.RACES) {
        const [sx, sy] = race.points[0];
        if (Math.hypot(p.x - sx, p.y - sy) < R.START_RADIUS && !readyIn(race)) {
          run = { race, phase: 'arming', since: t, cp: 1 };
          hudMsg(`🏁 ${race.name} · stop in the ring to start`);
          break;
        }
      }
      return;
    }
    const race = run.race, [sx, sy] = race.points[0];
    if (!car || p.hp <= 0) { end(false, !car ? 'You left the car' : 'Wrecked'); return; }
    if (run.phase === 'arming') {
      if (Math.hypot(p.x - sx, p.y - sy) > R.START_RADIUS + 20) { run = null; hud.hidden = true; return; }
      if (Math.abs(car.speed || 0) > 1.2) run.since = t;
      else if (t - run.since > 700) { run.phase = 'countdown'; run.since = t; try { root.NightshiftAudio?.play('pickup'); } catch { /* sound optional */ } }
      return;
    }
    if (run.phase === 'countdown') {
      const left = 3 - Math.floor((t - run.since) / 1000);
      if (Math.hypot(p.x - sx, p.y - sy) > R.START_RADIUS + 30) { end(false, 'False start'); return; }
      if (left <= 0) { run.phase = 'racing'; run.start = t; hudMsg('GO!'); try { root.NightshiftAudio?.play('fire'); } catch { /* sound optional */ } }
      else hudMsg(`🏁 ${race.name} · ${left}…`);
      return;
    }
    // racing
    const secs = (t - run.start) / 1000;
    const [cx, cy] = race.points[run.cp];
    if (Math.hypot(p.x - cx, p.y - cy) < R.CP_RADIUS) {
      run.cp++;
      try { root.NightshiftAudio?.play('pickup'); } catch { /* sound optional */ }
      if (run.cp >= race.points.length) { finish(secs); return; }
    }
    if (secs > R.limit(race)) { end(false, 'Too slow · DNF'); return; }
    const best = state.best[race.id];
    hudMsg(`🏁 ${race.name} · CP ${run.cp}/${race.points.length - 1} · ${R.fmt(secs)} · 🥇 ${R.fmt(R.par(race))}${best ? ` · best ${R.fmt(best)}` : ''}`);
  }

  function finish(secs) {
    const race = run.race, before = state.best[race.id], m = R.medal(race, secs), pay = R.payout(race, m, before);
    state.runs++;
    if (!before || secs < before) state.best[race.id] = Math.round(secs * 1000) / 1000;
    const bm = R.medal(race, state.best[race.id]); if (bm) state.medals[race.id] = bm.id;
    persist();
    const p = P();
    if (pay && p) { p.cash = Math.min(100000000, p.cash + pay); gameSave(); }
    if (m) try { root.NightshiftSkills?.gain('driving', Math.round(race.xp * (m.id === 'gold' ? 1 : m.id === 'silver' ? 0.7 : 0.45)), 'race'); } catch { /* optional */ }
    const record = !before || secs < before;
    const text = m ? `${m.icon} ${race.name} · ${R.fmt(secs)}${record ? ' · NEW BEST' : ''} · +${money(pay)}` : `🏁 ${race.name} · ${R.fmt(secs)} · no medal (bronze ${R.fmt(R.par(race) * 1.6)})`;
    say(text); hudMsg(text, 4000);
    cooldown[race.id] = now() + R.COOLDOWN_MS;
    run = null;
  }
  function end(ok, why) {
    if (!run) return;
    const race = run.race;
    if (run.phase === 'racing') { cooldown[race.id] = now() + 15000; say(`🏁 ${race.name} · ${why}`); hudMsg(`🏁 ${why}`, 2500); }
    else hud.hidden = true;
    run = null;
  }

  // ---- drawing (world space) ----
  function drawWorld() {
    const ctx = G(), p = P();
    if (!ctx || !p) return;
    const t = now() / 1000;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!run || run.phase !== 'racing') {
      for (const race of R.RACES) {
        const [x, y] = race.points[0], cd = readyIn(race), near = Math.hypot(p.x - x, p.y - y) < 600;
        if (!near) continue;
        ctx.globalAlpha = cd ? 0.35 : 0.9;
        ctx.strokeStyle = '#ffd970'; ctx.lineWidth = 3; ctx.setLineDash?.([10, 8]); ctx.lineDashOffset = -t * 20;
        ctx.beginPath(); ctx.arc(x, y, R.START_RADIUS, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash?.([]);
        // chequered strip
        for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#111' : '#f3f3f3'; ctx.fillRect(x - 32 + i * 8, y - 4, 8, 8); }
        ctx.fillStyle = '#10141ccc'; ctx.fillRect(x - 70, y - R.START_RADIUS - 26, 140, 20);
        ctx.fillStyle = '#ffd970'; ctx.font = 'bold 11px monospace';
        const medal = state.medals[race.id] ? R.MEDALS.find((m) => m.id === state.medals[race.id]).icon + ' ' : '';
        ctx.fillText(cd ? `${race.name} · ${Math.ceil(cd / 1000)}s` : `🏁 ${medal}${race.name}`, x, y - R.START_RADIUS - 16);
        ctx.globalAlpha = 1;
      }
    }
    if (run && run.phase === 'racing') {
      const pts = run.race.points;
      for (let i = run.cp; i < Math.min(pts.length, run.cp + 2); i++) {
        const [x, y] = pts[i], next = i === run.cp, last = i === pts.length - 1;
        ctx.globalAlpha = next ? 1 : 0.35;
        ctx.strokeStyle = last ? '#7cdeb5' : '#ff4fd8'; ctx.lineWidth = next ? 5 : 3;
        ctx.beginPath(); ctx.arc(x, y, R.CP_RADIUS * (next ? 0.9 + 0.08 * Math.sin(t * 6) : 0.8), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle; ctx.font = 'bold 13px monospace'; ctx.fillText(last ? 'FINISH' : String(i), x, y);
      }
      ctx.globalAlpha = 1;
      // guide arrow around the car
      const [cx, cy] = pts[run.cp], a = Math.atan2(cy - p.y, cx - p.x);
      ctx.translate(p.x + Math.cos(a) * 46, p.y + Math.sin(a) * 46); ctx.rotate(a);
      ctx.fillStyle = '#ff4fd8'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // Race starts are listed as encounter locations so the city map/GPS can route to them. On foot, USE
  // there explains how to start (races begin by driving into the ring).
  const SITES = () => R.RACES.map((r) => ({ id: 'race-' + r.id, type: 'race', x: r.points[0][0], y: r.points[0][1], ready: true, color: '#ff4fd8',
    label: '🏁 ' + r.name.toUpperCase(), action: 'RACE', hint: `Street race · drive into the ring to start (gold ${R.fmt(R.par(r))})` }));
  const E = root.NightshiftEncounters;
  if (E && !E.__races) {
    const draw = E.draw, locs = E.locations, use = E.use;
    E.draw = function () { const r = draw.apply(this, arguments); try { drawWorld(); } catch { /* cosmetic */ } return r; };
    E.locations = function () { const list = locs.apply(this, arguments) || []; return run ? list : [...list, ...SITES()]; };
    E.use = function (id) {
      if (typeof id === 'string' && id.startsWith('race-')) {
        const r = R.BY_ID[id.slice(5)], best = r && state.best[r.id];
        say(`🏁 ${r ? r.name : 'Race'} · get in a car and drive into the ring to start${best ? ` · your best ${R.fmt(best)}` : ''}`);
        return true;
      }
      return use.apply(this, arguments);
    };
    E.__races = true;
  }

  // ---- HUD ----
  const css = document.createElement('style');
  css.textContent = `#rcHud{position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:24;pointer-events:none;background:#10141cdd;border:1px solid #ff4fd8;border-radius:10px;
    color:#fff;font:700 12px ui-monospace,Menlo,monospace;padding:6px 12px;white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis}#rcHud[hidden]{display:none}`;
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'rcHud'; hud.hidden = true; document.body.append(hud);
  let hideAt = 0;
  function hudMsg(text, hold = 0) { hud.textContent = text; hud.hidden = false; hideAt = hold ? now() + hold : 0; }
  setInterval(() => { if (hideAt && now() > hideAt && !run) { hud.hidden = true; hideAt = 0; } }, 250);
  setInterval(tick, 50);

  root.NightshiftRaces = Object.freeze({ get state() { return state; }, active: () => (run ? { id: run.race.id, phase: run.phase, cp: run.cp } : null), cancel: () => end(false, 'Cancelled'), starts: () => R.RACES.map((r) => ({ id: r.id, x: r.points[0][0], y: r.points[0][1] })) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
