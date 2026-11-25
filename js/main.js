'use strict';
// ===== main: game flow, update loop, world render =====
function startGame(fresh){
  G.confirmNew=false;
  if(fresh){ const keep=G.save; G.save=defaultSave(); G.save.muted=AU.muted; G.save.radio=keep&&keep.radio!=null?keep.radio:0; writeSave(); }
  else { const s=loadSave(); if(s) G.save=s; }
  AU.setMuted(!!G.save.muted);
  resetWorldState();
  G.mode='play'; UI.help=false;
  if(fresh||!G.save.intro){ G.dialog={lines:STORY_INTRO.slice(),t:0,who:''}; G.save.intro=true; G.callT=7.5; writeSave(); }
  else if(G.save.mission<MISSIONS.length) G.callT=2;
  AU.wantMusic(false);
}
function resetWorldState(){
  G.cars=[]; G.peds=[]; G.shots=[]; G.parts=[]; G.decals=[]; G.skids=[]; G.floaters=[]; G.toast=[]; G.mission=null; G.heat=0; G.bustT=0; G.unseenT=0; G.copSpawnT=0; G.rbT=3; G.heli=null; G.popT=0; G.result=null; G.banner=null; G.call=null; G.callT=0; G.endingT=0;
  for(const s of W.parking){ s.car=null; s.cool=0; }
  const h=W.places.hideout; G.player=makePlayer(h.x,h.y+T*0.6); G.player.a=-Math.PI/2;
  const starter=makeCar('compact',h.x+T*2.2,h.y,-Math.PI/2,'#2f7360',{persist:true}); G.player.lastCar=starter;
  G.cam.x=G.player.x; G.cam.y=G.player.y; G.cam.z=Math.min(SCR.W,SCR.H)/470; computeView();
  G.pickups=[]; let k=0;
  for(const b of W.blocks){ if(b.type==='park'||b.type==='plaza'){ G.pickups.push({k:(k++%3===2)?'armor':'health',x:(b.x0+0.5)*T+T*0.2,y:(b.y0+0.5)*T,cool:0}); } }
  G.pickups.push({k:'armor',x:W.places.hideout.x+T*2.5,y:W.places.hideout.y+T*0.9,cool:0});
  for(const t of W.tagSpots) if(!G.save.tags.includes(t.id)) G.pickups.push({k:'tag',x:t.x,y:t.y,id:t.id,cool:0});
  G.prefill=true; for(let i=0;i<40;i++) spawnTraffic(); for(let i=0;i<30;i++) spawnPed(); G.prefill=false;
  // prefill: allow near spawns once
  for(let n=0;n<14;n++){ const p=G.player; const a=rr(0,TAU), d=rr(80,420); const x=p.x+Math.cos(a)*d, y=p.y+Math.sin(a)*d; const tx=Math.floor(x/T),ty=Math.floor(y/T); if(isPedT(tileAt(tx,ty))){ const q=makePed((tx+0.5)*T,(ty+0.5)*T); q.tx=q.x;q.ty=q.y; } }
  nearTraffic(12);
}
function nearTraffic(n){ const p=G.player; let made=0; for(let tries=0;tries<200&&made<n;tries++){ const i=(Math.random()*NX)|0, j=(Math.random()*NY)|0, d=(Math.random()*4)|0; const nb=nbr(i,j,d); if(!nb) continue; const lane=laneFor(i,j,d); const pc=segPiece(i,j,d,lane); const s=rr(0,pc.len); const [x,y,a]=pieceAt(pc,s); const pd=dist(x,y,p.x,p.y); if(pd<180||pd>1100) continue; if(G.cars.some(c=>dist2(c.x,c.y,x,y)<100*100)) continue;
  const c=makeCar(pick(['compact','taxi','sports','muscle','van','compact','bike']),x,y,a,null,{driver:'ai',mode:'path',spd:rr(80,160)}); c.rt={i,j,d,lane,stage:'seg',pc,s,nd:chooseDir(nb[0],nb[1],d)}; c.cruise=rr(0.85,1.1); made++; } }
function busted(){ if(G.mode!=='play')return; G.mode='busted'; G.overT=3.4; G.overPenalty=Math.min(G.save.cash,200); G.save.stats.busted++; AU.sfxPlay('busted'); if(G.mission) missionFail('Busted!'); G.result=null; }
function wipedOut(){ if(G.mode!=='play')return; G.mode='wiped'; G.overT=3.4; G.overPenalty=Math.min(G.save.cash,100); G.save.stats.wiped++; AU.sfxPlay('fail'); if(G.mission) missionFail('Wiped out!'); G.result=null; }
function respawnHideout(){
  G.save.cash-=G.overPenalty; const p=G.player; if(p.car){ p.car.driver=null; p.car=null; }
  G.heat=0; G.heli=null; G.bustT=0; G.cars=G.cars.filter(c=>c.type!=='cop'||!(c.driver==='cop'||c.rb||c.copCar)); G.peds=G.peds.filter(q=>!q.cop); G.shots=[];
  const h=W.places.hideout; p.x=h.x; p.y=h.y+T*0.6; p.hp=100; p.armor=0; p.ko=0; p.vx=p.vy=0; G.cam.x=p.x; G.cam.y=p.y; G.mode='play'; writeSave(); AU.setSiren(0); AU.setEngine(false,0);
  for(const c of G.cars){ if(!c.persist&&dist(c.x,c.y,p.x,p.y)<300) c.x+=0; }
}
function computeView(){ const z=G.cam.z; const W2=SCR.W/2/z, H2=SCR.H/2/z; G.view={x0:G.cam.x-W2,x1:G.cam.x+W2,y0:G.cam.y-H2,y1:G.cam.y+H2}; }
function placesUpdate(dt){
  const p=G.player; const h=W.places.hideout;
  // hideout save
  if(dist(p.x,p.y,h.x,h.y)<50){ if(!G.atHome){ G.atHome=true; if(!G.mission){ p.hp=100; writeSave(); toast('GAME SAVED · health restored','#22e6ff',2); AU.sfxPlay('coin'); } } } else if(dist(p.x,p.y,h.x,h.y)>110) G.atHome=false;
  // respray
  for(const r of W.places.respray){ const d=dist(p.x,p.y,r.x,r.y);
    if(p.car&&d<60&&!r.busy){ r.busy=true; const c=p.car; const cost=G.heat>=1?100:0;
      if(cost&&G.save.cash<cost){ toast('Respray costs $100!','#ff4d6d',2); continue; }
      G.save.cash-=cost; const pt=PAINTS.find(q=>q.id===G.save.paint); c.color=(pt&&pt.c)?pt.c:pick(CAR_COLORS.filter(x=>x!==c.color)); c.hp=c.P.hp; if(c.type==='cop'){ c.type='sports'; c.P=CARS.sports; }
      const had=G.heat>=1; G.heat=0; G.bustT=0; AU.sfxPlay('spray'); for(let k=0;k<30;k++){ const a=rr(0,TAU); G.parts.push({k:'puff',x:c.x,y:c.y,vx:Math.cos(a)*rr(30,140),vy:Math.sin(a)*rr(30,140),t:1.2,max:1.2,r:rr(10,22),c:pick(NEON)}); }
      toast(had?'FRESH PAINT! HEAT GONE (-$100)':'FRESH PAINT! (free touch-up)','#9dff3a',2.4); if(had){ for(const q of G.peds) if(q.cop) q.state='leave'; } }
    else if(d>140) r.busy=false; }
  // shop
  const s=W.places.shop; const ds=dist(p.x,p.y,s.x,s.y);
  if(!p.car&&ds<42&&!G.shopCD&&!G.mission){ G.mode='shop'; UI.sel=0; AU.sfxPlay('coin'); AU.setEngine(false,0); }
  if(ds>90) G.shopCD=false;
  // pickups
  for(const k of G.pickups){ if(k.cool>G.time) continue; if(dist2(p.x,p.y,k.x,k.y)>(p.car?40*40:26*26)) continue;
    if(k.k==='health'){ if(p.hp>=100) continue; p.hp=Math.min(100,p.hp+50); floater(k.x,k.y-14,'+HEALTH','#ff3d7f'); k.cool=G.time+60; AU.sfxPlay('coin'); }
    else if(k.k==='armor'){ if(p.armor>=100) continue; p.armor=100; floater(k.x,k.y-14,'+ARMOR','#3aa8ff'); k.cool=G.time+90; AU.sfxPlay('coin'); }
    else if(k.k==='tag'){ k.cool=1e12; G.save.tags.push(k.id); G.save.cash+=200; AU.sfxPlay('spray'); toast(`HIDDEN TAG ${G.save.tags.length}/${W.tagSpots.length}  +$200`,'#ff2bd6',2.4); splat(k.x,k.y,'#ff2bd6',24); writeSave(); }
  }
}
function update(dt){
  G.time+=dt; const p=G.player;
  if(p.car) playerCar(dt); else playerFoot(dt);
  carsUpdate(dt); if(p.car){ p.x=p.car.x; p.y=p.car.y; }
  for(const q of G.peds) pedUpdate(q,dt);
  shotsUpdate(dt); partsUpdate(dt); wantedUpdate(dt); missionUpdate(dt); placesUpdate(dt); populate(dt);
  if(G.heli){ const hh=G.heli; hh.x+=(p.x-hh.x)*dt*0.8; hh.y+=(p.y-80-hh.y)*dt*0.8; hh.a+=dt*30; }
  if(p.hurtT>0)p.hurtT-=dt;
  // timers
  for(const t of G.toast) t.t-=dt; G.toast=G.toast.filter(t=>t.t>0);
  if(G.banner){ G.banner.t-=dt; if(G.banner.t<=0)G.banner=null; }
  if(G.result){ G.result.t-=dt; if(G.result.t<=0)G.result=null; }
  if(G.dialog){ G.dialog.lt=(G.dialog.lt||0)+dt; if(G.dialog.lt>4.2){ G.dialog.lt=0; G.dialog.lines.shift(); } if(!G.dialog.lines.length) G.dialog=null; }
  if(G.call){ G.call.t-=dt; if(G.call.t<=0) G.call=null; }
  if(G.callT>0){ G.callT-=dt; if(G.callT<=0&&!G.mission) phoneCall(); }
  if(G.endingT>0){ G.endingT-=dt; if(G.endingT<=0){ G.mode='ending'; G.endT=2; AU.sfxPlay('pass'); } }
  if(IN.pressed.pause) pauseGame(); if(IN.pressed.map){ G.mode='map'; } if(IN.pressed.radio&&p.car) cycleRadio();
  // camera
  const tx=p.car?p.car.x+p.car.vx*0.42:p.x, ty=p.car?p.car.y+p.car.vy*0.42:p.y; const k=Math.min(1,dt*(p.car?4:7));
  G.cam.x+=(tx-G.cam.x)*k; G.cam.y+=(ty-G.cam.y)*k; const spd=p.car?p.car.spd:0; const vis=470*(1+0.55*clamp(spd/600,0,1)); const zt=Math.min(SCR.W,SCR.H)/vis; G.cam.z+=(zt-G.cam.z)*Math.min(1,dt*1.6);
  G.shake=Math.max(0,(G.shake||0)-dt*30); computeView();
  // audio
  AU.setEngine(!!p.car,p.car?p.car.spd:0); AU.setSkid(p.car&&p.car.slip>75&&p.car.spd>90?1:0);
  let sir=0; for(const c of G.cars) if(c.siren&&(c.driver==='cop'||c.rb)){ const d=dist(c.x,c.y,p.x,p.y); sir=Math.max(sir,clamp(1-d/900,0,1)); } AU.setSiren(sir);
  AU.wantMusic(!!p.car,G.save.radio);
}
// ---------- render ----------
let headSpr=null;
function makeHead(){ headSpr=document.createElement('canvas'); headSpr.width=200; headSpr.height=120; const g=headSpr.getContext('2d'); const gr=g.createRadialGradient(0,60,0,0,60,200); gr.addColorStop(0,'rgba(255,240,190,0.45)'); gr.addColorStop(1,'rgba(255,240,190,0)'); g.fillStyle=gr; g.beginPath(); g.moveTo(0,60); g.lineTo(200,0); g.lineTo(200,120); g.closePath(); g.fill(); }
function drawCar(g,c){
  const spr=carSprite(c.type,c.color,c.wreck); g.save(); g.translate(c.x,c.y); g.rotate(c.a); g.drawImage(spr,-(c.P.len/2+4),-(c.P.wid/2+4),c.P.len+8,c.P.wid+8);
  if(c.type==='bike'&&(c.driver)){ g.rotate(0); drawPerson(g,-2,0,0,0,c.driver==='player'?shaneLook():(c.look||(c.look=randomLook())),1.0,'sit'); }
  if(c.type==='cop'&&!c.wreck){ const on=c.siren; const f=(G.time*8|0)%2; g.fillStyle=on?(f?'#ff2244':'#ffffff'):'#661020'; g.fillRect(-6,-c.P.wid/2+3,5,c.P.wid/2-3); g.fillStyle=on?(f?'#ffffff':'#2255ff'):'#102066'; g.fillRect(-6,0,5,c.P.wid/2-3); }
  if(c===G.player.car&&c.passenger==='dex'){ g.fillStyle='#ffd23a'; g.beginPath(); g.arc(2,c.P.wid/4,4,0,TAU); g.fill(); }
  g.restore();
}
function drawCarLights(g,c){
  if(c.wreck||c.type==='bike'&&!c.driver) return; const on=c.driver||c.parked===undefined; if(!c.driver) return;
  g.save(); g.translate(c.x,c.y); g.rotate(c.a); g.drawImage(headSpr,c.P.len/2-2,-c.P.wid*1.6,c.type==='bike'?130:170,c.P.wid*3.2);
  g.drawImage(glowSprite('#ff2a3a',32),-c.P.len/2-10,-c.P.wid/2-6,20,20); g.drawImage(glowSprite('#ff2a3a',32),-c.P.len/2-10,c.P.wid/2-14,20,20);
  if(c.type==='cop'&&c.siren){ const f=(G.time*8|0)%2; g.drawImage(glowSprite(f?'#ff2244':'#2a5bff',64),-50,-50,100,100); }
  g.restore();
}
function render(){
  const g=ctx, dpr=SCR.dpr, W=SCR.W, H=SCR.H; g.setTransform(dpr,0,0,dpr,0,0);
  if(G.mode==='title'){ UI.drawTitle(); return; }
  const z=G.cam.z; const sx=(Math.random()-0.5)*G.shake, sy=(Math.random()-0.5)*G.shake;
  g.fillStyle='#07050d'; g.fillRect(0,0,W,H);
  g.setTransform(dpr*z,0,0,dpr*z,dpr*(W/2-G.cam.x*z+sx),dpr*(H/2-G.cam.y*z+sy));
  const v=G.view; drawGround(g,v);
  // decals & skids
  g.strokeStyle='rgba(0,0,0,0.45)'; g.lineWidth=4; g.beginPath(); for(const s of G.skids){ if(s.x1<v.x0-20||s.x1>v.x1+20||s.y1<v.y0-20||s.y1>v.y1+20)continue; g.moveTo(s.x1,s.y1); g.lineTo(s.x2,s.y2);} g.stroke();
  for(const d of G.decals){ if(d.x<v.x0-40||d.x>v.x1+40||d.y<v.y0-40||d.y>v.y1+40)continue; g.globalAlpha=Math.min(0.85,d.t/5); g.fillStyle=d.c; g.beginPath(); for(let k=0;k<9;k++){ const a=k*TAU/9, r=d.r*(0.6+0.5*Math.abs(Math.sin(d.seed+k*1.7))); g.lineTo(d.x+Math.cos(a)*r,d.y+Math.sin(a)*r);} g.closePath(); g.fill(); g.globalAlpha=1; }
  // pickups
  for(const k of G.pickups){ if(k.cool>G.time||!onScreen(k.x,k.y,30)) continue; const b=Math.sin(G.time*4+k.x)*3; g.globalCompositeOperation='lighter'; g.drawImage(glowSprite(k.k==='health'?'#ff3d7f':k.k==='armor'?'#3aa8ff':'#ff2bd6',64),k.x-26,k.y-26,52,52); g.globalCompositeOperation='source-over';
    if(k.k==='health'){ g.fillStyle='#ff3d7f'; g.fillRect(k.x-9,k.y-3+b,18,6); g.fillRect(k.x-3,k.y-9+b,6,18); }
    else if(k.k==='armor'){ g.fillStyle='#3aa8ff'; g.beginPath(); g.moveTo(k.x-9,k.y-9+b); g.lineTo(k.x+9,k.y-9+b); g.lineTo(k.x+7,k.y+4+b); g.lineTo(k.x,k.y+10+b); g.lineTo(k.x-7,k.y+4+b); g.closePath(); g.fill(); }
    else { g.save(); g.translate(k.x,k.y+b); g.rotate(-0.2); g.font='900 13px Arial Black,Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#ff2bd6'; g.fillText('TAG',0,0); g.strokeStyle='#22e6ff'; g.lineWidth=2; g.strokeRect(-17,-10,34,20); g.restore(); } }
  // markers on ground
  drawMarkers(g,false);
  // peds
  for(const q of G.peds){ if(!onScreen(q.x,q.y,30))continue; drawPerson(g,q.x,q.y,q.a,q.ph,q.look,1,q.state); if(q.cop&&q.state==='chase'&&G.heat>=1){ g.fillStyle='#ffd23a'; g.font='900 12px Arial'; g.textAlign='center'; } }
  const p=G.player; if(!p.car){ if(p.hurtT>0&&(G.time*20%2<1)){} else { g.strokeStyle='rgba(157,255,58,0.35)'; g.lineWidth=2; g.beginPath(); g.arc(p.x,p.y,21,0,TAU); g.stroke(); drawPerson(g,p.x,p.y,p.a,p.ph,shaneLook(),1.45,p.ko>0?'ko':'walk'); } }
  // cars
  for(const c of G.cars){ if(!onScreen(c.x,c.y,60))continue; drawCar(g,c); }
  g.globalCompositeOperation='lighter'; for(const c of G.cars){ if(!onScreen(c.x,c.y,200))continue; drawCarLights(g,c); } g.globalCompositeOperation='source-over';
  // low particles
  drawParts(g,true);
  drawBuildings(g,v,G.cam.x,G.cam.y);
  drawFoliageAndLamps(g,v,G.cam.x,G.cam.y,false); drawFoliageAndLamps(g,v,G.cam.x,G.cam.y,true);
  // shots
  g.globalCompositeOperation='lighter'; for(const s of G.shots){ g.drawImage(glowSprite(s.c,32),s.x-12,s.y-12,24,24); g.fillStyle='#fff'; g.beginPath(); g.arc(s.x,s.y,3,0,TAU); g.fill(); } g.globalCompositeOperation='source-over';
  drawParts(g,false);
  drawMarkers(g,true);
  if(G.heli){ const hh=G.heli; g.globalCompositeOperation='lighter'; g.drawImage(glowSprite('#cfe8ff',128),p.x-95,p.y-95,190,190); g.globalCompositeOperation='source-over'; const k=0.5; const hx=hh.x+(hh.x-G.cam.x)*k, hy=hh.y+(hh.y-G.cam.y)*k;
    g.save(); g.translate(hx,hy); g.fillStyle='rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(30,30,26,14,0,0,TAU); g.fill(); g.fillStyle='#1d2a55'; g.beginPath(); g.ellipse(0,0,24,12,0,0,TAU); g.fill(); g.fillRect(-46,-3,30,6); g.fillStyle='#9ad'; g.beginPath(); g.ellipse(12,0,8,8,0,0,TAU); g.fill(); g.strokeStyle='rgba(200,220,255,0.6)'; g.lineWidth=3; g.rotate(hh.a); g.beginPath(); g.moveTo(-44,0); g.lineTo(44,0); g.moveTo(0,-44); g.lineTo(0,44); g.stroke(); g.restore(); }
  // floaters
  for(const f of G.floaters){ g.globalAlpha=clamp(f.t/0.3,0,1); g.font='900 17px "Arial Black",Arial'; g.textAlign='center'; g.textBaseline='middle'; g.lineWidth=4; g.strokeStyle='#000'; g.strokeText(f.text,f.x,f.y); g.fillStyle=f.color; g.fillText(f.text,f.x,f.y); g.globalAlpha=1; }
  // screen space
  g.setTransform(dpr,0,0,dpr,0,0);
  if(!UI.vign||UI.vignW!==W||UI.vignH!==H){ UI.vign=document.createElement('canvas'); UI.vign.width=W; UI.vign.height=H; UI.vignW=W; UI.vignH=H; const vg=UI.vign.getContext('2d'); const gr=vg.createRadialGradient(W/2,H/2,Math.min(W,H)*0.35,W/2,H/2,Math.max(W,H)*0.75); gr.addColorStop(0,'rgba(10,0,30,0)'); gr.addColorStop(1,'rgba(10,0,30,0.55)'); vg.fillStyle=gr; vg.fillRect(0,0,W,H); }
  g.drawImage(UI.vign,0,0,W,H);
  if(p.hurtT>0){ g.fillStyle=`rgba(255,40,90,${p.hurtT*0.6})`; g.fillRect(0,0,W,H); }
  if(stars()>0){ const f=(G.time*3|0)%2; g.fillStyle=f?'rgba(255,30,60,0.05)':'rgba(40,80,255,0.05)'; g.fillRect(0,0,W,H); }
  drawOffscreenArrows(g);
  UI.buttons=[];
  if(G.mode==='play') UI.drawHUD();
  else if(G.mode==='paused') UI.drawPause();
  else if(G.mode==='map') UI.drawMapScreen();
  else if(G.mode==='shop') UI.drawShop();
  else if(G.mode==='busted'||G.mode==='wiped') UI.drawOver();
  else if(G.mode==='ending') UI.drawEnding();
}
function drawParts(g,low){
  for(const q of G.parts){ const isLow=q.k==='smoke'||q.k==='spark'||q.k==='swoosh'; if(isLow!==low) continue; if(!onScreen(q.x,q.y,60)) continue; const a=clamp(q.t/q.max,0,1);
    switch(q.k){
      case 'smoke': g.globalAlpha=a*0.55; g.fillStyle=q.c; g.beginPath(); g.arc(q.x,q.y,q.r*(1.8-a),0,TAU); g.fill(); break;
      case 'puff': g.globalAlpha=Math.min(1,a*1.4); g.fillStyle=q.c; g.beginPath(); g.arc(q.x,q.y,q.r*(1.4-a*0.5),0,TAU); g.fill(); g.strokeStyle='rgba(60,40,90,0.5)'; g.lineWidth=2; g.stroke(); break;
      case 'fire': g.globalAlpha=a; g.fillStyle=a>0.6?'#fff3a0':a>0.3?'#ffb02e':'#ff4d2b'; g.beginPath(); g.arc(q.x,q.y,q.r*(0.5+a*0.6),0,TAU); g.fill(); break;
      case 'spark': g.globalAlpha=a; g.strokeStyle=q.c; g.lineWidth=2.5; g.beginPath(); g.moveTo(q.x,q.y); g.lineTo(q.x-q.vx*0.04,q.y-q.vy*0.04); g.stroke(); break;
      case 'debris': g.globalAlpha=a; g.save(); g.translate(q.x,q.y); g.rotate(q.rot+=0.2); g.fillStyle=q.c; g.fillRect(-q.r,-q.r/2,q.r*2,q.r); g.restore(); break;
      case 'burst': { g.globalAlpha=a; g.fillStyle='#ffd23a'; g.beginPath(); const R=q.r*(1.2-a); for(let k=0;k<16;k++){ const an=k*TAU/16, r2=k%2?R*0.45:R; g.lineTo(q.x+Math.cos(an)*r2,q.y+Math.sin(an)*r2);} g.closePath(); g.fill(); g.fillStyle='#fff'; g.beginPath(); g.arc(q.x,q.y,R*0.3,0,TAU); g.fill(); break; }
      case 'star': { if(!q.own||q.own.state!=='ko'){q.t=0;break;} const an=q.a0+G.time*5; g.globalAlpha=1; drawStar(g,q.own.x+Math.cos(an)*13,q.own.y+Math.sin(an)*7-14,4,'#ffd23a'); break; }
      case 'swoosh': g.globalAlpha=a; g.strokeStyle='#fff'; g.lineWidth=3; g.beginPath(); g.arc(q.x,q.y,14,q.a-1,q.a+1); g.stroke(); break;
    } }
  g.globalAlpha=1;
}
function drawMarkers(g,top){
  const list=[];
  if(!G.mission){ for(const a of missionAvailable()){ const w=MISSIONS[a.k].where(); list.push({x:w.x,y:w.y,c:a.replay?'#c8a860':'#ffd23a',label:(a.replay?'REPLAY: ':'')+MISSIONS[a.k].name,big:true}); } }
  else for(const t of G.mission.targets){ if(!t.blip) list.push(t); }
  list.push({x:W.places.hideout.x,y:W.places.hideout.y,c:'#22e6ff',label:'HIDEOUT',pad:true});
  for(const r of W.places.respray) list.push({x:r.x,y:r.y,c:'#9dff3a',label:'RESPRAY',pad:true});
  list.push({x:W.places.shop.x,y:W.places.shop.y,c:'#ff2bd6',label:'DRIP SHOP',pad:true});
  for(const m of list){ if(!onScreen(m.x,m.y,120)) continue; const pulse=0.5+0.5*Math.sin(G.time*4);
    if(!top){ const R=m.ring?80:m.pad?40:m.small?24:34; g.globalCompositeOperation='lighter'; g.drawImage(glowSprite(m.c,128),m.x-R*1.6,m.y-R*1.6,R*3.2,R*3.2); g.globalCompositeOperation='source-over';
      g.strokeStyle=m.c; g.lineWidth=m.ring?6:4; g.setLineDash(m.ring?[18,12]:[]); g.lineDashOffset=-G.time*30; g.beginPath(); g.arc(m.x,m.y,R*(0.9+0.1*pulse),0,TAU); g.stroke(); g.setLineDash([]);
      if(m.pad){ g.fillStyle=hexA(m.c,0.18); g.beginPath(); g.arc(m.x,m.y,R,0,TAU); g.fill(); } }
    else { const by=m.y-30-6*pulse; if(m.pad){ g.font='900 13px "Arial Black",Arial'; g.textAlign='center'; g.lineWidth=4; g.strokeStyle='#000'; g.strokeText(m.label,m.x,m.y+4); g.fillStyle=m.c; g.fillText(m.label,m.x,m.y+4); continue; }
      g.fillStyle=m.c; g.beginPath(); g.moveTo(m.x,by+14); g.lineTo(m.x-11,by-4); g.lineTo(m.x+11,by-4); g.closePath(); g.fill(); g.strokeStyle='#000'; g.lineWidth=2; g.stroke();
      if(m.label){ g.font='900 14px "Arial Black",Arial'; g.textAlign='center'; g.lineWidth=4; g.strokeText(m.label,m.x,by-14); g.fillText(m.label,m.x,by-14); } } }
}
function drawOffscreenArrows(g){
  const ts=[]; if(G.mission) ts.push(...G.mission.targets.filter(t=>!t.small)); else for(const a of missionAvailable()) if(!a.replay){ const w=MISSIONS[a.k].where(); ts.push({x:w.x,y:w.y,c:'#ffd23a'}); }
  const u=SCR.u, z=G.cam.z; const W=SCR.W, H=SCR.H;
  for(const t of ts){ const sx=W/2+(t.x-G.cam.x)*z, sy=H/2+(t.y-G.cam.y)*z; if(sx>0&&sx<W&&sy>0&&sy<H) continue;
    const a=Math.atan2(sy-H/2,sx-W/2); const m=30*u; const top=UI.L.mm.y+UI.L.mm.h+70*u, bot=H-SCR.safe.b-250*u; const ex=clamp(W/2+Math.cos(a)*W,m,W-m), ey=clamp(H/2+Math.sin(a)*H,Math.min(top,H/2-20),Math.max(bot,H/2+20));
    g.save(); g.translate(ex,ey); g.rotate(a); g.fillStyle=t.c; g.strokeStyle='#000'; g.lineWidth=2; g.beginPath(); g.moveTo(16*u,0); g.lineTo(-8*u,-11*u); g.lineTo(-3*u,0); g.lineTo(-8*u,11*u); g.closePath(); g.fill(); g.stroke(); g.restore();
    const d=Math.round(dist(G.player.x,G.player.y,t.x,t.y)/16); UI.text(d+'m',ex-Math.cos(a)*24*u,ey-Math.sin(a)*24*u,11*u,t.c,'center'); }
}
// ---------- loop ----------
let last=performance.now(); G.fps=60;
function frame(ts){
  let dt=Math.min(0.05,(ts-last)/1000); last=ts; if(dt<=0)dt=0.001; G.fps=G.fps*0.95+(1/dt)*0.05;
  try{
    pollGamepad(); UI.processTaps();
    if(G.mode==='title'){ G.time+=dt; for(const t of G.toast)t.t-=dt; G.toast=G.toast.filter(t=>t.t>0); if(IN.pressed.back&&UI.help)UI.help=false; }
    else if(G.mode==='play'){ const steps=dt>0.034?2:1; for(let i=0;i<steps;i++){ update(dt/steps); if(i===0){ /* edge inputs only once */ const keep=IN.pressed; IN.pressed={}; if(steps>1) IN.pressedPrev=keep; } } }
    else if(G.mode==='busted'||G.mode==='wiped'){ G.time+=dt; G.overT-=dt; partsUpdate(dt); if(G.overT<=0) respawnHideout(); }
    else if(G.mode==='ending'){ G.time+=dt; G.endT-=dt; }
    else { G.time+=dt*0.0; }
    if(G.mode!=='title'&&G.mode!=='play'&&G.mode!=='busted'&&G.mode!=='wiped'){ AU.setEngine(false,0); AU.setSkid(0); }
    if(G.mode==='title') AU.wantMusic(true,AU.station<3?AU.station:0);
    AU.musicTick();
    render();
  }catch(e){ console.error(e); }
  IN.pressed={};
  requestAnimationFrame(frame);
}
function boot(){
  genWorld(); makeFoliage(); makeHead(); resize();
  const s=loadSave(); if(s){ G.save=s; AU.muted=!!s.muted; }
  UI.portrait=new Image(); UI.portrait.src='img/portrait.jpg';
  const q=new URLSearchParams(location.search); if(q.has('reset')){ localStorage.removeItem(SAVE_KEY); history.replaceState(null,'',location.pathname); }
  G.player=makePlayer(W.places.hideout.x,W.places.hideout.y); computeView();
  requestAnimationFrame(frame);
}
// test hooks
window.__game={G,W,UI,IN,AU,MISSIONS,startGame,startMission,setHeat,stars,busted,exitCar,tryEnterCar,makeCar,update,nodePos,writeSave,loadSave,
  warp(x,y){ const p=G.player; if(p.car){p.car.x=x;p.car.y=y;p.car.vx=p.car.vy=0;} p.x=x;p.y=y; G.cam.x=x;G.cam.y=y; computeView(); },
  state(){ const p=G.player; return {mode:G.mode,x:p.x,y:p.y,inCar:!!p.car,car:p.car&&p.car.type,spd:p.car?p.car.spd:Math.hypot(p.vx,p.vy),hp:p.hp,heat:G.heat,stars:stars(),cash:G.save.cash,mission:G.mission&&G.mission.def.id,obj:G.mission&&G.mission.obj,saveMission:G.save.mission,cars:G.cars.length,peds:G.peds.length,cops:G.cars.filter(c=>c.driver==='cop').length,fps:G.fps}; } };
boot();
