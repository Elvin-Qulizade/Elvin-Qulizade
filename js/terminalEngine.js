/**
 * terminalEngine.js
 * Clean typewriter terminal renderer on canvas.
 * No interactivity — just boot sequence text.
 */

export class TerminalEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.width  = options.width  || 1280;
    this.height = options.height || 800;
    this.canvas.width  = this.width;
    this.canvas.height = this.height;

    this.fontSize   = options.fontSize   || 28;
    this.lineHeight = options.lineHeight || 44;
    this.font       = `${this.fontSize}px 'JetBrains Mono', 'Courier New', monospace`;
    this.padding    = 40;
    this.lines      = [];
    this.currentLine = '';
    this.isTyping    = false;
    this.isDone      = false;
    this.cursorVisible  = true;
    this.cursorInterval = null;
    this.onUpdate    = options.onUpdate || (() => {});
    this.typingSpeed = options.typingSpeed || 30;
  }

  clear() {
    this.lines = [];
    this.currentLine = '';
    this.isTyping = false;
    this.isDone   = false;
    this.render();
  }

  async typeLines(lines, speed) {
    this.isTyping = true;
    this.isDone   = false;
    const s = speed || this.typingSpeed;

    for (let i = 0; i < lines.length; i++) {
      this.currentLine = '';
      const line = lines[i];

      for (let j = 0; j < line.length; j++) {
        this.currentLine += line[j];
        this.render();
        this.onUpdate();
        await this._wait(s + Math.random() * 15);
      }

      this.lines.push(this.currentLine);
      this.currentLine = '';
      this.render();
      this.onUpdate();
      await this._wait(60);
    }

    this.isTyping = false;
    this.isDone   = true;
    this.render();
    this.onUpdate();
  }

  render() {
    const { ctx, width: w, height: h } = this;

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // Scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.012)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    // Title bar
    const barH = 44;
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, w, barH);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, barH - 1, w, 1);

    // Window dots
    [{ x: 22, c: '#ff5f57' }, { x: 44, c: '#ffbd2e' }, { x: 66, c: '#28c840' }].forEach(d => {
      ctx.beginPath();
      ctx.arc(d.x, barH / 2, 7, 0, Math.PI * 2);
      ctx.fillStyle = d.c;
      ctx.fill();
    });

    // Title
    ctx.fillStyle = '#666';
    ctx.font = `14px 'JetBrains Mono', monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText('elvin@baku: ~/portfolio', 90, barH / 2);

    // Terminal text
    ctx.font = this.font;
    ctx.textBaseline = 'top';
    let y = barH + this.padding;

    const maxVisible = Math.floor((h - barH - this.padding * 2) / this.lineHeight);
    const visible = this.lines.length > maxVisible
      ? this.lines.slice(this.lines.length - maxVisible)
      : this.lines;

    for (const line of visible) {
      this._drawLine(ctx, line, this.padding, y);
      y += this.lineHeight;
    }

    // Typing line + cursor
    if (this.currentLine !== '' || this.isTyping) {
      this._drawLine(ctx, this.currentLine, this.padding, y);
      if (this.cursorVisible) {
        const tw = ctx.measureText(this.currentLine).width;
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(this.padding + tw + 3, y + 2, 14, this.fontSize);
      }
    } else if (this.isDone) {
      const prompt = '$ ';
      this._drawLine(ctx, prompt, this.padding, y);
      if (this.cursorVisible) {
        const tw = ctx.measureText(prompt).width;
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(this.padding + tw + 3, y + 2, 14, this.fontSize);
      }
    }

    // CRT vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  _drawLine(ctx, text, x, y) {
    if (text.startsWith('>') || text.startsWith('$')) {
      const pChar = text.charAt(0);
      const rest  = text.slice(1);
      ctx.fillStyle = '#4ade80';
      ctx.fillText(pChar, x, y);
      const pw = ctx.measureText(pChar).width;
      ctx.fillStyle = '#e6e6e6';
      ctx.fillText(rest, x + pw, y);
    } else if (text.startsWith('[')) {
      ctx.fillStyle = '#3b82f6';
      ctx.fillText(text, x, y);
    } else if (text.trimStart().startsWith('user') || text.trimStart().startsWith('role') || text.trimStart().startsWith('location')) {
      const parts = text.split(':');
      if (parts.length >= 2) {
        ctx.fillStyle = '#888';
        ctx.fillText(parts[0] + ':', x, y);
        const kw = ctx.measureText(parts[0] + ':').width;
        ctx.fillStyle = '#60a5fa';
        ctx.fillText(parts.slice(1).join(':'), x + kw, y);
      } else {
        ctx.fillStyle = '#e6e6e6';
        ctx.fillText(text, x, y);
      }
    } else {
      ctx.fillStyle = '#e6e6e6';
      ctx.fillText(text, x, y);
    }
  }

  startCursorBlink() {
    if (this.cursorInterval) return;
    this.cursorInterval = setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
      this.render();
      this.onUpdate();
    }, 530);
  }

  stopCursorBlink() {
    clearInterval(this.cursorInterval);
    this.cursorInterval = null;
    this.cursorVisible = true;
  }

  _wait(ms) { return new Promise(r => setTimeout(r, ms)); }
}