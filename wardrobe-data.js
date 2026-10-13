/* Wardrobe (Claude-owned): the clothing catalog, outfits, ownership and saved looks for the premium layered characters.
 * Pure and Node-testable. character-art.js draws every item; studio.js is the inspection/customization screen.
 * Layers (draw order, back to front): body → base → top → bottom → shoes → outer → gloves → jewelry → bag → face → hair → head.
 * An outfit references items by id plus a colour from the item's palette and per-item options (hood up, jacket open,
 * shirt tucked, cap backwards). Items are owned once and recoloured for free; starter items are free.
 * Save: nightshift-wardrobe-v1 { version, outfit, owned[], saved[{ name, outfit }], seen } */
(function (root) {
  'use strict';
  const SKINS = ['#f6d3b3', '#eabf98', '#d7a477', '#bf8556', '#9c6a43', '#7a4e30', '#5a3824', '#41281a'];
  const HAIR_COLORS = ['#141216', '#2e2119', '#4f3424', '#7a5232', '#b07e44', '#d8b878', '#e8e2d8', '#8a2e24', '#3a3a8a', '#d85aa0'];
  const BUILDS = [{ id: 'slim', name: 'Slim', w: 0.9 }, { id: 'regular', name: 'Regular', w: 1 }, { id: 'broad', name: 'Broad', w: 1.14 }];
  const HAIRSTYLES = [
    ['bald', 'Clean shave'], ['buzz', 'Buzz cut'], ['fade', 'Skin fade'], ['short', 'Short crop'], ['curly', 'Curly top'], ['afro', 'Afro'],
    ['locs', 'Locs'], ['braids', 'Box braids'], ['bun', 'Top bun'], ['ponytail', 'Ponytail'], ['long', 'Long'], ['mohawk', 'Mohawk'],
  ];
  const FACIAL = [['none', 'Clean'], ['stubble', 'Stubble'], ['mustache', 'Mustache'], ['goatee', 'Goatee'], ['beard', 'Full beard']];
  const C = {
    neutral: ['#f1efe8', '#2b2f36', '#7d8796', '#1d2433', '#c9c2b2'],
    street: ['#c84659', '#3d7fc6', '#e2b75c', '#2f8f6a', '#6d73be', '#e07a3a', '#a34a8a', '#f1efe8', '#1d2024'],
    denim: ['#3a5a8a', '#2a3f62', '#7a9ac0', '#1d2433', '#5a6a7a'],
    earth: ['#6a5a3a', '#4a5232', '#8a7050', '#2b2f33', '#b8a07a'],
    leather: ['#2a1f1a', '#5a3524', '#7a2e24', '#1d2024'],
    loud: ['#ff4ad8', '#3ad0ff', '#c9e86a', '#ffb33a', '#f1efe8', '#1d2024'],
    metal: ['#e3c25a', '#c9d1d6'],
  };
  // [id, cat, name, rarity, price, palette, desc, opts]
  const RAW = [
    // headwear
    ['cap', 'head', 'Snapback cap', 'common', 60, C.street, 'Flat brim, stitched panels. Wear it forward or backwards.', { back: true }],
    ['beanie', 'head', 'Rib beanie', 'common', 40, C.street, 'Folded cuff, chunky rib knit.'],
    ['bucket', 'head', 'Bucket hat', 'uncommon', 90, C.earth.concat(C.loud.slice(0, 2)), 'Soft brim, all-round shade.'],
    ['durag', 'head', 'Silk durag', 'uncommon', 70, C.loud.concat(['#1d2024', '#7a2e24']), 'Satin sheen with tails.'],
    ['fedora', 'head', 'Fedora', 'rare', 240, C.neutral, 'Pinched crown, grosgrain band. Old-money energy.'],
    // face
    ['shades', 'face', 'Wraparound shades', 'common', 50, ['#1d2024', '#7a2e24', '#e3c25a'], 'Dark lenses, mirrored at the edge.'],
    ['aviators', 'face', 'Gold aviators', 'uncommon', 160, ['#e3c25a', '#c9d1d6'], 'Teardrop lenses on a thin gold frame.'],
    ['glasses', 'face', 'Thick frames', 'common', 70, ['#1d2024', '#5a3524', '#c84659'], 'Bold acetate frames.'],
    ['skimask', 'face', 'Ski mask', 'uncommon', 80, ['#1d2024', '#c84659', '#2f8f6a', '#f1efe8'], 'Knit balaclava. Nobody needs to know.'],
    ['bandana', 'face', 'Bandana mask', 'common', 45, ['#c84659', '#1d2024', '#3d7fc6'], 'Paisley cotton tied over the nose.'],
    // tops (under layer)
    ['tee', 'top', 'Crew tee', 'common', 30, C.street, 'Heavyweight cotton, dropped shoulder.', { tuck: true }],
    ['tank', 'top', 'Ribbed tank', 'common', 25, ['#f1efe8', '#1d2024', '#7d8796'], 'Shows off the arms.'],
    ['longsleeve', 'top', 'Long sleeve', 'common', 45, C.street, 'Thermal knit, cuffed sleeves.', { tuck: true, roll: true }],
    ['polo', 'top', 'Piqué polo', 'uncommon', 70, C.street, 'Two-button placket, ribbed collar.', { tuck: true }],
    ['jersey', 'top', 'Basketball jersey', 'rare', 160, ['#c84659', '#3d7fc6', '#e2b75c', '#2f8f6a', '#6d73be'], 'Mesh jersey with a big number on the chest.'],
    ['buttonup', 'top', 'Button-up shirt', 'uncommon', 90, C.neutral.concat(['#9fc3d6', '#e8d8b0']), 'Crisp collar and a placket of buttons.', { tuck: true, roll: true }],
    // outerwear
    ['hoodie', 'outer', 'Pullover hoodie', 'common', 90, C.street.concat(['#7d8796']), 'Kangaroo pocket and drawstrings. Hood up or down.', { hood: true }],
    ['leather', 'outer', 'Leather jacket', 'rare', 420, C.leather, 'Asymmetric zip, silver hardware, worn creases.', { open: true }],
    ['puffer', 'outer', 'Puffer jacket', 'uncommon', 260, ['#1d2024', '#c84659', '#e07a3a', '#3d7fc6', '#f1efe8', '#2f8f6a'], 'Baffled down quilting, high collar.', { open: true }],
    ['varsity', 'outer', 'Varsity jacket', 'rare', 360, ['#7a2e24', '#1d2433', '#2f6b3f', '#3a2a5a'], 'Wool body, contrast sleeves, chenille letter.', { open: true }],
    ['denim', 'outer', 'Denim jacket', 'uncommon', 180, C.denim, 'Washed denim with chest pockets and copper buttons.', { open: true }],
    ['track', 'outer', 'Track jacket', 'common', 120, C.street, 'Zip front with stripes down the sleeves.', { open: true }],
    ['vest', 'outer', 'Tactical vest', 'rare', 300, ['#2b2f33', '#4a5232', '#6a5a3a'], 'Plate carrier look with mag pouches.'],
    ['trench', 'outer', 'Long trench coat', 'epic', 700, ['#b8a07a', '#1d2024', '#5a3524', '#2a3f62'], 'Belted, knee-length, storm flap. Very film noir.', { open: true }],
    ['bomber', 'outer', 'Flight bomber', 'uncommon', 220, ['#4a5232', '#1d2024', '#7a2e24', '#2a3f62'], 'Ribbed cuffs and an orange lining.', { open: true }],
    // bottoms
    ['jeans', 'bottom', 'Straight jeans', 'common', 60, C.denim, 'Five-pocket denim with visible stitching.'],
    ['cargo', 'bottom', 'Cargo pants', 'common', 80, C.earth.concat(['#1d2024', '#7d8796']), 'Big bellows pockets on the thighs.', { pattern: ['plain', 'camo'] }],
    ['joggers', 'bottom', 'Joggers', 'common', 55, C.street.concat(['#7d8796']), 'Tapered with cuffs and a side stripe.'],
    ['shorts', 'bottom', 'Basketball shorts', 'common', 40, C.street, 'Long mesh shorts with piping.'],
    ['chinos', 'bottom', 'Chinos', 'uncommon', 75, ['#b8a07a', '#1d2433', '#4a5232', '#e8e2d0'], 'Pressed crease, turned-up hem.'],
    ['skirt', 'bottom', 'Pleated skirt', 'uncommon', 70, ['#1d2024', '#7a2e24', '#c9c2b2', '#3a5a8a'], 'Knife pleats above the knee.'],
    // shoes
    ['hitops', 'shoes', 'Hi-top sneakers', 'uncommon', 140, ['#f1efe8', '#c84659', '#1d2024', '#3d7fc6', '#e2b75c'], 'Padded collar, swoosh panel, gum sole, real laces.'],
    ['runners', 'shoes', 'Runners', 'common', 90, ['#f1efe8', '#7d8796', '#ff4ad8', '#3ad0ff', '#1d2024'], 'Mesh upper on a chunky foam sole.'],
    ['boots', 'shoes', 'Work boots', 'common', 110, ['#8a6430', '#2a1f1a', '#1d2024'], 'Steel toe, lug sole, laced to the top.'],
    ['slides', 'shoes', 'Slides + socks', 'common', 30, ['#1d2024', '#f1efe8', '#c84659'], 'Socks with slides. A statement.'],
    ['dress', 'shoes', 'Dress shoes', 'rare', 260, ['#2a1f1a', '#5a3524', '#1d2024'], 'Polished leather oxfords.'],
    // gloves
    ['gloves', 'gloves', 'Leather gloves', 'uncommon', 70, ['#1d2024', '#5a3524'], 'No prints left behind.'],
    ['fingerless', 'gloves', 'Fingerless gloves', 'common', 35, ['#1d2024', '#7d8796'], 'Grip without losing feel.'],
    // jewelry
    ['chain', 'jewelry', 'Cuban chain', 'rare', 900, C.metal, 'Heavy links that catch the light.'],
    ['watch', 'jewelry', 'Iced watch', 'epic', 1800, C.metal, 'Bezel full of stones.'],
    ['chainwatch', 'jewelry', 'Chain + watch', 'epic', 2400, C.metal, 'The whole set.'],
    // bags
    ['backpack', 'bag', 'Backpack', 'common', 70, C.street.concat(['#1d2024']), 'Two straps, front pocket, zip pulls.'],
    ['sling', 'bag', 'Sling bag', 'common', 50, ['#1d2024', '#c84659', '#e2b75c', '#7d8796'], 'Cross-body, buckle on the chest.'],
    ['duffel', 'bag', 'Duffel', 'uncommon', 110, ['#1d2024', '#4a5232', '#c84659'], 'Over the shoulder. Room for anything.'],
  ];
  const ITEMS = RAW.map(([id, cat, name, rarity, price, colors, desc, opts]) => ({ id, cat, name, rarity, price, colors, desc, opts: opts || {} }));
  const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
  const CATS = [
    { id: 'body', name: 'Body', icon: '🧍' }, { id: 'hair', name: 'Hair & face', icon: '💇' }, { id: 'head', name: 'Headwear', icon: '🧢', optional: true },
    { id: 'face', name: 'Eyewear & masks', icon: '🕶️', optional: true }, { id: 'top', name: 'Tops', icon: '👕' }, { id: 'outer', name: 'Outerwear', icon: '🧥', optional: true },
    { id: 'bottom', name: 'Bottoms', icon: '👖' }, { id: 'shoes', name: 'Footwear', icon: '👟' }, { id: 'gloves', name: 'Gloves', icon: '🧤', optional: true },
    { id: 'jewelry', name: 'Jewelry', icon: '⛓️', optional: true }, { id: 'bag', name: 'Bags', icon: '🎒', optional: true },
  ];
  const SLOTS = ['head', 'face', 'top', 'outer', 'bottom', 'shoes', 'gloves', 'jewelry', 'bag'];
  const RARITY = { common: { name: 'Common', color: '#9fb3c8' }, uncommon: { name: 'Uncommon', color: '#7cdeb5' }, rare: { name: 'Rare', color: '#7cc7ff' }, epic: { name: 'Epic', color: '#c99aff' }, legendary: { name: 'Legendary', color: '#ffd970' } };
  const STARTER = ['tee', 'jeans', 'runners', 'hoodie', 'cap', 'tank', 'joggers'];
  const DEFAULT = { skin: 2, build: 'regular', hair: 'short', hairColor: 0, facial: 'none', head: null, face: null, top: { id: 'tee', color: 0 }, outer: { id: 'hoodie', color: 1, hood: false }, bottom: { id: 'jeans', color: 0 }, shoes: { id: 'runners', color: 0 }, gloves: null, jewelry: null, bag: null };
  // Full looks you can try on (and buy the missing pieces of) in one tap.
  const LOOKS = [
    { id: 'street', name: 'Street classic', outfit: { top: { id: 'tee', color: 7 }, outer: { id: 'hoodie', color: 8, hood: false }, bottom: { id: 'cargo', color: 3 }, shoes: { id: 'hitops', color: 0 }, head: { id: 'cap', color: 8, back: true }, face: null, bag: { id: 'sling', color: 0 }, jewelry: { id: 'chain', color: 0 }, gloves: null } },
    { id: 'night', name: 'Night work', outfit: { top: { id: 'longsleeve', color: 8 }, outer: { id: 'leather', color: 0, open: false }, bottom: { id: 'cargo', color: 3, pattern: 0 }, shoes: { id: 'boots', color: 2 }, head: { id: 'beanie', color: 8 }, face: { id: 'skimask', color: 0 }, gloves: { id: 'gloves', color: 0 }, bag: { id: 'backpack', color: 9 }, jewelry: null } },
    { id: 'baller', name: 'Courtside', outfit: { top: { id: 'jersey', color: 1 }, outer: null, bottom: { id: 'shorts', color: 1 }, shoes: { id: 'hitops', color: 1 }, head: { id: 'durag', color: 0 }, face: { id: 'shades', color: 0 }, jewelry: { id: 'chainwatch', color: 0 }, bag: null, gloves: null } },
    { id: 'boss', name: 'Old money', outfit: { top: { id: 'buttonup', color: 0, tucked: true }, outer: { id: 'trench', color: 0, open: true }, bottom: { id: 'chinos', color: 1 }, shoes: { id: 'dress', color: 0 }, head: { id: 'fedora', color: 1 }, face: { id: 'aviators', color: 0 }, jewelry: { id: 'watch', color: 0 }, bag: null, gloves: null } },
    { id: 'winter', name: 'Winter block', outfit: { top: { id: 'longsleeve', color: 1 }, outer: { id: 'puffer', color: 2, open: false }, bottom: { id: 'joggers', color: 8 }, shoes: { id: 'boots', color: 0 }, head: { id: 'beanie', color: 0 }, face: null, gloves: { id: 'fingerless', color: 0 }, bag: { id: 'backpack', color: 1 }, jewelry: null } },
  ];

  const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
  function cleanPiece(cat, p) {
    if (!p || typeof p !== 'object' || !ITEM[p.id] || ITEM[p.id].cat !== cat) return null;
    const it = ITEM[p.id], o = { id: p.id, color: int(p.color, 0, it.colors.length - 1, 0) };
    if (it.opts.hood) o.hood = !!p.hood; if (it.opts.open) o.open = !!p.open; if (it.opts.tuck) o.tucked = !!p.tucked; if (it.opts.back) o.back = !!p.back; if (it.opts.roll) o.rolled = !!p.rolled;
    if (it.opts.pattern) o.pattern = int(p.pattern, 0, it.opts.pattern.length - 1, 0);
    return o;
  }
  function cleanOutfit(raw) {
    const o = { skin: int(raw?.skin, 0, SKINS.length - 1, DEFAULT.skin), build: BUILDS.some((b) => b.id === raw?.build) ? raw.build : DEFAULT.build,
      hair: HAIRSTYLES.some((h) => h[0] === raw?.hair) ? raw.hair : DEFAULT.hair, hairColor: int(raw?.hairColor, 0, HAIR_COLORS.length - 1, 0), facial: FACIAL.some((f) => f[0] === raw?.facial) ? raw.facial : 'none' };
    for (const s of SLOTS) o[s] = cleanPiece(s, raw && s in raw ? raw[s] : DEFAULT[s]);
    for (const s of ['top', 'bottom', 'shoes']) if (!o[s]) o[s] = cleanPiece(s, DEFAULT[s]); // never naked
    return o;
  }
  function clean(raw) {
    const s = { version: 1, outfit: cleanOutfit(raw?.outfit || DEFAULT), owned: [...STARTER], saved: [], cond: {} };
    for (const id of Array.isArray(raw?.owned) ? raw.owned : []) if (ITEM[id] && !s.owned.includes(id)) s.owned.push(id);
    for (const sv of Array.isArray(raw?.saved) ? raw.saved.slice(0, 5) : []) if (sv && typeof sv.name === 'string') s.saved.push({ name: sv.name.slice(0, 18) || 'Outfit', outfit: cleanOutfit(sv.outfit) });
    for (const [id, v] of Object.entries(raw?.cond || {})) if (ITEM[id] && Number.isFinite(v)) s.cond[id] = Math.max(0, Math.min(100, Math.round(v)));
    // wearing something you don't own (old save / tampering) falls back to the default piece
    for (const sl of SLOTS) { const p = s.outfit[sl]; if (p && !s.owned.includes(p.id)) s.outfit[sl] = sl === 'top' || sl === 'bottom' || sl === 'shoes' ? cleanPiece(sl, DEFAULT[sl]) : null; }
    return s;
  }
  const owns = (s, id) => s.owned.includes(id);
  // Items in an outfit you don't own yet, and what they'd cost.
  function missing(s, outfit) { const out = []; for (const sl of SLOTS) { const p = outfit[sl]; if (p && !owns(s, p.id)) out.push(ITEM[p.id]); } return out; }
  const costOf = (items, mult = 1) => Math.round(items.reduce((t, i) => t + i.price, 0) * mult);
  function buy(s, wallet, ids, mult = 1) {
    const list = [...new Set(ids)].map((id) => ITEM[id]).filter((i) => i && !owns(s, i.id)); if (!list.length) return { ok: false, reason: 'Nothing to buy' };
    const price = costOf(list, mult); if (!(wallet.cash >= price)) return { ok: false, reason: `Needs $${price.toLocaleString()}` };
    wallet.cash -= price; for (const i of list) { s.owned.push(i.id); s.cond[i.id] = 100; } return { ok: true, price, items: list };
  }
  // Wear an outfit: only owned pieces go on; returns the pieces that were skipped.
  function wear(s, outfit) { const o = cleanOutfit(outfit), skipped = []; for (const sl of SLOTS) { const p = o[sl]; if (p && !owns(s, p.id)) { skipped.push(p.id); o[sl] = s.outfit[sl]; } } s.outfit = o; return skipped; }
  function saveOutfit(s, slot, name) { if (!(slot >= 0 && slot < 5)) return false; s.saved[slot] = { name: String(name || `Outfit ${slot + 1}`).slice(0, 18), outfit: cleanOutfit(s.outfit) }; return true; }
  // Deterministic outfit for an NPC (seeded by id); roles get uniforms.
  function npcOutfit(seed, role) {
    let x = (seed >>> 0) || 1; const r = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    const pick = (a) => a[Math.floor(r() * a.length)], of = (cat) => ITEMS.filter((i) => i.cat === cat && i.rarity !== 'epic' && i.id !== 'fedora'); // v0.63: no 1940s hats on modern streets
    const piece = (cat, chance = 1) => { if (r() > chance) return null; const it = pick(of(cat)); return { id: it.id, color: Math.floor(r() * it.colors.length), hood: r() < 0.25, open: r() < 0.5, back: r() < 0.4, tucked: r() < 0.3, pattern: r() < 0.2 ? 1 : 0 }; };
    if (role === 'officer') return cleanOutfit({ skin: Math.floor(r() * SKINS.length), build: pick(BUILDS).id, hair: pick(['buzz', 'fade', 'short', 'bun', 'ponytail']), hairColor: Math.floor(r() * 6), facial: pick(['none', 'none', 'mustache', 'stubble']), head: { id: 'cap', color: 3 }, face: r() < 0.3 ? { id: 'aviators', color: 1 } : null, top: { id: 'buttonup', color: 3, tucked: true }, outer: { id: 'vest', color: 0 }, bottom: { id: 'chinos', color: 1 }, shoes: { id: 'boots', color: 2 }, gloves: null, jewelry: null, bag: null, uniform: 'police' });
    if (role === 'security') return cleanOutfit({ skin: Math.floor(r() * SKINS.length), build: 'broad', hair: pick(['bald', 'buzz', 'fade']), hairColor: 0, facial: pick(['none', 'beard', 'goatee']), head: null, face: r() < 0.5 ? { id: 'shades', color: 0 } : null, top: { id: 'tee', color: 8 }, outer: { id: 'bomber', color: 1 }, bottom: { id: 'cargo', color: 3 }, shoes: { id: 'boots', color: 2 }, gloves: { id: 'gloves', color: 0 }, jewelry: null, bag: null });
    return cleanOutfit({ skin: Math.floor(r() * SKINS.length), build: pick(BUILDS).id, hair: pick(HAIRSTYLES)[0], hairColor: Math.floor(r() * 7), facial: r() < 0.3 ? pick(FACIAL)[0] : 'none',
      head: piece('head', 0.35), face: piece('face', 0.2), top: piece('top'), outer: piece('outer', 0.55), bottom: piece('bottom'), shoes: piece('shoes'), gloves: null, jewelry: piece('jewelry', 0.12), bag: piece('bag', 0.3) });
  }
  // Stable key for caches (atlas frames) — everything that changes how the character looks.
  const keyOf = (o) => JSON.stringify([o.skin, o.build, o.hair, o.hairColor, o.facial, ...SLOTS.map((s) => (o[s] ? [o[s].id, o[s].color, o[s].hood ? 1 : 0, o[s].open ? 1 : 0, o[s].tucked ? 1 : 0, o[s].back ? 1 : 0, o[s].rolled ? 1 : 0, o[s].pattern || 0] : 0))]);

  const api = Object.freeze({ SKINS, HAIR_COLORS, BUILDS, HAIRSTYLES, FACIAL, ITEMS, ITEM, CATS, SLOTS, RARITY, STARTER, DEFAULT, LOOKS, cleanOutfit, clean, owns, missing, costOf, buy, wear, saveOutfit, npcOutfit, keyOf });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftWardrobeData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
