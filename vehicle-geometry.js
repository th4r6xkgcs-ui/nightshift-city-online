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
// Swept segment against the oriented body; zero-length and inside starts are valid.
function segmentHit(start,end,car){if(!car)return null;const r=rectangle(car);if(![start?.x,start?.y,end?.x,end?.y,r.x,r.y,r.angle,r.halfLength,r.halfWidth].every(Number.isFinite)||r.halfLength<=0||r.halfWidth<=0)return null;const [u,v]=axes(r.angle),local=p=>[(p.x-r.x)*u.x+(p.y-r.y)*u.y,(p.x-r.x)*v.x+(p.y-r.y)*v.y],a=local(start),b=local(end);let enter=0,exit=1;for(const [axis,extent] of [[0,r.halfLength],[1,r.halfWidth]]){const d=b[axis]-a[axis];if(Math.abs(d)<1e-10){if(Math.abs(a[axis])>extent)return null;continue}let lo=(-extent-a[axis])/d,hi=(extent-a[axis])/d;if(lo>hi)[lo,hi]=[hi,lo];enter=Math.max(enter,lo);exit=Math.min(exit,hi);if(enter>exit)return null}return enter>=0&&enter<=1?enter:null}
function traceCover(start,end,cars,blocked,ignore=null){if(![start?.x,start?.y,end?.x,end?.y].every(Number.isFinite))return null;let impact=root.NightshiftNavigation.trace(start,end,blocked);for(const car of cars){if(car===ignore)continue;const t=segmentHit(start,end,car);if(t!==null&&(!impact||t<impact.t))impact={t,x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t,kind:'car',car}}return impact}
root.NightshiftVehicleGeometry={segmentHit,traceCover,rectangle,overlaps,carOverlap,corners,blocked,circleOverlap,canTravel};
})(globalThis);
