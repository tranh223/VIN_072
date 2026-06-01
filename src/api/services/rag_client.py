"""
rag_client.py — HTTP client để backend (8000) gọi RAG service (8001).

Backend KHÔNG load model BGE hay kết nối Pinecone trực tiếp.
Mọi embedding/vector đều do RAG service (8001) xử lý.

Cấu hình:
    RAG_SERVICE_URL=http://rag:8001      # Docker internal
    RAG_SERVICE_URL=http://localhost:8001 # Local dev
    RAG_INGEST_TIMEOUT_SEC=180           # Timeout mỗi request
"""

from __future__ import annotations

import logging
import os
import urllib.error
import urllib.parse
import urllib.request
import json
import threading
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_RAG_URL = "http://rag:8001"
_DEFAULT_TIMEOUT = 180


def _rag_url() -> str:
    return os.getenv("RAG_SERVICE_URL", _DEFAULT_RAG_URL).rstrip("/")


def _timeout() -> int:
    try:
        return int(os.getenv("RAG_INGEST_TIMEOUT_SEC", str(_DEFAULT_TIMEOUT)))
    except ValueError:
        return _DEFAULT_TIMEOUT


def _is_disabled() -> bool:
    return os.getenv("SKIP_RAG_AUTO_INGEST_ON_UPLOAD", "").strip().lower() in {
        "1", "true", "yes",
    }


def call_private_ingest(
    *,
    user_id: str,
    store_id: str,
    reason: str = "upload_processed",
    inserted: dict[str, Any] | None = None,
    namespace: str = "user-data",
    limit: int = 500,
) -> dict[str, Any]:
    """
    Gọi POST /rag/private-ingest trên RAG service (8001).
    Chạy đồng bộ — gọi từ background thread để không block FE.
    """
    url = f"{_rag_url()}/rag/private-ingest"
    payload = {
        "user_id": user_id,
        "store_id": store_id,
        "reason": reason,
        "inserted": inserted,
        "namespace": namespace,
        "limit": limit,
    }
    body = json.dumps(payload, default=str).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=_timeout()) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            logger.info(
                "[RAG-client] private-ingest xong: user=%s store=%s status=%s chunks=%s",
                user_id, store_id,
                data.get("status"), data.get("chunks_upserted", 0),
            )
            return data
    except urllib.error.URLError as exc:
        logger.warning(
            "[RAG-client] Khong the ket noi RAG service (%s): %s — skip RAG index.",
            url, exc.reason,
        )
        return {"status": "unavailable", "error": str(exc), "user_id": user_id, "store_id": store_id}
    except Exception as exc:
        logger.error("[RAG-client] Loi goi RAG service: %s", exc)
        return {"status": "failed", "error": str(exc)[:1000], "user_id": user_id, "store_id": store_id}


def schedule_private_ingest(
    *,
    user_id: str,
    store_id: str,
    reason: str = "upload_processed",
    inserted: dict[str, Any] | None = None,
    namespace: str = "user-data",
    limit: int = 500,
) -> None:
    """
    Chạy call_private_ingest trong daemon thread — non-blocking.
    Dùng khi muốn kick-off RAG ngay, không phải chờ extract xong.
    """
    if _is_disabled():
        logger.info("[RAG-client] SKIP_RAG_AUTO_INGEST_ON_UPLOAD=true — bo qua.")
        return
    thread = threading.Thread(
        target=call_private_ingest,
        kwargs=dict(
            user_id=user_id,
            store_id=store_id,
            reason=reason,
            inserted=inserted,
            namespace=namespace,
            limit=limit,
        ),
        daemon=True,
        name=f"rag-client-{store_id[:8]}",
    )
    thread.start()
    logger.info("[RAG-client] Da start thread goi rag:8001 — user=%s store=%s", user_id, store_id)
