/* One candidate selection drives USE, its prompt and its world outline. */
(function(root){'use strict';
function select(position,candidates,previousId=null){if(!Number.isFinite(position?.x)||!Number.isFinite(position?.y))return null;const eligible=candidates.filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)&&Number.isFinite(c.radius)&&c.radius>0).map(c=>({...c,score:Math.hypot(c.x-position.x,c.y-position.y)/c.radius})).filter(c=>c.score<=1).sort((a,b)=>a.score-b.score||(a.kind==='courier'?-1:0)-(b.kind==='courier'?-1:0)||String(a.id).localeCompare(String(b.id)));const best=eligible[0]||null,previous=eligible.find(c=>c.id===previousId);return previous&&best&&!(best.kind==='courier'&&previous.kind!=='courier')&&previous.score<=best.score+.12?previous:best}
root.NightshiftInteractions={select};if(!root.document)return;
let previousId=null;function nearby(){if(player.hp<=0){previousId=null;return null}if(player.car){previousId=null;return {kind:'exit',action:Math.abs(player.car.speed)>1?'STOP':'EXIT',label:Math.abs(player.car.speed)>1?'Brake before exiting':'Exit vehicle',entity:player.car}}const candidates=[];
 const add=(id,kind,action,label,x,y,radius,entity)=>candidates.push({id,kind,action,label,x,y,radius,entity});
 for(const car of cars)if(Math.abs(car.speed||0)<=1)add(car.id||'car-'+cars.indexOf(car),'car',root.NightshiftVehicles?.canEnter(car)?'ENTER':'CAR',root.NightshiftVehicles?.canEnter(car)?'Enter vehicle':'Locked vehicle · buy or steal',car.x,car.y,75,car);
 for(const place of root.NightshiftBusinesses?.locations()||[])add(place.id,'business','BIZ',place.label,place.x,place.y,75,place);
 for(const encounter of root.NightshiftEncounters?.locations()||[])add('encounter-'+encounter.id,'encounter',encounter.action,encounter.hint,encounter.x,encounter.y,50,encounter);
 for(const job of root.NightshiftCrewOps?.locations()||[])add(job.id,'crew-job',job.action,job.hint,job.x,job.y,50,job);
 for(const contact of root.NightshiftGangLife?.locations()||[])add('street-'+contact.id,'gang-life',contact.action,contact.hint,contact.x,contact.y,40,contact);
 for(const contact of root.NightshiftCrews?.locations()||[])add('crew-'+contact.id,'crew',contact.action,contact.hint,contact.x,contact.y,55,contact);
 for(const drop of root.NightshiftInventory?.drops||[])if(drop.expires>Date.now())add('bag-'+drop.x+'-'+drop.y,'bag','LOOT','Recover dropped bag',drop.x,drop.y,48,drop);
 for(const item of loot)add('cash-'+item.x+'-'+item.y,'cash','PICK','Collect $'+item.value,item.x,item.y,35,item);
 for(const place of root.NightshiftSalvage?.locations()||[])if(place.ready)add(place.id,'salvage','SEARCH','Search salvage',place.x,place.y,55,place);
 for(const b of buildings)if(b.name==='CORNER SHOP')add('shop-'+b.x,'shop','SHOP','Enter corner shop',b.x+b.w/2,b.y+b.h+12,90,b);
 const job=root.NightshiftActivities?.target();if(job)add('courier','courier',root.NightshiftActivities.stage==='pickup'?'PICKUP':'DELIVER',job.label,job.x,job.y,85,job);
 add('apartment','home','HOME',root.NightshiftActivities?.ownsHome()?'Enter apartment':'Apartment · $1,200',880,680,105,null);
 const visible=candidates.filter(c=>!root.NightshiftNavigation.trace(player,c,blocked));const target=select(player,visible,previousId);previousId=target?.id||null;return target;
}
function draw(){const target=nearby();if(!target||target.kind==='exit')return;g.save();g.strokeStyle='#b8e9dc';g.lineWidth=2;g.setLineDash?.([4,4]);if(target.kind==='car'){const c=target.entity;g.translate(c.x,c.y);g.rotate(c.angle);const shape=root.NightshiftVehicleGeometry.rectangle(c);g.strokeRect(-shape.halfLength-4,-shape.halfWidth-4,shape.halfLength*2+8,shape.halfWidth*2+8)}else{g.beginPath();g.arc(target.x,target.y,18,0,Math.PI*2);g.stroke()}g.restore();g.save();g.font='bold 11px monospace';g.textAlign='center';g.textBaseline='middle';const label=String(target.action||'USE').slice(0,10);const width=Math.max(44,label.length*7+14);const lx=target.x,ly=target.y-(target.kind==='car'?54:48);if(root.NightshiftSign)root.NightshiftSign(g,lx,ly,'👆',label,'#ffcf5a',{glow:7+4*Math.sin(performance.now()/180)});else{g.fillStyle='#10283ddd';g.fillRect(lx-width/2,ly-10,width,20);g.fillStyle='#e6f9f3';g.fillText(label,lx,ly);}g.restore()}
Object.assign(root.NightshiftInteractions,{nearby,draw});
})(globalThis);
