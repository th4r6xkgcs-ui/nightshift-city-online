/* Saved crew roster, loyalty and physical single-player escort jobs. */
(function(root){'use strict';
const KEY='nightshift-city-crew-ops-v1',LIMIT=3,DURATION=120000,COOLDOWN=180000;
const RECRUITS=[{id:'nico',name:'Nico',crew:'south',trait:'Steady',x:700,y:1080,color:'#88b7a4'},{id:'rae',name:'Rae',crew:'south',trait:'Ambitious',x:740,y:1080,color:'#cead80'},{id:'ash',name:'Ash',crew:'docks',trait:'Cautious',x:1580,y:1420,color:'#a9addb'},{id:'jules',name:'Jules',crew:'docks',trait:'Loyal',x:1620,y:1420,color:'#ba8dad'}];
const JOBS={south:{name:'Union clinic escort',x:440,y:340,reward:180},docks:{name:'Harbor supply escort',x:1740,y:680,reward:220}};
function clean(raw={},now=Date.now()){
 const owner=['south','docks','custom'].includes(raw?.owner)?raw.owner:null,roster={};
 if(owner)for(const r of RECRUITS){const v=raw?.roster?.[r.id];if(Object.keys(roster).length<LIMIT&&v&&(owner==='custom'||owner===r.crew))roster[r.id]={loyalty:Number.isSafeInteger(v.loyalty)?Math.max(0,Math.min(100,v.loyalty)):60,order:v.order==='hold'?'hold':'follow',x:Number.isFinite(v.x)&&v.x>=10&&v.x<=2190?v.x:r.x,y:Number.isFinite(v.y)&&v.y>=10&&v.y<=1690?v.y:r.y}}
 const cooldown=Number.isSafeInteger(raw?.cooldown)&&raw.cooldown>=0?Math.min(raw.cooldown,now+COOLDOWN):0;
 const j=raw?.job;if(owner&&roster[j?.member]&&Number.isSafeInteger(j?.until)&&j.until>0&&j.until<=now)roster[j.member].loyalty=Math.max(0,roster[j.member].loyalty-5);const valid=owner&&JOBS[j?.district]&&roster[j?.member]&&Number.isSafeInteger(j?.until)&&j.until>now&&Number.isSafeInteger(j?.started)&&j.started>=0&&j.started<=now;
 return {version:1,owner,roster,cooldown,completed:Number.isSafeInteger(raw?.completed)?Math.max(0,Math.min(1000000,raw.completed)):0,job:valid?{district:j.district,member:j.member,started:j.started,until:Math.min(j.until,now+DURATION)}:null};
}
function command(state,gang,crewState,actor,cmd,now=Date.now(),escort=null){
 const fail=reason=>({ok:false,reason});if(!gang?.member||state.owner&&state.owner!==gang.member)return fail('Join or found a gang first');
 if(!cmd||!Number.isSafeInteger(now)||now<0||!actor||actor.hp<=0||!Number.isFinite(actor.hp)||actor.car||![actor.x,actor.y,actor.heat].every(Number.isFinite)||actor.heat<0||actor.heat>=2||!Number.isSafeInteger(actor.cash)||actor.cash<0||actor.cash>100000000)return fail('Be on foot, alive and below heat 2');
 const spec=RECRUITS.find(r=>r.id===cmd.id),record=state.roster[cmd.id];
 if(cmd.action==='recruit'){
  if(!spec||gang.member!=='custom'&&gang.member!==spec.crew||Math.hypot(actor.x-spec.x,actor.y-spec.y)>60)return fail('Meet a recruit in your gang’s neighborhood');
  if(record)return fail('Already recruited');if(Object.keys(state.roster).length>=LIMIT)return fail('Roster full · maximum 3 members');if((crewState?.crews?.[spec.crew]?.rep??-100)<10)return fail('Need 10 local trust to recruit');if(actor.cash<150)return fail('Recruitment costs $150');
  actor.cash-=150;state.owner=gang.member;state.roster[spec.id]={loyalty:60,order:'follow'};return {ok:true,message:spec.name+' joined · −$150 · loyalty 60'};
 }
 if(['follow','hold','dismiss','care'].includes(cmd.action)){
  if(!record)return fail('Unknown crew member');if(cmd.action==='dismiss'&&state.job?.member===cmd.id)return fail('Cancel the active job before dismissing its escort');
  if(cmd.action==='care'){if(!spec||Math.hypot(actor.x-spec.x,actor.y-spec.y)>60)return fail('Meet at the recruiter to support your crew');if(record.loyalty>=100)return fail('Loyalty already full');if(actor.cash<50)return fail('Crew support costs $50');actor.cash-=50;record.loyalty=Math.min(100,record.loyalty+10)}else if(cmd.action==='dismiss')delete state.roster[cmd.id];else record.order=cmd.action;
  return {ok:true,message:cmd.action==='care'?'Crew support · −$50 · +10 loyalty':cmd.action==='dismiss'?'Member dismissed':cmd.action==='hold'?'Hold position':'Follow on foot'};
 }
 if(cmd.action==='cancel'){if(!state.job)return fail('No active crew job');const r=state.roster[state.job.member];if(r)r.loyalty=Math.max(0,r.loyalty-5);state.job=null;return {ok:true,message:'Escort cancelled · −5 loyalty · cooldown retained'}}
 if(cmd.action==='job'){
  const district=cmd.district,job=JOBS[district],contact=root.NightshiftGangLife.CONTACTS.find(c=>c.crew===district);
  if(!job||!contact||Math.hypot(actor.x-contact.x,actor.y-contact.y)>50||gang.member!=='custom'&&gang.member!==district)return fail('Meet your neighborhood contact');
  if(state.job)return fail('Finish or cancel the active job');if(now<state.cooldown)return fail('Crew jobs refill in '+Math.ceil((state.cooldown-now)/1000)+'s');
  const id=RECRUITS.find(r=>r.crew===district&&state.roster[r.id]?.loyalty>=40&&state.roster[r.id]?.order==='follow')?.id;
  if(!id)return fail('Need a following local member with loyalty 40+');state.job={district,member:id,started:now,until:now+DURATION};state.cooldown=now+COOLDOWN;return {ok:true,message:job.name+' · walk with your escort to the marker within 2 minutes'};
 }
 if(cmd.action==='complete'){
  const j=state.job,job=JOBS[j?.district];if(!j||!job)return fail('No active crew job');if(now>=j.until)return fail('Escort deadline expired');if(now-j.started<10000)return fail('Escort has just started');
  if(Math.hypot(actor.x-job.x,actor.y-job.y)>50||!escort||Math.hypot(escort.x-job.x,escort.y-job.y)>65)return fail('Bring yourself and your escort to the destination');
  if(actor.cash+job.reward>100000000)return fail('Wallet full');actor.cash+=job.reward;state.roster[j.member].loyalty=Math.min(100,state.roster[j.member].loyalty+8);root.NightshiftCrews.change(crewState,j.district,4);state.completed=Math.min(1000000,state.completed+1);state.job=null;
  return {ok:true,message:'Escort complete · +$'+job.reward+' · +8 loyalty · +4 local trust'};
 }return fail('Unknown crew order');
}
function follow(actor,target,dt,now,context){
 const before={x:actor.x,y:actor.y};actor.moving=false;if(![actor.x,actor.y,target?.x,target?.y,dt,now].every(Number.isFinite)||dt<=0)return;
 if(Math.hypot(actor.x-target.x,actor.y-target.y)<12)return;
 if(now>=(actor.nextRoute||0)){actor.path=root.NightshiftNavigation.route(actor,target,(x,y)=>context.blocked(x,y)||context.cars.some(c=>Math.abs(c.velocity??((c.speed||0)*60))<8&&root.NightshiftVehicleGeometry.circleOverlap({x,y},c,9)),context.world.w,context.world.h);actor.nextRoute=now+1500}
 while(actor.path?.length&&Math.hypot(actor.x-actor.path[0].x,actor.y-actor.path[0].y)<6)actor.path.shift();const p=actor.path?.[0];if(!p)return;
 const d=Math.hypot(p.x-actor.x,p.y-actor.y),n=Math.min(d,(Math.hypot(actor.x-target.x,actor.y-target.y)>180?4:2.6)*Math.max(0,Math.min(3,dt))),to={x:actor.x+(p.x-actor.x)/d*n,y:actor.y+(p.y-actor.y)/d*n};
 if(!root.NightshiftStreetLife.crossingWait(actor,to,context.cars,now)&&root.NightshiftCitizens.canStep(actor,to,context.blocked,context.cars)&&(context.people||[]).every(p=>p===actor||Math.hypot(to.x-p.x,to.y-p.y)>=14||Math.hypot(to.x-p.x,to.y-p.y)>Math.hypot(actor.x-p.x,actor.y-p.y))){actor.x=to.x;actor.y=to.y}
 actor.moving=Math.hypot(actor.x-before.x,actor.y-before.y)>.01;if(actor.moving){actor.walkTicks=(actor.walkTicks||0)+dt;actor.moveAngle=Math.atan2(actor.y-before.y,actor.x-before.x);actor.angle=actor.moveAngle}
}
root.NightshiftCrewOps={KEY,RECRUITS,JOBS,LIMIT,clean,command,follow};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
const actors=new Map();function persist(){for(const [id,a] of actors)if(state.roster[id]){state.roster[id].x=a.x;state.roster[id].y=a.y}try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function sync(){if(state.owner&&state.owner!==root.NightshiftGangLife.state.member){state.owner=null;state.roster={};state.job=null;actors.clear();root.NightshiftMap?.clear('crew-escort');persist()}for(const id of [...actors.keys()])if(!state.roster[id])actors.delete(id)}
function actor(id){if(!actors.has(id)){const spec=RECRUITS.find(r=>r.id===id);if(spec){const r=state.roster[id],pos={x:r?.x??spec.x,y:r?.y??spec.y};const candidates=[pos,{x:spec.x,y:spec.y-16},{x:spec.x-20,y:spec.y-16},{x:spec.x+20,y:spec.y-16}],safe=candidates.find(p=>!root.NightshiftNavigation.trace(p,p,blocked,8)&&!root.NightshiftCitizens.occupied(p,cars));actors.set(id,{...spec,...(safe||pos),hp:40,moving:false})}}return actors.get(id)}
function perform(cmd){
 sync();if(!root.NightshiftGangLife.paused())return {ok:false,reason:'Open STREET to manage your crew'};
 const result=command(state,root.NightshiftGangLife.state,root.NightshiftCrews.state,player,cmd,Date.now(),state.job?actor(state.job.member):null);
 if(result.ok){persist();root.NightshiftCrews.save();save();if(cmd.action==='job'){const job=JOBS[state.job.district];root.NightshiftGangLife.close();root.NightshiftMap.navigate({id:'crew-escort',label:job.name,x:job.x,y:job.y})}else if(['cancel','complete'].includes(cmd.action))root.NightshiftMap.clear('crew-escort')}
 root.NightshiftGangLife.refresh(result.message||result.reason);say(result.message||result.reason);return result;
}
function tick(now,dt){
 sync();if(state.job&&Date.now()>=state.job.until){state.roster[state.job.member].loyalty=Math.max(0,state.roster[state.job.member].loyalty-5);state.job=null;persist();root.NightshiftMap.clear('crew-escort');say('Crew escort expired · −5 loyalty')}
 let index=0;for(const [id,record] of Object.entries(state.roster)){const a=actor(id),offset=++index;
  if(record.order!=='follow'||record.loyalty<40||player.car||player.hp<=0){a.moving=false;continue}
  const angle=(player.moveAngle??player.angle)+Math.PI+(offset%2?.55:-.55),target={x:Math.max(10,Math.min(world.w-10,player.x+Math.cos(angle)*(36+offset*12))),y:Math.max(10,Math.min(world.h-10,player.y+Math.sin(angle)*(36+offset*12)))};
  if(root.NightshiftNavigation.trace(target,target,blocked,8)){const alternatives=[{x:player.x,y:player.y-50},{x:player.x,y:player.y+50},{x:player.x-50,y:player.y},{x:player.x+50,y:player.y}];const safe=alternatives.find(p=>p.x>=10&&p.y>=10&&p.x<=world.w-10&&p.y<=world.h-10&&!root.NightshiftNavigation.trace(p,p,blocked,8));if(!safe){a.moving=false;continue}Object.assign(target,safe)}follow(a,target,dt,now,{cars:[...cars,...(root.NightshiftTraffic?.actors||[])],blocked,world,people:[...actors.values(),...peds]});
 }
}
function entries(){sync();return Object.keys(state.roster).map(id=>({kind:'crew-member',entity:actor(id)}))}
function locations(){return state.job?[{id:'crew-escort',...JOBS[state.job.district],action:'FINISH',hint:'Complete crew escort · bring '+RECRUITS.find(r=>r.id===state.job.member).name}]:[]}
function complete(){if(!state.job)return false;const result=command(state,root.NightshiftGangLife.state,root.NightshiftCrews.state,player,{action:'complete'},Date.now(),actor(state.job.member));if(result.ok){persist();root.NightshiftCrews.save();save();root.NightshiftMap.clear('crew-escort')}say(result.message||result.reason);return result.ok}
function badge(a){const r=state.roster[a.id];if(!r)return;g.save();g.fillStyle='#102a3bcc';g.fillRect(a.x-19,a.y+22,38,14);g.font='bold 8px monospace';g.textAlign='center';g.fillStyle='#b9e3c8';g.fillText(a.name,a.x,a.y+32);g.fillStyle='#375358';g.fillRect(a.x-15,a.y+38,30,3);g.fillStyle=r.loyalty<40?'#eeb776':'#8fcead';g.fillRect(a.x-15,a.y+38,30*r.loyalty/100,3);g.restore()}
function hud(){return state.job?'<br>Crew escort · '+Math.max(0,Math.ceil((state.job.until-Date.now())/1000))+'s · bring '+RECRUITS.find(r=>r.id===state.job.member).name:''}
function controls(parent,contact){
 sync();if(!root.NightshiftGangLife.state.member)return;const doc=root.document,add=(tag,value)=>{const n=doc.createElement(tag);n.textContent=value;parent.appendChild(n);return n},button=(label,cmd)=>{const b=add('button',label);b.type='button';b.addEventListener('click',()=>perform(cmd))};
 add('h3','CREW · '+Object.keys(state.roster).length+'/'+LIMIT);
 for(const spec of RECRUITS){const r=state.roster[spec.id];if(r){add('p',spec.name+' · '+spec.trait+' · loyalty '+r.loyalty+' · '+(r.loyalty<40?'needs support':r.order));button(r.order==='follow'?'Hold position':'Follow on foot',{action:r.order==='follow'?'hold':'follow',id:spec.id});if(contact?.crew===spec.crew)button('Support '+spec.name+' · $50 / +10 loyalty',{action:'care',id:spec.id});button('Dismiss '+spec.name,{action:'dismiss',id:spec.id})}else if(contact?.crew===spec.crew)button('Recruit '+spec.name+' · '+spec.trait+' · $150 / 10 trust',{action:'recruit',id:spec.id})}
 if(state.job){add('p',JOBS[state.job.district].name+' · '+Math.max(0,Math.ceil((state.job.until-Date.now())/1000))+'s left');const track=add('button','Track escort destination');track.addEventListener('click',()=>{const job=JOBS[state.job.district];root.NightshiftGangLife.close();root.NightshiftMap.navigate({id:'crew-escort',label:job.name,x:job.x,y:job.y})});button('Cancel escort · −5 loyalty',{action:'cancel'})}else if(contact?.crew)button('Take crew escort · $'+JOBS[contact.crew].reward,{action:'job',district:contact.crew});
 add('p','Followers walk with you and wait while you drive. Loyalty below 40 stops following. Escort success earns loyalty; cancellation or expiry loses 5. Recruitment fees are nonrefundable.');
}
Object.assign(root.NightshiftCrewOps,{state,save:persist,sync,perform,tick,entries,locations,complete,controls,badge,hud});persist();root.addEventListener('pagehide',persist);
})(globalThis);
