"""
Endpoint 5 - POST /api/{job_id}/correction
Accept UI-style edits and recalculate tax synchronously.
"""
from __future__ import annotations

import logging
from copy import deepcopy
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..session_store import get_session, update_session
from ..ui_contract import build_dashboard_payload

logger = logging.getLogger(__name__)
router = APIRouter()

class DeductionsBody(BaseModel):
    trade_discounts:    Optional[float] = Field(None, description="Chiet khau thuong mai (VND)")
    payment_discounts:  Optional[float] = Field(None, description="Chiet khau thanh toan (VND)")
    promotions:         Optional[float] = Field(None, description="Khuyen mai (VND)")
    refunds:            Optional[float] = Field(None, description="Hoan tra / hoan hang (VND)")


class CorrectionBody(BaseModel):
    revenue_raw:        Optional[float] = Field(None, description="Doanh thu (VND)")
    industry:           Optional[str]   = Field(None, description="goods | services | manufacturing | transport | other")
    period:             Optional[str]   = Field(None, description="YYYY-MM | YYYY-QN | YYYY")
    total_amount:       Optional[float] = Field(None, description="Tong tien tren chung cu giao dich (VND)")
    issue_date:         Optional[str]   = Field(None, description="Ngay chung tu (YYYY-MM-DD)")
    deductions:         Optional[DeductionsBody] = Field(None, description="Cac khoan giam tru doanh thu / hoan tra")


class AlertItem(BaseModel):
    level:   str
    code:    str
    message: str


class ExplanationItem(BaseModel):
    code:               str
    level:              str
    message:            str
    conclusion:         str
    reason:             str
    data_used:          dict[str, Any]
    recommended_action: str


class CorrectionResponse(BaseModel):
    job_id:              str
    changed_fields:      list[str]
    tax_result:          dict[str, Any]
    dashboard:           dict[str, Any]
    alerts:              list[AlertItem]
    alert_explanations:  list[ExplanationItem]
    ocr_result:          dict[str, Any]


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def _ocr_field_float(ocr_data: dict[str, Any], tr: dict[str, Any], ocr_keys: tuple[str, ...], tr_key: str) -> float:
    for k in ocr_keys:
        if k in ocr_data:
            v = ocr_data[k]
            if v not in (None, "", "N/A"):
                return _safe_float(v, 0.0)
    return _safe_float(tr.get(tr_key), 0.0)


def _csv_inputs_from_result(result: dict[str, Any]) -> dict[str, Any]:
    from ...sub_agent.tax_agent import aggregate_csv_inputs_for_correction

    csv_r = result.get("csv_result") or {}
    csv_data = csv_r.get("data") if isinstance(csv_r.get("data"), dict) else {}
    return aggregate_csv_inputs_for_correction(csv_data)


def _ocr_inputs_from_result(result: dict[str, Any]) -> dict[str, Any]:
    ocr_r = result.get("ocr_result") or {}
    ocr_data = ocr_r.get("data") if isinstance(ocr_r.get("data"), dict) else {}
    return {
        "revenue_extracted": _safe_float(ocr_data.get("revenue") or ocr_data.get("revenue_reported") or ocr_data.get("amount"), 0.0),
        "total_amount": _safe_float(ocr_data.get("total") or ocr_data.get("amount"), 0.0),
        "confidence": _safe_float(ocr_data.get("confidence"), 0.0),
        "document_category": ocr_data.get("document_category") or "unknown",
        "document_type": ocr_data.get("document_type") or "N/A",
        "document_no": ocr_data.get("document_no") or ocr_data.get("invoice_number", "N/A"),
        "seller_name": ocr_data.get("seller_name") or ocr_data.get("issuer_name") or ocr_data.get("vendor", "N/A"),
        "seller_tax_code": ocr_data.get("seller_tax_code") or ocr_data.get("issuer_tax_code") or ocr_data.get("vendor_tax_code") or "N/A",
        "counterparty": ocr_data.get("counterparty") or "N/A",
        "order_id": ocr_data.get("order_id") or "N/A",
        "issue_date": ocr_data.get("issue_date") or ocr_data.get("date") or "N/A",
        "extraction_quality": ocr_data.get("extraction_quality") or "N/A",
        "found": bool(ocr_data),
    }


def _apply_ui_correction(
    updates: dict[str, Any],
    csv_inputs: dict[str, Any],
    ocr_inputs: dict[str, Any],
) -> None:
    if "total_amount" in updates:
        old_total = _safe_float(ocr_inputs.get("total_amount"), 0.0)
        new_total = _safe_float(updates["total_amount"], 0.0)
        delta = new_total - old_total

        ocr_inputs["total_amount"] = new_total
        ocr_inputs["revenue_extracted"] = new_total

        # UI correction drawer edits chứng cứ giao dịch; giữ cho doanh thu tương ứng đồng bộ.
        if "revenue_raw" not in updates:
            csv_inputs["revenue_raw"] = max(0.0, _safe_float(csv_inputs.get("revenue_raw"), 0.0) + delta)

    if "issue_date" in updates and updates["issue_date"]:
        ocr_inputs["issue_date"] = updates["issue_date"]

    # Xử lý deductions — lưu vào csv_inputs dưới key "deductions"
    if "deductions" in updates and isinstance(updates["deductions"], dict):
        csv_inputs["deductions"] = {}
        for k in ("refunds", "trade_discounts", "payment_discounts", "promotions"):
            v = updates["deductions"].get(k)
            if v is not None:
                csv_inputs["deductions"][k] = _safe_float(v, 0.0)

    for field_name, value in updates.items():
        if field_name in ("revenue_raw", "industry", "period"):
            csv_inputs[field_name] = value
        elif field_name in ("total_amount", "issue_date"):
            ocr_inputs[field_name] = value


def _recalculate(
    csv_inputs: dict[str, Any],
    ocr_inputs: dict[str, Any],
    changed_fields: list[str],
) -> dict[str, Any]:
    from ...compliance_score import compute_compliance_score
    from ...main import _build_alert_explanations, _build_final_tax_output
    from ...sub_agent.tax_agent import (
        _build_explain_tax,
        _build_validation,
        _count_missing_required_fields,
        _parse_period_months,
        _reconciliation_discrepancy_ratio,
        _vlm_needs_confirmation,
        calculate_tax,
    )

    period_months = _parse_period_months(csv_inputs.get("period"))
    core = calculate_tax(
        revenue_raw=csv_inputs["revenue_raw"],
        industry=csv_inputs["industry"],
        period_months=period_months,
        deductions=csv_inputs.get("deductions"),
    )

    validation, alerts = _build_validation(csv_inputs, core, ocr_inputs)
    explain_tax = _build_explain_tax({"changed_fields": changed_fields}, csv_inputs, ocr_inputs, core)

    missing_req = _count_missing_required_fields(csv_inputs, ocr_inputs)
    vlm_confirm = _vlm_needs_confirmation(ocr_inputs)
    disc_ratio = _reconciliation_discrepancy_ratio(csv_inputs, ocr_inputs, float(core.get("net_revenue") or 0))
    compliance = compute_compliance_score(
        missing_required_fields=missing_req,
        vlm_needs_confirmation=vlm_confirm,
        discrepancy_ratio=disc_ratio,
        annualized_revenue=float(core.get("annualized_revenue") or 0),
        correction_count_last_30d=0,
        days_since_last_upload=0,
    )

    tax_calc = {
        "tax_result": core,
        "validation": validation,
        "alerts": alerts,
        "explain_tax": explain_tax,
        "dashboard": {
            "alerts_count": len(alerts),
            "risk_level": validation["risk_level"],
            "pct_of_threshold": core["pct_of_threshold"],
            "net_revenue": core["net_revenue"],
            "total_tax_due": core["total_tax_due"],
            "compliance_score": compliance["score"],
            "compliance_band": compliance["band"],
            "compliance_label_vi": compliance["label_vi"],
            "compliance_penalties": compliance["penalties"],
            "compliance_inputs": compliance["inputs"],
        },
    }

    final_output = _build_final_tax_output(tax_calc)
    alert_explanations = _build_alert_explanations(tax_calc)
    final_dashboard = dict(final_output.get("dashboard") or {})
    final_dashboard.update({
        "risk_level": validation["risk_level"],
        "pct_of_threshold": core["pct_of_threshold"],
    })
    return {
        "tax_result": final_output.get("tax_result") or {},
        "dashboard": final_dashboard,
        "alerts": alerts,
        "alert_explanations": alert_explanations,
    }


def _update_result_cache(
    result: dict[str, Any],
    updates: dict[str, Any],
    recalc: dict[str, Any],
    csv_inputs: dict[str, Any],
    ocr_inputs: dict[str, Any],
) -> dict[str, Any]:
    new_result = deepcopy(result)
    new_result["tax_result"] = recalc.get("tax_result") or {}
    new_result["dashboard"] = recalc.get("dashboard") or {}
    new_result["alerts"] = recalc.get("alerts") or []
    new_result["alert_explanations"] = recalc.get("alert_explanations") or []

    if isinstance(new_result.get("ocr_result"), dict):
        ocr_result = deepcopy(new_result["ocr_result"])
        ocr_data = ocr_result.get("data") if isinstance(ocr_result.get("data"), dict) else {}
        if "total_amount" in updates:
            ocr_data["total"] = _safe_float(ocr_inputs.get("total_amount"), 0.0)
            ocr_data["revenue"] = _safe_float(ocr_inputs.get("revenue_extracted"), 0.0)
            ocr_data["subtotal"] = _safe_float(ocr_inputs.get("revenue_extracted"), 0.0)
        if "issue_date" in updates:
            ocr_data["issue_date"] = ocr_inputs.get("issue_date", "N/A")
            ocr_data["date"] = ocr_inputs.get("issue_date", "N/A")
        ocr_result["data"] = ocr_data
        new_result["ocr_result"] = ocr_result

    if isinstance(new_result.get("csv_result"), dict):
        csv_result = deepcopy(new_result["csv_result"])
        csv_data = csv_result.get("data") if isinstance(csv_result.get("data"), dict) else {}
        summary = csv_data.get("summary") if isinstance(csv_data.get("summary"), dict) else {}
        records = csv_data.get("records") if isinstance(csv_data.get("records"), list) else []
        for key in ("revenue_raw",):
            if key in updates and isinstance(summary.get(key), dict):
                summary[key]["sum"] = _safe_float(csv_inputs.get(key), 0.0)
        if records:
            first = dict(records[0])
            for key in ("industry", "period"):
                if key in updates:
                    first[key] = csv_inputs.get(key)
            records[0] = first
        csv_data["summary"] = summary
        csv_data["records"] = records
        csv_result["data"] = csv_data
        new_result["csv_result"] = csv_result

    return new_result


@router.post("/{job_id}/correction", response_model=CorrectionResponse)
def post_correction(job_id: str, body: CorrectionBody):
    session = get_session(job_id)
    if session is None:
        raise HTTPException(404, f"Khong tim thay job_id: '{job_id}'")

    if session.status == "processing":
        raise HTTPException(409, "Pipeline van dang chay, vui long doi.")

    if session.status == "error":
        raise HTTPException(500, f"Pipeline loi: {session.error}")

    result = session.result or {}
    csv_inputs = _csv_inputs_from_result(result)
    ocr_inputs = _ocr_inputs_from_result(result)

    updates = body.model_dump(exclude_none=True)
    changed_fields = list(updates.keys())
    if not changed_fields:
        raise HTTPException(422, "Khong co field nao duoc cung cap de sua.")

    _apply_ui_correction(updates, csv_inputs, ocr_inputs)

    logger.info("[Correction] job_id=%s | changed=%s", job_id, changed_fields)
    recalc = _recalculate(csv_inputs, ocr_inputs, changed_fields)
    new_result = _update_result_cache(result, updates, recalc, csv_inputs, ocr_inputs)
    update_session(job_id, result=new_result, corrections=updates)

    tr = recalc.get("tax_result") or {}
    dash = recalc.get("dashboard") or {}
    raw_alerts = [a for a in (recalc.get("alerts") or []) if isinstance(a, dict)]
    alerts = [
        AlertItem(
            level=a.get("level", "N/A"),
            code=a.get("code", "N/A"),
            message=a.get("message", ""),
        )
        for a in raw_alerts
    ]

    explains: list[ExplanationItem] = []
    for item in (recalc.get("alert_explanations") or []):
        if not isinstance(item, dict):
            continue
        ex = item.get("explanation") if isinstance(item.get("explanation"), dict) else {}
        explains.append(ExplanationItem(
            code=item.get("code", "N/A"),
            level=item.get("level", "N/A"),
            message=item.get("message", ""),
            conclusion=ex.get("conclusion", ""),
            reason=ex.get("reason", ""),
            data_used=ex.get("data_used") if isinstance(ex.get("data_used"), dict) else {},
            recommended_action=ex.get("recommended_action", ""),
        ))

    return CorrectionResponse(
        job_id=job_id,
        changed_fields=changed_fields,
        tax_result={
            "net_revenue": tr.get("net_revenue", 0),
            "annualized_revenue": tr.get("annualized_revenue", 0),
            "gtgt_due": tr.get("gtgt_due", 0),
            "tncn_due": tr.get("tncn_due", 0),
            "total_tax_due": tr.get("total_tax_due", 0),
        },
        dashboard=build_dashboard_payload(tr, dash, raw_alerts),
        alerts=alerts,
        alert_explanations=explains,
        ocr_result={
            "total": _safe_float(ocr_inputs.get("total_amount"), 0.0),
            "issue_date": ocr_inputs.get("issue_date", "N/A"),
            "review_value": _safe_float(ocr_inputs.get("total_amount"), 0.0),
        },
    )
