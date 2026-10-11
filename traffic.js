/* Local traffic on authored road loops; collision-aware player encounters. */
(function(root){
'use strict';
function advance(actor,dt){let remaining=Math.max(0,Math.min(.04,dt))*actor.pace;while(remaining>0){const goal=actor.route[actor.next],dx=goal.x-actor.x,dy=goal.y-actor.y,d=Math.hypot(dx,dy);if(d<=remaining){actor.x=goal.x;actor.y=goal.y;actor.next=(actor.next+1)%actor.route.length;remaining-=d;if(d===0)break}else{actor.x+=dx/d*remaining;actor.y+=dy/d*remaining;remaining=0}actor.angle=Math.atan2(dy,dx)}return actor}
root.NightshiftTraffic={advance};if(!root.document)return;
const routes=[[{x:422,y:322},{x:1302,y:322},{x:1302,y:1002},{x:422,y:1002}],[{x:898,y:698},{x:1778,y:698},{x:1778,y:1378},{x:898,y:1378}]];
const actors=[];for(let i=0;i<8;i++){const route=routes[i%2],start=route[i%4],goal=route[(i%4+1)%4],offset=i>=4?.3:0;actors.push({x:start.x+(goal.x-start.x)*offset,y:start.y+(goal.y-start.y)*offset,next:(i%4+1)%4,route,angle:0,pace:55+i*5,color:['#c65b72','#63a7b9','#c6b68c','#a7b1c0'][i%4],speed:0,wait:0,nextImpact:0})}
let previous=0;root.NightshiftTraffic.actors=actors;
root.NightshiftTraffic.tick=now=>{const dt=previous?Math.max(0,Math.min(.04,(now-previous)/1000)):0;previous=now;for(const actor of actors){if(now<actor.wait)continue;const old={x:actor.x,y:actor.y};advance(actor,dt);if(actors.some(c=>c!==actor&&distance(c,actor)<45)||cars.some(c=>c!==player.car&&distance(c,actor)<46)){Object.assign(actor,old);actor.wait=now+400;continue}if(distance(actor,player)<(player.car?48:23)&&now>=actor.nextImpact){actor.nextImpact=now+2500;actor.wait=now+1200;if(player.car){NightshiftVehicles.damage(player.car,5);player.car.speed*=-.2;NightshiftRecovery.damage(8,now)}else NightshiftRecovery.damage(18,now);root.NightshiftAudio?.play('impact');say('Traffic collision · watch the road')}}};
root.NightshiftTraffic.draw=()=>actors.forEach(drawCar);
})(globalThis);
