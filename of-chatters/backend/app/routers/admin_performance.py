from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..security.auth import require_roles, get_current_user
from ..services.metrics import compute_conversion_rate, compute_unlock_ratio, parse_art_interval

router = APIRouter(dependencies=[Depends(require_roles("manager", "admin", "analyst"))])


def write_audit(db: Session, user_id: Optional[int], action: str, entity: str, entity_id: Optional[str], before: Optional[dict], after: Optional[dict], request: Request):
    before_json = jsonable_encoder(before) if before is not None else None
    after_json = jsonable_encoder(after) if after is not None else None
    log = models.AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        before_json=before_json,
        after_json=after_json,
        ip=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    db.add(log)


@router.post("/performance", response_model=schemas.PerformanceOut)
def upsert_performance(payload: schemas.PerformanceUpsert, request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
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


def _format_art_interval(value: Optional[timedelta]) -> Optional[str]:
    if value is None:
        return None
    total_seconds = int(value.total_seconds())
    minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}h {minutes}m {seconds}s"
    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


@router.get("/performance", response_model=List[schemas.PerformanceOut])
def list_performance(
    request: Request,
    db: Session = Depends(get_db),
    start: Optional[date] = None,
    end: Optional[date] = None,
    chatter_id: Optional[int] = None,
    team_id: Optional[int] = None,
    include_deleted: bool = False,
    limit: int = 250,
):
    q = db.query(models.PerformanceDaily)
    if not include_deleted:
        q = q.filter(models.PerformanceDaily.deleted_at.is_(None))
    if start:
        q = q.filter(models.PerformanceDaily.shift_date >= start)
    if end:
        q = q.filter(models.PerformanceDaily.shift_date <= end)
    if chatter_id:
        q = q.filter(models.PerformanceDaily.chatter_id == chatter_id)
    if team_id:
        q = q.filter(models.PerformanceDaily.team_id == team_id)

    q = q.order_by(models.PerformanceDaily.shift_date.desc(), models.PerformanceDaily.id.desc())
    if limit:
        q = q.limit(limit)

    rows = q.all()
    result: List[schemas.PerformanceOut] = []
    for row in rows:
        result.append(
            schemas.PerformanceOut(
                id=row.id,
                chatter_id=row.chatter_id,
                team_id=row.team_id,
                shift_date=row.shift_date,
                sales_amount=float(row.sales_amount) if row.sales_amount is not None else None,
                sold_count=row.sold_count,
                retention_count=row.retention_count,
                unlock_count=row.unlock_count,
                total_sales=float(row.total_sales) if row.total_sales is not None else None,
                sph=float(row.sph) if row.sph is not None else None,
                art_interval=_format_art_interval(row.art_interval),
                golden_ratio=float(row.golden_ratio) if row.golden_ratio is not None else None,
                hinge_top_up=float(row.hinge_top_up) if row.hinge_top_up is not None else None,
                tricks_tsf=float(row.tricks_tsf) if row.tricks_tsf is not None else None,
                conversion_rate=float(row.conversion_rate) if row.conversion_rate is not None else None,
                unlock_ratio=float(row.unlock_ratio) if row.unlock_ratio is not None else None,
            )
        )
    return result


@router.delete("/performance/{performance_id}")
def delete_performance(
    performance_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    soft: bool = True,
):
    perf = db.get(models.PerformanceDaily, performance_id)
    if not perf:
        raise HTTPException(status_code=404, detail="Performance record not found")

    before = schemas.PerformanceOut.model_validate(perf).model_dump()

    if soft:
        perf.deleted_at = func.now()  # type: ignore
        db.flush()
        after = {"deleted_at": str(perf.deleted_at)}
    else:
        db.delete(perf)
        db.flush()
        after = None

    write_audit(db, user.id if user else None, "delete" if not soft else "soft_delete", "performance_daily", str(performance_id), before, after, request)
    db.commit()
    return {"status": "ok"}
