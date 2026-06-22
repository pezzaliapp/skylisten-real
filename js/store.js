'use strict';

/**
 * store.js — stato del nodo, eventi e impostazioni persistenti.
 *
 * Tiene lo stato condiviso fra i moduli (id nodo, posizione GPS, eventi)
 * e si occupa della persistenza in localStorage e dell'export CSV.
 * Non tocca il DOM: l'interfaccia viene aggiornata da app.js.
 */

/**
 * @typedef {Object} Gps
 * @property {number} lat  latitudine in gradi decimali
 * @property {number} lon  longitudine in gradi decimali
 * @property {number} acc  accuratezza stimata in metri
 */

/**
 * Stato condiviso e mutabile del nodo.
 * @type {{ nodeId: string, gps: (Gps|null), events: Array<Object> }}
 */
export const store = {
  nodeId: localStorage.nodeId || ('NODO-' + Math.random().toString(36).slice(2, 7).toUpperCase()),
  gps: null,
  events: [],
};

/**
 * Aggiorna l'id del nodo e lo rende persistente.
 * @param {string} value
 */
export function setNodeId(value) {
  store.nodeId = value;
  localStorage.nodeId = value;
}

/**
 * Registra la posizione GPS corrente del nodo.
 * @param {Gps|null} gps
 */
export function setGps(gps) {
  store.gps = gps;
}

/**
 * Aggiunge un evento alla cronologia locale.
 * @param {Object} event
 */
export function addEvent(event) {
  store.events.push(event);
}

/**
 * Esporta gli eventi locali come file CSV scaricabile.
 * Mantiene lo stesso schema di colonne dell'implementazione originale.
 */
export function exportCsv() {
  const rows = ['ts,node,score,lat,lon,centroid,harmonic,band,rough'];
  for (const e of store.events) {
    rows.push([
      e.ts, e.node, e.score,
      e.gps?.lat || '', e.gps?.lon || '',
      e.centroid, e.harmonic, e.band, e.rough,
    ].join(','));
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'skylisten-events.csv';
  a.click();
}
