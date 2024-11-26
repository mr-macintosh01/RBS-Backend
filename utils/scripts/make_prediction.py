import tensorflow as tf

import sys
import joblib

scaler = joblib.load('./utils/scripts/model/scaler/scaler.gz')
model = tf.keras.models.load_model('./utils/scripts/model/first_model/Dense_Model.h5')

scaled_vector = scaler.transform([sys.argv[1:]])
predicted_value = model.predict(scaled_vector, verbose=0).flatten()

print(predicted_value[0])


