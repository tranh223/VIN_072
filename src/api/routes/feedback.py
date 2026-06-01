from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..db import get_database, serialize_mongo

router = APIRouter()


class CreateUserFeedbackRequest(BaseModel):
    user_id: str | None = None
    message_id: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    feedback_type: str = Field(default="general", max_length=80)
    comment: str = Field(min_length=1, max_length=2000)


class CreateUsageEventRequest(BaseModel):
    user_id: str | None = None
    event_type: str = Field(min_length=1, max_length=80)
    feature: str | None = Field(default=None, max_length=80)
    metadata: dict[str, Any] = Field(default_factory=dict)


def _object_id(value: str | None, field_name: str) -> ObjectId | None:
    if not value:
        return None
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"{field_name} khong hop le.")
    return ObjectId(value)


def _feedback_response(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "user_id": str(doc["user_id"]) if isinstance(doc.get("user_id"), ObjectId) else None,
        "message_id": str(doc["message_id"]) if isinstance(doc.get("message_id"), ObjectId) else doc.get("message_id"),
        "rating": doc.get("rating"),
        "feedback_type": doc.get("feedback_type"),
        "comment": doc.get("comment"),
        "status": doc.get("status", "new"),
        "created_at": serialize_mongo(doc.get("created_at")),
        "updated_at": serialize_mongo(doc.get("updated_at")),
    }


@router.post("/user-feedback", status_code=201)
async def create_user_feedback(payload: CreateUserFeedbackRequest):
    db = get_database()
    user_id = _object_id(payload.user_id, "user_id")
    message_id = _object_id(payload.message_id, "message_id")
    if user_id:
        user = await db.users.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="Khong tim thay user.")

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user_id,
        "message_id": message_id,
        "rating": payload.rating,
        "feedback_type": payload.feedback_type.strip() or "general",
        "comment": payload.comment.strip(),
        "status": "new",
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db.user_feedback.insert_one(doc)
        doc["_id"] = result.inserted_id
        return {"feedback": _feedback_response(doc)}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.post("/usage-events", status_code=201)
async def create_usage_event(payload: CreateUsageEventRequest):
    db = get_database()
    user_id = _object_id(payload.user_id, "user_id")
    if user_id:
        user = await db.users.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="Khong tim thay user.")

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user_id,
        "event_type": payload.event_type.strip(),
        "feature": (payload.feature or payload.event_type).strip(),
        "metadata": payload.metadata,
        "created_at": now,
    }
    try:
        result = await db.usage_events.insert_one(doc)
        doc["_id"] = result.inserted_id
        return {"event": serialize_mongo(doc)}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
