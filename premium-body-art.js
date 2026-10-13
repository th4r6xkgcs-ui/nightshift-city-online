/* Articulated anatomy over the existing wardrobe. Feet, hands, collision and item ownership stay fixed. */
(function(r){'use strict';const C=r.NightshiftCharacters,W=r.NightshiftWardrobeData;if(!C||!W)return;const original=C.compose,baseGeom=C.geom;
const shade=(h,n)=>{const v=parseInt(h.slice(1),16);return '#'+[v>>16&255,v>>8&255,v&255].map(x=>Math.max(0,Math.min(255,x+n)).toString(16).padStart(2,'0')).join('')};
const color=p=>p?(W.ITEM[p.id].colors[p.color]||W.ITEM[p.id].colors[0]):'#717a88';
function geom(o,d,a,f,hold){const g=baseGeom(o,d,a,f,hold),phase=Number(f)*Math.PI*2/(C.ANIMS[a]||8);
g.arms=g.arms.map(A=>({...A,ex:A.x+(A.hx-A.x)*.46+A.s*(hold?1.7:a==='run'?1.1:.65),ey:A.y+(A.hy-A.y)*.48-(a==='run'?1:.15)}));
g.legs=g.legs.map(L=>({...L,kx:L.kx??(L.hx+L.fx)/2+L.s*.55+Math.sin(phase+L.s)*g.sx*.5,ky:L.ky??(L.hy+L.fy)/2-.65+(a==='walk'||a==='run'?Math.cos(phase+L.s)*.45:0)}));return g}
function compose(c,o,d,a,f,hold=''){
original(c,o,d,a,f,hold);const g=geom(o,d,a,f,hold),skin=W.SKINS[o.skin],cloth=o.outer&&o.outer.id!=='vest'?o.outer:o.top,sc=color(cloth),ink='#171d28';
const P=(col,p)=>{c.fillStyle=col;c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill()},line=(col,x,y,xx,yy,w=.35)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke()};
const limb=(col,x,y,xx,yy,w,v)=>{const dx=xx-x,dy=yy-y,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;P(col,[[x+nx*w/2,y+ny*w/2],[xx+nx*v/2,yy+ny*v/2],[xx-nx*v/2,yy-ny*v/2],[x-nx*w/2,y-ny*w/2]])};
if(!o.bag){c.save();c.globalCompositeOperation='destination-out';for(const s of [-1,1])P('#000',[[g.cx+s*(g.SW/2+.7),g.shY-.9],[g.cx+s*2.5,g.shY-.9],[g.cx+s*(g.SW/2+.7),g.shY+1.3]]);c.restore()}
// Replace straight lower legs with hip/knee/ankle segments, preserving each planted foot.
const hem=o.outer?.id==='trench'?g.hipY+8:['shorts','skirt'].includes(o.bottom.id)?g.hipY+6.5:g.hipY+2.6;
for(const L of g.legs){const sy=Math.max(hem,L.hy+2.5);c.clearRect(Math.min(L.hx,L.fx)-2.5*g.bw,sy,Math.abs(L.hx-L.fx)+5*g.bw,Math.max(0,L.fy-sy-1.65))}
for(const L of g.legs.slice().sort((a,b)=>a.near-b.near)){const col=['shorts','skirt'].includes(o.bottom.id)?skin:color(o.bottom),w=3.7*g.bw,sy=Math.max(hem,L.hy+2.5),t=Math.min(1,(sy-L.hy)/(L.fy-L.hy||1)),xx=L.hx+(L.kx-L.hx)*Math.min(1,t*2);

 if(sy<L.ky){limb(col,xx,sy,L.kx,L.ky,w,w*.85);limb(col,L.kx,L.ky,L.fx,L.fy-1.6,w*.85,w*.67)}else limb(col,xx,sy,L.fx,L.fy-1.6,w*.85,w*.67);
 line(shade(col,27),xx-.8,sy+.2,L.kx-.65,Math.max(sy+.4,L.ky),.45);line(shade(col,-30),L.kx+.65,Math.max(sy,L.ky),L.fx+.7,L.fy-2,.5);
 if(sy<L.ky)line(shade(col,-24),L.kx-1.1,L.ky,L.kx+.8,L.ky+.2,.45);
}
// Elbows give sleeves a taper rather than a rectangle. Far profile arms remain behind the torso.
for(const A of g.arms){c.save();if(g.profile&&A.s===-1){c.beginPath();c.rect(g.sx>0?-25:g.cx+g.SW/2-.4,-30,25,65);c.clip()}
 const edge=g.cx+A.s*(g.SW/2+.6),clearX=A.s<0?Math.min(A.x,A.hx)-3:edge;c.clearRect(clearX,A.y+.7,A.s<0?Math.max(0,edge-clearX):Math.max(0,Math.max(A.x,A.hx)+3-edge),Math.max(0,A.hy-A.y+2.5));
 const outer=o.outer&&o.outer.id!=='vest'?o.outer:null,short=!outer&&!['longsleeve','buttonup'].includes(o.top.id)||!!o.top.rolled,none=!outer&&['tank','jersey'].includes(o.top.id),col=outer?.id==='varsity'?'#e5dbc2':sc;
 limb(skin,A.x,A.y,A.ex,A.ey,2.7,2.25);limb(skin,A.ex,A.ey,A.hx,A.hy,2.25,1.55);
 if(!none){limb(col,A.x,A.y,A.ex,A.ey,outer?.id==='puffer'?4.1:3.35,short?3:2.8);if(!short)limb(col,A.ex,A.ey,A.hx,A.hy-1,2.8,2.1);line(shade(col,32),A.x-.6,A.y+.7,A.ex-.75,A.ey-.3,.45);line(shade(col,-28),A.ex+.8,A.ey,A.hx+.7,A.hy-1,.5);line(shade(col,-22),A.ex-1,A.ey-.4,A.ex+.6,A.ey+.25,.45);
 if(outer?.id==='track')line('#e9e5d8',A.x+A.s*.8,A.y+.5,A.hx+A.s*.7,A.hy-1,.35);
 if(outer?.id==='puffer')for(let k=1;k<4;k++){const t=k/4,x=A.x+(A.hx-A.x)*t,y=A.y+(A.hy-A.y)*t;line(shade(col,-28),x-1.4,y,x+1.2,y+.1,.35)}
 }
 const hand=o.gloves?color(o.gloves):skin;P(hand,[[A.hx-1.1,A.hy-.5],[A.hx+.65,A.hy-.7],[A.hx+1.25,A.hy+.15],[A.hx+.75,A.hy+1.5],[A.hx-.7,A.hy+1.5],[A.hx-1.2,A.hy+.6]]);line(shade(hand,24),A.hx-.65,A.hy-.1,A.hx+.4,A.hy,.35);line(shade(hand,-23),A.hx+.65,A.hy+.5,A.hx+.55,A.hy+1.15,.25);
 if(o.gloves?.id==='fingerless')limb(skin,A.hx-.5,A.hy+.65,A.hx+.4,A.hy+1.35,1.4,1.1);
 if(['watch','chainwatch'].includes(o.jewelry?.id)&&A.s===(g.sx>=0?-1:1)){line(color(o.jewelry),A.hx-1,A.hy-1.2,A.hx+1,A.hy-1.2,.75);line('#e2e5de',A.hx-.3,A.hy-1.3,A.hx+.3,A.hy-1.3,.35)}
 c.restore();
}
// Sloped shoulder caps and restrained cloth tension over the existing item-specific chest panels.
for(const A of g.arms){if(!o.bag&&!g.profile&&!['tank','jersey'].includes(cloth.id)){limb(sc,A.x,g.shY+1.3,A.x+A.s*.5,g.shY+2.3,2.5,3);line(shade(sc,28),A.x-.6,g.shY+1.1,A.x+A.s*.2,g.shY+1.7,.35)}}
}
C.compose=compose;C.geom=geom;r.NightshiftPremiumBodies=Object.freeze({geom,compose});
})(globalThis);
