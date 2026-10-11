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
  for (const f of ['rules', 'protocol', 'city']) {
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
