// Ten simulated minutes: navigation, physical followers and saved-state bounds.
const assert=require('node:assert/strict'),boot=require('./harness.cjs'),storage=new Map(),run=boot(storage,{now:1000});
run('NightshiftGangLife.state.member="custom";NightshiftGangLife.state.name="Soak Crew";NightshiftCrewOps.state.owner="custom";NightshiftCrewOps.state.roster.nico={loyalty:60,order:"follow"};NightshiftCrewOps.state.roster.rae={loyalty:60,order:"follow"};NightshiftCrewOps.state.roster.ash={loyalty:60,order:"hold"};player.x=440;player.y=340;player.angle=0;player.moveAngle=0;player.car=null;peds.length=0;');
run('for(let i=0;i<36000;i++){testNow=1000+i*1000/60;NightshiftCrewOps.tick(i*1000/60,1);if(i%600===0)NightshiftCrewOps.save()}');
assert.equal(run('NightshiftCrewOps.entries().length'),3);assert.equal(run('NightshiftCrewOps.entries().every(e=>Number.isFinite(e.entity.x)&&Number.isFinite(e.entity.y)&&!blocked(e.entity.x,e.entity.y))'),true);
assert.ok(run('Math.hypot(NightshiftCrewOps.entries()[0].entity.x-player.x,NightshiftCrewOps.entries()[0].entity.y-player.y)')<100);
assert.equal(run('NightshiftCrewOps.state.roster.nico.loyalty'),60);assert.ok(storage.get('nightshift-city-crew-ops-v1').length<1500);
run('globalThis.carWaitBefore=JSON.stringify(NightshiftCrewOps.entries().map(e=>({x:e.entity.x,y:e.entity.y})));player.car=cars[0];for(let i=0;i<600;i++)NightshiftCrewOps.tick(700000+i*17,1)');assert.equal(run('JSON.stringify(NightshiftCrewOps.entries().map(e=>({x:e.entity.x,y:e.entity.y})))'),run('carWaitBefore'));
console.log('PASS: ten-minute follower navigation soak, stable roster/loyalty/save size, safe arrival and driving hold');
