import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedSpectralHeight } from '../src/spectrum-cache.js';
import { sampleSpectralHeight, SPECTRUM_DATA, SPECTRUM_SIZE } from '../src/spectrum.js';
import { bitReversedSpectrum } from '../src/fft-layout.js';
import { seededRandom } from '../src/simulation.js';
import { rostrumCanSurface } from '../src/whale-navigation.js';

test('surfacing clearance follows the translated, rotated ship',()=>{
  for(let i=0;i<32;i++){
    const heading=i*Math.PI/16,v={x:.7,z:-.3,heading},c=Math.cos(heading),s=Math.sin(heading);
    for(const [x,z,expected] of [[0,0,false],[1.6,.4,false],[1.8,0,true],[0,.7,true],[-1.8,-.3,true]]){
      assert.equal(rostrumCanSurface(v.x+c*x-s*z,v.z+s*x+c*z,v),expected);
    }
  }
});

test('phase-cached typed buoyancy retains every probe to 1e-12',()=>{
  const r=seededRandom(719);for(let frame=0;frame<30;frame++){const t=r()*200,s=r();for(let p=0;p<12;p++){const x=r()*9-4.5,z=r()*4-2;assert.ok(Math.abs(cachedSpectralHeight(x,z,t,s)-sampleSpectralHeight(x,z,t,s,true))<1e-12);}}
});
test('pre-bit-reversed FFT layout preserves coefficients and opposite modes exactly',()=>{
  const n=SPECTRUM_SIZE,a=bitReversedSpectrum(SPECTRUM_DATA,n),b=bitReversedSpectrum(SPECTRUM_DATA,n,true);
  const reverse=v=>parseInt(v.toString(2).padStart(7,'0').split('').reverse().join(''),2);
  for(let y=0;y<n;y+=7)for(let x=0;x<n;x+=5){const kx=reverse(x),ky=reverse(y);for(let c=0;c<4;c++){assert.equal(a[(y*n+x)*4+c],SPECTRUM_DATA[(ky*n+kx)*4+c]);assert.equal(b[(y*n+x)*4+c],SPECTRUM_DATA[(((n-ky)%n)*n+(n-kx)%n)*4+c]);}}
});
