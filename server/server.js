'use strict';

/**
 * SkyListen Real — server mesh WebSocket.
 *
 * Sincronizza i nodi (telefoni) nella stessa rete locale: riceve eventi e
 * feature numeriche, sincronizza il clock e, quando abbastanza nodi confermano
 * insieme, stima la zona e diffonde un allarme. Non riceve né salva audio grezzo.
 *
 * Configurazione via variabili d'ambiente:
 *   PORT          porta di ascolto              (default 8787)
 *   HOST          indirizzo di bind             (default 0.0.0.0)
 *   MAX_PAYLOAD   dimensione max messaggio (B)  (default 65536)
 *   MAX_MSG_RATE  messaggi/sec per client       (default 50)
 */

import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_PAYLOAD = Number(process.env.MAX_PAYLOAD) || 64 * 1024;
const MAX_MSG_RATE = Number(process.env.MAX_MSG_RATE) || 50;

const CONFIRM_WINDOW_MS = 8000; // finestra di conferma multi-nodo
const CONFIRM_MIN_SCORE = 0.55; // score minimo per contare come conferma
const CONFIRM_NODES = 3;        // nodi distinti necessari all'allarme
const EVENTS_MAX = 500;         // dimensione massima del buffer eventi
const HEARTBEAT_MS = 30000;     // intervallo ping per scollegare i client morti
const RELAY_THROTTLE_MS = 500;  // ritrasmissione max degli eventi posizionati per nodo

/** Logger strutturato in JSON (una riga per evento). */
function log(level, msg, extra = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), level, msg, ...extra }));
}

const wss = new WebSocketServer({ host: HOST, port: PORT, maxPayload: MAX_PAYLOAD });

/** @type {Map<string, {ws: import('ws').WebSocket, gps: any, last: number}>} */
const clients = new Map();
/** @type {Array<Object>} buffer circolare degli eventi ricevuti */
let events = [];

/** Invia un oggetto JSON a tutti i client connessi. */
function broadcast(o) {
  const s = JSON.stringify(o);
  for (const c of wss.clients) {
    if (c.readyState === c.OPEN) {
      try { c.send(s); } catch (err) { log('warn', 'send fallita', { error: String(err) }); }
    }
  }
}

/** Invia un oggetto JSON a un singolo socket, ignorando errori di rete. */
function sendTo(ws, o) {
  try { ws.send(JSON.stringify(o)); } catch (err) { log('warn', 'send fallita', { error: String(err) }); }
}

/** Distanza in metri fra due coordinate (formula dell'emisenoverso). */
function dist(a, b) {
  const R = 6371000, to = (x) => x * Math.PI / 180;
  const dlat = to(b.lat - a.lat), dlon = to(b.lon - a.lon);
  const x = Math.sin(dlat / 2) ** 2 +
    Math.cos(to(a.lat)) * Math.cos(to(b.lat)) * Math.sin(dlon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Stima la zona come centroide pesato sugli score (pre-TDOA). */
function estimate(recent) {
  const pts = recent.filter((e) => e.gps && e.gps.lat && e.gps.lon);
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
    nodes: pts.map((p) => p.node),
  };
}

/** Valuta la finestra recente e diffonde lo stato di allarme. */
function evaluate() {
  const t = Date.now();
  const recent = events.filter((e) => t - e.received < CONFIRM_WINDOW_MS && (e.score || 0) > CONFIRM_MIN_SCORE);
  const nodes = new Set(recent.map((e) => e.node));
  if (nodes.size >= CONFIRM_NODES) {
    broadcast({
      kind: 'alarm', level: 'CONFERMATO', count: nodes.size,
      estimate: estimate(recent),
      events: recent.map((e) => ({ node: e.node, score: e.score, ts: e.ts, gps: e.gps })),
    });
  } else {
    broadcast({ kind: 'alarm', level: nodes.size ? 'PARZIALE' : 'NESSUNO', count: nodes.size, estimate: null });
  }
}

/**
 * Ritrasmette agli altri client gli eventi *posizionati*, in forma ridotta
 * (solo nodo/score/ts/gps, mai audio), così la mappa pubblica può mostrare i
 * marker dei nodi in tempo reale. Throttling per nodo per non saturare la rete.
 */
const lastRelay = new Map();
function relayEvent(ev) {
  if (!ev.gps || ev.gps.lat == null || ev.gps.lon == null) return;
  const now = Date.now();
  if (now - (lastRelay.get(ev.node) || 0) < RELAY_THROTTLE_MS) return;
  lastRelay.set(ev.node, now);
  broadcast({ kind: 'event', node: ev.node, score: ev.score, ts: ev.ts, gps: ev.gps });
}

/** Semplice limitatore di frequenza per client (messaggi/sec). */
function rateLimited(state) {
  const now = Date.now();
  if (now - state.windowStart >= 1000) { state.windowStart = now; state.count = 0; }
  return ++state.count > MAX_MSG_RATE;
}

wss.on('connection', (ws, req) => {
  let id = 'unknown';
  const rate = { windowStart: Date.now(), count: 0 };
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  const peer = req.socket.remoteAddress;
  log('info', 'client connesso', { peer });
  sendTo(ws, { kind: 'info', text: 'SkyListen server ready' });

  ws.on('message', (buf) => {
    if (rateLimited(rate)) return; // scarta i messaggi oltre la soglia
    let m;
    try {
      m = JSON.parse(buf);
    } catch {
      sendTo(ws, { kind: 'info', text: 'JSON errato' });
      return;
    }
    if (!m || typeof m !== 'object') return;

    try {
      id = (typeof m.node === 'string' && m.node) ? m.node : id;
      clients.set(id, { ws, gps: m.gps, last: Date.now() });

      if (m.kind === 'sync') {
        sendTo(ws, { kind: 'sync_reply', serverTs: Date.now() });
      } else if (m.kind === 'hello') {
        broadcast({ kind: 'info', text: `${id} online` });
      } else if (m.kind === 'event' && m.event && typeof m.event === 'object') {
        const ev = { ...m.event, node: id, gps: m.event.gps || m.gps, received: Date.now() };
        events.push(ev);
        if (events.length > EVENTS_MAX) events = events.slice(-EVENTS_MAX);
        evaluate();
        relayEvent(ev);
      }
    } catch (err) {
      log('error', 'gestione messaggio fallita', { id, error: String(err) });
    }
  });

  ws.on('close', () => {
    clients.delete(id);
    log('info', 'client disconnesso', { id });
  });

  ws.on('error', (err) => log('warn', 'errore socket', { id, error: String(err) }));
});

// Heartbeat: scollega i client che non rispondono al ping.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* ignora */ }
  }
}, HEARTBEAT_MS);

// Rivaluta periodicamente per far decadere le conferme scadute.
const evaluator = setInterval(evaluate, 3000);

wss.on('listening', () => log('info', 'server in ascolto', { host: HOST, port: PORT }));
wss.on('error', (err) => log('error', 'errore server', { error: String(err) }));

/** Spegnimento ordinato su segnale. */
function shutdown(signal) {
  log('info', 'arresto in corso', { signal });
  clearInterval(heartbeat);
  clearInterval(evaluator);
  for (const ws of wss.clients) { try { ws.close(1001, 'server shutdown'); } catch { /* ignora */ } }
  wss.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => log('error', 'eccezione non gestita', { error: String(err) }));
