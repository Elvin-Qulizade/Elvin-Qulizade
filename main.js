/**
 * main.js — Portfolio entry point
 */

import { LaptopScene } from './js/sceneLaptop.js';
import { SkillsScene, SKILLS } from './js/sceneSkills.js';
import { ScrollController } from './js/scrollController.js';

const IS_MOBILE = window.innerWidth < 768;

const PROJECTS = [
  { title: 'Satiram', desc: 'Marketplace platform for buying and selling goods with user profiles and messaging.', tech: ['Laravel', 'PHP', 'MySQL'], image: 'assets/projects/satiram.jpeg', github: '#', demo: 'https://satiram.az/' },
  { title: 'BBAK', desc: 'A website developed for Baku International Bus Terminal Complex, providing information and services related to transportation and passenger facilities.', tech: ['Laravel', 'PHP', 'MySQL'], image: 'assets/projects/bbak.png', github: '#', demo: 'https://avtovagzal.az/' },
  { title: 'Panorama', desc: 'Panorama-travel.az is a dedicated online platform offering comprehensive travel planning and booking services exclusively for domestic tourism across Azerbaijan.', tech: ['Laravel', 'PHP', 'MySQL'], image: 'assets/projects/panorama.png', github: '#', demo: 'https://panorama-travel.az/' },
  { title: 'Vion', desc: 'Modern SaaS landing page with animated sections and conversion-optimized design.', tech: ['Laravel', 'PHP', 'MySQL'], image: 'assets/projects/vion.PNG', github: '#', demo: 'https://vionadvisory.com/' },
  { title: 'Karabakh Progress', desc: 'Platform showcasing rebuilding progress in the Karabakh region with real-time updates and data visualization.', tech: ['HTML5', 'CSS3', 'JavaScript'], image: 'assets/projects/karabakhprogress.PNG', github: '#', demo: 'https://karabakhprogress.org/' },
  { title: 'BSU Exam App', desc: 'Digital examination platform for Baku State University with automated grading and analytics.', tech: ['ASP.NET', 'C#', 'SQL Server', 'Bootstrap', 'Windows Form Applications'], image: 'assets/projects/BSU-ExamApp.jpeg', github: '#', demo: '#' },
  { title: 'Flio', desc: 'Modern travel and flight booking platform with intuitive UI and search capabilities.', tech: ['ASP.NET', 'C#', 'SQL Server','HTML5', 'CSS3', 'JavaScript'], image: 'assets/projects/flio.PNG', github: '#', demo: '#' },
  { title: 'InEducation', desc: 'Learning management system with course creation, enrollment, and progress tracking.', tech: ['ASP.NET', 'C#', 'SQL Server','HTML5', 'CSS3', 'JavaScript'], image: 'assets/projects/ineducation.JPG', github: '#', demo: '#' },
  { title: 'Pustok', desc: 'Online bookstore with catalog management, reviews, and wishlist functionality.', tech: ['ASP.NET', 'C#', 'SQL Server','HTML5', 'CSS3', 'JavaScript'], image: 'assets/projects/pustok.PNG', github: '#', demo: '#' },
  { title: 'SafeCam', desc: 'Intelligent surveillance system with real-time alerts, video analytics, and monitoring dashboard.', tech: ['ASP.NET', 'C#', 'SQL Server','HTML5', 'CSS3', 'JavaScript'], image: 'assets/projects/safecam.PNG', github: '#', demo: '#' },
  { title: 'Gymster', desc: 'Gym management and fitness tracking app with membership scheduling and progress reports.', tech: ['ASP.NET', 'C#', 'SQL Server','HTML5', 'CSS3', 'JavaScript'], image: 'assets/projects/gymster.PNG', github: '#', demo: '#' },
  { title: 'Eterna', desc: 'E-commerce platform with advanced product filtering, cart management, and secure checkout.', tech: ['ASP.NET', 'C#', 'SQL Server','HTML5', 'CSS3', 'JavaScript'], image: 'assets/projects/eterna.PNG', github: '#', demo: '#' },
  { title: 'Boutiqe', desc: 'Fashion e-commerce site with lookbook, size guide, and product showcases.', tech: ['ASP.NET', 'C#', 'SQL Server','HTML5', 'CSS3', 'JavaScript'], image: 'assets/projects/boutiqe.PNG', github: '#', demo: '#' },
  { title: 'Impact', desc: 'Corporate website with dynamic content management and analytics dashboard.', tech: ['ASP.NET', 'C#', 'SQL Server','HTML5', 'CSS3', 'JavaScript'], image: 'assets/projects/impact.PNG', github: '#', demo: '#' },
  { title: 'Zayshop', desc: 'Multi-vendor shopping platform with seller dashboard and order management system.', tech: ['ASP.NET', 'C#', 'SQL Server','HTML5', 'CSS3', 'JavaScript'], image: 'assets/projects/zayshop.PNG', github: '#', demo: '#' },
];

/* ── Loading ── */
function dismissLoader() {
  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('hidden');
    document.body.style.overflow = '';
  }, 3000);
}

/* ── Theme ── */
function initTheme() {
  const toggle = document.getElementById('theme-toggle');
  const html = document.documentElement;
  const saved = localStorage.getItem('theme') || 'dark';
  html.setAttribute('data-theme', saved);

  toggle.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
}

/* ── Mobile nav ── */
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });
  mobileMenu.querySelectorAll('.mobile-link').forEach(l => {
    l.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });
}

/* ── Render projects ── */
function renderProjects() {
  document.getElementById('projects-grid').innerHTML = PROJECTS.map(p => `
    <div class="project-card">
      <div class="project-card-img">
        <img src="${p.image}" alt="${p.title}" loading="lazy">
      </div>
      <div class="project-card-body">
        <h3 class="project-card-title">${p.title}</h3>
        <p class="project-card-desc">${p.desc}</p>

        <div class="project-card-tech">
          ${p.tech.map(t => `<span class="tech-tag">${t}</span>`).join('')}
        </div>

        <div class="project-card-links">
          ${p.github !== "#" ? `
            <a href="${p.github}" target="_blank">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
              </svg> Code
            </a>
          ` : ""}

          ${p.demo !== "#" ? `
            <a href="${p.demo}" target="_blank">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg> Live
            </a>
          ` : ""}
        </div>
      </div>
    </div>
  `).join('');
}

/* ── Skills grid (mobile) ── */
function renderSkillsGrid() {
  document.getElementById('skills-grid').innerHTML = SKILLS.map(s => `
    <div class="skill-card"><img src="${s.icon}" alt="${s.name}" loading="lazy"><span>${s.name}</span></div>
  `).join('');
}

/* ── Visibility observer ── */
function observe(el, cb) {
  new IntersectionObserver(entries => entries.forEach(e => cb(e.isIntersecting)), { threshold: 0.05 }).observe(el);
}

/* ── INIT ── */
async function init() {
  document.body.style.overflow = 'hidden';
  initTheme();
  initMobileNav();
  renderProjects();
  renderSkillsGrid();
  dismissLoader();

  if (!IS_MOBILE) {
    const canvas = document.getElementById('webgl-canvas');
    const laptopScene = new LaptopScene(canvas);
    laptopScene.start();
    observe(canvas, v => { laptopScene.isVisible = v; });

    const skillsContainer = document.getElementById('skills-3d-container');
    const skillsScene = new SkillsScene(skillsContainer);
    skillsScene.start();
    observe(skillsContainer, v => { skillsScene.isVisible = v; });

    const scroll = new ScrollController(laptopScene);
    scroll.init();
  } else {
    new ScrollController(null).init();
  }

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const t = document.querySelector(a.getAttribute('href'));
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();