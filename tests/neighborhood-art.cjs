const assert=require('node:assert/strict'),boot=require('./harness.cjs'),run=boot(new Map());
for(const [x,y,name] of [[879,1019,'west'],[880,1019,'midtown'],[1319,1020,'south'],[1320,1020,'docks']])assert.equal(run(`NightshiftWorld.districtStyle(${x},${y})`),name);
run('globalThis.before=JSON.stringify({player,cars,peds,buildings});globalThis.calls=[];g.fillRect=(...args)=>calls.push([g.fillStyle,...args]);camera.x=0;camera.y=0;camera.zoom=.1');
const drawings=[];
for(const [x,y] of [[520,755],[960,755],[520,1095],[1840,1435]]){
 const render=`calls=[];NightshiftWorld.building({x:${x},y:${y},w:240,h:170,name:'APARTMENTS'});JSON.stringify(calls.map(c=>[c[0],c[1]-${x},c[2]-${y},c[3],c[4]]))`;
 const first=run(render);assert.equal(run(render),first);drawings.push(first);
}
assert.equal(new Set(drawings).size,4,'district architecture differs');
run('NightshiftWorld.ground(g,2200,1700)');assert.equal(run('JSON.stringify({player,cars,peds,buildings})===before'),true);
assert.ok(run('calls.every(c=>c.slice(1).every(Number.isFinite))'));
console.log('PASS: district boundary classification, distinct stable architecture, finite ground art and unchanged gameplay state');
