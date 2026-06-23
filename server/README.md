# SkyListen Real — Server mesh

Server WebSocket che sincronizza i nodi (telefoni) nella stessa rete locale.
Riceve **solo eventi e feature numeriche** — mai audio grezzo — sincronizza il
clock e, quando abbastanza nodi confermano insieme, stima la zona e diffonde un
allarme.

## Requisiti

- Node.js 18+ (usa ES modules)
- Dipendenza: [`ws`](https://www.npmjs.com/package/ws)

## Avvio

```bash
cd server
npm install
npm start
```

Il server ascolta in dual-stack (IPv4 + IPv6) sulla porta `8787`. In locale usa
`ws://localhost:8787`; dai telefoni, nella PWA, imposta `Server WS` su
`ws://IP_DEL_PC:8787`.

## Configurazione (variabili d'ambiente)

| Variabile      | Default   | Descrizione                          |
| -------------- | --------- | ------------------------------------ |
| Variabile      | Default | Descrizione                                   |
| -------------- | ------- | --------------------------------------------- |
| `PORT`         | `8787`  | Porta di ascolto                              |
| `HOST`         | `::`    | Indirizzo di bind (dual-stack IPv4 + IPv6)    |
| `MAX_PAYLOAD`  | `65536` | Dimensione massima messaggio (byte)           |
| `MAX_MSG_RATE` | `50`    | Messaggi al secondo per client                |

> Il bind di default è `::` (dual-stack): così `ws://localhost:8787` funziona
> sia che il browser risolva `localhost` in `127.0.0.1` (IPv4) sia in `::1`
> (IPv6). Con `HOST=0.0.0.0` (solo IPv4) alcuni browser non si connettono a
> `localhost`. Per forzare solo IPv4 usa `HOST=0.0.0.0`.

Esempio:

```bash
PORT=9000 MAX_MSG_RATE=20 npm start
```

## Protocollo

Messaggi **client → server** (JSON):

| `kind`  | Effetto                                                              |
| ------- | ------------------------------------------------------------------- |
| `hello` | Annuncio di presenza; diffonde `"<nodo> online"` agli altri.        |
| `sync`  | Richiesta di sincronizzazione clock; risponde con `sync_reply`.     |
| `event` | Evento/feature di rilevamento; alimenta la valutazione multi-nodo.  |
| `pos`   | Aggiornamento posizione (allegato come `gps` ai messaggi).          |

Messaggi **server → client** (JSON):

| `kind`       | Contenuto                                                        |
| ------------ | --------------------------------------------------------------- |
| `info`       | Messaggi di stato testuali.                                      |
| `sync_reply` | `serverTs` per calcolare l'offset di clock.                     |
| `alarm`      | `level` (`NESSUNO`/`PARZIALE`/`CONFERMATO`), `count`, `estimate`.|

## Logica di allarme

- Finestra di conferma: **8 s**.
- Conta un evento se `score > 0.55`.
- Allarme `CONFERMATO` con almeno **3 nodi distinti**; in tal caso il server
  calcola una stima di zona (centroide pesato sugli score, pre-TDOA).

## Robustezza

- Log strutturati in JSON (una riga per evento).
- Limite di dimensione e di frequenza dei messaggi per client.
- Heartbeat ping/pong per scollegare i client morti.
- Parsing JSON difensivo e spegnimento ordinato su `SIGINT`/`SIGTERM`.
