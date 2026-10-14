/* Your stash house in game (Claude-owned). Requires safehouse-data.js; uses breakin.js (trap-house doors + defend mode).
 * Clear out a rival trap house, then TAKE IT OVER at its door. Store weed/coke (pocket) and pills (backpack) plus cash;
 * your crew sells the product slowly and the takings pile up inside. Raids: with cameras you get a 90-second warning
 * to rush back and DEFEND it in person (raiders come through the back door); otherwise you just get the bad news.
 * Save: nightshift-safehouse-v1. API: NightshiftSafehouse.{state, open, owns, canTake, cleared, alert, secLevel} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const D = root.NightshiftSafehouseData;
  if (!D) return;
  const KEY = 'nightshift-safehouse-v1';
  let state = D.clean({});
  try { state = D.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const tag = (c) => { try { root.NightshiftLedger?.tag(c); } catch { /* optional */ } };
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };
  const doorOf = (id) => root.NightshiftBreakin?.STASHES?.find((s) => s.id === id) || null;
  const pocket = () => root.NightshiftInventory?.state?.pocket || null;
  const alerts = {}; // id -> { until }

  const owns = (id) => D.owns(state, id);
  const canTake = (id) => !owns(id) && !!state.cleared[id] && Date.now() - state.cleared[id] < 60 * 60 * 1000;
  function cleared(id) { if (owns(id)) return; state.cleared[id] = Date.now(); persist(); setTimeout(() => say('🏚️ The crew is down and the place is empty. Use the door on your way out to TAKE IT OVER as your own stash house.'), 1200); }

  // ---------------- time passing: crew sales, wages, raids ----------------
  const nextCheck = {};
  function loop() {
    const now = Date.now();
    for (const [id, h] of Object.entries(state.houses)) {
      const r = D.tick(h, now, mod('dealing.price'));
      if (r.quit) { D.log(h, 'A guard walked: no money in the stash for wages'); text(`One of your guards at the ${doorOf(id)?.name || 'stash house'} quit. No cash in the stash to pay him.`); }
      // pending warning ran out → the raid happens
      if (alerts[id] && now > alerts[id].until && !root.NightshiftBreakin?.active?.()) { delete alerts[id]; raidHits(id); }
      if (!nextCheck[id]) nextCheck[id] = now + D.RAID_CHECK_MS * (0.5 + Math.random());
      if (now >= nextCheck[id] && !alerts[id]) {
        nextCheck[id] = now + D.RAID_CHECK_MS;
        if (D.raidRoll(h, now)) {
          if (h.sec.cameras) { alerts[id] = { until: now + D.WARN_MS }; say(`📹 Your cameras: a crew is casing your ${doorOf(id)?.name || 'stash house'}! Get there in 90 s to defend it.`); text('📹 CCTV alert: masked guys at the back door of your stash house. You have about a minute and a half.'); try { root.NightshiftMap?.navigate?.({ x: doorOf(id).x, y: doorOf(id).y, label: '🏠 Defend your stash' }); } catch { /* optional */ } try { root.NightshiftAudio?.play('impact'); } catch { /* optional */ } }
          else raidHits(id);
        }
      }
    }
    persist();
  }
  function raidHits(id) {
    const h = state.houses[id]; if (!h) return;
    const took = D.raidLoss(h), parts = [took.cash ? money(took.cash) : '', ...Object.entries(D.PRODUCTS).map(([k, p]) => (took[k] ? `${took[k]} ${p.icon}` : ''))].filter(Boolean).join(', ') || 'nothing much';
    D.log(h, `Raided · they took ${parts}`); persist();
    say(`🚨 Your ${doorOf(id)?.name || 'stash house'} got raided · they took ${parts}${h.sec.safe ? ' (the safe held)' : ''}`);
    text(`Bad news. Somebody hit your stash house and walked off with ${parts}. Better locks, a dog, guards and a safe make you a harder target.`);
  }
  const text = (msg) => { try { root.NightshiftLife?.text?.('rico', msg); } catch { /* optional */ } };
  setInterval(loop, 10000); setTimeout(loop, 3000);

  function defend(id) {
    const h = state.houses[id], d = doorOf(id); if (!h || !d) return false;
    delete alerts[id];
    return root.NightshiftBreakin?.defend?.({ id, name: `${d.name} (yours)`, door: d, raiders: D.raiders(h), onEnd: (won, cash) => {
      if (won) { D.repelled(h); D.log(h, `Raid repelled in person${cash ? ` · picked up ${money(cash)}` : ''}`); say(`🛡️ Stash house held! Nobody takes from you.${cash ? ' +' + money(cash) : ''}`); try { root.NightshiftSkills?.gain('shooting', 120, 'defend'); root.NightshiftSkills?.gain('toughness', 60, 'defend'); } catch { /* optional */ } }
      else raidHits(id);
      persist(); gameSave();
    } });
  }

  // ---------------- panel ----------------
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const pnl = el('div', { id: 'shPanel', className: 'spP', hidden: true, role: 'dialog', ariaLabel: 'Stash house' }); document.body.append(pnl);
  document.head.append(el('style', {}, `
  #shPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px} #shPanel .box{padding:9px 10px;border-radius:14px;background:#ffffff07;border:1px solid #ffffff14}
  #shPanel .box b{font:700 13px var(--disp,system-ui)} #shPanel .box .ln{color:#a9b8ca;font-size:11px;margin:3px 0 6px} #shPanel .acts{display:flex;gap:5px;flex-wrap:wrap}
  #shPanel .go{background:linear-gradient(180deg,#7cdeb5,#2f9f7a);color:#06140f;padding:7px 10px} #shPanel .alt{background:#ffffff12;border:1px solid #ffffff24;color:#cfe0f2;padding:7px 10px} #shPanel .red{background:linear-gradient(180deg,#ff6a5a,#c0302a);color:#fff;padding:10px 14px}
  #shPanel .meter{height:8px;border-radius:5px;background:#ffffff12;overflow:hidden;margin-top:4px} #shPanel .meter i{display:block;height:100%;background:linear-gradient(90deg,#ff8a7a,#ffd970,#7cdeb5)}
  #shPanel .log{color:#9fb3c8;font-size:11px;line-height:1.6}`));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pnl.hidden) { pnl.hidden = true; e.stopImmediatePropagation(); } }, true);
  const btn = (cls, txt, fn, dis) => { const x = el('button', { className: cls, type: 'button', disabled: !!dis }, txt); x.onclick = fn; return x; };
  function head(title, sub) { try { root.releaseControls?.(); } catch { /* n/a */ } pnl.hidden = false; pnl.textContent = ''; const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = () => { pnl.hidden = true; }; top.append(el('h2', {}, title), x); pnl.append(top); if (sub) pnl.append(el('div', { className: 'sub' }, sub)); }
  function have(k) { if (k === 'pills') return root.NightshiftSupply?.state?.bag?.pills || 0; return pocket()?.[k] || 0; }
  function store(id, k, n) {
    const h = state.houses[id]; if (!h) return;
    if (k === 'pills') { const from = { pills: have('pills') }, m = D.moveProduct(h, from, k, n, 1); if (m) root.NightshiftSupply?.take?.({ pills: m }); return m; }
    const pk = pocket(); if (!pk) return 0; const m = D.moveProduct(h, pk, k, n, 1); root.NightshiftInventory?.save?.(); return m;
  }
  function take(id, k, n) {
    const h = state.houses[id]; if (!h) return;
    if (k === 'pills') { const n2 = Math.min(n, h.stock.pills), res = root.NightshiftSupply?.give?.({ pills: n2 }); const got = res?.added?.pills ?? n2; h.stock.pills -= got; return got; }
    const pk = pocket(); if (!pk) return 0; const m = D.moveProduct(h, pk, k, n, -1); root.NightshiftInventory?.save?.(); return m;
  }
  function open(id) {
    const d = doorOf(id), p = P(); if (!d) return;
    if (alerts[id] && owns(id)) {
      head('🚨 RAID IN PROGRESS', `They're at the back door of your ${d.name}. Go in and hold it: drop every raider. Walk away and they take a cut.`);
      pnl.append(btn('red', `🛡️ DEFEND IT (${D.raiders(state.houses[id])} raiders)`, () => { pnl.hidden = true; defend(id); }), el('span', { style: 'margin-left:10px;color:#a9b8ca;font-size:11px' }, `${Math.max(0, Math.ceil((alerts[id].until - Date.now()) / 1000))} s before they're in`));
      return;
    }
    if (!owns(id)) {
      head(`🏚️ ${d.name.toUpperCase()} · EMPTY`, 'The crew that ran this place is gone. New locks, a cleaner and a word with the landlord, and it\'s yours.');
      const box = el('div', { className: 'box' }); box.append(el('b', {}, 'Make it your stash house'), el('div', { className: 'ln' }, `Store product and cash, put a crew on it to sell for you (${Object.entries(D.SELL_RATE).map(([k, r]) => `${r} ${D.PRODUCTS[k].icon}/h`).join(', ')} at ${Math.round(D.SELL_CUT * 100)}% of street price). Rival crews will try to take it back.`));
      box.append(btn('go', `TAKE OVER · ${money(D.TAKEOVER)}`, () => { tag('stash'); const r = D.takeOver(state, P(), id); if (!r.ok) { say(r.reason); return; } persist(); gameSave(); say(`🏠 The ${d.name} is yours now. Stock it up and lock it down.`); open(id); }, (p?.cash || 0) < D.TAKEOVER));
      pnl.append(box); return;
    }
    const h = state.houses[id], sec = D.security(h);
    D.tick(h, Date.now(), mod('dealing.price'));
    head(`🏠 YOUR STASH HOUSE · ${d.name.toUpperCase()}`, `Worth ${money(D.value(h))} inside · security ${Math.round(sec * 100)}% · ${h.raids} raids (${h.repelled} repelled) · crew sold ${h.sold} units for ${money(h.earned)}`);
    const meter = el('div', { className: 'meter' }), mi = el('i'); mi.style.width = `${Math.round(sec / 0.9 * 100)}%`; meter.append(mi); pnl.append(meter);
    pnl.append(el('h3', {}, 'STASH'));
    const grid = el('div', { className: 'grid' });
    for (const [k, pr] of Object.entries(D.PRODUCTS)) {
      const box = el('div', { className: 'box' }); box.append(el('b', {}, `${pr.icon} ${pr.name} · ${h.stock[k]}/${D.CAP}`), el('div', { className: 'ln' }, `You carry ${have(k)} · crew moves ${D.SELL_RATE[k]}/h at ~${money(pr.price * D.SELL_CUT * mod('dealing.price'))} each`));
      const a = el('div', { className: 'acts' }); a.append(btn('go', 'STORE ALL', () => { const m = store(id, k, 9999); say(m ? `🏠 Stored ${m} ${pr.icon}` : 'Nothing to store'); persist(); gameSave(); open(id); }, !have(k)), btn('alt', 'TAKE 10', () => { take(id, k, 10); persist(); gameSave(); open(id); }, !h.stock[k]));
      box.append(a); grid.append(box);
    }
    { const box = el('div', { className: 'box' }); box.append(el('b', {}, `💵 Cash · ${money(h.cash)}`), el('div', { className: 'ln' }, h.sec.safe ? `Your safe protects ${Math.round(D.SAFE_PROTECT[h.sec.safe] * 100)}% of it from raids` : 'No safe: raiders can take a big share'));
      const a = el('div', { className: 'acts' }); a.append(btn('go', 'WITHDRAW ALL', () => { tag('stash'); D.moveCash(h, P(), h.cash, -1); persist(); gameSave(); open(id); }, !h.cash), btn('alt', 'DEPOSIT $1,000', () => { tag('ignore'); D.moveCash(h, P(), 1000, 1); persist(); gameSave(); open(id); }, (p?.cash || 0) < 1000));
      box.append(a); grid.append(box); }
    pnl.append(grid, el('h3', {}, 'SECURITY'));
    const sg = el('div', { className: 'grid' });
    for (const u of D.UPGRADES) {
      const lv = h.sec[u.id], next = lv + 1 < u.levels.length ? lv + 1 : null, box = el('div', { className: 'box' });
      box.append(el('b', {}, `${u.icon} ${u.levels[lv]}`), el('div', { className: 'ln' }, next ? `Next: ${u.levels[next]}${u.id === 'guards' ? ` · wages ${money(D.GUARD_WAGE)}/h each, paid from the stash` : ''}` : 'Maxed out'));
      if (next) box.append(btn('go', `UPGRADE · ${money(u.prices[next])}`, () => { const r = D.upgrade(state, P(), id, u.id); if (!r.ok) { say(r.reason); return; } persist(); gameSave(); say(`${u.icon} ${r.name} installed`); open(id); }, (p?.cash || 0) < u.prices[next]));
      sg.append(box);
    }
    pnl.append(sg);
    if (h.log.length) { pnl.append(el('h3', {}, 'LOG')); const lg = el('div', { className: 'log' }); for (const e of h.log.slice().reverse()) lg.append(el('div', {}, `• ${e.text}`)); pnl.append(lg); }
    pnl.append(el('div', { className: 'sub', style: 'margin-top:8px' }, 'Raids come when there\'s a lot inside. Cameras warn you in time to rush back and fight them off yourself.'));
  }

  root.NightshiftSafehouse = Object.freeze({ get state() { return state; }, open, owns, canTake, cleared, defend, alert: (id) => !!alerts[id], secLevel: (id, k) => state.houses[id]?.sec?.[k] || 0, paused: () => !pnl.hidden, _raid: (id) => { const h = state.houses[id]; if (!h) return false; h.lastRaid = 0; nextCheck[id] = 0; return true; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
