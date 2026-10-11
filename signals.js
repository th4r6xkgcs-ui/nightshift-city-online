/* Local timed junction signals. Traffic obeys them; players control their brakes. */
(function(root){
'use strict';
function phase(now){const t=((now%18000)+18000)%18000;return {horizontal:t<7000?'green':t<9000?'amber':'red',vertical:t<9000?'red':t<16000?'green':'amber'}}
function stop(actor,now){
 const horizontal=Math.abs(Math.cos(actor.angle))>.8,light=phase(now)[horizontal?'horizontal':'vertical'];if(light==='green')return false;
 const ux=Math.cos(actor.angle),uy=Math.sin(actor.angle);
 for(let x=440;x<2200;x+=440)for(let y=340;y<1700;y+=340){const dx=x-actor.x,dy=y-actor.y,forward=dx*ux+dy*uy,lateral=Math.abs(dx*uy-dy*ux);if(forward>42&&forward<85&&lateral<36)return true}
 return false;
}
root.NightshiftSignals={phase,stop};if(!root.document)return;
root.NightshiftSignals.draw=now=>{const lights=phase(now),color={green:'#79e3ac',amber:'#f1c46d',red:'#ed7684'};g.save();for(let x=440;x<2200;x+=440)for(let y=340;y<1700;y+=340){g.fillStyle='#18232f';g.fillRect(x+68,y-82,11,27);g.fillRect(x-82,y+68,27,11);g.fillStyle=color[lights.vertical];g.fillRect(x+71,y-78,5,5);g.fillStyle=color[lights.horizontal];g.fillRect(x-78,y+71,5,5)}g.restore()};
})(globalThis);
