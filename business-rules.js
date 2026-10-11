/* Fictional local game economy: abstract supplies, timers and inventory units. */
(function(root){'use strict';
const CASH_LIMIT=100000000,ITEM_LIMIT=999,REFILL=300000;
const PROPERTIES=[
 {id:'farm',name:'Weed Farm',label:'WEED FARM',item:'weed',price:1800,supplies:60,duration:120000,output:3,capacity:36,x:640,y:597,illegal:true,color:'#7fda9b'},
 {id:'house',name:'Coke House',label:'COKE HOUSE',item:'coke',price:4200,supplies:150,duration:180000,output:2,capacity:24,x:1520,y:1277,illegal:true,color:'#bca4ed'},
 {id:'workshop',name:'Auto Workshop',label:'AUTO WORKSHOP',item:'parts',price:1600,supplies:75,duration:90000,output:2,capacity:24,x:1080,y:1617,illegal:false,color:'#edbc72'}
];
const MARKETS=[
 {id:'west',name:'West End Dealer',label:'WEST END DEALER',x:440,y:1020,buy:{weed:45,coke:120},sell:{weed:35,coke:95},color:'#ad8ced'},
 {id:'docks',name:'Docks Dealer',label:'DOCKS DEALER',x:1760,y:1360,buy:{weed:90,coke:220},sell:{weed:70,coke:175},color:'#ee8eaa'}
];
const ORDERS=[
 {id:'green-run',name:'Docks Green Run',item:'weed',count:4,reward:300,duration:60000,x:1760,y:1360,illegal:true},
 {id:'repair-run',name:'Clinic Repair Order',item:'parts',count:3,reward:300,duration:75000,x:440,y:340,illegal:false},
 {id:'night-run',name:'Midtown Night Order',item:'coke',count:2,reward:400,duration:60000,x:1320,y:340,illegal:true}
];
const STOCK={weed:6,coke:3},DEMAND={weed:8,coke:4};
const integer=(value,max,otherwise=0)=>Number.isSafeInteger(value)&&value>=0?Math.min(max,value):otherwise;
const property=id=>PROPERTIES.find(p=>p.id===id),market=id=>MARKETS.find(m=>m.id===id);
const capacity=(spec,p)=>spec.capacity*p.level,output=(spec,p)=>spec.output+p.level-1;
function clean(raw={},now=Date.now()){
 const state={version:1,properties:{},markets:{},ledger:{batches:0,sold:0,earned:0,upgrades:0},orders:{index:0,cooldownAt:0,active:null,completed:0}};
 for(const spec of PROPERTIES){const r=raw?.properties?.[spec.id],owned=r?.owned===true;
  const p={owned,level:owned?Math.max(1,integer(r?.level,3,1)):1,stock:0,until:0,batch:0};
  if(owned){p.stock=integer(r?.stock,capacity(spec,p));p.batch=integer(r?.batch,output(spec,p));p.until=p.batch&&Number.isSafeInteger(r?.until)&&r.until>0?Math.min(r.until,now+spec.duration):0;if(!p.until)p.batch=0;if(p.stock+p.batch>capacity(spec,p))p.batch=Math.max(0,capacity(spec,p)-p.stock);if(!p.batch)p.until=0}
  state.properties[spec.id]=p;
 }
 for(const spec of MARKETS){const r=raw?.markets?.[spec.id];const m={refillAt:Number.isSafeInteger(r?.refillAt)&&r.refillAt>0?Math.min(r.refillAt,now+REFILL):now+REFILL,bought:{},sold:{}};for(const item of ['weed','coke']){m.bought[item]=integer(r?.bought?.[item],STOCK[item]);m.sold[item]=integer(r?.sold?.[item],DEMAND[item])}state.markets[spec.id]=m}
 for(const key of Object.keys(state.ledger))state.ledger[key]=integer(raw?.ledger?.[key],key==='earned'?CASH_LIMIT:1000000);
 const ro=raw?.orders;state.orders.index=integer(ro?.index,ORDERS.length-1);state.orders.completed=integer(ro?.completed,1000000);state.orders.cooldownAt=Number.isSafeInteger(ro?.cooldownAt)&&ro.cooldownAt>0?Math.min(ro.cooldownAt,now+REFILL):0;
 if(ro?.active&&Number.isSafeInteger(ro.active.index)&&ro.active.index>=0&&ro.active.index<ORDERS.length&&Number.isSafeInteger(ro.active.until)&&ro.active.until>0){state.orders.active={index:ro.active.index,until:Math.min(ro.active.until,now+ORDERS[ro.active.index].duration)};state.orders.index=ro.active.index}
 return state;
}
function advance(state,now){
 if(!Number.isSafeInteger(now)||now<0)return [];
 const completed=[];
 for(const spec of PROPERTIES){const p=state.properties[spec.id];if(p.owned&&p.batch>0&&p.until>0&&now>=p.until){p.stock=Math.min(capacity(spec,p),p.stock+p.batch);p.until=0;p.batch=0;state.ledger.batches=Math.min(1000000,state.ledger.batches+1);completed.push(spec.id)}}
 for(const m of Object.values(state.markets))if(now>=m.refillAt){m.refillAt=now+REFILL;m.bought={weed:0,coke:0};m.sold={weed:0,coke:0}}
 if(state.orders.active&&now>=state.orders.active.until){state.orders.active=null;completed.push('order-expired')}
 return completed;
}
function transact(state,wallet,pocket,cmd,now=Date.now(),dry=false){
 const fail=reason=>({ok:false,reason});
 if(!state||!wallet||!pocket||!cmd||!Number.isSafeInteger(now)||now<0)return fail('Invalid transaction');
 if(!Number.isSafeInteger(wallet.cash)||wallet.cash<0||wallet.cash>CASH_LIMIT||!Number.isFinite(wallet.hp)||wallet.hp<=0||wallet.car)return fail('Be on foot and alive to trade');
 if(['accept-order','complete-order','cancel-order'].includes(cmd.action)){
  const orders=state.orders,order=ORDERS[orders.active?.index??orders.index];
  if(cmd.action==='accept-order'){
   if(orders.active)return fail('An order is already active');if(now<orders.cooldownAt)return fail('Orders refill after the cooldown');
   if(!dry){orders.active={index:orders.index,until:now+order.duration};orders.cooldownAt=now+REFILL}return {ok:true,message:'Rush order accepted · '+order.name};
  }
  if(!orders.active)return fail('No active rush order');
  if(cmd.action==='cancel-order'){if(!dry)orders.active=null;return {ok:true,message:'Order cancelled · goods kept · cooldown remains'}}
  if(now>=orders.active.until)return fail('Rush order expired');
  if(!Number.isFinite(wallet.x)||!Number.isFinite(wallet.y)||Math.hypot(wallet.x-order.x,wallet.y-order.y)>75)return fail('Travel to the order marker');
  if(order.illegal&&wallet.heat>=2)return fail('Police pressure · lose heat before delivery');
  if(!Number.isSafeInteger(pocket[order.item])||pocket[order.item]<order.count)return fail('Need '+order.count+' carried '+order.item);
  if(wallet.cash+order.reward>CASH_LIMIT)return fail('Wallet full');
  if(!dry){pocket[order.item]-=order.count;if(!pocket[order.item])delete pocket[order.item];wallet.cash+=order.reward;if(order.illegal)wallet.heat=Math.min(5,Math.max(0,wallet.heat||0)+(order.item==='coke'?.4:.2)*order.count);orders.active=null;orders.index=(order.id===ORDERS[0].id?1:order.id===ORDERS[1].id?2:0);orders.completed=Math.min(1000000,orders.completed+1);state.ledger.sold=Math.min(1000000,state.ledger.sold+order.count);state.ledger.earned=Math.min(CASH_LIMIT,state.ledger.earned+order.reward)}
  return {ok:true,message:'Rush order complete · +$'+order.reward};
 }
 const spec=property(cmd.id)||market(cmd.id);if(!spec)return fail('Unknown business');
 if(!Number.isFinite(wallet.x)||!Number.isFinite(wallet.y)||Math.hypot(wallet.x-spec.x,wallet.y-spec.y)>75)return fail('Travel to this location first');
 if((spec.illegal||spec.buy)&&wallet.heat>=2)return fail('Police pressure · leave and lose heat first');
 if(property(cmd.id)){
  const p=state.properties[spec.id];
  if(cmd.action==='purchase'){
   if(p.owned)return fail('Already owned');if(wallet.cash<spec.price)return fail('Not enough cash');
   if(!dry){wallet.cash-=spec.price;p.owned=true}return {ok:true,message:'Purchased '+spec.name+' · -$'+spec.price};
  }
  if(!p.owned)return fail('Buy this property first');
  if(cmd.action==='upgrade'){
   if(p.level>=3)return fail('Maximum upgrade reached');const cost=Math.ceil(spec.price*.5*p.level);if(wallet.cash<cost)return fail('Not enough cash');
   if(!dry){wallet.cash-=cost;p.level++;state.ledger.upgrades=Math.min(1000000,state.ledger.upgrades+1)}return {ok:true,message:'Upgraded '+spec.name+' · -$'+cost};
  }
  if(cmd.action==='start'){
   if(p.batch||p.until)return fail('A batch is already running');const count=output(spec,p);
   if(p.stock+count>capacity(spec,p))return fail('Storage full · collect stock first');if(wallet.cash<spec.supplies)return fail('Not enough cash for supplies');
   if(!dry){wallet.cash-=spec.supplies;p.batch=count;p.until=now+spec.duration}return {ok:true,message:'Batch started · '+count+' '+spec.item+' in '+spec.duration/1000+'s'};
  }
  if(cmd.action==='collect'){
   const n=cmd.count;if(!Number.isSafeInteger(n)||n<1||n>p.stock)return fail('Not enough ready stock');const carried=pocket[spec.item]||0;
   if(!Number.isSafeInteger(carried)||carried<0||carried+n>ITEM_LIMIT)return fail('Pockets full');
   if(!dry){p.stock-=n;pocket[spec.item]=carried+n}return {ok:true,message:'Collected '+n+' '+spec.item+' · carried goods drop on death'};
  }
  return fail('Unknown property action');
 }
 const m=state.markets[spec.id],item=cmd.item,n=cmd.count;
 if(!['weed','coke'].includes(item)||!Number.isSafeInteger(n)||n<1||n>ITEM_LIMIT)return fail('Invalid trade quantity');
 const carried=pocket[item]||0;if(!Number.isSafeInteger(carried)||carried<0||carried>ITEM_LIMIT)return fail('Invalid carried stock');
 if(cmd.action==='buy'){
  if(n>STOCK[item]-m.bought[item])return fail('Dealer stock exhausted · wait for refill');const cost=spec.buy[item]*n;
  if(wallet.cash<cost)return fail('Not enough cash');if(carried+n>ITEM_LIMIT)return fail('Pockets full');
  if(!dry){wallet.cash-=cost;pocket[item]=carried+n;m.bought[item]+=n;wallet.heat=Math.min(5,Math.max(0,wallet.heat||0)+(item==='coke'?.1:.05)*n)}return {ok:true,message:'Bought '+n+' '+item+' · -$'+cost};
 }
 if(cmd.action==='sell'){
  if(n>carried)return fail('Not enough carried stock');if(n>DEMAND[item]-m.sold[item])return fail('Buyer demand exhausted · wait for refill');const revenue=spec.sell[item]*n;
  if(wallet.cash+revenue>CASH_LIMIT)return fail('Wallet full');
  if(!dry){wallet.cash+=revenue;pocket[item]-=n;if(!pocket[item])delete pocket[item];m.sold[item]+=n;wallet.heat=Math.min(5,Math.max(0,wallet.heat||0)+(item==='coke'?.4:.2)*n);state.ledger.sold=Math.min(1000000,state.ledger.sold+n);state.ledger.earned=Math.min(CASH_LIMIT,state.ledger.earned+revenue)}return {ok:true,message:'Sold '+n+' '+item+' · +$'+revenue+' · heat increased'};
 }
 return fail('Unknown dealer action');
}
root.NightshiftBusinessRules={PROPERTIES,MARKETS,ORDERS,STOCK,DEMAND,REFILL,ITEM_LIMIT,CASH_LIMIT,property,market,capacity,output,clean,advance,transact};
})(globalThis);
