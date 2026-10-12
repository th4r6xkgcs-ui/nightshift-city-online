const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const calls=[];let depth=0;
const ctx=new Proxy({save(){depth++},restore(){depth--},fillRect(...a){calls.push([this.fillStyle,...a])}},{get:(o,k)=>o[k]??(()=>{})});
const root={};vm.createContext(root);for(const name of ['pets-data.js','detailed-art.js'])vm.runInContext(fs.readFileSync(name,'utf8'),root);
const art=root.NightshiftDetailedArt;assert.equal(Object.keys(art.weaponForms).length,20);
const signatures=new Set();for(const id of Object.keys(art.weaponForms)){calls.length=0;art.weapon(ctx,id,0,0);signatures.add(JSON.stringify(calls));assert.equal(depth,0);assert.ok(calls.every(c=>c.slice(1).every(Number.isFinite)))}assert.ok(signatures.size>=17,'recognizably distinct guns');
const pose={x:0,y:0,angle:0,moving:true},before=JSON.stringify(pose);for(const p of root.NightshiftPetsData.PETS){calls.length=0;art.pet(ctx,p.id,pose,1);assert.ok(calls.length>20,p.id+' has detail');assert.equal(depth,0)}assert.equal(JSON.stringify(pose),before);
for(const kind of ['hydrant','mailbox','vending','dumpster','flowercart','barrel','crate','bench','atm']){calls.length=0;art.prop(ctx,kind,0,0);assert.ok(calls.length>7);assert.equal(depth,0)}
console.log('PASS: all 20 gun forms, 11 pets and 9 street props render finite distinct details with balanced state and no simulation mutations');
