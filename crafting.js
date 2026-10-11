/* v0.16: fictional, game-only crafting recipes. No real-world fabrication guidance. */
(function(root){
'use strict';
const RECIPES=Object.freeze([
 {id:'pistol',name:'Street Pistol',cost:{scrap:8,watch:2},output:{pistol:1},place:'bench',description:'Assemble a game weapon at your home workbench'},
 {id:'ammo',name:'Ammo Pack (15)',cost:{scrap:4,jewelry:1},output:{ammo:15},place:'bench',description:'Convert game salvage into fictional ammunition'},
 {id:'medkit',name:'First Aid Kit',cost:{scrap:3,watch:1},output:{medkit:1},place:'field',description:'Restore 40 HP when used from BAG'},
 {id:'scrap',name:'Salvage Breakdown',cost:{jewelry:1},output:{scrap:5},place:'field',description:'Break down a collectible for spare salvage'}
]);
const LIMIT={cash:100000000,ammo:270};
function recipe(id){return RECIPES.find(r=>r.id===id)||null}
function craft(pocket,id,atBench=false){
 const r=recipe(id);if(!r||!pocket||typeof pocket!=='object')return {ok:false,reason:'Unknown recipe'};
 if(r.place==='bench'&&!atBench)return {ok:false,reason:'Requires your apartment workbench'};
 for(const [item,count] of Object.entries(r.cost))if(!Number.isSafeInteger(pocket[item])||pocket[item]<count)return {ok:false,reason:'Missing '+item};
 for(const [item,count] of Object.entries(r.output)){const n=pocket[item]||0;if(!Number.isSafeInteger(n)||n+count>(LIMIT[item]||999))return {ok:false,reason:'Inventory full'}}
 for(const [item,count] of Object.entries(r.cost)){pocket[item]-=count;if(!pocket[item])delete pocket[item]}
 for(const [item,count] of Object.entries(r.output))pocket[item]=(pocket[item]||0)+count;
 return {ok:true,recipe:r};
}
root.NightshiftCraft={RECIPES,recipe,craft};
if(!root.document)return;
const doc=root.document;
let open=false;
const panel=doc.createElement('div');panel.id='craftPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Crafting');panel.style.cssText='position:fixed;z-index:35;inset:8% 6%;overflow:auto;padding:16px;background:#101e30;border:1px solid #d5ac64;border-radius:12px;color:#fff;font:14px system-ui';doc.body.appendChild(panel);
const btn=doc.createElement('button');btn.id='craft';btn.textContent='CRAFT';btn.setAttribute('aria-label','Open crafting recipes');doc.querySelector('#actions')?.appendChild(btn);
function atBench(){return root.NightshiftHome?.kind?.()==='home'}
function blocked(){return root.NightshiftInventory?.paused?.()||root.NightshiftRecovery?.paused?.()||root.NightshiftVehicles?.paused?.()||root.NightshiftMap?.paused?.()||root.NightshiftBackups?.paused?.()||root.NightshiftProgress?.paused?.()}
function close(){open=false;panel.hidden=true}
function render(){
 panel.textContent='';
 const heading=doc.createElement('h2');heading.textContent='CRAFTING · '+(atBench()?'HOME WORKBENCH':'FIELD RECIPES');panel.appendChild(heading);
 const info=doc.createElement('p');info.textContent='Game-only recipes. Crafted items stay in your pockets and drop on death. Secure them in your home stash.';panel.appendChild(info);
 const pocket=root.NightshiftInventory?.state?.pocket||{};
 for(const r of RECIPES){
  const card=doc.createElement('div');card.style.cssText='border-top:1px solid #46566a;padding:10px 0';
  const name=doc.createElement('strong');name.textContent=r.name;card.appendChild(name);
  const detail=doc.createElement('p');detail.textContent=Object.entries(r.cost).map(([k,v])=>v+' '+k).join(' + ')+' → '+Object.entries(r.output).map(([k,v])=>v+' '+k).join(' + ')+' · '+r.description;card.appendChild(detail);
  const action=doc.createElement('button');action.textContent=r.place==='bench'&&!atBench()?'BENCH ONLY':'CRAFT';action.disabled=r.place==='bench'&&!atBench();action.style.cssText='min-height:42px;padding:0 20px;border-radius:8px';action.addEventListener('click',()=>{
   if(!open)return;
   const inventory=root.NightshiftInventory;if(!inventory?.state?.pocket)return;
   // The live ammo counter is authoritative while crafting, so sync before any transaction.
   inventory.state.pocket.ammo=(player.ammo||0)+(combatState.reserve||0);
   const result=craft(inventory.state.pocket,r.id,atBench());
   if(result.ok){
    if(r.output.ammo)combatState.reserve+=r.output.ammo;
    inventory.save?.();if(typeof save==='function')save();
    if(typeof say==='function')say('Crafted '+r.name);
   }else if(typeof say==='function')say(result.reason);
   render();
  });card.appendChild(action);panel.appendChild(card);
 }
 const footer=doc.createElement('p');footer.textContent='Carried: '+Object.entries(pocket).map(([k,v])=>k+' ×'+v).join(' · ');panel.appendChild(footer);
 const exit=doc.createElement('button');exit.textContent='CLOSE';exit.style.cssText='width:100%;min-height:44px;margin-top:12px';exit.addEventListener('click',close);panel.appendChild(exit);
}
root.NightshiftCraft.paused=()=>open;
root.NightshiftCraft.open=()=>{if(open){close();return}if(blocked())return;if(typeof player!=='undefined'&&player.car){if(typeof say==='function')say('Exit your car before crafting');return}root.releaseControls?.();open=true;panel.hidden=false;render()};
root.NightshiftCraft.close=close;
btn.addEventListener('click',root.NightshiftCraft.open);
})(globalThis);
