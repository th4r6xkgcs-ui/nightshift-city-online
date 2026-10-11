'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../sim.js');
const R = require('../../shared/rules.js');

function setup() {
  const w = new World();
  const a = w.addPlayer('a', 'Ana', 0), b = w.addPlayer('b', 'Ben', 0), c = w.addPlayer('c', 'Cy', 0);
  a.x = 700; a.y = 340; b.x = 800; b.y = 340; c.x = 2000; c.y = 1500; // c is far away
  return { w, a, b, c };
}
const chats = (w) => w.drain().filter((e) => e.msg.t === 'chat');

test('near chat reaches nearby players (and you), city chat reaches everyone', () => {
  const { w } = setup();
  assert.equal(w.handle('a', { t: 'chat', ch: 'near', text: 'hey' }, 0).ok, true);
  assert.deepEqual(chats(w).map((e) => e.to).sort(), ['a', 'b']);
  w.handle('a', { t: 'chat', ch: 'city', text: 'hello city' }, 2000);
  const got = chats(w);
  assert.deepEqual(got.map((e) => e.to).sort(), ['a', 'b', 'c']);
  assert.deepEqual(got[0].msg, { t: 'chat', from: 'a', name: 'Ana', ch: 'city', text: 'hello city' });
});

test('rate limited: a burst of 3, then about one per second', () => {
  const { w } = setup();
  const send = (now) => w.handle('a', { t: 'chat', ch: 'city', text: 'spam' }, now);
  assert.deepEqual([send(0).ok, send(0).ok, send(0).ok], [true, true, true]);
  assert.equal(send(0).reason, 'slow down');
  assert.equal(send(500).reason, 'slow down');
  assert.equal(send(1000).ok, true);
});

test('links, control characters and long text are cleaned; empty is refused', () => {
  const { w } = setup();
  w.handle('a', { t: 'chat', ch: 'city', text: 'free cash at https://scam.example/x\u0007 ok' }, 0);
  assert.equal(chats(w)[0].msg.text, 'free cash at [link] ok');
  w.handle('a', { t: 'chat', ch: 'city', text: 'x'.repeat(390) }, 2000);
  assert.equal(chats(w)[0].msg.text.length, R.chat.maxLen);
  assert.equal(w.handle('a', { t: 'chat', ch: 'city', text: '   ​ ' }, 4000).reason, 'empty message');
});

test('muting hides one player for you only; unmute restores', () => {
  const { w } = setup();
  assert.equal(w.handle('b', { t: 'mute', id: 'a', on: true }, 0).ok, true);
  w.handle('a', { t: 'chat', ch: 'city', text: 'hi' }, 0);
  assert.deepEqual(chats(w).map((e) => e.to).sort(), ['a', 'c']);
  w.handle('b', { t: 'mute', id: 'a', on: false }, 0);
  w.handle('a', { t: 'chat', ch: 'city', text: 'hi again' }, 2000);
  assert.ok(chats(w).some((e) => e.to === 'b'));
  assert.equal(w.handle('b', { t: 'mute', id: 'b', on: true }, 0).reason, 'no such player');
  assert.equal(w.handle('b', { t: 'mute', id: 'nobody', on: true }, 0).reason, 'no such player');
});

test('malformed chat is a strike', () => {
  const { w } = setup();
  for (const m of [{ t: 'chat', ch: 'world', text: 'x' }, { t: 'chat', ch: 'city', text: 5 }, { t: 'chat', ch: 'city', text: 'x'.repeat(500) }, { t: 'mute', id: 'a' }]) {
    assert.equal(w.handle('b', m, 0).strike, true, JSON.stringify(m));
  }
});
