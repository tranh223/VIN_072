"""
schemas.py — Pydantic request / response models cho RAG API.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ─── Request ──────────────────────────────────────────────────────────────────


class AskRequest(BaseModel):
    query: str = Field(..., min_length=3, description="Câu hỏi pháp lý / thuế")
    retrieve_top_k: int = Field(20, ge=1, le=50, description="Số candidates từ retrieval trước rerank")
    rerank_top_k: int = Field(3, ge=1, le=10, description="Số context đưa vào LLM sau rerank")
    clarification_count: int = Field(
        0,
        ge=0,
        le=3,
        description="Số lượt bot đã hỏi lại liên tiếp trong hội thoại hiện tại",
    )
    conversation_summary: str | None = Field(
        None,
        max_length=4000,
        description="Tóm tắt ngắn lịch sử hội thoại do frontend lưu tạm",
    )
    recent_messages: list[dict[str, str]] = Field(
        default_factory=list,
        max_length=20,
        description="Tối đa 10 tin nhắn gần nhất trong hội thoại tạm",
    )
    metadata_filter: dict[str, Any] | None = Field(
        None,
        description=(
            "Pinecone metadata filter (tuỳ chọn). "
            'Ví dụ: {"chuong": {"$eq": "I"}, "dieu": {"$eq": "5"}}'
        ),
    )

    model_config = {"json_schema_extra": {"example": {"query": "Thuế giá trị gia tăng là gì?"}}}


class PrivateIngestRequest(BaseModel):
    """Trigger index RAG private store — gọi từ backend (8000) sau khi upload xong."""

    user_id: str = Field(..., description="ID người dùng sở hữu cửa hàng")
    store_id: str = Field(..., description="ID cửa hàng cần index")
    reason: str = Field("upload_processed", description="Lý do index: upload_processed | store_created | manual")
    inserted: dict[str, Any] | None = Field(
        None,
        description="Dict ID đã insert (revenue_reports, tax_estimations, audit_logs…)",
    )
    limit: int = Field(500, ge=1, le=2000, description="Số bản ghi tối đa cần index")
    namespace: str = Field("user-data", description="Pinecone private namespace")

    model_config = {
        "json_schema_extra": {
            "example": {
                "user_id": "64a1b2c3d4e5f6a7b8c9d0e1",
                "store_id": "64a1b2c3d4e5f6a7b8c9d0e2",
                "reason": "upload_processed",
            }
        }
    }


class PrivateIngestResponse(BaseModel):
    status: str
    user_id: str
    store_id: str
    reason: str
    namespace: str
    documents: int = 0
    chunks_upserted: int = 0
    error: str | None = None


class IngestRequest(BaseModel):
    """Re-index toàn bộ tài liệu active từ MongoDB rag_documents (nguồn admin upload)."""

    limit: int = Field(500, ge=1, le=2000, description="Số tài liệu active tối đa cần index")
    namespace: str = Field(
        "",
        description='Pinecone namespace ("" = default namespace, hoặc PINECONE_PUBLIC_NAMESPACE)',
    )
    dry_run: bool = Field(False, description="Nếu True, chỉ tính chunk không upsert lên Pinecone")
    clear_namespace: bool = Field(
        False,
        description="Xóa toàn bộ vectors trong namespace trước khi upsert",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "limit": 500,
                "namespace": "",
                "dry_run": False,
                "clear_namespace": False,
            }
        }
    }


class ConversationMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    text: str = Field(..., min_length=1, max_length=2000)


class ConversationSummaryRequest(BaseModel):
    previous_summary: str | None = Field(
        None,
        max_length=4000,
        description="Tóm tắt hội thoại đã có trước đó",
    )
    messages: list[ConversationMessage] = Field(
        default_factory=list,
        max_length=60,
        description="Các tin nhắn mới hoặc toàn bộ phiên tạm cần cập nhật vào summary",
    )


class ConversationSummaryResponse(BaseModel):
    summary: str
    model: str
    tokens_used: int


# ─── Response ─────────────────────────────────────────────────────────────────


class CitationOut(BaseModel):
    dieu: str
    law_id: str
    law_name: str
    text_snippet: str
    source: str
    url: str = ""


class ContextOut(BaseModel):
    text: str
    rerank_score: float
    metadata: dict[str, Any]


class AskResponse(BaseModel):
    query: str
    answer: str = Field(
        ...,
        description="Câu trả lời định dạng Markdown (tiêu đề, danh sách, bảng GFM, liên kết).",
    )
    citations: list[CitationOut]
    contexts_used: list[ContextOut]
    is_hallucination_risk: bool
    hallucination_reason: str
    latency_ms: float
    model: str
    tokens_used: int


class IngestResponse(BaseModel):
    status: str
    namespace: str
    documents: int = 0
    chunks_total: int
    chunks_upserted: int
    dry_run: bool
    message: str


class HealthResponse(BaseModel):
    status: str
    pinecone_index: str
    dense_ready: bool
    model: str
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    detail: str
