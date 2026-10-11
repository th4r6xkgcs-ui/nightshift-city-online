const assert=require('node:assert/strict'),boot=require('./harness.cjs');
const run=boot();
run('globalThis.view={x:0,y:0,width:390,height:844,zoom:1};globalThis.trees=NightshiftWorld.treeActors(view);globalThis.palms=NightshiftWorld.palmActors(view)');
assert.ok(run('trees.length')>0);
assert.ok(run('trees.every(e=>e.kind==="tree-crown"&&Number.isFinite(e.entity.y))'));
assert.equal(run('NightshiftWorld.treeActors({x:0,y:0,width:390,height:844,zoom:0}).length'),0);
assert.equal(run('NightshiftWorld.treeActors({x:NaN,y:0,width:390,height:844,zoom:1}).length'),0);
run('globalThis.one=trees[0];globalThis.actor={entity:{x:one.entity.x,y:one.entity.y-1},kind:"ped"};globalThis.front={entity:{x:one.entity.x,y:one.entity.y+1},kind:"ped"}');
assert.equal(run('NightshiftScene.order([one,actor,front],view).map(e=>e.kind).join(",")'),'ped,tree-crown,ped');
run('globalThis.before=JSON.stringify({player,cars,peds,buildings});NightshiftWorld.treeCrown(trees[0].entity)');
assert.equal(run('JSON.stringify({player,cars,peds,buildings})===before'),true);
console.log('PASS: cached street tree canopy depth ordering, view culling and state isolation');

run('globalThis.allTrees=NightshiftWorld.treeActors({x:0,y:0,width:2200,height:1700,zoom:1})');
assert.equal(run('allTrees.some(t=>buildings.some(b=>t.entity.x-5<b.x+b.w&&t.entity.x+32>b.x&&t.entity.y-32<b.y+b.h&&t.entity.y+7>b.y))'),false,'tree crowns must not cover building roofs');
