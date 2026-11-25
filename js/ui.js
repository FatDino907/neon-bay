'use strict';
// ===== UI: HUD, touch controls, menus, overlays =====
const WORLD=W;
const FONT='"Arial Black","Helvetica Neue",Arial,sans-serif';
const UI={
  L:{}, buttons:[], sel:0, shopTab:'hoodie', portrait:null, logo:null, vign:null, help:false,
  joyR(){ return 52*SCR.u; },
  layout(){
    const u=SCR.u, W=SCR.W, H=SCR.H, s=SCR.safe; const L=this.L;
    const fx=W-s.r-82*u, fy=H-s.b-102*u;
    L.fire={x:fx,y:fy,r:42*u,id:'fire'};
    L.punch={x:fx-96*u,y:H-s.b-56*u,r:30*u,id:'punch'};
    L.car={x:fx-92*u,y:fy-70*u,r:32*u,id:'car'};
    L.sprint={x:fx+10*u,y:fy-96*u,r:29*u,id:'sprint'};
    L.joy={x:s.l+88*u,y:H-s.b-108*u};
    const mm=(W>H?104:118)*u; L.mm={x:s.l+10*u,y:s.t+10*u,w:mm,h:mm};
    L.pause={x:W-s.r-10*u-38*u,y:s.t+10*u,w:38*u,h:38*u}; L.sound={x:L.pause.x-44*u,y:L.pause.y,w:38*u,h:38*u};
    { const rx0=L.mm.x+L.mm.w+8*u, avail=L.sound.x-8*u-rx0, rw=Math.max(60,Math.min(avail,210*u)); L.radio={x:rx0+(avail-rw)/2,y:s.t+12*u,w:rw,h:30*u}; }
    this.logo=null; this.vign=null;
  },
  pointerDown(p,id){
    if(G.mode!=='play') return;
    const L=this.L; for(const k of ['fire','punch','car','sprint']){ if(hitCircle(p.x,p.y,L[k])){ p.role='btn:'+k; IN.btn[k]=true; press(k); return; } }
    if(hitRect(p.x,p.y,L.mm)||hitRect(p.x,p.y,L.pause)||hitRect(p.x,p.y,L.sound)||(G.player.car&&hitRect(p.x,p.y,L.radio))) return; // taps
    if(p.x<SCR.W*0.55&&p.y>SCR.H*0.3&&!IN.joy.active){ p.role='joy'; const J=IN.joy; J.active=true; J.id=id; J.ox=p.x; J.oy=p.y; J.x=p.x; J.y=p.y; J.mag=0; }
  },
  processTaps(){
    const taps=IN.taps; IN.taps=[];
    for(const t of taps){
      if(Math.hypot(t.x-t.sx,t.y-t.sy)>30) continue;
      if(G.mode==='play'){ const L=this.L;
        if(hitRect(t.x,t.y,L.mm)){ G.mode='map'; AU.sfxPlay('click'); continue; }
        if(hitRect(t.x,t.y,L.pause)){ pauseGame(); continue; }
        if(hitRect(t.x,t.y,L.sound)){ toggleSound(); continue; }
        if(G.player.car&&hitRect(t.x,t.y,L.radio)){ cycleRadio(); continue; }
        if(G.dialog&&t.y<SCR.H*0.5){ G.dialog.lines.shift(); G.dialog.lt=0; if(!G.dialog.lines.length)G.dialog=null; continue; }
        continue; }
      if(G.mode==='map'){ G.mode=G.mapReturn||'play'; G.mapReturn=null; AU.sfxPlay('click'); continue; }
      if(G.mode==='ending'&&G.endT<=0){ G.mode='play'; continue; }
      for(const b of this.buttons){ if(hitRect(t.x,t.y,b)){ AU.sfxPlay('click'); b.fn(); break; } }
    }
    // keyboard / pad menu nav
    if(G.mode!=='play'&&G.mode!=='busted'&&G.mode!=='wiped'){
      const bs=this.buttons.filter(b=>!b.noNav);
      if(IN.pressed.down){ this.sel=(this.sel+1)%Math.max(1,bs.length); }
      if(IN.pressed.up){ this.sel=(this.sel-1+bs.length)%Math.max(1,bs.length); }
      if(IN.pressed.ok&&bs[this.sel]){ AU.sfxPlay('click'); bs[this.sel].fn(); IN.pressed.ok=false; }
      if(IN.pressed.back||IN.pressed.pause){ IN.pressed.back=IN.pressed.pause=false; if(G.mode==='paused'||G.mode==='shop') resumeGame(); else if(G.mode==='map') G.mode=G.mapReturn||'play'; else if(G.mode==='ending'&&G.endT<=0) G.mode='play'; else if(this.help) this.help=false; }
      if(IN.pressed.map&&G.mode==='map'){ G.mode=G.mapReturn||'play'; IN.pressed.map=false; }
    }
  },
  btn(x,y,w,h,label,fn,o){ o=o||{}; const b={x,y,w,h,label,fn,noNav:o.noNav}; this.buttons.push(b); const g=ctx; const u=SCR.u;
    const idx=this.buttons.filter(q=>!q.noNav).indexOf(b); const selected=(IN.lastInput==='key'||IN.lastInput==='pad')&&idx===this.sel;
    g.save(); g.fillStyle=o.fill||(o.primary?'rgba(255,43,214,0.92)':'rgba(20,14,38,0.88)'); roundRect(g,x,y,w,h,12*u); g.fill();
    g.lineWidth=(selected?4:2)*u; g.strokeStyle=selected?'#fff':(o.stroke||(o.primary?'#ffb3f0':'#22e6ff')); g.stroke();
    g.fillStyle=o.color||'#fff'; g.font=`900 ${o.fs||Math.min(20*u,h*0.42)}px ${FONT}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(label,x+w/2,y+h/2+1); g.restore(); return b; },
  // ---------- drawing ----------
  text(t,x,y,size,color,align,stroke){ const g=ctx; g.font=`900 ${size}px ${FONT}`; g.textAlign=align||'left'; g.textBaseline='middle'; if(stroke!==false){ g.lineWidth=Math.max(3,size*0.22); g.strokeStyle='rgba(0,0,0,0.85)'; g.lineJoin='round'; g.strokeText(t,x,y);} g.fillStyle=color||'#fff'; g.fillText(t,x,y); },
  wrap(t,maxW,size){ ctx.font=`900 ${size}px ${FONT}`; const words=t.split(' '); const lines=[]; let cur=''; for(const w of words){ const tt=cur?cur+' '+w:w; if(ctx.measureText(tt).width>maxW&&cur){lines.push(cur);cur=w;} else cur=tt; } if(cur)lines.push(cur); return lines; },
  drawHUD(){
    const g=ctx, u=SCR.u, W=SCR.W, H=SCR.H, L=this.L, p=G.player, s=SCR.safe;
    this.drawMinimap(L.mm.x,L.mm.y,L.mm.w,L.mm.h);
    // pause + sound
    for(const [r,ic] of [[L.pause,'pause'],[L.sound,'sound']]){ g.fillStyle='rgba(12,8,26,0.75)'; roundRect(g,r.x,r.y,r.w,r.h,9*u); g.fill(); g.strokeStyle='rgba(34,230,255,0.6)'; g.lineWidth=1.5*u; g.stroke(); g.fillStyle='#fff';
      const cx=r.x+r.w/2, cy=r.y+r.h/2; if(ic==='pause'){ g.fillRect(cx-7*u,cy-9*u,5*u,18*u); g.fillRect(cx+2*u,cy-9*u,5*u,18*u); }
      else { g.beginPath(); g.moveTo(cx-10*u,cy-4*u); g.lineTo(cx-5*u,cy-4*u); g.lineTo(cx+2*u,cy-10*u); g.lineTo(cx+2*u,cy+10*u); g.lineTo(cx-5*u,cy+4*u); g.lineTo(cx-10*u,cy+4*u); g.closePath(); g.fill();
        if(AU.muted){ g.strokeStyle='#ff4d6d'; g.lineWidth=3*u; g.beginPath(); g.moveTo(cx+5*u,cy-6*u); g.lineTo(cx+12*u,cy+6*u); g.moveTo(cx+12*u,cy-6*u); g.lineTo(cx+5*u,cy+6*u); g.stroke(); } else { g.strokeStyle='#fff'; g.lineWidth=2*u; g.beginPath(); g.arc(cx+3*u,cy,7*u,-0.8,0.8); g.stroke(); } } }
    // radio pill
    if(p.car){ const r=L.radio; const st=STATIONS[G.save.radio]; g.fillStyle='rgba(12,8,26,0.75)'; roundRect(g,r.x,r.y,r.w,r.h,r.h/2); g.fill(); g.strokeStyle=G.save.radio<3?'#ff2bd6':'#666'; g.lineWidth=1.5*u; g.stroke();
      let fs=12*u; g.font=`900 ${fs}px ${FONT}`; const label='♪ '+st.name; while(g.measureText(label).width>r.w-14*u&&fs>8){fs-=0.5;g.font=`900 ${fs}px ${FONT}`;} g.fillStyle=G.save.radio<3?'#fff':'#999'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(label,r.x+r.w/2,r.y+r.h/2+1); }
    // cash / stars / bars
    const rx=W-s.r-12*u; let y=L.pause.y+L.pause.h+20*u;
    { const ph=(p.car?96:66)*u+(p.armor>0?12*u:0); const grd=g.createLinearGradient(rx-150*u,0,rx+12*u,0); grd.addColorStop(0,'rgba(8,4,20,0)'); grd.addColorStop(0.35,'rgba(8,4,20,0.55)'); grd.addColorStop(1,'rgba(8,4,20,0.7)'); g.fillStyle=grd; roundRect(g,rx-150*u,y-16*u,162*u,ph,10*u); g.fill(); }
    this.text(fmtCash(G.save.cash),rx,y,22*u,'#9dff3a','right'); y+=24*u;
    const st=stars(); const flashOff=!G.seen&&st>0&&(G.time*4%2<1);
    for(let k=0;k<5;k++){ const x=rx-k*22*u-9*u; drawStar(g,x,y,9*u,k<st?(flashOff?'#7a6a30':'#ffd23a'):'rgba(255,255,255,0.18)', k<st&&G.starFlash>0); }
    y+=18*u; const bw=118*u; g.fillStyle='rgba(0,0,0,0.6)'; roundRect(g,rx-bw,y,bw,9*u,4*u); g.fill(); g.fillStyle=p.hp>30?'#ff3d7f':(G.time*6%2<1?'#ff3d3d':'#7a1a2a'); roundRect(g,rx-bw,y,bw*clamp(p.hp/100,0,1),9*u,4*u); g.fill();
    if(p.armor>0){ y+=12*u; g.fillStyle='rgba(0,0,0,0.6)'; roundRect(g,rx-bw,y,bw,7*u,3*u); g.fill(); g.fillStyle='#3aa8ff'; roundRect(g,rx-bw,y,bw*clamp(p.armor/100,0,1),7*u,3*u); g.fill(); }
    if(p.car){ y+=13*u; const c=p.car; g.fillStyle='rgba(0,0,0,0.6)'; roundRect(g,rx-bw,y,bw,6*u,3*u); g.fill(); g.fillStyle=c.burning?'#ff7a2b':'#ffd23a'; roundRect(g,rx-bw,y,bw*clamp(c.hp/c.P.hp,0,1),6*u,3*u); g.fill();
      this.text(Math.round(c.spd/6)+' MPH',rx,y+16*u,12*u,'#cfe','right'); }
    // mission objective
    let oy=L.mm.y+L.mm.h+20*u;
    if(G.mission&&G.mission.obj){ const M=G.mission; const lines=this.wrap(M.obj,W-40*u,14*u); const bh=lines.length*18*u+10*u; g.fillStyle='rgba(10,6,24,0.7)'; const bwid=Math.min(W-20*u,Math.max(...lines.map(l=>ctx.measureText(l).width))+30*u);
      roundRect(g,W/2-bwid/2,oy-12*u,bwid,bh,9*u); g.fill(); g.strokeStyle='rgba(255,210,58,0.6)'; g.lineWidth=1.5*u; g.stroke();
      lines.forEach((l,i)=>this.text(l,W/2,oy-12*u+5*u+9*u+i*18*u,14*u,'#ffd23a','center',false)); oy+=bh+4*u;
      if(M.timer!=null){ this.text(fmtTime(M.timer),W/2,oy+12*u,26*u,M.timer<10?(G.time*4%2<1?'#ff4d6d':'#fff'):'#fff','center'); oy+=34*u; }
      if(M.count>0){ this.text(String(Math.ceil(M.count)),W/2,SCR.H*0.4,90*u,'#ffd23a','center'); } }
    // phone call / dialog
    if(G.call){ this.drawCall(oy); oy+=72*u; }
    if(G.dialog&&G.dialog.lines.length){ const lines=this.wrap(G.dialog.lines[0],Math.min(W-50*u,500*u),14*u); const bwid=Math.min(W-20*u,520*u), bh=lines.length*19*u+16*u; const bx=W/2-bwid/2;
      g.fillStyle='rgba(10,6,24,0.85)'; roundRect(g,bx,oy,bwid,bh,10*u); g.fill(); g.strokeStyle='#22e6ff'; g.lineWidth=1.5*u; g.stroke();
      lines.forEach((l,i)=>this.text(l,W/2,oy+8*u+10*u+i*19*u,14*u,'#fff','center',false)); }
    // banner
    if(G.banner){ const b=G.banner; const a=clamp(b.t,0,1); g.globalAlpha=a; this.text(b.sub,W/2,H*0.36-30*u,14*u,'#22e6ff','center'); this.text(b.title,W/2,H*0.36,Math.min(40*u,W*0.09),'#ff2bd6','center'); g.globalAlpha=1; }
    if(G.result){ const r=G.result; const a=clamp(r.t,0,1); g.globalAlpha=a; const yy=H*0.36; g.fillStyle='rgba(8,4,20,0.75)'; roundRect(g,W/2-Math.min(W*0.46,260*u),yy-50*u,Math.min(W*0.92,520*u),r.cash?130*u:105*u,14*u); g.fill();
      this.text(r.title,W/2,yy-18*u,Math.min(34*u,W*0.08),r.ok?'#9dff3a':'#ff4d6d','center'); const sl=this.wrap(r.sub,Math.min(W*0.85,480*u),13*u); sl.forEach((l,i)=>this.text(l,W/2,yy+16*u+i*17*u,13*u,'#fff','center',false));
      if(r.cash) this.text('+'+fmtCash(r.cash),W/2,yy+22*u+sl.length*17*u+8*u,22*u,'#9dff3a','center'); g.globalAlpha=1; }
    // toasts
    G.toast.forEach((t,i)=>{ const a=clamp(t.t/0.4,0,1); g.globalAlpha=a; this.text(t.text,W/2,H*0.47+i*26*u,17*u,t.color,'center'); g.globalAlpha=1; });
    // hint near cars / markers
    this.drawContextHint();
    this.drawControls();
  },
  drawContextHint(){ const p=G.player; if(p.car||p.ko>0) return; let near=null; for(const c of G.cars){ if(c.wreck||c.burning)continue; if(dist(p.x,p.y,c.x,c.y)-c.P.len/2<44){near=c;break;} }
    if(near){ const L=this.L; const g=ctx; g.save(); g.globalAlpha=0.6+0.4*Math.sin(G.time*6); g.strokeStyle='#9dff3a'; g.lineWidth=4*SCR.u; g.beginPath(); g.arc(L.car.x,L.car.y,L.car.r+5*SCR.u,0,TAU); g.stroke(); g.restore(); } },
  drawCall(y){ const g=ctx,u=SCR.u,W=SCR.W; const c=G.call; const bw=Math.min(W-20*u,460*u), bx=W/2-bw/2; const sl=Math.min(1,(7-c.t)*4,c.t*2); g.save(); g.globalAlpha=clamp(sl,0,1);
    g.fillStyle='rgba(16,10,34,0.92)'; roundRect(g,bx,y,bw,64*u,12*u); g.fill(); g.strokeStyle='#9dff3a'; g.lineWidth=2*u; g.stroke();
    g.fillStyle='#9dff3a'; roundRect(g,bx+10*u,y+12*u,26*u,40*u,6*u); g.fill(); g.fillStyle='#10301a'; g.fillRect(bx+14*u,y+18*u,18*u,26*u);
    this.text('INCOMING CALL · '+c.who,bx+46*u,y+15*u,12*u,'#9dff3a','left',false); const lines=this.wrap(c.text,bw-56*u,11.5*u); lines.slice(0,3).forEach((l,i)=>this.text(l,bx+46*u,y+31*u+i*14*u,11.5*u,'#fff','left',false)); g.restore(); },
  drawControls(){
    const g=ctx,u=SCR.u,L=this.L,p=G.player; if(IN.lastInput==='key'||IN.lastInput==='pad'){ if(!this.touchSeen) return; }
    if(IN.lastInput==='touch') this.touchSeen=true; if(!this.touchSeen&&IN.lastInput==='mouse') this.touchSeen=true;
    const J=IN.joy; const jx=J.active?J.ox:L.joy.x, jy=J.active?J.oy:L.joy.y; const R=this.joyR();
    g.fillStyle='rgba(255,255,255,0.07)'; g.strokeStyle='rgba(34,230,255,0.45)'; g.lineWidth=2*u; g.beginPath(); g.arc(jx,jy,R,0,TAU); g.fill(); g.stroke();
    const kx=J.active?jx+J.dx*J.mag*R:jx, ky=J.active?jy+J.dy*J.mag*R:jy; g.fillStyle=J.active?'rgba(34,230,255,0.55)':'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(kx,ky,R*0.45,0,TAU); g.fill();
    if(!J.active){ g.fillStyle='rgba(255,255,255,0.5)'; g.font=`900 ${10*u}px ${FONT}`; g.textAlign='center'; g.fillText(p.car?'STEER':'MOVE',jx,jy+R+12*u); }
    const lab={fire:'ZAP',punch:p.car?'HORN':'PUNCH',car:p.car?'EXIT':'CAR',sprint:p.car?'DRIFT':'RUN'};
    const col={fire:'#ff2bd6',punch:'#ffd23a',car:'#9dff3a',sprint:'#22e6ff'};
    for(const k of ['fire','punch','car','sprint']){ const b=L[k]; const on=IN.btn[k]; g.fillStyle=on?hexA(col[k],0.55):'rgba(10,6,24,0.5)'; g.beginPath(); g.arc(b.x,b.y,b.r,0,TAU); g.fill(); g.strokeStyle=col[k]; g.lineWidth=2.5*u; g.stroke();
      g.fillStyle='#fff'; g.font=`900 ${(k==='fire'?15:11.5)*u}px ${FONT}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(lab[k],b.x,b.y+1); }
  },
  drawMinimap(x,y,w,h,full){
    const g=ctx,u=SCR.u,p=G.player; g.save(); roundRect(g,x,y,w,h,full?6:14*u); g.fillStyle='#0b0818'; g.fill(); g.clip();
    const span=full?Math.max(MW*T/w,MH*T/h):1500/w; const k=1/span; const cx=full?MW*T/2:p.x, cy=full?MH*T/2:p.y;
    g.translate(x+w/2,y+h/2); g.scale(k,k); g.translate(-cx,-cy); g.imageSmoothingEnabled=false; g.drawImage(mmCanvas,0,0,MW*T,MH*T); g.imageSmoothingEnabled=true;
    g.setTransform(SCR.dpr,0,0,SCR.dpr,0,0);
    const toS=(wx,wy)=>[x+w/2+(wx-cx)*k,y+h/2+(wy-cy)*k];
    const blip=(wx,wy,col,r,shape,label,clampIt)=>{ let [sx,sy]=toS(wx,wy); const m=7*u; let out=false; if(clampIt!==false&&!full){ const nx=clamp(sx,x+m,x+w-m), ny=clamp(sy,y+m,y+h-m); out=nx!==sx||ny!==sy; sx=nx;sy=ny; } else if(sx<x||sy<y||sx>x+w||sy>y+h) return;
      g.fillStyle=col; g.strokeStyle='#000'; g.lineWidth=1.5; if(shape==='sq'){g.fillRect(sx-r,sy-r,r*2,r*2);g.strokeRect(sx-r,sy-r,r*2,r*2);} else { g.beginPath(); g.arc(sx,sy,r,0,TAU); g.fill(); g.stroke(); }
      if(label){ g.font=`900 ${r*1.5}px ${FONT}`; g.fillStyle='#000'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(label,sx,sy+0.5); } };
    const R=(full?6:5)*u;
    blip(W.places.hideout.x,W.places.hideout.y,'#22e6ff',R,'sq','H');
    for(const r of W.places.respray) blip(r.x,r.y,'#9dff3a',R,'sq','S',full);
    blip(W.places.shop.x,W.places.shop.y,'#ff2bd6',R,'sq','$',full);
    if(!G.mission) for(const a of missionAvailable()){ const w2=MISSIONS[a.k].where(); blip(w2.x,w2.y,a.replay?'#b8a060':'#ffd23a',R*1.15,'c','!',!a.replay||full); }
    if(G.mission) for(const t of G.mission.targets) blip(t.x,t.y,t.c,t.small?R*0.8:R*1.1,'c',null);
    for(const c of G.cars) if(c.type==='cop'&&(c.driver==='cop'||c.rb)) blip(c.x,c.y,G.time*4%2<1?'#ff3344':'#3a6bff',R*0.8,'c',null,false);
    for(const q of G.peds) if(q.cop&&q.state==='chase') blip(q.x,q.y,G.time*4%2<1?'#ff3344':'#3a6bff',R*0.55,'c',null,false);
    if(full){ const lab=[[W.places.arcade,'PIXEL PALACE'],[W.places.noodle,'NOODLE KING'],[W.places.skate,'SKATE PARK'],[W.places.pier,'PIER'],[W.places.boardwalk,'BOARDWALK'],[W.places.shop,'DRIP'],[W.places.hideout,'HIDEOUT']]; for(const [pl,t] of lab){ const [lx,ly]=toS(pl.x,pl.y); UI.text(t,lx,ly+14*u,9*u,'#fff','center'); } }
    // player arrow
    const [px,py]=toS(p.x,p.y); g.save(); g.translate(px,py); g.rotate(p.a); g.fillStyle='#fff'; g.strokeStyle='#000'; g.lineWidth=1.5; g.beginPath(); g.moveTo(9*u,0); g.lineTo(-6*u,6*u); g.lineTo(-3*u,0); g.lineTo(-6*u,-6*u); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.restore(); g.save(); roundRect(g,x,y,w,h,full?6:14*u); g.strokeStyle=stars()>0?(G.time*4%2<1?'#ff3344':'#3a6bff'):'rgba(34,230,255,0.7)'; g.lineWidth=2*u; g.stroke(); g.restore();
    if(!full){ g.fillStyle='rgba(255,255,255,0.75)'; g.font=`900 ${9*u}px ${FONT}`; g.textAlign='center'; g.fillText('N',x+w/2,y+9*u); }
  },
  drawMapScreen(){ const g=ctx,u=SCR.u,W=SCR.W,H=SCR.H,s=SCR.safe; g.fillStyle='rgba(5,3,14,0.94)'; g.fillRect(0,0,W,H);
    const top=s.t+48*u, bot=H-s.b-60*u; const sz=Math.min(W-24*u,bot-top); const x=W/2-sz/2, y=top+(bot-top-sz)/2;
    this.text('NEON BAY',W/2,s.t+26*u,24*u,'#ff2bd6','center'); this.drawMinimap(x,y,sz,sz,true);
    const items=[['#22e6ff','H  Hideout (save)'],['#9dff3a','S  Respray'],['#ff2bd6','$  Drip Shop'],['#ffd23a','!  Mission']];
    const lw=Math.min(W-20*u,560*u); items.forEach((it,i)=>{ const cols=W>H?4:2; const cx=W/2-lw/2+(i%cols)*(lw/cols)+8*u, cy=bot+16*u+Math.floor(i/cols)*20*u; g.fillStyle=it[0]; g.fillRect(cx,cy-6*u,12*u,12*u); this.text(it[1],cx+18*u,cy,12*u,'#fff','left',false); });
    this.text('tap anywhere to close',W/2,H-s.b-8*u,11*u,'rgba(255,255,255,0.6)','center',false); },
  // ---------- title ----------
  makeLogo(w){ const c=document.createElement('canvas'); const h=Math.round(w*0.52); c.width=w*SCR.dpr; c.height=h*SCR.dpr; const g=c.getContext('2d'); g.scale(SCR.dpr,SCR.dpr);
    g.textAlign='center'; g.textBaseline='middle'; let fs=w*0.23; g.font=`900 ${fs}px ${FONT}`; const tw=g.measureText('NEON BAY').width; if(tw>w*0.8) fs*=w*0.8/tw;
    g.save(); g.translate(w/2,h*0.33); g.transform(1,0,-0.18,1,0,0); g.font=`900 ${fs}px ${FONT}`;
    g.shadowColor='#ff2bd6'; g.shadowBlur=fs*0.35; g.lineWidth=fs*0.07; g.strokeStyle='#ff2bd6'; g.strokeText('NEON BAY',0,0); g.shadowBlur=fs*0.15; g.strokeText('NEON BAY',0,0);
    g.shadowBlur=0; g.fillStyle='#ffe6fa'; g.fillText('NEON BAY',0,0); g.restore();
    g.save(); g.translate(w/2,h*0.66); const t='S T R E E T   L E G E N D'; let f2=fs*0.42; g.font=`900 ${f2}px ${FONT}`; const t2=g.measureText(t).width; if(t2>w*0.86){f2*=w*0.86/t2; g.font=`900 ${f2}px ${FONT}`;} g.shadowColor='#22e6ff'; g.shadowBlur=fs*0.25; g.fillStyle='#22e6ff'; g.fillText(t,0,0); g.shadowBlur=0; g.fillStyle='#e6fdff'; g.globalAlpha=0.7; g.fillText(t,0,0); g.restore();
    g.strokeStyle='#ffd23a'; g.lineWidth=3; g.shadowColor='#ffd23a'; g.shadowBlur=10; g.beginPath(); g.moveTo(w*0.12,h*0.83); g.lineTo(w*0.88,h*0.83); g.stroke(); g.shadowBlur=0;
    g.font=`900 ${fs*0.27}px ${FONT}`; g.fillStyle='#ffd23a'; g.fillText('STARRING  '+HERO_NAME,w/2,h*0.94); return c; },
  drawTitle(){
    const g=ctx,u=SCR.u,W=SCR.W,H=SCR.H,s=SCR.safe; this.buttons=[]; g.fillStyle='#0a0614'; g.fillRect(0,0,W,H);
    const img=this.portrait; const land=W>H*1.1; let logoW, lx, ly, bx, by, bw;
    if(img&&img.complete&&img.naturalWidth){ if(!land){ const sc=Math.max(W/img.naturalWidth,H/img.naturalHeight); const iw=img.naturalWidth*sc, ih=img.naturalHeight*sc; g.drawImage(img,W/2-iw/2,(H-ih)*0.35,iw,ih); }
      else { const ih=H, iw=img.naturalWidth*H/img.naturalHeight; g.drawImage(img,s.l+W*0.02,0,iw,ih); this.pImgW=iw; } }
    if(!land){ const gr=g.createLinearGradient(0,H*0.42,0,H); gr.addColorStop(0,'rgba(10,6,20,0)'); gr.addColorStop(0.35,'rgba(10,6,20,0.7)'); gr.addColorStop(1,'rgba(10,6,20,0.96)'); g.fillStyle=gr; g.fillRect(0,H*0.42,W,H*0.58);
      logoW=Math.min(W*0.94,520*u); lx=W/2-logoW/2; ly=H*0.47; bw=Math.min(W*0.78,320*u); bx=W/2-bw/2; by=ly+logoW*0.52+14*u; }
    else { const left=s.l+W*0.02+(this.pImgW||H*0.56); const gr=g.createLinearGradient(left-80,0,left+60,0); gr.addColorStop(0,'rgba(10,6,20,0)'); gr.addColorStop(1,'rgba(10,6,20,0.95)'); g.fillStyle=gr; g.fillRect(left-80,0,W-left+80,H);
      const area=W-left-s.r; logoW=Math.min(area*0.92,480*u, H*1.0); lx=left+area/2-logoW/2; ly=s.t+H*0.05; bw=Math.min(area*0.7,300*u); bx=left+area/2-bw/2; by=ly+logoW*0.52+10*u; }
    if(!this.logo||this.logoW!==logoW){ this.logo=this.makeLogo(logoW); this.logoW=logoW; }
    g.drawImage(this.logo,lx,ly,logoW,logoW*0.52);
    const bh=Math.min(50*u,(H-s.b-by-30*u)/3.4); const gap=bh*0.24; const save=loadSave();
    let yy=by; if(save){ this.btn(bx,yy,bw,bh,'CONTINUE',()=>startGame(false),{primary:true}); yy+=bh+gap; this.btn(bx,yy,bw,bh,'NEW GAME',()=>{ if(G.confirmNew){startGame(true);} else {G.confirmNew=true; toast('Tap NEW GAME again to start over','#ffd23a',2);} }); }
    else { this.btn(bx,yy,bw,bh,'PLAY',()=>startGame(true),{primary:true}); }
    yy+=bh+gap; this.btn(bx,yy,bw,bh,'HOW TO PLAY',()=>{this.help=true;});
    if(save){ this.text(fmtCash(save.cash)+'  ·  missions '+Math.min(save.mission,MISSIONS.length)+'/'+MISSIONS.length,bx+bw/2,yy+bh+16*u,12*u,'#cfe','center'); }
    this.text('v'+VERSION,W-s.r-8*u,H-s.b-10*u,10*u,'rgba(255,255,255,0.4)','right',false);
    G.toast.forEach((t,i)=>{ this.text(t.text,W/2,H*0.42,15*u,t.color,'center'); });
    if(this.help) this.drawHelp();
  },
  drawHelp(){ const g=ctx,u=SCR.u,W=SCR.W,H=SCR.H,s=SCR.safe; this.buttons=[]; g.fillStyle='rgba(6,3,16,0.95)'; g.fillRect(0,0,W,H);
    const lines=[['TOUCH','#ff2bd6'],['Left thumb: drag anywhere to MOVE / STEER (car drives toward your thumb; pull back to reverse)'],['ZAP: paint-blaster  ·  PUNCH (HORN in car)'],['CAR: hop in / out of any car  ·  RUN (DRIFT in car)'],['Tap the minimap for the big map'],['KEYBOARD','#22e6ff'],['WASD/Arrows move (car: W gas, S brake, A/D steer)'],['E car · Space zap · Q punch · Shift run/drift · M map · R radio · P pause'],['CONTROLLER','#9dff3a'],['Left stick move/steer · X/RT zap · A punch · Y car · B/LT run/drift · Start pause'],['TIPS','#ffd23a'],['Trouble = stars. Hide out of sight or hit a SPRAY KINGZ respray. Walk into the H hideout to save.']];
    const maxW=Math.min(W-40*u,620*u); let y=s.t+30*u; this.text('HOW TO PLAY',W/2,y,24*u,'#ffd23a','center'); y+=30*u; const fs=Math.min(13*u,H/46);
    for(const [t,c] of lines){ if(c){ y+=6*u; this.text(t,W/2,y,fs*1.15,c,'center'); y+=fs*1.5; continue; } for(const l of this.wrap(t,maxW,fs)){ this.text(l,W/2,y,fs,'#fff','center',false); y+=fs*1.4; } }
    const bw=Math.min(220*u,W*0.6); this.btn(W/2-bw/2,Math.min(H-s.b-60*u,y+10*u),bw,44*u,'GOT IT',()=>{this.help=false;},{primary:true}); },
  drawPause(){ const g=ctx,u=SCR.u,W=SCR.W,H=SCR.H,s=SCR.safe; this.buttons=[]; g.fillStyle='rgba(6,3,16,0.86)'; g.fillRect(0,0,W,H);
    if(this.help){ this.drawHelp(); return; }
    const land=W>H; const bw=Math.min(280*u,W*0.7); const bh=Math.min(46*u,(H-s.t-s.b-120*u)/7.2); let y=s.t+Math.max(20*u,(H-s.t-s.b-bh*8.3)/2);
    this.text('PAUSED',W/2,y+12*u,30*u,'#ff2bd6','center'); y+=34*u;
    const sv=G.save; this.text(`${fmtCash(sv.cash)} · missions ${Math.min(sv.mission,MISSIONS.length)}/${MISSIONS.length} · tags ${sv.tags.length}/${WORLD.tagSpots.length}`,W/2,y,12*u,'#cfe','center',false); y+=18*u;
    const bx=W/2-bw/2, gp=bh*0.2;
    const items=[['RESUME',resumeGame,true],['CITY MAP',()=>{G.mapReturn='paused';G.mode='map';}],['RADIO: '+STATIONS[sv.radio].name,cycleRadio],['SOUND: '+(AU.muted?'OFF':'ON'),toggleSound],['HOW TO PLAY',()=>{this.help=true;}],['SAVE & QUIT',()=>{ if(!G.mission) writeSave(); G.mode='title'; AU.wantMusic(true,0); AU.setEngine(false,0); AU.setSiren(0); AU.setSkid(0); }]];
    for(const [l,f,pr] of items){ this.btn(bx,y,bw,bh,l,f,{primary:pr,fs:Math.min(16*u,bh*0.38)}); y+=bh+gp; }
    if(G.mission) this.text('(quitting abandons the current mission)',W/2,y+6*u,10*u,'rgba(255,255,255,0.5)','center',false); },
  drawShop(){ const g=ctx,u=SCR.u,W=SCR.W,H=SCR.H,s=SCR.safe; this.buttons=[]; g.fillStyle='rgba(8,4,20,0.95)'; g.fillRect(0,0,W,H);
    const sv=G.save; let y=s.t+26*u; this.text('DRIP SHOP',W/2,y,28*u,'#ff2bd6','center'); y+=26*u; this.text(fmtCash(sv.cash),W/2,y,18*u,'#9dff3a','center'); y+=22*u;
    const tw=Math.min(150*u,(W-30*u)/2); this.btn(W/2-tw-4*u,y,tw,34*u,'HOODIES',()=>{this.shopTab='hoodie';},{primary:this.shopTab==='hoodie',fs:13*u}); this.btn(W/2+4*u,y,tw,34*u,'CAR PAINT',()=>{this.shopTab='paint';},{primary:this.shopTab==='paint',fs:13*u}); y+=44*u;
    const list=this.shopTab==='hoodie'?HOODIES:PAINTS; const owned=this.shopTab==='hoodie'?sv.hoodies:sv.paints; const eq=this.shopTab==='hoodie'?sv.hoodie:sv.paint;
    const land=W>H; const prevW=land?Math.min(W*0.3,200*u):0;
    if(this.shopTab==='hoodie'){ const pcx=land?s.l+prevW/2+10*u:W/2, pcy=land?H/2:y+44*u; g.fillStyle='rgba(255,43,214,0.12)'; g.beginPath(); g.arc(pcx,pcy,42*u,0,TAU); g.fill(); drawPerson(g,pcx,pcy,-Math.PI/2,G.time*6,shaneLook(),2.6*u,'walk'); if(!land) y+=96*u; }
    else if(!land) y+=6*u;
    const cols=land?3:2; const gx0=land?s.l+prevW+20*u:12*u, gw=(land?W-s.r-12*u-gx0:W-24*u); const cw=(gw-(cols-1)*8*u)/cols; const ch=Math.min(54*u,(H-s.b-70*u-y)/Math.ceil(list.length/cols)-8*u);
    list.forEach((it,i)=>{ const x=gx0+(i%cols)*(cw+8*u), yy=y+Math.floor(i/cols)*(ch+8*u); const own=owned.includes(it.id), on=eq===it.id;
      const b=this.btn(x,yy,cw,ch,'',()=>{ if(on) return; if(own){ if(this.shopTab==='hoodie')sv.hoodie=it.id; else sv.paint=it.id; AU.sfxPlay('click'); writeSave(); } else if(sv.cash>=it.price){ sv.cash-=it.price; owned.push(it.id); if(this.shopTab==='hoodie')sv.hoodie=it.id; else sv.paint=it.id; AU.sfxPlay('buy'); writeSave(); } else { toast('Need '+fmtCash(it.price),'#ff4d6d',1.4); } },{stroke:on?'#9dff3a':undefined});
      g.fillStyle=it.c||'#888'; if(!it.c){ const gr=g.createLinearGradient(x,yy,x+30*u,yy+30*u); NEON.slice(0,4).forEach((c,k)=>gr.addColorStop(k/3,c)); g.fillStyle=gr; } roundRect(g,x+8*u,yy+ch/2-13*u,26*u,26*u,6*u); g.fill(); g.strokeStyle='rgba(255,255,255,0.4)'; g.lineWidth=1; g.stroke();
      this.text(it.name,x+42*u,yy+ch/2-8*u,Math.min(12*u,cw/14),'#fff','left',false); this.text(on?'EQUIPPED':own?'OWNED · tap to wear':fmtCash(it.price),x+42*u,yy+ch/2+10*u,10.5*u,on?'#9dff3a':own?'#22e6ff':'#ffd23a','left',false); });
    if(this.shopTab==='paint') this.text('Paint is sprayed on at any SPRAY KINGZ respray',W/2,H-s.b-74*u,11*u,'#cfe','center',false);
    const bw=Math.min(220*u,W*0.6); this.btn(W/2-bw/2,H-s.b-56*u,bw,44*u,'DONE',resumeGame,{primary:true}); },
  drawOver(){ const g=ctx,u=SCR.u,W=SCR.W,H=SCR.H; const busted=G.mode==='busted'; const t=G.overT;
    g.fillStyle=busted?(G.time*4%2<1?'rgba(255,30,60,0.28)':'rgba(40,80,255,0.28)'):'rgba(20,0,20,0.55)'; g.fillRect(0,0,W,H);
    const sc=1+Math.max(0,(t-2.6))*1.5; g.save(); g.translate(W/2,H*0.4); g.scale(sc,sc); this.text(busted?'BUSTED!':'WIPED OUT!',0,0,Math.min(60*u,W*0.115),busted?'#fff':'#ff2bd6','center'); g.restore();
    this.text(busted?'Bay PD sends '+HERO_NAME+' home.':HERO_NAME+' needs a power nap.',W/2,H*0.4+50*u,15*u,'#fff','center');
    this.text('-'+fmtCash(G.overPenalty)+'  ·  back to the hideout',W/2,H*0.4+76*u,13*u,'#ffd23a','center'); },
  drawEnding(){ const g=ctx,u=SCR.u,W=SCR.W,H=SCR.H,s=SCR.safe; this.buttons=[]; g.fillStyle='rgba(6,3,16,0.92)'; g.fillRect(0,0,W,H);
    const img=this.portrait; const ih=Math.min(H*0.5,W*1.0); if(img&&img.complete){ const iw=ih*img.naturalWidth/img.naturalHeight; g.save(); roundRect(g,W/2-iw/2,s.t+20*u,iw,ih,16*u); g.clip(); g.drawImage(img,W/2-iw/2,s.t+20*u,iw,ih); g.restore(); g.strokeStyle='#ffd23a'; g.lineWidth=3*u; roundRect(g,W/2-iw/2,s.t+20*u,iw,ih,16*u); g.stroke(); }
    let y=s.t+20*u+ih+34*u; this.text(HERO_NAME,W/2,y,40*u,'#ffd23a','center'); y+=34*u; this.text('THE LEGEND OF NEON BAY',W/2,y,Math.min(22*u,W*0.055),'#ff2bd6','center'); y+=28*u;
    for(const l of this.wrap('All 7 missions complete! Free roam is yours: replay missions, find all 12 hidden neon tags and collect every hoodie.',Math.min(W-40*u,500*u),13*u)){ this.text(l,W/2,y,13*u,'#fff','center',false); y+=18*u; }
    if(G.endT<=0) this.text('tap to keep cruising',W/2,Math.min(H-s.b-20*u,y+24*u),13*u,'#22e6ff','center',false); }
};
function drawStar(g,x,y,r,c,pulse){ g.save(); g.translate(x,y); if(pulse) g.scale(1.3,1.3); g.beginPath(); for(let k=0;k<10;k++){ const a=-Math.PI/2+k*Math.PI/5, rr2=k%2?r*0.45:r; g.lineTo(Math.cos(a)*rr2,Math.sin(a)*rr2); } g.closePath(); g.fillStyle=c; g.fill(); g.strokeStyle='rgba(0,0,0,0.8)'; g.lineWidth=1.5; g.stroke(); g.restore(); }
function pauseGame(){ if(G.mode!=='play')return; G.mode='paused'; UI.sel=0; UI.help=false; AU.setEngine(false,0); AU.setSkid(0); AU.setSiren(0); AU.sfxPlay('click'); }
function resumeGame(){ G.mode='play'; UI.help=false; G.shopCD=true; }
function toggleSound(){ AU.setMuted(!AU.muted); G.save.muted=AU.muted; writeSave(); }
function cycleRadio(){ G.save.radio=(G.save.radio+1)%STATIONS.length; AU.wantMusic(!!G.player.car,G.save.radio); toast('♪ '+STATIONS[G.save.radio].name,'#ff2bd6',1.4); writeSave(); }
