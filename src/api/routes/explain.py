"""

Endpoint 4 - GET /api/{job_id}/explain
Return UI-friendly explain data plus detailed alert explanations.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException

from pydantic import BaseModel, Field

from ..session_store import get_session
from ..ui_contract import build_confirmation_message, build_data_tags, build_legal_basis

router = APIRouter()


class ExplanationItem(BaseModel):
    code:               str
    level:              str
    message:            str
    conclusion:         str
    reason:             str
    data_used:          dict[str, Any]
    recommended_action: str


class ExplainResponse(BaseModel):
    job_id:               str
    status:               str
    has_explanations:     bool = False
    alert_explanations:   list[ExplanationItem] = Field(default_factory=list)
    legalBasis:           list[str] = Field(default_factory=list)
    confirmationMessage:  Optional[str] = None
    dataTags:             list[str] = Field(default_factory=list)
    note:                 Optional[str] = None


@router.get("/{job_id}/explain", response_model=ExplainResponse)
def get_explain(job_id: str):
    session = get_session(job_id)
    if session is None:
        raise HTTPException(404, f"Khong tim thay job_id: '{job_id}'")

    if session.status == "processing":
        return ExplainResponse(job_id=job_id, status="processing")

    if session.status == "error":
        raise HTTPException(500, f"Pipeline loi: {session.error}")

    result = session.result or {}
    tax_result = result.get("tax_result") or {}
    raw_items = result.get("alert_explanations") or []

    if not raw_items:
        return ExplainResponse(
            job_id=job_id,
            status="done",
            has_explanations=False,
            legalBasis=build_legal_basis(tax_result),
            confirmationMessage=build_confirmation_message(result, []),
            dataTags=build_data_tags(tax_result),
            note="Doanh thu chua vuot nguong 500 trieu hoac khong co canh bao can giai thich.",
        )

    items: list[ExplanationItem] = []
    first_explanation: dict[str, Any] = {}

    for item in raw_items:
        if not isinstance(item, dict):
            continue
        ex = item.get("explanation") if isinstance(item.get("explanation"), dict) else {}
        if not first_explanation and ex:
            first_explanation = ex
        items.append(ExplanationItem(
            code=item.get("code", "N/A"),
            level=item.get("level", "N/A"),
            message=item.get("message", ""),
            conclusion=ex.get("conclusion", ""),
            reason=ex.get("reason", ""),
            data_used=ex.get("data_used") if isinstance(ex.get("data_used"), dict) else {},
            recommended_action=ex.get("recommended_action", ""),
        ))

    return ExplainResponse(
        job_id=job_id,
        status="done",
        has_explanations=True,
        alert_explanations=items,
        legalBasis=build_legal_basis(tax_result),
        confirmationMessage=build_confirmation_message(result, raw_items),
        dataTags=build_data_tags(tax_result, first_explanation),
    )
