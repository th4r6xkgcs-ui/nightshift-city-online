/* One candidate selection drives USE, its prompt and its world outline. */
(function(root){'use strict';
function select(position,candidates){if(!Number.isFinite(position?.x)||!Number.isFinite(position?.y))return null;return candidates.filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)&&Number.isFinite(c.radius)&&c.radius>0).map(c=>({...c,score:Math.hypot(c.x-position.x,c.y-position.y)/c.radius})).filter(c=>c.score<=1).sort((a,b)=>a.score-b.score||(a.kind==='courier'?-1:0)-(b.kind==='courier'?-1:0)||String(a.id).localeCompare(String(b.id)))[0]||null}
root.NightshiftInteractions={select};if(!root.document)return;
function nearby(){if(player.hp<=0)return null;if(player.car)return {kind:'exit',action:Math.abs(player.car.speed)>1?'STOP':'EXIT',label:Math.abs(player.car.speed)>1?'Brake before exiting':'Exit vehicle',entity:player.car};const candidates=[];
 const add=(id,kind,action,label,x,y,radius,entity)=>candidates.push({id,kind,action,label,x,y,radius,entity});
 for(const car of cars)if(Math.abs(car.speed||0)<=1)add(car.id||'car-'+cars.indexOf(car),'car',root.NightshiftVehicles?.canEnter(car)?'ENTER':'CAR',root.NightshiftVehicles?.canEnter(car)?'Enter vehicle':'Locked vehicle · buy or steal',car.x,car.y,65,car);
 for(const place of root.NightshiftBusinesses?.locations()||[])add(place.id,'business','BIZ',place.label,place.x,place.y,75,place);
 for(const drop of root.NightshiftInventory?.drops||[])if(drop.expires>Date.now())add('bag-'+drop.x+'-'+drop.y,'bag','LOOT','Recover dropped bag',drop.x,drop.y,48,drop);
 for(const item of loot)add('cash-'+item.x+'-'+item.y,'cash','PICK','Collect $'+item.value,item.x,item.y,35,item);
 for(const place of root.NightshiftSalvage?.locations()||[])if(place.ready)add(place.id,'salvage','SEARCH','Search salvage',place.x,place.y,55,place);
 for(const b of buildings)if(b.name==='CORNER SHOP')add('shop-'+b.x,'shop','SHOP','Enter corner shop',b.x+b.w/2,b.y+b.h+12,90,b);
 const job=root.NightshiftActivities?.target();if(job)add('courier','courier',root.NightshiftActivities.stage==='pickup'?'PICKUP':'DELIVER',job.label,job.x,job.y,85,job);
 add('apartment','home','HOME',root.NightshiftActivities?.ownsHome()?'Enter apartment':'Apartment · $1,200',880,680,105,null);
 return select(player,candidates);
}
function draw(){const target=nearby();if(!target||target.kind==='exit')return;g.save();g.strokeStyle='#b8e9dc';g.lineWidth=2;g.setLineDash?.([4,4]);if(target.kind==='car'){const c=target.entity;g.translate(c.x,c.y);g.rotate(c.angle);g.strokeRect(-21,-36,42,72)}else{g.beginPath();g.arc(target.x,target.y,18,0,Math.PI*2);g.stroke()}g.restore()}
Object.assign(root.NightshiftInteractions,{nearby,draw});
})(globalThis);
