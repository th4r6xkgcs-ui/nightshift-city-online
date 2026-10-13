/* Codex finishing pass. Uses Claude's anatomy, item definitions and ownership without a second save system. */
(function(root){'use strict';
const C=root.NightshiftCharacters,W=root.NightshiftWardrobeData,S=root.NightshiftSprites;if(!C||!W||!S)return;
const density=4,limit=128,cache=new Map(),counts={hits:0,misses:0},originalFrame=C.frame,compose=C.compose;
const shade=(h,n)=>{const v=parseInt(h.slice(1),16);return '#'+[v>>16&255,v>>8&255,v&255].map(x=>Math.max(0,Math.min(255,Math.round(x+n))).toString(16).padStart(2,'0')).join('')};
const color=p=>p?(W.ITEM[p.id]?.colors[p.color]||W.ITEM[p.id]?.colors[0]||'#85858a'):'#85858a';
function finish(c,o,d,a,f,hold){
 const q=C.geom(o,d,a,f,hold),p=o.outer||o.top,col=color(p),hi=shade(col,35),dk=shade(col,-25),sway=['walk','run','sneak'].includes(a)?Math.cos(f*Math.PI/4)*.75:0;
 const line=(h,x,y,xx,yy,w=.25)=>{c.strokeStyle=h;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke()};
 const dot=(h,x,y,w=.25,v=.25)=>{c.fillStyle=h;c.fillRect(Math.round(x*4)/4,Math.round(y*4)/4,w,v)};
 if(p&&(!o.bag||q.profile)){
  const l=q.cx-q.SW*.35,r=q.cx+q.SW*.35,t=q.shY+3,b=q.waY-1;
  line(hi,l,t,l+.65,b);line(dk,r,t,r-.65,b);
  // Broad folds describe volume; sparse highlights keep the cloth readable at city zoom.
  for(const s of [-1,1]){const x=q.cx+s*q.SW*.25;line(dk,x,t+2,x+s*.8,t+5+s*sway,.65);line(hi,x-s*.4,t+2,x+s*.3,t+4+s*sway,.35);line(dk,x,b-2,x-s*1.2,b-1+s*sway,.5)}
  if(o.outer&&!q.back&&!o.outer.open&&['leather','puffer','track','bomber'].includes(o.outer.id)){const z=q.cx+q.sx*.6;line('#b5b4ac',z,t,z,b);for(let yy=t+.5;yy<b;yy+=.75)dot('#e7d6b7',z-.3,yy);dot('#e7d6b7',z-.4,b-1,.75,.75);for(const s of [-1,1]){const x=q.cx+s*q.SW*.22;line(dk,x,t+5,x+s*1.35,t+4.2);line(hi,x,t+4.7,x+s*1.35,t+3.9)}}
  if(o.outer&&!q.back&&['denim','varsity','trench'].includes(p.id)){for(let yy=t+1;yy<b;yy+=2)dot(p.id==='denim'?'#c9a575':'#d7c7a1',q.cx+.3,yy,.55,.55)}
  if(o.outer?.open&&!q.back){line(hi,l+.8,t,q.cx-1.8,b);line(dk,r-.8,t,q.cx+1.8,b)}
  if(['denim','varsity','leather','bomber'].includes(p.id))for(let x=l+.7;x<r-.4;x+=.8)dot(hi,x,b-.15,.35,.25);
  if(p.id==='puffer')for(let yy=t+1;yy<b;yy+=2){line(dk,l+.5,yy,r-.5,yy);line(hi,l+.6,yy+.4,r-.8,yy+.4)}
 }
 for(const A of q.arms){if(o.outer||p&&['longsleeve','buttonup'].includes(p.id)&&!p.rolled){const ex=A.x+(A.hx-A.x)*.68,ey=A.y+(A.hy-A.y)*.68;line(hi,A.x-.7,A.y+1,ex-.6,ey,.45);line(dk,ex+.7,ey,A.hx+.7,A.hy-1,.5);line(hi,A.hx-1,A.hy-1.9,A.hx+.7,A.hy-1.7,.35);line(dk,ex-.8,ey+A.s*sway,ex+.8,ey+.3+A.s*sway,.35)}}
 for(const L of q.legs){const bx=color(o.bottom),bh=shade(bx,30),bd=shade(bx,-22),kx=L.kx??(L.hx+L.fx)/2,ky=L.ky??(L.hy+L.fy)/2;
  if(!['shorts','skirt'].includes(o.bottom?.id)){line(bh,L.hx-.9,L.hy+2,kx-.8,ky);line(bd,kx+.7,ky,L.fx+.7,L.fy-2.1);line(bh,kx-1,ky+.3,kx+.4,ky+.65);if(o.bottom?.id==='cargo'){dot(bd,kx-.9,ky-2.4,1.7,1.5);line(bh,kx-.9,ky-2.4,kx+.8,ky-2.4);dot('#aaa798',kx+.3,ky-2.05)}}
  const sh=color(o.shoes);line(shade(sh,55),L.fx-1.5,L.fy+.5,L.fx+1.35,L.fy+.5,.4);if(!q.back&&o.shoes?.id!=='slides')for(let i=0;i<3;i++)line('#dedad2',L.fx-.7,L.fy-1.8+i*.45,L.fx+.55,L.fy-1.55+i*.45);dot(shade(sh,70),L.fx-1.1,L.fy-.5,.55,.35);
 }
 if(!o.head&&!o.outer?.hood&&o.hair!=='bald'){const hc=W.HAIR_COLORS[o.hairColor];for(let i=0;i<5;i++){const x=q.headX-2.4+i*.95,y=q.headY-4.4+(i%2)*.45;line(shade(hc,28),x,y,x+.4,y+.8)}}
}
function frame(outfit,dir,anim,f,scale=2,hold=''){
 const o=W.cleanOutfit(outfit),d=((Math.round(dir||0)%8)+8)%8,a=C.ANIMS[anim]?anim:'idle',n=C.ANIMS[a],k=((Math.floor(Number.isFinite(f)?f:0)%n)+n)%n,key=W.keyOf(o)+'|'+d+'|'+a+'|'+k+'|'+hold+'|'+(scale===6?6:density);
 if(cache.has(key)){const cv=cache.get(key);cache.delete(key);cache.set(key,cv);counts.hits++;return cv}counts.misses++;
 const cv=document.createElement('canvas');const native=scale===6?6:density;cv.width=C.CELL.w*native;cv.height=C.CELL.h*native;
 const c=cv.getContext('2d');c.scale(native,native);c.translate(C.CELL.ax,C.CELL.ay);c.lineCap='round';compose(c,o,d,a,k,hold);
 const silhouette=c.getImageData(0,0,cv.width,cv.height);finish(c,o,d,a,k,hold);
 const img=c.getImageData(0,0,cv.width,cv.height),px=img.data,mask=silhouette.data;
 for(let i=0;i<px.length;i+=4){if(mask[i+3]<128){px[i+3]=0;continue}px[i+3]=255;for(let j=0;j<3;j++)px[i+j]=Math.min(255,Math.round(px[i+j]/4)*4)}
 const solid=new Uint8ClampedArray(px),ww=cv.width,hh=cv.height;
 for(let y=1;y<hh-1;y++)for(let x=1;x<ww-1;x++){const i=(y*ww+x)*4;if(solid[i+3])continue;if(solid[i-1]||solid[i+7]||solid[i-ww*4+3]||solid[i+ww*4+3]){px[i]=20;px[i+1]=24;px[i+2]=32;px[i+3]=255}}
 c.setTransform(1,0,0,1,0,0);c.putImageData(img,0,0);cache.set(key,cv);while(cache.size>limit||[...cache.values()].reduce((n,v)=>n+v.width*v.height*4,0)>24*1024*1024)cache.delete(cache.keys().next().value);return cv;
}
function draw(c,o,x,y,d,a,f,scale=2,hold=''){
 const cv=frame(o,d,a,f,scale,hold),prev=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;
 c.fillStyle='#05080f55';c.beginPath();c.ellipse(Math.round(x)+1.5,Math.round(y)+14.5,8.5,3,0,0,Math.PI*2);c.fill();c.drawImage(cv,Math.round(x)-C.CELL.ax,Math.round(y)-C.CELL.ay,C.CELL.w,C.CELL.h);c.imageSmoothingEnabled=prev;
}
C.frame=frame;C.draw=draw;C.clear=()=>cache.clear();C.frames=()=>cache.size;
function personTo(c,p,isPlayer,opts={}){
 const o=C.outfitFor(p,isPlayer,opts.role),mv=!!p.moving,t=performance.now(),st=C.stance(p,isPlayer);let sprint=false;try{sprint=isPlayer&&typeof run!=='undefined'&&run}catch{}
 const a=st==='sit'?'sit':st==='crouch'?'crouch':st==='sneak'?(mv?'sneak':'crouch'):mv?(sprint?'run':'walk'):'idle',f=mv?Math.floor(Math.max(0,p.walkTicks||0)/(a==='run'?1.8:a==='sneak'?3.2:2.5)):Math.floor(t/380);
 const hold=opts.hold||'',ang=hold?p.angle:Number.isFinite(p.moveAngle)&&mv?p.moveAngle:p.angle||0,d=st==='sit'?2:hold?C.dirOfAngle(ang):C.smoothDir(p,C.dirOfAngle(ang)),x=st==='sit'&&p.seat?p.seat.x:p.x,y=st==='sit'&&p.seat?p.seat.y:p.y;
 draw(c,o,x,y,d,a,f,2,hold);
 if(!isPlayer&&!opts.hideHealth&&p.hp>0&&p.hp<(p.maxHp||40)){c.fillStyle='#182832';c.fillRect(p.x-13,p.y-33,26,4);c.fillStyle='#dd9884';c.fillRect(p.x-13,p.y-33,26*p.hp/(p.maxHp||40),3)}
}
// Insert BEFORE the weapon wrapper captures person. Its animated equip and attachment pass stays intact.
const old=S.person;S.person=function(p,isPlayer,opts={}){if(!C.enabled)return old.apply(this,arguments);try{personTo(g,p,isPlayer,opts)}catch(e){console.error(e);return old.apply(this,arguments)}};S.personTo=personTo;
root.NightshiftPremiumArt=Object.freeze({frame,draw,originalFrame,density,stats:()=>({...counts,count:cache.size,limit,bytes:[...cache.values()].reduce((n,v)=>n+v.width*v.height*4,0)})});
})(globalThis);
