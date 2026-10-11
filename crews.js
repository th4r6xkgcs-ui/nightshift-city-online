/* Local neighborhood allegiance. No online authority or territory capture. */
(function(root){'use strict';
const KEY='nightshift-city-crews-v1',COOLDOWN=180000;
const CREWS=[{id:'south',name:'Southside Union',label:'SOUTHSIDE CONTACT',x:820,y:1040,color:'#efbb66'},{id:'docks',name:'Harbor Crew',label:'HARBOR CONTACT',x:1700,y:1380,color:'#bf9feb'}];
function territory(point){if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||point.y<1020)return null;return CREWS[point.x>=1320?1:0]}
function relation(rep){return rep<=-20?'HOSTILE':rep>=20?'TRUSTED':'NEUTRAL'}
function clean(raw={},now=Date.now()){const out={version:1,crews:{}};for(const crew of CREWS){const r=raw?.crews?.[crew.id];out.crews[crew.id]={rep:Number.isSafeInteger(r?.rep)?Math.max(-100,Math.min(100,r.rep)):0,supplyAt:Number.isSafeInteger(r?.supplyAt)&&r.supplyAt>0?Math.min(r.supplyAt,now+COOLDOWN):0}}return out}
function change(state,id,amount){const record=state.crews[id];if(!record||!Number.isSafeInteger(amount)||Math.abs(amount)>20)return false;record.rep=Math.max(-100,Math.min(100,record.rep+amount));return true}
function contact(state,id,wallet,pocket,now=Date.now()){
 const crew=CREWS.find(c=>c.id===id),record=state.crews[id],fail=reason=>({ok:false,reason});
 if(!crew||!record||!Number.isSafeInteger(now)||now<0)return fail('Unknown crew');
 if(!Number.isFinite(wallet.hp)||wallet.hp<=0||wallet.car||!Number.isFinite(wallet.x)||!Number.isFinite(wallet.y)||Math.hypot(wallet.x-crew.x,wallet.y-crew.y)>55)return fail('Meet this contact on foot');
 if(wallet.heat>=2)return fail('Lose police pressure before meeting the crew');
 if(relation(record.rep)==='HOSTILE'){
  if(!Number.isSafeInteger(wallet.cash)||wallet.cash<250)return fail('Rebuild trust: $250 for +10 reputation, or complete deliveries');
  wallet.cash-=250;change(state,id,10);return {ok:true,message:'Peace offering · −$250 · +10 '+crew.name+' reputation'};
 }
 if(relation(record.rep)==='TRUSTED'){
  if(now<record.supplyAt)return fail('Crew supplies refill in '+Math.ceil((record.supplyAt-now)/1000)+'s');
  const held=pocket.medkit??0;if(!Number.isSafeInteger(held)||held<0||held>=999)return fail('Pockets full');
  pocket.medkit=held+1;record.supplyAt=now+COOLDOWN;return {ok:true,message:'Crew supply · +1 medkit · carried supplies drop on death'};
 }
 return {ok:true,job:true,message:'Earn trust with city deliveries · +8 destination reputation, −2 with the rival crew'};
}
root.NightshiftCrews={KEY,CREWS,territory,relation,clean,change,contact};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function incident(point,kind){const crew=territory(point);if(!crew)return false;const amount=kind==='robbery'?-12:kind==='violence'?-8:0;if(!amount)return false;change(state,crew.id,amount);persist();return true}
function delivery(point){const crew=territory(point);if(!crew)return false;change(state,crew.id,8);change(state,CREWS.find(c=>c.id!==crew.id).id,-2);persist();root.NightshiftFeedback?.floating(player.x,player.y-45,'+8 '+crew.name,crew.color);return true}
function marketAccess(id){const crew=CREWS.find(c=>c.id===(id==='west'?'south':id==='docks'?'docks':null));return !crew||relation(state.crews[crew.id].rep)!=='HOSTILE'?null:crew.name+' refuses trade · deliver parcels or meet its contact to rebuild trust'}
function locations(){return CREWS.map(c=>({...c,action:relation(state.crews[c.id].rep)==='HOSTILE'?'PEACE':relation(state.crews[c.id].rep)==='TRUSTED'?'SUPPLY':'TALK',hint:c.name+' · '+relation(state.crews[c.id].rep)+' '+state.crews[c.id].rep+(relation(state.crews[c.id].rep)==='HOSTILE'?' · peace $250':relation(state.crews[c.id].rep)==='TRUSTED'?' · claim medkit':' · courier work builds trust')}))}
function use(id){
 if(root.NightshiftInterface?.expanded()||root.NightshiftTouchLayout?.paused()||['Businesses','Craft','Progress','Backups','Map','Vehicles','Home','Inventory','Recovery'].some(name=>root['Nightshift'+name]?.paused?.()))return false;
 const crew=CREWS.find(c=>c.id===id);if(!crew||root.NightshiftNavigation.trace(player,crew,blocked))return false;
 const result=contact(state,id,player,root.NightshiftInventory.state.pocket,Date.now());
 if(result.ok){persist();if(result.job){if(root.NightshiftActivities.stage==='idle')root.NightshiftActivities.act();else{const target=root.NightshiftActivities.target();if(target)root.NightshiftMap.navigate(target)}}save()}
 say(result.message||result.reason);return result.ok;
}
let lastTerritory=null;function tick(){const crew=territory(player),id=crew?.id||null;if(id!==lastTerritory){lastTerritory=id;if(crew&&relation(state.crews[id].rep)==='HOSTILE')say(crew.name+' territory · hostile · dealer trade refused')}}
function label(point){const crew=territory(point);return crew?relation(state.crews[crew.id].rep):''}
function draw(){for(const crew of CREWS){drawPerson({...crew,hp:40,moving:false});g.fillStyle=crew.color;g.fillRect(crew.x-9,crew.y+19,18,3);if(Math.hypot(player.x-crew.x,player.y-crew.y)<180){g.font='bold 10px monospace';g.textAlign='center';g.fillText(crew.name,crew.x,crew.y-32)}}}
Object.assign(root.NightshiftCrews,{state,save:persist,incident,delivery,marketAccess,locations,use,draw,tick,label});
})(globalThis);
