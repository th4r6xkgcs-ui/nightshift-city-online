/* Pixel city art: cached ground, layered architecture, unchanged collision catalog. */
(function(root){'use strict';
const createBuildings=(width=2200,height=1700)=>NightshiftCityData.createBuildings(width,height);
const hash=(x,y)=>((Math.imul(x|0,73856093)^Math.imul(y|0,19349663))>>>0);
function rect(ctx,color,x,y,w,h){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
const palettes=Object.freeze({west:Object.freeze({yard:'#596650',edge:'#8f8974',facade:'#967b63',roof:'#6c7062',accent:'#c1a479'}),midtown:Object.freeze({yard:'#566264',edge:'#9caaa5',facade:'#879698',roof:'#657580',accent:'#b3d2ce'}),south:Object.freeze({yard:'#61584c',edge:'#817565',facade:'#886655',roof:'#655c51',accent:'#b69c70'}),docks:Object.freeze({yard:'#53605d',edge:'#84938b',facade:'#6a7d78',roof:'#536967',accent:'#d0b76b'})});
function districtStyle(x,y){return y>=1020?(x>=1320?'docks':'south'):(x>=880?'midtown':'west')}
function palm(ctx,x,y){
 // Cutout fronds, a bent trunk and a consistent cast shadow; cached with paving.
 rect(ctx,'#101c2d44',x+3,y+5,32,8);rect(ctx,'#283d3766',x+20,y-10,16,23);
 for(let k=0;k<7;k++){rect(ctx,k%2?'#8f7857':'#b29768',x-2+(k>3?1:0),y-k*4,5,5);rect(ctx,'#554e3f',x+2,y-k*4,2,4)}
 const cy=y-28;
 for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]])for(let k=0;k<5;k++){
  rect(ctx,k<2?'#669278':'#356e65',x+dx*(3+k*4)-3,cy+dy*(k*2)-3,8-k,5);
  rect(ctx,'#244b4f',x+dx*(5+k*4)-2,cy+dy*(k*2)+2,5,2);
 }
 rect(ctx,'#9bb080',x-3,cy-4,7,5);rect(ctx,'#244b48',x-1,cy+1,5,4);
}
function palmCrown(ctx,x,y){
 const cy=y-28;
 for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]])for(let k=0;k<5;k++){
  rect(ctx,k<2?'#669278':'#356e65',x+dx*(3+k*4)-3,cy+dy*(k*2)-3,8-k,5);
  rect(ctx,'#244b4f',x+dx*(5+k*4)-2,cy+dy*(k*2)+2,5,2);
 }
 rect(ctx,'#9bb080',x-3,cy-4,7,5);rect(ctx,'#244b48',x-1,cy+1,5,4);
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
 // Same fixed street tree canopy as the ground cache; foreground redraw
 // hides walkers passing north of the tree without altering navigation.
 rect(ctx,'#244c49',x-5,y-16,37,31);
 rect(ctx,'#3f7565',x-1,y-20,28,26);
 rect(ctx,'#83a67b',x+2,y-18,15,9);
 rect(ctx,'#344f3e',x+14,y-3,15,10);
}
function treeActors(view){
 const entries=[],margin=65;
 if(!view||!Number.isFinite(view.x)||!Number.isFinite(view.y)||!Number.isFinite(view.zoom)||view.zoom<=0||!Number.isFinite(view.width)||!Number.isFinite(view.height))return entries;
 const right=view.x+view.width/view.zoom+margin,bottom=view.y+view.height/view.zoom+margin;
 for(let x=0;x<world.w;x+=440)for(let y=0;y<world.h;y+=340){
  for(const yy of [122,245]){
   const px=x+86,py=y+yy+12;
   if(px>=view.x-margin&&px<=right&&py>=view.y-margin&&py<=bottom)entries.push({kind:'tree-crown',entity:{x:px,y:py}});
  }
 }
 return entries;
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
function ground(ctx,width,height){
 rect(ctx,'#344d4b',0,0,width,height);
 for(let x=0;x<width;x+=440)for(let y=0;y<height;y+=340){
  const palette=palettes[districtStyle(x+100,y+100)];rect(ctx,palette.edge,x+82,y+80,276,180);rect(ctx,palette.yard,x+93,y+91,254,156);
  for(let i=0;i<38;i++){const n=hash(x+i*37,y+i*19);rect(ctx,i%3?'#52564c':'#63624f',x+92+n%260,y+87+(n>>>9)%160,2,2)}
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
 // Deterministic asphalt grain, patched seams and oil stains, generated once.
 for(let x=0;x<width;x+=13)for(let y=0;y<height;y+=13){const dx=Math.min(x%440,440-x%440),dy=Math.min(y%340,340-y%340),n=hash(x,y);if(dx<61||dy<61)rect(ctx,n%3?'#2b3542':'#1f2935',x+n%5,y+(n>>>4)%5,n%4===0?4:2,1)}
 for(let x=0;x<width;x+=440)for(let y=0;y<height;y+=340){
  rect(ctx,'#242e3b',x-63,y-63,126,126);
  for(let k=-49;k<50;k+=14){rect(ctx,'#d6d7b8',x+k,y-79,8,13);rect(ctx,'#d6d7b8',x+k,y+67,8,13);rect(ctx,'#d6d7b8',x-79,y+k,13,8);rect(ctx,'#d6d7b8',x+67,y+k,13,8)}
  rect(ctx,'#b8b8a2',x-53,y-101,106,3);rect(ctx,'#b8b8a2',x-53,y+98,106,3);
  rect(ctx,'#c8b674',x-2,y+112,2,90);rect(ctx,'#c8b674',x+2,y+112,2,90);
  for(let k=114;k<335;k+=48){rect(ctx,'#c8b674',x+k,y-2,26,2);rect(ctx,'#c8b674',x+k,y+2,26,2)}
  if(x>0&&y>0&&(x/440+y/340)%3===0){
   const name={west:'WEST END',midtown:'MIDTOWN',south:'SOUTHSIDE',docks:'HARBOR WAY'}[districtStyle(x+150,y+30)];
   ctx.save();ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillStyle='#a7b3ae66';ctx.fillText(name,x+224,y+31);ctx.fillRect(x+165,y+37,118,1);ctx.restore();
  }
  // Drain grilles and brick pedestrian corners.
  for(const sx of [-1,1])for(const sy of [-1,1]){rect(ctx,'#252e32',x+sx*59-6,y+sy*112,12,7);for(let k=0;k<4;k++)rect(ctx,'#515b5e',x+sx*59-5+k*3,y+sy*112,1,6)}
  rect(ctx,'#263238',x+24,y+165,20,20);rect(ctx,'#53616a',x+26,y+167,16,16);for(let k=0;k<4;k++)rect(ctx,'#36434a',x+28+k*3,y+169,1,12);
  rect(ctx,'#263139',x-37,y+236,46,14);rect(ctx,'#41494a',x-35,y+238,40,10);rect(ctx,'#222b31',x-29,y+240,29,5);
  // Trees, planters, benches, bins, bollards: cosmetic and outside road lanes.
  for(const yy of [122,245]){rect(ctx,'#30383088',x+87,y+yy+5,29,25);rect(ctx,'#777160',x+86,y+yy+3,27,24);rect(ctx,'#433e32',x+97,y+yy+10,5,22);rect(ctx,'#244c49',x+81,y+yy-12,37,31);rect(ctx,'#3f7565',x+85,y+yy-16,28,26);rect(ctx,'#83a67b',x+88,y+yy-14,15,9);rect(ctx,'#344f3e',x+100,y+yy+1,15,10)}
  rect(ctx,'#242c31',x-78,y+157,10,20);rect(ctx,'#536960',x-77,y+155,9,16);rect(ctx,'#879787',x-78,y+154,11,3);
  furnishings(ctx,x,y);
  if(x>0&&y>0&&(districtStyle(x+100,y+100)==='midtown'||districtStyle(x+100,y+100)==='docks')){palm(ctx,x+360,y+147);palm(ctx,x+360,y+246)}
  for(let k=0;k<3;k++)rect(ctx,'#9a8060',x-81,y+211+k*4,15,2);rect(ctx,'#303e3e',x-80,y+207,2,18);rect(ctx,'#303e3e',x-68,y+207,2,18);
 }
}
let groundCache=null,cacheWidth=0,cacheHeight=0;
function road(){
 if(!groundCache||cacheWidth!==world.w||cacheHeight!==world.h){const canvas=root.document?.createElement?.('canvas');const ctx=canvas?.getContext?.('2d');if(ctx){canvas.width=world.w;canvas.height=world.h;ctx.imageSmoothingEnabled=false;ground(ctx,world.w,world.h);groundCache=canvas;cacheWidth=world.w;cacheHeight=world.h}}
 if(groundCache)g.drawImage(groundCache,0,0);else ground(g,world.w,world.h);
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
 rect(g,'#172735',x-2,y-2,w+4,h+4);rect(g,face,x,y,w,h);rect(g,roof,x+5,y+5,w-10,h-68);
 rect(g,'#ffffff18',x+6,y+6,w-12,3);rect(g,'#10253677',x+w-11,y+9,6,h-71);rect(g,trim,x,y,w,5);rect(g,'#d6d5bf44',x,y+5,5,h-66);
 // Roof grain is quiet; highlights belong to the street-facing shopfront.
 for(let k=0;k<22;k++){const n=hash(x+k*29,y+k*17);rect(g,'#ccd5cc0d',x+13+n%(w-27),y+15+(n>>>8)%(h-90),3+n%10,1)}
 if(industrial){
  for(let yy=y+10;yy<front-5;yy+=8){rect(g,'#a6bbb222',x+10,yy,w-20,1);rect(g,'#10273444',x+10,yy+3,w-20,1)}
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
 // Cornice and masonry establish a facade instead of a flat roof with a label.
 rect(g,'#162c3b',x,front-7,w,7);rect(g,trim,x-1,front-8,w+2,3);rect(g,'#ffffff24',x+1,front-5,w-2,1);
 for(let yy=front+3;yy<y+h-2;yy+=7){rect(g,'#16263828',x+4,yy,w-8,1);for(let xx=x+5+((yy/7|0)%2)*12;xx<x+w-4;xx+=25)rect(g,'#14283822',xx,yy,1,7)}
 const window=(xx,yy,ww,hh)=>{rect(g,'#19323f',xx-2,yy-2,ww+4,hh+5);rect(g,night>.2?(club?'#bf5da6':'#e4b877'):'#487888',xx,yy,ww,hh);rect(g,night>.2?'#ffdc9644':'#b6d8cd44',xx+3,yy+2,ww-6,3);rect(g,'#254759',xx+ww/2-1,yy,2,hh);rect(g,trim,xx-3,yy+hh+1,ww+6,2)};
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
 storefrontLight(b,night);g.restore();
}
root.NightshiftWorld={createBuildings,road,building,ground,hash,districtStyle,neonColor,palmActors,palmCrown:(p)=>palmCrown(g,p.x,p.y),treeActors,treeCrown:(p)=>treeCrown(g,p.x,p.y-12),awningActors,awningTop};
})(globalThis);
