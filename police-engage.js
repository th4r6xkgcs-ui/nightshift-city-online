/* Police engagement (Claude-owned, v0.65). Works on top of crime.js officers + wanted-data.js levels.
 * How cops engage now:
 *  ★1  "Police! Don't move!" — they walk up to cuff you. Run and they TASE you (short range, dodge with ROLL).
 *  ★2  tasers first; guns only if you're armed and showing it (fired / hurt a cop recently).
 *  ★3  lethal: they shoot on sight, from cover, but miss a lot if you move or duck.
 *  ★4-5 SWAT: body armor (needs rifles/shotguns up close to get through), faster, better shots.
 *  Tased or downed suspects get CUFFED (BUSTED: a fine, no items lost) — cops never shoot a downed suspect.
 *  Officer down = more heat. Radio call-outs over their heads tell you what they're about to do.
 *  Break-in alarms: when you come out of a place with the alarm going, units are waiting at the door.
 * Multiplayer later: wanted level, tasers and cuffing are per player and resolved by the authority; officers
 * pick the nearest wanted player they can see.
 * API: NightshiftPolice.{stats, respond} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const P = () => { try { return player; } catch { return null; } }; // eslint-disable-line no-undef
  const st = { tasers: 0, barks: 0, responders: 0, downs: 0 };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const BARK = {
    spot: ['Police! Don\'t move!', 'Hands where I can see them!', 'Stop right there!', 'On the ground, now!'],
    taser: ['Taser! Taser!', 'Stop resisting!', 'Taser, taser, taser!'],
    shots: ['Shots fired! Shots fired!', 'Suspect is armed!', 'He\'s got a gun!'],
    cuff: ['Suspect down, cuffing!', 'Hands behind your back!', 'Don\'t you move!'],
    down: ['Officer down! Officer down!', 'We\'ve got a man down!', 'Need backup NOW!'],
    lost: ['Lost visual.', 'Where\'d he go?', 'Spread out, check the alleys.'],
    swat: ['SWAT on scene!', 'Breach and clear!', 'Contact front!'],
  };
  function bark(o, kind, force) { const now = performance.now(); if (!force && now < (o.barkCool || 0)) return; o.bark = { t: pick(BARK[kind]), until: now + 1700 }; o.barkCool = now + 4000; st.barks++; }
  const stars = () => { try { return root.NightshiftWantedData?.stars?.(P()?.heat || 0) || 0; } catch { return 0; } };
  const armedRecently = () => { try { return performance.now() < (root.NightshiftCrime?.wanted?.armedUntil || 0); } catch { return false; } };
  const see = (o, p, range) => { try { return root.NightshiftCrime.sight(o, p, blocked, range); } catch { return false; } }; // eslint-disable-line no-undef

  function tick(now) {
    const C = root.NightshiftCrime, p = P(); if (!C?.officers || !p) return;
    const S = stars(), downed = !!p.downed;
    let shotsBarked = false;
    for (const o of C.officers) {
      if (o.swat && !o.__armored) { o.__armored = true; o.armor = S >= 5 ? 60 : 45; bark(o, 'swat'); }
      const vis = see(o, p, 300), d = dist(o, p);
      if (vis && !o.spotted) { o.spotted = true; bark(o, 'spot', true); }
      if (!vis && o.spotted && o.mode === 'search' && !o.lostBarked) { o.lostBarked = true; bark(o, 'lost'); }
      if (vis) o.lostBarked = false;
      if (downed && d < 220) { if (!o.cuffBark) { o.cuffBark = true; bark(o, 'cuff', true); } } else o.cuffBark = false;
      // tasers: ★1 when you run, ★2 unless you're showing a gun (then crime.js uses guns)
      const taserLevel = S === 1 ? p.moving : S === 2 && !armedRecently();
      if (taserLevel && !downed && !p.car && vis && d < 135 && d > 18 && now > (o.nextTaser ?? (o.nextTaser = now + 700)) && now > (o.suppressedUntil || 0)) {
        o.nextTaser = now + 2600 + Math.random() * 900; o.nextAttack = Math.max(o.nextAttack || 0, now + 1200);
        const lead = p.moving && Number.isFinite(p.moveAngle) ? 10 : 0, tx = p.x + Math.cos(p.moveAngle || 0) * lead, ty = p.y + Math.sin(p.moveAngle || 0) * lead;
        const a = Math.atan2(ty - o.y, tx - o.x) + (Math.random() * 2 - 1) * 0.12;
        C.projectiles.push({ x: o.x, y: o.y, ox: o.x, oy: o.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, life: 0.5, dmg: 2, kind: 'taser', from: o });
        o.angle = a; st.tasers++; bark(o, 'taser', true);
      }
      if (S >= 3 && vis && !shotsBarked && !o.shotsBarked && (armedRecently() || S >= 3)) { o.shotsBarked = true; shotsBarked = true; if (armedRecently()) bark(o, 'shots'); }
    }
  }
  // officers dying -> someone calls it in, heat goes up
  root.addEventListener('ns:event', (e) => {
    const ev = e.detail; if (!ev) return; const C = root.NightshiftCrime, p = P();
    if (ev.type === 'officer-down' && C?.officers && p) { st.downs++; const o = C.officers.filter((q) => q.hp > 0).sort((a, b) => dist(a, ev) - dist(b, ev))[0]; if (o) bark(o, 'down', true); p.heat = Math.min(5, (p.heat || 0) + 0.5); try { C.report?.(p, performance.now(), 'radio'); } catch { /* n/a */ } }
    if (ev.type === 'breakin-exit' && ev.alarm) respond(ev.x, ev.y, ev.units || 2);
  });
  // units waiting outside a door (break-in alarm, store robbery, ...)
  function respond(x, y, n = 2) {
    const C = root.NightshiftCrime, p = P(); if (!C?.officers || !p || !Number.isFinite(x)) return 0;
    p.heat = Math.max(p.heat || 0, 2.2);
    try { C.report?.({ x, y }, performance.now(), 'alarm'); } catch { /* n/a */ }
    let made = 0;
    for (let k = 0; k < n * 4 && made < n; k++) {
      const a = Math.PI / 2 + (k % 2 ? 1 : -1) * (0.5 + 0.3 * Math.floor(k / 2)), r = 70 + 12 * Math.floor(k / 2), ox = x + Math.cos(a) * r, oy = y + Math.sin(a) * r * 0.6;
      let bad = false; try { bad = blocked(ox, oy); } catch { /* n/a */ } if (bad) continue; // eslint-disable-line no-undef
      const L = root.NightshiftWantedData?.level?.(p.heat) || { hp: 60 };
      const o = { x: ox, y: oy, hp: L.hp || 60, maxHp: L.hp || 60, swat: !!L.swat, role: 'officer', id: 'cop-' + Math.floor(Math.random() * 1e6), nextAttack: performance.now() + 1400, color: L.swat ? '#2a3340' : '#7798de', angle: Math.atan2(y - oy, x - ox), searchIndex: C.officers.length * 2, slot: C.officers.length };
      C.officers.push(o); bark(o, 'spot', true); made++;
    }
    st.responders += made; if (made) say('🚔 Police were waiting outside!');
    return made;
  }
  // draw: taser wires + radio call-outs
  function draw() {
    let ctx = null; try { ctx = g; } catch { return; } // eslint-disable-line no-undef
    const C = root.NightshiftCrime, p = P(); if (!ctx || !C || !p) return; const now = performance.now();
    ctx.save();
    for (const b of C.projectiles) if (b.kind === 'taser') { ctx.strokeStyle = 'rgba(150,230,255,0.8)'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(b.ox, b.oy); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#e0f8ff'; ctx.beginPath(); ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = '700 8px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
    for (const o of C.officers) {
      if (o.armor > 0) { ctx.fillStyle = '#9fb3c8'; ctx.fillRect(o.x - 7, o.y - 44, 14 * Math.min(1, o.armor / 60), 2); }
      if (!o.bark || now > o.bark.until || dist(o, p) > 700) continue;
      const w = ctx.measureText(o.bark.t).width + 8, y = o.y - 54; ctx.fillStyle = '#0c1430e8'; ctx.fillRect(o.x - w / 2, y - 9, w, 12); ctx.fillStyle = '#9fc8ff'; ctx.fillText(o.bark.t, o.x, y);
    }
    ctx.restore();
  }
  const hook = setInterval(() => { const C = root.NightshiftCrime; if (C && typeof C.draw === 'function' && !C.__engage) { const d0 = C.draw; C.draw = function () { const r = d0.apply(this, arguments); try { draw(); } catch { /* cosmetic */ } return r; }; C.__engage = true; clearInterval(hook); } }, 300);
  (function loop(now) { try { tick(now); } catch (e) { console.error(e); } requestAnimationFrame(loop); })(performance.now());
  root.NightshiftPolice = Object.freeze({ stats: () => ({ ...st }), respond, bark });
})(typeof globalThis !== 'undefined' ? globalThis : this);
