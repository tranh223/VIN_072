"""
POST /api/upload — nhận file CSV/PDF/ảnh, chạy pipeline OCR + CSV + Thuế.

Luồng này CHỈ xử lý thuế. Không kết nối Pinecone, không load model BGE.
RAG index được trigger riêng qua POST /api/stores/{store_id}/rag-index
hoặc client gọi trực tiếp RAG service tại :8001/rag/private-ingest.
"""

from __future__ import annotations

import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from ..db import get_database
from ..session_store import SessionData, delete_session, set_session, update_session
from ..services.pipeline_persistence import persist_pipeline_result
from ..services.storage_service import upload_file_to_storage

logger = logging.getLogger(__name__)

router = APIRouter()

_UPLOAD_DIR = Path(__file__).parent.parent.parent.parent / "tmp" / "uploads"
_CSV_EXTS = {".csv"}
_PDF_EXTS = {".pdf"}
_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"}
_DOCUMENT_EXTS = _PDF_EXTS | _IMAGE_EXTS


class UploadResponse(BaseModel):
    job_id: str
    status: str
    message: str
    filename: Optional[str] = None
    file_kind: Optional[str] = None
    csv_filename: Optional[str] = None
    invoice_filename: Optional[str] = None
    user_id: Optional[str] = None
    store_id: Optional[str] = None
    store_name: Optional[str] = None


class DeleteUploadResponse(BaseModel):
    job_id: str
    status: str
    message: str


def _save_upload(file: UploadFile, dest_dir: Path, prefix: str) -> Path:
    suffix = Path(file.filename or "").suffix.lower()
    dest = dest_dir / f"{prefix}{suffix}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return dest


async def _resolve_store(user_id: Optional[str], store_id: Optional[str]) -> dict:
    if not user_id:
        raise HTTPException(400, "Can co user_id de upload du lieu.")
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "user_id khong hop le.")
    if not store_id:
        raise HTTPException(400, "Can chon cua hang truoc khi upload.")
    if not ObjectId.is_valid(store_id):
        raise HTTPException(400, "store_id khong hop le.")
    db = get_database()
    store = await db.stores.find_one({
        "_id": ObjectId(store_id),
        "user_id": ObjectId(user_id),
    })
    if not store:
        raise HTTPException(404, "Khong tim thay cua hang cua nguoi dung hien tai.")
    return store


async def _record_usage_event(
    event_type: str,
    user_id: Optional[str],
    store_id: Optional[str],
    metadata: dict[str, Any] | None = None,
) -> None:
    db = get_database()
    doc = {
        "event_type": event_type,
        "feature": event_type,
        "user_id": ObjectId(user_id) if user_id and ObjectId.is_valid(user_id) else None,
        "store_id": ObjectId(store_id) if store_id and ObjectId.is_valid(store_id) else None,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc),
    }
    try:
        await db.usage_events.insert_one(doc)
    except Exception as exc:
        logger.warning("Could not record usage event %s: %s", event_type, exc)


def _storage_object_name(job_id: str, local_path: Optional[str]) -> str:
    suffix = Path(local_path or "").suffix.lower()
    if suffix in _CSV_EXTS:
        folder = "csv"
    elif suffix in _PDF_EXTS:
        folder = "pdf"
    elif suffix in _IMAGE_EXTS:
        folder = "image"
    else:
        folder = "unknown"
    return f"{folder}/{job_id}{suffix}"


# ─── Luồng duy nhất: OCR + CSV + Thuế ───────────────────────────────────────

def _run_extraction_pipeline(
    job_id: str,
    csv_path: Optional[str],
    invoice_path: Optional[str],
    user_id: str,
    store_id: str,
    store: dict[str, Any],
    period_month: Optional[int] = None,
    period_year: Optional[int] = None,
    upload_kind: Optional[str] = None,
    evidence_category: Optional[str] = None,
) -> None:
    """OCR + CSV + Thuế (LangGraph). Không đụng đến RAG/Pinecone/BGE."""
    from ...io_encoding import ensure_stdio_utf8
    ensure_stdio_utf8()
    from ...main import main  # lazy import tránh circular

    try:
        logger.info("[Extract] Bat dau - job_id=%s", job_id)
        csv_url = upload_file_to_storage(csv_path, _storage_object_name(job_id, csv_path))
        invoice_url = upload_file_to_storage(invoice_path, _storage_object_name(job_id, invoice_path))
        update_session(job_id, csv_url=csv_url, invoice_url=invoice_url)

        result = main(image_path=invoice_path, csv_path=csv_path)
        inserted = persist_pipeline_result(
            job_id=job_id,
            user_id=user_id,
            store_id=store_id,
            store=store,
            result=result,
            csv_url=csv_url,
            invoice_url=invoice_url,
            invoice_path=invoice_path,
            period_month_override=period_month,
            period_year_override=period_year,
            upload_kind=upload_kind,
            evidence_category=evidence_category,
        )
        update_session(job_id, status="done", result=result, db_inserted=inserted)
        logger.info("[Extract] Hoan tat - job_id=%s", job_id)
    except Exception as exc:
        logger.error("[Extract] Loi - job_id=%s | %s", job_id, exc)
        update_session(job_id, status="error", error=str(exc))


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse, status_code=202)
async def upload_files(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None, description="File CSV, PDF hoac anh"),
    csv_file: Optional[UploadFile] = File(None, description="File CSV doanh thu san TMĐT"),
    invoice_file: Optional[UploadFile] = File(None, description="Hoa don / chung tu PDF hoac anh"),
    user_id: Optional[str] = Form(None, description="Nguoi dung dang upload"),
    store_id: Optional[str] = Form(None, description="Cua hang duoc chon de gan voi upload"),
    period_month: Optional[int] = Form(None, description="Thang bao cao 1-12 (nguoi dung chon)"),
    period_year: Optional[int] = Form(None, description="Nam bao cao"),
    upload_kind: Optional[str] = Form(
        None,
        description="sales_csv | evidence | bundle — loai phien upload",
    ),
    evidence_category: Optional[str] = Form(
        None,
        description="Loai chung tu do nguoi dung chon (tieng Viet, khi co file chung cu)",
    ),
):
    """
    Upload file CSV + hóa đơn → chạy pipeline OCR/CSV/Thuế.

    **Chỉ liên quan đến thuế.** RAG index KHÔNG chạy ở đây.
    Để index RAG sau khi upload: gọi POST /api/stores/{store_id}/rag-index.
    """
    job_id = str(uuid.uuid4())
    dest_dir = _UPLOAD_DIR / job_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    csv_path: Optional[str] = None
    invoice_path: Optional[str] = None
    file_kind: Optional[str] = None
    filename: Optional[str] = None
    csv_filename: Optional[str] = None
    invoice_filename: Optional[str] = None

    store = await _resolve_store(user_id, store_id)
    store_name = str(store.get("store_name") or store.get("store_code") or store_id)

    if file is not None:
        ext = Path(file.filename or "").suffix.lower()
        if ext in _CSV_EXTS:
            file_kind = "csv"
            filename = file.filename
            csv_filename = file.filename
            csv_path = str(_save_upload(file, dest_dir, "csv"))
        elif ext in _DOCUMENT_EXTS:
            file_kind = "document"
            filename = file.filename
            invoice_filename = file.filename
            invoice_path = str(_save_upload(file, dest_dir, "document"))
        else:
            allowed = sorted(_CSV_EXTS | _DOCUMENT_EXTS)
            raise HTTPException(400, f"Dinh dang '{ext}' khong ho tro. Ho tro: {', '.join(allowed)}")
    else:
        if csv_file is None and invoice_file is None:
            raise HTTPException(400, "Can chon it nhat mot file CSV, PDF hoac anh.")
        if csv_file is not None:
            csv_ext = Path(csv_file.filename or "").suffix.lower()
            if csv_ext not in _CSV_EXTS:
                raise HTTPException(400, f"csv_file phai la .csv (nhan: '{csv_ext}')")
            csv_filename = csv_file.filename
            csv_path = str(_save_upload(csv_file, dest_dir, "csv"))
        if invoice_file is not None:
            doc_ext = Path(invoice_file.filename or "").suffix.lower()
            if doc_ext not in _DOCUMENT_EXTS:
                allowed_docs = ", ".join(sorted(_DOCUMENT_EXTS))
                raise HTTPException(400, f"invoice_file phai la mot trong: {allowed_docs} (nhan: '{doc_ext}')")
            invoice_filename = invoice_file.filename
            invoice_path = str(_save_upload(invoice_file, dest_dir, "document"))
        if csv_path and invoice_path:
            file_kind = "bundle"
            filename = f"{csv_file.filename} + {invoice_file.filename}"
        elif csv_path:
            file_kind = "csv"
            filename = csv_file.filename if csv_file else None
        else:
            file_kind = "document"
            filename = invoice_file.filename if invoice_file else None

    set_session(SessionData(
        job_id=job_id,
        csv_path=csv_path,
        invoice_path=invoice_path,
        filename=filename,
        file_kind=file_kind,
        user_id=user_id,
        store_id=store_id,
        store_name=store_name,
        status="processing",
    ))
    await _record_usage_event(
        "data_upload", user_id, store_id,
        {"job_id": job_id, "file_kind": file_kind, "has_csv": bool(csv_path), "has_invoice": bool(invoice_path)},
    )

    # Chỉ 1 background task: thuế/OCR/CSV — không có RAG
    background_tasks.add_task(
        _run_extraction_pipeline,
        job_id, csv_path, invoice_path,
        user_id, store_id, store,
        period_month, period_year, upload_kind, evidence_category,
    )

    return UploadResponse(
        job_id=job_id,
        status="processing",
        filename=filename,
        file_kind=file_kind,
        csv_filename=csv_filename,
        invoice_filename=invoice_filename,
        user_id=user_id,
        store_id=store_id,
        store_name=store_name,
        message="Dang xu ly OCR/CSV/thue. Poll /extraction va /tax theo job_id.",
    )


@router.delete("/upload/{job_id}", response_model=DeleteUploadResponse)
def delete_upload(job_id: str):
    session = delete_session(job_id)
    upload_dir = _UPLOAD_DIR / job_id
    if session is None and not upload_dir.exists():
        raise HTTPException(404, f"Khong tim thay job_id: '{job_id}'")
    if upload_dir.exists():
        shutil.rmtree(upload_dir)
    logger.info("[Upload] Da xoa upload/session - job_id=%s", job_id)
    return DeleteUploadResponse(
        job_id=job_id,
        status="deleted",
        message="Da xoa file upload va session lien quan.",
    )
