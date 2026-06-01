"""
Endpoint 6 - GET /api/{job_id}/report
Export a CSV report from the processed backend result.
"""

from __future__ import annotations

import csv
from io import StringIO
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ..session_store import get_session

router = APIRouter()


def _fmt(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return str(value)
    return value


def _csv_summary(result: dict[str, Any]) -> dict[str, Any]:
    csv_result = result.get("csv_result") or {}
    csv_data = csv_result.get("data") if isinstance(csv_result.get("data"), dict) else {}
    summary = csv_data.get("summary") if isinstance(csv_data.get("summary"), dict) else {}
    records = csv_data.get("records") if isinstance(csv_data.get("records"), list) else []
    first = records[0] if records else {}

    def _sum(field: str) -> float:
        stat = summary.get(field)
        if isinstance(stat, dict):
            return float(stat.get("sum", 0) or 0)
        return 0.0

    def _sum_records_revenue() -> float:
        total = 0.0
        for rec in records:
            if not isinstance(rec, dict):
                continue
            for col in ("revenue_raw", "revenue", "amount", "total", "sales"):
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

    rev_gross = _sum("revenue_raw") + _sum("revenue")
    if rev_gross == 0.0:
        rev_gross = _sum_records_revenue()

    return {
        "row_count": csv_data.get("row_count", 0),
        "industry": first.get("industry", ""),
        "period": first.get("period", ""),
        "platform_name": first.get("platform_name", "") or first.get("platform", ""),
        "revenue_raw": rev_gross,
    }


def _ocr_summary(result: dict[str, Any]) -> dict[str, Any]:
    ocr_result = result.get("ocr_result") or {}
    ocr_data = ocr_result.get("data") if isinstance(ocr_result.get("data"), dict) else {}
    return {
        "document_category": ocr_data.get("document_category", ""),
        "document_type": ocr_data.get("document_type", ""),
        "document_no": ocr_data.get("document_no", ""),
        "seller_name": ocr_data.get("seller_name") or ocr_data.get("issuer_name", ""),
        "seller_tax_code": ocr_data.get("seller_tax_code") or ocr_data.get("issuer_tax_code", ""),
        "issue_date": ocr_data.get("issue_date") or ocr_data.get("date", ""),
        "counterparty": ocr_data.get("counterparty", ""),
        "order_id": ocr_data.get("order_id", ""),
        "amount": ocr_data.get("amount", ""),
        "revenue": ocr_data.get("revenue") or ocr_data.get("revenue_reported", ""),
    }


@router.get("/{job_id}/report")
def export_report(job_id: str):
    session = get_session(job_id)
    if session is None:
        raise HTTPException(404, f"Khong tim thay job_id: '{job_id}'")
    if session.status == "processing":
        raise HTTPException(409, "Pipeline van dang chay, chua the xuat bao cao.")
    if session.status == "error":
        raise HTTPException(500, f"Pipeline loi: {session.error}")

    result = session.result or {}
    tax = result.get("tax_result") or {}
    dashboard = result.get("dashboard") or {}
    alerts = [item for item in (result.get("alerts") or []) if isinstance(item, dict)]
    csv_data = _csv_summary(result)
    ocr_data = _ocr_summary(result)

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Section", "Field", "Value"])

    writer.writerow(["Job", "job_id", job_id])
    writer.writerow(["Job", "filename", session.filename or ""])
    writer.writerow(["Job", "file_kind", session.file_kind or ""])

    for key, value in csv_data.items():
        writer.writerow(["CSV", key, _fmt(value)])
    for key, value in ocr_data.items():
        writer.writerow(["OCR", key, _fmt(value)])
    for key, value in tax.items():
        writer.writerow(["Tax", key, _fmt(value)])
    for key, value in dashboard.items():
        writer.writerow(["Dashboard", key, _fmt(value)])

    if alerts:
        writer.writerow([])
        writer.writerow(["Alert Code", "Level", "Message"])
        for alert in alerts:
            writer.writerow([
                alert.get("code", ""),
                alert.get("level", ""),
                alert.get("message", ""),
            ])

    content = "\ufeff" + buffer.getvalue()
    filename = f"tax_report_{job_id}.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
