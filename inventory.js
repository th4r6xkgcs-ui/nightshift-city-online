/* v0.8 local-only item custody. Server must eventually own this state. */
(function(root){
'use strict';
const TYPES=['scrap','watch','medkit','jewelry','pistol','cash','ammo','parcel'];
const limit=t=>t==='cash'?100000000:t==='ammo'?270:999;
function clean(raw){const out={};for(const type of TYPES){const n=raw?.[type];if(Number.isSafeInteger(n)&&n>0)out[type]=Math.min(n,limit(type))}return out}
function move(from,to,type,count=1){if(!TYPES.includes(type)||!Number.isSafeInteger(count)||count<1||!from||!to||from===to)return false;if((from[type]||0)<count||((to[type]||0)+count)>limit(type))return false;from[type]-=count;if(!from[type])delete from[type];to[type]=(to[type]||0)+count;return true}
function dropAll(bag){const dropped=clean(bag);for(const k of Object.keys(bag))delete bag[k];return dropped}
function total(bag){return Object.values(clean(bag)).reduce((a,b)=>a+b,0)}
root.NightshiftInventory={TYPES,clean,move,dropAll,total};
if(!root.document)return;
const KEY='nightshift-city-inventory-v1';
let state={pocket:{scrap:2,watch:1,pistol:1},stash:{},gloveboxes:{}};let drops=[];
try{const raw=JSON.parse(root.localStorage.getItem(KEY)||'null');if(raw&&typeof raw==='object'){state.pocket=clean(raw.pocket);if(!raw.version)state.pocket.pistol=1;if(raw.version===2){player.cash=state.pocket.cash||0;const rounds=state.pocket.ammo||0;player.ammo=Number.isSafeInteger(raw.magazine)?Math.max(Math.max(0,rounds-240),Math.min(30,rounds,raw.magazine)):Math.min(30,rounds);combatState.reserve=rounds-player.ammo;}drops=Array.isArray(raw.drops)?raw.drops.filter(d=>Number.isFinite(d.x)&&Number.isFinite(d.y)&&d.x>=0&&d.x<=2200&&d.y>=0&&d.y<=1700&&Number.isFinite(d.expires)&&d.expires>Date.now()).slice(-100).map(d=>({...d,items:clean(d.items)})):[];state.stash=clean(raw.stash);state.gloveboxes={};for(const [id,bag] of Object.entries(raw.gloveboxes||{}))if(/^car-(?:[0-9]|1[0-9])$/.test(id))state.gloveboxes[id]=clean(bag)}}catch{}
function syncPocket(){state.pocket.cash=Math.floor(player.cash);state.pocket.ammo=player.ammo+combatState.reserve;if(!state.pocket.cash)delete state.pocket.cash;if(!state.pocket.ammo)delete state.pocket.ammo}
function applyPocket(){player.cash=state.pocket.cash||0;let rounds=state.pocket.ammo||0;player.ammo=Math.min(player.ammo,rounds);combatState.reserve=rounds-player.ammo;if(combatState.reserve>240){player.ammo+=combatState.reserve-240;combatState.reserve=240}}
const saveItems=()=>{syncPocket();drops=drops.filter(d=>d.expires>Date.now());root.NightshiftInventory.drops=drops;try{root.localStorage.setItem(KEY,JSON.stringify({...state,version:2,magazine:player.ammo,drops}))}catch{}};
function glove(){return player.car?.id||null}
function bag(which){if(which==='pocket')return state.pocket;if(which==='stash')return state.stash;if(which==='glove'){const id=glove();if(!id)return null;return state.gloveboxes[id]??(state.gloveboxes[id]={})}return null}
function transfer(from,to,type,count=1){syncPocket();if(type==='ammo'&&combatState.until)return false;const ok=move(bag(from),bag(to),type,count);if(ok){applyPocket();saveItems();save()}return ok}
function death(x,y){syncPocket();const items=dropAll(state.pocket);player.cash=0;player.ammo=0;combatState.reserve=0;combatState.until=0;return {x,y,items,expires:Date.now()+120000}}

function loseOnDeath(x,y){const drop=death(x,y);if(total(drop.items)){drops.push(drop);saveItems();save();return total(drop.items)}return 0}
function takeDrop(x,y){syncPocket();const i=drops.findIndex(d=>Date.now()<d.expires&&Math.hypot(x-d.x,y-d.y)<48);if(i<0)return 0;const d=drops[i];let n=0;for(const [type,count] of Object.entries(d.items)){const capacity=limit(type)-(state.pocket[type]||0);const qty=Math.min(count,capacity);if(qty>0){state.pocket[type]=(state.pocket[type]||0)+qty;d.items[type]-=qty;n+=qty;if(!d.items[type])delete d.items[type]}}if(!total(d.items))drops.splice(i,1);applyPocket();saveItems();save();return n}
root.NightshiftInventory.state=state;
root.NightshiftInventory.transfer=transfer;
root.NightshiftInventory.loseOnDeath=loseOnDeath;
root.NightshiftInventory.takeDrop=takeDrop;
root.NightshiftInventory.drops=drops;
const panel=document.createElement('div');panel.hidden=true;panel.style.cssText='position:fixed;z-index:25;inset:8% 6%;overflow:auto;padding:18px;background:#142139;border:1px solid #9aaaca;border-radius:12px;color:white';document.body.appendChild(panel);let place=null;
function render(){panel.textContent='';const header=document.createElement('p');header.textContent=place==='pocket'?'POCKETS · everything carried drops on death':place==='stash'?'HOME STASH · protected from death':'GLOVEBOX · protected from character death';panel.appendChild(header);syncPocket();for(const type of TYPES){const row=document.createElement('div');row.style.cssText='padding:6px 0;border-bottom:1px solid #3c4b63';const text=document.createElement('span');text.textContent=`${type}: ${state.pocket[type]||0} carried`+(place==='pocket'?'':` / ${bag(place)?.[type]||0} stored`);row.appendChild(text);if(place!=='pocket')for(const [label,from,to] of [['Store','pocket',place],['Take',place,'pocket']]){const button=document.createElement('button');button.style.cssText='width:64px;height:34px;border-radius:6px;margin:4px';button.textContent=label;button.addEventListener('click',()=>{const qty=type==='cash'?Math.min(100,bag(from)?.[type]||0):type==='ammo'?Math.min(30,bag(from)?.[type]||0):1;say(transfer(from,to,type,qty)?'Transferred':'Unavailable, full or reloading');render()});row.appendChild(button)}panel.appendChild(row)}const close=document.createElement('button');close.textContent='CLOSE';close.style.cssText='width:100%;height:44px;border-radius:6px;margin-top:12px';close.addEventListener('click',()=>{panel.hidden=true;place=null});panel.appendChild(close)}
root.NightshiftInventory.paused=()=>!panel.hidden;
root.NightshiftInventory.save=saveItems;
root.NightshiftInventory.open=(target)=>{if(root.NightshiftRecovery?.paused()||root.NightshiftVehicles?.paused())return;if(target==='stash'&&!root.NightshiftHome?.paused())return;if(target==='glove'&&!glove())return;place=target;resetPad();firing=false;run=false;panel.hidden=false;render()};
const lootButton=document.createElement('button');lootButton.id='loot';lootButton.textContent='LOOT';lootButton.addEventListener('click',()=>{if(root.NightshiftRecovery?.paused()||root.NightshiftHome?.paused())return;const n=takeDrop(player.x,player.y);if(typeof say==='function')say(n?'Recovered '+n+' items from a dropped bag':'No dropped bag nearby')});document.querySelector('#actions').appendChild(lootButton);
const gloveButton=document.createElement('button');gloveButton.id='glove';gloveButton.textContent='BOX';gloveButton.addEventListener('click',()=>root.NightshiftInventory.open('glove'));document.querySelector('#actions').appendChild(gloveButton);
root.NightshiftInventory.inspect=()=>root.NightshiftInventory.open('pocket');
const button=document.createElement('button');button.id='inventory';button.textContent='BAG';button.setAttribute('aria-label','Inspect carried items');button.addEventListener('click',root.NightshiftInventory.inspect);document.querySelector('#actions').appendChild(button);
root.addEventListener?.('pagehide',saveItems);
})(globalThis);
