import * as THREE from 'three/webgpu';
import { initializeBackend, switchBackend, readSwitchSettings, drainGraphics } from './backend.js';
import { createPostprocessing } from './postprocessing.js';
import { createFramePacer } from './frame-pacer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mountUI,status,icon } from './ui';
import { createMaterials } from './materials';
import { createOcean,BOTTLE_POINTS } from './ocean';
import { createAtmosphere } from './atmosphere';
import { createShip } from './ship';
import { waveHeight,advanceVessel,clamp,hullHalfWidth,setPhysicsOptimization,setOceanSampler,insideHull,WATER_LEVEL } from './simulation.js';
import { createRoom,createBottleDetails } from './room';
import { createShipInteriors,COMPARTMENTS,type Compartment } from './interiors';
import { OceanAudio } from './audio';
import { createWhale } from './whale';
import { createPeriodDeskDetails } from './desk';
import { createGuidedTour } from './tour';
import { BENCHMARK,OPT_LEVEL,createFrameProfiler,freezeLocalMeshMatrices,freezeTextureMatrices } from './benchmark';
import { batchStaticMeshes } from './geometry';
import { sampleSpectralHeight,BUOYANCY_ENERGY_COVERAGE } from './spectrum.js';
import { cachedSpectralHeight } from './spectrum-cache.js';
import { rostrumCanSurface } from './whale-navigation.js';
import { freezeStaticWorld } from './static-world.js';
import './style.css';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=mountUI();
const profiling=new URLSearchParams(location.search).get('profile');
const noWater=profiling==='no-water',noLighting=profiling==='no-lighting',noShadows=noLighting||profiling==='no-shadows';
const {renderer,actual:backend,available:webgpuAvailable}=await initializeBackend(canvas);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();scene.name='Tempest — the impossible collection';scene.background=new THREE.Color('#0c151b');
const underwaterFog=new THREE.FogExp2('#0d344a',.24);
const camera=new THREE.PerspectiveCamera(39,innerWidth/innerHeight,.006,100);camera.name='observer / captain camera';camera.position.set(10,7.2,16);
const controls=new OrbitControls(camera,canvas);controls.target.set(.3,2.9,0);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=5.0;controls.maxDistance=35;controls.maxPolarAngle=Math.PI*.51;controls.minPolarAngle=.23;controls.enablePan=false;controls.update();
const homePosition=new THREE.Vector3(10,7.2,16),homeTarget=new THREE.Vector3(.3,2.9,0);
const savedPosition=homePosition.clone(),savedTarget=homeTarget.clone();
const materials=createMaterials();const room=createRoom(materials);scene.add(room.root);
const environmentTarget=new THREE.CubeRenderTarget(256,{type:THREE.HalfFloatType});
const cubeCamera=new THREE.CubeCamera(.1,80,environmentTarget);cubeCamera.position.set(0,3.48,0);cubeCamera.update(renderer,scene);
const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromCubemap(environmentTarget.texture);scene.environment=environment.texture;
const profile=BOTTLE_POINTS;
const geometry=new THREE.LatheGeometry(new THREE.SplineCurve(profile).getPoints(140),128).rotateZ(-Math.PI/2);
materials.glass.depthWrite=false;
const glass=new THREE.Mesh(geometry,materials.glass);glass.name='hand-blown optical bottle';glass.position.y=3.48;glass.renderOrder=1;scene.add(glass);
const details=createBottleDetails(materials,room.compassFace);scene.add(details.root);
const ship=createShip(materials);scene.add(ship.root);const interiors=createShipInteriors(ship.root,materials);
const desk=createPeriodDeskDetails(interiors.root,materials);
const whale=createWhale(point=>rostrumCanSurface(point.x,point.z,vessel));scene.add(whale.root,whale.plume);
setOceanSampler(OPT_LEVEL>=15?cachedSpectralHeight:sampleSpectralHeight);
const ocean=createOcean(geometry,environmentTarget.texture);scene.add(ocean.mirror,ocean.surface,ocean.volume);
ocean.caustics.install(ship.root,renderer,true);ocean.caustics.install(whale.root,renderer);
const moonlight=room.root.getObjectByName('moon through window') as THREE.DirectionalLight;
ocean.caustics.setLight(moonlight.position.clone().normalize(),moonlight.color.clone().multiplyScalar(noLighting?0:moonlight.intensity));
const atmosphere=createAtmosphere();if(new URLSearchParams(location.search).get('profile')==='no-clouds')atmosphere.clouds.visible=false;scene.add(atmosphere.clouds,atmosphere.rain,atmosphere.lightning,atmosphere.flashLight);
const containedLight=new THREE.PointLight('#60c5ff',4.6,9,2);containedLight.position.set(-2.5,4.6,-.3);containedLight.name='contained moonlight';scene.add(containedLight);
const miniatureMoon=new THREE.Mesh(new THREE.SphereGeometry(.07,16,12),new THREE.MeshBasicMaterial({color:new THREE.Color(1.5,2.5,3.4),toneMapped:false}));miniatureMoon.position.set(-2.95,4.72,-1.2);miniatureMoon.name='moonlight inside the bottle';scene.add(miniatureMoon);
if(noWater){ocean.surface.visible=false;ocean.volume.visible=false;ocean.mirror.visible=false;}
if(noLighting){scene.environment=null;scene.traverse(o=>{if(o instanceof THREE.Light)o.visible=false;});}
if(noShadows){renderer.shadowMap.enabled=false;scene.traverse(o=>{if(o instanceof THREE.Light)o.castShadow=false;});}
const composer=createPostprocessing(renderer,scene,camera);
const audio=new OceanAudio();
const profiler=createFrameProfiler(renderer);
const pacer=createFramePacer(renderer);let benchmarkViewVersion=0,benchmarkViewFrame=0;
if(OPT_LEVEL>=2){batchStaticMeshes(ship.root,[ship.wheel,ship.hatch,interiors.door,...ship.sails.map(s=>s.mesh)]);batchStaticMeshes(room.root,[]);batchStaticMeshes(details.root,[details.compass,details.hangingLamp.root]);}
const vessel={x:-.45,z:0,heading:.25,rudder:0};
let storm=.65,stormTarget=.65,paused=false,captain=false,compartment:Compartment='helm',simTime=0,lastTime=0,resetting=false;
let looking=false,pointerX=0,pointerY=0,downX=0,downY=0,wasDrag=false,lookYaw=0,lookPitch=-.12,buttonSteering=0,walkButton=0;
const keys=new Set<string>();const captainLocal=new THREE.Vector3(...COMPARTMENTS.helm.position),eyeWorld=new THREE.Vector3(),lookWorld=new THREE.Vector3();
let frameCount=0,frameTime=0,performanceFPS=60,qualityMode='cinematic',highQuality=true,waypoint=0,lastAutoStrike=0;
const waypoints=[[1.25,.25],[.20,.66],[-1.1,.20],[-.1,-.65]];
setPhysicsOptimization(OPT_LEVEL>=4);
if(OPT_LEVEL>=3){for(const group of [room.root,details.root,ship.root,whale.root])freezeLocalMeshMatrices(group);}
if(OPT_LEVEL>=8)freezeTextureMatrices(Object.values(materials));
if(OPT_LEVEL>=16){freezeStaticWorld(room.root);freezeStaticWorld(details.root,[details.compass,details.hangingLamp.root]);}
const shadowLights:THREE.DirectionalLight[]=[];
if(OPT_LEVEL>=18)scene.traverse(object=>{if(object instanceof THREE.DirectionalLight)shadowLights.push(object);});
const tour=createGuidedTour(camera,ship.root,whale.root,{active(value){if(value){if(captain)setCaptain(false);controls.enabled=false;resetting=false;}else{controls.enabled=true;home();ship.hatch.rotation.z=0;}},step(stop){if(stop.action==='breath')whale.surfaceNow(simTime);ship.hatch.rotation.z=stop.space==='ship'?-1.48:0;}});
$('guided-tour').addEventListener('click',()=>tour.start());

function setQuality(high:boolean){document.body.dataset.quality=qualityMode;highQuality=high;const ratio=Math.min(devicePixelRatio,high?1.65:1.15);renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);ocean.setQuality(high);atmosphere.uniforms.uSteps.value=qualityMode==='cinematic'?80:high?48:28;atmosphere.uniforms.uShadowSteps.value=qualityMode==='cinematic'?8:4;composer.setMode(qualityMode);ocean.setOptics(qualityMode==='cinematic');scene.traverse(o=>{if(o instanceof THREE.DirectionalLight&&o.castShadow)o.shadow.mapSize.setScalar(qualityMode==='cinematic'?4096:high?2048:1024);});composer.setQuality(high);resize();}
function resize(){camera.aspect=innerWidth/innerHeight;if(!captain&&!tour.active)camera.fov=innerWidth<650?55:39;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);ocean.resize(innerWidth,innerHeight);}
function home(){if(captain)setCaptain(false);homePosition.set(10,7.2,innerWidth<650?31:16);savedPosition.copy(homePosition);savedTarget.copy(homeTarget);resetting=true;}
function visit(place:Compartment){compartment=place;const spec=COMPARTMENTS[place];captainLocal.set(...spec.position);lookYaw=spec.yaw;lookPitch=spec.pitch;$('compartment-title').textContent=spec.title;$('compartment-description').textContent=spec.description;document.body.classList.toggle('interior-mode',place!=='helm');for(const key of Object.keys(COMPARTMENTS))$(`visit-${key}`).classList.toggle('active',key===place);ship.hatch.rotation.z=place==='helm'?0:-1.48;interiors.door.rotation.y=place==='cabin'?-Math.PI*.62:-Math.PI*.47;}
function setCaptain(value:boolean){
  if(value===captain)return;
  if(value){savedPosition.copy(camera.position);savedTarget.copy(controls.target);captain=true;controls.enabled=false;camera.fov=74;camera.updateProjectionMatrix();document.body.classList.add('captain-mode');$('captain-label').textContent='RETURN TO THE ROOM';$('captain').setAttribute('aria-pressed','true');visit('helm');canvas.focus();}
  else{captain=false;controls.enabled=true;document.body.classList.remove('captain-mode','interior-mode');$('captain-label').textContent='TAKE THE HELM';$('captain').setAttribute('aria-pressed','false');camera.fov=innerWidth<650?55:39;camera.updateProjectionMatrix();camera.position.copy(savedPosition);controls.target.copy(savedTarget);controls.update();ship.hatch.rotation.z=0;keys.clear();buttonSteering=0;}
}
function togglePause(){paused=!paused;$('pause').innerHTML=icon(paused?'play':'pause');$('pause').setAttribute('aria-label',paused?'Resume simulation':'Pause simulation');$('pause').title=paused?'Resume simulation':'Pause simulation';}
function strike(){atmosphere.strike(performance.now()/1000);audio.thunder();}
let lastFocus:Element|null=null;
function notes(open:boolean){const dialog=$('notes-dialog');dialog.hidden=!open;if(open){lastFocus=document.activeElement;$('close-notes').focus();}else if(lastFocus instanceof HTMLElement)lastFocus.focus();}
$('storm').addEventListener('input',()=>{const value=Number($<HTMLInputElement>('storm').value);stormTarget=value/100;$('storm').style.setProperty('--percent',`${value}%`);const name=value<20?'CALM':value<45?'MODERATE':value<78?'ROUGH SEAS':'TEMPEST';$('storm-value').textContent=`${name} · ${value}%`;$('sea-state').textContent=name;});
$('captain').addEventListener('click',()=>setCaptain(!captain));$('pause').addEventListener('click',togglePause);$('lightning').addEventListener('click',strike);
$('reset').addEventListener('click',home);$('orbit').addEventListener('click',()=>{if(captain)setCaptain(false);});$('cinema').addEventListener('click',()=>document.body.classList.add('cinema'));$('restore-ui').addEventListener('click',()=>document.body.classList.remove('cinema'));
for(const id of ['about','settings','mobile-notes'])$(id).addEventListener('click',()=>notes(true));$('close-notes').addEventListener('click',()=>notes(false));
$('sound').addEventListener('click',async()=>{try{const enabled=await audio.toggle();$('sound-label').textContent=enabled?'Sound on':'Sound off';$('sound-note').textContent=enabled?'Wind, waves & thunder':'Listen to the sea';$('sound').querySelector('svg')!.outerHTML=icon(enabled?'sound':'mute');$('sound').setAttribute('aria-pressed',String(enabled));}catch{status('Audio could not start. Try clicking Sound again.');}});
let graphicsChanging=false;
let graphicsRequests=0,graphicsQueue=Promise.resolve();
function changeGraphics(update:()=>void){
  graphicsRequests++;graphicsChanging=true;
  graphicsQueue=graphicsQueue.then(async()=>{await drainGraphics(renderer);update();})
    .catch(error=>{document.body.dataset.graphicsError=String(error);status('Graphics update failed; reload or select the other engine.');})
    .finally(()=>{graphicsRequests--;if(!graphicsRequests){graphicsChanging=false;lastTime=0;}});
  return graphicsQueue;
}
$<HTMLSelectElement>('quality').addEventListener('change',()=>{const selected=$<HTMLSelectElement>('quality').value;void changeGraphics(()=>{qualityMode=selected;setQuality(qualityMode==='cinematic'||qualityMode==='high'||qualityMode==='auto'&&innerWidth>650);});});
for(const place of Object.keys(COMPARTMENTS) as Compartment[])$(`visit-${place}`).addEventListener('click',()=>{if(!captain)setCaptain(true);visit(place);});
function holdButton(id:string,on:()=>void,off:()=>void){$(id).addEventListener('pointerdown',event=>{event.preventDefault();$(id).setPointerCapture(event.pointerId);on();});for(const event of ['pointerup','pointercancel','lostpointercapture'])$(id).addEventListener(event,off);}
holdButton('port',()=>buttonSteering=-1,()=>buttonSteering=0);holdButton('starboard',()=>buttonSteering=1,()=>buttonSteering=0);holdButton('walk-forward',()=>walkButton=1,()=>walkButton=0);holdButton('walk-back',()=>walkButton=-1,()=>walkButton=0);
canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;looking=captain;pointerX=downX=event.clientX;pointerY=downY=event.clientY;wasDrag=false;if(captain)canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(Math.hypot(event.clientX-downX,event.clientY-downY)>5)wasDrag=true;if(looking&&captain){lookYaw+=(event.clientX-pointerX)*.004;lookPitch=clamp(lookPitch-(event.clientY-pointerY)*.0035,-1.2,1.1);}pointerX=event.clientX;pointerY=event.clientY;});
const raycaster=new THREE.Raycaster();
canvas.addEventListener('pointerup',event=>{looking=false;if(captain||wasDrag)return;const bounds=canvas.getBoundingClientRect();raycaster.near=0;raycaster.far=Infinity;raycaster.setFromCamera(new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1),camera);if(raycaster.intersectObject(ship.root,true).length)setCaptain(true);});
canvas.addEventListener('pointercancel',()=>looking=false);
window.addEventListener('keydown',event=>{
  if(event.key==='Escape'){if(!$('notes-dialog').hidden)notes(false);else if(tour.active)tour.exit();else if(document.body.classList.contains('cinema'))document.body.classList.remove('cinema');else if(captain)setCaptain(false);return;}
  if(!$('notes-dialog').hidden){if(event.key==='Tab'){const focusable=$('notes-dialog').querySelectorAll<HTMLElement>('button,a,select,input');const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}return;}
  if((event.target as HTMLElement)?.matches('input,select,button,a'))return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(event.key))event.preventDefault();
  if(!event.repeat&&event.code==='Space')togglePause();if(!event.repeat&&event.key.toLowerCase()==='l')strike();keys.add(event.key.toLowerCase());
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();buttonSteering=0;walkButton=0;looking=false;});
window.addEventListener('resize',()=>{void changeGraphics(resize);});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();paused=true;status('Graphics context interrupted. Reload to restore the scene.');});
document.addEventListener('visibilitychange',()=>{lastTime=performance.now()/1000;audio.update(storm,compartment!=='helm'&&captain,paused);});

function updateCaptain(dt:number){
  if(compartment!=='helm'){
    const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)+walkButton;
    const strafe=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    const dx=(Math.cos(lookYaw)*forward-Math.sin(lookYaw)*strafe)*dt*.13,dz=(Math.sin(lookYaw)*forward+Math.cos(lookYaw)*strafe)*dt*.13;
    if(dx||dz){ship.root.updateMatrixWorld(true);const canMove=(x:number,z:number)=>{const length=Math.hypot(x,z);if(!length)return true;const direction=new THREE.Vector3(x/length,0,z/length).applyQuaternion(ship.root.quaternion);raycaster.near=.001;raycaster.far=length+.022;for(const height of [-.04,-.12,-.22]){const origin=captainLocal.clone();origin.y+=height;ship.root.localToWorld(origin);raycaster.set(origin,direction);if(raycaster.intersectObject(ship.root,true).some(hit=>hit.distance<length+.022))return false;}return true;};if(canMove(dx,0))captainLocal.x+=dx;if(canMove(0,dz))captainLocal.z+=dz;}
    const range=compartment==='cabin'?[-1.40,-.89]:compartment==='gun'?[-.72,1.21]:[-.67,.77];captainLocal.x=clamp(captainLocal.x,range[0],range[1]);
    const width=compartment==='hold'?.052:Math.min(.14,hullHalfWidth(captainLocal.x)*.60);captainLocal.z=clamp(captainLocal.z,-width,width);
  }
  eyeWorld.copy(captainLocal);ship.root.localToWorld(eyeWorld);camera.position.copy(eyeWorld);
  lookWorld.set(Math.cos(lookYaw)*Math.cos(lookPitch),Math.sin(lookPitch),Math.sin(lookYaw)*Math.cos(lookPitch)).applyQuaternion(ship.root.quaternion).add(eyeWorld);camera.lookAt(lookWorld);
  const degrees=((vessel.heading*180/Math.PI)%360+360)%360;$('heading-value').textContent=`${String(Math.round(degrees)).padStart(3,'0')}° ${degrees<45||degrees>=315?'E':degrees<135?'S':degrees<225?'W':'N'}`;
}

const diagnostics={ready:false,renderer:backend==='webgpu'?'WebGPU':'WebGL2',three:THREE.REVISION,quality:'high',fps:60,mode:'orbit',compartment:'helm',ship:{x:0,z:0,heading:0},waveComponents:16384,buoyancyEnergyCoverage:BUOYANCY_ENERGY_COVERAGE,clothSails:ship.sails.length};let uiFrame=0;
(window as Window&{tempest?:typeof diagnostics}).tempest=diagnostics;
if(BENCHMARK){const params=new URLSearchParams(location.search),requestedStorm=Number(params.get('storm')??100),benchStorm=Number.isFinite(requestedStorm)?clamp(requestedStorm,0,100):100;qualityMode=params.get('quality')==='cinematic'?'cinematic':'high';$<HTMLSelectElement>('quality').value=qualityMode;highQuality=true;storm=stormTarget=benchStorm/100;$<HTMLInputElement>('storm').value=String(benchStorm);$('storm').dispatchEvent(new Event('input'));}
const switched=readSwitchSettings();
if(switched&&!BENCHMARK){storm=stormTarget=Number(switched.storm??.65);$<HTMLInputElement>('storm').value=String(Math.round(storm*100));$('storm').dispatchEvent(new Event('input'));qualityMode=switched.quality??'high';$<HTMLSelectElement>('quality').value=qualityMode;highQuality=qualityMode!=='balanced';if(switched.camera)camera.position.fromArray(switched.camera);if(switched.target)controls.target.fromArray(switched.target);controls.update();if(switched.captain){setCaptain(true);visit(switched.compartment??'helm');}}
for(const button of document.querySelectorAll<HTMLButtonElement>('#renderer-backend [role=tab]'))button.addEventListener('click',()=>{if(button.dataset.backend!==backend)switchBackend(button.dataset.backend,{storm:stormTarget,quality:qualityMode,camera:camera.position.toArray(),target:controls.target.toArray(),captain,compartment});});
$('renderer-backend').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=Array.from(document.querySelectorAll<HTMLButtonElement>('#renderer-backend [role=tab]:not(:disabled)'));const index=tabs.indexOf(document.activeElement as HTMLButtonElement);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next]?.focus();});
setQuality(highQuality);if(innerWidth<650)home();$('loading').hidden=true;diagnostics.ready=true;
if(BENCHMARK)document.querySelectorAll<HTMLButtonElement>('.bench-views button').forEach(button=>button.addEventListener('click',()=>{const view=button.dataset.view;benchmarkViewVersion++;benchmarkViewFrame=profiler.frame+4;delete document.body.dataset.renderedView;controls.enabled=false;const p=new THREE.Vector3(),look=new THREE.Vector3();if(view==='helm'){p.set(-1.40,.91,.025);look.set(-.30,.82,0);ship.root.localToWorld(p);ship.root.localToWorld(look);camera.fov=74;}else if(view==='rig'){p.set(-.54,1.32,.84);look.set(-.82,1.30,.24);ship.root.localToWorld(p);ship.root.localToWorld(look);camera.fov=52;}else if(view==='tail'){p.set(-1.54,-.08,.75);look.set(-1.2,-.01,0);whale.root.localToWorld(p);whale.root.localToWorld(look);camera.fov=48;}else if(view==='eyes'){p.set(1.02,-.10,.52);look.set(.695,-.024,.18);whale.root.localToWorld(p);whale.root.localToWorld(look);camera.fov=42;}else if(view==='water'){p.set(-2.6,3.30,1.76);look.set(-.2,2.50,-.2);camera.fov=64;}else if(view==='whale'){p.set(.4,-.28,1.4);look.set(.2,0,0);whale.root.localToWorld(p);whale.root.localToWorld(look);camera.fov=57;}else if(view==='cabin'){p.set(-1.01,.115,0);look.set(-1.42,.10,0);ship.root.localToWorld(p);ship.root.localToWorld(look);camera.fov=69;}else if(view==='rope'){p.set(7.75,4.1,2.7);look.set(5.77,3.48,.28);camera.fov=54;}else{p.copy(homePosition);look.copy(homeTarget);camera.fov=39;}camera.position.copy(p);camera.lookAt(look);camera.updateProjectionMatrix();document.body.dataset.benchView=view; }));
status('READY · Wave-refracted caustics · TSL');
renderer.setAnimationLoop((ms)=>{
  if(graphicsChanging||!pacer.ready())return;
  const wallTime=ms/1000,rawDt=lastTime?wallTime-lastTime:1/60,dt=BENCHMARK?1/60:Math.min(.04,rawDt);lastTime=wallTime;
  profiler.begin(rawDt);
  if(BENCHMARK&&profiler.frame>=profiler.freezeFrame)paused=true;
  if(OPT_LEVEL>=18){for(const light of shadowLights)if(light.castShadow){light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;}}
  else scene.traverse(object=>{if(object instanceof THREE.DirectionalLight&&object.castShadow){object.shadow.autoUpdate=OPT_LEVEL<1;object.shadow.needsUpdate=true;}});
  if(!document.hidden){frameCount++;frameTime+=rawDt;if(frameCount===150){performanceFPS=pacer.fps||frameCount/frameTime;if(qualityMode==='auto'&&highQuality&&performanceFPS<26)setQuality(false);frameCount=0;frameTime=0;$('render-status').textContent=`${backend==='webgpu'?'WEBGPU':'WEBGL2'} · ${qualityMode==='cinematic'?'CINEMATIC':highQuality?'HIGH DETAIL':'BALANCED'} · ${Math.round(performanceFPS)} FPS`;}}
  storm+=(stormTarget-storm)*(1-Math.exp(-dt*2.2));
  if(!paused){
    simTime+=dt;
    let steer=buttonSteering+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    if(!captain||compartment!=='helm'){
      const destination=waypoints[waypoint];if(Math.hypot(destination[0]-vessel.x,destination[1]-vessel.z)<.34)waypoint=(waypoint+1)%waypoints.length;
      const next=waypoints[waypoint],angle=Math.atan2(next[1]-vessel.z,next[0]-vessel.x);steer=clamp(Math.atan2(Math.sin(angle-vessel.heading),Math.cos(angle-vessel.heading))*1.4,-1,1);
    }
    advanceVessel(vessel,dt,steer,storm);
    const c=Math.cos(vessel.heading),s=Math.sin(vessel.heading);
    const sample=(x:number,z:number)=>waveHeight(vessel.x+c*x-s*z,vessel.z+s*x+c*z,simTime,storm);
    const bow=sample(1.05,0),stern=sample(-1.05,0),port=sample(0,-.31),starboard=sample(0,.31),center=sample(0,0);
    const targetY=(bow+stern+port+starboard+center*2)/6+.10;
    if(simTime<.05)ship.root.position.y=targetY;ship.root.position.y+=(targetY-ship.root.position.y)*(1-Math.exp(-dt*2.5));
    const pitch=clamp(Math.atan2(bow-stern,2.1),-.15,.15),roll=clamp(Math.atan2(port-starboard,.62),-.11,.11);
    ship.root.rotation.order='YXZ';ship.root.rotation.x+=(roll-ship.root.rotation.x)*(1-Math.exp(-dt*1.9));ship.root.rotation.z+=(pitch-ship.root.rotation.z)*(1-Math.exp(-dt*1.9));ship.root.rotation.y=-vessel.heading;ship.root.position.x=vessel.x;ship.root.position.z=vessel.z;
    ship.update(dt,simTime,storm,vessel.rudder);room.update(simTime);details.update(simTime);interiors.update(simTime);desk.update(simTime);
    if($<HTMLInputElement>('auto-lightning').checked&&storm>.72&&simTime-lastAutoStrike>18){lastAutoStrike=simTime;strike();}
  }
  ocean.uniforms.uTime.value=simTime;ocean.uniforms.uStorm.value=storm;ocean.uniforms.uShip.value.set(vessel.x,vessel.z,vessel.heading);
  if(!paused){const breath=whale.update(simTime,storm);ocean.uniforms.uWhale.value.set(breath.x,breath.z,breath.surface,breath.age);const state=String(breath.blowing),phase=breath.blowing?(breath.age>.6&&breath.age<1.2?'peak':'exhaling'):'submerged';if(document.body.dataset.whaleBreathing!==state)document.body.dataset.whaleBreathing=state;if(document.body.dataset.whaleBreathPhase!==phase)document.body.dataset.whaleBreathPhase=phase;}
  ship.root.updateMatrixWorld(true);atmosphere.uniforms.uShipInverse.value.copy(ship.root.matrixWorld).invert();
  ocean.uniforms.uFlash.value=atmosphere.update(simTime,storm,wallTime);
  audio.update(storm,captain&&compartment!=='helm',paused);
  if(tour.active)tour.update(dt);else if(captain)updateCaptain(dt);else{
    if(resetting){camera.position.lerp(savedPosition,1-Math.exp(-dt*4));controls.target.lerp(savedTarget,1-Math.exp(-dt*4));if(camera.position.distanceTo(savedPosition)<.02)resetting=false;}if(!BENCHMARK||controls.enabled)controls.update();
  }
  diagnostics.fps=Math.round(performanceFPS);diagnostics.quality=qualityMode;diagnostics.mode=tour.active?'tour':captain?'aboard':'orbit';diagnostics.compartment=compartment;if(OPT_LEVEL>=7){diagnostics.ship.x=vessel.x;diagnostics.ship.z=vessel.z;diagnostics.ship.heading=vessel.heading;}else diagnostics.ship={...vessel};
  uiFrame++;if(OPT_LEVEL<6||uiFrame%8===0){document.body.dataset.mode=diagnostics.mode;document.body.dataset.tourStop=String(tour.index);document.body.dataset.waveTime=simTime.toFixed(3);document.body.dataset.shipX=vessel.x.toFixed(3);document.body.dataset.shipZ=vessel.z.toFixed(3);document.body.dataset.heading=vessel.heading.toFixed(3);}
  const dryHull=camera.position.y>ship.root.position.y-.52&&insideHull(camera.position.x,camera.position.z,vessel.x,vessel.z,vessel.heading);scene.fog=camera.position.y<WATER_LEVEL-.15&&!dryHull?underwaterFog:null;
  if(OPT_LEVEL>=3){const visible=camera.position.distanceToSquared(ship.root.position)<25&&!noLighting;for(const lamp of interiors.lamps)lamp.light.visible=visible;}
  profiler.physicsEnd();profiler.gpuBegin();atmosphere.updateLighting(renderer,paused);if(!noWater){ocean.beginFrame(renderer,simTime,paused);if(!paused)ocean.updateFoam(renderer,dt);ocean.renderRefraction(renderer,scene,camera,[glass]);}composer.render();profiler.end();const viewVersion=benchmarkViewVersion,submittedFrame=profiler.frame;pacer.submit((at:number)=>{profiler.completedFrame(submittedFrame,at);if(BENCHMARK&&profiler.complete&&viewVersion===benchmarkViewVersion&&submittedFrame>=benchmarkViewFrame)document.body.dataset.renderedView=document.body.dataset.benchView??'hero';});
  if(BENCHMARK&&!noWater&&profiler.frame===profiler.freezeFrame)void ocean.auditSpectrum(renderer,simTime).then(value=>profiler.setSpectrumAudit(value));
  if(BENCHMARK&&!noWater&&profiler.frame===profiler.freezeFrame)void ocean.caustics.audit(renderer).then(value=>{document.body.dataset.causticAudit=JSON.stringify(value);});
  // Audit the temporal light cache before pause refresh, outside timed samples.
  if(BENCHMARK&&profiler.frame>=profiler.freezeFrame-4&&profiler.frame<profiler.freezeFrame)void atmosphere.auditLighting(renderer).then(value=>profiler.setCloudLightingAudit(value));
});
