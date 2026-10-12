/* Hidden stashes in game (Claude-owned). Requires stashes-data.js. Walk over a hidden package to grab cash and
 * salvage items (scrap/parts/watch/jewelry go into the Codex inventory pocket, capped at 999). A gold glint shows
 * when you're close. The phone sells a $250 rumor that circles a rough area on the map. Milestones at 5/10/20/30.
 * Save: nightshift-stashes-v1. API: NightshiftStashes.{state, buyRumor, count, total} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const S = root.NightshiftStashesData;
  const KEY = 'nightshift-stashes-v1';
  let state = S.clean({});
  try { state = S.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function give(items) {
    const inv = root.NightshiftInventory, pocket = inv?.state?.pocket, got = [];
    if (!pocket) return got;
    for (const [k, n] of Object.entries(items)) {
      const room = Math.max(0, 999 - (pocket[k] || 0)), q = Math.min(room, n);
      if (q > 0) { pocket[k] = (pocket[k] || 0) + q; got.push(`${q} ${k}`); }
    }
    try { inv.save?.(); } catch { /* best effort */ }
    return got;
  }
  function tick() {
    const p = P(); if (!p || p.hp <= 0 || p.car) return;
    for (const s of S.SPOTS) {
      if (state.found[s.id] || dist(p, s) > S.PICKUP) continue;
      const r = S.take(state, s.id); if (!r) continue;
      const cash = r.cash + r.bonus;
      try { root.NightshiftGoals?.notePayout?.(cash); } catch { /* optional */ }
      p.cash = Math.min(100000000, p.cash + cash);
      const got = give(r.items);
      try { root.NightshiftSkills?.gain('luck', 50, 'stash'); } catch { /* optional */ }
      persist(); gameSave();
      say(`📦 STASH ${r.total}/${S.SPOTS.length} · +${money(r.cash)}${got.length ? ' · ' + got.join(', ') : ''}`);
      if (r.bonus) setTimeout(() => say(`🏆 ${r.total} stashes found · bonus +${money(r.bonus)}`), 2600);
      try { root.NightshiftAudio?.play('pickup'); } catch { /* sound optional */ }
      if (state.rumor === null) root.NightshiftMap?.clear?.('stash-rumor');
    }
  }
  setInterval(tick, 150);

  function buyRumor() {
    const p = P(); if (!p) return false;
    if (S.count(state) >= S.SPOTS.length) { say('📦 You found every stash in the city'); return false; }
    if (!state.rumor) {
      if (p.cash < S.RUMOR_PRICE) { say(`📦 A rumor costs ${money(S.RUMOR_PRICE)}`); return false; }
      p.cash -= S.RUMOR_PRICE; state.rumor = S.rumor(state); persist(); gameSave();
      say(`📦 Rumor bought · a stash is somewhere inside the gold circle`);
    }
    try { root.NightshiftMap?.navigate?.({ x: state.rumor.x, y: state.rumor.y, label: '📦 Stash rumor', id: 'stash-rumor' }); } catch { /* optional */ }
    return true;
  }

  function drawWorld() {
    const ctx = G(), p = P(); if (!ctx || !p) return;
    const t = performance.now() / 1000;
    ctx.save();
    if (state.rumor) {
      const r = state.rumor;
      ctx.strokeStyle = '#ffd97066'; ctx.lineWidth = 3; ctx.setLineDash?.([10, 8]); ctx.lineDashOffset = t * 12;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash?.([]);
      ctx.fillStyle = '#ffd97014'; ctx.fill();
    }
    for (const s of S.SPOTS) {
      if (state.found[s.id]) continue;
      const d = dist(p, s); if (d > S.GLINT) continue;
      const k = 1 - d / S.GLINT, pulse = 0.5 + 0.5 * Math.sin(t * 6 + s.x);
      ctx.globalAlpha = Math.min(1, 0.25 + k * 0.9) * (0.6 + 0.4 * pulse);
      const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(s.x + x), Math.round(s.y + y), w, h); };
      R('#05080f55', -9, 5, 20, 3); R('#0b0f17', -10, -6, 20, 12); // shadow + outline
      R('#2f4a3a', -9, -5, 18, 10); R('#3e624c', -9, -5, 18, 3); R('#22362a', -9, 3, 18, 2); // duffel
      R('#1a2a20', -9, -1, 18, 1); R('#c9c3a8', -1, -2, 2, 3); // zip + pull
      R('#0b0f17', -5, -9, 10, 4); R('#2f4a3a', -4, -8, 8, 2); // handle
      R('#d9d4c0', -9, -3, 3, 6); R('#d9d4c0', 6, -3, 3, 6); // tape
    }
    ctx.restore();
  }
  // The glint draws on the top world layer (after trees, awnings and people) so a stash under a canopy still sparkles.
  function drawGlints() {
    const ctx = G(), p = P(); if (!ctx || !p) return;
    const t = performance.now() / 1000;
    ctx.save();
    for (const s of S.SPOTS) {
      if (state.found[s.id]) continue;
      const d = dist(p, s); if (d > S.GLINT) continue;
      const k = 1 - d / S.GLINT, pulse = 0.5 + 0.5 * Math.sin(t * 6 + s.x), r = 4 + pulse * 6;
      ctx.globalAlpha = Math.min(1, 0.3 + k) * (0.5 + 0.5 * pulse);
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x + 10, s.y - 12 - r); ctx.lineTo(s.x + 10, s.y - 12 + r); ctx.moveTo(s.x + 10 - r, s.y - 12); ctx.lineTo(s.x + 10 + r, s.y - 12); ctx.stroke();
    }
    ctx.restore();
  }
  const I = root.NightshiftFeedback; // draw() runs after the scene layer, still in world space
  if (I && typeof I.draw === 'function' && !I.__stashes) { try { const d2 = I.draw; I.draw = function () { const r = d2.apply(this, arguments); try { drawGlints(); } catch { /* cosmetic */ } return r; }; I.__stashes = true; } catch { /* frozen: no glint layer */ } }
  const E = root.NightshiftEncounters;
  if (E && !E.__stashes) { const draw = E.draw; E.draw = function () { const r = draw.apply(this, arguments); try { drawWorld(); } catch { /* cosmetic */ } return r; }; E.__stashes = true; }

  root.NightshiftStashes = Object.freeze({ get state() { return state; }, buyRumor, count: () => S.count(state), total: S.SPOTS.length });
})(typeof globalThis !== 'undefined' ? globalThis : this);
