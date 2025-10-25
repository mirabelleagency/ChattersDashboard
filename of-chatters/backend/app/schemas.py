from datetime import date, datetime, timedelta
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, EmailStr

# Common
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenRequest(BaseModel):
    email: EmailStr
    password: str


# Users
class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str]
    roles: List[str] = Field(default_factory=list)
    is_admin: bool = False

    class Config:
        from_attributes = True


class AdminUserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=255)
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_admin: bool = False


class AdminUserCreate(AdminUserBase):
    password: str = Field(..., min_length=6)


class AdminUserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=255)
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_admin: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6)


class AdminPasswordReset(BaseModel):
    new_password: str = Field(..., min_length=6)


class AdminUserOut(BaseModel):
    id: int
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Chatters
class ChatterBase(BaseModel):
    name: str
    handle: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    team_name: Optional[str] = None
    is_active: Optional[bool] = True
    external_id: Optional[str] = None


class ChatterCreate(ChatterBase):
    pass


class ChatterUpdate(BaseModel):
    name: Optional[str] = None
    handle: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    team_name: Optional[str] = None
    is_active: Optional[bool] = None
    external_id: Optional[str] = None


class ChatterOut(BaseModel):
    id: int
    name: str
    handle: Optional[str]
    email: Optional[EmailStr]
    phone: Optional[str]
    team_name: Optional[str]
    is_active: bool
    external_id: Optional[str] = None

    class Config:
        from_attributes = True


# Shifts
class ShiftBase(BaseModel):
    chatter_id: int
    team_id: Optional[int] = None
    shift_date: date
    shift_day: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    scheduled_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    remarks: Optional[str] = None


class ShiftCreate(ShiftBase):
    pass


class ShiftUpdate(BaseModel):
    shift_day: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    scheduled_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    remarks: Optional[str] = None
    deleted_at: Optional[datetime] = None


class ShiftOut(ShiftBase):
    id: int

    class Config:
        from_attributes = True


# PerformanceDaily
class PerformanceUpsert(BaseModel):
    chatter_id: int
    shift_date: date
    team_id: Optional[int] = None
    sales_amount: Optional[float] = None
    sold_count: Optional[int] = None
    retention_count: Optional[int] = None
    unlock_count: Optional[int] = None
    total_sales: Optional[float] = None
    sph: Optional[float] = None
    art_interval: Optional[str] = None
    golden_ratio: Optional[float] = None
    hinge_top_up: Optional[float] = None
    tricks_tsf: Optional[float] = None


class PerformanceOut(BaseModel):
    id: int
    chatter_id: int
    team_id: Optional[int]
    shift_date: date
    sales_amount: Optional[float]
    sold_count: Optional[int]
    retention_count: Optional[int]
    unlock_count: Optional[int]
    total_sales: Optional[float]
    sph: Optional[float]
    art_interval: Optional[str]
    golden_ratio: Optional[float]
    hinge_top_up: Optional[float]
    tricks_tsf: Optional[float]
    conversion_rate: Optional[float]
    unlock_ratio: Optional[float]

    class Config:
        from_attributes = True


# Offenses
class OffenseBase(BaseModel):
    chatter_id: int
    offense_type: Optional[str] = None
    offense: Optional[str] = None
    offense_date: Optional[date] = None
    details: Optional[str] = None
    sanction: Optional[str] = None


class OffenseCreate(OffenseBase):
    pass


class OffenseUpdate(BaseModel):
    offense_type: Optional[str] = None
    offense: Optional[str] = None
    offense_date: Optional[date] = None
    details: Optional[str] = None
    sanction: Optional[str] = None
    deleted_at: Optional[datetime] = None


class OffenseOut(OffenseBase):
    id: int

    class Config:
        from_attributes = True


# KPIs and rankings
class KPIResponse(BaseModel):
    sales_amount: float = 0.0
    sold_count: int = 0
    unlock_count: int = 0
    avg_sph: float = 0.0


class RankingRow(BaseModel):
    chatter_id: int
    chatter_name: str
    team_name: Optional[str]
    value: float
    rank: int


# Reports
Metric = Literal[
    "sales_amount", "sold_count", "unlock_count", "retention_count", "sph", "golden_ratio", "conversion_rate"
]
Dimension = Literal["date", "team", "chatter"]

# Date preset ranges for reports
DatePreset = Literal[
    "last_7_days",
    "last_30_days",
    "last_3_months",
    "last_6_months",
    "last_1_year",
]


class ReportRunRequest(BaseModel):
    metrics: List[Metric]
    dimensions: List[Dimension]
    start: Optional[date] = None
    end: Optional[date] = None
    filters: Optional[Dict[str, Any]] = None
    preset: Optional[DatePreset] = None


class ReportRow(BaseModel):
    date: Optional[date] = None
    team: Optional[str] = None
    chatter: Optional[str] = None
    values: Dict[str, float]


class SaveReportRequest(BaseModel):
    name: str
    description: Optional[str] = None
    config_json: Dict[str, Any]
    is_public: bool = False


class SavedReportOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    config_json: Dict[str, Any]
    is_public: bool

    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: int
    occurred_at: datetime
    user_id: Optional[int]
    user_email: Optional[str] = None
    action: str
    entity: str
    entity_id: Optional[str]
    before_json: Optional[Dict[str, Any]] = None
    after_json: Optional[Dict[str, Any]] = None
    ip: Optional[str] = None
    user_agent: Optional[str] = None

    class Config:
        from_attributes = True


class DashboardMetricBase(BaseModel):
    chatter_name: str
    total_sales: Optional[float] = None
    worked_hours: Optional[float] = Field(None, description="Total hours worked in the range")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    sph: Optional[float] = None
    art: Optional[str] = None
    gr: Optional[float] = None
    ur: Optional[float] = None
    ranking: Optional[int] = None
    shift: Optional[str] = None


class DashboardMetricCreate(DashboardMetricBase):
    pass


class DashboardMetricUpdate(BaseModel):
    chatter_name: Optional[str] = None
    total_sales: Optional[float] = None
    worked_hours: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    sph: Optional[float] = None
    art: Optional[str] = None
    gr: Optional[float] = None
    ur: Optional[float] = None
    ranking: Optional[int] = None
    shift: Optional[str] = None


class DashboardMetricOut(DashboardMetricBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DashboardMetricSnapshot(BaseModel):
    chatter_name: str
    total_sales: float = 0.0
    worked_hours: float = 0.0
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    sph: float = 0.0
    art: Optional[str] = None
    gr: float = 0.0
    ur: float = 0.0
    ranking: int
    shift: Optional[str] = None

    class Config:
        from_attributes = True
