import { WebGPURenderer, ViewportTextureNode, TextureSource } from 'three/webgpu';

// r186 clones framebuffer textures per render target but Texture.clone() shares
// their Source. Nested 640² reflections and full-size transmission captures then
// resize one another's backing data, invalidating queued WebGPU resources.
// Give each cached framebuffer its own dimensions; retain every optical pass.
const originalViewportTexture = ViewportTextureNode.prototype.getTextureForReference;
const ownViewportSources = new WeakSet();
ViewportTextureNode.prototype.getTextureForReference = function(reference = null) {
  const texture = originalViewportTexture.call(this, reference);
  if (!ownViewportSources.has(texture)) {
    texture.source = new TextureSource({ ...texture.image });
    ownViewportSources.add(texture);
  }
  return texture;
};

const PARAM = 'renderer';
export async function initializeBackend(canvas) {
  const params = new URLSearchParams(location.search);
  let preference = 'webgpu';
  try { preference = localStorage.getItem('tempest-renderer') || preference; } catch { /* Storage may be disabled. */ }
  const requested = params.get(PARAM) === 'webgpu' ? 'webgpu' : params.get(PARAM) === 'webgl' ? 'webgl' : preference;
  const tabs = document.getElementById('renderer-backend'), readout = document.getElementById('backend-status');
  let available = false;
  try { available = !!(navigator.gpu && await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })); } catch { /* Keep WebGL2 usable. */ }
  document.body.dataset.webgpu = available ? 'available' : 'unavailable';
  tabs.querySelector('[data-backend="webgpu"]').disabled = !available;
  tabs.querySelector('[data-backend="webgpu"]').title = available ? 'Use WebGPU' : 'WebGPU is not available in this browser';
  const renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false, forceWebGL: requested !== 'webgpu' || !available, powerPreference: 'high-performance', trackTimestamp: false });
  readout.textContent = `Initializing ${requested === 'webgpu' && available ? 'WebGPU' : 'WebGL2'}…`;
  await renderer.init();
  const actual = renderer.backend.isWebGPUBackend === true ? 'webgpu' : 'webgl';
  document.body.dataset.renderer = actual; document.body.dataset.shading = 'TSL';
  for (const tab of tabs.querySelectorAll('[role=tab]')) { const active = tab.dataset.backend === actual; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; }
  const fallback = requested === 'webgpu' && actual !== requested;
  readout.textContent = `${actual === 'webgpu' ? 'WebGPU' : 'WebGL2'} · TSL${fallback ? ' · WebGPU unavailable; fallback active' : ''}`;
  renderer.onDeviceLost = () => {
    readout.textContent = 'Graphics device lost. Select WebGL2 or reload to recover.';
    document.body.dataset.graphicsError = 'device-lost';
  };
  const errors = new Set();
  renderer.onError = error => {
    if (!errors.has(error.message) && errors.size < 20) console.error('Tempest renderer:', error.message);
    errors.add(error.message);
    readout.textContent = `${actual === 'webgpu' ? 'WebGPU' : 'WebGL2'} graphics error — switch engine to recover`;
    document.body.dataset.graphicsError = 'render-error';
    document.body.dataset.graphicsErrorCount = String(errors.size);
  };
  return { renderer, actual, available, fallback };
}

export function switchBackend(value, settings) {
  if (!['webgpu', 'webgl'].includes(value)) return;
  try { localStorage.setItem('tempest-renderer', value); sessionStorage.setItem('tempest-switch-state', JSON.stringify(settings)); } catch { /* URL still works. */ }
  const url = new URL(location.href); url.searchParams.set(PARAM, value);
  document.getElementById('loading').hidden = false;
  document.getElementById('loading').textContent = `SWITCHING TO ${value === 'webgpu' ? 'WEBGPU' : 'WEBGL2'}…`;
  location.assign(url.href);
}

export function readSwitchSettings() {
  try { const json = sessionStorage.getItem('tempest-switch-state'); sessionStorage.removeItem('tempest-switch-state'); return json ? JSON.parse(json) : null; } catch { return null; }
}

export async function drainGraphics(renderer) {
  if (renderer.backend.isWebGPUBackend) await renderer.backend.device.queue.onSubmittedWorkDone();
  else renderer.backend.gl.finish();
}
