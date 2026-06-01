"""GET /api/jobs — danh sách phiên xử lý (in-memory)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..session_store import list_sessions_newest_first

router = APIRouter()


class JobSummary(BaseModel):
    job_id: str
    status: str
    filename: Optional[str] = None
    file_kind: Optional[str] = None
    user_id: Optional[str] = None
    store_id: Optional[str] = None
    store_name: Optional[str] = None
    error: Optional[str] = None


class JobsListResponse(BaseModel):
    jobs: list[JobSummary]


@router.get("/jobs", response_model=JobsListResponse)
def list_jobs(user_id: Optional[str] = Query(None)):
    if not user_id:
        return JobsListResponse(jobs=[])

    items: list[JobSummary] = []
    for s in list_sessions_newest_first():
        if s.user_id != user_id:
            continue
        items.append(
            JobSummary(
                job_id=s.job_id,
                status=s.status,
                filename=s.filename,
                file_kind=s.file_kind,
                user_id=s.user_id,
                store_id=s.store_id,
                store_name=s.store_name,
                error=s.error if s.status == "error" else None,
            )
        )
    return JobsListResponse(jobs=items)
