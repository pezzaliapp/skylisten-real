'use strict';

/**
 * shared/transport.js — contratto "Transport" condiviso fra la PWA (demo) e il
 * bridge (Raspberry/PC), più il simulatore di rete radio LoRa.
 *
 * È un modulo ES *runtime-agnostico*: niente DOM, niente API di Node. Gira sia
 * nel browser sia in Node, così la demo della PWA e la modalità mock del bridge
 * usano LO STESSO simulatore. Il giorno dell'hardware si sostituisce solo la
 * parte radio nel bridge (transport reale), lasciando invariato tutto il resto.
 *
 * Contratto Transport:
 *   start()        avvia la sorgente (simulatore: genera · reale: apre la radio)
 *   stop()         ferma/chiude
 *   onEvent(cb)    registra il consumer degli EVENTI NODO normalizzati
 *   onStatus(cb)   (opzionale) stato testuale
 *
 * Evento nodo normalizzato (stesso schema della mesh SkyListen, solo numeri/id,
 * mai audio):
 *   { node, score(0..1), ts(ms), gps:{lat,lon,acc}|null, source }
 *   source: 'lora-sim' (simulato) | 'lora' (radio reale) | 'mesh'
 *
 * @typedef {Object} NodeEvent
 * @property {string} node
 * @property {number} score
 * @property {number} ts
 * @property {{lat:number,lon:number,acc?:number}|null} gps
 * @property {('lora-sim'|'lora'|'mesh')} source
 *
 * @typedef {Object} Transport
 * @property {() => (void|Promise<void>)} start
 * @property {() => void} stop
 * @property {(cb:(e:NodeEvent)=>void)=>void} onEvent
 * @property {(cb:(text:string)=>void)=>void} [onStatus]
 */

/** Nodi radio simulati (sensori fissi attorno a un'area; coord. di esempio). */
const SIM_NODES = [
  { node: 'LORA-01', lat: 44.490, lon: 11.330 },
  { node: 'LORA-02', lat: 44.512, lon: 11.360 },
  { node: 'LORA-03', lat: 44.505, lon: 11.325 },
  { node: 'LORA-04', lat: 44.498, lon: 11.356 },
];

const TICK_MS = 1000;   // un campione al secondo per nodo
const CYCLE_S = 14;     // periodo del "passaggio drone" simulato
const PASS_FROM_S = 8;  // finestra in cui 3 nodi superano la soglia
const PASS_TO_S = 13;

/**
 * Simulatore di rete radio LoRa: genera eventi nodo realistici (rumore di fondo
 * basso, con "passaggi" periodici in cui ≥3 nodi confermano insieme). Non
 * dipende da hardware né da Internet. Implementa il contratto Transport.
 * @implements {Transport}
 */
export class SimulatedLoRaTransport {
  /** @param {{nodes?: Array<{node:string,lat:number,lon:number}>}} [opts] */
  constructor(opts = {}) {
    this.nodes = opts.nodes || SIM_NODES;
    this._onEvent = () => {};
    this._onStatus = () => {};
    this._timer = null;
    this._t = 0;
  }

  /** @param {(e:NodeEvent)=>void} cb */
  onEvent(cb) { this._onEvent = cb || (() => {}); }

  /** @param {(text:string)=>void} cb */
  onStatus(cb) { this._onStatus = cb || (() => {}); }

  start() {
    if (this._timer) return;
    this._onStatus(`Simulazione LoRa attiva — ${this.nodes.length} nodi radio (dati finti)`);
    this._timer = setInterval(() => this._tick(), TICK_MS);
    this._tick(); // primo campione immediato
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._onStatus('Simulazione LoRa ferma');
  }

  _tick() {
    const sec = this._t % CYCLE_S;
    const passing = sec >= PASS_FROM_S && sec <= PASS_TO_S;
    const ts = Date.now();
    this.nodes.forEach((n, i) => {
      const high = passing && i < 3; // 3 nodi confermano durante il passaggio
      const base = high ? 0.70 : (passing ? 0.30 : 0.12);
      const jitter = Math.random() * (high ? 0.22 : 0.18);
      const score = Math.max(0, Math.min(1, base + jitter));
      this._onEvent({
        node: n.node,
        score: +score.toFixed(2),
        ts,
        gps: { lat: n.lat, lon: n.lon, acc: 25 },
        source: 'lora-sim',
      });
    });
    this._t += 1;
  }
}
