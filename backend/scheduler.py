import asyncio
from datetime import datetime, timedelta, timezone
import logging
from time import monotonic

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text
from starlette.concurrency import run_in_threadpool

from database import SessionLocal
from scripts.update_data import update_db_with_new_games
from services.audit_service import AuditService
from services.model_artifacts import reload_artifacts
from services.redis_service import redis_service

logger = logging.getLogger(__name__)
STATUS_KEY = "data-updater:status"
UPDATE = "data-update"
RETRAIN = "model-retrain"


def utc_now():
    return datetime.now(timezone.utc)


def audit_job(user_id, name, details):
    try:
        with SessionLocal() as db:
            AuditService(db).log(
                user_id=user_id,
                action="DATA_UPDATE" if name == UPDATE else "MODEL_RETRAIN",
                entity="System",
                details=details,
            )
    except Exception:
        logger.exception("Could not audit %s", name)


class DataUpdater:
    def __init__(self):
        self.scheduler = AsyncIOScheduler(timezone="UTC")
        self.job: asyncio.Task | None = None
        self.status = {}
        self.active_job = None

    @property
    def is_busy(self):
        return self.job is not None and not self.job.done()

    def queue_job(self, name, user_id=None, import_before_training=False):
        if self.is_busy:
            return False
        self.active_job = name
        self.job = asyncio.create_task(self.run_job(name, user_id, import_before_training))
        return True

    async def run_job(self, name, user_id, import_before_training):
        start = monotonic()
        success = False
        details = {}
        try:
            if name == UPDATE or import_before_training:
                await self.update_data(days_back=7 if import_before_training else 2, user_id=user_id)
            if name == RETRAIN:
                from scripts.train_model import train_model
                model, _, _ = await run_in_threadpool(train_model)
                if model is None:
                    raise RuntimeError("Training returned no model")
                if not await run_in_threadpool(reload_artifacts):
                    raise RuntimeError("Could not activate the trained model")
            success = True
        except Exception:
            logger.exception("%s failed", name)
            details["error"] = "Import failed" if name == UPDATE else "Training failed"
        finally:
            if name == RETRAIN:
                details.update({
                    "success": success,
                    "timestamp": utc_now().isoformat(),
                    "training_duration": round(monotonic() - start, 1),
                })
                self.status["last_model_retrain"] = details
                await run_in_threadpool(audit_job, user_id, name, details)
            await run_in_threadpool(redis_service.set, STATUS_KEY, self.status, 30 * 86400)
            self.active_job = None

    async def update_data(self, days_back, user_id):
        details = {}
        try:
            details.update(await run_in_threadpool(update_db_with_new_games, None, days_back))
            details["success"] = True
            self.status["last_successful_sync"] = utc_now().isoformat()
        except Exception:
            details.update({"success": False, "error": "Import failed"})
            raise
        finally:
            details["timestamp"] = utc_now().isoformat()
            self.status["last_data_update"] = details
            await run_in_threadpool(audit_job, user_id, UPDATE, details)

    async def schedule_update(self):
        if not self.queue_job(UPDATE):
            logger.warning("Skipped scheduled data import because another job is running")

    async def schedule_retrain(self):
        if not self.queue_job(RETRAIN):
            logger.warning("Skipped scheduled training because another job is running")

    async def start(self):
        self.scheduler = AsyncIOScheduler(event_loop=asyncio.get_running_loop(), timezone="UTC")
        self.status = await run_in_threadpool(redis_service.get, STATUS_KEY) or {}
        self.scheduler.add_job(
            self.schedule_update, CronTrigger(hour=23, minute=59, timezone="UTC"),
            id="daily_data_update", replace_existing=True,
        )
        self.scheduler.add_job(
            self.schedule_retrain, CronTrigger(day_of_week="sun", hour=0, minute=30, timezone="UTC"),
            id="weekly_model_retrain", replace_existing=True,
        )
        self.scheduler.start()

    async def stop(self):
        self.scheduler.shutdown()
        # APScheduler enqueues shutdown on the active event loop.
        await asyncio.sleep(0)
        if self.job is not None:
            await self.job
        self.job = None

    def get_status(self):
        last_sync = self.status.get("last_successful_sync")
        last_update = self.status.get("last_data_update")
        lag = None
        try:
            with SessionLocal() as db:
                lag = db.execute(text("""
                    SELECT COUNT(*) AS pending,
                           EXTRACT(EPOCH FROM (:now - MIN(CAST(game_date AS timestamp)))) / 60
                               AS oldest_minutes
                    FROM game
                    WHERE CAST(game_date AS timestamp) >= :start
                      AND CAST(game_date AS timestamp) < :cutoff
                      AND (pts_home IS NULL OR pts_away IS NULL)
                """), {
                    "now": utc_now().replace(tzinfo=None),
                    "start": (utc_now() - timedelta(days=7)).replace(tzinfo=None),
                    "cutoff": (utc_now() - timedelta(hours=6)).replace(tzinfo=None),
                }).mappings().one()
                lag = dict(lag)
        except Exception as exc:
            logger.warning("Could not read game freshness", extra={"error_type": type(exc).__name__})

        alert = None
        if last_update and not last_update["success"]:
            alert = "import_failed"
        elif not last_sync or utc_now() - datetime.fromisoformat(last_sync) > timedelta(hours=26):
            alert = "sync_overdue"
        elif lag and lag["pending"]:
            alert = "results_delayed"
        update_job = self.scheduler.get_job("daily_data_update")
        retrain_job = self.scheduler.get_job("weekly_model_retrain")
        return {
            "last_data_update": last_update,
            "last_successful_sync": last_sync,
            "last_model_retrain": self.status.get("last_model_retrain"),
            "next_data_update": getattr(update_job, "next_run_time", None),
            "next_model_retrain": getattr(retrain_job, "next_run_time", None),
            "is_running": self.scheduler.running,
            "active_job": self.active_job,
            "result_lag": lag,
            "alert": alert,
        }


data_updater = DataUpdater()
