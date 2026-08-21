/**
 * main.js — entry point
 * DOM first (LCP = hero h1, no blocking loader), then Three.js is imported after first paint.
 * ONE renderer, on-demand rendering gated by visibility (see initThree()).
 */

const html = document.documentElement;
const REDUCE = html.classList.contains('reduce-motion');
const DESKTOP_MQ = matchMedia('(min-width: 1024px)');
const HOVER_MQ = matchMedia('(hover: hover) and (pointer: fine)');
const IS_MOBILE = !DESKTOP_MQ.matches;
const isDark = () => html.getAttribute('data-theme') !== 'light';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const hasGsap = () => typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

/* ────────────────────────────────────────────────────────────
   DATA
   ──────────────────────────────────────────────────────────── */
/**
 * PROJECTS — one card per project, every card the same weight. Order = the order they were built.
 *
 * ADDING A PROJECT — don't hand-craft this; run the tool and paste what it prints:
 *
 *     python tools/add-project.py <image> --type Commerce --desc "..." --tech Laravel,MySQL --demo https://…
 *     python tools/add-project.py <image> --insert          # …or let it append the entry itself
 *
 * It decides screenshot vs logo, writes the WebP derivatives, measures `tone` and `brand`,
 * and prints a finished entry. `python tools/add-project.py --help` lists every override.
 *
 * What it produces, and what the CSS then does with it:
 *   screenshot →  assets/img/<key>-640.webp + <key>-1280.webp, no `logo` field.
 *                 Fills the tile edge to edge (object-fit: cover, top-anchored).
 *   logo       →  assets/logos/<name>.svg (vector, preferred) or trimmed transparent WebP.
 *                 sizeLogo() scales each mark to the same painted AREA whatever its aspect ratio,
 *                 so a 6:1 wordmark and a square icon carry equal weight. Two consequences:
 *                 never bake padding into the file, and export SVGs tight to the artwork —
 *                 empty canvas counts as artwork (tools/add-project.py trims it when it can).
 *
 * Fields
 *   key    unique slug; also the assets/img/ filename stem for screenshots
 *   title  card heading
 *   type   one-word category shown in the tile corner (Fintech, Public sector, Commerce …)
 *   desc   ONE sentence, ideally under ~90 characters, so the cards stay level
 *   tech   technologies; these also drive the filter chips (see FILTERS)
 *   demo   public URL — omit it and the card simply carries no "Live" link
 *   logo   path to a transparent logo file (see above); omit for screenshot cards
 *   logo2x optional 1280-wide companion to `logo`; adds a srcset for retina screens
 *   tone   tile ground: omit = graphite (default), 'light' = paper in both themes (dark-ink
 *          logos), 'dark' = graphite in both themes (logos containing white/cream shapes)
 *   brand  the logo's dominant hex; painted as a soft radial wash behind the mark
 */
const PROJECTS = [
  {
    key: 'pashabankipo', title: 'PASHA Capital IPO', type: 'Fintech', logo: 'assets/logos/pasha-capital.svg', tone: 'light', brand: '#0C8052',
    desc: 'IPO subscription platform for a bank’s brokerage — onboarding, allocation and settlement.',
    tech: ['Laravel', 'MySQL', 'JavaScript'], demo: 'https://www.pashacapital.az/trading/pashabankipo'
  },
  {
    key: 'satiram', title: 'Satiram', type: 'Marketplace', logo: 'assets/logos/satiram.svg', brand: '#FF5000',
    desc: 'C2C marketplace with listings, user profiles and built-in messaging.',
    tech: ['Laravel', 'PHP', 'MySQL'], demo: 'https://satiram.az/'
  },
  {
    key: 'bbak', title: 'Baku Bus Terminal', type: 'Governmental', logo: 'assets/logos/bbak.webp', tone: 'light', brand: '#0745AF',
    desc: 'Public site for the international bus terminal — routes, timetables, passenger services.',
    tech: ['Laravel', 'MySQL'], demo: 'https://avtovagzal.az/'
  },


  {
    key: 'roof-academy', title: 'Roof Academy', type: 'Education', logo: 'assets/logos/roof-academy.webp', tone: 'light', brand: '#021C56',
    desc: 'Course management with an interactive mock-exam module.',
    tech: ['Laravel', 'MySQL', 'JavaScript'], demo: 'http://roofacademy.az'
  },
  {
    key: 'smarton-medical', title: 'Smarton Medical', type: 'Healthcare', logo: 'assets/logos/smarton-medical.webp', tone: 'light', brand: '#B2004A',
    desc: 'Catalogue and commerce platform for medical devices and hospital equipment.',
    tech: ['Laravel', 'MySQL', 'JavaScript'], demo: 'https://smartonmedical.az/'
  },
  {
    key: 'smarton', title: 'Smarton', type: 'Commerce',
    logo: 'assets/logos/smarton.svg', brand: '#a40745',
    desc: 'WhatsApp-integrated chatbot that automates customer support.',
    tech: ['Laravel', 'MySQL'], demo: 'https://smarton.az'
  },
  {
    key: 'sotyapman-main', title: 'Sotyapman', type: 'Marketplace',
    logo: 'assets/logos/sotyapman-main.svg', brand: '#FC540C',
    desc: 'C2C marketplace with listings, user profiles and built-in messaging for Uzbekistan.',
    tech: ['Laravel', 'MySQL'], demo: 'http://sotyapman.uz'
  },
  {
    key: 'panorama', title: 'Panorama Travel', type: 'Travel', logo: 'assets/logos/panorama.webp', tone: 'light', brand: '#4DBBE8',
    desc: 'Planning and booking platform for domestic tourism across Azerbaijan.',
    tech: ['Laravel', 'MySQL'], demo: 'https://panorama-travel.az/'
  },
  {
    key: 'khazrisec', title: 'Khazrisec', type: 'Blog', logo: 'assets/logos/khazrisec.webp', brand: '#0CB5D3',
    desc: 'Cybersecurity platform with threat analysis and educational articles.',
    tech: ['Laravel', 'MySQL', 'JavaScript'], demo: 'https://khazrisec.com'
  },
  {
    key: 'drhajili', title: 'Dr. Hajili', type: 'Healthcare',
    logo: 'assets/logos/drhajili.svg', tone: 'light', brand: '#242424',
    desc: 'Clinic site with appointment booking for an aesthetic surgeon.',
    tech: ['Laravel', 'MySQL', 'JavaScript'], demo: 'https://drhajili.de'
  },
  {
    key: 'sulama', title: 'Sulama', type: 'Agriculture', logo: 'assets/logos/sulama.webp', tone: 'light', brand: '#1E9EC2',
    desc: 'Automated irrigation systems catalogue and corporate site.',
    tech: ['Laravel', 'MySQL', 'JavaScript'], demo: 'https://sulama.az/'
  },
  {
    key: 'vion', title: 'Vion Advisory', type: 'Advisory', logo: 'assets/logos/vion.svg', tone: 'light', brand: '#441A7C',
    desc: 'Advisory firm site with conversion-focused landing pages.',
    tech: ['Laravel', 'MySQL'], demo: 'https://vionadvisory.com/'
  },
  {
    key: 'karabakhprogress', title: 'Karabakh Progress', type: 'Public sector', logo: 'assets/logos/karabakh-progress.svg', tone: 'dark', brand: '#126C61',
    desc: 'Landing page for Tech Karabakh Hackathon and World Urban Forum.',
    tech: ['HTML', 'CSS', 'JavaScript'], demo: 'https://karabakhprogress.org/'
  },
  {
    key: 'bsu-examapp', title: 'BSU Exam App', type: 'Education',
    desc: 'Examination platform for Baku State University with automated grading.',
    tech: ['ASP.NET', 'C#', 'SQL Server']
  },
  {
    key: 'flio', title: 'Flio', type: 'Travel',
    desc: 'Flight search and booking interface with fare comparison.',
    tech: ['ASP.NET', 'C#', 'SQL Server', 'JavaScript']
  },
  {
    key: 'ineducation', title: 'InEducation', type: 'Education',
    desc: 'Learning management with enrolment and progress tracking.',
    tech: ['ASP.NET', 'C#', 'SQL Server', 'JavaScript']
  },
  {
    key: 'pustok', title: 'Pustok', type: 'Commerce',
    desc: 'Online bookstore with catalogue, reviews and wishlists.',
    tech: ['ASP.NET', 'C#', 'SQL Server', 'JavaScript']
  },
  {
    key: 'safecam', title: 'SafeCam', type: 'Security',
    desc: 'Surveillance dashboard with real-time alerts and video analytics.',
    tech: ['ASP.NET', 'C#', 'SQL Server', 'JavaScript']
  },
  {
    key: 'gymster', title: 'Gymster', type: 'Fitness',
    desc: 'Gym management with memberships, scheduling and progress reports.',
    tech: ['ASP.NET', 'C#', 'SQL Server', 'JavaScript']
  },
  {
    key: 'eterna', title: 'Eterna', type: 'Commerce',
    desc: 'E-commerce with advanced filtering, cart and secure checkout.',
    tech: ['ASP.NET', 'C#', 'SQL Server', 'JavaScript']
  },
  {
    key: 'boutiqe', title: 'Boutiqe', type: 'Commerce',
    desc: 'Fashion storefront with lookbook, size guide and product pages.',
    tech: ['ASP.NET', 'C#', 'SQL Server', 'JavaScript']
  },
  {
    key: 'impact', title: 'Impact', type: 'Corporate',
    desc: 'Corporate site with content management and an analytics dashboard.',
    tech: ['ASP.NET', 'C#', 'SQL Server', 'JavaScript']
  },
  {
    key: 'zayshop', title: 'Zayshop', type: 'Commerce',
    desc: 'Multi-vendor shopping platform with seller dashboard and orders.',
    tech: ['ASP.NET', 'C#', 'SQL Server', 'JavaScript']
  },
];

// Filter chips — by technology, so no project category outranks another. `match` is checked against `tech`.
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'laravel', label: 'Laravel · PHP', match: ['Laravel', 'PHP'] },
  { id: 'dotnet', label: 'ASP.NET · C#', match: ['ASP.NET', 'C#'] },
  { id: 'sql', label: 'SQL', match: ['MySQL', 'SQL Server'] },
  { id: 'js', label: 'JavaScript', match: ['JavaScript'] },
];

// 12 skills, row-major 3×4 (Backend / Frontend / Data & tools) — same order feeds the ledger and the 3D wall
const SKILLS = [
  { name: 'PHP', icon: 'assets/icons/PHP-logo.svg' },
  { name: 'Laravel', icon: 'assets/icons/Laravel.svg' },
  { name: 'C#', icon: 'assets/icons/c-sharp.svg' },
  { name: '.NET Core', icon: 'assets/icons/NET_Core_Logo.svg' },
  { name: 'HTML5', icon: 'assets/icons/html-5.svg' },
  { name: 'CSS3', icon: 'assets/icons/css3.svg' },
  { name: 'JavaScript', icon: 'assets/icons/javascript.svg' },
  { name: 'Bootstrap', icon: 'assets/icons/bootstrap.svg' },
  { name: 'MySQL', icon: 'assets/icons/mysql.svg' },
  { name: 'SQL Server', icon: 'assets/icons/microsoft-sql-server-logo.svg' },
  { name: 'Git', icon: 'assets/icons/git-logo.svg' },
  { name: 'Python', icon: 'assets/icons/python.svg' },
];
const LEDGER = [
  { label: 'Backend', items: ['PHP', 'Laravel', 'C#', 'ASP.NET Core', 'REST APIs'] },
  { label: 'Frontend', items: ['HTML5', 'CSS3', 'JavaScript', 'Bootstrap', 'Three.js'] },
  { label: 'Data & tools', items: ['MySQL', 'SQL Server', 'Git', 'Python', 'Linux'] },
];

/* ────────────────────────────────────────────────────────────
   DOM RENDER
   ──────────────────────────────────────────────────────────── */
function renderWork() {
  const grid = $('#work-grid');
  grid.innerHTML = PROJECTS.map((p, i) => {
    const idx = String(i + 1).padStart(2, '0');
    const src640 = `assets/img/${p.key}-640.webp`, src1280 = `assets/img/${p.key}-1280.webp`;
    const tileCls = `work-tile ${p.logo ? 'is-logo' : 'is-shot'}${p.tone ? ` tone-${p.tone}` : ''}`;
    const style = p.brand ? ` style="--brand:${p.brand}"` : '';
    // One rule for every logo (SVG or trimmed raster): the CSS sizes and centres it.
    // Screenshots keep the responsive srcset pair.
    const art = p.logo
      ? `<img class="tile-logo" src="${p.logo}" ${p.logo2x
        ? `srcset="${p.logo} 640w, ${p.logo2x} 1280w" sizes="(min-width: 1180px) 15vw, (min-width: 768px) 22vw, 44vw"`
        : ''} loading="lazy" decoding="async" alt="${p.title} logo">`
      : `<img src="${src640}" srcset="${src640} 640w, ${src1280} 1280w"
                 sizes="(min-width: 1180px) 30vw, (min-width: 768px) 45vw, 90vw"
                 width="640" height="400" loading="lazy" decoding="async"
                 alt="Screenshot of ${p.title}">`;
    // The whole card is one link when the project is live; otherwise it is a plain article (same card, no dead link).
    const open = p.demo
      ? `<a class="work-card-link" href="${p.demo}" target="_blank" rel="noopener noreferrer" aria-label="${p.title} — open live site (new tab)">`
      : '<div class="work-card-link">';
    const close = p.demo ? '</a>' : '</div>';
    return `
      <article class="work-card" data-reveal data-tech="${p.tech.join('|')}">
        ${open}
          <span class="${tileCls}"${style}>
            <span class="tile-caption label">${p.type}</span>
            ${art}
          </span>
          <div class="work-head">
            <span class="idx">${idx}</span>
            <h3 class="work-title">${p.title}</h3>
            ${p.demo ? '<span class="work-live">Live <span class="ext" aria-hidden="true">↗</span></span>' : ''}
          </div>
          <span class="work-desc">${p.desc}</span>
          <span class="work-tags">${p.tech.map(t => `<span>${t}</span>`).join('')}</span>
        ${close}
      </article>`;
  }).join('');
}

/**
 * Optical sizing — every logo gets the SAME painted area, whatever its aspect ratio.
 * A width-only cap makes a 6:1 wordmark look tiny next to a square icon (its height, and so its
 * area, collapses). Solving for equal area on a 16:10 tile:  w/W = √(AREA · ratio / 1.6)
 * clamped so nothing spans the tile or shrinks to a dot.
 */
const LOGO_AREA = 0.16;      // share of the tile the mark should cover
const LOGO_W_MIN = 0.26, LOGO_W_MAX = 0.66, LOGO_H_MAX = 0.62;

function sizeLogo(img) {
  const rw = img.naturalWidth, rh = img.naturalHeight;
  if (!rw || !rh) return;                       // ratio unknown → CSS fallback stands
  const ratio = rw / rh;
  let w = Math.sqrt(LOGO_AREA * ratio / 1.6);
  w = Math.min(LOGO_W_MAX, Math.max(LOGO_W_MIN, w));
  const h = w / ratio * 1.6;                    // height as a share of the tile
  if (h > LOGO_H_MAX) w = LOGO_H_MAX * ratio / 1.6;   // very tall mark → let height lead
  img.style.setProperty('--logo-w', (w * 100).toFixed(1) + '%');
}

function sizeLogos(root = document) {
  $$('.tile-logo', root).forEach(img => {
    if (img.complete) sizeLogo(img);
    else img.addEventListener('load', () => sizeLogo(img), { once: true });
  });
}

function initWorkFilters() {
  const box = $('#work-filters'), grid = $('#work-grid'), count = $('#work-count'), status = $('#work-status');
  if (!box || !grid) return;
  const cards = $$('.work-card', grid);
  const total = String(cards.length).padStart(2, '0');
  count.textContent = `${total} / ${total}`;
  const matches = (card, f) => !f.match || f.match.some(t => card.dataset.tech.split('|').includes(t));
  const tally = f => cards.filter(c => matches(c, f)).length;

  box.innerHTML = FILTERS.map((f, i) => `
    <button type="button" class="chip" data-filter="${f.id}" aria-pressed="${i === 0}">
      ${f.label}<span class="chip-n">${tally(f)}</span>
    </button>`).join('');

  box.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const f = FILTERS.find(x => x.id === btn.dataset.filter);
    $$('.chip', box).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    let shown = 0;
    cards.forEach((card, i) => {
      const on = matches(card, f);
      card.hidden = !on;
      if (on) { card.style.transitionDelay = `${Math.min(shown, 8) * 40}ms`; shown++; }
    });
    count.textContent = `${String(shown).padStart(2, '0')} / ${total}`;
    status.textContent = `${shown} of ${cards.length} projects shown — ${f.label}`;
  });
}

function renderLedger() {
  $('#ledger').innerHTML = LEDGER.map(r => `
    <li><span class="label">${r.label}</span><span class="items">${r.items.map(i => `<span>${i}</span>`).join('')}</span></li>
  `).join('');
}

/* ────────────────────────────────────────────────────────────
   UI: theme, nav, menu, clock, reveals, micro-interactions
   ──────────────────────────────────────────────────────────── */
const themeListeners = [];
function initTheme() {
  const btn = $('#theme-toggle');
  const apply = (theme) => {
    html.setAttribute('data-theme', theme);
    const light = theme === 'light';
    btn.setAttribute('aria-pressed', String(light));
    btn.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    themeListeners.forEach(fn => fn(!light));
  };
  apply(html.getAttribute('data-theme'));
  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch (e) { }
    apply(next);
  });
}

function initNav() {
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // active link
  const links = $$('.nav-link');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(l => l.classList.toggle('active', l.dataset.section === e.target.id));
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
  ['work', 'about', 'stack', 'contact'].forEach(id => { const el = document.getElementById(id); el && io.observe(el); });

  // mobile menu
  const burger = $('#hamburger'), menu = $('#mobile-menu');
  const setOpen = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('open', open);
    menu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
  $$('.mobile-link', menu).forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) { setOpen(false); burger.focus(); } });

  // mobile thumb bar: visible once the hero has scrolled away
  const bar = $('#mobile-bar');
  const hero = $('#hero');
  new IntersectionObserver((es) => bar.classList.toggle('show', !es[es.length - 1].isIntersecting), { threshold: 0.05 }).observe(hero);
}

function initAnchors() {
  // In-page links: JS smooth scroll (CSS scroll-behavior:smooth is off — see initThree / styles.css)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    // a pinned target (#hero inside ScrollTrigger's .pin-spacer) is position:fixed — scroll to its spacer instead
    const box = target.closest('.pin-spacer') || target;
    window.scrollTo({ top: box.getBoundingClientRect().top + window.scrollY, behavior: REDUCE ? 'auto' : 'smooth' });
    history.pushState(null, '', a.getAttribute('href'));
  });
}

function initClock() {
  const els = [$('#local-time'), $('#footer-time')].filter(Boolean);
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Baku' });
  const tick = () => { const t = fmt.format(new Date()); els.forEach(el => el.textContent = t); };
  tick(); setInterval(tick, 30000);
}

function initReveals() {
  // Hero: masked line reveals on load (fonts may still be swapping — that's fine, transform only)
  const spans = $$('.hero-copy .reveal > span');
  if (hasGsap() && !REDUCE) {
    // h1 is the LCP element: it is painted immediately and only drifts up (no opacity/clip)
    gsap.from('.hero-name .hero-line', { y: 28, duration: 1.1, ease: 'expo.out', stagger: 0.06 });
    gsap.to(spans, {
      y: 0, duration: 1.0, ease: 'expo.out', stagger: 0.08, delay: 0.15,
      onComplete: () => spans.forEach(s => s.parentElement.classList.add('in'))
    });
  } else {
    spans.forEach(s => s.parentElement.classList.add('in'));
  }
  // Sections: IntersectionObserver → .in (CSS transition), staggered per entering batch
  let batch = 0, batchReset;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      // stagger within the batch that just entered, not the whole grid (cards 9+ would all sit at the cap)
      const i = batch++;
      clearTimeout(batchReset); batchReset = setTimeout(() => { batch = 0; }, 200);
      el.style.transitionDelay = `${Math.min(i, 6) * 60}ms`;
      el.classList.add('in');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  $$('[data-reveal]').forEach(el => io.observe(el));
}

function initMicro() {
  if (!HOVER_MQ.matches || REDUCE || !hasGsap()) return;
  // Magnetic CTAs
  $$('[data-magnetic]').forEach(el => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
  // Card tilt ≤ 6°
  $$('.work-card').forEach(card => {
    const tile = $('.work-tile', card);
    if (!tile) return;
    const rx = gsap.quickTo(tile, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(tile, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    card.addEventListener('pointermove', (e) => {
      const r = tile.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      rx(-py * 6); ry(px * 6);
    });
    card.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });
}

/* ────────────────────────────────────────────────────────────
   THREE — imported after first paint. One renderer, gated rendering.
   ──────────────────────────────────────────────────────────── */
async function initThree() {
  const canvas = $('#gl');
  const nav = navigator;
  const lowEnd = (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.connection && nav.connection.saveData);
  let gl;
  try {
    const glMod = await import('./js/gl.js');
    if (!glMod.supportsWebGL2() || lowEnd) { document.body.classList.add('no-3d'); return; }
    const [{ HeroScene }, { SkillsScene }] = await Promise.all([import('./js/heroScene.js'), import('./js/skillsScene.js')]);
    // the mobile scene is scissored into a ~350×300 box (≈1/3 of the viewport), so DPR 1.5 still costs less
    // than the old full-screen DPR 1 pass — and the screen texture stays sharp on 2–3× phones.
    gl = glMod.createGL(canvas, { dprCap: 1.5 });

    const hero = new HeroScene({ renderer: gl.renderer, env: gl.env, isMobile: IS_MOBILE, isDark: isDark(), reduce: REDUCE, stage: $('.hero-stage') });
    const stage = $('#skills-stage');
    const skills = (!IS_MOBILE && stage) ? new SkillsScene({
      renderer: gl.renderer, env: gl.env, skills: SKILLS, stage, tooltip: $('#skill-tooltip'), isDark: isDark(), reduce: REDUCE,
    }) : null;
    if (!skills && stage) stage.classList.add('no-3d'); // 768–1023px loads: no wall → don't leave a 420px empty block
    themeListeners.push(dark => { hero.setTheme(dark); skills && skills.setTheme(dark); });

    /* visibility gating */
    const heroEl = $('#hero');
    let heroIn = heroEl.getBoundingClientRect().bottom > 0, skillsIn = false, needClear = false; // sync guess until the IO fires
    // NB: entries can be batched (enter+leave between two deliveries) — the LAST entry is the current state
    new IntersectionObserver((es) => { heroIn = es[es.length - 1].isIntersecting; hero.dirty = true; }, { threshold: 0 }).observe(heroEl);
    if (skills) new IntersectionObserver((es) => { skillsIn = es[es.length - 1].isIntersecting; skills.dirty = true; }, { threshold: 0 }).observe(stage);

    if (IS_MOBILE) window.addEventListener('scroll', () => { hero.dirty = true; }, { passive: true });

    /* pointer parallax (desktop) */
    if (!IS_MOBILE && !REDUCE) {
      window.addEventListener('pointermove', (e) => {
        hero.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
      }, { passive: true });
    }

    /* resize */
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { gl.resize(); hero.resize(gl.W(), gl.H()); hero.dirty = true; if (skills) skills.dirty = true; }, 120);
    });

    /* scroll choreography */
    const S = hero.state;
    let scrubActive = false;
    const pastHero = window.scrollY > window.innerHeight * 0.4;
    // Canvas opacity = CV.intro (one-shot fade-in) × CV.scrub (scroll fade-out). Only frame() writes the style.
    // (Tweening canvas.style.opacity directly is unsafe: ScrollTrigger renders the timeline forward+back on refresh,
    // so a fromTo/to on the element records its start value while the canvas is still at CSS opacity 0.)
    const CV = { intro: 0, scrub: 1 };
    if (hasGsap()) {
      gsap.registerPlugin(ScrollTrigger);
      // NB: styles.css must NOT set `scroll-behavior: smooth` — ScrollTrigger measures pinned triggers by scrolling
      // to 0 and back; a CSS-smoothed scroll is asynchronous, so a trigger created on an already-scrolled page
      // (mid-page reload, #hash deep link) computed start = -scrollY and the hero never pinned again.
      if (!IS_MOBILE && !REDUCE) {
        // Build the timeline first, then attach the trigger. `gsap.timeline({ scrollTrigger })` on an empty timeline
        // makes ScrollTrigger defer its first refresh a tick — and with pin:true that deferred refresh measures the
        // start relative to the wrong scroll position when the page is already scrolled (mid-page reload / #hash
        // deep link): start ended up at -scrollY, the hero stayed translated to its pin-end and never pinned again.
        const tl = gsap.timeline({ defaults: { ease: 'none' } });
        tl.to(S, { cx: -1.6, cy: 2.0, cz: 6.6, tx: -0.5, ty: 0.9, tz: -0.3, fov: 30, lid: 78, duration: 0.25 }, 0)
          .to(['.hero-copy', '.hero-foot', '.hero-rail'], { opacity: 0, y: -40, duration: 0.22 }, 0)
          .to(S, { cx: 0, cy: 1.6, cz: 5.4, tx: 0, ty: 1.05, tz: -0.5, fov: 30, lid: 108, duration: 0.25 }, 0.25)
          .to(S, { cx: 0, cy: 1.4, cz: 4.4, tx: 0, ty: 1.15, tz: -0.7, fov: 28, duration: 0.25 }, 0.5)
          .to(S, { mix: 1, duration: 0.12 }, 0.55)
          .to(CV, { scrub: 0, duration: 0.1 }, 0.9);
        ScrollTrigger.create({
          animation: tl, trigger: '#hero', start: 'top top', end: '+=160%', pin: true, scrub: 0.8, anticipatePin: 1,
          onUpdate: () => { hero.dirty = true; },
          onToggle: (st) => { scrubActive = st.isActive; },
        });
      } else {
        // Mobile / reduced motion: static pose, no pin. Canvas fades as the hero scrolls away.
        gsap.to(CV, {
          scrub: 0, ease: 'none',
          scrollTrigger: { trigger: '#hero', start: '40% top', end: 'bottom top', scrub: true, onUpdate: () => { hero.dirty = true; } },
        });
        if (REDUCE) { S.lid = 100; S.mix = 1; }
      }
      // Skills wall: rows slide in once, gentle yaw with scroll
      if (skills) {
        // onEnter does not fire when the page loads *below* #stack (only onEnterBack does on the way up)
        const enterWall = () => { if (!REDUCE && skills.enter < 1) gsap.to(skills, { enter: 1, duration: 1.4, ease: 'expo.out', overwrite: true, onUpdate: () => { skills.dirty = true; } }); };
        ScrollTrigger.create({
          trigger: '#stack', start: 'top bottom', end: 'bottom top', scrub: true,
          onUpdate: (st) => { skills.progress = st.progress; skills.dirty = true; },
          onEnter: enterWall, onEnterBack: enterWall,
        });
      }
    }

    /* intro + boot */
    const startBoot = () => hero.playBoot();
    if (pastHero || REDUCE) {
      hero.intro.p = 1;
      hero.finishBoot();
    } else if (hasGsap()) {
      gsap.to(hero.intro, { p: 1, duration: 1.6, ease: 'expo.out', delay: 0.35, onUpdate: () => { hero.dirty = true; } });
      setTimeout(startBoot, 1200);
    } else {
      hero.intro.p = 1; startBoot();
    }
    if (IS_MOBILE && !REDUCE) {
      // timed crossfades on mobile (no scrub)
      setTimeout(() => hasGsap() && gsap.to(S, { mix: 1, duration: 1, ease: 'power2.inOut', onUpdate: () => { hero.dirty = true; } }), 8000);
    }

    /* the ONE render loop — driven by gsap.ticker when present */
    let lastHero = 0, lastSkills = 0, faded = false, lastAlpha = -1;
    const IDLE = 1 / 30;
    const setAlpha = (a) => { if (a !== lastAlpha) { lastAlpha = a; canvas.style.opacity = a; } };
    const fadeIn = () => {
      if (hasGsap()) gsap.to(CV, { intro: 1, duration: 0.9, ease: 'power2.out' }); else CV.intro = 1;
    };
    const frame = (time, deltaMs) => {
      if (document.hidden) return;
      const dt = Math.min(0.05, (deltaMs || 16.7) / 1000);
      if (heroIn) {
        hero.update(dt, time);
        setAlpha(CV.intro * CV.scrub);
        const active = hero.dirty || scrubActive;
        if (lastAlpha <= 0 && faded) {
          // fully faded out (e.g. the tail of the pinned range, or reload past the hero): nothing to show
          if (needClear) { gl.clear(); needClear = false; }
        } else if (active || time - lastHero >= IDLE) {
          gl.clear(); hero.render(); lastHero = time; needClear = true;
          if (active) gl.sample(deltaMs, () => hero.resize(gl.W(), gl.H()));
          if (!faded) { faded = true; fadeIn(); }
        }
      } else if (skillsIn && skills) {
        setAlpha(1); // shared canvas: the wall is always fully visible
        skills.update(dt, time);
        if (skills.dirty || time - lastSkills >= IDLE) { gl.clear(); skills.render(); lastSkills = time; needClear = true; }
      } else if (needClear) {
        gl.clear(); needClear = false;
      }
    };
    if (hasGsap()) {
      gsap.ticker.add(frame);
    } else {
      let last = performance.now();
      const loop = (now) => { frame(now / 1000, now - last); last = now; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { hero.dirty = true; if (skills) skills.dirty = true; } });
  } catch (err) {
    console.warn('[3D] disabled:', err);
    document.body.classList.add('no-3d');
    if (gl && gl.renderer) gl.renderer.dispose();
  }
}

/* ────────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────────── */
function init() {
  renderWork();
  sizeLogos();
  initWorkFilters();
  renderLedger();
  initTheme();
  initNav();
  initAnchors();
  initClock();
  initReveals();
  initMicro();

  // Three.js after first paint (never blocks LCP)
  requestAnimationFrame(() => setTimeout(initThree, 0));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
