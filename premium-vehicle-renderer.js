/* Codex crisp sampling for Claude's cars. Same cached, customized body in city and studio. */
(function(root){'use strict';const Cars=root.NightshiftCars,D=root.NightshiftCarsData,S=root.NightshiftSprites;if(!Cars||!D||!S)return;
const finished=new WeakSet();
function details(c,sp,id,style){const spec=D.BY[id],body=spec?.body||String(id).toLowerCase(),l=sp.L,w=sp.W,k=sp.cv.width/sp.w;c.save();c.setTransform(k,0,0,k,sp.cv.width/2,sp.cv.height/2);c.globalCompositeOperation='source-atop';
const R=(h,x,y,ww,hh)=>{c.fillStyle=h;c.fillRect(x,y,ww,hh)},L=(h,x,y,xx,yy,ww=.3)=>{c.strokeStyle=h;c.lineWidth=ww;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke()};
// Panel gaps, door handles, individual grille ribs, wheel arch highlights and glazed cabin pillars.
for(const s of [-1,1]){const yy=s*(w/2-1.5);L('#14222c',-l*.28,yy,l*.27,yy,.35);L('#bfcbd144',-l*.25,yy-s*.5,l*.23,yy-s*.5,.25);for(const x of [-l*.19,l*.11]){R('#14252f',x,yy-s*1.1,2.3,.65);R('#b9c3c5',x+.3,yy-s*1.1,1.2,.25)}for(const x of [-l*.3,l*.3]){L('#b8c6ce66',x-3,s*(w/2-3.2),x+3,s*(w/2-3.2),.4)}}
const front=l/2-2;for(let yy=-3.5;yy<=3.5;yy+=1){R('#101c25',front-1.3,yy,1.8,.55);R('#9daeb1',front-.1,yy,.3,.35)}R('#bdc9c5',front-.3,-.45,.45,.9);
if(['muscle','super','hyper','rally'].includes(body)){for(const s of [-1,1]){const xx=l*.28,yy=s*(body==='muscle'?4:6);R('#14232e',xx-3,yy-1,6,2);for(let i=0;i<4;i++)R('#839ba0',xx-2.6+i*1.4,yy-.6,.35,1.2)}L('#ced5d04d',l*.2,-w*.27,l*.39,-w*.22,.35)}
if(['pickup','van'].includes(body)){const rear=-l*.28;for(let i=0;i<5;i++)L('#0e202e66',rear-5,-w*.32+i*w*.15,rear+5,-w*.32+i*w*.15,.35);for(const s of [-1,1])R('#b5b7a3',rear-6,s*w*.3,1.1,.6)}
if(body==='suv'){for(const s of [-1,1]){L('#26313c',-l*.24,s*w*.23,l*.15,s*w*.23,1);L('#bec9cb',-l*.23,s*w*.23-.35,l*.14,s*w*.23-.35,.25)}for(const x of [-l*.15,0])L('#2b3b46',x,-w*.25,x,w*.25,.7)}
if(['classic','lowrider','luxury'].includes(body)){for(const s of [-1,1]){L('#b2a279',-l*.4,s*w*.36,l*.39,s*w*.36,.35);R('#d2c5a9',-l*.46,s*(w*.37)-.8,1.2,1.6)}R('#d7cfb0',l*.34,-.6,.6,1.2)}
if(body==='hatch'||body==='compact'){L('#132635',-l*.24,-w*.3,-l*.24,w*.3,.35);R('#b9c5c0',-l*.26,-1.4,1,2.8)}
// Specific finish options remain visible; do not place vents over an equipped solid hood scoop.
if(style?.hood==='carbon')for(let i=0;i<3;i++)L('#8fa3ad55',l*.14+i*1.2,-w*.27,l*.25+i*1.2,w*.25,.25);
c.restore()}
function sprite(...args){const sp=Cars.sprite(...args);if(!sp||finished.has(sp.cv))return sp;const c=sp.cv.getContext('2d');details(c,sp,args[0],args[2]);const img=c.getImageData(0,0,sp.cv.width,sp.cv.height),p=img.data;
for(let i=0;i<p.length;i+=4){p[i+3]=p[i+3]>=128?255:0;for(let k=0;k<3;k++)p[i+k]=Math.min(255,Math.round(p[i+k]/4)*4)}c.putImageData(img,0,0);finished.add(sp.cv);return sp}
function prepare(v,opts){const spec=D.fromModel(v?.model),id=spec?.id||(['COMPACT','SEDAN','VAN'].includes(v?.model)?v.model:null);if(!id)return;const col=/^#[0-9a-f]{6}$/i.test(v.color||'')?v.color:spec?.colors[0]||'#8a9aa8';sprite(id,col,opts?.style||root.NightshiftCarStyle?.of?.(v.id)||null)}
function crisp(c,fn){if(!c)return fn();const old=c.drawImage;c.drawImage=function(source,...rest){const smoothing=this.imageSmoothingEnabled;if(finished.has(source))this.imageSmoothingEnabled=false;try{return old.call(this,source,...rest)}finally{this.imageSmoothingEnabled=smoothing}};try{return fn()}finally{c.drawImage=old}}
function draw(v,c,opts){prepare(v,opts);let ctx=c;try{ctx=ctx||g}catch{}return crisp(ctx,()=>Cars.draw(v,c,opts))}
const descriptor=Object.getOwnPropertyDescriptors(Cars);descriptor.sprite={value:sprite,enumerable:true};descriptor.draw={value:draw,enumerable:true};root.NightshiftCars=Object.freeze(Object.defineProperties({},descriptor));
const old=S.car;S.car=function(v){prepare(v);let ctx;try{ctx=g}catch{}return crisp(ctx,()=>old.apply(this,arguments))};
root.NightshiftPremiumVehicles=Object.freeze({sprite,prepare});
})(globalThis);
