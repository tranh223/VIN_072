from __future__ import annotations

import os
import logging
from functools import lru_cache
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from bson.binary import Binary
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

# Luôn đọc `.env` ở thư mục gốc repo, kể cả khi chạy uvicorn từ thư mục khác (ví dụ `ui/`).
# Trước đây `load_dotenv()` chỉ tìm theo CWD nên dễ thiếu MONGO_URI → 500 ở /api/auth/*.
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_PROJECT_ROOT / ".env")
load_dotenv()

logger = logging.getLogger(__name__)


def _mongo_uri() -> str:
    uri = os.getenv("MONGO_URI", "").strip()
    if not uri:
        raise RuntimeError("Missing MONGO_URI in environment")
    return uri


def _mongo_db_name() -> str:
    name = os.getenv("MONGO_DB_NAME", "").strip()
    if not name:
        raise RuntimeError("Missing MONGO_DB_NAME in environment")
    return name


@lru_cache(maxsize=1)
def get_mongo_client() -> AsyncIOMotorClient[Any]:
    return AsyncIOMotorClient(_mongo_uri(), serverSelectionTimeoutMS=5000)


def get_database() -> AsyncIOMotorDatabase[Any]:
    return get_mongo_client()[_mongo_db_name()]


async def ping_database() -> dict[str, str]:
    db = get_database()
    await db.command("ping")
    return {"status": "ok", "database": db.name}


async def warm_database() -> None:
    """Open the Mongo connection and create common query indexes in the background."""
    db = get_database()
    try:
        await db.command("ping")
        await db.audit_logs.create_index([("actor_id", 1), ("created_at", -1)])
        await db.revenue_reports.create_index([("store_id", 1), ("year", -1), ("month", -1), ("created_at", -1)])
        await db.stores.create_index([("user_id", 1), ("created_at", -1)])
        await db.stores.create_index([("user_id", 1), ("store_code", 1)])
        await db.tax_deduction_documents.create_index([("store_id", 1), ("tax_year", -1), ("created_at", -1)])
        await db.tax_estimations.create_index([("store_id", 1), ("created_at", -1)])
        await db.tax_estimations.create_index([("store_id", 1), ("year", -1), ("month", -1), ("created_at", -1)])
        await db.users.create_index("email")
        await db.users.create_index("phone")
        await db.password_reset_tokens.create_index("token_hash")
        await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
        await db.rag_documents.create_index([("status", 1), ("created_at", -1)])
        await db.user_feedback.create_index([("status", 1), ("created_at", -1)])
        await db.user_feedback.create_index([("user_id", 1), ("created_at", -1)])
        await db.usage_events.create_index([("event_type", 1), ("created_at", -1)])
        await db.usage_events.create_index([("user_id", 1), ("created_at", -1)])
        await db.notifications.create_index([("target_type", 1), ("user_id", 1), ("created_at", -1)])
        await db.notification_reads.create_index([("user_id", 1), ("notification_id", 1)], unique=True)
        await db.app_versions.create_index("key", unique=True)
    except Exception as exc:
        logger.warning("MongoDB warm-up/index setup failed: %s", exc)


def close_mongo_client() -> None:
    if get_mongo_client.cache_info().currsize:
        get_mongo_client().close()
        get_mongo_client.cache_clear()


def serialize_mongo(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (bytes, Binary)):
        # BSON Binary (vd. avatar_data) không thể dump JSON — bỏ qua
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize_mongo(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_mongo(item) for key, item in value.items()}
    return value
