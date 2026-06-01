from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import ReturnDocument, UpdateOne

from ..db import get_database, serialize_mongo

router = APIRouter()

KAIFY_VERSION_KEY = "kaify_bot"


class CreateNotificationRequest(BaseModel):
    user_id: str
    title: str = Field(min_length=1, max_length=240)
    detail: str | None = Field(default=None, max_length=1000)
    type: str = Field(default="system", max_length=80)
    source: str = Field(default="user_action", max_length=80)


class MarkNotificationsReadRequest(BaseModel):
    user_id: str
    notification_id: str | None = None
    all: bool = False


def _object_id(value: str | None, field_name: str) -> ObjectId:
    if not value or not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"{field_name} khong hop le.")
    return ObjectId(value)


def _notification_response(doc: dict[str, Any], read_ids: set[ObjectId] | None = None) -> dict[str, Any]:
    read_ids = read_ids or set()
    return {
        "id": str(doc["_id"]),
        "target_type": doc.get("target_type", "user"),
        "user_id": str(doc["user_id"]) if isinstance(doc.get("user_id"), ObjectId) else None,
        "title": doc.get("title") or "Thong bao moi",
        "detail": doc.get("detail") or "",
        "type": doc.get("type", "system"),
        "source": doc.get("source"),
        "version": doc.get("version"),
        "entity_type": doc.get("entity_type"),
        "entity_id": str(doc["entity_id"]) if isinstance(doc.get("entity_id"), ObjectId) else doc.get("entity_id"),
        "created_at": serialize_mongo(doc.get("created_at")),
        "read": doc.get("_id") in read_ids,
    }


def _next_minor_version(current: str | None) -> str:
    if not current:
        return "1.1"
    parts = str(current).split(".")
    try:
        major = int(parts[0] or "1")
        minor = int(parts[1] or "0") if len(parts) > 1 else 0
    except ValueError:
        return "1.1"
    return f"{major}.{minor + 1}"


async def bump_kaify_bot_version(db: Any, updated_by: ObjectId | None = None) -> str:
    now = datetime.now(timezone.utc)
    current = await db.app_versions.find_one({"key": KAIFY_VERSION_KEY})
    next_version = _next_minor_version(current.get("version") if current else "1.0")
    await db.app_versions.find_one_and_update(
        {"key": KAIFY_VERSION_KEY},
        {
            "$set": {
                "version": next_version,
                "updated_by": updated_by,
                "updated_at": now,
            },
            "$setOnInsert": {
                "key": KAIFY_VERSION_KEY,
                "created_at": now,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return next_version


async def create_broadcast_notification(
    db: Any,
    *,
    title: str,
    detail: str,
    notification_type: str = "chatbot",
    source: str = "rag_update",
    version: str | None = None,
    entity_type: str | None = None,
    entity_id: ObjectId | None = None,
    created_by: ObjectId | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        "target_type": "broadcast",
        "user_id": None,
        "title": title,
        "detail": detail,
        "type": notification_type,
        "source": source,
        "version": version,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "created_by": created_by,
        "created_at": now,
    }
    result = await db.notifications.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


@router.get("/notifications")
async def list_notifications(
    user_id: str = Query(...),
    limit: int = Query(30, ge=1, le=100),
):
    db = get_database()
    user_oid = _object_id(user_id, "user_id")
    query = {
        "$or": [
            {"target_type": "broadcast"},
            {"target_type": "user", "user_id": user_oid},
        ]
    }
    try:
        docs = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(length=limit)
        ids = [doc["_id"] for doc in docs]
        read_docs = await db.notification_reads.find(
            {"user_id": user_oid, "notification_id": {"$in": ids}},
            {"notification_id": 1},
        ).to_list(length=len(ids)) if ids else []
        read_ids = {doc["notification_id"] for doc in read_docs if isinstance(doc.get("notification_id"), ObjectId)}
        return {"notifications": [_notification_response(doc, read_ids) for doc in docs]}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.post("/notifications", status_code=201)
async def create_user_notification(payload: CreateNotificationRequest):
    db = get_database()
    user_oid = _object_id(payload.user_id, "user_id")
    now = datetime.now(timezone.utc)
    doc = {
        "target_type": "user",
        "user_id": user_oid,
        "title": payload.title.strip(),
        "detail": (payload.detail or "").strip(),
        "type": payload.type.strip() or "system",
        "source": payload.source.strip() or "user_action",
        "created_at": now,
    }
    try:
        result = await db.notifications.insert_one(doc)
        doc["_id"] = result.inserted_id
        return {"notification": _notification_response(doc)}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.patch("/notifications/read")
async def mark_notifications_read(payload: MarkNotificationsReadRequest):
    db = get_database()
    user_oid = _object_id(payload.user_id, "user_id")
    now = datetime.now(timezone.utc)

    try:
        if payload.all:
            docs = await db.notifications.find(
                {
                    "$or": [
                        {"target_type": "broadcast"},
                        {"target_type": "user", "user_id": user_oid},
                    ]
                },
                {"_id": 1},
            ).to_list(length=500)
            if docs:
                await db.notification_reads.bulk_write(
                    [
                        UpdateOne(
                            {"user_id": user_oid, "notification_id": doc["_id"]},
                            {"$setOnInsert": {"user_id": user_oid, "notification_id": doc["_id"], "read_at": now}},
                            upsert=True,
                        )
                        for doc in docs
                    ],
                    ordered=False,
                )
            return {"ok": True}

        notification_oid = _object_id(payload.notification_id, "notification_id")
        notification = await db.notifications.find_one(
            {
                "_id": notification_oid,
                "$or": [
                    {"target_type": "broadcast"},
                    {"target_type": "user", "user_id": user_oid},
                ],
            }
        )
        if not notification:
            raise HTTPException(status_code=404, detail="Khong tim thay thong bao.")
        await db.notification_reads.update_one(
            {"user_id": user_oid, "notification_id": notification_oid},
            {"$setOnInsert": {"user_id": user_oid, "notification_id": notification_oid, "read_at": now}},
            upsert=True,
        )
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
