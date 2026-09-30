import * as THREE from 'three';
import { box,mesh,namedGroup,ring,rod,bakeAssembly } from './geometry';
import type { Materials } from './materials';
import { seededRandom } from './simulation.js';

function canvas(size:number,draw:(c:CanvasRenderingContext2D,s:number)=>void,color=true){const element=document.createElement('canvas');element.width=element.height=size;draw(element.getContext('2d')!,size);const texture=new THREE.CanvasTexture(element);texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.anisotropy=8;return texture;}
export function createPeriodDeskDetails(parent:THREE.Object3D,m:Materials){
  const root=namedGroup(parent,'worn period writing desk instruments');
  const clock=namedGroup(root,'1847 gimballed marine chronometer');clock.position.set(-1.382,.031,-.088);
  const caseParts=namedGroup(clock,'brass-bound mahogany chronometer box');
  box(caseParts,[.046,.022,.046],m.hull,[0,-.005,0],'mahogany instrument case');
  for(const z of [-.022,.022])box(caseParts,[.047,.003,.002],m.brass,[0,.004,z],'case brass binding');
  const lid=box(caseParts,[.005,.045,.046],m.hull,[-.025,.013,0],'open wood chronometer lid');lid.rotation.z=-.17;
  for(const z of [-.018,.018])rod(caseParts,[-.022,-.004,z],[-.022,.031,z],.0015,m.brass,'lid hinge');
  const gimbal=ring(caseParts,.018,.0013,m.brass,[0,.010,0],'brass gimbal ring');gimbal.rotation.x=Math.PI/2;
  mesh(caseParts,new THREE.CylinderGeometry(.0152,.0146,.016,64),m.brass,[0,.009,0],'chronometer drum');
  const bezel=ring(caseParts,.0152,.0012,m.gold,[0,.0176,0],'scratched bezel');bezel.rotation.x=-Math.PI/2;
  for(const z of [-.017,.017])rod(caseParts,[0,.010,z],[0,.010,z*1.3],.0012,m.iron,'gimbal pivot');
  bakeAssembly(caseParts);
  const dialTexture=canvas(1024,(c,s)=>{
    c.fillStyle='#d3cfb5';c.fillRect(0,0,s,s);const r=seededRandom(804);
    for(let i=0;i<8000;i++){c.fillStyle=`rgba(89,75,39,${r()*.08})`;c.fillRect(r()*s,r()*s,r()*5+1,1);}
    c.translate(s/2,s/2);c.strokeStyle='#353c37';c.lineWidth=2;
    for(let i=0;i<60;i++){const a=i/60*Math.PI*2,inner=i%5===0?392:412;c.beginPath();c.moveTo(Math.sin(a)*inner,-Math.cos(a)*inner);c.lineTo(Math.sin(a)*438,-Math.cos(a)*438);c.stroke();}
    const numerals=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];c.textAlign='center';c.textBaseline='middle';c.fillStyle='#30382f';c.font='61px Georgia';
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;c.fillText(numerals[i],Math.sin(a)*335,-Math.cos(a)*335);}
    c.font='28px Georgia';c.fillText('MARINE CHRONOMETER',0,-155);c.font='24px Georgia';c.fillText('LONDON · 1847',0,-114);
    c.strokeStyle='#544f3c35';c.lineWidth=1;for(let i=0;i<13;i++){c.beginPath();const x=r()*s-s/2,y=r()*s-s/2;c.moveTo(x,y);c.lineTo(x+30+r()*45,y+20);c.stroke();}
  });
  const face=mesh(clock,new THREE.CircleGeometry(.0141,80),new THREE.MeshStandardMaterial({map:dialTexture,roughness:.66}),[0,.0182,0],'aged ivory chronometer dial');face.rotation.x=-Math.PI/2;
  const minute=namedGroup(clock,'chronometer minute hand'),hour=namedGroup(clock,'chronometer hour hand'),second=namedGroup(clock,'chronometer seconds hand');
  for(const [pivot,length,width,y] of [[minute,.011,.00055,.0187],[hour,.0082,.0008,.019],[second,.012,.00019,.0194]] as [THREE.Group,number,number,number][]){pivot.position.y=y;box(pivot,[width,.00018,length],m.iron,[0,0,-length*.34],'blued steel clock hand');}
  mesh(clock,new THREE.SphereGeometry(.0008,10,8),m.gold,[0,.0194,0],'chronometer hand spindle');
  // A metal-nib dip pen, not a modern ballpoint. Turned holder and exposed nib.
  const pen=namedGroup(root,'worn wood dip pen and split steel nib');pen.position.set(-1.275,.022,.064);pen.rotation.y=-.28;
  const penParts=namedGroup(pen,'pen holder and nib');
  rod(penParts,[-.018,0,0],[.007,0,0],.00145,m.darkWood,'worn turned wood holder',.56);
  rod(penParts,[.0068,0,0],[.012,0,0],.00155,m.brass,'tarnished nib ferrule',.85);
  const nibMat=new THREE.MeshStandardMaterial({color:'#716e59',metalness:.9,roughness:.53});nibMat.name='oxidized dip pen steel';
  const nib=new THREE.Shape();nib.moveTo(0,-.0016);nib.quadraticCurveTo(.004,-.0016,.008,0);nib.quadraticCurveTo(.004,.0016,0,.0016);nib.closePath();
  const nibGeometry=new THREE.ExtrudeGeometry(nib,{depth:.00015,bevelEnabled:false});nibGeometry.rotateX(-Math.PI/2);mesh(penParts,nibGeometry,nibMat,[.011,0,0],'pointed steel dip nib');
  rod(penParts,[.014,.00022,0],[.019,.00022,0],.00007,m.iron,'split nib slit');
  const breather=mesh(penParts,new THREE.SphereGeometry(.00032,8,6),m.iron,[.0145,.00017,0],'nib breather hole');breather.scale.y=.2;
  for(let i=0;i<5;i++)rod(penParts,[-.015+i*.004,.00146,-.0003],[-.014+i*.004,.00146,-.0003],.00010,m.deck,'holder finish scratch');
  bakeAssembly(penParts);
  // Local grime and traffic marks are independent of the wood normal/roughness.
  const wearTexture=canvas(512,(c,s)=>{const r=seededRandom(333);c.clearRect(0,0,s,s);for(let i=0;i<100;i++){const x=r()*s,y=r()*s,rx=10+r()*45;const g=c.createRadialGradient(x,y,0,x,y,rx);g.addColorStop(0,`rgba(25,26,19,${r()*.44})`);g.addColorStop(1,'rgba(25,26,19,0)');c.fillStyle=g;c.fillRect(x-rx,y-rx,rx*2,rx*2);}for(let i=0;i<75;i++){c.strokeStyle=`rgba(153,145,113,${r()*.25})`;c.lineWidth=1;c.beginPath();const x=r()*s,y=r()*s;c.moveTo(x,y);c.lineTo(x+2+r()*22,y+20+r()*40);c.stroke();}});
  const wearMat=new THREE.MeshStandardMaterial({map:wearTexture,transparent:true,roughness:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  for(const [x,width,z,depth] of [[-1.17,.47,0,.37],[.16,1.6,0,.30]] as [number,number,number,number][]){const stain=mesh(root,new THREE.PlaneGeometry(width,depth),wearMat,[x,-.2105,z],'trodden deck stains and scuffs');stain.rotation.x=-Math.PI/2;stain.castShadow=false;}
  for(const z of [-.29,.29]){const stain=mesh(root,new THREE.PlaneGeometry(.50,.16),wearMat,[-1.15,-.11,z],'cabin joint moisture staining');stain.rotation.y=z>0?Math.PI:0;stain.castShadow=false;}
  return {root,clock,pen,update(time:number){const elapsed=10*3600+8*60+time;hour.rotation.y=-(elapsed/43200)*Math.PI*2;minute.rotation.y=-(elapsed/3600)*Math.PI*2;second.rotation.y=-(Math.floor(elapsed)%60)/60*Math.PI*2;}};
}
