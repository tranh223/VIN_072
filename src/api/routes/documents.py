"""
GET /api/documents — kho chứng cứ / hồ sơ tham khảo của user (đọc từ DB).

Nguồn:
  - revenue_reports (snapshot doanh thu đã import)
  - tax_deduction_documents (chứng cứ giao dịch đã phân tích)
  - audit_logs (phiên upload có job_id)

Giá trị `status` trả về giữ cố định (vd. \"Đã xác nhận\") để khớp bộ lọc UI.
"""

from __future__ import annotations

import csv
import html
import io
import mimetypes
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse
from urllib.request import url2pathname

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel

from ..db import get_database, serialize_mongo

router = APIRouter()
_UPLOAD_DIR = Path(__file__).parent.parent.parent.parent / "tmp" / "uploads"


class DocumentItem(BaseModel):
    id: str
    store_id: str
    store_name: str | None = None
    period: str | None = None
    document_type: str  # 'dữ liệu bán hàng' | 'chứng cứ giao dịch' | 'hóa đơn / biên nhận' | 'sao kê / screenshot' | 'hoàn trả / hủy đơn' | 'khác'
    source_channel: str  # 'upload thủ công' | 'OCR/VLM' | 'import từ file'
    status: str  # 'Đã xác nhận' | 'Cần xem lại' | 'Thiếu thông tin' | 'Đã dùng cho hồ sơ' | 'Chưa phân loại'
    filename: str | None = None
    file_url: str | None = None
    file_kind: str | None = None  # 'csv' | 'pdf' | 'image'
    job_id: str | None = None
    user_id: str | None = None
    uploaded_at: str | None = None
    confirmed_at: str | None = None
    confidence: float | None = None
    tags: list[str] = []


class DocumentsListResponse(BaseModel):
    documents: list[DocumentItem]
    total: int


def _extract_store_name(store_id: ObjectId, stores_cache: dict[str, str]) -> str:
    sid = str(store_id)
    return stores_cache.get(sid) or sid


def _format_period(month: int | None, year: int | None) -> str | None:
    if month and year:
        return f"{month:02d}/{year}"
    if year:
        return str(year)
    return None


def _media_type(filename: str) -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def _inline_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type=_media_type(filename),
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


def _filename_with_extension(filename: str | None, fallback: str) -> str:
    if filename and Path(str(filename)).suffix:
        return str(filename)
    if filename and Path(fallback).suffix:
        return f"{filename}{Path(fallback).suffix}"
    return filename or fallback


def _local_upload_path(job_id: str | None, kind: str) -> Path | None:
    if not job_id:
        return None
    prefix = "csv" if kind == "csv" else "document"
    upload_dir = _UPLOAD_DIR / str(job_id)
    if not upload_dir.exists():
        return None
    matches = sorted(upload_dir.glob(f"{prefix}.*"))
    return matches[0] if matches else None


def _csv_response_from_records(records: list[Any], filename: str) -> Response | None:
    dict_records = [r for r in records if isinstance(r, dict)]
    if not dict_records:
        return None

    headers: list[str] = []
    seen: set[str] = set()
    for record in dict_records:
        for key in record.keys():
            text_key = str(key)
            if text_key not in seen:
                seen.add(text_key)
                headers.append(text_key)

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    for record in dict_records:
        writer.writerow({str(k): v for k, v in record.items()})

    return Response(
        content=buf.getvalue().encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


def _collect_preview_text(value: Any, parts: list[str]) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            key_text = str(key).lower()
            if isinstance(item, str) and key_text in {
                "text",
                "raw_text",
                "markdown",
                "content",
                "description",
                "summary",
            }:
                stripped = item.strip()
                if stripped:
                    parts.append(stripped)
            else:
                _collect_preview_text(item, parts)
    elif isinstance(value, list):
        for item in value:
            _collect_preview_text(item, parts)


def _collect_scalar_lines(value: Any, lines: list[str], prefix: str = "") -> None:
    if len(lines) >= 80:
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if str(key).startswith("_"):
                continue
            next_prefix = f"{prefix}.{key}" if prefix else str(key)
            _collect_scalar_lines(item, lines, next_prefix)
    elif isinstance(value, list):
        for index, item in enumerate(value[:10]):
            _collect_scalar_lines(item, lines, f"{prefix}[{index}]")
    elif value not in (None, "", "N/A"):
        lines.append(f"{prefix}: {value}")


def _redact_preview_text(text: str) -> str:
    patterns = [
        r"(?i)(api key provided:\s*)[^'\"}\s]+",
        r"(?i)(api[_-]?key[\"']?\s*[:=]\s*[\"']?)[^'\"}\s]+",
        r"sk-[A-Za-z0-9_-]{12,}",
        r"AIza[0-9A-Za-z_-]{20,}",
        r"\bK[0-9A-Za-z_-]{12,}\b",
    ]
    redacted = text
    for pattern in patterns:
        redacted = re.sub(pattern, lambda m: f"{m.group(1)}[redacted]" if m.lastindex else "[redacted]", redacted)
    return redacted


def _html_preview_response(title: str, source: dict[str, Any] | None) -> Response | None:
    if not source:
        return None

    parts: list[str] = []
    _collect_preview_text(source, parts)
    if not parts:
        scalar_lines: list[str] = []
        _collect_scalar_lines(source, scalar_lines)
        parts = scalar_lines
    if not parts:
        return None

    body = _redact_preview_text("\n\n".join(dict.fromkeys(parts)))
    escaped_title = html.escape(title)
    escaped_body = html.escape(body)
    content = f"""<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>{escaped_title}</title>
  <style>
    body {{ font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; padding: 24px; color: #1f2937; }}
    h1 {{ font-size: 18px; margin: 0 0 8px; }}
    p {{ color: #6b7280; margin: 0 0 20px; }}
    pre {{ white-space: pre-wrap; word-break: break-word; line-height: 1.55; font-size: 13px; }}
  </style>
</head>
<body>
  <h1>{escaped_title}</h1>
  <p>Không tìm thấy file gốc trong storage hiện tại; đang hiển thị nội dung đã trích xuất.</p>
  <pre>{escaped_body}</pre>
</body>
</html>"""
    return Response(content=content.encode("utf-8"), media_type="text/html; charset=utf-8")


def _parse_gs_url(value: str | None) -> tuple[str, str] | None:
    if not value or not value.startswith("gs://"):
        return None
    rest = value[5:]
    bucket, _, blob_name = rest.partition("/")
    if not bucket or not blob_name:
        return None
    return bucket, blob_name


def _local_path_from_url(value: str | None) -> Path | None:
    if not value:
        return None
    raw = str(value)
    if raw.startswith("file://"):
        parsed = urlparse(raw)
        return Path(url2pathname(unquote(parsed.path)))
    path = Path(raw)
    return path if path.is_absolute() else None


_LOCAL_STORAGE_DIR = Path(__file__).resolve().parents[3] / "storage"


async def _serve_file_url(file_url: str | None, filename: str | None = None):
    if not file_url:
        raise HTTPException(status_code=404, detail="File khong co URL.")

    if file_url.startswith(("http://", "https://")):
        return RedirectResponse(file_url)

    # URL local storage: /storage/<object_name>
    if file_url.startswith("/storage/"):
        rel = file_url[len("/storage/"):]
        local_path = _LOCAL_STORAGE_DIR / rel
        if local_path.is_file():
            return _inline_response(
                local_path.read_bytes(),
                _filename_with_extension(filename, local_path.name),
            )
        raise HTTPException(status_code=404, detail="Khong tim thay file trong local storage.")

    local_path = _local_path_from_url(file_url)
    if local_path and local_path.is_file():
        return _inline_response(
            local_path.read_bytes(),
            _filename_with_extension(filename, local_path.name),
        )

    gs_ref = _parse_gs_url(file_url)
    if gs_ref:
        try:
            from google.cloud import storage

            bucket_name, blob_name = gs_ref
            blob = storage.Client().bucket(bucket_name).blob(blob_name)
            return _inline_response(
                blob.download_as_bytes(),
                _filename_with_extension(filename, Path(blob_name).name),
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Khong doc duoc file tu storage: {exc}") from exc

    raise HTTPException(status_code=404, detail="Khong tim thay file tuong ung.")


@router.get("/documents/{document_id}/file")
async def view_document_file(
    document_id: str,
    user_id: str | None = Query(None),
    kind: str | None = Query(None),
):
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="user_id khong hop le.")
    user_oid = ObjectId(user_id)
    db = get_database()

    store_docs = await db.stores.find({"user_id": user_oid}, {"_id": 1}).to_list(length=500)
    user_store_ids = [s["_id"] for s in store_docs]
    if not user_store_ids:
        raise HTTPException(status_code=404, detail="Khong tim thay file tuong ung.")

    if document_id.startswith("audit_"):
        audit_id = document_id.removeprefix("audit_")
        if not ObjectId.is_valid(audit_id):
            raise HTTPException(status_code=400, detail="document_id khong hop le.")
        log = await db.audit_logs.find_one({"_id": ObjectId(audit_id), "actor_id": user_oid})
        if not log:
            raise HTTPException(status_code=404, detail="Khong tim thay audit log.")
        new_value = log.get("new_value") if isinstance(log.get("new_value"), dict) else {}
        file_url = new_value.get("csv_url") if kind == "csv" else new_value.get("invoice_url") or new_value.get("csv_url")
        filename = new_value.get("csv_filename") if kind == "csv" else new_value.get("invoice_filename") or new_value.get("csv_filename")
        local_path = _local_upload_path(str(new_value.get("job_id") or ""), kind or "invoice")
        if local_path and local_path.is_file():
            return _inline_response(local_path.read_bytes(), _filename_with_extension(filename, local_path.name))
        try:
            return await _serve_file_url(file_url, filename)
        except HTTPException as exc:
            inserted = new_value.get("inserted") if isinstance(new_value.get("inserted"), dict) else {}
            deduction_ids = inserted.get("tax_deduction_documents") if isinstance(inserted.get("tax_deduction_documents"), list) else []
            for deduction_id in deduction_ids:
                if ObjectId.is_valid(str(deduction_id)):
                    deduction_doc = await db.tax_deduction_documents.find_one({"_id": ObjectId(str(deduction_id))})
                    parsed_json = deduction_doc.get("parsed_json") if isinstance(deduction_doc, dict) and isinstance(deduction_doc.get("parsed_json"), dict) else {}
                    fallback_source = {"parsed_json": parsed_json, "document": deduction_doc}
                    fallback = _html_preview_response(filename or "Chứng từ đã trích xuất", fallback_source)
                    if fallback is not None:
                        return fallback
            raise exc

    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="document_id khong hop le.")
    oid = ObjectId(document_id)

    revenue_doc = await db.revenue_reports.find_one({"_id": oid, "store_id": {"$in": user_store_ids}})
    if revenue_doc:
        month = revenue_doc.get("month")
        year = revenue_doc.get("year")
        filename = f"doanhthu_{year}_{month:02d}.csv" if year and month else "doanhthu.csv"
        try:
            return await _serve_file_url(revenue_doc.get("source_csv_url"), filename)
        except HTTPException as exc:
            raw_data = revenue_doc.get("raw_data") if isinstance(revenue_doc.get("raw_data"), dict) else {}
            fallback = _csv_response_from_records(raw_data.get("records") or [], filename)
            if fallback is not None:
                return fallback
            raise exc

    deduction_doc = await db.tax_deduction_documents.find_one({"_id": oid, "store_id": {"$in": user_store_ids}})
    if deduction_doc:
        file_url = deduction_doc.get("pdf_url") or deduction_doc.get("image_url")
        filename = deduction_doc.get("document_number") or (str(file_url).split("/")[-1] if file_url else "document")
        parsed_json = deduction_doc.get("parsed_json") if isinstance(deduction_doc.get("parsed_json"), dict) else {}
        local_path = _local_upload_path(str(parsed_json.get("job_id") or ""), "invoice")
        if local_path and local_path.is_file():
            return _inline_response(local_path.read_bytes(), _filename_with_extension(filename, local_path.name))
        try:
            return await _serve_file_url(file_url, filename)
        except HTTPException as exc:
            fallback_source = {"parsed_json": parsed_json, "document": deduction_doc}
            fallback = _html_preview_response(filename or "Chứng từ đã trích xuất", fallback_source)
            if fallback is not None:
                return fallback
            raise exc

    raise HTTPException(status_code=404, detail="Khong tim thay file tuong ung.")


@router.get("/documents", response_model=DocumentsListResponse)
async def list_documents(
    user_id: str | None = Query(None, description="Filter by user"),
    store_id: str | None = Query(None, description="Filter by store"),
    period: str | None = Query(None, description="Filter by period (MM/YYYY or YYYY)"),
    document_type: str | None = Query(None, description="Filter by document type"),
    status: str | None = Query(None, description="Filter by status"),
    source_channel: str | None = Query(None, description="Filter by source channel"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    if not user_id:
        return {"documents": [], "total": 0}
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="user_id khong hop le.")

    db = get_database()
    user_oid = ObjectId(user_id)

    # ── Lấy danh sách stores ──────────────────────────────────────────────
    store_docs = await db.stores.find({"user_id": user_oid}).to_list(length=500)
    user_store_ids = [s["_id"] for s in store_docs]
    stores_cache: dict[str, str] = {
        str(s["_id"]): s.get("store_name") or s.get("store_code") or str(s["_id"])
        for s in store_docs
    }

    if not user_store_ids:
        return {"documents": [], "total": 0}

    store_filter = user_store_ids
    if store_id:
        if not ObjectId.is_valid(store_id):
            raise HTTPException(status_code=400, detail="store_id khong hop le.")
        store_filter = [ObjectId(store_id)]
    selected_store_id = str(store_filter[0]) if store_id and store_filter else None

    # ── Collect documents từ các collection ──────────────────────────────
    items: list[DocumentItem] = []

    # 1. Revenue reports (dữ liệu bán hàng)
    rev_query: dict[str, Any] = {"store_id": {"$in": store_filter}}
    try:
        rev_docs = await db.revenue_reports.find(rev_query).sort("created_at", -1).to_list(length=500)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}") from exc

    for doc in rev_docs:
        month = doc.get("month")
        year = doc.get("year")
        p = _format_period(month, year)
        sid = doc.get("store_id")
        uploaded = doc.get("created_at")
        item = DocumentItem(
            id=str(doc["_id"]),
            store_id=str(sid) if sid else "",
            store_name=stores_cache.get(str(sid)) if sid else None,
            period=p,
            document_type="dữ liệu bán hàng",
            source_channel="upload thủ công",
            status="Đã xác nhận",
            filename=f"doanhthu_{year}_{month:02d}.csv" if year and month else None,
            file_url=doc.get("source_csv_url"),
            file_kind="csv",
            job_id=None,
            user_id=user_id,
            uploaded_at=serialize_mongo(uploaded) if uploaded else None,
            confirmed_at=serialize_mongo(uploaded) if uploaded else None,
            confidence=None,
            tags=["dữ liệu bán hàng"],
        )
        items.append(item)

    # 2. Tax deduction documents (chứng từ giao dịch)
    ded_query: dict[str, Any] = {"store_id": {"$in": store_filter}}
    try:
        ded_docs = await db.tax_deduction_documents.find(ded_query).sort("created_at", -1).to_list(length=500)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}") from exc

    for doc in ded_docs:
        sid = doc.get("store_id")
        uploaded = doc.get("created_at")
        is_pdf = bool(doc.get("pdf_url") and str(doc.get("pdf_url")).lower().endswith(".pdf"))
        doc_number = doc.get("document_number")
        _file_src = doc.get("pdf_url") or doc.get("image_url") or ""
        filename = (
            doc_number
            if doc_number
            else (_file_src.split("/")[-1] if _file_src else None)
        )
        parsed = doc.get("parsed_json") if isinstance(doc.get("parsed_json"), dict) else {}
        uctx = parsed.get("user_upload_context") if isinstance(parsed.get("user_upload_context"), dict) else {}
        user_ev_cat = uctx.get("evidence_category")
        type_label = (
            str(user_ev_cat).strip()
            if isinstance(user_ev_cat, str) and str(user_ev_cat).strip()
            else ("hóa đơn / biên nhận" if is_pdf else "chứng cứ giao dịch")
        )
        issuer_name = doc.get("issuer_name")
        pm = uctx.get("period_month")
        py = uctx.get("period_year")
        period_str: str | None = None
        try:
            if isinstance(pm, int) and isinstance(py, int) and 1 <= pm <= 12:
                period_str = f"{pm:02d}/{py}"
        except (TypeError, ValueError):
            period_str = None
        if period_str is None and doc.get("tax_year"):
            period_str = str(doc.get("tax_year"))

        item = DocumentItem(
            id=str(doc["_id"]),
            store_id=str(sid) if sid else "",
            store_name=stores_cache.get(str(sid)) if sid else None,
            period=period_str,
            document_type=type_label,
            source_channel="OCR/VLM" if is_pdf else "upload thủ công",
            status="Đã xác nhận",
            filename=filename,
            file_url=doc.get("pdf_url") or doc.get("image_url"),
            file_kind="pdf" if is_pdf else "image",
            job_id=None,
            user_id=user_id,
            uploaded_at=serialize_mongo(uploaded) if uploaded else None,
            confirmed_at=serialize_mongo(uploaded) if uploaded else None,
            confidence=float(doc.get("confidence") or 0) if doc.get("confidence") else None,
            tags=["chứng từ giao dịch"],
        )
        if issuer_name:
            item.tags.append(str(issuer_name))
        items.append(item)

    # 3. Audit logs (các phiên upload có file)
    audit_query: dict[str, Any] = {
        "actor_id": user_oid,
        "new_value.job_id": {"$exists": True, "$ne": None},
    }
    if selected_store_id:
        store_match_values: list[Any] = [selected_store_id]
        if ObjectId.is_valid(selected_store_id):
            store_match_values.append(ObjectId(selected_store_id))
        audit_query["new_value.store_id"] = {"$in": store_match_values}
    try:
        audit_docs = await db.audit_logs.find(audit_query).sort("created_at", -1).limit(200).to_list(length=200)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}") from exc

    for log in audit_docs:
        nv = log.get("new_value") if isinstance(log.get("new_value"), dict) else {}
        job_id = str(nv.get("job_id") or "")
        log_store_id = nv.get("store_id") or ""
        csv_url = nv.get("csv_url")
        invoice_url = nv.get("invoice_url")
        uploaded = log.get("created_at")

        # Nếu đã có trong revenue_reports hoặc tax_deduction_documents → bỏ qua
        if csv_url and any(i.file_url == csv_url for i in items):
            continue
        if invoice_url and any(i.file_url == invoice_url for i in items):
            continue

        uctx = nv.get("upload_context") if isinstance(nv.get("upload_context"), dict) else {}
        pm_l = uctx.get("period_month")
        py_l = uctx.get("period_year")
        audit_period: str | None = None
        try:
            if isinstance(pm_l, int) and isinstance(py_l, int) and 1 <= pm_l <= 12:
                audit_period = f"{pm_l:02d}/{py_l}"
        except (TypeError, ValueError):
            audit_period = None

        # Xác định loại
        if csv_url:
            type_label = "dữ liệu bán hàng"
            kind = "csv"
            url = csv_url
        elif invoice_url:
            is_pdf = str(invoice_url).lower().endswith(".pdf")
            type_label = "hóa đơn / biên nhận" if is_pdf else "chứng cứ giao dịch"
            evcat = uctx.get("evidence_category")
            if isinstance(evcat, str) and evcat.strip():
                type_label = evcat.strip()
            kind = "pdf" if is_pdf else "image"
            url = invoice_url
        else:
            continue

        items.append(DocumentItem(
            id=f"audit_{log['_id']}",
            store_id=log_store_id,
            store_name=stores_cache.get(log_store_id) if log_store_id else None,
            period=audit_period,
            document_type=type_label,
            source_channel="upload thủ công",
            status="Đã xác nhận",
            filename=nv.get("csv_filename") or nv.get("invoice_filename"),
            file_url=url,
            file_kind=kind,
            job_id=job_id,
            user_id=user_id,
            uploaded_at=serialize_mongo(uploaded) if uploaded else None,
            confirmed_at=serialize_mongo(uploaded) if uploaded else None,
        ))

    # ── Apply filters ──────────────────────────────────────────────────
    if period:
        items = [i for i in items if i.period and period in i.period]
    if document_type:
        items = [i for i in items if i.document_type == document_type]
    if status:
        items = [i for i in items if i.status == status]
    if source_channel:
        items = [i for i in items if i.source_channel == source_channel]

    # Sort by uploaded_at desc (newest first), with None at end
    def sort_key(item: DocumentItem) -> str:
        return item.uploaded_at or ""

    items.sort(key=sort_key, reverse=True)

    total = len(items)
    paged = items[offset:offset + limit]

    return DocumentsListResponse(
        documents=paged,
        total=total,
    )
