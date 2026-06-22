# SkyListen Real

Progetto gratuito e locale per prototipo reale di rete acustica civile anti-drone.

## App online (HTTPS gratuito)

La PWA e' pubblicata su GitHub Pages (dominio custom):

**https://www.alessandropezzali.it/skylisten-real/**

Aprila dal telefono e installala (Aggiungi a schermata Home). Essendo servita via
HTTPS, **microfono e GPS funzionano senza configurazioni a pagamento**, risolvendo
il limite principale dell'uso in locale.

## Cosa contiene

La PWA è servita dalla **radice del repo** (così GitHub Pages la pubblica come
home del sito). Gli altri componenti stanno nelle rispettive cartelle:

- PWA installabile (radice): microfono, GPS, analisi spettrale con spettrogramma
  a cascata (waterfall), eventi, export CSV, service worker offline-first.
  Codice in moduli ES (`js/`).
- `server/` WebSocket server per sincronizzare più telefoni nella stessa rete.
  Vedi [`server/README.md`](server/README.md).
- `training/` script Python per addestrare un classificatore drone/no-drone con
  dataset gratuiti. Vedi [`training/README.md`](training/README.md).
- `datasets/` cartelle dove inserire audio drone e falsi positivi.
- `docs/ARCHITETTURA.md` schema operativo.
- `model/` modello TensorFlow.js **opzionale**: se presente, il suo score viene
  combinato con l'euristica FFT. Vedi [`model/README.md`](model/README.md).

## Struttura della PWA

```
index.html      UI semantica e accessibile
styles.css      stile
app.js          wiring UI + loop di rilevamento
js/detector.js  microfono, FFT, feature, scoring, waterfall
js/mesh.js      WebSocket + sync clock
js/store.js     stato nodo, eventi, export CSV
js/dsp.js       log-mel spectrogram (per il modello opzionale)
js/model.js     aggancio TensorFlow.js opzionale
sw.js           service worker (cache versionata, offline-first)
manifest.json   + icons/ (PNG 192/512, maskable)
```

## Avvio rapido

1. Copia la cartella su un PC nella stessa rete Wi-Fi dei telefoni.
2. Avvia server mesh:

```bash
cd server
npm install
npm start
```

3. Avvia un web server per la PWA (dalla radice del repo):

```bash
python3 -m http.server 8080
```

4. Apri sui telefoni:

```text
http://IP_DEL_PC:8080
```

Per microfono/GPS su browser serve spesso HTTPS. In test locale Chrome Android permette alcune funzioni su rete locale, ma per uso serio conviene pubblicare su HTTPS o usare una app Android nativa.

## Dataset gratuiti da scaricare manualmente

Cerca e scarica legalmente:

- DroneAudioDataset GitHub
- NASA Small UAS Flyover Acoustics Data
- DADS Drone Audio Detection Samples su Hugging Face
- DroneNoise Database University of Salford
- ESC-50
- UrbanSound8K

Metti gli audio così:

```text
datasets/drone/*.wav
datasets/no_drone/*.wav
```

Poi:

```bash
cd training
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python train_drone_classifier.py
```

## Sviluppo e qualità (opzionale, costo zero)

Strumenti di sviluppo disponibili come `devDependencies`, mai richiesti per
usare la PWA (che resta servibile come file statici):

```bash
npm install        # eslint + prettier
npm run lint       # analisi statica
npm run format     # formattazione
npm run icons      # rigenera le icone PNG dall'SVG
npm run serve      # serve la radice del repo su http://localhost:8080
```

Linee guida per contribuire: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Nota onesta

Questa è una base reale, non una magia: il rilevamento diventa serio solo con dataset veri, test sul campo, soglie tarate e almeno 3-5 sensori fissi.
