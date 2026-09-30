// Bound the command queue. FPS must describe finished frames, not an unlimited
// stream of JavaScript submissions racing ahead of the GPU.
export function createFramePacer(renderer) {
  const gpu = renderer.backend.isWebGPUBackend === true;
  const gl = gpu ? null : renderer.backend.gl;
  const pending = [], maxInFlight = 2;
  let completed = 0, windowFrames = 0, windowStart = performance.now(), fps = 0;
  function finish(item) {
    if (item.done) return; item.done = true; completed++; windowFrames++;
    const now = performance.now();
    if (now - windowStart >= 1000) { fps = windowFrames * 1000 / (now - windowStart); windowFrames = 0; windowStart = now; }
    item.callback?.(now);
  }
  function poll() {
    if (gl) for (const item of pending) {
      if (item.done) continue;
      const state = gl.clientWaitSync(item.sync, 0, 0);
      if (state === gl.ALREADY_SIGNALED || state === gl.CONDITION_SATISFIED) { gl.deleteSync(item.sync); finish(item); }
    }
    while (pending.length && pending[0].done) pending.shift();
  }
  return {
    ready() { poll(); return pending.length < maxInFlight; },
    submit(callback) {
      const item = { done: false, callback, sync: null }; pending.push(item);
      if (gpu) renderer.backend.device.queue.onSubmittedWorkDone().then(() => finish(item)).catch(() => { item.done = true; });
      else { item.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); if (!item.sync) finish(item); }
    },
    get fps() { return fps; }, get completed() { return completed; }, get inFlight() { return pending.filter(p => !p.done).length; }
  };
}
