import asyncio
import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import sys
import os
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.update_data import update_db_with_new_games
from scripts.train_model import train_model
from database import SessionLocal
from services.audit_service import AuditService
from services.model_metrics_service import ModelMetricsService
import traceback

# Настройка логирования с поддержкой UTF-8
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scheduler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Обновление данных и переобучение модели

class DataUpdater:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.last_update_status = None
        self.last_retrain_status = None

    # Ежедневное обновление данных
    async def update_data_daily(self):
        logger.info("=" * 60)
        logger.info("START DAILY DATA UPDATE")
        logger.info(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        try:
            logger.info("Loading new games and updating results from ESPN...")
            # days_back=2 - проверяем вчера и сегодня
            result = update_db_with_new_games(days_back=2)

            logger.info(f"Updated results (scheduled -> finished): {result.get('updated_results', 0)}")
            logger.info(f"New games added: {result.get('new_games', 0)}")

            # Логируем обновление
            try:
                db = SessionLocal()
                audit = AuditService(db)
                audit.log(
                    user_id=1,
                    action="DATA_UPDATE",
                    entity="System",
                    details={
                        "updated_results": result.get('updated_results', 0),
                        "new_games": result.get('new_games', 0),
                        "update_type": "daily",
                        "timestamp": datetime.now().isoformat()
                    }
                )
                db.close()
            except Exception as e:
                logger.error(f"Audit logging error: {e}")

            self.last_update_status = {
                "success": True,
                "timestamp": datetime.now().isoformat(),
                "updated_results": result.get('updated_results', 0),
                "new_games": result.get('new_games', 0)
            }

            logger.info(f"DAILY DATA UPDATE COMPLETED")
            logger.info(f"Updated results: {result.get('updated_results', 0)}")
            logger.info(f"New games: {result.get('new_games', 0)}")
            logger.info("=" * 60)

            return result

        except Exception as e:
            logger.error(f"DATA UPDATE ERROR: {e}")
            traceback.print_exc()

            self.last_update_status = {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    async def retrain_model_weekly(self):
        logger.info("=" * 60)
        logger.info("START WEEKLY MODEL RETRAINING")
        logger.info(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        try:
            import time
            start_time = time.time()

            db = SessionLocal()
            try:
                from sqlalchemy import text
                games_count_before = db.execute(text("SELECT COUNT(*) FROM game WHERE wl_home IS NOT NULL")).scalar()
                logger.info(f"Games in DB before training: {games_count_before}")
            except Exception as e:
                logger.warning(f"Could not get stats: {e}")
                games_count_before = 0
            finally:
                db.close()

            logger.info("Starting model training...")
            model, scaler, team_emas = train_model()

            training_duration = time.time() - start_time

            db = SessionLocal()
            metrics_service = ModelMetricsService(db)

            if model:
                try:
                    import numpy as np
                    from sklearn.preprocessing import StandardScaler
                    from scripts.train_model import load_games, preprocess_and_build_dataset

                    df = load_games()
                    if len(df) > 0:
                        X, y, weights, team_emas_temp, game_dates = preprocess_and_build_dataset(df)

                        split_idx = int(0.8 * len(X))
                        X_train, X_val = X[:split_idx], X[split_idx:]
                        y_train, y_val = y[:split_idx], y[split_idx:]

                        scaler_temp = StandardScaler()
                        X_train_scaled = scaler_temp.fit_transform(X_train)
                        X_val_scaled = scaler_temp.transform(X_val)

                        val_loss, val_accuracy = model.evaluate(X_val_scaled, y_val, verbose=0)

                        metrics = {
                            "validation_accuracy": float(val_accuracy),
                            "validation_loss": float(val_loss),
                            "training_games_count": len(X),
                            "features_count": X.shape[1]
                        }
                    else:
                        metrics = {
                            "validation_accuracy": None,
                            "validation_loss": None,
                            "training_games_count": 0,
                            "features_count": 0
                        }
                except Exception as e:
                    logger.warning(f"Could not get model metrics: {e}")
                    metrics = {
                        "validation_accuracy": None,
                        "validation_loss": None,
                        "training_games_count": games_count_before,
                        "features_count": 20
                    }

                metrics_service.save_metrics(
                    model_version=f"v{datetime.now().strftime('%Y%m%d')}",
                    training_games_count=metrics.get("training_games_count", 0),
                    accuracy=metrics.get("validation_accuracy"),
                    loss=metrics.get("validation_loss"),
                    validation_accuracy=metrics.get("validation_accuracy"),
                    validation_loss=metrics.get("validation_loss"),
                    features_count=metrics.get("features_count", 20),
                    training_duration_seconds=training_duration,
                    status="completed"
                )

                logger.info(f"Model retrained successfully")
                logger.info(f"Version: v{datetime.now().strftime('%Y%m%d')}")
                logger.info(f"Training duration: {training_duration:.2f} sec")
                if metrics.get("validation_accuracy"):
                    logger.info(f"Validation accuracy: {metrics['validation_accuracy']:.4f}")
            else:
                metrics_service.save_metrics(
                    model_version=f"v{datetime.now().strftime('%Y%m%d')}_failed",
                    training_games_count=games_count_before,
                    status="failed",
                    error_message="Model training failed"
                )
                logger.error("Model training failed")

            db.close()

            try:
                db = SessionLocal()
                audit = AuditService(db)
                audit.log(
                    user_id=1,
                    action="MODEL_RETRAIN",
                    entity="System",
                    details={
                        "model_version": f"v{datetime.now().strftime('%Y%m%d')}",
                        "training_duration": training_duration,
                        "success": model is not None
                    }
                )
                db.close()
            except Exception as e:
                logger.error(f"Audit logging error: {e}")

            self.last_retrain_status = {
                "success": model is not None,
                "timestamp": datetime.now().isoformat(),
                "model_version": f"v{datetime.now().strftime('%Y%m%d')}",
                "training_duration": training_duration
            }

            logger.info(f"WEEKLY MODEL RETRAINING COMPLETED")
            logger.info("=" * 60)

            return {
                "success": model is not None,
                "model_version": f"v{datetime.now().strftime('%Y%m%d')}",
                "training_duration": training_duration,
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"MODEL RETRAINING ERROR: {e}")
            traceback.print_exc()

            try:
                db = SessionLocal()
                metrics_service = ModelMetricsService(db)
                metrics_service.save_metrics(
                    model_version=f"v{datetime.now().strftime('%Y%m%d')}_failed",
                    status="failed",
                    error_message=str(e)
                )
                db.close()
            except:
                pass

            self.last_retrain_status = {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    # Запуск планировщика

    def start(self):
        self.scheduler.add_job(
            self.update_data_daily,
            trigger=CronTrigger(hour=23, minute=59),
            id="daily_data_update",
            name="Daily data update",
            replace_existing=True
        )

        self.scheduler.add_job(
            self.retrain_model_weekly,
            trigger=CronTrigger(day_of_week='sun', hour=0, minute=30),
            id="weekly_model_retrain",
            name="Weekly model retraining",
            replace_existing=True
        )

        self.scheduler.start()
        logger.info("Scheduler started")
        logger.info("Daily data update scheduled at 23:59")
        logger.info("Weekly model retraining scheduled at Sunday 00:30")

        for job in self.scheduler.get_jobs():
            logger.info(f"Job: {job.name} (ID: {job.id}) - next run: {job.next_run_time}")

    # Остановка планировщика

    def stop(self):
        self.scheduler.shutdown()
        logger.info("Scheduler stopped")

    # Получение статуса последних операций

    def get_status(self):
        return {
            "last_data_update": self.last_update_status,
            "last_model_retrain": self.last_retrain_status,
            "next_data_update": self.scheduler.get_job("daily_data_update").next_run_time if self.scheduler.get_job(
                "daily_data_update") else None,
            "next_model_retrain": self.scheduler.get_job(
                "weekly_model_retrain").next_run_time if self.scheduler.get_job("weekly_model_retrain") else None,
            "is_running": self.scheduler.running
        }

data_updater = DataUpdater()