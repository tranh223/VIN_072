"""
Tax Agent — Ước tính GTGT + TNCN cho hộ kinh doanh TMĐT (tham khảo, không thay kê khai).

Scope “non-payment”: không có luồng thanh toán trên nền tảng; CSV là doanh thu tự ghi chép;
đối soát với chứng từ / OCR chỉ để so khớp và cảnh báo.

Input : AgentState.worker_results (csv_extractor + image_ocr)
Output: AgentState.tax_result (tax_result + validation + alerts + dashboard)

Quy ước nội bộ (giữ key cũ cho DB / correction / UI):
  - `revenue_raw` trong bucket = tổng doanh thu lấy từ cột CSV `revenue` (và tương đương),
    không còn tách phí sàn / hoàn trả trong schema CSV mặc định.
  - `platform_fees` / `refunds` trên bucket luôn 0 — chỉ còn trong cấu trúc để tương thích.
  - Không offset “thuế đã khấu trừ” qua cổng thanh toán; chứng cứ chỉ dùng đối soát.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from langgraph.graph import END

from ..agentState import AgentState
from ..compliance_score import compute_compliance_score

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# 1. Bảng thuế suất theo nhóm ngành (tax.md §3)
# ══════════════════════════════════════════════════════════════════════════════

_INDUSTRY_RATES: dict[str, dict] = {
    "goods": {
        "gtgt_rate": 0.01,
        "tncn_rate": 0.005,
        "label": "Phân phối / cung cấp hàng hóa",
    },
    "services": {
        "gtgt_rate": 0.05,
        "tncn_rate": 0.02,
        "label": "Dịch vụ (không bao thầu nguyên vật liệu)",
    },
    "manufacturing": {
        "gtgt_rate": 0.03,
        "tncn_rate": 0.015,
        "label": "Sản xuất / dịch vụ gắn hàng hóa / xây dựng có bao thầu NVL",
    },
    "transport": {
        "gtgt_rate": 0.03,
        "tncn_rate": 0.015,
        "label": "Vận tải",
    },
    "other": {
        "gtgt_rate": 0.02,
        "tncn_rate": 0.01,
        "label": "Hoạt động kinh doanh khác",
    },
}

# Chuẩn hoá tên ngành về internal key
_INDUSTRY_ALIASES: dict[str, str] = {
    "goods":          "goods",
    "hang_hoa":       "goods",
    "hanghoa":        "goods",
    "distribution":   "goods",
    "retail":         "goods",
    "services":       "services",
    "dich_vu":        "services",
    "dichvu":         "services",
    "service":        "services",
    "manufacturing":  "manufacturing",
    "san_xuat":       "manufacturing",
    "sanxuat":        "manufacturing",
    "transport":      "transport",
    "van_tai":        "transport",
    "vantai":         "transport",
}

# Ngưỡng doanh thu năm 1 tỷ VND (theo Nghị định 1-41/2026, hiệu lực 01/01/2026)
_THRESHOLD_ANNUAL: int = 1_000_000_000

# Tỷ lệ cảnh báo (% của ngưỡng)
_PCT_APPROACHING: float = 80.0   # CONFIRM: >= 80% ngưỡng


# ══════════════════════════════════════════════════════════════════════════════
# 2. Helpers
# ══════════════════════════════════════════════════════════════════════════════

def _safe_float(v: Any, default: float = 0.0) -> float:
    try:
        if v is None or str(v).strip() in ("", "N/A", "n/a"):
            return default
        return float(str(v).replace(",", "").replace(".", "").strip()
                     if str(v).count(".") > 1
                     else str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def _r2(v: float) -> float:
    return round(v, 2)


def _normalize_industry(raw: Any) -> str:
    if not raw:
        return "other"
    key = str(raw).lower().strip().replace(" ", "_")
    return _INDUSTRY_ALIASES.get(key, "other")


def _parse_period_months(period_str: Optional[str]) -> int:
    """
    Chuyển chuỗi period thành số tháng:
      "2026-04"  → 1   "2026-Q1"  → 3   "2026"     → 12   None       → 1
    """
    if not period_str:
        return 1
    s = str(period_str).strip()
    if len(s) == 7 and s[4] == "-" and s[5:].isdigit():
        return 1
    if "Q" in s.upper() or "q" in s:
        return 3
    if len(s) == 4 and s.isdigit():
        return 12
    return 1


def _is_missing_meta(value: Any) -> bool:
    s = str(value or "").strip()
    return s in ("", "N/A", "n/a", "None")


_MISSING_SELLER = "__MISSING_SELLER__"
_MISSING_PERIOD = "__MISSING_PERIOD__"


def _records_from_csv_workers(state: AgentState) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for result in (state.get("worker_results") or []):
        if not isinstance(result, dict) or result.get("source") != "csv_extractor":
            continue
        data = result.get("data") or {}
        for rec in data.get("records") or []:
            if isinstance(rec, dict):
                rows.append(rec)
    return rows


def _row_numeric(rec: dict[str, Any], field: str) -> float:
    v = rec.get(field)
    if _is_missing_meta(v):
        return 0.0
    return _safe_float(v, 0.0)


def _aggregate_csv_buckets(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Gộp theo (seller_id, period).

    Mỗi bucket[`revenue_raw`] = tổng cột `revenue` trên các dòng (tên field lịch sử `revenue_raw`).
    """
    acc: dict[tuple[str, str], dict[str, Any]] = {}
    for rec in records:
        sid_raw = str(rec.get("seller_id") or "").strip()
        per_raw = str(rec.get("period") or "").strip()
        key = (
            sid_raw if not _is_missing_meta(sid_raw) else _MISSING_SELLER,
            per_raw if not _is_missing_meta(per_raw) else _MISSING_PERIOD,
        )
        if key not in acc:
            acc[key] = {
                "seller_id": "N/A" if key[0] == _MISSING_SELLER else key[0],
                "period": "N/A" if key[1] == _MISSING_PERIOD else key[1],
                "industry": "other",
                "industry_explicit": False,
                "platform_name": "N/A",
                "revenue_raw": 0.0,
                "platform_fees": 0.0,
                "refunds": 0.0,
                "row_count": 0,
            }
        b = acc[key]
        # CSV chuẩn: cột `revenue`; chuỗi gộp lưu dưới bucket["revenue_raw"] (alias lịch sử).
        b["revenue_raw"] += _row_numeric(rec, "revenue")
        b["row_count"] += 1
        ind = rec.get("industry")
        if not _is_missing_meta(ind):
            b["industry"] = str(ind).strip()
            b["industry_explicit"] = True
        pn = rec.get("platform_name")
        pl = rec.get("platform")
        if not _is_missing_meta(pn) and b.get("platform_name") == "N/A":
            b["platform_name"] = str(pn).strip()
        elif not _is_missing_meta(pl) and b.get("platform_name") == "N/A":
            b["platform_name"] = str(pl).strip()
    return list(acc.values())


def _primary_bucket(buckets: list[dict[str, Any]]) -> dict[str, Any]:
    return max(buckets, key=lambda b: float(b.get("revenue_raw") or 0.0))


def aggregate_csv_inputs_for_correction(csv_data: dict[str, Any]) -> dict[str, Any]:
    """
    Cùng logic bucket như TaxAgent, dùng cho POST /correction (đọc từ session csv_result.data).
    Schema mới: chỉ có revenue.
    """
    records = csv_data.get("records") if isinstance(csv_data.get("records"), list) else []
    empty: dict[str, Any] = {
        "seller_id": "N/A",
        "period": "N/A",
        "industry": "other",
        "industry_explicit": False,
        "platform_name": "N/A",
        "revenue_raw": 0.0,
        "platform_fees": 0.0,
        "refunds": 0.0,
        "tax_withheld_gtgt": 0.0,
        "tax_withheld_tncn": 0.0,
        "row_count": 0,
        "found": False,
        "bucket_count": 0,
        "buckets": [],
    }
    if not records:
        summary = csv_data.get("summary") if isinstance(csv_data.get("summary"), dict) else {}

        def _sum(field: str) -> float:
            entry = summary.get(field)
            if isinstance(entry, dict):
                return _safe_float(entry.get("sum"), 0.0)
            return _safe_float(entry, 0.0)

        revenue_from_summary = _sum("revenue_raw") + _sum("revenue")

        return {
            "seller_id": "N/A",
            "period": "N/A",
            "industry": "other",
            "industry_explicit": False,
            "platform_name": "N/A",
            "revenue_raw": revenue_from_summary,
            "platform_fees": 0.0,
            "refunds": 0.0,
            "tax_withheld_gtgt": 0.0,
            "tax_withheld_tncn": 0.0,
            "row_count": int(csv_data.get("row_count") or 0),
            "found": True,
            "bucket_count": 1,
            "buckets": [],
        }

    buckets = _aggregate_csv_buckets([r for r in records if isinstance(r, dict)])
    primary = _primary_bucket(buckets)
    primary = {**primary, "found": True, "bucket_count": len(buckets), "buckets": buckets,
               "tax_withheld_gtgt": 0.0, "tax_withheld_tncn": 0.0}
    return primary


# ══════════════════════════════════════════════════════════════════════════════
# 3. Trích xuất dữ liệu từ AgentState
# ══════════════════════════════════════════════════════════════════════════════

def _extract_csv_inputs(state: AgentState) -> dict[str, Any]:
    """
    Gộp mọi khối csv_extractor; aggregate theo (seller_id, period).
    Bucket chính = bucket có tổng doanh thu CSV (`revenue_raw`) lớn nhất.
    """
    records = _records_from_csv_workers(state)
    empty: dict[str, Any] = {
        "seller_id": "N/A",
        "period": "N/A",
        "industry": "other",
        "industry_explicit": False,
        "platform_name": "N/A",
        "revenue_raw": 0.0,
        "platform_fees": 0.0,
        "refunds": 0.0,
        "tax_withheld_gtgt": 0.0,
        "tax_withheld_tncn": 0.0,
        "row_count": 0,
        "found": False,
        "bucket_count": 0,
        "buckets": [],
    }
    if not records:
        return empty

    buckets = _aggregate_csv_buckets(records)
    if not buckets:
        return empty

    primary = _primary_bucket(buckets)
    out = {
        **primary,
        "found": True,
        "bucket_count": len(buckets),
        "buckets": buckets,
        "tax_withheld_gtgt": 0.0,
        "tax_withheld_tncn": 0.0,
    }
    return out


def _extract_ocr_inputs(state: AgentState) -> dict[str, Any]:
    """
    Đọc worker image_ocr đầu tiên (chứng từ / ảnh) để đối soát với CSV.
    """
    out: dict[str, Any] = {
        "revenue_extracted": 0.0,
        "total_amount": 0.0,
        "document_category": "N/A",
        "confidence": {},
        "document_no": "N/A",
        "issue_date": "N/A",
        "document_type": "N/A",
        "seller_tax_code": "N/A",
        "seller_name": "N/A",
        "found": False,
    }

    for result in (state.get("worker_results") or []):
        if not isinstance(result, dict) or result.get("source") != "image_ocr":
            continue
        data = result.get("data", {})
        out["revenue_extracted"] = _safe_float(
            data.get("revenue") or data.get("amount"), 0.0
        )
        out["total_amount"] = _safe_float(data.get("amount"), 0.0)
        out["document_category"] = data.get("document_category", "N/A")
        out["confidence"] = data.get("confidence") if isinstance(data.get("confidence"), dict) else {}
        out["document_no"] = data.get("order_id") or data.get("document_no", "N/A")
        out["issue_date"] = data.get("transaction_date") or data.get("issue_date", "N/A")
        out["document_type"] = data.get("document_category") or data.get("document_type", "N/A")
        out["seller_tax_code"] = data.get("seller_tax_code") or "N/A"
        out["seller_name"] = data.get("seller_name") or "N/A"
        out["found"] = True
        break

    return out


def _vlm_needs_confirmation(ocr: dict[str, Any]) -> bool:
    if not ocr.get("found"):
        return False
    conf = ocr.get("confidence") or {}
    if not isinstance(conf, dict):
        return False
    for key in ("total_amount", "revenue", "amount"):
        c = conf.get(key)
        if c is None:
            continue
        try:
            cv = float(c)
        except (TypeError, ValueError):
            continue
        if 0.0 <= cv < 0.8:
            return True
    return False


def _count_missing_required_fields(csv_inputs: dict[str, Any], ocr_inputs: dict[str, Any]) -> int:
    """Theo spec compliance_score_spec_v1 §3.1 (CSV + VLM khi có OCR)."""
    n = 0
    if _is_missing_meta(csv_inputs.get("seller_id")):
        n += 1
    if _is_missing_meta(csv_inputs.get("period")):
        n += 1
    if not csv_inputs.get("industry_explicit", True):
        n += 1
    if _safe_float(csv_inputs.get("revenue_raw"), 0.0) <= 0:
        n += 1
    if ocr_inputs.get("found"):
        if _is_missing_meta(ocr_inputs.get("document_type")):
            n += 1
        if _safe_float(ocr_inputs.get("revenue_extracted"), 0.0) <= 0:
            n += 1
    return n


def _missing_supporting_evidence(csv_inputs: dict[str, Any], ocr_inputs: dict[str, Any]) -> bool:
    """Có doanh thu CSV nhưng chưa có chứng từ ảnh/PDF để đối soát."""
    if ocr_inputs.get("found"):
        return False
    return _safe_float(csv_inputs.get("revenue_raw"), 0.0) > 0


def _reconciliation_discrepancy_ratio(csv_inputs: dict[str, Any], ocr_inputs: dict[str, Any], net_revenue: float) -> float:
    csv_amt = _safe_float(csv_inputs.get("revenue_raw"), 0.0)
    vlm_amt = _safe_float(ocr_inputs.get("revenue_extracted"), 0.0)
    if not ocr_inputs.get("found") or csv_amt <= 0 or vlm_amt <= 0:
        return 0.0
    abs_delta = abs(csv_amt - vlm_amt)
    denom = max(float(net_revenue), 1.0)
    return abs_delta / denom


def _build_explain_tax(
    state: AgentState,
    csv_inputs: dict,
    ocr_inputs: dict,
    tax: dict,
) -> list[dict[str, Any]]:
    """
    Sinh giải thích cho các trường hợp cần hành động.
    Scope mới: chỉ còn ABOVE_THRESHOLD, CSV_VLM_MISMATCH, LOW_CONFIDENCE.
    Bỏ WITHHELD_DOC_SYSTEM_MISMATCH, HAS_WITHHELD_TAX (không còn offset).
    """
    explain_items: list[dict[str, Any]] = []

    annualized = tax.get("annualized_revenue", 0.0)
    threshold = tax.get("threshold_annual", _THRESHOLD_ANNUAL)

    # ── [1] Vượt ngưỡng 1 tỷ ─────────────────────────────────────────────────
    if tax.get("is_above_threshold"):
        explain_items.append({
            "case": "ABOVE_THRESHOLD",
            "conclusion": "Doanh thu quy đổi năm đã chạm hoặc vượt ngưỡng chịu thuế.",
            "reason": (
                f"Doanh thu quy đổi năm hiện khoảng {annualized:,.0f} VND, "
                f"đã đạt hoặc vượt mức tham chiếu {threshold:,.0f} VND "
                "(ngưỡng tham chiếu quy định — cần kiểm tra nghĩa vụ thuế thực tế khi kê khai)."
            ),
            "data_used": {
                "revenue_raw": csv_inputs.get("revenue_raw", 0.0),
                "net_revenue": tax.get("net_revenue", 0.0),
                "period": csv_inputs.get("period", "N/A"),
                "annualized_revenue": annualized,
                "threshold_annual": threshold,
            },
            "recommended_action": (
                "Kiểm tra lại doanh thu và kỳ dữ liệu; "
                "nếu có sai khác thì cập nhật rồi bấm Tính lại."
            ),
        })

    # ── [2] CSV và OCR lệch dữ liệu ──────────────────────────────────────────
    csv_revenue = _safe_float(csv_inputs.get("revenue_raw"), 0.0)
    vlm_revenue = _safe_float(ocr_inputs.get("revenue_extracted"), 0.0)
    if csv_revenue > 0 and vlm_revenue > 0:
        diff = abs(csv_revenue - vlm_revenue)
        diff_ratio = diff / max(csv_revenue, 1.0)
        if diff >= 5_000_000 or diff_ratio >= 0.05:
            explain_items.append({
                "case": "CSV_VLM_MISMATCH",
                "conclusion": "Doanh thu từ CSV và doanh thu từ chứng từ giao dịch đang lệch nhau.",
                "reason": (
                    f"Chênh {diff:,.0f} VND ({diff_ratio*100:.1f}%) giữa doanh thu CSV "
                    "và doanh thu trích xuất từ chứng từ."
                ),
                "data_used": {
                    "csv_gross_revenue": csv_revenue,
                    "csv_revenue_raw": csv_revenue,
                    "vlm_revenue_extracted": vlm_revenue,
                    "difference": diff,
                    "difference_ratio_pct": round(diff_ratio * 100, 2),
                },
                "recommended_action": (
                    "Đối chiếu doanh thu khai báo với chứng từ giao dịch; "
                    "chỉnh sửa nếu lệch rồi Tính lại."
                ),
            })

    # ── [3] Confidence thấp (nếu OCR có trả confidence) ──────────────────────
    conf = ocr_inputs.get("confidence") or {}
    total_amount_conf = _safe_float(conf.get("amount"), -1.0) if isinstance(conf, dict) else -1.0
    if total_amount_conf < 0:
        total_amount_conf = _safe_float(conf.get("total_amount"), -1.0) if isinstance(conf, dict) else -1.0
    if 0.0 <= total_amount_conf < 0.8:
        explain_items.append({
            "case": "LOW_EXTRACTION_CONFIDENCE",
            "conclusion": "VLM đã trích xuất được dữ liệu nhưng độ tin cậy còn thấp.",
            "reason": (
                f"confidence={total_amount_conf:.2f} < 0.80 nên cần user xác nhận "
                "trước khi chốt kết quả."
            ),
            "data_used": {
                "confidence": total_amount_conf,
                "ocr_document_no": ocr_inputs.get("document_no", "N/A"),
                "ocr_issue_date": ocr_inputs.get("issue_date", "N/A"),
            },
            "recommended_action": (
                "Xác nhận hoặc sửa doanh thu trên chứng từ rồi Tính lại."
            ),
        })

    # ── [4] User đã sửa dữ liệu ──────────────────────────────────────────────
    changed_fields = state.get("changed_fields") or state.get("corrected_fields") or []
    if isinstance(changed_fields, list) and changed_fields:
        explain_items.append({
            "case": "USER_RECALC_AFTER_EDIT",
            "conclusion": "Hệ thống đã ghi nhận dữ liệu vừa sửa và cập nhật kết quả thuế.",
            "reason": "Các field gốc đã thay đổi, vì vậy tax preview và cảnh báo được tính lại.",
            "data_used": {
                "changed_fields": changed_fields,
                "new_total_tax_due": tax.get("total_tax_due", 0.0),
            },
            "recommended_action": (
                "So sánh warning còn lại với trước khi sửa; nếu vẫn còn cảnh báo, "
                "tiếp tục chỉnh tại field gốc liên quan."
            ),
        })

    return explain_items


# ══════════════════════════════════════════════════════════════════════════════
# 4. Core tax calculation (scope non-payment)
# ══════════════════════════════════════════════════════════════════════════════

def calculate_tax(
    revenue_raw:       float,
    industry:          str,
    period_months:     int   = 1,
    deductions:        Optional[dict[str, float]] = None,
) -> dict[str, Any]:
    """
    Công thức cho scope non-payment:
      net_revenue         = revenue_raw - total_deductions (nếu có deductions)
      annualized_revenue  = net_revenue * 12 / period_months
      gtgt_due            = net_revenue * gtgt_rate  (không offset)
      tncn_due            = net_revenue * tncn_rate  (không offset)
      total_tax_due       = gtgt_due + tncn_due

    Tham số `deductions` (dict, optional):
      Các khoản giảm trừ doanh thu hợp lệ theo TT40/2021:
        - refunds           : Hoàn trả hàng
        - trade_discounts   : Chiết khấu thương mại
        - payment_discounts : Chiết khấu thanh toán
        - promotions        : Khuyến mại
    """
    industry_key = _normalize_industry(industry)
    rates        = _INDUSTRY_RATES.get(industry_key, _INDUSTRY_RATES["other"])

    # Tính tổng giảm trừ doanh thu
    ded = deductions or {}
    total_deductions = (
        _safe_float(ded.get("refunds"), 0.0) +
        _safe_float(ded.get("trade_discounts"), 0.0) +
        _safe_float(ded.get("payment_discounts"), 0.0) +
        _safe_float(ded.get("promotions"), 0.0)
    )
    # Cảnh báo nếu giảm trừ vượt quá doanh thu gộp
    deduction_exceeds_revenue = total_deductions > revenue_raw
    net_revenue        = max(0.0, revenue_raw - total_deductions)
    annualized_revenue = net_revenue * 12 / max(period_months, 1)
    is_above_threshold = annualized_revenue > _THRESHOLD_ANNUAL
    pct_of_threshold   = _r2(annualized_revenue / _THRESHOLD_ANNUAL * 100)

    gtgt_due   = _r2(net_revenue * rates["gtgt_rate"])
    tncn_due   = _r2(net_revenue * rates["tncn_rate"])
    total_due  = gtgt_due + tncn_due

    return {
        "industry":                  industry_key,
        "industry_label":            rates["label"],
        "period_months":             period_months,
        # Doanh thu gộp từ CSV (cột revenue); tên field lịch sử
        "revenue_raw":               _r2(revenue_raw),
        "platform_fees":             0.0,  # không dùng trong schema CSV hiện tại
        "refunds":                   0.0,  # không dùng trong schema CSV hiện tại
        "total_deductions":          _r2(total_deductions),
        "deduction_exceeds_revenue": deduction_exceeds_revenue,
        "net_revenue":               _r2(net_revenue),
        "annualized_revenue":  _r2(annualized_revenue),
        "threshold_annual":    _THRESHOLD_ANNUAL,
        "is_above_threshold":  is_above_threshold,
        "pct_of_threshold":    pct_of_threshold,
        "gtgt_rate":           rates["gtgt_rate"],
        "tncn_rate":           rates["tncn_rate"],
        "tax_withheld_gtgt":   0.0,  # không offset qua cổng thanh toán
        "tax_withheld_tncn":   0.0,
        "gtgt_due":            gtgt_due,
        "tncn_due":            tncn_due,
        "total_tax_due":       total_due,
        "note":                "Tax preview — không phải số liệu kê khai chính thức",
    }


# ══════════════════════════════════════════════════════════════════════════════
# 5. Validation & alerts
# ══════════════════════════════════════════════════════════════════════════════

def _build_validation(
    csv_inputs: dict,
    tax: dict,
    ocr_inputs: Optional[dict[str, Any]] = None,
) -> tuple[dict[str, Any], list[dict]]:
    """
    Sinh warnings / confirmations / alerts dựa trên kết quả tính thuế.

    risk_level: OK < CONFIRM < WARNING < BLOCK
    """
    warnings:      list[str]  = []
    confirmations: list[str]  = []
    alerts:        list[dict] = []
    ocr_inputs = ocr_inputs or {}

    pct         = tax.get("pct_of_threshold", 0.0)
    is_above    = tax.get("is_above_threshold", False)
    net_rev     = tax.get("net_revenue", 0.0)
    revenue_raw = csv_inputs.get("revenue_raw", 0.0)

    # ── Multi-bucket ─────────────────────────────────────────────────────────
    if int(csv_inputs.get("bucket_count") or 1) > 1:
        msg = (
            "Một file CSV chứa nhiều cặp (seller_id, period) — đã gộp theo bucket; "
            "ước tính thuế đang dùng bucket có tổng doanh thu CSV lớn nhất. "
            "Nên tách file hoặc lọc theo shop/kỳ."
        )
        confirmations.append(msg)
        alerts.append({"level": "CONFIRM", "code": "MULTIPLE_PERIOD_OR_SHOP_BUCKETS", "message": msg})

    # ── Thiếu period ─────────────────────────────────────────────────────────
    if _is_missing_meta(csv_inputs.get("period")):
        msg = (
            "Thiếu period (YYYY-MM / quý / năm) — "
            "quy đổi năm mặc định 1 tháng, cần bổ sung để đúng kỳ kê khai."
        )
        warnings.append(msg)
        alerts.append({"level": "WARNING", "code": "MISSING_PERIOD", "message": msg})

    # ── [1] Ngưỡng doanh thu 1 tỷ (Nghị định 1-41/2026) ───────────────────
    if is_above:
        msg = (
            f"Doanh thu quy đổi năm {tax['annualized_revenue']:,.0f} VND "
            f"VƯỢT NGƯỠNG 1 tỷ — phát sinh nghĩa vụ kê khai và nộp thuế."
        )
        warnings.append(msg)
        alerts.append({"level": "WARNING", "code": "ABOVE_THRESHOLD", "message": msg})

    elif pct >= _PCT_APPROACHING:
        msg = (
            f"Doanh thu quy đổi năm đạt {pct:.1f}% ngưỡng 1 tỷ "
            f"({tax['annualized_revenue']:,.0f} VND) — sắp đến ngưỡng chịu thuế."
        )
        confirmations.append(msg)
        alerts.append({"level": "CONFIRM", "code": "APPROACHING_THRESHOLD", "message": msg})

    # ── [2] Doanh thu thuần âm / bằng 0 ─────────────────────────────────────
    if net_rev <= 0:
        msg = "Doanh thu thuần = 0 hoặc âm — kiểm tra lại dữ liệu doanh thu."
        warnings.append(msg)
        alerts.append({"level": "WARNING", "code": "ZERO_NET_REVENUE", "message": msg})

    # ── [3] Không có dữ liệu CSV ─────────────────────────────────────────────
    if not csv_inputs.get("found"):
        msg = "Không tìm thấy dữ liệu CSV — kết quả thuế là 0 (không thể tính)."
        warnings.append(msg)
        alerts.append({"level": "WARNING", "code": "NO_CSV_DATA", "message": msg})

    # ── [4] OCR có chứng từ nhưng lệch với CSV ──────────────────────────────
    if ocr_inputs.get("found"):
        rev_doc = _safe_float(ocr_inputs.get("revenue_extracted"), 0.0)
        if revenue_raw > 0 and rev_doc > 0:
            abs_delta = abs(revenue_raw - rev_doc)
            ratio_delta = abs_delta / max(revenue_raw, 1.0)
            if abs_delta >= 5_000_000 or ratio_delta >= 0.05:
                msg = (
                    f"Chênh doanh thu CSV và doanh thu từ chứng từ giao dịch: "
                    f"{abs_delta:,.0f} VND ({ratio_delta*100:.1f}%). Vui lòng kiểm tra lại."
                )
                warnings.append(msg)
                alerts.append({"level": "WARNING", "code": "CSV_VLM_MISMATCH", "message": msg})

    # ── [5A] Giảm trừ vượt doanh thu ────────────────────────────────────────
    if tax.get("deduction_exceeds_revenue"):
        total_ded = tax.get("total_deductions", 0)
        msg = (
            f"Tổng giảm trừ ({total_ded:,.0f} VND) vượt doanh thu gộp ({revenue_raw:,.0f} VND). "
            "Vui lòng kiểm tra lại số liệu giảm trừ."
        )
        warnings.append(msg)
        alerts.append({"level": "WARNING", "code": "DEDUCTION_EXCEEDS_REVENUE", "message": msg})

    # ── [5] OCR confidence thấp ──────────────────────────────────────────────
    conf = ocr_inputs.get("confidence") or {}
    if isinstance(conf, dict):
        for key in ("amount", "total_amount", "revenue"):
            c = conf.get(key)
            if c is None:
                continue
            try:
                cv = float(c)
            except (TypeError, ValueError):
                continue
            if 0.0 <= cv < 0.8:
                msg = (
                    f"OCR confidence cho '{key}' = {cv:.2f} < 0.80 — "
                    "cần kiểm tra lại dữ liệu trích xuất từ chứng từ."
                )
                warnings.append(msg)
                alerts.append({"level": "WARNING", "code": "LOW_OCR_CONFIDENCE", "message": msg})
                break

    # ── Risk level tổng hợp ──────────────────────────────────────────────────
    levels = {a["level"] for a in alerts}
    if "BLOCK" in levels:
        risk_level = "BLOCK"
    elif "WARNING" in levels:
        risk_level = "WARNING"
    elif "CONFIRM" in levels:
        risk_level = "CONFIRM"
    else:
        risk_level = "OK"

    validation = {
        "risk_level":    risk_level,
        "warnings":      warnings,
        "confirmations": confirmations,
    }
    return validation, alerts


# ══════════════════════════════════════════════════════════════════════════════
# 6. TaxAgent — interface chuẩn sub-agent
# ══════════════════════════════════════════════════════════════════════════════

class TaxAgent:
    """
    Tax sub-agent: tính GTGT + TNCN theo luật Việt Nam cho hộ kinh doanh TMĐT.
    Scope: nền tảng KHÔNG có chức năng thanh toán.

    Interface chuẩn MiAI: run(state: AgentState) -> {"tax_result": dict}

    Luồng:
      worker_results (csv_extractor + image_ocr)
          ↓ _extract_csv_inputs / _extract_ocr_inputs
      calculate_tax() → core numbers
          ↓
      _build_validation() → warnings / alerts / risk_level
          ↓
      {"tax_result": {seller_id, period, tax_result, validation, alerts, dashboard}}
    """

    def run(self, state: AgentState) -> dict:
        csv_inputs = _extract_csv_inputs(state)
        ocr_inputs = _extract_ocr_inputs(state)

        period_months = _parse_period_months(csv_inputs["period"])

        core = calculate_tax(
            revenue_raw   = csv_inputs["revenue_raw"],
            industry      = csv_inputs["industry"],
            period_months = period_months,
            deductions    = csv_inputs.get("deductions"),
        )

        validation, alerts = _build_validation(csv_inputs, core, ocr_inputs)
        explain_tax = _build_explain_tax(state, csv_inputs, ocr_inputs, core)

        missing_req = _count_missing_required_fields(csv_inputs, ocr_inputs)
        vlm_confirm = _vlm_needs_confirmation(ocr_inputs)
        missing_evidence = _missing_supporting_evidence(csv_inputs, ocr_inputs)
        disc_ratio = _reconciliation_discrepancy_ratio(csv_inputs, ocr_inputs, float(core.get("net_revenue") or 0))
        compliance = compute_compliance_score(
            missing_required_fields=missing_req,
            vlm_needs_confirmation=vlm_confirm,
            discrepancy_ratio=disc_ratio,
            annualized_revenue=float(core.get("annualized_revenue") or 0),
            correction_count_last_30d=0,
            days_since_last_upload=0,
            missing_supporting_evidence=missing_evidence,
        )

        result: dict[str, Any] = {
            "source":      "tax_agent",
            "seller_id":   csv_inputs["seller_id"],
            "period":      csv_inputs["period"],
            "row_count":   csv_inputs["row_count"],
            "bucket_count": csv_inputs.get("bucket_count", 0),
            # OCR reference nếu có
            "ocr_ref": {
                "seller_name":   ocr_inputs["seller_name"],
                "document_no":   ocr_inputs["document_no"],
                "issue_date":    ocr_inputs["issue_date"],
                "document_type": ocr_inputs.get("document_type"),
            } if ocr_inputs["found"] else None,
            # ── Kết quả tính thuế ──────────────────────────────────────────
            "tax_result":  core,
            # ── Validation & cảnh báo ngưỡng ──────────────────────────────
            "validation":  validation,
            "alerts":      alerts,
            "explain_tax": explain_tax,
            # ── Dashboard summary ──────────────────────────────────────────
            "dashboard": {
                "alerts_count":     len(alerts),
                "threshold_annual": _THRESHOLD_ANNUAL,
                "pct_of_threshold": core["pct_of_threshold"],
                "risk_level":       validation["risk_level"],
                "net_revenue":      core["net_revenue"],
                "total_tax_due":    core["total_tax_due"],
                "compliance_score": compliance["score"],
                "compliance_band": compliance["band"],
                "compliance_label_vi": compliance["label_vi"],
                "compliance_penalties": compliance["penalties"],
                "compliance_inputs": compliance["inputs"],
            },
        }
        if int(csv_inputs.get("bucket_count") or 1) > 1:
            result["aggregation_note"] = (
                "primary_bucket = max(csv gross revenue) grouped by (seller_id, period)"
            )

        logger.info(
            "[TaxAgent] %s | period=%s | net=%s VND | GTGT=%s | TNCN=%s | risk=%s",
            csv_inputs["seller_id"],
            csv_inputs["period"],
            f"{core['net_revenue']:,.0f}",
            f"{core['gtgt_due']:,.0f}",
            f"{core['tncn_due']:,.0f}",
            validation["risk_level"],
        )
        return {"tax_result": result}


# Backward-compatible alias
class TaxCalculatorMCP(TaxAgent):
    """Alias để tương thích với code cũ."""


# ══════════════════════════════════════════════════════════════════════════════
# 7. LangGraph node + routing
# ══════════════════════════════════════════════════════════════════════════════

_default_tax_agent = TaxAgent()


def tax_graph_node(state: AgentState) -> dict:
    """Node LangGraph duy nhất cho bước thuế."""
    return _default_tax_agent.run(state)


def route_after_aggregate_tax(state: AgentState) -> str:
    """
    Chạy node 'tax' nếu có kết quả CSV (cần thiết để tính thuế TMĐT).
    Bỏ qua nếu không có dữ liệu đầu vào hợp lệ.
    """
    results = state.get("worker_results") or []
    has_csv = any(
        isinstance(r, dict) and r.get("source") == "csv_extractor"
        for r in results
    )
    if has_csv:
        return "tax"

    logger.info("[TaxAgent] Bỏ qua bước thuế — không có dữ liệu CSV hợp lệ.")
    return END


# ══════════════════════════════════════════════════════════════════════════════
# 8. Helpers cho main.py  (build prompt + pipeline output)
# ══════════════════════════════════════════════════════════════════════════════

def build_pipeline_tax_calculations(final_state: dict[str, Any]) -> dict[str, Any]:
    """Trả về toàn bộ tax_result dict để đưa vào pipeline_result."""
    return final_state.get("tax_result") or {}


def format_tax_prompt_block(tax_calculations: dict[str, Any]) -> str:
    """Tạo đoạn text thuế cho LLM prompt từ tax_result dict."""
    if not tax_calculations:
        return ""

    tr         = tax_calculations.get("tax_result") or {}
    validation = tax_calculations.get("validation") or {}
    dashboard  = tax_calculations.get("dashboard") or {}
    alerts     = tax_calculations.get("alerts") or []
    explain_tax = tax_calculations.get("explain_tax") or []

    if not tr:
        return ""

    def fmt(v: Any) -> str:
        try:
            return f"{float(v):,.0f} VND"
        except (TypeError, ValueError):
            return str(v)

    lines: list[str] = [
        "",
        "[KẾT QUẢ THUẾ — TAX AGENT]",
        f"  Ngành kinh doanh      : {tr.get('industry_label', 'N/A')}",
        f"  Doanh thu gộp         : {fmt(tr.get('revenue_raw', 0))}",
        f"  Giảm trừ doanh thu    : {fmt(tr.get('total_deductions', 0))}",
        f"  Doanh thu thuần        : {fmt(tr.get('net_revenue', 0))}",
        f"  Doanh thu quy đổi năm : {fmt(tr.get('annualized_revenue', 0))}",
        f"  % ngưỡng 1 tỷ         : {tr.get('pct_of_threshold', 0):.1f}%",
        f"  Vượt ngưỡng 1 tỷ      : {'CÓ' if tr.get('is_above_threshold') else 'CHƯA'}",
        f"  Thuế GTGT ({int(tr.get('gtgt_rate', 0)*100)}%)         : {fmt(tr.get('gtgt_due', 0))}",
        f"  Thuế TNCN ({tr.get('tncn_rate', 0)*100:.1f}%)        : {fmt(tr.get('tncn_due', 0))}",
        f"  Tổng thuế phải nộp    : {fmt(tr.get('total_tax_due', 0))}",
        f"  Mức rủi ro            : {dashboard.get('risk_level', 'N/A')}",
    ]

    if validation.get("warnings"):
        lines.append("  Cảnh báo:")
        for w in validation["warnings"]:
            lines.append(f"    ! {w}")

    if validation.get("confirmations"):
        lines.append("  Cần xác nhận:")
        for c in validation["confirmations"]:
            lines.append(f"    ? {c}")

    if tr.get("note"):
        lines.append(f"  [{tr['note']}]")

    if explain_tax:
        lines.append("  Explain Tax (actionable):")
        for item in explain_tax:
            lines.append(f"    - {item.get('case', 'N/A')}: {item.get('conclusion', '')}")

    return "\n".join(lines)
