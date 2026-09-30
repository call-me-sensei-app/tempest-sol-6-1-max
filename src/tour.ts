import * as THREE from 'three';
import { icon } from './ui';
import type { V3 } from './geometry';

type TourStop={title:string;tag:string;description:string;position:V3;target:V3;anchor?:V3;space?:'ship'|'whale';duration?:number;fov?:number;action?:'breath'|'hatch';motion?:'whale-track'|'whale-surface'};
export const TOUR_STOPS:TourStop[]=[
  {title:'An ocean, contained.',tag:'THE COMPLETE MINIATURE',description:'A living ship, a storm and a blue whale. Everything you see is three-dimensional, down to the instruments inside the cabin.',position:[10,7.2,16],target:[.3,2.9,0],duration:7,fov:39},
  {title:'The glass is part of the world.',tag:'OPTICAL GLASS · IOR 1.46',description:'Thickness, refraction and room-derived reflections give the bottle its optical character. Notice how the study bends around its shoulder.',position:[5.5,5.7,9],target:[2.8,3.6,.0],anchor:[3.45,4.4,1.40],fov:46},
  {title:'A sea that has weight.',tag:'FINITE-DEPTH GRAVITY WAVES',description:'A 128 × 128 directional wind spectrum evolves with finite-depth gravity dispersion. A GPU inverse FFT builds irregular swell and choppy crests; foam persists where the surface compresses.',position:[-2.2,3.33,2.02],target:[.5,2.58,.0],anchor:[.4,2.64,.4],fov:62},
  {title:'Clouds, not a painted ceiling.',tag:'VOLUMETRIC STORM SKY',description:'Coherent three-dimensional density and light absorption create soft billows and self-shadowing. The volume is clipped to the bottle, as is every rain streak.',position:[-2.3,4.25,1.70],target:[-1.6,5.02,-.15],anchor:[-1.65,5.08,0],fov:61},
  {title:'The Asterion rides the swell.',tag:'SAMPLED BUOYANCY',description:'Bow, stern and beam sample the same sea you see. Smoothed heave, pitch and roll make the vessel respond without abrupt camera motion.',space:'ship',position:[1.8,1.2,2.35],target:[.1,.30,0],anchor:[.15,.30,.43],fov:52},
  {title:'Planked, fitted and weathered.',tag:'OAK HULL · CANNON PORTS',description:'A continuous hull, caulked planking, gun ports, iron barrels and rubbed brass trim—not a solid toy-shaped shell. The moving water mask protects the interior.',space:'ship',position:[.75,.26,1.18],target:[.30,.23,.42],anchor:[.3,.23,.44],fov:49},
  {title:'Wind gives every sail its shape.',tag:'NINE CONSTRAINED CLOTH SAILS',description:'Pinned yards and sheets hold a Verlet cloth lattice. Wind pressure, gravity and structural constraints produce billow and flutter, over stained linen and fine woven relief.',space:'ship',position:[.45,2.02,1.35],target:[.0,1.65,.0],anchor:[.06,1.56,.22],fov:47},
  {title:'The small lines matter.',tag:'SHROUDS · RATLINES · YARD LIFTS',description:'Separate stays, shrouds, climbing ratlines, braced yards, belaying pins and coils make the rigging readable at close range.',space:'ship',position:[-.54,1.32,.84],target:[-.82,1.30,.24],anchor:[-.82,1.31,.26],fov:52},
  {title:'A blue whale beneath the surface.',tag:'BALAENOPTERA MUSCULUS',description:'Mottled blue-gray skin, throat pleats, paired blowholes, a small aft dorsal fin and horizontal flukes. The camera travels alongside its vertically undulating body.',space:'whale',position:[-1.3,-.28,1.38],target:[-.15,-.02,0],anchor:[.42,.08,.10],duration:14,fov:57,motion:'whale-track'},
  {title:'A tail built for the ocean.',tag:'TAPERED FLUKES · FLEXING HYDROFOIL',description:'Thin trailing edges, a central notch, curved leading edges and tapered tips form two continuous foil surfaces. Subtle span-wise flex follows the vertical tail stroke.',space:'whale',position:[-1.54,.20,.74],target:[-1.20,-.01,0],anchor:[-1.27,0,.26],duration:8,fov:48},
  {title:'An eye, not a painted dot.',tag:'CORNEA · SOFT ORBITAL FOLDS',description:'Small dark eyes sit within the skin, beneath continuous eyelid folds and a fine orbital crease. The cornea catches only a restrained underwater reflection.',space:'whale',position:[1.02,-.10,.52],target:[.695,-.024,.18],anchor:[.695,-.024,.18],duration:8,fov:42},
  {title:'One unhurried breath.',tag:'SURFACE · EXHALE · DIVE',description:'Follow the whale toward the light. It rises to the actual wave height, exhales moist breath and fine spray, then settles below the sea. Expanding rings mark the breathing site.',space:'whale',position:[1.2,.68,.94],target:[.60,.17,0],anchor:[.61,.12,0],duration:16,fov:57,action:'breath',motion:'whale-surface'},
  {title:'At the helm.',tag:'THE QUARTERDECK',description:'An eight-spoke oak wheel and its brass hub turn with the rudder. In captain mode, steer with A/D or the arrows, and drag to look through the bottle into the room.',space:'ship',position:[-1.40,.91,.025],target:[-.3,.82,0],anchor:[-1.12,.84,0],fov:74},
  {title:'Below the companion hatch.',tag:'GUN DECK · CREW QUARTERS',description:'Oak beams and frames surround cannon carriages, breeching ropes, powder buckets, a mess table and suspended canvas hammocks. This is a modeled room inside the hull.',space:'ship',position:[-.58,.02,0],target:[.75,.025,0],anchor:[.28,-.075,.1],duration:9,fov:74,action:'hatch'},
  {title:'The captain’s working cabin.',tag:'CHARTS · COT · SEA CHEST',description:'A navigation table, book shelf, cot and brass-bound chest sit behind a paneled door. Gallery windows look out through real openings, with scuffs and moisture staining at the joints.',space:'ship',position:[-1.01,.115,0],target:[-1.42,.10,0],anchor:[-1.315,.02,0],duration:8,fov:69},
  {title:'A pen from the age of sail.',tag:'TURNED HOLDER · SPLIT METAL NIB',description:'A worn wooden dip-pen holder, tarnished ferrule, split steel nib and tiny breather hole. Finish scratches and oxidized metal replace pristine showroom surfaces.',space:'ship',position:[-1.252,.145,.175],target:[-1.272,.024,.064],anchor:[-1.262,.024,.064],duration:9,fov:38},
  {title:'Time, kept at sea.',tag:'1847 MARINE CHRONOMETER',description:'An aged ivory dial, Roman numerals, moving blued-steel hands and a brass gimbal inside a bound mahogany case. Look for scratches on the bezel and wear on the open lid.',space:'ship',position:[-1.322,.096,-.033],target:[-1.382,.045,-.088],anchor:[-1.382,.05,-.088],duration:9,fov:48},
  {title:'The ship carries a life below.',tag:'CARGO HOLD · PROVISIONS',description:'Iron-hooped water casks, battened crates, stored line and stone ballast surround the keelson and hold stanchions. The compartment is below the gun-deck floor.',space:'ship',position:[-.46,-.253,.0],target:[.56,-.29,.0],anchor:[.46,-.30,.13],duration:8,fov:76},
  {title:'The carved cradle.',tag:'WALNUT · BRASS INLAY',description:'Beveled moldings, sculpted cradles, finials and corner fittings support the glass. The engraved plaque and its screws are geometry, not a flat scene backdrop.',position:[.25,.72,3.25],target:[-.30,.365,1.74],anchor:[-.3,.365,1.745],fov:48},
  {title:'Cork, rope and a mariner’s knot.',tag:'THE NECK ASSEMBLY',description:'Rough cork relief and individual hemp coils frame the bottle mouth. Suspension lines attach the compass and lantern to the knot instead of floating in space.',position:[7.75,4.10,2.7],target:[5.77,3.48,.28],anchor:[5.45,3.49,.97],fov:54},
  {title:'A little instrument, still alive.',tag:'HANGING COMPASS',description:'A subtly swinging brass housing surrounds an engraved rose and a separate needle. The fittings carry tarnish and fine scratches.',position:[6.8,2.55,3.02],target:[6.06,2.05,1.20],anchor:[6.06,2.05,1.235],fov:49},
  {title:'Warm light outside the storm.',tag:'BRASS LANTERN · AMBER GLASS',description:'A candle flame, amber panes, ventilated hood and framing throw warm light onto the cold glass. The distant study remains a complete, explorable 3D environment.',position:[5.5,2.22,2.85],target:[5.12,1.86,1.25],anchor:[5.12,1.86,1.25],fov:48},
  {title:'The world is yours to explore.',tag:'END OF THE GUIDED STUDY',description:'Take the helm, visit the cabin, change the weather, or listen to the sea. The guided tour is replayable; this miniature keeps living after the camera stops.',position:[10,7.2,16],target:[.3,2.9,0],duration:8,fov:39},
];

export function createGuidedTour(camera:THREE.PerspectiveCamera,ship:THREE.Group,whale:THREE.Group,callbacks:{active:(value:boolean)=>void;step:(stop:TourStop)=>void}) {
  const overlay=document.createElement('section');overlay.className='tour-overlay';overlay.hidden=true;overlay.setAttribute('aria-label','Guided scene tour');
  overlay.innerHTML=`<div class="tour-card"><div class="eyebrow" id="tour-tag"></div><h2 id="tour-title"></h2><p id="tour-description"></p></div><div class="tour-controls"><span id="tour-count"></span><button id="tour-prev" aria-label="Previous tour stop">${icon('left')}</button><button id="tour-pause" aria-label="Pause camera tour">${icon('pause')}</button><button id="tour-next" aria-label="Next tour stop">${icon('right')}</button><span class="tour-word">A GUIDED STUDY</span><button id="tour-exit">Return to exploring ${icon('close')}</button></div><div class="tour-pointer" id="tour-pointer"><span class="tour-dot"></span><span id="tour-pointer-label"></span></div>`;
  document.getElementById('app')!.append(overlay);
  const get=(id:string)=>document.getElementById(id)!;
  let active=false,paused=false,index=0,age=0,actionTriggered=false,fromPosition=new THREE.Vector3(),fromTarget=new THREE.Vector3(),currentTarget=new THREE.Vector3(),fromFov=39;
  const world=(point:V3,space?:'ship'|'whale')=>{const p=new THREE.Vector3(...point);if(space)(space==='ship'?ship:whale).localToWorld(p);return p;};
  function step(next:number){index=Math.max(0,Math.min(TOUR_STOPS.length-1,next));age=0;actionTriggered=false;document.body.dataset.tourPhase='transition';document.body.dataset.tourStop=String(index);fromPosition.copy(camera.position);fromTarget.copy(currentTarget.lengthSq()>0?currentTarget:camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(5)));fromFov=camera.fov;const stop=TOUR_STOPS[index];get('tour-tag').textContent=stop.tag;get('tour-title').textContent=stop.title;get('tour-description').textContent=stop.description;get('tour-count').textContent=`${String(index+1).padStart(2,'0')} / ${TOUR_STOPS.length}`;get('tour-pointer-label').textContent=stop.tag;if(stop.action!=='breath')callbacks.step(stop);}
  function start(){active=true;paused=false;overlay.hidden=false;document.body.classList.add('tour-mode');callbacks.active(true);step(0);get('tour-pause').innerHTML=icon('pause');get('tour-pause').setAttribute('aria-label','Pause camera tour');}
  function exit(){active=false;overlay.hidden=true;document.body.classList.remove('tour-mode');callbacks.active(false);}
  function pause(){paused=!paused;get('tour-pause').innerHTML=icon(paused?'play':'pause');get('tour-pause').setAttribute('aria-label',paused?'Resume camera tour':'Pause camera tour');}
  get('tour-prev').addEventListener('click',()=>step(index-1));get('tour-next').addEventListener('click',()=>step(index+1));get('tour-exit').addEventListener('click',exit);get('tour-pause').addEventListener('click',pause);
  function update(dt:number){
    if(!active)return false;const stop=TOUR_STOPS[index];if(!paused)age+=dt;
    const duration=stop.duration??7,transition=Math.min(3.2,duration*.42),u=Math.min(1,age/transition),smooth=u*u*(3-2*u);
    const tracking=Math.max(0,Math.min(1,(age-transition)/(duration-transition)));
    let offset:V3=stop.position,targetPoint:V3=stop.target;
    if(stop.motion==='whale-track'){offset=[-1.3+tracking*2.1,-.28+Math.sin(tracking*Math.PI)*.045,1.38+Math.sin(tracking*Math.PI)*.12];targetPoint=[-.25+tracking*.75,-.012,0];}
    if(stop.motion==='whale-surface'){offset=[1.2-tracking*.62,.68+Math.sin(tracking*Math.PI)*.15,.94+tracking*.38];targetPoint=[.60,.17,0];}
    const destination=world(offset,stop.space),look=world(targetPoint,stop.space);
    if(stop.motion==='whale-surface'){
      // Film from the outboard side, not from a fixed whale-local offset that
      // can put the lens through the neighboring vessel's hull.
      const away=new THREE.Vector3(look.x-ship.position.x,0,look.z-ship.position.z);
      if(away.lengthSq()<.001)away.set(0,0,1);away.normalize();
      destination.copy(look).addScaledVector(away,1.48+tracking*.12);destination.y=look.y+.74;
      if(!actionTriggered&&age>transition*.9){callbacks.step(stop);actionTriggered=true;}
    }
    camera.position.lerpVectors(fromPosition,destination,smooth);currentTarget.lerpVectors(fromTarget,look,smooth);camera.lookAt(currentTarget);camera.fov=fromFov+((stop.fov??52)-fromFov)*smooth;camera.updateProjectionMatrix();
    document.body.dataset.tourPhase=u>=1?'settled':'transition';
    const pointer=get('tour-pointer');if(stop.anchor&&u>.72){const p=world(stop.anchor,stop.space).project(camera);pointer.hidden=p.z>1||p.z< -1;pointer.style.left=`${Math.max(24,Math.min(innerWidth-210,(p.x*.5+.5)*innerWidth))}px`;pointer.style.top=`${Math.max(100,Math.min(innerHeight-160,(-p.y*.5+.5)*innerHeight))}px`;}else pointer.hidden=true;
    if(age>duration){if(index<TOUR_STOPS.length-1)step(index+1);else exit();}return true;
  }
  return {start,exit,pause,next:()=>step(index+1),update,get active(){return active;},get index(){return index;},get paused(){return paused;}};
}
