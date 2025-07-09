from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import joblib
import pandas as pd
import logging
from typing import List
import requests

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load model and label encoder
try:
    model = joblib.load("crop_model.pkl")
    le = joblib.load("label_encoder.pkl")
    logger.info("✅ Model and label encoder loaded successfully")
except Exception as e:
    logger.error(f"❌ Failed to load model or label encoder: {str(e)}")
    raise

# Initialize FastAPI app
app = FastAPI(
    title="AgriGuru Crop Recommendation API",
    description="API for recommending crops based on soil and weather conditions",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Input schema with field validation
class CropInput(BaseModel):
    N: float = Field(..., ge=0, le=140, description="Nitrogen level (ppm)", example=90)
    P: float = Field(..., ge=5, le=145, description="Phosphorus level (ppm)", example=42)
    K: float = Field(..., ge=5, le=205, description="Potassium level (ppm)", example=43)
    ph: float = Field(..., ge=3.5, le=9.0, description="Soil pH (3.5-9.0)", example=6.5)
    temperature: float = Field(..., ge=8, le=45, description="Temperature in °C", example=24)
    humidity: float = Field(..., ge=10, le=100, description="Humidity in %", example=80)
    rainfall: float = Field(..., ge=20, le=300, description="Rainfall in mm", example=120)

# Output schema
class CropRecommendation(BaseModel):
    recommended_crop: str
    confidence: float
    all_predictions: List[dict]

# Root endpoint
@app.get("/")
def read_root():
    return {
        "message": "✅ AgriGuru Crop Recommendation API is running",
        "docs": "/docs",
        "redoc": "/redoc"
    }

# Prediction endpoint
@app.post("/predict", response_model=CropRecommendation)
def predict_crop(data: CropInput):
    try:
        logger.info(f"Received prediction request: {data.dict()}")

        # Ensure correct feature order
        input_order = ["N", "P", "K", "ph", "temperature", "humidity", "rainfall"]
        input_df = pd.DataFrame([data.dict()])[input_order]

        # Predict probabilities and crop
        probabilities = model.predict_proba(input_df)[0]
        pred_encoded = model.predict(input_df)[0]
        pred_crop = le.inverse_transform([pred_encoded])[0]
        confidence = round(float(probabilities.max()), 4)

        # All crop predictions with probabilities
        all_predictions = [
            {"crop": crop, "probability": round(float(prob), 4)}
            for crop, prob in zip(le.classes_, probabilities)
        ]
        all_predictions.sort(key=lambda x: x["probability"], reverse=True)

        logger.info(f"Predicted crop: {pred_crop} with confidence: {confidence}")

        return {
            "recommended_crop": pred_crop,
            "confidence": confidence,
            "all_predictions": all_predictions
        }

    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

# Crop list endpoint
@app.get("/crops")
def get_available_crops():
    try:
        return {"available_crops": list(le.classes_)}
    except Exception as e:
        logger.error(f"Failed to get available crops: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get available crops")

# Market Price Insight Endpoint (Live from Agmarknet API)
@app.get("/market_prices")
def get_market_prices(state: str, district: str):
    try:
        API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"
        RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"

        url = (
            f"https://api.data.gov.in/resource/{RESOURCE_ID}"
            f"?api-key={API_KEY}&format=json"
            f"&filters[state]={state}&filters[district]={district}"
        )

        response = requests.get(url)
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch from Agmarknet API")

        data = response.json()
        records = data.get("records", [])
        if not records:
            raise HTTPException(status_code=404, detail="No market data found for given location")

        # Filter unique crops and keep highest priced ones
        seen = set()
        prices = []
        for item in records:
            crop = item.get("commodity")
            modal_price = item.get("modal_price")
            if crop and crop not in seen and modal_price:
                seen.add(crop)
                price_value = float(modal_price) / 100  # Convert to ₹/kg
                prices.append({
                    "crop": crop,
                    "market": item.get("market"),
                    "price_value": price_value,
                    "price": f"{round(price_value, 2)} /kg"
                })

        # Sort by price descending
        prices.sort(key=lambda x: x["price_value"], reverse=True)

        # Remove price_value before returning
        for item in prices:
            item.pop("price_value")

        return {"prices": prices[:5]}  # Return top 5 unique crops

    except Exception as e:
        logger.error(f"Market price retrieval failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch market prices: {str(e)}")

# For running directly (optional, use uvicorn command instead)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
