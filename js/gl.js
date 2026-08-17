/**
 * gl.js — the ONE WebGLRenderer + shared PMREM environment.
 * Scenes render into it on demand; nothing renders while off-screen or document.hidden.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function supportsWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (e) { return false; }
}

export function createGL(canvas, { dprCap = 1.5 } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, stencil: false,
    powerPreference: 'high-performance',
  });
  // Size from the canvas' own CSS box (fixed, inset:0): window.innerWidth includes a classic
  // scrollbar's 17px, the canvas box does not → drawing buffer would be stretched/misaligned.
  const W = () => canvas.clientWidth || window.innerWidth;
  const H = () => canvas.clientHeight || window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(W(), H(), false);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const room = new RoomEnvironment(renderer);
  const env = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  if (typeof room.dispose === 'function') room.dispose();

  // Adaptive DPR: if the rolling mean frame time exceeds 20 ms, step down by 0.25 (floor 1.0)
  const perf = { samples: [], dpr: renderer.getPixelRatio(), floor: 1.0, cap: dprCap };
  const t0 = performance.now();
  function sample(ms, onChange) {
    if (performance.now() - t0 < 2500 || ms > 120) return; // skip warm-up (shader compile) and outliers
    perf.samples.push(ms);
    if (perf.samples.length < 60) return;
    const mean = perf.samples.reduce((a, b) => a + b, 0) / perf.samples.length;
    perf.samples.length = 0;
    if (mean > 20 && perf.dpr > perf.floor) {
      perf.dpr = Math.max(perf.floor, perf.dpr - 0.25);
      renderer.setPixelRatio(perf.dpr);
      renderer.setSize(W(), H(), false);
      onChange && onChange(perf.dpr);
    }
  }

  function resize() {
    renderer.setSize(W(), H(), false);
  }

  function clear() {
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W(), H());
    renderer.clear();
  }

  return { renderer, env, resize, clear, sample, perf, W, H };
}
