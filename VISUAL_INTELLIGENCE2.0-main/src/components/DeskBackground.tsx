/* eslint-disable */
// @ts-nocheck
'use client';
/** Original desk illustration, rendered on demand inside the hero.
 * No scroll or pointer listeners and no idle animation loop.
 * Geometry and original palette are retained; resize/visibility/font changes
 * invalidate a single frame. The canvas never receives pointer events.
 */
import { useEffect, useRef } from 'react';

type Props = {
  accentSelector?: string; inkSelector?: string; sectionSelector?: string; endSelector?: string;
  darkSelector?: string; accentDarkSelector?: string; zIndex?: number;
};

export default function DeskBackground({
  accentSelector = 'h1 em, h1 i, h1 .italic, h1 span:last-child',
  inkSelector = 'h1',
  sectionSelector = '[data-desk]',
  endSelector = '[data-desk-end]',
  darkSelector = '[data-bg="dark"]',
  accentDarkSelector = '[data-bg="dark"] em, [data-bg="dark"] i, [data-bg="dark"] .italic',
  zIndex = -1,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return initDeskBackground(canvas, { accentSelector, inkSelector, sectionSelector, endSelector, darkSelector, accentDarkSelector });
  }, [accentSelector, inkSelector, sectionSelector, endSelector, darkSelector, accentDarkSelector]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

/* ======================= tiny 3D engine ======================= */
var TAU = Math.PI * 2, WHITE = [255, 255, 255];
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rgb(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')'; }
function cl(x, a, b) { return x < a ? a : x > b ? b : x; }
function sm(a, b, x) { x = cl((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
/* ---------- vectors ---------- */
function add(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function mul(a,s){return [a[0]*s,a[1]*s,a[2]*s];}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function len(a){return Math.sqrt(dot(a,a));}
function nrm(a){var l=len(a)||1;return [a[0]/l,a[1]/l,a[2]/l];}
function lerp(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function rot(p,rx,ry,rz){
  var x=p[0],y=p[1],z=p[2],c,s,t;
  if(rx){c=Math.cos(rx);s=Math.sin(rx);t=y*c-z*s;z=y*s+z*c;y=t;}
  if(ry){c=Math.cos(ry);s=Math.sin(ry);t=x*c+z*s;z=-x*s+z*c;x=t;}
  if(rz){c=Math.cos(rz);s=Math.sin(rz);t=x*c-y*s;y=x*s+y*c;x=t;}
  return [x,y,z];
}
function xf(F,fn){return F.map(function(f){var g={};for(var k in f)g[k]=f[k];g.v=f.v.map(fn);return g;});}

/* ---------- mesh builders ---------- */
function grid(o,u,v,nu,nv,m,e,x){
  var out=[],i,j,a,b,c,d;
  for(i=0;i<nu;i++)for(j=0;j<nv;j++){
    a=add(o,add(mul(u,i/nu),mul(v,j/nv)));b=add(a,mul(u,1/nu));d=add(a,mul(v,1/nv));c=add(b,mul(v,1/nv));
    var f={v:[a,b,c,d],m:m,e:e};if(x)for(var k in x)f[k]=x[k];out.push(f);
  }
  return out;
}
function box(c,s,m,div,e,o){
  o=o||{};div=div||[1,1,1];var hx_=s[0]/2,hy=s[1]/2,hz=s[2]/2,skip=o.skip||[];
  var D={
    '+y':[[-hx_,hy,-hz],[2*hx_,0,0],[0,0,2*hz],div[0],div[2]],
    '-y':[[-hx_,-hy,-hz],[2*hx_,0,0],[0,0,2*hz],div[0],div[2]],
    '+z':[[-hx_,-hy,hz],[2*hx_,0,0],[0,2*hy,0],div[0],div[1]],
    '-z':[[-hx_,-hy,-hz],[2*hx_,0,0],[0,2*hy,0],div[0],div[1]],
    '+x':[[hx_,-hy,-hz],[0,0,2*hz],[0,2*hy,0],div[2],div[1]],
    '-x':[[-hx_,-hy,-hz],[0,0,2*hz],[0,2*hy,0],div[2],div[1]]
  };
  var F=[];
  for(var k in D){if(skip.indexOf(k)>=0)continue;var d=D[k];F=F.concat(grid(d[0],d[1],d[2],d[3],d[4],m,e,o.x));}
  var rx=o.rx||0,ry=o.ry||0,rz=o.rz||0;
  return xf(F,function(p){return add(rot(p,rx,ry,rz),c);});
}
function loft(a,b,ra,rb,n,m,rings,e,o){
  o=o||{};rings=rings||1;
  var ax=nrm(sub(b,a)),hint=o.hint||[0,0,1],u=cross(ax,hint);
  if(len(u)<1e-3){u=cross(ax,[1,0,0]);}
  u=nrm(u);var v=nrm(cross(ax,u));
  var A=Array.isArray(ra)?ra:[ra,ra],B=Array.isArray(rb)?rb:[rb,rb];
  var R=[],k,i,j;
  for(k=0;k<=rings;k++){
    var q=k/rings,c=lerp(a,b,q),ru=A[0]+(B[0]-A[0])*q,rv=A[1]+(B[1]-A[1])*q,row=[];
    for(i=0;i<n;i++){var th=i/n*TAU;row.push(add(c,add(mul(u,Math.cos(th)*ru),mul(v,Math.sin(th)*rv))));}
    R.push(row);
  }
  var F=[];
  for(k=0;k<rings;k++)for(i=0;i<n;i++){j=(i+1)%n;F.push({v:[R[k][i],R[k][j],R[k+1][j],R[k+1][i]],m:m,e:e,bias:o.bias||0});}
  if(o.caps!==false){F.push({v:R[0].slice(),m:m,e:e,bias:o.bias||0});F.push({v:R[rings].slice(),m:m,e:e,bias:o.bias||0});}
  return F;
}
function sphere(c,r,lat,lon,m,e,o){
  o=o||{};var sc=o.sc||[1,1,1],t0=o.t0||0,t1=o.t1==null?Math.PI:o.t1,p0=o.p0||0,p1=o.p1==null?TAU:o.p1;
  var rows=[],i,j,full=Math.abs(p1-p0-TAU)<1e-6,cols=full?lon:lon+1;
  for(i=0;i<=lat;i++){
    var th=t0+(t1-t0)*i/lat,rr=Math.sin(th),y=Math.cos(th),row=[];
    for(j=0;j<cols;j++){var ph=p0+(p1-p0)*j/lon;row.push([c[0]+r*sc[0]*rr*Math.cos(ph),c[1]+r*sc[1]*y,c[2]+r*sc[2]*rr*Math.sin(ph)]);}
    rows.push(row);
  }
  var F=[];
  for(i=0;i<lat;i++)for(j=0;j<lon;j++){var j2=full?(j+1)%lon:j+1;F.push({v:[rows[i][j],rows[i][j2],rows[i+1][j2],rows[i+1][j]],m:m,e:e});}
  return F;
}
function ext(pts,d,m,e){
  var n=pts.length,F=[],i,j;
  F.push({v:pts.map(function(p){return [p[0],p[1],d/2];}),m:m,e:e});
  F.push({v:pts.map(function(p){return [p[0],p[1],-d/2];}).reverse(),m:m,e:e});
  for(i=0;i<n;i++){j=(i+1)%n;F.push({v:[[pts[i][0],pts[i][1],d/2],[pts[j][0],pts[j][1],d/2],[pts[j][0],pts[j][1],-d/2],[pts[i][0],pts[i][1],-d/2]],m:m,e:e});}
  return F;
}
function decal(pts,z,m,bias,e){return {v:pts.map(function(p){return [p[0],p[1],z];}),m:m,e:e==null?.4:e,bias:bias};}
function rrect(cx,cy,w,h,r,seg){
  var pts=[],cs=[[cx+w/2-r,cy+h/2-r,0],[cx-w/2+r,cy+h/2-r,Math.PI/2],[cx-w/2+r,cy-h/2+r,Math.PI],[cx+w/2-r,cy-h/2+r,1.5*Math.PI]];
  cs.forEach(function(c){for(var i=0;i<=seg;i++){var a=c[2]+i/seg*Math.PI/2;pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]);}});
  return pts;
}
function circ(cx,cy,r,n){var p=[];for(var i=0;i<n;i++){var a=i/n*TAU;p.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}return p;}
function ik(S,H,l1,l2,hint){
  var d=sub(H,S),D=Math.min(len(d),l1+l2-1e-3),dn=nrm(d);
  var a=(l1*l1-l2*l2+D*D)/(2*D),h=Math.sqrt(Math.max(0,l1*l1-a*a));
  var pd=sub(hint,mul(dn,dot(hint,dn)));pd=nrm(pd);
  return add(add(S,mul(dn,a)),mul(pd,h));
}

/* ---------- thought props (local space, face +z, ~1 unit) ---------- */
var NAMES=['PROMPT','QUALITY','INTENT','OUTPUT','CONTEXT','REFINE','4 STAGES','WIN'];
function propPrompt(){
  var F=ext(rrect(0,.1,1.12,.7,.12,4),.1,'paper',.55);
  F=F.concat(ext([[-.34,-.25],[-.06,-.25],[-.4,-.52]],.1,'paper',.55));
  var z=.056;
  [[.2,.82],[.06,.62],[-.08,.7]].forEach(function(r,i){
    var y=r[0],w=r[1];F.push(decal([[-.46,y+.03],[-.46+w,y+.03],[-.46+w,y-.03],[-.46,y-.03]],z,i===0?'accent':'ink',.3,.1));
  });
  F.push(decal([[.3,-.01],[.34,-.01],[.34,-.15],[.3,-.15]],z,'accent',.35,.1));
  return F;
}
function propStar(){
  var pts=[],i;for(i=0;i<10;i++){var r=i%2?.25:.56,a=-Math.PI/2+i/10*TAU;pts.push([Math.cos(a)*r,-Math.sin(a)*r]);}
  pts=pts.map(function(p){return [p[0],-p[1]];});
  return ext(pts,.13,'accent',.5);
}
function propTarget(){
  var F=loft([0,0,-.04],[0,0,.04],.56,.56,22,'paper',1,.5);
  F.push(decal(circ(0,0,.4,22),.045,'accent',.1,.4));
  F.push(decal(circ(0,0,.25,22),.05,'paper',.2,.4));
  F.push(decal(circ(0,0,.1,18),.055,'accent',.3,.4));
  return F;
}
function propImage(){
  var F=box([0,0,0],[1,.74,.07],'paper',[1,1,1],.5);
  var z=.037;
  F.push(decal([[-.43,-.3],[.43,-.3],[.43,.3],[-.43,.3]],z,'ink',.1,.1));
  F.push(decal([[-.43,-.3],[-.15,.06],[0,-.1],[.17,.12],[.43,-.3]],z+.002,'paper',.2,.1));
  F.push(decal(circ(.22,.17,.07,12),z+.003,'accent',.3,.1));
  return F;
}
function propLayers(){
  var F=[];
  [[-.3,'paper'],[0,'paper'],[.3,'accent']].forEach(function(l){F=F.concat(box([0,l[0],0],[.98,.05,.62],l[1],[3,1,2],.5));});
  return xf(F,function(p){return rot(p,-.7,0,0);});
}
function propLoop(){
  var F=[],N=14,a0=.7,a1=TAU-.5,R=.4,i;
  for(i=0;i<N;i++){
    var a=a0+(a1-a0)*i/N,b=a0+(a1-a0)*(i+1)/N;
    F=F.concat(loft([Math.cos(a)*R,Math.sin(a)*R,0],[Math.cos(b)*R,Math.sin(b)*R,0],.06,.06,6,'paper',1,.5,{caps:false}));
  }
  var ea=a1,tp=[Math.sin(ea),-Math.cos(ea),0],P=[Math.cos(ea)*R,Math.sin(ea)*R,0];
  F=F.concat(loft(sub(P,mul(tp,.02)),add(P,mul(tp,.26)),.17,0,8,'accent',1,.5,{hint:[0,0,1]}));
  return F;
}
function propStages(){
  var F=[],i,h=[.28,.52,.76,1.0];
  for(i=0;i<4;i++)F=F.concat(box([-.45+i*.3,-.5+h[i]/2,0],[.26,h[i],.3],i===3?'accent':'paper',[1,2,1],.5));
  return xf(F,function(p){return [p[0],p[1]-.0,p[2]];});
}
function propWin(){
  var F=box([0,-.46,0],[.46,.08,.3],'paper',[1,1,1],.5);
  F=F.concat(loft([0,-.42,0],[0,-.1,0],.055,.055,8,'paper',1,.5));
  F=F.concat(loft([0,-.1,0],[0,.46,0],.13,.34,12,'accent',2,.5));
  [-1,1].forEach(function(s){F=F.concat(loft([s*.3,.36,0],[s*.46,.2,0],.035,.035,6,'paper',1,.5));F=F.concat(loft([s*.46,.2,0],[s*.28,.04,0],.035,.035,6,'paper',1,.5));});
  return F;
}
var PROPS=[propPrompt(),propStar(),propTarget(),propImage(),propLayers(),propLoop(),propStages(),propWin()].map(function(F){
  return F.map(function(f){
    var c=[0,0,0];f.v.forEach(function(p){c=add(c,p);});c=mul(c,1/f.v.length);
    var d=len(c)<1e-3?[0,1,0]:nrm(c);f.cd=d;return f;
  });
});
function propFaces(idx,pos,size,ry,u,t){
  var e=1-Math.pow(1-cl(u/.22,0,1),3);
  var a=sm(0,.1,u)*(1-sm(.86,1,u));
  var F=PROPS[idx],out=[];
  for(var i=0;i<F.length;i++){
    var f=F[i],off=mul(f.cd,(1-e)*(.5+.5*((i*37)%7)/7)),sc=size*(.7+.3*e);
    var g={m:f.m,e:f.e,bias:(f.bias||0)*size,al:a,v:f.v.map(function(p){return add(rot(add(p,off),0,ry,0),pos)})};
    // scale about pos
    g.v=g.v.map(function(p){return add(pos,mul(sub(p,pos),sc));});
    out.push(g);
  }
  return out;
}

function chair(F,noBack){
  F.push.apply(F,box([0,.44,.58],[.52,.06,.52],'pant',[3,1,3],.35));
  if(!noBack)F.push.apply(F,box([0,.84,.84],[.5,.56,.05],'pant',[3,3,1],.35,{rx:-.08}));
  F.push.apply(F,loft([0,.08,.58],[0,.41,.58],.028,.028,6,'ink',1,.3));
  for(var i=0;i<5;i++){var a=i/5*TAU+.3;F.push.apply(F,loft([0,.07,.58],[Math.cos(a)*.3,.04,.58+Math.sin(a)*.3],.022,.018,5,'ink',1,.3));}
}
function desk(F,o){
  o=o||{};
  F.push.apply(F,box([0,.75,-.2],[1.7,.05,.8],'paper',[8,1,4],.25,{skip:['-y']}));
  [-1,1].forEach(function(sx){[-1,1].forEach(function(sz){F.push.apply(F,box([sx*.78,.375,-.2+sz*.33],[.05,.75,.05],'paper',[1,3,1],.4));});});
  F.push.apply(F,box([.42,.795,-.02],[.06,.03,.1],'paper',[1,1,1],.35)); // mouse
  F.push.apply(F,loft([.64,.775,-.32],[.64,.875,-.32],.045,.045,10,'accent',1,.3)); // mug
  F.push.apply(F,box([-.55,.79,-.12],[.22,.012,.3],'ink',[1,1,1],.2,{ry:.2})); // notebook
}
function monitor(F,screenPost){
  F.push.apply(F,box([0,.81,-.45],[.3,.02,.2],'paper',[2,1,2],.4));
  F.push.apply(F,box([0,.87,-.5],[.06,.14,.04],'paper',[1,1,1],.4));
  F.push.apply(F,box([0,1.18,-.5],[.96,.56,.035],'paper',[1,1,1],.5));
  var z=-.5+.0175+.001;
  F.push({v:[[-.45,1.44,z],[.45,1.44,z],[.45,.92,z],[-.45,.92,z]],m:'screen',e:0,bias:.12,post:screenPost});
  F.push.apply(F,box([0,.80,-.02],[.46,.02,.15],'paper',[8,1,3],.3)); // keyboard
}
/* ---------- camera / projection ---------- */
function camYaw(c){
  var cp=Math.cos(c.pitch),sp=Math.sin(c.pitch),pos=[c.t[0]+c.dist*cp*Math.sin(c.yaw),c.t[1]+c.dist*sp,c.t[2]+c.dist*cp*Math.cos(c.yaw)];
  return camPos(pos,c.t,c.fov);
}
function camPos(pos,tgt,fov){
  var f=nrm(sub(tgt,pos)),r=nrm(cross(f,[0,1,0])),u=cross(r,f);
  return {pos:pos,f:f,r:r,u:u,fov:fov};
}
function makeProj(cam,W,H,zoom,ox,oy){
  var k=(H/2)/Math.tan(cam.fov/2)*zoom;
  return function(p){
    var d=sub(p,cam.pos),z=dot(d,cam.f);if(z<.05)return null;
    return {x:ox+k*dot(d,cam.r)/z,y:oy-k*dot(d,cam.u)/z,z:z,s:k/z};
  };
}
var LDIR=nrm([-.45,.85,.55]);
function normalOf(v){
  var n=[0,0,0],i;for(i=0;i<v.length;i++){var a=v[i],b=v[(i+1)%v.length];
    n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}
  return nrm(n);
}
function theme(t){var c=3.8,i=Math.floor(t/c);return {idx:((i%8)+8)%8,u:(t%c)/c};}
function propPlace(cam,pos,size,t,sway){
  var th=theme(t),ry=Math.atan2(cam.pos[0]-pos[0],cam.pos[2]-pos[2])+Math.sin(t*.7)*(sway==null?.3:sway);
  var bob=[pos[0],pos[1]+Math.sin(t*1.3)*.03,pos[2]];
  return propFaces(th.idx,bob,size,ry,th.u,t);
}
function bez(a,b,c,s){var p=lerp(a,b,s),q=lerp(b,c,s);return lerp(p,q,s);}
function label(ctx,txt,x,y,size,col,al,align,bg){
  ctx.save();ctx.font='500 '+size+'px Hanken Grotesk, sans-serif';try{ctx.letterSpacing=(size*.22)+'px';}catch(e){}
  if(bg){var w=ctx.measureText(txt).width,x0=align==='left'?x:align==='right'?x-w:x-w/2;ctx.fillStyle=rgb(PAPER,.88);ctx.fillRect(x0-4,y-size-1,w+8,size+7);}
  ctx.fillStyle=col;ctx.globalAlpha=al==null?1:al;ctx.textAlign=align||'center';ctx.fillText(txt,x,y);ctx.restore();
}
function dot_(ctx,x,y,r,fill,stroke,al){ctx.save();ctx.globalAlpha=al==null?1:al;ctx.beginPath();ctx.arc(x,y,r,0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}ctx.restore();}


/* ======================= palette-aware drawing ======================= */
var CUR = null; // palette used by the pass that is currently being drawn

function styleOf(f, shade, pal) {
  var sh = 1 - shade, fill, edge, d = pal.dark;
  switch (f.m) {
    case 'ink':
      fill = d ? mix(pal.paper, pal.ink, 0.5 + 0.3 * shade) : mix(pal.ink, WHITE, 0.19 * shade);
      edge = d ? rgb(pal.paper, 0.4) : rgb(pal.paper, f.e == null ? 0.18 : f.e * 0.5);
      break;
    case 'pant':
      fill = d ? mix(pal.paper, pal.ink, 0.28 + 0.2 * shade)
               : mix(mix(pal.ink, WHITE, 0.27), mix(pal.ink, WHITE, 0.55), shade);
      edge = d ? rgb(pal.paper, 0.4) : rgb(pal.paper, 0.2);
      break;
    case 'accent':
      fill = mix(mix(pal.acc, pal.ink, d ? 0.1 * sh : 0.3 * sh), mix(pal.acc, WHITE, 0.2), shade * 0.4);
      edge = d ? rgb(pal.ink, 0.3) : rgb(pal.paper, 0.28);
      break;
    case 'screen':
      fill = pal.screen; edge = rgb(pal.ink, 0.4);
      break;
    default:
      fill = mix(pal.obj, pal.ink, sh * (d ? 0.1 : 0.15));
      edge = rgb(pal.ink, (f.e == null ? 0.5 : f.e) * (d ? 0.7 : 1));
  }
  return { fill: rgb(fill), edge: edge };
}

var PT = ['A lighthouse at dusk,', 'drawn in cream ink with', 'one maroon lamp.'];
function screenUI(ctx, t, fonts) {
  var W = 880, H = 500, cream = CUR.cream, acc = CUR.acc2;
  ctx.fillStyle = rgb(CUR.screenBg); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = rgb(cream, 0.35);
  [0, 1, 2].forEach(function (i) { ctx.beginPath(); ctx.arc(34 + i * 24, 34, 7, 0, TAU); ctx.fill(); });
  ctx.font = '500 17px ' + fonts.sans; try { ctx.letterSpacing = '3px'; } catch (e) {}
  ctx.textAlign = 'right'; ctx.fillStyle = rgb(cream, 0.5);
  ctx.fillText('PROMPT STUDIO · STAGE 2 OF 4', W - 34, 40); ctx.textAlign = 'left';
  ctx.fillStyle = rgb(cream, 0.45); ctx.fillText('YOUR PROMPT', 48, 118);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  var total = PT.join('').length, n = Math.floor((t * 8) % (total + 26)), shown = 0, y = 186;
  ctx.font = 'italic 400 44px ' + fonts.serif; ctx.fillStyle = rgb(cream);
  PT.forEach(function (line) {
    var k = cl(n - shown, 0, line.length); ctx.fillText(line.slice(0, k), 48, y);
    if (n >= shown && n <= shown + line.length && Math.floor(t * 2.2) % 2 === 0) {
      var wd = ctx.measureText(line.slice(0, k)).width; ctx.fillStyle = rgb(acc); ctx.fillRect(48 + wd + 6, y - 34, 18, 40); ctx.fillStyle = rgb(cream);
    }
    shown += line.length; y += 62;
  });
  ctx.setLineDash([8, 8]); ctx.strokeStyle = rgb(cream, 0.35); ctx.lineWidth = 2; ctx.strokeRect(520, 96, 320, 230); ctx.setLineDash([]);
  ctx.font = '500 15px ' + fonts.sans; try { ctx.letterSpacing = '3px'; } catch (e) {}
  ctx.fillStyle = rgb(cream, 0.4); ctx.fillText('OUTPUT', 536, 124); try { ctx.letterSpacing = '0px'; } catch (e) {}
  for (var i = 0; i < 4; i++) { ctx.fillStyle = i < 2 ? rgb(acc) : rgb(cream, 0.25); ctx.fillRect(48 + i * 62, 430, 50, 8); }
}

function drawFloor(ctx, P, pal) {
  var R = 2.5, step = 0.25, N = Math.round(R / step), i, j;
  ctx.save(); ctx.lineWidth = 1;
  for (i = -N; i <= N; i++) for (j = -N; j < N; j++) {
    var segs = [[[i * step, 0, j * step + 0.05], [i * step, 0, (j + 1) * step + 0.05]],
                [[j * step, 0, i * step + 0.05], [(j + 1) * step, 0, i * step + 0.05]]];
    for (var s = 0; s < 2; s++) {
      var a = segs[s][0], b = segs[s][1], mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2 - 0.05;
      var r = Math.sqrt(mx * mx + mz * mz) / R, al = (1 - r) * (pal.dark ? 0.16 : 0.2);
      if (al <= 0.01) continue;
      var p = P(a), q = P(b); if (!p || !q) continue;
      ctx.strokeStyle = rgb(pal.ink, al); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
  }
  ctx.restore();
}

/* ======================= the person ======================= */
function person2(F, t, st) {
  var br = Math.sin(t * 1.5) * 0.004;
  var lean = 0.14 - 0.11 * st.th - 0.1 * st.ch;
  var pel = [0, 0.53, 0.6], sh = [0, 1.1 + br, 0.6 - lean * 0.9];
  var hc = [Math.sin(t * 0.8) * 0.006 * (1 - st.th), 1.325 + br + 0.012 * st.ch, 0.6 - lean * 1.5 + Math.sin(t * 2.1) * 0.004 * (1 - st.th)];
  hc[0] += 0.025 * st.th; hc[1] += 0.01 * st.th;
  F.push.apply(F, loft(pel, sh, [0.17, 0.1], [0.225, 0.115], 10, 'ink', 2, 0.4));
  F.push.apply(F, loft(add(sh, [0, 0.02, 0]), add(hc, [0, -0.09, 0]), 0.058, 0.05, 7, 'skin', 1, 0.45));
  F.push.apply(F, sphere(hc, 0.103, 6, 12, 'skin', 0.3, { sc: [0.95, 1.1, 1.0] }));
  F.push.apply(F, sphere(add(hc, [0, 0.005, 0.008]), 0.111, 5, 12, 'ink', 0.1, { sc: [0.98, 1.1, 1.02], t0: 0, t1: 0.95 }));
  F.push.apply(F, sphere(add(hc, [0, 0.005, 0.008]), 0.111, 5, 12, 'ink', 0.1, { sc: [0.98, 1.1, 1.02], t0: 0.95, t1: 1.95, p0: -0.45, p1: Math.PI + 0.45 }));
  F.push.apply(F, box(add(hc, [0, -0.012, -0.105]), [0.028, 0.04, 0.036], 'skin', [1, 1, 1], 0.4));
  [-1, 1].forEach(function (e) { F.push.apply(F, box(add(hc, [e * 0.036, 0.014, -0.1]), [0.014, 0.012, 0.012], 'ink', [1, 1, 1], 0.1)); });
  for (var s = -1; s <= 1; s += 2) {
    var hip = [s * 0.1, 0.52, 0.6], knee = [s * 0.12, 0.56, 0.14], ank = [s * 0.12, 0.1, 0.1];
    F.push.apply(F, loft(hip, knee, 0.08, 0.065, 8, 'pant', 2, 0.4));
    F.push.apply(F, loft(knee, ank, 0.062, 0.044, 8, 'pant', 2, 0.4));
    F.push.apply(F, box([s * 0.12, 0.045, 0.03], [0.09, 0.05, 0.23], 'ink', [1, 1, 2], 0.3));
    var S = [s * 0.215, sh[1] - 0.025, sh[2]];
    var wig = Math.sin(t * 9 + s * 2) * 0.004 * (s === 1 ? (1 - st.th) * (1 - st.sp) : 1) * (1 - st.ch);
    var H = [s * 0.11, 0.83 + wig, 0.02], hint = [s * 0.55, -1, 0.15], up = [s * 0.34, 1.72, 0.3];
    if (s === 1) {
      var chin = add(hc, [0.055, -0.09, -0.08]), mug = [0.64, 0.9, -0.32], mouth = add(hc, [0.04, -0.075, -0.1]);
      H = lerp(H, chin, st.th); hint = lerp(hint, [0.55, -1, -0.55], st.th);
      H = lerp(H, lerp(mug, mouth, st.sm), st.sp); hint = lerp(hint, [0.6, -1, -0.3], st.sp);
    }
    H = lerp(H, up, st.ch); hint = lerp(hint, [s * 0.9, -0.1, 0.4], st.ch);
    var E = ik(S, H, 0.31, 0.29, hint);
    F.push.apply(F, sphere(S, 0.058, 3, 8, 'ink', 0.3));
    F.push.apply(F, loft(S, E, 0.05, 0.042, 7, 'ink', 1, 0.35));
    F.push.apply(F, loft(E, H, 0.042, 0.032, 7, 'ink', 1, 0.35));
    F.push.apply(F, sphere(H, 0.04, 3, 6, 'skin', 0.4));
  }
  return { head: hc };
}
function poseState(t) {
  var th = theme(t), u = th.u, i = th.idx, o = { th: 0, ch: 0, sp: 0, sm: 0, name: 'typing' };
  if (i === 7) { o.ch = sm(0.2, 0.34, u) * (1 - sm(0.76, 0.9, u)); o.th = sm(0.04, 0.14, u) * (1 - sm(0.2, 0.3, u)); }
  else if (i === 4) { o.sp = sm(0.5, 0.6, u) * (1 - sm(0.86, 0.95, u)); o.sm = sm(0.62, 0.72, u) * (1 - sm(0.74, 0.84, u)); o.th = sm(0.04, 0.14, u) * (1 - sm(0.4, 0.5, u)); }
  else o.th = sm(0.04, 0.14, u) * (1 - sm(0.52, 0.62, u));
  if (o.ch > 0.5) o.name = 'celebrating'; else if (o.sp > 0.5) o.name = 'sipping'; else if (o.th > 0.5) o.name = 'thinking';
  return o;
}

function keysAt(a, p) {
  for (var i = 0; i < a.length - 1; i++) if (p <= a[i + 1][0]) { var q = sm(a[i][0], a[i + 1][0], p); return a[i][1] + (a[i + 1][1] - a[i][1]) * q; }
  return a[a.length - 1][1];
}
var K = {
  pitch: [[0, 0.4], [0.25, 0.16], [0.45, 0.36], [0.62, 0.36], [0.78, 0.15], [1, 0.4]],
  zoom:  [[0, 1.2], [0.25, 1.3], [0.5, 1.55], [0.75, 1.3], [1, 1.2]],
  ty:    [[0, 1.42], [0.25, 1.3], [0.5, 1.22], [0.75, 1.3], [1, 1.42]],
};

/* ======================= runtime ======================= */
export function initDeskBackground(canvas, opts) {
  opts = Object.assign({
    accentSelector: 'h1 em, h1 i, h1 .italic, h1 span:last-child',
    inkSelector: 'h1',
    sectionSelector: '[data-desk]',
    endSelector: '[data-desk-end]',
    darkSelector: '[data-bg="dark"]',
    accentDarkSelector: '[data-bg="dark"] em, [data-bg="dark"] i, [data-bg="dark"] .italic',
  }, opts || {});

  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var visible = false;
  var cleanups = [], raf = 0, W = 0, H = 0, dpr = 1, disposed = false;


  /* --- colours, read live from the page --- */
  var cc = document.createElement('canvas'); cc.width = cc.height = 1;
  var cx = cc.getContext('2d', { willReadFrequently: true });
  function toRGB(c) {
    if (!c) return null;
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
    var d = cx.getImageData(0, 0, 1, 1).data; return d[3] < 8 ? null : [d[0], d[1], d[2]];
  }
  var pals = null, fonts = { serif: 'serif', sans: 'sans-serif' };
  function mkPal(dark, paper, ink, acc) {
    return {
      dark: dark, paper: paper, ink: ink, acc: acc,
      obj: dark ? mix(paper, WHITE, 0.07) : mix(paper, WHITE, 0.5),
      screen: dark ? mix(paper, [0, 0, 0], 0.4) : mix(ink, WHITE, 0.18),
      screenBg: dark ? mix(paper, [0, 0, 0], 0.3) : mix(ink, WHITE, 0.2),
      cream: null, acc2: mix(acc, WHITE, 0.2),
    };
  }
  function readPalettes() {
    var q = function (s) { try { return document.querySelector(s); } catch (e) { return null; } };
    var bg = toRGB(getComputedStyle(document.documentElement).backgroundColor) || toRGB(getComputedStyle(document.body).backgroundColor) || [233, 229, 222];
    var inkEl = q(opts.inkSelector), accEl = q(opts.accentSelector);
    var ink = (inkEl && toRGB(getComputedStyle(inkEl).color)) || [27, 26, 26];
    var acc = (accEl && toRGB(getComputedStyle(accEl).color)) || [107, 15, 26];
    var L = mkPal(false, bg, ink, acc);
    var de = q(opts.darkSelector), D;
    if (de) {
      var dbg = toRGB(getComputedStyle(de, '::before').backgroundColor) || toRGB(getComputedStyle(de).backgroundColor) || [28, 28, 28];
      var dink = toRGB(getComputedStyle(de).color) || [237, 233, 226];
      var dae = q(opts.accentDarkSelector), dacc = (dae && toRGB(getComputedStyle(dae).color)) || mix(acc, WHITE, 0.3);
      D = mkPal(true, dbg, dink, dacc);
    } else D = mkPal(true, [28, 28, 28], [237, 233, 226], mix(acc, WHITE, 0.3));
    L.cream = D.cream = bg;
    pals = { light: L, dark: D };
    fonts.serif = (inkEl && getComputedStyle(inkEl).fontFamily) || 'serif';
    fonts.sans = getComputedStyle(document.body).fontFamily || 'sans-serif';
  }

  var darks = [];
  /* --- stable canvas size: ignore small height-only changes (mobile URL bar) --- */
  function resize(force) {
    var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (!force && w === W && Math.abs(h - H) < 160) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); W = w; H = h;
  }

  /* --- scene state --- */
  var STAT = []; chair(STAT); desk(STAT);
  monitor(STAT, function (c, t) { screenUI(c, t, fonts); });
  STAT = STAT.concat(box([0, 1.18, -0.5 - 0.0175 - 0.003], [0.1, 0.1, 0.004], 'accent', [1, 1, 1], 0.4));
  var PROG = 0, cur = { x: 0.5, y: 0.46, a: 1, z: 1 };

  function draw(t) {
    if (!W || !H) return;
    var base = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (base < 0.01) return;
    ctx.lineJoin = 'round';
    var p = PROG, sy = 0;
    var cam = camYaw({ yaw: -0.62 + TAU * p, pitch: keysAt(K.pitch, p), dist: 13, fov: 0.27, t: [0.05, keysAt(K.ty, p), -0.05] });
    var zoom = 1.05;
    var P = makeProj(cam, W, H, zoom, W * cur.x, H * cur.y);

    var F = STAT.slice(), ps = poseState(t), pr = person2(F, t, ps);
    var pp = [0, 2.18, -0.5], psz = 0.95, th = theme(t);
    F = F.concat(propPlace(cam, pp, psz, t, 0.2));
    var items = [], i, k;
    for (i = 0; i < F.length; i++) {
      var f = F[i], pts = [], ok = true, c = [0, 0, 0];
      for (k = 0; k < f.v.length; k++) { var q = P(f.v[k]); if (!q) { ok = false; break; } pts.push(q); c = add(c, f.v[k]); }
      if (!ok) continue; c = mul(c, 1 / f.v.length);
      var bs = f.bias || 0; if (f.post && cam.pos[2] < f.v[0][2]) bs = -0.6;
      items.push({ f: f, pts: pts, d: len(sub(c, cam.pos)) - bs, c: c });
    }
    items.sort(function (a, b) { return b.d - a.d; });

    function paint(pal) {
      CUR = pal; ctx.globalAlpha = base;
      drawFloor(ctx, P, pal);
      for (var i = 0; i < items.length; i++) {
        var it = items[i], f2 = it.f, n = normalOf(f2.v);
        if (dot(n, sub(it.c, cam.pos)) > 0) n = mul(n, -1);
        var st = styleOf(f2, cl(dot(n, LDIR) * 0.5 + 0.5, 0, 1), pal);
        ctx.globalAlpha = base * (f2.al == null ? 1 : f2.al); if (ctx.globalAlpha <= 0.01) continue;
        ctx.beginPath(); ctx.moveTo(it.pts[0].x, it.pts[0].y);
        for (var k = 1; k < it.pts.length; k++) ctx.lineTo(it.pts[k].x, it.pts[k].y);
        ctx.closePath(); ctx.fillStyle = st.fill; ctx.fill();
        if (f2.e !== 0) { ctx.strokeStyle = st.edge; ctx.lineWidth = 0.8; ctx.stroke(); }
        if (f2.post) {
          var p0 = it.pts[0], p1 = it.pts[1], p3 = it.pts[3]; ctx.save(); ctx.clip();
          ctx.transform((p1.x - p0.x) / 880, (p1.y - p0.y) / 880, (p3.x - p0.x) / 500, (p3.y - p0.y) / 500, p0.x, p0.y);
          f2.post(ctx, t); ctx.restore();
        }
      }
      ctx.globalAlpha = base;
      var u = th.u, hd = add(pr.head, [0.06, 0.2, 0]), B = [[0.2, 0.034], [0.4, 0.052], [0.62, 0.078]];
      for (var b = 0; b < 3; b++) {
        var s = B[b][0], pt = lerp(hd, pp, s); pt[1] += 0.07 * Math.sin(s * Math.PI); var q2 = P(pt); if (!q2) continue;
        dot_(ctx, q2.x, q2.y, B[b][1] * q2.s, rgb(pal.obj), rgb(pal.ink, 0.7), sm(b * 0.05, 0.1 + b * 0.05, u) * (1 - sm(0.86, 1, u)) * base);
      }
      var q3 = P(lerp(hd, pp, (t % 1.9) / 1.9));
      if (q3) dot_(ctx, q3.x, q3.y, 3.2, rgb(pal.acc), null, sm(0.1, 0.2, u) * (1 - sm(0.86, 1, u)) * base);
      var lp = P([pp[0], pp[1] - psz * 0.66, pp[2]]);
      if (lp) {
        ctx.save(); ctx.font = '500 ' + Math.max(9, Math.min(13, W * 0.011)) + 'px ' + fonts.sans;
        try { ctx.letterSpacing = '0.2em'; } catch (e) {}
        ctx.fillStyle = rgb(pal.ink); ctx.globalAlpha = sm(0.12, 0.25, u) * (1 - sm(0.86, 1, u)) * base; ctx.textAlign = 'center';
        ctx.fillText(NAMES[th.idx], lp.x, lp.y); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // dark sections (viewport coordinates from the cached document offsets)
    var vd = [];
    for (i = 0; i < darks.length; i++) {
      var d = darks[i], y0 = d.top - sy, y1 = d.bottom - sy;
      if (y1 > 0 && y0 < H) vd.push([Math.max(0, d.left), Math.max(0, y0), Math.min(W, d.right) - Math.max(0, d.left), Math.min(H, y1) - Math.max(0, y0)]);
    }
    ctx.save();
    if (vd.length) { ctx.beginPath(); ctx.rect(0, 0, W, H); vd.forEach(function (r) { ctx.rect(r[0], r[1], r[2], r[3]); }); ctx.clip('evenodd'); }
    paint(pals.light); ctx.restore();
    if (vd.length) { ctx.save(); ctx.beginPath(); vd.forEach(function (r) { ctx.rect(r[0], r[1], r[2], r[3]); }); ctx.clip(); paint(pals.dark); ctx.restore(); }
  }

  // Coalesce invalidations; stop completely while off-screen or in a hidden tab.
  function requestDraw() {
    if (disposed || !visible || document.hidden || raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      if (disposed || !visible || document.hidden) return;
      resize(true); readPalettes(); draw(28.4);
    });
  }
  var observer = new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible) requestDraw();
    else { cancelAnimationFrame(raf); raf = 0; }
  });
  observer.observe(canvas);
  var ro = new ResizeObserver(requestDraw);
  ro.observe(canvas);
  function visibilityChanged() {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else requestDraw();
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  if (document.fonts) document.fonts.ready.then(requestDraw);
  return function dispose() {
    disposed = true; cancelAnimationFrame(raf); observer.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', visibilityChanged);
  };
}
