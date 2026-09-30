import * as THREE from 'three';
import { bakeAssembly, box, mesh, namedGroup, ring, rod, rope, type V3 } from './geometry';
import type { Materials } from './materials';
import { hullHalfWidth } from './simulation.js';
import { OPT_LEVEL,updateIndexedNormals } from './benchmark';
import { MASTS,standingLines } from './rigging-layout.js';

class ClothSail {
  readonly mesh:THREE.Mesh;
  private current:Float32Array;
  private previous:Float32Array;
  private rest:Float32Array;
  private pinned:Uint8Array;
  private links:{a:number;b:number;length:number}[]=[];
  private columns=18;private rows=13;
  private contacts:{ax:number;ay:number;az:number;dx:number;dy:number;dz:number;length2:number;radius:number;minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number}[]=[];
  private ray=new THREE.Ray();private triangle=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];private contactPoint=new THREE.Vector3();private contactNormal=new THREE.Vector3();private edge=new THREE.Vector3();
  constructor(parent:THREE.Object3D,x:number,top:number,width:number,height:number,material:THREE.Material,name:string) {
    const cols=this.columns,rows=this.rows,count=(cols+1)*(rows+1);
    this.current=new Float32Array(count*3);this.pinned=new Uint8Array(count);
    const uv=new Float32Array(count*2),indices:number[]=[];
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const i=row*(cols+1)+col,u=col/cols,t=row/rows,z=(u-.5)*width*(1-t*.12);
      this.current.set([x-z*.43+Math.sin(u*Math.PI)*Math.sin(t*Math.PI)*.12,top-.023-t*height+.045*Math.sin(u*Math.PI)*t,z],i*3);
      uv.set([u,1-t],i*2);
      this.pinned[i]=row===0||(row===rows&&(col===0||col===cols))?1:0;
      if(row<rows&&col<cols){const a=i,b=i+1,c=i+cols+1,d=c+1;indices.push(a,c,b,b,c,d);}
    }
    this.rest=this.current.slice();this.previous=this.current.slice();
    const connect=(a:number,b:number)=>{const ai=a*3,bi=b*3;this.links.push({a:ai,b:bi,length:Math.hypot(this.rest[ai]-this.rest[bi],this.rest[ai+1]-this.rest[bi+1],this.rest[ai+2]-this.rest[bi+2])});};
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){const i=row*(cols+1)+col;if(col<cols)connect(i,i+1);if(row<rows)connect(i,i+cols+1);if(row<rows&&col<cols){connect(i,i+cols+2);connect(i+1,i+cols+1);}}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.current,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    this.mesh=mesh(parent,geometry,material,[0,0,0],name);this.mesh.frustumCulled=false;this.mesh.castShadow=true;
  }
  setColliders(lines:ReturnType<typeof standingLines>){
    this.mesh.geometry.computeBoundingBox();const bounds=this.mesh.geometry.boundingBox!.clone().expandByScalar(.18);
    this.contacts=lines.filter(line=>new THREE.Box3(new THREE.Vector3(...line.a),new THREE.Vector3(...line.a)).expandByPoint(new THREE.Vector3(...line.b)).expandByScalar(.035).intersectsBox(bounds)).map(line=>{const [ax,ay,az]=line.a,dx=line.b[0]-ax,dy=line.b[1]-ay,dz=line.b[2]-az;return {ax,ay,az,dx,dy,dz,length2:dx*dx+dy*dy+dz*dz,radius:line.r+.036,minX:Math.min(ax,line.b[0])-.0001,maxX:Math.max(ax,line.b[0])+.0001,minY:Math.min(ay,line.b[1])-.0001,maxY:Math.max(ay,line.b[1])+.0001,minZ:Math.min(az,line.b[2])-.0001,maxZ:Math.max(az,line.b[2])+.0001};});
  }
  update(dt:number,time:number,storm:number){
    const damping=.977,step=dt*dt;
    for(let i=0;i<this.current.length;i+=3){if(this.pinned[i/3])continue;
      for(let axis=0;axis<3;axis++){const p=this.current[i+axis],velocity=(p-this.previous[i+axis])*damping;this.previous[i+axis]=p;
        const force=axis===0?.95+storm*2.5+Math.sin(time*2.1+this.rest[i+1]*5+this.rest[i+2]*7)*.5:axis===1?-.45:Math.sin(time*2.7+i*.11)*.15;
        this.current[i+axis]=p+velocity+force*step;
      }
    }
    for(let iteration=0;iteration<4;iteration++){
      for(const {a,b,length} of this.links){const dx=this.current[b]-this.current[a],dy=this.current[b+1]-this.current[a+1],dz=this.current[b+2]-this.current[a+2];const distance=Math.max(.00001,Math.hypot(dx,dy,dz));const f=(distance-length)/distance;
        const pa=this.pinned[a/3],pb=this.pinned[b/3],fa=pa?0:pb?1:.5,fb=pb?0:pa?1:.5;
        this.current[a]+=dx*f*fa;this.current[a+1]+=dy*f*fa;this.current[a+2]+=dz*f*fa;this.current[b]-=dx*f*fb;this.current[b+1]-=dy*f*fb;this.current[b+2]-=dz*f*fb;
      }
      for(let i=0;i<this.current.length;i+=3){
        if(this.pinned[i/3]){this.current[i]=this.rest[i];this.current[i+1]=this.rest[i+1];this.current[i+2]=this.rest[i+2];continue;}
        for(const c of this.contacts){if(OPT_LEVEL>=3&&(this.current[i]<c.minX-c.radius||this.current[i]>c.maxX+c.radius||this.current[i+1]<c.minY-c.radius||this.current[i+1]>c.maxY+c.radius||this.current[i+2]<c.minZ-c.radius||this.current[i+2]>c.maxZ+c.radius))continue;const x=this.current[i]-c.ax,y=this.current[i+1]-c.ay,z=this.current[i+2]-c.az,t=Math.max(0,Math.min(1,(x*c.dx+y*c.dy+z*c.dz)/c.length2)),dx=x-c.dx*t,dy=y-c.dy*t,dz=z-c.dz*t,d2=dx*dx+dy*dy+dz*dz;
          if(d2<c.radius*c.radius){const distance=Math.sqrt(Math.max(1e-12,d2)),scale=(c.radius-distance)/distance;this.current[i]+=dx*scale;this.current[i+1]+=dy*scale;this.current[i+2]+=dz*scale;}
        }
      }
    }
    // Vertex/capsule contact alone can miss a thin line between vertices. Test
    // complete triangles as well, keeping the sail on its original contact side.
    const indices=this.mesh.geometry.index!.array;
    for(const c of this.contacts){const length=Math.sqrt(c.length2);this.ray.origin.set(c.ax,c.ay,c.az);this.ray.direction.set(c.dx/length,c.dy/length,c.dz/length);
      for(let k=0;k<indices.length;k+=3){const a=indices[k]*3,b=indices[k+1]*3,d=indices[k+2]*3;
        if(OPT_LEVEL>=3&&(Math.max(this.current[a],this.current[b],this.current[d])<c.minX||Math.min(this.current[a],this.current[b],this.current[d])>c.maxX||Math.max(this.current[a+1],this.current[b+1],this.current[d+1])<c.minY||Math.min(this.current[a+1],this.current[b+1],this.current[d+1])>c.maxY||Math.max(this.current[a+2],this.current[b+2],this.current[d+2])<c.minZ||Math.min(this.current[a+2],this.current[b+2],this.current[d+2])>c.maxZ))continue;
        this.triangle[0].fromArray(this.current,a);this.triangle[1].fromArray(this.current,b);this.triangle[2].fromArray(this.current,d);
        const hit=this.ray.intersectTriangle(this.triangle[0],this.triangle[1],this.triangle[2],false,this.contactPoint);if(!hit||this.ray.origin.distanceToSquared(hit)>c.length2)continue;
        this.contactNormal.subVectors(this.triangle[1],this.triangle[0]).cross(this.edge.subVectors(this.triangle[2],this.triangle[0])).normalize();const restSide=((this.rest[a]+this.rest[b]+this.rest[d])/3-hit.x)*this.contactNormal.x+((this.rest[a+1]+this.rest[b+1]+this.rest[d+1])/3-hit.y)*this.contactNormal.y+((this.rest[a+2]+this.rest[b+2]+this.rest[d+2])/3-hit.z)*this.contactNormal.z;if(restSide<0)this.contactNormal.negate();
        for(const v of [a,b,d])if(!this.pinned[v/3]){const separation=(this.current[v]-hit.x)*this.contactNormal.x+(this.current[v+1]-hit.y)*this.contactNormal.y+(this.current[v+2]-hit.z)*this.contactNormal.z,shift=Math.max(0,c.radius*.6-separation);this.current[v]+=this.contactNormal.x*shift;this.current[v+1]+=this.contactNormal.y*shift;this.current[v+2]+=this.contactNormal.z*shift;}
      }
    }
    this.mesh.geometry.getAttribute('position').needsUpdate=true;if(OPT_LEVEL>=5)updateIndexedNormals(this.mesh.geometry);else this.mesh.geometry.computeVertexNormals();
  }
}

function hullGeometry() {
  const positions:number[]=[],uv:number[]=[],index:number[]=[];
  const rows=46,section=10;
  for(let i=0;i<=rows;i++){
    const t=i/rows,x=-1.5+t*3.1,w=Math.max(.012,hullHalfWidth(x)),lift=.11*Math.pow(Math.abs(t-.45)*2,3);
    const cross=[[-1,.47],[-1.035,.29],[-.98,.06],[-.78,-.25],[-.40,-.44],[0,-.50],[.40,-.44],[.78,-.25],[.98,.06],[1.035,.29],[1,.47]];
    for(let j=0;j<=section;j++){positions.push(x,cross[j][1]+lift,cross[j][0]*w);uv.push(t*3,j/section*1.1);
      if(i<rows&&j<section){const a=i*(section+1)+j,b=a+section+1;index.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}

export function createShip(materials:Materials) {
  const root=new THREE.Group();root.name='The Asterion · three-masted frigate';
  const hull=namedGroup(root,'hull and oak planking');mesh(hull,hullGeometry(),materials.hull,[0,0,0],'continuous hull shell');
  materials.hull.side=THREE.DoubleSide;
  const transomShape=new THREE.Shape();transomShape.moveTo(-.23,-.315);transomShape.lineTo(.23,-.315);transomShape.lineTo(.23,.475);transomShape.lineTo(-.23,.475);transomShape.closePath();
  for(let i=-2;i<=2;i++){const z=i*.084,hole=new THREE.Path();hole.moveTo(z-.024,.205);hole.lineTo(z-.024,.293);hole.lineTo(z+.024,.293);hole.lineTo(z+.024,.205);hole.closePath();transomShape.holes.push(hole);}
  const transomGeometry=new THREE.ExtrudeGeometry(transomShape,{depth:.022,bevelEnabled:false});transomGeometry.rotateY(Math.PI/2);mesh(hull,transomGeometry,materials.hull,[-1.506,0,0],'stern transom with open gallery windows');
  const outline=(height:number,offset:number,material:THREE.Material,radius:number)=>{
    for(const side of [-1,1]){
      const pts:V3[]=[];for(let i=0;i<=40;i++){const x=-1.49+i/40*3.08;pts.push([x,height+.11*Math.pow(Math.abs((x+1.5)/3.1-.45)*2,3),side*(hullHalfWidth(x)+offset)]);}
      rope(hull,pts,radius,material,'continuous wale / rub rail');
    }
  };
  outline(.33,.006,materials.brass,.012);outline(.05,-.01,materials.darkWood,.017);outline(.49,.001,materials.gold,.012);
  for(let level=0;level<5;level++)outline(-.28+level*.115,-.012-level*.004,materials.darkWood,.003);
  // Deck planks follow the actual hull footprint; there is no water-visible hole.
  const deck=namedGroup(root,'teak deck and bulwarks');
  for(let i=0;i<49;i++){const x=-1.46+i*.061;const w=hullHalfWidth(x);if(x>.22&&x<.58){for(const side of [-1,1])box(deck,[.059,.048,w-.145],materials.deck,[x,.452,side*(w+.145)/2],'plank around companion hatch');}else box(deck,[.059,.048,w*2],materials.deck,[x,.452,0],'caulked deck plank');}
  for(const side of [-1,1]){
    for(let i=0;i<35;i++){const x=-1.41+i*.086;const w=hullHalfWidth(x);box(deck,[.083,.115,.037],materials.hull,[x,.527,w*side],'bulwark');if(i%3===0)rod(deck,[x,.54,w*side],[x,.65,w*side],.01,materials.brass,'rail stanchion');}
    const pts:V3[]=[];for(let i=0;i<=40;i++){const x=-1.42+i/40*2.95;pts.push([x,.65,hullHalfWidth(x)*side]);}rope(deck,pts,.012,materials.darkWood,'cap rail');
  }
  const quarterdeck=namedGroup(root,'stern quarterdeck and gallery');
  box(quarterdeck,[.70,.20,.65],materials.hull,[-1.125,.556,0],'raised quarterdeck');box(quarterdeck,[.73,.043,.69],materials.deck,[-1.125,.678,0],'quarterdeck flooring');
  for(const side of [-1,1]){box(quarterdeck,[.52,.018,.019],materials.gold,[-1.08,.81,.35*side],'gallery rail');for(let i=0;i<9;i++)rod(quarterdeck,[-1.34+i*.062,.69,.35*side],[-1.34+i*.062,.81,.35*side],.008,materials.brass,'gallery baluster');}
  box(quarterdeck,[.035,.20,.62],materials.darkWood,[-1.37,.54,0],'stern transom');
  const sternGlass=new THREE.MeshPhysicalMaterial({color:'#dce5d6',roughness:.09,transmission:1,thickness:.005,ior:1.46,side:THREE.DoubleSide,depthWrite:false});sternGlass.name='stern gallery optical panes';
  for(let i=-2;i<=2;i++){const z=i*.084;for(const side of [-1,1]){box(quarterdeck,[.030,.106,.008],materials.gold,[-1.516,.249,z+side*.029],'stern window vertical frame');box(quarterdeck,[.030,.008,.066],materials.gold,[-1.516,.249+side*.052,z],'stern window horizontal frame');}box(root,[.005,.087,.047],sternGlass,[-1.51,.249,z],'transparent stern gallery pane');}
  // Gun ports, lids, cannon barrels and carriage ironwork.
  const armament=namedGroup(root,'gun ports and cannon battery');
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const x=-.91+i*.355,w=hullHalfWidth(x)*side;
    box(armament,[.125,.115,.017],materials.brass,[x,.237,w],'gun port surround');box(armament,[.096,.079,.022],materials.iron,[x,.237,w+side*.015],'open gun port');
    rod(armament,[x,.245,w-side*.06],[x,.245,w+side*.105],.034,materials.iron,'cannon barrel',.75);
    ring(armament,.031,.006,materials.iron,[x,.245,w+side*.102],'cannon muzzle');
    const lid=box(armament,[.12,.016,.09],materials.hull,[x,.31,w+side*.037],'hinged port lid');lid.rotation.x=side*.22;
  }
  const masts=namedGroup(root,'masts yards and bowsprit');const rig=namedGroup(root,'standing and running rigging');
  const sails:ClothSail[]=[];
  const mastSpecs=MASTS;
  const standing=standingLines(hullHalfWidth);
  mastSpecs.forEach((spec,mi)=>{
    rod(masts,[spec.x,.42,0],[spec.x,spec.top,0],.035,materials.deck,'tapered mast',.38);
    for(const y of [.51,.88,1.35,1.87])if(y<spec.top)mesh(masts,new THREE.CylinderGeometry(.041,.041,.025,12),materials.brass,[spec.x,y,0],'mast iron band');
    const nestY=spec.top-.66;const nest=mesh(masts,new THREE.CylinderGeometry(.13,.078,.064,18),materials.darkWood,[spec.x,nestY,0],'crow’s nest');nest.userData.collisionCapsule={a:[spec.x,nestY-.032,0],b:[spec.x,nestY+.032,0],r:.13};
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;rod(masts,[spec.x+Math.cos(a)*.125,nestY,Math.sin(a)*.125],[spec.x+Math.cos(a)*.125,nestY+.09,Math.sin(a)*.125],.005,materials.brass,'crow’s nest railing');}
    const nestRing=ring(masts,.127,.006,materials.brass,[spec.x,nestY+.09,0],'nest cap rail');nestRing.rotation.x=Math.PI/2;
    spec.levels.forEach((y,si)=>{
      const width=spec.width*(1-si*.22),height=si===0?.65:si===1?.48:.32;
      rod(masts,[spec.x+.09+width*.215,y,-width*.5],[spec.x+.09-width*.215,y,width*.5],.017-si*.003,materials.darkWood,'braced yard');
      sails.push(new ClothSail(root,spec.x+.09,y,width,height,materials.sail,`${['mizzen','main','fore'][mi]} ${['course','topsail','topgallant'][si]}`));
      for(const side of [-1,1]){
        const yard:V3=[spec.x+.09-side*width*.215,y,side*width*.5];rope(rig,[[spec.x,spec.top-.02,0],yard],.0038,materials.rope,'yard lift');
        const clew:V3=[spec.x+.09-side*width*.44*.43,y-.023-height,side*width*.44];
        const lead:V3=si===0?[spec.x-.18,mi===0?.70:.56,side*Math.min(.34,hullHalfWidth(spec.x-.18)*.95)]:[spec.x+.09-side*(spec.width*(1-(si-1)*.22))*.215,spec.levels[si-1],side*(spec.width*(1-(si-1)*.22))*.5];
        rope(rig,[clew,lead],.0038,materials.rope,'clew sheet outside sail');
      }
    });

  });
  rod(masts,[1.10,.55,0],[2.16,.93,0],.034,materials.deck,'bowsprit',.38);
  for(const line of standing)rod(rig,line.a as V3,line.b as V3,line.r,materials.rope,line.name);
  const contacts=[...standing];
  for(const parent of [masts,rig])parent.traverse(object=>{if(object.userData.collisionCapsule&&!['shroud','ratline','backstay','forestay'].includes(object.name))contacts.push({...object.userData.collisionCapsule,name:object.name,mast:-1});if(object.userData.collisionPolyline){const {points,r}=object.userData.collisionPolyline;for(let i=1;i<points.length;i++)contacts.push({a:points[i-1],b:points[i],r,name:object.name,mast:-1});}});
  for(const sail of sails)sail.setColliders(contacts);
  root.userData.riggingClearance={helm:[-1.12,.84,0],standingLines:standing.length,contactSegments:contacts.length,clothContacts:true};
  // Two filled, slightly billowed triangular headsails.
  for(let j=0;j<2;j++){
    const vertices=j===0?[.91,2.24,.025,1.10,1.04,.025,2.05,.99,.025]:[.72,1.9,.06,.94,.78,.06,1.70,.92,.06];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,0,0,1,0],2));g.computeVertexNormals();mesh(root,g,materials.sail,[0,0,0],`jib ${j+1}`);
  }
  // Hatch, capstan, belaying pins, bitts, barrels and coiled line.
  const fittings=namedGroup(root,'deck fittings');
  for(const side of [-1,1])box(fittings,[.39,.075,.025],materials.darkWood,[.4,.49,side*.155],'hatch coaming');
  const hatch=namedGroup(root,'companion hatch hinge');hatch.position.set(.21,.505,0);const hatchCover=namedGroup(hatch,'brass hatch grating');for(let i=0;i<7;i++)box(hatchCover,[.35,.013,.022],materials.brass,[.175,0,-.12+i*.04],'hatch grate');bakeAssembly(hatchCover);
  mesh(fittings,new THREE.CylinderGeometry(.075,.095,.17,12),materials.darkWood,[1.06,.55,0],'capstan');rod(fittings,[.9,.66,0],[1.23,.66,0],.01,materials.deck,'capstan bar');
  for(const side of [-1,1])for(const x of [-.55,.29,.95]){box(fittings,[.13,.035,.06],materials.darkWood,[x,.61,side*.32],'pin rail');for(let j=0;j<3;j++)rod(fittings,[x-.04+j*.04,.59,side*.32],[x-.04+j*.04,.68,side*.32],.007,materials.deck,'belaying pin');}
  for(const x of [-.54,.66]){mesh(fittings,new THREE.CylinderGeometry(.046,.046,.10,12),materials.hull,[x,.52,-.19],'water barrel');for(const y of [.49,.555]){const r=ring(fittings,.048,.003,materials.iron,[x,y,-.19],'barrel hoop');r.rotation.x=Math.PI/2;}}
  for(let j=0;j<4;j++){const r=ring(fittings,.042+j*.008,.004,materials.rope,[.59,.49,.20],'coiled deck line');r.rotation.x=Math.PI/2;}
  // Wheel pivot stays separate so captain steering really turns the wheel.
  const wheel=namedGroup(root,'helm wheel pivot');wheel.position.set(-1.12,.84,0);
  const wheelParts=namedGroup(wheel,'eight-spoke oak helm');const rim=ring(wheelParts,.102,.011,materials.deck,[0,0,0],'wheel rim');rim.rotation.y=Math.PI/2;
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;rod(wheelParts,[0,0,0],[0,Math.sin(a)*.135,Math.cos(a)*.135],.007,materials.deck,'wheel spoke and handle');}
  rod(wheelParts,[-.03,0,0],[.04,0,0],.027,materials.brass,'wheel hub');bakeAssembly(wheelParts);
  rod(fittings,[-1.12,.69,0],[-1.12,.82,0],.020,materials.darkWood,'helm pedestal');
  // Signal pennants have an independent animated mesh.
  const flagGeometry=new THREE.PlaneGeometry(.30,.12,16,4);flagGeometry.translate(.15,0,0);
  const flag=mesh(root,flagGeometry,new THREE.MeshStandardMaterial({color:'#754635',side:THREE.DoubleSide,roughness:.8}),[0,2.74,0],'weather pennant');
  for(const assembly of [hull,deck,quarterdeck,armament,masts,rig,fittings])bakeAssembly(assembly);
  root.userData.sculptRuntime={pivots:['helm wheel pivot'],sockets:{captainEye:[-1.2,1.15,0],lookForward:[1.5,1.03,0]},collider:{length:3.1,beam:.92},parts:['hull and oak planking','teak deck and bulwarks','stern quarterdeck and gallery','gun ports and cannon battery','masts yards and bowsprit','standing and running rigging','deck fittings'],approximation:'Procedural interpretation of one illustrative reference, not recovered geometry.'};
  root.userData.boardable=true;
  let accumulator=0;
  function update(dt:number,time:number,storm:number,rudder:number){
    accumulator+=Math.min(dt,.04);let steps=0;
    while(accumulator>=1/60&&steps<3){for(const sail of sails)sail.update(1/60,time,storm);accumulator-=1/60;steps++;}
    wheel.rotation.x=-rudder*.9;
    const p=flag.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i);p.setZ(i,Math.sin(x*19-time*5)*x*.22+Math.sin(x*31-time*7)*x*.1);}p.needsUpdate=true;flag.geometry.computeVertexNormals();
  }
  return {root,wheel,hatch,sails,update};
}
