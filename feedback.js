/* Bounded transient world effects; no save data or gameplay authority. */
(function(root){
'use strict';
const particles=[],labels=[],reticle={shot:0,hit:0};
function burst(x,y,kind='hit',angle=0){
 const color={hit:'#ffd79b',wall:'#afbdcd',muzzle:'#fff5b0',heal:'#78e7b5',dust:'#b6a392'}[kind]||'#ffd79b';
 for(let i=0;i<(kind==='muzzle'?4:7);i++){const a=angle+(Math.random()-.5)*(kind==='muzzle'?.7:6.28),speed=20+Math.random()*55;particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:kind==='muzzle'?.12:.45,color})}
 if(particles.length>160)particles.splice(0,particles.length-160);
}
function floating(x,y,text,color='#f6d17a'){labels.push({x,y,text:String(text).slice(0,30),color,life:1.1});if(labels.length>24)labels.shift()}
function shot(){reticle.shot=.1}function hit(){reticle.hit=.16}function tick(seconds){const dt=Math.max(0,Math.min(.2,Number.isFinite(seconds)?seconds:0));reticle.shot=Math.max(0,reticle.shot-dt);reticle.hit=Math.max(0,reticle.hit-dt);for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0)particles.splice(i,1)}for(let i=labels.length-1;i>=0;i--){labels[i].life-=dt;labels[i].y-=18*dt;if(labels[i].life<=0)labels.splice(i,1)}}
function draw(){if(!root.document)return;g.save();for(const p of particles){g.fillStyle=p.color;g.globalAlpha=Math.min(1,p.life*7);g.fillRect(p.x-2,p.y-2,4,4)}g.font='bold 12px monospace';g.textAlign='center';for(const label of labels){g.globalAlpha=Math.min(1,label.life*3);g.fillStyle='#08121c';g.fillText(label.text,label.x+1,label.y+1);g.fillStyle=label.color;g.fillText(label.text,label.x,label.y)}g.restore()}
function crosshair(x,y,status={}){if(!root.document||!Number.isFinite(x)||!Number.isFinite(y))return;const r=8+reticle.shot*25;g.save();g.strokeStyle=reticle.hit>0?'#95f0c5':status.reload!==null&&status.reload!==undefined?'#f3ca80':status.blocked?'#91a0b077':status.obstructed?'#edb587':'#e4f6ffb8';g.lineWidth=1.5;g.beginPath();g.arc(x,y,r,0,Math.PI*2);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){g.moveTo(x+dx*(r+3),y+dy*(r+3));g.lineTo(x+dx*(r+8),y+dy*(r+8))}g.stroke();if(Number.isFinite(status.reload)){g.beginPath();g.arc(x,y,r+5,-Math.PI/2,-Math.PI/2+Math.max(0,Math.min(1,status.reload))*Math.PI*2);g.stroke()}if(reticle.hit>0){g.beginPath();for(const [dx,dy] of [[1,1],[-1,1],[1,-1],[-1,-1]]){g.moveTo(x+dx*3,y+dy*3);g.lineTo(x+dx*6,y+dy*6)}g.stroke()}g.restore()}
root.NightshiftFeedback={shot,hit,crosshair,reticle,burst,floating,tick,draw,particles,labels};
})(globalThis);
