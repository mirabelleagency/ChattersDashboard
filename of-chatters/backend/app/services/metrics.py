from __future__ import annotations
import re
from datetime import timedelta
from typing import Optional


def safe_div(n: Optional[float], d: Optional[float]) -> Optional[float]:
    if n is None or d is None:
        return None
    if d == 0:
        return None
    return float(n) / float(d)


def compute_sph(sales_amount: Optional[float], actual_hours: Optional[float]) -> Optional[float]:
    return safe_div(sales_amount, actual_hours)


def compute_conversion_rate(sold_count: Optional[int], retention_count: Optional[int], unlock_count: Optional[int]) -> Optional[float]:
    if sold_count is None and retention_count is None and unlock_count is None:
        return None
    denom = (sold_count or 0) + (retention_count or 0) + (unlock_count or 0)
    return safe_div(sold_count or 0, denom)


def compute_unlock_ratio(unlock_count: Optional[int], sold_count: Optional[int]) -> Optional[float]:
    return safe_div(unlock_count or 0, (sold_count or 0))


ART_REGEX = re.compile(r"(?:(\d+)\s*m)?\s*(\d+)\s*s", re.IGNORECASE)


def parse_art_interval(text: Optional[str]) -> Optional[timedelta]:
    if not text:
        return None
    s = str(text).strip()
    m = ART_REGEX.search(s)
    if not m:
        return None
    minutes = int(m.group(1) or 0)
    seconds = int(m.group(2) or 0)
    return timedelta(minutes=minutes, seconds=seconds)
