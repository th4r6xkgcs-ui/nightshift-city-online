/* Story campaign in game (Claude-owned, v0.64). Requires story-data.js; uses phone.js texts, gangs.js squads,
 * melee/driving/property events on the shared bus ('ns:event').
 *  - Characters text the chapter intro and every next step (with GPS). Nothing pops up or pauses the world.
 *  - While a story step is active, the left card shows it (📖 CH 2 · Wheels — Land a 250+ drift · 120/250);
 *    tap it to set GPS. The normal goals keep counting in the background.
 *  - Bosses spawn as world squads when you get close (and re-spawn if you leave or go down), so it would work the
 *    same with other players around later.
 *  - 📖 Story app on the phone: chapter list, current objective, GPS.
 * Save: nightshift-story-v1. API: NightshiftStory.{state, open, close, step, skip, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const S = root.NightshiftStoryData; if (!S) return;
  const KEY = 'nightshift-story-v1';
  let state = S.clean({}); try { state = S.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private */ } };
  const P = () => { try { return player; } catch { return null; } }; // eslint-disable-line no-undef
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const text = (from, msg, gps) => { try { root.NightshiftPhone?.text?.(from, msg, gps ? { gps } : {}); } catch { say(msg); } };
  let spawned = null; // { tag, at }

  // ---------- objective helpers ----------
  function values() {
    const p = P(); let corners = 0, props = 0; try { corners = Object.keys(root.NightshiftGangs?.state?.owned || {}).length; } catch { /* n/a */ } try { props = root.NightshiftProperty?.owned?.() || 0; } catch { /* n/a */ }
    return { cash: p?.cash || 0, inCar: p?.car ? 1 : 0, corners, props, heat: p?.heat || 0 };
  }
  function target(st) {
    const p = P(); if (!st || !p) return null;
    if (st.at) return { x: st.at.x, y: st.at.y };
    if (st.gps === 'gas') { const L = root.NightshiftDriving?.stations?.() || []; const s = L.slice().sort((a, b) => dist(a, p) - dist(b, p))[0]; return s ? { x: s.x, y: s.y } : null; }
    if (st.gps === 'shop') { const L = root.NightshiftProperty?.catalog?.() || []; const s = L.slice().sort((a, b) => a.price - b.price || dist(a.door, p) - dist(b.door, p))[0]; return s ? { x: s.door.x, y: s.door.y } : null; }
    if (st.gps === 'race') { const L = root.NightshiftRaces?.starts?.() || []; const s = L.slice().sort((a, b) => dist(a, p) - dist(b, p))[0]; return s ? { x: s.x, y: s.y } : null; }
    if (st.trigger === 'robbery') { const ids = Object.keys(root.NightshiftProperty?.state?.props || {}); const L = root.NightshiftProperty?.catalog?.() || []; const own = L.filter((q) => ids.includes(q.id)).sort((a, b) => dist(a.door, p) - dist(b.door, p))[0]; return own ? { x: own.door.x, y: own.door.y } : null; }
    return null;
  }
  function gps() { const st = S.stepOf(state), t = target(st); if (t) { try { root.NightshiftMap?.navigate?.({ x: t.x, y: t.y, label: st.label }); } catch { /* n/a */ } } return !!t; }
  function progress(st) {
    if (!st) return null;
    if (st.kind === 'state') { const [c, n] = S.stateProgress(st, values(), state); return [Math.min(c, n), n]; }
    if (st.kind === 'event') return st.type === 'drift' ? [Math.min(state.best || 0, st.min), st.min] : [state.count || 0, st.count];
    if (st.kind === 'squad') { const alive = root.NightshiftGangs?.alive?.(st.tag) ?? 0; return spawned?.tag === st.tag ? [st.n - alive, st.n] : null; }
    if (st.kind === 'escape') return [state.peak ? 1 : 0, 1];
    return null;
  }

  // ---------- flow ----------
  function begin() {
    const ch = S.current(state); if (!ch) return;
    state.started = true; state.base = {}; state.count = 0; state.best = 0; persist();
    const st = S.stepOf(state), t = target(st);
    text(ch.from, `📖 Chapter ${ch.n} · ${ch.title}\n${ch.intro}`, t ? { ...t, label: st.label } : null);
    snapshotBase();
  }
  function snapshotBase() { const st = S.stepOf(state); if (st?.kind === 'state' && st.delta) { state.base[st.key] = values()[st.key] || 0; persist(); } }
  function complete() {
    const ch = S.current(state), st = S.stepOf(state); if (!ch || !st) return;
    if (spawned) { spawned = null; }
    const r = S.advance(state); state.best = 0; persist();
    const nst = S.stepOf(state), t = nst ? target(nst) : null;
    if (r.chapterDone) {
      const p = P(), rw = ch.reward || {};
      if (p && rw.cash) p.cash += rw.cash;
      if (rw.melee) { try { root.NightshiftMelee?.give?.(rw.melee, true); } catch { /* n/a */ } }
      if (rw.nitro && p?.car) p.car.nitro = 100;
      text(ch.from, `${st.text}\n\n✅ Chapter ${ch.n} complete · +$${(rw.cash || 0).toLocaleString()}${rw.melee ? ' · ' + (root.NightshiftMeleeData?.WEAPONS?.[rw.melee]?.name || rw.melee) : ''}${rw.nitro ? ' · nitro fill' : ''}`);
      try { root.dispatchEvent(new CustomEvent('ns:event', { detail: { type: 'chapter', id: ch.id, n: ch.n } })); save(); } catch { /* n/a */ } // eslint-disable-line no-undef
      if (r.finished) { setTimeout(() => text('rico', '👑 You finished the story. Nightshift City is yours — but the corners, the stores and the streets still need running. Keep grinding, and keep an eye out: when other players show up, they\'ll want what you have.'), 6000); return; }
      setTimeout(begin, 9000); // breathing room between chapters
    } else {
      if (st.text) text(ch.from, st.text, t ? { ...t, label: nst.label } : null);
      if (nst?.kind === 'squad') { /* spawns when you get close */ }
      snapshotBase();
    }
    render();
  }
  // squads: spawn near, despawn far, retry after a wipe
  function squadTick(st) {
    const p = P(), G = root.NightshiftGangs; if (!p || !G?.squad) return;
    const d = dist(p, st.at);
    if (!spawned || spawned.tag !== st.tag) {
      if (d < 780 && p.hp > 0) {
        G.clearSquad(st.tag);
        G.squad({ x: st.at.x, y: st.at.y, gang: st.gang, n: st.n, tag: st.tag, boss: st.boss || null, meleeOnly: !!st.meleeOnly, hp: st.hp, hunt: st.boss ? 420 : 300, vs: ['player', 'you'] });
        spawned = { tag: st.tag, at: performance.now() };
        if (st.boss) say(`☠️ ${st.boss.name} and the Crown are here`);
      }
      return;
    }
    const alive = G.alive(st.tag);
    if (alive === 0) { complete(); return; }
    if (d > 1700 || p.hp <= 0) { G.clearSquad(st.tag); spawned = null; if (p.hp <= 0) text(S.current(state).from, 'You went down. Heal up and go again — they\'re still there.'); }
  }
  let robberyAsked = 0;
  function tick() {
    if (!state.started || state.finished) { render(); return; }
    const st = S.stepOf(state), p = P(); if (!st || !p) return;
    if (st.kind === 'goto' && dist(p, st.at) < (st.r || 70) && !p.car) complete();
    else if (st.kind === 'state') { const [c, n] = S.stateProgress(st, values(), state); if (c >= n) complete(); }
    else if (st.kind === 'escape') { if (S.escapeStep(state, values().heat, st.stars)) complete(); else persist(); }
    else if (st.kind === 'squad') squadTick(st);
    else if (st.kind === 'event' && st.trigger === 'robbery') {
      // stage a robbery at your nearest store once you're close to it
      const t = target(st), PR = root.NightshiftProperty; if (t && PR && !PR.live?.() && dist(p, t) < 520 && Date.now() - robberyAsked > 20000) { robberyAsked = Date.now(); const ids = Object.keys(PR.state.props); const near = (PR.catalog() || []).filter((q) => ids.includes(q.id)).sort((a, b) => dist(a.door, p) - dist(b.door, p))[0]; if (near) PR.robbery(near.id); }
    }
    render();
  }
  root.addEventListener('ns:event', (e) => {
    const ev = e.detail, st = S.stepOf(state); if (!state.started || !st || st.kind !== 'event' || !ev) return;
    if (st.type === 'drift' && ev.type === 'drift') state.best = Math.max(state.best || 0, ev.points || 0);
    if (S.matches(st, ev)) { state.count = (state.count || 0) + 1; persist(); if (state.count >= st.count) complete(); }
  });

  // ---------- story card (replaces the goal card while a chapter is running) ----------
  const css = document.createElement('style');
  css.textContent = `body[data-story="on"] #glCard{display:none!important}
  #stCard{all:unset;box-sizing:border-box;position:fixed;z-index:24;left:12px;top:122px;max-width:min(270px,46vw);cursor:pointer;background:linear-gradient(135deg,#2a1636ee,#151b33e8);border:1px solid #ff7ad877;border-left:3px solid #ff7ad8;border-radius:10px;padding:4px 9px 5px;color:#f4ecf7;font:700 12px ui-monospace,Menlo,monospace;box-shadow:0 4px 16px #0006}
  #stCard[hidden]{display:none} #stCard .t{display:block;color:#ff9ae6;font-size:9px;letter-spacing:.06em} #stCard .n{display:block;font-size:12px;margin-top:1px} #stCard .bar{display:block;height:3px;background:#0a1222;border-radius:3px;margin-top:3px;overflow:hidden} #stCard .bar i{display:block;height:100%;background:linear-gradient(90deg,#ff7ad8,#ffd970)}
  #stPanel{position:fixed;inset:7% 10%;z-index:46;overflow:auto;background:#0f1830f5;border:1px solid #6f8db3;border-radius:14px;padding:12px 14px;color:#e8eff7;font:13px ui-monospace,Menlo,monospace}
  #stPanel[hidden]{display:none} #stPanel h2{margin:0 0 6px;font-size:16px} #stPanel .ch{background:#16233d;border:1px solid #2f4669;border-radius:9px;padding:7px 9px;margin-bottom:6px} #stPanel .ch.cur{border-color:#ff7ad8} #stPanel .ch.done{opacity:.6} #stPanel .ch small{display:block;color:#b9c8da;font-size:11px;margin-top:2px}
  #stPanel button{all:unset;box-sizing:border-box;cursor:pointer;font:700 12px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:8px;padding:6px 10px;margin-top:6px} #stPanel .x{float:right;margin-top:0}`;
  document.head.appendChild(css);
  const card = Object.assign(document.createElement('button'), { id: 'stCard', type: 'button', hidden: true }); card.setAttribute('aria-label', 'Story objective'); document.body.appendChild(card);
  card.addEventListener('click', () => { if (!gps()) open(); else say('📍 GPS set'); });
  let lastHtml = '';
  function render() {
    const ch = S.current(state), st = S.stepOf(state), on = state.started && !!ch && !!st;
    document.body.dataset.story = on ? 'on' : 'off'; card.hidden = !on; if (!on) return;
    const pr = progress(st), html = `<span class="t">📖 CH ${ch.n} · ${ch.title.toUpperCase()}</span><span class="n">${st.label}${pr ? ` · ${pr[0]}/${pr[1]}` : ''}</span>${pr ? `<span class="bar"><i style="width:${Math.round(Math.min(1, pr[0] / Math.max(1, pr[1])) * 100)}%"></i></span>` : ''}`;
    if (html !== lastHtml) { card.innerHTML = html; lastHtml = html; }
    // keep the card under whatever sits above it (the goal card position)
  }
  const panel = Object.assign(document.createElement('section'), { id: 'stPanel', hidden: true }); document.body.appendChild(panel);
  const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); for (const k of kids) if (k !== null && k !== undefined) n.append(k); return n; };
  function open() {
    panel.replaceChildren(el('button', { className: 'x', textContent: 'CLOSE', onclick: close }), el('h2', { textContent: '📖 Nightshift · the story' }));
    S.CHAPTERS.forEach((ch, i) => {
      const done = i < state.chapter, cur = i === state.chapter && state.started, st = cur ? S.stepOf(state) : null;
      const box = el('div', { className: 'ch' + (cur ? ' cur' : '') + (done ? ' done' : '') }, document.createTextNode(`${done ? '✅' : cur ? '▶️' : '🔒'} Chapter ${ch.n} · ${ch.title}`), el('small', { textContent: done ? `Done · ${S.CONTACTS[ch.from]?.name || ''}` : cur ? `Now: ${st.label}` : i === state.chapter ? 'Starts soon' : 'Locked' }));
      if (cur) box.append(el('button', { textContent: '📍 GPS', onclick: () => { gps(); close(); } }));
      panel.append(box);
    });
    if (state.finished) panel.append(el('div', { textContent: '👑 You finished the story. The city is yours to run.', style: 'margin-top:8px;color:#ffd970' }));
    panel.hidden = false;
  }
  function close() { panel.hidden = true; }

  // ---------- phone contacts + apps ----------
  try { if (root.NightshiftLifeData?.CONTACTS && !Object.isFrozen(root.NightshiftLifeData.CONTACTS)) Object.assign(root.NightshiftLifeData.CONTACTS, S.CONTACTS); } catch { /* n/a */ }
  setInterval(() => { try { tick(); } catch (e) { console.error(e); } }, 500);
  // first chapter starts a little after you first get going (not on top of the tutorial)
  setTimeout(() => { if (!state.started && !state.finished) begin(); else render(); }, state.started ? 1000 : 25000);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  root.NightshiftStory = Object.freeze({ get state() { return state; }, open, close, paused: () => !panel.hidden, step: () => S.stepOf(state), gps, begin, complete, skip: () => complete(), spawned: () => spawned });
})(typeof globalThis !== 'undefined' ? globalThis : this);
