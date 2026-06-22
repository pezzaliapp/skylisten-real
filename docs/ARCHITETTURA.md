# Architettura SkyListen Real

## 0. Componenti e flusso

```
PWA (radice)  --eventi/feature numeriche-->  Server mesh (server/)  --allarme-->  PWA
   |  microfono -> FFT -> feature -> score euristico (+ modello opzionale)
   |  waterfall, GPS, export CSV, service worker offline-first
```

- **PWA** (radice del repo): pubblicata via HTTPS gratuito su GitHub Pages
  (Deploy from a branch), così microfono e GPS funzionano sui telefoni.
  Codice in moduli ES:
  - `js/detector.js` — microfono, FFT, feature, scoring, spettrogramma waterfall
  - `js/mesh.js` — WebSocket, sync clock
  - `js/store.js` — stato nodo, eventi, export CSV
  - `js/dsp.js` + `js/model.js` — log-mel e modello TensorFlow.js **opzionale**
  - `app.js` — wiring UI e loop di rilevamento
- **Server** (`server/`): mesh WebSocket che valuta le conferme multi-nodo e
  stima la zona. Riceve solo dati numerici, mai audio grezzo.
- **Privacy**: niente upload di audio; si trasmettono solo eventi/feature.

## 1. Dataset audio

Fonti gratuite consigliate:
- DADS / Hugging Face per drone/no-drone.
- NASA small UAS flyover acoustics.
- Salford DroneNoise Database.
- ESC-50 e UrbanSound8K per falsi positivi.

## 2. Modello AI

Pipeline gratuita:
- conversione audio a 16 kHz mono;
- finestra 2 secondi;
- mel-spectrogram;
- CNN binaria drone/no-drone;
- export TFLite.

## 3. Sincronizzazione temporale

La PWA usa offset approssimato WebSocket. Per TDOA preciso serve:
- Android nativo con timestamp audio hardware;
- GPS time o NTP/PTP locale;
- dispositivi fissi.

## 4. Triangolazione

Implementazione inclusa: weighted centroid provvisorio.

TDOA reale richiede differenze temporali affidabili tra microfoni. Formula base:

Distanza differenziale = velocità suono * differenza tempo arrivo.

Con tre o più nodi si risolve un sistema iperbolico. La PWA prepara i dati, ma il browser non garantisce timestamp audio abbastanza precisi.

## 5. Anti falsi positivi

Classi negative utili:
- moto/scooter;
- decespugliatori;
- elicotteri;
- traffico;
- vento;
- condizionatori;
- utensili elettrici.

## Passaggio successivo consigliato

Trasformare la PWA in Android nativo Kotlin:
- AudioRecord con timestamp;
- TFLite locale;
- GPS/Network location;
- WebSocket/MQTT;
- salvataggio log SQLite;
- mappa Leaflet/MapLibre lato dashboard.
