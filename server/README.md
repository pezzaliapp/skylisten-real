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

Il server ascolta su `ws://0.0.0.0:8787`. Dai telefoni, nella PWA, imposta
`Server WS` su `ws://IP_DEL_PC:8787`.

## Configurazione (variabili d'ambiente)

| Variabile      | Default   | Descrizione                          |
| -------------- | --------- | ------------------------------------ |
| `PORT`         | `8787`    | Porta di ascolto                     |
| `HOST`         | `0.0.0.0` | Indirizzo di bind                    |
| `MAX_PAYLOAD`  | `65536`   | Dimensione massima messaggio (byte)  |
| `MAX_MSG_RATE` | `50`      | Messaggi al secondo per client       |

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
