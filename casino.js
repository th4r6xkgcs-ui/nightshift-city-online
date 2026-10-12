/* Lucky 7 Casino (Claude-owned world feature). Requires casino-data.js.
 * Turns the east-side CLUB into a casino without editing game files:
 *  - adds a USE point at its door via NightshiftEncounters.locations/use (wrapped);
 *  - draws a neon sign via NightshiftEncounters.draw (wrapped; world coordinates);
 *  - slots (Luck boosts slot wins, house edge always kept) and European roulette;
 *  - money moves atomically per spin; Luck XP per bet; security refuses entry while wanted.
 * Save: nightshift-casino-v1. API: NightshiftCasino.{state, open, close, door, paused}. */
(function (root) {
  'use strict';
  if (!root.document) return;
  const R = root.NightshiftCasinoRules;
  const KEY = 'nightshift-casino-v1';
  const STATS = ['wagered', 'won', 'spins', 'wins', 'biggest'];
  const clean = (raw) => Object.fromEntries(STATS.map((k) => [k, Number.isSafeInteger(raw?.[k]) && raw[k] > 0 ? Math.min(1e12, raw[k]) : 0]));
  let state = clean({});
  try { state = clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };

  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const B = () => { try { return buildings; } catch { return []; } };
  const G = () => { try { return g; } catch { return null; } };
  /* eslint-enable no-undef */
  const gameSave = () => { try { const f = (typeof save === 'function' ? save : null); if (f) f(); } catch { /* not ready */ } };
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const luckMod = () => { try { return root.NightshiftSkills?.mod('luck.casino') ?? 1; } catch { return 1; } };

  // The casino building: the CLUB nearest the east docks (falls back to a fixed spot).
  let building = null;
  function door() {
    if (!building) {
      const clubs = B().filter((b) => b && b.name === 'CLUB');
      building = clubs.sort((a, b) => Math.hypot(a.x - 1840, a.y - 1095) - Math.hypot(b.x - 1840, b.y - 1095))[0] || { x: 1840, y: 1095, w: 240, h: 170 };
    }
    return { x: building.x + building.w / 2, y: building.y + building.h + 12 };
  }
  const SITE = () => ({ id: 'casino', type: 'casino', ...door(), ready: true, color: '#ffd970', label: 'LUCKY 7 CASINO', action: 'CASINO', hint: 'Lucky 7 Casino · slots & roulette' });

  // ---- world hooks ----
  const E = root.NightshiftEncounters;
  if (E && !E.__casino) {
    const locs = E.locations, use = E.use, draw = E.draw;
    E.locations = function () { const list = locs.apply(this, arguments) || []; return P()?.hp > 0 ? [...list, SITE()] : list; };
    E.use = function (id) { if (id === 'casino') { open(); return true; } return use.apply(this, arguments); };
    E.draw = function () { const r = draw.apply(this, arguments); try { drawSign(); } catch { /* cosmetic */ } return r; };
    E.__casino = true;
  }
  // Codex's art already gives this club a CASINO facade, so we only add a small sidewalk
  // marquee beside the door plus a red carpet, and never draw over the building.
  function drawSign() {
    const ctx = G(), d = door();
    if (!ctx || !building) return;
    const t = performance.now() / 1000, x = d.x + 78, y = d.y - 6;
    ctx.save();
    ctx.fillStyle = '#9b1f3a'; ctx.fillRect(d.x - 14, d.y - 16, 28, 14);
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(x - 2, y + 9, 4, 12);
    root.NightshiftSign?.(ctx, x, y - 1, '🎰', 'LUCKY 7 CASINO', '#ff4fd8', { glow: 8 + 4 * Math.sin(t * 3) });
    for (let i = 0; i < 6; i++) { ctx.fillStyle = (Math.floor(t * 6) + i) % 3 === 0 ? '#fff3b0' : '#7a5a20'; ctx.fillRect(x - 30 + i * 12, y + 6, 3, 2); }
    ctx.restore();
  }

  // ---- panel ----
  const css = document.createElement('style');
  css.textContent = `
  #csPanel{position:fixed;inset:5% 5%;z-index:46;overflow:auto;background:radial-gradient(circle at 50% 0,#3a1236f5,#120a1cf7 70%);border:1px solid #ff4fd8;border-radius:14px;padding:12px 14px;color:#fbefff;font:13px ui-monospace,Menlo,monospace;box-shadow:0 0 30px #ff4fd855}
  #csPanel[hidden]{display:none} #csPanel h2{margin:0;font-size:16px;color:#ffd970;letter-spacing:.06em}
  #csPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:8px;font:700 12px ui-monospace,Menlo,monospace}
  #csPanel .top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
  #csPanel .x{background:#4a2152;border:1px solid #ff4fd8;padding:6px 10px}
  #csPanel .tabs{display:flex;gap:6px;margin:6px 0 10px} #csPanel .tab{flex:1;padding:8px;background:#2a1530;border:1px solid #6d3a78}
  #csPanel .tab.on{background:#ff4fd8;color:#1a0f22;border-color:#ffd970}
  #csPanel .bal{color:#7cdeb5;font-weight:700} #csPanel .sub{color:#c9a9d6;font-size:11px}
  #csPanel .bets{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0} #csPanel .bet{padding:6px 9px;background:#2a1530;border:1px solid #6d3a78;min-width:48px}
  #csPanel .bet.on{background:#ffd970;color:#1a0f22} #csPanel .bet[disabled]{opacity:.35;pointer-events:none}
  #csPanel .reels{display:flex;justify-content:center;gap:10px;margin:8px 0} #csPanel .reel{width:70px;height:70px;display:grid;place-items:center;font-size:40px;background:#fff8ec;border:3px solid #ffd970;border-radius:10px;box-shadow:inset 0 -8px 12px #0003}
  #csPanel .spin{display:block;width:100%;max-width:340px;margin:8px auto;padding:12px;background:linear-gradient(#ffe48a,#e3a52c);color:#2a1300;font-size:15px;border:1px solid #fff3b0}
  #csPanel .spin[disabled]{opacity:.5;pointer-events:none}
  #csPanel .res{text-align:center;min-height:20px;font-weight:700} #csPanel .win{color:#7cdeb5} #csPanel .lose{color:#ff91a0}
  #csPanel .pay{font-size:11px;color:#c9a9d6;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:2px 10px;margin-top:8px}
  #csPanel .wheel{margin:6px auto;width:86px;height:86px;border-radius:50%;display:grid;place-items:center;font:700 30px ui-monospace,Menlo,monospace;border:4px solid #ffd970;background:#173b28;color:#fff}
  #csPanel .wheel.red{background:#b3233b} #csPanel .wheel.black{background:#16161c}
  #csPanel .outs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:6px 0}
  #csPanel .ch{padding:8px 4px;background:#2a1530;border:1px solid #6d3a78} #csPanel .ch.on{outline:2px solid #ffd970;background:#4a2152}
  #csPanel .nums{display:grid;grid-template-columns:repeat(13,1fr);gap:3px} #csPanel .num{padding:5px 0;font-size:11px;border:1px solid #0006}
  #csPanel .num.red{background:#b3233b} #csPanel .num.black{background:#16161c} #csPanel .num.green{background:#1e6b3e} #csPanel .num.on{outline:2px solid #ffd970}
  #csPanel .bj{display:flex;flex-direction:column;gap:6px;align-items:center;margin:6px 0} #csPanel .hand{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
  #csPanel .card{min-width:44px;padding:10px 6px;text-align:center;background:#fff8ec;color:#16161c;border-radius:8px;font:700 18px ui-monospace,Menlo,monospace;border:2px solid #ffd970} #csPanel .card.red{color:#b3233b} #csPanel .card.back{background:#4a2152;color:#ffd970}
  #csPanel .bjrow{display:flex;gap:8px;justify-content:center;flex-wrap:wrap} #csPanel .bjrow .spin{margin:6px 0;max-width:200px;flex:1}
  #csPanel .hist{display:flex;gap:4px;justify-content:center;margin-top:6px;flex-wrap:wrap} #csPanel .hist span{padding:2px 6px;border-radius:5px;font-size:11px}
  @media (max-height:430px){#csPanel{inset:3% 3%}#csPanel .reel{width:56px;height:56px;font-size:32px}#csPanel .wheel{width:64px;height:64px;font-size:22px}}`;
  document.head.appendChild(css);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const panel = el('div', { id: 'csPanel', hidden: true, role: 'dialog', ariaLabel: 'Lucky 7 Casino' });
  document.body.append(panel);

  const ui = { game: 'slots', bet: 50, choice: 'red', spinning: false, msg: '', msgClass: '', reels: ['🍒', '🍋', '7️⃣'], wheel: null, history: [] };
  const BETS = [10, 50, 100, 250, 500, 1000];
  const money = (n) => '$' + Math.round(n).toLocaleString();

  function canPlay() {
    const p = P();
    if (!p || p.hp <= 0) return 'You need to be alive to play';
    if (p.car) return 'Park and walk in';
    if (Number.isFinite(p.heat) && p.heat >= 1) return 'Security: "Not while the cops are on you."';
    return '';
  }
  // Atomic money move: take the bet and pay the win in one step.
  function settle(bet, payout) {
    const p = P();
    p.cash = Math.max(0, Math.min(100000000, p.cash - bet + payout));
    state.wagered += bet; state.spins += 1;
    if (payout > bet) { state.wins += 1; state.won += payout - bet; state.biggest = Math.max(state.biggest, payout - bet); }
    persist(); gameSave();
    try { root.NightshiftSkills?.gain('luck', Math.max(1, Math.min(40, Math.round(bet / 25))), 'casino'); } catch { /* skills optional */ }
  }

  function spin() {
    if (ui.game === 'blackjack') { if (ui.bj && !ui.bj.done) bjHit(); else bjDeal(); return; }
    const p = P(), why = canPlay();
    if (ui.spinning) return;
    if (why) { ui.msg = why; ui.msgClass = 'lose'; return render(); }
    if (!p || p.cash < ui.bet) { ui.msg = 'Not enough cash for that bet'; ui.msgClass = 'lose'; return render(); }
    const res = ui.game === 'slots' ? R.spinSlots(ui.bet, luckMod()) : R.spinRoulette(ui.bet, ui.choice);
    if (!res) return;
    settle(ui.bet, res.payout);
    ui.spinning = true; ui.msg = ''; render();
    const sym = R.SYMBOLS.map((s) => s.icon), start = performance.now(), dur = ui.game === 'slots' ? 900 : 1100;
    const tick = setInterval(() => {
      const t = performance.now() - start;
      if (ui.game === 'slots') ui.reels = ui.reels.map((v, i) => (t > dur * (0.5 + i * 0.25) ? res.reels[i] : sym[Math.floor(Math.random() * sym.length)]));
      else ui.wheel = { n: Math.floor(Math.random() * 37), color: 'spin' };
      if (t >= dur) {
        clearInterval(tick); ui.spinning = false;
        if (ui.game === 'slots') ui.reels = res.reels; else { ui.wheel = { n: res.n, color: res.color }; ui.history = [{ n: res.n, color: res.color }, ...ui.history].slice(0, 10); }
        const net = res.payout - ui.bet;
        ui.msg = net > 0 ? `WIN ${money(res.payout)}  (+${money(net)})` : net === 0 ? 'Push · bet returned' : `Lost ${money(ui.bet)}`;
        ui.msgClass = net > 0 ? 'win' : 'lose';
        if (res.mult >= 15) { say(`🎰 JACKPOT ${money(res.payout)}!`); try { root.NightshiftAudio?.play('pickup'); } catch { /* sound optional */ } }
      }
      render();
    }, 70);
  }

  function render() {
    if (panel.hidden) return;
    const p = P(), cash = p?.cash ?? 0, scroll = panel.scrollTop;
    panel.textContent = '';
    const top = el('div', { className: 'top' });
    const x = el('button', { className: 'x', type: 'button' }, 'LEAVE'); x.onclick = close;
    top.append(el('h2', {}, '🎰 LUCKY 7 CASINO'), x);
    const tabs = el('div', { className: 'tabs' });
    for (const [id, name] of [['slots', '🎰 SLOTS'], ['roulette', '🎡 ROULETTE'], ['blackjack', '🃏 BLACKJACK']]) {
      const b = el('button', { className: 'tab' + (ui.game === id ? ' on' : ''), type: 'button' }, name);
      b.onclick = () => { if (!ui.spinning && !(ui.bj && !ui.bj.done)) { ui.game = id; ui.msg = ''; render(); } };
      tabs.append(b);
    }
    const info = el('div', { className: 'sub' });
    info.append(el('span', { className: 'bal' }, `Cash ${money(cash)}`), document.createTextNode(`  ·  Luck Lv ${root.NightshiftSkills?.level('luck') ?? 1}  ·  lifetime: ${state.spins} bets, best win ${money(state.biggest)}`));
    const bets = el('div', { className: 'bets' });
    for (const v of BETS) {
      const b = el('button', { className: 'bet' + (ui.bet === v ? ' on' : ''), type: 'button', disabled: v > cash }, money(v));
      b.onclick = () => { ui.bet = v; render(); };
      bets.append(b);
    }
    panel.append(top, tabs, info, bets);
    if (ui.game === 'slots') {
      const reels = el('div', { className: 'reels' });
      for (const r of ui.reels) reels.append(el('div', { className: 'reel' }, r));
      panel.append(reels);
    } else if (ui.game === 'blackjack') {
      renderBlackjack(cash);
      panel.scrollTop = scroll;
      return;
    } else {
      const w = ui.wheel;
      panel.append(el('div', { className: 'wheel ' + (w && w.color !== 'spin' ? w.color : '') }, w ? String(w.n) : '–'));
      const outs = el('div', { className: 'outs' });
      for (const [c, name] of [['red', 'RED'], ['black', 'BLACK'], ['odd', 'ODD'], ['even', 'EVEN'], ['low', '1–18'], ['high', '19–36']]) {
        const b = el('button', { className: 'ch' + (ui.choice === c ? ' on' : ''), type: 'button' }, name + ' · 2×');
        b.onclick = () => { if (!ui.spinning) { ui.choice = c; render(); } };
        outs.append(b);
      }
      const nums = el('div', { className: 'nums' });
      for (let n = 0; n <= 36; n++) {
        const b = el('button', { className: `num ${R.colorOf(n)}${ui.choice === n ? ' on' : ''}`, type: 'button' }, String(n));
        b.onclick = () => { if (!ui.spinning) { ui.choice = n; render(); } };
        nums.append(b);
      }
      panel.append(outs, el('div', { className: 'sub' }, 'Or pick a single number · pays 36×'), nums);
    }
    const spinBtn = el('button', { className: 'spin', type: 'button', disabled: ui.spinning || cash < ui.bet },
      ui.spinning ? 'SPINNING…' : `SPIN · ${money(ui.bet)}${ui.game === 'roulette' ? ' on ' + String(ui.choice).toUpperCase() : ''}`);
    spinBtn.onclick = spin;
    panel.append(spinBtn, el('div', { className: 'res ' + ui.msgClass }, ui.msg));
    if (ui.game === 'roulette' && ui.history.length) {
      const h = el('div', { className: 'hist' });
      for (const r of ui.history) { const s = el('span', {}, String(r.n)); s.style.background = r.color === 'red' ? '#b3233b' : r.color === 'black' ? '#16161c' : '#1e6b3e'; h.append(s); }
      panel.append(h);
    }
    if (ui.game === 'slots') {
      const pay = el('div', { className: 'pay' });
      for (const s of [...R.SYMBOLS].reverse()) pay.append(el('span', {}, `${s.icon}${s.icon}${s.icon}  ${s.three}×`));
      pay.append(el('span', {}, `🍒🍒 (any two)  ${R.TWO_CHERRIES}×`));
      const lm = luckMod();
      panel.append(pay, el('div', { className: 'sub' }, lm > 1 ? `🍀 Luck bonus: slot wins +${Math.round((lm - 1) * 100)}%` : '🍀 Level up Luck to boost slot wins'));
    }
    panel.scrollTop = scroll;
  }

  // ---- blackjack: stake is settled once, when the hand ends (closing mid-hand stands) ----
  const SUITS = ['♠', '♥', '♦', '♣'];
  const cardEl = (c, i, hidden) => { const red = (c + i) % 2 === 1; return el('span', { className: 'card' + (hidden ? ' back' : red ? ' red' : '') }, hidden ? '🂠' : R.cardLabel(c) + SUITS[(c + i) % 4]); };
  function bjDeal() {
    const why = canPlay(), p = P();
    if (why) { ui.msg = why; ui.msgClass = 'lose'; return render(); }
    if (!p || p.cash < ui.bet) { ui.msg = 'Not enough cash for that bet'; ui.msgClass = 'lose'; return render(); }
    ui.bj = { ...R.dealHand(), bet: ui.bet, doubled: false, done: false }; ui.msg = ''; ui.msgClass = '';
    if (R.isBlackjack(ui.bj.player) || R.isBlackjack(ui.bj.dealer)) return bjFinish();
    render();
  }
  function bjHit() { const h = ui.bj; if (!h || h.done) return; h.player.push(R.draw()); if (R.handValue(h.player).total >= 21) return bjFinish(); render(); }
  function bjDouble() { const h = ui.bj, p = P(); if (!h || h.done || h.player.length !== 2 || !p || p.cash < h.bet * 2) return; h.doubled = true; h.player.push(R.draw()); bjFinish(); }
  function bjFinish() {
    const h = ui.bj; if (!h || h.done) return;
    if (R.handValue(h.player).total <= 21) R.dealerPlay(h.dealer);
    const stake = h.bet * (h.doubled ? 2 : 1), mult = R.bjResult(h.player, h.dealer), pay = Math.round(stake * mult);
    settle(stake, pay); h.done = true;
    const pt = R.handValue(h.player).total, dt = R.handValue(h.dealer).total;
    ui.msg = mult === 2.5 ? `BLACKJACK! +${money(pay - stake)}` : mult === 2 ? `You win ${money(pay - stake)} (${pt} vs ${dt > 21 ? 'bust' : dt})` : mult === 1 ? 'Push · stake returned' : pt > 21 ? `Bust · lost ${money(stake)}` : `Dealer wins (${dt} vs ${pt}) · lost ${money(stake)}`;
    ui.msgClass = mult > 1 ? 'win' : mult === 1 ? '' : 'lose';
    render();
  }
  function renderBlackjack(cash) {
    const h = ui.bj, live = h && !h.done;
    const table = el('div', { className: 'bj' });
    if (h) {
      const dv = live ? null : R.handValue(h.dealer).total;
      const dRow = el('div', { className: 'hand' }); h.dealer.forEach((c, i) => dRow.append(cardEl(c, i, live && i === 1)));
      const pRow = el('div', { className: 'hand' }); h.player.forEach((c, i) => pRow.append(cardEl(c, i + 2, false)));
      table.append(el('div', { className: 'sub' }, `Dealer ${dv === null ? Math.min(10, h.dealer[0]) === 1 ? 'shows A' : 'shows ' + R.handValue([h.dealer[0]]).total : dv}`), dRow,
        el('div', { className: 'sub' }, `You ${R.handValue(h.player).total}${h.doubled ? ' · doubled' : ''}`), pRow);
    } else table.append(el('div', { className: 'sub' }, 'Dealer stands on 17 · Blackjack pays 3:2 · Double on your first two cards'));
    panel.append(table);
    const row = el('div', { className: 'bjrow' });
    if (live) {
      const hit = el('button', { className: 'spin', type: 'button' }, 'HIT'); hit.onclick = bjHit;
      const stand = el('button', { className: 'spin', type: 'button' }, 'STAND'); stand.onclick = bjFinish;
      const dbl = el('button', { className: 'spin', type: 'button', disabled: h.player.length !== 2 || cash < h.bet * 2 }, `DOUBLE · ${money(h.bet * 2)}`); dbl.onclick = bjDouble;
      row.append(hit, stand, dbl);
    } else { const deal = el('button', { className: 'spin', type: 'button', disabled: cash < ui.bet }, `DEAL · ${money(ui.bet)}`); deal.onclick = bjDeal; row.append(deal); }
    panel.append(row, el('div', { className: 'res ' + ui.msgClass }, ui.msg));
  }

  function open() {
    const why = canPlay();
    if (why) { say(why); return false; }
    try { root.releaseControls?.(); } catch { /* n/a */ }
    panel.hidden = false; ui.msg = ''; render();
    return true;
  }
  function close() { if (ui.bj && !ui.bj.done) bjFinish(); panel.hidden = true; }
  // While open, the casino owns the keyboard (game keys don't move the player); Escape leaves.
  addEventListener('keydown', (e) => {
    if (panel.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === ' ' || e.key === 'Enter') { if (!(e.target instanceof HTMLButtonElement)) { e.preventDefault(); spin(); } }
    e.stopImmediatePropagation();
  }, true);
  setInterval(() => { if (!panel.hidden && !ui.spinning) { const why = canPlay(); if (why && P()?.hp <= 0) close(); } }, 500);

  root.NightshiftCasino = Object.freeze({ open, close, door, paused: () => !panel.hidden, get state() { return state; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
