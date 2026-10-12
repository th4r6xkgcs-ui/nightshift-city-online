const assert=require('node:assert/strict'),boot=require('./harness.cjs'),run=boot();
run('globalThis.calls=[];g.fillRect=(...a)=>calls.push([g.fillStyle,...a]);globalThis.before=JSON.stringify({player,cars,peds,buildings});');
for(const name of ['APARTMENTS','DINER','WAREHOUSE','GARAGE','CLUB','CORNER SHOP','CLOTHING']){
 const draw=t=>run(`calls=[];NightshiftWorld.ambient(g,{x:80,y:75,w:240,h:170,name:${JSON.stringify(name)}},${t},.8);JSON.stringify(calls)`);
 const first=draw(0);assert.equal(draw(0),first,'repeatable animation');assert.notEqual(draw(2),first,name+' animates');
 assert.ok(run('calls.length<40'),'bounded draw budget');assert.ok(run('calls.every(c=>c.slice(1).every(Number.isFinite))'));
}
assert.equal(run('JSON.stringify({player,cars,peds,buildings})===before'),true,'art cannot change simulation');
run('calls=[];NightshiftWorld.ground(g,2200,1700)');
// Inspect the final fill at each old curb across a representative intersection.
for(const [x,y] of [[440,277],[440,402],[377,340],[503,340]]){
 const color=run(`calls.filter(c=>${x}>=c[1]&&${x}<c[1]+c[3]&&${y}>=c[2]&&${y}<c[2]+c[4]).at(-1)?.[0]`);
 assert.equal(color,'#273443','junction is continuous asphalt');
}
const input={x:1100,y:850,speed:0,width:390,height:844,world:{w:2200,h:1700}};
const step=(state,input,dt)=>JSON.parse(run(`JSON.stringify(NightshiftCamera.step(${JSON.stringify(state)},${JSON.stringify(input)},${dt}))`));
const initial=step({},input,0),moved=step(initial,{...input,x:1120},1/60);
assert.ok(moved.focusX>1100&&moved.focusX<1120,'walking motion eased');
for(const fps of [30,60,120]){let c=initial;for(let i=0;i<fps;i++)c=step(c,{...input,x:1120},1/fps);assert.ok(Math.abs(c.focusX-(1120-20*Math.exp(-12)))<1e-8,'follow FPS equivalence');}
assert.equal(step(moved,{...input,x:1700},1/60).focusX,1700,'teleport snaps');
const edge=step(moved,{...input,x:2200,y:1700,width:844,height:390},0);assert.ok(edge.x+844/edge.zoom<=2200+1e-8);assert.ok(edge.y+390/edge.zoom<=1700+1e-8);
run('drawWorld(100);globalThis.writes=0;globalThis.markup=document.querySelector("#hud").innerHTML;Object.defineProperty(document.querySelector("#hud"),"innerHTML",{get(){return markup},set(v){writes++;markup=v}});drawWorld(116)');
assert.equal(run('writes'),0,'unchanged HUD avoids DOM reconstruction');run('player.cash++;drawWorld(132)');assert.equal(run('writes'),1);
console.log('PASS: bounded deterministic ambient art, clear junctions, gameplay isolation, smooth follow/FPS equivalence, teleport/rotation bounds and stable HUD updates');
