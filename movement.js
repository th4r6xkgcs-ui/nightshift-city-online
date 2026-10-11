/* Transient sprint stamina, advanced only by the active fixed-step simulation. */
(function(root){
'use strict';
function create(){return {stamina:100,exhausted:false}}
function step(state,input,seconds){
 const dt=Math.max(0,Math.min(.2,Number.isFinite(seconds)?seconds:0));
 if(!input.sprint)state.exhausted=false;
 if(state.exhausted&&state.stamina>=30)state.exhausted=false;
 const sprinting=!!input.sprint&&!!input.moving&&!input.driving&&!state.exhausted&&state.stamina>0;
 state.stamina=Math.max(0,Math.min(100,state.stamina+(sprinting?-18:12)*dt));
 if(state.stamina===0)state.exhausted=true;
 return sprinting?5:3;
}
root.NightshiftMovement={create,step,state:create(),rest(){this.state.stamina=100;this.state.exhausted=false}};
})(globalThis);
