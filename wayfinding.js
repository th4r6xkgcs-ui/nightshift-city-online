/* Wayfinding (Claude-owned): so the bigger city never feels lost.
 *  1) District banners: crossing into a new part of town shows its name and what it's good for.
 *  2) "Around you" chip under the goal card: the nearest interesting place with direction + distance.
 *     Tap it for a list of everything nearby (one per kind, nearest first) with a one-line "what's this"
 *     and a GO button that starts the road GPS.
 *  3) A short "getting around" crib in that panel (cars, bus, map, doors).
 * Reads NightshiftEncounters.locations() (every module's world points, incl. interior doors) - no new data.
 * API: NightshiftWayfinding.{open, close, nearby, district, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const say = (m) => { try { root.say?.(m); } catch { /* n/a */ } };
  const TAG = {
    'WEST END': 'parks, canal, grow plots', MIDTOWN: 'home turf · shops, jobs, the loop', SOUTHSIDE: 'scrapyard, trap houses, cheap rent', 'THE DOCKS': 'chop shop, pier, warehouses',
    DOWNTOWN: 'towers, banks, big money', 'THE HEIGHTS': 'rich houses · break-ins pay big', 'OLD TOWN': 'diners, corner shops, old crews', 'MARKET DISTRICT': 'shops on every block',
    IRONWORKS: 'warehouses full of parts', FAIRVIEW: 'quiet streets, apartment lobbies', 'THE FLATS': 'clubs and late nights', HARBOR: 'garages, cargo and the water',
  };
  const district = (x, y) => { try { return root.NightshiftWorld?.districtName?.(x, y) || root.NightshiftEnvironment?.district?.({ x, y }) || ''; } catch { return ''; } };
  const busy = () => { try { return !!(root.NightshiftZones?.active?.() || root.NightshiftHome?.kind?.()); } catch { return false; } };
  const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  const arrow = (dx, dy) => ARROWS[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  const meters = (d) => (d < 1000 ? Math.max(1, Math.round(d / 10)) + 'm' : (d / 1000).toFixed(1) + 'km');
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  // ---------- nearby places ----------
  function nearby(limit = 12) {
    const p = P(); if (!p) return [];
    let L = []; try { L = root.NightshiftEncounters?.locations?.() || []; } catch { return []; }
    const seen = new Map();
    for (const l of L) {
      if (!Number.isFinite(l.x) || !Number.isFinite(l.y) || l.ready === false) continue;
      const d = Math.hypot(l.x - p.x, l.y - p.y), key = clean(l.label).toUpperCase();
      if (!key || d > 2600) continue;
      const cur = seen.get(key); if (!cur || cur.d > d) seen.set(key, { ...l, d, key });
    }
    return [...seen.values()].sort((a, b) => a.d - b.d).slice(0, limit);
  }

  // ---------- UI ----------
  const css = document.createElement('style');
  css.textContent = `
  #wfChip{all:unset;box-sizing:border-box;position:fixed;z-index:24;left:12px;top:178px;max-width:min(260px,46vw);cursor:pointer;display:flex;gap:6px;align-items:center;
    background:#101728d9;border:1px solid #3f5a7a;border-left:3px solid #9fd4ff;border-radius:10px;color:#e8eff7;font:600 10.5px/1.25 ui-monospace,Menlo,monospace;padding:4px 8px;white-space:nowrap;overflow:hidden}
  #wfChip[hidden]{display:none} #wfChip .k{color:#9fd4ff;font-size:9.5px;letter-spacing:.06em} #wfChip .a{color:#ffd970;font-weight:800}
  #wfChip .n{overflow:hidden;text-overflow:ellipsis}
  #wfBan{position:fixed;left:50%;top:18%;transform:translate(-50%,-6px);z-index:30;pointer-events:none;opacity:0;transition:opacity .35s,transform .35s;text-align:center;
    color:#fff;font:800 22px/1.1 "Chakra Petch",ui-monospace,monospace;letter-spacing:.18em;text-shadow:0 2px 0 #000,0 0 14px #000c}
  #wfBan.on{opacity:1;transform:translate(-50%,0)} #wfBan small{display:block;margin-top:4px;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.06em;color:#ffd970}
  #wfBan i{display:block;font-style:normal;font-size:9.5px;letter-spacing:.3em;color:#9fd4ff;margin-bottom:3px}
  #wfPanel{position:fixed;inset:6% 6%;z-index:46;overflow:auto;background:#0f1830f5;border:1px solid #6f8db3;border-radius:14px;padding:12px 14px;color:#e8eff7;font:13px ui-monospace,Menlo,monospace}
  #wfPanel[hidden]{display:none} #wfPanel h2{margin:0 0 2px;font-size:16px} #wfPanel h3{margin:12px 0 6px;font-size:12px;color:#9fb3c8;letter-spacing:.08em}
  #wfPanel .sub{font-size:11px;color:#b9c8da;margin-bottom:8px}
  #wfPanel .r{display:flex;gap:8px;align-items:center;background:#16233d;border:1px solid #2f4669;border-radius:9px;padding:6px 8px;margin-bottom:5px}
  #wfPanel .r .d{width:52px;text-align:center;color:#ffd970;font-weight:700;font-size:12px} #wfPanel .r .b{flex:1;min-width:0}
  #wfPanel .r .h{font-size:11px;color:#b9c8da;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #wfPanel button{all:unset;box-sizing:border-box;cursor:pointer;font:700 12px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:8px;padding:6px 10px}
  #wfPanel .close{position:sticky;top:0;float:right} #wfPanel ul{margin:0;padding-left:18px;font-size:12px;color:#d3deea} #wfPanel li{margin-bottom:4px}
  @media (max-height:430px){#wfChip{font-size:10px}}`;
  document.head.appendChild(css);
  const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); for (const k of kids) n.append(k); return n; };
  const chip = el('button', { id: 'wfChip', hidden: true, title: 'What\'s around you' });
  const ban = el('div', { id: 'wfBan' });
  const panel = el('section', { id: 'wfPanel', hidden: true });
  document.body.append(chip, ban, panel);
  chip.onclick = (e) => { e.stopPropagation(); open(); };

  function gps(l) {
    const M = root.NightshiftMap; let ok = false;
    try { ok = M?.navigate?.({ x: l.x, y: l.y, label: clean(l.label).slice(0, 60), id: 'wf' }) === true; } catch { /* n/a */ }
    if (!ok) say('📍 ' + clean(l.label) + ' · ' + meters(l.d) + ' ' + arrow(l.x - P().x, l.y - P().y));
    close();
  }
  function open() {
    const p = P(); if (!p) return;
    const list = nearby(14), here = district(p.x, p.y);
    panel.replaceChildren(
      el('button', { className: 'close', textContent: 'CLOSE', onclick: close }),
      el('h2', { textContent: '📍 Around you' }),
      el('div', { className: 'sub', textContent: `${here || 'The city'}${TAG[here] ? ' · ' + TAG[here] : ''}. Tap GO to set the GPS - the line on the road leads you there.` }));
    if (!list.length) panel.append(el('div', { className: 'sub', textContent: 'Nothing marked nearby. Open the MAP and head for a district.' }));
    for (const l of list) {
      panel.append(el('div', { className: 'r' },
        el('div', { className: 'd', textContent: `${arrow(l.x - p.x, l.y - p.y)} ${meters(l.d)}` }),
        el('div', { className: 'b' }, el('div', { textContent: clean(l.label) }), el('div', { className: 'h', textContent: clean(l.hint) || clean(l.action) })),
        el('button', { textContent: 'GO', onclick: () => gps(l) })));
    }
    panel.append(el('h3', { textContent: 'GETTING AROUND' }), el('ul', {},
      el('li', { textContent: '🚗 Parked cars sit at the kerb on every block - walk up and USE to drive. Cross town in seconds.' }),
      el('li', { textContent: '🚪 Most buildings have a door: walk to it and press ENTER to go inside.' }),
      el('li', { textContent: '🗺️ MAP (minimap tap) shows every district; tap a spot to set the GPS.' }),
      el('li', { textContent: '🎯 The gold arrow next to you always points at your tracked goal.' }),
      el('li', { textContent: '🚌 Bus stops ride out to the suburbs and countryside.' })));
    panel.hidden = false;
  }
  function close() { panel.hidden = true; }

  // ---------- loop ----------
  let lastD = null, banT = 0, lastChip = 0;
  function banner(name) {
    ban.replaceChildren(el('i', { textContent: 'ENTERING' }), document.createTextNode(name), el('small', { textContent: TAG[name] || '' }));
    ban.classList.add('on'); clearTimeout(banT); banT = setTimeout(() => ban.classList.remove('on'), 2600);
  }
  function tick() {
    const p = P();
    if (!p || p.hp <= 0 || busy()) { chip.hidden = true; lastD = busy() ? lastD : null; return; }
    const d = district(p.x, p.y);
    if (d && d !== lastD) { if (lastD !== null) banner(d); lastD = d; }
    const now = performance.now(); if (now - lastChip < 700) return; lastChip = now;
    const n = nearby(1)[0];
    if (!n) { chip.hidden = true; return; }
    const card = document.getElementById('glCard'); let top = 178;
    try { if (card && !card.hidden && card.offsetParent) top = Math.round(card.getBoundingClientRect().bottom + 6); } catch { /* n/a */ }
    chip.style.top = top + 'px';
    chip.replaceChildren(el('span', { className: 'k', textContent: 'NEAR' }), el('span', { className: 'a', textContent: arrow(n.x - p.x, n.y - p.y) + ' ' + meters(n.d) }), el('span', { className: 'n', textContent: clean(n.label) }));
    chip.hidden = false;
  }
  setInterval(() => { try { tick(); } catch { /* cosmetic */ } }, 250);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  root.NightshiftWayfinding = Object.freeze({ open, close, nearby, district: () => lastD, paused: () => !panel.hidden });
})(typeof globalThis !== 'undefined' ? globalThis : this);
