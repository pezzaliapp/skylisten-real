'use strict';

/**
 * app.js — wiring dell'interfaccia.
 *
 * Collega i moduli detector / mesh / store agli elementi del DOM e gestisce
 * il loop di rilevamento. Nessuna logica di analisi o di rete vive qui.
 */

import * as detector from './js/detector.js';
import * as mesh from './js/mesh.js';
import * as model from './js/model.js';
import { store, setNodeId, setGps, addEvent, exportCsv } from './js/store.js';

/** Peso del modello opzionale nello score combinato (0..1). */
const MODEL_WEIGHT = 0.5;

/** @param {string} id @returns {HTMLElement} */
const $ = (id) => document.getElementById(id);

/** Aggiunge una riga (con timestamp) in cima al log eventi. */
function log(s) {
  $('log').textContent = new Date().toLocaleTimeString() + '  ' + s + '\n' + $('log').textContent.slice(0, 8000);
}

// --- Stato iniziale dell'interfaccia ---
const nodeIdInput = $('nodeId');
nodeIdInput.value = store.nodeId;
nodeIdInput.onchange = () => setNodeId(nodeIdInput.value);

// URL del server condiviso fra app e mappa (riusabile fra le pagine).
if (localStorage['skylisten-wsurl']) $('wsurl').value = localStorage['skylisten-wsurl'];

$('thr').oninput = () => { $('thrval').textContent = $('thr').value; };

/** Avvia il microfono e il loop di rilevamento. */
async function start() {
  try {
    await detector.start();
  } catch (err) {
    alert('Impossibile accedere al microfono: ' + err.message);
    return;
  }
  $('status').textContent = 'ASCOLTO';
  $('status').className = 'big ok';
  log('Microfono avviato');
  loop();
}

/** Loop di rilevamento: estrae feature, calcola score, aggiorna UI e mesh. */
function loop() {
  const f = detector.extract();
  const heuristic = detector.score(f);
  detector.drawSpectrum($('spec'));

  // Se il modello opzionale è attivo, combina il suo score con l'euristica.
  let sc = heuristic;
  const modelProb = model.predict(f);
  if (modelProb != null) {
    sc = MODEL_WEIGHT * modelProb + (1 - MODEL_WEIGHT) * heuristic;
  }

  $('score').textContent = sc.toFixed(2);
  $('features').textContent =
    `centroide ${f.centroid.toFixed(0)} Hz | armoniche ${f.harmonic} | picchi ${f.peaks.map((p) => p[0].toFixed(0)).join(', ')} Hz` +
    (modelProb != null ? ` | modello ${modelProb.toFixed(2)}` : '');

  if (sc > parseFloat($('thr').value)) {
    $('status').textContent = 'POSSIBILE DRONE';
    $('status').className = 'big bad';
    if (navigator.vibrate) navigator.vibrate(100);
    const ev = { ...f, score: sc, type: 'DRONE_CANDIDATE' };
    addEvent(ev);
    mesh.send({ kind: 'event', event: ev });
    log(`Evento locale score=${sc.toFixed(2)}`);
  } else {
    $('status').textContent = 'ASCOLTO';
    $('status').className = 'big ok';
  }

  requestAnimationFrame(loop);
}

/** Avvia la calibrazione del rumore di fondo. */
async function calibrate() {
  if (!detector.isRunning()) {
    alert('Avvia prima il microfono');
    return;
  }
  await detector.calibrate(log);
}

/** Connette la PWA alla mesh WebSocket, instradando i messaggi sul DOM. */
function connect() {
  const url = $('wsurl').value;
  localStorage['skylisten-wsurl'] = url; // condiviso con la pagina mappa
  mesh.connect(url, {
    onLog: log,
    onStatus: (text) => { $('mesh').textContent = text; },
    onAlarm: (m) => {
      $('alarm').textContent = m.level;
      $('alarm').className = m.level === 'NESSUNO' ? 'big ok' : 'big bad';
      $('confirm').textContent = m.count;
      $('estimate').textContent = m.estimate ? JSON.stringify(m.estimate) : '';
    },
  });
}

/** Attiva il GPS e propaga la posizione a store e mesh. */
function geo() {
  navigator.geolocation.watchPosition(
    (p) => {
      const gps = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
      setGps(gps);
      $('pos').textContent = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} ±${gps.acc.toFixed(0)}m`;
      mesh.send({ kind: 'pos' });
    },
    (e) => alert(e.message),
    { enableHighAccuracy: true, maximumAge: 1000 }
  );
}

// --- Collegamento dei controlli ---
$('start').onclick = start;
$('calib').onclick = calibrate;
$('geo').onclick = geo;
$('connect').onclick = connect;
$('sync').onclick = () => mesh.syncClock();
$('beacon').onclick = () => mesh.send({
  kind: 'event',
  event: { ts: mesh.now(), node: store.nodeId, score: 0.9, type: 'TEST', gps: store.gps },
});
$('export').onclick = exportCsv;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

// Modello opzionale: registra il sink audio e prova a caricarlo. Se manca il
// modello o TensorFlow.js, l'app continua con la sola euristica FFT.
detector.setAudioSink(model.pushSamples);
model.init(log);
