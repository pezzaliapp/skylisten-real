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
 * Identità di questa connessione. I "sensore" usano l'id del nodo (store);
 * i "viewer" (es. la mappa, sola lettura) hanno un id separato e non vanno
 * registrati come nodi-sensore lato server.
 * @type {{ role: ('sensor'|'viewer'), node: (string|null) }}
 */
let identity = { role: 'sensor', node: null };

// Stato per la riconnessione automatica.
let lastUrl = null;
let lastCb = {};
let manualClose = false;
let reconnectTimer = null;
let backoff = 1000; // ms, con crescita esponenziale fino a 10s

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
 * @param {{ role?: ('sensor'|'viewer'), nodeId?: string }} [opts]
 *   role 'viewer' per i consumatori di sola lettura (es. la mappa): ricevono
 *   gli aggiornamenti ma non si registrano come nodi-sensore.
 */
export function connect(url, cb = {}, opts = {}) {
  identity.role = opts.role === 'viewer' ? 'viewer' : 'sensor';
  identity.node = opts.nodeId ||
    (identity.role === 'viewer'
      ? 'VIEWER-' + Math.random().toString(36).slice(2, 7).toUpperCase()
      : null); // null => usa l'id del nodo dallo store
  lastUrl = url;
  lastCb = cb;
  manualClose = false;
  openSocket();
}

/** (Ri)apre il socket usando l'ultima url/callback note. */
function openSocket() {
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  ws = new WebSocket(lastUrl);

  ws.onopen = () => {
    backoff = 1000; // reset del backoff a connessione riuscita
    lastCb.onStatus?.('Connesso');
    lastCb.onLog?.('Mesh connessa');
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
      lastCb.onAlarm?.(m);
    } else if (m.kind === 'event') {
      lastCb.onEvent?.(m);
    } else if (m.kind === 'sync_reply') {
      clockOffset = m.serverTs - Date.now();
      lastCb.onLog?.('Offset clock ' + clockOffset + ' ms');
    } else if (m.kind === 'info') {
      lastCb.onLog?.('Server: ' + m.text);
    }
  };

  // Una chiusura non voluta (rete, riavvio server) avvia la riconnessione:
  // così le pagine restano connesse in modo robusto e indipendente.
  ws.onclose = () => {
    if (manualClose) {
      lastCb.onStatus?.('Disconnesso');
      return;
    }
    lastCb.onStatus?.('Riconnessione…');
    reconnectTimer = setTimeout(openSocket, backoff);
    backoff = Math.min(backoff * 2, 10000);
  };

  ws.onerror = () => lastCb.onLog?.('Errore connessione mesh');
}

/** Chiude volontariamente la connessione e ferma la riconnessione. */
export function disconnect() {
  manualClose = true;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (ws) ws.close();
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
      node: identity.node || store.nodeId,
      role: identity.role,
      clientTs: Date.now(),
      gps: store.gps,
    }));
  }
}

/** Richiede la sincronizzazione del clock con il server. */
export function syncClock() {
  send({ kind: 'sync' });
}
