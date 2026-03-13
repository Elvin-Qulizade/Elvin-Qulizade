/**
 * scrollController.js
 * Handles mid-page refresh: syncs laptop state on load,
 * calls ScrollTrigger.refresh() after layout settles.
 */

export class ScrollController {
  constructor(laptopScene) {
    this.laptopScene   = laptopScene;
    this.bootTriggered = false;
    gsap.registerPlugin(ScrollTrigger);
  }

  init() {
    this._setupNav();
    this._setupHeroAnimations();
    this._setupLaptopScroll();
    this._setupSectionReveals();
    this._setupScrollProgress();
    this._setupNavHighlight();

    // ★ Force ScrollTrigger to recalculate after everything loads.
    // This fixes mid-page refresh where triggers have stale positions.
    requestAnimationFrame(() => {
      ScrollTrigger.refresh(true);
    });
    // Also refresh after fonts / images finish loading
    window.addEventListener('load', () => {
      ScrollTrigger.refresh(true);
    });
  }

  _setupNav() {
    const nav = document.getElementById('main-nav');
    ScrollTrigger.create({
      trigger: '#laptop-stage',
      start: 'top center',
      onEnter: () => nav.classList.add('visible'),
    });
    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: () => {
        if (window.scrollY > 80) nav.classList.add('visible');
        else nav.classList.remove('visible');
      },
    });
    // If page already scrolled on load, show nav immediately
    if (window.scrollY > 80) nav.classList.add('visible');
  }

  _setupHeroAnimations() {
    // If user refreshed past the hero, skip the entrance animation
    const pastHero = window.scrollY > window.innerHeight * 0.5;
    if (pastHero) {
      gsap.set(['.hero-greeting', '.hero-name', '.hero-role', '.hero-location', '.hero-cta', '.scroll-indicator'], { opacity: 1, y: 0 });
    } else {
      const tl = gsap.timeline({ delay: 3.2 });
      tl.to('.hero-greeting',    { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
        .to('.hero-name',        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.4')
        .to('.hero-role',        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.4')
        .to('.hero-location',    { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3')
        .to('.hero-cta',         { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3')
        .to('.scroll-indicator', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.2');
    }

    gsap.to('.hero-content', {
      opacity: 0, y: -60, ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });
  }

  _setupLaptopScroll() {
    if (!this.laptopScene) return;
    const stage = document.getElementById('laptop-stage');
    if (!stage) return;

    // ★ Store the trigger so we can read its progress on refresh
    const self = this;

    this.laptopTrigger = ScrollTrigger.create({
      trigger: stage,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      invalidateOnRefresh: true,   // recalculate on refresh
      onUpdate: (trigger) => {
        const p = trigger.progress;

        const lidP = Math.min(1, p / 0.30);
        self.laptopScene.setLidOpen(lidP);
        self.laptopScene.updateCamera(p);

        if (lidP > 0.75 && !self.bootTriggered) {
          self.bootTriggered = true;
          self.laptopScene.playBootSequence();
        }
      },
    });

    // ★ If page was refreshed mid-scroll, immediately sync the laptop state
    // ScrollTrigger.refresh hasn't fired yet, so compute progress manually
    requestAnimationFrame(() => {
      const stageRect = stage.getBoundingClientRect();
      const stageTop = window.scrollY + stageRect.top;
      const stageHeight = stage.offsetHeight - window.innerHeight;
      if (stageHeight > 0) {
        const rawProgress = Math.max(0, Math.min(1, (window.scrollY - stageTop) / stageHeight));
        if (rawProgress > 0) {
          const lidP = Math.min(1, rawProgress / 0.30);
          this.laptopScene.setLidOpen(lidP);
          this.laptopScene.updateCamera(rawProgress);
          if (lidP > 0.75) {
            this.bootTriggered = true;
            // On refresh, skip typing animation — just show final state
            this.laptopScene.terminalPlayed = true;
            this.laptopScene.terminal.lines = [
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
            ];
            this.laptopScene.terminal.isDone = true;
            this.laptopScene.terminal.render();
            this.laptopScene.terminal.startCursorBlink();
            this.laptopScene.screenTexture.needsUpdate = true;
          }
        }
      }
    });
  }

  _setupSectionReveals() {
    gsap.from('.about-photo-wrap', {
      opacity: 0, x: -60, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.section-about', start: 'top 70%' },
    });
    gsap.from('.about-text', {
      opacity: 0, x: 60, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.section-about', start: 'top 70%' },
    });

    document.querySelectorAll('.section-header').forEach(h => {
      gsap.from(h, {
        opacity: 0, y: 40, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: h, start: 'top 80%' },
      });
    });

    ScrollTrigger.create({
      trigger: '.section-projects',
      start: 'top 70%',
      onEnter: () => {
        document.querySelectorAll('.project-card').forEach((card, i) => {
          setTimeout(() => card.classList.add('visible'), i * 100);
        });
      },
    });

    gsap.from('.contact-terminal', {
      opacity: 0, y: 60, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.section-contact', start: 'top 70%' },
    });
  }

  _setupScrollProgress() {
    const bar = document.getElementById('scroll-progress-bar');
    const update = () => {
      const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      bar.style.width = pct + '%';
    };
    window.addEventListener('scroll', update);
    update(); // sync on load
  }

  _setupNavHighlight() {
    ['hero', 'about', 'skills', 'projects', 'contact'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el,
        start: 'top center',
        end: 'bottom center',
        onEnter:     () => this._setActiveNav(id),
        onEnterBack: () => this._setActiveNav(id),
      });
    });
  }

  _setActiveNav(id) {
    document.querySelectorAll('.nav-link').forEach(l =>
      l.classList.toggle('active', l.dataset.section === id)
    );
  }
}