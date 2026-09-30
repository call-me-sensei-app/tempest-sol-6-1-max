const paths: Record<string,string> = {
  ship:'<path d="M3 15h18l-4 5H7zM12 3v12M7 6h10M7 6v6h10V6"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  sound:'<path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mute:'<path d="m11 4-6 5H2v6h3l6 5zM16 9l5 6M21 9l-5 6"/>',
  wheel:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v8m0 4v8M2 12h8m4 0h8M5 5l5 5m4 4 5 5M5 19l5-5m4-4 5-5"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  left:'<path d="m14 6-6 6 6 6"/>',
  right:'<path d="m10 6 6 6-6 6"/>',
  orbit:'<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="5"/>',
  reset:'<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
  expand:'<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  storm:'<path d="M5 14a5 5 0 0 1 0-10 7 7 0 0 1 13 1 4.5 4.5 0 0 1 1 9M9 13l-2 5h4l-2 4M16 16l-1 3"/>',
  mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  play:'<path d="m7 4 13 8-13 8z"/>',
};
export const icon=(name:string)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]??paths.ship}</svg>`;
export function mountUI() {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
    <canvas id="scene" aria-label="Interactive three-dimensional ship in a bottle" tabindex="0"></canvas>
    <div class="interface">
      <header class="topbar">
        <div class="brand-lockup"><a class="brand" href="/" aria-label="Tempest home">${icon('ship').replace('<svg','<svg class="brand-icon"')}<div><strong>TEMPEST</strong><small>A MARITIME STUDY</small></div></a><a class="sensei-credit" href="https://www.callmesensei.app" target="_blank" rel="noopener noreferrer" aria-label="by Call Me Sensei"><span>by</span><img src="/brand/cms-logo-lockup.svg" alt="Call Me Sensei" width="88" height="36"></a></div>
        <div class="top-actions"><div class="backend-switch"><span>ENGINE</span><div id="renderer-backend" class="backend-tabs" role="tablist" aria-label="Rendering backend"><button id="renderer-webgl" role="tab" aria-selected="true" data-backend="webgl">WebGL2</button><button id="renderer-webgpu" role="tab" aria-selected="false" data-backend="webgpu">WebGPU</button></div></div><button id="guided-tour" class="tour-start">${icon('play')} GUIDED TOUR</button><span class="live-label">A LIVING MINIATURE</span><button class="icon-button" id="pause" aria-label="Pause simulation" title="Pause simulation">${icon('pause')}</button><button class="icon-button about-button" id="about" aria-label="About this experience">${icon('info')}</button></div>
      </header>
      <div id="build-status" class="status-pill" role="status">BUILDING LIVE · Migrating the shared TSL pipeline</div><div id="backend-status" class="backend-status" role="status">Detecting graphics capabilities…</div>
      <div id="development-meter" class="development-meter" aria-label="Development accounting"><span id="dev-time">Elapsed —</span><span id="dev-tokens">Tokens —</span></div>
      <div id="dev-followup" class="followup-meter" aria-label="Caustics follow-up accounting" hidden></div>
      <section class="heading"><div class="eyebrow"><span>NO. 001</span> THE IMPOSSIBLE COLLECTION</div><h1>An ocean,<br><em>contained.</em></h1><p class="intro">A world beyond the glass. A vessel against the elements.<br>A small reminder that wonder has no scale.</p></section>
      <aside class="specimen"><div class="number">01 / ∞</div><p>THE NORTH ATLANTIC<br>SEA STATE · <span id="sea-state">ROUGH</span></p></aside>
      <nav class="view-rail" aria-label="Camera views"><button class="rail-button active" id="orbit" aria-label="Orbit view">${icon('orbit')}<span>Observe</span></button><button class="rail-button" id="reset" aria-label="Reset camera">${icon('reset')}<span>Reset view</span></button><button class="rail-button" id="cinema" aria-label="Hide interface">${icon('expand')}<span>Immerse</span></button><button class="rail-button" id="settings" aria-label="Rendering settings">${icon('info')}<span>Field notes</span></button></nav>
      <div class="view-hint">${icon('mouse')} Drag to explore <span style="color:#546770">/</span> Scroll to get closer <span style="color:#546770">/</span> Click the ship to board</div>
      <section class="control-dock" aria-label="Ocean controls">
        <div class="storm-section"><label class="section-label" for="storm">THE ELEMENTS <span class="value" id="storm-value">ROUGH SEAS · 65%</span></label><div class="range-row">${icon('sun')}<input id="storm" type="range" min="0" max="100" value="65" aria-label="Storm intensity">${icon('storm')}</div></div>
        <button class="dock-button" id="lightning">${icon('bolt')}<span><strong>Summon lightning</strong><small>A moment of brilliance</small></span></button>
        <button class="dock-button" id="sound" aria-pressed="false">${icon('mute')}<span><strong id="sound-label">Sound off</strong><small id="sound-note">Listen to the sea</small></span></button>
        <button class="captain-button" id="captain" aria-pressed="false">${icon('wheel')}<strong id="captain-label">TAKE THE HELM</strong>${icon('arrow')}</button>
      </section>
      <div class="captain-hud" aria-label="Steering controls"><button class="steer" id="port" aria-label="Steer port">${icon('left')}</button><div class="course">YOUR HEADING<strong id="heading-value">000° N</strong></div><button class="steer" id="starboard" aria-label="Steer starboard">${icon('right')}</button></div>
      <nav class="compartment-nav" aria-label="Explore the ship"><div class="eyebrow">ABOARD THE ASTERION</div><h2 id="compartment-title">The quarterdeck</h2><p id="compartment-description">Oak helm · brass fittings · standing rigging</p><div class="compartment-buttons"><button id="visit-helm" class="active">Quarterdeck</button><button id="visit-cabin">Captain’s cabin</button><button id="visit-gun">Gun deck</button><button id="visit-hold">Cargo hold</button></div><p class="walk-hint">Drag to look · <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to walk inside · Esc to disembark</p></nav>
      <div class="walk-hud"><button id="walk-forward" class="steer" aria-label="Walk forward">${icon('arrow')}</button><button id="walk-back" class="steer" aria-label="Walk backward">${icon('arrow')}</button></div>
      <footer class="footer"><span><strong>TEMPEST</strong> &nbsp; / &nbsp; THREE.JS r186</span><span class="footer-center" id="render-status">HANDCRAFTED IN REAL TIME</span><div class="footer-links"><a class="github-link" href="https://github.com/call-me-sensei-app/tempest-sol-6-1-max" target="_blank" rel="noopener noreferrer" aria-label="View Tempest source on GitHub">GitHub ↗</a><a class="credit" href="https://x.com/Conor_D_Dart/status/2102458290462441531" target="_blank" rel="noopener noreferrer">Inspired by Conor Dart ↗</a></div><button id="mobile-notes" aria-label="Field notes">FIELD NOTES ↗</button></footer>
      <section class="dialog" id="notes-dialog" role="dialog" aria-modal="true" aria-labelledby="notes-title" hidden><button class="icon-button close" id="close-notes" aria-label="Close field notes">${icon('close')}</button><div class="eyebrow">A SMALL WORLD, HANDCRAFTED</div><h2 id="notes-title">Notes from the sea.</h2><p>A real-time interpretation of <a href="https://x.com/Conor_D_Dart/status/2102458290462441531" target="_blank" rel="noopener noreferrer">Conor Dart’s ship-in-a-bottle study</a>. Every vessel, rope and room detail is built in code.</p><p>Drag to orbit. Pinch or scroll to zoom. Click the ship to board. At the helm, steer with <kbd>A</kbd> <kbd>D</kbd>, <kbd>←</kbd> <kbd>→</kbd>, or the on-screen arrows. Inside compartments, use <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to walk. Drag to look around. <kbd>Esc</kbd> returns to the room. <kbd>Space</kbd> pauses. <kbd>L</kbd> summons lightning.</p><p><a href="/report.html" target="_blank" rel="noopener noreferrer">Development &amp; optimization report ↗</a></p><p>GPU FFT wind waves, finite-depth dispersion, collision-aware sail dynamics and optical glass are physically motivated real-time approximations—not a full fluid or path-traced simulation. Interiors are historically informed interpretations, not recovered geometry. Sound is synthesized locally; nothing is tracked.</p><label class="quality-label">Render quality <select id="quality"><option value="cinematic" selected>Cinematic · full optics</option><option value="high">High detail</option><option value="auto">Adaptive</option><option value="balanced">Balanced</option></select></label><label class="quality-label"><input id="auto-lightning" type="checkbox"> Automatic lightning during heavy storms</label></section>
      <div class="loading" id="loading">CHARTING THE WATERS…</div>
    </div><button class="restore-ui" id="restore-ui">Return to the study &nbsp; Esc</button>`;
  let elapsed=0,synced=performance.now(),complete=false,captured='';
  let followupElapsed=0,followupSynced=performance.now(),followupComplete=false,followupTokens=0;
  const refreshFollowup=async()=>{try{const response=await fetch('/caustics-progress.json',{cache:'no-store'});if(!response.ok)return;const record=await response.json();followupComplete=!!record.complete;followupElapsed=record.elapsedSeconds+(followupComplete?0:Math.max(0,(Date.now()-Date.parse(record.capturedAt))/1000));followupSynced=performance.now();followupTokens=record.followupTokensSinceFirstCapture?.total_tokens??0;const meter=document.querySelector<HTMLDivElement>('#dev-followup')!;meter.hidden=false;meter.title=record.note;tick();}catch{/* Optional follow-up metadata. */}};
  const refresh=async()=>{try {const response=await fetch('/development.json',{cache:'no-store'}),record=await response.json(),date=response.headers.get('Date');complete=!!record.complete;if(captured!==record.capturedAt||complete||date){elapsed=record.elapsedSeconds+(complete||!date?0:Math.max(0,(Date.parse(date)-Date.parse(record.capturedAt))/1000));synced=performance.now();captured=record.capturedAt;}if(record.tokens){document.querySelector('#dev-tokens')!.textContent=`${(record.tokens.total_tokens/1e6).toFixed(2)}M total · ${(record.tokens.output_tokens/1000).toFixed(1)}k output`;document.querySelector('#development-meter')!.setAttribute('title',record.note);}tick();}catch{/* The production experience works without development metadata. */}};
  const tick=()=>{const s=Math.floor(elapsed+(complete?0:(performance.now()-synced)/1000));document.querySelector('#dev-time')!.textContent=`${complete?'BUILT IN':'BUILD'} ${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;const f=Math.floor(followupElapsed+(followupComplete?0:(performance.now()-followupSynced)/1000));document.querySelector('#dev-followup')!.textContent=`CAUSTICS ${followupComplete?'UPDATED IN':'UPDATE'} ${String(Math.floor(f/60)).padStart(2,'0')}:${String(f%60).padStart(2,'0')} · ${(followupTokens/1e6).toFixed(2)}M logged tokens (cached context included)`;};
  void refresh();void refreshFollowup();setInterval(()=>{void refresh();void refreshFollowup();},5000);setInterval(tick,1000);
  return document.querySelector<HTMLCanvasElement>('#scene')!;
}
export function status(message:string) { document.querySelector('#build-status')!.textContent=message; }
