/* Pixel city art: cached ground, layered architecture, unchanged collision catalog. */
(function(root){'use strict';
const createBuildings=(width=2200,height=1700)=>NightshiftCityData.createBuildings(width,height);
const hash=(x,y)=>((Math.imul(x|0,73856093)^Math.imul(y|0,19349663))>>>0);
function rect(ctx,color,x,y,w,h){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function ground(ctx,width,height){
 rect(ctx,'#39413c',0,0,width,height);
 for(let x=0;x<width;x+=440)for(let y=0;y<height;y+=340){
  rect(ctx,'#5a5a50',x+82,y+80,276,180);rect(ctx,'#494e47',x+93,y+91,254,156);
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
 for(let x=0;x<width;x+=440){rect(ctx,'#8b8b7b',x-85,0,170,height);rect(ctx,'#676e69',x-81,0,162,height);for(let y=0;y<height;y+=16){rect(ctx,'#83877c',x-80,y,14,1);rect(ctx,'#83877c',x+66,y,14,1)}rect(ctx,'#a2a08b',x-66,0,3,height);rect(ctx,'#313b41',x-63,0,126,height);rect(ctx,'#b4aa7f',x+63,0,3,height);}
 for(let y=0;y<height;y+=340){rect(ctx,'#8b8b7b',0,y-83,width,166);rect(ctx,'#676e69',0,y-79,width,158);for(let x=0;x<width;x+=16){rect(ctx,'#83877c',x,y-78,1,13);rect(ctx,'#83877c',x,y+65,1,13)}rect(ctx,'#a2a08b',0,y-65,width,3);rect(ctx,'#313b41',0,y-62,width,124);rect(ctx,'#b4aa7f',0,y+62,width,3);}
 // Deterministic asphalt grain, patched seams and oil stains, generated once.
 for(let x=0;x<width;x+=13)for(let y=0;y<height;y+=13){const dx=Math.min(x%440,440-x%440),dy=Math.min(y%340,340-y%340),n=hash(x,y);if(dx<61||dy<61)rect(ctx,n%3?'#364047':'#29333a',x+n%5,y+(n>>>4)%5,n%4===0?4:2,1)}
 for(let x=0;x<width;x+=440)for(let y=0;y<height;y+=340){
  rect(ctx,'#313b41',x-63,y-63,126,126);
  for(let k=-49;k<50;k+=14){rect(ctx,'#c9c7af',x+k,y-79,8,13);rect(ctx,'#c9c7af',x+k,y+67,8,13);rect(ctx,'#c9c7af',x-79,y+k,13,8);rect(ctx,'#c9c7af',x+67,y+k,13,8)}
  rect(ctx,'#b8b8a2',x-53,y-101,106,3);rect(ctx,'#b8b8a2',x-53,y+98,106,3);
  rect(ctx,'#c8b674',x-2,y+112,2,90);rect(ctx,'#c8b674',x+2,y+112,2,90);
  for(let k=114;k<335;k+=48){rect(ctx,'#c8b674',x+k,y-2,26,2);rect(ctx,'#c8b674',x+k,y+2,26,2)}
  // Drain grilles and brick pedestrian corners.
  for(const sx of [-1,1])for(const sy of [-1,1]){rect(ctx,'#252e32',x+sx*59-6,y+sy*112,12,7);for(let k=0;k<4;k++)rect(ctx,'#515b5e',x+sx*59-5+k*3,y+sy*112,1,6)}
  rect(ctx,'#263238',x+24,y+165,20,20);rect(ctx,'#53616a',x+26,y+167,16,16);for(let k=0;k<4;k++)rect(ctx,'#36434a',x+28+k*3,y+169,1,12);
  rect(ctx,'#263139',x-37,y+236,46,14);rect(ctx,'#41494a',x-35,y+238,40,10);rect(ctx,'#222b31',x-29,y+240,29,5);
  // Trees, planters, benches, bins, bollards: cosmetic and outside road lanes.
  for(const yy of [122,245]){rect(ctx,'#30383088',x+87,y+yy+5,29,25);rect(ctx,'#777160',x+86,y+yy+3,27,24);rect(ctx,'#433e32',x+97,y+yy+10,5,22);rect(ctx,'#263e35',x+81,y+yy-12,37,31);rect(ctx,'#42604a',x+85,y+yy-16,28,26);rect(ctx,'#5f7654',x+88,y+yy-14,15,9);rect(ctx,'#344f3e',x+100,y+yy+1,15,10)}
  rect(ctx,'#242c31',x-78,y+157,10,20);rect(ctx,'#536960',x-77,y+155,9,16);rect(ctx,'#879787',x-78,y+154,11,3);
  for(let k=0;k<3;k++)rect(ctx,'#9a8060',x-81,y+211+k*4,15,2);rect(ctx,'#303e3e',x-80,y+207,2,18);rect(ctx,'#303e3e',x-68,y+207,2,18);
 }
}
let groundCache=null,cacheWidth=0,cacheHeight=0;
function road(){
 if(!groundCache||cacheWidth!==world.w||cacheHeight!==world.h){const canvas=root.document?.createElement?.('canvas');const ctx=canvas?.getContext?.('2d');if(ctx){canvas.width=world.w;canvas.height=world.h;ctx.imageSmoothingEnabled=false;ground(ctx,world.w,world.h);groundCache=canvas;cacheWidth=world.w;cacheHeight=world.h}}
 if(groundCache)g.drawImage(groundCache,0,0);else ground(g,world.w,world.h);
}
function building(b){
 if(typeof camera!=='undefined'&&(b.x+b.w+40<camera.x||b.y+b.h+40<camera.y||b.x>camera.x+W/camera.zoom||b.y>camera.y+H/camera.zoom))return;
 const x=b.x,y=b.y,w=b.w,h=b.h,night=root.NightshiftEnvironment?.darkness(root.NightshiftEnvironment.state?.minute??720)||0;
 const industrial=['WAREHOUSE','GARAGE'].includes(b.name),club=b.name==='CLUB',shop=['CORNER SHOP','CLOTHING','DINER'].includes(b.name);
 const facade=industrial?(b.x>=1320?'#6c7671':'#72695a'):shop?'#897764':club?'#605365':'#837b6c',roof=industrial?'#59615d':club?'#4d5260':'#626763';
 rect(g,'#0c182355',x+15,y+19,w+5,h+7);rect(g,'#292f33',x-2,y-2,w+4,h+4);
 // A raised roof and a 42px south-facing facade establish one consistent height.
 rect(g,facade,x,y,w,h);for(let yy=y+h-40;yy<y+h;yy+=6){rect(g,'#00000015',x,yy,w,1);for(let xx=x+((yy/6|0)%2)*14;xx<x+w;xx+=28)rect(g,'#00000015',xx,yy,1,6)}
 rect(g,roof,x+4,y+4,w-8,h-48);rect(g,'#a4a08a',x,y,w,4);rect(g,'#949384',x,y,4,h-43);rect(g,'#303e40',x+w-5,y+5,5,h-46);rect(g,'#b0ab92',x,y+h-45,w,4);rect(g,'#303a3b',x,y+h-41,w,5);
 for(let yy=y+12;yy<y+h-49;yy+=13)rect(g,'#ffffff07',x+8,yy,w-16,1);
 if(industrial){
  for(let yy=y+10;yy<y+h-48;yy+=9)rect(g,'#b3b4a622',x+9,yy,w-18,2);
  for(let i=0;i<3;i++){const xx=x+20+i*72;rect(g,'#35464a',xx+4,y+25,48,32);rect(g,'#bcc0ab',xx,y+21,48,31);rect(g,'#628089',xx+3,y+24,42,24);rect(g,'#b1c4bb',xx+7,y+27,13,18);rect(g,'#435f66',xx+23,y+24,3,24)}
 }else{
  const xx=x+(hash(x,y)%2?25:145);rect(g,'#323e40',xx+4,y+23,49,35);rect(g,'#9a9b8d',xx,y+18,49,35);rect(g,'#5f716e',xx+4,y+22,41,25);for(let k=0;k<5;k++)rect(g,'#3d5151',xx+7,y+25+k*4,35,2);
  rect(g,'#404947',x+98,y+56,52,45);rect(g,'#95988b',x+93,y+51,52,45);rect(g,'#666e65',x+98,y+56,42,35);rect(g,'#b5b2a0',x+98,y+56,42,3);
  if(b.name==='APARTMENTS'){g.fillStyle='#333d3b';g.beginPath();g.ellipse(x+w-36,y+32,21,14,0,0,Math.PI*2);g.fill();g.fillStyle='#928c73';g.beginPath();g.ellipse(x+w-38,y+26,19,13,0,0,Math.PI*2);g.fill();rect(g,'#675f4e',x+w-55,y+26,34,11);rect(g,'#b1a58b',x+w-50,y+21,23,3)}
  else{rect(g,'#353e40',x+w-39,y+70,20,25);rect(g,'#afb2a1',x+w-42,y+67,20,25);rect(g,'#657270',x+w-39,y+70,14,18)}
 }
 // Distinct roof silhouettes and readable landmark props without changing collision.
 const seed=hash(x+17,y+31),style=b.name==='DINER'?'diner':b.name==='CLUB'?'club':industrial?'industrial':b.name==='APARTMENTS'?'residential':'retail';
 if(style==='diner'){
  rect(g,'#b58a64',x+18,y+17,w-36,11);for(let i=0;i<Math.floor((w-40)/18);i++)rect(g,i%2?'#e8d1a2':'#a95c4d',x+20+i*18,y+17,15,7);
  rect(g,'#415f66',x+26,y+40,42,24);rect(g,'#c9c3a2',x+30,y+43,34,3);
 }else if(style==='club'){
  rect(g,'#292c42',x+22,y+18,w-44,12);rect(g,'#aa75a3',x+26,y+20,w-52,3);
  for(let i=0;i<6;i++)rect(g,i%2?'#d5a6b7':'#596282',x+30+i*16,y+29,10,5);
 }else if(style==='industrial'){
  for(let i=0;i<3;i++){const xx=x+18+i*67;rect(g,'#252f36',xx,y+h-82,42,5);rect(g,'#879b9a',xx+3,y+h-81,36,2)}
 }else if(style==='residential'){
  for(let i=0;i<4;i++){const xx=x+22+i*42;rect(g,'#394a4b',xx,y+14,28,22);rect(g,'#a0ada0',xx+2,y+16,24,3);rect(g,'#647f76',xx+4,y+22,20,10)}
 }else{
  for(let i=0;i<3;i++){const xx=x+24+i*52;rect(g,'#303d41',xx,y+14,32,22);rect(g,'#86998e',xx+3,y+17,26,15);rect(g,'#c0b99e',xx+6,y+20,10,2)}
 }
 // Vary roof wear in a deterministic pattern, avoiding frame-to-frame flicker.
 for(let i=0;i<12;i++){const n=hash(seed+i*71,i*37);const px=x+12+n%Math.max(1,w-24),py=y+11+(n>>>8)%Math.max(1,h-72);rect(g,'#111d2515',px,py,4+(n%7),2)}
 // Front windows and accessible door stay entirely within the old footprint.
 for(const xx of [x+14,x+w-68]){if(night>.2)rect(g,'#e3bc6922',xx-4,y+h-35,62,33);rect(g,'#283a43',xx,y+h-31,54,25);rect(g,night>.2?'#bca46c':'#637e87',xx+3,y+h-28,48,19);rect(g,'#2d4247',xx+26,y+h-30,3,22);rect(g,'#a8a394',xx-2,y+h-5,58,4)}
 if(industrial){rect(g,'#343e43',x+w/2-37,y+h-31,74,31);for(let yy=0;yy<26;yy+=4)rect(g,'#7b827b',x+w/2-34,y+h-29+yy,68,2)}
 else{rect(g,'#243840',x+w/2-17,y+h-29,34,29);rect(g,'#63808a',x+w/2-13,y+h-26,25,19);rect(g,'#dcc89e',x+w/2+8,y+h-15,2,5)}
 const sign=club?'#d291b8':b.name==='DINER'?'#d7ae70':b.name==='CLOTHING'?'#9fb5a3':'#c1c0a6';
 rect(g,'#1b3038',x+12,y+h-64,w-24,19);rect(g,sign,x+14,y+h-64,w-28,2);g.fillStyle=sign;g.font='bold 11px monospace';g.textAlign='center';g.fillText(b.name,x+w/2,y+h-50);
 if(shop){
  for(const xx of [x+14,x+w-68]){
   rect(g,'#182a2f88',xx+3,y+h-27,48,19);
   if(b.name==='CLOTHING'){for(let k=0;k<2;k++){const sx=xx+13+k*24;rect(g,'#b6b5a2',sx,y+h-24,3,15);rect(g,k?'#c09885':'#8ba49c',sx-4,y+h-22,11,8);rect(g,'#485960',sx-2,y+h-14,7,5)}}
   else if(b.name==='DINER'){rect(g,'#8d5b50',xx+6,y+h-17,13,7);rect(g,'#8d5b50',xx+31,y+h-17,13,7);rect(g,'#d6bf93',xx+19,y+h-22,11,3);rect(g,'#66706a',xx+24,y+h-19,2,9)}
   else{for(let shelf=0;shelf<2;shelf++){for(let item=0;item<6;item++)rect(g,['#ccaa6c','#ad7370','#90aa87'][item%3],xx+7+item*7,y+h-24+shelf*9,4,5);rect(g,'#c7bea3',xx+5,y+h-18+shelf*9,44,2)}}
   rect(g,'#bbcbb133',xx+5,y+h-27,2,18);
  }
  rect(g,'#343d3d',x+w/2-24,y+h-1,48,3);rect(g,'#8b8978',x+w/2-23,y+h+2,46,3);rect(g,'#615f52',x+w/2-19,y+h+5,38,3);
  for(let xx=x+9;xx<x+w-9;xx+=14)rect(g,(xx-x)%28<14?'#b89873':'#d3c4a0',xx,y+h-38,14,7);rect(g,'#30363366',x+10,y+h-31,w-20,4)}
}
root.NightshiftWorld={createBuildings,road,building,ground,hash};
})(globalThis);
