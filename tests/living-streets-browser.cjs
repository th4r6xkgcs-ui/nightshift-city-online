/* Optional real Chromium layout/render check. BROWSER_CHANNEL=msedge uses installed Edge. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
  const response=await page.goto('http://127.0.0.1:8080/?notour');assert.equal(response.status(),200);
  await page.waitForFunction(()=>globalThis.NightshiftInterface&&typeof player!=='undefined'&&document.querySelector('#map').textContent.includes('v0.55'));
  await page.waitForFunction(()=>NightshiftLife.spawned());await page.evaluate(()=>{NightshiftHome.leave();releaseControls()});await page.waitForTimeout(200);
  // Verify independent simultaneous touch IDs and their cancellation in the actual DOM.
  const cdp=await page.context().newCDPSession(page),pad=await page.locator('#pad').boundingBox(),aim=await page.locator('#aimPad').boundingBox();
  const touches=[{id:71,x:pad.x+pad.width/2+20,y:pad.y+pad.height/2},{id:72,x:aim.x+aim.width/2+12,y:aim.y+aim.height/2}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});
  assert.ok(await page.evaluate(()=>movePointer!==null&&aimPointer!==null&&movePointer!==aimPointer),'independent simultaneous touches');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.ok(await page.evaluate(()=>movePointer===null&&aimPointer===null&&joy.x===0&&joy.y===0),'both cancelled');
  await page.evaluate(()=>{player.x=880;player.y=680;player.heat=0;NightshiftEnvironment.state.minute=720;releaseControls()});
  const x=await page.evaluate(()=>player.x);await page.keyboard.down('d');await page.waitForTimeout(250);await page.keyboard.up('d');assert.ok(await page.evaluate(()=>player.x)>x,'walking still works');
  const dir=process.argv[2];if(dir)fs.mkdirSync(dir,{recursive:true});
  const boxes=()=>page.evaluate(()=>Object.fromEntries(['#nsL','#nsR','#pad','#aimPad','#actions'].filter(s=>getComputedStyle(document.querySelector(s)).display!=='none').map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{x:r.x,y:r.y,w:r.width,h:r.height}]})));
  for(const [label,width,height] of [['portrait',390,844],['landscape',844,390],['small-phone',320,568]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(200);
   const layout=await boxes();for(const [id,b] of Object.entries(layout)){assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.w<=width+1&&b.y+b.h<=height+1,id+' fits '+label)}
   const overlap=(a,b)=>a&&b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
   assert.ok(!overlap(layout['#nsL'],layout['#nsR']),'top HUD separated');assert.ok(!overlap(layout['#pad'],layout['#aimPad']),'sticks separated');
   await page.locator('#more').click();assert.ok(await page.locator('#actions').evaluate(e=>e.classList.contains('expanded')));await page.locator('#more').click();
   if(dir)await page.screenshot({path:path.join(dir,'v055-'+label+'.png')});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{player.x=1760;player.y=1360;NightshiftEnvironment.state.minute=1200});await page.waitForTimeout(300);
  if(dir)await page.screenshot({path:path.join(dir,'v055-browser-night.png')});
  assert.deepEqual(errors,[]);console.log('PASS: real Edge boot, pointer cancellation, walking, 390/844/320 viewport HUD bounds, separated controls, MORE menu, day/night screenshots, zero page errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
