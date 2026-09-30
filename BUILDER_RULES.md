# Three.js builder requirements

- Author custom GPU effects in **Three.js Shading Language (`three/tsl`)** and NodeMaterials. Do not introduce GLSL `ShaderMaterial`, `RawShaderMaterial`, shader-string replacement, or `onBeforeCompile` for new portable features.
- Use `WebGPURenderer` for the shared node pipeline: WebGPU when supported; `forceWebGL: true` for its WebGL2 backend. Legacy `WebGLRenderer` is not the TSL backend.
- Keep one shader graph, scene, simulation, and quality settings across both backends. Backend-specific accelerations need an equivalent fallback, not a visually reduced scene.
- Provide a user-visible backend selector, detect actual successful initialization, and clearly label fallback. Switching may reload the graphics context; preserve the user's settings.
- Test both backends at the same viewport, DPR, deterministic time, cameras, and quality. Include numerical FFT checks and screenshots. Measure performance; adapter availability alone is not proof of WebGPU rendering or 60 FPS.
- A legacy project may need a deliberate migration. Never claim it is portable merely because it imports Three.js.

Source: [Three.js Shading Language](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language), checked against installed Three.js 0.186.1.
