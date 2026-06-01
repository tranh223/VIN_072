from __future__ import annotations

from typing import Any, Literal

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from ..db import get_database
from ..services.mongo_rag_ingest import (
    PRIVATE_NAMESPACE,
    PUBLIC_NAMESPACE,
    MongoRagIngestor,
)

router = APIRouter()


class MongoRagIngestRequest(BaseModel):
    scope: Literal["public", "private", "all"] = "public"
    user_id: str | None = Field(None, description="Required only to limit private ingest to one user")
    store_id: str | None = Field(None, description="Optional store limit for private ingest")
    limit: int = Field(500, ge=1, le=2000)
    dry_run: bool = False
    clear_namespace: bool = False
    public_namespace: str = PUBLIC_NAMESPACE
    private_namespace: str = PRIVATE_NAMESPACE


class MongoRagSearchRequest(BaseModel):
    query: str = Field(..., min_length=3)
    user_id: str = Field(..., min_length=1)
    store_id: str | None = None
    top_k: int = Field(8, ge=1, le=20)
    namespace: str = PRIVATE_NAMESPACE


async def _require_admin(admin_user_id: str | None) -> dict[str, Any]:
    if not admin_user_id or not ObjectId.is_valid(admin_user_id):
        raise HTTPException(status_code=400, detail="admin_user_id khong hop le.")
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(admin_user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="Khong tim thay tai khoan admin.")
    if user.get("status") != "active" or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chi admin moi co quyen thuc hien.")
    return user


async def _require_user(user_id: str | None) -> dict[str, Any]:
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="user_id khong hop le.")
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id), "status": "active"})
    if not user:
        raise HTTPException(status_code=401, detail="Khong tim thay tai khoan nguoi dung.")
    return user


@router.post("/rag/mongo/ingest")
async def ingest_mongo_rag(
    payload: MongoRagIngestRequest,
    admin_user_id: str = Query(...),
):
    await _require_admin(admin_user_id)
    if payload.user_id and not ObjectId.is_valid(payload.user_id):
        raise HTTPException(status_code=400, detail="user_id khong hop le.")
    if payload.store_id and not ObjectId.is_valid(payload.store_id):
        raise HTTPException(status_code=400, detail="store_id khong hop le.")

    def run() -> dict[str, Any]:
        ingestor = MongoRagIngestor()
        try:
            result: dict[str, Any] = {"scope": payload.scope, "dry_run": payload.dry_run}
            if payload.scope in {"public", "all"}:
                result["public"] = ingestor.ingest_public(
                    limit=payload.limit,
                    namespace=payload.public_namespace,
                    dry_run=payload.dry_run,
                    clear=payload.clear_namespace,
                )
            if payload.scope in {"private", "all"}:
                result["private"] = ingestor.ingest_private(
                    user_id=payload.user_id,
                    store_id=payload.store_id,
                    limit=payload.limit,
                    namespace=payload.private_namespace,
                    dry_run=payload.dry_run,
                    clear=payload.clear_namespace,
                )
            return result
        finally:
            ingestor.close()

    try:
        return await run_in_threadpool(run)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Mongo RAG ingest failed: {exc}") from exc


@router.post("/rag/private/search")
async def private_rag_search(payload: MongoRagSearchRequest):
    await _require_user(payload.user_id)
    if payload.store_id and not ObjectId.is_valid(payload.store_id):
        raise HTTPException(status_code=400, detail="store_id khong hop le.")

    def run() -> dict[str, Any]:
        ingestor = MongoRagIngestor()
        try:
            results = ingestor.private_search(
                query=payload.query,
                user_id=payload.user_id,
                store_id=payload.store_id,
                top_k=payload.top_k,
                namespace=payload.namespace,
            )
            return {
                "query": payload.query,
                "namespace": payload.namespace,
                "filter": {
                    "user_id": payload.user_id,
                    **({"store_id": payload.store_id} if payload.store_id else {}),
                },
                "results": results,
            }
        finally:
            ingestor.close()

    try:
        return await run_in_threadpool(run)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Private RAG search failed: {exc}") from exc


@router.get("/rag/mongo/status")
async def mongo_rag_status(admin_user_id: str = Query(...)):
    await _require_admin(admin_user_id)
    db = get_database()
    collections = ["rag_documents", "revenue_reports", "tax_deduction_documents", "tax_estimations"]
    result: dict[str, Any] = {}
    for name in collections:
        result[name] = {
            "total": await db[name].count_documents({}),
            "indexed": await db[name].count_documents({"rag_index_status": "indexed"}),
            "failed": await db[name].count_documents({"rag_index_status": "failed"}),
        }
    return {
        "public_namespace": PUBLIC_NAMESPACE,
        "private_namespace": PRIVATE_NAMESPACE,
        "collections": result,
    }
