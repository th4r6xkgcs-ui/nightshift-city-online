/* Hitman career (Claude-owned). Requires hitman-data.js; runs the contracts inside break-ins (breakin.js).
 *  - The Broker (a contact on your phone) offers three contracts every 20 minutes once you've done a break-in.
 *  - Accept one → dossier with the mark's portrait, where they are, pay, bodyguards; GPS to the place
 *    (or the bus stop for Palm Grove). A gold 🎯 sign marks the building.
 *  - Inside: find the gold ▼, take them down, walk out the back door. No alarm = +50%, no other bodies = +25%.
 *    If the alarm runs long the mark bolts for the back door; if they get out the contract is blown.
 *  - Ranks (Rookie → Silent Assassin) raise pay and unlock warehouses and the Halvorsen Estate.
 * Save: nightshift-hitman-v1. API: NightshiftHitman.{state, open, contractFor, resolve, unlocked, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const D = root.NightshiftHitmanData;
  if (!D) return;
  const KEY = 'nightshift-hitman-v1';
  let state = D.clean({});
  try { state = D.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };

  // Unlocks after your first break-in (the Broker hears about you) or two phone hits.
  const unlocked = () => (root.NightshiftBreakin?.state?.stats?.jobs || 0) >= 1 || (root.NightshiftJobs?.state?.byType?.hit || 0) >= 2 || state.done > 0 || !!state.active;
  const contractFor = (locId) => (state.active && state.active.loc.id === locId && !D.expired(state) ? state.active : null);

  // ---------------- portrait (pixel bust from the mark's seed) ----------------
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function portrait(c) {
    const cv = el('canvas', { width: 56, height: 56 }); cv.style.cssText = 'width:84px;height:84px;image-rendering:pixelated;border-radius:12px;border:1px solid #ffffff22;flex:none;background:#0b0f16';
    const x = cv.getContext('2d'), r = (() => { let s = hash(c.name) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
    const R = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const skin = ['#f1c8a0', '#d9a273', '#b9805a', '#8a5a3a', '#5e3d28'][Math.floor(r() * 5)], hair = ['#1b1410', '#3a2616', '#6a4a2a', '#c9a24a', '#9aa3ab', '#7a2a2a'][Math.floor(r() * 6)];
    // backdrop: interrogation-room light + file-photo height lines
    R('#141a24', 0, 0, 56, 56); for (let k = 0; k < 56; k += 8) R('#ffffff0d', 0, k, 56, 1); R('#ffffff08', 10, 0, 36, 56);
    // shoulders / jacket in the mark's colour, shirt + tie/collar
    R('#00000055', 6, 41, 46, 15); R(c.color, 5, 40, 46, 16); R('#ffffff22', 5, 40, 46, 1); R('#00000033', 5, 52, 46, 4);
    R('#e8e6e0', 22, 40, 12, 10); R(r() < 0.5 ? '#2b2f33' : '#c0473f', 26, 42, 4, 12); R('#00000044', 21, 40, 2, 16); R('#00000044', 33, 40, 2, 16);
    // neck + head
    R(skin, 24, 34, 8, 7); R('#00000022', 24, 38, 8, 2);
    R(skin, 18, 14, 20, 22); R('#00000018', 34, 14, 4, 22); R('#ffffff18', 19, 15, 3, 18);
    R(skin, 16, 22, 2, 6); R(skin, 38, 22, 2, 6); // ears
    // hair style
    const style = Math.floor(r() * 4);
    if (style === 0) { R(hair, 17, 10, 22, 7); R(hair, 17, 10, 3, 12); R(hair, 36, 10, 3, 10); }
    else if (style === 1) { R(hair, 18, 11, 20, 4); R(hair, 16, 13, 4, 6); }
    else if (style === 2) { R(hair, 16, 9, 24, 8); R(hair, 15, 12, 4, 22); R(hair, 37, 12, 4, 22); }
    else { R(hair, 19, 12, 18, 2); R('#ffffff22', 22, 12, 6, 1); }
    // eyes, brows, nose, mouth
    R('#ffffff', 22, 23, 4, 2); R('#ffffff', 30, 23, 4, 2); R('#1b1410', 23, 23, 2, 2); R('#1b1410', 31, 23, 2, 2);
    R(hair, 21, 20, 6, 1); R(hair, 29, 20, 6, 1); R('#00000030', 27, 25, 2, 5); R('#7a3a2a', 24, 31, 8, 1);
    if (r() < 0.4) { R('#1b1410', 21, 22, 14, 1); R('#0b0d10', 21, 22, 6, 3); R('#0b0d10', 29, 22, 6, 3); } // shades
    if (r() < 0.35) R(hair + 'aa', 22, 30, 12, 4); // beard
    // crosshair overlay + case stamp
    x.strokeStyle = '#ff5a6acc'; x.lineWidth = 1; x.beginPath(); x.arc(28.5, 24.5, 13, 0, Math.PI * 2); x.moveTo(28.5, 8); x.lineTo(28.5, 15); x.moveTo(28.5, 34); x.lineTo(28.5, 41); x.moveTo(12, 24.5); x.lineTo(19, 24.5); x.moveTo(38, 24.5); x.lineTo(45, 24.5); x.stroke();
    R('#c0202a', 0, 0, 18, 7); x.fillStyle = '#fff'; x.font = '700 6px monospace'; x.fillText('MARK', 2, 6);
    return cv;
  }

  // ---------------- panel ----------------
  const pnl = el('div', { id: 'htPanel', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Contracts' }); document.body.append(pnl);
  const css = el('style', {}, `
  #htPanel .dossier{display:flex;gap:12px;align-items:flex-start;padding:10px;border-radius:14px;background:linear-gradient(135deg,#2a1216,#141a24);border:1px solid #ff5a6a44;margin:6px 0 8px}
  #htPanel .offer{display:flex;gap:10px;align-items:center;padding:8px;border-radius:12px;background:#ffffff07;border:1px solid #ffffff12;margin-bottom:6px}
  #htPanel .offer canvas{width:56px!important;height:56px!important}
  #htPanel .meta{flex:1;min-width:0} #htPanel .meta b{font:700 13px var(--disp,system-ui);display:block} #htPanel .meta div{color:#a9b8ca;font-size:11px;line-height:1.35}
  #htPanel .pay{color:#7cdeb5;font:700 13px var(--disp,system-ui)} #htPanel .tag{display:inline-block;padding:1px 6px;border-radius:6px;background:#ffffff12;margin:2px 4px 0 0;font-size:10px;color:#cfe0f2}
  #htPanel .go{background:linear-gradient(180deg,#ff6a5a,#c0302a);color:#fff;padding:9px 12px} #htPanel .ghost{background:#ffffff12;border:1px solid #ffffff22;padding:8px 10px;color:#cfe0f2}
  #htPanel .rank{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;background:#ffffff08;border:1px solid #ffffff14}
  #htPanel .bar{height:6px;border-radius:4px;background:#ffffff14;overflow:hidden;margin-top:4px} #htPanel .bar i{display:block;height:100%;background:linear-gradient(90deg,#ff8a7a,#ffd970)}
  #htPanel .rules{color:#8fa6c0;font-size:11px;line-height:1.5;margin-top:8px}`);
  document.head.append(css);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pnl.hidden) { pnl.hidden = true; e.stopImmediatePropagation(); } }, true);
  const btn = (cls, txt, fn, dis) => { const x = el('button', { className: cls, type: 'button', disabled: !!dis }, txt); x.onclick = fn; return x; };
  const mins = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`; };
  const where = (c) => c.loc.zone === 'suburbs' ? `${c.loc.where} · 🚌 bus to Palm Grove` : `${c.loc.where} · city`;
  const typeName = { house: 'House', warehouse: 'Warehouse', mansion: 'Estate', stash: 'Trap house' };

  function gps(c) {
    try {
      if (c.loc.zone === 'city') { const w = [...(root.NightshiftBreakin?.WAREHOUSES || []), ...(root.NightshiftBreakin?.STASHES || [])].find((q) => q.id === c.loc.id); if (w) { root.NightshiftMap?.navigate?.({ x: w.x, y: w.y, label: `🎯 ${c.name}` }); say(`📍 GPS set · ${w.name} back door`); } }
      else { const st = root.NightshiftZones?.CITY_STOPS?.[0]; if (st) { root.NightshiftMap?.navigate?.({ x: st.x, y: st.y, label: '🚌 Bus to Palm Grove' }); say('📍 GPS set · Midtown bus stop → ride to Palm Grove. The house has a gold 🎯 sign.'); } }
    } catch { /* optional */ }
  }
  function open() {
    try { root.releaseControls?.(); } catch { /* n/a */ }
    tick();
    pnl.hidden = false; pnl.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { pnl.hidden = true; };
    top.append(el('h2', {}, '🎯 THE BROKER · CONTRACTS'), x); pnl.append(top);
    if (!unlocked()) {
      pnl.append(el('div', { className: 'sub' }, 'The Broker only calls people who\'ve proven they can get in and out. Pull off one break-in first: a city warehouse back door after 21:00, or a house in Palm Grove (🚌 bus).'));
      return;
    }
    const rk = D.rankOf(state.done), nx = rk.next, prog = nx ? (state.done - D.RANKS[rk.index].at) / (nx.at - D.RANKS[rk.index].at) : 1;
    const rank = el('div', { className: 'rank' }), info = el('div', { style: 'flex:1' });
    info.append(el('b', { style: 'font:700 14px var(--disp,system-ui);color:#ffd970' }, `${rk.name.toUpperCase()}`), el('div', { style: 'color:#a9b8ca;font-size:11px' }, `${state.done} done · ${state.silent} silent · ${state.failed} failed · ${money(state.earned)} earned · pay ×${D.rankMult(state.done).toFixed(2)}${nx ? ` · ${nx.at - state.done} more to ${nx.name}` : ' · top rank'}`));
    const bar = el('div', { className: 'bar' }), fill = el('i'); fill.style.width = `${Math.round(prog * 100)}%`; bar.append(fill); info.append(bar);
    rank.append(el('div', { style: 'font-size:28px' }, '🕴️'), info); pnl.append(rank);
    const c = state.active;
    if (c) {
      pnl.append(el('h3', {}, 'ACTIVE CONTRACT'));
      const d = el('div', { className: 'dossier' }), m = el('div', { className: 'meta' });
      m.append(el('b', { style: 'font-size:15px' }, c.name), el('div', {}, `"${c.why}"`), el('div', {}, `📍 ${where(c)}`), el('div', { className: 'pay' }, `${money(c.pay)} · silent ${money(c.pay * 1.5)} · silent + clean ${money(c.pay * 1.75)}`));
      const tags = el('div'); for (const t of [`${typeName[c.type]}`, `${c.guards} bodyguard${c.guards === 1 ? '' : 's'}`, c.armed ? 'Mark is armed' : 'Mark is unarmed (runs fast)', `${c.hp} HP`, `⏱ ${mins(c.expires - Date.now())} left`]) tags.append(el('span', { className: 'tag' }, t));
      m.append(tags);
      const acts = el('div', { style: 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap' }); acts.append(btn('go', '📍 GPS', () => { gps(c); pnl.hidden = true; }), btn('ghost', 'DROP', () => { if (root.confirm?.('Drop this contract? It counts as a failure.') === false) return; D.drop(state); persist(); say('🎯 Contract dropped. The Broker won\'t be thrilled.'); open(); }));
      m.append(acts); d.append(portrait(c), m); pnl.append(d);
    }
    pnl.append(el('h3', {}, c ? 'ON THE BOARD (finish yours first)' : 'ON THE BOARD'));
    const offers = D.offers(state).filter((o) => !state.taken.includes(o.id));
    if (!offers.length) pnl.append(el('div', { className: 'sub' }, 'Nothing right now.'));
    for (const o of offers) {
      const row = el('div', { className: 'offer' }), m = el('div', { className: 'meta' });
      m.append(el('b', {}, o.name), el('div', {}, o.why), el('div', {}, `📍 ${where(o)} · ${typeName[o.type]} · ${o.guards} bodyguard${o.guards === 1 ? '' : 's'}${o.armed ? ' · armed' : ''}`), el('div', { className: 'pay' }, `${money(o.pay)}+`));
      row.append(portrait(o), m, btn('go', 'ACCEPT', () => { const r = D.accept(state, o); if (!r.ok) { say(r.reason); return; } persist(); gameSave(); gps(r.contract); say(`🎯 Contract accepted: ${o.name}. ${mins(D.EXPIRE_MS)} to get it done.`); open(); }, !!c));
      pnl.append(row);
    }
    const refresh = D.OFFER_MS - (Date.now() % D.OFFER_MS);
    pnl.append(el('div', { className: 'rules' }, `New board in ${mins(refresh)}. How it works: go to the place, use the back door, find the mark (gold ▼ above their head), take them down and walk out the back door. No alarm: +50%. Nobody else hurt: +25%. If the alarm runs long the mark makes a break for the back door, and if they get out the contract is blown. Suppressors and sneaking (don't sprint) keep it quiet. Ranks raise pay and unlock warehouses (Cleaner) and the Halvorsen Estate (Professional).`));
  }

  // ---------------- resolve (called by breakin.js on exit / death) ----------------
  function resolve(result) {
    if (!state.active) return null;
    const c = state.active, r = D.complete(state, result || {});
    persist();
    const p = P();
    if (r.paid > 0 && p) {
      try { root.NightshiftLedger?.tag('contract'); } catch { /* optional */ } 
      p.cash += r.paid;
      try { root.NightshiftSkills?.gain('shooting', 120, 'contract'); root.NightshiftSkills?.gain('stealth', r.silent ? 160 : 60, 'contract'); root.NightshiftAudio?.play('cash'); } catch { /* optional */ }
      say(`🎯 Contract complete · ${c.name} · +${money(r.paid)}${r.silent ? ' · 🤫 silent +50%' : ''}${r.clean ? ' · 🧼 clean +25%' : ''}${r.rankUp ? ` · ⬆️ RANK: ${r.rankUp.toUpperCase()}` : ''}`);
      try { const rk = D.rankOf(state.done).index; root.NightshiftWeapons?.blueprintDrop?.((0.08 + rk * 0.06) * (r.silent ? 1.6 : 1), 'a bonus from the Broker'); } catch { /* optional */ }
      try { root.NightshiftLife?.text?.('broker', r.rankUp ? `Word gets around. You're a ${r.rankUp} now. Bigger names will come your way.` : r.silent ? 'Nobody heard a thing. That\'s why I call you.' : 'Done is done. Next time, quieter.'); } catch { /* optional */ }
    } else if (r.failed) {
      say(`🎯 Contract failed · ${r.reason || (result?.died ? 'you went down' : 'the mark walked')}`);
    }
    gameSave();
    return r;
  }

  // Offer windows: one Broker text per new board once you're unlocked; contracts expire on their own.
  let lastWin = Math.floor(Date.now() / D.OFFER_MS);
  function tick() {
    if (state.active && D.expired(state)) { state.active = null; state.failed += 1; persist(); say('🎯 Your contract expired. The Broker gave it to someone else.'); }
    const win = Math.floor(Date.now() / D.OFFER_MS);
    if (win !== lastWin) { lastWin = win; if (unlocked() && !state.active) { const o = D.offers(state)[0]; try { if (o) root.NightshiftLife?.text?.('broker', `New names on the board. Top one: ${o.name}, ${money(o.pay)}. Check 📱 → 🎯 CONTRACTS.`); } catch { /* optional */ } } }
  }
  setInterval(tick, 5000);
  let welcomed = false;
  setInterval(() => { if (!welcomed && unlocked() && state.done === 0 && !state.active && !localStorage.getItem('nightshift-hitman-hello')) { welcomed = true; try { localStorage.setItem('nightshift-hitman-hello', '1'); root.NightshiftLife?.text?.('broker', 'Heard you can get in and out of places. I pay well for people who can do that and leave someone behind. 📱 → 🎯 CONTRACTS.'); } catch { /* optional */ } } }, 7000);

  // ---------------- world markers: gold 🎯 sign over the contract building in Palm Grove ----------------
  if (root.NightshiftZones?.addCompanion) root.NightshiftZones.addCompanion((api, d) => {
    const c = state.active; if (!c || d.id !== 'suburbs' || c.loc.zone !== 'suburbs') return null;
    const S = root.NightshiftSuburbs; if (!S) return null;
    const h = S.HOUSES.find((q) => q.id === c.loc.id), M = S.MANSION;
    const x = h ? h.x + h.w / 2 : M.x + M.w / 2, y = h ? h.y - 18 : M.y - 22;
    return { y: 1e6, draw: (ctx, t) => { root.NightshiftSign?.(ctx, x, y + Math.sin(t * 3) * 2, '🎯', `CONTRACT · ${c.name.toUpperCase()}`.slice(0, 34), '#ffd970', { glow: true }); } };
  });

  root.NightshiftHitman = Object.freeze({ get state() { return state; }, open, contractFor, resolve, unlocked, paused: () => !pnl.hidden, portrait, gps });
})(typeof globalThis !== 'undefined' ? globalThis : this);
