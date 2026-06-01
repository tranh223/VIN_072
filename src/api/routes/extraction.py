"""
Endpoint 2 — GET /api/{job_id}/extraction
Trả về kết quả sau bước trích xuất: CSV và OCR.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from ..session_store import get_session

router = APIRouter()


class ExtractionResponse(BaseModel):
    job_id:     str
    status:     str
    csv_result: Optional[dict[str, Any]] = None
    ocr_result: Optional[dict[str, Any]] = None
    # Lỗi tổng pipeline (OCR/CSV) — hiển thị khi OCR không trích xuất được
    errors:     list[str] = []
    # Luồng RAG tách riêng — không ảnh hưởng status extraction
    rag_index:  Optional[dict[str, Any]] = None


@router.get("/{job_id}/extraction", response_model=ExtractionResponse)
def get_extraction(job_id: str):
    """
    **Kết quả trích xuất dữ liệu.**

    Trả về:
    - `csv_result`: ngành, doanh thu gộp, phí sàn, hoàn trả từ file CSV.
    - `ocr_result`: chứng từ khấu trừ TMĐT — doanh thu trên CT, thuế GTGT/TNCN/tổng khấu trừ, số/ký hiệu, bên phát hành.
    - `status`: `processing` nếu pipeline vẫn đang chạy.
    """
    session = get_session(job_id)
    if session is None:
        raise HTTPException(404, f"Không tìm thấy job_id: '{job_id}'")

    if session.status == "processing":
        return ExtractionResponse(
            job_id=job_id,
            status="processing",
            rag_index=session.rag_index,
        )

    if session.status == "error":
        raise HTTPException(500, f"Pipeline lỗi: {session.error}")

    result = session.result or {}
    csv_r  = result.get("csv_result") or {}
    ocr_r  = result.get("ocr_result") or {}
    pipe_errors = [str(e) for e in (result.get("errors") or []) if e]

    # ── Làm gọn CSV: chỉ giữ các trường cần thiết ────────────────────────
    csv_data    = csv_r.get("data") if isinstance(csv_r.get("data"), dict) else {}
    csv_summary = csv_data.get("summary") if isinstance(csv_data.get("summary"), dict) else {}
    records     = csv_data.get("records") or []
    first       = records[0] if records else {}

    def _sum(col: str) -> float:
        stat = csv_summary.get(col)
        if isinstance(stat, dict):
            return float(stat.get("sum", 0) or 0)
        if isinstance(stat, (int, float)):
            return float(stat)
        return 0.0

    def _max_summary_sum_fallback() -> float:
        """Giống aggregate_node: nếu không map được key revenue, lấy max sum trong summary."""
        best = 0.0
        for v in csv_summary.values():
            if not isinstance(v, dict):
                continue
            try:
                s = float(v.get("sum", 0) or 0)
            except (TypeError, ValueError):
                continue
            best = max(best, s)
        return best

    def _sum_records_cols(*names: str) -> float:
        """Cộng giá trị số từ records — dùng khi summary không có key legacy."""
        total = 0.0
        for rec in records:
            if not isinstance(rec, dict):
                continue
            for col in names:
                if col not in rec:
                    continue
                v = rec.get(col)
                if v in (None, "", "N/A"):
                    continue
                try:
                    total += float(str(v).replace(",", "").strip())
                except (TypeError, ValueError):
                    continue
                break
        return total

    # CSVAgent gộp summary["revenue"]; schema cũ revenue_raw. Fallback bản ghi + max cột số (như aggregate_node).
    rev = _sum("revenue_raw") + _sum("revenue")
    if rev == 0.0:
        rev = _sum_records_cols("revenue_raw", "revenue", "amount", "total", "sales")
    if rev == 0.0:
        rev = _max_summary_sum_fallback()

    platform_disp = first.get("platform_name") or first.get("platform") or "N/A"
    industry_disp = first.get("industry", "N/A")

    csv_clean = {
        "row_count":     csv_data.get("row_count", 0),
        "industry":      industry_disp,
        "period":        first.get("period", "N/A"),
        "platform_name": platform_disp,
        "revenue_raw":   rev,
    }

    def _num(d: dict, *keys: str) -> float:
        for k in keys:
            v = d.get(k)
            if v is None or v == "N/A":
                continue
            try:
                return float(str(v).replace(",", "").strip())
            except (TypeError, ValueError):
                continue
        return 0.0

    # ── OCR: schema chứng từ khấu trừ TMĐT (đối soát doanh thu + thuế) ────
    ocr_clean: Optional[dict] = None
    has_ocr_worker = isinstance(ocr_r, dict) and ocr_r.get("source") == "image_ocr"
    if has_ocr_worker:
        ocr_data = ocr_r.get("data") if isinstance(ocr_r.get("data"), dict) else {}
        warn_outer = ocr_r.get("warnings") if isinstance(ocr_r.get("warnings"), list) else []
        warn_data = ocr_data.get("warnings") if isinstance(ocr_data.get("warnings"), list) else []
        merged_warn = [str(x) for x in (list(warn_outer) + list(warn_data)) if x]
        ocr_amount = _num(ocr_data, "amount", "revenue", "revenue_reported", "subtotal", "total")
        ocr_rev = _num(ocr_data, "revenue", "revenue_reported", "amount", "subtotal", "total")
        ocr_clean = {
            "document_category":      ocr_data.get("document_category", "unknown"),
            "document_type":          ocr_data.get("document_type", "N/A"),
            "document_no":            ocr_data.get("document_no", ocr_data.get("invoice_number", "N/A")),
            "symbol":                 ocr_data.get("symbol", ocr_data.get("invoice_symbol", "N/A")),
            "seller_name":            ocr_data.get("seller_name") or ocr_data.get("issuer_name") or ocr_data.get("vendor", "N/A"),
            "seller_tax_code":        ocr_data.get("seller_tax_code") or ocr_data.get("issuer_tax_code") or ocr_data.get("vendor_tax_code", "N/A"),
            "issuer_name":            ocr_data.get("issuer_name") or ocr_data.get("seller_name") or ocr_data.get("vendor", "N/A"),
            "issuer_tax_code":        ocr_data.get("issuer_tax_code") or ocr_data.get("seller_tax_code") or ocr_data.get("vendor_tax_code", "N/A"),
            "counterparty":           ocr_data.get("counterparty", "N/A"),
            "order_id":               ocr_data.get("order_id", "N/A"),
            "issue_date":             ocr_data.get("issue_date", ocr_data.get("date", "N/A")),
            "amount":                 ocr_amount,
            "revenue":                ocr_rev,
            "revenue_reported":       ocr_rev,
            "total":                  ocr_amount,
            "subtotal":               ocr_rev,
            "items":                  ocr_data.get("items") if isinstance(ocr_data.get("items"), list) else [],
            "confidence":             ocr_data.get("confidence", 0.0),
            "needs_review":           bool(ocr_data.get("needs_review", ocr_r.get("needs_review", False))),
            "is_valid":               bool(ocr_r.get("is_valid")),
            "warnings":               merged_warn,
        }

    # Trả vừa các trường đã tính (revenue_raw đã map từ revenue) vừa giữ nguyên data.summary/records
    # để FE đọc summary.revenue như pipeline — tránh chỉ nhận object phẳng rồi thiếu key.
    csv_for_response: dict[str, Any] = dict(csv_clean)
    if isinstance(csv_r.get("data"), dict):
        csv_for_response["data"] = csv_r["data"]
    if isinstance(csv_r, dict):
        for k in ("source", "csv_path"):
            if k in csv_r and csv_r[k] is not None:
                csv_for_response[k] = csv_r[k]

    return ExtractionResponse(
        job_id     = job_id,
        status     = "done",
        csv_result = csv_for_response,
        ocr_result = ocr_clean,
        errors     = pipe_errors,
        rag_index  = session.rag_index,
    )
