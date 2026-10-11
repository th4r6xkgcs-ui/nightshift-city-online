// Actual city navigation followed by contextual USE, without teleporting the escort.
const assert=require('node:assert/strict'),boot=require('./harness.cjs'),run=boot(new Map(),{now:1000});
run('player.x=720;player.y=1080;player.cash=1000;player.heat=0;player.car=null;peds.length=0;NightshiftCrews.state.crews.south.rep=20;NightshiftGangLife.open("south-recruiter");NightshiftGangLife.perform({action:"join"});NightshiftCrewOps.perform({action:"recruit",id:"nico"});NightshiftCrewOps.perform({action:"job",district:"south"});');
run('for(let i=0;i<2700;i++){testNow=Math.floor(1000+i*1000/60);if(player.x>440){player.x=Math.max(440,player.x-3);player.moveAngle=Math.PI}else if(player.y>340){player.y=Math.max(340,player.y-3);player.moveAngle=-Math.PI/2}NightshiftCrewOps.tick(i*1000/60,1)}');
assert.ok(run('Math.hypot(NightshiftCrewOps.entries()[0].entity.x-440,NightshiftCrewOps.entries()[0].entity.y-340)')<65);assert.equal(run('NightshiftInteractions.nearby().kind'),'crew-job');
const before=run('player.cash');run('interact()');assert.equal(run('player.cash'),before+180);assert.equal(run('NightshiftCrewOps.state.completed'),1);run('interact()');assert.equal(run('NightshiftCrewOps.state.completed'),1);
console.log('PASS: physical city escort from contact to clinic, shared-location contextual handoff and reward once');
