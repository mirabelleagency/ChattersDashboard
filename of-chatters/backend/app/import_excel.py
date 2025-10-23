import argparse
from datetime import datetime
from typing import Optional

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from .db import SessionLocal
from . import models
from .services.metrics import parse_art_interval


COLUMNS = [
    "Team Name",
    "Chatter name",
    "Shift Hours (Scheduled)",
    "Shift Hours (Actual)",
    "Date",
    "Day",
    "Sales",
    "Sold",
    "Retention",
    "Unlock",
    "Total",
    "SPH",
    "ART",
    "Golden ratio",
    "Hinge top up",
    "Tricks TSF",
    "Remarks/ Note",
]


def upsert_team(db: Session, name: Optional[str]) -> Optional[int]:
    if not name:
        return None
    t = db.query(models.Team).filter(models.Team.name == name).first()
    if not t:
        t = models.Team(name=name)
        db.add(t)
        db.flush()
    return t.id


def upsert_chatter(db: Session, name: str, team_id: Optional[int]) -> int:
    c = db.query(models.Chatter).filter(models.Chatter.name == name).first()
    if not c:
        c = models.Chatter(name=name, team_id=team_id, is_active=True)
        db.add(c)
        db.flush()
    else:
        if team_id and c.team_id != team_id:
            c.team_id = team_id
    return c.id


def upsert_performance(db: Session, chatter_id: int, team_id: Optional[int], dt: datetime.date, row: dict):
    p = (
        db.query(models.PerformanceDaily)
        .filter(models.PerformanceDaily.chatter_id == chatter_id, models.PerformanceDaily.shift_date == dt)
        .first()
    )
    if not p:
        p = models.PerformanceDaily(chatter_id=chatter_id, shift_date=dt)
        db.add(p)
    p.team_id = team_id
    p.sales_amount = _to_float(row.get("Sales"))
    p.sold_count = _to_int(row.get("Sold"))
    p.retention_count = _to_int(row.get("Retention"))
    p.unlock_count = _to_int(row.get("Unlock"))
    p.total_sales = _to_float(row.get("Total"))
    p.sph = _to_float(row.get("SPH"))
    p.art_interval = parse_art_interval(row.get("ART"))
    p.golden_ratio = _to_float(row.get("Golden ratio"))
    p.hinge_top_up = _to_float(row.get("Hinge top up"))
    p.tricks_tsf = _to_float(row.get("Tricks TSF"))


def upsert_shift(db: Session, chatter_id: int, team_id: Optional[int], dt: datetime.date, row: dict):
    # Create shift if any hours provided
    scheduled = _to_float(row.get("Shift Hours (Scheduled)"))
    actual = _to_float(row.get("Shift Hours (Actual)"))
    if scheduled is None and actual is None:
        return
    sh = models.Shift(
        chatter_id=chatter_id,
        team_id=team_id,
        shift_date=dt,
        shift_day=row.get("Day") or None,
        scheduled_hours=scheduled,
        actual_hours=actual,
        remarks=row.get("Remarks/ Note") or None,
    )
    db.add(sh)


def _to_float(v):
    try:
        if v is None or v == "":
            return None
        return float(v)
    except Exception:
        return None


def _to_int(v):
    try:
        if v is None or v == "":
            return None
        return int(v)
    except Exception:
        return None


def import_from_file(db: Session, path: str) -> dict:
    """Import Excel file and return statistics"""
    wb = load_workbook(path, data_only=True)
    if 'Sheet3' not in wb.sheetnames:
        raise RuntimeError("Sheet3 not found")
    ws = wb['Sheet3']

    # header
    headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    idx_map = {h: i for i, h in enumerate(headers)}

    missing = [h for h in COLUMNS if h not in idx_map]
    if missing:
        raise RuntimeError(f"Missing columns: {missing}")

    teams_created = 0
    chatters_created = 0
    perf_records = 0
    shift_records = 0

    for row in ws.iter_rows(min_row=2):
        values = {h: row[idx_map[h]].value for h in COLUMNS}
        team_name = values.get("Team Name")
        chatter_name = values.get("Chatter name")
        date_val = values.get("Date")
        if not chatter_name or not date_val:
            continue
        # Excel date may be datetime/date or string
        if isinstance(date_val, datetime):
            dt = date_val.date()
        else:
            dt = datetime.strptime(str(date_val), "%Y-%m-%d").date()

        # Track new creations
        existing_team_count = db.query(models.Team).count()
        team_id = upsert_team(db, team_name)
        if db.query(models.Team).count() > existing_team_count:
            teams_created += 1

        existing_chatter_count = db.query(models.Chatter).count()
        chatter_id = upsert_chatter(db, chatter_name, team_id)
        if db.query(models.Chatter).count() > existing_chatter_count:
            chatters_created += 1

        upsert_performance(db, chatter_id, team_id, dt, values)
        perf_records += 1
        upsert_shift(db, chatter_id, team_id, dt, values)
        shift_records += 1

    db.commit()
    return {
        "teams_created": teams_created,
        "chatters_created": chatters_created,
        "performance_records": perf_records,
        "shift_records": shift_records
    }


def main(path: str):
    db = SessionLocal()
    try:
        stats = import_from_file(db, path)
        print(f"Import complete: {stats}")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Excel Sheet3 for of-chatters")
    parser.add_argument("--path", required=True, help="Path to Excel file")
    args = parser.parse_args()
    main(args.path)
