/* Local shop transactions and hospital recovery rules. */
(function(root){
'use strict';
function purchase(player,combat,item){
 if(item==='ammo'){const rounds=Math.min(30,240-combat.reserve);if(rounds<=0)return 'Spare ammo is full';const cost=rounds*2;if(player.cash<cost)return 'Not enough cash';player.cash-=cost;combat.reserve+=rounds;return `Bought ${rounds} rounds · -$${cost}`}
 if(item==='med'){if(player.hp>=100)return 'Health is full';if(player.cash<40)return 'Not enough cash';player.cash-=40;player.hp=Math.min(100,player.hp+40);return 'First aid · -$40'}
 return 'Unknown item';
}
function recover(player){const fee=Math.min(100,Math.max(0,player.cash));player.cash-=fee;player.hp=100;player.heat=0;player.x=440;player.y=340;return fee}
root.NightshiftRecovery={purchase,recover};
if(!root.document)return;
let until=0,shop=false;
const panel=document.createElement('div');panel.id='services';panel.hidden=true;panel.style.cssText='position:fixed;z-index:20;inset:20% 6% auto;padding:20px;background:#152138;border:1px solid #8aafcb;border-radius:12px;color:white';
const title=document.createElement('p');panel.appendChild(title);
for(const [label,item] of [['AMMO · $2/round','ammo'],['FIRST AID · $40','med'],['CLOSE','close']]){const b=document.createElement('button');b.textContent=label;b.style.cssText='width:100%;border-radius:8px;margin:6px 0';b.addEventListener('click',()=>{if(item==='close'){shop=false;panel.hidden=true;return}say(purchase(player,combatState,item));save();title.textContent=`CORNER SHOP · $${player.cash} · Spare ammo ${combatState.reserve}/240`});panel.appendChild(b)}document.body.appendChild(panel);
root.NightshiftRecovery.openShop=()=>{shop=true;resetPad();firing=false;run=false;title.textContent=`CORNER SHOP · $${player.cash} · Spare ammo ${combatState.reserve}/240`;panel.hidden=false};
root.NightshiftRecovery.paused=()=>shop||until>0;
root.NightshiftRecovery.damage=(amount,now)=>{if(until||player.hp<=0||!Number.isFinite(amount)||amount<=0)return;player.hp=Math.max(0,player.hp-amount);if(player.hp<=0)root.NightshiftRecovery.tick(now)};
root.NightshiftRecovery.tick=now=>{if(player.hp<=0&&!until){until=now+3000;firing=false;run=false;resetPad();for(const k in keys)keys[k]=false;if(player.car){player.car.speed=0;player.car.owner=false;player.car=null}combatState.until=0;bullets.length=0;say('Injured · hospital recovery in 3 seconds')}if(until&&now>=until){until=0;const fee=recover(player);save();say(`Recovered at West End clinic · -$${fee}`)}if(until)document.querySelector('#hud').textContent=`HOSPITAL · recovering in ${Math.max(1,Math.ceil((until-now)/1000))}s · fee up to $100`;};
})(globalThis);
