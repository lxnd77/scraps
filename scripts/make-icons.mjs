// Generates the PWA icons into apps/web/public/icons (committed; rerun after a brand change).
//
//   node scripts/make-icons.mjs
//
// The brand mark is a yellow rounded square with an ink outline and a four-point sparkle. The
// maskable icon is full bleed with the sparkle inside the 80% safe zone, because launchers crop it
// to their own shape.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const YELLOW = [255, 214, 10];
const INK = [17, 17, 17];

function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rgba) {
  const row = size * 4 + 1;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0;
    rgba.copy(raw, y * row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// the sparkle from BrandMark, in a 24 x 24 box
const SPARKLE = [
  [12, 2],
  [14.2, 9.8],
  [22, 12],
  [14.2, 14.2],
  [12, 22],
  [9.8, 14.2],
  [2, 12],
  [9.8, 9.8],
];

function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoundedSquare(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function render(size, { maskable }) {
  const out = Buffer.alloc(size * size * 4);
  const SS = 3; // supersampling per axis
  const pad = maskable ? 0 : size * 0.04;
  const radius = maskable ? 0 : size * 0.22;
  const outline = maskable ? 0 : size * 0.05;
  const box = size - 2 * pad;
  // sparkle scale: inside the safe zone for maskable, bigger for the plain icon
  const sparkleSize = size * (maskable ? 0.46 : 0.56);
  const origin = (size - sparkleSize) / 2;
  const poly = SPARKLE.map(([sx, sy]) => [origin + (sx / 24) * sparkleSize, origin + (sy / 24) * sparkleSize]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const lx = px - pad;
          const ly = py - pad;
          const insideShape = maskable || inRoundedSquare(lx, ly, box, radius);
          if (!insideShape) continue;
          const insideFill =
            maskable || inRoundedSquare(lx - outline, ly - outline, box - 2 * outline, Math.max(0, radius - outline));
          let color = insideFill ? YELLOW : INK;
          if (insideFill && inPolygon(px, py, poly)) color = INK;
          r += color[0];
          g += color[1];
          b += color[2];
          a += 255;
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      const covered = a / 255;
      out[o] = covered ? Math.round(r / covered) : 0;
      out[o + 1] = covered ? Math.round(g / covered) : 0;
      out[o + 2] = covered ? Math.round(b / covered) : 0;
      out[o + 3] = Math.round((covered / n) * 255);
    }
  }
  return out;
}

const dir = new URL("../apps/web/public/icons/", import.meta.url);
mkdirSync(dir, { recursive: true });
const files = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
];
for (const [name, size, maskable] of files) {
  writeFileSync(new URL(name, dir), encodePng(size, render(size, { maskable })));
  console.log("wrote", name);
}
