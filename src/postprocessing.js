import { RenderPipeline, NormalBlending, BlendMode } from 'three/webgpu';
import { Fn, pass, mrt, output, normalView, materialMetalness, materialRoughness, vec2, vec4, screenUV, float, mix, clamp, textureSize } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { OPT_LEVEL } from './benchmark';

export function createPostprocessing(renderer, scene, camera) {
  const p = screenUV.mul(2).sub(1), vignette = float(1).sub(p.dot(p).mul(.16));
  const pipeline = new RenderPipeline(renderer);
  let scenePass, currentMode = '', lastWidth=0,lastHeight=0;
  function setMode(mode,force=false) {
    if (mode === currentMode&&!force) return; currentMode = mode;
    scenePass?.dispose();
    const cinematic = mode === 'cinematic';
    scenePass = pass(scene, camera, { samples: mode === 'balanced' ? 2 : 4 });
    const color = scenePass.getTextureNode('output'), depth = scenePass.getTextureNode('depth');
    let beauty = color.rgb;
    if (cinematic) {
      const mask = Fn(({ material }) => float(material.depthWrite === false ? 0 : 1))();
      const surface = Fn(({ material }) => {
        const physical = material.isMeshStandardNodeMaterial || material.isMeshPhysicalNodeMaterial;
        return vec4(physical ? materialMetalness : float(0), physical ? materialRoughness : float(1), 0, mask);
      })();
      const targets = mrt({ output, normal: vec4(normalView, mask), surface });
      // Transparent glass/clouds must not replace the depth surface's normal.
      targets.setBlendMode('normal', new BlendMode(NormalBlending)); targets.setBlendMode('surface', new BlendMode(NormalBlending));
      scenePass.setMRT(targets);
      const normals = scenePass.getTextureNode('normal'), properties = scenePass.getTextureNode('surface');
      const contactDepth = depth.clone();
      // r186 GTAO builds its gather branch even at full resolution. WGSL has
      // no textureGather for multisampled depth. Four explicit TSL depth loads
      // supply the same nearest 2×2 footprint, retaining the 4× MSAA beauty pass.
      contactDepth.gather = () => ({ sample: q => {
        const e = vec2(1).div(textureSize(contactDepth));
        return vec4(contactDepth.sample(q.add(e.mul(vec2(-.5,-.5)))).r,
          contactDepth.sample(q.add(e.mul(vec2(.5,-.5)))).r,
          contactDepth.sample(q.add(e.mul(vec2(-.5,.5)))).r,
          contactDepth.sample(q.add(e.mul(vec2(.5,.5)))).r);
      }});
      const contacts = ao(contactDepth, normals, camera);
      contacts.resolutionScale = 1; contacts.samples.value = 24;
      contacts.radius.value = .075; contacts.thickness.value = .20; contacts.scale.value = .75;
      const softContacts = denoise(contacts.getTextureNode(), depth, normals, camera);
      const reflections = ssr(color, depth, normals, {
        camera, metalnessNode: properties.r, roughnessNode: properties.g,
        // r186's mirror/blur path weights output by metalness. Non-metal
        // rays have zero RGB contribution; reject them before tracing.
        reflectNonMetals: OPT_LEVEL < 11, stochastic: false, binaryRefine: true
      });
      reflections.resolutionScale = 1; reflections.quality.value = 1;
      reflections.maxDistance.value = 12; reflections.thickness.value = .025;
      reflections.intensity.value = .22; reflections.screenEdgeFade.value = .12;
      reflections.screenEdgeFadeBlack = true;
      // Keep environment and planar ocean reflection on a screen-space miss.
      // Screen hits supplement rather than replace those existing optical paths.
      const profile = new URLSearchParams(location.search).get('profile');
      if(profile!=='no-ao')beauty = beauty.mul(mix(.72, 1, clamp(softContacts.r, 0, 1)));
      if(profile!=='no-ssr')beauty = beauty.add(reflections.rgb);
    }
    const glow = bloom(color, .16, .40, 1.5);
    pipeline.outputNode = vec4(beauty.add(glow.rgb).mul(vignette), 1); pipeline.needsUpdate = true;
  }
  setMode('high');
  return {
    render: () => pipeline.render(),
    setMode,
    setQuality(high) { scenePass.options.samples = high ? 4 : 2; },
    setSize(width, height) {
      if(width===lastWidth&&height===lastHeight)return;
      lastWidth=width;lastHeight=height;
      // Fresh scene/post targets avoid r186's stale transmission snapshots
      // on resize. The caller drains the queue before this lifecycle change.
      setMode(currentMode,true);
    },
    setPixelRatio(ratio) { /* Same DPR and MSAA on both backends. */ }
  };
}
