'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createCity, createBuildings } = require('../../shared/city.js');
const R = require('../../shared/rules.js');

// Loads a client script (world.js / city-map.js) in a sandbox without a DOM.
function loadClient(file) {
  const src = path.join(__dirname, '../..', file);
  if (!fs.existsSync(src)) return null;
  const sandbox = { globalThis: null };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(src, 'utf8'), sandbox, { filename: file });
  return sandbox;
}

test('shared city matches client world.js exactly (drift guard)', (t) => {
  const client = loadClient('world.js');
  if (!client?.NightshiftWorld?.createBuildings) return t.skip('client world.js not on this branch yet');
  const theirs = JSON.parse(JSON.stringify(client.NightshiftWorld.createBuildings(R.world.w, R.world.h).map(({ x, y, w, h, name }) => ({ x, y, w, h, name }))));
  assert.deepEqual(createBuildings(R.world.w, R.world.h), theirs);
});

test('shared doors match client city-map.js destinations (drift guard)', (t) => {
  const client = loadClient('city-map.js');
  if (!client?.NightshiftMap?.destinations) return t.skip('client city-map.js not on this branch yet');
  const city = createCity();
  const theirs = client.NightshiftMap.destinations(city.buildings).filter((d) => d.id.startsWith('building-'));
  assert.deepEqual(city.doors, theirs.map(({ id, label, x, y }) => ({ id, label, x, y })));
});

test('layout sanity: spawn and hospital are walkable, shops exist', () => {
  const city = createCity();
  assert.equal(city.buildings.length, 16);
  assert.ok(city.shops.length >= 1);
  assert.equal(city.blocked(R.spawn.x, R.spawn.y), false);
  assert.equal(city.blocked(R.hospital.x, R.hospital.y), false);
  for (const d of city.doors) assert.equal(city.blocked(d.x, d.y), false, d.id + ' door is reachable');
  const b = city.buildings[0];
  assert.equal(city.blocked(b.x + 5, b.y + 5), true);
});

test('rayHit finds the nearest wall and misses open road', () => {
  const city = createCity();
  const b = city.buildings[0];
  const y = b.y + b.h / 2;
  assert.equal(city.rayHit(b.x - 50, y, 1, 0, 500), 50);
  assert.equal(city.rayHit(b.x - 50, y, -1, 0, 30), Infinity);
  assert.equal(city.rayHit(b.x - 50, b.y - 30, 1, 0, 1000), Infinity, 'road above building row is clear');
});
