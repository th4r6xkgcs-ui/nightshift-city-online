/* Client vehicle footprints and swept motion. No network authority lives here. */
(function(root){'use strict';
const LENGTH=28,WIDTH=18;
const axes=angle=>[{x:Math.cos(angle),y:Math.sin(angle)},{x:-Math.sin(angle),y:Math.cos(angle)}];
function rectangle(car){return {x:car.x,y:car.y,angle:car.angle||0,halfLength:car.halfLength??LENGTH,halfWidth:car.halfWidth??WIDTH}}
function overlaps(a,b){
 const aa=axes(a.angle),ba=axes(b.angle);
 const extent=(r,rs,n)=>r.halfLength*Math.abs(rs[0].x*n.x+rs[0].y*n.y)+r.halfWidth*Math.abs(rs[1].x*n.x+rs[1].y*n.y);
 for(const n of [...aa,...ba]){const gap=Math.abs((b.x-a.x)*n.x+(b.y-a.y)*n.y);if(gap>=extent(a,aa,n)+extent(b,ba,n)-1e-8)return false}
 return true;
}
function carOverlap(a,b){return overlaps(rectangle(a),rectangle(b))}
function corners(car){const r=rectangle(car),[u,v]=axes(r.angle);return [-1,1].flatMap(i=>[-1,1].map(j=>({x:r.x+i*u.x*r.halfLength+j*v.x*r.halfWidth,y:r.y+i*u.y*r.halfLength+j*v.y*r.halfWidth})))}
function blocked(car,buildings,world){
 if(world&&corners(car).some(p=>p.x<0||p.y<0||p.x>world.w||p.y>world.h))return true;
 const body=rectangle(car);
 return buildings.some(b=>overlaps(body,{x:b.x+b.w/2,y:b.y+b.h/2,angle:0,halfLength:b.w/2+9,halfWidth:b.h/2+9}));
}
function circleOverlap(point,car,radius=9){
 const r=rectangle(car),[u,v]=axes(r.angle),dx=point.x-r.x,dy=point.y-r.y;
 const x=dx*u.x+dy*u.y,y=dx*v.x+dy*v.y;
 const ex=Math.max(0,Math.abs(x)-r.halfLength),ey=Math.max(0,Math.abs(y)-r.halfWidth);
 return ex*ex+ey*ey<radius*radius;
}
function canTravel(from,to,buildings,others=[],world){
 const delta=Math.atan2(Math.sin(to.angle-from.angle),Math.cos(to.angle-from.angle));
 const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/4),Math.ceil(Math.abs(delta)/(Math.PI/90)));
 // Invalid or unbounded movements are rejected rather than doing unlimited work.
 if(!Number.isFinite(steps)||steps>1000)return false;
 for(let i=1;i<=steps;i++){const t=i/steps,car={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,angle:from.angle+delta*t};if(blocked(car,buildings,world)||others.some(other=>carOverlap(car,other)))return false}
 return true;
}
root.NightshiftVehicleGeometry={rectangle,overlaps,carOverlap,corners,blocked,circleOverlap,canTravel};
})(globalThis);
