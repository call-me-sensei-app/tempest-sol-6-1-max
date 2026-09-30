import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type V3 = [number, number, number];
export const v = (a: V3) => new THREE.Vector3(...a);
export function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: V3 = [0, 0, 0], name = 'detail') {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(...position);
  object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}
export function box(parent: THREE.Object3D, size: V3, material: THREE.Material, position: V3, name = 'joinery') {
  return mesh(parent, new RoundedBoxGeometry(...size,2,Math.min(.025,...size.map(v=>v*.065))), material, position, name);
}
export function rod(parent: THREE.Object3D, a: V3, b: V3, radius: number, material: THREE.Material, name = 'rigging', taper = 1) {
  const start = v(a), end = v(b), direction = end.clone().sub(start);
  const object = mesh(parent, new THREE.CylinderGeometry(radius * taper, radius, direction.length(), radius < 0.015 ? 5 : 12), material, [0, 0, 0], name);
  object.position.copy(start.add(end).multiplyScalar(0.5));
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  object.userData.collisionCapsule={a:[...a],b:[...b],r:radius};
  return object;
}
export function rope(parent: THREE.Object3D, points: V3[], radius: number, material: THREE.Material, name = 'rope') {
  const curve=new THREE.CatmullRomCurve3(points.map(v)),length=curve.getLength();
  if(radius>=.015&&/neck rope|mariner|suspension/.test(name)){
    const group=namedGroup(parent,name);const segments=Math.min(420,Math.max(90,Math.ceil(length/(radius*2)))),frames=curve.computeFrenetFrames(segments,false),turns=length/(radius*10);
    for(let strand=0;strand<3;strand++){const pts:THREE.Vector3[]=[];for(let i=0;i<=segments;i++){const t=i/segments,angle=t*turns*Math.PI*2+strand/3*Math.PI*2;pts.push(curve.getPointAt(t).addScaledVector(frames.normals[i],Math.cos(angle)*radius*.54).addScaledVector(frames.binormals[i],Math.sin(angle)*radius*.54));}
      const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),segments,radius*.49,5,false);const uv=geo.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*length/(radius*10));mesh(group,geo,material,[0,0,0],`${name}:laid strand ${strand+1}`);
    }return group;
  }
  const geometry=new THREE.TubeGeometry(curve,Math.max(8,points.length*4),radius,6,false);const uv=geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*Math.max(1,length/(radius*14)));
  const object=mesh(parent,geometry,material,[0,0,0],name);object.userData.collisionPolyline={points:points.map(p=>[...p]),r:radius};return object;
}
export function ring(parent: THREE.Object3D, radius: number, thickness: number, material: THREE.Material, position: V3, name = 'ring') {
  return mesh(parent, new THREE.TorusGeometry(radius, thickness, 8, 80), material, position, name);
}
// Merge static details only WITHIN semantic assemblies. Sail/wheel pivots stay independent.
export function bakeAssembly(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const meshes: THREE.Mesh[] = [];
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const geometry = object.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld));
    if (geometry.index) geometry.setIndex(geometry.index.clone());
    const unindexed = geometry.index ? geometry.toNonIndexed() : geometry;
    for (const key of Object.keys(unindexed.attributes)) if (!['position', 'normal', 'uv'].includes(key)) unindexed.deleteAttribute(key);
    if (!unindexed.getAttribute('uv')) unindexed.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(unindexed.getAttribute('position').count * 2), 2));
    const list = byMaterial.get(object.material) ?? []; list.push(unindexed); byMaterial.set(object.material, list); meshes.push(object);
  });
  for (const object of meshes) { object.removeFromParent(); object.geometry.dispose(); }
  for (const [material, geometries] of byMaterial) {
    const merged = mergeGeometries(geometries);
    if (merged) mesh(group, merged, material, [0, 0, 0], `${group.name}:${material.name || material.type}`);
    geometries.forEach(g => g.dispose());
  }
}
export function namedGroup(parent: THREE.Object3D, name: string) { const group = new THREE.Group(); group.name = name; parent.add(group); return group; }

// Keep semantic groups and all moving pivots, but consolidate compatible static
// opaque geometry across assemblies. No simplification, texture loss or LOD.
export function batchStaticMeshes(root:THREE.Group,excluded:THREE.Object3D[]){
  const skip=new Set(excluded);root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(),buckets=new Map<string,{material:THREE.Material;meshes:THREE.Mesh[]}>();
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||Array.isArray(object.material)||object.material.transparent||(object.material as THREE.MeshPhysicalMaterial).transmission>0||!object.material.depthWrite)return;
    for(let ancestor:THREE.Object3D|null=object;ancestor&&ancestor!==root;ancestor=ancestor.parent)if(skip.has(ancestor)||ancestor.name==='candle flame'||ancestor.name==='weather pennant'||ancestor.name.startsWith('chronometer '))return;
    const attributes=Object.keys(object.geometry.attributes).sort().map(key=>`${key}:${object.geometry.getAttribute(key).itemSize}`).join(',');
    const key=`${object.material.uuid}:${object.castShadow}:${object.receiveShadow}:${object.renderOrder}:${attributes}`;
    const bucket=buckets.get(key)??{material:object.material,meshes:[] as THREE.Mesh[]};bucket.meshes.push(object);buckets.set(key,bucket);
  });
  for(const {material,meshes} of buckets.values()){
    if(meshes.length<2)continue;
    const geometries=meshes.map(object=>{const geometry=object.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld));return geometry.index?geometry.toNonIndexed():geometry;});
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(!geometry)continue;
    const batch=new THREE.Mesh(geometry,material);batch.name=`static batch · ${material.name||material.type}`;batch.castShadow=meshes[0].castShadow;batch.receiveShadow=meshes[0].receiveShadow;batch.renderOrder=meshes[0].renderOrder;batch.userData.parts=meshes.map(m=>m.name);root.add(batch);
    for(const object of meshes){object.removeFromParent();object.geometry.dispose();}
  }
}
