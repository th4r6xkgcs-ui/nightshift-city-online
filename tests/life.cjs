// City life (Claude-owned): clock rhythm, radio patterns, news, tip texts, save cleaning.
const assert = require('node:assert/strict');
const L = require('../life-data.js'), V = require('../venues-data.js');

assert.ok(L.isNight(1300) && L.isNight(100) && !L.isNight(600) && L.isMorning(400) && !L.isMorning(800));
assert.equal(L.hhmm(1439), '23:59'); assert.equal(L.hhmm(-1), '23:59'); assert.equal(L.norm(1500), 60);
assert.ok(V.clubPrice(100, 1, L.clubPremiumBonus(1300)) > V.clubPrice(100, 1, L.clubPremiumBonus(700)), 'clubs pay more at night');
assert.equal(L.gymFeeMult(400), 0.5); assert.equal(L.gymFeeMult(900), 1);
console.log('PASS: day rhythm (night clubs, morning gym)');

for (const s of L.STATIONS) {
  const b = L.bar(s.id, 5); assert.deepEqual(b, L.bar(s.id, 5), 'deterministic');
  assert.ok(b.some((n) => n.kind === 'bass') && b.some((n) => n.kind === 'pad') && b.some((n) => n.kind === 'kick'));
  for (const n of b) { assert.ok(n.step >= 0 && n.step < 16 && n.len > 0); if (n.midi !== undefined) for (const m of [].concat(n.midi)) assert.ok(m >= 28 && m <= 100, 'midi range ' + m); }
  assert.ok(L.stepSeconds(s.id) > 0.1 && L.stepSeconds(s.id) < 0.3);
}
assert.ok(Math.abs(L.midiHz(69) - 440) < 1e-9); assert.deepEqual(L.bar('nope', 1), []);
console.log('PASS: radio stations and procedural bars');

const h = L.headlines({ heists: 1, heistBest: 8000, rankName: 'Boss' }, { minute: 1300, district: 'MIDTOWN', heat: 4, rain: true });
assert.match(h[0].text, /vault/); assert.ok(h.some((x) => /Boss/.test(x.text)) && h.some((x) => /scanner/.test(x.text)) && h.some((x) => /Rain/.test(x.text)));
assert.ok(h.every((x, i) => i === 0 || h[i - 1].pri >= x.pri), 'sorted by priority');
assert.equal(L.headlines({}, { minute: 800 }).length, 0); assert.equal(typeof L.flavor(-3), 'string');
console.log('PASS: reactive news headlines');

const st = L.cleanState({}), now = { at: 1e12, minute: 1300, marketWindow: 9, marketText: '🪙 Whales are loading up on NightCoin' };
const t1 = L.texts(st, now); assert.deepEqual(t1.map((x) => x.from), ['vee', 'sam']);
assert.equal(L.texts(st, { ...now, at: now.at + 60000 }).length, 0, 'rate limited');
assert.equal(L.texts(st, { ...now, at: now.at + L.TEXT_GAP_MS, minute: 400, marketWindow: 9 })[0].from, 'coach');
for (const k of Object.keys(L.EVENT_TEXT)) assert.ok(L.CONTACTS[L.EVENT_TEXT[k][0][0]]);
const c = L.cleanState({ station: 'dock', radio: false, log: [{ from: 'rico', text: 'x', at: 5 }, { from: 'zed', text: 'y', at: 1 }], unread: 500, welcomed: true });
assert.equal(c.station, 'dock'); assert.equal(c.radio, false); assert.equal(c.log.length, 1); assert.equal(c.unread, 99); assert.equal(c.welcomed, true);
assert.equal(L.cleanState({ station: 'x' }).station, 'nfm');
console.log('PASS: contact tips and life save cleaning');
