/* Frame-rate-independent viewport easing, clamped to the world. */
(function(root){
'use strict';
function step(state,input,seconds){const dt=Math.max(0,Math.min(.1,Number.isFinite(seconds)?seconds:0)),target=Math.abs(input.speed||0)>3?.9:1.25,alpha=1-Math.exp(-dt*5);const zoom=(state.zoom||1)+(target-(state.zoom||1))*alpha;return{x:Math.max(0,Math.min(Math.max(0,input.world.w-input.width/zoom),input.x-input.width/(2*zoom))),y:Math.max(0,Math.min(Math.max(0,input.world.h-input.height/zoom),input.y-input.height/(2*zoom))),zoom}}
root.NightshiftCamera={step};
})(globalThis);
