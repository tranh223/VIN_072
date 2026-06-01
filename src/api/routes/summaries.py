"""API tổng hợp tuân thủ / cuối năm — đọc từ DB (tax_estimations, …) cho dashboard.

Chỉ mang tính tham khảo (ước tính nội bộ), không thay cho kê khai hoặc báo cáo chính thức.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ...compliance_score import compliance_ui_band, compute_compliance_score
from ...dossier_evidence import (
    evidence_checklist_meta,
    evidence_months_covered,
    evidence_requirement_met,
    filter_valid_evidence,
)
from ..db import get_database, serialize_mongo

router = APIRouter()


class ComplianceSummaryResponse(BaseModel):
    has_data: bool
    score: int | None
    label: str | None
    compliance_band: str | None = None
    compliance_penalties: dict[str, Any] | None = None
    metrics: list[dict[str, Any]]
    latest_estimation: dict[str, Any] | None
    alerts_count: int
    total_revenue: float = 0
    payable_tax: float = 0
    deducted_tax_amount: float = 0
    difference_amount: float = 0
    trend: list[dict[str, Any]] = []
    missing_supporting_evidence: bool = False


class YearEndSummaryResponse(BaseModel):
    has_data: bool
    year: int | None
    total_revenue: float
    deducted_tax_amount: float
    payable_tax: float
    completed_reports: int
    total_reports: int
    readiness_score: int
    is_ready: bool = False
    readiness_label_vi: str | None = None
    checklist: list[dict[str, Any]]
    latest_document: dict[str, Any] | None


def _score_label(score: int | None) -> str | None:
    """Nhãn theo compliance_score_spec_v1 mục 5 (ngưỡng 85 / 70)."""
    if score is None:
        return None
    if score >= 85:
        return "Ổn định"
    if score >= 70:
        return "Cần theo dõi"
    return "Cần xử lý"


async def _days_since_last_upload(db: Any, store_ids: list[ObjectId] | None) -> int:
    doc = await db.tax_estimations.find_one(
        _with_store_filter({}, store_ids),
        sort=[("created_at", -1)],
    )
    if not doc or not doc.get("created_at"):
        return 0
    ts: datetime = doc["created_at"]
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - ts
    return max(0, delta.days)


async def _correction_count_last_30d(db: Any, user_id: str) -> int:
    """Tạm dùng audit_logs nếu có action liên quan chỉnh sửa; mặc định 0."""
    if not ObjectId.is_valid(user_id):
        return 0
    since = datetime.now(timezone.utc) - timedelta(days=30)
    n = await db.audit_logs.count_documents(
        {
            "actor_id": ObjectId(user_id),
            "created_at": {"$gte": since},
            "action": {"$regex": "correct", "$options": "i"},
        }
    )
    return int(n)


async def _store_ids_for_user(user_id: str | None, store_id: str | None = None) -> list[ObjectId] | None:
    if not user_id:
        return None
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="user_id khong hop le.")
    db = get_database()
    if store_id:
        if not ObjectId.is_valid(store_id):
            raise HTTPException(status_code=400, detail="store_id khong hop le.")
        store_oid = ObjectId(store_id)
        doc = await db.stores.find_one({"_id": store_oid, "user_id": ObjectId(user_id)}, {"_id": 1})
        if not doc:
            raise HTTPException(status_code=404, detail="Khong tim thay shop.")
        return [store_oid]
    docs = await db.stores.find({"user_id": ObjectId(user_id)}, {"_id": 1}).to_list(length=500)
    return [doc["_id"] for doc in docs]


def _with_store_filter(query: dict[str, Any], store_ids: list[ObjectId] | None) -> dict[str, Any]:
    if store_ids is None:
        return query
    return {**query, "store_id": {"$in": store_ids}}


def _infer_missing_supporting_evidence(detail: dict[str, Any], doc: dict[str, Any]) -> bool:
    """Suy ra thiếu chứng từ từ compliance_inputs hoặc ocr_ref đã lưu."""
    dash = detail.get("dashboard") if isinstance(detail.get("dashboard"), dict) else {}
    ci = dash.get("compliance_inputs") if isinstance(dash.get("compliance_inputs"), dict) else {}
    if "missing_supporting_evidence" in ci:
        return bool(ci.get("missing_supporting_evidence"))
    tr = detail.get("tax_result") if isinstance(detail.get("tax_result"), dict) else {}
    inner = tr.get("tax_result") if isinstance(tr.get("tax_result"), dict) else {}
    revenue = float(
        doc.get("total_revenue")
        or inner.get("net_revenue")
        or tr.get("net_revenue")
        or 0
    )
    if revenue <= 0:
        return False
    return not tr.get("ocr_ref")


async def _latest_year(store_ids: list[ObjectId] | None = None) -> int | None:
    db = get_database()
    for collection, field in (
        ("tax_estimations", "year"),
        ("revenue_reports", "year"),
        ("tax_deduction_documents", "tax_year"),
    ):
        doc = await db[collection].find_one(
            _with_store_filter({field: {"$ne": None}}, store_ids),
            sort=[(field, -1)],
        )
        if doc and doc.get(field):
            return int(doc[field])
    return None


def _parse_period_value(value: Any) -> tuple[int | None, int | None]:
    if not value:
        return None, None
    text = str(value).strip()
    for sep in ("-", "/", "."):
        if sep not in text:
            continue
        parts = [p.strip() for p in text.split(sep) if p.strip()]
        if len(parts) < 2:
            continue
        try:
            first, second = int(parts[0]), int(parts[1])
        except ValueError:
            continue
        if first > 31:
            return max(1, min(12, second)), first
        return max(1, min(12, first)), second
    return None, None


def _coerce_month_year(doc: dict[str, Any]) -> tuple[int | None, int | None]:
    """Suy ra tháng/năm từ field chuẩn, period CSV, user_upload_context hoặc created_at."""
    m, y = doc.get("month"), doc.get("year") or doc.get("tax_year")
    if m is not None and y is not None:
        return int(m), int(y)
    raw = doc.get("raw_data") if isinstance(doc.get("raw_data"), dict) else {}
    records = raw.get("records") if isinstance(raw.get("records"), list) else []
    if records and isinstance(records[0], dict):
        pm, py = _parse_period_value(records[0].get("period"))
        if pm and py:
            return pm, py
    parsed = doc.get("parsed_json") if isinstance(doc.get("parsed_json"), dict) else {}
    uctx = parsed.get("user_upload_context")
    if not isinstance(uctx, dict):
        detail = doc.get("calculation_detail") if isinstance(doc.get("calculation_detail"), dict) else {}
        uctx = detail.get("user_upload_context")
    if isinstance(uctx, dict):
        pm, py = uctx.get("period_month"), uctx.get("period_year")
        if pm is not None and py is not None:
            return int(pm), int(py)
    created = doc.get("created_at")
    if isinstance(created, datetime):
        return created.month, created.year
    return None, None


def _revenue_from_report(doc: dict[str, Any]) -> float:
    return float(
        doc.get("net_revenue")
        or doc.get("taxable_revenue")
        or doc.get("revenue_raw")
        or 0
    )


def _revenue_from_estimation(doc: dict[str, Any]) -> float:
    direct = float(doc.get("total_revenue") or 0)
    if direct > 0:
        return direct
    detail = doc.get("calculation_detail") if isinstance(doc.get("calculation_detail"), dict) else {}
    tr = detail.get("tax_result") if isinstance(detail.get("tax_result"), dict) else {}
    inner = tr.get("tax_result") if isinstance(tr.get("tax_result"), dict) else {}
    return float(tr.get("net_revenue") or inner.get("net_revenue") or 0)


def _is_newer_row(candidate: dict[str, Any], previous: dict[str, Any] | None) -> bool:
    if not previous:
        return True
    c_at = candidate.get("created_at")
    p_at = previous.get("created_at")
    if c_at is None:
        return False
    if p_at is None:
        return True
    return c_at >= p_at


async def _build_monthly_trend(
    db: Any,
    store_ids: list[ObjectId],
    trend_year: int,
) -> list[dict[str, Any]]:
    """
    Xu hướng doanh thu theo tháng (01–12).
    Ưu tiên revenue_reports (CSV); bổ sung tax_estimations khi chưa có doanh thu.
    """
    latest_rev: dict[tuple[Any, int, int], dict[str, Any]] = {}
    rev_rows = await db.revenue_reports.find(_with_store_filter({}, store_ids)).to_list(length=5000)
    for row in rev_rows:
        month, yr = _coerce_month_year(row)
        if month is None or yr is None or int(yr) != int(trend_year):
            continue
        key = (row.get("store_id"), int(yr), int(month))
        if _is_newer_row(row, latest_rev.get(key)):
            latest_rev[key] = row

    latest_tax: dict[tuple[Any, int, int], dict[str, Any]] = {}
    tax_rows = await db.tax_estimations.find(_with_store_filter({}, store_ids)).to_list(length=5000)
    for row in tax_rows:
        month, yr = _coerce_month_year(row)
        if month is None or yr is None or int(yr) != int(trend_year):
            continue
        key = (row.get("store_id"), int(yr), int(month))
        if _is_newer_row(row, latest_tax.get(key)):
            latest_tax[key] = row

    by_month: dict[int, dict[str, float]] = {}
    for (_, _y, month), row in latest_rev.items():
        m = int(month)
        slot = by_month.setdefault(m, {"total_revenue": 0.0, "payable_tax": 0.0, "alerts_count": 0.0})
        slot["total_revenue"] += _revenue_from_report(row)

    for (_, _y, month), row in latest_tax.items():
        m = int(month)
        slot = by_month.setdefault(m, {"total_revenue": 0.0, "payable_tax": 0.0, "alerts_count": 0.0})
        if slot["total_revenue"] <= 0:
            slot["total_revenue"] += _revenue_from_estimation(row)
        slot["payable_tax"] += float(row.get("payable_tax") or 0)
        detail = row.get("calculation_detail") if isinstance(row.get("calculation_detail"), dict) else {}
        alerts = detail.get("alerts") if isinstance(detail.get("alerts"), list) else []
        slot["alerts_count"] += float(len(alerts))

    return [
        {
            "year": trend_year,
            "month": m,
            "period": f"{m:02d}/{trend_year}",
            "total_revenue": by_month.get(m, {}).get("total_revenue", 0.0),
            "payable_tax": by_month.get(m, {}).get("payable_tax", 0.0),
            "alerts_count": int(by_month.get(m, {}).get("alerts_count", 0)),
        }
        for m in range(1, 13)
    ]


@router.get("/compliance/summary", response_model=ComplianceSummaryResponse)
async def compliance_summary(
    user_id: str | None = Query(None),
    store_id: str | None = Query(None),
    year: int | None = Query(None, ge=2000, le=2100),
    month: int | None = Query(None, ge=1, le=12),
):
    """Tổng hợp điểm tuân thủ và chỉ số từ các bản ghi ước tính thuế gần nhất."""
    db = get_database()
    try:
        if not user_id:
            return {
                "has_data": False,
                "score": None,
                "label": None,
                "compliance_band": None,
                "compliance_penalties": None,
                "metrics": [],
                "latest_estimation": None,
                "alerts_count": 0,
                "total_revenue": 0,
                "payable_tax": 0,
                "deducted_tax_amount": 0,
                "difference_amount": 0,
                "trend": [],
            }
        store_ids = await _store_ids_for_user(user_id, store_id)
        query = _with_store_filter({}, store_ids)
        period_filter = year is not None and month is not None
        period_query = (
            _with_store_filter({"year": year, "month": month}, store_ids) if period_filter else query
        )

        if period_filter:
            latest = await db.tax_estimations.find_one(period_query, sort=[("created_at", -1)])
            if not latest:
                rev = await db.revenue_reports.find_one(period_query, sort=[("created_at", -1)])
                if rev:
                    latest = {
                        "total_revenue": float(
                            rev.get("net_revenue")
                            or rev.get("taxable_revenue")
                            or rev.get("revenue_raw")
                            or 0
                        ),
                        "payable_tax": 0.0,
                        "deducted_tax_amount": 0.0,
                        "difference_amount": 0.0,
                        "year": year,
                        "month": month,
                        "calculation_detail": {"dashboard": {}, "alerts": []},
                    }
            docs = await db.tax_estimations.find(period_query).to_list(length=50)
            if not docs and latest:
                docs = [latest]
            if not latest:
                return {
                    "has_data": False,
                    "score": None,
                    "label": None,
                    "compliance_band": None,
                    "compliance_penalties": None,
                    "metrics": [],
                    "latest_estimation": None,
                    "alerts_count": 0,
                    "total_revenue": 0,
                    "payable_tax": 0,
                    "deducted_tax_amount": 0,
                    "difference_amount": 0,
                    "trend": [],
                }
        else:
            latest = await db.tax_estimations.find_one(query, sort=[("created_at", -1)])
            latest_by_store = await db.tax_estimations.aggregate(
                [
                    {"$match": query},
                    {"$sort": {"created_at": -1}},
                    {"$group": {"_id": "$store_id", "doc": {"$first": "$$ROOT"}}},
                ]
            ).to_list(length=500)
            if not latest or not latest_by_store:
                return {
                    "has_data": False,
                    "score": None,
                    "label": None,
                    "compliance_band": None,
                    "compliance_penalties": None,
                    "metrics": [],
                    "latest_estimation": None,
                    "alerts_count": 0,
                    "total_revenue": 0,
                    "payable_tax": 0,
                    "deducted_tax_amount": 0,
                    "difference_amount": 0,
                    "trend": [],
                }
            docs = [item["doc"] for item in latest_by_store if isinstance(item.get("doc"), dict)]
        total_revenue = sum(float(doc.get("total_revenue") or 0) for doc in docs)
        payable_tax = sum(float(doc.get("payable_tax") or 0) for doc in docs)
        difference = sum(abs(float(doc.get("difference_amount") or 0)) for doc in docs)
        deducted = sum(float(doc.get("deducted_tax_amount") or 0) for doc in docs)
        alerts_count = 0
        for doc in docs:
            detail = doc.get("calculation_detail") if isinstance(doc.get("calculation_detail"), dict) else {}
            alerts = detail.get("alerts") if isinstance(detail.get("alerts"), list) else []
            alerts_count += len(alerts)

        fresh_days = await _days_since_last_upload(db, store_ids)
        corr_n = await _correction_count_last_30d(db, user_id)

        store_scores: list[int] = []
        merged_penalties: dict[str, float] = {
            "data": 0.0,
            "evidence": 0.0,
            "reconciliation": 0.0,
            "threshold": 0.0,
            "correction": 0.0,
            "freshness": 0.0,
            "total": 0.0,
        }
        missing_evidence_any = False
        for doc in docs:
            detail = doc.get("calculation_detail") if isinstance(doc.get("calculation_detail"), dict) else {}
            dash = detail.get("dashboard") if isinstance(detail.get("dashboard"), dict) else {}
            tr = detail.get("tax_result") if isinstance(detail.get("tax_result"), dict) else {}
            ci = dash.get("compliance_inputs") if isinstance(dash.get("compliance_inputs"), dict) else {}
            annual = float(ci.get("annualized_revenue") or tr.get("annualized_revenue") or 0)
            missing_evidence = _infer_missing_supporting_evidence(detail, doc)
            if missing_evidence:
                missing_evidence_any = True
            if ci:
                c = compute_compliance_score(
                    missing_required_fields=int(ci.get("missing_required_fields", 0)),
                    vlm_needs_confirmation=bool(ci.get("vlm_needs_confirmation")),
                    discrepancy_ratio=float(ci.get("discrepancy_ratio", 0)),
                    annualized_revenue=annual,
                    correction_count_last_30d=corr_n,
                    days_since_last_upload=fresh_days,
                    missing_supporting_evidence=missing_evidence,
                )
            else:
                c = compute_compliance_score(
                    missing_required_fields=2,
                    vlm_needs_confirmation=False,
                    discrepancy_ratio=0.0,
                    annualized_revenue=annual,
                    correction_count_last_30d=corr_n,
                    days_since_last_upload=fresh_days,
                    missing_supporting_evidence=missing_evidence,
                )
            store_scores.append(int(c["score"]))
            pens = c.get("penalties") or {}
            for k, v in pens.items():
                if k in merged_penalties:
                    merged_penalties[k] += float(v)

        if store_ids:
            target_year = await _latest_year(store_ids)
            if target_year:
                rev_rows = await db.revenue_reports.find(
                    _with_store_filter({"year": target_year}, store_ids),
                    {"month": 1},
                ).to_list(length=5000)
                revenue_months = {
                    int(r["month"]) for r in rev_rows if r.get("month") is not None
                }
                ded_rows = await db.tax_deduction_documents.find(
                    _with_store_filter({"tax_year": target_year}, store_ids)
                ).to_list(length=500)
                valid_ded = filter_valid_evidence(ded_rows)
                needs_evidence = bool(revenue_months) and not evidence_requirement_met(
                    valid_ded, revenue_months, tax_year=target_year
                )
                if needs_evidence:
                    missing_evidence_any = True
                    extra = compute_compliance_score(
                        missing_required_fields=0,
                        vlm_needs_confirmation=False,
                        discrepancy_ratio=0.0,
                        annualized_revenue=0.0,
                        correction_count_last_30d=corr_n,
                        days_since_last_upload=fresh_days,
                        missing_supporting_evidence=True,
                    )
                    if store_scores:
                        store_scores = [min(s, int(extra["score"])) for s in store_scores]
                    else:
                        store_scores.append(int(extra["score"]))
                    merged_penalties["evidence"] = max(
                        merged_penalties.get("evidence", 0),
                        float((extra.get("penalties") or {}).get("evidence", 20)),
                    )

        n_stores = max(1, len(store_scores))
        for k in list(merged_penalties.keys()):
            merged_penalties[k] = round(merged_penalties[k] / n_stores, 2)
        score = round(sum(store_scores) / n_stores) if store_scores else 0
        band = compliance_ui_band(score)
        threshold_pct = min(100, round((total_revenue / 1_000_000_000) * 100)) if total_revenue else 0
        difference_pct = min(100, round((difference / max(payable_tax, 1)) * 100)) if payable_tax else 0
        deduction_pct = min(100, round((deducted / max(payable_tax + deducted, 1)) * 100))
        trend_year = year if year is not None else await _latest_year(store_ids)
        if trend_year is None:
            trend_year = datetime.now(timezone.utc).year
        trend = await _build_monthly_trend(db, store_ids, int(trend_year))

        return {
            "has_data": True,
            "score": score,
            "label": _score_label(score),
            "compliance_band": band,
            "compliance_penalties": merged_penalties,
            "metrics": [
                {"label": "Điểm trừ do dữ liệu thiếu", "value": int(merged_penalties.get("data", 0))},
                {"label": "Điểm trừ do thiếu chứng từ (PDF/ảnh)", "value": int(merged_penalties.get("evidence", 0))},
                {"label": "Điểm trừ do dữ liệu lệch", "value": int(merged_penalties.get("reconciliation", 0))},
                {"label": "Điểm trừ do gần ngưỡng", "value": int(merged_penalties.get("threshold", 0))},
                {
                    "label": "Điểm trừ do sửa nhiều lần và dữ liệu chưa cập nhật",
                    "value": int(merged_penalties.get("correction", 0) + merged_penalties.get("freshness", 0)),
                },
                {"label": "Mức hiện tại so với ngưỡng 1 tỷ", "value": threshold_pct},
                {"label": "Mức chênh lệch số liệu ước tính (%)", "value": difference_pct},
                {
                    "label": "Tỷ lệ thuế tham khảo (chứng cứ) trong tổng thuế ước tính (%)",
                    "value": deduction_pct,
                },
            ],
            "latest_estimation": serialize_mongo(latest),
            "alerts_count": alerts_count,
            "total_revenue": total_revenue,
            "payable_tax": payable_tax,
            "deducted_tax_amount": deducted,
            "difference_amount": difference,
            "trend": trend,
            "missing_supporting_evidence": missing_evidence_any,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.get("/year-end/summary", response_model=YearEndSummaryResponse)
async def year_end_summary(
    year: int | None = Query(None, ge=2000, le=2100),
    user_id: str | None = Query(None),
    store_id: str | None = Query(None),
):
    """Checklist cuối năm và số liệu gộp từ DB (không phải báo cáo quyết toán đã nộp)."""
    db = get_database()
    try:
        if not user_id:
            return {
                "has_data": False,
                "year": None,
                "total_revenue": 0,
                "deducted_tax_amount": 0,
                "payable_tax": 0,
                "completed_reports": 0,
                "total_reports": 0,
                "readiness_score": 0,
                "checklist": [],
                "latest_document": None,
            }
        store_ids = await _store_ids_for_user(user_id, store_id)
        target_year = year or await _latest_year(store_ids)
        if target_year is None:
            return {
                "has_data": False,
                "year": None,
                "total_revenue": 0,
                "deducted_tax_amount": 0,
                "payable_tax": 0,
                "completed_reports": 0,
                "total_reports": 0,
                "readiness_score": 0,
                "checklist": [],
                "latest_document": None,
            }

        revenue_docs = await db.revenue_reports.find(
            _with_store_filter({"year": target_year}, store_ids)
        ).to_list(length=500)
        tax_docs = await db.tax_estimations.find(
            _with_store_filter({"year": target_year}, store_ids)
        ).to_list(length=200)
        deduction_docs = await db.tax_deduction_documents.find(
            _with_store_filter({"tax_year": target_year}, store_ids)
        ).to_list(length=200)
        valid_deduction_docs = filter_valid_evidence(deduction_docs)
        latest_doc = None
        for cand in sorted(
            valid_deduction_docs,
            key=lambda d: d.get("created_at") or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        ):
            latest_doc = cand
            break
        if latest_doc is None:
            latest_doc = await db.tax_deduction_documents.find_one(
                _with_store_filter({"tax_year": target_year}, store_ids),
                sort=[("created_at", -1)],
            )

        total_revenue = sum(float(doc.get("net_revenue") or doc.get("taxable_revenue") or doc.get("revenue_raw") or 0) for doc in revenue_docs)
        deducted_tax = sum(
            float(doc.get("deducted_tax_amount") or doc.get("document_amount") or 0)
            for doc in valid_deduction_docs
        )
        payable_tax = sum(float(doc.get("payable_tax") or 0) for doc in tax_docs)
        months = {int(doc["month"]) for doc in revenue_docs if doc.get("month")}
        missing_months = sorted({m for m in range(1, 13)} - months)
        has_estimation = bool(tax_docs)
        evidence_covered, evidence_required = evidence_months_covered(
            valid_deduction_docs, months, tax_year=target_year
        )
        has_evidence_full = evidence_requirement_met(
            valid_deduction_docs, months, tax_year=target_year
        )

        checklist = [
            {
                "title": f"Đã đối soát {len(months)}/12 kỳ",
                "sub": "Theo dữ liệu doanh thu đã tải lên",
                "meta": (
                    f"Thiếu: {', '.join(f'T{m:02d}' for m in missing_months)}"
                    if missing_months
                    else f"Đủ 12 tháng — năm {target_year}"
                ),
                "done": len(months) >= 12,
            },
            {
                "title": "Đã có ước tính thuế",
                "sub": "Đã có kết quả ước tính từ các kỳ đã xử lý",
                "meta": f"{len(tax_docs)} bản ghi" if has_estimation else "Chưa có ước tính thuế",
                "done": has_estimation,
            },
            {
                "title": "Đã có chứng từ giao dịch",
                "sub": "Ảnh/PDF chứng từ gắn đủ các kỳ đã có doanh thu",
                "meta": evidence_checklist_meta(
                    len(valid_deduction_docs),
                    evidence_covered,
                    evidence_required or len(months),
                ),
                "done": has_evidence_full,
            },
        ]
        completed = sum(1 for item in checklist if item.get("done"))
        total = len(checklist)
        readiness = round((completed / total) * 100) if total else 0
        is_ready = completed == total and total > 0
        if not is_ready:
            if not has_evidence_full and bool(revenue_docs):
                if len(valid_deduction_docs) > 0:
                    readiness_label_vi = (
                        f"Chưa sẵn sàng — chứng từ mới phủ {evidence_covered}/{evidence_required} kỳ"
                    )
                else:
                    readiness_label_vi = "Chưa sẵn sàng — thiếu chứng từ PDF/ảnh"
            elif missing_months:
                readiness_label_vi = "Chưa sẵn sàng — thiếu kỳ doanh thu"
            else:
                readiness_label_vi = "Chưa sẵn sàng quyết toán"
        else:
            readiness_label_vi = "Sẵn sàng chốt năm"

        return {
            "has_data": bool(revenue_docs or tax_docs or deduction_docs),
            "year": target_year,
            "total_revenue": total_revenue,
            "deducted_tax_amount": deducted_tax,
            "payable_tax": payable_tax,
            "completed_reports": completed,
            "total_reports": total,
            "readiness_score": readiness,
            "is_ready": is_ready,
            "readiness_label_vi": readiness_label_vi,
            "checklist": checklist,
            "latest_document": serialize_mongo(latest_doc) if latest_doc else None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
