from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository
import json
from datetime import datetime


class ModelMetricsRepository(BaseRepository):
    """Репозиторий для работы с таблицей model_metrics"""

    def __init__(self, db: Session):
        super().__init__(db)
        self._create_table_if_not_exists()

    def _create_table_if_not_exists(self):
        query = """
            CREATE TABLE IF NOT EXISTS model_metrics (
                id SERIAL PRIMARY KEY,
                model_version VARCHAR(50) NOT NULL,
                training_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                training_games_count INTEGER,
                accuracy FLOAT,
                loss FLOAT,
                validation_accuracy FLOAT,
                validation_loss FLOAT,
                features_count INTEGER,
                training_duration_seconds FLOAT,
                status VARCHAR(20) DEFAULT 'completed',
                error_message TEXT,
                metadata JSONB
            )
        """
        self._execute(query)
        self.db.commit()

    def create(self, model_version: str, training_games_count: int = None,
               accuracy: float = None, loss: float = None,
               validation_accuracy: float = None, validation_loss: float = None,
               features_count: int = None, training_duration_seconds: float = None,
               status: str = "completed", error_message: str = None,
               metadata: Dict = None) -> Dict[str, Any]:
        metadata_json = json.dumps(metadata) if metadata else None
        query = """
            INSERT INTO model_metrics 
            (model_version, training_date, training_games_count, accuracy, loss,
             validation_accuracy, validation_loss, features_count,
             training_duration_seconds, status, error_message, metadata)
            VALUES (:model_version, NOW(), :training_games_count, :accuracy, :loss,
                    :validation_accuracy, :validation_loss, :features_count,
                    :training_duration_seconds, :status, :error_message, :metadata)
            RETURNING id
        """
        params = {
            "model_version": model_version,
            "training_games_count": training_games_count,
            "accuracy": accuracy,
            "loss": loss,
            "validation_accuracy": validation_accuracy,
            "validation_loss": validation_loss,
            "features_count": features_count,
            "training_duration_seconds": training_duration_seconds,
            "status": status,
            "error_message": error_message,
            "metadata": metadata_json
        }
        result = self._execute_with_commit(query, params)
        return {"id": result.scalar(), "model_version": model_version, "status": status}

    def get_latest(self) -> Optional[Dict[str, Any]]:
        query = """
            SELECT * FROM model_metrics 
            WHERE status = 'completed'
            ORDER BY training_date DESC 
            LIMIT 1
        """
        result = self._fetch_one(query)
        if result and result.get("metadata"):
            try:
                result["metadata"] = json.loads(result["metadata"])
            except:
                pass
        return result

    def get_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        query = """
            SELECT * FROM model_metrics 
            ORDER BY training_date DESC 
            LIMIT :limit
        """
        results = self._fetch_all(query, {"limit": limit})
        for r in results:
            if r.get("metadata"):
                try:
                    r["metadata"] = json.loads(r["metadata"])
                except:
                    pass
        return results

    def get_stats(self) -> Dict[str, Any]:
        query = """
            SELECT 
                COUNT(*) as total_trainings,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_trainings,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_trainings,
                AVG(validation_accuracy) as avg_accuracy,
                MAX(validation_accuracy) as max_accuracy,
                AVG(training_duration_seconds) as avg_training_duration
            FROM model_metrics
            WHERE status = 'completed'
        """
        stats = self._fetch_one(query) or {}
        recent = self.get_history(5)
        return {
            "total_trainings": stats.get("total_trainings", 0),
            "successful_trainings": stats.get("successful_trainings", 0),
            "failed_trainings": stats.get("failed_trainings", 0),
            "avg_accuracy": stats.get("avg_accuracy"),
            "max_accuracy": stats.get("max_accuracy"),
            "avg_training_duration": stats.get("avg_training_duration"),
            "recent_versions": recent
        }