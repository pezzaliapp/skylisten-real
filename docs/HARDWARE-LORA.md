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

## 6. Piano di attivazione operativa

> ## ⚠️ Leggi prima questo — cosa è e cosa NON è
>
> - È un **layer di rilevamento acustico di prossimità**: segnala "da più punti
>   si sente qualcosa di compatibile con un drone". Niente di più.
> - **NON è un sistema di difesa.** Non intercetta, non abbatte, non disturba e
>   non respinge nulla. È solo ascolto passivo.
> - **NON localizza con precisione.** La "zona stimata" è un centroide pesato:
>   un'indicazione di massima, non una posizione.
> - **NON funziona se l'hardware non è già installato, alimentato e testato
>   PRIMA.** Non è improvvisabile nel momento critico: la rete che non hai
>   preparato in anticipo, nell'emergenza non esiste.
> - **NON garantisce copertura né continuità.** Portata, banda e duty cycle di
>   LoRa sono limitati (vedi §4); nodi e batterie possono mancare proprio quando
>   servono.
>
> In sintesi: dà **consapevolezza situazionale di prossimità**, a chi l'ha
> preparata in anticipo. Non promette protezione, perché non può darla.

Il piano è diviso in tre fasi temporali. La Fase 1 è la più importante: senza di
essa le altre due non esistono.

### Fase 1 — PREPARAZIONE (in anticipo, NON durante l'emergenza)

Richiede **tempo e acquisti**: va fatta con calma, prima, non nel momento
critico. Oggi nessun obbligo di spesa — qui si descrive *cosa servirà*.

1. **Procurati l'hardware** (vedi §2 e i costi §5): moduli LoRa, **antenne**
   della banda legale, un host per il bridge (Raspberry o un PC che hai già).
2. **Monta i nodi**: flash firmware (es. Meshtastic), **collega sempre
   l'antenna** prima di alimentare (trasmettere senza antenna danneggia la radio).
3. **Scarica e prova il bridge** dal repo, in mock (senza hardware), per
   verificare la catena bridge→mesh→mappa:
   ```bash
   git clone https://github.com/pezzaliapp/skylisten-real.git
   cd skylisten-real/bridge && npm install
   BRIDGE_MODE=mock MESH_URL=ws://IP_DEL_SERVER:8787 npm start
   ```
   Sulla mappa devono comparire i nodi `LORA-xx` simulati.
4. **Abilita la radio reale**: con il modulo collegato via USB,
   `npm install serialport`, poi completa `parseFrame()` in
   `transports/lora.js` per il formato dei tuoi frame.
5. **Posiziona e calibra i nodi** sul campo: **almeno 3**, fissi, distribuiti
   sull'area (non tutti nello stesso punto), riparati dal vento diretto sul
   microfono; calibra ogni nodo nel suo punto reale.
6. **Configura la `roomKey`** condivisa (in `config.json`), uguale su bridge e
   nodi, così solo i tuoi nodi alimentano la rete. *(Privacy invariata: si
   trasmettono solo eventi numerici, mai audio.)*
   ```json
   { "meshUrl": "ws://IP_DEL_SERVER:8787", "roomKey": "LA_TUA_CHIAVE",
     "mode": "lora", "serial": { "port": "/dev/ttyUSB0", "baud": 115200 } }
   ```
7. **Collauda end-to-end una volta** (Fase 2 completa, con hardware vero), poi
   **spegni**: da qui in poi la rete è *pronta*, non *attiva*.

### Fase 2 — ATTIVAZIONE (quando serve, rete già preparata)

Solo se la Fase 1 è stata fatta. In pochi minuti:

1. **Accendi i nodi LoRa** (alimentazione/batteria); verifica LED/display di
   accensione e che l'antenna sia collegata.
2. **Accendi l'host** del bridge e del mesh server (stessa rete).
3. **Avvia il mesh server:**
   ```bash
   cd skylisten-real/server && npm start
   ```
4. **Avvia il bridge in modalità reale** (config con `mode: "lora"`):
   ```bash
   cd skylisten-real/bridge && npm start
   ```
5. **Apri la mappa** sui dispositivi e connetti al server:
   `ws://IP_DEL_SERVER:8787` → *Connetti*.
6. **Verifica il flusso**: nel log del bridge devono comparire gli eventi; sulla
   mappa i nodi `LORA-xx` con il loro score, e la zona stimata se ≥3 confermano.
7. **Se non arrivano eventi**, checklist rapida: antenne collegate · nodi
   alimentati · porta seriale giusta (`ls /dev/tty*`) · stessa rete/`IP` ·
   `roomKey` coerente · firewall sulla porta 8787.

Quando non serve, **spegni** (Ctrl+C su bridge e server): torna tutto a riposo.

### Fase 3 — ESERCIZIO E DEGRADO

**Esercizio periodico** (perché funzioni *quando* servirà, non *se*): ogni
1–2 mesi un "drill" di 10–15 minuti — accendi tutto, ripeti la Fase 2, controlla
che eventi e mappa rispondano, **verifica le batterie**, aggiorna il software,
ricalibra se l'ambiente è cambiato. Tieni un breve registro delle prove. Una
rete mai esercitata è una rete che, nel momento critico, scoprirai non funzionare.

**Degrado se la rete cade** (Internet/host/bridge giù): non si perde tutto.
- **Modalità autonoma per-dispositivo**: ogni telefono con la PWA installata
  continua a **rilevare e registrare in locale** (microfono + score + GPS +
  **export CSV**) anche senza mesh. Si perde la correlazione multi-nodo in
  tempo reale, **non** il rilevamento né le prove.
- **I dati si uniscono dopo**: quando la rete torna, o raccogliendo fisicamente
  i CSV dai dispositivi, e si analizzano insieme.
- **Priorità di ripristino**: rialza prima il **mesh server** e il **bridge**
  (sono il punto di correlazione); i nodi che restano accesi ripartono da soli.
- Onestà: **senza bridge non c'è mappa centrale**. Il valore residuo nel
  blackout è il logging autonomo locale, da fondere a posteriori — non una
  sorveglianza continua.

---

## 7. Cosa NON copre (confine onesto)

- Il bridge non rende la **PWA** capace di parlare con la radio: resta sempre il
  processo separato a farlo.
- LoRa non è un canale dati generico: niente streaming, niente audio (e va bene
  così, per privacy e per banda).
- Per coperture molto ampie servono più nodi/gateway e una progettazione radio
  dedicata, fuori dallo scopo di questo prototipo.
