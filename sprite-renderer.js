/* Shared pixel silhouettes and directional poses; no physics or saved-state writes. */
(function(root){'use strict';
function rect(color,x,y,w,h){g.fillStyle=color;g.fillRect(x,y,w,h)}
function polygon(color,points){g.fillStyle=color;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill()}
function pose(p,isPlayer=false){const angle=Number.isFinite(p.angle)?p.angle:Math.atan2(p.dy||0,p.dx||0),moving=isPlayer?(typeof player!=='undefined'&&player.moving):p.moving===true;return {facing:((Math.round(angle/(Math.PI/4))%8)+8)%8,phase:moving?Math.floor((p.walkTicks||0)/5)%4:0,stride:moving?[0,3,0,-3][Math.floor((p.walkTicks||0)/5)%4]:0}}
function drawCar(v){
 root.NightshiftEnvironment?.headlights(v);g.save();g.translate(Math.round(v.x),Math.round(v.y));g.rotate(v.angle||0);
 const van=v.model==='VAN',compact=v.model==='COMPACT',color=v.color||'#75a5ac';
 polygon('#101d2855',[[-27,-12],[-18,-18],[20,-16],[30,-8],[30,15],[22,22],[-24,22],[-31,12]]);
 const roll=Math.abs(v.speed||0)>.1&&(Math.floor((typeof ticks==='number'?ticks:0)/3)%2===0);
 for(const x of [-18,15])for(const y of [-19,14]){rect('#111c25',x,y,9,5);rect('#616a6c',x+2,y+(roll?1:2),5,1)}
 const shape=van?[[-27,-14],[-23,-17],[22,-17],[27,-12],[27,12],[22,17],[-23,17],[-27,14]]:compact?[[-24,-10],[-18,-16],[15,-16],[26,-10],[27,9],[17,15],[-17,15],[-24,10]]:[[-28,-10],[-22,-16],[18,-16],[27,-10],[28,10],[18,16],[-22,16],[-28,10]];
 polygon('#182831',shape);g.save();g.scale(.94,.91);polygon(color,shape);g.restore();
 rect('#ffffff28',-20,-14,37,2);rect('#00000024',-23,11,43,3);rect('#152a33',-3,-19,7,3);rect('#152a33',-3,16,7,3);
 if(van){rect('#c3d0c022',-23,-12,26,24);rect('#213941',4,-12,9,24);rect('#8badb2',7,-10,5,20);rect(color,14,-11,8,22);rect('#ffffff28',-20,-9,20,2);rect('#00000020',-20,7,20,2);rect('#727e7755',-21,-5,1,9)}
 else{
  polygon('#142a36',[[-15,-10],[-9,-13],[8,-13],[14,-9],[14,9],[7,13],[-9,13],[-15,9]]);
  polygon('#7c9fa9',[[6,-11],[10,-9],[13,0],[10,9],[6,11]]);rect('#aac1bb',8,-8,2,11);
  polygon('#526f7d',[[-14,-8],[-10,-11],[-7,-10],[-7,10],[-10,11],[-14,8]]);
  rect(color,-5,-11,10,22);rect('#ffffff22',-4,-10,8,2);rect('#00000022',-4,7,8,3);
  rect('#ffffff28',16,-9,5,18);rect('#00000022',-23,-8,4,16);rect('#111f2a',compact?-20:-24,-9,2,18);
 }
 rect('#14232c',25,-5,3,10);rect('#596569',27,-4,1,8);rect('#e7e2ac',23,-11,3,6);rect('#e7e2ac',23,5,3,6);rect('#ffffff',24,-10,2,2);rect('#ffffff',24,6,2,2);
 const braking=typeof player!=='undefined'&&player.car===v&&((typeof firing!=='undefined'&&firing)||(typeof keys!=='undefined'&&keys[' ']));
 rect(braking?'#ff6d55':'#aa4644',van?-27:compact?-24:-28,-11,3,6);rect(braking?'#ff6d55':'#aa4644',van?-27:compact?-24:-28,5,3,6);rect('#d9d6bf',van?-27:compact?-24:-28,-3,2,6);
 if(Number.isFinite(v.condition)&&v.condition<65){rect('#24353b',17,-9,6,2);rect('#b0b5a077',20,-7,2,6);rect('#283238',-10,11,10,2)}
 if(Number.isFinite(v.condition)&&v.condition<25){rect('#172932',18,3,6,7);rect('#747d77',19,4,3,3)}g.restore();
}
function drawPerson(p,isPlayer=false,options={}){
 const profile=isPlayer?root.NightshiftHome?.profile:null,shirt=profile?.shirt||p.color||'#799f98',skin=profile?.skin||'#c79977',hair=profile?.hair||'#29262b',pants=profile?.pants||'#273543',shoes=profile?.shoes||'#c5cbbb';
 const {facing,stride}=pose(p,isPlayer),front=facing>=1&&facing<=3,back=facing>=5&&facing<=7,side=facing===0||facing===4,look=facing===0||facing===1||facing===7?2:facing===3||facing===4||facing===5?-2:0;
 g.save();g.translate(Math.round(p.x),Math.round(p.y));g.fillStyle='#101d2855';g.beginPath();g.ellipse(1,11,10,4,0,0,Math.PI*2);g.fill();
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
 if(isPlayer&&options.weapon!==false&&(!root.NightshiftInventory||root.NightshiftInventory.state.pocket.pistol>0)){g.save();g.rotate(p.angle||0);rect(shirt,4,-3,7,5);rect(skin,10,-2,4,3);rect('#152a35',13,-3,10,4);rect('#929c9b',14,-3,9,2);rect('#20343d',14,0,3,5);g.restore()}
 if(!isPlayer&&Number.isFinite(p.hp)&&p.hp<(p.maxHp||40)){rect('#182832',-13,-29,26,4);rect('#dd9884',-13,-29,26*Math.max(0,p.hp/(p.maxHp||40)),3)}g.restore();
}
root.NightshiftSprites={car:drawCar,person:drawPerson,pose};
})(globalThis);
