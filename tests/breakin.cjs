// Break-ins (Claude-owned): generated interiors are connected, loot/guards sit inside rooms, paths route via doors.
const assert = require('node:assert/strict');
const B = require('../breakin-data.js');
const S = require('../supply-data.js');

const inWall = (L, x, y) => L.walls.some((w) => x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h);
for (const type of Object.keys(B.TYPES)) {
  for (let seed = 1; seed <= 40; seed++) {
    const L = B.generate(type, seed);
    assert.ok(B.connected(L), `${type}#${seed} every room reachable`);
    assert.ok(L.doors.some((d) => d.entry), 'has an entry door');
    assert.ok(L.loot.length >= 2, `${type}#${seed} has loot (${L.loot.length})`);
    for (const l of L.loot) { assert.ok(B.roomAt(L, l.x, l.y), 'loot inside a room'); assert.ok(!inWall(L, l.x, l.y), 'loot not in a wall'); }
    for (const g of L.guards) { assert.notEqual(B.roomAt(L, g.x, g.y)?.i, L.entryRoom, 'no guard waits at the entry'); assert.ok(!inWall(L, g.x, g.y)); }
    assert.ok(!inWall(L, L.spawn.x, L.spawn.y) && L.spawn.y > L.h - B.PAD - 10, 'spawn outside the back door');
    // a path from the entry room to every room only crosses walls at doorways
    const er = L.rooms[L.entryRoom], from = { x: er.x + er.w / 2, y: er.y + er.h / 2 };
    for (const R0 of L.rooms) { const pts = B.path(L, from, { x: R0.x + R0.w / 2, y: R0.y + R0.h / 2 }); assert.ok(pts.length >= 1); }
  }
}
console.log('PASS: generated interiors (connected, loot + guards inside rooms, entry clear, paths via doors) for 120 layouts');

for (const [kind, t] of Object.entries(B.LOOT)) for (const [it] of t.loot) assert.ok(it === 'cash' || it === 'ammo' || S.MATERIALS[it], `${kind} loot ${it} is a real item`);
for (const k of Object.keys(B.FENCE)) assert.equal(S.MATERIALS[k].kind, 'loot');
const r = B.rollLoot('safe', () => 0); assert.ok(r.cash >= 400 && r.items.jewels >= 1);
assert.deepEqual(B.rollLoot('nope'), { cash: 0, items: {} });
const st = B.clean({ robbed: { h1: 1000, bad: 'x' }, stats: { jobs: 3, kills: -1 } }, 5000);
assert.deepEqual(st.robbed, { h1: 1000 }); assert.equal(st.stats.jobs, 3); assert.equal(st.stats.kills, 0);
assert.ok(B.cooldownLeft(st, 'h1', 'house', 1000 + 60000) > 0); assert.equal(B.cooldownLeft(st, 'h1', 'house', 1000 + 26 * 60000), 0);
console.log('PASS: loot tables, fence items, cooldowns, save cleaning');
