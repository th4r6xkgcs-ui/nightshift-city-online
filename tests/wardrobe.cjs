// Wardrobe catalog + saves (Claude-owned): every item is well-formed, saves are tamper-proof,
// buying/wearing only puts owned pieces on, saved outfits round-trip, NPC outfits are deterministic.
const assert = require('node:assert/strict');
const W = require('../wardrobe-data.js');

// Catalog shape
const ids = new Set();
for (const it of W.ITEMS) {
  assert.ok(!ids.has(it.id), `unique id ${it.id}`); ids.add(it.id);
  assert.ok(W.SLOTS.includes(it.cat), `${it.id} has a real slot`);
  assert.ok(W.RARITY[it.rarity], `${it.id} rarity`);
  assert.ok(Number.isInteger(it.price) && it.price > 0, `${it.id} price`);
  assert.ok(Array.isArray(it.colors) && it.colors.length >= 2, `${it.id} has colour variants`);
  assert.ok(typeof it.desc === 'string' && it.desc.length > 10, `${it.id} description`);
  assert.equal(W.ITEM[it.id], it);
}
for (const sl of W.SLOTS) assert.ok(W.ITEMS.filter((i) => i.cat === sl).length >= 2, `${sl} has choices`);
assert.ok(W.ITEMS.length >= 40, 'deep catalog');
for (const id of W.STARTER) assert.ok(W.ITEM[id], `starter ${id}`);

// Every look is wearable once bought, and its pieces are valid for their slots
for (const look of W.LOOKS) {
  const o = W.cleanOutfit(look.outfit);
  for (const sl of W.SLOTS) if (look.outfit[sl]) assert.equal(o[sl].id, look.outfit[sl].id, `${look.id} ${sl} survives cleaning`);
}

// Fresh + tampered saves
const fresh = W.clean(null);
assert.deepEqual(fresh.owned, W.STARTER);
assert.equal(fresh.outfit.top.id, 'tee'); assert.equal(fresh.outfit.outer.id, 'hoodie');
const bad = W.clean({ owned: ['fedora', 'nope', 'fedora'], outfit: { skin: 99, build: 'giant', hair: 'x', top: { id: 'jeans' }, head: { id: 'fedora', color: 99 }, face: { id: 'skimask' } }, saved: [{ name: 'A'.repeat(40), outfit: {} }, 5, null], cond: { tee: 400, nope: 3, cap: -2 } });
assert.equal(bad.owned.filter((i) => i === 'fedora').length, 1, 'no duplicate ownership'); assert.ok(!bad.owned.includes('nope'));
assert.equal(bad.outfit.skin, W.DEFAULT.skin); assert.equal(bad.outfit.build, 'regular'); assert.equal(bad.outfit.top.id, 'tee', 'a bottom in the top slot is rejected');
assert.equal(bad.outfit.head.id, 'fedora'); assert.equal(bad.outfit.head.color, 0, 'colour index clamped');
assert.equal(bad.outfit.face, null, 'unowned ski mask removed'); assert.equal(bad.saved.length, 1); assert.equal(bad.saved[0].name.length, 18);
assert.equal(bad.cond.tee, 100); assert.equal(bad.cond.cap, 0); assert.ok(!('nope' in bad.cond));
assert.deepEqual(W.clean(JSON.parse(JSON.stringify(bad))), bad, 'clean is idempotent');

// Buying
const s = W.clean(null), wallet = { cash: 100 };
const night = W.LOOKS.find((l) => l.id === 'night').outfit, need = W.missing(s, night);
assert.ok(need.length >= 4, 'night look needs several pieces');
const price = W.costOf(need);
assert.equal(W.buy(s, wallet, need.map((i) => i.id)).ok, false, 'cannot afford'); assert.equal(wallet.cash, 100);
wallet.cash = price + 5; const r = W.buy(s, wallet, need.map((i) => i.id));
assert.ok(r.ok); assert.equal(r.price, price); assert.equal(wallet.cash, 5); assert.equal(W.missing(s, night).length, 0);
assert.equal(W.buy(s, wallet, ['tee']).ok, false, 'already owned');

// Wearing: only owned pieces go on
const s2 = W.clean(null), boss = W.LOOKS.find((l) => l.id === 'boss').outfit;
const skipped = W.wear(s2, boss);
assert.ok(skipped.includes('fedora') && skipped.includes('trench'));
assert.equal(s2.outfit.head, null, 'unowned fedora stays off'); assert.equal(s2.outfit.top.id, 'tee');
W.wear(s, night); assert.equal(s.outfit.face.id, 'skimask'); assert.equal(s.outfit.outer.id, 'leather');

// Saved outfits round-trip through a save
assert.ok(W.saveOutfit(s, 0, 'Heist fit')); assert.equal(W.saveOutfit(s, 5, 'x'), false);
const back = W.clean(JSON.parse(JSON.stringify(s)));
assert.equal(back.saved[0].name, 'Heist fit'); assert.equal(back.saved[0].outfit.face.id, 'skimask'); assert.equal(back.outfit.outer.id, 'leather');

// Cache keys change with anything visible
const k = W.keyOf(s.outfit), o2 = JSON.parse(JSON.stringify(s.outfit)); o2.outer.open = !o2.outer.open;
assert.notEqual(W.keyOf(o2), k, 'open/closed jacket is a different sprite');
o2.outer.open = s.outfit.outer.open; o2.skin = (o2.skin + 1) % W.SKINS.length; assert.notEqual(W.keyOf(o2), k);

// NPCs: deterministic, varied, uniforms for roles
assert.equal(W.keyOf(W.npcOutfit(42)), W.keyOf(W.npcOutfit(42)));
const keys = new Set(); for (let i = 1; i <= 60; i++) keys.add(W.keyOf(W.npcOutfit(i * 7919)));
assert.ok(keys.size >= 55, 'crowds look varied');
for (let i = 1; i < 20; i++) { const c = W.npcOutfit(i, 'officer'); assert.equal(c.top.id, 'buttonup'); assert.equal(c.head.id, 'cap'); assert.ok(c.top && c.bottom && c.shoes); }
assert.equal(W.npcOutfit(3, 'security').outer.id, 'bomber');

console.log('wardrobe: catalog, saves, buy/wear, outfits, NPC variety OK');
