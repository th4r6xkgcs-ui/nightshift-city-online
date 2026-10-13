const assert=require('node:assert/strict'),boot=require('./harness.cjs'),run=boot();
assert.equal(run('NightshiftRenderQuality.display(390,844,3).ratio'),3);assert.equal(run('NightshiftRenderQuality.display(390,844,3).pixelWidth'),1170);
assert.ok(run('NightshiftRenderQuality.display(4000,3000,3).pixelWidth*NightshiftRenderQuality.display(4000,3000,3).pixelHeight')<=7500000);
assert.equal(run('NightshiftRenderQuality.display(NaN,0,NaN).pixelWidth'),1);
run('globalThis.before=JSON.stringify({player,cars,peds,buildings});globalThis.devicePixelRatio=3;resize();globalThis.frameBefore={w:W,h:H};drawWorld(1000)');
assert.equal(run('c.width'),1170);assert.equal(run('c.height'),2532);assert.equal(run('W'),390);assert.equal(run('H'),844);
assert.equal(run('JSON.stringify({player,cars,peds,buildings})'),run('before'));
console.log('PASS: capped high-density surface, pixel budget, invalid inputs, unchanged CSS coordinates and render state isolation');
