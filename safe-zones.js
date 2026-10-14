/* Clinic protection applies only while not wanted. Pursuit cannot be escaped here. */
(function(root){
'use strict';
const CLINIC={x:440,y:340,radius:75};
function inside(pos){return Math.hypot(pos.x-CLINIC.x,pos.y-CLINIC.y)<=CLINIC.radius}
function protectedPlayer(player){return player.heat<=0&&inside(player)}
root.NightshiftSafeZones={CLINIC,inside,protected:protectedPlayer};if(!root.document)return;
root.NightshiftSafeZones.draw=()=>{g.save();g.strokeStyle=player.heat>0?'#b2ac7877':'#7cdeb588';g.lineWidth=3;g.beginPath();g.arc(CLINIC.x,CLINIC.y,CLINIC.radius,0,Math.PI*2);g.stroke();g.fillStyle='#9be7c8';g.font='bold 11px monospace';g.textAlign='center';g.fillText('WEST END CLINIC',CLINIC.x,CLINIC.y-CLINIC.radius-12);g.restore()};
})(globalThis);
