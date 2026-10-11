/* Bank heists in game (Claude-owned). Requires heists-data.js. HEIST USE point beside each BANK (Codex buildings),
 * via NightshiftEncounters like the casino. Needs a gun in hand (carried pistol item). Starting the job sets heat to 3
 * and keeps reporting the robbery (NightshiftCrime.report) so police respond; a HUD bar shows drill/escape progress.
 * Save: nightshift-heists-v1. API: NightshiftHeists.{state, active, open, close, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const H = root.NightshiftHeistsData;
  const KEY = 'nightshift-heists-v1';
  let state = H.clean({});
  try { state = H.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const G = () => { try { return g; } catch { return null; } };
  const B = () => { try { return buildings; } catch { return []; } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const mod = (k) => { try { return root.NightshiftSkills?.mod(k) ?? 1; } catch { return 1; } };
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  let doors = null;
  function vaults() {
    if (!doors) doors = H.BANKS.map((bk) => {
      const b = B().filter((x) => x?.name === 'BANK').sort((p, q) => dist(p, bk.near) - dist(q, bk.near))[0] || { ...bk.near, w: 240, h: 170 };
      return { ...bk, x: b.x + b.w / 2 + bk.dx, y: b.y + b.h + 12 };
    });
    return doors;
  }
  const SITES = () => vaults().map((v) => ({ id: 'heist-' + v.id, type: 'heist', x: v.x, y: v.y, ready: true, color: '#ffcf4a', label: '🏦 ' + v.name.toUpperCase(), action: 'HEIST', hint: `${v.name} · rob the vault` }));
  const E = root.NightshiftEncounters;
  if (E && !E.__heists) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 && !run ? [...list, ...SITES()] : list; };
    E.use = function (id) { if (typeof id === 'string' && id.startsWith('heist-')) { open(id.slice(6)); return true; } return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawWorld(); } catch { /* cosmetic */ } return r; };
    E.__heists = true;
  }

  let run = null; // { bank, stage, drill, progress, away, last, pay, lastReport }
  const now = () => performance.now() / 1000;
  function start(bankId) {
    const p = P(), bank = vaults().find((v) => v.id === bankId);
    if (!p || !bank || run) return;
    if (!H.ready(state, bankId)) { say('The vault was just hit. Security is too tight right now.'); return; }
    if (!(root.NightshiftInventory?.state?.pocket?.pistol > 0)) { say('You need a gun in hand for a bank job'); return; }
    run = { bank, stage: 'drill', drill: H.drillTime(mod('stealth.heat') < 1 ? 1 / mod('stealth.heat') : 1), progress: 0, away: 0, last: now(), pay: 0, lastReport: 0 };
    p.heat = Math.max(p.heat || 0, 3); report(true);
    close(); say(`🏦 HEIST STARTED · hold the vault for ${run.drill}s. Cops are on the way!`);
    try { root.NightshiftAudio?.play('fire'); } catch { /* sound */ }
  }
  function report(force) {
    const t = now();
    if (!run || (!force && t - run.lastReport < 6)) return;
    run.lastReport = t;
    try { root.NightshiftCrime?.report?.({ x: run.bank.x, y: run.bank.y }, performance.now(), 'robbery'); } catch { /* optional */ }
  }
  function tick() {
    if (!run) { hud.hidden = true; return; }
    const p = P(); if (!p) return;
    const res = H.step(run, { now: now(), dist: dist(p, run.bank), heat: p.heat || 0, hp: p.hp, homeDist: dist(p, H.HOME) });
    if (run.stage === 'drill') { report(false); p.heat = Math.max(p.heat || 0, 2.5); }
    if (res === 'escape') {
      run.pay = H.payout(run.bank, root.NightshiftRespect?.state?.reached || 0, mod('luck.rare'));
      say(`💰 Vault cracked! ${money(run.pay)} in the bag · lose the cops or stash it at your apartment`);
      try { root.NightshiftAudio?.play('pickup'); } catch { /* sound */ }
    } else if (res === 'paid') {
      p.cash = Math.min(100000000, p.cash + run.pay);
      for (const [sk, xp] of [['shooting', 200], ['stealth', 250], ['toughness', 120]]) try { root.NightshiftSkills?.gain(sk, xp, 'heist'); } catch { /* optional */ }
      state.done++; state.total += run.pay; state.best = Math.max(state.best, run.pay); state.cooldown[run.bank.id] = Date.now() + H.COOLDOWN_MS;
      persist(); gameSave(); say(`🏦 HEIST COMPLETE · +${money(run.pay)} clean`); run = null;
    } else if (res.startsWith('fail:')) {
      state.failed++; state.cooldown[run.bank.id] = Date.now() + H.COOLDOWN_MS / 2; persist();
      say(`🏦 Heist failed · ${res.slice(5)}`); run = null;
    }
    renderHud();
  }
  setInterval(tick, 200);

  // ---- world + HUD ----
  function drawWorld() {
    const ctx = G(), p = P(), t = performance.now() / 1000;
    if (!ctx || !p) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const v of vaults()) {
      if (dist(p, v) > 650) continue;
      const active = run && run.bank.id === v.id, cd = !H.ready(state, v.id);
      ctx.fillStyle = '#1d1608e8'; ctx.fillRect(v.x - 34, v.y - 46, 68, 20);
      ctx.strokeStyle = active ? (Math.sin(t * 10) > 0 ? '#ff5161' : '#5161ff') : cd ? '#6b5a2a' : '#ffcf4a'; ctx.lineWidth = 2; ctx.strokeRect(v.x - 34, v.y - 46, 68, 20);
      ctx.fillStyle = cd && !active ? '#9a8a5a' : '#ffe9a8'; ctx.font = 'bold 10px monospace'; ctx.fillText(active ? '🚨 VAULT' : '🏦 VAULT', v.x, v.y - 36);
      if (active && run.stage === 'drill') { ctx.strokeStyle = '#ffcf4a55'; ctx.setLineDash?.([6, 6]); ctx.beginPath(); ctx.arc(v.x, v.y, H.REACH, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash?.([]); }
    }
    if (run && run.stage === 'escape') { // arrow to the apartment stash
      const a = Math.atan2(H.HOME.y - p.y, H.HOME.x - p.x), r = p.car ? 80 : 58;
      ctx.translate(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); ctx.rotate(a);
      ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  const css = document.createElement('style');
  css.textContent = `
  #hsHud{position:fixed;z-index:24;pointer-events:none;background:#1d1608e6;border:1px solid #ffcf4a;border-radius:10px;color:#fff3cc;font:700 12px ui-monospace,Menlo,monospace;padding:6px 12px}
  #hsHud[hidden]{display:none} #hsHud i{display:block;height:4px;margin-top:4px;background:linear-gradient(90deg,#ffcf4a,#ff5161);border-radius:2px}
  #hsPanel{position:fixed;inset:12% 10%;z-index:46;overflow:auto;background:linear-gradient(180deg,#221a08f7,#120d04f7);border:1px solid #ffcf4a;border-radius:14px;padding:14px 16px;color:#fff3cc;font:13px ui-monospace,Menlo,monospace}
  #hsPanel[hidden]{display:none} #hsPanel h2{margin:0 0 6px;font-size:16px;color:#ffcf4a} #hsPanel p{margin:6px 0;color:#e8d9a8;font-size:12px}
  #hsPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 13px ui-monospace,Menlo,monospace;padding:10px 14px}
  #hsPanel .go{background:linear-gradient(#ffe48a,#e3a52c);color:#2a1300} #hsPanel .go[disabled]{opacity:.4;pointer-events:none} #hsPanel .x{background:#3a2c10;border:1px solid #ffcf4a;margin-left:8px}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const hud = el('div', { id: 'hsHud', hidden: true }), panel = el('div', { id: 'hsPanel', hidden: true, role: 'dialog', ariaLabel: 'Bank heist' });
  document.body.append(hud, panel);
  function place() {
    if (innerWidth > innerHeight) Object.assign(hud.style, { top: 'auto', bottom: 'calc(52px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 2 * min(34vw, 300px))' });
    else { const a = document.querySelector('#dyChip') || document.querySelector('#glCard'), r = a?.getBoundingClientRect(); Object.assign(hud.style, { top: Math.round((r?.bottom || 200) + 62) + 'px', bottom: 'auto', left: '12px', transform: 'none', maxWidth: 'calc(100vw - 24px)' }); }
  }
  function renderHud() {
    if (!run) { hud.hidden = true; return; }
    hud.hidden = false; place(); hud.textContent = '';
    const p = P(), frac = run.stage === 'drill' ? run.progress / run.drill : 1;
    hud.append(document.createTextNode(run.stage === 'drill'
      ? `🏦 DRILLING ${Math.floor(run.progress)}/${run.drill}s${run.away > 0 ? ' · GET BACK TO THE VAULT!' : ' · hold position'}`
      : `💰 ${money(run.pay)} in the bag · lose the cops (heat ${(p?.heat || 0).toFixed(1)}) or reach your apartment`));
    const bar = el('i'); bar.style.width = Math.round(Math.min(1, frac) * 100) + '%'; hud.append(bar);
  }
  let pending = null;
  function open(bankId) {
    const p = P(), v = vaults().find((x) => x.id === bankId);
    if (!p || !v || run) return false;
    if (p.car) { say('Park and walk in'); return false; }
    pending = bankId; panel.textContent = '';
    const cd = state.cooldown[bankId] ? Math.max(0, Math.ceil((state.cooldown[bankId] - Date.now()) / 60000)) : 0;
    panel.append(el('h2', {}, `🏦 ${v.name.toUpperCase()}`),
      el('p', {}, `Take ~${money(v.base)} from the vault (more with Respect and Luck).`),
      el('p', {}, `1) Hold position at the vault for ~${H.drillTime()}s while police swarm in. Stealth shortens it.`),
      el('p', {}, '2) Escape with the bag: lose ALL heat, or stash it at your apartment. Die and the bag is gone.'),
      el('p', {}, `Heists done: ${state.done} · best ${money(state.best)}${cd ? ` · vault resets in ${cd} min` : ''}`));
    const row = el('div', { style: 'margin-top:10px' });
    const go = el('button', { className: 'go', type: 'button', disabled: !!cd }, cd ? 'VAULT LOCKED' : 'START THE HEIST');
    go.onclick = () => start(pending);
    const x = el('button', { className: 'x', type: 'button' }, 'WALK AWAY'); x.onclick = close;
    row.append(go, x); panel.append(row);
    try { root.releaseControls?.(); } catch { /* n/a */ }
    panel.hidden = false; return true;
  }
  function close() { panel.hidden = true; }
  addEventListener('keydown', (e) => { if (panel.hidden) return; if (e.key === 'Escape') close(); e.stopImmediatePropagation(); }, true);

  root.NightshiftHeists = Object.freeze({ open, close, paused: () => !panel.hidden, get state() { return state; }, active: () => (run ? { bank: run.bank.id, stage: run.stage, progress: run.progress, drill: run.drill, pay: run.pay } : null), vaults: () => vaults() });
})(typeof globalThis !== 'undefined' ? globalThis : this);
