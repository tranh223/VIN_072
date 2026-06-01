from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from .mongo_rag_ingest import PRIVATE_NAMESPACE, MongoRagIngestor

logger = logging.getLogger(__name__)


def _auto_limit() -> int:
    try:
        return max(1, int(os.getenv("MONGO_RAG_AUTO_INGEST_LIMIT", "500")))
    except ValueError:
        return 500


def auto_ingest_private_store(
    *,
    user_id: str,
    store_id: str,
    namespace: str = PRIVATE_NAMESPACE,
    reason: str = "auto",
    inserted: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Best-effort private RAG sync for one user's store.

    This is intentionally non-throwing so user-facing flows such as upload or
    store creation do not fail just because Pinecone/embedding indexing is down.
    """
    if not ObjectId.is_valid(user_id) or not ObjectId.is_valid(store_id):
        return {
            "status": "skipped",
            "reason": "invalid_user_or_store_id",
            "namespace": namespace,
        }

    ingestor = MongoRagIngestor()
    try:
        result = ingestor.ingest_private(
            user_id=user_id,
            store_id=store_id,
            limit=_auto_limit(),
            namespace=namespace,
            dry_run=False,
            clear=False,
        )
        result["status"] = "indexed"
        result["reason"] = reason
        return result
    except Exception as exc:  # pragma: no cover - depends on external services
        error = str(exc)[:1000]
        logger.warning(
            "Private RAG auto-ingest failed user_id=%s store_id=%s reason=%s: %s",
            user_id,
            store_id,
            reason,
            error,
        )
        now = datetime.now(timezone.utc)
        store_oid = ObjectId(store_id)
        affected = {"stores": [store_id]}
        if inserted:
            for collection in ("revenue_reports", "tax_deduction_documents", "tax_estimations"):
                ids = [str(item) for item in inserted.get(collection, []) if ObjectId.is_valid(str(item))]
                if ids:
                    affected[collection] = ids
        for collection, ids in affected.items():
            object_ids = [ObjectId(item) for item in ids if ObjectId.is_valid(item)]
            if object_ids:
                ingestor.db[collection].update_many(
                    {"_id": {"$in": object_ids}},
                    {"$set": {
                        "rag_index_status": "failed",
                        "rag_index_error": error,
                        "rag_indexed_at": now,
                        "rag_index_namespace": namespace,
                    }},
                )
        ingestor.db.stores.update_one(
            {"_id": store_oid},
            {"$set": {
                "rag_index_status": "failed",
                "rag_index_error": error,
                "rag_indexed_at": now,
                "rag_index_namespace": namespace,
            }},
        )
        return {
            "status": "failed",
            "reason": reason,
            "namespace": namespace,
            "error": error,
        }
    finally:
        ingestor.close()
