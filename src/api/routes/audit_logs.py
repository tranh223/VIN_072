from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from ..db import get_database, serialize_mongo

router = APIRouter()

_UPLOAD_DIR = Path(__file__).parent.parent.parent.parent / "tmp" / "uploads"


class AuditLogsResponse(BaseModel):
    audit_logs: list[dict[str, Any]]


def _local_upload_path(job_id: str, kind: str) -> Path | None:
    prefix = "csv" if kind == "csv" else "document"
    upload_dir = _UPLOAD_DIR / job_id
    if not upload_dir.exists():
        return None
    matches = sorted(upload_dir.glob(f"{prefix}.*"))
    return matches[0] if matches else None


def _parse_gs_url(value: str | None) -> tuple[str, str] | None:
    if not value or not value.startswith("gs://"):
        return None
    rest = value[5:]
    bucket, _, blob_name = rest.partition("/")
    if not bucket or not blob_name:
        return None
    return bucket, blob_name


def _media_type(filename: str) -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def _inline_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type=_media_type(filename),
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/audit-logs", response_model=AuditLogsResponse)
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    user_id: str | None = Query(None),
):
    db = get_database()
    query: dict[str, Any] = {}
    if not user_id:
        return {"audit_logs": []}
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="user_id khong hop le.")
    query["actor_id"] = ObjectId(user_id)
    try:
        docs = await db.audit_logs.find(query).sort("created_at", -1).limit(limit).to_list(length=limit)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc

    actor_summary: dict[str, Any] | None = None
    actor_id = ObjectId(user_id)
    try:
        actor_doc = await db.users.find_one({"_id": actor_id})
        if actor_doc:
            actor_summary = {
                "id": str(actor_doc["_id"]),
                "full_name": actor_doc.get("full_name"),
                "email": actor_doc.get("email"),
            }
    except Exception:
        actor_summary = None

    logs: list[dict[str, Any]] = []
    for log in docs:
        log_actor_id = log.get("actor_id")

        logs.append(
            {
                "id": str(log["_id"]),
                "actor": actor_summary,
                "actor_id": serialize_mongo(log_actor_id),
                "actor_name": actor_summary.get("full_name") if actor_summary else None,
                "actor_email": actor_summary.get("email") if actor_summary else None,
                "action": log.get("action"),
                "entity_type": log.get("entity_type"),
                "entity_id": serialize_mongo(log.get("entity_id")),
                "old_value": serialize_mongo(log.get("old_value")),
                "new_value": serialize_mongo(log.get("new_value")),
                "created_at": serialize_mongo(log.get("created_at")),
            }
        )

    return {"audit_logs": logs}


@router.get("/audit-logs/{audit_id}/file/{kind}")
async def view_audit_file(
    audit_id: str,
    kind: str,
    user_id: str | None = Query(None),
):
    if kind not in {"csv", "invoice"}:
        raise HTTPException(status_code=400, detail="kind phai la 'csv' hoac 'invoice'.")
    if not ObjectId.is_valid(audit_id):
        raise HTTPException(status_code=400, detail="audit_id khong hop le.")

    query: dict[str, Any] = {"_id": ObjectId(audit_id)}
    if user_id:
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="user_id khong hop le.")
        query["actor_id"] = ObjectId(user_id)

    db = get_database()
    log = await db.audit_logs.find_one(query)
    if not log:
        raise HTTPException(status_code=404, detail="Khong tim thay audit log.")

    new_value = log.get("new_value") if isinstance(log.get("new_value"), dict) else {}
    job_id = str(new_value.get("job_id") or "")
    if not job_id:
        raise HTTPException(status_code=404, detail="Audit log khong co job_id.")

    local_path = _local_upload_path(job_id, kind)
    if local_path and local_path.is_file():
        return _inline_response(local_path.read_bytes(), local_path.name)

    url_field = "csv_url" if kind == "csv" else "invoice_url"
    file_url = str(new_value.get(url_field) or "")

    # Local storage URL: /storage/<object_name>
    if file_url.startswith("/storage/"):
        _local_storage_dir = Path(__file__).resolve().parents[3] / "storage"
        rel = file_url[len("/storage/"):]
        storage_path = _local_storage_dir / rel
        if storage_path.is_file():
            return _inline_response(storage_path.read_bytes(), storage_path.name)
        raise HTTPException(status_code=404, detail="Khong tim thay file trong local storage.")

    gs_ref = _parse_gs_url(file_url)
    if gs_ref:
        try:
            from google.cloud import storage

            bucket_name, blob_name = gs_ref
            blob = storage.Client().bucket(bucket_name).blob(blob_name)
            content = blob.download_as_bytes()
            return _inline_response(content, Path(blob_name).name)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Khong doc duoc file tu storage: {exc}") from exc

    raise HTTPException(status_code=404, detail="Khong tim thay file tuong ung cho phien nay.")
