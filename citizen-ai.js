/* Transient civilian reactions. Economy and saved NPC identity remain elsewhere. */
(function(root){'use strict';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function react(npc,source,now,kind='gunshot'){
 if(npc.hp<=0||![source?.x,source?.y,now].every(Number.isFinite))return false;
 const moved=!npc.threat||distance(npc.threat,source)>24;
 npc.threat={x:source.x,y:source.y};npc.fleeUntil=Math.max(npc.fleeUntil||0,now+(kind==='robbery'?10000:kind==='crash'?4000:6000));
 if(moved){npc.nextRoute=0;npc.path=[];npc.cover=null}npc.mode='flee';npc.routineInterrupted=true;return true;
}
function occupied(point,cars){return cars.some(car=>root.NightshiftVehicleGeometry.circleOverlap(point,car,9))}
function canStep(from,to,blocked,cars){return !blocked(to.x,to.y)&&cars.every(car=>!root.NightshiftVehicleGeometry.circleOverlap(to,car,9)||(root.NightshiftVehicleGeometry.circleOverlap(from,car,9)&&distance(to,car)>distance(from,car)))}
function coverGoal(npc,threat,cars,blocked,world){
 const options=[];
 for(const car of cars){if(Math.abs(car.speed||0)>.5||distance(npc,car)>160)continue;
 const d=distance(car,threat);if(d<1)continue;const ux=(car.x-threat.x)/d,uy=(car.y-threat.y)/d,a=car.angle||0;
 const r=root.NightshiftVehicleGeometry.rectangle(car),extent=r.halfLength*Math.abs(ux*Math.cos(a)+uy*Math.sin(a))+r.halfWidth*Math.abs(-ux*Math.sin(a)+uy*Math.cos(a))+24;
 const point={x:car.x+ux*extent,y:car.y+uy*extent};
 if(point.x<10||point.y<10||point.x>world.w-10||point.y>world.h-10||blocked(point.x,point.y)||occupied(point,cars))continue;
 if(root.NightshiftVehicleGeometry.segmentHit(threat,point,car)!==null)options.push(point);
 }return options.sort((a,b)=>distance(a,npc)-distance(b,npc))[0]||null;
}
function step(npc,now,dt,context){
 const {cars,blocked,world}=context,before={x:npc.x,y:npc.y};
 if(npc.fleeUntil>now&&npc.threat){
  if(now>=(npc.nextRoute||0)){
   npc.cover=coverGoal(npc,npc.threat,cars,blocked,world);let goal=npc.cover;
   if(!goal){const angle=Math.atan2(npc.y-npc.threat.y,npc.x-npc.threat.x);for(const turn of [0,.6,-.6,1.2,-1.2,Math.PI]){const p={x:Math.max(10,Math.min(world.w-10,npc.x+Math.cos(angle+turn)*110)),y:Math.max(10,Math.min(world.h-10,npc.y+Math.sin(angle+turn)*110))};if(!blocked(p.x,p.y)&&!occupied(p,cars)){goal=p;break}}}
   npc.path=goal?root.NightshiftNavigation.route(npc,goal,(x,y)=>blocked(x,y)||occupied({x,y},cars),world.w,world.h):[];npc.nextRoute=now+1200;
  }
  npc.mode=npc.cover&&distance(npc,npc.cover)<12?'cover':'flee';
  while(npc.path?.length&&distance(npc,npc.path[0])<8)npc.path.shift();
  const goal=npc.mode==='cover'?null:npc.path?.[0];if(goal){const d=distance(npc,goal),speed=Math.min(d,1.2*dt);const to={x:npc.x+(goal.x-npc.x)/d*speed,y:npc.y+(goal.y-npc.y)/d*speed};if(canStep(npc,to,blocked,cars)){npc.x=to.x;npc.y=to.y}else npc.nextRoute=0;}
 }else{
  if(npc.threat){npc.threat=null;npc.cover=null;npc.path=[];npc.dx=0;npc.dy=0;npc.t=0}npc.mode='routine';if(npc.routine&&npc.routineInterrupted){npc.routine.nextRoute=0;npc.routine.path=[];npc.routineInterrupted=false}npc.t-=dt;
  if(root.NightshiftCitizenRoutines?.step(npc,now,dt,context)){npc.moving=distance(npc,before)>.01;if(npc.moving){npc.walkTicks=(npc.walkTicks||0)+dt;npc.moveAngle=Math.atan2(npc.y-before.y,npc.x-before.x)}return}
  if(npc.t<=0){npc.dx=Math.random()*2-1;npc.dy=Math.random()*2-1;npc.t=30+Math.random()*80}
  const to={x:Math.max(10,Math.min(world.w-10,npc.x+npc.dx*.38*dt)),y:Math.max(10,Math.min(world.h-10,npc.y+npc.dy*.38*dt))};
  if(canStep(npc,{x:to.x,y:npc.y},blocked,cars))npc.x=to.x;else npc.dx*=-1;
  if(canStep(npc,{x:npc.x,y:to.y},blocked,cars))npc.y=to.y;else npc.dy*=-1;
 }npc.moving=distance(npc,before)>.01;if(npc.moving){npc.walkTicks=(npc.walkTicks||0)+dt;npc.moveAngle=Math.atan2(npc.y-before.y,npc.x-before.x);}
}
function alert(source,now,{kind='gunshot',radius=260}={}){let count=0;for(const npc of peds)if(distance(npc,source)<=radius&&react(npc,source,now,kind))count++;return count}
root.NightshiftCitizens={react,occupied,canStep,coverGoal,step,alert};
})(globalThis);
