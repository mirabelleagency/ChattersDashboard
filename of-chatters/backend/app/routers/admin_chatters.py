from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import get_db
from .. import models, schemas
from ..security.auth import require_roles, get_current_user

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


@router.get("/chatters", response_model=List[schemas.ChatterOut])
def list_chatters(db: Session = Depends(get_db)):
    rows = db.query(models.Chatter, models.Team).join(models.Team, isouter=True).all()
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


@router.post("/chatters", response_model=schemas.ChatterOut)
def create_chatter(payload: schemas.ChatterCreate, db: Session = Depends(get_db), request: Request = None, user=Depends(get_current_user)):
    team = None
    if payload.team_name:
        team = db.query(models.Team).filter(models.Team.name == payload.team_name).first()
        if not team:
            team = models.Team(name=payload.team_name)
            db.add(team)
            db.flush()
    ch = models.Chatter(
        name=payload.name,
        handle=payload.handle,
        email=payload.email,
        phone=payload.phone,
        is_active=True if payload.is_active is None else payload.is_active,
        team_id=team.id if team else None,
    )
    db.add(ch)
    db.flush()
    after = {
        "id": ch.id,
        "name": ch.name,
        "team_id": ch.team_id,
    }
    write_audit(db, user.id if user else None, "create", "chatters", str(ch.id), None, after, request)
    db.commit()

    return schemas.ChatterOut(
        id=ch.id,
        name=ch.name,
        handle=ch.handle,
        email=ch.email,
        phone=ch.phone,
        team_name=payload.team_name if team else None,
        is_active=ch.is_active,
    )


@router.put("/chatters/{chatter_id}", response_model=schemas.ChatterOut)
def update_chatter(chatter_id: int, payload: schemas.ChatterUpdate, db: Session = Depends(get_db), request: Request = None, user=Depends(get_current_user)):
    ch = db.get(models.Chatter, chatter_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Chatter not found")
    before = {"id": ch.id, "name": ch.name, "team_id": ch.team_id, "is_active": ch.is_active}

    team = None
    if payload.team_name is not None:
        if payload.team_name == "":
            ch.team_id = None
        else:
            team = db.query(models.Team).filter(models.Team.name == payload.team_name).first()
            if not team:
                team = models.Team(name=payload.team_name)
                db.add(team)
                db.flush()
            ch.team_id = team.id

    if payload.name is not None:
        ch.name = payload.name
    if payload.handle is not None:
        ch.handle = payload.handle
    if payload.email is not None:
        ch.email = payload.email
    if payload.phone is not None:
        ch.phone = payload.phone
    if payload.is_active is not None:
        ch.is_active = payload.is_active

    db.flush()
    after = {"id": ch.id, "name": ch.name, "team_id": ch.team_id, "is_active": ch.is_active}
    write_audit(db, user.id if user else None, "update", "chatters", str(ch.id), before, after, request)
    db.commit()

    team_name = db.query(models.Team.name).filter(models.Team.id == ch.team_id).scalar() if ch.team_id else None
    return schemas.ChatterOut(
        id=ch.id,
        name=ch.name,
        handle=ch.handle,
        email=ch.email,
        phone=ch.phone,
        team_name=team_name,
        is_active=ch.is_active,
    )


@router.delete("/chatters/{chatter_id}")
def delete_chatter(chatter_id: int, soft: bool = True, db: Session = Depends(get_db), request: Request = None, user=Depends(get_current_user)):
    ch = db.get(models.Chatter, chatter_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Chatter not found")
    before = {"id": ch.id, "name": ch.name, "team_id": ch.team_id, "is_active": ch.is_active}

    if soft:
        ch.deleted_at = func.now()  # type: ignore
        db.flush()
    else:
        db.delete(ch)
        db.flush()

    write_audit(db, user.id if user else None, "delete" if not soft else "soft_delete", "chatters", str(chatter_id), before, None, request)
    db.commit()
    return {"status": "ok"}
