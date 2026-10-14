/* Codex crisp sampling for Claude's cars. Same cached, customized body in city and studio. */
(function(root){'use strict';const Cars=root.NightshiftCars,D=root.NightshiftCarsData,S=root.NightshiftSprites;if(!Cars||!D||!S)return;
const finished=new WeakSet();
function sprite(...args){const sp=Cars.sprite(...args);if(!sp||finished.has(sp.cv))return sp;const c=sp.cv.getContext('2d'),img=c.getImageData(0,0,sp.cv.width,sp.cv.height),p=img.data;
for(let i=0;i<p.length;i+=4){p[i+3]=p[i+3]>=128?255:0;for(let k=0;k<3;k++)p[i+k]=Math.min(255,Math.round(p[i+k]/4)*4)}c.putImageData(img,0,0);finished.add(sp.cv);return sp}
function prepare(v,opts){const spec=D.fromModel(v?.model),id=spec?.id||(['COMPACT','SEDAN','VAN'].includes(v?.model)?v.model:null);if(!id)return;const col=/^#[0-9a-f]{6}$/i.test(v.color||'')?v.color:spec?.colors[0]||'#8a9aa8';sprite(id,col,opts?.style||root.NightshiftCarStyle?.of?.(v.id)||null)}
function crisp(c,fn){if(!c)return fn();const old=c.drawImage;c.drawImage=function(source,...rest){const smoothing=this.imageSmoothingEnabled;if(finished.has(source))this.imageSmoothingEnabled=false;try{return old.call(this,source,...rest)}finally{this.imageSmoothingEnabled=smoothing}};try{return fn()}finally{c.drawImage=old}}
function draw(v,c,opts){prepare(v,opts);let ctx=c;try{ctx=ctx||g}catch{}return crisp(ctx,()=>Cars.draw(v,c,opts))}
const descriptor=Object.getOwnPropertyDescriptors(Cars);descriptor.sprite={value:sprite,enumerable:true};descriptor.draw={value:draw,enumerable:true};root.NightshiftCars=Object.freeze(Object.defineProperties({},descriptor));
const old=S.car;S.car=function(v){prepare(v);let ctx;try{ctx=g}catch{}return crisp(ctx,()=>old.apply(this,arguments))};
root.NightshiftPremiumVehicles=Object.freeze({sprite,prepare});
})(globalThis);
