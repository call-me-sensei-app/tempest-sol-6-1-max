// Shared, deterministic CPU/GPU wave contract. Distances are miniature-scene units.
export const WATER_LEVEL = 2.58;
export const BOTTLE_CENTER_Y = 3.48;
export const METERS_PER_UNIT = 10;
export const GRAVITY = 9.81 / METERS_PER_UNIT;
export const WATER_DEPTH = 1.45;
export const CHOPPINESS = 0.28; // Below the folding limit of this normalized spectrum.
const waveRandom = seededRandom(1937);
// A ~55 m dominant swell, plus progressively shorter wind seas. Previously the
// 18 m peak produced closely packed rounded humps rather than ocean-scale swell.
const frequencies = [.50, .70, .95, 1.25, 1.60, 2.10, 2.80, 3.80, 5.20, 7.20, 10.0, 14.0, 20.0, 28.4];
const weights = frequencies.map(k => {
  const peak = 1.15;
  const sigma = k < peak ? .18 : .32;
  const enhancement = 2.8 ** Math.exp(-(((Math.sqrt(k/peak)-1)/sigma) ** 2) / 2);
  return Math.sqrt(k ** -2.4 * Math.exp(-1.25 * (peak/k) ** 2) * enhancement);
});
const weightSum = weights.reduce((a,b) => a+b, 0);
export const WAVES = frequencies.map((k,i) => {
  const angle = .26 + (waveRandom()-.5)*1.25 + (i%4===3?1.1:0);
  // Linear gravity-wave dispersion in finite depth: omega^2 = g k tanh(k h).
  const omega = Math.sqrt(GRAVITY * k * Math.tanh(k * WATER_DEPTH));
  return [Math.cos(angle), Math.sin(angle), k, omega, weights[i]/weightSum*.39, waveRandom()*Math.PI*2];
});
export function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
let optimizedPhysics=false,oceanSampler=null;
export function setOceanSampler(sampler){oceanSampler=sampler;}
export function setPhysicsOptimization(enabled){optimizedPhysics=enabled;}
export function waveHeight(x, z, time, storm) {
  if(oceanSampler)return oceanSampler(x,z,time,storm,optimizedPhysics);
  if(optimizedPhysics){
    const energy=.24+clamp(storm,0,1)*1.12;let px=x,pz=z;
    for(let iteration=0;iteration<3;iteration++){let hx=0,hz=0;for(let i=0;i<WAVES.length;i++){const w=WAVES[i],phase=w[2]*(w[0]*px+w[1]*pz)-time*w[3]+w[5],offset=CHOPPINESS*w[4]*energy*Math.cos(phase);hx+=offset*w[0];hz+=offset*w[1];}px=x-hx;pz=z-hz;}
    let height=0;for(let i=0;i<WAVES.length;i++){const w=WAVES[i],phase=w[2]*(w[0]*px+w[1]*pz)-time*w[3]+w[5],a=w[4]*energy;height+=a*Math.sin(phase)-.5*w[2]*a*a*Math.cos(phase*2);}return WATER_LEVEL+height;
  }
  // Invert horizontal Gerstner displacement so buoyancy queries WORLD coordinates,
  // not undisplaced grid coordinates. The GLSL volume sampler uses the same inversion.
  let px=x,pz=z;
  for(let iteration=0;iteration<3;iteration++) { const d=waveDisplacement(px,pz,time,storm);px=x-d.x;pz=z-d.z; }
  return WATER_LEVEL + waveDisplacement(px,pz,time,storm).y;
}
export function waveDisplacement(x, z, time, storm) {
  const energy = 0.24 + clamp(storm, 0, 1) * 1.12;
  let height = 0,hx=0,hz=0;
  for (const [dx, dz, k, speed, amplitude, offset] of WAVES) {
    const phase = k * (dx * x + dz * z) - time * speed + offset;
    const a=amplitude*energy;
    // Second-order Stokes correction: sharper positive crests, broader troughs.
    height += a*Math.sin(phase)-0.5*k*a*a*Math.cos(phase*2);
    hx += CHOPPINESS * amplitude * energy * dx * Math.cos(phase);
    hz += CHOPPINESS * amplitude * energy * dz * Math.cos(phase);
  }
  return {x:hx,y:height,z:hz};
}
export function hullHalfWidth(x) {
  const t = clamp((x + 1.5) / 3.1, 0, 1);
  return 0.46 * Math.pow(Math.sin(Math.PI * t), 0.62) * (0.87 + 0.13 * t) + 0.24 * (1-t) ** 12;
}
export function insideHull(x, z, shipX, shipZ, heading, padding = 0.02) {
  const dx = x - shipX, dz = z - shipZ;
  const along = Math.cos(heading) * dx + Math.sin(heading) * dz;
  const across = -Math.sin(heading) * dx + Math.cos(heading) * dz;
  return along > -1.5 && along < 1.6 && Math.abs(across) < hullHalfWidth(along) + padding;
}
export function seededRandom(seed = 7331) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
export function advanceVessel(vessel, dt, steering, storm) {
  dt = clamp(dt, 0, 0.04);
  vessel.rudder += (clamp(steering, -1, 1) - vessel.rudder) * (1 - Math.exp(-dt * 4));
  const limitX = 1.85, limitZ = 1.04;
  const boundary = (vessel.x / limitX) ** 2 + (vessel.z / limitZ) ** 2;
  let turn = vessel.rudder * 0.54;
  if (boundary > 0.7) {
    const inward = Math.atan2(-vessel.z, -vessel.x);
    const diff = Math.atan2(Math.sin(inward - vessel.heading), Math.cos(inward - vessel.heading));
    turn += clamp(diff, -1, 1) * Math.max(0, boundary - 0.7) * 2.3;
  }
  vessel.heading += turn * dt;
  const speed = 0.12 + clamp(storm, 0, 1) * 0.04;
  vessel.x += Math.cos(vessel.heading) * speed * dt;
  vessel.z += Math.sin(vessel.heading) * speed * dt;
  // Hard containment is a safety net, not the normal steering behavior.
  const q = (vessel.x / limitX) ** 2 + (vessel.z / limitZ) ** 2;
  if (q > 1) { vessel.x /= Math.sqrt(q); vessel.z /= Math.sqrt(q); }
  return vessel;
}
