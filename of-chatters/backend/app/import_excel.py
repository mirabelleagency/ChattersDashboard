import argparse
import csv
import os
from datetime import datetime, date
from typing import Optional, List

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

# New simplified template columns (Excel sheet: 'Import' or CSV headers)
# Updated: remove Ranking (auto-calculated) and add Total Sales right after Chatter
NEW_COLUMNS = [
    "Chatter",
    "Total Sales",
    "Start Date",
    "End Date",
    "Worked Hrs",
    "SPH",
    "ART",
    "GR",
    "UR",
    "Shift",
]

MAX_DUPLICATE_PREVIEW = 25


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


def upsert_performance(db: Session, chatter_id: int, team_id: Optional[int], dt: date, row: dict) -> bool:
    existing = (
        db.query(models.PerformanceDaily)
        .filter(models.PerformanceDaily.chatter_id == chatter_id, models.PerformanceDaily.shift_date == dt)
        .first()
    )
    if existing:
        return False

    p = models.PerformanceDaily(
        chatter_id=chatter_id,
        team_id=team_id,
        shift_date=dt,
        sales_amount=_to_float(row.get("Sales")),
        sold_count=_to_int(row.get("Sold")),
        retention_count=_to_int(row.get("Retention")),
        unlock_count=_to_int(row.get("Unlock")),
        total_sales=_to_float(row.get("Total")),
        sph=_to_float(row.get("SPH")),
        golden_ratio=_to_float(row.get("Golden ratio")),
        hinge_top_up=_to_float(row.get("Hinge top up")),
        tricks_tsf=_to_float(row.get("Tricks TSF")),
    )
    # parse_art_interval returns timedelta or None; acceptable for Interval column
    p.art_interval = parse_art_interval(row.get("ART"))  # type: ignore[assignment]
    db.add(p)
    return True


def upsert_shift(db: Session, chatter_id: int, team_id: Optional[int], dt: date, row: dict) -> bool:
    # Create shift if any hours provided
    scheduled = _to_float(row.get("Shift Hours (Scheduled)"))
    actual = _to_float(row.get("Shift Hours (Actual)"))
    if scheduled is None and actual is None:
        return False

    existing = (
        db.query(models.Shift)
        .filter(models.Shift.chatter_id == chatter_id, models.Shift.shift_date == dt)
        .first()
    )
    if existing:
        return False

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
    return True


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
    """Import data from file and return statistics.

    Supported formats:
    - Legacy Excel 'Sheet3' or CSV with COLUMNS
    - New Excel 'Import' sheet or CSV with NEW_COLUMNS (mm/dd/yyyy dates only)
    """
    ext = os.path.splitext(path)[1].lower()
    if ext in (".xlsx", ".xls"):
        # Detect which template is present
        wb = load_workbook(path, data_only=True)
        # Prefer new template if 'Import' sheet present and matches headers
        if 'Import' in wb.sheetnames:
            ws = wb['Import']
            headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
            if headers and all(h in headers for h in NEW_COLUMNS):
                return _import_excel_new(db, wb, ws)
        # Fallback to legacy 'Sheet3'
        return _import_excel_legacy(db, wb)
    if ext == ".csv":
        # Peek headers to decide format
        with open(path, 'r', encoding='utf-8-sig', newline='') as f:
            reader = csv.reader(f)
            headers = next(reader, None) or []
        # Normalize BOM and whitespace
        headers = [h.strip() for h in headers]
        if headers and all(h in headers for h in NEW_COLUMNS):
            return _import_csv_new(db, path)
        return _import_csv_legacy(db, path)
    raise RuntimeError("Unsupported file type. Allowed: .xlsx, .xls, .csv")


def _import_excel_legacy(db: Session, wb) -> dict:
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
    duplicate_rows: List[dict] = []

    for row in ws.iter_rows(min_row=2):
        values = {h: row[idx_map[h]].value for h in COLUMNS}
        # Normalize to expected types
        _team = values.get("Team Name")
        team_name: Optional[str] = (str(_team).strip() if _team not in (None, "") else None)
        _ch_name = values.get("Chatter name")
        chatter_name: Optional[str] = (str(_ch_name).strip() if _ch_name not in (None, "") else None)
        date_val = values.get("Date")
        if not chatter_name or not date_val:
            continue
        # Excel date may be datetime/date or string
        if isinstance(date_val, datetime):
            dt = date_val.date()
        else:
            dt = _parse_date_flexible(str(date_val))

        # Track new creations
        existing_team_count = db.query(models.Team).count()
        team_id = upsert_team(db, team_name)
        if db.query(models.Team).count() > existing_team_count:
            teams_created += 1

        existing_chatter_count = db.query(models.Chatter).count()
        chatter_id = upsert_chatter(db, chatter_name, team_id)
        if db.query(models.Chatter).count() > existing_chatter_count:
            chatters_created += 1

        perf_created = upsert_performance(db, chatter_id, team_id, dt, values)
        if perf_created:
            perf_records += 1

        scheduled_present = _to_float(values.get("Shift Hours (Scheduled)")) is not None
        actual_present = _to_float(values.get("Shift Hours (Actual)")) is not None
        shift_attempted = scheduled_present or actual_present
        shift_created = upsert_shift(db, chatter_id, team_id, dt, values) if shift_attempted else False
        if shift_created:
            shift_records += 1

        if not perf_created or (shift_attempted and not shift_created):
            reasons = []
            if not perf_created:
                reasons.append("performance already imported")
            if shift_attempted and not shift_created:
                reasons.append("shift already imported")
            duplicate_rows.append({
                "row": row[0].row if row else None,
                "chatter": chatter_name,
                "date": dt.isoformat(),
                "details": ", ".join(reasons),
            })

    db.commit()
    return {
        "teams_created": teams_created,
        "chatters_created": chatters_created,
        "performance_records": perf_records,
        "shift_records": shift_records,
        "rows_skipped": len(duplicate_rows),
        "skipped_samples": duplicate_rows[:MAX_DUPLICATE_PREVIEW],
    }


def _import_csv_legacy(db: Session, path: str) -> dict:
    """Import CSV with the same columns as COLUMNS (Sheet3 format)."""
    teams_created = 0
    chatters_created = 0
    perf_records = 0
    shift_records = 0
    duplicate_rows: List[dict] = []

    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        missing = [h for h in COLUMNS if h not in headers]
        if missing:
            raise RuntimeError(f"Missing columns: {missing}")

        for row_idx, values in enumerate(reader, start=2):
            team_name = values.get("Team Name")
            chatter_name = values.get("Chatter name")
            date_str = values.get("Date")
            if not chatter_name or not date_str:
                continue

            try:
                dt = _parse_date_flexible(date_str)
            except Exception:
                # skip rows with unparseable date
                continue

            existing_team_count = db.query(models.Team).count()
            team_id = upsert_team(db, team_name)
            if db.query(models.Team).count() > existing_team_count:
                teams_created += 1

            existing_chatter_count = db.query(models.Chatter).count()
            chatter_id = upsert_chatter(db, chatter_name, team_id)
            if db.query(models.Chatter).count() > existing_chatter_count:
                chatters_created += 1

            perf_created = upsert_performance(db, chatter_id, team_id, dt, values)
            if perf_created:
                perf_records += 1

            scheduled_present = _to_float(values.get("Shift Hours (Scheduled)")) is not None
            actual_present = _to_float(values.get("Shift Hours (Actual)")) is not None
            shift_attempted = scheduled_present or actual_present
            shift_created = upsert_shift(db, chatter_id, team_id, dt, values) if shift_attempted else False
            if shift_created:
                shift_records += 1

            if not perf_created or (shift_attempted and not shift_created):
                reasons = []
                if not perf_created:
                    reasons.append("performance already imported")
                if shift_attempted and not shift_created:
                    reasons.append("shift already imported")
                duplicate_rows.append({
                    "row": row_idx,
                    "chatter": chatter_name,
                    "date": dt.isoformat(),
                    "details": ", ".join(reasons),
                })

    db.commit()
    return {
        "teams_created": teams_created,
        "chatters_created": chatters_created,
        "performance_records": perf_records,
        "shift_records": shift_records,
        "rows_skipped": len(duplicate_rows),
        "skipped_samples": duplicate_rows[:MAX_DUPLICATE_PREVIEW],
    }


def _import_excel_new(db: Session, wb, ws) -> dict:
    # Validate headers
    headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    idx_map = {h: i for i, h in enumerate(headers)}
    missing = [h for h in NEW_COLUMNS if h not in idx_map]
    if missing:
        raise RuntimeError(f"Missing columns: {missing}")

    chatters_created = 0
    perf_records = 0
    shift_records = 0
    duplicate_rows: List[dict] = []

    for row in ws.iter_rows(min_row=2):
        val = {h: row[idx_map[h]].value for h in NEW_COLUMNS}
        chatter_name = (str(val.get('Chatter')).strip() if val.get('Chatter') not in (None, '') else None)
        start_date = val.get('Start Date')
        total_sales = _to_float(val.get('Total Sales'))
        worked_hrs = _to_float(val.get('Worked Hrs')) or 0.0
        sph = _to_float(val.get('SPH')) or 0.0
        art = val.get('ART')
        gr = _to_float(val.get('GR'))
        ur = _to_float(val.get('UR'))

        if not chatter_name or not start_date:
            continue

        # Enforce mm/dd/yyyy only
        if isinstance(start_date, (datetime, date)):
            dt = start_date if isinstance(start_date, date) else start_date.date()
        else:
            dt = _parse_mmddyyyy_only(str(start_date))

        existing_chatter_count = db.query(models.Chatter).count()
        chatter_id = upsert_chatter(db, chatter_name, None)
        if db.query(models.Chatter).count() > existing_chatter_count:
            chatters_created += 1

        # Build legacy-like row mapping for reuse
        sales_amount = total_sales if total_sales is not None else (
            (worked_hrs * sph) if (worked_hrs is not None and sph is not None) else None
        )
        values = {
            "Sales": sales_amount,
            "Sold": None,
            "Retention": None,
            "Unlock": ur,  # treat UR as unlock rate; stored in unlock_count (best-effort)
            "Total": sales_amount,
            "SPH": sph,
            "ART": art,
            "Golden ratio": gr,
            "Hinge top up": None,
            "Tricks TSF": None,
            "Day": None,
            "Shift Hours (Actual)": worked_hrs,
            "Shift Hours (Scheduled)": None,
            "Remarks/ Note": None,
        }

        perf_created = upsert_performance(db, chatter_id, None, dt, values)
        if perf_created:
            perf_records += 1

        shift_attempted = worked_hrs is not None
        shift_created = upsert_shift(db, chatter_id, None, dt, values) if shift_attempted else False
        if shift_created:
            shift_records += 1

        if not perf_created or (shift_attempted and not shift_created):
            duplicate_rows.append({
                "row": row[0].row if row else None,
                "chatter": chatter_name,
                "date": dt.isoformat(),
                "details": ", ".join(filter(None, [
                    None if perf_created else "performance already imported",
                    None if (not shift_attempted or shift_created) else "shift already imported",
                ])),
            })

    db.commit()
    return {
        "teams_created": 0,
        "chatters_created": chatters_created,
        "performance_records": perf_records,
        "shift_records": shift_records,
        "rows_skipped": len(duplicate_rows),
        "skipped_samples": duplicate_rows[:MAX_DUPLICATE_PREVIEW],
    }


def _import_csv_new(db: Session, path: str) -> dict:
    chatters_created = 0
    perf_records = 0
    shift_records = 0
    duplicate_rows: List[dict] = []

    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        missing = [h for h in NEW_COLUMNS if h not in headers]
        if missing:
            raise RuntimeError(f"Missing columns: {missing}")

        for row_idx, val in enumerate(reader, start=2):
            chatter_name = (val.get('Chatter') or '').strip() or None
            start_date = val.get('Start Date')
            total_sales = _to_float(val.get('Total Sales'))
            worked_hrs = _to_float(val.get('Worked Hrs')) or 0.0
            sph = _to_float(val.get('SPH')) or 0.0
            art = val.get('ART')
            gr = _to_float(val.get('GR'))
            ur = _to_float(val.get('UR'))
            if not chatter_name or not start_date:
                continue

            try:
                dt = _parse_mmddyyyy_only(str(start_date))
            except Exception:
                # skip rows with unparseable date (strict mm/dd/yyyy)
                continue

            existing_chatter_count = db.query(models.Chatter).count()
            chatter_id = upsert_chatter(db, chatter_name, None)
            if db.query(models.Chatter).count() > existing_chatter_count:
                chatters_created += 1

            sales_amount = total_sales if total_sales is not None else (
                (worked_hrs * sph) if (worked_hrs is not None and sph is not None) else None
            )
            values = {
                "Sales": sales_amount,
                "Sold": None,
                "Retention": None,
                "Unlock": ur,
                "Total": sales_amount,
                "SPH": sph,
                "ART": art,
                "Golden ratio": gr,
                "Hinge top up": None,
                "Tricks TSF": None,
                "Day": None,
                "Shift Hours (Actual)": worked_hrs,
                "Shift Hours (Scheduled)": None,
                "Remarks/ Note": None,
            }

            perf_created = upsert_performance(db, chatter_id, None, dt, values)
            if perf_created:
                perf_records += 1

            shift_attempted = worked_hrs is not None
            shift_created = upsert_shift(db, chatter_id, None, dt, values) if shift_attempted else False
            if shift_created:
                shift_records += 1

            if not perf_created or (shift_attempted and not shift_created):
                duplicate_rows.append({
                    "row": row_idx,
                    "chatter": chatter_name,
                    "date": dt.isoformat(),
                    "details": ", ".join(filter(None, [
                        None if perf_created else "performance already imported",
                        None if (not shift_attempted or shift_created) else "shift already imported",
                    ])),
                })

    db.commit()
    return {
        "teams_created": 0,
        "chatters_created": chatters_created,
        "performance_records": perf_records,
        "shift_records": shift_records,
        "rows_skipped": len(duplicate_rows),
        "skipped_samples": duplicate_rows[:MAX_DUPLICATE_PREVIEW],
    }


def _parse_date_flexible(value: str) -> date:
    """Parse date from common formats into date object."""
    # Try ISO first
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except Exception:
            pass
    # Fallback: try to parse as datetime then date
    try:
        return datetime.fromisoformat(value.strip()).date()
    except Exception:
        pass
    raise ValueError(f"Unrecognized date format: {value}")


def _parse_mmddyyyy_only(value: str) -> date:
    """Parse date strictly in mm/dd/yyyy format."""
    return datetime.strptime(value.strip(), "%m/%d/%Y").date()


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
