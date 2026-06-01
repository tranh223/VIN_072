from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from ..db import get_database, serialize_mongo
from .notifications import bump_kaify_bot_version, create_broadcast_notification
from ..services.mongo_rag_ingest import PUBLIC_NAMESPACE, MongoRagIngestor
router = APIRouter()


class RagDocumentPayload(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    document_type: str = Field(default="law", max_length=80)
    document_number: str | None = Field(default=None, max_length=120)
    content: str | None = Field(default=None, max_length=2000000)
    issued_date: datetime | None = None
    effective_date: datetime | None = None
    expired_date: datetime | None = None
    file_url: str | None = Field(default=None, max_length=600)
    status: str = Field(default="active", pattern="^(active|expired|draft)$")


class FeedbackStatusPayload(BaseModel):
    status: str = Field(pattern="^(new|reviewed|resolved|archived)$")


class AdminUserUpdatePayload(BaseModel):
    role: str | None = Field(default=None, pattern="^(admin|user)$")
    status: str | None = Field(default=None, pattern="^(active|inactive|locked|pending)$")


def _month_start(value: datetime) -> datetime:
    return datetime(value.year, value.month, 1, tzinfo=timezone.utc)


def _add_months(value: datetime, months: int) -> datetime:
    year = value.year + ((value.month - 1 + months) // 12)
    month = ((value.month - 1 + months) % 12) + 1
    return datetime(year, month, 1, tzinfo=timezone.utc)


def _month_key(value: datetime) -> str:
    return value.strftime("%Y-%m")


def _month_label(value: datetime) -> str:
    return f"T{value.month}"


def _day_key(value: datetime) -> str:
    return value.strftime("%Y-%m-%d")


def _day_label(value: datetime) -> str:
    labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    return labels[value.weekday()]


def _inactive_cutoff() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=183)


async def _mark_inactive_users(db: Any) -> None:
    cutoff = _inactive_cutoff()
    await db.users.update_many(
        {
            "role": {"$ne": "admin"},
            "status": "active",
            "updated_at": {"$lt": cutoff},
        },
        {"$set": {"status": "inactive", "updated_at": datetime.now(timezone.utc)}},
    )


def _object_id(value: str | None, field_name: str) -> ObjectId:
    if not value or not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"{field_name} khong hop le.")
    return ObjectId(value)


async def _require_admin(admin_user_id: str | None) -> dict[str, Any]:
    db = get_database()
    admin_id = _object_id(admin_user_id, "admin_user_id")
    user = await db.users.find_one({"_id": admin_id})
    if not user:
        raise HTTPException(status_code=401, detail="Khong tim thay tai khoan admin.")
    if user.get("status") != "active" or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chi admin moi co quyen truy cap.")
    return user


def _rag_document_response(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title"),
        "document_type": doc.get("document_type"),
        "document_number": doc.get("document_number"),
        "content": doc.get("content"),
        "issued_date": serialize_mongo(doc.get("issued_date")),
        "effective_date": serialize_mongo(doc.get("effective_date")),
        "expired_date": serialize_mongo(doc.get("expired_date")),
        "file_url": doc.get("file_url"),
        "created_by": str(doc["created_by"]) if isinstance(doc.get("created_by"), ObjectId) else None,
        "status": doc.get("status", "active"),
        "created_at": serialize_mongo(doc.get("created_at")),
        "updated_at": serialize_mongo(doc.get("updated_at")),
    }


def _auto_document_number(now: datetime, oid: ObjectId) -> str:
    return f"RAG-{now.strftime('%Y%m%d')}-{str(oid)[-6:].upper()}"


def _sync_rag_document_index(document_id: str) -> None:
    ingestor = MongoRagIngestor()
    try:
        ingestor.ingest_public_document(document_id, namespace=PUBLIC_NAMESPACE)
    except Exception as exc:
        if ObjectId.is_valid(document_id):
            ingestor.db.rag_documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {
                    "rag_index_status": "failed",
                    "rag_index_error": str(exc)[:1000],
                    "rag_indexed_at": datetime.now(timezone.utc),
                    "rag_index_namespace": PUBLIC_NAMESPACE,
                }},
            )
    finally:
        ingestor.close()


def _remove_rag_document_vectors(vector_ids: list[str], namespace: str | None = None) -> None:
    if not vector_ids:
        return
    ingestor = MongoRagIngestor()
    try:
        ingestor.remove_public_document_vectors_by_ids(vector_ids, namespace=namespace or PUBLIC_NAMESPACE)
    finally:
        ingestor.close()


def _feedback_response(doc: dict[str, Any], user: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "user_id": str(doc["user_id"]) if isinstance(doc.get("user_id"), ObjectId) else None,
        "user_name": user.get("full_name") if user else None,
        "user_email": user.get("email") if user else None,
        "message_id": str(doc["message_id"]) if isinstance(doc.get("message_id"), ObjectId) else doc.get("message_id"),
        "rating": doc.get("rating"),
        "feedback_type": doc.get("feedback_type"),
        "comment": doc.get("comment"),
        "status": doc.get("status", "new"),
        "created_at": serialize_mongo(doc.get("created_at")),
        "updated_at": serialize_mongo(doc.get("updated_at")),
    }


def _admin_user_response(doc: dict[str, Any], store_count: int = 0) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "email": doc.get("email"),
        "full_name": doc.get("full_name"),
        "phone": doc.get("phone"),
        "role": doc.get("role", "user"),
        "status": doc.get("status", "active"),
        "store_count": int(store_count),
        "last_login": serialize_mongo(doc.get("last_login")),
        "created_at": serialize_mongo(doc.get("created_at")),
        "updated_at": serialize_mongo(doc.get("updated_at")),
    }


@router.get("/admin/rag-documents")
async def list_rag_documents(
    admin_user_id: str = Query(...),
    limit: int = Query(100, ge=1, le=500),
):
    await _require_admin(admin_user_id)
    db = get_database()
    try:
        docs = await db.rag_documents.find({}).sort("created_at", -1).limit(limit).to_list(length=limit)
        return {"documents": [_rag_document_response(doc) for doc in docs]}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.post("/admin/rag-documents", status_code=201)
async def create_rag_document(
    payload: RagDocumentPayload,
    background_tasks: BackgroundTasks,
    admin_user_id: str = Query(...),
):
    admin = await _require_admin(admin_user_id)
    db = get_database()
    now = datetime.now(timezone.utc)
    oid = ObjectId()
    document_number = payload.document_number.strip() if payload.document_number else _auto_document_number(now, oid)
    file_url = payload.file_url.strip() if payload.file_url else None
    doc = {
        "_id": oid,
        "title": payload.title.strip(),
        "document_type": payload.document_type.strip() or "law",
        "document_number": document_number,
        "content": payload.content.strip() if payload.content else None,
        "issued_date": payload.issued_date,
        "effective_date": payload.effective_date,
        "expired_date": payload.expired_date,
        "file_url": file_url,
        "created_by": admin["_id"],
        "status": payload.status,
        "created_at": now,
        "updated_at": now,
        "rag_index_status": "indexing" if payload.status == "active" else "not_indexed",
    }
    try:
        result = await db.rag_documents.insert_one(doc)
        doc["_id"] = result.inserted_id
        if doc["status"] == "active":
            version = await bump_kaify_bot_version(db, admin["_id"])
            await create_broadcast_notification(
                db,
                title=f"Kaify Bot bản {version} đã được cập nhật",
                detail=f"Nội dung chatbot mới: {doc['title']}",
                version=version,
                entity_type="rag_documents",
                entity_id=doc["_id"],
                created_by=admin["_id"],
            )
            background_tasks.add_task(_sync_rag_document_index, str(doc["_id"]))
        return {"document": _rag_document_response(doc)}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.put("/admin/rag-documents/{document_id}")
async def update_rag_document(
    document_id: str,
    payload: RagDocumentPayload,
    background_tasks: BackgroundTasks,
    admin_user_id: str = Query(...),
):
    admin = await _require_admin(admin_user_id)
    db = get_database()
    oid = _object_id(document_id, "document_id")
    existing = await db.rag_documents.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Khong tim thay tai lieu RAG.")
    document_number = existing.get("document_number") or payload.document_number or _auto_document_number(datetime.now(timezone.utc), oid)
    file_url = payload.file_url.strip() if payload.file_url else existing.get("file_url")
    update = {
        "title": payload.title.strip(),
        "document_type": payload.document_type.strip() or "law",
        "document_number": document_number,
        "content": payload.content.strip() if payload.content else existing.get("content"),
        "issued_date": payload.issued_date,
        "effective_date": payload.effective_date,
        "expired_date": payload.expired_date,
        "file_url": file_url,
        "status": payload.status,
        "updated_at": datetime.now(timezone.utc),
        "rag_index_status": "indexing" if payload.status == "active" else "not_indexed",
    }
    try:
        result = await db.rag_documents.find_one_and_update(
            {"_id": oid},
            {"$set": update},
            return_document=ReturnDocument.AFTER,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Khong tim thay tai lieu RAG.")
        if result.get("status") == "active":
            version = await bump_kaify_bot_version(db, admin["_id"])
            await create_broadcast_notification(
                db,
                title=f"Kaify Bot bản {version} đã được cập nhật",
                detail=f"Nội dung chatbot vừa cập nhật: {result.get('title')}",
                version=version,
                entity_type="rag_documents",
                entity_id=result["_id"],
                created_by=admin["_id"],
            )
            background_tasks.add_task(_sync_rag_document_index, str(result["_id"]))
        return {"document": _rag_document_response(result)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.delete("/admin/rag-documents/{document_id}", status_code=204)
async def delete_rag_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    admin_user_id: str = Query(...),
):
    await _require_admin(admin_user_id)
    db = get_database()
    oid = _object_id(document_id, "document_id")
    try:
        existing = await db.rag_documents.find_one({"_id": oid}, {"rag_vector_ids": 1, "rag_index_namespace": 1})
        if not existing:
            raise HTTPException(status_code=404, detail="Khong tim thay tai lieu RAG.")
        result = await db.rag_documents.delete_one({"_id": oid})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Khong tim thay tai lieu RAG.")
        vector_ids = [str(vector_id) for vector_id in existing.get("rag_vector_ids", []) if vector_id]
        if vector_ids:
            background_tasks.add_task(
                _remove_rag_document_vectors,
                vector_ids,
                existing.get("rag_index_namespace") or PUBLIC_NAMESPACE,
            )
        return None
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.get("/admin/users")
async def list_admin_users(
    admin_user_id: str = Query(...),
    limit: int = Query(500, ge=1, le=1000),
):
    await _require_admin(admin_user_id)
    db = get_database()
    try:
        await _mark_inactive_users(db)
        users = await db.users.find(
            {},
            {"password_hash": 0},
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        user_ids = [user["_id"] for user in users]
        store_rows = await db.stores.aggregate(
            [
                {"$match": {"user_id": {"$in": user_ids}}},
                {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
            ]
        ).to_list(length=len(user_ids)) if user_ids else []
        store_counts = {row["_id"]: int(row["count"]) for row in store_rows}
        return {"users": [_admin_user_response(user, store_counts.get(user["_id"], 0)) for user in users]}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.patch("/admin/users/{user_id}")
async def update_admin_user(
    user_id: str,
    payload: AdminUserUpdatePayload,
    admin_user_id: str = Query(...),
):
    admin = await _require_admin(admin_user_id)
    db = get_database()
    oid = _object_id(user_id, "user_id")
    update: dict[str, Any] = {}
    if payload.role is not None:
        update["role"] = payload.role
    if payload.status is not None:
        update["status"] = payload.status
    if not update:
        raise HTTPException(status_code=400, detail="Khong co du lieu cap nhat.")
    if oid == admin["_id"] and (update.get("status") != "active" or update.get("role") not in (None, "admin")):
        raise HTTPException(status_code=400, detail="Không thể tự khóa hoặc hạ quyền tài khoản admin hiện tại.")
    update["updated_at"] = datetime.now(timezone.utc)
    try:
        result = await db.users.find_one_and_update(
            {"_id": oid},
            {"$set": update},
            projection={"password_hash": 0},
            return_document=ReturnDocument.AFTER,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Khong tim thay nguoi dung.")
        store_count = await db.stores.count_documents({"user_id": oid})
        return {"user": _admin_user_response(result, store_count)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.get("/admin/user-feedback")
async def list_user_feedback(
    admin_user_id: str = Query(...),
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    await _require_admin(admin_user_id)
    db = get_database()
    query: dict[str, Any] = {}
    if status and status != "all":
        query["status"] = status
    try:
        docs = await db.user_feedback.find(query).sort("created_at", -1).limit(limit).to_list(length=limit)
        user_ids = [doc["user_id"] for doc in docs if isinstance(doc.get("user_id"), ObjectId)]
        users = await db.users.find({"_id": {"$in": user_ids}}).to_list(length=len(user_ids)) if user_ids else []
        users_by_id = {user["_id"]: user for user in users}
        return {
            "feedback": [
                _feedback_response(doc, users_by_id.get(doc.get("user_id")))
                for doc in docs
            ]
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.patch("/admin/user-feedback/{feedback_id}")
async def update_user_feedback_status(
    feedback_id: str,
    payload: FeedbackStatusPayload,
    admin_user_id: str = Query(...),
):
    await _require_admin(admin_user_id)
    db = get_database()
    oid = _object_id(feedback_id, "feedback_id")
    try:
        result = await db.user_feedback.find_one_and_update(
            {"_id": oid},
            {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc)}},
            return_document=ReturnDocument.AFTER,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Khong tim thay feedback.")
        user = None
        if isinstance(result.get("user_id"), ObjectId):
            user = await db.users.find_one({"_id": result["user_id"]})
        return {"feedback": _feedback_response(result, user)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.get("/admin/user-stats")
async def user_stats(admin_user_id: str = Query(...)):
    await _require_admin(admin_user_id)
    db = get_database()
    try:
        await _mark_inactive_users(db)
        role_counts = await db.users.aggregate(
            [{"$group": {"_id": "$role", "count": {"$sum": 1}}}]
        ).to_list(length=20)
        status_counts = await db.users.aggregate(
            [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
        ).to_list(length=20)
        recent_users = await db.users.find(
            {},
            {"password_hash": 0},
        ).sort("created_at", -1).limit(10).to_list(length=10)
        totals = {
            "total_users": await db.users.count_documents({}),
            "active_users": await db.users.count_documents({"status": "active"}),
            "admin_users": await db.users.count_documents({"role": "admin"}),
            "stores": await db.stores.count_documents({}),
            "rag_documents": await db.rag_documents.count_documents({}),
            "feedback": await db.user_feedback.count_documents({}),
        }
        return {
            "totals": totals,
            "role_counts": {str(item.get("_id") or "unknown"): int(item["count"]) for item in role_counts},
            "status_counts": {str(item.get("_id") or "unknown"): int(item["count"]) for item in status_counts},
            "recent_users": [serialize_mongo(user) for user in recent_users],
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.get("/admin/user-analytics")
async def user_analytics(admin_user_id: str = Query(...)):
    await _require_admin(admin_user_id)
    db = get_database()
    now = datetime.now(timezone.utc)
    month_from = _add_months(_month_start(now), -5)
    day_from = datetime(now.year, now.month, now.day, tzinfo=timezone.utc) - timedelta(days=6)
    last_7_days = datetime.now(timezone.utc) - timedelta(days=7)

    try:
        monthly_user_rows = await db.users.aggregate(
            [
                {"$match": {"created_at": {"$gte": month_from}}},
                {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}}, "count": {"$sum": 1}}},
            ]
        ).to_list(length=12)
        monthly_user_counts = {str(item["_id"]): int(item["count"]) for item in monthly_user_rows}
        monthly_users = []
        for index in range(6):
            month = _add_months(month_from, index)
            monthly_users.append({
                "month": _month_label(month),
                "key": _month_key(month),
                "users": monthly_user_counts.get(_month_key(month), 0),
            })

        chatbot_rows = await db.usage_events.aggregate(
            [
                {"$match": {"event_type": "chatbot_question", "created_at": {"$gte": day_from}}},
                {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "count": {"$sum": 1}}},
            ]
        ).to_list(length=14)
        chatbot_counts = {str(item["_id"]): int(item["count"]) for item in chatbot_rows}
        chatbot_usage = []
        for index in range(7):
            day = day_from + timedelta(days=index)
            chatbot_usage.append({
                "day": _day_label(day),
                "key": _day_key(day),
                "questions": chatbot_counts.get(_day_key(day), 0),
            })

        data_uploads = await db.usage_events.count_documents({"event_type": "data_upload"})
        if data_uploads == 0:
            data_uploads = await db.audit_logs.count_documents({"action": {"$in": ["upload_processed", "upload_created"]}})

        chatbot_questions = await db.usage_events.count_documents({"event_type": "chatbot_question"})
        active_7d_user_ids = await db.usage_events.distinct("user_id", {"created_at": {"$gte": last_7_days}, "user_id": {"$ne": None}})
        if not active_7d_user_ids:
            active_7d_user_ids = await db.audit_logs.distinct("actor_id", {"created_at": {"$gte": last_7_days}, "actor_id": {"$ne": None}})

        feature_rows = await db.usage_events.aggregate(
            [{"$group": {"_id": "$feature", "count": {"$sum": 1}}}]
        ).to_list(length=20)
        feature_counts = {str(item.get("_id") or "unknown"): int(item["count"]) for item in feature_rows}
        audit_uploads = await db.audit_logs.count_documents({"action": "upload_processed"})
        feature_usage = [
            {"name": "Đối soát thuế", "value": max(feature_counts.get("data_upload", 0), audit_uploads)},
            {"name": "Hỏi chatbot", "value": feature_counts.get("chatbot_question", 0)},
            {"name": "Báo cáo tháng", "value": feature_counts.get("monthly_report", 0)},
            {"name": "Quản lý cửa hàng", "value": await db.stores.count_documents({})},
        ]

        return {
            "totals": {
                "active_users_7d": len(active_7d_user_ids),
                "data_uploads": int(data_uploads),
                "chatbot_questions": int(chatbot_questions),
            },
            "monthly_users": monthly_users,
            "chatbot_usage": chatbot_usage,
            "feature_usage": feature_usage,
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
