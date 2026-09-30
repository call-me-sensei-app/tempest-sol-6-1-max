import { BUOYANCY_MODES, SPECTRUM_LENGTH, SPECTRAL_CHOP, WIND } from './spectrum.js';
import { WATER_LEVEL, clamp } from './simulation.js';

const count = BUOYANCY_MODES.length;
const kx = new Float64Array(count), kz = new Float64Array(count), re = new Float64Array(count), im = new Float64Array(count), omega = new Float64Array(count), direction = new Float64Array(count), phase = new Float64Array(count);
BUOYANCY_MODES.forEach((m, i) => { kx[i]=m.kx; kz[i]=m.kz; re[i]=m.re; im[i]=m.im; omega[i]=m.omega; direction[i]=m.direction; });
let cachedTime = NaN;
export function cachedSpectralHeight(x, z, time, storm) {
  if (cachedTime !== time) { for(let i=0;i<count;i++)phase[i]=omega[i]*time; cachedTime=time; }
  const amp=.24+clamp(storm,0,1)*1.12, half=SPECTRUM_LENGTH/2;
  let px=x,pz=z;
  for(let iteration=0;iteration<3;iteration++){
    let d=0;
    for(let i=0;i<count;i++){
      const f=kx[i]*(px+half)+kz[i]*(pz+half)-phase[i];
      d-=2*(re[i]*Math.sin(f)+im[i]*Math.cos(f))*direction[i];
    }
    d*=amp*SPECTRAL_CHOP;px=x-d*WIND[0];pz=z-d*WIND[1];
  }
  let h=0;
  for(let i=0;i<count;i++){const f=kx[i]*(px+half)+kz[i]*(pz+half)-phase[i];h+=2*(re[i]*Math.cos(f)-im[i]*Math.sin(f));}
  return WATER_LEVEL+h*amp;
}
