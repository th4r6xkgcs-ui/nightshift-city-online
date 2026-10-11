/* Bounded local city history; text only, no economy authority. */
(function(root){'use strict';
const KEY='nightshift-city-journal-v1',LIMIT=24,KINDS=['gang','crew','trade','incident','territory','activity'];
function clean(raw={}){return {version:1,entries:Array.isArray(raw?.entries)?raw.entries.filter(e=>KINDS.includes(e?.kind)&&typeof e.text==='string'&&Number.isSafeInteger(e.at)&&e.at>=0).slice(-LIMIT).map(e=>({kind:e.kind,text:e.text.slice(0,110),at:e.at})):[]}}
function add(state,kind,text,at=Date.now()){if(!KINDS.includes(kind)||typeof text!=='string'||!text.trim()||!Number.isSafeInteger(at)||at<0)return false;state.entries.push({kind,text:text.trim().slice(0,110),at});if(state.entries.length>LIMIT)state.entries.splice(0,state.entries.length-LIMIT);return true}
root.NightshiftJournal={KEY,LIMIT,clean,add};if(!root.document)return;
let state=clean();try{state=clean(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
const doc=root.document,panel=doc.createElement('section');panel.id='cityJournalPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','City journal');doc.body.appendChild(panel);
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function record(kind,text){if(add(state,kind,text)){persist();return true}return false}
function close(){panel.hidden=true;root.releaseControls?.()}
function render(){panel.textContent='';const h=doc.createElement('h2');h.textContent='CITY JOURNAL';panel.appendChild(h);const closeButton=doc.createElement('button');closeButton.textContent='Close';closeButton.addEventListener('click',close);panel.appendChild(closeButton);const rows=state.entries.slice().reverse();if(!rows.length){const p=doc.createElement('p');p.textContent='Your street decisions, crew jobs and corner outcomes appear here.';panel.appendChild(p)}for(const entry of rows){const p=doc.createElement('p');p.textContent=new Date(entry.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+' · '+entry.text;p.setAttribute('data-kind',entry.kind);panel.appendChild(p)}}
function open(){root.NightshiftInterface?.close();if(root.NightshiftRPG?.paused()||['Home','Inventory','Businesses','Map','Recovery','Craft','Backups','Progress','Vehicles'].some(n=>root['Nightshift'+n]?.paused?.())||player.hp<=0)return false;root.releaseControls?.();panel.hidden=false;render();return true}
Object.assign(root.NightshiftJournal,{state,save:persist,record,open,close,paused:()=>!panel.hidden});const button=doc.createElement('button');button.id='journal';button.textContent='JOURNAL';button.setAttribute('aria-label','City event journal');button.addEventListener('click',open);doc.querySelector('#actions').appendChild(button);root.addEventListener('keydown',e=>{if(panel.hidden)return;if(e.key==='Escape'){close();e.preventDefault?.()}e.stopImmediatePropagation?.()},true);root.addEventListener('pagehide',persist);
})(globalThis);
