from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from ..db import get_db
from .. import models
from ..security.auth import get_current_user, require_roles

router = APIRouter()


class ThresholdsIn(BaseModel):
    excellent_min: float = Field(..., gt=0)
    review_max: float = Field(..., ge=0)


class ThresholdsOut(BaseModel):
    excellent_min: float
    review_max: float


@router.get("/admin/dashboard-thresholds", response_model=ThresholdsOut)
def get_thresholds(_: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(models.DashboardThresholds).order_by(models.DashboardThresholds.id.asc()).first()
    if not row:
        # create default singleton
        row = models.DashboardThresholds(id=1, excellent_min=100.0, review_max=40.0)
        db.add(row)
        db.commit()
        db.refresh(row)
    return ThresholdsOut(excellent_min=float(row.excellent_min or 0), review_max=float(row.review_max or 0))


@router.put("/admin/dashboard-thresholds", response_model=ThresholdsOut, dependencies=[Depends(require_roles("admin"))])
def update_thresholds(payload: ThresholdsIn, db: Session = Depends(get_db)):
    if payload.review_max >= payload.excellent_min:
        raise HTTPException(status_code=400, detail="review_max must be less than excellent_min")
    row = db.query(models.DashboardThresholds).order_by(models.DashboardThresholds.id.asc()).first()
    if not row:
        row = models.DashboardThresholds(id=1)
        db.add(row)
    row.excellent_min = payload.excellent_min
    row.review_max = payload.review_max
    db.commit()
    db.refresh(row)
    return ThresholdsOut(excellent_min=float(row.excellent_min or 0), review_max=float(row.review_max or 0))
