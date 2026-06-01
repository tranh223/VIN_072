"""Tests for docs/compliance_score_spec_v1.md"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.compliance_score import (  # noqa: E402
    compliance_ui_band,
    compute_compliance_score,
)


def test_case1_beautiful_profile_score_100():
    r = compute_compliance_score(
        missing_required_fields=0,
        vlm_needs_confirmation=False,
        discrepancy_ratio=0.005,
        annualized_revenue=320_000_000,
        correction_count_last_30d=0,
        days_since_last_upload=3,
    )
    assert r["score"] == 100
    assert r["penalties"]["total"] == 0
    assert compliance_ui_band(r["score"]) == "OK"


def test_csv_only_missing_invoice_score_80():
    """Có CSV, không có PDF/ảnh hóa đơn → trừ 20 điểm chứng từ → 80 (WARNING)."""
    r = compute_compliance_score(
        missing_required_fields=0,
        vlm_needs_confirmation=False,
        discrepancy_ratio=0.0,
        annualized_revenue=50_000_000,
        correction_count_last_30d=0,
        days_since_last_upload=0,
        missing_supporting_evidence=True,
    )
    assert r["score"] == 80
    assert r["penalties"]["evidence"] == 20
    assert compliance_ui_band(r["score"]) == "WARNING"


def test_case2_medium_profile_score_59():
    """Penalties: VLM 15 + recon(4%) 20 + correction 3 + freshness(>7d) 3 = 41 → score 59."""
    r = compute_compliance_score(
        missing_required_fields=0,
        vlm_needs_confirmation=True,
        discrepancy_ratio=0.04,
        annualized_revenue=450_000_000,
        correction_count_last_30d=1,
        days_since_last_upload=10,
    )
    assert r["score"] == 59
    assert compliance_ui_band(r["score"]) == "BLOCK"
