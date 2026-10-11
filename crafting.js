/* v0.17: fictional, game-only crafting recipes. No real-world fabrication guidance. */
(function(root){
'use strict';
const RECIPES=Object.freeze([
 {id:'pistol',name:'Street Pistol',cost:{scrap:8,watch:2},output:{pistol:1},place:'bench',description:'Assemble a game weapon at your home workbench'},
 {id:'ammo',name:'Ammo Pack (15)',cost:{scrap:4,jewelry:1},output:{ammo:15},place:'bench',description:'Convert game salvage into fictional ammunition'},
 {id:'medkit',name:'First Aid Kit',cost:{scrap:3,watch:1},output:{medkit:1},place:'field',description:'Restore 40 HP when used from BAG'},
 {id:'ammo-bulk',name:'Bulk Ammo Pack (30)',cost:{scrap:6,jewelry:1},output:{ammo:30},place:'bench',tier:2,bench:2,description:'Upgraded bench recipe'},
 {id:'medkit-pair',name:'Medical Supply Pair',cost:{scrap:5,watch:1},output:{medkit:2},place:'bench',tier:3,bench:2,description:'Advanced medical supply recipe'},
 {id:'scrap',name:'Salvage Breakdown',cost:{jewelry:1},output:{scrap:5},place:'field',description:'Break down a collectible for spare salvage'}
]);
const KEY='nightshift-city-crafting-v1';
function clean(raw){return {crafted:Number.isSafeInteger(raw?.crafted)?Math.max(0,Math.min(10000,raw.crafted)):0,bench:raw?.bench===2?2:1}}
function level(state){return Math.min(5,1+Math.floor(state.crafted/5))}
const LIMIT={cash:100000000,ammo:270};
function recipe(id){return RECIPES.find(r=>r.id===id)||null}
function craft(pocket,id,atBench=false,progress=clean()){
 const r=recipe(id);if(!r||!pocket||typeof pocket!=='object')return {ok:false,reason:'Unknown recipe'};
 if((r.tier||1)>level(progress))return {ok:false,reason:'Requires crafting level '+r.tier};
 if((r.bench||1)>progress.bench)return {ok:false,reason:'Requires upgraded workbench'};
 if(r.place==='bench'&&!atBench)return {ok:false,reason:'Requires your apartment workbench'};
 for(const [item,count] of Object.entries(r.cost))if(!Number.isSafeInteger(pocket[item])||pocket[item]<count)return {ok:false,reason:'Missing '+item};
 for(const [item,count] of Object.entries(r.output)){const n=(pocket[item]||0)-(r.cost[item]||0);if(!Number.isSafeInteger(n)||n+count>(LIMIT[item]||999))return {ok:false,reason:'Inventory full'}}
 for(const [item,count] of Object.entries(r.cost)){pocket[item]-=count;if(!pocket[item])delete pocket[item]}
 for(const [item,count] of Object.entries(r.output))pocket[item]=(pocket[item]||0)+count;
 return {ok:true,recipe:r};
}
root.NightshiftCraft={RECIPES,recipe,craft,clean,level};
if(!root.document)return;
const doc=root.document;
let open=false,state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function make(id){
 if(!open||blocked()||player.hp<=0||player.car)return {ok:false,reason:'Crafting unavailable'};
 const r=recipe(id);if(!r)return {ok:false,reason:'Unknown recipe'};
 if(r.output.ammo&&(combatState.until||combatState.reserve+r.output.ammo>240))return {ok:false,reason:combatState.until?'Finish reloading first':'Ammo reserve full'};
 const inventory=root.NightshiftInventory;inventory.save();
 const result=craft(inventory.state.pocket,id,atBench(),state);
 if(result.ok){if(r.output.ammo)combatState.reserve+=r.output.ammo;state.crafted=Math.min(10000,state.crafted+1);persist();save()}
 return result;
}
function upgrade(){if(!open||blocked()||!atBench()||state.bench!==1||level(state)<2||player.cash<400)return false;player.cash-=400;state.bench=2;persist();save();render();return true}
const panel=doc.createElement('div');panel.id='craftPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Crafting');panel.style.cssText='position:fixed;z-index:35;inset:8% 6%;overflow:auto;padding:16px;background:#101e30;border:1px solid #d5ac64;border-radius:12px;color:#fff;font:14px system-ui';doc.body.appendChild(panel);
const btn=doc.createElement('button');btn.id='craft';btn.textContent='CRAFT';btn.setAttribute('aria-label','Open crafting recipes');doc.querySelector('#actions')?.appendChild(btn);
function atBench(){return root.NightshiftHome?.canCraft?.()&&root.NightshiftActivities?.ownsHome?.()}
function blocked(){return root.NightshiftInventory?.paused?.()||root.NightshiftRecovery?.paused?.()||root.NightshiftVehicles?.paused?.()||root.NightshiftMap?.paused?.()||root.NightshiftBackups?.paused?.()||root.NightshiftProgress?.paused?.()}
function close(){open=false;panel.hidden=true}
function render(){
 panel.textContent='';
 const heading=doc.createElement('h2');heading.textContent='CRAFTING · '+(atBench()?'HOME WORKBENCH':'FIELD RECIPES');panel.appendChild(heading);
 const status=doc.createElement('p');status.textContent='Crafting level '+level(state)+' / 5 · '+state.crafted+' recipes completed · Bench '+state.bench;panel.appendChild(status);
 const upgradeButton=doc.createElement('button');upgradeButton.textContent=state.bench===2?'WORKBENCH UPGRADED':'UPGRADE BENCH · $400 · LEVEL 2';upgradeButton.disabled=state.bench===2||!atBench()||level(state)<2||player.cash<400;upgradeButton.style.cssText='min-height:44px';upgradeButton.addEventListener('click',upgrade);panel.appendChild(upgradeButton);
 const info=doc.createElement('p');info.textContent='Game-only recipes. Crafted items stay in your pockets and drop on death. Secure them in your home stash.';panel.appendChild(info);
 const pocket=root.NightshiftInventory?.state?.pocket||{};
 for(const r of RECIPES){
  const card=doc.createElement('div');card.style.cssText='border-top:1px solid #46566a;padding:10px 0';
  const name=doc.createElement('strong');name.textContent=r.name;card.appendChild(name);
  const detail=doc.createElement('p');detail.textContent=Object.entries(r.cost).map(([k,v])=>v+' '+k).join(' + ')+' → '+Object.entries(r.output).map(([k,v])=>v+' '+k).join(' + ')+' · '+r.description;card.appendChild(detail);
  const action=doc.createElement('button');action.textContent=r.place==='bench'&&!atBench()?'BENCH ONLY':'CRAFT';action.disabled=(r.place==='bench'&&!atBench())||(r.tier||1)>level(state)||(r.bench||1)>state.bench;
   if((r.tier||1)>level(state))action.textContent='LEVEL '+r.tier;else if((r.bench||1)>state.bench)action.textContent='UPGRADE BENCH';action.style.cssText='min-height:42px;padding:0 20px;border-radius:8px';action.addEventListener('click',()=>{
   if(!open)return;
   const inventory=root.NightshiftInventory;if(!inventory?.state?.pocket)return;
   const result=make(r.id);
   if(typeof say==='function')say(result.ok?'Crafted '+r.name:result.reason);
   render();
  });card.appendChild(action);panel.appendChild(card);
 }
 const footer=doc.createElement('p');footer.textContent='Carried: '+Object.entries(pocket).map(([k,v])=>k+' ×'+v).join(' · ');panel.appendChild(footer);
 const exit=doc.createElement('button');exit.textContent='CLOSE';exit.style.cssText='width:100%;min-height:44px;margin-top:12px';exit.addEventListener('click',close);panel.appendChild(exit);
}
root.NightshiftCraft.paused=()=>open;
root.NightshiftCraft.open=()=>{if(open){close();return}if(blocked()||player.hp<=0||(root.NightshiftHome?.paused()&&!atBench()))return;if(typeof player!=='undefined'&&player.car){if(typeof say==='function')say('Exit your car before crafting');return}root.releaseControls?.();root.NightshiftInventory?.save();open=true;panel.hidden=false;render()};
Object.assign(root.NightshiftCraft,{close,make,upgrade,state,save:persist});
root.addEventListener('keydown',e=>{if(e.key==='Escape'&&open)close();if(e.key.toLowerCase()==='c'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey)root.NightshiftCraft.open()});
btn.addEventListener('click',root.NightshiftCraft.open);
})(globalThis);
