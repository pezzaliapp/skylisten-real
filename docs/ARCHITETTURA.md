# Architettura SkyListen Real

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
