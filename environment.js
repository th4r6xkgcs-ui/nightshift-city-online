/* District identity and a saved eight-minute day/night cycle. */
(function(root){
'use strict';
const KEY='nightshift-city-world-v1';
function clean(raw){return {minute:Number.isFinite(raw?.minute)?((raw.minute%1440)+1440)%1440:1140}}
function district(pos){if(pos.y>=1020)return pos.x>=1320?'THE DOCKS':'SOUTHSIDE';return pos.x>=880?'MIDTOWN':'WEST END'}
function darkness(minute){const hour=((minute%1440)+1440)%1440/60;if(hour>=7&&hour<=18)return 0;if(hour<6||hour>=20)return 1;return hour<7?7-hour:(hour-18)/2}
function step(state,seconds){state.minute=(state.minute+Math.max(0,Math.min(.2,Number.isFinite(seconds)?seconds:0))*3)%1440;return state}
function clock(minute){const n=Math.floor(((minute%1440)+1440)%1440);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function weather(minute){if(!Number.isFinite(minute))return 0;const t=((minute%1440)+1440)%1440;return Math.max(0,Math.min(1,(t-1080)/30,(1260-t)/30))}
function rainCount(width,height){if(!Number.isFinite(width)||!Number.isFinite(height))return 0;return Math.max(0,Math.min(90,Math.ceil(Math.max(0,width)*Math.max(0,height)/5000)))}
function lampColor(pos){const name=district(pos);return name==='MIDTOWN'?'#b8e7ed':name==='THE DOCKS'?'#b9dbbf':name==='SOUTHSIDE'?'#e7b786':'#f8d894'}
function vehicleLights(car,controls={}){const speed=Number.isFinite(car?.speed)?car.speed:0,on=controls.active===true||Math.abs(speed)>.1;return {on,braking:controls.active===true&&controls.brake===true,reverse:on&&speed<-.1,reach:Math.min(112,78+Math.abs(speed)*5)}}
function inView(x,y,margin=80){return typeof camera==='undefined'||(x>=camera.x-margin&&y>=camera.y-margin&&x<=camera.x+W/camera.zoom+margin&&y<=camera.y+H/camera.zoom+margin)}
root.NightshiftEnvironment={clean,district,darkness,step,clock,weather,rainCount,lampColor,vehicleLights};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function lights(){const night=darkness(state.minute);g.save();for(let x=440;x<2200;x+=440)for(let y=340;y<1700;y+=340){
 const lx=x-73,ly=y-87;if(!inView(lx,ly))continue;const color=lampColor({x,y});
 if(night){g.globalAlpha=night;const glow=g.createRadialGradient?.(lx,ly,2,lx,ly,57);if(glow?.addColorStop){glow.addColorStop(0,color+'55');glow.addColorStop(.4,color+'22');glow.addColorStop(1,color+'00');g.fillStyle=glow}else g.fillStyle=color+'22';g.beginPath();g.arc(lx,ly,57,0,Math.PI*2);g.fill();g.globalAlpha=1}
 g.fillStyle='#111f2b66';g.fillRect(lx+3,ly+3,4,27);g.fillStyle='#283a40';g.fillRect(lx-1,ly,3,25);g.fillRect(lx-4,ly+24,9,3);g.fillStyle='#61716c';g.fillRect(lx-1,ly,1,22);g.fillStyle=night?color:'#9eaa98';g.fillRect(lx-6,ly-4,12,5);if(night){g.fillStyle='#fff5d9';g.fillRect(lx-4,ly-3,8,2);g.fillStyle=color+'20';g.fillRect(lx-20,ly+26,40,12);}
 }g.restore()}

/* Art pass (Claude): screen-space lightmap. Night darkens the city with a blue ambient layer, and real light
 sources (street lamps, headlights, storefronts, neon, bullets, the player) cut holes in it and add coloured glow.
 Dusk gets a warm grade; a soft vignette frames every frame. All drawing is screen space after the world pass. */
let lm=null,lmx=null,vig=null,vigKey='';
function screenOf(x,y){return {x:(x-camera.x)*camera.zoom,y:(y-camera.y)*camera.zoom}}
function seen(x,y,m){return inView(x,y,m)}
function hole(ctx,x,y,r,a){if(r<=1)return;const gr=ctx.createRadialGradient?.(x,y,0,x,y,r);if(!gr?.addColorStop)return;gr.addColorStop(0,`rgba(0,0,0,${a})`);gr.addColorStop(.5,`rgba(0,0,0,${a*.6})`);gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function glow(ctx,x,y,r,color,a){if(r<=1)return;const gr=ctx.createRadialGradient?.(x,y,0,x,y,r);if(!gr?.addColorStop)return;gr.addColorStop(0,hexA(color,a));gr.addColorStop(1,hexA(color,0));ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function hexA(hex,a){const n=parseInt(String(hex).slice(1,7),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${Math.max(0,Math.min(1,a)).toFixed(3)})`}
function lightSources(){
 const out={lamps:[],cars:[],fronts:[],dots:[]},z=camera.zoom;
 for(let x=440;x<2200;x+=440)for(let y=340;y<1700;y+=340){const lx=x-73,ly=y-87;if(seen(lx,ly,140))out.lamps.push({x:lx,y:ly+2,color:lampColor({x,y})})}
 const all=[...(typeof cars!=='undefined'?cars:[]),...(root.NightshiftTraffic?.actors||[])];
 for(const car of all){if(!car||!seen(car.x,car.y,160))continue;const active=(typeof player!=='undefined'&&player.car===car)||root.NightshiftTraffic?.actors?.includes(car)===true,l=vehicleLights(car,{active});if(l.on)out.cars.push({car,reach:l.reach,brake:l.braking})}
 if(typeof buildings!=='undefined')for(const b of buildings){if(!b||!seen(b.x+b.w/2,b.y+b.h,b.w))continue;const color=root.NightshiftWorld?.neonColor?.(b.name)||'#ffd9a0',big=['CLUB','DINER','CORNER SHOP','CLOTHING','GARAGE','CASINO'].some(n=>String(b.name||'').includes(n));out.fronts.push({x:b.x+b.w/2,y:b.y+b.h+4,w:b.w,color,big})}
 if(typeof bullets!=='undefined')for(const bl of bullets)if(seen(bl.x,bl.y,40))out.dots.push({x:bl.x,y:bl.y,r:26,color:'#ffe08a'});
 return out}
function grade(night,now){
 if(typeof camera==='undefined'||typeof W==='undefined')return;
 const dusk=Math.max(0,Math.min(1,night*(1-night)*4));
 if(night>.02&&root.document){
  if(!lm){lm=document.createElement('canvas');lmx=lm.getContext('2d')}
  if(lmx&&typeof lmx.createRadialGradient==='function'&&typeof g.drawImage==='function'){
   if(lm.width!==W||lm.height!==H){lm.width=W;lm.height=H}
   const z=camera.zoom,src=lightSources();
   lmx.globalCompositeOperation='source-over';lmx.clearRect(0,0,W,H);
   lmx.fillStyle=`rgba(4,7,26,${.72*night})`;lmx.fillRect(0,0,W,H);
   lmx.globalCompositeOperation='destination-out';
   for(const l of src.lamps){const p=screenOf(l.x,l.y+22);hole(lmx,p.x,p.y,100*z,.92)}
   for(const f of src.fronts){const p=screenOf(f.x,f.y);lmx.save();lmx.translate(p.x,p.y);lmx.scale(Math.max(1,f.w/110),.8);hole(lmx,0,0,(f.big?58:34)*z,f.big?.75:.35);lmx.restore()}
   for(const c of src.cars){const p=screenOf(c.car.x,c.car.y);lmx.save();lmx.translate(p.x,p.y);lmx.rotate(Number.isFinite(c.car.angle)?c.car.angle:0);lmx.scale(z,z);const reach=c.reach+70,gr=lmx.createLinearGradient?.(24,0,reach,0);if(gr?.addColorStop){gr.addColorStop(0,'rgba(0,0,0,.95)');gr.addColorStop(1,'rgba(0,0,0,0)');lmx.fillStyle=gr;lmx.beginPath();lmx.moveTo(24,-10);lmx.lineTo(reach,-48);lmx.lineTo(reach,48);lmx.lineTo(24,10);lmx.closePath();lmx.fill()}hole(lmx,0,0,40,.5);lmx.restore()}
   for(const d of src.dots){const p=screenOf(d.x,d.y);hole(lmx,p.x,p.y,d.r*z,.9)}
   const lit=root.NightshiftWorld?.litWindows?.()||[];for(const wv of lit){const p=screenOf(wv.x,wv.y);lmx.fillStyle='rgba(0,0,0,.85)';lmx.fillRect(p.x-wv.w*z/2,p.y-wv.h*z/2,wv.w*z,wv.h*z);hole(lmx,p.x,p.y+wv.h*z,26*z,.35)}
   if(typeof player!=='undefined'){const p=screenOf(player.x,player.y);hole(lmx,p.x,p.y,(player.car?70:95)*z,.65)}
   g.drawImage(lm,0,0);
   // coloured light on top (additive)
   g.globalCompositeOperation='lighter';
   for(const l of src.lamps){const p=screenOf(l.x,l.y+18);glow(g,p.x,p.y,85*z,l.color,.2*night);glow(g,p.x,screenOf(l.x,l.y).y,14*z,'#fff3d0',.55*night)}
   for(const f of src.fronts){const p=screenOf(f.x,f.y);glow(g,p.x,p.y,(f.big?70:44)*z,f.color,(f.big?.2:.1)*night)}
   for(const c of src.cars){const p=screenOf(c.car.x,c.car.y),a=Number.isFinite(c.car.angle)?c.car.angle:0;for(const side of [-1,1]){const hx=p.x+(Math.cos(a)*26-Math.sin(a)*side*8)*z,hy=p.y+(Math.sin(a)*26+Math.cos(a)*side*8)*z;glow(g,hx,hy,16*z,'#fff1c4',.5*night);const tx=p.x+(-Math.cos(a)*27-Math.sin(a)*side*8)*z,ty=p.y+(-Math.sin(a)*27+Math.cos(a)*side*8)*z;glow(g,tx,ty,(c.brake?22:12)*z,'#ff4a3a',(c.brake?.55:.3)*night)}}
   for(const d of src.dots){const p=screenOf(d.x,d.y);glow(g,p.x,p.y,d.r*z,d.color,.5)}
   for(const wv of lit){const p=screenOf(wv.x,wv.y);glow(g,p.x,p.y+4*z,30*z,wv.c,.16*night)}
   g.globalCompositeOperation='source-over';
  }
 }
 if(dusk>.02){g.fillStyle=`rgba(255,122,70,${.09*dusk})`;g.fillRect(0,0,W,H)}
 // vignette
 const key=W+'x'+H;if(vigKey!==key){vigKey=key;vig=g.createRadialGradient?.(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.hypot(W,H)*.62)||null;if(vig?.addColorStop){vig.addColorStop(0,'rgba(2,4,14,0)');vig.addColorStop(1,'rgba(2,4,14,.42)')}}
 if(vig){g.fillStyle=vig;g.fillRect(0,0,W,H)}
}
function overlay(now=0){const night=darkness(state.minute),rain=weather(state.minute);
g.save();
grade(night,now);
 if(rain){const time=Number.isFinite(now)?Math.max(0,now):0;g.strokeStyle=`rgba(160,193,204,${rain*.24})`;g.lineWidth=1;g.beginPath();for(let i=0;i<rainCount(W,H);i++){const x=(i*137+time*.035)%Math.max(1,W+20)-10,y=(i*89+time*.24)%Math.max(1,H+24)-12;g.moveTo(x,y);g.lineTo(x-3,y+10)}g.stroke()}
 g.restore()}
function reflections(){const rain=weather(state.minute);if(!rain)return;g.save();for(let x=440;x<world.w;x+=440)for(let y=340;y<world.h;y+=340){if(!inView(x,y,280))continue;g.fillStyle=`rgba(109,152,158,${rain*.13})`;g.fillRect(x+12,y+119,36,7);g.fillRect(x-32,y+201,44,4);if(darkness(state.minute)>.2){g.fillStyle=`rgba(234,199,137,${rain*.16})`;g.fillRect(x-58,y+91,13,3);g.fillRect(x-55,y+97,8,2);g.fillStyle=lampColor({x,y})+'28';for(let i=0;i<5;i++)g.fillRect(x-66+i%2*3,y-53+i*7,21-i*2,2)}}g.restore()}
function headlights(car){
 const night=darkness(state.minute),active=(typeof player!=='undefined'&&player.car===car)||root.NightshiftTraffic?.actors?.includes(car)===true,lights=vehicleLights(car,{active});if(!night||!lights.on)return;
 g.save();g.translate(car.x,car.y);g.rotate(Number.isFinite(car.angle)?car.angle:0);
 for(const side of [-1,1]){const y=side*8;
  g.fillStyle=`rgba(255,237,175,${night*.07})`;g.beginPath();g.moveTo(25,y-3);g.lineTo(lights.reach,y-22);g.lineTo(lights.reach,y+22);g.lineTo(25,y+3);g.closePath();g.fill();
  g.fillStyle=`rgba(255,247,207,${night*.12})`;g.beginPath();g.moveTo(26,y-2);g.lineTo(60,y-8);g.lineTo(60,y+8);g.lineTo(26,y+2);g.closePath();g.fill();
 }g.restore();
}
Object.assign(root.NightshiftEnvironment,{state,tick:seconds=>step(state,seconds),save:persist,lights,overlay,headlights,reflections});
})(globalThis);
