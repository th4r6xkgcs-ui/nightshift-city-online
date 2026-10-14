/* Modular weapon kit runtime (Claude-owned, Option 3). Requires weapon-kit-data.js; weapon-art.js draws the parts.
 *  - config(id, mods): the saved look of a kit gun, synced to its fitted gameplay attachments — used everywhere the
 *    gun is drawn (in your hands, HUD/bag icons, the bench), so the same parts show in UI and gameplay;
 *  - panel(): a PARTS section on the Weapon Inspection bench — tap a part to preview, incompatible parts are greyed
 *    with the reason, 4 one-tap presets, APPLY saves the look for an owned gun (cosmetic, free).
 * Save: nightshift-weaponkit-v1. API: NightshiftWeaponKit.{config, panel, apply, state} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const K = root.NightshiftWeaponKitData; if (!K) return;
  const KEY = 'nightshift-weaponkit-v1';
  let state = K.fresh(); try { state = K.cleanState(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full */ } };
  const fitted = (id) => { try { return root.NightshiftWeapons?.state?.mods?.[id] || []; } catch { return []; } };
  function config(id, mods) { if (!K.KIT_GUNS[id]) return null; return K.sync(state.configs[id] || K.clean({}, id), mods || fitted(id)); }
  const PRESETS = [
    ['STREET', { barrel: 'std', muzzle: 'hider', optic: 'dot', underbarrel: 'post', magazine: 'std', stock: 'skel', laser: 'none' }],
    ['CQB', { barrel: 'short', muzzle: 'comp', optic: 'holo', underbarrel: 'ramp', magazine: 'clear', stock: 'folded', laser: 'none' }],
    ['MARKSMAN', { barrel: 'long', muzzle: 'comp', optic: 'irons', underbarrel: 'bipod', magazine: 'std', stock: 'full', laser: 'none' }],
    ['NIGHT OPS', { barrel: 'std', muzzle: 'can', optic: 'scope', underbarrel: 'post', magazine: 'ext', stock: 'full', laser: 'green' }],
  ];
  const ICON = { barrel: '📏', muzzle: '💥', optic: '🔭', underbarrel: '✊', magazine: '📦', stock: '🪵', laser: '🔴' };
  let msg = '';
  function apply(id, cfg, mods) { const v = K.validate(cfg, mods || fitted(id)); if (!v.ok) return v; state.configs[id] = K.clean(cfg, id); persist(); return { ok: true, errors: [] }; }
  /** Bench panel: side = container, st = { id, mods, parts, skin }, rerender(), el(tag, props, text) */
  function panel(side, st, rerender, el) {
    if (!K.KIT_GUNS[st.id]) return;
    if (!st.parts || st.partsFor !== st.id) { st.parts = config(st.id, st.mods); st.partsFor = st.id; }
    st.parts = K.sync(st.parts, st.mods); st.parts.skin = st.skin || 'stock';
    const owned = !!root.NightshiftWeapons?.state?.owned?.includes(st.id), saved = config(st.id, fitted(st.id)), dirty = K.keyOf({ ...saved, skin: st.parts.skin }) !== K.keyOf(st.parts);
    side.append(el('h4', {}, 'PARTS · OPTION 3 MODULAR KIT · cosmetic'));
    const pre = el('div', { className: 'bar', style: 'padding:0' });
    for (const [name, cfg] of PRESETS) { const c = { ...st.parts, ...cfg }, v = K.validate(c, st.mods), b = el('button', { className: 'chip' + (v.ok ? '' : ' no'), type: 'button', title: v.errors[0] || name }, name); b.onclick = () => { if (!v.ok) { msg = '⚠ ' + v.errors[0]; rerender(); return; } st.parts = c; msg = ''; rerender(); }; pre.append(b); }
    side.append(pre);
    const grid = el('div', { style: 'display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center' });
    for (const slot of K.SLOTS) {
      if (slot === 'skin') continue;
      const row = el('div', { className: 'bar', style: 'padding:0;gap:4px' });
      for (const [pid, name] of K.PARTS[slot]) {
        const c = { ...st.parts, [slot]: pid }, v = K.validate(c, st.mods), on = st.parts[slot] === pid;
        const b = el('button', { className: 'chip' + (on ? ' on' : '') + (v.ok ? '' : ' no'), type: 'button', title: v.ok ? name : v.errors[0], ariaLabel: `${slot}: ${name}${v.ok ? '' : ' (not compatible)'}` }, name.replace(/^(Street|Stub|Marksman|Flip-up|Pip|Halo|Longview|Post|Ramp|Tripod|Needle laser ·) /, '').slice(0, 14));
        b.style.fontSize = '10.5px'; b.style.padding = '6px 7px';
        b.onclick = () => { if (!v.ok) { msg = '⚠ ' + v.errors[0]; rerender(); return; } st.parts = c; msg = ''; rerender(); };
        row.append(b);
      }
      grid.append(el('span', { className: 'tg', title: slot }, `${ICON[slot]} ${slot.toUpperCase()}`), row);
    }
    side.append(grid);
    if (msg) side.append(el('div', { className: 'ds', style: 'color:#ff9a8a' }, msg));
    const v = K.validate(st.parts, fitted(st.id));
    if (owned) {
      const ap = el('button', { className: 'go', type: 'button' }, dirty ? (v.ok ? 'APPLY THIS LOOK' : 'NEEDS ATTACHMENTS FITTED') : 'LOOK ON THIS GUN ✓');
      if (dirty && v.ok) ap.onclick = () => { apply(st.id, st.parts); msg = '✅ Saved · you\'ll see it in your hands'; rerender(); };
      if (!v.ok && dirty) side.append(el('div', { className: 'ds' }, v.errors[0] + ' (preview shows it; fit the attachment at a workbench to keep it)'));
      side.append(ap);
    } else side.append(el('div', { className: 'ds' }, 'Preview only · own this gun to save a look'));
  }
  root.NightshiftWeaponKit = Object.freeze({ config, panel, apply, PRESETS, get state() { return state; } });
})(typeof window !== 'undefined' ? window : globalThis);
