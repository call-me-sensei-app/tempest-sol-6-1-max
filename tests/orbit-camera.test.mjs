import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { roomOrbitBounds, safeOrbitDistance, insideOrbitBounds, attachRoomOrbitGuard } from '../src/orbit-camera.js';

const box=(min,max)=>({min:new Vector3(...min),max:new Vector3(...max)});
const bounds=roomOrbitBounds(box([-15.15,-1.5,-12],[-14.85,13.5,16]),box([14.85,-1.5,-12],[15.15,13.5,16]),box([-20,-1.5,-8.55],[20,13.5,-8.25]),box([4.65,-.5,-7.94],[10.45,8.64,-7.02]),box([-17.5,-.545,-10.7],[17.5,-.095,14.3]));
const target=new Vector3(.3,2.9,0);
const point=(radius,theta,phi)=>new Vector3(radius*Math.sin(phi)*Math.sin(theta),radius*Math.cos(phi),radius*Math.sin(phi)*Math.cos(theta)).add(target);

test('room clearance includes the projecting bookcase, not just the back wall',()=>{
  assert.ok(Math.abs(bounds.minZ-(-6.78))<1e-10);
  assert.ok(Math.abs(bounds.minX-(-14.61))<1e-10);
  assert.ok(Math.abs(bounds.maxX-14.61)<1e-10);
  assert.ok(bounds.minY>0);
});
test('every azimuth, allowed elevation and zoom keeps the eye and sightline in front of room geometry',()=>{
  let count=0;
  for(const r of [5,7,12,19.21,32.76,35])for(const phi of [.23,.5,.9,1.2,Math.PI*.5,Math.PI*.51])for(let i=0;i<360;i++){
    const wanted=point(r,i*Math.PI/180,phi),distance=safeOrbitDistance(wanted,target,bounds);
    const actual=wanted.clone().sub(target).multiplyScalar(distance/r).add(target);
    assert.ok(insideOrbitBounds(actual,bounds)); assert.ok(distance>=5-1e-8 && distance<=r+1e-8);
    for(const f of [.25,.5,.75])assert.ok(insideOrbitBounds(target.clone().lerp(actual,f),bounds));
    count++;
  }
  assert.equal(count,12960);
});
test('home framing and portrait reset are unchanged; front zoom remains available',()=>{
  for(const eye of [new Vector3(10,7.2,16),new Vector3(10,7.2,31),point(35,0,1.2)])assert.ok(Math.abs(safeOrbitDistance(eye,target,bounds)-eye.distanceTo(target))<1e-10);
});
test('actual OrbitControls integrates with the guard without an azimuth restriction',()=>{
  const camera=new PerspectiveCamera(39,16/9,.006,100),controls=new OrbitControls(camera,null);
  controls.target.copy(target);controls.minDistance=5;controls.maxDistance=35;controls.minPolarAngle=.23;controls.maxPolarAngle=Math.PI*.51;
  camera.position.copy(point(19.21,Math.PI,1.2));
  const guard=attachRoomOrbitGuard(controls,bounds);
  assert.ok(guard.limited);assert.ok(insideOrbitBounds(camera.position,bounds));
  assert.equal(controls.minAzimuthAngle,-Infinity);assert.equal(controls.maxAzimuthAngle,Infinity);
  // No DOM listeners were connected for this headless controls instance.
  guard.dispose();
});
function mockControls(){
  const camera=new PerspectiveCamera(39,16/9,.006,100);camera.position.copy(point(19,0,1.2));
  let theta=0,scale=1;
  const controls={object:camera,target:target.clone(),enabled:true,domElement:null,minDistance:5,maxDistance:35,update(){const radius=camera.position.distanceTo(this.target)*scale;camera.position.copy(point(radius,theta,1.2));scale=1;return true;}};
  return {controls,camera,rotate(angle){theta=angle;controls.update();},zoom(value){scale=value;controls.update();}};
}
test('wall-limited orbit remembers zoom and restores it when rotating back into open space',()=>{
  const m=mockControls(),guard=attachRoomOrbitGuard(m.controls,bounds);
  m.rotate(Math.PI);assert.ok(m.camera.position.distanceTo(target)<8);assert.ok(Math.abs(guard.requestedDistance-19)<1e-8);
  m.rotate(0);assert.ok(Math.abs(m.camera.position.distanceTo(target)-19)<1e-8);
  guard.dispose();
});
test('inward dolly at a wall responds immediately; manual reset establishes a new zoom',()=>{
  const m=mockControls(),guard=attachRoomOrbitGuard(m.controls,bounds);
  m.rotate(Math.PI);const stopped=m.camera.position.distanceTo(target);
  guard.useActualDistanceForZoom();m.zoom(.9);assert.ok(Math.abs(m.camera.position.distanceTo(target)-stopped*.9)<1e-8);
  m.camera.position.copy(point(25,0,1.2));m.rotate(0);assert.ok(Math.abs(guard.requestedDistance-25)<1e-8);
  guard.dispose();
});
test('disabled controls leave tour and interior cameras unconstrained by the room guard',()=>{
  const m=mockControls(),guard=attachRoomOrbitGuard(m.controls,bounds);
  m.controls.enabled=false;m.camera.position.copy(point(25,Math.PI,1.2));m.rotate(Math.PI);
  assert.ok(!insideOrbitBounds(m.camera.position,bounds));assert.equal(guard.limited,false);
  guard.dispose();
});
test('saved zoom intent restores across renderer/boarding transitions and rejects invalid data',()=>{
  const m=mockControls(),guard=attachRoomOrbitGuard(m.controls,bounds);
  m.rotate(Math.PI);guard.restoreRequestedDistance(28);m.controls.update();assert.ok(insideOrbitBounds(m.camera.position,bounds));
  assert.ok(Math.abs(guard.requestedDistance-28)<1e-8);m.rotate(0);assert.ok(Math.abs(m.camera.position.distanceTo(target)-28)<1e-8);
  guard.restoreRequestedDistance(NaN);guard.restoreRequestedDistance(-10);assert.ok(Math.abs(guard.requestedDistance-28)<1e-8);
  guard.restoreRequestedDistance(100);m.controls.update();assert.ok(Math.abs(guard.requestedDistance-35)<1e-8);
  guard.dispose();
});
