/* Client-only street encounters. Fixed authored sites, no random real-world activity. */
(function(root){'use strict';
const KEY='nightshift-city-encounters-v1',WAIT=120000;
const SITES=[{id:'lost-wallet',x:520,y:1120,label:'LOST WALLET',type:'wallet',color:'#e9c57b'},{id:'supply-cache',x:1490,y:1050,label:'SUPPLY CACHE',type:'cache',color:'#8fddc4'},{id:'street-tip',x:1850,y:780,label:'STREET TIP',type:'tip',color:'#c6a4f0'}];
function clean(raw={},now=Date.now()){const ready={};for(const s of SITES){const n=raw?.ready?.[s.id];ready[s.id]=Number.isSafeInteger(n)&&n>=0?Math.min(n,now+WAIT):0}return {ready}}
function resolve(state,id,actor,pocket,now=Date.now()){
 const site=SITES.find(s=>s.id===id);if(!site)return {ok:false,reason:'Unknown encounter'};
 if(!Number.isSafeInteger(now)||now<0||!actor||!Number.isFinite(actor.x)||!Number.isFinite(actor.y)||actor.hp<=0||actor.car||Math.hypot(actor.x-site.x,actor.y-site.y)>50)return {ok:false,reason:'Approach on foot'};
 if(now<state.ready[id])return {ok:false,reason:'Nothing here yet'};
 if(site.type==='wallet'){if(!Number.isSafeInteger(actor.cash)||actor.cash>99999900)return {ok:false,reason:'Wallet full'};actor.cash+=100;actor.heat=Math.min(5,Math.max(0,actor.heat||0)+.3)}
 if(site.type==='cache'){const count=pocket.medkit||0;if(!Number.isSafeInteger(count)||count<0||count>=999)return {ok:false,reason:'Pockets full'};pocket.medkit=count+1}
 if(site.type==='tip'){if(!Number.isSafeInteger(actor.cash)||actor.cash>99999950)return {ok:false,reason:'Wallet full'};actor.cash+=50}
 state.ready[id]=now+WAIT;return {ok:true,message:site.type==='wallet'?'Found $100 · suspicious pickup increased heat':site.type==='cache'?'Found 1 medkit · drops on death':'Street tip paid $50'};
}
root.NightshiftEncounters={KEY,SITES,WAIT,clean,resolve};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
function saveState(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function locations(){const now=Date.now();return SITES.filter(s=>now>=state.ready[s.id]).map(s=>({...s,action:'SEARCH',hint:s.label+' · investigate'}))}
function use(id){if(root.NightshiftInterface?.expanded()||root.NightshiftTouchLayout?.paused()||['Businesses','Craft','Progress','Backups','Map','Vehicles','Home','Inventory','Recovery'].some(n=>root['Nightshift'+n]?.paused?.()))return false;const s=SITES.find(s=>s.id===id);if(!s||root.NightshiftNavigation.trace(player,s,blocked))return false;const result=resolve(state,id,player,root.NightshiftInventory.state.pocket);if(result.ok){saveState();save();root.NightshiftAudio?.play('pickup')}say(result.message||result.reason);return result.ok}
function draw(){for(const s of locations()){g.save();g.fillStyle=s.color;g.fillRect(s.x-8,s.y-8,16,16);g.fillStyle='#16283b';g.fillRect(s.x-4,s.y-4,8,8);g.restore()}}
Object.assign(root.NightshiftEncounters,{state,save:saveState,locations,use,draw});
})(globalThis);
