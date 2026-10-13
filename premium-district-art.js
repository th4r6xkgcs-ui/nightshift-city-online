/* Cached storefront depth and neighborhood construction detail. Interaction entrances stay visible. */
(function(r){'use strict';const World=r.NightshiftWorld;if(!World)return;const cache=new Map(),limit=24,counts={hits:0,misses:0};
const R=(c,h,x,y,w,v)=>{c.fillStyle=h;c.fillRect(x,y,w,v)},line=(c,h,x,y,xx,yy,w=.5)=>{c.strokeStyle=h;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke()};
function panel(b){const night=(r.NightshiftEnvironment?.darkness?.(r.NightshiftEnvironment?.state?.minute??720)||0)>.35,district=World.districtStyle(b.x,b.y),key=[b.name,b.w,district,night].join('|');if(cache.has(key)){counts.hits++;const v=cache.get(key);cache.delete(key);cache.set(key,v);return v}counts.misses++;
 const cv=document.createElement('canvas');cv.width=(b.w+24)*2;cv.height=96*2;const c=cv.getContext('2d');c.scale(2,2);const x=12,w=b.w,base=82,front=20,shop=['CORNER SHOP','CLOTHING','DINER','CLUB'].includes(b.name),brick=district==='south'?'#c09171':district==='west'?'#c9b099':'#b2c5c7';
 // Recessed corners, mortar bonds and cornice brackets give the facade a construction rhythm.
 for(const xx of [x+3,x+w-6]){R(c,'#192634',xx,front,2,61);R(c,brick,xx-.5,front,.5,61);for(let yy=front+4;yy<base;yy+=7){R(c,'#25313c',xx-1,yy,4,.5);R(c,'#ebdcc422',xx-1,yy+1,4,.5)}}
 for(let xx=x+14;xx<x+w-8;xx+=38){R(c,'#172938',xx,front-8,4,5);R(c,brick,xx-1,front-9,6,.75)}
 for(let yy=front+2;yy<base-1;yy+=6)for(let xx=x+8+((yy/6|0)%2)*9;xx<x+w-8;xx+=19){R(c,'#192c3433',xx,yy,17,.5);R(c,'#e0cfb122',xx,yy+1,11,.5)}
 const room=(xx,ww)=>{const yy=base-33,hh=25;R(c,'#13232e',xx-1,yy-1,ww+2,hh+3);R(c,night?'#4a4437':'#223443',xx,yy,ww,hh);R(c,'#dbba83',xx+1,yy+1,ww-2,1);R(c,'#426274',xx+1,yy+2,ww-2,3);
 if(b.name==='CORNER SHOP'){for(let shelf=0;shelf<3;shelf++){const sy=yy+7+shelf*6;R(c,'#6b5541',xx+2,sy+4,ww-4,1);for(let j=0;j<Math.floor((ww-6)/5);j++){R(c,['#ce9864','#9ab36b','#9ca9c4'][j%3],xx+3+j*5,sy,2.5,4);R(c,'#efddb5',xx+3+j*5,sy,2.5,.5)}}}
 else if(b.name==='CLOTHING'){for(let i=0;i<3;i++){const px=xx+ww*(i+1)/4;line(c,'#b4b1a0',px,yy+5,px,yy+20,.5);R(c,['#bb7373','#9bc1c4','#dcbb7e'][i],px-3,yy+9,6,8);line(c,'#d6ceb4',px-4,yy+7,px+4,yy+7,.5)}}
 else if(b.name==='DINER'){R(c,'#70433a',xx+3,yy+13,ww-6,7);R(c,'#b56751',xx+3,yy+12,ww-6,2);for(let i=0;i<3;i++){const px=xx+8+i*(ww-13)/3;R(c,'#d5c4a3',px,yy+14,7,1);R(c,'#23323e',px+3,yy+15,1,7);R(c,'#eee0c4',px+1,yy+12,1.5,2)}}
 else if(b.name==='CLUB'){for(let i=0;i<7;i++)R(c,['#755984','#a35c8c','#487a86'][i%3],xx+3+i*(ww-7)/7,yy+9+i%3,3,12-i%3);R(c,'#db93b6',xx+2,yy+3,ww-4,.75)}
 else{R(c,'#b7a47e',xx+4,yy+7,ww-8,1);R(c,'#4e655a',xx+6,yy+11,ww/3,8);R(c,'#927959',xx+ww/2,yy+9,ww/3,11)}
 // Window jamb, crossbar, tiny handles and soft reflected panes.
 R(c,'#9eb7ba',xx-.5,yy,1,hh);R(c,'#172c3c',xx+ww/2-.7,yy,1.4,hh);R(c,'#d1c8ae',xx-2,yy+hh+1,ww+4,1);line(c,'#c4d4cf55',xx+4,yy+4,xx+9,yy+15,1);R(c,'#dbc8a5',xx+ww/2+1,yy+hh-5,.75,2.5)};
 if(b.name==='APARTMENTS'){for(let k=0;k<5&&13+k*44+30<w;k++){const xx=x+13+k*44;R(c,'#182c39',xx,front+8,30,17);R(c,night?'#c3a477':'#526879',xx+1,front+9,28,15);R(c,'#9ba898',xx+2,front+10,8,13);R(c,'#5c777e',xx+19,front+10,8,13);R(c,'#dcc08f',xx+2,front+12,5,1);R(c,'#182c39',xx+14,front+8,2,17);R(c,'#c1b092',xx-2,front+26,34,1);for(let bx=xx-1;bx<xx+32;bx+=5)R(c,'#303f49',bx,front+27,.65,5);R(c,'#415660',xx-2,front+26,34,.5)}}
 else if(!['WAREHOUSE','GARAGE'].includes(b.name)){room(x+13,62);room(x+w-75,62)}
 else{const xx=x+w/2-40;for(let yy=base-37;yy<base-1;yy+=4){R(c,'#bdd0c144',xx+5,yy,69,.5);R(c,'#233942',xx+4,yy+3,71,.5)}R(c,'#c5b79e',xx+65,base-14,2.5,5);for(let i=0;i<3;i++){R(c,'#ae8156',x+16+i*9,base-20+i*2,7,12-i*2);R(c,'#d8b183',x+16+i*9,base-20+i*2,7,.75)}}
 // Preserve the doorway center; add a recessed threshold, address tile and exterior wiring.
 const mid=x+w/2;R(c,'#132631',mid-18,base+1,36,3);R(c,'#c3aa81',mid-20,base+3,40,.75);R(c,'#365461',mid+24,base-25,9,7);R(c,'#d4c4a0',mid+26,base-23,5,1);R(c,'#d4c4a0',mid+26,base-20,3,.7);
 if(shop){line(c,'#20303b',x+8,front+5,x+w-8,front+8,.65);for(let i=0;i<3;i++)R(c,'#cfb78a',x+28+i*(w-56)/2,front+7+i%2,1.5,2.5)}
 cache.set(key,cv);if(cache.size>limit)cache.delete(cache.keys().next().value);return cv;
}
const original=World.building;World.building=function(b){const result=original.apply(this,arguments);try{if(typeof camera!=='undefined'&&(b.x+b.w+40<camera.x||b.y+b.h+40<camera.y||b.x>camera.x+W/camera.zoom||b.y>camera.y+H/camera.zoom))return result;const cv=panel(b),prev=g.imageSmoothingEnabled;g.imageSmoothingEnabled=false;g.drawImage(cv,b.x-12,b.y+b.h-82,b.w+24,96);g.imageSmoothingEnabled=prev;if(['CORNER SHOP','CLOTHING','DINER','CLUB'].includes(b.name)){const phase=(Math.sin(performance.now()/1800+b.x*.01)+1)/2;g.save();g.globalAlpha=.14;R(g,'#d8e4d7',b.x+18+Math.round(phase*42),b.y+b.h-29,2,19);g.restore()}}catch(e){console.error(e)}return result};
r.NightshiftPremiumDistrict=Object.freeze({panel,stats:()=>({...counts,count:cache.size,limit,bytes:[...cache.values()].reduce((n,c)=>n+c.width*c.height*4,0)})});
})(globalThis);
