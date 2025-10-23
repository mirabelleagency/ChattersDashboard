from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas

router = APIRouter()


@router.get("/chatters", response_model=List[schemas.ChatterOut])
def list_chatters(db: Session = Depends(get_db), q: Optional[str] = None, team: Optional[str] = None, active: Optional[bool] = True):
    query = db.query(models.Chatter, models.Team).join(models.Team, isouter=True)
    if q:
        like = f"%{q}%"
        query = query.filter(models.Chatter.name.ilike(like))
    if team:
        query = query.filter(models.Team.name == team)
    if active is not None:
        if active:
            query = query.filter(models.Chatter.deleted_at.is_(None)).filter(models.Chatter.is_active.is_(True))
        else:
            query = query.filter(models.Chatter.is_active.is_(False))

    rows = query.all()
    result: List[schemas.ChatterOut] = []
    for ch, tm in rows:
        result.append(
            schemas.ChatterOut(
                id=ch.id,
                name=ch.name,
                handle=ch.handle,
                email=ch.email,
                phone=ch.phone,
                team_name=tm.name if tm else None,
                is_active=ch.is_active,
            )
        )
    return result
