/* Transient daily plans: no economy or saved identity changes. */
(function(root){'use strict';
function identity(npc,world){
 if(npc.routine)return npc.routine;
 const bx=Math.max(0,Math.min(Math.floor((world.w-1)/440),Math.floor(npc.x/440))),by=Math.max(0,Math.min(Math.floor((world.h-1)/340),Math.floor(npc.y/340)));
 const seed=Math.abs(Math.floor(npc.x*17+npc.y*31));
 return npc.routine={bx,by,seed,key:null,path:[],nextRoute:0};
}
function plan(npc,minute,rain,world){
 const r=identity(npc,world),hour=((minute%1440)+1440)%1440/60;
 const activity=rain>.4?'shelter':hour<7||hour>=23?'home':hour<17?'work':hour<20?'shop':'nightlife';
 const offset=activity==='work'?1:activity==='shop'?2:activity==='nightlife'?3:0;
 const cols=Math.ceil(world.w/440),rows=Math.ceil(world.h/340);
 const bx=(r.bx+offset)%cols,by=(r.by+(activity==='nightlife'?1:0))%rows;
 return {activity,key:activity+':'+bx+':'+by,x:Math.min(world.w-20,bx*440+160+r.seed%100),y:Math.min(world.h-20,by*340+270)};
}
function step(npc,now,dt,context){
 if(!Number.isFinite(context.minute))return false;
 const r=identity(npc,context.world),goal=plan(npc,context.minute,context.rain||0,context.world);
 npc.activity=goal.activity;
 if(r.key!==goal.key){r.key=goal.key;r.path=[];r.nextRoute=now+r.seed%1200}
 if(Math.hypot(npc.x-goal.x,npc.y-goal.y)<9){r.path=[];return true}
 if(now>=r.nextRoute){r.path=root.NightshiftNavigation.route(npc,goal,context.blocked,context.world.w,context.world.h);r.nextRoute=now+4000+r.seed%1200}
 while(r.path.length&&Math.hypot(npc.x-r.path[0].x,npc.y-r.path[0].y)<6)r.path.shift();
 const next=r.path[0];if(!next)return true;
 const d=Math.hypot(next.x-npc.x,next.y-npc.y),travel=Math.min(d,.55*Math.max(0,Math.min(3,dt)));
 const to={x:npc.x+(next.x-npc.x)/d*travel,y:npc.y+(next.y-npc.y)/d*travel};
 if(root.NightshiftCitizens.canStep(npc,to,context.blocked,context.cars)){npc.x=to.x;npc.y=to.y}
 return true;
}
root.NightshiftCitizenRoutines={identity,plan,step};
})(globalThis);
