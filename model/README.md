# Modello opzionale (TensorFlow.js)

Questa cartella è **facoltativa**. Se è vuota, SkyListen Real funziona
normalmente usando la sola euristica FFT. Se aggiungi qui un modello
TensorFlow.js, l'app combina automaticamente lo score del modello con
l'euristica (peso 50/50, vedi `MODEL_WEIGHT` in `app.js`).

> Funzione sperimentale. Il rilevamento serio resta basato su dataset reali,
> taratura e più sensori fissi: il modello non fa magie.

## Vincoli rispettati

- **Costo zero / offline-first**: TensorFlow.js **non** viene scaricato da una
  CDN obbligatoria. Lo aggiungi tu localmente, così l'app resta installabile e
  utilizzabile senza rete.
- **Degrado con grazia**: se manca `model.json` o se TensorFlow.js non è
  caricato, l'app continua con l'euristica, senza errori.

## Come abilitarlo

1. **Aggiungi TensorFlow.js in locale.** Scarica `tf.min.js` da una release
   ufficiale e mettilo, ad esempio, in `vendor/tf.min.js` (radice del repo).
   Poi caricalo in `index.html` **prima** dello script dell'app:

   ```html
   <script src="vendor/tf.min.js"></script>
   <script type="module" src="app.js"></script>
   ```

2. **Converti il tuo modello in formato TensorFlow.js** e copia qui i file
   risultanti (`model.json` + i `*.bin`). Partendo dall'output del trainer:

   ```bash
   pip install tensorflowjs
   tensorflowjs_converter --input_format=tf_saved_model \
     training/model_savedmodel model
   ```

3. Ricarica la PWA: nel log comparirà «Modello caricato».

## Formati di input supportati

Il modulo `js/model.js` rileva la forma dell'input del modello:

- **Rank 4** `[1, n_mels, frames, 1]` — mel-spectrogram. È il formato prodotto
  da `training/train_drone_classifier.py` (SR 16000, n_mels 64, ~63 frame su 2s).
  L'app calcola il log-mel in tempo reale con `js/dsp.js`, replicando i
  default di librosa (Hann, n_fft 2048, hop 512, mel Slaney, power_to_db ref=max).

- **Rank 2** `[1, K]` — vettore di feature. Per modelli leggeri addestrati sul
  CSV esportato. Lo schema attuale (`featureVector` in `model.js`) è:
  `[band, harmonic, centroid, rough, hf, low]` normalizzati in 0..1.

In entrambi i casi l'uscita attesa è una probabilità (sigmoide) in 0..1.
