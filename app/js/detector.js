'use strict';

/**
 * detector.js — acquisizione microfono, analisi FFT, scoring e disegno.
 *
 * Estrae feature spettrali dall'audio ambientale e calcola uno "score drone"
 * euristico. Non invia nulla in rete (lo fa app.js tramite mesh.js): qui si
 * lavora solo su numeri, mai su audio grezzo.
 */

import { now } from './mesh.js';
import { store } from './store.js';

/** @type {AudioContext|undefined} */
let audioCtx;
/** @type {AnalyserNode|undefined} */
let analyser;
/** @type {Uint8Array|undefined} buffer dello spettro in ampiezza (0..255) */
let data;
/** Baseline del rumore di fondo calcolata in calibrazione. */
let baseline = null;
/** Sink opzionale per i campioni audio grezzi (usato dal modello). */
let audioSink = null;

/**
 * Registra una funzione che riceve i campioni audio grezzi (per il modello
 * opzionale). Va impostata prima di start(). @param {(frame:Float32Array, sr:number)=>void} fn
 */
export function setAudioSink(fn) {
  audioSink = fn;
}

/**
 * @typedef {Object} Features
 * @property {number} ts        timestamp sincronizzato
 * @property {string} node      id del nodo
 * @property {number} total     energia totale
 * @property {number} band      energia nella banda 120–4500 Hz
 * @property {number} low       energia 90–650 Hz
 * @property {number} hf        energia 650–5200 Hz
 * @property {Array<[number,number]>} peaks  picchi [freq, ampiezza]
 * @property {number} harmonic  conteggio relazioni armoniche fra picchi
 * @property {number} centroid  centroide spettrale (Hz)
 * @property {number} rough     "ruvidità" spettrale
 * @property {(import('./store.js').Gps|null)} gps
 */

/** @returns {boolean} true se il microfono è attivo. */
export function isRunning() {
  return !!analyser;
}

/**
 * Avvia il microfono e la catena di analisi.
 * @returns {Promise<void>}
 */
export async function start() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const src = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.55;
  src.connect(analyser);
  data = new Uint8Array(analyser.frequencyBinCount);

  // Tap opzionale per i campioni grezzi: attivo solo se il modello è abilitato.
  if (audioSink) {
    const cap = audioCtx.createScriptProcessor(4096, 1, 1);
    src.connect(cap);
    const mute = audioCtx.createGain();
    mute.gain.value = 0; // evita il rientro audio dal microfono
    cap.connect(mute);
    mute.connect(audioCtx.destination);
    cap.onaudioprocess = (e) => audioSink(e.inputBuffer.getChannelData(0), audioCtx.sampleRate);
  }
}

/**
 * Legge lo spettro corrente ed estrae le feature.
 * @returns {Features}
 */
export function extract() {
  analyser.getByteFrequencyData(data);
  const sr = audioCtx.sampleRate;
  const bin = sr / analyser.fftSize;
  let total = 0, band = 0, hf = 0, low = 0;
  const peaks = [];
  for (let i = 1; i < data.length; i++) {
    const f = i * bin, v = data[i];
    total += v;
    if (f > 90 && f < 650) low += v;
    if (f > 650 && f < 5200) hf += v;
    if (f > 120 && f < 4500) {
      band += v;
      if (v > 75) peaks.push([f, v]);
    }
  }
  peaks.sort((a, b) => b[1] - a[1]);
  const top = peaks.slice(0, 8).sort((a, b) => a[0] - b[0]);

  let harmonic = 0;
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const r = top[j][0] / top[i][0];
      if (Math.abs(r - Math.round(r)) < 0.06 && Math.round(r) >= 2 && Math.round(r) <= 8) harmonic++;
    }
  }

  let centroid = 0, sum = 0;
  for (let i = 1; i < data.length; i++) {
    const f = i * bin, v = data[i];
    if (f < 6000) { centroid += f * v; sum += v; }
  }
  centroid = sum ? centroid / sum : 0;

  let rough = 0;
  for (let i = 2; i < data.length; i++) rough += Math.abs(data[i] - data[i - 1]);
  rough /= data.length;

  return { ts: now(), node: store.nodeId, total, band, low, hf, peaks: top, harmonic, centroid, rough, gps: store.gps };
}

/**
 * Calcola lo score drone (0..1) dalle feature, relativo alla baseline.
 * @param {Features} f
 * @returns {number}
 */
export function score(f) {
  const b = baseline || { band: 3500, rough: 6, total: 20000 };
  let s = 0;
  s += Math.min(0.35, Math.max(0, (f.band - b.band * 1.15) / (b.band * 3.5)));
  s += Math.min(0.25, f.harmonic / 10);
  s += (f.centroid > 350 && f.centroid < 2800) ? 0.18 : 0;
  s += Math.min(0.15, Math.max(0, (f.rough - b.rough) / (b.rough * 5)));
  s += (f.hf > f.low * 0.8) ? 0.07 : 0;
  return Math.max(0, Math.min(1, s));
}

/**
 * Calibra la baseline del rumore di fondo per ~20s.
 * @param {(msg:string)=>void} [log]  callback per i messaggi di stato
 * @returns {Promise<Object>} la baseline calcolata
 */
export async function calibrate(log = () => {}) {
  if (!analyser) throw new Error('Avvia prima il microfono');
  log('Calibrazione 20s... resta in silenzio ambientale normale');
  const samples = [];
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    samples.push(extract());
    await new Promise((r) => setTimeout(r, 250));
  }
  const avg = (k) => samples.reduce((acc, x) => acc + x[k], 0) / samples.length;
  baseline = { band: avg('band'), rough: avg('rough'), total: avg('total') };
  log('Baseline salvata: ' + JSON.stringify(baseline));
  return baseline;
}

/** Frequenza massima (Hz) mostrata sull'asse verticale del waterfall. */
const SPEC_MAX_HZ = 8000;

/** True se l'utente preferisce ridurre le animazioni (no scorrimento). */
const reduceMotion = !!(window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches);

let waterfallReady = false;

/**
 * Mappa un'intensità 0..1 su una palette acustica (scuro→blu→ciano→giallo→rosso).
 * @param {number} v
 * @returns {[number,number,number]} colore RGB
 */
function colormap(v) {
  const stops = [
    [0.00, [7, 16, 24]],
    [0.25, [20, 40, 90]],
    [0.50, [40, 120, 200]],
    [0.70, [60, 200, 230]],
    [0.85, [250, 210, 80]],
    [1.00, [255, 80, 90]],
  ];
  v = Math.max(0, Math.min(1, v));
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (v - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/** Numero di bin FFT da mostrare fino a SPEC_MAX_HZ. */
function maxDisplayBin() {
  const bin = audioCtx.sampleRate / analyser.fftSize;
  return Math.min(data.length, Math.round(SPEC_MAX_HZ / bin));
}

/**
 * Disegna lo spettrogramma a cascata (waterfall): il tempo scorre da destra
 * verso sinistra, la frequenza è sull'asse verticale (bassi in basso) e il
 * colore rappresenta l'intensità. È l'artefatto caratteristico del
 * rilevamento acustico. Con prefers-reduced-motion mostra invece uno
 * spettro a barre statico, senza scorrimento.
 * @param {HTMLCanvasElement} canvas
 */
export function drawSpectrum(canvas) {
  if (!data) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  if (reduceMotion) {
    drawBars(ctx, w, h);
    return;
  }

  // Inizializza lo sfondo la prima volta, così non resta area trasparente.
  if (!waterfallReady) {
    const bg = colormap(0);
    ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    ctx.fillRect(0, 0, w, h);
    waterfallReady = true;
  }

  // Scorre tutto a sinistra di 1px e disegna la colonna nuova a destra.
  ctx.drawImage(canvas, -1, 0);
  const maxBin = maxDisplayBin();
  const col = ctx.createImageData(1, h);
  for (let y = 0; y < h; y++) {
    const frac = 1 - y / h;            // 0 = basso (gravi), 1 = alto (acuti)
    const bin = Math.min(maxBin - 1, Math.floor(frac * maxBin));
    const [r, g, b] = colormap(data[bin] / 255);
    const o = y * 4;
    col.data[o] = r; col.data[o + 1] = g; col.data[o + 2] = b; col.data[o + 3] = 255;
  }
  ctx.putImageData(col, w - 1, 0);
}

/**
 * Spettro a barre statico (fallback per prefers-reduced-motion).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 */
function drawBars(ctx, w, h) {
  const bg = colormap(0);
  ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
  ctx.fillRect(0, 0, w, h);
  const maxBin = maxDisplayBin();
  for (let x = 0; x < w; x++) {
    const bin = Math.min(maxBin - 1, Math.floor(x / w * maxBin));
    const v = data[bin] / 255;
    const [r, g, b] = colormap(v);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    const bh = v * h;
    ctx.fillRect(x, h - bh, 1, bh);
  }
}
