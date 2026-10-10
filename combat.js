/* v0.6 finite-ammo and timed reload rules; browser-independent core. */
(function(root){
'use strict';
const MAG_SIZE=30, RELOAD_MS=1300, MAX_RESERVE=240;
function create(reserve=90){return {reserve:Math.max(0,Math.min(MAX_RESERVE,Math.floor(reserve))),until:0}}
function begin(state,ammo,now){
 if(state.until>now)return false;
 if(ammo>=MAG_SIZE||state.reserve<=0)return false;
 state.until=now+RELOAD_MS;return true;
}
function finish(state,ammo,now){
 if(!state.until||now<state.until)return ammo;
 const amount=Math.min(MAG_SIZE-ammo,state.reserve);
 state.reserve-=amount;state.until=0;return ammo+amount;
}
function canFire(state,ammo,now){return ammo>0&&(!state.until||now>=state.until)}
root.NightshiftCombat={MAG_SIZE,RELOAD_MS,MAX_RESERVE,create,begin,finish,canFire};
})(typeof globalThis!=='undefined'?globalThis:this);
