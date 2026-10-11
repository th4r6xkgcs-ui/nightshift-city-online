/* RPG skills engine (Claude-owned). Requires skills-data.js loaded first.
 * Pure core (Node-testable) + browser layer that:
 *  - awards XP by OBSERVING public game state (no game files edited): rounds
 *    fired, distance run/driven, health lost, police escapes, deliveries,
 *    salvage, farm batches and product sold;
 *  - exposes NightshiftSkills.{gain, level, mod, open, onLevelUp, state};
 *  - shows level-up toasts and a skills panel.
 * Codex applies effects by multiplying its values by NightshiftSkills.mod(key)
 * (defaults to 1 when absent). Contract: GAME_VISION.md. Save: nightshift-skills-v1. */
(function (root) {
  'use strict';
  const D = (typeof module === 'object' && module.exports) ? require('./skills-data.js') : root.NightshiftSkillsData;
  const { SKILLS, MAX_LEVEL, xpToNext, TITLES } = D;
  const BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
  const KEY = 'nightshift-skills-v1';

  // Total XP needed to reach `level` from level 1.
  const totalFor = (level) => { let t = 0; for (let l = 1; l < level; l++) t += xpToNext(l); return t; };
  const MAX_XP = totalFor(MAX_LEVEL);

  function levelInfo(xp) {
    let level = 1, left = Math.max(0, Math.floor(xp));
    while (level < MAX_LEVEL && left >= xpToNext(level)) { left -= xpToNext(level); level++; }
    return { level, into: left, need: level >= MAX_LEVEL ? 0 : xpToNext(level) };
  }
  const title = (level) => TITLES.filter(([l]) => level >= l).pop()[1];

  function clean(raw) {
    const s = { version: 1, xp: {}, seen: {} };
    for (const sk of SKILLS) {
      const v = raw?.xp?.[sk.id];
      s.xp[sk.id] = Number.isFinite(v) && v > 0 ? Math.min(MAX_XP, Math.floor(v)) : 0;
    }
    if (raw?.seen && typeof raw.seen === 'object') {
      for (const [k, v] of Object.entries(raw.seen)) if (/^[a-z]{1,20}$/.test(k) && Number.isSafeInteger(v) && v >= 0) s.seen[k] = v;
    }
    return s;
  }

  // Adds XP; returns { level, from, leveled }.
  function gain(state, skill, amount) {
    if (!BY_ID[skill] || !Number.isFinite(amount) || amount <= 0) return { level: 0, from: 0, leveled: false };
    const from = levelInfo(state.xp[skill]).level;
    state.xp[skill] = Math.min(MAX_XP, state.xp[skill] + Math.min(amount, 5000));
    const level = levelInfo(state.xp[skill]).level;
    return { level, from, leveled: level > from };
  }

  // Multiplier for a gameplay value (1 = no change).
  function mod(state, key) {
    let m = 1;
    for (const sk of SKILLS) {
      for (const pk of sk.perks) {
        if (pk.key !== key) continue;
        const lv = levelInfo(state.xp[sk.id]).level;
        let v = 1 + pk.per * (lv - 1);
        if (pk.max !== undefined) v = Math.min(pk.max, v);
        if (pk.min !== undefined) v = Math.max(pk.min, v);
        m *= v;
      }
    }
    return m;
  }

  const core = { KEY, clean, gain, mod, levelInfo, totalFor, title, MAX_XP };
  if (typeof module === 'object' && module.exports) { module.exports = core; return; }
  if (!root.document) { root.NightshiftSkills = core; return; }

  // ---------------- browser layer ----------------
  let state = clean();
  try { state = clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  let dirty = false;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); dirty = false; } catch { /* private mode */ } };
  setInterval(() => { if (dirty) save(); }, 3000);
  addEventListener('pagehide', () => { if (dirty) save(); });

  const listeners = [];
  // The game's say() is a top-level function declaration, so it lives on window.
  const toast = (t) => { try { if (typeof root.say === 'function') root.say(t); } catch { /* no toast */ } };

  // Temporary XP boost (e.g. "Well rested" from home-upgrades.js). Not saved: it is a session buff.
  let boost = { mult: 1, until: 0, label: '' };
  const boostMult = () => (performance.now() < boost.until ? boost.mult : 1);
  function setBoost(mult, ms, label = 'Boost') {
    if (!Number.isFinite(mult) || mult < 1 || mult > 3 || !Number.isFinite(ms) || ms <= 0) return false;
    boost = { mult, until: performance.now() + Math.min(ms, 3600000), label };
    renderChip(); return true;
  }
  function award(skill, amount, reason) {
    const r = gain(state, skill, Number.isFinite(amount) ? amount * boostMult() : amount);
    if (!r.level) return r;
    dirty = true;
    if (r.leveled) {
      const sk = BY_ID[skill];
      const perk = sk.perks[0], m = mod(state, perk.key), pct = Math.round((m - 1) * 100);
      toast(`${sk.icon} ${sk.name.toUpperCase()} LEVEL ${r.level} · ${perk.label} ${perk.show ? perk.show(m) : `${pct >= 0 ? '+' : ''}${pct}%`}`);
      flash(sk, r.level);
      for (const fn of listeners) { try { fn({ skill, level: r.level, reason }); } catch { /* listener error */ } }
      save();
    }
    renderPanel();
    return r;
  }

  // ---- observing the game (reads script-level globals of game.js) ----
  const G = {
    get player() { try { return player; } catch { return null; } }, // eslint-disable-line no-undef
  };
  let last = null, lastHp = null, wanted = false, carry = { run: 0, drive: 0, dmg: 0 };
  function readCounters() {
    const c = {};
    try {
      const prog = JSON.parse(localStorage.getItem('nightshift-city-progress-v1') || '{}');
      c.delivery = Number.isSafeInteger(prog.delivery) ? prog.delivery : 0;
      c.salvage = Number.isSafeInteger(prog.salvage) ? prog.salvage : 0;
    } catch { /* no progress yet */ }
    const ledger = root.NightshiftBusinesses?.state?.ledger;
    if (ledger) { c.batches = ledger.batches | 0; c.sold = ledger.sold | 0; }
    return c;
  }
  function checkCounters() {
    const c = readCounters(), X = D.XP;
    for (const [k, v] of Object.entries(c)) {
      if (state.seen[k] === undefined) { state.seen[k] = v; dirty = true; continue; } // no retroactive XP
      const delta = v - state.seen[k];
      if (delta < 0) { state.seen[k] = v; dirty = true; continue; } // reset/restore
      if (!delta) continue;
      state.seen[k] = v; dirty = true;
      const n = Math.min(delta, 50);
      if (k === 'delivery') for (const [sk, xp] of Object.entries(X.delivery)) award(sk, xp * n, 'delivery');
      if (k === 'salvage') for (const [sk, xp] of Object.entries(X.salvage)) award(sk, xp * n, 'salvage');
      if (k === 'batches') for (const [sk, xp] of Object.entries(X.batch)) award(sk, xp * n, 'batch');
      if (k === 'sold') for (const [sk, xp] of Object.entries(X.soldUnit)) award(sk, xp * n, 'sale');
    }
  }
  function observe() {
    const p = G.player;
    if (!p) return;
    const X = D.XP;
    // Shots: each round leaving the magazine.
    if (last && Number.isFinite(p.ammo) && Number.isFinite(last.ammo) && p.ammo < last.ammo && !p.car && p.hp > 0) {
      award('shooting', X.shot * Math.min(3, last.ammo - p.ammo), 'shot');
    }
    // Distance: on foot -> Speed, in a car -> Driving (teleports ignored).
    if (last && p.hp > 0) {
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d > 0 && d < 200) {
        if (p.car) { carry.drive += d; if (carry.drive >= 100) { award('driving', X.drive100px * Math.floor(carry.drive / 100), 'drive'); carry.drive %= 100; } }
        else { carry.run += d; if (carry.run >= 100) { award('athletics', X.run100px * Math.floor(carry.run / 100), 'run'); carry.run %= 100; } }
      }
    }
    // Health lost and survived -> Toughness.
    if (lastHp !== null && Number.isFinite(p.hp) && p.hp < lastHp && p.hp > 0) {
      carry.dmg += lastHp - p.hp;
      if (carry.dmg >= 1) { award('toughness', X.damage1hp * carry.dmg, 'hurt'); carry.dmg = 0; }
    }
    lastHp = Number.isFinite(p.hp) ? p.hp : lastHp;
    // Police escape -> Stealth.
    if (Number.isFinite(p.heat)) {
      if (p.heat >= 1) wanted = true;
      else if (wanted && p.heat <= 0 && p.hp > 0) { wanted = false; for (const [sk, xp] of Object.entries(X.escape)) award(sk, xp, 'escape'); }
      if (p.hp <= 0) wanted = false;
    }
    last = { x: p.x, y: p.y, ammo: p.ammo };
  }
  setInterval(observe, 100);
  setInterval(checkCounters, 2000);

  // ---- UI: level-up flash, skills chip, panel ----
  const css = document.createElement('style');
  css.textContent = `
  #skFlash{position:fixed;left:50%;top:84%;transform:translate(-50%,-50%) scale(.9);z-index:45;pointer-events:none;opacity:0;transition:opacity .25s,transform .25s;
    background:linear-gradient(180deg,#1d2c48f2,#0f1830f2);border:1px solid #e8c873;border-radius:14px;padding:12px 18px;text-align:center;color:#f6f1e1;font:600 14px ui-monospace,Menlo,monospace;box-shadow:0 10px 30px #0008}
  #skFlash.on{opacity:1;transform:translate(-50%,-50%) scale(1)} #skFlash b{display:block;font-size:22px;color:#ffd970;margin-bottom:2px}
  #skChip{all:unset;box-sizing:border-box;position:fixed;z-index:25;left:12px;top:90px;width:auto;height:auto;min-width:0;min-height:0;cursor:pointer;
    background:#101728d9;border:1px solid #5e7793;border-radius:999px;color:#e8eff7;font:600 12px/1.2 ui-monospace,Menlo,monospace;padding:5px 10px;white-space:nowrap;box-shadow:none}
  #skPanel .close{all:unset;box-sizing:border-box;cursor:pointer}
  #skPanel{position:fixed;inset:6% 6%;z-index:46;overflow:auto;background:#0f1830f5;border:1px solid #6f8db3;border-radius:14px;padding:14px 16px;color:#e8eff7;font:13px ui-monospace,Menlo,monospace}
  #skPanel[hidden]{display:none} #skPanel h2{margin:0 0 4px;font-size:16px} #skPanel .sub{color:#9fb3c8;margin:0 0 10px;font-size:12px}
  #skPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
  #skPanel .sk{background:#16233d;border:1px solid #2f4669;border-radius:10px;padding:9px 10px}
  #skPanel .top{display:flex;justify-content:space-between;align-items:baseline;gap:6px} #skPanel .nm{font-weight:700}
  #skPanel .lv{color:#ffd970} #skPanel .bar{height:6px;background:#0a1222;border-radius:4px;margin:6px 0;overflow:hidden}
  #skPanel .bar i{display:block;height:100%;background:linear-gradient(90deg,#4cc3ff,#7cdeb5)} #skPanel .perk,#skPanel .earn{font-size:11px;color:#b9c8da}
  #skPanel .earn{color:#8aa0b8;margin-top:3px} #skPanel .close{position:sticky;top:0;float:right;font:700 13px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:8px;padding:6px 12px}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const flashEl = el('div', { id: 'skFlash' });
  const chip = el('button', { id: 'skChip', type: 'button', ariaLabel: 'Skills' });
  const panel = el('div', { id: 'skPanel', hidden: true, role: 'dialog' });
  document.body.append(flashEl, chip, panel);
  let flashTimer = 0;
  function flash(sk, level) {
    flashEl.textContent = '';
    flashEl.append(el('b', {}, `${sk.icon} LEVEL ${level}`), el('span', {}, `${sk.name} · ${title(level)}`));
    flashEl.classList.add('on');
    clearTimeout(flashTimer); flashTimer = setTimeout(() => flashEl.classList.remove('on'), 1800);
  }
  const totalLevel = () => SKILLS.reduce((t, s) => t + levelInfo(state.xp[s.id]).level, 0);
  function renderChip() {
    const left = boost.until - performance.now();
    chip.textContent = `⭐ SKILLS · ${totalLevel()}` + (left > 0 ? ` · 🔥+${Math.round((boost.mult - 1) * 100)}% ${Math.ceil(left / 60000)}m` : '');
  }
  setInterval(renderChip, 5000);
  // Sits under the HUD, or under Codex's police status line (#crimeStatus) while it is showing, so it never covers it.
  function placeChip() {
    const hud = document.querySelector('#hud');
    if (!hud) return;
    const r = hud.getBoundingClientRect();
    if (!r.height) return;
    let bottom = r.bottom;
    const cs = document.querySelector('#crimeStatus');
    if (cs && cs.textContent.trim()) { const c = cs.getBoundingClientRect(); if (c.height && c.left < r.right && c.top < r.bottom + 60) bottom = Math.max(bottom, c.bottom); }
    chip.style.top = Math.round(bottom + 6) + 'px'; chip.style.left = Math.round(r.left) + 'px';
  }
  function renderPanel() {
    renderChip();
    if (panel.hidden) return;
    panel.textContent = '';
    const close = el('button', { className: 'close', type: 'button' }, 'CLOSE');
    close.onclick = () => { panel.hidden = true; };
    panel.append(close, el('h2', {}, `SKILLS · total level ${totalLevel()}`),
      el('p', { className: 'sub' }, 'Skills level up as you play. Each level makes you better at it.'));
    const grid = el('div', { className: 'grid' });
    for (const sk of SKILLS) {
      const info = levelInfo(state.xp[sk.id]);
      const card = el('div', { className: 'sk' });
      const top = el('div', { className: 'top' });
      top.append(el('span', { className: 'nm' }, `${sk.icon} ${sk.name}`), el('span', { className: 'lv' }, `Lv ${info.level} · ${title(info.level)}`));
      const bar = el('div', { className: 'bar' });
      const fill = el('i'); fill.style.width = info.need ? Math.round((info.into / info.need) * 100) + '%' : '100%';
      bar.append(fill);
      card.append(top, bar, el('div', { className: 'perk' }, sk.desc));
      for (const pk of sk.perks) {
        const m = mod(state, pk.key), pct = Math.round((m - 1) * 100);
        card.append(el('div', { className: 'perk' }, `• ${pk.label}: ${pk.show ? pk.show(m) : `${pct >= 0 ? '+' : ''}${pct}%`}`));
      }
      card.append(el('div', { className: 'earn' }, `Earn XP: ${sk.earn}` + (info.need ? ` · ${info.into}/${info.need}` : ' · MAX')));
      grid.append(card);
    }
    panel.append(grid);
  }
  function open() { panel.hidden = false; renderPanel(); }
  chip.onclick = () => { panel.hidden ? open() : (panel.hidden = true); };
  addEventListener('keydown', (e) => { if (e.key === 'k' && !(e.target instanceof HTMLInputElement)) { panel.hidden ? open() : (panel.hidden = true); } });
  setInterval(placeChip, 400); placeChip(); renderChip();

  root.NightshiftSkills = Object.freeze({
    ...core,
    gain: (skill, xp, reason) => award(skill, xp, reason),
    level: (skill) => levelInfo(state.xp[skill] || 0).level,
    mod: (key) => mod(state, key),
    open,
    onLevelUp: (fn) => { if (typeof fn === 'function') listeners.push(fn); },
    setBoost,
    boost: () => ({ mult: boostMult(), left: Math.max(0, boost.until - performance.now()), label: boost.label }),
    get state() { return state; },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
