import * as THREE from 'three/webgpu';
import { applyTissueAbsorption } from './shading.js';
import { createSpray } from './spray.js';
import { mesh,namedGroup,rope,bakeAssembly } from './geometry';
import { OPT_LEVEL,updateIndexedNormals } from './benchmark';
import { seededRandom,waveHeight,clamp } from './simulation.js';
import { BOTTLE_PROFILE_TEXTURE } from './ocean';

function whaleMaterial(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d')!,random=seededRandom(4521);
  for(let y=0;y<512;y++){const belly=Math.pow(Math.max(0,-Math.cos(y/512*Math.PI*2)),.6);c.fillStyle=`rgb(${90+belly*48},${108+belly*44},${115+belly*42})`;c.fillRect(0,y,1024,1);}
  for(let i=0;i<1200;i++){const x=random()*1024,y=random()*512,r=4+random()*34,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${random()>.5?'174,180,174':'47,68,76'},${.12+random()*.28})`);g.addColorStop(1,'rgba(90,110,120,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
  const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=1024;const n=normalCanvas.getContext('2d')!;n.fillStyle='#989898';n.fillRect(0,0,1024,1024);
  for(let i=0;i<9000;i++){n.fillStyle=`rgba(155,155,155,${random()*.06})`;n.fillRect(random()*1024,random()*1024,random()*3,1);}
  // Throat pleats are recessed skin folds, not separate bright ropes. Their
  // normal response uses the SAME skin material and spectral absorption.
  for(let j=-26;j<=26;j++){
    const angle=Math.PI+Math.asin(j/32),y=angle/(Math.PI*2)*1024,x0=(.42+Math.abs(j)*.001)*1024,x1=(.948-Math.abs(j)*.0006)*1024;
    const taper=n.createLinearGradient(x0,0,x1,0);taper.addColorStop(0,'rgba(45,45,45,0)');taper.addColorStop(.13,'rgba(45,45,45,.80)');taper.addColorStop(.84,'rgba(45,45,45,.80)');taper.addColorStop(1,'rgba(45,45,45,0)');n.strokeStyle=taper;n.lineWidth=1.4;n.beginPath();n.moveTo(x0,y);n.bezierCurveTo(x0+(x1-x0)*.30,y+.4,x0+(x1-x0)*.74,y-.5,x1,y);n.stroke();
    c.strokeStyle='rgba(43,61,67,.06)';c.lineWidth=.6;c.beginPath();c.moveTo(x0,y*.5);c.lineTo(x1,y*.5);c.stroke();
  }
  const bump=new THREE.CanvasTexture(normalCanvas);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;
  const mat=new THREE.MeshPhysicalNodeMaterial({color:'#a9c6ce',map,bumpMap:bump,bumpScale:.003,roughness:.47,metalness:0,clearcoat:0,ior:1.34,specularIntensity:.18});mat.name='mottled blue-gray cetacean skin';
  applyTissueAbsorption(mat);
  return mat;
}
function bodyProfile(t:number){
  const stations=[[0,.024,.026],[.08,.049,.051],[.18,.073,.070],[.31,.12,.104],[.44,.178,.149],[.58,.201,.159],[.71,.196,.143],[.85,.183,.103],[.95,.149,.068],[1,.054,.047]];
  for(let i=1;i<stations.length;i++)if(t<=stations[i][0]){const a=stations[i-1],b=stations[i],p=stations[Math.max(0,i-2)],n=stations[Math.min(stations.length-1,i+1)],dt=b[0]-a[0],f=(t-a[0])/dt;return [1,2].map(j=>{const m0=(b[j]-p[j])/Math.max(.001,b[0]-p[0])*dt,m1=(n[j]-a[j])/Math.max(.001,n[0]-a[0])*dt;return (2*f*f*f-3*f*f+1)*a[j]+(f*f*f-2*f*f+f)*m0+(-2*f*f*f+3*f*f)*b[j]+(f*f*f-f*f)*m1;});}return [.054,.047];
}
function headOffset(t:number){const f=clamp((t-.67)/.13,0,1);return -.023*f*f*(3-2*f);}
function bodyGeometry(){const p:number[]=[],uv:number[]=[],indices:number[]=[],rows=88,angles:number[]=[];
  for(let j=0;j<=48;j++)angles.push(j/48*Math.PI*2);
  for(let j=-26;j<=26;j++){const center=Math.PI+Math.asin(j/32);for(const offset of [-.010,-.0045,0,.0045,.010])angles.push(center+offset);}
  angles.sort((a,b)=>a-b);const angular=angles.filter((a,i)=>i===0||a-angles[i-1]>.00001),stride=angular.length;
  const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
  for(let i=0;i<=rows;i++){const t=i/rows,x=-1.10+t*2.1,[w,h]=bodyProfile(t);for(let j=0;j<stride;j++){const a=angular[j],belly=Math.cos(a)<0?1.10:1,q=Math.sin(a)*32,nearest=Math.round(q),fraction=q-nearest;
    const groove=Math.cos(a)<0&&Math.abs(nearest)<=26?Math.exp(-((fraction/.15)**2))*.00125*smooth(.42,.52,t)*(1-smooth(.91,.952,t)):0;
    const radial=1-groove/Math.max(.025,h),y=Math.cos(a)*h*belly*radial+headOffset(t);p.push(x,y,Math.sin(a)*w*radial);uv.push(t,a/(Math.PI*2));
    if(i<rows&&j<stride-1){const k=i*stride+j;indices.push(k,k+1,k+stride,k+1,k+stride+1,k+stride);}
  }}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.userData.rowStride=stride;return geometry;
}
function finGeometry(points:THREE.Vector2[],thickness:number){const shape=new THREE.Shape(points);const g=new THREE.ExtrudeGeometry(shape,{depth:thickness,steps:1,bevelEnabled:true,bevelSize:thickness*.6,bevelThickness:thickness*.5,bevelSegments:3,curveSegments:20});g.rotateX(Math.PI/2);return g;}
export function createWhale(canSurface?:(point:THREE.Vector3)=>boolean){
  const root=new THREE.Group();root.name='Balaenoptera musculus · blue whale';const material=whaleMaterial();
  const body=mesh(root,bodyGeometry(),material,[0,0,0],'continuous tapered blue whale body');body.castShadow=true;
  // Match the loft's lowered head center: the old positive offset made a
  // conspicuous, anatomically incorrect upright bulb at the end of the snout.
  const rostrum=mesh(root,new THREE.SphereGeometry(1,32,16),material,[.994,-.023,0],'rounded U-shaped rostral cap');rostrum.scale.set(.022,.047,.055);
  const original=(body.geometry.getAttribute('position').array as Float32Array).slice();
  const tail=namedGroup(root,'horizontal caudal flukes');tail.position.x=-1.1;
  const flukeMeshes:THREE.Mesh[]=[];
  const flukeRest:Float32Array[]=[];
  // Continuous thin hydrofoil lobes: rounded leading edge, tapered tip,
  // concave trailing edge and a genuine central trailing-edge notch.
  for(const side of [-1,1]){
    const positions:number[]=[],uv:number[]=[],indices:number[]=[],spans=28,chords=18;
    for(let face=0;face<2;face++)for(let row=0;row<=spans;row++){
      const t=row/spans,z=side*t*.414,leading=.035+.040*Math.sin(t*Math.PI)-.135*t*t,trailing=leading-(.18+.14*Math.sin(t*Math.PI))*Math.pow(1-t,.40)-.009;
      for(let col=0;col<=chords;col++){const u=col/chords,x=leading+(trailing-leading)*u,foil=(.2969*Math.sqrt(u)-.1260*u-.3516*u*u+.2843*u*u*u-.1036*u**4),thickness=foil*.082*(1-.88*t**1.5),camber=.0035*Math.sin(u*Math.PI)*(1-t);
        positions.push(x,camber+(face===0?1:-1)*thickness,z);uv.push(.012+u*.17,(face===0?.025:.48)+t*.10);
      }
    }
    const stride=chords+1,layer=(spans+1)*stride;
    for(let face=0;face<2;face++)for(let row=0;row<spans;row++)for(let col=0;col<chords;col++){const a=face*layer+row*stride+col,b=a+1,c=a+stride,d=c+1;if((side>0)===(face===0))indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);}
    for(let row=0;row<spans;row++)for(const col of [0,chords]){const a=row*stride+col,b=a+stride;indices.push(a,b,a+layer,b,b+layer,a+layer);}
    for(let col=0;col<chords;col++){const a=spans*stride+col,b=a+1;indices.push(a,a+layer,b,b,a+layer,b+layer);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    const fluke=mesh(tail,geo,material,[0,0,0],`${side<0?'port':'starboard'} tapered hydrofoil fluke`);(fluke.geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);flukeMeshes.push(fluke);flukeRest.push((geo.getAttribute('position').array as Float32Array).slice());
  }
  const caudalJoint=mesh(tail,new THREE.SphereGeometry(1,24,14),material,[.005,0,0],'smooth caudal peduncle fairing');caudalJoint.scale.set(.073,.025,.037);
  const flippers:THREE.Group[]=[];
  for(const side of [-1,1]){const pivot=namedGroup(root,`${side<0?'port':'starboard'} pectoral flipper`);pivot.position.set(.36,-.078,side*.154);
    const shape=new THREE.Shape();shape.moveTo(.08,0);shape.bezierCurveTo(-.10,.02,-.29,.25,-.43,.40);shape.bezierCurveTo(-.26,.16,-.08,-.055,.08,-.028);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.009,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:3,curveSegments:24});geo.rotateX(side<0?-Math.PI/2:Math.PI/2);mesh(pivot,geo,material,[0,0,0],'long tapered pectoral fin');flippers.push(pivot);
  }
  // Dorsal fin is deliberately small and far aft, unlike a dolphin's.
  const dorsalShape=new THREE.Shape();dorsalShape.moveTo(-.18,0);dorsalShape.quadraticCurveTo(-.02,.12,.09,.12);dorsalShape.quadraticCurveTo(.025,.022,.17,0);dorsalShape.closePath();
  const dorsal=mesh(root,new THREE.ExtrudeGeometry(dorsalShape,{depth:.011,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:3}),material,[-.63,.073,-.0055],'small aft dorsal fin');
  const dark=new THREE.MeshStandardNodeMaterial({color:'#17252d',roughness:.72});
  applyTissueAbsorption(dark);
  const cornea=new THREE.MeshPhysicalMaterial({color:'#10191e',roughness:.16,metalness:0,ior:1.376,specularIntensity:.48});cornea.name='subtle cetacean cornea';
  const iris=new THREE.MeshStandardMaterial({color:'#28383c',roughness:.42});iris.name='dark blue-gray whale iris';
  for(const side of [-1,1]){
    const eyeX=.695,eyeT=(eyeX+1.1)/2.1,[eyeWidth,eyeHeight]=bodyProfile(eyeT),eyeY=headOffset(eyeT)-.002;
    const eye=mesh(root,new THREE.SphereGeometry(.0062,28,18),cornea,[eyeX,eyeY,side*(eyeWidth-.001)],'eye seated within the skin');eye.scale.set(.95,.74,.40);
    const irisRing=mesh(root,new THREE.TorusGeometry(.0023,.00028,6,24),iris,[eyeX+.0006,eyeY,side*(eyeWidth+.0015)],'subtle iris around dark pupil');irisRing.scale.y=.80;if(side<0)irisRing.rotation.y=Math.PI;
    const lid:[number,number,number][]=[];
    for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,x=eyeX+Math.cos(a)*.0092,y=eyeY+Math.sin(a)*.0064,t=(x+1.1)/2.1,[w,h]=bodyProfile(t),offset=headOffset(t),radial=w*Math.sqrt(Math.max(0,1-((y-offset)/h)**2));lid.push([x,y,side*(radial+.0008)]);}
    rope(root,lid,.00115,material,'soft orbital eyelid fold');
    const crease:[number,number,number][]=[];for(let i=0;i<14;i++){const a=.25+i/13*2.55,x=eyeX-.001+Math.cos(a)*.014,y=eyeY+Math.sin(a)*.0094,t=(x+1.1)/2.1,[w,h]=bodyProfile(t);crease.push([x,y,side*(w*Math.sqrt(Math.max(0,1-((y-headOffset(t))/h)**2))+.0006)]);}rope(root,crease,.00045,material,'subtle upper orbital crease');
    const mouth: [number,number,number][]=[];for(let i=0;i<=30;i++){const x=.40+i/30*.59,t=(x+1.1)/2.1,[w,h]=bodyProfile(t),angle=Math.PI/2+.25;mouth.push([x,Math.cos(angle)*h*1.10+headOffset(t),side*(Math.sin(angle)*w+.0007)]);}rope(root,mouth,.0008,dark,'fine recessed jaw seam following the skin');
  }
  // Ventral groove relief is integrated in the shared skin height map.
  const bhT=(.61+1.1)/2.1,bhY=bodyProfile(bhT)[1]+headOffset(bhT);
  for(const z of [-.021,.021]){const rim=mesh(root,new THREE.SphereGeometry(.014,20,12),material,[.61,bhY+.001,z],'raised blowhole lip');rim.scale.set(1.45,.30,.65);const hole=mesh(root,new THREE.SphereGeometry(.012,16,10),dark,[.61,bhY+.004,z],'paired blowhole opening');hole.scale.set(1.44,.08,.54);}
  const ridge:[number,number,number][]=[];for(let i=0;i<14;i++){const x=.65+i/13*.27,t=(x+1.1)/2.1;ridge.push([x,bodyProfile(t)[1]+headOffset(t)+.002,0]);}rope(root,ridge,.004,material,'rostral ridge ahead of blowholes');
  const random=seededRandom(987),count=150,seeds=new Float32Array(count*4),positions=new Float32Array(count*3);
  if(OPT_LEVEL>=2){const detail=namedGroup(root,'batched anatomical microdetail');for(const child of [...root.children])if(child instanceof THREE.Mesh&&child!==body)detail.attach(child);bakeAssembly(detail);}
  for(let i=0;i<count;i++){seeds.set([random(),random(),random(),random()],i*4);}
  const {plume,uniforms:plumeUniforms}=createSpray(seeds,count,BOTTLE_PROFILE_TEXTURE);
  let nextBreath=8,breathStart=-100,plumeStart=-100,hasBlown=false;
  const blowhole=new THREE.Vector3(.61,bhY+.007,0),headWorld=new THREE.Vector3();
  const smooth=(a:number)=>{const t=clamp(a,0,1);return t*t*(3-2*t);};
  function surfaceNow(time:number){breathStart=time;hasBlown=false;nextBreath=time+32;}
  function update(time:number,storm:number){
    if(time>=nextBreath)surfaceNow(time);
    const age=time-breathStart;let surface=smooth(age/1.9)*(1-smooth((age-4.3)/2.5));
    const phase=1.7+time*.064,px=-.15+Math.cos(phase)*2.15,pz=Math.sin(phase)*1.10;
    const heading=Math.atan2(Math.cos(phase)*1.10,-Math.sin(phase)*2.15);
    root.position.set(px,1.94+Math.sin(time*.35)*.025,pz);root.rotation.set(0,-heading,.045+surface*.08);
    headWorld.copy(blowhole).applyQuaternion(root.quaternion).add(root.position);
    // A whale cannot rise through the keel. Hold a requested breath until
    // the rostrum has cleared the conservative moving hull footprint.
    if(surface>0&&canSurface&&!canSurface(headWorld)){breathStart=time;surface=0;root.rotation.z=.045;headWorld.copy(blowhole).applyQuaternion(root.quaternion).add(root.position);}
    const surfaceY=waveHeight(headWorld.x,headWorld.z,time,storm)-(headWorld.y-root.position.y)-.025+.065*smooth((age-1.6)/.4);
    root.position.y+=(surfaceY-root.position.y)*surface;
    const p=body.geometry.getAttribute('position');
    if(OPT_LEVEL>=9){const array=p.array as Float32Array;for(let row=0;row<89;row++){const stride=body.geometry.userData.rowStride as number,first=row*stride*3,x=original[first],amount=clamp((.3-x)/1.4,0,1),offset=Math.sin(time*2.15+x*2.6)*.039*amount*amount;for(let j=0;j<body.geometry.userData.rowStride;j++){const i=first+j*3;array[i+1]=original[i+1]+offset;}}}
    else for(let i=0;i<p.count;i++){const x=original[i*3],amount=clamp((.3-x)/1.4,0,1);p.setY(i,original[i*3+1]+Math.sin(time*2.15+x*2.6)*.039*amount*amount);}
    p.needsUpdate=true;if(OPT_LEVEL>=5)updateIndexedNormals(body.geometry);else body.geometry.computeVertexNormals();
    tail.position.y=Math.sin(time*2.15-2.86)*.039;tail.rotation.z=Math.cos(time*2.15-2.86)*.12;
    flukeMeshes.forEach((fluke,index)=>{const p=fluke.geometry.getAttribute('position'),base=flukeRest[index],array=p.array as Float32Array;for(let i=0;i<p.count;i++){const span=Math.abs(base[i*3+2])/.414;array[i*3+1]=base[i*3+1]+Math.sin(time*2.15-2.86-span*.72)*.011*span*span;}p.needsUpdate=true;if(OPT_LEVEL>=5)updateIndexedNormals(fluke.geometry);else fluke.geometry.computeVertexNormals();});
    flippers.forEach((fin,i)=>{fin.rotation.x=Math.sin(time*.6+i*.4)*.065;});
    if(age>=2.0&&age<4.4&&surface>.98&&!hasBlown){hasBlown=true;plumeStart=time;root.updateMatrixWorld(true);headWorld.copy(blowhole);root.localToWorld(headWorld);plumeUniforms.uOrigin.value.copy(headWorld);}
    plumeUniforms.uAge.value=time-plumeStart;plumeUniforms.uScale.value=innerHeight;plume.visible=time-plumeStart<2.2;
    headWorld.copy(blowhole);root.localToWorld(headWorld);
    return {x:headWorld.x,z:headWorld.z,surface,age:Math.max(0,time-plumeStart),blowing:plume.visible};
  }
  root.userData.anatomy='NOAA-informed blue whale: broad U-shaped rostrum, mottled blue-gray skin, ventral pleats, small aft dorsal fin, paired blowholes, horizontal flukes. Hand-authored interpretation, not photogrammetry.';
  return {root,plume,blowhole:headWorld,surfaceNow,update};
}
