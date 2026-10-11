/* Browser-local control preferences. Does not alter game economy or character saves. */
(function(root){
'use strict';
const KEY='nightshift-city-controls-v1';
function clean(raw){return {hand:raw?.hand==='left'?'left':'right',size:raw?.size==='compact'?'compact':'standard',hints:raw?.hints!==false}}
root.NightshiftTouchLayout={clean};if(!root.document)return;
const doc=root.document;let state=clean();try{state=clean(JSON.parse(root.localStorage.getItem(KEY)||'{}'))}catch{}
function apply(){doc.body.setAttribute('data-control-hand',state.hand);doc.body.setAttribute('data-control-size',state.size);doc.body.setAttribute('data-control-hints',String(state.hints));root.releaseControls?.();try{root.localStorage.setItem(KEY,JSON.stringify(state))}catch{};render()}
function set(patch){state=clean({...state,...patch});apply();return {...state}}
const panel=doc.createElement('div');panel.id='controlSettings';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','Touch control preferences');doc.body.appendChild(panel);
function option(label,act){const b=doc.createElement('button');b.textContent=label;b.addEventListener('click',act);panel.appendChild(b)}
function render(){panel.textContent='';const title=doc.createElement('strong');title.textContent='TOUCH CONTROLS';panel.appendChild(title);const description=doc.createElement('p');description.textContent='Layout changes release held controls. Preferences stay on this device.';panel.appendChild(description);option('HAND · '+(state.hand==='left'?'LEFT':'RIGHT'),()=>set({hand:state.hand==='left'?'right':'left'}));option('SIZE · '+state.size.toUpperCase(),()=>set({size:state.size==='compact'?'standard':'compact'}));option('HINTS · '+(state.hints?'ON':'OFF'),()=>set({hints:!state.hints}));option('RESET DEFAULTS',()=>set(clean()));option('CLOSE',()=>{panel.hidden=true;button.setAttribute('aria-expanded','false')})}
const button=doc.createElement('button');button.id='controls';button.textContent='CTRL';button.setAttribute('aria-label','Touch control preferences');button.setAttribute('aria-expanded','false');button.addEventListener('click',()=>{if(panel.hidden&&['Businesses','Craft','Progress','Backups','Map','Vehicles','Inventory','Recovery','Home'].some(name=>root['Nightshift'+name]?.paused?.()))return;root.releaseControls?.();panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));render()});doc.querySelector('#actions').appendChild(button);
function close(){panel.hidden=true;button.setAttribute('aria-expanded','false')}
Object.assign(root.NightshiftTouchLayout,{set,close});Object.defineProperty(root.NightshiftTouchLayout,'state',{get:()=>({...state})});
doc.addEventListener?.('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&e.target!==button)close()},true);
root.addEventListener('keydown',()=>{if(!panel.hidden)close()});
apply();
})(globalThis);
