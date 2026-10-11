/* Visible actor depth order, independent of simulation and persistence. */
(function(root){'use strict';
function visible(entity,view,margin=130){return [view?.x,view?.y,view?.width,view?.height,view?.zoom,margin].every(Number.isFinite)&&view.zoom>0&&view.width>=0&&view.height>=0&&margin>=0&&Number.isFinite(entity?.x)&&Number.isFinite(entity?.y)&&entity.x>=view.x-margin&&entity.y>=view.y-margin&&entity.x<=view.x+view.width/view.zoom+margin&&entity.y<=view.y+view.height/view.zoom+margin}
function order(entries,view){
 // One pass avoids two short-lived arrays every animation frame on mobile.
 const result=[];
 for(let i=0;i<entries.length;i++){const entry=entries[i];if(visible(entry.entity,view))result.push({...entry,index:i})}
 return result.sort((a,b)=>a.entity.y-b.entity.y||a.index-b.index);
}
function draw(entries,view){for(const entry of order(entries,view)){if(entry.kind==='cafe-canopy')root.NightshiftWorld?.cafeCanopy(entry.entity);else if(entry.kind==='sign')root.NightshiftWorld?.signTop(entry.entity);else if(entry.kind==='awning')root.NightshiftWorld?.awningTop(entry.entity);else if(entry.kind==='tree-crown')root.NightshiftWorld?.treeCrown(entry.entity);else if(entry.kind==='palm-crown')root.NightshiftWorld?.palmCrown(entry.entity);else if(entry.kind==='car')root.NightshiftSprites.car(entry.entity);else{root.NightshiftSprites.person(entry.entity,entry.kind==='player');if(entry.kind==='street-contact')root.NightshiftGangLife?.badge(entry.entity);if(entry.kind==='crew-member')root.NightshiftCrewOps?.badge(entry.entity);if(entry.kind==='ped')root.NightshiftStreetLife?.draw(entry.entity,root.NightshiftStreetLife.now||0);if(entry.kind==='officer'){g.fillStyle='#b3cdf9';g.fillRect(entry.entity.x-6,entry.entity.y-22,12,4)}}}}
root.NightshiftScene={visible,order,draw};
})(globalThis);
