/* "Heat Check" side questline (Claude-owned, v0.75). Rico texts you three jobs that use the new systems:
 *   1) Hold up any store (interiors hold-ups)             → $300
 *   2) Get the cops on you, then lose them (wanted → 0)   → $400
 *   3) Wreck a police cruiser (ram it three times)        → $800 + a final text
 *   v0.78 chapter 2 (3 min later): 4) rob a GUN SHOP → $1,200   5) shoot down the ★5 police helicopter → $1,500
 * Starts ~40 s into a session if not done. Progress is measured from counters captured when each step starts, so
 * nothing is retroactive. Texts carry GPS to the nearest corner shop for step 1.
 * Save: nightshift-heatcheck-v1 { step, base, hot, done }. Pure step logic in NightshiftQuest.advance (Node-testable).
 * API: NightshiftQuest.{state, advance, STEPS} */
(function (root) {
  'use strict';
  const STEPS = [
    { id: 'rob', pay: 300, start: 'Yo, it\'s Rico. You want in? Prove it. Hit a corner store, any one. Gun out, register empty, walk out.', done: 'Clean. That\'s $300 for the nerve.' },
    { id: 'lose', pay: 400, start: 'Now the real test: get the cops on you and SHAKE them. Wanted level back to zero, then hit me.', done: 'Ghost. $400. You\'re learning.' },
    { id: 'wreck', pay: 800, start: 'Last one. Cruisers keep boxing my people in. Ram one till it\'s scrap. Three good hits does it.', done: 'HA! Saw it on the scanner. $800. You\'re crew now. More work soon.' },
    // chapter 2 (v0.78)
    { id: 'gunshop', pay: 1200, start: 'Crew job. The gun shop on the block keeps real money in that register. Hit it. Careful, the clerk keeps a shotgun under the counter.', done: 'Big balls. $1,200. Now they\'ll send the bird after us.' },
    { id: 'heli', pay: 1500, start: 'Get to five stars and put that police chopper in the dirt. Keep shooting till it smokes out.', done: 'The whole city heard that. $1,500. You run this block now.' },
  ];
  /** pure: given state + live counters { robberies, wrecks, heat }, return { state, paid, text } */
  function advance(s, c) {
    const st = { ...s }; if (st.done || st.step >= STEPS.length) return { state: { ...st, done: true }, paid: 0 };
    const step = STEPS[st.step]; let ok = false;
    if (step.id === 'rob') ok = c.robberies > (st.base ?? c.robberies);
    else if (step.id === 'lose') { if (c.heat >= 1) st.hot = true; ok = !!st.hot && c.heat <= 0.05; }
    else if (step.id === 'wreck') ok = c.wrecks > (st.base ?? c.wrecks);
    else if (step.id === 'gunshop') ok = c.gunshops > (st.base ?? c.gunshops);
    else if (step.id === 'heli') ok = c.helis > (st.base ?? c.helis);
    if (!ok) return { state: st, paid: 0 };
    const next = st.step + 1, ns = { step: next, done: next >= STEPS.length, hot: false, base: null };
    return { state: ns, paid: step.pay, text: step.done };
  }
  const api0 = { STEPS, advance };
  if (!root.document) { if (typeof module !== 'undefined') module.exports = api0; return; }

  const KEY = 'nightshift-heatcheck-v1';
  let state = { step: -1, base: null, hot: false, done: false };
  try { const r = JSON.parse(localStorage.getItem(KEY) || '{}'); if (Number.isFinite(r.step)) state = { step: r.step, base: Number.isFinite(r.base) ? r.base : null, hot: !!r.hot, done: !!r.done }; } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* n/a */ } };
  /* eslint-enable no-undef */
  const counters = () => { const ic = root.NightshiftInteriors2?.counts?.() || {}, pl = root.NightshiftPoliceCars?.lifetime?.() || {}; return { robberies: ic.robberies || 0, gunshops: ic['rob:GUN SHOP'] || 0, wrecks: pl.wrecks || 0, helis: pl.helis || 0, heat: P()?.heat || 0 }; };
  const text = (msg, gps) => { try { root.NightshiftPhone?.text?.('rico', msg, gps ? { gps } : {}); } catch { /* n/a */ } try { root.say?.('📱 Rico: ' + msg.slice(0, 70) + (msg.length > 70 ? '…' : '')); } catch { /* n/a */ } };
  function nearestShop(type) { const p = P(); if (!p) return null; const d = (root.NightshiftInteriors2?.doors?.() || []).filter((q) => q.type === type).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; return d ? { x: d.x, y: d.y, label: type === 'GUN SHOP' ? 'Gun shop' : 'Corner store' } : null; }
  function beginStep() {
    const c = counters(), s = STEPS[state.step]; if (!s) return;
    state.base = s.id === 'rob' ? c.robberies : s.id === 'wreck' ? c.wrecks : s.id === 'gunshop' ? c.gunshops : s.id === 'heli' ? c.helis : null; state.hot = false; persist();
    setTimeout(() => text(s.start, s.id === 'rob' ? nearestShop('CORNER SHOP') : s.id === 'gunshop' ? nearestShop('GUN SHOP') : null), 1200);
  }
  const born = Date.now();
  setInterval(() => {
    const p = P(); if (!p || state.done) return;
    if (state.step < 0) { if (Date.now() - born > 40000 && !root.NightshiftZones?.active?.()) { state.step = 0; beginStep(); } return; }
    if (state.base === null && STEPS[state.step]?.id !== 'lose') { beginStep(); return; }
    const r = advance(state, counters());
    if (r.paid) { p.cash += r.paid; text(r.text + (r.state.done ? '' : '')); try { root.NightshiftFeedback?.floating?.(p.x, p.y - 30, '+$' + r.paid, '#7cffb5'); } catch { /* n/a */ } state = r.state; persist(); gameSave(); if (!state.done) setTimeout(beginStep, STEPS[state.step]?.id === 'gunshop' ? 180000 : 2500); }
    else if (r.state.hot !== state.hot) { state = r.state; persist(); }
  }, 1000);
  root.NightshiftQuest = Object.freeze({ ...api0, get state() { return { ...state }; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
