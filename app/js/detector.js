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

/**
 * Disegna lo spettro corrente come linea d'onda.
 * @param {HTMLCanvasElement} canvas
 */
export function drawSpectrum(canvas) {
  if (!data) return;
  const x = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  x.clearRect(0, 0, w, h);
  x.fillStyle = '#071018';
  x.fillRect(0, 0, w, h);
  x.strokeStyle = '#5cc8ff';
  x.beginPath();
  for (let i = 0; i < data.length; i++) {
    const xx = i / data.length * w;
    const yy = h - data[i] / 255 * h;
    if (i === 0) x.moveTo(xx, yy); else x.lineTo(xx, yy);
  }
  x.stroke();
}
