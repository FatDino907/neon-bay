'use strict';
// ===== entities: cars, traffic AI, peds, cops, player, shots, particles =====
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
let uid=0;
function lightGreen(vertical){ const t=G.time%16; return vertical? t<7 : (t>=8&&t<15); }
function lightState(vertical){ const t=G.time%16; if(vertical){ return t<6?'g':t<7?'y':'r'; } return (t>=8&&t<14)?'g':(t>=14&&t<15)?'y':'r'; }
function nodeHasLight(i,j){ return !((i===0||i===NX-1)&&(j===0||j===NY-1)); }
function nbr(i,j,d){ const ni=i+DIRS[d][0], nj=j+DIRS[d][1]; if(ni<0||nj<0||ni>=NX||nj>=NY) return null; return [ni,nj]; }
// ---------- path pieces ----------
function segPiece(i,j,d,lane){
  const n=nbr(i,j,d); const A=nodePos(i,j), B=nodePos(n[0],n[1]); const dx=DIRS[d][0], dy=DIRS[d][1]; const rx=-dy, ry=dx;
  const hA=dx?hwX(i):hwY(j), hB=dx?hwX(n[0]):hwY(n[1]);
  const x0=A.x+dx*(hA+8)+rx*lane, y0=A.y+dy*(hA+8)+ry*lane, x1=B.x-dx*(hB+8)+rx*lane, y1=B.y-dy*(hB+8)+ry*lane;
  return {k:'line',x0,y0,x1,y1,len:Math.max(1,Math.hypot(x1-x0,y1-y0))};
}
function turnPiece(p0x,p0y,d,p2x,p2y,d2){
  if(d2===d) return {k:'line',x0:p0x,y0:p0y,x1:p2x,y1:p2y,len:Math.max(1,Math.hypot(p2x-p0x,p2y-p0y))};
  const dx=DIRS[d][0],dy=DIRS[d][1]; const pr=(p2x-p0x)*dx+(p2y-p0y)*dy; const p1x=p0x+dx*pr, p1y=p0y+dy*pr;
  let len=0,px=p0x,py=p0y; for(let k=1;k<=8;k++){ const q=quadAt(p0x,p0y,p1x,p1y,p2x,p2y,k/8); len+=Math.hypot(q[0]-px,q[1]-py); px=q[0];py=q[1]; }
  return {k:'quad',x0:p0x,y0:p0y,x1:p1x,y1:p1y,x2:p2x,y2:p2y,len};
}
function quadAt(x0,y0,x1,y1,x2,y2,t){ const u=1-t; return [u*u*x0+2*u*t*x1+t*t*x2, u*u*y0+2*u*t*y1+t*t*y2]; }
function pieceAt(pc,s){ const t=clamp(s/pc.len,0,1);
  if(pc.k==='line') return [lerp(pc.x0,pc.x1,t),lerp(pc.y0,pc.y1,t),Math.atan2(pc.y1-pc.y0,pc.x1-pc.x0)];
  const q=quadAt(pc.x0,pc.y0,pc.x1,pc.y1,pc.x2,pc.y2,t); const u=1-t; const tx=2*u*(pc.x1-pc.x0)+2*t*(pc.x2-pc.x1), ty=2*u*(pc.y1-pc.y0)+2*t*(pc.y2-pc.y1); return [q[0],q[1],Math.atan2(ty,tx)]; }
function chooseDir(i,j,d){ const opts=[]; for(let k=0;k<4;k++){ if(k===(d+2)%4) continue; if(nbr(i,j,k)) opts.push(k); } if(!opts.length) return (d+2)%4; if(opts.includes(d)&&Math.random()<0.55) return d; return pick(opts); }
function laneFor(i,j,d){ const wide=DIRS[d][0]? YW[j]===4 : XW[i]===4; return wide&&Math.random()<0.5?T*1.5:T*0.5; }
// ---------- cars ----------
function makeCar(type,x,y,a,color,opts){
  const P=CARS[type];
  const c={id:++uid,type,P,x,y,a,vx:0,vy:0,spd:0,color:type==='cop'?'#f4f4f8':(color||pick(CAR_COLORS)),hp:P.hp,driver:null,mode:'phys',rt:null,ctrl:null,
    burning:0,wreck:false,wreckT:0,honkT:0,siren:false,persist:false,stuckT:0,revT:0,slip:0,waitT:0,hitCD:0,passenger:null};
  Object.assign(c,opts||{}); G.cars.push(c); return c;
}
function carCorners(x,y,a,P,pad){ pad=pad||0; const fx=Math.cos(a),fy=Math.sin(a); const hl=P.len/2+pad, hw=P.wid/2+pad; const pts=[];
  for(const [l,w] of [[hl,hw],[hl,-hw],[-hl,hw],[-hl,-hw],[0,hw],[0,-hw],[hl,0],[-hl,0]]) pts.push([x+fx*l-fy*w, y+fy*l+fx*w]); return pts; }
function carHits(x,y,a,P){ for(const p of carCorners(x,y,a,P,-1)) if(solidAt(p[0],p[1])||p[0]<0||p[1]<0||p[0]>MW*T||p[1]>MH*T) return true; return false; }
function carLocal(c,x,y){ const dx=x-c.x, dy=y-c.y, fx=Math.cos(c.a), fy=Math.sin(c.a); return [dx*fx+dy*fy, -dx*fy+dy*fx]; }
function inCar(c,x,y,pad){ const l=carLocal(c,x,y); return Math.abs(l[0])<c.P.len/2+pad && Math.abs(l[1])<c.P.wid/2+pad; }
function carPhys(c,thr,steer,hb,dt){
  const P=c.P; const fx=Math.cos(c.a), fy=Math.sin(c.a);
  let vf=c.vx*fx+c.vy*fy, vr=-c.vx*fy+c.vy*fx; const mx=P.max*(c.burning?0.45:1)*(c.maxMul||1);
  if(thr>0){ if(vf<-5) vf+=P.brake*thr*dt; else if(vf<mx) vf+=P.acc*thr*dt*(1-0.55*vf/mx); }
  else if(thr<0){ if(vf>20) vf-=P.brake*(-thr)*dt; else if(vf>-mx*0.38) vf-=P.acc*0.75*(-thr)*dt; }
  else vf-=Math.sign(vf)*Math.min(Math.abs(vf),150*dt);
  vf*=(1-0.18*dt);
  const grip=hb?P.grip*0.16:P.grip; vr*=Math.exp(-grip*dt);
  if(hb) vf-=Math.sign(vf)*Math.min(Math.abs(vf),220*dt);
  let turnF=clamp(vf/100,-1,1); if(Math.abs(turnF)<0.4&&thr!==0) turnF=0.4*Math.sign(thr); const na=c.a+steer*P.turn*(hb?1.4:1)*dt*turnF*(1-0.3*clamp(Math.abs(vf)/mx,0,1));
  c.vx=fx*vf-fy*vr; c.vy=fy*vf+fx*vr; c.slip=Math.abs(vr)+(hb&&Math.abs(vf)>120?80:0);
  if(!carHits(c.x,c.y,na,P)||carHits(c.x,c.y,c.a,P)) c.a=na;
  c.spd=Math.hypot(c.vx,c.vy); c.vf=vf;
}
function carMove(c,dt){
  if(carHits(c.x,c.y,c.a,c.P)){ c.x+=c.vx*dt; c.y+=c.vy*dt; // stuck inside: let it escape
    if(Math.hypot(c.vx,c.vy)<5){ const n=nearestNode(c.x,c.y); const p=nodePos(n[0],n[1]); c.x+=(p.x-c.x)*0.02; c.y+=(p.y-c.y)*0.02; } return 0; }
  const nx=c.x+c.vx*dt, ny=c.y+c.vy*dt; if(!carHits(nx,ny,c.a,c.P)){c.x=nx;c.y=ny;return 0;}
  let imp;
  if(!carHits(nx,c.y,c.a,c.P)){ c.x=nx; imp=Math.abs(c.vy); c.vy*=-0.25; c.vx*=0.92; }
  else if(!carHits(c.x,ny,c.a,c.P)){ c.y=ny; imp=Math.abs(c.vx); c.vx*=-0.25; c.vy*=0.92; }
  else { imp=Math.hypot(c.vx,c.vy); c.vx*=-0.3; c.vy*=-0.3; }
  return imp;
}
function damageCar(c,amt,byPlayer){
  if(c.wreck||amt<=0) return; c.hp-=amt;
  if(c.hp<=0&&!c.burning){ c.hp=0; c.burning=2.2;
    if(c.driver&&c.driver!=='player'){ ejectDriver(c,true); }
    if(c.driver==='player') toast('BAIL OUT!','#ff7a2b',2);
    if(byPlayer&&!(G.mission&&G.mission.target===c)) crime(c.type==='cop'?1.0:0.5,c.x,c.y,c.type!=='cop');
  }
}
function explodeCar(c){
  c.burning=0; c.wreck=true; c.wreckT=30; c.vx*=0.2; c.vy*=0.2; AU.sfxPlay('poof'); G.shake=Math.max(G.shake,14);
  floater(c.x,c.y-20,'KA-POOF!','#ffd23a');
  for(let k=0;k<26;k++){ const a=rr(0,TAU), s=rr(40,260); G.parts.push({k:'puff',x:c.x,y:c.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:rr(0.8,1.6),max:1.6,r:rr(14,30),c:pick(['#fff','#e8e0ff','#ffd23a','#ff9a3a','#cfc6e6'])}); }
  for(let k=0;k<12;k++){ const a=rr(0,TAU), s=rr(150,420); G.parts.push({k:'debris',x:c.x,y:c.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:rr(0.6,1.2),max:1.2,r:rr(3,7),c:pick([c.color,'#333','#888']),rot:rr(0,6)}); }
  G.parts.push({k:'burst',x:c.x,y:c.y,t:0.45,max:0.45,r:120});
  const p=G.player;
  for(const q of G.peds){ if(dist2(q.x,q.y,c.x,c.y)<110*110) koPed(q,c.x,c.y,false); }
  for(const o of G.cars){ if(o!==c&&!o.wreck&&dist2(o.x,o.y,c.x,c.y)<100*100){ const d=Math.max(1,dist(o.x,o.y,c.x,c.y)); if(o.mode==='path')toPhys(o); o.vx+=(o.x-c.x)/d*200; o.vy+=(o.y-c.y)/d*200; damageCar(o,18,false);} }
  if(p.car===c){ exitCar(true); hurtPlayer(30); p.ko=1.0; }
  else if(!p.car&&dist2(p.x,p.y,c.x,c.y)<100*100){ hurtPlayer(20); p.ko=0.8; }
  if(c===G.player.lastCar) G.player.lastCar=null;
}
function toPhys(c){ if(c.mode==='phys')return; c.mode='phys'; c.vx=Math.cos(c.a)*c.spd; c.vy=Math.sin(c.a)*c.spd; c.rt=null; c.panicT=rr(1.5,3); }
function ejectDriver(c,flee){
  if(c.driver==='npc'){ c.driver=null; c.ctrl=null; return null; }
  const fx=Math.cos(c.a), fy=Math.sin(c.a); const lx=c.x+fy*(c.P.wid/2+12), ly=c.y-fx*(c.P.wid/2+12);
  const ped=makePed(lx,ly,c.driver==='cop'?{cop:true,state:'chase'}:{state:'flee'}); ped.from={x:c.x,y:c.y}; ped.fleeT=6;
  if(c.driver!=='cop') floater(lx,ly-14,pick(['HEY!','MY RIDE!','NOT COOL!','WHOA!']),'#fff');
  c.driver=null; c.ctrl=null; c.siren=false; if(c.mode==='path')toPhys(c); return ped;
}
// ---------- traffic ----------
function spawnTraffic(){
  for(let tries=0;tries<6;tries++){
    const i=(Math.random()*NX)|0, j=(Math.random()*NY)|0, d=(Math.random()*4)|0; const n=nbr(i,j,d); if(!n) continue;
    const lane=laneFor(i,j,d); const pc=segPiece(i,j,d,lane); const s=rr(0,pc.len); const [x,y,a]=pieceAt(pc,s);
    const pd=dist(x,y,G.player.x,G.player.y); if(pd<700||pd>1500||onScreen(x,y,80)) continue;
    if(G.cars.some(c=>dist2(c.x,c.y,x,y)<90*90)) continue;
    const type=pick(['compact','compact','taxi','sports','muscle','van','compact','bike','taxi']);
    const c=makeCar(type,x,y,a,null,{driver:'ai',mode:'path',spd:rr(80,160)});
    c.rt={i,j,d,lane,stage:'seg',pc,s,nd:chooseDir(n[0],n[1],d)}; c.cruise=rr(0.85,1.1); return c;
  }
}
function trafficUpdate(c,dt){
  const R=c.rt; const pc=R.pc; const n=nbr(R.i,R.j,R.d);
  const hwy=(DIRS[R.d][0]?YW[R.j]:XW[R.i])===4;
  let target=(hwy?270:190)*c.cruise*(c.type==='van'?0.85:1);
  const rem=pc.len-R.s;
  if(R.stage==='seg'&&n&&nodeHasLight(n[0],n[1])){ const vert=DIRS[R.d][1]!==0; const st=lightState(vert);
    if(st!=='g'&&rem<90){ if(st==='r'||rem>30) target=Math.min(target,Math.sqrt(Math.max(0,rem-4)*700)); } }
  // obstacle ahead
  const fx=Math.cos(c.a), fy=Math.sin(c.a); let block=null;
  const chk=(ox,oy,rad,who)=>{ const dx=ox-c.x, dy=oy-c.y; const ah=dx*fx+dy*fy; if(ah<=0||ah>150) return; const sd=Math.abs(-dx*fy+dy*fx); if(sd<rad){ const lim=Math.max(0,(ah-c.P.len/2-24))*3.2; if(lim<target){target=lim; block=who;} } };
  for(const o of G.cars){ if(o===c||o.wreck&&false) continue; if(Math.abs(o.x-c.x)>170||Math.abs(o.y-c.y)>170) continue; chk(o.x,o.y,o.P.wid/2+c.P.wid/2-2,o); }
  const p=G.player; if(!p.car) chk(p.x,p.y,22,'p');
  for(const q of G.peds){ if(Math.abs(q.x-c.x)<120&&Math.abs(q.y-c.y)<120) chk(q.x,q.y,20,'ped'); }
  if(block&&c.spd<10){ c.waitT+=dt; if(c.waitT>2.5&&(block==='p'||block===p.car)&&c.honkT<=0){ c.honkT=4; if(dist(c.x,c.y,p.x,p.y)<500)AU.sfxPlay('horn',0.35); floater(c.x,c.y-20,'HONK!','#ffd23a'); } if(c.waitT>6&&block!=='p'&&block!==p.car){ c.waitT=0; toPhys(c); c.panicT=0; c.ctrl=(cc,dt2)=>{ const t=navTarget(cc,cc.x+Math.cos(cc.a)*900,cc.y+Math.sin(cc.a)*900); return steerTo(cc,t.x,t.y,{thr:0.5}); }; } }
  else c.waitT=0;
  c.honkT-=dt;
  c.spd+=clamp(target-c.spd,-600*dt,200*dt); if(c.spd<0)c.spd=0;
  R.s+=c.spd*dt;
  while(R.s>=R.pc.len){ R.s-=R.pc.len;
    if(R.stage==='seg'){ const [ni,nj]=n; const nd=R.nd; const nl=laneFor(ni,nj,nd); const next=segPiece(ni,nj,nd,nl);
      R.pc=turnPiece(R.pc.x1,R.pc.y1,R.d,next.x0,next.y0,nd); R.stage='turn'; R.next={i:ni,j:nj,d:nd,lane:nl,pc:next}; }
    else { const X=R.next; R.i=X.i;R.j=X.j;R.d=X.d;R.lane=X.lane;R.pc=X.pc;R.stage='seg'; const nn=nbr(R.i,R.j,R.d); R.nd=chooseDir(nn[0],nn[1],R.d); }
  }
  const [x,y,a]=pieceAt(R.pc,R.s); c.x=x;c.y=y;c.a=a; c.vx=Math.cos(a)*c.spd; c.vy=Math.sin(a)*c.spd;
}
// ---------- steering helpers for physics AI ----------
function steerTo(c,x,y,opt){
  opt=opt||{}; const dx=x-c.x, dy=y-c.y; const d=Math.hypot(dx,dy); const diff=angDiff(c.a,Math.atan2(dy,dx));
  let thr=opt.thr==null?1:opt.thr, steer=clamp(diff*2.4,-1,1), hb=false;
  if(Math.abs(diff)>1.7&&c.vf<120){ thr=-0.9; steer=-Math.sign(diff); }
  else if(Math.abs(diff)>0.9&&c.spd>260){ thr=0.2; hb=Math.abs(diff)>1.2; }
  if(opt.stopAt&&d<opt.stopAt){ thr=c.vf>20?-1:0; }
  // stuck handling
  if(c.revT>0){ c.revT-=0.016; return {thr:-1,steer:-steer,hb:false}; }
  if(thr>0.3&&Math.abs(c.vf||0)<25){ c.stuckT+=1/60; if(c.stuckT>1.0){ c.stuckT=0; c.revT=0.8; } } else c.stuckT=Math.max(0,c.stuckT-0.02);
  return {thr,steer,hb};
}
function roadNodeFor(x,y){ // nodes directly reachable from current position (same road)
  const tx=Math.floor(x/T), ty=Math.floor(y/T); const vi=W.rv[ty*MW+tx], hj=W.rh[ty*MW+tx]; const out=[];
  if(vi>=0){ let j=0; while(j<NY-1&&YC[j+1]*T<y) j++; out.push([vi,j]); if(j+1<NY) out.push([vi,j+1]); }
  if(hj>=0){ let i=0; while(i<NX-1&&XC[i+1]*T<x) i++; out.push([i,hj]); if(i+1<NX) out.push([i+1,hj]); }
  if(!out.length) out.push(nearestNode(x,y)); return out;
}
function navTarget(c,tx,ty){ // returns point to steer toward using node grid
  const [ti,tj]=nearestNode(tx,ty);
  if(!c.nav||c.navT<=0){ c.navT=0.7; let best=null,bc=1e18; for(const n of roadNodeFor(c.x,c.y)){ const p=nodePos(n[0],n[1]); const cost=dist(c.x,c.y,p.x,p.y)+ (Math.abs(n[0]-ti)+Math.abs(n[1]-tj))*560; if(cost<bc){bc=cost;best=n;} } c.nav=best; }
  let p=nodePos(c.nav[0],c.nav[1]);
  if(dist(c.x,c.y,p.x,p.y)<70){ const [i,j]=c.nav; let ni=i,nj=j; const di=ti-i, dj=tj-j;
    if(di===0&&dj===0) return {x:tx,y:ty};
    if(Math.abs(di)>=Math.abs(dj)&&di!==0) ni+=Math.sign(di); else nj+=Math.sign(dj);
    c.nav=[ni,nj]; c.navT=1.5; p=nodePos(ni,nj); }
  return p;
}
// ---------- peds ----------
function makePed(x,y,opts){
  const p={id:++uid,x,y,a:rr(0,TAU),vx:0,vy:0,look:randomLook(),state:'walk',dir:(Math.random()*4)|0,tx:x,ty:y,spd:rr(42,62),ph:rr(0,6),ko:0,fleeT:0,from:null,offs:rr(-13,13),cop:false,diveCD:0,shootT:rr(0.5,1.5),dizzy:0};
  Object.assign(p,opts||{}); if(p.cop){p.look=COP_LOOK;} G.peds.push(p); return p;
}
function pedStep(p,dx,dy,dt){ // move with tile collision slide
  const nx=p.x+dx*dt, ny=p.y+dy*dt; const r=8;
  const free=(x,y)=>!solidAt(x-r,y-r)&&!solidAt(x+r,y-r)&&!solidAt(x-r,y+r)&&!solidAt(x+r,y+r);
  if(free(nx,ny)){p.x=nx;p.y=ny;return true;} if(free(nx,p.y)){p.x=nx;return false;} if(free(p.x,ny)){p.y=ny;return false;} return false;
}
function koPed(q,fx,fy,byPlayer,txt){
  if(q.state==='ko') return; q.state='ko'; q.ko=q.cop?3.2:2.6; const d=Math.max(1,dist(q.x,q.y,fx,fy)); q.vx=(q.x-fx)/d*220; q.vy=(q.y-fy)/d*220;
  floater(q.x,q.y-16,txt||pick(['BONK!','POW!','OOF!','ZONK!']),'#ffd23a'); AU.sfxPlay('bonk',0.7);
  for(let k=0;k<5;k++) G.parts.push({k:'star',x:q.x,y:q.y,vx:0,vy:0,t:q.ko,max:q.ko,r:5,a0:k*TAU/5,own:q});
  if(byPlayer&&!(G.mission&&G.mission.targetPed===q)) crime(q.cop?0.8:0.35,q.x,q.y,!q.cop);
  if(byPlayer&&G.mission&&G.mission.onKo) G.mission.onKo(q);
}
function pedUpdate(q,dt){
  const p=G.player;
  if(q.state==='ko'){ q.ko-=dt; pedStep(q,q.vx,q.vy,dt); q.vx*=Math.pow(0.02,dt); q.vy*=Math.pow(0.02,dt); if(q.ko<=0){ if(q.cop){q.state=G.heat>=1?'chase':'leave'; q.dizzy=0;} else {q.state='flee'; q.fleeT=4; q.from={x:p.x,y:p.y};} } return; }
  q.ph+=dt*(q.state==='walk'?9:16);
  if(q.state==='dive'){ q.diveT-=dt; pedStep(q,q.vx,q.vy,dt); if(q.diveT<=0){q.state='flee';q.fleeT=3;} return; }
  if(q.cop){ copPedUpdate(q,dt); return; }
  // dodge fast cars
  q.diveCD-=dt;
  if(q.diveCD<=0){ q.diveCD=0.25; for(const c of G.cars){ if(c.spd<170||c.wreck) continue; if(Math.abs(c.x-q.x)>160||Math.abs(c.y-q.y)>160) continue; const l=carLocal(c,q.x,q.y); if(l[0]>0&&l[0]<150&&Math.abs(l[1])<c.P.wid/2+16&&Math.random()<0.55){ const s=l[1]>=0?1:-1; const fx=Math.cos(c.a),fy=Math.sin(c.a); q.vx=-fy*s*300; q.vy=fx*s*300; q.state='dive'; q.diveT=0.35; q.a=Math.atan2(q.vy,q.vx); return; } } }
  if(q.state==='flee'){ q.fleeT-=dt; const f=q.from||{x:p.x,y:p.y}; let dx=q.x-f.x, dy=q.y-f.y; const d=Math.hypot(dx,dy)||1; dx/=d; dy/=d;
    const ok=pedStep(q,dx*165,dy*165,dt); if(!ok){ q.from={x:q.x-dy*50+rr(-30,30),y:q.y+dx*50+rr(-30,30)}; }
    q.a=Math.atan2(dy,dx); if(q.fleeT<=0){ q.state='walk'; q.tx=q.x; q.ty=q.y; } return; }
  if(q.state==='leave'){ return; }
  // walk along ped tiles
  const dx=q.tx-q.x, dy=q.ty-q.y; const d=Math.hypot(dx,dy);
  if(d<3){ const cx=Math.floor(q.x/T), cy=Math.floor(q.y/T); const opts=[];
    for(let k=0;k<4;k++){ if(k===(q.dir+2)%4) continue; if(isPedT(tileAt(cx+DIRS[k][0],cy+DIRS[k][1]))) opts.push(k); }
    let nd; if(!opts.length) nd=(q.dir+2)%4; else if(opts.includes(q.dir)&&Math.random()<0.8) nd=q.dir; else nd=pick(opts);
    if(!isPedT(tileAt(cx+DIRS[nd][0],cy+DIRS[nd][1]))){ q.tx=(cx+0.5)*T; q.ty=(cy+0.5)*T; q.dir=nd; return; }
    q.dir=nd; const px=-DIRS[nd][1], py=DIRS[nd][0];
    q.tx=(cx+DIRS[nd][0]+0.5)*T+px*q.offs; q.ty=(cy+DIRS[nd][1]+0.5)*T+py*q.offs; return; }
  pedStep(q,dx/d*q.spd,dy/d*q.spd,dt); q.a+=angDiff(q.a,Math.atan2(dy,dx))*Math.min(1,dt*10);
  // scatter from gunfire / fast player car nearby handled by alarm()
}
function alarm(x,y,r){ for(const q of G.peds){ if(q.cop||q.state==='ko') continue; if(dist2(q.x,q.y,x,y)<r*r){ q.state='flee'; q.fleeT=rr(3,5); q.from={x,y}; } } }
function copPedUpdate(q,dt){
  const p=G.player; const tx=p.car?p.car.x:p.x, ty=p.car?p.car.y:p.y; const d=dist(q.x,q.y,tx,ty);
  if(G.heat<1&&q.state!=='leave'){ q.state='leave'; }
  if(q.state==='leave'){ const dx=q.x-tx,dy=q.y-ty,dd=Math.hypot(dx,dy)||1; pedStep(q,dx/dd*90,dy/dd*90,dt); q.a=Math.atan2(dy,dx); q.ph+=dt*6; return; }
  if(q.state==='idle'){ if(d<330) q.state='chase'; q.a+=angDiff(q.a,Math.atan2(ty-q.y,tx-q.x))*dt*4; return; }
  if(q.state==='chase'){
    q.a=Math.atan2(ty-q.y,tx-q.x);
    if(d>28) { const sp=172+G.heat*6; if(!pedStep(q,Math.cos(q.a)*sp,Math.sin(q.a)*sp,dt)){ pedStep(q,-Math.sin(q.a)*sp*0.8,Math.cos(q.a)*sp*0.8,dt); } }
    // arrest contact
    const touching= p.car? (p.car.spd<40&&inCar(p.car,q.x,q.y,16)) : d<26&&p.ko<=0;
    if(touching){ G.bustT+=dt*(p.car?0.8:1.3); G.bustBy=q; }
    // stun shots
    q.shootT-=dt; if(G.heat>=2&&q.shootT<=0&&d<380&&d>40&&los(q.x,q.y,tx,ty)){ q.shootT=rr(1.3,2.0)-G.heat*0.12; const lead=0.25; const ax=tx+(p.car?p.car.vx:p.vx)*lead*d/420, ay=ty+(p.car?p.car.vy:p.vy)*lead*d/420; const a=Math.atan2(ay-q.y,ax-q.x)+rr(-0.08,0.08); G.shots.push({x:q.x,y:q.y,vx:Math.cos(a)*430,vy:Math.sin(a)*430,t:1.1,own:'cop',c:'#6ad8ff'}); AU.sfxPlay('stun',0.4); }
  }
}
// ---------- player ----------
function makePlayer(x,y){ return {x,y,a:-Math.PI/2,vx:0,vy:0,hp:100,armor:0,car:null,lastCar:null,ph:0,ko:0,punchT:0,fireT:0,sprint:false,hurtT:0}; }
function hurtPlayer(n){ const p=G.player; if(G.mode!=='play') return; let a=Math.min(p.armor,n*0.7); p.armor-=a; p.hp-=n-a; p.hurtT=0.3; G.shake=Math.max(G.shake,5); if(p.hp<=0){ p.hp=0; wipedOut(); } }
function playerFoot(dt){
  const p=G.player; const mv=moveVec();
  if(p.ko>0){ p.ko-=dt; pedStep(p,p.vx,p.vy,dt); p.vx*=0.9;p.vy*=0.9; return; }
  p.sprint=held('sprint'); const sp=(p.sprint?215:128)*mv.mag;
  p.vx=mv.x*sp; p.vy=mv.y*sp;
  if(mv.mag>0){ pedStep(p,p.vx,p.vy,dt); p.a+=angDiff(p.a,Math.atan2(mv.y,mv.x))*Math.min(1,dt*14); p.ph+=dt*(p.sprint?17:11)*Math.max(0.4,mv.mag); }
  // push out of cars
  for(const c of G.cars){ if(Math.abs(c.x-p.x)>60||Math.abs(c.y-p.y)>60) continue; const l=carLocal(c,p.x,p.y); const hl=c.P.len/2+9, hw=c.P.wid/2+9;
    if(Math.abs(l[0])<hl&&Math.abs(l[1])<hw){ if(c.spd>150&&!c.wreck&&c!==p.lastCarGrace){ hurtPlayer(8+c.spd*0.02); p.ko=0.8; const d=Math.hypot(c.vx,c.vy)||1; p.vx=c.vx/d*260+(l[1]>0?1:-1)*-Math.sin(c.a)*120; p.vy=c.vy/d*260; floater(p.x,p.y-18,'OOF!','#ffd23a'); AU.sfxPlay('punch'); return; }
      const fx=Math.cos(c.a), fy=Math.sin(c.a); const ox=hl-Math.abs(l[0]), oy=hw-Math.abs(l[1]);
      if(ox<oy){ const s=Math.sign(l[0])||1; p.x+=fx*s*ox; p.y+=fy*s*ox; } else { const s=Math.sign(l[1])||1; p.x+=-fy*s*oy; p.y+=fx*s*oy; } } }
  // actions
  p.punchT-=dt; p.fireT-=dt;
  if(IN.pressed.punch&&p.punchT<=0){ p.punchT=0.35; AU.sfxPlay('punch',0.6); let hit=null,bd=40;
    for(const q of G.peds){ if(q.state==='ko')continue; const d=dist(p.x,p.y,q.x,q.y); if(d<bd&&Math.abs(angDiff(p.a,Math.atan2(q.y-p.y,q.x-p.x)))<1.2){bd=d;hit=q;} }
    G.parts.push({k:'swoosh',x:p.x+Math.cos(p.a)*16,y:p.y+Math.sin(p.a)*16,a:p.a,t:0.18,max:0.18});
    if(hit){ koPed(hit,p.x,p.y,true,'POW!'); } }
  if(held('fire')&&p.fireT<=0){ p.fireT=0.17; fireZap(p.x+Math.cos(p.a)*14,p.y+Math.sin(p.a)*14,autoAim(p.x,p.y,p.a)); }
  if(IN.pressed.car) tryEnterCar();
}
function autoAim(x,y,a){
  let best=null,bs=1e9; const cands=[];
  if(G.mission&&G.mission.aimTargets) cands.push(...G.mission.aimTargets());
  for(const q of G.peds) if(q.cop&&q.state!=='ko') cands.push(q);
  for(const c of G.cars) if(c.type==='cop'&&c.driver==='cop'&&!c.wreck) cands.push(c);
  for(const t of cands){ const d=dist(x,y,t.x,t.y); if(d>360) continue; const da=Math.abs(angDiff(a,Math.atan2(t.y-y,t.x-x))); if(da>0.6) continue; const s=d+da*300; if(s<bs){bs=s;best=t;} }
  return best?Math.atan2(best.y-y,best.x-x):a;
}
function fireZap(x,y,a){
  const cols=['#ff2bd6','#22e6ff','#9dff3a','#ffd23a']; const c=cols[(G.time*7|0)%4];
  G.shots.push({x,y,vx:Math.cos(a)*720,vy:Math.sin(a)*720,t:0.6,own:'player',c}); G.fired=(G.fired||0)+1; AU.sfxPlay('zap',0.7); alarm(x,y,260);
}
function tryEnterCar(){
  const p=G.player; let best=null,bd=1e9;
  for(const c of G.cars){ if(c.wreck||c.burning) continue; const d=dist(p.x,p.y,c.x,c.y)-c.P.len/2; if(d<44&&d<bd){bd=d;best=c;} }
  if(!best) { toast('No car close enough','#aaa',1.2); return; }
  const c=best; let jacked=false;
  if(c.driver&&c.driver!=='player'){ const wasCop=c.driver==='cop'; jacked=true; ejectDriver(c,true); if(wasCop) crime(1,c.x,c.y,false); }
  if(c.passenger&&c.passenger!=='dex') c.passenger=null;
  toPhys(c); c.driver='player'; c.persist=true; c.ctrl=null; c.siren=false; c.mode='phys';
  if(c.type==='cop'&&!jacked) crime(0.6,c.x,c.y,true); else if(jacked) crime(0.4,c.x,c.y,true);
  if(p.lastCar&&p.lastCar!==c) p.lastCar.persist=false; p.car=c; p.lastCar=c; G.save.stats.cars++;
  AU.sfxPlay('door'); toast(c.P.name,'#22e6ff',1.6); alarm(c.x,c.y,140);
}
function exitCar(force){
  const p=G.player, c=p.car; if(!c) return; const fx=Math.cos(c.a), fy=Math.sin(c.a);
  const spots=[[fy,-fx,c.P.wid/2+14],[-fy,fx,c.P.wid/2+14],[fx,fy,c.P.len/2+14],[-fx,-fy,c.P.len/2+14]];
  let ok=false; for(const [ux,uy,o] of spots){ const x=c.x+ux*o, y=c.y+uy*o; if(!solidAt(x,y)&&!solidAt(x+8,y+8)&&!solidAt(x-8,y-8)){p.x=x;p.y=y;ok=true;break;} }
  if(!ok){ p.x=c.x; p.y=c.y; }
  c.driver=null; p.car=null; p.a=c.a; AU.sfxPlay('door'); AU.setEngine(false,0); AU.setSkid(0);
  if(c.spd>220&&!force){ p.ko=0.6; p.vx=c.vx*0.4; p.vy=c.vy*0.4; floater(p.x,p.y-16,'TUCK & ROLL!','#22e6ff'); }
  p.lastCarGrace=c; setTimeout(()=>{ if(p.lastCarGrace===c)p.lastCarGrace=null; },700);
}
function playerCar(dt){
  const p=G.player, c=p.car; const mv=moveVec(); let thr=0,steer=0; const hb=held('sprint');
  if(mv.src==='key'){ // tank controls on keyboard
    if(IN.keys.KeyW||IN.keys.ArrowUp)thr=1; if(IN.keys.KeyS||IN.keys.ArrowDown)thr=-1; if(IN.keys.KeyA||IN.keys.ArrowLeft)steer=-1; if(IN.keys.KeyD||IN.keys.ArrowRight)steer=1;
    if((c.vf||0)<-5) steer=steer; }
  else if(mv.mag>0){ // stick: car drives toward the stick direction
    const want=Math.atan2(mv.y,mv.x); const diff=angDiff(c.a,want);
    if(Math.abs(diff)<2.1){ thr=mv.mag; steer=clamp(diff*2.6,-1,1); c.revMode=false; }
    else { if((c.vf||0)>60&&!c.revMode){ thr=-1; steer=0; } else { c.revMode=true; thr=-mv.mag; const d2=angDiff(c.a+Math.PI,want); steer=clamp(-d2*2.6,-1,1); } }
  } else c.revMode=false;
  carPhys(c,thr,steer,hb,dt);
  if(c.slip>70&&c.spd>120){ G.save.stats.drift+=dt; }
  if(IN.pressed.horn||IN.pressed.punch){ AU.sfxPlay('horn',0.6); alarm(c.x,c.y,220); for(const o of G.cars){ if(o.mode==='path'&&dist2(o.x,o.y,c.x,c.y)<200*200){ /* ai yield */ } } }
  p.fireT-=dt; if(held('fire')&&p.fireT<=0){ p.fireT=0.2; const fx=Math.cos(c.a),fy=Math.sin(c.a); fireZap(c.x+fx*(c.P.len/2+6),c.y+fy*(c.P.len/2+6),autoAim(c.x,c.y,c.a)); const s=G.shots[G.shots.length-1]; s.vx+=c.vx; s.vy+=c.vy; }
  if(IN.pressed.car){ exitCar(false); return; }
  p.x=c.x; p.y=c.y; p.a=c.a;
}
// ---------- wanted / cops ----------
function copNear(x,y,r){ for(const c of G.cars) if(c.driver==='cop'&&dist2(c.x,c.y,x,y)<r*r&&los(c.x,c.y,x,y)) return true; for(const q of G.peds) if(q.cop&&q.state!=='ko'&&dist2(q.x,q.y,x,y)<r*r) return true; return false; }
function crime(amount,x,y,needWitness){
  if(G.mode!=='play') return; if(G.mission&&G.mission.noHeat) return;
  if(needWitness&&G.heat<1&&!copNear(x,y,650)&&Math.random()<0.5) return;
  const before=Math.floor(G.heat); if(G.heat<1) G.heat=1+amount*0.3; else G.heat=Math.min(5.99,G.heat+amount);
  G.unseenT=0; if(Math.floor(G.heat)>before){ AU.sfxPlay('star'); G.starFlash=1; }
}
function setHeat(h){ const before=Math.floor(G.heat); G.heat=h; G.unseenT=0; if(Math.floor(h)>before){AU.sfxPlay('star');G.starFlash=1;} }
function stars(){ return Math.floor(G.heat); }
function isSeen(){
  const p=G.player; const s=stars(); if(s>=5) return true;
  for(const c of G.cars) if(c.driver==='cop'&&dist2(c.x,c.y,p.x,p.y)<620*620&&los(c.x,c.y,p.x,p.y)) return true;
  for(const q of G.peds) if(q.cop&&(q.state==='chase')&&dist2(q.x,q.y,p.x,p.y)<420*420&&los(q.x,q.y,p.x,p.y)) return true;
  return false;
}
function wantedUpdate(dt){
  const s=stars(); G.starFlash=Math.max(0,(G.starFlash||0)-dt);
  if(s<=0){ G.heat=0; G.bustT=0; return; }
  G.seenT-=dt; if(G.seenT<=0){ G.seenT=0.3; G.seen=isSeen(); }
  if(G.seen) G.unseenT=0; else G.unseenT+=dt;
  const thr=4.5+1.4*s; if(G.unseenT>thr){ G.unseenT=0; G.heat=s-1; if(G.heat<1){ G.heat=0; AU.sfxPlay('clear'); toast('YOU LOST THEM!','#9dff3a',2.4); } }
  // spawn cops
  G.copSpawnT-=dt; const want=[0,1,2,3,4,5][s]; const have=G.cars.filter(c=>c.driver==='cop').length;
  if(have<want&&G.copSpawnT<=0){ G.copSpawnT=s>=3?1.2:2.2; spawnCop(); }
  // roadblocks
  if(s>=4){ G.rbT-=dt; if(G.rbT<=0){ G.rbT=11; spawnRoadblock(); } }
  // bust
  G.bustT=Math.max(0,G.bustT-dt*0.5); if(G.bustT>1.2) busted();
  // heli
  if(s>=5){ if(!G.heli) G.heli={x:G.player.x-500,y:G.player.y-500,a:0}; } else if(G.heli&&s<4) G.heli=null;
}
function spawnCop(){
  const p=G.player;
  for(let tries=0;tries<10;tries++){ const i=(Math.random()*NX)|0, j=(Math.random()*NY)|0; const n=nodePos(i,j); const d=dist(n.x,n.y,p.x,p.y); if(d<650||d>1300||onScreen(n.x,n.y,60)) continue;
    const a=Math.atan2(p.y-n.y,p.x-n.x); const ax=Math.round(a/(Math.PI/2))*(Math.PI/2);
    const c=makeCar('cop',n.x,n.y,ax,null,{driver:'cop',siren:true,ctrl:'cop'}); c.maxMul=0.84+stars()*0.04; return c; }
}
function spawnRoadblock(){
  const p=G.player; const v=p.car?{x:p.car.vx,y:p.car.vy}:{x:p.vx,y:p.vy}; const sp=Math.hypot(v.x,v.y); if(sp<80) return;
  const ahead=clamp(sp*1.8,500,900); const tx=p.x+v.x/sp*ahead, ty=p.y+v.y/sp*ahead; const [i,j]=nearestNode(tx,ty); const n=nodePos(i,j);
  if(onScreen(n.x,n.y,40)) return; const d=Math.abs(v.x)>Math.abs(v.y)?(v.x>0?1:3):(v.y>0?2:0); const dx=DIRS[d][0], dy=DIRS[d][1];
  const hw=dx?hwX(i):hwY(j); const bx=n.x-dx*(hw+40), by=n.y-dy*(hw+40); const perp=Math.atan2(dx,-dy);
  for(const s of [-1,1]){ const x=bx+(-dy)*s*T*0.55, y=by+dx*s*T*0.55; if(carHits(x,y,perp+s*0.3,CARS.cop)) continue; const c=makeCar('cop',x,y,perp+s*0.3,null,{driver:null,siren:true,rb:true}); c.rbT=40;
    makePed(x+dx*-40,y+dy*-40,{cop:true,state:'idle'}); }
  toast('ROADBLOCK AHEAD!','#ff4d6d',1.8);
}
function copCarUpdate(c,dt){
  const p=G.player; const tgt=p.car||p; const tx=tgt.x+(tgt.vx||0)*0.35, ty=tgt.y+(tgt.vy||0)*0.35; const d=dist(c.x,c.y,tgt.x,tgt.y);
  if(G.heat<1){ // give up: drive away along roads, despawn off screen
    c.siren=false; const away=navTarget(c,c.x+(c.x-p.x)*3,c.y+(c.y-p.y)*3); const o=steerTo(c,away.x,away.y,{thr:0.6}); carPhys(c,o.thr,o.steer,o.hb,dt); return; }
  c.navT=(c.navT||0)-dt; let aim;
  if(d<480&&los(c.x,c.y,tgt.x,tgt.y)) aim={x:tx,y:ty}; else aim=navTarget(c,tgt.x,tgt.y);
  const slow=!p.car||p.car.spd<90; const ram=stars()>=3&&p.car;
  const o=steerTo(c,aim.x,aim.y,{stopAt:(!ram&&slow&&d<110)?95:0});
  carPhys(c,o.thr,o.steer,o.hb,dt);
  if(d<120&&c.spd<40&&(!p.car||p.car.spd<60)){ c.exitT=(c.exitT||0)+dt; if(c.exitT>0.6){ c.exitT=0; const q=ejectDriver(c,false); q.state='chase'; c.copCar=true; } }
}
// ---------- shots ----------
function shotsUpdate(dt){
  const p=G.player;
  for(let k=G.shots.length-1;k>=0;k--){ const s=G.shots[k]; s.t-=dt; const ox=s.x, oy=s.y; s.x+=s.vx*dt; s.y+=s.vy*dt; let dead=s.t<=0;
    if(tileAtW(s.x,s.y)===TL.BLD){ dead=true; splat(ox,oy,s.c,10); }
    if(!dead&&s.own==='player'){
      for(const q of G.peds){ if(q.state==='ko')continue; if(dist2(q.x,q.y,s.x,s.y)<15*15){ koPed(q,ox,oy,true,q.cop?'ZAPPED!':'SPLAT!'); splat(q.x,q.y,s.c,14); dead=true; break; } }
      if(!dead) for(const c of G.cars){ if(c===p.car||c.wreck) continue; if(Math.abs(c.x-s.x)<40&&Math.abs(c.y-s.y)<40&&inCar(c,s.x,s.y,2)){ damageCar(c,c.type==='cop'?9:11,true); dead=true; sparks(s.x,s.y,s.c,5); if(c.type==='cop'&&c.driver==='cop') crime(0.15,c.x,c.y,false);
          if(c.driver==='ai'){ toPhys(c); c.panicT=3; } break; } }
    } else if(!dead&&s.own==='cop'){
      if(p.car){ if(inCar(p.car,s.x,s.y,3)){ damageCar(p.car,5,false); dead=true; sparks(s.x,s.y,'#6ad8ff',6); AU.sfxPlay('crash',0.3); } }
      else if(dist2(p.x,p.y,s.x,s.y)<14*14&&p.ko<=0){ hurtPlayer(7); dead=true; sparks(s.x,s.y,'#6ad8ff',8); AU.sfxPlay('stun',0.6); floater(p.x,p.y-18,'ZZT!','#6ad8ff'); }
    }
    if(dead) G.shots.splice(k,1);
  }
}
function splat(x,y,c,r){ G.decals.push({x,y,c,r:r*rr(0.8,1.4),t:40,seed:Math.random()*10}); if(G.decals.length>70)G.decals.shift(); }
function sparks(x,y,c,n){ for(let k=0;k<n;k++){ const a=rr(0,TAU),s=rr(60,220); G.parts.push({k:'spark',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:rr(0.2,0.45),max:0.45,c}); } }
// ---------- car collisions ----------
function carCollisions(){
  const cs=G.cars; const n=cs.length;
  for(let a=0;a<n;a++){ const A=cs[a];
    for(let b=a+1;b<n;b++){ const B=cs[b]; if(Math.abs(A.x-B.x)>70||Math.abs(A.y-B.y)>70) continue;
      if(A.mode==='path'&&B.mode==='path') continue;
      const ca=circ(A), cb=circ(B); let hit=null;
      for(const p of ca) for(const q of cb){ const dx=q[0]-p[0], dy=q[1]-p[1], rs=p[2]+q[2]; const d2=dx*dx+dy*dy; if(d2<rs*rs){ const d=Math.sqrt(d2)||1; const o=rs-d; if(!hit||o>hit.o) hit={nx:dx/d,ny:dy/d,o}; } }
      if(!hit) continue;
      const rv=(B.vx-A.vx)*hit.nx+(B.vy-A.vy)*hit.ny; const imp=-rv;
      if(imp>90){ if(A.mode==='path')toPhys(A); if(B.mode==='path')toPhys(B); }
      const ia=A.mode==='path'?0:1/A.P.mass, ib=B.mode==='path'?0:1/B.P.mass; if(ia+ib===0) continue;
      A.x-=hit.nx*hit.o*ia/(ia+ib); A.y-=hit.ny*hit.o*ia/(ia+ib); B.x+=hit.nx*hit.o*ib/(ia+ib); B.y+=hit.ny*hit.o*ib/(ia+ib);
      if(rv<0){ const j=-(1.35)*rv/(ia+ib); A.vx-=j*ia*hit.nx; A.vy-=j*ia*hit.ny; B.vx+=j*ib*hit.nx; B.vy+=j*ib*hit.ny; }
      if(imp>110&&(A.hitCD<=0||B.hitCD<=0)){ A.hitCD=B.hitCD=0.3; const dmg=(imp-90)*0.08; const pc=G.player.car; damageCar(A,dmg*(B.P.mass/A.P.mass)*(A===pc?0.6:1),B===pc); damageCar(B,dmg*(A.P.mass/B.P.mass)*(B===pc?0.6:1),A===pc);
        AU.sfxPlay('crash',Math.min(1,imp/400)); sparks((A.x+B.x)/2,(A.y+B.y)/2,'#ffd23a',8); if(A===pc||B===pc){ G.shake=Math.max(G.shake,Math.min(12,imp/40)); const o=A===pc?B:A; if(o.type==='cop'&&o.driver==='cop') crime(0.25,o.x,o.y,false); if(o.driver==='ai'){o.panicT=rr(1,2.5);} } }
    } }
}
function circ(c){ const fx=Math.cos(c.a), fy=Math.sin(c.a); const o=c.P.len*0.25, r=c.P.wid/2+(c.type==='bike'?3:1); return [[c.x+fx*o,c.y+fy*o,r],[c.x-fx*o,c.y-fy*o,r]]; }
function carVsPeds(c){
  if(c.spd<40||c.wreck) return; const byP=c===G.player.car;
  for(const q of G.peds){ if(q.state==='ko') continue; if(Math.abs(q.x-c.x)>50||Math.abs(q.y-c.y)>50) continue;
    if(inCar(c,q.x,q.y,7)){ if(c.spd>70) koPed(q,c.x-c.vx*0.1,c.y-c.vy*0.1,byP); else { const l=carLocal(c,q.x,q.y); const s=l[1]>=0?1:-1; q.x+=-Math.sin(c.a)*s*4; q.y+=Math.cos(c.a)*s*4; } } }
}
// ---------- spawning & cleanup ----------
function onScreen(x,y,m){ const v=G.view; return v&&x>v.x0-m&&x<v.x1+m&&y>v.y0-m&&y<v.y1+m; }
function spawnPed(){
  const p=G.player;
  for(let tries=0;tries<8;tries++){ const a=rr(0,TAU), d=rr(480,950); const x=p.x+Math.cos(a)*d, y=p.y+Math.sin(a)*d; const tx=Math.floor(x/T), ty=Math.floor(y/T); if(!isPedT(tileAt(tx,ty))) continue; if(onScreen(x,y,30)) continue;
    const q=makePed((tx+0.5)*T,(ty+0.5)*T); q.tx=q.x;q.ty=q.y; return q; }
}
function spawnParked(){
  const p=G.player; let n=0;
  for(const s of W.parking){ if(s.car&&G.cars.includes(s.car)) continue; s.car=null; const d=dist2(s.x,s.y,p.x,p.y); if(d>1300*1300||d<450*450||onScreen(s.x,s.y,50)) continue;
    if((s.cool||0)>G.time) continue; s.cool=G.time+30;
    if(Math.random()<0.45){ const type=pick(['compact','sports','muscle','taxi','van','bike','sports','muscle']); s.car=makeCar(type,s.x,s.y,s.a+rr(-0.05,0.05),null,{parked:true}); if(++n>2) return; } }
}
function populate(dt){
  G.popT-=dt; if(G.popT>0) return; G.popT=0.4; const p=G.player;
  const traffic=G.cars.filter(c=>c.driver==='ai').length; if(traffic<17) spawnTraffic();
  if(G.peds.filter(q=>!q.cop).length<26) spawnPed();
  spawnParked();
  // cleanup
  for(let k=G.cars.length-1;k>=0;k--){ const c=G.cars[k]; if(c===p.car||c.persist||c.mission) continue; const d=dist2(c.x,c.y,p.x,p.y);
    let far=d>1800*1800; if(c.wreck&&c.wreckT<=0&&!onScreen(c.x,c.y,60)) far=true; if(c.type==='cop'&&G.heat<1&&!onScreen(c.x,c.y,80)&&d>700*700) far=true; if(c.rb&&c.rbT<=0&&!onScreen(c.x,c.y,60)) far=true;
    if(far) G.cars.splice(k,1); }
  for(let k=G.peds.length-1;k>=0;k--){ const q=G.peds[k]; if(q.mission) continue; const d=dist2(q.x,q.y,p.x,p.y); if(d>1300*1300||(q.cop&&q.state==='leave'&&!onScreen(q.x,q.y,40))) G.peds.splice(k,1); }
}
function carsUpdate(dt){
  const p=G.player;
  for(const c of G.cars){ c.hitCD-=dt; if(c.rbT!=null)c.rbT-=dt;
    if(c.wreck){ c.wreckT-=dt; c.vx*=0.95; c.vy*=0.95; carMove(c,dt); if(Math.random()<dt*3) G.parts.push({k:'smoke',x:c.x+rr(-8,8),y:c.y+rr(-6,6),vx:rr(-10,10),vy:rr(-30,-10),t:1.6,max:1.6,r:rr(8,14),c:'#3a3640'}); continue; }
    if(c.burning>0){ c.burning-=dt; if(Math.random()<dt*25) G.parts.push({k:'fire',x:c.x+rr(-c.P.len/3,c.P.len/3),y:c.y+rr(-6,6),vx:rr(-15,15),vy:rr(-50,-20),t:0.6,max:0.6,r:rr(6,12)}); if(c.burning<=0){ explodeCar(c); continue; } }
    else if(c.hp<c.P.hp*0.35&&Math.random()<dt*8) G.parts.push({k:'smoke',x:c.x+Math.cos(c.a)*c.P.len*0.35,y:c.y+Math.sin(c.a)*c.P.len*0.35,vx:rr(-10,10),vy:rr(-30,-10),t:1.2,max:1.2,r:rr(5,10),c:'#6a6470'});
    if(c.driver==='player') { /* handled in playerCar */ }
    else if(c.mode==='path'&&c.driver==='ai') trafficUpdate(c,dt);
    else if(c.driver==='cop'&&c.ctrl==='cop') copCarUpdate(c,dt);
    else if(typeof c.ctrl==='function'){ const o=c.ctrl(c,dt); carPhys(c,o.thr,o.steer,o.hb,dt); }
    else if(c.driver==='ai'&&c.mode==='phys'){ // bumped AI: panic then abandon or keep going
      c.panicT=(c.panicT||2)-dt; carPhys(c,0,0,false,dt); if(c.panicT<=0&&c.spd<20){ if(Math.random()<0.5){ ejectDriver(c,true); } else { c.driver='ai'; c.ctrl=(cc,dt2)=>{ const t=navTarget(cc,cc.x+Math.cos(cc.a)*900,cc.y+Math.sin(cc.a)*900); return steerTo(cc,t.x,t.y,{thr:0.55}); }; } } }
    else carPhys(c,0,0,false,dt);
    if(c.mode==='phys'){ const imp=carMove(c,dt); if(imp>140){ damageCar(c,(imp-140)*0.07,false); if(c===p.car){ AU.sfxPlay('crash',Math.min(1,imp/450)); G.shake=Math.max(G.shake,Math.min(10,imp/45)); sparks(c.x+Math.cos(c.a)*c.P.len/2,c.y+Math.sin(c.a)*c.P.len/2,'#ffd23a',6);} } }
    // skids
    if(c.mode==='phys'&&c.slip>75&&c.spd>90){ const fx=Math.cos(c.a),fy=Math.sin(c.a); for(const s of [-1,1]){ const x=c.x-fx*c.P.len*0.32-fy*s*c.P.wid*0.38, y=c.y-fy*c.P.len*0.32+fx*s*c.P.wid*0.38; const last=c['sk'+s]; if(last&&dist2(last[0],last[1],x,y)<40*40) G.skids.push({x1:last[0],y1:last[1],x2:x,y2:y,t:14}); c['sk'+s]=[x,y]; } if(G.skids.length>600)G.skids.splice(0,G.skids.length-600); if(c===p.car&&Math.random()<dt*14) G.parts.push({k:'smoke',x:c.x-fx*c.P.len*0.4,y:c.y-fy*c.P.len*0.4,vx:rr(-15,15),vy:rr(-15,15),t:0.7,max:0.7,r:rr(5,9),c:'#bdb6cc'}); }
    else { c.sk1=null; c['sk-1']=null; }
    carVsPeds(c);
  }
  carCollisions();
}
function partsUpdate(dt){
  for(let k=G.parts.length-1;k>=0;k--){ const q=G.parts[k]; q.t-=dt; if(q.t<=0){G.parts.splice(k,1);continue;} if(q.vx!=null){ q.x+=q.vx*dt; q.y+=q.vy*dt; const f=q.k==='debris'?0.06:q.k==='puff'?0.12:0.4; q.vx*=Math.pow(f,dt); q.vy*=Math.pow(f,dt);} }
  if(G.parts.length>500) G.parts.splice(0,G.parts.length-500);
  for(let k=G.floaters.length-1;k>=0;k--){ const f=G.floaters[k]; f.t-=dt; f.y-=28*dt; if(f.t<=0)G.floaters.splice(k,1); }
  for(let k=G.skids.length-1;k>=0;k--){ G.skids[k].t-=dt; } while(G.skids.length&&G.skids[0].t<=0) G.skids.shift();
  for(let k=G.decals.length-1;k>=0;k--){ G.decals[k].t-=dt; if(G.decals[k].t<=0)G.decals.splice(k,1); }
}
