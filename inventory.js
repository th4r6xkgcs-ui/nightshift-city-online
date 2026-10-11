/* v0.8 local-only item custody. Server must eventually own this state. */
(function(root){
'use strict';
const TYPES=['scrap','watch','medkit','jewelry'];
function clean(raw){const out={};for(const type of TYPES){const n=raw?.[type];if(Number.isSafeInteger(n)&&n>0)out[type]=Math.min(n,999)}return out}
function move(from,to,type,count=1){if(!TYPES.includes(type)||!Number.isSafeInteger(count)||count<1||!from||!to||from===to)return false;if((from[type]||0)<count||((to[type]||0)+count)>999)return false;from[type]-=count;if(!from[type])delete from[type];to[type]=(to[type]||0)+count;return true}
function dropAll(bag){const dropped=clean(bag);for(const k of Object.keys(bag))delete bag[k];return dropped}
function total(bag){return Object.values(clean(bag)).reduce((a,b)=>a+b,0)}
root.NightshiftInventory={TYPES,clean,move,dropAll,total};
if(!root.document)return;
const KEY='nightshift-city-inventory-v1';
let state={pocket:{scrap:2,watch:1},stash:{},gloveboxes:{}};
try{const raw=JSON.parse(root.localStorage.getItem(KEY)||'null');if(raw&&typeof raw==='object'){state.pocket=clean(raw.pocket);state.stash=clean(raw.stash);state.gloveboxes={};for(const [id,bag] of Object.entries(raw.gloveboxes||{}))if(/^car-(?:[0-9]|1[0-9])$/.test(id))state.gloveboxes[id]=clean(bag)}}catch{}
const saveItems=()=>{try{root.localStorage.setItem(KEY,JSON.stringify(state))}catch{}};
function glove(){const i=typeof cars==='undefined'?-1:cars.indexOf(player.car);return i>=0?'car-'+i:null}
function bag(which){if(which==='pocket')return state.pocket;if(which==='stash')return state.stash;if(which==='glove'){const id=glove();if(!id)return null;return state.gloveboxes[id]??(state.gloveboxes[id]={})}return null}
function transfer(from,to,type,count=1){const ok=move(bag(from),bag(to),type,count);if(ok)saveItems();return ok}
function death(x,y){const items=dropAll(state.pocket);saveItems();return {x,y,items,expires:Date.now()+120000}}
const drops=[];
function loseOnDeath(x,y){const drop=death(x,y);if(total(drop.items)){drops.push(drop);return total(drop.items)}return 0}
function takeDrop(x,y){const i=drops.findIndex(d=>Date.now()<d.expires&&Math.hypot(x-d.x,y-d.y)<48);if(i<0)return 0;const d=drops[i];let n=0;for(const [type,count] of Object.entries(d.items)){const capacity=999-(state.pocket[type]||0);const qty=Math.min(count,capacity);if(qty>0){state.pocket[type]=(state.pocket[type]||0)+qty;d.items[type]-=qty;n+=qty;if(!d.items[type])delete d.items[type]}}if(!total(d.items))drops.splice(i,1);saveItems();return n}
root.NightshiftInventory.state=state;
root.NightshiftInventory.transfer=transfer;
root.NightshiftInventory.loseOnDeath=loseOnDeath;
root.NightshiftInventory.takeDrop=takeDrop;
root.NightshiftInventory.drops=drops;
root.NightshiftInventory.open=(place)=>{
 if(root.NightshiftRecovery?.paused())return;
 if(place==='stash'&&!root.NightshiftHome?.paused())return;
 if(place==='glove'&&!glove())return;
 const target=place==='stash'?'stash':'glove';
 const lines=()=>TYPES.map(t=>t+': '+(state.pocket[t]||0)+' carried / '+(bag(target)?.[t]||0)+' stored').join(' · ');
 const type=root.prompt?.('Storage ('+target+'): '+lines()+'\nItem name: scrap, watch, medkit or jewelry');
 if(!TYPES.includes(type))return;
 const direction=root.prompt?.('Type STORE to secure 1, or TAKE to retrieve 1');
 const from=direction?.toUpperCase()==='STORE'?'pocket':direction?.toUpperCase()==='TAKE'?target:null;
 if(!from)return;
 const to=from==='pocket'?target:'pocket';
 if(typeof say==='function')say(transfer(from,to,type)?'Item transferred safely':'Item unavailable or storage full');
};
root.NightshiftInventory.inspect=()=>{if(typeof say==='function')say('Pockets: '+(total(state.pocket)||'empty')+' items · Home stash: '+total(state.stash)+' · Car glovebox: '+total(bag('glove')||{}))};
const button=document.createElement('button');button.id='inventory';button.textContent='BAG';button.setAttribute('aria-label','Inspect carried items');button.addEventListener('click',root.NightshiftInventory.inspect);document.querySelector('#actions').appendChild(button);
root.addEventListener?.('pagehide',saveItems);
})(globalThis);
