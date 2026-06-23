'use strict';

/**
 * shared/evaluate.js — valutazione allarme multi-nodo e stima di zona.
 *
 * Stessa logica del server (`server/server.js`), estratta come modulo puro e
 * runtime-agnostico così che la DEMO della PWA, che gira offline senza server,
 * possa calcolare conferma e zona esattamente come farebbe il server reale.
 * La demo resta quindi un'anteprima fedele.
 *
 * Nota: per ora il server mantiene la sua copia della logica (zero regressioni);
 * una futura deduplica potrà far importare al server questo stesso modulo.
 */

export const CONFIRM_WINDOW_MS = 8000; // finestra di conferma multi-nodo
export const CONFIRM_MIN_SCORE = 0.55; // score minimo per contare come conferma
export const CONFIRM_NODES = 3;        // nodi distinti necessari all'allarme

/** Distanza in metri fra due coordinate (formula dell'emisenoverso). */
function dist(a, b) {
  const R = 6371000, to = (x) => x * Math.PI / 180;
  const dlat = to(b.lat - a.lat), dlon = to(b.lon - a.lon);
  const x = Math.sin(dlat / 2) ** 2 +
    Math.cos(to(a.lat)) * Math.cos(to(b.lat)) * Math.sin(dlon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Stima la zona come centroide pesato sugli score (pre-TDOA).
 * @param {Array<{node:string,score:number,gps:{lat:number,lon:number}}>} recent
 * @returns {Object|null}
 */
export function estimateZone(recent) {
  const pts = recent.filter((e) => e.gps && e.gps.lat != null && e.gps.lon != null);
  if (!pts.length) return null;
  let sw = 0, lat = 0, lon = 0;
  for (const e of pts) {
    const w = Math.max(0.1, e.score || 0.1);
    sw += w; lat += e.gps.lat * w; lon += e.gps.lon * w;
  }
  const center = { lat: lat / sw, lon: lon / sw };
  const radius = Math.max(30, ...pts.map((p) => dist(center, p.gps))) + 50;
  return {
    method: 'weighted-centroid-preTDOA',
    lat: +center.lat.toFixed(6),
    lon: +center.lon.toFixed(6),
    radius_m: Math.round(radius),
    nodes: [...new Set(pts.map((p) => p.node))],
  };
}

/**
 * Valuta la finestra recente e produce lo stato di allarme, nello stesso
 * formato dei messaggi `alarm` del server.
 * @param {Array<{node:string,score:number,ts:number,gps:any}>} events
 * @param {number} [now]
 * @returns {{level:string,count:number,estimate:(Object|null),events?:Array}}
 */
export function evaluate(events, now = Date.now()) {
  const recent = events.filter((e) => now - e.ts < CONFIRM_WINDOW_MS && (e.score || 0) > CONFIRM_MIN_SCORE);
  const nodes = new Set(recent.map((e) => e.node));
  if (nodes.size >= CONFIRM_NODES) {
    return {
      level: 'CONFERMATO',
      count: nodes.size,
      estimate: estimateZone(recent),
      events: recent.map((e) => ({ node: e.node, score: e.score, ts: e.ts, gps: e.gps })),
    };
  }
  return { level: nodes.size ? 'PARZIALE' : 'NESSUNO', count: nodes.size, estimate: null };
}
