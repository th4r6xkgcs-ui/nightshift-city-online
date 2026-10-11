'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../index.js');

test('serves only the allowlisted test page and shared scripts', async (t) => {
  const srv = createServer({ port: 0 });
  await srv.ready;
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.port}`;
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /Nightshift Online/);
  for (const f of ['rules', 'protocol', 'city', 'movement', 'net-client']) {
    const r = await fetch(`${base}/shared/${f}.js`);
    assert.equal(r.status, 200, f);
    assert.match(r.headers.get('content-type'), /javascript/);
  }
  assert.equal((await fetch(base + '/healthz')).status, 200);
  for (const bad of ['/sim.js', '/server/sim.js', '/../package.json', '/shared/../server/store.js', '/data/profiles.json', '/%2e%2e/server/sim.js']) {
    assert.equal((await fetch(base + bad)).status, 404, bad);
  }
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 404);
});

test('test page boots in a browser-like sandbox (shared scripts + inline script)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const html = fs.readFileSync(path.join(__dirname, '../public/play.html'), 'utf8');
  // Minimal DOM stand-ins: enough for the page's top-level setup code to run.
  const el = () => new Proxy(function () {}, { get: (t, k) => (k === 'style' || k === 'classList' || k === 'dataset' ? el() : k === 'getBoundingClientRect' ? () => ({ left: 0, top: 0, width: 100, height: 100 }) : k === 'getContext' ? () => el() : k === 'querySelector' ? () => el() : el()), set: () => true, apply: () => el() });
  const sandbox = {
    document: { getElementById: () => el() }, localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} },
    location: { protocol: 'http:', host: 'x' }, addEventListener() {}, requestAnimationFrame() {}, innerWidth: 800, innerHeight: 400, devicePixelRatio: 1,
    performance, setTimeout, clearTimeout, setInterval, clearInterval, Math, JSON, Date,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of ['rules', 'protocol', 'city', 'movement', 'net-client']) vm.runInContext(fs.readFileSync(path.join(__dirname, `../../shared/${f}.js`), 'utf8'), sandbox, { filename: f });
  assert.ok(sandbox.NightshiftRules && sandbox.NightshiftProtocol && sandbox.NightshiftCity && sandbox.NightshiftOnlineMovement && sandbox.NightshiftNet, 'shared scripts expose browser globals');
  assert.equal(sandbox.NightshiftMovement, undefined, 'does not clobber the client stamina global');
  assert.equal(sandbox.NightshiftCity.createCity().source, 'built-in');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
  assert.doesNotThrow(() => vm.runInContext(inline, sandbox, { filename: 'play.html' }));
});
