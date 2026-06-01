"""Tiêu chí chứng từ giao dịch hợp lệ — dùng chung checklist cuối năm, tuân thủ, cửa hàng."""

from __future__ import annotations

from datetime import datetime
from typing import Any


def is_valid_transaction_evidence(doc: dict[str, Any]) -> bool:
    """
    Chứng từ hợp lệ: có URL file ảnh/PDF và giá trị ghi nhận > 0.
    Loại bản ghi chỉ từ upload CSV doanh thu (không phải hóa đơn/chứng từ).
    """
    if not isinstance(doc, dict):
        return False
    file_url = doc.get("document_url") or doc.get("image_url") or doc.get("pdf_url")
    if not file_url or not str(file_url).strip():
        return False
    amount = float(
        doc.get("document_amount")
        or doc.get("total_revenue_on_document")
        or doc.get("deducted_tax_amount")
        or 0
    )
    if amount <= 0:
        return False
    parsed = doc.get("parsed_json")
    if isinstance(parsed, dict):
        uctx = parsed.get("user_upload_context")
        if isinstance(uctx, dict):
            kind = str(uctx.get("upload_kind") or "").lower()
            if kind in ("sales_csv", "revenue_csv", "csv"):
                return False
        ocr = parsed.get("ocr_result")
        if isinstance(ocr, dict):
            status = str(ocr.get("status") or "").lower()
            if status in ("failed", "error"):
                return False
    return True


def filter_valid_evidence(docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [d for d in docs if is_valid_transaction_evidence(d)]


def _month_from_doc(doc: dict[str, Any], tax_year: int | None = None) -> int | None:
    issue = doc.get("issue_date")
    if isinstance(issue, datetime):
        if tax_year is None or issue.year == tax_year:
            return int(issue.month)
    parsed = doc.get("parsed_json")
    if isinstance(parsed, dict):
        uctx = parsed.get("user_upload_context")
        if isinstance(uctx, dict):
            for key in ("period_month", "month"):
                raw = uctx.get(key)
                if raw is not None:
                    try:
                        m = int(raw)
                        if 1 <= m <= 12:
                            return m
                    except (TypeError, ValueError):
                        pass
    return None


def evidence_months_covered(
    valid_docs: list[dict[str, Any]],
    revenue_months: set[int],
    *,
    tax_year: int | None = None,
) -> tuple[int, int]:
    """Số tháng có chứng từ hợp lệ / số tháng có doanh thu."""
    if not revenue_months:
        return 0, 0
    ev_months: set[int] = set()
    for d in valid_docs:
        m = _month_from_doc(d, tax_year)
        if m is not None and m in revenue_months:
            ev_months.add(m)
    return len(ev_months), len(revenue_months)


def evidence_requirement_met(
    valid_docs: list[dict[str, Any]],
    revenue_months: set[int],
    *,
    tax_year: int | None = None,
) -> bool:
    """Đủ chứng từ khi mỗi kỳ đã có doanh thu đều có ít nhất một chứng từ hợp lệ."""
    if not revenue_months:
        return False
    if not valid_docs:
        return False
    covered, required = evidence_months_covered(valid_docs, revenue_months, tax_year=tax_year)
    return covered >= required


def evidence_checklist_meta(
    valid_count: int,
    covered_months: int,
    revenue_month_count: int,
) -> str:
    if revenue_month_count <= 0:
        return "Chưa có doanh thu — upload CSV trước"
    if valid_count <= 0:
        return "Chưa upload chứng từ — có thể bổ sung tại Upload"
    if covered_months >= revenue_month_count:
        return f"{valid_count} chứng từ • đủ {covered_months}/{revenue_month_count} kỳ"
    return (
        f"{valid_count} chứng từ • mới phủ {covered_months}/{revenue_month_count} kỳ có doanh thu"
    )
