/* Local timed junction signals. Traffic obeys them; players control their brakes. */
(function(root){
'use strict';
function phase(now){const t=((now%18000)+18000)%18000;return {horizontal:t<7000?'green':t<9000?'amber':'red',vertical:t<9000?'red':t<16000?'green':'amber'}}
function stop(actor,now){
 const horizontal=Math.abs(Math.cos(actor.angle))>.8,light=phase(now)[horizontal?'horizontal':'vertical'];if(light==='green')return false;
 const ux=Math.cos(actor.angle),uy=Math.sin(actor.angle);
 for(let x=440;x<world.w;x+=440)for(let y=340;y<world.h;y+=340){const dx=x-actor.x,dy=y-actor.y,forward=dx*ux+dy*uy,lateral=Math.abs(dx*uy-dy*ux);if(forward>42&&forward<85&&lateral<36)return true}
 return false;
}
root.NightshiftSignals={phase,stop};if(!root.document)return;
root.NightshiftSignals.draw=now=>{
 const lights=phase(now),colors={red:'#f47e86',amber:'#f3c86d',green:'#89e2b4'};
 g.save();
 for(let x=440;x<world.w;x+=440)for(let y=340;y<world.h;y+=340){
  if(typeof camera!=='undefined'&&(x+110<camera.x||y+110<camera.y||x-110>camera.x+W/camera.zoom||y-110>camera.y+H/camera.zoom))continue;
  // Paired three-lamp heads: positions communicate state as well as color.
  for(const [dx,dy,axis] of [[72,-91,'vertical'],[-91,72,'horizontal']]){
   const xx=x+dx,yy=y+dy;g.fillStyle='#101e2b88';g.fillRect(xx+3,yy+4,15,35);g.fillStyle='#b2baa5';g.fillRect(xx+6,yy+28,3,14);g.fillStyle='#152a36';g.fillRect(xx,yy,15,32);
   for(const [i,key] of ['red','amber','green'].entries()){g.fillStyle=lights[axis]===key?colors[key]:'#30434a';g.fillRect(xx+4,yy+4+i*9,7,6);if(lights[axis]===key){g.fillStyle='#fff6cf';g.fillRect(xx+5,yy+4+i*9,2,1)}}
  }
 }
 g.restore();
};
})(globalThis);