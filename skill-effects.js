/* Skill effects (Claude-owned). Makes skill levels change real gameplay by
 * wrapping public module functions. No game file is edited.
 * Load after skills.js (and after every module it wraps). Each wrap is installed once,
 * retried until its target exists, and is a no-op multiplier of 1 at level 1.
 *
 * Shooting  damage   bullet hits on civilians (Crews.incident 'violence') and police (Crime.strike)
 *           reload   Combat.begin reload deadline
 * Speed     speed    Movement.step on-foot speed;  stamina: sprint drain refund
 * Driving   topSpeed/handling   Vehicles.handling for the player's car;  crashDamage: Vehicles.damage
 * Luck      chance/value of a cash find on each salvage (Progress.award 'salvage')
 * Farming   growTime on batch start, yield bonus on completion (BusinessRules.transact/advance)
 * Dealing   price bonus on sales and rush orders; heat per sale (BusinessRules.transact)
 * Toughness damage taken (Recovery.damage); regen out of combat (observer)
 * Stealth   heat gained, heat cooldown speed (observer on player.heat)
 * Charisma  business buy prices (BusinessRules.transact); delivery pay (Progress.award 'delivery')
 * API: NightshiftSkillEffects.{installed, rollLuck, yieldBonus} */
(function (root) {
  'use strict';
  // Pure helpers (Node-testable).
  const luckChance = (rareMod) => Math.max(0, Math.min(0.5, (rareMod - 1) * 0.5));
  function rollLuck(rareMod, valueMod, rnd = Math.random) {
    if (rnd() >= luckChance(rareMod)) return 0;
    return Math.round((30 + rnd() * 70) * valueMod);
  }
  // Extra units for a finished batch, with random rounding so small bonuses still pay out on average.
  const yieldBonus = (batch, yieldMod, rnd = Math.random) => Math.max(0, Math.floor(batch * (yieldMod - 1) + rnd()));
  const pure = { luckChance, rollLuck, yieldBonus };
  if (typeof module === 'object' && module.exports) { module.exports = pure; return; }
  if (!root.document) { root.NightshiftSkillEffects = pure; return; }

  const m = (k) => { try { const v = root.NightshiftSkills?.mod(k); return Number.isFinite(v) && v > 0 ? v : 1; } catch { return 1; } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const float = (text, color = '#ffd970') => { const p = P(); try { if (p) root.NightshiftFeedback?.floating(p.x, p.y - 44, text, color); } catch { /* cosmetic */ } };
  const installed = new Set();
  const hitXp = () => { try { root.NightshiftSkills?.gain('shooting', root.NightshiftSkillsData?.XP?.hit ?? 5, 'hit'); } catch { /* optional */ } };
  function wrap(name, obj, fn, make) {
    if (installed.has(name) || !obj || typeof obj[fn] !== 'function') return;
    const orig = obj[fn];
    obj[fn] = make(orig);
    installed.add(name);
  }

  let lastCash = null, lastHeat = null, lastHp = null, lastHurt = 0, regenCarry = 0;

  function install() {
    const C = root.NightshiftCombat, M = root.NightshiftMovement, V = root.NightshiftVehicles, REC = root.NightshiftRecovery;
    const CR = root.NightshiftCrews, CRIME = root.NightshiftCrime, PR = root.NightshiftProgress, R = root.NightshiftBusinessRules;

    wrap('reload', C, 'begin', (o) => function (state, ammo, now) {
      const ok = o.apply(this, arguments);
      if (ok && state && state.until > now) state.until = now + (state.until - now) * m('shooting.reload');
      return ok;
    });

    wrap('run', M, 'step', (o) => function (state, input) {
      const before = state?.stamina;
      const speed = o.apply(this, arguments);
      if (Number.isFinite(before) && state.stamina < before) {
        const drop = before - state.stamina;
        state.stamina = Math.min(100, state.stamina + drop * (1 - 1 / m('athletics.stamina')));
      }
      return input?.driving ? speed : speed * m('athletics.speed');
    });

    wrap('drive', V, 'handling', (o) => function (car) {
      const p = P();
      if (!p || !car || p.car !== car) return o.apply(this, arguments);
      const top = m('driving.topSpeed'), hand = m('driving.handling'), a0 = car.angle;
      car.speed /= top;
      const r = o.apply(this, arguments);
      car.speed *= top;
      car.angle = a0 + (car.angle - a0) * hand;
      return r;
    });
    wrap('crash', V, 'damage', (o) => function (car) {
      const p = P(), c0 = car?.condition;
      const r = o.apply(this, arguments);
      if (p && car && p.car === car && Number.isFinite(c0) && car.condition < c0) car.condition = c0 - (c0 - car.condition) * m('driving.crashDamage');
      return r;
    });

    wrap('hurt', REC, 'damage', (o) => function (amount, now) {
      return o.call(this, Number.isFinite(amount) ? amount * m('toughness.damageTaken') : amount, now);
    });

    // Bullet hits: the game subtracts 20 right after these calls, so extra damage here still lets it kill.
    wrap('hitPed', CR, 'incident', (o) => function (target, kind) {
      if (kind === 'violence' && target && Number.isFinite(target.hp)) { target.hp -= 20 * (m('shooting.damage') - 1); hitXp(); }
      return o.apply(this, arguments);
    });
    wrap('hitCop', CRIME, 'strike', (o) => function (officer) {
      if (officer && Number.isFinite(officer.hp) && CRIME.officers?.includes?.(officer)) { officer.hp -= 20 * (m('shooting.damage') - 1); hitXp(); }
      return o.apply(this, arguments);
    });

    wrap('award', PR, 'award', (o) => function (kind) {
      const p = P();
      if (p && kind === 'delivery' && lastCash !== null) {
        const pay = Math.max(0, Math.min(5000, p.cash - lastCash));
        const bonus = Math.round(pay * (m('charisma.jobPay') - 1));
        if (bonus > 0) { p.cash += bonus; setTimeout(() => float(`🤝 +$${bonus} charisma`, '#7cdeb5'), 300); }
      }
      if (p && kind === 'salvage') {
        const bonus = rollLuck(m('luck.rare'), m('luck.salvage'));
        if (bonus > 0) { p.cash += bonus; setTimeout(() => { float(`🍀 LUCKY FIND +$${bonus}`); }, 300); }
      }
      return o.apply(this, arguments);
    });

    wrap('trade', R, 'transact', (o) => function (state, wallet, pocket, cmd, now, dry) {
      if (dry || !cmd || !wallet) return o.apply(this, arguments);
      const cash0 = wallet.cash, heat0 = Number.isFinite(wallet.heat) ? wallet.heat : 0;
      const r = o.apply(this, arguments);
      if (!r?.ok) return r;
      const t = Number.isSafeInteger(now) ? now : Date.now(), a = cmd.action, notes = [];
      if (a === 'sell' || a === 'complete-order') {
        const bonus = Math.round((wallet.cash - cash0) * (m('dealing.price') - 1));
        if (bonus > 0 && wallet.cash + bonus <= R.CASH_LIMIT) {
          wallet.cash += bonus;
          if (state?.ledger) state.ledger.earned = Math.min(R.CASH_LIMIT, state.ledger.earned + bonus);
          notes.push(`dealing +$${bonus}`);
        }
      }
      if (['buy', 'purchase', 'upgrade', 'start'].includes(a)) {
        const refund = Math.floor((cash0 - wallet.cash) * (1 - m('charisma.shopPrice')));
        if (refund > 0) { wallet.cash += refund; notes.push(`charisma saved $${refund}`); }
      }
      if (a === 'start') {
        const p = state?.properties?.[cmd.id];
        if (p && p.until > t) p.until = t + Math.round((p.until - t) * m('farming.growTime'));
      }
      const dh = (Number.isFinite(wallet.heat) ? wallet.heat : 0) - heat0;
      if (dh > 0) { wallet.heat = heat0 + dh * m('dealing.heat') * m('stealth.heat'); if (wallet === P()) lastHeat = wallet.heat; }
      if (notes.length && typeof r.message === 'string') r.message += ' · ' + notes.join(' · ');
      return r;
    });
    wrap('harvest', R, 'advance', (o) => function (state) {
      const before = {};
      for (const [id, p] of Object.entries(state?.properties || {})) before[id] = p?.batch || 0;
      const done = o.apply(this, arguments);
      for (const id of done || []) {
        const p = state.properties?.[id], spec = R.property(id);
        if (!p || !spec || !before[id]) continue;
        const extra = Math.min(yieldBonus(before[id], m('farming.yield')), Math.max(0, R.capacity(spec, p) - p.stock));
        if (extra > 0) { p.stock += extra; setTimeout(() => float(`🌿 +${extra} ${spec.item} farming bonus`, '#7fda9b'), 600); }
      }
      return done;
    });
  }

  // Observer: heat gain/cooldown, regen, cash baseline for delivery pay.
  function observe() {
    const p = P();
    if (!p) return;
    const now = performance.now();
    if (Number.isFinite(p.heat)) {
      if (lastHeat !== null && p.hp > 0) {
        if (p.heat > lastHeat + 1e-9) p.heat = Math.min(5, lastHeat + (p.heat - lastHeat) * m('stealth.heat'));
        else if (p.heat < lastHeat) p.heat = Math.max(0, p.heat - (lastHeat - p.heat) * (m('stealth.cooldown') - 1));
      }
      lastHeat = p.heat;
    }
    if (Number.isFinite(p.hp)) {
      if (lastHp !== null && p.hp < lastHp) lastHurt = now;
      if (p.hp > 0 && p.hp < 100 && now - lastHurt > 8000) {
        regenCarry += (m('toughness.regen') - 1) * 1.5 * 0.1;
        if (regenCarry >= 1) { const n = Math.floor(regenCarry); regenCarry -= n; p.hp = Math.min(100, p.hp + n); }
      } else regenCarry = 0;
      lastHp = p.hp;
    }
    if (Number.isFinite(p.cash)) lastCash = p.cash;
  }

  install();
  const retry = setInterval(() => { install(); if (installed.size >= 10) clearInterval(retry); }, 1000);
  setInterval(observe, 100);
  root.NightshiftSkillEffects = Object.freeze({ ...pure, get installed() { return [...installed]; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
