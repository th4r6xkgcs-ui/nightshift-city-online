/* Small collision-grid routing and swept projectile queries. */
(function(root){
'use strict';
function trace(a,b,blocked,radius=0){const distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(distance/4));for(let i=0;i<=steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;if(blocked(x,y))return {x,y,t,kind:'wall'};if(radius&&blocked(x+radius,y)||radius&&blocked(x-radius,y)||radius&&blocked(x,y+radius)||radius&&blocked(x,y-radius))return {x,y,t,kind:'wall'}}return null}
function segmentCircle(a,b,target,radius){const dx=b.x-a.x,dy=b.y-a.y,fx=a.x-target.x,fy=a.y-target.y,A=dx*dx+dy*dy;if(fx*fx+fy*fy<=radius*radius)return 0;if(!A)return null;const B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-radius*radius,D=B*B-4*A*C;if(D<0)return null;const t=(-B-Math.sqrt(D))/(2*A);return t>=0&&t<=1?t:null}
function route(start,goal,blocked,width=(root.NightshiftCityData?.WIDTH||2200),height=(root.NightshiftCityData?.HEIGHT||1700),cell=40){
 if(!trace(start,goal,blocked,8))return [{x:goal.x,y:goal.y}];
 // v0.57: the city is big now; search a window around start/goal instead of the whole map
 const ox=Math.max(0,Math.floor((Math.min(start.x,goal.x)-480)/cell)*cell),oy=Math.max(0,Math.floor((Math.min(start.y,goal.y)-400)/cell)*cell),ex=Math.min(width,Math.max(start.x,goal.x)+480),ey=Math.min(height,Math.max(start.y,goal.y)+400);
 const cols=Math.ceil((ex-ox)/cell),rows=Math.ceil((ey-oy)/cell),point=i=>({x:ox+(i%cols)*cell+cell/2,y:oy+Math.floor(i/cols)*cell+cell/2});
 const walk=new Map();function valid(i){if(i<0||i>=cols*rows)return false;if(!walk.has(i)){const p=point(i);walk.set(i,p.x<width-10&&p.y<height-10&&!trace(p,p,blocked,8))}return walk.get(i)}
 function nearest(p){const candidates=[];for(let i=0;i<cols*rows;i++)if(valid(i)){const q=point(i);candidates.push({i,d:Math.hypot(q.x-p.x,q.y-p.y)})}candidates.sort((a,b)=>a.d-b.d);for(const candidate of candidates)if(!trace(p,point(candidate.i),blocked,8))return candidate.i;return -1}
 const from=nearest(start),to=nearest(goal);if(from<0||to<0)return [];
 const queue=[from],parents=new Map([[from,-1]]);for(let head=0;head<queue.length&&!parents.has(to);head++){const at=queue[head],x=at%cols,y=Math.floor(at/cols);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;const next=ny*cols+nx;if(parents.has(next)||!valid(next)||trace(point(at),point(next),blocked,8))continue;parents.set(next,at);queue.push(next)}}
 if(!parents.has(to))return [];const path=[];for(let at=to;at!==-1;at=parents.get(at))path.push(point(at));path.reverse();path.push({x:goal.x,y:goal.y});return path;
}
root.NightshiftNavigation={trace,segmentCircle,route};
})(globalThis);
