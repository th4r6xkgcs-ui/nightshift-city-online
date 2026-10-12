const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});try{
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true,isMobile:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('nightshift-weapons-v1',JSON.stringify({version:1}));localStorage.setItem('nightshift-guide-v1',JSON.stringify({done:true}))});await page.goto('http://127.0.0.1:8080/?notour');await page.waitForFunction(()=>globalThis.NightshiftLife?.spawned());
 const dir=path.resolve(process.argv[2]||'.');fs.mkdirSync(dir,{recursive:true});
 const adoption=await page.evaluate(()=>{NightshiftHome.leave();player.x=1470;player.y=1010;player.cash=80000;NightshiftEnvironment.state.minute=720;const r=NightshiftPets.adopt('husky');NightshiftPets.save();releaseControls();return {r,active:NightshiftPets.state.active}});assert.equal(adoption.r.ok,true,JSON.stringify(adoption));assert.equal(adoption.active,'husky');
 await page.waitForTimeout(8000);await page.screenshot({path:path.join(dir,'v055-detailed-city.png')});
 // Both secondary maps exercise the shared people, weapon and pet drawing contracts.
 const zoneIds=await page.evaluate(()=>Object.keys(NightshiftZones.zones()));
 assert.ok(zoneIds.includes('farm')&&zoneIds.includes('suburbs'));
 for(const id of ['farm','suburbs']){await page.evaluate(id=>{NightshiftZones.leave();NightshiftHome.leave();NightshiftZones.enter(id)},id);await page.waitForTimeout(2800);assert.equal(await page.evaluate(()=>NightshiftZones.active()),id);await page.screenshot({path:path.join(dir,'v055-'+id+'.png')});}
 await page.evaluate(()=>{NightshiftZones.leave();NightshiftHome.enter('home',{x:252,y:172})});await page.waitForTimeout(3000);await page.screenshot({path:path.join(dir,'v055-apartment.png')});
 const home=await page.evaluate(()=>NightshiftHome.kind());assert.equal(home,'home');assert.deepEqual(errors,[]);
 console.log('PASS: detailed city with equipped gun/pet, countryside, suburb travel, apartment rendering, zone return and zero page errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
