# Manuale hardware — rete radio LoRa (tappa futura)

Questo manuale spiega come, **quando servirà**, collegare hardware radio reale
a SkyListen per estendere la rete oltre Internet/Wi-Fi, usando il **bridge** già
archiviato nel repo (`bridge/`). Oggi non si compra e non si installa nulla: il
sistema gira con la **demo simulata** nella PWA e con il bridge in **modalità
mock**. Questo documento è l'istruzione d'uso per il giorno dell'hardware.

> Onestà tecnica: il vero off-grid a lungo raggio richiede hardware radio e
> **non è a costo zero**. Qui trovi i costi reali e i limiti, senza promesse.

---

## 1. Perché serve un bridge (e non la PWA)

Una PWA gira in un browser e **non può accedere a moduli radio/seriali** sui
telefoni. Perciò l'integrazione hardware vive in un **processo separato** (il
bridge) su un Raspberry/PC, che legge i frame radio e li inoltra al mesh server.
La PWA non cambia: continua a ricevere gli eventi dalla mesh.

```
[nodi LoRa] ⇢radio⇢ [modulo LoRa USB/gateway] ─seriale/IP─> [BRIDGE] ─wss─> [mesh server] ─> [PWA/mappa]
```

Privacy invariata: sulla radio passano **solo eventi numerici** (id nodo, score,
ts, gps), **mai audio**. Il payload minuscolo di SkyListen è, non a caso, adatto
alla bassa banda di LoRa.

---

## 2. Hardware consigliato

| Componente | Esempi tipici | Note |
| --- | --- | --- |
| Nodo sensore + radio | Heltec WiFi LoRa 32 (V3), LilyGO TTGO LoRa32, RAK WisBlock | scheda ESP32 + LoRa; molte già con piccolo display e connettore antenna |
| Antenna | antenna 868 MHz (EU) / 915 MHz (US) | usa **sempre** un'antenna adatta alla banda: trasmettere senza antenna danneggia la radio |
| Host del bridge | Raspberry Pi (3/4/Zero 2) **o un PC qualsiasi** | ci gira Node; spesso **riusi** un dispositivo che hai già |
| Collegamento modulo↔bridge | cavo USB (seriale) | in alternativa un gateway LoRa→IP, se il modulo lo offre |

Software radio consigliato sui nodi: **Meshtastic** (firmware open source per
queste schede) — gestisce instradamento multi-hop e crittografia del canale. Il
bridge si aggancia al nodo "gateway" via seriale/USB e legge i messaggi.

---

## 3. Come il bridge si aggancia alla mesh

Il bridge implementa un **transport** (vedi `shared/transport.js`): oggi il
`MockRadioTransport` (simulatore), domani il `LoRaSerialTransport`
(`bridge/transports/lora.js`). Stesso contratto: si sostituisce **solo** la
lettura radio, il resto (inoltro al mesh server) resta invariato.

Per completare la parte reale serve scrivere `parseFrame()` in
`transports/lora.js`: converte un frame ricevuto (es. una riga di testo dal
gateway Meshtastic) in un evento normalizzato `{ node, score, ts, gps }`.

---

## 4. Limiti reali della tecnologia (onesti)

- **Banda bassissima.** LoRa trasporta pochi byte al secondo. Va bene per eventi
  radi e piccoli (il caso di SkyListen), **non** per flussi fitti in tempo reale.
- **Duty cycle (EU 868 MHz): ~1%.** Per legge ogni nodo può trasmettere in media
  ~36 secondi all'ora: niente invii continui, solo eventi sporadici.
- **Latenza.** Da centinaia di ms a secondi, peggiore con multi-hop Meshtastic.
- **Portata.** In vista ottica anche km; in città/con ostacoli scende a
  centinaia di metri. Il multi-hop estende la copertura ma aggiunge latenza.
- **Frequenze regolamentate.** Usa la banda legale del tuo paese: **EU 868 MHz**,
  **US 915 MHz**, ecc. Rispetta potenza e duty cycle previsti dalla normativa.
- **Sincronizzazione temporale debole.** Come per la mesh attuale, i timestamp
  non bastano per un TDOA preciso: la stima di zona resta un centroide pesato.

---

## 5. Stima dei costi futuri (onesta, indicativa)

| Voce | Costo indicativo |
| --- | --- |
| Nodo (scheda LoRa + antenna) | ~ €15–35 a nodo |
| Host del bridge | €0 se riusi un PC; ~€40–80 per un Raspberry Pi nuovo |
| Cavetteria/alimentazione | ~ €5–15 a nodo |
| **Piccola rete 3–5 nodi** | **~ €100–250 totali** |

Nessun costo ricorrente di servizio (niente abbonamenti): la spesa è solo
hardware una tantum. Restano a costo zero la PWA, il mesh server e il bridge.

---

## 6. Procedura di attivazione futura (passo per passo)

Da eseguire **solo quando** prelevi il bridge e colleghi l'hardware.

1. **Scarica il bridge dal repo** su Raspberry/PC:
   ```bash
   git clone https://github.com/pezzaliapp/skylisten-real.git
   cd skylisten-real/bridge
   ```
2. **Installa Node.js** (≥ 18) se non presente, poi le dipendenze base:
   ```bash
   npm install            # installa 'ws'
   ```
3. **Prova subito in mock** (senza hardware), con il mesh server attivo altrove:
   ```bash
   BRIDGE_MODE=mock MESH_URL=ws://IP_DEL_SERVER:8787 npm start
   ```
   Sulla mappa compaiono i nodi `LORA-xx` simulati: conferma che la catena
   bridge→mesh→mappa funziona.
4. **Collega il modulo LoRa** via USB e installa il driver seriale:
   ```bash
   npm install serialport
   ```
5. **Completa `parseFrame()`** in `transports/lora.js` per il formato dei tuoi
   frame (vedi l'esempio commentato nel file).
6. **Configura** copiando `config.example.json` in `config.json`:
   ```json
   { "meshUrl": "ws://IP_DEL_SERVER:8787", "roomKey": "", "mode": "lora",
     "serial": { "port": "/dev/ttyUSB0", "baud": 115200 } }
   ```
   (su Linux la porta è di solito `/dev/ttyUSB0` o `/dev/ttyACM0`; verifica con
   `ls /dev/tty*` prima e dopo aver collegato il modulo).
7. **Avvia il bridge reale:**
   ```bash
   npm start
   ```
   Da questo momento gli eventi dei nodi radio entrano nella mesh e appaiono
   sulla mappa come i nodi reali.

Quando non serve, **spegni** (Ctrl+C): il bridge torna a essere solo archivio.

---

## 7. Cosa NON copre (confine onesto)

- Il bridge non rende la **PWA** capace di parlare con la radio: resta sempre il
  processo separato a farlo.
- LoRa non è un canale dati generico: niente streaming, niente audio (e va bene
  così, per privacy e per banda).
- Per coperture molto ampie servono più nodi/gateway e una progettazione radio
  dedicata, fuori dallo scopo di questo prototipo.
