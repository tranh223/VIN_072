"""
Endpoint 3 — GET /api/{job_id}/tax
Trả về kết quả tính thuế và danh sách cảnh báo.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..session_store import get_session
from ..ui_contract import build_dashboard_payload

router = APIRouter()


class AlertItem(BaseModel):
    level:   str
    code:    str
    message: str


class TaxResponse(BaseModel):
    job_id:     str
    status:     str
    tax_result: Optional[dict[str, Any]] = None
    dashboard:  Optional[dict[str, Any]] = None
    alerts:     list[AlertItem]          = Field(default_factory=list)

@router.get("/{job_id}/tax", response_model=TaxResponse)
def get_tax(job_id: str):
    """
    **Kết quả tính thuế và cảnh báo.**

    Trả về:
    - `tax_result`: doanh thu thuần, doanh thu quy đổi năm, GTGT/TNCN phải nộp,
      thuế đã khấu trừ, tổng thuế còn phải nộp.
    - `dashboard`: mức rủi ro, % ngưỡng 1 tỷ, số cảnh báo.
    - `alerts`: danh sách cảnh báo với level (`WARNING` / `CONFIRM`) và mô tả.
    """
    session = get_session(job_id)
    if session is None:
        raise HTTPException(404, f"Không tìm thấy job_id: '{job_id}'")

    if session.status == "processing":
        return TaxResponse(job_id=job_id, status="processing")

    if session.status == "error":
        raise HTTPException(500, f"Pipeline lỗi: {session.error}")

    result = session.result or {}
    tr     = result.get("tax_result") or {}
    dash   = result.get("dashboard")  or {}
    raw_alerts = [a for a in (result.get("alerts") or []) if isinstance(a, dict)]

    alerts = [
        AlertItem(
            level   = a.get("level", "N/A"),
            code    = a.get("code", "N/A"),
            message = a.get("message", ""),
        )
        for a in raw_alerts
    ]

    return TaxResponse(
        job_id     = job_id,
        status     = "done",
        tax_result = {
            "net_revenue":        tr.get("net_revenue", 0),
            "annualized_revenue": tr.get("annualized_revenue", 0),
            "gtgt_due":           tr.get("gtgt_due", 0),
            "tncn_due":           tr.get("tncn_due", 0),
            "total_tax_due":      tr.get("total_tax_due", 0),
        },
        dashboard  = build_dashboard_payload(tr, dash, raw_alerts),
        alerts = alerts,
    )
