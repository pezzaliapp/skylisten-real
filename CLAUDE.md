# CLAUDE.md — Istruzioni operative per Claude Code

Questo file è il punto di partenza. Leggilo prima di toccare il codice.
Obiettivo del proprietario del repo: **rendere il progetto più professionale,
senza introdurre costi, mantenendolo pienamente utilizzabile per il suo scopo.**

---

## 1. Cos'è SkyListen Real

Prototipo civile e gratuito di **rete acustica per il rilevamento di droni**.
Più telefoni diventano sensori: ascoltano l'audio ambientale, ne estraggono
caratteristiche spettrali, calcolano uno "score drone" e si sincronizzano via
WebSocket. Se abbastanza nodi confermano insieme, il server stima una zona.

Non è un'arma e non è un sistema di disturbo/jamming: è **solo rilevamento
passivo difensivo**. Mantieni questa natura in ogni modifica.

### Struttura attuale
```
app/        PWA installabile: microfono, FFT, GPS, eventi, export CSV, service worker
server/     Server WebSocket mesh (Node, dipendenza: ws) per sincronizzare i nodi
training/   Script Python: addestra un classificatore drone/no-drone, esporta TFLite
datasets/   Cartelle dove l'utente mette gli audio (drone/ e no_drone/)
docs/       ARCHITETTURA.md con lo schema operativo
```

### Come gira oggi
- Server mesh: `cd server && npm install && npm start` (porta 8787)
- PWA in locale: `cd app && python3 -m http.server 8080`
- Training: vedi README, richiede audio nei dataset

---

## 2. Stato del codice (analisi iniziale)

Il progetto **funziona**, ma è scritto in forma compressa e poco manutenibile:

- `app/index.html`: CSS inline tutto su una riga, nessuna struttura semantica,
  scarsa accessibilità (no ARIA, no focus visibile, no `<label>` collegate bene).
- `app/app.js`: tutta la logica (audio, FFT, scoring, WebSocket, GPS, CSV) in un
  unico file minificato senza commenti. Difficile da estendere.
- `app/sw.js`: cache statica `skylisten-v1` senza versioning né fallback offline;
  un aggiornamento non invalida la cache vecchia.
- `app/manifest.json`: solo icona SVG, manca `purpose: maskable`, screenshots,
  categorie, descrizione → installabilità e resa su Android non ottimali.
- Nessuna icona PNG (192/512) → alcuni dispositivi non mostrano l'icona.
- `server/server.js`: funzionante ma minificato e senza gestione errori robusta.
- `training/train_drone_classifier.py`: ok, ma `model.save()` usa il formato
  SavedModel via cartella; su Keras 3 conviene verificare l'export TFLite.
- Mancano: LICENSE applicata nel codice, .gitignore (presente ora), test, lint,
  deploy HTTPS gratuito, documentazione di contribuzione.

Il limite #1 dichiarato dall'autore: **microfono e GPS richiedono HTTPS**.
In locale è scomodo. La soluzione a costo zero è il deploy su **GitHub Pages**
(HTTPS gratuito), che risolve il problema senza spendere nulla.

---

## 3. Roadmap di professionalizzazione (prioritizzata, COSTO ZERO)

Affronta i task in quest'ordine. Fai commit piccoli e descrittivi per ognuno.

### Priorità ALTA — sblocca l'uso reale
1. **Deploy gratuito su GitHub Pages.** Crea `.github/workflows/deploy-pages.yml`
   che pubblica la cartella `app/` su Pages a ogni push su `main`. Questo dà
   HTTPS gratuito → microfono e GPS funzionano sui telefoni senza costi.
   Aggiorna il README con l'URL `https://pezzaliapp.github.io/skylisten-real/`.
2. **Service worker robusto.** Versiona la cache (es. `skylisten-v2`), strategia
   network-first per `index.html`, cache-first per gli asset, pulizia delle cache
   vecchie in `activate`, pagina `offline.html` di fallback. La PWA deve
   aggiornarsi correttamente quando ridistribuisci.
3. **Manifest e icone complete.** Genera icone PNG 192 e 512 (anche `maskable`)
   dall'SVG esistente (puoi usare ImageMagick: `convert -background none icon.svg
   -resize 512x512 icons/icon-512.png`). Arricchisci il manifest: `description`,
   `categories`, `lang: "it"`, `orientation`, `purpose` corretti.

### Priorità MEDIA — qualità e manutenibilità
4. **Refactor della PWA in moduli leggibili.** Estrai il CSS in `app/styles.css`,
   spezza `app.js` in moduli ES (`js/detector.js` audio+FFT+scoring,
   `js/mesh.js` WebSocket+sync clock, `js/store.js` impostazioni+eventi+CSV,
   `app.js` solo wiring UI). Aggiungi JSDoc. Nessun cambiamento di comportamento.
5. **Accessibilità e UX.** HTML semantico, `aria-live` sullo stato/allarme,
   focus visibile, contrasto adeguato, layout responsive fino al mobile,
   rispetto di `prefers-reduced-motion`. Testi UI in voce attiva e coerenti.
6. **Elemento distintivo: spettrogramma a cascata.** Sostituisci la linea
   d'onda piatta con un waterfall (heatmap che scorre) — è l'artefatto
   caratteristico del rilevamento acustico e rende lo strumento credibile.
7. **Hardening del server.** Gestione errori, log strutturati, parametro porta
   da env (`PORT`), limite messaggi, README dedicato in `server/`.

### Priorità BASSA — extra
8. **Aggancio modello TensorFlow.js opzionale.** Se presente un `model.json`
   in `app/model/`, caricalo e combina lo score del modello con l'euristica FFT.
   Deve restare opzionale e degradare con grazia se il modello manca.
9. **Linting/format a costo zero:** `.editorconfig` (presente), eventuale
   configurazione Prettier/ESLint solo come devDependencies, mai obbligatorie
   per l'uso. README `training/` e `docs/` aggiornati.

---

## 4. Vincoli NON negoziabili

- **Costo zero.** Niente servizi a pagamento, niente API keys, niente CDN che
  richiedano account, niente font/asset esterni che rompano l'uso offline.
  Tutto deve girare con GitHub Pages + dispositivi dell'utente.
- **Offline-first.** La PWA deve restare installabile e funzionare senza rete
  (a parte la mesh, che per natura richiede la LAN).
- **Niente regressioni.** Le funzioni esistenti (microfono, calibrazione, score,
  GPS, mesh, export CSV) devono continuare a funzionare dopo ogni refactor.
- **Solo rilevamento difensivo.** Non aggiungere funzioni offensive, jamming,
  tracciamento di persone, o raccolta dati non necessaria. Niente upload audio
  grezzo: si inviano solo eventi/feature numeriche, come già avviene.
- **Onestà tecnica.** Mantieni la "Nota onesta" del README: il rilevamento serio
  richiede dataset reali, taratura e più sensori fissi. Non promettere magia.

---

## 5. Convenzioni

- Commit piccoli, in italiano o inglese ma coerenti, con prefisso tipo
  `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Branch di lavoro consigliato: `pro-pwa`. PR/merge su `main` quando una
  priorità è completa e testata.
- JavaScript: ES modules, niente framework, niente build step obbligatorio
  (la PWA deve restare servibile come file statici).
- Prima di chiudere un task verifica a mano:
  `cd app && python3 -m http.server 8080` e prova nel browser;
  `cd server && npm start` e connetti la PWA.

---

## 6. Comandi utili

```bash
# PWA in locale
cd app && python3 -m http.server 8080

# Server mesh
cd server && npm install && npm start

# Generare icone PNG dall'SVG (ImageMagick)
convert -background none app/icon.svg -resize 192x192 app/icons/icon-192.png
convert -background none app/icon.svg -resize 512x512 app/icons/icon-512.png

# Training (richiede audio nei dataset)
cd training && python3 -m venv .venv && source .venv/bin/activate \
  && pip install -r requirements.txt && python train_drone_classifier.py
```

---

## 7. Definizione di "fatto"

Il proprietario considera il lavoro riuscito quando:
- la PWA è raggiungibile via HTTPS gratuito (GitHub Pages) e installabile;
- microfono e GPS funzionano sui telefoni senza configurazioni a pagamento;
- il codice è leggibile, modulare e documentato, senza regressioni;
- README e docs spiegano chiaramente avvio, deploy e limiti reali.
