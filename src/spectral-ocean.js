import * as THREE from 'three/webgpu';
import { Fn, Loop, If, float, vec2, vec4, texture, uniform, screenUV, floor, mod, exp2, cos, sin, mix } from 'three/tsl';
import { SPECTRUM_DATA, SPECTRUM_SIZE, spectrumAuditPoints } from './spectrum.js';
import { OPT_LEVEL } from './benchmark';
import { bitReversedSpectrum } from './fft-layout.js';

// Identical 128² spectrum and 15 inverse-FFT passes on both backends.
// Fragment kernels keep WebGL2 compatibility; no compute-only or GLSL path.
export function createSpectralOcean() {
  const N = SPECTRUM_SIZE, stages = Math.log2(N);
  const packed = OPT_LEVEL >= 19;
  const h0 = new THREE.DataTexture(packed ? bitReversedSpectrum(SPECTRUM_DATA,N) : SPECTRUM_DATA, N, N, THREE.RGBAFormat, THREE.FloatType);
  h0.minFilter = h0.magFilter = THREE.NearestFilter; h0.needsUpdate = true;
  const targets = [0, 1].map(() => new THREE.RenderTarget(N, N, {
    type: THREE.FloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
  }));
  const oppositeH0 = packed ? new THREE.DataTexture(bitReversedSpectrum(SPECTRUM_DATA,N,true),N,N,THREE.RGBAFormat,THREE.FloatType) : null;
  if(oppositeH0){oppositeH0.minFilter=oppositeH0.magFilter=THREE.NearestFilter;oppositeH0.needsUpdate=true;}
  const source = texture(h0), oppositeSource = oppositeH0 ? texture(oppositeH0) : null, input = texture(targets[0].texture);
  // Preserve full-precision accumulation. Only the repeatedly sampled final
  // display field changes format; quantization is measured against the FFT.
  const halfDisplay = OPT_LEVEL >= 13 ? new THREE.RenderTarget(N,N,{type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter}) : null;
  const displayInput = texture(targets[0].texture);
  const displayMaterial = new THREE.NodeMaterial();displayMaterial.depthTest=displayMaterial.depthWrite=false;displayMaterial.fragmentNode=displayInput;
  const displayQuad = halfDisplay ? new THREE.QuadMesh(displayMaterial) : null;
  const time = uniform(0), stage = uniform(1), axis = uniform(0), final = uniform(0);
  const multiply = Fn(([a, b]) => vec2(a.x.mul(b.x).sub(a.y.mul(b.y)), a.x.mul(b.y).add(a.y.mul(b.x))));
  const reverseBits = Fn(([value]) => {
    const v = float(value).toVar(), result = float(0).toVar();
    Loop(stages, () => { result.assign(result.mul(2).add(mod(v, 2))); v.assign(floor(v.div(2))); });
    return result;
  });
  const initial = new THREE.NodeMaterial(); initial.depthTest = initial.depthWrite = false;
  initial.fragmentNode = Fn(() => {
    const pixel = floor(screenUV.mul(N)).toVar();
    const k = (packed ? pixel : vec2(reverseBits(pixel.x), reverseBits(pixel.y))).toVar();
    const a = source.sample(k.add(.5).div(N)).level(0).toVar();
    const opposite = mod(vec2(N).sub(k), N);
    const b = (packed ? oppositeSource.sample(k.add(.5).div(N)).level(0) : source.sample(opposite.add(.5).div(N)).level(0)).toVar();
    const phase = a.b.mul(time), rot = vec2(cos(phase), sin(phase).negate()).toVar();
    const h = multiply(a.rg, rot).add(multiply(vec2(b.r, b.g.negate()), vec2(rot.x, rot.y.negate()))).toVar();
    return vec4(h, vec2(h.y.negate(), h.x).mul(a.a));
  })();
  const butterfly = new THREE.NodeMaterial(); butterfly.depthTest = butterfly.depthWrite = false;
  butterfly.fragmentNode = Fn(() => {
    const pixel = floor(screenUV.mul(N)).toVar(), index = mix(pixel.x, pixel.y, axis);
    const size = exp2(stage).toVar(), halfSize = size.mul(.5).toVar();
    const j = mod(index, size).toVar(), offset = mod(j, halfSize).toVar();
    const base = floor(index.div(size)).mul(size).add(offset).toVar();
    const first = vec2(pixel).toVar(), second = vec2(pixel).toVar();
    If(axis.lessThan(.5), () => { first.x.assign(base); second.x.assign(base.add(halfSize)); })
      .Else(() => { first.y.assign(base); second.y.assign(base.add(halfSize)); });
    const a = input.sample(first.add(.5).div(N)).level(0).toVar(), b = input.sample(second.add(.5).div(N)).level(0).toVar();
    const angle = offset.div(size).mul(Math.PI * 2), twiddle = vec2(cos(angle), sin(angle));
    const product = vec4(multiply(b.rg, twiddle), multiply(b.ba, twiddle));
    return a.add(product.mul(j.lessThan(halfSize).select(1, -1))).mul(mix(1, 1 / (N * N), final));
  })();
  // Per-pass timestamp contexts are no longer needed: frame timing is external.
  const sharedInitial = OPT_LEVEL >= 17 ? new THREE.QuadMesh(initial) : null;
  const sharedButterfly = OPT_LEVEL >= 17 ? new THREE.QuadMesh(butterfly) : null;
  const quads = sharedInitial ? null : Array.from({ length: 15 }, (_, i) => {
    const q = new THREE.QuadMesh(i === 0 ? initial : butterfly); q.camera = q.camera.clone(); return q;
  });
  let index = 0;
  return {
    texture: halfDisplay ? halfDisplay.texture : targets[0].texture,
    async audit(renderer, t) {
      const pixels = await renderer.readRenderTargetPixelsAsync(targets[index], 0, 0, N, N);
      const webgl = renderer.backend.isWebGLBackend === true;
      const points = spectrumAuditPoints(t).map(p => {
        const row = webgl ? N - 1 - p.y : p.y;
        const gpu = pixels[(row * N + p.x) * 4];
        return { ...p, gpu, error: Math.abs(p.height - gpu) };
      });
      const maxError = Math.max(...points.map(p => p.error));
      let displayAudit=null;
      if(halfDisplay){
        const half=await renderer.readRenderTargetPixelsAsync(halfDisplay,0,0,N,N);
        let error2=0,signal2=0,maxDisplayError=0;
        for(let i=0;i<pixels.length;i++){
          const v=THREE.DataUtils.fromHalfFloat(half[i]),e=Math.abs(v-pixels[i]);
          error2+=e*e;signal2+=pixels[i]*pixels[i];maxDisplayError=Math.max(maxDisplayError,e);
        }
        const relativeRmsError=Math.sqrt(error2/Math.max(signal2,1e-20));
        displayAudit={format:'RGBA16F',fftFormat:'RGBA32F',relativeRmsError,maxDisplayError,pass:relativeRmsError<.001&&maxDisplayError<.0005};
      }
      return { time: t, size: N, points, maxHeightError: maxError, displayAudit, pass: maxError < .0001 && (!displayAudit||displayAudit.pass) };
    },
    update(renderer, t) {
      const old = renderer.getRenderTarget(), tone = renderer.toneMapping;
      renderer.toneMapping = THREE.NoToneMapping;
      time.value = t; index = 0; renderer.setRenderTarget(targets[index]); (sharedInitial || quads[0]).render(renderer);
      let pass = 1;
      for (let a = 0; a < 2; a++) for (let s = 1; s <= stages; s++) {
        input.value = targets[index].texture; axis.value = a; stage.value = s; final.value = a === 1 && s === stages ? 1 : 0;
        index = 1 - index; renderer.setRenderTarget(targets[index]); (sharedButterfly || quads[pass]).render(renderer);pass++;
      }
      if(halfDisplay){displayInput.value=targets[index].texture;renderer.setRenderTarget(halfDisplay);displayQuad.render(renderer);}
      renderer.setRenderTarget(old); renderer.toneMapping = tone; return halfDisplay ? halfDisplay.texture : targets[index].texture;
    }
  };
}
