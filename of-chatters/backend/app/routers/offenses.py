from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..security.auth import require_roles, get_current_user

router = APIRouter(prefix="/offenses", dependencies=[Depends(require_roles("manager", "admin", "analyst"))])


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


@router.get("/", response_model=List[schemas.OffenseOut])
def list_offenses(chatter_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.Offense)
    if chatter_id is not None:
        q = q.filter(models.Offense.chatter_id == chatter_id)
    return q.all()


@router.post("/", response_model=schemas.OffenseOut)
def create_offense(payload: schemas.OffenseCreate, db: Session = Depends(get_db), request: Request = None, user=Depends(get_current_user)):
    off = models.Offense(**payload.model_dump())
    db.add(off)
    db.flush()
    write_audit(db, user.id if user else None, "create", "offenses", str(off.id), None, payload.model_dump(), request)
    db.commit()
    return off


@router.put("/{offense_id}", response_model=schemas.OffenseOut)
def update_offense(offense_id: int, payload: schemas.OffenseUpdate, db: Session = Depends(get_db), request: Request = None, user=Depends(get_current_user)):
    off = db.get(models.Offense, offense_id)
    if not off:
        raise HTTPException(status_code=404, detail="Offense not found")
    before = schemas.OffenseOut.model_validate(off).model_dump()

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(off, k, v)
    db.flush()
    after = schemas.OffenseOut.model_validate(off).model_dump()
    write_audit(db, user.id if user else None, "update", "offenses", str(off.id), before, after, request)
    db.commit()
    return off


@router.delete("/{offense_id}")
def delete_offense(offense_id: int, soft: bool = True, db: Session = Depends(get_db), request: Request = None, user=Depends(get_current_user)):
    off = db.get(models.Offense, offense_id)
    if not off:
        raise HTTPException(status_code=404, detail="Offense not found")
    before = schemas.OffenseOut.model_validate(off).model_dump()

    if soft:
        from sqlalchemy import func
        off.deleted_at = func.now()  # type: ignore
        db.flush()
    else:
        db.delete(off)
        db.flush()

    write_audit(db, user.id if user else None, "delete" if not soft else "soft_delete", "offenses", str(offense_id), before, None, request)
    db.commit()
    return {"status": "ok"}
