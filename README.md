# Tempest — an ocean, contained

A code-authored Three.js ship-in-a-bottle study, with an explorable ship, period instruments, animated blue whale, wind-wave ocean, volumetric storm and a 23-stop labeled camera tour.

**Live page:** [callmesensei.app/experiments/tempest-sol-6-1-max](https://callmesensei.app/experiments/tempest-sol-6-1-max)

[Source on GitHub](https://github.com/call-me-sensei-app/tempest-sol-6-1-max)

## Run

```sh
npm install
npm run dev -- --port 5173
npm test
npm run typecheck
npm run build
```

Three.js is pinned to **0.186.1**, checked against npm on 1 October 2026 JST. Visual custom shaders use **TSL** and NodeMaterials. `WebGPURenderer` serves actual WebGPU or its `forceWebGL` WebGL2 backend; the two accessible engine tabs preserve settings across reload. Failed availability is labeled rather than represented as GPU rendering.

## Quality and measurements

Cinematic is maximum detail; High, Balanced and Adaptive are deliberate lower-quality alternatives. There is no universal 60 FPS guarantee. FPS counts GPU-completed frames, with at most two frames queued.

Free orbit retains full 360° horizontal rotation. A geometry-derived room-clearance volume shortens the camera boom before the walls, projecting bookcase or tabletop can hide the bottle; the selected zoom distance returns when the view opens up again. Inward zoom responds immediately at a clearance stop. This affects only free orbit, not the guided tour or ship compartments, and does not hide or simplify room geometry.

The default optimization level retains the fastest fidelity-accepted measured incumbent (level 14). Later CPU/FFT experiments remain reproducible via `opt=15` through `opt=19`. Cloud light caching is WebGPU-only; the WebGL2 fallback evaluates the original shadow rays. Primary density, authored detail and cloud ray count are preserved. The cache is world-space optical depth with 2×2 update phases, not screen-space temporal reprojection. FFT intermediates stay RGBA32F; the wave display field is independently audited RGBA16F.

Formal runs use fixed 1280×720, DPR1, 100% tempest, 150 warmup + 360 samples. Nine deterministic views must pass SSIM >0.99 and mean RGB error <1%, plus independent FFT and cloud-light checks. These are bounded regression metrics, not a photographic-realism or every-pixel guarantee. The acceptance sequence stops after five distinct sub-5% improvements versus the fastest quality-accepted prior incumbent. Disabled-feature diagnostics are not accepted optimizations.

```text
http://127.0.0.1:5173/?renderer=webgpu&bench=1&quality=cinematic&opt=14&iteration=reproduce
```

Measurements and screenshots: `artifacts/benchmarks`. Immutable completed run records: `artifacts/benchmarks/locked`. Earlier invalid/legacy experiments are retained separately and excluded from the formal summary.

## Report and development record

Open `/report.html`. Original checkpoints are in `progress/`, with exact save-time / latest-logged-token accounting in `artifacts/screenshot-accounting.json`. `/development-timelapse.mp4` is a captioned montage of those originals. Regenerate accounting/report with the scripts in `scripts/`; accounting reads this local task's token metadata only and never uploads it.

Published reports, accounting snapshots, the timelapse and the benchmark evidence bundle are included in `public/`. `artifacts/`, dependencies, build output and local tooling state are not committed. Unpack `public/benchmark-evidence.zip` at the project root to recover the original benchmark/report inputs. Accounting regeneration is opt-in: set `CODEX_SESSION_LOG` to your own local session JSONL. Never commit session logs or credentials. Optional image comparison/report tooling needs Python with NumPy/Pillow, Sharp for caption strips, and FFmpeg on `PATH`; `PYTHON_BIN`, `SHARP_PACKAGE_PATH` and `FFMPEG_BIN` can select existing runtimes. These are not required to run or build the application.

Model: **GPT 6.1 Sol at Max Effort (Not Fast)**. The hypothetical Standard API equivalent is not a Codex subscription invoice and excludes subsequent/unreported usage and external charges.

## Scope

The ocean is a finite-depth directional FFT wave approximation, not full fluid dynamics or sealed-vessel sloshing. SSR, planar/environment reflections and ambient occlusion are not hardware/full path tracing. Cloth/ship clearances and walking contacts are finite tests, not a universal rigid-body collision system. Historical interiors and hidden geometry are interpreted, not recovered from the single reference image.

### Wave-driven caustics follow-up

The former sine-pattern dots on the water boundary have been removed. A TSL photon-projection pass refracts the live FFT surface normals using water IOR 1.333, accumulates differential-area light flux in eight depth slices, and filters finite pixel/emitter footprints. Receiver materials use diffuse PBR irradiance (not emissive paint), surface orientation, spectral depth attenuation, and weaker storm illumination. The inner bottle boundary receives only a weak scattered contribution. The ship's opaque waterline footprint blocks incoming photons, and enclosed dry interiors are excluded.

This is a single-light, finite-resolution caustics approximation, not full path tracing: depth slices interpolate horizontal planes, storm transmission is a fitted weather envelope rather than a cloud ray trace, and outer-bottle refraction and complete underwater self-occlusion are not solved. No photographic caustic texture or independent looping animation is used. The same TSL graphs run on WebGPU and WebGL2.

Follow-up screenshots and elapsed/latest-logged-token checkpoints are in `artifacts/caustics/`, separate from the original completed report. Open `/caustics-report.html` for this follow-up’s evidence and accounting. Diagnostic URLs accept `caustics=0` for A/B, `causticTest=flat` for uniform-flat-surface GPU validation, `causticTiming=1` for an isolated WebGPU timestamp bracket (never added to whole-frame timing), and `causticPreview=1` for a labeled light-flux atlas in benchmark mode. `storm=15` selects a diagnostic weather state; the default benchmark remains 100% tempest.
