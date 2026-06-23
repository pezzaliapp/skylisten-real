# Manuale d'uso — SkyListen Real

App online: **https://www.alessandropezzali.it/skylisten-real/**

Questo manuale è diviso in due parti:

- **[Parte 1 — Utente finale](#parte-1--utente-finale)**: per chi apre l'app sul telefono.
- **[Parte 2 — Tecnico](#parte-2--tecnico-rete-multi-nodo)**: per chi allestisce una rete multi-nodo.

> SkyListen Real è un **prototipo civile, gratuito e difensivo**. Non è un'arma
> e non è un disturbatore di segnale (jammer): si limita ad **ascoltare** in modo
> passivo.

---

## Parte 1 — Utente finale

### Cos'è SkyListen e cosa fa / non fa

SkyListen Real trasforma il telefono in un **sensore acustico**. Ascolta l'audio
ambientale, ne estrae caratteristiche spettrali (frequenze, armoniche, ecc.) e
calcola uno **“score drone”**: un numero da 0 a 1 che indica quanto il suono
assomiglia a quello di un drone.

**Cosa fa:**

- rilevamento **passivo** del suono compatibile con un drone;
- visualizzazione in tempo reale dello spettro (spettrogramma a cascata);
- registrazione di eventi ed export in CSV;
- se colleghi più telefoni a un server di rete, conferma multi-nodo e stima
  approssimativa della zona.

**Cosa NON fa:**

- non è un'arma e non interferisce con i droni;
- non è un jammer e non disturba alcun segnale radio;
- non identifica né traccia persone;
- non carica l'audio grezzo da nessuna parte (vedi [Privacy](#privacy)).

### Come aprire e installare l'app

L'app va usata via **HTTPS**, altrimenti il browser non concede l'accesso a
microfono e GPS. Usa il link ufficiale:

**https://www.alessandropezzali.it/skylisten-real/**

#### Android (Chrome)

1. Apri il link in Chrome.
2. Menu (⋮) → **Installa app** / **Aggiungi a schermata Home**.
3. Avvia SkyListen dall'icona: si apre a tutto schermo come un'app.

#### iPhone / iPad (Safari)

1. Apri il link in Safari.
2. Tocca **Condividi** (□↑) → **Aggiungi a Home**.
3. Avvia dall'icona sulla schermata Home.

Dopo la prima apertura online, l'app resta utilizzabile **anche offline** (la
mesh tra telefoni richiede però una rete locale).

### I comandi e gli indicatori

| Elemento | A cosa serve |
| --- | --- |
| **Avvia microfono** | Chiede il permesso al microfono e inizia l'ascolto. Lo stato passa a `ASCOLTO`. |
| **Calibra fondo 20s** | Misura per 20 secondi il rumore di fondo del luogo, così lo score diventa più affidabile. Resta in silenzio normale durante la calibrazione. |
| **Soglia** (slider) | Il livello di score oltre il quale scatta `POSSIBILE DRONE`. Più alta = meno falsi allarmi ma meno sensibile; più bassa = più sensibile ma più falsi positivi. |
| **Score drone** | Il punteggio corrente da 0.00 a 1.00. |
| **Spettrogramma a cascata** | La “fotografia” del suono nel tempo (vedi sotto). |
| **Stato** | `FERMO` (microfono spento), `ASCOLTO` (attivo, nessun allarme), `POSSIBILE DRONE` (score sopra soglia). |
| **Attiva GPS** | Allega la posizione agli eventi (utile per la stima di zona in rete). |
| **Invia beacon di test** | Manda un evento finto al server, per verificare la connessione mesh. |
| **Esporta CSV** | Scarica un file con tutti gli eventi registrati (orario, nodo, score, posizione, feature). |
| **Allarme multi-nodo** | Mostra l'esito della rete: `NESSUNO`, `PARZIALE` o `CONFERMATO`, con il numero di conferme e l'eventuale zona stimata. |
| **Log eventi** | Cronologia testuale di ciò che accade. |

### Procedura d'uso passo-passo

1. **Avvia microfono** e concedi il permesso quando richiesto.
2. **Calibra fondo 20s** stando in silenzio ambientale normale: l'app impara
   com'è il “rumore di base” del posto.
3. **Osserva lo score** e lo spettrogramma per qualche minuto.
4. **Regola la soglia**: se vedi troppi allarmi falsi, alzala; se non rileva
   nulla quando dovrebbe, abbassala.
5. (Opzionale) **Attiva GPS** ed **Esporta CSV** per conservare i dati.

### Come leggere lo spettrogramma e quando lo score sale

Lo spettrogramma a cascata scorre da **destra verso sinistra**: ogni nuova
colonna è l'istante più recente. L'asse **verticale** è la frequenza (suoni
gravi in basso, acuti in alto); il **colore** indica l'intensità, dal blu scuro
(debole) al giallo/rosso (forte).

I droni tendono a produrre un suono **continuo e “armonico”**: righe orizzontali
parallele e stabili a frequenze multiple tra loro. Quando compaiono questi
pattern, lo score tende a salire. Rumori brevi e irregolari (passi, voce, vento)
di solito non li generano.

### Privacy

- L'**audio grezzo non lascia mai il telefono**.
- Alla rete (se la usi) vengono inviati **solo eventi e numeri** (score, feature
  spettrali, eventuale posizione), mai la registrazione.
- L'app non richiede account, non usa servizi a pagamento e non traccia persone.

---

## Parte 2 — Tecnico (rete multi-nodo)

### Schema della rete

```
[Telefono A] ─┐
[Telefono B] ─┼──►  Server WebSocket (PC / Raspberry, stessa LAN)  ──► allarme a tutti
[Telefono C] ─┘
```

Ogni telefono è un **sensore** che invia eventi numerici. Un **server** sulla
stessa rete Wi-Fi raccoglie gli eventi, verifica le conferme e ridistribuisce lo
stato di allarme con l'eventuale stima di zona.

### Avviare il server

Sul PC/Raspberry, dalla cartella del progetto:

```bash
cd server
npm install
npm start
```

Il server ascolta in dual-stack (IPv4 + IPv6) sulla porta `8787`; in locale usa
`ws://localhost:8787`. Variabili d'ambiente principali:

| Variabile | Default | Significato |
| --- | --- | --- |
| `PORT` | `8787` | Porta di ascolto |
| `HOST` | `::` | Indirizzo di bind (dual-stack IPv4 + IPv6) |
| `MAX_PAYLOAD` | `65536` | Dimensione massima messaggio (byte) |
| `MAX_MSG_RATE` | `50` | Messaggi al secondo per client |

Esempio: `PORT=9000 MAX_MSG_RATE=20 npm start`. Dettagli completi in
[`server/README.md`](server/README.md).

### Collegare i telefoni

1. Trova l'**indirizzo IP locale** del PC che esegue il server
   (es. `192.168.1.10`).
2. Su ogni telefono, nel riquadro **Mesh WebSocket**, imposta il campo
   **Server WS** su `ws://IP_DEL_PC:8787` (es. `ws://192.168.1.10:8787`).
3. Tocca **Connetti**: lo stato passa a “Connesso”.
4. Tocca **Sincronizza clock** per allineare gli orologi (offset approssimato).
5. (Consigliato) **Attiva GPS** su ogni telefono per la stima di zona.

### Logica dell'allarme

- Un evento conta come conferma se ha **score > 0.55**.
- Servono **almeno 3 nodi distinti** che confermano entro una finestra di
  **8 secondi** perché l'allarme diventi `CONFERMATO`.
- Con conferme da meno nodi lo stato è `PARZIALE`; senza conferme è `NESSUNO`.
- Quando scatta `CONFERMATO`, il server calcola una **stima di zona** come
  *centroide pesato* sugli score dei nodi con posizione nota (metodo
  `weighted-centroid-preTDOA`): un'indicazione di massima, non una posizione
  precisa.

### Posizionamento dei sensori

- Usa **almeno 3 nodi**; 4–5 fissi danno risultati più stabili.
- Distribuisci i telefoni su un'area, non tutti nello stesso punto.
- Preferisci posizioni **fisse** e riparate dal vento diretto sul microfono.
- Calibra ogni nodo nel suo punto reale di installazione.

### Training opzionale del modello

È possibile addestrare un classificatore drone/no-drone e agganciarlo all'app
(lo score del modello si combina con l'euristica). È **facoltativo**: senza
modello l'app funziona comunque con la sola euristica FFT.

- Preparazione dataset e addestramento: [`training/README.md`](training/README.md).
- Abilitazione del modello nella PWA (TensorFlow.js, offline-first):
  [`model/README.md`](model/README.md).

### Rete radio LoRa (futura) e piano d'emergenza

Per estendere la rete oltre Internet/Wi-Fi servirà hardware radio (LoRa/
Meshtastic) e un *bridge* su Raspberry/PC — una tappa futura, **non** a costo
zero. Oggi puoi vederne l'anteprima con la **demo simulata** sulla mappa
(pulsante "Avvia simulazione LoRa"), senza comprare nulla.

Il **piano operativo d'emergenza** (cosa preparare prima, come attivare la rete
in pochi minuti quando serve, esercizio periodico e degrado se la rete cade) è in
[`docs/HARDWARE-LORA.md` → Piano di attivazione operativa](docs/HARDWARE-LORA.md#6-piano-di-attivazione-operativa).

> Onestà: la rete LoRa è un **layer di rilevamento di prossimità**, non un
> sistema di difesa; non localizza con precisione e **non funziona se l'hardware
> non è già installato e testato prima**. Niente promesse di protezione.

### Limiti reali e onesti

- I **timestamp del browser non sono adatti al TDOA preciso** (triangolazione
  per differenza dei tempi di arrivo): l'app prepara i dati, ma il browser non
  garantisce la precisione necessaria.
- La stima di zona è **approssimativa** (centroide pesato), non una
  localizzazione esatta.
- Per un rilevamento serio servono **sensori fissi**, **dataset reali**,
  **soglie tarate** sul campo e più nodi. SkyListen è una base credibile, non
  una soluzione “magica”.

---

## Risoluzione problemi

| Sintomo | Possibile causa e soluzione |
| --- | --- |
| **Il microfono non parte** | Permesso negato o pagina non in HTTPS. Apri il link ufficiale (HTTPS), poi consenti l'accesso al microfono nelle impostazioni del sito. |
| **“Serve HTTPS”** | Stai usando `http://` o un file locale. Usa https://www.alessandropezzali.it/skylisten-real/ oppure `localhost` in sviluppo. |
| **La mesh non si connette** | Verifica che server e telefoni siano sulla **stessa rete Wi-Fi**, che l'IP e la porta nel campo *Server WS* siano corretti (`ws://IP:8787`) e che un eventuale firewall non blocchi la porta. |
| **Score sempre alto** | Ambiente rumoroso o calibrazione fatta con rumore: **ricalibra** in silenzio e, se serve, alza la soglia. |
| **Score sempre basso / nessun rilevamento** | Soglia troppo alta o microfono lontano dalla sorgente: abbassa la soglia e ricalibra. |
| **L'app non si aggiorna** | Chiudi e riapri; il service worker carica la nuova versione al riavvio. |

---

[← Torna all'app](index.html)
