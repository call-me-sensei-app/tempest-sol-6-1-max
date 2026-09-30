import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECTRUM_DATA,SPECTRUM_SIZE,BUOYANCY_MODES,BUOYANCY_ENERGY_COVERAGE,sampleSpectralHeight,spectralOffset} from '../src/spectrum.js';
import {GRAVITY,WATER_DEPTH,WATER_LEVEL,seededRandom} from '../src/simulation.js';
test('full GPU spectrum is finite, deterministic, and dispersion-correct',()=>{assert.equal(SPECTRUM_DATA.length,128*128*4);assert.ok(SPECTRUM_DATA.every(Number.isFinite));assert.equal(SPECTRUM_DATA[0],0);for(const m of BUOYANCY_MODES)assert.ok(Math.abs(m.omega**2-GRAVITY*m.k*Math.tanh(m.k*WATER_DEPTH))<1e-12);});
test('hull-scale probes retain >97% of spectral energy',()=>{assert.equal(BUOYANCY_MODES.length,512);assert.ok(BUOYANCY_ENERGY_COVERAGE>.97);});
test('spectral buoyancy scalar path matches the allocating reference',()=>{const random=seededRandom(881);for(let i=0;i<250;i++){const x=random()*9-4.5,z=random()*4-2,t=random()*100,s=random();assert.ok(Math.abs(sampleSpectralHeight(x,z,t,s,true)-sampleSpectralHeight(x,z,t,s,false))<1e-12);}});
test('spatial spectrum is periodic and calm seas contain less energy',()=>{for(const [x,z,t] of [[.4,.7,3.1],[-2.3,.3,9.15]]){const a=spectralOffset(x,z,t,1),b=spectralOffset(x+16,z+16,t,1),calm=spectralOffset(x,z,t,0);assert.ok(Math.abs(a.y-b.y)<1e-12);assert.ok(Math.abs(calm.y)<=Math.abs(a.y));assert.ok(Math.abs(sampleSpectralHeight(x,z,t,1)-WATER_LEVEL)<1);}});
