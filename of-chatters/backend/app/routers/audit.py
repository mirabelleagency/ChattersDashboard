from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func

from ..db import get_db
from .. import models, schemas
from ..security.auth import require_roles

router = APIRouter(prefix="/audit", dependencies=[Depends(require_roles("admin"))])


@router.get("/logs", response_model=List[schemas.AuditLogOut])
def list_audit_logs(
    db: Session = Depends(get_db),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    entity: Optional[str] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    limit: int = 200,
):
    q = db.query(models.AuditLog).options(selectinload(models.AuditLog.user))
    if start:
        q = q.filter(models.AuditLog.occurred_at >= start)
    if end:
        q = q.filter(models.AuditLog.occurred_at <= end)
    if entity:
        q = q.filter(models.AuditLog.entity == entity)
    if user_id:
        q = q.filter(models.AuditLog.user_id == user_id)
    if action:
        q = q.filter(models.AuditLog.action == action)

    q = q.order_by(models.AuditLog.occurred_at.desc())
    if limit:
        q = q.limit(limit)

    rows = q.all()
    result: List[schemas.AuditLogOut] = []
    for row in rows:
        result.append(
            schemas.AuditLogOut.model_validate(
                {
                    "id": row.id,
                    "occurred_at": row.occurred_at,
                    "user_id": row.user_id,
                    "user_email": row.user.email if row.user else None,
                    "action": row.action,
                    "entity": row.entity,
                    "entity_id": row.entity_id,
                    "before_json": row.before_json,
                    "after_json": row.after_json,
                    "ip": row.ip,
                    "user_agent": row.user_agent,
                }
            )
        )
    return result


@router.get("/entities", response_model=list[str])
def list_audit_entities(db: Session = Depends(get_db)):
    rows = db.query(models.AuditLog.entity).filter(models.AuditLog.entity.isnot(None)).group_by(models.AuditLog.entity).order_by(models.AuditLog.entity.asc()).all()
    return [r[0] for r in rows if r and r[0]]


@router.get("/actions", response_model=list[str])
def list_audit_actions(db: Session = Depends(get_db)):
    rows = db.query(models.AuditLog.action).filter(models.AuditLog.action.isnot(None)).group_by(models.AuditLog.action).order_by(models.AuditLog.action.asc()).all()
    return [r[0] for r in rows if r and r[0]]
