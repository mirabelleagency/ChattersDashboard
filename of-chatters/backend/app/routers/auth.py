from datetime import timedelta
from fastapi import Response, Cookie
import secrets
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..security.auth import create_access_token, create_refresh_token, decode_jwt, get_password_hash, verify_password, get_current_user

router = APIRouter()


@router.post("/token", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db), response: Response = None
):
    # OAuth2 form uses 'username' field; we treat it as email
    user: Optional[models.User] = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    access_token = create_access_token({"sub": str(user.id)}, expires_delta=timedelta(minutes=15))
    refresh_token = create_refresh_token({"sub": str(user.id)})
    # Use FastAPI Response to set cookies and return JSON
    # Set httpOnly refresh cookie on the provided Response
    # Persist refresh token record (jti) and set cookie
    jti = str(uuid.uuid4())
    # Save token record with expiration
    rt = models.RefreshToken(jti=jti, user_id=user.id, expires_at=(datetime.utcnow() + timedelta(days=7)))
    db.add(rt)
    db.commit()
    # Attach jti to refresh JWT so we can validate server-side
    refresh_token = create_refresh_token({"sub": str(user.id), "jti": jti})
    if response is not None:
        cookie_secure = os.getenv("COOKIE_SECURE", "0") == "1"
        # Lax prevents most CSRF on simple cross-site navigations; we still add explicit CSRF token below
        response.set_cookie("refresh", refresh_token, httponly=True, max_age=7*24*60*60, path="/", samesite="lax", secure=cookie_secure)
        # Access cookie for server-side reads
        response.set_cookie("access", access_token, httponly=True, max_age=60*60, path="/", samesite="lax", secure=cookie_secure)
        # CSRF token (readable by JS)
        csrf = secrets.token_urlsafe(32)
        response.set_cookie("csrf", csrf, httponly=False, max_age=7*24*60*60, path="/", samesite="lax", secure=cookie_secure)
    return {"access_token": access_token, "token_type": "bearer"}



@router.post("/refresh")
def refresh_token(refresh: Optional[str] = Cookie(None), db: Session = Depends(get_db), response: Response = None):
    if not refresh:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    payload = decode_jwt(refresh)
    if not payload or payload.get("typ") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user_id = payload.get("sub")
    jti = payload.get("jti")
    user = db.get(models.User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid user")
    # Verify jti exists and not revoked
    if not jti:
        raise HTTPException(status_code=401, detail="Invalid refresh token (no jti)")
    rt = db.query(models.RefreshToken).filter_by(jti=jti, user_id=user.id, revoked=False).first()
    if not rt:
        raise HTTPException(status_code=401, detail="Refresh token revoked or not found")
    # Rotate: revoke old and issue new record
    rt.revoked = True
    db.add(rt)
    new_jti = str(uuid.uuid4())
    new_rt = models.RefreshToken(jti=new_jti, user_id=user.id, expires_at=(datetime.utcnow() + timedelta(days=7)))
    db.add(new_rt)
    db.commit()
    access_token = create_access_token({"sub": str(user.id)}, expires_delta=timedelta(minutes=15))
    new_refresh = create_refresh_token({"sub": str(user.id), "jti": new_jti})
    if response is not None:
        cookie_secure = os.getenv("COOKIE_SECURE", "0") == "1"
        response.set_cookie("refresh", new_refresh, httponly=True, max_age=7*24*60*60, path="/", samesite="lax", secure=cookie_secure)
        response.set_cookie("access", access_token, httponly=True, max_age=60*60, path="/", samesite="lax", secure=cookie_secure)
        csrf = secrets.token_urlsafe(32)
        response.set_cookie("csrf", csrf, httponly=False, max_age=7*24*60*60, path="/", samesite="lax", secure=cookie_secure)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
def logout(response: Response = None):
    # Revoke refresh token server-side if present
    # Note: we can't read HttpOnly cookie from here directly unless using Request; skip server revoke on logout endpoint for now
    if response is not None:
        cookie_secure = os.getenv("COOKIE_SECURE", "0") == "1"
        response.delete_cookie("refresh", path="/", samesite="lax")
        response.delete_cookie("access", path="/", samesite="lax")
        response.delete_cookie("csrf", path="/", samesite="lax")
    return {"status": "ok"}



@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    role_names = [ur.role.name for ur in user.user_roles]
    return schemas.UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=role_names,
        is_admin="admin" in role_names,
    )


@router.post("/seed-admin")
def seed_admin(db: Session = Depends(get_db)):
    # Ensure roles exist
    role_names = ["admin", "manager", "analyst", "agent"]
    existing_roles = {
        r.name: r for r in db.query(models.Role).filter(models.Role.name.in_(role_names)).all()
    }
    for rn in role_names:
        if rn not in existing_roles:
            r = models.Role(name=rn)
            db.add(r)
            existing_roles[rn] = r
    db.flush()

    # Create admin user if missing
    admin_email = "admin@example.com"
    user = db.query(models.User).filter(models.User.email == admin_email).first()
    if not user:
        user = models.User(email=admin_email, full_name="Admin", password_hash=get_password_hash("changeme"))
        db.add(user)
        db.flush()

    # Attach admin role
    admin_role = existing_roles["admin"]
    has_admin = db.query(models.UserRole).filter_by(user_id=user.id, role_id=admin_role.id).first()
    if not has_admin:
        db.add(models.UserRole(user_id=user.id, role_id=admin_role.id))

    db.commit()
    db.refresh(user)
    user_roles = [ur.role.name for ur in user.user_roles]
    return {"status": "ok", "admin_email": admin_email, "password": "changeme", "roles": user_roles}
