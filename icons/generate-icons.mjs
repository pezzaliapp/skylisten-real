/*
 * Genera le icone PNG della PWA a partire dalla geometria di icon.svg,
 * senza dipendenze esterne (usa solo zlib di Node) per restare a costo zero
 * anche su macchine prive di ImageMagick / librerie di rendering.
 *
 * Uso:  node icons/generate-icons.mjs   (oppure: npm run icons)
 *
 * Produce:
 *   icon-192.png            (purpose "any", angoli arrotondati)
 *   icon-512.png            (purpose "any", angoli arrotondati)
 *   icon-maskable-192.png   (purpose "maskable", sfondo a tutto campo)
 *   icon-maskable-512.png   (purpose "maskable", sfondo a tutto campo)
 *
 * La geometria replica icon.svg: sfondo, anello, mirino a croce, punto centrale.
 * Per i maskable lo sfondo riempie l'intero quadrato (niente angoli trasparenti)
 * e il contenuto resta dentro la "safe zone" (cerchio di raggio 40%).
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = dirname(fileURLToPath(import.meta.url));

const BG = [11, 15, 20];     // #0b0f14
const BLUE = [92, 200, 255]; // #5cc8ff
const RED = [255, 92, 122];  // #ff5c7a

const VB = 512;       // viewBox dell'SVG originale
const CX = 256, CY = 256;
const RING_R = 160, RING_W = 26;
const CROSS_W = 22, CROSS_FROM = 92, CROSS_TO = 420;
const DOT_R = 38;
const CORNER = 96;    // rx dello sfondo arrotondato

// Restituisce [r,g,b,a] in coordinate SVG (0..512). maskable => sfondo pieno.
function colorAt(fx, fy, maskable) {
  let px = null; // colore corrente, parte trasparente

  const insideBg = maskable
    ? (fx >= 0 && fx <= VB && fy >= 0 && fy <= VB)
    : insideRoundedRect(fx, fy, 0, 0, VB, VB, CORNER);
  if (insideBg) px = BG;

  // Anello (solo stroke): banda attorno al raggio.
  const d = Math.hypot(fx - CX, fy - CY);
  if (Math.abs(d - RING_R) <= RING_W / 2) px = BLUE;

  // Mirino a croce.
  const onH = Math.abs(fy - CY) <= CROSS_W / 2 && fx >= CROSS_FROM && fx <= CROSS_TO;
  const onV = Math.abs(fx - CX) <= CROSS_W / 2 && fy >= CROSS_FROM && fy <= CROSS_TO;
  if (onH || onV) px = BLUE;

  // Punto centrale.
  if (d <= DOT_R) px = RED;

  return px ? [px[0], px[1], px[2], 255] : [0, 0, 0, 0];
}

function insideRoundedRect(x, y, rx, ry, w, h, r) {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false;
  const dx = Math.min(x - rx, rx + w - x);
  const dy = Math.min(y - ry, ry + h - y);
  if (dx >= r || dy >= r) return true; // fuori dalle zone d'angolo
  // dentro la zona d'angolo: confronto col cerchio di raccordo
  return Math.hypot(r - dx, r - dy) <= r;
}

// Rende l'icona a dimensione `size`, con supersampling SxS per l'antialiasing.
function render(size, maskable, S = 4) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = VB / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const fx = (x + (sx + 0.5) / S) * scale;
          const fy = (y + (sy + 0.5) / S) * scale;
          const c = colorAt(fx, fy, maskable);
          // premoltiplica per un blending corretto sui bordi
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
        }
      }
      const n = S * S;
      const i = (y * size + x) * 4;
      const alpha = a / n;
      rgba[i] = alpha ? Math.round(r / a) : 0;
      rgba[i + 1] = alpha ? Math.round(g / a) : 0;
      rgba[i + 2] = alpha ? Math.round(b / a) : 0;
      rgba[i + 3] = Math.round(alpha);
    }
  }
  return rgba;
}

// --- Encoder PNG minimale (RGBA, 8-bit, non interlacciato) ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  // 10,11,12 = compressione/filtro/interlacciamento = 0
  // Aggiunge il byte di filtro (0) a inizio riga.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function write(name, size, maskable) {
  const png = encodePng(render(size, maskable), size);
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`scritto ${name} (${size}x${size}, ${png.length} byte)`);
}

write('icon-192.png', 192, false);
write('icon-512.png', 512, false);
write('icon-maskable-192.png', 192, true);
write('icon-maskable-512.png', 512, true);
