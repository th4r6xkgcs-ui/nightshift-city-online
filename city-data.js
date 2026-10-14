/* Pure city geometry for client rendering and future server collision checks. */
(function(root){'use strict';
// v0.57 (Claude): the city grew from 5x5 to 15x15 blocks. The original core keeps its exact layout at the top-left.
const WIDTH=6600,HEIGHT=5100;
// v0.58 (Claude): outside the core, each region has its own building mix and footprint (towers downtown, small
// houses with lawns in the suburbs, wide sheds in the industrial east). Bounds match world.js REGIONS.
const REGION_MIX=[
 {bx:[5,9],by:[0,4],names:['BANK','APARTMENTS','CLOTHING','CLUB','BANK','CORNER SHOP','APARTMENTS'],fp:[80,66,280,190]},
 {bx:[10,14],by:[0,4],names:['APARTMENTS','APARTMENTS','CLOTHING','DINER','APARTMENTS','BANK'],fp:[110,95,220,140]},
 {bx:[0,4],by:[5,9],names:['DINER','CORNER SHOP','APARTMENTS','GARAGE','CLUB','DINER'],fp:[80,75,240,170]},
 {bx:[5,9],by:[5,9],names:['CORNER SHOP','CLOTHING','DINER','CORNER SHOP','CLOTHING','DINER','BANK'],fp:[80,75,240,170]},
 {bx:[10,14],by:[5,9],names:['WAREHOUSE','GARAGE','WAREHOUSE','WAREHOUSE','GARAGE','DINER'],fp:[80,85,280,160]},
 {bx:[0,4],by:[10,14],names:['APARTMENTS','APARTMENTS','CORNER SHOP','DINER','APARTMENTS','GARAGE'],fp:[110,95,220,140]},
 {bx:[5,9],by:[10,14],names:['CLUB','APARTMENTS','CORNER SHOP','CLUB','DINER','APARTMENTS','GARAGE'],fp:[80,75,240,170]},
 {bx:[10,14],by:[10,14],names:['WAREHOUSE','GARAGE','DINER','WAREHOUSE','CORNER SHOP','WAREHOUSE'],fp:[80,85,280,160]}];
// v0.63 (Claude): open lots break up the outer grid so blocks stop repeating. Each region has its own lot kinds;
// about 45% of its blocks get one (deterministic hash). The building footprint changes to make room and always
// ends above the bottom sidewalk (<= y+245). modern-city.js paints the lot into the baked ground.
const LOTS={DOWNTOWN:['plaza','twin','plaza'],'THE HEIGHTS':['park','court','twin'],'OLD TOWN':['parking','gas','court'],'MARKET DISTRICT':['plaza','parking','twin'],IRONWORKS:['parking','gas','parking'],FAIRVIEW:['park','court','park'],'THE FLATS':['court','gas','parking'],HARBOR:['parking','gas','plaza']};
const MIX_NAMES=['DOWNTOWN','THE HEIGHTS','OLD TOWN','MARKET DISTRICT','IRONWORKS','FAIRVIEW','THE FLATS','HARBOR'];
const lotHash=(bx,by,k)=>{let h=(bx*374761393+by*668265263+k*2147483647)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
function lotFor(bx,by){const mix=regionMix(bx,by);if(!mix||lotHash(bx,by,1)>=0.45)return null;const L=LOTS[MIX_NAMES[REGION_MIX.indexOf(mix)]];return L[Math.floor(lotHash(bx,by,2)*L.length)]}
// footprints [dx,dy,w,h] relative to the block corner
const LOT_FP={parking:[[205,75,150,170]],plaza:[[80,70,240,115]],court:[[80,75,145,170]],park:[[175,170,90,75]],gas:[[240,80,110,110]],twin:[[80,75,112,170],[212,75,112,170]]};
function regionMix(bx,by){return REGION_MIX.find(r=>bx>=r.bx[0]&&bx<=r.bx[1]&&by>=r.by[0]&&by<=r.by[1])||null}
function createBuildings(width=WIDTH,height=HEIGHT){const world={w:width,h:height},buildings=[];for(let x=0;x<world.w;x+=440)for(let y=0;y<world.h;y+=340){if(x<100||y<100)continue;const names=['APARTMENTS','CORNER SHOP','GARAGE','DINER','WAREHOUSE','CLOTHING','BANK','CLUB'];const bx=x/440|0,by=y/340|0,mix=x>=2200||y>=1700?regionMix(bx,by):null;const name=mix?mix.names[(bx*7+by*3)%mix.names.length]:names[(x/440*3+y/340|0)%names.length],fp=mix?.fp||[80,75,240,170],color=['#30465a','#475064','#3b4659','#485365'][(x/440+y/340)%4|0],lot=mix?lotFor(bx,by):null;
if(lot){LOT_FP[lot].forEach((f,i)=>buildings.push({x:x+f[0],y:y+f[1],w:f[2],h:f[3],name:lot==='gas'||lot==='park'?(lot==='park'?'DINER':'CORNER SHOP'):name,color,lot,lotPainted:i===0}));continue}
buildings.push({x:x+fp[0],y:y+fp[1],w:fp[2],h:fp[3],name,color})}
return buildings}
function layout(){return {version:1,width:WIDTH,height:HEIGHT,playerMargin:10,buildingPadding:9,spawn:{x:460,y:450},clinic:{x:440,y:340,radius:75},apartment:{x:880,y:680,radius:85},buildings:createBuildings().map((b,i)=>({id:'building-'+i,x:b.x,y:b.y,w:b.w,h:b.h,name:b.name,entrance:{x:b.x+b.w/2,y:b.y+b.h+12}}))}}
const api={WIDTH,HEIGHT,createBuildings,layout};root.NightshiftCityData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
