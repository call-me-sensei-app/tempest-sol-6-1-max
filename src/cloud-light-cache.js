import { Storage3DTexture, HalfFloatType, FloatType, LinearFilter, NodeMaterial, QuadMesh, RenderTarget, NoToneMapping } from 'three/webgpu';
import { Fn, If, Loop, instanceIndex, int, float, ivec3, vec3, vec4, texture3D, textureStore, exp, uniform, screenUV, floor, mod, abs } from 'three/tsl';
import { OPT_LEVEL } from './benchmark';

// Cache only the smoothly varying optical-depth integral. Primary density,
// ray count, noise resolution and cloud silhouette remain unchanged.
export function createCloudLightCache(density, uniforms) {
  const refined=OPT_LEVEL>=14;
  const width=refined?256:128,height=64,depth=refined?128:64;
  const field=new Storage3DTexture(width,height,depth);field.type=HalfFloatType;
  field.minFilter=field.magFilter=LinearFilter;field.name='cloud optical-depth light field';
  const lo=vec3(-4.8,3.7,-2.44),extent=vec3(9.4,2.35,4.88),dimensions=vec3(width,height,depth);
  const phase=uniform(0,'uint'),full=uniform(1,'uint');
  const amortized=OPT_LEVEL>=14&&new URLSearchParams(location.search).get('amortize')!=='0';
  const kernel=Fn(()=>{
    const x=instanceIndex.mod(width),y=instanceIndex.div(width).mod(height),z=instanceIndex.div(width*height);
    const write=()=>{
      const voxel=ivec3(x,y,z),p=vec3(voxel).add(.5).div(dimensions).mul(extent).add(lo).toVar();
      const opticalDepth=float(0).toVar();
      Loop({start:1,end:uniforms.uShadowSteps.add(1),type:'int',condition:'<'},({i})=>{
        opticalDepth.addAssign(density(p.add(vec3(-.17,.19,.07).mul(float(i)))).mul(.23));
      });
      const value=refined?opticalDepth:exp(opticalDepth.mul(-3.5));
      textureStore(field,voxel,vec4(value,value,value,1)).toWriteOnly();
    };
    if(amortized)If(full.equal(1).or(x.mod(2).add(y.mod(2).mul(2)).equal(phase)),write);else write();
  })().compute(width*height*depth,[64]);
  const node=texture3D(field);let lastTime=NaN,lastStorm=NaN,lastSteps=NaN,lastPaused=false;
  const sampleLight=Fn(([p])=>{
    const cached=node.sample(p.sub(lo).div(extent)).level(0).r;
    return refined?exp(cached.mul(-3.5)):cached;
  });
  let auditTarget,auditQuad;
  function setupAudit(){
    auditTarget=new RenderTarget(64,64,{type:FloatType,depthBuffer:false});
    const material=new NodeMaterial();material.depthTest=material.depthWrite=false;
    material.fragmentNode=Fn(()=>{
      const index=floor(screenUV.y.mul(64)).mul(64).add(floor(screenUV.x.mul(64)));
      const p=vec3(mod(index,16).add(.37).div(16),mod(floor(index.div(16)),16).add(.61).div(16),floor(index.div(256)).add(.43).div(16)).mul(extent).add(lo).toVar();
      const opticalDepth=float(0).toVar();
      Loop({start:1,end:uniforms.uShadowSteps.add(1),type:'int',condition:'<'},({i})=>opticalDepth.addAssign(density(p.add(vec3(-.17,.19,.07).mul(float(i)))).mul(.23)));
      const exact=exp(opticalDepth.mul(-3.5)),cached=sampleLight(p);
      return vec4(exact,cached,abs(exact.sub(cached)),density(p));
    })();auditQuad=new QuadMesh(material);
  }
  return {
    sample:sampleLight,
    update(renderer,paused){
      const t=uniforms.uTime.value,s=uniforms.uStorm.value,n=uniforms.uShadowSteps.value;
      if(t===lastTime&&s===lastStorm&&n===lastSteps&&paused===lastPaused)return;
      // Weather transitions must not trail the new density. Amortize stable
      // drifting clouds, but refresh all voxels while storm intensity changes.
      full.value=Number(!Number.isFinite(lastTime)||paused!==lastPaused||n!==lastSteps||Math.abs(s-lastStorm)>.001);
      renderer.compute(kernel);phase.value=(phase.value+1)%4;lastTime=t;lastStorm=s;lastSteps=n;lastPaused=paused;
    },
    async audit(renderer){
      if(!auditQuad)setupAudit();
      const old=renderer.getRenderTarget(),tone=renderer.toneMapping,t=uniforms.uTime.value;
      renderer.toneMapping=NoToneMapping;renderer.setRenderTarget(auditTarget);auditQuad.render(renderer);renderer.setRenderTarget(old);renderer.toneMapping=tone;
      const data=await renderer.readRenderTargetPixelsAsync(auditTarget,0,0,64,64);
      let count=0,sum=0,squared=0,maxError=0;
      for(let i=0;i<data.length;i+=4)if(data[i+3]>.02){const error=data[i+2];count++;sum+=error;squared+=error*error;maxError=Math.max(maxError,error);}
      const meanError=count?sum/count:Infinity,rmsError=count?Math.sqrt(squared/count):Infinity;
      return {time:t,samples:count,amortized,dimensions:[width,height,depth],cachedQuantity:refined?'optical-depth integral':'transmittance',meanAbsoluteLightingErrorPercent:meanError*100,rmsLightingErrorPercent:rmsError*100,maxLightingErrorPercent:maxError*100,pass:count>0&&meanError<.01&&rmsError<.01,method:'4096 scattered volume probes, cloud-bearing probes only; live cached light versus full shadow-ray integration at identical simulation time'};
    },
    dimensions:[width,height,depth]
  };
}
