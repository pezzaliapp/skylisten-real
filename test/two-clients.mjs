/*
 * Test automatico: due client simultanei (un sensore e un viewer/mappa) devono
 * restare connessi insieme per >=10s, mentre il sensore invia eventi posizionati
 * e il viewer li riceve. Nessuna disconnessione inattesa.
 *
 * Riproduce lo scenario reale app(index.html) + mappa(mappa.html) sullo stesso
 * server. Avvia il server come processo figlio su una porta dedicata.
 *
 * Uso:  npm run test:mesh    (oppure: node test/two-clients.mjs)
 * Exit 0 = ok, 1 = fallito.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const require = createRequire(join(ROOT, 'server/'));
const WebSocket = require('ws');

const PORT = 8799;
const URL = `ws://127.0.0.1:${PORT}`;
const HOLD_MS = 10000;

const fail = (msg) => { console.error('FAIL:', msg); process.exitCode = 1; };

const server = spawn('node', [join(ROOT, 'server/server.js')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
server.stdout.on('data', () => {}); // silenzia i log del server

await new Promise((r) => setTimeout(r, 1000)); // attende il bind

const state = {
  sensorCloses: 0, viewerCloses: 0,
  sensorOpen: false, viewerOpen: false,
  viewerEvents: 0, sent: 0,
};

const sensor = new WebSocket(URL);
sensor.on('open', () => {
  state.sensorOpen = true;
  sensor.send(JSON.stringify({ kind: 'hello', node: 'NODO-ABCDE', role: 'sensor' }));
});
sensor.on('close', () => { state.sensorCloses++; });

const viewer = new WebSocket(URL);
viewer.on('open', () => {
  state.viewerOpen = true;
  viewer.send(JSON.stringify({ kind: 'hello', node: 'VIEWER-WXYZ', role: 'viewer' }));
});
viewer.on('close', () => { state.viewerCloses++; });
viewer.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.kind === 'event') state.viewerEvents++;
});

// Il sensore invia un evento posizionato ogni 1.5s per tutta la durata.
const emitter = setInterval(() => {
  if (sensor.readyState === WebSocket.OPEN) {
    sensor.send(JSON.stringify({
      kind: 'event', node: 'NODO-ABCDE', role: 'sensor',
      event: { score: 0.8, ts: Date.now(), gps: { lat: 44.5, lon: 11.3 } },
    }));
    state.sent++;
  }
}, 1500);

// Campiona lo stato a metà corsa: entrambi devono essere ancora aperti.
let midOk = false;
setTimeout(() => {
  midOk = sensor.readyState === WebSocket.OPEN && viewer.readyState === WebSocket.OPEN;
}, HOLD_MS / 2);

setTimeout(() => {
  clearInterval(emitter);

  const bothOpenAtEnd = sensor.readyState === WebSocket.OPEN && viewer.readyState === WebSocket.OPEN;
  if (!state.sensorOpen) fail('il sensore non si è mai aperto');
  if (!state.viewerOpen) fail('il viewer non si è mai aperto');
  if (state.sensorCloses > 0) fail('il sensore si è disconnesso durante il test');
  if (state.viewerCloses > 0) fail('il viewer si è disconnesso durante il test');
  if (!midOk) fail('a metà corsa uno dei due non era aperto');
  if (!bothOpenAtEnd) fail('a fine corsa uno dei due non era aperto');
  if (state.viewerEvents < 3) fail(`il viewer ha ricevuto troppi pochi eventi (${state.viewerEvents})`);

  console.log(JSON.stringify({
    bothOpenAtEnd, midOk,
    sensorCloses: state.sensorCloses, viewerCloses: state.viewerCloses,
    sent: state.sent, viewerEvents: state.viewerEvents,
  }));
  console.log(process.exitCode ? 'TEST FALLITO' : 'TEST OK: entrambi connessi per 10s, eventi ricevuti');

  sensor.terminate();
  viewer.terminate();
  server.kill('SIGTERM');
  setTimeout(() => process.exit(process.exitCode || 0), 300);
}, HOLD_MS);
