// Premium weapon sprites (Claude-owned): every gun builds inside its grid, attachments are visible and land on
// their anchors, paint jobs recolour, builds are deterministic.
const assert = require('node:assert/strict');
const D = require('../weapons-data.js');
const A = require('../weapon-art.js');

const filled = (b) => b.px.filter(Boolean).length;
const colors = (b) => new Set(b.px.filter(Boolean));
for (const w of D.WEAPONS) {
  assert.ok(A.GUNS.includes(w.id), `${w.id} has a premium sprite`);
  const all = D.MODS.filter((m) => !w.crude || m.crude).map((m) => m.id);
  for (const mods of [[], all]) {
    const b = A.build(w.id, null, mods), { box, GW, GH } = b;
    assert.ok(box.x > 0 && box.y > 0 && box.x + box.w < GW && box.y + box.h < GH, `${w.id} [${mods}] fits the grid with room for the outline (${JSON.stringify(box)})`);
    assert.ok(box.w >= 14 && box.h >= 7, `${w.id} is a real sprite`);
    for (const k of ['hand', 'muzzle', 'rail', 'under']) assert.ok(Array.isArray(b.a[k]) && b.a[k].every(Number.isFinite), `${w.id} anchor ${k}`);
    assert.ok(b.a.muzzle[0] > b.a.hand[0], `${w.id} muzzle is ahead of the hand`);
    assert.ok(colors(b).size >= 8, `${w.id} is shaded, not flat (${colors(b).size} colours)`);
  }
  assert.deepEqual(A.build(w.id, 'gold', ['scope']).px, A.build(w.id, 'gold', ['scope']).px, `${w.id} build is deterministic`);
  assert.notDeepEqual(A.build(w.id, 'neon').px, A.build(w.id).px, `${w.id} paint job changes the sprite`);
  if (w.crude) continue;
  const base = A.build(w.id);
  for (const m of D.MODS) {
    const withM = A.build(w.id, null, [m.id]);
    const builtIn = (m.id === 'suppressor' && w.silent) || (m.id === 'scope' && base.a.optic);
    if (builtIn) continue;
    assert.notDeepEqual(withM.px, base.px, `${w.id} + ${m.id} is visible`);
  }
  if (!w.silent) assert.ok(A.build(w.id, null, ['suppressor']).box.w > base.box.w, `${w.id} suppressor lengthens the gun`);
  if (!base.a.optic) assert.ok(A.build(w.id, null, ['scope']).box.y <= base.box.y, `${w.id} optic sits on top`);
}
// rifles read bigger than pistols in every view
assert.ok(A.build('ar').box.w > A.build('pistol').box.w * 1.6);
assert.ok(A.build('reaper').box.w >= A.build('ar').box.w);
console.log(`weapon-art: ${D.WEAPONS.length} guns × mods/paint verified`);
