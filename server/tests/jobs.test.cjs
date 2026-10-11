'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../sim.js');
const R = require('../../shared/rules.js');

// Deterministic "random" so routes are predictable in tests.
function seq(values) { let i = 0; return () => values[i++ % values.length]; }
function setup(randoms = [0, 0.99]) {
  const w = new World({ random: seq(randoms), pvpDefault: true });
  const a = w.addPlayer('a', 'Ana', 0);
  return { w, a, go: (p, pt) => { p.x = pt.x; p.y = pt.y; } };
}
const job = (w, action, tx, now = 0) => w.handle('a', { t: 'job', action, tx }, now);

test('full delivery: start, walk to pickup, carry parcel, deliver, get paid once', () => {
  const { w, a, go } = setup();
  const r = job(w, 'start', 'j1');
  assert.equal(r.ok, true);
  const { pickup, drop, reward } = r.job;
  const dist = Math.hypot(pickup.x - drop.x, pickup.y - drop.y);
  assert.ok(dist >= R.jobs.minDistancePx, 'dropoff is across town');
  assert.ok(reward >= R.jobs.basePay && reward <= R.jobs.maxPay);
  assert.equal(reward, Math.min(R.jobs.maxPay, Math.round(R.jobs.basePay + dist * R.jobs.payPerPx)));
  assert.equal(w.city.blocked(pickup.x, pickup.y), false, 'pickup reachable');
  assert.equal(w.city.blocked(drop.x, drop.y), false, 'dropoff reachable');

  assert.equal(job(w, 'pickup', 'j2').reason, 'not at pickup');
  assert.equal(job(w, 'deliver', 'j3').reason, 'pick up the parcel first');
  go(a, pickup);
  assert.equal(job(w, 'pickup', 'j4').ok, true);
  assert.equal(a.pocket.parcel, 1);
  assert.equal(job(w, 'deliver', 'j5').reason, 'not at dropoff');
  go(a, drop);
  const cash = a.cash;
  const d = job(w, 'deliver', 'j6');
  assert.deepEqual([d.ok, d.reward, d.deliveries], [true, reward, 1]);
  assert.equal(job(w, 'deliver', 'j6').replay, true, 'resent delivery is not paid twice');
  assert.equal(a.cash, cash + reward);
  assert.equal(a.pocket.parcel, undefined);
  assert.deepEqual(a.stats, { deliveries: 1, earned: reward });
  assert.equal(job(w, 'deliver', 'j7').reason, 'no job');
});

test('cooldown between jobs; one job at a time; cancel removes the parcel', () => {
  const { w, a, go } = setup();
  const r = job(w, 'start', 's1', 0);
  assert.equal(job(w, 'start', 's2', 0).reason, 'already on a job');
  go(a, r.job.pickup);
  job(w, 'pickup', 's3', 0);
  assert.equal(job(w, 'cancel', 's4', 1000).cancelled, true);
  assert.equal(a.pocket.parcel, undefined, 'cancelled parcel removed');
  const wait = job(w, 'start', 's5', 2000);
  assert.equal(wait.reason, 'next job soon');
  assert.equal(wait.waitMs, R.jobs.cancelCooldownMs - 1000);
  assert.equal(job(w, 'start', 's6', 1000 + R.jobs.cancelCooldownMs).ok, true);
});

test('jobs expire after the time limit', () => {
  const { w, a, go } = setup();
  const r = job(w, 'start', 'e1', 0);
  go(a, r.job.pickup);
  job(w, 'pickup', 'e2', 0);
  w.step(50, R.jobs.timeLimitMs);
  assert.equal(a.job, null);
  assert.equal(a.pocket.parcel, undefined);
  assert.ok(w.drain().some((e) => e.msg.kind === 'job' && e.msg.status === 'expired'));
});

test('dying fails the job and the parcel is not dropped for others', () => {
  const { w, a, go } = setup();
  const b = w.addPlayer('b', 'Ben', 0);
  const r = job(w, 'start', 'k1', 0);
  go(a, r.job.pickup);
  job(w, 'pickup', 'k2', 0);
  a.x = 700; a.y = 340; b.x = 600; b.y = 340;
  let now = 0;
  while (!a.deadUntil) { w.handle('b', { t: 'fire', aim: 0 }, now); now += 200; }
  assert.equal(a.job, null);
  const bag = [...w.bags.values()][0];
  assert.equal(bag.items.parcel, undefined);
  assert.ok(w.drain().some((e) => e.msg.kind === 'job' && e.msg.status === 'failed'));
});

test('a parcel from elsewhere cannot complete a delivery that was never picked up', () => {
  const { w, a, go } = setup();
  const r = job(w, 'start', 'x1', 0);
  a.pocket.parcel = 5; // e.g. looted junk
  go(a, r.job.drop);
  assert.equal(job(w, 'deliver', 'x2').reason, 'pick up the parcel first');
});

test('job and stats survive save/restore; tampered reward is recomputed; voided if parcel missing', () => {
  const { w, a, go } = setup();
  const r = job(w, 'start', 'p1', 0);
  go(a, r.job.pickup);
  job(w, 'pickup', 'p2', 0);
  const prof = w.exportProfile('a');
  const w2 = new World();
  const back = w2.addPlayer('z', 'Ana', 0, prof);
  assert.equal(back.job.stage, 'deliver');
  assert.equal(back.pocket.parcel, 1);
  const evil = structuredClone(prof); evil.job.reward = 999999;
  assert.equal(w2.addPlayer('e', 'Eve', 0, evil).job.reward, r.job.reward);
  const lost = structuredClone(prof); delete lost.pocket.parcel;
  assert.equal(w2.addPlayer('l', 'Lou', 0, lost).job, null);
  const garbage = structuredClone(prof); garbage.job = { stage: 'teleport' };
  assert.equal(w2.addPlayer('g', 'Gus', 0, garbage).job, null);
});

test('job info is private; bad job messages are strikes', () => {
  const { w, a } = setup();
  const b = w.addPlayer('b', 'Ben', 0); b.x = a.x + 10; b.y = a.y;
  job(w, 'start', 'v1', 0);
  assert.ok(w.snapshotFor('a').you.job);
  assert.equal(w.snapshotFor('b').others[0].job, undefined);
  for (const m of [{ t: 'job', action: 'steal', tx: 'x' }, { t: 'job', action: 'start' }]) {
    assert.equal(w.handle('a', m, 0).strike, true);
  }
});
