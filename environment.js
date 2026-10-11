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
function inView(x,y,margin=80){return typeof camera==='undefined'||(x>=camera.x-margin&&y>=camera.y-margin&&x<=camera.x+W/camera.zoom+margin&&y<=camera.y+H/camera.zoom+margin)}
root.NightshiftEnvironment={clean,district,darkness,step,clock,weather,rainCount,lampColor};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function lights(){const night=darkness(state.minute);g.save();for(let x=440;x<2200;x+=440)for(let y=340;y<1700;y+=340){
 const lx=x-73,ly=y-87;if(!inView(lx,ly))continue;const color=lampColor({x,y});
 if(night){g.globalAlpha=night;const glow=g.createRadialGradient?.(lx,ly,2,lx,ly,57);if(glow?.addColorStop){glow.addColorStop(0,color+'55');glow.addColorStop(.4,color+'22');glow.addColorStop(1,color+'00');g.fillStyle=glow}else g.fillStyle=color+'22';g.beginPath();g.arc(lx,ly,57,0,Math.PI*2);g.fill();g.globalAlpha=1}
 g.fillStyle='#111f2b66';g.fillRect(lx+3,ly+3,4,27);g.fillStyle='#283a40';g.fillRect(lx-1,ly,3,25);g.fillRect(lx-4,ly+24,9,3);g.fillStyle='#61716c';g.fillRect(lx-1,ly,1,22);g.fillStyle=night?color:'#9eaa98';g.fillRect(lx-6,ly-4,12,5);if(night){g.fillStyle='#fff5d9';g.fillRect(lx-4,ly-3,8,2);g.fillStyle=color+'20';g.fillRect(lx-20,ly+26,40,12);}
 }g.restore()}
function overlay(now=0){const night=darkness(state.minute),rain=weather(state.minute);g.save();if(night){g.fillStyle=`rgba(10,19,49,${night*.28})`;g.fillRect(0,0,W,H)}
 if(rain){const time=Number.isFinite(now)?Math.max(0,now):0;g.strokeStyle=`rgba(160,193,204,${rain*.24})`;g.lineWidth=1;g.beginPath();for(let i=0;i<rainCount(W,H);i++){const x=(i*137+time*.035)%Math.max(1,W+20)-10,y=(i*89+time*.24)%Math.max(1,H+24)-12;g.moveTo(x,y);g.lineTo(x-3,y+10)}g.stroke()}
 g.restore()}
function reflections(){const rain=weather(state.minute);if(!rain)return;g.save();for(let x=440;x<world.w;x+=440)for(let y=340;y<world.h;y+=340){if(!inView(x,y,280))continue;g.fillStyle=`rgba(109,152,158,${rain*.13})`;g.fillRect(x+12,y+119,36,7);g.fillRect(x-32,y+201,44,4);if(darkness(state.minute)>.2){g.fillStyle=`rgba(234,199,137,${rain*.16})`;g.fillRect(x-58,y+91,13,3);g.fillRect(x-55,y+97,8,2);g.fillStyle=lampColor({x,y})+'28';for(let i=0;i<5;i++)g.fillRect(x-66+i%2*3,y-53+i*7,21-i*2,2)}}g.restore()}
function headlights(car){if(darkness(state.minute)<.2)return;g.save();g.translate(car.x,car.y);g.rotate(car.angle);g.fillStyle='#fff2b21a';g.beginPath();g.moveTo(25,-10);g.lineTo(110,-37);g.lineTo(110,37);g.lineTo(25,10);g.closePath();g.fill();g.restore()}
Object.assign(root.NightshiftEnvironment,{state,tick:seconds=>step(state,seconds),save:persist,lights,overlay,headlights,reflections});
})(globalThis);
