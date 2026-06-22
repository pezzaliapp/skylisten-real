# Training — classificatore drone / no-drone

Script Python gratuito per addestrare una piccola CNN sul mel-spectrogram
dell'audio ed esportare un modello riutilizzabile (TFLite e, opzionalmente,
TensorFlow.js per la PWA).

> Nota onesta: il rilevamento serio richiede dataset reali, taratura e più
> sensori fissi. Questo script è una base, non una soluzione chiavi in mano.

## 1. Prepara i dataset

Scarica legalmente audio e disponilo così:

```text
datasets/drone/*.wav
datasets/no_drone/*.wav
```

Servono almeno ~20 file totali. Fonti gratuite suggerite: DADS (Hugging Face),
NASA small UAS flyover acoustics, Salford DroneNoise Database; per i falsi
positivi ESC-50 e UrbanSound8K (moto, traffico, vento, elicotteri, utensili).

## 2. Ambiente e addestramento

```bash
cd training
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python train_drone_classifier.py
```

Parametri della pipeline (in `train_drone_classifier.py`): SR 16000, finestra
2 s, 64 bande mel, `fmax` 8000. Output:

- `training/model_savedmodel/` — modello Keras/SavedModel
- `training/model.tflite` — per Android / inferenza on-device

## 3. (Opzionale) Esporta per la PWA

Per far combinare lo score del modello con l'euristica della PWA, converti il
SavedModel in formato TensorFlow.js dentro `app/model/`:

```bash
pip install tensorflowjs
tensorflowjs_converter --input_format=tf_saved_model \
  training/model_savedmodel app/model
```

L'input atteso lato PWA è un mel-spectrogram `[1, 64, ~63, 1]`, calcolato in
tempo reale da `app/js/dsp.js` con gli stessi default di librosa. Dettagli e
formati alternativi in [`app/model/README.md`](../app/model/README.md).

## Note su Keras 3 / export

Su Keras 3 il salvataggio in formato SavedModel via cartella può cambiare:
se `model.save(...)` con percorso-cartella dà problemi, usa
`model.export('training/model_savedmodel')` (API di esportazione SavedModel),
quindi procedi con la conversione TFLite/TF.js. Verifica sempre che il file
`model.tflite` venga generato correttamente.
