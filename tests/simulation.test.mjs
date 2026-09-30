import test from 'node:test';
import assert from 'node:assert/strict';
import {WAVES,GRAVITY,WATER_DEPTH,WATER_LEVEL,CHOPPINESS,waveHeight,waveDisplacement,setPhysicsOptimization,insideHull,hullHalfWidth,advanceVessel,seededRandom} from '../src/simulation.js';

test('directional spectrum obeys finite-depth gravity dispersion',()=>{
  assert.equal(WAVES.length,14);
  for(const [dx,dz,k,omega,amplitude] of WAVES){assert.ok(Math.abs(Math.hypot(dx,dz)-1)<1e-12);assert.ok(Math.abs(omega*omega-GRAVITY*k*Math.tanh(k*WATER_DEPTH))<1e-12);assert.ok(amplitude>0);}
});
test('Gerstner world-coordinate inverse is consistent and bounded',()=>{
  for(const storm of [0,.65,1])for(const t of [0,7.2,50.1])for(const [x,z] of [[0,0],[-1.3,.7],[2.1,-.4]]){const d=waveDisplacement(x,z,t,storm);const sampled=waveHeight(x+d.x,z+d.z,t,storm);assert.ok(Math.abs(sampled-WATER_LEVEL-d.y)<.003);assert.ok(Math.abs(sampled-WATER_LEVEL)<.75);}
  assert.ok(CHOPPINESS<.5);
});
test('allocation-free buoyancy has no meaningful numerical drift',()=>{
  const random=seededRandom(311);
  for(let i=0;i<1000;i++){const x=random()*8-4,z=random()*4-2,time=random()*180,storm=random();setPhysicsOptimization(false);const baseline=waveHeight(x,z,time,storm);setPhysicsOptimization(true);assert.ok(Math.abs(waveHeight(x,z,time,storm)-baseline)<1e-12);}
});
test('hull footprint rotates and excludes the center without eating distant ocean',()=>{
  for(const heading of [0,.8,Math.PI]){assert.equal(insideHull(2,-.3,2,-.3,heading),true);assert.equal(insideHull(8,9,2,-.3,heading),false);}
  assert.ok(hullHalfWidth(-1.5)>.2);assert.ok(hullHalfWidth(1.6)<1e-6);
});
test('vessel remains contained even under prolonged full rudder',()=>{
  for(const steer of [-1,0,1]){const ship={x:0,z:0,heading:0,rudder:0};for(let i=0;i<20000;i++){advanceVessel(ship,1/60,steer,1);assert.ok((ship.x/1.85)**2+(ship.z/1.04)**2<=1.00001);} }
});
test('random generators are deterministic',()=>{const a=seededRandom(71),b=seededRandom(71);for(let i=0;i<100;i++)assert.equal(a(),b());});
