"""
app.py — điểm khởi động FastAPI cho VIN Tax Agent.

Chạy:
    uvicorn src.api.app:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ..io_encoding import ensure_stdio_utf8
from .db import close_mongo_client, warm_database
from .routes import (
    upload,
    extraction,
    tax,
    explain,
    correction,
    report,
    jobs,
    database,
    stores,
    audit_logs,
    summaries,
    documents,
    auth,
    admin,
    feedback,
    rag_mongo,
    notifications,
)

# Trước mọi request / BackgroundTask — tránh UnicodeEncodeError (emoji, tiếng Việt) trên Windows.
ensure_stdio_utf8()

STORAGE_DIR = Path(__file__).resolve().parents[2] / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_stdio_utf8()
    warmup_task = asyncio.create_task(warm_database())
    try:
        yield
    finally:
        if not warmup_task.done():
            warmup_task.cancel()
        close_mongo_client()


app = FastAPI(
    lifespan=lifespan,
    title="Scaify API",
    version="1.0.0",
    description=(
        "Backend tính thuế GTGT + TNCN cho hộ kinh doanh TMĐT Việt Nam (port 8000).\n\n"
        "**Luồng thuế (upload):**\n"
        "1. `POST /api/upload` — tải CSV/PDF/ảnh; chạy nền pipeline OCR + CSV + thuế. **Không index RAG.**\n"
        "2. `GET  /api/{job_id}/extraction` — poll kết quả trích xuất (CSV + OCR) cho đến `status=done`\n"
        "3. `GET  /api/{job_id}/tax` — kết quả tính thuế + dashboard + cảnh báo (cùng lúc với extraction)\n"
        "4. `GET  /api/{job_id}/explain` — giải thích từng cảnh báo\n"
        "5. `POST /api/{job_id}/correction` — sửa dữ liệu, tính lại thuế\n"
        "6. `GET  /api/{job_id}/report` — tải báo cáo CSV\n\n"
        "**Luồng RAG (tách biệt, service :8001):**\n"
        "- `POST /api/stores/{store_id}/rag-index` — kích hoạt index Pinecone cho cửa hàng (gọi sang RAG service)\n"
        "- `POST /api/stores` — tạo cửa hàng có thể tự schedule index RAG nền\n"
        "- Hỏi đáp pháp lý: RAG service `POST /rag/stream-rich` (proxy nginx `/rag` → :8001)"
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")

@app.get("/api/health", tags=["Health"])
def api_health():
    return {"status": "ok", "service": "Scaify API"}


app.include_router(jobs.router,        prefix="/api", tags=["0. Jobs"])
app.include_router(upload.router,     prefix="/api", tags=["1. Upload"])
app.include_router(extraction.router, prefix="/api", tags=["2. Extraction"])
app.include_router(tax.router,        prefix="/api", tags=["3. Tax"])
app.include_router(explain.router,    prefix="/api", tags=["4. Explain"])
app.include_router(correction.router, prefix="/api", tags=["5. Correction"])
app.include_router(report.router,     prefix="/api", tags=["6. Report"])
app.include_router(database.router,   prefix="/api", tags=["7. Database"])
app.include_router(stores.router,     prefix="/api", tags=["8. Stores"])
app.include_router(audit_logs.router, prefix="/api", tags=["9. Audit Logs"])
app.include_router(summaries.router,  prefix="/api", tags=["10. Summaries"])
app.include_router(documents.router,  prefix="/api", tags=["10b. Documents"])
app.include_router(auth.router,       prefix="/api", tags=["11. Auth"])
app.include_router(admin.router,      prefix="/api", tags=["12. Admin"])
app.include_router(feedback.router,   prefix="/api", tags=["13. Feedback"])
app.include_router(rag_mongo.router,  prefix="/api", tags=["14. Mongo RAG"])
app.include_router(notifications.router, prefix="/api", tags=["15. Notifications"])


@app.get("/", tags=["Health"])
def health():
    return {"status": "ok", "service": "Scaify API"}
