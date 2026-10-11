'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createCity, builtInLayout, loadLayout } = require('../../shared/city.js');
const R = require('../../shared/rules.js');

const clientCatalog = path.join(__dirname, '../../city-data.js');
const plain = (v) => JSON.parse(JSON.stringify(v));

test('built-in layout equals client city-data.js layout() v1 (drift guard)', (t) => {
  if (!fs.existsSync(clientCatalog)) return t.skip('client city-data.js not on this branch yet');
  const theirs = require(clientCatalog).layout();
  assert.deepEqual(plain(builtInLayout()), plain(theirs));
  assert.equal(loadLayout().source, 'city-data.js', 'server uses the client catalog when present');
});

test('server rules agree with the layout', () => {
  const city = createCity();
  assert.equal(city.width, R.world.w);
  assert.equal(city.height, R.world.h);
  assert.deepEqual(city.spawn, R.spawn);
});

test('layout sanity: spawn, hospital and entrances are walkable, a shop exists', () => {
  const city = createCity(builtInLayout());
  assert.equal(city.buildings.length, 16);
  assert.ok(city.shops.length >= 1);
  assert.equal(city.blocked(R.spawn.x, R.spawn.y), false);
  assert.equal(city.blocked(R.hospital.x, R.hospital.y), false);
  for (const b of city.buildings) assert.equal(city.blocked(b.entrance.x, b.entrance.y), false, b.id + ' entrance reachable');
  const b = city.buildings[0];
  assert.equal(city.blocked(b.x + 5, b.y + 5), true);
});

test('rayHit finds the nearest wall and misses open road', () => {
  const city = createCity(builtInLayout());
  const b = city.buildings[0];
  const y = b.y + b.h / 2;
  assert.equal(city.rayHit(b.x - 50, y, 1, 0, 500), 50);
  assert.equal(city.rayHit(b.x - 50, y, -1, 0, 30), Infinity);
  assert.equal(city.rayHit(b.x - 50, b.y - 30, 1, 0, 1000), Infinity, 'road above building row is clear');
});

test('unknown layout version is refused', () => {
  assert.throws(() => createCity({ version: 2, buildings: [] }), /version/);
});
