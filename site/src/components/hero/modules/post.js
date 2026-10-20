import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { finishShader } from '../shaders.js';

// RenderPass(MSAA x4, half float, linear HDR) -> UnrealBloom(high threshold) -> OutputPass(ACES + sRGB) -> vignette+grain
export function createPost(renderer, scene, camera, pr, params) {
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), params.bloom.strength, params.bloom.radius, params.bloom.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(finishShader);
  composer.addPass(finish);
  return {
    composer, bloom, finish,
    setSize(w, h, ratio) { composer.setPixelRatio(ratio); composer.setSize(w, h); finish.uniforms.uAspect.value = w / h; },
    update(S) {
      bloom.threshold = params.bloom.threshold; bloom.strength = params.bloom.strength; bloom.radius = params.bloom.radius;
      finish.uniforms.uGrain.value = params.grain; finish.uniforms.uVig.value = params.vignette;
      finish.uniforms.uSeed.value = S.reduced ? 0 : Math.floor(S.time * 12) % 97;
    },
    render() { composer.render(); },
    dispose() {
      composer.passes.forEach((p) => p.dispose && p.dispose());
      composer.dispose();
      rt.dispose();
    },
  };
}
