'use strict';
// ===== procedural audio: sfx + 3 original radio stations =====
const STATIONS=[
  {name:'NEON FM 88.8',tag:'synthwave',bpm:104},
  {name:'BAY BITS 101.3',tag:'chiptune',bpm:138},
  {name:'NIGHT DRIVE 96.6',tag:'chill wave',bpm:88},
  {name:'RADIO OFF',tag:'',bpm:100}
];
const AU={
  ctx:null, master:null, music:null, sfx:null, noiseBuf:null, muted:false, musicOn:false, station:0, step:0, nextT:0, playing:-1,
  unlock(){
    if(this.ctx){ if(this.ctx.state==='suspended') this.ctx.resume(); return; }
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    try{ this.ctx=new AC(); }catch(e){ return; }
    const c=this.ctx;
    this.master=c.createGain(); this.master.gain.value=this.muted?0:0.8; this.master.connect(c.destination);
    this.music=c.createGain(); this.music.gain.value=0; this.music.connect(this.master);
    this.sfx=c.createGain(); this.sfx.gain.value=0.9; this.sfx.connect(this.master);
    const n=c.sampleRate*1.5|0; this.noiseBuf=c.createBuffer(1,n,c.sampleRate); const d=this.noiseBuf.getChannelData(0); for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
    // engine
    this.eng=c.createOscillator(); this.eng.type='sawtooth'; this.eng.frequency.value=50;
    this.engF=c.createBiquadFilter(); this.engF.type='lowpass'; this.engF.frequency.value=380;
    this.engG=c.createGain(); this.engG.gain.value=0; this.eng.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.sfx); this.eng.start();
    // siren
    this.sir=c.createOscillator(); this.sir.type='triangle'; this.sir.frequency.value=700;
    this.sirL=c.createOscillator(); this.sirL.frequency.value=1.6; this.sirLG=c.createGain(); this.sirLG.gain.value=220; this.sirL.connect(this.sirLG); this.sirLG.connect(this.sir.frequency);
    this.sirG=c.createGain(); this.sirG.gain.value=0; this.sir.connect(this.sirG); this.sirG.connect(this.sfx); this.sir.start(); this.sirL.start();
    // skid
    this.skid=c.createBufferSource(); this.skid.buffer=this.noiseBuf; this.skid.loop=true;
    this.skidF=c.createBiquadFilter(); this.skidF.type='bandpass'; this.skidF.frequency.value=1800; this.skidF.Q.value=3;
    this.skidG=c.createGain(); this.skidG.gain.value=0; this.skid.connect(this.skidF); this.skidF.connect(this.skidG); this.skidG.connect(this.sfx); this.skid.start();
  },
  setMuted(m){ this.muted=m; if(this.master) this.master.gain.setTargetAtTime(m?0:0.8,this.ctx.currentTime,0.05); },
  tone(type,f,t,dur,vol,dest,slide,lp){
    const c=this.ctx; const o=c.createOscillator(), g=c.createGain(); o.type=type; o.frequency.setValueAtTime(f,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.008); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    let out=o; if(lp){const f2=c.createBiquadFilter(); f2.type='lowpass'; f2.frequency.value=lp; o.connect(f2); out=f2;}
    out.connect(g); g.connect(dest||this.sfx); o.start(t); o.stop(t+dur+0.05);
  },
  noise(t,dur,vol,dest,type,freq,q){
    const c=this.ctx; const s=c.createBufferSource(); s.buffer=this.noiseBuf; const f=c.createBiquadFilter(); f.type=type||'highpass'; f.frequency.value=freq||6000; if(q)f.Q.value=q;
    const g=c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f); f.connect(g); g.connect(dest||this.sfx); s.start(t,Math.random()*0.5); s.stop(t+dur+0.05);
  },
  ok(){return this.ctx&&!this.muted;},
  sfxPlay(name,vol){
    if(!this.ok())return; const t=this.ctx.currentTime; vol=vol==null?1:vol;
    switch(name){
      case 'zap': this.tone('square',1300,t,0.12,0.09*vol,null,260); this.tone('sine',2600,t,0.06,0.05*vol,null,900); break;
      case 'punch': this.noise(t,0.12,0.5*vol,null,'lowpass',900); this.tone('sine',160,t,0.12,0.4*vol,null,60); break;
      case 'bonk': this.tone('square',600,t,0.08,0.12*vol,null,900); this.tone('square',900,t+0.08,0.1,0.1*vol,null,500); break;
      case 'horn': this.tone('sawtooth',392,t,0.32,0.13*vol,null,0,1500); this.tone('sawtooth',494,t,0.32,0.11*vol,null,0,1500); break;
      case 'poof': this.noise(t,0.9,0.7*vol,null,'lowpass',700); this.tone('sine',140,t,0.6,0.5*vol,null,30); this.noise(t+0.05,0.4,0.3*vol,null,'bandpass',2500,1); break;
      case 'crash': this.noise(t,0.25,0.45*vol,null,'lowpass',1400); this.tone('triangle',110,t,0.18,0.25*vol,null,50); break;
      case 'coin': [988,1319,1976].forEach((f,i)=>this.tone('square',f,t+i*0.06,0.12,0.07*vol)); break;
      case 'door': this.tone('square',220,t,0.06,0.08*vol,null,120); this.noise(t,0.08,0.15*vol,null,'lowpass',2000); break;
      case 'click': this.tone('square',880,t,0.05,0.06*vol); break;
      case 'buy': [660,880,1320].forEach((f,i)=>this.tone('triangle',f,t+i*0.07,0.16,0.12*vol)); break;
      case 'star': this.tone('square',523,t,0.12,0.08*vol); this.tone('square',392,t+0.12,0.16,0.08*vol); break;
      case 'clear': [523,659,784,1047].forEach((f,i)=>this.tone('triangle',f,t+i*0.08,0.2,0.12*vol)); break;
      case 'pass': [523,659,784,1047,784,1047].forEach((f,i)=>this.tone('square',f,t+i*0.11,0.22,0.08*vol,null,0,3000)); this.tone('sawtooth',131,t,0.8,0.08*vol,null,0,600); break;
      case 'fail': [392,370,349,262].forEach((f,i)=>this.tone('sawtooth',f,t+i*0.16,0.24,0.08*vol,null,0,1200)); break;
      case 'busted': [330,262,196].forEach((f,i)=>this.tone('square',f,t+i*0.2,0.3,0.1*vol,null,0,1600)); break;
      case 'check': this.tone('square',1047,t,0.08,0.08*vol); this.tone('square',1568,t+0.07,0.12,0.08*vol); break;
      case 'spray': this.noise(t,0.9,0.35*vol,null,'highpass',3500); break;
      case 'ring': for(let i=0;i<3;i++){this.tone('square',1400,t+i*0.16,0.07,0.06*vol);this.tone('square',1100,t+i*0.16+0.08,0.07,0.06*vol);} break;
      case 'splash': this.noise(t,0.6,0.4*vol,null,'lowpass',1200); break;
      case 'stun': this.tone('sawtooth',300,t,0.2,0.08*vol,null,1200); break;
    }
  },
  setEngine(on,spd){ if(!this.ctx)return; const t=this.ctx.currentTime; this.engG.gain.setTargetAtTime(on?0.05:0,t,0.08); this.eng.frequency.setTargetAtTime(42+spd*0.16,t,0.05); this.engF.frequency.setTargetAtTime(260+spd*0.9,t,0.05); },
  setSiren(v){ if(!this.ctx)return; this.sirG.gain.setTargetAtTime(v*0.035,this.ctx.currentTime,0.2); },
  setSkid(v){ if(!this.ctx)return; this.skidG.gain.setTargetAtTime(v*0.12,this.ctx.currentTime,0.04); },
  // ---- music ----
  wantMusic(on,station){
    if(station!=null&&station!==this.station){this.station=station; this.step=0; if(this.ctx)this.nextT=this.ctx.currentTime+0.08;}
    on=on&&this.station<3;
    if(on!==this.musicOn){ this.musicOn=on; if(this.ctx){ this.music.gain.setTargetAtTime(on?0.5:0,this.ctx.currentTime,0.25); if(on){this.nextT=this.ctx.currentTime+0.08;} } }
  },
  musicTick(){
    if(!this.ctx||!this.musicOn||this.muted)return; const c=this.ctx; const st=STATIONS[this.station]; const sd=60/st.bpm/4;
    if(this.nextT<c.currentTime-0.3) this.nextT=c.currentTime+0.05;
    while(this.nextT<c.currentTime+0.25){ this.playStep(this.station,this.step,this.nextT,sd); this.nextT+=sd; this.step++; }
  },
  playStep(s,step,t,sd){
    const M=this.music, mf=n=>440*Math.pow(2,(n-69)/12);
    const bar=(step>>4), pos=step&15;
    if(s===0){ // synthwave: Am F C G
      const roots=[57,53,48,55][bar%4]; const chord=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]][bar%4];
      if(pos%2===0) this.tone('sawtooth',mf(roots-24+(pos%4===2?12:0)),t,sd*1.8,0.16,M,0,500+((step*37)%300));
      const arp=[0,1,2,1,0,2,1,2]; const n=chord[arp[pos%8]]+12+(pos>=8?12:0); this.tone('square',mf(n),t,sd*0.9,0.035,M,0,2200);
      if(pos===0){ chord.forEach(nn=>this.tone('sawtooth',mf(nn),t,sd*15,0.025,M,0,1200)); }
      if(pos%4===0){ this.tone('sine',150,t,0.22,0.5,M,40); }
      if(pos===4||pos===12){ this.noise(t,0.18,0.25,M,'bandpass',1800,0.8); this.tone('triangle',190,t,0.1,0.12,M,120); }
      if(pos%2===1) this.noise(t,0.04,0.06,M,'highpass',8000);
      if(bar%8>=4 && (pos===0||pos===6||pos===10)){ const mel=[69,72,76,74,72,69,67,64]; this.tone('triangle',mf(mel[(bar*3+pos)%8]+12),t,sd*3.5,0.05,M); }
    } else if(s===1){ // chiptune: C G Am F
      const chord=[[60,64,67],[55,59,62],[57,60,64],[53,57,60]][bar%4];
      if(pos%2===0) this.tone('triangle',mf(chord[0]-24+(pos%4?12:0)),t,sd*1.6,0.22,M);
      const r=mulberry(bar%8*97+pos*13)(); const scale=[0,2,4,7,9,12,14,16];
      if(r<0.62){ const n=60+scale[(Math.floor(r*100)+bar)%8]+(bar%4===3?-2:0); this.tone('square',mf(n+12),t,sd*(r<0.2?1.8:0.9),0.05,M,0,4000); }
      if(pos%4===0) this.noise(t,0.07,0.25,M,'lowpass',500);
      if(pos===4||pos===12) this.noise(t,0.09,0.18,M,'highpass',3000);
      if(pos%2===1) this.noise(t,0.025,0.05,M,'highpass',9000);
    } else if(s===2){ // chill: Em C G D
      const chord=[[64,67,71],[60,64,67],[55,59,62],[62,66,69]][bar%4];
      if(pos===0){ chord.forEach(nn=>this.tone('triangle',mf(nn),t,sd*16,0.05,M)); this.tone('sine',mf(chord[0]-24),t,sd*14,0.18,M); }
      if(pos===8) this.tone('sine',mf(chord[0]-24),t,sd*7,0.12,M);
      if(pos===0||pos===10) this.tone('sine',120,t,0.3,0.4,M,40);
      if(pos===4||pos===12) this.noise(t,0.25,0.08,M,'bandpass',1200,0.7);
      if(pos%2===0) this.noise(t,0.03,0.035,M,'highpass',9000);
      const r=mulberry(bar*31+pos)(); if(r<0.22){ const n=chord[(r*30|0)%3]+24; this.tone('sine',mf(n),t,sd*5,0.05,M); }
    }
  }
};
