import test from 'node:test';
import assert from 'node:assert/strict';
import { WATER_IOR, CAUSTIC_DEPTH_START, CAUSTIC_DEPTH_STEP, CAUSTIC_LAYERS, refractIntoWater, projectLightToPlane, differentialFlux, attenuateWater } from '../src/caustics-math.js';

test('water refraction obeys Snell and bends light toward the normal', () => {
  for (const angle of [0, .2, .5, 1.1, 1.5]) {
    const ray = refractIntoWater([Math.sin(angle), -Math.cos(angle), 0], [0, 1, 0]);
    assert.ok(Math.abs(Math.hypot(...ray) - 1) < 1e-12);
    assert.ok(Math.abs(ray[0] - Math.sin(angle) / WATER_IOR) < 1e-12);
    assert.ok(ray[1] < 0);
  }
});
test('flat waves project continuously rather than generating a dot pattern', () => {
  const ray = refractIntoWater([.6, -.8, 0], [0, 1, 0]);
  for (let i = 0; i < CAUSTIC_LAYERS; i++) {
    const depth = CAUSTIC_DEPTH_START + i * CAUSTIC_DEPTH_STEP;
    const a = projectLightToPlane([0, 0, 0], ray, -depth);
    const b = projectLightToPlane([1, 0, 1], ray, -depth);
    assert.ok(Math.abs(b[0]-a[0]-1) < 1e-12);
    assert.ok(Math.abs(b[2]-a[2]-1) < 1e-12);
    assert.ok(Math.abs(differentialFlux([1,0,0], [0,0,1], [1,0,0], [0,0,1], .8)-.8) < 1e-12);
  }
});
test('ray convergence concentrates energy, divergence reduces it, folds remain finite', () => {
  const dx = [1,0,0], dz = [0,0,1];
  assert.equal(differentialFlux(dx,dz,[.5,0,0],[0,0,.5],1),4);
  assert.equal(differentialFlux(dx,dz,[2,0,0],[0,0,2],1),.25);
  assert.equal(differentialFlux(dx,dz,[0,0,0],[0,0,0],1),24);
  assert.equal(differentialFlux(dx,dz,dx,dz,-1),0);
  assert.equal(projectLightToPlane([0,1,0],[0,1,0],0),null);
});
test('depth attenuation removes red faster than blue and never amplifies energy', () => {
  const shallow = attenuateWater(.1), deep = attenuateWater(1.4);
  assert.deepEqual(attenuateWater(0),[1,1,1]);
  assert.ok(deep[0] < deep[1] && deep[1] < deep[2]);
  deep.forEach((v,i) => assert.ok(v > 0 && v < shallow[i] && shallow[i] <= 1));
});
