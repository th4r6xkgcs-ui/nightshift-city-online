/* Local traffic on authored road loops; collision-aware player encounters. */
(function(root){
'use strict';
function advance(actor,dt){let remaining=Math.max(0,Math.min(.04,Number.isFinite(dt)?dt:0))*(actor.velocity??actor.pace);while(remaining>0){const goal=actor.route[actor.next],dx=goal.x-actor.x,dy=goal.y-actor.y,d=Math.hypot(dx,dy);if(d<=remaining){actor.x=goal.x;actor.y=goal.y;actor.next=(actor.next+1)%actor.route.length;remaining-=d;if(d===0)break}else{actor.x+=dx/d*remaining;actor.y+=dy/d*remaining;remaining=0}actor.angle=Math.atan2(dy,dx)}return actor}
function roundRoute(points,radius=28){const route=[];for(let i=0;i<points.length;i++){const p=points[i],before=points[(i+points.length-1)%points.length],after=points[(i+1)%points.length],a=Math.hypot(before.x-p.x,before.y-p.y),b=Math.hypot(after.x-p.x,after.y-p.y),r=Math.min(radius,a/3,b/3);if(!a||!b)continue;const entry={x:p.x+(before.x-p.x)/a*r,y:p.y+(before.y-p.y)/a*r},exit={x:p.x+(after.x-p.x)/b*r,y:p.y+(after.y-p.y)/b*r};for(let j=0;j<=8;j++){const t=j/8,u=1-t;route.push({x:u*u*entry.x+2*u*t*p.x+t*t*exit.x,y:u*u*entry.y+2*u*t*p.y+t*t*exit.y})}}return route}
function moveSafely(actor,dt,blocked){const old={x:actor.x,y:actor.y,next:actor.next,angle:actor.angle};advance(actor,dt);if(blocked(actor)){Object.assign(actor,old);actor.velocity=0;actor.speed=0;return false}return true}
root.NightshiftTraffic={advance,moveSafely,roundRoute};if(!root.document)return;
const routes=[[{x:422,y:322},{x:1302,y:322},{x:1302,y:1002},{x:422,y:1002}],[{x:898,y:698},{x:1778,y:698},{x:1778,y:1378},{x:898,y:1378}]].map(points=>roundRoute(points));
const actors=[];for(let i=0;i<8;i++){const route=routes[i%2],index=(i%4)*9+8,start=route[index],goal=route[(index+1)%route.length],offset=i>=4?.3:0;actors.push({x:start.x+(goal.x-start.x)*offset,y:start.y+(goal.y-start.y)*offset,next:(index+1)%route.length,route,angle:0,pace:55+i*5,color:['#c65b72','#63a7b9','#c6b68c','#a7b1c0'][i%4],speed:0,velocity:0,wait:0,nextImpact:0})}
let previous=0;root.NightshiftTraffic.actors=actors;
root.NightshiftTraffic.tick=now=>{
 const dt=previous?Math.max(0,Math.min(.04,(now-previous)/1000)):0;previous=now;
 // Read a snapshot so actor iteration order does not change braking decisions.
 const obstacles=actors.map(a=>({x:a.x,y:a.y,angle:a.angle,source:a})).concat(cars.map(c=>({x:c.x,y:c.y,angle:c.angle})),player.car?[]:[{x:player.x,y:player.y,radius:12}],[...peds,...(root.NightshiftCrime?.officers||[])].map(p=>({x:p.x,y:p.y,radius:12})));
 for(const actor of actors){
  if(now<actor.wait){actor.velocity=0;actor.speed=0;continue}
  const goal=actor.route[actor.next];actor.angle=Math.atan2(goal.y-actor.y,goal.x-actor.x);
  const nearby=obstacles.filter(o=>o.source!==actor);
  const red=root.NightshiftSignals?.stop(actor,now)||false;
  actor.velocity=NightshiftTrafficSafety.speed(actor,nearby,dt,red);
  if(red)actor.velocity=0; // Never coast past the signal's stop boundary.
  const old={x:actor.x,y:actor.y};
  if(!moveSafely(actor,dt,a=>actors.some(c=>c!==a&&NightshiftTrafficSafety.overlaps(c,a))||cars.some(c=>c!==player.car&&NightshiftTrafficSafety.overlaps(c,a))||obstacles.some(o=>o.radius&&NightshiftVehicleGeometry.circleOverlap(o,a,o.radius))))continue;
  actor.speed=dt?distance(actor,old)/dt/60:0;
  if(distance(actor,player)<(player.car?48:23)&&now>=actor.nextImpact){
   actor.nextImpact=now+2500;actor.wait=now+1200;actor.velocity=0;actor.speed=0;
   if(player.car){NightshiftVehicles.damage(player.car,5);player.car.speed*=-.2;NightshiftRecovery.damage(8,now)}else NightshiftRecovery.damage(18,now);
   root.NightshiftAudio?.play('impact');say('Traffic collision · watch the road')
  }
 }
};
root.NightshiftTraffic.draw=()=>actors.forEach(drawCar);
})(globalThis);
