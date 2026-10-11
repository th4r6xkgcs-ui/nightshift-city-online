/* Frame-rate-independent speed framing and bounded directional lookahead. */
(function(root){'use strict';
function framing(speed){const amount=Math.max(0,Math.min(1,(Math.abs(Number.isFinite(speed)?speed:0)-.8)/5.2));return 1.25-.35*amount*amount*(3-2*amount)}
function step(state,input,seconds){
 const dt=Math.max(0,Math.min(.1,Number.isFinite(seconds)?seconds:0)),speed=Number.isFinite(input.speed)?input.speed:0,alpha=1-Math.exp(-dt*5);
 const currentZoom=Number.isFinite(state.zoom)&&state.zoom>0?state.zoom:1,angle=Number.isFinite(input.angle)?input.angle:0;
 const zoom=currentZoom+(framing(speed)-currentZoom)*alpha;
 const ahead=Number.isFinite(input.angle)?Math.max(-84,Math.min(84,speed*12)):0;
 const lookX=(Number.isFinite(state.lookX)?state.lookX:0)+(Math.cos(angle)*ahead-(Number.isFinite(state.lookX)?state.lookX:0))*alpha;
 const lookY=(Number.isFinite(state.lookY)?state.lookY:0)+(Math.sin(angle)*ahead-(Number.isFinite(state.lookY)?state.lookY:0))*alpha;
 return {x:Math.max(0,Math.min(Math.max(0,input.world.w-input.width/zoom),input.x+lookX-input.width/(2*zoom))),y:Math.max(0,Math.min(Math.max(0,input.world.h-input.height/zoom),input.y+lookY-input.height/(2*zoom))),zoom,lookX,lookY};
}
root.NightshiftCamera={step,framing};
})(globalThis);
