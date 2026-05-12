import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, roc_auc_score
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
BACKTEST_PATH = MODEL_DIR / "backtest_metrics.json"

sys.path.append(str(BASE_DIR))

from scripts.train_model import build_dataset, load_environment, load_finished_games  # noqa: E402


def _safe_roc_auc(y_true: np.ndarray, y_prob: np.ndarray):
    if len(np.unique(y_true)) < 2:
        return None
    return float(roc_auc_score(y_true, y_prob))


def _fold_metrics(y_true: np.ndarray, y_prob: np.ndarray) -> Dict[str, float]:
    y_prob = np.clip(y_prob, 1e-6, 1 - 1e-6)
    y_pred = (y_prob >= 0.5).astype(int)

    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "logLoss": float(log_loss(y_true, y_prob)),
        "brierScore": float(brier_score_loss(y_true, y_prob)),
        "rocAuc": _safe_roc_auc(y_true, y_prob),
    }


def run_walk_forward_backtest(n_folds: int = 5) -> Dict[str, Any]:
    load_environment()
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    games_df = load_finished_games()
    if games_df.empty:
        raise RuntimeError("No finished games found for backtesting.")

    X, y, _, dates, _ = build_dataset(games_df)
    total_rows = len(X)

    warmup = max(250, int(total_rows * 0.4))
    remaining = total_rows - warmup
    if remaining < n_folds * 20:
        raise RuntimeError("Not enough games for walk-forward folds after warmup window.")

    fold_size = remaining // n_folds
    folds: List[Dict[str, Any]] = []
    fold_metrics: List[Dict[str, float]] = []

    for fold_index in range(n_folds):
        train_end = warmup + fold_index * fold_size
        test_start = train_end
        test_end = warmup + (fold_index + 1) * fold_size if fold_index < n_folds - 1 else total_rows

        X_train = X[:train_end]
        y_train = y[:train_end]
        X_test = X[test_start:test_end]
        y_test = y[test_start:test_end]
        if len(X_test) == 0:
            continue

        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        model = LogisticRegression(max_iter=2000, class_weight="balanced")
        model.fit(X_train_scaled, y_train)
        y_prob = model.predict_proba(X_test_scaled)[:, 1]

        metrics = _fold_metrics(y_test, y_prob)
        fold_metrics.append(metrics)

        folds.append(
            {
                "fold": fold_index + 1,
                "trainRows": int(len(X_train)),
                "testRows": int(len(X_test)),
                "trainStart": str(dates[0].date()) if dates else None,
                "trainEnd": str(dates[train_end - 1].date()) if dates and train_end > 0 else None,
                "testStart": str(dates[test_start].date()) if dates and test_start < len(dates) else None,
                "testEnd": str(dates[test_end - 1].date()) if dates and test_end > 0 else None,
                **metrics,
            }
        )

    if not folds:
        raise RuntimeError("Walk-forward failed: no folds were produced.")

    mean_accuracy = float(np.mean([fold["accuracy"] for fold in folds]))
    mean_logloss = float(np.mean([fold["logLoss"] for fold in folds]))
    mean_brier = float(np.mean([fold["brierScore"] for fold in folds]))
    roc_values = [fold["rocAuc"] for fold in folds if fold["rocAuc"] is not None]
    mean_roc = float(np.mean(roc_values)) if roc_values else None

    summary = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "folds": folds,
        "summary": {
            "foldCount": len(folds),
            "meanAccuracy": mean_accuracy,
            "meanLogLoss": mean_logloss,
            "meanBrierScore": mean_brier,
            "meanRocAuc": mean_roc,
            "rows": int(total_rows),
        },
    }

    BACKTEST_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def save_summary_to_db(summary: Dict[str, Any]) -> None:
    try:
        from database import SessionLocal
        from services.model_metrics_service import ModelMetricsService

        db = SessionLocal()
        try:
            svc = ModelMetricsService(db)
            svc.save_backtest_summary(summary)
        finally:
            db.close()
    except Exception as exc:
        print(f"Warning: could not persist backtest summary to DB: {exc}")


if __name__ == "__main__":
    output = run_walk_forward_backtest()
    save_summary_to_db(output)
    print(
        "Backtest complete. "
        f"meanAccuracy={output['summary']['meanAccuracy']:.4f}, "
        f"meanLogLoss={output['summary']['meanLogLoss']:.4f}, "
        f"meanBrier={output['summary']['meanBrierScore']:.4f}"
    )
