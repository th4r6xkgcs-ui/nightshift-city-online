const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),boot=require('./harness.cjs');const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('vehicle-geometry.js','utf8'),ctx);const geo=ctx.NightshiftVehicleGeometry;
assert.equal(geo.carOverlap({x:100,y:100,angle:0},{x:100,y:137,angle:Math.PI}),false);
assert.equal(geo.carOverlap({x:100,y:100,angle:0},{x:145,y:100,angle:0}),true);
assert.equal(geo.circleOverlap({x:100,y:129},{x:100,y:100,angle:0}),false);
assert.equal(geo.circleOverlap({x:100,y:124},{x:100,y:100,angle:0}),true);
const world={w:500,h:500},wall=[{x:200,y:190,w:20,h:80}];
assert.equal(geo.canTravel({x:100,y:220,angle:0},{x:300,y:220,angle:0},wall,[],world),false);
assert.equal(geo.canTravel({x:100,y:100,angle:0},{x:300,y:100,angle:0},wall,[],world),true);
assert.equal(geo.canTravel({x:100,y:100,angle:0},{x:300,y:100,angle:0},[],[{x:200,y:100,angle:0}],world),false);
// Thin wall crossing the middle of the car body is missed by corner-only checks.
assert.equal(geo.blocked({x:100,y:100,angle:0},[{x:98,y:95,w:4,h:10}],world),true);
assert.equal(geo.blocked({x:24,y:100,angle:0},[],world),true);
assert.equal(geo.blocked({x:32,y:100,angle:Math.PI/4},[],world),true);
assert.equal(geo.canTravel({x:165,y:220,angle:Math.PI/2},{x:165,y:220,angle:0},wall,[],world),false);
assert.equal(geo.canTravel({x:150,y:220,angle:Math.PI/2},{x:150,y:220,angle:0},wall,[],world),true);
assert.equal(geo.canTravel({x:100,y:100,angle:0},{x:Infinity,y:100,angle:0},[],[],world),false);
const run=boot();assert.equal(run('cars.every(c=>!NightshiftVehicleGeometry.blocked(c,buildings,world))'),true);
run('peds.length=0;NightshiftTraffic.actors.length=0;player.car=cars[0];cars.splice(1);Object.assign(player.car,{x:440,y:340,angle:0,speed:0});cars.push({x:440,y:377,angle:0,speed:0});keys.w=true');for(let i=0;i<20;i++)run(`update(${i*1000/60},1)`);assert.ok(run('player.car.x')>445);
console.log('PASS: full vehicle footprints, parallel parking clearance, swept wall/car collisions, safe exit circles and valid bootstrap poses');
