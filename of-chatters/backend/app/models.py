from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Interval,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, Mapped, mapped_column

from .db import Base


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    chatters = relationship("Chatter", back_populates="team")


class Chatter(Base):
    __tablename__ = "chatters"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    handle: Mapped[Optional[str]] = mapped_column(String(255))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    team_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)
    hired_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    team = relationship("Team", back_populates="chatters")
    shifts = relationship("Shift", back_populates="chatter")


class Shift(Base):
    __tablename__ = "shifts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chatter_id: Mapped[int] = mapped_column(ForeignKey("chatters.id"), nullable=False)
    team_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teams.id"))
    shift_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    shift_day: Mapped[Optional[str]] = mapped_column(String(20))
    scheduled_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    actual_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    scheduled_hours: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    actual_hours: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    chatter = relationship("Chatter", back_populates="shifts")
    team = relationship("Team")

    __table_args__ = (
        Index("ix_shifts_chatter_date", "chatter_id", "shift_date"),
    )


class PerformanceDaily(Base):
    __tablename__ = "performance_daily"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chatter_id: Mapped[int] = mapped_column(ForeignKey("chatters.id"), nullable=False)
    team_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teams.id"))
    shift_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    sales_amount: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    sold_count: Mapped[Optional[int]] = mapped_column(Integer)
    retention_count: Mapped[Optional[int]] = mapped_column(Integer)
    unlock_count: Mapped[Optional[int]] = mapped_column(Integer)
    total_sales: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    sph: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    art_interval: Mapped[Optional[str]] = mapped_column(Interval)
    golden_ratio: Mapped[Optional[float]] = mapped_column(Numeric(10, 4))
    hinge_top_up: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    tricks_tsf: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    conversion_rate: Mapped[Optional[float]] = mapped_column(Numeric(10, 4))
    unlock_ratio: Mapped[Optional[float]] = mapped_column(Numeric(10, 4))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    chatter = relationship("Chatter")
    team = relationship("Team")

    __table_args__ = (
        UniqueConstraint("chatter_id", "shift_date", name="uq_perf_chatter_date"),
        Index("ix_perf_shift_date", "shift_date"),
        Index("ix_perf_chatter_date", "chatter_id", "shift_date"),
    )


class Offense(Base):
    __tablename__ = "offenses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chatter_id: Mapped[int] = mapped_column(ForeignKey("chatters.id"), nullable=False)
    offense_type: Mapped[Optional[str]] = mapped_column(String(100))
    offense: Mapped[Optional[str]] = mapped_column(Text)
    offense_date: Mapped[Optional[datetime]] = mapped_column(Date)
    details: Mapped[Optional[str]] = mapped_column(Text)
    sanction: Mapped[Optional[str]] = mapped_column(Text)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    chatter = relationship("Chatter")


class RankingDaily(Base):
    __tablename__ = "rankings_daily"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shift_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    metric: Mapped[str] = mapped_column(String(50), nullable=False)
    chatter_id: Mapped[int] = mapped_column(ForeignKey("chatters.id"), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    metric_value: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chatter = relationship("Chatter")

    __table_args__ = (
        UniqueConstraint("shift_date", "metric", "chatter_id", name="uq_ranking_date_metric_chatter"),
    )


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user_roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    role_permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")


class UserRole(Base):
    __tablename__ = "user_roles"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), primary_key=True)

    user = relationship("User", back_populates="user_roles")
    role = relationship("Role")


class Permission(Base):
    __tablename__ = "permissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), primary_key=True)
    permission_id: Mapped[int] = mapped_column(ForeignKey("permissions.id"), primary_key=True)

    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(Text)
    before_json = Column(JSONB)
    after_json = Column(JSONB)
    ip: Mapped[Optional[str]] = mapped_column(String(100))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)


class Attachment(Base):
    __tablename__ = "attachments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(Text)
    storage_url: Mapped[str] = mapped_column(Text, nullable=False)
    uploaded_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SavedReport(Base):
    __tablename__ = "saved_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    config_json = Column(JSONB, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    jti: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)

    user = relationship("User")


# Helpful view definition name for convenience
V_CHATTER_DAILY_VIEW_NAME = "v_chatter_daily"
