// Reference optics shared with the TSL caustics implementation and unit tests.
export const WATER_IOR = 1.333;
export const CAUSTIC_DEPTH_START = .18;
export const CAUSTIC_DEPTH_STEP = .22;
export const CAUSTIC_LAYERS = 8;
export const CAUSTIC_EXTENT = [9.7, 5.1];
export const CAUSTIC_CELL = [384, 192];
export const WATER_EXTINCTION = [2.05, .64, .28];

export function refractIntoWater(incident, normal) {
  const eta = 1 / WATER_IOR;
  const d = incident.reduce((sum, v, i) => sum + v * normal[i], 0);
  const k = 1 - eta * eta * (1 - d * d);
  if (k < 0) return [0, 0, 0];
  return incident.map((v, i) => eta * v - (eta * d + Math.sqrt(k)) * normal[i]);
}

export function projectLightToPlane(origin, direction, planeY) {
  if (direction[1] >= -1e-6 || planeY >= origin[1]) return null;
  const t = (planeY - origin[1]) / direction[1];
  return origin.map((v, i) => v + direction[i] * t);
}

export function differentialFlux(sourceDx, sourceDy, targetDx, targetDy, cosine, transmission = 1) {
  const cross = [sourceDx[1]*sourceDy[2]-sourceDx[2]*sourceDy[1], sourceDx[2]*sourceDy[0]-sourceDx[0]*sourceDy[2], sourceDx[0]*sourceDy[1]-sourceDx[1]*sourceDy[0]];
  const sourceArea = Math.hypot(...cross);
  const targetArea = Math.abs(targetDx[0]*targetDy[2]-targetDx[2]*targetDy[0]);
  // A finite emitter/pixel footprint prevents an ideal mathematical singularity.
  return sourceArea * Math.max(0, cosine) * transmission / Math.max(sourceArea / 24, targetArea, 1e-8);
}

export function attenuateWater(distance) {
  return WATER_EXTINCTION.map(sigma => Math.exp(-sigma * Math.max(0, distance)));
}
