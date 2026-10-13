/* Small authored road-center graph. Final approaches are made on foot. */
(function(root){
'use strict';
// v0.57: the road grid covers the whole (bigger) city; built lazily because city-data.js loads after this file
let CW=2200,CH=1700;const XS=[],YS=[];function grid(){const w=root.NightshiftCityData?.WIDTH||2200,h=root.NightshiftCityData?.HEIGHT||1700;if(XS.length&&w===CW&&h===CH)return;CW=w;CH=h;XS.length=0;YS.length=0;XS.push(32);for(let x=440;x<CW-100;x+=440)XS.push(x);YS.push(32);for(let y=340;y<CH-100;y+=340)YS.push(y)}
function snap(pos,blocked){grid();
 const candidates=XS.map(x=>({x,y:Math.max(32,Math.min(CH-32,pos.y))})).concat(YS.map(y=>({x:Math.max(32,Math.min(CW-32,pos.x)),y})));
 candidates.sort((a,b)=>Math.hypot(pos.x-a.x,pos.y-a.y)-Math.hypot(pos.x-b.x,pos.y-b.y));
 return candidates.find(p=>!root.NightshiftNavigation.trace(pos,p,blocked,8))||null;
}
function route(start,goal,blocked){grid();
 const a=snap(start,blocked),b=snap(goal,blocked);if(!a||!b)return[];
 const nodes=[];for(const x of XS)for(const y of YS)nodes.push({x,y});const first=nodes.length;nodes.push(a);const last=nodes.length;nodes.push(b);
 const cost=nodes.map(()=>Infinity),parent=nodes.map(()=>-1),visited=new Set();cost[first]=0;
 for(let n=0;n<nodes.length;n++){
  let at=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(at<0||cost[i]<cost[at]))at=i;
  if(at<0||cost[at]===Infinity)break;if(at===last)break;visited.add(at);
  for(let i=0;i<nodes.length;i++){
   if(visited.has(i)||i===at)continue;const p=nodes[at],q=nodes[i];
   if(!((p.x===q.x&&XS.includes(p.x))||(p.y===q.y&&YS.includes(p.y))))continue;
   const next=cost[at]+Math.hypot(p.x-q.x,p.y-q.y);if(next<cost[i]){cost[i]=next;parent[i]=at}
  }
 }
 if(cost[last]===Infinity)return[];const path=[];for(let i=last;i>=0;i=parent[i])path.push({...nodes[i]});path.reverse();
 return path.filter((p,i)=>i===0||Math.hypot(p.x-path[i-1].x,p.y-path[i-1].y)>.1);
}
root.NightshiftRoads={XS,YS,snap,route};
})(globalThis);
