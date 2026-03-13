/**
 * sceneLaptop.js
 * Procedural laptop — screen plane is the FRONTMOST child of the lid.
 * No bezel bars in front of it. The dark lid shell IS the bezel.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { TerminalEngine } from './terminalEngine.js';

const BASE_W = 3.6;
const BASE_D = 2.4;
const BASE_H = 0.12;
const LID_THICKNESS = 0.10;
const LID_HEIGHT = BASE_D * 0.95;
const BEZEL = 0.14;
const HINGE_Y = BASE_H;
const HINGE_Z = -BASE_D / 2;

const CLOSED_ANGLE = Math.PI / 2 - 0.12;   // slightly lifted to avoid z-fight
const OPEN_ANGLE = -0.05;

export class LaptopScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.isReady = false;
    this.lidOpenProgress = 0;
    this.terminalPlayed = false;
    this.isVisible = true;
    this.isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 4, 6);
    this.camera.lookAt(0, 0.8, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height), 0.35, 0.4, 0.85
    );
    this.composer.addPass(this.bloomPass);

    this._setupLights();

    // Terminal texture
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 1280;
    this.screenCanvas.height = 800;
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;
    this.screenTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.terminal = new TerminalEngine(this.screenCanvas, {
      width: 1280, height: 800,
      fontSize: 28, lineHeight: 44,
      typingSpeed: 30,
      onUpdate: () => { this.screenTexture.needsUpdate = true; },
    });

    // Paint initial black
    const ctx = this.screenCanvas.getContext('2d');
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 1280, 800);
    this.screenTexture.needsUpdate = true;

    this._buildLaptop();

    // Theme observer
    this._themeObserver = new MutationObserver(() => this._onThemeChange());
    this._themeObserver.observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme']
    });

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    this.clock = new THREE.Clock();
    this._animate = this._animate.bind(this);
    this.isReady = true;
  }

  /* ── LIGHTS ── */

  _setupLights() {
    this.ambientLight = new THREE.AmbientLight(0x8899bb, 0.4);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    this.keyLight.position.set(5, 7, 4);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0x6699cc, 0.35);
    this.fillLight.position.set(-5, 4, -2);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0x99bbff, 0.6);
    this.rimLight.position.set(0, 5, -6);
    this.scene.add(this.rimLight);

    this.bottomRim = new THREE.DirectionalLight(0x4466aa, 0.25);
    this.bottomRim.position.set(0, -2, 3);
    this.scene.add(this.bottomRim);

    this.screenLight = new THREE.PointLight(0x3b82f6, 0, 8);
    this.scene.add(this.screenLight);

    this.gridHelper = new THREE.GridHelper(24, 48, 0x1a1a2e, 0x1a1a2e);
    this.gridHelper.material.opacity = 0.2;
    this.gridHelper.material.transparent = true;
    this.scene.add(this.gridHelper);
  }

  /* ── PROCEDURAL LAPTOP ── */

  _buildLaptop() {
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8e, roughness: 0.35, metalness: 0.8 });
    this.bodyMatDark = new THREE.MeshStandardMaterial({ color: 0x5a5a5e, roughness: 0.4, metalness: 0.7 });
    this.bezelMat = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.3, metalness: 0.4 });
    this.edgeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.1 });

    this.laptopGroup = new THREE.Group();
    this.laptopGroup.position.set(0, 0.6, 0);

    // Base slab
    const base = new THREE.Mesh(new THREE.BoxGeometry(BASE_W, BASE_H, BASE_D), this.bodyMat);
    base.position.set(0, BASE_H / 2, 0);
    this.laptopGroup.add(base);

    // Chamfer edge
    const edge = new THREE.Mesh(new THREE.BoxGeometry(BASE_W * 0.98, 0.008, 0.01), this.edgeMat);
    edge.position.set(0, BASE_H, BASE_D / 2 - 0.005);
    this.laptopGroup.add(edge);

    // Keyboard recess
    const kb = new THREE.Mesh(new THREE.BoxGeometry(BASE_W * 0.85, 0.006, BASE_D * 0.5), darkMat);
    kb.position.set(0, BASE_H + 0.003, 0.15);
    this.laptopGroup.add(kb);

    // Trackpad
    const tp = new THREE.Mesh(
      new THREE.BoxGeometry(BASE_W * 0.24, 0.005, BASE_D * 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.3 })
    );
    tp.position.set(0, BASE_H + 0.003, BASE_D * 0.35);
    this.laptopGroup.add(tp);

    // ── Lid pivot ──
    this.lidPivot = new THREE.Group();
    this.lidPivot.position.set(0, HINGE_Y, HINGE_Z);
    this.laptopGroup.add(this.lidPivot);

    // Lid shell (this IS the bezel — dark border around screen)
    const lidShell = new THREE.Mesh(
      new THREE.BoxGeometry(BASE_W, LID_HEIGHT, LID_THICKNESS), this.bezelMat
    );
    lidShell.position.set(0, LID_HEIGHT / 2, LID_THICKNESS / 2);
    this.lidPivot.add(lidShell);

    // Lid back cover (silver, visible from behind)
    const lidBack = new THREE.Mesh(
      new THREE.BoxGeometry(BASE_W - 0.01, LID_HEIGHT - 0.01, 0.005), this.bodyMatDark
    );
    lidBack.position.set(0, LID_HEIGHT / 2, -0.002);
    this.lidPivot.add(lidBack);

    // ★ SCREEN PLANE — sits WELL in front of the lid shell.
    // Lid shell front face = LID_THICKNESS = 0.10
    // Screen at z = 0.11 — nothing can block it.
    const scrW = BASE_W - BEZEL * 2;
    const scrH = LID_HEIGHT - BEZEL * 2;
    const SCREEN_Z = LID_THICKNESS + 0.01;

    this.screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(scrW, scrH),
      new THREE.MeshBasicMaterial({ map: this.screenTexture, toneMapped: false })
    );
    this.screenMesh.position.set(0, LID_HEIGHT / 2, SCREEN_Z);
    // ★ renderOrder ensures screen always draws on top within the lid group
    this.screenMesh.renderOrder = 999;
    this.lidPivot.add(this.screenMesh);

    // Start CLOSED
    this.lidPivot.rotation.x = CLOSED_ANGLE;

    this.scene.add(this.laptopGroup);
  }

  /* ── THEME ── */

  _onThemeChange() {
    this.isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    if (this.isDark) {
      this.ambientLight.color.setHex(0x8899bb); this.ambientLight.intensity = 0.4;
      this.keyLight.intensity = 0.9; this.fillLight.intensity = 0.35;
      this.rimLight.intensity = 0.6; this.bottomRim.intensity = 0.25;
      this.renderer.toneMappingExposure = 1.2;
      this.bloomPass.strength = 0.2 + this.lidOpenProgress * 0.4;
      this.gridHelper.material.color.setHex(0x1a1a2e); this.gridHelper.material.opacity = 0.2;
      this.bodyMat.color.setHex(0x8a8a8e); this.bodyMatDark.color.setHex(0x5a5a5e);
      this.edgeMat.color.setHex(0xcccccc); this.bezelMat.color.setHex(0x0e0e0e);
    } else {
      this.ambientLight.color.setHex(0xccccdd); this.ambientLight.intensity = 0.7;
      this.keyLight.intensity = 1.0; this.fillLight.intensity = 0.4;
      this.rimLight.intensity = 0.3; this.bottomRim.intensity = 0.15;
      this.renderer.toneMappingExposure = 1.5;
      this.bloomPass.strength = 0.1 + this.lidOpenProgress * 0.15;
      this.gridHelper.material.color.setHex(0xccccdd); this.gridHelper.material.opacity = 0.15;
      this.bodyMat.color.setHex(0x6e6e72); this.bodyMatDark.color.setHex(0x4a4a4e);
      this.edgeMat.color.setHex(0x999999); this.bezelMat.color.setHex(0x222222);
    }
  }

  /* ── LID CONTROL ── */

  setLidOpen(progress) {
    this.lidOpenProgress = Math.max(0, Math.min(1, progress));
    this.lidPivot.rotation.x = CLOSED_ANGLE + (OPEN_ANGLE - CLOSED_ANGLE) * this.lidOpenProgress;

    this.screenLight.intensity = this.lidOpenProgress * 2.5;
    const worldPos = new THREE.Vector3();
    this.screenMesh.getWorldPosition(worldPos);
    this.screenLight.position.copy(worldPos).add(new THREE.Vector3(0, 0.2, 0.8));

    if (this.isDark) {
      this.bloomPass.strength = 0.2 + this.lidOpenProgress * 0.4;
    } else {
      this.bloomPass.strength = 0.1 + this.lidOpenProgress * 0.15;
    }
  }

  /* ── CAMERA ── */

  updateCamera(scrollProgress) {
    const t = Math.max(0, Math.min(1, scrollProgress));

    // Move camera closer and lower
    this.camera.position.y = 4 - t * 2.9;
    this.camera.position.z = 6 - t * 3.4;

    // Focus camera on the laptop screen area
    const targetY = 0.9 + t * 0.9;
    this.camera.lookAt(0, targetY, 0);
  }

  /* ── BOOT SEQUENCE ── */

  async playBootSequence() {
    if (this.terminalPlayed) return;
    this.terminalPlayed = true;
    this.terminal.startCursorBlink();

    await this.terminal.typeLines([
      '> booting developer profile...',
      '> loading modules...',
      '> initializing workspace...',
      '',
      '  user     : elvin',
      '  role     : full-stack developer',
      '  location : baku, azerbaijan',
      '',
      '[OK] All systems operational',
      '',
      '> scroll down to explore portfolio',
    ], 28);
  }

  /* ── RESIZE / ANIMATE ── */

  _onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.composer.setSize(this.width, this.height);
  }

  _animate() {
    if (!this.isVisible) {
      this.animationId = requestAnimationFrame(this._animate);
      return;
    }

    const t = this.clock.getElapsedTime();

    if (this.laptopGroup) {
      this.laptopGroup.rotation.y = Math.sin(t * 0.25) * 0.03;
      this.laptopGroup.position.y = 0.6 + Math.sin(t * 0.4) * 0.02;
    }

    this.composer.render();
    this.animationId = requestAnimationFrame(this._animate);
  }

  start() { this._animate(); }
  stop() { if (this.animationId) cancelAnimationFrame(this.animationId); }
  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this._themeObserver.disconnect();
    this.renderer.dispose();
    this.terminal.stopCursorBlink();
  }
}