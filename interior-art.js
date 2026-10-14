/* Cached room surfaces. Furniture, paths and interactions stay in home.js. */
(function(root){'use strict';
const caches=new Map(),valid=kind=>kind==='home'||kind==='shop';
function rect(ctx,color,x,y,w,h){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
function rug(ctx,x,y,w,h,color){rect(ctx,'#18282833',x+3,y+4,w,h);rect(ctx,'#baa58a',x,y,w,h);rect(ctx,color,x+3,y+3,w-6,h-6);rect(ctx,'#d4ba9744',x+9,y+9,w-18,2);rect(ctx,'#d4ba9744',x+9,y+h-11,w-18,2);for(let i=0;i<w;i+=9){rect(ctx,'#c7b395',x+i,y-2,3,2);rect(ctx,'#c7b395',x+i,y+h,3,2)}}
function paint(ctx,kind){
 if(!valid(kind)||!ctx)return false;
 ctx.save();ctx.beginPath();ctx.rect(0,0,640,420);ctx.clip();rect(ctx,'#182831',0,0,640,420);
 if(kind==='home'){
  const colors=['#75614e','#7d6852','#826b55','#796650'];
  for(let y=24;y<404;y+=18)for(let x=-((y/18|0)%2)*72;x<640;x+=144){rect(ctx,colors[((x+144)/72+(y/18|0))%4|0],x,y,142,17);rect(ctx,'#ac8d6633',x+5,y+2,128,1);rect(ctx,'#493d3422',x+23,y+12,85,1)}
  // Kitchen tile and rugs are flat floor decoration, never extra obstacles.
  for(let y=26;y<159;y+=22)for(let x=386;x<616;x+=22){rect(ctx,(x/22+y/22|0)%2?'#9ca192':'#93998c',x,y,21,21);rect(ctx,'#c9c6a522',x+2,y+2,17,1)}
  rug(ctx,49,47,177,116,'#645b76');rug(ctx,55,200,200,100,'#67796b');rug(ctx,277,315,86,57,'#a18460');
  rect(ctx,'#343c3666',269,64,88,73);
 }else{
  for(let y=24;y<404;y+=24)for(let x=24;x<616;x+=24){rect(ctx,((x+y)/24)%2?'#919c98':'#7c8d8b',x,y,23,23);rect(ctx,'#c8d0bb33',x+2,y+2,20,1)}
  // Contrasting aisle runners make the counter and main walking aisle readable.
  rect(ctx,'#596f6a',259,116,121,196);rect(ctx,'#b1b993',265,120,2,188);rect(ctx,'#b1b993',372,120,2,188);
  rug(ctx,274,319,92,56,'#3d6268');
  for(const [x,w] of [[55,190],[395,170]]){rect(ctx,'#283f3a44',x+4,113,w,14);rect(ctx,'#c4c6a1',x,44,w,9);rect(ctx,'#61796b',x+3,46,w-6,3)}
  rect(ctx,'#34484744',414,272,151,11);rect(ctx,'#d2bf8b',427,284,126,3);
 }
 // Raised perimeter, north-facing windows and trim stay inside the existing wall clearance.
 rect(ctx,kind==='home'?'#cab69a':'#b0c3bc',8,8,624,16);rect(ctx,'#e4d5b1',12,8,616,3);rect(ctx,'#44524d',8,24,624,5);
 for(const x of [28,602]){rect(ctx,'#40514f',x,29,10,366);rect(ctx,'#b9b49b',x,29,3,366)}
 for(const x of [72,429]){
  rect(ctx,'#354c58',x,11,123,13);rect(ctx,'#81aaa9',x+3,13,117,8);rect(ctx,'#e4d7b7',x+59,11,3,13);rect(ctx,'#d5c7a4',x-3,22,129,3);
  ctx.fillStyle='#e3cb8b12';ctx.beginPath();ctx.moveTo(x+3,29);ctx.lineTo(x+120,29);ctx.lineTo(x+154,188);ctx.lineTo(x-16,188);ctx.closePath();ctx.fill();
 }
 rect(ctx,'#44524d',8,396,624,16);rect(ctx,'#a8ad96',12,396,616,3);rect(ctx,'#263d40',278,396,84,16);
 // Wall-mounted art and shop sign do not occupy walkable floor.
 const plant=(px,py)=>{rect(ctx,'#0a0f1a44',px-7,py+6,16,4);rect(ctx,'#7a4b2f',px-6,py-2,12,9);rect(ctx,'#94603e',px-6,py-2,12,2);for(const [dx,dy,c] of [[-8,-10,'#3f7a4a'],[0,-14,'#4f9a5a'],[4,-8,'#2f6a3e'],[-4,-6,'#5aab66']])rect(ctx,c,px+dx,py+dy,8,8)};
 if(kind==='home'){plant(48,372);plant(592,372);rect(ctx,'#2b2733',300,2,40,6)}else{plant(48,372);plant(592,372)}
 rect(ctx,'#354544',252,9,135,14);ctx.fillStyle='#e3d2a7';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(kind==='home'?'YOUR APARTMENT':'CORNER SHOP',320,19);
 ctx.restore();return true;
}
function draw(kind,ctx){
 if(!valid(kind)||!ctx)return false;
 let canvas=caches.get(kind);
 if(!canvas){const candidate=root.document?.createElement?.('canvas'),surface=candidate?.getContext?.('2d');if(surface){candidate.width=640;candidate.height=420;surface.imageSmoothingEnabled=false;paint(surface,kind);caches.set(kind,candidate);canvas=candidate}}
 if(canvas)ctx.drawImage(canvas,0,0);else paint(ctx,kind);return true;
}
// Art pass (Claude): time-of-day light for rooms, drawn after furniture and the player.
function light(kind,ctx){
 if(!valid(kind)||!ctx||typeof ctx.createRadialGradient!=='function'||!ctx.createRadialGradient(0,0,0,0,0,1)?.addColorStop)return false;
 const env=root.NightshiftEnvironment,night=env?.darkness?.(env?.state?.minute??720)||0;
 ctx.save();
 if(night>0){ctx.fillStyle=`rgba(8,12,34,${.42*night})`;ctx.fillRect(0,0,640,420);
  ctx.globalCompositeOperation='lighter';
  const glow=(x,y,r,c,a)=>{const gr=ctx.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,`rgba(${c},${a})`);gr.addColorStop(1,`rgba(${c},0)`);ctx.fillStyle=gr;ctx.fillRect(x-r,y-r,r*2,r*2)};
  if(kind==='home'){glow(226,78,90,'255,200,120',.32*night);glow(320,220,190,'255,214,150',.12*night);glow(490,250,70,'120,170,255',.08*night)}
  else{glow(320,200,260,'200,255,235',.14*night);glow(490,290,80,'255,230,160',.18*night)}
  for(const x of [72,429]){ctx.fillStyle=`rgba(120,150,255,${.18*night})`;ctx.fillRect(x+3,13,117,8)}
 }else{
  ctx.globalCompositeOperation='lighter';
  for(const x of [72,429]){const gr=ctx.createLinearGradient(0,29,0,200);gr.addColorStop(0,'rgba(255,236,190,.10)');gr.addColorStop(1,'rgba(255,236,190,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(x+3,29);ctx.lineTo(x+120,29);ctx.lineTo(x+160,200);ctx.lineTo(x-20,200);ctx.closePath();ctx.fill()}
 }
 ctx.restore();return true}
root.NightshiftInteriors={draw,paint,light,cacheStats:()=>({surfaces:caches.size,maxSurfaces:2,width:640,height:420})};
})(globalThis);
