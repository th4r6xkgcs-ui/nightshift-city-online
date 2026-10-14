/* Codex pistol silhouettes at twice the original native density. Claude's stats, compatibility and saves stay authoritative. */
(function(r){'use strict';const A=r.NightshiftWeaponArt,D=r.NightshiftWeaponsData;if(!A||!D)return;
const IDS=['pistol','compact','revolver','hawk','goldhawk','machine'],done=new WeakSet(),nativeCanvases=new WeakSet();let preview=null;
function sprite(id,skin=null,mods=[]){const sp=A.sprite(id,skin,mods);if(!IDS.includes(id)||done.has(sp)||sp.hd)return sp;
 const raw=A.build(id,skin,id!=='revolver'?mods.filter(m=>m!=='extmag'):mods),base=A.build(id,skin,[]),cv=sp.cv;cv.width=168;cv.height=76;const c=cv.getContext('2d');c.scale(2,2);c.imageSmoothingEnabled=false;
 const skinDef=skin&&D.SKIN?.[skin],pal=skinDef?.pal,metal=id==='goldhawk'?['#876023','#c59335','#f0c868','#fff0ba']:id==='hawk'?['#56636f','#8797a2','#c5d0d2','#e7ece5']:[pal?.st||'#263440',pal?.sl||'#485765',pal?.hi||'#81929c','#c4d1d4'],poly=pal?[A.pix.mix(pal.sl,'#000000',.5),pal.sl,A.pix.mix(pal.sl,'#ffffff',.22),pal.hi]:['#121923','#252c35','#424b54','#73808b'];
 const R=(h,x,y,w,hh)=>{c.fillStyle=h;c.fillRect(x,y,w,hh)},P=(h,p)=>{c.fillStyle=h;c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill()};
 const L=(h,x,y,xx,yy,w=.5)=>{c.strokeStyle=h;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke()};
 const x=18,y=10,rev=id==='revolver',small=id==='compact',heavy=/hawk/.test(id),len=small?11:heavy?19:id==='machine'?14:15,sh=heavy?5:4;
 if(rev){
  P('#805233',[[x+2,y+5],[x+6,y+6],[x+4.8,y+12],[x+.4,y+12.5],[x-1.1,y+10],[x+.4,y+6]]);P('#b78754',[[x+1,y+6.7],[x+4.7,y+7.4],[x+3.6,y+10.9],[x+.8,y+11.2]]);L('#4a3025',x+1,y+8,x+3.6,y+8.7);R('#ddc6a1',x+2,y+9.6,.65,.65);
  P(metal[1],[[x+2,y],[x+11,y],[x+12,y+3.5],[x+9.2,y+5.7],[x+5,y+5.7],[x+3,y+4]]);R(metal[0],x+5,y+.8,6,4);R(metal[2],x+5,y+.7,6,.55);for(let i=0;i<3;i++){R(metal[3],x+5.6+i*1.7,y+1,.5,1.5);R('#151d25',x+6+i*1.7,y+2.7,.5,1.3)}
  P(metal[1],[[x+11,y+.5],[x+21,y+.5],[x+21,y+2.7],[x+12,y+3.1]]);R(metal[3],x+12,y+.5,8,.5);R(metal[0],x+20.5,y+1,.5,1.2);R('#171e26',x+19,y-.5,1,.7);P(metal[0],[[x+2,y+.3],[x+.5,y-.8],[x+1.5,y-1.2],[x+3,y+.5]]);
  L(metal[2],x+6,y+5.2,x+11,y+5.2);L(metal[2],x+11,y+5.2,x+10.5,y+8);L(metal[2],x+10.5,y+8,x+6,y+8);L(metal[0],x+8,y+5.7,x+7.5,y+7.2,.6);
 }else{
  P(poly[1],[[x+.5,y+sh],[x+len-1,y+sh],[x+len-2,y+sh+2],[x+8,y+sh+2],[x+6,y+sh+8],[x-1,y+sh+8],[x+.4,y+sh+2]]);
  P(poly[0],[[x+1.2,y+sh+1.5],[x+6.2,y+sh+2],[x+4.8,y+sh+7.1],[x-.2,y+sh+7.1]]);L(poly[2],x+1,y+sh+2,x-.2,y+sh+6.5,.5);
  for(let j=0;j<5;j++)for(let i=0;i<5;i++)R(j%2?poly[1]:poly[2],x+.5+i*.75+(j%2)*.2,y+sh+2.7+j*.75,.25,.25);
  P(metal[1],[[x,y+.7],[x+1,y],[x+len-.7,y],[x+len,y+.7],[x+len,y+sh-.5],[x+len-.7,y+sh],[x,y+sh]]);R(metal[2],x+.7,y+.5,len-1.4,.5);R(metal[0],x+.3,y+sh-.8,len-.6,.5);R(metal[3],x+4,y+.45,len*.45,.25);
  for(let i=0;i<(small?3:5);i++)L(metal[0],x+1+i*.85,y+1.25,x+.7+i*.85,y+sh-1,.35);
  R('#121a23',x+len*.52,y+1.1,len*.2,1.2);R(metal[2],x+len*.52,y+2.05,len*.2,.25);R('#17222c',x+1,y-.65,1.5,.7);R('#c3cbb9',x+1.2,y-.5,.45,.25);R('#131b23',x+len-1.4,y-.55,.75,.65);R('#b7c0af',x+len-1.1,y-.5,.3,.3);
  L(poly[2],x+6.5,y+sh+.8,x+10.8,y+sh+.8);L(poly[2],x+10.8,y+sh+.8,x+10.4,y+sh+3.8);L(poly[2],x+10.4,y+sh+3.8,x+5.8,y+sh+3.8);L('#909a9d',x+8.4,y+sh+1.1,x+7.6,y+sh+2.9,.45);
  R(metal[2],x+4.4,y+sh+.2,1.5,.45);R(poly[3],x+3.8,y+sh+2.1,.55,.5);R(poly[0],x-1,y+sh+7.8,6.8,.6);
  if(id==='pistol'){R(poly[0],x-.8,y+sh+8,4.6,5.5);R(poly[2],x+.1,y+sh+8.5,.45,4.4);R(poly[2],x-1,y+sh+13,5,.55)}
  if(id==='machine'){R(poly[0],x+len,y,2.5,sh);for(let i=0;i<2;i++)R(metal[0],x+len+.6,y+.7+i*1.5,1,.5);R(poly[0],x-1,y+sh+8,5.8,4);R(poly[2],x-.5,y+sh+11.5,5,.5)}
  if(heavy){P(metal[0],[[x,y+.5],[x-1.4,y+.2],[x-1.6,y+1.4],[x,y+1.5]]);L(metal[2],x+len-5,y+sh+.3,x+len-2,y+sh+.3)}
  if(id==='goldhawk'){for(let i=0;i<4;i++)L('#b18338',x+8+i*2,y+2.6,x+9+i*2,y+3.3,.35);R('#91cbd7',x+3,y+sh+3.5,.6,.6)}
 }
 if(skinDef?.camo){c.save();c.globalCompositeOperation='source-atop';c.globalAlpha=.55;c.beginPath();c.rect(x-1,id==='goldhawk'?y+sh:y,len+2,rev?5:sh+8);c.clip();for(let j=0;j<9;j++)for(let i=0;i<6;i++)if((i+j*2)%3!==0)P(skinDef.camo[(i+j)%skinDef.camo.length],[[x+i*2.5,y+j*1.3],[x+i*2.5+1.8,y+j*1.3-.3],[x+i*2.5+2.4,y+j*1.3+.7],[x+i*2.5+.5,y+j*1.3+1.2]]);c.restore()}
 // Preserve the original authored attachment pixels at their validated anchors.
 for(let i=0;i<raw.px.length;i++){const v=raw.px[i];if(v&&v!==base.px[i])R(v==='glow'?'#ff6b6b':v,i%84,Math.floor(i/84),1,1)}
 if(mods.includes('extmag')&&!rev){R(poly[0],x-1,y+sh+8,5.8,id==='machine'?7:id==='pistol'?9:4);R(poly[2],x-.5,y+sh+(id==='machine'?14.5:id==='pistol'?16.5:11.5),5,.5)}
 c.setTransform(1,0,0,1,0,0);const img=c.getImageData(0,0,168,76),p=img.data,mask=new Uint8ClampedArray(p);let x0=168,y0=76,x1=0,y1=0;
 for(let yy=1;yy<75;yy++)for(let xx=1;xx<167;xx++){const i=(yy*168+xx)*4;if(mask[i+3]>=128){p[i+3]=255;x0=Math.min(x0,xx);x1=Math.max(x1,xx);y0=Math.min(y0,yy);y1=Math.max(y1,yy)}else if(mask[i-1]>=128||mask[i+7]>=128||mask[i-672+3]>=128||mask[i+672+3]>=128){p[i]=12;p[i+1]=17;p[i+2]=24;p[i+3]=255}else p[i+3]=0}
 c.putImageData(img,0,0);if(x1<x0){x0=raw.box.x*2;y0=raw.box.y*2;x1=(raw.box.x+raw.box.w)*2-1;y1=(raw.box.y+raw.box.h)*2-1}
 sp.box={x:Math.max(0,x0-1),y:Math.max(0,y0-1),w:x1-x0+3,h:y1-y0+3};sp.a=Object.fromEntries(Object.entries(raw.a).map(([k,v])=>[k,Array.isArray(v)?v.map(n=>n*2):v]));sp.nativeScale=2;done.add(sp);nativeCanvases.add(cv);return sp;
}
function prime(){for(const id of IDS)sprite(id,r.NightshiftWeapons?.state?.skins?.[id]||null,r.NightshiftWeapons?.state?.mods?.[id]||[])}
function inspect(id){prime();const gun=id||r.NightshiftWeapons?.state?.equipped||'pistol';preview={id:gun,skin:r.NightshiftWeapons?.state?.skins?.[gun]||null,mods:[...(r.NightshiftWeapons?.state?.mods?.[gun]||[])]};sprite(gun,preview.skin,preview.mods);return A.inspect(id)}
function drawHeld(c,id,x,y,angle,skin,mods,opts){sprite(id,skin,mods);if(c===ctx)return A.drawHeld(c,id,x,y,angle,skin,mods,opts);const old=c.drawImage;c.drawImage=function(cv,...a){if(nativeCanvases.has(cv)&&a.length===8)for(let i=4;i<8;i++)a[i]/=2;return old.call(this,cv,...a)};try{return A.drawHeld(c,id,x,y,angle,skin,mods,opts)}finally{c.drawImage=old}}
const descriptors=Object.getOwnPropertyDescriptors(A);descriptors.drawHeld={value:drawHeld,enumerable:true};descriptors.sprite={value:sprite,enumerable:true};descriptors.icon={value:(id,w,h,skin,mods)=>{sprite(id,skin,mods);return A.icon(id,w,h,skin,mods)},enumerable:true};descriptors.inspect={value:inspect,enumerable:true};r.NightshiftWeaponArt=Object.freeze(Object.defineProperties({},descriptors));
// World drawing uses the original attachment/equip wrapper, but normalizes the denser native coordinates.
let ctx;try{ctx=g}catch{}if(ctx){const old=ctx.drawImage;ctx.drawImage=function(cv,...a){if(nativeCanvases.has(cv)&&a.length===8){for(let i=4;i<8;i++)a[i]/=2;const smoothing=this.imageSmoothingEnabled;this.imageSmoothingEnabled=false;try{return old.call(this,cv,...a)}finally{this.imageSmoothingEnabled=smoothing}}return old.call(this,cv,...a)}}
const S=r.NightshiftSprites,old=S.person;S.person=function(p,isPlayer,opts){if(isPlayer)prime();return old.apply(this,arguments)};
document.addEventListener?.('click',e=>{const panel=document.querySelector('#wiPanel');if(!preview||!panel||panel.hidden||!panel.contains(e.target))return;const gun=e.target.closest?.('.guns button'),mod=e.target.closest?.('.mod'),sw=e.target.closest?.('.sw button');if(gun){const w=D.WEAPONS.find(w=>gun.textContent.includes(w.name));if(w){preview={id:w.id,skin:r.NightshiftWeapons?.state?.skins?.[w.id]||null,mods:[...(r.NightshiftWeapons?.state?.mods?.[w.id]||[])]}}}if(mod&&!mod.classList.contains('bad')){const index=[...mod.parentNode.children].indexOf(mod),id=D.MODS[index]?.id;if(id)preview.mods=preview.mods.includes(id)?preview.mods.filter(m=>m!==id):[...preview.mods,id]}if(sw){const index=[...sw.parentNode.children].indexOf(sw);preview.skin=D.SKINS[index]?.id||null}queueMicrotask(()=>sprite(preview.id,preview.skin,preview.mods))},true);
const C=r.NightshiftCharacters,hh=C?.holdHand;if(C&&hh)C.holdHand=(dir,hold,...args)=>hh(dir,hold==='long'&&IDS.includes(r.NightshiftWeapons?.state?.equipped)?'short':hold,...args);
prime();r.NightshiftPremiumPistols=Object.freeze({sprite,ids:IDS});
})(globalThis);
