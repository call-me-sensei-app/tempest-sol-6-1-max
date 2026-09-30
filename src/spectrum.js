// Independently authored wind-wave spectrum. One scene unit represents 10 m.
// Finite-depth dispersion and directional JONSWAP-inspired energy distribution.
import { seededRandom,clamp,GRAVITY,WATER_DEPTH,WATER_LEVEL } from './simulation.js';
export const SPECTRUM_SIZE=128,SPECTRUM_LENGTH=16,SPECTRAL_CHOP=.72;
export const WIND=[Math.cos(.26),Math.sin(.26)];
const random=seededRandom(68147),all=[];
const gaussian=()=>Math.sqrt(-2*Math.log(Math.max(1e-9,random())))*Math.cos(random()*Math.PI*2);
let energy=0;
for(let y=0;y<SPECTRUM_SIZE;y++)for(let x=0;x<SPECTRUM_SIZE;x++){
  const ix=x<SPECTRUM_SIZE/2?x:x-SPECTRUM_SIZE,iy=y<SPECTRUM_SIZE/2?y:y-SPECTRUM_SIZE,kx=ix*Math.PI*2/SPECTRUM_LENGTH,kz=iy*Math.PI*2/SPECTRUM_LENGTH,k=Math.hypot(kx,kz);
  if(!k){all.push({x,y,kx,kz,k,re:0,im:0,omega:0,direction:0});continue;}
  const peak=1.15,sigma=k<peak?.16:.30,enhancement=3.3**Math.exp(-(((Math.sqrt(k/peak)-1)/sigma)**2)/2),direction=(kx*WIND[0]+kz*WIND[1])/k;
  const power=Math.exp(-1.25*(peak/k)**2)*enhancement/k**3.6*(.025+.975*Math.max(0,direction)**6)*Math.exp(-k*k*.026**2);
  const re=gaussian()*Math.sqrt(power*.5),im=gaussian()*Math.sqrt(power*.5);energy+=re*re+im*im;
  all.push({x,y,kx,kz,k,re,im,omega:Math.sqrt(GRAVITY*k*Math.tanh(k*WATER_DEPTH)),direction});
}
const scale=.115/Math.sqrt(2*energy),fftScale=SPECTRUM_SIZE**2;
export const SPECTRUM_DATA=new Float32Array(SPECTRUM_SIZE**2*4);
for(const m of all){m.re*=scale;m.im*=scale;SPECTRUM_DATA.set([m.re*fftScale,m.im*fftScale,m.omega,m.direction],(m.y*SPECTRUM_SIZE+m.x)*4);}
// Short waves contribute to shading and breaking, but their tiny forces largely
// cancel across a 31 m hull. Keep the dominant modes for point-probe buoyancy.
export const BUOYANCY_MODES=all.filter(m=>m.k>0).sort((a,b)=>(b.re*b.re+b.im*b.im)-(a.re*a.re+a.im*a.im)).slice(0,512);
export const BUOYANCY_ENERGY_COVERAGE=BUOYANCY_MODES.reduce((e,m)=>e+m.re*m.re+m.im*m.im,0)/all.reduce((e,m)=>e+m.re*m.re+m.im*m.im,0);
export function spectrumAuditPoints(time){return [[0,0],[21,13],[64,64],[97,53],[112,101]].map(([x,y])=>{let height=0;for(const m of all){const f=m.kx*x*SPECTRUM_LENGTH/SPECTRUM_SIZE+m.kz*y*SPECTRUM_LENGTH/SPECTRUM_SIZE-m.omega*time;height+=2*(m.re*Math.cos(f)-m.im*Math.sin(f));}return {x,y,height};});}
export function spectralOffset(x,z,time,storm){const amp=.24+clamp(storm,0,1)*1.12;let h=0,d=0;for(const m of BUOYANCY_MODES){const f=m.kx*(x+SPECTRUM_LENGTH/2)+m.kz*(z+SPECTRUM_LENGTH/2)-m.omega*time,c=Math.cos(f),s=Math.sin(f);h+=2*(m.re*c-m.im*s);d-=2*(m.re*s+m.im*c)*m.direction;}return {x:d*amp*SPECTRAL_CHOP*WIND[0],y:h*amp,z:d*amp*SPECTRAL_CHOP*WIND[1]};}
export function sampleSpectralHeight(x,z,time,storm,optimized=false){
  let px=x,pz=z;
  if(!optimized){for(let i=0;i<3;i++){const d=spectralOffset(px,pz,time,storm);px=x-d.x;pz=z-d.z;}return WATER_LEVEL+spectralOffset(px,pz,time,storm).y;}
  const amp=.24+clamp(storm,0,1)*1.12;
  for(let i=0;i<3;i++){let d=0;for(const m of BUOYANCY_MODES){const f=m.kx*(px+SPECTRUM_LENGTH/2)+m.kz*(pz+SPECTRUM_LENGTH/2)-m.omega*time;d-=2*(m.re*Math.sin(f)+m.im*Math.cos(f))*m.direction;}d*=amp*SPECTRAL_CHOP;px=x-d*WIND[0];pz=z-d*WIND[1];}
  let h=0;for(const m of BUOYANCY_MODES){const f=m.kx*(px+SPECTRUM_LENGTH/2)+m.kz*(pz+SPECTRUM_LENGTH/2)-m.omega*time;h+=2*(m.re*Math.cos(f)-m.im*Math.sin(f));}return WATER_LEVEL+h*amp;
}
