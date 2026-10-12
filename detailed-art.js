/* Codex presentation layer. Claude gameplay/modules stay unchanged. Coordinates stay in world pixels. */
(function(root){'use strict';
const ink='#102431',paper='#f5dfb5',R=(c,color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))};
function P(c,color,points){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill()}
function box(c,color,x,y,w,h){R(c,ink,x-1,y-1,w+2,h+2);R(c,color,x,y,w,h);R(c,'#ffffff30',x,y,w,1);R(c,'#07152055',x,y+h-2,w,2);R(c,'#07152033',x+w-2,y,2,h)}
function shadow(c,x,y,w,h){P(c,'#07152144',[[x,y],[x+w,y],[x+w+6,y+h+5],[x+6,y+h+5]])}
function prop(c,kind,x,y,t=0){c.save();c.translate(x,y);shadow(c,-12,-4,24,12);
 if(kind==='hydrant'){box(c,'#ba5241',-4,-16,8,19);box(c,'#cf7155',-7,-12,14,5);R(c,paper,-5,-12,3,2);box(c,'#a74135',-5,-19,10,4);R(c,'#ecc594',-2,-18,3,1);box(c,'#394750',-6,2,12,3)}
 else if(kind==='mailbox'){box(c,'#437b94',-11,-22,22,21);R(c,'#74a7b7',-10,-23,20,3);box(c,'#132f40',-7,-17,14,4);R(c,paper,-6,-16,12,1);R(c,'#1c3543',-8,0,3,8);R(c,'#1c3543',5,0,3,8);R(c,'#adcccf',-5,-8,10,3)}
 else if(kind==='vending'){box(c,'#b6494e',-12,-31,24,36);box(c,'#244556',-9,-27,14,22);for(let row=0;row<3;row++)for(let col=0;col<3;col++){R(c,['#e3b36b','#67a691','#b58ad0'][col],-7+col*4,-25+row*7,3,5);R(c,paper,-7+col*4,-25+row*7,2,1)}R(c,'#cde4cf',8,-23,2,6);R(c,'#152f3c',-7,-2,14,4)}
 else if(kind==='dumpster'){box(c,'#42674f',-17,-18,34,20);box(c,'#739578',-19,-22,38,5);R(c,'#abb8a1',-16,-22,30,1);for(let i=0;i<4;i++)R(c,'#254837',-14+i*8,-14,2,13);box(c,'#1b2c31',-12,2,5,3);box(c,'#1b2c31',8,2,5,3);R(c,'#e0ce93',-3,-13,7,7)}
 else if(kind==='flowercart'){box(c,'#90714f',-17,-10,34,16);R(c,'#d5ac76',-18,-13,36,3);for(let i=0;i<7;i++){R(c,'#3d6e51',-14+i*4,-20,2,8);R(c,['#edac79','#ca8194','#ecd281'][i%3],-16+i*4,-23+i%2*3,5,5);R(c,paper,-15+i*4,-22+i%2*3,1,1)}box(c,'#243a40',-13,6,5,5);box(c,'#243a40',9,6,5,5)}
 else if(kind==='barrel'){box(c,'#a36d48',-8,-14,16,18);for(let yy=-11;yy<3;yy+=7)R(c,'#d6a478',-8,yy,16,2);R(c,'#543f34',-3,-15,6,2);R(c,'#e1c28c',-7,-13,2,14)}
 else if(kind==='crate'){box(c,'#ac8150',-12,-18,24,23);R(c,'#d7b983',-11,-17,22,2);for(let i=0;i<20;i++){R(c,'#d7b983',-10+i,-14+i,2,2);R(c,'#d7b983',9-i,-14+i,2,2)}R(c,'#e8dcc1',-4,-10,8,5)}
 else if(kind==='bench'){for(let i=0;i<4;i++)box(c,'#ae8258',-21,-15+i*4,42,3);R(c,'#233d43',-16,-12,3,22);R(c,'#233d43',13,-12,3,22);R(c,'#c4ad83',-20,-15,40,1)}
 else if(kind==='atm'){box(c,'#6c8592',-12,-29,24,33);box(c,'#1a3748',-9,-26,18,12);R(c,'#8dd4b6',-7,-24,14,7);R(c,'#d6eac4',-6,-23,8,1);box(c,'#344d59',-8,-10,16,8);for(let i=0;i<6;i++)R(c,'#c7d0c4',-6+(i%3)*4,-8+Math.floor(i/3)*3,2,2);R(c,'#172c37',-6,0,12,2)}
 c.restore();
}
const weaponForms={pipe:[17,3,'crude'],zip:[15,3,'crude'],sawnoff:[19,6,'double'],pistol:[13,5,'pistol'],compact:[10,5,'pistol'],revolver:[17,5,'revolver'],hawk:[17,6,'pistol'],machine:[17,5,'auto'],smg:[24,6,'auto'],pump:[30,5,'wood'],shotgun:[28,6,'pump'],hunting:[35,4,'wood'],carbine:[28,6,'auto'],rifle:[35,5,'scope'],ar:[30,6,'auto'],goldhawk:[17,6,'gold'],whisper:[35,6,'silenced'],dragon:[31,6,'dragon'],reaper:[41,5,'scope'],tiger:[30,6,'tiger']};
function weapon(c,id,x,y,angle=0,palette={},mods=[]){const [len,height,kind]=weaponForms[id]||weaponForms.pistol,steel=palette.st||'#34444d',hi=palette.hi||'#b7ccce',grip=palette.sl||'#806348';c.save();c.translate(Math.round(x),Math.round(y));c.rotate(angle);c.imageSmoothingEnabled=false;
 box(c,steel,0,-height/2,len,height);R(c,hi,1,-height/2,len-2,1);R(c,'#172b35',len-1,-1,2,2);
 const long=len>22;if(long){box(c,grip,-6,-3,8,6);P(c,ink,[[-8,-3],[-8,4],[-3,3],[0,-2]]);R(c,hi,-7,-3,4,1);box(c,grip,len-13,-height/2+1,7,height-1);for(let i=0;i<3;i++)R(c,'#172932',len-12+i*2,-height/2+1,1,height-2)}
 box(c,grip,long?8:2,1,4,7);R(c,'#e0cfa3',long?9:3,2,1,5);R(c,'#17313c',long?12:6,3,3,1);R(c,hi,2,-height/2-2,2,2);R(c,hi,len-4,-height/2-2,2,2);
 if(kind==='revolver'){box(c,'#71818b',4,-4,6,7);for(let i=0;i<3;i++)R(c,ink,5+i*2,-3,1,5)}
 if(kind==='double'){R(c,ink,1,0,len-2,1);R(c,hi,1,1,len-2,1)}
 if(kind==='crude'){for(let i=0;i<3;i++)R(c,'#c3b997',2+i*3,-2,1,4);R(c,'#8f6650',len-4,-1,3,2)}
 if(kind==='auto'||kind==='tiger'||kind==='silenced'){box(c,steel,10,3,4,7);R(c,hi,11,4,1,5);for(let i=0;i<3;i++)R(c,ink,12+i*3,-2,1,3)}
 if(kind==='scope'||mods.includes('scope')){box(c,'#203440',7,-8,12,4);R(c,'#77c4df',17,-7,2,2);R(c,paper,8,-8,6,1)}
 if(kind==='gold'){R(c,'#e4b854',1,-3,len-2,2);R(c,'#ffebaf',1,-3,len-2,1);R(c,'#cc924b',3,-1,7,1)}
 if(kind==='tiger')for(let i=0;i<5;i++){R(c,'#e89e58',12+i*3,-3,2,6);R(c,ink,13+i*3,-3,1,4)}
 if(kind==='dragon'){R(c,'#bc5a4d',10,-2,8,3);R(c,'#edb16c',12,-3,3,1)}
 if(kind==='silenced'||mods.includes('suppressor')){box(c,'#2a414d',len-1,-3,9,6);R(c,'#8faaa9',len,-3,7,1)}
 if(palette.pattern)for(let i=0;i<5;i++)R(c,palette.sl||'#596955',2+i*3,-2+i%2,2,2);
 c.restore();
}
function pet(c,id,p,t=0){const d=root.NightshiftPetsData?.PET?.[id];if(!d||!p||![p.x,p.y].every(Number.isFinite))return;const dir=Math.cos(p.angle||0)>=0?1:-1,main=d.colors[0],cream=d.colors[1],stride=p.moving?Math.round(Math.sin(t*12)*2):0,bird=['owl','bird'].includes(d.kind);c.save();c.translate(Math.round(p.x),Math.round(p.y));c.scale(dir,1);c.imageSmoothingEnabled=false;
 P(c,'#0b1d2d55',[[-13,0],[11,0],[15,4],[-9,6]]);
 if(bird){const wing=p.moving?Math.round(Math.sin(t*14)*3):0;box(c,main,-7,-19,14,17);box(c,cream,-5,-15,10,10);box(c,main,-10,-17+wing,4,12);box(c,main,6,-17-wing,4,12);box(c,main,-8,-29,16,11);box(c,cream,-6,-27,12,8);for(const ex of [-4,3]){box(c,ink,ex,-25,4,4);R(c,d.kind==='owl'?'#e8bf60':'#f6eee0',ex+1,-24,2,2);R(c,ink,ex+1,-24,1,1)}R(c,'#d5a450',-1,-20,2,3);R(c,'#e8b970',-4,-2,2,4);R(c,'#e8b970',3,-2,2,4);for(let i=0;i<3;i++)R(c,main,-3+i*3,-11+i%2*2,1,2);
 }else if(d.kind==='monkey'){box(c,main,-6,-18,12,16);box(c,cream,-3,-13,6,9);box(c,main,-8,-29,16,12);box(c,cream,-5,-26,10,7);R(c,ink,-3,-24,2,2);R(c,ink,2,-24,2,2);box(c,main,-10,-25,3,5);box(c,main,8,-25,3,5);box(c,main,-10,-16+stride,4,12);box(c,main,7,-16-stride,4,12);box(c,cream,-10,-5+stride,4,3);box(c,cream,7,-5-stride,4,3);box(c,main,-5,-2+stride,4,5);box(c,main,3,-2-stride,4,5);for(const [tx,ty] of [[-8,-9],[-14,-12],[-17,-18],[-15,-24],[-10,-26]])box(c,main,tx,ty,4,6);
 }else{const cat=d.kind==='cat',coon=d.kind==='raccoon',big=id==='tiger'||id==='rottweiler';const w=big?27:23;
  box(c,main,-13,-17,w,12);R(c,cream,-10,-6,w-6,3);R(c,'#ffffff28',-11,-17,w-4,2);for(const [lx,sy] of [[-10,1],[-4,-1],[5,1],[11,-1]]){box(c,main,lx,-6+stride*sy,3,8);R(c,cream,lx,-1+stride*sy,3,2)}
  box(c,main,6,-25,13,13);box(c,cream,15,-17,7,5);R(c,ink,21,-17,2,2);R(c,'#ead8b4',8,-23,7,2);R(c,id==='husky'?'#8dd7ef':cat?'#b3d36d':ink,15,-21,2,2);R(c,paper,15,-21,1,1);
  if(cat||id==='husky'||id==='shiba'){P(c,ink,[[7,-24],[7,-32],[12,-26]]);P(c,main,[[8,-25],[8,-30],[11,-26]]);P(c,ink,[[15,-25],[19,-32],[19,-24]]);P(c,main,[[16,-25],[18,-30],[18,-25]]);R(c,'#d8a08b',9,-28,1,2)}else box(c,coon?main:'#65442e',6,-25,4,9);
  if(cat||coon){for(let i=0;i<4;i++){box(c,coon&&i%2?cream:main,-17-i*3,-14-i*3+Math.round(Math.sin(t*4)*i/2),4,5)}if(id==='tiger'||id==='tabby')for(let i=0;i<5;i++){R(c,'#46332b',-10+i*5,-16,2,7);R(c,'#46332b',8+i%3*3,-24+i%2*2,1,3)}if(coon){R(c,cream,8,-22,12,4);R(c,ink,14,-21,2,2)}}else{P(c,cream,[[-14,-13],[-22,-17+Math.round(Math.sin(t*8)*3)],[-19,-20],[-12,-16]]);box(c,'#b6635b',5,-13,12,2);R(c,'#e9c264',12,-11,2,3)}
 }
 c.restore();
}
function facade(c,b){const {x,y,w,h,name}=b;const district=root.NightshiftWorld.districtStyle(x,y),brick=district==='south'?'#bc8a68':'#abb8ac';c.save();
 // Corners, individual masonry joints and depth of window reveals.
 for(const xx of [x+3,x+w-8]){R(c,'#152c3b88',xx+3,y+h-62,3,61);for(let i=0;i<8;i++)R(c,brick,xx,y+h-61+i*7,4,2)}
 for(const xx of [x+13,x+w-75]){R(c,'#0a223b66',xx,y+h-6,62,3);R(c,'#f3d8ab88',xx,y+h-7,62,1);R(c,'#ecdbbf33',xx+2,y+h-32,1,23)}
 // Roof hatch / ducts / drains have a clear shared light direction.
 box(c,'#3c5a68',x+w-47,y+71,23,14);R(c,'#acc0b8',x+w-44,y+73,17,1);for(let i=0;i<3;i++)R(c,'#152d3c',x+w-42+i*5,y+76,2,6);
 R(c,'#18323f',x+w-7,y+23,3,h-31);R(c,'#92a7a1',x+w-7,y+23,1,h-31);
 if(name==='APARTMENTS'){for(let i=0;i<3;i++){box(c,'#a27c5b',x+22+i*28,y+57,22,13);R(c,'#427758',x+24+i*28,y+54,18,5);R(c,'#93b384',x+25+i*28,y+53,6,3)}R(c,'#f1d2a4',x+w/2-13,y+h-26,1,20);R(c,'#c5a06b',x+w/2-21,y+h+6,42,1)}
 if(name==='BANK'){prop(c,'atm',x+w-36,y+h+14);for(const xx of [x+83,x+w-92])R(c,paper,xx+1,y+h-29,2,24);R(c,'#a9c5c1',x+w/2-8,y+h-24,16,14);R(c,'#172f3a',x+w/2-1,y+h-24,2,14)}
 if(name==='DINER'){prop(c,'flowercart',x+w+17,y+h-13);box(c,'#d78a53',x+20,y+30,25,22);R(c,'#f5dfb5',x+25,y+34,12,9);R(c,'#f5dfb5',x+36,y+36,5,4);R(c,'#644234',x+23,y+45,18,2)}
 if(name==='CORNER SHOP'){prop(c,'vending',x+w+17,y+h-10);R(c,'#c86359',x+16,y+h-14,12,7);R(c,'#ebcf8d',x+31,y+h-17,8,10)}
 if(name==='GARAGE'||name==='WAREHOUSE'){prop(c,'barrel',x+w+20,y+h-7);prop(c,'crate',x+w+42,y+h-15);for(let i=0;i<5;i++)R(c,'#eee1bf',x+14+i*7,y+h-30,2,20)}
 if(name==='CLUB'){box(c,'#c563a0',x+20,y+25,35,27);R(c,'#eed6b9',x+24,y+30,27,2);R(c,'#512d63',x+24,y+35,27,12);R(c,'#d999c0',x+26,y+38,5,6);R(c,'#89c6c4',x+35,y+36,5,8);R(c,'#ead49f',x+44,y+40,5,4)}
 c.restore();
}
function carDetail(c,v){if(!v)return;c.save();c.translate(Math.round(v.x),Math.round(v.y));c.rotate(v.angle||0);const van=v.model==='VAN',cx=String(v.model).startsWith('CX:');
 const active=typeof player!=='undefined'&&player.car===v,brake=active&&((typeof mouseFire!=='undefined'&&mouseFire)||(typeof firing!=='undefined'&&firing)||(typeof keys!=='undefined'&&keys[' ']));
 if(brake){R(c,'#ff6d55',van?-27:-28,-11,3,6);R(c,'#ff6d55',van?-27:-28,5,3,6)}
 if(active&&(v.speed||0)<-.1)R(c,'#fcf4d6',van?-27:-28,-3,2,6);
 // Fine edge highlights never enlarge collision silhouettes.
 for(const yy of [-14,13]){R(c,'#e3e7d833',-20,yy,12,1);R(c,'#122e3a55',6,yy,15,1)}
 R(c,'#162c37',22,-4,2,8);for(let i=0;i<4;i++)R(c,'#bcc6ba',23,-3+i*2,1,1);R(c,'#e5dbc2',-26,-2,1,4);
 if(van){R(c,'#b8c9bd55',-19,-8,19,1);R(c,'#152c3633',-18,7,20,1)}else if(!cx){R(c,'#bfdcdb66',8,-8,1,9);R(c,'#152e3b55',-8,7,15,1)}
 c.restore();
}
const api={prop,weapon,pet,facade,carDetail,weaponForms};root.NightshiftDetailedArt=api;
if(!root.document)return;
const W0=root.NightshiftWorld,S=root.NightshiftSprites;
const building=W0.building;W0.building=function(b){const r=building.apply(this,arguments);if(root.NightshiftScene?.visible({x:b.x+b.w/2,y:b.y+b.h/2},{...camera,width:W,height:H},250))facade(g,b);return r};
const person=S.person;S.person=function(p,isPlayer,options={}){const armed=isPlayer&&options.weapon!==false&&!options.noWeapon&&(root.NightshiftInventory?.state.pocket.pistol>0);const r=person.call(this,p,isPlayer,armed?{...options,weapon:false}:options);if(armed){const id=root.NightshiftWeapons?.state.equipped||'pistol';g.save();g.translate(Math.round(p.x),Math.round(p.y));g.rotate(p.angle||0);box(g,root.NightshiftHome?.profile?.shirt||'#669baa',4,-3,8,5);box(g,root.NightshiftHome?.profile?.skin||'#ca9873',10,-2,4,4);g.restore();weapon(g,id,p.x+Math.cos(p.angle||0)*13,p.y+Math.sin(p.angle||0)*13,p.angle||0,root.NightshiftWeapons?.skinPalette?.(id)||{},root.NightshiftWeapons?.state.mods?.[id]||[])}return r};
const car=S.car;S.car=function(v){const r=car.apply(this,arguments);carDetail(g,v);return r};
let streets=null;const road=W0.road;W0.road=function(){const r=road.apply(this,arguments);if(!streets){streets=document.createElement('canvas');streets.width=world.w;streets.height=world.h;const ctx=streets.getContext('2d');if(ctx)for(let x=0;x<world.w;x+=440)for(let y=0;y<world.h;y+=340){const district=W0.districtStyle(x+100,y+100);prop(ctx,'hydrant',x+73,y+127);prop(ctx,district==='docks'?'barrel':'mailbox',x+74,y+223);if(district==='south')prop(ctx,'dumpster',x+300,y+285);if(district==='west')prop(ctx,'flowercart',x+151,y+292)}}if(streets)g.drawImage(streets,0,0);return r};
// Use public pet position/state; retain Claude adoption, feeding, movement, perks and zone logic.
function activePet(ctx,t){const pets=root.NightshiftPets;if(pets?.state.active)pet(ctx,pets.state.active,pets.petPos(),t)}
const encounter=root.NightshiftEncounters?.draw;if(encounter)root.NightshiftEncounters.draw=function(){const r=encounter.apply(this,arguments);if(!player.car)activePet(g,performance.now()/1000);return r};
root.NightshiftZones?.addCompanion(()=>root.NightshiftPets?.state.active?{y:root.NightshiftPets.petPos().y,draw:(ctx,t)=>activePet(ctx,t)}:null);
// Present simultaneous toast/goal/level notices one at a time, without touching awards.
const notices=['#toast','#glFlash','#skFlash'].map(s=>document.querySelector(s));
if(notices.every(n=>n&&typeof n.cloneNode==='function')&&root.MutationObserver){
 const panel=document.createElement('div');panel.id='livingNotice';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');document.body.append(panel);
 const queue=[],seen=new Map();let showing=false;
 function showNext(){if(!queue.length){showing=false;panel.className='';return}showing=true;panel.textContent=queue.shift();panel.className='on';setTimeout(()=>{panel.className='';setTimeout(showNext,220)},2400)}
 function collect(){for(const node of notices){const on=node.id==='toast'?Number(node.style.opacity)>0:node.classList.contains('on'),text=(node.innerText||node.textContent||'').trim();if(on&&text&&seen.get(node)!==text){seen.set(node,text);if(queue.length>=10)queue.shift();queue.push(text);if(!showing)showNext()}if(!on)seen.delete(node)}}
 const observer=new MutationObserver(collect);for(const node of notices)observer.observe(node,{attributes:true,attributeFilter:['class','style'],childList:true,subtree:true,characterData:true});collect();
}
})(globalThis);
