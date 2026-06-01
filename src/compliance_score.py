"""
Compliance Score — theo docs/compliance_score_spec_v1.md
Điểm 0–100, tách biệt alerts_count / risk_level của tax preview.
"""

from __future__ import annotations

from typing import Any


def compliance_ui_band(score: int) -> str:
    """85–100 OK, 70–84 WARNING, 0–69 BLOCK (spec §5)."""
    if score >= 85:
        return "OK"
    if score >= 70:
        return "WARNING"
    return "BLOCK"


def compliance_score_label_vi(band: str) -> str:
    if band == "OK":
        return "Ổn định"
    if band == "WARNING":
        return "Cần theo dõi"
    return "Cần xử lý"


def compute_compliance_score(
    *,
    missing_required_fields: int,
    vlm_needs_confirmation: bool,
    discrepancy_ratio: float,
    annualized_revenue: float,
    correction_count_last_30d: int,
    days_since_last_upload: int,
    missing_supporting_evidence: bool = False,
) -> dict[str, Any]:
    """
    Trả về score, band UI, và chi tiết penalty (spec §2–§4, pseudocode §7).

    missing_supporting_evidence: có CSV/doanh thu nhưng chưa có ảnh/PDF chứng từ đối soát.
    """
    data_penalty = 0
    if missing_required_fields >= 2:
        data_penalty += 20
    elif missing_required_fields == 1:
        data_penalty += 10
    if vlm_needs_confirmation:
        data_penalty += 15

    evidence_penalty = 20 if missing_supporting_evidence else 0

    dr = float(discrepancy_ratio)
    if dr <= 0.01:
        recon_penalty = 0
    elif dr <= 0.03:
        recon_penalty = 10
    elif dr <= 0.05:
        recon_penalty = 20
    else:
        recon_penalty = 30

    ar = float(annualized_revenue)
    if ar >= 1_000_000_000:
        threshold_penalty = 20
    elif ar >= 800_000_000:
        threshold_penalty = 10
    else:
        threshold_penalty = 0

    correction_penalty = min(10, 3 * max(0, int(correction_count_last_30d)))

    d = max(0, int(days_since_last_upload))
    if d > 30:
        freshness_penalty = 10
    elif d > 14:
        freshness_penalty = 6
    elif d > 7:
        freshness_penalty = 3
    else:
        freshness_penalty = 0

    total_penalty = (
        data_penalty
        + evidence_penalty
        + recon_penalty
        + threshold_penalty
        + correction_penalty
        + freshness_penalty
    )
    score = max(0, min(100, 100 - total_penalty))
    band = compliance_ui_band(score)

    return {
        "score": score,
        "band": band,
        "label_vi": compliance_score_label_vi(band),
        "penalties": {
            "data": data_penalty,
            "evidence": evidence_penalty,
            "reconciliation": recon_penalty,
            "threshold": threshold_penalty,
            "correction": correction_penalty,
            "freshness": freshness_penalty,
            "total": total_penalty,
        },
        "inputs": {
            "missing_required_fields": int(missing_required_fields),
            "vlm_needs_confirmation": bool(vlm_needs_confirmation),
            "missing_supporting_evidence": bool(missing_supporting_evidence),
            "discrepancy_ratio": round(dr, 6),
            "annualized_revenue": ar,
            "correction_count_last_30d": int(correction_count_last_30d),
            "days_since_last_upload": d,
        },
    }
