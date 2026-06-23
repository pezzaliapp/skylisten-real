# SkyListen Bridge (archivio)

Ponte fra una **rete radio LoRa** e la **mesh WebSocket** di SkyListen. È
**codice archiviato**: non è un servizio sempre attivo. Si scarica dal repo e si
avvia **solo quando serve** — tipicamente quando colleghi un modulo LoRa a un
Raspberry/PC.

Perché esiste: la PWA gira nel browser e **non può parlare con la radio**.
L'integrazione hardware vive quindi qui, in un processo separato, che inoltra al
mesh server gli eventi numerici dei nodi radio (mai audio).

```
[nodi LoRa] ⇢radio⇢ [modulo USB] ─seriale─> [bridge] ─wss─> [mesh server] ─> [PWA / mappa]
                                                ▲
                              oggi: transport MOCK · domani: transport LoRa reale
```

## Provarlo ORA, senza hardware (mock)

Il bridge usa lo **stesso simulatore** della demo della PWA. Con il mesh server
avviato (`cd server && npm start`):

```bash
cd bridge
npm install                 # solo 'ws'
BRIDGE_MODE=mock MESH_URL=ws://localhost:8787 npm start
```

Apri `mappa.html`, connettiti al server: vedrai comparire i nodi `LORA-xx`
simulati. Test automatico: `npm run test:bridge` dalla radice del repo.

## Domani, con l'hardware reale

1. `npm install serialport` (nella cartella `bridge/`)
2. completa `parseFrame()` in `transports/lora.js` per il formato del tuo modulo
3. crea `config.json` da `config.example.json` e imposta `mode: "lora"` + porta seriale
4. `npm start`

Procedura completa, hardware consigliato, limiti reali e costi: vedi
[`docs/HARDWARE-LORA.md`](../docs/HARDWARE-LORA.md).

## Configurazione

`config.json` (da `config.example.json`) oppure variabili d'ambiente:

| Campo / env                | Default              | Descrizione                         |
| -------------------------- | -------------------- | ----------------------------------- |
| `meshUrl` / `MESH_URL`     | `ws://localhost:8787`| Indirizzo del mesh server           |
| `roomKey` / `ROOM_KEY`     | `""`                 | Chiave-stanza (predisposta, futura) |
| `mode` / `BRIDGE_MODE`     | `mock`               | `mock` (simulato) o `lora` (reale)  |
| `serial.port` / `SERIAL_PORT` | `/dev/ttyUSB0`    | Porta seriale del modulo LoRa       |
| `serial.baud` / `SERIAL_BAUD` | `115200`          | Baud rate                           |

> `roomKey` è già previsto nei messaggi (`key`) come predisposizione: il server
> non lo valida ancora. L'autenticazione vera è un passo successivo.
