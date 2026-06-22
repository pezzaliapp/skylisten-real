# SkyListen Real

Progetto gratuito e locale per prototipo reale di rete acustica civile anti-drone.

## App online (HTTPS gratuito)

La PWA e' pubblicata automaticamente su GitHub Pages a ogni push su `main`:

**https://pezzaliapp.github.io/skylisten-real/**

Aprila dal telefono e installala (Aggiungi a schermata Home). Essendo servita via
HTTPS, **microfono e GPS funzionano senza configurazioni a pagamento**, risolvendo
il limite principale dell'uso in locale.

> Per attivare la pubblicazione una sola volta: su GitHub vai in
> **Settings → Pages → Build and deployment → Source: GitHub Actions**.
> Da quel momento ogni push su `main` aggiorna il sito.

## Cosa contiene

- `app/` PWA installabile su telefoni: microfono, GPS, analisi spettrale, eventi, export CSV.
- `server/` WebSocket server per sincronizzare più telefoni nella stessa rete.
- `training/` script Python per addestrare un classificatore drone/no-drone con dataset gratuiti.
- `datasets/` cartelle dove inserire audio drone e falsi positivi.
- `docs/ARCHITETTURA.md` schema operativo.

## Avvio rapido

1. Copia la cartella su un PC nella stessa rete Wi-Fi dei telefoni.
2. Avvia server mesh:

```bash
cd server
npm install
npm start
```

3. Avvia un web server per la PWA:

```bash
cd ../app
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

## Nota onesta

Questa è una base reale, non una magia: il rilevamento diventa serio solo con dataset veri, test sul campo, soglie tarate e almeno 3-5 sensori fissi.
