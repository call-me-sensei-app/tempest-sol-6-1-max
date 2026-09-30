// Conservative rostrum clearance; not a full whale/ship rigid-body solver.
export function rostrumCanSurface(x,z,vessel){
  const dx=x-vessel.x,dz=z-vessel.z,c=Math.cos(vessel.heading),s=Math.sin(vessel.heading);
  return Math.abs(c*dx+s*dz)>1.75||Math.abs(-s*dx+c*dz)>.65;
}
