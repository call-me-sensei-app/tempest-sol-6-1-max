import { seededRandom } from './simulation.js';

export class OceanAudio {
  private context:AudioContext|null=null;
  private master:GainNode|null=null;
  private waveGain:GainNode|null=null;
  private filter:BiquadFilterNode|null=null;
  enabled=false;
  async toggle(){
    if(!this.context)this.initialize();
    await this.context!.resume();this.enabled=!this.enabled;
    this.master!.gain.setTargetAtTime(this.enabled?.23:0,this.context!.currentTime,.28);
    return this.enabled;
  }
  private initialize(){
    const context=new AudioContext();this.context=context;
    const master=context.createGain();master.gain.value=0;master.connect(context.destination);this.master=master;
    const buffer=context.createBuffer(2,context.sampleRate*8,context.sampleRate);const random=seededRandom(9214);
    for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);let last=0;for(let i=0;i<data.length;i++){const white=random()*2-1;last=(last+.045*white)/1.045;data[i]=last*4;}}
    const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1250;filter.Q.value=.4;this.filter=filter;
    const high=context.createBiquadFilter();high.type='highpass';high.frequency.value=60;
    const gain=context.createGain();gain.gain.value=.68;this.waveGain=gain;
    source.connect(filter).connect(high).connect(gain).connect(master);source.start();
    // Slow gain modulation creates surf surges without synthetic pure-tone music.
    const swell=context.createOscillator();swell.frequency.value=.19;const depth=context.createGain();depth.gain.value=.16;swell.connect(depth).connect(gain.gain);swell.start();
  }
  update(storm:number,inside:boolean,paused:boolean){
    if(!this.context||!this.master)return;
    const time=this.context.currentTime;
    this.master.gain.setTargetAtTime(this.enabled&&!paused&&!document.hidden?.23:0,time,.4);
    this.filter!.frequency.setTargetAtTime(inside?360:750+storm*1800,time,.4);
    this.waveGain!.gain.setTargetAtTime((.38+storm*.75)*(inside?.54:1),time,.7);
  }
  thunder(){
    if(!this.enabled||!this.context||!this.master)return;
    const ctx=this.context,random=seededRandom(Math.floor(ctx.currentTime*1000)),duration=3.8;
    const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){last=(last+.07*(random()*2-1))/1.07;const t=i/ctx.sampleRate;data[i]=last*4.5*Math.exp(-t*.95)*(1+.16*Math.sin(t*23));}
    const source=ctx.createBufferSource();source.buffer=buffer;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=240;
    const gain=ctx.createGain();gain.gain.value=.95;source.connect(filter).connect(gain).connect(this.master);source.start(ctx.currentTime+.3);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
}
