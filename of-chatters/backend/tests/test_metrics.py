from app.services.metrics import compute_sph, compute_conversion_rate, compute_unlock_ratio, parse_art_interval
from datetime import timedelta

def test_compute_sph():
    assert compute_sph(100, 2) == 50
    assert compute_sph(0, 2) == 0
    assert compute_sph(100, 0) is None


def test_compute_conversion_rate():
    assert compute_conversion_rate(10, 5, 5) == 0.5
    assert compute_conversion_rate(0, 0, 0) is None


def test_compute_unlock_ratio():
    assert compute_unlock_ratio(5, 10) == 0.5
    assert compute_unlock_ratio(5, 0) is None


def test_parse_art_interval():
    assert parse_art_interval("3m 42s") == timedelta(minutes=3, seconds=42)
    assert parse_art_interval("58s") == timedelta(seconds=58)
