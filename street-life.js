/* Bounded ambient interactions and predictive pedestrian road checks. */
(function(root){'use strict';
function crossingWait(from,to,cars,now=0){
 const phase=root.NightshiftSignals?.phase(now);
 if(phase)for(const [axis,spacing,other,otherSpacing,light] of [['x',440,'y',340,'vertical'],['y',340,'x',440,'horizontal']]){
  const center=Math.round(from[axis]/spacing)*spacing,junction=Math.round(from[other]/otherSpacing)*otherSpacing;
  if(center>0&&junction>0&&Math.abs(from[other]-junction)<125&&Math.abs(from[axis]-center)>66&&Math.abs(to[axis]-center)<=66&&phase[light]!=='red')return true;
 }

 for(const car of cars){const speed=Number.isFinite(car.velocity)?car.velocity:(car.speed||0)*60;if(Math.abs(speed)<8)continue;
  const angle=car.angle||0,end={x:car.x+Math.cos(angle)*speed*.85,y:car.y+Math.sin(angle)*speed*.85};
  if(root.NightshiftNavigation.segmentCircle(car,end,to,43)!==null&&Math.hypot(car.x-from.x,car.y-from.y)>43)return true;
 }return false;
}
function socialize(npc,now,context){
 if(npc.disturbedUntil>now||npc.activity==='shelter'||npc.activity==='home')return false;
 const partner=(context.peds||[]).find(p=>p!==npc&&p.hp>0&&p.mode==='routine'&&!p.moving&&!(p.disturbedUntil>now)&&Math.hypot(p.x-npc.x,p.y-npc.y)>12&&Math.hypot(p.x-npc.x,p.y-npc.y)<65);
 if(!partner)return false;
 npc.socialUntil=now+1800;npc.moveAngle=Math.atan2(partner.y-npc.y,partner.x-npc.x);npc.angle=npc.moveAngle;return true;
}
function draw(npc,now){
 const cautious=npc.disturbedUntil>now,chat=npc.socialUntil>now&&!cautious;
 if(!chat&&!cautious&&!npc.waitingTraffic)return;
 g.save();g.translate(npc.x,npc.y-32);g.fillStyle='#172b3de8';g.beginPath();g.roundRect(-9,-7,18,12,4);g.fill();g.fillStyle=cautious?'#edbb83':'#b7d9cf';
 if(cautious){g.fillRect(-1,-5,2,5);g.fillRect(-1,2,2,2)}else if(npc.waitingTraffic){g.fillRect(-4,-3,8,2);g.fillRect(-4,1,8,2)}else for(let i=0;i<3;i++)g.fillRect(-5+i*4,-1,2,2);g.restore();
}
root.NightshiftStreetLife={crossingWait,socialize,draw};
})(globalThis);
