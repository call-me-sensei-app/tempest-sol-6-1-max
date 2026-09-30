import * as THREE from 'three';
import { seededRandom } from './simulation.js';

function canvasTexture(size: number, draw: (context: CanvasRenderingContext2D, size: number) => void, color = true) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}
function grainTexture(seed: number, height = false) {
  const random = seededRandom(seed);
  return canvasTexture(1024, (c, s) => {
    c.fillStyle = height ? '#8d8d8d' : '#83603c'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 3800; i++) {
      const y = random() * s, shade = Math.floor(40 + random() * 100);
      c.strokeStyle = height ? `rgba(${shade},${shade},${shade},${random() * .24})` : `rgba(${shade + 30},${shade},${shade * .5},${random() * .18})`;
      c.lineWidth = .25 + random() * 1.6;
      c.beginPath();
      for (let x = 0; x <= s; x += 8) {
        const yy = y + Math.sin(x * .007 + y * .012) * 7 + Math.sin(x * .022 + y * .005) * 2;
        x ? c.lineTo(x, yy) : c.moveTo(x, yy);
      } c.stroke();
    }
    if(!height) for(let i=0;i<38;i++){const x=random()*s,y=random()*s,r=25+random()*140;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(25,27,20,${.04+random()*.18})`);g.addColorStop(1,'rgba(25,27,20,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
    if (!height) for (let i = 0; i < 7; i++) {
      const x = random() * s, y = random() * s;
      const g = c.createRadialGradient(x, y, 1, x, y, 62); g.addColorStop(0, '#3c2816'); g.addColorStop(1, '#3c281600');
      c.save(); c.translate(x, y); c.scale(2, .26); c.fillStyle = g; c.fillRect(-s, -s, s * 2, s * 2); c.restore();
    }
  }, !height);
}
export function createMaterials() {
  const woodColor = grainTexture(314), woodHeight = grainTexture(315, true);
  const woodRoughness = canvasTexture(256, (c,s) => {
    c.fillStyle = '#999'; c.fillRect(0,0,s,s); const random = seededRandom(21);
    for (let i=0; i<180;i++) { c.strokeStyle=`rgba(255,255,255,${random()*.17})`;c.beginPath(); c.moveTo(0,random()*s);c.lineTo(s,random()*s);c.stroke(); }
  }, false);
  const wood = (name: string, color: string, roughness: number, bump: number) => {
    const material = new THREE.MeshStandardMaterial({color, map:woodColor, bumpMap:woodHeight,bumpScale:bump,roughnessMap:woodRoughness,roughness,metalness:0}); material.name=name;return material;
  };
  const clothColor = canvasTexture(512, (c, s) => {
    c.fillStyle = '#c9c4ac';c.fillRect(0,0,s,s); const random=seededRandom(50);
    for(let i=0;i<70;i++) { const x=random()*s,y=random()*s,r=25+random()*70;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(67,53,33,${random()*.15})`);g.addColorStop(1,'rgba(67,53,33,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2); }
    c.strokeStyle='#847e6750'; c.lineWidth=1;
    for(let x=2;x<s;x+=86) { c.beginPath();c.moveTo(x,0);c.lineTo(x,s);c.stroke(); c.setLineDash([3,5]);c.beginPath();c.moveTo(x+3,0);c.lineTo(x+3,s);c.stroke();c.setLineDash([]); }
  });
  const clothHeight=canvasTexture(512,(c,s)=>{c.fillStyle='#888';c.fillRect(0,0,s,s);for(let i=0;i<s;i+=3){c.strokeStyle=i%2?'#777':'#aaa';c.lineWidth=.6;c.beginPath();c.moveTo(i,0);c.lineTo(i,s);c.moveTo(0,i);c.lineTo(s,i);c.stroke();}},false);
  const corkColor = canvasTexture(512, (c,s)=>{const random=seededRandom(83);c.fillStyle='#9b7044';c.fillRect(0,0,s,s);for(let i=0;i<6500;i++){const shade=Math.floor(random()*90+35);c.fillStyle=`rgba(${shade+38},${shade+15},${shade},${.2+random()*.4})`;c.fillRect(random()*s,random()*s,random()*12+1,random()*4+1);}});
  const corkHeight=canvasTexture(256,(c,s)=>{const random=seededRandom(84);c.fillStyle='#aaa';c.fillRect(0,0,s,s);for(let i=0;i<2500;i++){c.fillStyle=`rgb(${Math.floor(random()*110)},${Math.floor(random()*110)},${Math.floor(random()*110)})`;c.fillRect(random()*s,random()*s,random()*5+1,random()*2+1);}},false);
  const patina=canvasTexture(512,(c,s)=>{c.fillStyle='#b49453';c.fillRect(0,0,s,s);const random=seededRandom(960);for(let i=0;i<90;i++){const x=random()*s,y=random()*s,r=8+random()*70;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(37,62,49,${random()*.7})`);g.addColorStop(1,'rgba(37,62,49,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}for(let i=0;i<800;i++){c.strokeStyle=`rgba(215,185,123,${random()*.18})`;c.lineWidth=.5;c.beginPath();const x=random()*s,y=random()*s;c.moveTo(x,y);c.lineTo(x+random()*25,y+random()*2);c.stroke();}});
  const metalRoughness=canvasTexture(256,(c,s)=>{const random=seededRandom(961);c.fillStyle='#aaa';c.fillRect(0,0,s,s);for(let i=0;i<150;i++){c.fillStyle=`rgba(255,255,255,${random()*.24})`;c.fillRect(random()*s,random()*s,random()*30+1,random()*18+1);}},false);
  const ropeColor=canvasTexture(512,(c,s)=>{const pixels=c.createImageData(s,s),random=seededRandom(661);for(let y=0;y<s;y++)for(let x=0;x<s;x++){const strand=Math.pow(.5+.5*Math.cos((y/s*3+x/s*2)*Math.PI*2),.7),fiber=Math.sin((y/s*129+x/s*91)*Math.PI*2)*.045,noise=(random()-.5)*.10,h=strand+fiber+noise;const i=(y*s+x)*4;pixels.data[i]=65+h*77;pixels.data[i+1]=56+h*64;pixels.data[i+2]=38+h*46;pixels.data[i+3]=255;}c.putImageData(pixels,0,0);});
  const ropeHeight=canvasTexture(512,(c,s)=>{const pixels=c.createImageData(s,s);for(let y=0;y<s;y++)for(let x=0;x<s;x++){const h=(.5+.5*Math.cos((y/s*3+x/s*2)*Math.PI*2))*.8+Math.sin((y/s*129+x/s*91)*Math.PI*2)*.07;const i=(y*s+x)*4,value=30+h*215;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;}c.putImageData(pixels,0,0);},false);
  const mat = {
    walnut: wood('oiled walnut', '#594333', .67, .035),
    deck: wood('weathered teak', '#a59778', .90, .0018),
    hull: wood('tarred oak', '#564935', .82, .0025),
    darkWood: wood('ebonized oak', '#2b231b', .51, .024),
    brass: new THREE.MeshStandardMaterial({ color: '#a98b55',map:patina,metalness:.86,roughness:.57,roughnessMap:metalRoughness }),
    gold: new THREE.MeshStandardMaterial({ color: '#c6ac71',map:patina,metalness:.8,roughness:.43,roughnessMap:metalRoughness }),
    iron: new THREE.MeshStandardMaterial({ color:'#242d31', metalness:.8, roughness:.48 }),
    rope: new THREE.MeshStandardMaterial({ color:'#d0b890',map:ropeColor,bumpMap:ropeHeight,bumpScale:.0007,roughness:.96 }),
    sail: new THREE.MeshStandardMaterial({ color:'#b7b9ad', map:clothColor,bumpMap:clothHeight,bumpScale:.008,roughness:.92,side:THREE.DoubleSide,emissive:'#18252d',emissiveIntensity:.15 }),
    cork: new THREE.MeshStandardMaterial({map:corkColor,bumpMap:corkHeight,bumpScale:.025,roughness:.95}),
    lampGlass: new THREE.MeshPhysicalMaterial({ color:'#dca45c', roughness:.14, metalness:0, transmission:.87, thickness:.04, ior:1.47, transparent:true, opacity:.65 }),
    flame: new THREE.MeshBasicMaterial({color:new THREE.Color(5.2,2.3,.45),toneMapped:false}),
    cabin: new THREE.MeshStandardMaterial({color:'#b88e36',emissive:'#ffc35d',emissiveIntensity:1.2,roughness:.3}),
    glass: new THREE.MeshPhysicalMaterial({color:'#e1f0ed',metalness:0,roughness:.045,transmission:1,thickness:.09,ior:1.46,attenuationColor:new THREE.Color('#99cbc6'),attenuationDistance:12,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:.55,side:THREE.DoubleSide}),
  };
  for(const [name,material] of Object.entries(mat)) if(!material.name) material.name=name;
  return mat;
}
export type Materials = ReturnType<typeof createMaterials>;
