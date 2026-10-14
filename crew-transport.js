/* Transient passenger attachments; saved followers retain their last safe foot position. */
(function(root){'use strict';
function capacity(car){return String(car?.model||root.NightshiftVehicles?.model?.(car||{})?.name||'COMPACT').toUpperCase()==='COMPACT'?1:3}
function exits(car){const angle=car.angle||0;return [Math.PI/2,-Math.PI/2,Math.PI,0].flatMap(turn=>[52,68].map(radius=>({x:car.x+Math.cos(angle+turn)*radius,y:car.y+Math.sin(angle+turn)*radius})))}
function safe(point,context){return point.x>=10&&point.y>=10&&point.x<=context.world.w-10&&point.y<=context.world.h-10&&!root.NightshiftNavigation.trace(point,point,context.blocked,8)&&!root.NightshiftCitizens.occupied(point,context.cars)&&(context.people||[]).every(p=>p.ridingCar||Math.hypot(point.x-p.x,point.y-p.y)>=16)}
function step(actor,record,driver,passengers,context){
 if(actor.ridingCar){const car=actor.ridingCar;actor.x=car.x;actor.y=car.y;actor.moving=false;
  if(driver.car===car&&driver.hp>0)return 'riding';
  const spot=exits(car).find(p=>safe(p,{...context,people:(context.people||[]).filter(p=>p!==actor)}));if(!spot)return 'exit-blocked';
  Object.assign(actor,spot);actor.ridingCar=null;actor.lastFoot=null;actor.path=[];actor.nextRoute=0;return 'exited';
 }
 const car=driver.car;if(!car||driver.hp<=0||record.order!=='follow'||record.loyalty<40||Math.abs(car.speed||0)>.8)return 'foot';
 if(passengers.filter(a=>a.ridingCar===car).length>=capacity(car))return 'no-seat';
 if(Math.hypot(actor.x-car.x,actor.y-car.y)>78||root.NightshiftNavigation.trace(actor,car,context.blocked,8))return 'approach';
 actor.lastFoot={x:actor.x,y:actor.y};actor.ridingCar=car;actor.x=car.x;actor.y=car.y;actor.moving=false;actor.path=[];return 'boarded';
}
root.NightshiftCrewTransport={capacity,exits,safe,step};
})(globalThis);
