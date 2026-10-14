/* Authored local street opportunities with bounded, persisted cooldowns. */
(function(root){'use strict';
const KEY='nightshift-city-encounters-v1',WAIT=120000,LEAD_TIME=300000;
const SITES=[
 {id:'lost-wallet',x:640,y:1300,label:'LOST WALLET',type:'wallet',color:'#e9c57b'},
 {id:'supply-cache',x:1490,y:944,label:'SUPPLY CACHE',type:'cache',color:'#8fddc4'},
 {id:'street-tip',x:1960,y:960,label:'STREET TIP',type:'tip',color:'#c6a4f0'},
 {id:'south-aid',x:760,y:1288,label:'SOUTHSIDE AID CALL',type:'aid',crew:'south',item:'medkit',count:1,color:'#efbb66'},
 {id:'harbor-repair',x:1700,y:944,label:'HARBOR REPAIR REQUEST',type:'aid',crew:'docks',item:'scrap',count:2,color:'#bf9feb'}
];
const TIP_TARGET={id:'tip-drop',x:1740,y:680,label:'INVESTIGATE TIP',type:'lead',color:'#c6a4f0'};
function clean(raw={},now=Date.now()){
 const ready={};for(const site of SITES){const n=raw?.ready?.[site.id];ready[site.id]=Number.isSafeInteger(n)&&n>=0?Math.min(n,now+WAIT):0}
 const until=raw?.lead?.until;return {ready,lead:Number.isSafeInteger(until)&&until>now?{until:Math.min(until,now+LEAD_TIME)}:null};
}
function resolve(state,id,actor,pocket,now=Date.now()){
 const fail=reason=>({ok:false,reason}),site=id===TIP_TARGET.id?TIP_TARGET:SITES.find(s=>s.id===id);
 if(!site||!state?.ready)return fail('Unknown encounter');
 if(!Number.isSafeInteger(now)||now<0||!actor||!Number.isFinite(actor.x)||!Number.isFinite(actor.y)||!Number.isFinite(actor.hp)||actor.hp<=0||actor.car||Math.hypot(actor.x-site.x,actor.y-site.y)>50)return fail('Approach on foot');
 if(site.type==='lead'&&(!state.lead||now>=state.lead.until))return fail('Tip expired · seek another lead');
 if(site.type==='tip'&&state.lead&&now<state.lead.until)return {ok:true,route:TIP_TARGET,message:'Follow the marked lead · $50 on investigation'};
 if(site.type!=='lead'&&now<state.ready[id])return fail('Nothing here yet');
 if(site.type==='wallet'||site.type==='lead'){
  const reward=site.type==='wallet'?100:50;
  if(!Number.isSafeInteger(actor.cash)||actor.cash<0||actor.cash>100000000-reward)return fail('Wallet full');
  if(site.type==='wallet'&&(!Number.isFinite(actor.heat)||actor.heat<0||actor.heat>5))return fail('Invalid wanted state');
  actor.cash+=reward;if(site.type==='wallet')actor.heat=Math.min(5,actor.heat+.3);
 }
 if(site.type==='cache'){
  const count=pocket?.medkit??0;if(!Number.isSafeInteger(count)||count<0||count>=999)return fail('Pockets full');pocket.medkit=count+1;
 }
 if(site.type==='aid'){
  const held=pocket?.[site.item]??0;if(!Number.isSafeInteger(held)||held<site.count)return fail('Need '+site.count+' carried '+site.item+' · +8 crew trust');
  if(!Number.isFinite(actor.heat)||actor.heat>=2)return fail('Lose police pressure before helping');
  pocket[site.item]-=site.count;if(!pocket[site.item])delete pocket[site.item];
 }
 if(site.type==='lead'){state.lead=null;return {ok:true,message:'Tip investigated · +$50',clearRoute:true}}
 state.ready[id]=now+WAIT;
 if(site.type==='tip'){state.lead={until:now+LEAD_TIME};return {ok:true,route:TIP_TARGET,message:'Street tip · investigate the purple marker within 5 minutes · $50'}}
 return {ok:true,crew:site.crew,message:site.type==='wallet'?'Found $100 · suspicious pickup increased heat':site.type==='cache'?'Found 1 medkit · drops on death':'Helped '+site.label+' · +8 crew trust'};
}
root.NightshiftEncounters={KEY,SITES,WAIT,LEAD_TIME,TIP_TARGET,clean,resolve};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
function saveState(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function expire(now){if(state.lead&&now>=state.lead.until){state.lead=null;saveState();root.NightshiftMap?.clear('encounter-tip')}}
function locations(){const now=Date.now();expire(now);const sites=SITES.filter(s=>now>=state.ready[s.id]||(s.type==='tip'&&state.lead)).map(s=>({...s,ready:true,action:s.type==='aid'?'HELP':s.type==='tip'?'TIP':'SEARCH',hint:s.type==='aid'?s.label+' · '+s.count+' '+s.item+' → +8 trust':s.type==='wallet'?'Keep lost wallet · +$100 · +0.3 heat':s.type==='cache'?'Supply cache · +1 carried medkit':'Street tip · investigate a lead for $50'}));if(state.lead)sites.push({...TIP_TARGET,ready:true,action:'CHECK',hint:'Investigate tip · +$50 · '+Math.ceil((state.lead.until-now)/1000)+'s remaining'});return sites}
function use(id){
 if(root.NightshiftInterface?.expanded()||root.NightshiftTouchLayout?.paused()||['Businesses','Craft','Progress','Backups','Map','Vehicles','Home','Inventory','Recovery'].some(n=>root['Nightshift'+n]?.paused?.()))return false;
 const now=Date.now();expire(now);const site=id===TIP_TARGET.id?TIP_TARGET:SITES.find(s=>s.id===id);if(!site||root.NightshiftNavigation.trace(player,site,blocked))return false;
 const result=resolve(state,id,player,root.NightshiftInventory.state.pocket,now);
 if(result.ok){
  if(result.crew){root.NightshiftCrews.change(root.NightshiftCrews.state,result.crew,8);root.NightshiftCrews.save()}
  if(site.type==='wallet')root.NightshiftCrime?.report(site,performance.now(),'suspicious-pickup');
  saveState();save();root.NightshiftAudio?.play('pickup');
  if(result.route)root.NightshiftMap?.navigate({...result.route,id:'encounter-tip'});
  if(result.clearRoute)root.NightshiftMap?.clear('encounter-tip');
 }say(result.message||result.reason);return result.ok;
}
function draw(){for(const site of locations()){g.save();if(site.type==='aid')drawPerson({...site,hp:40,moving:false});else{g.fillStyle=site.color;g.fillRect(site.x-8,site.y-8,16,16);g.fillStyle='#16283b';g.fillRect(site.x-4,site.y-4,8,8);}if(Math.hypot(player.x-site.x,player.y-site.y)<160){g.font='bold 10px monospace';g.textAlign='center';g.fillStyle=site.color;g.fillText(site.label,site.x,site.y-24)}g.restore()}}
Object.assign(root.NightshiftEncounters,{state,save:saveState,locations,use,draw});
})(globalThis);
