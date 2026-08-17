/**
 * skillsScene.js
 * 12 env-lit ceramic tiles (3 rows × 4) on a shallow arc, logo baked on the front face.
 * Rendered by the SHARED renderer via scissor/viewport into the #skills-stage DOM rect.
 * Hover: raycast throttled to 30 Hz, tile lifts + tilts toward the cursor, DOM tooltip.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TILE = 0.9, TILE_D = 0.12, RADIUS = 6, SPREAD = 17; // degrees each side
const ROW_Y = [1.12, 0, -1.12];
const TEX = 512;

const THEME = {
  dark:  { tile: '#1A1D24', side: 0x1A1D24, edge: 'rgba(255,255,255,0.06)', env: 0.9, key: 1.6 },
  light: { tile: '#F1EFE9', side: 0xE9E6DF, edge: 'rgba(0,0,0,0.05)', env: 0.6, key: 2.2 },
};

export class SkillsScene {
  /**
   * @param {object} o
   * @param {THREE.WebGLRenderer} o.renderer
   * @param {THREE.Texture} o.env
   * @param {Array<{name:string, icon:string}>} o.skills  exactly 12, row-major (3×4)
   * @param {HTMLElement} o.stage      DOM element defining the render rect
   * @param {HTMLElement} o.tooltip
   * @param {boolean} o.isDark
   * @param {boolean} o.reduce
   */
  constructor({ renderer, env, skills, stage, tooltip, isDark, reduce }) {
    this.renderer = renderer;
    this.stage = stage;
    this.tooltip = tooltip;
    this.reduce = reduce;
    this.dirty = true;
    this.hovering = false;
    this.progress = 0.5;    // scroll progress through the section → yaw
    this.enter = reduce ? 1 : 0;  // 0→1 rows slide in
    this.tiles = [];
    this.images = [];

    this.scene = new THREE.Scene();
    this.scene.environment = env;
    this.camera = new THREE.PerspectiveCamera(36, 1.4, 0.1, 40);
    this.camera.position.set(0, 0, 5.4);
    this.camera.lookAt(0, 0, 0);

    this.key = new THREE.DirectionalLight(0xFFF1E0, 1.6);
    this.key.position.set(-3, 4, 5);
    this.scene.add(this.key);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2(-9, -9);
    this._lastRay = 0;
    this._hovered = null;

    this._buildTiles(skills);
    this.setTheme(isDark);
    this._loadIcons(skills);
    // labels are painted before Geist Mono may be loaded — repaint once the face is available
    if (document.fonts && document.fonts.load) {
      document.fonts.load('500 30px "Geist Mono"').then(() => { this.tiles.forEach((_, i) => this._paintTile(i)); this.dirty = true; }).catch(() => {});
    }

    this._onMove = this._onMove.bind(this);
    this._onLeave = this._onLeave.bind(this);
    stage.addEventListener('pointermove', this._onMove, { passive: true });
    stage.addEventListener('pointerleave', this._onLeave);
  }

  _buildTiles(skills) {
    const geo = new RoundedBoxGeometry(TILE, TILE, TILE_D, 3, 0.05);
    this.sideMat = new THREE.MeshPhysicalMaterial({ color: THEME.dark.side, metalness: 0.15, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.9 });
    skills.forEach((s, i) => {
      const row = Math.floor(i / 4), col = i % 4;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = TEX;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      const frontMat = new THREE.MeshPhysicalMaterial({ map: tex, metalness: 0.1, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.18, envMapIntensity: 0.9 });
      const mesh = new THREE.Mesh(geo, [this.sideMat, this.sideMat, this.sideMat, this.sideMat, frontMat, this.sideMat]);

      const a = THREE.MathUtils.lerp(-SPREAD, SPREAD, col / 3) * Math.PI / 180;
      const x = Math.sin(a) * RADIUS, z = Math.cos(a) * RADIUS - RADIUS, y = ROW_Y[row];
      mesh.position.set(x, y, z);
      // face outward from the arc centre (0, y, -RADIUS)
      mesh.lookAt(x * 2, y, z * 2 + RADIUS);
      mesh.userData = { name: s.name, i, row, col, canvas, tex, home: mesh.position.clone(), rot: mesh.rotation.clone(), lift: 0, tx: 0, ty: 0, dir: col < 2 ? -1 : 1 };
      this.group.add(mesh);
      this.tiles.push(mesh);
    });
  }

  _loadIcons(skills) {
    skills.forEach((s, i) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { this.images[i] = img; this._paintTile(i); this.dirty = true; };
      img.onerror = () => { this.images[i] = null; this._paintTile(i); };
      img.src = s.icon;
    });
  }

  _paintTile(i) {
    const t = this.tiles[i].userData;
    const th = this.isDark ? THEME.dark : THEME.light;
    const ctx = t.canvas.getContext('2d');
    ctx.clearRect(0, 0, TEX, TEX);
    ctx.fillStyle = th.tile; ctx.fillRect(0, 0, TEX, TEX);
    // subtle inner edge highlight
    ctx.strokeStyle = th.edge; ctx.lineWidth = 6; ctx.strokeRect(3, 3, TEX - 6, TEX - 6);
    const img = this.images[i];
    if (img) {
      let w = img.naturalWidth || 512, h = img.naturalHeight || 512;
      const max = TEX * 0.56;
      const sc = Math.min(max / w, max / h);
      w *= sc; h *= sc;
      try { ctx.drawImage(img, (TEX - w) / 2, (TEX - h) / 2, w, h); } catch (e) { /* ignore */ }
    }
    // name label
    ctx.font = `500 30px "Geist Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.isDark ? 'rgba(237,234,227,0.55)' : 'rgba(21,23,28,0.55)';
    ctx.fillText(t.name.toUpperCase(), TEX / 2, TEX - 46);
    t.tex.needsUpdate = true;
  }

  setTheme(isDark) {
    this.isDark = isDark;
    const th = isDark ? THEME.dark : THEME.light;
    this.sideMat.color.setHex(th.side);
    this.sideMat.envMapIntensity = th.env;
    this.key.intensity = th.key;
    this.tiles.forEach((m, i) => { m.material[4].envMapIntensity = th.env; this._paintTile(i); });
    this.dirty = true;
  }

  /* ── pointer ── */
  _onMove(e) {
    const r = this.stage.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this._px = e.clientX - r.left; this._py = e.clientY - r.top;
    this.hovering = true;
    this.dirty = true;
  }
  _onLeave() {
    this.ndc.set(-9, -9);
    this.hovering = false;
    this._setHovered(null);
    this.dirty = true;
  }
  _setHovered(m) {
    if (this._hovered === m) return;
    this._hovered = m;
    if (m) {
      this.tooltip.textContent = m.userData.name;
      this.tooltip.classList.add('visible');
      this.stage.style.cursor = 'default';
    } else {
      this.tooltip.classList.remove('visible');
    }
  }

  /* ── per-frame ── */
  update(dt, time) {
    // throttled raycast (30 Hz) while pointer is over the stage
    if (this.hovering && time - this._lastRay > 1 / 30) {
      this._lastRay = time;
      this.raycaster.setFromCamera(this.ndc, this.camera);
      const hit = this.raycaster.intersectObjects(this.tiles, false)[0];
      this._setHovered(hit ? hit.object : null);
      if (this._hovered && this.tooltip) {
        this.tooltip.style.left = this._px + 'px';
        this.tooltip.style.top = (this._py - 34) + 'px';
      }
    }

    const yaw = this.reduce ? 0 : (this.progress - 0.5) * 0.28;
    this.group.rotation.y += (yaw - this.group.rotation.y) * Math.min(1, dt * 6);

    const k = Math.min(1, dt * 8);
    let moving = false;
    this.tiles.forEach((m) => {
      const u = m.userData;
      const isHov = m === this._hovered;
      const liftT = isHov ? 0.18 : 0;
      u.lift += (liftT - u.lift) * k;
      // tilt toward cursor
      const txT = isHov ? -this.ndc.y * 0.1 : 0, tyT = isHov ? this.ndc.x * 0.1 : 0;
      u.tx += (txT - u.tx) * k; u.ty += (tyT - u.ty) * k;
      // enter offset (rows slide in from the sides), gentle float
      const enterX = (1 - this.enter) * 1.4 * u.dir;
      const floatY = this.reduce ? 0 : Math.sin(time * 0.8 + u.i * 0.7) * 0.02;
      const n = new THREE.Vector3(0, 0, 1).applyEuler(u.rot);
      m.position.copy(u.home).addScaledVector(n, u.lift).add(new THREE.Vector3(enterX, floatY, 0));
      m.rotation.set(u.rot.x + u.tx, u.rot.y + u.ty, u.rot.z);
      if (Math.abs(u.lift - liftT) > 0.001 || Math.abs(u.tx - txT) > 0.001) moving = true;
    });
    if (moving || this.enter < 1) this.dirty = true;
  }

  /**
   * Render into the stage's viewport rect (CSS px; three multiplies by pixel ratio).
   */
  render() {
    const r = this.stage.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const H = this.renderer.domElement.clientHeight || window.innerHeight; // must match the drawing-buffer CSS height (see gl.js)
    const x = Math.round(r.left), y = Math.round(H - r.bottom), w = Math.round(r.width), h = Math.round(r.height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setScissorTest(true);
    this.renderer.setScissor(x, y, w, h);
    this.renderer.setViewport(x, y, w, h);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setScissorTest(false);
    this.dirty = false;
  }

  dispose() {
    this.stage.removeEventListener('pointermove', this._onMove);
    this.stage.removeEventListener('pointerleave', this._onLeave);
    this.tiles.forEach(m => { m.userData.tex.dispose(); m.material[4].dispose(); });
    this.sideMat.dispose();
    this.tiles[0]?.geometry.dispose();
  }
}
