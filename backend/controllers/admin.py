# backend/controllers/admin.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text
import csv
import io
from datetime import date, datetime, timedelta
from typing import List
from starlette.concurrency import run_in_threadpool

from database import get_db
from services.audit_service import AuditService
from services.auth_service import AuthService
from services.redis_service import redis_service
from middleware.auth import require_admin, require_admin_or_operator
import schemas

router = APIRouter()

# Блокировка/Разблокировка пользователя
@router.put("/users/{user_id}/block")
async def toggle_user_block(
        user_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    current_user = await require_admin(request)

    try:
        body = await request.json()
        is_blocked = bool(body.get("isBlocked", body.get("is_blocked", False)))

        if current_user.user_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot block your own account"
            )

        target = db.execute(
            text("SELECT id, email, name, username, role, is_blocked, created_at FROM users WHERE id = :user_id"),
            {"user_id": user_id}
        ).fetchone()

        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User was not found"
            )

        target_data = dict(target._mapping)
        if target_data.get("role") == "admin" and is_blocked:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An administrator cannot block another administrator"
            )

        # Обновляем статус в БД
        db.execute(
            text("UPDATE users SET is_blocked = :is_blocked WHERE id = :user_id"),
            {"is_blocked": is_blocked, "user_id": user_id}
        )
        if is_blocked and not await run_in_threadpool(redis_service.revoke_all_user_tokens, user_id):
            db.rollback()
            raise HTTPException(status_code=503, detail="Could not revoke sessions")
        db.commit()

        # Получаем обновленного пользователя
        result = db.execute(
            text("SELECT id, email, name, username, role, is_blocked, created_at FROM users WHERE id = :user_id"),
            {"user_id": user_id}
        ).fetchone()

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User was not found"
            )

        user_data = dict(result._mapping)

        # Логируем действие
        audit = AuditService(db)
        audit.log(
            user_id=current_user.user_id,
            action="BLOCK_USER" if is_blocked else "UNBLOCK_USER",
            entity="User",
            entity_id=user_id,
            details={"user_id": user_id, "tokens_revoked": is_blocked},
            ip_address=request.client.host if request.client else None
        )

        return schemas.UserResponse(
            id=user_data["id"],
            email=user_data["email"],
            name=user_data.get("name") or user_data.get("username") or user_data["email"],
            role=user_data["role"],
            created_at=user_data["created_at"],
            is_blocked=user_data["is_blocked"]
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error toggling user block: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating user"
        )


# Получение статистики админ панели
@router.get("/stats")
async def get_admin_stats(
        request: Request,
        db: Session = Depends(get_db)
):
    await require_admin(request)

    try:
        total_users = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        total_teams = db.execute(text("SELECT COUNT(*) FROM team")).scalar()
        total_players = db.execute(text("SELECT COUNT(*) FROM players")).scalar()
        total_matches = db.execute(text("SELECT COUNT(*) FROM game")).scalar()
        total_predictions = db.execute(text("SELECT COUNT(*) FROM predictions")).scalar()

        def check_table_exists(table_name: str) -> bool:
            try:
                result = db.execute(
                    text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :table_name)"),
                    {"table_name": table_name}
                ).scalar()
                return result
            except:
                return False

        total_backups = db.execute(text("SELECT COUNT(*) FROM backups")).scalar() if check_table_exists("backups") else 0

        accuracy = None
        try:
            from services.ai_service import AIService
            model_stats = await AIService(db).get_model_stats()
            accuracy = model_stats.get("accuracy")
        except Exception as e:
            print(f"Error getting live model accuracy for admin stats: {e}")

        last_backup_at = None
        if check_table_exists("backups"):
            result = db.execute(text("""
                SELECT created_at FROM backups 
                ORDER BY created_at DESC 
                LIMIT 1
            """)).fetchone()
            if result:
                last_backup_at = result[0].isoformat() if result[0] else None

        return {
            "totalUsers": total_users or 0,
            "totalTeams": total_teams or 0,
            "totalPlayers": total_players or 0,
            "totalMatches": total_matches or 0,
            "totalPredictions": total_predictions or 0,
            "totalBackups": total_backups or 0,
            "accuracy": accuracy,
            "lastBackupAt": last_backup_at
        }

    except Exception as e:
        print(f"Error getting admin stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error getting stats"
        )


@router.get("/users", response_model=List[schemas.UserResponse])
async def get_all_users(
        request: Request,
        db: Session = Depends(get_db)
):
    await require_admin(request)

    try:
        result = db.execute(text("""
            SELECT id, email, name, username, role, is_blocked, created_at 
            FROM users 
            ORDER BY id
        """)).fetchall()

        users = []
        for row in result:
            user_data = dict(row._mapping)
            users.append(schemas.UserResponse(
                id=user_data["id"],
                email=user_data["email"],
                name=user_data.get("name") or user_data.get("username") or user_data["email"],
                role=user_data["role"],
                created_at=user_data["created_at"],
                is_blocked=user_data["is_blocked"]
            ))

        return users

    except Exception as e:
        print(f"Error getting users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error getting users"
        )


# Получение логов аудита
@router.get("/logs", response_model=List[schemas.AuditLogResponse])
async def get_audit_logs(
        request: Request,
        limit: int = 100,
        db: Session = Depends(get_db)
):
    await require_admin(request)

    try:
        audit = AuditService(db)
        logs = audit.get_all_logs(limit=limit)
        return logs

    except Exception as e:
        print(f"Error getting audit logs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error getting logs"
        )


@router.post("/backup", dependencies=[Depends(require_admin)])
@router.post("/restore/{backup_id}", dependencies=[Depends(require_admin)])
async def legacy_backup_operation():
    raise HTTPException(status_code=410, detail="Use managed PostgreSQL backups")


@router.get("/backups", response_model=List[schemas.BackupResponse])
async def get_backups(
        request: Request,
        db: Session = Depends(get_db)
):
    await require_admin(request)

    try:
        if db.execute(text("SELECT to_regclass('public.backups')")).scalar() is None:
            return []
        result = db.execute(text("""
            SELECT id, filename, size, type, status, created_at
            FROM backups
            ORDER BY created_at DESC
        """)).fetchall()

        backups = []
        for row in result:
            data = dict(row._mapping)
            backups.append({
                "id": str(data["id"]),
                "filename": data["filename"],
                "size": data["size"],
                "type": data["type"],
                "status": data["status"],
                "createdAt": data["created_at"].isoformat() if data["created_at"] else None
            })

        return backups

    except Exception as e:
        print(f"Error getting backups: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error getting backups"
        )


@router.get("/matches.csv", dependencies=[Depends(require_admin_or_operator)])
def export_matches(start: date, end: date, db: Session = Depends(get_db)):
    """Exports non-personal match data for at most 31 calendar days."""
    if not timedelta(0) <= end - start < timedelta(days=31):
        raise HTTPException(status_code=422, detail="Select a date range of up to 31 days")
    rows = db.execute(text("""
        SELECT game_id, game_date, team_abbreviation_home, team_abbreviation_away,
               pts_home, pts_away, wl_home
        FROM game
        WHERE CAST(game_date AS date) BETWEEN :start AND :end
        ORDER BY game_date, game_id
    """), {"start": start, "end": end})
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(rows.keys())
    for row in rows:
        writer.writerow(escape_csv_cell(value) for value in row)
    return Response(
        output.getvalue(), media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="score-matches-{start}-{end}.csv"',
            "Cache-Control": "no-store",
        },
    )


def escape_csv_cell(value):
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value
