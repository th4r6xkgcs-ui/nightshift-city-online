/* Client-only fictional businesses. No real-world production details. */
(function(root){'use strict';
if(!root.document)return;
const doc=root.document,R=root.NightshiftBusinessRules,KEY='nightshift-city-businesses-v1';
let state=R.clean();try{state=R.clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
R.advance(state,Date.now());persist();let open=false,nextTick=0,refreshers=[];
const panel=doc.createElement('div');panel.id='businessPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Properties and street markets');doc.body.appendChild(panel);
function blocked(){return ['Craft','Progress','Backups','Map','Vehicles','Inventory','Recovery','Home'].some(name=>root['Nightshift'+name]?.paused?.())}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function pocket(){return root.NightshiftInventory.state.pocket}
function preview(cmd){const refusal=root.NightshiftCrews?.marketAccess(cmd.id);if(refusal&&['buy','sell'].includes(cmd.action))return {ok:false,reason:refusal};return R.transact(state,player,pocket(),cmd,Date.now(),true)}
function perform(cmd){
 if(!open||blocked())return {ok:false,reason:'Business menu unavailable'};
 R.advance(state,Date.now());const refusal=root.NightshiftCrews?.marketAccess(cmd.id);const result=refusal&&['buy','sell'].includes(cmd.action)?{ok:false,reason:refusal}:R.transact(state,player,pocket(),cmd);
 if(result.ok){persist();save();root.NightshiftAudio?.play('pickup')}
 say(result.message||result.reason);render();
 if(result.ok&&cmd.action==='accept-order'){const order=R.ORDERS[state.orders.active.index];route({...order,id:'rush-order',label:'RUSH ORDER · '+order.name})}
 if(result.ok&&['complete-order','cancel-order'].includes(cmd.action))root.NightshiftMap.clear?.('business-rush-order');
 return result;
}
function close(){open=false;panel.hidden=true;releaseControls()}
function route(spec){close();root.NightshiftMap?.navigate({id:'business-'+spec.id,label:spec.label,x:spec.x,y:spec.y})}
function text(parent,tag,value){const n=doc.createElement(tag);n.textContent=value;parent.appendChild(n);return n}
function control(parent,label,cmd){const b=doc.createElement('button');b.textContent=label;b.addEventListener('click',()=>perform(typeof cmd==='function'?cmd():cmd));parent.appendChild(b);refreshers.push(()=>{const result=preview(typeof cmd==='function'?cmd():cmd);b.disabled=!result.ok;b.title=result.ok?'':result.reason});return b}
function time(ms){return Math.max(0,Math.ceil(ms/1000))+'s'}
function render(){
 panel.textContent='';refreshers=[];text(panel,'h2','BUSINESSES & STREET MARKETS');
 const summary=text(panel,'p','');refreshers.push(()=>{summary.textContent='$'+player.cash+' · Heat '+player.heat.toFixed(1)+' · '+state.ledger.batches+' batches · '+state.ledger.sold+' units sold · $'+state.ledger.earned+' sales revenue'});
 const pressure=text(panel,'p','');pressure.className='businessPressure';refreshers.push(()=>{pressure.hidden=player.heat<2;pressure.textContent='POLICE PRESSURE · underground trades locked at heat 2. Close BIZ and lose heat first. The legal workshop stays available.'});
 text(panel,'p','Travel to each marker to transact. Property stock stays stored until collected; everything in your pockets drops on death. Street trades raise heat and stop at heat 2. The Auto Workshop is a legal alternative: sell parts at the corner shop.');
 const orderCard=doc.createElement('section');orderCard.className='businessCard';panel.appendChild(orderCard);text(orderCard,'h3','RUSH ORDERS');
 const orderInfo=text(orderCard,'p','');refreshers.push(()=>{const o=state.orders,job=R.ORDERS[o.active?.index??o.index];orderInfo.textContent=job.name+' · '+job.count+' '+job.item+' → $'+job.reward+' · '+(o.active?'Deadline '+time(o.active.until-Date.now()):'Limit '+job.duration/1000+'s · '+(o.cooldownAt>Date.now()?'Next order in '+time(o.cooldownAt-Date.now()):'Available now'))+' · '+o.completed+' completed'});
 text(orderCard,'p','Bring your own carried goods. Start the timer when ready. No goods are reserved or removed until delivery; cancellation/expiry keeps the five-minute cooldown.');
 control(orderCard,'ACCEPT RUSH ORDER',{action:'accept-order'});control(orderCard,'DELIVER ORDER',{action:'complete-order'});control(orderCard,'CANCEL ORDER',{action:'cancel-order'});
 const orderGPS=text(orderCard,'button','GPS · ACTIVE ORDER');orderGPS.addEventListener('click',()=>{if(state.orders.active){const job=R.ORDERS[state.orders.active.index];route({...job,id:'rush-order',label:'RUSH ORDER · '+job.name})}});refreshers.push(()=>orderGPS.disabled=!state.orders.active);
 for(const spec of R.PROPERTIES){
  const card=doc.createElement('section');card.className='businessCard';panel.appendChild(card);text(card,'h3',spec.name+' · '+(spec.illegal?'UNDERGROUND':'LEGAL'));
  const status=text(card,'p','');refreshers.push(()=>{const p=state.properties[spec.id];status.textContent=p.owned?'Level '+p.level+' · Stored '+p.stock+'/'+R.capacity(spec,p)+' '+spec.item+(p.until?' · '+p.batch+' ready in '+time(p.until-Date.now()):' · No batch running'):'Property price $'+spec.price+' · Produces '+spec.item;status.textContent+=' · '+(Math.hypot(player.x-spec.x,player.y-spec.y)<=75?'At entrance':'GPS to manage')});
  const routeButton=text(card,'button','GPS · '+spec.label);routeButton.addEventListener('click',()=>route(spec));
  const buy=control(card,'BUY PROPERTY · $'+spec.price,{action:'purchase',id:spec.id});
  const start=control(card,'START BATCH · supplies $'+spec.supplies,{action:'start',id:spec.id});
  const details=text(card,'p','');refreshers.push(()=>{const p=state.properties[spec.id];details.textContent='Batch: '+R.output(spec,p)+' units / '+spec.duration/1000+'s. One batch at a time; an offline batch completes once. No automatic restarts.';buy.hidden=p.owned;start.hidden=!p.owned});
  const collect=control(card,'COLLECT READY STOCK',()=>({action:'collect',id:spec.id,count:Math.min(state.properties[spec.id].stock,999-(pocket()[spec.item]||0))}));
  const upgrade=control(card,'UPGRADE',()=>({action:'upgrade',id:spec.id}));refreshers.push(()=>{const p=state.properties[spec.id];collect.hidden=upgrade.hidden=!p.owned;upgrade.textContent=p.level>=3?'MAX LEVEL 3':'UPGRADE · $'+Math.ceil(spec.price*.5*p.level)+' · +1 unit / larger storage'});
 }
 for(const spec of R.MARKETS){
  const card=doc.createElement('section');card.className='businessCard';panel.appendChild(card);text(card,'h3',spec.name);
  const timer=text(card,'p','');refreshers.push(()=>{timer.textContent='Stock and demand refill in '+time(state.markets[spec.id].refillAt-Date.now())+' · '+(Math.hypot(player.x-spec.x,player.y-spec.y)<=75?'At dealer':'GPS to trade')});
  const travel=text(card,'button','GPS · '+spec.label);travel.addEventListener('click',()=>route(spec));
  for(const item of ['weed','coke']){
   const row=doc.createElement('div');row.className='businessTrade';card.appendChild(row);const detail=text(row,'p','');
   refreshers.push(()=>{const m=state.markets[spec.id];detail.textContent=item.toUpperCase()+' · carried '+(pocket()[item]||0)+' · Buy $'+spec.buy[item]+' / Sell $'+spec.sell[item]+' · stock '+(R.STOCK[item]-m.bought[item])+' / demand '+(R.DEMAND[item]-m.sold[item])});
   control(row,'BUY 1',{action:'buy',id:spec.id,item,count:1});control(row,'SELL 1',{action:'sell',id:spec.id,item,count:1});
   control(row,'BUY MAX',()=>({action:'buy',id:spec.id,item,count:Math.max(0,Math.min(R.STOCK[item]-state.markets[spec.id].bought[item],Math.floor(player.cash/spec.buy[item]),999-(pocket()[item]||0)))}));
   control(row,'SELL MAX',()=>({action:'sell',id:spec.id,item,count:Math.min(pocket()[item]||0,R.DEMAND[item]-state.markets[spec.id].sold[item])}));
  }
 }
 const done=text(panel,'button','CLOSE');done.className='businessClose';done.addEventListener('click',close);
 refresh();
}
function refresh(){for(const refresh of refreshers)refresh()}
function show(){if(open){close();return}if(blocked()||player.hp<=0||player.car){if(player.car)say('Park and exit to manage businesses');return}root.NightshiftTouchLayout?.close();releaseControls();R.advance(state,Date.now());persist();open=true;panel.hidden=false;render()}
function nearest(){const all=[...R.PROPERTIES,...R.MARKETS];if(state.orders.active){const order=R.ORDERS[state.orders.active.index];all.push({...order,id:'rush-order'})}return all.filter(p=>Math.hypot(p.x-player.x,p.y-player.y)<=75).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0]||null}
function tick(now){if(!Number.isSafeInteger(now)||now<0)return;if(now<nextTick-1000){nextTick=now;Object.assign(state,R.clean(state,now))}if(now<nextTick)return;nextTick=now+1000;const before=JSON.stringify(state);const completed=R.advance(state,now);if(JSON.stringify(state)!==before)persist();if(completed.includes('order-expired')){say('Rush order expired · goods kept');root.NightshiftMap.clear?.('business-rush-order')}const batches=completed.filter(id=>id!=='order-expired');if(batches.length)say('Business batch ready · '+batches.map(id=>R.property(id).name).join(', '));if(open)refresh()}
function locations(){const all=[...R.PROPERTIES,...R.MARKETS];if(state.orders.active){const o=R.ORDERS[state.orders.active.index];all.push({...o,id:'rush-order',label:'RUSH ORDER · '+o.name,color:'#f1d283'})}return all.map(spec=>({id:'business-'+spec.id,label:spec.label,x:spec.x,y:spec.y,color:spec.color,kind:'business',ready:true}))}
function draw(){for(const spec of [...R.PROPERTIES,...R.MARKETS]){const p=state.properties[spec.id],near=Math.hypot(player.x-spec.x,player.y-spec.y)<110;g.save();g.translate(spec.x,spec.y);
 // Grounded terminals replace the floating hollow squares; anchors stay identical.
 g.fillStyle='#101b2c66';g.fillRect(-9,4,27,9);g.fillStyle='#1b3040';g.fillRect(-10,-18,20,27);g.fillStyle='#6d8386';g.fillRect(-9,-20,18,4);g.fillStyle='#344f5c';g.fillRect(-8,-15,16,21);g.fillStyle=spec.color;g.fillRect(-6,-13,12,7);g.fillStyle='#132b39';g.fillRect(-4,-11,8,3);g.fillStyle='#9eafac';g.fillRect(-5,-3,10,2);g.fillRect(4,1,2,3);
 if(p?.owned){g.fillStyle=p.stock?'#80efab':'#91a6c9';g.fillRect(6,-18,3,3)}
 if(near){g.font='bold 10px monospace';g.textAlign='center';g.fillStyle=spec.color;g.fillText(spec.label,0,-27);if(p?.owned&&p.stock)g.fillText('READY '+p.stock,0,-40)}g.restore()}
 if(state.orders.active){const o=R.ORDERS[state.orders.active.index];g.save();g.strokeStyle='#f1d283';g.lineWidth=2;g.strokeRect(o.x-15,o.y-23,30,36);if(Math.hypot(player.x-o.x,player.y-o.y)<140){g.fillStyle='#f1d283';g.font='bold 11px monospace';g.textAlign='center';g.fillText('ORDER · '+time(state.orders.active.until-Date.now()),o.x,o.y-40)}g.restore()}}

function hud(){const o=state.orders.active;if(!o)return '';const job=R.ORDERS[o.index];return '<br>📦 Rush '+job.count+' '+job.item+' · '+time(o.until-Date.now())}
root.NightshiftBusinesses={hud,state,open:show,close,perform,save:persist,paused:()=>open,tick,locations,nearest,draw,openNearby:()=>{if(!nearest())return false;show();return true}};
const button=doc.createElement('button');button.id='business';button.textContent='BIZ';button.setAttribute('aria-label','Businesses and street markets');button.addEventListener('click',show);doc.querySelector('#actions').appendChild(button);
root.addEventListener('keydown',e=>{if(e.key==='Escape'&&open)close();if(e.key.toLowerCase()==='b'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey)show()});
})(globalThis);
