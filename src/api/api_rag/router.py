"""
router.py — FastAPI router cho RAG pipeline.

Endpoints:
    GET  /rag/health        — kiểm tra trạng thái pipeline
    POST /rag/stream-rich   — hỏi đáp pháp lý (stream + metadata đầy đủ)
    POST /rag/ingest        — re-index tài liệu admin (MongoDB → Pinecone)
"""

from __future__ import annotations

import asyncio
import json
import sys
import os
import re
from functools import lru_cache
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

# Đảm bảo src/ trong sys.path khi router được import trực tiếp
_src_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from config import (  # noqa: E402
    LLM_MODEL,
    PINECONE_INDEX_NAME,
    PINECONE_PUBLIC_NAMESPACE,
    RERANK_TOP_K,
)
from api.services.mongo_rag_ingest import MongoRagIngestor  # noqa: E402
from rag.generation import AnswerGenerator, Citation  # noqa: E402
from rag.generation import (  # noqa: E402
    _check_hallucination,
    _extract_citations,
    _HALLUCINATION_WARNING,
)
from rag.langsmith_trace import trace  # noqa: E402
from rag.search import HybridSearch  # noqa: E402

from .schemas import (  # noqa: E402
    AskRequest,
    CitationOut,
    ConversationSummaryRequest,
    ConversationSummaryResponse,
    ContextOut,
    HealthResponse,
    IngestRequest,
    IngestResponse,
    PrivateIngestRequest,
    PrivateIngestResponse,
)

router = APIRouter(prefix="/rag", tags=["RAG Pipeline"])


# ─── Singleton AnswerGenerator ────────────────────────────────────────────────


@lru_cache(maxsize=1)
def _get_generator() -> AnswerGenerator:
    """Khởi tạo AnswerGenerator một lần duy nhất cho toàn bộ vòng đời app."""
    return AnswerGenerator()


def get_generator() -> AnswerGenerator:
    return _get_generator()


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _serialize_citation(c: Citation) -> CitationOut:
    return CitationOut(
        dieu=c.dieu,
        law_id=c.law_id,
        law_name=c.law_name,
        text_snippet=c.text_snippet,
        source=c.source,
        url=c.url,
    )


# ─── Routes ───────────────────────────────────────────────────────────────────


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Kiểm tra trạng thái RAG pipeline",
)
def rag_health(gen: AnswerGenerator = Depends(get_generator)) -> HealthResponse:
    searcher: HybridSearch = gen._get_searcher()
    return HealthResponse(
        status="ok",
        pinecone_index=PINECONE_INDEX_NAME,
        dense_ready=searcher._dense_ready,
        model=gen.model or LLM_MODEL,
    )


@router.post(
    "/conversation-summary",
    response_model=ConversationSummaryResponse,
    summary="Cập nhật tóm tắt hội thoại tạm",
)
def summarize_conversation(
    req: ConversationSummaryRequest,
    gen: AnswerGenerator = Depends(get_generator),
) -> ConversationSummaryResponse:
    safe_messages = [
        msg for msg in req.messages
        if msg.text and msg.text.strip()
    ][-60:]
    if not safe_messages and not (req.previous_summary or "").strip():
        return ConversationSummaryResponse(summary="", model=gen.model, tokens_used=0)

    lines: list[str] = []
    previous = (req.previous_summary or "").strip()
    if previous:
        lines.append(f"[TÓM TẮT CŨ]\n{previous[:4000]}")
    if safe_messages:
        lines.append("[TIN NHẮN CẦN CẬP NHẬT]")
        for msg in safe_messages:
            role = "Người dùng" if msg.role == "user" else "Bot"
            text = re.sub(r"\s+", " ", msg.text).strip()[:1200]
            lines.append(f"- {role}: {text}")

    prompt = (
        "Bạn cập nhật tóm tắt bộ nhớ hội thoại tạm cho chatbot Scaify.\n"
        "Yêu cầu:\n"
        "- Tóm tắt toàn bộ phiên, không chỉ đoạn cuối.\n"
        "- Giữ lại các sự kiện người dùng đã hỏi/chào/cung cấp, gồm cả câu hỏi ngoài phạm vi, system prompt, trốn thuế, đổi vai trò nếu có.\n"
        "- Giữ dữ kiện riêng: tên shop, nền tảng, doanh thu, năm/kỳ, hóa đơn/chứng từ, mục tiêu kiểm tra.\n"
        "- Giữ các kết luận quan trọng bot đã trả lời, nhưng không cần chép nguyên văn.\n"
        "- Không bịa thông tin không có trong hội thoại.\n"
        "- Viết tiếng Việt, tối đa 1800 ký tự, dạng câu ngắn phân tách bằng dấu chấm phẩy.\n\n"
        + "\n\n".join(lines)
    )

    response = gen._llm.chat.completions.create(
        model=gen.model,
        messages=[
            {
                "role": "system",
                "content": "Bạn là bộ tóm tắt hội thoại nội bộ. Chỉ trả về phần tóm tắt, không giải thích.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
        max_tokens=700,
        top_p=1,
    )
    summary = (response.choices[0].message.content or "").strip()
    tokens = response.usage.total_tokens if response.usage else 0
    return ConversationSummaryResponse(
        summary=summary[:2400],
        model=gen.model,
        tokens_used=int(tokens),
    )


@router.post(
    "/stream-rich",
    summary="Streaming + metadata đầy đủ (token + citations + diagnostics)",
    description=(
        "Kết hợp ưu điểm của `/rag/stream` và `/rag/ask`:\n\n"
        "- Stream token realtime để UI phản hồi nhanh\n"
        "- Cuối stream trả event `final` chứa answer hoàn chỉnh, citations, "
        "hallucination flag và contexts_used\n\n"
        "SSE event format:\n"
        "- `data: {\"type\":\"token\",\"token\":\"...\"}`\n"
        "- `data: {\"type\":\"final\", ...}`\n"
        "- `data: [DONE]`"
    ),
    response_class=StreamingResponse,
)
def stream_rich(
    req: AskRequest,
    gen: AnswerGenerator = Depends(get_generator),
) -> StreamingResponse:
    def _rich_generator():
        original_top_k = gen.rerank_top_k
        gen.rerank_top_k = req.rerank_top_k

        try:
            with trace(
                name="rag.stream_rich",
                run_type="chain",
                inputs={
                    "query": req.query,
                    "retrieve_top_k": req.retrieve_top_k,
                    "rerank_top_k": req.rerank_top_k,
                    "has_conversation_summary": bool(req.conversation_summary),
                    "recent_messages_count": len(req.recent_messages or []),
                },
            ):
                # 1) rewrite (rag.query_rewrite) → retrieve → rerank
                contexts, rewrite = gen.prepare_contexts_for_query(
                    req.query,
                    retrieve_top_k=req.retrieve_top_k,
                    metadata_filter=req.metadata_filter,
                    conversation_summary=req.conversation_summary,
                    recent_messages=req.recent_messages,
                )

                # 2) Build prompt
                from rag.generation import _build_user_message, _format_context_block  # noqa: E402

                context_block = _format_context_block(contexts)
                user_message = _build_user_message(
                    req.query,
                    context_block,
                    clarification_count=req.clarification_count,
                    conversation_summary=req.conversation_summary,
                    recent_messages=req.recent_messages,
                )

                # 3) Stream token realtime
                answer_parts: list[str] = []
                tokens_used = 0
                stream_response = gen._llm.chat.completions.create(
                    model=gen.model,
                    messages=[
                        {"role": "system", "content": gen._system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    temperature=gen.temperature,
                    max_tokens=gen.max_tokens,
                    top_p=gen.top_p,
                    stream=True,
                    stream_options={"include_usage": True},
                )

                for chunk in stream_response:
                    if not chunk.choices:
                        if chunk.usage:
                            tokens_used = chunk.usage.total_tokens or 0
                        continue

                    delta = chunk.choices[0].delta
                    token = delta.content or ""
                    if token:
                        answer_parts.append(token)
                        yield f"data: {json.dumps({'type': 'token', 'token': token}, ensure_ascii=False)}\n\n"

            # 4) Finalize
            raw_answer = "".join(answer_parts).strip()
            is_risk, risk_reason = _check_hallucination(raw_answer, contexts, query=req.query)
            citations = _extract_citations(raw_answer, contexts)

            answer = raw_answer + (_HALLUCINATION_WARNING if is_risk else "")

            final_payload = {
                "type": "final",
                "query": req.query,
                "rewritten_query": rewrite.rewritten_query,
                "rewrite_skipped": rewrite.skipped,
                "rewrite_model": rewrite.model,
                "answer": answer,
                "citations": [_serialize_citation(c).model_dump() for c in citations],
                "contexts_used": [
                    ContextOut(
                        text=ctx.text,
                        rerank_score=ctx.rerank_score,
                        metadata=ctx.metadata or {},
                    ).model_dump()
                    for ctx in contexts
                ],
                "is_hallucination_risk": is_risk,
                "hallucination_reason": risk_reason,
                "model": gen.model,
                "tokens_used": tokens_used,
            }
            yield f"data: {json.dumps(final_payload, ensure_ascii=False)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)}, ensure_ascii=False)}\n\n"
        finally:
            gen.rerank_top_k = original_top_k
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        _rich_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/private-ingest",
    response_model=PrivateIngestResponse,
    summary="Index RAG private store — được gọi từ backend (8000) sau khi upload",
    description=(
        "Backend (port 8000) gọi endpoint này thay vì load model BGE trực tiếp.\n\n"
        "RAG service (port 8001) xử lý toàn bộ embedding + Pinecone upsert.\n\n"
        "Chạy không đồng bộ bằng cách gọi từ background thread — không block phản hồi FE."
    ),
)
def private_ingest(req: PrivateIngestRequest) -> PrivateIngestResponse:
    from api.services.mongo_rag_ingest import MongoRagIngestor, PRIVATE_NAMESPACE  # noqa: E402

    ns = (req.namespace or PRIVATE_NAMESPACE).strip() or PRIVATE_NAMESPACE
    ingestor = MongoRagIngestor()
    try:
        result = ingestor.ingest_private(
            user_id=req.user_id,
            store_id=req.store_id,
            limit=req.limit,
            namespace=ns,
            dry_run=False,
            clear=False,
        )
        return PrivateIngestResponse(
            status="indexed",
            user_id=req.user_id,
            store_id=req.store_id,
            reason=req.reason,
            namespace=ns,
            documents=int(result.get("documents", 0)),
            chunks_upserted=int(result.get("upserted", 0)),
        )
    except Exception as exc:
        logger.error("[RAG] private-ingest loi user=%s store=%s: %s", req.user_id, req.store_id, exc)
        return PrivateIngestResponse(
            status="failed",
            user_id=req.user_id,
            store_id=req.store_id,
            reason=req.reason,
            namespace=ns,
            error=str(exc)[:1000],
        )
    finally:
        ingestor.close()


@router.post(
    "/ingest",
    response_model=IngestResponse,
    summary="Re-index tài liệu admin (MongoDB → Pinecone)",
    description=(
        "Index lại các bản ghi `rag_documents` (status=active) đã upload từ trang admin.\n\n"
        "Nguồn duy nhất cho corpus pháp luật công khai — không đọc file .md từ thư mục data.\n\n"
        "Thêm/sửa từng bài trên admin thường tự index nền; endpoint này dùng khi cần re-index hàng loạt.\n\n"
        "⚠️ Chạy đồng bộ, có thể mất vài phút."
    ),
)
def ingest(req: IngestRequest) -> IngestResponse:
    namespace = (req.namespace or PINECONE_PUBLIC_NAMESPACE).strip()

    ingestor = MongoRagIngestor()
    try:
        result = ingestor.ingest_public(
            limit=req.limit,
            namespace=namespace,
            dry_run=req.dry_run,
            clear=req.clear_namespace,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingest thất bại: {exc}",
        ) from exc
    finally:
        ingestor.close()

    chunks = int(result.get("chunks", 0))
    upserted = int(result.get("upserted", 0))

    ns_display = namespace or "(default)"

    return IngestResponse(
        status="ok" if not req.dry_run else "dry_run",
        namespace=ns_display,
        documents=int(result.get("documents", 0)),
        chunks_total=chunks,
        chunks_upserted=upserted,
        dry_run=req.dry_run,
        message=(
            f"[DRY RUN] {chunks:,} chunks tính từ {result.get('documents', 0)} tài liệu admin."
            if req.dry_run
            else f"{upserted:,} vectors upsert từ {result.get('documents', 0)} tài liệu admin."
        ),
    )