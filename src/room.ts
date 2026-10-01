import * as THREE from 'three';
import { bakeAssembly, box, mesh, namedGroup, ring, rod, rope, type V3 } from './geometry';
import type { Materials } from './materials';
import { seededRandom } from './simulation.js';
import { roomOrbitBounds } from './orbit-camera.js';

function drawnTexture(size:number,draw:(c:CanvasRenderingContext2D,s:number)=>void) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d')!,size);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}
function compassTexture() {return drawnTexture(512,(c,s)=>{
  c.fillStyle='#c4b88e';c.fillRect(0,0,s,s);const random=seededRandom(52);
  for(let i=0;i<2000;i++){c.fillStyle=`rgba(52,39,19,${random()*.08})`;c.fillRect(random()*s,random()*s,random()*3+1,1);}
  c.translate(s/2,s/2);c.strokeStyle='#655436';c.lineWidth=2;
  for(const r of [206,187,144]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}
  for(let i=0;i<120;i++){const a=i/120*Math.PI*2,r=i%5===0?178:186;c.beginPath();c.moveTo(Math.sin(a)*r,Math.cos(a)*r);c.lineTo(Math.sin(a)*198,Math.cos(a)*198);c.stroke();}
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=i%4===0?140:i%2===0?108:65;c.save();c.rotate(a);c.fillStyle=i%2===0?'#3b3b2f':'#7b6740';c.beginPath();c.moveTo(0,-r);c.lineTo(17,0);c.lineTo(0,16);c.fill();c.fillStyle='#a59462';c.beginPath();c.moveTo(0,-r);c.lineTo(-17,0);c.lineTo(0,16);c.fill();c.restore();}
  c.fillStyle='#514b39';c.font='28px Georgia';c.textAlign='center';c.textBaseline='middle';for(const [t,x,y] of [['N',0,-163],['S',0,163],['E',163,0],['W',-163,0]] as [string,number,number][])c.fillText(t,x,y);
});}
export function createLantern(parent:THREE.Object3D,m:Materials,position:V3,scale=1,name='navigation lantern') {
  const root=namedGroup(parent,name);const body=namedGroup(root,'brass lantern housing');
  mesh(body,new THREE.CylinderGeometry(.30,.32,.065,6),m.brass,[0,-.34,0],'hexagonal foot');
  mesh(body,new THREE.CylinderGeometry(.32,.30,.055,6),m.brass,[0,.32,0],'upper gallery');
  mesh(body,new THREE.CylinderGeometry(.08,.32,.20,6),m.brass,[0,.44,0],'ventilated hood');
  mesh(body,new THREE.CylinderGeometry(.06,.07,.14,10),m.iron,[0,.57,0],'vent cap');
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;rod(body,[Math.cos(a)*.285,-.32,Math.sin(a)*.285],[Math.cos(a)*.285,.32,Math.sin(a)*.285],.014,m.brass,'glass frame');}
  const hanger=ring(body,.09,.015,m.iron,[0,.70,0],'lantern bail');
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;box(body,[.016,.10,.018],m.iron,[Math.cos(a)*.064,.53,Math.sin(a)*.064],'vent slot');}
  bakeAssembly(body);
  const pane=mesh(root,new THREE.CylinderGeometry(.265,.265,.63,6,1,true),m.lampGlass,[0,0,0],'amber lantern glass');pane.castShadow=false;
  mesh(root,new THREE.CylinderGeometry(.057,.065,.17,12),new THREE.MeshStandardMaterial({color:'#cfbd89',roughness:.9}),[0,-.225,0],'wax candle');
  const flame=mesh(root,new THREE.SphereGeometry(.07,12,12),m.flame,[0,-.045,0],'candle flame');flame.scale.set(.55,1.6,.55);flame.castShadow=false;
  const light=new THREE.PointLight('#ffb558',18,9,2);light.position.set(0,0,0);root.add(light);
  root.position.set(...position);root.scale.setScalar(scale);
  return {root,flame,light,hanger};
}
export function createRoom(m:Materials) {
  const room=new THREE.Group();room.name='The cartographer’s study';
  const staticRoom=namedGroup(room,'room architecture');
  const wall=new THREE.MeshStandardMaterial({color:'#17252a',roughness:.94});wall.name='smoked blue plaster';
  const backWall=box(staticRoom,[40,15,.3],wall,[0,6,-8.4],'study wall'),leftWall=box(staticRoom,[.3,15,28],wall,[-15,6,2],'left wall'),rightWall=box(staticRoom,[.3,15,28],wall,[15,6,2],'right wall');
  const tabletop=box(staticRoom,[35,.45,25],m.walnut,[0,-.32,1.8],'old oak tabletop');
  for(let i=-4;i<=4;i++)box(staticRoom,[.012,.004,24],m.darkWood,[i*3.4,-.092,1.8],'table board seam');
  box(staticRoom,[40,2.8,.2],m.darkWood,[0,1.2,-8.15],'wainscot');
  for(let x=-14;x<=14;x+=2.5){box(staticRoom,[.055,2.65,.06],m.walnut,[x,1.2,-7.99],'wall panel stile');box(staticRoom,[2.38,.06,.04],m.walnut,[x+1.24,2.15,-7.98],'wall panel rail');}
  box(staticRoom,[35,.09,.12],m.brass,[0,2.65,-8.0],'wainscot picture rail');
  // A rain-streaked, moonlit window supplies readable reflection shapes.
  const windowGlass=new THREE.MeshBasicMaterial({color:new THREE.Color(.25,.45,.59)});
  box(staticRoom,[4.3,5.1,.06],m.darkWood,[-7.5,6,-8.03],'window recess');box(staticRoom,[3.83,4.65,.03],windowGlass,[-7.5,6,-7.975],'moonlit window');
  for(const x of [-9.52,-7.5,-5.48])box(staticRoom,[.10,5.18,.20],m.walnut,[x,6,-7.88],'window mullion');
  for(const y of [3.5,6,8.5])box(staticRoom,[4.15,.11,.20],m.walnut,[-7.5,y,-7.88],'window transom');
  box(staticRoom,[4.5,.14,.75],m.darkWood,[-7.5,3.40,-7.68],'window sill');
  const curtainMaterial=new THREE.MeshStandardMaterial({color:'#332b22',roughness:.96,side:THREE.DoubleSide});
  for(const x of [-10.2,-4.83]){const g=new THREE.PlaneGeometry(1.4,6.5,28,20);const p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setZ(i,Math.cos(p.getX(i)*27)*.13);g.computeVertexNormals();mesh(staticRoom,g,curtainMaterial,[x,5.4,-7.55],'heavy linen curtain');}
  // Books and nautical specimens keep captain view recognizably in a room.
  const shelf=namedGroup(room,'bookcase and collected objects');
  for(const x of [4.8,10.3])box(shelf,[.25,9,.80],m.darkWood,[x,4.1,-7.54],'bookcase upright');
  const random=seededRandom(331);const bookMaterials=['#3d4944','#554030','#283d46','#66533b','#403635'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.88}));
  for(const y of [.3,2.4,4.6,6.8,8.55]){box(shelf,[5.7,.17,.88],m.walnut,[7.55,y,-7.43],'bookcase shelf');
    if(y<8)for(let i=0;i<13;i++){const h=.95+random()*.70,w=.17+random()*.16,x=5.1+i*.36;const b=box(shelf,[w,h,.49],bookMaterials[i%bookMaterials.length],[x,y+h/2+.1,-7.30],'bound atlas');b.rotation.z=(random()-.5)*.05;for(const offset of [-h*.33,h*.33])box(shelf,[w+.005,.018,.015],m.brass,[x,y+h/2+.1+offset,-7.047],'book spine tooling');}
  }
  const moon=new THREE.DirectionalLight('#88b9df',2.0);moon.name='moon through window';moon.position.set(-7,8,4);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);moon.shadow.camera.left=-11;moon.shadow.camera.right=11;moon.shadow.camera.top=9;moon.shadow.camera.bottom=-6;moon.shadow.camera.near=.5;moon.shadow.camera.far=30;moon.shadow.bias=-.0004;moon.shadow.normalBias=.025;room.add(moon);
  const fill=new THREE.HemisphereLight('#96bbd0','#312214',.65);fill.name='room ambient bounce';room.add(fill);
  const windowLight=new THREE.PointLight('#88b9e4',55,24,2);windowLight.position.set(-7,6,-4);room.add(windowLight);
  const lamps=[createLantern(room,m,[6.0,.89,-.7],1.55,'desk lantern'),createLantern(room,m,[-5.2,.62,-2.05],.85,'distant candle lantern')];
  lamps[0].light.intensity=65;lamps[1].light.intensity=19;
  // Hand-drawn navigational chart; it is an authored prop, not a photographic backdrop.
  const chartTexture=drawnTexture(1024,(c,s)=>{
    c.fillStyle='#a89367';c.fillRect(0,0,s,s);const rand=seededRandom(741);
    for(let i=0;i<5000;i++){c.fillStyle=`rgba(65,43,21,${rand()*.06})`;c.fillRect(rand()*s,rand()*s,rand()*20,1);}
    c.strokeStyle='#675c3d70';c.lineWidth=1;for(let i=0;i<14;i++){c.beginPath();c.moveTo(i*80,0);c.lineTo(i*80,s);c.moveTo(0,i*80);c.lineTo(s,i*80);c.stroke();}
    c.strokeStyle='#554f32';c.lineWidth=2;for(let j=0;j<5;j++){c.beginPath();const x=rand()*s,y=rand()*s;for(let i=0;i<60;i++){const a=i/59*Math.PI*2,r=90+Math.sin(a*3+j)*40+Math.cos(a*7)*14;i?c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r):c.moveTo(x+r,y);}c.stroke();}
    c.setLineDash([6,7]);c.strokeStyle='#70492e';c.beginPath();c.moveTo(80,800);c.bezierCurveTo(500,760,330,150,850,200);c.stroke();c.setLineDash([]);
    c.font='21px Georgia';c.fillStyle='#574c30';c.fillText('MARE ATLANTICUM',360,80);c.font='13px Georgia';c.fillText('CHART OF THE NORTHERN PASSAGE · 1847',330,115);
    c.save();c.translate(790,785);for(let i=0;i<8;i++){c.rotate(Math.PI/4);c.beginPath();c.moveTo(0,-90);c.lineTo(10,0);c.lineTo(0,15);c.lineTo(-10,0);c.fill();}c.restore();
  });
  const chartMaterial=new THREE.MeshStandardMaterial({map:chartTexture,color:'#c5b28c',roughness:.95,side:THREE.DoubleSide});
  const chart=mesh(room,new THREE.PlaneGeometry(4.4,3.3,32,32),chartMaterial,[-5.1,-.082,2.5],'chart of the northern passage');chart.rotation.x=-Math.PI/2;chart.rotation.z=-.26;
  const paper=chart.geometry.getAttribute('position');for(let i=0;i<paper.count;i++){const x=paper.getX(i),y=paper.getY(i);paper.setZ(i,.03*Math.sin(x*1.5)*Math.cos(y*2)+Math.pow(Math.abs(x)/2.2,12)*.1);}chart.geometry.computeVertexNormals();
  const coins=namedGroup(room,'scattered maritime objects');
  for(let i=0;i<12;i++){const x=2.9+random()*4.8,z=1.2+random()*2.9,r=.05+random()*.08;mesh(coins,new THREE.CylinderGeometry(r,r,.018,20),m.brass,[x,-.064+random()*.011,z],'old brass coin');}
  const dividers=namedGroup(coins,'chart dividers');rod(dividers,[-3.8,.01,1.8],[-4.7,-.03,2.5],.024,m.brass,'divider leg');rod(dividers,[-3.8,.01,1.8],[-4.0,-.03,2.75],.024,m.brass,'divider leg');
  const compassFace=compassTexture();
  const deskCompass=ring(coins,.35,.035,m.brass,[-3.5,-.025,3.4],'desk compass rim');deskCompass.rotation.x=-Math.PI/2;
  const dial=mesh(room,new THREE.CircleGeometry(.325,64),new THREE.MeshStandardMaterial({map:compassFace,roughness:.55}),[-3.5,-.008,3.4],'desk compass dial');dial.rotation.x=-Math.PI/2;
  // Capture structural bounds BEFORE static batching removes the authored meshes.
  room.updateMatrixWorld(true);
  const bounds=(object:THREE.Object3D)=>new THREE.Box3().setFromObject(object);
  const orbitBounds=roomOrbitBounds(bounds(leftWall),bounds(rightWall),bounds(backWall),bounds(shelf),bounds(tabletop));
  bakeAssembly(staticRoom);bakeAssembly(shelf);bakeAssembly(coins);
  const key=new THREE.PointLight('#f9d3a0',30,22,2);key.position.set(5.5,6.3,6);room.add(key);
  return {root:room,lamps,compassFace,orbitBounds,update(time:number){lamps.forEach((lamp,i)=>{lamp.flame.scale.y=1.5+Math.sin(time*7+i)*.1;lamp.light.intensity=(i?19:65)*(1+Math.sin(time*5.3+i*5)*.025);});}};
}

export function createBottleDetails(m:Materials,compassFace:THREE.Texture) {
  const root=new THREE.Group();root.name='bottle cradle cork and hanging instruments';
  const stand=namedGroup(root,'carved walnut plinth');
  box(stand,[9.3,.20,3.5],m.darkWood,[-.30,.05,0],'plinth lower molding');box(stand,[9.05,.28,3.3],m.walnut,[-.3,.29,0],'plinth body');box(stand,[9.20,.11,3.4],m.darkWood,[-.3,.485,0],'plinth top molding');
  for(const side of [-1,1])for(const x of [-4.55,3.95]){box(stand,[.46,.17,.5],m.darkWood,[x,-.02,side*1.4],'plinth foot');box(stand,[.25,.20,.22],m.brass,[x,.34,side*1.5],'brass corner fitting');}
  for(const x of [-2.9,2.4]){
    const shape=new THREE.Shape();shape.moveTo(-1.5,.54);shape.lineTo(-1.5,1.70);shape.quadraticCurveTo(-1.40,1.72,-1.30,1.48);shape.bezierCurveTo(-.85,1.02,-.48,.995,0,.99);shape.bezierCurveTo(.48,.995,.85,1.02,1.3,1.48);shape.quadraticCurveTo(1.40,1.72,1.5,1.70);shape.lineTo(1.5,.54);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.39,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.035,bevelThickness:.035});geometry.rotateY(Math.PI/2);
    mesh(stand,geometry,m.walnut,[x-.19,0,0],'sculpted cradle');
    for(const z of [-1.49,1.49]){mesh(stand,new THREE.SphereGeometry(.10,12,8),m.brass,[x,1.70,z],'cradle finial');box(stand,[.64,.16,.52],m.darkWood,[x,.61,z*.76],'cradle pedestal');box(stand,[.025,.82,.025],m.brass,[x+.22,1.10,z*.84],'cradle inlay');}
  }
  const plaqueTexture=drawnTexture(1024,(c,s)=>{c.fillStyle='#776135';c.fillRect(0,0,s,s);c.strokeStyle='#cfb06f';c.lineWidth=12;c.strokeRect(30,300,964,424);c.font='italic 132px Georgia';c.fillStyle='#e2c586';c.textAlign='center';c.fillText('Tempest',s/2,500);c.font='28px Georgia';c.fillText('THE ASTERION  ·  NORTH ATLANTIC  ·  1847',s/2,594);});
  const plaqueMaterial=new THREE.MeshStandardMaterial({map:plaqueTexture,metalness:.65,roughness:.42});
  box(stand,[2.44,.44,.054],m.brass,[-.3,.365,1.713],'engraved plaque surround');mesh(stand,new THREE.PlaneGeometry(2.37,.42),plaqueMaterial,[-.3,.365,1.744],'Tempest inscription');
  for(const x of [-1.44,.84])mesh(stand,new THREE.SphereGeometry(.027,8,6),m.gold,[x,.365,1.75],'plaque screw');
  bakeAssembly(stand);
  const cork=namedGroup(root,'natural cork and neck rope');
  const stopper=mesh(cork,new THREE.CylinderGeometry(.85,.78,.89,64,6),m.cork,[5.98,3.48,0],'natural cork stopper');stopper.rotation.z=-Math.PI/2;
  for(let i=0;i<8;i++){const pts:V3[]=[];for(let j=0;j<=90;j++){const a=j/90*Math.PI*2;pts.push([5.12+i*.054+Math.sin(a*5)*.007,3.48+Math.cos(a)*.917,Math.sin(a)*.917]);}rope(cork,pts,.024,m.rope,'neck rope coil');}
  rope(cork,[[5.45,3.67,.86],[5.54,3.55,1.05],[5.41,3.38,1.04],[5.35,3.48,.88]],.030,m.rope,'mariner’s knot');
  rope(cork,[[5.45,3.38,.90],[5.54,2.95,1.1],[5.21,2.62,1.2],[5.12,2.47,1.25]],.017,m.rope,'lantern suspension line');
  rope(cork,[[5.55,3.45,.89],[5.95,3.1,1.10],[6.06,2.73,1.20],[6.06,2.59,1.20]],.013,m.rope,'compass suspension line');
  bakeAssembly(cork);
  const compass=namedGroup(root,'hanging brass compass');const body=namedGroup(compass,'instrument case');
  ring(body,.40,.042,m.brass,[0,0,0],'compass bezel');ring(body,.435,.009,m.gold,[0,0,.02],'bezel engraving');
  const back=mesh(body,new THREE.CylinderGeometry(.396,.396,.07,64),m.brass,[0,0,-.032],'compass housing');back.rotation.x=Math.PI/2;
  ring(body,.069,.012,m.brass,[0,.474,0],'compass suspension ring');
  bakeAssembly(body);
  const compassMaterial=new THREE.MeshStandardMaterial({map:compassFace,roughness:.5,metalness:.12});mesh(compass,new THREE.CircleGeometry(.373,64),compassMaterial,[0,0,.009],'engraved compass rose');
  const needle=new THREE.Shape();needle.moveTo(0,.32);needle.lineTo(.04,0);needle.lineTo(0,-.26);needle.lineTo(-.04,0);needle.closePath();mesh(compass,new THREE.ShapeGeometry(needle),m.gold,[0,0,.021],'magnetic needle');
  mesh(compass,new THREE.SphereGeometry(.025,10,8),m.iron,[0,0,.037],'needle spindle');
  compass.position.set(6.06,2.05,1.20);compass.rotation.y=-.12;
  const hangingLamp=createLantern(root,m,[5.12,1.86,1.25],.77,'hanging shipwright’s lantern');hangingLamp.light.intensity=15;
  return {root,compass,hangingLamp,update(time:number){compass.rotation.z=Math.sin(time*.52)*.028;hangingLamp.root.rotation.z=Math.sin(time*.61+1)*.015;hangingLamp.flame.scale.y=1.55+Math.sin(time*8.1)*.09;hangingLamp.light.intensity=15+Math.sin(time*9.1)*.4;}};
}
