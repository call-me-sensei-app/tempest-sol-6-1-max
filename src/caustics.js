import * as THREE from 'three/webgpu';
import { Fn, If, Discard, float, vec2, vec3, vec4, uniform, texture, attribute, varying, positionGeometry, positionWorld, normalWorld, normalize, refract, cross, dot, dFdx, dFdy, min, max, abs, floor, mod, clamp, mix, smoothstep, pow, exp, screenUV } from 'three/tsl';
import { WATER_LEVEL } from './simulation.js';
import { hullWidthNode } from './shading.js';
import { WATER_IOR, CAUSTIC_DEPTH_START, CAUSTIC_DEPTH_STEP, CAUSTIC_LAYERS, CAUSTIC_EXTENT, CAUSTIC_CELL, WATER_EXTINCTION } from './caustics-math.js';
import { createFrameTimer } from './frame-timer.js';

// Differential-area photon projection, following the technique described by
// Evan Wallace: https://www.madebyevan.com/webgl-water/
// This is light transport from the LIVE FFT surface, not a scrolling light texture.
// Eight horizontal receiver slices approximate the 3-D irradiance field. It is
// not full multi-bounce path tracing or refraction through the outer bottle glass.
export function createWaveCaustics(waves, bottle, shipLocal, uniforms) {
  const params = new URLSearchParams(location.search);
  const enabled = params.get('caustics') !== '0', flatTest = params.get('causticTest') === 'flat';
  const [cx, cy] = CAUSTIC_CELL, width = cx * 4, height = cy * 2;
  const options = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const photons = new THREE.RenderTarget(width, height, options);
  const filtered = new THREE.RenderTarget(width, height, options);
  const lightDirection = uniform(new THREE.Vector3(-7, 8, 4).normalize());
  const incidentColor = uniform(new THREE.Color('#88b9df').multiplyScalar(2));
  const strength = uniform(enabled ? 1 : 0);
  const flatRay = refract(lightDirection.negate(), vec3(0, 1, 0), 1 / WATER_IOR);
  const atlas = texture(filtered.texture);
  const plane = attribute('causticPlane', 'float'), tile = attribute('causticTile', 'vec2');
  const source = positionGeometry.add(flatTest ? vec3(0) : waves.offset(positionGeometry.xz)).add(vec3(0, WATER_LEVEL, 0));
  const sourceNormal = flatTest ? vec3(0, 1, 0) : waves.normal(positionGeometry.xz);
  const ray = refract(lightDirection.negate(), sourceNormal, 1 / WATER_IOR);
  const hit = source.add(ray.mul(plane.sub(source.y).div(min(-.05, ray.y))));
  const sourceV = varying(source, 'caustic_source');
  const normalV = varying(sourceNormal, 'caustic_source_normal');
  const hitV = varying(hit, 'caustic_hit');
  const planeV = varying(plane, 'caustic_plane');
  const tileV = varying(tile, 'caustic_tile');

  const photonMaterial = new THREE.NodeMaterial();
  photonMaterial.name = 'TSL refracted FFT photon flux';
  photonMaterial.depthTest = photonMaterial.depthWrite = false;
  photonMaterial.side = THREE.DoubleSide;
  photonMaterial.transparent = true;
  photonMaterial.blending = THREE.AdditiveBlending;
  photonMaterial.vertexNode = Fn(() => {
    const q = hit.xz.div(vec2(...CAUSTIC_EXTENT)).add(.5);
    const atlasUV = q.add(tile).div(vec2(4, 2));
    // TSL texture coordinates are top-left on BOTH backends. Clip Y is up.
    return vec4(atlasUV.x.mul(2).sub(1), float(1).sub(atlasUV.y.mul(2)), .5, 1);
  })();
  photonMaterial.fragmentNode = Fn(() => {
    // Derivatives BEFORE divergent discards, including folded/overlapping rays.
    const sourceArea = cross(dFdx(sourceV), dFdy(sourceV)).length().toVar();
    const dx = dFdx(hitV).toVar(), dz = dFdy(hitV).toVar();
    const targetArea = abs(dx.x.mul(dz.z).sub(dx.z.mul(dz.x))).toVar();
    const q = hitV.xz.div(vec2(...CAUSTIC_EXTENT)).add(.5);
    const pixelTile = floor(screenUV.mul(vec2(4, 2)));
    Discard(q.x.lessThan(0).or(q.x.greaterThan(1)).or(q.y.lessThan(0)).or(q.y.greaterThan(1))
      .or(abs(pixelTile.sub(tileV)).length().greaterThan(.1))
      .or(sourceV.y.lessThanEqual(planeV)).or(bottle.inside(sourceV, float(.065)).not()));
    // The opaque waterline footprint blocks photons entering through the vessel.
    // Full underwater self-shadow/refraction is deliberately not claimed here.
    const local = shipLocal(sourceV.xz);
    Discard(local.x.greaterThan(-1.5).and(local.x.lessThan(1.6)).and(abs(local.y).lessThan(hullWidthNode(local.x).add(.02))));
    const cosine = max(0, dot(normalize(normalV), lightDirection)).toVar();
    const f0 = ((WATER_IOR - 1) / (WATER_IOR + 1)) ** 2;
    const transmission = float(1).sub(float(f0).add(pow(float(1).sub(cosine), 5).mul(1 - f0)));
    const flux = sourceArea.mul(cosine).mul(transmission).div(max(1e-8, max(sourceArea.div(24), targetArea)));
    return vec4(flux, 0, 0, 1);
  })();
  const base = new THREE.PlaneGeometry(...CAUSTIC_EXTENT, 128, 64).rotateX(-Math.PI / 2);
  const geometry = new THREE.InstancedBufferGeometry().copy(base);
  geometry.instanceCount = CAUSTIC_LAYERS; base.dispose();
  geometry.setAttribute('causticPlane', new THREE.InstancedBufferAttribute(Float32Array.from({length:CAUSTIC_LAYERS}, (_, i) => WATER_LEVEL - CAUSTIC_DEPTH_START - i * CAUSTIC_DEPTH_STEP), 1));
  geometry.setAttribute('causticTile', new THREE.InstancedBufferAttribute(Float32Array.from({length:CAUSTIC_LAYERS * 2}, (_, i) => i % 2 ? Math.floor(Math.floor(i / 2) / 4) : Math.floor(i / 2) % 4), 2));
  const mesh = new THREE.Mesh(geometry, photonMaterial); mesh.frustumCulled = false;
  const photonScene = new THREE.Scene(); photonScene.add(mesh);
  const photonCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const photonTexture = texture(photons.texture);
  const blurMaterial = new THREE.NodeMaterial();
  blurMaterial.name = 'TSL finite-footprint caustic filter';
  blurMaterial.depthTest = blurMaterial.depthWrite = false;
  blurMaterial.fragmentNode = Fn(() => {
    const cell = floor(screenUV.mul(vec2(4, 2))).toVar();
    const lo = cell.div(vec2(4, 2)).add(vec2(.5 / width, .5 / height));
    const hi = cell.add(1).div(vec2(4, 2)).sub(vec2(.5 / width, .5 / height));
    const distance = cell.y.mul(4).add(cell.x).mul(CAUSTIC_DEPTH_STEP).add(CAUSTIC_DEPTH_START);
    // Grow the footprint with propagation distance; never bleed adjacent slices.
    const radius = distance.mul(.42).add(.65), value = photonTexture.sample(screenUV).level(0).r.mul(.4).toVar();
    for (const [x, y] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      value.addAssign(photonTexture.sample(clamp(screenUV.add(vec2(x / width, y / height).mul(radius)), lo, hi)).level(0).r.mul(.15));
    }
    return vec4(value, 0, 0, 1);
  })();
  const blurQuad = new THREE.QuadMesh(blurMaterial); blurQuad.camera = blurQuad.camera.clone();

  const layerSample = Fn(([p, index]) => {
    const cell = vec2(mod(index, 4), floor(index.div(4)));
    const q = clamp(p.xz.div(vec2(...CAUSTIC_EXTENT)).add(.5), vec2(.5 / cx, .5 / cy), vec2(1 - .5 / cx, 1 - .5 / cy));
    return atlas.sample(q.add(cell).div(vec2(4, 2))).level(0).r;
  });
  const irradiance = Fn(([p, normal]) => {
    const result = vec3(0).toVar();
    If(strength.greaterThan(0).and(p.y.lessThan(WATER_LEVEL + .55)).and(bottle.inside(p, float(0))), () => {
      const depth = waves.height(p.xz).add(WATER_LEVEL).sub(p.y).toVar();
      If(depth.greaterThan(0), () => {
        const layer = clamp(float(WATER_LEVEL - CAUSTIC_DEPTH_START).sub(p.y).div(CAUSTIC_DEPTH_STEP), 0, CAUSTIC_LAYERS - 1).toVar();
        const lower = floor(layer).toVar();
        const flux = mix(layerSample(p, lower), layerSample(p, min(lower.add(1), CAUSTIC_LAYERS - 1)), layer.sub(lower));
        // Only light-facing submerged surfaces; no luminous dots in empty water.
        const facing = max(0, dot(normalize(normal), flatRay.negate())).div(max(.1, flatRay.y.negate()));
        const path = depth.div(max(.1, flatRay.y.negate()));
        const attenuation = exp(vec3(...WATER_EXTINCTION).mul(path).negate());
        const stormTransmission = mix(.42, .045, uniforms.uStorm.mul(uniforms.uStorm));
        const illumination = incidentColor.mul(stormTransmission).add(uniforms.uFlash.mul(vec3(.30, .50, .65)));
        result.assign(illumination.mul(attenuation).mul(flux).mul(facing).mul(smoothstep(0, .09, depth)).mul(strength));
      });
    });
    return result;
  });
  const installed = new WeakMap();
  function install(root, renderer, dryInterior = false) {
    root.traverse(object => {
      if (!object.isMesh) return;
      const convert = original => {
        if (!original.isMeshStandardMaterial && !original.isMeshPhysicalMaterial && !original.isMeshStandardNodeMaterial && !original.isMeshPhysicalNodeMaterial) return original;
        if (installed.has(original)) return installed.get(original);
        const nodeMaterial = renderer.library.fromMaterial(original);
        if (!nodeMaterial) return original;
        const setup = nodeMaterial.setupMaterialLightings.bind(nodeMaterial);
        const lighting = dryInterior ? Fn(() => {
          const local = shipLocal(positionWorld.xz).toVar(), value = vec3(0).toVar();
          // Decks/hold are dry enclosed spaces even when below the sea level.
          // Preserve illuminated EXTERIOR hull faces, not the enclosed interior.
          const enclosed = local.x.greaterThan(-1.5).and(local.x.lessThan(1.6))
            .and(abs(local.y).lessThan(max(0, hullWidthNode(local.x).sub(.03))));
          If(enclosed.not(), () => { value.assign(irradiance(positionWorld, normalWorld)); });
          return value;
        })() : irradiance(positionWorld, normalWorld);
        nodeMaterial.setupMaterialLightings = builder => [...setup(builder), new THREE.IrradianceNode(lighting)];
        nodeMaterial.needsUpdate = true;
        installed.set(original, nodeMaterial); installed.set(nodeMaterial, nodeMaterial);
        return nodeMaterial;
      };
      object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
    });
  }
  let initialized = false, lastStorm = -1, lastShip = new THREE.Vector3(Infinity, Infinity, Infinity);
  const savedClearColor = new THREE.Color();
  const gpuCosts = []; let costTimer = null, costFrame = 0;
  function update(renderer, paused) {
    if (!enabled || (initialized && paused && Math.abs(lastStorm - uniforms.uStorm.value) < .00001 && lastShip.equals(uniforms.uShip.value))) return;
    const old = renderer.getRenderTarget(), tone = renderer.toneMapping, auto = renderer.autoClear;
    const clear = renderer.getClearColor(savedClearColor), alpha = renderer.getClearAlpha();
    // Optional WebGPU-only nested timestamps; never SUM this with whole-frame
    // GPU timing. WebGL elapsed queries cannot be nested and are not enabled.
    if (!costTimer && params.get('causticTiming') === '1' && renderer.backend.isWebGPUBackend) {
      costTimer = createFrameTimer(renderer, (frame, ms) => gpuCosts.push({frame, ms}));
    }
    costTimer?.begin(++costFrame);
    try {
      renderer.toneMapping = THREE.NoToneMapping; renderer.autoClear = false; renderer.setClearColor(0, 0);
      renderer.setRenderTarget(photons); renderer.clear(); renderer.render(photonScene, photonCamera);
      renderer.setRenderTarget(filtered); renderer.clear(); blurQuad.render(renderer);
      initialized = true; lastStorm = uniforms.uStorm.value; lastShip.copy(uniforms.uShip.value);
    } finally {
      costTimer?.end();
      renderer.setRenderTarget(old); renderer.toneMapping = tone; renderer.autoClear = auto; renderer.setClearColor(clear, alpha);
    }
  }
  async function audit(renderer) {
    await costTimer?.drain();
    const pixels = await renderer.readRenderTargetPixelsAsync(filtered, 0, 0, width, height);
    let sum = 0, sum2 = 0, peak = 0, invalid = 0, nonzero = 0, fingerprint = 2166136261;
    for (let i = 0; i < pixels.length; i += 4) {
      const value = THREE.DataUtils.fromHalfFloat(pixels[i]);
      if (!Number.isFinite(value)) { invalid++; continue; }
      sum += value; sum2 += value * value; peak = Math.max(peak, value); if (value > .001) nonzero++;
      fingerprint = Math.imul(fingerprint ^ pixels[i], 16777619) >>> 0;
    }
    const count = width * height, mean = sum / count;
    if (params.get('causticPreview') === '1') {
      // Visible, explicitly labeled diagnostic; never active in the experience.
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'), image = context.createImageData(width, height);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const row = renderer.backend.isWebGLBackend ? height - 1 - y : y;
        const flux = THREE.DataUtils.fromHalfFloat(pixels[(row * width + x) * 4]);
        const value = Math.round(255 * Math.sqrt(Math.min(1, Math.max(0, flux) / 3)));
        const i = (y * width + x) * 4;
        image.data.set([value, value, value, 255], i);
      }
      context.putImageData(image, 0, 0);
      const panel = document.createElement('figure'); panel.id = 'caustic-diagnostic';
      panel.style.cssText = 'position:absolute;bottom:28px;left:20px;width:620px;max-width:calc(100vw - 40px);margin:0;padding:12px;background:#09151eee;border:1px solid #36505a;border-radius:8px;z-index:55;color:#bdccd2;font:10px sans-serif';
      const caption = document.createElement('figcaption'); caption.textContent = 'LIVE FFT PHOTON FLUX · 8 DEPTH SLICES · grayscale diagnostic, not the final water color';
      const img = document.createElement('img'); img.id = 'caustic-atlas'; img.alt = 'Wave-refracted light concentration at eight underwater depths'; img.src = canvas.toDataURL('image/png'); img.style.cssText = 'display:block;width:100%;margin-top:8px';
      panel.append(caption, img); document.getElementById('caustic-diagnostic')?.remove(); document.getElementById('app').append(panel);
    }
    let flatReference = null;
    if (flatTest) {
      const cosine = lightDirection.value.y, f0 = ((WATER_IOR - 1) / (WATER_IOR + 1)) ** 2;
      const expected = cosine * (1 - f0 - (1 - f0) * (1 - cosine) ** 5), probes = [];
      for (let layer = 0; layer < CAUSTIC_LAYERS; layer++) for (const z of [-.8, 0, .8]) {
        const xPixel = Math.floor((layer % 4 + (-2.4 / CAUSTIC_EXTENT[0] + .5)) * cx);
        const yTop = Math.floor((Math.floor(layer / 4) + (z / CAUSTIC_EXTENT[1] + .5)) * cy);
        const yPixel = renderer.backend.isWebGLBackend ? height - 1 - yTop : yTop;
        const measured = THREE.DataUtils.fromHalfFloat(pixels[(yPixel * width + xPixel) * 4]);
        probes.push({ layer, z, expected, measured, error: Math.abs(measured - expected) });
      }
      flatReference = { probes, maxError: Math.max(...probes.map(p => p.error)), pass: probes.every(p => p.error < .002) };
    }
    const warmup = Math.max(45, Number(params.get('warmup') || 150)), frames = Math.max(60, Number(params.get('frames') || 360));
    const costs = gpuCosts.filter(p => p.frame > warmup && p.frame <= warmup + frames).map(p => p.ms).sort((a,b) => a-b);
    const timing = costs.length ? { method: 'Separate WebGPU timestamp markers around photon projection + footprint filter only; includes marker overhead. Not added to whole-frame time.', samples: costs.length, meanMs: costs.reduce((a,b)=>a+b,0)/costs.length, p95Ms: costs[Math.floor((costs.length-1)*.95)] } : null;
    return { method: 'FFT surface → Snell refraction → additive differential-area flux → depth slices', diagnostic: flatTest ? 'flat surface' : null, time: uniforms.uTime.value, storm: uniforms.uStorm.value, layers: CAUSTIC_LAYERS, resolution: [width, height], ior: WATER_IOR, meanFlux: mean, rmsContrast: Math.sqrt(Math.max(0, sum2 / count - mean * mean)), peakFlux: peak, invalidSamples: invalid, litFraction: nonzero / count, fingerprint, flatReference, timing, pass: enabled && invalid === 0 && mean > .01 && (flatReference ? flatReference.pass : peak > mean) };
  }
  document.body.dataset.caustics = enabled ? 'wave-refracted' : 'disabled';
  return { irradiance, install, update, audit, setLight(direction, color) { lightDirection.value.copy(direction).normalize(); incidentColor.value.copy(color); initialized = false; } };
}
