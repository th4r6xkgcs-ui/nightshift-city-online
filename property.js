/* Properties in game (Claude-owned, v0.64). Requires property-data.js (+ gangs.js squads for live robberies).
 *  - Every shop, diner, boutique, garage, warehouse, gas station and club outside the starting core has a door point:
 *    FOR SALE -> BUY. Owned ones show your crew banner and the register total; tap MANAGE to collect and upgrade.
 *  - Robberies: near the store (< ~1200px) robbers show up and you have 75 s to stop them (your guard helps);
 *    far away it resolves on the odds (security + guard). You get a text with GPS either way.
 *  - 🏪 Business app on the phone lists everything you own with totals and GPS.
 *  - Events go out on 'ns:event' (buy, collect, robbery, defended, robbed) for the story and later multiplayer.
 * Save: nightshift-property-v1. API: NightshiftProperty.{state, catalog, open, manage, close, paused, robbery} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const D = root.NightshiftPropertyData; if (!D) return;
  const KEY = 'nightshift-property-v1';
  let state = D.clean({}); try { state = D.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private */ } };
  const emit = (detail) => { try { root.dispatchEvent(new CustomEvent('ns:event', { detail })); } catch { /* n/a */ } };
  const P = () => { try { return player; } catch { return null; } }; // eslint-disable-line no-undef
  const money = (n) => '$' + Math.round(n).toLocaleString();
  let cat = null, byId = {};
  function catalog() {
    if (!cat) { let B = []; try { B = buildings; } catch { return []; } if (!B?.length) return []; cat = D.catalog(B, (x, y) => root.NightshiftWorld?.regionAt?.(x, y)); byId = Object.fromEntries(cat.map((p) => [p.id, p])); for (const id of Object.keys(state.props)) if (!byId[id]) delete state.props[id]; } // eslint-disable-line no-undef
    return cat;
  }
  const name = (p) => { let n = ''; try { n = root.NightshiftModern?.brand?.(p.b) || ''; } catch { /* n/a */ } return n || (p.type === 'GAS' ? 'VOLT gas station' : p.type === 'CORNER SHOP' ? 'Corner store' : p.type.charAt(0) + p.type.slice(1).toLowerCase()); };
  const gangFor = (p) => { const G = root.NightshiftGangsData?.GANGS || []; return (G.find((g) => g.district === p.region) || G[Math.floor(Math.random() * G.length)] || { id: 'rats' }).id; };

  // ---------- robberies ----------
  let live = null; // { id, tag, until, gang }
  function robTick(sec) {
    const p = P(); if (!p) return; catalog(); D.accrue(state, byId);
    if (live) {
      const alive = root.NightshiftGangs?.alive?.(live.tag) ?? 0, prop = byId[live.id], o = state.props[live.id], now = performance.now();
      if (!prop || !o) { live = null; return; }
      if (alive === 0) {
        const bonus = Math.floor(o.register * 0.1); p.cash += bonus; state.defended++; persist();
        text(`✅ You saved ${name(prop)}. The register's safe${bonus ? ` · the staff slipped you ${money(bonus)}` : ''}.`, prop); emit({ type: 'defended', id: live.id }); live = null; try { save(); } catch { /* n/a */ } return; // eslint-disable-line no-undef
      }
      if (now > live.until) {
        const lost = D.robberyLoss(o); o.register -= lost; state.robbed += lost; persist();
        try { root.NightshiftGangs?.clearSquad?.(live.tag); } catch { /* n/a */ }
        text(`🏳️ They got away from ${name(prop)} with ${money(lost)}. More security cuts what they can grab.`, prop); emit({ type: 'robbed', id: live.id, lost }); live = null; return;
      }
      return;
    }
    for (const [id, o] of Object.entries(state.props)) {
      const prop = byId[id]; if (!prop) continue;
      if (Math.random() >= D.robberyChance(prop, o, sec)) continue;
      robbery(id); break;
    }
  }
  function robbery(id) {
    const prop = byId[id] || (catalog(), byId[id]), o = state.props[id], p = P(); if (!prop || !o || !p || live) return false;
    const d = Math.hypot(prop.door.x - p.x, prop.door.y - p.y), G = root.NightshiftGangs;
    if (d < 1200 && G?.squad) {
      const tag = 'rob-' + id + '-' + Date.now().toString(36), gang = gangFor(prop);
      G.squad({ x: prop.door.x + 70, y: prop.door.y + 2, gang, n: 2 + (Math.random() < 0.5 ? 1 : 0), tag, vs: ['player', 'you'], hunt: 0 });
      if (o.guard) G.squad({ x: prop.door.x - 20, y: prop.door.y + 2, gang: root.NightshiftGangsData?.PLAYER, n: 1, tag: tag + '-guard', vs: [gang], gear: root.NightshiftGangsData?.GEAR?.[1], hunt: 200 });
      live = { id, tag, until: performance.now() + 75000, gang };
      text(`🚨 ${name(prop)} is being robbed right now! Get there in 75 seconds.${o.guard ? ' Your guard is holding them off.' : ''}`, prop, true);
      emit({ type: 'robbery', id, live: true }); return true;
    }
    if (Math.random() < D.defendChance(o)) { state.defended++; text(`🛡️ Someone tried to rob ${name(prop)} · ${o.guard ? 'your guard' : 'the alarm'} ran them off.`, prop); emit({ type: 'defended', id, remote: true }); }
    else { const lost = D.robberyLoss(o); o.register -= lost; state.robbed += lost; text(`🏳️ ${name(prop)} got robbed while you were away · lost ${money(lost)}. Security + a guard stop most of these.`, prop); emit({ type: 'robbed', id, lost, remote: true }); }
    persist(); return true;
  }
  function text(msg, prop, urgent) { try { root.NightshiftPhone?.text?.('biz', msg, { gps: { x: prop.door.x, y: prop.door.y, label: name(prop) } }); } catch { say(msg); } if (urgent) { try { root.NightshiftMap?.navigate?.({ x: prop.door.x, y: prop.door.y, label: 'Robbery · ' + name(prop) }); } catch { /* n/a */ } } }

  // ---------- panels ----------
  const css = document.createElement('style');
  css.textContent = `#prPanel{position:fixed;inset:7% 10%;z-index:46;overflow:auto;background:#0f1830f5;border:1px solid #6f8db3;border-radius:14px;padding:12px 14px;color:#e8eff7;font:13px ui-monospace,Menlo,monospace}
  #prPanel[hidden]{display:none} #prPanel h2{margin:0 0 4px;font-size:16px} #prPanel h3{margin:10px 0 6px;font-size:12px;color:#9fb3c8;letter-spacing:.08em} #prPanel .sub{font-size:11.5px;color:#b9c8da;margin-bottom:8px}
  #prPanel .row{display:flex;gap:8px;align-items:center;background:#16233d;border:1px solid #2f4669;border-radius:9px;padding:7px 9px;margin-bottom:6px} #prPanel .row div{flex:1} #prPanel .row small{display:block;color:#b9c8da;font-size:11px}
  #prPanel button{all:unset;box-sizing:border-box;cursor:pointer;font:700 12px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:8px;padding:6px 10px;white-space:nowrap} #prPanel button[disabled]{opacity:.4;cursor:default} #prPanel .x{float:right}
  #prPanel .big{font-size:20px;font-weight:800;color:#7cffb5}`;
  document.head.appendChild(css);
  const panel = Object.assign(document.createElement('section'), { id: 'prPanel', hidden: true }); document.body.appendChild(panel);
  const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); for (const k of kids) if (k !== null && k !== undefined) n.append(k); return n; };
  const row = (title, sub, label, fn, dis) => el('div', { className: 'row' }, el('div', {}, document.createTextNode(title), el('small', { textContent: sub })), el('button', { textContent: label, disabled: !!dis, onclick: fn }));
  function manage(id) {
    catalog(); const prop = byId[id], p = P(); if (!prop || !p) return; const o = state.props[id];
    if (!o) {
      panel.replaceChildren(el('button', { className: 'x', textContent: 'CLOSE', onclick: close }), el('h2', { textContent: `${prop.icon} ${name(prop)} · FOR SALE` }),
        el('div', { className: 'sub', textContent: `${prop.region} · ${prop.type === 'GAS' ? 'gas station' : prop.type.toLowerCase()}. Earns ${money(prop.perHour)}/hr into the register (holds ${D.CAP_HOURS} hours, keeps filling while you're offline). Robbers go after full registers.` }),
        el('div', { className: 'big', textContent: money(prop.price) }),
        row('🏷️ Buy it', `You have ${money(p.cash)}`, 'BUY', () => { const r = D.buy(state, prop, p); say(r.ok ? `🏪 ${name(prop)} is yours · collect the register here` : r.reason); if (r.ok) { persist(); emit({ type: 'buy', id, price: prop.price }); try { root.NightshiftSkills?.gain?.('charisma', 40, 'property'); save(); } catch { /* n/a */ } } manage(id); }, p.cash < prop.price)); // eslint-disable-line no-undef
      panel.hidden = false; return;
    }
    D.accrue(state, byId); const reg = Math.floor(o.register);
    panel.replaceChildren(el('button', { className: 'x', textContent: 'CLOSE', onclick: close }), el('h2', { textContent: `${prop.icon} ${name(prop)} · YOURS` }),
      el('div', { className: 'sub', textContent: `${prop.region} · ${money(D.rate(prop, o))}/hr · register holds ${money(D.cap(prop, o))} · robbery odds ${Math.round(D.SECURITY[o.security] * 100)}% of normal · away-defence ${Math.round(D.defendChance(o) * 100)}%` }),
      row('💰 Collect the register', reg ? 'Cash from the till' : 'Empty · check back later', reg ? money(reg) : '—', () => { const n = D.collect(state, prop, p); if (n) { say(`💰 +${money(n)} from ${name(prop)}`); emit({ type: 'collect', id, amount: n }); persist(); try { save(); } catch { /* n/a */ } } manage(id); }, !reg)); // eslint-disable-line no-undef
    panel.append(el('h3', { textContent: 'UPGRADES' }));
    const up = (title, sub, kind) => { const c = kind === 'guard' ? (o.guard ? null : Math.round(prop.price * 0.3 / 100) * 100) : D.upgradeCost(prop, kind, o[kind]); panel.append(row(title, sub, c === null ? 'MAX' : money(c), () => { const r = D.upgrade(state, prop, kind, p); say(r.ok ? `⬆️ ${title.replace(/^\S+\s/, '')} upgraded` : r.reason); persist(); try { save(); } catch { /* n/a */ } manage(id); }, c === null || p.cash < c)); }; // eslint-disable-line no-undef
    up(`📦 Stock · level ${o.stock}/${D.MAX_LEVEL}`, '+25% income per level', 'stock');
    up(`📹 Security · level ${o.security}/${D.MAX_LEVEL}`, 'Cameras, alarm, shutters · fewer robberies and smaller losses', 'security');
    up(`🧍 Guard · ${o.guard ? 'hired' : 'none'}`, 'Fights robbers with you and holds the door while you\'re away', 'guard');
    panel.append(el('h3', { textContent: 'SELL' }), row('🏷️ Sell it back', 'You get 60% of the price, half of what you put into it, plus the register', 'SELL', () => { const n = D.sell(state, prop, p); say(`🏷️ Sold ${name(prop)} · +${money(n)}`); persist(); try { save(); } catch { /* n/a */ } close(); })); // eslint-disable-line no-undef
    panel.hidden = false;
  }
  function open() {
    catalog(); D.accrue(state, byId); const p = P(); const own = Object.entries(state.props);
    panel.replaceChildren(el('button', { className: 'x', textContent: 'CLOSE', onclick: close }), el('h2', { textContent: '🏪 Your businesses' }),
      el('div', { className: 'sub', textContent: own.length ? `${own.length} owned · ${money(D.perHour(state, byId))}/hr · ${money(D.totalPending(state, byId))} waiting in registers · lifetime ${money(state.earned)} earned, ${money(state.robbed)} lost to robbers, ${state.defended} robberies stopped` : 'Nothing yet. Every shop, diner, boutique, garage, warehouse, gas station and club outside the starting blocks is for sale: walk up to its door and tap BUY.' }));
    for (const [id, o] of own) { const prop = byId[id]; if (!prop) continue; panel.append(row(`${prop.icon} ${name(prop)}`, `${prop.region} · ${money(Math.floor(o.register))} in the till · stock ${o.stock} · security ${o.security}${o.guard ? ' · guard' : ''}`, 'GPS', () => { try { root.NightshiftMap?.navigate?.({ x: prop.door.x, y: prop.door.y, label: name(prop) }); } catch { /* n/a */ } close(); })); }
    if (!own.length && p) { const near = catalog().slice().sort((a, b) => Math.hypot(a.door.x - p.x, a.door.y - p.y) - Math.hypot(b.door.x - p.x, b.door.y - p.y)).slice(0, 4); panel.append(el('h3', { textContent: 'CLOSEST FOR SALE' })); for (const prop of near) panel.append(row(`${prop.icon} ${name(prop)}`, `${prop.region} · ${money(prop.price)} · ${money(prop.perHour)}/hr`, 'GPS', () => { try { root.NightshiftMap?.navigate?.({ x: prop.door.x, y: prop.door.y, label: name(prop) + ' · for sale' }); } catch { /* n/a */ } close(); })); }
    panel.hidden = false;
  }
  function close() { panel.hidden = true; }

  // ---------- world: door points + banners ----------
  function points() {
    const p = P(); if (!p) return []; const out = [];
    for (const prop of catalog()) {
      if (Math.abs(prop.door.x - p.x) > 700 || Math.abs(prop.door.y - p.y) > 500) continue;
      const o = state.props[prop.id];
      out.push(o ? { id: 'prop-' + prop.id, type: 'shop', x: prop.door.x, y: prop.door.y, ready: true, color: '#ff7ad8', label: `${prop.icon} YOURS · ${money(Math.floor(o.register))}`, action: 'MANAGE', hint: `${name(prop)} · collect, upgrade, sell` }
        : { id: 'prop-' + prop.id, type: 'shop', x: prop.door.x, y: prop.door.y, ready: true, color: '#9fb3c8', label: `🏷️ ${money(prop.price)}`, action: 'BUY', hint: `${name(prop)} · for sale · ${money(prop.perHour)}/hr` });
    }
    return out;
  }
  function banners() {
    let ctx = null; try { ctx = g; } catch { return; } // eslint-disable-line no-undef
    const p = P(); if (!ctx || !p) return; const now = performance.now();
    for (const [id, o] of Object.entries(state.props)) {
      const prop = byId[id]; if (!prop || Math.abs(prop.door.x - p.x) > 900 || Math.abs(prop.door.y - p.y) > 600) continue;
      const b = prop.b, x = b.x + b.w - 26, y = b.y + b.h - 70;
      ctx.save(); ctx.fillStyle = '#0b0d14'; ctx.fillRect(x - 1, y - 1, 2, 30); ctx.fillStyle = '#a34a8a'; ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 22 + Math.sin(now / 300) * 1.5, y + 4); ctx.lineTo(x + 1, y + 12); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffd6f3'; ctx.font = '800 6px "Chakra Petch",ui-sans-serif,sans-serif'; ctx.fillText('NS', x + 4, y + 8);
      if (live?.id === id) { ctx.strokeStyle = `rgba(255,70,90,${0.5 + 0.4 * Math.sin(now / 120)})`; ctx.lineWidth = 3; ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); }
      ctx.restore();
    }
  }
  // ---------- hooks + loop ----------
  const hook = setInterval(() => {
    const E = root.NightshiftEncounters;
    if (E && typeof E.locations === 'function' && !E.__property) {
      const locs = E.locations, use = E.use, draw = E.draw;
      E.locations = function () { const list = locs.apply(this, arguments) || []; try { return [...list, ...points()]; } catch { return list; } };
      E.use = function (id) { if (typeof id === 'string' && id.startsWith('prop-')) { manage(id.slice(5)); return true; } return use.apply(this, arguments); };
      E.draw = function () { const r = draw.apply(this, arguments); try { banners(); } catch { /* cosmetic */ } return r; };
      E.__property = true; clearInterval(hook);
    }
  }, 300);
  setInterval(() => { try { let zone = false; try { zone = !!(root.NightshiftZones?.active?.() || root.NightshiftHome?.kind?.()); } catch { /* n/a */ } if (!zone) robTick(2); else D.accrue(state, byId); } catch (e) { console.error(e); } }, 2000);
  setInterval(persist, 15000);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  root.NightshiftProperty = Object.freeze({ get state() { return state; }, catalog, open, manage, close, paused: () => !panel.hidden, robbery, live: () => live, owned: () => Object.keys(state.props).length, name: (id) => (byId[id] ? name(byId[id]) : id) });
})(typeof globalThis !== 'undefined' ? globalThis : this);
