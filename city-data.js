/* Pure city geometry for client rendering and future server collision checks. */
(function(root){'use strict';
// v0.57 (Claude): the city grew from 5x5 to 15x15 blocks. The original core keeps its exact layout at the top-left.
const WIDTH=6600,HEIGHT=5100;
function createBuildings(width=WIDTH,height=HEIGHT){const world={w:width,h:height},buildings=[];for(let x=0;x<world.w;x+=440)for(let y=0;y<world.h;y+=340){if(x<100||y<100)continue;const names=['APARTMENTS','CORNER SHOP','GARAGE','DINER','WAREHOUSE','CLOTHING','BANK','CLUB'];const name=names[(x/440*3+y/340|0)%names.length];buildings.push({x:x+80,y:y+75,w:240,h:170,name,color:['#30465a','#475064','#3b4659','#485365'][(x/440+y/340)%4|0]})}
return buildings}
function layout(){return {version:1,width:WIDTH,height:HEIGHT,playerMargin:10,buildingPadding:9,spawn:{x:460,y:450},clinic:{x:440,y:340,radius:75},apartment:{x:880,y:680,radius:85},buildings:createBuildings().map((b,i)=>({id:'building-'+i,x:b.x,y:b.y,w:b.w,h:b.h,name:b.name,entrance:{x:b.x+b.w/2,y:b.y+b.h+12}}))}}
const api={WIDTH,HEIGHT,createBuildings,layout};root.NightshiftCityData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
