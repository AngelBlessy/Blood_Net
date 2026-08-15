"""
BloodNet AI availability-prediction service.

Loads the XGBoost model trained by train_model.py and serves batched donor
response-probability predictions to the Node backend
(server/services/ai-prediction.service.js). Node falls back to a hand-tuned
heuristic if this service is unreachable, so it's safe to run this alongside
the rest of the stack without it being a hard dependency.

Run: python ml/app.py
"""

import json
import os

import pandas as pd
import xgboost as xgb
from flask import Flask, jsonify, request

BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "model", "donor_response_model.json")
METRICS_PATH = os.path.join(BASE_DIR, "model", "metrics.json")
PORT = int(os.environ.get("ML_SERVICE_PORT", 5001))

FEATURES = ["days_since_last_donation", "past_response_rate", "avg_response_time_hours", "distance_km"]
# Clamp ranges mirror what the training data was generated with (see
# generate_training_data.py) -- keeps live requests from feeding the model
# wildly out-of-distribution inputs it never learned from.
CLAMPS = {
    "days_since_last_donation": (0, 400),
    "past_response_rate": (0, 1),
    "avg_response_time_hours": (0.1, 72),
    "distance_km": (0.2, 100),
}

app = Flask(__name__)

booster = None
metrics = None


def load_model():
    global booster, metrics
    if not os.path.exists(MODEL_PATH):
        print(f"[ml] No trained model found at {MODEL_PATH} -- run train_model.py first.")
        return
    booster = xgb.Booster()
    booster.load_model(MODEL_PATH)
    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            metrics = json.load(f)
    print(f"[ml] Model loaded from {MODEL_PATH}")


def clamp(value, key):
    lo, hi = CLAMPS[key]
    return max(lo, min(hi, value))


@app.get("/health")
def health():
    return jsonify({"status": "ok", "modelLoaded": booster is not None, "metrics": metrics})


@app.post("/predict")
def predict():
    if booster is None:
        return jsonify({"error": "Model not loaded. Run train_model.py first."}), 503

    body = request.get_json(silent=True) or {}
    donors = body.get("donors")
    if not isinstance(donors, list) or not donors:
        return jsonify({"error": "Expected a non-empty 'donors' array."}), 400

    rows = []
    for donor in donors:
        rows.append(
            {
                "days_since_last_donation": clamp(
                    float(donor.get("daysSinceLastDonation", 0)), "days_since_last_donation"
                ),
                "past_response_rate": clamp(
                    float(donor.get("pastResponseRate", 0.5)), "past_response_rate"
                ),
                "avg_response_time_hours": clamp(
                    float(donor.get("avgResponseTimeHours", 24)), "avg_response_time_hours"
                ),
                "distance_km": clamp(float(donor.get("distanceKm", 25)), "distance_km"),
            }
        )

    frame = pd.DataFrame(rows, columns=FEATURES)
    probabilities = booster.predict(xgb.DMatrix(frame)).tolist()
    return jsonify({"probabilities": probabilities})


load_model()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT, debug=False)
