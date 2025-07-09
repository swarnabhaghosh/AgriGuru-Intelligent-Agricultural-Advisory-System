from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import joblib

# Load model and label encoder
model = joblib.load("crop_model.pkl")
le = joblib.load("label_encoder.pkl")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or ["http://127.0.0.1:5500"] if you use Live Server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "✅ AgriGuru backend is running."}

# Define input schema
class CropInput(BaseModel):
    N: float
    P: float
    K: float
    temperature: float
    humidity: float
    ph: float
    rainfall: float

# Define prediction endpoint
@app.post("/predict")
def predict_crop(data: CropInput):
    features = np.array([[data.N, data.P, data.K, data.ph, data.temperature, data.humidity, data.rainfall]])
    pred_encoded = model.predict(features)[0]
    crop_name = le.inverse_transform([pred_encoded])[0]
    return {"recommended_crop": crop_name}
