// Shared, backend-neutral Three.js Shading Language. No shader strings.
import { Fn, If, Loop, float, vec2, vec3, vec4, positionWorld, texture, uniform, normalize, cross, max, sin, cos, pow, clamp, fract } from 'three/tsl';
import { SPECTRUM_SIZE, SPECTRUM_LENGTH, SPECTRAL_CHOP, WIND } from './spectrum.js';

export function createBottleNodes(profile) {
  const radius = Fn(([x]) => {
    const r = float(0).toVar();
    If(x.greaterThanEqual(-4.8).and(x.lessThanEqual(5.8)), () => {
      r.assign(profile.sample(vec2(x.add(4.8).div(10.6), .5)).level(0).r);
    });
    return r;
  });
  const inside = Fn(([p, inset]) => {
    const r = max(0, radius(p.x).sub(inset));
    const yz = vec2(p.y.sub(3.48), p.z);
    return yz.dot(yz).lessThan(r.mul(r));
  });
  return { radius, inside };
}

export function createWaveNodes(field, storm) {
  const offset = Fn(([p]) => {
    const f = field.sample(fract(p.div(SPECTRUM_LENGTH).add(.5 + .5 / SPECTRUM_SIZE))).level(0).toVar();
    return vec3(f.b.mul(WIND[0] * SPECTRAL_CHOP), f.r, f.b.mul(WIND[1] * SPECTRAL_CHOP)).mul(storm.mul(1.12).add(.24));
  });
  const height = Fn(([p]) => {
    const source = vec2(p).toVar();
    Loop(3, () => { source.assign(p.sub(offset(source).xz)); });
    return offset(source).y;
  });
  const epsilon = SPECTRUM_LENGTH / SPECTRUM_SIZE;
  const normal = Fn(([p]) => {
    const x = vec3(2 * epsilon, 0, 0).add(offset(p.add(vec2(epsilon, 0)))).sub(offset(p.sub(vec2(epsilon, 0))));
    const z = vec3(0, 0, 2 * epsilon).add(offset(p.add(vec2(0, epsilon)))).sub(offset(p.sub(vec2(0, epsilon))));
    return normalize(cross(z, x));
  });
  const compression = Fn(([p]) => {
    const dx = offset(p.add(vec2(epsilon, 0))).xz.sub(offset(p.sub(vec2(epsilon, 0))).xz).div(2 * epsilon).toVar();
    const dz = offset(p.add(vec2(0, epsilon))).xz.sub(offset(p.sub(vec2(0, epsilon))).xz).div(2 * epsilon).toVar();
    return dx.x.add(1).mul(dz.y.add(1)).sub(dx.y.mul(dz.x));
  });
  return { offset, height, normal, compression };
}

export const hullWidthNode = Fn(([x]) => {
  const t = clamp(x.add(1.5).div(3.1), 0, 1).toVar();
  return pow(max(0, sin(t.mul(Math.PI))), .62).mul(.46).mul(t.mul(.13).add(.87)).add(pow(float(1).sub(t), 12).mul(.24));
});

export function createShipLocalNode(ship) {
  return Fn(([p]) => {
    const d = p.sub(ship.xy).toVar(), c = cos(ship.z), s = sin(ship.z);
    return vec2(c.mul(d.x).add(s.mul(d.y)), s.negate().mul(d.x).add(c.mul(d.y)));
  });
}

export const tissueAbsorption = Fn(([y]) => vec3(1.85, .50, .21).mul(max(0, float(2.58).sub(y))).negate().exp());

export function applyTissueAbsorption(material) {
  // Attenuate outgoing tissue radiance BEFORE underwater fog, matching the
  // former model while keeping the entire operation in the TSL graph.
  const setupOutput = material.setupOutput.bind(material);
  material.setupOutput = (builder, radiance) => setupOutput(builder, vec4(radiance.rgb.mul(tissueAbsorption(positionWorld.y)), radiance.a));
  return material;
}
