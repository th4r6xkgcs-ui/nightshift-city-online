/* Nightshift City v0.4 — local gameplay loop, no server economy */
(function(root){
  'use strict';
  const JOB={pickup:{x:440,y:340},dropoff:{x:1320,y:1020},reward:225,radius:85};
  function near(a,b,r=JOB.radius){return Math.hypot(a.x-b.x,a.y-b.y)<=r}
  function advance(state,pos){
    if(state==='pickup'&&near(pos,JOB.pickup))return {stage:'dropoff',reward:0};
    if(state==='dropoff'&&near(pos,JOB.dropoff))return {stage:'idle',reward:JOB.reward};
    return {stage:state,reward:0};
  }
  root.NightshiftActivities={JOB,near,advance};
  if(!root.document||!root.requestAnimationFrame)return;
  const doc=root.document, btn=doc.createElement('button');
  btn.id='job';btn.textContent='JOB';btn.setAttribute('aria-label','Courier job');
  doc.querySelector('#actions').appendChild(btn);
  const panel=doc.createElement('div');panel.id='jobPanel';
  panel.style.cssText='position:absolute;top:112px;left:12px;max-width:215px;padding:9px;background:#101728e6;border:1px solid #7ba9ce;border-radius:8px;font:12px system-ui;color:white;pointer-events:none';
  doc.body.appendChild(panel);
  const marker=doc.createElement('div');marker.style.cssText='position:absolute;left:50%;top:64px;transform:translateX(-50%);background:#132139dd;padding:5px 9px;border-radius:7px;color:#f8df91;font:bold 12px system-ui;pointer-events:none';doc.body.appendChild(marker);
  let stage='idle',owned=false,active=true;
  const apartment={x:880,y:680,price:1200};
  const propertyButton=doc.createElement('button');propertyButton.id='property';propertyButton.textContent='HOME';propertyButton.setAttribute('aria-label','Buy or visit apartment');doc.querySelector('#actions').appendChild(propertyButton);
  function notify(t){if(typeof say==='function')say(t)}
  function saveExtras(){try{root.localStorage.setItem('nightshift-city-activities-v1',JSON.stringify({owned,stage}))}catch{}}
  try{const d=JSON.parse(root.localStorage.getItem('nightshift-city-activities-v1')||'{}');owned=d.owned===true;stage=['idle','pickup','dropoff'].includes(d.stage)?d.stage:'idle'}catch{}
  const act=()=>{
    if(root.NightshiftVehicles?.paused()||root.NightshiftHome?.paused()||root.NightshiftRecovery?.paused()||root.NightshiftInventory?.paused())return;
    if(typeof player==='undefined'||player.car){notify('Exit your vehicle to accept or deliver jobs');return}
    if(stage==='idle'){stage='pickup';saveExtras();notify('Courier job started: collect parcel at the yellow marker')}
    else {if(stage==='dropoff'&&!(root.NightshiftInventory.state.pocket.parcel>0)){stage='idle';saveExtras();notify('Parcel lost or stored · job cancelled. Tap JOB to restart.');return}const result=advance(stage,player);if(result.stage===stage){notify('Travel to the objective marker first');return}stage=result.stage;if(result.reward){root.NightshiftInventory.state.pocket.parcel--;if(!root.NightshiftInventory.state.pocket.parcel)delete root.NightshiftInventory.state.pocket.parcel;player.cash+=result.reward;notify('Delivery complete! +$'+result.reward);if(typeof save==='function')save()}else{root.NightshiftInventory.state.pocket.parcel=(root.NightshiftInventory.state.pocket.parcel||0)+1;save();notify('Parcel collected. Deliver it to the drop-off')}saveExtras()}
  };btn.addEventListener('pointerdown',act);root.NightshiftActivities.act=act;Object.defineProperty(root.NightshiftActivities,'stage',{get:()=>stage});
  propertyButton.addEventListener('pointerdown',()=>{
    if(typeof player==='undefined')return;
    if(root.NightshiftVehicles?.paused()||root.NightshiftHome?.paused()||root.NightshiftRecovery?.paused()||root.NightshiftInventory?.paused())return;
    if(player.car){notify('Exit your vehicle before visiting home');return}
    if(!near(player,apartment,105)){notify('Apartment is near 880, 680 — follow HOME marker');return}
    if(owned){root.NightshiftHome?.enter();return}
    if(player.cash<apartment.price){notify('Apartment costs $'+apartment.price);return}
    player.cash-=apartment.price;owned=true;saveExtras();if(typeof save==='function')save();notify('Apartment purchased for $'+apartment.price);
  });
  function loop(){
    if(!active)return;
    if(typeof player!=='undefined'){
      panel.hidden=marker.hidden=!!root.NightshiftHome?.paused();
      const target=stage==='pickup'?JOB.pickup:stage==='dropoff'?JOB.dropoff:apartment;
      const dist=Math.round(Math.hypot(player.x-target.x,player.y-target.y));
      const angle=Math.atan2(target.y-player.y,target.x-player.x);
      const arrows=['→','↘','↓','↙','←','↖','↑','↗'];
      const arrow=arrows[(Math.round(angle/(Math.PI/4))+8)%8];
      panel.textContent=stage==='idle'?'COURIER: Tap JOB to accept a $225 delivery':stage==='pickup'?'COURIER: Reach pickup, then tap JOB':'COURIER: Reach destination, then tap JOB';
      marker.textContent=arrow+' '+dist+'m · '+(stage==='idle'?(owned?'HOME OWNED':'APARTMENT $1200'):stage==='pickup'?'PICKUP':'DELIVER');
    }
    root.requestAnimationFrame(loop);
  }
  root.requestAnimationFrame(loop);
})(typeof globalThis!=='undefined'?globalThis:this);
