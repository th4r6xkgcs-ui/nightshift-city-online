/* Multiplayer client (Claude-owned, v0.66). Requires net-protocol.js; uses combat-core.js for hit events.
 * Off unless you point it at a room: open the game with ?mp=wss://<server>/room/<name> (remembered), ?mp=off to stop,
 * ?name=<you> to set your name. Nothing changes for single player when it's off.
 *  - sends your state ~10 Hz (city / highway / zones), with a teleport flag for legit jumps (exits, respawns)
 *  - other players are drawn ~120 ms in the past, interpolated between server snapshots (smooth on phones)
 *  - in the city: on foot (character) or in their car (their model + paint) with a name tag; on Route 9: their car
 *  - PvP rooms (?mode=pvp on the room URL): your bullets that cross another player become hit claims the server
 *    checks (range, fire rate, positions with lag compensation) before the victim takes damage. PvE rooms: no
 *    friendly fire.
 *  - clock sync by ping, a small 🌐 chip shows players online + latency.
 * API: NightshiftNet.{on, connect, disconnect, players, stats, drawHighway} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const NP = root.NightshiftNetProtocol, K = root.NightshiftCombatCore; if (!NP) return;
  const P = () => { try { return player; } catch { return null; } }; // eslint-disable-line no-undef
  const st = { sent: 0, recv: 0, snaps: 0, hitsSent: 0, hitsIn: 0, denies: 0, rtt: 0 };
  const remotes = new Map(); // id -> { name, buf }
  let ws = null, myId = null, mode = 'pve', offset = 0, url = null, retry = 0, lastSend = 0, lastPos = null;
  const qs = new URLSearchParams(location.search);
  try { if (qs.get('mp') === 'off') localStorage.removeItem('nightshift-mp-url'); else if (qs.get('mp')) localStorage.setItem('nightshift-mp-url', qs.get('mp')); if (qs.get('name')) localStorage.setItem('nightshift-mp-name', qs.get('name')); } catch { /* private */ }
  try { url = localStorage.getItem('nightshift-mp-url'); } catch { url = qs.get('mp'); }
  const myName = () => { try { return localStorage.getItem('nightshift-mp-name') || 'Player-' + (localStorage.getItem('nightshift-mp-tag') || (() => { const t = Math.random().toString(36).slice(2, 6); localStorage.setItem('nightshift-mp-tag', t); return t; })()); } catch { return 'Player'; } };
  const serverNow = () => Date.now() + offset;

  function connect(u = url) {
    if (!u || ws) return; url = u;
    try { ws = new WebSocket(u); } catch (e) { console.warn('mp', e); return; }
    ws.onopen = () => { retry = 0; const p = P(); ws.send(NP.enc('hello', NP.PROTOCOL, myName(), { car: p?.car?.model || null, color: p?.car?.color || null })); ping(); chip(); };
    ws.onmessage = (e) => { st.recv++; let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
    ws.onclose = () => { ws = null; myId = null; remotes.clear(); chip(); if (url) setTimeout(() => connect(url), Math.min(15000, 1000 * 2 ** retry++)); };
    ws.onerror = () => { /* onclose follows */ };
  }
  function disconnect() { url = null; try { localStorage.removeItem('nightshift-mp-url'); } catch { /* n/a */ } if (ws) ws.close(); ws = null; chip(); }
  let pingAt = 0; function ping() { if (ws?.readyState === 1) { pingAt = Date.now(); ws.send(NP.enc('ping', pingAt)); } }
  function onMsg(m) {
    switch (m[0]) {
      case 'welcome': myId = m[1]; mode = m[3]; offset = m[2] - Date.now(); for (const r of m[4] || []) { const s = NP.unrow(r); add(s.id, s.name); NP.push(remotes.get(s.id).buf, m[2], s); } say(`🌐 Online · ${mode === 'pvp' ? 'PvP room' : 'co-op room'} · ${remotes.size} other player${remotes.size === 1 ? '' : 's'} here`); break;
      case 'join': add(m[1], m[2]); say(`🌐 ${m[2]} joined`); break;
      case 'leave': { const r = remotes.get(m[1]); if (r) say(`🌐 ${r.name} left`); remotes.delete(m[1]); break; }
      case 'snap': st.snaps++; for (const row of m[2]) { const s = NP.unrow(row); if (s.id === myId) continue; add(s.id, s.name); NP.push(remotes.get(s.id).buf, m[1], s); } break;
      case 'pong': { const c = NP.clockOffset(m[1], m[2], Date.now()); st.rtt = Math.round(c.rtt); offset = offset * 0.7 + c.offset * 0.3; break; }
      case 'hit': if (K) { const ev = K.unpack(m[1]); if (ev.dst === myId) { st.hitsIn++; try { root.NightshiftRecovery?.damage?.(ev.hp, performance.now(), { x: ev.fx, y: ev.fy, team: 'player', kind: ev.kind }); } catch { /* n/a */ } } else if (ev.src === myId) { try { root.NightshiftFeedback?.hit?.(); } catch { /* n/a */ } } } break;
      case 'deny': st.denies++; break;
      case 'chat': { const r = remotes.get(m[1]); say(`💬 ${r?.name || 'someone'}: ${m[2]}`); break; }
    }
    chip();
  }
  function add(id, name) { if (id === myId) return; if (!remotes.has(id)) remotes.set(id, { name, buf: NP.buffer() }); else if (name) remotes.get(id).name = name; }

  // ---------- my state ----------
  function myState() {
    const p = P(); if (!p) return null;
    const HW = root.NightshiftHighway?.state?.(), Z = root.NightshiftZones;
    if (HW) return { zone: 'highway', x: HW.d, y: HW.y, a: 0, flags: NP.FLAG.car | (HW.vehicle.v > 5 ? NP.FLAG.moving : 0), car: p.car?.model || null, color: p.car?.color || null };
    const zid = (() => { try { return Z?.active?.(); } catch { return null; } })();
    if (zid) { const pos = Z.pos?.() || p; return { zone: 'zone:' + String(zid).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24), x: pos.x, y: pos.y, a: pos.angle || 0, flags: pos.moving ? 1 : 0, car: null, color: null }; }
    if (root.NightshiftHome?.kind?.()) return null; // inside your apartment: nobody sees you
    const c = p.car; return { zone: 'city', x: c ? c.x : p.x, y: c ? c.y : p.y, a: c ? c.angle : p.angle || 0, flags: (p.moving || Math.abs(c?.speed || 0) > 0.2 ? NP.FLAG.moving : 0) | (c ? NP.FLAG.car : 0) | (p.downed ? NP.FLAG.downed : 0), car: c?.model || null, color: c?.color || null };
  }
  function sendTick(now) {
    if (ws?.readyState !== 1 || !myId || now - lastSend < 1000 / NP.SEND_HZ) return; lastSend = now;
    const s = myState(); if (!s) return;
    let flags = s.flags; if (lastPos && (lastPos.zone !== s.zone || Math.hypot(s.x - lastPos.x, s.y - lastPos.y) > 300)) flags |= NP.FLAG.teleport; lastPos = s;
    ws.send(NP.enc('st', serverNow(), Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10, Math.round(s.a * 100) / 100, s.zone, flags, s.car, s.color)); st.sent++;
    if (now - pingAt > 2000) ping();
  }
  // ---------- remote players ----------
  function view(zone) { const t = serverNow() - NP.DELAY_MS, out = []; for (const [id, r] of remotes) { const s = NP.sample(r.buf, t); if (s && s.zone === zone && serverNow() - r.buf.snaps.at(-1).t < 5000) out.push({ id, name: r.name, ...s }); } return out; }
  function tag(c, x, y, name, pvp) { c.save(); c.font = '700 9px ui-monospace,Menlo,monospace'; c.textAlign = 'center'; const w = c.measureText(name).width + 10; c.fillStyle = '#0c111ee0'; c.fillRect(x - w / 2, y - 10, w, 13); c.fillStyle = pvp ? '#ff9a9a' : '#9fe0ff'; c.fillText(name, x, y); c.restore(); }
  function drawCity() {
    let c = null; try { c = g; } catch { return; } // eslint-disable-line no-undef
    const p = P(); if (!c || !p || !remotes.size) return;
    for (const r of view('city')) {
      if (Math.abs(r.x - p.x) > 1000 || Math.abs(r.y - p.y) > 700) continue;
      if (r.flags & NP.FLAG.car) { try { root.NightshiftSprites?.car?.({ id: 'mp-' + r.id, x: r.x, y: r.y, angle: r.a, model: r.car || 'SEDAN', color: r.color || '#7d8796', speed: r.flags & 1 ? 3 : 0, owned: false }); } catch { /* n/a */ } tag(c, r.x, r.y - 30, r.name, mode === 'pvp'); }
      else { const prev = r.__walk || 0; try { root.NightshiftSprites?.person?.({ id: 'mp-' + r.id, x: r.x, y: r.y, angle: r.a, moveAngle: r.a, moving: !!(r.flags & 1), walkTicks: (performance.now() / 16) % 1000, hp: r.flags & NP.FLAG.downed ? 1 : 100, squat: !!(r.flags & NP.FLAG.downed) }, false, {}); } catch { /* n/a */ } void prev; tag(c, r.x, r.y - 46, r.name, mode === 'pvp'); }
    }
  }
  function drawHighway(c, X, Y, z, me) {
    for (const r of view('highway')) { const s = root.NightshiftCars?.sprite?.(root.NightshiftCarsData?.fromModel?.(r.car)?.id || r.car || 'SEDAN', r.color || '#7d8796'); const x = X(r.x), y = Y(r.y); if (x < -100 || x > innerWidth + 100) continue; if (s) { c.drawImage(s.cv, x - s.w / 2 * z, y - s.h / 2 * z, s.w * z, s.h * z); } tag(c, x, y - 26 * z, r.name, false); void me; }
  }
  // ---------- PvP: my bullets vs remote players ----------
  function bulletsVsPlayers() {
    if (mode !== 'pvp' || !K || ws?.readyState !== 1) return;
    let B = []; try { B = bullets; } catch { return; } if (!B.length) return; // eslint-disable-line no-undef
    const others = view('city'); if (!others.length) return; const p = P();
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i], end = { x: b.x + b.vx, y: b.y + b.vy };
      for (const r of others) {
        const t = root.NightshiftNavigation?.segmentCircle?.(b, end, r, r.flags & NP.FLAG.car ? 24 : 13); if (t === null || t === undefined) continue;
        let w = null; try { w = K.normalize(root.NightshiftWeapons?.current?.() || { dmg: 20 }); } catch { w = K.normalize({ dmg: 20 }); }
        const res = K.resolve({ weapon: w, dist: Math.hypot(r.x - (b.ox ?? p.x), r.y - (b.oy ?? p.y)), target: { stance: r.flags & NP.FLAG.car ? 'car' : 'stand' } });
        const ev = K.hitEvent({ seq: st.hitsSent + 1, t: serverNow() - NP.DELAY_MS, src: myId, dst: r.id, weapon: w.id, kind: 'bullet', seed: b.seed || 0, from: { x: p.x, y: p.y }, to: { x: r.x, y: r.y }, hp: res.hp, armor: 0, result: 'hurt' });
        ws.send(NP.enc('hit', K.pack(ev))); st.hitsSent++; B.splice(i, 1);
        try { root.NightshiftFeedback?.burst?.(r.x, r.y, 'hit'); } catch { /* n/a */ } break;
      }
    }
  }
  // ---------- chip ----------
  const chipEl = document.createElement('div'); chipEl.id = 'mpChip'; chipEl.style.cssText = 'position:fixed;z-index:24;left:50%;transform:translateX(-50%);bottom:6px;padding:3px 9px;border-radius:9px;background:#0c111ed0;border:1px solid #2f4669;color:#9fe0ff;font:700 10px ui-monospace,Menlo,monospace;pointer-events:none;display:none'; document.body.appendChild(chipEl);
  function chip() { if (!url) { chipEl.style.display = 'none'; return; } chipEl.style.display = 'block'; chipEl.textContent = ws?.readyState === 1 && myId ? `🌐 ${remotes.size + 1} online · ${mode === 'pvp' ? 'PvP' : 'co-op'} · ${st.rtt} ms` : '🌐 connecting…'; }
  // ---------- hooks + loop ----------
  const hook = setInterval(() => { const C = root.NightshiftCrime; if (C && typeof C.draw === 'function' && !C.__net) { const d0 = C.draw; C.draw = function () { const r = d0.apply(this, arguments); try { drawCity(); } catch { /* cosmetic */ } return r; }; C.__net = true; clearInterval(hook); } }, 300);
  (function loop(now) { try { sendTick(now); bulletsVsPlayers(); } catch (e) { console.error(e); } requestAnimationFrame(loop); })(performance.now());
  if (url) setTimeout(() => connect(url), 1500);
  root.NightshiftNet = Object.freeze({ on: () => ws?.readyState === 1 && !!myId, connect, disconnect, id: () => myId, mode: () => mode, players: () => [...remotes.entries()].map(([id, r]) => ({ id, name: r.name, ...(NP.sample(r.buf, serverNow() - NP.DELAY_MS) || {}) })), stats: () => ({ ...st, remotes: remotes.size }), drawHighway, chat: (t) => ws?.readyState === 1 && ws.send(NP.enc('chat', t)) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
