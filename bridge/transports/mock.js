'use strict';

/**
 * transports/mock.js — transport radio MOCK del bridge.
 *
 * Riusa il simulatore condiviso (lo STESSO della demo PWA): permette di provare
 * il bridge end-to-end senza alcun hardware. Il giorno della radio reale si usa
 * invece transports/lora.js, che implementa lo stesso contratto Transport.
 */

export { SimulatedLoRaTransport as MockRadioTransport } from '../../shared/transport.js';
