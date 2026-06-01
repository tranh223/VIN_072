from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..db import ping_database

router = APIRouter()


@router.get("/db/health")
async def db_health():
    try:
        return await ping_database()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
