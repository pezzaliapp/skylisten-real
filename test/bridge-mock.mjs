/*
 * Test automatico del bridge in modalità MOCK (nessun hardware):
 *   mesh server  ←wss←  bridge(mock)  →  un viewer riceve gli eventi LORA-xx
 *
 * Dimostra che il contratto Transport regge end-to-end prima ancora di avere
 * l'hardware: il giorno della radio reale si sostituisce solo transports/lora.js.
 *
 * Uso:  npm run test:bridge   (oppure: node test/bridge-mock.mjs)
 * Exit 0 = ok, 1 = fallito.
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const require = createRequire(join(ROOT, 'server/'));
const WebSocket = require('ws');

const PORT = 8802;
const URL = `ws://127.0.0.1:${PORT}`;
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };

// Il bridge ha bisogno di 'ws': lo installiamo una volta se manca.
if (!existsSync(join(ROOT, 'bridge/node_modules/ws'))) {
  console.log('Installo le dipendenze del bridge (una tantum)…');
  execSync('npm install --no-audit --no-fund --loglevel=error', { cwd: join(ROOT, 'bridge'), stdio: 'inherit' });
}

const server = spawn('node', [join(ROOT, 'server/server.js')], {
  env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'ignore', 'inherit'],
});
await new Promise((r) => setTimeout(r, 1000));

const bridge = spawn('node', [join(ROOT, 'bridge/bridge.js')], {
  env: { ...process.env, MESH_URL: URL, BRIDGE_MODE: 'mock' }, stdio: ['ignore', 'ignore', 'inherit'],
});
await new Promise((r) => setTimeout(r, 1000));

const viewer = new WebSocket(URL);
const loraEvents = [];
let viewerClosed = false;
viewer.on('open', () => viewer.send(JSON.stringify({ kind: 'hello', node: 'VIEWER-TEST', role: 'viewer' })));
viewer.on('close', () => { viewerClosed = true; });
viewer.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.kind === 'event' && typeof m.node === 'string' && m.node.startsWith('LORA')) loraEvents.push(m);
});

setTimeout(() => {
  const positioned = loraEvents.filter((e) => e.gps && e.gps.lat != null);
  const distinctNodes = new Set(loraEvents.map((e) => e.node)).size;

  if (viewer.readyState !== WebSocket.OPEN) fail('il viewer non è connesso a fine test');
  if (viewerClosed) fail('il viewer si è disconnesso');
  if (positioned.length < 1) fail('nessun evento LoRa posizionato ricevuto dal bridge mock');

  console.log(JSON.stringify({
    loraEvents: loraEvents.length, positioned: positioned.length, distinctNodes,
    viewerOpen: viewer.readyState === WebSocket.OPEN,
  }));
  console.log(process.exitCode ? 'TEST FALLITO' : 'TEST OK: il bridge mock inoltra eventi LoRa, il viewer li riceve');

  try { viewer.terminate(); } catch { /* ignora */ }
  bridge.kill('SIGTERM');
  server.kill('SIGTERM');
  setTimeout(() => process.exit(process.exitCode || 0), 300);
}, 5000);
