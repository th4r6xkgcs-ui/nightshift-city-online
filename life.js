/* City life in game (Claude-owned). Requires life-data.js (+ starter-home.js early in the page).
 * 1) Spawn: every session starts inside your apartment (bed/wardrobe/storage; EXIT puts you on the
 *    sidewalk in front of the APARTMENTS block).
 * 2) Car radio: a station pill while driving (tap = next station, hold/⏻ = off) with a reactive news + DJ
 *    ticker; procedural music plays when SOUND is on.
 * 3) Contacts text you real tips (club nights, gym mornings, market news, city events); 📱 → 📩 MESSAGES.
 * Save: nightshift-life-v1. API: NightshiftLife.{state, text, open, close, paused, radio, headline} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const L = root.NightshiftLifeData;
  const KEY = 'nightshift-life-v1';
  let state = L.cleanState({});
  try { state = L.cleanState(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const minute = () => root.NightshiftEnvironment?.state?.minute ?? 720;
  const DOOR = { x: 950, y: 735 }; // sidewalk in front of the APARTMENTS block (960,755), within the HOME radius

  // ---------- 1) spawn inside the apartment ----------
  const t0 = performance.now();
  let spawned = false;
  const spawnTimer = setInterval(() => {
    const p = P(), H = root.NightshiftHome;
    if (spawned || performance.now() - t0 > 15000) { clearInterval(spawnTimer); return; }
    if (!p || !H?.enter || performance.now() - t0 < 900) return; // let saves load first
    if (p.car) { p.car.speed = 0; p.car = null; }
    p.x = DOOR.x; p.y = DOOR.y;
    if (H.kind?.() === 'home' || H.enter('home')) {
      spawned = true; clearInterval(spawnTimer);
      const first = !state.welcomed; state.welcomed = true; persist();
      setTimeout(() => say(first ? '🏠 Welcome home. This apartment is yours: REST in bed, STYLE at the wardrobe, STORE items. Walk to the door at the bottom and USE EXIT to hit the streets.'
        : `🏠 You wake up at home · ${L.hhmm(minute())} · walk to the door and USE EXIT`), 400);
      if (first) setTimeout(() => text('mom', 'Proud of you for getting your own place, baby. Eat something and call me sometime ❤️'), 9000);
      setTimeout(() => text('rico', 'Yo, you up? Check your 📱 HUSTLE phone, I put some work on there for you.'), first ? 20000 : 6000);
    }
  }, 150);

  // ---------- 3) contacts & messages ----------
  const msgCss = document.createElement('style');
  msgCss.textContent = `
  #lfMsg{position:fixed;inset:6% 6%;z-index:47;overflow:auto;background:linear-gradient(180deg,#141a2af7,#0b0f1cf7);border:1px solid #8fb4ff;border-radius:14px;padding:12px 14px;color:#eaf1ff;font:13px ui-monospace,Menlo,monospace}
  #lfMsg[hidden]{display:none} #lfMsg h2{margin:0;font-size:16px;color:#b6ccff} #lfMsg .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
  #lfMsg button{all:unset;box-sizing:border-box;cursor:pointer;border:1px solid #8fb4ff;border-radius:8px;padding:6px 10px;font:700 12px ui-monospace,Menlo,monospace}
  #lfMsg .m{display:flex;gap:10px;align-items:flex-start;background:#1b2440;border:1px solid #2c3a66;border-radius:12px;padding:8px 10px;margin-top:6px}
  #lfMsg .who{font-weight:700;color:#b6ccff} #lfMsg .when{opacity:.6;font-size:10px} #lfMsg .av{font-size:22px;line-height:1}
  #lfRadio{all:unset;box-sizing:border-box;position:fixed;z-index:26;left:50%;top:max(8px, env(safe-area-inset-top, 0px));transform:translateX(-50%);max-width:min(52vw,520px);overflow:hidden;cursor:pointer;
    background:#0b0d1ae6;border:1px solid var(--rc,#ff4fd8);border-radius:999px;color:#fff;font:600 11px/1.25 ui-monospace,Menlo,monospace;padding:5px 12px 5px 10px;display:flex;gap:8px;align-items:center}
  #lfRadio[hidden]{display:none} #lfRadio .st{white-space:nowrap;color:var(--rc,#ff4fd8);font-weight:800} #lfRadio .tk{white-space:nowrap;overflow:hidden;flex:1;min-width:0}
  #lfRadio .tk span{display:inline-block;padding-left:100%;animation:lfTicker var(--dur,18s) linear infinite} #lfRadio .pw{opacity:.8}
  @keyframes lfTicker{to{transform:translateX(-100%)}}
  @media (orientation:portrait){#lfRadio{top:auto;bottom:calc(14px + env(safe-area-inset-bottom,0px));max-width:calc(100vw - 24px)}}`;
  document.head.appendChild(msgCss);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const msgPanel = el('div', { id: 'lfMsg', hidden: true, role: 'dialog', ariaLabel: 'Messages' });
  document.body.append(msgPanel);
  function text(from, msg) {
    const c = L.CONTACTS[from]; if (!c) return;
    state.log.push({ from, text: String(msg).slice(0, 200), at: Date.now() }); state.log = state.log.slice(-40);
    if (msgPanel.hidden) state.unread = Math.min(99, state.unread + 1);
    persist(); say(`📩 ${c.icon} ${c.name}: ${msg}`);
    try { root.NightshiftAudio?.play('pickup'); } catch { /* sound optional */ }
    if (!msgPanel.hidden) renderMsgs();
  }
  function ago(at) { const s = Math.max(0, Math.round((Date.now() - at) / 1000)); return s < 60 ? 'now' : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; }
  function renderMsgs() {
    msgPanel.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { type: 'button' }, 'CLOSE'); x.onclick = closeMsgs;
    top.append(el('h2', {}, '📩 MESSAGES'), x); msgPanel.append(top);
    if (!state.log.length) msgPanel.append(el('div', {}, 'No messages yet.'));
    for (const m of [...state.log].reverse()) {
      const c = L.CONTACTS[m.from], row = el('div', { className: 'm' }), body = el('div');
      body.append(el('div', { className: 'who' }, `${c.name} · `), el('div', {}, m.text)); body.firstChild.append(el('span', { className: 'when' }, `${c.role} · ${ago(m.at)}`));
      row.append(el('div', { className: 'av' }, c.icon), body); msgPanel.append(row);
    }
  }
  function openMsgs() { try { root.releaseControls?.(); } catch { /* n/a */ } state.unread = 0; persist(); msgPanel.hidden = false; renderMsgs(); }
  function closeMsgs() { msgPanel.hidden = true; }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !msgPanel.hidden) closeMsgs(); });

  // Tip texts tied to real mechanics.
  setInterval(() => {
    if (!spawned) return;
    const M = root.NightshiftMarketData, slot = M ? M.slotOf(Date.now()) : 0, news = M?.news(slot);
    const out = L.texts(state, { at: Date.now(), minute: minute(), marketWindow: news ? news.window : -1, marketText: news?.text, holding: !!Object.keys(root.NightshiftMarket?.state?.hold || {}).length });
    if (out.length) { persist(); out.forEach((m, i) => setTimeout(() => text(m.from, m.text), i * 3500)); }
  }, 5000);
  // City events arrive as texts from Rico (watch NightshiftEvents for new spawns).
  let lastEvent = null;
  setInterval(() => {
    const a = root.NightshiftEvents?.active?.(), key = a ? `${a.type}:${a.x}:${a.y}` : null;
    if (key && key !== lastEvent) { const t = L.EVENT_TEXT[a.type]?.[0]; if (t) setTimeout(() => text(t[0], t[1]), 1800); }
    lastEvent = key;
  }, 500);

  // ---------- 2) news + radio ----------
  function counters() {
    const v = root.NightshiftVenues?.state, h = root.NightshiftHeists?.state;
    return { heists: h?.done || 0, heistBest: h?.best || 0, events: root.NightshiftEvents?.state?.done || 0, fights: v?.wins || 0, ladder: v?.ladder || 0,
      stashes: root.NightshiftStashes?.count?.() || 0, rank: root.NightshiftRespect?.state?.reached || 0, koi: root.NightshiftFishing?.state?.caught?.koi || 0, escapes: root.NightshiftGoals?.state?.stats?.escapes || 0 };
  }
  let base = null, queue = [], flavorIdx = Math.floor(Math.random() * 100), current = '';
  function pollNews() {
    const c = counters();
    if (!base) { base = c; return; }
    const diff = { heists: c.heists - base.heists, heistBest: c.heistBest, events: c.events - base.events, fights: c.fights - base.fights, ladderUp: c.ladder > base.ladder ? c.ladder : 0,
      stashes: c.stashes - base.stashes, rankName: c.rank > base.rank ? root.NightshiftRespectData?.RANKS?.[c.rank]?.name : '', koi: c.koi - base.koi, escapes: c.escapes - base.escapes };
    base = c;
    const p = P(), M = root.NightshiftMarketData;
    const world = { minute: minute(), rain: (root.NightshiftEnvironment?.weather?.(minute()) || 0) > 0.3, district: p ? root.NightshiftEnvironment?.district?.(p) : '', heat: p?.heat || 0, marketText: M?.news(M.slotOf(Date.now()))?.text };
    for (const h of L.headlines(diff, world)) if (h.pri >= 2 && !queue.includes(h.text)) queue.unshift(h.text);
    queue = queue.slice(0, 6);
    nextLine.world = world;
  }
  function nextLine() {
    if (queue.length) return queue.shift();
    const w = nextLine.world, ambient = w ? L.headlines({}, w) : [];
    return Math.random() < 0.45 && ambient.length ? ambient[Math.floor(Math.random() * ambient.length)].text : L.flavor(flavorIdx++);
  }
  setInterval(pollNews, 4000);

  const radio = el('button', { id: 'lfRadio', type: 'button', hidden: true, ariaLabel: 'Car radio: tap for next station' });
  const stEl = el('span', { className: 'st' }), tk = el('span', { className: 'tk' }), tkInner = el('span'), pw = el('span', { className: 'pw' }, '⏻');
  tk.append(tkInner); radio.append(stEl, tk, pw); document.body.append(radio);
  let lineUntil = 0;
  function renderRadio() {
    const p = P(), inCar = !!p?.car && !root.NightshiftHome?.paused?.();
    radio.hidden = !inCar;
    if (!inCar) { music.stop(); return; }
    const s = L.STATION[state.station];
    radio.style.setProperty('--rc', state.radio ? s.color : '#777');
    stEl.textContent = state.radio ? `📻 ${s.freq} ${s.name}` : '📻 OFF';
    if (!state.radio) { tkInner.textContent = ''; music.stop(); return; }
    if (performance.now() > lineUntil) {
      const line = `${s.dj}: ${nextLine()}`; current = line;
      tkInner.textContent = line; tkInner.style.animation = 'none'; void tkInner.offsetWidth; tkInner.style.animation = '';
      const dur = Math.max(10, line.length * 0.16); tk.style.setProperty('--dur', dur + 's'); lineUntil = performance.now() + dur * 1000;
    }
    if (soundOn()) music.start(state.station); else music.stop();
  }
  radio.onclick = (e) => {
    const r = radio.getBoundingClientRect();
    if (e.clientX > r.right - 26) { state.radio = !state.radio; persist(); lineUntil = 0; say(state.radio ? '📻 Radio on' : '📻 Radio off'); }
    else { const i = L.STATIONS.findIndex((s) => s.id === state.station); state.station = L.STATIONS[(i + 1) % L.STATIONS.length].id; state.radio = true; persist(); lineUntil = 0; music.stop(); }
    renderRadio();
  };
  setInterval(renderRadio, 300);
  const soundOn = () => document.querySelector('#sound')?.getAttribute('aria-pressed') === 'true';

  // Procedural music (Web Audio), scheduled a bar ahead. Quiet by design; only in a car with SOUND on.
  const music = (() => {
    let ctx = null, master = null, timer = 0, station = null, barIdx = 0, nextBarAt = 0;
    function voice(kind, midi, at, len) {
      if (kind === 'kick') {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, at); o.frequency.exponentialRampToValueAtTime(40, at + 0.15);
        g.gain.setValueAtTime(0.5, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.18); o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.2); return;
      }
      if (kind === 'hat') {
        const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = 7000; g.gain.value = 0.08;
        s.connect(f); f.connect(g); g.connect(master); s.start(at); return;
      }
      const notes = Array.isArray(midi) ? midi : [midi], st = L.STATION[station];
      for (const n of notes) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = kind === 'bass' ? 'triangle' : kind === 'pad' ? 'sine' : st.lead; o.frequency.value = L.midiHz(kind === 'bass' ? n - 12 : n);
        f.type = 'lowpass'; f.frequency.value = kind === 'lead' ? 2200 : 900;
        const vol = kind === 'pad' ? 0.05 : kind === 'bass' ? 0.16 : 0.05;
        g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + (kind === 'pad' ? 0.4 : 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
        o.connect(f); f.connect(g); g.connect(master); o.start(at); o.stop(at + len + 0.05);
      }
    }
    function schedule() {
      if (!ctx || !station) return;
      const step = L.stepSeconds(station);
      while (nextBarAt < ctx.currentTime + 0.6) {
        for (const n of L.bar(station, barIdx)) voice(n.kind, n.midi, nextBarAt + n.step * step, n.len * step);
        nextBarAt += 16 * step; barIdx++;
      }
    }
    return {
      start(id) {
        if (station === id) return;
        try {
          const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
          ctx = ctx || new AC(); ctx.resume?.().catch(() => {});
          if (master) master.disconnect();
          master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
          station = id; barIdx = Math.floor(Date.now() / 1000 / (16 * L.stepSeconds(id))) % 64; nextBarAt = ctx.currentTime + 0.1;
          clearInterval(timer); timer = setInterval(schedule, 200); schedule();
        } catch { station = null; }
      },
      stop() { if (!station) return; station = null; clearInterval(timer); try { master?.gain.setTargetAtTime(0, ctx.currentTime, 0.1); } catch { /* n/a */ } },
      playing: () => station,
    };
  })();

  root.NightshiftLife = Object.freeze({
    get state() { return state; }, text, open: openMsgs, close: closeMsgs, paused: () => !msgPanel.hidden,
    radio: () => ({ on: state.radio, station: state.station, line: current, music: music.playing() }), headline: () => nextLine(), spawned: () => spawned, door: DOOR,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
