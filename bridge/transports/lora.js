'use strict';

/**
 * transports/lora.js — transport radio LoRa REALE (STUB pronto da completare).
 *
 * Implementa lo stesso contratto Transport del simulatore, ma la lettura radio
 * è un segnaposto: va completata quando si collega l'hardware (vedi
 * docs/HARDWARE-LORA.md). `serialport` è importato in modo *lazy*, così il
 * bridge resta installabile e testabile (in mock) senza hardware né toolchain
 * native: nessun costo, nessuna dipendenza obbligatoria oggi.
 *
 * Quando avrai l'hardware:
 *   1) nel bridge:  npm install serialport
 *   2) completa parseFrame() per il formato del tuo modulo/gateway LoRa
 *   3) avvia con mode 'lora' (config.json o BRIDGE_MODE=lora)
 */

export class LoRaSerialTransport {
  /** @param {{port:string, baud:number}} serial */
  constructor(serial = {}) {
    this.serial = serial;
    this._onEvent = () => {};
    this._onStatus = () => {};
    this._port = null;
  }

  onEvent(cb) { this._onEvent = cb || (() => {}); }
  onStatus(cb) { this._onStatus = cb || (() => {}); }

  async start() {
    let serialMod;
    try {
      serialMod = await import('serialport');
    } catch {
      throw new Error(
        "Modulo 'serialport' non installato. Con l'hardware collegato esegui " +
        "`npm install serialport` nella cartella bridge/. Vedi docs/HARDWARE-LORA.md."
      );
    }

    // --- Da completare con l'hardware reale ---
    // const { SerialPort } = serialMod;
    // this._port = new SerialPort({ path: this.serial.port, baudRate: this.serial.baud });
    // this._port.on('data', (buf) => {
    //   const ev = parseFrame(buf);          // -> { node, score, ts, gps }
    //   if (ev) this._onEvent({ ...ev, source: 'lora' });
    // });
    // this._onStatus(`LoRa in ascolto su ${this.serial.port} @ ${this.serial.baud}`);
    void serialMod;
    throw new Error(
      'Lettura LoRa non ancora implementata: completare parseFrame() per il proprio ' +
      'modulo. Vedi docs/HARDWARE-LORA.md. (Per provare il bridge ora usa mode "mock".)'
    );
  }

  stop() {
    if (this._port) { try { this._port.close(); } catch { /* ignora */ } this._port = null; }
  }
}

// Esempio di parser di frame radio -> evento normalizzato (da adattare):
// function parseFrame(buf) {
//   // es. frame CSV "LORA-01,0.82,44.5012,11.342"
//   const [node, score, lat, lon] = String(buf).trim().split(',');
//   if (!node) return null;
//   return { node, score: Number(score), ts: Date.now(),
//            gps: (lat && lon) ? { lat: Number(lat), lon: Number(lon), acc: 25 } : null };
// }
