from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import get_db
from .. import models, schemas
from ..security.auth import require_roles, get_current_user
from ..services.metrics import compute_conversion_rate, compute_unlock_ratio, parse_art_interval, compute_sph

router = APIRouter(dependencies=[Depends(require_roles("manager", "admin", "analyst"))])


def write_audit(db: Session, user_id: Optional[int], action: str, entity: str, entity_id: Optional[str], before: Optional[dict], after: Optional[dict], request: Request):
    log = models.AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        before_json=before,
        after_json=after,
        ip=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    db.add(log)


@router.post("/performance", response_model=schemas.PerformanceOut)
def upsert_performance(payload: schemas.PerformanceUpsert, db: Session = Depends(get_db), request: Request = None, user=Depends(get_current_user)):
    perf = (
        db.query(models.PerformanceDaily)
        .filter(models.PerformanceDaily.chatter_id == payload.chatter_id, models.PerformanceDaily.shift_date == payload.shift_date)
        .first()
    )

    before = None
    if not perf:
        perf = models.PerformanceDaily(chatter_id=payload.chatter_id, shift_date=payload.shift_date)
        db.add(perf)
    else:
        before = {
            "id": perf.id,
            "sales_amount": float(perf.sales_amount or 0),
            "sold_count": perf.sold_count,
            "retention_count": perf.retention_count,
            "unlock_count": perf.unlock_count,
            "sph": float(perf.sph or 0),
            "conversion_rate": float(perf.conversion_rate or 0),
            "unlock_ratio": float(perf.unlock_ratio or 0),
        }

    # Update provided fields
    for field in [
        "team_id",
        "sales_amount",
        "sold_count",
        "retention_count",
        "unlock_count",
        "total_sales",
        "sph",
        "golden_ratio",
        "hinge_top_up",
        "tricks_tsf",
    ]:
        val = getattr(payload, field)
        if val is not None:
            setattr(perf, field, val)

    if payload.art_interval is not None:
        td = parse_art_interval(payload.art_interval)
        perf.art_interval = td

    # Derive fields if possible
    if perf.sph is None and perf.sales_amount is not None:
        # Try to compute from shift actual hours if any
        # Note: not always available here; computation best-effort
        # For acceptance, if sph provided, we keep it
        pass

    perf.conversion_rate = compute_conversion_rate(perf.sold_count, perf.retention_count, perf.unlock_count)
    perf.unlock_ratio = compute_unlock_ratio(perf.unlock_count, perf.sold_count)

    db.flush()

    after = {
        "id": perf.id,
        "sales_amount": float(perf.sales_amount or 0),
        "sold_count": perf.sold_count,
        "retention_count": perf.retention_count,
        "unlock_count": perf.unlock_count,
        "sph": float(perf.sph or 0),
        "conversion_rate": float(perf.conversion_rate or 0),
        "unlock_ratio": float(perf.unlock_ratio or 0),
    }

    write_audit(db, user.id if user else None, "upsert", "performance_daily", str(perf.id), before, after, request)
    db.commit()

    return schemas.PerformanceOut.model_validate(perf)
