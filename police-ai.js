/* Police goals depend on observed or reported locations, never hidden movement. */
(function(root){'use strict';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function goal(officer,subject,visible,incident,now,clear){
 if(visible){officer.memory={x:subject.x,y:subject.y};officer.memoryAt=now;officer.mode='pursue';officer.searchGoal=null;return officer.memory}
 if(incident&&(!officer.memory||incident.at>(officer.memoryAt??-Infinity))){officer.memory={x:incident.x,y:incident.y};officer.memoryAt=incident.at;officer.mode='investigate';officer.searchGoal=null;officer.nextRoute=0}
 if(!officer.memory)return null;
 if(officer.mode==='pursue')officer.mode='investigate';
 if(officer.mode!=='search'&&distance(officer,officer.memory)>32)return officer.memory;
 officer.mode='search';
 if(now>=(officer.nextSearch||0)&&(!officer.searchGoal||distance(officer,officer.searchGoal)<14)){
  officer.searchGoal=null;for(let n=0;n<8;n++){const index=(officer.searchIndex||0)+n,a=index*Math.PI/4,p={x:officer.memory.x+Math.cos(a)*80,y:officer.memory.y+Math.sin(a)*80};if(clear(p)){officer.searchGoal=p;officer.searchIndex=index+1;break}}
  officer.nextSearch=now+1500;officer.nextRoute=0;
 }return officer.searchGoal||officer.memory;
}
root.NightshiftPoliceAI={goal};
})(globalThis);
