/**
 * screenPainter.js
 * Paints the two 1024×640 canvases shown on the laptop screen:
 *   A) boot terminal (typed progressively) and B) a stats card.
 * The scene cross-fades between them in a shader — no per-frame uploads after boot.
 */

export const SCREEN_W = 1024;
export const SCREEN_H = 640;

const C = {
  bg: '#0B0D11',
  bar: '#12151B',
  hair: 'rgba(237,234,227,0.10)',
  text: '#DDE7F0',
  dim: '#8C93A0',
  mute: '#5C626E',
  accent: '#E0A458',
  green: '#7CD992',
  blue: '#7FB4E8',
};

const MONO = '"Geist Mono", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const SANS = '"Geist", system-ui, -apple-system, "Segoe UI", sans-serif';

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = SCREEN_W; c.height = SCREEN_H;
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function titleBar(ctx, title, right) {
  ctx.fillStyle = C.bar;
  ctx.fillRect(0, 0, SCREEN_W, 44);
  ctx.fillStyle = C.hair;
  ctx.fillRect(0, 44, SCREEN_W, 1);
  [['#FF5F57', 24], ['#FEBC2E', 46], ['#28C840', 68]].forEach(([col, x]) => {
    ctx.beginPath(); ctx.arc(x, 22, 6, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
  });
  ctx.font = `13px ${MONO}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.mute;
  ctx.fillText(title, 96, 22);
  if (right) {
    ctx.textAlign = 'right';
    ctx.fillText(right, SCREEN_W - 24, 22);
    ctx.textAlign = 'left';
  }
}

/* ────────────────────────────────────────────────────────────
   A) BOOT TERMINAL
   ──────────────────────────────────────────────────────────── */
export const BOOT_LINES = [
  { t: '$ whoami', k: 'cmd' },
  { t: 'elvin qulizada — full-stack developer · baku', k: 'out' },
  { t: '$ ls ~/work', k: 'cmd' },
  { t: 'pasha-capital-ipo/  bbak/  karabakh-progress/  satiram/', k: 'out' },
  { t: 'roof-academy/  smarton-medical/  panorama-travel/  … 21 total', k: 'out' },
  { t: '$ stack --list', k: 'cmd' },
  { t: 'laravel · php · asp.net · c# · mysql · sql server · js', k: 'out' },
  { t: '$ deploy pasha-ipo --prod', k: 'cmd' },
  { t: '✓ migrations   ✓ tests 142/142   ✓ build 38ms', k: 'ok' },
  { t: '[OK] live — 200 OK', k: 'tag' },
];

export class BootPainter {
  constructor() {
    this.canvas = makeCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.fontSize = 24;
    this.lineH = 40;
    this.pad = 40;
    this.top = 44 + 36;
    this.shown = [];        // completed lines
    this.current = null;    // { line, n }
    this.done = false;
    this.cursorUV = { x: 0, y: 0, w: 0, h: 0 };
    this.paint();
  }

  paint() {
    const { ctx } = this;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    titleBar(ctx, 'elvin@baku: ~', 'zsh');

    ctx.font = `${this.fontSize}px ${MONO}`;
    ctx.textBaseline = 'top';
    let y = this.top;
    const drawLine = (line, n) => {
      const text = n == null ? line.t : line.t.slice(0, n);
      let x = this.pad;
      if (line.k === 'cmd') {
        ctx.fillStyle = C.accent; ctx.fillText('$', x, y);
        x += ctx.measureText('$').width;
        ctx.fillStyle = C.text; ctx.fillText(text.slice(1), x, y);
        x += ctx.measureText(text.slice(1)).width;
      } else if (line.k === 'ok') {
        ctx.fillStyle = C.green; ctx.fillText(text, x, y); x += ctx.measureText(text).width;
      } else if (line.k === 'tag') {
        ctx.fillStyle = C.blue; ctx.fillText(text, x, y); x += ctx.measureText(text).width;
      } else {
        ctx.fillStyle = C.dim; ctx.fillText(text, x, y); x += ctx.measureText(text).width;
      }
      return x;
    };
    for (const line of this.shown) { drawLine(line); y += this.lineH; }
    let cx = this.pad, cy = y;
    if (this.current) { cx = drawLine(this.current.line, this.current.n); }
    else if (this.done) {
      ctx.fillStyle = C.accent; ctx.fillText('$', this.pad, y);
      cx = this.pad + ctx.measureText('$ ').width;
    }
    // Cursor rect in UV (flipped y for texture space) — drawn as a blinking block by the shader
    const cw = 13, ch = this.fontSize + 2;
    this.cursorUV = { x: (cx + 3) / SCREEN_W, y: 1 - (cy + ch / 2) / SCREEN_H, w: cw / SCREEN_W, h: ch / SCREEN_H };
  }

  /** Types all lines; calls onUpdate after each repaint. Resolves when done. */
  async type(onUpdate, speed = 16) {
    for (const line of BOOT_LINES) {
      if (line.k === 'cmd') {
        for (let n = 1; n <= line.t.length; n++) {
          this.current = { line, n };
          this.paint(); onUpdate();
          await wait(speed + Math.random() * 14);
        }
        await wait(140);
      } else {
        this.current = { line, n: line.t.length };
        this.paint(); onUpdate();
        await wait(line.k === 'ok' ? 260 : 90);
      }
      this.shown.push(line);
      this.current = null;
    }
    this.done = true;
    this.paint(); onUpdate();
  }

  /** Jump straight to the finished state (mid-page refresh, reduced motion). */
  finish() {
    this.shown = BOOT_LINES.slice();
    this.current = null;
    this.done = true;
    this.paint();
  }
}

/* ────────────────────────────────────────────────────────────
   B) STATS CARD
   ──────────────────────────────────────────────────────────── */
export function paintStats() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  titleBar(ctx, 'elvin.dev — profile', '2026');

  ctx.textBaseline = 'top';
  ctx.font = `12px ${MONO}`; ctx.fillStyle = C.mute;
  ctx.fillText('FULL-STACK DEVELOPER · BAKU, AZERBAIJAN', 56, 88);
  ctx.font = `500 44px ${SANS}`; ctx.fillStyle = C.text;
  ctx.fillText('Elvin Qulizada', 56, 112);
  ctx.font = `16px ${SANS}`; ctx.fillStyle = C.dim;
  ctx.fillText('Systems behind financial platforms, public infrastructure and commerce.', 56, 172);

  const stats = [['21', 'PROJECTS'], ['11', 'LIVE SITES'], ['02', 'CORE STACKS']];
  const colW = (SCREEN_W - 112) / 3;
  stats.forEach(([n, l], i) => {
    const x = 56 + i * colW, y = 260;
    ctx.fillStyle = C.hair; ctx.fillRect(x, y, colW - 24, 1);
    ctx.font = `500 72px ${MONO}`; ctx.fillStyle = i === 0 ? C.accent : C.text;
    ctx.fillText(n, x, y + 24);
    ctx.font = `11px ${MONO}`; ctx.fillStyle = C.mute;
    ctx.fillText(l, x, y + 112);
  });

  // stack row
  ctx.fillStyle = C.hair; ctx.fillRect(56, 440, SCREEN_W - 112, 1);
  ctx.font = `11px ${MONO}`; ctx.fillStyle = C.mute; ctx.fillText('STACK', 56, 462);
  ctx.font = `14px ${MONO}`; ctx.fillStyle = C.text;
  const items = ['Laravel', 'PHP', 'ASP.NET', 'C#', 'MySQL', 'SQL Server', 'JavaScript'];
  let x = 56;
  items.forEach((s, i) => {
    if (i) { ctx.fillStyle = C.accent; ctx.fillText('·', x, 486); x += 22; }
    ctx.fillStyle = C.text; ctx.fillText(s, x, 486); x += ctx.measureText(s).width + 16;
  });
  ctx.font = `12px ${MONO}`; ctx.fillStyle = C.mute;
  ctx.fillText('AVAILABLE FOR FREELANCE & FULL-TIME — BAKU / REMOTE · GMT+4', 56, 556);
  ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(SCREEN_W - 64, 562, 5, 0, Math.PI * 2); ctx.fill();
  return canvas;
}

/* ────────────────────────────────────────────────────────────
   Keyboard deck texture (map + bump)
   ──────────────────────────────────────────────────────────── */
export function paintKeyboard(isDark) {
  const w = 1024, h = 512;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const deck = isDark ? '#0F1116' : '#AEB1B8';
  const key = isDark ? '#181B21' : '#CDD0D6';
  const edge = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.65)';
  const shadow = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.18)';
  ctx.fillStyle = deck; ctx.fillRect(0, 0, w, h);
  const cols = 15, rows = 6, gap = 8;
  const kw = (w - 60 - gap * (cols - 1)) / cols;
  const kh = (h - 60 - gap * (rows - 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      let x = 30 + col * (kw + gap), y = 30 + r * (kh + gap), ww = kw;
      if (r === rows - 1 && col >= 4 && col <= 9) { if (col > 4) continue; ww = kw * 6 + gap * 5; } // spacebar
      roundRect(ctx, x, y + 2, ww, kh, 6); ctx.fillStyle = shadow; ctx.fill();
      roundRect(ctx, x, y, ww, kh, 6); ctx.fillStyle = key; ctx.fill();
      ctx.fillStyle = edge; ctx.fillRect(x + 6, y + 1, ww - 12, 1);
    }
  }
  return c;
}

/* ── radial sprite for glows / particles / contact shadow ── */
export function paintRadial(size = 256, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', stop = 0.55) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(stop, inner.replace(/,1\)$/, ',0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return c;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
