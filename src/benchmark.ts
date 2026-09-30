import * as THREE from 'three';

// Retain the fastest fidelity-accepted incumbent, not the last experiment.
export const OPT_LEVEL=Number(new URLSearchParams(location.search).get('opt')??'14');
export const BENCHMARK=new URLSearchParams(location.search).get('bench')==='1';
export const SHARED_CAPTURE=new URLSearchParams(location.search).get('capture')==='1';
export { createFrameProfiler } from './frame-profiler.js';

export function freezeLocalMeshMatrices(root:THREE.Object3D){root.updateMatrixWorld(true);root.traverse(object=>{if(object instanceof THREE.Mesh&&object.name!=='candle flame'){object.updateMatrix();object.matrixAutoUpdate=false;}});}
export function freezeTextureMatrices(materials:THREE.Material[]){for(const material of materials){for(const value of Object.values(material))if(value instanceof THREE.Texture){value.updateMatrix();value.matrixAutoUpdate=false;}}}

// Same face accumulation order and Float32 writes as BufferGeometry's normal
// builder, with scalar typed-array reads instead of thousands of accessor calls.
export function updateIndexedNormals(geometry:THREE.BufferGeometry){
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),index=geometry.index;if(!index||!normal){geometry.computeVertexNormals();return;}
  const p=position.array as Float32Array,n=normal.array as Float32Array,indices=index.array;n.fill(0);
  for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;const cbx=p[c]-p[b],cby=p[c+1]-p[b+1],cbz=p[c+2]-p[b+2],abx=p[a]-p[b],aby=p[a+1]-p[b+1],abz=p[a+2]-p[b+2];const nx=cby*abz-cbz*aby,ny=cbz*abx-cbx*abz,nz=cbx*aby-cby*abx;
    if(OPT_LEVEL>=10){n[a]+=nx;n[a+1]+=ny;n[a+2]+=nz;n[b]+=nx;n[b+1]+=ny;n[b+2]+=nz;n[c]+=nx;n[c+1]+=ny;n[c+2]+=nz;}
    else for(const v of [a,b,c]){n[v]+=nx;n[v+1]+=ny;n[v+2]+=nz;}}
  for(let i=0;i<n.length;i+=3){const length=Math.sqrt(n[i]*n[i]+n[i+1]*n[i+1]+n[i+2]*n[i+2]);if(length){n[i]/=length;n[i+1]/=length;n[i+2]/=length;}}normal.needsUpdate=true;
}
