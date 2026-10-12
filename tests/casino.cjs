// Casino rules (Claude-owned): the house always keeps an edge; payouts are exact and bounded.
const assert = require('node:assert/strict');
const C = require('../casino-data.js');
const SD = require('../skills-data.js');
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

const base = C.slotsRtp(1), maxLuck = C.slotsRtp(99);
assert.ok(base > 0.85 && base < 0.92, 'slots RTP at Luck 1: ' + base);
assert.ok(maxLuck < 0.98, 'slots RTP at max Luck stays below 98%: ' + maxLuck);
const cap = SD.SKILLS.find((s) => s.id === 'luck').perks.find((p) => p.key === 'luck.casino').max;
assert.ok(C.slotsRtp(cap) < 1, 'luck.casino perk cap can never make slots profitable');
console.log(`PASS: slots return ${(base * 100).toFixed(1)}% (Luck 1) to ${(maxLuck * 100).toFixed(1)}% (max Luck); house keeps an edge`);

for (const ch of ['red', 'black', 'odd', 'even', 'low', 'high', 0, 17, 36]) assert.ok(Math.abs(C.rouletteRtp(ch) - 36 / 37) < 1e-12, 'roulette RTP ' + ch);
assert.equal(C.colorOf(0), 'green'); assert.equal(C.colorOf(1), 'red'); assert.equal(C.colorOf(2), 'black'); assert.equal(C.RED.size, 18);
// rnd 0 -> 0 (green): every outside bet loses, a bet on 0 pays 36x.
assert.equal(C.spinRoulette(100, 'red', seq(0)).payout, 0);
assert.equal(C.spinRoulette(100, 0, seq(0)).payout, 3600);
assert.equal(C.spinRoulette(100, 'red', seq(1 / 37 + 1e-9)).payout, 200, '1 is red');
assert.equal(C.spinRoulette(100, 'even', seq(2 / 37 + 1e-9)).payout, 200);
console.log('PASS: roulette is a fair European wheel (97.3%) with exact payouts');

// Slots: deterministic reels, payouts, luck bonus bounded.
const all = (r) => seq(r, r, r);
const seven = 31.5 / 32;
assert.deepEqual(C.spinSlots(100, 1, all(seven)).ids, ['7', '7', '7']);
assert.equal(C.spinSlots(100, 1, all(seven)).payout, 30000);
assert.equal(C.spinSlots(100, 1.08, all(seven)).payout, 32400, 'luck boosts wins');
assert.equal(C.spinSlots(100, 5, all(seven)).payout, 32400, 'luck boost is clamped');
assert.equal(C.spinSlots(100, 1, seq(0, 0, 0.5)).payout, 200, 'two cherries');
assert.equal(C.spinSlots(100, 1, seq(0, 0.5, 0.99)).payout, 0, 'no line');
console.log('PASS: slots reels, paytable and luck bonus');

// Bets are validated.
for (const bad of [0, 9, 1001, 50.5, NaN, -10, '50']) assert.equal(C.spinSlots(bad), null, 'bad bet ' + bad);
assert.equal(C.spinRoulette(50, 'purple'), null); assert.equal(C.spinRoulette(50, 37), null); assert.equal(C.spinRoulette(50, -1), null);
assert.ok(C.spinSlots(10) && C.spinSlots(1000) && C.spinRoulette(10, 'red'));
console.log('PASS: casino bet and choice validation');

// Blackjack: hand values, results, and a basic-strategy simulation stays below 100% return.
assert.deepEqual(C.handValue([1, 13]), { total: 21, soft: true }); assert.equal(C.isBlackjack([1, 12]), true);
assert.deepEqual(C.handValue([1, 1, 9]), { total: 21, soft: true }); assert.deepEqual(C.handValue([10, 6, 1]), { total: 17, soft: false });
assert.equal(C.bjResult([10, 9], [10, 8]), 2); assert.equal(C.bjResult([10, 8], [10, 8]), 1); assert.equal(C.bjResult([10, 9, 5], [10, 2]), 0);
assert.equal(C.bjResult([1, 10], [10, 9]), 2.5); assert.equal(C.bjResult([1, 10], [1, 10]), 1); assert.equal(C.bjResult([10, 9], [10, 6, 9]), 2);
let st2 = 7; const rnd = () => { st2 = (st2 * 16807) % 2147483647; return st2 / 2147483647; };
let back = 0; const N = 60000;
for (let i = 0; i < N; i++) {
  const h = C.dealHand(rnd), up = Math.min(10, h.dealer[0]);
  while (true) { const v = C.handValue(h.player).total; if (v >= 17 || (v >= 13 && up <= 6) || (v === 12 && up >= 4 && up <= 6)) break; h.player.push(C.draw(rnd)); }
  C.dealerPlay(h.dealer, rnd); back += C.bjResult(h.player, h.dealer);
}
const rtp = back / N; assert.ok(rtp > 0.9 && rtp < 1.0, 'blackjack return with simple strategy: ' + rtp);
console.log(`PASS: blackjack rules; simple strategy returns ${(rtp * 100).toFixed(1)}% (house keeps an edge)`);
