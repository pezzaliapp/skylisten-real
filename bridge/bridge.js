'use strict';

/**
 * bridge.js — ponte fra una sorgente radio (mock oggi, LoRa reale domani) e la
 * mesh WebSocket di SkyListen.
 *
 * È un ARCHIVIO: non è un servizio sempre attivo. Si scarica dal repo e si
 * avvia SOLO quando serve (es. quando si collega un modulo LoRa). Legge eventi
 * nodo normalizzati da un "transport" (stesso contratto della demo PWA) e li
 * inoltra al mesh server, che calcola conferma e zona come per i telefoni.
 *
 * Privacy invariata: inoltra solo eventi numerici (id nodo, score, ts, gps),
 * mai audio.
 *
 * Configurazione: bridge.js legge ./config.json se presente (vedi
 * config.example.json), poi applica gli override da variabili d'ambiente:
 *   MESH_URL, ROOM_KEY, BRIDGE_MODE ('mock'|'lora'), SERIAL_PORT, SERIAL_BAUD
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const WebSocket = require('ws');

/** Log strutturato in JSON, una riga per evento. */
const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), level, msg, ...extra }));

function loadConfig() {
  let cfg = {};
  try {
    cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));
  } catch { /* config.json opzionale: si usano default + env */ }
  return {
    meshUrl: process.env.MESH_URL || cfg.meshUrl || 'ws://localhost:8787',
    roomKey: process.env.ROOM_KEY || cfg.roomKey || '',
    mode: process.env.BRIDGE_MODE || cfg.mode || 'mock',
    serial: {
      port: process.env.SERIAL_PORT || cfg.serial?.port || '/dev/ttyUSB0',
      baud: Number(process.env.SERIAL_BAUD) || cfg.serial?.baud || 115200,
    },
  };
}

/** Crea il transport richiesto. Il modulo radio reale è caricato solo se serve. */
async function makeTransport(config) {
  if (config.mode === 'lora') {
    const { LoRaSerialTransport } = await import('./transports/lora.js');
    return new LoRaSerialTransport(config.serial);
  }
  const { MockRadioTransport } = await import('./transports/mock.js');
  return new MockRadioTransport();
}

async function main() {
  const config = loadConfig();
  log('info', 'bridge avviato', { mode: config.mode, meshUrl: config.meshUrl });

  const transport = await makeTransport(config);
  transport.onStatus?.((text) => log('info', 'transport', { text }));

  let ws = null;
  let manualClose = false;
  let backoff = 1000;
  let queue = []; // eventi in attesa mentre la mesh è disconnessa (breve)

  function forward(ev) {
    const msg = {
      kind: 'event',
      node: ev.node,
      role: 'sensor',
      key: config.roomKey || undefined,
      event: { score: ev.score, ts: ev.ts, gps: ev.gps },
    };
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else { queue.push(msg); if (queue.length > 200) queue.shift(); }
  }

  function openMesh() {
    ws = new WebSocket(config.meshUrl);
    ws.on('open', () => {
      backoff = 1000;
      log('info', 'mesh connessa', { meshUrl: config.meshUrl });
      ws.send(JSON.stringify({ kind: 'hello', node: 'BRIDGE-LORA', role: 'sensor', key: config.roomKey || undefined }));
      const pending = queue; queue = [];
      for (const m of pending) ws.send(JSON.stringify(m));
    });
    ws.on('close', () => {
      if (manualClose) return;
      log('warn', 'mesh disconnessa: riconnessione', { inMs: backoff });
      setTimeout(openMesh, backoff);
      backoff = Math.min(backoff * 2, 10000);
    });
    ws.on('error', (err) => log('warn', 'errore mesh', { error: String(err) }));
  }

  transport.onEvent(forward);
  openMesh();
  await transport.start();
  log('info', 'in ascolto dal transport', { mode: config.mode });

  function shutdown(signal) {
    log('info', 'arresto', { signal });
    manualClose = true;
    try { transport.stop(); } catch { /* ignora */ }
    try { ws?.close(); } catch { /* ignora */ }
    setTimeout(() => process.exit(0), 200).unref();
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => { log('error', 'avvio fallito', { error: String(err) }); process.exit(1); });
