'use strict';

/**
 * model.js — aggancio OPZIONALE a un modello TensorFlow.js.
 *
 * Comportamento e vincoli:
 *  - se manca model/model.json, o se TensorFlow.js non è stato caricato
 *    (window.tf assente), il modulo resta disattivato e l'app usa solo
 *    l'euristica FFT: degrada con grazia, nessun errore;
 *  - non scarica nulla da CDN obbligatorie: TensorFlow.js va aggiunto
 *    localmente dall'utente (offline-first, costo zero);
 *  - l'inferenza gira in background (throttled) e restituisce un valore
 *    smussato, così il loop di rilevamento non deve attendere.
 *
 * Vedi model/README.md per come abilitarlo. È una funzione sperimentale:
 * il rilevamento serio resta basato su dataset reali e taratura.
 */

import { DSP, resampleLinear, logMelSpectrogram } from './dsp.js';

const MODEL_URL = 'model/model.json';
const PREDICT_EVERY_MS = 500; // throttle dell'inferenza
const EMA_ALPHA = 0.5;        // smussatura esponenziale dell'output

let tf = null;
let model = null;
let inputRank = 4;            // 4 = mel-spectrogram, 2 = vettore di feature
let enabled = false;

// Ring buffer dell'audio grezzo a frequenza di contesto.
let ring = null, ringCap = 0, ringWrite = 0, ringCount = 0, ringSr = 0;

let lastRun = 0;
let smoothed = null;

/** @returns {boolean} true se il modello è caricato e utilizzabile. */
export function isEnabled() {
  return enabled;
}

/** @returns {number|null} ultima probabilità smussata (o null). */
export function lastProbability() {
  return smoothed;
}

/**
 * Inizializza il modello se presente. Sicuro da chiamare sempre.
 * @param {(msg:string)=>void} [log]
 * @returns {Promise<boolean>} true se attivato
 */
export async function init(log = () => {}) {
  // 1) il file del modello esiste?
  try {
    const res = await fetch(MODEL_URL, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return false; // nessun modello: silenzioso
  } catch {
    return false;
  }
  // 2) TensorFlow.js disponibile?
  tf = (typeof window !== 'undefined') ? window.tf : null;
  if (!tf) {
    log('Modello presente ma TensorFlow.js non caricato: uso solo euristica. Vedi model/README.md');
    return false;
  }
  // 3) carica il modello (Layers, con fallback a Graph).
  try {
    try { model = await tf.loadLayersModel(MODEL_URL); }
    catch { model = await tf.loadGraphModel(MODEL_URL); }
    const shape = (model.inputs && model.inputs[0] && model.inputs[0].shape) || [];
    inputRank = shape.length >= 4 ? 4 : 2;
    enabled = true;
    log(`Modello caricato (input rank ${inputRank}): score combinato con l'euristica`);
    return true;
  } catch (err) {
    log('Caricamento modello fallito: uso solo euristica (' + err.message + ')');
    return false;
  }
}

/**
 * Accumula campioni audio grezzi (chiamata dal detector). No-op se disattivato.
 * @param {Float32Array} frame
 * @param {number} sampleRate
 */
export function pushSamples(frame, sampleRate) {
  if (!enabled) return;
  ringSr = sampleRate;
  if (!ring) {
    ringCap = Math.ceil(sampleRate * (DSP.DURATION + 0.2));
    ring = new Float32Array(ringCap);
    ringWrite = 0; ringCount = 0;
  }
  for (let i = 0; i < frame.length; i++) {
    ring[ringWrite] = frame[i];
    ringWrite = (ringWrite + 1) % ringCap;
  }
  ringCount = Math.min(ringCap, ringCount + frame.length);
}

/** Estrae in ordine gli ultimi `n` campioni dal ring buffer. */
function lastSamples(n) {
  const out = new Float64Array(n);
  let start = (ringWrite - n) % ringCap;
  if (start < 0) start += ringCap;
  for (let i = 0; i < n; i++) out[i] = ring[(start + i) % ringCap];
  return out;
}

/**
 * Restituisce subito l'ultima probabilità smussata e, se è il momento,
 * lancia in background una nuova inferenza. Mai bloccante.
 * @param {Object} [features] feature numeriche (usate dai modelli rank 2)
 * @returns {number|null}
 */
export function predict(features) {
  if (!enabled) return null;
  const t = Date.now();
  if (t - lastRun >= PREDICT_EVERY_MS) {
    lastRun = t;
    run(features).catch(() => {}); // gli errori non devono propagarsi
  }
  return smoothed;
}

/** Esegue una singola inferenza e aggiorna il valore smussato. */
async function run(features) {
  let input;
  if (inputRank === 4) {
    const need = Math.round(ringSr * DSP.DURATION);
    if (ringCount < need) return; // non abbastanza audio
    const raw = lastSamples(need);
    const sig = resampleLinear(raw, ringSr, DSP.SR);
    const { data, nMels, frames } = logMelSpectrogram(sig);
    input = tf.tensor4d(data, [1, nMels, frames, 1]);
  } else {
    input = tf.tensor2d([featureVector(features)]);
  }

  let prob;
  try {
    const out = model.predict(input);
    const arr = await out.data();
    prob = arr[arr.length - 1]; // sigmoide finale
    out.dispose();
  } finally {
    input.dispose();
  }
  if (Number.isFinite(prob)) {
    smoothed = (smoothed == null) ? prob : EMA_ALPHA * prob + (1 - EMA_ALPHA) * smoothed;
  }
}

/**
 * Vettore di feature normalizzate per i modelli "leggeri" (input rank 2).
 * Schema documentato in model/README.md.
 * @param {Object} f
 * @returns {number[]}
 */
function featureVector(f) {
  if (!f) return [0, 0, 0, 0, 0, 0];
  return [
    Math.min(1, f.band / 50000),
    Math.min(1, f.harmonic / 10),
    Math.min(1, f.centroid / 8000),
    Math.min(1, f.rough / 50),
    Math.min(1, f.hf / 50000),
    Math.min(1, f.low / 50000),
  ];
}
