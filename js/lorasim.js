'use strict';

/**
 * js/lorasim.js — adattatore PWA della demo "rete radio LoRa".
 *
 * Collega il simulatore condiviso (shared/transport.js) e la valutazione
 * condivisa (shared/evaluate.js) ai render già esistenti della mappa, così la
 * demo riusa mappa e logica senza duplicarle. È una *simulazione*: nessun
 * hardware, nessuna Internet, dati finti chiaramente etichettati.
 *
 * Resta distinta dalla mesh WebSocket reale: qui non si apre alcun socket.
 */

import { SimulatedLoRaTransport } from '../shared/transport.js';
import { evaluate } from '../shared/evaluate.js';

/** @type {SimulatedLoRaTransport|null} */
let transport = null;
let events = [];

/** @returns {boolean} true se la simulazione è in corso. */
export function isRunning() {
  return !!transport;
}

/**
 * Avvia la simulazione. I callback ricevono dati nello stesso formato della
 * mesh reale, così i render della mappa funzionano identici.
 * @param {{ onEvent?:(e:Object)=>void, onAlarm?:(a:Object)=>void, onStatus?:(t:string)=>void }} cb
 */
export function start(cb = {}) {
  stop();
  events = [];
  transport = new SimulatedLoRaTransport();
  transport.onStatus(cb.onStatus || (() => {}));
  transport.onEvent((ev) => {
    cb.onEvent?.(ev);
    const now = Date.now();
    events.push(ev);
    events = events.filter((e) => now - e.ts < 10000); // buffer breve
    cb.onAlarm?.(evaluate(events, now));
  });
  transport.start();
}

/** Ferma la simulazione. */
export function stop() {
  if (transport) { transport.stop(); transport = null; }
  events = [];
}
