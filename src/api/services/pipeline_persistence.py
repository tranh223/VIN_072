from __future__ import annotations

from datetime import datetime, timezone
import os
from pathlib import Path
from typing import Any, Optional

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient


_PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _num(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, "", "N/A"):
            return default
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def _parse_date(value: Any) -> Optional[datetime]:
    if not value or value == "N/A":
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            dt = datetime.strptime(text, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


def _period(value: Any) -> tuple[int, int]:
    now = datetime.now(timezone.utc)
    if not value or value == "N/A":
        return now.month, now.year
    text = str(value).strip()
    for sep in ("-", "/", "."):
        if sep not in text:
            continue
        parts = [p.strip() for p in text.split(sep) if p.strip()]
        if len(parts) < 2:
            continue
        try:
            first = int(parts[0])
            second = int(parts[1])
        except ValueError:
            continue
        if first > 31:
            return max(1, min(12, second)), first
        return max(1, min(12, first)), second
    return now.month, now.year


def _object_id(value: str, field_name: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise ValueError(f"{field_name} is not a valid ObjectId.")
    return ObjectId(value)


def _summary_sum(summary: dict[str, Any], field: str, records: list[dict[str, Any]]) -> float:
    field_summary = summary.get(field) if isinstance(summary.get(field), dict) else {}
    if "sum" in field_summary:
        return _num(field_summary.get("sum"))
    return sum(_num(record.get(field)) for record in records)


def _is_pdf_path(value: Optional[str]) -> bool:
    return bool(value and str(value).lower().endswith(".pdf"))


def _valid_period_month(value: Any) -> Optional[int]:
    try:
        m = int(value)
        if 1 <= m <= 12:
            return m
    except (TypeError, ValueError):
        pass
    return None


def _valid_period_year(value: Any) -> Optional[int]:
    try:
        y = int(value)
        if 2000 <= y <= 2100:
            return y
    except (TypeError, ValueError):
        pass
    return None


def _database():
    load_dotenv(_PROJECT_ROOT / ".env")
    load_dotenv()
    uri = os.getenv("MONGO_URI", "").strip()
    name = os.getenv("MONGO_DB_NAME", "").strip()
    if not uri:
        raise RuntimeError("Missing MONGO_URI in environment")
    if not name:
        raise RuntimeError("Missing MONGO_DB_NAME in environment")
    return MongoClient(uri, serverSelectionTimeoutMS=5000)[name]


def persist_pipeline_result(
    *,
    job_id: str,
    user_id: str,
    store_id: str,
    store: dict[str, Any],
    result: dict[str, Any],
    csv_url: Optional[str],
    invoice_url: Optional[str],
    invoice_path: Optional[str] = None,
    period_month_override: Optional[int] = None,
    period_year_override: Optional[int] = None,
    upload_kind: Optional[str] = None,
    evidence_category: Optional[str] = None,
) -> dict[str, list[str]]:
    db = _database()
    now = datetime.now(timezone.utc)
    store_oid = _object_id(store_id, "store_id")
    user_oid = _object_id(user_id, "user_id")

    inserted: dict[str, list[str]] = {
        "revenue_reports": [],
        "tax_deduction_documents": [],
        "tax_estimations": [],
        "audit_logs": [],
    }

    pm_ov = _valid_period_month(period_month_override)
    py_ov = _valid_period_year(period_year_override)
    user_ctx = {
        "period_month": pm_ov,
        "period_year": py_ov,
        "upload_kind": upload_kind,
        "evidence_category": evidence_category,
    }

    csv_result = result.get("csv_result") or {}
    csv_data = csv_result.get("data") if isinstance(csv_result.get("data"), dict) else {}
    records = csv_data.get("records") if isinstance(csv_data.get("records"), list) else []
    first_month, first_year = _period(records[0].get("period") if records else None)
    if pm_ov is not None:
        first_month = pm_ov
    if py_ov is not None:
        first_year = py_ov
    platform = store.get("platform") if isinstance(store.get("platform"), dict) else {}
    default_platform = platform.get("name") or platform.get("code")

    if csv_url and csv_data:
        summary = csv_data.get("summary") if isinstance(csv_data.get("summary"), dict) else {}
        first_record = records[0] if records else {}
        month, year = _period(first_record.get("period"))
        if pm_ov is not None:
            month = pm_ov
        if py_ov is not None:
            year = py_ov
        revenue_raw = _summary_sum(summary, "revenue_raw", records)
        if revenue_raw == 0.0:
            revenue_raw = _summary_sum(summary, "revenue", records)
        doc = {
            "store_id": store_oid,
            "month": month,
            "year": year,
            "platform_name": (
                first_record.get("platform_name")
                if first_record.get("platform_name") not in (None, "", "N/A")
                else default_platform
            ),
            "revenue_raw": revenue_raw,
            "net_revenue": revenue_raw,
            "taxable_revenue": max(revenue_raw, 0),
            "source_csv_url": csv_url,
            "raw_data": {
                "job_id": job_id,
                "records": records,
                "csv_result": csv_result,
                "user_upload_context": user_ctx,
            },
            "created_at": now,
        }
        res = db.revenue_reports.insert_one(doc)
        inserted["revenue_reports"].append(str(res.inserted_id))

    ocr_result = result.get("ocr_result") or {}
    ocr_data = ocr_result.get("data") if isinstance(ocr_result.get("data"), dict) else {}
    if invoice_url and _is_pdf_path(invoice_path):
        issue_date = _parse_date(ocr_data.get("issue_date") or ocr_data.get("date"))
        tax_year = issue_date.year if issue_date else first_year
        if py_ov is not None and issue_date is None:
            tax_year = py_ov
        document_amount = _num(ocr_data.get("amount") or ocr_data.get("revenue") or ocr_data.get("subtotal"))
        doc = {
            "store_id": store_oid,
            "tax_year": tax_year,
            "document_number": ocr_data.get("document_no") or ocr_data.get("invoice_number"),
            "document_category": ocr_data.get("document_category") or "unknown",
            "document_type": ocr_data.get("document_type") or "N/A",
            "issuer_name": ocr_data.get("issuer_name") or ocr_data.get("seller_name") or ocr_data.get("vendor"),
            "seller_name": ocr_data.get("seller_name") or ocr_data.get("issuer_name") or ocr_data.get("vendor"),
            "seller_tax_code": ocr_data.get("seller_tax_code") or ocr_data.get("issuer_tax_code") or ocr_data.get("vendor_tax_code"),
            "counterparty": ocr_data.get("counterparty"),
            "order_id": ocr_data.get("order_id"),
            "issue_date": issue_date,
            "document_amount": document_amount,
            "total_revenue_on_document": document_amount,
            "deducted_tax_amount": document_amount,
            "pdf_url": invoice_url,
            "document_url": invoice_url,
            "parsed_json": {
                "job_id": job_id,
                "ocr_result": ocr_result,
                "user_upload_context": user_ctx,
            },
            "created_at": now,
        }
        res = db.tax_deduction_documents.insert_one(doc)
        inserted["tax_deduction_documents"].append(str(res.inserted_id))

    elif invoice_url and invoice_path and not _is_pdf_path(invoice_path):
        issue_date = _parse_date(ocr_data.get("issue_date") or ocr_data.get("date"))
        tax_year = issue_date.year if issue_date else first_year
        if py_ov is not None and issue_date is None:
            tax_year = py_ov
        doc = {
            "store_id": store_oid,
            "tax_year": tax_year,
            "document_number": ocr_data.get("document_no") or ocr_data.get("invoice_number"),
            "document_category": ocr_data.get("document_category") or "unknown",
            "document_type": ocr_data.get("document_type") or "N/A",
            "issuer_name": ocr_data.get("issuer_name") or ocr_data.get("seller_name") or ocr_data.get("vendor"),
            "seller_name": ocr_data.get("seller_name") or ocr_data.get("issuer_name") or ocr_data.get("vendor"),
            "seller_tax_code": ocr_data.get("seller_tax_code") or ocr_data.get("issuer_tax_code") or ocr_data.get("vendor_tax_code"),
            "counterparty": ocr_data.get("counterparty"),
            "order_id": ocr_data.get("order_id"),
            "issue_date": issue_date,
            "document_amount": _num(ocr_data.get("amount") or ocr_data.get("revenue") or ocr_data.get("subtotal")),
            "total_revenue_on_document": _num(ocr_data.get("revenue") or ocr_data.get("subtotal")),
            "deducted_tax_amount": _num(ocr_data.get("amount") or ocr_data.get("revenue") or ocr_data.get("subtotal")),
            "image_url": invoice_url,
            "document_url": invoice_url,
            "parsed_json": {
                "job_id": job_id,
                "ocr_result": ocr_result,
                "user_upload_context": user_ctx,
            },
            "created_at": now,
        }
        res = db.tax_deduction_documents.insert_one(doc)
        inserted["tax_deduction_documents"].append(str(res.inserted_id))

    tax_result = result.get("tax_result") or {}
    if tax_result:
        estimated_tax = _num(tax_result.get("gtgt_due")) + _num(tax_result.get("tncn_due"))
        deducted_tax = 0.0
        payable_tax = _num(tax_result.get("total_tax_due"))
        doc = {
            "store_id": store_oid,
            "period_type": "month",
            "month": first_month,
            "quarter": None,
            "year": first_year,
            "total_revenue": _num(tax_result.get("net_revenue")),
            "estimated_tax": estimated_tax,
            "deducted_tax_amount": deducted_tax,
            "payable_tax": payable_tax,
            "difference_amount": estimated_tax - deducted_tax - payable_tax,
            "calculation_detail": {
                "job_id": job_id,
                "tax_result": tax_result,
                "dashboard": result.get("dashboard") or {},
                "alerts": result.get("alerts") or [],
                "alert_explanations": result.get("alert_explanations") or [],
                "llm_report": result.get("llm_report"),
            },
            "created_at": now,
        }
        res = db.tax_estimations.insert_one(doc)
        inserted["tax_estimations"].append(str(res.inserted_id))

    audit_doc = {
        "actor_id": user_oid,
        "action": "upload_processed",
        "entity_type": "upload_job",
        "entity_id": None,
        "old_value": None,
        "new_value": {
            "job_id": job_id,
            "store_id": store_id,
            "csv_url": csv_url,
            "invoice_url": invoice_url,
            "inserted": inserted,
            "upload_context": user_ctx,
        },
        "created_at": now,
    }
    res = db.audit_logs.insert_one(audit_doc)
    inserted["audit_logs"].append(str(res.inserted_id))

    return inserted
