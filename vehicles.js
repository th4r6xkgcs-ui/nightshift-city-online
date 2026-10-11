/* Persistent local vehicle identity, ownership, theft and running costs. */
(function(root){
'use strict';
const MODELS=[{name:'COMPACT',accel:.24,max:6.5,steer:.044},{name:'SEDAN',accel:.22,max:7,steer:.038},{name:'VAN',accel:.17,max:5.5,steer:.032}];
function model(car){const i=Number((car.id||'car-0').split('-')[1]);return MODELS[(Number.isInteger(i)&&i>=0?i:0)%MODELS.length]}
function handling(car,thrust,steer,brake,dt=1,powered=true){
 const spec=model(car),step=Math.max(0,Math.min(2,Number.isFinite(dt)?dt:0));
 const health=.6+.4*Math.max(0,Math.min(100,car.condition??100))/100;
 car.speed=Math.max(-2.6,Math.min(spec.max,car.speed+(powered&&!brake?thrust*spec.accel*health*step:0)));
 car.speed*=Math.pow(brake?.77:.984,step);
 if(Math.abs(car.speed)<.025)car.speed=0;
 car.angle+=steer*spec.steer*step*Math.min(1,Math.abs(car.speed)/1.2)*(car.speed>=0?1:-1);
 return car;
}
function clean(raw={},fallback={}){return {x:Number.isFinite(raw.x)?Math.max(32,Math.min(2168,raw.x)):fallback.x,y:Number.isFinite(raw.y)?Math.max(32,Math.min(1668,raw.y)):fallback.y,angle:Number.isFinite(raw.angle)?raw.angle:fallback.angle,fuel:Number.isFinite(raw.fuel)?Math.max(0,Math.min(100,raw.fuel)):100,condition:Number.isFinite(raw.condition)?Math.max(0,Math.min(100,raw.condition)):100,owned:raw.owned===true,stolen:raw.stolen===true,color:/^#[0-9a-f]{6}$/i.test(raw.color||'')?raw.color:fallback.color}}
function service(car,wallet,kind){const cost=kind==='fuel'?Math.ceil((100-car.fuel)*.8):kind==='repair'?Math.ceil((100-car.condition)*1.5):0;if(!['fuel','repair'].includes(kind)||cost<=0)return {ok:false,cost:0};if(wallet.cash<cost)return {ok:false,cost};wallet.cash-=cost;car[kind==='fuel'?'fuel':'condition']=100;return {ok:true,cost}}
root.NightshiftVehicles={clean,service,MODELS,model,handling};if(!root.document)return;
const KEY='nightshift-city-vehicles-v1';let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
for(let i=0;i<cars.length;i++){const c=cars[i];c.id='car-'+i;c.model=model(c).name;const defaults={...c};Object.assign(c,clean(saved[c.id]||{owned:i===0},defaults));if(NightshiftVehicleGeometry.blocked(c,buildings,world)){c.x=(i%5)*440+44;c.y=175+Math.floor(i/5)*340;c.angle=Math.PI/2}}
function persist(){const data={};for(const c of cars)data[c.id]=clean(c,c);try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}}root.NightshiftVehicles.save=persist;
let theft=null;
root.NightshiftVehicles.canEnter=car=>car.owned||car.stolen;
root.NightshiftVehicles.theft=car=>{if(root.NightshiftSafeZones?.protected(player)){say('No vehicle theft in the clinic safe area');return false}if(player.car||!car||distance(car,player)>75)return false;if(car.owned||car.stolen){say('Vehicle already accessible');return false}theft={id:car.id,until:performance.now()+3000};say('Picking vehicle lock · stay nearby for 3 seconds');return true};
root.NightshiftVehicles.tick=now=>{if(theft){if(root.NightshiftBusinesses?.paused()||root.NightshiftCraft?.paused()||root.NightshiftProgress?.paused()||root.NightshiftBackups?.paused()||root.NightshiftMap?.paused()||root.NightshiftInventory?.paused()||root.NightshiftHome?.paused()||root.NightshiftRecovery?.paused()){theft=null;say('Vehicle theft interrupted');return}const car=cars.find(c=>c.id===theft.id);if(!car||distance(car,player)>75||player.car||player.hp<=0){theft=null;say('Vehicle theft interrupted')}else if(now>=theft.until){car.stolen=true;player.heat=Math.min(5,player.heat+1);theft=null;save();say('Vehicle stolen · police alerted · USE to drive')}}};
root.NightshiftVehicles.damage=(car,impact)=>{if(impact>4)car.condition=Math.max(0,car.condition-impact*2)};
root.NightshiftVehicles.drive=(car,dt)=>{if(car.fuel<=0||car.condition<=0){car.speed*=Math.pow(.85,dt);return false}car.fuel=Math.max(0,car.fuel-Math.abs(car.speed)*dt*.0006);return true};
const panel=document.createElement('div');panel.id='vehiclePanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Vehicle services');panel.style.cssText='position:fixed;inset:12% 6% auto;z-index:22;padding:18px;background:#142139;color:white;border:1px solid #9cb4d0;border-radius:12px';document.body.appendChild(panel);let selected=null;
function close(){panel.hidden=true;selected=null}
function menu(){panel.textContent='';const text=document.createElement('p');text.textContent=`${model(selected).name} · ${selected.id} · ${selected.owned?'OWNED':selected.stolen?'STOLEN':'LOCKED'} · fuel ${Math.round(selected.fuel)}% · condition ${Math.round(selected.condition)}%`;panel.appendChild(text);function option(label,action){const b=document.createElement('button');b.textContent=label;b.style.cssText='width:100%;height:42px;border-radius:6px;margin:4px 0';b.addEventListener('click',action);panel.appendChild(b)}
if(!selected.owned&&!selected.stolen){option('BUY · $900',()=>{if(player.cash<900){say('Not enough cash');return}player.cash-=900;selected.owned=true;save();menu()});option('STEAL · 3 seconds',()=>{const car=selected;close();root.NightshiftVehicles.theft(car)})}
const garage=buildings.some(b=>b.name==='GARAGE'&&Math.hypot(player.x-b.x-b.w/2,player.y-b.y-b.h-12)<120);
if(garage){option('REFUEL · $0.80 per %',()=>{const result=service(selected,player,'fuel');say(result.ok?`Refueled · -$${result.cost}`:'Tank full or insufficient funds');save();menu()});option('REPAIR · $1.50 per %',()=>{const result=service(selected,player,'repair');say(result.ok?`Repaired · -$${result.cost}`:'Condition full or insufficient funds');save();menu()})}else{const hint=document.createElement('p');hint.textContent='Park near a GARAGE entrance for repair/refueling.';panel.appendChild(hint)}option('CLOSE',close)}
root.NightshiftVehicles.paused=()=>!panel.hidden;
const button=document.createElement('button');button.id='vehicle';button.textContent='CAR';button.setAttribute('aria-label','Vehicle ownership and services');function openVehicle(target){if(root.NightshiftBusinesses?.paused()||root.NightshiftCraft?.paused()||root.NightshiftProgress?.paused()||root.NightshiftBackups?.paused()||root.NightshiftMap?.paused()||root.NightshiftRecovery?.paused()||root.NightshiftHome?.paused()||root.NightshiftInventory?.paused())return;selected=target&&cars.includes(target)&&distance(target,player)<=75?target:player.car||cars.filter(c=>distance(c,player)<=75).sort((a,b)=>distance(a,player)-distance(b,player))[0];if(!selected){say('Stand near a vehicle first');return}if(player.car&&Math.abs(player.car.speed)>1){say('Park before opening vehicle services');return}releaseControls();panel.hidden=false;menu()}root.NightshiftVehicles.open=openVehicle;button.addEventListener('click',()=>openVehicle());document.querySelector('#actions').appendChild(button);
root.addEventListener('pagehide',persist);
})(globalThis);
