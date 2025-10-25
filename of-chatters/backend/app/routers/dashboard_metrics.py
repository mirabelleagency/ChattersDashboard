from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from sqlalchemy import Float, cast, func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..security.auth import get_current_user, require_roles

router = APIRouter(prefix="/admin", tags=["admin:dashboard-metrics"], dependencies=[Depends(require_roles("manager", "admin", "analyst"))])


def _write_audit(
    db: Session,
    user_id: int | None,
    action: str,
    entity_id: str,
    before: dict | None,
    after: dict | None,
    request: Request,
) -> None:
    log = models.AuditLog(
        user_id=user_id,
        action=action,
        entity="dashboard_metric",
        entity_id=entity_id,
        before_json=jsonable_encoder(before) if before is not None else None,
        after_json=jsonable_encoder(after) if after is not None else None,
        ip=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    db.add(log)


def _format_interval(value: Optional[timedelta]) -> Optional[str]:
    if value is None:
        return None
    total_seconds = int(value.total_seconds())
    if total_seconds < 0:
        total_seconds = 0
    minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}h {minutes}m {seconds}s"
    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


def _compute_dashboard_snapshot(db: Session, start: Optional[date], end: Optional[date]) -> List[schemas.DashboardMetricSnapshot]:
    pd = models.PerformanceDaily
    sh = models.Shift
    q = (
        db.query(
            models.Chatter.id.label("chatter_id"),
            models.Chatter.name.label("chatter_name"),
            func.coalesce(func.sum(pd.total_sales), 0).label("total_sales"),
            func.coalesce(func.sum(cast(sh.actual_hours, Float)), 0).label("worked_hours"),
            func.min(pd.shift_date).label("start_date"),
            func.max(pd.shift_date).label("end_date"),
            func.coalesce(func.avg(pd.sph), 0).label("avg_sph"),
            func.coalesce(func.avg(pd.golden_ratio), 0).label("avg_gr"),
            func.coalesce(func.avg(pd.unlock_ratio), 0).label("avg_ur"),
            func.avg(pd.art_interval).label("avg_art"),
            func.max(models.Team.name).label("team_name"),
            func.max(sh.shift_day).label("shift_label"),
        )
        .join(models.Chatter, models.Chatter.id == pd.chatter_id)
        .outerjoin(
            sh,
            (sh.chatter_id == pd.chatter_id)
            & (sh.shift_date == pd.shift_date)
            & (sh.deleted_at.is_(None)),
        )
        .outerjoin(models.Team, models.Team.id == pd.team_id)
        .filter(pd.deleted_at.is_(None))
    )

    if start:
        q = q.filter(pd.shift_date >= start)
    if end:
        q = q.filter(pd.shift_date <= end)

    q = q.group_by(models.Chatter.id, models.Chatter.name)

    rows = q.all()

    metrics: List[schemas.DashboardMetricSnapshot] = []
    for row in rows:
        total_sales = float(row.total_sales or 0)
        worked_hours = float(row.worked_hours or 0)
        avg_sph = float(row.avg_sph or 0)
        if (worked_hours == 0 or worked_hours is None) and avg_sph:
            worked_hours = float(total_sales / avg_sph) if avg_sph else 0.0

        golden_ratio = float(row.avg_gr or 0)
        if 0 <= golden_ratio <= 1:
            golden_ratio *= 100

        unlock_ratio = float(row.avg_ur or 0)
        if 0 <= unlock_ratio <= 1:
            unlock_ratio *= 100

        metrics.append(
            schemas.DashboardMetricSnapshot(
                chatter_name=row.chatter_name,
                total_sales=round(total_sales, 2),
                worked_hours=round(worked_hours, 2),
                start_date=row.start_date,
                end_date=row.end_date,
                sph=round(avg_sph, 2),
                art=_format_interval(row.avg_art),
                gr=round(golden_ratio, 2),
                ur=round(unlock_ratio, 2),
                shift=row.shift_label or row.team_name,
                ranking=0,  # placeholder updated below
            )
        )

    # Apply overrides from the dashboard_metrics table and add pure-override rows if missing
    # 1) Rank initial computed metrics by total sales
    metrics.sort(key=lambda item: item.total_sales, reverse=True)
    for idx, metric in enumerate(metrics, start=1):
        metric.ranking = idx

    # 2) Fetch relevant overrides overlapping the requested window (if any)
    if metrics:
        names = {m.chatter_name for m in metrics}
    else:
        names = set()

    overrides_q = db.query(models.DashboardMetric)
    if names:
        overrides_q = overrides_q.filter(models.DashboardMetric.chatter_name.in_(names))
    # overlap filter with the requested summary range (if none provided, don't constrain)
    if start is not None:
        overrides_q = overrides_q.filter((models.DashboardMetric.end_date.is_(None)) | (models.DashboardMetric.end_date >= start))
    if end is not None:
        overrides_q = overrides_q.filter((models.DashboardMetric.start_date.is_(None)) | (models.DashboardMetric.start_date <= end))
    overrides = overrides_q.all()

    # Helper to check range overlap between snapshot row and override
    def _ranges_overlap(row_start: Optional[date], row_end: Optional[date], o_start: Optional[date], o_end: Optional[date]) -> bool:
        # Treat None as open-ended in the appropriate direction, meaning it overlaps
        # Calculate effective bounds
        if row_start is None and row_end is None:
            return True
        rs = row_start or row_end
        re = row_end or row_start
        # If override missing both, treat as full overlap
        if o_start is None and o_end is None:
            return True
        os = o_start or o_end
        oe = o_end or o_start
        if rs is not None and oe is not None and oe < rs:
            return False
        if re is not None and os is not None and os > re:
            return False
        return True

    # Build map of overrides per chatter for quick lookup
    overrides_by_name = {}
    for o in overrides:
        overrides_by_name.setdefault(o.chatter_name, []).append(o)

    # Apply overrides to existing computed rows
    applied_override_ids: set[int] = set()
    for m in metrics:
        o_list = overrides_by_name.get(m.chatter_name, [])
        chosen = None
        for o in o_list:
            if _ranges_overlap(m.start_date, m.end_date, o.start_date, o.end_date):
                chosen = o
                break
        if chosen:
            # Override numeric/text fields; keep the date range shown from the computed row
            m.total_sales = float(chosen.total_sales or 0)
            m.worked_hours = float(chosen.worked_hours or 0)
            m.sph = float(chosen.sph or 0)
            m.art = chosen.art
            m.gr = float(chosen.gr or 0)
            m.ur = float(chosen.ur or 0)
            if chosen.ranking is not None:
                m.ranking = int(chosen.ranking)
            if chosen.shift is not None:
                m.shift = chosen.shift
            m.override_id = int(chosen.id)
            m.overridden = True
            applied_override_ids.add(int(chosen.id))

    # Re-rank if any rankings were not explicitly set by override: keep current order by total_sales
    metrics.sort(key=lambda item: (item.ranking if item.ranking else float('inf'), -item.total_sales))
    # If many rankings are equal/None, normalize display rank
    for idx, m in enumerate(metrics, start=1):
        m.ranking = m.ranking or idx

    # 3) Add any override-only rows (for chatters missing in computed result)
    extra_overrides_q = db.query(models.DashboardMetric)
    if start is not None:
        extra_overrides_q = extra_overrides_q.filter((models.DashboardMetric.end_date.is_(None)) | (models.DashboardMetric.end_date >= start))
    if end is not None:
        extra_overrides_q = extra_overrides_q.filter((models.DashboardMetric.start_date.is_(None)) | (models.DashboardMetric.start_date <= end))
    # Exclude overrides already applied above
    if applied_override_ids:
        extra_overrides_q = extra_overrides_q.filter(~models.DashboardMetric.id.in_(applied_override_ids))
    # Also exclude those whose chatter name is present in computed and overlapped (handled above); keep ones for chatters without any computed data
    if names:
        extra_overrides_q = extra_overrides_q.filter(~models.DashboardMetric.chatter_name.in_(names))
    extra_overrides = extra_overrides_q.all()

    for o in extra_overrides:
        metrics.append(
            schemas.DashboardMetricSnapshot(
                chatter_name=o.chatter_name,
                total_sales=float(o.total_sales or 0),
                worked_hours=float(o.worked_hours or 0),
                start_date=o.start_date,
                end_date=o.end_date,
                sph=float(o.sph or 0),
                art=o.art,
                gr=float(o.gr or 0),
                ur=float(o.ur or 0),
                ranking=int(o.ranking) if o.ranking is not None else 0,
                shift=o.shift,
                override_id=int(o.id),
                overridden=True,
            )
        )

    # Final ordering: if explicit rankings exist, sort by ranking; else by total sales desc
    metrics.sort(key=lambda item: (item.ranking if item.ranking else float('inf'), -item.total_sales))
    for idx, m in enumerate(metrics, start=1):
        if not m.ranking or m.ranking == 0:
            m.ranking = idx

    return metrics


@router.get("/dashboard-metrics/summary", response_model=List[schemas.DashboardMetricSnapshot])
def get_dashboard_metric_summary(
    start: Optional[date] = None,
    end: Optional[date] = None,
    db: Session = Depends(get_db),
):
    return _compute_dashboard_snapshot(db, start, end)


@router.get("/dashboard-metrics", response_model=List[schemas.DashboardMetricOut])
def list_dashboard_metrics(db: Session = Depends(get_db)) -> List[schemas.DashboardMetricOut]:
    rows = (
        db.query(models.DashboardMetric)
        .order_by(models.DashboardMetric.ranking.asc().nullslast(), models.DashboardMetric.chatter_name.asc())
        .all()
    )
    return [schemas.DashboardMetricOut.model_validate(row) for row in rows]


@router.post("/dashboard-metrics", response_model=schemas.DashboardMetricOut, status_code=201)
def create_dashboard_metric(
    payload: schemas.DashboardMetricCreate,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> schemas.DashboardMetricOut:
    metric = models.DashboardMetric(**payload.model_dump(exclude_unset=True))
    db.add(metric)
    db.flush()
    after = schemas.DashboardMetricOut.model_validate(metric).model_dump()
    _write_audit(db, getattr(user, "id", None), "create", str(metric.id), None, after, request)
    db.commit()
    db.refresh(metric)
    return schemas.DashboardMetricOut.model_validate(metric)


@router.put("/dashboard-metrics/{metric_id}", response_model=schemas.DashboardMetricOut)
def update_dashboard_metric(
    metric_id: int,
    payload: schemas.DashboardMetricUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> schemas.DashboardMetricOut:
    metric = db.get(models.DashboardMetric, metric_id)
    if not metric:
        raise HTTPException(status_code=404, detail="Dashboard metric not found")

    before = schemas.DashboardMetricOut.model_validate(metric).model_dump()
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(metric, field, value)
    db.flush()

    after = schemas.DashboardMetricOut.model_validate(metric).model_dump()
    _write_audit(db, getattr(user, "id", None), "update", str(metric.id), before, after, request)
    db.commit()
    db.refresh(metric)
    return schemas.DashboardMetricOut.model_validate(metric)


@router.delete("/dashboard-metrics/{metric_id}", status_code=204)
def delete_dashboard_metric(
    metric_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> None:
    metric = db.get(models.DashboardMetric, metric_id)
    if not metric:
        raise HTTPException(status_code=404, detail="Dashboard metric not found")

    before = schemas.DashboardMetricOut.model_validate(metric).model_dump()
    db.delete(metric)
    db.flush()
    _write_audit(db, getattr(user, "id", None), "delete", str(metric_id), before, None, request)
    db.commit()