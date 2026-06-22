'use strict';

/**
 * dsp.js — utilità DSP per costruire il log-mel spectrogram atteso dal modello.
 *
 * Replica i default di librosa usati in training/train_drone_classifier.py
 * (SR 16000, n_fft 2048, hop 512, finestra Hann, center=reflect, mel Slaney,
 * power_to_db con ref=max e top_db=80). È volutamente indipendente dal DOM e
 * dal modello, così da poter essere verificata in isolamento (vedi test).
 */

/** Parametri allineati al training. */
export const DSP = Object.freeze({
  SR: 16000,
  DURATION: 2.0,
  N_FFT: 2048,
  HOP: 512,
  N_MELS: 64,
  FMIN: 0,
  FMAX: 8000,
  TOP_DB: 80,
  AMIN: 1e-10,
});

/**
 * FFT iterativa radix-2 in place (lunghezza potenza di 2).
 * @param {Float64Array} re parte reale
 * @param {Float64Array} im parte immaginaria
 */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/** Finestra di Hann (periodica, come librosa). @param {number} n */
export function hann(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n);
  return w;
}

/** Ricampionamento lineare. @returns {Float64Array} */
export function resampleLinear(input, srIn, srOut) {
  if (srIn === srOut) return Float64Array.from(input);
  const ratio = srOut / srIn;
  const outLen = Math.round(input.length * ratio);
  const out = new Float64Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i / ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const f = pos - i0;
    out[i] = input[i0] * (1 - f) + input[i1] * f;
  }
  return out;
}

/** Conversione Hz → mel (scala Slaney, htk=False). */
function hzToMel(f) {
  const fSp = 200 / 3, minLogHz = 1000, minLogMel = minLogHz / fSp, logstep = Math.log(6.4) / 27;
  return f < minLogHz ? f / fSp : minLogMel + Math.log(f / minLogHz) / logstep;
}

/** Conversione mel → Hz (scala Slaney, htk=False). */
function melToHz(m) {
  const fSp = 200 / 3, minLogHz = 1000, minLogMel = minLogHz / fSp, logstep = Math.log(6.4) / 27;
  return m < minLogMel ? fSp * m : minLogHz * Math.exp(logstep * (m - minLogMel));
}

/**
 * Banco di filtri mel (Slaney + normalizzazione 'slaney'), come librosa.filters.mel.
 * @returns {Float64Array[]} nMels filtri, ognuno lungo n_fft/2+1
 */
export function melFilterbank(sr = DSP.SR, nFft = DSP.N_FFT, nMels = DSP.N_MELS, fmin = DSP.FMIN, fmax = DSP.FMAX) {
  const nBins = nFft / 2 + 1;
  const fftFreqs = new Float64Array(nBins);
  for (let i = 0; i < nBins; i++) fftFreqs[i] = i * sr / nFft;

  const melMin = hzToMel(fmin), melMax = hzToMel(fmax);
  const melPts = new Float64Array(nMels + 2);
  for (let i = 0; i < nMels + 2; i++) melPts[i] = melMin + (melMax - melMin) * i / (nMels + 1);
  const freqs = Float64Array.from(melPts, melToHz);

  const filters = [];
  for (let i = 0; i < nMels; i++) {
    const f = new Float64Array(nBins);
    const lowF = freqs[i], ctrF = freqs[i + 1], hiF = freqs[i + 2];
    const dLow = ctrF - lowF, dHi = hiF - ctrF;
    const enorm = 2 / (hiF - lowF); // normalizzazione 'slaney'
    for (let b = 0; b < nBins; b++) {
      const lower = (fftFreqs[b] - lowF) / dLow;
      const upper = (hiF - fftFreqs[b]) / dHi;
      f[b] = Math.max(0, Math.min(lower, upper)) * enorm;
    }
    filters.push(f);
  }
  return filters;
}

/** Riflette l'indice fuori intervallo dentro [0, n-1] (mode='reflect'). */
function reflectIndex(i, n) {
  if (n === 1) return 0;
  const period = 2 * (n - 1);
  let k = ((i % period) + period) % period;
  return k < n ? k : period - k;
}

/**
 * Spettrogramma di potenza (STFT^2) con center padding reflect, come librosa.
 * @param {Float64Array} signal segnale a 16 kHz
 * @returns {{frames:number, bins:number, power:Float64Array[]}}
 */
export function powerSpectrogram(signal, nFft = DSP.N_FFT, hop = DSP.HOP) {
  const bins = nFft / 2 + 1;
  const frames = 1 + Math.floor(signal.length / hop);
  const win = hann(nFft);
  const pad = nFft >> 1;
  const re = new Float64Array(nFft), im = new Float64Array(nFft);
  const out = [];
  for (let t = 0; t < frames; t++) {
    const start = t * hop - pad; // center=True
    im.fill(0);
    for (let k = 0; k < nFft; k++) {
      const idx = start + k;
      const s = (idx >= 0 && idx < signal.length) ? signal[idx] : signal[reflectIndex(idx, signal.length)];
      re[k] = s * win[k];
    }
    fft(re, im);
    const p = new Float64Array(bins);
    for (let b = 0; b < bins; b++) p[b] = re[b] * re[b] + im[b] * im[b];
    out.push(p);
  }
  return { frames, bins, power: out };
}

/**
 * Log-mel spectrogram in forma piatta (ordine mel-major: [mel][frame]),
 * pronto per essere riscritto in un tensore [1, nMels, frames, 1].
 * @param {Float64Array} signal16k
 * @returns {{data:Float32Array, nMels:number, frames:number}}
 */
export function logMelSpectrogram(signal16k) {
  const { frames, power } = powerSpectrogram(signal16k);
  const fb = melFilterbank();
  const nMels = fb.length;
  const mel = new Float32Array(nMels * frames);
  let maxVal = -Infinity;
  for (let m = 0; m < nMels; m++) {
    const filt = fb[m];
    for (let t = 0; t < frames; t++) {
      let acc = 0;
      const p = power[t];
      for (let b = 0; b < filt.length; b++) acc += filt[b] * p[b];
      mel[m * frames + t] = acc;
      if (acc > maxVal) maxVal = acc;
    }
  }
  // power_to_db con ref=max, amin, top_db (come librosa.power_to_db)
  const ref = Math.max(DSP.AMIN, maxVal);
  const refDb = 10 * Math.log10(ref);
  let topRef = -Infinity;
  for (let i = 0; i < mel.length; i++) {
    const db = 10 * Math.log10(Math.max(DSP.AMIN, mel[i])) - refDb;
    mel[i] = db;
    if (db > topRef) topRef = db;
  }
  const floor = topRef - DSP.TOP_DB;
  for (let i = 0; i < mel.length; i++) if (mel[i] < floor) mel[i] = floor;
  return { data: mel, nMels, frames };
}
