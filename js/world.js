'use strict';
// ===== world: map generation, road graph, rendering of ground + buildings =====
const XC=[2,11,23,35,47,59,71,83,98], XW=[4,2,2,2,2,2,2,2,4];
const YC=[2,11,23,35,47,59,71,82],     YW=[4,2,2,2,2,2,2,4];
const NX=XC.length, NY=YC.length;
const W={map:new Uint8Array(MW*MH), rv:new Int8Array(MW*MH).fill(-1), rh:new Int8Array(MW*MH).fill(-1),
  blocks:[], buildings:[], palms:[], trees:[], lamps:[], props:[], places:{}, parking:[], tagSpots:[], mTags:[], lights:[]};
const NEON=['#ff2bd6','#22e6ff','#9dff3a','#ffd23a','#b26bff','#ff7a2b','#ff4d6d','#3affc2'];
const SHOPS=['LASER BOWL','TACO LOCO','VHS VAULT','HOTEL NOVA','KARAOKE','SUSHI 88','24/7','CHROME','GYM RAT','PIZZA ZONE','MOTEL','BOBA','DINER','WAVES','DISCO','CYBER CAFE','RAMEN','GELATO','JUICE','RECORDS','TATTOO','LAUNDRY','BURGERS','KICKS'];
function tileAt(tx,ty){ if(tx<0||ty<0||tx>=MW||ty>=MH) return TL.BLD; return W.map[ty*MW+tx]; }
function tileAtW(x,y){ return tileAt(Math.floor(x/T),Math.floor(y/T)); }
function solidT(t){ return t===TL.BLD||t===TL.WATER; }
function solidAt(x,y){ return solidT(tileAtW(x,y)); }
function isRoadT(t){ return t===TL.ROAD||t===TL.HWY; }
function isPedT(t){ return t===TL.SIDE||t===TL.PLAZA||t===TL.BOARD||t===TL.GRASS; }
function nodePos(i,j){ return {x:XC[i]*T,y:YC[j]*T}; }
function nearestNode(x,y){ let bi=0,bj=0,bd=1e18; for(let i=0;i<NX;i++)for(let j=0;j<NY;j++){const d=dist2(x,y,XC[i]*T,YC[j]*T); if(d<bd){bd=d;bi=i;bj=j;}} return [bi,bj]; }
function los(x1,y1,x2,y2){ const d=dist(x1,y1,x2,y2); const n=Math.ceil(d/22); for(let k=1;k<n;k++){ const t=k/n; if(tileAtW(lerp(x1,x2,t),lerp(y1,y2,t))===TL.BLD) return false; } return true; }
function hwX(i){return XW[i]/2*T;} function hwY(j){return YW[j]/2*T;}

function genWorld(){
  const R=mulberry(1337); const m=W.map;
  const set=(x,y,t)=>{ if(x>=0&&y>=0&&x<MW&&y<MH) m[y*MW+x]=t; };
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++) m[y*MW+x]= y>=90?TL.WATER: y>=86?TL.SAND: y>=84?TL.BOARD: TL.BLD;
  for(let i=0;i<NX;i++){ for(let tx=XC[i]-XW[i]/2; tx<XC[i]+XW[i]/2; tx++) for(let ty=0;ty<=83;ty++){ set(tx,ty,XW[i]===4?TL.HWY:TL.ROAD); W.rv[ty*MW+tx]=i; } }
  for(let j=0;j<NY;j++){ for(let ty=YC[j]-YW[j]/2; ty<YC[j]+YW[j]/2; ty++) for(let tx=0;tx<MW;tx++){ const cur=m[ty*MW+tx]; set(tx,ty,(YW[j]===4||cur===TL.HWY)?TL.HWY:TL.ROAD); W.rh[ty*MW+tx]=j; } }
  for(let y=0;y<=83;y++)for(let x=0;x<MW;x++){ if(m[y*MW+x]!==TL.BLD) continue; let adj=false;
    for(let dy=-1;dy<=1&&!adj;dy++)for(let dx=-1;dx<=1;dx++){ if(isRoadT(tileAt(x+dx,y+dy))){adj=true;break;} } if(adj) m[y*MW+x]=TL.SIDE; }
  // pier
  for(let y=86;y<=97;y++)for(let x=46;x<=49;x++) set(x,y,TL.BOARD);
  for(let y=94;y<=97;y++)for(let x=43;x<=52;x++) set(x,y,TL.BOARD);
  // blocks
  const SPECIAL={'3,3':'hideout','1,1':'respray','6,5':'respray','2,2':'shop','5,1':'arcade','1,4':'noodle','6,2':'skate','4,5':'park','2,6':'park','0,2':'park','7,4':'park','4,0':'lot','0,5':'lot','5,6':'lot','7,1':'lot','3,5':'plaza','6,0':'lot','2,4':'lot'};
  const SPECIAL_SIGNS={hideout:['THE LOFT','#22e6ff'],respray:['SPRAY KINGZ','#9dff3a'],shop:['DRIP','#ff2bd6'],arcade:['PIXEL PALACE','#ffd23a'],noodle:['NOODLE KING','#ff7a2b']};
  let shopN=0;
  for(let i=0;i<NX-1;i++)for(let j=0;j<NY-1;j++){
    const x0=XC[i]+XW[i]/2+1, x1=XC[i+1]-XW[i+1]/2-2, y0=YC[j]+YW[j]/2+1, y1=YC[j+1]-YW[j+1]/2-2;
    let type=SPECIAL[i+','+j]; if(!type){ const r=R(); type=r<0.1?'park':r<0.2?'lot':'bld'; }
    const B={i,j,x0,y0,x1,y1,type}; W.blocks.push(B);
    const fill=t=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)set(x,y,t);};
    const cx=(x0+x1+1)/2*T, cy=(y0+y1+1)/2*T;
    if(type==='bld'){
      const leaves=[]; const split=(x,y,w,h,d)=>{
        if((w*h<=24&&R()<0.7)||d>2||(w<6&&h<6)){leaves.push([x,y,w,h]);return;}
        const vert=w>h?true:w<h?false:R()<0.5; const L=vert?w:h; if(L<6){leaves.push([x,y,w,h]);return;}
        const alley=d===0&&L>=7&&R()<0.45; const c=3+Math.floor(R()*(L-5-(alley?1:0)));
        if(vert){ split(x,y,c,h,d+1); if(alley){for(let yy=y;yy<y+h;yy++)set(x+c,yy,TL.ALLEY);} split(x+c+(alley?1:0),y,w-c-(alley?1:0),h,d+1);} 
        else { split(x,y,w,c,d+1); if(alley){for(let xx=x;xx<x+w;xx++)set(xx,y+c,TL.ALLEY);} split(x,y+c+(alley?1:0),w,h-c-(alley?1:0),d+1);} };
      split(x0,y0,x1-x0+1,y1-y0+1,0);
      // alleys must connect to sidewalks: extend through
      for(const [x,y,w,h] of leaves){ const hf=0.1+R()*R()*0.24+(Math.abs(i-4)<2&&Math.abs(j-3)<2?0.08:0);
        let sign=null; if(R()<0.55&&w>=3){ sign={text:SHOPS[shopN++%SHOPS.length],color:NEON[(R()*NEON.length)|0]}; }
        addBuilding(x,y,w,h,hf,R,sign); }
    } else if(type==='park'){
      fill(TL.GRASS); const mx=Math.floor((x0+x1)/2), my=Math.floor((y0+y1)/2);
      for(let x=x0;x<=x1;x++)set(x,my,TL.PLAZA); for(let y=y0;y<=y1;y++)set(mx,y,TL.PLAZA);
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){ if(tileAt(x,y)===TL.GRASS&&R()<0.33) W.trees.push({x:(x+0.2+R()*0.6)*T,y:(y+0.2+R()*0.6)*T,r:16+R()*10,c:R()}); }
      if(x1-x0>=6) W.props.push({k:'fountain',x:(mx+0.5)*T,y:(my+0.5)*T});
    } else if(type==='lot'||type==='hideout'||type==='respray'){
      fill(TL.LOT); let ly0=y0;
      if(type!=='lot'){ const bh=type==='hideout'?3:3; addBuilding(x0+1,y0,x1-x0-1,bh,type==='hideout'?0.16:0.12,R,{text:SPECIAL_SIGNS[type][0],color:SPECIAL_SIGNS[type][1]},type); ly0=y0+bh; }
      for(let x=x0;x<=x1;x++){ if((type==='lot')||x<=x0+1||x>=x1-1) { W.parking.push({x:(x+0.5)*T,y:(y1+0.45)*T,a:-Math.PI/2}); }
        if(type==='lot') W.parking.push({x:(x+0.5)*T,y:(ly0+0.55)*T,a:Math.PI/2}); }
      const pad={x:cx,y:(ly0+y1+1)/2*T};
      if(type==='hideout') W.places.hideout=pad;
      if(type==='respray'){ (W.places.respray=W.places.respray||[]).push(pad); }
    } else if(type==='plaza'||type==='shop'||type==='arcade'||type==='noodle'||type==='skate'){
      fill(TL.PLAZA);
      if(type==='skate'){ W.props.push({k:'skate',x:cx,y:cy,w:(x1-x0+1)*T,h:(y1-y0+1)*T}); W.places.skate={x:cx,y:cy}; }
      else if(type!=='plaza'){ addBuilding(x0,y0,x1-x0+1,4,0.15,R,{text:SPECIAL_SIGNS[type][0],color:SPECIAL_SIGNS[type][1]},type); W.places[type]={x:cx,y:(y0+4+y1+1)/2*T}; }
      else { W.props.push({k:'fountain',x:cx,y:cy}); for(let k=0;k<4;k++) W.trees.push({x:cx+(k%2?1:-1)*T*2.2,y:cy+(k>1?1:-1)*T*2.2,r:15,c:0.5}); }
    }
  }
  // make sure alleys exit: alley tiles reaching block edge already touch sidewalk.
  W.places.boardwalk={x:31*T,y:85*T}; W.places.pier={x:48*T,y:95.5*T}; W.places.beach={x:70*T,y:87.5*T};
  // lamps & palms along sidewalks
  for(let y=0;y<=85;y++)for(let x=0;x<MW;x++){ const t=tileAt(x,y);
    if(t===TL.SIDE){ // find adjacent road direction
      let rx=0,ry=0; if(isRoadT(tileAt(x+1,y)))rx=1; else if(isRoadT(tileAt(x-1,y)))rx=-1; if(isRoadT(tileAt(x,y+1)))ry=1; else if(isRoadT(tileAt(x,y-1)))ry=-1;
      if((rx===0)===(ry===0)) continue; // corners/none
      const along=rx?y:x; const lane=(rx?XC.findIndex(c=>Math.abs(c-x)<4):YC.findIndex(c=>Math.abs(c-y)<4));
      const px=(x+0.5+rx*0.32)*T, py=(y+0.5+ry*0.32)*T;
      if(along%6===0) W.lamps.push({x:px,y:py,c:R()<0.12?'#55ffff':'#ffb35a'});
      else if(along%6===3 && (x<=5||x>=94||y<=5||y>=78||x===46||x===49)) W.palms.push({x:px,y:py,r:R()});
    }
    if(t===TL.BOARD && y===84 && x%4===1) W.lamps.push({x:(x+0.5)*T,y:(y+0.15)*T,c:'#ff5fd8'});
    if(t===TL.BOARD && y===85 && x%4===3) W.palms.push({x:(x+0.5)*T,y:(y+0.9)*T,r:R()});
  }
  for(let y=87;y<=88;y++)for(let x=2;x<98;x+=5) if(tileAt(x,y)===TL.SAND&&R()<0.6) W.palms.push({x:(x+R())*T,y:(y+R())*T,r:R()});
  for(let k=0;k<16;k++){ const x=(3+k*6+R()*3)*T, y=(86.6+R()*2.4)*T; if(tileAt(Math.floor(x/T),Math.floor(y/T))===TL.SAND) W.props.push({k:'umbrella',x,y,c:NEON[(R()*NEON.length)|0],r:R()}); }
  W.lamps.push({x:47*T,y:96*T,c:'#22e6ff'},{x:49*T,y:96*T,c:'#22e6ff'},{x:44*T,y:96*T,c:'#ff2bd6'},{x:52*T,y:96*T,c:'#ff2bd6'});
  // collectible tags (hidden) and mission tags
  const cand=[]; for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){const t=tileAt(x,y); if(t===TL.ALLEY||(t===TL.GRASS&&R()<0.08)||(t===TL.BOARD&&y>=90)||(t===TL.PLAZA&&R()<0.06)||(t===TL.SAND&&R()<0.05)) cand.push([x,y]);}
  const chosen=[]; for(let tries=0;tries<4000&&chosen.length<18;tries++){ const c=cand[(R()*cand.length)|0]; if(chosen.every(o=>Math.abs(o[0]-c[0])+Math.abs(o[1]-c[1])>13)) chosen.push(c); }
  chosen.forEach((c,k)=>{ const s={id:k,x:(c[0]+0.5)*T,y:(c[1]+0.5)*T}; if(k<12) W.tagSpots.push(s); else W.mTags.push(s); });
  // light sources baked into ground
  for(const l of W.lamps) W.lights.push({x:l.x,y:l.y,r:150,c:l.c,a:0.30});
  for(const b of W.buildings) if(b.sign){ W.lights.push({x:b.x+b.w/2,y:b.y+b.h+8,r:Math.min(220,b.w*0.6+60),c:b.sign.color,a:0.16}); }
  buildMinimap();
}
function addBuilding(tx,ty,tw,th,hf,R,sign,special){
  const pal=[['#3a3058','#241d40','#54467e'],['#2a3a55','#1a2639','#3e5880'],['#47304f','#2c1d35','#68437a'],['#343a44','#21252c','#4f5868'],['#3e3248','#281f30','#5e4a6c'],['#2c4448','#1b2c30','#40656a']][(R()*6)|0];
  const b={x:tx*T,y:ty*T,w:tw*T,h:th*T,hf,pal,trim:NEON[(R()*NEON.length)|0],win:R()<0.5?'#ffd98a':'#8fe8ff',sign,special,det:[],seed:(R()*1e6)|0};
  const nd=1+((R()*4)|0); for(let k=0;k<nd;k++) b.det.push({x:0.15+R()*0.6,y:0.15+R()*0.6,w:0.08+R()*0.14,h:0.08+R()*0.14,k:R()<0.3?'fan':'box'});
  if(R()<0.25) b.det.push({x:0.5,y:0.5,w:0.18,h:0.18,k:'heli'});
  if(sign) b.det=b.det.filter(d=>d.k!=='heli');
  W.buildings.push(b);
  for(let y=ty;y<ty+th;y++)for(let x=tx;x<tx+tw;x++) W.map[y*MW+x]=TL.BLD;
}
// ---------- minimap ----------
const MM_S=3; let mmCanvas=null;
function buildMinimap(){
  mmCanvas=document.createElement('canvas'); mmCanvas.width=MW*MM_S; mmCanvas.height=MH*MM_S; const g=mmCanvas.getContext('2d');
  const col={[TL.ROAD]:'#5a5878',[TL.HWY]:'#7a6aa0',[TL.SIDE]:'#2c2a3a',[TL.BLD]:'#151224',[TL.GRASS]:'#1e5233',[TL.BOARD]:'#6a4630',[TL.SAND]:'#6e5d3c',[TL.WATER]:'#0b2c52',[TL.ALLEY]:'#3a3850',[TL.LOT]:'#2c2a44',[TL.PLAZA]:'#3a3650'};
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){ g.fillStyle=col[W.map[y*MW+x]]; g.fillRect(x*MM_S,y*MM_S,MM_S,MM_S); }
  for(const b of W.buildings){ g.fillStyle=b.pal[2]; g.fillRect(b.x/T*MM_S+1,b.y/T*MM_S+1,b.w/T*MM_S-2,b.h/T*MM_S-2); }
}
// ---------- sprites for light / glow ----------
const glowCache={};
function glowSprite(color,size){
  const key=color+size; if(glowCache[key])return glowCache[key];
  const c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d');
  const gr=g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2); gr.addColorStop(0,color); gr.addColorStop(0.25,color+'aa'); gr.addColorStop(1,color+'00');
  g.fillStyle=gr; g.fillRect(0,0,size,size); glowCache[key]=c; return c;
}
const signCache=new Map();
function signSprite(text,color){
  const key=text+color; if(signCache.has(key))return signCache.get(key);
  const c=document.createElement('canvas'); const g=c.getContext('2d'); const fs=34; g.font=`900 ${fs}px "Arial Black","Helvetica Neue",Arial,sans-serif`;
  const w=Math.ceil(g.measureText(text).width)+36; c.width=w; c.height=fs+34; g.font=`900 ${fs}px "Arial Black","Helvetica Neue",Arial,sans-serif`;
  g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='rgba(10,6,20,0.85)'; roundRect(g,4,4,w-8,c.height-8,10); g.fill();
  g.strokeStyle=color; g.lineWidth=3; g.shadowColor=color; g.shadowBlur=12; roundRect(g,6,6,w-12,c.height-12,9); g.stroke();
  g.fillStyle=color; g.fillText(text,w/2,c.height/2+2); g.shadowBlur=4; g.fillStyle='#fff'; g.globalAlpha=0.75; g.fillText(text,w/2,c.height/2+2);
  signCache.set(key,c); return c;
}
function roundRect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
// ---------- ground chunks ----------
let chunkBudget=99; const CH=8, CHS=1.5; const chunkCache=new Map(); let chunkTick=0;
function getChunk(ci,cj){
  const key=ci*100+cj; let e=chunkCache.get(key); chunkTick++;
  if(e){e.t=chunkTick;return e.c;}
  if(chunkBudget<=0) return null; chunkBudget--;
  if(chunkCache.size>=30){ let ok=null,ot=1e18; for(const [k,v] of chunkCache) if(v.t<ot){ot=v.t;ok=k;} chunkCache.delete(ok); }
  const c=document.createElement('canvas'); c.width=c.height=CH*T*CHS; const g=c.getContext('2d'); g.scale(CHS,CHS);
  renderChunk(g,ci,cj); chunkCache.set(key,{c,t:chunkTick}); return c;
}
function hashT(x,y){ let h=(x*374761393+y*668265263)^0x5bf03635; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; }
function renderChunk(g,ci,cj){
  const X0=ci*CH, Y0=cj*CH;
  for(let ty=Y0;ty<Y0+CH;ty++)for(let tx=X0;tx<X0+CH;tx++){ drawTile(g,tx,ty,(tx-X0)*T,(ty-Y0)*T); }
  const ox=X0*T, oy=Y0*T; g.save(); g.translate(-ox,-oy);
  const inR=(x,y,r)=>x+r>ox&&x-r<ox+CH*T&&y+r>oy&&y-r<oy+CH*T;
  // parking lines
  g.strokeStyle='rgba(230,230,255,0.35)'; g.lineWidth=2;
  for(const p of W.parking){ if(!inR(p.x,p.y,60))continue; const dy=Math.sin(p.a)>0?-1:1; g.beginPath(); g.moveTo(p.x-T/2,p.y+dy*T*0.45); g.lineTo(p.x-T/2,p.y-dy*T*0.35); g.stroke(); }
  for(const pr of W.props){ if(!inR(pr.x,pr.y,300))continue;
    if(pr.k==='fountain'){ g.fillStyle='#2a3a55'; g.beginPath(); g.arc(pr.x,pr.y,40,0,TAU); g.fill(); g.fillStyle='#0f5f8a'; g.beginPath(); g.arc(pr.x,pr.y,32,0,TAU); g.fill(); g.fillStyle='#4fd3ff'; g.beginPath(); g.arc(pr.x,pr.y,9,0,TAU); g.fill(); }
    if(pr.k==='umbrella'){ g.fillStyle='rgba(0,0,0,0.3)'; g.beginPath(); g.arc(pr.x+5,pr.y+6,26,0,TAU); g.fill(); g.fillStyle=pr.r<0.5?'#e8e0d0':'#3ad1d1'; g.fillRect(pr.x+14,pr.y-6,26,14); for(let s=0;s<8;s++){ g.fillStyle=s%2?pr.c:'#f4f0ff'; g.beginPath(); g.moveTo(pr.x,pr.y); g.arc(pr.x,pr.y,24,s*TAU/8,(s+1)*TAU/8); g.closePath(); g.fill(); } g.fillStyle='#333'; g.beginPath(); g.arc(pr.x,pr.y,3,0,TAU); g.fill(); }
    if(pr.k==='skate'){ g.fillStyle='#4a4660'; g.strokeStyle='#22e6ff'; g.lineWidth=3; for(const [dx,dy,w,h] of [[-0.3,-0.2,0.28,0.32],[0.12,-0.25,0.3,0.22],[0.05,0.15,0.36,0.22]]){ roundRect(g,pr.x+dx*pr.w,pr.y+dy*pr.h,w*pr.w,h*pr.h,30); g.fill(); g.stroke(); }
      g.save(); g.translate(pr.x,pr.y+pr.h*0.36); g.font='900 30px Arial Black,Arial'; g.textAlign='center'; g.fillStyle='#ff2bd6'; g.fillText('SKATE PARK',0,0); g.restore(); }
  }
  // spray-paint style street art on some alley/plaza tiles
  // light pools (additive)
  g.globalCompositeOperation='lighter';
  for(const L of W.lights){ if(!inR(L.x,L.y,L.r))continue; const gr=g.createRadialGradient(L.x,L.y,0,L.x,L.y,L.r);
    const a=L.a; gr.addColorStop(0,hexA(L.c,a)); gr.addColorStop(0.5,hexA(L.c,a*0.35)); gr.addColorStop(1,hexA(L.c,0)); g.fillStyle=gr; g.fillRect(L.x-L.r,L.y-L.r,L.r*2,L.r*2); }
  g.globalCompositeOperation='source-over'; g.restore();
}
function hexA(c,a){ if(c.length===4)c='#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]; const r=parseInt(c.slice(1,3),16),gg=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16); return `rgba(${r},${gg},${b},${a})`; }
function drawTile(g,tx,ty,px,py){
  const t=tileAt(tx,ty), h=hashT(tx,ty);
  const speck=(c,n,s)=>{ g.fillStyle=c; for(let k=0;k<n;k++){ const a=hashT(tx*7+k,ty*13+k*3), b=hashT(tx*11+k*5,ty*3+k); g.fillRect(px+a*T,py+b*T,s,s);} };
  switch(t){
    case TL.ROAD: case TL.HWY: {
      g.fillStyle=t===TL.HWY?'#1d1b29':'#1a1824'; g.fillRect(px,py,T,T); speck('rgba(255,255,255,0.035)',10,2);
      const vi=W.rv[ty*MW+tx], hj=W.rh[ty*MW+tx];
      if(vi>=0&&hj>=0){ if(h<0.08){g.fillStyle='#2b2938';g.beginPath();g.arc(px+T/2,py+T/2,7,0,TAU);g.fill();} break; }
      if(vi>=0){ const k=tx-(XC[vi]-XW[vi]/2), n=XW[vi];
        if(k===n/2-1){ g.fillStyle='#ffc93a'; if(n===4){g.fillRect(px+T-4,py,2,T);g.fillRect(px+T-8,py,2,T);} else for(let s=0;s<2;s++) g.fillRect(px+T-2,py+s*T/2+4,3,T/2-10); }
        if(n===4&&(k===0||k===2)){ g.fillStyle='rgba(255,255,255,0.55)'; g.fillRect(px+T-1,py+6,2,T/2-6); }
        if(k===0){g.fillStyle='rgba(255,255,255,0.25)';g.fillRect(px+2,py,2,T);} if(k===n-1){g.fillStyle='rgba(255,255,255,0.25)';g.fillRect(px+T-4,py,2,T);}
        const up=W.rh[(ty-1)*MW+tx]>=0&&ty>0, dn=ty<MH-1&&W.rh[(ty+1)*MW+tx]>=0;
        if(up||dn){ g.fillStyle='rgba(235,235,255,0.5)'; for(let s=0;s<5;s++) g.fillRect(px+3+s*9.5,py+(up?6:T-22),5,16); }
      } else if(hj>=0){ const k=ty-(YC[hj]-YW[hj]/2), n=YW[hj];
        if(k===n/2-1){ g.fillStyle='#ffc93a'; if(n===4){g.fillRect(px,py+T-4,T,2);g.fillRect(px,py+T-8,T,2);} else for(let s=0;s<2;s++) g.fillRect(px+s*T/2+4,py+T-2,T/2-10,3); }
        if(n===4&&(k===0||k===2)){ g.fillStyle='rgba(255,255,255,0.55)'; g.fillRect(px+6,py+T-1,T/2-6,2); }
        if(k===0){g.fillStyle='rgba(255,255,255,0.25)';g.fillRect(px,py+2,T,2);} if(k===n-1){g.fillStyle='rgba(255,255,255,0.25)';g.fillRect(px,py+T-4,T,2);}
        const lf=tx>0&&W.rv[ty*MW+tx-1]>=0, rt=tx<MW-1&&W.rv[ty*MW+tx+1]>=0;
        if(lf||rt){ g.fillStyle='rgba(235,235,255,0.5)'; for(let s=0;s<5;s++) g.fillRect(px+(lf?6:T-22),py+3+s*9.5,16,5); }
      }
      if(h>0.93){ g.fillStyle='rgba(120,160,255,0.07)'; g.beginPath(); g.ellipse(px+T/2,py+T/2,18,9,h*6,0,TAU); g.fill(); }
      break; }
    case TL.SIDE: {
      g.fillStyle='#2f2b3b'; g.fillRect(px,py,T,T); g.strokeStyle='rgba(0,0,0,0.25)'; g.lineWidth=1; g.strokeRect(px+0.5,py+0.5,T/2,T/2); g.strokeRect(px+T/2+0.5,py+T/2+0.5,T/2-1,T/2-1);
      g.fillStyle='#6d6588'; if(isRoadT(tileAt(tx+1,ty)))g.fillRect(px+T-3,py,3,T); if(isRoadT(tileAt(tx-1,ty)))g.fillRect(px,py,3,T); if(isRoadT(tileAt(tx,ty+1)))g.fillRect(px,py+T-3,T,3); if(isRoadT(tileAt(tx,ty-1)))g.fillRect(px,py,T,3);
      break; }
    case TL.GRASS: g.fillStyle='#0f2a1a'; g.fillRect(px,py,T,T); speck('#174a2a',14,3); speck('#0a1f13',8,4); break;
    case TL.LOT: g.fillStyle='#211f2e'; g.fillRect(px,py,T,T); speck('rgba(255,255,255,0.03)',8,2); break;
    case TL.ALLEY: g.fillStyle='#17151f'; g.fillRect(px,py,T,T); speck('#2a2433',6,4); if(h>0.7){g.fillStyle='#3a2f2a';g.fillRect(px+6,py+8,12,9);} break;
    case TL.PLAZA: g.fillStyle=(tx+ty)%2?'#38324a':'#332e44'; g.fillRect(px,py,T,T); g.strokeStyle='rgba(0,0,0,0.2)'; g.strokeRect(px+0.5,py+0.5,T-1,T-1); break;
    case TL.BOARD: g.fillStyle='#4a3324'; g.fillRect(px,py,T,T); g.fillStyle='#3a2719'; for(let s=0;s<4;s++) g.fillRect(px,py+s*12+10,T,2); g.fillStyle='rgba(255,220,180,0.05)'; g.fillRect(px+(h*40|0),py,2,T); break;
    case TL.SAND: g.fillStyle='#5a4a33'; g.fillRect(px,py,T,T); speck('#6b5a3f',12,2); speck('#4a3c29',8,2); break;
    case TL.WATER: { g.fillStyle='#071a33'; g.fillRect(px,py,T,T); g.strokeStyle='rgba(90,160,255,0.12)'; g.lineWidth=2; g.beginPath(); const o=h*T; g.moveTo(px,py+o); g.quadraticCurveTo(px+T/2,py+o-6,px+T,py+o); g.stroke();
      if(tileAt(tx,ty-1)===TL.SAND){ g.fillStyle='rgba(200,240,255,0.25)'; g.fillRect(px,py,T,4); }
      break; }
    default: g.fillStyle='#0c0a14'; g.fillRect(px,py,T,T);
  }
}
// ---------- dynamic world rendering ----------
function drawGround(g,view){
  const s=CH*T; const ci0=Math.max(0,Math.floor(view.x0/s)), ci1=Math.min(Math.ceil(MW/CH)-1,Math.floor(view.x1/s));
  const cj0=Math.max(0,Math.floor(view.y0/s)), cj1=Math.min(Math.ceil(MH/CH)-1,Math.floor(view.y1/s));
  chunkBudget=G.mode==='play'?2:99;
  for(let ci=ci0;ci<=ci1;ci++)for(let cj=cj0;cj<=cj1;cj++){ const c=getChunk(ci,cj); if(c) g.drawImage(c,ci*s,cj*s,s+0.6,s+0.6); else { g.fillStyle='#16131f'; g.fillRect(ci*s,cj*s,s,s); } }
  // pre-warm one chunk ahead in the travel direction when idle budget remains
  if(chunkBudget>0&&G.player){ const p=G.player, c=p.car; if(c&&c.spd>150){ const ax=p.x+c.vx*1.2, ay=p.y+c.vy*1.2; const ci=Math.floor(ax/s), cj=Math.floor(ay/s); if(ci>=0&&cj>=0&&ci<Math.ceil(MW/CH)&&cj<Math.ceil(MH/CH)) getChunk(ci,cj); } }
  // animated water sparkles
  if(view.y1>84*T){ g.fillStyle='rgba(120,200,255,0.25)'; const t=G.time;
    for(let k=0;k<40;k++){ const x=view.x0+((k*137.7+t*12)%(view.x1-view.x0)); const y=Math.max(90*T,view.y0)+((k*91.3)%Math.max(1,view.y1-Math.max(90*T,view.y0))); if(tileAtW(x,y)!==TL.WATER)continue; const w=10+6*Math.sin(t*2+k); g.fillRect(x,y,w,2); } }
}
function drawBuildings(g,view,cx,cy){
  const list=W.buildings; const vis=[];
  for(const b of list){ if(b.x+b.w<view.x0-260||b.x>view.x1+260||b.y+b.h<view.y0-260||b.y>view.y1+260)continue; vis.push(b); }
  vis.sort((a,b)=>a.hf-b.hf);
  for(const b of vis){
    const k=b.hf/(1-b.hf); const x0=b.x,y0=b.y,x1=b.x+b.w,y1=b.y+b.h;
    const rx0=x0+(x0-cx)*k, ry0=y0+(y0-cy)*k, rx1=x1+(x1-cx)*k, ry1=y1+(y1-cy)*k;
    const floors=Math.max(2,Math.round(b.hf*20));
    const wall=(ax,ay,bx,by,cx2,cy2,dx,dy,shade)=>{ // base a->b, roof c(of b)->d(of a)
      g.fillStyle=shade; g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.lineTo(cx2,cy2); g.lineTo(dx,dy); g.closePath(); g.fill();
      const depth=Math.hypot(dx-ax,dy-ay); if(depth<10)return;
      g.strokeStyle=b.win; const lw=Math.min(9,depth/floors*0.45); g.lineWidth=lw; g.globalAlpha=0.55;
      const segLen=Math.hypot(bx-ax,by-ay); g.setLineDash([7,9+(b.seed%7)]);
      for(let f=1;f<floors;f++){ const t=f/floors; g.lineDashOffset=(b.seed*(f+3))%16; g.beginPath(); g.moveTo(lerp(ax,dx,t),lerp(ay,dy,t)); g.lineTo(lerp(bx,cx2,t),lerp(by,cy2,t)); g.stroke(); }
      g.setLineDash([]); g.globalAlpha=1;
    };
    if(cy>y1) wall(x0,y1,x1,y1,rx1,ry1,rx0,ry1,b.pal[1]);
    if(cy<y0) wall(x0,y0,x1,y0,rx1,ry0,rx0,ry0,b.pal[1]);
    if(cx>x1) wall(x1,y0,x1,y1,rx1,ry1,rx1,ry0,b.pal[0]);
    if(cx<x0) wall(x0,y0,x0,y1,rx0,ry1,rx0,ry0,b.pal[0]);
    // roof
    const rw=rx1-rx0, rh=ry1-ry0;
    g.fillStyle=b.pal[2]; g.fillRect(rx0,ry0,rw,rh); g.fillStyle=b.pal[0]; g.fillRect(rx0+6,ry0+6,rw-12,rh-12);
    for(const d of b.det){ const dx=rx0+d.x*rw, dy=ry0+d.y*rh, dw=d.w*rw, dh=d.h*rh;
      if(d.k==='box'){ g.fillStyle=b.pal[2]; g.fillRect(dx,dy,dw,dh); g.fillStyle='rgba(255,255,255,0.08)'; g.fillRect(dx,dy,dw,3); }
      else if(d.k==='fan'){ const r=Math.min(dw,dh)/2; g.fillStyle='#2b2b38'; g.beginPath(); g.arc(dx+r,dy+r,r,0,TAU); g.fill(); g.strokeStyle='#555a6a'; g.lineWidth=2; const a=G.time*4+b.seed; g.beginPath(); g.moveTo(dx+r+Math.cos(a)*r*0.8,dy+r+Math.sin(a)*r*0.8); g.lineTo(dx+r-Math.cos(a)*r*0.8,dy+r-Math.sin(a)*r*0.8); g.stroke(); }
      else if(d.k==='heli'){ const r=Math.min(rw,rh)*0.2; g.strokeStyle='#ffd23a'; g.lineWidth=3; g.beginPath(); g.arc(rx0+rw/2,ry0+rh/2,r,0,TAU); g.stroke(); g.font=`900 ${r}px Arial`; g.fillStyle='#ffd23a'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('H',rx0+rw/2,ry0+rh/2); }
    }
    // neon trim (fake glow)
    g.strokeStyle=hexA(b.trim,0.25); g.lineWidth=7; g.strokeRect(rx0+2,ry0+2,rw-4,rh-4);
    g.strokeStyle=b.trim; g.lineWidth=2; g.strokeRect(rx0+2,ry0+2,rw-4,rh-4);
    if(b.sign){ const sp=signSprite(b.sign.text,b.sign.color); const sw=Math.min(rw*0.86,sp.width*0.9), sh=sw*sp.height/sp.width; const fl=0.85+0.15*Math.sin(G.time*3+b.seed);
      g.globalAlpha=fl; g.drawImage(sp,rx0+rw/2-sw/2,ry0+rh*0.5-sh/2,sw,sh); g.globalAlpha=1; }
  }
}
let palmSprite=null, treeSprite=null;
function makeFoliage(){
  palmSprite=document.createElement('canvas'); palmSprite.width=palmSprite.height=96; let g=palmSprite.getContext('2d'); g.translate(48,48);
  for(let k=0;k<8;k++){ g.save(); g.rotate(k*TAU/8+0.2); g.fillStyle=k%2?'#1f6b3a':'#16552d'; g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(22,-12,46,2); g.quadraticCurveTo(22,6,0,0); g.fill(); g.strokeStyle='#2c8a4a'; g.lineWidth=1.5; g.beginPath(); g.moveTo(2,0); g.quadraticCurveTo(22,-4,44,2); g.stroke(); g.restore(); }
  g.fillStyle='#5a3d22'; g.beginPath(); g.arc(0,0,6,0,TAU); g.fill();
  treeSprite=document.createElement('canvas'); treeSprite.width=treeSprite.height=80; g=treeSprite.getContext('2d');
  for(let k=0;k<9;k++){ const a=k*0.7, r=k?20:0; g.fillStyle=['#14432a','#1a5534','#0f3a22'][k%3]; g.beginPath(); g.arc(40+Math.cos(a)*r*0.7,40+Math.sin(a)*r*0.7,k?17:22,0,TAU); g.fill(); }
  g.fillStyle='rgba(120,255,170,0.12)'; g.beginPath(); g.arc(34,32,14,0,TAU); g.fill();
}
function drawFoliageAndLamps(g,view,cx,cy,glowPass){
  const inV=(x,y,m)=>x>view.x0-m&&x<view.x1+m&&y>view.y0-m&&y<view.y1+m;
  if(!glowPass){
    for(const t of W.trees){ if(!inV(t.x,t.y,60))continue; const k=0.08; const ox=(t.x-cx)*k, oy=(t.y-cy)*k; g.fillStyle='rgba(0,0,0,0.3)'; g.beginPath(); g.arc(t.x+4,t.y+4,t.r,0,TAU); g.fill(); g.drawImage(treeSprite,t.x+ox-t.r*1.6,t.y+oy-t.r*1.6,t.r*3.2,t.r*3.2); }
    for(const p of W.palms){ if(!inV(p.x,p.y,80))continue; const k=0.16; const ox=(p.x-cx)*k, oy=(p.y-cy)*k;
      g.strokeStyle='#6b4a2a'; g.lineWidth=5; g.beginPath(); g.moveTo(p.x,p.y); g.lineTo(p.x+ox,p.y+oy); g.stroke();
      g.save(); g.translate(p.x+ox,p.y+oy); g.rotate(p.r*TAU+Math.sin(G.time*0.8+p.r*9)*0.06); g.drawImage(palmSprite,-40,-40,80,80); g.restore(); }
    for(const l of W.lamps){ if(!inV(l.x,l.y,40))continue; const k=0.1; const ox=(l.x-cx)*k, oy=(l.y-cy)*k; g.strokeStyle='#4a4a5c'; g.lineWidth=3; g.beginPath(); g.moveTo(l.x,l.y); g.lineTo(l.x+ox,l.y+oy); g.stroke(); g.fillStyle='#fff3d0'; g.beginPath(); g.arc(l.x+ox,l.y+oy,4,0,TAU); g.fill(); }
  } else {
    g.globalCompositeOperation='lighter';
    for(const l of W.lamps){ if(!inV(l.x,l.y,60))continue; const k=0.1; const ox=(l.x-cx)*k, oy=(l.y-cy)*k; g.drawImage(glowSprite(l.c,64),l.x+ox-30,l.y+oy-30,60,60); }
    g.globalCompositeOperation='source-over';
  }
}
