/* Shared pixel silhouettes and directional poses; no physics or saved-state writes. */
(function(root){'use strict';
let drawing=null;function rect(color,x,y,w,h){const ctx=drawing||g;ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function polygon(color,points){const ctx=drawing||g;ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
function pose(p,isPlayer=false){const moving=isPlayer?(typeof player!=='undefined'&&player.moving):p.moving===true,angle=moving&&Number.isFinite(p.moveAngle)?p.moveAngle:Number.isFinite(p.angle)?p.angle:Math.atan2(p.dy||0,p.dx||0),frame=moving?Math.floor((Number.isFinite(p.walkTicks)?Math.max(0,p.walkTicks):0)/2.5)%8:0;return {facing:((Math.round(angle/(Math.PI/4))%8)+8)%8,phase:frame,frame,stride:moving?[0,2,3,2,0,-2,-3,-2][frame]:0}}
function drawCar(v){
 root.NightshiftEnvironment?.headlights(v);g.save();g.translate(Math.round(v.x),Math.round(v.y));g.rotate(v.angle||0);
 const van=v.model==='VAN',compact=v.model==='COMPACT',color=v.color||'#75a5ac';
 polygon('#101d2855',[[-27,-12],[-18,-18],[20,-16],[30,-8],[30,15],[22,22],[-24,22],[-31,12]]);
 const active=typeof player!=='undefined'&&player.car===v,traffic=root.NightshiftTraffic?.actors?.includes(v)===true,braking=active&&((typeof firing!=='undefined'&&firing)||(typeof mouseFire!=='undefined'&&mouseFire)||(typeof keys!=='undefined'&&keys[' ']))||(traffic&&Math.abs(v.speed||0)<.1),lights=root.NightshiftEnvironment?.vehicleLights(v,{active:active||traffic,brake:!!braking})||{on:true,braking:!!braking,reverse:(v.speed||0)<-.1};
 const steering=active?Math.max(-1,Math.min(1,(typeof keys!=='undefined'?((keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)):0)+(typeof joy!=='undefined'?joy.x:0))):0;
 const roll=Math.abs(v.speed||0)>.1&&(Math.floor((typeof ticks==='number'?ticks:0)/3)%2===0);
 for(const x of [-18,15])for(const y of [-19,14]){g.save();g.translate(x+4,y+2);if(x>0)g.rotate(steering*.35);rect('#111c25',-4,-2,9,5);rect('#616a6c',-2,roll?-1:0,5,1);g.restore()}
 const shape=van?[[-27,-14],[-23,-17],[22,-17],[27,-12],[27,12],[22,17],[-23,17],[-27,14]]:compact?[[-24,-10],[-18,-16],[15,-16],[26,-10],[27,9],[17,15],[-17,15],[-24,10]]:[[-28,-10],[-22,-16],[18,-16],[27,-10],[28,10],[18,16],[-22,16],[-28,10]];
 polygon('#182831',shape);g.save();g.scale(.94,.91);polygon(color,shape);g.save();g.beginPath();shape.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();finishPaint(g,-29,-17,58,34);g.restore();g.restore();
 rect('#ffffff28',-20,-14,37,2);rect('#00000024',-23,11,43,3);rect('#152a33',-3,-19,7,3);rect('#152a33',-3,16,7,3);
 if(van){rect('#c3d0c022',-23,-12,26,24);rect('#213941',4,-12,9,24);rect('#8badb2',7,-10,5,20);rect(color,14,-11,8,22);rect('#ffffff28',-20,-9,20,2);rect('#00000020',-20,7,20,2);rect('#727e7755',-21,-5,1,9);rect('#172e3666',-12,-11,1,22);rect('#bfd0c233',-22,0,20,1)}
 else{
  polygon('#142a36',[[-15,-10],[-9,-13],[8,-13],[14,-9],[14,9],[7,13],[-9,13],[-15,9]]);
  polygon('#7c9fa9',[[6,-11],[10,-9],[13,0],[10,9],[6,11]]);rect('#aac1bb',8,-8,2,11);
  polygon('#526f7d',[[-14,-8],[-10,-11],[-7,-10],[-7,10],[-10,11],[-14,8]]);
  rect(color,compact?-8:-5,-11,compact?14:10,22);rect('#ffffff22',-4,-10,8,2);rect('#00000022',-4,7,8,3);
  rect('#ffffff28',compact?18:16,-9,compact?3:5,18);if(!compact){rect('#ffffff18',16,-6,6,1);rect('#00000022',16,5,6,1)}rect('#00000022',-23,-8,4,16);rect('#111f2a',compact?-20:-24,-9,2,18);
 }
 // Model-specific paint, glass, and body details, rendered in local vehicle coordinates.
 rect('#10263166',-21,-13,3,26);rect('#ffffff24',-20,-13,32,1);
 rect('#e2ece344',-19,-15,6,2);rect('#d6e4dc44',13,-15,7,2);
 for(const yy of [-19,15]){rect('#192e38',-8,yy,6,4);rect('#8eaaa7',-7,yy+1,4,1)}
 if(van){for(let k=0;k<4;k++){rect('#d9e0d51e',-19+k*6,-13,2,26);rect('#1a303a22',-17+k*6,-12,1,24)}rect('#d6d7c033',-24,-13,2,26)}
 else{rect('#142a34',7,-10,1,20);rect('#d8e6dd55',8,-8,1,11);rect('#203743',-13,-9,3,18);rect('#91b2b733',-11,-7,2,11);rect('#0f263155',-6,-10,2,20);if(!compact){rect('#e4e9d522',-26,-8,6,1);rect('#e4e9d522',-26,7,6,1)}}
 rect('#f0e8c83b',19,-13,4,2);rect('#e0e6dc3b',19,12,4,2);
 rect('#111f2b',-22,-17,8,2);rect('#111f2b',-22,15,8,2);
 rect('#14232c',25,-5,3,10);rect('#596569',27,-4,1,8);rect(lights.on?'#e7e2ac':'#87938b',23,-11,3,6);rect(lights.on?'#e7e2ac':'#87938b',23,5,3,6);if(lights.on){rect('#ffffff',24,-10,2,2);rect('#ffffff',24,6,2,2)}

 rect(braking?'#ff6d55':'#aa4644',van?-27:compact?-24:-28,-11,3,6);rect(braking?'#ff6d55':'#aa4644',van?-27:compact?-24:-28,5,3,6);rect(lights.reverse?'#fcf4d6':'#86928a',van?-27:compact?-24:-28,-3,2,6);if(lights.braking){rect('#ff6d5533',-39,-13,8,8);rect('#ff6d5533',-39,5,8,8)}if(lights.reverse){rect('#faf0c522',-40,-5,10,10)}
 if(Number.isFinite(v.condition)&&v.condition<65){rect('#24353b',17,-9,6,2);rect('#b0b5a077',20,-7,2,6);rect('#283238',-10,11,10,2)}
 if(Number.isFinite(v.condition)&&v.condition<25){rect('#172932',18,3,6,7);rect('#747d77',19,4,3,3)}g.restore();
}
function rounded(color,x,y,w,h,r=2){const ctx=drawing||g;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fill()}
function finishPaint(ctx,x,y,w,h){const shade=ctx.createLinearGradient?.(x,y,x,y+h);if(!shade?.addColorStop)return;shade.addColorStop(0,'#ffffff38');shade.addColorStop(.35,'#ffffff08');shade.addColorStop(.65,'#10253508');shade.addColorStop(1,'#071c4055');ctx.fillStyle=shade;ctx.fillRect(x,y,w,h)}
// ---- Art pass (Claude): characters -------------------------------------------------------------
// Bigger, more readable people: skin/hair/outfit variety per NPC (seeded by id), hair styles, outfits
// (tee, hoodie, jacket, tank, suit, uniform), shaded clothes, arm swing, walk bob, side-view stride and a
// crisp 1px outline baked into each atlas. Police get a uniform; the player's gun matches the equipped weapon.
const SKINS=['#f3cfb1','#e6b58f','#cf9670','#b0774f','#8d5a3b','#6a4129','#4f2f1f'];
const HAIRS=['#17151a','#2e211a','#4a3324','#7a5434','#b8874e','#d9bf86','#8b8f98','#7d2e24','#3a2a4a'];
const PANTS=['#25344a','#2f3b55','#3d3a36','#1f2328','#6b6250','#45506a','#5a3e3a'];
const SHOES=['#d9ddd2','#2a2a2e','#7a4b2f','#c0473f','#e8e0c8','#3a4f7a'];
const STYLES=['tee','hoodie','jacket','tee','hoodie','suit','jacket','tank'];
const SHIRTS=['#c84659','#3d7fc6','#e2b75c','#6d73be','#2f8f6a','#e4e0d6','#38404d','#a34a8a','#e07a3a','#4f9fa8','#7a8f3a','#1f2a3a'];
const HAIRDO=['short','buzz','long','afro','bun','short','curly','bald','long','ponytail'];
function seedOf(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function shade(hex,amt){const n=parseInt(String(hex).slice(1,7),16);if(!Number.isFinite(n))return hex;let r=n>>16&255,gg=n>>8&255,b=n&255;const f=amt<0?(v)=>Math.round(v*(1+amt)):(v)=>Math.round(v+(255-v)*amt);r=f(r);gg=f(gg);b=f(b);return '#'+((1<<24)|(r<<16)|(gg<<8)|b).toString(16).slice(1)}
function lookFor(p,isPlayer,role,profileIn){
 const profile=profileIn??(isPlayer?root.NightshiftHome?.profile:null),seed=seedOf(isPlayer?'player':(p.id||p.name||p.color||'npc')),pick=(arr,k)=>arr[(seed>>>k)%arr.length];
 const shirt=profile?.shirt||(role==='ped'?pick(SHIRTS,5):p.color||'#799f98');
 if(role==='officer')return {shirt:'#2a3f6e',skin:pick(SKINS,3),hair:pick(HAIRS,7),pants:'#1d2a44',shoes:'#15171c',style:'uniform',hairdo:'short',beard:false,hat:'police',bag:null,accent:'#d9b44a'};
 return {shirt,skin:profile?.skin||(isPlayer?'#c79977':pick(SKINS,3)),hair:profile?.hair||pick(HAIRS,7),pants:profile?.pants||(isPlayer?'#273543':pick(PANTS,11)),shoes:profile?.shoes||(isPlayer?'#c5cbbb':pick(SHOES,13)),
  style:isPlayer?(profile?.outfit||'jacket'):(()=>{const st=pick(STYLES,17);return st==='tank'&&['#e2b75c','#e07a3a','#e4e0d6'].includes(shirt)?'tee':st})(),hairdo:isPlayer?(profile?.hairdo||'short'):pick(HAIRDO,19),beard:!isPlayer&&((seed>>>23)%5===0),hat:profile?.hat&&profile.hat!=='none'?profile.hat:null,bag:profile?.bag&&profile.bag!=='none'?profile.bag:null,accent:pick(['#e8d36a','#d9e4ef','#e07a6a','#7fd1c2'],25)};
}
function shadowAt(ctx,x,y){ctx.fillStyle='#05080f55';ctx.beginPath();ctx.ellipse(x+1,y+15,9,3.2,0,0,Math.PI*2);ctx.fill()}
function drawPersonDirect(p,isPlayer=false,options={}){
 const ctx=options.context||g,previousDrawing=drawing;drawing=ctx;
 const L=options.look||lookFor(p,isPlayer,options.role,options.profile);
 const {facing,stride,frame}=options.pose||pose(p,isPlayer),front=facing>=1&&facing<=3,back=facing>=5&&facing<=7,side=facing===0||facing===4,dir=facing===0||facing===1||facing===7?1:facing===3||facing===4||facing===5?-1:0;
 const bob=stride&&Math.abs(stride)>=3?-1:0,sx=side?stride*0.9:0,sy=side?0:stride*0.6;
 ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y)+bob);
 if(!options.noShadow)shadowAt(ctx,0,-bob);
 const skinD=shade(L.skin,-.18),shirtL=shade(L.shirt,.18),shirtD=shade(L.shirt,-.28),pantsD=shade(L.pants,-.3),hairL=shade(L.hair,.22);
 // legs (far leg first)
 const leg=(x,dy,dx,col)=>{rounded(col,x+dx,3,4,10+dy,1.5);rounded(shade(L.shoes,-.35),x+dx-.5,12+dy,5.5,3.5,1.5);rect(L.shoes,x+dx,12+dy,4.5,1.5)};
 if(side){leg(-2,0,-sx,pantsD);leg(-2,0,sx,L.pants)}else{leg(-5,sy,0,L.pants);leg(1,-sy,0,L.pants);rect(pantsD,-1,4,2,6)}
 // torso + arms
 const tw=side?9:12,tx=-tw/2,armSwing=stride*0.7;
 const bodyCol=L.style==='jacket'||L.style==='suit'?shade(L.shirt,-.35):L.style==='uniform'?L.shirt:L.shirt;
 const arm=(x,dy,col,hand)=>{rounded(col,x,-8+dy,3.5,11,1.6);rounded(hand,x+.25,2+dy,3,3,1.4)};
 const sleeve=L.style==='tank'?L.skin:bodyCol;
 if(side){arm(-1.5-dir*1,-armSwing,shade(sleeve,-.2),skinD)}else arm(tx-2.5,armSwing,shade(sleeve,-.1),L.skin);
 if(L.style==='hoodie'&&!front)rounded(shade(L.shirt,-.15),-5,-14,10,6,3);
 rounded(bodyCol,tx,-10,tw,15,3);
 rect(shade(bodyCol,.16),tx+1,-9,2,12);rect(shade(bodyCol,-.25),tx+tw-2.5,-9,1.5,12);
 if(front){
  if(L.style==='jacket'){rect(L.accent==='#d9e4ef'?'#d9e4ef':shirtL,-1.5,-9,3,12);rect(shade(bodyCol,-.4),-2.5,-9,1,12);rect(shade(bodyCol,-.4),1.5,-9,1,12)}
  else if(L.style==='suit'){rect('#e9ecef',-1.5,-9,3,8);rect(L.shirt,-.5,-8,1.2,7);rect(shade(bodyCol,-.4),-2.5,-9,1,10)}
  else if(L.style==='hoodie'){rect(shirtD,-3,-1,6,3);rect('#e9e2cf',-1.5,-8,.8,3);rect('#e9e2cf',.8,-8,.8,3);rounded(shade(L.shirt,-.12),-4.5,-11,9,3,1.5)}
  else if(L.style==='tank'){rect(L.skin,-2,-10,4,2)}
  else if(L.style==='uniform'){rect(L.accent,2,-7,2,2);rect('#141c2e',tx,2,tw,1.5);rect('#8fa6c8',-4,-9,1,6)}
  else{rect(L.skin,-1.5,-10,3,1.5);if(((p.id||'').length+(L.shirt||'').length)%2)rect(L.accent,-3,-5,6,2)}
 }
 if(back&&L.style==='hoodie')rounded(shade(L.shirt,-.2),-4,-12,8,5,2);
 rect('#0a0f1a55',tx,3,tw,1.5);
 if(L.bag){rect('#3b2e22',side?-1:-5,-9,1.5,12);rounded('#a58a5b',back?-4:dir>0?-7:4,-6,back?9:3,10,2)}
 if(side)arm(-1.5+dir*1,armSwing,sleeve,L.skin);else arm(tx+tw-1,-armSwing,sleeve,L.skin);
 // neck + head
 rect(skinD,-1.5,-13,3,3);
 const hx=side?dir*1:0;
 rounded(L.skin,-4+hx,-21,8,9,3.2);
 rect(skinD,(side&&dir<0?-4:2.5)+hx,-15,1.5,3);
 if(!back){
  const ey=-16.5;
  if(front){rect('#1a1d24',-2.2+hx+dir*.6,ey,1.2,1.4);rect('#1a1d24',1.2+hx+dir*.6,ey,1.2,1.4);rect(shade(L.skin,-.3),-.8+hx+dir*.4,-13.8,2,.8)}
  else{rect('#1a1d24',dir>0?1.5+hx:-2.5+hx,ey,1.2,1.4);rect(skinD,dir>0?3.2+hx:-4.2+hx,-15.5,1,2)}
  if(L.beard)rounded(shade(L.hair,-.1),-3.5+hx,-14.5,7,3,1.5);
 }
 // hair
 const H=L.hair;
 switch(L.hairdo){
  case 'bald':rect(shade(L.skin,.15),-2+hx,-20.5,3,1);break;
  case 'buzz':rounded(H,-4+hx,-21.5,8,3.5,2);break;
  case 'afro':rounded(H,-6+hx,-25,12,9,5);rect(hairL,-4+hx,-24,3,1.5);break;
  case 'curly':rounded(H,-5+hx,-23,10,6,3);for(const cx of [-4,-1,2])rect(hairL,cx+hx,-22.5,1.5,1.5);break;
  case 'bun':rounded(H,-4.5+hx,-22,9,5,2.5);rounded(H,-2+hx,-26,4,4,2);break;
  case 'long':rounded(H,-4.5+hx,-22,9,5,2.5);if(back||side)rounded(H,-4.5+hx+(side?-dir*1.5:0),-19,side?5:9,10,2);else{rect(H,-5+hx,-19,2,8);rect(H,3+hx,-19,2,8)}break;
  case 'ponytail':rounded(H,-4.5+hx,-22,9,5,2.5);if(!front)rounded(H,(side?-dir*5:-1.5)+hx,-19,3,8,1.5);break;
  default:rounded(H,-4.5+hx,-22,9,5,2.5);rect(hairL,-2.5+hx,-21.5,3,1);if(side)rect(H,(dir>0?-4.5:2.5)+hx,-19,2,4)
 }
 if(back&&!['bald','buzz'].includes(L.hairdo))rounded(H,-4+hx,-20,8,6,2.5);
 if(L.hat==='police'){rounded('#1d2a44',-5+hx,-24,10,5,2);rect('#141c2e',(front?-5:dir>0?0:-6)+hx,-20,side?6:10,1.5);rect('#d9b44a',-1+hx,-23,2,2)}
 else if(L.hat){rounded(L.hat==='cap'?'#526575':'#b97562',-4.5+hx,-24,9.5,5,2);rect(shade(L.hat==='cap'?'#526575':'#b97562',-.3),(dir>=0?1.5:-6)+hx,-20,5,1.5)}
 if(isPlayer&&options.weapon!==false&&!options.noWeapon&&(!root.NightshiftInventory||root.NightshiftInventory.state.pocket.pistol>0))gunArm(ctx,p,L);
 if(!options.hideHealth&&!isPlayer&&Number.isFinite(p.hp)&&p.hp<(p.maxHp||40)){rect('#182832',-13,-31,26,4);rect('#dd9884',-13,-31,26*Math.max(0,p.hp/(p.maxHp||40)),3)}
 ctx.restore();drawing=previousDrawing;
}
// Gun in hand, shaped by the equipped weapon (Claude weapons module) — pistol/revolver short, SMG with mag,
// shotgun with pump, DMR with scope, AR with stock and mag.
function gunArm(ctx,p,L){
 const id=root.NightshiftWeapons?.state?.equipped||'pistol',mods=root.NightshiftWeapons?.state?.mods?.[id]||[];
 ctx.save();ctx.rotate(p.angle||0);
 rounded(shade(L.shirt,L.style==='jacket'?-.35:0),3,-3,8,5,2);rounded(L.skin,10,-2.5,4,4,1.5);
 const SKP=root.NightshiftWeapons?.skinPalette?.(id),metal=SKP?.st||'#1a2128',hi=SKP?.hi||'#8d979b',wood=SKP?.sl||'#5b3d28',woodL=SKP?.hi||'#7a5532',tape=SKP?.sl||'#8b9399',chrome=SKP?.hi||'#b9c2c7';
 // Held guns, top-down, barrel along +x (one shape per craftable gun; unknown ids fall back by length).
 const G={
  pipe:()=>{rect(tape,11,-3,13,2.6);rect(chrome,11,-3,13,.8);rect('#2a2a2a',10,-1,3,3.5)},
  zip:()=>{rect(tape,11,-3,14,2.6);rect(chrome,11,-3,14,.8);rect(wood,9,-3.5,4,4.5);rect('#b9c2c7',9.5,-2,3,.8)},
  sawnoff:()=>{rect(wood,5,-3.8,8,4.6);rect(woodL,5,-3.8,8,1);rect(metal,13,-4,12,2);rect(metal,13,-1.6,12,2);rect(hi,13,-4,12,.7)},
  pistol:()=>{rect(metal,12,-3.5,9,3.5);rect(hi,13,-3.5,8,1);rect('#2c2420',12.5,-.5,2.5,4)},
  compact:()=>{rect(metal,12,-3.2,7,3);rect(hi,12.5,-3.2,6,.9);rect('#3a3f45',12.5,-.5,2.5,3.5)},
  revolver:()=>{rect(metal,12,-3.5,11,3.5);rect(hi,13,-3.5,10,1);rect('#2c2420',12.5,-.5,2.5,4);rect('#3a3f45',15,-4.5,4,5.5)},
  hawk:()=>{rect('#8f989d',12,-4,13,4.2);rect('#d6dde1',12,-4,13,1.1);rect('#5d646b',12.5,-.2,3,4)},
  machine:()=>{rect(metal,12,-3.6,11,3.8);rect(hi,12.5,-3.6,10,1);rect('#20272c',14,.2,2.5,6.5)},
  smg:()=>{rect(metal,11,-4,14,4.5);rect(hi,12,-4,12,1);rect('#20272c',16,.5,2.5,6);rect(metal,7,-3,4,3)},
  pump:()=>{rect(wood,4,-3.6,8,4.2);rect(metal,12,-3.6,18,3);rect(hi,12,-3.6,18,.9);rect(woodL,19,-1,7,2.6)},
  shotgun:()=>{rect(metal,5,-3.5,7,4);rect(metal,12,-3.5,17,3);rect(hi,12,-3.5,17,1);rect('#2b3238',17,-.5,6,2.5)},
  hunting:()=>{rect(wood,3,-3.5,14,4);rect(woodL,3,-3.5,14,1);rect(metal,15,-3,19,2.6);rect(hi,15,-3,19,.8);rect(chrome,14,-5,1.4,2)},
  carbine:()=>{rect(metal,4,-3.5,7,4);rect(metal,11,-4,15,4.5);rect(hi,12,-4,13,1);rect('#20272c',16,.5,3,6);rect('#3a4148',24,-2.8,5,2)},
  rifle:()=>{rect('#4a3a2c',4,-3.5,8,4);rect(metal,12,-3,20,3);rect(hi,12,-3,20,.8);rect('#11161a',15,-6.5,8,2.5);rect('#7fb6d6',22,-6.3,1,2)},
  ar:()=>{rect(metal,4,-3.5,8,4);rect(metal,12,-4,16,4.5);rect(hi,13,-4,14,1);rect('#20272c',17,.5,3,6.5);rect('#3a4148',25,-2.5,6,2)},
  goldhawk:()=>{rect('#b8862a',12,-4,13,4.2);rect('#ffe08a',12,-4,13,1.1);rect('#8a6418',14,-2.4,9,.6);rect('#e8e0c8',12.5,-.2,3,4)},
  whisper:()=>{rect(metal,10,-4,12,4.5);rect(hi,11,-4,10,1);rect('#20272c',15,.5,2.5,6);rect('#2b3036',22,-3.7,12,3.7);rect('#5a6068',22,-3.7,12,.9);rect('#9a5aff',17,-3.2,2,.8)},
  dragon:()=>{rect(metal,5,-3.5,7,4);rect(metal,12,-3.5,18,3);rect(hi,12,-3.5,18,1);rect('#5a1a14',15,-.8,6,5);rect('#c0473f',16,0,4,3);rect('#c0392b',29,-3.5,2,3)},
  reaper:()=>{rect(metal,3,-3.5,10,4);rect(metal,13,-3,23,3);rect(hi,13,-3,23,.8);rect('#11161a',14,-7,9,3);rect('#7fb6d6',22,-6.8,1,2.4);rect(metal,35,-4,3,5)},
  tiger:()=>{rect('#e8833a',4,-3.5,8,4);rect('#111',6,-3.5,1,4);rect('#111',9,-3.5,1,4);rect(metal,12,-4,16,4.5);rect('#e8833a',19,-4,9,4.5);rect('#111',21,-4,1,4.5);rect('#111',24,-4,1,4.5);rect('#20272c',17,.5,3,6.5);rect('#11161a',13,-6.5,7,2.5);rect('#e3c25a',13,-6.5,7,.7)}
 };
 (G[id]||G.pistol)();
 const len={pipe:24,zip:25,sawnoff:25,pistol:21,compact:19,revolver:23,hawk:25,machine:23,smg:28,pump:30,shotgun:29,hunting:34,carbine:29,rifle:32,ar:31,goldhawk:25,whisper:34,dragon:31,reaper:38,tiger:31}[id]||21;
 if(mods.includes('suppressor')&&id!=='whisper')rect('#2b3036',len,-3.5,7,3);
 if(mods.includes('grip')){ctx.fillStyle='#ff304055';ctx.fillRect(22,-1.6,40,.8)}
 ctx.restore();
}
const atlasCache=new Map(),MAX_ATLASES=20,CELL_W=44,CELL_H=52,AX=22,AY=34;
function atlasKey(p,isPlayer,role){const L=lookFor(p,isPlayer,role);return {L,key:JSON.stringify([isPlayer,role||'',L.shirt,L.skin,L.hair,L.pants,L.shoes,L.style,L.hairdo,L.beard,L.hat,L.bag,L.accent])}}
function atlasFor(p,isPlayer,role){
 const {L,key}=atlasKey(p,isPlayer,role);
 if(atlasCache.has(key)){const value=atlasCache.get(key);atlasCache.delete(key);atlasCache.set(key,value);return value}
 // Overflow NPC styles draw directly instead of evicting/rebuilding 64-frame atlases every frame.
 if(atlasCache.size>=MAX_ATLASES&&!isPlayer)return null;
 const canvas=root.document?.createElement?.('canvas'),ctx=canvas?.getContext?.('2d');if(!ctx)return null;
 canvas.width=CELL_W*8;canvas.height=CELL_H*8;ctx.imageSmoothingEnabled=false;
 for(let facing=0;facing<8;facing++)for(let frame=0;frame<8;frame++)drawPersonDirect({x:frame*CELL_W+AX,y:facing*CELL_H+AY,color:p.color,id:p.id,hp:40},isPlayer,{context:ctx,look:L,weapon:false,noShadow:true,hideHealth:true,pose:{facing,frame,stride:[0,2,3,2,0,-2,-3,-2][frame]}});
 // 1px dark outline around every frame (silhouette stamped behind in 4 directions)
 if(typeof g==='undefined'||ctx!==g)try{const sil=root.document.createElement('canvas');sil.width=canvas.width;sil.height=canvas.height;const s=sil.getContext('2d');s.drawImage(canvas,0,0);s.globalCompositeOperation='source-in';s.fillStyle='#0a0e17';s.fillRect(0,0,sil.width,sil.height);ctx.globalCompositeOperation='destination-over';for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])ctx.drawImage(sil,dx,dy);ctx.globalCompositeOperation='source-over'}catch{}
 atlasCache.set(key,canvas);if(atlasCache.size>MAX_ATLASES)atlasCache.delete(atlasCache.keys().next().value);
 return canvas;
}
function drawPerson(p,isPlayer=false,options={}){
 const role=options.role||null,atlas=atlasFor(p,isPlayer,role);
 if(!atlas)return drawPersonDirect(p,isPlayer,options);
 const state=pose(p,isPlayer);
 g.save();g.imageSmoothingEnabled=false;
 shadowAt(g,Math.round(p.x),Math.round(p.y));
 g.drawImage(atlas,state.frame*CELL_W,state.facing*CELL_H,CELL_W,CELL_H,Math.round(p.x)-AX,Math.round(p.y)-AY,CELL_W,CELL_H);
 if(isPlayer&&options.weapon!==false&&(!root.NightshiftInventory||root.NightshiftInventory.state.pocket.pistol>0)){g.translate(Math.round(p.x),Math.round(p.y));const prev=drawing;drawing=g;gunArm(g,p,lookFor(p,true,null));drawing=prev}
 g.restore();
 if(!isPlayer&&Number.isFinite(p.hp)&&p.hp<(p.maxHp||40)){rect('#182832',p.x-13,p.y-31,26,4);rect('#dd9884',p.x-13,p.y-31,26*Math.max(0,p.hp/(p.maxHp||40)),3)}
}

// ---- Art pass (Claude): furniture with real shapes, soft shadows and quiet labels ----
function label(text,cx,y){
 const ctx=drawing||g;ctx.save();ctx.font='bold 8px monospace';const w=(ctx.measureText?.(text)?.width||text.length*5)+10;
 ctx.fillStyle='#0b1018aa';rounded('#0b1018aa',cx-w/2,y-9,w,11,4);ctx.fillStyle='#e9eef7cc';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,cx,y-3.5);ctx.restore()}
function furniture(f){
 const {x,y,w,h,label:name}=f;g.save();
 const soft=(ox,oy,ww,hh)=>{g.fillStyle='#0a0f1a33';g.fillRect(x+ox,y+oy,ww,hh)};
 soft(4,6,w,h);soft(2,3,w,h);
 if(name==='BED'){
  rect('#2a2230',x-1,y-1,w+2,h+2);rect('#5b4632',x,y,w,h);rect('#6f5640',x,y,w,10);rect('#7d6248',x+2,y+2,w-4,3); // frame + headboard
  rect('#e9e3d6',x+6,y+12,w-12,h-18);rect('#ffffff55',x+7,y+13,w-14,2); // sheet
  rect('#f4efe4',x+10,y+14,30,16);rect('#d9d1c0',x+10,y+27,30,3);rect('#f4efe4',x+w-40,y+14,30,16);rect('#d9d1c0',x+w-40,y+27,30,3); // pillows
  rect(f.color,x+6,y+38,w-12,h-44);rect(shade(f.color,.2),x+6,y+38,w-12,4);rect(shade(f.color,-.25),x+6,y+h-9,w-12,3); // blanket
  for(let i=x+12;i<x+w-12;i+=14)rect(shade(f.color,.12),i,y+46,6,h-56);
  rect('#3b2b20',x+w+6,y+6,20,20);rect('#4c3828',x+w+7,y+7,18,4);rect('#e9d9a6',x+w+12,y+12,8,8);rect('#fff4c8',x+w+14,y+13,4,3); // nightstand + lamp
 }else if(name==='SOFA'){
  rect('#2a2230',x-1,y-1,w+2,h+2);rect(shade(f.color,-.3),x,y,w,h);rect(shade(f.color,-.15),x,y,w,16); // back
  rect(shade(f.color,-.35),x,y+6,12,h-6);rect(shade(f.color,-.35),x+w-12,y+6,12,h-6);rect(shade(f.color,-.1),x+1,y+7,10,4);rect(shade(f.color,-.1),x+w-11,y+7,10,4); // arms
  const n=3,cw=(w-26)/n;for(let k=0;k<n;k++){const cx=x+13+k*cw;rect(f.color,cx,y+16,cw-2,h-20);rect(shade(f.color,.18),cx+1,y+17,cw-4,3);rect(shade(f.color,-.12),cx,y+h-8,cw-2,3)}
  rect('#e8c66a',x+16,y+9,12,10);rect('#c96a8a',x+w-30,y+9,12,10); // throw pillows
 }else if(name==='KITCHEN'){
  rect('#2a2230',x-1,y-1,w+2,h+2);rect('#d6d2c2',x,y,w,h);rect('#eceadf',x,y,w,4);rect('#9a9888',x,y+h-6,w,6); // counter
  rect('#8fa3a8',x+12,y+12,30,20);rect('#5f7479',x+15,y+15,24,14);rect('#c7d6da',x+26,y+9,2,6); // sink
  rect('#2b2f33',x+w-58,y+8,34,30);for(const xx of [x+w-52,x+w-38])for(const yy of [y+13,y+26]){rect('#4a5056',xx,yy,9,9);rect('#1b1e21',xx+2,yy+2,5,5)} // stove
  rect('#e3e8ea',x+w-20,y-2,18,h+4);rect('#c9d0d3',x+w-20,y+18,18,1);rect('#8a9599',x+w-6,y+4,2,8); // fridge
  rect('#7fa55a',x+50,y+10,6,6);rect('#c0473f',x+58,y+12,5,5); // produce
 }else if(name==='WARDROBE'){
  rect('#2a2230',x-1,y-1,w+2,h+2);rect(f.color,x,y,w,h);rect(shade(f.color,.15),x,y,w,4);
  rect(shade(f.color,-.25),x+w/2-1,y+4,2,h-6);rect('#d9c38a',x+w/2-6,y+h/2-4,2,8);rect('#d9c38a',x+w/2+4,y+h/2-4,2,8);
  rect('#a9c3d0',x+6,y+8,w/2-12,h-16);rect('#ffffff44',x+8,y+10,3,h-22); // mirror
 }else if(name==='STORAGE'){
  rect('#2a2230',x-1,y-1,w+2,h+2);rect('#5d4a33',x,y,w,h);
  for(const [cx,cy,cw,ch,c] of [[x+4,y+6,34,26,'#9a7a4f'],[x+42,y+10,36,22,'#86704c'],[x+10,y+36,40,28,'#a8875a']]){rect('#2a2230',cx-1,cy-1,cw+2,ch+2);rect(c,cx,cy,cw,ch);rect(shade(c,.2),cx,cy,cw,3);rect(shade(c,-.3),cx+cw/2-1,cy,2,ch)}
 }else if(['SNACKS','SUPPLIES','SHELVES'].includes(name)){
  rect('#2a2230',x-1,y-1,w+2,h+2);rect(shade(f.color,-.35),x,y,w,h);rect(f.color,x+3,y+3,w-6,h-6);
  for(let row=0;row<2;row++){const yy=y+8+row*(h-14)/2;rect('#d8d4bf',x+5,yy+(h-14)/2-4,w-10,3);
   for(let col=0;col<Math.floor((w-14)/9);col++){const c=['#d1aa6c','#83a69b','#b87776','#a8b88d','#e0c46a','#7fa3d9'][(col+row*2)%6],hh=8+((col*7+row*3)%5);rect('#1d2228',x+8+col*9,yy+(h-14)/2-4-hh,8,hh);rect(c,x+8+col*9,yy+(h-14)/2-3-hh,7,hh-1);rect('#ffffff44',x+9+col*9,yy+(h-14)/2-2-hh,2,2)}}
 }else if(name==='COUNTER'){
  rect('#2a2230',x-1,y-1,w+2,h+2);rect('#7a5838',x,y,w,h);rect('#a67c52',x,y,w,6);rect('#5b4128',x,y+h-6,w,6);
  for(let xx=x+10;xx<x+w-10;xx+=20)rect('#6b4c30',xx,y+8,1,h-16);
  rect('#1d2228',x+w-46,y+6,32,24);rect('#69b39a',x+w-43,y+9,26,12);rect('#d7f5e8',x+w-40,y+11,10,2);rect('#a2a695',x+w-41,y+24,22,4); // register
  rect('#e8dcb5',x+10,y+10,24,16);rect('#c0473f',x+14,y+13,6,4);rect('#7fa55a',x+22,y+15,6,4); // goods
 }else{
  rect('#2a2230',x-1,y-1,w+2,h+2);rect(f.color,x,y,w,h);rect('#ffffff22',x+2,y+2,w-4,3);rect('#00000022',x+2,y+h-7,w-4,6);
 }
 label(name,x+w/2,y-3);
 g.restore();
}

root.NightshiftSprites={personTo:(ctx,p,isPlayer,options={})=>drawPersonDirect(p,isPlayer,{...options,context:ctx}),car:drawCar,person:drawPerson,furniture,pose,look:lookFor,shade,atlasStats:()=>({count:atlasCache.size,limit:MAX_ATLASES,width:CELL_W*8,height:CELL_H*8})};
})(globalThis);
