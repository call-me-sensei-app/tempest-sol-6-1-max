import { BENCHMARK, OPT_LEVEL, SHARED_CAPTURE } from './benchmark';
import { createFrameTimer } from './frame-timer.js';

export function createFrameProfiler(renderer) {
  const backend = renderer.backend;
  const samples = [], samplesByFrame = new Map();
  const cloudAuditPhases=[];
  let frame = 0, cpuStart = 0, physicsStart = 0, physicsMs = 0, recorded = false, complete = false, spectrumAudit = null, cloudLightingAudit = null;
  const timer = BENCHMARK ? createFrameTimer(renderer, (frameNumber, ms) => { const sample = samplesByFrame.get(frameNumber); if (sample) sample.gpuMs = ms; }) : null;
  const timerSupported = !!timer?.supported;
  const params = new URLSearchParams(location.search);
  const id = params.get('iteration') || 'baseline', warmup = Math.max(45,Number(params.get('warmup')||150)), measurement = Math.max(60,Number(params.get('frames')||360));
  const requestedStorm = Number(params.get('storm') ?? 100), labStorm = Number.isFinite(requestedStorm) ? Math.max(0, Math.min(100, requestedStorm)) : 100;
  const freezeFrame = warmup + measurement + 40;
  const panel = document.createElement('section'); panel.className = 'benchmark-panel'; panel.hidden = !BENCHMARK;
  panel.innerHTML = `<div class="eyebrow">PERFORMANCE LAB · ${backend.isWebGPUBackend?'WEBGPU':'WEBGL2'} · TSL</div><h3 id="bench-status">Warming the pipeline…</h3><p id="bench-summary">${innerWidth} × ${innerHeight} · DPR ${renderer.getPixelRatio()} · ${labStorm}% storm</p><div class="bench-views">${[['hero','Hero'],['whale','Whale'],['cabin','Cabin'],['rope','Rope'],['water','Water'],['helm','Helm'],['rig','Rigging'],['tail','Tail'],['eyes','Eyes']].map(([view,name]) => `<button data-view="${view}">${name}</button>`).join('')}</div><p id="bench-accounting" style="font-size:8px;line-height:1.6;margin:10px 0 0;color:#a7bbc5"></p><output id="benchmark-result" data-testid="benchmark-result" hidden></output>`;
  document.getElementById('app').append(panel); document.body.classList.toggle('benchmark-mode', BENCHMARK);
  if(BENCHMARK)setInterval(()=>{const extra=document.getElementById('dev-followup');document.getElementById('bench-accounting').textContent=`${document.getElementById('dev-time').textContent} · ${document.getElementById('dev-tokens').textContent}${extra&&!extra.hidden?' · '+extra.textContent:''}`;},1000);
  const quantile = (a,q) => { const b = a.slice().sort((x,y) => x-y); return b[Math.min(b.length-1,Math.floor(q*(b.length-1)))]; };
  const summarize = a => ({ mean:a.reduce((x,y)=>x+y,0)/a.length, median:quantile(a,.5), p95:quantile(a,.95), min:Math.min(...a), max:Math.max(...a) });
  async function save() {
    await timer?.drain();
    const chosen = samples.filter(s=>s.frame>warmup&&s.frame<=warmup+measurement), gpu = chosen.map(s=>s.gpuMs).filter(n=>n!==null);
    const record = {
      id, optimizationLevel:OPT_LEVEL, sharedCapture:SHARED_CAPTURE, at:new Date().toISOString(),
      viewport:{width:innerWidth,height:innerHeight,dpr:renderer.getPixelRatio()},
      renderer:backend.isWebGPUBackend ? 'Three.js WebGPU (TSL)' : 'Three.js WebGL2 (TSL)', shading:'TSL', quality:document.body.dataset.quality || 'high',
      webgpuAvailable:document.body.dataset.webgpu==='available', three:'186', storm:Number(document.getElementById('storm').value),
      caustics:document.body.dataset.caustics, causticAudit:JSON.parse(document.body.dataset.causticAudit||'null'),
      graphicsValid:!document.body.dataset.graphicsError, graphicsError:document.body.dataset.graphicsError || null,
      diagnostic:params.get('profile') || null,
      warmupFrames:warmup, sampleFrames:chosen.length, gpuTimerSupported:timerSupported,
      gpuTimingMethod:timer?.method || 'Unavailable', maxFramesInFlight:2,
      frame:summarize(chosen.map(s=>s.frameMs)), cpu:summarize(chosen.map(s=>s.cpuMs)), physics:summarize(chosen.map(s=>s.physicsMs)),
      gpu:gpu.length?summarize(gpu):null, gpuSamples:gpu.length,
      drawCalls:summarize(chosen.map(s=>s.calls)), triangles:summarize(chosen.map(s=>s.triangles)), spectrumAudit, cloudLightingAudit, samples:chosen
    };
    const completed = chosen.filter(s => Number.isFinite(s.completedAtMs));
    if (completed.length > 1) {
      record.completedFrameMs = (completed[completed.length-1].completedAtMs - completed[0].completedAtMs) / (completed.length-1);
      record.completedFPS = 1000 / record.completedFrameMs;
    }
    const response = await fetch('/__benchmark',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});
    if (!response.ok) throw new Error('Benchmark recording failed');
    document.getElementById('benchmark-result').textContent=JSON.stringify(record);
    document.getElementById('bench-status').textContent=`${id} · ${(record.completedFPS || 1000/record.frame.mean).toFixed(1)} FPS`;
    document.getElementById('bench-summary').textContent=`${record.frame.mean.toFixed(2)} ms/frame · CPU ${record.cpu.mean.toFixed(2)} ms · GPU ${record.gpu?record.gpu.mean.toFixed(2)+' ms':'timer unavailable'}`;
    document.body.dataset.benchmark='complete'; complete=true;
  }
  return {
    setSpectrumAudit(value) { spectrumAudit=value; },
    setCloudLightingAudit(value) {
      if(!value)return;cloudAuditPhases.push(value);
      cloudLightingAudit={...value,phases:cloudAuditPhases.slice(),pass:cloudAuditPhases.every(p=>p.pass),
        rmsLightingErrorPercent:Math.max(...cloudAuditPhases.map(p=>p.rmsLightingErrorPercent)),
        meanAbsoluteLightingErrorPercent:Math.max(...cloudAuditPhases.map(p=>p.meanAbsoluteLightingErrorPercent)),
        maxLightingErrorPercent:Math.max(...cloudAuditPhases.map(p=>p.maxLightingErrorPercent))};
    },
    completedFrame(frameNumber, at) { const sample=samplesByFrame.get(frameNumber); if(sample) sample.completedAtMs=at; },
    begin(rawDt) {
      if (!BENCHMARK) return; frame++; cpuStart=performance.now(); physicsStart=cpuStart;
      renderer.info.autoReset=false; renderer.info.reset();
      if (frame<=warmup+measurement) { const sample={frame,frameMs:rawDt*1000,cpuMs:0,physicsMs:0,gpuMs:null,calls:0,triangles:0}; samples.push(sample); samplesByFrame.set(frame,sample); }
      if (frame%30===0&&!complete) document.getElementById('bench-status').textContent=frame<=warmup?`Warmup ${frame}/${warmup}`:`Sampling ${Math.min(measurement,frame-warmup)}/${measurement}`;
    },
    physicsEnd() { physicsMs=performance.now()-physicsStart; },
    gpuBegin() { timer?.begin(frame); },
    end() {
      if (!BENCHMARK) return;
      timer?.end();
      const sample=samplesByFrame.get(frame); if(sample){sample.cpuMs=performance.now()-cpuStart;sample.physicsMs=physicsMs;sample.calls=renderer.info.render.drawCalls;sample.triangles=renderer.info.render.triangles;}
      if(frame>freezeFrame+5&&!recorded){recorded=true;void save().catch(error=>document.getElementById('bench-status').textContent=String(error));}
    },
    get complete() { return complete; }, get frame() { return frame; }, get freezeFrame() { return freezeFrame; }
  };
}
