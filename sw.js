'use strict';

/*
 * Service worker di SkyListen Real.
 *
 * Strategia:
 *  - cache versionata: cambiare CACHE invalida automaticamente la precedente;
 *  - install: precache degli asset core (best-effort: un asset mancante non
 *    blocca l'installazione) + skipWaiting per attivare subito la nuova versione;
 *  - activate: rimozione di tutte le cache di versioni precedenti + clients.claim;
 *  - fetch:
 *      * navigazioni / index.html -> network-first (così un nuovo deploy si
 *        vede subito), con fallback alla cache e infine a offline.html;
 *      * altri asset same-origin -> cache-first con aggiornamento in background.
 */

const VERSION = 'v8';
const CACHE = `skylisten-${VERSION}`;
const OFFLINE_URL = 'offline.html';

// Asset minimi che servono ad avviare la PWA offline.
const CORE_ASSETS = [
  './',
  'index.html',
  'manuale.html',
  'mappa.html',
  'styles.css',
  'app.js',
  'js/store.js',
  'js/mesh.js',
  'js/detector.js',
  'js/dsp.js',
  'js/model.js',
  'manifest.json',
  'icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  OFFLINE_URL,
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll fallirebbe in blocco se un singolo asset manca: lo facciamo
    // uno per uno per restare robusti ai cambi di struttura del progetto.
    await Promise.all(CORE_ASSETS.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Consente alla pagina di forzare l'attivazione di una nuova versione.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' &&
      (request.headers.get('accept') || '').includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Gestiamo solo GET same-origin; il resto (mesh WebSocket, cross-origin) passa.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

// Network-first: prova la rete, aggiorna la cache, fallback a cache/offline.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request) || await cache.match('index.html');
    return cached || cache.match(OFFLINE_URL);
  }
}

// Cache-first: risponde dalla cache e aggiorna in background; fallback alla rete.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then((response) => { if (response.ok) cache.put(request, response.clone()); })
      .catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cache.match(OFFLINE_URL);
  }
}
