'use strict';
// ===== missions & story =====
function blockCenter(i,j){ const b=W.blocks.find(b=>b.i===i&&b.j===j); return {x:(b.x0+b.x1+1)/2*T,y:(b.y0+b.y1+1)/2*T}; }
const STORY_INTRO=["SHANE just rolled into NEON BAY with a green hoodie, fresh kicks and zero street cred.","In this city, legends are made at night. Time to become one."];
const MISSIONS=[
 {id:'wheels',name:'FRESH WHEELS',giver:'DEX',reward:500,
  where:()=>({x:W.places.hideout.x-2.8*T,y:W.places.hideout.y}),
  call:"Yo Shane! Welcome to the Bay. Grab any ride and scoop me up at Pixel Palace.",
  intro:["DEX: First rule of Neon Bay: you need wheels.","Walk up to any car and hit CAR to hop in."],
  win:"DEX: Not bad, new kid. The boardwalk's ours tonight.",
  start(M){ M.step=0; },
  update(M,dt){ const p=G.player;
    if(M.step===0){ M.obj=p.car?'Drive to PIXEL PALACE':'Get in a car (tap CAR near one)'; M.targets=[{...W.places.arcade,label:'DEX',c:'#ffd23a'}];
      if(p.car&&dist(p.x,p.y,W.places.arcade.x,W.places.arcade.y)<90){ M.step=1; p.car.passenger='dex'; AU.sfxPlay('door'); floater(p.x,p.y-20,'DEX HOPS IN!','#ffd23a'); toast('DEX: To the boardwalk, driver!','#ffd23a',2.5); } }
    else { M.obj=p.car&&p.car.passenger==='dex'?'Drive Dex to the BOARDWALK':'Get back in the car with Dex'; const car=G.cars.find(c=>c.passenger==='dex'); M.targets=[p.car&&p.car.passenger==='dex'?{...W.places.boardwalk,label:'BOARDWALK',c:'#22e6ff'}:car?{x:car.x,y:car.y,label:'DEX',c:'#ffd23a'}:null].filter(Boolean);
      if(!car) return 'fail';
      if(p.car&&p.car.passenger==='dex'&&dist(p.x,p.y,W.places.boardwalk.x,W.places.boardwalk.y)<110){ p.car.passenger=null; return 'win'; } } },
  end(M){ for(const c of G.cars) if(c.passenger==='dex') c.passenger=null; } },
 {id:'delivery',name:'HOT DELIVERY',giver:'MAMA LIN',reward:750,
  where:()=>W.places.noodle,
  call:"Shane! Sneaker emergency at Noodle King. Come quick!",
  intro:["MAMA LIN: These limited-drop sneakers must reach the SKATE PARK.","80 seconds! GO GO GO!"],
  win:"MAMA LIN: Fastest delivery in Bay history! Here's a tip.",
  start(M){ M.timer=80; },
  update(M){ const p=G.player; const s=W.places.skate; M.obj='Deliver the sneakers to the SKATE PARK'; M.targets=[{...s,label:'DROP',c:'#9dff3a'}];
    if(dist(p.x,p.y,s.x,s.y)<120) return 'win'; if(M.timer<=0) return 'fail'; } },
 {id:'tags',name:'NEON TAGS',giver:'PIX',reward:1000,
  where:()=>W.places.beach,
  call:"Want the city to know your name? Tag it. Meet me down on the beach.",
  intro:["PIX: Six neon tag spots glow around the city.","Hit them all before the paint dries!"],
  win:"PIX: SHANE is up on every wall in the Bay. Iconic.",
  start(M){ M.timer=240; M.left=W.mTags.map(t=>({x:t.x,y:t.y})); M.total=M.left.length; },
  update(M){ const p=G.player; M.obj=`Tag the neon spots (${M.total-M.left.length}/${M.total})`;
    for(let k=M.left.length-1;k>=0;k--){ const t=M.left[k]; if(dist(p.x,p.y,t.x,t.y)<60){ M.left.splice(k,1); AU.sfxPlay('spray'); floater(t.x,t.y-20,'TAGGED!','#ff2bd6'); splat(t.x,t.y,'#ff2bd6',26); for(let i=0;i<14;i++){const a=rr(0,TAU);G.parts.push({k:'spark',x:t.x,y:t.y,vx:Math.cos(a)*160,vy:Math.sin(a)*160,t:0.5,max:0.5,c:pick(NEON)});} M.timer+=8; } }
    M.targets=M.left.map(t=>({x:t.x,y:t.y,label:'TAG',c:'#ff2bd6',small:true}));
    if(!M.left.length) return 'win'; if(M.timer<=0) return 'fail'; } },
 {id:'race',name:'MIDNIGHT RACE',giver:'ROOK',reward:1500,
  where:()=>nodePos(2,7),
  call:"Heard there's a new kid in a green hoodie. Bet you can't beat me. Highway. Now.",
  intro:["ROOK: 8 checkpoints. First to the finish owns the night.","Try to keep up."],
  win:"ROOK: ...okay. You're fast. Don't let it go to your head.",
  start(M){ const p=G.player; const s=nodePos(2,7); M.route=[[5,7],[8,7],[8,4],[6,4],[6,1],[2,1],[2,5],[4,5]].map(n=>nodePos(n[0],n[1])); M.cp=0; M.count=3.5; M.noHeat=true;
    if(p.car) exitCar(true); const mine=makeCar('muscle',s.x+T*2.5,s.y+T*0.5,0,'#2f7360',{mission:true,persist:true}); p.x=mine.x; p.y=mine.y; tryEnterCarDirect(mine);
    M.rook=makeCar('sports',s.x+T*2.5,s.y-T*0.5,0,'#ff2bd6',{driver:'npc',mission:true,persist:true,maxMul:0.84}); M.rook.wp=0; M.rookFrozen=true;
    M.rook.ctrl=(c,dt)=>{ if(M.rookFrozen) return {thr:0,steer:0,hb:true}; const w=M.route[c.wp]; const nx=M.route[c.wp+1]; const d=dist(c.x,c.y,w.x,w.y);
      if(d<75){ c.wp++; if(c.wp>=M.route.length){ M.rookDone=true; c.wp=M.route.length-1; } }
      const o=steerTo(c,w.x,w.y); if(nx){ const turn=Math.abs(angDiff(Math.atan2(w.y-c.y,w.x-c.x),Math.atan2(nx.y-w.y,nx.x-w.x))); if(turn>0.8&&d<c.spd*0.55&&c.spd>250) o.thr=-0.6; } return o; };
    G.cars=G.cars.filter(c=>!(c.driver==='ai'&&dist(c.x,c.y,s.x,s.y)<400)); },
  update(M,dt){ const p=G.player;
    if(M.count>0){ M.count-=dt; M.obj='Get ready...'; G.player.car&&(G.player.car.vx*=0.5,G.player.car.vy*=0.5); if(M.count<=0){ M.rookFrozen=false; AU.sfxPlay('check'); floater(p.x,p.y-30,'GO!','#9dff3a'); } }
    else M.obj=`Beat ROOK! Checkpoint ${M.cp+1}/${M.route.length}`;
    const w=M.route[M.cp]; M.targets=[{...w,label:M.cp===M.route.length-1?'FINISH':'CP '+(M.cp+1),c:'#22e6ff',ring:true}, {x:M.rook.x,y:M.rook.y,label:'ROOK',c:'#ff2bd6',blip:true}];
    if(M.count<=0&&dist(p.x,p.y,w.x,w.y)<95){ M.cp++; AU.sfxPlay('check'); if(M.cp>=M.route.length) return 'win'; }
    if(M.rookDone) { M.failText='ROOK crossed the line first!'; return 'fail'; }
    if(M.rook.wreck||M.rook.burning) return 'win'; },
  end(M){ if(M.rook){ M.rook.mission=false; M.rook.persist=false; if(M.rook.driver==='npc'){M.rook.driver='ai'; M.rook.ctrl=null; M.rook.mode='phys'; M.rook.panicT=0.1;} } for(const c of G.cars) if(c.mission&&c!==G.player.car){c.mission=false;c.persist=false;} } },
 {id:'glitch',name:'CATCH GLITCH',giver:'PIX',reward:1500,
  where:()=>({x:W.places.arcade.x+T*2,y:W.places.arcade.y}),
  call:"Glitch swiped the arcade's prize money! Meet me at Pixel Palace!",
  intro:["PIX: Glitch is getting away in a purple van!","Knock his van out (ram it or zap it), then tag him!"],
  win:"PIX: Prize money's back! You're a hero, Shane.",
  start(M){ M.timer=180; M.noHeat=true; const a=W.places.arcade; let n=nearestNode(a.x,a.y); n=[clamp(n[0]+2,0,NX-1),n[1]]; const np=nodePos(n[0],n[1]);
    const v=makeCar('van',np.x,np.y,Math.PI/2,'#7b3ad1',{driver:'npc',mission:true,persist:true,maxMul:0.92}); v.hp=170; v.nav=null; M.target=v; M.van=v;
    v.ctrl=(c,dt)=>{ const p=G.player; c.navT=(c.navT||0)-dt;
      if(!c.goal||dist(c.x,c.y,c.goal.x,c.goal.y)<70){ const [i,j]=c.goalN||nearestNode(c.x,c.y); let best=null,bs=-1e9; for(let d=0;d<4;d++){ const nb=nbr(i,j,d); if(!nb) continue; const q=nodePos(nb[0],nb[1]); const s=dist(q.x,q.y,p.x,p.y)+rr(0,500)-(c.lastN&&c.lastN[0]===nb[0]&&c.lastN[1]===nb[1]?900:0); if(s>bs){bs=s;best=nb;} } c.lastN=[i,j]; c.goalN=best; c.goal=nodePos(best[0],best[1]); }
      return steerTo(c,c.goal.x,c.goal.y); };
    M.targetPed=null; M.onKo=q=>{ if(q===M.targetPed) M.caught=true; }; },
  aimTargets(){ const M=G.mission; return [M.targetPed||M.van].filter(Boolean); },
  update(M,dt){ const p=G.player; const v=M.van;
    if(!M.targetPed&&(v.driver!=='npc')){ // glitch bailed
      const q=makePed(v.x-Math.sin(v.a)*24,v.y+Math.cos(v.a)*24,{state:'flee',fleeT:999,mission:true}); q.look={shirt:'#7b3ad1',pants:'#222',shoes:'#9dff3a',hair:'#22e6ff',skin:'#e0ac80'}; q.from={x:p.x,y:p.y}; M.targetPed=q; v.driver=null; floater(q.x,q.y-20,'GLITCH BAILS!','#b26bff'); }
    if(M.targetPed){ const q=M.targetPed; q.from={x:p.x,y:p.y}; if(q.state==='walk'){q.state='flee';q.fleeT=999;}
      M.obj='Catch GLITCH! (punch or zap him)'; M.targets=[{x:q.x,y:q.y,label:'GLITCH',c:'#b26bff',blip:true}];
      if(M.caught){ q.mission=false; return 'win'; } if(dist(p.x,p.y,q.x,q.y)>1400) { M.failText='Glitch got away!'; return 'fail'; } }
    else { M.obj=`Knock out Glitch's van (${Math.max(0,Math.ceil(v.hp/170*100))}%)`; M.targets=[{x:v.x,y:v.y,label:'GLITCH',c:'#b26bff',blip:true}]; if(dist(p.x,p.y,v.x,v.y)>2200){ M.failText='Glitch got away!'; return 'fail'; } }
    if(M.timer<=0) return 'fail'; },
  end(M){ if(M.van){M.van.mission=false;M.van.persist=false; if(M.van.driver==='npc'){M.van.driver=null;M.van.ctrl=null;}} if(M.targetPed){M.targetPed.mission=false; G.peds.includes(M.targetPed)&&M.targetPed.state!=='ko'&&(M.targetPed.fleeT=3);} } },
 {id:'heat',name:'HEAT CHECK',giver:'DEX',reward:1200,
  where:()=>blockCenter(3,5),
  call:"Bay PD's been asking about you... let's see if you can handle the heat.",
  intro:["DEX: Cops incoming: 3 STARS!","Lose them, or drive through a SPRAY KINGZ respray."],
  win:"DEX: Ice cold. The Bay PD never stood a chance.",
  start(M){ setHeat(3.3); G.copSpawnT=0; M.grace=1; },
  update(M,dt){ M.grace-=dt; M.obj=stars()>0?'Lose the cops! (or hit a RESPRAY)':'';
    M.targets=W.places.respray.map(r=>({...r,label:'RESPRAY',c:'#9dff3a',small:true})); if(M.grace<=0&&G.heat<1) return 'win'; } },
 {id:'legend',name:'STREET LEGEND',giver:'DEX',reward:5000,
  where:()=>({x:W.places.boardwalk.x+T*4,y:W.places.boardwalk.y}),
  call:"This is it, Shane. One last run, then the whole Bay knows your name.",
  intro:["DEX: Hit every checkpoint and land on the PIER before time runs out.","The cops won't make it easy. Take my Vortex GT."],
  win:"The whole city is talking about the kid in the green hoodie.",
  start(M){ const p=G.player; M.route=[[2,6],[5,3],[7,1],[8,5],[5,6]].map(n=>nodePos(n[0],n[1])); M.route.push(W.places.pier); M.cp=0; M.timer=160;
    if(p.car) exitCar(true); const w=M.where?M.where:null; const s={x:W.places.boardwalk.x+T*4,y:W.places.boardwalk.y-T*2.2};
    const car=makeCar('sports',s.x,s.y-T*0.4,-Math.PI/2,'#e0b030',{mission:true,persist:true}); car.hp=180; p.x=car.x;p.y=car.y; tryEnterCarDirect(car); setHeat(2.2); G.copSpawnT=0.5; },
  update(M){ const p=G.player; const w=M.route[M.cp]; M.obj=M.cp===M.route.length-1?'Land on the PIER!':`Checkpoint ${M.cp+1}/${M.route.length}`; M.targets=[{...w,label:M.cp===M.route.length-1?'PIER':'CP '+(M.cp+1),c:'#ffd23a',ring:true}];
    if(dist(p.x,p.y,w.x,w.y)<100){ M.cp++; AU.sfxPlay('check'); M.timer+=4; if(M.cp>=M.route.length){ G.heat=0; return 'win'; } }
    if(M.timer<=0) return 'fail'; },
  end(M){ for(const c of G.cars) if(c.mission&&c!==G.player.car){c.mission=false;c.persist=false;} } }
];
function tryEnterCarDirect(c){ const p=G.player; c.driver='player'; c.persist=true; c.mode='phys'; if(p.lastCar&&p.lastCar!==c)p.lastCar.persist=false; p.car=c; p.lastCar=c; }
function missionAvailable(){ const s=G.save; const out=[]; if(s.mission<MISSIONS.length) out.push({k:s.mission,replay:false}); else MISSIONS.forEach((m,k)=>out.push({k,replay:true})); return out; }
function startMission(k,replay){
  const def=MISSIONS[k]; const M={def,k,replay,obj:'',targets:[],timer:null,t:0}; G.mission=M; G.missionT=0;
  if(def.aimTargets) M.aimTargets=def.aimTargets; def.start(M);
  G.banner={title:def.name,sub:'MISSION '+(k+1)+' / '+MISSIONS.length,t:3}; G.dialog={lines:def.intro.slice(),t:7,who:def.giver}; AU.sfxPlay('check'); G.markerCD=4;
}
function missionUpdate(dt){
  const M=G.mission; if(!M){ // markers
    G.markerCD=(G.markerCD||0)-dt; if(G.markerCD>0) return; const p=G.player;
    for(const a of missionAvailable()){ const w=MISSIONS[a.k].where(); if(dist(p.x,p.y,w.x,w.y)<(p.car?70:44)){ if(G.heat>=1){ if(!G.warnT||G.time>G.warnT){ toast('Lose the cops first!','#ff4d6d',1.6); G.warnT=G.time+3; } return; } if(p.car&&p.car.spd>200) return; startMission(a.k,a.replay); return; } }
    return; }
  M.t+=dt; if(M.timer!=null) M.timer-=dt;
  const r=M.def.update(M,dt); if(r==='win') missionWin(); else if(r==='fail') missionFail(M.failText);
}
function missionWin(){
  const M=G.mission; if(M.def.end) M.def.end(M); G.mission=null; const rew=M.replay?Math.round(M.def.reward/2):M.def.reward;
  G.save.cash+=rew; if(!G.save.done.includes(M.def.id)) G.save.done.push(M.def.id);
  const wasStory=!M.replay&&G.save.mission===M.k; if(wasStory) G.save.mission++;
  G.result={ok:true,title:'MISSION PASSED!',sub:M.def.win,cash:rew,t:4.5}; G.markerCD=4; AU.sfxPlay('pass'); writeSave();
  if(wasStory&&G.save.mission>=MISSIONS.length){ G.endingT=4.6; }
  else if(wasStory){ G.callT=6; }
}
function missionFail(why){
  const M=G.mission; if(!M) return; if(M.def.end) M.def.end(M); G.mission=null; G.result={ok:false,title:'MISSION FAILED',sub:why||(M.timer!=null&&M.timer<=0?'Out of time!':'Give it another shot.'),t:3.5}; AU.sfxPlay('fail'); G.markerCD=3;
}
function phoneCall(){ const k=G.save.mission; if(k>=MISSIONS.length) return; const m=MISSIONS[k]; G.call={who:m.giver,text:m.call,t:7}; AU.sfxPlay('ring'); }
