/* User-controlled browser save backups. These do not provide cloud sync. */
(function(root){
'use strict';
const KEYS=['nightshift-city-save-v2','nightshift-city-inventory-v1','nightshift-city-activities-v1','nightshift-city-crime-v1','nightshift-city-profile-v1','nightshift-city-vehicles-v1'];
const RECOVERY_KEY='nightshift-city-before-restore';
function validate(raw){
 if(raw?.format!=='nightshift-city-backup'||raw.version!==1||!raw.saves||typeof raw.saves!=='object'||Array.isArray(raw.saves))throw Error('Unsupported backup file');
 const out={};
 for(const key of KEYS){
  if(raw.saves[key]===undefined)continue;
  if(typeof raw.saves[key]!=='string'||raw.saves[key].length>200000)throw Error('Invalid save entry');
  const value=JSON.parse(raw.saves[key]);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid save data');
  out[key]=raw.saves[key];
 }
 if(!Object.keys(out).length)throw Error('Backup contains no game saves');
 return out;
}
function snapshot(storage){const out={};for(const key of KEYS)out[key]=storage.getItem(key);return out}
function write(storage,data){for(const key of KEYS){if(typeof data[key]==='string')storage.setItem(key,data[key]);else storage.removeItem(key)}}
function restore(storage,raw){
 const data=validate(raw),old=snapshot(storage);
 storage.setItem(RECOVERY_KEY,JSON.stringify(old));
 try{write(storage,data)}catch(error){write(storage,old);throw error}
 return old;
}
function undo(storage){
 const old=JSON.parse(storage.getItem(RECOVERY_KEY)||'null');
 if(!old||typeof old!=='object'||Array.isArray(old))throw Error('No previous save available');
 const current=snapshot(storage);
 try{write(storage,old)}catch(error){write(storage,current);throw error}
 storage.removeItem(RECOVERY_KEY);
}
root.NightshiftBackups={validate,KEYS,restore,undo,snapshot};if(!root.document)return;
const panel=document.createElement('div');panel.id='backupPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Save backups');panel.style.cssText='position:fixed;z-index:28;inset:15% 6% auto;max-height:75dvh;overflow:auto;background:#142139;padding:20px;border-radius:12px;border:1px solid #93b0c9;color:white';document.body.appendChild(panel);
const title=document.createElement('p');title.textContent='LOCAL SAVES · download a backup to move progress to another browser/device';panel.appendChild(title);
function button(label,act){const b=document.createElement('button');b.textContent=label;b.style.cssText='width:100%;height:46px;border-radius:7px;margin:5px 0';b.addEventListener('click',act);panel.appendChild(b);return b}
button('DOWNLOAD SAVE BACKUP',()=>{
 save();
 try{
  const saves={};for(const [key,value] of Object.entries(snapshot(localStorage)))if(value!==null)saves[key]=value;
  const text=JSON.stringify({format:'nightshift-city-backup',version:1,savedAt:new Date().toISOString(),saves},null,2);
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='nightshift-city-save.json';document.body.appendChild(a);a.click();a.remove();root.setTimeout(()=>URL.revokeObjectURL(url),1000);say('Save backup downloaded');
 }catch{say('Could not export browser save')}
});
const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;input.addEventListener('change',async()=>{
 const file=input.files?.[0];if(!file)return;
 if(file.size>1000000){say('Backup file is too large');return}
 try{restore(localStorage,JSON.parse(await file.text()));root.location.reload()}catch(error){say('Restore failed: '+error.message)}
});panel.appendChild(input);
button('RESTORE BACKUP · replaces local progress',()=>{input.value='';input.click()});
button('UNDO LAST RESTORE',()=>{try{undo(localStorage);root.location.reload()}catch(error){say(error.message)}});
button('CLOSE',()=>panel.hidden=true);root.NightshiftBackups.paused=()=>!panel.hidden;
const b=document.createElement('button');b.id='saves';b.textContent='SAVES';b.addEventListener('click',()=>{if(NightshiftHome.paused()||NightshiftInventory.paused()||NightshiftRecovery.paused()||NightshiftVehicles.paused()||NightshiftMap.paused())return;releaseControls();panel.hidden=false});document.querySelector('#actions').appendChild(b);
})(globalThis);
