from typing import List, Dict, Any, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..security.auth import get_current_user

router = APIRouter()


MetricAgg = {
    # sums
    "sales_amount": (func.sum, models.PerformanceDaily.sales_amount),
    "sold_count": (func.sum, models.PerformanceDaily.sold_count),
    "unlock_count": (func.sum, models.PerformanceDaily.unlock_count),
    "retention_count": (func.sum, models.PerformanceDaily.retention_count),
    # avgs
    "sph": (func.avg, models.PerformanceDaily.sph),
    "golden_ratio": (func.avg, models.PerformanceDaily.golden_ratio),
    "conversion_rate": (func.avg, models.PerformanceDaily.conversion_rate),
}


@router.post("/run")
def run_report(req: schemas.ReportRunRequest, db: Session = Depends(get_db)):
    if not req.metrics or not req.dimensions:
        raise HTTPException(status_code=400, detail="metrics and dimensions are required")

    dims = req.dimensions
    metrics = req.metrics

    # Base query
    q = db.query()

    # Dimensions
    group_cols = []
    if "date" in dims:
        q = q.add_columns(models.PerformanceDaily.shift_date.label("date"))
        group_cols.append(models.PerformanceDaily.shift_date)
    if "team" in dims:
        q = q.join(models.Team, models.Team.id == models.PerformanceDaily.team_id, isouter=True)
        q = q.add_columns(models.Team.name.label("team"))
        group_cols.append(models.Team.name)
    if "chatter" in dims:
        q = q.join(models.Chatter, models.Chatter.id == models.PerformanceDaily.chatter_id)
        q = q.add_columns(models.Chatter.name.label("chatter"))
        group_cols.append(models.Chatter.name)

    # Metrics
    metric_cols = {}
    for m in metrics:
        if m not in MetricAgg:
            raise HTTPException(status_code=400, detail=f"Unsupported metric: {m}")
        agg_fn, col = MetricAgg[m]
        label = f"m__{m}"
        q = q.add_columns(agg_fn(col).label(label))
        metric_cols[m] = label

    q = q.select_from(models.PerformanceDaily)

    # Date filters
    start_date = req.start
    end_date = req.end

    # If preset provided and no explicit dates, compute inclusive [start, end]
    if (not start_date and not end_date) and req.preset:
        today = date.today()
        preset_days = {
            "last_7_days": 7,
            "last_30_days": 30,
            # Approximate months as 30 days to avoid extra dependencies
            "last_3_months": 90,
            "last_6_months": 180,
            "last_1_year": 365,
        }[req.preset]
        end_date = today
        start_date = today - timedelta(days=preset_days - 1)

    if start_date:
        q = q.filter(models.PerformanceDaily.shift_date >= start_date)
    if end_date:
        q = q.filter(models.PerformanceDaily.shift_date <= end_date)

    # Additional filters (optional)
    if req.filters:
        if team_name := req.filters.get("team_name"):
            q = q.join(models.Team, models.Team.id == models.PerformanceDaily.team_id, isouter=True)
            q = q.filter(models.Team.name == team_name)
        if chatter_id := req.filters.get("chatter_id"):
            q = q.filter(models.PerformanceDaily.chatter_id == chatter_id)

    if group_cols:
        q = q.group_by(*group_cols)

    rows = q.all()

    # Build response
    result: List[schemas.ReportRow] = []
    for r in rows:
        row_dict = r._mapping  # type: ignore
        item = schemas.ReportRow(
            date=row_dict.get("date"),
            team=row_dict.get("team"),
            chatter=row_dict.get("chatter"),
            values={}
        )
        for m in metrics:
            label = metric_cols[m]
            val = row_dict.get(label)
            item.values[m] = float(val or 0)
        result.append(item)

    return {"rows": [i.model_dump() for i in result]}


@router.post("/save")
def save_report(req: schemas.SaveReportRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    sr = models.SavedReport(
        owner_user_id=user.id if user else None,
        name=req.name,
        description=req.description,
        config_json=req.config_json,
        is_public=req.is_public,
    )
    db.add(sr)
    db.commit()
    db.refresh(sr)
    return schemas.SavedReportOut.model_validate(sr)


@router.get("/saved", response_model=List[schemas.SavedReportOut])
def list_saved_reports(db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.SavedReport)
    q = q.filter((models.SavedReport.is_public.is_(True)) | (models.SavedReport.owner_user_id == user.id))
    rows = q.order_by(models.SavedReport.created_at.desc()).all()
    return rows
