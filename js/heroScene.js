/**
 * heroScene.js
 * Procedural laptop, env-lit PBR, shader screen with cross-fade + blinking cursor,
 * additive glow planes instead of bloom, contact shadow, ambient particle field.
 * Renders into the SHARED renderer (see gl.js). No EffectComposer.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BootPainter, paintStats, paintKeyboard, paintRadial } from './screenPainter.js';

const BASE_W = 3.2, BASE_H = 0.14, BASE_D = 2.2;
const LID_W = 3.2, LID_H = 2.1, LID_T = 0.07;
const SCR_W = 2.96, SCR_H = 1.85;
const DEG = Math.PI / 180;

const THEME = {
  dark:  { body: 0x2B2E35, bezel: 0x08090B, env: 1.0, particle: 0xE0A458, particleOpacity: 0.55, shadow: 0.55, halo: 0.22, deck: 0.18 },
  light: { body: 0xB9BCC3, bezel: 0x15171C, env: 0.8, particle: 0x9A5B14, particleOpacity: 0.28, shadow: 0.30, halo: 0.10, deck: 0.10 },
};

const SCREEN_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// Textures are NoColorSpace and we deliberately omit <colorspace_fragment>/<tonemapping_fragment>
// so canvas colours pass through 1:1 (WYSIWYG screen).
const SCREEN_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tA; uniform sampler2D tB;
  uniform float uMix; uniform float uTime; uniform float uOn;
  uniform vec4 uCursor; uniform vec3 uCursorColor;
  varying vec2 vUv;
  void main(){
    vec3 a = texture2D(tA, vUv).rgb;
    vec3 b = texture2D(tB, vUv).rgb;
    float m1 = clamp(uMix, 0.0, 1.0);
    vec3 col = mix(a, b, m1);
    // blinking cursor (only on the boot screen)
    if (uCursor.z > 0.0 && m1 < 0.5) {
      vec2 d = vUv - uCursor.xy;
      float inside = step(0.0, d.x) * step(d.x, uCursor.z) * step(abs(d.y), uCursor.w * 0.5);
      float blink = step(0.5, fract(uTime * 0.9));
      col = mix(col, uCursorColor, inside * blink * (1.0 - m1 * 2.0));
    }
    // soft vignette + panel brightness
    float v = smoothstep(0.95, 0.35, length(vUv - 0.5));
    col *= (0.72 + 0.28 * v) * uOn;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const PARTICLE_VERT = /* glsl */`
  attribute float aSize; attribute float aSeed;
  uniform float uTime; uniform float uPixelRatio; uniform vec2 uMouse;
  varying float vAlpha;
  void main(){
    vec3 p = position;
    p.y = mod(p.y + uTime * 0.05 * (0.4 + aSeed * 0.6) + 1.5, 6.5) - 1.5;
    p.x += sin(uTime * 0.22 + aSeed * 6.2831) * 0.25;
    p.xy += uMouse * 0.18 * (0.3 + aSeed);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(aSize * uPixelRatio * (42.0 / -mv.z), 12.0 * uPixelRatio);
    vAlpha = smoothstep(14.0, 5.0, -mv.z) * smoothstep(0.6, 2.4, -mv.z) * (0.3 + 0.7 * aSeed);
    gl_Position = projectionMatrix * mv;
  }
`;
const PARTICLE_FRAG = /* glsl */`
  precision mediump float;
  uniform vec3 uColor; uniform float uOpacity;
  varying float vAlpha;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
  }
`;

export class HeroScene {
  /**
   * @param {object} o
   * @param {THREE.WebGLRenderer} o.renderer  shared renderer
   * @param {THREE.Texture} o.env             PMREM environment
   * @param {boolean} o.isMobile
   * @param {boolean} o.isDark
   * @param {boolean} o.reduce                prefers-reduced-motion
   */
  constructor({ renderer, env, isMobile, isDark, reduce, stage }) {
    this.renderer = renderer;
    this.isMobile = isMobile;
    this.reduce = reduce;
    // On phones the full-viewport canvas would put the laptop *behind* the copy (unreadable, and it moves with
    // the address bar). There we render into the hero-stage box instead, so the object owns its own band.
    this.stage = (isMobile && stage) ? stage : null;
    this.dirty = true;
    this.pointer = new THREE.Vector2(0, 0);
    this._pointerLerp = new THREE.Vector2(0, 0);
    this.intro = { p: reduce ? 1 : 0 };  // 0 → 1 entrance (laptop rises, lid opens to rest angle)

    // Scroll-driven state (GSAP tweens this object directly)
    this.state = isMobile
      ? { cx: 0, cy: 2.35, cz: 6.6, tx: 0, ty: 1.05, tz: 0, fov: 34, lid: 100, mix: 0, on: 1 }
      : { cx: -3.7, cy: 2.7, cz: 8.2, tx: -1.35, ty: 0.75, tz: 0, fov: 30, lid: 32, mix: 0, on: 1 };

    this.scene = new THREE.Scene();
    this.scene.environment = env;
    this.camera = new THREE.PerspectiveCamera(this.state.fov, 1, 0.1, 60);
    this._target = new THREE.Vector3();

    this._buildLaptop();
    this._buildScreen();
    this._buildGlow();
    this._buildLights();
    this._buildParticles();
    this.setTheme(isDark);
    const el = renderer.domElement;
    this.resize(el.clientWidth || window.innerWidth, el.clientHeight || window.innerHeight);

    // The stats screen is painted synchronously above — possibly before Geist/Geist Mono finished loading
    // (fallback fonts would be baked into the texture). Repaint once the faces are available.
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('500 34px "Geist"'), document.fonts.load('12px "Geist Mono"')])
        .then(() => {
          this.texStats.image = paintStats(); this.texStats.needsUpdate = true;
          this.dirty = true;
        })
        .catch(() => { /* fallback fonts are fine */ });
    }
  }

  /* ── build ─────────────────────────────────────────── */

  _buildLaptop() {
    this.bodyMat = new THREE.MeshPhysicalMaterial({
      color: THEME.dark.body, metalness: 0.92, roughness: 0.38,
      clearcoat: 0.25, clearcoatRoughness: 0.3, envMapIntensity: 1.0,
    });
    this.bezelMat = new THREE.MeshStandardMaterial({ color: THEME.dark.bezel, roughness: 0.55, metalness: 0.2 });
    const hingeMat = new THREE.MeshStandardMaterial({ color: 0x0E1014, roughness: 0.35, metalness: 0.9 });

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Base
    const base = new THREE.Mesh(new RoundedBoxGeometry(BASE_W, BASE_H, BASE_D, 4, 0.05), this.bodyMat);
    base.position.y = BASE_H / 2;
    this.group.add(base);

    // Keyboard deck (map + bump from one canvas)
    this.kbCanvas = paintKeyboard(true);
    this.kbTex = new THREE.CanvasTexture(this.kbCanvas);
    this.kbTex.colorSpace = THREE.SRGBColorSpace;
    this.kbTex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.kbMat = new THREE.MeshStandardMaterial({ map: this.kbTex, bumpMap: this.kbTex, bumpScale: 0.004, roughness: 0.8, metalness: 0.1 });
    const kb = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.05), this.kbMat);
    kb.rotation.x = -Math.PI / 2;
    kb.position.set(0, BASE_H + 0.002, -0.42);
    this.group.add(kb);

    // Trackpad
    const tp = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.006, 0.6, 2, 0.003),
      new THREE.MeshStandardMaterial({ color: 0x1B1E25, roughness: 0.5, metalness: 0.4 }));
    tp.position.set(0, BASE_H + 0.001, 0.62);
    this.tpMat = tp.material;
    this.group.add(tp);

    // Lid pivot at the back edge
    this.lidPivot = new THREE.Group();
    this.lidPivot.position.set(0, BASE_H, -BASE_D / 2 + 0.05);
    this.group.add(this.lidPivot);

    // Hinge cylinder + caps
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.9, 24), hingeMat);
    hinge.rotation.z = Math.PI / 2;
    this.lidPivot.add(hinge);

    // Lid: material array — +z face (index 4) is the dark bezel, the rest is body
    const lidGeo = new RoundedBoxGeometry(LID_W, LID_H, LID_T, 4, 0.03);
    const lid = new THREE.Mesh(lidGeo, [this.bodyMat, this.bodyMat, this.bodyMat, this.bodyMat, this.bezelMat, this.bodyMat]);
    lid.position.set(0, LID_H / 2, 0);
    this.lidPivot.add(lid);

    // Contact shadow
    this.shadowTex = new THREE.CanvasTexture(paintRadial(512, 'rgba(0,0,0,1)', 'rgba(0,0,0,0)', 0.45));
    this.shadowMat = new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, opacity: 0.55, depthWrite: false });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.6), this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -0.004, 0.1);
    this.group.add(shadow);
  }

  _buildScreen() {
    this.boot = new BootPainter();
    const mk = (canvas) => {
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      return t;
    };
    this.texBoot = mk(this.boot.canvas);
    this.statsCanvas = paintStats();
    this.texStats = mk(this.statsCanvas);
    this.screenMat = new THREE.ShaderMaterial({
      vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG,
      uniforms: {
        tA: { value: this.texBoot }, tB: { value: this.texStats },
        uMix: { value: 0 }, uTime: { value: 0 }, uOn: { value: 1 },
        uCursor: { value: new THREE.Vector4(0, 0, 0, 0) },
        uCursorColor: { value: new THREE.Color(0xE0A458) },
      },
      toneMapped: false,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCR_W, SCR_H), this.screenMat);
    screen.position.set(0, LID_H / 2, LID_T / 2 + 0.002);
    this.lidPivot.add(screen);
    this.screenMesh = screen;

    // Glass over the screen — env sweeps across it as the lid rotates
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x000000, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
      transparent: true, opacity: 0.12, envMapIntensity: 1.4, depthWrite: false,
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(SCR_W, SCR_H), this.glassMat);
    glass.position.set(0, LID_H / 2, LID_T / 2 + 0.006);
    glass.renderOrder = 2;
    this.lidPivot.add(glass);
  }

  _buildGlow() {
    const radial = new THREE.CanvasTexture(paintRadial(256));
    radial.colorSpace = THREE.SRGBColorSpace;
    // Halo behind the lid (cool screen light)
    // Faces the camera but sits behind the lid → the lid occludes the centre, only a rim of light peeks out.
    this.haloMat = new THREE.MeshBasicMaterial({ map: radial, color: 0xDDE7F0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(SCR_W * 1.5, SCR_H * 1.6), this.haloMat);
    halo.position.set(0, LID_H / 2, -LID_T / 2 - 0.05);
    this.lidPivot.add(halo);
    // Deck glow (warm keyboard backlight / screen spill on the keys)
    this.deckMat = new THREE.MeshBasicMaterial({ map: radial, color: 0xE0A458, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.0), this.deckMat);
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(0, BASE_H + 0.006, -0.35);
    this.group.add(deck);
  }

  _buildLights() {
    this.key = new THREE.DirectionalLight(0xFFF1E0, 2.4);
    this.key.position.set(-4, 6, 3);
    this.scene.add(this.key);
    // Screen spill on the deck is faked by the additive deck-glow plane (RectAreaLight would cost ~108 KB of LTC tables).
    this.screenLight = new THREE.PointLight(0xDDE7F0, 0, 4, 2);
    this.screenLight.position.set(0, LID_H * 0.55, 0.35);
    this.lidPivot.add(this.screenLight);
  }

  _buildParticles() {
    const n = this.isMobile ? 500 : 1400;
    const pos = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = Math.random() * 6.5 - 1.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
      size[i] = 0.5 + Math.random() * 1.3;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.particleMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG,
      uniforms: {
        uTime: { value: 0 }, uPixelRatio: { value: this.renderer.getPixelRatio() },
        uMouse: { value: new THREE.Vector2() }, uColor: { value: new THREE.Color(0xE0A458) }, uOpacity: { value: 0.55 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, this.particleMat);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }

  /* ── theme ─────────────────────────────────────────── */

  setTheme(isDark) {
    const t = isDark ? THEME.dark : THEME.light;
    this.isDark = isDark;
    this.bodyMat.color.setHex(t.body);
    this.bodyMat.envMapIntensity = t.env;
    this.bezelMat.color.setHex(t.bezel);
    this.tpMat.color.setHex(isDark ? 0x1B1E25 : 0xC7CAD1);
    this.shadowMat.opacity = t.shadow;
    this.particleMat.uniforms.uColor.value.setHex(t.particle);
    this.particleMat.uniforms.uOpacity.value = t.particleOpacity;
    this.particleMat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.particleMat.needsUpdate = true;
    this._haloMax = t.halo; this._deckMax = t.deck;
    this.key.intensity = isDark ? 2.4 : 3.0;
    // repaint keyboard for the theme
    const kb = paintKeyboard(isDark);
    this.kbCanvas.getContext('2d').drawImage(kb, 0, 0);
    this.kbTex.needsUpdate = true;
    this.dirty = true;
  }

  /* ── boot typing ───────────────────────────────────── */

  async playBoot() {
    if (this._booted) return;
    this._booted = true;
    try { await document.fonts.load('24px "Geist Mono"'); } catch (e) { /* fallback font is fine */ }
    if (this.reduce) { this.boot.finish(); this._uploadBoot(); return; }
    await this.boot.type(() => this._uploadBoot(), 15);
  }
  finishBoot() {
    this._booted = true;
    this.boot.finish();
    this._uploadBoot();
  }
  _uploadBoot() {
    this.texBoot.needsUpdate = true;
    const c = this.boot.cursorUV;
    this.screenMat.uniforms.uCursor.value.set(c.x, c.y, c.w, c.h);
    this.dirty = true;
  }

  /* ── input / resize ────────────────────────────────── */

  setPointer(nx, ny) { this.pointer.set(nx, ny); this.dirty = true; }

  resize(w, h) {
    if (!this.stage) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.particleMat.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    this.dirty = true;
  }

  /* ── per-frame ─────────────────────────────────────── */

  update(dt, time) {
    const s = this.state;
    const ip = this.intro.p;

    // pointer parallax (lerped) + breathing
    if (!this.reduce) {
      this._pointerLerp.lerp(this.pointer, Math.min(1, dt * 4));
      this.group.rotation.y = this._pointerLerp.x * 0.07;
      this.group.rotation.x = -this._pointerLerp.y * 0.035;
      this.group.position.y = Math.sin(time * (Math.PI * 2 / 6)) * 0.012 - (1 - ip) * 0.25;
      this.particleMat.uniforms.uTime.value = time;
      this.particleMat.uniforms.uMouse.value.copy(this._pointerLerp);
      this.screenMat.uniforms.uTime.value = time;
    }

    // lid: 0 = closed (flat on the base), openAngle from state, scaled by intro
    const open = s.lid * ip;
    this.lidPivot.rotation.x = (90 - open) * DEG;

    // screen content, glow tied to how open the lid is
    const glowF = THREE.MathUtils.smoothstep(open, 20, 90);
    this.screenMat.uniforms.uMix.value = s.mix;
    this.screenMat.uniforms.uOn.value = s.on * THREE.MathUtils.smoothstep(open, 8, 30);
    this.haloMat.opacity = this._haloMax * glowF;
    this.deckMat.opacity = this._deckMax * glowF;
    if (this.screenLight) this.screenLight.intensity = 3.5 * glowF * s.on;

    // camera
    this.camera.position.set(s.cx, s.cy, s.cz);
    this._target.set(s.tx, s.ty, s.tz);
    this.camera.lookAt(this._target);
    if (this.camera.fov !== s.fov) { this.camera.fov = s.fov; this.camera.updateProjectionMatrix(); }
  }

  render() {
    if (this.stage) {
      // contained (phones): draw only inside the hero-stage box, never behind the copy
      const r = this.stage.getBoundingClientRect();
      const canvasH = this.renderer.domElement.clientHeight || window.innerHeight;
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w < 2 || h < 2 || r.bottom < 0 || r.top > canvasH) { this.dirty = false; return; }
      const x = Math.round(r.left), y = Math.round(canvasH - r.bottom);
      if (this.camera.aspect !== w / h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
      this.renderer.setScissorTest(true);
      this.renderer.setScissor(x, y, w, h);
      this.renderer.setViewport(x, y, w, h);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setScissorTest(false);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.dirty = false;
  }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach(x => x.dispose()); else if (m) m.dispose();
    });
    [this.texBoot, this.texStats, this.kbTex, this.shadowTex].forEach(t => t && t.dispose());
  }
}
