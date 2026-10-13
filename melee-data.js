/* Melee & close combat rules (Claude-owned, v0.64). Pure and Node-testable; melee.js runs it in game.
 * Rules only (no DOM), so a future server can run the same hit tests:
 *  - WEAPONS: fists are always owned; others are bought (Dex's gun shop texts), dropped by gang members or earned
 *    in the story. Each has damage, reach, swing arc, cooldown, combo length (last hit = finisher), knockback, stun.
 *  - hit(attacker, target, weapon): inside reach and inside the swing arc in front of the attacker.
 *  - takedown(attacker, target): from behind an unaware target -> instant knockout.
 *  - ROLL: dodge roll distance, duration, invulnerable window and cooldown.
 *  - power(level): Toughness (gym) adds melee damage.
 * Save: nightshift-melee-v1 { owned, equipped, takedowns, kos } */
(function (root) {
  'use strict';
  const WEAPONS = {
    fists: { id: 'fists', name: 'Fists', icon: '👊', dmg: [9, 12], reach: 30, arc: 1.5, cool: 320, combo: 3, finisher: 1.8, knock: 10, stun: 260, price: 0, desc: 'Three-hit combo. The third one drops people.' },
    brass: { id: 'brass', name: 'Brass knuckles', icon: '🥊', dmg: [14, 18], reach: 30, arc: 1.4, cool: 300, combo: 3, finisher: 1.8, knock: 14, stun: 340, price: 90, desc: 'Fists, but they leave a mark.' },
    bat: { id: 'bat', name: 'Baseball bat', icon: '🏏', dmg: [19, 25], reach: 42, arc: 1.8, cool: 560, combo: 2, finisher: 1.6, knock: 24, stun: 560, price: 140, desc: 'Wide swing, big knockback. Hits a crowd.' },
    knife: { id: 'knife', name: 'Folding knife', icon: '🔪', dmg: [22, 28], reach: 28, arc: 1.0, cool: 350, combo: 3, finisher: 1.5, knock: 5, stun: 180, price: 180, quiet: true, desc: 'Fast and quiet. Takedowns don\'t draw a crowd.' },
    wrench: { id: 'wrench', name: 'Pipe wrench', icon: '🔧', dmg: [21, 27], reach: 36, arc: 1.5, cool: 620, combo: 2, finisher: 1.7, knock: 18, stun: 650, price: 160, desc: 'Slow, heavy, rings their bell. Longest stun.' },
    machete: { id: 'machete', name: 'Machete', icon: '🗡️', dmg: [31, 38], reach: 40, arc: 1.6, cool: 640, combo: 2, finisher: 1.5, knock: 14, stun: 420, price: 650, desc: 'Top-tier blade. Two hits handles most people.' },
  };
  const ORDER = ['fists', 'brass', 'knife', 'bat', 'wrench', 'machete'];
  const ROLL = { dist: 86, ms: 330, iframes: 300, cool: 1000 };
  const COMBO_WINDOW = 900; // ms after a swing for the next one to continue the combo
  const ang = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const W = (id) => WEAPONS[id] || WEAPONS.fists;

  const power = (level = 0) => 1 + 0.06 * Math.max(0, Math.min(20, level));
  // next swing in a combo: returns { step, finisher, mult } (step 0-based)
  function swing(c, id, now) {
    const w = W(id), cont = c.last && now - c.last < COMBO_WINDOW + w.cool && c.weapon === w.id;
    c.step = cont ? (c.step + 1) % w.combo : 0; c.last = now; c.weapon = w.id;
    const finisher = c.step === w.combo - 1;
    return { step: c.step, finisher, mult: finisher ? w.finisher : 1 };
  }
  const ready = (c, id, now) => !c.last || now - c.last >= W(id).cool;
  function hit(a, t, id, radius = 12) {
    const w = W(id), dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy);
    if (d > w.reach + radius) return false;
    if (d < 10) return true; // point blank always connects
    return Math.abs(ang(Math.atan2(dy, dx) - a.angle)) <= w.arc / 2;
  }
  // takedown: the target faces away from you (its facing points away from the attacker) and isn't fighting
  function takedown(a, t, id) {
    if (!t || t.mode === 'fight' || t.hostile || t.alert || (t.hp ?? 1) <= 0) return false;
    const w = W(id), d = Math.hypot(t.x - a.x, t.y - a.y); if (d > w.reach + 10) return false;
    const toA = Math.atan2(a.y - t.y, a.x - t.x), facing = Number.isFinite(t.angle) ? t.angle : Math.PI / 2;
    return Math.abs(ang(toA - facing)) > 1.9; // ~110° behind
  }
  function damage(id, step, level, rnd = Math.random) {
    const w = W(id), base = w.dmg[0] + (w.dmg[1] - w.dmg[0]) * rnd(), fin = step === w.combo - 1 ? w.finisher : 1;
    return Math.round(base * fin * power(level));
  }
  function clean(raw) {
    const s = { version: 1, owned: ['fists'], equipped: 'fists', takedowns: 0, kos: 0 };
    if (Array.isArray(raw?.owned)) for (const id of raw.owned) if (WEAPONS[id] && !s.owned.includes(id)) s.owned.push(id);
    if (WEAPONS[raw?.equipped] && s.owned.includes(raw.equipped)) s.equipped = raw.equipped;
    for (const k of ['takedowns', 'kos']) if (Number.isSafeInteger(raw?.[k]) && raw[k] > 0) s[k] = Math.min(1e9, raw[k]);
    s.owned.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    return s;
  }
  function give(s, id) { if (!WEAPONS[id] || s.owned.includes(id)) return false; s.owned.push(id); s.owned.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)); return true; }
  function buy(s, id, wallet) {
    const w = WEAPONS[id]; if (!w || !w.price) return { ok: false, reason: 'Not for sale' };
    if (s.owned.includes(id)) return { ok: false, reason: 'Already have it' };
    if (!wallet || wallet.cash < w.price) return { ok: false, reason: `Need $${w.price}` };
    wallet.cash -= w.price; give(s, id); s.equipped = id; return { ok: true, weapon: w };
  }
  function cycle(s) { const i = s.owned.indexOf(s.equipped); s.equipped = s.owned[(i + 1) % s.owned.length]; return W(s.equipped); }
  // what a downed gang member might drop (seeded by a 0..1 roll)
  function drop(roll) { return roll < 0.06 ? 'knife' : roll < 0.13 ? 'bat' : roll < 0.17 ? 'brass' : roll < 0.2 ? 'wrench' : null; }
  // roll: position along the dash for t in [0,1] (ease-out)
  const rollAt = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 2.2);

  const api = Object.freeze({ WEAPONS, ORDER, ROLL, COMBO_WINDOW, W, power, swing, ready, hit, takedown, damage, clean, give, buy, cycle, drop, rollAt });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftMeleeData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
