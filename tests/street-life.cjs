const assert=require('node:assert/strict'),boot=require('./harness.cjs'),run=boot();
assert.equal(run('NightshiftStreetLife.crossingWait({x:100,y:100},{x:101,y:100},[{x:160,y:100,angle:Math.PI,velocity:60}])'),true);
assert.equal(run('NightshiftStreetLife.crossingWait({x:100,y:100},{x:101,y:100},[{x:160,y:100,angle:0,velocity:60}])'),false);
assert.equal(run('NightshiftStreetLife.crossingWait({x:100,y:100},{x:101,y:100},[{x:160,y:100,angle:Math.PI,velocity:0}])'),false);
run('globalThis.socialNpc={x:200,y:270,hp:40,mode:"routine",activity:"shop"};globalThis.socialContext={peds:[socialNpc,{x:230,y:270,hp:40,mode:"routine",moving:false}]}');
assert.equal(run('NightshiftStreetLife.socialize(socialNpc,100,socialContext)'),true);assert.equal(run('socialNpc.socialUntil'),1900);
run('NightshiftCitizens.react(socialNpc,{x:100,y:100},200)');assert.equal(run('socialNpc.socialUntil'),0);assert.equal(run('NightshiftStreetLife.socialize(socialNpc,7000,socialContext)'),false);
assert.equal(run('NightshiftCitizenRoutines.plan(socialNpc,720,0,world,7000).activity'),'shelter');assert.equal(run('NightshiftCitizenRoutines.plan(socialNpc,720,0,world,21000).activity'),'work');
run('globalThis.artState=JSON.stringify({buildings,player,cars,peds});NightshiftWorld.cafeActors(buildings,{x:0,y:0,width:2200,height:1700,zoom:1}).forEach(e=>NightshiftWorld.cafeCanopy(e.entity));');assert.equal(run('JSON.stringify({buildings,player,cars,peds})'),run('artState'));
run('NightshiftDailies.open()');assert.equal(run('NightshiftRPG.paused()'),true);run('NightshiftDailies.close()');
assert.ok(run('NightshiftBackups.KEYS.includes("nightshift-dailies-v1")'));
console.log('PASS: approaching/receding/stopped traffic, conversations, disturbance memory expiry, cosmetic art isolation and daily modal/backup integration');

assert.equal(run('NightshiftStreetLife.crossingWait({x:507,y:340},{x:506,y:340},[],10000)'),true);assert.equal(run('NightshiftStreetLife.crossingWait({x:507,y:340},{x:506,y:340},[],1000)'),false);assert.equal(run('NightshiftStreetLife.crossingWait({x:505,y:340},{x:504,y:340},[],10000)'),false);
