import * as THREE from 'three/webgpu';
import { Fn, If, Discard, float, vec2, vec3, vec4, uniform, texture, cubeTexture, varying, positionGeometry, positionWorld, positionView, normalWorldGeometry, cameraPosition, screenUV, uv, normalize, dot, reflect, pow, max, mix, clamp, abs, smoothstep, exp, sin, cos, reflector, viewportSharedTexture, perspectiveDepthToViewZ, mrt, output } from 'three/tsl';
import { WATER_LEVEL, BOTTLE_CENTER_Y, seededRandom } from './simulation.js';
import { SHARED_CAPTURE } from './benchmark';
import { createSpectralOcean } from './spectral-ocean.js';
import { createWaveNodes, createBottleNodes, createShipLocalNode, hullWidthNode } from './shading.js';
import { createWaveCaustics } from './caustics.js';

export const BOTTLE_POINTS=[[-4.8,0],[-4.65,1.2],[-4.15,2.05],[-3.4,2.44],[2.7,2.44],[3.5,2.25],[4.15,1.6],[4.55,.86],[5.65,.86],[5.8,.94]].map(([x,r])=>new THREE.Vector2(r,x));
const profileSamples=new THREE.SplineCurve(BOTTLE_POINTS).getPoints(512);
const profileData=new Uint16Array(1024);
for(let i=0;i<1024;i++){const x=-4.8+i/1023*10.6;let r=0;for(let j=1;j<profileSamples.length;j++){const a=profileSamples[j-1],b=profileSamples[j];if(x>=a.y&&x<=b.y){r=THREE.MathUtils.lerp(a.x,b.x,(x-a.y)/Math.max(.00001,b.y-a.y));break;}}profileData[i]=THREE.DataUtils.toHalfFloat(r);}
export const BOTTLE_PROFILE_TEXTURE=new THREE.DataTexture(profileData,1024,1,THREE.RedFormat,THREE.HalfFloatType);BOTTLE_PROFILE_TEXTURE.minFilter=BOTTLE_PROFILE_TEXTURE.magFilter=THREE.LinearFilter;BOTTLE_PROFILE_TEXTURE.needsUpdate=true;


export function createOcean(bottleGeometry, environment) {
  // Periodic coherent noise for sub-mesh wind ripples and foam: texture filtering
  // avoids dozens of fragment-stage sine hashes, without coarse surface geometry.
  const noiseSize=256,noiseData=new Uint8Array(noiseSize*noiseSize),random=seededRandom(9321),grids=[16,32,64].map(n=>({n,data:Float32Array.from({length:n*n},()=>random())}));
  for(let y=0;y<noiseSize;y++)for(let x=0;x<noiseSize;x++){let sum=0;for(let octave=0;octave<grids.length;octave++){const {n,data}=grids[octave],px=x/noiseSize*n,py=y/noiseSize*n,ix=Math.floor(px),iy=Math.floor(py),sx=px-ix,sy=py-iy,fx=sx*sx*(3-2*sx),fy=sy*sy*(3-2*sy),a=data[iy*n+ix],b=data[iy*n+(ix+1)%n],c=data[((iy+1)%n)*n+ix],d=data[((iy+1)%n)*n+(ix+1)%n];sum+=((a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy)*[.6,.28,.12][octave];}noiseData[y*noiseSize+x]=sum*255;}
  const windNoise=new THREE.DataTexture(noiseData,noiseSize,noiseSize,THREE.RedFormat);windNoise.wrapS=windNoise.wrapT=THREE.RepeatWrapping;windNoise.minFilter=windNoise.magFilter=THREE.LinearFilter;windNoise.needsUpdate=true;
  const spectrum = createSpectralOcean();
  let refraction = new THREE.RenderTarget(800, 450, { type: THREE.HalfFloatType, depthBuffer: true });
  refraction.depthTexture = new THREE.DepthTexture(800, 450, THREE.UnsignedIntType);
  const foamTargets = [0, 1].map(() => new THREE.RenderTarget(256, 128, { type: THREE.HalfFloatType, depthBuffer: false }));
  let foamIndex = 0;
  const mirror = new THREE.Object3D(); mirror.name = 'TSL planar reflection plane';
  mirror.rotation.x = -Math.PI / 2; mirror.position.y = WATER_LEVEL;
  const reflection = reflector({ target: mirror, samples: 0, bounces: false });
  // Match the established 640² optical capture, not a reduced quality preset.
  reflection.reflector._updateResolution = target => target.setSize(640, 640);
  const uniforms = {
    uTime: uniform(0), uStorm: uniform(.65), uShip: uniform(new THREE.Vector3()),
    uWhale: uniform(new THREE.Vector4(0, 0, 0, 100)), uFlash: uniform(0),
    uEnvironment: cubeTexture(environment), uReflectionEnabled: uniform(1),
    uRefraction: texture(refraction.texture), uDepth: texture(refraction.depthTexture),
    uNearFar: uniform(new THREE.Vector2(.006, 100)), uBottleProfile: texture(BOTTLE_PROFILE_TEXTURE),
    uFoamState: texture(foamTargets[0].texture), uWindNoise: texture(windNoise),
    uWaveField: texture(spectrum.texture), uReuseCapture: uniform(0)
  };
  const waves = createWaveNodes(uniforms.uWaveField, uniforms.uStorm);
  const bottle = createBottleNodes(uniforms.uBottleProfile), shipLocal = createShipLocalNode(uniforms.uShip);
  const caustics = createWaveCaustics(waves, bottle, shipLocal, uniforms);
  const previous = texture(foamTargets[0].texture), delta = uniform(1 / 60);
  const foamMaterial = new THREE.NodeMaterial(); foamMaterial.depthTest = foamMaterial.depthWrite = false;
  foamMaterial.fragmentNode = Fn(() => {
    // Simulation texture convention is top-left on both rendering backends.
    const q = screenUV, p = q.sub(.5).mul(vec2(9.7, 5.1)).toVar();
    const n = waves.normal(p).toVar(), h = waves.offset(p).y;
    const source = float(1).sub(smoothstep(.22, .48, waves.compression(p))).mul(smoothstep(.16, .34, h)).mul(uniforms.uStorm.pow(2));
    const drift = vec2(.10, .025).mul(uniforms.uStorm.mul(.8).add(.2)).add(n.xz.mul(.045));
    const history = previous.sample(clamp(q.sub(drift.mul(delta).div(vec2(9.7, 5.1))), 0, 1)).level(0).r;
    const foam = history.mul(exp(delta.mul(-.55))).add(source.mul(delta).mul(.19));
    return vec4(clamp(foam, 0, .45), 0, 0, 1);
  })();
  const foamQuad = new THREE.QuadMesh(foamMaterial); foamQuad.camera = foamQuad.camera.clone();
  const material = new THREE.NodeMaterial(); material.side = THREE.DoubleSide;
  material.name = 'TSL multi-scale FFT ocean';
  const waveNormal = varying(waves.normal(positionGeometry.xz), 'fft_surface_normal');
  const waveHeight = varying(waves.offset(positionGeometry.xz).y, 'fft_surface_height');
  material.positionNode = Fn(() => positionGeometry.add(waves.offset(positionGeometry.xz)).add(vec3(0, WATER_LEVEL, 0)))();
  const noise = Fn(([p]) => uniforms.uWindNoise.sample(p.div(16)).level(0).r);
  material.normalNode = Fn(() => {
    const fine = positionWorld.xz.mul(vec2(43,82)).sub(vec2(uniforms.uTime.mul(1.1),uniforms.uTime.mul(.28)));
    const slope = waveNormal.xz.negate().div(max(.1,waveNormal.y)).add(vec2(noise(fine).sub(noise(fine.add(vec2(.25,0)))),noise(fine).sub(noise(fine.add(vec2(0,.25))))).mul(uniforms.uStorm.mul(.44).add(.22)));
    return normalize(vec3(slope.x.negate(),1,slope.y.negate()));
  })();
  material.colorNode = Fn(() => {
    const world = positionWorld.toVar(), storm = uniforms.uStorm, time = uniforms.uTime;
    Discard(bottle.inside(world, float(.045)).not());
    const boat = shipLocal(world.xz).toVar();
    Discard(boat.x.greaterThan(-1.5).and(boat.x.lessThan(1.6)).and(abs(boat.y).lessThan(hullWidthNode(boat.x).add(.016))));
    const slope = waveNormal.xz.negate().div(max(.1, waveNormal.y)).toVar();
    const fine = world.xz.mul(vec2(43, 82)).sub(vec2(time.mul(1.1), time.mul(.28))).toVar();
    slope.addAssign(vec2(noise(fine).sub(noise(fine.add(vec2(.25, 0)))), noise(fine).sub(noise(fine.add(vec2(0, .25))))).mul(storm.mul(.44).add(.22)));
    const n = normalize(vec3(slope.x.negate(), 1, slope.y.negate())).toVar();
    const view = normalize(cameraPosition.sub(world)).toVar();
    If(dot(view, n).lessThan(0), () => { n.assign(n.negate()); });
    const ndv = max(dot(n, view), 0).toVar(), fresnel = pow(float(1).sub(ndv), 5).mul(.98).add(.02);
    const reflected = uniforms.uEnvironment.sample(reflect(view.negate(), n)).toVar();
    If(uniforms.uReflectionEnabled.greaterThan(.5), () => {
      reflected.rgb.assign(mix(reflected.rgb, reflection.sample(screenUV.flipX().add(n.xz.mul(.018))).rgb, .72));
    });
    reflected.rgb.addAssign(mix(vec3(.012, .060, .105), vec3(.008, .020, .032), storm).mul(n.y.mul(.4).add(.6)));
    const depth = max(0, waveHeight.add(.34));
    const water = mix(vec3(.001, .009, .016), mix(vec3(.008, .080, .12), vec3(.008, .034, .045), storm), clamp(depth.mul(.95), 0, 1)).toVar();
    const refractionUV = clamp(screenUV.add(n.xz.mul(.007)), .001, .999).toVar();
    const behind = perspectiveDepthToViewZ(uniforms.uDepth.sample(refractionUV).r, uniforms.uNearFar.x, uniforms.uNearFar.y).negate();
    const front = positionView.z.negate();
    const thickness = clamp(behind.sub(front), 0, 2.3).toVar(), absorption = exp(vec3(-2.05, -.64, -.28).mul(thickness));
    const captured = uniforms.uRefraction.sample(refractionUV).rgb.toVar();
    if (SHARED_CAPTURE) {
      If(uniforms.uReuseCapture.greaterThan(.5), () => { captured.assign(viewportSharedTexture(refractionUV).rgb); });
    }
    const through = captured.mul(absorption).add(vec3(.002, .026, .055).mul(vec3(1).sub(absorption)));
    water.assign(mix(water, through, .72)); water.addAssign(vec3(.003, .018, .028).mul(float(1).sub(n.y)));
    const light = normalize(vec3(-.5, .9, .35)), halfway = normalize(view.add(light));
    const ndl = max(0, dot(n, light)).toVar(), ndh = max(0, dot(n, halfway)).toVar(), vdh = max(0, dot(view, halfway)).toVar();
    const alpha = storm.mul(.025).add(.020).toVar(), a2 = alpha.mul(alpha).toVar();
    const D = a2.div(pow(ndh.mul(ndh).mul(a2.sub(1)).add(1), 2).mul(3.14159));
    const k = alpha.mul(.5), G = ndv.div(ndv.mul(float(1).sub(k)).add(k)).mul(ndl.div(ndl.mul(float(1).sub(k)).add(k)));
    const F = pow(float(1).sub(vdh), 5).mul(.9796).add(.0204);
    const spec = D.mul(G).mul(F).div(max(.015, ndv.mul(ndl).mul(4))).toVar();
    const color = mix(water, reflected.rgb, fresnel.mul(.85).add(.055)).add(spec.mul(ndl).mul(vec3(.19, .36, .48))).toVar();
    const foamDrift = world.xz.sub(vec2(.10, .025).mul(time));
    const foamNoise = noise(foamDrift.mul(32)).mul(.62).add(noise(foamDrift.mul(91)).mul(.38)).toVar();
    const crest = smoothstep(.070, .23, waveHeight.div(storm.mul(.8).add(.4))).toVar();
    const persisted = uniforms.uFoamState.sample(world.xz.div(vec2(9.7, 5.1)).add(.5)).level(0).r;
    const foam = max(persisted.mul(smoothstep(.46, .69, foamNoise)), crest.mul(smoothstep(.54, .70, foamNoise)).mul(storm.mul(.10).add(.015))).toVar();
    const distanceToHull = abs(boat.y).sub(hullWidthNode(boat.x));
    const bowFoam = exp(abs(distanceToHull).mul(-23)).mul(smoothstep(-1.6, -.8, boat.x)).mul(float(1).sub(smoothstep(1.6, 1.9, boat.x)));
    const wake = exp(pow(boat.y.div(max(0, boat.x.negate().sub(1.3)).mul(.16).add(.14)), 2).negate()).mul(smoothstep(-3.6, -1.7, boat.x)).mul(float(1).sub(smoothstep(-1.5, -1.25, boat.x)));
    const compression = smoothstep(.58, .86, slope.length());
    foam.assign(max(foam, compression.mul(crest).mul(smoothstep(.54, .72, foamNoise)).mul(.09)));
    foam.assign(max(foam, bowFoam.mul(.6).add(wake.mul(.4)).mul(foamNoise)));
    const whaleDistance = world.xz.sub(uniforms.uWhale.xy).length(), breathAge = uniforms.uWhale.w;
    const breathRing = exp(pow(whaleDistance.sub(breathAge.mul(.45)).div(.045), 2).negate()).mul(exp(breathAge.mul(-1.3))).mul(uniforms.uWhale.z);
    foam.assign(max(foam, breathRing.mul(.32).add(exp(whaleDistance.mul(-8)).mul(uniforms.uWhale.z).mul(foamNoise).mul(.33))));
    color.assign(mix(color, vec3(.56, .64, .66), clamp(foam.mul(.83), 0, 1)));
    color.addAssign(vec3(.003, .025, .036).mul(crest).mul(.12));
    color.addAssign(uniforms.uFlash.mul(vec3(.19, .34, .48).add(spec.mul(.7))));
    return vec4(color, 1);
  })();
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(9.7, 5.1, 256, 144).rotateX(-Math.PI / 2), material);
  surface.name = 'ocean surface'; surface.frustumCulled = false; surface.renderOrder = SHARED_CAPTURE ? 50 : 0;
  const volumeGeometry = bottleGeometry.clone().scale(1, .982, .982).translate(0, BOTTLE_CENTER_Y, 0);
  const volumeMaterial = new THREE.NodeMaterial(); volumeMaterial.side = THREE.FrontSide; volumeMaterial.transparent = true; volumeMaterial.depthWrite = false;
  volumeMaterial.name = 'TSL contained water absorption';
  volumeMaterial.colorNode = Fn(() => {
    const world = positionWorld.toVar();
    Discard(world.y.greaterThan(waves.height(world.xz).add(WATER_LEVEL)).or(world.x.greaterThan(4.4)));
    const h = clamp(world.y.sub(1.05).div(1.6), 0, 1);
    // This mesh is the wet, curved bottle boundary—not a volumetric light sprite.
    // Weak diffuse scattering at that boundary receives the projected wave flux.
    const wallLight = caustics.irradiance(world, normalWorldGeometry.negate()).mul(.095 / Math.PI);
    const color = mix(vec3(.002, .013, .025), vec3(.008, .105, .17), h).add(wallLight).add(uniforms.uFlash.mul(vec3(.015, .08, .13)));
    return vec4(color, .46);
  })();
  const volume = new THREE.Mesh(volumeGeometry, volumeMaterial); volume.name = 'contained water volume'; volume.renderOrder = 2;
  const updateReflection = reflection.reflector.updateBefore.bind(reflection.reflector);
  reflection.reflector.updateBefore = frame => {
    if (!mirror.visible) return false;
    const visible = volume.visible; volume.visible = false;
    try { return updateReflection(frame); } finally { volume.visible = visible; }
  };
  const depthMaterial = new THREE.NodeMaterial(); depthMaterial.side = THREE.DoubleSide; depthMaterial.fragmentNode = vec4(0, 0, 0, 1);
  return {
    surface, volume, mirror, uniforms, material, caustics, auditSpectrum: spectrum.audit,
    beginFrame(renderer, time, paused) { if (!paused) uniforms.uWaveField.value = spectrum.update(renderer, time); caustics.update(renderer, paused); },
    updateFoam(renderer, dt) {
      const old = renderer.getRenderTarget(), tone = renderer.toneMapping;
      renderer.toneMapping = THREE.NoToneMapping;
      const next = 1 - foamIndex; previous.value = foamTargets[foamIndex].texture; delta.value = Math.min(dt, .04);
      renderer.setRenderTarget(foamTargets[next]); foamQuad.render(renderer); renderer.setRenderTarget(old); renderer.toneMapping = tone;
      foamIndex = next; uniforms.uFoamState.value = foamTargets[next].texture;
    },
    resize(width, height) {
      const scale=Math.min(1,1000/width),w=Math.round(width*scale),h=Math.round(height*scale);
      if(refraction.width===w&&refraction.height===h)return;
      // r186 transmission snapshots can retain a destroyed GPU texture when
      // an existing capture changes size. A fresh target gives them a fresh
      // render-context key; quality and optical sampling remain identical.
      const old=refraction;refraction=new THREE.RenderTarget(w,h,{type:THREE.HalfFloatType,depthBuffer:true});
      refraction.depthTexture=new THREE.DepthTexture(w,h,THREE.UnsignedIntType);
      uniforms.uRefraction.value=refraction.texture;uniforms.uDepth.value=refraction.depthTexture;old.dispose();
    },
    renderRefraction(renderer, scene, camera, hide) {
      const x = camera.position.x, p = THREE.MathUtils.clamp((x + 4.8) / 10.6 * 1023, 0, 1023), i = Math.floor(p);
      const radius = THREE.MathUtils.lerp(THREE.DataUtils.fromHalfFloat(profileData[i]), THREE.DataUtils.fromHalfFloat(profileData[Math.min(1023, i + 1)]), p - i);
      const reuse = SHARED_CAPTURE && !(x >= -4.8 && x <= 5.8 && Math.hypot(camera.position.y - BOTTLE_CENTER_Y, camera.position.z) < radius + .08);
      uniforms.uReuseCapture.value = reuse ? 1 : 0;
      const extra = []; if (reuse) scene.traverse(o => { if ((o.isMesh || o.isPoints || o.isLineSegments) && !Array.isArray(o.material) && o.material.depthWrite === false && o.visible) extra.push(o); });
      const objects = [surface, volume, mirror, ...hide, ...extra], vis = objects.map(o => o.visible);
      const old = renderer.getRenderTarget(), auto = renderer.autoClear, override = scene.overrideMaterial;
      objects.forEach(o => o.visible = false); if (reuse) scene.overrideMaterial = depthMaterial;
      renderer.autoClear = true; renderer.setRenderTarget(refraction); renderer.clear(); renderer.render(scene, camera);
      scene.overrideMaterial = override; renderer.setRenderTarget(old); renderer.autoClear = auto; objects.forEach((o, index) => o.visible = vis[index]);
      uniforms.uNearFar.value.set(camera.near, camera.far);
    },
    setQuality(high) {
      const old = surface.geometry;
      surface.geometry = new THREE.PlaneGeometry(9.7, 5.1, high ? 256 : 160, high ? 144 : 96).rotateX(-Math.PI / 2); old.dispose();
      mirror.visible = high; uniforms.uReflectionEnabled.value = high ? 1 : 0;
    },
    setOptics(cinematic) {
      material.mrtNode = cinematic ? mrt({ output, surface: vec4(0, uniforms.uStorm.mul(.025).add(.020), 0, 1) }) : null;
      material.needsUpdate = true;
    }
  };
}
