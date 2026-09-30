import * as THREE from 'three/webgpu';
import { Fn, If, Loop, Break, Discard, int, float, vec2, vec3, vec4, uniform, texture, texture3D, varying, attribute, positionGeometry, positionWorld, cameraPosition, normalize, min, max, mix, smoothstep, exp, pow, sin, mod } from 'three/tsl';
import { seededRandom } from './simulation.js';
import { BOTTLE_PROFILE_TEXTURE } from './ocean';
import { createBottleNodes, hullWidthNode } from './shading.js';
import { OPT_LEVEL } from './benchmark';
import { createCloudLightCache } from './cloud-light-cache.js';

function cloudEnvelope(){
  const width=128,height=64,depth=64,data=new Uint16Array(width*height*depth),billows=[[-3.1,4.70,0,1.05,.69,1.45],[-1.85,5.14,-.25,1.35,.58,1.40],[.10,5.52,.05,1.50,.42,1.30],[2.0,4.94,-.10,1.28,.76,1.38],[3.2,4.43,.05,.88,.59,.90]];
  for(let z=0;z<depth;z++)for(let y=0;y<height;y++)for(let x=0;x<width;x++){const px=-4.8+(x+.5)/width*9.4,py=3.7+(y+.5)/height*2.35,pz=-2.44+(z+.5)/depth*4.88;let form=0;for(const b of billows){const dx=(px-b[0])/b[3],dy=(py-b[1])/b[4],dz=(pz-b[2])/b[5];form=Math.max(form,1-Math.sqrt(dx*dx+dy*dy+dz*dz));}data[(z*height+y)*width+x]=THREE.DataUtils.toHalfFloat(form);}
  const texture=new THREE.Data3DTexture(data,width,height,depth);texture.format=THREE.RedFormat;texture.type=THREE.HalfFloatType;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;return texture;
}

function noiseVolume() {
  const size=48,data=new Uint8Array(size**3);const random=seededRandom(7389);
  // Coherent periodic value noise, not random voxels. This prevents grainy clouds
  // and gives the ray marcher genuine macro/meso density structure.
  const grids=[4,8,16].map(n=>({n,data:Float32Array.from({length:n**3},()=>random())}));
  function sample(grid,x,y,z){const {n,data}=grid;const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);const smooth=(v)=>v*v*(3-2*v);const a=smooth(x-ix),b=smooth(y-iy),c=smooth(z-iz);const get=(dx,dy,dz)=>data[((iz+dz)%n)*n*n+((iy+dy)%n)*n+(ix+dx)%n];const mix=(v,w,t)=>v+(w-v)*t;return mix(mix(mix(get(0,0,0),get(1,0,0),a),mix(get(0,1,0),get(1,1,0),a),b),mix(mix(get(0,0,1),get(1,0,1),a),mix(get(0,1,1),get(1,1,1),a),b),c);}
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){let value=0;grids.forEach((g,i)=>{value+=sample(g,x/size*g.n,y/size*g.n,z/size*g.n)*[.60,.28,.12][i];});data[z*size*size+y*size+x]=value*255;}
  const texture=new THREE.Data3DTexture(data,size,size,size);texture.format=THREE.RedFormat;texture.type=THREE.UnsignedByteType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.wrapS=texture.wrapT=texture.wrapR=THREE.RepeatWrapping;texture.unpackAlignment=1;texture.needsUpdate=true;return texture;
}
export function createAtmosphere() {
  const uniforms = {
    uTime: uniform(0), uStorm: uniform(.65), uFlash: uniform(0),
    uNoise: texture3D(noiseVolume()), uSteps: uniform(48, 'int'),
    uBottleProfile: texture(BOTTLE_PROFILE_TEXTURE), uShipInverse: uniform(new THREE.Matrix4()),
    uShadowSteps: uniform(4, 'int'),
    uEnvelope: OPT_LEVEL >= 3 ? texture3D(cloudEnvelope()) : null
  };
  const bottle = createBottleNodes(uniforms.uBottleProfile);
  const density = Fn(([p]) => {
    const value = float(0).toVar();
    If(bottle.inside(p, float(.19)), () => {
      const q = p.mul(vec3(.29, .39, .34)).add(vec3(uniforms.uTime.mul(-.010), 0, uniforms.uTime.mul(.004))).toVar();
      const n = uniforms.uNoise.sample(q).level(0).r.mul(.7).add(uniforms.uNoise.sample(q.mul(2.71)).level(0).r.mul(.3));
      const form = float(0).toVar();
      if (OPT_LEVEL >= 3) form.assign(uniforms.uEnvelope.sample(p.sub(vec3(-4.8, 3.7, -2.44)).div(vec3(9.4, 2.35, 4.88))).level(0).r);
      else {
        for (const b of [[-3.1, 4.70, 0, 1.05, .69, 1.45], [-1.85, 5.14, -.25, 1.35, .58, 1.40], [.10, 5.52, .05, 1.50, .42, 1.30], [2.0, 4.94, -.10, 1.28, .76, 1.38], [3.2, 4.43, .05, .88, .59, .90]]) {
          form.assign(max(form, float(1).sub(p.sub(vec3(...b.slice(0, 3))).div(vec3(...b.slice(3))).length())));
        }
      }
      const r = bottle.radius(p.x).sub(.19), wall = smoothstep(0, .18, r.sub(vec2(p.y.sub(3.48), p.z).length()));
      const billow = smoothstep(-.06, .30, form.add(n.sub(.49).mul(.86)));
      value.assign(billow.mul(wall).mul(uniforms.uStorm.mul(1.42).add(.62)));
    });
    return value;
  });
  const cacheEnabled=OPT_LEVEL>=12&&document.body.dataset.renderer==='webgpu'&&new URLSearchParams(location.search).get('lightcache')!=='0';
  const lightCache=cacheEnabled?createCloudLightCache(density,uniforms):null;
  document.body.dataset.cloudLightCache=lightCache?'enabled':'disabled';
  const cloudMaterial = new THREE.NodeMaterial(); cloudMaterial.transparent = true; cloudMaterial.depthWrite = false; cloudMaterial.side = THREE.BackSide;
  cloudMaterial.name = 'TSL bounded volumetric storm clouds';
  cloudMaterial.colorNode = Fn(() => {
    const ro = cameraPosition.toVar(), rd = normalize(positionWorld.sub(ro)).toVar();
    const inv = vec3(1).div(rd), a = vec3(-4.75, 3.8, -2.44).sub(ro).mul(inv), b = vec3(4.45, 5.93, 2.44).sub(ro).mul(inv);
    const mn = min(a, b).toVar(), mx = max(a, b).toVar();
    const start = max(0, max(max(mn.x, mn.y), mn.z)).toVar(), end = min(min(mx.x, mx.y), mx.z).toVar();
    Discard(start.greaterThanEqual(end));
    const stepSize = end.sub(start).div(float(uniforms.uSteps)).toVar(), t = start.add(stepSize.mul(.35)).toVar();
    const result = vec4(0).toVar();
    Loop(96, ({ i }) => {
      If(i.greaterThanEqual(uniforms.uSteps).or(result.a.greaterThan(.97)), () => { Break(); });
      const p = ro.add(rd.mul(t)).toVar(), d = density(p).toVar();
      If(d.greaterThan(.005), () => {
        const lighting = float(1).toVar();
        if(lightCache)lighting.assign(lightCache.sample(p));else{
          const opticalDepth = float(0).toVar();
          Loop({ start: 1, end: uniforms.uShadowSteps.add(1), type: 'int', condition: '<' }, ({ i: j }) => { opticalDepth.addAssign(density(p.add(vec3(-.17, .19, .07).mul(float(j)))).mul(.23)); });
          lighting.assign(exp(opticalDepth.mul(-3.5)));
        }
        const silver = pow(max(0, rd.dot(normalize(vec3(-.6, .7, .25)))), 8);
        const col = mix(vec3(.009, .026, .052), vec3(.075, .18, .27), lighting).add(vec3(.025, .08, .14).mul(silver).mul(lighting)).add(uniforms.uFlash.mul(vec3(.44, .60, .75)).mul(lighting));
        const alpha = float(1).sub(exp(d.mul(stepSize).mul(-2.2))).toVar();
        result.rgb.addAssign(float(1).sub(result.a).mul(alpha).mul(col)); result.a.addAssign(float(1).sub(result.a).mul(alpha));
      });
      t.addAssign(stepSize);
    });
    Discard(result.a.lessThan(.008));
    return vec4(result.rgb.div(max(result.a, .001)), result.a.mul(.92));
  })();
  const clouds = new THREE.Mesh(new THREE.BoxGeometry(9.2, 2.15, 4.88), cloudMaterial);
  clouds.position.set(-.15, 4.855, 0); clouds.name = 'contained clouds'; clouds.renderOrder = 3;
  const random = seededRandom(843), count = 700, positions = new Float32Array(count * 6), seeds = new Float32Array(count * 2), ends = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = -4.2 + random() * 8, z = (random() - .5) * 4.25, y = 2.6 + random() * 3, seed = random();
    for (let j = 0; j < 2; j++) { positions.set([x, y, z], i * 6 + j * 3); seeds[i * 2 + j] = seed; ends[i * 2 + j] = j; }
  }
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  rainGeometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1)); rainGeometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  const seed = attribute('seed', 'float'), endNode = attribute('aEnd', 'float');
  const rainPosition = Fn(() => {
    const p = positionGeometry.toVar();
    p.y.assign(mod(positionGeometry.y.sub(2.64).sub(uniforms.uTime.mul(uniforms.uStorm.mul(1.5).add(1.6))), 3).add(2.64).sub(endNode.mul(.095)));
    p.x.addAssign(sin(uniforms.uTime.mul(.4).add(seed.mul(6.28))).mul(.045).sub(endNode.mul(.020)));
    return p;
  })();
  const rainMaterial = new THREE.LineBasicNodeMaterial(); rainMaterial.transparent = true; rainMaterial.depthWrite = false; rainMaterial.positionNode = rainPosition;
  const alpha = varying(uniforms.uStorm.mul(.042).add(.009).mul(smoothstep(2.7, 3.1, rainPosition.y)), 'rain_alpha');
  rainMaterial.colorNode = Fn(() => {
    const world = positionWorld.toVar(); Discard(bottle.inside(world, float(.23)).not().or(world.y.lessThan(2.64)));
    const p = uniforms.uShipInverse.mul(vec4(world, 1)).xyz.toVar(), beam = hullWidthNode(p.x), roof = p.x.lessThan(-.76).select(.71, .50);
    Discard(p.x.greaterThan(-1.52).and(p.x.lessThan(1.62)).and(p.z.abs().lessThan(beam.add(.018))).and(p.y.lessThan(roof)).and(p.y.greaterThan(-.53)));
    return vec4(.30, .52, .69, alpha);
  })();
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial); rain.name = 'contained rain'; rain.renderOrder = 4;
  const lightning = new THREE.Group(); lightning.name = 'contained lightning'; lightning.visible = false; lightning.renderOrder = 5;
  const lightningMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.7, 4.4, 5.5), toneMapped: false });
  let strikeTime = -99;
  const flashLight = new THREE.PointLight('#b9e7ff', 0, 11, 1.8); flashLight.position.set(-2.3, 4.9, .2);
  function strike(time) {
    while (lightning.children.length) { const child = lightning.children[0]; child.geometry.dispose(); child.removeFromParent(); }
    const x = random() > .5 ? -2.8 : 2.5, z = (random() - .5) * 1.4, points = [];
    for (let i = 0; i < 11; i++) points.push(new THREE.Vector3(x + (random() - .5) * .40, 5.55 - i * .245, z + (random() - .5) * .22));
    const add = (pts, radius) => { const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, radius, 5, false), lightningMaterial); mesh.name = 'lightning branch'; lightning.add(mesh); };
    add(points, .014); for (const i of [3, 6]) { const p = points[i]; add([p, p.clone().add(new THREE.Vector3(.26, -.17, .08)), p.clone().add(new THREE.Vector3(.48, -.39, .13))], .006); }
    strikeTime = time; lightning.visible = true; flashLight.position.set(x, 4.8, z);
  }
  function update(time, storm, flashTime = time) {
    uniforms.uTime.value = time; uniforms.uStorm.value = storm; const age = flashTime - strikeTime;
    const flash = age < 0 ? 0 : age < .6 ? Math.exp(-age * 12) + .75 * Math.exp(-Math.pow((age - .14) * 35, 2)) : 0;
    uniforms.uFlash.value = flash; flashLight.intensity = flash * 45; lightning.visible = age >= 0 && age < .28; return flash;
  }
  return { clouds, rain, lightning, flashLight, uniforms, strike, update, updateLighting(renderer,paused){if(clouds.visible)lightCache?.update(renderer,paused);}, auditLighting(renderer){return lightCache?.audit(renderer)??Promise.resolve(null);} };
}
