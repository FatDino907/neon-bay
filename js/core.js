'use strict';
// ===== NEON BAY: STREET LEGEND — core =====
const VERSION='1.2';
const HERO_NAME='SHANE';
const T=48, MW=100, MH=100;
const TL={ROAD:0,SIDE:1,BLD:2,GRASS:3,BOARD:4,SAND:5,WATER:6,ALLEY:7,LOT:8,PLAZA:9,HWY:10};
const SAVE_KEY='neonbay-save-v1';
const TAU=Math.PI*2;
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
const dist=(ax,ay,bx,by)=>Math.hypot(bx-ax,by-ay);
const dist2=(ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay;return dx*dx+dy*dy;};
function angDiff(a,b){let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;}
const rnd=Math.random, rr=(a,b)=>a+Math.random()*(b-a), pick=a=>a[(Math.random()*a.length)|0];
function fmtCash(n){return '$'+Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');}
function fmtTime(s){s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}

// ----- canvas / screen -----
const cv=document.getElementById('c'); const ctx=cv.getContext('2d');
const SCR={W:390,H:844,dpr:1,u:1,safe:{t:0,r:0,b:0,l:0}};
function resize(){
  const dpr=Math.min(window.devicePixelRatio||1, 2);
  SCR.W=window.innerWidth; SCR.H=window.innerHeight; SCR.dpr=dpr;
  // Size the canvas element to EXACTLY the visible viewport in CSS px. (iOS Safari's 100vh is taller than the
  // visible area while the toolbar shows, which stretched the drawing and shifted every button's hit area.)
  cv.style.width=SCR.W+'px'; cv.style.height=SCR.H+'px';
  cv.width=Math.round(SCR.W*dpr); cv.height=Math.round(SCR.H*dpr);
  SCR.u=clamp(Math.min(SCR.W,SCR.H)/390,0.82,1.5);
  const s=getComputedStyle(document.getElementById('safe'));
  SCR.safe={t:parseFloat(s.paddingTop)||0,r:parseFloat(s.paddingRight)||0,b:parseFloat(s.paddingBottom)||0,l:parseFloat(s.paddingLeft)||0};
  if(typeof UI!=='undefined') UI.layout();
}
window.addEventListener('resize',resize); window.addEventListener('orientationchange',()=>{setTimeout(resize,100);setTimeout(resize,400);});
if(window.visualViewport) window.visualViewport.addEventListener('resize',resize);
function checkSize(){ if(window.innerWidth!==SCR.W||window.innerHeight!==SCR.H) resize(); }

// ----- input -----
const IN={
  pointers:new Map(), // id -> {x,y,role}
  joy:{active:false,id:null,ox:0,oy:0,x:0,y:0,dx:0,dy:0,mag:0},
  btn:{fire:false,punch:false,car:false,sprint:false,gas:false,brake:false,left:false,right:false}, steerV:0,
  pressed:{}, // edge-triggered this frame
  keys:{}, gp:{x:0,y:0,mag:0,btn:{}},
  taps:[], lastInput:'touch'
};
function press(name){IN.pressed[name]=true;}
function hitCircle(x,y,b){return b&&dist(x,y,b.x,b.y)<=b.r*1.25;}
function hitRect(x,y,r){return r&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;}
cv.addEventListener('pointerdown',e=>{
  e.preventDefault(); try{cv.setPointerCapture(e.pointerId);}catch(_){}
  IN.lastInput=e.pointerType==='mouse'?'mouse':'touch';
  try{ if(typeof AU!=='undefined') AU.unlock(); }catch(_){}
  const x=e.clientX,y=e.clientY; const p={x,y,role:'tap',sx:x,sy:y,t:performance.now()};
  IN.pointers.set(e.pointerId,p);
  if(typeof UI!=='undefined') UI.pointerDown(p,e.pointerId);
},{passive:false});
cv.addEventListener('pointermove',e=>{
  const p=IN.pointers.get(e.pointerId); if(!p)return; e.preventDefault();
  const py=p.y; p.x=e.clientX;p.y=e.clientY;
  if(p.role==='menu'&&typeof UI!=='undefined') UI.menuMove(p);
  if(p.role==='scroll'&&typeof UI!=='undefined'){ UI.helpScroll-=(p.y-py); }
  if(p.slide&&p.role&&typeof UI!=='undefined'){ const cur=p.role.slice(4); const k=UI.carHit(p.x,p.y); const pair={left:'right',right:'left',gas:'brake',brake:'gas'};
    if(k&&k===pair[cur]){ IN.btn[cur]=false; IN.btn[k]=true; p.role='btn:'+k; } }
  if(p.role==='joy'){ const J=IN.joy; let dx=p.x-J.ox, dy=p.y-J.oy; const R=UI.joyR(); const m=Math.hypot(dx,dy);
    if(m>R){ // drag the base along (floating stick)
      J.ox=p.x-dx/m*R; J.oy=p.y-dy/m*R; dx=p.x-J.ox; dy=p.y-J.oy; }
    J.x=p.x;J.y=p.y; const mm=Math.min(1,Math.hypot(dx,dy)/R); J.mag=mm<0.12?0:mm; J.dx=dx/(Math.hypot(dx,dy)||1); J.dy=dy/(Math.hypot(dx,dy)||1); }
},{passive:false});
function endPointer(e){
  const p=IN.pointers.get(e.pointerId); if(!p)return; IN.pointers.delete(e.pointerId); const cancel=e.type==='pointercancel';
  if(e.type==='pointerup'){ try{ if(typeof AU!=='undefined') AU.unlock(); }catch(_){} }
  if(p.role==='menu'){ if(!cancel&&p.btn) IN.taps.push({btn:p.btn}); if(typeof UI!=='undefined') UI.pressedBtn=null; return; }
  if(p.role==='scroll') return;
  if(cancel&&p.role==='tap') return;
  if(p.role==='joy'){IN.joy.active=false;IN.joy.id=null;IN.joy.mag=0;}
  else if(p.role&&p.role.startsWith('btn:')){ IN.btn[p.role.slice(4)]=false; }
  else if(p.role==='tap'){ IN.taps.push({x:p.x,y:p.y,sx:p.sx,sy:p.sy}); }
}
cv.addEventListener('pointerup',endPointer); cv.addEventListener('pointercancel',endPointer);
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{ if(typeof UI!=='undefined'&&UI.help){ UI.helpScroll+=e.deltaY; e.preventDefault(); } },{passive:false});
const KEYMAP={KeyE:'car',Enter:'car',KeyF:'car',Space:'fire',KeyJ:'fire',KeyK:'punch',KeyQ:'punch',ShiftLeft:'sprint',ShiftRight:'sprint',KeyH:'horn',Escape:'pause',KeyP:'pause',KeyM:'map',KeyR:'radio',KeyX:'punch'};
window.addEventListener('keydown',e=>{
  if(typeof AU!=='undefined') AU.unlock();
  IN.lastInput='key';
  if(!IN.keys[e.code]){ const a=KEYMAP[e.code]; if(a) press(a); if(e.code==='Space'||e.code==='Enter') press('ok'); if(e.code==='ArrowUp'||e.code==='KeyW')press('up'); if(e.code==='ArrowDown'||e.code==='KeyS')press('down'); if(e.code==='Escape'||e.code==='Backspace')press('back'); }
  IN.keys[e.code]=true;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup',e=>{IN.keys[e.code]=false;});
window.addEventListener('blur',()=>{IN.keys={};});
const GPMAP={0:'punch',1:'sprint',2:'fire',3:'car',7:'fire',6:'sprint',9:'pause',8:'map',5:'radio',4:'horn',12:'up',13:'down'};
function pollGamepad(){
  const gps=navigator.getGamepads?navigator.getGamepads():[]; let g=null;
  for(const q of gps) if(q&&q.connected){g=q;break;}
  const G=IN.gp; if(!g){G.x=G.y=G.mag=0;G.btn={};return;}
  let x=g.axes[0]||0,y=g.axes[1]||0; if(g.buttons[14]&&g.buttons[14].pressed)x=-1; if(g.buttons[15]&&g.buttons[15].pressed)x=1;
  if(g.buttons[12]&&g.buttons[12].pressed)y=-1; if(g.buttons[13]&&g.buttons[13].pressed)y=1;
  const m=Math.hypot(x,y); if(m<0.2){x=y=0;} G.x=x;G.y=y;G.mag=Math.min(1,m<0.2?0:m);
  if(G.mag) IN.lastInput='pad';
  for(const k in GPMAP){ const b=g.buttons[k]; const v=!!(b&&(b.pressed||b.value>0.5)); if(v&&!G.btn[k]){press(GPMAP[k]); if(k==='0') press('ok'); if(k==='1') press('back'); IN.lastInput='pad';} G.btn[k]=v; }
}
// unified move vector: {x,y,mag} ; plus held buttons
function moveVec(){
  let x=0,y=0;
  if(IN.keys.KeyA||IN.keys.ArrowLeft)x-=1; if(IN.keys.KeyD||IN.keys.ArrowRight)x+=1;
  if(IN.keys.KeyW||IN.keys.ArrowUp)y-=1; if(IN.keys.KeyS||IN.keys.ArrowDown)y+=1;
  if(x||y){const m=Math.hypot(x,y);return {x:x/m,y:y/m,mag:1,src:'key'};}
  if(IN.gp.mag) return {x:IN.gp.x/(Math.hypot(IN.gp.x,IN.gp.y)||1),y:IN.gp.y/(Math.hypot(IN.gp.x,IN.gp.y)||1),mag:IN.gp.mag,src:'pad'};
  if(IN.joy.active&&IN.joy.mag) return {x:IN.joy.dx,y:IN.joy.dy,mag:IN.joy.mag,src:'touch'};
  return {x:0,y:0,mag:0,src:'none'};
}
function held(name){
  if(IN.btn[name])return true;
  if(name==='fire'&&(IN.keys.Space||IN.keys.KeyJ||IN.gp.btn[2]||IN.gp.btn[7]))return true;
  if(name==='sprint'&&(IN.keys.ShiftLeft||IN.keys.ShiftRight||IN.gp.btn[1]||IN.gp.btn[6]))return true;
  return false;
}

// ----- save -----
function defaultSave(){return {v:1,cash:250,mission:0,done:[],hoodie:'forest',hoodies:['forest'],paint:'auto',paints:['auto'],tags:[],stats:{busted:0,wiped:0,cars:0,drift:0},radio:0,muted:false,intro:false};}
function loadSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null'); if(s&&s.v===1){return Object.assign(defaultSave(),s);} }catch(e){} return null;}
// ----- settings (separate from the game save so changing them never creates a save) -----
const SETTINGS_KEY='neonbay-settings-v1';
const SETTINGS=(()=>{ let s={}; try{ s=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')||{}; }catch(e){} if(s.carCtl!=='joystick') s.carCtl='pedals'; return s; })();
function saveSettings(){ try{ localStorage.setItem(SETTINGS_KEY,JSON.stringify(SETTINGS)); }catch(e){} }
function setCarCtl(m){ SETTINGS.carCtl=(m==='joystick')?'joystick':'pedals'; saveSettings();
  for(const k of ['gas','brake','left','right','fire','punch','car','sprint']) IN.btn[k]=false; IN.steerV=0; IN.joy.active=false; IN.joy.mag=0;
  for(const [id,p] of IN.pointers){ p.role='none'; } }
function pedalsMode(){ return SETTINGS.carCtl!=='joystick'; }
function writeSave(){ try{ localStorage.setItem(SAVE_KEY,JSON.stringify(G.save)); G.savedAt=G.time; }catch(e){} }

// ----- global game state -----
const G={
  mode:'title', // title | play | paused | map | shop | busted | wiped | ending
  time:0, save:defaultSave(),
  cam:{x:0,y:0,z:0.9,tx:0,ty:0},
  player:null, cars:[], peds:[], shots:[], parts:[], decals:[], skids:[], floaters:[], pickups:[],
  heat:0, seenT:0, unseenT:0, msg:null, msgT:0, banner:null, toast:[],
  savedAt:-99
};
function toast(text,color,dur){ G.toast.push({text,color:color||'#fff',t:dur||2.6,max:dur||2.6}); if(G.toast.length>3)G.toast.shift(); }
function floater(x,y,text,color){ G.floaters.push({x,y,text,color:color||'#fff',t:1.1}); }
