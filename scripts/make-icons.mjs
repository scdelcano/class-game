// Draws the app icon (a chalkboard with a red apple) and writes PNGs to
// public/icons. No image libraries needed: shapes are signed-distance
// functions, supersampled for smooth edges, encoded with Node's zlib.
// Run with: npm run icons
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// --- signed distance helpers (coordinates in 0..1 icon space) -------------
const roundBox = (cx, cy, hw, hh, r) => (x, y) => {
  const qx = Math.abs(x - cx) - hw + r;
  const qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const circle = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;
const ellipse = (cx, cy, rx, ry, angle = 0) => (x, y) => {
  const c = Math.cos(angle), s = Math.sin(angle);
  const dx = x - cx, dy = y - cy;
  const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
  return (Math.hypot(u, v) - 1) * Math.min(rx, ry);
};
const capsule = (ax, ay, bx, by, r) => (x, y) => {
  const px = x - ax, py = y - ay, vx = bx - ax, vy = by - ay;
  const h = Math.max(0, Math.min(1, (px * vx + py * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - vx * h, py - vy * h) - r;
};
const union = (...fs) => (x, y) => Math.min(...fs.map((f) => f(x, y)));

/** Layers are painted in order. `scale` shrinks art toward the centre (for maskable safe zone). */
function layers(scale, fullBleed) {
  const s = (f) => (x, y) => f(0.5 + (x - 0.5) / scale, 0.5 + (y - 0.5) / scale);
  const bg = fullBleed ? () => -1 : roundBox(0.5, 0.5, 0.5, 0.5, 0.2);
  return [
    { f: bg, c: [255, 207, 74] }, // sunny yellow
    { f: s(roundBox(0.5, 0.47, 0.36, 0.27, 0.07)), c: [196, 124, 64] }, // wood frame
    { f: s(roundBox(0.5, 0.47, 0.31, 0.22, 0.04)), c: [46, 139, 99] }, // chalkboard
    { f: s(capsule(0.28, 0.36, 0.52, 0.36, 0.022)), c: [250, 250, 240] }, // chalk lines
    { f: s(capsule(0.28, 0.46, 0.44, 0.46, 0.022)), c: [250, 250, 240] },
    { f: s(capsule(0.28, 0.56, 0.48, 0.56, 0.022)), c: [250, 250, 240] },
    { f: s(union(circle(0.665, 0.69, 0.14), circle(0.775, 0.69, 0.14), ellipse(0.72, 0.77, 0.15, 0.09))), c: [235, 64, 74] }, // apple
    { f: s(ellipse(0.65, 0.64, 0.03, 0.055, -0.5)), c: [255, 140, 140] }, // shine
    { f: s(capsule(0.72, 0.56, 0.74, 0.5, 0.018)), c: [110, 70, 40] }, // stem
    { f: s(ellipse(0.8, 0.5, 0.07, 0.035, -0.4)), c: [120, 200, 80] }, // leaf
  ];
}

function render(size, { scale = 1, fullBleed = false } = {}) {
  const L = layers(scale, fullBleed);
  const SS = 4; // 4x4 supersampling
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          let col = null;
          for (const l of L) if (l.f(u, v) <= 0) col = l.c;
          if (col) { r += col[0]; g += col[1]; b += col[2]; a += 1; }
        }
      }
      const i = (y * size + x) * 4;
      const n = SS * SS;
      px[i] = a ? r / a : 0; px[i + 1] = a ? g / a : 0; px[i + 2] = a ? b / a : 0;
      px[i + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, px);
}

function encodePng(size, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(new URL('icon-192.png', OUT), render(192));
writeFileSync(new URL('icon-512.png', OUT), render(512));
// Maskable: full-bleed background, art kept inside the 80% safe circle.
writeFileSync(new URL('icon-maskable-512.png', OUT), render(512, { scale: 0.78, fullBleed: true }));
console.log('Icons written to public/icons/');
