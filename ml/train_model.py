"""
Trains an XGBoost classifier on the synthetic donor-response dataset produced by
generate_training_data.py, evaluates it on a held-out test split, and saves the
model + evaluation metrics for the Flask service (app.py) to load.

Run: python ml/generate_training_data.py && python ml/train_model.py
"""

import json
import os

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score, log_loss, classification_report
import xgboost as xgb

BASE_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(BASE_DIR, "data", "training_data.csv")
MODEL_PATH = os.path.join(BASE_DIR, "model", "donor_response_model.json")
METRICS_PATH = os.path.join(BASE_DIR, "model", "metrics.json")

FEATURES = ["days_since_last_donation", "past_response_rate", "avg_response_time_hours", "distance_km"]
LABEL = "responded"


def main():
    if not os.path.exists(DATA_PATH):
        raise SystemExit(f"No training data at {DATA_PATH} -- run generate_training_data.py first.")

    df = pd.read_csv(DATA_PATH)
    X = df[FEATURES]
    y = df[LABEL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    accuracy = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)
    loss = log_loss(y_test, y_proba)
    report = classification_report(y_test, y_pred, output_dict=True)
    importances = dict(zip(FEATURES, model.feature_importances_.round(4).tolist()))

    print(f"Test accuracy: {accuracy:.4f}")
    print(f"Test ROC-AUC:  {auc:.4f}")
    print(f"Test log loss: {loss:.4f}")
    print("Feature importances:", importances)
    print(classification_report(y_test, y_pred))

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save_model(MODEL_PATH)

    metrics = {
        "trainedAt": pd.Timestamp.now("UTC").isoformat(),
        "samples": {"train": len(X_train), "test": len(X_test)},
        "accuracy": round(float(accuracy), 4),
        "rocAuc": round(float(auc), 4),
        "logLoss": round(float(loss), 4),
        "featureImportances": importances,
        "classificationReport": report,
        "features": FEATURES,
    }
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nSaved model to {MODEL_PATH}")
    print(f"Saved metrics to {METRICS_PATH}")


if __name__ == "__main__":
    main()
