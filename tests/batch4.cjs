// Batch 4 (Claude-owned): hidden stashes, street exchange, fight club, workbench.
const assert = require('node:assert/strict');
const S = require('../stashes-data.js'), M = require('../market-data.js'), V = require('../venues-data.js'), W = require('../weapons-data.js');

// ---- stashes ----
assert.equal(S.SPOTS.length, 30); assert.equal(new Set(S.SPOTS.map((s) => s.id)).size, 30);
const XS = [440, 880, 1320, 1760], YS = [340, 680, 1020, 1360];
for (const s of S.SPOTS) {
  assert.ok(s.x >= 40 && s.x <= 2160 && s.y >= 40 && s.y <= 1660, 'in world ' + s.id);
  assert.ok(XS.every((v) => Math.abs(s.x - v) >= 70) && YS.every((v) => Math.abs(s.y - v) >= 70), 'off road ' + s.id);
  const r = S.reward(s.id); assert.deepEqual(r, S.reward(s.id), 'stable reward');
  assert.ok(r.cash >= 150 && r.cash <= 600 && r.items.scrap >= 2 && r.items.scrap <= 4);
}
for (let i = 0; i < 30; i++) for (let j = i + 1; j < 30; j++) assert.ok(Math.hypot(S.SPOTS[i].x - S.SPOTS[j].x, S.SPOTS[i].y - S.SPOTS[j].y) > 200, 'spread');
const st = S.clean({}); let bonus = 0;
for (const s of S.SPOTS) { const r = S.take(st, s.id, 5); bonus += r.bonus; assert.equal(S.take(st, s.id, 6), null, 'once only'); }
assert.equal(S.count(st), 30); assert.equal(bonus, S.MILESTONES.reduce((t, m) => t + m.cash, 0), 'every milestone paid once');
assert.equal(S.rumor(st), null, 'no rumor when all found');
const st2 = S.clean({}); const rr = S.rumor(st2, () => 0.5), sp = S.BY_ID[rr.id];
assert.ok(Math.hypot(rr.x - sp.x, rr.y - sp.y) <= S.RUMOR_FUZZ && rr.r > S.RUMOR_FUZZ, 'rumor circle contains the stash');
st2.rumor = rr; S.take(st2, rr.id); assert.equal(st2.rumor, null, 'finding the rumored stash clears it');
assert.deepEqual(S.clean({ found: { s01: 3, bogus: 1, s02: -1 }, rumor: { id: 's01', x: 1, y: 1, r: 9 }, earned: -5 }), { version: 1, found: { s01: 3 }, rumor: null, earned: 0 });
console.log('PASS: hidden stashes (placement, rewards, milestones, rumors, save)');

// ---- market ----
const slot = 29000000;
for (const t of M.TICKERS) { const h = M.history(t.id, slot, 2000); assert.ok(Math.min(...h) > t.base * 0.4 && Math.max(...h) < t.base * 2.2, t.id + ' range'); }
assert.equal(M.price('DOCK', slot), M.price('DOCK', slot), 'deterministic');
assert.ok(Math.abs(M.price('GOLD', slot + 1) / M.price('GOLD', slot) - 1) < 0.02, 'gold is calm');
const mk = M.clean({}), wallet = { cash: 50000 }, px = M.price('NCOIN', slot);
assert.equal(M.buy(mk, wallet, 'NCOIN', 1e6, px).ok, false, 'position limit');
const n = M.maxBuy(mk, wallet.cash, 'NCOIN', px); assert.ok(n > 0 && n * px <= M.cap(0));
const b = M.buy(mk, wallet, 'NCOIN', n, px); assert.ok(b.ok && b.fee >= 1);
assert.equal(wallet.cash, 50000 - b.total);
const sl = M.sell(mk, wallet, 'NCOIN', n, px); assert.ok(sl.ok && sl.pnl < 0, 'round trip at same price loses the fees');
assert.equal(mk.hold.NCOIN, undefined); assert.equal(mk.trades, 2); assert.equal(mk.realized, sl.pnl);
assert.ok(M.cap(7) > M.cap(0)); assert.equal(M.sell(mk, wallet, 'NCOIN', 1, px).ok, false);
// The news is a real but imperfect edge: following it wins more often than not, never always.
let wins = 0, total = 0;
for (let w = 0; w < 2000; w++) { const s = slot + w * 10, nw = M.news(s); if (!nw.up) continue; total++; if (M.price(nw.id, s + 10) * 0.98 > M.price(nw.id, s)) wins++; }
assert.ok(wins / total > 0.5 && wins / total < 0.8, 'news edge ' + wins / total);
assert.deepEqual(M.clean({ hold: { NCOIN: { qty: 5, cost: 100 }, FAKE: { qty: 1, cost: 1 }, DOCK: { qty: -1, cost: 1 } }, realized: 12.4, trades: 'x' }).hold, { NCOIN: { qty: 5, cost: 100 } });
console.log('PASS: street exchange (prices, limits, fees, P/L, news edge, save)');

// ---- fight club ----
const rookie = V.startFight(0, {}), pro = V.startFight(0, { toughness: 30, athletics: 30 });
assert.ok(pro.maxHp > rookie.maxHp && pro.window > rookie.window && pro.dmg > rookie.dmg && pro.taken < rookie.taken);
// perfect play beats the champion; doing nothing loses to the rookie
const champ = V.startFight(4, {}); let r;
do { const beat = V.nextBeat(champ, Math.random); r = V.resolveBeat(champ, beat, beat.kind === 'feint' ? null : beat.kind === 'open' ? 'strike' : 'block', 50); } while (!r.end);
assert.equal(r.end, 'win');
const afk = V.startFight(0, {}); do { r = V.resolveBeat(afk, V.nextBeat(afk), null, NaN); } while (!r.end); assert.equal(r.end, 'lose');
const f = V.startFight(1, {}); assert.equal(V.resolveBeat(f, { kind: 'open' }, 'strike', f.window + 1).result, 'whiff', 'late = whiff');
assert.equal(V.resolveBeat(f, { kind: 'swing' }, 'strike', 10).result, 'hurt'); assert.equal(V.resolveBeat(f, { kind: 'swing' }, 'block', 10).result, 'blocked');
assert.equal(V.resolveBeat(f, { kind: 'open' }, 'strike', 10).result, 'crit');
assert.equal(V.resolveBeat(f, { kind: 'feint' }, 'strike', 10).result, 'baited'); assert.equal(V.resolveBeat(f, { kind: 'feint' }, null, NaN).result, 'read');
const vs = V.clean({ ladder: 2, wins: 3, fights: 5, purses: 900 });
assert.ok(V.canFight(vs, 2) && !V.canFight(vs, 3) && !V.canFight(vs, -1)); assert.equal(V.clean({ ladder: 99 }).ladder, 5);
console.log('PASS: fight club (skills, perfect/afk play, timing, ladder, save)');

// ---- workbench ----
const ws = W.clean({ owned: ['pistol'] }), pocket = { scrap: 12, parts: 1 };
assert.equal(W.buildMod(ws, pocket, 'pistol', 'scope', 9).ok, false, 'scope needs 2 parts');
assert.equal(W.buildMod(ws, pocket, 'pistol', 'grip', 1).ok, false, 'shooting level gate');
assert.ok(W.buildMod(ws, pocket, 'pistol', 'grip', 9).ok); assert.deepEqual(pocket, { scrap: 7 }); assert.deepEqual(ws.mods.pistol, ['grip']);
assert.equal(W.buildMod(ws, pocket, 'pistol', 'grip', 9).reason, 'Already fitted');
assert.equal(W.buildPlate(ws, pocket).ok, false, 'plate needs parts'); pocket.parts = 9;
for (let i = 0; i < 4; i++) W.buildPlate(ws, { scrap: 99, parts: 9 });
assert.equal(ws.armor, 100); assert.equal(W.buildPlate(ws, { scrap: 99, parts: 9 }).reason, 'Armor is full');
for (const m of W.MODS) assert.ok(W.BUILD[m.id], 'every mod buildable');
console.log('PASS: workbench mods and armor plates from salvage');
