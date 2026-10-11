/* Nightshift City Online — shared-world layer for the game (Claude-owned).
 * Loaded AFTER the game's own scripts by the generated online.html; it never
 * edits game files. It reads the game's globals (player, camera, g, lastDraw),
 * reports the player's position to the server, and draws other players, names,
 * chat and an online badge on top of the game's frame.
 * Phase 1: you see and chat with everyone in the same city. Money, items and
 * combat stay in each player's own game until server authority replaces them.
 * URL options: ?offline=1 (play solo), ?server=wss://host (another server).
 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('offline') === '1' || !globalThis.NightshiftNet) return;
  // The game's script-level globals (shared by all classic scripts on the page).
  const G = {
    get player() { return typeof player !== 'undefined' ? player : null; }, // eslint-disable-line no-undef
    get camera() { return typeof camera !== 'undefined' ? camera : null; }, // eslint-disable-line no-undef
    get ctx() { return typeof g !== 'undefined' ? g : null; }, // eslint-disable-line no-undef
    get lastDraw() { return typeof lastDraw !== 'undefined' ? lastDraw : null; }, // eslint-disable-line no-undef
    get bullets() { return typeof bullets !== 'undefined' ? bullets : null; }, // eslint-disable-line no-undef
    say(text) { try { say(text); } catch { /* game toast unavailable */ } }, // eslint-disable-line no-undef
  };
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const server = params.get('server') || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/';

  // ---------- UI (all text via textContent; chat can never inject HTML) ----------
  const css = document.createElement('style');
  css.textContent = `
  #nsOnline{position:fixed;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:30;display:flex;gap:6px;align-items:center;font:12px/1.2 ui-monospace,Menlo,monospace;color:#e8eff7}
  #nsOnline .badge{background:#101728d9;border:1px solid #5e7793;border-radius:999px;padding:5px 10px;white-space:nowrap}
  #nsOnline button{font:inherit;font-size:15px;background:#101728d9;border:1px solid #5e7793;border-radius:999px;color:#e8eff7;min-width:34px;height:28px}
  #nsOnline .pvp{font-size:11px;font-weight:bold;padding:0 9px} #nsOnline .pvp.on{background:#7a1f2bdd;border-color:#ff7d7d}
  #nsChatLog{position:fixed;top:calc(max(10px,env(safe-area-inset-top)) + 34px);left:50%;transform:translateX(-50%);z-index:30;width:min(92vw,420px);display:grid;gap:3px;pointer-events:none;font:12px ui-monospace,Menlo,monospace;color:#e8eff7}
  #nsChatLog div{background:#000a;padding:3px 8px;border-radius:6px;overflow-wrap:anywhere;animation:nsfade 9s forwards}
  #nsChatLog b{color:#ffe99b} #nsChatLog .city b{color:#a9c6ff} #nsChatLog .server b{color:#7cdeb5}
  @keyframes nsfade{0%,80%{opacity:1}100%{opacity:0}}
  #nsChatBar{position:fixed;top:calc(max(10px,env(safe-area-inset-top)) + 34px);left:50%;transform:translateX(-50%);z-index:31;width:min(94vw,460px);display:flex;gap:6px}
  #nsChatBar[hidden],#nsJoin[hidden]{display:none}
  #nsChatBar input,#nsJoin input{flex:1;min-width:0;font:16px ui-monospace,Menlo,monospace;padding:9px;border-radius:8px;border:1px solid #5e7793;background:#15233a;color:#e8eff7}
  #nsChatBar button,#nsJoin button{font:bold 13px ui-monospace,Menlo,monospace;border-radius:8px;border:1px solid #5e7793;background:#2c4c7c;color:#e8eff7;padding:0 12px}
  #nsJoin{position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:#0a1321e6;font:14px ui-monospace,Menlo,monospace;color:#e8eff7}
  #nsJoin form{display:grid;gap:10px;width:min(320px,86vw)} #nsJoin p{margin:0;color:#9fb3c8}
  `;
  document.head.appendChild(css);
  const el = (tag, attrs = {}, text) => { const e = document.createElement(tag); Object.assign(e, attrs); if (text) e.textContent = text; return e; };
  const bar = el('div', { id: 'nsOnline' });
  const badge = el('span', { className: 'badge' }, 'connecting…');
  const chatBtn = el('button', { type: 'button', ariaLabel: 'Chat' }, '💬');
  const pvpBtn = el('button', { type: 'button', className: 'pvp', title: 'Player-vs-player: only players who both switch it on can hurt each other' }, 'PVP OFF');
  bar.append(badge, chatBtn, pvpBtn);
  const log = el('div', { id: 'nsChatLog' });
  log.setAttribute('aria-live', 'polite');
  const chatBar = el('form', { id: 'nsChatBar', hidden: true });
  const chBtn = el('button', { type: 'button' }, 'NEAR');
  const chatInput = el('input', { maxLength: 120, placeholder: 'Say something…', autocomplete: 'off', enterKeyHint: 'send' });
  chatBar.append(chBtn, chatInput, el('button', {}, 'SEND'));
  document.body.append(bar, log, chatBar);

  // Typing in our inputs must never reach the game's movement keys.
  for (const ev of ['keydown', 'keyup', 'keypress']) {
    chatBar.addEventListener(ev, (e) => e.stopPropagation());
  }

  let net = null, me = null, myId = null, others = [], chatCh = 'near';
  const tracers = [];
  const seenBullets = new WeakSet();
  pvpBtn.addEventListener('click', () => { if (net && me) net.setPvp(!me.pvp); });
  function onEvent(e) {
    if (e.kind === 'shot') tracers.push({ x: e.x, y: e.y, aim: e.aim, len: e.len, until: performance.now() + 120 });
    else if (e.kind === 'shot-hit') {
      // Apply through the game's own damage path (safe zones, death, respawn).
      const R = globalThis.NightshiftRecovery, p = G.player;
      if (R && typeof R.damage === 'function') R.damage(e.damage, performance.now());
      else if (p) p.hp = Math.max(0, p.hp - e.damage);
      G.say('Shot by ' + e.byName);
    } else if (e.kind === 'hit-confirm') G.say('Hit ' + e.targetName);
  }
  const bubbles = new Map();

  function addChat(m) {
    const line = el('div', { className: m.from === 'server' ? 'server' : m.ch });
    line.append(el('b', {}, (m.ch === 'city' && m.from !== 'server' ? '[city] ' : '') + m.name + ': '), document.createTextNode(m.text));
    log.append(line);
    while (log.children.length > 5) log.firstChild.remove();
    setTimeout(() => line.remove(), 9000);
    if (m.ch === 'near') bubbles.set(m.from, { text: m.text, until: performance.now() + 5000 });
  }
  const STATUS = { connecting: 'connecting…', offline: 'offline · retrying', replaced: 'signed in on another device',
    rejected: 'server refused', banned: 'banned', kicked: 'kicked by a moderator', closed: 'offline' };
  function refreshBadge() {
    const s = net ? net.status : 'connecting';
    if (s !== 'online') { badge.textContent = '○ ' + (STATUS[s] || s); return; }
    badge.textContent = '● ONLINE · ' + (others.length ? others.length + ' nearby' : 'nobody nearby');
  }

  chatBtn.addEventListener('click', () => { chatBar.hidden = false; log.style.top = 'calc(max(10px,env(safe-area-inset-top)) + 76px)'; chatInput.focus(); });
  chBtn.addEventListener('click', () => { chatCh = chatCh === 'near' ? 'city' : 'near'; chBtn.textContent = chatCh.toUpperCase(); });
  function closeChat() { chatBar.hidden = true; log.style.top = ''; chatInput.blur(); }
  chatBar.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = chatInput.value.trim();
    if (t && net) net.chat(chatCh, t);
    chatInput.value = '';
    closeChat();
  });
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeChat(); });

  // ---------- join ----------
  function start(name) {
    net = NightshiftNet.createClient({
      url: server, name, mode: 'presence', token: store.get('nsco-online-token'),
      onWelcome: (w) => { myId = w.id; store.set('nsco-online-token', w.token); addChat({ from: 'server', name: 'ONLINE', ch: 'city', text: (w.resumed ? 'Welcome back, ' : 'Welcome, ') + w.you.name + ' — you share this city with other players.' }); },
      onChat: addChat,
      onEvent,
      onResult: (r) => { if (r.req === 'pvp' && r.ok) G.say(r.pvp ? 'PvP ON · only other PvP players can hurt you' : 'PvP OFF'); },
      onStatus: refreshBadge,
    });
  }
  const savedName = store.get('nsco-online-name');
  if (savedName && /^[\w .-]{1,20}$/.test(savedName)) start(savedName);
  else {
    const join = el('div', { id: 'nsJoin' });
    const form = el('form');
    const input = el('input', { maxLength: 20, placeholder: 'Your name', autocomplete: 'off', required: true });
    form.append(el('h2', {}, 'Nightshift City · Online'), el('p', {}, 'Pick a name to share the city with other players.'), input,
      el('button', {}, 'PLAY ONLINE'), el('p', {}, 'Phase 1: see and chat with everyone. Money, items and combat are still your own for now.'));
    join.append(form);
    for (const ev of ['keydown', 'keyup', 'keypress']) join.addEventListener(ev, (e) => e.stopPropagation());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!/^[\w .-]{1,20}$/.test(name)) { input.value = ''; input.placeholder = 'Letters, numbers, space . _ - only'; return; }
      store.set('nsco-online-name', name);
      join.remove();
      start(name);
    });
    document.body.append(join);
    setTimeout(() => input.focus(), 50);
  }

  // ---------- per frame: report, then draw others over the game's frame ----------
  const palette = ['#e46b6b', '#7ba7e0', '#c792ea', '#f2a65a', '#7cdeb5', '#e8d078', '#ff8fb1', '#9ad06b'];
  const colorFor = (id) => palette[[...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % palette.length];
  let last = performance.now(), lastBadge = 0;

  function frame(now) {
    const dt = now - last; last = now;
    const p = G.player;
    if (net && p) {
      net.setPosition({ x: p.x, y: p.y, aim: p.angle || 0, car: p.car ? { angle: p.car.angle || 0, color: p.car.color } : null });
      // Report the game's own new shots (the player's bullets start at the player).
      for (const b of G.bullets || []) {
        if (seenBullets.has(b)) continue;
        seenBullets.add(b);
        if (b.origin && Math.hypot(b.origin.x - p.x, b.origin.y - p.y) < 40 && Number.isFinite(b.vx) && Number.isFinite(b.vy)) net.fire(Math.atan2(b.vy, b.vx));
      }
      const view = net.update(dt);
      me = view.me; others = view.others;
      if (now - lastBadge > 500) {
        refreshBadge(); lastBadge = now;
        pvpBtn.textContent = me && me.pvp ? 'PVP ON' : 'PVP OFF';
        pvpBtn.classList.toggle('on', !!(me && me.pvp));
      }
      // Only draw when the game drew this frame (menus pause the game's drawing).
      if (G.lastDraw === now && !globalThis.NightshiftHome?.paused?.()) draw(now);
    }
    requestAnimationFrame(frame);
  }

  function draw(now) {
    const ctx = G.ctx, cam = G.camera;
    if (!ctx || !cam) return;
    ctx.save();
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    ctx.lineWidth = 2;
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      if (now > t.until) { tracers.splice(i, 1); continue; }
      ctx.strokeStyle = '#ffe99bcc';
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + Math.cos(t.aim) * t.len, t.y + Math.sin(t.aim) * t.len); ctx.stroke();
    }
    for (const o of others) {
      const color = colorFor(o.id);
      try {
        if (o.car) NightshiftSprites.car({ x: o.x, y: o.y, angle: o.car.angle, color: o.car.color || color, speed: 0 });
        else NightshiftSprites.person({ x: o.x, y: o.y, angle: o.aim, color, hp: 100, maxHp: 100 }, false);
      } catch {
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(o.x, o.y, 12, 0, 7); ctx.fill();
      }
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000a'; ctx.fillText(o.name, o.x + 1, o.y - 33);
      ctx.fillStyle = o.pvp ? '#ff7d7d' : color; ctx.fillText((o.pvp ? '⚔ ' : '') + o.name, o.x, o.y - 34);
    }
    for (const [pid, b] of bubbles) {
      if (now > b.until) { bubbles.delete(pid); continue; }
      const at = pid === myId ? G.player : others.find((o) => o.id === pid);
      if (!at) continue;
      const text = b.text.length > 40 ? b.text.slice(0, 39) + '…' : b.text;
      ctx.font = '11px monospace';
      const w = ctx.measureText(text).width + 12;
      ctx.fillStyle = '#f2f5f9ee'; ctx.fillRect(at.x - w / 2, at.y - 66, w, 18);
      ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.fillText(text, at.x, at.y - 53);
    }
    ctx.restore();
  }
  requestAnimationFrame(frame);

  globalThis.NightshiftOnline = { get status() { return net ? net.status : 'joining'; }, get others() { return others; }, get id() { return myId; } };
})();
