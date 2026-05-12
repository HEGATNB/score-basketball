from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Optional, List, Dict, Any
import json

from repositories.model_metrics_repository import ModelMetricsRepository

class ModelMetricsService:
    def __init__(self, db: Session):
        self.db = db
        self.metrics_repo = ModelMetricsRepository(db)

    def _create_table_if_not_exists(self):
        pass

    def save_metrics(self, model_version: str, training_games_count: int = None,
                     accuracy: float = None, loss: float = None,
                     validation_accuracy: float = None, validation_loss: float = None,
                     features_count: int = None, training_duration_seconds: float = None,
                     status: str = "completed", error_message: str = None,
                     metadata: Dict = None) -> Dict[str, Any]:
        return self.metrics_repo.create(
            model_version=model_version,
            training_games_count=training_games_count,
            accuracy=accuracy,
            loss=loss,
            validation_accuracy=validation_accuracy,
            validation_loss=validation_loss,
            features_count=features_count,
            training_duration_seconds=training_duration_seconds,
            status=status,
            error_message=error_message,
            metadata=metadata
        )

    def get_latest_metrics(self) -> Optional[Dict[str, Any]]:
        return self.metrics_repo.get_latest()

    def get_metrics_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        return self.metrics_repo.get_history(limit=limit)

    def get_model_stats(self) -> Dict[str, Any]:
        return self.metrics_repo.get_stats()