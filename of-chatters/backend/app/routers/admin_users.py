from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..security.auth import require_roles, get_password_hash

router = APIRouter(prefix="/users", dependencies=[Depends(require_roles("admin"))])


def _ensure_role(db: Session, role_name: str) -> models.Role:
    role = db.query(models.Role).filter(models.Role.name == role_name).first()
    if not role:
        role = models.Role(name=role_name)
        db.add(role)
        db.flush()
    return role


def _is_admin(user: models.User) -> bool:
    return any(ur.role.name == "admin" for ur in user.user_roles)


def _set_admin_flag(db: Session, user: models.User, make_admin: bool) -> None:
    admin_role = _ensure_role(db, "admin")
    existing = db.query(models.UserRole).filter_by(user_id=user.id, role_id=admin_role.id)
    has_role = existing.first() is not None

    if make_admin and not has_role:
        db.add(models.UserRole(user_id=user.id, role_id=admin_role.id))
    elif not make_admin and has_role:
        remaining_admins = db.query(models.UserRole).filter(models.UserRole.role_id == admin_role.id, models.UserRole.user_id != user.id).count()
        if remaining_admins == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove the last administrator")
        existing.delete(synchronize_session=False)


def _user_to_out(user: models.User) -> schemas.AdminUserOut:
    is_admin = _is_admin(user)
    return schemas.AdminUserOut(
        id=user.id,
        username=user.email,
        email=user.email,
        full_name=user.full_name,
        is_admin=is_admin,
        created_at=user.created_at,
    )


@router.get("/", response_model=List[schemas.AdminUserOut])
def list_users(db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.id).all()
    return [_user_to_out(user) for user in users]


@router.post("/", response_model=schemas.AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: schemas.AdminUserCreate, db: Session = Depends(get_db)):
    login_identifier = payload.username or payload.email
    if not login_identifier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username (email) is required")

    existing = db.query(models.User).filter(models.User.email == login_identifier).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with that username already exists")

    user = models.User(
        email=login_identifier,
        full_name=payload.full_name,
        password_hash=get_password_hash(payload.password),
        is_active=True,
    )
    db.add(user)
    db.flush()

    _set_admin_flag(db, user, payload.is_admin)
    db.commit()
    db.refresh(user)
    return _user_to_out(user)


@router.put("/{user_id}", response_model=schemas.AdminUserOut)
def update_user(user_id: int, payload: schemas.AdminUserUpdate, db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    login_identifier = payload.username or payload.email
    if login_identifier and login_identifier != user.email:
        existing = db.query(models.User).filter(models.User.email == login_identifier, models.User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with that username already exists")
        user.email = login_identifier

    if payload.full_name is not None:
        user.full_name = payload.full_name

    if payload.password:
        user.password_hash = get_password_hash(payload.password)

    if payload.is_admin is not None:
        _set_admin_flag(db, user, payload.is_admin)

    db.commit()
    db.refresh(user)
    return _user_to_out(user)


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if _is_admin(user):
        admin_role = _ensure_role(db, "admin")
        remaining_admins = db.query(models.UserRole).filter(models.UserRole.role_id == admin_role.id, models.UserRole.user_id != user.id).count()
        if remaining_admins == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete the last administrator")

    db.delete(user)
    db.commit()
    return {"status": "ok"}


@router.post("/{user_id}/reset-password")
def reset_password(user_id: int, payload: schemas.AdminPasswordReset, db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return {"status": "ok"}
