from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field

from ...dossier_evidence import (
    evidence_months_covered,
    evidence_requirement_met,
    filter_valid_evidence,
    is_valid_transaction_evidence,
)
from ..db import get_database, serialize_mongo
from ..services.rag_client import schedule_private_ingest

router = APIRouter()


class StoresResponse(BaseModel):
    stores: list[dict[str, Any]]


class PlatformsResponse(BaseModel):
    platforms: list[dict[str, Any]]


class CreateStoreRequest(BaseModel):
    user_id: str | None = None
    platform_code: str = Field(min_length=1, max_length=40)
    platform_name: str = Field(min_length=1, max_length=80)
    store_name: str = Field(min_length=1, max_length=160)
    store_code: str = Field(min_length=1, max_length=80)
    tax_code: str | None = Field(default=None, max_length=40)
    business_type: str = Field(default="individual", pattern="^(individual|company)$")


class StoreResponse(BaseModel):
    store: dict[str, Any]


def _platform_name(store: dict[str, Any], platform: dict[str, Any] | None) -> str | None:
    embedded = store.get("platform")
    if isinstance(embedded, dict):
        name = embedded.get("name") or embedded.get("code")
        if name:
            return str(name)
    if platform:
        name = platform.get("name") or platform.get("code")
        if name:
            return str(name)
    return None


def _platform_code(store: dict[str, Any], platform: dict[str, Any] | None) -> str | None:
    embedded = store.get("platform")
    if isinstance(embedded, dict) and embedded.get("code"):
        return str(embedded["code"])
    if platform and platform.get("code"):
        return str(platform["code"])
    return None


def _period(report: dict[str, Any] | None) -> str | None:
    if not report:
        return None
    month = report.get("month")
    year = report.get("year")
    if month and year:
        return f"{int(month):02d}/{int(year)}"
    return None


async def _dossier_year_for_stores(db: Any, store_ids: list[ObjectId]) -> int:
    for collection, field in (
        ("revenue_reports", "year"),
        ("tax_estimations", "year"),
        ("tax_deduction_documents", "tax_year"),
    ):
        doc = await db[collection].find_one(
            {"store_id": {"$in": store_ids}, field: {"$ne": None}},
            sort=[(field, -1)],
        )
        if doc and doc.get(field):
            return int(doc[field])
    return datetime.now(timezone.utc).year


async def _dossier_maps(
    db: Any, store_ids: list[ObjectId], target_year: int
) -> dict[ObjectId, dict[str, Any]]:
    """Tổng hợp kỳ doanh thu / chứng từ theo shop — cùng tiêu chí checklist cuối năm."""
    if not store_ids:
        return {}

    revenue_by_store: dict[ObjectId, set[int]] = {sid: set() for sid in store_ids}
    rev_rows = await db.revenue_reports.find(
        {"store_id": {"$in": store_ids}, "year": target_year},
        {"store_id": 1, "month": 1},
    ).to_list(length=5000)
    for row in rev_rows:
        sid = row.get("store_id")
        month = row.get("month")
        if isinstance(sid, ObjectId) and month:
            revenue_by_store.setdefault(sid, set()).add(int(month))

    estimation_counts: dict[ObjectId, int] = {sid: 0 for sid in store_ids}
    est_rows = await db.tax_estimations.aggregate(
        [
            {"$match": {"store_id": {"$in": store_ids}, "year": target_year}},
            {"$group": {"_id": "$store_id", "count": {"$sum": 1}}},
        ]
    ).to_list(length=len(store_ids))
    for row in est_rows:
        if isinstance(row.get("_id"), ObjectId):
            estimation_counts[row["_id"]] = int(row.get("count") or 0)

    valid_docs_by_store: dict[ObjectId, list[dict[str, Any]]] = {sid: [] for sid in store_ids}
    ded_rows = await db.tax_deduction_documents.find(
        {"store_id": {"$in": store_ids}, "tax_year": target_year}
    ).to_list(length=5000)
    for row in ded_rows:
        sid = row.get("store_id")
        if isinstance(sid, ObjectId) and is_valid_transaction_evidence(row):
            valid_docs_by_store.setdefault(sid, []).append(row)

    out: dict[ObjectId, dict[str, Any]] = {}
    for sid in store_ids:
        months_set = revenue_by_store.get(sid, set())
        months = sorted(months_set)
        missing = [m for m in range(1, 13) if m not in months_set]
        valid_docs = valid_docs_by_store.get(sid, [])
        covered, required = evidence_months_covered(
            valid_docs, months_set, tax_year=target_year
        )
        has_evidence = evidence_requirement_met(
            valid_docs, months_set, tax_year=target_year
        )
        out[sid] = {
            "year": target_year,
            "revenue_months_count": len(months),
            "missing_revenue_months": missing,
            "has_tax_estimation": estimation_counts.get(sid, 0) > 0,
            "tax_estimation_count": estimation_counts.get(sid, 0),
            "evidence_count": len(valid_docs),
            "evidence_months_covered": covered,
            "evidence_months_required": required,
            "has_evidence": has_evidence,
        }
    return out


def _dossier_missing_labels(dossier: dict[str, Any]) -> list[str]:
    labels: list[str] = []
    missing = dossier.get("missing_revenue_months") or []
    if missing:
        labels.append(
            "Thiếu CSV doanh thu các tháng: "
            + ", ".join(f"T{int(m):02d}" for m in missing)
        )
    if dossier.get("revenue_months_count", 0) > 0 and not dossier.get("has_tax_estimation"):
        labels.append("Chưa có ước tính thuế cho các kỳ đã upload")
    if dossier.get("revenue_months_count", 0) > 0 and not dossier.get("has_evidence"):
        ev_n = int(dossier.get("evidence_count") or 0)
        covered = int(dossier.get("evidence_months_covered") or 0)
        required = int(dossier.get("evidence_months_required") or dossier.get("revenue_months_count") or 0)
        if ev_n <= 0:
            labels.append("Chưa có chứng từ giao dịch (ảnh/PDF) trong năm")
        else:
            labels.append(
                f"Thiếu chứng từ một số kỳ ({covered}/{required} kỳ đã có doanh thu)"
            )
    return labels


def _object_id(value: str | None, field_name: str) -> ObjectId | None:
    if not value:
        return None
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"{field_name} không hợp lệ.")
    return ObjectId(value)


def _platform_response(platform: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(platform["_id"]),
        "code": platform.get("code"),
        "name": platform.get("name") or platform.get("code"),
        "is_active": bool(platform.get("is_active", True)),
    }


async def _store_response(store: dict[str, Any]) -> dict[str, Any]:
    db = get_database()
    platform = None
    platform_id = store.get("platform_id")
    if isinstance(platform_id, ObjectId):
        platform = await db.platforms.find_one({"_id": platform_id})

    latest_report = await db.revenue_reports.find_one(
        {"store_id": store.get("_id")},
        sort=[("year", -1), ("month", -1), ("created_at", -1)],
    )
    latest_estimation = await db.tax_estimations.find_one(
        {"store_id": store.get("_id")},
        sort=[("year", -1), ("month", -1), ("created_at", -1)],
    )

    return {
        "id": str(store["_id"]),
        "store_name": store.get("store_name"),
        "store_code": store.get("store_code"),
        "user_id": str(store["user_id"]) if isinstance(store.get("user_id"), ObjectId) else None,
        "tax_code": store.get("tax_code"),
        "business_type": store.get("business_type"),
        "platform": {
            "id": str(platform["_id"]) if platform else None,
            "name": _platform_name(store, platform),
            "code": _platform_code(store, platform),
        },
        "latest_period": _period(latest_report),
        "latest_report": serialize_mongo(latest_report) if latest_report else None,
        "latest_estimation": serialize_mongo(latest_estimation) if latest_estimation else None,
        "created_at": serialize_mongo(store.get("created_at")),
        "updated_at": serialize_mongo(store.get("updated_at")),
    }


def _store_response_from_maps(
    store: dict[str, Any],
    platforms_by_id: dict[ObjectId, dict[str, Any]],
    latest_reports_by_store_id: dict[ObjectId, dict[str, Any]],
    latest_estimations_by_store_id: dict[ObjectId, dict[str, Any]],
    dossier_by_store_id: dict[ObjectId, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    platform_id = store.get("platform_id")
    platform = platforms_by_id.get(platform_id) if isinstance(platform_id, ObjectId) else None
    latest_report = latest_reports_by_store_id.get(store["_id"])
    latest_estimation = latest_estimations_by_store_id.get(store["_id"])
    dossier = (dossier_by_store_id or {}).get(store["_id"], {})
    missing_items = _dossier_missing_labels(dossier) if dossier else []

    return {
        "id": str(store["_id"]),
        "store_name": store.get("store_name"),
        "store_code": store.get("store_code"),
        "user_id": str(store["user_id"]) if isinstance(store.get("user_id"), ObjectId) else None,
        "tax_code": store.get("tax_code"),
        "business_type": store.get("business_type"),
        "platform": {
            "id": str(platform["_id"]) if platform else None,
            "name": _platform_name(store, platform),
            "code": _platform_code(store, platform),
        },
        "latest_period": _period(latest_report),
        "latest_report": serialize_mongo(latest_report) if latest_report else None,
        "latest_estimation": serialize_mongo(latest_estimation) if latest_estimation else None,
        "dossier": dossier,
        "dossier_missing_items": missing_items,
        "created_at": serialize_mongo(store.get("created_at")),
        "updated_at": serialize_mongo(store.get("updated_at")),
    }


@router.get("/stores", response_model=StoresResponse)
async def list_stores(
    limit: int = Query(50, ge=1, le=200),
    user_id: str | None = Query(None),
):
    db = get_database()
    if not user_id:
        return {"stores": []}
    query: dict[str, Any] = {"user_id": _object_id(user_id, "user_id")}
    try:
        docs = await db.stores.find(query).sort("created_at", -1).limit(limit).to_list(length=limit)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc

    store_ids = [store["_id"] for store in docs]
    platform_ids = [
        store["platform_id"]
        for store in docs
        if isinstance(store.get("platform_id"), ObjectId)
    ]

    platforms_by_id: dict[ObjectId, dict[str, Any]] = {}
    latest_reports_by_store_id: dict[ObjectId, dict[str, Any]] = {}
    latest_estimations_by_store_id: dict[ObjectId, dict[str, Any]] = {}
    if docs:
        platforms = await db.platforms.find({"_id": {"$in": platform_ids}}).to_list(length=len(platform_ids))
        platforms_by_id = {platform["_id"]: platform for platform in platforms}

        latest_reports = await db.revenue_reports.aggregate(
            [
                {"$match": {"store_id": {"$in": store_ids}}},
                {"$sort": {"year": -1, "month": -1, "created_at": -1}},
                {"$group": {"_id": "$store_id", "doc": {"$first": "$$ROOT"}}},
            ]
        ).to_list(length=len(store_ids))
        latest_reports_by_store_id = {
            item["_id"]: item["doc"]
            for item in latest_reports
            if isinstance(item.get("_id"), ObjectId) and isinstance(item.get("doc"), dict)
        }

        latest_estimations = await db.tax_estimations.aggregate(
            [
                {"$match": {"store_id": {"$in": store_ids}}},
                {"$sort": {"year": -1, "month": -1, "created_at": -1}},
                {"$group": {"_id": "$store_id", "doc": {"$first": "$$ROOT"}}},
            ]
        ).to_list(length=len(store_ids))
        latest_estimations_by_store_id = {
            item["_id"]: item["doc"]
            for item in latest_estimations
            if isinstance(item.get("_id"), ObjectId) and isinstance(item.get("doc"), dict)
        }

        dossier_year = await _dossier_year_for_stores(db, store_ids)
        dossier_by_store_id = await _dossier_maps(db, store_ids, dossier_year)
    else:
        dossier_by_store_id = {}

    stores = [
        _store_response_from_maps(
            store,
            platforms_by_id,
            latest_reports_by_store_id,
            latest_estimations_by_store_id,
            dossier_by_store_id,
        )
        for store in docs
    ]

    return {"stores": stores}


@router.get("/platforms", response_model=PlatformsResponse)
async def list_platforms():
    db = get_database()
    try:
        docs = await db.platforms.find({"is_active": {"$ne": False}}).to_list(length=200)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc

    preferred_order = {
        "website": 0,
        "facebook": 1,
        "zalo": 2,
        "instagram": 3,
        "offline": 4,
        "other": 5,
    }
    docs.sort(key=lambda platform: (
        preferred_order.get(str(platform.get("code", "")).lower(), 999),
        str(platform.get("name") or platform.get("code") or "").lower(),
    ))

    return {"platforms": [_platform_response(platform) for platform in docs]}


@router.post("/stores/{store_id}/rag-index", status_code=202)
async def trigger_store_rag_index(
    store_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Query(..., description="Chu cua hang — xac thuc quyen"),
):
    """
  Luồng RAG độc lập — index Pinecone cho cửa hàng, không cần upload file.
  Có thể chạy song song với phiên upload/extract khác.
    """
    if not ObjectId.is_valid(store_id) or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="user_id hoac store_id khong hop le.")
    db = get_database()
    store = await db.stores.find_one({
        "_id": ObjectId(store_id),
        "user_id": ObjectId(user_id),
    })
    if not store:
        raise HTTPException(status_code=404, detail="Khong tim thay cua hang.")

    background_tasks.add_task(schedule_private_ingest, user_id=user_id, store_id=store_id, reason="manual")
    return {
        "status": "queued",
        "store_id": store_id,
        "message": "Dang index RAG cho cua hang (luong rieng, khong chan extract/thue).",
    }


@router.post("/stores", response_model=StoreResponse, status_code=201)
async def create_store(payload: CreateStoreRequest, background_tasks: BackgroundTasks):
    db = get_database()
    now = datetime.now(timezone.utc)
    platform_code = payload.platform_code.strip().lower()

    try:
        if not payload.user_id:
            raise HTTPException(status_code=400, detail="user_id khong hop le.")
        platform = await db.platforms.find_one({"code": platform_code, "is_active": {"$ne": False}})
        if not platform:
            raise HTTPException(status_code=400, detail="Nen tang khong hop le.")

        owner_id = _object_id(payload.user_id, "user_id")
        duplicate = await db.stores.find_one({
            "store_code": payload.store_code.strip(),
            "user_id": owner_id,
        })
        if duplicate:
            raise HTTPException(status_code=409, detail="Mã shop đã tồn tại.")

        doc = {
            "user_id": owner_id,
            "platform_id": platform["_id"],
            "platform": {
                "code": platform.get("code") or platform_code,
                "name": platform.get("name") or platform.get("code") or platform_code,
            },
            "store_name": payload.store_name.strip(),
            "store_code": payload.store_code.strip(),
            "tax_code": payload.tax_code.strip() if payload.tax_code else None,
            "business_type": payload.business_type,
            "created_at": now,
            "updated_at": now,
        }
        result = await db.stores.insert_one(doc)
        doc["_id"] = result.inserted_id
        background_tasks.add_task(
            schedule_private_ingest,
            user_id=str(owner_id),
            store_id=str(result.inserted_id),
            reason="store_created",
        )
        return {"store": await _store_response(doc)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
