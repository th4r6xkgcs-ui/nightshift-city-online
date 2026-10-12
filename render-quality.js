/* CSS-space game coordinates with a bounded high-density drawing surface. */
(function(root){'use strict';
function display(width,height,dpr=1){const w=Number.isFinite(width)?Math.max(1,Math.floor(width)):1,h=Number.isFinite(height)?Math.max(1,Math.floor(height)):1,ratio=Math.min(2,Math.max(1,Number.isFinite(dpr)?dpr:1),Math.sqrt(4000000/(w*h)));return {w,h,ratio,pixelWidth:Math.max(1,Math.floor(w*ratio)),pixelHeight:Math.max(1,Math.floor(h*ratio))}}
root.NightshiftRenderQuality={display};
})(globalThis);
