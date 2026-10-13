/* Codex-authored facial planes and haircut silhouettes; same anchors in every wardrobe view. */
(function(r){'use strict';const W=r.NightshiftWardrobeData;if(!W)return;
const tone=(h,n)=>{const v=parseInt(h.slice(1),16);return '#'+[v>>16&255,v>>8&255,v&255].map(x=>Math.max(0,Math.min(255,x+n)).toString(16).padStart(2,'0')).join('')};
function draw(c,o,q){
 const x=q.headX,y=q.headY,skin=W.SKINS[o.skin],hair=W.HAIR_COLORS[o.hairColor],dark=tone(skin,-32),light=tone(skin,18),hd=tone(hair,-9),hl=tone(hair,30),ink='#17181e',back=q.back,side=q.profile,s=q.sx>0?1:-1;
 const R=(h,xx,yy,w,hg)=>{c.fillStyle=h;c.fillRect(x+xx,y+yy,w,hg)};
 const P=(h,pts)=>{c.fillStyle=h;c.beginPath();pts.forEach(([xx,yy],i)=>i?c.lineTo(x+xx,y+yy):c.moveTo(x+xx,y+yy));c.closePath();c.fill()};
 const L=(h,xx,yy,tx,ty,w=.25)=>{c.strokeStyle=h;c.lineWidth=w;c.beginPath();c.moveTo(x+xx,y+yy);c.lineTo(x+tx,y+ty);c.stroke()};
 // Clear old head/hair without removing the shoulders or torso. Long hair drapes over clothing afterwards.
 c.clearRect(x-13,y-11,26,16);
 const face=side?[[-3.6,-3.4],[1.7,-4.3],[3.8,-2.1],[4.4,.2],[3.8,.65],[3.7,2.5],[1.4,4.7],[-1.8,4.3],[-3.8,1.3]].map(([xx,yy])=>[xx*s,yy]):[[-3.7,-3.5],[-1.5,-4.6],[1.9,-4.5],[3.8,-2.6],[4.1,.3],[3.3,2.7],[1.2,4.6],[-1.5,4.6],[-3.3,2.7],[-4.1,.2]];
 R(dark,-1.35,3.6,2.7,3);R(skin,-1.1,4.1,1.65,2.5);P(skin,face);
 if(side){P(dark,[[-3.6*s,-2.7],[-1.3*s,-1.1],[-1.1*s,2.7],[1.4*s,4.7],[-1.8*s,4.3],[-3.8*s,1.3]]);P(light,[[.8*s,-3.4],[2.8*s,-2.3],[2.8*s,-.7],[.5*s,-1.8]]);R(tone(skin,-14),-2.6*s-.4,.1,.8,1.7);L(light,-2.6*s,.2,-2.6*s,1.1)}
 else{P(dark,[[2.9,-2.2],[4.1,.3],[3.3,2.7],[1.2,4.6],[.8,3.5],[2.2,1.1]]);P(light,[[-2.9,-2.5],[-1.2,-3.9],[1.3,-3.8],[.7,-2],[-2.1,-.8]]);L(tone(skin,-18),-2.4,3.2,1.2,3.7,.35)}
 if(!back){
  const eyes=side?[[2.25*s,-.5]]:[[-1.9+q.sx*.8,-.4],[1.6+q.sx*.8,-.4]];
  for(const [ex,ey]of eyes){L(tone(hair,9),ex-.65,ey-1,ex+.55,ey-.85,.35);L(dark,ex-.75,ey,ex+.75,ey,.4);if(!q.blink){R('#282526',ex-.3+q.sx*.2,ey,.5,.5);R('#ded6c5',ex-.65,ey+.1,.25,.25)}}
  if(side){L(light,3.1*s,-.2,3.9*s,.25);R(dark,3.7*s-.15,.7,.4,.3);L(tone(skin,-40),2*s,2.5,3.1*s,2.3,.3)}
  else{L(light,-.15+q.sx,.1,-.15+q.sx,1.25,.35);R(dark,.1+q.sx,1.25,.55,.25);L(tone(skin,-43),-.8+q.sx,2.65,.65+q.sx,2.65,.25);L(light,-.5+q.sx,3.05,.5+q.sx,3.05,.25)}
  if(o.facial!=='none'){const ox=side?1.5*s:q.sx;
   if(['beard','goatee'].includes(o.facial)){P(hd,[[ox-2.5,2],[ox-1.5,3.8],[ox,4.4],[ox+1.6,3.6],[ox+2.4,1.8],[ox+1.7,3],[ox,3.5],[ox-1.7,3]]);if(o.facial==='goatee')R(hair,ox-.65,3.1,1.3,1.25);else for(let i=0;i<5;i++)L(hl,ox-1.8+i*.75,3.1,ox-1.7+i*.7,3.7)}
   if(['mustache','goatee','beard'].includes(o.facial))L(hair,ox-1.3,2.1,ox+1.2,2.1,.45);
   if(o.facial==='stubble')for(const [xx,yy]of [[-2.5,2.3],[-2,3.1],[-1,3.7],[0,3.9],[1,3.7],[2,3.1]])R(tone(skin,-30),xx+ox,yy,.3,.3);
  }
 }
 const st=o.hair;
 const crop=height=>P(hair,[[-4,-.8],[-4.2,-2.7],[-3,-4.9],[-.6,-5.5],[2.4,-5.1],[4.1,-3.4],[3.9,-1.4],[2.1,-height],[-1.8,-height]]);
 if(st==='buzz'){P(tone(skin,-25),[[-3.8,-2],[-3.1,-4],[0,-4.7],[2.7,-4],[3.8,-2],[2.9,-2.4],[0,-3.9],[-2.7,-2.5]]);for(let i=0;i<5;i++)R(tone(hair,25),-2.3+i, -3.8+(i%2)*.3,.35,.3)}
 else if(st==='short'||st==='fade'){crop(st==='fade'?3.3:2.4);P(hd,[[-3.7,-2.8],[-1.3,-4],[2.8,-4.2],[3.8,-3],[1.4,-2.7],[-1.4,-2.8]]);for(let i=0;i<5;i++)L(hl,-2.8+i*1.05,-4.2+(i%2)*.25,-2+i*.85,-3.5+(i%2)*.25);if(st==='fade'){R(tone(skin,-20),-3.9,-2.2,.6,1.4);R(tone(skin,-18),3.25,-2.1,.55,1.3)}}
 else if(st==='curly'||st==='afro'){
  const rad=st==='afro'?5.5:4.3;P(hd,st==='afro'?[[-5.5,-.3],[-6,-2.5],[-5.1,-5.7],[-2.9,-7.5],[0,-8.1],[3,-7.3],[5.3,-5.3],[6,-2],[4.9,.1],[3,-1.5],[-3,-1.5]]:[[-rad,-1.1],[-rad-.4,-3],[-rad+.7,-5.4],[-2.3,-6.5],[.8,-6.8],[4.4,-5.7],[rad+.3,-3],[rad,-.4],[3,-1.5],[-2.9,-1.7]]);if(back)P(hair,[[-3.8,-2.2],[3.8,-2.2],[3.5,1.7],[1.2,2.9],[-2.1,2.8],[-3.6,1.5]]);
  const curls=[...(st==='afro'?[[-4.8,-3.1],[-3.7,-5.7],[-.1,-6.8],[3.6,-5.7],[4.8,-3.2]]:[]),[-3.5,-4.1],[-1.7,-5.1],[.3,-5.3],[2.5,-4.9],[3.5,-3.3],[-2.7,-2.2],[-.8,-3.1],[1.4,-3.3]];for(const [xx,yy]of curls){P(hair,[[xx-.8,yy],[xx-.7,yy-.8],[xx+.5,yy-.9],[xx+1,yy-.2],[xx+.6,yy+.7],[xx-.4,yy+.6]]);L(hl,xx-.45,yy-.6,xx+.35,yy-.7)}
 }
 else if(['locs','braids','long','ponytail','bun'].includes(st)){
  crop(back?0:2.8);const count=st==='braids'?7:st==='locs'?5:st==='long'?6:0;
  for(let i=0;i<count;i++){const xx=-3.8+i*7.5/Math.max(1,count-1),length=st==='long'?7.4:st==='locs'?6.7:6.1;if(!back&&i!==0&&i!==count-1)continue;if(side&&!back&&Math.sign(xx)===s)continue;P(i%2?hd:hair,[[xx-.65,-2.7],[xx+.65,-2.5],[xx+.85,length-.6],[xx+.2,length],[xx-.55,length-.4]]);for(let yy=-2;yy<length;yy+=st==='braids'?1.15:2)L(hl,xx-.15,yy,xx+.35,yy+.4)}
  if(st==='bun'){P(hd,[[-1.9,-5],[-2.3,-6.3],[-1.2,-7.5],[1,-7.3],[2,-6],[1.6,-4.9]]);L(hl,-1.1,-6.8,.5,-6.9,.4)}
  if(st==='ponytail'&&(back||side)){const xx=back?0:-s*4;P(hd,[[xx-1,-1.3],[xx+1,-1.3],[xx+1.7,4.8],[xx+.3,7.1],[xx-.6,5.1]]);L(hl,xx,-.8,xx+.5,4.6,.4);R('#897568',xx-.9,-1.1,1.7,.45)}
  if(st==='long'&&!back)P(hair,[[-3.9,-3.5],[-.8,-4.9],[3.6,-3.9],[3.8,-2],[1.5,-2.5],[-.7,-1.2],[-2.9,-1.9]]);
 }
 else if(st==='mohawk'){R(tone(skin,-16),-3.7,-2.5,7.3,.8);P(hair,[[-1.4,-2],[-1.2,-6.5],[.1,-7.5],[1.4,-6.5],[1.6,-2.1]]);for(let i=0;i<4;i++)L(hl,-.7,-6+i,.6,-6.3+i,.3)}
 if(back&&['buzz','short','fade','bun','ponytail'].includes(st)){P(st==='buzz'?tone(skin,-25):hair,[[-3.9,-2.5],[3.9,-2.5],[3.4,1.7],[1.8,2.8],[-2.3,2.7],[-3.5,1.4]]);L(hl,-2.7,-1.9,-2.2,1.1)}
 const piece=p=>W.ITEM[p.id].colors[p.color]||W.ITEM[p.id].colors[0];
 if(o.outer?.hood){const h=piece(o.outer);P(tone(h,-22),[[-5.5,2.5],[-5.9,-3],[-4.1,-6.3],[0,-7.3],[4.8,-5.7],[5.6,-1.8],[5.2,3.2],[3.6,4.6],[3.9,-2.4],[1.2,-4.4],[-2.6,-3.8],[-3.8,1.9],[-2.9,4.6]]);if(back)P(h,[[-4.8,-3.5],[-2.8,-5.9],[1.9,-6.3],[4.4,-4.2],[4.4,2.5],[1.9,4.6],[-2.8,4.2],[-4.6,1.4]]);L(tone(h,30),-4.7,-3.8,-3.5,-5.5,.4)}
 if(o.head){const h=piece(o.head),hi=tone(h,28),dk=tone(h,-24),id=o.head.id;
  if(id==='cap'){P(h,[[-4.8,-1.8],[-4.5,-4.2],[-2.3,-5.4],[1.4,-5.5],[4.4,-3.9],[4.8,-1.4]]);L(dk,-.5,-5.2,.3,-1.8);L(hi,-3.5,-4,-1.5,-4.8);const brim=o.head.back?-q.sx||-1:q.sx||1;P(dk,[[-4.7,-1.8],[4.5,-1.7],[5.6+brim*2,-.8],[2.4+brim*2,-.2],[-4.6,-.8]]);if(!back&&!o.head.back)R(hi,-.7,-3.4,1.25,.8)}
  else if(id==='beanie'){P(h,[[-4.9,-.6],[-4.7,-3.5],[-2.9,-5.2],[0,-5.8],[3.4,-4.9],[4.8,-2.3],[4.7,-.6]]);R(dk,-4.6,-1.5,9.1,1.2);for(let xx=-3.6;xx<4;xx+=.9)L(hi,xx,-3.6,xx,-1.5,.25);R(hi,2.5,-1.3,.8,.6)}
  else if(id==='durag'){P(h,[[-4.1,-1.8],[-4,-4],[-1,-5.3],[2.8,-4.4],[4.1,-2.2],[3.9,-1.2]]);L(hi,-2.5,-3.5,1,-4.5,.5);if(back||side){P(dk,[[-3.6,-.8],[-2.1,-.7],[-3.1,6.2],[-4.2,5.7]]);L(hi,-3.1,.1,-3.6,4.6)}}
  else{const fed=id==='fedora';P(h,[[-4.4,-2],[-3.4,-5.5],[-1,-5.9],[.1,-5.1],[2.8,-5.6],[4.2,-2]]);R(dk,-4,-2.8,8,1);P(h,[[-6.5,-1.9],[-4.1,-2.4],[4.2,-2.3],[6.2,-1.1],[4.7,-.4],[-4.7,-.5],[-6.5,-1.1]]);L(hi,-5.3,-1.5,3.4,-1.8,.35);if(!fed)for(let xx=-3;xx<4;xx+=1.5)R(hi,xx,-2.1,.4,.25)}
 }
 if(o.face&&!back){const h=piece(o.face),id=o.face.id;
  if(id==='skimask'){P(h,face);const ex=side?2.1*s:-1.6;R(skin,ex-.8,-.7,side?1.6:4.6,1);R(ink,ex,-.4,.5,.45);if(!side)R(ink,1.5,-.4,.5,.45);R(skin,side?2*s:-.6,2.3,1.3,.5);L(tone(h,32),-2.5,-2.1,-2,1.5,.3)}
  else if(id==='bandana'){P(h,[[-3.7,.8],[3.8,.8],[2.9,3.5],[0,4.1],[-3.1,3.2]]);L(tone(h,40),-2.2,1.5,.8,2.8,.35);R(tone(h,40),1.6,1.6,.4,.4)}
  else{const lenses=side?[[2*s,-.65]]:[[-1.8,-.65],[1.8,-.65]];for(const [ex,ey]of lenses){R(h,ex-1,ey-.35,2,.95);R(id==='glasses'?tone(skin,-12):'#263b48',ex-.7,ey-.15,1.35,.5);L('#94aeb3',ex-.55,ey-.1,ex+.25,ey-.1)}if(!side)L(h,-.6,-.5,.6,-.5,.25)}
 }
}
r.NightshiftPremiumHeads=Object.freeze({draw});
})(globalThis);
