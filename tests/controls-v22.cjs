const assert=require('node:assert/strict'),boot=require('./harness.cjs');
const run=boot(),aim=run.nodes.get('#aimPad'),pad=run.nodes.get('#pad'),canvas=run.nodes.get('#game');
const e=(pointerId,x,y)=>({pointerId,clientX:x,clientY:y,button:0,pointerType:'touch'});
run('player.x=460;player.y=450;player.hp=100;player.heat=0;player.ammo=30;peds.length=0;cars.length=0;camera={x:0,y:0,zoom:1};nextShot=0');
aim.onpointerdown(e(1,68,68));run('update(100,1)');assert.equal(run('player.ammo'),30);
aim.onpointermove(e(1,116,66));run('update(116,1)');assert.equal(run('player.ammo'),29);assert.equal(run('player.angle'),0);
run('update(132,1)');assert.equal(run('player.ammo'),29);aim.events.pointerup(e(2,116,66));run('update(300,1)');assert.equal(run('player.ammo'),28);
aim.events.pointercancel(e(1,116,66));run('update(500,1)');assert.equal(run('player.ammo'),28);
run('NightshiftTouchLayout.set({autoFire:false})');aim.onpointerdown(e(3,66,116));run('update(700,1)');assert.equal(run('player.ammo'),28);assert.equal(run('player.angle'),Math.PI/2);run('releaseControls()');
// Mouse click projects through zoom, fires immediately, holds at the shared cadence and ignores right click.
run.context.performance.now=()=>1000;run('camera={x:400,y:400,zoom:2};nextShot=0;player.x=460;player.y=450');
canvas.events.pointerdown({...e(10,120,200),pointerType:'mouse'});assert.equal(run('player.angle'),Math.PI/2);assert.equal(run('player.ammo'),27);
canvas.events.pointerdown({...e(10,120,200),pointerType:'mouse'});assert.equal(run('player.ammo'),27);
run('update(1180,1)');assert.equal(run('player.ammo'),26);canvas.events.pointerup({...e(10,120,200),pointerType:'mouse'});assert.equal(run('firing'),false);
canvas.events.pointerdown({...e(10,120,200),pointerType:'mouse',button:2});assert.equal(run('firing'),false);assert.equal(run('player.ammo'),26);
// Empty magazine reloads from finite reserve when aim-fire is held.
run('NightshiftTouchLayout.set({autoFire:true});player.ammo=0;combatState.reserve=5;combatState.until=0;nextShot=0');aim.onpointerdown(e(4,116,66));run('update(2000,1)');assert.ok(run('combatState.until')>0);run('releaseControls();player.ammo=NightshiftCombat.finish(combatState,player.ammo,4000)');assert.equal(run('player.ammo'),5);assert.equal(run('combatState.reserve'),0);
// Full stick sprints, inner stick walks; opening MORE cancels held controls and searches.
run('player.x=460;player.y=450;NightshiftMovement.state.stamina=100;nextShot=0');pad.events.pointerdown(e(5,116,66));run('update(5000,1)');assert.ok(run('NightshiftMovement.state.stamina')<100);
const more=run.nodes.get('#actions').children.find(n=>n.id==='more');more.events.click();assert.equal(run('joy.x'),0);assert.equal(run('aimPointer'),null);const x=run('player.x');run('keys.d=true;frame(5500);interact();fire();reload()');assert.equal(run('player.x'),x);assert.equal(run('NightshiftInterface.expanded()'),true);more.events.click();run('releaseControls()');
run('NightshiftInterface.refresh()');assert.equal(run.nodes.get('#shoot').hidden,true);run('NightshiftTouchLayout.set({autoFire:false});NightshiftInterface.refresh()');assert.equal(run.nodes.get('#shoot').hidden,false);run('player.ammo=30;NightshiftInterface.refresh()');assert.equal(run.nodes.get('#reload').hidden,true);
console.log('PASS: aim deadzone/automatic/manual fire, shared mouse cadence/zoom/right-click, cancellation, finite auto-reload, stick sprint, tray pause and contextual controls');

// Independent pointer sources: releasing the mouse cannot release a held FIRE button.
run('NightshiftTouchLayout.set({autoFire:false});player.ammo=20;nextShot=0');run.context.performance.now=()=>6000;const fireButton=run.nodes.get('#shoot');fireButton.onpointerdown(e(20,0,0));canvas.events.pointerdown({...e(21,120,200),pointerType:'mouse'});canvas.events.pointerup({...e(99,120,200),pointerType:'mouse'});assert.equal(run('mouseFire'),true);canvas.events.pointerup({...e(21,120,200),pointerType:'mouse'});assert.equal(run('firing'),true);fireButton.events.pointerup(e(20,0,0));assert.equal(run('firing||mouseFire'),false);console.log('PASS: mouse/button fire ownership remains independent and unrelated releases are ignored');
