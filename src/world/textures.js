import * as THREE from 'three';
import { RAINBOW } from './materials.js';

/*
 * Pictures drawn with the 2D canvas at startup: floor tiles, chalkboard,
 * alphabet banner, posters, clock face, window view, rug. No image files.
 */

const FONT = '"Nunito", "Baloo 2", "Roboto", "Arial Rounded MT Bold", sans-serif';
const CHALK_FONT = '"Chalkboard SE", "Comic Sans MS", "Comic Neue", "Nunito", "Roboto", sans-serif';

function makeTexture(width, height, draw, { repeat = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
}

function text(ctx, str, x, y, { size = 40, color = '#3a2e5c', font = FONT, weight = 900, align = 'center' } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function star(ctx, x, y, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function heart(ctx, x, y, s, color) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.45, y - s, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Two-tone tiles; each canvas holds 2x2 tiles. */
export function floorTexture(repeat) {
  return makeTexture(256, 256, (ctx) => {
    const colors = ['#fde9c9', '#f6d5a6'];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      ctx.fillStyle = colors[(x + y) % 2];
      ctx.fillRect(x * 128, y * 128, 128, 128);
    }
    ctx.strokeStyle = 'rgba(190, 140, 80, 0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(256, i * 128); ctx.stroke();
    }
  }, { repeat });
}

/**
 * The chalkboard. Returns the canvas too, so later versions can draw on it
 * (writing on the chalkboard) and set texture.needsUpdate = true.
 */
export function boardTexture() {
  let canvas;
  const texture = makeTexture(1024, 346, (ctx, w, h) => {
    canvas = ctx.canvas;
    ctx.fillStyle = '#2f7d5b';
    ctx.fillRect(0, 0, w, h);
    // chalk dust smudges
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.beginPath();
      ctx.ellipse((i * 157) % w, (i * 89) % h, 90, 30, i, 0, Math.PI * 2);
      ctx.fill();
    }
    const chalk = (str, x, y, size, color) => {
      ctx.globalAlpha = 0.5;
      text(ctx, str, x + 1.5, y + 1, { size, color, font: CHALK_FONT, weight: 700 });
      ctx.globalAlpha = 0.9;
      text(ctx, str, x, y, { size, color, font: CHALK_FONT, weight: 700 });
      ctx.globalAlpha = 1;
    };
    chalk('Good morning, class!', w / 2, 120, 76, '#ffffff');
    chalk('Today is a great day ☺', w / 2, 225, 44, '#fff3a6');
    // doodles: sun and flower
    ctx.strokeStyle = 'rgba(255, 224, 102, 0.9)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(930, 70, 30, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(930 + Math.cos(a) * 42, 70 + Math.sin(a) * 42);
      ctx.lineTo(930 + Math.cos(a) * 58, 70 + Math.sin(a) * 58);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 170, 200, 0.9)';
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      ctx.beginPath(); ctx.arc(90 + Math.cos(a) * 22, 270 + Math.sin(a) * 22, 16, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(160, 230, 160, 0.9)';
    ctx.beginPath(); ctx.moveTo(90, 300); ctx.lineTo(90, 340); ctx.stroke();
  });
  return { texture, canvas };
}

/** Alphabet cards hanging on a string. */
export function alphabetTexture() {
  return makeTexture(2048, 172, (ctx, w, h) => {
    const n = 26;
    const cw = w / n;
    ctx.strokeStyle = '#8a6a4a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 14);
    for (let i = 0; i <= n; i++) ctx.quadraticCurveTo(i * cw - cw / 2, 26, i * cw, 14);
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const x = i * cw + 4;
      ctx.fillStyle = RAINBOW[i % RAINBOW.length];
      ctx.beginPath();
      ctx.roundRect(x, 20, cw - 8, h - 26, 12);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(x + (cw - 8) / 2, 30, 5, 0, Math.PI * 2); ctx.fill();
      const letter = String.fromCharCode(65 + i);
      text(ctx, letter, i * cw + cw / 2, 88, { size: 64, color: '#ffffff' });
      text(ctx, letter.toLowerCase(), i * cw + cw / 2, 140, { size: 36, color: 'rgba(255,255,255,0.85)' });
    }
  });
}

export function clockTexture() {
  return makeTexture(256, 256, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 60; i++) {
      const a = (i * Math.PI) / 30;
      const big = i % 5 === 0;
      ctx.strokeStyle = big ? '#3a2e5c' : '#b9b0cc';
      ctx.lineWidth = big ? 6 : 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.sin(a) * (c - 8), c - Math.cos(a) * (c - 8));
      ctx.lineTo(c + Math.sin(a) * (c - (big ? 24 : 16)), c - Math.cos(a) * (c - (big ? 24 : 16)));
      ctx.stroke();
    }
    for (let i = 1; i <= 12; i++) {
      const a = (i * Math.PI) / 6;
      text(ctx, String(i), c + Math.sin(a) * (c - 48), c - Math.cos(a) * (c - 48) + 2, { size: 30 });
    }
  });
}

/** Sky, sun, clouds, hills and a tree, seen through a window. */
export function windowViewTexture() {
  return makeTexture(256, 256, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#7fd0ff');
    sky.addColorStop(1, '#d9f4ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(200, 55, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (const [x, y] of [[60, 70], [140, 110]]) {
      for (const [dx, dy, r] of [[0, 0, 18], [20, -8, 22], [42, 0, 18]]) {
        ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = '#8fdc76';
    ctx.beginPath(); ctx.ellipse(70, 250, 170, 70, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6cc85e';
    ctx.beginPath(); ctx.ellipse(230, 260, 150, 70, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9a6a45';
    ctx.fillRect(176, 150, 14, 50);
    ctx.fillStyle = '#4fae5b';
    for (const [x, y, r] of [[183, 140, 28], [165, 155, 20], [201, 155, 20]]) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
}

/** Round rainbow reading rug (drawn to fill a circle). */
export function rugTexture() {
  return makeTexture(512, 512, (ctx, w) => {
    const c = w / 2;
    const rings = ['#f0505a', '#ff9f43', '#ffd84d', '#6cc46a', '#4aa8ff', '#9b7bff'];
    rings.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(c, c, c - i * 32, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#fff4dc';
    ctx.beginPath(); ctx.arc(c, c, c - rings.length * 32, 0, Math.PI * 2); ctx.fill();
    star(ctx, c, c + 4, 50, '#ffd84d');
  });
}

/** Soft glowing rectangle for sunlight on the floor. */
export function sunPatchTexture() {
  return makeTexture(128, 128, (ctx, w, h) => {
    ctx.filter = 'blur(12px)';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(26, 26, w - 52, h - 52);
  });
}

/** Wall posters (all original designs). */
export function posterTexture(kind) {
  return makeTexture(256, 320, (ctx, w, h) => {
    const bg = { kind: '#ffe3ee', rainbow: '#e6f6ff', numbers: '#fff4c2', shapes: '#e9ffe6', read: '#f0e8ff' }[kind];
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    if (kind === 'kind') {
      heart(ctx, w / 2, 150, 90, '#ff5d8f');
      star(ctx, 60, 60, 18, '#ffd84d');
      star(ctx, 200, 70, 14, '#ffd84d');
      text(ctx, 'Be kind!', w / 2, 270, { size: 46 });
    } else if (kind === 'rainbow') {
      RAINBOW.slice(0, 6).forEach((color, i) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 14;
        ctx.beginPath(); ctx.arc(w / 2, 200, 100 - i * 14, Math.PI, 0); ctx.stroke();
      });
      text(ctx, 'Colors', w / 2, 270, { size: 44 });
    } else if (kind === 'numbers') {
      ['1', '2', '3'].forEach((n, i) => {
        const x = 50 + i * 78;
        text(ctx, n, x, 110, { size: 90, color: RAINBOW[i * 2] });
        for (let d = 0; d <= i; d++) {
          ctx.fillStyle = RAINBOW[i * 2];
          ctx.beginPath(); ctx.arc(x, 185 + d * 26, 10, 0, Math.PI * 2); ctx.fill();
        }
      });
      text(ctx, 'Count!', w / 2, 285, { size: 40 });
    } else if (kind === 'shapes') {
      ctx.fillStyle = '#f0505a'; ctx.beginPath(); ctx.arc(75, 85, 42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4aa8ff'; ctx.fillRect(140, 45, 80, 80);
      ctx.fillStyle = '#6cc46a';
      ctx.beginPath(); ctx.moveTo(75, 150); ctx.lineTo(120, 230); ctx.lineTo(30, 230); ctx.closePath(); ctx.fill();
      star(ctx, 180, 192, 46, '#ffd84d');
      text(ctx, 'Shapes', w / 2, 285, { size: 42 });
    } else if (kind === 'read') {
      ctx.fillStyle = '#9b7bff';
      ctx.beginPath(); ctx.moveTo(128, 110); ctx.quadraticCurveTo(70, 80, 30, 95); ctx.lineTo(30, 215);
      ctx.quadraticCurveTo(70, 200, 128, 230); ctx.quadraticCurveTo(186, 200, 226, 215); ctx.lineTo(226, 95);
      ctx.quadraticCurveTo(186, 80, 128, 110); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(128, 112); ctx.lineTo(128, 226); ctx.stroke();
      star(ctx, 128, 50, 24, '#ffd84d');
      text(ctx, 'Read!', w / 2, 280, { size: 46 });
    }
  });
}
