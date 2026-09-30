import * as THREE from 'three';
import type { Materials } from './materials';
import { bakeAssembly,box,mesh,namedGroup,ring,rod,rope,type V3 } from './geometry';
import { createLantern } from './room';
import { hullHalfWidth,seededRandom } from './simulation.js';

export type Compartment='helm'|'cabin'|'gun'|'hold';
export const COMPARTMENTS:Record<Compartment,{title:string;position:V3;yaw:number;pitch:number;description:string}>= {
  helm:{title:'The quarterdeck',position:[-1.40,.91,.025],yaw:0,pitch:-.09,description:'Oak helm · brass fittings · standing rigging'},
  cabin:{title:'Captain’s cabin',position:[-1.00,.115,0],yaw:Math.PI,pitch:-.04,description:'Navigation desk · charts · cot · stern gallery'},
  gun:{title:'The gun deck',position:[-.55,.02,.0],yaw:0,pitch:0,description:'Cannon battery · mess tables · crew hammocks'},
  hold:{title:'The cargo hold',position:[-.05,-.25,0],yaw:.12,pitch:-.1,description:'Water casks · provisions · ballast · ship’s stores'},
};

export function createShipInteriors(ship:THREE.Group,m:Materials) {
  const root=namedGroup(ship,'explorable ship compartments');
  const architecture=namedGroup(root,'interior oak frames decks and partitions');
  // Continuous internal ceiling/floors follow the hull. Longitudinal keelson and
  // repeated rib/beam pairs make every room an actual three-dimensional space.
  for(let i=0;i<47;i++){const x=-1.43+i*.061,w=hullHalfWidth(x)*.70;box(architecture,[.06,.017,w*2],m.deck,[x,-.22,0],'gun deck plank');box(architecture,[.06,.014,w*1.2],m.darkWood,[x,-.38,0],'hold floor plank');}
  box(architecture,[2.85,.06,.06],m.darkWood,[.02,-.325,0],'keelson');
  for(let i=0;i<13;i++){
    const x=-1.34+i*.215,w=hullHalfWidth(x);
    rope(architecture,[[x,.405,-w*.96],[x,.13,-w*.94],[x,-.12,-w*.79],[x,-.35,-w*.4],[x,-.44,0],[x,-.35,w*.4],[x,-.12,w*.79],[x,.13,w*.94],[x,.405,w*.96]],.014,m.darkWood,'steam-bent oak frame');
    box(architecture,[.026,.031,w*1.91],m.darkWood,[x,.399,0],'deck beam');
    if(i%3===0&&x>-.75)rod(architecture,[x,-.2,.08],[x,.405,.08],.017,m.deck,'deck pillar');
  }
  // Cabin bulkhead and actual door pivot, left open on entering.
  for(const z of [-.24,.24])box(architecture,[.024,.59,.16],m.darkWood,[-.82,.10,z],'cabin bulkhead panel');box(architecture,[.025,.17,.55],m.darkWood,[-.82,.32,0],'cabin door lintel');
  const door=namedGroup(root,'captain cabin door hinge');door.position.set(-.82,-.205,-.16);
  const doorParts=namedGroup(door,'paneled cabin door');box(doorParts,[.02,.45,.30],m.hull,[0,.225,.15],'cabin door');for(const y of [.14,.34])box(doorParts,[.024,.13,.22],m.darkWood,[.012,y,.15],'recessed door panel');mesh(doorParts,new THREE.SphereGeometry(.012,10,8),m.brass,[.025,.23,.272],'door knob');bakeAssembly(doorParts);door.rotation.y=-Math.PI*.58;
  // Ladder through the functional companion hatch.
  rod(architecture,[.29,.46,-.10],[.72,-.21,-.10],.012,m.deck,'companion ladder rail');rod(architecture,[.29,.46,.10],[.72,-.21,.10],.012,m.deck,'companion ladder rail');
  for(let i=0;i<7;i++)box(architecture,[.061,.019,.21],m.deck,[.31+i*.06,.41-i*.085,0],'companion ladder tread');
  // Captain's furnishings: chart table, ship's clock, cot, cabinets and chair.
  const cabin=namedGroup(root,'captain cabin furnishings');
  box(cabin,[.25,.020,.32],m.deck,[-1.315,.006,0],'captain’s chart table');
  for(const x of [-1.405,-1.225])for(const z of [-.12,.12])rod(cabin,[x,-.21,z],[x,.0,z],.008,m.darkWood,'table leg');
  const chartCanvas=document.createElement('canvas');chartCanvas.width=chartCanvas.height=512;const c=chartCanvas.getContext('2d')!;
  c.fillStyle='#d0bd8c';c.fillRect(0,0,512,512);c.strokeStyle='#a19367';for(let i=0;i<12;i++){c.beginPath();c.moveTo(i*48,0);c.lineTo(i*48,512);c.moveTo(0,i*48);c.lineTo(512,i*48);c.stroke();}c.strokeStyle='#66614a';c.lineWidth=3;c.beginPath();c.moveTo(70,90);c.bezierCurveTo(370,40,180,270,430,310);c.lineTo(350,370);c.bezierCurveTo(300,210,200,460,50,405);c.stroke();c.fillStyle='#625941';c.font='20px Georgia';c.fillText('NORTH ATLANTIC · 1847',106,45);
  const chartTexture=new THREE.CanvasTexture(chartCanvas);chartTexture.colorSpace=THREE.SRGBColorSpace;chartTexture.anisotropy=8;
  const chart=mesh(cabin,new THREE.PlaneGeometry(.18,.27),new THREE.MeshStandardMaterial({map:chartTexture,roughness:.94}),[-1.32,.019,0],'chart on captain’s desk');chart.rotation.x=-Math.PI/2;
  rod(cabin,[-1.37,.025,.048],[-1.29,.027,.048],.008,m.brass,'brass telescope');ring(cabin,.018,.003,m.brass,[-1.26,.024,-.07],'chart compass');
  mesh(cabin,new THREE.CylinderGeometry(.006,.007,.013,12),m.iron,[-1.36,.027,-.102],'period ink pot');
  // Wall cot and folded blanket.
  box(cabin,[.40,.045,.14],m.darkWood,[-1.075,-.115,-.206],'captain’s cot');box(cabin,[.37,.034,.13],m.sail,[-1.075,-.075,-.206],'cot mattress');box(cabin,[.08,.025,.095],m.sail,[-1.225,-.049,-.206],'linen pillow');box(cabin,[.19,.018,.125],new THREE.MeshStandardMaterial({color:'#35494c',roughness:.97}),[-1.01,-.045,-.206],'folded wool blanket');
  box(cabin,[.22,.27,.095],m.hull,[-1.05,-.08,.235],'captain’s sea chest');for(const x of [-1.13,-.97])box(cabin,[.012,.27,.098],m.brass,[x,-.08,.235],'sea chest strap');mesh(cabin,new THREE.SphereGeometry(.009,8,6),m.brass,[-1.05,.012,.180],'chest latch');
  box(cabin,[.12,.019,.12],m.darkWood,[-1.12,-.093,.035],'chair seat');for(const x of [-1.165,-1.075])for(const z of [-.009,.078])rod(cabin,[x,-.21,z],[x,-.09,z],.007,m.darkWood,'chair leg');box(cabin,[.013,.15,.12],m.darkWood,[-1.065,-.028,.035],'chair back');
  box(cabin,[.25,.015,.07],m.deck,[-1.03,.20,.26],'navigation library shelf');
  const bookMaterials=['#4c5144','#62503a','#3a454c'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.9}));
  for(let i=0;i<5;i++)box(cabin,[.021,.09+i*.004,.055],bookMaterials[i%3],[-1.11+i*.036,.251,.26],'navigation volume');
  // Five stern windows, mullions and interior window ledge.
  for(let i=-2;i<=2;i++){const z=i*.084;for(const side of [-1,1]){box(cabin,[.012,.103,.007],m.deck,[-1.478,.249,z+side*.03],'stern gallery vertical mullion');box(cabin,[.012,.007,.067],m.deck,[-1.478,.249+side*.051,z],'stern gallery horizontal mullion');}}
  box(cabin,[.049,.018,.44],m.deck,[-1.444,.181,0],'stern window sill');
  const clock=ring(cabin,.044,.006,m.brass,[-.84,.27,.226],'ship’s clock bezel');clock.rotation.y=Math.PI/2;
  // Gun deck: oak trucks, iron barrels, breeching ropes, powder buckets.
  const gunDeck=namedGroup(root,'gun deck battery and crew quarters');
  for(const side of [-1,1])for(let i=0;i<5;i++){
    const x=-.54+i*.355,z=side*(hullHalfWidth(x)*.65);
    box(gunDeck,[.15,.065,.13],m.hull,[x,-.15,z],'cannon carriage');
    for(const dx of [-.053,.053])for(const dz of [-.063,.063]){const wheel=mesh(gunDeck,new THREE.CylinderGeometry(.027,.027,.013,12),m.darkWood,[x+dx,-.182,z+dz],'carriage truck');wheel.rotation.x=Math.PI/2;}
    rod(gunDeck,[x,-.077,z-side*.10],[x,.15,side*(hullHalfWidth(x)+.04)],.028,m.iron,'long gun breech and barrel',.70);
    rope(gunDeck,[[x-.09,-.05,side*hullHalfWidth(x)*.89],[x-.06,-.14,z-side*.07],[x+.06,-.14,z-side*.07],[x+.09,-.05,side*hullHalfWidth(x)*.89]],.004,m.rope,'breeching rope');
    const shot=mesh(gunDeck,new THREE.SphereGeometry(.013,8,6),m.iron,[x+.065,-.204,z-side*.08],'round shot');
    const bucket=mesh(gunDeck,new THREE.CylinderGeometry(.021,.016,.042,10,1,true),m.hull,[x-.11,-.198,z-side*.09],'powder bucket');
  }
  // Hammock surfaces are sagging continuous cloth, with converging end ropes.
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const x=-.37+i*.57,z=side*.20,geometry=new THREE.PlaneGeometry(.44,.11,20,6);const p=geometry.getAttribute('position');
    for(let j=0;j<p.count;j++){const px=p.getX(j),pz=p.getY(j);p.setXYZ(j,px,.23-Math.cos(px/.22*Math.PI/2)*.063+Math.pow(pz/.055,2)*.020,pz);}geometry.computeVertexNormals();mesh(gunDeck,geometry,m.sail,[x,0,z],'sagging crew hammock');
    for(const dx of [-.22,.22])for(const dz of [-.055,.055])rod(gunDeck,[x+dx,.24,z+dz],[x+dx+Math.sign(dx)*.035,.395,z],.002,m.rope,'hammock end rope');
  }
  box(gunDeck,[.24,.025,.14],m.deck,[.30,-.055,.0],'crew mess table');for(const x of [.21,.39])rod(gunDeck,[x,-.20,0],[x,-.065,0],.008,m.darkWood,'mess table leg');
  for(const z of [-.1,.1])box(gunDeck,[.29,.024,.035],m.darkWood,[.30,-.14,z],'mess bench');
  mesh(gunDeck,new THREE.CylinderGeometry(.023,.018,.016,12),m.deck,[.26,-.032,0],'wooden mess bowl');mesh(gunDeck,new THREE.CylinderGeometry(.013,.013,.028,10),m.iron,[.36,-.025,0],'pewter mug');
  // Hold below the gun deck. Store casks, timber crates, coils, sacks and ballast.
  const hold=namedGroup(root,'cargo hold and ship’s stores');const random=seededRandom(1284);
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const x=-.60+i*.255,z=side*(.09+random()*.035),r=.045+random()*.01;
    mesh(hold,new THREE.CylinderGeometry(r*.88,r*.88,.13,16,4),m.hull,[x,-.30,z],'provisions cask');mesh(hold,new THREE.SphereGeometry(r,16,10),m.hull,[x,-.30,z],'rounded cask body').scale.y=1.5;
    for(const y of [-.347,-.30,-.253]){const hoop=ring(hold,r*.99,.003,m.iron,[x,y,z],'cask iron hoop');hoop.rotation.x=Math.PI/2;}
    if(i%2===0){box(hold,[.10,.079,.10],m.deck,[x+.12,-.34,z],'provision crate');for(const y of [-.368,-.326])box(hold,[.104,.01,.104],m.darkWood,[x+.12,y,z],'crate batten');}
  }
  for(let i=0;i<19;i++){const x=-.7+random()*1.7,z=(random()-.5)*.20;const stone=mesh(hold,new THREE.DodecahedronGeometry(.018+random()*.018,0),new THREE.MeshStandardMaterial({color:'#4d504b',roughness:1}),[x,-.389,z],'stone ballast');stone.scale.set(1.4,.6,1);}
  for(let i=0;i<3;i++){const coil=ring(hold,.027+i*.004,.003,m.rope,[.45,-.233,.15],'stored rope coil');coil.rotation.x=Math.PI/2;}
  for(const x of [-.60,.55])rod(hold,[x,-.38,-.03],[x,-.225,-.03],.018,m.darkWood,'hold stanchion');
  for(const assembly of [architecture,cabin,gunDeck,hold])bakeAssembly(assembly);
  const lamps=[createLantern(root,m,[-1.33,.125,.16],.092,'captain’s desk lantern'),createLantern(root,m,[-.28,.323,.04],.11,'gun deck lantern'),createLantern(root,m,[.93,.323,-.07],.11,'forward gun deck lantern'),createLantern(root,m,[.12,-.263,.01],.072,'hold safety lamp')];
  for(const lamp of lamps){lamp.light.intensity=.026;lamp.light.distance=.70;lamp.light.castShadow=false;}
  root.userData.historicalScope='Generic late age-of-sail interpretation. Captain furnishings, gun-deck hammocks, mess tables and stores informed by Royal Navy / NMRN accounts of HMS Victory; not a scale reconstruction of that vessel.';
  return {root,door,lamps,update(time:number){lamps.forEach((lamp,i)=>{lamp.light.intensity=.026*(1+Math.sin(time*6.2+i)*.03);});}};
}
