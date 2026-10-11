/* Local NPC crime and on-foot police response. Not multiplayer authority. */
(function(root){
'use strict';
function sight(a,b,blocked,range=280){const d=Math.hypot(a.x-b.x,a.y-b.y);if(d>range)return false;const steps=Math.max(1,Math.ceil(d/8));for(let i=1;i<steps;i++)if(blocked(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps))return false;return true}
function rob(target,now){if(!target||target.hp<=0||target.robbed)return 0;target.robbed=true;target.fleeUntil=now+10000;const reward=Math.max(0,Math.min(100,Math.floor(target.wallet||0)));target.wallet=0;return reward}
root.NightshiftCrime={sight,rob};
if(!root.document)return;
const officers=[];let dispatch=0,lastSeen=0,previous=0,search=null;
const status=document.createElement('div');status.style.cssText='position:absolute;top:158px;left:12px;max-width:190px;padding:7px;background:#162137da;color:#f4c8aa;font:11px system-ui;pointer-events:none';document.body.appendChild(status);
for(let i=0;i<peds.length;i++)peds[i].wallet=25+(i*17)%61;
function paused(){return root.NightshiftHome?.paused()||root.NightshiftInventory?.paused()||root.NightshiftRecovery?.paused()}
function nearest(){return peds.filter(p=>p.hp>0&&!p.robbed&&Math.hypot(p.x-player.x,p.y-player.y)<65&&sight(player,p,blocked,65)).sort((a,b)=>distance(a,player)-distance(b,player))[0]}
root.NightshiftCrime.attempt=()=>{if(paused()||player.car)return;if(!(root.NightshiftInventory.state.pocket.pistol>0)){say('Carry a pistol to threaten an NPC');return}const target=nearest();if(!target){say('No unrobbed NPC within reach');return}const cash=rob(target,performance.now());player.cash+=cash;player.heat=Math.min(5,player.heat+1);dispatch=performance.now()+3000;search={x:player.x,y:player.y};save();say(`Robbed NPC · +$${cash} · police alerted`)};
const button=document.createElement('button');button.id='rob';button.textContent='ROB';button.setAttribute('aria-label','Rob nearby NPC');button.addEventListener('click',root.NightshiftCrime.attempt);document.querySelector('#actions').appendChild(button);
function spawn(){for(let r=240;r<=400;r+=80)for(let k=0;k<8;k++){const a=k*Math.PI/4,x=player.x+Math.cos(a)*r,y=player.y+Math.sin(a)*r;if(x>20&&y>20&&x<world.w-20&&y<world.h-20&&!blocked(x,y)){officers.push({x,y,hp:60,nextAttack:0,color:'#7798de',angle:0});return}}}
root.NightshiftCrime.tick=now=>{const dt=previous?Math.min(40,Math.max(0,now-previous))/1000:0;previous=now;if(paused())return;if(player.heat<=0){officers.length=0;search=null;dispatch=0;status.textContent='WEST END · no active search';return}if(!dispatch)dispatch=now+3000;if(now>=dispatch&&officers.length<Math.min(3,Math.ceil(player.heat))){spawn();dispatch=now+5000}
let seen=false;for(const officer of officers){if(sight(officer,player,blocked)){seen=true;search={x:player.x,y:player.y};lastSeen=now}const goal=search||player,dx=goal.x-officer.x,dy=goal.y-officer.y,d=Math.max(1,Math.hypot(dx,dy));officer.angle=Math.atan2(dy,dx);const step=78*dt;if(d>30){const nx=officer.x+dx/d*step,ny=officer.y+dy/d*step;if(!blocked(nx,officer.y))officer.x=nx;if(!blocked(officer.x,ny))officer.y=ny}if(sight(officer,player,blocked,180)&&now>=officer.nextAttack){officer.nextAttack=now+1200;root.NightshiftRecovery.damage(player.car?5:12,now);say('Police fire · break sight or surrender');if(player.hp<=0)break}}
if(seen)player.heat=Math.max(.2,player.heat);else if(now-lastSeen>6000)player.heat=Math.max(0,player.heat-dt*.08);status.textContent=seen?'POLICE · spotted · escape or GIVE UP':`POLICE · searching · ${officers.length} officers`;
};
root.NightshiftCrime.draw=()=>{for(const officer of officers){drawPerson(officer);g.fillStyle='#b3cdf9';g.fillRect(officer.x-6,officer.y-22,12,4)}};
root.NightshiftCrime.hit=bullet=>{const officer=officers.find(o=>Math.hypot(o.x-bullet.x,o.y-bullet.y)<16);if(!officer)return false;officer.hp-=20;player.heat=Math.min(5,player.heat+.3);if(officer.hp<=0)officers.splice(officers.indexOf(officer),1);return true};
root.NightshiftCrime.surrender=()=>{if(paused()||player.heat<=0)return;const fine=Math.min(player.cash,150);player.cash-=fine;player.heat=0;officers.length=0;dispatch=0;if(player.car){player.car.speed=0;player.car.owner=false;player.car=null}player.x=440;player.y=340;firing=false;resetPad();save();say(`Surrendered · fine $${fine} · released at West End`)};
const surrender=document.createElement('button');surrender.id='surrender';surrender.textContent='GIVE UP';surrender.addEventListener('click',root.NightshiftCrime.surrender);document.querySelector('#actions').appendChild(surrender);
root.NightshiftCrime.officers=officers;
})(globalThis);
