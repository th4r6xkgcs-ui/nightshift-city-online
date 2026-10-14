// v0.69 (Claude): screen-relative driving, NPC profiles/AI, car kits, HD art, multiplayer hit validation.
const assert = require('node:assert/strict');
const DI = require('../drive-input.js');
const PI = Math.PI;
// Car facing DOWN the screen (angle +90°). Pushing screen-RIGHT must turn toward screen-right (angle decreases toward 0).
let r = DI.screen(PI / 2, 4, 1, 0); assert.ok(r.thrust > 0 && r.steer < 0, 'facing down, push right -> turn toward right');
// Facing right, push down -> steer positive (angle grows toward +90).
r = DI.screen(0, 4, 0, 1); assert.ok(r.steer > 0 && r.thrust > 0);
// Straight ahead: full gas, no steer.
r = DI.screen(-PI / 2, 3, 0, -1); assert.ok(r.thrust === 1 && Math.abs(r.steer) < 1e-9);
// Pull against a moving car: brake, no steering.
r = DI.screen(0, 4, -1, 0); assert.ok(r.thrust < 0 && r.steer === 0, 'brake');
// Stopped and pulling back: reverse.
r = DI.screen(0, 0, -1, 0.2); assert.ok(r.thrust < 0, 'reverse');
// Dead zone.
assert.deepEqual(DI.screen(0, 3, 0.05, 0.05), { thrust: 0, steer: 0 });
// Classic mode is the old tank mapping.
assert.deepEqual(DI.classic(1, 1, 0.5, -1), { thrust: 1, steer: 0.5 });
// Simulate: a car facing down, stick held right, ends up heading right.
{ const car = { angle: PI / 2, speed: 3 }; for (let i = 0; i < 120; i++) { const m = DI.screen(car.angle, car.speed, 1, 0); car.angle += m.steer * 0.04 * (car.speed >= 0 ? 1 : -1); car.speed = Math.max(-2.6, Math.min(7, car.speed + m.thrust * 0.2)); } assert.ok(Math.abs(DI.wrap(car.angle)) < 0.15, 'converges on stick direction'); }
console.log('PASS: screen-relative driving (stick direction = travel direction, brake/reverse, classic fallback)');
{ const S = { ms: 0, backUntil: 0, steer: 1 }; let r; for (let t = 0; t <= 600; t += 50) r = DI.unstick(S, { thrust: 1, steer: 0.5 }, 0, 50, t); r = DI.unstick(S, { thrust: 1, steer: 0.5 }, 0, 50, 650); assert.ok(r.thrust < 0 && r.steer < 0, 'wedged -> backs out turning the other way'); assert.ok(DI.unstick(S, { thrust: 1, steer: 0.5 }, 0, 50, 2000).thrust > 0, 'then drives again');
  console.log('PASS: wedged car backs out automatically'); }
// ---------- NPC minds ----------
{
  const M = require('../npc-mind-data.js');
  // deterministic residents: same person for everyone, all districts, sane fields
  const a = M.resident('Harbor', 7), b = M.resident('Harbor', 7); assert.deepEqual(a, b);
  assert.notEqual(M.resident('Harbor', 8).id, a.id); assert.equal(a.id, 'harbor-7');
  const ids = new Set(); for (const d of M.DISTRICTS) for (let i = 0; i < M.PER_DISTRICT; i++) { const r = M.resident(d, i); ids.add(r.id); assert.ok(r.name && r.job && r.traits.length === 2 && r.traits[0] !== r.traits[1] && r.secret.text && r.secret.me, r.id); for (const k of ['bravery', 'gossip', 'temper', 'snitch', 'greed']) assert.ok(r[k] >= 0 && r[k] <= 1); assert.ok(!(r.traits.includes('brave') && r.traits.includes('timid'))); }
  assert.equal(ids.size, M.DISTRICTS.length * M.PER_DISTRICT);
  const names = new Set([...ids].map((id) => { const m = /^(.*)-(\d+)$/.exec(id); return M.resident(M.DISTRICTS.find((x) => x.toLowerCase().replace(/\s+/g, '-') === m[1]), +m[2]).name; })); assert.ok(names.size > 250, 'mostly unique names');
  // memory + opinion
  const s = M.fresh(), civ = { ...M.resident('Downtown', 1), gang: null, traits: ['chill', 'honest'] };
  assert.equal(M.remember(s, civ, 'saw-kill', 0), -30); assert.equal(M.remember(s, civ, 'saw-kill', 1000), 0, 'one gunfight = one memory'); M.remember(s, civ, 'saw-kill', 70000);
  assert.equal(M.opinion(s, civ.id), -60); assert.equal(M.band(-60).label, 'Hates you'); assert.equal(M.band(70).label, 'Fan');
  const gm = { ...M.resident('Downtown', 2), gang: 'kings', traits: ['shady', 'brave'] };
  assert.equal(M.remember(s, gm, 'saw-gangkill', 0, 'diablos'), 18, 'gang members like you dropping rivals'); assert.equal(M.remember(s, gm, 'saw-gangkill', 70000, 'kings'), -50, '...but not their own');
  // gossip spreads a strong opinion, diluted
  const l = { ...M.resident('Downtown', 3) }; const before = M.opinion(s, l.id); M.spread(s, civ, l, 0); assert.ok(M.opinion(s, l.id) < before && M.opinion(s, l.id) > -60); assert.equal(M.rec(s, l.id).mem.at(-1).k, 'heard');
  // reactions follow personality
  const brave = { ...civ, bravery: 0.9, traits: ['brave', 'nosy'], temper: 0.7, snitch: 0.2 }, timid = { ...civ, bravery: 0.1, traits: ['timid', 'chill'], temper: 0.1, snitch: 0.2 }, rat = { ...civ, bravery: 0.4, snitch: 0.9, traits: ['honest', 'paranoid'] };
  assert.equal(M.react(brave, { kind: 'shots', dist: 100, armed: false }), 'film'); assert.equal(M.react(timid, { kind: 'shots', dist: 100 }), 'flee'); assert.equal(M.react(rat, { kind: 'shots', dist: 300 }), 'call');
  assert.equal(M.react(timid, { kind: 'seen', op: 80 }), 'wave'); assert.equal(M.react(timid, { kind: 'seen', op: -80 }), 'flee'); assert.equal(M.react(brave, { kind: 'seen', op: -80, armed: false }), 'confront'); assert.equal(M.react(brave, { kind: 'seen', op: -80, armed: true }), 'flee');
  assert.equal(M.react({ ...gm, bravery: 0.7 }, { kind: 'kill', gangKill: true, gang: 'diablos', dist: 300 }, () => 0.1), 'cheer');
  // card + secrets
  const d = M.describe(civ, s, { hour: 22 }); assert.equal(d.band, 'Hates you'); assert.ok(d.memories[0] === 'Saw you kill someone' && d.secretLocked);
  assert.ok(!M.canSecret(30, 0) && M.canSecret(40, 0) && M.canSecret(25, 10), 'charisma lowers the bar');
  assert.ok(['secret', 'cash'].includes(M.intimidate({ ...timid, secret: { kind: 'stash' } }, true, () => 0.01)));
  assert.ok(['fight', 'refuse'].includes(M.intimidate({ ...brave, secret: { kind: 'love' } }, false, () => 0.99)));
  assert.ok(typeof M.rumor(civ, { wanted: 2 }) === 'string' && typeof M.smallTalk({ ...civ, job: 'nurse' }, () => 0) === 'string');
  assert.deepEqual(M.clean(JSON.parse(JSON.stringify(s))).ops[civ.id].o, -60);
  console.log('PASS: NPC minds (fixed residents, memory/opinion, gossip, personality reactions, secrets)');
}
// ---------- car style: kits + stance ----------
{
  const SD = require('../carstyle-data.js');
  assert.ok(SD.KEYS.includes('kit') && SD.KEYS.includes('stance'));
  const s = SD.clean({ cars: { 'car-1': { kit: 'wide', stance: 'slammed', rims: 'bronze' } } });
  assert.equal(s.cars['car-1'].kit, 'wide'); assert.equal(s.cars['car-1'].stance, 'slammed'); assert.equal(s.cars['car-1'].rims, 'bronze');
  assert.equal(SD.clean({ cars: { 'car-1': { kit: 'rocket' } } }).cars['car-1'].kit, 'stock', 'unknown kit -> stock');
  const w = { cash: 10000 }, r = SD.apply(s, w, 'car-2', { ...SD.DEFAULT, kit: 'wide', stance: 'lowered' }); assert.ok(r.ok && r.price === 4800 + 800 && w.cash === 10000 - 5600);
  assert.ok(SD.flair(SD.cleanStyle({ kit: 'wide' })) > SD.flair(SD.DEFAULT));
  // old saves (no kit/stance) still load with defaults
  assert.equal(SD.clean({ cars: { 'car-3': { rims: 'gold' } } }).cars['car-3'].stance, 'stock');
  console.log('PASS: car style body kits + stance (prices, save cleaning, old saves)');
}
