/* Single-player gang choices built on existing reputation and market rules. */
(function(root){'use strict';
const KEY='nightshift-city-gang-life-v1',WAIT=60000;
const CONTACTS=[{id:'south-recruiter',crew:'south',x:720,y:1080,name:'Mara · Southside Union',color:'#efbb66'},{id:'docks-recruiter',crew:'docks',x:1600,y:1420,name:'Inez · Harbor Crew',color:'#bf9feb'},{id:'west-buyer',market:'west',x:488,y:1020,name:'Sol · West End buyer',color:'#92cbb7'},{id:'docks-buyer',market:'docks',x:1808,y:1360,name:'Vee · Docks buyer',color:'#d6aad8'}];
function name(value){return typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,24):''}
function validName(value){return /^[a-zA-Z0-9][a-zA-Z0-9 _-]{2,23}$/.test(value)}
function clean(raw={},now=Date.now()){
 const own=name(raw?.name),created=validName(own),member=['south','docks'].includes(raw?.member)?raw.member:raw?.member==='custom'&&created?'custom':null;
 const corners={},workAt={};for(const id of ['south','docks']){corners[id]=!!member&&(member==='custom'||member===id)&&raw?.corners?.[id]===true;const n=raw?.workAt?.[id];workAt[id]=Number.isSafeInteger(n)&&n>=0?Math.min(n,now+WAIT):0}
 return {version:1,member,name:created?own:'',corners,workAt};
}
function resolve(state,crewState,actor,pocket,contactId,cmd,now=Date.now()){
 const fail=reason=>({ok:false,reason}),contact=CONTACTS.find(c=>c.id===contactId);
 if(!contact||!cmd||!Number.isSafeInteger(now)||now<0)return fail('Unknown street contact');
 if(!actor||actor.hp<=0||!Number.isFinite(actor.hp)||actor.car||![actor.x,actor.y,actor.heat].every(Number.isFinite)||actor.heat<0||actor.heat>=2||Math.hypot(actor.x-contact.x,actor.y-contact.y)>50)return fail('Meet on foot, alive and with heat below 2');
 if(!Number.isSafeInteger(actor.cash)||actor.cash<0||actor.cash>100000000)return fail('Invalid wallet');
 if(!contact.crew)return fail('This buyer handles street trades');
 const id=contact.crew,rep=crewState?.crews?.[id]?.rep;if(!Number.isSafeInteger(rep))return fail('Crew unavailable');
 if(cmd.action==='join'){
  if(state.member)return fail('Leave your current gang first');if(rep<0)return fail('Rebuild local trust before joining');state.member=id;return {ok:true,message:'Joined '+(id==='south'?'Southside Union':'Harbor Crew')+' · earn trust with deliveries and aid'};
 }
 if(cmd.action==='found'){
  if(state.member)return fail('Leave your current gang first');if(rep<0)return fail('Rebuild local trust before founding here');
  const label=state.name||name(cmd.name);if(!validName(label))return fail('Use 3–24 letters, numbers, spaces, _ or -');
  const cost=state.name?0:500;if(actor.cash<cost)return fail('Founding a gang costs $500');actor.cash-=cost;state.name=label;state.member='custom';return {ok:true,message:(cost?'Founded ':'Rejoined ')+label+(cost?' · −$500':'')};
 }
 if(cmd.action==='leave'){
  if(!state.member)return fail('You are independent');state.member=null;state.corners.south=false;state.corners.docks=false;return {ok:true,message:'Left gang · corner claims released'};
 }
 if(cmd.action==='work'){
  if(now<state.workAt[id])return fail('Street work available in '+Math.ceil((state.workAt[id]-now)/1000)+'s');
  if(!Number.isSafeInteger(pocket?.scrap)||pocket.scrap<2)return fail('Bring 2 carried scrap for the neighborhood repair job');
  if(rep>=100)return fail('Local trust is already at its maximum');
  if(!root.NightshiftCrews.change(crewState,id,8))return fail('Crew unavailable');pocket.scrap-=2;if(!pocket.scrap)delete pocket.scrap;state.workAt[id]=now+WAIT;return {ok:true,message:'Neighborhood repairs · −2 scrap · +8 local trust'};
 }
 if(cmd.action==='claim'){
  if(!state.member)return fail('Join or found a gang first');if(state.member!=='custom'&&state.member!==id)return fail('Your NPC gang operates in its own neighborhood');
  if(rep<20)return fail('Need 20 local trust · deliveries, aid and repairs build it');if(state.corners[id])return fail('Your gang already holds this corner');
  if(actor.cash<250)return fail('Securing a corner costs $250');actor.cash-=250;state.corners[id]=true;return {ok:true,message:'Secured '+(id==='south'?'Southside':'Harbor')+' corner · −$250'};
 }
 return fail('Unknown dialogue choice');
}
root.NightshiftGangLife={KEY,CONTACTS,WAIT,name,validName,clean,resolve};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
let selected=null;const doc=root.document,panel=doc.createElement('section');panel.id='gangLifePanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Street life dialogue');doc.body.appendChild(panel);
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function close(){selected=null;panel.hidden=true;root.releaseControls?.()}
function otherMenu(){return root.NightshiftInterface?.expanded()||root.NightshiftTouchLayout?.paused()||['Businesses','Craft','Progress','Backups','Map','Vehicles','Inventory','Recovery','Home','Dailies','Weapons','Casino','Tuning','HomeUpgrades'].some(n=>root['Nightshift'+n]?.paused?.())||['#skPanel','#glPanel'].some(id=>doc.querySelector(id)?.hidden===false)}
function nearby(contact){return player.hp>0&&!player.car&&Math.hypot(player.x-contact.x,player.y-contact.y)<=50&&!root.NightshiftNavigation.trace(player,contact,blocked)}
function text(tag,value){const n=doc.createElement(tag);n.textContent=value;panel.appendChild(n);return n}
function button(label,fn){const b=text('button',label);b.type='button';b.addEventListener('click',fn);return b}
function gangName(){return state.member==='custom'?state.name:root.NightshiftCrews.CREWS.find(c=>c.id===state.member)?.name||'Independent'}
function perform(cmd){
 const contact=CONTACTS.find(c=>c.id===selected);if(panel.hidden||!contact||otherMenu()||!nearby(contact))return {ok:false,reason:'Dialogue unavailable'};
 let result;const now=Date.now();
 if(contact.market){
  if(!['buy','sell'].includes(cmd?.action))return {ok:false,reason:'Unknown trade'};
  const refusal=root.NightshiftCrews.marketAccess(contact.market);
  root.NightshiftBusinessRules.advance(root.NightshiftBusinesses.state,now);
  result=refusal?{ok:false,reason:refusal}:root.NightshiftBusinessRules.transact(root.NightshiftBusinesses.state,player,root.NightshiftInventory.state.pocket,{...cmd,id:contact.market},now);
 }else result=resolve(state,root.NightshiftCrews.state,player,root.NightshiftInventory.state.pocket,selected,cmd,now);
 if(result.ok){root.NightshiftCrewOps?.sync();persist();root.NightshiftCrews.save();root.NightshiftBusinesses.save();save();root.NightshiftAudio?.play('pickup')}
 const message=result.message||result.reason;render(message);say(message);return result;
}
function render(message=''){
 const contact=CONTACTS.find(c=>c.id===selected);panel.textContent='';text('small','NIGHTSHIFT · STREET LIFE');text('h2',contact?contact.name:'Find your place in the city');
 text('p',gangName()+' · $'+player.cash+' · Heat '+player.heat.toFixed(1));
 if(message){const status=text('p',message);status.setAttribute('role','status')}
 if(!contact){text('p','Visit Mara in Southside or Inez at the harbor to join their gang or found your own. Buyers trade the stock in your pockets.');for(const c of CONTACTS)button('Go to '+c.name,()=>{close();root.NightshiftMap.navigate({id:'street-'+c.id,label:c.name,x:c.x,y:c.y})})}
 else if(contact.crew){
  const rep=root.NightshiftCrews.state.crews[contact.crew].rep;
  text('blockquote',rep<0?'“The neighborhood remembers. Make things right before we talk business.”':state.member?'“Show up for the block. Respect opens doors.”':'“You can run with us, or build something of your own. Your call.”');
  text('p','Local trust '+rep+'/100 · Corner '+(state.corners[contact.crew]?'held by '+gangName():'unclaimed')+' · Found $500 · Secure corner $250 / 20 trust');
  if(!state.member){button('Join '+root.NightshiftCrews.CREWS.find(c=>c.id===contact.crew).name,()=>perform({action:'join'}));const input=text('input','');input.value=state.name;input.maxLength=24;input.placeholder='Your gang name';input.setAttribute('aria-label','Your gang name');button(state.name?'Rejoin '+state.name:'Found your own gang · $500',()=>perform({action:'found',name:input.value}))}
  else{button('Secure this corner · $250',()=>perform({action:'claim'}));button('Leave gang · release corner claims',()=>perform({action:'leave'}))}
  button('Help the neighborhood · 2 scrap → +8 trust',()=>perform({action:'work'}));text('p','Deliveries and aid calls also improve the existing crew reputation. Repairs refill once a minute. Corners are local influence markers; no passive cash.');
 }else{
  const market=root.NightshiftBusinessRules.market(contact.market),pocket=root.NightshiftInventory.state.pocket;
  text('blockquote','“Small deals. Local demand. Keep the police off this corner.”');
  for(const item of ['weed','coke']){text('p',item.toUpperCase()+' · carried '+(pocket[item]||0));button('Buy 1 '+item+' · $'+market.buy[item],()=>perform({action:'buy',item,count:1}));button('Sell 1 '+item+' · $'+market.sell[item],()=>perform({action:'sell',item,count:1}))}
  text('p','Uses the city’s dealer stock, demand and heat. Carried goods drop on death. Heat 2+ or hostile local reputation blocks trade.');
 }
 root.NightshiftCrewOps?.controls(panel,contact);button('Close',close);
}
function open(id=null){if(!panel.hidden||otherMenu()||player.hp<=0)return false;const contact=CONTACTS.find(c=>c.id===id);if(id&&(!contact||!nearby(contact)))return false;root.releaseControls?.();selected=id;panel.hidden=false;render();return true}
function locations(){return CONTACTS.map(c=>({...c,action:'TALK',hint:c.name+' · '+(c.crew?'gang choices and street work':'buy / sell carried stock')}))}
function draw(){for(const c of CONTACTS){if(!root.NightshiftScene.visible(c,{...camera,width:W,height:H}))continue;drawPerson({...c,hp:40,moving:false});g.fillStyle=c.color;g.fillRect(c.x-10,c.y+18,20,3);if(Math.hypot(player.x-c.x,player.y-c.y)<170){g.font='bold 10px monospace';g.textAlign='center';const width=Math.min(174,c.name.length*6+12);g.fillStyle='#102839dd';g.fillRect(c.x-width/2,c.y+25,width,18);g.fillStyle=c.color;g.fillText(c.name,c.x,c.y+37);if(c.crew&&state.corners[c.crew])g.fillText(gangName()+' CORNER',c.x,c.y+55)}}}
Object.assign(root.NightshiftGangLife,{state,save:persist,paused:()=>!panel.hidden,open,close,perform,refresh:message=>{if(!panel.hidden)render(message)},locations,draw,gangName});
const chip=doc.createElement('button');chip.id='street';chip.textContent='STREET';chip.setAttribute('aria-label','Street life and gangs');chip.addEventListener('click',()=>{root.NightshiftInterface?.close();open()});doc.querySelector('#actions').appendChild(chip);root.addEventListener('keydown',e=>{if(panel.hidden)return;if(e.key==='Escape'){close();e.preventDefault?.()}e.stopImmediatePropagation?.()},true);root.addEventListener('pagehide',persist);
})(globalThis);
