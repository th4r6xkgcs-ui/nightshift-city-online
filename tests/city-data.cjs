const assert=require('node:assert/strict'),{layout}=require('../city-data.js'),boot=require('./harness.cjs');
const data=layout(),run=boot();const client=JSON.parse(run('JSON.stringify(buildings)'));
assert.equal(data.buildings.length,client.length);assert.equal(new Set(data.buildings.map(b=>b.id)).size,client.length);
for(let i=0;i<client.length;i++){const b=data.buildings[i],c=client[i];for(const k of ['x','y','w','h','name'])assert.equal(b[k],c[k]);assert.equal(run(`blocked(${b.x-8},${b.y+20})`),true);assert.equal(run(`blocked(${b.entrance.x},${b.entrance.y})`),false)}
assert.equal(data.width,run('world.w'));assert.equal(data.height,run('world.h'));assert.equal(run(`blocked(${data.spawn.x},${data.spawn.y})`),false);assert.equal(run(`NightshiftSafeZones.protected({x:${data.clinic.x},y:${data.clinic.y},heat:0})`),true);
data.buildings[0].x=99999;assert.notEqual(layout().buildings[0].x,99999);
console.log('PASS: Node/browser city catalog agrees with live geometry, clear entrances/spawn, stable IDs and fresh snapshots');
