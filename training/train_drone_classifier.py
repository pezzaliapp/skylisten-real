"""Addestramento gratuito: metti audio in datasets/drone e datasets/no_drone, poi esegui.
Output: model_savedmodel/ e model.tflite convertibile per Android/TensorFlow.js.
"""
import os, glob, numpy as np, librosa, tensorflow as tf
from sklearn.model_selection import train_test_split
SR=16000; DURATION=2.0; N_MELS=64
BASE=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
def feat(path):
    y,_=librosa.load(path,sr=SR,mono=True,duration=DURATION)
    if len(y)<int(SR*DURATION): y=np.pad(y,(0,int(SR*DURATION)-len(y)))
    m=librosa.feature.melspectrogram(y=y,sr=SR,n_mels=N_MELS,fmax=8000)
    db=librosa.power_to_db(m,ref=np.max)
    return db[...,None].astype('float32')
files=[]; labels=[]
for lab,name in [(1,'drone'),(0,'no_drone')]:
    for ext in ('*.wav','*.mp3','*.flac','*.ogg','*.m4a'):
        for p in glob.glob(os.path.join(BASE,'datasets',name,ext)):
            files.append(p); labels.append(lab)
if len(files)<20: raise SystemExit('Servono file audio in datasets/drone e datasets/no_drone')
X=np.stack([feat(p) for p in files]); y=np.array(labels)
Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=.2,random_state=42,stratify=y)
model=tf.keras.Sequential([tf.keras.layers.Input(shape=X.shape[1:]),tf.keras.layers.Conv2D(16,3,activation='relu'),tf.keras.layers.MaxPool2D(),tf.keras.layers.Conv2D(32,3,activation='relu'),tf.keras.layers.MaxPool2D(),tf.keras.layers.Flatten(),tf.keras.layers.Dense(64,activation='relu'),tf.keras.layers.Dropout(.25),tf.keras.layers.Dense(1,activation='sigmoid')])
model.compile(optimizer='adam',loss='binary_crossentropy',metrics=['accuracy',tf.keras.metrics.AUC(name='auc')])
model.fit(Xtr,ytr,validation_data=(Xte,yte),epochs=20,batch_size=16)
model.save(os.path.join(BASE,'training','model_savedmodel'))
conv=tf.lite.TFLiteConverter.from_saved_model(os.path.join(BASE,'training','model_savedmodel'))
open(os.path.join(BASE,'training','model.tflite'),'wb').write(conv.convert())
print('Creato training/model.tflite')
