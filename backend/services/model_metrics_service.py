from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Optional, List, Dict, Any
import json
class ModelMetricsService:
    def __init__(self, db: Session):
        self.db = db
        self._create_table_if_not_exists()

    def _create_table_if_not_exists(self):
        try:
            self.db.execute(text("""
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
            """))
            self.db.commit()
            print("Table model_metrics created/checked")
        except Exception as e:
            print(f"Error creating model_metrics table: {e}")
            self.db.rollback()

    def save_metrics(self, model_version: str, training_games_count: int = None,
                     accuracy: float = None, loss: float = None,
                     validation_accuracy: float = None, validation_loss: float = None,
                     features_count: int = None, training_duration_seconds: float = None,
                     status: str = "completed", error_message: str = None,
                     metadata: Dict = None) -> Dict[str, Any]:
        try:
            metadata_json = json.dumps(metadata) if metadata else None

            result = self.db.execute(
                text("""
                    INSERT INTO model_metrics 
                    (model_version, training_date, training_games_count, accuracy, loss,
                     validation_accuracy, validation_loss, features_count,
                     training_duration_seconds, status, error_message, metadata)
                    VALUES (:model_version, :training_date, :training_games_count, :accuracy, :loss,
                            :validation_accuracy, :validation_loss, :features_count,
                            :training_duration_seconds, :status, :error_message, :metadata)
                    RETURNING id
                """),
                {
                    "model_version": model_version,
                    "training_date": datetime.now(),
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
            )
            self.db.commit()

            return {
                "id": result.scalar(),
                "model_version": model_version,
                "training_date": datetime.now().isoformat(),
                "status": status
            }
        except Exception as e:
            self.db.rollback()
            print(f"Error saving metrics: {e}")
            return None

    def get_latest_metrics(self) -> Optional[Dict[str, Any]]:
        try:
            result = self.db.execute(
                text("""
                    SELECT * FROM model_metrics 
                    WHERE status = 'completed'
                    ORDER BY training_date DESC 
                    LIMIT 1
                """)
            ).fetchone()

            if result:
                metrics = dict(result._mapping)
                if metrics.get("metadata"):
                    try:
                        metrics["metadata"] = json.loads(metrics["metadata"])
                    except:
                        pass
                return metrics
            return None
        except Exception as e:
            print(f"Error getting latest metrics: {e}")
            return None

    def get_metrics_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        try:
            result = self.db.execute(
                text("""
                    SELECT * FROM model_metrics 
                    ORDER BY training_date DESC 
                    LIMIT :limit
                """),
                {"limit": limit}
            ).fetchall()

            metrics_list = []
            for row in result:
                metrics = dict(row._mapping)
                if metrics.get("metadata"):
                    try:
                        metrics["metadata"] = json.loads(metrics["metadata"])
                    except:
                        pass
                metrics_list.append(metrics)

            return metrics_list
        except Exception as e:
            print(f"Error getting metrics history: {e}")
            return []

    def get_model_stats(self) -> Dict[str, Any]:
        try:
            stats = self.db.execute(
                text("""
                    SELECT 
                        COUNT(*) as total_trainings,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_trainings,
                        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_trainings,
                        AVG(validation_accuracy) as avg_accuracy,
                        MAX(validation_accuracy) as max_accuracy,
                        AVG(training_duration_seconds) as avg_training_duration
                    FROM model_metrics
                    WHERE status = 'completed'
                """)
            ).fetchone()

            recent = self.get_metrics_history(5)

            return {
                "total_trainings": stats[0] if stats else 0,
                "successful_trainings": stats[1] if stats else 0,
                "failed_trainings": stats[2] if stats else 0,
                "avg_accuracy": float(stats[3]) if stats and stats[3] else None,
                "max_accuracy": float(stats[4]) if stats and stats[4] else None,
                "avg_training_duration": float(stats[5]) if stats and stats[5] else None,
                "recent_versions": recent
            }
        except Exception as e:
            print(f"Error getting model stats: {e}")
            return {
                "total_trainings": 0,
                "successful_trainings": 0,
                "failed_trainings": 0,
                "avg_accuracy": None,
                "max_accuracy": None,
                "avg_training_duration": None,
                "recent_versions": []
            }