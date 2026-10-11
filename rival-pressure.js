/* Local corner challenges: choices and physical crew presence, no combat authority. */
(function(root){'use strict';
const KEY='nightshift-city-rival-pressure-v1',INTERVAL=180000,WINDOW=120000,HOLD=15000,IDS=['south','docks'];
function clean(raw={},now=Date.now()){
 const districts={};for(const id of IDS){const r=raw?.districts?.[id],next=Number.isSafeInteger(r?.nextAt)&&r.nextAt>0?Math.min(r.nextAt,now+INTERVAL):0,until=r?.challenge?.until;
  // No offline corner losses: a saved confrontation gets a fresh response window.
  districts[id]={nextAt:next,challenge:Number.isSafeInteger(until)&&until>0?{until:now+WINDOW,standingSince:0}:null};
 }return {version:1,districts,wins:Number.isSafeInteger(raw?.wins)?Math.max(0,Math.min(1000000,raw.wins)):0,losses:Number.isSafeInteger(raw?.losses)?Math.max(0,Math.min(1000000,raw.losses)):0};
}
function present(id,actor,members,roster){const contact=root.NightshiftGangLife.CONTACTS.find(c=>c.crew===id);return !!contact&&actor?.hp>0&&!actor.car&&actor.heat<2&&Number.isFinite(actor.x)&&Number.isFinite(actor.y)&&Math.hypot(actor.x-contact.x,actor.y-contact.y)<=55&&members.some(m=>m.crew===id&&roster[m.id]?.loyalty>=40&&Math.hypot(m.x-contact.x,m.y-contact.y)<=100)}
function advance(state,gang,actor,members,roster,now){
 const events=[];if(!Number.isSafeInteger(now)||now<0)return events;
 for(const id of IDS){const d=state.districts[id];
  if(!gang.member||!gang.corners[id]){d.challenge=null;d.nextAt=0;continue}
  if(!d.nextAt){d.nextAt=now+INTERVAL;continue}
  if(!d.challenge&&now>=d.nextAt){d.challenge={until:now+WINDOW,standingSince:0};events.push({id,type:'challenge'});continue}
  const c=d.challenge;if(!c)continue;
  if(now>=c.until){gang.corners[id]=false;d.challenge=null;d.nextAt=0;state.losses=Math.min(1000000,state.losses+1);events.push({id,type:'lost'});continue}
  if(c.standingSince){if(!present(id,actor,members,roster)){c.standingSince=0;events.push({id,type:'interrupted'})}else if(now-c.standingSince>=HOLD){d.challenge=null;d.nextAt=now+INTERVAL;state.wins=Math.min(1000000,state.wins+1);events.push({id,type:'held'})}}
 }return events;
}
function resolve(state,gang,actor,members,roster,id,action,now=Date.now()){
 const fail=reason=>({ok:false,reason}),d=state.districts[id],contact=root.NightshiftGangLife.CONTACTS.find(c=>c.crew===id);
 if(!d||!contact||!Number.isSafeInteger(now)||now<0||!gang.member||!gang.corners[id]||!d.challenge||now>=d.challenge.until)return fail('No active corner challenge');
 if(!actor||!Number.isFinite(actor.hp)||actor.hp<=0||actor.car||![actor.x,actor.y,actor.heat].every(Number.isFinite)||actor.heat<0||actor.heat>=2||Math.hypot(actor.x-contact.x,actor.y-contact.y)>55)return fail('Meet at the corner on foot with heat below 2');
 if(action==='stand'){if(!present(id,actor,members,roster))return fail('Bring a local member with loyalty 40+ to the corner');if(d.challenge.standingSince)return fail('Already standing ground');d.challenge.standingSince=now||1;return {ok:true,message:'Stand with your local crew for 15 seconds · stay within the corner'};}
 if(action==='negotiate'){
  if(!Number.isSafeInteger(actor.cash)||actor.cash<100||actor.cash>100000000)return fail('Negotiation costs $100');actor.cash-=100;d.challenge=null;d.nextAt=now+INTERVAL;state.wins=Math.min(1000000,state.wins+1);return {ok:true,message:'Truce negotiated · −$100 · corner retained'};
 }
 if(action==='cede'){gang.corners[id]=false;d.challenge=null;d.nextAt=0;state.losses=Math.min(1000000,state.losses+1);return {ok:true,message:'Corner ceded · reclaim later through local trust'};}
 return fail('Unknown rival choice');
}
root.NightshiftRivals={KEY,INTERVAL,WINDOW,HOLD,clean,present,advance,resolve};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
let nextTick=0,labels=[];function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function tick(){const now=Date.now();if(now<nextTick)return;nextTick=now+250;const events=advance(state,root.NightshiftGangLife.state,player,root.NightshiftCrewOps.entries().map(e=>e.entity),root.NightshiftCrewOps.state.roster,now);
 if(events.length){persist();root.NightshiftGangLife.save();for(const e of events){const place=e.id==='south'?'Southside':'Harbor';say(e.type==='challenge'?place+' rivals challenge your corner · STREET to respond':e.type==='lost'?place+' corner lost · rival deadline passed':e.type==='interrupted'?'Standing ground interrupted · regroup at the corner':place+' corner defended · rivals backed down')}}
}
function perform(id,action){if(!root.NightshiftGangLife.paused())return {ok:false,reason:'Open the corner dialogue first'};tick();const result=resolve(state,root.NightshiftGangLife.state,player,root.NightshiftCrewOps.entries().map(e=>e.entity),root.NightshiftCrewOps.state.roster,id,action,Date.now());
 if(result.ok){persist();root.NightshiftGangLife.save();save();if(action==='stand')root.NightshiftGangLife.close()}
 root.NightshiftGangLife.refresh(result.message||result.reason);say(result.message||result.reason);return result;
}
function controls(parent,contact){
 labels=[];const doc=root.document,add=(tag,t)=>{const n=doc.createElement(tag);n.textContent=t;parent.appendChild(n);return n};
 for(const id of IDS){if(!root.NightshiftGangLife.state.corners[id])continue;const d=state.districts[id],place=id==='south'?'Southside':'Harbor';add('h3',place+' CORNER');
  if(!d.challenge){add('p','Held · rivals can challenge this corner while you play. Reopening the game grants a response window.');continue}
  const status=add('p','');status.setAttribute('role','status');labels.push({id,node:status});status.textContent=challengeText(id);
  if(contact?.crew===id)for(const [label,action] of [['Negotiate truce · $100','negotiate'],['Stand with crew · 15 seconds','stand'],['Cede corner','cede']]){const b=add('button',label);b.type='button';b.addEventListener('click',()=>perform(id,action))}
  else{const b=add('button','Track challenged corner');b.addEventListener('click',()=>{const c=root.NightshiftGangLife.CONTACTS.find(c=>c.crew===id);root.NightshiftGangLife.close();root.NightshiftMap.navigate({id:'rival-'+id,label:place+' corner challenge',x:c.x,y:c.y})})}
 }
}
function challengeText(id){const c=state.districts[id].challenge;if(!c)return 'Challenge resolved';const seconds=Math.max(0,Math.ceil((c.until-Date.now())/1000));return seconds?'Rival challenge · '+seconds+'s to respond. Negotiate, stand with a loyal local member, or cede the corner.':'Deadline passed · respond to resolve the corner';}
setInterval(()=>{if(root.NightshiftGangLife?.paused())for(const entry of labels)entry.node.textContent=challengeText(entry.id)},1000);
function hud(){for(const id of IDS){const c=state.districts[id].challenge;if(c&&root.NightshiftGangLife.state.corners[id])return '<br>Rival corner · '+Math.max(0,Math.ceil((c.until-Date.now())/1000))+'s'+(c.standingSince?' · hold '+Math.max(0,Math.ceil((HOLD-Date.now()+c.standingSince)/1000))+'s':' · STREET')}return ''}
function draw(){for(const id of IDS){if(!state.districts[id].challenge||!root.NightshiftGangLife.state.corners[id])continue;const c=root.NightshiftGangLife.CONTACTS.find(c=>c.crew===id),p={x:c.x-85,y:c.y-16};if(!root.NightshiftScene.visible(p,{...camera,width:W,height:H}))continue;drawPerson({...p,hp:40,color:'#d38791',moving:false});g.fillStyle='#edb2b2';g.font='bold 9px monospace';g.textAlign='center';g.fillText('RIVAL ENVOY',p.x,p.y-26)}}
Object.assign(root.NightshiftRivals,{state,save:persist,tick,perform,controls,hud,draw});persist();root.addEventListener('pagehide',persist);
})(globalThis);
