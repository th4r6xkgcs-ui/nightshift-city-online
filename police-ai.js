/* Police goals depend on observed or reported locations, never hidden movement. */
(function(root){'use strict';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function goal(officer,subject,visible,incident,now,clear){
 if(visible){officer.memory={x:subject.x,y:subject.y};officer.memoryAt=now;officer.mode='pursue';officer.searchGoal=null;return officer.memory}
 if(incident&&(!officer.memory||incident.at>(officer.memoryAt??-Infinity))){const redirect=!officer.memory||distance(officer.memory,incident)>30||officer.mode==='search';officer.memory={x:incident.x,y:incident.y};officer.memoryAt=incident.at;officer.mode='investigate';officer.searchGoal=null;if(redirect)officer.nextRoute=0}
 if(!officer.memory)return null;
 if(['pursue','cover','peek'].includes(officer.mode))officer.mode='investigate';
 if(officer.mode!=='search'&&distance(officer,officer.memory)>32)return officer.memory;
 officer.mode='search';
 if(now>=(officer.nextSearch||0)&&(!officer.searchGoal||distance(officer,officer.searchGoal)<14)){
  officer.searchGoal=null;for(let n=0;n<8;n++){const index=(officer.searchIndex||0)+n,a=index*Math.PI/4,p={x:officer.memory.x+Math.cos(a)*80,y:officer.memory.y+Math.sin(a)*80};if(clear(p)){officer.searchGoal=p;officer.searchIndex=index+1;break}}
  officer.nextSearch=now+1500;officer.nextRoute=0;
 }return officer.searchGoal||officer.memory;
}
function tactics(officer,subject,visible,incident,now,context){
 const {cars,blocked,world,clear}=context;const pursuit=goal(officer,subject,visible,incident,now,clear);
 if(!visible){officer.tactical=null;return {goal:pursuit,fire:false}}
 const threat=officer.memory;
 if(now>=(officer.nextTactic||0)){
  officer.nextTactic=now+1600;officer.tactical=null;
  const shelter=root.NightshiftCitizens.coverGoal(officer,threat,cars,blocked,world);
  if(shelter){
   const car=cars.find(c=>Math.abs(c.speed||0)<=.5&&root.NightshiftVehicleGeometry.segmentHit(threat,shelter,c)!==null);
   const d=distance(car,threat),ux=(car.x-threat.x)/d,uy=(car.y-threat.y)/d,r=root.NightshiftVehicleGeometry.rectangle(car),a=car.angle||0;
   const side=r.halfLength*Math.abs(-uy*Math.cos(a)+ux*Math.sin(a))+r.halfWidth*Math.abs(uy*Math.sin(a)+ux*Math.cos(a))+22;
   const peeks=[-1,1].map(sign=>({x:shelter.x-uy*side*sign,y:shelter.y+ux*side*sign})).filter(p=>clear(p)&&!root.NightshiftVehicleGeometry.traceCover(p,threat,cars,blocked));
   if(peeks.length)officer.tactical={car,shelter,peek:peeks.sort((a,b)=>distance(a,officer)-distance(b,officer))[0]};
  }
 }
 const cover=officer.tactical;
 if(cover&&cars.includes(cover.car)&&Math.abs(cover.car.speed||0)<=.5&&clear(cover.shelter)&&clear(cover.peek)){
  const peek=(now+(officer.slot||0)*450)%2800>=1600;const target=peek?cover.peek:cover.shelter;
  officer.mode=peek?'peek':'cover';
  return {goal:target,fire:peek&&distance(officer,target)<14&&!root.NightshiftVehicleGeometry.traceCover(officer,subject,cars,blocked)};
 }
 officer.tactical=null;
 // Spread a second unit onto a clear side street instead of stacking every officer.
 if((officer.slot||0)%2&&distance(officer,subject)>100){const a=Math.atan2(officer.y-subject.y,officer.x-subject.x)+.55,p={x:subject.x+Math.cos(a)*115,y:subject.y+Math.sin(a)*115};if(clear(p))return {goal:p,fire:true}}
 return {goal:pursuit,fire:true};
}
root.NightshiftPoliceAI={goal,tactics};
})(globalThis);
