/* Short-range local traffic braking. Authored routes remain unchanged. */
(function(root){'use strict';
function clearance(actor,objects){
 const ux=Math.cos(actor.angle),uy=Math.sin(actor.angle);let nearest=Infinity;
 for(const object of objects){
  if(object===actor)continue;const dx=object.x-actor.x,dy=object.y-actor.y;
  const forward=dx*ux+dy*uy,lateral=Math.abs(dx*uy-dy*ux);
  const relative=(object.angle??actor.angle)-actor.angle;
  const length=object.halfLength??27,width=object.halfWidth??18;
  const longitudinal=object.radius??(Math.abs(Math.cos(relative))*length+Math.abs(Math.sin(relative))*width);
  const lateralExtent=object.radius??(Math.abs(Math.sin(relative))*length+Math.abs(Math.cos(relative))*width);
  // A perpendicular lane is relevant only when it enters this actor's corridor.
  if(forward>=0&&lateral<18+lateralExtent)nearest=Math.min(nearest,forward-27-longitudinal);
 }
 return nearest;
}
function speed(actor,objects,dt,red=false){
 const seconds=Number.isFinite(dt)?Math.max(0,Math.min(.04,dt)):0;
 const gap=clearance(actor,objects);
 const desired=red?0:Math.min(actor.pace,Math.sqrt(Math.max(0,gap-12)*120));
 const current=Number.isFinite(actor.velocity)?Math.max(0,actor.velocity):0;
 const change=(desired<current?180:45)*seconds;
 const velocity=current+Math.max(-change,Math.min(change,desired-current));
 // Hard safety cap keeps the next movement outside an obstacle even at a turn.
 return seconds?Math.min(velocity,Math.max(0,gap-8)/seconds):velocity;
}
function overlaps(a,b){
 for(const angle of [a.angle,a.angle+Math.PI/2,b.angle,b.angle+Math.PI/2]){
  const x=Math.cos(angle),y=Math.sin(angle),gap=Math.abs((b.x-a.x)*x+(b.y-a.y)*y);
  const extent=c=>27*Math.abs(Math.cos(c.angle-angle))+18*Math.abs(Math.sin(c.angle-angle));
  if(gap>=extent(a)+extent(b))return false;
 }
 return true;
}
root.NightshiftTrafficSafety={clearance,speed,overlaps};
})(globalThis);
