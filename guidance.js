/* Nearby interaction hints, shared by mouse and touch controls. */
(function(root){
'use strict';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function hint(player,cars=[],buildings=[],loot=[],room=null){
 if(room)return {action:'USE',text:room==='shop'?'Walk to the counter · USE to trade · bottom door exits':'USE near bed, wardrobe or storage · bottom door exits'};
 if(player.car)return {action:'EXIT',text:'Up/down: accelerate/reverse · left/right: steer · hold BRAKE to stop before EXIT'};
 const car=cars.find(c=>distance(c,player)<65);
 if(car)return {action:'ENTER',text:car.owned||car.stolen?'USE to enter this vehicle':'Vehicle locked · MORE → CAR to buy or steal'};
 const building=buildings.find(b=>distance({x:b.x+b.w/2,y:b.y+b.h+12},player)<90);
 if(building)return {action:building.name==='CORNER SHOP'?'SHOP':'USE',text:building.name==='CORNER SHOP'?'USE to enter the shop · trade at the counter':building.name==='GARAGE'?'Park nearby · MORE → CAR to repair or refuel':building.name+' entrance'};
 if(loot.some(l=>distance(l,player)<35))return {action:'PICK',text:'USE to collect nearby cash'};
 return {action:'USE',text:'Left stick: move · right stick: aim · FIRE shoots · MORE → MAP / JOB'};
}
root.NightshiftGuidance={hint};if(!root.document)return;
const style=document.createElement('style');style.textContent='#help{bottom:152px;left:12px;transform:none;max-width:190px;text-align:left;font-size:11px;pointer-events:none}@media(max-height:500px){#help{display:none}}';document.head.appendChild(style);
let previous='';root.NightshiftGuidance.render=room=>{
 const value=hint(player,cars,buildings,loot,room);if(!room&&!player.car&&value.action==='USE'&&root.NightshiftSalvage?.nearest()){value.action='SEARCH';value.text='USE to search salvage · stand still · sell finds at the shop'}if(!room&&!player.car&&root.NightshiftSafeZones?.protected(player)&&value.action==='USE')value.text='Clinic safe area · weapons/crime disabled · JOB starts a delivery';const key=value.action+'|'+value.text+'|'+!!player.car;
 if(key===previous)return;previous=key;
 const help=document.querySelector('#help'),use=document.querySelector('#use');help.textContent=value.text;use.textContent=value.action;use.setAttribute('aria-label',value.action==='EXIT'?'Exit stopped vehicle':value.action==='ENTER'?'Enter nearby vehicle':value.action==='SHOP'?'Enter corner shop':'Interact');document.querySelector('#reload').disabled=!!player.car;document.querySelector('#run').disabled=!!player.car;
};
})(globalThis);
