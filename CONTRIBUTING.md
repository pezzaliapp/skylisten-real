# Contribuire a SkyListen Real

Grazie per l'interesse. Il progetto è un prototipo **civile, difensivo e a costo
zero**: ogni contributo deve mantenerne la natura.

## Principi non negoziabili

- **Solo rilevamento passivo difensivo.** Niente funzioni offensive, jamming,
  tracciamento di persone o raccolta dati non necessaria. Niente upload di audio
  grezzo: si inviano solo eventi/feature numeriche.
- **Costo zero e offline-first.** Niente servizi a pagamento, API keys o CDN
  obbligatorie. La PWA deve restare installabile e usabile senza rete.
- **Niente regressioni.** Microfono, calibrazione, score, GPS, mesh ed export
  CSV devono continuare a funzionare.
- **Onestà tecnica.** Nessuna promessa di "magia": il rilevamento serio richiede
  dataset reali, taratura e più sensori fissi.

## Sviluppo locale

```bash
# PWA (file statici, dalla radice del repo)
python3 -m http.server 8080

# Server mesh
cd server && npm install && npm start
```

Strumenti opzionali (solo sviluppo, non richiesti per l'uso):

```bash
npm install        # installa eslint + prettier (devDependencies)
npm run lint       # ESLint
npm run format     # Prettier
npm run icons      # rigenera le icone PNG dall'SVG
```

## Convenzioni

- Commit piccoli, con prefisso `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- JavaScript: ES modules, niente framework, nessun build step obbligatorio.
- Prima di aprire una PR verifica a mano la PWA nel browser e la connessione
  alla mesh.

## Verifica rapida

```bash
npm run lint                          # nessun errore
node --check server/server.js         # il server compila
```
