/* Pixel city art: cached ground, layered architecture, unchanged collision catalog. */
(function(root){'use strict';
const createBuildings=(width,height)=>NightshiftCityData.createBuildings(width,height);
const hash=(x,y)=>((Math.imul(x|0,73856093)^Math.imul(y|0,19349663))>>>0);
function rect(ctx,color,x,y,w,h){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)}

function wash(ctx,color,x,y,w,h,top='#ffffff12',bottom='#081c3055'){
 rect(ctx,color,x,y,w,h);const shade=ctx.createLinearGradient?.(x,y,x,y+h);
 if(shade?.addColorStop){shade.addColorStop(0,top);shade.addColorStop(1,bottom);ctx.fillStyle=shade;ctx.fillRect(x,y,w,h)}
}
function oval(ctx,color,x,y,rx,ry){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
const palettes=Object.freeze({west:Object.freeze({yard:'#596650',edge:'#8f8974',facade:'#967b63',roof:'#6c7062',accent:'#c1a479'}),midtown:Object.freeze({yard:'#566264',edge:'#9caaa5',facade:'#879698',roof:'#657580',accent:'#b3d2ce'}),south:Object.freeze({yard:'#61584c',edge:'#817565',facade:'#886655',roof:'#655c51',accent:'#b69c70'}),docks:Object.freeze({yard:'#53605d',edge:'#84938b',facade:'#6a7d78',roof:'#536967',accent:'#d0b76b'})});
// v0.57 (Claude): the original 5x5-block core keeps its four districts; the city now spreads east and south into
// eight more neighbourhoods (15x15 blocks). Each reuses one of the four palettes and has its own name.
const REGIONS=[
 {bx:[5,9],by:[0,4],style:'midtown',name:'DOWNTOWN'},{bx:[10,14],by:[0,4],style:'west',name:'THE HEIGHTS'},
 {bx:[0,4],by:[5,9],style:'south',name:'OLD TOWN'},{bx:[5,9],by:[5,9],style:'midtown',name:'MARKET DISTRICT'},{bx:[10,14],by:[5,9],style:'docks',name:'IRONWORKS'},
 {bx:[0,4],by:[10,14],style:'west',name:'FAIRVIEW'},{bx:[5,9],by:[10,14],style:'south',name:'THE FLATS'},{bx:[10,14],by:[10,14],style:'docks',name:'HARBOR'}];
function regionAt(x,y){if(x<2200&&y<1700)return null;const bx=Math.floor(x/440),by=Math.floor(y/340);return REGIONS.find(r=>bx>=r.bx[0]&&bx<=r.bx[1]&&by>=r.by[0]&&by<=r.by[1])||REGIONS[REGIONS.length-1]}
function districtStyle(x,y){const r=regionAt(x,y);if(r)return r.style;return y>=1020?(x>=1320?'docks':'south'):(x>=880?'midtown':'west')}
function districtName(x,y){const r=regionAt(x,y);if(r)return r.name;return y>=1020?(x>=1320?'THE DOCKS':'SOUTHSIDE'):(x>=880?'MIDTOWN':'WEST END')}
function palm(ctx,x,y){
 // Cutout fronds, a bent trunk and a consistent cast shadow; cached with paving.
 rect(ctx,'#101c2d44',x+3,y+5,32,8);rect(ctx,'#283d3766',x+20,y-10,16,23);
 for(let k=0;k<7;k++){rect(ctx,k%2?'#8f7857':'#b29768',x-2+(k>3?1:0),y-k*4,5,5);rect(ctx,'#554e3f',x+2,y-k*4,2,4)}
 palmCrown(ctx,x,y);
}
function palmCrown(ctx,x,y){
 const cy=y-28;
 // Continuous tapered leaf silhouettes replace the staircase of square flecks.
 for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1],[-1,0],[1,0]]){
  ctx.fillStyle=dy<0?'#538575':'#2d635b';ctx.beginPath();ctx.moveTo(x,cy);
  ctx.quadraticCurveTo(x+dx*12,cy+dy*12-8,x+dx*25,cy+dy*10+8);
  ctx.quadraticCurveTo(x+dx*14,cy+dy*3+1,x,cy+3);ctx.closePath();ctx.fill();
 }
 oval(ctx,'#89a77d',x,cy,4,3);
}

function palmActors(view){
 const entries=[],margin=70;
 if(!view||!Number.isFinite(view.x)||!Number.isFinite(view.y)||!Number.isFinite(view.zoom)||view.zoom<=0)return entries;
 const right=view.x+view.width/view.zoom+margin,bottom=view.y+view.height/view.zoom+margin;
 for(let x=440;x<world.w;x+=440)for(let y=340;y<world.h;y+=340){
  const district=districtStyle(x+100,y+100);
  if(district!=='midtown'&&district!=='docks')continue;
  for(const yy of [147,246]){
   const px=x+360,py=y+yy;
   if(px>=view.x-margin&&px<=right&&py>=view.y-margin&&py<=bottom)entries.push({kind:'palm-crown',entity:{x:px,y:py}});
  }
 }
 return entries;
}
function treeCrown(ctx,x,y){
 // Large leaf masses carry volume without checkerboard texture.
 oval(ctx,'#193e3e',x+13,y-2,20,15);
 oval(ctx,'#2d6657',x+9,y-10,18,14);
 oval(ctx,'#3c7a60',x+17,y-12,13,11);
 oval(ctx,'#60936f',x+5,y-16,11,7);
 oval(ctx,'#8daa7a44',x+3,y-19,6,3);
}
function treeActors(view){
 const entries=[],margin=65;
 if(!view||!Number.isFinite(view.x)||!Number.isFinite(view.y)||!Number.isFinite(view.zoom)||view.zoom<=0||!Number.isFinite(view.width)||!Number.isFinite(view.height))return entries;
 const right=view.x+view.width/view.zoom+margin,bottom=view.y+view.height/view.zoom+margin;
 for(let x=0;x<world.w;x+=440)for(let y=0;y<world.h;y+=340){
  if(!['west','south'].includes(districtStyle(x+100,y+100)))continue;
  for(const yy of [122,245]){
   const px=x+360,py=y+yy+12;
   if(px>=view.x-margin&&px<=right&&py>=view.y-margin&&py<=bottom)entries.push({kind:'tree-crown',entity:{x:px,y:py}});
  }
 }
 return entries;
}
function signActors(buildings,view){
 const entries=[];
 if(!Array.isArray(buildings)||!view||![view.x,view.y,view.width,view.height,view.zoom].every(Number.isFinite)||view.zoom<=0)return entries;
 const right=view.x+view.width/view.zoom+65,bottom=view.y+view.height/view.zoom+65;
 for(const b of buildings){
  if(!b||!['CLUB','CORNER SHOP','DINER','GARAGE','CLOTHING','BANK'].includes(b.name))continue;
  const x=b.x+b.w/2,y=b.y+b.h-58;
  if(![x,y,b.w].every(Number.isFinite)||b.w<50||x+b.w/2<view.x-65||x-b.w/2>right||y<view.y-65||y>bottom)continue;
  entries.push({kind:'sign',entity:{x,y,w:b.w,name:b.name}});
 }
 return entries;
}
function signTop(p){
 const x=p.x,y=p.y,w=p.w,name=p.name;
 const night=root.NightshiftEnvironment?.darkness(root.NightshiftEnvironment.state?.minute??720)||0;
 const color=night>.2?neonColor(name):'#d6c6ac';
 // Suspended sign fascia: shadow, metal lip and restrained luminous strip.
 rect(g,'#0e1d2a77',x-w/2+11,y-1,w-22,18);
 rect(g,'#263b49',x-w/2+13,y-3,w-26,15);
 rect(g,color,x-w/2+15,y-3,w-30,2);
 rect(g,'#ffffff22',x-w/2+17,y+1,w-34,1);
 g.save();g.fillStyle=color;g.font='bold 11px monospace';g.textAlign='center';g.fillText(name,x,y+9);g.restore();
}
function awningActors(buildings,view){
 const entries=[];
 if(!Array.isArray(buildings)||!view||![view.x,view.y,view.width,view.height,view.zoom].every(Number.isFinite)||view.zoom<=0)return entries;
 const right=view.x+view.width/view.zoom+65,bottom=view.y+view.height/view.zoom+65;
 for(const b of buildings){
  if(!b||!['DINER','CLOTHING','CORNER SHOP'].includes(b.name))continue;
  const x=b.x+7,y=b.y+b.h-39,w=b.w-14;
  if(![x,y,w].every(Number.isFinite)||w<=0||x>right||x+w<view.x-65||y>bottom||y<view.y-65)continue;
  entries.push({kind:'awning',entity:{x:x+w/2,y:y+9,drawX:x,drawY:y,w,name:b.name}});
 }
 return entries;
}
function awningTop(p){
 const color=p.name==='DINER'?'#b95650':p.name==='CLOTHING'?'#518b84':'#5c91a7';
 const x=p.drawX,y=p.drawY,w=p.w;
 rect(g,'#152f4066',x-1,y+1,w+2,10);
 for(let xx=x;xx<x+w;xx+=13)rect(g,Math.floor((xx-x)/13)%2?color:'#e1d2a7',xx,y,Math.min(13,x+w-xx),7);
 rect(g,'#ffffff22',x,y,w,1);
}
function cafeActors(buildings,view){return buildings.filter(b=>['DINER','CORNER SHOP'].includes(b.name)).flatMap(b=>[0,1].map(i=>({kind:'cafe-canopy',entity:{x:b.x+b.w+30,y:b.y+88+i*52,color:b.name==='DINER'?'#b86b57':'#5d8d85'}}))).filter(e=>root.NightshiftScene?.visible(e.entity,view,65))}
function cafeCanopy(p){
 const x=p.x,y=p.y;g.save();oval(g,'#10273955',x+9,y+6,18,9);rect(g,'#b9ab8d',x-1,y-22,2,25);
 g.fillStyle=p.color;g.beginPath();g.moveTo(x,y-39);g.quadraticCurveTo(x+18,y-34,x+19,y-23);g.quadraticCurveTo(x+9,y-18,x,y-23);g.quadraticCurveTo(x-10,y-17,x-19,y-23);g.quadraticCurveTo(x-17,y-34,x,y-39);g.fill();
 g.strokeStyle='#edd7b455';g.lineWidth=1;g.beginPath();g.moveTo(x,y-39);g.lineTo(x,y-23);g.moveTo(x,y-39);g.lineTo(x-10,y-21);g.moveTo(x,y-39);g.lineTo(x+10,y-21);g.stroke();oval(g,'#e7cda6',x,y-38,2,1);g.restore();
}
function furnishings(ctx,x,y){
 const district=districtStyle(x+100,y+100),p=palettes[district];
 // Sidewalk fixtures remain beyond the 66px road edge and away from crosswalks.
 if(district==='west'){
  for(let k=0;k<3;k++){rect(ctx,'#433f34',x+118+k*18,y+250,13,10);rect(ctx,'#607754',x+119+k*18,y+245,11,9);rect(ctx,'#c29d77',x+122+k*18,y+246,3,3)}
 }else if(district==='midtown'){
  rect(ctx,'#263c4366',x+71,y+137,17,51);rect(ctx,'#bac8bf',x+68,y+130,16,49);rect(ctx,'#426573',x+71,y+134,10,40);rect(ctx,'#9db7b755',x+72,y+135,3,35);rect(ctx,p.accent,x+67,y+128,18,4);
  rect(ctx,'#253e47',x+75,y+191,2,17);rect(ctx,'#c2d0b3',x+71,y+187,10,7);
 }else if(district==='south'){
  rect(ctx,'#242b2b66',x+109,y+244,33,18);rect(ctx,'#475b4d',x+105,y+239,32,18);rect(ctx,'#7a8167',x+104,y+237,34,4);rect(ctx,'#283d34',x+109,y+244,25,3);
  for(let k=0;k<4;k++)rect(ctx,'#716953',x+168+k*8,y+276+(k%2)*5,5,2);
 }else{
  // Freight stack sits in the existing rear parking yard, never in a lane.
  for(let k=0;k<2;k++){const xx=x+112+k*102;rect(ctx,'#192c3166',xx+5,y+279,87,25);rect(ctx,k?'#8b7051':'#497c7c',xx,y+267,87,28);rect(ctx,k?'#b09065':'#76a39a',xx,y+267,87,3);for(let r=0;r<10;r++)rect(ctx,'#192c3133',xx+4+r*8,y+272,2,20);rect(ctx,'#c3bc8d',xx+75,y+273,2,16)}
 }
}
function neonColor(name){return name==='CLUB'?'#ef99da':name==='DINER'?'#ffd290':name==='GARAGE'?'#edbd7e':name==='CLOTHING'?'#a3dfcf':name==='CORNER SHOP'?'#9ed8ed':'#d6d7b1'}
function storefrontLight(b,night){
 if(night<=0)return;
 const {x,y,w,h}=b,color=neonColor(b.name),commercial=b.name!=='APARTMENTS'&&b.name!=='WAREHOUSE';
 g.save();
 // Stepped translucent pixel bands create glow without per-building blur surfaces.
 if(commercial){
  g.fillStyle=color;
  for(let k=3;k>0;k--){g.globalAlpha=night*(.025+(3-k)*.015);g.fillRect(x+12-k*3,y+h-58-k*3,w-24+k*6,19+k*6)}
  g.globalAlpha=night*.9;g.fillRect(x+15,y+h-56,w-30,1);g.fillRect(x+15,y+h-43,w-30,1);
  if(b.name==='CLUB'||b.name==='CLOTHING'){g.globalAlpha=night*.7;for(const xx of [x+14,x+w-68]){g.fillRect(xx,y+h-31,54,1);g.fillRect(xx,y+h-31,1,24);g.fillRect(xx+53,y+h-31,1,24)}}
  if(b.name==='CLUB'||b.name==='DINER'){
   const phase=Math.floor((typeof ticks==='number'&&Number.isFinite(ticks)?ticks:0)/18)%3;
   for(let i=0;i<14;i++){g.globalAlpha=night*(i%3===phase?.95:.35);g.fillRect(x+20+i*15,y+h-57,3,3)}
  }
 }
 // Warm entry wash; small window light pools stay clear of the street itself.
 g.fillStyle=b.name==='APARTMENTS'?'#e3c18b':color;
 for(let k=0;k<3;k++){g.globalAlpha=night*(.09-k*.025);g.fillRect(x+w/2-24-k*10,y+h+4+k*8,48+k*20,7)}
 const wet=root.NightshiftEnvironment?.weather(root.NightshiftEnvironment.state?.minute??720)||0;
 if(commercial&&wet){
  for(let k=0;k<6;k++){g.globalAlpha=night*wet*(.18-k*.022);g.fillRect(x+20+(k%2)*13,y+h+10+k*5,w-40-(k%3)*19,2);if(b.name==='CLUB'){g.globalAlpha=night*wet*(.12-k*.015);g.fillRect(x+35+(k%2)*18,y+h+78+k*7,w-70-(k%3)*23,3)}}
 }
 g.restore();
}

// Art pass (Claude): asphalt grit baked into the cached ground once — speckle, patches, cracks, manholes,
// oil stains and tyre marks on the road bands only (deterministic, so every device sees the same streets).
function ground(ctx,width,height){
 rect(ctx,'#344d4b',0,0,width,height);const cafes=new Set(createBuildings(width,height).filter(b=>['DINER','CORNER SHOP'].includes(b.name)).map(b=>(b.x-80)+':'+(b.y-75)));
 for(let x=0;x<width;x+=440)for(let y=0;y<height;y+=340){if(groundView&&(x+500<groundView.x||x-60>groundView.x+groundView.w||y+400<groundView.y||y-60>groundView.y+groundView.h))continue;
  const palette=palettes[districtStyle(x+100,y+100)];rect(ctx,palette.edge,x+82,y+80,276,180);rect(ctx,palette.yard,x+93,y+91,254,156);

  if(x===0&&y===340){
   rect(ctx,'#4c6650',x+104,y+91,240,164);rect(ctx,'#917760',x+126,y+106,198,128);rect(ctx,'#637477',x+132,y+112,186,116);
   rect(ctx,'#c6c4a1',x+139,y+119,172,2);rect(ctx,'#c6c4a1',x+139,y+218,172,2);rect(ctx,'#c6c4a1',x+139,y+119,2,101);rect(ctx,'#c6c4a1',x+309,y+119,2,101);rect(ctx,'#c6c4a1',x+224,y+119,2,101);
   ctx.strokeStyle='#c6c4a1';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+225,y+170,18,0,Math.PI*2);ctx.stroke();
   for(const xx of [139,275]){rect(ctx,'#a49273',x+xx,y+148,34,44);rect(ctx,'#c6c4a1',x+xx,y+148,34,2);rect(ctx,'#c6c4a1',x+xx,y+190,34,2)}
   rect(ctx,'#2a3b43',x+132,y+157,3,26);rect(ctx,'#ddd3ae',x+130,y+157,3,26);rect(ctx,'#b07555',x+135,y+168,4,5);rect(ctx,'#2a3b43',x+314,y+157,3,26);rect(ctx,'#ddd3ae',x+317,y+157,3,26);rect(ctx,'#b07555',x+310,y+168,4,5);
  }else if(x===0&&y>0){
   rect(ctx,'#4c6550',x+104,y+93,240,153);rect(ctx,'#7d8070',x+104,y+157,240,22);rect(ctx,'#7d8070',x+217,y+93,20,153);
   rect(ctx,'#283d3a',x+183,y+127,87,77);rect(ctx,'#a4a38e',x+179,y+123,87,77);rect(ctx,'#557d7b',x+185,y+129,75,65);rect(ctx,'#a3b7a4',x+214,y+149,17,25);
  }
  rect(ctx,'#666863',x+100,y+265,240,42);for(let k=0;k<7;k++){rect(ctx,'#a5a390',x+103+k*34,y+272,2,28);rect(ctx,'#a5a390',x+103+k*34,y+298,27,2)}
 }
 for(let x=0;x<width;x+=440){rect(ctx,'#9ba49c',x-85,0,170,height);rect(ctx,'#707f82',x-81,0,162,height);for(let y=0;y<height;y+=16){rect(ctx,'#90a09f',x-80,y,14,1);rect(ctx,'#90a09f',x+66,y,14,1)}rect(ctx,'#a2a08b',x-66,0,3,height);rect(ctx,'#242e3b',x-63,0,126,height);rect(ctx,'#b4aa7f',x+63,0,3,height);}
 for(let y=0;y<height;y+=340){rect(ctx,'#9ba49c',0,y-83,width,166);rect(ctx,'#707f82',0,y-79,width,158);for(let x=0;x<width;x+=16){rect(ctx,'#90a09f',x,y-78,1,13);rect(ctx,'#90a09f',x,y+65,1,13)}rect(ctx,'#a2a08b',0,y-65,width,3);rect(ctx,'#242e3b',0,y-62,width,124);rect(ctx,'#b4aa7f',0,y+62,width,3);}
 // Smooth asphalt fields; sparse longitudinal patches describe material, not noise.
 for(let x=0;x<width;x+=440)wash(ctx,'#273443',x-57,0,114,height,'#ffffff03','#0c1c3018');
 for(let y=0;y<height;y+=340)wash(ctx,'#273443',0,y-56,width,112,'#ffffff03','#0c1c3022');
 for(let x=0;x<width;x+=440)for(let y=0;y<height;y+=340){if(groundView&&(x+500<groundView.x||x-60>groundView.x+groundView.w||y+400<groundView.y||y-60>groundView.y+groundView.h))continue;
  // Cut all four curb bars out of the junction. Keep pedestrian corners intact.
  rect(ctx,'#273443',x-63,y-83,126,166);
  rect(ctx,'#273443',x-85,y-62,170,124);
  for(let k=-46;k<47;k+=14){rect(ctx,'#d6d7b8',x+k,y-61,8,12);rect(ctx,'#d6d7b8',x+k,y+49,8,12);rect(ctx,'#d6d7b8',x-61,y+k,12,8);rect(ctx,'#d6d7b8',x+49,y+k,12,8)}
  // Both lanes: the legacy traffic loops do not follow a universal handedness.
  rect(ctx,'#e1ddbd',x-57,y-84,114,3);rect(ctx,'#e1ddbd',x-57,y+81,114,3);
  rect(ctx,'#e1ddbd',x-84,y-57,3,114);rect(ctx,'#e1ddbd',x+81,y-57,3,114);
  rect(ctx,'#c8b674',x-2,y+112,2,90);rect(ctx,'#c8b674',x+2,y+112,2,90);
  for(let k=114;k<335;k+=48){rect(ctx,'#c8b674',x+k,y-2,26,2);rect(ctx,'#c8b674',x+k,y+2,26,2)}
  if(x>0&&y>0&&(x/440+y/340)%3===0){
   const name=regionAt(x+150,y+30)?districtName(x+150,y+30):{west:'WEST END',midtown:'MIDTOWN',south:'SOUTHSIDE',docks:'HARBOR WAY'}[districtStyle(x+150,y+30)];
   ctx.save();ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillStyle='#a7b3ae66';ctx.fillText(name,x+224,y+31);ctx.fillRect(x+165,y+37,118,1);ctx.restore();
  }
  // Drain grilles and brick pedestrian corners.
  for(const sx of [-1,1])for(const sy of [-1,1]){rect(ctx,'#252e32',x+sx*59-6,y+sy*112,12,7);for(let k=0;k<4;k++)rect(ctx,'#515b5e',x+sx*59-5+k*3,y+sy*112,1,6)}
  rect(ctx,'#263238',x+24,y+165,20,20);rect(ctx,'#53616a',x+26,y+167,16,16);for(let k=0;k<4;k++)rect(ctx,'#36434a',x+28+k*3,y+169,1,12);
  rect(ctx,'#263139',x-37,y+236,46,14);rect(ctx,'#41494a',x-35,y+238,40,10);rect(ctx,'#222b31',x-29,y+240,29,5);
  // Trees, planters, benches, bins, bollards: cosmetic and outside road lanes.
  if(['west','south'].includes(districtStyle(x+100,y+100)))for(const yy of [122,245]){rect(ctx,'#30383088',x+361,y+yy+5,29,25);rect(ctx,'#777160',x+360,y+yy+3,27,24);rect(ctx,'#433e32',x+371,y+yy+10,5,22);treeCrown(ctx,x+360,y+yy)}
  rect(ctx,'#242c31',x-78,y+157,10,20);rect(ctx,'#536960',x-77,y+155,9,16);rect(ctx,'#879787',x-78,y+154,11,3);
  furnishings(ctx,x,y);
  const cafe=cafes.has(x+':'+y);
  if(cafe)for(let i=0;i<2;i++){const tx=x+350,ty=y+163+i*52;oval(ctx,'#15253655',tx+6,ty+5,16,8);oval(ctx,'#29434a',tx,ty,13,8);oval(ctx,'#b99f79',tx,ty-2,12,7);rect(ctx,'#e7d3a6',tx-1,ty-6,3,3);for(const side of [-1,1]){rect(ctx,'#253940',tx+side*17-3,ty-5,6,10);rect(ctx,'#8d7760',tx+side*17-3,ty-7,6,3)}}
  if(x>0&&y>0&&(districtStyle(x+100,y+100)==='midtown'||districtStyle(x+100,y+100)==='docks')){palm(ctx,x+360,y+147);palm(ctx,x+360,y+246)}
  for(let k=0;k<3;k++)rect(ctx,'#9a8060',x-81,y+211+k*4,15,2);rect(ctx,'#303e3e',x-80,y+207,2,18);rect(ctx,'#303e3e',x-68,y+207,2,18);
 }
 // Direction arrows follow the actual authored traffic loops, not assumed lanes.
 for(const [ax,ay,angle] of [[660,322,0],[1100,322,0],[1302,510,Math.PI/2],[1100,1002,Math.PI],[660,1002,Math.PI],[422,850,-Math.PI/2],[1100,698,0],[1540,698,0],[1778,1190,Math.PI/2],[1540,1378,Math.PI],[1100,1378,Math.PI],[898,1190,-Math.PI/2]]){
  ctx.save();ctx.translate(ax,ay);ctx.rotate(angle);rect(ctx,'#bfc6b599',-12,-2,19,4);
  ctx.fillStyle='#bfc6b599';ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(3,-7);ctx.lineTo(3,7);ctx.closePath();ctx.fill();ctx.restore();
 }
}
let groundCache=null,cacheWidth=0,cacheHeight=0;
const litWindows=[];
// v0.57 (Claude): the ground is cached in 1320x1020 tiles (3x3 blocks), built lazily for what's on screen
// (a single world-sized canvas would exceed mobile canvas limits now that the city is 6600x5100).
const TILE_W=1320,TILE_H=1020,tiles=new Map();let tileBuilds=0;
function groundTile(tx,ty){const k=tx+','+ty;let t=tiles.get(k);if(t){tiles.delete(k);tiles.set(k,t);return t}
 const canvas=root.document?.createElement?.('canvas'),ctx=canvas?.getContext?.('2d');if(!ctx)return null;canvas.width=TILE_W;canvas.height=TILE_H;ctx.imageSmoothingEnabled=false;
 ctx.save();ctx.beginPath();ctx.rect(0,0,TILE_W,TILE_H);ctx.clip();ctx.translate(-tx*TILE_W,-ty*TILE_H);groundView={x:tx*TILE_W,y:ty*TILE_H,w:TILE_W,h:TILE_H};ground(ctx,world.w,world.h);groundView=null;ctx.restore();
 tiles.set(k,canvas);tileBuilds++;while(tiles.size>16)tiles.delete(tiles.keys().next().value);return canvas}
let groundView=null;
function road(){litWindows.length=0;
 const m=g.getTransform?.(),z=m&&m.a?m.a:1,vx=m?-m.e/z:0,vy=m?-m.f/(m.d||z):0,vw=(g.canvas?.width||W)/z,vh=(g.canvas?.height||H)/(m?.d||z);
 const tx0=Math.max(0,Math.floor(vx/TILE_W)),ty0=Math.max(0,Math.floor(vy/TILE_H)),tx1=Math.min(Math.ceil(world.w/TILE_W)-1,Math.floor((vx+vw)/TILE_W)),ty1=Math.min(Math.ceil(world.h/TILE_H)-1,Math.floor((vy+vh)/TILE_H));
 for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){const t=groundTile(tx,ty);if(t)g.drawImage(t,tx*TILE_W,ty*TILE_H)}
}
// Roof detail (art pass): deterministic per building; draws into the free strip at the roof's south edge (y+74..y+104,
// x+146..x+232), which is clear of every type's utilities. Night: skylights feed the lightmap, antennas blink red.
function roofBase(x,y,w,h){
 const top=y+8,bot=y+h-66;
 for(let yy=top+14;yy<bot;yy+=22)rect(g,'#0a182622',x+7,yy,w-14,1);
 let s=(x*73+y*151)>>>0;const rnd=()=>{s=(s*1103515245+12345)>>>0;return (s>>>8)/16777216};
 for(let i=0;i<34;i++){const px=x+8+rnd()*(w-16)|0,py=top+rnd()*(bot-top-2)|0;rect(g,i%3?'#ffffff0c':'#0a14201f',px,py,2,2)}
}
function roofTop(b,night,kind){
 const {x,y,w,h}=b,t=performance.now()/1000,seed=((x*31+y*17)>>>0)%97,rain=root.NightshiftEnvironment?.weather?.(root.NightshiftEnvironment.state?.minute??720)||0;
 if(rain>.25){g.fillStyle='#a9cfe02a';for(const [px,py,rw] of [[x+40,y+96,16],[x+92,y+99,11],[x+176,y+66,9]]){g.beginPath();g.ellipse(px,py,rw,3.5,0,0,Math.PI*2);g.fill()}}
 if(kind==='industrial'){
  for(const [k,cx] of [[0,x+163],[1,x+193]]){const cy=y+88;rect(g,'#10202c66',cx-9,cy-7,20,20);g.fillStyle='#6f8a8c';g.beginPath();g.arc(cx,cy,9,0,Math.PI*2);g.fill();g.fillStyle='#43595f';g.beginPath();g.arc(cx,cy,7,0,Math.PI*2);g.fill();
   g.strokeStyle='#a6bcb8';g.lineWidth=1.2;const a=t*(2.2+k*.7)+seed;for(let i=0;i<4;i++){const q=a+i*Math.PI/2;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(q)*6.5,cy+Math.sin(q)*6.5);g.stroke()}
   g.fillStyle='#c5d3cc';g.beginPath();g.arc(cx,cy,1.6,0,Math.PI*2);g.fill()}
 }else if(kind==='residential'){
  const tx=x+204,ty=y+88;rect(g,'#10202c66',tx-10,ty-4,26,16);rect(g,'#3a2f2a',tx-9,ty+4,2,8);rect(g,'#3a2f2a',tx+8,ty+4,2,8);
  g.fillStyle='#7b5f4a';g.beginPath();g.arc(tx,ty,11,0,Math.PI*2);g.fill();g.fillStyle='#a07c5f';g.beginPath();g.arc(tx,ty,8,0,Math.PI*2);g.fill();
  g.strokeStyle='#5c4636';g.lineWidth=1;g.beginPath();g.arc(tx,ty,5,0,Math.PI*2);g.stroke();rect(g,'#c9a27e',tx-1,ty-9,2,4);
  const dx=x+163,dy=y+86;rect(g,'#2a3843',dx-1,dy+2,3,8);g.fillStyle='#cfd6d6';g.beginPath();g.ellipse(dx,dy,7,5,-.5,0,Math.PI*2);g.fill();g.fillStyle='#9aa6a8';g.beginPath();g.ellipse(dx+1,dy+1,4,3,-.5,0,Math.PI*2);g.fill();rect(g,'#5c6a70',dx-5,dy-4,1,4);
 }else{
  if(b.name!=='CLUB'&&b.name!=='BANK'){const cx0=x+146,cy0=y+26;rect(g,'#0d1b2766',cx0+4,cy0+5,66,40);rect(g,'#8c9c98',cx0,cy0,64,38);rect(g,'#5e706f',cx0+2,cy0+2,60,34);rect(g,'#b7c4bc',cx0,cy0,64,2);
   for(const [k,fx] of [[0,cx0+16],[1,cx0+47]]){const fy=cy0+19;g.fillStyle='#22313a';g.beginPath();g.arc(fx,fy,12,0,Math.PI*2);g.fill();g.strokeStyle='#7f8f8b';g.lineWidth=1;g.beginPath();g.arc(fx,fy,12,0,Math.PI*2);g.stroke();
    g.fillStyle='#596b6c';const a=t*(5+k)+seed;for(let i=0;i<3;i++){const q=a+i*2.094;g.beginPath();g.moveTo(fx,fy);g.arc(fx,fy,10,q,q+.7);g.closePath();g.fill()}
    g.strokeStyle='#9aaaa544';for(const r of [5,9]){g.beginPath();g.arc(fx,fy,r,0,Math.PI*2);g.stroke()}g.fillStyle='#b8c6be';g.beginPath();g.arc(fx,fy,2,0,Math.PI*2);g.fill()}
   rect(g,'#33434a',cx0+64,cy0+12,10,4);rect(g,'#33434a',cx0+72,cy0+12,4,50)}
  const sx=x+150,sy=y+80,lit=night>.2&&seed%4!==0;rect(g,'#13232f',sx-2,sy-2,34,20);
  if(lit){rect(g,'#f3c77a',sx,sy,30,16);if(litWindows.length<120)litWindows.push({x:sx+15,y:sy+8,w:30,h:16,c:'#ffd38a'})}else rect(g,'#3f6e80',sx,sy,30,16);
  rect(g,lit?'#fff0c255':'#b8dce455',sx+2,sy+2,10,3);rect(g,'#1c3442',sx+14,sy,2,16);rect(g,'#1c3442',sx,sy+7,30,2);
  const hx=x+194,hy=y+83;rect(g,'#10202c66',hx+2,hy+3,15,15);rect(g,'#77857f',hx,hy,14,14);rect(g,'#4d5b59',hx+2,hy+2,10,10);rect(g,'#b5bfb4',hx+9,hy+6,2,3);
 }
 if(seed%3!==0){const ax=x+w-13,ay=y+14;rect(g,'#0f1c2866',ax-2,ay+26,7,4);rect(g,'#4a5560',ax,ay,2,28);rect(g,'#4a5560',ax-4,ay+8,10,1);rect(g,'#4a5560',ax-3,ay+15,8,1);
  const on=night>.2&&((t+seed*.13)%1.6)<.5;g.fillStyle=on?'#ff3b3b':'#6b2a2a';g.beginPath();g.arc(ax+1,ay,2.2,0,Math.PI*2);g.fill();
  if(on){g.save();g.globalCompositeOperation='lighter';const gr=g.createRadialGradient?g.createRadialGradient(ax+1,ay,0,ax+1,ay,12):null;if(gr){gr.addColorStop(0,'#ff3b3b88');gr.addColorStop(1,'#ff3b3b00');g.fillStyle=gr;g.beginPath();g.arc(ax+1,ay,12,0,Math.PI*2);g.fill()}g.restore()}}
}
// Bounded, deterministic animation: no timers, particles, gameplay state or new saves.
function ambient(ctx,b,time,night=0){
 const {x,y,w,h,name}=b,t=Number.isFinite(time)?time:0,seed=hash(x,y)%100;
 ctx.save();
 if(name==='APARTMENTS'){
  // Rooftop laundry catches a small neighborhood breeze.
  rect(ctx,'#243e46',x+51,y+26,2,28);rect(ctx,'#243e46',x+99,y+26,2,28);
  rect(ctx,'#c4bda3',x+51,y+28,50,1);
  for(let i=0;i<3;i++){const sway=Math.round(Math.sin(t*.8+seed+i)*2);rect(ctx,['#b4c5bf','#b87868','#d7bc88'][i],x+56+i*14+sway,y+29,10,14+i%2*4);rect(ctx,'#ffffff22',x+57+i*14+sway,y+30,2,11)}
 }else{
  // Vent fan animation stays inside the existing rooftop utility footprint.
  const fx=x+48,fy=y+36;rect(ctx,'#19313c',fx-9,fy-9,18,18);
  ctx.save();ctx.translate(fx,fy);ctx.rotate(t*1.8+seed);rect(ctx,'#93aaa5',-7,-2,14,4);rect(ctx,'#93aaa5',-2,-7,4,14);ctx.restore();rect(ctx,'#d8ceae',fx-2,fy-2,4,4);
 }
 if(['DINER','WAREHOUSE','GARAGE'].includes(name)){
  // Three recycled steam shapes; never allocate a growing particle collection.
  for(let i=0;i<3;i++){const life=((t*.28+i/3+seed/100)%1+1)%1;ctx.globalAlpha=(1-life)*.24;const sx=x+w-25+Math.sin(t+seed+i)*3+life*8,sy=y+16-life*30;rect(ctx,'#d8dfd4',sx,sy,7+life*9,4);rect(ctx,'#d8dfd4',sx-2,sy+3,6+life*7,3)}
  ctx.globalAlpha=1;
 }
 if(['CORNER SHOP','DINER','CLOTHING','CLUB'].includes(name)){
  // A slow reflection and shop-specific display movement behind the glass.
  const phase=(Math.sin(t*.45+seed)+1)/2;
  ctx.globalAlpha=.16;rect(ctx,'#c7eee4',x+17+phase*39,y+h-31,4,20);ctx.globalAlpha=1;
  if(name==='DINER'){rect(ctx,'#efcf99',x+23,y+h-19,10,5);rect(ctx,'#efcf99',x+34,y+h-18,3,3);rect(ctx,'#ffffff66',x+26,y+h-25-Math.round(phase*3),2,4)}
  if(name==='CLUB'&&night>.2)for(let i=0;i<5;i++)rect(ctx,['#dc85bf','#94cfc5'][i%2],x+19+i*10,y+h-9-Math.round(4+phase*8+(i%2)*4),5,4+Math.round(phase*8+(i%2)*4));
 }
 ctx.restore();
}
function building(b){
 if(typeof camera!=='undefined'&&(b.x+b.w+48<camera.x||b.y+b.h+48<camera.y||b.x>camera.x+W/camera.zoom||b.y>camera.y+H/camera.zoom))return;
 const {x,y,w,h,name}=b,night=root.NightshiftEnvironment?.darkness(root.NightshiftEnvironment.state?.minute??720)||0,district=districtStyle(x,y);
 const industrial=['WAREHOUSE','GARAGE'].includes(name),residential=name==='APARTMENTS',club=name==='CLUB',diner=name==='DINER',bank=name==='BANK',shop=['CORNER SHOP','CLOTHING','DINER'].includes(name);
 const materials={west:['#b98563','#465965','#d5b68c'],midtown:['#b8c7c6','#304957','#e3d2b2'],south:['#99624d','#393e4b','#c69871'],docks:['#779b99','#2c4654','#c8b89a']}[district];
 const face=club?'#62416c':diner?'#bd7459':industrial?'#54747a':materials[0],roof=club?'#302d4a':diner?'#667e83':materials[1],trim=materials[2],front=y+h-62;
 g.save();
 // One light direction, deeper south facade, and a restrained dark outline.
 g.fillStyle='#101b2c55';g.beginPath();g.moveTo(x+12,y+15);g.lineTo(x+w+28,y+27);g.lineTo(x+w+28,y+h+24);g.lineTo(x+19,y+h+24);g.closePath();g.fill();
 rect(g,'#172735',x-2,y-2,w+4,h+4);wash(g,face,x,y,w,h,'#ffffff12','#13263855');wash(g,roof,x+5,y+5,w-10,h-68,'#ffffff0d','#0e243a66');
 // Broad rooftop forms: raised stairwell and continuous skylight reflections.
 if(!industrial&&!residential&&!club){rect(g,'#14293666',x+w-75,y+19,57,46);wash(g,'#496978',x+w-80,y+13,57,46,'#dae4cc33','#102a3e66');rect(g,trim,x+w-80,y+13,57,3);rect(g,'#263e4a',x+w-75,y+21,47,28);wash(g,'#668997',x+w-73,y+23,43,24,'#c9e6dc44','#193b5266');rect(g,'#cedbd655',x+w-66,y+24,3,21);rect(g,'#abc8c333',x+w-48,y+24,9,21)}
 rect(g,'#ffffff18',x+6,y+6,w-12,3);rect(g,'#10253677',x+w-11,y+9,6,h-71);rect(g,trim,x,y,w,5);rect(g,'#d6d5bf44',x,y+5,5,h-66);
 try{roofBase(x,y,w,h)}catch{}
 if(industrial){
  for(let yy=y+10;yy<front-5;yy+=16){rect(g,'#a6bbb222',x+10,yy,w-20,1);rect(g,'#10273444',x+10,yy+3,w-20,1)}
  for(let k=0;k<3;k++){const xx=x+20+k*70;rect(g,'#172c3b',xx+4,y+26,47,27);rect(g,'#87aaa8',xx,y+20,47,27);rect(g,'#375b6b',xx+3,y+24,41,19);rect(g,'#b9d4c055',xx+5,y+25,12,16);rect(g,'#adc4b6',xx+20,y+23,2,20)}
 }else if(residential){
  // A rooftop terrace breaks the generic AC-box silhouette.
  rect(g,'#1c3442',x+18,y+18,121,58);rect(g,'#647b7c',x+21,y+21,115,52);
  for(let k=0;k<7;k++)rect(g,'#8fa2a055',x+25+k*16,y+25,1,43);
  for(const xx of [x+22,x+112]){rect(g,'#ad8d68',xx,y+27,18,28);rect(g,'#527b62',xx+2,y+26,14,16);rect(g,'#8ba375',xx+4,y+26,7,5)}
  for(let k=0;k<10;k++)rect(g,trim,x+19+k*13,y+74,2,11);rect(g,trim,x+18,y+73,122,2);
  rect(g,'#192d39',x+w-65,y+26,42,37);rect(g,'#9a8270',x+w-70,y+19,42,36);rect(g,'#cfb18b',x+w-67,y+21,36,3);for(let k=0;k<5;k++)rect(g,'#523e39',x+w-66,y+27+k*5,34,1);
 }else{
  // Smaller grouped utilities leave broad intentional roof shapes.
  for(let k=0;k<2;k++){const xx=x+31+k*52;rect(g,'#142b3866',xx+5,y+31,34,25);rect(g,'#7f9c9a',xx,y+24,34,25);rect(g,'#3b5966',xx+4,y+28,26,17);for(let r=0;r<4;r++)rect(g,'#a4b6ac',xx+7,y+30+r*4,20,1)}
  if(diner){rect(g,'#e2bc90',x+12,y+13,w-24,8);for(let k=0;k<12;k++)rect(g,k%2?'#b66155':'#ead5a7',x+15+k*18,y+13,15,5)}
  if(club){rect(g,'#1e263f',x+133,y+24,77,47);rect(g,'#8d649f',x+139,y+28,65,3);for(let k=0;k<4;k++)rect(g,'#5e4777',x+141+k*16,y+39,9,21)}
  if(bank){rect(g,'#97a8a4',x+141,y+21,68,50);rect(g,'#cfccb4',x+145,y+25,60,5);rect(g,'#496473',x+145,y+32,60,34)}
 }
 try{roofTop(b,night,industrial?'industrial':residential?'residential':'shop')}catch{}
 // Cornice and masonry establish a facade instead of a flat roof with a label.
 rect(g,'#162c3b',x,front-7,w,7);rect(g,trim,x-1,front-8,w+2,3);rect(g,'#ffffff24',x+1,front-5,w-2,1);
 for(let yy=front+3;yy<y+h-2;yy+=14){rect(g,'#16263812',x+4,yy,w-8,1);for(let xx=x+5+((yy/7|0)%2)*12;xx<x+w-4;xx+=25)rect(g,'#1428380b',xx,yy,1,7)}
 const window=(xx,yy,ww,hh)=>{if(night>.2&&litWindows.length<120&&((xx*7+yy*13)%5!==0))litWindows.push({x:xx+ww/2,y:yy+hh/2,w:ww,h:hh,c:club?'#ff7fd0':'#ffcf7a'});rect(g,'#19323f',xx-2,yy-2,ww+4,hh+5);wash(g,night>.2?(club?'#bf5da6':'#e4b877'):'#487888',xx,yy,ww,hh,'#ffffff22','#13304766');rect(g,night>.2?'#ffdc9644':'#b6d8cd44',xx+3,yy+2,ww-6,3);rect(g,'#254759',xx+ww/2-1,yy,2,hh);rect(g,trim,xx-3,yy+hh+1,ww+6,2)};
 if(residential){for(let k=0;k<5;k++)window(x+13+k*44,front+8,30,17);for(const xx of [x+14,x+w-53])window(xx,y+h-26,36,19)}
 else{window(x+13,y+h-34,62,26);window(x+w-75,y+h-34,62,26)}
 if(industrial){rect(g,'#1a3441',x+w/2-40,y+h-39,80,39);for(let r=0;r<8;r++)rect(g,r%2?'#78989a':'#57777f',x+w/2-36,y+h-36+r*4,72,3);for(let k=0;k<10;k++)rect(g,k%2?'#ddba77':'#243b46',x+w/2-42,y+h-44+k%2,8,4)}
 else{rect(g,'#1b3441',x+w/2-17,y+h-32,34,32);rect(g,'#548292',x+w/2-13,y+h-28,26,24);rect(g,'#b9dbcd55',x+w/2-10,y+h-26,3,17);rect(g,'#f1ce8b',x+w/2+9,y+h-17,2,5)}
 // Individual signs and awnings replace the repeated full-width dark box.
 const sign=night>.2?neonColor(name):club?'#d5acd9':trim,signY=residential?front+2:front+4;
 if(!residential){rect(g,club?'#292940':'#233e4c',x+13,signY,w-26,17);rect(g,sign,x+15,signY,w-30,2);g.fillStyle=sign;g.font='bold 11px monospace';g.textAlign='center';g.fillText(name,x+w/2,signY+12)}
 else{g.fillStyle=trim;g.font='bold 8px monospace';g.textAlign='center';g.fillText('APARTMENTS',x+w/2,y+h-6)}
 if(shop){const awning=diner?'#b95650':name==='CLOTHING'?'#518b84':'#5c91a7';rect(g,'#152f4066',x+7,y+h-39,w-14,9);for(let xx=x+8;xx<x+w-8;xx+=13)rect(g,(xx-x)%26<13?awning:'#e1d2a7',xx,y+h-40,13,6);
  for(const xx of [x+13,x+w-75])for(let k=0;k<5;k++){rect(g,['#d5ae71','#78b5a7','#c97d83'][k%3],xx+5+k*10,y+h-19,6,9);rect(g,'#d9d6ac',xx+3,y+h-10,54,2)}}
 if(district==='south'){rect(g,'#263e49',x+w-23,y+48,13,39);for(let k=0;k<6;k++)rect(g,'#a6a995',x+w-22,y+49+k*6,11,1)}
 // Reference-led frontage: fixtures and signs belong to architecture, not HUD labels.
 if(residential){
  for(let k=0;k<5;k++){const bx=x+9+k*44;rect(g,'#182d3b66',bx+3,front+28,39,8);rect(g,'#52616c',bx,front+26,39,4);rect(g,'#c4b698',bx,front+22,39,2);for(let i=0;i<6;i++)rect(g,'#aeb3a6',bx+2+i*7,front+22,1,7)}
 }else{
  for(const xx of [x+6,x+w-9]){rect(g,'#203542',xx,y+h-35,3,29);rect(g,'#f3c38b',xx-2,y+h-38,7,5);if(night>.2){rect(g,'#ffd29422',xx-8,y+h-42,19,14);rect(g,'#ffd29411',xx-13,y+h-46,29,23)}}
 }
 if(club){
  // Magenta edge tubes, a raised marquee and a crown echo the approved club scenes.
  const pink=night>.2?'#fb65cc':'#bf689d';
  for(const xx of [x+5,x+w-8]){rect(g,'#211c36',xx-2,front+1,7,58);rect(g,pink,xx,front+3,2,52);if(night>.2)rect(g,'#ef45bc22',xx-5,front,12,60)}
  rect(g,'#131e32',x+w-75,y+25,59,58);rect(g,'#7b4386',x+w-78,y+20,59,58);rect(g,'#201b36',x+w-75,y+23,53,51);
  rect(g,pink,x+w-73,y+25,49,2);rect(g,pink,x+w-73,y+71,49,2);
  g.strokeStyle=pink;g.lineWidth=2;g.beginPath();g.moveTo(x+w-64,y+43);g.lineTo(x+w-59,y+56);g.lineTo(x+w-50,y+39);g.lineTo(x+w-41,y+56);g.lineTo(x+w-34,y+43);g.lineTo(x+w-37,y+61);g.lineTo(x+w-61,y+61);g.closePath();g.stroke();
  rect(g,'#232238',x+w/2-29,y+h-39,58,6);rect(g,pink,x+w/2-29,y+h-39,58,2);
 }else if(name==='CORNER SHOP'){
  rect(g,'#203540',x+w-64,y+23,45,34);rect(g,'#9bb5b1',x+w-66,y+20,45,34);rect(g,'#233c49',x+w-63,y+23,39,27);g.font='bold 14px monospace';g.textAlign='center';g.fillStyle=night>.2?'#ff869e':'#d9c7a4';g.fillText('24/7',x+w-43,y+42);
 }else if(bank){
  for(const xx of [x+83,x+w-92]){rect(g,'#273d49',xx+2,front+23,10,37);rect(g,'#d8c7a5',xx,front+22,9,35);rect(g,'#f0dec0',xx-2,front+21,13,3);rect(g,'#978e7a',xx-2,y+h-5,13,4)}
 }
 rect(g,'#1a334066',x+3,y+h-1,w-6,5);rect(g,trim,x+w/2-23,y+h+1,46,3);rect(g,'#677f82',x+w/2-19,y+h+4,38,3);
 // Frontage fittings add readable larger shapes, rather than noisy speckles.
 if(shop){const bx=x+w-43,by=y+h+10;rect(g,'#152d3966',bx+4,by+5,25,25);wash(g,'#42695d',bx,by,24,22,'#a9cbbf33','#173c3455');oval(g,'#446e55',bx+12,by-1,13,7);oval(g,'#76966a',bx+9,by-4,8,4);rect(g,'#c3b58c',x+28,y+h+10,20,23);rect(g,'#253e48',x+31,y+h+12,14,16);g.fillStyle='#d8d0ac';g.font='7px system-ui';g.textAlign='center';g.fillText(name==='DINER'?'MENU':'OPEN',x+38,y+h+23)}
 ambient(g,b,(typeof ticks==='number'?ticks:0)/60,night);storefrontLight(b,night);g.restore();
}
root.NightshiftWorld={districtName,regionAt,tileStats:()=>({tiles:tiles.size,built:tileBuilds}),ambient,litWindows:()=>litWindows,createBuildings,road,building,ground,cafeActors,cafeCanopy,hash,districtStyle,neonColor,palmActors,palmCrown:(p)=>palmCrown(g,p.x,p.y),treeActors,treeCrown:(p)=>treeCrown(g,p.x,p.y-12),awningActors,awningTop,signActors,signTop};
})(globalThis);
