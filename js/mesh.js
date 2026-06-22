'use strict';

/**
 * mesh.js — connessione WebSocket alla mesh e sincronizzazione del clock.
 *
 * Espone una API minimale verso app.js: connect/send/syncClock e now().
 * Gli aggiornamenti dell'interfaccia avvengono tramite callback, così il
 * modulo resta indipendente dal DOM. Si inviano solo eventi e feature
 * numeriche, mai audio grezzo.
 */

import { store } from './store.js';

/** @type {WebSocket|null} */
let ws = null;

/** Offset (ms) fra l'orologio locale e quello del server, da syncClock(). */
let clockOffset = 0;

/**
 * Timestamp corrente corretto con l'offset del server.
 * @returns {number} millisecondi epoch sincronizzati
 */
export function now() {
  return Date.now() + clockOffset;
}

/**
 * @typedef {Object} MeshCallbacks
 * @property {(text:string)=>void} [onLog]     riga di log
 * @property {(text:string)=>void} [onStatus]  stato connessione (Connesso/...)
 * @property {(msg:Object)=>void}  [onAlarm]   messaggio di allarme dal server
 * @property {(msg:Object)=>void}  [onEvent]   evento posizionato di un nodo (per la mappa)
 */

/**
 * Apre la connessione WebSocket verso la mesh.
 * @param {string} url  es. "ws://192.168.1.10:8787"
 * @param {MeshCallbacks} [cb]
 */
export function connect(url, cb = {}) {
  ws = new WebSocket(url);

  ws.onopen = () => {
    cb.onStatus?.('Connesso');
    cb.onLog?.('Mesh connessa');
    send({ kind: 'hello' });
  };

  ws.onmessage = (e) => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    if (m.kind === 'alarm') {
      cb.onAlarm?.(m);
    } else if (m.kind === 'event') {
      cb.onEvent?.(m);
    } else if (m.kind === 'sync_reply') {
      clockOffset = m.serverTs - Date.now();
      cb.onLog?.('Offset clock ' + clockOffset + ' ms');
    } else if (m.kind === 'info') {
      cb.onLog?.('Server: ' + m.text);
    }
  };

  ws.onclose = () => cb.onStatus?.('Disconnesso');
  ws.onerror = () => cb.onLog?.('Errore connessione mesh');
}

/**
 * Invia un messaggio alla mesh arricchendolo con nodo, timestamp e GPS.
 * No-op se la connessione non è aperta.
 * @param {Object} payload
 */
export function send(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      ...payload,
      node: store.nodeId,
      clientTs: Date.now(),
      gps: store.gps,
    }));
  }
}

/** Richiede la sincronizzazione del clock con il server. */
export function syncClock() {
  send({ kind: 'sync' });
}
