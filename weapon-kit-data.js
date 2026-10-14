/* Modular weapon parts (Claude-owned, Option 3). Pure + Node-testable; weapon-art.js draws every part, weapon-kit.js
 * runs the bench UI. Cosmetic game parts with fictional names — they change how the gun LOOKS. Parts that would imply
 * a gameplay effect (suppressor can, extended/drum mags, magnified scope) are only allowed when the matching gameplay
 * attachment (weapons-data MODS) is fitted, so the picture never lies about the stats.
 * Slots: barrel, muzzle, optic, underbarrel, magazine, stock, laser, skin. Compatibility is data (RULES).
 * Save: nightshift-weaponkit-v1 { v, configs: { weaponId: config } } */
(function (root) {
  'use strict';
  const SLOTS = ['barrel', 'muzzle', 'optic', 'underbarrel', 'magazine', 'stock', 'laser', 'skin'];
  const PARTS = {
    barrel: [['std', 'Street 14" barrel'], ['short', 'Stub 10" barrel'], ['long', 'Marksman 18" barrel']],
    muzzle: [['none', 'Bare crown'], ['hider', 'Crown flash hider'], ['comp', 'Kite compensator'], ['can', 'Hush can']],
    optic: [['irons', 'Flip-up irons'], ['dot', 'Pip red dot'], ['holo', 'Halo sight'], ['scope', 'Longview 4x']],
    underbarrel: [['none', 'Bare rail'], ['post', 'Post grip'], ['ramp', 'Ramp grip'], ['bipod', 'Tripod legs']],
    magazine: [['std', '30 box'], ['clear', '30 clear box'], ['ext', '45 stick'], ['drum', '60 drum']],
    stock: [['skel', 'Skeleton stock'], ['full', 'Sport stock'], ['folded', 'Folded stock'], ['brace', 'Wire brace']],
    laser: [['none', 'No laser'], ['red', 'Needle laser · red'], ['green', 'Needle laser · green']],
  };
  const NAME = Object.fromEntries(Object.entries(PARTS).map(([s, l]) => [s, Object.fromEntries(l)]));
  // which guns take the modular kit (rifle-pattern receivers)
  const KIT_GUNS = { carbine: { base: { barrel: 'std', muzzle: 'hider', optic: 'irons', underbarrel: 'none', magazine: 'std', stock: 'skel', laser: 'none', skin: 'stock' } }, ar: { base: { barrel: 'std', muzzle: 'hider', optic: 'irons', underbarrel: 'none', magazine: 'std', stock: 'skel', laser: 'none', skin: 'stock' } } };
  // compatibility: when all `when` slots match, either a gameplay mod is required, other slots must match `need`, or it's denied
  const RULES = [
    { when: { muzzle: ['can'] }, mod: 'suppressor', msg: 'The Hush can needs the Suppressor attachment fitted' },
    { when: { magazine: ['ext', 'drum'] }, mod: 'extmag', msg: 'Bigger mags need the Extended mag attachment fitted' },
    { when: { optic: ['scope'] }, mod: 'scope', msg: 'The Longview 4x needs the Scope attachment fitted' },
    { when: { laser: ['red', 'green'] }, mod: 'grip', msg: 'Lasers need the Laser grip attachment fitted' },
    { when: { underbarrel: ['bipod'] }, need: { barrel: ['long'] }, msg: 'Tripod legs only fit the Marksman 18" barrel' },
    { when: { muzzle: ['can'], barrel: ['short'] }, deny: true, msg: 'The Hush can won\'t clear the Stub barrel\'s gas block' },
    { when: { magazine: ['drum'], underbarrel: ['bipod'] }, deny: true, msg: 'A drum fouls the tripod legs' },
    { when: { optic: ['scope'], stock: ['folded'] }, deny: true, msg: 'A folded stock blocks the Longview\'s eyepiece' },
  ];
  // gameplay mods that imply a part: fitting the mod snaps the look to that part (and removing it reverts)
  const MOD_PART = { suppressor: ['muzzle', 'can', 'hider'], scope: ['optic', 'scope', 'irons'], extmag: ['magazine', 'ext', 'std'] };
  const has = (slot, id) => slot === 'skin' ? typeof id === 'string' && /^[a-z]{2,12}$/.test(id) : !!NAME[slot]?.[id];
  function clean(cfg, gun) { const b = KIT_GUNS[gun]?.base; if (!b) return null; const o = { ...b }; for (const s of SLOTS) if (cfg && has(s, cfg[s])) o[s] = cfg[s]; return o; }
  function validate(cfg, mods = []) {
    const errs = [];
    for (const r of RULES) {
      const hit = Object.entries(r.when).every(([s, ids]) => ids.includes(cfg[s])); if (!hit) continue;
      if (r.deny) errs.push(r.msg); else if (r.mod && !mods.includes(r.mod)) errs.push(r.msg); else if (r.need && !Object.entries(r.need).every(([s, ids]) => ids.includes(cfg[s]))) errs.push(r.msg);
    }
    // a fitted gameplay attachment must be visible: its part is required while it's fitted
    const MODN = { suppressor: 'Suppressor', scope: 'Scope', extmag: 'Extended mag' };
    for (const [mod, [slot, part]] of Object.entries(MOD_PART)) { if (!mods.includes(mod)) continue; const okIds = slot === 'magazine' ? ['ext', 'drum'] : [part]; if (!okIds.includes(cfg[slot])) errs.push(`${MODN[mod]} is fitted, so the ${slot} shows as the ${okIds.map((i) => NAME[slot][i]).join(' or ')}`); }
    return { ok: !errs.length, errors: errs };
  }
  /** Bring a config in line with the fitted gameplay mods (fit → show the part; removed → fall back). */
  function sync(cfg, mods = []) {
    const o = { ...cfg };
    for (const [mod, [slot, part, fallback]] of Object.entries(MOD_PART)) {
      const on = mods.includes(mod), big = slot === 'magazine';
      if (on) { if (big ? !['ext', 'drum'].includes(o.magazine) : o[slot] !== part) o[slot] = part; }
      else if (big ? ['ext', 'drum'].includes(o.magazine) : o[slot] === part) o[slot] = fallback;
    }
    if (!mods.includes('grip')) o.laser = 'none';
    // anything still invalid falls back slot by slot to the base
    for (let k = 0; k < 4 && !validate(o, mods).ok; k++) for (const r of RULES) { const hit = Object.entries(r.when).every(([s, ids]) => ids.includes(o[s])); if (!hit) continue; const s = Object.keys(r.when).pop(); o[s] = PARTS[s][0][0]; }
    return o;
  }
  const keyOf = (cfg) => (cfg ? SLOTS.map((s) => cfg[s]).join('.') : '');
  const fresh = () => ({ v: 1, configs: {} });
  function cleanState(raw) { const s = fresh(); for (const [g, c] of Object.entries(raw?.configs || {})) { const cc = clean(c, g); if (cc) s.configs[g] = cc; } return s; }
  const api = { SLOTS, PARTS, NAME, KIT_GUNS, RULES, MOD_PART, clean, validate, sync, keyOf, fresh, cleanState };
  root.NightshiftWeaponKitData = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
