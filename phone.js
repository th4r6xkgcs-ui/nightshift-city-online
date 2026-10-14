/* Phone (Claude-owned). Your phone is how the city talks to you now — nothing pops up in the middle of the screen.
 *  - Every game message (say()) is sorted: quick feedback ("Needs $100", "Rammed by police!") shows as a small pill at
 *    the top for a moment; anything you'd want to read (missions, goals, tips, contacts, gang news, police scanner)
 *    arrives as a TEXT: a compact banner slides in at the top (tap it to open the thread) and it's kept in Messages.
 *  - Goals become texts from Rico: what to do next (with a GPS button), and "done ✅ + reward" when you finish one.
 *  - The centre notice box (#livingNotice), the goal flash and the level flash are retired; the goal card is a single
 *    slim line. Contacts from life.js text into their own threads.
 *  - The phone itself (📱 in the dock): Messages, Hustle (jobs), Goals, Map, Around you, Corners (your turf), Bag,
 *    Market. Opening it releases the sticks.
 * Save: nightshift-phone-v1. API: NightshiftPhone.{open, close, text, note, threads, unread, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const KEY = 'nightshift-phone-v1', MAXMSG = 40;
  const SYS = {
    missions: { name: 'Rico', icon: '🧢', role: 'what to do next' },
    tips: { name: 'Tips', icon: '💡', role: 'how things work' },
    street: { name: 'Street', icon: '🗣️', role: 'gangs & corners' },
    scanner: { name: 'Police scanner', icon: '🚨', role: 'heat & cops' },
    city: { name: 'City', icon: '🏙️', role: 'deals, rewards, news' },
    // v0.64 story + business
    nia: { name: 'Nia', icon: '🔧', role: 'mechanic, drives like a demon' },
    hale: { name: 'Capt. Hale', icon: '🚔', role: 'Central precinct' },
    vex: { name: 'Vex', icon: '👑', role: 'runs the Crown' },
    biz: { name: 'Business', icon: '🏪', role: 'your properties' },
  };
  const CONTACTS = () => ({ ...(root.NightshiftLifeData?.CONTACTS || {}), ...SYS });
  let state = { version: 1, threads: {}, unread: {} };
  try { const r = JSON.parse(localStorage.getItem(KEY) || '{}'); if (r && typeof r.threads === 'object') state = { version: 1, threads: r.threads || {}, unread: r.unread || {} }; } catch { /* fresh */ }
  for (const [k, list] of Object.entries(state.threads)) if (!Array.isArray(list)) delete state.threads[k];
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private */ } };
  const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); for (const k of kids) if (k !== null && k !== undefined) n.append(k); return n; };
  const ago = (at) => { const s = Math.max(0, Math.round((Date.now() - at) / 1000)); return s < 60 ? 'now' : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`; };

  // ---------- styles ----------
  const css = document.createElement('style');
  css.textContent = `
  #livingNotice,#glFlash,#skFlash,#toast{display:none!important}
  /* v0.61 declutter: MORE only keeps what isn't already on the action button or the phone */
  #actions.expanded>#business,#actions.expanded>#job,#actions.expanded>#property,#actions.expanded>#progress,#actions.expanded>#search,#actions.expanded>#loot,#actions.expanded>#journal,#actions.expanded>#glove{display:none!important}
  #wfChip{display:none!important}
  #inventoryPanel:not([hidden]){display:flex!important;flex-direction:column;gap:2px;font:13px/1.35 ui-monospace,Menlo,monospace!important;background:#0f1830f5!important;border-color:#6f8db3!important;border-radius:14px!important}
  #inventoryPanel>p:first-child{margin:0 0 6px;font-weight:700;color:#ffd970;letter-spacing:.04em}
  #inventoryPanel>button:last-child{order:-1;position:sticky;top:0;z-index:2;align-self:flex-end;width:auto!important;height:auto!important;padding:6px 12px!important;margin-bottom:6px;font:700 12px ui-monospace,Menlo,monospace;background:#2c4c7c!important;color:#fff!important;border:1px solid #6f8db3!important;border-radius:8px!important}
  #inventoryPanel button{font:700 12px ui-monospace,Menlo,monospace;background:#1e2f52;color:#e8eff7;border:1px solid #3f5a85;border-radius:7px;padding:4px 10px;margin-left:6px}
  #glCard{padding:4px 9px!important} #glCard .h,#glCard .bar,#glCard .trk{display:none!important} #glCard .t{font-size:9px!important}
  #wfBan{top:11%!important;font-size:16px!important} #wfBan small{font-size:10px!important}
  #phNotes{position:fixed;z-index:47;left:50%;top:calc(max(8px, env(safe-area-inset-top, 0px)) + 34px);transform:translateX(-50%);display:flex;flex-direction:column;gap:5px;align-items:center;pointer-events:none;width:min(340px,calc(100vw - 340px))}
  #phNotes .n{pointer-events:auto;cursor:pointer;display:flex;gap:8px;align-items:center;width:100%;box-sizing:border-box;background:#0d1322ee;border:1px solid #33456a;border-radius:12px;padding:6px 10px;color:#e8eff7;
    font:600 11.5px/1.3 ui-monospace,Menlo,monospace;box-shadow:0 6px 18px #0007;opacity:0;transform:translateY(-8px);transition:opacity .2s,transform .2s}
  #phNotes .n.on{opacity:1;transform:none} #phNotes .n .i{font-size:16px;line-height:1} #phNotes .n .b{flex:1;min-width:0}
  #phNotes .n .w{display:block;color:#9fd4ff;font-size:10px;letter-spacing:.04em} #phNotes .n .t{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
  #phNotes .n.fb{width:auto;max-width:100%;border-radius:999px;padding:4px 12px;background:#0d1322dd;font-weight:600} #phNotes .n.fb .t{white-space:nowrap}
  #phNotes .n.cop{border-color:#5a7aff} #phNotes .n.cash{border-color:#3f8a64}
  @media (orientation:portrait){#phNotes{width:calc(100vw - 24px);top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 200px)}}
  #phPhone{position:fixed;z-index:48;right:max(14px, env(safe-area-inset-right,0px));bottom:10px;width:min(300px,calc(100vw - 28px));height:min(560px,calc(100dvh - 20px));display:flex;flex-direction:column;
    background:#05070d;border:2px solid #2a3350;border-radius:28px;box-shadow:0 18px 50px #000a,0 0 0 6px #0d111c;color:#e8eff7;font:13px ui-monospace,Menlo,monospace;overflow:hidden;transform:translateY(0);transition:transform .22s}
  #phPhone[hidden]{display:none} #phPhone .bar{display:flex;justify-content:space-between;align-items:center;padding:8px 16px 4px;font-size:11px;color:#9fb3c8}
  #phPhone .notch{width:80px;height:16px;background:#000;border-radius:0 0 10px 10px;margin:0 auto}
  #phPhone .scr{flex:1;overflow:auto;padding:6px 12px 12px;background:radial-gradient(120% 80% at 50% 0%,#18233f,#070a12)}
  #phPhone h2{margin:6px 2px 10px;font-size:15px} #phPhone .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px 8px}
  #phPhone .app{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:9.5px;color:#d3deea;position:relative}
  #phPhone .app .ic{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;font-size:22px;background:linear-gradient(160deg,#2c3f6a,#18223c);border:1px solid #3a5080}
  #phPhone .app .bd{position:absolute;top:-4px;right:6px;background:#ff4a5a;color:#fff;border-radius:999px;font-size:9px;padding:1px 5px;font-weight:800}
  #phPhone .home{all:unset;cursor:pointer;display:block;width:110px;height:5px;border-radius:3px;background:#c9d1d6;margin:8px auto}
  #phPhone .row{all:unset;cursor:pointer;display:flex;gap:10px;align-items:center;padding:9px 6px;border-bottom:1px solid #1a2440;width:100%;box-sizing:border-box}
  #phPhone .row .av{font-size:22px;width:30px;text-align:center} #phPhone .row .tx{flex:1;min-width:0} #phPhone .row .nm{font-weight:700;font-size:12.5px} #phPhone .row .pv{font-size:11px;color:#9fb3c8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #phPhone .row .tm{font-size:10px;color:#7d8796} #phPhone .row .un{background:#3a7aff;color:#fff;border-radius:999px;font-size:10px;padding:1px 6px;font-weight:800}
  #phPhone .top{display:flex;align-items:center;gap:8px;margin:2px 0 8px} #phPhone .back{all:unset;cursor:pointer;color:#7cb8ff;font-weight:700;font-size:12px}
  #phPhone .msg{max-width:86%;background:#1e2a48;border-radius:14px 14px 14px 4px;padding:7px 10px;margin:6px 0;font-size:12px;line-height:1.35;white-space:pre-wrap}
  #phPhone .msg small{display:block;color:#7d8796;font-size:9.5px;margin-top:3px} #phPhone .msg button{all:unset;cursor:pointer;display:inline-block;margin-top:5px;background:#2c4c7c;border:1px solid #6f8db3;border-radius:8px;padding:3px 8px;font-weight:700;font-size:11px}
  #phPhone .goal{background:#16233d;border:1px solid #2f4669;border-radius:12px;padding:9px 10px;margin-bottom:8px}`;
  document.head.appendChild(css);

  // ---------- notifications ----------
  const notes = el('div', { id: 'phNotes', role: 'status', ariaLive: 'polite' }); document.body.appendChild(notes);
  const recent = new Map();
  function note(o) {
    const key = (o.who || '') + '|' + o.text, now = performance.now(); if (recent.get(key) > now - 3000) return; recent.set(key, now);
    const n = el('div', { className: 'n' + (o.fb ? ' fb' : '') + (o.kind ? ' ' + o.kind : '') });
    if (!o.fb) n.append(el('span', { className: 'i', textContent: o.icon || '📱' }));
    const b = el('span', { className: 'b' }); if (o.who) b.append(el('span', { className: 'w', textContent: o.who })); b.append(el('span', { className: 't', textContent: o.text })); n.append(b);
    if (o.thread) n.onclick = () => open('thread', o.thread);
    notes.append(n); requestAnimationFrame(() => n.classList.add('on'));
    while (notes.children.length > 2) notes.firstChild.remove();
    setTimeout(() => { n.classList.remove('on'); setTimeout(() => n.remove(), 250); }, o.ms || (o.fb ? 1900 : 3600));
  }

  // ---------- threads ----------
  function text(from, msg, opts = {}) {
    const C = CONTACTS(), c = C[from] || { name: from, icon: '💬' };
    const list = state.threads[from] || (state.threads[from] = []);
    list.push({ t: String(msg).slice(0, 400), at: Date.now(), gps: opts.gps && Number.isFinite(opts.gps.x) ? { x: Math.round(opts.gps.x), y: Math.round(opts.gps.y), label: String(opts.gps.label || '').slice(0, 40) } : undefined });
    if (list.length > MAXMSG) list.splice(0, list.length - MAXMSG);
    const viewing = !phone.hidden && view.app === 'thread' && view.arg === from;
    if (!viewing) state.unread[from] = Math.min(99, (state.unread[from] || 0) + 1);
    persist(); badge();
    if (!opts.silent) note({ icon: c.icon, who: c.name, text: msg, thread: from });
    try { if (!opts.silent) root.NightshiftAudio?.play?.('pickup'); } catch { /* n/a */ }
    if (!phone.hidden) render();
  }
  const unread = () => Object.values(state.unread).reduce((a, b) => a + (b || 0), 0);

  // ---------- say() router ----------
  const strip = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  function route(raw) {
    const s = strip(raw); if (!s) return;
    // contact texts from life.js style: "📩 🧢 Rico: message"
    let m = /^📩\s*(\S+)\s+([^:]{1,24}):\s*(.+)$/u.exec(s);
    if (m) { const C = CONTACTS(), id = Object.keys(C).find((k) => C[k].name === m[2].trim()) || 'city'; text(id, m[3]); return; }
    const first = [...s][0];
    if (/^(🚓|🚧|📞|🚔|⭐)/u.test(s) || /police|cops?\b|wanted|busted/i.test(s) && s.length < 90) { if (s.length > 64 || /BUSTED|got away|witness/i.test(s)) text('scanner', s); else note({ fb: true, text: s, kind: 'cop' }); return; }
    if (/^(⚠️|🏴|🏳️|💥|🔥|🤝|☠️|🛡️|💀|🗣️)/u.test(s)) { text('street', s); return; }
    if (/^(💰|👏|🤑|📦|💵)/u.test(s) && s.length > 30) { text('city', s); return; }
    if (s.length > 72) { text('tips', s); return; }
    note({ fb: true, text: s, kind: /\+\$/.test(s) ? 'cash' : '' }); void first;
  }
  // replace the global say() (game.js and every module call it) — keep the game's message bookkeeping
  const say0 = root.say;
  function sayNew(s) { try { route(s); } catch (e) { console.error(e); } try { /* keep msgUntil logic harmless */ void say0; } catch { /* n/a */ } }
  try { root.say = sayNew; } catch { /* n/a */ }
  setInterval(() => { if (root.say !== sayNew) { try { root.say = sayNew; } catch { /* n/a */ } } }, 400); // game.js may define say() after us
  // modules that captured say before us (const say = root.say...) still call through root.say at call time

  // ---------- goals as texts ----------
  let lastGoal = null, seeded = false;
  function goalTick() {
    const G = root.NightshiftGoals; if (!G?.next) return;
    let n = null; try { n = G.next(); } catch { return; }
    const id = n?.goal?.id || null;
    if (id && id !== lastGoal) {
      if (lastGoal !== null || !seeded) {
        let gps = null; try { const t = G.track?.(); if (t && t.goal.id === id) gps = { x: t.x, y: t.y, label: n.goal.title }; } catch { /* n/a */ }
        const known = (state.threads.missions || []).some((q) => q.t.startsWith('Next: ' + n.goal.title));
        if (!known) text('missions', `Next: ${n.goal.title}\n${n.goal.hint}`, { gps, silent: lastGoal === null && (state.threads.missions || []).length > 0 });
      }
      lastGoal = id; seeded = true;
    } else if (!id) lastGoal = null;
  }
  setInterval(goalTick, 1000);
  // goal / skill flashes become texts and feedback pills
  function watchFlash(sel, fn) {
    const node = document.querySelector(sel); if (!node || node.__ph) return !!node?.__ph; node.__ph = true; let last = '';
    new MutationObserver(() => { const on = node.classList.contains('on'), t = strip(node.innerText || node.textContent); if (on && t && t !== last) { last = t; fn(t); } if (!on) last = ''; }).observe(node, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true, characterData: true });
    return true;
  }
  const fw = setInterval(() => {
    const a = watchFlash('#glFlash', (t) => text('missions', '✅ ' + t.replace(/^🎯\s*/u, '').replace(/^GOAL COMPLETE\s*·?\s*/i, 'Done: ')));
    const b = watchFlash('#skFlash', (t) => note({ fb: true, text: '⬆ ' + t, kind: 'cash' }));
    if (a && b) clearInterval(fw);
  }, 500);

  // ---------- the phone ----------
  const phone = el('section', { id: 'phPhone', hidden: true, role: 'dialog', ariaLabel: 'Phone' }); document.body.appendChild(phone);
  const view = { app: 'home', arg: null };
  const clock = () => { try { const m = root.NightshiftEnvironment?.state?.minute ?? 720; return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0'); } catch { return '--:--'; } };
  function shell(...kids) {
    phone.replaceChildren(el('div', { className: 'notch' }), el('div', { className: 'bar' }, el('span', { textContent: clock() }), el('span', { textContent: '📶 🔋' })),
      el('div', { className: 'scr' }, ...kids), el('button', { className: 'home', ariaLabel: view.app === 'home' ? 'Close phone' : 'Home', onclick: () => (view.app === 'home' ? close() : open('home')) }));
  }
  function app(icon, label, fn, n) { const b = el('button', { className: 'app', onclick: fn }, el('span', { className: 'ic', textContent: icon }), el('span', { textContent: label })); if (n) b.append(el('span', { className: 'bd', textContent: String(n) })); return b; }
  const launch = (fn) => () => { close(); setTimeout(() => { try { fn(); } catch (e) { console.error(e); } }, 30); };
  function render() {
    const C = CONTACTS();
    if (view.app === 'home') {
      const owned = Object.keys(root.NightshiftGangs?.state?.owned || {}).length;
      shell(el('h2', { textContent: 'Nightshift' }), el('div', { className: 'grid' },
        app('💬', 'Messages', () => open('messages'), unread()),
        app('📖', 'Story', launch(() => root.NightshiftStory?.open?.())),
        app('🏪', 'Business', launch(() => root.NightshiftProperty?.open?.()), root.NightshiftProperty?.owned?.() || 0),
        app('📲', 'Hustle', launch(() => root.NightshiftJobs?.open?.())),
        app('🎯', 'Goals', () => open('goals')),
        app('🗺️', 'Map', launch(() => root.NightshiftMap?.open?.())),
        app('📍', 'Around', launch(() => root.NightshiftWayfinding?.open?.())),
        app('🏴', 'Corners', () => open('corners'), owned || 0),
        app('🎒', 'Bag', launch(() => root.NightshiftSupply?.openBag?.())),
        app('📈', 'Market', launch(() => root.NightshiftMarket?.open?.())),
        app('⭐', 'Skills', launch(() => root.NightshiftSkills?.open?.())),
        app('📅', 'Dailies', launch(() => root.NightshiftDailies?.open?.())),
        app('👤', 'Respect', launch(() => root.NightshiftRespect?.open?.())),
        app('📻', 'Radio', launch(() => document.querySelector('#lfRadio')?.click())),
        app('🎮', root.NightshiftDriveInput?.mode === 'classic' ? 'Steer: Tank' : 'Steer: Screen', () => { root.NightshiftDriveInput?.toggle?.(); render(); })));
    } else if (view.app === 'messages') {
      const ids = Object.keys(state.threads).filter((k) => state.threads[k].length).sort((a, b) => state.threads[b].at(-1).at - state.threads[a].at(-1).at);
      shell(el('div', { className: 'top' }, el('button', { className: 'back', textContent: '‹ Home', onclick: () => open('home') }), el('h2', { textContent: 'Messages', style: 'margin:0' })),
        ...(ids.length ? ids.map((k) => { const c = C[k] || { name: k, icon: '💬' }, last = state.threads[k].at(-1); return el('button', { className: 'row', onclick: () => open('thread', k) }, el('span', { className: 'av', textContent: c.icon }), el('span', { className: 'tx' }, el('div', { className: 'nm', textContent: c.name }), el('div', { className: 'pv', textContent: last.t })), el('span', { className: 'tm', textContent: ago(last.at) }), state.unread[k] ? el('span', { className: 'un', textContent: String(state.unread[k]) }) : null); }) : [el('div', { textContent: 'No messages yet.', style: 'color:#9fb3c8;padding:10px' })]));
    } else if (view.app === 'thread') {
      const k = view.arg, c = C[k] || { name: k, icon: '💬', role: '' }; state.unread[k] = 0; persist(); badge();
      const list = state.threads[k] || [];
      shell(el('div', { className: 'top' }, el('button', { className: 'back', textContent: '‹ Messages', onclick: () => open('messages') }), el('span', { textContent: c.icon, style: 'font-size:20px' }), el('div', {}, el('div', { textContent: c.name, style: 'font-weight:700' }), el('div', { textContent: c.role || '', style: 'font-size:10px;color:#9fb3c8' }))),
        ...list.map((q) => el('div', { className: 'msg' }, document.createTextNode(q.t), q.gps ? el('br') : null, q.gps ? el('button', { textContent: '📍 GPS ' + (q.gps.label || ''), onclick: () => { try { root.NightshiftMap?.navigate?.({ x: q.gps.x, y: q.gps.y, label: q.gps.label || c.name }); } catch { /* n/a */ } close(); } }) : null, el('small', { textContent: ago(q.at) }))));
      const scr = phone.querySelector('.scr'); if (scr) scr.scrollTop = scr.scrollHeight;
    } else if (view.app === 'goals') {
      const G = root.NightshiftGoals; let n = null; try { n = G?.next?.(); } catch { /* n/a */ }
      shell(el('div', { className: 'top' }, el('button', { className: 'back', textContent: '‹ Home', onclick: () => open('home') }), el('h2', { textContent: 'Goals', style: 'margin:0' })),
        n ? el('div', { className: 'goal' }, el('div', { textContent: `🎯 ${n.goal.title} · ${n.cur ?? 0}/${n.target ?? 1}`, style: 'font-weight:700;margin-bottom:4px' }), el('div', { textContent: n.goal.hint, style: 'font-size:11.5px;color:#c9d6e6' }),
          el('button', { textContent: '📍 Track it', className: 'back', style: 'margin-top:6px', onclick: () => { try { G.gps?.(); } catch { /* n/a */ } close(); } })) : el('div', { textContent: 'All goals done. Legend.' }),
        el('button', { className: 'row', onclick: launch(() => G?.open?.()) }, el('span', { className: 'av', textContent: '📋' }), el('span', { className: 'tx' }, el('div', { className: 'nm', textContent: 'All goals & milestones' }), el('div', { className: 'pv', textContent: 'Rewards, progress, pin one to track' }))));
    } else if (view.app === 'corners') {
      const GS = root.NightshiftGangs, GD = root.NightshiftGangsData, owned = Object.entries(GS?.state?.owned || {});
      shell(el('div', { className: 'top' }, el('button', { className: 'back', textContent: '‹ Home', onclick: () => open('home') }), el('h2', { textContent: 'Your corners', style: 'margin:0' })),
        ...(owned.length ? owned.map(([k, o]) => { const [bx, by] = k.split(',').map(Number), cash = GD?.pending?.(GS.state, bx, by) || 0, where = root.NightshiftWorld?.districtName?.(bx * 440 + 200, by * 340 + 200) || k;
          return el('button', { className: 'row', onclick: () => { try { root.NightshiftMap?.navigate?.({ x: bx * 440 + 118, y: by * 340 + 300, label: 'Your corner · ' + where }); } catch { /* n/a */ } close(); } }, el('span', { className: 'av', textContent: '🏴' }), el('span', { className: 'tx' }, el('div', { className: 'nm', textContent: where }), el('div', { className: 'pv', textContent: `${o.guards.length} guard${o.guards.length === 1 ? '' : 's'} · ${cash ? '$' + cash + ' waiting' : 'nothing to collect yet'} · from ${GD?.BY_ID?.[o.from]?.short || ''}` })), el('span', { className: 'tm', textContent: 'GPS' })); })
          : [el('div', { textContent: 'No corners yet. Clear a gang corner and hold the dashed ring for 20 seconds to make it yours.', style: 'color:#9fb3c8;padding:10px;font-size:12px' })]));
    }
  }
  function open(appName = 'home', arg = null) { try { root.releaseControls?.(); } catch { /* n/a */ } view.app = appName; view.arg = arg; phone.hidden = false; render(); }
  function close() { phone.hidden = true; view.app = 'home'; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !phone.hidden) close(); if ((e.key === 'p' || e.key === 'P') && !e.repeat && !/input|textarea/i.test(e.target?.tagName || '')) { if (phone.hidden) open(); else close(); } });
  // dock button + badge
  function badge() { const b = document.querySelector('#nsDock button[aria-label="Phone"] .b'); const n = unread(); if (b) { b.hidden = !n; b.textContent = String(n); } }
  const dk = setInterval(() => {
    const btn = [...document.querySelectorAll('#nsDock button')].find((x) => /phone/i.test(x.getAttribute('aria-label') || ''));
    if (!btn) return; btn.setAttribute('aria-label', 'Phone'); btn.title = 'Phone'; btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); if (phone.hidden) open(); else close(); };
    const clone = btn.cloneNode(true); clone.onclick = btn.onclick; btn.replaceWith(clone); badge(); clearInterval(dk);
  }, 400);
  setInterval(() => { if (!phone.hidden && view.app !== 'thread') { const bar = phone.querySelector('.bar span'); if (bar) bar.textContent = clock(); } }, 5000);
  root.NightshiftPhone = Object.freeze({ open, close, text, note, route, threads: () => state.threads, unread, paused: () => !phone.hidden });
})(typeof globalThis !== 'undefined' ? globalThis : this);
