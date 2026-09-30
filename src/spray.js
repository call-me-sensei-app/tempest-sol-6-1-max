import * as THREE from 'three/webgpu';
import { Fn, Discard, attribute, float, vec2, vec3, vec4, uniform, texture, varying, uv, modelViewMatrix, cameraProjectionMatrix, viewportSize, sin, cos, max, clamp, smoothstep, exp } from 'three/tsl';
import { createBottleNodes } from './shading.js';

// WebGPU point primitives cannot have variable gl_PointSize. Instanced
// camera-facing quads preserve the same soft spray footprint on BOTH backends.
export function createSpray(seeds, count, profile) {
  const uAge = uniform(100), uOrigin = uniform(new THREE.Vector3()), uScale = uniform(innerHeight);
  const uniforms = { uAge, uOrigin, uScale };
  const seed = attribute('seed', 'vec4'), born = seed.x.mul(.60), age = max(0, uAge.sub(born));
  const life = seed.y.mul(.65).add(.85), a = age.div(life), angle = seed.z.mul(6.283185);
  const width = age.mul(.11).add(.015).mul(seed.w);
  const center = uOrigin.add(vec3(cos(angle).mul(width), age.mul(seed.y.mul(.7).add(.75)).sub(age.mul(age).mul(.36)), sin(angle).mul(width)));
  const world = varying(center, 'spray_center');
  const alpha = varying(uAge.greaterThanEqual(born).and(a.lessThan(1)).select(float(1).sub(a).mul(smoothstep(0, .13, age)).mul(.32), 0), 'spray_alpha');
  const geometry = new THREE.InstancedBufferGeometry(), plane = new THREE.PlaneGeometry(1, 1);
  geometry.index = plane.index; for (const [name, attr] of Object.entries(plane.attributes)) geometry.setAttribute(name, attr);
  geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 4)); geometry.instanceCount = count;
  const material = new THREE.SpriteNodeMaterial(); material.transparent = true; material.depthWrite = false;
  material.positionNode = center;
  const z = max(.03, modelViewMatrix.mul(vec4(center, 1)).z.negate());
  const pixels = clamp(age.mul(.055).add(.009).mul(uScale).div(z), 1, 65);
  material.scaleNode = pixels.mul(z).mul(2).div(viewportSize.y.mul(cameraProjectionMatrix.element(1).y));
  const bottle = createBottleNodes(texture(profile));
  material.colorNode = Fn(() => {
    Discard(bottle.inside(world, float(.11)).not());
    const p = uv().sub(.5), d = p.dot(p);
    Discard(d.greaterThan(.25).or(alpha.lessThan(.001)));
    const cloud = exp(d.mul(-17)).mul(float(1).sub(smoothstep(.13, .25, d)));
    return vec4(.65, .82, .88, alpha.mul(cloud));
  })();
  const plume = new THREE.Mesh(geometry, material); plume.name = 'moist exhalation and fine spray';
  plume.frustumCulled = false; plume.renderOrder = 6; plume.visible = false;
  return { plume, uniforms };
}
