/* District identity and a saved eight-minute day/night cycle. */
(function(root){
'use strict';
const KEY='nightshift-city-world-v1';
function clean(raw){return {minute:Number.isFinite(raw?.minute)?((raw.minute%1440)+1440)%1440:1140}}
function district(pos){if(pos.y>=1020)return pos.x>=1320?'THE DOCKS':'SOUTHSIDE';return pos.x>=880?'MIDTOWN':'WEST END'}
function darkness(minute){const hour=((minute%1440)+1440)%1440/60;if(hour>=7&&hour<=18)return 0;if(hour<6||hour>=20)return 1;return hour<7?7-hour:(hour-18)/2}
function step(state,seconds){state.minute=(state.minute+Math.max(0,Math.min(.2,Number.isFinite(seconds)?seconds:0))*3)%1440;return state}
function clock(minute){const n=Math.floor(((minute%1440)+1440)%1440);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
root.NightshiftEnvironment={clean,district,darkness,step,clock};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function lights(){const night=darkness(state.minute);g.save();for(let x=440;x<2200;x+=440)for(let y=340;y<1700;y+=340){
 const lx=x-73,ly=y-87;
 if(night){const glow=g.createRadialGradient?.(lx,ly,2,lx,ly,57);if(glow?.addColorStop){glow.addColorStop(0,'#f8d89435');glow.addColorStop(.4,'#f0c88018');glow.addColorStop(1,'#f0c88000');g.fillStyle=glow}else g.fillStyle='#e3ca8e18';g.beginPath();g.arc(lx,ly,57,0,Math.PI*2);g.fill()}
 g.fillStyle='#111f2b66';g.fillRect(lx+3,ly+3,4,27);g.fillStyle='#283a40';g.fillRect(lx-1,ly,3,25);g.fillRect(lx-4,ly+24,9,3);g.fillStyle='#61716c';g.fillRect(lx-1,ly,1,22);g.fillStyle=night?'#f4d697':'#9eaa98';g.fillRect(lx-6,ly-4,12,5);
 }g.restore()}
function overlay(){const night=darkness(state.minute);if(!night)return;g.save();g.fillStyle=`rgba(10,19,49,${night*.18})`;g.fillRect(0,0,W,H);g.restore()}
function headlights(car){if(darkness(state.minute)<.2)return;g.save();g.translate(car.x,car.y);g.rotate(car.angle);g.fillStyle='#fff2b21a';g.beginPath();g.moveTo(25,-10);g.lineTo(110,-37);g.lineTo(110,37);g.lineTo(25,10);g.closePath();g.fill();g.restore()}
Object.assign(root.NightshiftEnvironment,{state,tick:seconds=>step(state,seconds),save:persist,lights,overlay,headlights});
})(globalThis);
