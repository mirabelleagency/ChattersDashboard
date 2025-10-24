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
