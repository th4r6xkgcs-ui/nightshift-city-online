/* Shared pixel silhouettes and directional poses; no physics or saved-state writes. */
(function(root){'use strict';
let drawing=null;function rect(color,x,y,w,h){const ctx=drawing||g;ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function polygon(color,points){const ctx=drawing||g;ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
function pose(p,isPlayer=false){const moving=isPlayer?(typeof player!=='undefined'&&player.moving):p.moving===true,angle=moving&&Number.isFinite(p.moveAngle)?p.moveAngle:Number.isFinite(p.angle)?p.angle:Math.atan2(p.dy||0,p.dx||0),frame=moving?Math.floor((Number.isFinite(p.walkTicks)?Math.max(0,p.walkTicks):0)/2.5)%8:0;return {facing:((Math.round(angle/(Math.PI/4))%8)+8)%8,phase:frame,frame,stride:moving?[0,2,3,2,0,-2,-3,-2][frame]:0}}
function drawCar(v){
 root.NightshiftEnvironment?.headlights(v);g.save();g.translate(Math.round(v.x),Math.round(v.y));g.rotate(v.angle||0);
 const van=v.model==='VAN',compact=v.model==='COMPACT',color=v.color||'#75a5ac';
 polygon('#101d2855',[[-27,-12],[-18,-18],[20,-16],[30,-8],[30,15],[22,22],[-24,22],[-31,12]]);
 const roll=Math.abs(v.speed||0)>.1&&(Math.floor((typeof ticks==='number'?ticks:0)/3)%2===0);
 for(const x of [-18,15])for(const y of [-19,14]){rect('#111c25',x,y,9,5);rect('#616a6c',x+2,y+(roll?1:2),5,1)}
 const shape=van?[[-27,-14],[-23,-17],[22,-17],[27,-12],[27,12],[22,17],[-23,17],[-27,14]]:compact?[[-24,-10],[-18,-16],[15,-16],[26,-10],[27,9],[17,15],[-17,15],[-24,10]]:[[-28,-10],[-22,-16],[18,-16],[27,-10],[28,10],[18,16],[-22,16],[-28,10]];
 polygon('#182831',shape);g.save();g.scale(.94,.91);polygon(color,shape);g.restore();
 rect('#ffffff28',-20,-14,37,2);rect('#00000024',-23,11,43,3);rect('#152a33',-3,-19,7,3);rect('#152a33',-3,16,7,3);
 if(van){rect('#c3d0c022',-23,-12,26,24);rect('#213941',4,-12,9,24);rect('#8badb2',7,-10,5,20);rect(color,14,-11,8,22);rect('#ffffff28',-20,-9,20,2);rect('#00000020',-20,7,20,2);rect('#727e7755',-21,-5,1,9);rect('#172e3666',-12,-11,1,22);rect('#bfd0c233',-22,0,20,1)}
 else{
  polygon('#142a36',[[-15,-10],[-9,-13],[8,-13],[14,-9],[14,9],[7,13],[-9,13],[-15,9]]);
  polygon('#7c9fa9',[[6,-11],[10,-9],[13,0],[10,9],[6,11]]);rect('#aac1bb',8,-8,2,11);
  polygon('#526f7d',[[-14,-8],[-10,-11],[-7,-10],[-7,10],[-10,11],[-14,8]]);
  rect(color,compact?-8:-5,-11,compact?14:10,22);rect('#ffffff22',-4,-10,8,2);rect('#00000022',-4,7,8,3);
  rect('#ffffff28',compact?18:16,-9,compact?3:5,18);if(!compact){rect('#ffffff18',16,-6,6,1);rect('#00000022',16,5,6,1)}rect('#00000022',-23,-8,4,16);rect('#111f2a',compact?-20:-24,-9,2,18);
 }
 rect('#14232c',25,-5,3,10);rect('#596569',27,-4,1,8);rect('#e7e2ac',23,-11,3,6);rect('#e7e2ac',23,5,3,6);rect('#ffffff',24,-10,2,2);rect('#ffffff',24,6,2,2);
 const braking=typeof player!=='undefined'&&player.car===v&&((typeof firing!=='undefined'&&firing)||(typeof keys!=='undefined'&&keys[' ']));
 rect(braking?'#ff6d55':'#aa4644',van?-27:compact?-24:-28,-11,3,6);rect(braking?'#ff6d55':'#aa4644',van?-27:compact?-24:-28,5,3,6);rect('#d9d6bf',van?-27:compact?-24:-28,-3,2,6);
 if(Number.isFinite(v.condition)&&v.condition<65){rect('#24353b',17,-9,6,2);rect('#b0b5a077',20,-7,2,6);rect('#283238',-10,11,10,2)}
 if(Number.isFinite(v.condition)&&v.condition<25){rect('#172932',18,3,6,7);rect('#747d77',19,4,3,3)}g.restore();
}
function drawPersonDirect(p,isPlayer=false,options={}){
 const ctx=options.context||g,previousDrawing=drawing;drawing=ctx;const profile=options.profile??(isPlayer?root.NightshiftHome?.profile:null),shirt=profile?.shirt||p.color||'#799f98',skin=profile?.skin||'#c79977',hair=profile?.hair||'#29262b',pants=profile?.pants||'#273543',shoes=profile?.shoes||'#c5cbbb';
 const {facing,stride}=options.pose||pose(p,isPlayer),front=facing>=1&&facing<=3,back=facing>=5&&facing<=7,side=facing===0||facing===4,look=facing===0||facing===1||facing===7?2:facing===3||facing===4||facing===5?-2:0;
 ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.fillStyle='#101d2855';ctx.beginPath();ctx.ellipse(1,11,10,4,0,0,Math.PI*2);ctx.fill();
 rect('#192b34',-6,0,12,8);rect(pants,-6,4,5,9+stride);rect(pants,1,4,5,9-stride);rect('#ffffff0d',-5,5,1,7);rect('#111d2980',4,5,1,7);
 rect('#14232e',-7,13+stride,7,3);rect(shoes,-6,13+stride,5,2);rect('#14232e',1,13-stride,7,3);rect(shoes,2,13-stride,5,2);
 // Layered shoulders, jacket hem/zip and swinging sleeves rather than a box torso.
 polygon('#1b2b33',[[-8,-8],[-5,-11],[5,-11],[8,-8],[7,5],[-7,5]]);rect(shirt,-6,-9,12,12);rect(shirt,-8,-6,3,9+stride/2);rect(shirt,6,-6,3,9-stride/2);
 rect('#ffffff20',-5,-7,2,8);rect('#14232e44',4,-6,2,9);rect('#1a293444',-6,2,12,2);if(!back){rect('#c6c5b155',0,-5,1,7);rect('#1b2c36',-3,-2,2,3);rect('#1b2c36',3,-2,2,3)}
 rect(skin,-8,3+stride/2,3,3);rect(skin,6,3-stride/2,3,3);
 rect('#192c3455',-4,-17,10,11);rect(skin,-4+look/2,-17,9,10);rect('#f0c29444',-3+look/2,-16,3,5);
 polygon(hair,[[-5,-17],[-3,-20],[4,-20],[6,-17],[6,-13],[3,-14],[-4,-14],[-5,-12]]);
 if(back){rect(hair,-4,-17,10,9);rect('#ffffff13',-2,-18,5,2)}else{rect('#192b33',look+1,-11,2,1);if(front)rect('#192b33',look-2,-11,1,1);rect('#7b584b',look,-8,3,1);if(side)rect(skin,look>0?5:-5,-13,2,3)}
 if(profile?.bag&&profile.bag!=='none'){rect('#26383b',-7,-5,3,12);rect('#a58a5b',back?-5:-8,-6,back?10:4,12);rect('#d2b078',back?-4:-7,-4,back?8:2,2)}
 if(profile?.hat&&profile.hat!=='none'){rect(profile.hat==='cap'?'#526575':'#b97562',-5,-20,12,5);rect('#20333f',look>=0?3:-8,-16,6,2)}
 if(isPlayer&&options.weapon!==false&&(!root.NightshiftInventory||root.NightshiftInventory.state.pocket.pistol>0)){ctx.save();ctx.rotate(p.angle||0);rect(shirt,4,-3,7,5);rect(skin,10,-2,4,3);rect('#152a35',13,-3,10,4);rect('#929c9b',14,-3,9,2);rect('#20343d',14,0,3,5);ctx.restore()}
 if(!options.hideHealth&&!isPlayer&&Number.isFinite(p.hp)&&p.hp<(p.maxHp||40)){rect('#182832',-13,-29,26,4);rect('#dd9884',-13,-29,26*Math.max(0,p.hp/(p.maxHp||40)),3)}ctx.restore();drawing=previousDrawing;
}
const atlasCache=new Map(),MAX_ATLASES=8,CELL_W=48,CELL_H=52;
function atlasFor(p,isPlayer){
 const profile=isPlayer?root.NightshiftHome?.profile:null,key=JSON.stringify([isPlayer,profile?.shirt||p.color||'#799f98',profile?.skin,profile?.hair,profile?.pants,profile?.shoes,profile?.hat,profile?.bag]);
 if(atlasCache.has(key)){const value=atlasCache.get(key);atlasCache.delete(key);atlasCache.set(key,value);return value}
 const canvas=root.document?.createElement?.('canvas'),ctx=canvas?.getContext?.('2d');if(!ctx)return null;
 canvas.width=CELL_W*8;canvas.height=CELL_H*8;ctx.imageSmoothingEnabled=false;
 for(let facing=0;facing<8;facing++)for(let frame=0;frame<8;frame++)drawPersonDirect({x:frame*CELL_W+24,y:facing*CELL_H+28,color:p.color,hp:40},isPlayer,{context:ctx,profile,weapon:false,hideHealth:true,pose:{facing,stride:[0,2,3,2,0,-2,-3,-2][frame]}});
 atlasCache.set(key,canvas);if(atlasCache.size>MAX_ATLASES)atlasCache.delete(atlasCache.keys().next().value);return canvas;
}
function drawPerson(p,isPlayer=false,options={}){
 const atlas=atlasFor(p,isPlayer);if(!atlas)return drawPersonDirect(p,isPlayer,options);
 const state=pose(p,isPlayer);g.save();g.imageSmoothingEnabled=false;g.drawImage(atlas,state.frame*CELL_W,state.facing*CELL_H,CELL_W,CELL_H,Math.round(p.x)-24,Math.round(p.y)-28,CELL_W,CELL_H);
 if(isPlayer&&options.weapon!==false&&(!root.NightshiftInventory||root.NightshiftInventory.state.pocket.pistol>0)){g.translate(Math.round(p.x),Math.round(p.y));g.rotate(p.angle||0);rect(root.NightshiftHome?.profile.shirt||'#799f98',4,-3,7,5);rect(root.NightshiftHome?.profile.skin||'#c79977',10,-2,4,3);rect('#152a35',13,-3,10,4);rect('#929c9b',14,-3,9,2);rect('#20343d',14,0,3,5)}
 g.restore();if(!isPlayer&&Number.isFinite(p.hp)&&p.hp<(p.maxHp||40)){rect('#182832',p.x-13,p.y-29,26,4);rect('#dd9884',p.x-13,p.y-29,26*Math.max(0,p.hp/(p.maxHp||40)),3)}
}
function furniture(f){
 const {x,y,w,h,label}=f;g.save();rect('#101b2c66',x+5,y+7,w,h);rect('#27333d',x-1,y-1,w+2,h+2);rect(f.color,x,y,w,h);rect('#ffffff22',x+2,y+2,w-4,3);rect('#00000022',x+2,y+h-7,w-4,6);
 if(['SNACKS','SUPPLIES','SHELVES'].includes(label)){rect('#30443e',x+6,y+8,w-12,h-16);for(let row=0;row<2;row++){for(let col=0;col<Math.floor((w-18)/14);col++){rect(['#d1aa6c','#83a69b','#b87776','#a8b88d'][col%4],x+10+col*14,y+11+row*19,9,11);rect('#e0d6ba66',x+12+col*14,y+13+row*19,5,2)}rect('#b9b394',x+7,y+23+row*19,w-14,3)}}
 else if(label==='COUNTER'){for(let xx=x+8;xx<x+w-8;xx+=22)rect('#bea08022',xx,y+7,1,h-14);rect('#243d41',x+w-48,y+8,34,25);rect('#7faaa0',x+w-43,y+11,24,10);rect('#a2a695',x+w-41,y+25,21,5);rect('#dbca9d',x+10,y+12,26,17);rect('#967c62',x+12,y+15,22,1)}
 else if(label==='BED'){rect('#313947',x+7,y+9,w-14,h-16);rect('#c1bca3',x+12,y+13,w-24,h-26);rect('#ede0bd',x+17,y+17,36,18);rect('#b8a879',x+18,y+33,34,2);rect('#697f8e',x+57,y+13,w-72,h-26);rect('#8ca0a0',x+60,y+16,6,h-32);rect('#42566a',x+63,y+h-25,w-78,7)}
 else if(label==='SOFA'){rect('#523e45',x+6,y+7,w-12,h-14);for(let k=0;k<3;k++){rect('#b27e7d',x+14+k*(w-30)/3,y+13,(w-38)/3,h-27);rect('#cc9b8966',x+17+k*(w-30)/3,y+15,(w-48)/3,3)}rect('#876269',x+4,y+8,8,h-15);rect('#876269',x+w-12,y+8,8,h-15)}
 else if(label==='KITCHEN'){rect('#b9bba4',x+7,y+8,w-14,h-16);rect('#384d56',x+18,y+14,35,20);rect('#8fa6a1',x+22,y+17,27,13);rect('#454d4e',x+w-51,y+12,34,25);for(const xx of [x+w-44,x+w-31])for(const yy of [y+18,y+30])rect('#1e3036',xx,yy,6,6)}
 else{const count=label==='WARDROBE'?2:3;for(let k=0;k<count;k++){const xx=x+5+k*(w-10)/count;rect('#00000022',xx,y+7,(w-16)/count,h-15);rect('#d0b590',xx+(w-16)/count-7,y+h/2,3,6)}}
 g.fillStyle='#eef3ff';g.font='bold 10px monospace';g.textAlign='center';g.fillText(label,x+w/2,y-7);g.restore();
}
root.NightshiftSprites={car:drawCar,person:drawPerson,furniture,pose,atlasStats:()=>({count:atlasCache.size,limit:MAX_ATLASES,width:CELL_W*8,height:CELL_H*8})};
})(globalThis);
