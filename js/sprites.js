'use strict';
// ===== sprites: cars + people (all drawn procedurally, original designs) =====
const CARS={
  sports:{name:'VORTEX GT',len:46,wid:22,max:640,acc:540,brake:950,turn:3.3,grip:7.5,hp:100,mass:1.0},
  muscle:{name:'BRAWLER SS',len:50,wid:23,max:610,acc:620,brake:850,turn:2.9,grip:4.0,hp:120,mass:1.2},
  taxi:{name:'BAY CAB',len:48,wid:22,max:470,acc:400,brake:800,turn:2.8,grip:6,hp:110,mass:1.1},
  van:{name:'HAUL-VAN',len:56,wid:26,max:400,acc:320,brake:700,turn:2.4,grip:6,hp:160,mass:1.6},
  cop:{name:'BAY PD CRUISER',len:50,wid:23,max:600,acc:540,brake:900,turn:3.0,grip:6.5,hp:130,mass:1.3},
  bike:{name:'ZIPLINE 600',len:30,wid:12,max:660,acc:640,brake:950,turn:3.8,grip:8,hp:60,mass:0.5},
  compact:{name:'BUBBLE',len:40,wid:21,max:440,acc:380,brake:800,turn:3.0,grip:6,hp:90,mass:0.9},
};
const CAR_COLORS=['#e0283a','#1fa0ff','#f0f0f4','#2a2a33','#ffcf3a','#7a3ad1','#18c08a','#ff7a2b','#9aa3b5','#ff4fa0','#3a5aa8','#5a2a2a'];
const HOODIES=[{id:'forest',name:'Forest Green',c:'#2f7360',price:0},{id:'midnight',name:'Midnight Black',c:'#26262e',price:200},{id:'pink',name:'Neon Pink',c:'#e0329b',price:350},{id:'blue',name:'Electric Blue',c:'#2a6df0',price:350},{id:'orange',name:'Sunset Orange',c:'#f07a2a',price:400},{id:'purple',name:'Purple Haze',c:'#7b3ad1',price:450},{id:'white',name:'Cloud White',c:'#e4e4ec',price:500},{id:'gold',name:'Legend Gold',c:'#e8b830',price:1500}];
const PAINTS=[{id:'auto',name:'Surprise Me',c:null,price:0},{id:'red',name:'Candy Red',c:'#e0283a',price:150},{id:'lime',name:'Toxic Lime',c:'#7dff2a',price:300},{id:'cyan',name:'Laser Cyan',c:'#1fd6ff',price:300},{id:'magenta',name:'Hot Magenta',c:'#ff2bd6',price:300},{id:'matte',name:'Matte Black',c:'#18181e',price:500},{id:'pearl',name:'Pearl White',c:'#f0f0ff',price:500},{id:'gold',name:'Gold Flake',c:'#e0b030',price:1200}];
function shade(c,f){ const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16); const s=v=>Math.round(clamp(f<0?v*(1+f):v+(255-v)*f,0,255)); return `rgb(${s(r)},${s(g)},${s(b)})`; }
const carSprCache=new Map(); const CS=2;
function carSprite(type,color,wreck){
  const key=type+color+(wreck?'w':''); if(carSprCache.has(key))return carSprCache.get(key);
  const P=CARS[type]; const L=P.len, Wd=P.wid; const c=document.createElement('canvas'); c.width=(L+8)*CS; c.height=(Wd+8)*CS;
  const g=c.getContext('2d'); g.scale(CS,CS); g.translate(L/2+4,Wd/2+4);
  const body=wreck?'#2a2522':color, dark=wreck?'#141210':shade(color,-0.45), light=wreck?'#3a332e':shade(color,0.35);
  g.fillStyle='rgba(0,0,0,0.35)'; roundRect(g,-L/2+1,-Wd/2+2,L,Wd,6); g.fill();
  if(type==='bike'){
    g.fillStyle='#111'; roundRect(g,-L/2,-2.5,7,5,2); g.fill(); roundRect(g,L/2-7,-2.5,7,5,2); g.fill();
    g.fillStyle=body; roundRect(g,-L/2+5,-Wd/2+1,L-10,Wd-2,4); g.fill(); g.fillStyle=light; roundRect(g,2,-3,8,6,3); g.fill();
    g.strokeStyle='#bbb'; g.lineWidth=1.5; g.beginPath(); g.moveTo(L/2-9,-Wd/2-1); g.lineTo(L/2-9,Wd/2+1); g.stroke();
    g.fillStyle='#fff8c0'; g.fillRect(L/2-2,-1.5,2,3);
  } else {
    // body
    const gr=g.createLinearGradient(0,-Wd/2,0,Wd/2); gr.addColorStop(0,light); gr.addColorStop(0.5,body); gr.addColorStop(1,dark);
    g.fillStyle=gr; roundRect(g,-L/2,-Wd/2,L,Wd,type==='van'?4:7); g.fill();
    g.strokeStyle='rgba(0,0,0,0.5)'; g.lineWidth=1; g.stroke();
    // wheels peeking
    g.fillStyle='#0a0a0a'; for(const sx of [-L*0.3,L*0.3]) for(const sy of [-1,1]) g.fillRect(sx-5,sy*(Wd/2)-(sy>0?1:2),10,3);
    if(type==='van'){
      g.fillStyle='#1a2a44'; g.fillRect(L/2-14,-Wd/2+3,7,Wd-6); g.fillStyle=light; g.fillRect(-L/2+4,-Wd/2+3,L-20,Wd-6); g.fillStyle='rgba(0,0,0,0.15)'; for(let k=0;k<4;k++)g.fillRect(-L/2+8+k*9,-Wd/2+3,1,Wd-6);
    } else {
      const ws=type==='sports'?0.1:0.16;
      g.fillStyle=wreck?'#111':'#16233a'; g.beginPath(); g.moveTo(L*ws,-Wd/2+3); g.lineTo(L*(ws+0.16),-Wd/2+4.5); g.lineTo(L*(ws+0.16),Wd/2-4.5); g.lineTo(L*ws,Wd/2-3); g.closePath(); g.fill(); // windshield
      g.fillStyle=wreck?'#111':'#203252'; g.fillRect(-L*0.36,-Wd/2+4,L*0.1,Wd-8); // rear window
      g.fillStyle=type==='cop'?'#f4f4f8':light; roundRect(g,-L*0.26,-Wd/2+3.5,L*0.36,Wd-7,3); g.fill(); // roof
      g.fillStyle='rgba(255,255,255,0.25)'; g.fillRect(L*(ws+0.02),-Wd/2+4,2,Wd-8);
      if(type==='sports'){ g.fillStyle=dark; g.fillRect(-L/2+1,-Wd/2+2,3,Wd-4); g.fillStyle='rgba(255,255,255,0.7)'; g.fillRect(-L/2+8,-1.5,L-10,3); }
      if(type==='muscle'){ g.fillStyle='rgba(255,255,255,0.8)'; g.fillRect(L*0.12,-3.5,L*0.36,2.5); g.fillRect(L*0.12,1,L*0.36,2.5); g.fillRect(-L/2+2,-3.5,L*0.2,2.5); g.fillRect(-L/2+2,1,L*0.2,2.5); g.fillStyle='#222'; g.fillRect(L*0.2,-2,6,4); }
      if(type==='taxi'){ g.fillStyle='#111'; for(let k=0;k<6;k++) g.fillRect(-L*0.2+k*3,(k%2?-1:1)*Wd/2-(k%2?0:2),3,2); g.fillStyle='#ff2bd6'; roundRect(g,-L*0.12,-4,9,8,2); g.fill(); g.fillStyle='#fff'; g.font='bold 5px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.save(); g.rotate(Math.PI/2); g.fillText('CAB',0,L*0.075); g.restore(); }
      if(type==='cop'){ g.fillStyle='#111'; g.fillRect(-L/2+1,-Wd/2+1,L*0.22,Wd-2); g.fillRect(L*0.32,-Wd/2+1,L*0.17,Wd-2); g.fillStyle='#1b3a8a'; g.font='bold 6px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.save(); g.rotate(Math.PI/2); g.fillText('BPD',0,L*0.06); g.restore(); }
    }
    g.fillStyle=wreck?'#333':'#fff8d0'; g.fillRect(L/2-2,-Wd/2+2,2,4); g.fillRect(L/2-2,Wd/2-6,2,4);
    g.fillStyle=wreck?'#300':'#ff2a3a'; g.fillRect(-L/2,-Wd/2+2,2,4); g.fillRect(-L/2,Wd/2-6,2,4);
    if(wreck){ g.fillStyle='rgba(0,0,0,0.5)'; for(let k=0;k<6;k++){ g.beginPath(); g.arc((Math.random()-0.5)*L*0.8,(Math.random()-0.5)*Wd*0.7,3+Math.random()*4,0,TAU); g.fill(); } }
  }
  carSprCache.set(key,c); return c;
}
// ---------- people ----------
const SKINS=['#f1c9a5','#e0ac80','#c68e5e','#8d5a3b','#5c3a24','#f5d6bd'];
function randomLook(){ return {shirt:pick(['#d33a5a','#3a7bd5','#e8e8e8','#ffb02e','#7b3ad1','#24b37a','#ff6fb0','#444','#2ad1d1']),pants:pick(['#223','#3a4a6a','#555','#6a4a2a','#1d2a44']),shoes:pick(['#eee','#222','#a33','#334']),hair:pick(['#1a120c','#3a2416','#6b4a2a','#c9a050','#111','#8a3a1a','#d9d9d9']),skin:pick(SKINS)}; }
function shaneLook(){ const h=HOODIES.find(o=>o.id===G.save.hoodie)||HOODIES[0]; return {shirt:h.c,pants:'#121216',shoes:'#7d2030',hair:'#e6c063',hairDark:'#5a3d22',skin:'#f0c9a8',shane:true,hood:true}; }
const COP_LOOK={shirt:'#1d3b8a',pants:'#141a2e',shoes:'#111',hair:'#222',skin:'#d9a27a',cap:'#152a66'};
function drawPerson(g,x,y,a,ph,look,sc,state){
  g.save(); g.translate(x,y); sc=sc||1; g.scale(sc,sc);
  if(state==='ko'){ g.rotate(G.time*6); }
  else g.rotate(a);
  g.fillStyle='rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(2,3,11,13,0,0,TAU); g.fill();
  const sw=Math.sin(ph)*6;
  // legs + shoes
  for(const s of [-1,1]){ const fx=s*sw; g.fillStyle=look.pants; roundRect(g,-3+Math.min(0,fx),s*5.5-(look.shane?3.8:3.2),10+Math.abs(fx),look.shane?7.6:6.4,3); g.fill(); g.fillStyle=look.shoes; g.beginPath(); g.ellipse(8+fx,s*5.5,4.6,3.1,0,0,TAU); g.fill(); if(look.shane){ g.fillStyle='rgba(255,255,255,0.55)'; g.fillRect(10+fx,s*5.5-0.6,2.2,1.2);} }
  // arms
  for(const s of [-1,1]){ const fx=-s*sw*0.8; g.fillStyle=shade(look.shirt.length===7?look.shirt:'#444444',-0.18); roundRect(g,-3+Math.min(0,fx),s*11-3,7+Math.abs(fx),6,3); g.fill(); g.fillStyle=look.skin; g.beginPath(); g.arc(5+fx,s*11,2.4,0,TAU); g.fill(); }
  // torso
  g.fillStyle=look.shirt; g.beginPath(); g.ellipse(-1,0,7.5,12.5,0,0,TAU); g.fill();
  if(look.hood){ g.fillStyle=shade(look.shirt,-0.25); g.beginPath(); g.ellipse(-6.5,0,4.5,7,0,0,TAU); g.fill(); g.strokeStyle=shade(look.shirt,0.35); g.lineWidth=1; g.beginPath(); g.moveTo(5,-3); g.lineTo(7.5,-2); g.moveTo(5,3); g.lineTo(7.5,2); g.stroke(); }
  // head
  if(look.shane){
    g.fillStyle=look.skin; g.beginPath(); g.ellipse(3.2,0,3.2,4.2,0,0,TAU); g.fill(); // face peeking forward
    g.fillStyle=look.hairDark; g.beginPath(); g.ellipse(0,0,6.2,6.6,0,0,TAU); g.fill();
    const curls=[[1.5,0,3.4],[-1.2,-2.2,2.9],[-1.2,2.2,2.9],[2.4,-2.6,2.5],[2.4,2.6,2.5],[-3.4,0,2.6],[4,0,2.3],[0.4,-3.8,2],[0.4,3.8,2]];
    for(const [cx,cy,r] of curls){ g.fillStyle='#d9a84a'; g.beginPath(); g.arc(cx,cy,r,0,TAU); g.fill(); }
    for(const [cx,cy,r] of curls){ g.fillStyle=look.hair; g.beginPath(); g.arc(cx-0.4,cy-0.4,r*0.72,0,TAU); g.fill(); }
    g.fillStyle='#fff2b8'; g.beginPath(); g.arc(0.6,-1.2,1.1,0,TAU); g.fill(); g.beginPath(); g.arc(2.5,1.6,0.9,0,TAU); g.fill();
  } else {
    g.fillStyle=look.skin; g.beginPath(); g.arc(1,0,6,0,TAU); g.fill();
    if(look.cap){ g.fillStyle=look.cap; g.beginPath(); g.arc(0,0,6.3,0,TAU); g.fill(); g.fillRect(3,-5,5,10); g.fillStyle='#ffd23a'; g.beginPath(); g.arc(0.5,0,1.6,0,TAU); g.fill(); }
    else { g.fillStyle=look.hair; g.beginPath(); g.arc(-0.5,0,5.6,0,TAU); g.fill(); }
  }
  g.restore();
}
