from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, case, cast, Float
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas

router = APIRouter()


@router.get("/kpis", response_model=schemas.KPIResponse)
def kpis(start: Optional[date] = None, end: Optional[date] = None, db: Session = Depends(get_db)):
    q = db.query(
        func.coalesce(func.sum(models.PerformanceDaily.sales_amount), 0).label("sales_amount"),
        func.coalesce(func.sum(models.PerformanceDaily.sold_count), 0).label("sold_count"),
        func.coalesce(func.sum(models.PerformanceDaily.unlock_count), 0).label("unlock_count"),
        func.coalesce(func.avg(models.PerformanceDaily.sph), 0).label("avg_sph"),
    )
    if start:
        q = q.filter(models.PerformanceDaily.shift_date >= start)
    if end:
        q = q.filter(models.PerformanceDaily.shift_date <= end)
    row = q.one()
    return schemas.KPIResponse(
        sales_amount=float(row.sales_amount or 0),
        sold_count=int(row.sold_count or 0),
        unlock_count=int(row.unlock_count or 0),
        avg_sph=float(row.avg_sph or 0),
    )


@router.get("/rankings")
def rankings(metric: str, start: Optional[date] = None, end: Optional[date] = None, limit: int = 20, db: Session = Depends(get_db)):
    # Determine aggregation
    metric = metric.lower()
    avg_metrics = {"sph", "golden_ratio", "conversion_rate"}
    sum_metrics = {"sales_amount", "sold_count", "retention_count", "unlock_count"}

    if metric not in avg_metrics.union(sum_metrics):
        raise HTTPException(status_code=400, detail="Unsupported metric")

    val_col = getattr(models.PerformanceDaily, metric)
    agg = func.avg(val_col) if metric in avg_metrics else func.sum(val_col)

    q = (
        db.query(
            models.Chatter.id.label("chatter_id"),
            models.Chatter.name.label("chatter_name"),
            models.Team.name.label("team_name"),
            cast(agg, Float).label("value"),
        )
        .join(models.Chatter, models.Chatter.id == models.PerformanceDaily.chatter_id)
        .join(models.Team, models.Team.id == models.PerformanceDaily.team_id, isouter=True)
    )

    if start:
        q = q.filter(models.PerformanceDaily.shift_date >= start)
    if end:
        q = q.filter(models.PerformanceDaily.shift_date <= end)

    q = q.group_by(models.Chatter.id, models.Chatter.name, models.Team.name)
    q = q.order_by(func.coalesce(cast(agg, Float), 0).desc())
    q = q.limit(limit)

    rows = q.all()
    result = []
    for idx, r in enumerate(rows, start=1):
        result.append(
            schemas.RankingRow(
                chatter_id=r.chatter_id,
                chatter_name=r.chatter_name,
                team_name=r.team_name,
                value=float(r.value or 0),
                rank=idx,
            )
        )
    return result
