const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('city-map.js','utf8'),c);const p=c.NightshiftMap.destinations([{x:100,y:100,w:200,h:100,name:'GARAGE'}]);assert.equal(p[0].x,200);assert.equal(p[0].y,222);assert.equal(p[0].label,'GARAGE');assert.equal(p.length,3);console.log('PASS: GPS service destinations point to accessible building entrances');

const run=require('./harness.cjs')();
assert.equal(run('NightshiftMap.navigate({x:880,y:680,label:"GOAL GPS",id:"goal"})'),true);
run('globalThis.labels=[];g.fillText=t=>labels.push(t);NightshiftMap.draw(100)');assert.ok(run('labels.includes("GOAL GPS")'));
assert.equal(run('NightshiftMap.navigate({x:NaN,y:680})'),false);assert.equal(run('NightshiftMap.navigate({x:99999,y:680})'),false);
run('labels=[];NightshiftMap.draw(100)');assert.ok(run('labels.includes("GOAL GPS")'),'invalid request preserves active route');
assert.equal(run('NightshiftMap.clear("goal")'),true,'destination id is preserved');
run('player.car=cars[0]');assert.equal(run('NightshiftMap.navigate({x:880,y:680,label:"DRIVE"})'),true);
