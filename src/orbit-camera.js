import { Vector3 } from 'three';

// An inset, convex camera volume. The back boundary includes the projecting
// bookcase, so the entire lens-to-bottle segment stays in front of the furniture.
// Derive this from authored geometry, not duplicated wall/shelf coordinates.
export function roomOrbitBounds(leftWall, rightWall, backWall, bookcase, tabletop, clearance = .24) {
  return {
    minX: leftWall.max.x + clearance,
    maxX: rightWall.min.x - clearance,
    minY: tabletop.max.y + clearance,
    maxY: Infinity,
    minZ: Math.max(backWall.max.z, bookcase.max.z) + clearance,
    maxZ: Infinity
  };
}

export function insideOrbitBounds(point, bounds, epsilon = 1e-8) {
  return point.x >= bounds.minX - epsilon && point.x <= bounds.maxX + epsilon
    && point.y >= bounds.minY - epsilon && point.y <= bounds.maxY + epsilon
    && point.z >= bounds.minZ - epsilon && point.z <= bounds.maxZ + epsilon;
}

// Intersect the boom from the orbit target to the requested eye with six inset
// planes. No scene traversal, triangle raycasts, allocations or shader changes.
export function safeOrbitDistance(position, target, bounds) {
  const x = position.x - target.x, y = position.y - target.y, z = position.z - target.z;
  let fraction = 1;
  if (x > 0) fraction = Math.min(fraction, (bounds.maxX - target.x) / x);
  else if (x < 0) fraction = Math.min(fraction, (bounds.minX - target.x) / x);
  if (y > 0) fraction = Math.min(fraction, (bounds.maxY - target.y) / y);
  else if (y < 0) fraction = Math.min(fraction, (bounds.minY - target.y) / y);
  if (z > 0) fraction = Math.min(fraction, (bounds.maxZ - target.z) / z);
  else if (z < 0) fraction = Math.min(fraction, (bounds.minZ - target.z) / z);
  return Math.hypot(x, y, z) * Math.max(0, Math.min(1, fraction));
}

export function attachRoomOrbitGuard(controls, bounds) {
  const camera = controls.object, nativeUpdate = controls.update.bind(controls);
  const lastEye = new Vector3(), lastTarget = new Vector3(), offset = new Vector3();
  const fallbackTarget = controls.target.clone();
  let tracked = false, zoomFromActual = false, requestedDistance = 0, limited = false;
  const pointers = new Set();

  // At a collision stop, inward zoom must respond immediately rather than first
  // consuming the hidden, longer boom distance. Capture runs before OrbitControls.
  const wheel = () => { zoomFromActual = true; };
  const down = event => { pointers.add(event.pointerId); if (event.button === 1 || pointers.size > 1) zoomFromActual = true; };
  const move = event => { if ((event.buttons & 4) || event.pointerType === 'touch' && pointers.size > 1) zoomFromActual = true; };
  const up = event => { pointers.delete(event.pointerId); };
  const element = controls.domElement;
  element?.addEventListener('wheel', wheel, { capture: true, passive: true });
  element?.addEventListener('pointerdown', down, true);
  element?.addEventListener('pointermove', move, true);
  element?.addEventListener('pointerup', up, true);
  element?.addEventListener('pointercancel', up, true);

  controls.update = function(deltaTime) {
    const active = controls.enabled;
    if (active && !insideOrbitBounds(controls.target, bounds)) controls.target.copy(fallbackTarget);
    if (active && tracked && !zoomFromActual
      && camera.position.distanceToSquared(lastEye) < 1e-10
      && controls.target.distanceToSquared(lastTarget) < 1e-10) {
      // Restore intent only for controls-driven changes. Manual reset/restore,
      // tour exit and compartment transitions establish their own new pose.
      offset.copy(camera.position).sub(controls.target);
      const radius = offset.length();
      if (radius > 1e-8) camera.position.copy(controls.target).addScaledVector(offset, requestedDistance / radius);
    }
    const changed = nativeUpdate(deltaTime);
    zoomFromActual = false;
    if (!active) { tracked = false; limited = false; return changed; }
    offset.copy(camera.position).sub(controls.target);
    requestedDistance = offset.length();
    const safeDistance = safeOrbitDistance(camera.position, controls.target, bounds);
    limited = safeDistance < requestedDistance - 1e-8;
    if (limited && requestedDistance > 1e-8) {
      camera.position.copy(controls.target).addScaledVector(offset, safeDistance / requestedDistance);
      camera.lookAt(controls.target);
    }
    lastEye.copy(camera.position); lastTarget.copy(controls.target); tracked = true;
    return changed || limited;
  };
  controls.update();
  return {
    bounds,
    get requestedDistance() { return requestedDistance; },
    get limited() { return controls.enabled && limited; },
    restoreRequestedDistance(radius) {
      if (!Number.isFinite(radius) || radius <= 0) return;
      requestedDistance = Math.max(controls.minDistance, Math.min(controls.maxDistance, radius));
      lastEye.copy(camera.position); lastTarget.copy(controls.target); tracked = controls.enabled;
    },
    // Also makes the dolly-at-wall behavior independently testable.
    useActualDistanceForZoom: wheel,
    dispose() {
      controls.update = nativeUpdate;
      element?.removeEventListener('wheel', wheel, true);
      element?.removeEventListener('pointerdown', down, true);
      element?.removeEventListener('pointermove', move, true);
      element?.removeEventListener('pointerup', up, true);
      element?.removeEventListener('pointercancel', up, true);
    }
  };
}
