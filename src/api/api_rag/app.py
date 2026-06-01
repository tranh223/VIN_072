"""
app.py — Standalone FastAPI application cho RAG pipeline.

Chạy:
    # Từ thư mục gốc (A20-App-072):
    uvicorn src.api.api_rag.app:app --reload --host 0.0.0.0 --port 8001

    # Hoặc chạy trực tiếp file này:
    python src/api/api_rag/app.py

Swagger UI: http://localhost:8001/docs
ReDoc:       http://localhost:8001/redoc

Endpoints:
    GET  /rag/health      — kiểm tra trạng thái (Pinecone + model)
    POST /rag/stream-rich — hỏi đáp pháp lý streaming SSE (token realtime + metadata đầy đủ)
    POST /rag/ingest      — re-index tài liệu admin (MongoDB → Pinecone)
"""

from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Đảm bảo src/ có trong sys.path
_src_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from .router import get_generator, router  # noqa: E402

logger = logging.getLogger("api_rag")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


# ─── Lifespan ────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Warm-up: Khởi tạo AnswerGenerator (load model, kết nối Pinecone) trước
    khi nhận request đầu tiên để tránh timeout.
    """
    logger.info("RAG API — khởi động, warm-up pipeline...")
    tracing_on = (
        os.getenv("LANGSMITH_TRACING", "").lower() in ("true", "1")
        or os.getenv("LANGCHAIN_TRACING_V2", "").lower() in ("true", "1")
    )
    if tracing_on:
        proj = os.getenv("LANGSMITH_PROJECT") or os.getenv("LANGCHAIN_PROJECT", "")
        logger.info("LangSmith tracing bật — project=%s", proj or "(default)")

    try:
        gen = get_generator()
        searcher = gen._get_searcher()
        status_msg = (
            f"dense_ready={searcher._dense_ready}, "
            f"model={gen.model}"
        )
        logger.info("Pipeline sẵn sàng: %s", status_msg)
    except Exception as exc:
        logger.warning("Warm-up cảnh báo (app vẫn chạy): %s", exc)

    yield

    logger.info("RAG API — đóng ứng dụng.")


# ─── App ─────────────────────────────────────────────────────────────────────


app = FastAPI(
    lifespan=lifespan,
    title="Scaify RAG API",
    version="1.0.0",
    description=(
        "API test pipeline RAG cho tra cứu văn bản pháp lý thuế Việt Nam.\n\n"
        "**Pipeline:**\n"
        "```\n"
        "Query\n"
        "  → Hybrid Search (BM25 + Pinecone Dense + RRF)\n"
        "  → Rerank (Jina API, model jina-reranker-v3)\n"
        "  → LLM (OpenAI gpt-4o)\n"
        "  → Hallucination Guard\n"
        "  → GenerationResult\n"
        "```\n\n"
        "**Bắt đầu nhanh:**\n"
        "1. Đảm bảo `.env` có `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `PINECONE_PUBLIC_NAMESPACE`, `DEFAULT_API_KEY`, `DEFAULT_BASE_URL`, `DEFAULT_MODEL_ID`, và **`JINA_API_KEY`** (rerank).\n"
        "2. Thêm nội dung trên **trang admin** (status=active) — tự index Pinecone; hoặc `POST /rag/ingest` để re-index hàng loạt.\n"
        "3. Gọi `POST /rag/stream-rich` với `{\"query\": \"câu hỏi của bạn\"}`."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", tags=["Health"], summary="Root health check")
def root():
    return {"status": "ok", "service": "Scaify RAG API", "docs": "/docs"}


# ─── Dev runner ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn  # type: ignore[import-untyped]

    uvicorn.run(
        "src.api.api_rag.app:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        reload_dirs=[_src_dir],
        log_level="info",
    )
