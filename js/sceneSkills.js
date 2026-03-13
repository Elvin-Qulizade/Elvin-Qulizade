/**
 * sceneSkills.js
 * 3D orbiting skill icons using Three.js sprite-based rendering
 */

import * as THREE from 'three';

const SKILLS = [
  { name: 'HTML5', icon: 'assets/icons/html-5.svg' },
  { name: 'CSS3', icon: 'assets/icons/css3.svg' },
  { name: 'JavaScript', icon: 'assets/icons/javascript.svg' },
  { name: 'Bootstrap', icon: 'assets/icons/bootstrap.svg' },
  { name: 'PHP', icon: 'assets/icons/PHP-logo.svg' },
  { name: 'Laravel', icon: 'assets/icons/Laravel.svg' },
  { name: 'Python', icon: 'assets/icons/python.svg' },
  { name: 'C#', icon: 'assets/icons/c-sharp.svg' },
  { name: '.NET Core', icon: 'assets/icons/NET_Core_Logo.svg' },
  { name: 'MySQL', icon: 'assets/icons/mysql.svg' },
  { name: 'SQL Server', icon: 'assets/icons/microsoft-sql-server-logo.svg' },
  { name: 'Git', icon: 'assets/icons/git-logo.svg' },
];

export class SkillsScene {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight || 500;
    this.isVisible = false;
    this.skillSprites = [];
    this.hoveredSprite = null;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 8);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 1));

    // Raycaster for hover
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);

    // Tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'skill-tooltip';
    container.appendChild(this.tooltip);

    // Load icons
    this._loadIcons();

    // Events
    this._onResize = this._onResize.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    window.addEventListener('resize', this._onResize);
    container.addEventListener('mousemove', this._onMouseMove);
    container.addEventListener('mouseleave', () => {
      this.mouse.set(-999, -999);
      this.tooltip.classList.remove('visible');
    });

    // Clock
    this.clock = new THREE.Clock();
    this._animate = this._animate.bind(this);
  }

  _loadIcons() {
    const textureLoader = new THREE.TextureLoader();
    const total = SKILLS.length;

    SKILLS.forEach((skill, i) => {
      // Create a canvas to render SVG
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Draw rounded background
        ctx.fillStyle = '#1a1a1a';
        this._roundRect(ctx, 0, 0, 128, 128, 20);
        ctx.fill();

        // Border
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 2;
        this._roundRect(ctx, 1, 1, 126, 126, 20);
        ctx.stroke();

        // Draw icon centered
        const pad = 24;
        const maxDim = 128 - pad * 2;
        let w = img.width, h = img.height;
        const aspect = w / h;
        if (w > h) { w = maxDim; h = maxDim / aspect; }
        else { h = maxDim; w = maxDim * aspect; }
        ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;

        const material = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
        });
        const sprite = new THREE.Sprite(material);

        // Position in orbit
        const angle = (i / total) * Math.PI * 2;
        const radius = 3.5;
        const yOffset = (Math.random() - 0.5) * 1.5;
        sprite.position.set(
          Math.cos(angle) * radius,
          yOffset,
          Math.sin(angle) * radius
        );
        sprite.scale.set(1.2, 1.2, 1);

        sprite.userData = {
          name: skill.name,
          baseAngle: angle,
          radius: radius,
          yOffset: yOffset,
          baseScale: 1.2,
          index: i
        };

        this.scene.add(sprite);
        this.skillSprites.push(sprite);
      };
      img.src = skill.icon;
    });

    // Central glow
    const glowGeo = new THREE.SphereGeometry(0.6, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.15,
    });
    this.centerGlow = new THREE.Mesh(glowGeo, glowMat);
    this.scene.add(this.centerGlow);

    // Orbit ring
    const ringGeo = new THREE.RingGeometry(3.4, 3.6, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight || 500;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  _onMouseMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this._clientX = e.clientX - rect.left;
    this._clientY = e.clientY - rect.top;
  }

  _animate() {
    if (!this.isVisible) {
      this.animationId = requestAnimationFrame(this._animate);
      return;
    }

    const elapsed = this.clock.getElapsedTime();

    // Rotate icons in orbit
    this.skillSprites.forEach(sprite => {
      const data = sprite.userData;
      const angle = data.baseAngle + elapsed * 0.2;
      sprite.position.x = Math.cos(angle) * data.radius;
      sprite.position.z = Math.sin(angle) * data.radius;
      sprite.position.y = data.yOffset + Math.sin(elapsed * 0.8 + data.index) * 0.15;
    });

    // Center glow pulse
    if (this.centerGlow) {
      const pulse = 0.12 + Math.sin(elapsed * 2) * 0.05;
      this.centerGlow.material.opacity = pulse;
      const s = 0.6 + Math.sin(elapsed * 1.5) * 0.1;
      this.centerGlow.scale.set(s, s, s);
    }

    // Raycaster hover
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.skillSprites);

    let hovered = null;
    if (intersects.length > 0) {
      hovered = intersects[0].object;
    }

    this.skillSprites.forEach(sprite => {
      const target = sprite === hovered ? sprite.userData.baseScale * 1.4 : sprite.userData.baseScale;
      sprite.scale.x += (target - sprite.scale.x) * 0.1;
      sprite.scale.y += (target - sprite.scale.y) * 0.1;
    });

    if (hovered) {
      this.tooltip.textContent = hovered.userData.name;
      this.tooltip.classList.add('visible');
      this.tooltip.style.left = (this._clientX || 0) + 15 + 'px';
      this.tooltip.style.top = (this._clientY || 0) - 30 + 'px';
    } else {
      this.tooltip.classList.remove('visible');
    }

    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this._animate);
  }

  start() {
    this._animate();
  }

  stop() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}

// Export skill data for mobile grid
export { SKILLS };