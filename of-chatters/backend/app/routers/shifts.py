from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import get_db
from .. import models, schemas
from ..security.auth import require_roles, get_current_user

router = APIRouter(prefix="/shifts", dependencies=[Depends(require_roles("manager", "admin", "analyst"))])


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


@router.get("/", response_model=List[schemas.ShiftOut])
def list_shifts(db: Session = Depends(get_db), chatter_id: Optional[int] = None):
    q = db.query(models.Shift)
    if chatter_id:
        q = q.filter(models.Shift.chatter_id == chatter_id)
    return q.all()


@router.post("/", response_model=schemas.ShiftOut)
def create_shift(payload: schemas.ShiftCreate, db: Session = Depends(get_db), request: Request = None, user=Depends(get_current_user)):
    sh = models.Shift(**payload.model_dump())
    db.add(sh)
    db.flush()
    write_audit(db, user.id if user else None, "create", "shifts", str(sh.id), None, payload.model_dump(), request)
    db.commit()
    return sh


@router.put("/{shift_id}", response_model=schemas.ShiftOut)
def update_shift(shift_id: int, payload: schemas.ShiftUpdate, db: Session = Depends(get_db), request: Request = None, user=Depends(get_current_user)):
    sh = db.get(models.Shift, shift_id)
    if not sh:
        raise HTTPException(status_code=404, detail="Shift not found")
    before = schemas.ShiftOut.model_validate(sh).model_dump()
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(sh, k, v)
    db.flush()
    after = schemas.ShiftOut.model_validate(sh).model_dump()
    write_audit(db, user.id if user else None, "update", "shifts", str(sh.id), before, after, request)
    db.commit()
    return sh


@router.delete("/{shift_id}")
def delete_shift(shift_id: int, soft: bool = True, db: Session = Depends(get_db), request: Request = None, user=Depends(get_current_user)):
    sh = db.get(models.Shift, shift_id)
    if not sh:
        raise HTTPException(status_code=404, detail="Shift not found")
    before = schemas.ShiftOut.model_validate(sh).model_dump()

    if soft:
        sh.deleted_at = func.now()  # type: ignore
        db.flush()
    else:
        db.delete(sh)
        db.flush()

    write_audit(db, user.id if user else None, "delete" if not soft else "soft_delete", "shifts", str(shift_id), before, None, request)
    db.commit()
    return {"status": "ok"}
