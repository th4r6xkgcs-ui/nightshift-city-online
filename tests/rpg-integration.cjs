const assert=require('node:assert/strict'),boot=require('./harness.cjs');
const storage=new Map(),run=boot(storage,{now:10000});
for(const name of ['Skills','Goals','Weapons','Casino','Tuning','Races','HomeUpgrades','SkillEffects','Respect','Fishing','Lab','Jobs'])assert.equal(run(`typeof Nightshift${name}`),'object',name+' loads in actual HTML');
assert.ok(run('NightshiftSkillEffects.installed.length')>=8);
run('NightshiftSkills.open();globalThis.start=JSON.stringify({x:player.x,y:player.y,ammo:player.ammo,cash:player.cash});keys.w=true;fire(10000);reload();interact();frame(10000)');
assert.equal(run('NightshiftRPG.paused()'),true);assert.equal(run('JSON.stringify({x:player.x,y:player.y,ammo:player.ammo,cash:player.cash})===start'),true,'skill menu blocks gameplay');
run('document.querySelector("#skPanel").hidden=true;NightshiftGoals.open();frame(11000)');assert.equal(run('NightshiftRPG.paused()'),true);run('document.querySelector("#glPanel").hidden=true');
assert.equal(run('NightshiftRPG.paused()'),false);
run('for(const goal of NightshiftGoalsData.GOALS)if(goal.id!=="walk")NightshiftGoals.state.done[goal.id]=0;NightshiftSkills.gain("shooting",200,"integration");NightshiftGoals.state.stats.walked=500');
for(const timer of run.intervals.filter(t=>t.ms===1000||t.ms===3000))timer.fn();
assert.ok(storage.has('nightshift-skills-v1'));assert.ok(storage.has('nightshift-goals-v1'));
assert.ok(run('NightshiftGoals.state.done.walk')>=0);
const cash=run('player.cash');for(const timer of run.intervals.filter(t=>t.ms===1000))timer.fn();assert.equal(run('player.cash'),cash,'completed goal never repays');
const restored=boot(storage,{now:11000});assert.equal(restored('NightshiftSkills.state.xp.shooting'),run('NightshiftSkills.state.xp.shooting'));assert.ok(restored('NightshiftGoals.state.done.walk')>=0);
for(const k of ['skills','goals','weapons','casino','tuning','races','home'])assert.ok(run(`NightshiftBackups.KEYS.includes("nightshift-${k}-v1")`));
run('globalThis.before=player.ammo;player.x=700;player.y=680;player.angle=0;nextShot=0;fire(20000)');run.flushMicrotasks();assert.equal(run('player.ammo'),run('before')-1,'RPG firing preserves loaded magazine contract');
console.log('PASS: combined HTML startup, modal guards, installed effects, skill/goal save reload, goal reward once, backup keys and loaded-magazine shot');

for(const k of ['respect','fishing','lab','jobs'])assert.ok(run('NightshiftBackups.KEYS.includes("nightshift-'+k+'-v1")'));
run('NightshiftJobs.open();globalThis.jobStart=JSON.stringify({x:player.x,y:player.y,ammo:player.ammo});keys.w=true;fire(30000);frame(30000)');assert.equal(run('NightshiftRPG.paused()'),true);assert.equal(run('JSON.stringify({x:player.x,y:player.y,ammo:player.ammo})'),run('jobStart'));run('NightshiftJobs.close()');assert.equal(run('NightshiftRPG.paused()'),false);

for(const name of ['Fishing','Lab']){run('Nightshift'+name+'.open();globalThis.activityStart=JSON.stringify({x:player.x,y:player.y,ammo:player.ammo});keys.w=true;fire(40000);frame(40000)');assert.equal(run('NightshiftRPG.paused()'),true);assert.equal(run('JSON.stringify({x:player.x,y:player.y,ammo:player.ammo})'),run('activityStart'));run('Nightshift'+name+'.close()')}
