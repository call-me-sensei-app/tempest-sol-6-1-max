// Whole-frame elapsed GPU time. Do not add nested/overlapping render-pass
// durations: those can grossly over-count reflection and post-processing work.
import { Fn, uint } from 'three/tsl';
import { WGSLNodeBuilder } from 'three/webgpu';
export function createFrameTimer(renderer, deliver) {
  const backend = renderer.backend;
  if (!backend.isWebGPUBackend) {
    const gl = backend.gl, ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), pending = [];
    let active = null;
    return {
      supported: !!ext, method: 'EXT_disjoint_timer_query_webgl2 spanning the complete frame',
      begin(frame) {
        for (let i = pending.length - 1; i >= 0; i--) {
          const p = pending[i];
          if (gl.getQueryParameter(p.query, gl.QUERY_RESULT_AVAILABLE)) {
            if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) deliver(p.frame, gl.getQueryParameter(p.query, gl.QUERY_RESULT) / 1e6);
            gl.deleteQuery(p.query); pending.splice(i, 1);
          }
        }
        if (ext) { active = { frame, query: gl.createQuery() }; gl.beginQuery(ext.TIME_ELAPSED_EXT, active.query); }
      },
      end() { if (active) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(active); active = null; } },
      async drain() { /* The benchmark's drain frames collect delayed queries. */ }
    };
  }
  const device = backend.device, supported = device.features.has('timestamp-query');
  if (!supported) return { supported: false, method: 'Timestamp queries unavailable', begin() {}, end() {}, async drain() {} };
  // A real one-workgroup dispatch prevents drivers from dropping empty marker
  // passes. The marker kernel is generated from TSL, not handwritten WGSL.
  const markerNode = Fn(() => { uint(0).toVar().assign(0); }, 'void')().compute([1], [1]);
  const builder = new WGSLNodeBuilder(null, renderer); builder.compute = markerNode; builder.build();
  const markerPipeline = device.createComputePipeline({ layout:'auto', compute:{ module:device.createShaderModule({code:builder.computeShader}), entryPoint:'main' } });
  const batches = Array.from({ length: 3 }, () => ({
    queries: device.createQuerySet({ type: 'timestamp', count: 64 }),
    resolve: device.createBuffer({ size: 512, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }),
    read: device.createBuffer({ size: 512, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
    frames: [], used: 0, busy: false, promise: null
  }));
  let batch = batches[0], active = null;
  function marker(b, index, start) {
    const encoder = device.createCommandEncoder();
    const writes = { querySet: b.queries };
    writes[start ? 'beginningOfPassWriteIndex' : 'endOfPassWriteIndex'] = index;
    const pass = encoder.beginComputePass({ timestampWrites: writes });
    pass.setPipeline(markerPipeline); pass.dispatchWorkgroups(1); pass.end();
    device.queue.submit([encoder.finish()]);
  }
  function flush(b) {
    if (!b.used || b.busy) return b.promise;
    const frames = b.frames.slice(), count = b.used * 2, bytes = count * 8;
    const encoder = device.createCommandEncoder();
    encoder.resolveQuerySet(b.queries, 0, count, b.resolve, 0); encoder.copyBufferToBuffer(b.resolve, 0, b.read, 0, bytes);
    device.queue.submit([encoder.finish()]); b.busy = true;
    b.promise = b.read.mapAsync(GPUMapMode.READ, 0, bytes).then(() => {
      const values = new BigUint64Array(b.read.getMappedRange(0, bytes));
      for (let i = 0; i < frames.length; i++) {
        const ns = values[i * 2 + 1] - values[i * 2]; if (ns > 0) deliver(frames[i], Number(ns) / 1e6);
      }
      b.read.unmap(); b.used = 0; b.frames = []; b.busy = false;
    }).catch(() => { b.used = 0; b.frames = []; b.busy = false; });
    return b.promise;
  }
  return {
    supported, method: 'WebGPU timestamp-query markers before and after the full frame, including all captures and post-processing; nonblocking batched readback',
    begin(frame) {
      if (batch.busy || batch.used === 32) {
        if (!batch.busy) flush(batch);
        const free = batches.find(b => !b.busy && b.used < 32); if (!free) { active = null; return; } batch = free;
      }
      active = { batch, index: batch.used }; batch.frames.push(frame); marker(batch, batch.used * 2, true);
    },
    end() {
      if (!active) return;
      marker(active.batch, active.index * 2 + 1, false); active.batch.used++; active = null;
      if (batch.used >= 10) { flush(batch); batch = batches.find(b => !b.busy) || batch; }
    },
    async drain() { for (const b of batches) if (!b.busy && b.used) flush(b); await Promise.all(batches.map(b => b.promise)); }
  };
}
