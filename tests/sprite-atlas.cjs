const assert=require('node:assert/strict'),boot=require('./harness.cjs');const run=boot();
run('globalThis.o=NightshiftWardrobeData.cleanOutfit(NightshiftWardrobeData.DEFAULT);globalThis.a=NightshiftCharacters.frame(o,2,"walk",0);globalThis.b=NightshiftCharacters.frame(o,2,"walk",NightshiftCharacters.ANIMS.walk)');
assert.equal(run('a===b'),true);assert.equal(run('a.width'),176);assert.equal(run('a.height'),224);
run('NightshiftWardrobe.outfit();globalThis.testWardrobeSnapshot=JSON.stringify(NightshiftWardrobe.state);globalThis.testGameplaySnapshot=JSON.stringify({player,cars,peds});for(let d=0;d<8;d++)for(let f=0;f<8;f++)NightshiftCharacters.frame(o,d,"walk",f);NightshiftCharacters.frame(o,0,"idle",NaN);NightshiftCharacters.frame(o,0,"walk",-1);NightshiftCharacters.frame(o,0,"crouch",0);NightshiftSprites.person(player,true,{weapon:false})');
assert.equal(run('JSON.stringify(NightshiftWardrobe.state)===testWardrobeSnapshot'),true);assert.equal(run('JSON.stringify({player,cars,peds})===testGameplaySnapshot'),true);
run('for(let i=0;i<160;i++){const v=NightshiftWardrobeData.npcOutfit(i);NightshiftCharacters.frame(v,i%8,"walk",i%8,i%2?6:2)}');
assert.ok(run('NightshiftPremiumArt.stats().count')<=128);assert.ok(run('NightshiftPremiumArt.stats().bytes')<=24*1024*1024);
assert.ok(run('NightshiftPremiumArt.stats().hits')>0);assert.equal(run('NightshiftCharacters.frame(o,2,"idle",0,6).width'),264);
console.log('PASS: shared character frame reuse, direction/animation normalization, close-up dimensions, bounded 24 MiB cache and no gameplay/wardrobe mutations');
