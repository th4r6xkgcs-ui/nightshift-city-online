const assert=require('node:assert/strict'),boot=require('./harness.cjs'),run=boot();
run('globalThis.routineNpc={x:220,y:270,hp:40};globalThis.routineContext={cars:[],blocked:()=>false,world:{w:2200,h:1700},minute:720,rain:0}');
for(const [minute,activity] of [[60,'home'],[720,'work'],[1080,'shop'],[1260,'nightlife']])assert.equal(run(`NightshiftCitizenRoutines.plan(routineNpc,${minute},0,routineContext.world).activity`),activity);
assert.equal(run('NightshiftCitizenRoutines.plan(routineNpc,720,1,routineContext.world).activity'),'shelter');
run('for(let i=0;i<600;i++)NightshiftCitizens.step(routineNpc,i*17,1,routineContext)');assert.ok(run('routineNpc.x>220'));assert.equal(run('routineNpc.activity'),'work');
run('NightshiftCitizens.react(routineNpc,{x:100,y:270},11000);NightshiftCitizens.step(routineNpc,11001,1,routineContext)');assert.equal(run('routineNpc.mode'),'flee');
run('NightshiftCitizens.step(routineNpc,18000,1,routineContext)');assert.equal(run('routineNpc.mode'),'routine');assert.equal(run('routineNpc.routineInterrupted'),false);
run('routineContext.cars=[{x:routineNpc.x+30,y:routineNpc.y,angle:0}];globalThis.before={x:routineNpc.x,y:routineNpc.y};NightshiftCitizens.step(routineNpc,18017,1,routineContext)');assert.equal(run('routineNpc.x'),run('before.x'));
run('routineContext.cars=[];routineContext.minute=60;NightshiftCitizens.step(routineNpc,32000,1,routineContext)');assert.equal(run('routineNpc.activity'),'home');
const vm=require('node:vm'),fs=require('node:fs'),ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('traffic.js','utf8'),ctx);
const car={x:1,y:0,angle:0,route:[{x:0,y:0},{x:2,y:0},{x:2,y:2}],next:1,velocity:100};
assert.equal(ctx.NightshiftTraffic.moveSafely(car,.04,()=>true),false);assert.equal(car.next,1);assert.equal(car.x,1);assert.equal(car.angle,0);assert.equal(car.velocity,0);
console.log('PASS: daily destinations, rain shelter, movement, danger priority, routine recovery, vehicle avoidance and complete blocked-turn rollback');

const loop=ctx.NightshiftTraffic.roundRoute([{x:0,y:0},{x:440,y:0},{x:440,y:340},{x:0,y:340}]);assert.equal(loop.length,36);for(const p of loop)assert.ok(p.x>=0&&p.x<=440&&p.y>=0&&p.y<=340);assert.equal(new Set(loop.map(p=>p.x+':'+p.y)).size,36);
