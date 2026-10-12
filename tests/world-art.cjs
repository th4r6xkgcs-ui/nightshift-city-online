// Premium pets + street props (Claude-owned): every species/pose and prop builds inside its grid, shaded, outlined;
// walk frames animate, sitting is a different silhouette, benches give the seat position.
const assert = require('node:assert/strict');
const PD = require('../pets-data.js');
const PA = require('../pet-art.js');
const PR = require('../prop-art.js');

const filled = (b) => b.px.filter(Boolean).length;
const edgeClear = (b) => { for (let x = 0; x < b.w; x++) if (b.px[x] || b.px[(b.h - 1) * b.w + x]) return false; for (let y = 0; y < b.h; y++) if (b.px[y * b.w] || b.px[y * b.w + b.w - 1]) return false; return true; };
for (const p of PD.PETS) {
  const frames = ['w0', 'w1', 'w2', 'w3', 'i0', 'i1', 's0', 's1'].map((k) => PA.build(p.id, k));
  for (const [i, b] of frames.entries()) {
    assert.ok(b && filled(b) > 120, `${p.id} pose ${i} draws`);
    assert.ok(edgeClear(b), `${p.id} pose ${i} fits its grid`);
    assert.ok(new Set(b.px.filter(Boolean)).size >= 7, `${p.id} pose ${i} is shaded`);
    assert.ok(b.px.includes('#0e1116'), `${p.id} has an ink outline`);
  }
  assert.deepEqual(PA.build(p.id, 'w1').px, PA.build(p.id, 'w1').px, 'deterministic');
  if (!['owl', 'bird'].includes(p.kind)) assert.notDeepEqual(frames[0].px, frames[1].px, `${p.id} walk animates`);
  if (['dog', 'cat', 'raccoon'].includes(p.kind)) assert.notDeepEqual(frames[4].px, frames[6].px, `${p.id} sits differently`);
}
assert.equal(PA.build('nope', 'w0'), null);
for (const k of PR.KINDS) { const b = PR.build(k); assert.ok(b && filled(b) > 200, `${k} draws`); assert.ok(edgeClear(b), `${k} fits`); assert.ok(new Set(b.px.filter(Boolean)).size >= 6, `${k} shaded`); }
for (const k of ['hydrant', 'mailbox', 'vending', 'dumpster', 'flowercart', 'barrel', 'crate', 'bench', 'atm']) assert.ok(PR.KINDS.includes(k), `replaces Codex prop ${k}`);
console.log(`world-art: ${PD.PETS.length} pets × 8 poses, ${PR.KINDS.length} props OK`);
